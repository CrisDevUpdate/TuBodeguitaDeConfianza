/**
 * core/image-cache-service.js
 * Arquitectura de Almacenamiento Híbrido: Vercel Blob + Firestore + Cache Local
 * 
 * Funcionalidades:
 * 1. Subida segura a Vercel Blob (@vercel/blob) vía endpoint `/api/upload/blob`.
 * 2. Persistencia en Firestore: Solo URLs livianas (ahorro masivo de espacio en BD).
 * 3. Caché de Alto Rendimiento en IndexedDB / LocalStorage: Lectura prioritaria local,
 *    cero peticiones repetidas a la red, minimizando costos y solicitudes a la API.
 */

window.InventoryApp = window.InventoryApp || {};

(function() {
    'use strict';

    const DB_NAME = 'TuBodeguita_BlobCache_DB';
    const DB_VERSION = 1;
    const STORE_NAME = 'cached_images';
    const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días de vigencia de caché

    let dbPromise = null;
    const memoryBlobUrlMap = new Map(); // Mapeo en memoria de URL -> ObjectURL

    /**
     * Inicializa la base de datos IndexedDB para almacenamiento de imágenes binarias
     */
    function obtenerDB() {
        if (!dbPromise) {
            dbPromise = new Promise((resolve, reject) => {
                if (!window.indexedDB) {
                    console.warn('[ImageCache] IndexedDB no soportado en este navegador. Usando memoria/localStorage.');
                    resolve(null);
                    return;
                }

                const request = window.indexedDB.open(DB_NAME, DB_VERSION);

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME, { keyPath: 'url' });
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
     * Guarda una imagen en el caché local (IndexedDB)
     */
    async function guardarEnCacheLocal(url, blobOrDataUrl, contentType = 'image/webp') {
        if (!url) return;

        try {
            const db = await obtenerDB();
            if (!db) {
                // Fallback a localStorage si es texto dataURL corto
                if (typeof blobOrDataUrl === 'string' && blobOrDataUrl.length < 500000) {
                    try {
                        localStorage.setItem(`img_cache_${btoa(url).substring(0, 32)}`, blobOrDataUrl);
                    } catch (e) {
                        console.warn('[ImageCache] LocalStorage lleno');
                    }
                }
                return;
            }

            let blobToStore;
            if (blobOrDataUrl instanceof Blob) {
                blobToStore = blobOrDataUrl;
            } else if (typeof blobOrDataUrl === 'string' && blobOrDataUrl.startsWith('data:')) {
                const parts = blobOrDataUrl.split(',');
                const mime = parts[0].match(/:(.*?);/)?.[1] || contentType;
                const binary = atob(parts[1]);
                const array = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                    array[i] = binary.charCodeAt(i);
                }
                blobToStore = new Blob([array], { type: mime });
            } else {
                return;
            }

            const record = {
                url: url,
                blob: blobToStore,
                contentType: blobToStore.type || contentType,
                timestamp: Date.now(),
                expiresAt: Date.now() + CACHE_TTL_MS
            };

            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.put(record);

            // Crear y memorizar ObjectURL
            if (memoryBlobUrlMap.has(url)) {
                URL.revokeObjectURL(memoryBlobUrlMap.get(url));
            }
            const objectUrl = URL.createObjectURL(blobToStore);
            memoryBlobUrlMap.set(url, objectUrl);

        } catch (err) {
            console.warn('[ImageCache] Error guardando en caché local:', err);
        }
    }

    /**
     * Obtiene una imagen desde el caché local; si no existe, la descarga y la almacena
     */
    async function obtenerUrlConCache(url, fallback = '') {
        if (!url) return fallback;

        // Normalizar URLs privadas de Vercel Blob para que no den error 403
        if (typeof normalizarUrlBlob === 'function') {
            url = normalizarUrlBlob(url);
        }

        // Si es un emoji o preset corto
        if (url.length < 10 || (!url.startsWith('http') && !url.startsWith('data:') && !url.startsWith('/api/'))) {
            return url;
        }

        // Si ya tenemos un ObjectURL activo en memoria para esta URL
        if (memoryBlobUrlMap.has(url)) {
            return memoryBlobUrlMap.get(url);
        }

        // 1. Consultar IndexedDB local
        try {
            const db = await obtenerDB();
            if (db) {
                const cachedRecord = await new Promise((resolve) => {
                    const tx = db.transaction(STORE_NAME, 'readonly');
                    const store = tx.objectStore(STORE_NAME);
                    const req = store.get(url);
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => resolve(null);
                });

                if (cachedRecord && cachedRecord.blob && cachedRecord.expiresAt > Date.now()) {
                    const objUrl = URL.createObjectURL(cachedRecord.blob);
                    memoryBlobUrlMap.set(url, objUrl);
                    return objUrl;
                }
            }
        } catch (e) {
            console.warn('[ImageCache] Error leyendo caché local:', e);
        }

        // Si es DataURL, guardarlo en caché y retornarlo
        if (url.startsWith('data:')) {
            guardarEnCacheLocal(url, url).catch(() => {});
            return url;
        }

        // 2. Si no está en caché o expiró, descargar una sola vez de la red y guardar en caché local
        try {
            const res = await fetch(url, { mode: 'cors', cache: 'default' });
            if (res.ok) {
                const blob = await res.blob();
                await guardarEnCacheLocal(url, blob, blob.type);
                if (memoryBlobUrlMap.has(url)) {
                    return memoryBlobUrlMap.get(url);
                }
            }
        } catch (netErr) {
            console.warn('[ImageCache] Fallo al descargar imagen de red, usando URL directa:', netErr.message);
        }

        return url;
    }

    /**
     * Aplica de forma optimizada una imagen a un elemento <img> utilizando el caché local prioritario
     */
    async function aplicarImagenConCache(imgElement, url, fallback = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=60') {
        if (!imgElement) return;

        if (!url) {
            imgElement.src = fallback;
            return;
        }

        // Si es emoji o preset
        if (!url.startsWith('http') && !url.startsWith('data:')) {
            imgElement.src = fallback;
            return;
        }

        // Cargar instantáneamente desde memoria si está listo
        if (memoryBlobUrlMap.has(url)) {
            imgElement.src = memoryBlobUrlMap.get(url);
            return;
        }

        // Resolver vía caché local con transición suave
        try {
            const cachedSrc = await obtenerUrlConCache(url, fallback);
            if (imgElement) {
                imgElement.src = cachedSrc;
            }
        } catch {
            if (imgElement) imgElement.src = fallback;
        }
    }

    /**
     * Sube un archivo / imagen a Vercel Blob (@vercel/blob) a través del backend seguro
     * y la almacena inmediatamente en el caché local.
     */
    async function subirImagenVercelBlob(fileOrDataUrl, folder = 'productos', filename = '') {
        if (!fileOrDataUrl) throw new Error('Se requiere un archivo o Data URL para subir.');

        // Si ya es una URL persistida en Vercel Blob o web
        if (typeof fileOrDataUrl === 'string' && (
            fileOrDataUrl.startsWith('http://') || 
            fileOrDataUrl.startsWith('https://') || 
            fileOrDataUrl.startsWith('/api/blob/view') || 
            fileOrDataUrl.startsWith('/api/avatar/view')
        )) {
            return { url: fileOrDataUrl, pathname: fileOrDataUrl, viewUrl: fileOrDataUrl, provider: 'vercel-blob' };
        }

        let blobToSend = null;
        let dataUrlString = null;
        let contentType = 'image/webp';
        let cleanFilename = filename ? String(filename).replace(/\\/g, '/').replace(/^\/+/, '') : '';

        // Extraer formato y preparar tanto blob binario como dataUrl para máxima compatibilidad
        if (fileOrDataUrl instanceof File) {
            blobToSend = fileOrDataUrl;
            contentType = fileOrDataUrl.type || 'image/webp';
            if (!cleanFilename) {
                cleanFilename = `${folder}/${fileOrDataUrl.name || `file_${Date.now()}.webp`}`;
            }
            try {
                dataUrlString = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(fileOrDataUrl);
                });
            } catch (e) {
                dataUrlString = null;
            }
        } else if (fileOrDataUrl instanceof Blob) {
            blobToSend = fileOrDataUrl;
            contentType = fileOrDataUrl.type || 'image/webp';
            if (!cleanFilename) {
                const ext = contentType.includes('png') ? 'png' : contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'webp';
                cleanFilename = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${ext}`;
            }
            try {
                dataUrlString = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(fileOrDataUrl);
                });
            } catch (e) {
                dataUrlString = null;
            }
        } else if (typeof fileOrDataUrl === 'string' && fileOrDataUrl.startsWith('data:')) {
            dataUrlString = fileOrDataUrl;
            try {
                const parts = fileOrDataUrl.split(',');
                const mimeMatch = parts[0].match(/:(.*?);/);
                contentType = mimeMatch ? mimeMatch[1] : 'image/webp';
                const bstr = atob(parts[1]);
                let n = bstr.length;
                const u8arr = new Uint8Array(n);
                while (n--) {
                    u8arr[n] = bstr.charCodeAt(n);
                }
                blobToSend = new Blob([u8arr], { type: contentType });
            } catch (atobErr) {
                console.warn('[ImageCache] Decodificación binaria en cliente omitida:', atobErr.message);
                blobToSend = null;
            }
            if (!cleanFilename) {
                const ext = contentType.includes('png') ? 'png' : contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'webp';
                cleanFilename = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${ext}`;
            }
        }

        // Asegurar prefijo de carpeta sin duplicaciones
        cleanFilename = String(cleanFilename).replace(/\\/g, '/').replace(/^\/+/, '');
        if (folder && !cleanFilename.includes('/')) {
            cleanFilename = `${folder}/${cleanFilename}`;
        }
        cleanFilename = cleanFilename.replace(/^(productos\/)+/, 'productos/').replace(/^(uploads\/)+/, 'uploads/');

        const headers = {};
        const savedToken = localStorage.getItem('bodeguita_blob_token');
        if (savedToken) {
            if (savedToken.startsWith('vercel_blob_rw_')) {
                headers['x-blob-token'] = savedToken;
            } else {
                localStorage.removeItem('bodeguita_blob_token');
            }
        }

        const endpoints = ['/api/blob/upload', '/api/upload/blob', '/api/avatar/upload'];
        let response = null;
        let lastErrorText = '';

        // Función auxiliar para intentar una subida específica
        const intentarSubida = async (endpoint, useJson, customHeaders = {}) => {
            const urlConQuery = `${endpoint}?filename=${encodeURIComponent(cleanFilename)}`;
            if (useJson && dataUrlString) {
                return await fetch(urlConQuery, {
                    method: 'POST',
                    headers: {
                        ...customHeaders,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        fileData: dataUrlString,
                        contentType: contentType,
                        filename: cleanFilename,
                        folder: folder
                    })
                });
            } else if (blobToSend) {
                return await fetch(urlConQuery, {
                    method: 'POST',
                    headers: {
                        ...customHeaders,
                        'Content-Type': contentType
                    },
                    body: blobToSend
                });
            }
            return null;
        };

        // Ciclo 1: Intentar en cada endpoint disponible, primero con JSON (más robusto contra problemas de red/iframe), luego con binario
        for (const ep of endpoints) {
            try {
                // Intento JSON primero
                if (dataUrlString) {
                    response = await intentarSubida(ep, true, headers);
                    if (response && response.ok) break;
                }
                // Intento binario si JSON no tuvo éxito
                if ((!response || !response.ok) && blobToSend) {
                    response = await intentarSubida(ep, false, headers);
                    if (response && response.ok) break;
                }
            } catch (networkErr) {
                console.warn(`[ImageCache] Error de red en ${ep}:`, networkErr.message);
                lastErrorText = networkErr.message;
            }
        }

        // Ciclo 2: Si falló y teníamos token local, remover token y reintentar con el token maestro del servidor
        if ((!response || !response.ok) && headers['x-blob-token']) {
            console.warn('[ImageCache] Reintentando subida con token maestro del servidor...');
            try { localStorage.removeItem('bodeguita_blob_token'); } catch (e) {}

            for (const ep of endpoints) {
                try {
                    if (dataUrlString) {
                        response = await intentarSubida(ep, true, {});
                        if (response && response.ok) break;
                    }
                    if ((!response || !response.ok) && blobToSend) {
                        response = await intentarSubida(ep, false, {});
                        if (response && response.ok) break;
                    }
                } catch (netErr) {
                    console.warn(`[ImageCache] Fallo en reintento en ${ep}:`, netErr.message);
                }
            }
        }

        if (!response || !response.ok) {
            const errText = response ? await response.text() : (lastErrorText || 'Sin respuesta del servidor de subida');
            throw new Error(`Error en servidor de subida: ${errText}`);
        }

        const newBlob = await response.json();
        const finalUrl = newBlob.viewUrl || (newBlob.pathname ? `/api/blob/view?pathname=${encodeURIComponent(newBlob.pathname)}` : newBlob.url) || newBlob.downloadUrl;

        // Guardar de inmediato en el caché local para evitar cualquier descarga futura
        if (blobToSend) {
            await guardarEnCacheLocal(finalUrl, blobToSend, contentType);
            if (newBlob.pathname) {
                const blobViewUrl = `/api/blob/view?pathname=${encodeURIComponent(newBlob.pathname)}`;
                const avatarViewUrl = `/api/avatar/view?pathname=${encodeURIComponent(newBlob.pathname)}`;
                await guardarEnCacheLocal(blobViewUrl, blobToSend, contentType);
                await guardarEnCacheLocal(avatarViewUrl, blobToSend, contentType);
            }
        }

        if (newBlob.provider === 'vercel-blob') {
            console.log(`[Vercel Blob] Imagen almacenada con éxito en la nube de Vercel: ${finalUrl}`);
        } else {
            console.warn(`[Almacén Local Fallback] Imagen guardada en almacenamiento local (${finalUrl}). Causa: ${newBlob.blobError || newBlob.notice}`);
        }

        return {
            success: true,
            url: finalUrl,
            pathname: newBlob.pathname,
            viewUrl: finalUrl,
            blobUrl: newBlob.url || '',
            provider: newBlob.provider
        };
    }

    /**
     * Precarga en segundo plano una lista de URLs de imágenes para poblar el caché local
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
            window.requestIdleCallback(ejecutarPrecarga, { timeout: 3000 });
        } else {
            setTimeout(ejecutarPrecarga, 1000);
        }
    }

    /**
     * Limpia el almacenamiento en caché local
     */
    async function limpiarCacheLocal() {
        try {
            const db = await obtenerDB();
            if (db) {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                tx.objectStore(STORE_NAME).clear();
            }
            memoryBlobUrlMap.forEach(url => URL.revokeObjectURL(url));
            memoryBlobUrlMap.clear();
            console.log('[ImageCache] Caché local de imágenes limpiado con éxito.');
            return true;
        } catch (e) {
            console.warn('[ImageCache] Error limpiando caché:', e);
            return false;
        }
    }

    /**
     * Obtiene estadísticas del uso de caché local
     */
    async function obtenerEstadisticasCache() {
        try {
            const db = await obtenerDB();
            if (!db) return { totalImagenes: 0, itemsEnMemoria: memoryBlobUrlMap.size };

            const total = await new Promise((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const req = tx.objectStore(STORE_NAME).count();
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => resolve(0);
            });

            return {
                totalImagenes: total,
                itemsEnMemoria: memoryBlobUrlMap.size,
                ttlDias: 7
            };
        } catch {
            return { totalImagenes: 0, itemsEnMemoria: memoryBlobUrlMap.size };
        }
    }

    // Exportar servicio en el namespace de la aplicación
    window.InventoryApp.ImageCache = {
        subirImagenVercelBlob,
        obtenerUrlConCache,
        aplicarImagenConCache,
        guardarEnCacheLocal,
        precargarImagenes,
        limpiarCacheLocal,
        obtenerEstadisticasCache
    };

    // Alias conveniente
    window.InventoryApp.BlobStorage = window.InventoryApp.ImageCache;

})();
