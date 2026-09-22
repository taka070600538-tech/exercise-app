// manifest(manifest.webmanifest)はキャッシュしない: インストール判定に常に最新版を使わせるため
// (キャッシュ優先だと、一度取り込んだ古いmanifestが更新後も配信され続ける)
const CACHE_NAME = 'exercise-app-v10';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './js/app.js',
  './js/timeline.js',
  './js/analysis.js',
  './js/db.js',
  './js/record.js',
  './js/form.js',
  './js/dateUtils.js',
  './js/backup.js',
  './icons/app-icon.svg',
  './icons/app-icon-192.png',
  './icons/app-icon-512.png',
  './icons/app-icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  // GitHub Pagesはmax-age=600で配信するため、通常のfetchだとブラウザのHTTPキャッシュに残った
  // 古いJSを新しいCACHE_NAMEのキャッシュに取り込んでしまう。cache:'reload'で必ずサーバーから取得する。
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' })))
    )
  );
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
