import pytest

from telegram_third_party_correlation import correlate


def fixture():
    command = dict(chat_id=-3, message_id=10, date=100, edited=False)
    message = dict(chat_id=-3, sender_id=2, is_bot=True, message_id=11,
                   reply_to_chat_id=-3, reply_to_message_id=10, date=101,
                   edited=False, digest='a' * 64)
    options = dict(group_id=-3, bot_id=2, window_end=110, now=110,
                   observation_complete=True)
    return command, message, options


def test_exact_reply_with_complete_stable_window():
    command, message, options = fixture()
    assert correlate(command, [(message, message.copy())], **options) == 11


@pytest.mark.parametrize('field,value', [
    ('chat_id', -4), ('sender_id', 3), ('is_bot', False), ('is_bot', 1),
    ('message_id', 10), ('message_id', True), ('reply_to_chat_id', None),
    ('reply_to_chat_id', -4), ('reply_to_message_id', None),
    ('reply_to_message_id', 9), ('reply_to_message_id', True),
    ('date', 100), ('date', 110), ('date', True), ('edited', True),
    ('edited', None), ('digest', ''), ('digest', 'A' * 64),
])
def test_invalid_candidate_fails_closed(field, value):
    command, message, options = fixture()
    message[field] = value
    assert correlate(command, [(message, message.copy())], **options) is None


def test_multiple_missing_changed_or_ambiguous_observations_rejected():
    command, message, options = fixture()
    changed = dict(message, digest='b' * 64)
    for observations in ([], [(message, message), (message, message)],
                         [(message, changed)], [(message, dict(message, is_bot=1))],
                         [(message,)], [message],
                         [(message, dict(message, extra=1))]):
        assert correlate(command, observations, **options) is None


@pytest.mark.parametrize('changes', [
    {'observation_complete': False}, {'observation_complete': 1},
    {'now': 109}, {'now': True}, {'window_end': 100}, {'window_end': 401},
    {'group_id': -4}, {'group_id': True}, {'bot_id': True}, {'bot_id': 3},
])
def test_untrusted_window_or_expected_identity_rejected(changes):
    command, message, options = fixture()
    options.update(changes)
    assert correlate(command, [(message, message.copy())], **options) is None


@pytest.mark.parametrize('changes', [
    {'chat_id': -4}, {'message_id': True}, {'date': True}, {'edited': True},
    {'edited': None}, {'extra': 1},
])
def test_untrusted_command_rejected(changes):
    command, message, options = fixture()
    command.update(changes)
    assert correlate(command, [(message, message.copy())], **options) is None
