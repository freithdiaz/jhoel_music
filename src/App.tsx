import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TelegramStatus } from './TelegramStatus';
import { TelegramBackgroundImport } from './TelegramBackgroundImport';
import type { BackgroundImportResult } from './TelegramBackgroundImport';
import { Imported } from './TelegramImported';
import { searchYouTubeStream } from './services/youtubeSearch';
import { buildTelegramImport } from './services/telegramImport';
import type { TelegramImportTarget } from './services/telegramImport';
import {
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Repeat, Shuffle,
  Heart, Download, CheckCircle2, Sliders, Radio, Disc, Music, Upload,
  Server, Sparkles, Activity, Layers, Clock, FileAudio, Search, Plus,
  Trash2, RefreshCw, ChevronRight, Headphones, Zap, Eye, Mic2, Share2,
  Bookmark, AlertCircle, Settings, Flame, Compass, ShieldCheck, Lock,
  Unlock, BarChart3, ListMusic, Minimize2, Maximize2, ChevronDown,
  Smartphone, Bluetooth, Globe, Link2, ExternalLink, FolderPlus, ListPlus,
  Folder, ArrowRight, ChevronLeft, Check, X, Filter, User, LogIn, LogOut,
  UserPlus, ShieldAlert, Palette
} from 'lucide-react';

import { Track, Playlist, UserProfile, UserData, VisualizerMode, ThemeAccent, AudioPreset, ActiveTab } from './types';
import {
  getCurrentUser,
  setCurrentUser as saveSessionUser,
  loginUser,
  registerUser,
  getLocalUserData,
  saveLocalUserData,
  getSyncState,
  syncUserData,
  resolveSyncConflict,
  getConflictPreview,
  ConflictPreview
} from './services/authService';
import {
  updateMediaSessionMetadata,
  updateMediaSessionPlaybackState,
  updateMediaSessionPosition,
  registerMediaSessionHandlers,
  enableScreenWakeLock,
  releaseScreenWakeLock
} from './services/mediaSession';
import { createPlaybackIntent } from './services/playbackIntent';
import { watchAudioContextRecovery } from './services/audioContextRecovery';
import {
  saveTrackOffline,
  removeTrackOffline,
  getAllOfflineTracks,
  exportDrmFreeFile
} from './services/offlineVault';
import { searchFreeMusicOnline, fetchSearchSuggestions } from './services/freeMusicApi';
import { rankRelated, recommendationQuery, relatedReason, trackGenre } from './services/recommendations';
import { playbackUrl } from './services/playbackUrl';
import { playbackFailureMessage, trackSourceLabel } from './services/musicSources';
import { createPlaybackQueue, stepPlaybackQueue, PlaybackQueue } from './services/playbackQueue';
import { AudioDeck, standbyDeck as selectStandbyDeck, canReusePreloadedDeck, shouldPrimeStandby } from './services/audioDeck';
import { resolveSpotifyTrackViaRea } from './services/reaBridge';
import {
  getStoredJamendoClientId,
  saveJamendoClientId,
  fetchTrendingJamendo,
  JAMENDO_GENRES
} from './services/jamendoApi';
import {
  DEFAULT_RADIO_STATIONS,
  fetchStationsByCountry,
  searchRadioStations,
  RADIO_COUNTRIES
} from './services/radioApi';

// ==========================================
// CATÁLOGO INICIAL CURADO
// ==========================================
const INITIAL_TRACKS: Track[] = [
  {
    id: 'track-1',
    title: 'Midnight Cyberpunk Drive',
    artist: 'The Synthwave Collective',
    album: 'Neon Horizons 2084',
    duration: 172,
    bpm: 118,
    keySignature: 'A Minor',
    energy: 88,
    acousticness: 12,
    danceability: 84,
    genre: 'Synthwave',
    coverUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    sourceType: 'curated',
    cachedOffline: true,
    liked: true,
    lyrics: [
      { time: 0, text: "♪ [Intro Sintetizador Analógico Arpegiado] ♪" },
      { time: 12, text: "Cruising through the rain on the peripheral highway" },
      { time: 24, text: "Las luces de neón reflejan el código en el cristal" },
      { time: 38, text: "Sin anuncios, sin suscripciones, tu música siempre contigo" },
      { time: 55, text: "Subiendo la frecuencia en el filtro pasa-bajos DSP" },
      { time: 75, text: "♪ [Solo de Bajo FM & Batería 808 en Audífonos] ♪" },
      { time: 110, text: "Controlando el tempo desde el intercomunicador" },
      { time: 140, text: "♪ [Outro Espacial con Reverb 8D Infinito] ♪" }
    ]
  },
  {
    id: 'track-2',
    title: 'Lo-Fi Medellín Rain',
    artist: 'Bambuco Beats & Chill',
    album: 'Café & Código Vol. 3',
    duration: 145,
    bpm: 84,
    keySignature: 'C Major',
    energy: 35,
    acousticness: 78,
    danceability: 62,
    genre: 'Lo-Fi Chill',
    coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    sourceType: 'curated',
    cachedOffline: false,
    liked: true,
    lyrics: [
      { time: 0, text: "♪ [Sonido de lluvia suave y vinilo crujiendo] ♪" },
      { time: 15, text: "Tarde gris en la montaña, compilando sin parar" },
      { time: 32, text: "Acordes de Rhodes flotando en los auriculares" },
      { time: 60, text: "Respira hondo, ecualización a 432Hz" },
      { time: 95, text: "♪ [Solo de Guitarra Jazz Suave] ♪" }
    ]
  },
  {
    id: 'track-3',
    title: 'Neural Network Odyssey',
    artist: 'DeepMind Audio Lab',
    album: 'Algorithmic Freedom',
    duration: 198,
    bpm: 128,
    keySignature: 'F# Minor',
    energy: 95,
    acousticness: 5,
    danceability: 92,
    genre: 'Progressive Techno',
    coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    sourceType: 'curated',
    cachedOffline: false,
    liked: false,
    lyrics: [
      { time: 0, text: "♪ [Pulso Sub-Grave 60Hz Activo] ♪" },
      { time: 20, text: "Entrenando los pesos de mi propio recomendador" },
      { time: 45, text: "99% de afinidad acústica detectada" },
      { time: 80, text: "♪ [Drop Techno Industrial] ♪" },
      { time: 130, text: "Frecuencias moduladas en tiempo real" }
    ]
  },
  {
    id: 'track-4',
    title: 'Acoustic Sunset Horizon',
    artist: 'Sierra Nevada Ensemble',
    album: 'Unplugged Sessions',
    duration: 164,
    bpm: 96,
    keySignature: 'G Major',
    energy: 48,
    acousticness: 92,
    danceability: 55,
    genre: 'Indie Folk',
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    sourceType: 'curated',
    cachedOffline: true,
    liked: false,
    lyrics: [
      { time: 0, text: "♪ [Arpegio de Guitarra Acústica en Vivo] ♪" },
      { time: 18, text: "Caminando sin conexión, todo guardado en el vault" },
      { time: 42, text: "El viento trae melodías libres de DRM" },
      { time: 88, text: "♪ [Armónica y Percusión de Madera] ♪" }
    ]
  },
  {
    id: 'track-5',
    title: 'Tokyo Drift Phonk 99',
    artist: 'Kaito Shadow',
    album: 'Midnight Touge',
    duration: 152,
    bpm: 140,
    keySignature: 'D Minor',
    energy: 98,
    acousticness: 4,
    danceability: 89,
    genre: 'Drift Phonk',
    coverUrl: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=600&auto=format&fit=crop&q=80',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
    sourceType: 'curated',
    cachedOffline: false,
    liked: true,
    lyrics: [
      { time: 0, text: "♪ [Cowbell Distorsionado + 808 Saturado] ♪" },
      { time: 14, text: "Activando el preset Bass Boost en la curva" },
      { time: 36, text: "Ruta en moto con intercomunicador en el casco" },
      { time: 70, text: "♪ [Cambio de Ritmo Half-Time Slowed] ♪" }
    ]
  },
  {
    id: 'track-6',
    title: 'Velvet Astral Lounge',
    artist: 'Luna & The Modulars',
    album: 'Zero Gravity',
    duration: 185,
    bpm: 105,
    keySignature: 'E Minor',
    energy: 64,
    acousticness: 45,
    danceability: 76,
    genre: 'Downtempo Electronic',
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
    sourceType: 'curated',
    cachedOffline: false,
    liked: false,
    lyrics: [
      { time: 0, text: "♪ [Pads Atmosféricos + Bajo Fretless] ♪" },
      { time: 22, text: "Flotando en el modo 8D espacial" },
      { time: 54, text: "Las ondas rebotan de izquierda a derecha" },
      { time: 102, text: "♪ [Solo de Sintetizador Moog] ♪" }
    ]
  }
];

const EQ_BANDS = [
  { freq: 60, label: '60Hz (Sub)' },
  { freq: 230, label: '230Hz (Graves)' },
  { freq: 910, label: '910Hz (Medios)' },
  { freq: 3600, label: '3.6kHz (Presencia)' },
  { freq: 14000, label: '14kHz (Aire)' },
];

function BabyHeadphonesIcon({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="babySkin" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffe3cf" />
          <stop offset="100%" stopColor="#fcd0b1" />
        </linearGradient>
        <linearGradient id="babyHpGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>

      {/* Diadema acolchada de los audífonos */}
      <path d="M 140 260 C 140 110, 372 110, 372 260" fill="none" stroke="url(#babyHpGrad)" strokeWidth="26" strokeLinecap="round" />
      <path d="M 195 142 C 220 132, 292 132, 317 142" fill="none" stroke="#1f2430" strokeWidth="30" strokeLinecap="round" />

      {/* Cabeza del bebé sonriente */}
      <circle cx="256" cy="285" r="115" fill="url(#babySkin)" />

      {/* Orejitas */}
      <circle cx="152" cy="285" r="26" fill="#fcd0b1" />
      <circle cx="360" cy="285" r="26" fill="#fcd0b1" />

      {/* Rizo de pelo tierno de bebé */}
      <path d="M 256 170 C 248 140, 276 135, 272 155 C 270 162, 264 168, 256 170 Z" fill="#784421" />

      {/* Cejitas */}
      <path d="M 198 238 C 210 230, 225 232, 230 238" fill="none" stroke="#8d5027" strokeWidth="5" strokeLinecap="round" />
      <path d="M 314 238 C 302 230, 287 232, 282 238" fill="none" stroke="#8d5027" strokeWidth="5" strokeLinecap="round" />

      {/* Ojos grandes y tiernos de bebé */}
      <ellipse cx="212" cy="265" rx="18" ry="22" fill="#261b17" />
      <circle cx="217" cy="257" r="7" fill="#ffffff" />
      <circle cx="206" cy="273" r="3" fill="#ffffff" />

      <ellipse cx="300" cy="265" rx="18" ry="22" fill="#261b17" />
      <circle cx="305" cy="257" r="7" fill="#ffffff" />
      <circle cx="294" cy="273" r="3" fill="#ffffff" />

      {/* Mejillas sonrojadas rosaditas */}
      <ellipse cx="185" cy="295" rx="18" ry="11" fill="#ff7f9d" opacity="0.65" />
      <ellipse cx="327" cy="295" rx="18" ry="11" fill="#ff7f9d" opacity="0.65" />

      {/* Nariz tierna */}
      <ellipse cx="256" cy="285" rx="5" ry="3.5" fill="#e89e78" />

      {/* Sonrisa alegre escuchando música */}
      <path d="M 234 308 C 238 335, 274 335, 278 308" fill="#d84860" stroke="#7e1f30" strokeWidth="3" strokeLinecap="round" />
      <path d="M 242 312 C 248 322, 264 322, 270 312" fill="#ff7088" />

      {/* Almohadillas DJ Over-Ear con ondas de sonido */}
      <rect x="110" y="220" width="46" height="110" rx="23" fill="#181c26" stroke="url(#babyHpGrad)" strokeWidth="4" />
      <rect x="122" y="238" width="22" height="74" rx="11" fill="#0b0d14" />
      <path d="M 127 275 L 133 268 L 137 282 L 141 275" fill="none" stroke="#06b6d4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

      <rect x="356" y="220" width="46" height="110" rx="23" fill="#181c26" stroke="url(#babyHpGrad)" strokeWidth="4" />
      <rect x="368" y="238" width="22" height="74" rx="11" fill="#0b0d14" />
      <path d="M 373 275 L 379 268 L 383 282 L 387 275" fill="none" stroke="#ec4899" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

      {/* Corbatín DJ elegante */}
      <g transform="translate(256, 395)">
        <path d="M -26 -13 L 0 0 L -26 13 Z" fill="url(#babyHpGrad)" />
        <path d="M 26 -13 L 0 0 L 26 13 Z" fill="url(#babyHpGrad)" />
        <circle cx="0" cy="0" r="6" fill="#ffffff" />
      </g>
    </svg>
  );
}

const THEMES_LIST: { id: ThemeAccent; label: string; color: string; desc: string }[] = [
  { id: 'emerald', label: 'Verde Spotify', color: 'bg-emerald-500', desc: 'Clásico y limpio' },
  { id: 'blue', label: 'Azul Eléctrico', color: 'bg-blue-500', desc: 'Moderno y vibrante' },
  { id: 'pink', label: 'Rosado Neón', color: 'bg-pink-500', desc: 'Estilo Karol G / Glam' },
  { id: 'violet', label: 'Violeta Pro', color: 'bg-violet-500', desc: 'Profundo y elegante' },
  { id: 'cyberpunk', label: 'Ámbar Cyberpunk', color: 'bg-rose-500', desc: 'Cálido y futurista' }
];

