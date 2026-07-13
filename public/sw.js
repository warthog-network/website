// Legacy root-scoped service worker — self-destructs and clears caches.
// Wallet PWA uses /webwallet/sw.js instead.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.map((name) => caches.delete(name))))
      .then(() => self.registration.unregister())
  );
});

self.addEventListener('fetch', () => {
  // Pass through; this worker should unregister immediately after activate.
});