/* ============================================================
   Mission: English Club — service worker
   Offline-first app shell. No external assets, no network APIs.
   Bump CACHE_VERSION whenever a precached file changes.
   ============================================================ */

const CACHE_VERSION = 'ec-v1.3.0';
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './src/main.js',
  './src/styles/main.css',
  './src/styles/screens.css',
  './src/core/util.js',
  './src/core/storage.js',
  './src/core/timer.js',
  './src/core/scoring.js',
  './src/core/achievements.js',
  './src/core/audio.js',
  './src/game/input.js',
  './src/game/mission.js',
  './src/ui/activities.js',
  './src/ui/decor.js',
  './src/ui/dialogue.js',
  './src/ui/icons.js',
  './src/ui/screens.js',
  './src/world/campus.js',
  './src/world/renderer.js',
  './src/world/sprites.js',
  './src/content/schema.js',
  './src/content/vocabulary.js',
  './src/content/grammar.js',
  './src/content/reading.js',
  './src/content/writing.js',
  './src/content/culture.js',
  './src/content/dialogues.js',
  './src/content/index.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    // addAll fails as a whole if one file is missing: add individually and
    // keep going, so a single typo cannot break the whole offline mode.
    await Promise.all(PRECACHE.map(async (url) => {
      try {
        await cache.add(new Request(url, { cache: 'reload' }));
      } catch (error) {
        console.warn('[sw] could not precache', url, error?.message || error);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: serve the shell so a deep link works offline.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(CACHE_VERSION);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch {
        const cache = await caches.open(CACHE_VERSION);
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Static assets: cache first, network as a fallback that repopulates the cache.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(request, { ignoreSearch: false });
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok && response.type === 'basic') cache.put(request, response.clone());
      return response;
    } catch {
      return new Response('Offline and not cached', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  })());
});
