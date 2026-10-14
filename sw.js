/* Meal Tracker service worker: keeps the app itself available offline.
   Only this site's own files are cached. Online-database requests (Supabase)
   are never touched, so data always comes straight from the database. */
var CACHE = 'meal-tracker-v1.5.0';
var FILES = ['./', './index.html', './manifest.webmanifest', './apple-touch-icon.png', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    // add files one by one so a missing optional file doesn't break install
    return Promise.all(FILES.map(function (f) { return c.add(f).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('meal-tracker-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // never cache the database or anything external
  if (req.mode === 'navigate' || /\/(index\.html)?$/.test(url.pathname)) {
    // the app page: try the network first so updates arrive, fall back to the saved copy offline
    e.respondWith(fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put('./index.html', copy); }); }
      return res;
    }).catch(function () {
      return caches.match('./index.html').then(function (r) { return r || caches.match('./'); });
    }));
    return;
  }
  // icons and manifest: saved copy first, then network
  e.respondWith(caches.match(req).then(function (r) {
    return r || fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    });
  }));
});
