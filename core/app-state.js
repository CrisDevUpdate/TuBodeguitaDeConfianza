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
    nextProductSequence: 1
};

const legacyGlobals = [
    'tasaActiva','tasaUSD_BCV','tasaEUR_BCV','fechaTasaBCV','monedaSeleccionada',
    'productos','clientes','ventas','abonos','transacciones','carrito',
    'clienteSeleccionadoId','productoImagenTemporal','conteosFisicos','auditorias',
    'eliminaciones','clientesEliminados'
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
