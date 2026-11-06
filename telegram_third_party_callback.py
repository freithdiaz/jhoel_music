"""Local preparation and guarded dispatch for a supervised callback.

Snapshots and identity objects are not proof of current Telegram state or of
search/result correlation. Dispatch is disabled by a code-only gate here.
"""

from threading import Lock

# Requires code review and separate future authorization before changing this.
CALLBACK_DISPATCH_ENABLED = False


_lock = Lock()
_consumed = False


def _identity(me, bot, group, account_id, bot_id, group_id):
    from telethon.tl.types import User, Chat, Channel
    from telethon.utils import get_peer_id

    return (type(account_id) is int and account_id > 0
            and type(bot_id) is int and bot_id > 0
            and type(group_id) is int and group_id < 0
            and type(me) is User and me.id == account_id and not me.bot
            and type(bot) is User and bot.id == bot_id and bot.bot is True
            and (bot.username or '').lower() == 'vkmusbot'
            and type(group) in (Chat, Channel) and get_peer_id(group) == group_id
            and not getattr(group, 'username', None)
            and not getattr(group, 'usernames', None)
            and not getattr(group, 'left', False)
            and not getattr(group, 'deactivated', False)
            and not getattr(group, 'forbidden', False)
            and (type(group) is not Channel or group.megagroup))


def _button(message, coordinate):
    from telethon.tl import types

    if (type(coordinate) is not tuple or len(coordinate) != 2
            or any(type(i) is not int or i < 0 for i in coordinate)
            or type(message.reply_markup) is not types.ReplyInlineMarkup):
        raise ValueError
    button = message.reply_markup.rows[coordinate[0]].buttons[coordinate[1]]
    legacy = getattr(types, 'KeyboardButtonCallback', None)
    modern = getattr(types, 'KeyboardInlineButton', None)
    callback = getattr(types, 'InlineButtonTypeCallback', None)
    if legacy is not None and type(button) is legacy:
        data = button.data
    elif (modern is not None and callback is not None and type(button) is modern
          and type(button.type) is callback):
        data = button.type.data
    else:
        raise ValueError
    if type(data) is not bytes or not 1 <= len(data) <= 64:
        raise ValueError
    return data


def prepare(message, coordinate, *, me, bot, group, account_id, bot_id, group_id):
    """Bind an exact observed message and button to previously checked identities.

    The caller must separately verify membership and search/result correlation;
    neither this snapshot nor operator recognition establishes either property.
    """
    from telegram_third_party_search import classify

    if not _identity(me, bot, group, account_id, bot_id, group_id):
        raise ValueError('Identidad inválida')
    try:
        if classify(message, group_id, bot_id, None) is None or message.out:
            raise ValueError
        if message.fwd_from is not None or message.via_bot_id is not None:
            raise ValueError
        if type(message.id) is not int or message.id <= 0:
            raise ValueError
        _button(message, coordinate)
        snapshot = bytes(message)
        if len(snapshot) > 1024 * 1024:
            raise ValueError
    except (AttributeError, IndexError, TypeError, ValueError):
        raise ValueError('Mensaje o botón inválido') from None
    return _Prepared(snapshot, coordinate, account_id, bot_id, group_id)


class _Prepared:
    def __init__(self, snapshot, coordinate, account_id, bot_id, group_id):
        self._snapshot = snapshot
        self._coordinate = coordinate
        self._ids = (account_id, bot_id, group_id)

    def confirm_and_check(self, current, *, me, bot, group, confirmation):
        """Consume at most one valid local check per process; never dispatch.

        The caller must provide freshly verified identity and message objects.
        Return False even on success: approval gates and dispatch are absent.
        """
        global _consumed
        with _lock:
            if _consumed or confirmation != 'SI' or type(confirmation) is not str:
                return False
            try:
                if not _identity(me, bot, group, *self._ids):
                    return False
                if bytes(current) != self._snapshot:
                    return False
                _button(current, self._coordinate)
            except (AttributeError, IndexError, TypeError, ValueError):
                return False
            _consumed = True
            return False


async def dispatch_selected(client, message, coordinate, sent_id, *, account_id, bot_id, group_id):
    """Revalidate a linked selection and issue at most one callback per process."""
    import asyncio
    import sys
    from telegram_third_party_search import classify, select_observed
    from telethon.sessions import MemorySession
    from telethon.tl.functions.messages import GetBotCallbackAnswerRequest
    from telegram_third_party_identity import verify_identity

    global _consumed
    if CALLBACK_DISPATCH_ENABLED is not True:
        raise ValueError('Callback deshabilitado')
    if not sys.stdin.isatty() or not sys.stdout.isatty():
        raise ValueError('Se requiere consola interactiva')
    if (type(client.session) is not MemorySession
            or client._request_retries != 0
            or type(sent_id) is not int or sent_id <= 0):
        raise ValueError('Cliente o búsqueda inválidos')
    me, bot, group = await asyncio.wait_for(verify_identity(
        client, account_id=account_id, bot_id=bot_id, confirmed_bot_id=bot_id,
        group_id=group_id, confirmed_group_id=group_id), 30)
    if classify(message, group_id, bot_id, sent_id) != ('vinculado', 'sin medio'):
        raise ValueError('Mensaje no vinculado a la búsqueda')
    prepared = prepare(message, coordinate, me=me, bot=bot, group=group,
                       account_id=account_id, bot_id=bot_id, group_id=group_id)
    current = await asyncio.wait_for(client.get_messages(group, ids=message.id), 15)
    if (current is None or classify(current, group_id, bot_id, sent_id)
            != ('vinculado', 'sin medio') or bytes(current) != prepared._snapshot):
        raise ValueError('Mensaje modificado o no disponible')
    print('Advertencia: el bot puede ejecutar acciones o enviar audio visible al grupo; no se descargará.')
    if select_observed([current]) != (0, coordinate):
        raise ValueError('Selección no confirmada')
    if input('¿Autoriza UNA pulsación, sin reintentos? Escriba SI: ').strip() != 'SI':
        raise ValueError('Pulsación no autorizada')
    me, bot, group = await asyncio.wait_for(verify_identity(
        client, account_id=account_id, bot_id=bot_id, confirmed_bot_id=bot_id,
        group_id=group_id, confirmed_group_id=group_id), 30)
    if not _identity(me, bot, group, account_id, bot_id, group_id):
        raise ValueError('Identidad inválida')
    current = await asyncio.wait_for(client.get_messages(group, ids=message.id), 15)
    if (current is None or classify(current, group_id, bot_id, sent_id)
            != ('vinculado', 'sin medio') or bytes(current) != prepared._snapshot):
        raise ValueError('Mensaje modificado o no disponible')
    data = _button(current, coordinate)
    peer = await asyncio.wait_for(client.get_input_entity(group), 15)
    request = GetBotCallbackAnswerRequest(peer=peer, msg_id=current.id, data=data)
    with _lock:
        if _consumed:
            raise ValueError('Intento ya consumido')
        _consumed = True
    # An error, timeout or cancellation is an uncertain outcome, never a retry.
    await asyncio.wait_for(client(request), 15)
