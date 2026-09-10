function calcularEstadoPerdidasPendientes() {
    const pendientes = new Map(); // productoId -> [{ unidades, costo }]
    const impactos = new Map();   // auditoria.id -> impacto monetario de ese movimiento

    const cronologico = [...auditorias].sort((a, b) => {
        const da = new Date(String(a.fecha || '').replace(' ', 'T'));
        const db = new Date(String(b.fecha || '').replace(' ', 'T'));
        return da - db;
    });

    cronologico.forEach(a => {
        const productoId = a.productoId || a.codigo || a.nombre;
        const diferencia = Number(a.diferencia) || 0;
        const productoActual = productos.find(p => p.id === a.productoId);
        const costo = Number(a.costo ?? (productoActual ? productoActual.costo : 0)) || 0;

        if (!pendientes.has(productoId)) pendientes.set(productoId, []);
        const cola = pendientes.get(productoId);

        if (diferencia < 0) {
            const unidades = Math.abs(diferencia);
            cola.push({ unidades, costo });
            impactos.set(a.id, unidades * costo); // pérdida generada
        } else if (diferencia > 0) {
            let porReponer = diferencia;
            let recuperadoUSD = 0;

            while (porReponer > 0 && cola.length) {
                const lote = cola[0];
                const usadas = Math.min(porReponer, lote.unidades);
                recuperadoUSD += usadas * lote.costo;
                lote.unidades -= usadas;
                porReponer -= usadas;
                if (lote.unidades <= 0) cola.shift();
            }

            // Se guarda como negativo porque reduce la deuda pendiente.
            impactos.set(a.id, -recuperadoUSD);
        } else {
            impactos.set(a.id, 0);
        }
    });

    let totalPendiente = 0;
    pendientes.forEach(cola => {
        cola.forEach(lote => {
            totalPendiente += lote.unidades * lote.costo;
        });
    });

    return { totalPendiente, impactos };
}

// Resumen económico de pérdidas y recuperación con las ganancias generadas.
// Las pérdidas por daño/vencimiento/merma y las deudas de clientes eliminados
// forman una deuda económica. Las ganancias obtenidas por ventas la van reduciendo.
function obtenerCostoHistoricoProducto(productoId, item = null) {
    if (item && Number.isFinite(Number(item.costo))) return Number(item.costo);
    const actual = productos.find(p => p.id === productoId);
    if (actual) return Number(actual.costo || 0);
    const baja = [...eliminaciones].reverse().find(e => e.productoId === productoId && Number(e.costo) >= 0);
    if (baja) return Number(baja.costo || 0);
    const ajuste = [...auditorias].reverse().find(a => a.productoId === productoId && Number(a.costo) >= 0);
    return ajuste ? Number(ajuste.costo || 0) : 0;
}

// Determina si una venta o transacción se encuentra debidamente confirmada.
// Solo las ventas confirmadas pueden transferir sus ganancias a la recuperación de pérdidas.
function esVentaOTransaccionConfirmada(venta) {
    if (!venta) return false;

    // 1. Verificación de flags explícitos
    if (venta.confirmada === true) return true;
    if (venta.pendiente === true || venta.confirmada === false) return false;

    // 2. Verificación de estado de la venta
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

    // 3. Si la venta tiene una referencia o transacción bancaria vinculada en AppState.transacciones
    const ref = String(venta.referencia || '').trim();
    const txList = Array.isArray(window.AppState?.transacciones) 
        ? window.AppState.transacciones 
        : (typeof transacciones !== 'undefined' && Array.isArray(transacciones) ? transacciones : []);

    const txAsociada = txList.find(t =>
        (t.id && (t.id === venta.id || t.pedidoId === venta.id)) ||
        (t.pedidoId && t.pedidoId === venta.id) ||
        (ref && ref !== 'N/A' && ref !== 'CRÉDITO-REGISTRADO' && String(t.referencia || '').trim() === ref)
    );
    if (txAsociada) {
        const estadoTx = String(txAsociada.estado || '').trim().toLowerCase();
        if (estadoTx === 'confirmando' || estadoTx === 'fallido' || estadoTx.includes('pendiente')) {
            return false;
        }
    }

    // 4. Si existe en la lista de PagosPorVerificar de Firestore/AppState
    const pagosVerif = Array.isArray(window.AppState?.pagosPorVerificar) ? window.AppState.pagosPorVerificar : [];
    const pago = pagosVerif.find(p =>
        p.id === venta.id || p.ventaId === venta.id || p.pedidoId === venta.id ||
        (ref && ref !== 'N/A' && String(p.referencia || '').trim() === ref)
    );
    if (pago) {
        const pEst = String(pago.estado || '').trim().toUpperCase();
        if (pEst !== 'APROBADO' && pEst !== 'CONFIRMADO' && pEst !== 'PAGO AGREGADO') {
            return false;
        }
    }

    // Por defecto, si el estado no está pendiente
    return true;
}
window.esVentaOTransaccionConfirmada = esVentaOTransaccionConfirmada;

