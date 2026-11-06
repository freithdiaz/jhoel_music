import asyncio
import sys
import types
from datetime import datetime, timedelta, timezone

import pytest

import telegram_callback_live_poc as poc


ACCOUNT_ID = 100
BOT_ID = 200
GROUP_ID = -12345
MESSAGE_ID = 77
EXPECTED = 'poc:abc123'


class User:
    def __init__(self, id, bot=False, username=None):
        self.id, self.bot, self.username = id, bot, username


class PasswordRequired(Exception):
    pass


class MemorySession:
    pass


class Chat:
    def __init__(self):
        self.id = 12345


class Channel:
    pass


class Button:
    def __init__(self, data):
        self.data = data


class Row:
    def __init__(self, button):
        self.buttons = [button]


class Markup:
    def __init__(self, button):
        self.rows = [Row(button)]


class Message:
    def __init__(self, id=MESSAGE_ID, sender_id=BOT_ID, chat_id=GROUP_ID,
                 data=EXPECTED.encode()):
        self.id, self.sender_id, self.chat_id = id, sender_id, chat_id
        self.date = datetime.now(timezone.utc)
        self.out = False
        self.fwd_from = None
        self.via_bot_id = None
        self.reply_markup = Markup(Button(data))


class Request:
    def __init__(self, peer=None, msg_id=None, data=None):
        self.peer, self.msg_id, self.data = peer, msg_id, data


class Client:
    instances = []
    me = None
    bot = None
    message = None
    logout_result = True
    require_password = False

    def __init__(self, session, api_id, api_hash):
        assert isinstance(session, MemorySession)
        Client.instances.append(self)
        self.calls = []

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

    async def get_entity(self, name):
        self.calls.append(('entity', name))
        if name == GROUP_ID:
            return Chat()
        return self.bot

    async def get_messages(self, entity, *, limit):
        assert isinstance(entity, Chat)
        assert limit == 5
        return [] if self.message is None else [self.message]

    async def log_out(self):
        self.calls.append('log_out')
        return self.logout_result

    async def disconnect(self):
        self.calls.append('disconnect')

    async def __call__(self, request):
        self.calls.append(('press', request.msg_id, request.data))
        return True


class BotAPI:
    def __init__(self):
        self.calls = []
        self.callback = None
        self.sent = False
        self.delete_result = True
        self.answer_result = True
        self.send_result = None
        self.offset_calls = 0
        self.full_queue = False

    def __call__(self, token, method, payload):
        self.calls.append((method, payload))
        if method == 'getMe':
            return {'id': BOT_ID, 'is_bot': True, 'username': 'Mussicart_bot'}
        if method == 'getWebhookInfo':
            return {'url': ''}
        if method == 'getChat':
            return {'id': GROUP_ID, 'type': 'group'}
        if method == 'getChatMember':
            uid = payload['user_id']
            return {'status': 'member', 'user': {'id': uid, 'is_bot': uid == BOT_ID}}
        if method == 'getUpdates':
            if payload.get('offset') is not None:
                self.offset_calls += 1
                return []
            if self.full_queue:
                return [{'update_id': i} for i in range(1, 101)]
            if self.sent and self.callback is not None:
                return [{'update_id': 1, 'callback_query': self.callback}]
            return []
        if method == 'sendMessage':
            self.sent = True
            if self.send_result is not None:
                return self.send_result
            return {'message_id': MESSAGE_ID,
                    'chat': {'id': GROUP_ID, 'type': 'group'},
                    'from': {'id': BOT_ID, 'is_bot': True}}
        if method == 'deleteMessage':
            return self.delete_result
        if method == 'answerCallbackQuery':
            return self.answer_result
        raise AssertionError(method)


def make_callback(**overrides):
    callback = {
        'id': 'cq1',
        'from': {'id': ACCOUNT_ID, 'is_bot': False},
        'message': {
            'message_id': MESSAGE_ID,
            'chat': {'id': GROUP_ID, 'type': 'group'},
            'from': {'id': BOT_ID, 'is_bot': True},
        },
        'data': EXPECTED,
    }
    callback.update(overrides)
    return callback


