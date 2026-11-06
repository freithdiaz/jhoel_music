import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles } = await build({ entryPoints: ['src/services/syncMerge.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { mergeUserData } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const data = (playlists, favorites, artists = {}) => ({ playlists, favorites50List: favorites, userTasteProfile: { favoriteArtists: artists, favoriteGenres: {} } });
const playlist = (id, name, tracks) => ({ id, name, createdAt: 1, tracks: tracks.map(id => ({ id })) });

test('conserva las dos versiones de listas distintas sin inventar borrados', () => {
  const local = data([playlist('x', 'Viaje', ['a']), playlist('y', 'Gimnasio', ['c'])], [{ id: 'a' }], { Karol: 3 });
  const remote = data([playlist('x', 'Viaje', ['b']), playlist('z', 'Trabajo', ['d'])], [{ id: 'b' }], { Karol: 5 });
  const merged = mergeUserData(local, remote);
  assert.deepEqual(merged.playlists.map(p => p.name), ['Viaje', 'Gimnasio', 'Viaje (servidor)', 'Trabajo']);
  assert.deepEqual(merged.playlists[0].tracks.map(t => t.id), ['a']);
  assert.deepEqual(merged.playlists[2].tracks.map(t => t.id), ['b']);
  assert.deepEqual(merged.favorites50List.map(t => t.id), ['a', 'b']);
  assert.equal(merged.userTasteProfile.favoriteArtists.Karol, 5);
  assert.equal(local.playlists.length, 2);
});

test('no duplica playlists idénticas ni favoritos repetidos', () => {
  const a = data([playlist('x', 'Viaje', ['a'])], [{ id: 'a' }]);
  const merged = mergeUserData(a, a);
  assert.equal(merged.playlists.length, 1);
  assert.equal(merged.favorites50List.length, 1);
});
