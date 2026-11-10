// Solo el código de la app se guarda aquí. El audio descargado vive en IndexedDB.
const CACHE_NAME = 'diaz-music-cache-v10';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-512-maskable.png'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const response = await fetch('/offline-assets.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('No se pudo preparar la aplicación para uso offline');
    const buildAssets = await response.json();
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll([...new Set([...STATIC_ASSETS, ...buildAssets])]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('diaz-music-cache-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname === '/api' || url.pathname.startsWith('/api/') || url.pathname.startsWith('/user/') || url.pathname.startsWith('/auth/')) return;
  if (request.mode === 'navigate') {
    // Red primero: una reconstrucción del servidor debe verse al recargar,
    // y la copia cacheada solo se usa cuando no hay conexión.
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-store' });
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put('/index.html', response.clone());
        }
        return response;
      } catch {
        return (await caches.open(CACHE_NAME)).match('/index.html') || new Response('Aplicación no disponible sin conexión', { status: 503 });
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cached = await (await caches.open(CACHE_NAME)).match(request, { ignoreSearch: true });
    if (cached) return cached;
    try { return await fetch(request); } catch { return new Response(null, { status: 503 }); }
  })());
});
