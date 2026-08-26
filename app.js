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
        sincronizarSecuenciaIdsProducto();
        obtenerTasaOficialBCV();
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
        prepararCodigoNuevoProducto();
        actualizarVistaImagenProducto();
    });

    window.InventoryApp.version = 'Beta 1.0.0';
    window.InventoryApp.releaseName = 'Versión Beta — Arquitectura Producción';
    window.InventoryApp.architecture = {
        state: 'core/app-state.js',
        modules: [
            'core/helpers.js',
            'core/persistence.js',
            'core/bcv.js',
            'modules/productos.js',
            'modules/pos.js',
            'modules/clientes.js',
            'modules/pagos-transacciones.js',
            'modules/auditoria.js',
            'modules/perdidas.js'
        ],
        stockPolicy: 'Solo Venta, Retiro y Auditoría modifican stock.'
    };
})();
