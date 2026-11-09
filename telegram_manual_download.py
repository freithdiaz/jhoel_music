"""Prueba local supervisada: guardar en cuarentena un audio seleccionado a mano."""

import os
import re
import secrets
import sys
import urllib.request
from pathlib import Path

from telegram_import import candidate_from_update
from telegram_local_credentials import NoRedirect, bot_request, read_bot_token
from telegram_transfer_offline import temporary_audio

GROUP_ID = -5498752855
SENDER_ID = 117250343
DESTINATION = Path(__file__).resolve().parent / 'music' / 'telegram-imports'


def candidates_from_updates(updates):
    if not isinstance(updates, list) or len(updates) >= 100:
        raise ValueError('Cola de actualizaciones incompleta o inválida')
    found = []
    for update in updates:
        candidate = candidate_from_update(update, group_id=GROUP_ID, sender_id=SENDER_ID)
        if candidate:
            audio = update['message']['audio']
            # El título es informativo y no interviene en la ruta del archivo.
            title = audio.get('title', '')
            title = ''.join(c if c.isprintable() and ord(c) < 127 else '?' for c in str(title))[:100]
            found.append((candidate, title))
    return found


def get_chunks(token, file_path):
    # Solo la ruta devuelta por getFile; sin redirecciones ni proxy ambiental.
    if not isinstance(file_path, str) or not re.fullmatch(r'[A-Za-z0-9_./-]{1,512}', file_path):
        raise ValueError('Ruta de archivo inválida')
    if any(part in ('', '.', '..') for part in file_path.split('/')):
        raise ValueError('Ruta de archivo inválida')
    url = 'https://api.telegram.org/file/bot' + token + '/' + file_path
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    with opener.open(url, timeout=15) as response:
        while True:
            chunk = response.read(65536)
            if not chunk:
                break
            yield chunk


def save_quarantined(chunks, *, candidate, destination):
    """Guardar sin sobrescribir; el contenido no se valida ni se ejecuta."""
    destination.mkdir(parents=True, exist_ok=True)
    with temporary_audio(chunks, expected_size=candidate.size, directory=destination) as source:
        target = destination / ('telegram-' + secrets.token_hex(16) + '.bin')
        # En el mismo volumen, el enlace falla si ya existe el destino.
        os.link(source, target)
    return target


def main():
    if not sys.stdin.isatty():
        print('Esta prueba requiere una consola interactiva.')
        return 1
    print('Selecciona primero el audio manualmente en el grupo privado de Telegram.')
    print('No se pulsarán botones. Se leerá la primera página de actualizaciones sin confirmarlas.')
    print('No debe haber otro consumidor del bot; el contenido se guardará sin validar en cuarentena.')
    if input('Escribe CONTINUAR para consultar Telegram: ').strip() != 'CONTINUAR':
        return 1
    stage = 'lectura de configuración local'
    try:
        token = read_bot_token()
        stage = 'consulta de identidad del bot'
        bot = bot_request(token, 'getMe', {})
        if not isinstance(bot, dict) or str(bot.get('username', '')).lower() != 'mussicart_bot':
            raise ValueError('Bot incorrecto')
        stage = 'comprobación del webhook'
        webhook = bot_request(token, 'getWebhookInfo', {})
        if not isinstance(webhook, dict) or webhook.get('url') != '':
            raise ValueError('Webhook activo o desconocido')
        stage = 'consulta de actualizaciones'
        updates = bot_request(token, 'getUpdates', {'limit': 100, 'timeout': 0})
        stage = 'revisión de candidatos'
        candidates = candidates_from_updates(updates)
        if not candidates:
            print('No se encontró un audio admitido en las actualizaciones disponibles.')
            return 1
        for index, (candidate, title) in enumerate(candidates, 1):
            print(f'{index}. Mensaje {candidate.message_id}: {title or "sin título"}; '
                  f'{candidate.size} bytes; {candidate.mime_type}')
        selection = input('Número de archivo (Enter cancela): ').strip()
        if not selection.isascii() or not selection.isdigit() or not 1 <= int(selection) <= len(candidates):
            return 1
        candidate, _ = candidates[int(selection) - 1]
        print('El título y los metadatos no verifican identidad, formato ni derechos del archivo.')
        if input('Escribe AUTORIZO para confirmar que puedes conservar este archivo y descargarlo: ').strip() != 'AUTORIZO':
            return 1
        stage = 'solicitud de información del archivo'
        file_info = bot_request(token, 'getFile', {'file_id': candidate.file_id})
        if not isinstance(file_info, dict) or file_info.get('file_size') != candidate.size:
            raise ValueError('El tamaño no coincide')
        stage = 'descarga y guardado en cuarentena'
        path = save_quarantined(get_chunks(token, file_info.get('file_path')),
                                candidate=candidate, destination=DESTINATION)
        print(f'Guardado sin validar en: {path}')
        print('No se añadió a la biblioteca. No abras el archivo hasta verificarlo.')
        return 0
    except (Exception, KeyboardInterrupt):
        # No mostrar excepciones: pueden contener el token o la URL privada.
        print(f'No se completó la prueba. Etapa: {stage}.')
        return 1


if __name__ == '__main__':
    sys.exit(main())
