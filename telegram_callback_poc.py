"""Offline-only callback selection experiment; this module never contacts Telegram."""

from threading import Lock


MAX_LIFETIME_SECONDS = 300


def _integer(value, *, positive=False):
    return type(value) is int and (value > 0 if positive else value != 0)


class OfflineCallbackSelection:
    """Validate one fixture and allow at most one explicitly approved selection.

    All inputs, including IDs, timestamps and consent, are caller-supplied
    fixtures; they do not verify real identity or consent. No network adapter
    or session is provided. There is no shared anti-replay protection or
    trusted clock. Consequently select never releases callback bytes, even for
    otherwise valid fixtures. Expiration is observed only on select.
    """

    def __init__(self, fixture, *, expected_chat_id, expected_bot_id, now):
        self._lock = Lock()
        self._closed = False
        self._data = None
        self._expires = 0

        if (not _integer(expected_chat_id) or not _integer(expected_bot_id, positive=True)
                or type(now) is not int or type(fixture) is not dict
                or set(fixture) != {'chat_id', 'bot_id', 'is_bot', 'message_id',
                                    'issued_at', 'expires_at', 'row', 'column', 'data'}):
            return
        chat, bot = fixture['chat_id'], fixture['bot_id']
        issued, expires = fixture['issued_at'], fixture['expires_at']
        row, column, data = fixture['row'], fixture['column'], fixture['data']
        if (not _integer(chat) or chat != expected_chat_id
                or not _integer(bot, positive=True) or bot != expected_bot_id
                or fixture['is_bot'] is not True
                or not _integer(fixture['message_id'], positive=True)
                or type(issued) is not int or type(expires) is not int
                or not issued <= now < expires
                or expires - issued > MAX_LIFETIME_SECONDS
                or type(row) is not int or row < 0
                or type(column) is not int or column < 0
                or type(data) is not bytes or not 1 <= len(data) <= 64):
            return
        self._data = data
        self._expires = expires
        self._issued = issued
        self._message_id = fixture['message_id']
        self._row = row
        self._column = column

    def cancel(self):
        with self._lock:
            self._closed = True
            self._data = None

    def select(self, *, message_id, row, column, consent, now):
        """Fail closed: fixture approval cannot authorize callback release."""
        with self._lock:
            if self._data is not None and type(now) is int and now >= self._expires:
                self._data = None
                self._closed = True
                return None
            if (self._closed or self._data is None or consent is not True
                    or type(now) is not int or not self._issued <= now < self._expires
                    or not _integer(message_id, positive=True) or message_id != self._message_id
                    or type(row) is not int or row != self._row
                    or type(column) is not int or column != self._column):
                return None
            self._data = None
            self._closed = True
            return None
