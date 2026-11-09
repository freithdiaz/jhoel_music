"""Configuración interactiva de sesión Telegram dedicada cifrada en Windows."""

import asyncio
import logging
import os
import sys
from pathlib import Path

from telegram_local_credentials import read_credentials, read_optional_phone
from telegram_login_poc import secret
from telegram_third_party_search import ACCOUNT_ID, BOT_ID, GROUP_ID, request_code
from telegram_third_party_identity import verify_identity
from telegram_windows_session import save_session
from telegram_windows_lock import exclusive_account_lock


def session_path():
    override = os.environ.get('MUSIC_TELEGRAM_SESSION')
    if override:
        return Path(override)
    if os.name == 'nt':
        if not os.environ.get('LOCALAPPDATA'):
            raise ValueError('Se requiere Windows y LOCALAPPDATA')
        return Path(os.environ['LOCALAPPDATA']) / 'DiazMusic' / 'telegram-session.dpapi'
    base = os.environ.get('XDG_STATE_HOME') or str(Path.home() / '.local' / 'state')
    return Path(base) / 'diaz-music' / 'telegram-session'


async def setup():
    path = session_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(path.parent, 0o700)
    except OSError:
        pass
    with exclusive_account_lock(path.parent / 'telegram-account.lock'):
        await _setup_locked(path)


async def _setup_locked(path):
    from telethon import TelegramClient
    from telethon.errors import SessionPasswordNeededError
    from telethon.sessions import StringSession

    if path.exists():
        raise ValueError('Ya existe una sesión; no se sobrescribirá')
    api_id, api_hash, _ = read_credentials()
    phone = read_optional_phone() or secret('Teléfono de la cuenta dedicada: ').strip()
    if not phone:
        raise ValueError('Teléfono no disponible')
    client = TelegramClient(StringSession(), api_id, api_hash, request_retries=0,
                            connection_retries=0, auto_reconnect=False,
                            raise_last_call_error=True)
    signed_in = False
    saved = False
    cleanup_uncertain = False
    try:
        await asyncio.wait_for(client.connect(), 15)
        await asyncio.wait_for(request_code(client, phone), 30)
        code = secret('Código de Telegram (no lo compartas): ').strip()
        try:
            # Una respuesta incierta podría haber creado una sesión remota.
            signed_in = True
            await asyncio.wait_for(client.sign_in(phone=phone, code=code), 30)
        except SessionPasswordNeededError:
            await asyncio.wait_for(client.sign_in(password=secret('Contraseña 2FA: ')), 30)
        await asyncio.wait_for(verify_identity(
            client, account_id=ACCOUNT_ID, bot_id=BOT_ID, confirmed_bot_id=BOT_ID,
            group_id=GROUP_ID, confirmed_group_id=GROUP_ID), 30)
        save_session(path, client.session.save())
        saved = True
    finally:
        if signed_in and not saved:
            try:
                cleanup_uncertain = await asyncio.wait_for(client.log_out(), 15) is not True
            except BaseException:
                cleanup_uncertain = True
        try:
            await asyncio.wait_for(client.disconnect(), 15)
        except BaseException:
            cleanup_uncertain = True
        if cleanup_uncertain:
            print('No se confirmó el cierre. Revisa Telegram > Ajustes > Dispositivos.')


def main():
    if sys.argv[1:] or not sys.stdin.isatty() or not sys.stdout.isatty():
        print('Ejecuta este comando en una consola interactiva, sin argumentos.')
        return 1
    print('Se guardará una sesión persistente para la cuenta dedicada.')
    print('En Windows se protege con DPAPI; en Linux queda en un archivo 0600 propiedad del servicio.')
    print('Solo usa la cuenta dedicada; otros procesos de tu usuario podrían acceder a ella.')
    print('No se enviarán búsquedas ni se pulsarán botones.')
    if input('Escribe SI para continuar: ').strip() != 'SI':
        return 1
    old = logging.root.manager.disable
    logging.disable(logging.CRITICAL)
    try:
        asyncio.run(setup())
    except (Exception, KeyboardInterrupt):
        print('Configuración incompleta. No compartas códigos ni credenciales.')
        return 1
    finally:
        logging.disable(old)
    print('Sesión guardada. Todavía no está conectada a la aplicación.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
