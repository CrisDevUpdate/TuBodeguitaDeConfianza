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

    // Si la temporada está inactiva (Temporada de Invierno / Descanso), no se acumulan puntos
    if (AppState.temporadaInviernoActiva || (AppState.premioMes && AppState.premioMes.temporadaActiva === false)) {
        console.log('[Puntos] Temporada de invierno activa: acumulación pausada.');
        return 0;
    }

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

    const nombreInput = document.getElementById('premio-nombre') || document.getElementById('premio-admin-titulo');
    const puntosInput = document.getElementById('premio-puntos') || document.getElementById('premio-admin-puntos');
    const puntosPorDolarInput = document.getElementById('premio-pts-dolar') || document.getElementById('premio-admin-pts-dolar');
    const imagenInput = document.getElementById('premio-imagen-url') || document.getElementById('premio-admin-img');
    const descInput = document.getElementById('premio-descripcion') || document.getElementById('premio-admin-desc');
    const mesInput = document.getElementById('premio-admin-mes');
    const temporadaInput = document.getElementById('premio-temporada-activa');

    const nombre = (nombreInput?.value || '').trim();
    const puntos = Number(puntosInput?.value || 200);
    const puntosPorDolar = Number(puntosPorDolarInput?.value || 1);
    const imagen = (imagenInput?.value || '').trim();
    const descripcion = (descInput?.value || '').trim();
    const mes = (mesInput?.value || '').trim();
    const temporadaActiva = temporadaInput ? temporadaInput.checked : (AppState.premioMes?.temporadaActiva !== false);

    if (!nombre) {
        if (window.InventoryApp.Modal?.alert) {
            window.InventoryApp.Modal.alert('Campo Requerido', 'Por favor ingresa el nombre del Premio del Mes.');
        } else {
            alert('Por favor ingresa el nombre del Premio del Mes.');
        }
        return;
    }
    if (puntos <= 0) {
        if (window.InventoryApp.Modal?.alert) {
            window.InventoryApp.Modal.alert('Valor Inválido', 'Los puntos requeridos deben ser mayores a 0.');
        } else {
            alert('Los puntos requeridos deben ser mayores a 0.');
        }
        return;
    }

    AppState.premioMes = {
        nombre: nombre,
        puntosRequeridos: puntos,
        puntosPorDolar: puntosPorDolar > 0 ? puntosPorDolar : 1,
        imagen: imagen || 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600&auto=format&fit=crop&q=80',
        descripcion: descripcion || 'Premio exclusivo del mes para nuestros clientes más fieles.',
        mes: mes || 'Mes en Curso',
        temporadaActiva: temporadaActiva
    };

    if (window.InventoryApp.Persistence && typeof window.InventoryApp.Persistence.guardar === 'function') {
        window.InventoryApp.Persistence.guardar(true);
    }

    if (window.InventoryApp.Modal?.alert) {
        window.InventoryApp.Modal.alert(
            'Temporada Actualizada',
            `¡La configuración del Premio del Mes "${nombre}" (${puntos} pts) ha sido guardada exitosamente!\n\nEstado de Temporada: ${temporadaActiva ? '🟢 ACTIVA (Puntos Habilitados)' : '❄️ INVIERNO (En Pausa)'}`
        );
    } else {
        alert('¡Configuración del Premio del Mes actualizada exitosamente!');
    }

    renderizarConfiguradorPremioAdmin();
    renderizarPremioMesCliente();
}

window.guardarConfiguracionPremio = guardarConfiguracionPremioMes;

/**
 * Anuncia la Nueva Temporada de Premios por WhatsApp
 */
function anunciarTemporadaWhatsApp() {
    const pm = AppState.premioMes || { nombre: 'Premio del Mes', puntosRequeridos: 200, puntosPorDolar: 1 };
    const texto = 
        `🌟 *¡NUEVA TEMPORADA DE PREMIOS EN TU BODEGUITA DE CONFIANZA!* 🌟\n\n` +
        `🎁 *Gran Premio del Mes:* ${pm.nombre}\n` +
        `🎯 *Meta de Puntos:* ${pm.puntosRequeridos} pts\n` +
        `⭐ *Puntos por cada $1 de compra:* ${pm.puntosPorDolar || 1} pts\n\n` +
        `🛒 ¡Visita nuestro catálogo online, acumula puntos con cada compra y haz crecer tu Árbol de Fidelidad hasta la Cosecha Dorada!\n\n` +
        `_Tu Bodeguita de Confianza - Calidad y cercanía para tu hogar._`;

    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
}
window.anunciarTemporadaWhatsApp = anunciarTemporadaWhatsApp;

