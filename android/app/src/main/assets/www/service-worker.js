// Service Worker con política estricta de persistencia y caché:
// 1. Caché de imágenes (Cache-First): Vercel Blob y fotos solo se descargan una vez por dispositivo.
// 2. APIs de negocio (Network-Only): Nunca se cachean datos operativos (ventas, stock, clientes).
// 3. Shell PWA (Network-First): Resiliencia offline para la interfaz.

const SHELL_CACHE_NAME = 'bodeguita-shell-v1';
const IMAGE_CACHE_NAME = 'bodeguita-images-v1';
const APP_SHELL = ['/'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE_NAME && k !== IMAGE_CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Ignorar métodos no GET
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Regla 1: CACHÉ DE IMÁGENES (Excepción de Arquitectura autorizada)
  // Identifica imágenes de Vercel Blob, proxies de visualización y archivos multimedia
  const esPeticionImagen =
    event.request.destination === 'image' ||
    url.pathname.startsWith('/api/avatar/view') ||
    url.pathname.startsWith('/api/blob/view') ||
    url.hostname.includes('blob.vercel-storage.com') ||
    /\.(png|jpg|jpeg|webp|svg|gif|avif|ico)(\?.*)?$/i.test(url.pathname);

  if (esPeticionImagen) {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then(async (cache) => {
        // 1. Verificar si ya existe en la caché local del dispositivo
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          // Devuelve de inmediato sin consumir cuota ni ancho de banda de Vercel Blob
          return cachedResponse;
        }

        // 2. Si no está en caché, descargar una única vez y guardar localmente
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
            cache.put(event.request, networkResponse.clone()).catch(() => {});
          }
          return networkResponse;
        } catch (fetchErr) {
          // Si falla la red y había un fallback disponible
          return cachedResponse || new Response('', { status: 408, statusText: 'Image Request Failed' });
        }
      })
    );
    return;
  }

  // Regla 2: APIS DE NEGOCIO (Estricto 100% en la Nube - Nunca Cachear)
  // Ventas, pagos, clientes, inventario, cotizaciones y transacciones van siempre directas a la red
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Regla 3: SHELL PWA (Red primero con fallback a caché de shell)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(SHELL_CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
