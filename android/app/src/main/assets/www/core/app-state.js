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
    productos: (typeof PRODUCTOS_INVENTARIO_PDF !== 'undefined' && Array.isArray(PRODUCTOS_INVENTARIO_PDF)) 
        ? JSON.parse(JSON.stringify(PRODUCTOS_INVENTARIO_PDF)) 
        : [],
    clientes: (typeof CLIENTES_OFICIALES !== 'undefined' && Array.isArray(CLIENTES_OFICIALES))
        ? JSON.parse(JSON.stringify(CLIENTES_OFICIALES.filter(c => !/^CLI-[0O]13$/i.test(c.id) && String(c.nombre || '').trim().toLowerCase() !== 'johan')))
        : [],
    ventas: (typeof VENTAS_INICIALES_FIADOS !== 'undefined' && Array.isArray(VENTAS_INICIALES_FIADOS))
        ? JSON.parse(JSON.stringify(VENTAS_INICIALES_FIADOS))
        : [],
    abonos: [],
    transacciones: [],
    carrito: [],
    clienteSeleccionadoId: null,
    productoImagenTemporal: '',
    conteosFisicos: {},
    auditorias: [],
    sesionesConteo: [],
    eliminaciones: [],
    clientesEliminados: [
        {
            id: 'CLI-013',
            cedula: 'CLI-013',
            nombre: 'Johan',
            telefono: '',
            fecha: '2026-10-01 12:00',
            totalCompradoUSD: 0,
            deudaUSD: 0,
            perdidaUSD: 0,
            motivo: 'Datos duplicados',
            comentario: 'Eliminado por duplicado / registro repetido en sistema. No genera pérdidas ni altera inventario.',
            codigosAnteriores: ['CLI-013', 'cli-o13', 'CLI-O13'],
            esDuplicado: true
        }
    ],
    clientesFusionados: [],
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
    nextProductSequence: 27,
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
    cuentasBancarias: [],
    telefonoWhatsApp: '',
    categoriasPersonalizadas: ['Dulces', 'Bebidas', 'Snacks', 'Galletas', 'Chocolates', 'Chucherías', 'Combos & Ofertas', 'Víveres', 'General'],
    facturasCompras: [],
    kardex: [],
    proveedores: [],
    proveedoresFrecuentes: [],
    turnosCaja: [],
    turnoActivo: null,
    egresosCaja: [],
    exigirTurnoVendedor: false,
    moduloCajaActivo: false,
    resenasSugerencias: [],
    pedidosAdelantados: [],
    pedidoPOSActivoId: null
};

const legacyGlobals = [
    'tasaActiva','tasaUSD_BCV','tasaEUR_BCV','fechaTasaBCV','monedaSeleccionada',
    'productos','clientes','ventas','abonos','transacciones','carrito',
    'clienteSeleccionadoId','productoImagenTemporal','conteosFisicos','auditorias','sesionesConteo',
    'eliminaciones','clientesEliminados','clientesFusionados','usuarios','usuarioActual','premioMes','canjesPremios','notificaciones',
    'ciclosRecuperacion','cicloRecuperacionActual','filtroFechaRecuperacion','cicloSeleccionadoRecuperacion','cuentasBancarias',
    'telefonoWhatsApp','categoriasPersonalizadas','facturasCompras','kardex','proveedores','proveedoresFrecuentes',
    'turnosCaja','turnoActivo','egresosCaja','exigirTurnoVendedor','moduloCajaActivo','resenasSugerencias','pedidosAdelantados','pedidoPOSActivoId'
];
legacyGlobals.forEach((key) => {
    Object.defineProperty(window, key, {
        configurable: true,
        get: () => AppState[key],
        set: (value) => { AppState[key] = value; }
    });
});

/**
 * Normaliza cualquier número de teléfono venezolano o internacional
 * al formato limpio requerido por la API oficial de WhatsApp (ej: 0412-5363849 -> 584125363849)
 * Elimina cualquier guión, espacio, paréntesis o símbolo.
 */
