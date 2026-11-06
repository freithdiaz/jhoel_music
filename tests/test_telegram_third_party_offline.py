from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor

import pytest

from telegram_third_party_offline import (dispatch, ledger_transition, validate_search,
                                         validate_selection)


def fixtures():
    search = dict(account_id=1, chat_id=-2, bot_id=3, is_bot=True, query='synthetic',
                  issued_at=100, expires_at=200, search_consent=True, search_id='search-1')
    result = dict(chat_id=-2, sender_id=3, is_bot=True, message_id=4, row=0, column=1,
                  issued_at=110, expires_at=190, search_id='search-1', query='synthetic',
                  result_id='result-1')
    approval = dict(account_id=1, chat_id=-2, bot_id=3, message_id=4, row=0, column=1,
                    issued_at=120, expires_at=180, selection_consent=True,
                    exposure_consent=True, search_id='search-1', query='synthetic',
                    result_id='result-1')
    return search, result, approval


def check(search, result, approval, now=150):
    return validate_selection(search, result, approval, account_id=1, chat_id=-2,
                              bot_id=3, now=now)


def replay(_):
    s, r, a = fixtures()
    return check(s, r, a), dispatch(s, r, a)


def test_synthetic_validity_never_enables_dispatch():
    s, r, a = fixtures()
    assert validate_search(s, account_id=1, chat_id=-2, bot_id=3, now=150)
    assert check(s, r, a)
    assert dispatch(s, r, a) is False
    assert dispatch() is False


@pytest.mark.parametrize('part,key,value', [
    (0, 'account_id', True), (0, 'chat_id', -9), (0, 'bot_id', 9),
    (0, 'is_bot', 1), (0, 'search_consent', 1), (0, 'query', '  '),
    (0, 'expires_at', 401), (0, 'issued_at', 151),
    (1, 'chat_id', -9), (1, 'sender_id', 9), (1, 'is_bot', False),
    (1, 'message_id', True), (1, 'row', False), (1, 'column', -1),
    (1, 'issued_at', 99), (1, 'expires_at', 150),
    (2, 'account_id', 2), (2, 'chat_id', -9), (2, 'bot_id', 9),
    (2, 'message_id', 5), (2, 'row', 1), (2, 'column', True),
    (2, 'selection_consent', False), (2, 'exposure_consent', 1),
    (2, 'issued_at', 109), (2, 'expires_at', 191),
    (0, 'search_id', ''), (0, 'query', 'another'),
    (1, 'search_id', 'other'), (1, 'query', 'another'), (1, 'result_id', ''),
    (1, 'expires_at', 201), (2, 'search_id', 'other'), (2, 'query', 'another'),
    (2, 'result_id', 'other'),
])
def test_reject_invalid_fields(part, key, value):
    data = fixtures()
    data[part][key] = value
    assert not check(*data)
    assert dispatch(*data) is False


def test_exact_shape_and_expiry():
    s, r, a = fixtures()
    assert not check(s, r, a, now=True)
    assert not check(s, r, a, now=180)
    assert not check(s, r, a, now=119)
    a['payload'] = b'not accepted'
    assert not check(s, r, a)
    del a['payload']
    del r['message_id']
    assert not check(s, r, a)
    assert not validate_search(s, account_id=True, chat_id=-2, bot_id=3, now=150)


def test_replay_simulations_are_not_replay_protection():
    # Pure validation repeats successfully: only unconditional dispatch blocking
    # prevents effects; no state, trusted clock, or cross-process guard exists.
    assert replay(0) == (True, False)
    assert replay(0) == (True, False)
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert list(pool.map(replay, range(4))) == [(True, False)] * 4
    with ProcessPoolExecutor(max_workers=2) as pool:
        assert list(pool.map(replay, range(4))) == [(True, False)] * 4
    s, r, a = fixtures()
    assert not check(s, r, a, now=180)
    assert check(s, r, a, now=150)  # caller-controlled clock can roll back
    assert not dispatch(s, r, a)


def test_selection_cannot_mix_synthetic_searches_or_results():
    s, r, a = fixtures()
    other_s, other_r, other_a = fixtures()
    other_s.update(search_id='search-2', query='other query')
    other_r.update(search_id='search-2', query='other query', result_id='result-2')
    other_a.update(search_id='search-2', query='other query', result_id='result-2')
    assert check(other_s, other_r, other_a)
    assert not check(s, other_r, other_a)
    assert not check(s, r, other_a)


@pytest.mark.parametrize('terminal', ['consumed', 'cancelled', 'uncertain'])
@pytest.mark.parametrize('action', ['consume', 'cancel'])
def test_ledger_model_terminal_states_never_allow_retry(terminal, action):
    assert ledger_transition(terminal, action) == (terminal, False)


def test_ledger_model_serialized_contenders_cancellation_and_uncertainty():
    # These are sequential specification examples, not cross-process tests.
    state, accepted = ledger_transition('available', 'consume')
    assert accepted and state == 'consumed'
    assert ledger_transition(state, 'consume') == ('consumed', False)
    state, accepted = ledger_transition(state, 'uncertain')
    assert accepted and state == 'uncertain'
    assert ledger_transition(state, 'consume') == ('uncertain', False)
    state, accepted = ledger_transition('available', 'cancel')
    assert accepted and state == 'cancelled'
    assert ledger_transition(state, 'consume') == ('cancelled', False)
    assert ledger_transition('available', 'uncertain') == ('available', False)
    assert ledger_transition('unknown', 'consume') == ('unknown', False)
    assert ledger_transition('available', []) == ('available', False)
