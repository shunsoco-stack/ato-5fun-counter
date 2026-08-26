const CACHE_PREFIX = "ato-5fun-counter";
const CACHE_VERSION = "v1";
const APP_SHELL_CACHE = `${CACHE_PREFIX}-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/icon-maskable-512x512.png",
  "/apple-touch-icon.png",
];

async function precacheAppShell() {
  const cache = await caches.open(APP_SHELL_CACHE);
  const results = await Promise.allSettled(
    PRECACHE_ASSETS.map((asset) => cache.add(asset)),
  );

  // Cache the versioned Next.js CSS and JavaScript referenced by the home page.
  // Individual failures should not prevent the service worker from installing.
  try {
    const response = await fetch("/", { cache: "reload" });
    if (!response.ok) return;

    await cache.put("/", response.clone());
    const html = await response.text();
    const assetPaths = Array.from(
      html.matchAll(/(?:src|href)=["']([^"']+)["']/g),
      (match) => match[1],
    ).filter((path) => path.startsWith("/_next/static/"));

    await Promise.allSettled(
      [...new Set(assetPaths)].map((asset) => cache.add(asset)),
    );
  } catch {
    // Installation remains useful even if the app shell cannot be reached yet.
  }

  // Keep the install successful when an optional precache response is unavailable.
  return results;
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheAppShell());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith(`${CACHE_PREFIX}-`) && key !== APP_SHELL_CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(APP_SHELL_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) ?? (await cache.match("/"));
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(APP_SHELL_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    ["font", "image", "script", "style"].includes(request.destination);

  if (isStaticAsset) {
    event.respondWith(cacheFirst(request));
  }
});