function normalizarNumeroWhatsApp(tel) {
    if (!tel) return '';
    let clean = String(tel).replace(/\D/g, '');
    if (!clean) return '';
    
    // Si ya empieza por 58 y tiene al menos 12 dígitos (58 + 10 dígitos)
    if (clean.startsWith('58') && clean.length >= 12) {
        return clean;
    }
    
    // Si empieza por 0 (ej: 04125363849 -> 584125363849)
    if (clean.startsWith('0')) {
        clean = '58' + clean.substring(1);
    } else if (clean.length === 10 && /^(412|414|424|416|426)/.test(clean)) {
        // Ej: 4125363849 -> 584125363849
        clean = '58' + clean;
    } else if (!clean.startsWith('58') && clean.length <= 11) {
        clean = '58' + clean;
    }
    
    return clean;
}
window.normalizarNumeroWhatsApp = normalizarNumeroWhatsApp;

/**
 * Retorna el número de WhatsApp.
 * Por defecto (o si formateado === false), retorna el número LIMPIO para URLs/APIs (ej: '584125363849').
 * Si formateado === true, retorna el número con formato legible para la interfaz (ej: '0412-5363849').
 */
function obtenerTelefonoWhatsApp(formateado = false) {
    const raw = AppState.telefonoWhatsApp || '';
    if (!raw) return '';
    if (formateado) {
        return raw;
    }
    return normalizarNumeroWhatsApp(raw);
}
window.obtenerTelefonoWhatsApp = obtenerTelefonoWhatsApp;

function obtenerTelefonoWhatsAppLimpio() {
    return normalizarNumeroWhatsApp(AppState.telefonoWhatsApp || '');
}
window.obtenerTelefonoWhatsAppLimpio = obtenerTelefonoWhatsAppLimpio;

/**
 * Genera una URL infalible y directa a WhatsApp sin redirecciones intermedias rotas
 */
function generarUrlWhatsApp(numero, texto = '') {
    const numLimpio = normalizarNumeroWhatsApp(numero || AppState.telefonoWhatsApp);
    let textoCodificado = '';
    if (texto) {
        try {
            // Descodifica primero si ya venía codificado para evitar doble encoding (%2520)
            const dec = decodeURIComponent(texto);
            textoCodificado = encodeURIComponent(dec);
        } catch (e) {
            textoCodificado = encodeURIComponent(texto);
        }
    }
    return `https://api.whatsapp.com/send?phone=${numLimpio}&text=${textoCodificado}`;
}
window.generarUrlWhatsApp = generarUrlWhatsApp;

/**
 * Validador universal de si un producto o combo debe tratarse como combo.
 * Un combo es una oferta agrupada creada mediante el Constructor de Combos con componentes (items),
 * o asignada explícitamente a la categoría "Combos" / "Combos & Ofertas".
 * NUNCA debe clasificarse un producto regular de inventario como combo por contener palabras como
 * "pack", "promo", "paquete" o "oferta" en su nombre (ej: "Tripack de jugo", "Sixpack", "Pack galletas").
 */
function esProductoCombo(p) {
    if (!p) return false;

    // 1. Identificadores explícitos creados por el Constructor de Combos
    if (typeof p.id === 'string' && (p.id.startsWith('combo_') || p.id.startsWith('combo-'))) return true;
    if (typeof p.codigo === 'string' && (p.codigo.startsWith('COMBO-') || p.codigo.startsWith('CMB-'))) return true;
    if (Array.isArray(p.items) && p.items.length > 0) return true;

    // 2. Categoría explícitamente designada como Combos
    const cat = String(p.categoria || '').trim().toLowerCase();
    if (cat === 'combos' || cat === 'combo' || cat === 'combos & ofertas' || cat === 'super combos') return true;

    // 3. Flags explícitos de combo, siempre que no sea un producto regular de inventario
    if ((p.esCombo === true || p.tipo === 'combo' || p.isCombo === true) && (cat.includes('combo') || (typeof p.id === 'string' && p.id.startsWith('combo')) || (Array.isArray(p.items) && p.items.length > 0))) {
        return true;
    }

    return false;
}
window.esProductoCombo = esProductoCombo;
window.InventoryApp.esProductoCombo = esProductoCombo;

