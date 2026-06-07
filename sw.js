const CACHE_NAME = 'sp-creativ-cache-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install service worker and cache core assets
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[Service Worker] Pre-caching core assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate service worker and clear old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Intercept network requests and apply stale-while-revalidate strategy
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  
  // Skip caching Firebase auth/firestore endpoints to ensure data remains dynamic
  if (
    url.hostname.includes('firestore.googleapis.com') || 
    url.hostname.includes('identitytoolkit') || 
    url.hostname.includes('securetoken')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        // If response is valid, clone and cache it for static assets and CDNs
        if (
          networkResponse && 
          networkResponse.status === 200 && 
          (networkResponse.type === 'basic' || 
           url.hostname.includes('cdn') || 
           url.hostname.includes('unpkg') || 
           url.hostname.includes('gstatic') || 
           url.hostname.includes('googleapis.com'))
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(err => {
        console.log('[Service Worker] Fetch failed; returning offline cache if available', err);
      });

      return cachedResponse || fetchPromise;
    })
  );
});
