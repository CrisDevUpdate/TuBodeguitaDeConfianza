/**
 * lib/dbSync.js
 * Cloud Sync Protocol: Real-Time State & Multi-Device Parity
 * 
 * - Single Source of Truth (Firestore & Zero-Cache Serverless API)
 * - Strict No-Cache Fetching Headers
 * - Window Focus & Tab Visibility Revalidation
 * - Real-Time Multi-Device Event Streaming
 */

export const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Surrogate-Control': 'no-store'
};

/**
 * Realiza peticiones HTTP a las Serverless API Routes forzando No-Cache
 */
export async function fetchNoCache(url, options = {}) {
  const customHeaders = options.headers || {};
  const mergedHeaders = {
    ...NO_CACHE_HEADERS,
    ...customHeaders,
    'Accept': 'application/json'
  };

  const finalUrl = new URL(url, window.location.origin);
  finalUrl.searchParams.set('_t', Date.now().toString());

  const response = await fetch(finalUrl.toString(), {
    ...options,
    cache: 'no-store',
    headers: mergedHeaders
  });

  if (!response.ok) {
    throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Inicializa el protocolo de sincronización en tiempo real y revalidación en foco
 */
export function initRealtimeSyncProtocol(onSyncCallback) {
  if (typeof window === 'undefined') return () => {};

  let lastRevalidation = 0;
  const handleRevalidation = async () => {
    const now = Date.now();
    if (now - lastRevalidation < 60000) return;
    lastRevalidation = now;

    try {
      if (window.InventoryApp?.Firebase && typeof window.InventoryApp.Firebase.syncFromCloud === 'function') {
        await window.InventoryApp.Firebase.syncFromCloud();
      }
      if (typeof onSyncCallback === 'function') {
        onSyncCallback();
      }
    } catch (err) {
      console.warn('[dbSync] Error durante la revalidación en foco:', err);
    }
  };

  // Re-validación inmediata al enfocar la ventana (ej. cambio entre pestañas o regreso a la app)
  window.addEventListener('focus', handleRevalidation);
  
  // Re-validación al cambiar visibilidad
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      handleRevalidation();
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Reconexión de red online
  window.addEventListener('online', handleRevalidation);

  // Devolver función de limpieza
  return () => {
    window.removeEventListener('focus', handleRevalidation);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('online', handleRevalidation);
  };
}

export default {
  NO_CACHE_HEADERS,
  fetchNoCache,
  initRealtimeSyncProtocol
};
