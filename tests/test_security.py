import hashlib
import atexit
import os
import tempfile
import unittest
import urllib.error
from types import SimpleNamespace
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException
from starlette.requests import Request

_import_db = tempfile.TemporaryDirectory()
atexit.register(_import_db.cleanup)
os.environ["MUSIC_DB_PATH"] = str(Path(_import_db.name) / "import.db")
import server


class SecurityTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.original_db = server.DB_PATH
        server.DB_PATH = Path(self.tmp.name) / "test.db"
        server.init_db()

    def tearDown(self):
        server.DB_PATH = self.original_db
        self.tmp.cleanup()

    def test_passwords_are_salted_and_legacy_passwords_work(self):
        first = server.hash_password("password123")
        second = server.hash_password("password123")
        self.assertNotEqual(first, second)
        self.assertTrue(server.verify_password("password123", first))
        self.assertFalse(server.verify_password("incorrect", first))
        legacy = hashlib.sha256(b"password123").hexdigest()
        self.assertTrue(server.verify_password("password123", legacy))

    def test_node_runtime_is_enabled_for_search_and_stream(self):
        self.assertIn('node', server.YDL_FAST_SEARCH_OPTS['js_runtimes'])
        self.assertIn('node', server.YDL_STREAM_OPTS['js_runtimes'])

    def test_sessions_protect_user_data_and_can_be_revoked(self):
        alice = server.register(server.RegisterRequest(username="alice", password="password123"))
        server.register(server.RegisterRequest(username="bobby", password="password123"))
        auth = "Bearer " + alice["token"]
        server.sync_user_data(server.UserSyncRequest(username="alice", base_revision=0, playlists=[{"name": "test"}]), auth)
        self.assertEqual(server.get_user_data("alice", auth)["playlists"][0]["name"], "test")
        with self.assertRaises(HTTPException) as denied:
            server.get_user_data("bobby", auth)
        self.assertEqual(denied.exception.status_code, 403)
        with self.assertRaises(HTTPException):
            server.get_user_data("alice", None)
        server.logout(auth)
        with self.assertRaises(HTTPException):
            server.get_user_data("alice", auth)

    def test_radio_proxy_is_disabled(self):
        with self.assertRaises(HTTPException) as denied:
            server.stream_radio_proxy("http://127.0.0.1/")
        self.assertEqual(denied.exception.status_code, 403)

    def test_invalid_video_id_does_not_extract_youtube_audio(self):
        with patch.object(server.yt_dlp, "YoutubeDL") as downloader:
            with self.assertRaises(HTTPException):
                server.prepare_stream("abcDEF123_/")
            downloader.assert_not_called()

    def test_untrusted_youtube_stream_does_not_contact_upstream(self):
        request = Request({"type": "http", "method": "GET", "path": "/stream_yt", "headers": [(b"range", b"bytes=0-10")]})
        with patch.object(server, 'get_stream_url', return_value='https://evil.test/'), patch.object(server.urllib.request, "build_opener") as open_url:
            with self.assertRaises(HTTPException):
                server.stream_yt(request, "abcDEF123_-")
            open_url.assert_not_called()

    def test_stale_sync_cannot_overwrite_newer_data(self):
        user = server.register(server.RegisterRequest(username="alice", password="password123"))
        auth = "Bearer " + user["token"]
        result = server.sync_user_data(server.UserSyncRequest(username="alice", base_revision=0, playlists=[{"name": "new"}]), auth)
        self.assertEqual(result["revision"], 1)
        with self.assertRaises(HTTPException) as conflict:
            server.sync_user_data(server.UserSyncRequest(username="alice", base_revision=0, playlists=[{"name": "old"}]), auth)
        self.assertEqual(conflict.exception.status_code, 409)
        self.assertEqual(server.get_user_data("alice", auth)["playlists"][0]["name"], "new")
        self.assertEqual(server.login(server.LoginRequest(username="alice", password="password123"))["data"]["revision"], 1)


if __name__ == "__main__":
    unittest.main()
