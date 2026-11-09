import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles } = await build({ entryPoints: ['src/services/mediaSession.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const media = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);

test('Media Session publica pausa y reproducción sin alterarlas al cambiar metadatos', () => {
  const originalNavigator = globalThis.navigator;
  const originalMetadata = globalThis.MediaMetadata;
  const session = { playbackState: 'none', metadata: null };
  Object.defineProperty(globalThis, 'navigator', { value: { mediaSession: session }, configurable: true });
  globalThis.MediaMetadata = class { constructor(value) { Object.assign(this, value); } };
  try {
    media.updateMediaSessionPlaybackState(false);
    media.updateMediaSessionMetadata({ title: 'Tema', artist: 'Artista', album: '', coverUrl: '' });
    assert.equal(session.playbackState, 'paused');
    media.updateMediaSessionPlaybackState(true);
    assert.equal(session.playbackState, 'playing');
  } finally {
    Object.defineProperty(globalThis, 'navigator', { value: originalNavigator, configurable: true });
    globalThis.MediaMetadata = originalMetadata;
  }
});

test('los botones físicos invocan acciones separadas de reproducción y pausa', () => {
  const originalNavigator = globalThis.navigator;
  const handlers = {};
  Object.defineProperty(globalThis, 'navigator', { value: { mediaSession: { setActionHandler: (name, fn) => { handlers[name] = fn; } } }, configurable: true });
  const events = [];
  try {
    media.registerMediaSessionHandlers({ onPlay: () => events.push('play'), onPause: () => events.push('pause'),
      onNext() {}, onPrev() {}, onSeek() {}, onSeekRelative() {} });
    handlers.pause(); handlers.play();
    assert.deepEqual(events, ['pause', 'play']);
  } finally { Object.defineProperty(globalThis, 'navigator', { value: originalNavigator, configurable: true }); }
});