/**
 * Aplica un preset rápido al configurador del Administrador
 */
function aplicarPresetPremio(idx) {
    const preset = PRESETS_PREMIOS[idx];
    if (!preset) return;

    const nombreInput = document.getElementById('premio-nombre') || document.getElementById('premio-admin-titulo');
    const puntosInput = document.getElementById('premio-puntos') || document.getElementById('premio-admin-puntos');
    const imagenInput = document.getElementById('premio-imagen-url') || document.getElementById('premio-admin-img');
    const descInput = document.getElementById('premio-descripcion') || document.getElementById('premio-admin-desc');

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
    const nombre = document.getElementById('premio-nombre')?.value || document.getElementById('premio-admin-titulo')?.value || 'Premio del Mes';
    const puntos = document.getElementById('premio-puntos')?.value || document.getElementById('premio-admin-puntos')?.value || '200';
    const imagen = document.getElementById('premio-imagen-url')?.value || document.getElementById('premio-admin-img')?.value || 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600&auto=format&fit=crop&q=80';
    const desc = document.getElementById('premio-descripcion')?.value || document.getElementById('premio-admin-desc')?.value || 'Canjea tus puntos acumulados por este premio exclusivo.';

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
        descripcion: 'Premio exclusivo del mes para nuestros clientes más fieles.',
        temporadaActiva: true
    };

    const nombreInput = document.getElementById('premio-nombre') || document.getElementById('premio-admin-titulo');
    const puntosInput = document.getElementById('premio-puntos') || document.getElementById('premio-admin-puntos');
    const ptsDolarInput = document.getElementById('premio-pts-dolar') || document.getElementById('premio-admin-pts-dolar');
    const imagenInput = document.getElementById('premio-imagen-url') || document.getElementById('premio-admin-img');
    const descInput = document.getElementById('premio-descripcion') || document.getElementById('premio-admin-desc');
    const mesInput = document.getElementById('premio-admin-mes');
    const temporadaInput = document.getElementById('premio-temporada-activa');

    if (nombreInput) nombreInput.value = pm.nombre || '';
    if (puntosInput) puntosInput.value = pm.puntosRequeridos || 200;
    if (ptsDolarInput) ptsDolarInput.value = pm.puntosPorDolar || 1;
    if (imagenInput) imagenInput.value = pm.imagen || '';
    if (descInput) descInput.value = pm.descripcion || '';
    if (mesInput) mesInput.value = pm.mes || '';
    if (temporadaInput) temporadaInput.checked = pm.temporadaActiva !== false;

    // Renderizar presets
    const presetsContainer = document.getElementById('premio-presets-container') || document.getElementById('premio-admin-presets');
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
 * Confirma a un Ganador de Premio (Admin):
 * 1. Marca el canje como ENTREGADO
 * 2. Descuenta los puntos canjeados del cliente y avanza su ciclo a nivel + 1 (reseteando el árbol al brote)
 * 3. Abre un modal con el botón interactivo para notificar al ganador por WhatsApp con el mensaje estructurado
 */
