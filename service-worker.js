// Service Worker mínimo — solo para cumplir el requisito de "instalable" (PWA/TWA).
// Estrategia: red primero, sin cachear nada de /api/ (datos de ventas/clientes deben ser siempre en vivo).
const CACHE_NAME = 'bodeguita-shell-v1';
const APP_SHELL = ['/']; // se agranda solo si quieres cachear más adelante

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Nunca cachear la API (ventas, pagos, clientes, etc. deben ser siempre en vivo)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Red primero; si no hay internet, cae al caché (para que al menos abra la app)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
