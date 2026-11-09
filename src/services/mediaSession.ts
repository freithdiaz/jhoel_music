import { Track } from '../types';

interface MediaSessionCallbacks {
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (time: number) => void;
  onSeekRelative: (offsetSeconds: number) => void;
}

let wakeLockSentinel: any = null;

export function updateMediaSessionMetadata(track: Track) {
  if (!('mediaSession' in navigator)) return;

  const cover = track.coverUrl || '/icons/icon.svg';

  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist,
    album: track.album || 'Thomas Music',
    artwork: [
      { src: cover, sizes: '96x96', type: 'image/jpeg' },
      { src: cover, sizes: '128x128', type: 'image/jpeg' },
      { src: cover, sizes: '192x192', type: 'image/jpeg' },
      { src: cover, sizes: '256x256', type: 'image/jpeg' },
      { src: cover, sizes: '384x384', type: 'image/jpeg' },
      { src: cover, sizes: '512x512', type: 'image/jpeg' },
    ]
  });

}

export function updateMediaSessionPlaybackState(playing: boolean) {
  if (!('mediaSession' in navigator)) return;
  try { navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'; } catch {}
}

export function updateMediaSessionPosition(currentTime: number, duration: number, playbackRate = 1.0) {
  if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;

  try {
    if (Number.isFinite(duration) && duration > 0 && Number.isFinite(currentTime) && Number.isFinite(playbackRate) && playbackRate > 0) {
      navigator.mediaSession.setPositionState({
        duration: Math.max(duration, 0.1),
        playbackRate: playbackRate,
        position: Math.min(Math.max(currentTime, 0), duration)
      });
    }
  } catch (err) {
    // Algunos navegadores móviles lanzan error si position > duration durante el seek
    console.debug('MediaSession position update:', err);
  }
}

export function registerMediaSessionHandlers(callbacks: MediaSessionCallbacks) {
  if (!('mediaSession' in navigator)) return;

  const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
    ['play', () => callbacks.onPlay()],
    ['pause', () => callbacks.onPause()],
    ['previoustrack', () => callbacks.onPrev()],
    ['nexttrack', () => callbacks.onNext()],
    ['seekbackward', (details) => callbacks.onSeekRelative(-(details.seekOffset || 10))],
    ['seekforward', (details) => callbacks.onSeekRelative(details.seekOffset || 10)],
    ['seekto', (details) => {
      if (typeof details.seekTime === 'number') {
        callbacks.onSeek(details.seekTime);
      }
    }],
    ['stop', () => callbacks.onPause()]
  ];

  for (const [action, handler] of handlers) {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch (e) {
      console.debug(`Acción MediaSession no soportada: ${action}`);
    }
  }
}

// Activar Wake Lock para evitar que Android o iOS suspenda el audio al apagar la pantalla
export async function enableScreenWakeLock(): Promise<boolean> {
  if (!('wakeLock' in navigator)) return false;
  try {
    wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
    wakeLockSentinel.addEventListener('release', () => {
      wakeLockSentinel = null;
    });
    return true;
  } catch (err) {
    console.debug('WakeLock no disponible o bloqueado por el usuario:', err);
    return false;
  }
}

export function releaseScreenWakeLock() {
  if (wakeLockSentinel) {
    try {
      wakeLockSentinel.release();
    } catch {}
    wakeLockSentinel = null;
  }
}
