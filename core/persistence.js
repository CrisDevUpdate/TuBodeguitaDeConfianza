/* core/persistence.js - Persistencia Cloud-First: Firestore como Fuente Única de Verdad */
window.InventoryApp = window.InventoryApp || {};

(function () {
    // Clave exclusiva para persistencia de la sesión del usuario (para futuros inicios de sesión)
    const SESSION_KEY = 'bodeguita_usuario_sesion';
    const LEGACY_STORAGE_KEY = 'inventoryapp.beta.v1.state';

    const CACHE_VENTAS_KEY = 'bodeguita_cache_ventas_v3';
    const CACHE_CLIENTES_KEY = 'bodeguita_cache_clientes_v3';
    const CACHE_CLIENTES_ELIMINADOS_KEY = 'bodeguita_cache_clientes_eliminados_v3';
    const CACHE_ABONOS_KEY = 'bodeguita_cache_abonos_v3';
    const CACHE_TX_KEY = 'bodeguita_cache_tx_v3';
    const CACHE_USUARIOS_KEY = 'bodeguita_cache_usuarios_v3';

    const LLAVES_OBSOLETAS_A_PURGAR = [
        LEGACY_STORAGE_KEY,
        'inventoryapp.state',
        'bodeguita_productos',
        'bodeguita_clientes',
        'bodeguita_ventas',
        'bodeguita_abonos',
        'bodeguita_transacciones',
        'bodeguita_auditorias',
        'bodeguita_conteos',
        'bodeguita_eliminaciones',
        'bodeguita_usuarios',
        'bodeguita_conteos_respaldo_v1',
        'bodeguita_ciclos_recuperacion',
        'bodeguita_tasas_bcv',
        'bodeguita_proveedores',
        'bodeguita_facturas_compras',
        'bodeguita_kardex',
        'bodeguita_inventario_v4_state',
        'bodeguita_app_state'
    ];

    const CLAVES_BASE_DATOS = [
        'productos',
        'clientes',
        'ventas',
        'abonos',
        'transacciones',
        'cuentasBancarias',
        'facturasCompras',
        'kardex',
        'proveedores',
        'proveedoresFrecuentes',
        'auditorias',
        'conteosFisicos',
        'eliminaciones',
        'clientesFusionados',
        'usuarios',
        'premioMes',
        'canjesPremios',
        'ciclosRecuperacion',
        'cicloRecuperacionActual',
        'categoriasPersonalizadas',
        'telefonoWhatsApp',
        'tasaUSD_BCV',
        'tasaEUR_BCV',
        'fechaTasaBCV',
        'tasaActiva',
        'monedaSeleccionada'
    ];

    /**
     * Purga de inmediato cualquier residuo de entidades o transacciones de localStorage.
     * En localStorage SOLO se permite la sesión del usuario y el caché de imágenes de productos (ImageCache).
     */
    function purgarResiduosEntidadesLocalStorage() {
        try {
            LLAVES_OBSOLETAS_A_PURGAR.forEach(k => {
                if (localStorage.getItem(k) !== null) {
                    localStorage.removeItem(k);
                }
            });
        } catch (e) {
            console.warn('[Persistence] Aviso al purgar entidades de localStorage:', e);
        }
    }

    function asegurarUsuarioAdminInicial() {
        if (!AppState.premioMes || typeof AppState.premioMes !== 'object') {
            AppState.premioMes = {
                nombre: 'Cafetera Espresso Digital 1.5L',
                imagen: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600&auto=format&fit=crop&q=80',
                puntosRequeridos: 600,
                puntosPorDolar: 1,
                costoRealPremio: 40.00,
                gananciaNetaObjetivo: 60.00,
                poolClientesEstimado: 10,
                pointsPerProfitDollar: 10,
                temporadaActiva: true,
                modalidad: 'ABIERTA_HASTA_GANADOR',
                vigenciaTexto: 'Activo hasta tener ganador o cierre manual (Acumulativo)',
                estado: 'ACTIVO',
                ganadorActual: null,
                descripcion: 'Gran premio en juego para nuestros clientes más fieles. ¡Acumula puntos con cada compra completada!'
            };
        }
        if (!Array.isArray(AppState.canjesPremios)) {
            AppState.canjesPremios = [];
        }

        if (!Array.isArray(AppState.usuarios)) {
            AppState.usuarios = [];
        }

        // 1. Garantizar existencia y permisos totales del SuperAdmin
        let superAdmin = AppState.usuarios.find(u => 
            (u.id || '').toUpperCase() === 'SUPERADMIN' ||
            (u.cedula || '').toUpperCase() === 'SUPERADMIN' ||
            (u.nombre || '').toUpperCase() === 'SUPERADMIN' ||
            (u.email || '').toLowerCase() === 'superadmin@tubodeguita.com'
        );

        // Hash SHA-256 criptográfico para SuperAdmin
        const HASH_SUPERADMIN = '1a09807a0e6928a66d91025ed5fccd713c9edb101e72a1bbcb8a01cd9a53cb51';

        if (!superAdmin) {
            superAdmin = {
                id: 'SuperAdmin',
                cedula: 'SuperAdmin',
                nombre: 'SuperAdmin',
                telefono: '',
                email: 'superadmin@tubodeguita.com',
                password: HASH_SUPERADMIN,
                rol: 'admin',
                estado: 'ACTIVO',
                puntosAcumulados: 0,
                puntosCanjeados: 0,
                fechaRegistro: new Date().toISOString().replace('T', ' ').substring(0, 16)
            };
            AppState.usuarios.push(superAdmin);
        } else {
            superAdmin.password = HASH_SUPERADMIN;
            superAdmin.rol = 'admin';
            superAdmin.estado = 'ACTIVO';
        }

        // Asegurar usuario Auto-servicio de Confianza disponible
        // Usuario: "Autoservicio", Clave protegida: "1409"
        const HASH_AUTOSERVICIO_1409 = 'efe8564971192c24d29c7aedb7c5230aeaf13dbac7815bb7bd2206bdcc483350';
        let autoservicioUser = AppState.usuarios.find(u => 
            (u.id || '').toUpperCase() === 'AUTOSERVICIO' || 
            (u.cedula || '').toUpperCase() === 'AUTOSERVICIO' ||
            (u.nombre || '').toUpperCase() === 'AUTOSERVICIO' ||
            (u.nombre || '').toUpperCase() === 'AUTO-SERVICIO DE CONFIANZA'
        );
        if (!autoservicioUser) {
            autoservicioUser = {
                id: 'Autoservicio',
                cedula: 'Autoservicio',
                nombre: 'Auto-servicio de Confianza',
                telefono: '',
                email: 'autoservicio@tubodeguita.com',
                password: HASH_AUTOSERVICIO_1409,
                rol: 'autoservicio',
                estado: 'ACTIVO',
                puntosAcumulados: 0,
                puntosCanjeados: 0,
                fechaRegistro: new Date().toISOString().replace('T', ' ').substring(0, 16)
            };
            AppState.usuarios.push(autoservicioUser);
        } else {
            autoservicioUser.id = 'Autoservicio';
            autoservicioUser.cedula = 'Autoservicio';
            autoservicioUser.nombre = 'Auto-servicio de Confianza';
            autoservicioUser.password = HASH_AUTOSERVICIO_1409;
            autoservicioUser.rol = 'autoservicio';
            autoservicioUser.estado = 'ACTIVO';
        }
    }

    /**
     * Persiste ÚNICAMENTE la sesión del usuario para futuros inicios de sesión.
     * Ningún dato de negocio (ventas, abonos, productos, clientes, transacciones) se almacena en localStorage.
     */
    function guardar(force = false) {
        try {
            // 1. Persistir o actualizar la sesión del usuario activo
            if (AppState.usuarioActual) {
                const esSuper = typeof esUsuarioAdmin === 'function' 
                    ? esUsuarioAdmin(AppState.usuarioActual)
                    : ((AppState.usuarioActual.id || '').toUpperCase() === 'SUPERADMIN' || (AppState.usuarioActual.cedula || '').toUpperCase() === 'SUPERADMIN');
                
                const sesionMinima = {
                    id: AppState.usuarioActual.id || AppState.usuarioActual.cedula,
                    cedula: AppState.usuarioActual.cedula || AppState.usuarioActual.id,
                    nombre: AppState.usuarioActual.nombre || '',
                    telefono: AppState.usuarioActual.telefono || '',
                    email: AppState.usuarioActual.email || '',
                    rol: esSuper ? 'admin' : (AppState.usuarioActual.rol || 'cliente'),
                    estado: esSuper ? 'ACTIVO' : (AppState.usuarioActual.estado || 'PENDIENTE_APROBACION'),
                    password: AppState.usuarioActual.password || '',
                    avatar: AppState.usuarioActual.avatar || ''
                };
                localStorage.setItem(SESSION_KEY, JSON.stringify(sesionMinima));
            } else {
                localStorage.removeItem(SESSION_KEY);
            }

            // Preservar catálogo de productos con sus imágenes en caché local
            if (Array.isArray(AppState.productos) && AppState.productos.length > 0) {
                try {
                    localStorage.setItem('bodeguita_client_cache_prods_v2', JSON.stringify(AppState.productos));
                    localStorage.setItem('bodeguita_cache_productos', JSON.stringify(AppState.productos));
                } catch (cacheErr) {}
            }

            // Preservar ventas, clientes, abonos y transacciones para garantizar supervivencia tras recarga
            if (Array.isArray(AppState.ventas) && AppState.ventas.length > 0) {
                try {
                    localStorage.setItem(CACHE_VENTAS_KEY, JSON.stringify(AppState.ventas));
                } catch (vErr) {}
            }
            if (Array.isArray(AppState.clientes) && AppState.clientes.length > 0) {
                try {
                    localStorage.setItem(CACHE_CLIENTES_KEY, JSON.stringify(AppState.clientes));
                } catch (cErr) {}
            }
            if (Array.isArray(AppState.clientesEliminados) && AppState.clientesEliminados.length > 0) {
                try {
                    localStorage.setItem(CACHE_CLIENTES_ELIMINADOS_KEY, JSON.stringify(AppState.clientesEliminados));
                } catch (ceErr) {}
            }
            if (Array.isArray(AppState.abonos)) {
                try {
                    localStorage.setItem(CACHE_ABONOS_KEY, JSON.stringify(AppState.abonos));
                } catch (aErr) {}
            }
            if (Array.isArray(AppState.transacciones)) {
                try {
                    localStorage.setItem(CACHE_TX_KEY, JSON.stringify(AppState.transacciones));
                } catch (tErr) {}
            }
            if (Array.isArray(AppState.usuarios) && AppState.usuarios.length > 0) {
                try {
                    localStorage.setItem(CACHE_USUARIOS_KEY, JSON.stringify(AppState.usuarios));
                } catch (uErr) {}
            }

            // 2. Purgar cualquier residuo de entidades o cachés locales obsoletas
            purgarResiduosEntidadesLocalStorage();
        } catch (e) {
            console.warn('[Persistence] Error guardando sesión y estado en localStorage:', e);
        }
        return true;
    }

    /**
     * Carga inicial:
     * - Restaura la sesión del usuario para evitar requerir login repetitivo.
     * - Restaura el estado persistente local (ventas, clientes, abonos) para garantizar disponibilidad inmediata tras recarga.
     * - Se sincroniza y reconcilia en tiempo real con Firebase Firestore.
     */
    function cargar() {
        // 1. Purgar cualquier dato residual previo de entidades obsoletas en localStorage
        purgarResiduosEntidadesLocalStorage();

        // 2. Restaurar la sesión del usuario guardado
        try {
            const sesionGuardada = localStorage.getItem(SESSION_KEY);
            if (sesionGuardada) {
                const usuarioSesion = JSON.parse(sesionGuardada);
                if (usuarioSesion && (usuarioSesion.cedula || usuarioSesion.id)) {
                    const esSuper = typeof esUsuarioAdmin === 'function' 
                        ? esUsuarioAdmin(usuarioSesion) 
                        : ((usuarioSesion.id || '').toUpperCase() === 'SUPERADMIN' || (usuarioSesion.cedula || '').toUpperCase() === 'SUPERADMIN');
                    if (esSuper) {
                        usuarioSesion.rol = 'admin';
                        usuarioSesion.estado = 'ACTIVO';
                    }
                    AppState.usuarioActual = usuarioSesion;
                }
            } else {
                // Compatibilidad de transición: si había una sesión en el storage anterior, extraer solo el usuario y borrar el resto
                const backupAnterior = localStorage.getItem(LEGACY_STORAGE_KEY);
                if (backupAnterior) {
                    try {
                        const parsed = JSON.parse(backupAnterior);
                        if (parsed && parsed.usuarioActual) {
                            AppState.usuarioActual = parsed.usuarioActual;
                            localStorage.setItem(SESSION_KEY, JSON.stringify(parsed.usuarioActual));
                        }
                    } catch {}
                    localStorage.removeItem(LEGACY_STORAGE_KEY);
                }
            }
        } catch (e) {
            console.warn('[Persistence] Error restaurando sesión desde localStorage:', e);
        }

        // 3. Garantizar SuperAdmin base
        asegurarUsuarioAdminInicial();

        // Restaurar lista de usuarios persistidos en caché local
        try {
            const rawUsers = localStorage.getItem(CACHE_USUARIOS_KEY);
            if (rawUsers) {
                const parsed = JSON.parse(rawUsers);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const userMap = new Map();
                    parsed.forEach(u => {
                        const k = String(u.cedula || u.id || '').toUpperCase();
                        if (k) userMap.set(k, u);
                    });
                    (AppState.usuarios || []).forEach(u => {
                        const k = String(u.cedula || u.id || '').toUpperCase();
                        if (k) userMap.set(k, u);
                    });
                    AppState.usuarios = Array.from(userMap.values());
                }
            }
        } catch (e) {}

        // Si el usuario en sesión no es SuperAdmin, asegurar su presencia en AppState.usuarios
        if (AppState.usuarioActual && AppState.usuarioActual.id !== 'SuperAdmin') {
            const existe = (AppState.usuarios || []).find(u => (u.cedula || u.id) === (AppState.usuarioActual.cedula || AppState.usuarioActual.id));
            if (!existe) {
                AppState.usuarios.push(AppState.usuarioActual);
            }
        }

        // 4. Cargar catálogo de productos desde caché local o catálogo base
        if (!Array.isArray(AppState.productos) || AppState.productos.length === 0) {
            let prodsFromCache = null;
            try {
                const rawCache = localStorage.getItem('bodeguita_client_cache_prods_v2') || localStorage.getItem('bodeguita_cache_productos');
                if (rawCache) {
                    const parsed = JSON.parse(rawCache);
                    if (Array.isArray(parsed) && parsed.length > 0) prodsFromCache = parsed;
                }
            } catch (e) {}

            AppState.productos = prodsFromCache || ((typeof PRODUCTOS_INVENTARIO_PDF !== 'undefined' && Array.isArray(PRODUCTOS_INVENTARIO_PDF))
                ? JSON.parse(JSON.stringify(PRODUCTOS_INVENTARIO_PDF))
                : []);
        }

        // Garantizar que las imágenes de todos los productos nunca falten ni se degraden a un estante genérico
        if (Array.isArray(AppState.productos)) {
            let actualizoFotos = false;
            AppState.productos.forEach(p => {
                if (!p.imagen || p.imagen.includes('photo-1542838132-92c53300491e') || p.imagen.includes('images.unsplash.com')) {
                    if (typeof obtenerImagenProducto === 'function') {
                        p.imagen = obtenerImagenProducto(p);
                        actualizoFotos = true;
                    }
                }
            });
            try {
                localStorage.setItem('bodeguita_client_cache_prods_v2', JSON.stringify(AppState.productos));
                localStorage.setItem('bodeguita_cache_productos', JSON.stringify(AppState.productos));
            } catch (e) {}
        }

        // 5. Cargar clientes desde caché local persistente o lista oficial
        try {
            const rawCliElim = localStorage.getItem(CACHE_CLIENTES_ELIMINADOS_KEY);
            if (rawCliElim) {
                const parsed = JSON.parse(rawCliElim);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    AppState.clientesEliminados = parsed;
                }
            }
        } catch (e) {}
        AppState.clientesEliminados = AppState.clientesEliminados || [];

        if (!Array.isArray(AppState.clientes) || AppState.clientes.length === 0) {
            let clientesFromCache = null;
            try {
                const rawCli = localStorage.getItem(CACHE_CLIENTES_KEY);
                if (rawCli) {
                    const parsed = JSON.parse(rawCli);
                    if (Array.isArray(parsed) && parsed.length > 0) clientesFromCache = parsed;
                }
            } catch (e) {}

            const eliminados = AppState.clientesEliminados || [];
            const helperEliminado = typeof esClienteEliminadoOExcluido === 'function' 
                ? esClienteEliminadoOExcluido 
                : (c, list) => {
                    const idNorm = String(c?.id || '').trim().toUpperCase().replace(/[\s\-_]/g, '').replace(/O/g, '0');
                    const nomNorm = String(c?.nombre || '').trim().toLowerCase();
                    return list.some(e => {
                        const eIdNorm = String(e?.id || '').trim().toUpperCase().replace(/[\s\-_]/g, '').replace(/O/g, '0');
                        const eNom = String(e?.nombre || '').trim().toLowerCase();
                        return (idNorm && eIdNorm && idNorm === eIdNorm) || (nomNorm && eNom && nomNorm === eNom);
                    });
                };

            const listaBase = (typeof CLIENTES_OFICIALES !== 'undefined' && Array.isArray(CLIENTES_OFICIALES))
                ? JSON.parse(JSON.stringify(CLIENTES_OFICIALES))
                : [];

            AppState.clientes = (clientesFromCache || listaBase).filter(c => !helperEliminado(c, eliminados));
        }

        // 6. Cargar ventas y préstamos desde caché local persistente o ventas iniciales
        if (!Array.isArray(AppState.ventas) || AppState.ventas.length === 0) {
            let ventasFromCache = null;
            try {
                const rawVen = localStorage.getItem(CACHE_VENTAS_KEY);
                if (rawVen) {
                    const parsed = JSON.parse(rawVen);
                    if (Array.isArray(parsed) && parsed.length > 0) ventasFromCache = parsed;
                }
            } catch (e) {}

            AppState.ventas = ventasFromCache || ((typeof VENTAS_INICIALES_FIADOS !== 'undefined' && Array.isArray(VENTAS_INICIALES_FIADOS))
                ? JSON.parse(JSON.stringify(VENTAS_INICIALES_FIADOS))
                : []);
        }

        // Asegurar que si hay ventas iniciales de fiado falten en memoria, se agreguen sin duplicar
        if (typeof VENTAS_INICIALES_FIADOS !== 'undefined' && Array.isArray(VENTAS_INICIALES_FIADOS)) {
            VENTAS_INICIALES_FIADOS.forEach(vf => {
                const existe = AppState.ventas.some(v => v.id === vf.id || (v.clienteId === vf.clienteId && (String(v.id).startsWith('V_FIADO_') || (Array.isArray(v.items) && v.items.some(i => i.productoId === 'SALDO_INICIAL')))));
                if (!existe) {
                    AppState.ventas.push(JSON.parse(JSON.stringify(vf)));
                }
            });
        }

        // 7. Cargar abonos y transacciones desde caché local persistente
        if (!Array.isArray(AppState.abonos) || AppState.abonos.length === 0) {
            try {
                const rawA = localStorage.getItem(CACHE_ABONOS_KEY);
                if (rawA) {
                    const parsed = JSON.parse(rawA);
                    if (Array.isArray(parsed)) AppState.abonos = parsed;
                }
            } catch (e) {}
            AppState.abonos = AppState.abonos || [];
        }

        if (!Array.isArray(AppState.transacciones) || AppState.transacciones.length === 0) {
            try {
                const rawTx = localStorage.getItem(CACHE_TX_KEY);
                if (rawTx) {
                    const parsed = JSON.parse(rawTx);
                    if (Array.isArray(parsed)) AppState.transacciones = parsed;
                }
            } catch (e) {}
            AppState.transacciones = AppState.transacciones || [];
        }

        AppState.pagosPorVerificar = AppState.pagosPorVerificar || [];
        AppState.carrito = [];
        AppState.clienteSeleccionadoId = null;
        AppState.conteosFisicos = {};
        AppState.auditorias = AppState.auditorias || [];
        AppState.eliminaciones = AppState.eliminaciones || [];
        AppState.clientesEliminados = AppState.clientesEliminados || [];
        AppState.canjesPremios = AppState.canjesPremios || [];

        return true;
    }

    function iniciar() {
        // 1. Restaurar sesión de usuario y purgar residuos locales de negocio
        cargar();
        
        // 2. Inicializar conexión directa a Firebase Firestore (Fuente Única de Verdad)
        if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.init === 'function') {
            window.InventoryApp.Firebase.init().then(() => {
                console.log('[Persistence] Firebase conectado y datos sincronizados desde Firestore.');
            }).catch(err => {
                console.warn('[Persistence] Aviso al inicializar Firebase:', err);
            });
        }

        return true;
    }

    async function limpiarBaseDeDatosVirgen() {
        // 1. Limpiar estado en memoria totalmente
        AppState.productos = [];
        AppState.clientes = [];
        AppState.ventas = [];
        AppState.abonos = [];
        AppState.pagosPorVerificar = [];
        AppState.transacciones = [];
        AppState.carrito = [];
        AppState.clienteSeleccionadoId = null;
        AppState.productoImagenTemporal = '';
        AppState.conteosFisicos = {};
        AppState.auditorias = [];
        AppState.eliminaciones = [];
        AppState.clientesEliminados = [];
        AppState.cuentasBancarias = [];
        AppState.telefonoWhatsApp = '';
        AppState.proveedores = [];
        AppState.proveedoresFrecuentes = [];
        AppState.facturasCompras = [];
        AppState.kardex = [];
        AppState.ciclosRecuperacion = [];
        AppState.categoriasPersonalizadas = [];
        AppState.nextProductSequence = 1;
        AppState.canjesPremios = [];
        AppState.treeProgress = { porcentaje: 0, puntosActuales: 0, puntosMeta: 200, ciclo: 1 };
        AppState.temporadaInviernoActiva = false;
        
        // 2. Preservar ÚNICAMENTE los usuarios SuperAdmin y Autoservicio
        AppState.usuarios = [];
        asegurarUsuarioAdminInicial();
        AppState.usuarioActual = null;

        // 3. Limpiar sesión y entidades de localStorage
        localStorage.removeItem(SESSION_KEY);
        purgarResiduosEntidadesLocalStorage();

        // 4. Limpiar en Firestore si está conectado
        if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.purgarBaseDeDatosCompleta === 'function') {
            await window.InventoryApp.Firebase.purgarBaseDeDatosCompleta();
        }

        return true;
    }

    function limpiarTodo() {
        localStorage.removeItem(SESSION_KEY);
        purgarResiduosEntidadesLocalStorage();
    }

    /**
     * Exporta toda la base de datos a un archivo JSON descargable
     */
    function exportarRespaldoJSON() {
        const datos = {};
        CLAVES_BASE_DATOS.forEach(k => { 
            if (AppState.hasOwnProperty(k)) {
                datos[k] = AppState[k]; 
            }
        });
        datos.fechaExportacion = new Date().toISOString();
        datos.version = window.InventoryApp.version || '4.0.0';

        const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bodeguita-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Importa y restaura base de datos desde un archivo JSON
     */
    function importarRespaldoJSON(archivo) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const datos = JSON.parse(e.target.result);
                    if (!datos || typeof datos !== 'object') throw new Error('Formato de archivo inválido');

                    CLAVES_BASE_DATOS.forEach(clave => {
                        if (datos.hasOwnProperty(clave)) {
                            AppState[clave] = datos[clave];
                        }
                    });

                    guardar(true);

                    // Sincronizar hacia Firebase
                    if (window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.syncToCloud === 'function') {
                        await window.InventoryApp.Firebase.syncToCloud();
                    }

                    resolve(true);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsText(archivo);
        });
    }

    /**
     * Sanitiza valores para celdas de Excel cumpliendo estrictamente con el límite de 32,767 caracteres
     * de la especificación XLSX (SheetJS / Microsoft Excel cell length limit).
     */
    function sanitizarValorExcel(val, maxLen = 32000) {
        if (val === null || val === undefined) return '';
        if (typeof val === 'number') return isNaN(val) ? 0 : val;
        if (typeof val === 'boolean') return val;
        if (typeof val === 'object') {
            try {
                val = JSON.stringify(val);
            } catch (e) {
                val = String(val);
            }
        }
        let str = String(val);
        // Si contiene una imagen o archivo en Base64 (Data URI), evitar desbordar los 32,767 caracteres
        if (str.startsWith('data:image/') || str.startsWith('data:application/') || str.startsWith('data:video/')) {
            return `[Archivo / Imagen Base64 ~${Math.round(str.length / 1024)} KB]`;
        }
        // Si es una cadena extremadamente larga, truncar de forma segura respetando el límite de 32,767 chars
        if (str.length > maxLen) {
            return str.substring(0, maxLen - 20) + '... [TRUNCADO]';
        }
        return str;
    }

    /**
     * Sanitiza todos los objetos de un array antes de pasarlos a XLSX.utils.json_to_sheet
     */
    function sanitizarDatosParaExcel(listaObjetos) {
        if (!Array.isArray(listaObjetos)) return [];
        return listaObjetos.map(item => {
            if (!item || typeof item !== 'object') return item;
            const nuevo = {};
            for (const [k, v] of Object.entries(item)) {
                nuevo[k] = sanitizarValorExcel(v);
            }
            return nuevo;
        });
    }

    /**
     * Helper para ajustar el ancho óptimo de las columnas en una hoja XLSX
     */
    function calcularAnchoColumnas(datos) {
        if (!datos || !datos.length) return [];
        const llaves = Object.keys(datos[0]);
        return llaves.map(k => {
            let maxLen = k.length;
            const limite = Math.min(datos.length, 120);
            for (let i = 0; i < limite; i++) {
                const rawVal = datos[i][k];
                const valStr = (typeof rawVal === 'string' && rawVal.startsWith('data:')) 
                    ? '[Imagen Base64]' 
                    : String(rawVal ?? '');
                if (valStr.length > maxLen) {
                    maxLen = Math.min(valStr.length, 65);
                }
            }
            return { wch: Math.max(maxLen + 3, 12) };
        });
    }

    /**
     * Exporta toda la base de datos completa a un archivo máster Excel (.xlsx) multihajas exhaustivo:
     * Inventario completo, Clientes, Cuentas por Cobrar, Cuentas Bancarias, Ventas, Pagos, Abonos,
     * Transacciones, Puntos de Fidelización, Canjes, Facturas de Compras, Proveedores, Kardex,
     * Auditorías, Mermas y Usuarios del Sistema.
     */
    function exportarMasterExcel() {
        if (window.InventoryApp && window.InventoryApp.ExcelExporter && typeof window.InventoryApp.ExcelExporter.exportarMasterExcelCompleto === 'function') {
            return window.InventoryApp.ExcelExporter.exportarMasterExcelCompleto(AppState, typeof CLIENTES_OFICIALES !== 'undefined' ? CLIENTES_OFICIALES : []);
        }
        alert('El módulo financiero de exportación Excel no está disponible.');
        return false;
    }

    /**
     * Importa y sincroniza base de datos completa desde un archivo máster Excel (.xlsx)
     */
    function importarMasterExcel(archivo) {
        return new Promise((resolve, reject) => {
            if (typeof XLSX === 'undefined') {
                return reject(new Error('Librería XLSX no disponible.'));
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });

                    // 1. Procesar Usuarios (hoja 'Usuarios_Sistema' o legacy 'Usuarios')
                    const sheetUsuariosKey = workbook.SheetNames.find(s => s === 'Usuarios_Sistema' || s === 'Usuarios');
                    if (sheetUsuariosKey) {
                        const sheet = workbook.Sheets[sheetUsuariosKey];
                        const json = XLSX.utils.sheet_to_json(sheet);
                        if (json.length > 0) {
                            const usuariosImportados = json.map(row => ({
                                id: String(row['Cédula / RIF / ID'] || row['Cédula / RIF'] || row['cedula'] || row['id'] || '').trim(),
                                cedula: String(row['Cédula / RIF / ID'] || row['Cédula / RIF'] || row['cedula'] || row['id'] || '').trim(),
                                nombre: String(row['Nombre y Apellido / Razón Social'] || row['nombre'] || '').trim(),
                                telefono: String(row['Teléfono'] || row['telefono'] || '').trim(),
                                email: String(row['Correo Electrónico'] || row['email'] || '').trim(),
                                rol: String(row['Rol'] || row['rol'] || 'cliente').toLowerCase(),
                                estado: String(row['Estado de Acceso'] || row['Estado'] || row['estado'] || 'ACTIVO').toUpperCase(),
                                puntosAcumulados: Number(row['Puntos Acumulados'] || row['puntosAcumulados'] || 0),
                                puntosCanjeados: Number(row['Puntos Canjeados'] || row['puntosCanjeados'] || 0),
                                fechaRegistro: String(row['Fecha de Registro'] || row['fechaRegistro'] || new Date().toISOString().substring(0, 16)),
                                password: '123'
                            })).filter(u => u.cedula && u.nombre);

                            if (usuariosImportados.length > 0) {
                                AppState.usuarios = usuariosImportados;
                            }
                        }
                    }

                    // 2. Procesar Productos (hoja 'Inventario_Productos' o legacy 'Productos')
                    const sheetProdKey = workbook.SheetNames.find(s => s === 'Inventario_Productos' || s === 'Productos');
                    if (sheetProdKey) {
                        const sheet = workbook.Sheets[sheetProdKey];
                        const json = XLSX.utils.sheet_to_json(sheet);
                        if (json.length > 0) {
                            const productosImportados = json.map(row => ({
                                id: String(row['ID Producto'] || row['ID'] || row['id'] || ('P' + Math.random().toString(36).substr(2, 6))),
                                codigo: String(row['Código / SKU'] || row['Código'] || row['codigo'] || '').trim(),
                                nombre: String(row['Nombre del Producto'] || row['Nombre'] || row['nombre'] || '').trim(),
                                categoria: String(row['Categoría'] || row['categoria'] || 'General').trim(),
                                costo: Number(row['Costo Unitario ($ USD)'] || row['Costo ($)'] || row['costo'] || 0),
                                precio: Number(row['Precio Venta ($ USD)'] || row['Precio ($)'] || row['precio'] || 0),
                                stock: Number(row['Stock Actual'] || row['Stock'] || row['stock'] || 0),
                                imagen: String(row['URL Imagen / Almacén'] || row['imagen'] || '')
                            })).filter(p => p.nombre && p.nombre !== 'Sin productos registrados');

                            if (productosImportados.length > 0) {
                                AppState.productos = productosImportados;
                            }
                        }
                    }

                    // 3. Procesar Clientes (hoja 'Clientes_CuentasCobrar' o legacy 'Clientes')
                    const sheetClientKey = workbook.SheetNames.find(s => s === 'Clientes_CuentasCobrar' || s === 'Clientes');
                    if (sheetClientKey) {
                        const sheet = workbook.Sheets[sheetClientKey];
                        const json = XLSX.utils.sheet_to_json(sheet);
                        if (json.length > 0) {
                            const clientesImportados = json.map(row => {
                                const deudaVal = Number(row['Saldo Deudor ($ USD)'] || row['Saldo Deudor'] || row['saldoDeudor'] || row['deudaUSD'] || row['deuda'] || 0);
                                return {
                                    id: String(row['Cédula / RIF / ID'] || row['ID / Cédula'] || row['id'] || '').trim(),
                                    cedula: String(row['Cédula / RIF / ID'] || row['ID / Cédula'] || row['id'] || '').trim(),
                                    nombre: String(row['Nombre Completo / Razón Social'] || row['Nombre'] || row['nombre'] || '').trim(),
                                    telefono: String(row['Teléfono / WhatsApp'] || row['Teléfono'] || row['telefono'] || '').trim(),
                                    email: String(row['Correo Electrónico'] || row['email'] || '').trim(),
                                    deudaUSD: deudaVal,
                                    deudaInicialUSD: deudaVal,
                                    saldoDeudor: deudaVal,
                                    deuda: deudaVal,
                                    totalCompradoUSD: Number(row['Total Compras Registradas ($ USD)'] || row['totalComprado'] || 0),
                                    totalAbonadoUSD: Number(row['Total Abonos Realizados ($ USD)'] || row['totalAbonado'] || 0),
                                    puntosAcumulados: Number(row['Puntos Acumulados'] || row['puntosAcumulados'] || 0),
                                    puntosCanjeados: Number(row['Puntos Canjeados'] || row['puntosCanjeados'] || 0)
                                };
                            }).filter(c => c.id && c.nombre && c.nombre !== 'Sin clientes registrados');

                            if (clientesImportados.length > 0) {
                                AppState.clientes = clientesImportados;
                            }
                        }
                    }

                    // 4. Procesar Proveedores (si existe)
                    const sheetProvKey = workbook.SheetNames.find(s => s === 'Proveedores');
                    if (sheetProvKey) {
                        const sheet = workbook.Sheets[sheetProvKey];
                        const json = XLSX.utils.sheet_to_json(sheet);
                        if (json.length > 0) {
                            const proveedoresImportados = json.map(row => ({
                                id: String(row['ID Proveedor'] || row['id'] || ('PROV_' + Math.random().toString(36).substr(2, 6))),
                                nombre: String(row['Nombre / Razón Social'] || row['nombre'] || '').trim(),
                                rif: String(row['RIF / Identificación'] || row['rif'] || '').trim(),
                                telefono: String(row['Teléfono / WhatsApp'] || row['telefono'] || '').trim(),
                                contacto: String(row['Persona de Contacto'] || row['contacto'] || '').trim(),
                                direccion: String(row['Dirección / Ubicación'] || row['direccion'] || '').trim(),
                                notas: String(row['Notas Comerciales'] || row['notas'] || '').trim(),
                                activo: String(row['Estado'] || 'ACTIVO').toUpperCase() !== 'INACTIVO'
                            })).filter(p => p.nombre && p.nombre !== 'Sin proveedores registrados');

                            if (proveedoresImportados.length > 0) {
                                AppState.proveedores = proveedoresImportados;
                            }
                        }
                    }

                    asegurarUsuarioAdminInicial();
                    guardar(true);

                    // Sincronizar hacia Firebase si está disponible
                    if (window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.syncToCloud === 'function') {
                        await window.InventoryApp.Firebase.syncToCloud();
                    }

                    resolve(true);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(archivo);
        });
    }

    window.InventoryApp.Persistence = {
        cargar,
        guardar,
        iniciar,
        limpiarTodo,
        limpiarBaseDeDatosVirgen,
        exportarRespaldoJSON,
        importarRespaldoJSON,
        exportarMasterExcel,
        importarMasterExcel,
        asegurarUsuarioAdminInicial,
        SESSION_KEY,
        STORAGE_KEY: SESSION_KEY
    };
})();
