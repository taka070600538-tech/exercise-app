// manifest(manifest.webmanifest)はキャッシュしない: インストール判定に常に最新版を使わせるため
// (キャッシュ優先だと、一度取り込んだ古いmanifestが更新後も配信され続ける)
const CACHE_NAME = 'exercise-app-v5';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './js/app.js',
  './js/timeline.js',
  './js/db.js',
  './js/record.js',
  './js/form.js',
  './js/dateUtils.js',
  './js/backup.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
