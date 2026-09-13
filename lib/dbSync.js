/**
 * /lib/dbSync.js
 * Capa de Persistencia y Motor de Sincronización Offline-First con Delta-Querying.
 * Garantiza Paridad Total en Cloud Firestore y Cero Lecturas Innecesarias (Zero-Reads).
 */

import { getFirestoreClient, COLLECTIONS, getServerTimestamp } from './firebaseClient.js';
import {
  STORES,
  getLocalCollection,
  saveLocalBulk,
  saveLocalItem,
  getLastLocalSync,
  setLastLocalSync,
  enqueuePendingMutation,
  getPendingMutations,
  removePendingMutation
} from './offlineStorage.js';

class DatabaseSyncEngine {
  constructor() {
    this.isSyncing = false;
    this.subscribers = new Set();
    this.status = 'idle'; // 'idle' | 'syncing' | 'offline' | 'error'
    this.initListeners();
  }

  initListeners() {
    if (typeof window === 'undefined') return;

    // Sincronización en segundo plano al recuperar red
    window.addEventListener('online', () => {
      console.log('[dbSync] Conexión restaurada. Vaciando mutaciones pendientes y sincronizando deltas...');
      this.flushOutboxAndSyncDeltas();
    });

    // Revalidación al regresar a la pestaña
    window.addEventListener('focus', () => {
      this.syncAllDeltas();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.syncAllDeltas();
      }
    });
  }

  notify(event, payload) {
    this.subscribers.forEach(cb => {
      try {
        cb(event, payload);
      } catch (e) {
        console.error('[dbSync] Error en suscriptor:', e);
      }
    });
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Primera Carga (Initial Hydration):
   * Lee la base de datos local IndexedDB primero. Si está vacía para una colección,
   * consulta el snapshot inicial a Firestore y lo indexa localmente.
   */
  async hydrateCollection(collectionName) {
    const localData = await getLocalCollection(collectionName);
    if (localData && localData.length > 0) {
      // Ya hidratado: CERO lecturas en Firestore
      return localData;
    }

    // Primera vez en el dispositivo: Descarga inicial
    const { db } = await getFirestoreClient();
    if (!db) return localData;

    try {
      this.status = 'syncing';
      this.notify('status_change', this.status);

      const snapshot = await db.collection(collectionName).get();
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (items.length > 0) {
        await saveLocalBulk(collectionName, items);
      }

      await setLastLocalSync(collectionName, new Date().toISOString());
      this.status = 'idle';
      this.notify('status_change', this.status);
      return items;
    } catch (err) {
      console.warn(`[dbSync] Hidratación inicial desde Firestore diferida para ${collectionName}:`, err.message);
      this.status = 'offline';
      this.notify('status_change', this.status);
      return localData;
    }
  }

  /**
   * Sincronización por Delta (Zero-Reads Optimization):
   * Únicamente consulta registros modificados después del último registro guardado.
   */
  async syncCollectionDelta(collectionName) {
    const { db } = await getFirestoreClient();
    if (!db || !navigator.onLine) return;

    try {
      const lastSync = await getLastLocalSync(collectionName);
      let query = db.collection(collectionName);

      if (lastSync) {
        // Delta Querying: Sólo registros con updatedAt > lastLocalSync
        query = query.where('updatedAt', '>', new Date(lastSync));
      }

      const snapshot = await query.get();

      if (!snapshot.empty) {
        const changedDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        await saveLocalBulk(collectionName, changedDocs);
        this.notify('data_updated', { collection: collectionName, items: changedDocs });
      }

      await setLastLocalSync(collectionName, new Date().toISOString());
    } catch (err) {
      console.warn(`[dbSync] Error en delta sync para ${collectionName}:`, err.message);
    }
  }

  /**
   * Sincroniza deltas de todas las 6 colecciones del sistema
   */
  async syncAllDeltas() {
    if (this.isSyncing || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    this.isSyncing = true;
    this.status = 'syncing';
    this.notify('status_change', this.status);

    const collections = [
      COLLECTIONS.USERS,
      COLLECTIONS.PRODUCTS,
      COLLECTIONS.SALES_HISTORY,
      COLLECTIONS.PAYMENTS_AND_CREDITS,
      COLLECTIONS.AUDIT_LOGS,
      COLLECTIONS.NOTIFICATIONS
    ];

    for (const col of collections) {
      await this.syncCollectionDelta(col);
    }

    this.isSyncing = false;
    this.status = 'idle';
    this.notify('status_change', this.status);
  }

  /**
   * Ejecuta una mutación optimista (Zero Latency):
   * 1. Se persiste inmediatamente en IndexedDB.
   * 2. Si hay conexión, se despacha a Firestore.
   * 3. Si no hay conexión o falla, se encola en el Outbox para sincronización en background.
   */
  async mutate(collectionName, actionType, docData) {
    const payload = {
      ...docData,
      updatedAt: new Date().toISOString()
    };

    // 1. Escritura optimista local instantánea
    await saveLocalItem(collectionName, payload);
    this.notify('data_updated', { collection: collectionName, item: payload });

    // 2. Despacho a Cloud Firestore
    const { db } = await getFirestoreClient();
    if (navigator.onLine && db) {
      try {
        const docRef = db.collection(collectionName).doc(String(payload.id));
        await docRef.set({
          ...payload,
          updatedAt: getServerTimestamp()
        }, { merge: true });
        return payload;
      } catch (err) {
        console.warn(`[dbSync] Despacho online falló; encolando en Outbox:`, err.message);
      }
    }

    // 3. Modo Offline: Encolar en Outbox para reintento automático
    await enqueuePendingMutation({
      collection: collectionName,
      action: actionType,
      data: payload
    });

    return payload;
  }

  /**
   * Despacha todas las mutaciones pendientes encoladas en el Outbox
   */
  async flushOutboxAndSyncDeltas() {
    const pending = await getPendingMutations();
    if (!pending.length) {
      await this.syncAllDeltas();
      return;
    }

    const { db } = await getFirestoreClient();
    if (!db) return;

    for (const mutation of pending) {
      try {
        const docRef = db.collection(mutation.collection).doc(String(mutation.data.id));
        await docRef.set({
          ...mutation.data,
          updatedAt: getServerTimestamp()
        }, { merge: true });

        await removePendingMutation(mutation.mutationId);
      } catch (err) {
        console.warn(`[dbSync] Reintento de mutación pospuesto para ${mutation.data.id}:`, err.message);
        break; // Detener para preservar orden de operaciones
      }
    }

    await this.syncAllDeltas();
  }
}

export const dbSyncEngine = new DatabaseSyncEngine();

export default dbSyncEngine;
