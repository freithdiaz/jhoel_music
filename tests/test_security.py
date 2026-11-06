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

    def test_prepared_stream_reuses_resolved_url(self):
        video_id = "abcDEF123_-"
        server.STREAM_CACHE.pop(video_id, None)
        with patch.object(server.yt_dlp, "YoutubeDL") as downloader:
            downloader.return_value.__enter__.return_value.extract_info.return_value = {"url": "https://example.org/audio"}
            self.assertEqual(server.prepare_stream(video_id), {"status": "ready"})
            self.assertEqual(server.get_stream_url(video_id), "https://example.org/audio")
            self.assertEqual(downloader.return_value.__enter__.return_value.extract_info.call_count, 1)
        server.STREAM_CACHE.pop(video_id, None)
        with self.assertRaises(ValueError):
            server.get_stream_url("invalid/url")

    def test_rejected_cached_stream_is_refreshed_once(self):
        request = Request({"type": "http", "method": "GET", "path": "/stream_yt", "headers": [(b"range", b"bytes=0-10")]})
        rejected = urllib.error.HTTPError("https://example.org/old", 403, "Forbidden", {}, None)
        upstream = SimpleNamespace(status=206, headers={"Content-Type": "audio/mp4"})
        with patch.object(server, "get_stream_url", side_effect=["https://example.org/old", "https://example.org/new"]) as get_url, \
             patch.object(server, "invalidate_stream_url") as invalidate, \
             patch.object(server.urllib.request, "urlopen", side_effect=[rejected, upstream]) as open_url:
            response = server.stream_yt(request, "abcDEF123_-")
        self.assertEqual(response.status_code, 206)
        self.assertEqual(get_url.call_count, 2)
        invalidate.assert_called_once_with("abcDEF123_-", "https://example.org/old")
        self.assertEqual(open_url.call_count, 2)
        self.assertEqual(open_url.call_args[0][0].get_header("Range"), "bytes=0-10")

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
