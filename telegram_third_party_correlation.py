"""Pure, offline correlation contract; it neither authenticates nor dispatches.

The caller must collect a complete, trustworthy observation window and two
independently captured snapshots of the candidate, including a digest of all
relevant content and markup. Missing or uncertain observations must not be
represented as complete. No payload is processed or logged here.
"""

import re


MAX_WINDOW_SECONDS = 300
_DIGEST = re.compile(r'[0-9a-f]{64}\Z')
_FIELDS = {'chat_id', 'sender_id', 'is_bot', 'message_id', 'reply_to_chat_id',
           'reply_to_message_id', 'date', 'edited', 'digest'}


def _positive(value):
    return type(value) is int and value > 0


def correlate(command, observations, *, group_id, bot_id, window_end, now,
              observation_complete):
    """Return a correlated message ID or None; never authorize an action.

    Observations must cover the whole window, not just replies presumed to
    match. Exactly one bot message is allowed, with two identical snapshots.
    Times are integer seconds from one trusted clock; equal timestamps do not
    establish that the response was later than the command.
    """
    if (type(group_id) is not int or group_id >= 0 or not _positive(bot_id)
            or type(command) is not dict
            or set(command) != {'chat_id', 'message_id', 'date', 'edited'}
            or type(command['chat_id']) is not int or command['chat_id'] != group_id
            or not _positive(command['message_id'])
            or type(command['date']) is not int or command['date'] < 0
            or command['edited'] is not False
            or type(window_end) is not int or type(now) is not int
            or not 0 < window_end - command['date'] <= MAX_WINDOW_SECONDS
            or now < window_end or observation_complete is not True
            or type(observations) is not list or len(observations) != 1):
        return None

    snapshots = observations[0]
    if type(snapshots) is not tuple or len(snapshots) != 2:
        return None
    first, last = snapshots
    if (type(first) is not dict or type(last) is not dict
            or set(first) != _FIELDS or set(last) != _FIELDS
            or first != last
            or any(type(first[key]) is not type(last[key]) for key in _FIELDS)):
        return None
    if (type(first['chat_id']) is not int or first['chat_id'] != group_id
            or not _positive(first['sender_id']) or first['sender_id'] != bot_id
            or first['is_bot'] is not True or not _positive(first['message_id'])
            or first['message_id'] <= command['message_id']
            or type(first['reply_to_chat_id']) is not int
            or first['reply_to_chat_id'] != group_id
            or not _positive(first['reply_to_message_id'])
            or first['reply_to_message_id'] != command['message_id']
            or type(first['date']) is not int
            or not command['date'] < first['date'] < window_end
            or first['edited'] is not False
            or type(first['digest']) is not str
            or _DIGEST.fullmatch(first['digest']) is None):
        return None
    return first['message_id']
