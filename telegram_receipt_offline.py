"""Pure synthetic receipt checks; no identity, source or licence is verified.

Inputs are untrusted claims, not evidence. There is no network, media handling,
filesystem access, trusted clock, replay protection or permission to download.
"""

MAX_MEDIA_BYTES = 25 * 1024 * 1024


def validate_receipt_claims(claims, *, account_id, chat_id, bot_id, message_id):
    """Check fixture consistency only; True never authorizes a real receipt."""
    if type(claims) is not dict or set(claims) != {
            'account_id', 'chat_id', 'bot_id', 'message_id', 'authenticated',
            'source_confirmed', 'licence_confirmed', 'receipt_consent',
            'declared_bytes'}:
        return False
    ids = (account_id, bot_id, message_id)
    if (any(type(value) is not int or value <= 0 for value in ids)
            or type(chat_id) is not int or chat_id >= 0):
        return False
    for name, expected in (('account_id', account_id), ('chat_id', chat_id),
                           ('bot_id', bot_id), ('message_id', message_id)):
        if type(claims[name]) is not int or claims[name] != expected:
            return False
    return (all(claims[name] is True for name in (
                'authenticated', 'source_confirmed', 'licence_confirmed',
                'receipt_consent'))
            and type(claims['declared_bytes']) is int
            and 0 < claims['declared_bytes'] <= MAX_MEDIA_BYTES)


def count_chunk(received, chunk_size, declared_bytes):
    """Model byte accounting only, returning None on any invalid or excess count.

    A real receiver must enforce the cap while streaming, independently of the
    declared size, and handle truncation and cleanup. This function sees no data.
    """
    if (any(type(value) is not int for value in (received, chunk_size, declared_bytes))
            or not 0 < declared_bytes <= MAX_MEDIA_BYTES
            or received < 0 or chunk_size <= 0
            or received > declared_bytes
            or chunk_size > declared_bytes - received):
        return None
    return received + chunk_size


def receipt_complete(received, declared_bytes):
    """Model exact-size completion, without asserting content integrity."""
    return (type(received) is int and type(declared_bytes) is int
            and 0 < declared_bytes <= MAX_MEDIA_BYTES and received == declared_bytes)


def receive(*args, **kwargs):
    """Always refuse real receipt/download, even when synthetic checks pass."""
    return False
