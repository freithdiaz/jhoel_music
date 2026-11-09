import os
import subprocess
import sys

import pytest

from telegram_windows_lock import exclusive_account_lock


@pytest.mark.skipif(os.name != 'nt', reason='requiere bloqueo Windows')
def test_lock_excludes_other_process_and_releases(tmp_path):
    path = tmp_path / 'account.lock'
    code = (
        'import sys\n'
        'from telegram_windows_lock import exclusive_account_lock, AccountBusy\n'
        'try:\n'
        '  with exclusive_account_lock(sys.argv[1]): pass\n'
        'except AccountBusy: sys.exit(7)\n'
    )
    with exclusive_account_lock(path):
        denied = subprocess.run([sys.executable, '-c', code, str(path)], timeout=10)
        assert denied.returncode == 7
    allowed = subprocess.run([sys.executable, '-c', code, str(path)], timeout=10)
    assert allowed.returncode == 0
    assert path.exists()


@pytest.mark.skipif(os.name != 'nt', reason='requiere bloqueo Windows')
def test_exception_releases_lock(tmp_path):
    path = tmp_path / 'account.lock'
    with pytest.raises(ValueError):
        with exclusive_account_lock(path):
            raise ValueError('failed')
    with exclusive_account_lock(path):
        pass


@pytest.mark.skipif(os.name == 'nt', reason='requiere flock Linux')
def test_linux_lock_excludes_other_process_and_releases(tmp_path):
    path = tmp_path / 'account.lock'
    code = (
        'import sys\n'
        'from telegram_windows_lock import exclusive_account_lock, AccountBusy\n'
        'try:\n'
        '  with exclusive_account_lock(sys.argv[1]): pass\n'
        'except AccountBusy: sys.exit(7)\n'
    )
    with exclusive_account_lock(path):
        denied = subprocess.run([sys.executable, '-c', code, str(path)], timeout=10)
        assert denied.returncode == 7
    allowed = subprocess.run([sys.executable, '-c', code, str(path)], timeout=10)
    assert allowed.returncode == 0
    assert path.exists()


@pytest.mark.skipif(os.name == 'nt', reason='requiere flock Linux')
def test_linux_exception_releases_lock(tmp_path):
    path = tmp_path / 'account.lock'
    with pytest.raises(ValueError):
        with exclusive_account_lock(path):
            raise ValueError('failed')
    with exclusive_account_lock(path):
        pass