@pytest.fixture
def env(monkeypatch):
    monkeypatch.setattr(poc.sys, 'argv', ['telegram_callback_live_poc.py'])
    monkeypatch.setattr(poc.sys.stdin, 'isatty', lambda: True)
    monkeypatch.setattr(poc.sys.stdout, 'isatty', lambda: True)
    answers = iter(['SI', str(GROUP_ID), str(GROUP_ID), 'SI'])
    monkeypatch.setattr('builtins.input', lambda _: next(answers))
    monkeypatch.setattr(
        poc, 'secret',
        lambda prompt: '+10000000000' if 'Teléfono' in prompt else 'secret')
    monkeypatch.setattr(poc, 'secrets',
                        types.SimpleNamespace(token_hex=lambda n: 'abc123'))
    monkeypatch.setattr(poc, 'read_credentials',
                        lambda: (1, 'a' * 32, '1:' + 'b' * 35))
    modules = {name: types.ModuleType(name) for name in (
        'telethon', 'telethon.errors', 'telethon.sessions', 'telethon.tl',
        'telethon.tl.types', 'telethon.utils', 'telethon.tl.functions',
        'telethon.tl.functions.messages')}
    for name, module in modules.items():
        monkeypatch.setitem(sys.modules, name, module)
    modules['telethon'].TelegramClient = Client
    modules['telethon.errors'].SessionPasswordNeededError = PasswordRequired
    modules['telethon.sessions'].MemorySession = MemorySession
    modules['telethon.tl.types'].User = User
    modules['telethon.tl.types'].Chat = Chat
    modules['telethon.tl.types'].Channel = Channel
    modules['telethon.utils'].get_peer_id = lambda group: -group.id
    modules['telethon.tl.types'].KeyboardButtonCallback = Button
    modules['telethon.tl.functions.messages'].GetBotCallbackAnswerRequest = Request
    modules['telethon.tl.functions'].messages = \
        modules['telethon.tl.functions.messages']
    api = BotAPI()
    api.callback = make_callback()
    monkeypatch.setattr(poc, 'bot_request', api)
    Client.me = User(ACCOUNT_ID, username='Jhoelti')
    Client.bot = User(BOT_ID, bot=True, username='Mussicart_bot')
    Client.message = Message()
    Client.logout_result = True
    Client.require_password = False
    Client.instances = []
    return types.SimpleNamespace(Client=Client, api=api)


def test_success_flow(env, capsys, monkeypatch):
    monkeypatch.setattr(poc, 'require_tty', lambda: None)
    asyncio.run(poc.run())
    methods = [method for method, _ in env.api.calls]
    assert methods.count('sendMessage') == 1
    assert methods.count('answerCallbackQuery') == 1
    assert methods.count('deleteMessage') == 1
    assert env.api.offset_calls == 0
    calls = env.Client.instances[0].calls
    assert sum(1 for call in calls
               if isinstance(call, tuple) and call[0] == 'press') == 1
    assert calls[-2:] == ['log_out', 'disconnect']
    output = capsys.readouterr().out
    assert 'Callback verificado' in output
    assert '1:' + 'b' * 35 not in output


def test_distinct_user_and_bot_message_ids(env):
    env.Client.message = Message(id=987)
    asyncio.run(poc.run())
    calls = env.Client.instances[0].calls
    assert ('press', 987, EXPECTED.encode()) in calls
    assert ('deleteMessage', {'chat_id': GROUP_ID, 'message_id': MESSAGE_ID}) in env.api.calls
    assert any(method == 'answerCallbackQuery' for method, _ in env.api.calls)


def test_ambiguous_messages_fail_closed(env, monkeypatch):
    async def get_messages(self, entity, *, limit):
        return [Message(id=987), Message(id=988)]
    monkeypatch.setattr(env.Client, 'get_messages', get_messages)
    with pytest.raises(poc.Refused, match='varios'):
        asyncio.run(poc.run())
    assert not any(isinstance(call, tuple) and call[0] == 'press'
                   for call in env.Client.instances[0].calls)
    assert ('deleteMessage', {'chat_id': GROUP_ID, 'message_id': MESSAGE_ID}) in env.api.calls


def test_unmatched_message_fails_closed(env, monkeypatch):
    env.Client.message = Message(data=b'poc:wrong')
    async def no_sleep(_):
        pass
    monkeypatch.setattr(poc.asyncio, 'sleep', no_sleep)
    with pytest.raises(poc.Refused, match='No se encontró'):
        asyncio.run(poc.run())
    assert not any(isinstance(call, tuple) and call[0] == 'press'
                   for call in env.Client.instances[0].calls)
    assert ('deleteMessage', {'chat_id': GROUP_ID, 'message_id': MESSAGE_ID}) in env.api.calls


