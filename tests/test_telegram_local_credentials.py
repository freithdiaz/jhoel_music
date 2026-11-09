import asyncio
import json

import pytest

import telegram_local_credentials as helper
import telegram_login_poc as login


def message(user_id=10, **changes):
    data = {'from': {'id': user_id, 'is_bot': False, 'username': 'Jhoelti'},
            'chat': {'id': user_id, 'type': 'private'}, 'text': '/start'}
    data.update(changes)
    return {'message': data}


def responses(monkeypatch, updates, webhook=None):
    calls = []
    def request(token, method, payload):
        calls.append((method, payload))
        return {'getMe': {'id': 20, 'is_bot': True, 'username': 'Mussicart_bot'},
                'getWebhookInfo': {'url': ''} if webhook is None else webhook,
                'getUpdates': updates}[method]
    monkeypatch.setattr(helper, 'bot_request', request)
    return calls


def test_discover_does_not_ack(monkeypatch):
    calls = responses(monkeypatch, [message(), message()])
    assert helper.discover('fake') == (10, 20)
    assert calls == [('getMe', {}), ('getWebhookInfo', {}),
                     ('getUpdates', {'limit': 100, 'timeout': 0})]


@pytest.mark.parametrize('updates', [[], [message(10), message(11)],
    [message()] * 100, [message(chat={'id': 10, 'type': 'group'})],
    [message(text='/starter')], [message(**{'from': {'id': 10, 'is_bot': False, 'username': 'other'}})]])
def test_discover_rejects_ambiguous_or_wrong_identity(monkeypatch, updates):
    responses(monkeypatch, updates)
    with pytest.raises(helper.Refused):
        helper.discover('fake')


def test_webhook_prevents_polling(monkeypatch):
    calls = responses(monkeypatch, [message()], {'url': 'active'})
    with pytest.raises(helper.Refused):
        helper.discover('fake')
    assert [call[0] for call in calls] == ['getMe', 'getWebhookInfo']


def test_denied_consent_does_not_read_or_connect(monkeypatch):
    monkeypatch.setattr(login.sys, 'argv', ['login', '--env'])
    monkeypatch.setattr(login.sys.stdin, 'isatty', lambda: True)
    monkeypatch.setattr(login.sys.stdout, 'isatty', lambda: True)
    monkeypatch.setattr('builtins.input', lambda _: 'NO')
    monkeypatch.setattr(helper, 'read_credentials', lambda: pytest.fail('read'))
    monkeypatch.setattr(helper, 'discover', lambda _: pytest.fail('network'))
    with pytest.raises(ValueError):
        asyncio.run(login.login())


def test_redirect_refused():
    with pytest.raises(helper.Refused):
        helper.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://example.org')


def test_env_credentials_take_precedence(monkeypatch, tmp_path):
    monkeypatch.setattr(helper, '__file__', str(tmp_path / 'helper.py'))
    (tmp_path / '.env').write_text('Api_id=123\nApi_hash="' + 'a' * 32 + '"\ntoken_telegram=12:abc_DEF\n')
    monkeypatch.setenv('TELEGRAM_API_ID', '456')
    monkeypatch.setenv('TELEGRAM_API_HASH', 'b' * 32)
    monkeypatch.setenv('TELEGRAM_BOT_TOKEN', '34:env_TOKEN')
    assert helper.read_credentials() == (456, 'b' * 32, '34:env_TOKEN')
    assert helper.read_bot_token() == '34:env_TOKEN'


def test_partial_env_credentials_are_rejected(monkeypatch):
    monkeypatch.setenv('TELEGRAM_API_ID', '456')
    monkeypatch.delenv('TELEGRAM_API_HASH', raising=False)
    monkeypatch.delenv('TELEGRAM_BOT_TOKEN', raising=False)
    with pytest.raises(helper.Refused):
        helper.read_credentials()


def test_env_is_strict_and_memory_only(monkeypatch, tmp_path):
    monkeypatch.delenv('TELEGRAM_API_ID', raising=False)
    monkeypatch.delenv('TELEGRAM_API_HASH', raising=False)
    monkeypatch.delenv('TELEGRAM_BOT_TOKEN', raising=False)
    monkeypatch.setattr(helper, '__file__', str(tmp_path / 'helper.py'))
    path = tmp_path / '.env'
    path.write_text('Api_id=123\nApi_hash="' + 'a' * 32 + '"\ntoken_telegram=12:abc_DEF\n')
    assert helper.read_credentials() == (123, 'a' * 32, '12:abc_DEF')
    path.write_text(path.read_text() + 'Api_id=456\n')
    with pytest.raises(helper.Refused):
        helper.read_credentials()


@pytest.mark.parametrize(('contents', 'expected'), [('', None), ('TELEGRAM_PHONE=\n', None),
    ('TELEGRAM_PHONE="+15551234567"\n', '+15551234567')])
def test_optional_phone_local_only(monkeypatch, tmp_path, contents, expected):
    monkeypatch.delenv('TELEGRAM_PHONE', raising=False)
    monkeypatch.setattr(helper, '__file__', str(tmp_path / 'helper.py'))
    (tmp_path / '.env').write_text(contents)
    assert helper.read_optional_phone() == expected


@pytest.mark.parametrize('contents', ['TELEGRAM_PHONE=invalid\n',
    'TELEGRAM_PHONE=+15551234567\nTELEGRAM_PHONE=+15551234567\n'])
def test_optional_phone_rejects_invalid_or_ambiguous(monkeypatch, tmp_path, contents):
    monkeypatch.delenv('TELEGRAM_PHONE', raising=False)
    monkeypatch.setattr(helper, '__file__', str(tmp_path / 'helper.py'))
    (tmp_path / '.env').write_text(contents)
    with pytest.raises(helper.Refused):
        helper.read_optional_phone()
