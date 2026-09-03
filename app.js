/* app.js - composition root */
(function () {
    function sincronizarSecuenciaIdsProducto() {
        let max = 0;
        productos.forEach(p => {
            const match = String(p?.id || '').match(/^P(\d+)$/i);
            if (match) max = Math.max(max, Number(match[1]));
        });
        AppState.nextProductSequence = Math.max(AppState.nextProductSequence, max + 1);
    }

    document.addEventListener('DOMContentLoaded', () => {
        InventoryApp.Persistence.iniciar();
        if (window.InventoryApp && window.InventoryApp.GoogleDrive && typeof window.InventoryApp.GoogleDrive.init === 'function') {
            window.InventoryApp.GoogleDrive.init();
        }
        sincronizarSecuenciaIdsProducto();
        if (typeof iniciarSincronizacionBCV === 'function') {
            iniciarSincronizacionBCV();
        } else {
            obtenerTasaOficialBCV();
        }

        // Renderizado inicial de vistas del sistema
        if (window.InventoryApp && window.InventoryApp.Theme && typeof window.InventoryApp.Theme.inicializarTema === 'function') {
            window.InventoryApp.Theme.inicializarTema();
        }

        renderizarPosProductos();
        renderizarInventario();
        renderizarClientes();
        renderizarHistorialClientesEliminados();
        actualizarSelectClientes();
        renderizarAuditoria();
        renderizarHistorialAuditoria();
        renderizarResumenPerdidasEconomicas();
        actualizarSelectTransacciones();
        renderizarTransacciones();
        if (typeof renderizarAbonosPendientesReportados === 'function') renderizarAbonosPendientesReportados();
        if (typeof actualizarBadgesAbonos === 'function') actualizarBadgesAbonos();
        if (typeof verificarPenalizacionesPorMoraGlobal === 'function') verificarPenalizacionesPorMoraGlobal();
        prepararCodigoNuevoProducto();
        actualizarVistaImagenProducto();

        // Módulo de Usuarios, Control de Acceso y Aprobaciones
        if (typeof renderizarUsuarios === 'function') renderizarUsuarios();
        if (typeof actualizarBadgesUsuarios === 'function') actualizarBadgesUsuarios();
        if (typeof actualizarUIUsuarioActual === 'function') actualizarUIUsuarioActual();

        // Módulo de Historial de Ventas
        if (typeof renderizarHistorialVentasAdmin === 'function') renderizarHistorialVentasAdmin();
        if (typeof actualizarBadgeVentasHoy === 'function') actualizarBadgeVentasHoy();

        // Módulos de Gamificación, Premio del Mes y Experiencia Cliente
        if (typeof renderizarConfiguradorPremioAdmin === 'function') renderizarConfiguradorPremioAdmin();
        if (typeof renderizarConfiguracionAdmin === 'function') renderizarConfiguracionAdmin();
        if (typeof renderizarCatalogoCliente === 'function') renderizarCatalogoCliente();
        if (typeof renderizarCarritoCliente === 'function') renderizarCarritoCliente();
        if (typeof renderizarEstadoCuentaCliente === 'function') renderizarEstadoCuentaCliente();
        if (typeof renderizarPremioMesCliente === 'function') renderizarPremioMesCliente();

        // Barrera de Acceso y Segregación de Roles (Gatewall)
        if (typeof verificarGatewall === 'function') {
            verificarGatewall();
        }
    });

    // Cloud Modal Handlers & Tools (Exclusivo Administrador)
    window.abrirModalCloudSync = function () {
        const usuario = AppState.usuarioActual;
        const rol = (usuario?.rol || '').toLowerCase();
        const esAdmin = rol === 'admin' || rol === 'superadmin' || usuario?.id === 'SuperAdmin' || usuario?.cedula === 'SuperAdmin';
        
        if (!esAdmin && AppState.usuarioActual) {
            if (window.InventoryApp.Modal?.toast) {
                window.InventoryApp.Modal.toast('Acceso a sincronización restringido a Administrador', 'warning');
            }
            return;
        }

        const modal = document.getElementById('modal-cloud-sync');
        if (!modal) return;
        
        // Actualizar estadísticas y campos del modal
        actualizarEstadisticasModalCloud();
        cargarCamposConfiguracionFirebase();

        // Limpiar banner de test previo
        const resultBox = document.getElementById('cloud-test-result-box');
        if (resultBox) {
            resultBox.style.display = 'none';
            resultBox.innerHTML = '';
        }
        
        modal.classList.add('active');
    };

    window.cerrarModalCloudSync = function () {
        const modal = document.getElementById('modal-cloud-sync');
        if (modal) modal.classList.remove('active');
    };

    function cargarCamposConfiguracionFirebase() {
        const cfg = window.InventoryApp.Firebase?.getConfig ? window.InventoryApp.Firebase.getConfig() : {
            projectId: 'tubodeguitadeconfianza',
            apiKey: 'AIzaSyD0_dbHio6HBwmUJZnjRT6yg40SVvkHsfA',
            authDomain: 'tubodeguitadeconfianza.firebaseapp.com'
        };

        const pidEl = document.getElementById('modal-cloud-project-id');
        const inPid = document.getElementById('cfg-firebase-projectid');
        const inKey = document.getElementById('cfg-firebase-apikey');
        const inDom = document.getElementById('cfg-firebase-authdomain');

        if (pidEl) pidEl.textContent = cfg.projectId || 'tubodeguitadeconfianza';
        if (inPid) inPid.value = cfg.projectId || '';
        if (inKey) inKey.value = cfg.apiKey || '';
        if (inDom) inDom.value = cfg.authDomain || '';
    }

    function actualizarEstadisticasModalCloud() {
        const statProds = document.getElementById('cloud-stat-prods') || document.getElementById('cloud-stat-productos');
        const statCli = document.getElementById('cloud-stat-cli') || document.getElementById('cloud-stat-clientes');
        const statVen = document.getElementById('cloud-stat-ventas');
        const statUsr = document.getElementById('cloud-stat-usuarios');
        const statAbo = document.getElementById('cloud-stat-abonos');
        const statTx = document.getElementById('cloud-stat-transacciones');
        
        if (statProds) statProds.textContent = Array.isArray(AppState.productos) ? AppState.productos.length : 0;
        if (statCli) statCli.textContent = Array.isArray(AppState.clientes) ? AppState.clientes.length : 0;
        if (statVen) statVen.textContent = Array.isArray(AppState.ventas) ? AppState.ventas.length : 0;
        if (statUsr) statUsr.textContent = Array.isArray(AppState.usuarios) ? AppState.usuarios.length : 0;
        if (statAbo) statAbo.textContent = Array.isArray(AppState.abonos) ? AppState.abonos.length : 0;
        if (statTx) statTx.textContent = Array.isArray(AppState.transacciones) ? AppState.transacciones.length : 0;
    }

    // Cerrar modal con tecla Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('modal-cloud-sync');
            if (modal && modal.classList.contains('active')) {
                cerrarModalCloudSync();
            }
        }
    });

    window.ejecutarSincronizacionNube = async function () {
        const btn = document.getElementById('btn-cloud-sync-now');
        const iconOriginal = '<i class="fas fa-rotate"></i> Forzar Sincronización (Descargar de la Nube)';
        
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando datos con Firestore...';
        }

        try {
            if (window.InventoryApp && window.InventoryApp.Firebase) {
                if (typeof window.InventoryApp.Firebase.init === 'function') {
                    await window.InventoryApp.Firebase.init();
                }

                // Sincronizar desde la nube (descarga y reconciliación de Firestore)
                const res = await window.InventoryApp.Firebase.syncFromCloud();
                
                actualizarEstadisticasModalCloud();

                if (btn) {
                    btn.innerHTML = '<i class="fas fa-check"></i> ¡Sincronizado con éxito!';
                    btn.classList.remove('btn-success');
                    btn.classList.add('btn-primary');
                }
                setTimeout(() => {
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = iconOriginal;
                        btn.classList.remove('btn-primary');
                        btn.classList.add('btn-success');
                    }
                }, 2000);

                if (window.InventoryApp.Modal?.toast) {
                    window.InventoryApp.Modal.toast('Datos actualizados desde Firestore con éxito', 'success');
                }
            }
        } catch (e) {
            console.error('Error sincronizando nube:', e);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = iconOriginal;
            }
            if (window.InventoryApp.Modal?.toast) {
                window.InventoryApp.Modal.toast('Aviso de sincronización: ' + (e.message || e), 'warning');
            }
        }
    };

    window.ejecutarSubidaCompletaNube = async function () {
        const btn = document.getElementById('btn-cloud-upload-all');
        const iconOriginal = '<i class="fas fa-cloud-arrow-up"></i> Subir Todo a Firestore';

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo...';
        }

        try {
            if (window.InventoryApp.Firebase?.syncToCloud) {
                await window.InventoryApp.Firebase.syncToCloud();
                actualizarEstadisticasModalCloud();
                if (window.InventoryApp.Modal?.toast) {
                    window.InventoryApp.Modal.toast('Todos los datos locales se han subido a Firestore', 'success');
                }
            }
        } catch (err) {
            console.error('Error subiendo a la nube:', err);
            if (window.InventoryApp.Modal?.toast) {
                window.InventoryApp.Modal.toast('Error subiendo: ' + (err.message || err), 'danger');
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = iconOriginal;
            }
        }
    };

    window.probarConexionFirebaseModal = async function () {
        const btn = document.getElementById('btn-cloud-test-conn');
        const resultBox = document.getElementById('cloud-test-result-box');
        const origHtml = '<i class="fas fa-bolt"></i> Probar Conexión (Ping)';

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
        }
        if (resultBox) {
            resultBox.style.display = 'block';
            resultBox.style.background = 'var(--bg-secondary)';
            resultBox.style.color = 'var(--text-main)';
            resultBox.style.border = '1px solid var(--border-light)';
            resultBox.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Conectando con servidor de Firestore y ejecutando prueba de lectura/escritura...';
        }

        try {
            if (window.InventoryApp.Firebase?.testConexion) {
                const res = await window.InventoryApp.Firebase.testConexion();
                if (res.ok) {
                    if (resultBox) {
                        resultBox.style.background = '#dcfce7';
                        resultBox.style.color = '#15803d';
                        resultBox.style.border = '1px solid #86efac';
                        resultBox.innerHTML = `
                            <strong><i class="fas fa-circle-check"></i> ¡Conexión Exitosa con Firestore!</strong><br>
                            <span style="font-size:0.8rem;">
                                • Proyecto: <strong>${res.projectId}</strong><br>
                                • Latencia de respuesta: <strong>${res.latency} ms</strong><br>
                                • Estado: Tu dispositivo está conectado y sincroniza en tiempo real.
                            </span>
                        `;
                    }
                    if (window.InventoryApp.Modal?.toast) {
                        window.InventoryApp.Modal.toast(`Conexión exitosa a Firestore (${res.latency}ms)`, 'success');
                    }
                } else {
                    if (resultBox) {
                        resultBox.style.background = '#fee2e2';
                        resultBox.style.color = '#b91c1c';
                        resultBox.style.border = '1px solid #fca5a5';
                        resultBox.innerHTML = `
                            <strong><i class="fas fa-triangle-exclamation"></i> Error al conectar con Firestore</strong><br>
                            <span style="font-size:0.8rem;">${res.error || 'No se pudo comunicar con Firestore.'}</span>
                        `;
                    }
                }
            }
        } catch (e) {
            if (resultBox) {
                resultBox.style.background = '#fee2e2';
                resultBox.style.color = '#b91c1c';
                resultBox.style.border = '1px solid #fca5a5';
                resultBox.innerHTML = `<strong>Error de conexión:</strong> ${e.message || e}`;
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origHtml;
            }
        }
    };

    window.restablecerConfiguracionFirebaseUI = async function () {
        if (window.InventoryApp.Modal?.confirm) {
            const confirmed = await window.InventoryApp.Modal.confirm(
                'Restablecer Proyecto Firebase',
                '¿Deseas restablecer la configuración de Firebase al proyecto oficial <strong>tubodeguitadeconfianza</strong>? Ambos dispositivos deben tener este proyecto para compartir usuarios y ventas.',
                'info'
            );
            if (!confirmed) return;
        }

        try {
            if (window.InventoryApp.Firebase?.restablecerConfiguracionPredeterminada) {
                await window.InventoryApp.Firebase.restablecerConfiguracionPredeterminada();
                cargarCamposConfiguracionFirebase();
                actualizarEstadisticasModalCloud();
                if (window.InventoryApp.Modal?.toast) {
                    window.InventoryApp.Modal.toast('Firebase restablecido al proyecto oficial tubodeguitadeconfianza', 'success');
                }
            }
        } catch (err) {
            if (window.InventoryApp.Modal?.toast) {
                window.InventoryApp.Modal.toast('Error al restablecer: ' + (err.message || err), 'danger');
            }
        }
    };

    window.guardarConfiguracionFirebaseUI = async function (e) {
        if (e && e.preventDefault) e.preventDefault();

        const inPid = document.getElementById('cfg-firebase-projectid');
        const inKey = document.getElementById('cfg-firebase-apikey');
        const inDom = document.getElementById('cfg-firebase-authdomain');

        const projectId = inPid?.value?.trim();
        const apiKey = inKey?.value?.trim();
        const authDomain = inDom?.value?.trim() || `${projectId}.firebaseapp.com`;

        if (!projectId || !apiKey) {
            if (window.InventoryApp.Modal?.toast) {
                window.InventoryApp.Modal.toast('Project ID y API Key son obligatorios', 'warning');
            }
            return;
        }

        try {
            if (window.InventoryApp.Firebase?.guardarConfiguracionPersonalizada) {
                await window.InventoryApp.Firebase.guardarConfiguracionPersonalizada({
                    projectId,
                    apiKey,
                    authDomain,
                    storageBucket: `${projectId}.firebasestorage.app`,
                    messagingSenderId: '851659747065',
                    appId: '1:851659747065:web:175908dcd4bb4c68af7c28'
                });
                cargarCamposConfiguracionFirebase();
                actualizarEstadisticasModalCloud();
                if (window.InventoryApp.Modal?.toast) {
                    window.InventoryApp.Modal.toast('Configuración de Firebase guardada y reconectada exitosamente', 'success');
                }
            }
        } catch (err) {
            if (window.InventoryApp.Modal?.toast) {
                window.InventoryApp.Modal.toast('Error guardando configuración: ' + (err.message || err), 'danger');
            }
        }
    };

    window.descargarRespaldoLocal = function () {
        if (window.InventoryApp && window.InventoryApp.Persistence && typeof window.InventoryApp.Persistence.exportarRespaldoJSON === 'function') {
            window.InventoryApp.Persistence.exportarRespaldoJSON();
        }
    };

    window.descargarMasterExcel = function () {
        if (window.InventoryApp && window.InventoryApp.Persistence && typeof window.InventoryApp.Persistence.exportarMasterExcel === 'function') {
            window.InventoryApp.Persistence.exportarMasterExcel();
        }
    };

    window.manejarImportacionExcel = async function (e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        if (!confirm('¿Deseas sincronizar la base de datos desde este archivo Máster Excel (.xlsx)? Se actualizarán las tablas de Usuarios, Productos y Clientes.')) {
            e.target.value = '';
            return;
        }

        try {
            await window.InventoryApp.Persistence.importarMasterExcel(file);
            alert('¡Archivo Máster Excel importado y sincronizado exitosamente!');
            window.location.reload();
        } catch (err) {
            console.error('Error restaurando base de datos Excel:', err);
            alert('Error al importar el archivo Excel: ' + (err.message || err));
        } finally {
            e.target.value = '';
        }
    };

    window.manejarImportacionJSON = async function (e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        if (!confirm('¿Deseas restaurar la base de datos desde este archivo? Se actualizarán los registros locales y se subirán a Firestore.')) {
            e.target.value = '';
            return;
        }

        try {
            await window.InventoryApp.Persistence.importarRespaldoJSON(file);
            alert('¡Base de datos restaurada y sincronizada correctamente!');
            window.location.reload();
        } catch (err) {
            console.error('Error restaurando base de datos:', err);
            alert('Error al importar el archivo JSON: ' + (err.message || err));
        } finally {
            e.target.value = '';
        }
    };

    window.limpiarBaseDeDatosVirgen = async function () {
        if (!confirm('⚠️ ATENCIÓN: ¿Estás seguro de que deseas REINICIAR Y PURGAR completamente la base de datos a estado virgen?\n\n- Se eliminarán todos los productos, clientes, ventas, abonos y transacciones tanto en este navegador como en Firebase Firestore.\n- El usuario SuperAdmin quedará activo con su clave predeterminada (1810).\n\nEsta acción no se puede deshacer.')) {
            return;
        }

        const confirmacion2 = prompt('Para confirmar el reseteo a estado virgen, escribe "BORRAR" en mayúsculas:');
        if (confirmacion2 !== 'BORRAR') {
            alert('Operación cancelada. No se modificó ningún dato.');
            return;
        }

        try {
            if (window.InventoryApp && window.InventoryApp.Persistence && typeof window.InventoryApp.Persistence.limpiarBaseDeDatosVirgen === 'function') {
                await window.InventoryApp.Persistence.limpiarBaseDeDatosVirgen();
                alert('✅ Base de datos reiniciada a estado virgen con éxito. Se recargará la aplicación.');
                window.location.reload();
            }
        } catch (err) {
            console.error('Error purgando base de datos:', err);
            alert('Error al purgar la base de datos: ' + (err.message || err));
        }
    };

    window.InventoryApp.version = '4.1.0-users-pos';
    window.InventoryApp.releaseName = 'Versión 4.1.0 — Sistema POS Multimoneda BCV con Control de Acceso y Aprobación de Usuarios';
    window.InventoryApp.architecture = {
        state: 'core/app-state.js',
        modules: [
            'core/helpers.js',
            'core/firebase-service.js',
            'core/persistence.js',
            'core/bcv.js',
            'modules/productos.js',
            'modules/pos.js',
            'modules/clientes.js',
            'modules/pagos-transacciones.js',
            'modules/auditoria.js',
            'modules/perdidas.js',
            'modules/usuarios.js'
        ],
        stockPolicy: 'Solo Venta, Retiro y Auditoría modifican stock.'
    };
})();