async function confirmarGanadorPremio(canjeId) {
    const canjes = AppState.canjesPremios || [];
    const canje = canjes.find(c => String(c.id) === String(canjeId));
    if (!canje) return;

    const confirmar = await (window.InventoryApp.Modal?.confirm
        ? window.InventoryApp.Modal.confirm(
            'Confirmar Ganador y Entrega de Premio',
            `¿Deseas confirmar la entrega del premio "${canje.premioNombre}" para el cliente ${canje.clienteNombre}?\n\nEsta acción registrará la entrega, descontará ${canje.puntos} pts y reiniciará su Árbol de Fidelidad al Brote Inicial en el nuevo ciclo.`
          )
        : confirm(`¿Confirmar entrega de premio "${canje.premioNombre}" para ${canje.clienteNombre}?`));

    if (!confirmar) return;

    // Actualizar estado del canje
    canje.estado = 'ENTREGADO';
    canje.fechaEntrega = new Date().toISOString().replace('T', ' ').substring(0, 16);

    // Buscar cliente y actualizar ciclo & puntos
    let cliente = (AppState.usuarios || []).find(u => 
        String(u.cedula || u.id).trim().toUpperCase() === String(canje.clienteCedula).trim().toUpperCase()
    );

    let nuevoCiclo = 2;
    if (cliente) {
        cliente.puntosCanjeados = Number(cliente.puntosCanjeados || 0) + Number(canje.puntos || 0);
        cliente.cicloGamificacion = (Number(cliente.cicloGamificacion) || 1) + 1;
        nuevoCiclo = cliente.cicloGamificacion;
        canje.cicloCompletado = nuevoCiclo - 1;
    }

    // Persistir cambios
    if (window.InventoryApp.Persistence) window.InventoryApp.Persistence.guardar(true);
    if (window.InventoryApp.Firebase && cliente && typeof window.InventoryApp.Firebase.guardarUsuario === 'function') {
        window.InventoryApp.Firebase.guardarUsuario(cliente).catch(e => console.warn(e));
    }

    // Preparar mensaje de WhatsApp para el Ganador
    const telClienteLimpio = (cliente?.telefono || canje.clienteTelefono || '').replace(/\D/g, '');
    let telDestino = telClienteLimpio;
    if (telDestino.startsWith('0')) {
        telDestino = '58' + telDestino.substring(1);
    } else if (telDestino && !telDestino.startsWith('58') && telDestino.length === 10) {
        telDestino = '58' + telDestino;
    }

    const msgGanador = 
        `🏆 *¡FELICITACIONES, ${canje.clienteNombre}! TU PREMIO HA SIDO CONFIRMADO* 🏆\n\n` +
        `🎉 En *Tu Bodeguita de Confianza* celebramos tu lealtad y compromiso.\n\n` +
        `🎁 *Premio Entregado:* ${canje.premioNombre}\n` +
        `⭐ *Puntos Canjeados:* ${canje.puntos} pts\n` +
        `🌱 *Tu Árbol de Crecimiento:* Ha liberado con éxito su semilla y germinado un nuevo brote para el *Ciclo #${nuevoCiclo}*.\n\n` +
        `¡Pasa a retirar tu premio por la tienda y sigue acumulando puntos en tus próximas compras! 🛒✨`;

    const waLink = telDestino 
        ? `https://wa.me/${telDestino}?text=${encodeURIComponent(msgGanador)}`
        : `https://wa.me/?text=${encodeURIComponent(msgGanador)}`;

    // Mostrar modal con felicitación y botón de WhatsApp
    if (window.InventoryApp.Modal?.show) {
        const bodyContent = document.createElement('div');
        bodyContent.innerHTML = `
            <div style="text-align:center; padding:10px 0;">
                <div style="font-size:3.2rem; margin-bottom:10px;">🏆🎉</div>
                <h3 style="margin:0 0 6px 0; color:#15803d;">¡Ganador Confirmado con Éxito!</h3>
                <p style="margin:0 0 16px 0; color:var(--text-muted); font-size:0.9rem;">
                    Se ha registrado la entrega de <strong>"${canje.premioNombre}"</strong> para <strong>${canje.clienteNombre}</strong>.
                    El árbol de fidelidad del cliente ha comenzado el <strong>Ciclo #${nuevoCiclo}</strong>.
                </p>
                <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:12px; margin-bottom:18px; text-align:left; font-size:0.85rem; color:#166534;">
                    <div><i class="fas fa-check-circle"></i> Puntos descontados: <strong>${canje.puntos} pts</strong></div>
                    <div><i class="fas fa-seedling"></i> Nuevo ciclo activo: <strong>Ciclo #${nuevoCiclo}</strong> (Brote inicial)</div>
                    <div><i class="fas fa-phone"></i> Teléfono: <strong>${telClienteLimpio || 'No registrado'}</strong></div>
                </div>
                <a href="${waLink}" target="_blank" class="btn btn-success btn-block" style="padding:12px 20px; font-weight:700; font-size:0.95rem; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; gap:8px;">
                    <i class="fab fa-whatsapp" style="font-size:1.2rem;"></i> Notificar al Ganador por WhatsApp
                </a>
            </div>
        `;
        window.InventoryApp.Modal.show({
            title: 'Premio Entregado',
            body: bodyContent,
            buttons: [
                {
                    label: 'Cerrar',
                    variant: 'outline',
                    action: (m) => m.close()
                }
            ]
        });
    } else {
        alert(`🏆 ¡Ganador Confirmado!\n\nCliente: ${canje.clienteNombre}\nPremio: ${canje.premioNombre}\nNuevo Ciclo: #${nuevoCiclo}`);
        window.open(waLink, '_blank');
    }

    renderizarTablaCanjesAdmin();
    if (typeof renderizarPremioMesCliente === 'function') renderizarPremioMesCliente();
}
window.confirmarGanadorPremio = confirmarGanadorPremio;

