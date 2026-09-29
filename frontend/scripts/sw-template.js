/* Only explicitly public same-origin assets may enter CacheStorage. */
const CACHE = 'bo24-public-__VERSION__';
const PUBLIC = ['/offline.html', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-512.png', '/icons/apple-touch-icon.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PUBLIC)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('bo24-public-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Includes Render, authentication, API, PDFs, and requests with authorization.
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('Authorization') || url.pathname.startsWith('/api/') || url.pathname.endsWith('.pdf')) return;
  if (PUBLIC.includes(url.pathname) || url.pathname.startsWith('/_next/static/')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const found = await cache.match(request);
      if (found) return found;
      const response = await fetch(request);
      if (response.ok && !response.redirected) await cache.put(request, response.clone());
      return response;
    })());
  } else if (request.mode === 'navigate') {
    // Never cache navigation or RSC responses. Offline page contains no user data.
    event.respondWith(fetch(request).catch(async () => (await caches.match('/offline.html')) || Response.error()));
  }
});
