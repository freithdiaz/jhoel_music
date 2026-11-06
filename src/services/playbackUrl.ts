import { Track } from '../types';

// Las playlists antiguas pueden contener el puerto o la IP de un servidor anterior.
// Solo se reconstruyen enlaces conocidos del propio servicio, nunca URLs externas arbitrarias.
export function playbackUrl(track: Track, backend: string, pageUrl: string): string {
  if (!track.audioUrl) return '';
  try {
    const url = new URL(track.audioUrl, pageUrl);
    const id = url.searchParams.get('v');
    const isServerTrack = track.id.startsWith('yt-') || track.sourceType === 'invidious' || track.sourceType === 'rea-reverse';
    if (isServerTrack && (url.pathname === '/stream_yt' || url.pathname === '/api/stream_yt') && id && /^[\w-]{11}$/.test(id)) {
      return `${backend.replace(/\/$/, '')}/stream_yt?v=${encodeURIComponent(id)}`;
    }
  } catch { return ''; }
  return track.audioUrl;
}
