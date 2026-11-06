import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles } = await build({ entryPoints: ['src/services/musicSources.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { trackSourceLabel, playbackFailureMessage } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);

test('identifica vistas previas antiguas y enlaces de YouTube guardados', () => {
  assert.match(trackSourceLabel({ id: 'itunes-9', sourceType: 'invidious', audioUrl: 'https://example.test/preview' }), /vista previa/);
  const youtube = { id: 'yt-fEWhm_TVvUw', sourceType: 'invidious', audioUrl: '/api/stream_yt?v=fEWhm_TVvUw' };
  assert.match(trackSourceLabel(youtube), /YouTube/);
  assert.match(playbackFailureMessage(youtube), /Jamendo o Audius/);
});
