"""Offline Telethon snapshot adapter. This module never performs I/O.

History snapshots cannot prove that messages were not deleted or edited between
reads, or that updates were not missed. Consequently this adapter never marks
the observation window complete and cannot authorize a correlation.
"""

import hashlib
from datetime import timezone

from telegram_third_party_correlation import correlate


MAX_MESSAGES = 256
MAX_SERIALIZED_BYTES = 1024 * 1024


def _peer_id(peer):
    from telethon.tl.types import PeerChannel, PeerChat, PeerUser

    if type(peer) is PeerUser and type(peer.user_id) is int and peer.user_id > 0:
        return peer.user_id
    if type(peer) is PeerChat and type(peer.chat_id) is int and peer.chat_id > 0:
        return -peer.chat_id
    if type(peer) is PeerChannel and type(peer.channel_id) is int and peer.channel_id > 0:
        return -1000000000000 - peer.channel_id
    return None


def _timestamp(value):
    if value is None or value.tzinfo is None or value.utcoffset() is None:
        return None
    utc = value.astimezone(timezone.utc)
    if utc.microsecond:
        return None
    return int(utc.timestamp())


def _snapshot(message, group_id, bot_id):
    from telethon.tl.types import Message, MessageReplyHeader, PeerUser

    if type(message) is not Message or _peer_id(message.peer_id) != group_id:
        raise ValueError
    if type(message.id) is not int or message.id <= 0:
        raise ValueError
    if type(message.from_id) is not PeerUser or _peer_id(message.from_id) is None:
        raise ValueError
    if message.from_id.user_id != bot_id:
        return None
    reply = message.reply_to
    if type(reply) is not MessageReplyHeader:
        reply_chat, reply_id = None, None
    else:
        reply_chat = group_id if reply.reply_to_peer_id is None else _peer_id(reply.reply_to_peer_id)
        reply_id = reply.reply_to_msg_id
        # Scheduled replies and external origins do not establish an exact reply.
        if reply.reply_to_scheduled or reply.reply_from is not None:
            reply_chat, reply_id = None, None
    payload = bytes(message)
    if len(payload) > MAX_SERIALIZED_BYTES:
        raise ValueError
    return dict(chat_id=group_id, sender_id=bot_id, is_bot=True,
                message_id=message.id, reply_to_chat_id=reply_chat,
                reply_to_message_id=reply_id, date=_timestamp(message.date),
                edited=message.edit_date is not None or bool(message.edit_hide),
                digest=hashlib.sha256(payload).hexdigest())


def correlate_snapshots(command, first, last, *, group_id, bot_id, window_end, now):
    """Inspect two bounded lists of raw Telethon messages; return None on uncertainty.

    No content, markup, digest, or exception is returned or logged. Both lists
    must represent all messages, not merely presumed replies. Even valid lists
    are insufficient evidence of a complete window, so the result is None.
    """
    try:
        if (type(group_id) is not int or group_id >= 0
                or type(bot_id) is not int or bot_id <= 0
                or type(first) is not list or type(last) is not list
                or len(first) > MAX_MESSAGES or len(last) > MAX_MESSAGES):
            return None
        from telethon.tl.types import Message
        if type(command) is not Message or _peer_id(command.peer_id) != group_id:
            return None
        command_data = dict(chat_id=group_id, message_id=command.id,
                            date=_timestamp(command.date),
                            edited=command.edit_date is not None or bool(command.edit_hide))
        windows = []
        for messages in (first, last):
            seen = set()
            bots = {}
            for message in messages:
                snapshot = _snapshot(message, group_id, bot_id)
                if message.id in seen:
                    return None
                seen.add(message.id)
                if snapshot is not None:
                    bots[message.id] = snapshot
            windows.append(bots)
        if windows[0].keys() != windows[1].keys():
            return None
        observations = [(snapshot, windows[1][key])
                        for key, snapshot in windows[0].items()]
        return correlate(command_data, observations, group_id=group_id, bot_id=bot_id,
                         window_end=window_end, now=now, observation_complete=False)
    except Exception:
        return None
