/**
 * core/image-cache-service.js
 * Motor de Base de Datos Local (IndexedDB) y Caché de Alto Rendimiento para Imágenes y Catálogo
 * 
 * Funcionalidades:
 * 1. Almacenamiento en IndexedDB del navegador (sin límites de 5MB de localStorage, soporta cientos de MB).
 * 2. Guarda imágenes optimizadas de productos y avatares directamente en el dispositivo del usuario.
 * 3. Carga instantánea (0ms) en visitas recurrentes y soporte sin conexión (Modo Offline).
 * 4. Precarga inteligente en segundo plano sin consumo de red repetitivo.
 */

window.InventoryApp = window.InventoryApp || {};

(function() {
    'use strict';

    const DB_NAME = 'TuBodeguita_BrowserDB';
    const DB_VERSION = 2;
    const STORE_IMAGES = 'imagenes_cache';
    const STORE_CATALOG = 'catalogo_cache';
    const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días de persistencia local

    let dbPromise = null;
    const memoryCacheMap = new Map(); // Mapeo ultrarrápido en RAM: clave -> dataUrl / objectUrl

    /**
     * Inicializa y abre la base de datos IndexedDB del navegador
     */
    function obtenerDB() {
        if (!dbPromise) {
            dbPromise = new Promise((resolve) => {
                if (!window.indexedDB) {
                    console.warn('[ImageCache] IndexedDB no soportado en este navegador. Usando memoria temporal.');
                    resolve(null);
                    return;
                }

                const request = window.indexedDB.open(DB_NAME, DB_VERSION);

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(STORE_IMAGES)) {
                        db.createObjectStore(STORE_IMAGES, { keyPath: 'key' });
                    }
                    if (!db.objectStoreNames.contains(STORE_CATALOG)) {
                        db.createObjectStore(STORE_CATALOG, { keyPath: 'id' });
                    }
                };

                request.onsuccess = () => {
                    resolve(request.result);
                };

                request.onerror = (err) => {
                    console.warn('[ImageCache] Error al abrir IndexedDB:', err);
                    resolve(null);
                };
            });
        }
        return dbPromise;
    }

    /**
     * Guarda una imagen en la base de datos IndexedDB local
     */
    async function guardarImagen(key, dataOrBlob, contentType = 'image/webp') {
        if (!key || !dataOrBlob) return;

        // Guardar en RAM de forma inmediata para acceso sincrónico
        if (typeof dataOrBlob === 'string') {
            memoryCacheMap.set(key, dataOrBlob);
        }

        try {
            const db = await obtenerDB();
            if (!db) return;

            let dataToStore = dataOrBlob;
            let blobType = contentType;

            if (dataOrBlob instanceof Blob) {
                blobType = dataOrBlob.type || contentType;
            }

            const record = {
                key: String(key),
                data: dataToStore,
                contentType: blobType,
                timestamp: Date.now(),
                expiresAt: Date.now() + CACHE_TTL_MS
            };

            const tx = db.transaction(STORE_IMAGES, 'readwrite');
            const store = tx.objectStore(STORE_IMAGES);
            store.put(record);

        } catch (err) {
            console.warn('[ImageCache] Error guardando imagen en IndexedDB:', err);
        }
    }

    /**
     * Recupera una imagen desde la memoria RAM o IndexedDB
     */
    async function obtenerImagen(key) {
        if (!key) return null;

        // 1. Verificar si ya está en RAM
        if (memoryCacheMap.has(key)) {
            return memoryCacheMap.get(key);
        }

        // 2. Consultar IndexedDB
        try {
            const db = await obtenerDB();
            if (db) {
                const record = await new Promise((resolve) => {
                    const tx = db.transaction(STORE_IMAGES, 'readonly');
                    const store = tx.objectStore(STORE_IMAGES);
                    const req = store.get(String(key));
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => resolve(null);
                });

                if (record && record.data) {
                    let resultSrc = record.data;
                    if (record.data instanceof Blob) {
                        resultSrc = URL.createObjectURL(record.data);
                    }
                    memoryCacheMap.set(key, resultSrc);
                    return resultSrc;
                }
            }
        } catch (e) {
            console.warn('[ImageCache] Error obteniendo imagen de IndexedDB:', e);
        }

        return null;
    }

    /**
     * Obtiene una URL o Data URL con respaldo de caché local
     */
    async function obtenerUrlConCache(url, fallback = '') {
        if (!url) return fallback;

        // Normalizar si viniera de alguna ruta anterior
        if (typeof normalizarUrlBlob === 'function') {
            url = normalizarUrlBlob(url);
        }

        // Si es emoji o preset muy corto
        if (url.length < 10 || (!url.startsWith('http') && !url.startsWith('data:') && !url.startsWith('/api/'))) {
            return url;
        }

        // Si ya está en RAM
        if (memoryCacheMap.has(url)) {
            return memoryCacheMap.get(url);
        }

        // Si es una dataURL válida, guardarla de inmediato en IndexedDB para no perderla
        if (url.startsWith('data:')) {
            guardarImagen(url, url).catch(() => {});
            memoryCacheMap.set(url, url);
            return url;
        }

        // Consultar IndexedDB
        const localCached = await obtenerImagen(url);
        if (localCached) {
            return localCached;
        }

        // Si es URL externa de red, descargar una sola vez y almacenar en IndexedDB
        if (url.startsWith('http://') || url.startsWith('https://')) {
            try {
                const res = await fetch(url, { mode: 'cors', cache: 'default' });
                if (res.ok) {
                    const blob = await res.blob();
                    await guardarImagen(url, blob, blob.type);
                    const objUrl = URL.createObjectURL(blob);
                    memoryCacheMap.set(url, objUrl);
                    return objUrl;
                }
            } catch (netErr) {
                console.warn('[ImageCache] Aviso descargando imagen externa:', netErr.message);
            }
        }

        return url;
    }

    /**
     * Aplica la imagen al elemento <img> usando lectura instantánea de IndexedDB/RAM
     */
    async function aplicarImagenConCache(imgElement, keyOrUrl, fallback = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=60') {
        if (!imgElement) return;

        if (!keyOrUrl) {
            imgElement.src = fallback;
            return;
        }

        // Carga inmediata si está en memoria RAM
        if (memoryCacheMap.has(keyOrUrl)) {
            imgElement.src = memoryCacheMap.get(keyOrUrl);
            return;
        }

        // Si es una Data URL directa, asignarla al instante
        if (typeof keyOrUrl === 'string' && keyOrUrl.startsWith('data:')) {
            imgElement.src = keyOrUrl;
            memoryCacheMap.set(keyOrUrl, keyOrUrl);
            guardarImagen(keyOrUrl, keyOrUrl).catch(() => {});
            return;
        }

        // Buscar en IndexedDB
        try {
            const cached = await obtenerUrlConCache(keyOrUrl, fallback);
            if (imgElement) {
                imgElement.src = cached || fallback;
            }
        } catch {
            if (imgElement) imgElement.src = fallback;
        }
    }

    /**
     * Guarda el catálogo completo de productos localmente en IndexedDB para carga instantánea
     */
    async function guardarCatalogoLocal(productos = []) {
        if (!Array.isArray(productos)) return;
        try {
            const db = await obtenerDB();
            if (!db) return;

            const record = {
                id: 'productos_actuales',
                items: productos,
                total: productos.length,
                timestamp: Date.now()
            };

            const tx = db.transaction(STORE_CATALOG, 'readwrite');
            const store = tx.objectStore(STORE_CATALOG);
            store.put(record);

            // Almacenar también individualmente las imágenes en IndexedDB
            productos.forEach(p => {
                if (p && p.imagen && p.imagen.startsWith('data:')) {
                    guardarImagen(`prod_${p.id}`, p.imagen).catch(() => {});
                    guardarImagen(p.imagen, p.imagen).catch(() => {});
                }
            });
        } catch (e) {
            console.warn('[ImageCache] Error guardando catálogo en IndexedDB:', e);
        }
    }

    /**
     * Recupera el catálogo de productos local desde IndexedDB
     */
    async function obtenerCatalogoLocal() {
        try {
            const db = await obtenerDB();
            if (!db) return null;

            const record = await new Promise((resolve) => {
                const tx = db.transaction(STORE_CATALOG, 'readonly');
                const store = tx.objectStore(STORE_CATALOG);
                const req = store.get('productos_actuales');
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => resolve(null);
            });

            if (record && Array.isArray(record.items)) {
                return record.items;
            }
        } catch (e) {
            console.warn('[ImageCache] Error leyendo catálogo local:', e);
        }
        return null;
    }

    /**
     * Precarga en segundo plano las imágenes para asegurar que todo esté en IndexedDB
     */
    function precargarImagenes(urls = []) {
        if (!Array.isArray(urls) || urls.length === 0) return;

        const ejecutarPrecarga = () => {
            urls.forEach(url => {
                if (url && (url.startsWith('http') || url.startsWith('data:'))) {
                    obtenerUrlConCache(url).catch(() => {});
                }
            });
        };

        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(ejecutarPrecarga, { timeout: 4000 });
        } else {
            setTimeout(ejecutarPrecarga, 1500);
        }
    }

    /**
     * Limpia la base de datos local IndexedDB
     */
    async function limpiarCacheLocal() {
        try {
            const db = await obtenerDB();
            if (db) {
                const tx = db.transaction([STORE_IMAGES, STORE_CATALOG], 'readwrite');
                tx.objectStore(STORE_IMAGES).clear();
                tx.objectStore(STORE_CATALOG).clear();
            }
            memoryCacheMap.clear();
            console.log('[ImageCache] Base de datos local (IndexedDB) limpiada con éxito.');
            return true;
        } catch (e) {
            console.warn('[ImageCache] Error limpiando IndexedDB:', e);
            return false;
        }
    }

    /**
     * Obtiene estadísticas del uso de almacenamiento en IndexedDB
     */
    async function obtenerEstadisticasCache() {
        try {
            const db = await obtenerDB();
            if (!db) return { totalImagenes: 0, itemsEnMemoria: memoryCacheMap.size };

            const total = await new Promise((resolve) => {
                const tx = db.transaction(STORE_IMAGES, 'readonly');
                const req = tx.objectStore(STORE_IMAGES).count();
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => resolve(0);
            });

            return {
                totalImagenes: total,
                itemsEnMemoria: memoryCacheMap.size,
                tipo: 'IndexedDB (Almacenamiento Local del Navegador)'
            };
        } catch {
            return { totalImagenes: 0, itemsEnMemoria: memoryCacheMap.size, tipo: 'IndexedDB' };
        }
    }

    /**
     * Función de compatibilidad transparente (sustituye subida a Vercel Blob)
     * Procesa y almacena directamente en IndexedDB
     */
    async function subirImagenVercelBlob(fileOrDataUrl, folder = 'productos', filename = '') {
        if (!fileOrDataUrl) return { success: true, url: '' };

        let dataUrlResult = fileOrDataUrl;
        if (fileOrDataUrl instanceof File || fileOrDataUrl instanceof Blob) {
            dataUrlResult = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => resolve('');
                reader.readAsDataURL(fileOrDataUrl);
            });
        }

        const cleanKey = filename || `${folder}_${Date.now()}`;
        if (dataUrlResult && typeof dataUrlResult === 'string') {
            await guardarImagen(cleanKey, dataUrlResult);
            await guardarImagen(dataUrlResult, dataUrlResult);
        }

        return {
            success: true,
            url: dataUrlResult,
            viewUrl: dataUrlResult,
            pathname: cleanKey,
            provider: 'indexeddb'
        };
    }

    // Exportar módulo en el espacio de nombres de la aplicación
    window.InventoryApp.ImageCache = {
        guardarImagen,
        obtenerImagen,
        guardarEnCacheLocal: guardarImagen,
        obtenerUrlConCache,
        aplicarImagenConCache,
        guardarCatalogoLocal,
        obtenerCatalogoLocal,
        precargarImagenes,
        limpiarCacheLocal,
        obtenerEstadisticasCache,
        subirImagenVercelBlob
    };

    window.InventoryApp.BlobStorage = window.InventoryApp.ImageCache;

})();
