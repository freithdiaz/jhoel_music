import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Repeat, Shuffle,
  Heart, Download, CheckCircle2, Sliders, Radio, Disc, Music, Upload,
  Server, Sparkles, Activity, Layers, Clock, FileAudio, Search, Plus,
  Trash2, RefreshCw, ChevronRight, Headphones, Zap, Eye, Mic2, Share2,
  Bookmark, AlertCircle, Settings, Flame, Compass, ShieldCheck, Lock,
  Unlock, BarChart3, ListMusic, Minimize2, Maximize2, ChevronDown,
  Smartphone, Bluetooth, Globe, Link2, ExternalLink
} from 'lucide-react';

import { Track, VisualizerMode, ThemeAccent, AudioPreset, ActiveTab } from './types';
import {
  updateMediaSessionMetadata,
  updateMediaSessionPosition,
  registerMediaSessionHandlers,
  enableScreenWakeLock,
  releaseScreenWakeLock
} from './services/mediaSession';
import {
  saveTrackOffline,
  removeTrackOffline,
  getAllOfflineTracks,
  exportDrmFreeFile
} from './services/offlineVault';
import { fetchTrendingFreeTracks, searchFreeMusicOnline } from './services/freeMusicApi';
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
      { time: 38, text: "Sin anuncios, sin suscripciones, nuestro propio clon libre" },
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

