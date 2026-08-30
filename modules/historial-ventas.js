// modules/historial-ventas.js - Historial de Ventas Diario y Acumulado (Vista Administrador)

let subtabHistorialVentasActual = 'hoy'; // 'hoy' | 'general'
let filtroHistorialCliente = '';
let filtroHistorialFechaDesde = '';
let filtroHistorialFechaHasta = '';
let filtroHistorialMetodo = 'TODOS';
let filtroHistorialEstado = 'TODOS';

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD
 */
function obtenerFechaHoyISO() {
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
}

/**
 * Cambia entre la pestaña "Ventas de Hoy" y "Historial General"
 */
function cambiarSubTabHistorialVentas(subtab) {
    subtabHistorialVentasActual = subtab;
    
    const btnHoy = document.getElementById('tab-historial-hoy');
    const btnGeneral = document.getElementById('tab-historial-general');
    const viewHoy = document.getElementById('subview-historial-hoy');
    const viewGeneral = document.getElementById('subview-historial-general');

    if (btnHoy) btnHoy.classList.toggle('active', subtab === 'hoy');
    if (btnGeneral) btnGeneral.classList.toggle('active', subtab === 'general');

    if (viewHoy) viewHoy.style.display = (subtab === 'hoy') ? 'block' : 'none';
    if (viewGeneral) viewGeneral.style.display = (subtab === 'general') ? 'block' : 'none';

    renderizarHistorialVentasAdmin();
}

/**
 * Renderiza el módulo completo de Historial de Ventas para el Administrador
 */
