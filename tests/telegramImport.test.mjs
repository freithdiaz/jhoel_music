import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles } = await build({ entryPoints: ['src/services/telegramImport.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { buildTelegramImport } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);

const track = (overrides = {}) => ({
  id: 'yt-dQw4w9WgXcQ',
  title: 'Imitadora',
  artist: 'Romeo Santos',
  album: 'Golden',
  duration: 235,
  sourceType: 'invidious',
  ...overrides,
});

test('limpia «Official Video» y el prefijo del artista para buscar la canción exacta', () => {
  const target = buildTelegramImport(track({ title: 'Romeo Santos - Imitadora (Official Video)' }), 7);
  assert.deepEqual(target, {
    nonce: 7,
    title: 'Imitadora',
    artist: 'Romeo Santos',
    album: 'Golden',
    duration: 235,
    query: 'Romeo Santos Imitadora',
  });
});

test('quita el sufijo - Topic del canal y los ruidos del título', () => {
  const target = buildTelegramImport(track({ title: 'Quédate (Lyric Video)', artist: 'Beéle - Topic' }), 8);
  assert.equal(target.title, 'Quédate');
  assert.equal(target.artist, 'Beéle');
  assert.equal(target.query, 'Beéle Quédate');
});

test('interpreta «Canción - Artista» sin repetir el artista', () => {
  const target = buildTelegramImport(track({ title: 'Imitadora - Romeo Santos' }), 9);
  assert.equal(target.title, 'Imitadora');
  assert.equal(target.artist, 'Romeo Santos');
  assert.equal(target.query, 'Romeo Santos Imitadora');
});

test('usa los artistas del título antes que el canal cuando hay varios', () => {
  const target = buildTelegramImport(track({
    title: 'Trendee Music - Feid, Maisak - SE ME OLVIDA (Official Video)',
    artist: 'Trendee Music',
    duration: 493,
  }), 10);
  assert.equal(target.title, 'SE ME OLVIDA');
  assert.equal(target.artist, 'Feid, Maisak');
  assert.equal(target.query, 'Feid, Maisak SE ME OLVIDA');
});

test('no confunde un sufijo de variante con el artista', () => {
  const target = buildTelegramImport(track({ title: 'Imitadora - Remix', artist: 'Romeo Santos' }), 11);
  assert.equal(target.title, 'Imitadora - Remix');
  assert.equal(target.artist, 'Romeo Santos');
});

test('rechaza pistas que no vienen de YouTube y títulos vacíos', () => {
  assert.equal(buildTelegramImport(track({ sourceType: 'fastapi' }), 1), null);
  assert.equal(buildTelegramImport(track({ sourceType: 'local-file' }), 1), null);
  assert.equal(buildTelegramImport(track({ title: '   ' }), 1), null);
  assert.equal(buildTelegramImport(track({ title: undefined }), 1), null);
  assert.equal(buildTelegramImport(null, 1), null);
});

test('acepta sourceType youtube y una duración no válida no se envía', () => {
  const target = buildTelegramImport(track({ sourceType: 'youtube', duration: 0 }), 2);
  assert.ok(target);
  assert.equal(target.duration, undefined);
  assert.equal(buildTelegramImport(track({ duration: Number.NaN }), 2).duration, undefined);
});

test('limita título, artista y consulta a 200 caracteres', () => {
  const target = buildTelegramImport(track({
    title: `Canción ${'x'.repeat(400)}`,
    artist: `Artista ${'y'.repeat(400)}`,
    album: 'z'.repeat(400),
  }), 3);
  assert.ok(target);
  assert.ok(target.title.length <= 200);
  assert.ok(target.artist.length <= 200);
  assert.ok(target.album.length <= 200);
  assert.ok(target.query.length <= 200);
});
