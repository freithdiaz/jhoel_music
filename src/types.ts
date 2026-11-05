export interface LyricLine {
  time: number;
  text: string;
}

export interface TrackNote {
  time: number;
  note: string;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  bpm: number;
  keySignature: string;
  energy: number;
  acousticness: number;
  danceability: number;
  genre: string;
  coverUrl: string;
  audioUrl: string;
  sourceType: 'curated' | 'audius' | 'invidious' | 'local-file' | 'fastapi' | 'rea-reverse' | 'jamendo' | 'radio';
  cachedOffline: boolean;
  liked: boolean;
  lyrics: LyricLine[];
}

export type VisualizerMode = 'bars' | 'wave' | 'circle';
export type ThemeAccent = 'emerald' | 'cyberpunk' | 'violet';
export type AudioPreset = 'normal' | 'slowed' | 'nightcore' | 'lofi' | 'bassboost';
export type ActiveTab = 'home' | 'radio' | 'search' | 'jamendo' | 'ai-radio' | 'vault' | 'dsp-studio' | 'server' | 'rea-guide';

