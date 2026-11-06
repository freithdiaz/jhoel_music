"""Interactive, memory-only callback test with our own bot.

Sends one test message with an inline button, presses it once as the dedicated
user account, verifies the callback query through the Bot API, answers it,
deletes the message and logs out. No downloads and no third-party bots.
"""

import asyncio
import getpass
import logging
import secrets
import sys
import warnings
from datetime import datetime, timedelta, timezone

from telegram_local_credentials import Refused as CredentialRefused
from telegram_local_credentials import bot_request, read_credentials


BOT_USERNAME = 'mussicart_bot'
DEDICATED_USERNAME = 'jhoelti'
CALLBACK_PREFIX = 'poc:'
CALLBACK_TIMEOUT = 15.0
PRESS_TIMEOUT = 5.0
HISTORY_LIMIT = 5
HISTORY_ATTEMPTS = 3
MESSAGE_TIME_SKEW = timedelta(seconds=5)
MESSAGE_TIME_WINDOW = timedelta(seconds=30)


class Refused(RuntimeError):
    pass


class MessageSearchRefused(Refused):
    """Only fixed, non-sensitive search categories may reach the console."""

    def __init__(self, categories):
        super().__init__('No se encontró el mensaje de prueba.')
        self.categories = tuple(name for name in SEARCH_CATEGORIES if name in categories)


SEARCH_CATEGORIES = (
    'historial_vacio', 'fecha_fuera_de_ventana_o_invalida', 'id_mensaje_invalido',
    'origen_no_coincide', 'boton_no_verificado', 'historial_no_disponible',
)


class LogoutNotConfirmed(Exception):
    pass


def secret(prompt):
    with warnings.catch_warnings():
        warnings.simplefilter('error', getpass.GetPassWarning)
        return getpass.getpass(prompt)


def require_tty():
    if sys.argv[1:] or not sys.stdin.isatty() or not sys.stdout.isatty():
        raise Refused('Se requiere consola interactiva y sin argumentos.')


def ask_consent():
    print('Prueba local: se enviará UN mensaje de @Mussicart_bot a un grupo privado, '
          'se pulsará UN botón de prueba y se borrará. No descarga nada.')
    print('La prueba consulta actualizaciones pendientes sin confirmarlas; '
          'no uses otro cliente de @Mussicart_bot al mismo tiempo.')
    if input('¿Autorizas la conexión y esta prueba? Escriba SI: ').strip() != 'SI':
        raise Refused('Consentimiento denegado.')


def select_group():
    raw = input('ID numérico marcado del grupo privado confiable (negativo): ').strip()
    if not raw.startswith('-') or not raw[1:].isascii() or not raw[1:].isdigit():
        raise Refused('ID de grupo inválido.')
    group_id = int(raw)
    if group_id >= 0 or str(group_id) != raw:
        raise Refused('ID de grupo inválido.')
    if input(f'Confirma el ID confiable {group_id} escribiéndolo de nuevo: ').strip() != raw:
        raise Refused('Grupo no confirmado.')
    return group_id


async def verify_group(client, token, group_id, account_id, bot_id):
    from telethon.tl.types import Chat, Channel
    from telethon.utils import get_peer_id
    group = await client.get_entity(group_id)
    if (not isinstance(group, (Chat, Channel)) or get_peer_id(group) != group_id
            or getattr(group, 'username', None) or getattr(group, 'usernames', None)
            or getattr(group, 'deactivated', False) or getattr(group, 'left', False)
            or getattr(group, 'forbidden', False)
            or (isinstance(group, Channel) and not getattr(group, 'megagroup', False))):
        raise Refused('No se pudo verificar el grupo privado en la cuenta.')
    chat = bot_request(token, 'getChat', {'chat_id': group_id})
    if (not isinstance(chat, dict) or type(chat.get('id')) is not int
            or chat['id'] != group_id
            or chat.get('type') != ('supergroup' if isinstance(group, Channel) else 'group')
            or chat.get('username') or chat.get('active_usernames')):
        raise Refused('No se pudo verificar el grupo privado en el bot.')
    for user_id, is_bot in ((account_id, False), (bot_id, True)):
        member = bot_request(token, 'getChatMember', {'chat_id': group_id, 'user_id': user_id})
        user = member.get('user') if isinstance(member, dict) else None
        if (not isinstance(user, dict) or type(user.get('id')) is not int
                or user['id'] != user_id or user.get('is_bot') is not is_bot
                or member.get('status') not in ('creator', 'administrator', 'member')):
            raise Refused('No se pudo verificar la membresía del grupo.')
    return group


