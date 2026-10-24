const CACHE_PREFIX = "devvault-pwa-";
const CACHE_NAME = `${CACHE_PREFIX}v2`;
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime-v1`;
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/devvault-192.png",
  "./assets/devvault-512.png",
  "./assets/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(APP_SHELL);
      await self.skipWaiting();
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    if (!["script", "style", "font"].includes(request.destination)) return;
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const update = fetch(request).then(async (response) => {
          if (response.ok || response.type === "opaque") {
            await cache.put(request, response.clone());
          }
          return response;
        });
        if (cached) {
          event.waitUntil(
            update
              .then(() => undefined)
              .catch((error) => console.info("DevVault cached resource could not be refreshed.", error))
          );
          return cached;
        }
        return update;
      })
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then(async (response) => {
        const cache = await caches.open(CACHE_NAME);
        await cache.put("./index.html", response.clone());
        return response;
      }).catch(async () => {
        const cachedPage = await caches.match(request);
        return cachedPage || caches.match("./index.html");
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    }))
  );
});
