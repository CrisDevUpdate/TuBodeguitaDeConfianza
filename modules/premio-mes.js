/**
 * modules/premio-mes.js
 * Módulo de Fidelización & Gamificación: Premio del Mes, Acumulación de Puntos y Canjes
 * Cohesivo con el Sistema POS y Catálogo de Inventario Multimoneda.
 */

window.InventoryApp = window.InventoryApp || {};

// Presets de imágenes de premios populares para conveniencia
const PRESETS_PREMIOS = [
    {
        nombre: 'Cafetera Espresso Digital 1.5L',
        puntos: 200,
        imagen: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600&auto=format&fit=crop&q=80',
        descripcion: 'Cafetera eléctrica con bomba de alta presión para espresso y capuchino.'
    },
    {
        nombre: 'Freidora de Aire Digital 4.5L',
        puntos: 250,
        imagen: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=600&auto=format&fit=crop&q=80',
        descripcion: 'Freidora sin aceite con pantalla táctil y 8 programas preestablecidos.'
    },
    {
        nombre: 'Licuadora Profesional 1200W',
        puntos: 180,
        imagen: 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=600&auto=format&fit=crop&q=80',
        descripcion: 'Vaso de vidrio refractario resistente a cambios bruscos de temperatura.'
    },
    {
        nombre: 'Juego de Ollas de Granito Antiadherente',
        puntos: 300,
        imagen: 'https://images.unsplash.com/photo-1583778176476-4a8b02a64c01?w=600&auto=format&fit=crop&q=80',
        descripcion: 'Set de 7 piezas de aluminio forjado con recubrimiento de granito ecológico.'
    }
];

/**
 * Obtiene los puntos disponibles de un usuario/cliente
 */
function obtenerPuntosUsuario(cedulaOId) {
    if (!cedulaOId) return 0;
    const cleanId = String(cedulaOId).trim().toUpperCase();
    const usuario = (AppState.usuarios || []).find(u => (u.cedula || u.id || '').toUpperCase() === cleanId);
    if (usuario) {
        const acumulados = Number(usuario.puntosAcumulados || 0);
        const canjeados = Number(usuario.puntosCanjeados || 0);
        return Math.max(0, acumulados - canjeados);
    }
    return 0;
}

/**
 * Otorga puntos a un usuario/cliente tras una compra completada y pagada
 */
function otorgarPuntosPorCompra(clienteCedulaOId, montoUSD, concepto = 'Compra Contado') {
    if (!clienteCedulaOId || Number(montoUSD) <= 0) return 0;
    const cleanId = String(clienteCedulaOId).trim().toUpperCase();
    
    // Buscar en usuarios
    const usuario = (AppState.usuarios || []).find(u => (u.cedula || u.id || '').toUpperCase() === cleanId);
    const puntosPorDolar = Number(AppState.premioMes?.puntosPorDolar || 1);
    const puntosGanados = Math.floor(Number(montoUSD) * puntosPorDolar);

    if (puntosGanados <= 0) return 0;

    if (usuario) {
        usuario.puntosAcumulados = Number(usuario.puntosAcumulados || 0) + puntosGanados;
    }

    // Persistir
    if (window.InventoryApp.Persistence && typeof window.InventoryApp.Persistence.guardar === 'function') {
        window.InventoryApp.Persistence.guardar(true);
    }

    if (usuario && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarUsuario === 'function') {
        window.InventoryApp.Firebase.guardarUsuario(usuario).catch(e => console.warn('[Puntos] Error sync usuario:', e));
    }

    return puntosGanados;
}

/**
 * Calcula la reputación de un cliente según su historial de compras y deudas
 */
