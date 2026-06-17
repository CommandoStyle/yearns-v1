// Yearns service worker — v1
// Bump CACHE_VERSION on each deploy to bust stale caches.
const CACHE_VERSION = 'yearns-v1'

// Pages to precache at install time. These make the app shell load
// instantly even on a slow connection.
const PRECACHE_URLS = ['/', '/offline']

// ─── Install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),  // activate immediately, don't wait for old SW to die
  )
})

// ─── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),  // take control of existing tabs immediately
  )
})

// ─── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Only intercept same-origin requests
  if (url.origin !== location.origin) return

  // ── API routes: always network, never cache ──────────────────────────────
  // Story content is ephemeral and user-specific. API responses must never
  // be served stale. Privacy: cached API responses could expose story text.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
    return
  }

  // ── Static assets: cache-first ───────────────────────────────────────────
  // Next.js content-hashes its JS/CSS filenames so stale caches are safe.
  // Icons are versioned by CACHE_VERSION bump.
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/')         ||
    url.pathname.endsWith('.ico')
  ) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached
          return fetch(request).then(response => {
            if (response.ok) cache.put(request, response.clone())
            return response
          })
        }),
      ),
    )
    return
  }

  // ── Navigation: network-first with offline fallback ───────────────────────
  // Always try the network so fresh HTML is shown. Falls back to the cached
  // version of the same page, then to /offline if nothing is cached.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache successful navigation responses for offline fallback
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_VERSION).then(cache => cache.put(request, clone))
          }
          return response
        })
        .catch(() =>
          caches.match(request)
            .then(cached => cached ?? caches.match('/offline')),
        ),
    )
    return
  }
})
