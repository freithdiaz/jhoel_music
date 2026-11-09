import pytest

from telegram_receipt_candidates import ReceiptObservationError, new_audio_candidates


def audio(update_id=5, *, group=-123, sender=456):
    return {'update_id': update_id, 'message': {'message_id': 7, 'chat': {'id': group, 'type': 'group'},
            'from': {'id': sender}, 'audio': {'file_id': 'file_123', 'file_size': 100, 'mime_type': 'audio/mpeg'}}}


def test_only_new_matching_audio_is_observed():
    before = [{'update_id': 1}]
    after = before + [audio(), audio(6, sender=999)]
    candidates = new_audio_candidates(before, after, group_id=-123, sender_id=456)
    assert len(candidates) == 1
    assert candidates[0].message_id == 7


def test_old_audio_is_not_treated_as_new():
    before = [audio()]
    assert new_audio_candidates(before, list(before), group_id=-123, sender_id=456) == []


@pytest.mark.parametrize('before,after', [
    ([{'update_id': 1}], []),
    ([{'update_id': 1}], [{'update_id': 1, 'changed': True}]),
    ([], [{'update_id': 1}, {'update_id': 1}]),
    ([], [{'update_id': True}]),
    ([], [{'update_id': i} for i in range(100)]),
])
def test_rejects_incomplete_or_changed_snapshots(before, after):
    with pytest.raises(ReceiptObservationError):
        new_audio_candidates(before, after, group_id=-123, sender_id=456)
