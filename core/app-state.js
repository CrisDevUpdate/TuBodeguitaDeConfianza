/* core/app-state.js
 * Shared application state. Kept in one place so modules can evolve independently.
 * Legacy global aliases are exposed intentionally because the current HTML uses inline
 * event handlers (onclick/onsubmit). This preserves the existing UI contract.
 */
window.InventoryApp = window.InventoryApp || {};
const AppState = window.AppState = window.InventoryApp.state = {
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
        puntosRequeridos: 600,
        puntosPorDolar: 1,
        costoRealPremio: 40.00,
        gananciaNetaObjetivo: 60.00,
        poolClientesEstimado: 10,
        pointsPerProfitDollar: 10,
        temporadaActiva: true,
        modalidad: 'ABIERTA_HASTA_GANADOR',
        vigenciaTexto: 'Activo hasta tener ganador o cierre manual (Acumulativo)',
        estado: 'ACTIVO', // 'ACTIVO' | 'GANADOR_ALCANZADO' | 'PAUSADO'
        ganadorActual: null,
        descripcion: 'Gran premio en juego para nuestros clientes más fieles. ¡Acumula puntos con cada compra completada!'
    },
    canjesPremios: [],
    notificaciones: [],
    nextProductSequence: 1,
    ciclosRecuperacion: [],
    cicloRecuperacionActual: {
        id: 'ciclo_actual',
        numero: 1,
        fechaInicio: null,
        estado: 'ACTIVO'
    },
    filtroFechaRecuperacion: 'todos',
    rangoFechaPersonalizadoRecuperacion: { desde: '', hasta: '' },
    cicloSeleccionadoRecuperacion: 'actual',
    filtroTipoHistorialRecuperacion: 'todos',
    cuentasBancarias: [
        {
            id: 'bancamiga_pm',
            banco: 'Bancamiga (0172)',
            bank: 'Bancamiga (0172)',
            tipo: 'Pago Móvil / Transferencia',
            type: 'Pago Móvil',
            telefono: '0412-1234567',
            phone: '0412-1234567',
            cedulaRif: 'V-30.544.641',
            idNumber: 'V-30.544.641',
            titular: 'Josnairit Salazar / Tu Bodeguita',
            cuenta: '01720111223344556677',
            account: '01720111223344556677',
            correo: '',
            activo: true,
            instrucciones: 'Reportar comprobante con últimos 6 u 8 dígitos de referencia'
        },
        {
            id: 'bdv_pm',
            banco: 'Banco de Venezuela (0102)',
            bank: 'Banco de Venezuela (0102)',
            tipo: 'Pago Móvil',
            type: 'Pago Móvil',
            telefono: '0412-5363849',
            phone: '0412-5363849',
            cedulaRif: 'V-28.123.456',
            idNumber: 'V-28.123.456',
            titular: 'Tu Bodeguita de Confianza',
            cuenta: '01020000000000000000',
            account: '01020000000000000000',
            correo: '',
            activo: true,
            instrucciones: ''
        },
        {
            id: 'banesco_pm',
            banco: 'Banesco (0134)',
            bank: 'Banesco (0134)',
            tipo: 'Pago Móvil',
            type: 'Pago Móvil',
            telefono: '0412-5363849',
            phone: '0412-5363849',
            cedulaRif: 'V-28.123.456',
            idNumber: 'V-28.123.456',
            titular: 'Tu Bodeguita de Confianza',
            cuenta: '',
            account: '',
            correo: '',
            activo: true,
            instrucciones: ''
        },
        {
            id: 'mercantil_pm',
            banco: 'Mercantil (0105)',
            bank: 'Mercantil (0105)',
            tipo: 'Pago Móvil',
            type: 'Pago Móvil',
            telefono: '0412-5363849',
            phone: '0412-5363849',
            cedulaRif: 'V-28.123.456',
            idNumber: 'V-28.123.456',
            titular: 'Tu Bodeguita de Confianza',
            cuenta: '',
            account: '',
            correo: '',
            activo: true,
            instrucciones: ''
        }
    ]
};

const legacyGlobals = [
    'tasaActiva','tasaUSD_BCV','tasaEUR_BCV','fechaTasaBCV','monedaSeleccionada',
    'productos','clientes','ventas','abonos','transacciones','carrito',
    'clienteSeleccionadoId','productoImagenTemporal','conteosFisicos','auditorias',
    'eliminaciones','clientesEliminados','usuarios','usuarioActual','premioMes','canjesPremios','notificaciones',
    'ciclosRecuperacion','cicloRecuperacionActual','filtroFechaRecuperacion','cicloSeleccionadoRecuperacion','cuentasBancarias'
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
