import { UserProfile, UserData, Playlist, Track } from '../types';
import { mergeUserData } from './syncMerge';

const CURRENT_USER_KEY = 'thomas_music_current_user';
const LOCAL_ACCOUNTS_KEY = 'thomas_music_local_accounts';
const SESSION_KEY = 'thomas_music_server_session';
type SyncState = 'local' | 'pending' | 'syncing' | 'synced' | 'conflict' | 'auth';
type SyncMeta = { server: string; revision: number | null; dirty: boolean; conflict: boolean };
const activeSyncs = new Set<string>();
const metaKey = (u: string) => `thomas_music_sync_${u}`;
const dataKey = (u: string) => `thomas_music_user_${u}_data`;
function readMeta(u: string): SyncMeta | null {
  try { return JSON.parse(localStorage.getItem(metaKey(u)) || 'null'); } catch { return null; }
}
function writeMeta(u: string, meta: SyncMeta): void { localStorage.setItem(metaKey(u), JSON.stringify(meta)); }
function notifySync(state: SyncState): void { window.dispatchEvent(new CustomEvent('music-sync', { detail: state })); }
function fromServer(data: any): UserData {
  return { playlists: data.playlists || [], favorites50List: data.favorites || [],
    userTasteProfile: data.tasteProfile || { favoriteArtists: {}, favoriteGenres: {} } };
}

export function getSyncState(username: string, server: string): SyncState {
  const meta = readMeta(username);
  if (!meta || meta.server !== server) return 'local';
  if (meta.conflict) return 'conflict';
  if (meta.dirty && !getServerToken(username, server)) return 'auth';
  return meta.dirty ? 'pending' : 'synced';
}

export async function syncUserData(username: string, server: string): Promise<void> {
  const u = username.toLowerCase();
  const key = `${server}:${u}`;
  if (activeSyncs.has(key)) return;
  const token = getServerToken(u, server);
  let meta = readMeta(u);
  if (!meta || meta.server !== server || meta.conflict || !token || meta.revision === null) {
    notifySync(getSyncState(u, server));
    return;
  }
  activeSyncs.add(key);
  notifySync('syncing');
  let retry = false;
  try {
    const snapshot = localStorage.getItem(dataKey(u));
    if (!snapshot) return;
    if (!meta.dirty) {
      const res = await fetch(`${server}/user/data/${encodeURIComponent(u)}`, {
        headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000)
      });
      if (res.status === 401) { notifySync('auth'); return; }
      if (!res.ok) { notifySync('pending'); return; }
      const remote = await res.json();
      if (!Number.isInteger(remote.revision)) { notifySync('pending'); return; }
      const latest = readMeta(u);
      if (latest?.server === server && !latest.dirty && !latest.conflict && latest.revision === meta.revision && localStorage.getItem(dataKey(u)) === snapshot && remote.revision !== meta.revision) {
        if (remote.revision < meta.revision) {
          // La base del servidor pudo restaurarse o cambiar; nunca descartar la copia local.
          writeMeta(u, { ...latest, dirty: true, conflict: true });
          notifySync('conflict');
          return;
        }
        const data = fromServer(remote);
        localStorage.setItem(dataKey(u), JSON.stringify(data));
        writeMeta(u, { ...latest, revision: remote.revision });
        window.dispatchEvent(new CustomEvent('music-sync-data', { detail: { username: u, server, data } }));
      }
      retry = !!readMeta(u)?.dirty && !readMeta(u)?.conflict;
      notifySync(retry ? 'pending' : getSyncState(u, server));
      return;
    }
    const data: UserData = JSON.parse(snapshot);
    const res = await fetch(`${server}/user/sync`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ username: u, base_revision: meta.revision, playlists: data.playlists,
        favorites: data.favorites50List, taste_profile: data.userTasteProfile }),
      signal: AbortSignal.timeout(5000)
    });
    meta = readMeta(u);
    if (!meta || meta.server !== server) return;
    if (res.status === 409) {
      writeMeta(u, { ...meta, conflict: true });
      notifySync('conflict');
    } else if (res.status === 401) {
      notifySync('auth');
    } else if (!res.ok) {
      notifySync('pending');
    } else {
      const result = await res.json();
      const dirty = localStorage.getItem(dataKey(u)) !== snapshot;
      writeMeta(u, { ...meta, revision: result.revision, dirty });
      retry = dirty;
      notifySync(dirty ? 'pending' : 'synced');
    }
  } catch {
    notifySync('pending');
  } finally {
    activeSyncs.delete(key);
    if (retry) void syncUserData(u, server);
  }
}

export interface ConflictPreview {
  username: string;
  server: string;
  local: UserData;
  localSnapshot: string;
  remote: UserData;
  revision: number;
}

