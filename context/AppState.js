/**
 * context/AppState.js
 * Arquitectura de Fuente Única de Verdad (Single Source of Truth - Cloud First)
 * 
 * Reglas Estrictas:
 * 1. Cero Mocks: Sin colecciones mockeadas o datos viejos por defecto.
 * 2. Cero Cache Local de Entidades: localStorage se restringe exclusivamente a preferencias de UI (Tema).
 * 3. Paridad Total Multi-Dispositivo: El estado renderizado es el recibido directamente desde la nube (Firestore / Serverless API).
 */

export const THEME_STORAGE_KEY = 'bodeguita_ui_theme_preference';

export const InitialCloudState = {
  tasaActiva: 0,
  tasaUSD_BCV: 0,
  tasaEUR_BCV: 0,
  fechaTasaBCV: null,
  monedaSeleccionada: 'USD',
  productos: [],
  clientes: [],
  ventas: [],
  abonos: [],
  transacciones: [],
  carrito: [],
  clienteSeleccionadoId: null,
  productoImagenTemporal: '',
  conteosFisicos: {},
  auditorias: [],
  eliminaciones: [],
  clientesEliminados: [],
  usuarios: [],
  usuarioActual: null,
  premioMes: null,
  canjesPremios: [],
  nextProductSequence: 1,
  temporadaInviernoActiva: false,
  treeProgress: null
};

/**
 * Obtiene las preferencias de UI guardadas (única información permitida en localStorage)
 */
export function getStoredUIPreferences() {
  try {
    const theme = localStorage.getItem(THEME_STORAGE_KEY);
    return {
      theme: theme || 'theme-emerald'
    };
  } catch {
    return { theme: 'theme-emerald' };
  }
}

/**
 * Guarda las preferencias de UI en localStorage
 */
export function saveUIPreferences(prefs = {}) {
  try {
    if (prefs.theme) {
      localStorage.setItem(THEME_STORAGE_KEY, prefs.theme);
    }
  } catch (e) {
    console.warn('[AppState] Error guardando preferencia de tema en localStorage:', e);
  }
}

/**
 * Limpia cualquier residuo de caché obsoleto que contenga datos de negocio en localStorage
 */
export function purgeStaleEntityCaches() {
  try {
    const keysToPurge = [
      'inventoryapp.beta.v1.state',
      'inventoryapp.state',
      'bodeguita_productos',
      'bodeguita_ventas',
      'bodeguita_clientes',
      'bodeguita_usuarios'
    ];
    keysToPurge.forEach(k => localStorage.removeItem(k));
  } catch (e) {
    console.warn('[AppState] Error purgando cachés locales:', e);
  }
}

// Ejecución inmediata de limpieza de cachés locales no permitidos
if (typeof window !== 'undefined') {
  purgeStaleEntityCaches();
}

export default {
  InitialCloudState,
  getStoredUIPreferences,
  saveUIPreferences,
  purgeStaleEntityCaches
};
