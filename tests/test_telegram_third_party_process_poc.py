from concurrent.futures import ThreadPoolExecutor

import pytest

from telegram_third_party_process_poc import OfflineProcessModel


def fixtures():
    search = dict(account_id=1, chat_id=-2, bot_id=3, is_bot=True, query='synthetic',
                  issued_at=100, expires_at=200, search_consent=True, search_id='s')
    result = dict(chat_id=-2, sender_id=3, is_bot=True, message_id=4, row=0, column=1,
                  issued_at=110, expires_at=190, search_id='s', query='synthetic', result_id='r')
    approval = dict(account_id=1, chat_id=-2, bot_id=3, message_id=4, row=0, column=1,
                    issued_at=120, expires_at=180, selection_consent=True,
                    exposure_consent=True, search_id='s', query='synthetic', result_id='r')
    return search, result, approval


def started():
    model = OfflineProcessModel()
    s, r, a = fixtures()
    assert model.start_search(s, account_id=1, chat_id=-2, confirmed_chat_id=-2,
                              bot_id=3, username='vkmusbot', now=150)
    return model, r, a


@pytest.mark.parametrize('changes', [dict(confirmed_chat_id=-3), dict(username='other'),
                                    dict(bot_id=4), dict(chat_id=2), dict(account_id=True)])
def test_search_identity_and_explicit_group(changes):
    s, _, _ = fixtures()
    args = dict(account_id=1, chat_id=-2, confirmed_chat_id=-2, bot_id=3,
                username='vkmusbot', now=150)
    args.update(changes)
    assert not OfflineProcessModel().start_search(s, **args)


def test_separate_consent_revalidation_and_one_attempt():
    m, r, a = started()
    assert not m.simulate_attempt(r, current_button=b'x', now=150)
    a['exposure_consent'] = False
    assert not m.approve_selection(r, a, button=b'x', now=150)
    a['exposure_consent'] = True
    assert m.approve_selection(r, a, button=b'x', now=150)
    assert not m.simulate_attempt(dict(r, sender_id=8), current_button=b'x', now=150)
    assert not m.simulate_attempt(r, current_button=b'y', now=150)
    assert not m.simulate_attempt(r, current_button=b'x', now=180)
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda _: m.simulate_attempt(r, current_button=b'x', now=150), range(20)))
    assert results.count(True) == 1
    assert not m.approve_selection(r, a, button=b'x', now=150)


def test_revocation_and_fixture_copy():
    m, r, a = started()
    assert m.approve_selection(r, a, button=b'x', now=150)
    r['row'] = 5
    assert not m.simulate_attempt(r, current_button=b'x', now=150)
    m.cancel()
    _, original, _ = fixtures()
    assert not m.simulate_attempt(original, current_button=b'x', now=150)
