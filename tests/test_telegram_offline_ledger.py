from concurrent.futures import ProcessPoolExecutor
import sqlite3
import time
import uuid

import pytest

import telegram_offline_ledger as ledger


def attempt(args):
    path, nonce, issued, expires = args
    return ledger.reserve(path, nonce=nonce, account_id=1, chat_id=2, bot_id=3,
                          issued_at=issued, expires_at=expires)


def test_multiprocess_atomic_and_restart(tmp_path):
    path = str(tmp_path / 'ledger.sqlite')
    now = int(time.time())
    args = (path, str(uuid.uuid4()), now - 1, now + 120)
    with ProcessPoolExecutor(max_workers=4) as pool:
        outcomes = list(pool.map(attempt, [args] * 12))
    assert outcomes.count(True) == 1
    with ProcessPoolExecutor(max_workers=1) as restarted:
        assert list(restarted.map(attempt, [args])) == [False]
    with sqlite3.connect(path) as db:
        assert db.execute('SELECT count(*) FROM reservations').fetchone() == (1,)


def test_nonce_global_and_persistent_after_expiration(tmp_path, monkeypatch):
    monkeypatch.setattr(ledger.time, 'time', lambda: 100)
    path = str(tmp_path / 'ledger.sqlite')
    nonce = str(uuid.uuid4())
    assert attempt((path, nonce, 90, 110))
    monkeypatch.setattr(ledger.time, 'time', lambda: 110)
    assert not attempt((path, nonce, 90, 110))
    assert not ledger.reserve(path, nonce=nonce, account_id=9, chat_id=2, bot_id=3,
                              issued_at=110, expires_at=120)


@pytest.mark.parametrize('issued,expires,now', [(101, 110, 100), (90, 100, 100),
                                                   (0, 301, 100), (100, 100, 100)])
def test_invalid_windows(tmp_path, monkeypatch, issued, expires, now):
    monkeypatch.setattr(ledger.time, 'time', lambda: now)
    assert not attempt((str(tmp_path / 'ledger.sqlite'), str(uuid.uuid4()), issued, expires))


def test_invalid_inputs_and_storage_errors(tmp_path):
    now = int(time.time())
    path = str(tmp_path / 'ledger.sqlite')
    assert not attempt((path, 'credential-or-payload', now, now + 10))
    assert not ledger.reserve(path, nonce=str(uuid.uuid4()), account_id=True, chat_id=2,
                              bot_id=3, issued_at=now, expires_at=now + 10)
    assert not attempt((str(tmp_path / 'missing' / 'db'), str(uuid.uuid4()), now, now + 10))
    (tmp_path / 'corrupt').write_bytes(b'not a database')
    assert not attempt((str(tmp_path / 'corrupt'), str(uuid.uuid4()), now, now + 10))
    with pytest.raises(TypeError):
        ledger.reserve(path, nonce=str(uuid.uuid4()), account_id=1, chat_id=2,
                       bot_id=3, issued_at=now, expires_at=now + 10, credential='no')


@pytest.mark.parametrize('field,value', [
    ('nonce', str(uuid.uuid1())),
    ('nonce', str(uuid.uuid4()).upper()),
    ('nonce', None),
    ('account_id', 0),
    ('account_id', True),
    ('chat_id', -1),
    ('bot_id', 2**63),
    ('issued_at', False),
    ('expires_at', 2**63),
    ('expires_at', 401),
])
def test_invalid_inputs_never_open_storage(monkeypatch, field, value):
    def unexpected_connect(*args, **kwargs):
        pytest.fail('invalid inputs must not open storage')

    monkeypatch.setattr(ledger.sqlite3, 'connect', unexpected_connect)
    values = dict(nonce=str(uuid.uuid4()), account_id=1, chat_id=2, bot_id=3,
                  issued_at=100, expires_at=110)
    values[field] = value
    assert ledger.reserve('unused', **values) is False


def test_commit_failure_denies_and_rolls_back(monkeypatch):
    class Connection:
        rolled_back = False
        closed = False

        def execute(self, *args):
            pass

        def commit(self):
            raise sqlite3.OperationalError('ambiguous commit')

        def rollback(self):
            self.rolled_back = True

        def close(self):
            self.closed = True

    connection = Connection()
    monkeypatch.setattr(ledger.sqlite3, 'connect', lambda *args, **kwargs: connection)
    monkeypatch.setattr(ledger.time, 'time', lambda: 100)
    assert not attempt(('unused', str(uuid.uuid4()), 90, 110))
    assert connection.rolled_back and connection.closed
