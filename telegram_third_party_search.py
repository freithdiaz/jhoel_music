"""Supervised, single-search observation. Nothing runs on import."""

import asyncio
import logging
import sys
import unicodedata

from telegram_local_credentials import read_credentials, read_optional_phone
from telegram_login_poc import LogoutNotConfirmed, secret
from telegram_third_party_identity import verify_identity
from telegram_offline_selector import present
import telegram_third_party_callback as callback

WINDOW_SECONDS = 30
MAX_OBSERVATIONS = 20
MAX_CODE_MIGRATIONS = 2
ACCOUNT_ID = 9162597809
BOT_ID = 117250343
GROUP_ID = -5498752855


def search_command(query):
    """Validate the complete input before normalizing its surrounding whitespace."""
    if not isinstance(query, str) or any(unicodedata.category(char).startswith('C')
                                         or char in '\u2028\u2029' for char in query):
        raise ValueError('Búsqueda inválida')
    query = query.strip()
    if not query or query.startswith('/') or len(query) > 200:
        raise ValueError('Búsqueda inválida')
    return '/song@vkmusbot ' + query


async def request_code(client, phone):
    """Retry only explicit DC migration rejections, never ambiguous failures."""
    from telethon.errors import NetworkMigrateError, PhoneMigrateError, UserMigrateError

    for attempt in range(MAX_CODE_MIGRATIONS + 1):
        try:
            return await client.send_code_request(phone)
        except (PhoneMigrateError, NetworkMigrateError, UserMigrateError) as error:
            if attempt == MAX_CODE_MIGRATIONS or client.session.dc_id != error.new_dc:
                raise


def classify(message, group_id, bot_id, sent_id):
    """Return only coarse metadata for a verified sender; never serialize content."""
    from telethon.tl.types import Message, MessageReplyHeader, PeerUser
    from telethon.utils import get_peer_id

    if (type(message) is not Message or get_peer_id(message.peer_id) != group_id
            or type(message.from_id) is not PeerUser or message.from_id.user_id != bot_id):
        return None
    reply = message.reply_to
    linked = (type(reply) is MessageReplyHeader and sent_id is not None
              and reply.reply_to_msg_id == sent_id and reply.reply_to_peer_id is None
              and not reply.reply_to_scheduled and reply.reply_from is None)
    return ('vinculado' if linked else 'indeterminado',
            'con medio' if message.media is not None else 'sin medio')


async def search_once(client, group, group_id, bot_id, query, *, candidates=None, sent_ids=None, early_stop=False):
    from telethon import events

    command = search_command(query)
    sent_id = None
    observations = []
    response_ready = asyncio.Event()

    async def receive(event):
        if len(observations) >= MAX_OBSERVATIONS:
            return
        try:
            item = classify(event.message, group_id, bot_id, sent_id)
            if item is not None:
                observations.append(item)
                if candidates is not None:
                    candidates.append(event.message)
                if early_stop and item[1] == 'sin medio' and getattr(event.message, 'reply_markup', None) is not None:
                    response_ready.set()
        except Exception:
            pass

    handler = events.NewMessage(chats=group_id, incoming=True)
    client.add_event_handler(receive, handler)
    try:
        sent = await asyncio.wait_for(client.send_message(group, command), timeout=15)
        if type(sent.id) is not int or sent.id <= 0:
            raise ValueError('Envío no confirmado')
        sent_id = sent.id
        if sent_ids is not None:
            sent_ids.append(sent_id)
        if early_stop:
            try:
                await asyncio.wait_for(response_ready.wait(), WINDOW_SECONDS)
                # Breve margen para respuestas casi simultáneas; la vista sigue siendo no exhaustiva.
                await asyncio.sleep(1)
            except asyncio.TimeoutError:
                pass
        else:
            await asyncio.sleep(WINDOW_SECONDS)
    finally:
        client.remove_event_handler(receive, handler)
    return observations


def select_observed(candidates):
    """Display observed messages locally and select a callback coordinate.

    Observation does not establish correlation. No callback data leaves this function
    and the returned coordinate is not authorization to send anything.
    """
    from telethon.tl import types

    options = []
    for candidate_index, message in enumerate(candidates):
        try:
            markup = message.reply_markup
            if type(markup) is not types.ReplyInlineMarkup:
                continue
            rows = []
            for row in markup.rows:
                buttons = []
                for button in row.buttons:
                    legacy = getattr(types, 'KeyboardButtonCallback', None)
                    modern = getattr(types, 'KeyboardInlineButton', None)
                    callback = getattr(types, 'InlineButtonTypeCallback', None)
                    if not ((legacy is not None and type(button) is legacy)
                            or (modern is not None and callback is not None
                                and type(button) is modern and type(button.type) is callback)):
                        raise ValueError('Botón no compatible')
                    buttons.append({'label': button.text})
                rows.append(buttons)
            presentation = present({'text': message.message, 'buttons': rows})
            options.append((candidate_index, presentation))
        except (ValueError, TypeError, AttributeError):
            continue
    if not options:
        print('No hay mensajes observados compatibles para seleccionar.')
        return None
    print('Aviso: son mensajes observados, no resultados verificados de la búsqueda.')
    print('Pueden ser incompletos o no corresponder a la búsqueda; no se ha establecido causalidad.')
    for index, (_, presentation) in enumerate(options, 1):
        print(f'--- Mensaje {index} ---')
        print(presentation.display)
    choice = input('Índice de mensaje (0 cancela): ').strip()
    if (not choice.isascii() or not choice.isdecimal() or choice.startswith('0')
            or len(choice) > 2 or not 1 <= int(choice) <= len(options)):
        return None
    candidate_index, selected = options[int(choice) - 1]
    if input('¿Reconoce en este mensaje la lista que desea? Escriba SI para continuar: ').strip() != 'SI':
        print('Selección cancelada; no se envió callback ni se descargó audio.')
        return None
    try:
        coordinate = selected.select(input('Índice de botón: ').strip())
    except ValueError:
        return None
    print('Selección local registrada; no se envió callback ni se descargó audio.')
    return candidate_index, coordinate


