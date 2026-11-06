import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles } = await build({ entryPoints: ['src/services/playbackQueue.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { createPlaybackQueue, stepPlaybackQueue } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);

test('la playlist sigue su orden y se detiene al final', () => {
  const tracks = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const first = createPlaybackQueue('Mi playlist', tracks);
  const second = stepPlaybackQueue(first, 1);
  const third = stepPlaybackQueue(second, 1);
  assert.deepEqual([first, second, third].map(queue => queue.tracks[queue.index].id), ['a', 'b', 'c']);
  assert.equal(stepPlaybackQueue(third, 1), null);
  assert.equal(stepPlaybackQueue(first, -1), null);
  assert.equal(stepPlaybackQueue(third, -1).tracks[1].id, 'b');
});

test('permite comenzar en una canción concreta y copia la lista', () => {
  const tracks = [{ id: 'a' }, { id: 'b' }];
  const queue = createPlaybackQueue('Mi playlist', tracks, 1);
  tracks.pop();
  assert.equal(queue.tracks[queue.index].id, 'b');
  assert.equal(createPlaybackQueue('Vacía', []), null);
});