function calcularGananciaGeneradaVentas() {
    const listadoVentas = Array.isArray(window.AppState?.ventas)
        ? window.AppState.ventas
        : (typeof ventas !== 'undefined' && Array.isArray(ventas) ? ventas : []);

    return listadoVentas.reduce((total, venta) => {
        // Solo acumula ganancias si la transacción ha sido confirmada
        if (!esVentaOTransaccionConfirmada(venta)) {
            return total;
        }

        const gananciaVenta = (venta.items || []).reduce((sum, item) => {
            const costo = obtenerCostoHistoricoProducto(item.productoId, item);
            const precio = Number(item.precio || 0);
            const cantidad = Number(item.cantidad || 0);
            return sum + ((precio - costo) * cantidad);
        }, 0);
        return total + gananciaVenta;
    }, 0);
}

function calcularResumenPerdidasEconomicas() {
    const listElim = Array.isArray(window.AppState?.eliminaciones) ? window.AppState.eliminaciones : (typeof eliminaciones !== 'undefined' ? eliminaciones : []);
    const listCliElim = Array.isArray(window.AppState?.clientesEliminados) ? window.AppState.clientesEliminados : (typeof clientesEliminados !== 'undefined' ? clientesEliminados : []);
    const listProd = Array.isArray(window.AppState?.productos) ? window.AppState.productos : (typeof productos !== 'undefined' ? productos : []);

    const perdidaProductos = listElim.reduce((sum, e) => {
        if (Number.isFinite(Number(e.perdidaUSD))) return sum + Math.max(0, Number(e.perdidaUSD));
        return sum + (typeof calcularPerdidaBajaProducto === 'function' ? calcularPerdidaBajaProducto(e.motivo, e.cantidadRetirada, e.costo) : (Number(e.cantidadRetirada || 0) * Number(e.costo || 0)));
    }, 0);

    const deudaClientesEliminados = listCliElim.reduce((sum, c) => sum + Math.max(0, Number(c.perdidaUSD ?? c.deudaUSD ?? 0)), 0);
    
    // Faltantes de auditorías históricas ya aplicadas
    const perdidaFaltantesHistoricas = calcularEstadoPerdidasPendientes().totalPendiente;

    // Faltantes de conteos físicos actualmente en captura (tiempo real antes de aplicar)
    let perdidaFaltantesConteoActivo = 0;
    const conteos = (typeof conteosFisicos !== 'undefined' && conteosFisicos) ? conteosFisicos : (window.AppState?.conteosFisicos || {});
    Object.keys(conteos).forEach(id => {
        const p = listProd.find(prod => prod.id === id);
        if (!p) return;
        const dif = typeof calcularDiferenciaAuditoria === 'function' ? calcularDiferenciaAuditoria(id) : null;
        if (dif !== null && dif < 0) {
            perdidaFaltantesConteoActivo += Math.abs(dif) * Number(p.costo || 0);
        }
    });

    const perdidaFaltantes = perdidaFaltantesHistoricas + perdidaFaltantesConteoActivo;
    const perdidaBruta = perdidaProductos + deudaClientesEliminados + perdidaFaltantes;
    const gananciaGenerada = Math.max(0, calcularGananciaGeneradaVentas());
    const perdidaPendiente = Math.max(0, perdidaBruta - gananciaGenerada);

    return { perdidaProductos, deudaClientesEliminados, perdidaFaltantes, perdidaBruta, gananciaGenerada, perdidaPendiente };
}

