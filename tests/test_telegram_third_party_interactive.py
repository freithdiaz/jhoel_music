import asyncio
import logging
import sys
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

import telegram_third_party_interactive as cli


@pytest.fixture
def setup_cli(monkeypatch):
    monkeypatch.setattr(sys, 'argv', ['client'])
    monkeypatch.setattr(sys.stdin, 'isatty', lambda: True)
    monkeypatch.setattr(sys.stdout, 'isatty', lambda: True)
    answers = iter(['SI', '123', '42', '55', '55', '-77', '-77'])
    secrets = iter(['hash', 'phone', 'code'])
    monkeypatch.setattr('builtins.input', lambda prompt: next(answers))
    monkeypatch.setattr(cli, 'secret', lambda prompt: next(secrets))
    client = SimpleNamespace(connect=AsyncMock(), send_code_request=AsyncMock(),
                             sign_in=AsyncMock(), log_out=AsyncMock(return_value=True),
                             disconnect=AsyncMock())
    factory = lambda *args: client
    monkeypatch.setitem(sys.modules, 'telethon', SimpleNamespace(TelegramClient=factory))
    monkeypatch.setitem(sys.modules, 'telethon.errors', SimpleNamespace(SessionPasswordNeededError=type('Password', (Exception,), {})))
    monkeypatch.setitem(sys.modules, 'telethon.sessions', SimpleNamespace(MemorySession=lambda: object()))
    verify = AsyncMock()
    monkeypatch.setattr(cli, 'verify_identity', verify)
    return client, verify


def test_only_identity_and_logout(setup_cli):
    client, verify = setup_cli
    asyncio.run(cli.run())
    verify.assert_awaited_once_with(client, account_id=42, bot_id=55,
                                    confirmed_bot_id=55, group_id=-77,
                                    confirmed_group_id=-77)
    client.log_out.assert_awaited_once()
    client.disconnect.assert_awaited_once()


def test_mismatch_fails_before_connection(setup_cli, monkeypatch):
    client, verify = setup_cli
    answers = iter(['SI', '123', '42', '55', '56', '-77', '-77'])
    monkeypatch.setattr('builtins.input', lambda prompt: next(answers))
    with pytest.raises(ValueError):
        asyncio.run(cli.run())
    client.connect.assert_not_awaited()
    verify.assert_not_awaited()


def test_failure_revokes_and_suppresses_logout_error(setup_cli):
    client, verify = setup_cli
    verify.side_effect = ValueError('secret')
    client.log_out.return_value = False
    old = logging.root.manager.disable
    with pytest.raises(cli.LogoutNotConfirmed):
        asyncio.run(cli.run())
    client.disconnect.assert_awaited_once()
    assert logging.root.manager.disable == old


def test_noninteractive_fails_before_input(setup_cli, monkeypatch):
    client, _ = setup_cli
    monkeypatch.setattr(sys.stdin, 'isatty', lambda: False)
    with pytest.raises(ValueError):
        asyncio.run(cli.run())
    client.connect.assert_not_awaited()
