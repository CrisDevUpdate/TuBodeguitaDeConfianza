/**
 * /lib/firebaseClient.js
 * Configuración e inicialización de Firebase Client con persistencia nativa IndexedDB
 * Estrategia Zero-Reads / Zero-Tokens para paridad Cloud Firestore.
 */

import firebaseConfigData from '../firebase-applet-config.json' with { type: 'json' };

export const FIREBASE_CONFIG = firebaseConfigData || {
  projectId: "tubodeguitadeconfianza",
  appId: "1:851659747065:web:175908dcd4bb4c68af7c28",
  apiKey: "AIzaSyD0_dbHio6HBwmUJZnjRT6yg40SVvkHsfA",
  authDomain: "tubodeguitadeconfianza.firebaseapp.com",
  firestoreDatabaseId: "(default)",
  storageBucket: "tubodeguitadeconfianza.firebasestorage.app"
};

export const COLLECTIONS = Object.freeze({
  USERS: 'users',
  PRODUCTS: 'products',
  SALES_HISTORY: 'sales_history',
  PAYMENTS_AND_CREDITS: 'payments_and_credits',
  AUDIT_LOGS: 'audit_logs',
  NOTIFICATIONS: 'notifications'
});

let firebaseApp = null;
let firestoreDb = null;
let persistenceEnabled = false;

/**
 * Inicializa la aplicación de Firebase y habilita persistencia offline nativa
 */
export async function getFirestoreClient() {
  if (firestoreDb) {
    return { app: firebaseApp, db: firestoreDb };
  }

  // Compatibilidad tanto con scripts globales de window.firebase como con imports modulares
  const fb = (typeof window !== 'undefined' && window.firebase) ? window.firebase : null;

  if (!fb) {
    console.warn('[firebaseClient] SDK de Firebase no detectado en el entorno global. Operando en fallback offline.');
    return { app: null, db: null };
  }

  if (!fb.apps || !fb.apps.length) {
    firebaseApp = fb.initializeApp(FIREBASE_CONFIG);
  } else {
    firebaseApp = fb.apps[0];
  }

  const databaseId = FIREBASE_CONFIG.firestoreDatabaseId;
  if (databaseId && databaseId !== '(default)' && typeof firebaseApp.firestore === 'function') {
    try {
      firestoreDb = firebaseApp.firestore(databaseId);
    } catch {
      firestoreDb = fb.firestore();
    }
  } else {
    firestoreDb = fb.firestore();
  }

  // Activa enableIndexedDbPersistence para la caché nativa en el navegador
  if (!persistenceEnabled && firestoreDb && typeof firestoreDb.enablePersistence === 'function') {
    try {
      await firestoreDb.enablePersistence({ synchronizeTabs: true });
      persistenceEnabled = true;
      console.log('[firebaseClient] Persistencia nativa IndexedDbPersistence activada exitosamente.');
    } catch (err) {
      if (err.code === 'failed-precondition') {
        console.warn('[firebaseClient] Múltiples pestañas abiertas; persistencia restringida a pestaña líder.');
      } else if (err.code === 'unimplemented') {
        console.warn('[firebaseClient] El navegador actual no soporta IndexedDbPersistence de Firestore.');
      } else {
        console.warn('[firebaseClient] Estado de persistencia nativa:', err.message);
      }
    }
  }

  return { app: firebaseApp, db: firestoreDb };
}

/**
 * Genera el Timestamp del servidor para escrituras
 */
export function getServerTimestamp() {
  if (typeof window !== 'undefined' && window.firebase?.firestore?.FieldValue) {
    return window.firebase.firestore.FieldValue.serverTimestamp();
  }
  return new Date().toISOString();
}

export default {
  FIREBASE_CONFIG,
  COLLECTIONS,
  getFirestoreClient,
  getServerTimestamp
};
