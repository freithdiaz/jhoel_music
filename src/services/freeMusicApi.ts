import { Track } from '../types';
import { searchJamendoTracks } from './jamendoApi';

const AUDIUS_APP_NAME = 'diaz_music_pwa';
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

// 2. Búsqueda Universal en Vivo de cualquier música en internet
// Intenta primero el Servidor FastAPI yt-dlp local (si está activo, da la canción COMPLETA de YouTube Music)
// Si no está activo el servidor, usa el catálogo global iTunes (cualquier artista del mundo con preview de estudio oficial) y Audius
export async function searchFreeMusicOnline(query: string, fastApiBaseUrl?: string): Promise<Track[]> {
  if (!query || query.trim().length < 2) return [];
  const q = query.trim();

  // Opción A: Probar Servidor FastAPI / yt-dlp local si está configurado
  if (fastApiBaseUrl) {
    try {
      const serverRes = await fetch(`${fastApiBaseUrl}/search_online?q=${encodeURIComponent(q)}`, {
        signal: AbortSignal.timeout(10000)
      });
      if (serverRes.ok) {
        const items = await serverRes.json();
        if (Array.isArray(items) && items.length > 0) {
          return items.map((it: any) => ({
            ...it,
            audioUrl: it.audioUrl.startsWith('http') ? it.audioUrl : `${fastApiBaseUrl}${it.audioUrl}`,
            lyrics: [
              { time: 0, text: `♪ Reproduciendo en vivo: ${it.title} ♪` },
              { time: 10, text: `Transmitido directamente desde internet por el motor yt-dlp` },
              { time: 30, text: `Sin descargas previas • Calidad Directa de Estudio` }
            ]
          }));
        }
      }
    } catch {
      // Servidor local no respondió, pasar a catálogo universal directo
    }
  }

  // Opción B: Búsqueda en Jamendo Oficial (Canciones COMPLETAS sin límite de 30s)
  try {
    const jamendoResults = await searchJamendoTracks(q);
    if (jamendoResults && jamendoResults.length > 0) {
      return jamendoResults;
    }
  } catch (err) {
    console.debug('Fallo consulta Jamendo:', err);
  }

  // Opción C: Búsqueda Global en Catálogo Universal Oficial (iTunes Open API)
  // Contiene LITERALMENTE cualquier artista comercial (Coldplay, Bad Bunny, Shakira, Queen, Eminem, etc.)
  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=15`;
    const res = await fetch(itunesUrl, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        return data.results.map((item: any): Track => {
          // Reemplazar carátula de 100x100 por 600x600 HD
          const hdCover = item.artworkUrl100
            ? item.artworkUrl100.replace('100x100bb', '600x600bb')
            : 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80';

          return {
            id: `itunes-${item.trackId}`,
            title: item.trackName || 'Canción Online',
            artist: item.artistName || 'Artista Universal',
            album: item.collectionName || 'Lanzamiento Oficial',
            duration: Math.round((item.trackTimeMillis || 180000) / 1000),
            bpm: 120,
            keySignature: 'C Major',
            energy: 78,
            acousticness: 20,
            danceability: 75,
            genre: item.primaryGenreName || 'Pop',
            coverUrl: hdCover,
            audioUrl: item.previewUrl,
            sourceType: 'invidious',
            cachedOffline: false,
            liked: false,
            lyrics: [
              { time: 0, text: `♪ ${item.trackName} - ${item.artistName} ♪` },
              { time: 8, text: `Álbum: ${item.collectionName || 'Single'}` },
              { time: 15, text: `Streaming directo de alta fidelidad desde internet` }
            ]
          };
        });
      }
    }
  } catch (err) {
    console.debug('Fallo consulta catálogo iTunes:', err);
  }

  // Opción C: Red Descentralizada Audius
  try {
    const host = await getWorkingAudiusHost();
    const res = await fetch(
      `${host}/v1/tracks/search?query=${encodeURIComponent(q)}&app_name=${AUDIUS_APP_NAME}&limit=10`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (res.ok) {
      const json = await res.json();
      const items = json.data || [];
      return items.map((item: any, idx: number): Track => ({
        id: `audius-${item.id || idx}`,
        title: item.title,
        artist: item.user?.name || 'Artista Libre',
        album: item.genre || 'Audius Free Stream',
        duration: item.duration || 190,
        bpm: 120,
        keySignature: 'A Minor',
        energy: 80,
        acousticness: 20,
        danceability: 75,
        genre: item.genre || 'Web Stream',
        coverUrl: item.artwork
          ? item.artwork['480x480'] || Object.values(item.artwork)[0]
          : 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80',
        audioUrl: `${host}/v1/tracks/${item.id}/stream?app_name=${AUDIUS_APP_NAME}`,
        sourceType: 'audius',
        cachedOffline: false,
        liked: false,
        lyrics: [
          { time: 0, text: `♪ ${item.title} ♪` },
          { time: 10, text: `Por ${item.user?.name || 'Artista Independiente'}` }
        ]
      }));
    }
  } catch (err) {
    console.warn('Fallo Audius search fallback:', err);
  }

  return [];
}
