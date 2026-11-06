import asyncio
import sys
import types

import pytest

import telegram_login_poc as poc


class User:
    def __init__(self, id, bot=False, username=None):
        self.id, self.bot, self.username = id, bot, username


@pytest.fixture
def fake_telethon(monkeypatch):
    monkeypatch.setattr(poc.sys, 'argv', ['telegram_login_poc.py'])
    monkeypatch.setattr(poc.sys.stdin, 'isatty', lambda: True)
    monkeypatch.setattr(poc.sys.stdout, 'isatty', lambda: True)
    answers = iter(['SI', '1', '10', '20'])
    monkeypatch.setattr('builtins.input', lambda _: next(answers))
    modules = {name: types.ModuleType(name) for name in
               ('telethon', 'telethon.errors', 'telethon.sessions',
                'telethon.tl', 'telethon.tl.types')}
    for name, module in modules.items():
        monkeypatch.setitem(sys.modules, name, module)

    class PasswordRequired(Exception):
        pass

    class MemorySession:
        pass

    class Client:
        instances = []

        def __init__(self, session, api_id, api_hash):
            assert isinstance(session, MemorySession)
            self.instances.append(self)
            self.calls = []
            self.me = User(10)
            self.bot = User(20, True, 'Mussicart_bot')

        async def connect(self):
            self.calls.append('connect')

        async def send_code_request(self, phone):
            self.calls.append('code')

        async def sign_in(self, **kwargs):
            self.calls.append('sign_in')
            if 'code' in kwargs and self.require_password:
                raise PasswordRequired()

        async def get_me(self):
            return self.me

        async def get_entity(self, bot_id):
            self.entity_arg = bot_id
            return self.bot

        async def log_out(self):
            self.calls.append('log_out')
            return True

        async def disconnect(self):
            self.calls.append('disconnect')

    Client.require_password = False
    modules['telethon'].TelegramClient = Client
    modules['telethon.errors'].SessionPasswordNeededError = PasswordRequired
    modules['telethon.sessions'].MemorySession = MemorySession
    modules['telethon.tl.types'].User = User
    monkeypatch.setattr(poc, 'secret', lambda prompt: 'secret')
    return Client


@pytest.mark.parametrize('password', [False, True])
def test_memory_login_disconnects_without_callbacks(fake_telethon, password):
    fake_telethon.require_password = password
    asyncio.run(poc.login())
    calls = fake_telethon.instances[0].calls
    assert calls == ['connect', 'code'] + ['sign_in'] * (2 if password else 1) + ['log_out', 'disconnect']
    assert fake_telethon.instances[0].entity_arg == 'mussicart_bot'


def test_wrong_identity_disconnects(fake_telethon):
    async def wrong_me(self):
        return User(11)
    fake_telethon.get_me = wrong_me
    with pytest.raises(ValueError):
        asyncio.run(poc.login())
    assert fake_telethon.instances[0].calls[-2:] == ['log_out', 'disconnect']


@pytest.mark.parametrize('bot', [User(21, True, 'mussicart_bot'),
                                 User(20, False, 'mussicart_bot'),
                                 User(20, True, 'other_bot'), object()])
def test_wrong_bot_disconnects(fake_telethon, bot):
    async def wrong_bot(self, bot_id):
        return bot
    fake_telethon.get_entity = wrong_bot
    with pytest.raises(ValueError):
        asyncio.run(poc.login())
    assert fake_telethon.instances[0].calls[-2:] == ['log_out', 'disconnect']


@pytest.mark.parametrize('result', [False, None, 'exception'])
def test_logout_failure_requires_manual_revocation(fake_telethon, result):
    async def failed_logout(self):
        self.calls.append('log_out')
        if result == 'exception':
            raise RuntimeError('secret')
        return result
    fake_telethon.log_out = failed_logout
    with pytest.raises(poc.LogoutNotConfirmed):
        asyncio.run(poc.login())
    assert fake_telethon.instances[0].calls[-2:] == ['log_out', 'disconnect']


def test_logout_failure_takes_precedence_over_identity_and_disconnect(fake_telethon):
    async def wrong_bot(self, bot_id):
        return User(21, True, 'mussicart_bot')
    async def failed_logout(self):
        raise RuntimeError('secret')
    async def failed_disconnect(self):
        raise RuntimeError('secret')
    fake_telethon.get_entity = wrong_bot
    fake_telethon.log_out = failed_logout
    fake_telethon.disconnect = failed_disconnect
    with pytest.raises(poc.LogoutNotConfirmed):
        asyncio.run(poc.login())


