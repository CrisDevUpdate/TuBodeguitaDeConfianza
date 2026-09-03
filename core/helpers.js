/* core/helpers.js - shared pure utilities */
window.InventoryApp = window.InventoryApp || {};

function escaparHtmlInventario(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function normalizarTextoBusqueda(texto) {
    return String(texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

function referenciaNormalizada(ref) {
    return String(ref || '')
        .trim()
        .replace(/[\s-]+/g, '')
        .toUpperCase();
}

function normalizarMontoTransaccion(valor) {
    let texto = String(valor ?? '').trim();
    if (!texto) return NaN;

    texto = texto.replace(/\s/g, '');
    if (texto.includes(',') && texto.includes('.')) {
        const ultimo = Math.max(texto.lastIndexOf(','), texto.lastIndexOf('.'));
        const entero = texto.slice(0, ultimo).replace(/[.,]/g, '');
        const decimal = texto.slice(ultimo + 1).replace(/\D/g, '');
        texto = `${entero}.${decimal}`;
    } else if (texto.includes(',')) {
        texto = texto.replace(',', '.');
    }

    const numero = Number(texto);
    return Number.isFinite(numero) ? numero : NaN;
}

function fechaHoraActual() {
    return new Date().toISOString().replace('T', ' ').substring(0, 16);
}

/**
 * Implementación de SHA-256 estándar pura y robusta (funciona en cualquier navegador y contexto http/https/iframe)
 */
function sha256Sync(ascii) {
    function rightRotate(value, amount) {
        return (value >>> amount) | (value << (32 - amount));
    }
    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    let result = '';
    const words = [];
    const asciiBitLength = ascii.length * 8;
    
    // Initial hash value: first 32 bits of the fractional parts of the square roots of the first 8 primes
    let hash = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];
    
    // First 64 prime constants
    const k = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    let i = 0;
    for (i = 0; i < ascii.length; i++) {
        const j = ascii.charCodeAt(i);
        words[i >> 2] |= j << ((3 - (i % 4)) * 8);
    }
    words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
    words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

    const w = new Array(64);
    for (let chunk = 0; chunk < words.length; chunk += 16) {
        let a = hash[0];
        let b = hash[1];
        let c = hash[2];
        let d = hash[3];
        let e = hash[4];
        let f = hash[5];
        let g = hash[6];
        let h = hash[7];

        for (let j = 0; j < 64; j++) {
            if (j < 16) {
                w[j] = words[chunk + j] | 0;
            } else {
                const gamma0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
                const gamma1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
                w[j] = (w[j - 16] + gamma0 + w[j - 7] + gamma1) | 0;
            }

            const ch = (e & f) ^ (~e & g);
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const sigma0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
            const sigma1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
            const temp1 = (h + sigma1 + ch + k[j] + w[j]) | 0;
            const temp2 = (sigma0 + maj) | 0;

            h = g;
            g = f;
            f = e;
            e = (d + temp1) | 0;
            d = c;
            c = b;
            b = a;
            a = (temp1 + temp2) | 0;
        }

        hash[0] = (hash[0] + a) | 0;
        hash[1] = (hash[1] + b) | 0;
        hash[2] = (hash[2] + c) | 0;
        hash[3] = (hash[3] + d) | 0;
        hash[4] = (hash[4] + e) | 0;
        hash[5] = (hash[5] + f) | 0;
        hash[6] = (hash[6] + g) | 0;
        hash[7] = (hash[7] + h) | 0;
    }

    for (let j = 0; j < 8; j++) {
        for (let bit = 3; bit >= 0; bit--) {
            const byte = (hash[j] >> (bit * 8)) & 255;
            result += (byte < 16 ? '0' : '') + byte.toString(16);
        }
    }
    return result;
}

/**
 * Genera un Hash criptográfico SHA-256 irreversible para proteger contraseñas.
 */
function calcularHashSha256(texto) {
    if (!texto && texto !== 0) return '';
    const str = String(texto).trim();
    if (!str) return '';
    return sha256Sync(str);
}

/**
 * Valida si la contraseña introducida coincide con el Hash o texto almacenado.
 */
function verificarPasswordHash(inputPassword, storedPasswordOrHash) {
    if (!inputPassword && inputPassword !== 0) return false;
    const cleanInput = String(inputPassword).trim();
    const cleanStored = String(storedPasswordOrHash || '').trim();

    if (!cleanInput) return false;

    // 1. Coincidencia directa por Hash SHA-256
    const inputHash = calcularHashSha256(cleanInput);
    if (cleanStored && inputHash && cleanStored.toLowerCase() === inputHash.toLowerCase()) {
        return true;
    }

    // 2. Coincidencia para migración de contraseñas previas sin hashear
    if (cleanStored && cleanStored === cleanInput) {
        return true;
    }

    return false;
}

function switchTab(tabId) {
    if (!tabId) return;

    // Control estricto de acceso RBAC por rol
    const usuario = window.AppState?.usuarioActual;
    const rol = (usuario?.rol || 'cliente').toLowerCase();
    const esAdmin = rol === 'admin' || rol === 'superadmin';
    const esVendedor = rol === 'vendedor';
    const vendedorAllowedTabs = ['pos', 'clientes', 'historial-ventas'];

    if (!esAdmin) {
        if (esVendedor && !vendedorAllowedTabs.includes(tabId)) {
            console.warn(`[RBAC] Acceso denegado a la pestaña ${tabId} para el rol Vendedor.`);
            tabId = 'pos';
        } else if (!esVendedor && !tabId.startsWith('cliente-')) {
            console.warn(`[RBAC] Acceso denegado a la pestaña administrativa ${tabId} para el rol Cliente.`);
            tabId = 'cliente-catalogo';
        }
    }
    
    // Ocultar todas las vistas
    const allViews = document.querySelectorAll('.view-content');
    allViews.forEach(v => {
        v.classList.remove('active');
        v.style.display = 'none';
    });

    // Mostrar la vista seleccionada
    const targetView = document.getElementById(tabId);
    if (targetView) {
        targetView.classList.add('active');
        targetView.style.display = 'block';
    }

    // Actualizar botones de navegación desktop
    const allNavButtons = document.querySelectorAll('#main-nav-tabs .nav-btn');
    allNavButtons.forEach(btn => {
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Actualizar botones de navegación móvil
    const allMobileNavButtons = document.querySelectorAll('#mobile-bottom-nav .bottom-nav-item');
    allMobileNavButtons.forEach(btn => {
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Re-renderizado seguro según la pestaña activa
    try {
        if (tabId === 'pos') {
            if (typeof renderizarPosProductos === 'function') renderizarPosProductos();
            if (typeof renderizarCarrito === 'function') renderizarCarrito();
        } else if (tabId === 'inventario') {
            if (typeof renderizarInventario === 'function') renderizarInventario();
            if (typeof prepararCodigoNuevoProducto === 'function') prepararCodigoNuevoProducto();
        } else if (tabId === 'clientes') {
            if (typeof renderizarClientes === 'function') renderizarClientes();
            if (typeof renderizarHistorialClientesEliminados === 'function') renderizarHistorialClientesEliminados();
            if (typeof renderizarAbonosPendientesReportados === 'function') renderizarAbonosPendientesReportados();
        } else if (tabId === 'transacciones') {
            if (typeof renderizarTransacciones === 'function') renderizarTransacciones();
            if (typeof actualizarSelectTransacciones === 'function') actualizarSelectTransacciones();
            if (typeof renderizarAbonosPendientesReportados === 'function') renderizarAbonosPendientesReportados();
        } else if (tabId === 'auditoria') {
            if (typeof renderizarAuditoria === 'function') renderizarAuditoria();
            if (typeof renderizarHistorialAuditoria === 'function') renderizarHistorialAuditoria();
            if (typeof renderizarResumenPerdidasEconomicas === 'function') renderizarResumenPerdidasEconomicas();
        } else if (tabId === 'usuarios') {
            if (typeof renderizarUsuarios === 'function') renderizarUsuarios();
        } else if (tabId === 'historial-ventas') {
            if (typeof renderizarHistorialVentasAdmin === 'function') renderizarHistorialVentasAdmin();
        } else if (tabId === 'premio-mes-admin') {
            if (typeof renderizarConfiguradorPremioAdmin === 'function') renderizarConfiguradorPremioAdmin();
        } else if (tabId === 'configuracion') {
            if (typeof renderizarConfiguracionAdmin === 'function') renderizarConfiguracionAdmin();
        } else if (tabId === 'cliente-catalogo') {
            if (typeof renderizarCatalogoCliente === 'function') renderizarCatalogoCliente();
            if (typeof renderizarCarritoCliente === 'function') renderizarCarritoCliente();
        } else if (tabId === 'cliente-cuenta') {
            if (typeof renderizarEstadoCuentaCliente === 'function') renderizarEstadoCuentaCliente();
        } else if (tabId === 'cliente-premio') {
            if (typeof renderizarPremioMesCliente === 'function') renderizarPremioMesCliente();
        } else if (tabId === 'cliente-perfil') {
            if (typeof renderizarPerfilCliente === 'function') renderizarPerfilCliente();
        }

        if (typeof actualizarBadgesAbonos === 'function') actualizarBadgesAbonos();
    } catch (err) {
        console.warn('[switchTab] Advertencia al renderizar tab:', tabId, err);
    }
}
window.switchTab = switchTab;

window.InventoryApp.Helpers = Object.freeze({
    escaparHtmlInventario,
    normalizarTextoBusqueda,
    referenciaNormalizada,
    normalizarMontoTransaccion,
    fechaHoraActual,
    calcularHashSha256,
    verificarPasswordHash,
    switchTab
});
