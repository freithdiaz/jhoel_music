import { Track } from '../types';

const DB_NAME = 'DiazMusicDB';
const DB_VERSION = 1;
const TRACKS_STORE = 'saved_tracks';
const BLOBS_STORE = 'audio_blobs';
const MAX_AUDIO_BYTES = 100 * 1024 * 1024;
const objectUrls = new Map<string, string>();

function getObjectUrl(id: string, blob: Blob): string {
  let url = objectUrls.get(id);
  if (!url) { url = URL.createObjectURL(blob); objectUrls.set(id, url); }
  return url;
}

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
  if (track.sourceType === 'radio') throw new Error('Las emisoras en vivo no se pueden guardar sin conexión.');
  if (track.sourceType === 'itunes' || track.id.startsWith('itunes-')) throw new Error('Las vistas previas de iTunes no se guardan en la bóveda.');
  if (track.sourceType === 'youtube' || track.sourceType === 'invidious' || track.id.startsWith('yt-') || /\/stream_yt(?:\?|$)/.test(track.audioUrl || '')) throw new Error('YouTube no se guarda en la bóveda.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180000);
  let audioBlob: Blob;
  try {
    const res = await fetch(track.audioUrl, { mode: 'cors', signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const contentType = res.headers.get('content-type') || '';
    if (/^(text\/|application\/(json|xml))/i.test(contentType)) throw new Error('La fuente no devolvió un archivo de audio.');
    const contentLength = Number(res.headers.get('content-length'));
    if (contentLength > MAX_AUDIO_BYTES) throw new Error('La canción supera el límite de 100 MB.');
    if (res.body) {
      const reader = res.body.getReader();
      const chunks: BlobPart[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_AUDIO_BYTES) { await reader.cancel(); throw new Error('La canción supera el límite de 100 MB.'); }
        chunks.push(new Uint8Array(value).buffer);
      }
      audioBlob = new Blob(chunks, { type: contentType });
    } else {
      audioBlob = await res.blob();
      if (audioBlob.size > MAX_AUDIO_BYTES) throw new Error('La canción supera el límite de 100 MB.');
    }
    if (!audioBlob.size) throw new Error('El archivo de audio está vacío.');
  } finally { clearTimeout(timeout); }

  // Guardar metadata y blob en IndexedDB
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([TRACKS_STORE, BLOBS_STORE], 'readwrite');
    const tracksStore = tx.objectStore(TRACKS_STORE);
    const blobsStore = tx.objectStore(BLOBS_STORE);

    tracksStore.put({ ...track, cachedOffline: true });
    blobsStore.put({ id: track.id, blob: audioBlob });

    tx.oncomplete = () => { db.close(); resolve({ ...track, cachedOffline: true, audioUrl: getObjectUrl(track.id, audioBlob) }); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('No se pudo guardar la canción.')); };
  });
}

export async function removeTrackOffline(trackId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([TRACKS_STORE, BLOBS_STORE], 'readwrite');
    tx.objectStore(TRACKS_STORE).delete(trackId);
    tx.objectStore(BLOBS_STORE).delete(trackId);
    tx.oncomplete = () => { db.close(); const url = objectUrls.get(trackId); if (url) URL.revokeObjectURL(url); objectUrls.delete(trackId); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('No se pudo eliminar la canción.')); };
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

      const resolved = tracksList.filter(t => {
        const blob = blobMap.get(t.id);
        return blob instanceof Blob && blob.size > 0;
      }).map((t) => {
        const blob = blobMap.get(t.id);
        return {
          ...t,
          cachedOffline: true,
          audioUrl: blob ? getObjectUrl(t.id, blob) : t.audioUrl
        };
      });
      db.close();
      resolve(resolved);
    };

    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('No se pudo abrir la bóveda.')); };
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