function calcularReputacionCliente(clienteCedulaOId) {
    const cleanId = String(clienteCedulaOId || '').trim();
    const ventasCliente = (AppState.ventas || []).filter(v => v.clienteId === cleanId);
    const abonosCliente = (AppState.abonos || []).filter(a => a.clienteId === cleanId && (a.estado === 'Pago agregado' || !a.estado));
    
    const totalCompradoUSD = ventasCliente.reduce((acc, v) => acc + Number(v.total || 0), 0);
    const totalCreditoUSD = ventasCliente.filter(v => v.tipo === 'Crédito').reduce((acc, v) => acc + Number(v.total || 0), 0);
    const totalAbonadoUSD = abonosCliente.reduce((acc, a) => acc + Number(a.montoUSD || 0), 0);
    const saldoDeuda = totalCreditoUSD - totalAbonadoUSD;

    if (totalCompradoUSD === 0) {
        return {
            nivel: 'Nuevo Cliente',
            estrellas: 5,
            badgeClass: 'badge-reputacion-nuevo',
            descripcion: 'Sin historial previo de crédito.',
            ratioPagado: 100
        };
    }

    const ratioPagado = totalCreditoUSD > 0 
        ? Math.min(100, Math.round((totalAbonadoUSD / totalCreditoUSD) * 100)) 
        : 100;

    if (saldoDeuda <= 0 || ratioPagado >= 95) {
        return {
            nivel: 'Excelente Pagador',
            estrellas: 5,
            badgeClass: 'badge-reputacion-excelente',
            descripcion: '¡Cliente VIP! 100% de facturas al día y sin deuda vencida.',
            ratioPagado: 100
        };
    } else if (ratioPagado >= 60) {
        return {
            nivel: 'Buen Pagador (Puntual)',
            estrellas: 4,
            badgeClass: 'badge-reputacion-bueno',
            descripcion: 'Mantiene abonos constantes y buen comportamiento de pago.',
            ratioPagado
        };
    } else {
        return {
            nivel: 'Regular (Con Deuda Pendiente)',
            estrellas: 3,
            badgeClass: 'badge-reputacion-regular',
            descripcion: 'Posee saldo pendiente por cancelar.',
            ratioPagado
        };
    }
}

/**
 * Guarda la configuración del Premio del Mes desde el formulario de Administrador
 */
function guardarConfiguracionPremioMes(e) {
    if (e && e.preventDefault) e.preventDefault();

    const nombreInput = document.getElementById('premio-nombre');
    const puntosInput = document.getElementById('premio-puntos');
    const puntosPorDolarInput = document.getElementById('premio-pts-dolar');
    const imagenInput = document.getElementById('premio-imagen-url');
    const descInput = document.getElementById('premio-descripcion');

    const nombre = (nombreInput?.value || '').trim();
    const puntos = Number(puntosInput?.value || 200);
    const puntosPorDolar = Number(puntosPorDolarInput?.value || 1);
    const imagen = (imagenInput?.value || '').trim();
    const descripcion = (descInput?.value || '').trim();

    if (!nombre) {
        alert('Por favor ingresa el nombre del Premio del Mes.');
        return;
    }
    if (puntos <= 0) {
        alert('Los puntos requeridos deben ser mayores a 0.');
        return;
    }

    AppState.premioMes = {
        nombre: nombre,
        puntosRequeridos: puntos,
        puntosPorDolar: puntosPorDolar > 0 ? puntosPorDolar : 1,
        imagen: imagen || 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600&auto=format&fit=crop&q=80',
        descripcion: descripcion || 'Premio exclusivo del mes para nuestros clientes más fieles.'
    };

    if (window.InventoryApp.Persistence && typeof window.InventoryApp.Persistence.guardar === 'function') {
        window.InventoryApp.Persistence.guardar(true);
    }

    alert('¡Configuración del Premio del Mes actualizada exitosamente!');
    renderizarConfiguradorPremioAdmin();
    renderizarPremioMesCliente();
}

/**
 * Aplica un preset rápido al configurador del Administrador
 */
function aplicarPresetPremio(idx) {
    const preset = PRESETS_PREMIOS[idx];
    if (!preset) return;

    const nombreInput = document.getElementById('premio-nombre');
    const puntosInput = document.getElementById('premio-puntos');
    const imagenInput = document.getElementById('premio-imagen-url');
    const descInput = document.getElementById('premio-descripcion');

    if (nombreInput) nombreInput.value = preset.nombre;
    if (puntosInput) puntosInput.value = preset.puntos;
    if (imagenInput) imagenInput.value = preset.imagen;
    if (descInput) descInput.value = preset.descripcion;

    actualizarPreviewPremioAdmin();
}

/**
 * Actualiza la vista previa del Premio en el configurador Admin
 */
