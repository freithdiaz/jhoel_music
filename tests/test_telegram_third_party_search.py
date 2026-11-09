import asyncio
import logging
import socket
from types import SimpleNamespace

import pytest
from telethon.tl.types import Message, MessageReplyHeader, PeerChat, PeerUser

import telegram_third_party_search as search


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    monkeypatch.setattr(search, 'read_optional_phone', lambda: None)
    original_connect = socket.socket.connect

    def blocked(*args, **kwargs):
        raise AssertionError('network access forbidden')

    def connect(sock, address):
        # Windows asyncio builds its internal socketpair over loopback.
        if isinstance(address, tuple) and address[0] == '127.0.0.1':
            return original_connect(sock, address)
        return blocked()

    monkeypatch.setattr(socket.socket, 'connect', connect)
    monkeypatch.setattr(socket.socket, 'connect_ex', blocked)
    monkeypatch.setattr(socket, 'create_connection', blocked)


def message(sender=42, reply=None, chat=10):
    return Message(id=3, peer_id=PeerChat(chat), date=None, message='privado',
                   from_id=PeerUser(sender), reply_to=reply)


def test_classification_never_returns_content():
    linked = MessageReplyHeader(reply_to_msg_id=7)
    assert search.classify(message(reply=linked), -10, 42, 7) == ('vinculado', 'sin medio')
    assert search.classify(message(reply=linked), -10, 42, None) == ('indeterminado', 'sin medio')
    assert search.classify(message(), -10, 42, 7) == ('indeterminado', 'sin medio')
    assert search.classify(message(sender=43), -10, 42, 7) is None
    assert search.classify(message(chat=11), -10, 42, 7) is None


def test_search_registers_before_one_send_and_removes_handler(monkeypatch):
    class Client:
        def add_event_handler(self, fn, event):
            self.fn, self.event = fn, event

        async def send_message(self, group, query):
            self.calls = getattr(self, 'calls', 0) + 1
            assert self.fn is not None
            assert query == '/song@vkmusbot una canción'
            return SimpleNamespace(id=7)

        def remove_event_handler(self, fn, event):
            assert fn is self.fn and event is self.event
            self.removed = True

    client = Client()

    async def observe(_):
        await client.fn(SimpleNamespace(message=message(reply=MessageReplyHeader(reply_to_msg_id=7))))
        await client.fn(SimpleNamespace(message=message(sender=43)))

    monkeypatch.setattr(search.asyncio, 'sleep', observe)
    result = asyncio.run(search.search_once(client, object(), -10, 42, 'una canción'))
    assert result == [('vinculado', 'sin medio')]
    assert client.calls == 1 and client.removed


def test_early_search_returns_after_verified_sender_supplies_buttons():
    class Client:
        def add_event_handler(self, fn, event):
            self.fn, self.event = fn, event

        async def send_message(self, group, query):
            answer = message(reply=MessageReplyHeader(reply_to_msg_id=7))
            answer.reply_markup = SimpleNamespace()
            asyncio.get_running_loop().call_soon(lambda: asyncio.create_task(self.fn(SimpleNamespace(message=answer))))
            return SimpleNamespace(id=7)

        def remove_event_handler(self, fn, event):
            self.removed = True

    client = Client()
    async def run():
        return await asyncio.wait_for(search.search_once(client, object(), -10, 42, 'canción', early_stop=True), 4)
    # La respuesta puede llegar antes de que send_message devuelva el ID.
    assert asyncio.run(run()) == [('indeterminado', 'sin medio')]
    assert client.removed


@pytest.mark.parametrize('query', ['', ' /other', 'a\nb', 'a\rb', 'a\tb',
                                   'a\x00b', 'a\x9bb', 'a\u2028b', 'x' * 201])
def test_invalid_query_never_registers_or_sends(query):
    with pytest.raises(ValueError):
        asyncio.run(search.search_once(object(), object(), -10, 42, query))


def test_search_command_normalizes_spaces():
    assert search.search_command(' canción ') == '/song@vkmusbot canción'


def test_denied_connection_never_reads_credentials(monkeypatch):
    monkeypatch.setattr(search.sys, 'argv', ['program'])
    monkeypatch.setattr(search.sys.stdin, 'isatty', lambda: True)
    monkeypatch.setattr(search.sys.stdout, 'isatty', lambda: True)
    monkeypatch.setattr('builtins.input', lambda _: 'NO')
    monkeypatch.setattr(search, 'read_credentials', lambda: (_ for _ in ()).throw(AssertionError()))
    assert search.main() == 1


