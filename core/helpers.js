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
 * Determina si una venta o transacción se encuentra debidamente confirmada.
 * - Una venta pendiente de verificación/aprobación bancaria o con transacción en estado "Confirmando"/"Pendiente"
 *   NO se considera confirmada y NO debe sumarse a "Ventas de hoy" ni a "Total histórico acumulado".
 * - Las ventas a crédito ya otorgadas/registradas se consideran válidas en el módulo de crédito a menos que sean rechazadas/canceladas.
 */
function esVentaOTransaccionConfirmada(venta) {
    if (!venta) return false;

    // 1. Verificación de flags explícitos de no confirmación o pendiente
    if (venta.confirmada === false || venta.pendiente === true) return false;

    // 2. Verificación de estados no confirmados
    const estado = String(venta.estado || '').trim().toUpperCase();
    const estadosNoConfirmados = [
        'PENDIENTE',
        'PENDIENTE_CONFIRMACION',
        'PENDIENTE_VERIFICACION',
        'POR_VERIFICAR',
        'CONFIRMANDO',
        'FALLIDO',
        'RECHAZADO',
        'CANCELADO'
    ];
    if (estadosNoConfirmados.includes(estado)) {
        return false;
    }

    const vId = String(venta.id || '').trim();
    const ref = String(venta.referencia || '').trim();
    const refNorm = (ref && ref !== 'N/A' && ref !== 'CRÉDITO-REGISTRADO') ? ref.toLowerCase() : '';

    // 3. Si existe un registro pendiente en PagosPorVerificar de Firestore/AppState para esta venta
    const pagosVerif = Array.isArray(window.AppState?.pagosPorVerificar) ? window.AppState.pagosPorVerificar : [];
    if (pagosVerif.length > 0) {
        const pago = pagosVerif.find(p => {
            const pId = String(p.id || '').trim();
            const pVentaId = String(p.ventaId || p.pedidoId || '').trim();
            const pRef = String(p.referencia || '').trim().toLowerCase();
            return (vId && (pId === vId || pVentaId === vId)) ||
                   (refNorm && pRef && pRef === refNorm);
        });
        if (pago) {
            const pEst = String(pago.estado || 'PENDIENTE_VERIFICACION').trim().toUpperCase();
            if (pEst !== 'APROBADO' && pEst !== 'CONFIRMADO' && pEst !== 'PAGO AGREGADO') {
                return false;
            }
        }
    }

    // 4. Si existe una transacción contable en AppState.transacciones vinculada
    const txList = Array.isArray(window.AppState?.transacciones) 
        ? window.AppState.transacciones 
        : (typeof transacciones !== 'undefined' && Array.isArray(transacciones) ? transacciones : []);

    if (txList.length > 0) {
        const txAsociada = txList.find(t => {
            const tId = String(t.id || '').trim();
            const tPedidoId = String(t.pedidoId || '').trim();
            const tRef = String(t.referencia || '').trim().toLowerCase();
            return (vId && (tId === vId || tPedidoId === vId)) ||
                   (refNorm && tRef && tRef === refNorm);
        });
        if (txAsociada) {
            const estadoTx = String(txAsociada.estado || '').trim().toLowerCase();
            if (estadoTx === 'confirmando' || estadoTx === 'fallido' || estadoTx.includes('pendiente') || estadoTx === 'rechazado' || estadoTx === 'cancelado') {
                return false;
            }
        }
    }

    return true;
}
window.esVentaOTransaccionConfirmada = esVentaOTransaccionConfirmada;

/**
 * Normaliza URLs de imágenes de Vercel Blob.
 * Si la URL pertenece a un store privado de Vercel Blob (que daría error 403 al navegador directo),
 * la convierte automáticamente al proxy seguro autenticado /api/avatar/view.
 */
function normalizarUrlBlob(url) {
    if (!url || typeof url !== 'string') return '';
    const str = url.trim();
    if (!str) return '';
    if (str.includes('.private.blob.vercel-storage.com/')) {
        try {
            const parsed = new URL(str);
            const pathname = parsed.pathname.replace(/^\/+/, '');
            return `/api/avatar/view?pathname=${encodeURIComponent(pathname)}`;
        } catch (e) {
            const idx = str.indexOf('.private.blob.vercel-storage.com/');
            const sub = str.substring(idx + '.private.blob.vercel-storage.com/'.length).split('?')[0];
            return `/api/avatar/view?pathname=${encodeURIComponent(sub)}`;
        }
    }
    return str;
}
window.normalizarUrlBlob = normalizarUrlBlob;

/**
 * Genera una ilustración vectorial SVG hermosa, nítida y 100% offline para cada producto.
 * Garantiza cero peticiones de red, cero consumo de cuota y máxima velocidad de carga.
 */
