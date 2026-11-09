import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles } = await build({ entryPoints: ['src/services/playbackIntent.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { createPlaybackIntent } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);

test('una pausa invalida cualquier reproducción o reconexión pendiente', () => {
  const intent = createPlaybackIntent();
  const ticket = intent.play('radio');
  intent.pause();
  assert.equal(intent.isCurrent(ticket, 'radio'), false);
  assert.equal(intent.wants('radio'), false);
});

test('cambiar de fuente invalida las órdenes anteriores', () => {
  const intent = createPlaybackIntent();
  const radio = intent.play('radio');
  const music = intent.play('music');
  assert.equal(intent.isCurrent(radio, 'radio'), false);
  assert.equal(intent.isCurrent(music, 'music'), true);
});