function renderizarHistorialVentasAdmin() {
    const ventas = AppState.ventas || [];
    const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 0);
    const fechaHoy = obtenerFechaHoyISO();

    // 1. Filtrar ventas de hoy
    const ventasHoy = ventas.filter(v => {
        const f = String(v.fecha || '').trim();
        return f.startsWith(fechaHoy);
    });

    // 2. Calcular KPIs de Ventas
    let totalVentasHoyUSD = 0;
    let totalVentasHoyVES = 0;
    let totalVentasHistoricoUSD = 0;
    let totalVentasCreditoUSD = 0;
    let totalVentasContadoUSD = 0;

    ventas.forEach(v => {
        const total = Number(v.total || 0);
        totalVentasHistoricoUSD += total;

        const esCredito = (v.tipo === 'Crédito' || v.tipoPago === 'Crédito');
        if (esCredito) {
            totalVentasCreditoUSD += total;
        } else {
            totalVentasContadoUSD += total;
        }
    });

    ventasHoy.forEach(v => {
        const total = Number(v.total || 0);
        totalVentasHoyUSD += total;
        const totalV = Number(v.totalVES || 0) || (tasa > 0 ? (total * tasa) : 0);
        totalVentasHoyVES += totalV;
    });

    // Actualizar elementos de KPI en UI
    const kpiHoyUSD = document.getElementById('kpi-ventas-hoy-usd');
    const kpiHoyVES = document.getElementById('kpi-ventas-hoy-ves');
    const kpiHoyCant = document.getElementById('kpi-ventas-hoy-cant');
    const kpiHistUSD = document.getElementById('kpi-ventas-historico-usd');
    const kpiCreditoUSD = document.getElementById('kpi-ventas-credito-usd');
    const badgeHoy = document.getElementById('badge-ventas-hoy-count');

    if (kpiHoyUSD) kpiHoyUSD.textContent = `$${totalVentasHoyUSD.toFixed(2)}`;
    if (kpiHoyVES) kpiHoyVES.textContent = `Bs. ${totalVentasHoyVES.toFixed(2)}`;
    if (kpiHoyCant) kpiHoyCant.textContent = ventasHoy.length;
    if (kpiHistUSD) kpiHistUSD.textContent = `$${totalVentasHistoricoUSD.toFixed(2)}`;
    if (kpiCreditoUSD) kpiCreditoUSD.textContent = `$${totalVentasCreditoUSD.toFixed(2)}`;
    if (badgeHoy) badgeHoy.textContent = ventasHoy.length;

    // 3. Renderizar Tabla de Ventas de Hoy
    const tbodyHoy = document.getElementById('ventas-hoy-body');
    if (tbodyHoy) {
        if (ventasHoy.length === 0) {
            tbodyHoy.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">
                        <i class="fas fa-calendar-day" style="font-size:2rem; margin-bottom:8px; opacity:0.4; display:block;"></i>
                        No se han procesado compras ni ventas el día de hoy (${fechaHoy}).
                    </td>
                </tr>
            `;
        } else {
            // Ordenar de más reciente a más antigua
            const ventasHoyOrdenadas = [...ventasHoy].reverse();
            tbodyHoy.innerHTML = ventasHoyOrdenadas.map((v, idx) => {
                const totalUSD = Number(v.total || 0);
                const totalVES = Number(v.totalVES || 0) || (tasa > 0 ? (totalUSD * tasa) : 0);
                const hora = v.fecha ? v.fecha.split(' ')[1] || v.fecha : '—';
                const itemsCount = Array.isArray(v.items) ? v.items.reduce((s, i) => s + Number(i.cantidad || 1), 0) : 1;
                const itemsDetalle = Array.isArray(v.items) 
                    ? v.items.map(i => `${i.cantidad}x ${i.nombre}`).join(', ')
                    : 'Detalle de productos';
                
                const metodo = v.tipo || v.tipoPago || 'Crédito';
                const esCredito = (metodo === 'Crédito');
                const badgeMetodo = esCredito
                    ? '<span class="badge-status-pill badge-warning" style="font-weight:700;"><i class="fas fa-hand-holding-dollar"></i> Crédito / Fiado</span>'
                    : `<span class="badge-status-pill badge-success" style="font-weight:700;"><i class="fas fa-money-bill-wave"></i> ${metodo}</span>`;

                const clienteNom = v.clienteNombre || (v.clienteId ? (AppState.clientes.find(c => c.id === v.clienteId)?.nombre || v.clienteId) : 'Cliente General');

                return `
                    <tr>
                        <td style="font-weight:700; color:var(--primary-accent);">
                            #${v.id}
                        </td>
                        <td>
                            <i class="far fa-clock" style="color:var(--text-muted); margin-right:4px;"></i>
                            <strong>${hora}</strong>
                        </td>
                        <td>
                            <div style="font-weight:600;">${clienteNom}</div>
                            <small style="color:var(--text-muted); font-size:0.75rem;">ID: ${v.clienteId || 'N/A'}</small>
                        </td>
                        <td>
                            <span style="font-weight:600;">${itemsCount} unid.</span>
                            <small style="display:block; color:var(--text-muted); font-size:0.75rem; max-width:220px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${itemsDetalle}">
                                ${itemsDetalle}
                            </small>
                        </td>
                        <td>${badgeMetodo}</td>
                        <td class="num" style="font-weight:700;">
                            <div style="color:var(--text-main);">$${totalUSD.toFixed(2)}</div>
                            <small style="color:#16a34a; font-size:0.78rem;">Bs. ${totalVES.toFixed(2)}</small>
                        </td>
                        <td style="text-align:center;">
                            <button type="button" class="btn btn-sm btn-outline" onclick="abrirModalDetalleVenta('${v.id}')" title="Ver detalle de la venta">
                                <i class="fas fa-eye"></i> Detalle
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    // 4. Renderizar Tabla de Historial General (con filtros aplicados)
    const tbodyGeneral = document.getElementById('ventas-general-body');
    if (tbodyGeneral) {
        let filtradas = [...ventas];

        // Filtro por texto de cliente o ID
        if (filtroHistorialCliente.trim()) {
            const query = filtroHistorialCliente.trim().toLowerCase();
            filtradas = filtradas.filter(v => {
                const id = String(v.id || '').toLowerCase();
                const nom = String(v.clienteNombre || '').toLowerCase();
                const cid = String(v.clienteId || '').toLowerCase();
                return id.includes(query) || nom.includes(query) || cid.includes(query);
            });
        }

        // Filtro por fecha desde
        if (filtroHistorialFechaDesde) {
            filtradas = filtradas.filter(v => {
                const f = String(v.fecha || '').split(' ')[0];
                return f >= filtroHistorialFechaDesde;
            });
        }

        // Filtro por fecha hasta
        if (filtroHistorialFechaHasta) {
            filtradas = filtradas.filter(v => {
                const f = String(v.fecha || '').split(' ')[0];
                return f <= filtroHistorialFechaHasta;
            });
        }

        // Filtro por método
        if (filtroHistorialMetodo !== 'TODOS') {
            filtradas = filtradas.filter(v => {
                const m = String(v.tipo || v.tipoPago || '');
                if (filtroHistorialMetodo === 'Crédito') {
                    return m === 'Crédito';
                } else if (filtroHistorialMetodo === 'Contado') {
                    return m !== 'Crédito';
                } else {
                    return m.toLowerCase().includes(filtroHistorialMetodo.toLowerCase());
                }
            });
        }

        // Filtro por estado
        if (filtroHistorialEstado !== 'TODOS') {
            filtradas = filtradas.filter(v => {
                const est = String(v.estado || 'CONFIRMADO');
                return est === filtroHistorialEstado;
            });
        }

        const countGeneralElem = document.getElementById('ventas-general-count');
        if (countGeneralElem) countGeneralElem.textContent = `${filtradas.length} transacciones encontradas`;

        if (filtradas.length === 0) {
            tbodyGeneral.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">
                        <i class="fas fa-search" style="font-size:2rem; margin-bottom:8px; opacity:0.4; display:block;"></i>
                        No se encontraron registros de ventas con los filtros aplicados.
                    </td>
                </tr>
            `;
        } else {
            const ordenadas = [...filtradas].reverse();
            tbodyGeneral.innerHTML = ordenadas.map(v => {
                const totalUSD = Number(v.total || 0);
                const totalVES = Number(v.totalVES || 0) || (tasa > 0 ? (totalUSD * tasa) : 0);
                const fecha = v.fecha || '—';
                const itemsCount = Array.isArray(v.items) ? v.items.reduce((s, i) => s + Number(i.cantidad || 1), 0) : 1;
                const metodo = v.tipo || v.tipoPago || 'Crédito';
                const esCredito = (metodo === 'Crédito');
                
                const badgeMetodo = esCredito
                    ? '<span class="badge-status-pill badge-warning" style="font-weight:700;"><i class="fas fa-hand-holding-dollar"></i> Crédito</span>'
                    : `<span class="badge-status-pill badge-success" style="font-weight:700;">${metodo}</span>`;

                const clienteNom = v.clienteNombre || (v.clienteId ? (AppState.clientes.find(c => c.id === v.clienteId)?.nombre || v.clienteId) : 'Cliente General');

                return `
                    <tr>
                        <td style="font-weight:700; color:var(--primary-accent);">#${v.id}</td>
                        <td style="font-size:0.85rem; color:var(--text-muted);">${fecha}</td>
                        <td>
                            <div style="font-weight:600;">${clienteNom}</div>
                            <small style="color:var(--text-muted); font-size:0.75rem;">ID: ${v.clienteId || 'N/A'}</small>
                        </td>
                        <td>${itemsCount} unid.</td>
                        <td>${badgeMetodo}</td>
                        <td class="num" style="font-weight:700;">$${totalUSD.toFixed(2)}</td>
                        <td class="num" style="color:#16a34a; font-weight:600;">Bs. ${totalVES.toFixed(2)}</td>
                        <td style="text-align:center;">
                            <button type="button" class="btn btn-sm btn-outline" onclick="abrirModalDetalleVenta('${v.id}')">
                                <i class="fas fa-eye"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }
}

/**
 * Filtra el historial general por búsqueda en vivo
 */
function filtrarHistorialGeneralPorCliente(query) {
    filtroHistorialCliente = query || '';
    renderizarHistorialVentasAdmin();
}

function filtrarHistorialGeneralPorFechas(desde, hasta) {
    filtroHistorialFechaDesde = desde || '';
    filtroHistorialFechaHasta = hasta || '';
    renderizarHistorialVentasAdmin();
}

function filtrarHistorialGeneralPorMetodo(metodo) {
    filtroHistorialMetodo = metodo || 'TODOS';
    renderizarHistorialVentasAdmin();
}

function filtrarHistorialGeneralPorEstado(estado) {
    filtroHistorialEstado = estado || 'TODOS';
    renderizarHistorialVentasAdmin();
}

function limpiarFiltrosHistorialVentas() {
    filtroHistorialCliente = '';
    filtroHistorialFechaDesde = '';
    filtroHistorialFechaHasta = '';
    filtroHistorialMetodo = 'TODOS';
    filtroHistorialEstado = 'TODOS';

    const inputCli = document.getElementById('historial-filtro-cliente');
    const inputDesde = document.getElementById('historial-filtro-desde');
    const inputHasta = document.getElementById('historial-filtro-hasta');
    const selectMetodo = document.getElementById('historial-filtro-metodo');
    const selectEstado = document.getElementById('historial-filtro-estado');

    if (inputCli) inputCli.value = '';
    if (inputDesde) inputDesde.value = '';
    if (inputHasta) inputHasta.value = '';
    if (selectMetodo) selectMetodo.value = 'TODOS';
    if (selectEstado) selectEstado.value = 'TODOS';

    renderizarHistorialVentasAdmin();
}

/**
 * Modal para visualizar el detalle completo de una venta
 */
function abrirModalDetalleVenta(ventaId) {
    const venta = (AppState.ventas || []).find(v => v.id === ventaId);
    if (!venta) return;

    let modal = document.getElementById('modal-detalle-venta-admin');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-detalle-venta-admin';
        modal.className = 'modal';
        modal.onclick = function(e) { if (e.target === this) cerrarModalDetalleVenta(); };
        document.body.appendChild(modal);
    }

    const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 0);
    const totalUSD = Number(venta.total || 0);
    const totalVES = Number(venta.totalVES || 0) || (tasa > 0 ? (totalUSD * tasa) : 0);
    const items = Array.isArray(venta.items) ? venta.items : [];
    const clienteNom = venta.clienteNombre || (venta.clienteId ? (AppState.clientes.find(c => c.id === venta.clienteId)?.nombre || venta.clienteId) : 'Cliente General');

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 580px; max-height: 90vh; overflow-y: auto;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:12px; margin-bottom:14px;">
                <h3 style="margin:0; display:flex; align-items:center; gap:8px;">
                    <i class="fas fa-receipt" style="color:var(--primary-accent);"></i> Detalle de Venta #${venta.id}
                </h3>
                <button type="button" class="btn-icon-tasa" onclick="cerrarModalDetalleVenta()"><i class="fas fa-times"></i></button>
            </div>

            <div style="background:#f8fafc; border:1px solid var(--border); border-radius:10px; padding:14px; margin-bottom:16px; font-size:0.88rem;">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                    <div>
                        <span style="color:var(--text-muted); display:block; font-size:0.75rem; text-transform:uppercase;">Cliente</span>
                        <strong>${clienteNom}</strong>
                        <div style="font-size:0.78rem; color:var(--text-muted);">ID: ${venta.clienteId || 'N/A'}</div>
                    </div>
                    <div>
                        <span style="color:var(--text-muted); display:block; font-size:0.75rem; text-transform:uppercase;">Fecha y Hora</span>
                        <strong>${venta.fecha || '—'}</strong>
                    </div>
                    <div>
                        <span style="color:var(--text-muted); display:block; font-size:0.75rem; text-transform:uppercase;">Método de Pago</span>
                        <strong style="color:var(--primary-accent);">${venta.tipo || venta.tipoPago || 'Crédito'}</strong>
                    </div>
                    <div>
                        <span style="color:var(--text-muted); display:block; font-size:0.75rem; text-transform:uppercase;">Referencia</span>
                        <strong>${venta.referencia || 'N/A'}</strong>
                    </div>
                </div>
            </div>

            <h4 style="margin:0 0 10px 0; font-size:0.95rem;"><i class="fas fa-boxes-stacked"></i> Productos Despachados</h4>
            <div class="table-responsive" style="margin-bottom:16px;">
                <table>
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th class="num">Cant.</th>
                            <th class="num">Precio ($)</th>
                            <th class="num">Subtotal ($)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(i => `
                            <tr>
                                <td>${i.nombre}</td>
                                <td class="num">${i.cantidad}</td>
                                <td class="num">$${Number(i.precio || 0).toFixed(2)}</td>
                                <td class="num" style="font-weight:700;">$${(Number(i.cantidad || 1) * Number(i.precio || 0)).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:14px; margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <span style="color:#166534; font-size:0.95rem;">Total Venta (USD):</span>
                    <strong style="font-size:1.3rem; color:#166534;">$${totalUSD.toFixed(2)}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="color:#166534; font-size:0.9rem;">Equivalente en Bolívares:</span>
                    <strong style="font-size:1.15rem; color:#15803d;">Bs. ${totalVES.toFixed(2)}</strong>
                </div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button type="button" class="btn btn-outline" onclick="cerrarModalDetalleVenta()">Cerrar</button>
            </div>
        </div>
    `;

    modal.classList.add('active');
}

function cerrarModalDetalleVenta() {
    const modal = document.getElementById('modal-detalle-venta-admin');
    if (modal) modal.classList.remove('active');
}

// Exportar globalmente
window.subtabHistorialVentasActual = subtabHistorialVentasActual;
window.cambiarSubTabHistorialVentas = cambiarSubTabHistorialVentas;
window.renderizarHistorialVentasAdmin = renderizarHistorialVentasAdmin;
window.filtrarHistorialGeneralPorCliente = filtrarHistorialGeneralPorCliente;
window.filtrarHistorialGeneralPorFechas = filtrarHistorialGeneralPorFechas;
window.filtrarHistorialGeneralPorMetodo = filtrarHistorialGeneralPorMetodo;
window.filtrarHistorialGeneralPorEstado = filtrarHistorialGeneralPorEstado;
window.limpiarFiltrosHistorialVentas = limpiarFiltrosHistorialVentas;
window.abrirModalDetalleVenta = abrirModalDetalleVenta;
window.cerrarModalDetalleVenta = cerrarModalDetalleVenta;
