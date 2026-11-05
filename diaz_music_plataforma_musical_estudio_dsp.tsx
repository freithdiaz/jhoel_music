import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Repeat, Shuffle,
  Heart, Download, CheckCircle2, Sliders, Radio, Disc, Music, Upload,
  Server, Sparkles, Activity, Layers, Clock, FileAudio, Search, Plus,
  Trash2, RefreshCw, ChevronRight, Headphones, Zap, Eye, Mic2, Share2,
  Bookmark, AlertCircle, Settings, Flame, Compass, ShieldCheck, Lock,
  Unlock, BarChart3, ListMusic, Minimize2, Maximize2
} from 'lucide-react';

// ==========================================
// CATÁLOGO INICIAL + SINTETIZADOR PROCEDURAL DE RESPALDO
// ==========================================
const INITIAL_TRACKS = [
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
    sourceType: 'streaming', // 'streaming' | 'local-file' | 'fastapi'
    cachedOffline: true,
    liked: true,
    lyrics: [
      { time: 0, text: "♪ [Intro Sintetizador Analógico Arpegiado] ♪" },
      { time: 12, text: "Cruising through the rain on the peripheral highway" },
      { time: 24, text: "Las luces de neón reflejan el código en el cristal" },
      { time: 38, text: "Sin anuncios, sin bloqueos, mi propio servidor local" },
      { time: 55, text: "Subiendo la frecuencia en el filtro pasa-bajos" },
      { time: 75, text: "♪ [Solo de Bajo FM & Batería 808] ♪" },
      { time: 110, text: "En la red privada nadie apaga nuestra señal" },
      { time: 140, text: "♪ [Outro Espacial con Reverb Infinito] ♪" }
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
    sourceType: 'streaming',
    cachedOffline: false,
    liked: true,
    lyrics: [
      { time: 0, text: "♪ [Sonido de lluvia suave y vinilo crujiendo] ♪" },
      { time: 15, text: "Tarde gris en la montaña, compilando sin parar" },
      { time: 32, text: "Acordes de Rhodes flotando en la habitación" },
      { time: 60, text: "Respira hondo, baja las revoluciones a 432Hz" },
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
    sourceType: 'streaming',
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
    sourceType: 'streaming',
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
    sourceType: 'streaming',
    cachedOffline: false,
    liked: true,
    lyrics: [
      { time: 0, text: "♪ [Cowbell Distorsionado + 808 Saturado] ♪" },
      { time: 14, text: "Activando el preset Bass Boost en la curva" },
      { time: 36, text: "Turbocargador a 9000 RPM en la autopista nocturna" },
      { time: 70, text: "♪ [Cambio de Ritmo Half-Time Slowed] ♪" }
    ]
  },
  {
    id: 'track-6',
    title: ' Velvet Astral Lounge',
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
    sourceType: 'streaming',
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
  const [tracks, setTracks] = useState(INITIAL_TRACKS);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(172);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'ai-radio' | 'vault' | 'dsp-studio' | 'server'
  const [visualizerMode, setVisualizerMode] = useState('bars'); // 'bars' | 'wave' | 'circle'
  const [themeAccent, setThemeAccent] = useState('emerald'); // 'emerald' | 'cyberpunk' | 'violet'

  // ==========================================
  // UPGRADES PRO (NO DISPONIBLES EN SPOTIFY ESTÁNDAR)
  // ==========================================
  // 1. Controles DSP y Efectos en Tiempo Real
  const [eqGains, setEqGains] = useState([2, 1, 0, 1, 3]); // dB por banda (-12 a +12)
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0); // 0.5x a 1.5x (Slowed / Nightcore)
  const [lowpassFreq, setLowpassFreq] = useState(20000); // Filtro Lo-Fi (200Hz a 20000Hz)
  const [stereoPan, setStereoPan] = useState(0); // -1 a 1
  const [is8DAudio, setIs8DAudio] = useState(false); // Paneo espacial automático
  const [activePreset, setActivePreset] = useState('normal'); // 'normal' | 'slowed' | 'nightcore' | 'lofi' | 'bassboost'
  const [useSynthFallback, setUseSynthFallback] = useState(false); // Generador WebAudio en vivo si no hay red

  // 2. Loop A-B para repetir solos o secciones
  const [loopA, setLoopA] = useState(null);
  const [loopB, setLoopB] = useState(null);

  // 3. Algoritmo Abierto y Transparente ("Tune My Algorithm")
  const [algoEnergyTarget, setAlgoEnergyTarget] = useState(75);
  const [algoAcousticTarget, setAlgoAcousticTarget] = useState(30);
  const [algoBpmTarget, setAlgoBpmTarget] = useState(120);
  const [autoRadioEnabled, setAutoRadioEnabled] = useState(true);
  const [scrobbleHistory, setScrobbleHistory] = useState([
    { title: 'Midnight Cyberpunk Drive', artist: 'The Synthwave Collective', time: 'Hace 5 min', match: 98 },
    { title: 'Tokyo Drift Phonk 99', artist: 'Kaito Shadow', time: 'Hace 12 min', match: 94 }
  ]);

  // 4. Notas personales con marca de tiempo por canción
  const [trackNotes, setTrackNotes] = useState({
    'track-1': [{ time: 75, note: '¡Este drop de bajo suena brutal con el preset Bass Boost!' }]
  });
  const [newNoteText, setNewNoteText] = useState('');

  // 5. Conexión con Servidor FastAPI / Subida de MP3 locales
  const [fastApiUrl, setFastApiUrl] = useState('http://192.168.1.100:8000');
  const [serverStatus, setServerStatus] = useState('disconnected'); // 'disconnected' | 'connecting' | 'connected'
  const [downloadingId, setDownloadingId] = useState(null);
  const [notification, setNotification] = useState(null);

  // ==========================================
  // REFERENCIAS DE AUDIO Y WEB AUDIO API
  // ==========================================
  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const eqNodesRef = useRef([]);
  const lowpassNodeRef = useRef(null);
  const pannerNodeRef = useRef(null);
  const gainNodeRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const canvasRef = useRef(null);
  const synthIntervalRef = useRef(null);

  const currentTrack = tracks[currentTrackIndex] || tracks[0];

  // Mostrar notificación flotante
  const showToast = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // ==========================================
  // INICIALIZACIÓN DEL MOTOR WEB AUDIO API DSP
  // ==========================================
  const initWebAudio = () => {
    if (audioCtxRef.current) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyserRef.current = analyser;

      // Crear filtro Lowpass para efecto Lo-Fi Radio
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = lowpassFreq;
      lowpassNodeRef.current = lowpass;

      // Crear paneo estéreo (para efecto 8D)
      const panner = ctx.createStereoPanner();
      panner.pan.value = stereoPan;
      pannerNodeRef.current = panner;

      // Crear nodo de ganancia maestro
      const masterGain = ctx.createGain();
      masterGain.gain.value = isMuted ? 0 : volume;
      gainNodeRef.current = masterGain;

      // Crear los 5 filtros paramétricos del Ecualizador
      const eqNodes = EQ_BANDS.map((band, idx) => {
        const filter = ctx.createBiquadFilter();
        filter.type = idx === 0 ? 'lowshelf' : idx === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking';
        filter.frequency.value = band.freq;
        filter.Q.value = 1.2;
        filter.gain.value = eqGains[idx];
        return filter;
      });
      eqNodesRef.current = eqNodes;

      // Conectar cadena DSP: Source -> EQ[0..4] -> Lowpass -> Panner -> Gain -> Analyser -> Destination
      if (audioRef.current && !sourceNodeRef.current) {
        const source = ctx.createMediaElementSource(audioRef.current);
        sourceNodeRef.current = source;

        let prevNode = source;
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
      // Si el navegador bloquea CORS en algún stream externo, usamos visualización simulada reactiva
      console.warn('Modo WebAudio directo o fallback activado:', err);
    }
  };

  // Sintetizador Web Audio Procedural en vivo (por si el usuario quiere probar sonido 100% generado en el navegador)
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

      // Oscilador melódico Synthwave
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

  // ==========================================
  // ACTUALIZACIÓN DE PARÁMETROS DSP EN TIEMPO REAL
  // ==========================================
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
      // En modo Slowed o Nightcore desactivamos preservesPitch para lograr el efecto real de vinilo/pitch
      if ('preservesPitch' in audioRef.current) {
        audioRef.current.preservesPitch = activePreset === 'normal';
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

  // Efecto 8D Espacial (paneo circular automático)
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
      const panVal = Math.sin(angle) * 0.85;
      setStereoPan(Number(panVal.toFixed(2)));
      if (pannerNodeRef.current && audioCtxRef.current) {
        pannerNodeRef.current.pan.setTargetAtTime(panVal, audioCtxRef.current.currentTime, 0.05);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [is8DAudio]);

  // ==========================================
  // PRESETS RÁPIDOS DE ESTUDIO (DJ FX RACK)
  // ==========================================
  const applyAudioPreset = (presetName) => {
    setActivePreset(presetName);
    if (presetName === 'normal') {
      setPlaybackSpeed(1.0);
      setLowpassFreq(20000);
      setEqGains([0, 0, 0, 0, 0]);
      setIs8DAudio(false);
      showToast('Modo Estudio Original (Flat EQ 1.0x)');
    } else if (presetName === 'slowed') {
      setPlaybackSpeed(0.84);
      setLowpassFreq(6500);
      setEqGains([6, 4, -1, 2, 4]);
      showToast('Efecto Slowed + Reverb Activado (0.84x + Sub-Bass)');
    } else if (presetName === 'nightcore') {
      setPlaybackSpeed(1.25);
      setLowpassFreq(20000);
      setEqGains([2, 0, 2, 4, 5]);
      showToast('Efecto Nightcore Activado (1.25x High Pitch)');
    } else if (presetName === 'lofi') {
      setPlaybackSpeed(0.95);
      setLowpassFreq(1800);
      setEqGains([-2, 3, 2, -4, -8]);
      showToast('Filtro Vinilo Lo-Fi Radio (Pasa-bajos 1.8kHz)');
    } else if (presetName === 'bassboost') {
      setPlaybackSpeed(1.0);
      setLowpassFreq(20000);
      setEqGains([10, 7, 0, 2, 3]);
      showToast('Bass Boost Extremo (+10dB en 60Hz)');
    }
  };

  // ==========================================
  // VISUALIZADOR DE ESPECTRO EN CANVAS (60 FPS)
  // ==========================================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
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

      // Si el stream externo tiene restricción CORS o estamos en modo sintetizador, generamos onda reactiva sincronizada con el BPM y EQ
      const hasRealSignal = dataArray.some((v) => v > 0);
      if (!hasRealSignal && isPlaying) {
        phase += 0.12 * playbackSpeed;
        for (let i = 0; i < bufferLength; i++) {
          const bassBoostFactor = i < 8 ? (eqGains[0] + 12) / 12 : 1;
          const lofiFactor = i > 25 && lowpassFreq < 4000 ? 0.2 : 1;
          const wave = Math.sin(phase + i * 0.35) * 0.5 + 0.5;
          const pulse = Math.abs(Math.sin(phase * (currentTrack.bpm / 60))) * 65;
          dataArray[i] = Math.min(255, Math.floor((wave * 110 + pulse) * bassBoostFactor * lofiFactor));
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
          ctx.roundRect(x, y, barWidth, barHeight, 3);
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
  // CONTROL DE REPRODUCCIÓN Y LOOP A-B
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
      audioRef.current.play().catch(() => {
        // Si falla la carga externa, activamos automáticamente el sintetizador procedural para garantizar sonido
        setUseSynthFallback(true);
        setIsPlaying(true);
        showToast('Sintetizador WebAudio Procedural Activado');
      });
      setIsPlaying(true);
    }
  };

  const selectTrack = (index) => {
    setCurrentTrackIndex(index);
    setCurrentTime(0);
    setLoopA(null);
    setLoopB(null);
    setIsPlaying(true);

    const selected = tracks[index];
    // Registrar Scrobble para entrenar el algoritmo
    setScrobbleHistory((prev) => [
      {
        title: selected.title,
        artist: selected.artist,
        time: 'Ahora mismo',
        match: calculateAffinityScore(selected)
      },
      ...prev.slice(0, 7)
    ]);

    setTimeout(() => {
      if (audioRef.current && !useSynthFallback) {
        audioRef.current.play().catch(() => {
          setUseSynthFallback(true);
        });
      }
    }, 60);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const now = audioRef.current.currentTime;
    setCurrentTime(now);

    // Verificar Loop A-B
    if (loopA !== null && loopB !== null && now >= loopB) {
      audioRef.current.currentTime = loopA;
      showToast(`Loop A-B activo (${formatTime(loopA)} → ${formatTime(loopB)})`);
    }
  };

  // Avance de tiempo cuando se usa el sintetizador procedural
  useEffect(() => {
    if (!useSynthFallback || !isPlaying) return;
    const timer = setInterval(() => {
      setCurrentTime((prev) => {
        if (loopA !== null && loopB !== null && prev >= loopB) {
          return loopA;
        }
        if (prev + 1 >= currentTrack.duration) {
          handleNextTrack();
          return 0;
        }
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [useSynthFallback, isPlaying, loopA, loopB, currentTrack]);

  // Algoritmo de Afinidad Musical en Tiempo Real (0 - 100%)
  const calculateAffinityScore = (track) => {
    const energyDiff = Math.abs(track.energy - algoEnergyTarget);
    const acousticDiff = Math.abs(track.acousticness - algoAcousticTarget);
    const bpmDiff = Math.min(50, Math.abs(track.bpm - algoBpmTarget));

    const rawScore = 100 - (energyDiff * 0.35 + acousticDiff * 0.25 + bpmDiff * 0.4);
    return Math.max(45, Math.min(99, Math.round(rawScore)));
  };

  // Radio Infinita Inteligente: Elige la siguiente canción con mayor afinidad
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
  // BÓVEDA OFFLINE (CACHÉ PERSISTENTE SIN DRM)
  // ==========================================
  const toggleOfflineVault = (trackId, e) => {
    if (e) e.stopPropagation();
    const target = tracks.find((t) => t.id === trackId);
    if (!target) return;

    if (target.cachedOffline) {
      setTracks((prev) =>
        prev.map((t) => (t.id === trackId ? { ...t, cachedOffline: false } : t))
      );
      showToast(`Eliminado de la Bóveda Offline: ${target.title}`);
    } else {
      setDownloadingId(trackId);
      setTimeout(() => {
        setTracks((prev) =>
          prev.map((t) => (t.id === trackId ? { ...t, cachedOffline: true } : t))
        );
        setDownloadingId(null);
        showToast(`Guardado en Bóveda Offline sin DRM: ${target.title}`);
      }, 900);
    }
  };

  const toggleLike = (trackId, e) => {
    if (e) e.stopPropagation();
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, liked: !t.liked } : t))
    );
  };

  // ==========================================
  // CARGA DE ARCHIVOS MP3/FLAC LOCALES DEL USUARIO
  // ==========================================
  const handleLocalFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newLocalTracks = files.map((file, i) => {
      const objectUrl = URL.createObjectURL(file);
      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      const parts = cleanName.split(' - ');
      const artist = parts.length > 1 ? parts[0].trim() : 'Diaz Music Local';
      const title = parts.length > 1 ? parts[1].trim() : cleanName;

      return {
        id: `local-${Date.now()}-${i}`,
        title,
        artist,
        album: 'Diaz Music • Sin DRM',
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
          { time: 0, text: `♪ Reproduciendo archivo local: ${file.name} ♪` },
          { time: 10, text: "Procesando audio directo con el motor DSP de 5 bandas" },
          { time: 30, text: "100% libre de DRM • Almacenado en tu dispositivo" }
        ]
      };
    });

    setTracks((prev) => [...newLocalTracks, ...prev]);
    setUseSynthFallback(false);
    selectTrack(0);
    showToast(`${newLocalTracks.length} archivo(s) local(es) listos para sonar`);
  };

  // Simulación o Conexión Real al Backend FastAPI (Docker/Tailscale)
  const connectFastApiServer = async () => {
    setServerStatus('connecting');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2200);
      const res = await fetch(`${fastApiUrl}/tracks`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const imported = data.map((item, idx) => ({
            id: `fastapi-${item.id || idx}`,
            title: item.title || item.filename,
            artist: item.artist || 'Servidor FastAPI',
            album: 'Docker Local Stream',
            duration: 195,
            bpm: 122,
            keySignature: 'A Minor',
            energy: 82,
            acousticness: 25,
            danceability: 85,
            genre: 'Self-Hosted',
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
      // Si el usuario aún no tiene encendido el contenedor local, simulamos la sincronización de prueba
      const demoServerTrack = {
        id: `fastapi-demo-${Date.now()}`,
        title: 'Tailscale Node Session #01 (FLAC Stream)',
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
      showToast('Nodo FastAPI vinculado a Diaz Music (Pista de demostración agregada)');
    }
  };

  // Exportar archivo directo sin DRM desde la Bóveda Offline
  const exportDrmFreeFile = (track, e) => {
    if (e) e.stopPropagation();
    const link = document.createElement('a');
    link.href = track.audioUrl;
    link.target = '_blank';
    link.download = `${track.artist} - ${track.title}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exportando MP3 libre de DRM: ${track.title}`);
  };

  // Agregar nota personal en el segundo exacto de la canción
  const addTimestampNote = (e) => {
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

  const formatTime = (sec) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Filtrado de pistas según pestaña y búsqueda
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
        onLoadedMetadata={(e) => setDuration(e.target.duration || currentTrack.duration)}
        onEnded={handleNextTrack}
      />

      {/* TOAST DE NOTIFICACIÓN */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 bg-zinc-900/95 border border-zinc-700 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 animate-bounce">
          <Sparkles className={`w-4 h-4 ${accentClasses.text}`} />
          <span className="text-sm font-medium">{notification}</span>
        </div>
      )}

      {/* BARRA SUPERIOR */}
      <header className="h-16 border-b border-zinc-800/80 bg-[#0b0d10]/90 backdrop-blur-xl px-4 lg:px-6 flex items-center justify-between sticky top-0 z-30">
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
                Studio Edition
              </span>
            </div>
            <p className="text-xs text-zinc-400 hidden sm:block">
              Streaming Privado Sin DRM • Estudio DSP • Algoritmo Diaz IA
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
              placeholder="Buscar en Diaz Music por canción, artista o BPM..."
              className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-emerald-500/60 rounded-full pl-10 pr-4 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none transition"
            />
          </div>
        </div>

        {/* BOTONES DE ESTADO RÁPIDO Y TEMAS */}
        <div className="flex items-center gap-2.5">
          {/* Selector de Tema */}
          <div className="hidden md:flex items-center bg-zinc-900 border border-zinc-800 rounded-full p-1 gap-1">
            {['emerald', 'cyberpunk', 'violet'].map((t) => (
              <button
                key={t}
                onClick={() => setThemeAccent(t)}
                title={`Tema ${t}`}
                className={`w-5 h-5 rounded-full transition transform ${
                  themeAccent === t ? 'scale-110 ring-2 ring-white' : 'opacity-50 hover:opacity-90'
                } ${t === 'emerald' ? 'bg-emerald-500' : t === 'cyberpunk' ? 'bg-rose-500' : 'bg-violet-500'}`}
              />
            ))}
          </div>

          <label className="cursor-pointer bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium px-3 py-2 rounded-xl flex items-center gap-2 transition">
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Subir MP3 / FLAC Local</span>
            <input type="file" accept="audio/*" multiple onChange={handleLocalFileUpload} className="hidden" />
          </label>

          <button
            onClick={() => setActiveTab('server')}
            className={`text-xs font-medium px-3 py-2 rounded-xl border flex items-center gap-1.5 transition ${
              serverStatus === 'connected'
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span className="hidden md:inline">
              {serverStatus === 'connected' ? 'FastAPI Activo' : 'Conectar Servidor'}
            </span>
          </button>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL (3 COLUMNAS EN DESKTOP) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 lg:p-6 pb-36 max-w-[1600px] w-full mx-auto">
        
        {/* COLUMNA IZQUIERDA: NAVEGACIÓN + UPGRADES */}
        <aside className="lg:col-span-3 space-y-4">
          {/* Menú Principal */}
          <div className="bg-[#11131C] border border-zinc-800/80 rounded-2xl p-3 space-y-1">
            {[
              { id: 'home', label: 'Catálogo Diaz Music', icon: ListMusic, badge: tracks.length },
              { id: 'ai-radio', label: 'Algoritmo Diaz IA', icon: Sparkles, badge: 'Abierto' },
              { id: 'vault', label: 'Bóveda Offline (Sin DRM)', icon: ShieldCheck, badge: tracks.filter((t) => t.cachedOffline).length },
              { id: 'dsp-studio', label: 'Estudio DSP & 5-Band EQ', icon: Sliders, badge: 'Pro' },
              { id: 'server', label: 'Servidor FastAPI / Docker', icon: Server, badge: serverStatus === 'connected' ? 'ON' : 'Sync' }
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
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

          {/* PANEL DE AFINACIÓN DEL ALGORITMO (TRANSPARENTE) */}
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
              En <strong>Diaz Music</strong> tú controlas los pesos matemáticos de tu recomendador en tiempo real:
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
                  <span className="text-zinc-400">Nivel Acústico / Orgánico</span>
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
                  <span className="text-zinc-400">Tempo Objetivo (BPM)</span>
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
                Últimos Scrobbles (SQLite Log)
              </span>
              <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
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
        </aside>

        {/* COLUMNA CENTRAL: VISUALIZADOR + LISTA O PESTAÑA ACTIVA */}
        <main className="lg:col-span-6 space-y-4">
          {/* TARJETA DE REPRODUCCIÓN ACTUAL + ESPECTRO DE AUDIO */}
          <div className="relative rounded-2xl overflow-hidden border border-zinc-800/90 bg-gradient-to-br from-[#151928] via-[#10121A] to-[#0B0C12] p-5 shadow-xl">
            <div className="flex flex-col sm:flex-row items-center gap-5 z-10 relative">
              <div className="relative group shrink-0">
                <img
                  src={currentTrack.coverUrl}
                  alt={currentTrack.title}
                  className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl object-cover shadow-2xl border border-white/10"
                />
                <button
                  onClick={togglePlay}
                  className={`absolute inset-0 m-auto w-12 h-12 rounded-full ${accentClasses.bg} text-black flex items-center justify-center shadow-lg opacity-95 group-hover:scale-105 transition`}
                >
                  {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
                </button>
              </div>

              <div className="flex-1 text-center sm:text-left min-w-0">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5">
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-zinc-800/90 ${accentClasses.text}`}>
                    {calculateAffinityScore(currentTrack)}% Afinidad IA
                  </span>
                  <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-zinc-800/80 text-zinc-300">
                    {Math.round(currentTrack.bpm * playbackSpeed)} BPM • {currentTrack.keySignature}
                  </span>
                  {currentTrack.cachedOffline && (
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Offline Vault
                    </span>
                  )}
                </div>

                <h2 className="text-xl sm:text-2xl font-extrabold text-white truncate">
                  {currentTrack.title}
                </h2>
                <p className="text-sm text-zinc-400 truncate">
                  {currentTrack.artist} — <span className="text-zinc-500">{currentTrack.album}</span>
                </p>

                {/* Presets rápidos de DJ en la cabecera */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 mt-3">
                  {[
                    { id: 'normal', label: 'Normal (1.0x)' },
                    { id: 'slowed', label: 'Slowed + Reverb' },
                    { id: 'nightcore', label: 'Nightcore (1.25x)' },
                    { id: 'lofi', label: 'Lo-Fi Vinyl (1.8kHz)' },
                    { id: 'bassboost', label: 'Mega Bass (+10dB)' }
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => applyAudioPreset(preset.id)}
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

            {/* CANVAS DEL VISUALIZADOR EN TIEMPO REAL */}
            <div className="mt-4 pt-3 border-t border-zinc-800/80">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Activity className={`w-3.5 h-3.5 ${accentClasses.text}`} />
                  <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                    Analizador de Espectro FFT • {activePreset.toUpperCase()} • {playbackSpeed.toFixed(2)}x
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
                    title="Alternar entre pista MP3 y Sintetizador WebAudio en vivo"
                  >
                    {useSynthFallback ? 'Sintetizador Live ON' : ' Audio MP3'}
                  </button>
                  {['bars', 'wave', 'circle'].map((mode) => (
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

          {/* VISTA DINÁMICA SEGÚN LA PESTAÑA SELECCIONADA */}
          {activeTab === 'server' ? (
            /* PESTAÑA DE CONEXIÓN FASTAPI Y SUBIDA DE MP3 */
            <div className="bg-[#11131C] border border-zinc-800/80 rounded-2xl p-5 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Server className={`w-5 h-5 ${accentClasses.text}`} />
                    Nodo Backend Híbrido (FastAPI + Docker + Archivos Locales)
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Conecta tu servidor autoalojado por IP local o Tailscale, o arrastra tus propios archivos `.mp3` / `.flac` sin DRM.
                  </p>
                </div>
              </div>

              {/* Zona de arrastrar y soltar archivos locales */}
              <label className="border-2 border-dashed border-zinc-700 hover:border-emerald-500/60 bg-zinc-900/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition group">
                <div className={`w-12 h-12 rounded-2xl bg-zinc-800 group-hover:scale-110 transition flex items-center justify-center mb-3`}>
                  <FileAudio className={`w-6 h-6 ${accentClasses.text}`} />
                </div>
                <p className="text-sm font-semibold text-zinc-200">
                  Haz clic aquí para seleccionar archivos MP3, FLAC, WAV u OGG de tu equipo
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  Se reproducen de inmediato en el navegador con el ecualizador de 5 bandas y efectos Slowed/Nightcore
                </p>
                <input type="file" accept="audio/*" multiple onChange={handleLocalFileUpload} className="hidden" />
              </label>

              {/* Configuración de endpoint FastAPI */}
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">
                  URL de tu Servidor FastAPI (Red Local o Tailscale VPN)
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
                    className={`${accentClasses.bg} ${accentClasses.hover} text-black font-bold text-sm px-5 py-2 rounded-xl flex items-center justify-center gap-2 transition`}
                  >
                    <RefreshCw className={`w-4 h-4 ${serverStatus === 'connecting' ? 'animate-spin' : ''}`} />
                    {serverStatus === 'connected' ? 'Re-Sincronizar' : 'Conectar Servidor'}
                  </button>
                </div>
                <p className="text-[11px] text-zinc-400">
                  El cliente buscará los endpoints <code className="text-emerald-400">GET /tracks</code> y{' '}
                  <code className="text-emerald-400">GET /stream/&#123;filename&#125;</code> que configuramos en tu contenedor Docker.
                </p>
              </div>
            </div>
          ) : activeTab === 'dsp-studio' ? (
            /* PESTAÑA DEDICADA AL ECUALIZADOR PARAMÉTRICO Y LOOP A-B */
            <div className="bg-[#11131C] border border-zinc-800/80 rounded-2xl p-5 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Sliders className={`w-5 h-5 ${accentClasses.text}`} />
                    Estudio de Masterización & DSP en Tiempo Real
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Modifica las frecuencias, la velocidad de cinta, el filtro pasa-bajos y el audio 8D espacial.
                  </p>
                </div>
                <button
                  onClick={() => applyAudioPreset('normal')}
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg text-zinc-300"
                >
                  Resetear DSP
                </button>
              </div>

              {/* Sliders del Ecualizador de 5 Bandas */}
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

              {/* Controles de Pitch/Speed, Filtro Lo-Fi y 8D */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-300 font-semibold">Velocidad & Pitch (Cinta Analógica)</span>
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
                    <span>0.65x (Vaporwave)</span>
                    <span>1.0x</span>
                    <span>1.35x (Nightcore)</span>
                  </div>
                </div>

                <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-300 font-semibold">Filtro Pasa-Bajos (Efecto Lo-Fi)</span>
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
                    <span>400Hz (Bajo el agua)</span>
                    <span>2.5kHz (Radio AM)</span>
                    <span>20kHz (Hi-Fi)</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* LISTA DE CANCIONES (BIBLIOTECA / RADIO IA / BÓVEDA OFFLINE) */
            <div className="bg-[#11131C] border border-zinc-800/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    {activeTab === 'vault' && <ShieldCheck className="w-4 h-4 text-emerald-400" />}
                    {activeTab === 'ai-radio' && <Sparkles className="w-4 h-4 text-emerald-400" />}
                    {activeTab === 'home' && 'Catálogo Diaz Music & Pistas Locales'}
                    {activeTab === 'ai-radio' && 'Cola Inteligente Ordenada por el Algoritmo Diaz IA'}
                    {activeTab === 'vault' && 'Bóveda Offline Diaz Music (Sin DRM • Cero Datos)'}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {activeTab === 'vault'
                      ? 'Tus canciones descargadas nunca caducan y puedes exportarlas directamente en MP3 libre de DRM.'
                      : 'Haz clic en cualquier pista para reproducir o guárdala en tu Bóveda Offline con un toque.'}
                  </p>
                </div>
                <span className="text-xs text-zinc-400 font-mono">{filteredTracks.length} pistas</span>
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
                            {track.sourceType === 'local-file' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">
                                MP3 Local
                              </span>
                            )}
                            {track.sourceType === 'fastapi' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-semibold">
                                FastAPI
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

                      {/* Badges de Afinidad IA y Acciones Offline */}
                      <div className="flex items-center gap-2 sm:gap-2.5 ml-2">
                        <div className="hidden sm:flex flex-col items-end">
                          <span className={`text-xs font-mono font-bold ${accentClasses.text}`}>
                            {track.affinity}% Match
                          </span>
                          <span className="text-[10px] text-zinc-500">{track.genre}</span>
                        </div>

                        {/* Botón de Descarga a Bóveda Offline */}
                        <button
                          onClick={(e) => toggleOfflineVault(track.id, e)}
                          title={track.cachedOffline ? 'Guardada en Bóveda Offline' : 'Guardar en Bóveda Offline'}
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

                        {/* Exportar MP3 directo sin DRM cuando está en la bóveda */}
                        {track.cachedOffline && (
                          <button
                            onClick={(e) => exportDrmFreeFile(track, e)}
                            title="Exportar archivo MP3 directo sin DRM"
                            className="p-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 transition"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                        )}

                        {/* Botón Favorito */}
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

        {/* COLUMNA DERECHA: RACK DE STUDIO, LOOP A-B & LETRAS/NOTAS SINCRONIZADAS */}
        <aside className="lg:col-span-3 space-y-4">
          {/* RACK DE LOOP A-B & AUDIO ESPACIAL 8D */}
          <div className="bg-[#11131C] border border-zinc-800/80 rounded-2xl p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className={`w-4 h-4 ${accentClasses.text}`} />
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                  Herramientas Pro Exclusivas
                </h2>
              </div>
              <span className="text-[10px] font-mono text-zinc-400">DSP Activo</span>
            </div>

            {/* Audio Espacial 8D */}
            <div className="flex items-center justify-between bg-zinc-900/90 border border-zinc-800 p-3 rounded-xl">
              <div className="flex items-center gap-2.5">
                <Headphones className={`w-5 h-5 ${is8DAudio ? accentClasses.text : 'text-zinc-400'}`} />
                <div>
                  <p className="text-xs font-bold text-zinc-200">Audio 8D Espacial</p>
                  <p className="text-[10px] text-zinc-400">
                    Paneo circular ({stereoPan > 0 ? `R +${stereoPan}` : `L ${stereoPan}`})
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

            {/* Repetidor de Secciones Loop A-B */}
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
                    Limpiar Loop
                  </button>
                )}
              </div>
              <p className="text-[11px] text-zinc-400">
                Marca el inicio y fin de tu solo favorito para repetirlo infinitamente:
              </p>
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
                      showToast('Primero marca el Punto A y deja avanzar la canción');
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

          {/* LETRAS INTERACTIVAS & NOTAS PERSONALES EN LA CANCIÓN */}
          <div className="bg-[#11131C] border border-zinc-800/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic2 className={`w-4 h-4 ${accentClasses.text}`} />
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                  Letras & Notas por Segundo
                </h2>
              </div>
              <span className="text-[10px] text-zinc-500">Clic para saltar</span>
            </div>

            {/* Letras sincronizadas */}
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {(currentTrack.lyrics || []).map((line, idx) => {
                const nextLine = currentTrack.lyrics[idx + 1];
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

            {/* Notas del usuario con marca de tiempo */}
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

              {(trackNotes[currentTrack.id] || []).map((n, i) => (
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
      </div>

      {/* BARRA DE REPRODUCCIÓN INFERIOR PERSISTENTE (ESTILO SPOTIFY PRO) */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-[#0C0E16]/95 backdrop-blur-xl border-t border-zinc-800/90 px-4 py-3">
        <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-12 items-center gap-3">
          
          {/* Info de la canción actual */}
          <div className="md:col-span-3 flex items-center justify-between md:justify-start gap-3 min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                className="w-12 h-12 rounded-xl object-cover border border-zinc-700 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{currentTrack.title}</p>
                <p className="text-xs text-zinc-400 truncate">{currentTrack.artist}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
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

          {/* Controles centrales + Barra de progreso interactiva */}
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

            {/* Barra de tiempo con indicadores de Loop A-B */}
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
          </div>

          {/* Controles de Volumen y Velocidad rápidos */}
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