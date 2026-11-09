/** Seguimiento de órdenes para evitar que un reintento antiguo anule una pausa. */
export function createPlaybackIntent() {
  let revision = 0;
  let source: 'music' | 'radio' = 'music';
  let playing = false;
  return {
    play(nextSource: 'music' | 'radio') { source = nextSource; playing = true; return ++revision; },
    pause() { playing = false; return ++revision; },
    current() { return revision; },
    isCurrent(ticket: number, expectedSource: 'music' | 'radio') {
      return revision === ticket && playing && source === expectedSource;
    },
    wants(expectedSource: 'music' | 'radio') { return playing && source === expectedSource; },
  };
}