def test_local_phone_and_id_confirmation_before_connection(monkeypatch, capsys):
    import telethon
    phone = '+15551234567'
    monkeypatch.setattr(search.sys, 'argv', ['program'])
    monkeypatch.setattr(search.sys.stdin, 'isatty', lambda: True)
    monkeypatch.setattr(search.sys.stdout, 'isatty', lambda: True)
    monkeypatch.setattr(search, 'read_credentials', lambda: (123, 'fake', 'fake'))
    monkeypatch.setattr(search, 'read_optional_phone', lambda: phone)
    monkeypatch.setattr(search, 'secret', lambda _: pytest.fail('unexpected phone prompt'))
    monkeypatch.setattr(telethon, 'TelegramClient', lambda *a, **kw: pytest.fail('connected'))
    answers = iter(['SI', 'NO'])
    monkeypatch.setattr('builtins.input', lambda _: next(answers))
    assert search.main() == 1
    output = capsys.readouterr().out
    assert str(search.ACCOUNT_ID) in output and str(search.BOT_ID) in output
    assert str(search.GROUP_ID) in output and phone not in output


def test_telethon_imports_and_memory_client_construct_offline():
    from telethon import TelegramClient
    from telethon.errors import SessionPasswordNeededError
    from telethon.sessions import MemorySession

    client = TelegramClient(MemorySession(), 123, 'test_hash', request_retries=0,
                            connection_retries=0, auto_reconnect=False)
    assert isinstance(client.session, MemorySession)
    assert issubclass(SessionPasswordNeededError, Exception)


@pytest.mark.parametrize(('retries', 'expected_calls'), [(0, 1), (5, 2)])
def test_telethon_code_request_simulated_migration_offline(retries, expected_calls):
    from telethon import TelegramClient
    from telethon.errors import PhoneMigrateError
    from telethon.sessions import MemorySession
    from telethon.tl.types.auth import SentCode, SentCodeTypeApp

    client = TelegramClient(MemorySession(), 123, 'test_hash', request_retries=retries)
    switched = []

    async def authorized():
        return False

    async def switch_dc(dc):
        switched.append(dc)

    class Sender:
        calls = 0

        async def send(self, request, ordered=False):
            self.calls += 1
            if self.calls == 1:
                raise PhoneMigrateError(request=request, capture=2)
            return SentCode(type=SentCodeTypeApp(length=5), phone_code_hash='fake')

    sender = Sender()
    client._sender = sender
    client.is_user_authorized = authorized
    client._switch_dc = switch_dc

    async def exercise():
        if retries == 0:
            with pytest.raises(ValueError):
                await client.send_code_request('+15550000000')
        else:
            assert isinstance(await client.send_code_request('+15550000000'), SentCode)

    asyncio.run(exercise())
    assert sender.calls == expected_calls
    assert switched == [2]


@pytest.mark.parametrize('migrations', [1, 3])
def test_request_code_retries_only_bounded_applied_migrations(migrations):
    from telethon import TelegramClient
    from telethon.errors import PhoneMigrateError
    from telethon.sessions import MemorySession
    from telethon.tl.types.auth import SentCode, SentCodeTypeApp

    client = TelegramClient(MemorySession(), 123, 'test_hash', request_retries=0,
                            raise_last_call_error=True)

    async def authorized():
        return False

    async def switch_dc(dc):
        client.session.set_dc(dc, '127.0.0.1', 443)

    class Sender:
        calls = 0

        async def send(self, request, ordered=False):
            self.calls += 1
            if self.calls <= migrations:
                raise PhoneMigrateError(request=request, capture=2)
            return SentCode(type=SentCodeTypeApp(length=5), phone_code_hash='fake')

    sender = Sender()
    client._sender = sender
    client.is_user_authorized = authorized
    client._switch_dc = switch_dc

    async def exercise():
        if migrations == 1:
            assert isinstance(await search.request_code(client, '+15550000000'), SentCode)
        else:
            with pytest.raises(PhoneMigrateError):
                await search.request_code(client, '+15550000000')

    asyncio.run(exercise())
    assert sender.calls == min(migrations + 1, search.MAX_CODE_MIGRATIONS + 1)
    assert client._request_retries == 0


