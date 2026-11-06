"""Offline-only model of the exceptional, process-local third-party PoC.

Fixtures do not authenticate Telegram identities, messages, consent or time.
No session, network adapter, callback payload release or dispatch is provided.
Another process or restart has independent state. Not suitable for production.
"""

from copy import deepcopy
from hmac import compare_digest
from threading import Lock

from telegram_third_party_offline import validate_search, validate_selection


class OfflineProcessModel:
    """One in-memory simulated attempt, shared by callers of this instance."""

    def __init__(self):
        self._lock = Lock()
        self._state = 'new'
        self._search = self._result = self._approval = self._button = None

    def start_search(self, search, *, account_id, chat_id, confirmed_chat_id,
                     bot_id, username, now):
        """Record simulated search consent, never send a search."""
        with self._lock:
            if (self._state != 'new' or type(chat_id) is not int or chat_id >= 0
                    or type(confirmed_chat_id) is not int or confirmed_chat_id != chat_id
                    or type(username) is not str or username.lower() != 'vkmusbot'
                    or not validate_search(search, account_id=account_id, chat_id=chat_id,
                                           bot_id=bot_id, now=now)):
                return False
            self._identity = (account_id, chat_id, bot_id)
            self._search = deepcopy(search)
            self._state = 'searched'
            return True

    def approve_selection(self, result, approval, *, button, now):
        """Record separate synthetic selection and exposure consent."""
        with self._lock:
            if self._state != 'searched' or type(button) is not bytes or not 1 <= len(button) <= 64:
                return False
            account_id, chat_id, bot_id = self._identity
            if not validate_selection(self._search, result, approval, account_id=account_id,
                                      chat_id=chat_id, bot_id=bot_id, now=now):
                return False
            self._result, self._approval = deepcopy(result), deepcopy(approval)
            self._button = button
            self._state = 'approved'
            return True

    def cancel(self):
        """Revoke the local approval; does not revoke any Telegram session."""
        with self._lock:
            self._state = 'cancelled'
            self._search = self._result = self._approval = self._button = None

    def simulate_attempt(self, current_result, *, current_button, now):
        """Revalidate a fixture and consume before a simulated attempt; no I/O."""
        with self._lock:
            if self._state != 'approved':
                return False
            account_id, chat_id, bot_id = self._identity
            if (type(current_result) is not dict or current_result != self._result
                    or type(current_button) is not bytes
                    or not compare_digest(current_button, self._button)
                    or not validate_selection(self._search, current_result, self._approval,
                                              account_id=account_id, chat_id=chat_id,
                                              bot_id=bot_id, now=now)):
                return False
            self._state = 'consumed'
            self._search = self._result = self._approval = self._button = None
            return True


# This singleton models one attempt per interpreter, not a security boundary.
process_model = OfflineProcessModel()
