import pytest

from telegram_import import MAX_AUDIO_BYTES, Candidate, approve_track
from telegram_transfer_offline import TransferRejected, approved_temporary_audio, temporary_audio


def test_temporary_audio_is_removed_after_use(tmp_path):
    with temporary_audio([b'ab', b'cd'], expected_size=4, directory=tmp_path) as path:
        assert path.read_bytes() == b'abcd'
    assert not path.exists()
    assert list(tmp_path.iterdir()) == []


@pytest.mark.parametrize('size', [0, -1, True, MAX_AUDIO_BYTES + 1])
def test_invalid_size_creates_no_files(tmp_path, size):
    with pytest.raises(TransferRejected):
        with temporary_audio([], expected_size=size, directory=tmp_path):
            pass
    assert list(tmp_path.iterdir()) == []


@pytest.mark.parametrize('chunks,size', [([b'abc'], 2), ([b'a'], 2), ([b'a', 'b'], 2)])
def test_invalid_transfer_is_cleaned(tmp_path, chunks, size):
    with pytest.raises(TransferRejected):
        with temporary_audio(chunks, expected_size=size, directory=tmp_path):
            pass
    assert list(tmp_path.iterdir()) == []


def test_consumer_error_cleans_temporary_file(tmp_path):
    with pytest.raises(RuntimeError):
        with temporary_audio([b'a'], expected_size=1, directory=tmp_path):
            raise RuntimeError('cancelled')
    assert list(tmp_path.iterdir()) == []


def test_source_error_cleans_temporary_file(tmp_path):
    def source():
        yield b'a'
        raise OSError('source failed')

    with pytest.raises(OSError):
        with temporary_audio(source(), expected_size=2, directory=tmp_path):
            pass
    assert list(tmp_path.iterdir()) == []


def test_approved_transfer_only_exposes_temporary_file(tmp_path):
    candidate = Candidate(7, 'file_123', 2, 'audio/mpeg')
    approval = approve_track(candidate, message_id=7, rights_confirmed=True,
                             now=100, expires_at=110)
    with approved_temporary_audio([b'ab'], candidate=candidate, approval=approval,
                                  clock=lambda: 105, directory=tmp_path) as path:
        assert path.read_bytes() == b'ab'
    assert list(tmp_path.iterdir()) == []


def test_rejected_approval_does_not_read_source(tmp_path):
    candidate = Candidate(7, 'file_123', 2, 'audio/mpeg')

    def source():
        raise AssertionError('no debe leer la fuente')
        yield b'ab'

    with pytest.raises(TransferRejected):
        with approved_temporary_audio(source(), candidate=candidate, approval=None,
                                      clock=lambda: 100, directory=tmp_path):
            pass
    assert list(tmp_path.iterdir()) == []


def test_approval_expiring_during_transfer_cleans_file(tmp_path):
    candidate = Candidate(7, 'file_123', 2, 'audio/mpeg')
    approval = approve_track(candidate, message_id=7, rights_confirmed=True,
                             now=100, expires_at=110)
    times = iter([105, 110])
    with pytest.raises(TransferRejected):
        with approved_temporary_audio([b'ab'], candidate=candidate, approval=approval,
                                      clock=lambda: next(times), directory=tmp_path):
            pytest.fail('no debe exponer el archivo')
    assert list(tmp_path.iterdir()) == []
