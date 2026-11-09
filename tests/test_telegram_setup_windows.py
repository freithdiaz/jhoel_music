import asyncio
from types import SimpleNamespace

import pytest
import telethon

import telegram_setup_windows as setup


def test_requires_interactive_console(monkeypatch, capsys):
    monkeypatch.setattr(setup.sys.stdin, 'isatty', lambda: False)
    assert setup.main() == 1
    assert 'consola interactiva' in capsys.readouterr().out


def test_session_path_uses_local_appdata(monkeypatch, tmp_path):
    monkeypatch.setattr(setup.os, 'name', 'nt')
    monkeypatch.setenv('LOCALAPPDATA', str(tmp_path))
    assert setup.session_path() == tmp_path / 'DiazMusic' / 'telegram-session.dpapi'


def test_missing_local_appdata_is_rejected(monkeypatch):
    monkeypatch.delenv('LOCALAPPDATA', raising=False)
    with pytest.raises(ValueError):
        setup.session_path()


class FakeClient:
    def __init__(self, *args, **kwargs):
        self.session = SimpleNamespace(save=lambda: 'fake-session')
        self.events = []

    async def connect(self):
        self.events.append('connect')

    async def sign_in(self, **kwargs):
        self.events.append('sign_in')

    async def log_out(self):
        self.events.append('log_out')
        return True

    async def disconnect(self):
        self.events.append('disconnect')


def configure_fake_login(monkeypatch, tmp_path):
    client = FakeClient()
    monkeypatch.setattr(telethon, 'TelegramClient', lambda *args, **kwargs: client)
    monkeypatch.setattr(setup, 'session_path', lambda: tmp_path / 'private' / 'session.dat')
    monkeypatch.setattr(setup, 'read_credentials', lambda: (123, 'hash', 'token'))
    monkeypatch.setattr(setup, 'read_optional_phone', lambda: '+123456789')
    monkeypatch.setattr(setup, 'secret', lambda prompt: 'code')

    async def request_code(*args):
        client.events.append('request_code')

    monkeypatch.setattr(setup, 'request_code', request_code)
    return client


def test_identity_is_checked_before_saving(monkeypatch, tmp_path):
    client = configure_fake_login(monkeypatch, tmp_path)

    async def verify(*args, **kwargs):
        client.events.append('verify')

    monkeypatch.setattr(setup, 'verify_identity', verify)
    monkeypatch.setattr(setup, 'save_session', lambda *args: client.events.append('save'))
    asyncio.run(setup.setup())
    assert client.events == ['connect', 'request_code', 'sign_in', 'verify', 'save', 'disconnect']


def test_failed_identity_revokes_session_and_does_not_save(monkeypatch, tmp_path):
    client = configure_fake_login(monkeypatch, tmp_path)

    async def verify(*args, **kwargs):
        client.events.append('verify')
        raise ValueError('wrong account')

    monkeypatch.setattr(setup, 'verify_identity', verify)
    monkeypatch.setattr(setup, 'save_session', lambda *args: client.events.append('save'))
    with pytest.raises(ValueError):
        asyncio.run(setup.setup())
    assert client.events == ['connect', 'request_code', 'sign_in', 'verify', 'log_out', 'disconnect']


def test_save_failure_revokes_session(monkeypatch, tmp_path):
    client = configure_fake_login(monkeypatch, tmp_path)

    async def verify(*args, **kwargs):
        client.events.append('verify')

    def fail_save(*args):
        client.events.append('save')
        raise OSError('failed')

    monkeypatch.setattr(setup, 'verify_identity', verify)
    monkeypatch.setattr(setup, 'save_session', fail_save)
    with pytest.raises(OSError):
        asyncio.run(setup.setup())
    assert client.events == ['connect', 'request_code', 'sign_in', 'verify', 'save', 'log_out', 'disconnect']
