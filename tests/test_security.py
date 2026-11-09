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

    def test_telegram_status_requires_enabled_authenticated_operator(self):
        alice = server.register(server.RegisterRequest(username='alice', password='password123'))
        bob = server.register(server.RegisterRequest(username='bobby', password='password123'))
        alice_auth = 'Bearer ' + alice['token']
        bob_auth = 'Bearer ' + bob['token']
        with patch.dict(os.environ, {'MUSIC_TELEGRAM_ENABLED': '0', 'MUSIC_TELEGRAM_OPERATOR': 'alice'}):
            with self.assertRaises(HTTPException) as disabled:
                server.telegram_status(alice_auth)
            self.assertEqual(disabled.exception.status_code, 403)
        with patch.dict(os.environ, {'MUSIC_TELEGRAM_ENABLED': '1', 'MUSIC_TELEGRAM_OPERATOR': 'alice'}):
            with self.assertRaises(HTTPException) as anonymous:
                server.telegram_status(None)
            self.assertEqual(anonymous.exception.status_code, 401)
            with self.assertRaises(HTTPException) as other:
                server.telegram_status(bob_auth)
            self.assertEqual(other.exception.status_code, 403)
            self.assertEqual(server.telegram_status(alice_auth)['ready'], False)
            server.logout(alice_auth)
            with self.assertRaises(HTTPException) as revoked:
                server.telegram_status(alice_auth)
            self.assertEqual(revoked.exception.status_code, 401)

    def test_telegram_status_http_protects_operator(self):
        import asyncio
        import httpx

        alice = server.register(server.RegisterRequest(username='alice', password='password123'))
        bob = server.register(server.RegisterRequest(username='bobby', password='password123'))

        async def exercise():
            transport = httpx.ASGITransport(app=server.app)
            async with httpx.AsyncClient(transport=transport, base_url='http://test') as client:
                assert (await client.get('/telegram/status')).status_code == 401
                assert (await client.get('/telegram/status', headers={'Authorization': 'Bearer ' + bob['token']})).status_code == 403
                response = await client.get('/telegram/status', headers={'Authorization': 'Bearer ' + alice['token']})
                assert response.status_code == 200
                assert response.json()['ready'] is False

        with patch.dict(os.environ, {'MUSIC_TELEGRAM_ENABLED': '1', 'MUSIC_TELEGRAM_OPERATOR': 'alice'}):
            asyncio.run(exercise())

    def test_telegram_pilot_readiness_needs_recent_authenticated_bridge(self):
        alice = server.register(server.RegisterRequest(username='alice', password='password123'))
        auth = 'Bearer ' + alice['token']
        key = 'a' * 43
        heartbeat = server.TelegramHeartbeat(session_present=True, callback_enabled=True,
                                             download_enabled=True, publish_enabled=True, delete_enabled=True)
        env = {'MUSIC_TELEGRAM_ENABLED': '1', 'MUSIC_TELEGRAM_OPERATOR': 'alice',
               'MUSIC_TELEGRAM_BRIDGE_KEY': key, 'MUSIC_TELEGRAM_PILOT_READY': '1',
               'MUSIC_ENABLE_LOCAL_LIBRARY': 'true', 'MUSIC_TELEGRAM_IMPORTED_DIR': self.tmp.name}
        with patch.dict(os.environ, env), \
                patch.object(server, 'TELEGRAM_BRIDGE_HEARTBEAT', {'at': 0.0, 'ready': False}), \
                patch.object(server.time, 'monotonic', return_value=100):
            self.assertFalse(server.telegram_status(auth)['ready'])
            with self.assertRaises(HTTPException):
                server.telegram_bridge_heartbeat(heartbeat, 'wrong')
            server.telegram_bridge_heartbeat(heartbeat, key)
            self.assertTrue(server.telegram_status(auth)['ready'])
        with patch.dict(os.environ, env), \
                patch.object(server, 'TELEGRAM_BRIDGE_HEARTBEAT', {'at': 100.0, 'ready': True}), \
                patch.object(server.time, 'monotonic', return_value=191):
            self.assertFalse(server.telegram_status(auth)['ready'])

    def test_telegram_bridge_authenticated_http_exchange(self):
        import asyncio
        import httpx
        from telegram_bridge_queue import BridgeQueue

        alice = server.register(server.RegisterRequest(username='alice', password='password123'))
        auth = {'Authorization': 'Bearer ' + alice['token']}
        key = 'A' * 43

        async def exercise():
            transport = httpx.ASGITransport(app=server.app)
            async with httpx.AsyncClient(transport=transport, base_url='http://test') as client:
                assert (await client.post('/telegram/bridge/claim')).status_code == 403
                assert (await client.post('/telegram/search', json={'query': 'canción'})).status_code == 401
                response = await client.post('/telegram/search', headers=auth, json={'query': 'canción'})
                assert response.status_code == 200
                identifier = response.json()['id']
                assert (await client.post('/telegram/bridge/claim', headers={'X-Telegram-Bridge-Key': 'wrong'})).status_code == 403
                bridge = {'X-Telegram-Bridge-Key': key}
                job = (await client.post('/telegram/bridge/claim', headers=bridge)).json()['job']
                assert job == {'id': identifier, 'query': 'canción'}
                response = await client.post('/telegram/bridge/finish', headers=bridge,
                                             json={'identifier': identifier, 'results': [{'id': 'a' * 43, 'label': 'resultado', 'context': 'Resultados', 'relation': 'indeterminado'}]})
                assert response.status_code == 200
                response = await client.get('/telegram/search/' + identifier, headers=auth)
                assert response.json() == {'state': 'completed', 'results': [{'id': 'a' * 43, 'label': 'resultado', 'context': 'Resultados', 'relation': 'indeterminado'}]}
                assert (await client.delete('/telegram/search/' + identifier, headers=auth)).status_code == 200

        with patch.dict(os.environ, {'MUSIC_TELEGRAM_ENABLED': '1', 'MUSIC_TELEGRAM_OPERATOR': 'alice',
                                     'MUSIC_TELEGRAM_BRIDGE_KEY': key}), \
                patch.object(server, 'TELEGRAM_BRIDGE_QUEUE', BridgeQueue(clock=lambda: 100)):
            asyncio.run(exercise())

    def test_telegram_bridge_reports_authenticated_download_progress(self):
        import asyncio
        import httpx
        from telegram_bridge_queue import BridgeQueue

        alice = server.register(server.RegisterRequest(username='alice', password='password123'))
        auth = {'Authorization': 'Bearer ' + alice['token']}
        key = 'B' * 43
        bridge = {'X-Telegram-Bridge-Key': key}
        option, receipt = 'a' * 43, 'b' * 43

        async def exercise():
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url='http://test') as client:
                identifier = (await client.post('/telegram/search', headers=auth,
                                                json={'query': 'Imitadora'})).json()['id']
                await client.post('/telegram/bridge/claim', headers=bridge)
                await client.post('/telegram/bridge/finish', headers=bridge, json={
                    'identifier': identifier,
                    'results': [{'id': option, 'label': 'Imitadora', 'context': '1. Imitadora', 'relation': 'vinculado'}]})
                await client.post('/telegram/search/' + identifier + '/select', headers=auth, json={
                    'result_id': option, 'accepts_group_publication': True,
                    'accepts_uncertainty': False, 'rights_confirmed': True, 'auto_download': True})
                await client.post('/telegram/bridge/claim-selection', headers=bridge)
                await client.post('/telegram/bridge/callback-result', headers=bridge, json={
                    'identifier': identifier, 'confirmed': True,
                    'receipt': {'id': receipt, 'message_id': 7, 'size': 1000,
                                'mime_type': 'audio/mpeg', 'title': 'Imitadora'}})
                await client.post('/telegram/bridge/claim-download', headers=bridge)
                assert (await client.post('/telegram/bridge/download-progress', json={
                    'identifier': identifier, 'received': 500, 'total': 1000})).status_code == 403
                assert (await client.post('/telegram/bridge/download-progress', headers=bridge, json={
                    'identifier': identifier, 'received': 500, 'total': 1000})).status_code == 200
                assert (await client.get('/telegram/search/' + identifier, headers=auth)).json()['progress'] == 50

        with patch.dict(os.environ, {'MUSIC_TELEGRAM_ENABLED': '1', 'MUSIC_TELEGRAM_OPERATOR': 'alice',
                                     'MUSIC_TELEGRAM_BRIDGE_KEY': key}), \
                patch.object(server, 'TELEGRAM_BRIDGE_QUEUE', BridgeQueue(clock=lambda: 100)):
            asyncio.run(exercise())

    def test_telegram_auto_selects_clear_best_match(self):
        import asyncio
        import httpx
        from telegram_bridge_queue import BridgeQueue

        alice = server.register(server.RegisterRequest(username='alice', password='password123'))
        auth = {'Authorization': 'Bearer ' + alice['token']}
        key = 'C' * 43
        bridge = {'X-Telegram-Bridge-Key': key}
        best, receipt = 'b' * 43, 'd' * 43
        context = ('Resultados\n1. Imitadora - Romeo Santos (128 kbps)\n'
                   '2. Imitadora - Romeo Santos (320 kbps)')

        async def exercise():
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url='http://test') as client:
                response = await client.post('/telegram/search', headers=auth, json={
                    'query': 'Romeo Santos Imitadora',
                    'target': {'title': 'Imitadora', 'artist': 'Romeo Santos', 'duration': 235},
                    'auto_select': True,
                })
                assert response.status_code == 200
                identifier = response.json()['id']
                await client.post('/telegram/bridge/claim', headers=bridge)
                assert (await client.post('/telegram/bridge/finish', headers=bridge, json={
                    'identifier': identifier,
                    'results': [
                        {'id': 'a' * 43, 'label': '1', 'context': context, 'relation': 'indeterminado'},
                        {'id': best, 'label': '2', 'context': context, 'relation': 'indeterminado'},
                    ]})).status_code == 200
                result = (await client.get('/telegram/search/' + identifier, headers=auth)).json()
                assert result['state'] == 'selection_pending'
                assert result['auto_selected'] is True
                assert result['selection'] == {
                    'label': 'Imitadora - Romeo Santos (320 kbps)', 'relation': 'indeterminado'}
                claim = (await client.post('/telegram/bridge/claim-selection', headers=bridge)).json()
                assert claim['selection'] == {'search_id': identifier, 'result_id': best}
                await client.post('/telegram/bridge/callback-result', headers=bridge, json={
                    'identifier': identifier, 'confirmed': True,
                    'receipt': {'id': receipt, 'message_id': 7, 'size': 1000,
                                'mime_type': 'audio/mpeg', 'title': 'Imitadora'}})
                assert (await client.get('/telegram/search/' + identifier, headers=auth)).json()['state'] == 'download_pending'

        with patch.dict(os.environ, {'MUSIC_TELEGRAM_ENABLED': '1', 'MUSIC_TELEGRAM_OPERATOR': 'alice',
                                     'MUSIC_TELEGRAM_BRIDGE_KEY': key}), \
                patch.object(server, 'TELEGRAM_BRIDGE_QUEUE', BridgeQueue(clock=lambda: 100)):
            asyncio.run(exercise())

    def test_windows_agent_and_backend_exchange_with_simulated_telegram(self):
        import asyncio
        import httpx
        import telegram_windows_bridge as bridge
        from telegram_bridge_queue import BridgeQueue

        alice = server.register(server.RegisterRequest(username='alice', password='password123'))
        auth = {'Authorization': 'Bearer ' + alice['token']}
        key = 'A' * 43

        async def request(method, path, headers=None, body=None):
            transport = httpx.ASGITransport(app=server.app)
            async with httpx.AsyncClient(transport=transport, base_url='http://test') as client:
                response = await client.request(method, path, headers=headers, json=body)
                response.raise_for_status()
                return response.json()

        def bridge_request(bridge_key, path, body):
            return asyncio.run(request('POST', path, {'X-Telegram-Bridge-Key': bridge_key}, body))

        async def simulated_search(query, *, search_id, registry):
            self.assertEqual(query, 'Romeo Santos')
            return [{'id': 'a' * 43, 'label': '1', 'context': '1. Imitadora', 'relation': 'indeterminado'}]

        with patch.dict(os.environ, {'MUSIC_TELEGRAM_ENABLED': '1', 'MUSIC_TELEGRAM_OPERATOR': 'alice',
                                     'MUSIC_TELEGRAM_BRIDGE_KEY': key}), \
                patch.object(server, 'TELEGRAM_BRIDGE_QUEUE', BridgeQueue(clock=lambda: 100)), \
                patch.object(bridge, 'bridge_request', bridge_request), \
                patch.object(bridge, 'search_with_session', simulated_search):
            identifier = asyncio.run(request('POST', '/telegram/search', auth, {'query': 'Romeo Santos'}))['id']
            self.assertEqual(bridge.run_once(key), 'completed')
            result = asyncio.run(request('GET', '/telegram/search/' + identifier, auth))
            self.assertEqual(result, {'state': 'completed', 'results': [{'id': 'a' * 43, 'label': '1', 'context': '1. Imitadora', 'relation': 'indeterminado'}]})
            selected = asyncio.run(request('POST', '/telegram/search/' + identifier + '/select', auth,
                                           {'result_id': 'a' * 43, 'accepts_group_publication': True,
                                            'accepts_uncertainty': True, 'rights_confirmed': True}))
            self.assertEqual(selected, {'selected': True, 'callback_sent': False})
            claim = asyncio.run(request('POST', '/telegram/bridge/claim-selection',
                                        {'X-Telegram-Bridge-Key': key}, {}))
            self.assertEqual(claim['selection'], {'search_id': identifier, 'result_id': 'a' * 43})

    def test_lost_search_response_can_be_recovered_by_operator(self):
        import asyncio
        import httpx
        from telegram_bridge_queue import BridgeQueue

        alice = server.register(server.RegisterRequest(username='alice', password='password123'))
        bob = server.register(server.RegisterRequest(username='bobby', password='password123'))
        identifier = 'a' * 43

        async def exercise():
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url='http://test') as client:
                headers = {'Authorization': 'Bearer ' + alice['token']}
                response = await client.post('/telegram/search', headers=headers,
                                             json={'query': 'song', 'client_id': identifier})
                assert response.json()['id'] == identifier
                # El cliente podría haber perdido la respuesta: el ID ya era conocido.
                recovered = await client.get('/telegram/active-search', headers=headers)
                assert recovered.json()['job'] == {'id': identifier, 'state': 'pending'}
                other = await client.get('/telegram/active-search', headers={'Authorization': 'Bearer ' + bob['token']})
                assert other.status_code == 403
                assert (await client.post('/telegram/search', headers=headers,
                                          json={'query': 'song', 'client_id': identifier})).status_code == 409

        with patch.dict(os.environ, {'MUSIC_TELEGRAM_ENABLED': '1', 'MUSIC_TELEGRAM_OPERATOR': 'alice'}), \
                patch.object(server, 'TELEGRAM_BRIDGE_QUEUE', BridgeQueue(clock=lambda: 100)):
            asyncio.run(exercise())

    def test_optional_telegram_library_lists_and_streams_only_generated_names(self):
        import asyncio
        import httpx

        root = Path(self.tmp.name)
        main = root / 'main'
        imported = root / 'imported'
        main.mkdir()
        imported.mkdir()
        filename = 'telegram-' + 'a' * 32 + '.mp3'
        (imported / filename).write_bytes(b'test-audio')
        (imported / filename.replace('.mp3', '.json')).write_text('{"title":"Imitadora","artist":"Romeo Santos","genre":"Bachata"}', encoding='utf-8')
        (imported / filename.replace('.mp3', '.jpg')).write_bytes(b'\xff\xd8\xffimage')
        (imported / 'untrusted.mp3').write_bytes(b'not-listed')

        async def exercise():
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url='http://test') as client:
                tracks = (await client.get('/tracks')).json()
                self.assertEqual([track['filename'] for track in tracks], [filename])
                self.assertEqual((tracks[0]['title'], tracks[0]['artist'], tracks[0]['genre']), ('Imitadora', 'Romeo Santos', 'Bachata'))
                cover = await client.get('/telegram/cover/' + filename.replace('.mp3', '.jpg'))
                self.assertEqual(cover.content, b'\xff\xd8\xffimage')
                self.assertEqual(cover.headers['content-type'], 'image/jpeg')
                response = await client.get('/stream/' + filename)
                self.assertEqual(response.content, b'test-audio')
                self.assertEqual((await client.get('/stream/untrusted.mp3')).status_code, 404)

        with patch.object(server, 'MUSIC_DIR', main), \
                patch.dict(os.environ, {'MUSIC_TELEGRAM_IMPORTED_DIR': str(imported)}):
            asyncio.run(exercise())

    def test_delete_import_requires_operator_confirmation_and_bridge_key(self):
        import asyncio
        import httpx
        from telegram_deletion_queue import DeletionQueue

        alice = server.register(server.RegisterRequest(username='alice', password='password123'))
        bob = server.register(server.RegisterRequest(username='bobby', password='password123'))
        key = 'a' * 43
        filename = 'telegram-' + 'b' * 32 + '.mp3'

        async def exercise():
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url='http://test') as client:
                alice_auth = {'Authorization': 'Bearer ' + alice['token']}
                bob_auth = {'Authorization': 'Bearer ' + bob['token']}
                assert (await client.post('/telegram/library/delete', headers=bob_auth,
                                          json={'filename': filename, 'confirmed': True})).status_code == 403
                assert (await client.post('/telegram/library/delete', headers=alice_auth,
                                          json={'filename': filename, 'confirmed': False})).status_code == 409
                identifier = (await client.post('/telegram/library/delete', headers=alice_auth,
                                                json={'filename': filename, 'confirmed': True})).json()['id']
                assert (await client.post('/telegram/bridge/claim-delete')).status_code == 403
                bridge_auth = {'X-Telegram-Bridge-Key': key}
                claimed = await client.post('/telegram/bridge/claim-delete', headers=bridge_auth)
                assert claimed.json()['delete'] == {'id': identifier, 'filename': filename}
                await client.post('/telegram/bridge/delete-result', headers=bridge_auth,
                                  json={'identifier': identifier, 'deleted': True})
                assert (await client.get('/telegram/library/delete/' + identifier, headers=alice_auth)).json()['state'] == 'deleted'

        with patch.dict(os.environ, {'MUSIC_TELEGRAM_ENABLED': '1', 'MUSIC_TELEGRAM_OPERATOR': 'alice',
                                     'MUSIC_TELEGRAM_BRIDGE_KEY': key}), \
                patch.object(server, 'TELEGRAM_DELETION_QUEUE', DeletionQueue(clock=lambda: 1)):
            asyncio.run(exercise())

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
