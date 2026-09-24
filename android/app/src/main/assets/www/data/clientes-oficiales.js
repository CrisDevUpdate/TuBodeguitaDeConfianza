/**
 * data/clientes-oficiales.js
 * Lista oficial de clientes y deudas de la libreta "Clientes (Josna)".
 * Total: 25 clientes registrados en el orden estricto solicitado.
 */

const CLIENTES_OFICIALES = [
    { id: 'CLI-001', nombre: 'Alejandra', telefono: '', email: '', deudaUSD: 1.20, deudaInicialUSD: 1.20 },
    { id: 'CLI-002', nombre: 'Anais', telefono: '', email: '', deudaUSD: 12.80, deudaInicialUSD: 12.80 },
    { id: 'CLI-003', nombre: 'Andrea', telefono: '', email: '', deudaUSD: 0.00, deudaInicialUSD: 0.00 },
    { id: 'CLI-004', nombre: 'Carliver', telefono: '', email: '', deudaUSD: 6.30, deudaInicialUSD: 6.30 },
    { id: 'CLI-005', nombre: 'Carlos', telefono: '', email: '', deudaUSD: 0.00, deudaInicialUSD: 0.00 },
    { id: 'CLI-006', nombre: 'Carolina G', telefono: '', email: '', deudaUSD: 0.00, deudaInicialUSD: 0.00 },
    { id: 'CLI-007', nombre: 'Carolina R', telefono: '', email: '', deudaUSD: 5.00, deudaInicialUSD: 5.00 },
    { id: 'CLI-008', nombre: 'Daniela Ojeda', telefono: '', email: '', deudaUSD: 5.80, deudaInicialUSD: 5.80 },
    { id: 'CLI-009', nombre: 'Elida', telefono: '', email: '', deudaUSD: 4.40, deudaInicialUSD: 4.40 },
    { id: 'CLI-010', nombre: 'Elvimar', telefono: '', email: '', deudaUSD: 0.00, deudaInicialUSD: 0.00 },
    { id: 'CLI-011', nombre: 'Gaby', telefono: '', email: '', deudaUSD: 13.20, deudaInicialUSD: 13.20 },
    { id: 'CLI-012', nombre: 'Henry', telefono: '', email: '', deudaUSD: 0.00, deudaInicialUSD: 0.00 },
    { id: 'CLI-013', nombre: 'Johan', telefono: '', email: '', deudaUSD: 0.00, deudaInicialUSD: 0.00 },
    { id: 'CLI-014', nombre: 'Juan', telefono: '', email: '', deudaUSD: 4.40, deudaInicialUSD: 4.40 },
    { id: 'CLI-015', nombre: 'Luis Criollo', telefono: '', email: '', deudaUSD: 1.40, deudaInicialUSD: 1.40 },
    { id: 'CLI-016', nombre: 'Luis Niño', telefono: '', email: '', deudaUSD: 0.00, deudaInicialUSD: 0.00 },
    { id: 'CLI-017', nombre: 'Naomi', telefono: '', email: '', deudaUSD: 1.20, deudaInicialUSD: 1.20 },
    { id: 'CLI-018', nombre: 'Niceth', telefono: '', email: '', deudaUSD: 4.10, deudaInicialUSD: 4.10 },
    { id: 'CLI-019', nombre: 'Rebeca', telefono: '', email: '', deudaUSD: 1.00, deudaInicialUSD: 1.00 },
    { id: 'CLI-020', nombre: 'Selenia', telefono: '', email: '', deudaUSD: 0.00, deudaInicialUSD: 0.00 },
    { id: 'CLI-021', nombre: 'Sorana', telefono: '', email: '', deudaUSD: 9.50, deudaInicialUSD: 9.50 },
    { id: 'CLI-022', nombre: 'Sr Aguilar', telefono: '', email: '', deudaUSD: 0.00, deudaInicialUSD: 0.00 },
    { id: 'CLI-023', nombre: 'Sr Torrealba', telefono: '', email: '', deudaUSD: 3.90, deudaInicialUSD: 3.90 },
    { id: 'CLI-024', nombre: 'Yetsy', telefono: '', email: '', deudaUSD: 7.80, deudaInicialUSD: 7.80 },
    { id: 'CLI-025', nombre: 'Yixel', telefono: '', email: '', deudaUSD: 1.80, deudaInicialUSD: 1.80 }
];