@pytest.mark.parametrize(('variant', 'category'), [
    ('empty', 'historial_vacio'),
    ('date', 'fecha_fuera_de_ventana_o_invalida'),
    ('id', 'id_mensaje_invalido'),
    ('sender', 'origen_no_coincide'),
    ('forward', 'origen_no_coincide'),
    ('button', 'boton_no_verificado'),
])
def test_search_diagnostic_categories_are_fixed_and_fail_closed(env, monkeypatch, variant, category):
    message = Message(data=b'secret-callback')
    if variant == 'empty':
        message = None
    elif variant == 'date':
        message.date = None
    elif variant == 'id':
        message.id = 0
    elif variant == 'sender':
        message.sender_id = 987654321
    elif variant == 'forward':
        message.fwd_from = object()
    env.Client.message = message

    async def no_sleep(_):
        pass
    monkeypatch.setattr(poc.asyncio, 'sleep', no_sleep)
    with pytest.raises(poc.MessageSearchRefused) as failure:
        asyncio.run(poc.run())
    assert failure.value.categories == (category,)
    assert 'secret-callback' not in str(failure.value)
    assert not any(isinstance(call, tuple) and call[0] == 'press'
                   for call in env.Client.instances[0].calls)
    assert ('deleteMessage', {'chat_id': GROUP_ID, 'message_id': MESSAGE_ID}) in env.api.calls


def test_main_prints_only_fixed_search_categories(monkeypatch, capsys):
    async def failed_run():
        raise poc.MessageSearchRefused({'boton_no_verificado', 'secret-callback 987654321'})
    monkeypatch.setattr(poc, 'run', failed_run)
    monkeypatch.setattr(poc.sys, 'argv', ['script'])
    monkeypatch.setattr(poc.sys.stdin, 'isatty', lambda: True)
    monkeypatch.setattr(poc.sys.stdout, 'isatty', lambda: True)
    assert poc.main() == 1
    assert capsys.readouterr().out == (
        'Búsqueda sin coincidencia; categorías de descarte: boton_no_verificado\n')


def test_history_exception_is_sanitized_and_cleanup_runs(env, monkeypatch):
    async def failed_history(self, entity, *, limit):
        raise RuntimeError('secret-history-error')
    monkeypatch.setattr(env.Client, 'get_messages', failed_history)
    with pytest.raises(poc.MessageSearchRefused) as failure:
        asyncio.run(poc.run())
    assert failure.value.categories == ('historial_no_disponible',)
    assert 'secret-history-error' not in str(failure.value)
    assert ('deleteMessage', {'chat_id': GROUP_ID, 'message_id': MESSAGE_ID}) in env.api.calls
    assert env.Client.instances[0].calls[-2:] == ['log_out', 'disconnect']


def test_real_telethon_inline_callback_search_and_fail_closed():
    types_ = pytest.importorskip('telethon.tl.types')
    if not hasattr(types_, 'InlineButtonTypeCallback'):
        pytest.skip('requires Telethon inline button schema')
    callback = types_.InlineButtonTypeCallback(EXPECTED.encode())
    button = types_.KeyboardInlineButton('test', callback)
    message = types_.Message(
        id=MESSAGE_ID, peer_id=types_.PeerChat(-GROUP_ID),
        from_id=types_.PeerUser(BOT_ID), date=datetime.now(timezone.utc),
        reply_markup=types_.ReplyInlineMarkup([types_.KeyboardInlineButtonRow([button])]))

    class History:
        async def get_messages(self, group, *, limit):
            assert limit == poc.HISTORY_LIMIT
            return [message]

    found = asyncio.run(poc.fetch_message(
        History(), object(), chat_id=GROUP_ID, bot_id=BOT_ID,
        expected_data=EXPECTED, sent_after=datetime.now(timezone.utc)))
    assert found is message
    callback.requires_password = True
    with pytest.raises(poc.Refused):
        poc.message_matches(message, chat_id=GROUP_ID, bot_id=BOT_ID,
                            message_id=MESSAGE_ID, expected_data=EXPECTED)
    message.reply_markup.rows[0].buttons[0] = types_.KeyboardInlineButton(
        'test', types_.InlineButtonTypeUrl('https://example.invalid'))
    with pytest.raises(poc.Refused):
        poc.message_matches(message, chat_id=GROUP_ID, bot_id=BOT_ID,
                            message_id=MESSAGE_ID, expected_data=EXPECTED)


