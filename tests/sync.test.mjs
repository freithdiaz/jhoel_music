import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles } = await build({ entryPoints: ['src/services/authService.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const service = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const values = new Map();
globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
globalThis.window = new EventTarget();
globalThis.CustomEvent = class extends Event { constructor(type, options) { super(type); this.detail = options?.detail; } };

test('offline changes are retained and a conflict does not overwrite them', async () => {
  const remote = { playlists: [], favorites: [], tasteProfile: { favoriteArtists: {}, favoriteGenres: {} }, revision: 0 };
  let mode = 'online';
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/auth/login')) return new Response(JSON.stringify({ token: 'token', user: { id: '1', username: 'alice', displayName: 'Alice', createdAt: 1 }, data: remote }));
    if (mode === 'offline') throw new Error('offline');
    if (url.endsWith('/user/sync')) {
      if (mode === 'conflict') return new Response('', { status: 409 });
      const body = JSON.parse(options.body);
      remote.playlists = body.playlists;
      remote.revision++;
      return new Response(JSON.stringify({ revision: remote.revision }));
    }
    return new Response(JSON.stringify(remote));
  };
  const { data } = await service.loginUser('alice', 'password123', 'http://test');
  mode = 'offline';
  const changed = { ...data, playlists: [{ id: 'one', name: 'Mi música', createdAt: 1, tracks: [] }] };
  service.saveLocalUserData('alice', changed, 'http://test');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(service.getSyncState('alice', 'http://test'), 'pending');
  assert.deepEqual(service.getLocalUserData('alice'), changed);
  mode = 'conflict';
  await service.syncUserData('alice', 'http://test');
  assert.equal(service.getSyncState('alice', 'http://test'), 'conflict');
  assert.deepEqual(service.getLocalUserData('alice'), changed);
  mode = 'online';
  const preview = await service.getConflictPreview('alice', 'http://test');
  await service.resolveSyncConflict('alice', 'http://test', 'local', preview);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(service.getSyncState('alice', 'http://test'), 'synced');
  assert.equal(remote.playlists[0].name, 'Mi música');
});

test('la comparación caducada no sobrescribe cambios del servidor', async () => {
  values.clear();
  const remote = { playlists: [], favorites: [], tasteProfile: { favoriteArtists: {}, favoriteGenres: {} }, revision: 1 };
  globalThis.fetch = async (url) => url.endsWith('/auth/login')
    ? new Response(JSON.stringify({ token: 'token', user: { id: '1', username: 'alice', displayName: 'Alice', createdAt: 1 }, data: remote }))
    : new Response(JSON.stringify(remote));
  await service.loginUser('alice', 'password123', 'http://test');
  const preview = await service.getConflictPreview('alice', 'http://test');
  const before = localStorage.getItem('thomas_music_user_alice_data');
  remote.revision++;
  await assert.rejects(() => service.resolveSyncConflict('alice', 'http://test', 'server', preview), /cambiaron/);
  assert.equal(localStorage.getItem('thomas_music_user_alice_data'), before);
});

test('si no cabe una copia de seguridad no se reemplazan los datos locales', async () => {
  values.clear();
  const remote = { playlists: [], favorites: [], tasteProfile: { favoriteArtists: {}, favoriteGenres: {} }, revision: 1 };
  globalThis.fetch = async (url) => url.endsWith('/auth/login')
    ? new Response(JSON.stringify({ token: 'token', user: { id: '1', username: 'alice', displayName: 'Alice', createdAt: 1 }, data: remote }))
    : new Response(JSON.stringify(remote));
  await service.loginUser('alice', 'password123', 'http://test');
  const preview = await service.getConflictPreview('alice', 'http://test');
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = (key, value) => { if (key.startsWith('thomas_music_sync_backup_')) throw new Error('Espacio insuficiente'); originalSetItem(key, value); };
  try {
    await assert.rejects(() => service.resolveSyncConflict('alice', 'http://test', 'server', preview), /Espacio insuficiente/);
    assert.equal(localStorage.getItem('thomas_music_user_alice_data'), preview.localSnapshot);
  } finally { localStorage.setItem = originalSetItem; }
});

test('si la revisión del servidor retrocede se conserva la copia local', async () => {
  values.clear();
  const remote = { playlists: [{ id: 'x', name: 'Mi lista', createdAt: 1, tracks: [] }], favorites: [], tasteProfile: { favoriteArtists: {}, favoriteGenres: {} }, revision: 4 };
  globalThis.fetch = async (url) => url.endsWith('/auth/login')
    ? new Response(JSON.stringify({ token: 'token', user: { id: '1', username: 'alice', displayName: 'Alice', createdAt: 1 }, data: remote }))
    : new Response(JSON.stringify(remote));
  await service.loginUser('alice', 'password123', 'http://test');
  const before = localStorage.getItem('thomas_music_user_alice_data');
  remote.revision = 1;
  remote.playlists = [];
  await service.syncUserData('alice', 'http://test');
  assert.equal(localStorage.getItem('thomas_music_user_alice_data'), before);
  assert.equal(service.getSyncState('alice', 'http://test'), 'conflict');
});

test('combinar preserva las versiones y sincroniza la copia combinada', async () => {
  values.clear();
  const remote = { playlists: [], favorites: [], tasteProfile: { favoriteArtists: {}, favoriteGenres: {} }, revision: 0 };
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/auth/login')) return new Response(JSON.stringify({ token: 'token', user: { id: '1', username: 'alice', displayName: 'Alice', createdAt: 1 }, data: remote }));
    if (url.endsWith('/user/sync')) {
      const body = JSON.parse(options.body);
      assert.equal(body.base_revision, remote.revision);
      remote.playlists = body.playlists; remote.favorites = body.favorites; remote.tasteProfile = body.taste_profile; remote.revision++;
      return new Response(JSON.stringify({ revision: remote.revision }));
    }
    return new Response(JSON.stringify(remote));
  };
  await service.loginUser('alice', 'password123', 'http://test');
  const local = { playlists: [{ id: 'x', name: 'Viaje local', createdAt: 1, tracks: [] }], favorites50List: [], userTasteProfile: { favoriteArtists: {}, favoriteGenres: {} } };
  localStorage.setItem('thomas_music_user_alice_data', JSON.stringify(local));
  localStorage.setItem('thomas_music_sync_alice', JSON.stringify({ server: 'http://test', revision: 0, dirty: true, conflict: true }));
  remote.playlists = [{ id: 'x', name: 'Viaje remoto', createdAt: 1, tracks: [] }];
  remote.revision = 1;
  const preview = await service.getConflictPreview('alice', 'http://test');
  const merged = await service.resolveSyncConflict('alice', 'http://test', 'merge', preview);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(merged.playlists.map(p => p.name), ['Viaje local', 'Viaje remoto (servidor)']);
  assert.deepEqual(remote.playlists.map(p => p.name), ['Viaje local', 'Viaje remoto (servidor)']);
  assert.equal(service.getSyncState('alice', 'http://test'), 'synced');
  assert.ok([...values.keys()].some(k => k.startsWith('thomas_music_sync_backup_alice_')));
});

test('el registro desactivado no crea silenciosamente una cuenta local', async () => {
  values.clear();
  globalThis.fetch = async () => new Response(JSON.stringify({ detail: 'El registro público está desactivado' }), { status: 403 });
  await assert.rejects(() => service.registerUser('alice', 'password123', 'Alice', 'http://test'), /desactivado/);
  assert.equal(localStorage.getItem('thomas_music_local_accounts'), null);
});