def get_bot_id(token):
    bot = bot_request(token, 'getMe', {})
    if (not isinstance(bot, dict) or bot.get('is_bot') is not True
            or str(bot.get('username', '')).lower() != BOT_USERNAME
            or type(bot.get('id')) is not int or bot['id'] <= 0):
        raise Refused('El token no corresponde al bot esperado.')
    webhook = bot_request(token, 'getWebhookInfo', {})
    if not isinstance(webhook, dict) or webhook.get('url') != '':
        raise Refused('Webhook activo o desconocido.')
    return bot['id']


def get_updates(token):
    updates = bot_request(token, 'getUpdates', {'limit': 100, 'timeout': 0})
    if not isinstance(updates, list):
        raise Refused('Respuesta de actualizaciones inválida.')
    for update in updates:
        if not isinstance(update, dict) or type(update.get('update_id')) is not int:
            raise Refused('Actualización inválida.')
    return updates


def check_update_capacity(token):
    if len(get_updates(token)) >= 100:
        raise Refused('Hay demasiadas actualizaciones pendientes; no se confirmó ninguna.')





def delete_test_message(token, chat_id, message_id):
    try:
        return bot_request(token, 'deleteMessage',
                           {'chat_id': chat_id, 'message_id': message_id}) is True
    except Exception:
        return False


def send_test_button(token, chat_id, bot_id, expected_data):
    result = bot_request(token, 'sendMessage', {
        'chat_id': chat_id,
        'text': 'Prueba local de botón. No descarga nada. '
                'No lo pulses desde Telegram; la prueba lo hará desde la consola.',
        'disable_notification': True,
        'reply_markup': {
            'inline_keyboard': [[
                {'text': 'Probar botón', 'callback_data': expected_data},
            ]],
        },
    })
    message_id = result.get('message_id') if isinstance(result, dict) else None
    chat = result.get('chat') if isinstance(result, dict) else None
    sender = result.get('from') if isinstance(result, dict) else None
    valid = (type(message_id) is int and message_id > 0
             and isinstance(chat, dict) and type(chat.get('id')) is int and chat.get('id') == chat_id
             and chat.get('type') in ('group', 'supergroup')
             and isinstance(sender, dict) and type(sender.get('id')) is int and sender.get('id') == bot_id
             and sender.get('is_bot') is True
             and not result.get('forward_origin') and not result.get('forward_date')
             and not result.get('via_bot') and not result.get('sender_chat'))
    if not valid:
        if (type(message_id) is int and message_id > 0 and isinstance(chat, dict)
                and type(chat.get('id')) is int and chat['id'] == chat_id
                and isinstance(sender, dict) and sender.get('id') == bot_id
                and sender.get('is_bot') is True):
            delete_test_message(token, chat_id, message_id)
        raise Refused('Mensaje de prueba inválido; revisa el grupo por si requiere limpieza manual.')
    return message_id