def test_main_reports_unconfirmed_logout(monkeypatch, fake_telethon, capsys):
    monkeypatch.setattr(poc.sys.stdout, 'isatty', lambda: True)
    async def failed_logout(self):
        return False
    fake_telethon.log_out = failed_logout
    assert poc.main() == 1
    output = capsys.readouterr().out
    assert 'No se confirmó la revocación' in output
    assert 'Dispositivos' in output


def test_authentication_failure_still_attempts_logout(fake_telethon):
    async def failed_sign_in(self, **kwargs):
        raise ValueError('failed')
    fake_telethon.sign_in = failed_sign_in
    with pytest.raises(ValueError):
        asyncio.run(poc.login())
    assert fake_telethon.instances[0].calls[-2:] == ['log_out', 'disconnect']


@pytest.mark.parametrize('error', [TimeoutError, asyncio.CancelledError])
def test_uncertain_sign_in_and_failed_logout_require_manual_revocation(fake_telethon, error):
    async def uncertain_sign_in(self, **kwargs):
        raise error()
    async def failed_logout(self):
        self.calls.append('log_out')
        return False
    fake_telethon.sign_in = uncertain_sign_in
    fake_telethon.log_out = failed_logout
    with pytest.raises(poc.LogoutNotConfirmed):
        asyncio.run(poc.login())
    assert fake_telethon.instances[0].calls[-2:] == ['log_out', 'disconnect']


def test_failed_2fa_prompt_still_attempts_logout(fake_telethon, monkeypatch):
    fake_telethon.require_password = True
    def secret(prompt):
        if 'dos pasos' in prompt:
            raise KeyboardInterrupt()
        return 'secret'
    monkeypatch.setattr(poc, 'secret', secret)
    async def failed_logout(self):
        return False
    fake_telethon.log_out = failed_logout
    with pytest.raises(poc.LogoutNotConfirmed):
        asyncio.run(poc.login())


def test_no_consent_no_login(monkeypatch, fake_telethon):
    monkeypatch.setattr(poc.sys, 'argv', ['telegram_login_poc.py'])
    monkeypatch.setattr(poc.sys.stdin, 'isatty', lambda: True)
    monkeypatch.setattr(poc.sys.stdout, 'isatty', lambda: True)
    monkeypatch.setattr('builtins.input', lambda _: 'NO')
    monkeypatch.setattr(poc, 'secret', lambda _: pytest.fail('credentials requested'))
    with pytest.raises(ValueError):
        asyncio.run(poc.login())
    assert not fake_telethon.instances


def test_direct_login_rejects_noninteractive(monkeypatch, fake_telethon):
    monkeypatch.setattr(poc.sys.stdin, 'isatty', lambda: False)
    monkeypatch.setattr('builtins.input', lambda _: pytest.fail('input requested'))
    with pytest.raises(ValueError):
        asyncio.run(poc.login())
    assert not fake_telethon.instances


def test_getpass_fallback_rejected(monkeypatch):
    import warnings
    def insecure(_):
        warnings.warn('echo', poc.getpass.GetPassWarning)
    monkeypatch.setattr(poc.getpass, 'getpass', insecure)
    with pytest.raises(poc.getpass.GetPassWarning):
        poc.secret('secret: ')


def test_env_login_checks_username_and_revokes(fake_telethon, monkeypatch):
    import telegram_local_credentials as helper
    monkeypatch.setattr(poc.sys, 'argv', ['login', '--env'])
    monkeypatch.setattr('builtins.input', lambda _: 'SI')
    monkeypatch.setattr(helper, 'read_credentials', lambda: (1, 'hash', 'token'))
    monkeypatch.setattr(helper, 'discover', lambda token: (10, 20))
    async def me(self):
        return User(10, username='Jhoelti')
    fake_telethon.get_me = me
    asyncio.run(poc.login())
    assert fake_telethon.instances[0].calls[-2:] == ['log_out', 'disconnect']


def test_env_login_rejects_changed_username_and_revokes(fake_telethon, monkeypatch):
    import telegram_local_credentials as helper
    monkeypatch.setattr(poc.sys, 'argv', ['login', '--env'])
    monkeypatch.setattr('builtins.input', lambda _: 'SI')
    monkeypatch.setattr(helper, 'read_credentials', lambda: (1, 'hash', 'token'))
    monkeypatch.setattr(helper, 'discover', lambda token: (10, 20))
    with pytest.raises(ValueError):
        asyncio.run(poc.login())
    assert fake_telethon.instances[0].calls[-2:] == ['log_out', 'disconnect']
