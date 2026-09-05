/* core/app-state.js
 * Shared application state. Kept in one place so modules can evolve independently.
 * Legacy global aliases are exposed intentionally because the current HTML uses inline
 * event handlers (onclick/onsubmit). This preserves the existing UI contract.
 */
window.InventoryApp = window.InventoryApp || {};
const AppState = window.InventoryApp.state = {
    tasaActiva: 0,
    tasaUSD_BCV: 0,
    tasaEUR_BCV: 0,
    fechaTasaBCV: null,
    monedaSeleccionada: 'USD',
    productos: [],
    clientes: [],
    ventas: [],
    abonos: [],
    transacciones: [],
    carrito: [],
    clienteSeleccionadoId: null,
    productoImagenTemporal: '',
    conteosFisicos: {},
    auditorias: [],
    eliminaciones: [],
    clientesEliminados: [],
    usuarios: [
        {
            id: 'SuperAdmin',
            cedula: 'SuperAdmin',
            nombre: 'SuperAdmin',
            telefono: '0412-0000000',
            email: 'superadmin@tubodeguita.com',
            // Hash SHA-256 criptográfico (irreversible)
            password: '1a09807a0e6928a66d91025ed5fccd713c9edb101e72a1bbcb8a01cd9a53cb51',
            rol: 'admin',
            estado: 'ACTIVO',
            puntosAcumulados: 0,
            puntosCanjeados: 0,
            fechaRegistro: '2026-08-28 12:00'
        }
    ],
    usuarioActual: null,
    premioMes: {
        nombre: 'Cafetera Espresso Digital 1.5L',
        imagen: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600&auto=format&fit=crop&q=80',
        puntosRequeridos: 200,
        puntosPorDolar: 1,
        temporadaActiva: true,
        descripcion: 'Premio exclusivo del mes para nuestros clientes más fieles. ¡Acumula puntos con cada compra completada!'
    },
    canjesPremios: [],
    nextProductSequence: 1
};

const legacyGlobals = [
    'tasaActiva','tasaUSD_BCV','tasaEUR_BCV','fechaTasaBCV','monedaSeleccionada',
    'productos','clientes','ventas','abonos','transacciones','carrito',
    'clienteSeleccionadoId','productoImagenTemporal','conteosFisicos','auditorias',
    'eliminaciones','clientesEliminados','usuarios','usuarioActual','premioMes','canjesPremios'
];
legacyGlobals.forEach((key) => {
    Object.defineProperty(window, key, {
        configurable: true,
        get: () => AppState[key],
        set: (value) => { AppState[key] = value; }
    });
});

window.InventoryApp.StockService = {
    _get(productId) {
        return productos.find(p => p.id === productId) || null;
    },
    sale(productId, quantity) {
        const p = this._get(productId);
        const qty = Number(quantity);
        if (!p || !Number.isInteger(qty) || qty <= 0 || qty > Number(p.stock || 0)) return false;
        p.stock = Number(p.stock || 0) - qty;
        return true;
    },
    retiro(productId, quantity) {
        const p = this._get(productId);
        const qty = Number(quantity);
        if (!p || !Number.isInteger(qty) || qty <= 0 || qty > Number(p.stock || 0)) return false;
        p.stock = Number(p.stock || 0) - qty;
        return true;
    },
    ajuste(productId, stockFisico) {
        const p = this._get(productId);
        const qty = Number(stockFisico);
        if (!p || !Number.isInteger(qty) || qty < 0) return false;
        p.stock = qty;
        return true;
    },
    inicial(productId, stockInicial) {
        const p = this._get(productId);
        const qty = Number(stockInicial);
        if (!p || !Number.isInteger(qty) || qty < 0) return false;
        p.stock = qty;
        return true;
    }
};