async def run():
    if sys.argv[1:] or not sys.stdin.isatty() or not sys.stdout.isatty():
        raise ValueError('Se requiere consola interactiva sin argumentos')
    print('Cuenta dedicada; sesión temporal en memoria, sin descarga.')
    print('Callback deshabilitado.' if not callback.CALLBACK_DISPATCH_ENABLED else
          'Advertencia: un callback puede provocar acciones o enviar audio al grupo.')
    print('La búsqueda será visible en el grupo privado y el bot podría responder con audio.')
    print('Los mensajes se mostrarán solo localmente; la observación puede ser incompleta.')
    if input('¿Autoriza conectar e iniciar sesión? Escriba SI: ').strip() != 'SI':
        raise ValueError('Consentimiento denegado')
    api_id, api_hash, token = read_credentials()
    del token
    print('Etapa: lectura de teléfono e IDs.')
    phone = read_optional_phone() or secret('Teléfono internacional: ').strip()
    print(f'IDs observados: cuenta {ACCOUNT_ID}, @vkmusbot {BOT_ID}, grupo {GROUP_ID}.')
    if input('¿Confirma estos IDs? Escriba SI: ').strip() != 'SI':
        raise ValueError('Identificadores no confirmados')
    print('Etapa: validación de datos.')
    if not phone:
        raise ValueError('Datos inválidos')

    print('Etapa: carga de Telethon.')
    from telethon import TelegramClient
    from telethon.errors import (FloodWaitError, PhoneNumberInvalidError, RPCError,
                                 SessionPasswordNeededError)
    from telethon.sessions import MemorySession

    previous = logging.root.manager.disable
    logging.disable(logging.CRITICAL)
    client = None
    sign_in_attempted = False
    try:
        print('Etapa: creación del cliente temporal.')
        client = TelegramClient(MemorySession(), api_id, api_hash, request_retries=0,
                                connection_retries=0, auto_reconnect=False,
                                raise_last_call_error=True)
        print('Etapa: conexión a Telegram.')
        await asyncio.wait_for(client.connect(), 15)
        print('Etapa: solicitud del código.')
        try:
            await asyncio.wait_for(request_code(client, phone), 15)
        except FloodWaitError:
            print('Solicitud de código: límite de solicitudes (flood wait).')
            raise
        except PhoneNumberInvalidError:
            print('Solicitud de código: teléfono inválido.')
            raise
        except asyncio.TimeoutError:
            print('Solicitud de código: tiempo de espera agotado.')
            raise
        except RPCError:
            print('Solicitud de código: error RPC de Telegram no clasificado.')
            raise
        except OSError:
            print('Solicitud de código: error de conexión o sistema.')
            raise
        except ValueError:
            print('Solicitud de código: error de valor o reintentos de Telethon agotados.')
            raise
        except Exception:
            print('Solicitud de código: error no identificado.')
            raise
        print('Etapa: ingreso del código.')
        code = secret('Código de Telegram: ')
        try:
            sign_in_attempted = True
            await asyncio.wait_for(client.sign_in(phone=phone, code=code), 15)
        except SessionPasswordNeededError:
            await asyncio.wait_for(client.sign_in(password=secret('Contraseña 2FA: ')), 15)
        _, _, group = await asyncio.wait_for(verify_identity(
            client, account_id=ACCOUNT_ID, bot_id=BOT_ID, confirmed_bot_id=BOT_ID,
            group_id=GROUP_ID, confirmed_group_id=GROUP_ID), 30)
        print('Identidades y membresías verificadas. La búsqueda será visible en el grupo.')
        query = 'Romeo Santos'
        command = search_command(query)
        print('Comando que se enviará:', command)
        if input('¿Autoriza enviar UNA búsqueda y observar 30 segundos? Escriba SI: ').strip() != 'SI':
            raise ValueError('Búsqueda no autorizada')
        candidates = []
        sent_ids = []
        observations = await search_once(client, group, GROUP_ID, BOT_ID, query,
                                         candidates=candidates, sent_ids=sent_ids)
        for relation, media in observations:
            print('Mensaje observado:', relation + ',', media)
        print('Observaciones:', len(observations), '(máximo 20; pueden faltar mensajes).')
        selection = select_observed(candidates)
        if callback.CALLBACK_DISPATCH_ENABLED and selection is not None:
            index, coordinate = selection
            await callback.dispatch_selected(client, candidates[index], coordinate, sent_ids[0],
                                             account_id=ACCOUNT_ID, bot_id=BOT_ID, group_id=GROUP_ID)
    finally:
        uncertain = False
        try:
            if client is not None and sign_in_attempted:
                try:
                    uncertain = await asyncio.wait_for(client.log_out(), 15) is not True
                except BaseException:
                    uncertain = True
            if client is not None:
                try:
                    await asyncio.wait_for(client.disconnect(), 15)
                except BaseException:
                    uncertain = True
            if uncertain:
                raise LogoutNotConfirmed() from None
        finally:
            logging.disable(previous)


def main():
    try:
        asyncio.run(run())
    except LogoutNotConfirmed:
        print('Revocación o limpieza no confirmada: revise Telegram > Ajustes > Dispositivos.')
        return 1
    except (Exception, KeyboardInterrupt):
        print('Operación cancelada o fallida. Si hubo intento de envío, su resultado puede ser incierto.')
        return 1
    print('Operación terminada; revocación confirmada. Observación no exhaustiva.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
