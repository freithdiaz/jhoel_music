import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles } = await build({ entryPoints: ['src/services/reaBridge.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { resolveSpotifyTrackViaRea } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const json = data => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
const link = 'https://open.spotify.com/track/abc123';

test('no inventa audio si no se encuentra una coincidencia', async () => {
  globalThis.fetch = async url => String(url).includes('oembed') ? json({ title: 'Título', author_name: 'Artista' }) : json({ results: [] });
  assert.equal(await resolveSpotifyTrackViaRea(link), null);
});

test('una coincidencia de iTunes se identifica como vista previa', async () => {
  globalThis.fetch = async url => String(url).includes('oembed') ? json({ title: 'Título', author_name: 'Artista' }) : json({ results: [{ trackId: 44, trackName: 'Resultado real', artistName: 'Otro artista', previewUrl: 'https://example.org/preview.m4a' }] });
  const result = await resolveSpotifyTrackViaRea(link);
  assert.equal(result.sourceType, 'itunes');
  assert.equal(result.id, 'itunes-44');
  assert.equal(result.title, 'Resultado real');
});
