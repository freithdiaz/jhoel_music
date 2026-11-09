import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles } = await build({ entryPoints: ['src/services/audioDeck.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { standbyDeck, canReusePreloadedDeck, shouldPrimeStandby } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);

test('alterna el deck de precarga sin tocar el que está sonando', () => {
  assert.equal(standbyDeck('a'), 'b');
  assert.equal(standbyDeck('b'), 'a');
});

test('solo reutiliza el deck precargado para la misma URL y con datos listos', () => {
  assert.equal(canReusePreloadedDeck('/stream/a.mp3', '/stream/a.mp3', 2, false), true);
  assert.equal(canReusePreloadedDeck('/stream/a.mp3', '/stream/b.mp3', 2, false), false);
  assert.equal(canReusePreloadedDeck('/stream/a.mp3', '/stream/a.mp3', 1, false), false);
  assert.equal(canReusePreloadedDeck('/stream/a.mp3', '/stream/a.mp3', 4, true), false);
  assert.equal(canReusePreloadedDeck(null, '/stream/a.mp3', 4, false), false);
});

test('arranca el deck en silencio solo al final y con la pantalla apagada', () => {
  assert.equal(shouldPrimeStandby('hidden', false, 1.2, true, 4, false, true), true);
  assert.equal(shouldPrimeStandby('hidden', false, 2.5, true, 4, false, true), true);
  assert.equal(shouldPrimeStandby('visible', false, 1.2, true, 4, false, true), false);
  assert.equal(shouldPrimeStandby('hidden', true, 1.2, true, 4, false, true), false);
  assert.equal(shouldPrimeStandby('hidden', false, 0, true, 4, false, true), false);
  assert.equal(shouldPrimeStandby('hidden', false, 3, true, 4, false, true), false);
  assert.equal(shouldPrimeStandby('hidden', false, 1.2, false, 4, false, true), false);
  assert.equal(shouldPrimeStandby('hidden', false, 1.2, true, 1, false, true), false);
  assert.equal(shouldPrimeStandby('hidden', false, 1.2, true, 4, true, true), false);
  assert.equal(shouldPrimeStandby('hidden', false, 1.2, true, 4, false, false), false);
});