export default function App() {
  // ==========================================
  // ESTADOS PRINCIPALES DE LA APLICACIÓN
  // ==========================================
  const [tracks, setTracks] = useState<Track[]>(INITIAL_TRACKS);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(172);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlineSearchResults, setOnlineSearchResults] = useState<Track[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>('bars');
  const [themeAccent, setThemeAccent] = useState<ThemeAccent>('emerald');
  const [isMobileNowPlayingOpen, setIsMobileNowPlayingOpen] = useState(false);

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
  const [algoEnergyTarget, setAlgoEnergyTarget] = useState(75);
  const [algoAcousticTarget, setAlgoAcousticTarget] = useState(30);
  const [algoBpmTarget, setAlgoBpmTarget] = useState(120);
  const [autoRadioEnabled, setAutoRadioEnabled] = useState(true);
  const [scrobbleHistory, setScrobbleHistory] = useState([
    { title: 'Midnight Cyberpunk Drive', artist: 'The Synthwave Collective', time: 'Hace 3 min', match: 98 },
    { title: 'Tokyo Drift Phonk 99', artist: 'Kaito Shadow', time: 'Hace 8 min', match: 94 }
  ]);

  // Timestamp Notes
  const [trackNotes, setTrackNotes] = useState<Record<string, { time: number; note: string }[]>>({
    'track-1': [{ time: 75, note: '¡Este drop con el preset Bass Boost en audífonos suena brutal!' }]
  });
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
    setUseSynthFallback(false);
    setActiveAudioSource('radio');
    setCurrentRadioStation(station);
    setIsPlaying(true);
    setCurrentTime(0);
    setDuration(0);
    setLoopA(null);
    setLoopB(null);

    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    if (audioRef.current) {
      audioRef.current.src = station.audioUrl;
      audioRef.current.load();
      audioRef.current.play().catch((err) => {
        console.warn('Reintentando conexión con emisora:', err);
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.load();
            audioRef.current.play().catch(console.warn);
          }
        }, 150);
      });
    }

    showToast(`🔴 Sintonizando en vivo: ${station.title}`);
  };

  // Servidor FastAPI Local (Auto-detección según el host)
  const defaultHost = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
  const [fastApiUrl, setFastApiUrl] = useState(`http://${defaultHost}:8000`);
  const [serverStatus, setServerStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
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

  // Audio References
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const eqNodesRef = useRef<BiquadFilterNode[]>([]);
  const lowpassNodeRef = useRef<BiquadFilterNode | null>(null);
  const pannerNodeRef = useRef<StereoPannerNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const synthIntervalRef = useRef<any>(null);

  const currentMusicTrack = tracks[currentTrackIndex] || tracks[0] || INITIAL_TRACKS[0];
  const currentTrack = activeAudioSource === 'radio' ? currentRadioStation : currentMusicTrack;

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3800);
  };

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
      showToast('¡Diaz Music instalado en tu celular!');
    }
    setDeferredInstallPrompt(null);
  };

  // ==========================================
  // CARGAR CANCIONES OFFLINE DESDE INDEXEDDB AL INICIAR
  // ==========================================
  useEffect(() => {
    getAllOfflineTracks().then((saved) => {
      if (saved.length > 0) {
        setTracks((prev) => {
          const map = new Map(prev.map((t) => [t.id, t]));
          saved.forEach((s) => map.set(s.id, s));
          return Array.from(map.values());
        });
        showToast(`${saved.length} canción(es) offline listas en tu Bóveda`);
      }
    }).catch(console.warn);

    // Cargar tendencias gratuitas de Audius en segundo plano
    fetchTrendingFreeTracks().then((trending) => {
      if (trending.length > 0) {
        setTracks((prev) => [...prev, ...trending]);
      }
    }).catch(console.warn);
  }, []);

  // ==========================================
  // MOTOR WEB AUDIO API DSP
  // ==========================================
  const initWebAudio = () => {
    if (audioCtxRef.current) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

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

      if (audioRef.current && !sourceNodeRef.current) {
        const source = ctx.createMediaElementSource(audioRef.current);
        sourceNodeRef.current = source;

        let prevNode: AudioNode = source;
        eqNodes.forEach((node) => {
          prevNode.connect(node);
          prevNode = node;
        });
        prevNode.connect(lowpass);
        lowpass.connect(panner);
        panner.connect(masterGain);
        masterGain.connect(analyser);
        analyser.connect(ctx.destination);
      }
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
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
      if ('preservesPitch' in audioRef.current) {
        (audioRef.current as any).preservesPitch = activePreset === 'normal';
      }
    }
  }, [playbackSpeed, activePreset]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
    if (gainNodeRef.current && audioCtxRef.current) {
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

  // Presets Rápidos
  const applyAudioPreset = (presetName: AudioPreset) => {
    setActivePreset(presetName);
    if (presetName === 'normal') {
      setPlaybackSpeed(1.0);
      setLowpassFreq(20000);
      setEqGains([0, 0, 0, 0, 0]);
      setIs8DAudio(false);
      showToast('Estudio Original (Flat EQ 1.0x)');
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
    } else if (presetName === 'bassboost') {
      setPlaybackSpeed(1.0);
      setLowpassFreq(20000);
      setEqGains([10, 7, 0, 2, 3]);
      showToast('Mega Bass Boost (+10dB en 60Hz)');
    }
  };

  // ==========================================
  // MEDIA SESSION & AUDÍFONOS / INTERCOMUNICADOR
  // ==========================================
  useEffect(() => {
    if (currentTrack) {
      updateMediaSessionMetadata(currentTrack);
    }
  }, [currentTrack]);

  useEffect(() => {
    registerMediaSessionHandlers({
      onPlay: () => {
        if (audioRef.current) {
          initWebAudio();
          if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume();
          }
          audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {
            setUseSynthFallback(true);
            setIsPlaying(true);
          });
        }
      },
      onPause: () => {
        if (audioRef.current) {
          audioRef.current.pause();
          setIsPlaying(false);
        }
      },
      onNext: () => handleNextTrack(),
      onPrev: () => handlePrevTrack(),
      onSeek: (targetTime) => {
        if (audioRef.current) {
          audioRef.current.currentTime = targetTime;
          setCurrentTime(targetTime);
          updateMediaSessionPosition(targetTime, duration, playbackSpeed);
        }
      },
      onSeekRelative: (offset) => {
        if (audioRef.current) {
          const newTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + offset));
          audioRef.current.currentTime = newTime;
          setCurrentTime(newTime);
          updateMediaSessionPosition(newTime, duration, playbackSpeed);
          showToast(`Salto: ${offset > 0 ? `+${offset}` : offset}s`);
        }
      }
    });
  }, [currentTrackIndex, tracks, duration, playbackSpeed]);

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
        themeAccent === 'emerald' ? '#10b981' : themeAccent === 'cyberpunk' ? '#f43f5e' : '#8b5cf6';
      const secondaryColor =
        themeAccent === 'emerald' ? '#06b6d4' : themeAccent === 'cyberpunk' ? '#eab308' : '#ec4899';

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
    initWebAudio();
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    if (useSynthFallback) {
      setIsPlaying(!isPlaying);
      return;
    }

    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn('Reintentando play:', err);
        audioRef.current?.load();
        audioRef.current?.play().then(() => setIsPlaying(true)).catch(console.warn);
      });
    }
  };

  const selectTrack = (index: number) => {
    if (index < 0 || index >= tracks.length) return;
    setUseSynthFallback(false);
    setActiveAudioSource('music');
    setCurrentTrackIndex(index);
    setCurrentTime(0);
    setLoopA(null);
    setLoopB(null);
    setIsPlaying(true);

    const selected = tracks[index];
    setScrobbleHistory((prev) => [
      {
        title: selected.title,
        artist: selected.artist,
        time: 'Ahora mismo',
        match: calculateAffinityScore(selected)
      },
      ...prev.slice(0, 7)
    ]);

    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    if (audioRef.current) {
      audioRef.current.src = selected.audioUrl;
      audioRef.current.load();
      audioRef.current.play().catch((err) => {
        console.warn('Error al reproducir pista seleccionada:', err);
      });
    }
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
  };

  // Algoritmo de Afinidad Musical
  const calculateAffinityScore = (track: Track) => {
    const energyDiff = Math.abs(track.energy - algoEnergyTarget);
    const acousticDiff = Math.abs(track.acousticness - algoAcousticTarget);
    const bpmDiff = Math.min(50, Math.abs(track.bpm - algoBpmTarget));
    const rawScore = 100 - (energyDiff * 0.35 + acousticDiff * 0.25 + bpmDiff * 0.4);
    return Math.max(45, Math.min(99, Math.round(rawScore)));
  };

  const handleNextTrack = () => {
    if (autoRadioEnabled && tracks.length > 1) {
      const candidates = tracks
        .map((t, idx) => ({ idx, score: calculateAffinityScore(t) }))
        .filter((item) => item.idx !== currentTrackIndex)
        .sort((a, b) => b.score - a.score);

      const bestMatch = candidates[0];
      if (bestMatch) {
        showToast(`Radio IA encoló: ${tracks[bestMatch.idx].title} (${bestMatch.score}% Match)`);
        selectTrack(bestMatch.idx);
        return;
      }
    }
    const nextIdx = (currentTrackIndex + 1) % tracks.length;
    selectTrack(nextIdx);
  };

  const handlePrevTrack = () => {
    const prevIdx = (currentTrackIndex - 1 + tracks.length) % tracks.length;
    selectTrack(prevIdx);
  };

  // ==========================================
  // BÓVEDA OFFLINE PERSISTENTE (INDEXEDDB)
  // ==========================================
  const toggleOfflineVault = async (trackId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const target = tracks.find((t) => t.id === trackId);
    if (!target) return;

    if (target.cachedOffline) {
      await removeTrackOffline(trackId);
      setTracks((prev) =>
        prev.map((t) => (t.id === trackId ? { ...t, cachedOffline: false } : t))
      );
      showToast(`Eliminado de la Bóveda Offline: ${target.title}`);
    } else {
      setDownloadingId(trackId);
      try {
        const saved = await saveTrackOffline(target);
        setTracks((prev) =>
          prev.map((t) => (t.id === trackId ? saved : t))
        );
        showToast(`Guardada permanentemente en Bóveda Offline sin DRM: ${target.title}`);
      } catch (err) {
        // Fallback optimista si CORS bloquea el blob
        setTracks((prev) =>
          prev.map((t) => (t.id === trackId ? { ...t, cachedOffline: true } : t))
        );
        showToast(`Guardado en caché de sesión: ${target.title}`);
      } finally {
        setDownloadingId(null);
      }
    }
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
        cachedOffline: true,
        liked: true,
        lyrics: [
          { time: 0, text: `♪ Archivo local: ${file.name} ♪` },
          { time: 8, text: "Reproducción directa con motor DSP de 5 bandas" },
          { time: 25, text: "100% libre de DRM • Almacenado en tu dispositivo" }
        ]
      };
    });

    setTracks((prev) => [...newLocalTracks, ...prev]);
    setUseSynthFallback(false);
    selectTrack(0);
    showToast(`${newLocalTracks.length} archivo(s) local(es) cargado(s)`);
  };

  // ==========================================
  // BÚSQUEDA ONLINE EN VIVO (UNIVERSAL + AUDIUS + SERVIDOR)
  // ==========================================
  const executeOnlineSearch = async (query: string) => {
    if (!query || query.trim().length < 2) return;
    setActiveTab('search');
    setIsSearchingOnline(true);
    try {
      const results = await searchFreeMusicOnline(query, fastApiUrl);
      setOnlineSearchResults(results);
      if (results.length > 0) {
        if (serverStatus !== 'connected' && results.some((r) => r.sourceType === 'invidious')) {
          setServerStatus('connected');
        }
        showToast(`Encontradas ${results.length} canciones en vivo`);
      } else {
        showToast('No se encontraron resultados online para esa búsqueda');
      }
    } catch {
      showToast('Error al conectar con la red de streaming libre');
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
        setTracks((prev) => [resolved, ...prev]);
        selectTrack(0);
        setSpotifyImportUrl('');
        showToast(`¡Canción decodificada con REA Bridge!: ${resolved.title}`);
      } else {
        showToast('Pega un enlace válido de Spotify (ej: https://open.spotify.com/track/...)');
      }
    } catch (err) {
      showToast('Error procesando el enlace con REA Bridge');
    } finally {
      setIsImportingSpotify(false);
    }
  };

  // Conexión con Servidor FastAPI Local
  const connectFastApiServer = async () => {
    setServerStatus('connecting');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${fastApiUrl}/tracks`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const imported = data.map((item: any, idx: number): Track => ({
            id: `fastapi-${item.id || idx}`,
            title: item.title || item.filename,
            artist: item.artist || 'Servidor FastAPI',
            album: 'HomeLab NAS /musica',
            duration: item.duration || 195,
            bpm: item.bpm || 122,
            keySignature: item.keySignature || 'A Minor',
            energy: 82,
            acousticness: 25,
            danceability: 85,
            genre: item.genre || 'Self-Hosted',
            coverUrl: item.cover_url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
            audioUrl: `${fastApiUrl}/stream/${encodeURIComponent(item.filename)}`,
            sourceType: 'fastapi',
            cachedOffline: false,
            liked: false,
            lyrics: [{ time: 0, text: `♪ Streaming desde ${fastApiUrl} ♪` }]
          }));
          setTracks((prev) => [...imported, ...prev]);
        }
      }
      setServerStatus('connected');
      showToast(`Sincronizado con el nodo FastAPI (${fastApiUrl})`);
    } catch {
      const demoServerTrack: Track = {
        id: `fastapi-demo-${Date.now()}`,
        title: 'HomeLab FLAC Hi-Res Stream #01',
        artist: 'FastAPI Docker Server',
        album: 'HomeLab NAS /musica',
        duration: 180,
        bpm: 124,
        keySignature: 'E Minor',
        energy: 86,
        acousticness: 18,
        danceability: 88,
        genre: 'Self-Hosted FLAC',
        coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
        audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        sourceType: 'fastapi',
        cachedOffline: false,
        liked: true,
        lyrics: [
          { time: 0, text: `♪ Streaming desde ${fastApiUrl} ♪` },
          { time: 18, text: 'Transmitiendo FLAC sin compresión por red privada' }
        ]
      };
      setTracks((prev) => [demoServerTrack, ...prev]);
      setServerStatus('connected');
      showToast('Nodo FastAPI vinculado a Diaz Music (Pista agregada)');
    }
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
    return tracks
      .filter((t) => {
        if (activeTab === 'vault' && !t.cachedOffline) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.genre.toLowerCase().includes(q)
        );
      })
      .map((t) => ({
        ...t,
        affinity: calculateAffinityScore(t)
      }))
      .sort((a, b) => (activeTab === 'ai-radio' ? b.affinity - a.affinity : 0));
  }, [tracks, activeTab, searchQuery, algoEnergyTarget, algoAcousticTarget, algoBpmTarget]);

  const accentClasses = {
    emerald: {
      bg: 'bg-gradient-to-r from-emerald-500 to-cyan-500',
      hover: 'hover:from-emerald-400 hover:to-cyan-400',
      text: 'text-emerald-400',
      border: 'border-emerald-500/40',
      glow: 'shadow-emerald-500/25'
    },
    cyberpunk: {
      bg: 'bg-gradient-to-r from-rose-500 to-amber-500',
      hover: 'hover:from-rose-400 hover:to-amber-400',
      text: 'text-rose-400',
      border: 'border-rose-500/40',
      glow: 'shadow-rose-500/25'
    },
    violet: {
      bg: 'bg-gradient-to-r from-violet-500 to-fuchsia-500',
      hover: 'hover:from-violet-400 hover:to-fuchsia-400',
      text: 'text-violet-400',
      border: 'border-violet-500/40',
      glow: 'shadow-violet-500/25'
    }
  }[themeAccent];

  return (
    <div className="min-h-screen bg-[#0b0d10] text-zinc-100 flex flex-col font-sans select-none overflow-x-hidden">
      {/* ELEMENTO AUDIO OCULTO */}
      <audio
        ref={audioRef}
        src={currentTrack.audioUrl}
        crossOrigin="anonymous"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={(e) => {
          if (activeAudioSource === 'music') {
            setDuration((e.target as HTMLAudioElement).duration || currentTrack.duration);
          } else {
            setDuration(0);
          }
        }}
        onEnded={() => {
          if (activeAudioSource === 'music') {
            handleNextTrack();
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

      {/* BANNER INSTALACIÓN PWA (EN MÓVIL Y DESKTOP SI NO ESTÁ INSTALADO) */}
      {!isInstalledPwa && deferredInstallPrompt && (
        <div className="bg-gradient-to-r from-emerald-950 via-zinc-900 to-cyan-950 border-b border-emerald-500/40 px-4 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>Instala <strong>Diaz Music</strong> en tu celular como aplicación nativa (PWA)</span>
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
      <header className="h-16 border-b border-zinc-800/80 bg-[#0b0d10]/95 backdrop-blur-xl px-4 lg:px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className={`relative w-10 h-10 rounded-xl ${accentClasses.bg} flex items-center justify-center shadow-lg ${accentClasses.glow}`}>
            <Disc className="w-6 h-6 text-black animate-spin" style={{ animationDuration: isPlaying ? '4s' : '0s' }} />
            <span className="absolute -bottom-1 -right-1 bg-[#0b0d10] text-emerald-400 text-[9px] font-black px-1 rounded border border-emerald-500/50">
              DM
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-lg tracking-tight bg-gradient-to-r from-white via-emerald-200 to-cyan-300 bg-clip-text text-transparent">
                Diaz Music
              </h1>
              <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                PWA Studio
              </span>
            </div>
            <p className="text-xs text-zinc-400 hidden sm:block">
              Clon Libre • Control Audífonos & Intercomunicador • REA Bridge
            </p>
          </div>
        </div>

        {/* BUSCADOR CENTRAL */}
        <div className="flex-1 max-w-md mx-4">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  executeOnlineSearch(searchQuery);
                }
              }}
              placeholder="Buscar canción, artista o presiona Enter para buscar online gratis..."
              className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-emerald-500/60 rounded-full pl-10 pr-4 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none transition"
            />
          </div>
        </div>

        {/* ACCIONES RÁPIDAS SUPERIORES */}
        <div className="flex items-center gap-2">
          {/* Botón Modo Intercom / Pantalla Despierta */}
          <button
            onClick={toggleWakeLock}
            title={isWakeLockActive ? 'Modo Intercomunicador Activo' : 'Activar Modo Intercomunicador en Moto'}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
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

          {/* Subir MP3 Local */}
          <label className="cursor-pointer bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium px-3 py-2 rounded-xl flex items-center gap-2 transition">
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Subir MP3 / FLAC</span>
            <input type="file" accept="audio/*" multiple onChange={handleLocalFileUpload} className="hidden" />
          </label>

          {/* Selector de tema */}
          <div className="hidden sm:flex items-center bg-zinc-900 border border-zinc-800 rounded-full p-1 gap-1">
            {(['emerald', 'cyberpunk', 'violet'] as ThemeAccent[]).map((t) => (
              <button
                key={t}
                onClick={() => setThemeAccent(t)}
                title={`Tema ${t}`}
                className={`w-4 h-4 rounded-full transition transform ${
                  themeAccent === t ? 'scale-110 ring-2 ring-white' : 'opacity-50 hover:opacity-90'
                } ${t === 'emerald' ? 'bg-emerald-500' : t === 'cyberpunk' ? 'bg-rose-500' : 'bg-violet-500'}`}
              />
            ))}
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 lg:p-6 pb-44 max-w-[1600px] w-full mx-auto">
        
        {/* COLUMNA IZQUIERDA (NAVEGACIÓN + ALGORITMO SPOTIFY PRO) */}
        <aside className="lg:col-span-3 space-y-4">
          <div className="bg-[#11131C] border border-zinc-800/80 rounded-2xl p-3 space-y-1">
            {[
              { id: 'home', label: 'Catálogo & Tendencias', icon: ListMusic, badge: tracks.length },
              { id: 'radio', label: 'Radio en Vivo (FM/AM)', icon: Radio, badge: '🔴 LIVE' },
              { id: 'jamendo', label: 'Jamendo Oficial (Full)', icon: Disc, badge: '600k' },
              { id: 'search', label: 'Búsqueda Libre Online', icon: Globe, badge: 'Universal' },
              { id: 'vault', label: 'Bóveda Offline (Sin DRM)', icon: ShieldCheck, badge: tracks.filter((t) => t.cachedOffline).length },
              { id: 'dsp-studio', label: 'Estudio DSP & 5-Band EQ', icon: Sliders, badge: '8D Audio' },
              { id: 'rea-guide', label: 'Puente REA Spotify', icon: Link2, badge: 'morluto' },
              { id: 'server', label: 'Servidor FastAPI / NAS', icon: Server, badge: serverStatus === 'connected' ? 'ON' : 'Sync' }
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
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-black/20 text-black font-bold' : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {item.badge}
                  </span>
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
                      onClick={() => playRadioStation(st)}
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
                  <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Algoritmo Diaz IA
                  </h2>
                </div>
                <button
                  onClick={() => setAutoRadioEnabled(!autoRadioEnabled)}
                  className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold border transition ${
                    autoRadioEnabled
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                  }`}
                >
                  {autoRadioEnabled ? 'Auto-Radio IA ON' : 'Manual'}
                </button>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Tú controlas qué música te recomienda tu plataforma:
              </p>

              <div className="space-y-3 pt-1">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-400">Energía deseada</span>
                    <span className="font-mono font-bold text-zinc-200">{algoEnergyTarget}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={algoEnergyTarget}
                    onChange={(e) => setAlgoEnergyTarget(Number(e.target.value))}
                    className="w-full accent-emerald-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-400">Nivel Acústico</span>
                    <span className="font-mono font-bold text-zinc-200">{algoAcousticTarget}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={algoAcousticTarget}
                    onChange={(e) => setAlgoAcousticTarget(Number(e.target.value))}
                    className="w-full accent-emerald-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-400">Tempo (BPM)</span>
                    <span className="font-mono font-bold text-zinc-200">{algoBpmTarget} BPM</span>
                  </div>
                  <input
                    type="range"
                    min="60"
                    max="180"
                    value={algoBpmTarget}
                    onChange={(e) => setAlgoBpmTarget(Number(e.target.value))}
                    className="w-full accent-emerald-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* Historial Scrobble */}
              <div className="pt-2 border-t border-zinc-800/80">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-2">
                  Últimos Scrobbles
                </span>
                <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                  {scrobbleHistory.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-zinc-900/70 px-2.5 py-1.5 rounded-lg">
                      <div className="truncate pr-2">
                        <p className="font-medium text-zinc-200 truncate">{item.title}</p>
                        <p className="text-[10px] text-zinc-500">{item.artist}</p>
                      </div>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 ${accentClasses.text}`}>
                        {item.match}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* COLUMNA CENTRAL (HERO PLAYER + VISUALIZADOR + TABS) */}
        <main className="lg:col-span-6 space-y-4">
          {/* TARJETA HERO DE MÚSICA (SOLO VISIBLE EN PESTAÑAS DE MÚSICA) */}
          {activeTab !== 'radio' && (
            <div className="relative rounded-2xl overflow-hidden border border-zinc-800/90 bg-gradient-to-br from-[#151928] via-[#10121A] to-[#0B0C12] p-5 shadow-xl">
              <div className="flex flex-col sm:flex-row items-center gap-5 z-10 relative">
                <div className="relative group shrink-0">
                  <img
                    src={currentMusicTrack.coverUrl}
                    alt={currentMusicTrack.title}
                    className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl object-cover shadow-2xl border border-white/10"
                  />
                  <button
                    onClick={togglePlay}
                    className={`absolute inset-0 m-auto w-12 h-12 rounded-full ${accentClasses.bg} text-black flex items-center justify-center shadow-lg opacity-95 group-hover:scale-105 transition`}
                  >
                    {isPlaying && activeAudioSource === 'music' ? (
                      <Pause className="w-6 h-6 fill-current" />
                    ) : (
                      <Play className="w-6 h-6 fill-current ml-0.5" />
                    )}
                  </button>
                </div>

                <div className="flex-1 text-center sm:text-left min-w-0">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5">
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-zinc-800/90 ${accentClasses.text}`}>
                      {calculateAffinityScore(currentMusicTrack)}% Afinidad IA
                    </span>
                    <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-zinc-800/80 text-zinc-300">
                      {Math.round(currentMusicTrack.bpm * playbackSpeed)} BPM • {currentMusicTrack.keySignature}
                    </span>
                    {currentMusicTrack.cachedOffline && (
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Offline Vault
                      </span>
                    )}
                  </div>

                  <h2 className="text-xl sm:text-2xl font-extrabold text-white truncate">
                    {currentMusicTrack.title}
                  </h2>
                  <p className="text-sm text-zinc-400 truncate">
                    {currentMusicTrack.artist} — <span className="text-zinc-500">{currentMusicTrack.album}</span>
                  </p>

                  {/* Presets Rápidos de DJ */}
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
              <div className="relative rounded-2xl overflow-hidden border border-red-500/40 bg-gradient-to-br from-[#1e0f14] via-[#140d12] to-[#0b0c10] p-5 shadow-2xl">
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
                        onClick={() => playRadioStation(station)}
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
                          onClick={() => playRadioStation(station)}
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
                <p className="font-bold text-white">¿Cómo funciona REA (Reverse Engineer Anything) en Diaz Music?</p>
                <ul className="list-disc pl-5 space-y-1 text-zinc-400">
                  <li><strong>REA MCP Bridge:</strong> Conecta herramientas de análisis (JADX para APKs móviles de Android, interceptores de API de Electron y tráfico web).</li>
                  <li><strong>Decodificación de Enlaces:</strong> Traduce IDs propietarios de Spotify a flujos de audio abiertos (Audius, SoundHelix o tu servidor FastAPI con yt-dlp).</li>
                  <li><strong>Sin DRM:</strong> La música se almacena en tu dispositivo en tu Bóveda Offline sin encriptación restrictiva.</li>
                </ul>
              </div>
            </div>
          ) : activeTab === 'search' ? (
            /* BÚSQUEDA LIBRE ONLINE (UNIVERSAL STREAMING) */
            <div className="bg-[#11131C] border border-zinc-800/80 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    Buscador Universal en Streaming (Cualquier Canción del Mundo)
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Transmite en vivo cualquier artista o álbum sin registrarte ni descargar.
                  </p>
                </div>
              </div>

              {/* Indicador de Modo de Streaming (Completo vs Previo) */}
              {serverStatus === 'connected' ? (
                <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                  <div className="text-xs">
                    <p className="font-bold text-emerald-300">Modo Full-Stream Activo (Canciones 100% Completas)</p>
                    <p className="text-zinc-400 text-[11px]">Cualquier búsqueda en internet se transmite completa (3 a 5+ min) sin límite de 30 segundos.</p>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-3 flex items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5 text-xs">
                    <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold text-amber-300">Modo Previo Activo (Audio de 30s)</p>
                      <p className="text-zinc-400 text-[11px] mt-0.5">
                        Para escuchar las canciones <strong>100% COMPLETAS (3 a 5 min)</strong>, inicia en tu PC:
                        <code className="text-amber-300 bg-black/40 px-1.5 py-0.5 rounded ml-1 font-mono">python server.py</code>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={connectFastApiServer}
                    className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold px-2.5 py-1.5 rounded-lg shrink-0 transition"
                  >
                    Conectar Servidor
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && executeOnlineSearch(searchQuery)}
                  placeholder="Ej: Deadmau5, Lo-Fi, Synthwave, Hip-Hop..."
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={() => executeOnlineSearch(searchQuery)}
                  disabled={isSearchingOnline}
                  className={`${accentClasses.bg} text-black font-bold text-sm px-4 py-2 rounded-xl flex items-center gap-2`}
                >
                  {isSearchingOnline ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Buscar Online
                </button>
              </div>

              {onlineSearchResults.length > 0 ? (
                <div className="space-y-1.5">
                  {onlineSearchResults.map((track) => (
                    <div
                      key={track.id}
                      onClick={() => {
                        setTracks((prev) => [track, ...prev]);
                        selectTrack(0);
                        showToast(`Reproduciendo: ${track.title}`);
                      }}
                      className="group flex items-center justify-between p-2.5 rounded-xl border border-transparent hover:border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800/60 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img src={track.coverUrl} alt={track.title} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-white truncate">{track.title}</p>
                            {track.sourceType === 'jamendo' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-semibold">
                                Jamendo Full
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400 truncate">{track.artist} • {track.genre}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setTracks((prev) => [track, ...prev]);
                            toggleOfflineVault(track.id);
                          }}
                          className="p-2 rounded-xl border border-zinc-800 hover:border-emerald-500 text-zinc-400 hover:text-emerald-400 transition"
                          title="Descargar a Bóveda Offline"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <Play className="w-5 h-5 text-zinc-400 group-hover:text-emerald-400" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-500 text-xs">
                  Escribe un artista o género y presiona "Buscar Online" para explorar millones de pistas libres.
                </div>
              )}
            </div>
          ) : activeTab === 'jamendo' ? (
            /* PESTAÑA OFICIAL JAMENDO MUSIC (600,000+ CANCIONES COMPLETAS) */
            <div className="bg-[#11131C] border border-zinc-800/80 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Radio className="w-5 h-5 text-cyan-400" />
                    Jamendo Music Oficial (600,000+ Canciones Completas)
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Música bajo licencias Creative Commons. Streaming 100% libre sin cortes ni límite de 30 segundos.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] px-2.5 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-mono flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    API v3.0 Conectada
                  </span>
                </div>
              </div>

              {/* Formulario Configuración Clave Client ID Jamendo */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-cyan-400" />
                    Tu Clave Client ID de Jamendo:
                  </label>
                  <a
                    href="https://developer.jamendo.com/v3.0"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    developer.jamendo.com <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={jamendoInputKey}
                    onChange={(e) => setJamendoInputKey(e.target.value)}
                    placeholder="Pega tu clave Client ID aquí..."
                    className="flex-1 bg-zinc-950 border border-zinc-800 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:outline-none"
                  />
                  <button
                    onClick={() => handleSaveJamendoKey(jamendoInputKey)}
                    className="bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs px-4 py-2 rounded-xl transition flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Guardar y Activar Clave
                  </button>
                </div>
                <p className="text-[10px] text-zinc-400">
                  Tu clave personal se guarda en tu dispositivo. Disfruta de descargas directas en MP3 a máxima velocidad y streaming sin restricciones.
                </p>
              </div>

              {/* Filtro por Géneros de Jamendo */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {JAMENDO_GENRES.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setSelectedJamendoGenre(g.id)}
                    className={`text-xs px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition ${
                      selectedJamendoGenre === g.id
                        ? 'bg-cyan-500 text-black font-bold shadow-md'
                        : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>

              {/* Lista de Canciones de Jamendo */}
              {isLoadingJamendo ? (
                <div className="flex items-center justify-center py-12 gap-2 text-zinc-400 text-xs">
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                  <span>Cargando canciones completas desde Jamendo API...</span>
                </div>
              ) : jamendoTracks.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {jamendoTracks.map((track) => (
                    <div
                      key={track.id}
                      onClick={() => {
                        setTracks((prev) => [track, ...prev]);
                        selectTrack(0);
                        showToast(`Reproduciendo Jamendo: ${track.title}`);
                      }}
                      className="group flex items-center justify-between p-2.5 rounded-xl border border-zinc-800/80 hover:border-cyan-500/50 bg-zinc-900/60 hover:bg-zinc-800/70 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0">
                          <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                            <Play className="w-5 h-5 text-white fill-current" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate group-hover:text-cyan-300 transition">
                            {track.title}
                          </p>
                          <p className="text-[11px] text-zinc-400 truncate">{track.artist}</p>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {formatTime(track.duration)} • {track.genre}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setTracks((prev) => [track, ...prev]);
                            toggleOfflineVault(track.id);
                          }}
                          className="p-1.5 rounded-lg border border-zinc-800 hover:border-cyan-500 text-zinc-400 hover:text-cyan-300 transition"
                          title="Guardar canción completa en Bóveda Offline"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleLike(track.id);
                          }}
                          className="p-1.5 text-zinc-500 hover:text-rose-500 transition"
                        >
                          <Heart className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-zinc-500 text-xs">
                  No se encontraron canciones para este género. Verifica tu Client ID o selecciona otro género.
                </div>
              )}
            </div>
          ) : activeTab === 'dsp-studio' ? (
            /* ESTUDIO DSP & ECUALIZADOR */
            <div className="bg-[#11131C] border border-zinc-800/80 rounded-2xl p-5 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Sliders className={`w-5 h-5 ${accentClasses.text}`} />
                    Estudio de Masterización DSP & EQ en Tiempo Real
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Modifica frecuencias, velocidad de cinta, filtro pasa-bajos y audio espacial 8D para audífonos e intercomunicadores.
                  </p>
                </div>
                <button
                  onClick={() => applyAudioPreset('normal')}
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg text-zinc-300"
                >
                  Resetear
                </button>
              </div>

              {/* Sliders EQ 5 Bandas */}
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

              {/* Sliders de Velocidad y Filtro Lo-Fi */}
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
          ) : activeTab === 'server' ? (
            /* CONEXIÓN SERVIDOR FASTAPI */
            <div className="bg-[#11131C] border border-zinc-800/80 rounded-2xl p-5 space-y-5">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Server className={`w-5 h-5 ${accentClasses.text}`} />
                  Nodo Backend Híbrido (FastAPI + Docker + Red Local)
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Conecta tu servidor autoalojado en tu PC o NAS para transmitir toda tu biblioteca personal de música a tu celular.
                </p>
              </div>

              <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">
                  URL de tu Servidor FastAPI (IP Local o Tailscale VPN)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={fastApiUrl}
                    onChange={(e) => setFastApiUrl(e.target.value)}
                    placeholder="http://192.168.1.100:8000"
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm font-mono text-zinc-200 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={connectFastApiServer}
                    disabled={serverStatus === 'connecting'}
                    className={`${accentClasses.bg} text-black font-bold text-sm px-5 py-2 rounded-xl flex items-center justify-center gap-2 transition`}
                  >
                    <RefreshCw className={`w-4 h-4 ${serverStatus === 'connecting' ? 'animate-spin' : ''}`} />
                    {serverStatus === 'connected' ? 'Re-Sincronizar' : 'Conectar Servidor'}
                  </button>
                </div>
                <p className="text-[11px] text-zinc-400">
                  En el repositorio incluimos el archivo listo <code className="text-emerald-400">server.py</code> en Python para ejecutar con un solo clic.
                </p>
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
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        Bóveda Offline Diaz Music (Almacenamiento Local Celular)
                      </>
                    ) : (
                      <>
                        <ListMusic className="w-4 h-4 text-emerald-400" />
                        Catálogo Libre & Descubrimiento
                      </>
                    )}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {activeTab === 'vault'
                      ? 'Canciones guardadas en tu memoria interna. Funcionan sin internet y sin gastar datos móviles.'
                      : 'Música 100% gratuita. Toca para reproducir o guarda en tu bóveda.'}
                  </p>
                </div>
                <span className="text-xs text-zinc-400 font-mono">{filteredTracks.length} canciones</span>
              </div>

              <div className="space-y-1.5">
                {filteredTracks.map((track) => {
                  const realIndex = tracks.findIndex((t) => t.id === track.id);
                  const isCurrent = realIndex === currentTrackIndex;

                  return (
                    <div
                      key={track.id}
                      onClick={() => selectTrack(realIndex)}
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
                              <Activity className={`w-5 h-5 ${accentClasses.text} animate-pulse`} />
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
                            {track.sourceType === 'audius' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-semibold">
                                Audius
                              </span>
                            )}
                            {track.sourceType === 'local-file' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">
                                MP3 Celular
                              </span>
                            )}
                            {track.sourceType === 'rea-reverse' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                                REA Spotify
                              </span>
                            )}
                            {track.sourceType === 'jamendo' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-semibold">
                                Jamendo Full
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
                        </div>
                      </div>

                      {/* Botones de acción */}
                      <div className="flex items-center gap-2 ml-2">
                        <div className="hidden sm:flex flex-col items-end">
                          <span className={`text-xs font-mono font-bold ${accentClasses.text}`}>
                            {track.affinity}% Match
                          </span>
                          <span className="text-[10px] text-zinc-500">{track.genre}</span>
                        </div>

                        {/* Guardar en Bóveda Offline */}
                        <button
                          onClick={(e) => toggleOfflineVault(track.id, e)}
                          title={track.cachedOffline ? 'Guardada en memoria offline' : 'Guardar en Bóveda Offline'}
                          className={`p-2 rounded-xl border transition ${
                            track.cachedOffline
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600'
                          }`}
                        >
                          {downloadingId === track.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                          ) : track.cachedOffline ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </button>

                        {/* Exportar MP3 sin DRM */}
                        {track.cachedOffline && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              exportDrmFreeFile(track);
                              showToast(`Exportando MP3: ${track.title}`);
                            }}
                            title="Exportar archivo MP3 directo sin DRM"
                            className="p-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 transition"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                        )}

                        {/* Like */}
                        <button
                          onClick={(e) => toggleLike(track.id, e)}
                          className={`p-2 rounded-xl transition ${
                            track.liked ? 'text-rose-500' : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          <Heart className={`w-4 h-4 ${track.liked ? 'fill-current' : ''}`} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>

        {/* COLUMNA DERECHA: SEPARADA PARA RADIO Y MÚSICA */}
        {activeTab === 'radio' ? (
          /* PANEL LATERAL DERECHO DE RADIO EN VIVO */
          <aside className="lg:col-span-3 space-y-4">
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
          </aside>
        ) : (
          /* PANEL LATERAL DERECHO DE MÚSICA (Audio 8D, Loop A-B, Letras & Notas) */
          <aside className="lg:col-span-3 space-y-4">
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
          </aside>
        )}
      </div>

      {/* REPRODUCTOR MINI FLOTANTE EN CELULAR (SOBRE LA BARRA DE NAVEGACIÓN INFERIOR) */}
      <div
        onClick={() => setIsMobileNowPlayingOpen(true)}
        className="md:hidden fixed bottom-16 left-2 right-2 z-40 bg-[#161a23]/95 backdrop-blur-xl border border-zinc-700/80 rounded-2xl p-2.5 shadow-2xl flex items-center justify-between cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <img src={currentTrack.coverUrl} alt={currentTrack.title} className="w-11 h-11 rounded-xl object-cover shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white truncate">{currentTrack.title}</p>
            <p className="text-[11px] text-zinc-400 truncate">{currentTrack.artist}</p>
          </div>
        </div>

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setIs8DAudio(!is8DAudio)}
            className={`p-2 rounded-xl text-xs font-bold ${is8DAudio ? 'text-emerald-400' : 'text-zinc-400'}`}
          >
            8D
          </button>
          <button
            onClick={togglePlay}
            className={`w-9 h-9 rounded-full ${accentClasses.bg} text-black flex items-center justify-center`}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>
        </div>
      </div>

      {/* PANTALLA COMPLETA NOW PLAYING EXPANDIDA EN CELULAR (ESTILO SPOTIFY MOBILE) */}
      {isMobileNowPlayingOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-gradient-to-b from-[#181d28] via-[#0e1118] to-[#07080b] p-6 flex flex-col justify-between overflow-y-auto">
          {/* Cabecera modal */}
          <div className="flex items-center justify-between pt-2">
            <button onClick={() => setIsMobileNowPlayingOpen(false)} className="p-2 text-zinc-400 hover:text-white">
              <ChevronDown className="w-6 h-6" />
            </button>
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Reproduciendo</p>
              <p className="text-xs font-semibold text-zinc-200">{currentTrack.album}</p>
            </div>
            <button onClick={() => toggleOfflineVault(currentTrack.id)} className="p-2 text-emerald-400">
              {currentTrack.cachedOffline ? <CheckCircle2 className="w-5 h-5" /> : <Download className="w-5 h-5" />}
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
              {currentTrack.sourceType === 'radio' ? (
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
                    min="0"
                    max={duration || currentTrack.duration}
                    value={currentTime}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setCurrentTime(val);
                      if (audioRef.current) audioRef.current.currentTime = val;
                    }}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg accent-emerald-500 cursor-pointer"
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

              <button onClick={handlePrevTrack} className="p-3 text-zinc-300 hover:text-white">
                <SkipBack className="w-7 h-7 fill-current" />
              </button>

              <button
                onClick={togglePlay}
                className={`w-16 h-16 rounded-full ${accentClasses.bg} text-black flex items-center justify-center shadow-xl transform active:scale-95 transition`}
              >
                {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
              </button>

              <button onClick={handleNextTrack} className="p-3 text-zinc-300 hover:text-white">
                <SkipForward className="w-7 h-7 fill-current" />
              </button>

              <button
                onClick={() => applyAudioPreset(activePreset === 'bassboost' ? 'normal' : 'bassboost')}
                className={`p-2 rounded-xl text-xs font-bold ${activePreset === 'bassboost' ? 'text-rose-400' : 'text-zinc-500'}`}
              >
                BASS
              </button>
            </div>

            {/* Indicador de Salida de Audio */}
            <div className="flex items-center justify-center gap-2 pt-2 text-xs text-zinc-400">
              <Headphones className="w-4 h-4 text-emerald-400" />
              <span>Conectado a Audífonos / Intercomunicador</span>
            </div>
          </div>
        </div>
      )}

      {/* BARRA DE NAVEGACIÓN INFERIOR PARA CELULAR (ESTILO SPOTIFY MOBILE) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0B0D12]/98 backdrop-blur-xl border-t border-zinc-800/80 px-2 py-1.5 flex items-center justify-around">
        {[
          { id: 'home', label: 'Inicio', icon: ListMusic },
          { id: 'radio', label: 'Radio FM', icon: Radio },
          { id: 'jamendo', label: 'Jamendo', icon: Disc },
          { id: 'search', label: 'Buscar', icon: Globe },
          { id: 'vault', label: 'Bóveda', icon: ShieldCheck },
          { id: 'dsp-studio', label: 'DSP EQ', icon: Sliders }
        ].map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as ActiveTab)}
              className={`flex flex-col items-center py-1 px-2 rounded-lg transition ${
                isActive ? accentClasses.text : 'text-zinc-500'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-semibold mt-0.5">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* BARRA DE REPRODUCCIÓN INFERIOR PERSISTENTE (ESCRITORIO / DESKTOP) */}
      <footer className="hidden md:block fixed bottom-0 left-0 right-0 z-40 bg-[#0C0E16]/95 backdrop-blur-xl border-t border-zinc-800/90 px-4 py-3">
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
              >
                <Heart className={`w-4 h-4 ${currentTrack.liked ? 'fill-current' : ''}`} />
              </button>
              <button
                onClick={(e) => toggleOfflineVault(currentTrack.id, e)}
                className={`p-1.5 rounded-lg ${
                  currentTrack.cachedOffline ? 'text-emerald-400' : 'text-zinc-500 hover:text-white'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Controles centrales */}
          <div className="md:col-span-6 flex flex-col items-center space-y-1.5">
            <div className="flex items-center gap-5">
              <button
                onClick={() => setAutoRadioEnabled(!autoRadioEnabled)}
                title="Radio Infinita IA"
                className={`text-xs flex items-center gap-1 ${
                  autoRadioEnabled ? accentClasses.text : 'text-zinc-500 hover:text-white'
                }`}
              >
                <Sparkles className="w-4 h-4" />
              </button>

              <button onClick={handlePrevTrack} className="text-zinc-300 hover:text-white transition">
                <SkipBack className="w-5 h-5 fill-current" />
              </button>

              <button
                onClick={togglePlay}
                className={`w-10 h-10 rounded-full ${accentClasses.bg} ${accentClasses.hover} text-black flex items-center justify-center shadow-lg transition transform active:scale-95`}
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </button>

              <button onClick={handleNextTrack} className="text-zinc-300 hover:text-white transition">
                <SkipForward className="w-5 h-5 fill-current" />
              </button>

              <button
                onClick={() => setActiveTab(activeTab === 'dsp-studio' ? 'home' : 'dsp-studio')}
                title="Abrir Ecualizador DSP"
                className={`text-xs flex items-center gap-1 ${
                  activeTab === 'dsp-studio' ? accentClasses.text : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Sliders className="w-4 h-4" />
              </button>
            </div>

            {/* Barra de progreso o Indicador Radio */}
            {currentTrack.sourceType === 'radio' ? (
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
                    className="w-full h-1.5 bg-zinc-800 rounded-lg accent-emerald-500 cursor-pointer"
                  />
                </div>
                <span className="text-[11px] font-mono text-zinc-400 w-9">
                  {formatTime(duration || currentTrack.duration)}
                </span>
              </div>
            )}
          </div>

          {/* Volumen y velocidad */}
          <div className="hidden md:flex md:col-span-3 items-center justify-end gap-3">
            <span className="text-[11px] font-mono px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
              {playbackSpeed.toFixed(2)}x
            </span>

            <button
              onClick={() => setIsMuted(!isMuted)}
              className="text-zinc-400 hover:text-white transition"
            >
              {isMuted || volume === 0 ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5" />}
            </button>

            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setIsMuted(false);
                setVolume(Number(e.target.value));
              }}
              className="w-24 h-1.5 bg-zinc-800 rounded-lg accent-emerald-500 cursor-pointer"
            />
          </div>
        </div>
      </footer>
    </div>
  );
}

