import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles } = await build({ entryPoints: ['src/services/audioContextRecovery.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { watchAudioContextRecovery } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);

function createContext(initialState = 'running') {
  const listeners = new Set();
  const context = {
    state: initialState,
    resumeCalls: 0,
    addEventListener(type, listener) { if (type === 'statechange') listeners.add(listener); },
    removeEventListener(type, listener) { if (type === 'statechange') listeners.delete(listener); },
    resume() { this.resumeCalls += 1; this.state = 'running'; return Promise.resolve(); },
    emitStateChange() { for (const listener of [...listeners]) listener(); },
  };
  return context;
}

test('recupera el AudioContext suspendido solo mientras la intención de música siga activa', async () => {
  const context = createContext();
  let wantsPlayback = true;
  const dispose = watchAudioContextRecovery(context, () => wantsPlayback);

  context.state = 'suspended';
  context.emitStateChange();
  await Promise.resolve();
  assert.equal(context.resumeCalls, 1);

  wantsPlayback = false;
  context.state = 'suspended';
  context.emitStateChange();
  assert.equal(context.resumeCalls, 1);
  dispose();
});

test('deja de escuchar statechange al desmontar la recuperación', () => {
  const context = createContext('suspended');
  const dispose = watchAudioContextRecovery(context, () => true);
  dispose();
  context.emitStateChange();
  assert.equal(context.resumeCalls, 0);
});

test('no oculta errores al reanudar el contexto', async () => {
  const context = createContext('suspended');
  const failure = new Error('resume failed');
  context.resume = () => Promise.reject(failure);
  const errors = [];
  const dispose = watchAudioContextRecovery(context, () => true, error => errors.push(error));
  context.emitStateChange();
  await Promise.resolve();
  assert.deepEqual(errors, [failure]);
  dispose();
});
