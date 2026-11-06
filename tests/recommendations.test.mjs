import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles } = await build({ entryPoints: ['src/services/recommendations.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { rankRelated, recommendationQuery, trackGenre } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const track = (id, artist, genre, title = id) => ({ id, artist, genre, title, album: '', audioUrl: `https://example.org/${id}` });
const taste = { favoriteArtists: { Feid: 3 }, favoriteGenres: { reggaeton: 2 } };

test('urbano latino relaciona artistas y evita canciones sin relación o recientes', () => {
  const beele = track('beele', 'Béele', 'Música Universal');
  const feid = track('feid', 'Feid', 'Música Universal');
  const ed = track('ed', 'Ed Sheeran', 'Pop');
  assert.equal(trackGenre(beele), 'reggaeton');
  assert.deepEqual(rankRelated([ed, feid], beele, taste, []).map(t => t.id), ['feid']);
  assert.deepEqual(rankRelated([feid], beele, taste, ['feid']), []);
  assert.notEqual(recommendationQuery(beele).toLowerCase(), 'beele');
});

test('merengue y pop siguen su propio contexto', () => {
  const merengue = track('a', 'Juan Luis Guerra', 'Merengue');
  const otherMerengue = track('b', 'Elvis Crespo', 'Merengue');
  const feid = track('c', 'Feid', 'Reggaeton');
  assert.deepEqual(rankRelated([feid, otherMerengue], merengue, taste, []).map(t => t.id), ['b']);
  const ed = track('ed', 'Ed Sheeran', 'Pop');
  const maroon = track('maroon', 'Maroon 5', 'Pop');
  assert.deepEqual(rankRelated([feid, maroon], ed, taste, []).map(t => t.id), ['maroon']);
});

test('prefiere Jamendo a YouTube entre pistas relacionadas', () => {
  const current = track('actual', 'Ed Sheeran', 'Pop');
  const youtube = { ...track('yt-123', 'Ed Sheeran', 'Pop'), sourceType: 'invidious', audioUrl: '/api/stream_yt?v=123' };
  const jamendo = { ...track('jamendo-1', 'Otro artista', 'Pop'), sourceType: 'jamendo' };
  assert.deepEqual(rankRelated([youtube, jamendo], current, taste, []).map(t => t.id), ['jamendo-1', 'yt-123']);
});