def test_real_telethon_search_send_has_no_retries(monkeypatch):
    from telethon import TelegramClient
    from telethon.errors import ServerError
    from telethon.sessions import MemorySession
    from telethon.tl.types import InputPeerUser

    client = TelegramClient(MemorySession(), 123, 'test_hash', request_retries=0,
                            raise_last_call_error=True)

    class Sender:
        calls = 0

        async def send(self, request, ordered=False):
            self.calls += 1
            raise ServerError(request=request, message='test')

    sender = Sender()
    client._sender = sender
    monkeypatch.setattr(client, 'add_event_handler', lambda *args: None)
    monkeypatch.setattr(client, 'remove_event_handler', lambda *args: None)

    async def exercise():
        with pytest.raises(ServerError):
            await search.search_once(client, InputPeerUser(42, 1), -10, 42, 'test')

    asyncio.run(exercise())
    assert sender.calls == 1
    assert client._request_retries == 0


def test_code_request_does_not_retry_unapplied_migration_or_other_failure():
    from telethon.errors import PhoneMigrateError

    class Client:
        session = SimpleNamespace(dc_id=1)

        def __init__(self, error):
            self.error = error
            self.calls = 0

        async def send_code_request(self, phone):
            self.calls += 1
            raise self.error

    async def exercise():
        for error in (PhoneMigrateError(request=None, capture=2), OSError('uncertain')):
            client = Client(error)
            with pytest.raises(type(error)):
                await search.request_code(client, '+15550000000')
            assert client.calls == 1

    asyncio.run(exercise())


def test_run_real_telethon_migration_then_single_search_send(monkeypatch, capsys):
    import telethon
    from telethon.errors import PhoneMigrateError, ServerError
    from telethon.tl.functions.auth import SendCodeRequest
    from telethon.tl.functions.messages import SendMessageRequest
    from telethon.tl.types import InputPeerUser
    from telethon.tl.types.auth import SentCode, SentCodeTypeApp

    real_client = telethon.TelegramClient
    instances = []
    counts = {'code': 0, 'search': 0}

    class Sender:
        async def send(self, request, ordered=False):
            if isinstance(request, SendCodeRequest):
                counts['code'] += 1
                if counts['code'] == 1:
                    raise PhoneMigrateError(request=request, capture=2)
                return SentCode(type=SentCodeTypeApp(length=5), phone_code_hash='fake')
            assert isinstance(request, SendMessageRequest)
            counts['search'] += 1
            assert request.message == '/song@vkmusbot Romeo Santos'
            assert instances[0]._request_retries == 0
            raise ServerError(request=request, message='simulated')

    def make_client(*args, **kwargs):
        client = real_client(*args, **kwargs)
        instances.append(client)
        client._sender = Sender()

        async def noop(*args, **kwargs):
            pass

        async def authorized():
            return False

        async def switch_dc(dc):
            client.session.set_dc(dc, '127.0.0.1', 443)

        async def logout():
            return True

        client.connect = noop
        client.disconnect = noop
        client.sign_in = noop
        client.log_out = logout
        client.is_user_authorized = authorized
        client._switch_dc = switch_dc
        return client

    async def verify(*args, **kwargs):
        return None, None, InputPeerUser(42, 1)

    monkeypatch.setattr(telethon, 'TelegramClient', make_client)
    monkeypatch.setattr(search, 'verify_identity', verify)
    monkeypatch.setattr(search, 'read_credentials', lambda: (123, 'fake', 'fake'))
    monkeypatch.setattr(search, 'secret', lambda _: '+15550000000')
    monkeypatch.setattr(search.sys, 'argv', ['program'])
    monkeypatch.setattr(search.sys.stdin, 'isatty', lambda: True)
    monkeypatch.setattr(search.sys.stdout, 'isatty', lambda: True)
    answers = iter(['SI', 'SI', 'SI'])
    def input_with_confirmation(prompt):
        if 'UNA búsqueda' in prompt:
            assert 'Comando que se enviará: /song@vkmusbot Romeo Santos' in capsys.readouterr().out
        return next(answers)
    monkeypatch.setattr('builtins.input', input_with_confirmation)

    with pytest.raises(ServerError):
        asyncio.run(search.run())
    assert counts == {'code': 2, 'search': 1}
    assert instances[0]._request_retries == 0