function renderizarResumenPerdidasEconomicas() {
    const r = calcularResumenPerdidasEconomicas();
    const set = (id, value, isPositive = false) => {
        const el = document.getElementById(id);
        if (!el) return;
        const num = Number(value) || 0;
        const absVal = Math.abs(num);
        const parts = absVal.toFixed(2).split('.');
        const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        const decPart = parts[1];
        el.innerHTML = `
            <span class="audit-currency-symbol">${num < 0 ? '-$' : '$'}</span>
            <span>${intPart}</span>
            <span class="audit-currency-cents">.${decPart}</span>
        `;
    };

    set('perdidas-productos-usd', r.perdidaProductos);
    set('perdidas-clientes-usd', r.deudaClientesEliminados);
    set('perdidas-faltantes-usd', r.perdidaFaltantes);
    set('ganancia-generada-usd', r.gananciaGenerada, true);
    set('perdida-pendiente-global-usd', r.perdidaPendiente);

    // Barra de Progreso y Tasa de Recuperación:
    // Solo va cargando cuando haya transacciones confirmadas
    let ratio = 0;
    if (r.perdidaBruta > 0) {
        ratio = Math.min(100, Math.max(0, Math.round((r.gananciaGenerada / r.perdidaBruta) * 100)));
    } else if (r.gananciaGenerada > 0) {
        ratio = 100;
    } else {
        ratio = 0;
    }

    const fillEl = document.getElementById('audit-recovery-progress-fill');
    if (fillEl) {
        fillEl.style.width = `${ratio}%`;
        fillEl.setAttribute('aria-valuenow', ratio);
    }

    const pctEl = document.getElementById('audit-recovery-percentage');
    if (pctEl) {
        if (r.perdidaBruta === 0 && r.gananciaGenerada === 0) {
            pctEl.textContent = '100% (Sin Pérdidas)';
        } else {
            pctEl.textContent = `${ratio}% Recuperado`;
        }
    }

    const legendGanEl = document.getElementById('audit-legend-ganancias');
    if (legendGanEl) {
        legendGanEl.textContent = `Compensado con Ganancias ($${r.gananciaGenerada.toFixed(2)})`;
    }

    const legendPendEl = document.getElementById('audit-legend-pendientes');
    if (legendPendEl) {
        legendPendEl.textContent = `Por Recuperar ($${r.perdidaPendiente.toFixed(2)})`;
    }

    // Badge de Estado Financiero
    const statusBadge = document.getElementById('audit-financial-status-badge');
    if (statusBadge) {
        if (r.perdidaBruta === 0) {
            statusBadge.className = 'audit-financial-status-badge healthy';
            statusBadge.innerHTML = '<i class="fas fa-circle-check"></i> <span>Sin Pérdidas Registradas</span>';
        } else if (r.perdidaPendiente <= 0) {
            statusBadge.className = 'audit-financial-status-badge healthy';
            statusBadge.innerHTML = '<i class="fas fa-circle-check"></i> <span>100% Recuperado / Sin Deuda</span>';
        } else {
            statusBadge.className = 'audit-financial-status-badge critical';
            statusBadge.innerHTML = `<i class="fas fa-triangle-exclamation"></i> <span>Balance Pendiente ($${r.perdidaPendiente.toFixed(2)})</span>`;
        }
    }
}

// Renderiza el historial de ajustes ya aplicados (los más recientes primero).
function renderizarHistorialAuditoria() {
    const tbody = document.getElementById('auditoria-historial-body');
    if (!tbody) return;

    const estadoPerdidas = calcularEstadoPerdidasPendientes();
    const perdidaTotalEl = document.getElementById('auditoria-perdida-total');
    if (perdidaTotalEl) {
        perdidaTotalEl.textContent = `Pérdida pendiente por faltantes: $${estadoPerdidas.totalPendiente.toFixed(2)}`;
        perdidaTotalEl.style.background = estadoPerdidas.totalPendiente > 0 ? '#fff1f2' : '#eef2f7';
        perdidaTotalEl.style.color = estadoPerdidas.totalPendiente > 0 ? 'var(--danger)' : 'var(--text-muted)';
    }

    if (auditorias.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: var(--text-muted);">Aún no se han aplicado ajustes de inventario.</td></tr>';
        renderizarResumenPerdidasEconomicas();
        return;
    }

    const ordenado = [...auditorias].reverse();
    tbody.innerHTML = ordenado.map(a => {
        const impacto = Number(estadoPerdidas.impactos.get(a.id) || 0);
        let textoPerdida = '$0.00';
        let colorPerdida = 'var(--text-muted)';

        if (impacto > 0) {
            textoPerdida = '-$' + impacto.toFixed(2);
            colorPerdida = 'var(--danger)';
        } else if (impacto < 0) {
            textoPerdida = '+$' + Math.abs(impacto).toFixed(2);
            colorPerdida = 'var(--success)';
        }

        return `
        <tr>
            <td>${a.fecha}</td>
            <td>${a.codigo}</td>
            <td>${a.nombre}</td>
            <td class="num">${a.stockAnterior}</td>
            <td class="num"><strong>${a.stockFisico}</strong></td>
            <td class="num" style="color: ${a.diferencia > 0 ? 'var(--success)' : a.diferencia < 0 ? 'var(--danger)' : 'var(--text-muted)'}; font-weight: bold;">
                ${a.diferencia > 0 ? '+' : ''}${a.diferencia}
            </td>
            <td class="num" style="color: ${colorPerdida}; font-weight:700;">
                ${textoPerdida}
            </td>
        </tr>
    `;
    }).join('');
}
