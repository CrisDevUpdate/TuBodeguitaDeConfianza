// Service Worker PWA + Notificaciones Push Reales — Tu Bodeguita de Confianza
// 1. Caché de imágenes (Cache-First): Vercel Blob y fotos solo se descargan una vez por dispositivo.
// 2. APIs de negocio (Network-Only): Nunca se cachean datos operativos (ventas, stock, clientes, push).
// 3. Shell PWA (Network-First): Resiliencia offline para la interfaz.
// 4. Web Push API: Recepción y apertura de notificaciones incluso con la pantalla bloqueada.

const SHELL_CACHE_NAME = 'bodeguita-shell-v2';
const IMAGE_CACHE_NAME = 'bodeguita-images-v1';
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];

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
  if (event.request.method !== 'GET') {
    return;
  }

  let url;
  try {
    url = new URL(event.request.url);
  } catch {
    return;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  const esPeticionImagen =
    event.request.destination === 'image' ||
    url.pathname.startsWith('/api/avatar/view') ||
    url.pathname.startsWith('/api/blob/view') ||
    url.hostname.includes('blob.vercel-storage.com') ||
    /\.(png|jpg|jpeg|webp|svg|gif|avif|ico)(\?.*)?$/i.test(url.pathname);

  if (esPeticionImagen) {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
            cache.put(event.request, networkResponse.clone()).catch(() => {});
          }
          return networkResponse;
        } catch {
          return cachedResponse || new Response('', { status: 408, statusText: 'Image Request Failed' });
        }
      })
    );
    return;
  }

  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('firebase')
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(SHELL_CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') {
          const fallbackRoot = await caches.match('/');
          if (fallbackRoot) return fallbackRoot;
        }
        return new Response('Sin conexión', { status: 503, statusText: 'Offline' });
      })
  );
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Tu Bodeguita de Confianza',
    body: 'Tienes una nueva notificación importante.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'bodeguita-notif',
    tab: 'notificaciones',
    url: '/'
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      try {
        payload.body = event.data.text() || payload.body;
      } catch {}
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/icon-192.png',
    tag: payload.tag || 'bodeguita-notif',
    renotify: true,
    vibrate: [180, 90, 180],
    requireInteraction: Boolean(payload.requireInteraction),
    data: {
      url: payload.url || '/',
      tab: payload.tab || 'notificaciones',
      timestamp: Date.now()
    }
  };

  event.waitUntil(self.registration.showNotification(payload.title || 'Tu Bodeguita de Confianza', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetTab = data.tab || 'notificaciones';
  const targetUrl = data.url || (targetTab ? `/?tab=${encodeURIComponent(targetTab)}` : '/');

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && client.url.startsWith(self.location.origin)) {
          client.postMessage({
            type: 'PWA_PUSH_NAVIGATE',
            tab: targetTab,
            url: targetUrl
          });
          if ('focus' in client) {
            return client.focus();
          }
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
