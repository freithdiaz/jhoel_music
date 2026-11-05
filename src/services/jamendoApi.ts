import { Track } from '../types';

// Client ID oficial proporcionado por el usuario (Application: jhoel's App)
export const DEFAULT_JAMENDO_CLIENT_ID = 'ed533789';
const JAMENDO_STORAGE_KEY = 'diaz_music_jamendo_client_id';

export function getStoredJamendoClientId(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(JAMENDO_STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim();
  }
  return DEFAULT_JAMENDO_CLIENT_ID;
}

export function saveJamendoClientId(clientId: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(JAMENDO_STORAGE_KEY, clientId.trim());
  }
}

export interface JamendoTrackRaw {
  id: string;
  name: string;
  duration: number;
  artist_id: string;
  artist_name: string;
  album_name: string;
  album_image?: string;
  image?: string;
  audio: string;
  audiodownload?: string;
  musicinfo?: {
    tags?: {
      genres?: string[];
      instruments?: string[];
    };
  };
}

function mapJamendoToTrack(item: JamendoTrackRaw): Track {
  const cover =
    item.image ||
    item.album_image ||
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80';

  const genres = item.musicinfo?.tags?.genres || [];
  const genre = genres.length > 0 ? genres.join(', ') : 'Creative Commons Libre';

  return {
    id: `jamendo-${item.id}`,
    title: item.name,
    artist: item.artist_name || 'Artista Jamendo',
    album: item.album_name || 'Jamendo Music Oficial',
    duration: item.duration || 210,
    bpm: 120,
    keySignature: 'C Major',
    energy: 82,
    acousticness: 25,
    danceability: 80,
    genre,
    coverUrl: cover,
    audioUrl: item.audio,
    sourceType: 'jamendo',
    cachedOffline: false,
    liked: false,
    lyrics: [
      { time: 0, text: `♪ ${item.name} - ${item.artist_name} ♪` },
      { time: 8, text: 'Música 100% legal bajo licencia Creative Commons (Jamendo)' },
      { time: 20, text: 'Canción completa sin cortes ni límites de tiempo' },
      { time: 50, text: '♪ [Ajusta tus frecuencias en el ecualizador DSP] ♪' }
    ]
  };
}

// 1. Buscar canciones completas en Jamendo con Client ID
export async function searchJamendoTracks(query: string, customClientId?: string): Promise<Track[]> {
  const clientId = customClientId || getStoredJamendoClientId();
  if (!query || query.trim().length < 2) return [];

  const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${clientId}&format=jsonpretty&limit=25&search=${encodeURIComponent(
    query.trim()
  )}&include=musicinfo`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`Jamendo API HTTP ${res.status}`);
    const data = await res.json();
    const items: JamendoTrackRaw[] = data.results || [];
    return items.map(mapJamendoToTrack);
  } catch (err) {
    console.warn('Error buscando en Jamendo API:', err);
    return [];
  }
}

// 2. Obtener pistas populares o por género en Jamendo
export async function fetchTrendingJamendo(genre?: string, customClientId?: string): Promise<Track[]> {
  const clientId = customClientId || getStoredJamendoClientId();
  let url = `https://api.jamendo.com/v3.0/tracks/?client_id=${clientId}&format=jsonpretty&limit=24&boost=popularity_month&include=musicinfo`;

  if (genre && genre !== 'all') {
    url += `&tags=${encodeURIComponent(genre)}`;
  }

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`Jamendo API HTTP ${res.status}`);
    const data = await res.json();
    const items: JamendoTrackRaw[] = data.results || [];
    return items.map(mapJamendoToTrack);
  } catch (err) {
    console.warn('Error cargando canciones populares Jamendo:', err);
    return [];
  }
}

export const JAMENDO_GENRES = [
  { id: 'all', label: '🔥 Populares del Mes' },
  { id: 'rock', label: '🎸 Rock' },
  { id: 'electronic', label: '⚡ Electrónica' },
  { id: 'pop', label: '✨ Pop' },
  { id: 'hiphop', label: '🎤 Hip-Hop' },
  { id: 'jazz', label: '🎷 Jazz' },
  { id: 'chillout', label: '☕ Chillout / Lo-Fi' },
  { id: 'metal', label: '🤘 Metal' },
  { id: 'indie', label: '🌿 Indie' }
];