def message_matches(message, *, chat_id, bot_id, message_id, expected_data):
    if (message is None or message.id != message_id
            or message.sender_id != bot_id
            or message.chat_id != chat_id
            or message.out
            or getattr(message, 'fwd_from', None) is not None
            or getattr(message, 'via_bot_id', None) is not None):
        raise Refused('El mensaje de prueba no coincide.')
    try:
        rows = message.reply_markup.rows
        if len(rows) != 1 or len(rows[0].buttons) != 1:
            raise Refused('Teclado de prueba inválido.')
        button = rows[0].buttons[0]
    except (AttributeError, IndexError, TypeError):
        raise Refused('El botón de prueba no existe.') from None
    from telethon.tl import types
    legacy_type = getattr(types, 'KeyboardButtonCallback', None)
    inline_type = getattr(types, 'KeyboardInlineButton', None)
    callback_type = getattr(types, 'InlineButtonTypeCallback', None)
    if legacy_type is not None and isinstance(button, legacy_type):
        callback = button
    elif (inline_type is not None and callback_type is not None
          and isinstance(button, inline_type)
          and isinstance(button.type, callback_type)):
        callback = button.type
    else:
        raise Refused('El botón de prueba no coincide.')
    if (getattr(callback, 'requires_password', False)
            or getattr(callback, 'password', False)
            or type(callback.data) is not bytes
            or callback.data != expected_data.encode()):
        raise Refused('El botón de prueba no coincide.')
    return button


def callback_matches(cq, *, chat_id, account_id, bot_id, message_id, expected_data):
    if not isinstance(cq, dict):
        return False
    sender = cq.get('from')
    message = cq.get('message')
    if not isinstance(sender, dict) or not isinstance(message, dict):
        return False
    chat = message.get('chat')
    origin = message.get('from')
    if not isinstance(chat, dict) or not isinstance(origin, dict):
        return False
    return (type(sender.get('id')) is int and sender['id'] == account_id
            and sender.get('is_bot') is False
            and type(message.get('message_id')) is int
            and message['message_id'] == message_id
            and type(chat.get('id')) is int and chat['id'] == chat_id
            and chat.get('type') in ('group', 'supergroup')
            and type(origin.get('id')) is int and origin['id'] == bot_id
            and origin.get('is_bot') is True
            and not message.get('forward_origin') and not message.get('forward_date')
            and not message.get('via_bot') and not message.get('sender_chat')
            and isinstance(cq.get('data'), str) and cq['data'] == expected_data
            and isinstance(cq.get('id'), str) and bool(cq['id']))


async def fetch_message(client, group, *, chat_id, bot_id, expected_data, sent_after):
    # Message IDs in ordinary groups must not be assumed to match across
    # accounts. Correlate using the fresh, unpredictable callback payload.
    if (not isinstance(sent_after, datetime) or sent_after.tzinfo is None
            or sent_after.utcoffset() is None):
        raise Refused('Fecha de envío inválida.')
    categories = set()
    for attempt in range(HISTORY_ATTEMPTS):
        if datetime.now(timezone.utc) > sent_after + MESSAGE_TIME_WINDOW:
            raise Refused('Ventana de búsqueda caducada.')
        try:
            messages = await client.get_messages(group, limit=HISTORY_LIMIT)
        except Exception:
            raise MessageSearchRefused({'historial_no_disponible'}) from None
        if datetime.now(timezone.utc) > sent_after + MESSAGE_TIME_WINDOW:
            raise Refused('Ventana de búsqueda caducada.')
        if len(messages) > HISTORY_LIMIT:
            raise Refused('Historial fuera del límite permitido.')
        if not messages:
            categories.add('historial_vacio')
        matches = []
        for message in messages:
            date = getattr(message, 'date', None)
            if (not isinstance(date, datetime) or date.tzinfo is None
                    or date.utcoffset() is None
                    or not sent_after - MESSAGE_TIME_SKEW <= date
                    <= min(sent_after + MESSAGE_TIME_WINDOW,
                           datetime.now(timezone.utc) + MESSAGE_TIME_SKEW)):
                categories.add('fecha_fuera_de_ventana_o_invalida')
                continue
            message_id = getattr(message, 'id', None)
            if type(message_id) is not int or message_id <= 0:
                categories.add('id_mensaje_invalido')
                continue
            try:
                message_matches(message, chat_id=chat_id, bot_id=bot_id,
                                message_id=message_id, expected_data=expected_data)
            except Refused:
                if (getattr(message, 'sender_id', None) != bot_id
                        or getattr(message, 'chat_id', None) != chat_id
                        or getattr(message, 'out', None)
                        or getattr(message, 'fwd_from', None) is not None
                        or getattr(message, 'via_bot_id', None) is not None):
                    categories.add('origen_no_coincide')
                else:
                    categories.add('boton_no_verificado')
                continue
            matches.append(message)
        if len(matches) > 1:
            raise Refused('Hay varios mensajes de prueba coincidentes.')
        if matches:
            return matches[0]
        if attempt + 1 < HISTORY_ATTEMPTS:
            await asyncio.sleep(1)
    raise MessageSearchRefused(categories)


