"""Puente local supervisado: búsqueda, selección, descarga y borrado solo tras confirmación."""

import asyncio
import hashlib
import hmac
import json
import logging
import os
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request

from telegram_local_credentials import NoRedirect, bot_request, read_credentials
from telegram_offline_selector import present
from telegram_setup_windows import session_path
from telegram_third_party_identity import verify_identity
from telegram_third_party_search import ACCOUNT_ID, BOT_ID, GROUP_ID, classify, search_once
from telegram_selection_registry import SelectionRegistry
from telegram_receipt_candidates import new_audio_candidates
from telegram_import import ALLOWED_AUDIO_TYPES, candidate_from_update
from telegram_manual_download import DESTINATION, get_chunks, save_quarantined
from telegram_audio_validation import (AudioValidationError, extract_mp3_metadata, publish_validated_mp3,
                                       validate_mp3, write_metadata_sidecars)
from telegram_windows_lock import exclusive_account_lock
from telegram_windows_session import load_session

def bridge_base_url():
    """URL del servidor; usa HTTPS si el puente no corre en el mismo host."""
    value = os.environ.get('MUSIC_BRIDGE_API_URL', 'http://127.0.0.1:8589/api').rstrip('/')
    try:
        parts = urllib.parse.urlsplit(value)
        parts.port
    except ValueError as exc:
        raise ValueError('URL del puente inválida') from exc
    if (parts.scheme not in ('http', 'https') or not parts.hostname
            or parts.username is not None or parts.password is not None
            or parts.query or parts.fragment):
        raise ValueError('URL del puente inválida')
    return value


BASE_URL = bridge_base_url()
SELECTIONS = SelectionRegistry(clock=time.monotonic, limit=100, ttl=300)
RECEIPTS = SelectionRegistry(clock=time.monotonic, limit=100, ttl=300)


def bridge_request(key, path, body):
    if not re.fullmatch(r'[A-Za-z0-9_-]{43,128}', key or ''):
        raise ValueError('Clave de puente inválida')
    if path not in ('/telegram/bridge/claim', '/telegram/bridge/finish',
                    '/telegram/bridge/claim-selection', '/telegram/bridge/selection-check',
                    '/telegram/bridge/callback-result', '/telegram/bridge/claim-download',
                    '/telegram/bridge/download-progress', '/telegram/bridge/download-result',
                    '/telegram/bridge/heartbeat',
                    '/telegram/bridge/claim-delete', '/telegram/bridge/delete-result'):
        raise ValueError('Ruta inválida')
    payload = json.dumps(body, ensure_ascii=True).encode('utf-8')
    request = urllib.request.Request(BASE_URL + path, data=payload, headers={
        'Content-Type': 'application/json', 'X-Telegram-Bridge-Key': key,
    })
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    with opener.open(request, timeout=15) as response:
        raw = response.read(65537)
    if len(raw) > 65536:
        raise ValueError('Respuesta excesiva')
    result = json.loads(raw)
    if not isinstance(result, dict):
        raise ValueError('Respuesta inválida')
    return result


def message_fingerprint(message):
    """Huella estable del mensaje y sus botones, sin campos volátiles.

    ``bytes(message)`` incluye contadores como vistas, reenvíos, reacciones o
    fecha de edición. Esos campos cambian solos y hacían fallar la revalidación
    aunque la lista y los botones siguieran siendo los mismos. La huella cubre
    solo lo que define la selección: id, texto, remitente, respuesta y botones.
    """
    from telethon.tl import types

    if type(message.id) is not int or message.id <= 0:
        raise ValueError('Mensaje inválido')
    if not isinstance(message.message, str):
        raise ValueError('Texto inválido')
    digest = hashlib.sha256()
    digest.update(str(message.id).encode('ascii'))
    digest.update(b'\0')
    digest.update(message.message.encode('utf-8'))
    digest.update(b'\0')
    for name in ('from_id', 'peer_id'):
        value = getattr(message, name, None)
        if value is not None:
            digest.update(name.encode('ascii'))
            digest.update(bytes(value))
    reply = getattr(message, 'reply_to', None)
    if reply is not None:
        digest.update(bytes(reply))
    else:
        reply_to = getattr(message, 'reply_to_msg_id', None)
        digest.update(str(reply_to or '').encode('ascii'))
    markup = message.reply_markup
    if type(markup) is not types.ReplyInlineMarkup:
        raise ValueError('Botones inválidos')
    for row in markup.rows:
        digest.update(b'\1')
        for button in row.buttons:
            digest.update(b'\2')
            digest.update(bytes(button))
    return digest.digest()


