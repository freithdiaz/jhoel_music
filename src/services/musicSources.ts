import { Track } from '../types';

export function trackSourcePriority(track: Track): number {
  if (track.sourceType === 'local-file' || track.sourceType === 'fastapi') return 0;
  if (track.sourceType === 'jamendo') return 1;
  if (track.sourceType === 'audius') return 2;
  if (track.sourceType === 'itunes' || track.id.startsWith('itunes-')) return 3;
  if (track.id.startsWith('yt-') || /\/stream_yt(?:\?|$)/.test(track.audioUrl || '')) return 4;
  return 2;
}

export function trackSourceLabel(track: Track): string {
  if (track.sourceType === 'youtube') return 'YouTube · descarga vía Telegram';
  if (track.sourceType === 'itunes' || track.id.startsWith('itunes-')) return 'iTunes · vista previa';
  if (track.sourceType === 'jamendo') return 'Jamendo';
  if (track.sourceType === 'audius') return 'Audius';
  if (track.id.startsWith('yt-') || /\/stream_yt(?:\?|$)/.test(track.audioUrl || '')) return 'YouTube · descarga vía Telegram';
  if (track.sourceType === 'local-file') return 'Archivo local';
  if (track.sourceType === 'fastapi') return 'Biblioteca del servidor';
  if (track.sourceType === 'radio') return 'Radio en vivo';
  return 'Fuente externa';
}

export function playbackFailureMessage(track: Track): string {
  if (track.audioUrl?.startsWith('blob:')) return 'El archivo local no está disponible. Vuelve a cargarlo o revisa Descargas.';
  if (track.id.startsWith('yt-') || /\/stream_yt(?:\?|$)/.test(track.audioUrl || '')) {
    return 'La reproducción de YouTube está deshabilitada por seguridad. Prueba Jamendo o Audius.';
  }
  return `No se pudo reproducir esta pista de ${trackSourceLabel(track)}. Puedes reintentar o elegir otra.`;
}
