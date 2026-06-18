const CACHE_NAME = 'tavernotex-v2';

// Only cache static assets that don't change often
const STATIC_EXTENSIONS = /\.(png|jpg|jpeg|svg|ico|woff2?|ttf|css)$/;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache API calls or JS modules
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_build/')) {
    return; // Let browser handle normally
  }

  // Cache static assets (images, fonts, CSS)
  if (STATIC_EXTENSIONS.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      }))
    );
    return;
  }

  // Navigation requests: network-first, fallback to offline page
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then((cached) => cached || new Response('Offline — please connect to the internet.', {
          status: 503, headers: { 'Content-Type': 'text/plain' }
        }))
      )
    );
  }
});
