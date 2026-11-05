import { Track } from '../types';

const DB_NAME = 'DiazMusicDB';
const DB_VERSION = 1;
const TRACKS_STORE = 'saved_tracks';
const BLOBS_STORE = 'audio_blobs';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TRACKS_STORE)) {
        db.createObjectStore(TRACKS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(BLOBS_STORE)) {
        db.createObjectStore(BLOBS_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveTrackOffline(track: Track): Promise<Track> {
  const db = await openDB();

  // Descargar el archivo de audio como Blob
  let audioBlob: Blob;
  try {
    const res = await fetch(track.audioUrl, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    audioBlob = await res.blob();
  } catch (err) {
    console.warn('Fallo al descargar audio para offline, creando blob referencial:', err);
    throw err;
  }

  // Guardar metadata y blob en IndexedDB
  return new Promise((resolve, reject) => {
    const tx = db.transaction([TRACKS_STORE, BLOBS_STORE], 'readwrite');
    const tracksStore = tx.objectStore(TRACKS_STORE);
    const blobsStore = tx.objectStore(BLOBS_STORE);

    const updatedTrack: Track = {
      ...track,
      cachedOffline: true,
      audioUrl: URL.createObjectURL(audioBlob)
    };

    tracksStore.put({ ...track, cachedOffline: true });
    blobsStore.put({ id: track.id, blob: audioBlob });

    tx.oncomplete = () => resolve(updatedTrack);
    tx.onerror = () => reject(tx.error);
  });
}

export async function removeTrackOffline(trackId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([TRACKS_STORE, BLOBS_STORE], 'readwrite');
    tx.objectStore(TRACKS_STORE).delete(trackId);
    tx.objectStore(BLOBS_STORE).delete(trackId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllOfflineTracks(): Promise<Track[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([TRACKS_STORE, BLOBS_STORE], 'readonly');
    const tracksStore = tx.objectStore(TRACKS_STORE);
    const blobsStore = tx.objectStore(BLOBS_STORE);

    const tracksReq = tracksStore.getAll();
    const blobsReq = blobsStore.getAll();

    tx.oncomplete = () => {
      const tracksList: Track[] = tracksReq.result || [];
      const blobsList: { id: string; blob: Blob }[] = blobsReq.result || [];
      const blobMap = new Map(blobsList.map((b) => [b.id, b.blob]));

      const resolved = tracksList.map((t) => {
        const blob = blobMap.get(t.id);
        return {
          ...t,
          cachedOffline: true,
          audioUrl: blob ? URL.createObjectURL(blob) : t.audioUrl
        };
      });
      resolve(resolved);
    };

    tx.onerror = () => reject(tx.error);
  });
}

export function exportDrmFreeFile(track: Track): void {
  const link = document.createElement('a');
  link.href = track.audioUrl;
  link.download = `${track.artist} - ${track.title}.mp3`;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

