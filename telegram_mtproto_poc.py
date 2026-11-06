"""Local-only MTProto callback experiment; never imported by the web server.

Optional dependency: install Telethon 1.x separately (requirements-telegram-poc.txt).
Live operation is deliberately disabled until Windows session-directory ACLs can
be established and verified. Running this module does not connect or log in.
"""

import sqlite3
import sys
from pathlib import Path


BOT_USERNAME = 'mussicart_bot'


class Refused(RuntimeError):
    pass


def verified_session_directory(path):
    """Fail closed until Windows ACL ownership and effective access are verified.

    A path outside the checkout alone is not a confidentiality guarantee. This
    gate intentionally has no opt-out, including on non-Windows systems.
    """
    return False


def require_session_directory(path):
    path = Path(path).expanduser().resolve()
    repository = Path(__file__).resolve().parent
    if path == repository or repository in path.parents:
        raise Refused('La sesión debe estar fuera del repositorio.')
    if not verified_session_directory(path):
        raise Refused('ACL de sesión no verificable; conexión bloqueada.')
    return path


def reserve(db_path, account_id, bot_id, chat_id, message_id, row, column):
    """Persist an at-most-once reservation before dispatch, even on failure.

    Deleting or restoring the database defeats this protection. It must share
    the protected session directory and must not be replaced between runs.
    """
    with sqlite3.connect(str(db_path), timeout=10, isolation_level=None) as db:
        db.execute('PRAGMA synchronous=FULL')
        db.execute('BEGIN IMMEDIATE')
        try:
            if db.execute("SELECT 1 FROM sqlite_master WHERE type='table' "
                          "AND name='used'").fetchone():
                raise sqlite3.DatabaseError('Legacy replay state requires review')
            db.execute('CREATE TABLE IF NOT EXISTS used_v2 '
                       '(account INTEGER NOT NULL, bot INTEGER NOT NULL, '
                       'chat INTEGER NOT NULL, message INTEGER NOT NULL, row INTEGER NOT NULL, '
                       'col INTEGER NOT NULL, PRIMARY KEY '
                       '(account, bot, chat, message, row, col))')
            db.execute('INSERT INTO used_v2 VALUES (?, ?, ?, ?, ?, ?)',
                       (account_id, bot_id, chat_id, message_id, row, column))
            db.execute('COMMIT')
        except BaseException:
            db.execute('ROLLBACK')
            raise


def confirm_selection(account_id, bot_id, chat_id, message_id, row, column):
    if not sys.stdin.isatty() or not sys.stdout.isatty():
        raise Refused('Se requiere consola interactiva.')
    print(f'Cuenta {account_id}; bot {bot_id}; chat {chat_id}; '
          f'mensaje {message_id}; botón {row}, {column}.')
    if input('¿Autoriza este único callback? Escriba SI: ').strip() != 'SI':
        raise Refused('Cancelado.')


async def select_callback(client, *, account_id, bot_id, chat_id, message_id,
                          row, column, session_directory):
    """Validate current Telegram objects and dispatch one approved callback.

    This low-level adapter requires a trusted, authenticated dedicated client;
    only the console entry point may create such a client. Never log exceptions
    or Telegram objects, which can contain credentials or callback data.
    """
    values = (account_id, bot_id, message_id)
    if (any(type(x) is not int or x <= 0 for x in values)
            or type(chat_id) is not int or chat_id == 0
            or type(row) is not int or row < 0
            or type(column) is not int or column < 0):
        raise Refused('Selección o consentimiento inválido.')
    directory = require_session_directory(session_directory)
    from telethon.tl.types import User, Chat, Channel, KeyboardButtonCallback
    from telethon.utils import get_peer_id
    from telethon.tl.functions.messages import GetBotCallbackAnswerRequest
    me = await client.get_me()
    if not isinstance(me, User) or me.id != account_id or me.bot:
        raise Refused('Cuenta dedicada no coincide.')
    bot = await client.get_entity(bot_id)
    if (not isinstance(bot, User) or bot.id != bot_id or not bot.bot
            or (bot.username or '').lower() != BOT_USERNAME):
        raise Refused('Identidad de bot no coincide.')
    chat = await client.get_entity(chat_id)
    if (get_peer_id(chat) != chat_id or
            not ((isinstance(chat, User) and chat.id == bot_id and chat.bot)
                 or isinstance(chat, Chat)
                 or (isinstance(chat, Channel) and chat.megagroup))):
        raise Refused('Chat no permitido.')
    message = await client.get_messages(chat, ids=message_id)
    if (message is None or message.id != message_id or message.chat_id != chat_id
            or message.sender_id != bot_id or message.out
            or getattr(message, 'fwd_from', None) is not None
            or getattr(message, 'via_bot_id', None) is not None):
        raise Refused('Origen de mensaje inválido.')
    try:
        button = message.reply_markup.rows[row].buttons[column]
    except (AttributeError, IndexError, TypeError):
        raise Refused('Botón inexistente.') from None
    if (not isinstance(button, KeyboardButtonCallback) or type(button.data) is not bytes
            or not 1 <= len(button.data) <= 64):
        raise Refused('El botón no es callback válido.')
    confirm_selection(account_id, bot_id, chat_id, message_id, row, column)
    try:
        reserve(directory / 'callback-replay.sqlite3', account_id, bot_id, chat_id,
                message_id, row, column)
    except sqlite3.Error:
        raise Refused('Selección ya utilizada o estado no disponible.') from None
    # Do not expose the callback payload or the server response to the console.
    await client(GetBotCallbackAnswerRequest(peer=chat, msg_id=message_id,
                                             data=button.data))


def main():
    if len(sys.argv) != 1 or not sys.stdin.isatty() or not sys.stdout.isatty():
        print('Uso: python telegram_mtproto_poc.py (solo consola interactiva).')
        return 1
    print('PoC local: sin descargas; solo cuenta dedicada y bot propio.')
    path = input('Directorio externo para sesión y estado: ').strip()
    try:
        require_session_directory(path)
    except (OSError, ValueError, Refused):
        print('Bloqueado: directorio externo o ACL no verificables. Sin conexión.')
        return 1
    # No login or networking can occur until an independently reviewed ACL
    # implementation and a consent-driven console login flow are provided.
    print('Bloqueado: flujo interactivo de sesión aún no habilitado.')
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