async function fetchConflictRemote(username: string, server: string): Promise<{ data: UserData; revision: number }> {
  const token = getServerToken(username, server);
  if (!token) throw new Error('Inicia sesión para resolver el conflicto');
  const res = await fetch(`${server}/user/data/${encodeURIComponent(username)}`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000)
  });
  if (!res.ok) throw new Error(res.status === 401 ? 'La sesión venció. Inicia sesión de nuevo.' : 'No se pudieron consultar los datos del servidor');
  const remote = await res.json();
  if (!Number.isInteger(remote.revision)) throw new Error('El servidor no devolvió una versión válida');
  return { data: fromServer(remote), revision: remote.revision };
}

export async function getConflictPreview(username: string, server: string): Promise<ConflictPreview> {
  const u = username.toLowerCase();
  const remote = await fetchConflictRemote(u, server);
  const localSnapshot = localStorage.getItem(dataKey(u));
  if (!localSnapshot) throw new Error('No se encontraron los datos locales para comparar');
  return { username: u, server, local: JSON.parse(localSnapshot), localSnapshot, remote: remote.data, revision: remote.revision };
}

export async function resolveSyncConflict(username: string, server: string, choice: 'local' | 'server' | 'merge', preview: ConflictPreview): Promise<UserData | null> {
  const u = username.toLowerCase();
  if (preview.username !== u || preview.server !== server || localStorage.getItem(dataKey(u)) !== preview.localSnapshot) {
    throw new Error('Los datos de este dispositivo cambiaron. Actualiza la comparación antes de continuar.');
  }
  const remote = await fetchConflictRemote(u, server);
  if (remote.revision !== preview.revision || localStorage.getItem(dataKey(u)) !== preview.localSnapshot) {
    throw new Error('Los datos cambiaron mientras comparabas. Actualiza la comparación antes de continuar.');
  }
  const data = choice === 'server' ? remote.data : choice === 'merge' ? mergeUserData(preview.local, remote.data) : preview.local;
  // Si no cabe la copia, no se sobrescribe ninguna de las versiones.
  const backupId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(`thomas_music_sync_backup_${u}_${backupId}`, JSON.stringify({ savedAt: Date.now(), local: preview.local, server: remote.data }));
  if (choice !== 'local') localStorage.setItem(dataKey(u), JSON.stringify(data));
  const dirty = choice !== 'server';
  writeMeta(u, { server, revision: remote.revision, dirty, conflict: false });
  notifySync(dirty ? 'pending' : 'synced');
  if (dirty) void syncUserData(u, server);
  return choice === 'local' ? null : data;
}

function storeServerSession(username: string, server: string, token: string): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ username, server, token }));
}

function getServerToken(username: string, server: string): string | null {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    return session?.username === username && session?.server === server ? session.token : null;
  } catch { return null; }
}

// Helper de hash simple para almacenamiento local offline
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'h_' + Math.abs(hash).toString(16);
}

