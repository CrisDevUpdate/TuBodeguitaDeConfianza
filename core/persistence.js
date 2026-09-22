/* core/persistence.js - Persistencia Cloud-First: Firestore como Fuente Única de Verdad */
window.InventoryApp = window.InventoryApp || {};

(function () {
    // Clave exclusiva para persistencia de la sesión del usuario (para futuros inicios de sesión)
    const SESSION_KEY = 'bodeguita_usuario_sesion';
    const LEGACY_STORAGE_KEY = 'inventoryapp.beta.v1.state';

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
        'bodeguita_clientes_eliminados',
        'bodeguita_usuarios',
        'bodeguita_cache_productos',
        'bodeguita_cache_premio',
        'bodeguita_cache_cuentas_bancarias',
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
        'clientesEliminados',
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

            // 2. Purgar cualquier residuo de entidades o cachés locales obsoletas
            purgarResiduosEntidadesLocalStorage();
        } catch (e) {
            console.warn('[Persistence] Error guardando sesión en localStorage:', e);
        }
        return true;
    }

    /**
     * Carga inicial:
     * - Restaura ÚNICAMENTE la sesión del usuario para evitar requerir login repetitivo.
     * - Inicializa el estado de negocio en memoria limpio.
     * - Todas las colecciones (productos, clientes, ventas, abonos, transacciones, etc.)
     *   se alimentan y sincronizan en tiempo real directamente desde Firebase Firestore.
     */
    function cargar() {
        // 1. Purgar cualquier dato residual previo de entidades en localStorage
        purgarResiduosEntidadesLocalStorage();

        // 2. Restaurar únicamente la sesión del usuario guardado
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

        // Si el usuario en sesión no es SuperAdmin, asegurar su presencia en AppState.usuarios
        if (AppState.usuarioActual && AppState.usuarioActual.id !== 'SuperAdmin') {
            const existe = (AppState.usuarios || []).find(u => (u.cedula || u.id) === (AppState.usuarioActual.cedula || AppState.usuarioActual.id));
            if (!existe) {
                AppState.usuarios.push(AppState.usuarioActual);
            }
        }

        // 4. El 100% de las entidades de negocio se inicializan en memoria vacías para ser alimentadas exclusivamente por Firestore
        AppState.productos = AppState.productos || [];
        AppState.clientes = AppState.clientes || [];
        AppState.ventas = AppState.ventas || [];
        AppState.abonos = AppState.abonos || [];
        AppState.pagosPorVerificar = AppState.pagosPorVerificar || [];
        AppState.transacciones = AppState.transacciones || [];
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
     * Helper para ajustar el ancho óptimo de las columnas en una hoja XLSX
     */
    function calcularAnchoColumnas(datos) {
        if (!datos || !datos.length) return [];
        const llaves = Object.keys(datos[0]);
        return llaves.map(k => {
            let maxLen = k.length;
            const limite = Math.min(datos.length, 120);
            for (let i = 0; i < limite; i++) {
                const val = String(datos[i][k] ?? '');
                if (val.length > maxLen) {
                    maxLen = Math.min(val.length, 65);
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
        if (typeof XLSX === 'undefined') {
            alert('La librería SheetJS (XLSX) no está disponible en este momento.');
            return false;
        }

        try {
            const wb = XLSX.utils.book_new();
            const fechaISO = new Date().toISOString();
            const fechaLegible = new Date().toLocaleString('es-VE');
            const tasaActual = Number(AppState.tasaUSD_BCV || AppState.tasaActiva || 0);

            // =========================================================
            // HOJA 1: RESUMEN GENERAL & KPIS DEL SISTEMA
            // =========================================================
            const stockTotalUnidades = (AppState.productos || []).reduce((acc, p) => acc + (Number(p.stock) || 0), 0);
            const valCostoTotal = (AppState.productos || []).reduce((acc, p) => acc + ((Number(p.stock) || 0) * (Number(p.costo) || 0)), 0);
            const valVentaTotal = (AppState.productos || []).reduce((acc, p) => acc + ((Number(p.stock) || 0) * (Number(p.precio) || 0)), 0);
            const deudaTotalClientes = (AppState.clientes || []).reduce((acc, c) => acc + (Number(c.saldoDeudor || c.deuda || c.saldo) || 0), 0);
            const facturacionTotalVentas = (AppState.ventas || []).reduce((acc, v) => acc + (Number(v.total || v.totalUSD) || 0), 0);
            const abonosTotales = (AppState.abonos || []).reduce((acc, a) => acc + (Number(a.monto || a.montoUSD) || 0), 0);
            const comprasTotales = (AppState.facturasCompras || []).reduce((acc, f) => acc + (Number(f.totalUSD || f.total) || 0), 0);
            const puntosTotalesClientes = (AppState.usuarios || []).reduce((acc, u) => acc + (Number(u.puntosAcumulados) || 0), 0);

            const dataResumen = [
                { 'Indicador / Métrica': 'Fecha y Hora del Respaldo', 'Valor': fechaLegible, 'Detalles / Observaciones': 'Generado desde Tu Bodeguita de Confianza' },
                { 'Indicador / Métrica': 'Versión del Sistema', 'Valor': window.InventoryApp.version || '4.0.0', 'Detalles / Observaciones': 'Respaldo Integral Máster Multi-Hoja' },
                { 'Indicador / Métrica': 'Tasa Oficial BCV Vigente', 'Valor': `Bs. ${tasaActual.toFixed(2)} / USD`, 'Detalles / Observaciones': `Fecha Tasa: ${AppState.fechaTasaBCV || 'Al día'}` },
                { 'Indicador / Métrica': 'Total de Productos en Catálogo', 'Valor': (AppState.productos || []).length, 'Detalles / Observaciones': 'Productos registrados en inventario' },
                { 'Indicador / Métrica': 'Stock Total de Unidades Físicas', 'Valor': stockTotalUnidades, 'Detalles / Observaciones': 'Unidades sumadas de todos los productos' },
                { 'Indicador / Métrica': 'Valorización de Inventario al Costo ($)', 'Valor': `$${valCostoTotal.toFixed(2)} USD`, 'Detalles / Observaciones': 'Inversión en mercancía disponible' },
                { 'Indicador / Métrica': 'Valorización de Inventario a Precio Venta ($)', 'Valor': `$${valVentaTotal.toFixed(2)} USD`, 'Detalles / Observaciones': 'Ingreso proyectado en vitrina' },
                { 'Indicador / Métrica': 'Margen Proyectado Bruto ($)', 'Valor': `$${(valVentaTotal - valCostoTotal).toFixed(2)} USD`, 'Detalles / Observaciones': 'Ganancia bruta potencial en stock' },
                { 'Indicador / Métrica': 'Total de Clientes en Directorio', 'Valor': (AppState.clientes || []).length, 'Detalles / Observaciones': 'Clientes registrados en el sistema' },
                { 'Indicador / Métrica': 'Total Cuentas por Cobrar (Deuda Clientes)', 'Valor': `$${deudaTotalClientes.toFixed(2)} USD`, 'Detalles / Observaciones': `Equivalente aprox: Bs. ${(deudaTotalClientes * tasaActual).toFixed(2)}` },
                { 'Indicador / Métrica': 'Total de Ventas Registradas', 'Valor': (AppState.ventas || []).length, 'Detalles / Observaciones': 'Operaciones históricas de venta' },
                { 'Indicador / Métrica': 'Facturación Histórica Total ($)', 'Valor': `$${facturacionTotalVentas.toFixed(2)} USD`, 'Detalles / Observaciones': 'Monto total vendido histórico' },
                { 'Indicador / Métrica': 'Total Abonos y Pagos a Deudas ($)', 'Valor': `$${abonosTotales.toFixed(2)} USD`, 'Detalles / Observaciones': 'Monto recaudado de cuentas por cobrar' },
                { 'Indicador / Métrica': 'Total Facturas de Compras Registradas', 'Valor': (AppState.facturasCompras || []).length, 'Detalles / Observaciones': 'Facturas de reposición de proveedores' },
                { 'Indicador / Métrica': 'Total Compras a Proveedores ($)', 'Valor': `$${comprasTotales.toFixed(2)} USD`, 'Detalles / Observaciones': 'Monto invertido en compras registradas' },
                { 'Indicador / Métrica': 'Total Proveedores Registrados', 'Valor': (AppState.proveedores || []).length, 'Detalles / Observaciones': 'Directorio comercial de proveedores' },
                { 'Indicador / Métrica': 'Cuentas Bancarias / Métodos Configurados', 'Valor': (AppState.cuentasBancarias || []).length, 'Detalles / Observaciones': 'Canales de recepción de pagos' },
                { 'Indicador / Métrica': 'Transacciones / Pagos Reportados', 'Valor': (AppState.transacciones || []).length, 'Detalles / Observaciones': 'Conciliaciones bancarias y pagos reportados' },
                { 'Indicador / Métrica': 'Movimientos Registrados en Kardex', 'Valor': (AppState.kardex || []).length, 'Detalles / Observaciones': 'Entradas, salidas y ajustes de mercancía' },
                { 'Indicador / Métrica': 'Auditorías Físicas Realizadas', 'Valor': (AppState.auditorias || []).length, 'Detalles / Observaciones': 'Conteos físicos y revisiones de inventario' },
                { 'Indicador / Métrica': 'Mermas y Registros Eliminados', 'Valor': (AppState.eliminaciones || []).length + (AppState.clientesEliminados || []).length, 'Detalles / Observaciones': 'Bajas de productos y clientes eliminados' },
                { 'Indicador / Métrica': 'Total de Usuarios del Sistema', 'Valor': (AppState.usuarios || []).length, 'Detalles / Observaciones': 'SuperAdmin, vendedores y clientes' },
                { 'Indicador / Métrica': 'Total Puntos Acumulados por Clientes', 'Valor': `${puntosTotalesClientes} pts`, 'Detalles / Observaciones': 'Programa de gamificación y fidelidad' },
                { 'Indicador / Métrica': 'Total Canjes de Premios Realizados', 'Valor': (AppState.canjesPremios || []).length, 'Detalles / Observaciones': 'Premios entregados a clientes' },
                { 'Indicador / Métrica': 'Premio del Mes Activo', 'Valor': AppState.premioMes?.nombre || 'No configurado', 'Detalles / Observaciones': `Meta: ${AppState.premioMes?.puntosRequeridos || 600} pts (${AppState.premioMes?.vigenciaTexto || 'Vigente'})` }
            ];
            const wsResumen = XLSX.utils.json_to_sheet(dataResumen);
            wsResumen['!cols'] = calcularAnchoColumnas(dataResumen);
            XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen_General');

            // =========================================================
            // HOJA 2: INVENTARIO DE PRODUCTOS
            // =========================================================
            const dataProductos = (AppState.productos || []).map((p, idx) => {
                const costo = Number(p.costo || 0);
                const precio = Number(p.precio || 0);
                const stock = Number(p.stock || 0);
                const ganancia = precio - costo;
                const margen = costo > 0 ? (((precio - costo) / costo) * 100).toFixed(1) + '%' : '100%';
                const estadoStock = stock <= 0 ? 'AGOTADO' : (stock <= 5 ? 'STOCK BAJO' : 'DISPONIBLE');

                return {
                    'N°': idx + 1,
                    'ID Producto': p.id || '',
                    'Código / SKU': p.codigo || '',
                    'Nombre del Producto': p.nombre || '',
                    'Categoría': p.categoria || 'General',
                    'Costo Unitario ($ USD)': costo,
                    'Precio Venta ($ USD)': precio,
                    'Ganancia Unitaria ($ USD)': Number(ganancia.toFixed(2)),
                    'Margen Bruto (%)': margen,
                    'Stock Actual': stock,
                    'Valor Total Costo ($ USD)': Number((stock * costo).toFixed(2)),
                    'Valor Total Venta ($ USD)': Number((stock * precio).toFixed(2)),
                    'Estado Stock': estadoStock,
                    'URL Imagen / Almacén': p.imagen || p.image || ''
                };
            });
            const wsProductos = XLSX.utils.json_to_sheet(dataProductos.length ? dataProductos : [{
                'N°': 1, 'ID Producto': '', 'Código / SKU': '', 'Nombre del Producto': 'Sin productos registrados',
                'Categoría': '', 'Costo Unitario ($ USD)': 0, 'Precio Venta ($ USD)': 0, 'Ganancia Unitaria ($ USD)': 0,
                'Margen Bruto (%)': '0%', 'Stock Actual': 0, 'Valor Total Costo ($ USD)': 0, 'Valor Total Venta ($ USD)': 0,
                'Estado Stock': '', 'URL Imagen / Almacén': ''
            }]);
            wsProductos['!cols'] = calcularAnchoColumnas(dataProductos);
            XLSX.utils.book_append_sheet(wb, wsProductos, 'Inventario_Productos');

            // =========================================================
            // HOJA 3: CLIENTES Y CUENTAS POR COBRAR
            // =========================================================
            const dataClientes = (AppState.clientes || []).map((c, idx) => {
                const saldoDeuda = Number(c.saldoDeudor || c.deuda || c.saldo || 0);
                const saldoBs = tasaActual > 0 ? Number((saldoDeuda * tasaActual).toFixed(2)) : 0;
                const puntosAcum = Number(c.puntosAcumulados || 0);
                const puntosCanj = Number(c.puntosCanjeados || 0);
                const puntosDisp = Math.max(0, puntosAcum - puntosCanj);

                return {
                    'N°': idx + 1,
                    'Cédula / RIF / ID': c.cedula || c.id || '',
                    'Nombre Completo / Razón Social': c.nombre || '',
                    'Teléfono / WhatsApp': c.telefono || '',
                    'Saldo Deudor ($ USD)': saldoDeuda,
                    'Saldo Deudor Estimado (Bs)': saldoBs,
                    'Estado de Cuenta': saldoDeuda > 0 ? 'CON SALDO PENDIENTE' : 'AL DÍA',
                    'Total Compras Registradas ($ USD)': Number(c.totalComprado || c.compras || 0),
                    'Total Abonos Realizados ($ USD)': Number(c.totalAbonado || c.abonos || 0),
                    'Puntos Acumulados': puntosAcum,
                    'Puntos Canjeados': puntosCanj,
                    'Puntos Disponibles': puntosDisp
                };
            });
            const wsClientes = XLSX.utils.json_to_sheet(dataClientes.length ? dataClientes : [{
                'N°': 1, 'Cédula / RIF / ID': '', 'Nombre Completo / Razón Social': 'Sin clientes registrados',
                'Teléfono / WhatsApp': '', 'Saldo Deudor ($ USD)': 0, 'Saldo Deudor Estimado (Bs)': 0,
                'Estado de Cuenta': 'AL DÍA', 'Total Compras Registradas ($ USD)': 0, 'Total Abonos Realizados ($ USD)': 0,
                'Puntos Acumulados': 0, 'Puntos Canjeados': 0, 'Puntos Disponibles': 0
            }]);
            wsClientes['!cols'] = calcularAnchoColumnas(dataClientes);
            XLSX.utils.book_append_sheet(wb, wsClientes, 'Clientes_CuentasCobrar');

            // =========================================================
            // HOJA 4: CUENTAS BANCARIAS Y MÉTODOS DE PAGO
            // =========================================================
            const dataCuentas = (AppState.cuentasBancarias || []).map((cb, idx) => ({
                'N°': idx + 1,
                'ID': cb.id || '',
                'Banco': cb.banco || cb.bank || '',
                'Tipo de Método': cb.tipo || cb.type || 'Pago Móvil',
                'Titular de la Cuenta': cb.titular || '',
                'Cédula / RIF Titular': cb.cedulaRif || cb.idNumber || '',
                'Teléfono Asociado': cb.telefono || cb.phone || '',
                'Número de Cuenta': cb.cuenta || cb.account || '',
                'Correo Electrónico': cb.correo || '',
                'Estado': cb.activo !== false ? 'ACTIVO' : 'INACTIVO',
                'Instrucciones de Pago': cb.instrucciones || ''
            }));
            const wsCuentas = XLSX.utils.json_to_sheet(dataCuentas.length ? dataCuentas : [{
                'N°': 1, 'ID': '', 'Banco': 'No hay cuentas registradas', 'Tipo de Método': '', 'Titular de la Cuenta': '',
                'Cédula / RIF Titular': '', 'Teléfono Asociado': '', 'Número de Cuenta': '', 'Correo Electrónico': '', 'Estado': '', 'Instrucciones de Pago': ''
            }]);
            wsCuentas['!cols'] = calcularAnchoColumnas(dataCuentas);
            XLSX.utils.book_append_sheet(wb, wsCuentas, 'Cuentas_Bancarias');

            // =========================================================
            // HOJA 5: HISTORIAL COMPLETO DE VENTAS
            // =========================================================
            const dataVentas = (AppState.ventas || []).map((v, idx) => {
                const totalUSD = Number(v.total || v.totalUSD || 0);
                const tasaVenta = Number(v.tasa || v.tasaCambio || tasaActual || 0);
                const totalBs = Number(v.totalBs || (totalUSD * tasaVenta).toFixed(2));
                const cantItems = (v.items || []).reduce((acc, it) => acc + (Number(it.cantidad) || 1), 0);
                const detalleItems = (v.items || []).map(it => `${it.cantidad || 1}x ${it.nombre || it.producto || 'Producto'} ($${Number(it.precio || 0).toFixed(2)})`).join(' | ');

                return {
                    'N°': idx + 1,
                    'ID Venta': v.id || '',
                    'Fecha y Hora': v.fecha || '',
                    'Cédula Cliente': v.clienteCedula || v.clienteId || 'General',
                    'Nombre Cliente': v.clienteNombre || v.cliente || 'Cliente General',
                    'Condición de Pago': v.tipo || v.condicion || 'Contado',
                    'Estado Pago': v.estadoPago || (v.tipo === 'Crédito' ? (v.pagada ? 'PAGADA' : 'PENDIENTE') : 'PAGADA'),
                    'Total Venta ($ USD)': totalUSD,
                    'Total Venta (Bs)': totalBs,
                    'Tasa Cambio (Bs/$)': tasaVenta,
                    'Cantidad de Artículos': cantItems,
                    'Detalle de Productos Vendidos': detalleItems || 'Sin detalle',
                    'Vendedor / Operador': v.vendedor || v.usuario || 'Caja General'
                };
            });
            const wsVentas = XLSX.utils.json_to_sheet(dataVentas.length ? dataVentas : [{
                'N°': 1, 'ID Venta': '', 'Fecha y Hora': '', 'Cédula Cliente': '', 'Nombre Cliente': 'Sin ventas registradas',
                'Condición de Pago': '', 'Estado Pago': '', 'Total Venta ($ USD)': 0, 'Total Venta (Bs)': 0,
                'Tasa Cambio (Bs/$)': 0, 'Cantidad de Artículos': 0, 'Detalle de Productos Vendidos': '', 'Vendedor / Operador': ''
            }]);
            wsVentas['!cols'] = calcularAnchoColumnas(dataVentas);
            XLSX.utils.book_append_sheet(wb, wsVentas, 'Ventas_Historial');

            // =========================================================
            // HOJA 6: ABONOS Y PAGOS A CRÉDITOS
            // =========================================================
            const dataAbonos = (AppState.abonos || []).map((a, idx) => {
                const montoUSD = Number(a.monto || a.montoUSD || 0);
                const tasaAbono = Number(a.tasa || tasaActual || 0);
                const montoBs = Number(a.montoBs || (montoUSD * tasaAbono).toFixed(2));

                return {
                    'N°': idx + 1,
                    'ID Abono': a.id || '',
                    'Fecha y Hora': a.fecha || '',
                    'Cédula Cliente': a.clienteCedula || a.clienteId || '',
                    'Nombre Cliente': a.clienteNombre || a.cliente || '',
                    'Monto Abonado ($ USD)': montoUSD,
                    'Monto Abonado (Bs)': montoBs,
                    'Tasa Aplicada (Bs/$)': tasaAbono,
                    'Referencia Bancaria': a.referencia || '',
                    'Banco / Método': a.metodo || a.banco || 'Pago Móvil',
                    'Saldo Anterior ($ USD)': Number(a.saldoAnterior || 0),
                    'Saldo Restante ($ USD)': Number(a.saldoRestante || 0),
                    'Registrado Por': a.usuario || a.responsable || 'Administración'
                };
            });
            const wsAbonos = XLSX.utils.json_to_sheet(dataAbonos.length ? dataAbonos : [{
                'N°': 1, 'ID Abono': '', 'Fecha y Hora': '', 'Cédula Cliente': '', 'Nombre Cliente': 'Sin abonos registrados',
                'Monto Abonado ($ USD)': 0, 'Monto Abonado (Bs)': 0, 'Tasa Aplicada (Bs/$)': 0, 'Referencia Bancaria': '',
                'Banco / Método': '', 'Saldo Anterior ($ USD)': 0, 'Saldo Restante ($ USD)': 0, 'Registrado Por': ''
            }]);
            wsAbonos['!cols'] = calcularAnchoColumnas(dataAbonos);
            XLSX.utils.book_append_sheet(wb, wsAbonos, 'Pagos_Abonos');

            // =========================================================
            // HOJA 7: TRANSACCIONES Y PAGOS POR CONCILIAR
            // =========================================================
            const dataTx = (AppState.transacciones || []).map((t, idx) => {
                const montoOrig = Number(t.monto || 0);
                const montoUSD = Number(t.montoUSD || (t.moneda === 'USD' ? montoOrig : (tasaActual > 0 ? (montoOrig / tasaActual) : 0)));

                return {
                    'N°': idx + 1,
                    'Referencia': t.referencia || t.ref || '',
                    'Fecha y Hora': t.fecha || '',
                    'Cliente': t.cliente || t.clienteNombre || '',
                    'Banco Origen': t.bancoOrigen || t.origen || '',
                    'Banco Destino': t.bancoDestino || t.banco || '',
                    'Monto Original': montoOrig,
                    'Moneda': t.moneda || 'VES',
                    'Monto ($ USD Equiv)': Number(montoUSD.toFixed(2)),
                    'Estado': t.estado || 'PENDIENTE',
                    'Tipo Operación': t.tipo || 'Pago Reportado'
                };
            });
            const wsTx = XLSX.utils.json_to_sheet(dataTx.length ? dataTx : [{
                'N°': 1, 'Referencia': '', 'Fecha y Hora': '', 'Cliente': 'Sin transacciones registradas',
                'Banco Origen': '', 'Banco Destino': '', 'Monto Original': 0, 'Moneda': 'VES',
                'Monto ($ USD Equiv)': 0, 'Estado': '', 'Tipo Operación': ''
            }]);
            wsTx['!cols'] = calcularAnchoColumnas(dataTx);
            XLSX.utils.book_append_sheet(wb, wsTx, 'Transacciones_Verificar');

            // =========================================================
            // HOJA 8: PROGRAMA DE PUNTOS Y FIDELIZACIÓN
            // =========================================================
            const premioActivo = AppState.premioMes || {};
            const metaPuntos = Number(premioActivo.puntosRequeridos || 600);

            const dataPuntos = (AppState.usuarios || [])
                .filter(u => u.rol === 'cliente' || Number(u.puntosAcumulados || 0) > 0)
                .map((u, idx) => {
                    const acumulados = Number(u.puntosAcumulados || 0);
                    const canjeados = Number(u.puntosCanjeados || 0);
                    const disponibles = Math.max(0, acumulados - canjeados);
                    const progreso = metaPuntos > 0 ? Math.min(100, Math.round((disponibles / metaPuntos) * 100)) + '%' : '0%';
                    let nivel = 'Bronce';
                    if (disponibles >= 500) nivel = 'Diamante VIP';
                    else if (disponibles >= 300) nivel = 'Oro';
                    else if (disponibles >= 100) nivel = 'Plata';

                    return {
                        'N°': idx + 1,
                        'Cédula / RIF': u.cedula || u.id || '',
                        'Nombre Cliente': u.nombre || '',
                        'Teléfono (WhatsApp)': u.telefono || '',
                        'Puntos Acumulados': acumulados,
                        'Puntos Canjeados': canjeados,
                        'Puntos Disponibles': disponibles,
                        'Premio en Juego': premioActivo.nombre || 'Cafetera Espresso',
                        'Meta de Puntos': metaPuntos,
                        'Progreso hacia Premio (%)': progreso,
                        'Nivel de Fidelidad': nivel
                    };
                });
            const wsPuntos = XLSX.utils.json_to_sheet(dataPuntos.length ? dataPuntos : [{
                'N°': 1, 'Cédula / RIF': '', 'Nombre Cliente': 'Sin clientes en programa de puntos',
                'Teléfono (WhatsApp)': '', 'Puntos Acumulados': 0, 'Puntos Canjeados': 0, 'Puntos Disponibles': 0,
                'Premio en Juego': '', 'Meta de Puntos': 0, 'Progreso hacia Premio (%)': '0%', 'Nivel de Fidelidad': ''
            }]);
            wsPuntos['!cols'] = calcularAnchoColumnas(dataPuntos);
            XLSX.utils.book_append_sheet(wb, wsPuntos, 'Puntos_Fidelizacion');

            // =========================================================
            // HOJA 9: CANJES DE PREMIOS REALIZADOS
            // =========================================================
            const dataCanjes = (AppState.canjesPremios || []).map((c, idx) => ({
                'N°': idx + 1,
                'ID Canje': c.id || '',
                'Fecha Canje': c.fecha || '',
                'Cédula Cliente': c.clienteCedula || '',
                'Nombre Cliente': c.clienteNombre || '',
                'Premio Canjeado': c.premioNombre || c.premio || '',
                'Puntos Deducidos': Number(c.puntos || 0),
                'Estado de Entrega': c.estado || 'ENTREGADO'
            }));
            const wsCanjes = XLSX.utils.json_to_sheet(dataCanjes.length ? dataCanjes : [{
                'N°': 1, 'ID Canje': '', 'Fecha Canje': '', 'Cédula Cliente': '', 'Nombre Cliente': 'Sin canjes registrados',
                'Premio Canjeado': '', 'Puntos Deducidos': 0, 'Estado de Entrega': ''
            }]);
            wsCanjes['!cols'] = calcularAnchoColumnas(dataCanjes);
            XLSX.utils.book_append_sheet(wb, wsCanjes, 'Canjes_Premios');

            // =========================================================
            // HOJA 10: FACTURAS DE COMPRAS Y MERCANCÍA
            // =========================================================
            const dataCompras = (AppState.facturasCompras || []).map((fc, idx) => {
                const totalUSD = Number(fc.totalUSD || fc.total || 0);
                const totalBs = Number(fc.totalBs || (totalUSD * tasaActual).toFixed(2));
                const itemsStr = (fc.items || []).map(it => `${it.cantidad || 1}x ${it.nombre || 'Prod'} (Costo: $${Number(it.costoUnitario || it.costo || 0).toFixed(2)})`).join(' | ');

                return {
                    'N°': idx + 1,
                    'N° Factura / Control': fc.numeroFactura || fc.id || '',
                    'Fecha de Emisión': fc.fechaEmision || fc.fecha || '',
                    'Proveedor': fc.proveedor || '',
                    'Total Factura ($ USD)': totalUSD,
                    'Total Factura (Bs)': totalBs,
                    'Cantidad de Ítems': (fc.items || []).length,
                    'Método de Costo': fc.metodoCosto || 'Reposición Directa',
                    'Detalle de Mercancía': itemsStr || 'Sin detalle',
                    'Observaciones': fc.notas || ''
                };
            });
            const wsCompras = XLSX.utils.json_to_sheet(dataCompras.length ? dataCompras : [{
                'N°': 1, 'N° Factura / Control': '', 'Fecha de Emisión': '', 'Proveedor': 'Sin compras registradas',
                'Total Factura ($ USD)': 0, 'Total Factura (Bs)': 0, 'Cantidad de Ítems': 0,
                'Método de Costo': '', 'Detalle de Mercancía': '', 'Observaciones': ''
            }]);
            wsCompras['!cols'] = calcularAnchoColumnas(dataCompras);
            XLSX.utils.book_append_sheet(wb, wsCompras, 'Facturas_Compras');

            // =========================================================
            // HOJA 11: DIRECTORIO DE PROVEEDORES
            // =========================================================
            const dataProveedores = (AppState.proveedores || []).map((pr, idx) => ({
                'N°': idx + 1,
                'ID Proveedor': pr.id || '',
                'Nombre / Razón Social': pr.nombre || '',
                'RIF / Identificación': pr.rif || '',
                'Teléfono / WhatsApp': pr.telefono || '',
                'Persona de Contacto': pr.contacto || '',
                'Dirección / Ubicación': pr.direccion || '',
                'Notas Comerciales': pr.notas || '',
                'Estado': pr.activo !== false ? 'ACTIVO' : 'INACTIVO'
            }));
            const wsProveedores = XLSX.utils.json_to_sheet(dataProveedores.length ? dataProveedores : [{
                'N°': 1, 'ID Proveedor': '', 'Nombre / Razón Social': 'Sin proveedores registrados',
                'RIF / Identificación': '', 'Teléfono / WhatsApp': '', 'Persona de Contacto': '',
                'Dirección / Ubicación': '', 'Notas Comerciales': '', 'Estado': ''
            }]);
            wsProveedores['!cols'] = calcularAnchoColumnas(dataProveedores);
            XLSX.utils.book_append_sheet(wb, wsProveedores, 'Proveedores');

            // =========================================================
            // HOJA 12: KARDEX DE MOVIMIENTOS DE INVENTARIO
            // =========================================================
            const dataKardex = (AppState.kardex || []).map((k, idx) => ({
                'N°': idx + 1,
                'Fecha y Hora': k.fecha || '',
                'Código Producto': k.codigo || '',
                'Nombre del Producto': k.nombre || '',
                'Tipo de Movimiento': k.tipo || '',
                'Entrada (Unidades)': Number(k.entrada || 0),
                'Salida (Unidades)': Number(k.salida || 0),
                'Stock Anterior': Number(k.stockAnterior || 0),
                'Stock Resultante': Number(k.stockNuevo || k.stockResultante || 0),
                'Costo Unitario ($ USD)': Number(k.costo || 0),
                'Referencia / Motivo': k.referencia || k.motivo || ''
            }));
            const wsKardex = XLSX.utils.json_to_sheet(dataKardex.length ? dataKardex : [{
                'N°': 1, 'Fecha y Hora': '', 'Código Producto': '', 'Nombre del Producto': 'Sin movimientos de kardex',
                'Tipo de Movimiento': '', 'Entrada (Unidades)': 0, 'Salida (Unidades)': 0, 'Stock Anterior': 0,
                'Stock Resultante': 0, 'Costo Unitario ($ USD)': 0, 'Referencia / Motivo': ''
            }]);
            wsKardex['!cols'] = calcularAnchoColumnas(dataKardex);
            XLSX.utils.book_append_sheet(wb, wsKardex, 'Kardex_Movimientos');

            // =========================================================
            // HOJA 13: AUDITORÍAS E INVENTARIO FÍSICO
            // =========================================================
            const dataAud = (AppState.auditorias || []).map((a, idx) => ({
                'N°': idx + 1,
                'ID Auditoría': a.id || '',
                'Fecha y Hora': a.fecha || '',
                'Responsable': a.responsable || '',
                'Total Productos Auditados': a.totalItems || (a.items || []).length || 0,
                'Productos con Diferencias': a.totalDiferencias || 0,
                'Impacto Económico ($ USD)': Number(a.impactoUSD || a.perdidaUSD || 0),
                'Observaciones': a.observaciones || a.motivo || ''
            }));
            const wsAud = XLSX.utils.json_to_sheet(dataAud.length ? dataAud : [{
                'N°': 1, 'ID Auditoría': '', 'Fecha y Hora': '', 'Responsable': 'Sin auditorías registradas',
                'Total Productos Auditados': 0, 'Productos con Diferencias': 0, 'Impacto Económico ($ USD)': 0, 'Observaciones': ''
            }]);
            wsAud['!cols'] = calcularAnchoColumnas(dataAud);
            XLSX.utils.book_append_sheet(wb, wsAud, 'Auditorias_Inventario');

            // =========================================================
            // HOJA 14: MERMAS, BAJAS Y PÉRDIDAS
            // =========================================================
            const bajasYmermas = [
                ...(AppState.eliminaciones || []).map(e => ({
                    'ID Registro': e.id || '',
                    'Fecha y Hora': e.fecha || '',
                    'Código / Cédula': e.codigo || '',
                    'Nombre / Concepto': e.nombre || '',
                    'Tipo de Baja': e.tipo || 'Merma / Producto Eliminado',
                    'Cantidad': Number(e.cantidad || e.stock || 1),
                    'Pérdida Económica ($ USD)': Number(e.costo || e.perdida || 0),
                    'Motivo': e.motivo || '',
                    'Registrado Por': e.usuario || e.responsable || 'Administración'
                })),
                ...(AppState.clientesEliminados || []).map(ce => ({
                    'ID Registro': ce.id || '',
                    'Fecha y Hora': ce.fecha || '',
                    'Código / Cédula': ce.cedula || '',
                    'Nombre / Concepto': ce.nombre || '',
                    'Tipo de Baja': 'Cliente Incobrable / Eliminado',
                    'Cantidad': 1,
                    'Pérdida Económica ($ USD)': Number(ce.deuda || ce.saldo || 0),
                    'Motivo': ce.motivo || 'Cuenta incobrable',
                    'Registrado Por': ce.usuario || 'Administración'
                }))
            ];
            const wsMermas = XLSX.utils.json_to_sheet(bajasYmermas.length ? bajasYmermas : [{
                'ID Registro': '', 'Fecha y Hora': '', 'Código / Cédula': '', 'Nombre / Concepto': 'Sin registros de mermas',
                'Tipo de Baja': '', 'Cantidad': 0, 'Pérdida Económica ($ USD)': 0, 'Motivo': '', 'Registrado Por': ''
            }]);
            wsMermas['!cols'] = calcularAnchoColumnas(bajasYmermas);
            XLSX.utils.book_append_sheet(wb, wsMermas, 'Mermas_Bajas');

            // =========================================================
            // HOJA 15: USUARIOS Y ACCESO AL SISTEMA
            // =========================================================
            const dataUsuarios = (AppState.usuarios || []).map((u, idx) => ({
                'N°': idx + 1,
                'Cédula / RIF / ID': u.cedula || u.id || '',
                'Nombre y Apellido / Razón Social': u.nombre || '',
                'Teléfono': u.telefono || '',
                'Correo Electrónico': u.email || '',
                'Rol': u.rol || 'cliente',
                'Estado de Acceso': u.estado || 'ACTIVO',
                'Puntos Acumulados': Number(u.puntosAcumulados || 0),
                'Puntos Canjeados': Number(u.puntosCanjeados || 0),
                'Fecha de Registro': u.fechaRegistro || ''
            }));
            const wsUsuarios = XLSX.utils.json_to_sheet(dataUsuarios.length ? dataUsuarios : [{
                'N°': 1, 'Cédula / RIF / ID': '', 'Nombre y Apellido / Razón Social': 'Sin usuarios',
                'Teléfono': '', 'Correo Electrónico': '', 'Rol': '', 'Estado de Acceso': '',
                'Puntos Acumulados': 0, 'Puntos Canjeados': 0, 'Fecha de Registro': ''
            }]);
            wsUsuarios['!cols'] = calcularAnchoColumnas(dataUsuarios);
            XLSX.utils.book_append_sheet(wb, wsUsuarios, 'Usuarios_Sistema');

            // Descarga del archivo con fecha
            const nombreArchivo = `TuBodeguita_Respaldo_Completo_${new Date().toISOString().slice(0, 10)}.xlsx`;
            XLSX.writeFile(wb, nombreArchivo);

            if (typeof mostrarNotificacionToast === 'function') {
                mostrarNotificacionToast(`✅ Base de datos completa exportada con éxito (${nombreArchivo})`, 'success');
            }

            return true;
        } catch (e) {
            console.error('Error al exportar máster Excel:', e);
            alert('Error al generar el archivo máster Excel: ' + e.message);
            return false;
        }
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
                            const clientesImportados = json.map(row => ({
                                id: String(row['Cédula / RIF / ID'] || row['ID / Cédula'] || row['id'] || '').trim(),
                                cedula: String(row['Cédula / RIF / ID'] || row['ID / Cédula'] || row['id'] || '').trim(),
                                nombre: String(row['Nombre Completo / Razón Social'] || row['Nombre'] || row['nombre'] || '').trim(),
                                telefono: String(row['Teléfono / WhatsApp'] || row['Teléfono'] || row['telefono'] || '').trim(),
                                saldoDeudor: Number(row['Saldo Deudor ($ USD)'] || row['saldoDeudor'] || 0),
                                deuda: Number(row['Saldo Deudor ($ USD)'] || row['deuda'] || 0),
                                totalComprado: Number(row['Total Compras Registradas ($ USD)'] || row['totalComprado'] || 0),
                                totalAbonado: Number(row['Total Abonos Realizados ($ USD)'] || row['totalAbonado'] || 0),
                                puntosAcumulados: Number(row['Puntos Acumulados'] || row['puntosAcumulados'] || 0),
                                puntosCanjeados: Number(row['Puntos Canjeados'] || row['puntosCanjeados'] || 0)
                            })).filter(c => c.id && c.nombre && c.nombre !== 'Sin clientes registrados');

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