def observed_results(messages, *, search_id, sent_id, registry):
    """Vincula cada etiqueta con mensaje y coordenada, sin divulgar el payload."""
    from telethon.tl import types

    labels = []
    for message in messages:
        try:
            relation = classify(message, GROUP_ID, BOT_ID, sent_id)
            if relation is None or relation[1] != 'sin medio' or message.out:
                continue
            if message.fwd_from is not None or message.via_bot_id is not None:
                continue
            if type(message.id) is not int or message.id <= 0:
                continue
            snapshot = message_fingerprint(message)
            if type(message.reply_markup) is not types.ReplyInlineMarkup:
                continue
            rows = []
            for row in message.reply_markup.rows:
                buttons = []
                for button in row.buttons:
                    legacy = getattr(types, 'KeyboardButtonCallback', None)
                    modern = getattr(types, 'KeyboardInlineButton', None)
                    callback = getattr(types, 'InlineButtonTypeCallback', None)
                    if not ((legacy is not None and type(button) is legacy)
                            or (modern is not None and callback is not None and type(button) is modern
                                and type(button.type) is callback)):
                        raise ValueError('Botón no compatible')
                    buttons.append({'label': button.text})
                rows.append(buttons)
            presentation = present({'text': message.message, 'buttons': rows})
            lines = presentation.display.splitlines()[1:]
            context = ''.join(char for char in message.message
                              if char == '\n' or (char.isprintable() and not unicodedata.category(char).startswith('C')))
            if not context.strip() or len(context) > 2000:
                raise ValueError('Contexto inválido')
            # La cola aplica límites propios; no enviar presentaciones parciales.
            if any(len(line) > 200 for line in lines) or len(labels) + len(lines) > 50:
                raise ValueError('Demasiados resultados')
            coordinates = [(row, column) for row, buttons in enumerate(rows)
                           for column in range(len(buttons))]
            if len(lines) != len(coordinates):
                raise ValueError('Presentación inconsistente')
            for line, coordinate in zip(lines, coordinates):
                reference = registry.issue(operator=search_id,
                                           value=(message.id, coordinate, snapshot))
                labels.append({'id': reference, 'label': line.partition('. ')[2],
                               'context': context, 'relation': relation[0]})
        except (AttributeError, TypeError, ValueError):
            continue
    return labels


async def search_with_session(query, *, search_id, registry):
    from telethon import TelegramClient
    from telethon.sessions import StringSession

    api_id, api_hash, _ = read_credentials()
    path = session_path()
    with exclusive_account_lock(path.parent / 'telegram-account.lock'):
        session = load_session(path)
        client = TelegramClient(StringSession(session), api_id, api_hash, request_retries=0,
                                connection_retries=0, auto_reconnect=False,
                                raise_last_call_error=True)
        try:
            await asyncio.wait_for(client.connect(), 15)
            if not await asyncio.wait_for(client.is_user_authorized(), 15):
                raise ValueError('Sesión no autorizada')
            _, _, group = await asyncio.wait_for(verify_identity(
                client, account_id=ACCOUNT_ID, bot_id=BOT_ID, confirmed_bot_id=BOT_ID,
                group_id=GROUP_ID, confirmed_group_id=GROUP_ID), 30)
            candidates = []
            sent_ids = []
            await search_once(client, group, GROUP_ID, BOT_ID, query,
                              candidates=candidates, sent_ids=sent_ids, early_stop=True)
            if len(sent_ids) != 1:
                raise ValueError('Búsqueda no identificada')
            return observed_results(candidates, search_id=search_id, sent_id=sent_ids[0], registry=registry)
        finally:
            await asyncio.wait_for(client.disconnect(), 15)


def run_once(key):
    response = bridge_request(key, '/telegram/bridge/claim', {})
    job = response.get('job')
    if job is None:
        return 'idle'
    if (not isinstance(job, dict) or not isinstance(job.get('id'), str)
            or not isinstance(job.get('query'), str)):
        raise ValueError('Trabajo inválido')
    identifier = job['id']
    try:
        results = asyncio.run(search_with_session(job['query'], search_id=identifier, registry=SELECTIONS))
    except Exception:
        bridge_request(key, '/telegram/bridge/finish', {'identifier': identifier, 'failed': True})
        return 'failed'
    bridge_request(key, '/telegram/bridge/finish', {'identifier': identifier, 'results': results})
    return 'completed'


