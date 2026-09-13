/**
 * /lib/offlineStorage.js
 * Capa de Almacenamiento Local Agresivo (IndexedDB + CacheStorage API).
 * Implementa la estrategia Zero-Reads / Zero-Tokens para datos y Vercel Blob Media.
 */

const DB_NAME = 'bodeguita_offline_v2';
const DB_VERSION = 1;
const MEDIA_CACHE_NAME = 'app-media-v1';

export const STORES = Object.freeze({
  USERS: 'users',
  PRODUCTS: 'products',
  SALES_HISTORY: 'sales_history',
  PAYMENTS_AND_CREDITS: 'payments_and_credits',
  AUDIT_LOGS: 'audit_logs',
  NOTIFICATIONS: 'notifications',
  SYNC_META: 'sync_meta',
  OUTBOX: 'outbox_mutations'
});

let dbInstance = null;

/**
 * Abre e inicializa la base de datos local IndexedDB
 */
export function openLocalDatabase() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB no está disponible en este entorno'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Almacenes para cada colección del sistema
      [
        STORES.USERS,
        STORES.PRODUCTS,
        STORES.SALES_HISTORY,
        STORES.PAYMENTS_AND_CREDITS,
        STORES.AUDIT_LOGS,
        STORES.NOTIFICATIONS
      ].forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      });

      // Almacén para metadatos de sincronización (lastLocalSync)
      if (!db.objectStoreNames.contains(STORES.SYNC_META)) {
        db.createObjectStore(STORES.SYNC_META, { keyPath: 'collection' });
      }

      // Almacén outbox para encolar mutaciones pendientes offline
      if (!db.objectStoreNames.contains(STORES.OUTBOX)) {
        const outbox = db.createObjectStore(STORES.OUTBOX, { keyPath: 'mutationId', autoIncrement: true });
        outbox.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Consulta local instantánea (Cache-First) de toda una colección
 */
export async function getLocalCollection(storeName) {
  const db = await openLocalDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Guarda o actualiza un lote de documentos en IndexedDB de forma atómica
 */
export async function saveLocalBulk(storeName, items = []) {
  if (!items.length) return;
  const db = await openLocalDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    items.forEach(item => {
      if (item && item.id) {
        store.put(item);
      }
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Guarda o actualiza un documento individual localmente
 */
export async function saveLocalItem(storeName, item) {
  if (!item || !item.id) return;
  const db = await openLocalDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.put(item);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Elimina un documento de la base local
 */
export async function deleteLocalItem(storeName, id) {
  const db = await openLocalDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.delete(id);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Obtiene la marca de tiempo de la última sincronización local de una colección
 */
export async function getLastLocalSync(collectionName) {
  const db = await openLocalDatabase();
  return new Promise((resolve) => {
    const tx = db.transaction(STORES.SYNC_META, 'readonly');
    const store = tx.objectStore(STORES.SYNC_META);
    const req = store.get(collectionName);
    req.onsuccess = () => resolve(req.result ? req.result.lastSync : null);
    req.onerror = () => resolve(null);
  });
}

/**
 * Actualiza la marca de tiempo de sincronización local
 */
export async function setLastLocalSync(collectionName, timestamp) {
  const db = await openLocalDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SYNC_META, 'readwrite');
    const store = tx.objectStore(STORES.SYNC_META);
    store.put({ collection: collectionName, lastSync: timestamp });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Encola una mutación en el outbox para posterior despacho al recuperar conexión
 */
export async function enqueuePendingMutation(mutation) {
  const db = await openLocalDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.OUTBOX, 'readwrite');
    const store = tx.objectStore(STORES.OUTBOX);
    store.add({
      ...mutation,
      timestamp: Date.now()
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Obtiene todas las mutaciones pendientes encoladas
 */
export async function getPendingMutations() {
  const db = await openLocalDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.OUTBOX, 'readonly');
    const store = tx.objectStore(STORES.OUTBOX);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Elimina una mutación procesada del outbox
 */
export async function removePendingMutation(mutationId) {
  const db = await openLocalDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.OUTBOX, 'readwrite');
    const store = tx.objectStore(STORES.OUTBOX);
    store.delete(mutationId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ==========================================================================
   OPTIMIZACIÓN MULTIMEDIA Y CACHÉ DE VERCEL BLOB (CacheStorage API)
   ========================================================================== */

/**
 * Resuelve y cachea assets multimedia de Vercel Blob en la memoria del dispositivo.
 * Tras la primera carga, sirve el asset directamente desde CacheStorage (cero ancho de banda).
 */
export async function getOrCacheMediaUrl(mediaUrl) {
  if (!mediaUrl || typeof mediaUrl !== 'string' || mediaUrl.startsWith('data:')) {
    return mediaUrl;
  }

  // Si no está disponible la Cache API en el navegador, retornar la URL remota
  if (typeof window === 'undefined' || !('caches' in window)) {
    return mediaUrl;
  }

  try {
    const cache = await window.caches.open(MEDIA_CACHE_NAME);
    const cachedResponse = await cache.match(mediaUrl);

    if (cachedResponse) {
      const blob = await cachedResponse.blob();
      return URL.createObjectURL(blob);
    }

    // Primera descarga: guardado local transparente
    const networkResponse = await fetch(mediaUrl, { mode: 'cors' });
    if (networkResponse.ok) {
      await cache.put(mediaUrl, networkResponse.clone());
      const blob = await networkResponse.blob();
      return URL.createObjectURL(blob);
    }
  } catch (err) {
    console.warn('[MediaCache] No se pudo cachear asset multimedia:', err.message);
  }

  return mediaUrl;
}

export default {
  STORES,
  openLocalDatabase,
  getLocalCollection,
  saveLocalBulk,
  saveLocalItem,
  deleteLocalItem,
  getLastLocalSync,
  setLastLocalSync,
  enqueuePendingMutation,
  getPendingMutations,
  removePendingMutation,
  getOrCacheMediaUrl
};