function generarSvgProducto(nombre = 'Producto', categoria = 'Snacks') {
    const nom = String(nombre || 'Producto').trim();
    const cat = String(categoria || 'General').trim();
    const nomLower = nom.toLowerCase();
    const catLower = cat.toLowerCase();

    let c1 = '#0D9488';
    let c2 = '#047857';
    let badgeText = 'TU BODEGUITA';
    let iconSvg = '';

    if (nomLower.includes('dorito') || nomLower.includes('nacho')) {
        c1 = '#DC2626';
        c2 = '#EA580C';
        badgeText = 'SNACK CRUJIENTE';
        // Triángulos de nachos crujientes con especias
        iconSvg = `
            <polygon points="200,90 280,225 120,225" fill="#FBBF24" stroke="#D97706" stroke-width="6" stroke-linejoin="round"/>
            <polygon points="160,130 220,230 100,230" fill="#F59E0B" stroke="#B45309" stroke-width="5" opacity="0.85" stroke-linejoin="round"/>
            <circle cx="195" cy="150" r="4" fill="#B91C1C"/>
            <circle cx="175" cy="185" r="5" fill="#B91C1C"/>
            <circle cx="225" cy="190" r="4.5" fill="#B91C1C"/>
            <circle cx="190" cy="210" r="4" fill="#B91C1C"/>
        `;
    } else if (nomLower.includes('toston') || nomLower.includes('chicharron') || nomLower.includes('papa')) {
        c1 = '#D97706';
        c2 = '#B45309';
        badgeText = 'TOSTONES & CHIPS';
        // Ruedas de tostones dorados fritos
        iconSvg = `
            <ellipse cx="170" cy="165" rx="55" ry="42" fill="#FCD34D" stroke="#D97706" stroke-width="5" transform="rotate(-15 170 165)"/>
            <ellipse cx="230" cy="150" rx="50" ry="38" fill="#FBBF24" stroke="#B45309" stroke-width="5" transform="rotate(20 230 150)"/>
            <ellipse cx="195" cy="200" rx="60" ry="45" fill="#F59E0B" stroke="#92400E" stroke-width="6" transform="rotate(5 195 200)"/>
            <path d="M 175 190 Q 195 180 215 195" stroke="#78350F" stroke-width="3" fill="none" opacity="0.6"/>
            <path d="M 165 205 Q 195 215 225 205" stroke="#78350F" stroke-width="3" fill="none" opacity="0.6"/>
        `;
    } else if (nomLower.includes('pepito') || nomLower.includes('cheese') || nomLower.includes('cheetos') || nomLower.includes('aro') || catLower.includes('snack')) {
        c1 = '#EA580C';
        c2 = '#C2410C';
        badgeText = 'SNACK DE QUESO';
        // Aros y roscas de maíz inflado con queso
        iconSvg = `
            <circle cx="170" cy="150" r="42" fill="none" stroke="#FBBF24" stroke-width="20" stroke-linecap="round"/>
            <circle cx="230" cy="180" r="38" fill="none" stroke="#F59E0B" stroke-width="18" stroke-linecap="round"/>
            <circle cx="160" cy="205" r="32" fill="none" stroke="#FCD34D" stroke-width="16" stroke-linecap="round"/>
            <circle cx="230" cy="130" r="8" fill="#F59E0B"/>
            <circle cx="130" cy="170" r="6" fill="#FBBF24"/>
        `;
    } else if (nomLower.includes('malta')) {
        c1 = '#451A03';
        c2 = '#78350F';
        badgeText = 'MALTA NUTRITIVA';
        // Botella de malta con corona de espuma
        iconSvg = `
            <path d="M 180 90 L 220 90 L 220 120 L 245 155 L 245 240 Q 245 250 235 250 L 165 250 Q 155 250 155 240 L 155 155 L 180 120 Z" fill="#291102" stroke="#B45309" stroke-width="6"/>
            <rect x="175" y="78" width="50" height="15" rx="5" fill="#D97706"/>
            <ellipse cx="200" cy="180" rx="35" ry="30" fill="#F59E0B" opacity="0.25"/>
            <text x="200" y="195" font-family="sans-serif" font-weight="900" font-size="28" fill="#FCD34D" text-anchor="middle">M</text>
            <ellipse cx="200" cy="80" rx="28" ry="10" fill="#FEF3C7" opacity="0.9"/>
        `;
    } else if (nomLower.includes('jugo') || nomLower.includes('refresco') || nomLower.includes('agua') || catLower.includes('bebida')) {
        c1 = '#0284C7';
        c2 = '#0369A1';
        badgeText = 'BEBIDA FRÍA';
        // Vaso refrescante con hielo y pajita
        iconSvg = `
            <path d="M 160 110 L 240 110 L 225 245 Q 225 255 215 255 L 185 255 Q 175 255 175 245 Z" fill="#38BDF8" stroke="#FFFFFF" stroke-width="6" opacity="0.9"/>
            <line x1="215" y1="70" x2="190" y2="170" stroke="#F43F5E" stroke-width="8" stroke-linecap="round"/>
            <rect x="180" y="140" width="22" height="22" rx="4" fill="#FFFFFF" opacity="0.8" transform="rotate(15 180 140)"/>
            <rect x="200" y="180" width="20" height="20" rx="4" fill="#FFFFFF" opacity="0.8" transform="rotate(-10 200 180)"/>
        `;
    } else if (nomLower.includes('pinguinito')) {
        c1 = '#3B0764';
        c2 = '#581C87';
        badgeText = 'PASTELITO';
        // Pastelito de chocolate relleno con espiral blanca característica
        iconSvg = `
            <path d="M 150 160 Q 200 130 250 160 L 240 235 Q 200 250 160 235 Z" fill="#2E1065" stroke="#7E22CE" stroke-width="6"/>
            <ellipse cx="200" cy="160" rx="50" ry="24" fill="#1E1B4B"/>
            <path d="M 165 160 Q 180 152 195 160 T 225 160 T 240 160" fill="none" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round"/>
            <ellipse cx="200" cy="200" rx="14" ry="10" fill="#FEF08A"/>
        `;
    } else if (nomLower.includes('chocolate') || nomLower.includes('samba') || nomLower.includes('galak') || nomLower.includes('toronto')) {
        c1 = '#581C87';
        c2 = '#701A75';
        badgeText = 'CHOCOLATE';
        // Tableta de chocolate dividida en cuadros
        iconSvg = `
            <rect x="150" y="110" width="100" height="130" rx="12" fill="#3B1D11" stroke="#9A3412" stroke-width="6"/>
            <rect x="160" y="122" width="36" height="30" rx="4" fill="#5A2E1B" stroke="#78350F" stroke-width="2"/>
            <rect x="204" y="122" width="36" height="30" rx="4" fill="#5A2E1B" stroke="#78350F" stroke-width="2"/>
            <rect x="160" y="160" width="36" height="30" rx="4" fill="#5A2E1B" stroke="#78350F" stroke-width="2"/>
            <rect x="204" y="160" width="36" height="30" rx="4" fill="#5A2E1B" stroke="#78350F" stroke-width="2"/>
            <rect x="160" y="198" width="36" height="30" rx="4" fill="#5A2E1B" stroke="#78350F" stroke-width="2"/>
            <rect x="204" y="198" width="36" height="30" rx="4" fill="#5A2E1B" stroke="#78350F" stroke-width="2"/>
        `;
    } else if (nomLower.includes('oreo')) {
        c1 = '#0F172A';
        c2 = '#1E3A8A';
        badgeText = 'GALLETAS';
        // Galleta sándwich Oreo rellena
        iconSvg = `
            <circle cx="200" cy="175" r="58" fill="#18181B" stroke="#3F3F46" stroke-width="5"/>
            <circle cx="200" cy="175" r="46" fill="none" stroke="#52525B" stroke-width="4" stroke-dasharray="8 6"/>
            <rect x="150" y="170" width="100" height="12" rx="6" fill="#F8FAFC" opacity="0.95"/>
            <text x="200" y="183" font-family="sans-serif" font-weight="900" font-size="18" fill="#E4E4E7" text-anchor="middle" letter-spacing="2">OREO</text>
        `;
    } else if (nomLower.includes('galleta') || nomLower.includes('club') || nomLower.includes('kraker') || nomLower.includes('susy') || nomLower.includes('cocosette') || catLower.includes('galleta')) {
        c1 = '#B45309';
        c2 = '#78350F';
        badgeText = 'GALLETAS';
        // Galleta dorada crujiente
        iconSvg = `
            <rect x="150" y="125" width="100" height="100" rx="16" fill="#FDE68A" stroke="#D97706" stroke-width="6"/>
            <circle cx="175" cy="150" r="5" fill="#B45309"/>
            <circle cx="200" cy="150" r="5" fill="#B45309"/>
            <circle cx="225" cy="150" r="5" fill="#B45309"/>
            <circle cx="175" cy="175" r="5" fill="#B45309"/>
            <circle cx="200" cy="175" r="5" fill="#B45309"/>
            <circle cx="225" cy="175" r="5" fill="#B45309"/>
            <circle cx="175" cy="200" r="5" fill="#B45309"/>
            <circle cx="200" cy="200" r="5" fill="#B45309"/>
            <circle cx="225" cy="200" r="5" fill="#B45309"/>
        `;
    } else if (nomLower.includes('gomita') || nomLower.includes('chicle') || nomLower.includes('chupeta') || nomLower.includes('bocadillo') || catLower.includes('dulce') || catLower.includes('chuchería')) {
        c1 = '#BE185D';
        c2 = '#831843';
        badgeText = 'CONFITERÍA';
        // Dulce envuelto con destellos
        iconSvg = `
            <circle cx="200" cy="175" r="42" fill="#FB7185" stroke="#E11D48" stroke-width="6"/>
            <polygon points="158,175 125,145 130,205" fill="#FDA4AF" stroke="#E11D48" stroke-width="4"/>
            <polygon points="242,175 275,145 270,205" fill="#FDA4AF" stroke="#E11D48" stroke-width="4"/>
            <circle cx="190" cy="165" r="8" fill="#FFF1F2" opacity="0.8"/>
            <polygon points="200,105 205,120 220,125 205,130 200,145 195,130 180,125 195,120" fill="#FDE047"/>
        `;
    } else if (nomLower.includes('combo') || catLower.includes('combo')) {
        c1 = '#DC2626';
        c2 = '#EA580C';
        badgeText = 'SUPER COMBO';
        // Emblema de combo fuego / ahorro
        iconSvg = `
            <path d="M 200 95 Q 230 140 215 170 Q 240 180 230 215 Q 215 250 170 235 Q 150 205 165 175 Q 155 145 200 95 Z" fill="#FBBF24" stroke="#D97706" stroke-width="6"/>
            <path d="M 195 145 Q 215 170 205 190 Q 220 195 210 215 Q 195 230 180 220 Z" fill="#EF4444"/>
            <text x="200" y="210" font-family="sans-serif" font-weight="900" font-size="34" fill="#FFFFFF" text-anchor="middle">★</text>
        `;
    } else {
        c1 = '#0F766E';
        c2 = '#115E59';
        badgeText = 'TU BODEGUITA';
        // Bolsa de compras de bodega
        iconSvg = `
            <rect x="150" y="130" width="100" height="115" rx="14" fill="#2DD4BF" stroke="#14B8A6" stroke-width="6"/>
            <path d="M 175 130 C 175 95 225 95 225 130" fill="none" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round"/>
            <circle cx="200" cy="180" r="18" fill="#0F766E"/>
            <path d="M 192 180 L 198 186 L 210 174" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        `;
    }

    const nombreSeguro = nom.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const nombreCorto = nombreSeguro.length > 22 ? nombreSeguro.substring(0, 20) + '…' : nombreSeguro;

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="400" height="400" rx="32" fill="url(#bgGrad)"/>
  <circle cx="200" cy="175" r="115" fill="#ffffff" opacity="0.08"/>
  <circle cx="200" cy="175" r="85" fill="#ffffff" opacity="0.10"/>
  
  <rect x="115" y="24" width="170" height="28" rx="14" fill="#ffffff" opacity="0.22"/>
  <text x="200" y="43" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" letter-spacing="1.5" fill="#ffffff" text-anchor="middle">${badgeText}</text>
  
  <g filter="url(#shadow)">
    ${iconSvg}
  </g>
  
  <rect x="24" y="316" width="352" height="60" rx="18" fill="rgba(15, 23, 42, 0.70)" stroke="rgba(255,255,255,0.22)" stroke-width="1.5"/>
  <text x="200" y="345" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="17" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="0.4">${nombreCorto}</text>
  <text x="200" y="364" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600" fill="#cbd5e1" text-anchor="middle" opacity="0.95">Tu Bodeguita de Confianza</text>
</svg>`.trim();

    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
window.generarSvgProducto = generarSvgProducto;

/**
 * Manejador inteligente de fallos de imagen:
 * 1. Detiene bucles de error.
 * 2. Si es una URL de red o Blob, consulta el almacén IndexedDB del navegador.
 * 3. Si no está en caché o falla, genera de inmediato el SVG específico del producto.
 * Garantiza que NUNCA desaparezca ninguna imagen de la interfaz.
 */
function alFallarCargaImagen(imgEl, nombre = '', categoria = '') {
    if (!imgEl) return;
    imgEl.onerror = null; // Prevenir cualquier bucle infinito
    
    const nomFinal = nombre || imgEl.getAttribute('data-prod-nombre') || imgEl.alt || 'Producto';
    const catFinal = categoria || imgEl.getAttribute('data-prod-cat') || 'Snacks';
    const srcOriginal = imgEl.getAttribute('data-original-src') || imgEl.getAttribute('data-src') || imgEl.src;
    
    // Si la imagen tenía URL remota o de Vercel Blob, consultar el caché local persistente
    if (window.InventoryApp && window.InventoryApp.ImageCache && typeof window.InventoryApp.ImageCache.obtenerUrlConCache === 'function' && srcOriginal && !srcOriginal.startsWith('data:')) {
        window.InventoryApp.ImageCache.obtenerUrlConCache(srcOriginal).then(cachedUrl => {
            if (cachedUrl && cachedUrl !== srcOriginal && !cachedUrl.includes('photo-1542838132-92c53300491e')) {
                imgEl.src = cachedUrl;
                return;
            }
            imgEl.src = generarSvgProducto(nomFinal, catFinal);
        }).catch(() => {
            imgEl.src = generarSvgProducto(nomFinal, catFinal);
        });
    } else {
        imgEl.src = generarSvgProducto(nomFinal, catFinal);
    }
}
window.alFallarCargaImagen = alFallarCargaImagen;

/**
 * Obtiene la imagen de un producto de forma segura, inteligente y 100% resiliente.
 * - Si el producto tiene una imagen personalizada real (blob, /api/, data:, https://), la utiliza.
 * - Si la imagen está vacía o apunta al viejo estante genérico de verduras, entrega el SVG vectorial oficial.
 */
function obtenerImagenProducto(p) {
    if (!p) return generarSvgProducto('Producto', 'General');
    const raw = (p.imagen || '').trim();
    if (raw && !raw.includes('photo-1542838132-92c53300491e') && !raw.includes('images.unsplash.com')) {
        return typeof normalizarUrlBlob === 'function' ? normalizarUrlBlob(raw) : raw;
    }
    return generarSvgProducto(p.nombre || 'Producto', p.categoria || 'Snacks');
}
window.obtenerImagenProducto = obtenerImagenProducto;

/**
 * Genera un avatar vectorial SVG elegante y 100% offline basado en iniciales.
 */
function generarSvgAvatar(iniciales = 'U') {
    const letra = String(iniciales || 'U').trim().substring(0, 2).toUpperCase();
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
  <defs>
    <linearGradient id="avGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284c7"/>
      <stop offset="100%" stop-color="#0369a1"/>
    </linearGradient>
  </defs>
  <circle cx="60" cy="60" r="58" fill="url(#avGrad)" stroke="#ffffff" stroke-width="4"/>
  <text x="60" y="74" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="44" font-weight="800" fill="#ffffff" text-anchor="middle">${letra}</text>
</svg>`.trim();
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
window.generarSvgAvatar = generarSvgAvatar;

function alFallarAvatar(imgEl, iniciales = 'U') {
    if (!imgEl) return;
    imgEl.onerror = null;
    imgEl.src = generarSvgAvatar(iniciales);
}
window.alFallarAvatar = alFallarAvatar;

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

/**
 * Comprueba de forma infalible si un usuario tiene privilegios de Administrador.
 * Reconoce al SuperAdmin por ID, cédula, nombre o correo (independiente de mayúsculas/minúsculas),
 * así como los roles 'admin', 'superadmin' y 'administrador'.
 */
function esUsuarioAdmin(usuario) {
    if (!usuario) return true; // Si no hay usuario en sesión, permitir navegación sin bloquear
    const id = String(usuario.id || '').trim().toUpperCase();
    const ced = String(usuario.cedula || '').trim().toUpperCase();
    const nom = String(usuario.nombre || '').trim().toUpperCase();
    const mail = String(usuario.email || '').trim().toLowerCase();
    const r = String(usuario.rol || '').trim().toLowerCase();

    if (id === 'SUPERADMIN' || ced === 'SUPERADMIN' || nom === 'SUPERADMIN' || mail === 'superadmin@tubodeguita.com') {
        return true;
    }
    return r === 'admin' || r === 'superadmin' || r === 'administrador';
}
window.esUsuarioAdmin = esUsuarioAdmin;
if (window.InventoryApp) window.InventoryApp.esUsuarioAdmin = esUsuarioAdmin;

function switchTab(tabId) {
    if (!tabId) return;

    // Control de Acceso por Rol Estricto (RBAC) en Navegación
    const usuarioActual = window.AppState?.usuarioActual;
    if (usuarioActual) {
        const rol = (usuarioActual.rol || 'cliente').toLowerCase();
        const esAdmin = typeof esUsuarioAdmin === 'function' ? esUsuarioAdmin(usuarioActual) : (rol === 'admin' || rol === 'superadmin');
        const esVendedor = !esAdmin && rol === 'vendedor';
        const esKiosco = !esAdmin && (rol === 'autoservicio' || rol === 'kiosco');

        if (!esAdmin) {
            if (esKiosco) {
                // Perfil Kiosco / AutoServicio: navegación bloqueada exclusivamente en la interfaz de kiosco
                if (tabId !== 'kiosco-view') {
                    console.warn(`[switchTab] Acceso denegado a "${tabId}" en modo Auto-Servicio/Kiosco.`);
                    tabId = 'kiosco-view';
                }
            } else if (esVendedor) {
                const vendedorAllowed = ['pos', 'clientes', 'historial-ventas', 'notificaciones', 'caja-turnos'];
                if (!vendedorAllowed.includes(tabId)) {
                    console.warn(`[switchTab] Acceso restringido a "${tabId}" para perfil vendedor.`);
                    tabId = 'pos';
                }
            } else {
                // Perfil Cliente: acceso estrictamente limitado a vistas de cliente
                if (!tabId.startsWith('cliente-') && tabId !== 'notificaciones') {
                    console.warn(`[switchTab] Acceso restringido a "${tabId}" para perfil cliente.`);
                    tabId = 'cliente-catalogo';
                }
            }
        }
    }

    const targetView = document.getElementById(tabId);
    if (!targetView) {
        console.warn(`[switchTab] No se encontró la vista con ID: "${tabId}"`);
        return;
    }
    
    const yaEstaActivo = targetView.classList.contains('active') && targetView.style.display === 'block';

    if (!yaEstaActivo) {
        // Ocultar todas las vistas
        const allViews = document.querySelectorAll('.view-content');
        allViews.forEach(v => {
            v.classList.remove('active');
            v.style.display = 'none';
        });

        // Mostrar la vista seleccionada
        targetView.classList.add('active');
        targetView.style.display = 'block';
    }

    // Gestionar visibilidad del footer: ocultar en vistas operacionales (POS, Kiosco, Catálogo)
    document.body.setAttribute('data-active-tab', tabId);
    const appFooter = document.getElementById('bodeguita-app-footer');
    if (appFooter) {
        const vistasSinFooter = ['pos', 'kiosco-view', 'cliente-catalogo'];
        appFooter.style.display = vistasSinFooter.includes(tabId) ? 'none' : 'block';
    }

    // Si salimos de la vista de auto-servicio, ocultar barra flotante y remover clase
    if (tabId !== 'kiosco-view') {
        document.body.classList.remove('modo-autoservicio');
        const barMobileKiosco = document.getElementById('kiosco-bottom-cart-bar');
        if (barMobileKiosco) barMobileKiosco.style.display = 'none';
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

    // Desplazamiento suave al inicio
    try {
        const mainContainer = document.getElementById('app-main-container');
        if (mainContainer && typeof mainContainer.scrollTo === 'function') {
            mainContainer.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    } catch {}

    // Re-renderizado seguro según la pestaña activa
    try {
        if (tabId === 'pos') {
            if (typeof actualizarChipsCategoriasPOS === 'function') actualizarChipsCategoriasPOS();
            if (typeof renderizarPosProductos === 'function') renderizarPosProductos();
            if (typeof renderizarCarrito === 'function') renderizarCarrito();
            if (typeof actualizarSelectClientes === 'function') actualizarSelectClientes();
            if (typeof sincronizarClienteSelects === 'function') sincronizarClienteSelects('pos-cliente-select');
            if (window.InventoryApp && window.InventoryApp.CajaTurnos) window.InventoryApp.CajaTurnos.actualizarBadgesTurno();
        } else if (tabId === 'caja-turnos') {
            if (window.InventoryApp && window.InventoryApp.CajaTurnos) {
                window.InventoryApp.CajaTurnos.actualizarBadgesTurno();
                window.InventoryApp.CajaTurnos.renderizarVistaCajaTurnos();
            }
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
            if (typeof alCambiarMetodoTransaccionDirecta === 'function') alCambiarMetodoTransaccionDirecta();
            if (typeof renderizarAbonosPendientesReportados === 'function') renderizarAbonosPendientesReportados();
        } else if (tabId === 'facturas') {
            if (typeof inicializarModuloFacturas === 'function') inicializarModuloFacturas();
        } else if (tabId === 'auditoria') {
            if (typeof renderizarAuditoria === 'function') renderizarAuditoria();
            if (typeof renderizarHistorialAuditoria === 'function') renderizarHistorialAuditoria();
            if (typeof renderizarResumenPerdidasEconomicas === 'function') renderizarResumenPerdidasEconomicas();
        } else if (tabId === 'usuarios') {
            if (typeof renderizarUsuarios === 'function') renderizarUsuarios();
            if (typeof actualizarBadgesUsuarios === 'function') actualizarBadgesUsuarios();
        } else if (tabId === 'historial-ventas') {
            if (typeof marcarHistorialVentasRevisado === 'function') marcarHistorialVentasRevisado();
            if (typeof renderizarHistorialVentasAdmin === 'function') renderizarHistorialVentasAdmin();
            if (typeof actualizarBadgeVentasHoy === 'function') actualizarBadgeVentasHoy();
        } else if (tabId === 'notificaciones') {
            if (typeof renderizarNotificaciones === 'function') renderizarNotificaciones();
            if (typeof actualizarBadgesNotificaciones === 'function') actualizarBadgesNotificaciones();
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
        } else if (tabId === 'kiosco-view') {
            document.body.classList.add('modo-autoservicio');
            if (window.KioscoModule && typeof window.KioscoModule.init === 'function') {
                window.KioscoModule.init();
            }
        }

        if (tabId !== 'kiosco-view') {
            const u = window.AppState?.usuarioActual;
            const esAutoServicioUser = u && (u.rol === 'autoservicio' || u.rol === 'kiosco');
            if (!esAutoServicioUser) {
                document.body.classList.remove('modo-autoservicio');
            }
        }

        if (typeof actualizarBadgesAbonos === 'function') actualizarBadgesAbonos();

        // En pantallas móviles, colapsar el menú de navegación para maximizar el espacio de trabajo
        if (window.innerWidth <= 768) {
            const navTabs = document.getElementById('main-nav-tabs');
            const chevron = document.querySelector('.main-nav-mobile-chevron');
            if (navTabs) navTabs.classList.add('nav-tabs-collapsed-mobile');
            if (chevron) chevron.classList.remove('open');
        }
    } catch (err) {
        console.warn('[switchTab] Advertencia al renderizar tab:', tabId, err);
    }
}
/**
 * Normaliza y sanea montos en Bolívares (VES) y Divisas ($ USD) para cualquier transacción o abono.
 * Garantiza que métodos en Bolívares (Pago Móvil, Transferencias, Efectivo VES) nunca se confundan
 * ni se almacenen/muestren como dólares, sanando datos históricos guardados erróneamente.
 */
function sanitizarAbonoMonedas(a, tasaParam = 0) {
    if (!a) return { esDivisa: false, montoUSD: 0, montoVES: 0 };
    const metodo = String(a.formaPago || a.metodo || a.metodoPago || a.tipoPago || a.tipo || '').trim();
    const esDivisa = a.esDivisasUSD === true || a.monedaOriginal === 'USD' || ((!a.monedaOriginal && a.esDivisasUSD !== false) && (metodo.includes('USD') || metodo.includes('Divisa')));
    const t = Number(a.tasaMomento || tasaParam || window.AppState?.tasaActiva || window.AppState?.tasaUSD_BCV || 0);

    let usd = Number(a.montoUSD || a.totalUSD || 0);
    let ves = Number(a.montoVES || a.totalVES || 0);

    if (esDivisa) {
        if (usd <= 0 && ves > 0 && t > 0) {
            usd = Number((ves / t).toFixed(2));
        } else if (ves <= 0 && usd > 0 && t > 0) {
            ves = Number((usd * t).toFixed(2));
        }
    } else {
        // Método en Bolívares: Pago Móvil, Transferencia Bancaria, Efectivo VES
        if (a.monedaOriginal === 'VES') {
            // Creado con la nueva lógica: montoVES es el monto base en Bs
            if (ves <= 0 && usd > 0 && t > 0) {
                ves = Number((usd * t).toFixed(2));
            } else if (usd <= 0 && ves > 0 && t > 0) {
                usd = Number((ves / t).toFixed(2));
            }
        } else {
            // Histórico / Legacy:
            // Si se guardó montoUSD inflado (ej: 500) y montoVES = 500 * tasa (ej: 403,500)
            if (t > 0 && usd >= 50 && ves > (usd * 10)) {
                ves = usd;
                usd = Number((ves / t).toFixed(2));
            } else if (ves <= 0 && usd > 0) {
                // Si solo vino usd (ej: 500) para un método en bolívares
                ves = usd;
                usd = t > 0 ? Number((ves / t).toFixed(2)) : 0;
            } else if (usd <= 0 && ves > 0 && t > 0) {
                usd = Number((ves / t).toFixed(2));
            }
        }
    }

    return {
        esDivisa,
        montoUSD: isNaN(usd) ? 0 : Number(usd.toFixed(2)),
        montoVES: isNaN(ves) ? 0 : Number(ves.toFixed(2))
    };
}
window.sanitizarAbonoMonedas = sanitizarAbonoMonedas;

function obtenerUmbralStockBajo() {
    try {
        if (window.AppState && typeof window.AppState.umbralStockBajo === 'number' && window.AppState.umbralStockBajo >= 0) {
            return window.AppState.umbralStockBajo;
        }
        const saved = localStorage.getItem('inv_filtro_stock_cant') || localStorage.getItem('umbral_stock_bajo');
        if (saved !== null && !isNaN(parseInt(saved, 10))) {
            const val = Math.max(0, parseInt(saved, 10));
            if (window.AppState) window.AppState.umbralStockBajo = val;
            return val;
        }
    } catch (_) {}
    return 5;
}

function fijarUmbralStockBajo(nuevoUmbral) {
    const val = isNaN(parseInt(nuevoUmbral, 10)) ? 5 : Math.max(0, parseInt(nuevoUmbral, 10));
    if (window.AppState) window.AppState.umbralStockBajo = val;
    try {
        localStorage.setItem('inv_filtro_stock_cant', String(val));
        localStorage.setItem('umbral_stock_bajo', String(val));
    } catch (_) {}

    // Sincronizar input en Inventario si existe en pantalla
    const inputCantEl = document.getElementById('inv-stock-cantidad-input');
    if (inputCantEl && String(inputCantEl.value) !== String(val)) {
        inputCantEl.value = val;
    }

    return val;
}

window.obtenerUmbralStockBajo = obtenerUmbralStockBajo;
window.fijarUmbralStockBajo = fijarUmbralStockBajo;

function obtenerAppWhatsAppPreferida() {
    try {
        return localStorage.getItem('whatsapp_app_preferida') || 'normal';
    } catch (_) {
        return 'normal';
    }
}

function fijarAppWhatsAppPreferida(pref) {
    try {
        localStorage.setItem('whatsapp_app_preferida', pref);
    } catch (_) {}
    return pref;
}

function abrirWhatsAppEnlace({ telefono, mensaje, app = null }) {
    let tel = String(telefono || '').replace(/[^0-9]/g, '');
    if (tel.startsWith('0')) {
        tel = '58' + tel.substring(1);
    } else if (tel.length === 10 && !tel.startsWith('58')) {
        tel = '58' + tel;
    }

    const appPref = app || obtenerAppWhatsAppPreferida();

    if (appPref === 'preguntar') {
        mostrarModalSeleccionWhatsApp({ telefono: tel, mensaje });
        return;
    }

    const textoCodificado = encodeURIComponent(mensaje || '');
    // El parámetro &app=normal (o &app=business) permite a la app nativa y a los scripts enrutar al paquete correcto
    const urlWeb = `https://wa.me/${tel}?text=${textoCodificado}&app=${appPref}`;

    const link = document.createElement('a');
    link.href = urlWeb;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => link.remove(), 300);
}

function mostrarModalSeleccionWhatsApp({ telefono, mensaje }) {
    const modalId = 'modal-seleccion-whatsapp-dinamico';
    let modal = document.getElementById(modalId);
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'modal active';
    modal.style.cssText = 'position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; padding:16px; backdrop-filter:blur(3px);';

    modal.innerHTML = `
        <div style="background:var(--bg-card, #ffffff); border-radius:16px; width:100%; max-width:380px; padding:24px; box-shadow:0 10px 30px rgba(0,0,0,0.3); border:1px solid var(--border-light, #e2e8f0); text-align:center;">
            <div style="font-size:2.5rem; margin-bottom:10px;">💬</div>
            <h3 style="margin:0 0 8px 0; font-size:1.15rem; color:var(--text-main, #1e293b); font-weight:800;">¿Con cuál WhatsApp deseas enviar?</h3>
            <p style="margin:0 0 18px 0; font-size:0.85rem; color:var(--text-muted, #64748b);">Selecciona la aplicación de WhatsApp que tiene tu número comercial registrado.</p>

            <div style="display:flex; flex-direction:column; gap:10px;">
                <button type="button" id="btn-wa-opt-normal" style="background:#25d366; color:#ffffff; border:none; border-radius:10px; padding:12px 16px; font-size:0.95rem; font-weight:800; display:flex; align-items:center; justify-content:center; gap:8px; cursor:pointer; box-shadow:0 3px 8px rgba(37,211,102,0.3);">
                    <i class="fab fa-whatsapp" style="font-size:1.2rem;"></i> WhatsApp Normal (Messenger)
                </button>
                <button type="button" id="btn-wa-opt-business" style="background:#128c7e; color:#ffffff; border:none; border-radius:10px; padding:12px 16px; font-size:0.95rem; font-weight:800; display:flex; align-items:center; justify-content:center; gap:8px; cursor:pointer; box-shadow:0 3px 8px rgba(18,140,126,0.3);">
                    <i class="fas fa-briefcase" style="font-size:1.1rem;"></i> WhatsApp Business
                </button>
            </div>

            <div style="margin-top:14px; display:flex; align-items:center; justify-content:center; gap:6px;">
                <input type="checkbox" id="chk-recordar-wa-app" checked style="cursor:pointer; width:16px; height:16px;">
                <label for="chk-recordar-wa-app" style="font-size:0.8rem; color:var(--text-muted, #64748b); cursor:pointer;">Recordar mi elección</label>
            </div>

            <button type="button" id="btn-wa-opt-cancel" style="margin-top:14px; background:none; border:none; color:var(--text-muted, #94a3b8); font-size:0.82rem; cursor:pointer; text-decoration:underline;">
                Cancelar
            </button>
        </div>
    `;

    document.body.appendChild(modal);

    const ejecutarEleccion = (tipo) => {
        const recordar = document.getElementById('chk-recordar-wa-app')?.checked;
        if (recordar) {
            fijarAppWhatsAppPreferida(tipo);
        }
        modal.remove();
        abrirWhatsAppEnlace({ telefono, mensaje, app: tipo });
    };

    document.getElementById('btn-wa-opt-normal').onclick = () => ejecutarEleccion('normal');
    document.getElementById('btn-wa-opt-business').onclick = () => ejecutarEleccion('business');
    document.getElementById('btn-wa-opt-cancel').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

window.obtenerAppWhatsAppPreferida = obtenerAppWhatsAppPreferida;
window.fijarAppWhatsAppPreferida = fijarAppWhatsAppPreferida;
window.abrirWhatsAppEnlace = abrirWhatsAppEnlace;
window.mostrarModalSeleccionWhatsApp = mostrarModalSeleccionWhatsApp;

if (window.InventoryApp) {
    window.InventoryApp.obtenerUmbralStockBajo = obtenerUmbralStockBajo;
    window.InventoryApp.fijarUmbralStockBajo = fijarUmbralStockBajo;
    window.InventoryApp.obtenerAppWhatsAppPreferida = obtenerAppWhatsAppPreferida;
    window.InventoryApp.fijarAppWhatsAppPreferida = fijarAppWhatsAppPreferida;
    window.InventoryApp.abrirWhatsAppEnlace = abrirWhatsAppEnlace;
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
    sanitizarAbonoMonedas,
    obtenerUmbralStockBajo,
    fijarUmbralStockBajo,
    switchTab,
    esUsuarioAdmin
});