async def verify_selection(search_id, result_id, *, registry, send_callback=False):
    """Revalida una selección y, solo si se pide, envía un callback sin reintento."""
    from telethon import TelegramClient
    from telethon.sessions import StringSession
    from telethon.tl.functions.messages import GetBotCallbackAnswerRequest
    from telegram_third_party_callback import prepare, _button

    message_id, coordinate, snapshot = registry.consume(result_id, operator=search_id)
    api_id, api_hash, _ = read_credentials()
    path = session_path()
    with exclusive_account_lock(path.parent / 'telegram-account.lock'):
        session = load_session(path)
        client = TelegramClient(StringSession(session), api_id, api_hash, request_retries=0,
                                connection_retries=0, auto_reconnect=False,
                                raise_last_call_error=True)
        try:
            await asyncio.wait_for(client.connect(), 15)
            if not await asyncio.wait_for(client.is_user_authorized(), 15):
                raise ValueError('Sesión no autorizada')
            me, bot, group = await asyncio.wait_for(verify_identity(
                client, account_id=ACCOUNT_ID, bot_id=BOT_ID, confirmed_bot_id=BOT_ID,
                group_id=GROUP_ID, confirmed_group_id=GROUP_ID), 30)
            message = await asyncio.wait_for(client.get_messages(group, ids=message_id), 15)
            if message is None or not hmac.compare_digest(message_fingerprint(message), snapshot):
                raise ValueError('Mensaje cambiado o no disponible')
            prepare(message, coordinate, me=me, bot=bot, group=group,
                    account_id=ACCOUNT_ID, bot_id=BOT_ID, group_id=GROUP_ID)
            if send_callback is True:
                data = _button(message, coordinate)
                peer = await asyncio.wait_for(client.get_input_entity(group), 15)
                request = GetBotCallbackAnswerRequest(peer=peer, msg_id=message_id, data=data)
                # La referencia ya fue consumida: cualquier error es incierto y no se reintenta.
                await asyncio.wait_for(client(request), 15)
        finally:
            await asyncio.wait_for(client.disconnect(), 15)


def receipt_baseline():
    """Leer las actualizaciones recientes sin modificar el webhook.

    La Bot API no confirma actualizaciones si no se envía un offset; con el uso
    normal la cola crece hasta 100 y entonces deja de verse cualquier mensaje
    nuevo. El puente es el único consumidor del bot: conservamos las últimas 50
    actualizaciones (donde está la selección reciente) y olvidamos las previas.
    """
    _, _, token = read_credentials()
    bot = bot_request(token, 'getMe', {})
    if not isinstance(bot, dict) or str(bot.get('username', '')).lower() != 'mussicart_bot':
        raise ValueError('Bot incorrecto')
    webhook = bot_request(token, 'getWebhookInfo', {})
    if not isinstance(webhook, dict) or webhook.get('url') != '':
        raise ValueError('Webhook activo o desconocido')
    updates = bot_request(token, 'getUpdates', {'offset': -50, 'limit': 100, 'timeout': 0})
    # Validar página antes de cualquier efecto externo.
    new_audio_candidates(updates, updates, group_id=GROUP_ID, sender_id=BOT_ID)
    return token, updates


def receipt_after(token, before, search_id):
    after = bot_request(token, 'getUpdates', {'limit': 100, 'timeout': 0})
    candidates = new_audio_candidates(before, after, group_id=GROUP_ID, sender_id=BOT_ID)
    if len(candidates) != 1:
        return None
    candidate = candidates[0]
    title = ''
    for update in after:
        message = update.get('message', {})
        if (isinstance(message, dict) and message.get('message_id') == candidate.message_id
                and isinstance(message.get('chat'), dict) and message['chat'].get('id') == GROUP_ID
                and isinstance(message.get('from'), dict) and message['from'].get('id') == BOT_ID):
            audio = message.get('audio', {})
            if isinstance(audio, dict) and isinstance(audio.get('title'), str):
                title = ''.join(char for char in audio['title'] if char.isprintable())[:120]
            break
    reference = RECEIPTS.issue(operator=search_id, value=candidate)
    return {'id': reference, 'message_id': candidate.message_id, 'size': candidate.size,
            'mime_type': candidate.mime_type, 'title': title}


