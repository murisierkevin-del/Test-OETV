const CACHE_NAME = "cours-asa-shell-v14";
const RUNTIME_CACHE = "cours-asa-runtime-v3";

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./sw.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./themes/index.json"
];

// Base path automatique (ex: https://xxx.github.io/Cours-ASA/  =>  /Cours-ASA/)
const BASE_PATH = new URL(self.registration.scope).pathname; // finit par "/"

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;

  const res = await fetch(req);
  const cache = await caches.open(RUNTIME_CACHE);
  cache.put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  try {
    const res = await fetch(req, { cache: "no-store" });
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    throw new Error("Offline et non présent en cache");
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;

  // Tout ce qui est hors de l'app (au cas où) -> laissez le navigateur gérer
  if (!path.startsWith(BASE_PATH)) return;

  // 1) Cœur de l’app : toujours à jour (network-first)
  const isAppRoot = path === BASE_PATH; // /Cours-ASA/
  const isCore =
    isAppRoot ||
    path === `${BASE_PATH}index.html` ||
    path === `${BASE_PATH}sw.js` ||
    path === `${BASE_PATH}manifest.json` ||
    path === `${BASE_PATH}icon-192.png` ||
    path === `${BASE_PATH}icon-512.png`;

  if (isCore) {
    event.respondWith(networkFirst(req));
    return;
  }

  // 2) Tous les JSON des thèmes : toujours à jour (network-first)
  if (path.startsWith(`${BASE_PATH}themes/`) && path.endsWith(".json")) {
    event.respondWith(networkFirst(req));
    return;
  }

  // 3) Images : cache-first
  if (path.startsWith(`${BASE_PATH}images/`)) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // 4) Le reste : cache-first
  event.respondWith(cacheFirst(req));
});