function actualizarPreviewPremioAdmin() {
    const nombre = document.getElementById('premio-nombre')?.value || 'Premio del Mes';
    const puntos = document.getElementById('premio-puntos')?.value || '200';
    const imagen = document.getElementById('premio-imagen-url')?.value || 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600&auto=format&fit=crop&q=80';
    const desc = document.getElementById('premio-descripcion')?.value || 'Canjea tus puntos acumulados por este premio exclusivo.';

    const imgEl = document.getElementById('preview-premio-img');
    const tituloEl = document.getElementById('preview-premio-titulo');
    const puntosEl = document.getElementById('preview-premio-puntos');
    const descEl = document.getElementById('preview-premio-desc');

    if (imgEl) imgEl.src = imagen;
    if (tituloEl) tituloEl.textContent = nombre;
    if (puntosEl) puntosEl.textContent = `${puntos} Puntos Requeridos`;
    if (descEl) descEl.textContent = desc;
}

/**
 * Renderiza el panel de configuración del Administrador
 */
function renderizarConfiguradorPremioAdmin() {
    const pm = AppState.premioMes || {
        nombre: 'Cafetera Espresso Digital 1.5L',
        puntosRequeridos: 200,
        puntosPorDolar: 1,
        imagen: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600&auto=format&fit=crop&q=80',
        descripcion: 'Premio exclusivo del mes para nuestros clientes más fieles.'
    };

    const nombreInput = document.getElementById('premio-nombre');
    const puntosInput = document.getElementById('premio-puntos');
    const ptsDolarInput = document.getElementById('premio-pts-dolar');
    const imagenInput = document.getElementById('premio-imagen-url');
    const descInput = document.getElementById('premio-descripcion');

    if (nombreInput) nombreInput.value = pm.nombre || '';
    if (puntosInput) puntosInput.value = pm.puntosRequeridos || 200;
    if (ptsDolarInput) ptsDolarInput.value = pm.puntosPorDolar || 1;
    if (imagenInput) imagenInput.value = pm.imagen || '';
    if (descInput) descInput.value = pm.descripcion || '';

    // Renderizar presets
    const presetsContainer = document.getElementById('premio-presets-container');
    if (presetsContainer) {
        presetsContainer.innerHTML = PRESETS_PREMIOS.map((p, idx) => `
            <div class="premio-preset-card" onclick="aplicarPresetPremio(${idx})" title="Seleccionar este premio sugerido">
                <img src="${p.imagen}" alt="${p.nombre}" class="premio-preset-thumb">
                <div class="premio-preset-info">
                    <strong>${p.nombre}</strong>
                    <span class="badge-status-pill badge-warning">${p.puntos} Pts</span>
                </div>
            </div>
        `).join('');
    }

    actualizarPreviewPremioAdmin();
    renderizarTablaCanjesAdmin();
}

/**
 * Renderiza la tabla de canjes históricos en el panel Admin
 */
function renderizarTablaCanjesAdmin() {
    const tbody = document.getElementById('canjes-admin-body');
    if (!tbody) return;

    const canjes = AppState.canjesPremios || [];
    if (canjes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:16px;">Aún no se han registrado canjes de premios.</td></tr>`;
        return;
    }

    tbody.innerHTML = canjes.map(c => `
        <tr>
            <td><strong>#${c.id}</strong></td>
            <td>${c.clienteCedula} - ${c.clienteNombre}</td>
            <td><strong>${c.premioNombre}</strong></td>
            <td class="num" style="color:var(--primary-accent); font-weight:700;">${c.puntos} pts</td>
            <td>${c.fecha}</td>
            <td><span class="badge-status badge-active"><i class="fas fa-check"></i> ${c.estado || 'ENTREGADO'}</span></td>
        </tr>
    `).join('');
}

/**
 * Renderiza la tarjeta de Gamificación y Premio del Mes para el Cliente
 */
