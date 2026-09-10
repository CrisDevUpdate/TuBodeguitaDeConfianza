/**
 * modules/premio-mes.js
 * Módulo de Fidelización & Gamificación: Premio del Mes, Acumulación de Puntos y Canjes
 * Cohesivo con el Sistema POS y Catálogo de Inventario Multimoneda.
 */

window.InventoryApp = window.InventoryApp || {};

// Presets de imágenes y metas financieras de premios populares
const PRESETS_PREMIOS = [
    {
        nombre: 'Cafetera Espresso Digital 1.5L',
        puntos: 600,
        costo: 40.00,
        gananciaMeta: 60.00,
        factor: 10,
        imagen: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600&auto=format&fit=crop&q=80',
        descripcion: 'Cafetera eléctrica con bomba de alta presión para espresso y capuchino. Desafío acumulativo hasta tener ganador.'
    },
    {
        nombre: 'Freidora de Aire Digital 4.5L',
        puntos: 900,
        costo: 60.00,
        gananciaMeta: 90.00,
        factor: 10,
        imagen: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=600&auto=format&fit=crop&q=80',
        descripcion: 'Freidora sin aceite con pantalla táctil y 8 programas. Desafío acumulativo hasta tener ganador.'
    },
    {
        nombre: 'Licuadora Profesional 1200W',
        puntos: 400,
        costo: 25.00,
        gananciaMeta: 40.00,
        factor: 10,
        imagen: 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=600&auto=format&fit=crop&q=80',
        descripcion: 'Vaso de vidrio refractario resistente a cambios bruscos de temperatura. Desafío acumulativo hasta tener ganador.'
    },
    {
        nombre: 'Juego de Ollas de Granito Antiadherente',
        puntos: 1200,
        costo: 80.00,
        gananciaMeta: 120.00,
        factor: 10,
        imagen: 'https://images.unsplash.com/photo-1583778176476-4a8b02a64c01?w=600&auto=format&fit=crop&q=80',
        descripcion: 'Set de 7 piezas de aluminio forjado con recubrimiento de granito ecológico. Desafío acumulativo.'
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
function otorgarPuntosPorCompra(clienteCedulaOId, montoUSD, concepto = 'Compra Contado', itemsVendidos = []) {
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

    let puntosGanados = 0;
    let gananciaNetaTotal = 0;
    let cantidadCombos = 0;

    // Si tenemos ítems vendidos desglosados (POS/Abonos), calculamos puntos por combo + puntos base
    if (Array.isArray(itemsVendidos) && itemsVendidos.length > 0) {
        itemsVendidos.forEach(item => {
            const qty = Math.max(1, Number(item.cantidad || 1));
            const precioUnit = Number(item.precio || item.precioUSD || 0);
            const lineSubtotal = qty * precioUnit;

            // Identificar si es combo u oferta
            const esCombo = Boolean(
                item.esCombo === true || 
                item.tipo === 'combo' ||
                item.isCombo === true ||
                String(item.categoria || '').toLowerCase().includes('combo')
            );

            // Costo
            let unitCost = Number(item.costoTotalCombo || item.costo || item.costoUSD || 0);
            if (unitCost <= 0 && Array.isArray(AppState.productos)) {
                const pCat = AppState.productos.find(p => p.id === (item.productoId || item.id));
                unitCost = Number(pCat?.costo || pCat?.costoUSD || 0);
            }
            const lineCost = qty * unitCost;
            const lineProfit = Math.max(0, lineSubtotal - lineCost);
            gananciaNetaTotal += lineProfit;

            if (esCombo) {
                cantidadCombos += qty;
                const ptsCombo = Number(item.puntosCombo ?? item.puntosPromo ?? item.points_given ?? (lineProfit * 2));
                puntosGanados += Math.round(ptsCombo * qty);
            } else {
                puntosGanados += Math.floor(lineSubtotal * puntosPorDolar);
            }
        });
    } else {
        // Cálculo base directo por monto de la compra
        puntosGanados = Math.floor(Number(montoUSD) * puntosPorDolar);
        // Estimación estándar de margen neto (30% si no hay detalle)
        gananciaNetaTotal = Number((Number(montoUSD) * 0.30).toFixed(2));
    }

    if (puntosGanados <= 0) return 0;

    // Actualizar usuario en AppState
    if (usuario) {
        usuario.puntosAcumulados = Number(usuario.puntosAcumulados || 0) + puntosGanados;
        
        // Actualizar métricas financieras acumuladas
        const prevMetrics = usuario.financialMetrics || {};
        usuario.financialMetrics = {
            totalNetProfitUSD: Number((Number(prevMetrics.totalNetProfitUSD || 0) + gananciaNetaTotal).toFixed(2)),
            totalPurchasesUSD: Number((Number(prevMetrics.totalPurchasesUSD || 0) + Number(montoUSD)).toFixed(2)),
            totalPointsEarned: Number(prevMetrics.totalPointsEarned || 0) + puntosGanados,
            combosPurchasedCount: Number(prevMetrics.combosPurchasedCount || 0) + cantidadCombos,
            lastUpdated: new Date().toISOString()
        };
    }

    // Persistir localmente
    if (window.InventoryApp.Persistence && typeof window.InventoryApp.Persistence.guardar === 'function') {
        window.InventoryApp.Persistence.guardar(true);
    }

    // Actualizar Árbol de Gamificación
    if (window.InventoryApp?.TreeGamification && typeof window.InventoryApp.TreeGamification.actualizarPuntos === 'function') {
        window.InventoryApp.TreeGamification.actualizarPuntos(usuario?.puntosAcumulados || puntosGanados);
    }

    // Sincronizar atómicamente con Firestore: /users/{id} y /users/{id}/financialMetrics
    if (window.firebase?.firestore) {
        try {
            const db = window.firebase.firestore();
            const batch = db.batch();
            const userRef = db.collection('users').doc(cleanId);
            const usuarioRef = db.collection('usuarios').doc(cleanId);
            const metricsRef = db.collection('users').doc(cleanId).collection('financialMetrics').doc('summary');

            const updateData = {
                id: cleanId,
                puntosAcumulados: usuario ? usuario.puntosAcumulados : puntosGanados,
                financialMetrics: usuario?.financialMetrics || {
                    totalNetProfitUSD: gananciaNetaTotal,
                    totalPurchasesUSD: Number(montoUSD),
                    totalPointsEarned: puntosGanados,
                    combosPurchasedCount: cantidadCombos,
                    lastUpdated: new Date().toISOString()
                },
                updatedAt: new Date().toISOString()
            };

            batch.set(userRef, updateData, { merge: true });
            batch.set(usuarioRef, updateData, { merge: true });
            batch.set(metricsRef, updateData.financialMetrics, { merge: true });
            batch.commit().catch(e => console.warn('[Puntos] Error batch Firestore:', e));
        } catch (fsErr) {
            console.warn('[Puntos] Error preparando Firestore batch:', fsErr.message);
        }
    } else if (usuario && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarUsuario === 'function') {
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
 * Guarda la configuración del Gran Premio desde el formulario de Administrador
 */
function guardarConfiguracionPremioMes(e) {
    if (e && e.preventDefault) e.preventDefault();

    const nombreInput = document.getElementById('premio-nombre') || document.getElementById('premio-admin-titulo');
    const puntosInput = document.getElementById('premio-puntos') || document.getElementById('premio-admin-puntos');
    const puntosPorDolarInput = document.getElementById('premio-pts-dolar') || document.getElementById('premio-admin-pts-dolar');
    const imagenInput = document.getElementById('premio-imagen-url') || document.getElementById('premio-admin-img');
    const descInput = document.getElementById('premio-descripcion') || document.getElementById('premio-admin-desc');
    const mesInput = document.getElementById('premio-admin-mes');
    const modalidadInput = document.getElementById('premio-admin-modalidad');
    const temporadaInput = document.getElementById('premio-temporada-activa');

    const nombre = (nombreInput?.value || '').trim();
    const puntos = Number(puntosInput?.value || 600);
    const puntosPorDolar = Number(puntosPorDolarInput?.value || 1);
    const imagen = (imagenInput?.value || '').trim();
    const descripcion = (descInput?.value || '').trim();
    const modalidad = modalidadInput?.value || 'ABIERTA_HASTA_GANADOR';
    const mes = (mesInput?.value || '').trim() || 'Activo hasta tener ganador o cierre manual (Acumulativo)';
    const temporadaActiva = temporadaInput ? temporadaInput.checked : (AppState.premioMes?.temporadaActiva !== false);

    // Parámetros de Ingeniería Financiera
    const costoRealPremio = Math.max(0, parseFloat(document.getElementById('premio-admin-costo-real')?.value) || 40);
    const gananciaNetaObjetivo = Math.max(1, parseFloat(document.getElementById('premio-admin-ganancia-meta')?.value) || 60);
    const poolClientesEstimado = Math.max(1, parseInt(document.getElementById('premio-admin-pool-clientes')?.value, 10) || 10);
    const pointsPerProfitDollar = Math.max(1, parseFloat(document.getElementById('premio-admin-pts-profit')?.value) || 10);

    if (!nombre) {
        if (window.InventoryApp.Modal?.alert) {
            window.InventoryApp.Modal.alert('Campo Requerido', 'Por favor ingresa el nombre del Gran Premio en juego.');
        } else {
            alert('Por favor ingresa el nombre del Gran Premio en juego.');
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

    // Determinar estado de la temporada: si el admin está guardando un nuevo premio, reactivar si estaba completado
    let estadoActual = AppState.premioMes?.estado || 'ACTIVO';
    if (estadoActual === 'GANADOR_ALCANZADO' && AppState.premioMes?.nombre !== nombre) {
        estadoActual = 'ACTIVO';
        AppState.premioMes.ganadorActual = null;
    }

    AppState.premioMes = {
        ...(AppState.premioMes || {}),
        nombre: nombre,
        puntosRequeridos: puntos,
        puntosPorDolar: puntosPorDolar > 0 ? puntosPorDolar : 1,
        imagen: imagen || 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600&auto=format&fit=crop&q=80',
        descripcion: descripcion || 'Gran premio en juego para nuestros clientes más fieles. ¡Acumula puntos con cada compra completada!',
        mes: mes,
        vigenciaTexto: mes,
        modalidad: modalidad,
        temporadaActiva: temporadaActiva,
        estado: estadoActual,
        // Parámetros Financieros (Modelo Acumulativo de Ventas)
        costoRealPremio: costoRealPremio,
        gananciaNetaObjetivo: gananciaNetaObjetivo,
        poolClientesEstimado: poolClientesEstimado,
        pointsPerProfitDollar: pointsPerProfitDollar,
        winnerAloneCoversReward: gananciaNetaObjetivo >= costoRealPremio
    };

    // Persistir directamente en Firebase Firestore
    if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarConfiguracionGlobal === 'function') {
        window.InventoryApp.Firebase.guardarConfiguracionGlobal({
            premioMes: AppState.premioMes,
            temporadaInviernoActiva: !temporadaActiva
        }).catch(err => console.warn('[PremioMes] Error guardando config en Firestore:', err));
    }

    if (window.InventoryApp.Persistence && typeof window.InventoryApp.Persistence.guardar === 'function') {
        window.InventoryApp.Persistence.guardar(true);
    }

    if (window.InventoryApp.Modal?.alert) {
        window.InventoryApp.Modal.alert(
            'Gran Premio Guardado',
            `¡El desafío "${nombre}" (${puntos} pts) ha sido guardado exitosamente!\n\n• Modalidad: Abierta y Acumulativa (Sin límite mensual)\n• Estado: ${estadoActual === 'ACTIVO' ? '🟢 EN JUEGO' : estadoActual}\n• Cobertura: Inversión de $${costoRealPremio.toFixed(2)} cubierta por $${gananciaNetaObjetivo.toFixed(2)} de ganancia neta cobrada previamente en ventas.`
        );
    } else {
        alert('¡Configuración del Gran Premio actualizada exitosamente!');
    }

    renderizarConfiguradorPremioAdmin();
    renderizarPremioMesCliente();
}

window.guardarConfiguracionPremio = guardarConfiguracionPremioMes;

/**
 * Pausa o reactiva el desafío del premio actual ("o yo lo decida")
 */
async function togglePausarDesafioPremioAdmin() {
    AppState.premioMes = AppState.premioMes || {};
    const estaPausado = AppState.premioMes.estado === 'PAUSADO' || AppState.premioMes.temporadaActiva === false;

    const accionTexto = estaPausado ? 'Reactivar' : 'Pausar';
    const confirmar = await (window.InventoryApp.Modal?.confirm
        ? window.InventoryApp.Modal.confirm(
            `${accionTexto} Desafío del Premio`,
            estaPausado 
                ? '¿Deseas reactivar el desafío del premio? Los clientes volverán a ver el premio activo y podrán continuar acumulando puntos para ganarlo.'
                : '¿Deseas pausar temporalmente este premio? El premio dejará de mostrarse en disputa activa hasta que decidas reactivarlo. Los puntos acumulados de los clientes quedan protegidos.'
          )
        : confirm(`¿Deseas ${accionTexto.toLowerCase()} el desafío del premio?`));

    if (!confirmar) return;

    if (estaPausado) {
        AppState.premioMes.estado = 'ACTIVO';
        AppState.premioMes.temporadaActiva = true;
    } else {
        AppState.premioMes.estado = 'PAUSADO';
        AppState.premioMes.temporadaActiva = false;
    }

    // Persistir
    if (window.InventoryApp?.Firebase?.guardarConfiguracionGlobal) {
        window.InventoryApp.Firebase.guardarConfiguracionGlobal({
            premioMes: AppState.premioMes,
            temporadaInviernoActiva: !AppState.premioMes.temporadaActiva
        }).catch(e => console.warn(e));
    }
    if (window.InventoryApp.Persistence) window.InventoryApp.Persistence.guardar(true);

    actualizarPreviewPremioAdmin();
    renderizarPremioMesCliente();

    if (window.InventoryApp.Modal?.alert) {
        window.InventoryApp.Modal.alert(
            `Desafío ${estaPausado ? 'Reactivado' : 'Pausado'}`,
            estaPausado 
                ? '🟢 El premio vuelve a estar en disputa activa.'
                : '⏸️ El premio ha sido pausado. No se podrá reclamar hasta que lo reactives.'
        );
    }
}
window.togglePausarDesafioPremioAdmin = togglePausarDesafioPremioAdmin;

/**
 * Inicia una nueva temporada con un nuevo premio ("Tal premio por tantos puntos activo")
 */
function iniciarNuevoDesafioModalAdmin() {
    const pm = AppState.premioMes || {};
    const defaultNombre = 'Freidora de Aire Digital 4.5L';
    const defaultPuntos = 900;
    const defaultCosto = 60.00;
    const defaultMeta = 90.00;

    if (window.InventoryApp.Modal?.show) {
        const body = document.createElement('div');
        body.innerHTML = `
            <div style="padding:4px 0;">
                <p style="color:var(--text-muted); font-size:0.88rem; margin-bottom:14px; line-height:1.4;">
                    Define el nuevo premio en juego. El desafío permanecerá activo de forma acumulativa hasta que un cliente alcance los puntos requeridos o decidas retirarlo.
                </p>

                <div class="reward-presets-section" style="margin-bottom:14px;">
                    <div style="font-size:0.8rem; font-weight:700; color:var(--text-main); margin-bottom:6px;">
                        Selecciona un preset o escribe abajo:
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                        ${PRESETS_PREMIOS.map((p, idx) => `
                            <button type="button" class="btn btn-outline btn-sm" onclick="cargarPresetEnModalNuevoDesafio(${idx})" style="text-align:left; padding:6px 10px; font-size:0.75rem;">
                                <strong>${p.nombre}</strong><br>
                                <span style="color:#ea580c; font-weight:800;">${p.puntos} Pts</span> • Inversión: $${p.costo}
                            </button>
                        `).join('')}
                    </div>
                </div>

                <div style="display:flex; flex-direction:column; gap:10px;">
                    <div>
                        <label style="font-size:0.8rem; font-weight:700; display:block; margin-bottom:4px;">Nombre del Nuevo Premio *</label>
                        <input type="text" id="modal-nuevo-premio-nombre" class="reward-input" value="${defaultNombre}">
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                        <div>
                            <label style="font-size:0.78rem; font-weight:700; display:block; margin-bottom:4px;">Costo Inversión ($ USD) *</label>
                            <input type="number" id="modal-nuevo-premio-costo" class="reward-input" min="0" step="0.5" value="${defaultCosto}">
                        </div>
                        <div>
                            <label style="font-size:0.78rem; font-weight:700; display:block; margin-bottom:4px;">Ganancia Neta Requerida ($) *</label>
                            <input type="number" id="modal-nuevo-premio-meta" class="reward-input" min="1" step="0.5" value="${defaultMeta}">
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                        <div>
                            <label style="font-size:0.78rem; font-weight:700; display:block; margin-bottom:4px;">Puntos Requeridos (Meta) *</label>
                            <input type="number" id="modal-nuevo-premio-puntos" class="reward-input" min="10" step="10" value="${defaultPuntos}" style="font-weight:900; color:#ea580c;">
                        </div>
                        <div>
                            <label style="font-size:0.78rem; font-weight:700; display:block; margin-bottom:4px;">Modalidad</label>
                            <input type="text" class="reward-input" readonly value="Acumulativo hasta ganador" style="background:#f1f5f9; font-size:0.75rem;">
                        </div>
                    </div>
                    <div>
                        <label style="font-size:0.8rem; font-weight:700; display:block; margin-bottom:4px;">Descripción</label>
                        <textarea id="modal-nuevo-premio-desc" class="reward-textarea" rows="2" style="font-size:0.82rem;">Gran premio de la temporada para nuestros clientes más fieles. ¡Acumula puntos con cada compra!</textarea>
                    </div>
                </div>
            </div>
        `;

        window.InventoryApp.Modal.show({
            title: '✨ Iniciar Nueva Temporada / Activar Gran Premio',
            body: body,
            buttons: [
                {
                    label: 'Cancelar',
                    variant: 'outline',
                    action: (m) => m.close()
                },
                {
                    label: '🚀 Activar Nuevo Desafío',
                    variant: 'primary',
                    action: (m) => {
                        const n = document.getElementById('modal-nuevo-premio-nombre')?.value?.trim();
                        const p = Number(document.getElementById('modal-nuevo-premio-puntos')?.value) || defaultPuntos;
                        const c = Number(document.getElementById('modal-nuevo-premio-costo')?.value) || defaultCosto;
                        const g = Number(document.getElementById('modal-nuevo-premio-meta')?.value) || defaultMeta;
                        const d = document.getElementById('modal-nuevo-premio-desc')?.value?.trim() || '';

                        if (!n) {
                            alert('Ingresa el nombre del premio.');
                            return;
                        }

                        // Buscar imagen preset si coincide
                        const preset = PRESETS_PREMIOS.find(pr => pr.nombre.toLowerCase() === n.toLowerCase());
                        const img = preset ? preset.imagen : (AppState.premioMes?.imagen || 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=600&auto=format&fit=crop&q=80');

                        AppState.premioMes = {
                            ...(AppState.premioMes || {}),
                            nombre: n,
                            puntosRequeridos: p,
                            costoRealPremio: c,
                            gananciaNetaObjetivo: g,
                            descripcion: d,
                            imagen: img,
                            estado: 'ACTIVO',
                            temporadaActiva: true,
                            ganadorActual: null,
                            modalidad: 'ABIERTA_HASTA_GANADOR',
                            vigenciaTexto: 'Activo hasta tener ganador o cierre manual (Acumulativo)'
                        };

                        if (window.InventoryApp?.Firebase?.guardarConfiguracionGlobal) {
                            window.InventoryApp.Firebase.guardarConfiguracionGlobal({
                                premioMes: AppState.premioMes,
                                temporadaInviernoActiva: false
                            }).catch(e => console.warn(e));
                        }
                        if (window.InventoryApp.Persistence) window.InventoryApp.Persistence.guardar(true);

                        m.close();
                        renderizarConfiguradorPremioAdmin();
                        renderizarPremioMesCliente();

                        if (window.InventoryApp.Modal?.alert) {
                            window.InventoryApp.Modal.alert(
                                '¡Temporada Iniciada!',
                                `El nuevo premio "${n}" por ${p} puntos ya está activo y en disputa para todos los clientes.`
                            );
                        }
                    }
                }
            ]
        });
    } else {
        const n = prompt('Ingresa el nombre del nuevo premio:', defaultNombre);
        if (n) {
            AppState.premioMes = {
                ...(AppState.premioMes || {}),
                nombre: n,
                puntosRequeridos: defaultPuntos,
                costoRealPremio: defaultCosto,
                gananciaNetaObjetivo: defaultMeta,
                estado: 'ACTIVO',
                temporadaActiva: true,
                ganadorActual: null
            };
            if (window.InventoryApp.Persistence) window.InventoryApp.Persistence.guardar(true);
            renderizarConfiguradorPremioAdmin();
            renderizarPremioMesCliente();
        }
    }
}
window.iniciarNuevoDesafioModalAdmin = iniciarNuevoDesafioModalAdmin;

function cargarPresetEnModalNuevoDesafio(idx) {
    const p = PRESETS_PREMIOS[idx];
    if (!p) return;
    const nom = document.getElementById('modal-nuevo-premio-nombre');
    const pts = document.getElementById('modal-nuevo-premio-puntos');
    const cos = document.getElementById('modal-nuevo-premio-costo');
    const met = document.getElementById('modal-nuevo-premio-meta');
    const des = document.getElementById('modal-nuevo-premio-desc');

    if (nom) nom.value = p.nombre;
    if (pts) pts.value = p.puntos;
    if (cos) cos.value = p.costo;
    if (met) met.value = p.gananciaMeta;
    if (des) des.value = p.descripcion;
}
window.cargarPresetEnModalNuevoDesafio = cargarPresetEnModalNuevoDesafio;

/**
 * Anuncia la Nueva Temporada de Premios por WhatsApp
 */
function anunciarTemporadaWhatsApp() {
    const pm = AppState.premioMes || { nombre: 'Premio Activo', puntosRequeridos: 600, puntosPorDolar: 1 };
    const texto = 
        `🌟 *¡GRAN PREMIO EN JUEGO EN TU BODEGUITA DE CONFIANZA!* 🌟\n\n` +
        `🎁 *Premio:* ${pm.nombre}\n` +
        `🎯 *Meta de Puntos:* ${pm.puntosRequeridos} pts\n` +
        `⭐ *Puntos por cada $1 de compra:* ${pm.puntosPorDolar || 1} pts\n` +
        `⏱️ *Modalidad:* Abierta y acumulativa (¡Sin límite de fin de mes, hasta tener ganador!)\n\n` +
        `🛒 ¡Visita nuestro catálogo online, acumula puntos con cada compra y llévate el premio a casa!\n\n` +
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

    const nombreInput = document.getElementById('premio-admin-titulo') || document.getElementById('premio-nombre');
    const puntosInput = document.getElementById('premio-admin-puntos') || document.getElementById('premio-puntos');
    const ptsDolarInput = document.getElementById('premio-admin-pts-dolar') || document.getElementById('premio-pts-dolar');
    const imagenInput = document.getElementById('premio-admin-img') || document.getElementById('premio-imagen-url');
    const descInput = document.getElementById('premio-admin-desc') || document.getElementById('premio-descripcion');
    const costoInput = document.getElementById('premio-admin-costo-real');
    const metaInput = document.getElementById('premio-admin-ganancia-meta');
    const factorInput = document.getElementById('premio-admin-pts-profit');

    if (nombreInput) nombreInput.value = preset.nombre;
    if (costoInput && preset.costo) costoInput.value = preset.costo;
    if (metaInput && preset.gananciaMeta) metaInput.value = preset.gananciaMeta;
    if (factorInput && preset.factor) factorInput.value = preset.factor;
    if (puntosInput) puntosInput.value = preset.puntos;
    if (ptsDolarInput) ptsDolarInput.value = preset.puntosPorDolar || 1;
    if (imagenInput) imagenInput.value = preset.imagen;
    if (descInput) descInput.value = preset.descripcion;

    // Resaltar chip activo
    document.querySelectorAll('.reward-preset-chip').forEach((el, i) => {
        el.classList.toggle('active', i === idx);
        const btn = el.querySelector('.reward-preset-apply-btn');
        if (btn) btn.textContent = i === idx ? 'Activo' : 'Usar';
    });

    actualizarPreviewPremioAdmin();
}
window.aplicarPresetPremio = aplicarPresetPremio;

/**
 * Actualiza la vista previa del Premio en el configurador Admin y recalcula el Asistente Financiero
 * con duración flexible y estado del desafío
 */
function actualizarPreviewPremioAdmin() {
    const nombre = document.getElementById('premio-admin-titulo')?.value || document.getElementById('premio-nombre')?.value || 'Cafetera Espresso Digital 1.5L';
    const ptsDolar = document.getElementById('premio-admin-pts-dolar')?.value || document.getElementById('premio-pts-dolar')?.value || '1';
    const imagen = document.getElementById('premio-admin-img')?.value || document.getElementById('premio-imagen-url')?.value || 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600&auto=format&fit=crop&q=80';
    const desc = document.getElementById('premio-admin-desc')?.value || document.getElementById('premio-descripcion')?.value || 'Gran premio en juego para nuestros clientes más fieles.';
    const mes = document.getElementById('premio-admin-mes')?.value || 'Activo hasta tener ganador o cierre manual (Acumulativo)';

    // Parámetros de Ingeniería Financiera
    const costoPremio = Math.max(0, parseFloat(document.getElementById('premio-admin-costo-real')?.value) || 40);
    const gananciaMeta = Math.max(1, parseFloat(document.getElementById('premio-admin-ganancia-meta')?.value) || 60);
    const poolClientes = Math.max(1, parseInt(document.getElementById('premio-admin-pool-clientes')?.value, 10) || 10);
    const factorProfit = Math.max(1, parseFloat(document.getElementById('premio-admin-pts-profit')?.value) || 10);

    // Meta de puntos del ganador calculada automáticamente: Ganancia Neta Objetivo * Factor
    const puntosCalculados = Math.round(gananciaMeta * factorProfit);
    const puntosInput = document.getElementById('premio-admin-puntos') || document.getElementById('premio-puntos');
    if (puntosInput && document.activeElement !== puntosInput) {
        puntosInput.value = puntosCalculados;
    }
    const puntos = Number(puntosInput?.value || puntosCalculados);

    const formulaEl = document.getElementById('premio-admin-meta-formula');
    if (formulaEl) {
        formulaEl.textContent = `$${gananciaMeta.toFixed(2)} × ${factorProfit} pts/$ = ${puntosCalculados} Pts`;
    }

    // Balance Proyectado de la Temporada (Acumulativo sin límite mensual)
    const competingClients = Math.max(0, poolClientes - 1);
    const poolOtherProfit = competingClients * (gananciaMeta * 0.5);
    const totalSeasonNetProfit = gananciaMeta + poolOtherProfit;
    const netBusinessProfit = totalSeasonNetProfit - costoPremio;
    const isAbsoluteProfitable = (gananciaMeta >= costoPremio) && (netBusinessProfit >= 0);

    // Ventas acumuladas en caja necesarias para que el ganador cubra los $60 (asumiendo ~30% margen de ganancia)
    const ventasBrutasGanadorUSD = Math.round(gananciaMeta / 0.30);

    const elWinner = document.getElementById('premio-balance-winner');
    const elPool = document.getElementById('premio-balance-pool');
    const elCompetingCount = document.getElementById('premio-balance-competing-count');
    const elTotal = document.getElementById('premio-balance-total');
    const elCosto = document.getElementById('premio-balance-costo');
    const elUtilidad = document.getElementById('premio-balance-utilidad');
    const elStatusBadge = document.getElementById('premio-balance-status-badge');
    const elHorizonteInfo = document.getElementById('premio-balance-horizonte-info');

    if (elWinner) elWinner.textContent = `+$${gananciaMeta.toFixed(2)}`;
    if (elCompetingCount) elCompetingCount.textContent = competingClients;
    if (elPool) elPool.textContent = `+$${poolOtherProfit.toFixed(2)}`;
    if (elTotal) elTotal.textContent = `+$${totalSeasonNetProfit.toFixed(2)}`;
    if (elCosto) elCosto.textContent = `-$${costoPremio.toFixed(2)}`;
    if (elUtilidad) {
        elUtilidad.textContent = `${netBusinessProfit >= 0 ? '+' : ''}$${netBusinessProfit.toFixed(2)} USD libres`;
        elUtilidad.style.color = netBusinessProfit >= 0 ? '#047857' : '#dc2626';
    }
    if (elHorizonteInfo) {
        elHorizonteInfo.innerHTML = `
            <strong>⏱️ Ventas Acumuladas Necesarias:</strong> ~$${ventasBrutasGanadorUSD} USD en compras distribuidas en <strong>1, 2 o 3 meses</strong> según el ritmo del cliente. El negocio retiene los $${gananciaMeta.toFixed(2)} de ganancia neta en caja <em>antes</em> de entregar el premio de $${costoPremio.toFixed(2)}.
        `;
    }

    if (elStatusBadge) {
        if (isAbsoluteProfitable) {
            elStatusBadge.textContent = 'Rentabilidad Absoluta Garantizada';
            elStatusBadge.style.background = '#dcfce7';
            elStatusBadge.style.color = '#166534';
        } else if (netBusinessProfit >= 0) {
            elStatusBadge.textContent = 'Rentable con Pool (El Ganador solo no cubre el costo)';
            elStatusBadge.style.background = '#fef3c7';
            elStatusBadge.style.color = '#92400e';
        } else {
            elStatusBadge.textContent = 'Riesgo de Déficit Financiero';
            elStatusBadge.style.background = '#fee2e2';
            elStatusBadge.style.color = '#991b1b';
        }
    }

    // Actualizar Banner de Estado de Temporada en Admin
    const statusBanner = document.getElementById('premio-admin-status-banner');
    const btnPausar = document.getElementById('btn-admin-pausar-desafio');
    const estado = AppState.premioMes?.estado || 'ACTIVO';
    const ganadorActual = AppState.premioMes?.ganadorActual;

    if (statusBanner) {
        if (estado === 'GANADOR_ALCANZADO') {
            statusBanner.className = 'reward-status-banner banner-winner';
            statusBanner.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; width:100%;">
                    <div>
                        <span class="badge" style="background:#fef08a; color:#854d0e; font-weight:800; font-size:0.82rem; padding:4px 10px; border-radius:9999px;">
                            🏆 ¡TEMPORADA CONCLUIDA! GANADOR ALCANZADO
                        </span>
                        <div style="margin-top:6px; font-weight:700; color:#1e293b; font-size:1rem;">
                            Ganador: <span style="color:#b45309;">${ganadorActual?.nombre || 'Cliente Leal'}</span> (${ganadorActual?.puntos || puntos} pts)
                        </div>
                        <div style="font-size:0.8rem; color:#64748b;">
                            El premio fue ganado y retirado de la competencia. Inicia la siguiente temporada para activar el próximo premio.
                        </div>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button type="button" class="btn btn-primary" onclick="iniciarNuevoDesafioModalAdmin()" style="font-weight:700;">
                            <i class="fas fa-wand-magic-sparkles"></i> Activar Nuevo Premio / Temporada
                        </button>
                    </div>
                </div>
            `;
        } else if (estado === 'PAUSADO') {
            statusBanner.className = 'reward-status-banner banner-paused';
            statusBanner.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; width:100%;">
                    <div>
                        <span class="badge" style="background:#f1f5f9; color:#475569; font-weight:800; font-size:0.82rem; padding:4px 10px; border-radius:9999px;">
                            ⏸️ DESAFÍO EN PAUSA TEMPORAL
                        </span>
                        <div style="margin-top:4px; font-size:0.85rem; color:#475569;">
                            El premio no está en disputa en este momento. Los puntos de los clientes siguen acumulándose y están seguros.
                        </div>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button type="button" class="btn btn-success" onclick="togglePausarDesafioPremioAdmin()" style="font-weight:700;">
                            <i class="fas fa-play"></i> Reactivar Desafío
                        </button>
                    </div>
                </div>
            `;
        } else {
            statusBanner.className = 'reward-status-banner banner-active';
            statusBanner.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; width:100%;">
                    <div>
                        <span class="badge" style="background:#dcfce7; color:#166534; font-weight:800; font-size:0.82rem; padding:4px 10px; border-radius:9999px;">
                            🟢 DESAFÍO EN JUEGO (ABIERTO HASTA GANADOR)
                        </span>
                        <div style="margin-top:4px; font-size:0.85rem; color:#334155;">
                            Premio en disputa activa. Se retirará cuando un cliente alcance los <strong>${puntos} Pts</strong> o cuando decidas pausarlo/cambiarlo.
                        </div>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button type="button" class="btn btn-outline btn-sm" onclick="togglePausarDesafioPremioAdmin()" title="Pausar desafío temporalmente">
                            <i class="fas fa-pause"></i> Pausar
                        </button>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="iniciarNuevoDesafioModalAdmin()" title="Cambiar a un nuevo premio">
                            <i class="fas fa-arrows-rotate"></i> Cambiar Premio
                        </button>
                    </div>
                </div>
            `;
        }
    }

    if (btnPausar) {
        btnPausar.innerHTML = estado === 'PAUSADO' 
            ? '<i class="fas fa-play"></i> Reactivar Desafío' 
            : '<i class="fas fa-pause"></i> Pausar Desafío';
    }

    const imgEl = document.getElementById('preview-premio-img');
    const tituloEl = document.getElementById('preview-premio-titulo');
    const puntosEl = document.getElementById('preview-premio-puntos');
    const descEl = document.getElementById('preview-premio-desc');
    const vigenciaEl = document.getElementById('preview-premio-vigencia');
    const rateEl = document.getElementById('preview-premio-rate');
    const charCounter = document.getElementById('reward-desc-char-count');

    if (imgEl) imgEl.src = imagen;
    if (tituloEl) tituloEl.textContent = nombre;
    if (puntosEl) puntosEl.innerHTML = `<i class="fas fa-star"></i> ${puntos} Pts Requeridos`;
    if (descEl) descEl.textContent = desc;
    if (vigenciaEl) vigenciaEl.innerHTML = `<i class="fas fa-hourglass-half"></i> ${mes}`;
    if (rateEl) rateEl.textContent = `$1.00 = +${ptsDolar} Pts`;

    if (charCounter) {
        const count = desc.length;
        charCounter.textContent = `${count} / 280 caracteres`;
        charCounter.classList.toggle('warning', count > 250);
    }
}
window.actualizarPreviewPremioAdmin = actualizarPreviewPremioAdmin;

/**
 * Carga directa de imágenes a Vercel Blob Storage desde el panel Admin
 */
async function manejarSubidaImagenPremioBlob(event) {
    const file = event?.target?.files?.[0] || event?.dataTransfer?.files?.[0];
    if (!file) return;

    if (!file.type.match(/^image\/(png|jpeg|jpg|webp)$/)) {
        alert('Formato no compatible. Por favor sube una imagen PNG, JPG o WEBP.');
        return;
    }

    if (file.size > 8 * 1024 * 1024) {
        alert('La imagen excede 8MB. Por favor selecciona una imagen más liviana.');
        return;
    }

    const progressContainer = document.getElementById('reward-upload-progress-container');
    const progressBar = document.getElementById('reward-progress-bar-fill');
    const statusText = document.getElementById('reward-upload-status-text');
    const percentText = document.getElementById('reward-upload-status-percent');
    const dropzoneIcon = document.getElementById('dropzone-icon-status');
    const dropzoneTitle = document.getElementById('dropzone-title-status');

    if (progressContainer) progressContainer.style.display = 'block';
    if (dropzoneIcon) dropzoneIcon.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    if (dropzoneTitle) dropzoneTitle.textContent = 'Subiendo a Vercel Blob...';
    if (progressBar) progressBar.style.width = '30%';
    if (percentText) percentText.textContent = '30%';
    if (statusText) statusText.textContent = 'Procesando archivo...';

    try {
        const base64Data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        if (progressBar) progressBar.style.width = '65%';
        if (percentText) percentText.textContent = '65%';
        if (statusText) statusText.textContent = 'Transfiriendo a CDN Vercel Blob...';

        const response = await fetch('/api/upload/blob', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileData: base64Data,
                filename: `premios/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
                folder: 'premios',
                contentType: file.type
            })
        });

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${await response.text()}`);
        }

        const data = await response.json();
        const publicUrl = data.url || data.viewUrl || data.rawDirectUrl;

        if (!publicUrl) {
            throw new Error('No se recibió la URL pública de la imagen.');
        }

        if (progressBar) progressBar.style.width = '100%';
        if (percentText) percentText.textContent = '100%';
        if (statusText) statusText.textContent = '¡Imagen guardada en Vercel Blob!';

        // Actualizar URL en inputs y preview
        const imgInput = document.getElementById('premio-admin-img') || document.getElementById('premio-imagen-url');
        if (imgInput) imgInput.value = publicUrl;

        const dropzoneBox = document.getElementById('reward-dropzone-box');
        if (dropzoneBox) dropzoneBox.classList.add('has-file');

        AppState.premioMes = AppState.premioMes || {};
        AppState.premioMes.imagen = publicUrl;

        // Auto-guardado en Firestore
        if (window.InventoryApp?.Firebase?.guardarConfiguracionGlobal) {
            window.InventoryApp.Firebase.guardarConfiguracionGlobal({
                premioMes: AppState.premioMes
            }).catch(e => console.warn('[VercelBlob] Auto-save Firestore:', e));
        }

        actualizarPreviewPremioAdmin();

        setTimeout(() => {
            if (progressContainer) progressContainer.style.display = 'none';
            if (dropzoneIcon) dropzoneIcon.innerHTML = '<i class="fas fa-check-circle" style="color:var(--rc-emerald-600)"></i>';
            if (dropzoneTitle) dropzoneTitle.textContent = '¡Imagen lista en Vercel Blob! Haz clic para cambiar';
        }, 1800);

    } catch (err) {
        console.error('[VercelBlob] Error al subir imagen:', err);
        alert('Error al subir a Vercel Blob: ' + err.message);
        if (progressContainer) progressContainer.style.display = 'none';
        if (dropzoneIcon) dropzoneIcon.innerHTML = '<i class="fas fa-cloud-arrow-up"></i>';
        if (dropzoneTitle) dropzoneTitle.textContent = 'Arrastra una imagen o haz clic aquí';
    }
}
window.manejarSubidaImagenPremioBlob = manejarSubidaImagenPremioBlob;

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

    if (nombreInput) nombreInput.value = pm.nombre || '';
    if (puntosInput) puntosInput.value = pm.puntosRequeridos || 200;
    if (ptsDolarInput) ptsDolarInput.value = pm.puntosPorDolar || 1;
    if (imagenInput) imagenInput.value = pm.imagen || '';
    if (descInput) descInput.value = pm.descripcion || '';
    if (mesInput) mesInput.value = pm.mes || 'Mes en Curso';

    const costoInput = document.getElementById('premio-admin-costo-real');
    const metaInput = document.getElementById('premio-admin-ganancia-meta');
    const poolInput = document.getElementById('premio-admin-pool-clientes');
    const factorInput = document.getElementById('premio-admin-pts-profit');

    if (costoInput && pm.costoRealPremio !== undefined) costoInput.value = pm.costoRealPremio;
    if (metaInput && pm.gananciaNetaObjetivo !== undefined) metaInput.value = pm.gananciaNetaObjetivo;
    if (poolInput && pm.poolClientesEstimado !== undefined) poolInput.value = pm.poolClientesEstimado;
    if (factorInput && pm.pointsPerProfitDollar !== undefined) factorInput.value = pm.pointsPerProfitDollar;

    // Renderizar presets en chips horizontales modernos
    const presetsContainer = document.getElementById('premio-presets-container') || document.getElementById('premio-admin-presets');
    if (presetsContainer) {
        presetsContainer.innerHTML = PRESETS_PREMIOS.map((p, idx) => `
            <div class="reward-preset-chip ${idx === 0 ? 'active' : ''}" onclick="aplicarPresetPremio(${idx})" title="Seleccionar: ${p.nombre}">
                <img src="${p.imagen}" alt="${p.nombre}" class="reward-preset-thumb" loading="lazy">
                <div class="reward-preset-info">
                    <div class="reward-preset-name">${p.nombre}</div>
                    <div class="reward-preset-meta">
                        <span class="reward-preset-badge">${p.puntos} Pts</span>
                    </div>
                </div>
                <button type="button" class="reward-preset-apply-btn" onclick="event.stopPropagation(); aplicarPresetPremio(${idx});">
                    ${idx === 0 ? 'Activo' : 'Usar'}
                </button>
            </div>
        `).join('');
    }

    // Configurar listeners de Drag & Drop para el Dropzone
    const dropzone = document.getElementById('reward-dropzone-box');
    if (dropzone && !dropzone.dataset.dndBound) {
        dropzone.dataset.dndBound = 'true';
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('dragging');
        });
        dropzone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('dragging');
        });
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('dragging');
            manejarSubidaImagenPremioBlob(e);
        });
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

    // Marcar la temporada como GANADOR_ALCANZADO ("se quitará cuándo ya haya un ganador")
    AppState.premioMes = AppState.premioMes || {};
    AppState.premioMes.estado = 'GANADOR_ALCANZADO';
    AppState.premioMes.ganadorActual = {
        nombre: canje.clienteNombre,
        cedula: canje.clienteCedula,
        premioNombre: canje.premioNombre,
        puntos: canje.puntos,
        fecha: canje.fechaEntrega,
        canjeId: canje.id
    };

    // Persistir cambios
    if (window.InventoryApp.Persistence) window.InventoryApp.Persistence.guardar(true);
    if (window.InventoryApp.Firebase && cliente && typeof window.InventoryApp.Firebase.guardarUsuario === 'function') {
        window.InventoryApp.Firebase.guardarUsuario(cliente).catch(e => console.warn(e));
    }
    if (window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarConfiguracionGlobal === 'function') {
        window.InventoryApp.Firebase.guardarConfiguracionGlobal({
            premioMes: AppState.premioMes
        }).catch(e => console.warn(e));
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
                    <div style="margin-top:4px; font-weight:700; color:#b45309;"><i class="fas fa-flag-checkered"></i> Temporada cerrada: El premio se retira de competencia hasta que actives el siguiente.</div>
                </div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <a href="${waLink}" target="_blank" class="btn btn-success btn-block" style="padding:12px 20px; font-weight:700; font-size:0.95rem; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; gap:8px;">
                        <i class="fab fa-whatsapp" style="font-size:1.2rem;"></i> Notificar al Ganador por WhatsApp
                    </a>
                    <button type="button" class="btn btn-primary btn-block" onclick="iniciarNuevoDesafioModalAdmin()" style="padding:10px 16px; font-weight:700; font-size:0.9rem;">
                        <i class="fas fa-wand-magic-sparkles"></i> Activar Nueva Temporada / Próximo Premio
                    </button>
                </div>
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

            <!-- Tarjeta Gran Premio en Disputa (Desafío Acumulativo de Ventas) -->
            <div class="card" style="display:flex; flex-direction:column; justify-content:space-between;">
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <h3 style="margin:0; font-size:1.15rem; display:flex; align-items:center; gap:8px;">
                            <i class="fas fa-trophy" style="color:var(--primary-accent);"></i> Gran Premio en Juego
                        </h3>
                        <span class="badge" style="background:${pm.estado === 'GANADOR_ALCANZADO' ? '#fef08a' : (pm.estado === 'PAUSADO' ? '#e2e8f0' : '#fef3c7')}; color:${pm.estado === 'GANADOR_ALCANZADO' ? '#854d0e' : (pm.estado === 'PAUSADO' ? '#475569' : '#d97706')}; font-weight:700;">
                            ${pm.estado === 'GANADOR_ALCANZADO' ? '🏆 Concluido' : (pm.estado === 'PAUSADO' ? '⏸️ En Pausa' : `Meta: ${puntosRequeridos} pts`)}
                        </span>
                    </div>

                    ${pm.estado === 'GANADOR_ALCANZADO' ? `
                        <div style="background:#fef9c3; border:1px solid #fde047; border-radius:10px; padding:12px; margin-bottom:14px; font-size:0.85rem; color:#854d0e; line-height:1.4;">
                            <div style="font-weight:800; margin-bottom:4px; font-size:0.92rem;"><i class="fas fa-crown" style="color:#ca8a04;"></i> ¡Temporada Concluida!</div>
                            ¡Felicitaciones a <strong>${pm.ganadorActual?.nombre || 'un cliente leal'}</strong> quien completó los puntos y se llevó este premio!
                            <div style="margin-top:6px; font-size:0.8rem; color:#713f12; border-top:1px dashed #facc15; padding-top:4px;">
                                <strong>✨ Tus ${puntosDisponibles} puntos acumulados siguen intactos</strong> y se sumarán a tus próximas compras para el siguiente gran premio.
                            </div>
                        </div>
                    ` : (pm.estado === 'PAUSADO' ? `
                        <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:10px; padding:12px; margin-bottom:14px; font-size:0.85rem; color:#334155; line-height:1.4;">
                            <div style="font-weight:800; margin-bottom:4px;"><i class="fas fa-pause-circle"></i> Desafío en Pausa Temporal</div>
                            La administración ha pausado temporalmente este desafío. Tus <strong>${puntosDisponibles} puntos</strong> están 100% protegidos y listos para la reactivación.
                        </div>
                    ` : `
                        <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:8px 12px; margin-bottom:12px; font-size:0.8rem; color:#166534;">
                            <i class="fas fa-hourglass-half"></i> <strong>Desafío Acumulativo:</strong> Tus puntos no se vencen a fin de mes; se acumulan compra tras compra hasta alcanzar la meta o hasta que haya un ganador.
                        </div>
                    `)}

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
                            ${pm.estado === 'GANADOR_ALCANZADO' ? 'Premio otorgado · Próxima temporada en breve' : (puedeCanjear ? '🎉 ¡Felicidades! Tienes puntos suficientes para solicitar este premio.' : `Te faltan ${puntosFaltantes} puntos para desbloquear este premio.`)}
                        </small>
                    </div>
                </div>

                <div>
                    ${pm.estado === 'GANADOR_ALCANZADO' ? `
                        <button type="button" class="btn btn-block btn-secondary" disabled style="padding:12px; font-weight:700; font-size:0.95rem;">
                            <i class="fas fa-flag-checkered"></i> Temporada Concluida · Próximo Desafío en Breve
                        </button>
                    ` : (pm.estado === 'PAUSADO' ? `
                        <button type="button" class="btn btn-block btn-secondary" disabled style="padding:12px; font-weight:700; font-size:0.95rem;">
                            <i class="fas fa-pause"></i> Desafío en Pausa
                        </button>
                    ` : `
                        <button type="button" id="btn-canjear-premio" class="btn btn-block ${puedeCanjear ? 'btn-success btn-canjear-glow' : 'btn-secondary'}" 
                            onclick="canjearPremioMesCliente()" ${puedeCanjear ? '' : 'disabled'}
                            style="padding:12px; font-weight:700; font-size:0.95rem;">
                            <i class="fas ${puedeCanjear ? 'fa-gift' : 'fa-lock'}"></i> ${puedeCanjear ? `¡Reclamar ${pm.nombre}!` : `Faltan ${puntosFaltantes} pts para reclamar`}
                        </button>
                    `)}
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

    const pm = AppState.premioMes || {};
    if (pm.estado === 'GANADOR_ALCANZADO') {
        alert('Este premio ya fue alcanzado por otro cliente y la temporada ha concluido. Tus puntos se mantienen intactos para la siguiente temporada que activará la administración en breve.');
        return;
    }
    if (pm.estado === 'PAUSADO') {
        alert('El desafío de este premio está temporalmente en pausa por la administración. Tus puntos están protegidos.');
        return;
    }

    // Si TreeGamification tiene el método especializado con notificación de WhatsApp a la Bodega
    if (window.InventoryApp?.TreeGamification && typeof window.InventoryApp.TreeGamification.reclamarPremioYCiclo === 'function') {
        window.InventoryApp.TreeGamification.reclamarPremioYCiclo();
        return;
    }

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

    if (!Array.isArray(AppState.canjesPremios)) {
        AppState.canjesPremios = [];
    }

    const nuevoCanje = {
        id: 'CANJE-' + Date.now().toString().slice(-6),
        clienteCedula: cedula,
        clienteNombre: usuario.nombre,
        clienteTelefono: usuario.telefono || '',
        premioNombre: pm.nombre,
        puntos: puntosReq,
        fecha: new Date().toISOString().replace('T', ' ').substring(0, 16),
        estado: 'PENDIENTE_CONFIRMACION'
    };

    AppState.canjesPremios.unshift(nuevoCanje);

    // Marcar estado GANADOR_ALCANZADO
    AppState.premioMes = AppState.premioMes || {};
    AppState.premioMes.estado = 'GANADOR_ALCANZADO';
    AppState.premioMes.ganadorActual = {
        nombre: usuario.nombre,
        cedula: cedula,
        premioNombre: pm.nombre,
        puntos: puntosReq,
        fecha: nuevoCanje.fecha,
        canjeId: nuevoCanje.id
    };

    // Persistir
    if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarCanjePremio === 'function') {
        window.InventoryApp.Firebase.guardarCanjePremio(nuevoCanje).catch(e => console.warn('[Canje] Error sync Firestore:', e));
    }
    if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarConfiguracionGlobal === 'function') {
        window.InventoryApp.Firebase.guardarConfiguracionGlobal({
            premioMes: AppState.premioMes
        }).catch(e => console.warn(e));
    }
    if (window.InventoryApp.Persistence && typeof window.InventoryApp.Persistence.guardar === 'function') {
        window.InventoryApp.Persistence.guardar(true);
    }

    alert(`🎉 ¡FELICITACIONES ${usuario.nombre}! Tu solicitud de canje #${nuevoCanje.id} para "${pm.nombre}" ha sido registrada. Por favor acércate a la bodega para retirar tu premio.`);

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
