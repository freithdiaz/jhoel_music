import { Track } from '../types';

const RADIO_BROWSER_MIRRORS = [
  'https://de1.api.radio-browser.info',
  'https://at1.api.radio-browser.info',
  'https://nl1.api.radio-browser.info'
];

async function getWorkingRadioMirror(): Promise<string> {
  for (const mirror of RADIO_BROWSER_MIRRORS) {
    try {
      const res = await fetch(`${mirror}/json/stats`, { signal: AbortSignal.timeout(1800) });
      if (res.ok) return mirror;
    } catch {}
  }
  return RADIO_BROWSER_MIRRORS[0];
}

// ==========================================
// EMISORAS DESTACADAS POR DEFECTO (COLOMBIA & MEDELLÍN)
// Streams de alta fidelidad directos con 0 latencia
// ==========================================
export const DEFAULT_RADIO_STATIONS: Track[] = [
  {
    id: 'radio-olimpica-medellin',
    title: 'Olímpica Stereo Medellín 104.9 FM',
    artist: 'Organización Radial Olímpica (ORO)',
    album: 'Medellín, Colombia • En Vivo',
    duration: 0,
    bpm: 128,
    keySignature: 'En Vivo',
    energy: 95,
    acousticness: 10,
    danceability: 96,
    genre: 'Salsa, Vallenato, Tropical',
    coverUrl: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=600&auto=format&fit=crop&q=80',
    audioUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/OLP_MEDELLIN.mp3',
    sourceType: 'radio',
    cachedOffline: false,
    liked: true,
    lyrics: [
      { time: 0, text: '🔴 [TRANSMISIÓN EN VIVO 24/7]' },
      { time: 5, text: '¡Olímpica Stereo 104.9 FM Medellín, Se Metió!' },
      { time: 15, text: 'Salsa, Vallenato y la mejor música popular en directo' },
      { time: 30, text: 'Sintonizada con audio digital de alta fidelidad' }
    ]
  },
  {
    id: 'radio-mix-medellin',
    title: 'Mix 89.9 FM Medellín',
    artist: 'Organización Radial Olímpica (ORO)',
    album: 'Medellín, Colombia • En Vivo',
    duration: 0,
    bpm: 120,
    keySignature: 'En Vivo',
    energy: 98,
    acousticness: 5,
    danceability: 98,
    genre: 'Urbano, Reggaetón, Trap',
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
    audioUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/MIX_MEDELLIN.mp3',
    sourceType: 'radio',
    cachedOffline: false,
    liked: true,
    lyrics: [
      { time: 0, text: '🔴 [TRANSMISIÓN EN VIVO 24/7]' },
      { time: 5, text: 'Mix 89.9 FM Medellín • El sonido de la calle' },
      { time: 15, text: 'Puro Reggaetón, Trap y música urbana sin pausas' }
    ]
  },
  {
    id: 'radio-besame-medellin',
    title: 'Bésame Medellín 94.9 FM',
    artist: 'Prisa Radio Colombia',
    album: 'Medellín, Colombia • En Vivo',
    duration: 0,
    bpm: 85,
    keySignature: 'En Vivo',
    energy: 45,
    acousticness: 80,
    danceability: 50,
    genre: 'Romántica, Balada, Pop',
    coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    audioUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/BESAME_MEDELLIN.mp3',
    sourceType: 'radio',
    cachedOffline: false,
    liked: false,
    lyrics: [
      { time: 0, text: '🔴 [TRANSMISIÓN EN VIVO 24/7]' },
      { time: 5, text: 'Bésame 94.9 FM Medellín • Radio Apasionada' },
      { time: 15, text: 'Las baladas y canciones románticas que tocan el corazón' }
    ]
  },
  {
    id: 'radio-blu-colombia',
    title: 'Blu Radio Colombia 89.9 FM',
    artist: 'Caracol Televisión',
    album: 'Señal Nacional Colombia',
    duration: 0,
    bpm: 100,
    keySignature: 'En Vivo',
    energy: 70,
    acousticness: 30,
    danceability: 60,
    genre: 'Noticias, Opinión, Deportes',
    coverUrl: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=600&auto=format&fit=crop&q=80',
    audioUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/BLURADIO.mp3',
    sourceType: 'radio',
    cachedOffline: false,
    liked: false,
    lyrics: [
      { time: 0, text: '🔴 [SEÑAL EN VIVO]' },
      { time: 5, text: 'Blu Radio • La nueva alternativa' }
    ]
  },
  {
    id: 'radio-caracol-colombia',
    title: 'Caracol Radio Colombia 100.9 FM',
    artist: 'Prisa Radio',
    album: 'Bogotá / Nacional • En Vivo',
    duration: 0,
    bpm: 95,
    keySignature: 'En Vivo',
    energy: 65,
    acousticness: 35,
    danceability: 55,
    genre: 'Noticias, Actualidad',
    coverUrl: 'https://images.unsplash.com/photo-1589903308904-1010c2294adc?w=600&auto=format&fit=crop&q=80',
    audioUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/CARACOL_RADIO.mp3',
    sourceType: 'radio',
    cachedOffline: false,
    liked: false,
    lyrics: [
      { time: 0, text: '🔴 [EN DIRECTO]' },
      { time: 5, text: 'Caracol Radio • Más compañía' }
    ]
  },
  {
    id: 'radio-olimpica-bogota',
    title: 'Olímpica Stereo Bogotá 105.9 FM',
    artist: 'Organización Radial Olímpica (ORO)',
    album: 'Bogotá, Colombia • En Vivo',
    duration: 0,
    bpm: 126,
    keySignature: 'En Vivo',
    energy: 94,
    acousticness: 12,
    danceability: 95,
    genre: 'Salsa, Tropical, Popular',
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    audioUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/OLP_BOGOTA.mp3',
    sourceType: 'radio',
    cachedOffline: false,
    liked: false,
    lyrics: [
      { time: 0, text: '🔴 [EN DIRECTO 105.9 FM BOGOTÁ]' },
      { time: 5, text: '¡Olímpica Stereo Bogotá, Se Metió!' }
    ]
  }
];

