/**
 * /hooks/useAppData.js
 * Hook de Consumo Global con Arquitectura Zero-Loading y Modo Offline.
 * Unifica el estado reactivo, la indexación local agresiva y la caché multimedia.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dbSyncEngine from '../lib/dbSync.js';
import { COLLECTIONS } from '../lib/firebaseClient.js';
import {
  getLocalCollection,
  getPendingMutations,
  getOrCacheMediaUrl
} from '../lib/offlineStorage.js';

export function useAppData() {
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [salesHistory, setSalesHistory] = useState([]);
  const [paymentsAndCredits, setPaymentsAndCredits] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isHydrated, setIsHydrated] = useState(false);

  // 1. Carga Inicial Ultra-Rápida (Zero-Loading State vía IndexedDB)
  const hydrateAll = useCallback(async () => {
    try {
      const [u, p, s, pay, a, n] = await Promise.all([
        getLocalCollection(COLLECTIONS.USERS),
        getLocalCollection(COLLECTIONS.PRODUCTS),
        getLocalCollection(COLLECTIONS.SALES_HISTORY),
        getLocalCollection(COLLECTIONS.PAYMENTS_AND_CREDITS),
        getLocalCollection(COLLECTIONS.AUDIT_LOGS),
        getLocalCollection(COLLECTIONS.NOTIFICATIONS)
      ]);

      if (u.length) setUsers(u);
      if (p.length) setProducts(p);
      if (s.length) setSalesHistory(s);
      if (pay.length) setPaymentsAndCredits(pay);
      if (a.length) setAuditLogs(a);
      if (n.length) setNotifications(n);

      setIsHydrated(true);

      // Si las colecciones estaban vacías, ejecutar la hidratación con snapshot
      if (!p.length) {
        dbSyncEngine.hydrateCollection(COLLECTIONS.PRODUCTS).then(setProducts);
      }
      if (!u.length) {
        dbSyncEngine.hydrateCollection(COLLECTIONS.USERS).then(setUsers);
      }
      if (!s.length) {
        dbSyncEngine.hydrateCollection(COLLECTIONS.SALES_HISTORY).then(setSalesHistory);
      }
      if (!pay.length) {
        dbSyncEngine.hydrateCollection(COLLECTIONS.PAYMENTS_AND_CREDITS).then(setPaymentsAndCredits);
      }
      if (!a.length) {
        dbSyncEngine.hydrateCollection(COLLECTIONS.AUDIT_LOGS).then(setAuditLogs);
      }
      if (!n.length) {
        dbSyncEngine.hydrateCollection(COLLECTIONS.NOTIFICATIONS).then(setNotifications);
      }

      // Conteo de mutaciones en cola outbox
      const pending = await getPendingMutations();
      setPendingCount(pending.length);
    } catch (err) {
      console.warn('[useAppData] Fallback de hidratación local:', err);
    }
  }, []);

  useEffect(() => {
    hydrateAll();

    // Suscripción reactiva a eventos del motor de sincronización
    const unsubscribe = dbSyncEngine.subscribe((event, payload) => {
      if (event === 'status_change') {
        setIsSyncing(payload === 'syncing');
      } else if (event === 'data_updated') {
        const { collection, item, items } = payload;
        const updateStateMap = {
          [COLLECTIONS.USERS]: setUsers,
          [COLLECTIONS.PRODUCTS]: setProducts,
          [COLLECTIONS.SALES_HISTORY]: setSalesHistory,
          [COLLECTIONS.PAYMENTS_AND_CREDITS]: setPaymentsAndCredits,
          [COLLECTIONS.AUDIT_LOGS]: setAuditLogs,
          [COLLECTIONS.NOTIFICATIONS]: setNotifications
        };

        const stateSetter = updateStateMap[collection];
        if (stateSetter) {
          if (items) {
            stateSetter(prev => {
              const map = new Map(prev.map(doc => [doc.id, doc]));
              items.forEach(doc => map.set(doc.id, doc));
              return Array.from(map.values());
            });
          } else if (item) {
            stateSetter(prev => {
              const index = prev.findIndex(doc => doc.id === item.id);
              if (index >= 0) {
                const next = [...prev];
                next[index] = item;
                return next;
              }
              return [item, ...prev];
            });
          }
        }
      }
    });

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [hydrateAll]);

  // 2. Mutaciones Optimistas con Paridad en Cloud Firestore
  const mutateEntity = useCallback(async (collection, action, docData) => {
    const saved = await dbSyncEngine.mutate(collection, action, docData);
    const pending = await getPendingMutations();
    setPendingCount(pending.length);
    return saved;
  }, []);

  const saveProduct = useCallback((product) => {
    return mutateEntity(COLLECTIONS.PRODUCTS, 'SAVE', product);
  }, [mutateEntity]);

  const recordSale = useCallback((sale) => {
    return mutateEntity(COLLECTIONS.SALES_HISTORY, 'CREATE', sale);
  }, [mutateEntity]);

  const savePayment = useCallback((payment) => {
    return mutateEntity(COLLECTIONS.PAYMENTS_AND_CREDITS, 'SAVE', payment);
  }, [mutateEntity]);

  const saveAuditLog = useCallback((audit) => {
    return mutateEntity(COLLECTIONS.AUDIT_LOGS, 'CREATE', audit);
  }, [mutateEntity]);

  const saveNotification = useCallback((notification) => {
    return mutateEntity(COLLECTIONS.NOTIFICATIONS, 'CREATE', notification);
  }, [mutateEntity]);

  const saveUser = useCallback((user) => {
    return mutateEntity(COLLECTIONS.USERS, 'SAVE', user);
  }, [mutateEntity]);

  // 3. Resolución y Caché de Media Vercel Blob
  const resolveMedia = useCallback(async (url) => {
    return await getOrCacheMediaUrl(url);
  }, []);

  return {
    // Entidades del Sistema (Persistencia Total)
    users,
    products,
    salesHistory,
    paymentsAndCredits,
    auditLogs,
    notifications,

    // Estados de Conectividad y Sincronización
    isOnline,
    isSyncing,
    pendingCount,
    isHydrated,

    // Métodos de Mutación Optimista
    saveProduct,
    recordSale,
    savePayment,
    saveAuditLog,
    saveNotification,
    saveUser,

    // Optimización Multimedia
    resolveMedia,
    refreshDeltas: () => dbSyncEngine.syncAllDeltas()
  };
}

export default useAppData;
