import os
import stat

import pytest

from telegram_windows_session import SessionStorageError, load_session, save_session


@pytest.mark.skipif(os.name != 'nt', reason='requiere DPAPI Windows')
def test_session_is_encrypted_and_cannot_be_overwritten(tmp_path):
    path = tmp_path / 'session.dat'
    save_session(path, 'session-secret-test')
    assert b'session-secret-test' not in path.read_bytes()
    assert load_session(path) == 'session-secret-test'
    with pytest.raises(SessionStorageError):
        save_session(path, 'other')
    assert load_session(path) == 'session-secret-test'


def test_session_path_can_be_overridden(monkeypatch, tmp_path):
    import telegram_setup_windows as setup
    monkeypatch.setenv('MUSIC_TELEGRAM_SESSION', str(tmp_path / 'session.dat'))
    assert setup.session_path() == tmp_path / 'session.dat'


@pytest.mark.skipif(os.name == 'nt', reason='requiere archivo Linux')
def test_linux_session_is_private_plain_file_roundtrip(tmp_path):
    path = tmp_path / 'session.dat'
    save_session(path, 'session-secret-test')
    assert path.read_bytes() == b'session-secret-test'
    assert stat.S_IMODE(path.stat().st_mode) == 0o600
    assert load_session(path) == 'session-secret-test'
    with pytest.raises(SessionStorageError):
        save_session(path, 'other')


def test_invalid_session_is_rejected(tmp_path):
    with pytest.raises(SessionStorageError):
        save_session(tmp_path / 'session.dat', '')


def test_invalid_file_is_rejected(tmp_path):
    path = tmp_path / 'session.dat'
    path.write_bytes(b'')
    with pytest.raises(SessionStorageError):
        load_session(path)


@pytest.mark.skipif(os.name != 'nt', reason='requiere DPAPI Windows')
def test_corrupted_ciphertext_is_rejected(tmp_path):
    path = tmp_path / 'session.dat'
    save_session(path, 'session-secret-test')
    data = bytearray(path.read_bytes())
    data[-1] ^= 1
    path.write_bytes(data)
    with pytest.raises(SessionStorageError):
        load_session(path)


@pytest.mark.skipif(os.name != 'nt', reason='requiere DPAPI Windows')
def test_temporary_file_is_cleaned_if_publish_fails(tmp_path, monkeypatch):
    import telegram_windows_session as storage

    def fail(*args):
        raise OSError('failure')

    monkeypatch.setattr(storage.os, 'link', fail)
    with pytest.raises(SessionStorageError):
        save_session(tmp_path / 'session.dat', 'session-secret-test')
    assert list(tmp_path.iterdir()) == []
