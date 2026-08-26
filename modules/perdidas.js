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

function calcularGananciaGeneradaVentas() {
    return ventas.reduce((total, venta) => {
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
    const perdidaProductos = eliminaciones.reduce((sum, e) => {
        if (Number.isFinite(Number(e.perdidaUSD))) return sum + Math.max(0, Number(e.perdidaUSD));
        return sum + calcularPerdidaBajaProducto(e.motivo, e.cantidadRetirada, e.costo);
    }, 0);

    const deudaClientesEliminados = clientesEliminados.reduce((sum, c) => sum + Math.max(0, Number(c.perdidaUSD ?? c.deudaUSD ?? 0)), 0);
    const perdidaFaltantes = calcularEstadoPerdidasPendientes().totalPendiente;
    const perdidaBruta = perdidaProductos + deudaClientesEliminados + perdidaFaltantes;
    const gananciaGenerada = Math.max(0, calcularGananciaGeneradaVentas());
    const perdidaPendiente = Math.max(0, perdidaBruta - gananciaGenerada);

    return { perdidaProductos, deudaClientesEliminados, perdidaFaltantes, perdidaBruta, gananciaGenerada, perdidaPendiente };
}

function renderizarResumenPerdidasEconomicas() {
    const r = calcularResumenPerdidasEconomicas();
    const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = `$${value.toFixed(2)}`;
    };
    set('perdidas-productos-usd', r.perdidaProductos);
    set('perdidas-clientes-usd', r.deudaClientesEliminados);
    set('perdidas-faltantes-usd', r.perdidaFaltantes);
    set('ganancia-generada-usd', r.gananciaGenerada);
    set('perdida-pendiente-global-usd', r.perdidaPendiente);

    const card = document.getElementById('perdida-pendiente-global-card');
    if (card) {
        card.style.borderLeftColor = r.perdidaPendiente > 0 ? 'var(--danger)' : 'var(--success)';
        card.style.background = r.perdidaPendiente > 0 ? '#fff1f2' : '#f0fdf4';
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
