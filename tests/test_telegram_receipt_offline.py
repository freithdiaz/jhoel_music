import pytest

from telegram_receipt_offline import (MAX_MEDIA_BYTES, count_chunk, receive,
                                      receipt_complete, validate_receipt_claims)


def claims():
    return dict(account_id=1, chat_id=-2, bot_id=3, message_id=4,
                authenticated=True, source_confirmed=True, licence_confirmed=True,
                receipt_consent=True, declared_bytes=10)


def check(value):
    return validate_receipt_claims(value, account_id=1, chat_id=-2,
                                   bot_id=3, message_id=4)


def test_consistent_claims_are_not_permission():
    value = claims()
    assert check(value)
    assert receive(value) is False
    assert receive() is False


@pytest.mark.parametrize('field,value', [
    ('account_id', True), ('chat_id', -3), ('bot_id', 4), ('message_id', 5),
    ('authenticated', 1), ('source_confirmed', False), ('licence_confirmed', False),
    ('receipt_consent', False), ('declared_bytes', True), ('declared_bytes', 0),
    ('declared_bytes', MAX_MEDIA_BYTES + 1),
])
def test_refuses_inconsistent_claims(field, value):
    fixture = claims()
    fixture[field] = value
    assert not check(fixture)
    assert not receive(fixture)


def test_exact_shape_and_expected_identity_types():
    fixture = claims()
    fixture['extra'] = 'untrusted'
    assert not check(fixture)
    del fixture['extra']
    del fixture['licence_confirmed']
    assert not check(fixture)
    assert not validate_receipt_claims(claims(), account_id=True, chat_id=-2,
                                       bot_id=3, message_id=4)


def test_byte_boundaries_and_truncation():
    assert count_chunk(0, 4, 10) == 4
    assert count_chunk(4, 6, 10) == 10
    assert receipt_complete(10, 10)
    assert not receipt_complete(9, 10)
    assert count_chunk(4, 7, 10) is None
    assert count_chunk(0, MAX_MEDIA_BYTES, MAX_MEDIA_BYTES) == MAX_MEDIA_BYTES
    assert count_chunk(0, MAX_MEDIA_BYTES + 1, MAX_MEDIA_BYTES + 1) is None


@pytest.mark.parametrize('received,chunk,declared', [
    (True, 1, 10), (0, True, 10), (0, 1, True), (-1, 1, 10),
    (0, 0, 10), (0, -1, 10), (11, 1, 10), (0, 1, 0),
])
def test_invalid_counts_fail_closed(received, chunk, declared):
    assert count_chunk(received, chunk, declared) is None
    assert not receive(received, chunk, declared)