function renderizarPremioMesCliente() {
    const usuario = AppState.usuarioActual;
    if (!usuario) return;

    const pm = AppState.premioMes || {
        nombre: 'Cafetera Espresso Digital 1.5L',
        puntosRequeridos: 200,
        puntosPorDolar: 1,
        imagen: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600&auto=format&fit=crop&q=80',
        descripcion: 'Premio exclusivo del mes para nuestros clientes más fieles.'
    };

    const cedula = usuario.cedula || usuario.id;
    const puntosDisponibles = obtenerPuntosUsuario(cedula);
    const puntosRequeridos = Number(pm.puntosRequeridos || 200);
    const porcentaje = Math.min(100, Math.round((puntosDisponibles / puntosRequeridos) * 100));
    const puntosFaltantes = Math.max(0, puntosRequeridos - puntosDisponibles);
    const puedeCanjear = puntosDisponibles >= puntosRequeridos;

    // Reputación
    const reputacion = calcularReputacionCliente(cedula);

    // Actualizar elementos en DOM
    const userPuntosEl = document.getElementById('cli-puntos-disponibles');
    const userPtsTotalEl = document.getElementById('cli-puntos-acumulados-total');
    const userPtsCanjeadosEl = document.getElementById('cli-puntos-canjeados-total');
    const repNivelEl = document.getElementById('cli-rep-nivel');
    const repDescEl = document.getElementById('cli-rep-desc');
    const repBadgeEl = document.getElementById('cli-rep-badge');

    if (userPuntosEl) userPuntosEl.textContent = puntosDisponibles;
    if (userPtsTotalEl) userPtsTotalEl.textContent = Number(usuario.puntosAcumulados || 0);
    if (userPtsCanjeadosEl) userPtsCanjeadosEl.textContent = Number(usuario.puntosCanjeados || 0);

    if (repNivelEl) repNivelEl.textContent = reputacion.nivel;
    if (repDescEl) repDescEl.textContent = reputacion.descripcion;
    if (repBadgeEl) {
        repBadgeEl.className = `reputacion-stars-pill ${reputacion.badgeClass}`;
        repBadgeEl.innerHTML = `⭐`.repeat(reputacion.estrellas) + ` <span>${reputacion.nivel}</span>`;
    }

    // Premio del mes
    const cardPremioImg = document.getElementById('cli-premio-img');
    const cardPremioTitulo = document.getElementById('cli-premio-titulo');
    const cardPremioDesc = document.getElementById('cli-premio-desc');
    const cardPremioReq = document.getElementById('cli-premio-pts-req');
    const cardProgresoBar = document.getElementById('cli-premio-progress-fill');
    const cardProgresoTxt = document.getElementById('cli-premio-progress-txt');
    const cardFaltanTxt = document.getElementById('cli-premio-faltan-txt');
    const btnCanjear = document.getElementById('btn-canjear-premio');

    if (cardPremioImg) cardPremioImg.src = pm.imagen;
    if (cardPremioTitulo) cardPremioTitulo.textContent = pm.nombre;
    if (cardPremioDesc) cardPremioDesc.textContent = pm.descripcion;
    if (cardPremioReq) cardPremioReq.textContent = `${puntosRequeridos} Pts`;

    if (cardProgresoBar) {
        cardProgresoBar.style.width = `${porcentaje}%`;
    }
    if (cardProgresoTxt) {
        cardProgresoTxt.textContent = `${puntosDisponibles} / ${puntosRequeridos} Pts (${porcentaje}%)`;
    }
    if (cardFaltanTxt) {
        if (puedeCanjear) {
            cardFaltanTxt.innerHTML = `<span style="color:#16a34a; font-weight:700;"><i class="fas fa-circle-check"></i> ¡Felicidades! Has alcanzado los puntos para canjear tu premio.</span>`;
        } else {
            cardFaltanTxt.innerHTML = `<span>Te faltan <strong>${puntosFaltantes} puntos</strong> para alcanzar este premio. ¡Continúa acumulando con tus compras!</span>`;
        }
    }

    if (btnCanjear) {
        if (puedeCanjear) {
            btnCanjear.removeAttribute('disabled');
            btnCanjear.className = 'btn btn-success btn-canjear-glow';
            btnCanjear.innerHTML = `<i class="fas fa-gift"></i> ¡Canjear ${pm.nombre}!`;
        } else {
            btnCanjear.setAttribute('disabled', 'true');
            btnCanjear.className = 'btn btn-secondary';
            btnCanjear.innerHTML = `<i class="fas fa-lock"></i> Faltan ${puntosFaltantes} pts para canjear`;
        }
    }

    // Historial de canjes del cliente
    renderizarHistorialCanjesCliente(cedula);
}

