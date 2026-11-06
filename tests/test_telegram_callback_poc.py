from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor

import pytest

from telegram_callback_poc import OfflineCallbackSelection


def fixture():
    return {'chat_id': -123, 'bot_id': 456, 'is_bot': True, 'message_id': 7,
            'issued_at': 100, 'expires_at': 200, 'row': 0, 'column': 1,
            'data': b'private-callback'}


def create(value=None, **kwargs):
    return OfflineCallbackSelection(fixture() if value is None else value,
                                    expected_chat_id=kwargs.get('chat', -123),
                                    expected_bot_id=kwargs.get('bot', 456),
                                    now=kwargs.get('now', 150))


def select(selection, **kwargs):
    args = {'message_id': 7, 'row': 0, 'column': 1, 'consent': True, 'now': 150}
    args.update(kwargs)
    return selection.select(**args)


def attempt_in_process(_):
    return select(create())


def test_explicit_selection_fails_closed_and_does_not_disclose_in_repr(capsys):
    selection = create()
    assert 'private-callback' not in repr(selection)
    assert select(selection, consent=False) is None
    assert select(selection, consent=1) is None
    assert select(selection) is None
    assert selection._data is None
    assert select(selection) is None
    assert capsys.readouterr() == ('', '')


@pytest.mark.parametrize('key,value', [
    ('chat_id', -124), ('chat_id', True), ('bot_id', 457), ('bot_id', True),
    ('is_bot', False), ('message_id', 0), ('message_id', True),
    ('issued_at', 151), ('expires_at', 150), ('expires_at', 401),
    ('row', -1), ('column', True), ('data', b''), ('data', b'x' * 65),
    ('data', 'text'), ('data', bytearray(b'x')),
])
def test_invalid_fixture_rejected(key, value):
    data = fixture()
    data[key] = value
    assert select(create(data)) is None


def test_strict_shape_identity_and_time():
    data = fixture()
    data['url'] = 'not-a-callback'
    assert select(create(data)) is None
    del data['url']
    del data['data']
    assert select(create(data)) is None
    assert select(create(chat=True)) is None
    assert select(create(bot=True)) is None
    assert select(create(now=True)) is None
    assert select(create(now=200)) is None
    assert select(create(), now=200) is None
    assert select(create(), now=99) is None


@pytest.mark.parametrize('kwargs', [
    {'message_id': 8}, {'message_id': True}, {'row': 1}, {'row': False},
    {'column': 0}, {'column': True}, {'now': True},
])
def test_approval_bound_to_exact_selection(kwargs):
    selection = create()
    assert select(selection, **kwargs) is None
    assert select(selection) is None


def test_cancel_is_final():
    selection = create()
    selection.cancel()
    assert select(selection) is None


def test_observed_expiration_erases_payload_and_cannot_be_reversed():
    selection = create()
    assert select(selection, now=200, consent=False, message_id=8) is None
    assert selection._data is None
    assert select(selection, now=150) is None


def test_no_release_across_instances():
    first = create()
    second = create()
    assert select(first) is None
    assert select(second) is None
    assert select(first) is None
    assert select(second) is None


def test_concurrent_approvals_never_release_callback():
    selection = create()
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda _: select(selection), range(20)))
    assert results.count(None) == 20


def test_replayed_fixtures_across_processes_never_release_callback():
    with ProcessPoolExecutor(max_workers=2) as pool:
        assert list(pool.map(attempt_in_process, range(8))) == [None] * 8


def test_recreated_fixture_with_rolled_back_time_never_releases_callback():
    assert select(create(), now=200) is None
    assert select(create(now=150), now=150) is None
