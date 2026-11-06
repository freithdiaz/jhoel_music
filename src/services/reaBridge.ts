import { Track } from '../types';

/**
 * Módulo REA (Reverse Engineer Anything - https://github.com/morluto/rea)
 * 
 * Usa metadatos para buscar una posible coincidencia en otra fuente.
 * No accede directamente al audio de Spotify ni garantiza que haya una pista disponible.
 */

export function parseSpotifyUrl(url: string): { type: 'track' | 'album' | 'playlist'; id: string } | null {
  try {
    const match = url.match(/spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]+)/);
    if (match) {
      return {
        type: match[1] as 'track' | 'album' | 'playlist',
        id: match[2]
      };
    }
  } catch {}
  return null;
}

export async function resolveSpotifyTrackViaRea(spotifyUrl: string, fastApiUrl?: string): Promise<Track | null> {
  const parsed = parseSpotifyUrl(spotifyUrl);
  if (!parsed || parsed.type !== 'track') return null;

  // Opción 1: Resolver canción completa a través de FastAPI + yt-dlp si está disponible
  if (fastApiUrl) {
    try {
      const res = await fetch(`${fastApiUrl}/resolve_spotify?url=${encodeURIComponent(spotifyUrl)}`, {
        signal: AbortSignal.timeout(6000)
      });
      if (res.ok) {
        const data = await res.json();
        return {
          ...data,
          audioUrl: data.audioUrl.startsWith('http') ? data.audioUrl : `${fastApiUrl}${data.audioUrl}`,
          lyrics: [
            { time: 0, text: `♪ ${data.title} - ${data.artist} ♪` },
            { time: 8, text: 'Posible coincidencia de YouTube; la disponibilidad depende del proveedor' },
            { time: 20, text: 'No es audio extraído directamente de Spotify' }
          ]
        };
      }
    } catch {
      // Continuar con resolución directa
    }
  }

  // Opción 2: Resolución directa oEmbed + iTunes Search en vivo
  try {
    const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`;
    const res = await fetch(oembedUrl);
    if (!res.ok) throw new Error('No se pudo leer metadata de Spotify');
    const data = await res.json();

    const title = data.title || 'Canción Desconocida';
    const artist = data.author_name || 'Artista';
    const coverUrl = data.thumbnail_url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80';

    // Sin una coincidencia con vista previa no se inventa una pista de reemplazo.
    let match: any = null;
    try {
      const searchRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(`${artist} ${title}`)}&entity=song&limit=1`);
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.results && searchData.results.length > 0 && searchData.results[0].previewUrl) {
          match = searchData.results[0];
        }
      }
    } catch {}

    if (!match?.previewUrl) return null;
    return {
      id: `itunes-${match.trackId || `spotify-${parsed.id}`}`,
      title: match.trackName || title,
      artist: match.artistName || artist,
      album: match.collectionName || 'Vista previa aproximada',
      duration: Math.round((match.trackTimeMillis || 180000) / 1000),
      bpm: 124,
      keySignature: 'F# Minor',
      energy: 88,
      acousticness: 15,
      danceability: 82,
      genre: 'Spotify Import',
      coverUrl,
      audioUrl: match.previewUrl,
      sourceType: 'itunes',
      cachedOffline: false,
      liked: true,
      lyrics: [
        { time: 0, text: `♪ ${title} ♪` },
        { time: 8, text: 'Coincidencia aproximada: vista previa de iTunes' },
        { time: 20, text: 'No es audio extraído directamente de Spotify' }
      ]
    };
  } catch (err) {
    console.warn('Error resolviendo Spotify track via REA bridge:', err);
    return null;
  }
}