async def wait_for_callback(token, *, chat_id, account_id, bot_id, message_id,
                            expected_data, timeout=None):
    if timeout is None:
        timeout = CALLBACK_TIMEOUT
    loop = asyncio.get_running_loop()
    deadline = loop.time() + timeout
    while loop.time() < deadline:
        updates = await asyncio.to_thread(get_updates, token)
        for update in updates:
            cq = update.get('callback_query')
            if callback_matches(cq, chat_id=chat_id, account_id=account_id, bot_id=bot_id,
                                message_id=message_id, expected_data=expected_data):
                return cq
        if len(updates) >= 100:
            raise Refused('Hay demasiadas actualizaciones pendientes; '
                          'no se confirmó ninguna.')
        await asyncio.sleep(0.5)
    raise Refused('No se recibió el callback.')


async def press_and_verify(client, group, token, *, chat_id, account_id, bot_id,
                           message_id, user_message_id, expected_data):
    from telethon.tl.functions.messages import GetBotCallbackAnswerRequest
    press = asyncio.create_task(client(GetBotCallbackAnswerRequest(
        peer=group, msg_id=user_message_id, data=expected_data.encode())))
    try:
        cq = await wait_for_callback(token, chat_id=chat_id, account_id=account_id, bot_id=bot_id,
                                     message_id=message_id,
                                     expected_data=expected_data)
        answered = await asyncio.to_thread(
            bot_request, token, 'answerCallbackQuery',
            {'callback_query_id': cq['id'], 'text': 'Prueba recibida'})
        if answered is not True:
            raise Refused('No se pudo responder el callback.')
        try:
            await asyncio.wait_for(press, timeout=PRESS_TIMEOUT)
        except Exception:
            pass
        return cq
    finally:
        if not press.done():
            press.cancel()
            try:
                await press
            except BaseException:
                pass
        else:
            try:
                press.exception()
            except BaseException:
                pass


class DedicatedSession:
    def __init__(self, api_id, api_hash, phone):
        self.api_id, self.api_hash, self.phone = api_id, api_hash, phone
        self.client = None
        self.me = None
        self.bot = None
        self.sign_in_attempted = False
        self.previous_disable = logging.root.manager.disable

    async def __aenter__(self):
        from telethon import TelegramClient
        from telethon.errors import SessionPasswordNeededError
        from telethon.sessions import MemorySession
        from telethon.tl.types import User
        logging.disable(logging.CRITICAL)
        try:
            print('Etapa: conexión de la cuenta.')
            self.client = TelegramClient(MemorySession(), self.api_id, self.api_hash)
            await self.client.connect()
            print('Etapa: solicitud de código.')
            await self.client.send_code_request(self.phone)
            code = secret('Código de Telegram: ')
            try:
                print('Etapa: autenticación de la cuenta.')
                self.sign_in_attempted = True
                await self.client.sign_in(phone=self.phone, code=code)
            except SessionPasswordNeededError:
                await self.client.sign_in(
                    password=secret('Contraseña de verificación en dos pasos: '))
            print('Etapa: verificación de cuenta y bot.')
            me = await self.client.get_me()
            if (not isinstance(me, User) or me.bot
                    or type(me.id) is not int or me.id <= 0
                    or (me.username or '').lower() != DEDICATED_USERNAME):
                raise Refused('La cuenta no es la dedicada esperada.')
            bot = await self.client.get_entity(BOT_USERNAME)
            if (not isinstance(bot, User) or not bot.bot
                    or type(bot.id) is not int or bot.id <= 0
                    or (bot.username or '').lower() != BOT_USERNAME):
                raise Refused('El bot no coincide.')
            self.me, self.bot = me, bot
            return self
        except BaseException:
            await self._close()
            raise

    async def __aexit__(self, exc_type, exc, tb):
        await self._close()
        return False

    async def _close(self):
        logout_failed = False
        try:
            if self.sign_in_attempted and self.client is not None:
                print('Etapa: revocación de la sesión.')
                try:
                    logout_failed = await self.client.log_out() is not True
                except BaseException:
                    logout_failed = True
            if self.client is not None:
                try:
                    await self.client.disconnect()
                except BaseException:
                    if not logout_failed:
                        raise
        finally:
            logging.disable(self.previous_disable)
        if logout_failed:
            raise LogoutNotConfirmed()


