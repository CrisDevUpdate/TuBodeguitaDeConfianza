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
        renderizarPosProductos();
        renderizarInventario();
        renderizarClientes();
        renderizarHistorialClientesEliminados();
        actualizarSelectClientes();
        renderizarAuditoria();
        if (typeof renderizarUsuarios === 'function') renderizarUsuarios();
        if (typeof renderizarTransacciones === 'function') renderizarTransacciones();
        if (typeof renderizarPagosCliente === 'function') renderizarPagosCliente();

        // Botón de reinicio de fábrica: exclusivo de SuperAdmin.
        // Se instala después de que la sesión y la interfaz hayan terminado de cargar.
        const instalarFactoryReset = () => {
            if (window.InventoryApp?.FactoryReset?.instalarBoton) {
                window.InventoryApp.FactoryReset.instalarBoton();
            }
        };
        instalarFactoryReset();
        setTimeout(instalarFactoryReset, 500);
        setTimeout(instalarFactoryReset, 1500);
    });
})();
