// Offline support: keeps a copy of the app's files so it opens without internet.
// Your journal itself is in the browser's storage, so it's always there offline.
// When you upload new files, bump the number in CACHE so phones pick them up.
const CACHE = "dream-journal-v4";
const FILES = ["./", "index.html", "style.css", "app.js", "prompt.js", "manifest.json",
               "icons/icon.svg", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) { return cache.addAll(FILES); }));
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// Try the internet first (so updates show up), and use the saved copy when offline.
// Requests to OpenAI are left alone.
self.addEventListener("fetch", function (event) {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin) return;
  event.respondWith(
    fetch(event.request).then(function (response) {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); });
      }
      return response;
    }).catch(function () {
      return caches.match(event.request, { ignoreSearch: true }).then(function (hit) {
        return hit || caches.match("index.html");
      });
    })
  );
});