window.InventoryApp.StockService = {
    _get(productId) {
        if (!productId) return null;
        const list = Array.isArray(productos) ? productos : (window.AppState?.productos || []);
        const target = String(productId).trim();
        return list.find(p => String(p.id).trim() === target || String(p.codigo).trim() === target) || null;
    },
    _limpiarConteoBorrador(p) {
        if (!p || !window.AppState?.conteosFisicos) return;
        delete window.AppState.conteosFisicos[p.id];
        if (p.codigo) delete window.AppState.conteosFisicos[p.codigo];
    },
    sale(productId, quantity) {
        const p = this._get(productId);
        const qty = Number(quantity);
        if (!p || !Number.isFinite(qty) || qty <= 0 || qty > (Number(p.stock || 0) + 0.0001)) return false;
        p.stock = Math.max(0, Number((Number(p.stock || 0) - qty).toFixed(4)));
        this._limpiarConteoBorrador(p);
        return true;
    },
    devolver(productId, quantity) {
        const p = this._get(productId);
        const qty = Number(quantity);
        if (!p || !Number.isFinite(qty) || qty <= 0) return false;
        p.stock = Number((Math.max(0, Number(p.stock || 0)) + qty).toFixed(4));
        this._limpiarConteoBorrador(p);
        return true;
    },
    retiro(productId, quantity) {
        const p = this._get(productId);
        const qty = Number(quantity);
        if (!p || !Number.isFinite(qty) || qty <= 0 || qty > (Number(p.stock || 0) + 0.0001)) return false;
        p.stock = Math.max(0, Number((Number(p.stock || 0) - qty).toFixed(4)));
        this._limpiarConteoBorrador(p);
        return true;
    },
    ajuste(productId, stockFisico) {
        const p = this._get(productId);
        const qty = Number(stockFisico);
        if (!p || !Number.isFinite(qty) || qty < 0) return false;
        p.stock = Number(qty.toFixed(4));
        return true;
    },
    inicial(productId, stockInicial) {
        const p = this._get(productId);
        const qty = Number(stockInicial);
        if (!p || !Number.isFinite(qty) || qty < 0) return false;
        p.stock = Number(qty.toFixed(4));
        this._limpiarConteoBorrador(p);
        return true;
    },
    ingresoFactura(productId, cantidadComprada, nuevoCostoUnitario, metodoCosto = 'reposicion', nuevoPrecioVenta = null, nuevoMargen = null) {
        const p = this._get(productId);
        const qty = Number(cantidadComprada);
        if (!p || !Number.isFinite(qty) || qty <= 0) return false;
        
        const stockActual = Math.max(0, Number(p.stock || 0));
        const costoActual = Math.max(0, Number(p.costo || 0));
        const nuevoCosto = Number(nuevoCostoUnitario);
        
        // Sumar automáticamente la cantidad comprada al stock actual
        p.stock = stockActual + qty;
        this._limpiarConteoBorrador(p);
        
        // Actualizar el costo unitario según el método
        if (Number.isFinite(nuevoCosto) && nuevoCosto >= 0) {
            if (metodoCosto === 'promedio' && stockActual > 0) {
                // Costo promedio ponderado
                const totalValor = (stockActual * costoActual) + (qty * nuevoCosto);
                const nuevoStock = stockActual + qty;
                p.costo = Number((totalValor / nuevoStock).toFixed(2));
            } else {
                // Costo de reposición (reemplazo directo del valor facturado)
                p.costo = Number(nuevoCosto.toFixed(2));
            }
        }

        // Actualizar el precio de venta si fue configurado en la factura
        if (nuevoPrecioVenta !== null && Number.isFinite(Number(nuevoPrecioVenta)) && Number(nuevoPrecioVenta) > 0) {
            p.precio = Number(Number(nuevoPrecioVenta).toFixed(2));
        } else if (nuevoMargen !== null && Number.isFinite(Number(nuevoMargen)) && p.costo > 0) {
            p.precio = Number((p.costo * (1 + (Number(nuevoMargen) / 100))).toFixed(2));
        }
        
        // Recalcular el porcentaje de ganancia respecto al precio actual
        if (p.precio && p.costo > 0) {
            p.ganancia = Number((((p.precio - p.costo) / p.costo) * 100).toFixed(2));
        }
        
        return true;
    }
};
