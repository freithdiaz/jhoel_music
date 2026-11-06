import atexit
import asyncio
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx

_temp = tempfile.TemporaryDirectory()
atexit.register(_temp.cleanup)
_root = Path(_temp.name)
(_root / 'index.html').write_text('<h1>Diaz Music</h1>', encoding='utf-8')
(_root / 'offline-assets.json').write_text('[]', encoding='utf-8')
os.environ['MUSIC_DIST_DIR'] = str(_root)
os.environ['MUSIC_DB_PATH'] = str(_root / 'import.db')
import production


class ProductionTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.env = patch.dict(os.environ, {'MUSIC_ALLOW_REGISTRATION': 'false', 'MUSIC_ENABLE_LOCAL_LIBRARY': 'false'})
        self.env.start()
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=production.create_app(_root)), base_url='http://test')

    async def asyncTearDown(self):
        await self.client.aclose()
        self.env.stop()

    async def test_static_api_and_public_defaults(self):
        self.assertEqual((await self.client.get('/')).status_code, 200)
        self.assertEqual((await self.client.get('/api/health')).json()['status'], 'online')
        self.assertEqual((await self.client.post('/api/auth/register', json={})).status_code, 403)
        self.assertEqual((await self.client.get('/api/tracks')).status_code, 403)
        self.assertEqual((await self.client.get('/api/stream/song.mp3')).status_code, 403)
        self.assertEqual((await self.client.get('/api/docs')).status_code, 404)

    async def test_body_limit_is_enforced_without_content_length(self):
        async def chunks():
            yield b'x' * (production.MAX_BODY + 1)
        response = await self.client.post('/api/user/sync', content=chunks())
        self.assertEqual(response.status_code, 413)

    async def test_login_rate_limit_is_global(self):
        for _ in range(12):
            response = await self.client.post('/api/auth/login', json={})
            self.assertEqual(response.status_code, 422)
        self.assertEqual((await self.client.post('/api/auth/login', json={})).status_code, 429)

    async def test_stream_disabled_and_range_rejected(self):
        response = await self.client.get('/api/stream_yt?v=abcdefghijk', headers={'Range': 'bytes=0-10'})
        self.assertEqual(response.status_code, 503)
        self.assertIn('deshabilitado', response.json()['detail'])
        response = await self.client.get('/api/stream_yt?v=abcdefghijk', headers={'Range': 'bytes=0-1,3-4'})
        self.assertEqual(response.status_code, 416)
        self.assertEqual((await self.client.get('/api/prepare_stream?v=abcdefghijk')).status_code, 503)

    async def test_concurrent_streams_are_limited(self):
        started = 0
        all_started = asyncio.Event()
        release = asyncio.Event()

        async def target(scope, receive, send):
            nonlocal started
            started += 1
            if started == 6:
                all_started.set()
            await release.wait()
            await send({'type': 'http.response.start', 'status': 200, 'headers': []})
            await send({'type': 'http.response.body', 'body': b'ok'})

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=production.PublicSafety(target)), base_url='http://test') as client:
            tasks = [asyncio.create_task(client.get('/api/stream_yt')) for _ in range(6)]
            await asyncio.wait_for(all_started.wait(), 2)
            self.assertEqual((await client.get('/api/stream_yt')).status_code, 503)
            release.set()
            results = await asyncio.gather(*tasks)
            self.assertTrue(all(result.status_code == 200 for result in results))


if __name__ == '__main__':
    unittest.main()
