"""Offline-only synthetic reservation ledger; never grants real authorization.

Only random UUIDv4 nonces and synthetic integer identities are accepted. Do not
pass credentials, secrets, payloads, or real identities. This API has no fields
for them and does not authenticate inputs. It does not verify filesystem ACLs,
real identity, or protect against deletion, restoration, or database rollback.
The local wall clock can be changed. Therefore this is not replay protection
adequate for real operations and must never enable a client or dispatch.

Each nonce remains reserved permanently, even after expiry. SQLite atomicity is
assumed on a functioning local filesystem; errors and ambiguous commits deny the
request. A denial after an ambiguous commit must not be treated as permission to
execute or as proof that the nonce was not recorded.
"""

import sqlite3
import time
import uuid

MAX_LIFETIME_SECONDS = 300
_MAX_INTEGER = 2**63 - 1


def _integer(value, minimum=0):
    return type(value) is int and minimum <= value <= _MAX_INTEGER


def _nonce(value):
    if type(value) is not str:
        return False
    try:
        parsed = uuid.UUID(value)
        return str(parsed) == value and parsed.version == 4 and parsed.variant == uuid.RFC_4122
    except (ValueError, AttributeError):
        return False


def reserve(path, *, nonce, account_id, chat_id, bot_id, issued_at, expires_at):
    """Atomically reserve a synthetic nonce once; False includes all failures.

    Timestamps are Unix seconds; the window is checked against the local clock
    after obtaining the write lock. Identity numbers are labels, not proof of
    identity. No arbitrary metadata, payload, or credentials are accepted.
    """
    if not (_nonce(nonce) and _integer(account_id, 1) and _integer(chat_id, 1)
            and _integer(bot_id, 1) and _integer(issued_at) and _integer(expires_at)
            and 0 < expires_at - issued_at <= MAX_LIFETIME_SECONDS):
        return False
    connection = None
    try:
        connection = sqlite3.connect(path, timeout=5, isolation_level=None)
        connection.execute('BEGIN IMMEDIATE')
        connection.execute('''CREATE TABLE IF NOT EXISTS reservations (
            nonce TEXT PRIMARY KEY NOT NULL,
            account_id INTEGER NOT NULL,
            chat_id INTEGER NOT NULL,
            bot_id INTEGER NOT NULL,
            issued_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL
        )''')
        now = time.time()
        if not issued_at <= now < expires_at:
            connection.rollback()
            return False
        connection.execute('INSERT INTO reservations VALUES (?, ?, ?, ?, ?, ?)',
                           (nonce, account_id, chat_id, bot_id, issued_at, expires_at))
        connection.commit()
        return True
    except (sqlite3.Error, OSError, ValueError, TypeError, OverflowError):
        if connection is not None:
            try:
                connection.rollback()
            except sqlite3.Error:
                pass
        return False
    finally:
        if connection is not None:
            try:
                connection.close()
            except sqlite3.Error:
                pass
