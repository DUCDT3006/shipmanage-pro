/* Service Worker — network-first cho app shell (same-origin).
   v2: luôn revalidate với server (cache:'no-cache') để KHÔNG kẹt code cũ khi online;
       chỉ dùng cache khi offline. Xoá cache cũ khi kích hoạt. */
const CACHE = 'shipmanage-shell-v5';

self.addEventListener('install', (e) => { self.skipWaiting(); });

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (!req.url.startsWith(self.location.origin)) return; // bỏ qua cross-origin (Firebase, CDN)
  e.respondWith(
    fetch(req, { cache: 'no-cache' })            // luôn hỏi server bản mới (revalidate)
      .then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))            // offline -> phục vụ bản cache gần nhất
  );
});
