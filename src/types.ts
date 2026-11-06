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
  sourceType: 'curated' | 'audius' | 'invidious' | 'local-file' | 'fastapi' | 'rea-reverse' | 'jamendo' | 'itunes' | 'radio';
  cachedOffline: boolean;
  liked: boolean;
  lyrics: LyricLine[];
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  createdAt: number;
  tracks: Track[];
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: number;
}

export interface UserData {
  playlists: Playlist[];
  favorites50List: Track[];
  userTasteProfile: {
    favoriteArtists: Record<string, number>;
    favoriteGenres: Record<string, number>;
  };
}

export type VisualizerMode = 'bars' | 'wave' | 'circle';
export type ThemeAccent = 'emerald' | 'blue' | 'pink' | 'violet' | 'cyberpunk';
export type AudioPreset =
  | 'normal'
  | 'bassboost'
  | 'subbass'
  | 'reggaeton'
  | 'rock'
  | 'pop'
  | 'electronic'
  | 'acoustic'
  | 'slowed'
  | 'nightcore'
  | 'lofi';

export type ActiveTab =
  | 'home'
  | 'search'
  | 'playlists'
  | 'favorites'
  | 'radio'
  | 'dsp-studio'
  | 'vault'
  | 'jamendo'
  | 'server'
  | 'rea-guide'
  | 'ai-radio';
