import sqlite3
import subprocess
import sys
import tempfile
import unittest
from contextlib import closing
from pathlib import Path


class BackupTests(unittest.TestCase):
    def test_backup_is_consistent_and_does_not_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'source.db'
            target = Path(directory) / 'backup.db'
            with closing(sqlite3.connect(source)) as db:
                db.execute('CREATE TABLE example (value TEXT)')
                db.execute('INSERT INTO example VALUES (?)', ('music',))
                db.commit()
            command = [sys.executable, 'scripts/backup_db.py', str(source), str(target)]
            result = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            with closing(sqlite3.connect(target)) as db:
                self.assertEqual(db.execute('SELECT value FROM example').fetchone()[0], 'music')
            self.assertNotEqual(subprocess.run(command, capture_output=True).returncode, 0)
            with closing(sqlite3.connect(target)) as db:
                self.assertEqual(db.execute('SELECT value FROM example').fetchone()[0], 'music')


if __name__ == '__main__':
    unittest.main()
