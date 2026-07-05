/* Minimal service worker: cache-first for immutable static assets, network for everything
   else. Dashboard data and /api are ALWAYS network — stale campaign data is worse than a
   spinner. Bump CACHE to invalidate. */
const CACHE = 'usersessions-v1'
const STATIC = ['/icon.svg', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(STATIC)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  if (url.pathname.startsWith('/_next/static/') || STATIC.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then(
        (hit) =>
          hit ??
          fetch(event.request).then((res) => {
            const copy = res.clone()
            void caches.open(CACHE).then((c) => c.put(event.request, copy))
            return res
          })
      )
    )
  }
})
