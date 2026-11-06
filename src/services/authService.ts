import { UserProfile, UserData, Playlist, Track } from '../types';

const CURRENT_USER_KEY = 'thomas_music_current_user';
const LOCAL_ACCOUNTS_KEY = 'thomas_music_local_accounts';

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
      localStorage.removeItem(CURRENT_USER_KEY);
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
    localStorage.setItem(`thomas_music_user_${u}_data`, JSON.stringify(data));
  } catch (err) {
    console.warn('Error guardando datos de usuario local:', err);
  }

  // Sincronizar en segundo plano con el servidor backend si está conectado
  if (fastApiUrl) {
    fetch(`${fastApiUrl}/user/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: u,
        playlists: data.playlists,
        favorites: data.favorites50List,
        taste_profile: data.userTasteProfile
      }),
      signal: AbortSignal.timeout(3000)
    }).catch(() => {
      // Sincronización silenciosa si el servidor está apagado
    });
  }
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
        const user: UserProfile = json.user;
        const serverData: UserData = {
          playlists: json.data?.playlists || [],
          favorites50List: json.data?.favorites || [],
          userTasteProfile: json.data?.tasteProfile || { favoriteArtists: {}, favoriteGenres: {} }
        };

        // Cachear cuenta y datos localmente
        setCurrentUser(user);
        saveLocalUserData(u, serverData);
        saveLocalAccountCredentials(u, p, user.displayName);
        return { user, data: serverData };
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
  if (p.length < 4) throw new Error('La contraseña debe tener al menos 4 caracteres');

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

