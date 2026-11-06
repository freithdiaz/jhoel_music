import asyncio
import sys
from unittest.mock import AsyncMock

import pytest
from telethon.sessions import MemorySession
from telethon.tl.types import MessageReplyHeader, InputPeerChat

import telegram_third_party_callback as callback
import telegram_third_party_identity as identity
from test_telegram_third_party_callback import fixtures


class Client:
    session = MemorySession()
    _request_retries = 0

    def __init__(self, message):
        self.get_messages = AsyncMock(return_value=message)
        self.get_input_entity = AsyncMock(return_value=InputPeerChat(10))
        self.send = AsyncMock()

    def __call__(self, request):
        return self.send(request)


def setup_dispatch(monkeypatch):
    me, bot, group, message = fixtures()
    message.reply_to = MessageReplyHeader(reply_to_msg_id=2)
    client = Client(message)
    monkeypatch.setattr(callback, '_consumed', False)
    monkeypatch.setattr(identity, 'verify_identity', AsyncMock(return_value=(me, bot, group)))
    monkeypatch.setattr(sys.stdin, 'isatty', lambda: True)
    monkeypatch.setattr(sys.stdout, 'isatty', lambda: True)
    monkeypatch.setattr('builtins.input', lambda prompt: '1' if 'Índice' in prompt else 'SI')
    return client, message


def call(client, message):
    return asyncio.run(callback.dispatch_selected(client, message, (0, 0), 2,
                                                 account_id=1, bot_id=42, group_id=-10))


def test_default_gate_never_contacts_client(monkeypatch):
    client, message = setup_dispatch(monkeypatch)
    monkeypatch.setattr(callback, 'CALLBACK_DISPATCH_ENABLED', False)
    with pytest.raises(ValueError, match='deshabilitado'):
        call(client, message)
    identity.verify_identity.assert_not_awaited()
    client.send.assert_not_awaited()


def test_no_tty_or_consent_blocks_direct_dispatch(monkeypatch):
    client, message = setup_dispatch(monkeypatch)
    monkeypatch.setattr(callback, 'CALLBACK_DISPATCH_ENABLED', True)
    monkeypatch.setattr(sys.stdin, 'isatty', lambda: False)
    with pytest.raises(ValueError, match='interactiva'):
        call(client, message)
    identity.verify_identity.assert_not_awaited()
    monkeypatch.setattr(sys.stdin, 'isatty', lambda: True)
    monkeypatch.setattr('builtins.input', lambda prompt: '1' if 'Índice' in prompt else 'NO')
    with pytest.raises(ValueError, match='confirmada'):
        call(client, message)
    client.send.assert_not_awaited()


def test_refuses_changed_message_after_consent(monkeypatch):
    client, message = setup_dispatch(monkeypatch)
    monkeypatch.setattr(callback, 'CALLBACK_DISPATCH_ENABLED', True)
    changed = fixtures()[3]
    changed.reply_to = MessageReplyHeader(reply_to_msg_id=2)
    changed.message = 'changed'
    client.get_messages.side_effect = [message, changed]
    with pytest.raises(ValueError, match='modificado'):
        call(client, message)
    client.send.assert_not_awaited()


@pytest.mark.parametrize('failure', ['identity', 'membership'])
def test_identity_or_membership_change_after_consent_blocks_send(monkeypatch, failure):
    client, message = setup_dispatch(monkeypatch)
    monkeypatch.setattr(callback, 'CALLBACK_DISPATCH_ENABLED', True)
    me, bot, group, _ = fixtures()
    if failure == 'identity':
        changed_bot = fixtures()[1]
        changed_bot.id = 99
        second = (me, changed_bot, group)
    else:
        second = identity.IdentityRefused('Membresía no verificada')
    identity.verify_identity.side_effect = [(me, bot, group), second]
    with pytest.raises(ValueError):
        call(client, message)
    assert identity.verify_identity.await_count == 2
    assert client.get_messages.await_count == 1
    client.send.assert_not_awaited()


def test_uses_fresh_group_after_consent(monkeypatch):
    client, message = setup_dispatch(monkeypatch)
    monkeypatch.setattr(callback, 'CALLBACK_DISPATCH_ENABLED', True)
    me, bot, group, _ = fixtures()
    fresh_group = fixtures()[2]
    identity.verify_identity.side_effect = [(me, bot, group), (me, bot, fresh_group)]
    call(client, message)
    assert client.get_messages.await_args_list[1].args[0] is fresh_group
    assert client.get_input_entity.await_args.args[0] is fresh_group
    client.send.assert_awaited_once()


def test_one_attempt_even_on_timeout(monkeypatch, capsys):
    client, message = setup_dispatch(monkeypatch)
    monkeypatch.setattr(callback, 'CALLBACK_DISPATCH_ENABLED', True)
    client.send.side_effect = asyncio.TimeoutError
    with pytest.raises(asyncio.TimeoutError):
        call(client, message)
    with pytest.raises(ValueError, match='consumido'):
        call(client, message)
    assert client.send.await_count == 1
    assert 'secret' not in capsys.readouterr().out


def test_changed_or_unlinked_message_refused(monkeypatch):
    client, message = setup_dispatch(monkeypatch)
    monkeypatch.setattr(callback, 'CALLBACK_DISPATCH_ENABLED', True)
    current = fixtures()[3]
    current.reply_to = MessageReplyHeader(reply_to_msg_id=2)
    current.message = 'changed'
    client.get_messages.return_value = current
    with pytest.raises(ValueError):
        call(client, message)
    message.reply_to = None
    with pytest.raises(ValueError):
        call(client, message)
    client.send.assert_not_awaited()
