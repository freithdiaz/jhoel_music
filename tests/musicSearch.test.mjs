import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles } = await build({ entryPoints: ['src/services/freeMusicApi.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { searchFreeMusicOnline, fetchTrendingFreeTracks } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
globalThis.localStorage = { getItem: () => null };
globalThis.window = { localStorage: globalThis.localStorage };
const json = data => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
const jamendoTrack = { id: '123', name: 'Canción propia', artist_name: 'Artista', audio: 'https://jamendo.test/audio.mp3', duration: 180 };

test('busca Jamendo primero y no llama al servidor de YouTube', async () => {
  const requests = [];
  globalThis.fetch = async url => { requests.push(String(url)); if (String(url).includes('api.jamendo.com')) return json({ results: [jamendoTrack, { ...jamendoTrack, id: 'missing', audio: '' }] }); throw new Error('Solicitud inesperada'); };
  const results = await searchFreeMusicOnline('artista', 'https://servidor.test/api');
  assert.equal(results.length, 1);
  assert.equal(results[0].sourceType, 'jamendo');
  assert.equal(requests.length, 1);
  assert.ok(!requests.some(url => url.includes('/search_online')));
});

test('usa Audius si Jamendo no devuelve pistas', async () => {
  const requests = [];
  globalThis.fetch = async url => {
    url = String(url); requests.push(url);
    if (url.includes('api.jamendo.com')) return json({ results: [] });
    if (url.includes('/v1/health_check')) return json({});
    if (url.includes('/v1/tracks/search')) return json({ data: [{ id: 'ab12', title: 'Pista', user: { name: 'Artista' } }] });
    throw new Error('Solicitud inesperada');
  };
  const results = await searchFreeMusicOnline('artista', 'https://servidor.test/api');
  assert.equal(results[0].sourceType, 'audius');
  assert.ok(!requests.some(url => url.includes('/search_online') || url.includes('itunes.apple.com')));
});

test('identifica las muestras de iTunes y omite resultados sin preview', async () => {
  globalThis.fetch = async url => {
    url = String(url);
    if (url.includes('api.jamendo.com')) return json({ results: [] });
    if (url.includes('/v1/health_check')) return json({});
    if (url.includes('/v1/tracks/search')) return json({ data: [] });
    if (url.includes('itunes.apple.com')) return json({ results: [{ trackId: 1, previewUrl: 'https://example.test/preview.m4a' }, { trackId: 2 }] });
    throw new Error('Solicitud inesperada');
  };
  const results = await searchFreeMusicOnline('artista');
  assert.equal(results.length, 1);
  assert.equal(results[0].sourceType, 'itunes');
});

test('las tendencias también priorizan Jamendo', async () => {
  globalThis.fetch = async url => { assert.ok(String(url).includes('api.jamendo.com')); return json({ results: [jamendoTrack] }); };
  const results = await fetchTrendingFreeTracks();
  assert.equal(results[0].sourceType, 'jamendo');
});
