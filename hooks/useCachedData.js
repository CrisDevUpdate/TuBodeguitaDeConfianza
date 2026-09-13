/**
 * /hooks/useCachedData.js
 * Wrapper y hooks especializados para consumo selectivo de colecciones en caché.
 */

import { useAppData } from './useAppData.js';

export function useCachedData() {
  return useAppData();
}

export function useProducts() {
  const { products, saveProduct, resolveMedia, isSyncing, isOnline } = useAppData();
  return { products, saveProduct, resolveMedia, isSyncing, isOnline };
}

export function useUsers() {
  const { users, saveUser, isSyncing, isOnline } = useAppData();
  return { users, saveUser, isSyncing, isOnline };
}

export function useSales() {
  const { salesHistory, recordSale, isSyncing, isOnline } = useAppData();
  return { salesHistory, recordSale, isSyncing, isOnline };
}

export function usePayments() {
  const { paymentsAndCredits, savePayment, isSyncing, isOnline } = useAppData();
  return { paymentsAndCredits, savePayment, isSyncing, isOnline };
}

export function useAuditLogs() {
  const { auditLogs, saveAuditLog, isSyncing, isOnline } = useAppData();
  return { auditLogs, saveAuditLog, isSyncing, isOnline };
}

export function useNotifications() {
  const { notifications, saveNotification, isSyncing, isOnline } = useAppData();
  return { notifications, saveNotification, isSyncing, isOnline };
}

export default useCachedData;
