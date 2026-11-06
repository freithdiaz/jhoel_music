"""Interactive, memory-only Telegram login; does not execute callbacks."""

import asyncio
import getpass
import logging
import sys
import warnings


BOT_USERNAME = 'mussicart_bot'


class LogoutNotConfirmed(Exception):
    pass


def secret(prompt):
    # getpass otherwise falls back to echoed input when the terminal fails.
    with warnings.catch_warnings():
        warnings.simplefilter('error', getpass.GetPassWarning)
        return getpass.getpass(prompt)


async def login():
    if sys.argv[1:] not in ([], ['--env']) or not sys.stdin.isatty() or not sys.stdout.isatty():
        raise ValueError('Se requiere consola interactiva')
    print('Login temporal en memoria; sin callbacks. Use solo una cuenta dedicada y su propio bot.')
    if sys.argv[1:] == ['--env']:
        print('Se consultará el bot y sus actualizaciones pendientes sin confirmarlas; '
              'puede interferir con otros clientes del bot.')
    if input('¿Confirma y autoriza la conexión? Escriba SI: ').strip() != 'SI':
        raise ValueError('Consentimiento denegado')
    use_env = sys.argv[1:] == ['--env']
    if use_env:
        from telegram_local_credentials import read_credentials, discover
        api_id, api_hash, token = read_credentials()
        account_id, bot_id = discover(token)
        del token
    else:
        api_id = int(input('API ID: ').strip())
        api_hash = secret('API hash: ').strip()
    phone = secret('Teléfono internacional: ').strip()
    if not use_env:
        account_id = int(input('ID numérico de su cuenta dedicada: ').strip())
        bot_id = int(input('ID numérico de su bot propio: ').strip())
    if min(api_id, account_id, bot_id) <= 0 or not api_hash or not phone:
        raise ValueError('Datos inválidos')
    from telethon import TelegramClient
    from telethon.errors import SessionPasswordNeededError
    from telethon.sessions import MemorySession
    from telethon.tl.types import User

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
        me = await client.get_me()
        # Resolve by username: a fresh MemorySession has no cached access_hash for the bot ID.
        bot = await client.get_entity(BOT_USERNAME)
        if (not isinstance(me, User) or me.bot or me.id != account_id
                or (use_env and (me.username or '').lower() != 'jhoelti')
                or not isinstance(bot, User) or not bot.bot or bot.id != bot_id
                or (bot.username or '').lower() != BOT_USERNAME):
            raise ValueError('Identidad no coincide')
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
    if sys.argv[1:] not in ([], ['--env']) or not sys.stdin.isatty() or not sys.stdout.isatty():
        print('Uso: python telegram_login_poc.py [--env] (solo consola interactiva).')
        return 1
    try:
        asyncio.run(login())
    except LogoutNotConfirmed:
        print('No se confirmó la revocación. Cierre manualmente la sesión en Telegram '
              'desde Ajustes > Dispositivos.')
        return 1
    except (Exception, KeyboardInterrupt):
        print('Login cancelado o fallido; no se guardó una sesión.')
        return 1
    print('Login e identidades verificados; revocación de sesión confirmada.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
