/* Service Worker — network-first cho app shell (same-origin).
   - Luôn ưu tiên mạng (tránh phục vụ code cũ khi online).
   - Khi offline -> phục vụ từ cache.
   - KHÔNG can thiệp request cross-origin (Firebase, CDN) để không phá sync. */
const CACHE = 'shipmanage-shell-v1';

self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (!req.url.startsWith(self.location.origin)) return; // bỏ qua cross-origin
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
