/**
 * /lib/firebaseSync.js
 * Motor de Sincronización Bidireccional Firestore con Prevención de Bucles Infinitos,
 * Control de Dependencias Estricto, Debounce de Renderizado y Segregación RBAC.
 */

class FirebaseSyncManager {
  constructor() {
    this.db = null;
    this.isInitialized = false;
    this.syncListeners = [];
    this.isSyncing = false;
    this.lastSyncTimestamp = null;
    this.debounceTimer = null;
    this.statusListeners = new Set();
    this.currentStatus = 'offline'; // 'conectado' | 'sincronizando' | 'offline' | 'error'
    this.lastPayloadHash = {};
  }

  /**
   * Inicializa la conexión segura con Firestore y previene listeners duplicados
   */
  async initialize(firebaseApp, firestoreInstance) {
    if (this.isInitialized && this.db) return true;

    try {
      this.db = firestoreInstance || (firebaseApp ? firebaseApp.firestore() : null);
      if (!this.db && typeof window !== 'undefined' && window.firebase?.firestore) {
        this.db = window.firebase.firestore();
      }

      if (!this.db) {
        this.updateStatus('offline', 'Modo Offline (Almacenamiento Local)');
        return false;
      }

      this.isInitialized = true;
      this.updateStatus('conectado', 'Sincronizado con Firestore');
      return true;
    } catch (err) {
      console.error('[FirebaseSync] Error en inicialización:', err);
      this.updateStatus('offline', 'Error de conexión / Modo Offline');
      return false;
    }
  }

  /**
   * Suscribe escuchadores en tiempo real con filtrado de escrituras locales (hasPendingWrites)
   * y control de redundancia para evitar re-renderizados continuos.
   */
  attachCollectionListener(collectionName, onDataReceived) {
    if (!this.db) return () => {};

    try {
      const unsubscribe = this.db.collection(collectionName).onSnapshot(
        snapshot => {
          // Ignorar eventos que provienen de escrituras locales pendientes en el cliente
          if (snapshot.metadata && snapshot.metadata.hasPendingWrites) {
            return;
          }

          const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const currentHash = JSON.stringify(docs.map(d => ({ id: d.id, updatedAt: d.updatedAt || d.id })));

          // Evitar bucle si los datos recibidos no cambiaron
          if (this.lastPayloadHash[collectionName] === currentHash) {
            return;
          }
          this.lastPayloadHash[collectionName] = currentHash;

          this.debouncedExecution(() => {
            if (typeof onDataReceived === 'function') {
              onDataReceived(docs);
            }
            this.updateStatus('conectado', 'Sincronizado con Firestore');
          }, 300);
        },
        err => {
          console.warn(`[FirebaseSync] Aviso en listener de ${collectionName}:`, err.message);
        }
      );

      this.syncListeners.push(unsubscribe);
      return unsubscribe;
    } catch (e) {
      console.warn(`[FirebaseSync] No se pudo adjuntar listener a ${collectionName}:`, e);
      return () => {};
    }
  }

  /**
   * Limpia todos los listeners activos al desmontar componentes o cambiar de sesión
   */
  detachAllListeners() {
    this.syncListeners.forEach(unsub => {
      try {
        if (typeof unsub === 'function') unsub();
      } catch (e) {}
    });
    this.syncListeners = [];
    this.lastPayloadHash = {};
  }

  /**
   * Debounce genérico para agrupar múltiples eventos de base de datos en un único ciclo de UI
   */
  debouncedExecution(fn, delay = 300) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      fn();
      this.debounceTimer = null;
    }, delay);
  }

  /**
   * Actualiza el estado visual de la nube y notifica a los componentes suscritos
   */
  updateStatus(status, label) {
    this.currentStatus = status;
    this.statusListeners.forEach(listener => {
      try {
        listener(status, label);
      } catch (e) {}
    });

    if (typeof document !== 'undefined') {
      const badge = document.getElementById('persistencia-status');
      const text = document.getElementById('persistencia-texto');
      if (badge && text) {
        badge.className = `persistence-status ${status}`;
        text.textContent = label || status;
      }
    }
  }

  onStatusChange(callback) {
    this.statusListeners.add(callback);
    return () => this.statusListeners.delete(callback);
  }

  /**
   * Verificación de Seguridad RBAC para operaciones de Nube
   */
  canAccessCloudModule(user) {
    if (!user) return false;
    const rol = (user.rol || '').toLowerCase();
    return (rol === 'admin' || rol === 'superadmin') && user.estado === 'ACTIVO';
  }
}

export const firebaseSync = new FirebaseSyncManager();
export default firebaseSync;
