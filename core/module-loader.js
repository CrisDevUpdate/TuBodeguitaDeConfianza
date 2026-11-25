/**
 * core/module-loader.js
 * Cargador diferido (lazy loader) por rol y por acción para reducir drásticamente
 * la descarga inicial en celulares con internet lento.
 *
 * - Los clientes solo descargan el núcleo ligero (ahorrando ~1.75 MB de JS).
 * - SheetJS (vendor/xlsx.bundle.js, 416 KB) y ExcelExporter (111 KB) solo se
 *   cargan cuando alguien solicita exportar o importar un archivo Excel.
 * - El escáner de cámara (75 KB) se carga al primer toque en el botón de escanear
 *   (o automáticamente para Admin / Vendedor / Kiosco).
 * - Los módulos de Admin, Vendedor y Kiosco se cargan exclusivamente según el rol
 *   activo o al abrir una pestaña que los necesite.
 */
(function () {
    window.InventoryApp = window.InventoryApp || {};

    const VERSION_LAZY = '20261124_lazy_v1';

    const BUNDLES = {
        excel: [
            'vendor/xlsx.bundle.js',
            'core/excel-exporter.js?v=4.5.0_anti_dup'
        ],
        escaner: [
            'modules/escaner-barras.js?v=20261122_scan_pay_v1'
        ],
        kiosco: [
            'modules/escaner-barras.js?v=20261122_scan_pay_v1',
            'modules/kiosco.js?v=20261122_kiosco_undo'
        ],
        pos: [
            'modules/pos.js?v=20261123_caja_opcional',
            'modules/escaner-barras.js?v=20261122_scan_pay_v1'
        ],
        caja: [
            'modules/caja-turnos.js?v=20261123_caja_opcional'
        ],
        historial: [
            'modules/historial-ventas.js?v=20260915_v5'
        ],
        inventario: [
            'modules/productos.js?v=20261121_barcode',
            `modules/movimientos-stock.js?v=${VERSION_LAZY}`,
            `modules/reposicion-compras.js?v=${VERSION_LAZY}`
        ],
        transacciones: [
            `modules/pagos-transacciones.js?v=${VERSION_LAZY}`
        ],
        facturas: [
            'modules/facturas.js?v=20261121_barcode'
        ],
        auditoria: [
            'modules/auditoria.js?v=20261124_conteos_v1',
            'modules/perdidas.js?v=20261123_auditoria_limpia'
        ],
        configuracion: [
            'core/google-drive-service.js?v=4.5.0_anti_dup',
            `modules/configuracion.js?v=${VERSION_LAZY}`
        ]
    };

    const scriptPromises = new Map();
    const scriptsCargados = new Set();
    const bundlesCargados = new Set();
    let adminPrefetchProgramado = false;

    function normalizarClave(src) {
        return String(src || '').split('?')[0].replace(/^\//, '');
    }

    function notificarCarga(mensaje, tipo = 'info', duracion = 2200) {
        try {
            if (typeof window.showCustomToast === 'function') {
                window.showCustomToast(mensaje, tipo, duracion);
            } else if (window.InventoryApp?.Modal?.toast) {
                window.InventoryApp.Modal.toast(mensaje, tipo, duracion);
            }
        } catch {}
    }

    function cargarScript(src) {
        const clave = normalizarClave(src);
        if (!clave) return Promise.resolve();
        if (scriptsCargados.has(clave)) return Promise.resolve();
        if (scriptPromises.has(clave)) return scriptPromises.get(clave);

        // Detectar si ya existe en el DOM (por ejemplo, cargado estáticamente)
        const existente = Array.from(document.querySelectorAll('script[src]')).find(s => {
            try {
                return normalizarClave(new URL(s.src, window.location.href).pathname) === clave;
            } catch {
                return normalizarClave(s.getAttribute('src')) === clave;
            }
        });
        if (existente && existente.dataset.lazyLoaded === '1') {
            scriptsCargados.add(clave);
            return Promise.resolve();
        }

        const promesa = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = false;
            script.dataset.lazyModule = clave;
            script.onload = () => {
                script.dataset.lazyLoaded = '1';
                scriptsCargados.add(clave);
                resolve();
            };
            script.onerror = () => {
                scriptPromises.delete(clave);
                script.remove();
                reject(new Error(`No se pudo cargar el módulo: ${clave}`));
            };
            document.body.appendChild(script);
        });

        scriptPromises.set(clave, promesa);
        return promesa;
    }

    async function cargarBundle(nombre) {
        const lista = BUNDLES[nombre];
        if (!lista || !lista.length) return;
        if (bundlesCargados.has(nombre)) return;

        // Dentro de un mismo bundle cargamos secuencialmente para respetar dependencias internas
        for (const src of lista) {
            await cargarScript(src);
        }
        bundlesCargados.add(nombre);
    }

    async function cargarBundles(nombres) {
        const unicos = Array.from(new Set((nombres || []).filter(Boolean)));
        if (!unicos.length) return;
        await Promise.all(unicos.map(n => cargarBundle(n)));
    }

    function obtenerBundlesParaTab(tabId) {
        switch (tabId) {
            case 'pos':
                return window.AppState?.moduloCajaActivo ? ['pos', 'caja'] : ['pos'];
            case 'caja-turnos':
                return ['caja'];
            case 'inventario':
                return ['inventario'];
            case 'clientes':
                return ['transacciones'];
            case 'transacciones':
                return ['transacciones'];
            case 'facturas':
                return ['facturas'];
            case 'auditoria':
                return ['auditoria'];
            case 'historial-ventas':
                return ['historial'];
            case 'configuracion':
                return ['configuracion'];
            case 'kiosco-view':
                return ['kiosco'];
            default:
                return [];
        }
    }

    function necesitaCargaParaTab(tabId) {
        const requeridos = obtenerBundlesParaTab(tabId);
        return requeridos.some(b => !bundlesCargados.has(b));
    }

    async function asegurarParaTab(tabId) {
        const requeridos = obtenerBundlesParaTab(tabId);
        if (!requeridos.length) return false;
        const faltantes = requeridos.filter(b => !bundlesCargados.has(b));
        if (!faltantes.length) return false;
        await cargarBundles(faltantes);
        if (tabId === 'configuracion' && window.InventoryApp?.GoogleDrive?.init) {
            try { window.InventoryApp.GoogleDrive.init(); } catch {}
        }
        return true;
    }

    function programarPrefetchAdmin() {
        if (adminPrefetchProgramado) return;
        adminPrefetchProgramado = true;

        const cola = ['inventario', 'auditoria', 'facturas', 'configuracion'];
        const ejecutarSiguiente = () => {
            if (!cola.length) {
                if (window.InventoryApp?.GoogleDrive?.init) {
                    try { window.InventoryApp.GoogleDrive.init(); } catch {}
                }
                return;
            }
            const siguiente = cola.shift();
            if (bundlesCargados.has(siguiente)) {
                ejecutarSiguiente();
                return;
            }
            cargarBundle(siguiente)
                .catch(() => {})
                .finally(() => {
                    setTimeout(ejecutarSiguiente, 350);
                });
        };

        const iniciar = () => setTimeout(ejecutarSiguiente, 1200);
        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(iniciar, { timeout: 2500 });
        } else {
            setTimeout(iniciar, 1500);
        }
    }

    async function cargarParaRol(rol) {
        const r = String(rol || 'cliente').toLowerCase();
        if (r === 'admin' || r === 'superadmin') {
            const iniciales = ['pos', 'transacciones', 'historial'];
            if (window.AppState?.moduloCajaActivo) iniciales.push('caja');
            await cargarBundles(iniciales);
            programarPrefetchAdmin();
            return true;
        }
        if (r === 'vendedor') {
            const iniciales = ['pos', 'historial'];
            if (window.AppState?.moduloCajaActivo) iniciales.push('caja');
            await cargarBundles(iniciales);
            return true;
        }
        if (r === 'kiosco' || r === 'autoservicio') {
            await cargarBundle('kiosco');
            return true;
        }
        // Rol cliente: 0 bytes adicionales al iniciar
        return false;
    }

    async function asegurarExcel() {
        if (bundlesCargados.has('excel') && typeof window.XLSX !== 'undefined') {
            return true;
        }
        notificarCarga('Preparando módulo Excel...', 'info', 2000);
        await cargarBundle('excel');
        return typeof window.XLSX !== 'undefined';
    }

    async function asegurarEscaner() {
        if (bundlesCargados.has('escaner') && window.InventoryApp?.EscanerBarras?.abrir) {
            return true;
        }
        notificarCarga('Activando escáner de cámara...', 'info', 1800);
        await cargarBundle('escaner');
        return Boolean(window.InventoryApp?.EscanerBarras?.abrir);
    }

    function estaCargado(nombreBundle) {
        return bundlesCargados.has(nombreBundle);
    }

    // =========================================================================
    // STUBS DIFERIDOS GLOBALES (se reemplazan automáticamente al cargar el módulo)
    // =========================================================================

    if (typeof window.abrirEscanerCodigoBarras !== 'function') {
        const stubAbrirEscaner = async function (...args) {
            try {
                await asegurarEscaner();
                if (typeof window.abrirEscanerCodigoBarras === 'function' && window.abrirEscanerCodigoBarras !== stubAbrirEscaner) {
                    return window.abrirEscanerCodigoBarras(...args);
                }
                if (window.InventoryApp?.EscanerBarras?.abrir) {
                    return window.InventoryApp.EscanerBarras.abrir(...args);
                }
            } catch (err) {
                console.warn('[ModuleLoader] Error cargando escáner:', err);
                notificarCarga('No se pudo cargar el escáner. Verifica tu conexión a internet.', 'warning', 3500);
            }
        };
        window.abrirEscanerCodigoBarras = stubAbrirEscaner;
    }

    if (typeof window.abrirModalReposicionCompras !== 'function') {
        const stubReposicion = async function (...args) {
            try {
                await cargarBundle('inventario');
                if (typeof window.abrirModalReposicionCompras === 'function' && window.abrirModalReposicionCompras !== stubReposicion) {
                    return window.abrirModalReposicionCompras(...args);
                }
            } catch (err) {
                console.warn('[ModuleLoader] Error cargando reposición:', err);
            }
        };
        window.abrirModalReposicionCompras = stubReposicion;
    }

    if (typeof window.abrirModalMovimientosStock !== 'function') {
        const stubMovimientos = async function (...args) {
            try {
                await cargarBundle('inventario');
                if (typeof window.abrirModalMovimientosStock === 'function' && window.abrirModalMovimientosStock !== stubMovimientos) {
                    return window.abrirModalMovimientosStock(...args);
                }
            } catch (err) {
                console.warn('[ModuleLoader] Error cargando movimientos de stock:', err);
            }
        };
        window.abrirModalMovimientosStock = stubMovimientos;
    }

    if (typeof window.descargarInformeRecuperacionExcel !== 'function') {
        const stubInformeRec = async function (...args) {
            try {
                await cargarBundle('auditoria');
                if (typeof window.descargarInformeRecuperacionExcel === 'function' && window.descargarInformeRecuperacionExcel !== stubInformeRec) {
                    return window.descargarInformeRecuperacionExcel(...args);
                }
            } catch (err) {
                console.warn('[ModuleLoader] Error cargando auditoría/pérdidas:', err);
            }
        };
        window.descargarInformeRecuperacionExcel = stubInformeRec;
    }

    window.InventoryApp.ModuleLoader = {
        cargarScript,
        cargarBundle,
        cargarBundles,
        cargarParaRol,
        asegurarParaTab,
        necesitaCargaParaTab,
        asegurarExcel,
        asegurarEscaner,
        estaCargado
    };
})();
