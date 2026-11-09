import { Track } from '../types';
import { fetchTrendingJamendo, searchJamendoTracks } from './jamendoApi';

const AUDIUS_APP_NAME = 'thomas_music_pwa';
const AUDIUS_HOSTS = [
  'https://discoveryprovider.audius.co',
  'https://audius-discovery-1.cultur3stake.com',
  'https://discoveryprovider2.audius.co'
];

async function getWorkingAudiusHost(): Promise<string> {
  for (const host of AUDIUS_HOSTS) {
    try {
      const res = await fetch(`${host}/v1/health_check`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return host;
    } catch {}
  }
  return AUDIUS_HOSTS[0];
}

// 1. Obtener canciones en tendencia gratis desde Audius
export async function fetchTrendingFreeTracks(): Promise<Track[]> {
  const jamendo = await fetchTrendingJamendo();
  if (jamendo.length) return jamendo;
  try {
    const host = await getWorkingAudiusHost();
    const res = await fetch(`${host}/v1/tracks/trending?app_name=${AUDIUS_APP_NAME}&limit=16`, {
      signal: AbortSignal.timeout(4500)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const items = json.data || [];

    return items.map((item: any, idx: number): Track => {
      const cover = item.artwork
        ? item.artwork['480x480'] || item.artwork['150x150'] || Object.values(item.artwork)[0]
        : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80';

      return {
        id: `audius-${item.id || idx}`,
        title: item.title || 'Audius Free Stream',
        artist: item.user?.name || item.user?.handle || 'Audius Artist',
        album: item.genre || 'Trending Global',
        duration: item.duration || 180,
        bpm: Math.floor(100 + Math.random() * 35),
        keySignature: 'C Minor',
        energy: Math.floor(65 + Math.random() * 30),
        acousticness: Math.floor(10 + Math.random() * 40),
        danceability: Math.floor(70 + Math.random() * 25),
        genre: item.genre || 'Electronic',
        coverUrl: cover,
        audioUrl: `${host}/v1/tracks/${item.id}/stream?app_name=${AUDIUS_APP_NAME}`,
        sourceType: 'audius',
        cachedOffline: false,
        liked: false,
        lyrics: [
          { time: 0, text: `♪ ${item.title} - ${item.user?.name} ♪` },
          { time: 8, text: 'Transmitiendo vía Red Descentralizada Libre Audius' },
          { time: 24, text: 'Audio 100% legal, sin anuncios y sin suscripciones' },
          { time: 60, text: '♪ [Disfruta el sonido con tu ecualizador DSP] ♪' }
        ]
      };
    });
  } catch (err) {
    console.warn('Audius trending fallback a pistas curadas:', err);
    return [];
  }
}

// 2. Autocompletado de Sugerencias en Tiempo Real (FastAPI + iTunes Suggest)
export async function fetchSearchSuggestions(query: string, fastApiBaseUrl?: string, provider: 'free' | 'youtube' | 'stream' = 'free'): Promise<string[]> {
  if (provider === 'youtube') return [];
  const q = query.trim();
  if (!q || q.length < 1) return [];

  // Paso 1: Si hay servidor FastAPI activo, consultar el motor de sugerencias instantáneo
  if (fastApiBaseUrl) {
    try {
      const res = await fetch(`${fastApiBaseUrl}/suggestions?q=${encodeURIComponent(q)}`, {
        signal: AbortSignal.timeout(1400)
      });
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          return list.slice(0, 8);
        }
      }
    } catch {
      // Continuar con fallback
    }
  }

  // Paso 2: Fallback con iTunes API pública (CORS habilitado por defecto)
  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=musicArtist,song&limit=8`;
    const res = await fetch(itunesUrl, { signal: AbortSignal.timeout(1800) });
    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const seen = new Set<string>();
        const suggestions: string[] = [];
        data.results.forEach((item: any) => {
          if (item.artistName && !seen.has(item.artistName.toLowerCase())) {
            seen.add(item.artistName.toLowerCase());
            suggestions.push(item.artistName);
          }
          if (item.trackName && item.artistName) {
            const songName = `${item.artistName} - ${item.trackName}`;
            if (!seen.has(songName.toLowerCase())) {
              seen.add(songName.toLowerCase());
              suggestions.push(songName);
            }
          }
        });
        return suggestions.slice(0, 8);
      }
    }
  } catch {
    // Si falla la red exterior
  }

  return [];
}

// Jamendo y Audius primero; si no hay coincidencias, se ofrecen vistas previas de iTunes.
// No se consulta YouTube automáticamente: puede bloquear la extracción en servidores.
export async function searchFreeMusicOnline(query: string, _fastApiBaseUrl?: string): Promise<Track[]> {
  if (!query || query.trim().length < 2) return [];
  const q = query.trim();

  // Jamendo: catálogo de artistas que publican en ese servicio.
  try {
    const jamendoResults = await searchJamendoTracks(q);
    if (jamendoResults && jamendoResults.length > 0) {
      return jamendoResults;
    }
  } catch (err) {
    console.debug('Fallo consulta Jamendo:', err);
  }

  // Audius: resultados alternativos si Jamendo no tiene coincidencias.
  try {
    const host = await getWorkingAudiusHost();
    const res = await fetch(
      `${host}/v1/tracks/search?query=${encodeURIComponent(q)}&app_name=${AUDIUS_APP_NAME}&limit=10`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (res.ok) {
      const json = await res.json();
      const items = Array.isArray(json.data) ? json.data.filter((item: any) => item?.id) : [];
      if (items.length) return items.map((item: any): Track => ({
        id: `audius-${item.id}`,
        title: item.title || 'Pista Audius', artist: item.user?.name || 'Artista independiente',
        album: item.genre || 'Audius', duration: item.duration || 0,
        bpm: 120, keySignature: 'Desconocida', energy: 50, acousticness: 50, danceability: 50,
        genre: item.genre || 'Desconocido',
        coverUrl: item.artwork?.['480x480'] || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80',
        audioUrl: `${host}/v1/tracks/${item.id}/stream?app_name=${AUDIUS_APP_NAME}`,
        sourceType: 'audius', cachedOffline: false, liked: false, lyrics: []
      }));
    }
  } catch (err) {
    console.debug('Fallo Audius search:', err);
  }

  // iTunes solo proporciona una vista previa cuando está disponible.
  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=25`;
    const res = await fetch(itunesUrl, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        return data.results.filter((item: any) => typeof item.previewUrl === 'string' && item.previewUrl).map((item: any): Track => {
          // Reemplazar carátula de 100x100 por 600x600 HD
          const hdCover = item.artworkUrl100
            ? item.artworkUrl100.replace('100x100bb', '600x600bb')
            : 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80';

          return {
            id: `itunes-${item.trackId}`,
            title: item.trackName || 'Canción Online',
            artist: item.artistName || 'Artista Universal',
            album: item.collectionName || 'Vista previa',
            duration: Math.round((item.trackTimeMillis || 180000) / 1000),
            bpm: 120,
            keySignature: 'C Major',
            energy: 78,
            acousticness: 20,
            danceability: 75,
            genre: item.primaryGenreName || 'Pop',
            coverUrl: hdCover,
            audioUrl: item.previewUrl,
            sourceType: 'itunes',
            cachedOffline: false,
            liked: false,
            lyrics: [
              { time: 0, text: `♪ ${item.trackName} - ${item.artistName} ♪` },
              { time: 8, text: `Álbum: ${item.collectionName || 'Single'}` },
              { time: 15, text: 'Vista previa; no es la canción completa' }
            ]
          };
        });
      }
    }
  } catch (err) {
    console.debug('Fallo consulta catálogo iTunes:', err);
  }

  return [];
}
