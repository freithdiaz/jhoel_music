export type AudioDeck = 'a' | 'b';

/** El deck que no está sonando se usa para precargar la siguiente pista. */
export function standbyDeck(active: AudioDeck): AudioDeck {
  return active === 'a' ? 'b' : 'a';
}

/**
 * Solo se puede saltar al deck precargado si contiene exactamente la pista
 * pedida, no falló y ya tiene datos listos para reproducir.
 */
export function canReusePreloadedDeck(
  preloadedUrl: string | null,
  targetUrl: string,
  readyState: number,
  hasError: boolean
): boolean {
  return !!preloadedUrl && preloadedUrl === targetUrl && !hasError && readyState >= 2;
}

/**
 * Con la pantalla apagada Chrome puede suspender el JS si no hay audio.
 * El deck de la siguiente pista se arranca en silencio un poco antes del final
 * para que el cambio de canción no deje una ventana sin reproducción.
 */
export function shouldPrimeStandby(
  visibility: DocumentVisibilityState,
  alreadyPrimed: boolean,
  remaining: number,
  hasPreparedTrack: boolean,
  readyState: number,
  hasError: boolean,
  paused: boolean
): boolean {
  return visibility === 'hidden'
    && !alreadyPrimed
    && Number.isFinite(remaining)
    && remaining > 0
    && remaining <= 2.5
    && hasPreparedTrack
    && !hasError
    && readyState >= 2
    && paused;
}
