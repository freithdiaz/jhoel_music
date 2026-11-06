"""Supervised third-party identity check; search and callbacks are blocked.

This entry point contacts Telegram only when explicitly run interactively.
It neither sends searches nor reads messages or invokes callbacks.
"""

import asyncio
import logging
import sys

from telegram_login_poc import LogoutNotConfirmed, secret
from telegram_third_party_identity import verify_identity


async def run():
    if sys.argv[1:] or not sys.stdin.isatty() or not sys.stdout.isatty():
        raise ValueError('Se requiere consola interactiva sin argumentos')
    print('Solo identidad: búsqueda y callback bloqueados. Sesión temporal en memoria.')
    print('Use una cuenta dedicada. No se descargará audio ni se leerán mensajes.')
    if input('¿Autoriza la conexión? Escriba SI: ').strip() != 'SI':
        raise ValueError('Consentimiento denegado')

    api_id = int(input('API ID: ').strip())
    api_hash = secret('API hash: ').strip()
    phone = secret('Teléfono internacional: ').strip()
    account_id = int(input('ID numérico de la cuenta dedicada: ').strip())
    bot_id = int(input('ID numérico de @vkmusbot: ').strip())
    confirmed_bot_id = int(input('Repita el ID de @vkmusbot para confirmar: ').strip())
    group_id = int(input('ID numérico del grupo privado: ').strip())
    confirmed_group_id = int(input('Repita el ID del grupo para confirmar: ').strip())
    if (api_id <= 0 or account_id <= 0 or bot_id <= 0 or group_id >= 0
            or bot_id != confirmed_bot_id or group_id != confirmed_group_id
            or not api_hash or not phone):
        raise ValueError('Datos inválidos o no confirmados')

    from telethon import TelegramClient
    from telethon.errors import SessionPasswordNeededError
    from telethon.sessions import MemorySession

    previous_disable = logging.root.manager.disable
    logging.disable(logging.CRITICAL)
    client = None
    sign_in_attempted = False
    try:
        client = TelegramClient(MemorySession(), api_id, api_hash)
        await client.connect()
        await client.send_code_request(phone)
        code = secret('Código de Telegram: ')
        try:
            sign_in_attempted = True
            await client.sign_in(phone=phone, code=code)
        except SessionPasswordNeededError:
            await client.sign_in(password=secret('Contraseña de verificación en dos pasos: '))
        await verify_identity(client, account_id=account_id, bot_id=bot_id,
                              confirmed_bot_id=confirmed_bot_id, group_id=group_id,
                              confirmed_group_id=confirmed_group_id)
    finally:
        try:
            logout_failed = False
            try:
                if sign_in_attempted:
                    try:
                        logout_failed = await client.log_out() is not True
                    except BaseException:
                        logout_failed = True
            finally:
                if client is not None:
                    try:
                        await client.disconnect()
                    except BaseException:
                        if not logout_failed:
                            raise
            if logout_failed:
                raise LogoutNotConfirmed() from None
        finally:
            logging.disable(previous_disable)


def main():
    try:
        asyncio.run(run())
    except LogoutNotConfirmed:
        print('Revocación no confirmada. Cierre la sesión manualmente en Telegram: Ajustes > Dispositivos.')
        return 1
    except (Exception, KeyboardInterrupt):
        print('Operación cancelada o fallida; búsqueda y callback siguen bloqueados.')
        return 1
    print('Identidades verificadas; Telegram confirmó logout. Búsqueda y callback bloqueados.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