@pytest.mark.parametrize('failure', ['getpass', 'int'])
def test_input_failure_reports_reading_stage_without_leaking(monkeypatch, capsys, failure):
    import getpass

    monkeypatch.setattr(search.sys, 'argv', ['program'])
    monkeypatch.setattr(search.sys.stdin, 'isatty', lambda: True)
    monkeypatch.setattr(search.sys.stdout, 'isatty', lambda: True)
    answers = iter(['SI', 'sensitive invalid id'])
    monkeypatch.setattr('builtins.input', lambda _: next(answers))
    monkeypatch.setattr(search, 'read_credentials', lambda: (123, 'sensitive hash', 'sensitive token'))

    def get_password(_):
        if failure == 'getpass':
            raise getpass.GetPassWarning('sensitive getpass error')
        return 'sensitive phone'

    monkeypatch.setattr(getpass, 'getpass', get_password)
    assert search.main() == 1
    out = capsys.readouterr()
    assert 'Etapa: lectura de teléfono e IDs.' in out.out
    assert 'Etapa: validación de datos.' not in out.out
    assert 'Operación cancelada o fallida' in out.out
    assert 'sensitive' not in out.out + out.err


@pytest.mark.parametrize(('failure', 'stage'), [
    ('validation', 'validación de datos'),
    ('import', 'carga de Telethon'),
    ('constructor', 'creación del cliente temporal'),
    ('connect', 'conexión a Telegram'),
    ('code', 'solicitud del código'),
])
def test_initial_failure_reports_only_fixed_stage(monkeypatch, capsys, failure, stage):
    import builtins
    import telethon

    original_import = builtins.__import__
    def importing(name, *args, **kwargs):
        if failure == 'import' and name == 'telethon':
            raise ImportError('sensitive exception')
        return original_import(name, *args, **kwargs)

    class Client:
        def __init__(self, *args, **kwargs):
            if failure == 'constructor':
                raise RuntimeError('sensitive exception')

        async def connect(self):
            if failure == 'connect':
                raise RuntimeError('sensitive exception')

        async def send_code_request(self, phone):
            if failure == 'code':
                raise RuntimeError('sensitive exception')

        async def disconnect(self): pass

    monkeypatch.setattr(builtins, '__import__', importing)
    monkeypatch.setattr(telethon, 'TelegramClient', Client)
    monkeypatch.setattr(search.sys, 'argv', ['program'])
    monkeypatch.setattr(search.sys.stdin, 'isatty', lambda: True)
    monkeypatch.setattr(search.sys.stdout, 'isatty', lambda: True)
    answers = iter(['SI', 'SI'])
    monkeypatch.setattr(builtins, 'input', lambda _: next(answers))
    prompts = []
    def secret(prompt):
        prompts.append(prompt)
        return '' if failure == 'validation' else 'sensitive phone'
    monkeypatch.setattr(search, 'secret', secret)
    monkeypatch.setattr(search, 'read_credentials', lambda: (123, 'sensitive hash', 'sensitive token'))

    assert search.main() == 1
    out = capsys.readouterr()
    assert 'Etapa: ' + stage + '.' in out.out
    assert 'Operación cancelada o fallida' in out.out
    assert 'sensitive' not in out.out + out.err
    assert prompts == ['Teléfono internacional: ']


@pytest.mark.parametrize(('kind', 'diagnostic'), [
    ('flood', 'Solicitud de código: límite de solicitudes (flood wait).'),
    ('phone', 'Solicitud de código: teléfono inválido.'),
    ('timeout', 'Solicitud de código: tiempo de espera agotado.'),
    ('rpc', 'Solicitud de código: error RPC de Telegram no clasificado.'),
    ('os', 'Solicitud de código: error de conexión o sistema.'),
    ('value', 'Solicitud de código: error de valor o reintentos de Telethon agotados.'),
    ('other', 'Solicitud de código: error no identificado.'),
])
def test_code_request_diagnostic_is_fixed_and_stops_login(monkeypatch, capsys, kind, diagnostic):
    import telethon
    from telethon.errors import FloodWaitError, PhoneNumberInvalidError, RPCError

    failures = {
        'flood': FloodWaitError(request=None, capture=987654),
        'phone': PhoneNumberInvalidError(request=None),
        'timeout': asyncio.TimeoutError('secret timeout'),
        'rpc': RPCError(request=None, message='secret rpc', code=400),
        'os': OSError('secret system error'),
        'value': ValueError('secret value error'),
        'other': RuntimeError('secret exception'),
    }
    instances = []

    class Client:
        def __init__(self, *args, **kwargs):
            self.requests = 0
            self.disconnected = False
            instances.append(self)

        async def connect(self): pass

        async def send_code_request(self, phone):
            self.requests += 1
            raise failures[kind]

        async def sign_in(self, **kwargs):
            pytest.fail('sign_in must not be attempted')

        async def disconnect(self):
            self.disconnected = True

    monkeypatch.setattr(telethon, 'TelegramClient', Client)
    monkeypatch.setattr(search.sys, 'argv', ['program'])
    monkeypatch.setattr(search.sys.stdin, 'isatty', lambda: True)
    monkeypatch.setattr(search.sys.stdout, 'isatty', lambda: True)
    answers = iter(['SI', 'SI'])
    monkeypatch.setattr('builtins.input', lambda _: next(answers))
    prompts = []
    def secret(prompt):
        prompts.append(prompt)
        return 'secret phone'
    monkeypatch.setattr(search, 'secret', secret)
    monkeypatch.setattr(search, 'read_credentials', lambda: (123, 'secret hash', 'secret token'))

    assert search.main() == 1
    out = capsys.readouterr()
    assert diagnostic in out.out
    assert 'Etapa: ingreso del código.' not in out.out
    assert 'secret' not in out.out + out.err
    assert '987654' not in out.out + out.err
    assert prompts == ['Teléfono internacional: ']
    assert instances[0].requests == 1 and instances[0].disconnected


