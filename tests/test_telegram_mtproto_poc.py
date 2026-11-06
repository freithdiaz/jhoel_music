import asyncio
import sqlite3
import sys
import types
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace as NS

import pytest

import telegram_mtproto_poc as poc


class User:
    def __init__(self, id, bot=False, username=None):
        self.id, self.bot, self.username = id, bot, username


class Button:
    data = b'secret'


class Chat:
    def __init__(self, id):
        self.id = id


class Channel(Chat):
    megagroup = True


@pytest.fixture(autouse=True)
def telethon_mock(monkeypatch):
    modules = ['telethon', 'telethon.tl', 'telethon.tl.functions',
               'telethon.tl.functions.messages', 'telethon.tl.types', 'telethon.utils']
    for name in modules:
        monkeypatch.setitem(sys.modules, name, types.ModuleType(name))
    tl = sys.modules['telethon.tl.types']
    tl.User, tl.Chat, tl.Channel, tl.KeyboardButtonCallback = User, Chat, Channel, Button
    sys.modules['telethon.utils'].get_peer_id = lambda obj: obj.id
    class Request:
        def __init__(self, **kwargs):
            self.fields = kwargs
    sys.modules['telethon.tl.functions.messages'].GetBotCallbackAnswerRequest = Request


class Client:
    def __init__(self):
        self.me = User(10)
        self.bot = User(20, True, 'Mussicart_bot')
        self.chat = Chat(-100)
        self.message = NS(id=30, chat_id=20, sender_id=20, out=False,
                          fwd_from=None, via_bot_id=None,
                          reply_markup=NS(rows=[NS(buttons=[Button()])]))

    async def get_me(self):
        return self.me

    async def get_entity(self, id):
        return self.bot if id == 20 else self.chat

    async def get_messages(self, *args, **kwargs):
        return self.message


def call(client, path, **changes):
    params = dict(account_id=10, bot_id=20, chat_id=20, message_id=30,
                  row=0, column=0, session_directory=path)
    params.update(changes)
    return asyncio.run(poc.select_callback(client, **params))


def test_session_gate_always_closed(tmp_path):
    with pytest.raises(poc.Refused):
        poc.require_session_directory(tmp_path)
    with pytest.raises(poc.Refused):
        poc.require_session_directory(poc.Path(poc.__file__).parent)


def test_transactional_reservation_across_connections(tmp_path):
    path = tmp_path / 'replay.sqlite'
    def attempt(_):
        try:
            poc.reserve(path, 10, 20, -100, 30, 0, 0)
            return True
        except sqlite3.IntegrityError:
            return False
    with ThreadPoolExecutor(max_workers=8) as pool:
        assert sum(pool.map(attempt, range(20))) == 1


@pytest.mark.parametrize('change', [
    {'chat_id': 0}, {'row': -1},
    {'column': True}, {'account_id': True}, {'message_id': 31},
])
def test_rejects_invalid_selection(tmp_path, change):
    with pytest.raises(poc.Refused):
        call(Client(), tmp_path / 'state', **change)
    assert not (tmp_path / 'state').exists()


@pytest.mark.parametrize('field,value', [
    ('sender_id', 21), ('chat_id', -20), ('out', True),
    ('fwd_from', object()), ('via_bot_id', 99),
])
def test_rejects_wrong_origin(tmp_path, field, value, monkeypatch):
    monkeypatch.setattr(poc, 'verified_session_directory', lambda _: True)
    client = Client()
    setattr(client.message, field, value)
    with pytest.raises(poc.Refused):
        call(client, tmp_path / 'state')


def test_rejects_bot_identity_and_non_callback(tmp_path, monkeypatch):
    monkeypatch.setattr(poc, 'verified_session_directory', lambda _: True)
    client = Client()
    client.bot.username = 'other_bot'
    with pytest.raises(poc.Refused):
        call(client, tmp_path / 'state')
    client.bot.username = 'Mussicart_bot'
    client.message.reply_markup.rows[0].buttons[0] = NS(data=b'secret')
    with pytest.raises(poc.Refused):
        call(client, tmp_path / 'state')


def test_dispatch_once_and_replay_blocked(tmp_path, monkeypatch):
    monkeypatch.setattr(poc, 'verified_session_directory', lambda _: True)
    monkeypatch.setattr(poc, 'confirm_selection', lambda *args: None)
    class DispatchClient(Client):
        async def __call__(self, request):
            self.request = request
    client = DispatchClient()
    path = tmp_path
    client.message.chat_id = -100
    call(client, path, chat_id=-100)
    assert client.request.fields['data'] == b'secret'
    assert client.request.fields['peer'] is client.chat
    with pytest.raises(poc.Refused):
        call(client, path, chat_id=-100)


def test_acl_gate_blocks_before_any_client_access(tmp_path):
    class NoNetwork:
        def __getattr__(self, name):
            pytest.fail('client accessed before ACL gate')
    with pytest.raises(poc.Refused):
        call(NoNetwork(), tmp_path)


def test_console_consent_required(monkeypatch):
    monkeypatch.setattr(poc.sys.stdin, 'isatty', lambda: True)
    monkeypatch.setattr(poc.sys.stdout, 'isatty', lambda: True)
    monkeypatch.setattr('builtins.input', lambda _: 'no')
    with pytest.raises(poc.Refused):
        poc.confirm_selection(10, 20, -100, 30, 0, 0)
    monkeypatch.setattr('builtins.input', lambda _: 'SI')
    poc.confirm_selection(10, 20, -100, 30, 0, 0)
