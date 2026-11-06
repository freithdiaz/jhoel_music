import { Track } from '../types';

export interface PlaybackQueue {
  name: string;
  tracks: Track[];
  index: number;
}

export function createPlaybackQueue(name: string, tracks: Track[], startIndex = 0): PlaybackQueue | null {
  if (!tracks.length) return null;
  const index = Number.isInteger(startIndex) && startIndex >= 0 && startIndex < tracks.length ? startIndex : 0;
  return { name, tracks: [...tracks], index };
}

export function stepPlaybackQueue(queue: PlaybackQueue, direction: 1 | -1): PlaybackQueue | null {
  const index = queue.index + direction;
  if (index < 0 || index >= queue.tracks.length) return null;
  return { ...queue, index };
}