/**
 * Canjea el premio del mes para el cliente activo
 */
function canjearPremioMesCliente() {
    const usuario = AppState.usuarioActual;
    if (!usuario) {
        alert('Debes iniciar sesión para canjear tu premio.');
        return;
    }

    const pm = AppState.premioMes;
    const cedula = usuario.cedula || usuario.id;
    const puntosDisponibles = obtenerPuntosUsuario(cedula);
    const puntosReq = Number(pm?.puntosRequeridos || 200);

    if (puntosDisponibles < puntosReq) {
        alert(`Puntos insuficientes. Tienes ${puntosDisponibles} pts y se requieren ${puntosReq} pts.`);
        return;
    }

    if (!confirm(`¿Confirmas el canje de ${puntosReq} puntos por el premio "${pm.nombre}"?`)) {
        return;
    }

    // Descontar puntos
    usuario.puntosCanjeados = Number(usuario.puntosCanjeados || 0) + puntosReq;

    if (!Array.isArray(AppState.canjesPremios)) {
        AppState.canjesPremios = [];
    }

    const nuevoCanje = {
        id: 'CANJE-' + Date.now().toString().slice(-6),
        clienteCedula: cedula,
        clienteNombre: usuario.nombre,
        premioNombre: pm.nombre,
        puntos: puntosReq,
        fecha: new Date().toISOString().replace('T', ' ').substring(0, 16),
        estado: 'ENTREGADO'
    };

    AppState.canjesPremios.push(nuevoCanje);

    // Persistir
    if (window.InventoryApp.Persistence && typeof window.InventoryApp.Persistence.guardar === 'function') {
        window.InventoryApp.Persistence.guardar(true);
    }
    if (window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarUsuario === 'function') {
        window.InventoryApp.Firebase.guardarUsuario(usuario).catch(e => console.warn(e));
    }

    alert(`🎉 ¡FELICITACIONES ${usuario.nombre}! Has canjeado con éxito tu "${pm.nombre}". Presenta tu comprobante #${nuevoCanje.id} en caja.`);

    renderizarPremioMesCliente();
}

/**
 * Renderiza el historial de canjes del cliente
 */
function renderizarHistorialCanjesCliente(cedula) {
    const container = document.getElementById('cli-canjes-historial-list');
    if (!container) return;

    const misCanjes = (AppState.canjesPremios || []).filter(c => String(c.clienteCedula).trim().toUpperCase() === String(cedula).trim().toUpperCase());

    if (misCanjes.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:16px; color:var(--text-muted); font-size:0.85rem;">
                Aún no has realizado canjes de premios. ¡Tus puntos acumulados se guardan automáticamente!
            </div>
        `;
        return;
    }

    container.innerHTML = misCanjes.map(c => `
        <div class="canje-item-card">
            <div class="canje-item-icon"><i class="fas fa-gift"></i></div>
            <div class="canje-item-info">
                <strong>${c.premioNombre}</strong>
                <small style="color:var(--text-muted);">${c.fecha} • Código: #${c.id}</small>
            </div>
            <div class="canje-item-pts">
                <span class="badge-status badge-active"><i class="fas fa-check"></i> ${c.puntos} Pts Canjeados</span>
            </div>
        </div>
    `).join('');
}

// Exportar funciones globales
window.guardarConfiguracionPremioMes = guardarConfiguracionPremioMes;
window.aplicarPresetPremio = aplicarPresetPremio;
window.actualizarPreviewPremioAdmin = actualizarPreviewPremioAdmin;
window.renderizarConfiguradorPremioAdmin = renderizarConfiguradorPremioAdmin;
window.renderizarPremioMesCliente = renderizarPremioMesCliente;
window.canjearPremioMesCliente = canjearPremioMesCliente;
window.obtenerPuntosUsuario = obtenerPuntosUsuario;
window.otorgarPuntosPorCompra = otorgarPuntosPorCompra;
window.calcularReputacionCliente = calcularReputacionCliente;