def run_selection_once(key, *, wait=time.sleep):
    if os.environ.get('MUSIC_TELEGRAM_CALLBACK_ENABLED') != '1':
        return 'disabled'
    response = bridge_request(key, '/telegram/bridge/claim-selection', {})
    selection = response.get('selection')
    if selection is None:
        return 'idle'
    if (not isinstance(selection, dict) or not isinstance(selection.get('search_id'), str)
            or not isinstance(selection.get('result_id'), str)):
        raise ValueError('Selección inválida')
    search_id = selection['search_id']
    try:
        token, before = receipt_baseline()
        asyncio.run(verify_selection(search_id, selection['result_id'], registry=SELECTIONS,
                                     send_callback=True))
    except Exception:
        bridge_request(key, '/telegram/bridge/callback-result', {'identifier': search_id, 'confirmed': False})
        return 'failed'
    try:
        # Espera acotada; observar no repite el callback ni confirma updates.
        # Algunos audios tardan más en aparecer en el grupo.
        receipt = None
        for _ in range(45):
            wait(1)
            receipt = receipt_after(token, before, search_id)
            if receipt is not None:
                break
    except Exception:
        receipt = None
    bridge_request(key, '/telegram/bridge/callback-result', {'identifier': search_id,
                                                            'confirmed': True, 'receipt': receipt})
    return 'confirmed'


def download_receipt(search_id, receipt_id, *, registry, progress=None):
    """Guarda en cuarentena un candidato revalidado; no publica ni valida audio."""
    candidate = registry.consume(receipt_id, operator=search_id)
    token, updates = receipt_baseline()
    matches = [candidate_from_update(item, group_id=GROUP_ID, sender_id=BOT_ID) for item in updates]
    if sum(item == candidate for item in matches) != 1:
        raise ValueError('Candidato modificado o no disponible')
    info = bot_request(token, 'getFile', {'file_id': candidate.file_id})
    if not isinstance(info, dict) or info.get('file_size') != candidate.size:
        raise ValueError('Tamaño no coincide')
    source = get_chunks(token, info.get('file_path'))
    if progress is not None:
        def tracked():
            received = 0
            for chunk in source:
                received += len(chunk)
                if received > candidate.size:
                    raise ValueError('Tamaño excede lo declarado')
                progress(received, candidate.size)
                yield chunk
        chunks = tracked()
    else:
        chunks = source
    path = save_quarantined(chunks, candidate=candidate, destination=DESTINATION)
    if candidate.mime_type not in ALLOWED_AUDIO_TYPES:
        return 'quarantined'
    validated = None
    for attempt in range(2):
        try:
            validated = validate_mp3(path)
            break
        except AudioValidationError as exc:
            transient = 'Tiempo' in str(exc) or 'No se completó' in str(exc)
            if attempt == 0 and transient:
                time.sleep(1)
                continue
            return 'quarantined'
    if validated is None:
        return 'quarantined'
    if os.environ.get('MUSIC_TELEGRAM_PUBLISH_ENABLED') != '1':
        return 'validated'
    try:
        target = publish_validated_mp3(validated, directory=DESTINATION.parent / 'telegram-ready')
        try:
            metadata, cover = extract_mp3_metadata(validated)
            write_metadata_sidecars(target, validated, metadata, cover)
        except AudioValidationError:
            # Un fallo de metadatos no hace desaparecer el audio validado.
            pass
        return 'published'
    except AudioValidationError:
        return 'validated'


def run_download_once(key):
    if os.environ.get('MUSIC_TELEGRAM_DOWNLOAD_ENABLED') != '1':
        return 'disabled'
    response = bridge_request(key, '/telegram/bridge/claim-download', {})
    job = response.get('download')
    if job is None:
        return 'idle'
    if (not isinstance(job, dict) or not isinstance(job.get('search_id'), str)
            or not isinstance(job.get('receipt_id'), str)):
        raise ValueError('Descarga inválida')
    search_id = job['search_id']
    last = {'time': 0.0, 'bytes': 0}

    def report(received, total):
        now = time.monotonic()
        if received != total and received - last['bytes'] < 512 * 1024 and now - last['time'] < 0.4:
            return
        last['time'], last['bytes'] = now, received
        try:
            bridge_request(key, '/telegram/bridge/download-progress',
                           {'identifier': search_id, 'received': received, 'total': total})
        except Exception:
            # Un fallo al informar el avance no cambia el resultado de la descarga.
            pass

    try:
        outcome = download_receipt(search_id, job['receipt_id'], registry=RECEIPTS, progress=report)
    except Exception:
        bridge_request(key, '/telegram/bridge/download-result', {'identifier': search_id, 'saved': False})
        return 'failed'
    bridge_request(key, '/telegram/bridge/download-result', {'identifier': search_id, 'saved': True,
                                                            'validated': outcome in ('validated', 'published'),
                                                            'published': outcome == 'published'})
    return 'saved'