def test_history_attempts_and_limit_are_bounded(env, monkeypatch):
    calls = []
    async def history(self, entity, *, limit):
        calls.append((entity, limit))
        return [Message(data=b'otro') for _ in range(limit)]
    async def no_sleep(_):
        pass
    monkeypatch.setattr(env.Client, 'get_messages', history)
    monkeypatch.setattr(poc.asyncio, 'sleep', no_sleep)
    with pytest.raises(poc.Refused, match='No se encontró'):
        asyncio.run(poc.run())
    assert len(calls) == 3
    assert all(isinstance(group, Chat) and limit == 5 for group, limit in calls)
    assert not any(isinstance(call, tuple) and call[0] == 'press'
                   for call in env.Client.instances[0].calls)


@pytest.mark.parametrize('date', [
    None, datetime.now(), datetime.now(timezone.utc) - timedelta(minutes=1),
    datetime.now(timezone.utc) + timedelta(minutes=1),
])
def test_invalid_message_date_fails_closed(env, monkeypatch, date):
    env.Client.message.date = date
    async def no_sleep(_):
        pass
    monkeypatch.setattr(poc.asyncio, 'sleep', no_sleep)
    with pytest.raises(poc.Refused):
        asyncio.run(poc.run())
    assert not any(isinstance(call, tuple) and call[0] == 'press'
                   for call in env.Client.instances[0].calls)
    assert ('deleteMessage', {'chat_id': GROUP_ID, 'message_id': MESSAGE_ID}) in env.api.calls


def test_expired_window_does_not_read_history(env, monkeypatch):
    async def forbidden_history(*args, **kwargs):
        raise AssertionError('no debe consultar el historial')
    monkeypatch.setattr(env.Client, 'get_messages', forbidden_history)
    client = env.Client(MemorySession(), 1, 'hash')
    with pytest.raises(poc.Refused, match='caducada'):
        asyncio.run(poc.fetch_message(
            client, Chat(), chat_id=GROUP_ID, bot_id=BOT_ID, expected_data=EXPECTED,
            sent_after=datetime.now(timezone.utc) - timedelta(seconds=31)))


def test_oversized_history_fails_closed(env, monkeypatch):
    async def history(self, entity, *, limit):
        return [Message(id=i + 1) for i in range(limit + 1)]
    monkeypatch.setattr(env.Client, 'get_messages', history)
    with pytest.raises(poc.Refused, match='límite'):
        asyncio.run(poc.run())
    assert not any(isinstance(call, tuple) and call[0] == 'press'
                   for call in env.Client.instances[0].calls)


def test_full_queue_does_not_confirm_updates(env, monkeypatch):
    monkeypatch.setattr(poc, 'CALLBACK_TIMEOUT', 0.01)
    env.api.full_queue = True
    with pytest.raises(poc.Refused):
        asyncio.run(poc.run())
    assert env.api.offset_calls == 0
    assert not any(method in ('sendMessage', 'answerCallbackQuery', 'deleteMessage')
                   for method, _ in env.api.calls)
    assert not any(isinstance(call, tuple) and call[0] == 'press'
                   for call in env.Client.instances[0].calls)
    assert all('offset' not in payload for method, payload in env.api.calls
               if method == 'getUpdates')
    assert env.Client.instances[0].calls[-2:] == ['log_out', 'disconnect']


def test_queue_fills_before_press_no_callback(env, monkeypatch):
    original = env.api

    def request(token, method, payload):
        if method == 'getUpdates' and original.sent:
            original.full_queue = True
        return original(token, method, payload)

    monkeypatch.setattr(poc, 'bot_request', request)
    with pytest.raises(poc.Refused):
        asyncio.run(poc.run())
    assert not any(isinstance(call, tuple) and call[0] == 'press'
                   for call in env.Client.instances[0].calls)
    assert not any(method == 'answerCallbackQuery' for method, _ in env.api.calls)
    assert any(method == 'deleteMessage' for method, _ in env.api.calls)
    assert all('offset' not in payload for method, payload in env.api.calls
               if method == 'getUpdates')
    assert env.Client.instances[0].calls[-2:] == ['log_out', 'disconnect']


def test_delete_failure_is_not_success(env, monkeypatch):
    monkeypatch.setattr(poc, 'require_tty', lambda: None)
    env.api.delete_result = False
    with pytest.raises(poc.Refused):
        asyncio.run(poc.run())
    assert env.Client.instances[0].calls[-2:] == ['log_out', 'disconnect']


