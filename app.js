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

    // Cloud Modal Handlers & Tools
    window.abrirModalCloudSync = function () {
        const modal = document.getElementById('modal-cloud-sync');
        if (!modal) return;
        
        // Actualizar estadísticas de la base de datos
        const statProd = document.getElementById('cloud-stat-productos');
        const statCli = document.getElementById('cloud-stat-clientes');
        const statVen = document.getElementById('cloud-stat-ventas');
        const statTx = document.getElementById('cloud-stat-transacciones');
        
        if (statProd) statProd.textContent = Array.isArray(AppState.productos) ? AppState.productos.length : 0;
        if (statCli) statCli.textContent = Array.isArray(AppState.clientes) ? AppState.clientes.length : 0;
        if (statVen) statVen.textContent = Array.isArray(AppState.ventas) ? AppState.ventas.length : 0;
        if (statTx) statTx.textContent = Array.isArray(AppState.transacciones) ? AppState.transacciones.length : 0;
        
        modal.classList.add('active');
    };

    window.cerrarModalCloudSync = function () {
        const modal = document.getElementById('modal-cloud-sync');
        if (modal) modal.classList.remove('active');
    };

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
        const iconOriginal = '<i class="fas fa-rotate"></i> Forzar Sincronización Nube';
        
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando datos...';
        }

        try {
            if (window.InventoryApp && window.InventoryApp.Firebase) {
                // Primero asegurar inicialización si estaba en espera
                if (typeof window.InventoryApp.Firebase.init === 'function') {
                    await window.InventoryApp.Firebase.init();
                }

                // Sincronizar hacia Firestore
                const res = await window.InventoryApp.Firebase.syncToCloud();
                
                // Actualizar contadores del modal
                actualizarEstadisticasModalCloud();

                if (res) {
                    if (btn) {
                        btn.innerHTML = '<i class="fas fa-check"></i> ¡Sincronizado!';
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
                    }, 1500);
                } else {
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = iconOriginal;
                    }
                    alert('Sincronización finalizada en modo offline / caché local.');
                }
            } else {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = iconOriginal;
                }
            }
        } catch (e) {
            console.error('Error sincronizando nube:', e);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = iconOriginal;
            }
            alert('Aviso de sincronización: ' + (e.message || e));
        }
    };

    function actualizarEstadisticasModalCloud() {
        const statProd = document.getElementById('cloud-stat-productos');
        const statCli = document.getElementById('cloud-stat-clientes');
        const statVen = document.getElementById('cloud-stat-ventas');
        const statTx = document.getElementById('cloud-stat-transacciones');
        
        if (statProd) statProd.textContent = Array.isArray(AppState.productos) ? AppState.productos.length : 0;
        if (statCli) statCli.textContent = Array.isArray(AppState.clientes) ? AppState.clientes.length : 0;
        if (statVen) statVen.textContent = Array.isArray(AppState.ventas) ? AppState.ventas.length : 0;
        if (statTx) statTx.textContent = Array.isArray(AppState.transacciones) ? AppState.transacciones.length : 0;
    }

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
        if (!confirm('⚠️ ATENCIÓN: ¿Estás seguro de que deseas REINICIAR Y PURGAR completamente la base de datos a estado virgen?\n\n- Se eliminarán todos los productos, clientes, ventas, abonos y transacciones tanto en este navegador como en Firebase Firestore.\n- El usuario SuperAdmin permanecerá activo.\n\nEsta acción no se puede deshacer.')) {
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