def delete_imported(filename, *, directory):
    """Elimina solo una copia importada y sus dos sidecars; no toca cuarentena."""
    if type(filename) is not str or not re.fullmatch(r'telegram-[0-9a-f]{32}\.mp3', filename):
        raise ValueError('Nombre inválido')
    audio = directory / filename
    targets = [audio, audio.with_suffix('.json'), audio.with_suffix('.jpg')]
    if not audio.is_file() or any(path.is_symlink() for path in targets):
        raise ValueError('Archivo no disponible o enlace no permitido')
    for path in targets:
        if path.exists():
            if not path.is_file():
                raise ValueError('Entrada inválida')
    for path in targets:
        if path.exists():
            path.unlink()


def run_delete_once(key):
    if os.environ.get('MUSIC_TELEGRAM_DELETE_ENABLED') != '1':
        return 'disabled'
    response = bridge_request(key, '/telegram/bridge/claim-delete', {})
    job = response.get('delete')
    if job is None:
        return 'idle'
    if not isinstance(job, dict) or not isinstance(job.get('id'), str) or not isinstance(job.get('filename'), str):
        raise ValueError('Eliminación inválida')
    try:
        delete_imported(job['filename'], directory=DESTINATION.parent / 'telegram-ready')
    except Exception:
        bridge_request(key, '/telegram/bridge/delete-result', {'identifier': job['id'], 'deleted': False})
        return 'failed'
    bridge_request(key, '/telegram/bridge/delete-result', {'identifier': job['id'], 'deleted': True})
    return 'deleted'


def serve(key, *, wait=time.sleep):
    """Atiende trabajos secuenciales sin reintentar los que quedan inciertos.

    Un fallo deja el trabajo actual en estado incierto y no se vuelve a tocar;
    el proceso sigue vivo para atender solicitudes nuevas. Así un error aislado
    de red o de Telegram no obliga a reiniciar el puente para cada canción.
    """
    while True:
        bridge_request(key, '/telegram/bridge/heartbeat', {
            'session_present': session_path().is_file(),
            'callback_enabled': os.environ.get('MUSIC_TELEGRAM_CALLBACK_ENABLED') == '1',
            'download_enabled': os.environ.get('MUSIC_TELEGRAM_DOWNLOAD_ENABLED') == '1',
            'publish_enabled': os.environ.get('MUSIC_TELEGRAM_PUBLISH_ENABLED') == '1',
            'delete_enabled': os.environ.get('MUSIC_TELEGRAM_DELETE_ENABLED') == '1',
        })
        deleted = run_delete_once(key)
        if deleted == 'failed':
            wait(2)
            continue
        if deleted == 'deleted':
            continue
        downloaded = run_download_once(key)
        if downloaded == 'failed':
            wait(2)
            continue
        if downloaded == 'saved':
            continue
        selected = run_selection_once(key)
        if selected == 'failed':
            wait(2)
            continue
        if selected == 'confirmed':
            continue
        result = run_once(key)
        if result == 'failed':
            wait(2)
            continue
        if result == 'idle':
            wait(2)


def main():
    if sys.argv[1:] != ['--serve']:
        print('Uso: py -3.10 telegram_windows_bridge.py --serve')
        return 1
    key = os.environ.get('MUSIC_TELEGRAM_BRIDGE_KEY', '')
    previous = logging.root.manager.disable
    logging.disable(logging.CRITICAL)
    try:
        print('Puente activo. Ctrl+C para detenerlo.')
        # Una sola instancia cooperativa mantiene el registro de selecciones.
        with exclusive_account_lock(session_path().parent / 'telegram-agent.lock'):
            serve(key)
        return 0
    except KeyboardInterrupt:
        print('Puente detenido. Si había una operación en curso, revisa su estado.')
        return 1
    except Exception:
        print('No se completó el intercambio; revisa el estado antes de intentar de nuevo.')
        return 1
    finally:
        logging.disable(previous)


if __name__ == '__main__':
    sys.exit(main())