export default function App() {
  // ==========================================
  // ESTADOS PRINCIPALES DE LA APLICACIÓN
  // ==========================================
  const [tracks, setTracks] = useState<Track[]>([]);
  const [offlineTracks, setOfflineTracks] = useState<Track[]>([]);
  const offlineTracksRef = useRef<Track[]>([]);
  const [vaultReady, setVaultReady] = useState(false);
  const vaultBusyRef = useRef(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const updateOfflineTracks = (next: Track[]) => { offlineTracksRef.current = next; setOfflineTracks(next); };
  const isDownloaded = (id: string) => offlineTracks.some(track => track.id === id);
  const homeOrderRef = useRef<{ scope: string; ids: string[]; tracks: Map<string, Track> }>({ scope: '', ids: [], tracks: new Map() });
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playbackIntentRef = useRef(createPlaybackIntent());
  const [isBuffering, setIsBuffering] = useState(false);
  const [unavailableTrackIds, setUnavailableTrackIds] = useState<Set<string>>(() => new Set());
  const playbackTrackRef = useRef<Track | null>(null);
  const [playbackQueue, setPlaybackQueue] = useState<PlaybackQueue | null>(null);
  const playbackQueueRef = useRef<PlaybackQueue | null>(null);
  const updatePlaybackQueue = (queue: PlaybackQueue | null) => {
    playbackQueueRef.current = queue;
    setPlaybackQueue(queue);
  };
  const playbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(172);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlineSearchResults, setOnlineSearchResults] = useState<Track[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [searchProvider, setSearchProvider] = useState<'free' | 'stream'>('stream');
  const searchProviderRef = useRef<'free' | 'stream'>('stream');
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>('bars');
  const [themeAccent, setThemeAccent] = useState<ThemeAccent>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('thomas_music_theme');
        if (saved && ['emerald', 'blue', 'pink', 'cyberpunk', 'purple'].includes(saved)) {
          return saved as ThemeAccent;
        }
      } catch {}
    }
    return 'emerald';
  });
  const [isMobileNowPlayingOpen, setIsMobileNowPlayingOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

  // Persistir tema seleccionado permanentemente en el navegador
  useEffect(() => {
    try {
      localStorage.setItem('thomas_music_theme', themeAccent);
    } catch {}
  }, [themeAccent]);

  // ==========================================
  // SUGERENCIAS EN TIEMPO REAL & PAGINACIÓN DE BÚSQUEDA
  // ==========================================
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [searchCurrentPage, setSearchCurrentPage] = useState(1);
  const SEARCH_PAGE_SIZE = 10;
  const [searchResultLimit, setSearchResultLimit] = useState<10 | 50>(() => {
    try { return Number(localStorage.getItem('diaz-search-limit')) === 50 ? 50 : 10; } catch { return 10; }
  });
  const searchDebounceRef = useRef<any>(null);

  // Paginación limpia para Inicio & Tendencias (Máximo 10 por vista con botones siguiente/anterior)
  const [homeCurrentPage, setHomeCurrentPage] = useState(1);
  const HOME_PAGE_SIZE = 10;

  // En desarrollo Vite proporciona /api; en producción el servidor web debe enviarlo a FastAPI.
  const [fastApiUrl, setFastApiUrl] = useState(
    new URL(import.meta.env.VITE_API_BASE_URL || '/api', window.location.origin).href.replace(/\/$/, '')
  );
  const [serverStatus, setServerStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [telegramImportCount, setTelegramImportCount] = useState(0);

  // ==========================================
  // AUTENTICACIÓN & SESIÓN MULTIUSUARIO (USUARIO Y CONTRASEÑA)
  // ==========================================
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => getCurrentUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authDisplayName, setAuthDisplayName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState('local');
  const [syncBusy, setSyncBusy] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictPreview, setConflictPreview] = useState<ConflictPreview | null>(null);
  const [conflictError, setConflictError] = useState('');

  // Objetivo de importación YouTube→Telegram; se conserva por usuario y servidor
  // para reanudar la tarjeta de progreso si se recarga la página.
  const telegramTargetKey = `diaz-telegram-target:${currentUser?.username || 'guest'}:${fastApiUrl}`;
  const [telegramImportTarget, setTelegramImportTarget] = useState<TelegramImportTarget | null>(() => {
    try {
      const raw = sessionStorage.getItem(telegramTargetKey);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed.nonce === 'number' && typeof parsed.query === 'string' && typeof parsed.title === 'string' ? parsed : null;
    } catch { return null; }
  });

  useEffect(() => {
    try {
      if (telegramImportTarget) sessionStorage.setItem(telegramTargetKey, JSON.stringify(telegramImportTarget));
      else sessionStorage.removeItem(telegramTargetKey);
    } catch {}
  }, [telegramImportTarget, telegramTargetKey]);

  const telegramTargetUser = useRef(currentUser?.username || 'guest');
  useEffect(() => {
    const user = currentUser?.username || 'guest';
    if (telegramTargetUser.current === user) return;
    telegramTargetUser.current = user;
    setTelegramImportTarget(null);
  }, [currentUser?.username]);

  // Inicializar datos del usuario actual (o invitado)
  const initialUserData = useMemo(() => {
    return getLocalUserData(currentUser ? currentUser.username : 'invitado');
  }, []);

  // ==========================================
  // LISTAS DE REPRODUCCIÓN (PLAYLISTS AISLADAS POR USUARIO)
  // ==========================================
  const [playlists, setPlaylists] = useState<Playlist[]>(() => initialUserData.playlists);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [isNewPlaylistModalOpen, setIsNewPlaylistModalOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  const [playlistModalTrack, setPlaylistModalTrack] = useState<Track | null>(null);

  // ==========================================
  // HISTORIAL SPOTIFY (+50% ESCUCHADO & GUSTOS AISLADOS)
  // ==========================================
  const [favorites50List, setFavorites50List] = useState<Track[]>(() => initialUserData.favorites50List);
  const [userTasteProfile, setUserTasteProfile] = useState<{
    favoriteArtists: Record<string, number>;
    favoriteGenres: Record<string, number>;
  }>(() => initialUserData.userTasteProfile);

  const listeningRef = useRef({ trackId: '', lastTime: 0, lastWall: 0, listened: 0, counted: false });
  const recentTracksRef = useRef<Track[]>([]);
  const nextRequestRef = useRef(0);
  const relatedRequestRef = useRef<{ trackId: string; promise: Promise<Track[]> } | null>(null);
  const hasSelectedMusicRef = useRef(false);
  const [musicSelection, setMusicSelection] = useState(0);
  const [relatedTracks, setRelatedTracks] = useState<Track[]>([]);
  const [regionalTracks, setRegionalTracks] = useState<Track[]>([]);
  const [prefetchedAutoDjTrack, setPrefetchedAutoDjTrack] = useState<Track | null>(null);
  const [backgroundImportTarget, setBackgroundImportTarget] = useState<TelegramImportTarget | null>(null);
  const [backgroundImportBusy, setBackgroundImportBusy] = useState(false);
  const waitingForPrefetchRef = useRef(false);
  const prefetchAttemptedRef = useRef<Set<string>>(new Set());
  const [regionalLoading, setRegionalLoading] = useState(true);
  const [personalTracks, setPersonalTracks] = useState<Track[]>([]);
  const [musicRegion, setMusicRegion] = useState(() => localStorage.getItem('thomas_music_region') || 'CO');

  // Guardar datos del usuario activo en cada cambio
  useEffect(() => {
    const u = currentUser ? currentUser.username : 'invitado';
    saveLocalUserData(u, { playlists, favorites50List, userTasteProfile }, fastApiUrl);
  }, [playlists, favorites50List, userTasteProfile, currentUser, fastApiUrl]);

  useEffect(() => {
    if (!currentUser) { setSyncStatus('local'); return; }
    const username = currentUser.username;
    const refresh = () => { setSyncStatus(getSyncState(username, fastApiUrl)); void syncUserData(username, fastApiUrl); };
    const onStatus = (event: Event) => setSyncStatus((event as CustomEvent<string>).detail);
    const onData = (event: Event) => {
      const detail = (event as CustomEvent<{ username: string; server: string; data: UserData }>).detail;
      if (detail.username !== username || detail.server !== fastApiUrl) return;
      setPlaylists(detail.data.playlists);
      setFavorites50List(detail.data.favorites50List);
      setUserTasteProfile(detail.data.userTasteProfile);
    };
    window.addEventListener('music-sync', onStatus);
    window.addEventListener('music-sync-data', onData);
    window.addEventListener('online', refresh);
    refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => { window.removeEventListener('music-sync', onStatus); window.removeEventListener('music-sync-data', onData); window.removeEventListener('online', refresh); window.clearInterval(timer); };
  }, [currentUser?.username, fastApiUrl]);

  const loadConflictPreview = async () => {
    if (!currentUser) return;
    setSyncBusy(true);
    setConflictError('');
    setConflictPreview(null);
    try {
      setConflictPreview(await getConflictPreview(currentUser.username, fastApiUrl));
    } catch (error: any) { setConflictError(error.message || 'No se pudieron comparar las versiones'); }
    finally { setSyncBusy(false); }
  };

  const handleResolveSync = async (choice: 'local' | 'server' | 'merge') => {
    if (!currentUser || !conflictPreview) return;
    const localNow = JSON.stringify({ playlists, favorites50List, userTasteProfile });
    if (localNow !== conflictPreview.localSnapshot) {
      setConflictError('Los datos de este dispositivo cambiaron. Actualiza la comparación antes de continuar.');
      return;
    }
    const message = choice === 'local'
      ? '¿Reemplazar la biblioteca del servidor con la de este dispositivo?'
      : choice === 'server'
        ? '¿Reemplazar la biblioteca de este dispositivo con la del servidor?'
        : '¿Conservar ambas versiones? Las playlists con cambios distintos se duplicarán y algunas canciones borradas podrían reaparecer.';
    if (!window.confirm(message)) return;
    setSyncBusy(true);
    setConflictError('');
    try {
      const data = await resolveSyncConflict(currentUser.username, fastApiUrl, choice, conflictPreview);
      if (data) {
        setPlaylists(data.playlists);
        setFavorites50List(data.favorites50List);
        setUserTasteProfile(data.userTasteProfile);
      }
      setConflictOpen(false);
      setConflictPreview(null);
      showToast(choice === 'server' ? 'Biblioteca del servidor cargada' : 'Cambios preparados para sincronizar');
    } catch (error: any) { setConflictError(error.message || 'No se pudo resolver el conflicto'); }
    finally { setSyncBusy(false); }
  };

  const downloadConflictCopy = (data: UserData, label: string) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `diaz-music-${label}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Modal para configuración de Servidor
  const [showServerModal, setShowServerModal] = useState(false);

  // Métodos de autenticación
  const applyLoadedUserData = (user: UserProfile | null, data?: UserData) => {
    updatePlaybackQueue(null);
    recentTracksRef.current = [];
    listeningRef.current = { trackId: '', lastTime: 0, lastWall: 0, listened: 0, counted: false };
    setCurrentUser(user);
    saveSessionUser(user);
    const uData = data || getLocalUserData(user ? user.username : 'invitado');
    setPlaylists(uData.playlists || []);
    setFavorites50List(uData.favorites50List || []);
    setUserTasteProfile(uData.userTasteProfile || { favoriteArtists: {}, favoriteGenres: {} });
    setSelectedPlaylistId(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthLoading(true);
    try {
      const res = await loginUser(authUsername, authPassword, fastApiUrl);
      applyLoadedUserData(res.user, res.data);
      setIsAuthModalOpen(false);
      setAuthPassword('');
      showToast(`¡Bienvenido de nuevo, ${res.user.displayName}!`);
    } catch (err: any) {
      setAuthError(err.message || 'Error al iniciar sesión');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthLoading(true);
    try {
      const res = await registerUser(authUsername, authPassword, authDisplayName, fastApiUrl);
      applyLoadedUserData(res.user, res.data);
      setIsAuthModalOpen(false);
      setAuthPassword('');
      showToast(`¡Cuenta creada con éxito! Bienvenido, ${res.user.displayName}`);
    } catch (err: any) {
      setAuthError(err.message || 'Error al crear cuenta');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = () => {
    saveSessionUser(null);
    applyLoadedUserData(null);
    setIsUserMenuOpen(false);
    showToast('Sesión cerrada. Modo invitado activo.');
  };

  // PWA & Hardware Intercom States
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [isInstalledPwa, setIsInstalledPwa] = useState(false);
  const [isWakeLockActive, setIsWakeLockActive] = useState(false);

  // REA Spotify Importer
  const [spotifyImportUrl, setSpotifyImportUrl] = useState('');
  const [isImportingSpotify, setIsImportingSpotify] = useState(false);

  // DSP & Audio Effects
  const [eqGains, setEqGains] = useState<number[]>([2, 1, 0, 1, 3]);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [lowpassFreq, setLowpassFreq] = useState(20000);
  const [stereoPan, setStereoPan] = useState(0);
  const [is8DAudio, setIs8DAudio] = useState(false);
  const [activePreset, setActivePreset] = useState<AudioPreset>('normal');
  const [useSynthFallback, setUseSynthFallback] = useState(false);

  // Loop A-B
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);

  // Algoritmo IA
  const algoEnergyTarget = 75;
  const algoAcousticTarget = 30;
  const algoBpmTarget = 120;
  const [autoRadioEnabled, setAutoRadioEnabled] = useState(true);

  // Timestamp Notes
  const [trackNotes, setTrackNotes] = useState<Record<string, { time: number; note: string }[]>>({});
  const [newNoteText, setNewNoteText] = useState('');

  // Jamendo Music Integration (Canciones completas sin 30s)
  const initialJamendoKey = getStoredJamendoClientId();
  const [jamendoClientId, setJamendoClientId] = useState(initialJamendoKey);
  const [jamendoInputKey, setJamendoInputKey] = useState(initialJamendoKey);
  const [jamendoTracks, setJamendoTracks] = useState<Track[]>([]);
  const [selectedJamendoGenre, setSelectedJamendoGenre] = useState('all');
  const [isLoadingJamendo, setIsLoadingJamendo] = useState(false);

  // Cargar canciones completas de Jamendo
  useEffect(() => {
    setIsLoadingJamendo(true);
    fetchTrendingJamendo(selectedJamendoGenre, jamendoClientId)
      .then((res) => {
        setJamendoTracks(res);
        setIsLoadingJamendo(false);
      })
      .catch(() => setIsLoadingJamendo(false));
  }, [selectedJamendoGenre, jamendoClientId]);

  const handleSaveJamendoKey = (newKey: string) => {
    if (!newKey.trim()) return;
    saveJamendoClientId(newKey.trim());
    setJamendoClientId(newKey.trim());
    setJamendoInputKey(newKey.trim());
    showToast('Clave Client ID de Jamendo guardada con éxito');
    setIsLoadingJamendo(true);
    fetchTrendingJamendo(selectedJamendoGenre, newKey.trim()).then((res) => {
      setJamendoTracks(res);
      setIsLoadingJamendo(false);
      if (res.length > 0) {
        showToast('¡Clave Jamendo verificada! Catálogo completo disponible');
      }
    });
  };

  // ==========================================
  // ESTADO DE REPRODUCCIÓN SEPARADO (MÚSICA vs RADIO)
  // ==========================================
  const [activeAudioSource, setActiveAudioSource] = useState<'music' | 'radio'>('music');
  const [currentRadioStation, setCurrentRadioStation] = useState<Track>(DEFAULT_RADIO_STATIONS[0]);

  // ==========================================
  // RADIO BROWSER API & EMISORAS EN VIVO (FM/AM)
  // ==========================================
  const [radioStations, setRadioStations] = useState<Track[]>(DEFAULT_RADIO_STATIONS);
  const [selectedRadioCountry, setSelectedRadioCountry] = useState('CO');
  const [radioSearchQuery, setRadioSearchQuery] = useState('');
  const [isLoadingRadio, setIsLoadingRadio] = useState(false);

  // Cargar emisoras por país seleccionado
  const handleSelectRadioCountry = async (countryCode: string) => {
    setSelectedRadioCountry(countryCode);
    setIsLoadingRadio(true);
    try {
      const results = await fetchStationsByCountry(countryCode, 40);
      if (countryCode === 'CO') {
        const defaultsIds = new Set(DEFAULT_RADIO_STATIONS.map((s) => s.id));
        const customUnique = results.filter((r) => !defaultsIds.has(r.id));
        setRadioStations([...DEFAULT_RADIO_STATIONS, ...customUnique]);
      } else {
        setRadioStations(results.length > 0 ? results : DEFAULT_RADIO_STATIONS);
      }
    } catch (err) {
      console.warn('Error cargando emisoras de radio:', err);
    } finally {
      setIsLoadingRadio(false);
    }
  };

  // Buscar emisoras en Radio Browser
  const handleSearchRadio = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!radioSearchQuery.trim()) {
      handleSelectRadioCountry(selectedRadioCountry);
      return;
    }
    setIsLoadingRadio(true);
    try {
      const results = await searchRadioStations(radioSearchQuery, selectedRadioCountry);
      if (results.length > 0) {
        setRadioStations(results);
        showToast(`Se encontraron ${results.length} emisoras para "${radioSearchQuery}"`);
      } else {
        showToast(`No se encontraron emisoras con "${radioSearchQuery}"`);
      }
    } catch (err) {
      console.warn('Error buscando emisoras:', err);
    } finally {
      setIsLoadingRadio(false);
    }
  };

  // Sintonizar emisora de radio con 0 cortes (Sin mezclar con la lista de canciones)
  const playRadioStation = (station: Track) => {
    const ticket = playbackIntentRef.current.play('radio');
    cancelStandbyPrime();
    updatePlaybackQueue(null);
    nextRequestRef.current++;
    setIsBuffering(false);
    setUseSynthFallback(false);
    setActiveAudioSource('radio');
    setCurrentRadioStation(station);
    setIsPlaying(true);
    setCurrentTime(0);
    setDuration(0);
    setLoopA(null);
    setLoopB(null);

    // Pausar reproductor de pistas si estaba activo
    if (audioRef.current) {
      audioRef.current.pause();
    }

    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(console.warn);
    }

    // El stream de radio usa el reproductor nativo radioAudioRef sin restricciones CORS
    if (radioAudioRef.current) {
      radioAudioRef.current.src = station.audioUrl;
      radioAudioRef.current.volume = isMuted ? 0 : Math.min(1, Math.max(0, volume));
      radioAudioRef.current.load();
      radioAudioRef.current.play().then(() => {
        if (playbackIntentRef.current.isCurrent(ticket, 'radio')) setIsPlaying(true);
      }).catch(() => {
        if (!playbackIntentRef.current.isCurrent(ticket, 'radio')) return;
        playbackIntentRef.current.pause();
        setIsPlaying(false);
        showToast('No se pudo reproducir la emisora. Comprueba la conexión o prueba otra.');
      });
    }

    showToast(`🔴 Sintonizando en vivo: ${station.title}`);
  };

  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Auto-verificar conexión con el servidor de streaming al cargar
  useEffect(() => {
    const autoProbeServer = async () => {
      try {
        const res = await fetch(`${fastApiUrl}/`, { signal: AbortSignal.timeout(1800) });
        if (res.ok) {
          setServerStatus('connected');
        }
      } catch {
        // Servidor apagado
      }
    };
    autoProbeServer();
  }, [fastApiUrl]);

  // Audio References (Doble canal independiente: Música DSP y Radio Nativa sin cortes)
  // La música usa dos decks A/B: mientras uno suena, el otro precarga la siguiente
  // pista. Al terminar la actual se intercambian sin dejar un silencio que permita
  // a Chrome Android suspender el JavaScript y retirar los controles multimedia.
  const audioDeckARef = useRef<HTMLAudioElement | null>(null);
  const audioDeckBRef = useRef<HTMLAudioElement | null>(null);
  const activeDeckRef = useRef<'a' | 'b'>('a');
  const deckUrlsRef = useRef<{ a: string | null; b: string | null }>({ a: null, b: null });
  const standbyTrackIdRef = useRef<string | null>(null);
  const standbyPrimedRef = useRef(false);
  const handleNextTrackRef = useRef<() => void>(() => {});
  const audioRef = useMemo(() => ({
    get current(): HTMLAudioElement | null {
      return activeDeckRef.current === 'a' ? audioDeckARef.current : audioDeckBRef.current;
    }
  }), []);
  const radioAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const eqNodesRef = useRef<BiquadFilterNode[]>([]);
  const lowpassNodeRef = useRef<BiquadFilterNode | null>(null);
  const pannerNodeRef = useRef<StereoPannerNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodesRef = useRef<Record<'a' | 'b', MediaElementAudioSourceNode | null>>({ a: null, b: null });
  const deckGainNodesRef = useRef<Record<'a' | 'b', GainNode | null>>({ a: null, b: null });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const synthIntervalRef = useRef<any>(null);

  const currentMusicTrack = tracks[currentTrackIndex] || tracks[0] || {
    ...INITIAL_TRACKS[0], id: 'empty', title: 'Elige una canción', artist: '', album: '',
    audioUrl: '', coverUrl: '/icons/icon.svg', cachedOffline: false, liked: false, lyrics: []
  };
  const currentTrack = activeAudioSource === 'radio' ? currentRadioStation : currentMusicTrack;

  const deckElement = (deck: AudioDeck) => deck === 'a' ? audioDeckARef.current : audioDeckBRef.current;
  const standbyDeck = (): AudioDeck => selectStandbyDeck(activeDeckRef.current);
  const isActiveDeck = (deck: AudioDeck) => activeDeckRef.current === deck;
  const normalizeAudioUrl = (url: string) => {
    try { return new URL(url, window.location.href).href; } catch { return url; }
  };
  const setDeckGain = (deck: 'a' | 'b', value: number) => {
    const node = deckGainNodesRef.current[deck];
    const ctx = audioCtxRef.current;
    if (node && ctx) {
      try { node.gain.setTargetAtTime(value, ctx.currentTime, 0.02); } catch {}
    }
  };
  const cancelStandbyPrime = () => {
    if (!standbyPrimedRef.current) return;
    standbyPrimedRef.current = false;
    const deck = standbyDeck();
    const element = deckElement(deck);
    if (element) {
      element.pause();
      try { element.currentTime = 0; } catch {}
    }
    setDeckGain(deck, 1);
  };

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3800);
  };

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  // Prefetch suggestions without changing the song chosen by the listener.
  useEffect(() => {
    if (!autoRadioEnabled || activeAudioSource !== 'music' || !hasSelectedMusicRef.current) return;
    let cancelled = false;
    setRelatedTracks([]);
    const query = recommendationQuery(currentMusicTrack, recentTracksRef.current.slice(-5).map(t => t.artist));
    const request = { trackId: currentMusicTrack.id,
      promise: searchYouTubeStream(fastApiUrl, query, AbortSignal.timeout(20000)).catch(() => [] as Track[]) };
    relatedRequestRef.current = request;
    request.promise.then(results => {
      if (!cancelled) setRelatedTracks(results);
    });
    return () => { cancelled = true; if (relatedRequestRef.current === request) relatedRequestRef.current = null; };
  }, [currentMusicTrack.id, musicSelection, autoRadioEnabled, activeAudioSource, fastApiUrl]);

  useEffect(() => {
    const colombia = musicRegion === 'CO' || (musicRegion === 'auto' && (navigator.languages?.some(lang => /-CO\b/i.test(lang)) || /-CO\b/i.test(navigator.language)));
    if (!isOnline) { setRegionalTracks([]); setRegionalLoading(false); return; }
    let cancelled = false;
    setRegionalLoading(true);
    const query = colombia ? 'éxitos Colombia 2026' : 'éxitos globales 2026';
    searchYouTubeStream(fastApiUrl, query, AbortSignal.timeout(20000)).then(results => {
      if (!cancelled) setRegionalTracks(results);
    }).catch(() => { if (!cancelled) setRegionalTracks([]); })
      .finally(() => { if (!cancelled) setRegionalLoading(false); });
    return () => { cancelled = true; };
  }, [fastApiUrl, musicRegion, isOnline]);

  useEffect(() => {
    const seed = favorites50List.find(track => !INITIAL_TRACKS.some(demo => demo.id === track.id && track.sourceType === 'curated'));
    if (!seed || !isOnline) { setPersonalTracks([]); return; }
    let cancelled = false;
    searchYouTubeStream(fastApiUrl, recommendationQuery(seed), AbortSignal.timeout(20000)).then(results => {
      if (!cancelled) setPersonalTracks(results);
    }).catch(() => { if (!cancelled) setPersonalTracks([]); });
    return () => { cancelled = true; };
  }, [fastApiUrl, favorites50List, isOnline]);

  // ==========================================
  // ALGORITMO SPOTIFY (+50% ESCUCHADO)
  // ==========================================
  const registerTrack50PercentListened = (track: Track) => {
    if (!track || !track.id) return;
    setFavorites50List((prev) => {
      const updated = [{ ...track, liked: true }, ...prev.filter(t => t.id !== track.id && (t.title !== track.title || t.artist !== track.artist))];
      try {
        localStorage.setItem('thomas_music_favorites_50', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setUserTasteProfile((prev) => {
      const artCount = (prev.favoriteArtists[track.artist] || 0) + 1;
      const genre = trackGenre(track);
      const genCount = (prev.favoriteGenres[genre] || 0) + 1;
      const updated = {
        favoriteArtists: { ...prev.favoriteArtists, [track.artist]: artCount },
        favoriteGenres: genre ? { ...prev.favoriteGenres, [genre]: genCount } : prev.favoriteGenres
      };
      try {
        localStorage.setItem('thomas_music_taste_profile', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    showToast(`❤️ ¡Guardada en Favoritas! Escuchaste +50% de "${track.title}"`);
  };

  // ==========================================
  // GESTIÓN DE PLAYLISTS
  // ==========================================
  const handleCreatePlaylist = (name: string, description?: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      showToast('Por favor escribe un nombre para la lista');
      return;
    }
    const newPlaylist: Playlist = {
      id: `playlist-${Date.now()}`,
      name: trimmed,
      description: description?.trim() || 'Lista personalizada',
      coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
      createdAt: Date.now(),
      tracks: []
    };
    setPlaylists((prev) => [newPlaylist, ...prev]);
    setIsNewPlaylistModalOpen(false);
    setNewPlaylistName('');
    setNewPlaylistDesc('');
    showToast(`Playlist "${trimmed}" creada con éxito`);
  };

  const handleAddTrackToPlaylist = (playlistId: string, track: Track) => {
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id !== playlistId) return pl;
        const exists = pl.tracks.some((t) => t.id === track.id || (t.title === track.title && t.artist === track.artist));
        if (exists) {
          showToast(`La canción ya estaba en "${pl.name}"`);
          return pl;
        }
        const updatedTracks = [...pl.tracks, track];
        showToast(`Añadida a "${pl.name}"`);
        return {
          ...pl,
          tracks: updatedTracks,
          coverUrl: pl.tracks.length === 0 ? track.coverUrl : pl.coverUrl
        };
      })
    );
    setPlaylistModalTrack(null);
  };

  const handleRemoveTrackFromPlaylist = (playlistId: string, trackId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id !== playlistId) return pl;
        return {
          ...pl,
          tracks: pl.tracks.filter((t) => t.id !== trackId)
        };
      })
    );
    showToast('Canción retirada de la playlist');
  };

  const handleDeletePlaylist = (playlistId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPlaylists((prev) => prev.filter((pl) => pl.id !== playlistId));
    if (selectedPlaylistId === playlistId) {
      setSelectedPlaylistId(null);
    }
    showToast('Playlist eliminada');
  };

  const handlePlayPlaylist = (playlist: Playlist, startIndex = 0) => {
    const queue = createPlaybackQueue(playlist.name, playlist.tracks || [], startIndex);
    if (!queue) {
      showToast('Esta playlist está vacía');
      return;
    }
    updatePlaybackQueue(queue);
    setTracks(queue.tracks);
    playSong(queue.tracks[queue.index], true, true);
    showToast(`Reproduciendo playlist: ${playlist.name}`);
  };

  // ==========================================
  // SUGERENCIAS DE BÚSQUEDA Y AUTOCOMPLETADO
  // ==========================================
  const handleSearchInputChange = (val: string) => {
    setSearchQuery(val);
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    if (val.trim().length >= 2) {
      searchDebounceRef.current = setTimeout(async () => {
        try {
          const suggestions = await fetchSearchSuggestions(val, fastApiUrl, searchProviderRef.current);
          if (searchProviderRef.current !== searchProvider) return;
          const localMatches = tracks
            .filter((t) =>
              (t.title || '').toLowerCase().includes(val.toLowerCase()) ||
              (t.artist || '').toLowerCase().includes(val.toLowerCase())
            )
            .map((t) => `${t.artist} - ${t.title}`);
          const combined = Array.from(new Set([...suggestions, ...localMatches])).slice(0, 8);
          setSearchSuggestions(combined);
          setIsSuggestionsOpen(combined.length > 0);
        } catch {
          setIsSuggestionsOpen(false);
        }
      }, 160);
    } else {
      setSearchSuggestions([]);
      setIsSuggestionsOpen(false);
    }
  };

  const handleSelectSuggestion = (suggestion: string) => {
    setSearchQuery(suggestion);
    setIsSuggestionsOpen(false);
    executeOnlineSearch(suggestion);
  };

  // Paginación de resultados de búsqueda (10 por página)
  const totalSearchPages = Math.ceil(onlineSearchResults.length / SEARCH_PAGE_SIZE) || 1;
  const paginatedSearchResults = useMemo(() => {
    const start = (searchCurrentPage - 1) * SEARCH_PAGE_SIZE;
    return onlineSearchResults.slice(start, start + SEARCH_PAGE_SIZE);
  }, [onlineSearchResults, searchCurrentPage]);

  // ==========================================
  // INICIALIZACIÓN PWA & DETECCIÓN INSTALACIÓN
  // ==========================================
  useEffect(() => {
    // Detectar si ya corre como PWA en pantalla completa
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalledPwa(true);
    }

    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const installPwaApp = async () => {
    if (!deferredInstallPrompt) {
      showToast('En iPhone/iPad toca "Compartir" y luego "Agregar a pantalla de inicio"');
      return;
    }
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalledPwa(true);
      showToast('¡Thomas Music instalado en tu celular!');
    }
    setDeferredInstallPrompt(null);
  };

  // ==========================================
  // CARGAR CANCIONES OFFLINE DESDE INDEXEDDB AL INICIAR
  // ==========================================
  useEffect(() => {
    let active = true;
    getAllOfflineTracks().then((saved) => {
      if (active) { updateOfflineTracks(saved); setVaultReady(true); }
    }).catch((error) => {
      console.warn('No se pudo abrir la bóveda:', error);
      if (active) { setVaultReady(true); showToast('No se pudo abrir la bóveda offline en este dispositivo.'); }
    });

    return () => { active = false; };
  }, []);

  // ==========================================
  // MOTOR WEB AUDIO API DSP
  // ==========================================
  const connectDeckSource = (ctx: AudioContext, eqNodes: BiquadFilterNode[], deck: 'a' | 'b', element: HTMLAudioElement | null) => {
    if (!element || sourceNodesRef.current[deck] || !eqNodes.length) return;
    try {
      const source = ctx.createMediaElementSource(element);
      const deckGain = ctx.createGain();
      deckGain.gain.value = 1;
      source.connect(deckGain);
      deckGain.connect(eqNodes[0]);
      sourceNodesRef.current[deck] = source;
      deckGainNodesRef.current[deck] = deckGain;
    } catch (err) {
      console.warn(`No se pudo conectar el deck ${deck} al motor DSP:`, err);
    }
  };

  const initWebAudio = () => {
    if (audioCtxRef.current) {
      connectDeckSource(audioCtxRef.current, eqNodesRef.current, 'a', audioDeckARef.current);
      connectDeckSource(audioCtxRef.current, eqNodesRef.current, 'b', audioDeckBRef.current);
      return;
    }
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') ctx.resume().catch(console.warn);
      watchAudioContextRecovery(
        ctx,
        () => playbackIntentRef.current.wants('music'),
        error => console.warn('No se pudo recuperar el AudioContext durante la reproducción:', error)
      );

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyserRef.current = analyser;

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = lowpassFreq;
      lowpassNodeRef.current = lowpass;

      const panner = ctx.createStereoPanner();
      panner.pan.value = stereoPan;
      pannerNodeRef.current = panner;

      const masterGain = ctx.createGain();
      masterGain.gain.value = isMuted ? 0 : volume;
      gainNodeRef.current = masterGain;

      const eqNodes = EQ_BANDS.map((band, idx) => {
        const filter = ctx.createBiquadFilter();
        filter.type = idx === 0 ? 'lowshelf' : idx === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking';
        filter.frequency.value = band.freq;
        filter.Q.value = 1.2;
        filter.gain.value = eqGains[idx];
        return filter;
      });
      eqNodesRef.current = eqNodes;

      let prevNode: AudioNode = eqNodes[0];
      eqNodes.slice(1).forEach((node) => {
        prevNode.connect(node);
        prevNode = node;
      });
      prevNode.connect(lowpass);
      lowpass.connect(panner);
      panner.connect(masterGain);
      masterGain.connect(analyser);
      analyser.connect(ctx.destination);

      connectDeckSource(ctx, eqNodes, 'a', audioDeckARef.current);
      connectDeckSource(ctx, eqNodes, 'b', audioDeckBRef.current);
    } catch (err) {
      console.warn('Fallback a modo visualización reactiva:', err);
    }
  };

  // Sintetizador Procedural de respaldo en vivo
  const startProceduralSynth = () => {
    initWebAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    stopProceduralSynth();
    let step = 0;
    const notes = [110, 130.81, 146.83, 164.81, 196.00, 220.00, 261.63, 293.66];
    const stepTime = (60 / (currentTrack.bpm * playbackSpeed)) * 500;

    synthIntervalRef.current = setInterval(() => {
      if (!isPlaying) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      osc.type = step % 2 === 0 ? 'sawtooth' : 'triangle';
      const freq = notes[step % notes.length] * (step % 4 === 0 ? 0.5 : 1) * playbackSpeed;
      osc.frequency.setValueAtTime(freq, now);

      noteGain.gain.setValueAtTime(0.18, now);
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(noteGain);
      if (eqNodesRef.current.length > 0) {
        noteGain.connect(eqNodesRef.current[0]);
      } else if (analyserRef.current) {
        noteGain.connect(analyserRef.current);
      }

      osc.start(now);
      osc.stop(now + 0.36);
      step++;
    }, stepTime);
  };

  const stopProceduralSynth = () => {
    if (synthIntervalRef.current) {
      clearInterval(synthIntervalRef.current);
      synthIntervalRef.current = null;
    }
  };

  useEffect(() => {
    if (useSynthFallback && isPlaying) {
      if (audioRef.current) audioRef.current.pause();
      startProceduralSynth();
    } else {
      stopProceduralSynth();
    }
    return () => stopProceduralSynth();
  }, [useSynthFallback, isPlaying, currentTrackIndex, playbackSpeed]);

  // DSP Parameter Updates
  useEffect(() => {
    eqNodesRef.current.forEach((node, idx) => {
      if (node && audioCtxRef.current) {
        node.gain.setTargetAtTime(eqGains[idx], audioCtxRef.current.currentTime, 0.05);
      }
    });
  }, [eqGains]);

  useEffect(() => {
    if (lowpassNodeRef.current && audioCtxRef.current) {
      lowpassNodeRef.current.frequency.setTargetAtTime(lowpassFreq, audioCtxRef.current.currentTime, 0.05);
    }
  }, [lowpassFreq]);

  useEffect(() => {
    for (const audio of [audioDeckARef.current, audioDeckBRef.current]) {
      if (!audio) continue;
      audio.playbackRate = playbackSpeed;
      if ('preservesPitch' in audio) {
        (audio as any).preservesPitch = activePreset === 'normal';
      }
    }
  }, [playbackSpeed, activePreset]);

  useEffect(() => {
    const targetVol = isMuted ? 0 : Math.min(1, Math.max(0, volume));
    for (const audio of [audioDeckARef.current, audioDeckBRef.current]) {
      // El elemento HTMLAudioElement solo acepta rango [0, 1]
      if (audio) audio.volume = targetVol;
    }
    if (radioAudioRef.current) {
      radioAudioRef.current.volume = targetVol;
    }
    if (gainNodeRef.current && audioCtxRef.current) {
      // Web Audio API GainNode permite amplificación limpia por encima de 100% (hasta 2.0 = 200%)
      gainNodeRef.current.gain.setTargetAtTime(isMuted ? 0 : volume, audioCtxRef.current.currentTime, 0.05);
    }
  }, [volume, isMuted]);

  // Audio 8D Espacial
  useEffect(() => {
    if (!is8DAudio) {
      setStereoPan(0);
      if (pannerNodeRef.current && audioCtxRef.current) {
        pannerNodeRef.current.pan.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.1);
      }
      return;
    }
    let angle = 0;
    const interval = setInterval(() => {
      angle += 0.08;
      const panVal = Math.sin(angle) * 0.88;
      setStereoPan(Number(panVal.toFixed(2)));
      if (pannerNodeRef.current && audioCtxRef.current) {
        pannerNodeRef.current.pan.setTargetAtTime(panVal, audioCtxRef.current.currentTime, 0.05);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [is8DAudio]);

  // Presets Rápidos del Ecualizador
  const applyAudioPreset = (presetName: AudioPreset) => {
    setActivePreset(presetName);
    if (presetName === 'normal') {
      setPlaybackSpeed(1.0);
      setLowpassFreq(20000);
      setEqGains([0, 0, 0, 0, 0]);
      setIs8DAudio(false);
      showToast('Estudio Original (Flat EQ 1.0x)');
    } else if (presetName === 'bassboost') {
      setPlaybackSpeed(1.0);
      setLowpassFreq(20000);
      setEqGains([11, 7, 0, 2, 3]);
      showToast('🔊 Mega Bass Boost (+11dB en 60Hz - Bajos Potentes)');
    } else if (presetName === 'subbass') {
      setPlaybackSpeed(1.0);
      setLowpassFreq(20000);
      setEqGains([12, 6, -1, -2, -3]);
      showToast('🔥 Sub-Bass Profundo (+12dB Subwoofer Activo)');
    } else if (presetName === 'reggaeton') {
      setPlaybackSpeed(1.0);
      setLowpassFreq(20000);
      setEqGains([9, 5, 2, 4, 3]);
      showToast('🎵 Preset Reggaeton & Urbano (Bajo marcado + Voces)');
    } else if (presetName === 'rock') {
      setPlaybackSpeed(1.0);
      setLowpassFreq(20000);
      setEqGains([6, 2, 1, 5, 7]);
      showToast('🎸 Preset Rock Enérgico (Graves firmes + Agudos)');
    } else if (presetName === 'pop') {
      setPlaybackSpeed(1.0);
      setLowpassFreq(20000);
      setEqGains([2, 2, 6, 4, 2]);
      showToast('🎤 Preset Pop & Voces Claras');
    } else if (presetName === 'electronic') {
      setPlaybackSpeed(1.0);
      setLowpassFreq(20000);
      setEqGains([10, 6, -1, 4, 6]);
      showToast('⚡ Preset Club & Electrónica (Pegada + Brillo)');
    } else if (presetName === 'acoustic') {
      setPlaybackSpeed(1.0);
      setLowpassFreq(20000);
      setEqGains([3, 4, 3, 2, 2]);
      showToast('🎻 Preset Acústico Natural');
    } else if (presetName === 'slowed') {
      setPlaybackSpeed(0.84);
      setLowpassFreq(6500);
      setEqGains([6, 4, -1, 2, 4]);
      showToast('Slowed + Reverb Activado (0.84x + Sub-Bass)');
    } else if (presetName === 'nightcore') {
      setPlaybackSpeed(1.25);
      setLowpassFreq(20000);
      setEqGains([2, 0, 2, 4, 5]);
      showToast('Nightcore Activado (1.25x High Pitch)');
    } else if (presetName === 'lofi') {
      setPlaybackSpeed(0.95);
      setLowpassFreq(1800);
      setEqGains([-2, 3, 2, -4, -8]);
      showToast('Filtro Vinilo Lo-Fi Radio (Pasa-bajos 1.8kHz)');
    }
  };

  // Mantener la reproducción de radio y música continua en segundo plano y al cambiar de pestaña
  useEffect(() => {
    const handleVisibilityResume = () => {
      if (document.visibilityState === 'visible') {
        cancelStandbyPrime();
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume().catch(console.warn);
        }
        if (activeAudioSource === 'music' && audioRef.current?.ended) {
          handleNextTrackRef.current();
          return;
        }
        if (isPlaying && playbackIntentRef.current.wants(activeAudioSource)) {
          if (activeAudioSource === 'radio') {
            if (radioAudioRef.current && (radioAudioRef.current.paused || radioAudioRef.current.readyState < 2 || radioAudioRef.current.error)) {
              console.log('Reanudando señal de radio al cambiar o volver de pestaña...');
              radioAudioRef.current.src = currentRadioStation.audioUrl;
              radioAudioRef.current.load();
              radioAudioRef.current.play().catch(console.warn);
            }
          } else if (activeAudioSource === 'music') {
            if (audioRef.current && audioRef.current.paused) {
              audioRef.current.play().catch(console.warn);
            }
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityResume);
    window.addEventListener('focus', handleVisibilityResume);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityResume);
      window.removeEventListener('focus', handleVisibilityResume);
    };
  }, [isPlaying, activeAudioSource, currentRadioStation]);

  const pausePlayback = () => {
    if (activeAudioSource === 'music' && currentMusicTrack.sourceType === 'youtube') {
      showToast('Usa los controles del reproductor de YouTube.');
      return;
    }
    nextRequestRef.current++;
    playbackIntentRef.current.pause();
    if (playbackTimeoutRef.current) clearTimeout(playbackTimeoutRef.current);
    cancelStandbyPrime();
    if (activeAudioSource === 'radio') radioAudioRef.current?.pause();
    else audioRef.current?.pause();
    setIsPlaying(false);
    setIsBuffering(false);
  };

  const resumePlayback = () => {
    const source = activeAudioSource;
    if (source === 'music' && !hasSelectedMusicRef.current) {
      showToast('Elige una canción para comenzar');
      return;
    }
    if (source === 'music' && currentMusicTrack.sourceType === 'youtube') {
      showToast('Usa los controles del reproductor de YouTube.');
      return;
    }
    // Si el navegador suspendió el JS justo al terminar la pista, al volver
    // a primer plano el elemento puede seguir en estado "ended". Avanzamos.
    if (source === 'music' && audioRef.current?.ended) {
      handleNextTrackRef.current();
      return;
    }
    nextRequestRef.current++;
    const ticket = playbackIntentRef.current.play(source);
    if (source === 'music' && useSynthFallback) {
      setIsPlaying(true);
      return;
    }
    const audio = source === 'radio' ? radioAudioRef.current : audioRef.current;
    if (!audio) {
      playbackIntentRef.current.pause();
      setIsPlaying(false);
      return;
    }
    if (source === 'radio') {
      // Una radio en vivo se reconecta al punto actual, no a un búfer detenido.
      audio.src = currentRadioStation.audioUrl;
      audio.load();
    } else {
      initWebAudio();
      if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume().catch(console.warn);
      if (!audio.getAttribute('src')) {
        const url = playbackUrl(currentMusicTrack, fastApiUrl, window.location.href);
        if (!url) {
          playbackIntentRef.current.pause();
          setIsPlaying(false);
          showToast('Esta canción no tiene un enlace de audio disponible.');
          return;
        }
        audio.src = url;
      }
      setIsBuffering(true);
    }
    audio.play().then(() => {
      if (playbackIntentRef.current.isCurrent(ticket, source)) setIsPlaying(true);
      else if (!playbackIntentRef.current.wants(source)) audio.pause();
    }).catch(() => {
      if (!playbackIntentRef.current.isCurrent(ticket, source)) return;
      playbackIntentRef.current.pause();
      setIsPlaying(false);
      setIsBuffering(false);
      showToast(source === 'radio' ? 'No se pudo reanudar la emisora. Prueba de nuevo.' : 'No se pudo reanudar esta canción.');
    });
  };

  // ==========================================
  // MEDIA SESSION & AUDÍFONOS / INTERCOMUNICADOR
  // ==========================================
  useEffect(() => {
    if (currentTrack && (musicSelection > 0 || activeAudioSource === 'radio')) {
      updateMediaSessionMetadata(currentTrack);
    }
  }, [currentTrack, musicSelection, activeAudioSource]);

  useEffect(() => {
    updateMediaSessionPlaybackState(isPlaying);
  }, [isPlaying, currentTrack.id, musicSelection, activeAudioSource]);

  useEffect(() => {
    registerMediaSessionHandlers({
      onPlay: resumePlayback,
      onPause: pausePlayback,
      onNext: () => handleNextTrack(),
      onPrev: () => handlePrevTrack(),
      onSeek: (targetTime) => {
        if (activeAudioSource === 'music' && currentMusicTrack.sourceType !== 'youtube' && audioRef.current) {
          audioRef.current.currentTime = targetTime;
          setCurrentTime(targetTime);
          updateMediaSessionPosition(targetTime, duration, playbackSpeed);
        }
      },
      onSeekRelative: (offset) => {
        if (activeAudioSource === 'music' && currentMusicTrack.sourceType !== 'youtube' && audioRef.current) {
          const newTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + offset));
          audioRef.current.currentTime = newTime;
          setCurrentTime(newTime);
          updateMediaSessionPosition(newTime, duration, playbackSpeed);
          showToast(`Salto: ${offset > 0 ? `+${offset}` : offset}s`);
        }
      }
    });
  }, [currentTrackIndex, tracks, duration, playbackSpeed, activeAudioSource, currentMusicTrack.sourceType, autoRadioEnabled, relatedTracks, personalTracks, onlineSearchResults, favorites50List, userTasteProfile, radioStations, currentRadioStation, unavailableTrackIds, offlineTracks, useSynthFallback, musicSelection]);

  const toggleWakeLock = async () => {
    if (isWakeLockActive) {
      releaseScreenWakeLock();
      setIsWakeLockActive(false);
      showToast('Modo Intercomunicador en suspensión desactivado');
    } else {
      const ok = await enableScreenWakeLock();
      if (ok) {
        setIsWakeLockActive(true);
        showToast('Modo Moto / Intercomunicador ACTIVO (Pantalla siempre despierta)');
      } else {
        showToast('WakeLock no permitido por el navegador');
      }
    }
  };

  // ==========================================
  // VISUALIZADOR DE ESPECTRO EN CANVAS (60 FPS)
  // ==========================================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId: number;
    let phase = 0;

    const renderFrame = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const bufferLength = 48;
      const dataArray = new Uint8Array(bufferLength);

      if (analyserRef.current && isPlaying) {
        analyserRef.current.getByteFrequencyData(dataArray);
      }

      const hasRealSignal = dataArray.some((v) => v > 0);
      if (!hasRealSignal && isPlaying) {
        phase += 0.12 * playbackSpeed;
        for (let i = 0; i < bufferLength; i++) {
          const bassFactor = i < 8 ? (eqGains[0] + 12) / 12 : 1;
          const lofiFactor = i > 25 && lowpassFreq < 4000 ? 0.2 : 1;
          const wave = Math.sin(phase + i * 0.35) * 0.5 + 0.5;
          const pulse = Math.abs(Math.sin(phase * (currentTrack.bpm / 60))) * 65;
          dataArray[i] = Math.min(255, Math.floor((wave * 110 + pulse) * bassFactor * lofiFactor));
        }
      }

      const primaryColor =
        themeAccent === 'emerald'
          ? '#10b981'
          : themeAccent === 'blue'
          ? '#3b82f6'
          : themeAccent === 'pink'
          ? '#ec4899'
          : themeAccent === 'cyberpunk'
          ? '#f43f5e'
          : '#8b5cf6';
      const secondaryColor =
        themeAccent === 'emerald'
          ? '#06b6d4'
          : themeAccent === 'blue'
          ? '#38bdf8'
          : themeAccent === 'pink'
          ? '#f43f5e'
          : themeAccent === 'cyberpunk'
          ? '#eab308'
          : '#ec4899';

      if (visualizerMode === 'bars') {
        const barWidth = (width / bufferLength) * 0.75;
        const gap = (width / bufferLength) * 0.25;

        for (let i = 0; i < bufferLength; i++) {
          const val = isPlaying ? dataArray[i] : 8;
          const barHeight = Math.max(4, (val / 255) * (height - 10));
          const x = i * (barWidth + gap);
          const y = height - barHeight;

          const grad = ctx.createLinearGradient(0, height, 0, 0);
          grad.addColorStop(0, primaryColor);
          grad.addColorStop(1, secondaryColor);

          ctx.fillStyle = grad;
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(x, y, barWidth, barHeight, 3);
          } else {
            ctx.rect(x, y, barWidth, barHeight);
          }
          ctx.fill();
        }
      } else if (visualizerMode === 'wave') {
        ctx.lineWidth = 3;
        const grad = ctx.createLinearGradient(0, 0, width, 0);
        grad.addColorStop(0, primaryColor);
        grad.addColorStop(1, secondaryColor);
        ctx.strokeStyle = grad;
        ctx.beginPath();

        const sliceWidth = width / (bufferLength - 1);
        for (let i = 0; i < bufferLength; i++) {
          const val = isPlaying ? dataArray[i] : 128;
          const y = height / 2 + ((val - 128) / 128) * (height * 0.4);
          const x = i * sliceWidth;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else if (visualizerMode === 'circle') {
        const cx = width / 2;
        const cy = height / 2;
        const radius = Math.min(width, height) * 0.24;

        for (let i = 0; i < bufferLength; i++) {
          const val = isPlaying ? dataArray[i] : 10;
          const angle = (i / bufferLength) * Math.PI * 2;
          const len = (val / 255) * (radius * 0.9);

          const x1 = cx + Math.cos(angle) * radius;
          const y1 = cy + Math.sin(angle) * radius;
          const x2 = cx + Math.cos(angle) * (radius + len);
          const y2 = cy + Math.sin(angle) * (radius + len);

          ctx.strokeStyle = i % 2 === 0 ? primaryColor : secondaryColor;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }

      animId = requestAnimationFrame(renderFrame);
    };

    renderFrame();
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, visualizerMode, themeAccent, playbackSpeed, eqGains, lowpassFreq, currentTrack]);

  // ==========================================
  // CONTROL DE REPRODUCCIÓN & LOOP A-B
  // ==========================================
  const togglePlay = () => {
    if (playbackIntentRef.current.wants(activeAudioSource)) pausePlayback();
    else resumePlayback();
  };

  const resolvePlayableMusic = (track: Track):
    | { ok: true; sourceTrack: Track; resolvedUrl: string }
    | { ok: false; reason: 'offline' | 'no-url' } => {
    const offlineCopy = track.sourceType === 'youtube' ? undefined : offlineTracksRef.current.find(item => item.id === track.id);
    if (!navigator.onLine && !offlineCopy) return { ok: false, reason: 'offline' };
    const sourceTrack: Track = track.sourceType === 'youtube' && /^yt-[A-Za-z0-9_-]{11}$/.test(track.id)
      ? { ...track, sourceType: 'invidious', audioUrl: `/stream_yt?v=${track.id.slice(3)}` }
      : offlineCopy || track;
    const resolvedUrl = playbackUrl(sourceTrack, fastApiUrl, window.location.href);
    if (!resolvedUrl) return { ok: false, reason: 'no-url' };
    return { ok: true, sourceTrack, resolvedUrl };
  };

  // Deja la siguiente pista lista en el deck que no está sonando. Así, cuando
  // termina la actual, no hay que abrir una conexión nueva ni esperar al
  // servidor: el cambio ocurre en milisegundos y el media session no se pierde.
  const prepareStandbyTrack = (upcoming: Track | null | undefined) => {
    if (!upcoming || activeAudioSource !== 'music' || useSynthFallback) return;
    if (!playbackIntentRef.current.wants('music')) return;
    const resolved = resolvePlayableMusic(upcoming);
    if (!resolved.ok) return;
    const deck = standbyDeck();
    const element = deckElement(deck);
    if (!element || isActiveDeck(deck)) return;
    const normalized = normalizeAudioUrl(resolved.resolvedUrl);
    if (deckUrlsRef.current[deck] === normalized && !element.error) {
      // Si el deck ya se usó antes, vuelve al inicio para que el intercambio
      // no tenga que hacer un seek costoso justo al terminar la pista actual.
      if (element.ended || element.currentTime > 0.05) {
        try { element.currentTime = 0; } catch {}
      }
      standbyTrackIdRef.current = upcoming.id;
      return;
    }
    try {
      cancelStandbyPrime();
      element.pause();
      element.preload = 'auto';
      element.src = resolved.resolvedUrl;
      element.load();
      deckUrlsRef.current[deck] = normalized;
      standbyTrackIdRef.current = upcoming.id;
    } catch (error) {
      deckUrlsRef.current[deck] = null;
      standbyTrackIdRef.current = null;
      console.warn('No se pudo precargar la siguiente pista:', error);
    }
  };

  const startMusicPlayback = (
    audio: HTMLAudioElement,
    playbackRequest: number,
    track: Track,
    sourceTrack: Track,
    timeoutMs: number
  ) => {
    playbackTimeoutRef.current = setTimeout(() => {
      if (nextRequestRef.current !== playbackRequest || audio.readyState >= 3) return;
      playbackIntentRef.current.pause();
      audio.pause();
      setIsPlaying(false);
      setIsBuffering(false);
      setUnavailableTrackIds(previous => new Set(previous).add(track.id));
      showToast(track.audioUrl?.startsWith('blob:')
        ? 'El archivo local ya no está disponible. Vuelve a cargarlo o búscalo en la bóveda offline.'
        : 'La canción tardó demasiado en cargar. Revisa el servidor o prueba otra pista.');
    }, timeoutMs);
    audio.play().then(() => {
      if (nextRequestRef.current !== playbackRequest) return;
      if (playbackTimeoutRef.current) clearTimeout(playbackTimeoutRef.current);
      setUnavailableTrackIds(previous => { const next = new Set(previous); next.delete(track.id); return next; });
      showToast(`Reproduciendo: ${track.title}`);
    }).catch((err) => {
      if (nextRequestRef.current !== playbackRequest || err?.name === 'AbortError') return;
      if (playbackTimeoutRef.current) clearTimeout(playbackTimeoutRef.current);
      console.warn('No se pudo reproducir la pista:', err);
      playbackIntentRef.current.pause();
      setIsPlaying(false);
      setIsBuffering(false);
      setUnavailableTrackIds(previous => new Set(previous).add(track.id));
      showToast(playbackFailureMessage(sourceTrack));
    });
  };

  const playSong = (track: Track, rememberPrevious = true, preserveQueue = false) => {
    if (!track) return;
    nextRequestRef.current++;
    const playbackRequest = nextRequestRef.current;
    if (playbackTimeoutRef.current) clearTimeout(playbackTimeoutRef.current);
    if (!vaultReady) {
      showToast('Espera un momento mientras se abre la bóveda offline.');
      return;
    }
    const resolved = resolvePlayableMusic(track);
    if (resolved.ok === false) {
      cancelStandbyPrime();
      pausePlayback();
      showToast(resolved.reason === 'offline'
        ? 'Esta canción no está descargada en este dispositivo.'
        : 'Esta canción no tiene un enlace de audio disponible. Búscala de nuevo.');
      return;
    }
    const { sourceTrack, resolvedUrl } = resolved;
    const candidateDeck = standbyDeck();
    const candidateAudio = deckElement(candidateDeck);
    const normalizedUrl = normalizeAudioUrl(resolvedUrl);
    const canReuseStandby = !!candidateAudio
      && canReusePreloadedDeck(deckUrlsRef.current[candidateDeck], normalizedUrl, candidateAudio.readyState, !!candidateAudio.error);
    // Reannounce the next track before replacing the ended media element.
    // Android/Chrome may retire the previous Media Session at the track boundary.
    updateMediaSessionMetadata(sourceTrack);
    updateMediaSessionPlaybackState(true);
    if (!preserveQueue) updatePlaybackQueue(null);
    playbackTrackRef.current = sourceTrack;
    if (rememberPrevious && activeAudioSource === 'music' && hasSelectedMusicRef.current && currentMusicTrack.id !== track.id) {
      recentTracksRef.current = [...recentTracksRef.current, currentMusicTrack].slice(-30);
    }
    hasSelectedMusicRef.current = true;
    setMusicSelection(value => value + 1);
    listeningRef.current = { trackId: track.id, lastTime: 0, lastWall: 0, listened: 0, counted: false };
    setUseSynthFallback(false);
    playbackIntentRef.current.play('music');
    setActiveAudioSource('music');
    setIsPlaying(true);
    setIsBuffering(true);
    setCurrentTime(0);
    setLoopA(null);
    setLoopB(null);

    // Pausar reproductor de radio si estaba activo
    if (radioAudioRef.current) {
      radioAudioRef.current.pause();
    }

    setTracks((prev) => {
      const idx = prev.findIndex((t) => t.id === track.id);
      if (idx !== -1) {
        setCurrentTrackIndex(idx);
        return prev.map((item, index) => index === idx ? sourceTrack : item);
      }
      setCurrentTrackIndex(0);
      return [sourceTrack, ...prev];
    });

    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    initWebAudio();

    if (canReuseStandby && candidateAudio) {
      const previousAudio = audioRef.current;
      activeDeckRef.current = candidateDeck;
      standbyPrimedRef.current = false;
      standbyTrackIdRef.current = null;
      if (previousAudio && previousAudio !== candidateAudio) previousAudio.pause();
      try { candidateAudio.currentTime = 0; } catch {}
      candidateAudio.playbackRate = playbackSpeed;
      candidateAudio.volume = isMuted ? 0 : Math.min(1, Math.max(0, volume));
      setDeckGain(candidateDeck, 1);
      if (Number.isFinite(candidateAudio.duration) && candidateAudio.duration > 0) {
        setDuration(candidateAudio.duration);
      } else {
        setDuration(track.duration || sourceTrack.duration || 0);
      }
      startMusicPlayback(candidateAudio, playbackRequest, track, sourceTrack, 12000);
      return;
    }

    cancelStandbyPrime();
    const activeAudio = audioRef.current;
    if (activeAudio) {
      activeAudio.src = resolvedUrl;
      activeAudio.load();
      startMusicPlayback(activeAudio, playbackRequest, track, sourceTrack, 25000);
    }
  };

  const selectTrack = (index: number) => {
    if (index < 0 || index >= tracks.length) return;
    playSong(tracks[index]);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const now = audioRef.current.currentTime;
    setCurrentTime(now);

    updateMediaSessionPosition(now, duration, playbackSpeed);

    if (loopA !== null && loopB !== null && now >= loopB) {
      audioRef.current.currentTime = loopA;
      showToast(`Loop A-B activo (${formatTime(loopA)} → ${formatTime(loopB)})`);
    }

    // Algoritmo Inteligente Spotify: Al superar el 50% de la canción se guarda en favoritas y perfil de gustos
    const audio = audioRef.current;
    const actualDuration = audio.duration;

    // Con la pantalla apagada, Chrome puede suspender el JS si no hay audio.
    // Arrancamos el deck precargado en silencio un instante antes del final;
    // al llegar el evento "ended" ya hay reproducción activa y el cambio es
    // inmediato, sin ventana de silencio ni pérdida de los controles.
    const remaining = actualDuration - now;
    const standbyDeckId = standbyDeck();
    const standby = deckElement(standbyDeckId);
    const standbyGain = deckGainNodesRef.current[standbyDeckId];
    const standbyContext = audioCtxRef.current;
    if (standby && standbyGain && standbyContext && shouldPrimeStandby(
      document.visibilityState,
      standbyPrimedRef.current,
      remaining,
      !!standbyTrackIdRef.current,
      standby.readyState,
      !!standby.error,
      standby.paused
    )) {
      try {
        standby.currentTime = 0;
        standbyGain.gain.setValueAtTime(0.0001, standbyContext.currentTime);
        standbyPrimedRef.current = true;
        standby.play().catch(() => {
          standbyPrimedRef.current = false;
          try { standbyGain.gain.setValueAtTime(1, standbyContext.currentTime); } catch {}
          standby.pause();
        });
      } catch {
        standbyPrimedRef.current = false;
      }
    }

    const progress = listeningRef.current;
    const wall = performance.now();
    if (progress.trackId !== currentMusicTrack.id) {
      listeningRef.current = { trackId: currentMusicTrack.id, lastTime: now, lastWall: wall, listened: 0, counted: false };
      return;
    }
    if (isPlaying && !audio.paused && progress.lastWall) {
      const elapsed = Math.max(0, (wall - progress.lastWall) / 1000) * audio.playbackRate;
      const delta = now - progress.lastTime;
      // Seeking does not count as listening; normal timeupdate jitter is tolerated.
      if (delta > 0 && delta <= elapsed + 1) progress.listened += Math.min(delta, elapsed + 0.25);
    }
    progress.lastTime = now;
    progress.lastWall = wall;
    const isPreview = currentMusicTrack.duration > 60 && actualDuration < currentMusicTrack.duration * 0.5;
    if (!progress.counted && !isPreview && currentMusicTrack.sourceType !== 'itunes' && !currentMusicTrack.id.startsWith('itunes-') && activeAudioSource === 'music' && Number.isFinite(actualDuration) && actualDuration > 15 && progress.listened >= actualDuration * 0.5) {
      progress.counted = true;
      registerTrack50PercentListened(currentMusicTrack);
    }
  };

  // Algoritmo de Afinidad Musical
  const calculateAffinityScore = (track: Track) => {
    if (!track) return 80;
    const energy = typeof track.energy === 'number' ? track.energy : 75;
    const acoustic = typeof track.acousticness === 'number' ? track.acousticness : 30;
    const bpm = typeof track.bpm === 'number' && track.bpm > 0 ? track.bpm : 120;
    const energyDiff = Math.abs(energy - algoEnergyTarget);
    const acousticDiff = Math.abs(acoustic - algoAcousticTarget);
    const bpmDiff = Math.min(50, Math.abs(bpm - algoBpmTarget));
    const rawScore = 100 - (energyDiff * 0.35 + acousticDiff * 0.25 + bpmDiff * 0.4);
    return Math.max(45, Math.min(99, Math.round(rawScore || 80)));
  };

  const handleNextTrack = async () => {
    const requestId = ++nextRequestRef.current;
    if (activeAudioSource === 'radio') {
      const currentIdx = radioStations.findIndex((s) => s.id === currentRadioStation.id);
      const nextIdx = (currentIdx + 1) % radioStations.length;
      playRadioStation(radioStations[nextIdx]);
      return;
    }

    const queue = playbackQueueRef.current;
    if (queue) {
      const next = stepPlaybackQueue(queue, 1);
      if (next) {
        updatePlaybackQueue(next);
        playSong(next.tracks[next.index], true, true);
        return;
      }
      updatePlaybackQueue(null);
      if (!autoRadioEnabled) {
        cancelStandbyPrime();
        audioRef.current?.pause();
        playbackIntentRef.current.pause();
        setIsPlaying(false);
        setIsBuffering(false);
        showToast(`Terminó la playlist: ${queue.name}`);
        return;
      }
    }

    if (prefetchedAutoDjTrack) {
      const track = prefetchedAutoDjTrack;
      setPrefetchedAutoDjTrack(null);
      setTracks(previous => [track, ...previous.filter(item => item.id !== track.id)]);
      playSong(track);
      return;
    }

    if (backgroundImportBusy) {
      waitingForPrefetchRef.current = true;
      cancelStandbyPrime();
      audioRef.current?.pause();
      playbackIntentRef.current.pause();
      setIsPlaying(false);
      setIsBuffering(true);
      showToast('Preparando la siguiente canción desde Telegram…');
      return;
    }

    if (autoRadioEnabled) {
      let candidates = rankRelated([...relatedTracks, ...personalTracks, ...onlineSearchResults, ...tracks, ...favorites50List].filter(t => !['jamendo', 'audius', 'itunes'].includes(t.sourceType) && !INITIAL_TRACKS.some(demo => demo.id === t.id && t.sourceType === 'curated') && (!unavailableTrackIds.has(t.id) || isDownloaded(t.id))), currentMusicTrack, userTasteProfile, recentTracksRef.current.slice(-8).map(t => t.id));
      const request = relatedRequestRef.current;
      if (!candidates.length && request?.trackId === currentMusicTrack.id) {
        showToast('Buscando canciones relacionadas…');
        const results = await request.promise;
        if (requestId !== nextRequestRef.current) return;
        candidates = rankRelated([...results, ...personalTracks, ...onlineSearchResults, ...tracks, ...favorites50List].filter(t => !['jamendo', 'audius', 'itunes'].includes(t.sourceType) && !INITIAL_TRACKS.some(demo => demo.id === t.id && t.sourceType === 'curated') && (!unavailableTrackIds.has(t.id) || isDownloaded(t.id))), currentMusicTrack, userTasteProfile, recentTracksRef.current.slice(-8).map(t => t.id));
      }
      if (candidates[0]) {
        if (isYouTubeResult(candidates[0])) {
          const target = buildTelegramImport(candidates[0], Date.now());
          if (target) {
            waitingForPrefetchRef.current = true;
            cancelStandbyPrime();
            audioRef.current?.pause();
            playbackIntentRef.current.pause();
            setIsPlaying(false);
            setBackgroundImportBusy(true);
            setBackgroundImportTarget(target);
            setIsBuffering(true);
            showToast(`Descargando «${target.title}» para la siguiente…`);
            return;
          }
        }
        playSong(candidates[0]);
        return;
      }
      cancelStandbyPrime();
      audioRef.current?.pause();
      playbackIntentRef.current.pause();
      setIsPlaying(false);
      showToast('No encontramos otra canción relacionada. Busca más música o desactiva Auto-DJ para seguir la lista.');
      return;
    }
    const nextIdx = (currentTrackIndex + 1) % tracks.length;
    selectTrack(nextIdx);
  };

  useEffect(() => {
    handleNextTrackRef.current = () => { void handleNextTrack(); };
  });

  const handlePrevTrack = () => {
    nextRequestRef.current++;
    if (activeAudioSource === 'radio') {
      const currentIdx = radioStations.findIndex((s) => s.id === currentRadioStation.id);
      const prevIdx = (currentIdx - 1 + radioStations.length) % radioStations.length;
      playRadioStation(radioStations[prevIdx]);
      return;
    }

    const queue = playbackQueueRef.current;
    if (queue) {
      const previous = stepPlaybackQueue(queue, -1) || queue;
      updatePlaybackQueue(previous);
      playSong(previous.tracks[previous.index], false, true);
      return;
    }

    const previous = recentTracksRef.current.pop();
    if (previous) { playSong(previous, false); return; }
    const prevIdx = (currentTrackIndex - 1 + tracks.length) % tracks.length;
    selectTrack(prevIdx);
  };

  // ==========================================
  // BÓVEDA OFFLINE PERSISTENTE (INDEXEDDB)
  // ==========================================
  const toggleOfflineVault = async (trackId: string, e?: React.MouseEvent, trackHint?: Track) => {
    if (e) e.stopPropagation();
    if (!vaultReady) { showToast('Espera mientras se abre la bóveda offline.'); return; }
    if (vaultBusyRef.current) { showToast('Espera a que termine la descarga actual.'); return; }
    const target = trackHint || tracks.find(t => t.id === trackId) || offlineTracksRef.current.find(t => t.id === trackId) || onlineSearchResults.find(t => t.id === trackId) || favorites50List.find(t => t.id === trackId);
    if (!target) return;
    vaultBusyRef.current = true;
    try {
      if (offlineTracksRef.current.some(t => t.id === trackId)) {
        const removedUrl = offlineTracksRef.current.find(t => t.id === trackId)?.audioUrl;
        await removeTrackOffline(trackId);
        updateOfflineTracks(offlineTracksRef.current.filter(t => t.id !== trackId));
        setTracks(previous => previous.filter(t => t.id !== trackId || t.audioUrl !== removedUrl));
        if (homeOrderRef.current.tracks.get(trackId)?.audioUrl === removedUrl) {
          homeOrderRef.current.tracks.delete(trackId);
          homeOrderRef.current.ids = homeOrderRef.current.ids.filter(id => id !== trackId);
        }
        showToast(`Eliminado de la Bóveda Offline: ${target.title}`);
      } else {
        setDownloadingId(trackId);
        const saved = await saveTrackOffline({ ...target, audioUrl: playbackUrl(target, fastApiUrl, window.location.href) });
        updateOfflineTracks([...offlineTracksRef.current.filter(t => t.id !== trackId), saved]);
        showToast(`Descargada en este dispositivo: ${target.title}`);
      }
    } catch (err: any) {
      showToast(err?.message || 'No se pudo modificar la descarga.');
    } finally { setDownloadingId(null); vaultBusyRef.current = false; }
  };

  const toggleLike = (trackId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, liked: !t.liked } : t))
    );
  };

  // ==========================================
  // CARGA DE MP3 / FLAC LOCALES DEL CELULAR O PC
  // ==========================================
  const handleLocalFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newLocalTracks: Track[] = files.map((file, i) => {
      const objectUrl = URL.createObjectURL(file);
      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      const parts = cleanName.split(' - ');
      const artist = parts.length > 1 ? parts[0].trim() : 'Música en Celular';
      const title = parts.length > 1 ? parts[1].trim() : cleanName;

      return {
        id: `local-${Date.now()}-${i}`,
        title,
        artist,
        album: 'Almacenamiento Local • Sin DRM',
        duration: 210,
        bpm: Math.floor(95 + Math.random() * 40),
        keySignature: 'C Minor',
        energy: Math.floor(60 + Math.random() * 35),
        acousticness: Math.floor(15 + Math.random() * 50),
        danceability: 80,
        genre: 'Local Audio',
        coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
        audioUrl: objectUrl,
        sourceType: 'local-file',
        cachedOffline: false,
        liked: true,
        lyrics: [
          { time: 0, text: `♪ Archivo local: ${file.name} ♪` },
          { time: 8, text: "Reproducción directa con motor DSP de 5 bandas" },
          { time: 25, text: "Audio de alta fidelidad • Almacenado en tu dispositivo" }
        ]
      };
    });

    setTracks((prev) => [...newLocalTracks, ...prev]);
    setUseSynthFallback(false);
    playSong(newLocalTracks[0]);
    showToast(`${newLocalTracks.length} archivo(s) local(es) cargado(s)`);
  };

  // ==========================================
  // BÚSQUEDA ONLINE EN VIVO (UNIVERSAL + AUDIUS + SERVIDOR)
  // ==========================================
  const isYouTubeResult = (track: Track) =>
    track.sourceType === 'invidious' || (track.sourceType === 'youtube' && /^yt-[A-Za-z0-9_-]{11}$/.test(track.id));

  const requestTelegramImport = (track: Track) => {
    if (backgroundImportBusy) {
      showToast('Se está preparando la siguiente canción. Inténtalo de nuevo en unos segundos.');
      return;
    }
    const target = buildTelegramImport(track, Date.now());
    if (!target) {
      showToast('Esta canción no se puede importar automáticamente desde Telegram. Prueba otra.');
      return;
    }
    setTelegramImportTarget(target);
    setActiveTab('search');
    showToast(`Buscando «${target.title}» en Telegram…`);
    window.setTimeout(() => {
      document.getElementById('telegram-import')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  };

  const executeOnlineSearch = async (query: string, limit = searchResultLimit) => {
    if (!query || query.trim().length < 2) return;
    setActiveTab('search');
    setIsSearchingOnline(true);
    setSearchCurrentPage(1);
    setIsSuggestionsOpen(false);
    try {
      let results: Track[];
      if (searchProvider === 'stream') {
        results = await searchYouTubeStream(fastApiUrl, query, AbortSignal.timeout(20000), limit);
      } else {
        results = await searchFreeMusicOnline(query, fastApiUrl);
      }
      setOnlineSearchResults(results);
      if (results.length > 0) {
        showToast(`Encontradas ${results.length} canciones para "${query}"`);
      } else {
        showToast('No se encontraron resultados online para esa búsqueda');
      }
    } catch (error: any) {
      setOnlineSearchResults([]);
      showToast(error?.message || 'Error al conectar con el servidor de búsqueda');
    } finally {
      setIsSearchingOnline(false);
    }
  };

  // ==========================================
  // IMPORTADOR REA SPOTIFY BRIDGE (morluto/rea)
  // ==========================================
  const handleReaSpotifyImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spotifyImportUrl.trim()) return;

    setIsImportingSpotify(true);
    try {
      const resolved = await resolveSpotifyTrackViaRea(spotifyImportUrl.trim(), fastApiUrl);
      if (resolved) {
        playSong(resolved);
        setSpotifyImportUrl('');
        showToast(`Posible coincidencia encontrada: ${resolved.title} · ${trackSourceLabel(resolved)}`);
      } else {
        showToast('No se encontró una coincidencia disponible para ese enlace de Spotify.');
      }
    } catch (err) {
      showToast('Error procesando el enlace con REA Bridge');
    } finally {
      setIsImportingSpotify(false);
    }
  };

  // Conexión con Servidor FastAPI Local
  const connectFastApiServer = async (announce = true): Promise<Track[] | null> => {
    setServerStatus('connecting');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${fastApiUrl}/tracks`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error('Biblioteca no disponible');
      let importedTracks: Track[] = [];
      {
        const data = await res.json();
        if (Array.isArray(data)) {
          setTelegramImportCount(data.filter(item => item && typeof item.filename === 'string'
            && /^telegram-[0-9a-f]{32}\.mp3$/.test(item.filename)).length);
        }
        if (Array.isArray(data) && data.length > 0) {
          const imported = data.map((item: any, idx: number): Track => ({
            id: `fastapi-${item.id || idx}`,
            title: item.title || item.filename,
            artist: item.artist || 'Servidor FastAPI',
            album: item.album || 'HomeLab NAS /musica',
            duration: item.duration || 195,
            bpm: item.bpm || 122,
            keySignature: item.keySignature || 'A Minor',
            energy: 82,
            acousticness: 25,
            danceability: 85,
            genre: item.genre || 'Self-Hosted',
            coverUrl: typeof item.cover_url === 'string' && /^\/telegram\/cover\/telegram-[0-9a-f]{32}\.jpg$/.test(item.cover_url)
              ? `${fastApiUrl}${item.cover_url}` : item.cover_url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
            audioUrl: `${fastApiUrl}/stream/${encodeURIComponent(item.filename)}`,
            sourceType: 'fastapi',
            cachedOffline: false,
            liked: false,
            lyrics: [{ time: 0, text: `♪ Streaming desde ${fastApiUrl} ♪` }]
          }));
          importedTracks = imported;
          setTracks((prev) => [...imported, ...prev.filter(track => !imported.some(item => item.id === track.id))]);
        }
      }
      setServerStatus('connected');
      if (announce) showToast(`Sincronizado con el nodo FastAPI (${fastApiUrl})`);
      return importedTracks;
    } catch {
      setServerStatus('disconnected');
      if (announce) showToast('No se pudo consultar la biblioteca del servidor. Comprueba la conexión y su configuración.');
      return null;
    }
  };

  useEffect(() => {
    // Carga la biblioteca del servidor (incluidas importaciones) al iniciar.
    void connectFastApiServer(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fastApiUrl]);

  const onTelegramPublished = async (filename?: string) => {
    const imported = await connectFastApiServer(false);
    if (!imported) {
      showToast('Importación completada; actualiza la Bóveda cuando recuperes la conexión.');
      return;
    }
    const track = filename
      ? imported.find(item => item.audioUrl.endsWith('/' + encodeURIComponent(filename)))
      : undefined;
    if (track) {
      setTracks(previous => [track, ...previous.filter(item => item.id !== track.id)]);
      playSong(track);
      showToast(`Reproduciendo «${track.title}» importada desde Telegram.`);
    } else {
      showToast('Importación guardada en Bóveda Offline. Ábrela para añadirla a una playlist.');
    }
  };

  const handleBackgroundImportFinished = async (result: BackgroundImportResult) => {
    setBackgroundImportTarget(null);
    setBackgroundImportBusy(false);
    if (!result.ok || !result.filename) {
      if (waitingForPrefetchRef.current) {
        waitingForPrefetchRef.current = false;
        setIsBuffering(false);
        showToast('No se pudo preparar la siguiente canción desde Telegram. Elige otra opción.');
      }
      return;
    }
    const imported = await connectFastApiServer(false);
    const track = imported?.find(item => item.audioUrl.endsWith('/' + encodeURIComponent(result.filename!))) || null;
    const label = result.target.title || track?.title || 'La siguiente canción';
    if (!track) {
      waitingForPrefetchRef.current = false;
      setIsBuffering(false);
      showToast(`«${label}» se descargó, pero aún no aparece en la biblioteca. Revisa la Bóveda.`);
      return;
    }
    setPrefetchedAutoDjTrack(track);
    if (waitingForPrefetchRef.current) {
      waitingForPrefetchRef.current = false;
      setPrefetchedAutoDjTrack(null);
      setTracks(previous => [track, ...previous.filter(item => item.id !== track.id)]);
      playSong(track);
      showToast(`Reproduciendo «${label}» descargada desde Telegram.`);
    } else {
      showToast(`«${label}» lista para la siguiente canción.`);
    }
  };

  useEffect(() => {
    // Al abrir la Bóveda se refresca la biblioteca y el contador de importaciones.
    if (activeTab === 'vault') void connectFastApiServer(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const telegramImportTrack = (item: Imported): Track => ({
      id: `fastapi-telegram-${item.filename.slice(9, -4)}`,
      title: item.title, artist: item.artist, album: item.album,
      duration: 200, bpm: 120, keySignature: 'C Major', energy: 50, acousticness: 50,
      danceability: 50, genre: item.genre,
      coverUrl: item.coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
      audioUrl: `${fastApiUrl}/stream/${encodeURIComponent(item.filename)}`,
      sourceType: 'fastapi', cachedOffline: false, liked: false, lyrics: [],
    });

  const playTelegramImport = (item: Imported) => {
    const track = telegramImportTrack(item);
    setTracks(previous => [track, ...previous.filter(existing => existing.id !== track.id)]);
    playSong(track);
  };

  const onTelegramImportDeleted = (filename: string) => {
    const id = `fastapi-telegram-${filename.slice(9, -4)}`;
    if (activeAudioSource === 'music' && currentMusicTrack.id === id) pausePlayback();
    setTracks(previous => {
      const next = previous.filter(track => track.id !== id);
      const currentIndex = next.findIndex(track => track.id === currentMusicTrack.id);
      setCurrentTrackIndex(Math.max(0, currentIndex));
      return next;
    });
    setTelegramImportCount(previous => Math.max(0, previous - 1));
    showToast('Copia eliminada del servidor. Las playlists y descargas offline no se modificaron.');
  };

  const addTimestampNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    const currentNotes = trackNotes[currentTrack.id] || [];
    const updated = [...currentNotes, { time: Math.floor(currentTime), note: newNoteText.trim() }].sort(
      (a, b) => a.time - b.time
    );
    setTrackNotes({ ...trackNotes, [currentTrack.id]: updated });
    setNewNoteText('');
    showToast(`Nota guardada en el minuto ${formatTime(currentTime)}`);
  };

  const formatTime = (sec: number) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const filteredTracks = useMemo(() => {
    const legacyFree = (track: Track) => ['jamendo', 'audius', 'itunes'].includes(track.sourceType)
      && !offlineTracks.some(offline => offline.id === track.id);
    const homeTracks = [...regionalTracks, ...offlineTracks, ...tracks, ...personalTracks, ...relatedTracks]
      .filter(track => !INITIAL_TRACKS.some(demo => demo.id === track.id && track.sourceType === 'curated'))
      .filter(track => !legacyFree(track));
    const waitingForRegional = regionalLoading && homeTracks.length === 0;
    const source = activeTab === 'vault' ? offlineTracks : activeTab === 'home'
      ? (waitingForRegional ? [] : homeTracks)
      : tracks;
    const seen = new Set<string>();
    let unique = source.filter(t => !seen.has(t.id) && !!seen.add(t.id));
    if (activeTab === 'home') {
      const scope = `${currentUser?.id || 'guest'}:${musicRegion}:yt`;
      if (homeOrderRef.current.scope !== scope) homeOrderRef.current = { scope, ids: [], tracks: new Map() };
      const known = new Set(homeOrderRef.current.ids);
      for (const track of unique) {
        if (!known.has(track.id) && homeOrderRef.current.ids.length < 200) {
          homeOrderRef.current.ids.push(track.id);
          known.add(track.id);
        }
        if (known.has(track.id)) homeOrderRef.current.tracks.set(track.id, track);
      }
      unique = homeOrderRef.current.ids.map(id => homeOrderRef.current.tracks.get(id)).filter((track): track is Track => !!track);
    }
    const rank = new Map(homeOrderRef.current.ids.map((id, index) => [id, index]));
    return unique
      .filter((t) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          (t.title || '').toLowerCase().includes(q) ||
          (t.artist || '').toLowerCase().includes(q) ||
          (t.genre || '').toLowerCase().includes(q)
        );
      })
      .map((t) => ({
        ...t,
        affinity: calculateAffinityScore(t)
      }))
      .sort((a, b) => activeTab === 'home' ? (rank.get(a.id) ?? 9999) - (rank.get(b.id) ?? 9999) : (activeTab === 'ai-radio' ? b.affinity - a.affinity : 0));
  }, [tracks, offlineTracks, relatedTracks, personalTracks, regionalTracks, regionalLoading, favorites50List, currentUser?.id, musicRegion, activeTab, searchQuery, algoEnergyTarget, algoAcousticTarget, algoBpmTarget]);

  // Paginación limpia de 10 canciones para Inicio & Tendencias
  const homeTotalPages = Math.ceil(filteredTracks.length / HOME_PAGE_SIZE) || 1;
  const paginatedHomeTracks = useMemo(() => {
    const start = (homeCurrentPage - 1) * HOME_PAGE_SIZE;
    return filteredTracks.slice(start, start + HOME_PAGE_SIZE);
  }, [filteredTracks, homeCurrentPage, HOME_PAGE_SIZE]);

  useEffect(() => {
    setHomeCurrentPage(1);
  }, [searchQuery, activeTab]);

  const accentClasses = {
    emerald: {
      bg: 'bg-gradient-to-r from-emerald-500 to-teal-500',
      hover: 'hover:from-emerald-400 hover:to-teal-400',
      text: 'text-emerald-400',
      border: 'border-emerald-500/40',
      glow: 'shadow-emerald-500/25',
      ring: 'ring-emerald-400',
      accent: 'accent-emerald-500'
    },
    blue: {
      bg: 'bg-gradient-to-r from-blue-500 to-cyan-500',
      hover: 'hover:from-blue-400 hover:to-cyan-400',
      text: 'text-blue-400',
      border: 'border-blue-500/40',
      glow: 'shadow-blue-500/25',
      ring: 'ring-blue-400',
      accent: 'accent-blue-500'
    },
    pink: {
      bg: 'bg-gradient-to-r from-pink-500 to-rose-400',
      hover: 'hover:from-pink-400 hover:to-rose-300',
      text: 'text-pink-400',
      border: 'border-pink-500/40',
      glow: 'shadow-pink-500/25',
      ring: 'ring-pink-400',
      accent: 'accent-pink-500'
    },
    violet: {
      bg: 'bg-gradient-to-r from-violet-500 to-fuchsia-500',
      hover: 'hover:from-violet-400 hover:to-fuchsia-400',
      text: 'text-violet-400',
      border: 'border-violet-500/40',
      glow: 'shadow-violet-500/25',
      ring: 'ring-violet-400',
      accent: 'accent-violet-500'
    },
    cyberpunk: {
      bg: 'bg-gradient-to-r from-rose-500 to-amber-500',
      hover: 'hover:from-rose-400 hover:to-amber-400',
      text: 'text-rose-400',
      border: 'border-rose-500/40',
      glow: 'shadow-rose-500/25',
      ring: 'ring-rose-400',
      accent: 'accent-rose-500'
    }
  }[themeAccent];

  const nextInPlaylist = playbackQueue ? stepPlaybackQueue(playbackQueue, 1)?.tracks[playbackQueue.index + 1] : undefined;
  const nextSuggestion = activeAudioSource === 'music' && hasSelectedMusicRef.current
    ? nextInPlaylist || (autoRadioEnabled ? rankRelated([...relatedTracks, ...personalTracks, ...onlineSearchResults, ...tracks, ...favorites50List].filter(t => !['jamendo', 'audius', 'itunes'].includes(t.sourceType) && !INITIAL_TRACKS.some(demo => demo.id === t.id && t.sourceType === 'curated') && (!unavailableTrackIds.has(t.id) || isDownloaded(t.id))), currentMusicTrack, userTasteProfile, recentTracksRef.current.slice(-8).map(t => t.id))[0] : undefined)
    : undefined;

  const automaticUpcoming = prefetchedAutoDjTrack
    || nextSuggestion
    || (tracks.length > 1 ? tracks[(currentTrackIndex + 1) % tracks.length] : undefined);
  const upcomingMusicTrack = nextInPlaylist
    || (automaticUpcoming && automaticUpcoming.id !== currentMusicTrack.id ? automaticUpcoming : undefined);
  // Auto-DJ descarga los resultados de YouTube desde Telegram antes de
  // reproducirlos; una cola explícita sí puede usar /stream_yt directamente.
  const upcomingNeedsTelegramImport = !nextInPlaylist && !prefetchedAutoDjTrack
    && !!nextSuggestion && isYouTubeResult(nextSuggestion);

  useEffect(() => {
    // Una cola explícita se reproduce directo aunque haya una importación
    // Telegram en curso; solo Auto-DJ depende de que esa importación termine.
    const waitingForAutoDjImport = backgroundImportBusy && !nextInPlaylist;
    if (!isPlaying || activeAudioSource !== 'music' || useSynthFallback || waitingForAutoDjImport || !upcomingMusicTrack || upcomingNeedsTelegramImport) {
      standbyTrackIdRef.current = null;
      cancelStandbyPrime();
      return;
    }
    if (standbyTrackIdRef.current && standbyTrackIdRef.current !== upcomingMusicTrack.id) {
      standbyTrackIdRef.current = null;
      cancelStandbyPrime();
    }
    // Precarga con margen: en primer plano no compite con el arranque de la
    // pista actual; en segundo plano empieza antes para que una pista corta
    // también tenga la siguiente lista.
    const delay = document.visibilityState === 'hidden' ? 500 : 3000;
    const timer = window.setTimeout(() => prepareStandbyTrack(upcomingMusicTrack), delay);
    return () => window.clearTimeout(timer);
  }, [isPlaying, activeAudioSource, currentMusicTrack.id, musicSelection, useSynthFallback,
      backgroundImportBusy, !!nextInPlaylist, upcomingMusicTrack?.id, upcomingMusicTrack?.audioUrl, upcomingNeedsTelegramImport]);

  useEffect(() => {
    if (!autoRadioEnabled || activeAudioSource !== 'music' || !isPlaying || !hasSelectedMusicRef.current) return;
    if (!nextSuggestion || !isYouTubeResult(nextSuggestion)) return;
    if (telegramImportTarget || backgroundImportBusy || prefetchedAutoDjTrack) return;
    const key = `${currentMusicTrack.id}->${nextSuggestion.id}`;
    if (prefetchAttemptedRef.current.has(key)) return;
    const target = buildTelegramImport(nextSuggestion, Date.now());
    if (!target) return;
    // Espera unos segundos para no competir con la reproducción o la importación
    // de la canción actual; después descarga la siguiente en segundo plano.
    const timer = window.setTimeout(() => {
      if (backgroundImportBusy || telegramImportTarget) return;
      prefetchAttemptedRef.current.add(key);
      setBackgroundImportBusy(true);
      setBackgroundImportTarget(target);
      showToast(`Preparando «${target.title}» mientras escuchas…`);
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [autoRadioEnabled, activeAudioSource, isPlaying, currentMusicTrack.id, nextSuggestion?.id,
      telegramImportTarget, backgroundImportBusy, prefetchedAutoDjTrack?.id]);

  const handleDeckWaiting = (deck: 'a' | 'b') => {
    if (isActiveDeck(deck)) setIsBuffering(true);
  };
  const handleDeckPlaying = (deck: 'a' | 'b') => {
    if (!isActiveDeck(deck)) return;
    if (playbackTimeoutRef.current) clearTimeout(playbackTimeoutRef.current);
    setIsBuffering(false);
    const id = playbackTrackRef.current?.id;
    if (id) setUnavailableTrackIds(previous => { if (!previous.has(id)) return previous; const next = new Set(previous); next.delete(id); return next; });
  };
  const handleDeckPause = (deck: 'a' | 'b') => {
    if (isActiveDeck(deck)) setIsBuffering(false);
  };
  const handleDeckTimeUpdate = (deck: 'a' | 'b') => {
    if (isActiveDeck(deck)) handleTimeUpdate();
  };
  const handleDeckLoadedMetadata = (deck: 'a' | 'b', e: React.SyntheticEvent<HTMLAudioElement>) => {
    if (isActiveDeck(deck) && activeAudioSource === 'music') {
      setDuration((e.target as HTMLAudioElement).duration || currentMusicTrack.duration);
    }
  };
  const handleDeckError = (deck: 'a' | 'b', e: React.SyntheticEvent<HTMLAudioElement>) => {
    const err = (e.target as HTMLAudioElement).error;
    if (!isActiveDeck(deck)) {
      // El deck de precarga falló; se reintentará cuando toque esa pista.
      deckUrlsRef.current[deck] = null;
      standbyTrackIdRef.current = null;
      cancelStandbyPrime();
      return;
    }
    setIsBuffering(false);
    console.warn('Music stream event:', err?.code, err?.message);
    if (activeAudioSource === 'music' && isPlaying && err?.code !== MediaError.MEDIA_ERR_ABORTED) {
      playbackIntentRef.current.pause();
      setIsPlaying(false);
      const track = playbackTrackRef.current;
      if (track) {
        setUnavailableTrackIds(previous => new Set(previous).add(track.id));
        showToast(playbackFailureMessage(track));
      } else showToast('No se pudo reproducir esta pista. Prueba otra fuente o revisa la conexión.');
    }
  };
  const handleDeckEnded = (deck: 'a' | 'b') => {
    if (isActiveDeck(deck) && activeAudioSource === 'music') {
      void handleNextTrack();
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0d10] text-zinc-100 flex flex-col font-sans select-none overflow-x-hidden">
      <TelegramBackgroundImport username={currentUser?.username} apiUrl={fastApiUrl} target={backgroundImportTarget} onFinished={(result) => void handleBackgroundImportFinished(result)} />
      {/* DOS DECKS DE MÚSICA: uno suena y el otro precarga la siguiente pista.
          El intercambio evita el silencio entre canciones que hace que Android
          Chrome suspenda el JS y retire los controles multimedia. */}
      <audio
        ref={audioDeckARef}
        crossOrigin="anonymous"
        preload="auto"
        onWaiting={() => handleDeckWaiting('a')}
        onPlaying={() => handleDeckPlaying('a')}
        onPause={() => handleDeckPause('a')}
        onTimeUpdate={() => handleDeckTimeUpdate('a')}
        onLoadedMetadata={(e) => handleDeckLoadedMetadata('a', e)}
        onError={(e) => handleDeckError('a', e)}
        onEnded={() => handleDeckEnded('a')}
      />
      <audio
        ref={audioDeckBRef}
        crossOrigin="anonymous"
        preload="auto"
        onWaiting={() => handleDeckWaiting('b')}
        onPlaying={() => handleDeckPlaying('b')}
        onPause={() => handleDeckPause('b')}
        onTimeUpdate={() => handleDeckTimeUpdate('b')}
        onLoadedMetadata={(e) => handleDeckLoadedMetadata('b', e)}
        onError={(e) => handleDeckError('b', e)}
        onEnded={() => handleDeckEnded('b')}
      />

      {/* REPRODUCTOR DEDICADO DE RADIO EN VIVO (SIN RESTRICCIONES CORS, CONEXIÓN RESILIENTE 24/7) */}
      <audio
        ref={radioAudioRef}
        onLoadedMetadata={() => setDuration(0)}
        onError={(e) => {
          const err = (e.target as HTMLAudioElement).error;
          console.warn('Radio stream error/reconnect:', err?.code, err?.message);
          if (activeAudioSource === 'radio' && isPlaying && playbackIntentRef.current.wants('radio')) {
            const ticket = playbackIntentRef.current.current();
            setTimeout(() => {
              if (radioAudioRef.current && playbackIntentRef.current.isCurrent(ticket, 'radio')) {
                console.log('Reconectando señal en vivo de radio tras fallo...');
                radioAudioRef.current.src = currentRadioStation.audioUrl;
                radioAudioRef.current.load();
                radioAudioRef.current.play().catch(console.warn);
              }
            }, 600);
          }
        }}
        onStalled={() => {
          if (activeAudioSource === 'radio' && isPlaying && playbackIntentRef.current.wants('radio')) {
            const ticket = playbackIntentRef.current.current();
            setTimeout(() => {
              if (radioAudioRef.current && playbackIntentRef.current.isCurrent(ticket, 'radio') && (radioAudioRef.current.paused || radioAudioRef.current.readyState < 2)) {
                console.log('Señal de radio estancada, recargando stream...');
                radioAudioRef.current.src = currentRadioStation.audioUrl;
                radioAudioRef.current.load();
                radioAudioRef.current.play().catch(console.warn);
              }
            }, 1800);
          }
        }}
        onEnded={() => {
          if (activeAudioSource === 'radio' && isPlaying && playbackIntentRef.current.wants('radio')) {
            if (radioAudioRef.current) {
              radioAudioRef.current.src = currentRadioStation.audioUrl;
              radioAudioRef.current.load();
              radioAudioRef.current.play().catch(console.warn);
            }
          }
        }}
      />

      {/* TOAST DE NOTIFICACIÓN FLOTANTE */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 bg-zinc-900/95 border border-zinc-700 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 animate-bounce">
          <Sparkles className={`w-4 h-4 ${accentClasses.text}`} />
          <span className="text-sm font-medium">{notification}</span>
        </div>
      )}

      {/* BANNER INSTALACIÓN (EN MÓVIL Y DESKTOP SI NO ESTÁ INSTALADO) */}
      {!isInstalledPwa && deferredInstallPrompt && (
        <div className="bg-gradient-to-r from-emerald-950 via-zinc-900 to-cyan-950 border-b border-emerald-500/40 px-4 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>Instala <strong>Thomas Music</strong> en tu celular para escuchar rápido y sin interrupciones</span>
          </div>
          <button
            onClick={installPwaApp}
            className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold px-3 py-1 rounded-full text-xs transition"
          >
            Instalar App
          </button>
        </div>
      )}

      {/* BARRA SUPERIOR (HEADER) */}
      {currentUser && syncStatus !== 'synced' && (
        <div role="status" className="sync-banner">
          <span className="sync-banner__dot" />
          <span>{syncStatus === 'conflict' ? 'Hay cambios diferentes en otro dispositivo. Elige qué versión conservar.' :
            syncStatus === 'syncing' ? 'Sincronizando tu biblioteca…' :
            syncStatus === 'auth' ? 'Tus cambios están guardados aquí. Inicia sesión de nuevo para sincronizar.' :
            syncStatus === 'pending' ? 'Cambios guardados aquí · esperando conexión' : 'Biblioteca guardada en este dispositivo'}</span>
          {syncStatus === 'conflict' && <div className="sync-banner__actions">
            <button disabled={syncBusy} onClick={() => { setConflictOpen(true); void loadConflictPreview(); }}>Comparar versiones</button>
          </div>}
        </div>
      )}
      {conflictOpen && <div className="conflict-overlay" onClick={() => { if (!syncBusy) setConflictOpen(false); }}>
        <section className="conflict-dialog" role="dialog" aria-modal="true" aria-labelledby="conflict-title" onClick={event => event.stopPropagation()} onKeyDown={event => {
          if (event.key === 'Escape' && !syncBusy) setConflictOpen(false);
        }}>
          <div className="conflict-dialog__heading">
            <div>
              <p className="conflict-dialog__eyebrow">TU BIBLIOTECA · SINCRONIZACIÓN</p>
              <h2 id="conflict-title">Compara antes de decidir</h2>
            </div>
            <button autoFocus aria-label="Cerrar comparación" disabled={syncBusy} onClick={() => setConflictOpen(false)} className="conflict-dialog__close"><X className="w-5 h-5" /></button>
          </div>
          <p className="conflict-dialog__intro">Hay cambios en ambos lugares. Ninguna versión se modificará hasta que elijas una opción.</p>
          {syncBusy && !conflictPreview && <p role="status" className="conflict-dialog__notice">Consultando la biblioteca del servidor…</p>}
          {conflictError && <div role="alert" className="conflict-dialog__error">{conflictError} <button disabled={syncBusy} onClick={() => void loadConflictPreview()}>Actualizar comparación</button></div>}
          {conflictPreview && <>
            <div className="conflict-versions">
              {([{ label: 'Este dispositivo', key: 'dispositivo', data: conflictPreview.local }, { label: 'Servidor', key: 'servidor', data: conflictPreview.remote }] as const).map(version => (
                <div className="conflict-version" key={version.key}>
                  <div className="conflict-version__top"><h3>{version.label}</h3><span>{version.data.playlists.length} playlists · {version.data.favorites50List.length} escuchadas</span></div>
                  <ul>
                    {version.data.playlists.map(playlist => <li key={playlist.id}><details><summary><span>{playlist.name}</span><span>{playlist.tracks.length} canciones</span></summary>
                      {playlist.tracks.length > 0 ? <ol>{playlist.tracks.map((track, index) => <li key={`${track.id}-${index}`}>{track.title} <span>· {track.artist}</span></li>)}</ol> : <p className="conflict-version__empty">Esta playlist está vacía.</p>}
                    </details></li>)}
                    {version.data.playlists.length === 0 && <li>Sin playlists</li>}
                  </ul>
                  <button onClick={() => downloadConflictCopy(version.data, version.key)} disabled={syncBusy}>Descargar copia JSON</button>
                </div>
              ))}
            </div>
            <div className="conflict-dialog__explanation">
              <strong>Combinar conserva ambas versiones.</strong> Si una misma playlist cambió en ambos lugares, se guardan dos copias. Las canciones eliminadas pueden reaparecer; los archivos de audio locales no se transfieren entre dispositivos.
            </div>
            <div className="conflict-dialog__actions">
              <button className="conflict-dialog__primary" disabled={syncBusy} onClick={() => void handleResolveSync('merge')}>Combinar bibliotecas</button>
              <button disabled={syncBusy} onClick={() => void handleResolveSync('local')}>Usar este dispositivo</button>
              <button disabled={syncBusy} onClick={() => void handleResolveSync('server')}>Usar servidor</button>
            </div>
            <p className="conflict-dialog__footnote">Antes de aplicar cambios se guarda una copia de ambas versiones en este navegador. Los botones de descarga guardan metadatos y listas, no los archivos de audio.</p>
          </>}
        </section>
      </div>}
      <header className="h-16 border-b border-zinc-800/80 bg-[#0b0d10]/95 backdrop-blur-xl px-4 lg:px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className={`relative w-11 h-11 rounded-2xl ${accentClasses.bg} p-1 flex items-center justify-center shadow-lg ${accentClasses.glow} shrink-0`}>
            <BabyHeadphonesIcon className="w-full h-full" />
            <span className={`absolute -bottom-1 -right-1 bg-[#0b0d10] ${accentClasses.text} text-[9px] font-black px-1 rounded border ${accentClasses.border}`}>
              TM
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-xl tracking-tight text-white">
                Thomas Music
              </h1>
              <span className="hidden sm:inline-block text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                PRO
              </span>
            </div>
            <p className="text-xs text-zinc-400 hidden sm:block">
              Tu música favorita sin anuncios • Calidad de estudio
            </p>
          </div>
        </div>

        {/* ACCIONES RÁPIDAS SUPERIORES */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Botón Modo Intercom / Pantalla Despierta (visible en tablet/desktop) */}
          <button
            onClick={toggleWakeLock}
            title={isWakeLockActive ? 'Modo Intercomunicador Activo' : 'Activar Modo Intercomunicador en Moto'}
            className={`hidden sm:flex p-2 rounded-xl border text-xs font-semibold items-center gap-1.5 transition ${
              isWakeLockActive
                ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <Headphones className="w-4 h-4" />
            <span className="hidden md:inline">
              {isWakeLockActive ? 'Intercom ON' : 'Intercom'}
            </span>
          </button>

          {/* Subir MP3 Local (visible en tablet/desktop) */}
          <label className="hidden md:flex cursor-pointer bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium px-3 py-2 rounded-xl items-center gap-2 transition">
            <Upload className={`w-3.5 h-3.5 ${accentClasses.text}`} />
            <span>Subir MP3</span>
            <input type="file" accept="audio/*" multiple onChange={handleLocalFileUpload} className="hidden" />
          </label>

          {/* Selector de tema en Desktop (5 esferas inline) */}
          <div className="hidden md:flex items-center bg-zinc-900 border border-zinc-800 rounded-full p-1 gap-1.5 shadow-inner">
            {THEMES_LIST.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setThemeAccent(t.id as ThemeAccent);
                  showToast(`Tema ${t.label} activado`);
                }}
                title={`Tema ${t.label}`}
                className={`w-4 h-4 rounded-full transition-all transform ${
                  themeAccent === t.id
                    ? 'scale-125 ring-2 ring-white shadow-md'
                    : 'opacity-40 hover:opacity-100 hover:scale-110'
                } ${t.color}`}
              />
            ))}
          </div>

          {/* Selector de tema en Celular (Botón con Popover elegante que muestra los 5 temas completos) */}
          <div className="relative md:hidden">
            <button
              onClick={() => setIsThemeModalOpen(!isThemeModalOpen)}
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-700/80 text-zinc-300 hover:text-white flex items-center gap-1.5 shadow"
              title="Cambiar Color de Tema"
            >
              <Palette className="w-4 h-4" />
              <span className={`w-2.5 h-2.5 rounded-full ${
                THEMES_LIST.find((t) => t.id === themeAccent)?.color || 'bg-emerald-500'
              }`} />
            </button>

            {isThemeModalOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-[#121522] border border-zinc-700 rounded-2xl p-2 shadow-2xl z-50 space-y-1 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-2.5 py-1 border-b border-zinc-800">
                  Colores de Tema
                </p>
                {THEMES_LIST.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setThemeAccent(t.id as ThemeAccent);
                      setIsThemeModalOpen(false);
                      showToast(`Tema ${t.label} activado`);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition ${
                      themeAccent === t.id
                        ? 'bg-zinc-800 text-white font-bold ring-1 ring-white/20'
                        : 'text-zinc-300 hover:bg-zinc-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`w-3.5 h-3.5 rounded-full shadow ${t.color}`} />
                      <span>{t.label}</span>
                    </div>
                    {themeAccent === t.id && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Menú de Usuario / Perfil */}
          <div className="relative">
            {currentUser ? (
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full border border-zinc-700/80 bg-zinc-900/90 hover:bg-zinc-800 transition"
                title={`Conectado como ${currentUser.displayName}`}
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-500 text-black font-extrabold text-xs flex items-center justify-center shadow">
                  {currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'U'}
                </div>
                <span className="text-xs font-bold text-zinc-200 max-w-[90px] truncate hidden sm:inline">
                  {currentUser.displayName}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              </button>
            ) : (
              <button
                onClick={() => {
                  setAuthMode('login');
                  setIsAuthModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-500/40 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 text-xs font-bold transition shadow-md"
              >
                <User className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Iniciar Sesión</span>
              </button>
            )}

            {/* Dropdown del menú de usuario */}
            {isUserMenuOpen && currentUser && (
              <div className="absolute right-0 mt-2 w-52 bg-[#121522] border border-zinc-700 rounded-2xl shadow-2xl p-2 z-50 backdrop-blur-xl space-y-1">
                <div className="px-3 py-2 border-b border-zinc-800 text-xs">
                  <p className="font-bold text-white truncate">{currentUser.displayName}</p>
                  <p className="text-[10px] text-zinc-400 font-mono">@{currentUser.username}</p>
                </div>
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setAuthMode('login');
                    setIsAuthModalOpen(true);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800 rounded-xl flex items-center gap-2 transition"
                >
                  <UserPlus className="w-3.5 h-3.5 text-cyan-400" /> Cambiar de Cuenta
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 text-xs text-rose-400 hover:bg-rose-950/40 rounded-xl flex items-center gap-2 transition"
                >
                  <LogOut className="w-3.5 h-3.5" /> Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL: Layout inteligente y ultra-responsivo */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-3 sm:p-4 lg:px-6 lg:pt-6 pb-56 lg:pb-64 max-w-[1600px] w-full mx-auto">
        
        {/* COLUMNA LATERAL (En celular pasa a la parte inferior con order-2 y oculta menús redundantes) */}
        <aside className="order-2 lg:order-1 lg:col-span-3 space-y-4">
          {/* TARJETA DE PERFIL ACTIVO EN SIDEBAR (Solo en desktop; en móvil ya está en la barra superior) */}
          <div className="hidden lg:flex bg-[#11131C] border border-zinc-800/80 rounded-2xl p-3 items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-8 h-8 rounded-xl ${accentClasses.bg} text-black font-black text-xs flex items-center justify-center shrink-0 shadow`}>
                {currentUser ? currentUser.displayName.charAt(0).toUpperCase() : '👤'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">
                  {currentUser ? currentUser.displayName : 'Invitado'}
                </p>
                <p className="text-[10px] text-zinc-400 truncate">
                  {currentUser ? `@${currentUser.username}` : 'Inicia sesión'}
                </p>
              </div>
            </div>
            {!currentUser ? (
              <button
                onClick={() => {
                  setAuthMode('login');
                  setIsAuthModalOpen(true);
                }}
                className={`text-[11px] px-2.5 py-1 rounded-lg ${accentClasses.bg} text-black font-extrabold transition shrink-0`}
              >
                Entrar
              </button>
            ) : (
              <button
                onClick={handleLogout}
                title="Cerrar Sesión"
                className="p-1.5 text-zinc-500 hover:text-rose-400 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Menú de navegación vertical: visible SOLAMENTE en Desktop (en celular ya está la barra fija abajo) */}
          <div className="hidden lg:block bg-[#11131C] border border-zinc-800/80 rounded-2xl p-3 space-y-1">
            {[
              { id: 'home', label: 'Inicio & Tendencias', icon: ListMusic },
              { id: 'search', label: 'Buscar Música', icon: Search },
              { id: 'playlists', label: 'Tus Playlists', icon: FolderPlus, badge: playlists.length },
              { id: 'favorites', label: 'Favoritas & +50%', icon: Heart, badge: favorites50List.length },
              { id: 'radio', label: 'Radio en Vivo (FM/AM)', icon: Radio, badge: '🔴 LIVE' },
              { id: 'dsp-studio', label: 'Ecualizador DSP & Boost', icon: Sliders, badge: `${Math.round(volume * 100)}%` },
              { id: 'vault', label: 'Bóveda Offline', icon: ShieldCheck, badge: offlineTracks.length + telegramImportCount }
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as ActiveTab)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                    isActive
                      ? `${accentClasses.bg} text-black font-semibold shadow-md`
                      : 'text-zinc-300 hover:bg-zinc-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full ${
                        isActive ? 'bg-black/20 text-black font-bold' : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* PANEL IZQUIERDO: DIAL FM MEDELLÍN (SI ES RADIO) O ALGORITMO IA (SI ES MÚSICA) */}
          {activeTab === 'radio' ? (
            <div className="bg-[#11131C] border border-zinc-800/80 rounded-2xl p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-red-400 animate-pulse" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Dial FM Medellín
                  </h2>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-950/80 border border-red-500/30 text-red-400 font-bold">
                  EN VIVO
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Sintoniza al instante las frecuencias de mayor audiencia en Antioquia:
              </p>

              <div className="space-y-1.5 pt-1">
                {DEFAULT_RADIO_STATIONS.map((st) => {
                  const isCurrent = activeAudioSource === 'radio' && currentRadioStation.id === st.id && isPlaying;
                  return (
                    <button
                      key={st.id}
                      onClick={() => {
                        if (activeAudioSource === 'radio' && currentRadioStation.id === st.id) {
                          togglePlay();
                        } else {
                          playRadioStation(st);
                        }
                      }}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs transition ${
                        isCurrent
                          ? 'bg-red-500/20 border border-red-500/50 text-red-300 font-bold shadow-sm'
                          : 'bg-zinc-900/60 hover:bg-zinc-850 text-zinc-300 border border-zinc-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                        <span className="truncate">{st.title}</span>
                      </div>
                      {isCurrent ? (
                        <Activity className="w-3.5 h-3.5 text-red-400 animate-pulse shrink-0" />
                      ) : (
                        <Play className="w-3 h-3 text-zinc-500 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-[#11131C] border border-zinc-800/80 rounded-2xl p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Compass className={`w-4 h-4 ${accentClasses.text}`} />
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                      Tu Auto-DJ
                    </h2>
                    <span className="text-[10px] text-zinc-500 block">Música que sigue tu ritmo</span>
                  </div>
                </div>
                <button
                  onClick={() => setAutoRadioEnabled(!autoRadioEnabled)}
                  aria-pressed={autoRadioEnabled}
                  className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold border transition ${
                    autoRadioEnabled
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                  }`}
                >
                  {autoRadioEnabled ? 'Activado' : 'Desactivado'}
                </button>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {autoRadioEnabled
                  ? 'Primero respeta el orden de tu playlist. Al terminar, busca música relacionada con tus gustos.'
                  : 'Seguirás el orden de tu lista. Actívalo para buscar canciones relacionadas.'}
              </p>

              {(autoRadioEnabled || playbackQueue) && activeAudioSource === 'music' && <div className="rounded-xl bg-zinc-900/70 px-3 py-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{nextInPlaylist ? 'Siguiente en tu playlist' : 'Siguiente sugerencia'}</span>
                {nextSuggestion ? <>
                  <p className="mt-1 text-xs font-semibold text-zinc-100 truncate">{nextSuggestion.title}</p>
                  <p className="text-[11px] text-zinc-400 truncate">{nextSuggestion.artist}</p>
                  <p className={`mt-1.5 text-[10px] ${accentClasses.text}`}>{nextInPlaylist ? `Playlist: ${playbackQueue?.name}` : relatedReason(currentMusicTrack, nextSuggestion)}</p>
                </> : <p className="mt-1 text-xs leading-relaxed text-zinc-400">Elige una canción para encontrar música relacionada. Las sugerencias dependen del catálogo disponible.</p>}
              </div>}

              {/* Historial Scrobble */}
              <div className="pt-2 border-t border-zinc-800/80">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-2">
                  Escuchadas más del 50 %
                </span>
                <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                  {favorites50List.slice(0, 8).map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-xs bg-zinc-900/70 px-2.5 py-1.5 rounded-lg">
                      <div className="truncate pr-2">
                        <p className="font-medium text-zinc-200 truncate">{item.title}</p>
                        <p className="text-[10px] text-zinc-500">{item.artist}</p>
                      </div>
                    </div>
                  ))}
                  {favorites50List.length === 0 && <p className="text-xs leading-relaxed text-zinc-500">Aún no hay escuchas registradas. Escucha más de la mitad de una canción para empezar.</p>}
                </div>
              </div>
            </div>
          )}
          {/* Espaciador inferior sidebar */}
          <div className="h-28 sm:h-36 w-full shrink-0 pointer-events-none" aria-hidden="true" />
        </aside>

        {/* COLUMNA CENTRAL (En celular se muestra PRIMERO con order-1 para ver las canciones de inmediato) */}
        <main className="order-1 lg:order-2 lg:col-span-6 space-y-4">
          {/* TARJETA HERO DINÁMICA (MÚSICA O RADIO EN VIVO) CON ANIMACIÓN FFT DE AUDIO */}
          {activeTab !== 'radio' && musicSelection === 0 && activeAudioSource === 'music' && (
            <div className="hidden md:block rounded-2xl border border-zinc-800 bg-[#11131C] p-5">
              <h2 className="text-lg font-bold text-white">Tu música empieza aquí</h2>
              <p className="mt-1 text-sm text-zinc-400">Elige una canción de las sugerencias o usa el buscador para comenzar.</p>
            </div>
          )}
          {activeTab !== 'radio' && (musicSelection > 0 || activeAudioSource === 'radio') && (
            <div className="hidden md:block relative rounded-2xl overflow-hidden border border-zinc-800/90 bg-gradient-to-br from-[#151928] via-[#10121A] to-[#0B0C12] p-5 shadow-xl">
              <div className="flex flex-col sm:flex-row items-center gap-5 z-10 relative">
                <div className="relative group shrink-0">
                  <img
                    src={currentTrack.coverUrl}
                    alt={currentTrack.title}
                    className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl object-cover shadow-2xl border border-white/10"
                  />
                  <button
                    onClick={togglePlay}
                    className={`absolute inset-0 m-auto w-12 h-12 rounded-full ${
                      activeAudioSource === 'radio'
                        ? 'bg-red-500 hover:bg-red-400 text-white'
                        : `${accentClasses.bg} text-black`
                    } flex items-center justify-center shadow-lg opacity-95 group-hover:scale-105 transition`}
                  >
                    {isPlaying ? (
                      <Pause className="w-6 h-6 fill-current" />
                    ) : (
                      <Play className="w-6 h-6 fill-current ml-0.5" />
                    )}
                  </button>
                </div>

                <div className="flex-1 text-center sm:text-left min-w-0">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5">
                    {activeAudioSource === 'radio' ? (
                      <>
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                          RADIO EN VIVO 24/7
                        </span>
                        <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-zinc-800/90 text-zinc-300">
                          FM Digital HQ • Sin Cortes
                        </span>
                      </>
                    ) : (
                      <>
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-zinc-800/90 ${accentClasses.text}`}>
                          Ajuste sonoro {calculateAffinityScore(currentMusicTrack)}%
                        </span>
                        <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-zinc-800/80 text-zinc-300">
                          {Math.round(currentMusicTrack.bpm * playbackSpeed)} BPM • {currentMusicTrack.keySignature}
                        </span>
                        {isDownloaded(currentMusicTrack.id) && (
                          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Offline Vault
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  <h2 className="text-xl sm:text-2xl font-extrabold text-white truncate">
                    {currentTrack.title}
                  </h2>
                  <p className="text-sm text-zinc-400 truncate">
                    {currentTrack.artist} — <span className="text-zinc-500">{currentTrack.album}</span>
                  </p>

                  {/* Presets Rápidos de DJ (si suena música) o Género (si suena radio) */}
                  {activeAudioSource === 'music' ? (
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 mt-3">
                      {[
                        { id: 'normal', label: 'Normal (1.0x)' },
                        { id: 'slowed', label: 'Slowed + Reverb' },
                        { id: 'nightcore', label: 'Nightcore (1.25x)' },
                        { id: 'lofi', label: 'Lo-Fi (1.8kHz)' },
                        { id: 'bassboost', label: 'Mega Bass (+10dB)' }
                      ].map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => applyAudioPreset(preset.id as AudioPreset)}
                          className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition ${
                            activePreset === preset.id
                              ? `${accentClasses.bg} text-black font-bold`
                              : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center sm:justify-start gap-3 mt-3 text-xs text-zinc-400">
                      <span className="flex items-center gap-1.5 text-red-400 font-medium">
                        <Activity className="w-3.5 h-3.5 animate-pulse" /> Sintonizado en Directo
                      </span>
                      <span>{currentRadioStation.genre}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ESPECTRO DE AUDIO EN CANVAS */}
              <div className="mt-4 pt-3 border-t border-zinc-800/80">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Activity className={`w-3.5 h-3.5 ${accentClasses.text}`} />
                    <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                      Espectro FFT • {activePreset.toUpperCase()} • {playbackSpeed.toFixed(2)}x
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setUseSynthFallback(!useSynthFallback)}
                      className={`text-[10px] px-2 py-0.5 rounded border transition ${
                        useSynthFallback
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                          : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white'
                      }`}
                      title="Alternar entre stream MP3 y sintetizador procedural"
                    >
                      {useSynthFallback ? 'Sintetizador Live ON' : 'Audio MP3'}
                    </button>
                    {(['bars', 'wave', 'circle'] as VisualizerMode[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setVisualizerMode(mode)}
                        className={`text-[10px] uppercase px-2 py-0.5 rounded ${
                          visualizerMode === mode ? 'bg-zinc-700 text-white font-bold' : 'bg-zinc-900 text-zinc-500'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
                <canvas
                  ref={canvasRef}
                  width={560}
                  height={76}
                  className="w-full h-20 rounded-xl bg-black/40 border border-zinc-800/60"
                />
              </div>
            </div>
          )}

          {/* VISTAS DINÁMICAS */}
          {activeTab === 'radio' ? (
            /* PESTAÑA EMISORAS DE RADIO EN VIVO (SECCIÓN 100% EXCLUSIVA RADIO) */
            <div className="space-y-4">
              {/* TARJETA HERO TUNER DE LA EMISORA SINTONIZADA */}
              <div className="hidden md:block relative rounded-2xl overflow-hidden border border-red-500/40 bg-gradient-to-br from-[#1e0f14] via-[#140d12] to-[#0b0c10] p-5 shadow-2xl">
                <div className="flex flex-col sm:flex-row items-center gap-5 z-10 relative">
                  <div className="relative group shrink-0">
                    <img
                      src={currentRadioStation.coverUrl}
                      alt={currentRadioStation.title}
                      className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl object-cover shadow-2xl border border-red-500/30 ring-2 ring-red-500/20"
                    />
                    <button
                      onClick={() => {
                        if (activeAudioSource === 'radio' && isPlaying) {
                          togglePlay();
                        } else {
                          playRadioStation(currentRadioStation);
                        }
                      }}
                      className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-red-500 hover:bg-red-400 text-white flex items-center justify-center shadow-lg transition transform active:scale-95"
                    >
                      {activeAudioSource === 'radio' && isPlaying ? (
                        <Pause className="w-6 h-6 fill-current" />
                      ) : (
                        <Play className="w-6 h-6 fill-current ml-0.5" />
                      )}
                    </button>
                  </div>

                  <div className="flex-1 text-center sm:text-left min-w-0">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5">
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                        SEÑAL EN DIRECTO 24/7
                      </span>
                      <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-zinc-800/90 text-zinc-300">
                        MP3 Digital HQ • Sin Cortes
                      </span>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-black text-white truncate">
                      {currentRadioStation.title}
                    </h2>
                    <p className="text-sm text-zinc-400 truncate mt-0.5">
                      {currentRadioStation.artist} — <span className="text-zinc-500">{currentRadioStation.album}</span>
                    </p>
                    <p className="text-xs text-red-400 font-medium mt-1">
                      {currentRadioStation.genre}
                    </p>
                  </div>
                </div>

                {/* Espectro FFT de la Radio */}
                <div className="mt-4 pt-3 border-t border-zinc-800/80">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                      <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                        Monitoreo Frecuencia FM en Vivo
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(['bars', 'wave', 'circle'] as VisualizerMode[]).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setVisualizerMode(mode)}
                          className={`text-[10px] uppercase px-2 py-0.5 rounded ${
                            visualizerMode === mode ? 'bg-red-500 text-white font-bold' : 'bg-zinc-900 text-zinc-500'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                  <canvas
                    ref={canvasRef}
                    width={560}
                    height={76}
                    className="w-full h-20 rounded-xl bg-black/40 border border-zinc-800/60"
                  />
                </div>
              </div>

              {/* LISTA DE EMISORAS Y EXPLORADOR MUNDIAL */}
              <div className="bg-[#11131C] border border-zinc-800/80 rounded-2xl p-4 sm:p-6 space-y-6">
              {/* Encabezado */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400">
                    <Radio className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      Radio en Vivo FM / AM (Radio Browser)
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500 text-white font-black tracking-wider animate-pulse">
                        🔴 EN DIRECTO
                      </span>
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Transmisión digital en streaming directo 24/7 sin cortes ni anuncios de la app. Compatible con audífonos y casco.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    30,000+ Emisoras Mundiales
                  </span>
                </div>
              </div>

              {/* Emisoras Principales por Defecto: Medellín & Colombia */}
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-400" />
                    Sintonización Directa Medellín & Colombia
                  </h4>
                  <span className="text-[11px] text-zinc-400 font-mono">Stream AAC+ Alta Definición</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {DEFAULT_RADIO_STATIONS.map((station) => {
                    const isStationPlaying = currentTrack.id === station.id && isPlaying;
                    return (
                      <div
                        key={station.id}
                        onClick={() => {
                          if (activeAudioSource === 'radio' && currentRadioStation.id === station.id) {
                            togglePlay();
                          } else {
                            playRadioStation(station);
                          }
                        }}
                        className={`group relative overflow-hidden rounded-2xl border p-4 cursor-pointer transition-all duration-300 ${
                          isStationPlaying
                            ? 'bg-gradient-to-br from-red-950/70 via-zinc-900 to-zinc-950 border-red-500/60 shadow-xl shadow-red-950/40 ring-1 ring-red-500/40'
                            : 'bg-zinc-900/60 hover:bg-zinc-850 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-start gap-3.5">
                          <div className="relative shrink-0">
                            <img
                              src={station.coverUrl}
                              alt={station.title}
                              className="w-16 h-16 rounded-xl object-cover border border-zinc-700/60 shadow-md group-hover:scale-105 transition"
                            />
                            {isStationPlaying ? (
                              <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center">
                                <Activity className="w-6 h-6 text-red-400 animate-bounce" />
                              </div>
                            ) : (
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-xl flex items-center justify-center transition">
                                <Play className="w-6 h-6 text-white fill-current ml-0.5" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider bg-red-500/20 text-red-400 border border-red-500/30">
                                🔴 LIVE
                              </span>
                              <span className="text-[10px] text-zinc-400 truncate">{station.album}</span>
                            </div>
                            <h5 className="text-sm font-bold text-white truncate group-hover:text-red-400 transition">
                              {station.title}
                            </h5>
                            <p className="text-xs text-zinc-400 truncate mt-0.5">{station.genre}</p>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                          <span className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                            {isStationPlaying ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                <span className="text-red-400 font-semibold">Al Aire Ahora</span>
                              </>
                            ) : (
                              'Toca para sintonizar'
                            )}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isStationPlaying) {
                                togglePlay();
                              } else {
                                playRadioStation(station);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm ${
                              isStationPlaying
                                ? 'bg-red-500 text-white shadow-red-500/30'
                                : 'bg-zinc-800 group-hover:bg-red-500 text-zinc-200 group-hover:text-white'
                            }`}
                          >
                            {isStationPlaying ? (
                              <>
                                <Pause className="w-3.5 h-3.5 fill-current" />
                                <span>Pausar</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>Sintonizar</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Explorador Mundial Radio Browser & Búsqueda */}
              <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    Explorador de Países & Buscador de Emisoras
                  </h4>
                  <span className="text-xs text-zinc-400">Radio Browser Network</span>
                </div>

                {/* Formulario de Búsqueda */}
                <form onSubmit={handleSearchRadio} className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      value={radioSearchQuery}
                      onChange={(e) => setRadioSearchQuery(e.target.value)}
                      placeholder="Buscar por nombre o frecuencia (ej: Olímpica, Mix, La Mega, Tropicana, BBC, Kiss, Ibiza)..."
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-red-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none transition"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoadingRadio}
                    className="bg-red-500 hover:bg-red-400 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition flex items-center gap-2 shrink-0 shadow-md shadow-red-500/20"
                  >
                    {isLoadingRadio ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    Buscar
                  </button>
                  {radioSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setRadioSearchQuery('');
                        handleSelectRadioCountry(selectedRadioCountry);
                      }}
                      className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-xl"
                    >
                      Limpiar
                    </button>
                  )}
                </form>

                {/* Filtro por Países */}
                <div>
                  <p className="text-[11px] font-semibold text-zinc-400 mb-2">Explorar emisoras por país:</p>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
                    {RADIO_COUNTRIES.map((country) => (
                      <button
                        key={country.code}
                        onClick={() => handleSelectRadioCountry(country.code)}
                        className={`text-xs px-3.5 py-1.5 rounded-xl font-medium whitespace-nowrap transition flex items-center gap-1.5 ${
                          selectedRadioCountry === country.code
                            ? 'bg-red-500 text-white font-bold shadow-md shadow-red-500/20 ring-1 ring-red-400'
                            : 'bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800'
                        }`}
                      >
                        <span>{country.flag}</span>
                        <span>{country.name.split(' ')[1] || country.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Grid de Emisoras Encontradas / Exploradas */}
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Radio className="w-4 h-4 text-red-400" />
                    {radioSearchQuery
                      ? `Resultados para "${radioSearchQuery}"`
                      : `Emisoras Principales (${selectedRadioCountry})`}
                  </h4>
                  <span className="text-xs text-zinc-400 font-mono">{radioStations.length} estaciones disponibles</span>
                </div>

                {isLoadingRadio ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-zinc-400 text-xs">
                    <RefreshCw className="w-6 h-6 animate-spin text-red-400" />
                    <span>Sintonizando servidores de Radio Browser API...</span>
                  </div>
                ) : radioStations.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {radioStations.map((station) => {
                      const isCurrent = currentTrack.id === station.id && isPlaying;
                      return (
                        <div
                          key={station.id}
                          onClick={() => {
                            if (activeAudioSource === 'radio' && currentRadioStation.id === station.id) {
                              togglePlay();
                            } else {
                              playRadioStation(station);
                            }
                          }}
                          className={`group flex items-center justify-between p-3 rounded-2xl border transition cursor-pointer ${
                            isCurrent
                              ? 'bg-red-950/40 border-red-500/60 shadow-md ring-1 ring-red-500/30'
                              : 'bg-zinc-900/50 hover:bg-zinc-800/60 border-zinc-800/80 hover:border-zinc-700'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative shrink-0">
                              <img
                                src={station.coverUrl}
                                alt={station.title}
                                className="w-12 h-12 rounded-xl object-cover border border-zinc-700/60"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src =
                                    'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=600&auto=format&fit=crop&q=80';
                                }}
                              />
                              {isCurrent && (
                                <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                                  <Activity className="w-5 h-5 text-red-400 animate-pulse" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-bold text-white truncate group-hover:text-red-400 transition">
                                  {station.title}
                                </p>
                              </div>
                              <p className="text-[11px] text-zinc-400 truncate">{station.artist}</p>
                              <p className="text-[10px] text-zinc-500 truncate">{station.genre}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleLike(station.id);
                              }}
                              className="p-2 rounded-xl text-zinc-400 hover:text-rose-400 transition"
                              title="Favorito"
                            >
                              <Heart className={`w-4 h-4 ${station.liked ? 'text-rose-500 fill-rose-500' : ''}`} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isCurrent) {
                                  togglePlay();
                                } else {
                                  playRadioStation(station);
                                }
                              }}
                              className={`p-2.5 rounded-xl transition ${
                                isCurrent
                                  ? 'bg-red-500 text-white shadow-md shadow-red-500/30'
                                  : 'bg-zinc-800 group-hover:bg-red-500 text-zinc-300 group-hover:text-white'
                              }`}
                            >
                              {isCurrent ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-zinc-500 text-xs">
                    No se encontraron emisoras para esta búsqueda. Intenta con otro país o nombre.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'rea-guide' ? (
            /* PUENTE REA SPOTIFY (morluto/rea) */
            <div className="bg-[#11131C] border border-zinc-800/80 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Link2 className={`w-5 h-5 ${accentClasses.text}`} />
                    Puente REA Spotify (Reverse Engineer Anything)
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Usa la arquitectura de ingeniería inversa de <strong>morluto/rea</strong> para resolver canciones de Spotify directamente a fuentes libres de DRM.
                  </p>
                </div>
                <a
                  href="https://github.com/morluto/rea"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-mono text-emerald-400 hover:underline flex items-center gap-1"
                >
                  GitHub REA <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Formulario de resolución de Spotify */}
              <form onSubmit={handleReaSpotifyImport} className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-xl space-y-3">
                <label className="text-xs font-bold text-zinc-300 block">
                  Pega cualquier enlace de Spotify (Track o Álbum):
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={spotifyImportUrl}
                    onChange={(e) => setSpotifyImportUrl(e.target.value)}
                    placeholder="https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT"
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={isImportingSpotify}
                    className={`${accentClasses.bg} text-black font-bold text-sm px-5 py-2 rounded-xl flex items-center gap-2`}
                  >
                    {isImportingSpotify ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    Importar y Escuchar Gratis
                  </button>
                </div>
                <p className="text-[11px] text-zinc-400">
                  REA extrae la metadata, carátula en alta definición, BPM y letras oficiales, y lo asocia automáticamente con nuestro motor de streaming libre.
                </p>
              </form>

              {/* Explicación de Arquitectura REA */}
              <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-4 text-xs space-y-2 text-zinc-300">
                <p className="font-bold text-white">¿Cómo funciona REA (Reverse Engineer Anything) en Thomas Music?</p>
                <ul className="list-disc pl-5 space-y-1 text-zinc-400">
                  <li><strong>REA MCP Bridge:</strong> Conecta herramientas de análisis (JADX para APKs móviles de Android, interceptores de API de Electron y tráfico web).</li>
                  <li><strong>Decodificación de Enlaces:</strong> Traduce IDs propietarios de Spotify a flujos de audio abiertos (Audius, SoundHelix o tu servidor FastAPI con yt-dlp).</li>
                  <li><strong>Sin DRM:</strong> La música se almacena en tu dispositivo en tu Bóveda Offline sin encriptación restrictiva.</li>
                </ul>
              </div>
            </div>
          ) : activeTab === 'search' ? (
            /* ========================================== */
            /* PESTAÑA: BÚSQUEDA INTELIGENTE ONLINE CON SUGERENCIAS */
            /* ========================================== */
            <div className="bg-[#11131C] border border-zinc-800/80 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <Search className={`w-4 h-4 ${accentClasses.text}`} />
                    Buscar Música
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Elige 10 o 50 resultados de YouTube vía yt-dlp; se muestran de 10 en 10. Al tocar una canción, la app buscará y descargará automáticamente la mejor coincidencia MP3.
                  </p>
                </div>
              </div>

              {/* BARRA DE BÚSQUEDA CON AUTOCOMPLETADO */}
              <div className="relative">
                <div className="flex gap-2">
                  <span className="inline-flex items-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-300 whitespace-nowrap">
                    YouTube · yt-dlp
                  </span>
                  <label className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400 whitespace-nowrap">
                    <span className="hidden sm:inline">Mostrar</span>
                    <select aria-label="Cantidad de resultados de búsqueda" value={searchResultLimit}
                      onChange={(event) => {
                        const limit = Number(event.target.value) === 50 ? 50 : 10;
                        setSearchResultLimit(limit);
                        try { localStorage.setItem('diaz-search-limit', String(limit)); } catch {}
                        if (onlineSearchResults.length > 0 && searchQuery.trim().length >= 2) {
                          void executeOnlineSearch(searchQuery, limit);
                        }
                      }}
                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500">
                      <option value={10}>10</option>
                      <option value={50}>50</option>
                    </select>
                  </label>
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleSearchInputChange(e.target.value)}
                      onFocus={() => {
                        if (searchSuggestions.length > 0) setIsSuggestionsOpen(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setIsSuggestionsOpen(false);
                          executeOnlineSearch(searchQuery);
                        }
                      }}
                      placeholder="Escribe un artista o canción (ej: Karol G, Provenza, Feid, Lo-Fi)..."
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-9 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition shadow-inner"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setSearchSuggestions([]);
                          setIsSuggestionsOpen(false);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setIsSuggestionsOpen(false);
                      executeOnlineSearch(searchQuery);
                    }}
                    disabled={isSearchingOnline}
                    className={`${accentClasses.bg} text-black font-extrabold text-sm px-5 py-2.5 rounded-xl flex items-center gap-2 transition hover:opacity-95 shrink-0 shadow-lg`}
                  >
                    {isSearchingOnline ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    <span>Buscar</span>
                  </button>
                </div>

                {/* DESPLEGABLE FLOTANTE DE SUGERENCIAS */}
                {isSuggestionsOpen && searchSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-[#121522] border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden z-50 py-2 backdrop-blur-xl">
                    <div className="px-3.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center justify-between border-b border-zinc-800/80">
                      <span className={`flex items-center gap-1.5 ${accentClasses.text}`}>
                        <Sparkles className="w-3.5 h-3.5" />
                        Sugerencias Inteligentes
                      </span>
                      <span className="text-[9px] text-zinc-500">Toca para buscar directo</span>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {searchSuggestions.map((sug, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectSuggestion(sug)}
                          className="w-full text-left px-4 py-2.5 text-xs text-zinc-200 hover:bg-zinc-800/80 hover:text-emerald-300 flex items-center gap-3 transition"
                        >
                          <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                          <span className="truncate font-medium">{sug}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* La integración solo aparece como tarjeta transitoria al pulsar una canción de YouTube. */}
              <div className={telegramImportTarget ? '' : 'hidden'}>
                <TelegramStatus key={`import:${currentUser?.username || ''}:${fastApiUrl}`} mode="import" username={currentUser?.username} apiUrl={fastApiUrl} onPublished={(filename) => void onTelegramPublished(filename)} onPlayImported={playTelegramImport} onAddImported={item => setPlaylistModalTrack(telegramImportTrack(item))} onDeletedImported={onTelegramImportDeleted} importTarget={telegramImportTarget} onImportHandled={(nonce) => setTelegramImportTarget(current => current && current.nonce === nonce ? null : current)} />
              </div>

              {/* LISTA DE RESULTADOS PAGINADA (MÁXIMO 10 POR PÁGINA Y SCROLL CONTROLADO) */}
              {onlineSearchResults.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                    <span>
                      Mostrando {paginatedSearchResults.length} de {onlineSearchResults.length} canciones encontradas
                    </span>
                    <span className="font-mono text-zinc-300">
                      Página {searchCurrentPage} de {totalSearchPages}
                    </span>
                  </div>

                  {/* CONTENEDOR CON SCROLL DELIMITADO PARA EVITAR DESCUADRES */}
                  <div className="max-h-[520px] overflow-y-auto pr-1 space-y-2 rounded-xl pb-4">
                    {paginatedSearchResults.map((track) => {
                      const youtubeImport = isYouTubeResult(track);
                      return (
                      <div
                        key={track.id}
                        onClick={() => youtubeImport ? requestTelegramImport(track) : playSong(track)}
                        className="group flex items-center justify-between p-2.5 rounded-xl border border-transparent hover:border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800/60 cursor-pointer transition"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-zinc-800">
                            <img
                              src={track.coverUrl}
                              alt={track.title}
                              className="w-full h-full object-cover"
                            />
                            {currentTrack.id === track.id && isPlaying && (
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                <div className="flex items-end gap-0.5 h-4">
                                  <span className={`w-1 bg-current rounded-full animate-bounce ${accentClasses.text}`} style={{ animationDuration: '0.5s' }} />
                                  <span className={`w-1 bg-current rounded-full animate-bounce ${accentClasses.text}`} style={{ animationDuration: '0.35s', animationDelay: '0.15s' }} />
                                  <span className={`w-1 bg-current rounded-full animate-bounce ${accentClasses.text}`} style={{ animationDuration: '0.65s', animationDelay: '0.3s' }} />
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-bold truncate transition ${
                              currentTrack.id === track.id ? accentClasses.text : 'text-white group-hover:text-zinc-200'
                            }`}>
                              {track.title}
                            </p>
                            <p className="text-xs text-zinc-400 truncate">
                              {track.artist} {track.genre ? `• ${track.genre}` : ''}
                            </p>
                            <p className={`text-[10px] ${!youtubeImport && unavailableTrackIds.has(track.id) && !isDownloaded(track.id) ? 'text-amber-300' : youtubeImport ? 'text-emerald-300' : 'text-zinc-500'}`}>
                              {youtubeImport ? 'YouTube · toca para descargar la canción'
                                : unavailableTrackIds.has(track.id) && !isDownloaded(track.id) ? 'No disponible · toca para reintentar' : trackSourceLabel(track)}
                            </p>
                            {track.sourceType !== 'itunes' && !track.id.startsWith('itunes-') && <span className="text-[10px] text-zinc-500 font-mono">{formatTime(track.duration)}</span>}
                          </div>
                        </div>

                        {/* ACCIONES DE LA FILA */}
                        <div className="flex items-center gap-1.5 ml-2" onClick={(e) => e.stopPropagation()}>
                          {!youtubeImport && (
                            <button
                              onClick={() => setPlaylistModalTrack(track)}
                              title="Añadir a Playlist"
                              className="p-2 rounded-xl border border-zinc-800 hover:border-cyan-500 text-zinc-400 hover:text-cyan-300 transition"
                            >
                              <ListPlus className="w-4 h-4" />
                            </button>
                          )}

                          {!youtubeImport && (
                            <button
                              onClick={() => toggleOfflineVault(track.id, undefined, track)}
                              className="p-2 rounded-xl border border-zinc-800 hover:border-emerald-500 text-zinc-400 hover:text-emerald-400 transition"
                              title="Descargar para escuchar sin internet"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => youtubeImport ? requestTelegramImport(track) : playSong(track)}
                            className={`p-2 rounded-xl bg-zinc-800 group-hover:${accentClasses.bg} text-zinc-300 group-hover:text-black transition`}
                            title={youtubeImport ? 'Buscar y descargar la canción' : 'Reproducir ahora'}
                          >
                            {youtubeImport ? <ArrowRight className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                          </button>
                        </div>
                      </div>
                      );
                    })}
                  </div>

                  {/* BARRA DE PAGINACIÓN */}
                  {onlineSearchResults.length > SEARCH_PAGE_SIZE && (
                    <div className="flex items-center justify-between pt-3 border-t border-zinc-800 text-xs text-zinc-400">
                      <span>
                        Página {searchCurrentPage} de {totalSearchPages} (10 canciones por página)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSearchCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={searchCurrentPage === 1}
                          className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 text-zinc-200 font-semibold transition flex items-center gap-1"
                        >
                          <ChevronLeft className="w-4 h-4" /> Anterior
                        </button>
                        <span className={`font-mono px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 ${accentClasses.text} font-bold`}>
                          {searchCurrentPage}
                        </span>
                        <button
                          onClick={() => setSearchCurrentPage((p) => Math.min(totalSearchPages, p + 1))}
                          disabled={searchCurrentPage === totalSearchPages}
                          className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 text-zinc-200 font-semibold transition flex items-center gap-1"
                        >
                          Siguiente <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 space-y-6">
                  <div className="text-center space-y-2">
                    <Search className={`w-10 h-10 mx-auto ${accentClasses.text} opacity-60 mb-1`} />
                    <p className="text-sm font-semibold text-white">¿Qué quieres escuchar hoy?</p>
                    <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                      Escribe las primeras letras de un artista o canción (ej: "Kar") para ver sugerencias automáticas al instante.
                    </p>
                  </div>

                  {/* Píldoras de búsqueda rápida de artistas y géneros populares */}
                  <div className="pt-2">
                    <p className="text-xs font-bold text-zinc-400 mb-2.5 px-1 uppercase tracking-wider">
                      Búsquedas Populares
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        'Karol G',
                        'Feid',
                        'Bad Bunny',
                        'Blessd',
                        'Ryan Castro',
                        'Quevedo',
                        'Coldplay',
                        'Shakira',
                        'Reggaeton 2026',
                        'Electrónica',
                        'Lo-Fi Chill',
                        'Salsa Baúl'
                      ].map((item) => (
                        <button
                          key={item}
                          onClick={() => {
                            setSearchQuery(item);
                            executeOnlineSearch(item);
                          }}
                          className="px-3.5 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 hover:text-white transition flex items-center gap-1.5"
                        >
                          <Search className="w-3 h-3 text-zinc-500" />
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'playlists' ? (
            /* ========================================== */
            /* PESTAÑA: TUS PLAYLISTS & BIBLIOTECA */
            /* ========================================== */
            <div className="bg-[#11131C] border border-zinc-800/80 rounded-2xl p-5 space-y-5">
              {selectedPlaylistId ? (
                /* VISTA DETALLE DE PLAYLIST SELECCIONADA */
                (() => {
                  const currentPl = playlists.find((p) => p.id === selectedPlaylistId);
                  if (!currentPl) {
                    setSelectedPlaylistId(null);
                    return null;
                  }
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                        <button
                          onClick={() => setSelectedPlaylistId(null)}
                          className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 transition"
                        >
                          <ChevronLeft className="w-4 h-4" /> Volver a mis playlists
                        </button>
                        <button
                          onClick={(e) => handleDeletePlaylist(currentPl.id, e)}
                          className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Eliminar Playlist
                        </button>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-5">
                        <img
                          src={currentPl.coverUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600'}
                          alt={currentPl.name}
                          className="w-32 h-32 rounded-2xl object-cover shadow-xl border border-zinc-800 shrink-0"
                        />
                        <div className="text-center sm:text-left min-w-0 flex-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            Playlist Personalizada
                          </span>
                          <h2 className="text-2xl font-black text-white truncate">{currentPl.name}</h2>
                          <p className="text-xs text-zinc-400 mt-1">{currentPl.description}</p>
                          <p className="text-[11px] text-zinc-500 font-mono mt-1">
                             {currentPl.tracks.length} canciones · {currentPl.tracks.filter(t => isDownloaded(t.id)).length} descargadas en este dispositivo
                          </p>
                          <div className="flex items-center justify-center sm:justify-start gap-2.5 pt-3">
                            <button
                              onClick={() => handlePlayPlaylist(currentPl, 0)}
                              disabled={currentPl.tracks.length === 0}
                              className={`${accentClasses.bg} text-black font-extrabold text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-lg disabled:opacity-40 transition`}
                            >
                              <Play className="w-4 h-4 fill-current ml-0.5" />
                              Reproducir Todo
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Lista de Canciones en la Playlist */}
                      <div className="space-y-1.5 pt-3">
                        {currentPl.tracks.length > 0 ? (
                          currentPl.tracks.map((track, idx) => (
                            <div
                              key={track.id}
                              onClick={() => handlePlayPlaylist(currentPl, idx)}
                              className="group flex items-center justify-between p-2.5 rounded-xl border border-transparent hover:border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800/60 cursor-pointer transition"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <span className="w-5 text-center text-xs font-mono text-zinc-500 group-hover:text-emerald-400">
                                  {idx + 1}
                                </span>
                                <img
                                  src={track.coverUrl}
                                  alt={track.title}
                                  className="w-10 h-10 rounded-xl object-cover shrink-0 border border-zinc-800"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-white truncate">{track.title}</p>
                                  <p className="text-[11px] text-zinc-400 truncate">{track.artist}</p>
                                  <p className={`text-[10px] ${unavailableTrackIds.has(track.id) && !isDownloaded(track.id) ? 'text-amber-300' : 'text-zinc-500'}`}>
                                    {unavailableTrackIds.has(track.id) && !isDownloaded(track.id) ? 'No disponible · toca para reintentar' : trackSourceLabel(track)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => toggleOfflineVault(track.id, undefined, track)}
                                  disabled={downloadingId === track.id}
                                  className="p-1.5 text-zinc-400 hover:text-emerald-400 disabled:opacity-50"
                                  aria-label={isDownloaded(track.id) ? `Eliminar descarga de ${track.title}` : `Descargar ${track.title} para escuchar sin conexión`}
                                >
                                  {downloadingId === track.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : isDownloaded(track.id) ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Download className="w-4 h-4" />}
                                </button>
                                <span className="text-[11px] text-zinc-500 font-mono hidden sm:inline">
                                  {formatTime(track.duration)}
                                </span>
                                <button
                                  onClick={(e) => handleRemoveTrackFromPlaylist(currentPl.id, track.id, e)}
                                  className="p-1.5 text-zinc-500 hover:text-rose-400 transition"
                                  title="Quitar de la playlist"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                                <Play className="w-4 h-4 text-zinc-400 group-hover:text-emerald-400" />
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-10 text-zinc-500 text-xs">
                            Esta playlist está vacía. Busca cualquier canción y pulsa el botón "+" para añadirla aquí.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : (
                /* GRID DE TODAS LAS PLAYLISTS */
                <div>
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-800">
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <FolderPlus className={`w-5 h-5 ${accentClasses.text}`} />
                        Tus Playlists & Listas de Reproducción
                      </h3>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Crea y organiza tus mezclas favoritas para la ruta, el gimnasio o tus viajes.
                      </p>
                    </div>
                    <button
                      onClick={() => setIsNewPlaylistModalOpen(true)}
                      className={`${accentClasses.bg} text-black font-extrabold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition shadow-lg`}
                    >
                      <Plus className="w-4 h-4" />
                      Nueva Playlist
                    </button>
                  </div>

                  {playlists.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {playlists.map((pl) => (
                        <div
                          key={pl.id}
                          onClick={() => setSelectedPlaylistId(pl.id)}
                          className="group bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800/80 hover:border-emerald-500/50 rounded-2xl p-3.5 cursor-pointer transition flex flex-col justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={pl.coverUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600'}
                              alt={pl.name}
                              className="w-16 h-16 rounded-xl object-cover border border-zinc-800 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <h4 className="text-sm font-bold text-white truncate group-hover:text-emerald-300 transition">
                                {pl.name}
                              </h4>
                              <p className="text-[11px] text-zinc-400 truncate mt-0.5">{pl.description}</p>
                              <span className="text-[10px] text-zinc-500 font-mono block mt-1">
                                {pl.tracks.length} canciones
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-3 mt-3 border-t border-zinc-800/60">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePlayPlaylist(pl, 0);
                              }}
                              disabled={pl.tracks.length === 0}
                              className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 disabled:opacity-40"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" /> Reproducir
                            </button>
                            <button
                              onClick={(e) => handleDeletePlaylist(pl.id, e)}
                              className="text-zinc-500 hover:text-rose-400 p-1"
                              title="Eliminar Playlist"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-zinc-500 text-xs">
                      No tienes ninguna playlist creada aún. Toca en "+ Nueva Playlist" para comenzar tu primera lista.
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : activeTab === 'favorites' ? (
            /* ========================================== */
            /* PESTAÑA: FAVORITAS & ESCUCHADAS (+50%) */
            /* ========================================== */
            <div className="bg-[#11131C] border border-zinc-800/80 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Heart className="w-5 h-5 text-rose-500 fill-current" />
                    Tus Favoritas & Escuchadas (+50%)
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Canciones que marcaste con me gusta o que escuchaste más del 50%. El algoritmo las usa para tus recomendaciones automáticas continuas estilo Spotify.
                  </p>
                </div>
                {favorites50List.length > 0 && (
                  <button
                    onClick={() => {
                      handlePlayPlaylist({ id: 'favorites-queue', name: 'Favoritas y escuchadas', createdAt: 0, tracks: favorites50List });
                      showToast('Reproduciendo tu Mix de Favoritas y +50%');
                    }}
                    className={`${accentClasses.bg} text-black font-extrabold text-xs px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg transition`}
                  >
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                    Reproducir Mix ({favorites50List.length})
                  </button>
                )}
              </div>

              {favorites50List.length > 0 ? (
                <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                  {favorites50List.map((track, idx) => (
                    <div
                      key={track.id}
                      onClick={() => handlePlayPlaylist({ id: 'favorites-queue', name: 'Favoritas y escuchadas', createdAt: 0, tracks: favorites50List }, idx)}
                      className="group flex items-center justify-between p-2.5 rounded-xl border border-transparent hover:border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800/60 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <span className="w-4 text-center text-xs font-mono text-zinc-500 group-hover:text-rose-400">
                          {idx + 1}
                        </span>
                        <img
                          src={track.coverUrl}
                          alt={track.title}
                          className="w-11 h-11 rounded-xl object-cover shrink-0 border border-zinc-800"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-white truncate group-hover:text-rose-300 transition">
                              {track.title}
                            </p>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-rose-950/80 border border-rose-500/30 text-rose-300 font-semibold shrink-0">
                              +50% Escuchado
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 truncate">{track.artist} • {track.genre}</p>
                          <p className={`text-[10px] ${unavailableTrackIds.has(track.id) && !isDownloaded(track.id) ? 'text-amber-300' : 'text-zinc-500'}`}>
                            {unavailableTrackIds.has(track.id) && !isDownloaded(track.id) ? 'No disponible · toca para reintentar' : trackSourceLabel(track)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {/* Añadir a Playlist */}
                        <button
                          onClick={() => setPlaylistModalTrack(track)}
                          className="p-1.5 text-zinc-400 hover:text-white"
                          title="Añadir a playlist"
                        >
                          <ListPlus className="w-4 h-4" />
                        </button>

                        {/* Guardar en Bóveda Offline */}
                        <button
                            onClick={() => toggleOfflineVault(track.id, undefined, track)}
                          className="p-1.5 text-zinc-400 hover:text-emerald-400"
                          title="Descargar offline"
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        <Play className="w-4 h-4 text-zinc-400 group-hover:text-rose-400" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-zinc-500 text-xs space-y-2">
                  <Heart className="w-8 h-8 mx-auto text-zinc-600 mb-2 opacity-50" />
                  <p className="font-semibold text-zinc-400">Aún no hay canciones en tu historial de favoritos.</p>
                  <p className="text-[11px] text-zinc-500">
                    A medida que escuches cualquier canción más del 50%, se guardará automáticamente aquí y el algoritmo la aprenderá para tus recomendaciones.
                  </p>
                </div>
              )}
            </div>
          ) : activeTab === 'dsp-studio' ? (
            /* ========================================== */
            /* PESTAÑA: ESTUDIO DSP, ECUALIZADOR & BOOST DE VOLUMEN */
            /* ========================================== */
            <div className="bg-[#11131C] border border-zinc-800/80 rounded-2xl p-5 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Sliders className={`w-5 h-5 ${accentClasses.text}`} />
                    Ecualizador Paramétrico DSP & Super Boost de Volumen
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Ajuste fino de graves potentes, presets DJ y ganancia de volumen por encima del 100% para audífonos e intercomunicador.
                  </p>
                </div>
                <button
                  onClick={() => applyAudioPreset('normal')}
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg text-zinc-300 transition"
                >
                  Resetear EQ
                </button>
              </div>

              {/* SECCIÓN PRESETS DE ECUALIZACIÓN (INCLUIDO BAJOS POTENTES) */}
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3.5 space-y-2">
                <span className="text-xs font-bold text-zinc-300 block">
                  Presets Rápidos de Ecualización & Bajos:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                  {[
                    { id: 'normal', label: 'Plano (Original)', badge: 'Flat' },
                    { id: 'bassboost', label: 'Mega Bass', badge: '+11dB Bajos' },
                    { id: 'subbass', label: 'Sub-Bass Profundo', badge: 'Subwoofer' },
                    { id: 'reggaeton', label: 'Reggaeton / Urbano', badge: 'Punch + Voz' },
                    { id: 'rock', label: 'Rock Enérgico', badge: 'Graves/Agudos' },
                    { id: 'pop', label: 'Pop & Vocales', badge: 'Voces Claras' },
                    { id: 'electronic', label: 'Club / EDM', badge: 'Pegada Kick' },
                    { id: 'acoustic', label: 'Acústico', badge: 'Natural' },
                    { id: 'slowed', label: 'Slowed + Reverb', badge: '0.84x' },
                    { id: 'nightcore', label: 'Nightcore', badge: '1.25x' },
                    { id: 'lofi', label: 'Lo-Fi Vinilo', badge: 'Filtro 1.8k' }
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => applyAudioPreset(p.id as AudioPreset)}
                      className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                        activePreset === p.id
                          ? 'bg-emerald-500/20 border-emerald-500/80 text-emerald-300'
                          : 'bg-zinc-950/70 border-zinc-800 text-zinc-300 hover:bg-zinc-800/80'
                      }`}
                    >
                      <span className="text-xs font-bold truncate">{p.label}</span>
                      <span className="text-[10px] text-zinc-500 font-mono mt-1">{p.badge}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* CONTROL DE SUPER BOOST DE VOLUMEN (> 100% HASTA 200%) */}
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-zinc-200">
                      Super Preamp / Ganancia de Volumen Extra (hasta 200%)
                    </span>
                  </div>
                  <span className={`text-xs font-mono font-black px-2 py-0.5 rounded-full ${
                    volume > 1.0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-zinc-800 text-zinc-300'
                  }`}>
                    {Math.round(volume * 100)}% {volume > 1.0 ? '⚡ BOOST' : 'NORMAL'}
                  </span>
                </div>

                <input
                  type="range"
                  min="0"
                  max="2.0"
                  step="0.02"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    setIsMuted(false);
                    setVolume(Number(e.target.value));
                  }}
                  className="w-full accent-amber-500 cursor-pointer h-2 bg-zinc-800 rounded-lg"
                />

                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                  {[
                    { label: '100% Normal', val: 1.0 },
                    { label: '120% Boost', val: 1.2 },
                    { label: '130% Boost', val: 1.3 },
                    { label: '150% Super Boost', val: 1.5 },
                    { label: '180% Extra', val: 1.8 },
                    { label: '200% Máximo', val: 2.0 }
                  ].map((btn) => (
                    <button
                      key={btn.val}
                      onClick={() => {
                        setIsMuted(false);
                        setVolume(btn.val);
                        showToast(`Volumen ajustado a ${btn.label}`);
                      }}
                      className={`text-[11px] font-mono px-2.5 py-1 rounded-lg border transition ${
                        Math.abs(volume - btn.val) < 0.03
                          ? 'bg-amber-500 text-black font-extrabold border-amber-400'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* SLIDERS EQ 5 BANDAS */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-zinc-300 block">
                  Ajuste Fino por Bandas de Frecuencia:
                </span>
                <div className="grid grid-cols-5 gap-3 bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-4">
                  {EQ_BANDS.map((band, idx) => (
                    <div key={band.freq} className="flex flex-col items-center space-y-2">
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        {eqGains[idx] > 0 ? `+${eqGains[idx]}` : eqGains[idx]} dB
                      </span>
                      <input
                        type="range"
                        min="-12"
                        max="12"
                        step="1"
                        value={eqGains[idx]}
                        onChange={(e) => {
                          const next = [...eqGains];
                          next[idx] = Number(e.target.value);
                          setEqGains(next);
                        }}
                        className="w-full accent-emerald-500 cursor-pointer"
                      />
                      <span className="text-[11px] text-zinc-400 text-center font-medium">{band.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* SLIDERS DE VELOCIDAD Y FILTRO PASA-BAJOS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-300 font-semibold">Velocidad & Pitch (Cinta)</span>
                    <span className="font-mono text-emerald-400">{playbackSpeed.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.65"
                    max="1.35"
                    step="0.01"
                    value={playbackSpeed}
                    onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-500">
                    <span>0.65x (Slowed)</span>
                    <span>1.0x</span>
                    <span>1.35x (Nightcore)</span>
                  </div>
                </div>

                <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-300 font-semibold">Filtro Pasa-Bajos Lo-Fi</span>
                    <span className="font-mono text-emerald-400">
                      {lowpassFreq >= 18000 ? 'Abierto (20kHz)' : `${lowpassFreq} Hz`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="400"
                    max="20000"
                    step="100"
                    value={lowpassFreq}
                    onChange={(e) => setLowpassFreq(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-500">
                    <span>400Hz</span>
                    <span>2.5kHz (Radio)</span>
                    <span>20kHz</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* LISTA PRINCIPAL DE PISTAS (CATÁLOGO / BÓVEDA OFFLINE) */
            <div className="bg-[#11131C] border border-zinc-800/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    {activeTab === 'vault' ? (
                      <>
                        <ShieldCheck className={`w-4 h-4 ${accentClasses.text}`} />
                        Bóveda Offline (Descargas)
                      </>
                    ) : (
                      <>
                        <Flame className={`w-4 h-4 ${accentClasses.text}`} />
                        Tendencias de YouTube
                      </>
                    )}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {activeTab === 'vault'
                      ? 'Canciones descargadas en la memoria de tu dispositivo. Escucha sin consumir datos.'
                      : regionalLoading
                        ? 'Buscando tendencias de YouTube…'
                        : 'Tendencias de YouTube para tu región y tus gustos. Toca una canción para descargarla desde Telegram.'}
                  </p>
                  {activeTab === 'home' && <label className="inline-flex items-center gap-2 mt-2 text-xs text-zinc-400">
                    Región inicial
                    <select aria-label="Región inicial de recomendaciones" value={musicRegion} onChange={event => {
                      setMusicRegion(event.target.value);
                      localStorage.setItem('thomas_music_region', event.target.value);
                    }} className="rounded-md bg-zinc-900 border border-zinc-700 px-2 py-1 text-zinc-200">
                      <option value="auto">Según el dispositivo</option>
                      <option value="CO">Colombia</option>
                      <option value="global">Global</option>
                    </select>
                  </label>}
                </div>
                <span className="text-xs text-zinc-400 font-mono">
                  {homeTotalPages > 1 ? `Página ${homeCurrentPage} de ${homeTotalPages}` : `${filteredTracks.length} canciones`}
                </span>
              </div>

              {activeTab === 'vault' && (
                <TelegramStatus key={`library:${currentUser?.username || ''}:${fastApiUrl}`} mode="library" username={currentUser?.username} apiUrl={fastApiUrl} onPublished={(filename) => void onTelegramPublished(filename)} onPlayImported={playTelegramImport} onAddImported={item => setPlaylistModalTrack(telegramImportTrack(item))} onDeletedImported={onTelegramImportDeleted} />
              )}

              <div className="space-y-1.5">
                {filteredTracks.length === 0 && <p role="status" className="px-2 py-4 text-sm text-zinc-400">
                  {regionalLoading && activeTab === 'home' ? 'Buscando música para comenzar…' : 'No hay canciones disponibles aquí. Prueba una búsqueda o revisa la conexión.'}
                </p>}
                {paginatedHomeTracks.map((track) => {
                  const isCurrent = activeAudioSource === 'music' && currentMusicTrack.id === track.id;
                  const youtubeImport = isYouTubeResult(track);

                  return (
                    <div
                      key={track.id}
                      onClick={() => youtubeImport ? requestTelegramImport(track) : playSong(track)}
                      className={`group flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer ${
                        isCurrent
                          ? `bg-zinc-800/90 ${accentClasses.border} shadow-md`
                          : 'bg-zinc-900/40 border-transparent hover:bg-zinc-800/50 hover:border-zinc-800'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0">
                          <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
                          <div
                            className={`absolute inset-0 bg-black/50 flex items-center justify-center transition ${
                              isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            }`}
                          >
                            {isCurrent && isPlaying ? (
                              <div className="flex items-end gap-0.5 h-4">
                                <span className={`w-1 bg-current rounded-full animate-bounce ${accentClasses.text}`} style={{ animationDuration: '0.5s' }} />
                                <span className={`w-1 bg-current rounded-full animate-bounce ${accentClasses.text}`} style={{ animationDuration: '0.35s', animationDelay: '0.15s' }} />
                                <span className={`w-1 bg-current rounded-full animate-bounce ${accentClasses.text}`} style={{ animationDuration: '0.65s', animationDelay: '0.3s' }} />
                              </div>
                            ) : (
                              <Play className="w-5 h-5 text-white fill-current" />
                            )}
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm font-bold truncate ${isCurrent ? accentClasses.text : 'text-zinc-100'}`}>
                              {track.title}
                            </p>
                            {track.sourceType === 'local-file' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">
                                MP3 Celular
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-zinc-400 truncate">
                            <span>{track.artist}</span>
                            <span>•</span>
                            <span className="font-mono text-[11px] text-zinc-500">
                              {track.bpm} BPM • {track.keySignature}
                            </span>
                          </div>
                          <p className={`text-[10px] truncate ${unavailableTrackIds.has(track.id) && !isDownloaded(track.id) ? 'text-amber-300' : 'text-zinc-500'}`}>
                            {unavailableTrackIds.has(track.id) && !isDownloaded(track.id) ? 'No disponible · toca para reintentar' : trackSourceLabel(track)}
                          </p>
                        </div>
                      </div>

                      {/* Botones de acción */}
                      <div className="flex items-center gap-2 ml-2">
                        <div className="hidden sm:flex flex-col items-end">
                          <span className="text-[10px] text-zinc-500">{track.genre}</span>
                        </div>

                        {/* Descargar desde Telegram o guardar offline */}
                        {youtubeImport ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); requestTelegramImport(track); }}
                            title="Buscar y descargar la canción"
                            className="p-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={(e) => toggleOfflineVault(track.id, e, track)}
                            title={isDownloaded(track.id) ? 'Guardada en memoria offline' : 'Guardar en Bóveda Offline'}
                            className={`p-2 rounded-xl border transition ${
                              isDownloaded(track.id)
                                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600'
                            }`}
                          >
                            {downloadingId === track.id ? (
                              <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                            ) : isDownloaded(track.id) ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </button>
                        )}

                        {/* Exportar MP3 sin DRM */}
                        {isDownloaded(track.id) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              exportDrmFreeFile(offlineTracks.find(item => item.id === track.id) || track);
                              showToast(`Exportando MP3: ${track.title}`);
                            }}
                            title="Exportar archivo MP3 directo sin DRM"
                            className="p-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 transition"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                        )}

                        {/* Añadir a Playlist */}
                        {!youtubeImport && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPlaylistModalTrack(track);
                            }}
                            title="Añadir a una playlist"
                            className="p-2 rounded-xl border border-zinc-800 text-zinc-400 hover:text-cyan-300 hover:border-cyan-500/50 bg-zinc-900 transition"
                          >
                            <ListPlus className="w-4 h-4" />
                          </button>
                        )}

                        {/* Like */}
                        {!youtubeImport && (
                          <button
                            onClick={(e) => toggleLike(track.id, e)}
                            className={`p-2 rounded-xl transition ${
                              track.liked ? 'text-rose-500' : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                          >
                            <Heart className={`w-4 h-4 ${track.liked ? 'fill-current' : ''}`} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Controles de Paginación para Tendencias & Recomendaciones (Máximo 10 por vista) */}
              {homeTotalPages > 1 && (
                <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80 px-1 mt-3">
                  <button
                    onClick={() => setHomeCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={homeCurrentPage === 1}
                    className="px-3.5 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-850 text-xs font-semibold text-zinc-300 disabled:opacity-30 disabled:pointer-events-none transition"
                  >
                    ← Anterior
                  </button>
                  <span className="text-xs text-zinc-400 font-mono">
                    Página {homeCurrentPage} de {homeTotalPages} ({filteredTracks.length} canciones)
                  </span>
                  <button
                    onClick={() => setHomeCurrentPage((p) => Math.min(homeTotalPages, p + 1))}
                    disabled={homeCurrentPage >= homeTotalPages}
                    className={`px-3.5 py-1.5 rounded-xl ${accentClasses.bg} text-black text-xs font-extrabold disabled:opacity-30 disabled:pointer-events-none shadow-md transition`}
                  >
                    Siguiente →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Espaciador inferior para garantizar que el reproductor persistente nunca tape el contenido */}
          <div className="h-32 sm:h-40 w-full shrink-0 pointer-events-none" aria-hidden="true" />
        </main>

        {/* COLUMNA DERECHA: SEPARADA PARA RADIO Y MÚSICA */}
        {activeTab === 'radio' ? (
          /* PANEL LATERAL DERECHO DE RADIO EN VIVO */
          <aside className="order-3 lg:order-3 lg:col-span-3 space-y-4">
            {/* Control Audífonos & Casco */}
            <div className="bg-[#11131C] border border-zinc-800/80 rounded-2xl p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Headphones className="w-4 h-4 text-red-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Audio Audífonos / Casco
                  </h2>
                </div>
                <span className="text-[10px] font-mono text-emerald-400">MediaSession OK</span>
              </div>
              <p className="text-xs text-zinc-400">
                Transmisión continua optimizada para audífonos Bluetooth e intercomunicador de moto sin interferencias.
              </p>

              {/* Audio 8D Espacial */}
              <div className="flex items-center justify-between bg-zinc-900/90 border border-zinc-800 p-3 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <Zap className={`w-5 h-5 ${is8DAudio ? 'text-red-400' : 'text-zinc-400'}`} />
                  <div>
                    <p className="text-xs font-bold text-zinc-200">Efecto Espacial 8D</p>
                    <p className="text-[10px] text-zinc-400">
                      Rotación {stereoPan > 0 ? `R +${stereoPan}` : `L ${stereoPan}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIs8DAudio(!is8DAudio)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    is8DAudio ? 'bg-red-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {is8DAudio ? 'ACTIVO' : 'OFF'}
                </button>
              </div>
            </div>

            {/* Ficha Técnica de la Emisora al Aire */}
            <div className="bg-[#11131C] border border-zinc-800/80 rounded-2xl p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-red-400" />
                  <h3 className="font-bold text-zinc-200">Ficha Técnica Transmisión</h3>
                </div>
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              </div>
              <div className="space-y-2 text-zinc-300">
                <div>
                  <span className="text-zinc-500 block text-[10px]">Emisora Actual:</span>
                  <span className="font-bold text-white text-xs">{currentRadioStation.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Cadena:</span>
                  <span className="text-zinc-300 truncate max-w-[170px]">{currentRadioStation.artist}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Formato:</span>
                  <span className="font-mono text-emerald-400">MP3 Stream Directo (0 Lag)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Dial:</span>
                  <span className="font-mono text-amber-400">{currentRadioStation.album}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Estado de Señal:</span>
                  <span className="text-red-400 font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    Transmisión Continua
                  </span>
                </div>
              </div>
            </div>
            {/* Espaciador inferior */}
            <div className="h-28 sm:h-36 w-full shrink-0 pointer-events-none" aria-hidden="true" />
          </aside>
        ) : (
          /* PANEL LATERAL DERECHO DE MÚSICA (Audio 8D, Loop A-B, Letras & Notas) */
          <aside className="order-3 lg:order-3 lg:col-span-3 space-y-4">
            {/* PANEL AUDIO 8D & INTERCOM / AUDÍFONOS */}
            <div className="bg-[#11131C] border border-zinc-800/80 rounded-2xl p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bluetooth className={`w-4 h-4 ${accentClasses.text}`} />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Control Audífonos & Casco
                  </h2>
                </div>
                <span className="text-[10px] font-mono text-emerald-400">MediaSession Activo</span>
              </div>

              {/* Audio 8D Espacial */}
              <div className="flex items-center justify-between bg-zinc-900/90 border border-zinc-800 p-3 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <Headphones className={`w-5 h-5 ${is8DAudio ? accentClasses.text : 'text-zinc-400'}`} />
                  <div>
                    <p className="text-xs font-bold text-zinc-200">Audio Espacial 8D</p>
                    <p className="text-[10px] text-zinc-400">
                      Rotación 360° ({stereoPan > 0 ? `R +${stereoPan}` : `L ${stereoPan}`})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIs8DAudio(!is8DAudio)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    is8DAudio ? `${accentClasses.bg} text-black` : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {is8DAudio ? 'ACTIVO' : 'OFF'}
                </button>
              </div>

              {/* Loop de Sección A-B */}
              <div className="bg-zinc-900/90 border border-zinc-800 p-3 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-200">Loop de Sección (A-B)</span>
                  {(loopA !== null || loopB !== null) && (
                    <button
                      onClick={() => {
                        setLoopA(null);
                        setLoopB(null);
                      }}
                      className="text-[10px] text-rose-400 hover:underline"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => setLoopA(Math.floor(currentTime))}
                    className={`py-1.5 px-2 rounded-lg text-xs font-mono border transition ${
                      loopA !== null
                        ? 'bg-emerald-950 border-emerald-500/50 text-emerald-300'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    Punto A: {loopA !== null ? formatTime(loopA) : 'Marcar'}
                  </button>
                  <button
                    onClick={() => {
                      if (loopA !== null && currentTime > loopA) {
                        setLoopB(Math.floor(currentTime));
                      } else {
                        showToast('Marca el Punto A y avanza la canción');
                      }
                    }}
                    className={`py-1.5 px-2 rounded-lg text-xs font-mono border transition ${
                      loopB !== null
                        ? 'bg-emerald-950 border-emerald-500/50 text-emerald-300'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    Punto B: {loopB !== null ? formatTime(loopB) : 'Marcar'}
                  </button>
                </div>
              </div>
            </div>

            {/* LETRAS SINCRONIZADAS */}
            <div className="bg-[#11131C] border border-zinc-800/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mic2 className={`w-4 h-4 ${accentClasses.text}`} />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Letras & Notas
                  </h2>
                </div>
                <span className="text-[10px] text-zinc-500">Toca para saltar</span>
              </div>

              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {(currentMusicTrack.lyrics || []).map((line, idx) => {
                  const nextLine = currentMusicTrack.lyrics[idx + 1];
                  const isActiveLine =
                    currentTime >= line.time && (!nextLine || currentTime < nextLine.time);

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setCurrentTime(line.time);
                        if (audioRef.current) audioRef.current.currentTime = line.time;
                      }}
                      className={`p-2 rounded-xl text-xs cursor-pointer transition flex items-start gap-2 ${
                        isActiveLine
                          ? `bg-zinc-800/90 ${accentClasses.text} font-bold border border-zinc-700`
                          : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                      }`}
                    >
                      <span className="font-mono text-[10px] opacity-60 mt-0.5">
                        {formatTime(line.time)}
                      </span>
                      <span className="flex-1">{line.text}</span>
                    </div>
                  );
                })}
              </div>

              {/* Notas con marca de tiempo */}
              <div className="pt-2 border-t border-zinc-800/80 space-y-2">
                <form onSubmit={addTimestampNote} className="flex gap-1.5">
                  <input
                    type="text"
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    placeholder={`Guardar nota en ${formatTime(currentTime)}...`}
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
                  />
                  <button
                    type="submit"
                    className={`${accentClasses.bg} text-black font-bold px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </form>

                {(trackNotes[currentMusicTrack.id] || []).map((n, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      setCurrentTime(n.time);
                      if (audioRef.current) audioRef.current.currentTime = n.time;
                    }}
                    className="flex items-center gap-2 text-xs bg-zinc-900/90 border border-zinc-800/80 px-2.5 py-1.5 rounded-lg cursor-pointer hover:border-zinc-700"
                  >
                    <Bookmark className={`w-3.5 h-3.5 shrink-0 ${accentClasses.text}`} />
                    <span className="font-mono text-[10px] text-zinc-400">{formatTime(n.time)}</span>
                    <span className="text-zinc-200 truncate">{n.note}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Espaciador inferior */}
            <div className="h-28 sm:h-36 w-full shrink-0 pointer-events-none" aria-hidden="true" />
          </aside>
        )}
      </div>

      {/* REPRODUCTOR MINI FLOTANTE EN CELULAR (SOBRE LA BARRA DE NAVEGACIÓN INFERIOR) */}
      {(musicSelection > 0 || activeAudioSource === 'radio') && <div
        className="mobile-deck md:hidden fixed bottom-16 left-2 right-2 z-40 bg-[#161a23]/95 backdrop-blur-xl border border-zinc-700/80 rounded-2xl p-2.5 shadow-2xl flex items-center justify-between cursor-pointer"
      >
        <button onClick={() => setIsMobileNowPlayingOpen(true)} aria-label={`Abrir reproductor: ${currentTrack.title}, ${currentTrack.artist}`} className="flex items-center gap-3 min-w-0 flex-1 text-left">
          <img src={currentTrack.coverUrl} alt={currentTrack.title} className="w-11 h-11 rounded-xl object-cover shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white truncate">{currentTrack.title}</p>
            <p className="text-[11px] text-zinc-400 truncate">{isBuffering && activeAudioSource === 'music' ? 'Preparando audio…' : playbackQueue ? `${playbackQueue.name} · ${playbackQueue.index + 1}/${playbackQueue.tracks.length}` : currentTrack.artist}</p>
          </div>
        </button>

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={handlePrevTrack}
            aria-label="Canción o emisora anterior"
            className="p-2 text-zinc-300 hover:text-white"
          >
            <SkipBack className="w-4 h-4 fill-current" />
          </button>
          <button onClick={handleNextTrack} aria-label="Siguiente canción o emisora" className="p-2 text-zinc-300 hover:text-white">
            <SkipForward className="w-4 h-4 fill-current" />
          </button>
          {currentTrack.sourceType === 'youtube' ? <span className="text-xs text-zinc-300">Controles en YouTube</span> : <button
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
            className={`w-9 h-9 rounded-full ${accentClasses.bg} text-black flex items-center justify-center`}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>}
        </div>
        {currentTrack.sourceType !== 'radio' && currentTrack.sourceType !== 'youtube' && <div className="mobile-deck__progress" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.max(0, duration > 0 ? currentTime / duration * 100 : 0))}%` }} /></div>}
      </div>}

      {/* PANTALLA COMPLETA NOW PLAYING EXPANDIDA EN CELULAR (ESTILO SPOTIFY MOBILE) */}
      {isMobileNowPlayingOpen && (
        <div className="listening-room md:hidden fixed inset-0 z-50 bg-gradient-to-b from-[#181d28] via-[#0e1118] to-[#07080b] p-6 flex flex-col justify-between overflow-y-auto">
          {/* Cabecera modal */}
          <div className="flex items-center justify-between pt-2">
            <button aria-label="Cerrar reproductor" onClick={() => setIsMobileNowPlayingOpen(false)} className="p-2 text-zinc-400 hover:text-white">
              <ChevronDown className="w-6 h-6" />
            </button>
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Tu sesión · {currentTrack.sourceType === 'youtube' ? 'Controles en YouTube' : isPlaying ? 'Reproduciendo' : 'En pausa'}</p>
              <p className="text-xs font-semibold text-zinc-200">{currentTrack.album}</p>
            </div>
            <button onClick={() => toggleOfflineVault(currentTrack.id, undefined, currentTrack)} className="p-2 text-emerald-400">
              {isDownloaded(currentTrack.id) ? <CheckCircle2 className="w-5 h-5" /> : <Download className="w-5 h-5" />}
            </button>
          </div>

          {/* Gran Carátula */}
          <div className="my-auto py-4 flex flex-col items-center">
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-3xl overflow-hidden shadow-2xl border border-white/10">
              <img src={currentTrack.coverUrl} alt={currentTrack.title} className="w-full h-full object-cover" />
            </div>
          </div>

          {/* Metadata y Controles */}
          <div className="space-y-4 pb-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-black text-white truncate">{currentTrack.title}</h3>
                <p className="text-sm text-zinc-400 truncate">{currentTrack.artist}</p>
              </div>
              <button onClick={(e) => toggleLike(currentTrack.id, e)} className="p-2">
                <Heart className={`w-6 h-6 ${currentTrack.liked ? 'text-rose-500 fill-current' : 'text-zinc-400'}`} />
              </button>
            </div>

            {/* Scrubber o Indicador de Radio en Vivo */}
            <div className="space-y-1">
              {currentTrack.sourceType === 'youtube' ? <p className="text-xs text-zinc-400">Usa el progreso y volumen del reproductor de YouTube.</p> : currentTrack.sourceType === 'radio' ? (
                <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-red-950/50 border border-red-500/40 shadow-inner">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                    <span className="text-xs font-black text-red-400 font-mono tracking-wider">
                      🔴 EN DIRECTO 24/7
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono">SEÑAL DIGITAL SIN CORTES</span>
                </div>
              ) : (
                <>
                  <input
                    type="range"
                    aria-label="Posición de reproducción"
                    min="0"
                    max={duration || currentTrack.duration}
                    value={currentTime}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setCurrentTime(val);
                      if (audioRef.current) audioRef.current.currentTime = val;
                    }}
                    className={`w-full h-1.5 bg-zinc-800 rounded-lg ${accentClasses.accent} cursor-pointer`}
                  />
                  <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration || currentTrack.duration)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Controles Principales */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setIs8DAudio(!is8DAudio)}
                className={`p-2 rounded-xl text-xs font-bold ${is8DAudio ? 'text-emerald-400' : 'text-zinc-500'}`}
              >
                8D AUDIO
              </button>

              <button aria-label="Canción anterior" onClick={handlePrevTrack} className="p-3 text-zinc-300 hover:text-white">
                <SkipBack className="w-7 h-7 fill-current" />
              </button>

              {currentTrack.sourceType === 'youtube' ? <span className="text-xs text-zinc-300">YouTube</span> : <button
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
                className={`w-16 h-16 rounded-full ${accentClasses.bg} text-black flex items-center justify-center shadow-xl transform active:scale-95 transition`}
              >
                {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
              </button>}

              <button aria-label="Siguiente canción" onClick={handleNextTrack} className="p-3 text-zinc-300 hover:text-white">
                <SkipForward className="w-7 h-7 fill-current" />
              </button>

              <button
                onClick={() => applyAudioPreset(activePreset === 'bassboost' ? 'normal' : 'bassboost')}
                className={`p-2 rounded-xl text-xs font-bold ${activePreset === 'bassboost' ? 'text-rose-400' : 'text-zinc-500'}`}
              >
                BASS
              </button>
            </div>

            {/* CONTROL DE VOLUMEN CON SUPER BOOST > 100% PARA CELULAR */}
            <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-3.5 space-y-2.5 mt-1 shadow-lg">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white font-medium"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-rose-400" />
                  ) : (
                    <Volume2 className={`w-4 h-4 ${volume > 1.0 ? 'text-amber-400' : accentClasses.text}`} />
                  )}
                  <span>{isMuted ? 'Silenciado' : 'Volumen'}</span>
                </button>
                <div className="flex items-center gap-1.5">
                  <span className={`font-mono text-xs font-black ${
                    volume > 1.0 ? 'text-amber-400 animate-pulse' : 'text-zinc-200'
                  }`}>
                    {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
                  </span>
                  {volume > 1.0 && (
                    <span className="text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                      ⚡ BOOST
                    </span>
                  )}
                </div>
              </div>

              {/* Slider táctil de 0% a 200% */}
              <input
                type="range"
                min="0"
                max="2.0"
                step="0.02"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setIsMuted(false);
                  setVolume(Number(e.target.value));
                }}
                className="w-full accent-amber-500 h-2 bg-zinc-800 rounded-lg cursor-pointer"
              />

              {/* Botones de Boost directo para audífonos y casco */}
              <div className="flex items-center justify-between gap-1 pt-0.5">
                {[
                  { label: '80%', val: 0.8 },
                  { label: '100%', val: 1.0 },
                  { label: '120% ⚡', val: 1.2 },
                  { label: '150% ⚡', val: 1.5 },
                  { label: '200% 🚀', val: 2.0 }
                ].map((btn) => (
                  <button
                    key={btn.val}
                    onClick={() => {
                      setIsMuted(false);
                      setVolume(btn.val);
                      showToast(`Volumen: ${btn.label}`);
                    }}
                    className={`flex-1 text-[10px] font-mono font-bold py-1.5 rounded-lg border text-center transition ${
                      Math.abs(volume - btn.val) < 0.04
                        ? 'bg-amber-500 text-black border-amber-400 shadow-md font-extrabold'
                        : 'bg-zinc-950/70 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Indicador de Salida de Audio */}
            <div className="flex items-center justify-center gap-2 pt-2 text-xs text-zinc-400">
              <Headphones className="w-4 h-4 text-emerald-400" />
              <span>Compatible con audífonos e intercomunicadores</span>
            </div>
          </div>
        </div>
      )}

      {/* BARRA DE NAVEGACIÓN INFERIOR PARA CELULAR (SPOTIFY PRO LIMPIO) */}
      <nav className="mobile-nav md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0B0D12]/98 backdrop-blur-xl border-t border-zinc-800/80 px-1 py-1.5 flex items-center justify-around">
        {[
          { id: 'home', label: 'Inicio', icon: ListMusic },
          { id: 'search', label: 'Buscar', icon: Search },
          { id: 'playlists', label: 'Playlists', icon: FolderPlus },
          { id: 'favorites', label: 'Favoritas', icon: Heart },
          { id: 'radio', label: 'Radio', icon: Radio },
          { id: 'dsp-studio', label: 'Ecualizador', icon: Sliders },
          { id: 'vault', label: 'Descargas', icon: Download }
        ].map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id as ActiveTab);
                setIsSuggestionsOpen(false);
                window.scrollTo({ top: 0, behavior: 'auto' });
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center min-w-0 py-1 px-1 rounded-lg transition ${
                isActive ? accentClasses.text : 'text-zinc-500'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-semibold mt-0.5 truncate max-w-full">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* BARRA DE REPRODUCCIÓN INFERIOR PERSISTENTE (ESCRITORIO / DESKTOP) */}
      {(musicSelection > 0 || activeAudioSource === 'radio') && <footer className="hidden md:block fixed bottom-0 left-0 right-0 z-40 bg-[#0C0E16]/95 backdrop-blur-xl border-t border-zinc-800/90 px-4 py-3">
        <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-12 items-center gap-3">
          
          {/* Info canción */}
          <div className="md:col-span-3 flex items-center gap-3 min-w-0">
            <img
              src={currentTrack.coverUrl}
              alt={currentTrack.title}
              className="w-12 h-12 rounded-xl object-cover border border-zinc-700 shrink-0"
            />
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">{currentTrack.title}</p>
              <p className="text-xs text-zinc-400 truncate">{currentTrack.artist}</p>
            </div>
            <div className="flex items-center gap-1 ml-1">
              <button
                onClick={(e) => toggleLike(currentTrack.id, e)}
                className={`p-1.5 rounded-lg ${currentTrack.liked ? 'text-rose-500' : 'text-zinc-500 hover:text-white'}`}
                title="Marcar como favorita"
              >
                <Heart className={`w-4 h-4 ${currentTrack.liked ? 'fill-current' : ''}`} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPlaylistModalTrack(currentTrack);
                }}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-cyan-400"
                title="Añadir a una playlist"
              >
                <ListPlus className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => toggleOfflineVault(currentTrack.id, e, currentTrack)}
                className={`p-1.5 rounded-lg ${
                  isDownloaded(currentTrack.id) ? 'text-emerald-400' : 'text-zinc-500 hover:text-white'
                }`}
                title="Descargar offline"
              >
                {isDownloaded(currentTrack.id) ? <CheckCircle2 className="w-4 h-4" /> : <Download className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Controles centrales */}
          <div className="md:col-span-6 flex flex-col items-center space-y-1.5">
            <div className="flex items-center gap-5">
              <button
                onClick={() => setAutoRadioEnabled(!autoRadioEnabled)}
                title={autoRadioEnabled ? 'Radio Inteligente Spotify ACTIVA (+50% aprendido)' : 'Activar Radio Inteligente'}
                className={`text-xs flex items-center gap-1 ${
                  autoRadioEnabled ? accentClasses.text : 'text-zinc-500 hover:text-white'
                }`}
              >
                <Sparkles className="w-4 h-4" />
              </button>

              <button onClick={handlePrevTrack} className="text-zinc-300 hover:text-white transition">
                <SkipBack className="w-5 h-5 fill-current" />
              </button>

              {currentTrack.sourceType === 'youtube' ? <span className="text-xs text-zinc-300">Controles en YouTube</span> : <button
                onClick={togglePlay}
                className={`w-10 h-10 rounded-full ${accentClasses.bg} ${accentClasses.hover} text-black flex items-center justify-center shadow-lg transition transform active:scale-95`}
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </button>}

              <button onClick={handleNextTrack} className="text-zinc-300 hover:text-white transition">
                <SkipForward className="w-5 h-5 fill-current" />
              </button>

              <button
                onClick={() => setActiveTab(activeTab === 'dsp-studio' ? 'home' : 'dsp-studio')}
                title="Abrir Ecualizador DSP & Boost"
                className={`text-xs flex items-center gap-1 ${
                  activeTab === 'dsp-studio' ? accentClasses.text : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Sliders className="w-4 h-4" />
              </button>
            </div>

            {/* Barra de progreso o Indicador Radio */}
            {currentTrack.sourceType === 'youtube' ? <p className="text-xs text-zinc-400">Progreso y volumen en el reproductor de YouTube</p> : currentTrack.sourceType === 'radio' ? (
              <div className="w-full max-w-xl flex items-center justify-between px-4 py-1.5 rounded-xl bg-red-950/40 border border-red-500/40">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                  <span className="text-xs font-black text-red-400 font-mono tracking-wider shrink-0">🔴 SEÑAL EN VIVO</span>
                  <span className="text-xs text-zinc-400 truncate">• {currentTrack.album}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono shrink-0">
                  <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  <span>Bitrate Óptimo • DSP Activo</span>
                </div>
              </div>
            ) : (
              <div className="w-full max-w-xl flex items-center gap-3">
                <span className="text-[11px] font-mono text-zinc-400 w-9 text-right">
                  {formatTime(currentTime)}
                </span>
                <div className="relative flex-1 flex items-center">
                  <input
                    type="range"
                    min="0"
                    max={duration || currentTrack.duration}
                    value={currentTime}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setCurrentTime(val);
                      if (audioRef.current) audioRef.current.currentTime = val;
                    }}
                    className={`w-full h-1.5 bg-zinc-800 rounded-lg ${accentClasses.accent} cursor-pointer`}
                  />
                </div>
                <span className="text-[11px] font-mono text-zinc-400 w-9">
                  {formatTime(duration || currentTrack.duration)}
                </span>
              </div>
            )}
          </div>

          {/* Volumen con Boost > 100% y velocidad */}
          <div className="hidden md:flex md:col-span-3 items-center justify-end gap-3">
            <span className="text-[11px] font-mono px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
              {playbackSpeed.toFixed(2)}x
            </span>

            <button
              onClick={() => setIsMuted(!isMuted)}
              className="text-zinc-400 hover:text-white transition"
              title={isMuted ? 'Desmutear' : 'Silenciar'}
            >
              {isMuted || volume === 0 ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5" />}
            </button>

            {/* Slider de volumen con soporte hasta 200% Super Boost */}
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="2.0"
                step="0.02"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setIsMuted(false);
                  setVolume(Number(e.target.value));
                }}
                className={`w-20 lg:w-24 h-1.5 bg-zinc-800 rounded-lg ${accentClasses.accent} cursor-pointer`}
              />
              <span className={`text-[10px] font-mono font-bold w-12 text-right ${
                volume > 1.0 ? 'text-amber-400 font-extrabold animate-pulse' : 'text-zinc-400'
              }`}>
                {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
              </span>
              <button
                onClick={() => {
                  setIsMuted(false);
                  const nextVol = volume < 1.0 ? 1.0 : volume < 1.2 ? 1.2 : volume < 1.5 ? 1.5 : volume < 2.0 ? 2.0 : 0.8;
                  setVolume(nextVol);
                  showToast(`Volumen: ${Math.round(nextVol * 100)}% ${nextVol > 1 ? '⚡ Super Boost' : ''}`);
                }}
                className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border transition ${
                  volume > 1.0
                    ? 'bg-amber-500 text-black border-amber-400 font-extrabold shadow-sm'
                    : 'bg-zinc-850 text-zinc-400 border-zinc-700 hover:text-white'
                }`}
                title="Super Boost de volumen por encima del 100%"
              >
                {volume > 1.0 ? `${Math.round(volume * 100)}% ⚡` : 'Boost +'}
              </button>
            </div>
          </div>
        </div>
      </footer>}

      {/* ========================================== */}
      {/* MODAL: AÑADIR A PLAYLIST */}
      {/* ========================================== */}
      {playlistModalTrack && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121522] border border-zinc-700/80 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">Añadir a Playlist</h3>
              </div>
              <button
                onClick={() => setPlaylistModalTrack(null)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-3 bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800">
              <img
                src={playlistModalTrack.coverUrl}
                alt={playlistModalTrack.title}
                className="w-12 h-12 rounded-xl object-cover border border-zinc-800 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">{playlistModalTrack.title}</p>
                <p className="text-[11px] text-zinc-400 truncate">{playlistModalTrack.artist}</p>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-zinc-300 block">Selecciona la lista destino:</span>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {playlists.map((pl) => (
                  <button
                    key={pl.id}
                    onClick={() => handleAddTrackToPlaylist(pl.id, playlistModalTrack)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl border border-zinc-800 hover:border-emerald-500/60 bg-zinc-900/50 hover:bg-zinc-800/80 transition text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-zinc-200 truncate">{pl.name}</p>
                      <p className="text-[10px] text-zinc-500">{pl.tracks.length} canciones</p>
                    </div>
                    <Plus className="w-4 h-4 text-emerald-400" />
                  </button>
                ))}
              </div>
            </div>

            {/* Crear nueva playlist al vuelo */}
            <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
              <button
                onClick={() => {
                  setIsNewPlaylistModalOpen(true);
                }}
                className="text-xs text-emerald-400 hover:underline font-bold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Crear nueva lista ahora
              </button>
              <button
                onClick={() => setPlaylistModalTrack(null)}
                className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3.5 py-1.5 rounded-xl text-zinc-300"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: CREAR NUEVA PLAYLIST */}
      {/* ========================================== */}
      {isNewPlaylistModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121522] border border-zinc-700/80 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">Crear Nueva Playlist</h3>
              </div>
              <button
                onClick={() => setIsNewPlaylistModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1">Nombre de la lista:</label>
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="Ej: Reggaeton 2026, Viaje en Moto, Clásicos..."
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1">Descripción (opcional):</label>
                <input
                  type="text"
                  value={newPlaylistDesc}
                  onChange={(e) => setNewPlaylistDesc(e.target.value)}
                  placeholder="Ej: Mezcla con bajos pesados para mis audífonos"
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setIsNewPlaylistModalOpen(false)}
                className="text-xs bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-xl text-zinc-300 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleCreatePlaylist(newPlaylistName, newPlaylistDesc)}
                className={`${accentClasses.bg} text-black font-extrabold text-xs px-5 py-2 rounded-xl transition shadow-lg`}
              >
                Crear Playlist
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: CONFIGURAR SERVIDOR LOCAL / NAS */}
      {/* ========================================== */}
      {showServerModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121522] border border-zinc-700/80 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">Servidor de Streaming Backend</h3>
              </div>
              <button
                onClick={() => setShowServerModal(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/60 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-300">Estado de Conexión:</span>
                <span className={`font-mono font-bold px-2 py-0.5 rounded-full ${
                  serverStatus === 'connected'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                    : 'bg-amber-950 text-amber-400 border border-amber-500/40'
                }`}>
                  {serverStatus === 'connected' ? '● Conectado (Full-Stream)' : '○ Desconectado'}
                </span>
              </div>
              <p className="text-zinc-400 text-[11px]">
                Cuando el servidor local está activo con <code className="text-emerald-300 font-mono">python server.py</code>, todas las canciones se transmiten COMPLETAS (3 a 5+ min) sin límite de 30 segundos.
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-300 block mb-1">URL del Servidor FastAPI:</label>
              <input
                type="text"
                value={fastApiUrl}
                onChange={(e) => setFastApiUrl(e.target.value)}
                placeholder="http://localhost:8000"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setShowServerModal(false)}
                className="text-xs bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-xl text-zinc-300 transition"
              >
                Cerrar
              </button>
              <button
                onClick={() => void connectFastApiServer()}
                disabled={serverStatus === 'connecting'}
                className={`${accentClasses.bg} text-black font-extrabold text-xs px-5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-lg`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${serverStatus === 'connecting' ? 'animate-spin' : ''}`} />
                {serverStatus === 'connected' ? 'Re-Probar' : 'Conectar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: INICIAR SESIÓN / CREAR CUENTA */}
      {/* ========================================== */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121522] border border-zinc-700/90 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            {/* Header del modal */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 text-black flex items-center justify-center shadow">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">
                    {authMode === 'login' ? 'Iniciar Sesión' : 'Crear Tu Cuenta'}
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Tus playlists, gustos y sugerencias privadas
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsAuthModalOpen(false);
                  setAuthError(null);
                }}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector de pestañas: Iniciar Sesión / Registrarse */}
            <div className="grid grid-cols-2 p-1 bg-zinc-900 border border-zinc-800 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setAuthError(null);
                }}
                className={`py-2 text-xs font-bold rounded-lg transition ${
                  authMode === 'login' ? `${accentClasses.bg} text-black shadow-md` : 'text-zinc-400 hover:text-white'
                }`}
              >
                Iniciar Sesión
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setAuthError(null);
                }}
                className={`py-2 text-xs font-bold rounded-lg transition ${
                  authMode === 'register' ? `${accentClasses.bg} text-black shadow-md` : 'text-zinc-400 hover:text-white'
                }`}
              >
                Crear Cuenta
              </button>
            </div>

            {/* Mensaje de error si ocurre */}
            {authError && (
              <div className="bg-rose-950/70 border border-rose-500/50 text-rose-300 text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {/* Formulario */}
            <form onSubmit={authMode === 'login' ? handleLoginSubmit : handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1">Nombre de Usuario:</label>
                <input
                  type="text"
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  placeholder="ej: jhoel, maria, etc."
                  required
                  autoFocus
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none font-mono"
                />
              </div>

              {authMode === 'register' && (
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1">Tu Nombre o Apodo:</label>
                  <input
                    type="text"
                    value={authDisplayName}
                    onChange={(e) => setAuthDisplayName(e.target.value)}
                    placeholder="ej: Thomas"
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1">Contraseña:</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={isAuthLoading}
                className={`w-full ${accentClasses.bg} text-black font-extrabold text-sm py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-xl hover:opacity-95 transition disabled:opacity-50 mt-2`}
              >
                {isAuthLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : authMode === 'login' ? (
                  <LogIn className="w-4 h-4" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                <span>{authMode === 'login' ? 'Entrar a Mi Música' : 'Registrar y Comenzar'}</span>
              </button>
            </form>

            <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
              <span className="text-[11px] text-zinc-500">¿No quieres crear cuenta ahora?</span>
              <button
                type="button"
                onClick={() => {
                  setIsAuthModalOpen(false);
                  setAuthError(null);
                }}
                className="text-zinc-300 hover:text-white font-medium hover:underline"
              >
                Seguir como Invitado →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
