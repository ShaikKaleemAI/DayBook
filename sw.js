/**
 * sw.js — minimal offline cache so Ledger keeps working with no connection
 * and is installable as a standalone app. Cache-first for the app shell,
 * network-first fallback isn't needed since there's no backend to call.
 */
const CACHE_NAME = "daybook-v15";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/tokens.css",
  "./css/base.css",
  "./css/layout.css",
  "./css/components.css",
  "./css/animations.css",
  "./css/elevate.css",
  "./css/sidebar.css",
  "./css/responsive.css",
  "./js/utils.js",
  "./js/store.js",
  "./js/theme.js",
  "./js/toast.js",
  "./js/dragdrop.js",
  "./js/gestures.js",
  "./js/shortcuts.js",
  "./js/palette.js",
  "./js/render.js",
  "./js/app.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // Skip cross-origin requests (Google Fonts etc.) — let the browser handle those normally.
  if (new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => cached);
    })
  );
});
