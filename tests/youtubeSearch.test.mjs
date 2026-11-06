import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles } = await build({ entryPoints: ['src/services/youtubeSearch.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { searchYouTube, searchYouTubeStream } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);

test('búsqueda de streaming solo acepta rutas locales e IDs válidos', async () => {
  globalThis.fetch = async url => {
    assert.match(String(url), /\/search_online\?q=music/);
    return new Response(JSON.stringify([
      { id: 'yt-abcdefghijk', sourceType: 'invidious', title: 'Song', artist: 'Artist', audioUrl: '/stream_yt?v=abcdefghijk' },
      { id: 'yt-abcdefghijk', sourceType: 'invidious', title: 'Bad', artist: 'Artist', audioUrl: 'https://evil.test/' },
    ]));
  };
  assert.equal((await searchYouTubeStream('/api', 'music', new AbortController().signal)).length, 1);
});

test('consulta el buscador oficial del servidor y filtra resultados inválidos', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'http://localhost:8000/youtube/search?q=canci%C3%B3n%20%26%20artista');
      assert.ok(options.signal);
      return new Response(JSON.stringify([{ id: 'yt-fEWhm_TVvUw', title: 'Canción', artist: 'Artista', sourceType: 'youtube' }, { id: 'yt-invalid', title: 'x', artist: 'y', sourceType: 'youtube' }]));
    };
    assert.equal((await searchYouTube('http://localhost:8000', ' canción & artista ', new AbortController().signal)).length, 1);
  } finally { globalThis.fetch = original; }
});

test('informa cuota y rechaza respuestas inválidas', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ detail: 'Comprueba la cuota.' }), { status: 503 });
    await assert.rejects(searchYouTube('', 'tema', new AbortController().signal), /cuota/);
    globalThis.fetch = async () => new Response('{}');
    await assert.rejects(searchYouTube('', 'tema', new AbortController().signal), /no es válida/);
  } finally { globalThis.fetch = original; }
});

test('propaga cancelación de la consulta', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, { signal }) => { signal.throwIfAborted(); };
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(searchYouTube('', 'tema', controller.signal), { name: 'AbortError' });
  } finally { globalThis.fetch = original; }
});
