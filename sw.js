const CACHE = 'galaxy-harvest-v1';
const CORE = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/ui.js',
  './js/state.js',
  './js/gen.js',
  './js/rng.js',
  './js/planetCanvas.js',
  './js/market.js',
  './js/audio.js',
  './assets/data/resources.json',
  './assets/data/artefacts.json',
  './manifest.webmanifest',
  './assets/footer.html'
];

self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE))));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))));
self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copy));
    return res;
  })));
});