export interface RadioBrowserStationRaw {
  stationuuid: string;
  name: string;
  url: string;
  url_resolved?: string;
  homepage?: string;
  favicon?: string;
  tags?: string;
  country?: string;
  countrycode?: string;
  state?: string;
  language?: string;
  codec?: string;
  bitrate?: number;
}

function mapRadioBrowserToTrack(st: RadioBrowserStationRaw): Track {
  const cover =
    st.favicon && st.favicon.startsWith('http')
      ? st.favicon
      : 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=600&auto=format&fit=crop&q=80';

  const cleanLocation = [st.state, st.country].filter(Boolean).join(', ') || 'Radio Internacional';
  const streamUrl = st.url_resolved || st.url;

  return {
    id: `radio-browser-${st.stationuuid}`,
    title: st.name.trim(),
    artist: cleanLocation,
    album: `Radio En Vivo (${st.codec || 'Live'} ${st.bitrate ? `${st.bitrate}kbps` : ''})`,
    duration: 0,
    bpm: 120,
    keySignature: 'En Vivo',
    energy: 85,
    acousticness: 20,
    danceability: 85,
    genre: st.tags ? st.tags.split(',').slice(0, 3).join(', ') : 'Radio en Vivo',
    coverUrl: cover,
    audioUrl: streamUrl,
    sourceType: 'radio',
    cachedOffline: false,
    liked: false,
    lyrics: [
      { time: 0, text: `🔴 [TRANSMISIÓN EN DIRECTO: ${st.name}]` },
      { time: 5, text: `Origen: ${cleanLocation}` },
      { time: 20, text: 'Audio en directo transmitido mediante Radio Browser Network' }
    ]
  };
}

// 1. Obtener emisoras por código de país (CO, MX, ES, AR, US, etc.)
export async function fetchStationsByCountry(countryCode: string, limit = 35): Promise<Track[]> {
  try {
    const mirror = await getWorkingRadioMirror();
    const url = `${mirror}/json/stations/search?countrycode=${encodeURIComponent(
      countryCode
    )}&limit=${limit}&order=clickcount&reverse=true`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'ThomasMusicRadioPWA/1.0' },
      signal: AbortSignal.timeout(4500)
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: RadioBrowserStationRaw[] = await res.json();
    return data
      .filter((s) => s.url || s.url_resolved)
      .map(mapRadioBrowserToTrack);
  } catch (err) {
    console.warn(`Error cargando emisoras de ${countryCode}:`, err);
    return [];
  }
}

// 2. Buscar emisoras en el directorio mundial por nombre o etiqueta
export async function searchRadioStations(query: string, countryCode?: string): Promise<Track[]> {
  if (!query || query.trim().length < 2) return [];

  try {
    const mirror = await getWorkingRadioMirror();
    let url = `${mirror}/json/stations/search?name=${encodeURIComponent(query.trim())}&limit=30&order=clickcount&reverse=true`;
    if (countryCode && countryCode !== 'ALL') {
      url += `&countrycode=${encodeURIComponent(countryCode)}`;
    }

    const res = await fetch(url, {
      headers: { 'User-Agent': 'ThomasMusicRadioPWA/1.0' },
      signal: AbortSignal.timeout(4500)
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: RadioBrowserStationRaw[] = await res.json();
    return data
      .filter((s) => s.url || s.url_resolved)
      .map(mapRadioBrowserToTrack);
  } catch (err) {
    console.warn('Error buscando emisoras en Radio Browser:', err);
    return [];
  }
}

// Lista de países para explorar
export const RADIO_COUNTRIES = [
  { code: 'CO', name: '🇨🇴 Colombia', flag: '🇨🇴' },
  { code: 'MX', name: '🇲🇽 México', flag: '🇲🇽' },
  { code: 'ES', name: '🇪🇸 España', flag: '🇪🇸' },
  { code: 'AR', name: '🇦🇷 Argentina', flag: '🇦🇷' },
  { code: 'US', name: '🇺🇸 Estados Unidos', flag: '🇺🇸' },
  { code: 'PE', name: '🇵🇪 Perú', flag: '🇵🇪' },
  { code: 'CL', name: '🇨🇱 Chile', flag: '🇨🇱' },
  { code: 'EC', name: '🇪🇨 Ecuador', flag: '🇪🇨' },
  { code: 'BR', name: '🇧🇷 Brasil', flag: '🇧🇷' },
  { code: 'GB', name: '🇬🇧 Reino Unido', flag: '🇬🇧' },
  { code: 'DE', name: '🇩🇪 Alemania', flag: '🇩🇪' }
];