@pytest.mark.parametrize('failure', [RuntimeError('private send error'), asyncio.TimeoutError()])
def test_send_failure_removes_handler_without_retry(monkeypatch, failure):
    class Client:
        calls = 0
        removed = False

        def add_event_handler(self, fn, event):
            self.fn, self.event = fn, event

        async def send_message(self, group, query):
            self.calls += 1
            raise failure

        def remove_event_handler(self, fn, event):
            assert (fn, event) == (self.fn, self.event)
            self.removed = True

    client = Client()
    with pytest.raises(type(failure)):
        asyncio.run(search.search_once(client, object(), -10, 42, 'secreto'))
    assert client.calls == 1 and client.removed


def test_early_response_is_indeterminate_and_observations_are_capped(monkeypatch):
    class Client:
        def add_event_handler(self, fn, event):
            self.fn, self.event = fn, event

        async def send_message(self, group, query):
            await self.fn(SimpleNamespace(message=message(reply=MessageReplyHeader(reply_to_msg_id=7))))
            return SimpleNamespace(id=7)

        def remove_event_handler(self, fn, event):
            assert (fn, event) == (self.fn, self.event)
            self.removed = True

    client = Client()

    async def observe(_):
        for _ in range(30):
            await client.fn(SimpleNamespace(message=message(reply=MessageReplyHeader(reply_to_msg_id=7))))

    monkeypatch.setattr(search.asyncio, 'sleep', observe)
    result = asyncio.run(search.search_once(client, object(), -10, 42, 'privado'))
    assert result == [('indeterminado', 'sin medio')] + [('vinculado', 'sin medio')] * 19
    assert client.removed


@pytest.mark.parametrize('logout', [False, None, RuntimeError('secret logout failure')])
def test_logout_uncertain_warns_and_never_leaks(monkeypatch, capsys, logout):
    import telethon

    class Client:
        def __init__(self, *args, **kwargs):
            self.disconnected = False
            instances.append(self)

        async def connect(self): pass
        async def send_code_request(self, phone): pass
        async def sign_in(self, **kwargs): pass
        async def log_out(self):
            if isinstance(logout, Exception):
                raise logout
            return logout
        async def disconnect(self):
            self.disconnected = True

    instances = []
    monkeypatch.setattr(telethon, 'TelegramClient', Client)
    monkeypatch.setattr(search.sys, 'argv', ['program'])
    monkeypatch.setattr(search.sys.stdin, 'isatty', lambda: True)
    monkeypatch.setattr(search.sys.stdout, 'isatty', lambda: True)
    answers = iter(['SI', 'SI', 'SI'])
    monkeypatch.setattr('builtins.input', lambda _: next(answers))
    monkeypatch.setattr(search, 'secret', lambda _: 'secret credential')
    monkeypatch.setattr(search, 'read_credentials', lambda: (123, 'secret hash', 'secret token'))

    async def identity(*args, **kwargs):
        return None, None, object()

    async def failed_send(*args):
        raise RuntimeError('secret query and credential')

    monkeypatch.setattr(search, 'verify_identity', identity)
    monkeypatch.setattr(search, 'search_once', failed_send)
    previous = logging.root.manager.disable
    assert search.main() == 1
    out = capsys.readouterr()
    assert 'Revocación o limpieza no confirmada' in out.out
    assert 'secret' not in out.out + out.err
    assert instances[0].disconnected
    assert logging.root.manager.disable == previous
