import sqlite3

import pytest

import telegram_pilot as pilot


def create_database(path):
    with sqlite3.connect(path) as db:
        db.execute('CREATE TABLE users (username TEXT)')
        db.execute('INSERT INTO users VALUES (?)', ('jhoel',))


def test_pilot_copies_database_and_reuses_key(tmp_path, monkeypatch):
    root = tmp_path / 'project'
    root.mkdir()
    original = root / 'diaz_music_users.db'
    create_database(original)
    private = tmp_path / 'private'
    private.mkdir()
    session = private / 'telegram-session.dpapi'
    session.write_bytes(b'encrypted')
    monkeypatch.setattr(pilot, 'ROOT', root)
    monkeypatch.setattr(pilot, 'session_path', lambda: session)
    monkeypatch.setattr(pilot, 'save_session', lambda path, key: path.write_text(key, encoding='ascii'))
    monkeypatch.setattr(pilot, 'load_session', lambda path: path.read_text(encoding='ascii'))
    first = pilot.prepare_pilot('jhoel')
    second = pilot.prepare_pilot('jhoel')
    assert first['MUSIC_TELEGRAM_BRIDGE_KEY'] == second['MUSIC_TELEGRAM_BRIDGE_KEY']
    assert first['MUSIC_TELEGRAM_OPERATOR'] == 'jhoel'
    with sqlite3.connect(first['MUSIC_TELEGRAM_PILOT_DATA'] + '/diaz_music_users.db') as db:
        db.execute('DELETE FROM users')
    with sqlite3.connect(original) as db:
        assert db.execute('SELECT username FROM users').fetchone() == ('jhoel',)


def test_unknown_operator_does_not_create_pilot(tmp_path, monkeypatch):
    root = tmp_path / 'project'
    root.mkdir()
    create_database(root / 'diaz_music_users.db')
    private = tmp_path / 'private'
    private.mkdir()
    session = private / 'telegram-session.dpapi'
    session.write_bytes(b'encrypted')
    monkeypatch.setattr(pilot, 'ROOT', root)
    monkeypatch.setattr(pilot, 'session_path', lambda: session)
    with pytest.raises(ValueError):
        pilot.prepare_pilot('otro')
    assert not (private / 'pilot').exists()
