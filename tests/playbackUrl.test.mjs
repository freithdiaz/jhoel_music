import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles } = await build({ entryPoints: ['src/services/playbackUrl.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { playbackUrl } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const page = 'http://192.168.40.196:5173/';
const backend = 'http://192.168.40.196:5173/api';

test('playlist de servidor antiguo usa la conexión actual', () => {
  const track = { id: 'yt-fEWhm_TVvUw', sourceType: 'invidious', audioUrl: 'http://192.168.0.36:8000/stream_yt?v=fEWhm_TVvUw' };
  assert.equal(playbackUrl(track, backend, page), `${backend}/stream_yt?v=fEWhm_TVvUw`);
});

test('no modifica archivos locales ni otras fuentes', () => {
  for (const audioUrl of ['blob:http://localhost/example', 'https://example.org/audio.mp3']) {
    assert.equal(playbackUrl({ id: 'local', sourceType: 'local-file', audioUrl }, backend, page), audioUrl);
  }
  const external = 'https://example.org/stream_yt?v=fEWhm_TVvUw';
  assert.equal(playbackUrl({ id: 'other', sourceType: 'jamendo', audioUrl: external }, backend, page), external);
});
