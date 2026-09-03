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
    // Configuración predeterminada de Firebase del proyecto del usuario
    const DEFAULT_FIREBASE_CONFIG = {
        apiKey: "AIzaSyD0_dbHio6HBwmUJZnjRT6yg40SVvkHsfA",
        authDomain: "tubodeguitadeconfianza.firebaseapp.com",
        projectId: "tubodeguitadeconfianza",
        storageBucket: "tubodeguitadeconfianza.firebasestorage.app",
        messagingSenderId: "851659747065",
        appId: "1:851659747065:web:175908dcd4bb4c68af7c28",
        measurementId: "G-9TDEL6NVCQ"
    };

    let db = null;
    let auth = null;
    let inicializado = false;
    let syncListeners = [];
    let isSaving = false;
    let cloudStatus = 'iniciando'; // 'conectado', 'sincronizando', 'offline', 'error'
    let lastCloudSync = null;
    let isQuotaExhausted = false;
    let quotaCooldownTimer = null;
    let lastSyncAttempt = 0;

    /**
     * Comprueba si un usuario corresponde a un Administrador activo del sistema
     */
    function esUsuarioAdminActivo(usuario) {
        if (!usuario) {
            // Si no hay sesión explícita en AppState pero la app está en vista de administración
            try {
                const mainApp = document.getElementById('main-app');
                const gatewall = document.getElementById('gatewall-modal');
                const esMainVisible = mainApp && mainApp.style.display !== 'none';
                const esGatewallOculto = !gatewall || gatewall.style.display === 'none';
                const activeTab = document.querySelector('.nav-btn.active')?.getAttribute('data-tab') || '';
                const esVistaAdmin = !activeTab.startsWith('cliente-');
                if (esMainVisible && esGatewallOculto && esVistaAdmin) {
                    return true;
                }
            } catch (e) {}
            return false;
        }

        const rol = String(usuario.rol || '').trim().toLowerCase();
        const id = String(usuario.id || usuario.cedula || '').trim().toLowerCase();
        const email = String(usuario.email || '').trim().toLowerCase();
        const estado = String(usuario.estado || 'ACTIVO').trim().toUpperCase();

        const esAdmin = (
            rol === 'admin' ||
            rol === 'superadmin' ||
            rol === 'administrador' ||
            id === 'superadmin' ||
            email === 'superadmin@tubodeguita.com'
        );
        const esActivo = (estado === 'ACTIVO' || !usuario.estado);
        return Boolean(esAdmin && esActivo);
    }

    let audioCtxSingleton = null;

    function getAudioContext() {
        if (!audioCtxSingleton) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                audioCtxSingleton = new AudioCtx();
            }
        }
        return audioCtxSingleton;
    }

    // Audio Element WAV sintetizado como respaldo de campana de dos tonos
    let audioFallbackElement = null;
    function getAudioFallbackElement() {
        if (audioFallbackElement) return audioFallbackElement;
        try {
            const sampleRate = 22050;
            const duration = 0.55;
            const numSamples = Math.floor(sampleRate * duration);
            const buffer = new ArrayBuffer(44 + numSamples * 2);
            const view = new DataView(buffer);

            const writeString = (offset, str) => {
                for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
            };

            writeString(0, 'RIFF');
            view.setUint32(4, 36 + numSamples * 2, true);
            writeString(8, 'WAVE');
            writeString(12, 'fmt ');
            view.setUint32(16, 16, true);
            view.setUint16(20, 1, true);
            view.setUint16(22, 1, true);
            view.setUint32(24, sampleRate, true);
            view.setUint32(28, sampleRate * 2, true);
            view.setUint16(32, 2, true);
            view.setUint16(34, 16, true);
            writeString(36, 'data');
            view.setUint32(40, numSamples * 2, true);

            for (let i = 0; i < numSamples; i++) {
                const t = i / sampleRate;
                let sample = 0;
                if (t < 0.32) sample += 0.5 * Math.sin(2 * Math.PI * 587.33 * t) * Math.exp(-t * 11);
                if (t >= 0.1) {
                    const t2 = t - 0.1;
                    sample += 0.65 * Math.sin(2 * Math.PI * 1174.66 * t2) * Math.exp(-t2 * 9);
                }
                const val = Math.max(-1, Math.min(1, sample));
                view.setInt16(44 + i * 2, Math.floor(val * 32767), true);
            }

            const blob = new Blob([buffer], { type: 'audio/wav' });
            audioFallbackElement = new Audio(URL.createObjectURL(blob));
        } catch (e) {
            console.warn('[Audio] No se pudo sintetizar audio fallback:', e);
        }
        return audioFallbackElement;
    }

    // Desbloquear audio automáticamente con cualquier clic, toque o teclado en la ventana
    if (typeof window !== 'undefined') {
        const desbloquearAudio = () => {
            const ctx = getAudioContext();
            if (ctx && ctx.state === 'suspended') {
                ctx.resume().catch(() => {});
            }
            const fallback = getAudioFallbackElement();
            if (fallback && fallback.paused) {
                // Silencio mínimo para despertar el elemento
                fallback.volume = 0.001;
                fallback.play().then(() => {
                    fallback.pause();
                    fallback.currentTime = 0;
                    fallback.volume = 1.0;
                }).catch(() => {});
            }
        };
        ['click', 'touchstart', 'keydown', 'mousedown'].forEach(evt => {
            window.addEventListener(evt, desbloquearAudio, { passive: true, capture: true });
        });
    }

    /**
     * Reproduce un chime de campana de dos tonos mediante Web Audio API con fallback directo de Audio Element.
     */
    function reproducirSonidoNotificacion() {
        let sonidoEmitido = false;

        // Intentar reproducción mediante Web Audio API
        try {
            const ctx = getAudioContext();
            if (ctx) {
                const emitirTonos = () => {
                    try {
                        const now = ctx.currentTime || 0;
                        // Tono 1: Frecuencia 587.33 Hz (Re5)
                        const osc1 = ctx.createOscillator();
                        const gain1 = ctx.createGain();
                        osc1.type = 'sine';
                        osc1.frequency.setValueAtTime(587.33, now);
                        osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // La5
                        gain1.gain.setValueAtTime(0.35, now);
                        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                        osc1.connect(gain1);
                        gain1.connect(ctx.destination);
                        osc1.start(now);
                        osc1.stop(now + 0.35);

                        // Tono 2: Frecuencia 1174.66 Hz (Re6)
                        const osc2 = ctx.createOscillator();
                        const gain2 = ctx.createGain();
                        osc2.type = 'sine';
                        osc2.frequency.setValueAtTime(1174.66, now + 0.12);
                        gain2.gain.setValueAtTime(0.4, now + 0.12);
                        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
                        osc2.connect(gain2);
                        gain2.connect(ctx.destination);
                        osc2.start(now + 0.12);
                        osc2.stop(now + 0.6);
                        sonidoEmitido = true;
                    } catch (errInner) {
                        console.warn('[Audio] Error al sintetizar sonido WebAudio:', errInner);
                    }
                };

                if (ctx.state === 'suspended') {
                    ctx.resume().then(emitirTonos).catch(() => {
                        // Fallback a HTML5 Audio Element
                        const fallback = getAudioFallbackElement();
                        if (fallback) {
                            fallback.currentTime = 0;
                            fallback.volume = 1.0;
                            fallback.play().catch(() => {});
                        }
                    });
                } else {
                    emitirTonos();
                }
            }
        } catch (e) {
            console.warn('[Audio] Error en WebAudio:', e);
        }

        // Siempre disparar fallback en caso de que Web Audio esté silenciado por política
        try {
            const fallback = getAudioFallbackElement();
            if (fallback && !sonidoEmitido) {
                fallback.currentTime = 0;
                fallback.volume = 1.0;
                fallback.play().catch(() => {});
            }
        } catch (eFallback) {}
    }

    if (typeof window !== 'undefined') {
        window.reproducirSonidoNotificacion = reproducirSonidoNotificacion;
    }

    /**
     * Detecta si un error corresponde al límite de cuota gratuita diaria de Firestore
     */
    function esErrorDeCuota(error) {
        if (!error) return false;
        const code = String(error.code || '');
        const msg = String(error.message || '').toLowerCase();
        return code === 'resource-exhausted' ||
               code.includes('resource-exhausted') ||
               msg.includes('quota exceeded') ||
               msg.includes('resource-exhausted') ||
               msg.includes('quota_exceeded') ||
               msg.includes('maximum backoff');
    }

    /**
     * Maneja el estado de cuota agotada pausando temporalmente las peticiones recurrentes a la nube
     */
    function manejarErrorCuota() {
        if (!isQuotaExhausted) {
            isQuotaExhausted = true;
            console.warn('[Firebase] Cuota gratuita de Firestore alcanzada (resource-exhausted). Desconectando red Firestore y operando con persistencia local/IndexedDB.');
            detenerListenersTiempoReal();
            if (db && typeof db.disableNetwork === 'function') {
                db.disableNetwork().catch(() => {});
            }
            actualizarUIEstadoNube('offline', 'Modo Local (Cuota Firestore protegida)');
        }

        if (quotaCooldownTimer) clearTimeout(quotaCooldownTimer);
        quotaCooldownTimer = setTimeout(async () => {
            isQuotaExhausted = false;
            console.log('[Firebase] Reanudando verificaciones con Firestore tras período de enfriamiento...');
            if (db && typeof db.enableNetwork === 'function') {
                try {
                    await db.enableNetwork();
                    iniciarListenersTiempoReal();
                } catch (e) {}
            }
        }, 15 * 60 * 1000); // 15 minutos
    }

    /**
     * Detiene los listeners en tiempo real para evitar loops de reconexión y sobrecarga del SDK
     */
    function detenerListenersTiempoReal() {
        syncListeners.forEach(unsub => {
            try {
                if (typeof unsub === 'function') unsub();
            } catch (e) {}
        });
        syncListeners = [];
    }

    /**
     * Elimina propiedades undefined o funciones no serializables para evitar
     * que Firestore rechace escrituras con "Unsupported field value: undefined"
     */
    function sanitizarObjetoParaFirestore(obj) {
        if (obj === null || obj === undefined) return null;
        if (typeof obj !== 'object') return obj;

        if (Array.isArray(obj)) {
            return obj
                .filter(item => item !== undefined)
                .map(item => sanitizarObjetoParaFirestore(item));
        }

        // Si NO es un objeto plano simple (ej: es instancia de FieldValue, Timestamp, Date, etc.)
        // NUNCA deconstruir con Object.entries() porque rompe los centinelas internos del SDK de Firestore
        const esObjetoPlano = Boolean(
            obj && typeof obj === 'object' && !Array.isArray(obj) &&
            (obj.constructor === Object || !obj.constructor)
        );

        if (!esObjetoPlano) {
            return obj;
        }

        const limpio = {};
        for (const [k, v] of Object.entries(obj)) {
            if (v === undefined || typeof v === 'function') {
                continue;
            }
            if (v !== null && typeof v === 'object') {
                limpio[k] = sanitizarObjetoParaFirestore(v);
            } else {
                limpio[k] = v;
            }
        }
        return limpio;
    }

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
        CANJES: 'canjesPremios',
        CONFIG: 'config',
        PAGOS_POR_VERIFICAR: 'PagosPorVerificar'
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
                if (config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)' && typeof app.firestore === 'function') {
                    try {
                        db = app.firestore(config.firestoreDatabaseId);
                    } catch (idErr) {
                        db = firebase.firestore();
                    }
                } else if (typeof firebase.firestore === 'function') {
                    db = firebase.firestore();
                }
            } catch (dbErr) {
                console.warn('[Firebase] Falló con ID de base de datos específica, usando default:', dbErr.message);
                if (typeof firebase.firestore === 'function') {
                    db = firebase.firestore();
                }
            }

            if (!db && typeof firebase.firestore === 'function') {
                db = firebase.firestore();
            }

            // Autenticación anónima para reglas de seguridad
            if (typeof firebase.auth === 'function') {
                try {
                    auth = firebase.auth();
                    if (!auth.currentUser) {
                        auth.signInAnonymously().catch(authErr => {
                            console.info('[Firebase] Auth anónimo:', authErr.message);
                        });
                    }
                } catch (e) {}
            }

            // Configurar nivel de log silencioso para evitar mensajes repetitivos de reintento en cuota
            try {
                if (typeof firebase.firestore.setLogLevel === 'function') {
                    firebase.firestore.setLogLevel('silent');
                }
            } catch (e) {}

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

            // Re-validación en foco de ventana (Multi-Device Parity) con throttle de 60s
            let lastFocusSync = 0;
            const revalidarEnFoco = () => {
                if (isQuotaExhausted) return;
                const now = Date.now();
                if (now - lastFocusSync < 60000) return;
                lastFocusSync = now;
                sincronizarTodoDesdeNube().catch(() => {});
            };
            window.addEventListener('focus', revalidarEnFoco);
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    revalidarEnFoco();
                }
            });

            // Escuchar cambios de conectividad de red
            window.addEventListener('online', () => {
                if (isQuotaExhausted) return;
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
            if (esErrorDeCuota(error)) {
                manejarErrorCuota();
            } else {
                console.error('[Firebase] Error al inicializar Firebase:', error);
                actualizarUIEstadoNube('offline', 'Modo Offline (Base local)');
            }
            return false;
        }
    }

    /**
     * Obtiene una colección de Firestore con respaldo de caché y captura de estado offline
     */
    async function obtenerColeccionSegura(nombreColeccion) {
        if (!db) return null;
        if (isQuotaExhausted) {
            try {
                return await db.collection(nombreColeccion).get({ source: 'cache' });
            } catch (cacheErr) {
                return null;
            }
        }
        try {
            return await db.collection(nombreColeccion).get();
        } catch (err) {
            if (esErrorDeCuota(err)) {
                manejarErrorCuota();
                try {
                    return await db.collection(nombreColeccion).get({ source: 'cache' });
                } catch (cacheErr) {
                    return null;
                }
            }

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
        if (isQuotaExhausted) {
            try {
                return await db.collection(nombreColeccion).doc(docId).get({ source: 'cache' });
            } catch (cacheErr) {
                return null;
            }
        }
        try {
            return await db.collection(nombreColeccion).doc(docId).get();
        } catch (err) {
            if (esErrorDeCuota(err)) {
                manejarErrorCuota();
            }
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

        const now = Date.now();
        if (now - lastSyncAttempt < 15000) {
            return true; // Throttled
        }
        lastSyncAttempt = now;

        if (isQuotaExhausted) {
            actualizarUIEstadoNube('offline', 'Modo Local (Cuota Firestore límite alcanzado)');
            return true;
        }

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
                snapCanjes,
                snapConfig,
                snapPagosPorVerificar
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
                obtenerColeccionSegura(COLLECTIONS.CANJES),
                obtenerDocSeguro(COLLECTIONS.CONFIG, 'global'),
                obtenerColeccionSegura(COLLECTIONS.PAGOS_POR_VERIFICAR)
            ]);

            // Si no se pudo obtener ninguna respuesta (ej: offline sin caché aún), mantenemos estado local
            const algunoRespondio = snapProds !== null || snapCli !== null || snapVentas !== null || snapAbonos !== null || snapTx !== null || snapUsuarios !== null;
            if (!algunoRespondio) {
                console.info('[Firebase] Firestore en modo sin conexión o conectando en segundo plano. Utilizando datos locales.');
                actualizarUIEstadoNube('offline', 'Modo Offline (Caché local activa)');
                return true;
            }

            // Aplicar de forma fiel y directa los datos de la nube
            if (snapProds) {
                if (!snapProds.empty) {
                    AppState.productos = snapProds.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                } else if (Array.isArray(AppState.productos) && AppState.productos.length > 0) {
                    subirTodoALaNube().catch(() => {});
                }
            }
            if (snapCli) {
                if (!snapCli.empty) {
                    AppState.clientes = snapCli.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                } else if (Array.isArray(AppState.clientes) && AppState.clientes.length > 0) {
                    AppState.clientes.forEach(c => guardarClienteCloud(c).catch(() => {}));
                }
            }
            if (snapVentas) {
                if (!snapVentas.empty) {
                    AppState.ventas = snapVentas.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                }
            }
            if (snapAbonos) {
                if (!snapAbonos.empty) {
                    AppState.abonos = snapAbonos.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                }
            }
            if (snapTx) {
                if (!snapTx.empty) {
                    AppState.transacciones = snapTx.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                }
            }
            if (snapAud) {
                if (!snapAud.empty) {
                    AppState.auditorias = snapAud.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                }
            }
            if (snapElim) {
                if (!snapElim.empty) {
                    AppState.eliminaciones = snapElim.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                }
            }
            if (snapCliElim) {
                if (!snapCliElim.empty) {
                    AppState.clientesEliminados = snapCliElim.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                }
            }
            if (snapUsuarios) {
                if (!snapUsuarios.empty) {
                    const cloudUsuarios = snapUsuarios.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    const mapUsuarios = new Map();
                    cloudUsuarios.forEach(u => mapUsuarios.set(String(u.id || u.cedula).toUpperCase(), u));
                    (AppState.usuarios || []).forEach(localU => {
                        const k = String(localU.id || localU.cedula).toUpperCase();
                        if (!mapUsuarios.has(k)) {
                            mapUsuarios.set(k, localU);
                            guardarUsuarioCloud(localU).catch(() => {});
                        }
                    });
                    AppState.usuarios = Array.from(mapUsuarios.values());
                } else if (Array.isArray(AppState.usuarios) && AppState.usuarios.length > 0) {
                    AppState.usuarios.forEach(u => guardarUsuarioCloud(u).catch(() => {}));
                }
            }
            if (snapCanjes) {
                if (!snapCanjes.empty) {
                    AppState.canjesPremios = snapCanjes.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                }
            }
            if (snapPagosPorVerificar) {
                if (!snapPagosPorVerificar.empty) {
                    const pagos = [];
                    snapPagosPorVerificar.docs.forEach(doc => {
                        const data = doc.data() || {};
                        if (Array.isArray(data.pagos)) {
                            data.pagos.forEach(p => { if (p && p.id) pagos.push(p); });
                        }
                        pagos.push({ id: doc.id, ...data });
                    });
                    AppState.pagosPorVerificar = pagos;
                }
            }

            if (window.InventoryApp.Persistence && typeof window.InventoryApp.Persistence.asegurarUsuarioAdminInicial === 'function') {
                window.InventoryApp.Persistence.asegurarUsuarioAdminInicial();
            }

            // Si la colección de usuarios en Firestore no tiene SuperAdmin, solo guardar SuperAdmin
            if (snapUsuarios && snapUsuarios.empty && db) {
                const superAdmin = (AppState.usuarios || []).find(u => u.id === 'SuperAdmin');
                if (superAdmin) {
                    db.collection(COLLECTIONS.USUARIOS).doc('SuperAdmin').set(superAdmin, { merge: true }).catch(() => {});
                }
            }

            // Validar si el usuario en sesión activa actual todavía existe en la base de datos
            if (AppState.usuarioActual) {
                const idActual = AppState.usuarioActual.cedula || AppState.usuarioActual.id;
                const esSuperAdmin = idActual === 'SuperAdmin' || (AppState.usuarioActual.email || '').toLowerCase() === 'superadmin@tubodeguita.com';
                const existeEnNube = (AppState.usuarios || []).some(u => (u.cedula || u.id) === idActual || (u.email && u.email.toLowerCase() === (AppState.usuarioActual.email || '').toLowerCase()));
                if (!existeEnNube && !esSuperAdmin) {
                    console.warn('[Sync Nube] El usuario de la sesión actual no existe en Firestore. Cerrando sesión.');
                    AppState.usuarioActual = null;
                }
            }

            // Guardar respaldo en localStorage
            if (window.InventoryApp && window.InventoryApp.Persistence) {
                window.InventoryApp.Persistence.guardar(true);
            }

            // Precarga inteligente en caché local (IndexedDB) de URLs de imágenes
            if (window.InventoryApp && window.InventoryApp.ImageCache) {
                const urlsAPrecargar = [];
                (AppState.productos || []).forEach(p => { if (p.imagen) urlsAPrecargar.push(p.imagen); });
                (AppState.usuarios || []).forEach(u => { if (u.avatar) urlsAPrecargar.push(u.avatar); });
                window.InventoryApp.ImageCache.precargarImagenes(urlsAPrecargar);
            }

            refrescarTodasLasVistas();
            lastCloudSync = new Date();
            actualizarUIEstadoNube('conectado', 'Sincronizado con Firestore');
            return true;
        } catch (error) {
            if (esErrorDeCuota(error)) {
                manejarErrorCuota();
            } else {
                const esOffline = error && error.message && error.message.includes('offline');
                if (esOffline) {
                    console.info('[Firebase] Firestore en modo sin conexión. Continuando con almacenamiento local.');
                    actualizarUIEstadoNube('offline', 'Modo Offline (Caché local activa)');
                } else {
                    console.warn('[Firebase] Aviso de sincronización desde Firestore:', error.message || error);
                    actualizarUIEstadoNube('offline', 'Modo local activo');
                }
            }
            return false;
        }
    }

    /**
     * Sube todos los datos locales actuales a Firestore en lote (batch)
     */
    async function subirTodoALaNube() {
        if (!db || isQuotaExhausted) return false;

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
                const id = String(a.id || `AB-${idx}-${Date.now()}`);
                const ref = db.collection(COLLECTIONS.ABONOS).doc(id);
                const payload = sanitizarObjetoParaFirestore({ ...a, id }) || {};
                try {
                    payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
                } catch (e) {}
                batch.set(ref, payload, { merge: true });
            });

            // Transacciones
            AppState.transacciones.forEach(t => {
                const id = String(t.id);
                const ref = db.collection(COLLECTIONS.TRANSACCIONES).doc(id);
                const payload = sanitizarObjetoParaFirestore({ ...t, id }) || {};
                try {
                    payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
                } catch (e) {}
                batch.set(ref, payload, { merge: true });
            });

            // Auditorías
            AppState.auditorias.forEach(a => {
                const id = String(a.id || `AUD-${Date.now()}-${Math.random()}`);
                const ref = db.collection(COLLECTIONS.AUDITORIAS).doc(id);
                const payload = sanitizarObjetoParaFirestore({ ...a, id }) || {};
                batch.set(ref, payload, { merge: true });
            });

            // Eliminaciones
            AppState.eliminaciones.forEach(e => {
                const id = String(e.id || `EL-${Date.now()}-${Math.random()}`);
                const ref = db.collection(COLLECTIONS.ELIMINACIONES).doc(id);
                const payload = sanitizarObjetoParaFirestore({ ...e, id }) || {};
                batch.set(ref, payload, { merge: true });
            });

            // Clientes Eliminados
            AppState.clientesEliminados.forEach(c => {
                const id = String(c.id);
                const ref = db.collection(COLLECTIONS.CLIENTES_ELIMINADOS).doc(id);
                const payload = sanitizarObjetoParaFirestore({ ...c, id }) || {};
                batch.set(ref, payload, { merge: true });
            });

            // Usuarios
            (AppState.usuarios || []).forEach(u => {
                const id = String(u.id || u.cedula || '');
                if (id) {
                    const ref = db.collection(COLLECTIONS.USUARIOS).doc(id);
                    const payload = sanitizarObjetoParaFirestore({ ...u, id }) || {};
                    batch.set(ref, payload, { merge: true });
                }
            });

            // PagosPorVerificar
            (AppState.pagosPorVerificar || []).forEach(p => {
                const id = String(p.id || p.pedidoId || `PAGO_${Date.now()}`);
                const ref = db.collection(COLLECTIONS.PAGOS_POR_VERIFICAR).doc(id);
                const payload = sanitizarObjetoParaFirestore({ ...p, id }) || {};
                try {
                    payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
                } catch (e) {}
                batch.set(ref, payload, { merge: true });
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
            if (esErrorDeCuota(error)) {
                manejarErrorCuota();
            } else {
                console.error('[Firebase] Error al subir datos en lote a Firestore:', error);
                actualizarUIEstadoNube('error', 'Error al guardar en Firestore');
            }
            return false;
        }
    }

    // Control de debounce y hashes de carga para evitar bucles infinitos y re-renderizados innecesarios
    let refreshDebounceTimer = null;
    const lastCollectionHashes = {};

    function calcularHashColeccion(data) {
        try {
            return JSON.stringify(data || []);
        } catch {
            return '';
        }
    }

    function solicitarRefrescoVistasDebounced() {
        if (refreshDebounceTimer) {
            clearTimeout(refreshDebounceTimer);
        }
        refreshDebounceTimer = setTimeout(() => {
            refrescarTodasLasVistas();
        }, 120);
    }

    /**
     * Inicia listeners en tiempo real para mantener sincronizadas múltiples pestañas y clientes
     */
    function iniciarListenersTiempoReal() {
        if (!db || isQuotaExhausted) return;

        // Limpiar listeners previos
        detenerListenersTiempoReal();

        try {
            // Helper para persistir caché tras actualización en tiempo real
            const guardarCacheLocal = () => {
                if (window.InventoryApp && window.InventoryApp.Persistence) {
                    window.InventoryApp.Persistence.guardar(false);
                }
            };

            const manejarErrorListener = (nombre, err) => {
                if (esErrorDeCuota(err)) {
                    manejarErrorCuota();
                } else {
                    console.warn(`[Firebase] Listener de ${nombre} aviso:`, err ? err.message : err);
                }
            };

            // Listener de productos
            const unsubProds = db.collection(COLLECTIONS.PRODUCTOS).onSnapshot(snapshot => {
                if (!snapshot.metadata.hasPendingWrites) {
                    const newProds = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    const hash = calcularHashColeccion(newProds);
                    if (lastCollectionHashes[COLLECTIONS.PRODUCTOS] !== hash) {
                        lastCollectionHashes[COLLECTIONS.PRODUCTOS] = hash;
                        AppState.productos = newProds;
                        guardarCacheLocal();
                        solicitarRefrescoVistasDebounced();
                    }
                }
            }, err => manejarErrorListener('productos', err));
            syncListeners.push(unsubProds);

            // Listener de clientes
            const unsubCli = db.collection(COLLECTIONS.CLIENTES).onSnapshot(snapshot => {
                if (!snapshot.metadata.hasPendingWrites) {
                    const newClientes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    const hash = calcularHashColeccion(newClientes);
                    if (lastCollectionHashes[COLLECTIONS.CLIENTES] !== hash) {
                        lastCollectionHashes[COLLECTIONS.CLIENTES] = hash;
                        AppState.clientes = newClientes;
                        guardarCacheLocal();
                        solicitarRefrescoVistasDebounced();
                    }
                }
            }, err => manejarErrorListener('clientes', err));
            syncListeners.push(unsubCli);

            // Listener de usuarios con detección de nuevas solicitudes en tiempo real
            let primerCargaUsuarios = true;
            const unsubUsu = db.collection(COLLECTIONS.USUARIOS).onSnapshot(snapshot => {
                const newUsuarios = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                // Analizar cambios específicos de documentos
                try {
                    const changes = snapshot.docChanges ? snapshot.docChanges() : [];
                    changes.forEach(change => {
                        const u = { id: change.doc.id, ...change.doc.data() };
                        const idDoc = u.cedula || u.id;

                        if (change.type === 'added') {
                            // Detectar nueva solicitud
                            const existiaAntes = (AppState.usuarios || []).some(prev => (prev.cedula || prev.id) === idDoc);
                            if (!primerCargaUsuarios && (!existiaAntes || u.estado === 'PENDIENTE_APROBACION')) {
                                if (u.estado === 'PENDIENTE_APROBACION') {
                                    const usuarioSesion = window.AppState?.usuarioActual;
                                    const esAdminSesion = esUsuarioAdminActivo(usuarioSesion);

                                    // El administrador activo recibe la notificación visual y el sonido de alerta
                                    if (esAdminSesion) {
                                        reproducirSonidoNotificacion();
                                        const nombreUsu = u.nombre || u.cedula || 'Nuevo Usuario';
                                        const notifFn = window.showToast || window.showCustomToast || (window.InventoryApp && window.InventoryApp.Modal && window.InventoryApp.Modal.toast);
                                        if (typeof notifFn === 'function') {
                                            notifFn(`🔔 ¡Nueva solicitud de registro! <strong>${nombreUsu}</strong> (${idDoc}) espera aprobación.`, 'warning', 10000);
                                        }
                                    }
                                }
                            }
                        } else if (change.type === 'modified') {
                            // Si el usuario actual en sesión fue modificado (ej. Aprobado por el Admin)
                            if (AppState.usuarioActual && (AppState.usuarioActual.cedula || AppState.usuarioActual.id) === idDoc) {
                                const estadoPrevio = AppState.usuarioActual.estado;
                                AppState.usuarioActual = { ...AppState.usuarioActual, ...u };
                                if (estadoPrevio === 'PENDIENTE_APROBACION' && u.estado === 'ACTIVO') {
                                    reproducirSonidoNotificacion();
                                    if (typeof verificarGatewall === 'function') verificarGatewall();
                                    const alertFn = window.showAlert || window.showCustomAlert || (window.InventoryApp && window.InventoryApp.Modal && window.InventoryApp.Modal.alert);
                                    if (typeof alertFn === 'function') {
                                        alertFn('¡Cuenta Aprobada!', '¡Tu cuenta ha sido aprobada por el Administrador! Bienvenido al sistema.', 'success');
                                    }
                                } else if (u.estado === 'RECHAZADO' && estadoPrevio !== 'RECHAZADO') {
                                    if (typeof verificarGatewall === 'function') verificarGatewall();
                                }
                            }
                        } else if (change.type === 'removed') {
                            // Si el usuario actual en sesión fue eliminado en Firestore
                            if (AppState.usuarioActual && (AppState.usuarioActual.cedula || AppState.usuarioActual.id) === idDoc) {
                                if (idDoc !== 'SuperAdmin' && (AppState.usuarioActual.email || '').toLowerCase() !== 'superadmin@tubodeguita.com') {
                                    console.warn(`[Firebase Realtime] La cuenta activa ${idDoc} fue eliminada de Firestore. Cerrando sesión.`);
                                    AppState.usuarioActual = null;
                                    guardarCacheLocal();
                                    if (typeof verificarGatewall === 'function') verificarGatewall();
                                    const alertFn = window.showAlert || window.showCustomAlert || (window.InventoryApp && window.InventoryApp.Modal && window.InventoryApp.Modal.alert);
                                    if (typeof alertFn === 'function') {
                                        alertFn('Sesión Finalizada', 'Tu cuenta fue eliminada de la base de datos por el Administrador.', 'error');
                                    }
                                }
                            }
                        }
                    });
                } catch (chErr) {
                    console.warn('[Firebase] Aviso al procesar docChanges de usuarios:', chErr);
                }

                primerCargaUsuarios = false;
                const hash = calcularHashColeccion(newUsuarios);
                if (lastCollectionHashes[COLLECTIONS.USUARIOS] !== hash) {
                    lastCollectionHashes[COLLECTIONS.USUARIOS] = hash;
                    AppState.usuarios = newUsuarios;
                    if (window.InventoryApp.Persistence && typeof window.InventoryApp.Persistence.asegurarUsuarioAdminInicial === 'function') {
                        window.InventoryApp.Persistence.asegurarUsuarioAdminInicial();
                    }
                    guardarCacheLocal();
                    if (typeof actualizarBadgesUsuarios === 'function') {
                        actualizarBadgesUsuarios();
                    }
                    if (typeof renderizarUsuarios === 'function') {
                        renderizarUsuarios();
                    }
                    solicitarRefrescoVistasDebounced();
                }
            }, err => manejarErrorListener('usuarios', err));
            syncListeners.push(unsubUsu);

            // Listener de ventas
            const unsubVentas = db.collection(COLLECTIONS.VENTAS).onSnapshot(snapshot => {
                if (!snapshot.metadata.hasPendingWrites) {
                    const newVentas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    const hash = calcularHashColeccion(newVentas);
                    if (lastCollectionHashes[COLLECTIONS.VENTAS] !== hash) {
                        lastCollectionHashes[COLLECTIONS.VENTAS] = hash;
                        AppState.ventas = newVentas;
                        guardarCacheLocal();
                        solicitarRefrescoVistasDebounced();
                    }
                }
            }, err => manejarErrorListener('ventas', err));
            syncListeners.push(unsubVentas);

            // Listener de abonos en tiempo real con alerta auditiva y visual para el Administrador
            let primerCargaAbonos = true;
            const abonosNotificadosIds = new Set();
            const unsubAbonos = db.collection(COLLECTIONS.ABONOS).onSnapshot(snapshot => {
                const newAbonos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                try {
                    const changes = snapshot.docChanges ? snapshot.docChanges() : [];
                    changes.forEach(change => {
                        const abn = change.doc.data() || {};
                        const idDoc = change.doc.id;

                        if (change.type === 'added') {
                            if (!primerCargaAbonos) {
                                const esPendiente = abn.estado === 'PENDIENTE_CONFIRMACION';
                                const esAbonoAgregado = abn.estado === 'Pago agregado' || !abn.estado;
                                
                                if ((esPendiente || esAbonoAgregado) && !abonosNotificadosIds.has(idDoc)) {
                                    abonosNotificadosIds.add(idDoc);

                                    const usuarioSesion = window.AppState?.usuarioActual;
                                    const esAdminSesion = esUsuarioAdminActivo(usuarioSesion);

                                    if (esAdminSesion) {
                                        reproducirSonidoNotificacion();
                                        const clienteNom = abn.clienteNombre || abn.clienteCedula || abn.clienteId || 'Cliente';
                                        const montoFmt = Number(abn.montoUSD || 0).toFixed(2);
                                        const refFmt = abn.referencia ? ` (Ref: ${abn.referencia})` : '';
                                        const notifFn = window.showToast || window.showCustomToast || (window.InventoryApp && window.InventoryApp.Modal && window.InventoryApp.Modal.toast);
                                        if (typeof notifFn === 'function') {
                                            if (esPendiente) {
                                                notifFn(`💰 ¡Nuevo reporte de abono! <strong>${clienteNom}</strong> reportó $${montoFmt}${refFmt}. <button type="button" class="btn btn-sm btn-light" style="padding:2px 8px; margin-left:8px; font-weight:700; font-size:0.75rem; border:1px solid rgba(0,0,0,0.15);" onclick="if(typeof switchTab==='function')switchTab('transacciones')">Verificar</button>`, 'warning', 14000);
                                            } else {
                                                notifFn(`💰 ¡Abono agregado! <strong>${clienteNom}</strong> abonó $${montoFmt}${refFmt}.`, 'success', 8000);
                                            }
                                        }
                                    }
                                }
                            } else {
                                if (abn.estado === 'PENDIENTE_CONFIRMACION') {
                                    abonosNotificadosIds.add(idDoc);
                                }
                            }
                        } else if (change.type === 'modified') {
                            if (abn.estado === 'PENDIENTE_CONFIRMACION' && !abonosNotificadosIds.has(idDoc)) {
                                abonosNotificadosIds.add(idDoc);

                                const usuarioSesion = window.AppState?.usuarioActual;
                                const esAdminSesion = esUsuarioAdminActivo(usuarioSesion);

                                if (esAdminSesion) {
                                    reproducirSonidoNotificacion();
                                    const clienteNom = abn.clienteNombre || abn.clienteCedula || abn.clienteId || 'Cliente';
                                    const montoFmt = Number(abn.montoUSD || 0).toFixed(2);
                                    const refFmt = abn.referencia ? ` (Ref: ${abn.referencia})` : '';
                                    const notifFn = window.showToast || window.showCustomToast || (window.InventoryApp && window.InventoryApp.Modal && window.InventoryApp.Modal.toast);
                                    if (typeof notifFn === 'function') {
                                        notifFn(`💰 ¡Nuevo reporte de abono! <strong>${clienteNom}</strong> reportó $${montoFmt}${refFmt}. <button type="button" class="btn btn-sm btn-light" style="padding:2px 8px; margin-left:8px; font-weight:700; font-size:0.75rem; border:1px solid rgba(0,0,0,0.15);" onclick="if(typeof switchTab==='function')switchTab('transacciones')">Verificar</button>`, 'warning', 14000);
                                    }
                                }
                            }

                            // Si el usuario en sesión es el cliente de este abono y cambió de estado
                            const usuarioSesion = window.AppState?.usuarioActual;
                            const idSesion = String(usuarioSesion?.id || usuarioSesion?.cedula || '').trim();
                            if (usuarioSesion && (abn.clienteId === idSesion || abn.clienteCedula === idSesion || abn.clienteId === usuarioSesion.cedula)) {
                                if (abn.estado === 'Pago agregado' || abn.estado === 'Confirmado') {
                                    reproducirSonidoNotificacion();
                                    const alertFn = window.showAlert || window.showCustomAlert || (window.InventoryApp && window.InventoryApp.Modal && window.InventoryApp.Modal.alert);
                                    if (typeof alertFn === 'function') {
                                        alertFn('¡Abono Aprobado!', `Tu abono de $${Number(abn.montoUSD || 0).toFixed(2)} ha sido validado y conciliado por el Administrador. Tu saldo ha sido actualizado y tus puntos liberados.`, 'success');
                                    }
                                } else if (abn.estado === 'RECHAZADO') {
                                    const notifFn = window.showToast || window.showCustomToast || (window.InventoryApp && window.InventoryApp.Modal && window.InventoryApp.Modal.toast);
                                    if (typeof notifFn === 'function') {
                                        notifFn(`⚠️ Tu reporte de abono #${idDoc} fue marcado como Rechazado. Por favor verifica tus datos bancarios.`, 'error', 10000);
                                    }
                                }
                            }
                        }
                    });
                } catch (chErr) {
                    console.warn('[Firebase] Aviso al procesar docChanges de abonos:', chErr);
                }

                // Si en la primera carga hay abonos pendientes y el usuario actual es admin, avisar y sonar campana
                if (primerCargaAbonos) {
                    const pendientesIniciales = newAbonos.filter(a => a.estado === 'PENDIENTE_CONFIRMACION');
                    if (pendientesIniciales.length > 0) {
                        const usuarioSesion = window.AppState?.usuarioActual;
                        if (esUsuarioAdminActivo(usuarioSesion)) {
                            setTimeout(() => {
                                reproducirSonidoNotificacion();
                                const notifFn = window.showToast || window.showCustomToast || (window.InventoryApp && window.InventoryApp.Modal && window.InventoryApp.Modal.toast);
                                if (typeof notifFn === 'function') {
                                    notifFn(`🔔 Tienes <strong>${pendientesIniciales.length} reporte(s) de abono</strong> pendiente(s) por verificar. <button type="button" class="btn btn-sm btn-light" style="padding:2px 8px; margin-left:8px; font-weight:700; font-size:0.75rem; border:1px solid rgba(0,0,0,0.15);" onclick="if(typeof switchTab==='function')switchTab('transacciones')">Verificar</button>`, 'warning', 12000);
                                }
                            }, 800);
                        }
                    }
                }

                primerCargaAbonos = false;
                const hash = calcularHashColeccion(newAbonos);
                if (lastCollectionHashes[COLLECTIONS.ABONOS] !== hash) {
                    lastCollectionHashes[COLLECTIONS.ABONOS] = hash;
                    AppState.abonos = newAbonos;
                    guardarCacheLocal();
                    if (typeof actualizarBadgesAbonos === 'function') {
                        actualizarBadgesAbonos();
                    }
                    if (typeof renderizarAbonosPendientesReportados === 'function') {
                        renderizarAbonosPendientesReportados();
                    }
                    if (typeof renderizarEstadoCuentaCliente === 'function') {
                        renderizarEstadoCuentaCliente();
                    }
                    solicitarRefrescoVistasDebounced();
                }
            }, err => manejarErrorListener('abonos', err));
            syncListeners.push(unsubAbonos);

            // Listener en tiempo real de PagosPorVerificar (ventas y abonos pendientes de revisión)
            let primerCargaPagosPorVerificar = true;
            const pagosPorVerificarNotificadosIds = new Set();
            const unsubPagosPorVerificar = db.collection(COLLECTIONS.PAGOS_POR_VERIFICAR).onSnapshot(snapshot => {
                const newPagos = [];
                snapshot.docs.forEach(doc => {
                    const data = doc.data() || {};
                    if (Array.isArray(data.pagos)) {
                        data.pagos.forEach(p => { if (p && p.id) newPagos.push(p); });
                    }
                    if (Array.isArray(data.historial)) {
                        data.historial.forEach(p => { if (p && p.id) newPagos.push(p); });
                    }
                    newPagos.push({ id: doc.id, ...data });
                });

                try {
                    const changes = snapshot.docChanges ? snapshot.docChanges() : [];
                    changes.forEach(change => {
                        const pago = change.doc.data() || {};
                        const idDoc = change.doc.id;

                        if (change.type === 'added' || change.type === 'modified') {
                            const esPendiente = !pago.estado || pago.estado === 'PENDIENTE_VERIFICACION' || pago.estado === 'PENDIENTE_CONFIRMACION' || pago.estado === 'PENDIENTE' || pago.estado === 'POR_VERIFICAR';
                            if (!primerCargaPagosPorVerificar && esPendiente && !pagosPorVerificarNotificadosIds.has(idDoc)) {
                                pagosPorVerificarNotificadosIds.add(idDoc);

                                const usuarioSesion = window.AppState?.usuarioActual;
                                const esAdminSesion = esUsuarioAdminActivo(usuarioSesion);

                                if (esAdminSesion) {
                                    reproducirSonidoNotificacion();
                                    const clienteNom = pago.clienteNombre || pago.clienteCedula || pago.clienteId || 'Cliente';
                                    const montoFmt = Number(pago.totalUSD || pago.montoUSD || pago.total || 0).toFixed(2);
                                    const metodoNom = pago.metodoPago || pago.tipoPago || pago.tipo || 'Pago';
                                    const refFmt = pago.referencia && pago.referencia !== 'N/A' ? ` (Ref: ${pago.referencia})` : '';
                                    const notifFn = window.showToast || window.showCustomToast || (window.InventoryApp && window.InventoryApp.Modal && window.InventoryApp.Modal.toast);
                                    if (typeof notifFn === 'function') {
                                        notifFn(`🔔 <strong>¡Nuevo Pago por Verificar!</strong> ${clienteNom} registró venta/pago de $${montoFmt} vía <strong>${metodoNom}</strong>${refFmt}. <button type="button" class="btn btn-sm btn-light" style="padding:2px 8px; margin-left:8px; font-weight:700; font-size:0.75rem; border:1px solid rgba(0,0,0,0.15);" onclick="if(typeof switchTab==='function')switchTab('transacciones')">Verificar</button>`, 'warning', 15000);
                                    }
                                }
                            }
                        }
                    });
                } catch (chErr) {
                    console.warn('[Firebase] Aviso al procesar docChanges de PagosPorVerificar:', chErr);
                }

                if (primerCargaPagosPorVerificar) {
                    const pendientesIniciales = newPagos.filter(p => !p.estado || p.estado === 'PENDIENTE_VERIFICACION' || p.estado === 'PENDIENTE_CONFIRMACION' || p.estado === 'PENDIENTE' || p.estado === 'POR_VERIFICAR');
                    if (pendientesIniciales.length > 0) {
                        const usuarioSesion = window.AppState?.usuarioActual;
                        if (esUsuarioAdminActivo(usuarioSesion)) {
                            setTimeout(() => {
                                reproducirSonidoNotificacion();
                                const notifFn = window.showToast || window.showCustomToast || (window.InventoryApp && window.InventoryApp.Modal && window.InventoryApp.Modal.toast);
                                if (typeof notifFn === 'function') {
                                    notifFn(`🔔 Tienes <strong>${pendientesIniciales.length} pago(s) o venta(s) por verificar</strong> en Firebase. <button type="button" class="btn btn-sm btn-light" style="padding:2px 8px; margin-left:8px; font-weight:700; font-size:0.75rem; border:1px solid rgba(0,0,0,0.15);" onclick="if(typeof switchTab==='function')switchTab('transacciones')">Verificar</button>`, 'warning', 12000);
                                }
                            }, 1000);
                        }
                    }
                }

                primerCargaPagosPorVerificar = false;
                AppState.pagosPorVerificar = newPagos;
                guardarCacheLocal();
                if (typeof renderizarAbonosPendientesReportados === 'function') {
                    renderizarAbonosPendientesReportados();
                }
                solicitarRefrescoVistasDebounced();
            }, err => manejarErrorListener('PagosPorVerificar', err));
            syncListeners.push(unsubPagosPorVerificar);

            // Listener de transacciones
            const unsubTx = db.collection(COLLECTIONS.TRANSACCIONES).onSnapshot(snapshot => {
                if (!snapshot.metadata.hasPendingWrites) {
                    const newTx = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    const hash = calcularHashColeccion(newTx);
                    if (lastCollectionHashes[COLLECTIONS.TRANSACCIONES] !== hash) {
                        lastCollectionHashes[COLLECTIONS.TRANSACCIONES] = hash;
                        AppState.transacciones = newTx;
                        guardarCacheLocal();
                        solicitarRefrescoVistasDebounced();
                    }
                }
            }, err => manejarErrorListener('transacciones', err));
            syncListeners.push(unsubTx);

            // Listener de auditorias
            const unsubAud = db.collection(COLLECTIONS.AUDITORIAS).onSnapshot(snapshot => {
                if (!snapshot.metadata.hasPendingWrites) {
                    const newAud = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    const hash = calcularHashColeccion(newAud);
                    if (lastCollectionHashes[COLLECTIONS.AUDITORIAS] !== hash) {
                        lastCollectionHashes[COLLECTIONS.AUDITORIAS] = hash;
                        AppState.auditorias = newAud;
                        guardarCacheLocal();
                        solicitarRefrescoVistasDebounced();
                    }
                }
            }, err => manejarErrorListener('auditorias', err));
            syncListeners.push(unsubAud);

            // Listener de eliminaciones
            const unsubElim = db.collection(COLLECTIONS.ELIMINACIONES).onSnapshot(snapshot => {
                if (!snapshot.metadata.hasPendingWrites) {
                    const newElim = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    const hash = calcularHashColeccion(newElim);
                    if (lastCollectionHashes[COLLECTIONS.ELIMINACIONES] !== hash) {
                        lastCollectionHashes[COLLECTIONS.ELIMINACIONES] = hash;
                        AppState.eliminaciones = newElim;
                        guardarCacheLocal();
                        solicitarRefrescoVistasDebounced();
                    }
                }
            }, err => manejarErrorListener('eliminaciones', err));
            syncListeners.push(unsubElim);

            // Listener de clientes eliminados
            const unsubCliElim = db.collection(COLLECTIONS.CLIENTES_ELIMINADOS).onSnapshot(snapshot => {
                if (!snapshot.metadata.hasPendingWrites) {
                    const newCliElim = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    const hash = calcularHashColeccion(newCliElim);
                    if (lastCollectionHashes[COLLECTIONS.CLIENTES_ELIMINADOS] !== hash) {
                        lastCollectionHashes[COLLECTIONS.CLIENTES_ELIMINADOS] = hash;
                        AppState.clientesEliminados = newCliElim;
                        guardarCacheLocal();
                        solicitarRefrescoVistasDebounced();
                    }
                }
            }, err => manejarErrorListener('clientes eliminados', err));
            syncListeners.push(unsubCliElim);

            // Listener de canjes de premios
            const unsubCanjes = db.collection(COLLECTIONS.CANJES).onSnapshot(snapshot => {
                if (!snapshot.metadata.hasPendingWrites) {
                    const newCanjes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    const hash = calcularHashColeccion(newCanjes);
                    if (lastCollectionHashes[COLLECTIONS.CANJES] !== hash) {
                        lastCollectionHashes[COLLECTIONS.CANJES] = hash;
                        AppState.canjesPremios = newCanjes;
                        guardarCacheLocal();
                        solicitarRefrescoVistasDebounced();
                    }
                }
            }, err => manejarErrorListener('canjes', err));
            syncListeners.push(unsubCanjes);

            // Listener de configuración
            const unsubConfig = db.collection(COLLECTIONS.CONFIG).doc('global').onSnapshot(doc => {
                if (doc.exists && !doc.metadata.hasPendingWrites) {
                    const cfg = doc.data();
                    const hash = calcularHashColeccion(cfg);
                    if (lastCollectionHashes[COLLECTIONS.CONFIG] !== hash) {
                        lastCollectionHashes[COLLECTIONS.CONFIG] = hash;
                        if (cfg.nextProductSequence) AppState.nextProductSequence = cfg.nextProductSequence;
                        if (cfg.premioMes) AppState.premioMes = cfg.premioMes;
                        if (typeof cfg.temporadaInviernoActiva === 'boolean') AppState.temporadaInviernoActiva = cfg.temporadaInviernoActiva;
                        if (cfg.treeProgress) AppState.treeProgress = cfg.treeProgress;
                        guardarCacheLocal();
                        solicitarRefrescoVistasDebounced();
                    }
                }
            }, err => manejarErrorListener('config', err));
            syncListeners.push(unsubConfig);

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
        if (typeof renderizarAbonosPendientesReportados === 'function') renderizarAbonosPendientesReportados();
        if (typeof actualizarBadgesAbonos === 'function') actualizarBadgesAbonos();
        if (typeof renderizarEstadoCuentaCliente === 'function') renderizarEstadoCuentaCliente();
    }

    // =========================================================================
    // OPERACIONES CRUD ASÍNCRONAS CON FIRESTORE
    // =========================================================================

    /**
     * CRUD: Guardar / Actualizar Producto en Firestore
     */
    async function guardarProductoCloud(producto) {
        if (!producto || !producto.id) return false;

        // Persistir siempre localmente primero
        if (window.InventoryApp && window.InventoryApp.Persistence) {
            window.InventoryApp.Persistence.guardar(true);
        }

        if (isQuotaExhausted) {
            actualizarUIEstadoNube('offline', 'Guardado localmente (Cuota Firestore activa)');
            return true;
        }

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
            if (esErrorDeCuota(error)) {
                manejarErrorCuota();
            } else {
                console.error('[Firebase] Error al guardar producto en Firestore:', error);
                actualizarUIEstadoNube('offline', 'Guardado localmente (Offline)');
            }
            return true;
        }
    }

    /**
     * CRUD: Eliminar Producto de Firestore
     */
    async function eliminarProductoCloud(productoId) {
        if (!productoId) return false;

        if (window.InventoryApp && window.InventoryApp.Persistence) {
            window.InventoryApp.Persistence.guardar(true);
        }

        if (isQuotaExhausted) {
            actualizarUIEstadoNube('offline', 'Eliminado localmente (Cuota Firestore activa)');
            return true;
        }

        actualizarUIEstadoNube('sincronizando', 'Actualizando inventario en la nube...');

        try {
            if (db) {
                await db.collection(COLLECTIONS.PRODUCTOS).doc(String(productoId)).delete();
            }
            actualizarUIEstadoNube('conectado', 'Inventario actualizado en Firestore');
            return true;
        } catch (error) {
            if (esErrorDeCuota(error)) {
                manejarErrorCuota();
            } else {
                console.error('[Firebase] Error al eliminar producto en Firestore:', error);
                actualizarUIEstadoNube('offline', 'Modificado localmente (Offline)');
            }
            return true;
        }
    }

    /**
     * CRUD: Procesar Venta Atómica en Firestore (Registrar Venta y Descontar Stock de Productos)
     */
    async function registrarVentaCloud(venta, itemsVendidos) {
        if (!venta || !venta.id) return false;

        if (window.InventoryApp && window.InventoryApp.Persistence) {
            window.InventoryApp.Persistence.guardar(true);
        }

        if (isQuotaExhausted) {
            actualizarUIEstadoNube('offline', 'Venta guardada localmente (Cuota Firestore activa)');
            return true;
        }

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
            if (esErrorDeCuota(error)) {
                manejarErrorCuota();
            } else {
                console.error('[Firebase] Error al registrar venta en Firestore:', error);
                actualizarUIEstadoNube('offline', 'Venta guardada localmente (Offline)');
            }
            return true;
        }
    }

    /**
     * CRUD: Guardar / Registrar Cliente en Firestore
     */
    async function guardarClienteCloud(cliente) {
        if (!cliente || !cliente.id) return false;

        if (window.InventoryApp && window.InventoryApp.Persistence) {
            window.InventoryApp.Persistence.guardar(true);
        }

        if (isQuotaExhausted) {
            actualizarUIEstadoNube('offline', 'Cliente guardado localmente (Cuota Firestore activa)');
            return true;
        }

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
            if (esErrorDeCuota(error)) {
                manejarErrorCuota();
            } else {
                console.error('[Firebase] Error al guardar cliente en Firestore:', error);
                actualizarUIEstadoNube('offline', 'Cliente guardado localmente (Offline)');
            }
            return true;
        }
    }

    /**
     * CRUD: Eliminar Cliente de Firestore y registrar en ClientesEliminados
     */
    async function eliminarClienteCloud(clienteId, registroEliminado) {
        if (!clienteId) return false;

        if (window.InventoryApp && window.InventoryApp.Persistence) {
            window.InventoryApp.Persistence.guardar(true);
        }

        if (isQuotaExhausted) {
            actualizarUIEstadoNube('offline', 'Cliente eliminado localmente (Cuota Firestore activa)');
            return true;
        }

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
            if (esErrorDeCuota(error)) {
                manejarErrorCuota();
            } else {
                console.error('[Firebase] Error al eliminar cliente en Firestore:', error);
                actualizarUIEstadoNube('offline', 'Cliente eliminado localmente (Offline)');
            }
            return true;
        }
    }

    /**
     * CRUD: Guardar Abono / Pago en Firestore
     */
    async function guardarAbonoCloud(abono) {
        if (!abono) return false;

        if (window.InventoryApp && window.InventoryApp.Persistence) {
            window.InventoryApp.Persistence.guardar(true);
        }

        if (isQuotaExhausted) {
            actualizarUIEstadoNube('offline', 'Pago guardado localmente (Cuota Firestore activa)');
            return true;
        }

        actualizarUIEstadoNube('sincronizando', 'Registrando pago en Firestore...');

        try {
            if (!db) {
                await inicializarFirebase();
            }

            if (db) {
                const id = String(abono.id || `ABN_${Date.now()}`);
                const docRef = db.collection(COLLECTIONS.ABONOS).doc(id);
                const payload = sanitizarObjetoParaFirestore({ ...abono, id }) || {};
                try {
                    if (firebase && firebase.firestore && firebase.firestore.FieldValue) {
                        payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
                        if (!payload.createdAt) {
                            payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                        }
                    } else {
                        const nowIso = new Date().toISOString();
                        payload.updatedAt = nowIso;
                        if (!payload.createdAt) payload.createdAt = nowIso;
                    }
                } catch (tsErr) {
                    payload.updatedAt = new Date().toISOString();
                }

                await docRef.set(payload, { merge: true });
                console.log('[Firebase] Abono guardado exitosamente en Firestore:', id);
            }

            actualizarUIEstadoNube('conectado', 'Pago registrado en Firestore');
            return true;
        } catch (error) {
            if (esErrorDeCuota(error)) {
                manejarErrorCuota();
            } else {
                console.error('[Firebase] Error al registrar abono en Firestore:', error);
                actualizarUIEstadoNube('offline', 'Pago guardado localmente (Offline)');
            }
            return false;
        }
    }

    /**
     * CRUD: Guardar / Actualizar Transacción Bancaria
     */
    async function guardarTransaccionCloud(tx) {
        if (!tx || !tx.id) return false;

        if (window.InventoryApp && window.InventoryApp.Persistence) {
            window.InventoryApp.Persistence.guardar(true);
        }

        if (isQuotaExhausted) {
            actualizarUIEstadoNube('offline', 'Transacción guardada localmente');
            return true;
        }

        actualizarUIEstadoNube('sincronizando', 'Guardando transacción...');

        try {
            if (!db) {
                await inicializarFirebase();
            }

            if (db) {
                const id = String(tx.id);
                const docRef = db.collection(COLLECTIONS.TRANSACCIONES).doc(id);
                const payload = sanitizarObjetoParaFirestore({ ...tx, id }) || {};
                try {
                    if (firebase && firebase.firestore && firebase.firestore.FieldValue) {
                        payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
                    } else {
                        payload.updatedAt = new Date().toISOString();
                    }
                } catch (tsErr) {
                    payload.updatedAt = new Date().toISOString();
                }

                await docRef.set(payload, { merge: true });
                console.log('[Firebase] Transacción guardada exitosamente en Firestore:', id);
            }

            actualizarUIEstadoNube('conectado', 'Transacción guardada');
            return true;
        } catch (error) {
            if (esErrorDeCuota(error)) {
                manejarErrorCuota();
            } else {
                console.error('[Firebase] Error al guardar transacción:', error);
                actualizarUIEstadoNube('offline', 'Transacción guardada localmente (Offline)');
            }
            return false;
        }
    }

    /**
     * CRUD: Guardar o actualizar registro de Pago o Venta en PagosPorVerificar de Firestore
     */
    async function guardarPagoPorVerificarCloud(datosPago) {
        if (!datosPago) return false;

        AppState.pagosPorVerificar = AppState.pagosPorVerificar || [];
        const id = String(datosPago.id || datosPago.pedidoId || `PAGO_${Date.now()}`);
        const idx = AppState.pagosPorVerificar.findIndex(p => p.id === id);
        if (idx >= 0) {
            AppState.pagosPorVerificar[idx] = { ...AppState.pagosPorVerificar[idx], ...datosPago, id };
        } else {
            AppState.pagosPorVerificar.unshift({ ...datosPago, id });
        }

        if (window.InventoryApp && window.InventoryApp.Persistence) {
            window.InventoryApp.Persistence.guardar(true);
        }

        if (isQuotaExhausted) {
            actualizarUIEstadoNube('offline', 'Pago guardado localmente (Cuota activa)');
            return true;
        }

        actualizarUIEstadoNube('sincronizando', 'Guardando en PagosPorVerificar de Firestore...');

        try {
            if (!db) {
                await inicializarFirebase();
            }

            if (db) {
                const docRef = db.collection(COLLECTIONS.PAGOS_POR_VERIFICAR).doc(id);
                const payload = sanitizarObjetoParaFirestore({
                    ...datosPago,
                    id,
                    estado: datosPago.estado || 'PENDIENTE_VERIFICACION'
                }) || {};

                try {
                    if (firebase && firebase.firestore && firebase.firestore.FieldValue) {
                        payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
                        if (!payload.createdAt) {
                            payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                        }
                    } else {
                        payload.updatedAt = new Date().toISOString();
                        if (!payload.createdAt) payload.createdAt = new Date().toISOString();
                    }
                } catch (tsErr) {
                    payload.updatedAt = new Date().toISOString();
                }

                // 1. Guardar documento individual en la colección PagosPorVerificar
                await docRef.set(payload, { merge: true });
                console.log('[Firebase] Pago guardado con éxito en PagosPorVerificar:', id);

                // 2. Si el usuario creó o espera un documento raíz llamado 'PagosPorVerificar'
                try {
                    const docMaestroRef = db.collection(COLLECTIONS.PAGOS_POR_VERIFICAR).doc('PagosPorVerificar');
                    if (id !== 'PagosPorVerificar') {
                        await docMaestroRef.set({
                            ultimoPago: payload,
                            totalPendientes: (AppState.pagosPorVerificar || []).filter(p => !p.estado || p.estado === 'PENDIENTE_VERIFICACION' || p.estado === 'PENDIENTE_CONFIRMACION').length,
                            updatedAt: payload.updatedAt
                        }, { merge: true });
                    }
                } catch (maestroErr) {}

                // 3. Documento redundante en app_state
                try {
                    await db.collection('app_state').doc('PagosPorVerificar').set({
                        ultimoPago: payload,
                        updatedAt: payload.updatedAt
                    }, { merge: true });
                } catch (appErr) {}
            }

            actualizarUIEstadoNube('conectado', 'PagosPorVerificar actualizado');
            return true;
        } catch (error) {
            if (esErrorDeCuota(error)) {
                manejarErrorCuota();
            } else {
                console.error('[Firebase] Error al guardar en PagosPorVerificar:', error);
                actualizarUIEstadoNube('offline', 'Pago guardado localmente (Offline)');
            }
            return false;
        }
    }

    /**
     * CRUD: Actualizar estado de un pago en PagosPorVerificar (APROBADO, RECHAZADO)
     */
    async function actualizarEstadoPagoPorVerificarCloud(id, nuevoEstado, motivo = '') {
        if (!id) return false;
        id = String(id);

        AppState.pagosPorVerificar = AppState.pagosPorVerificar || [];
        const item = AppState.pagosPorVerificar.find(p => p.id === id);
        if (item) {
            item.estado = nuevoEstado;
            if (motivo) item.motivoRechazo = motivo;
            item.fechaRevision = new Date().toISOString();
        }

        if (window.InventoryApp && window.InventoryApp.Persistence) {
            window.InventoryApp.Persistence.guardar(true);
        }

        try {
            if (!db) await inicializarFirebase();
            if (db) {
                const docRef = db.collection(COLLECTIONS.PAGOS_POR_VERIFICAR).doc(id);
                const payload = {
                    estado: nuevoEstado,
                    fechaRevision: new Date().toISOString()
                };
                if (motivo) payload.motivoRechazo = motivo;
                try {
                    if (firebase && firebase.firestore && firebase.firestore.FieldValue) {
                        payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
                    }
                } catch (e) {}

                await docRef.set(payload, { merge: true });

                try {
                    const docMaestroRef = db.collection(COLLECTIONS.PAGOS_POR_VERIFICAR).doc('PagosPorVerificar');
                    await docMaestroRef.set({
                        ultimoCambio: { id, estado: nuevoEstado },
                        updatedAt: payload.updatedAt || new Date().toISOString()
                    }, { merge: true });
                } catch (e) {}
            }
            return true;
        } catch (err) {
            console.warn('[Firebase] Error al actualizar estado en PagosPorVerificar:', err);
            return false;
        }
    }

    /**
     * CRUD: Registrar Auditoría y Ajuste de Stock en Firestore
     */
    async function registrarAuditoriaCloud(registroAuditoria, productoId, nuevoStock) {
        if (!registroAuditoria) return false;

        if (window.InventoryApp && window.InventoryApp.Persistence) {
            window.InventoryApp.Persistence.guardar(true);
        }

        if (isQuotaExhausted) {
            actualizarUIEstadoNube('offline', 'Auditoría guardada localmente');
            return true;
        }

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
            if (esErrorDeCuota(error)) {
                manejarErrorCuota();
            } else {
                console.error('[Firebase] Error al registrar auditoría:', error);
            }
            return true;
        }
    }

    /**
     * CRUD: Registrar Retiro / Pérdida de Producto en Firestore
     */
    async function registrarEliminacionCloud(registroEliminacion, productoId, nuevoStock) {
        if (!registroEliminacion) return false;

        if (window.InventoryApp && window.InventoryApp.Persistence) {
            window.InventoryApp.Persistence.guardar(true);
        }

        if (isQuotaExhausted) {
            actualizarUIEstadoNube('offline', 'Retiro registrado localmente');
            return true;
        }

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
            if (esErrorDeCuota(error)) {
                manejarErrorCuota();
            } else {
                console.error('[Firebase] Error al registrar retiro:', error);
            }
            return true;
        }
    }

    /**
     * CRUD: Guardar / Actualizar Usuario en Firestore
     */
    async function guardarUsuarioCloud(usuario) {
        if (!usuario || (!usuario.id && !usuario.cedula)) return false;
        const id = usuario.id || usuario.cedula;

        if (window.InventoryApp && window.InventoryApp.Persistence) {
            window.InventoryApp.Persistence.guardar(true);
        }

        if (isQuotaExhausted) {
            actualizarUIEstadoNube('offline', 'Usuario guardado localmente');
            return true;
        }

        actualizarUIEstadoNube('sincronizando', 'Guardando usuario en Firestore...');

        try {
            if (!db) {
                await inicializarFirebase();
            }

            if (db) {
                const docRef = db.collection(COLLECTIONS.USUARIOS).doc(String(id));
                const payload = {
                    ...usuario,
                    id: String(id),
                    cedula: usuario.cedula || String(id),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                const writePromise = docRef.set(payload, { merge: true });
                const timeoutPromise = new Promise(resolve => setTimeout(() => resolve('timeout'), 2000));
                await Promise.race([writePromise, timeoutPromise]);
            }

            actualizarUIEstadoNube('conectado', 'Usuario guardado en Firestore');
            return true;
        } catch (error) {
            if (esErrorDeCuota(error)) {
                manejarErrorCuota();
            } else {
                console.error('[Firebase] Error al guardar usuario en Firestore:', error);
                actualizarUIEstadoNube('error', 'Error al guardar usuario');
            }
            return true;
        }
    }

    /**
     * CRUD: Eliminar Usuario de Firestore
     */
    async function eliminarUsuarioCloud(usuarioId) {
        if (!usuarioId) return false;

        if (window.InventoryApp && window.InventoryApp.Persistence) {
            window.InventoryApp.Persistence.guardar(true);
        }

        if (isQuotaExhausted) {
            actualizarUIEstadoNube('offline', 'Usuario eliminado localmente');
            return true;
        }

        actualizarUIEstadoNube('sincronizando', 'Eliminando usuario de Firestore...');

        try {
            if (!db) {
                await inicializarFirebase();
            }

            if (db) {
                const batch = db.batch();
                const strId = String(usuarioId);

                // 1. Borrar por doc ID directo
                const docRef = db.collection(COLLECTIONS.USUARIOS).doc(strId);
                batch.delete(docRef);

                // 2. Buscar por campo 'cedula' y agregarlo al lote
                try {
                    const snapCedula = await db.collection(COLLECTIONS.USUARIOS).where('cedula', '==', strId).get();
                    if (!snapCedula.empty) {
                        snapCedula.docs.forEach(d => batch.delete(d.ref));
                    }
                } catch (e) {}

                // 3. Buscar por campo 'id' y agregarlo al lote
                try {
                    const snapId = await db.collection(COLLECTIONS.USUARIOS).where('id', '==', strId).get();
                    if (!snapId.empty) {
                        snapId.docs.forEach(d => batch.delete(d.ref));
                    }
                } catch (e) {}

                await batch.commit();
                console.log(`[Firebase] Usuario ${strId} eliminado permanentemente de Firestore.`);
            }

            actualizarUIEstadoNube('conectado', 'Usuario eliminado de Firestore');
            return true;
        } catch (error) {
            if (esErrorDeCuota(error)) {
                manejarErrorCuota();
            } else {
                console.error('[Firebase] Error al eliminar usuario en Firestore:', error);
                actualizarUIEstadoNube('error', 'Error al eliminar usuario');
            }
            return true;
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

    /**
     * Consulta Firestore directamente para verificar si un usuario existe y obtener sus datos más recientes
     */
    async function obtenerUsuarioCloud(identificador) {
        if (!identificador) return null;

        const rawId = String(identificador).trim();
        const cleanId = rawId.toUpperCase();
        const cleanEmail = rawId.toLowerCase();

        // Si la cuota de Firestore está agotada o el modo offline está activo, buscar en memoria local
        if (isQuotaExhausted) {
            return (AppState.usuarios || []).find(u => 
                (u.id || '').trim().toUpperCase() === cleanId ||
                (u.cedula || '').trim().toUpperCase() === cleanId || 
                (u.nombre || '').trim().toUpperCase() === cleanId ||
                (u.email || '').trim().toLowerCase() === cleanEmail
            ) || null;
        }

        if (!db) {
            try {
                await inicializarFirebase();
            } catch (e) {}
        }
        if (!db) return null;

        try {
            // 1. Doc directo por ID exacto
            const docRef = await db.collection(COLLECTIONS.USUARIOS).doc(rawId).get();
            if (docRef.exists) {
                return { id: docRef.id, ...docRef.data() };
            }

            // 2. Doc directo por ID en mayúsculas
            if (cleanId !== rawId) {
                const docRefUpper = await db.collection(COLLECTIONS.USUARIOS).doc(cleanId).get();
                if (docRefUpper.exists) {
                    return { id: docRefUpper.id, ...docRefUpper.data() };
                }
            }

            // 3. Query por campo 'cedula'
            const snapCedula = await db.collection(COLLECTIONS.USUARIOS).where('cedula', '==', rawId).limit(1).get();
            if (!snapCedula.empty) {
                const doc = snapCedula.docs[0];
                return { id: doc.id, ...doc.data() };
            }
            if (cleanId !== rawId) {
                const snapCedUpper = await db.collection(COLLECTIONS.USUARIOS).where('cedula', '==', cleanId).limit(1).get();
                if (!snapCedUpper.empty) {
                    const doc = snapCedUpper.docs[0];
                    return { id: doc.id, ...doc.data() };
                }
            }

            // 4. Query por campo 'email'
            const snapEmail = await db.collection(COLLECTIONS.USUARIOS).where('email', '==', cleanEmail).limit(1).get();
            if (!snapEmail.empty) {
                const doc = snapEmail.docs[0];
                return { id: doc.id, ...doc.data() };
            }

            // 5. Query por campo 'id'
            const snapId = await db.collection(COLLECTIONS.USUARIOS).where('id', '==', rawId).limit(1).get();
            if (!snapId.empty) {
                const doc = snapId.docs[0];
                return { id: doc.id, ...doc.data() };
            }

            return null; // El usuario NO existe en Firestore (fue eliminado o no existe)
        } catch (err) {
            if (esErrorDeCuota(err)) {
                manejarErrorCuota();
                return (AppState.usuarios || []).find(u => 
                    (u.id || '').trim().toUpperCase() === cleanId ||
                    (u.cedula || '').trim().toUpperCase() === cleanId || 
                    (u.nombre || '').trim().toUpperCase() === cleanId ||
                    (u.email || '').trim().toLowerCase() === cleanEmail
                ) || null;
            }
            console.warn('[Firebase] Error consultando usuario en Firestore:', err);
            return null;
        }
    }

    /**
     * Prueba la conexión en vivo con Firebase realizando una lectura/escritura de comprobación
     */
    async function testConexionFirebase() {
        const t0 = performance.now();
        try {
            if (!db) {
                await inicializarFirebase();
            }
            if (!db) {
                return { ok: false, error: 'No se pudo inicializar la conexión con Firestore.' };
            }
            const cfg = obtenerConfiguracion();
            const testRef = db.collection('config').doc('_diagnostics');
            const nowIso = new Date().toISOString();
            await testRef.set({
                ultimoPing: nowIso,
                clienteTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
                tipoDispositivo: /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? 'Teléfono / Móvil' : 'Computadora (PC/Mac)'
            }, { merge: true });

            const snap = await testRef.get();
            const latency = Math.round(performance.now() - t0);
            return {
                ok: true,
                latency,
                projectId: cfg.projectId,
                docData: snap.data(),
                message: `Conexión con Firestore exitosa (${latency}ms)`
            };
        } catch (err) {
            return {
                ok: false,
                latency: Math.round(performance.now() - t0),
                error: err.message || String(err)
            };
        }
    }

    /**
     * Restablece la configuración de Firebase a los valores predeterminados oficiales
     */
    async function restablecerConfiguracionPredeterminada() {
        localStorage.removeItem('bodeguita_firebase_custom_config');
        detenerListenersTiempoReal();
        inicializado = false;
        db = null;
        await inicializarFirebase();
        await sincronizarTodoDesdeNube();
        refrescarTodasLasVistas();
        return true;
    }

    /**
     * Guarda una configuración personalizada de Firebase
     */
    async function guardarConfiguracionPersonalizada(configObj) {
        if (!configObj || !configObj.projectId || !configObj.apiKey) {
            throw new Error('El ID de Proyecto y la API Key son obligatorios.');
        }
        localStorage.setItem('bodeguita_firebase_custom_config', JSON.stringify(configObj));
        detenerListenersTiempoReal();
        inicializado = false;
        db = null;
        await inicializarFirebase();
        await sincronizarTodoDesdeNube();
        refrescarTodasLasVistas();
        return true;
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
        guardarPagoPorVerificar: guardarPagoPorVerificarCloud,
        actualizarEstadoPagoPorVerificar: actualizarEstadoPagoPorVerificarCloud,
        registrarAuditoria: registrarAuditoriaCloud,
        registrarEliminacion: registrarEliminacionCloud,
        guardarUsuario: guardarUsuarioCloud,
        eliminarUsuario: eliminarUsuarioCloud,
        obtenerUsuario: obtenerUsuarioCloud,
        testConexion: testConexionFirebase,
        restablecerConfiguracionPredeterminada,
        guardarConfiguracionPersonalizada,
        reproducirSonidoNotificacion: reproducirSonidoNotificacion,
        purgarBaseDeDatosCompleta: purgarBaseDeDatosCompletaCloud,
        actualizarUIEstadoNube,
        getConfig: obtenerConfiguracion
    };
})();
