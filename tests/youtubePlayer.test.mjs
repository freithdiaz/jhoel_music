import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles } = await build({ entryPoints: ['src/services/youtubePlayer.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { youtubeEmbedUrl, youtubeErrorMessage } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);

test('embed oficial usa origin de la página y habilita IFrame API', () => {
  const url = new URL(youtubeEmbedUrl('fEWhm_TVvUw', 'http://192.168.0.36:5173'));
  assert.equal(url.origin, 'https://www.youtube.com');
  assert.equal(url.pathname, '/embed/fEWhm_TVvUw');
  assert.equal(url.searchParams.get('origin'), 'http://192.168.0.36:5173');
  assert.equal(url.searchParams.get('enablejsapi'), '1');
  assert.throws(() => youtubeEmbedUrl('invalid/video', 'http://localhost'));
});

test('diagnóstico distingue restricciones de inserción e identificación', () => {
  for (const code of [101, 150]) assert.match(youtubeErrorMessage(code), /propietario.*sitios externos/);
  assert.match(youtubeErrorMessage(153), /Referer/);
  assert.match(youtubeErrorMessage(100), /privado/);
  assert.match(youtubeErrorMessage(2), /error 2/);
});
