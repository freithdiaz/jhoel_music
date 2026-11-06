import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles } = await build({ entryPoints: ['src/services/offlineVault.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { saveTrackOffline } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const track = { id: 'test', title: 'Prueba', audioUrl: 'https://example.org/audio', sourceType: 'jamendo' };

test('no marca como descargada una respuesta rechazada o vacía', async () => {
  let opened = false;
  globalThis.indexedDB = { open() { opened = true; throw new Error('No debería escribir en la bóveda'); } };
  globalThis.fetch = async () => new Response('No disponible', { status: 403 });
  await assert.rejects(() => saveTrackOffline(track), /403/);
  globalThis.fetch = async () => new Response('', { status: 200, headers: { 'content-type': 'audio/mpeg' } });
  await assert.rejects(() => saveTrackOffline(track), /vacío/);
  globalThis.fetch = async () => new Response('<html>Error</html>', { status: 200, headers: { 'content-type': 'text/html' } });
  await assert.rejects(() => saveTrackOffline(track), /archivo de audio/);
  assert.equal(opened, false);
});

test('no intenta descargar una emisora en vivo', async () => {
  let fetched = false;
  globalThis.fetch = async () => { fetched = true; return new Response(); };
  await assert.rejects(() => saveTrackOffline({ ...track, sourceType: 'radio' }), /emisoras/);
  assert.equal(fetched, false);
});

test('no descarga vistas previas de iTunes, incluidas las guardadas con el tipo anterior', async () => {
  let fetched = false;
  globalThis.fetch = async () => { fetched = true; return new Response(); };
  await assert.rejects(() => saveTrackOffline({ ...track, id: 'itunes-1', sourceType: 'invidious' }), /vistas previas/);
  assert.equal(fetched, false);
});