export function getCurrentUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export function setCurrentUser(user: UserProfile | null): void {
  try {
    if (user) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } else {
      const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      if (session?.server && session?.token) {
        fetch(`${session.server}/auth/logout`, {
          method: 'POST', headers: { Authorization: `Bearer ${session.token}` },
          signal: AbortSignal.timeout(3000)
        }).catch(() => {});
      }
      localStorage.removeItem(CURRENT_USER_KEY);
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {}
}

export function getLocalUserData(username: string): UserData {
  try {
    const raw = localStorage.getItem(`thomas_music_user_${username.toLowerCase()}_data`) || localStorage.getItem(`diaz_music_user_${username.toLowerCase()}_data`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    playlists: [
      {
        id: `pl-${Date.now()}`,
        name: 'Mis Favoritas',
        description: 'Mi lista personal de reproducción',
        coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
        createdAt: Date.now(),
        tracks: []
      }
    ],
    favorites50List: [],
    userTasteProfile: {
      favoriteArtists: {},
      favoriteGenres: {}
    }
  };
}

export function saveLocalUserData(username: string, data: UserData, fastApiUrl?: string): void {
  const u = username.toLowerCase();
  try {
    const serialized = JSON.stringify(data);
    const previous = localStorage.getItem(dataKey(u));
    localStorage.setItem(dataKey(u), serialized);
    if (fastApiUrl && u !== 'invitado' && previous !== serialized) {
      const existing = readMeta(u);
      const meta = existing?.server === fastApiUrl ? existing : { server: fastApiUrl, revision: null, dirty: false, conflict: false };
      writeMeta(u, { ...meta, dirty: true });
    }
  } catch (err) {
    console.warn('Error guardando datos de usuario local:', err);
    return;
  }
  if (fastApiUrl && u !== 'invitado') void syncUserData(u, fastApiUrl);
}

// Iniciar sesión (Intenta Servidor Backend + Fallback Offline Local)
export async function loginUser(
  username: string,
  password: string,
  fastApiUrl?: string
): Promise<{ user: UserProfile; data: UserData }> {
  const u = username.trim().toLowerCase();
  const p = password.trim();

  if (!u || !p) {
    throw new Error('Por favor ingresa usuario y contraseña');
  }

  // 1. Probar Servidor Backend si está disponible
  if (fastApiUrl) {
    try {
      const res = await fetch(`${fastApiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p }),
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        const json = await res.json();
        storeServerSession(u, fastApiUrl, json.token);
        const user: UserProfile = json.user;
        const serverData = fromServer(json.data || {});
        const meta = readMeta(u);
        const localRaw = localStorage.getItem(dataKey(u));
        const hasPending = !!localRaw && (meta?.server !== fastApiUrl || meta.dirty);
        const conflict = hasPending && (meta?.server !== fastApiUrl || meta.revision !== json.data.revision);
        const data = hasPending ? JSON.parse(localRaw) as UserData : serverData;
        writeMeta(u, { server: fastApiUrl, revision: hasPending && meta?.server === fastApiUrl ? meta.revision : json.data.revision, dirty: hasPending, conflict });

        // Cachear cuenta y datos localmente
        setCurrentUser(user);
        localStorage.setItem(dataKey(u), JSON.stringify(data));
        saveLocalAccountCredentials(u, p, user.displayName);
        return { user, data };
      } else if (res.status === 401) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Usuario o contraseña incorrectos');
      }
    } catch (err: any) {
      if (err.message && err.message.includes('incorrectos')) {
        throw err;
      }
      // Servidor no disponible, pasar a validación local offline
    }
  }

  // 2. Validación Local Offline (Modo PWA sin conexión)
  const localAccounts = getLocalAccounts();
  const found = localAccounts.find((a) => a.username === u);
  if (!found || found.passwordHash !== simpleHash(p)) {
    throw new Error('Usuario o contraseña incorrectos (Modo local)');
  }

  const user: UserProfile = {
    id: found.id,
    username: found.username,
    displayName: found.displayName,
    createdAt: found.createdAt
  };

  const data = getLocalUserData(u);
  setCurrentUser(user);
  return { user, data };
}

// Registrar nueva cuenta (Intenta Servidor Backend + Guarda en Local)
export async function registerUser(
  username: string,
  password: string,
  displayName: string,
  fastApiUrl?: string
): Promise<{ user: UserProfile; data: UserData }> {
  const u = username.trim().toLowerCase();
  const p = password.trim();
  const name = displayName.trim() || u;

  if (u.length < 3) throw new Error('El usuario debe tener al menos 3 caracteres');
  if (p.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres');

  // 1. Probar Servidor Backend si está disponible
  if (fastApiUrl) {
    try {
      const res = await fetch(`${fastApiUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p, display_name: name }),
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        const json = await res.json();
        storeServerSession(u, fastApiUrl, json.token);
        const user: UserProfile = json.user;
        const initialData: UserData = {
          playlists: [
            {
              id: `pl-${Date.now()}`,
              name: `Favoritas de ${name}`,
              description: 'Mi primera playlist personalizada',
              coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
              createdAt: Date.now(),
              tracks: []
            }
          ],
          favorites50List: [],
          userTasteProfile: { favoriteArtists: {}, favoriteGenres: {} }
        };

        setCurrentUser(user);
        writeMeta(u, { server: fastApiUrl, revision: 0, dirty: false, conflict: false });
        saveLocalUserData(u, initialData, fastApiUrl);
        saveLocalAccountCredentials(u, p, name);
        return { user, data: initialData };
      } else if (res.status === 409) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Ese nombre de usuario ya está registrado');
      }
    } catch (err: any) {
      if (err.message && (err.message.includes('ya existe') || err.message.includes('ya está registrado'))) {
        throw err;
      }
      // Servidor apagado, registrar localmente
    }
  }

  // 2. Registro Local Offline
  const localAccounts = getLocalAccounts();
  if (localAccounts.some((a) => a.username === u)) {
    throw new Error('Ese nombre de usuario ya está registrado en este dispositivo');
  }

  const user: UserProfile = {
    id: `local-user-${Date.now()}`,
    username: u,
    displayName: name,
    createdAt: Date.now()
  };

  saveLocalAccountCredentials(u, p, name);

  const initialData: UserData = {
    playlists: [
      {
        id: `pl-${Date.now()}`,
        name: `Favoritas de ${name}`,
        description: 'Mi primera playlist personalizada',
        coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
        createdAt: Date.now(),
        tracks: []
      }
    ],
    favorites50List: [],
    userTasteProfile: { favoriteArtists: {}, favoriteGenres: {} }
  };

  saveLocalUserData(u, initialData);
  setCurrentUser(user);
  return { user, data: initialData };
}

// Cuentas locales offline
interface LocalAccount {
  id: string;
  username: string;
  passwordHash: string;
  displayName: string;
  createdAt: number;
}

function getLocalAccounts(): LocalAccount[] {
  try {
    const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveLocalAccountCredentials(username: string, pass: string, displayName: string): void {
  const accounts = getLocalAccounts();
  const filtered = accounts.filter((a) => a.username !== username.toLowerCase());
  filtered.push({
    id: `acc-${Date.now()}`,
    username: username.toLowerCase(),
    passwordHash: simpleHash(pass),
    displayName: displayName || username,
    createdAt: Date.now()
  });
  try {
    localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(filtered));
  } catch {}
}
