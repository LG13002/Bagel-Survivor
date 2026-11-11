// Network-first service worker: always tries for the latest build, falls back to cache offline.
const CACHE = 'everything-bagel-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        // Only a good answer replaces the offline copy (never an error page).
        if (res.ok) {
          const copy = res.clone();
          e.waitUntil(
            caches.open(CACHE).then(async (c) => {
              await c.put(req, copy);
              // A new build's game file has a new name: drop the older builds' files.
              if (req.url.includes('/assets/')) {
                for (const k of await c.keys()) if (k.url.includes('/assets/') && k.url !== req.url) await c.delete(k);
              }
            }),
          );
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('./'))),
  );
});
