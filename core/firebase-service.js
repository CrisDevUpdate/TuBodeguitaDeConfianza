/**
 * core/firebase-service.js
 * Servicio de Persistencia y Base de Datos en la Nube con Firebase Firestore (100% Gratuito)
 * 
 * - Sincronización en tiempo real (Cloud Firestore)
 * - Manejo robusto de errores y reconexión automática
 * - Soporte Offline con caché local y conciliación
 * - Operaciones CRUD completas y atómicas para Productos, Ventas, Clientes, Pagos y Auditoría
 */

window.InventoryApp = window.InventoryApp || {};

(function () {
    // Configuración predeterminada de Firebase provisionada
    const DEFAULT_FIREBASE_CONFIG = {
        apiKey: "AIzaSyCvaTzvnsq3EcH2X4HjQbbGTTH9HPPYR34",
        authDomain: "natural-interface-hdtd0.firebaseapp.com",
        projectId: "natural-interface-hdtd0",
        firestoreDatabaseId: "ai-studio-tubodeguitadecon-7145ac79-a848-43d7-8106-96fe7a2467f8",
        storageBucket: "natural-interface-hdtd0.firebasestorage.app",
        messagingSenderId: "330467021734",
        appId: "1:330467021734:web:d85b10e5c129b887963567"
    };

    let db = null;
    let auth = null;
    let inicializado = false;
    let syncListeners = [];
    let isSaving = false;
    let cloudStatus = 'iniciando'; // 'conectado', 'sincronizando', 'offline', 'error'
    let lastCloudSync = null;

    // Colecciones de Firestore
    const COLLECTIONS = {
        PRODUCTOS: 'productos',
        CLIENTES: 'clientes',
        VENTAS: 'ventas',
        ABONOS: 'abonos',
        TRANSACCIONES: 'transacciones',
        AUDITORIAS: 'auditorias',
        ELIMINACIONES: 'eliminaciones',
        CLIENTES_ELIMINADOS: 'clientesEliminados',
        USUARIOS: 'usuarios',
        CONFIG: 'config'
    };

    /**
     * Obtiene la configuración activa de Firebase (de localStorage o predeterminada)
     */
    function obtenerConfiguracion() {
        try {
            const guardada = localStorage.getItem('bodeguita_firebase_custom_config');
            if (guardada) {
                const parsed = JSON.parse(guardada);
                if (parsed && parsed.apiKey && parsed.projectId) {
                    return parsed;
                }
            }
        } catch (e) {
            console.warn('[Firebase] Error leyendo configuración personalizada:', e);
        }
        return DEFAULT_FIREBASE_CONFIG;
    }

    /**
     * Actualiza el indicador visual de estado de la nube en el encabezado
     */
    function actualizarUIEstadoNube(estado, mensajePersonalizado = null) {
        cloudStatus = estado;
        const statusEl = document.getElementById('persistencia-status');
        const badgeEl = document.getElementById('cloud-status-badge');
        const modalBadgeEl = document.getElementById('modal-cloud-status-badge');

        let icono = 'fa-cloud';
        let texto = 'Conectado a la nube (Firestore)';
        let clase = 'cloud-online';
        let modalColorBg = '#dcfce7';
        let modalColorTxt = '#15803d';

        switch (estado) {
            case 'conectado':
                icono = 'fa-cloud-check';
                texto = mensajePersonalizado || 'Nube Conectada (Firestore)';
                clase = 'cloud-online';
                modalColorBg = '#dcfce7';
                modalColorTxt = '#15803d';
                break;
            case 'sincronizando':
                icono = 'fa-rotate fa-spin';
                texto = mensajePersonalizado || 'Guardando en la nube...';
                clase = 'cloud-syncing';
                modalColorBg = '#e0f2fe';
                modalColorTxt = '#0369a1';
                break;
            case 'offline':
                icono = 'fa-cloud-slash';
                texto = mensajePersonalizado || 'Modo Offline (Guardado local)';
                clase = 'cloud-offline';
                modalColorBg = '#f1f5f9';
                modalColorTxt = '#475569';
                break;
            case 'error':
                icono = 'fa-triangle-exclamation';
                texto = mensajePersonalizado || 'Error de conexión Firestore';
                clase = 'cloud-error';
                modalColorBg = '#fee2e2';
                modalColorTxt = '#b91c1c';
                break;
            case 'iniciando':
                icono = 'fa-cloud-arrow-up fa-fade';
                texto = 'Conectando a Firebase...';
                clase = 'cloud-syncing';
                modalColorBg = '#e0f2fe';
                modalColorTxt = '#0369a1';
                break;
        }

        const htmlContent = `<i class="fas ${icono}"></i> <span>${texto}</span>`;

        if (statusEl) {
            statusEl.innerHTML = htmlContent;
            statusEl.className = `persistence-status ${clase}`;
        }
        if (badgeEl) {
            badgeEl.innerHTML = htmlContent;
            badgeEl.className = `cloud-badge ${clase}`;
        }
        if (modalBadgeEl) {
            modalBadgeEl.innerHTML = `<i class="fas ${icono}"></i> ${texto}`;
            modalBadgeEl.style.backgroundColor = modalColorBg;
            modalBadgeEl.style.color = modalColorTxt;
        }
    }

    /**
     * Inicializa el SDK de Firebase y Firestore
     */
    async function inicializarFirebase() {
        if (inicializado && db) return true;

        actualizarUIEstadoNube('iniciando');

        const config = obtenerConfiguracion();

        try {
            if (typeof firebase === 'undefined') {
                console.warn('[Firebase] SDK de Firebase no cargado en window. Intentando modo diferido...');
                actualizarUIEstadoNube('offline', 'SDK Firebase no disponible');
                return false;
            }

            // Inicializar App de Firebase si aún no existe
            let app;
            if (!firebase.apps.length) {
                app = firebase.initializeApp(config);
            } else {
                app = firebase.apps[0];
            }

            // Conectar a la base de datos de Firestore
            try {
                if (config.firestoreDatabaseId && typeof app.firestore === 'function') {
                    // Intenta conectar a la base de datos específica si está configurada
                    db = app.firestore(config.firestoreDatabaseId);
                }
            } catch (dbErr) {
                console.warn('[Firebase] Falló con ID de base de datos específica, usando default:', dbErr.message);
            }

            if (!db) {
                db = firebase.firestore();
            }

            // Habilitar persistencia de caché offline si está soportada
            try {
                await db.enablePersistence({ synchronizeTabs: true });
                console.log('[Firebase] Persistencia offline de Firestore habilitada.');
            } catch (persistErr) {
                if (persistErr.code === 'failed-precondition') {
                    console.warn('[Firebase] Múltiples pestañas abiertas, persistencia en pestaña única.');
                } else if (persistErr.code === 'unimplemented') {
                    console.warn('[Firebase] El navegador no soporta persistencia offline.');
                }
            }

            inicializado = true;
            actualizarUIEstadoNube('conectado', 'Nube Conectada (Firestore)');
            console.log('[Firebase] Firestore inicializado exitosamente. Proyecto:', config.projectId);

            // Iniciar sincronización inicial desde la nube
            await sincronizarTodoDesdeNube();

            // Escuchar cambios en tiempo real
            iniciarListenersTiempoReal();

            // Escuchar cambios de conectividad de red
            window.addEventListener('online', () => {
                console.log('[Firebase] Conexión a internet reanudada. Sincronizando con Firestore...');
                actualizarUIEstadoNube('sincronizando', 'Reconectando con la nube...');
                sincronizarTodoDesdeNube().then(() => {
                    actualizarUIEstadoNube('conectado', 'Sincronizado en tiempo real');
                });
            });

            window.addEventListener('offline', () => {
                actualizarUIEstadoNube('offline', 'Modo Offline (Guardado local)');
            });

            return true;
        } catch (error) {
            console.error('[Firebase] Error al inicializar Firebase:', error);
            actualizarUIEstadoNube('offline', 'Modo Offline (Base local)');
            return false;
        }
    }

    /**
     * Obtiene una colección de Firestore con respaldo de caché y captura de estado offline
     */
    async function obtenerColeccionSegura(nombreColeccion) {
        if (!db) return null;
        try {
            return await db.collection(nombreColeccion).get();
        } catch (err) {
            const esOffline = err && (
                err.code === 'unavailable' ||
                err.code === 'failed-precondition' ||
                (err.message && (err.message.includes('offline') || err.message.includes('network')))
            );

            if (esOffline) {
                try {
                    return await db.collection(nombreColeccion).get({ source: 'cache' });
                } catch (cacheErr) {
                    return null;
                }
            }
            console.warn(`[Firebase] Aviso al consultar colección "${nombreColeccion}":`, err.message || err);
            return null;
        }
    }

    /**
     * Obtiene un documento de Firestore de forma segura
     */
    async function obtenerDocSeguro(nombreColeccion, docId) {
        if (!db) return null;
        try {
            return await db.collection(nombreColeccion).doc(docId).get();
        } catch (err) {
            try {
                return await db.collection(nombreColeccion).doc(docId).get({ source: 'cache' });
            } catch (cacheErr) {
                return null;
            }
        }
    }

    /**
     * Sincroniza todos los datos desde Firestore a la memoria local de la app
     */
    async function sincronizarTodoDesdeNube() {
        if (!db) return false;

        actualizarUIEstadoNube('sincronizando', 'Comprobando sincronización en la nube...');

        try {
            const [
                snapProds,
                snapCli,
                snapVentas,
                snapAbonos,
                snapTx,
                snapAud,
                snapElim,
                snapCliElim,
                snapUsuarios,
                snapConfig
            ] = await Promise.all([
                obtenerColeccionSegura(COLLECTIONS.PRODUCTOS),
                obtenerColeccionSegura(COLLECTIONS.CLIENTES),
                obtenerColeccionSegura(COLLECTIONS.VENTAS),
                obtenerColeccionSegura(COLLECTIONS.ABONOS),
                obtenerColeccionSegura(COLLECTIONS.TRANSACCIONES),
                obtenerColeccionSegura(COLLECTIONS.AUDITORIAS),
                obtenerColeccionSegura(COLLECTIONS.ELIMINACIONES),
                obtenerColeccionSegura(COLLECTIONS.CLIENTES_ELIMINADOS),
                obtenerColeccionSegura(COLLECTIONS.USUARIOS),
                obtenerDocSeguro(COLLECTIONS.CONFIG, 'global')
            ]);

            // Si no se pudo obtener ninguna respuesta (ej: offline sin caché aún), mantenemos estado local
            const algunoRespondio = snapProds || snapCli || snapVentas || snapAbonos || snapTx || snapUsuarios;
            if (!algunoRespondio) {
                console.info('[Firebase] Firestore en modo sin conexión o conectando en segundo plano. Utilizando datos locales.');
                actualizarUIEstadoNube('offline', 'Modo Offline (Caché local activa)');
                return true;
            }

            const tieneDatosEnNube = (snapProds && !snapProds.empty) || (snapCli && !snapCli.empty) || (snapVentas && !snapVentas.empty) || (snapUsuarios && !snapUsuarios.empty);

            // Si hay datos en la nube, los aplicamos al estado local
            if (tieneDatosEnNube) {
                if (snapProds && !snapProds.empty) {
                    AppState.productos = snapProds.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                }
                if (snapCli && !snapCli.empty) {
                    AppState.clientes = snapCli.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                }
                if (snapVentas && !snapVentas.empty) {
                    AppState.ventas = snapVentas.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                }
                if (snapAbonos && !snapAbonos.empty) {
                    AppState.abonos = snapAbonos.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                }
                if (snapTx && !snapTx.empty) {
                    AppState.transacciones = snapTx.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                }
                if (snapAud && !snapAud.empty) {
                    AppState.auditorias = snapAud.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                }
                if (snapElim && !snapElim.empty) {
                    AppState.eliminaciones = snapElim.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                }
                if (snapCliElim && !snapCliElim.empty) {
                    AppState.clientesEliminados = snapCliElim.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                }
                if (snapUsuarios && !snapUsuarios.empty) {
                    AppState.usuarios = snapUsuarios.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                }

                if (window.InventoryApp.Persistence && typeof window.InventoryApp.Persistence.asegurarUsuarioAdminInicial === 'function') {
                    window.InventoryApp.Persistence.asegurarUsuarioAdminInicial();
                }

                if (snapConfig && snapConfig.exists) {
                    const cfg = snapConfig.data();
                    if (cfg.nextProductSequence) AppState.nextProductSequence = cfg.nextProductSequence;
                }

                // Guardar respaldo en localStorage
                if (window.InventoryApp && window.InventoryApp.Persistence) {
                    window.InventoryApp.Persistence.guardar(true);
                }

                refrescarTodasLasVistas();
                lastCloudSync = new Date();
                actualizarUIEstadoNube('conectado', 'Sincronizado con Firestore');
            } else {
                // La base de datos en la nube está vacía: si tenemos datos locales en memoria, los migramos a la nube
                if (AppState.productos.length > 0 || AppState.clientes.length > 0) {
                    console.log('[Firebase] Colecciones en la nube vacías. Subiendo estado inicial...');
                    await subirTodoALaNube();
                } else {
                    actualizarUIEstadoNube('conectado', 'Nube lista (Base vacía)');
                }
            }

            return true;
        } catch (error) {
            const esOffline = error && error.message && error.message.includes('offline');
            if (esOffline) {
                console.info('[Firebase] Firestore en modo sin conexión. Continuando con almacenamiento local.');
                actualizarUIEstadoNube('offline', 'Modo Offline (Caché local activa)');
            } else {
                console.warn('[Firebase] Aviso de sincronización desde Firestore:', error.message || error);
                actualizarUIEstadoNube('offline', 'Modo local activo');
            }
            return false;
        }
    }

    /**
     * Sube todos los datos locales actuales a Firestore en lote (batch)
     */
    async function subirTodoALaNube() {
        if (!db) return false;

        actualizarUIEstadoNube('sincronizando', 'Subiendo datos a Firestore...');

        try {
            const batch = db.batch();

            // Productos
            AppState.productos.forEach(p => {
                const ref = db.collection(COLLECTIONS.PRODUCTOS).doc(String(p.id));
                batch.set(ref, {
                    codigo: p.codigo || '',
                    nombre: p.nombre || '',
                    costo: Number(p.costo) || 0,
                    ganancia: Number(p.ganancia) || 0,
                    precio: Number(p.precio) || 0,
                    stock: Number(p.stock) || 0,
                    descripcion: p.descripcion || '',
                    contenido: p.contenido || '',
                    imagen: p.imagen || '',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            });

            // Clientes
            AppState.clientes.forEach(c => {
                const ref = db.collection(COLLECTIONS.CLIENTES).doc(String(c.id));
                batch.set(ref, {
                    nombre: c.nombre || '',
                    telefono: c.telefono || '',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            });

            // Ventas
            AppState.ventas.forEach(v => {
                const ref = db.collection(COLLECTIONS.VENTAS).doc(String(v.id));
                batch.set(ref, {
                    clienteId: v.clienteId || '',
                    fecha: v.fecha || '',
                    items: v.items || [],
                    total: Number(v.total) || 0,
                    tipo: v.tipo || 'Contado',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            });

            // Abonos
            AppState.abonos.forEach((a, idx) => {
                const id = a.id || `AB-${idx}-${Date.now()}`;
                const ref = db.collection(COLLECTIONS.ABONOS).doc(String(id));
                batch.set(ref, { ...a, id }, { merge: true });
            });

            // Transacciones
            AppState.transacciones.forEach(t => {
                const ref = db.collection(COLLECTIONS.TRANSACCIONES).doc(String(t.id));
                batch.set(ref, { ...t }, { merge: true });
            });

            // Auditorías
            AppState.auditorias.forEach(a => {
                const id = a.id || `AUD-${Date.now()}-${Math.random()}`;
                const ref = db.collection(COLLECTIONS.AUDITORIAS).doc(String(id));
                batch.set(ref, { ...a, id }, { merge: true });
            });

            // Eliminaciones
            AppState.eliminaciones.forEach(e => {
                const id = e.id || `EL-${Date.now()}-${Math.random()}`;
                const ref = db.collection(COLLECTIONS.ELIMINACIONES).doc(String(id));
                batch.set(ref, { ...e, id }, { merge: true });
            });

            // Clientes Eliminados
            AppState.clientesEliminados.forEach(c => {
                const ref = db.collection(COLLECTIONS.CLIENTES_ELIMINADOS).doc(String(c.id));
                batch.set(ref, { ...c }, { merge: true });
            });

            // Usuarios
            (AppState.usuarios || []).forEach(u => {
                const id = u.id || u.cedula;
                if (id) {
                    const ref = db.collection(COLLECTIONS.USUARIOS).doc(String(id));
                    batch.set(ref, { ...u, id }, { merge: true });
                }
            });

            // Configuración
            const configRef = db.collection(COLLECTIONS.CONFIG).doc('global');
            batch.set(configRef, {
                nextProductSequence: AppState.nextProductSequence || 1,
                lastSync: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            await batch.commit();
            lastCloudSync = new Date();
            actualizarUIEstadoNube('conectado', 'Sincronizado con Firestore');
            return true;
        } catch (error) {
            console.error('[Firebase] Error al subir datos en lote a Firestore:', error);
            actualizarUIEstadoNube('error', 'Error al guardar en Firestore');
            return false;
        }
    }

    /**
     * Inicia listeners en tiempo real para mantener sincronizadas múltiples pestañas y clientes
     */
    function iniciarListenersTiempoReal() {
        if (!db) return;

        // Limpiar listeners previos
        syncListeners.forEach(unsub => typeof unsub === 'function' && unsub());
        syncListeners = [];

        try {
            // Listener de productos
            const unsubProds = db.collection(COLLECTIONS.PRODUCTOS).onSnapshot(snapshot => {
                // Solo si el cambio proviene del servidor y no de una mutación local inmediata
                if (!snapshot.metadata.hasPendingWrites) {
                    let huboCambios = false;
                    snapshot.docChanges().forEach(change => {
                        const data = { id: change.doc.id, ...change.doc.data() };
                        if (change.type === 'added' || change.type === 'modified') {
                            const idx = AppState.productos.findIndex(p => p.id === data.id);
                            if (idx !== -1) {
                                AppState.productos[idx] = data;
                            } else {
                                AppState.productos.push(data);
                            }
                            huboCambios = true;
                        } else if (change.type === 'removed') {
                            AppState.productos = AppState.productos.filter(p => p.id !== data.id);
                            huboCambios = true;
                        }
                    });
                    if (huboCambios) {
                        refrescarTodasLasVistas();
                    }
                }
            }, err => console.warn('[Firebase] Listener de productos aviso:', err.message));
            syncListeners.push(unsubProds);

            // Listener de clientes
            const unsubCli = db.collection(COLLECTIONS.CLIENTES).onSnapshot(snapshot => {
                if (!snapshot.metadata.hasPendingWrites) {
                    let huboCambios = false;
                    snapshot.docChanges().forEach(change => {
                        const data = { id: change.doc.id, ...change.doc.data() };
                        if (change.type === 'added' || change.type === 'modified') {
                            const idx = AppState.clientes.findIndex(c => c.id === data.id);
                            if (idx !== -1) {
                                AppState.clientes[idx] = data;
                            } else {
                                AppState.clientes.push(data);
                            }
                            huboCambios = true;
                        } else if (change.type === 'removed') {
                            AppState.clientes = AppState.clientes.filter(c => c.id !== data.id);
                            huboCambios = true;
                        }
                    });
                    if (huboCambios) {
                        refrescarTodasLasVistas();
                    }
                }
            }, err => console.warn('[Firebase] Listener de clientes aviso:', err.message));
            // Listener de usuarios
            const unsubUsu = db.collection(COLLECTIONS.USUARIOS).onSnapshot(snapshot => {
                if (!snapshot.metadata.hasPendingWrites) {
                    let huboCambios = false;
                    snapshot.docChanges().forEach(change => {
                        const data = { id: change.doc.id, ...change.doc.data() };
                        if (change.type === 'added' || change.type === 'modified') {
                            const idx = (AppState.usuarios || []).findIndex(u => (u.id || u.cedula) === (data.id || data.cedula));
                            if (idx !== -1) {
                                AppState.usuarios[idx] = data;
                            } else {
                                if (!Array.isArray(AppState.usuarios)) AppState.usuarios = [];
                                AppState.usuarios.push(data);
                            }
                            huboCambios = true;
                        } else if (change.type === 'removed') {
                            AppState.usuarios = (AppState.usuarios || []).filter(u => (u.id || u.cedula) !== (data.id || data.cedula));
                            huboCambios = true;
                        }
                    });
                    if (huboCambios) {
                        refrescarTodasLasVistas();
                    }
                }
            }, err => console.warn('[Firebase] Listener de usuarios aviso:', err.message));
            syncListeners.push(unsubUsu);

        } catch (e) {
            console.warn('[Firebase] Error al iniciar listeners en tiempo real:', e);
        }
    }

    /**
     * Refresca todos los componentes de la interfaz de usuario
     */
    function refrescarTodasLasVistas() {
        if (typeof renderizarPosProductos === 'function') renderizarPosProductos();
        if (typeof renderizarInventario === 'function') renderizarInventario();
        if (typeof renderizarClientes === 'function') renderizarClientes();
        if (typeof renderizarHistorialClientesEliminados === 'function') renderizarHistorialClientesEliminados();
        if (typeof actualizarSelectClientes === 'function') actualizarSelectClientes();
        if (typeof renderizarAuditoria === 'function') renderizarAuditoria();
        if (typeof renderizarHistorialAuditoria === 'function') renderizarHistorialAuditoria();
        if (typeof renderizarResumenPerdidasEconomicas === 'function') renderizarResumenPerdidasEconomicas();
        if (typeof actualizarSelectTransacciones === 'function') actualizarSelectTransacciones();
        if (typeof renderizarTransacciones === 'function') renderizarTransacciones();
        if (typeof prepararCodigoNuevoProducto === 'function') prepararCodigoNuevoProducto();
        if (typeof renderizarUsuarios === 'function') renderizarUsuarios();
        if (typeof actualizarUIUsuarioActual === 'function') actualizarUIUsuarioActual();
    }

    // =========================================================================
    // OPERACIONES CRUD ASÍNCRONAS CON FIRESTORE
    // =========================================================================

    /**
     * CRUD: Guardar / Actualizar Producto en Firestore
     */
    async function guardarProductoCloud(producto) {
        if (!producto || !producto.id) return false;

        actualizarUIEstadoNube('sincronizando', 'Guardando producto en Firestore...');

        try {
            if (db) {
                const docRef = db.collection(COLLECTIONS.PRODUCTOS).doc(String(producto.id));
                await docRef.set({
                    codigo: producto.codigo || '',
                    nombre: producto.nombre || '',
                    costo: Number(producto.costo) || 0,
                    ganancia: Number(producto.ganancia) || 0,
                    precio: Number(producto.precio) || 0,
                    stock: Number(producto.stock) || 0,
                    descripcion: producto.descripcion || '',
                    contenido: producto.contenido || '',
                    imagen: producto.imagen || '',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });

                // Actualizar secuencia global
                await db.collection(COLLECTIONS.CONFIG).doc('global').set({
                    nextProductSequence: AppState.nextProductSequence || 1
                }, { merge: true });
            }

            actualizarUIEstadoNube('conectado', 'Producto guardado en Firestore');
            return true;
        } catch (error) {
            console.error('[Firebase] Error al guardar producto en Firestore:', error);
            actualizarUIEstadoNube('offline', 'Guardado localmente (Offline)');
            return false;
        }
    }

    /**
     * CRUD: Eliminar Producto de Firestore
     */
    async function eliminarProductoCloud(productoId) {
        if (!productoId) return false;

        actualizarUIEstadoNube('sincronizando', 'Actualizando inventario en la nube...');

        try {
            if (db) {
                await db.collection(COLLECTIONS.PRODUCTOS).doc(String(productoId)).delete();
            }
            actualizarUIEstadoNube('conectado', 'Inventario actualizado en Firestore');
            return true;
        } catch (error) {
            console.error('[Firebase] Error al eliminar producto en Firestore:', error);
            actualizarUIEstadoNube('offline', 'Modificado localmente (Offline)');
            return false;
        }
    }

    /**
     * CRUD: Procesar Venta Atómica en Firestore (Registrar Venta y Descontar Stock de Productos)
     */
    async function registrarVentaCloud(venta, itemsVendidos) {
        if (!venta || !venta.id) return false;

        actualizarUIEstadoNube('sincronizando', 'Procesando venta en Firestore...');

        try {
            if (db) {
                const batch = db.batch();

                // 1. Registrar venta
                const ventaRef = db.collection(COLLECTIONS.VENTAS).doc(String(venta.id));
                batch.set(ventaRef, {
                    clienteId: venta.clienteId || '',
                    fecha: venta.fecha || '',
                    items: venta.items || [],
                    total: Number(venta.total) || 0,
                    tipo: venta.tipo || 'Contado',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                // 2. Actualizar stock de cada producto en la base de datos
                if (Array.isArray(itemsVendidos)) {
                    itemsVendidos.forEach(item => {
                        const prodActual = AppState.productos.find(p => p.id === item.productoId);
                        if (prodActual) {
                            const prodRef = db.collection(COLLECTIONS.PRODUCTOS).doc(String(item.productoId));
                            batch.update(prodRef, {
                                stock: Number(prodActual.stock) || 0,
                                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                            });
                        }
                    });
                }

                await batch.commit();
            }

            actualizarUIEstadoNube('conectado', 'Venta registrada en Firestore');
            return true;
        } catch (error) {
            console.error('[Firebase] Error al registrar venta en Firestore:', error);
            actualizarUIEstadoNube('offline', 'Venta guardada localmente (Offline)');
            return false;
        }
    }

    /**
     * CRUD: Guardar / Registrar Cliente en Firestore
     */
    async function guardarClienteCloud(cliente) {
        if (!cliente || !cliente.id) return false;

        actualizarUIEstadoNube('sincronizando', 'Guardando cliente en Firestore...');

        try {
            if (db) {
                const docRef = db.collection(COLLECTIONS.CLIENTES).doc(String(cliente.id));
                await docRef.set({
                    nombre: cliente.nombre || '',
                    telefono: cliente.telefono || '',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }

            actualizarUIEstadoNube('conectado', 'Cliente guardado en Firestore');
            return true;
        } catch (error) {
            console.error('[Firebase] Error al guardar cliente en Firestore:', error);
            actualizarUIEstadoNube('offline', 'Cliente guardado localmente (Offline)');
            return false;
        }
    }

    /**
     * CRUD: Eliminar Cliente de Firestore y registrar en ClientesEliminados
     */
    async function eliminarClienteCloud(clienteId, registroEliminado) {
        if (!clienteId) return false;

        actualizarUIEstadoNube('sincronizando', 'Actualizando clientes en Firestore...');

        try {
            if (db) {
                const batch = db.batch();
                // Eliminar de colección activa
                const cliRef = db.collection(COLLECTIONS.CLIENTES).doc(String(clienteId));
                batch.delete(cliRef);

                // Guardar en papelera de clientes eliminados
                if (registroEliminado) {
                    const elimRef = db.collection(COLLECTIONS.CLIENTES_ELIMINADOS).doc(String(clienteId));
                    batch.set(elimRef, {
                        ...registroEliminado,
                        deletedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }

                await batch.commit();
            }

            actualizarUIEstadoNube('conectado', 'Cliente actualizado en Firestore');
            return true;
        } catch (error) {
            console.error('[Firebase] Error al eliminar cliente en Firestore:', error);
            actualizarUIEstadoNube('offline', 'Cliente eliminado localmente (Offline)');
            return false;
        }
    }

    /**
     * CRUD: Guardar Abono / Pago en Firestore
     */
    async function guardarAbonoCloud(abono) {
        if (!abono) return false;

        actualizarUIEstadoNube('sincronizando', 'Registrando pago en Firestore...');

        try {
            if (db) {
                const id = abono.id || `AB-${Date.now()}`;
                const docRef = db.collection(COLLECTIONS.ABONOS).doc(String(id));
                await docRef.set({
                    ...abono,
                    id,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }

            actualizarUIEstadoNube('conectado', 'Pago registrado en Firestore');
            return true;
        } catch (error) {
            console.error('[Firebase] Error al registrar abono en Firestore:', error);
            actualizarUIEstadoNube('offline', 'Pago guardado localmente (Offline)');
            return false;
        }
    }

    /**
     * CRUD: Guardar / Actualizar Transacción Bancaria
     */
    async function guardarTransaccionCloud(tx) {
        if (!tx || !tx.id) return false;

        actualizarUIEstadoNube('sincronizando', 'Guardando transacción...');

        try {
            if (db) {
                const docRef = db.collection(COLLECTIONS.TRANSACCIONES).doc(String(tx.id));
                await docRef.set({
                    ...tx,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }

            actualizarUIEstadoNube('conectado', 'Transacción guardada');
            return true;
        } catch (error) {
            console.error('[Firebase] Error al guardar transacción:', error);
            return false;
        }
    }

    /**
     * CRUD: Registrar Auditoría y Ajuste de Stock en Firestore
     */
    async function registrarAuditoriaCloud(registroAuditoria, productoId, nuevoStock) {
        if (!registroAuditoria) return false;

        actualizarUIEstadoNube('sincronizando', 'Guardando ajuste de auditoría...');

        try {
            if (db) {
                const batch = db.batch();
                const audId = registroAuditoria.id || `AUD-${Date.now()}`;
                const audRef = db.collection(COLLECTIONS.AUDITORIAS).doc(String(audId));
                batch.set(audRef, {
                    ...registroAuditoria,
                    id: audId,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                if (productoId && nuevoStock !== undefined) {
                    const prodRef = db.collection(COLLECTIONS.PRODUCTOS).doc(String(productoId));
                    batch.update(prodRef, {
                        stock: Number(nuevoStock) || 0,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }

                await batch.commit();
            }

            actualizarUIEstadoNube('conectado', 'Ajuste de inventario guardado');
            return true;
        } catch (error) {
            console.error('[Firebase] Error al registrar auditoría:', error);
            return false;
        }
    }

    /**
     * CRUD: Registrar Retiro / Pérdida de Producto en Firestore
     */
    async function registrarEliminacionCloud(registroEliminacion, productoId, nuevoStock) {
        if (!registroEliminacion) return false;

        actualizarUIEstadoNube('sincronizando', 'Registrando retiro en Firestore...');

        try {
            if (db) {
                const batch = db.batch();
                const id = registroEliminacion.id || `EL-${Date.now()}`;
                const elimRef = db.collection(COLLECTIONS.ELIMINACIONES).doc(String(id));
                batch.set(elimRef, {
                    ...registroEliminacion,
                    id,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                if (productoId) {
                    const prodRef = db.collection(COLLECTIONS.PRODUCTOS).doc(String(productoId));
                    if (nuevoStock === 0) {
                        batch.delete(prodRef);
                    } else if (nuevoStock > 0) {
                        batch.update(prodRef, {
                            stock: Number(nuevoStock),
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    }
                }

                await batch.commit();
            }

            actualizarUIEstadoNube('conectado', 'Retiro registrado en Firestore');
            return true;
        } catch (error) {
            console.error('[Firebase] Error al registrar retiro:', error);
            return false;
        }
    }

    /**
     * CRUD: Guardar / Actualizar Usuario en Firestore
     */
    async function guardarUsuarioCloud(usuario) {
        if (!usuario || (!usuario.id && !usuario.cedula)) return false;
        const id = usuario.id || usuario.cedula;

        actualizarUIEstadoNube('sincronizando', 'Guardando usuario en Firestore...');

        try {
            if (db) {
                await db.collection(COLLECTIONS.USUARIOS).doc(String(id)).set({
                    ...usuario,
                    id,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }

            actualizarUIEstadoNube('conectado', 'Usuario guardado en Firestore');
            return true;
        } catch (error) {
            console.error('[Firebase] Error al guardar usuario en Firestore:', error);
            actualizarUIEstadoNube('error', 'Error al guardar usuario');
            return false;
        }
    }

    /**
     * CRUD: Eliminar Usuario de Firestore
     */
    async function eliminarUsuarioCloud(usuarioId) {
        if (!usuarioId) return false;

        actualizarUIEstadoNube('sincronizando', 'Eliminando usuario de Firestore...');

        try {
            if (db) {
                await db.collection(COLLECTIONS.USUARIOS).doc(String(usuarioId)).delete();
            }

            actualizarUIEstadoNube('conectado', 'Usuario eliminado de Firestore');
            return true;
        } catch (error) {
            console.error('[Firebase] Error al eliminar usuario en Firestore:', error);
            actualizarUIEstadoNube('error', 'Error al eliminar usuario');
            return false;
        }
    }

    /**
     * Purgar / Reiniciar base de datos a estado virgen tanto en Firestore como localmente
     */
    async function purgarBaseDeDatosCompletaCloud() {
        actualizarUIEstadoNube('sincronizando', 'Purgando colecciones de la nube...');
        try {
            if (db) {
                // Eliminar documentos de todas las colecciones principales
                const coleccionesAPurgar = [
                    COLLECTIONS.PRODUCTOS,
                    COLLECTIONS.CLIENTES,
                    COLLECTIONS.VENTAS,
                    COLLECTIONS.ABONOS,
                    COLLECTIONS.TRANSACCIONES,
                    COLLECTIONS.AUDITORIAS,
                    COLLECTIONS.ELIMINACIONES,
                    COLLECTIONS.CLIENTES_ELIMINADOS,
                    COLLECTIONS.USUARIOS
                ];

                for (const colName of coleccionesAPurgar) {
                    try {
                        const snap = await db.collection(colName).get();
                        if (snap && !snap.empty) {
                            const batch = db.batch();
                            snap.docs.forEach(doc => {
                                batch.delete(doc.ref);
                            });
                            await batch.commit();
                        }
                    } catch (colErr) {
                        console.warn(`[Firebase] Aviso al limpiar colección ${colName}:`, colErr.message);
                    }
                }

                // Restablecer config y SuperAdmin en la nube
                const HASH_SUPERADMIN = '1a09807a0e6928a66d91025ed5fccd713c9edb101e72a1bbcb8a01cd9a53cb51';
                const superAdminDoc = {
                    id: 'SuperAdmin',
                    cedula: 'SuperAdmin',
                    nombre: 'SuperAdmin',
                    telefono: '0412-0000000',
                    email: 'superadmin@tubodeguita.com',
                    password: HASH_SUPERADMIN,
                    rol: 'admin',
                    estado: 'ACTIVO',
                    puntosAcumulados: 0,
                    puntosCanjeados: 0,
                    fechaRegistro: new Date().toISOString().replace('T', ' ').substring(0, 16)
                };
                await db.collection(COLLECTIONS.USUARIOS).doc('SuperAdmin').set(superAdminDoc);

                await db.collection(COLLECTIONS.CONFIG).doc('global').set({
                    nextProductSequence: 1,
                    lastPurge: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            actualizarUIEstadoNube('conectado', 'Base de datos en estado virgen');
            return true;
        } catch (error) {
            console.error('[Firebase] Error al purgar Firestore:', error);
            actualizarUIEstadoNube('error', 'Error al purgar la nube');
            return false;
        }
    }

    // Exportar servicio a la ventana global
    window.InventoryApp.Firebase = {
        init: inicializarFirebase,
        syncFromCloud: sincronizarTodoDesdeNube,
        syncToCloud: subirTodoALaNube,
        guardarProducto: guardarProductoCloud,
        eliminarProducto: eliminarProductoCloud,
        registrarVenta: registrarVentaCloud,
        guardarCliente: guardarClienteCloud,
        eliminarCliente: eliminarClienteCloud,
        guardarAbono: guardarAbonoCloud,
        guardarTransaccion: guardarTransaccionCloud,
        registrarAuditoria: registrarAuditoriaCloud,
        registrarEliminacion: registrarEliminacionCloud,
        guardarUsuario: guardarUsuarioCloud,
        eliminarUsuario: eliminarUsuarioCloud,
        purgarBaseDeDatosCompleta: purgarBaseDeDatosCompletaCloud,
        actualizarUIEstadoNube,
        getConfig: obtenerConfiguracion
    };
})();
