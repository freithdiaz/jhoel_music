import io
import json
import os
import unittest
import urllib.error
import tempfile
from pathlib import Path
from unittest.mock import patch

from dotenv import load_dotenv
from fastapi import HTTPException
import server
from starlette.requests import Request


class YoutubeTests(unittest.TestCase):
    def test_env_file_and_process_precedence(self):
        with tempfile.TemporaryDirectory() as directory:
            env_file = Path(directory) / ".env"
            env_file.write_text('YOUTUBE_API_KEY="file-key"\n', encoding="utf-8")
            with patch.dict(os.environ, {}, clear=True):
                load_dotenv(env_file, override=False, encoding="utf-8-sig")
                self.assertEqual(os.environ.get("YOUTUBE_API_KEY"), "file-key")
                os.environ["YOUTUBE_API_KEY"] = "environment-key"
                load_dotenv(env_file, override=False, encoding="utf-8-sig")
                self.assertEqual(os.environ.get("YOUTUBE_API_KEY"), "environment-key")

    @patch.dict(os.environ, {"YOUTUBE_API_KEY": ""})
    def test_missing_key(self):
        with self.assertRaises(HTTPException) as error:
            server.youtube_search("music")
        self.assertEqual(error.exception.status_code, 503)

    @patch.dict(os.environ, {"YOUTUBE_API_KEY": "secret"})
    @patch("server.urllib.request.urlopen")
    def test_official_results_are_not_audio_urls(self, urlopen):
        body = {"items": [{"id": {"videoId": "abcdefghijk"}, "snippet": {"title": "Song", "channelTitle": "Artist"}}, {"id": {"videoId": "bad/id"}}]}
        urlopen.return_value.__enter__.return_value = io.BytesIO(json.dumps(body).encode())
        result = server.youtube_search("music")
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["sourceType"], "youtube")
        self.assertEqual(result[0]["audioUrl"], "")
        request = urlopen.call_args.args[0]
        self.assertIn("www.googleapis.com/youtube/v3/search", request.full_url)
        self.assertNotIn("secret", request.full_url)
        self.assertEqual(request.get_header("X-goog-api-key"), "secret")

    @patch.dict(os.environ, {"YOUTUBE_API_KEY": "secret"})
    @patch("server.urllib.request.urlopen")
    def test_quota_error_does_not_expose_key(self, urlopen):
        urlopen.side_effect = urllib.error.HTTPError("https://example.com/?key=secret", 403, "Forbidden", {}, io.BytesIO())
        with self.assertRaises(HTTPException) as error:
            server.youtube_search("music")
        self.assertEqual(error.exception.status_code, 503)
        self.assertNotIn("secret", error.exception.detail)

    def test_stream_extraction_and_cache(self):
        server.STREAM_CACHE.clear()
        with patch.object(server.yt_dlp, "YoutubeDL") as downloader:
            downloader.return_value.__enter__.return_value.extract_info.return_value = {"url": "https://r1.googlevideo.com/audio?sig=secret"}
            self.assertEqual(server.get_stream_url("abcdefghijk"), "https://r1.googlevideo.com/audio?sig=secret")
            server.get_stream_url("abcdefghijk")
            downloader.assert_called_once()

    @unittest.skip('Search remains disabled until isolated extraction is validated')
    def test_search_filters_ids_and_produces_local_stream_urls(self):
        with patch.object(server.yt_dlp, "YoutubeDL") as downloader:
            downloader.return_value.__enter__.return_value.extract_info.return_value = {"entries": [{"id": "abcdefghijk", "title": "Song"}, {"id": "bad/id"}]}
            result = server.search_online("music", 25)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["audioUrl"], "/stream_yt?v=abcdefghijk")

    def test_upstream_and_redirect_validation(self):
        for url in ('http://googlevideo.com/a', 'https://googlevideo.com.evil.test/a', 'https://youtube.com@evil.test/a', 'https://127.0.0.1/a', 'https://youtube.com:444/a'):
            with self.subTest(url=url), self.assertRaises(ValueError):
                server.validate_upstream_url(url)
        handler = server.SafeStreamRedirect()
        with self.assertRaises(ValueError):
            handler.redirect_request(None, None, 302, '', {}, 'https://evil.test/')

    def test_error_does_not_expose_extractor_secrets(self):
        with patch.object(server.yt_dlp, 'YoutubeDL', side_effect=ValueError('secret')):
            with self.assertRaises(HTTPException) as error:
                server.search_online('music', 25)
        self.assertNotIn('secret', error.exception.detail)

    def test_stream_and_prepare_fail_closed_without_extraction_or_connection(self):
        request = Request({'type': 'http', 'method': 'GET', 'path': '/stream_yt', 'headers': [(b'range', b'bytes=0-10')]})
        with patch.object(server, 'get_stream_url') as extract, patch.object(server.urllib.request, 'build_opener') as build:
            for operation in (lambda: server.stream_yt(request, 'abcdefghijk'), lambda: server.prepare_stream('abcdefghijk')):
                with self.assertRaises(HTTPException) as error:
                    operation()
                self.assertEqual(error.exception.status_code, 503)
                self.assertIn('deshabilitado', error.exception.detail)
            extract.assert_not_called()
            build.assert_not_called()

    def test_range_validation(self):
        for value in ('bytes=0-10', 'bytes=5-', 'bytes=-50'):
            self.assertTrue(server.validate_range_header(value), value)
        for value in ('bytes=-', 'bytes=-0', 'bytes=10-1', 'bytes=0-1,3-4', 'bytes=0-1\r\nX: y', 'bytes=12345678901234567890-', 'items=0-1'):
            self.assertFalse(server.validate_range_header(value), value)
            request = Request({'type': 'http', 'method': 'GET', 'path': '/stream_yt', 'headers': [(b'range', value.encode())]})
            with self.assertRaises(HTTPException) as error:
                server.stream_yt(request, 'abcdefghijk')
            self.assertEqual(error.exception.status_code, 416)

    def test_search_concurrency_limit(self):
        for _ in range(6):
            self.assertTrue(server.SEARCH_SLOTS.acquire(blocking=False))
        try:
            with patch.object(server.yt_dlp, 'YoutubeDL') as downloader:
                with self.assertRaises(HTTPException) as error:
                    server.search_online('music', 25)
                self.assertEqual(error.exception.status_code, 503)
                downloader.assert_not_called()
        finally:
            for _ in range(6):
                server.SEARCH_SLOTS.release()

    def test_protected_stream_is_rejected(self):
        server.STREAM_CACHE.clear()
        with patch.object(server.yt_dlp, 'YoutubeDL') as downloader:
            downloader.return_value.__enter__.return_value.extract_info.return_value = {'url': 'https://r1.googlevideo.com/a', 'has_drm': True}
            with self.assertRaises(ValueError):
                server.get_stream_url('abcdefghijk')


if __name__ == "__main__":
    unittest.main()
