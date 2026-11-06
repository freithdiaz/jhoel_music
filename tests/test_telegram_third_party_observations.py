from datetime import datetime, timezone

import pytest

pytest.importorskip('telethon')
from telethon.tl.types import Message, MessageReplyHeader, PeerChannel, PeerChat, PeerUser

import telegram_third_party_observations as adapter


def message(id=11, **changes):
    fields = dict(id=id, peer_id=PeerChat(3), from_id=PeerUser(2),
                  date=datetime.fromtimestamp(101, timezone.utc), message='private',
                  reply_to=MessageReplyHeader(reply_to_msg_id=10))
    fields.update(changes)
    return Message(**fields)


def call(first, last):
    command = message(id=10, date=datetime.fromtimestamp(100, timezone.utc))
    return adapter.correlate_snapshots(command, first, last, group_id=-3, bot_id=2,
                                       window_end=110, now=110)


def test_real_telethon_messages_cannot_prove_complete_window(monkeypatch):
    calls = []
    monkeypatch.setattr(adapter, 'correlate', lambda *args, **kw: calls.append((args, kw)))
    assert call([message()], [message()]) is None
    args, kwargs = calls[0]
    assert kwargs['observation_complete'] is False
    assert args[1][0][0]['reply_to_chat_id'] == -3
    assert args[1][0][0]['reply_to_message_id'] == 10
    assert args[1][0][0] == args[1][0][1]
    assert 'private' not in repr((args, kwargs))


def test_reply_peer_edits_and_full_content_are_captured():
    original = adapter._snapshot(message(), -3, 2)
    cross = adapter._snapshot(message(reply_to=MessageReplyHeader(
        reply_to_msg_id=10, reply_to_peer_id=PeerChannel(7))), -3, 2)
    edited = adapter._snapshot(message(edit_date=datetime.fromtimestamp(102, timezone.utc)), -3, 2)
    changed = adapter._snapshot(message(message='different'), -3, 2)
    assert cross['reply_to_chat_id'] == -1000000000007
    assert edited['edited'] is True
    assert changed['digest'] != original['digest']
    assert call([message()], [message(message='different')]) is None


def test_multiple_missing_duplicate_or_untrusted_snapshots_fail_closed():
    assert call([message(), message(id=12)], [message(), message(id=12)]) is None
    assert call([message()], []) is None
    assert call([message(), message()], [message()]) is None
    assert call([object()], [message()]) is None
    assert call([message(peer_id=PeerChat(4))], [message()]) is None
    assert call([message()] * (adapter.MAX_MESSAGES + 1), []) is None


def test_bad_serialization_and_no_network_fail_closed(monkeypatch, capsys):
    def fail(_):
        raise ValueError('private exception')
    monkeypatch.setattr(Message, '__bytes__', fail)
    assert call([message()], [message()]) is None
    assert capsys.readouterr() == ('', '')