def test_2fa_flow(env):
    env.Client.require_password = True
    asyncio.run(poc.run())
    assert env.Client.instances[0].calls.count('sign_in') == 2


def test_consent_denied_no_network(env, monkeypatch):
    monkeypatch.setattr('builtins.input', lambda _: 'NO')
    with pytest.raises(poc.Refused):
        asyncio.run(poc.run())
    assert env.api.calls == []


def test_main_rejects_noninteractive(monkeypatch, capsys):
    monkeypatch.setattr(poc.sys, 'argv', ['telegram_callback_live_poc.py'])
    monkeypatch.setattr(poc.sys.stdin, 'isatty', lambda: False)
    assert poc.main() == 1
    assert 'Uso:' in capsys.readouterr().out


def test_wrong_user_logs_out(env):
    env.Client.me = User(ACCOUNT_ID, username='otro')
    with pytest.raises(poc.Refused):
        asyncio.run(poc.run())
    assert env.Client.instances[0].calls[-2:] == ['log_out', 'disconnect']
    assert not any(method == 'sendMessage' for method, _ in env.api.calls)


def test_wrong_bot_logs_out(env):
    env.Client.bot = User(BOT_ID, bot=False, username='mussicart_bot')
    with pytest.raises(poc.Refused):
        asyncio.run(poc.run())
    assert env.Client.instances[0].calls[-2:] == ['log_out', 'disconnect']
    assert not any(method == 'sendMessage' for method, _ in env.api.calls)


def test_auth_failure_logs_out(env, monkeypatch):
    async def failed_sign_in(self, **kwargs):
        self.calls.append('sign_in')
        raise ValueError('failed')
    monkeypatch.setattr(env.Client, 'sign_in', failed_sign_in)
    with pytest.raises(ValueError):
        asyncio.run(poc.run())
    assert env.Client.instances[0].calls[-2:] == ['log_out', 'disconnect']


def test_wrong_callback_is_not_answered_or_pressed_twice(env, monkeypatch):
    monkeypatch.setattr(poc, 'CALLBACK_TIMEOUT', 0.01)
    env.api.callback = make_callback(data='poc:otro')
    with pytest.raises(poc.Refused):
        asyncio.run(poc.run())
    methods = [method for method, _ in env.api.calls]
    assert 'answerCallbackQuery' not in methods
    assert methods.count('deleteMessage') == 1
    assert env.Client.instances[0].calls[-2:] == ['log_out', 'disconnect']


def test_logout_not_confirmed(env, capsys, monkeypatch):
    monkeypatch.setattr(poc.sys.stdin, 'isatty', lambda: True)
    monkeypatch.setattr(poc.sys.stdout, 'isatty', lambda: True)
    env.Client.logout_result = False
    assert poc.main() == 1
    output = capsys.readouterr().out
    assert 'No se confirmó la revocación' in output
    assert 'Dispositivos' in output


@pytest.mark.parametrize(('method', 'stage'), [
    ('getMe', 'verificación del bot y webhook'),
    ('getChat', 'verificación del grupo y membresías'),
    ('getUpdates', 'comprobación de actualizaciones pendientes'),
    ('sendMessage', 'envío del mensaje de prueba'),
])
def test_failure_stages_do_not_disclose_exception(env, monkeypatch, capsys, method, stage):
    monkeypatch.setattr(poc.sys.stdout, 'isatty', lambda: True)
    original = env.api
    def fail(token, called, payload):
        if called == method:
            raise RuntimeError('SECRET https://example.invalid/token')
        return original(token, called, payload)
    monkeypatch.setattr(poc, 'bot_request', fail)
    assert poc.main() == 1
    output = capsys.readouterr().out
    assert f'Etapa: {stage}.' in output
    assert 'SECRET' not in output and 'https://' not in output
    if method == 'sendMessage':
        assert 'El envío pudo haber ocurrido' in output
    else:
        assert 'El envío pudo haber ocurrido' not in output
        assert not any(called == 'sendMessage' for called, _ in env.api.calls)


def test_refusal_never_discloses_exception(env, monkeypatch, capsys):
    monkeypatch.setattr(poc.sys.stdout, 'isatty', lambda: True)
    def fail():
        raise poc.Refused('SECRET https://example.invalid/token')
    monkeypatch.setattr(poc, 'read_credentials', fail)
    assert poc.main() == 1
    output = capsys.readouterr().out
    assert 'lectura de credenciales locales' in output
    assert 'SECRET' not in output and 'https://' not in output


