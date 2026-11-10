import { Track } from '../types';

const DB_NAME = 'DiazMusicDB';
const DB_VERSION = 1;
const TRACKS_STORE = 'saved_tracks';
const BLOBS_STORE = 'audio_blobs';
const MAX_AUDIO_BYTES = 100 * 1024 * 1024;
const objectUrls = new Map<string, string>();
// Una URL de objeto en uso por el audio actual o el deck de precarga no debe
// revocarse: el elemento quedaría mudo hasta el siguiente cambio de pista.
const protectedObjectUrls = new Set<string>();

function getObjectUrl(id: string, blob: Blob): string {
  let url = objectUrls.get(id);
  if (!url) { url = URL.createObjectURL(blob); objectUrls.set(id, url); }
  return url;
}

function replaceObjectUrl(id: string, blob: Blob): string {
  const previous = objectUrls.get(id);
  if (previous && !protectedObjectUrls.has(id)) {
    try { URL.revokeObjectURL(previous); } catch {}
  }
  const url = URL.createObjectURL(blob);
  objectUrls.set(id, url);
  return url;
}

export function protectOfflineTrackUrl(id: string, protectedValue = true): void {
  if (protectedValue) protectedObjectUrls.add(id);
  else protectedObjectUrls.delete(id);
}

export function getOfflineTrackUrl(id: string): string | null {
  return objectUrls.get(id) || null;
}

/** Regenera una URL de objeto desde IndexedDB sin tocar la que esté en uso. */
export async function refreshOfflineTrackUrl(id: string): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOBS_STORE, 'readonly');
    const request = tx.objectStore(BLOBS_STORE).get(id);
    request.onsuccess = () => {
      const blob = request.result?.blob;
      if (!(blob instanceof Blob) || !blob.size) {
        db.close();
        resolve(null);
        return;
      }
      const url = replaceObjectUrl(id, blob);
      db.close();
      resolve(url);
    };
    request.onerror = () => { db.close(); reject(request.error); };
  });
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

    tx.oncomplete = () => { db.close(); resolve({ ...track, cachedOffline: true, audioUrl: replaceObjectUrl(track.id, audioBlob) }); };
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
    tx.oncomplete = () => {
      db.close();
      if (!protectedObjectUrls.has(trackId)) {
        const url = objectUrls.get(trackId);
        if (url) { try { URL.revokeObjectURL(url); } catch {} objectUrls.delete(trackId); }
      }
      protectedObjectUrls.delete(trackId);
      resolve();
    };
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