async def run():
    require_tty()
    print('Etapa: consentimiento y selección de grupo.')
    ask_consent()
    group_id = select_group()
    print('Etapa: lectura de credenciales locales.')
    api_id, api_hash, token = read_credentials()
    print('Etapa: verificación del bot y webhook.')
    bot_id = get_bot_id(token)
    phone = secret('Teléfono internacional: ').strip()
    if not phone:
        raise Refused('Teléfono inválido.')
    expected_data = CALLBACK_PREFIX + secrets.token_hex(8)
    async with DedicatedSession(api_id, api_hash, phone) as session:
        if session.bot.id != bot_id:
            raise Refused('El bot no coincide con el token.')
        print('Etapa: verificación del grupo y membresías.')
        group = await verify_group(session.client, token, group_id, session.me.id, bot_id)
        message_id = None
        cleanup_failed = False
        try:
            print('Etapa: comprobación de actualizaciones pendientes.')
            check_update_capacity(token)
            try:
                sent_after = datetime.now(timezone.utc)
                print('Etapa: envío del mensaje de prueba.')
                message_id = send_test_button(token, group_id, bot_id, expected_data)
            except BaseException:
                print('El envío pudo haber ocurrido; revisa el grupo y borra el mensaje manualmente si existe.')
                raise
            print('Etapa: búsqueda y verificación del mensaje.')
            message = await fetch_message(session.client, group, chat_id=group_id,
                                          bot_id=bot_id, expected_data=expected_data,
                                          sent_after=sent_after)
            if input('Mensaje enviado. ¿Pulsar el botón una vez? Escriba SI: ').strip() != 'SI':
                raise Refused('Cancelado.')
            print('Etapa: comprobación previa a la pulsación.')
            check_update_capacity(token)
            print('Etapa: pulsación y verificación del callback.')
            await press_and_verify(
                session.client, group, token, chat_id=group_id,
                account_id=session.me.id, bot_id=bot_id,
                message_id=message_id, user_message_id=message.id, expected_data=expected_data)
            print('Callback verificado y respondido.')
        finally:
            if message_id is not None:
                print('Etapa: eliminación del mensaje de prueba.')
            if message_id is not None and not delete_test_message(
                    token, group_id, message_id):
                cleanup_failed = True
                print('No se pudo borrar el mensaje de prueba; bórralo manualmente.')
        if cleanup_failed:
            raise Refused('No se pudo borrar el mensaje de prueba.')


def main():
    if len(sys.argv) != 1 or not sys.stdin.isatty() or not sys.stdout.isatty():
        print('Uso: python telegram_callback_live_poc.py (solo consola interactiva).')
        return 1
    try:
        asyncio.run(run())
    except LogoutNotConfirmed:
        print('No se confirmó la revocación. Cierre la sesión manualmente en Telegram '
              'desde Ajustes > Dispositivos.')
        return 1
    except MessageSearchRefused as failure:
        print('Búsqueda sin coincidencia; categorías de descarte: '
              + ', '.join(failure.categories))
        return 1
    except Refused:
        print('Prueba bloqueada en la etapa indicada.')
        return 1
    except CredentialRefused:
        print('Credenciales locales inválidas.')
        return 1
    except (Exception, KeyboardInterrupt):
        print('Prueba cancelada o fallida. Si se inició la autenticación, '
              'comprueba la sesión en Telegram desde Ajustes > Dispositivos; '
              'la revocación podría no estar confirmada.')
        return 1
    print('Prueba completada; sesión revocada.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