// Generar ventas a crédito (fiados iniciales) para los clientes que tienen deudas > 0
const VENTAS_INICIALES_FIADOS = CLIENTES_OFICIALES
    .filter(c => c.deudaUSD > 0)
    .map((c, idx) => ({
        id: `V_FIADO_${c.id}`,
        clienteId: c.id,
        clienteNombre: c.nombre,
        vendedorId: 'ADMIN',
        vendedorNombre: 'Josna / Administración',
        fecha: '2026-09-23 12:00',
        items: [
            {
                productoId: 'SALDO_INICIAL',
                nombre: `Saldo pendiente / Cuenta fiada (${c.nombre})`,
                cantidad: 1,
                precio: Number(c.deudaUSD.toFixed(2)),
                costo: 0,
                subtotal: Number(c.deudaUSD.toFixed(2))
            }
        ],
        total: Number(c.deudaUSD.toFixed(2)),
        tipo: 'Crédito',
        tipoPago: 'Crédito',
        metodoDetalle: 'Crédito (Fiado inicial)',
        referencia: 'Saldo inicial registrado por Josna',
        estado: 'PENDIENTE',
        confirmada: false
    }));

// Exponer en window
window.CLIENTES_OFICIALES = CLIENTES_OFICIALES;
window.VENTAS_INICIALES_FIADOS = VENTAS_INICIALES_FIADOS;

/**
 * Función para cargar y sincronizar los clientes y sus deudas
 */
window.cargarClientesYDeudasOficiales = async function (forzar = false) {
    if (!window.AppState) return;

    const listaActual = Array.isArray(window.AppState.clientes) ? window.AppState.clientes : [];
    
    // Si ya están cargados y no se fuerza, no sobrescribir
    if (listaActual.length >= 25 && !forzar) {
        return;
    }

    // Inicializar o combinar clientes
    const clientesFinales = JSON.parse(JSON.stringify(CLIENTES_OFICIALES));
    window.AppState.clientes = clientesFinales;
    if (typeof clientes !== 'undefined') {
        clientes = clientesFinales;
    }

    // Asegurar ventas a crédito iniciales para que calcularEstadoFinancieroCliente contabilice las deudas
    if (!Array.isArray(window.AppState.ventas)) {
        window.AppState.ventas = [];
    }
    VENTAS_INICIALES_FIADOS.forEach(vf => {
        const existe = window.AppState.ventas.some(v => v.id === vf.id || (v.clienteId === vf.clienteId && v.tipo === 'Crédito'));
        if (!existe) {
            window.AppState.ventas.push(JSON.parse(JSON.stringify(vf)));
        }
    });
    if (typeof ventas !== 'undefined') {
        ventas = window.AppState.ventas;
    }

    // Sincronizar usuarios clientes
    if (!Array.isArray(window.AppState.usuarios)) {
        window.AppState.usuarios = [];
    }
    clientesFinales.forEach(c => {
        const existeU = window.AppState.usuarios.some(u => (u.cedula || u.id) === c.id);
        if (!existeU) {
            window.AppState.usuarios.push({
                id: c.id,
                cedula: c.id,
                nombre: c.nombre,
                telefono: c.telefono || '',
                email: c.email || '',
                rol: 'cliente',
                estado: 'ACTIVO',
                puntosAcumulados: 0,
                puntosCanjeados: 0,
                fechaRegistro: '2026-09-23 12:00'
            });
        }
    });

    // Persistir en Firestore si el servicio está activo
    if (window.InventoryApp?.Firebase?.guardarCliente) {
        for (const c of clientesFinales) {
            window.InventoryApp.Firebase.guardarCliente(c).catch(() => {});
        }
        for (const vf of VENTAS_INICIALES_FIADOS) {
            window.InventoryApp.Firebase.registrarVenta(vf, []).catch(() => {});
        }
    }

    if (window.InventoryApp?.Persistence?.guardar) {
        window.InventoryApp.Persistence.guardar(true);
    }

    // Refrescar vistas
    if (typeof renderizarClientes === 'function') renderizarClientes();
    if (typeof actualizarSelectClientes === 'function') actualizarSelectClientes();
    if (typeof renderizarHistorialVentas === 'function') renderizarHistorialVentas();
    if (typeof renderizarTransacciones === 'function') renderizarTransacciones();
    if (typeof renderizarPosProductos === 'function') renderizarPosProductos();
};