def test_invalid_send_response_does_not_delete_unverified_message(env):
    env.api.send_result = {
        'message_id': MESSAGE_ID,
        'chat': {'id': 999, 'type': 'private'},
        'from': {'id': BOT_ID, 'is_bot': True},
    }
    with pytest.raises(poc.Refused):
        poc.send_test_button('token', ACCOUNT_ID, BOT_ID, EXPECTED)
    methods = [method for method, _ in env.api.calls]
    assert 'deleteMessage' not in methods


@pytest.mark.parametrize('mutate', [
    lambda c: c['from'].update({'id': 101}),
    lambda c: c['from'].update({'is_bot': True}),
    lambda c: c['message'].update({'message_id': 78}),
    lambda c: c['message']['chat'].update({'id': 101}),
    lambda c: c['message']['chat'].update({'type': 'private'}),
    lambda c: c['message']['from'].update({'id': 201}),
    lambda c: c.update({'data': 'poc:otro'}),
    lambda c: c.update({'id': ''}),
])
def test_callback_rejects_mismatch(mutate):
    callback = make_callback()
    mutate(callback)
    assert not poc.callback_matches(
        callback, chat_id=GROUP_ID, account_id=ACCOUNT_ID, bot_id=BOT_ID,
        message_id=MESSAGE_ID, expected_data=EXPECTED)


def test_callback_accepts_exact_match():
    assert poc.callback_matches(
        make_callback(), chat_id=GROUP_ID, account_id=ACCOUNT_ID, bot_id=BOT_ID,
        message_id=MESSAGE_ID, expected_data=EXPECTED)


@pytest.mark.parametrize('field,value', [
    ('sender_id', 201),
    ('chat_id', 101),
    ('out', True),
])
def test_message_rejects_wrong_origin(env, field, value):
    message = Message()
    setattr(message, field, value)
    with pytest.raises(poc.Refused):
        poc.message_matches(message, chat_id=GROUP_ID, bot_id=BOT_ID, message_id=MESSAGE_ID,
                            expected_data=EXPECTED)


def test_message_rejects_wrong_button(env):
    message = Message(data=b'poc:otro')
    with pytest.raises(poc.Refused):
        poc.message_matches(message, chat_id=GROUP_ID, bot_id=BOT_ID, message_id=MESSAGE_ID,
                            expected_data=EXPECTED)


@pytest.mark.parametrize('answers', [('-1', '-2'), ('123', '123'), ('-01', '-01'), ('-0', '-0')])
def test_group_selection_requires_exact_valid_confirmation(monkeypatch, answers):
    entries = iter(answers)
    monkeypatch.setattr('builtins.input', lambda _: next(entries))
    with pytest.raises(poc.Refused):
        poc.select_group()


@pytest.mark.parametrize('change', ['public', 'wrong_id', 'wrong_type', 'missing_member', 'bot_identity'])
def test_group_verification_fails_closed(env, monkeypatch, change):
    original = env.api

    def request(token, method, payload):
        result = original(token, method, payload)
        if method == 'getChat':
            if change == 'public':
                result['username'] = 'public'
            if change == 'wrong_id':
                result['id'] = -999
            if change == 'wrong_type':
                result['type'] = 'private'
        if method == 'getChatMember':
            if change == 'missing_member':
                result['status'] = 'left'
            if change == 'bot_identity' and payload['user_id'] == BOT_ID:
                result['user']['is_bot'] = False
        return result

    monkeypatch.setattr(poc, 'bot_request', request)
    with pytest.raises(poc.Refused):
        asyncio.run(poc.run())
    assert not any(method == 'sendMessage' for method, _ in env.api.calls)
    assert env.Client.instances[0].calls[-2:] == ['log_out', 'disconnect']


def test_unrelated_callback_never_answered_or_acknowledged(env, monkeypatch):
    monkeypatch.setattr(poc, 'CALLBACK_TIMEOUT', 0.01)
    env.api.callback = make_callback(message={
        'message_id': MESSAGE_ID, 'chat': {'id': -999, 'type': 'group'},
        'from': {'id': BOT_ID, 'is_bot': True}})
    with pytest.raises(poc.Refused):
        asyncio.run(poc.run())
    assert env.api.offset_calls == 0
    assert not any(method == 'answerCallbackQuery' for method, _ in env.api.calls)