/**
 * Renderiza la tabla de canjes históricos en el panel Admin
 */
function renderizarTablaCanjesAdmin() {
    const tbody = document.getElementById('canjes-admin-body') || document.getElementById('premio-admin-historial-canjes');
    if (!tbody) return;

    const canjes = AppState.canjesPremios || [];
    if (canjes.length === 0) {
        tbody.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:16px;">Aún no se han registrado canjes de premios.</p>`;
        return;
    }

    tbody.innerHTML = `
        <div class="table-responsive">
            <table>
                <thead>
                    <tr>
                        <th>ID Canje</th>
                        <th>Cliente</th>
                        <th>Premio</th>
                        <th class="num">Puntos</th>
                        <th>Fecha</th>
                        <th>Estado</th>
                        <th style="text-align:center;">Acción</th>
                    </tr>
                </thead>
                <tbody>
                    ${canjes.map(c => {
                        const esPendiente = c.estado === 'PENDIENTE_CONFIRMACION';
                        return `
                            <tr>
                                <td><strong>#${c.id}</strong></td>
                                <td>
                                    <strong>${c.clienteNombre}</strong><br>
                                    <small style="color:var(--text-muted);">${c.clienteCedula} · ${c.clienteTelefono || 'Sin tel'}</small>
                                </td>
                                <td><strong>${c.premioNombre}</strong></td>
                                <td class="num" style="color:var(--primary-accent); font-weight:700;">${c.puntos} pts</td>
                                <td><small>${c.fecha}</small></td>
                                <td>
                                    ${esPendiente ? `
                                        <span class="badge-status-pill badge-warning" style="background:#fef3c7; color:#b45309; padding:4px 8px; border-radius:12px; font-weight:700; font-size:0.75rem; display:inline-flex; align-items:center; gap:4px;">
                                            <i class="fas fa-clock fa-spin"></i> Pendiente Entrega
                                        </span>
                                    ` : `
                                        <span class="badge-status badge-active" style="background:#dcfce7; color:#15803d; padding:4px 8px; border-radius:12px; font-weight:700; font-size:0.75rem; display:inline-flex; align-items:center; gap:4px;">
                                            <i class="fas fa-check-circle"></i> Entregado (Ciclo #${c.cicloCompletado || 1})
                                        </span>
                                    `}
                                </td>
                                <td style="text-align:center;">
                                    ${esPendiente ? `
                                        <button type="button" class="btn btn-sm btn-success" onclick="confirmarGanadorPremio('${c.id}')" style="font-weight:700; padding:4px 10px; font-size:0.78rem;">
                                            <i class="fas fa-crown"></i> Confirmar Ganador
                                        </button>
                                    ` : `
                                        <button type="button" class="btn btn-sm btn-outline" onclick="confirmarGanadorPremio('${c.id}')" title="Reenviar mensaje WhatsApp al cliente" style="padding:4px 8px; font-size:0.75rem;">
                                            <i class="fab fa-whatsapp"></i> Notificar
                                        </button>
                                    `}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * Renderiza la tarjeta de Gamificación y Premio del Mes para el Cliente
 */
async function renderizarPremioMesCliente() {
    const container = document.getElementById('cliente-premio-mes-container');
    const usuario = AppState.usuarioActual;
    if (!container || !usuario) return;

    const cedula = usuario.cedula || usuario.id;

    // Sincronización asíncrona con el endpoint de fidelidad backend
    try {
        const resp = await fetch(`/api/loyalty/points?userId=${encodeURIComponent(cedula)}`);
        if (resp.ok) {
            const data = await resp.json();
            console.log('[API Loyalty Points] Sincronizado:', data);
        }
    } catch (e) {
        // Fallback local
    }

    const pm = AppState.premioMes || {
        nombre: 'Cafetera Espresso Digital 1.5L',
        puntosRequeridos: 200,
        puntosPorDolar: 1,
        imagen: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600&auto=format&fit=crop&q=80',
        descripcion: 'Premio exclusivo del mes para nuestros clientes más fieles.'
    };

    const puntosDisponibles = obtenerPuntosUsuario(cedula);
    const puntosRequeridos = Number(pm.puntosRequeridos || 200);
    const porcentaje = Math.min(100, Math.round((puntosDisponibles / puntosRequeridos) * 100));
    const puntosFaltantes = Math.max(0, puntosRequeridos - puntosDisponibles);
    const puedeCanjear = puntosDisponibles >= puntosRequeridos;
    const reputacion = calcularReputacionCliente(cedula);
    const ciclo = usuario.cicloGamificacion || 1;

    container.innerHTML = `
        <!-- Widget Árbol de la Fidelización (Gamificación Reactiva) -->
        <div id="tree-gamification-root" style="margin-bottom:24px;"></div>

        <!-- Grid de Información de Fidelidad y Premio del Mes -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:20px; margin-bottom:24px;">
            <!-- Tarjeta de Puntos & Reputación -->
            <div class="card" style="display:flex; flex-direction:column; justify-content:space-between;">
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                        <h3 style="margin:0; font-size:1.15rem; display:flex; align-items:center; gap:8px;">
                            <i class="fas fa-star" style="color:#f59e0b;"></i> Mi Saldo de Puntos
                        </h3>
                        <span class="reputacion-stars-pill ${reputacion.badgeClass}">
                            ⭐ ${reputacion.nivel}
                        </span>
                    </div>

                    <div style="background:linear-gradient(135deg, #1e293b, #0f172a); color:#ffffff; border-radius:14px; padding:20px; text-align:center; margin-bottom:16px; box-shadow:0 4px 12px rgba(0,0,0,0.15);">
                        <span style="font-size:0.8rem; text-transform:uppercase; color:#94a3b8; letter-spacing:0.5px; display:block;">Puntos Disponibles para Canje</span>
                        <div style="font-size:2.6rem; font-weight:800; color:#fde047; margin:6px 0;" id="cli-puntos-disponibles">${puntosDisponibles}</div>
                        <span style="font-size:0.85rem; color:#cbd5e1;">Puntos Acumulados</span>
                    </div>

                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
                        <div style="background:#f8fafc; border:1px solid var(--border); border-radius:10px; padding:12px; text-align:center;">
                            <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Total Histórico</span>
                            <strong style="font-size:1.1rem; color:var(--text-main);" id="cli-puntos-acumulados-total">${Number(usuario.puntosAcumulados || 0)}</strong>
                        </div>
                        <div style="background:#f8fafc; border:1px solid var(--border); border-radius:10px; padding:12px; text-align:center;">
                            <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Puntos Canjeados</span>
                            <strong style="font-size:1.1rem; color:var(--text-main);" id="cli-puntos-canjeados-total">${Number(usuario.puntosCanjeados || 0)}</strong>
                        </div>
                    </div>
                </div>

                <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:12px; font-size:0.85rem; color:#166534;">
                    <i class="fas fa-circle-info"></i> <strong>¿Cómo ganar más puntos?</strong><br>
                    Por cada $1.00 en compras acumulas 1 punto. Los productos en oferta pueden otorgarte hasta +5 puntos adicionales.
                </div>
            </div>

            <!-- Tarjeta Premio del Mes -->
            <div class="card" style="display:flex; flex-direction:column; justify-content:space-between;">
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <h3 style="margin:0; font-size:1.15rem; display:flex; align-items:center; gap:8px;">
                            <i class="fas fa-gift" style="color:var(--primary-accent);"></i> Premio del Mes
                        </h3>
                        <span class="badge" style="background:#fef3c7; color:#d97706; font-weight:700;">Meta: ${puntosRequeridos} pts</span>
                    </div>

                    <div style="position:relative; border-radius:12px; overflow:hidden; height:170px; margin-bottom:14px; background:#f1f5f9;">
                        <img src="${pm.imagen}" alt="${pm.nombre}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600&auto=format&fit=crop&q=80'">
                        <div style="position:absolute; bottom:0; left:0; right:0; background:linear-gradient(to top, rgba(0,0,0,0.8), transparent); padding:10px 14px; color:#ffffff;">
                            <h4 style="margin:0; font-size:1.05rem; color:#ffffff;">${pm.nombre}</h4>
                        </div>
                    </div>

                    <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:14px; line-height:1.4;">${pm.descripcion}</p>

                    <!-- Barra de Progreso -->
                    <div style="margin-bottom:16px;">
                        <div style="display:flex; justify-content:space-between; font-size:0.82rem; font-weight:700; margin-bottom:6px;">
                            <span>Progreso hacia el premio</span>
                            <span style="color:var(--primary-accent);">${puntosDisponibles} / ${puntosRequeridos} Pts (${porcentaje}%)</span>
                        </div>
                        <div style="height:10px; background:#e2e8f0; border-radius:10px; overflow:hidden;">
                            <div style="height:100%; width:${porcentaje}%; background:linear-gradient(90deg, #10b981, #059669); border-radius:10px; transition:width 0.5s ease;"></div>
                        </div>
                        <small style="display:block; margin-top:6px; font-size:0.78rem; color:${puedeCanjear ? '#16a34a' : 'var(--text-muted)'}; font-weight:${puedeCanjear ? '700' : 'normal'};">
                            ${puedeCanjear ? '🎉 ¡Felicidades! Tienes puntos suficientes para canjear este premio.' : `Te faltan ${puntosFaltantes} puntos para desbloquear este premio.`}
                        </small>
                    </div>
                </div>

                <div>
                    <button type="button" id="btn-canjear-premio" class="btn btn-block ${puedeCanjear ? 'btn-success btn-canjear-glow' : 'btn-secondary'}" 
                        onclick="canjearPremioMesCliente()" ${puedeCanjear ? '' : 'disabled'}
                        style="padding:12px; font-weight:700; font-size:0.95rem;">
                        <i class="fas ${puedeCanjear ? 'fa-gift' : 'fa-lock'}"></i> ${puedeCanjear ? `¡Canjear ${pm.nombre}!` : `Faltan ${puntosFaltantes} pts para canjear`}
                    </button>
                </div>
            </div>
        </div>

        <!-- Historial de Canjes de Premios -->
        <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                <h3 style="margin:0; font-size:1.15rem; display:flex; align-items:center; gap:8px;">
                    <i class="fas fa-clock-rotate-left" style="color:var(--primary-accent);"></i> Mis Premios Canjeados
                </h3>
            </div>

            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>ID Canje</th>
                            <th>Premio</th>
                            <th class="num">Puntos Usados</th>
                            <th>Fecha</th>
                            <th style="text-align:center;">Estado</th>
                        </tr>
                    </thead>
                    <tbody id="cli-historial-canjes-body"></tbody>
                </table>
            </div>
        </div>
    `;

    // Renderizar widget de árbol
    if (window.InventoryApp && window.InventoryApp.TreeGamification && typeof window.InventoryApp.TreeGamification.render === 'function') {
        window.InventoryApp.TreeGamification.render(puntosDisponibles, puntosRequeridos, pm, ciclo, 'tree-gamification-root');
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
