from telegram_import import (MAX_AUDIO_BYTES, approval_matches, approve_track,
                             candidate_from_update, has_track_consent)


def update():
    return {'message': {'message_id': 7, 'chat': {'id': -123, 'type': 'supergroup'},
                        'from': {'id': 456}, 'audio': {'file_id': 'file_123',
                        'file_size': MAX_AUDIO_BYTES, 'mime_type': 'audio/mpeg'}}}


def parse(value):
    return candidate_from_update(value, group_id=-123, sender_id=456)


def test_candidate_and_explicit_per_track_consent():
    candidate = parse(update())
    assert candidate is not None
    assert has_track_consent(candidate, message_id=7, rights_confirmed=True)
    assert not has_track_consent(candidate, message_id=8, rights_confirmed=True)
    assert not has_track_consent(candidate, message_id=7, rights_confirmed=1)


def test_rejects_wrong_identity_and_message_types():
    for section, key, value in [('chat', 'id', -124), ('chat', 'type', 'private'),
                                ('from', 'id', 457), ('from', 'id', True)]:
        data = update()
        data['message'][section][key] = value
        assert parse(data) is None
    data = update()
    data['edited_message'] = data.pop('message')
    assert parse(data) is None
    assert candidate_from_update(update(), group_id=True, sender_id=456) is None


def test_rejects_untrusted_audio_metadata():
    for key, value in [('file_size', MAX_AUDIO_BYTES + 1), ('file_size', 0),
                       ('file_size', True), ('mime_type', 'video/mp4'),
                       ('file_id', '../secret'), ('file_id', '')]:
        data = update()
        data['message']['audio'][key] = value
        assert parse(data) is None
    data = update()
    data['message']['document'] = data['message'].pop('audio')
    assert parse(data) is None


def test_approval_is_bound_to_exact_candidate_and_expires():
    candidate = parse(update())
    approval = approve_track(candidate, message_id=7, rights_confirmed=True,
                             now=100, expires_at=160)
    assert approval_matches(approval, candidate, now=159)
    assert not approval_matches(approval, candidate, now=99)
    assert not approval_matches(approval, candidate, now=160)
    data = update()
    data['message']['audio']['file_id'] = 'other_file'
    assert not approval_matches(approval, parse(data), now=101)


def test_approval_rejects_invalid_confirmation_and_time():
    candidate = parse(update())
    for now, expiry in [(100, 100), (100, 401), (True, 101), (100, float('nan'))]:
        assert approve_track(candidate, message_id=7, rights_confirmed=True,
                             now=now, expires_at=expiry) is None
    assert approve_track(candidate, message_id=7, rights_confirmed=1,
                         now=100, expires_at=101) is None
