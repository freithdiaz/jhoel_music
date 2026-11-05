// Diaz Music - Service Worker para PWA Offline & Background Audio
const CACHE_NAME = 'diaz-music-cache-v1';
const AUDIO_CACHE = 'diaz-music-audio-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('SW Precache warning:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== AUDIO_CACHE) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // No interceptar peticiones no GET o de extensiones
  if (event.request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // Si es un archivo de audio (.mp3, .flac, soundhelix, audius stream)
  if (
    url.pathname.endsWith('.mp3') ||
    url.pathname.endsWith('.flac') ||
    url.pathname.includes('/stream') ||
    url.searchParams.has('stream')
  ) {
    event.respondWith(
      caches.open(AUDIO_CACHE).then(async (audioCache) => {
        const cachedResponse = await audioCache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            // Clonar y guardar en caché para modo offline
            audioCache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          // Si no hay red y no está en caché, devolver error legible
          return new Response(null, { status: 408, statusText: 'Audio Offline' });
        }
      })
    );
    return;
  }

  // Para el resto de peticiones: Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

