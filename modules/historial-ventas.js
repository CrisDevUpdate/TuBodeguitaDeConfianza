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

                const esConf = typeof window.esVentaOTransaccionConfirmada === 'function'
                    ? window.esVentaOTransaccionConfirmada(v)
                    : (v.confirmada === true || (!['PENDIENTE', 'PENDIENTE_CONFIRMACION', 'PENDIENTE_VERIFICACION', 'CONFIRMANDO', 'FALLIDO'].includes(String(v.estado || '').toUpperCase())));

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
                            <div style="display:inline-flex; align-items:center; gap:6px; justify-content:center;">
                                ${esConf ? `
                                    <span class="badge-status-pill badge-success" style="font-size:0.72rem; padding:3px 8px; font-weight:700;" title="Transacción confirmada">
                                        <i class="fas fa-check-circle"></i> Confirmado
                                    </span>
                                ` : `
                                    <span class="badge-status-pill badge-warning" style="font-size:0.72rem; padding:3px 8px; font-weight:700;" title="Pendiente de validación en Usuarios & Aprobación">
                                        <i class="fas fa-clock"></i> Pendiente
                                    </span>
                                `}
                                <button type="button" class="btn btn-sm btn-outline" onclick="abrirModalDetalleVenta('${v.id}')" title="Ver detalle de la venta">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
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

                const esConf = typeof window.esVentaOTransaccionConfirmada === 'function'
                    ? window.esVentaOTransaccionConfirmada(v)
                    : (v.confirmada === true || (!['PENDIENTE', 'PENDIENTE_CONFIRMACION', 'PENDIENTE_VERIFICACION', 'CONFIRMANDO', 'FALLIDO'].includes(String(v.estado || '').toUpperCase())));

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
                            <div style="display:inline-flex; align-items:center; gap:6px; justify-content:center;">
                                ${esConf ? `
                                    <span class="badge-status-pill badge-success" style="font-size:0.72rem; padding:3px 8px; font-weight:700;" title="Transacción confirmada">
                                        <i class="fas fa-check-circle"></i> Confirmado
                                    </span>
                                ` : `
                                    <span class="badge-status-pill badge-warning" style="font-size:0.72rem; padding:3px 8px; font-weight:700;" title="Pendiente de validación en Usuarios & Aprobación">
                                        <i class="fas fa-clock"></i> Pendiente
                                    </span>
                                `}
                                <button type="button" class="btn btn-sm btn-outline" onclick="abrirModalDetalleVenta('${v.id}')" title="Ver detalle de la venta">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
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

    const esConf = typeof window.esVentaOTransaccionConfirmada === 'function'
        ? window.esVentaOTransaccionConfirmada(venta)
        : (venta.confirmada === true || (!['PENDIENTE', 'PENDIENTE_CONFIRMACION', 'PENDIENTE_VERIFICACION', 'CONFIRMANDO', 'FALLIDO'].includes(String(venta.estado || '').toUpperCase())));

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 580px; max-height: 90vh; overflow-y: auto;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:12px; margin-bottom:14px;">
                <h3 style="margin:0; display:flex; align-items:center; gap:8px;">
                    <i class="fas fa-receipt" style="color:var(--primary-accent);"></i> Detalle de Venta #${venta.id}
                </h3>
                <button type="button" class="btn-icon-tasa" onclick="cerrarModalDetalleVenta()"><i class="fas fa-times"></i></button>
            </div>

            ${!esConf ? `
                <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:12px 16px; margin-bottom:14px; display:flex; align-items:center; gap:12px;">
                    <div style="color:#92400e; font-size:0.85rem; line-height:1.4;">
                        <i class="fas fa-clock" style="color:#d97706; margin-right:5px;"></i>
                        <strong>Transacción Pendiente de Confirmación:</strong> Las validaciones y aprobaciones de pagos se gestionan exclusivamente en el módulo de <em>Usuarios & Aprobación</em>.
                    </div>
                </div>
            ` : `
                <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:10px 14px; margin-bottom:14px; display:flex; align-items:center; gap:8px; color:#166534; font-size:0.85rem;">
                    <i class="fas fa-circle-check" style="color:#16a34a;"></i>
                    <span><strong>Transacción Confirmada:</strong> Sus ganancias ya están computadas y activas en el sistema.</span>
                </div>
            `}

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
                        <span style="color:var(--text-muted); display:block; font-size:0.75rem; text-transform:uppercase;">Estado Transacción</span>
                        ${esConf
                            ? '<span class="badge-status-pill badge-success" style="font-size:0.75rem;"><i class="fas fa-check-circle"></i> Confirmado</span>'
                            : '<span class="badge-status-pill badge-warning" style="font-size:0.75rem;"><i class="fas fa-clock"></i> Pendiente</span>'}
                    </div>
                    <div style="grid-column: span 2;">
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

/**
 * Abre el modal del limpiador de historial de ventas
 */
function abrirModalLimpiadorVentas() {
    const ventas = AppState.ventas || [];
    const fechaHoy = obtenerFechaHoyISO();
    const ventasHoy = ventas.filter(v => String(v.fecha || '').trim().startsWith(fechaHoy));
    const totalHoyUSD = ventasHoy.reduce((s, v) => s + Number(v.total || 0), 0);
    const totalHistoricoUSD = ventas.reduce((s, v) => s + Number(v.total || 0), 0);

    let modal = document.getElementById('modal-limpiador-ventas');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-limpiador-ventas';
        modal.className = 'modal';
        modal.onclick = function(e) { if (e.target === this) cerrarModalLimpiadorVentas(); };
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-content" style="max-width:550px; border-radius:14px; padding:24px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid var(--border); padding-bottom:12px;">
                <h3 style="margin:0; font-size:1.25rem; display:flex; align-items:center; gap:10px; color:#b91c1c;">
                    <i class="fas fa-broom"></i> Limpiador de Historial de Ventas
                </h3>
                <button type="button" class="btn-icon-tasa" onclick="cerrarModalLimpiadorVentas()"><i class="fas fa-times"></i></button>
            </div>

            <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:18px; line-height:1.5;">
                Selecciona la opción de limpieza deseada. Esta acción depurará los registros de ventas y actualizará automáticamente los balances, contadores y la sincronización en la nube.
            </p>

            <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:20px;">
                <!-- Opción 1: Limpiar Solo Ventas de Hoy -->
                <div style="border:1px solid var(--border); border-radius:10px; padding:14px; background:#fff; display:flex; justify-content:space-between; align-items:center; gap:14px;">
                    <div>
                        <div style="font-weight:700; color:var(--text-main); font-size:0.95rem; display:flex; align-items:center; gap:8px;">
                            <i class="fas fa-calendar-day" style="color:#d97706;"></i> Limpiar Ventas de Hoy
                        </div>
                        <div style="font-size:0.8rem; color:var(--text-muted); margin-top:3px;">
                            ${ventasHoy.length} transacciones registradas hoy ($${totalHoyUSD.toFixed(2)} USD).
                        </div>
                        <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">
                            Reinicia la jornada actual manteniendo el histórico anterior intacto.
                        </div>
                    </div>
                    <button type="button" class="btn btn-sm btn-warning" onclick="ejecutarLimpiezaVentas('hoy')" ${ventasHoy.length === 0 ? 'disabled' : ''} style="white-space:nowrap; font-weight:700;">
                        <i class="fas fa-calendar-xmark"></i> Limpiar Hoy
                    </button>
                </div>

                <!-- Opción 2: Limpiar Todo el Historial Acumulado -->
                <div style="border:1px solid #fecaca; border-radius:10px; padding:14px; background:#fef2f2; display:flex; justify-content:space-between; align-items:center; gap:14px;">
                    <div>
                        <div style="font-weight:700; color:#b91c1c; font-size:0.95rem; display:flex; align-items:center; gap:8px;">
                            <i class="fas fa-trash-can" style="color:#ef4444;"></i> Limpiar Todo el Historial
                        </div>
                        <div style="font-size:0.8rem; color:#991b1b; margin-top:3px;">
                            ${ventas.length} transacciones totales ($${totalHistoricoUSD.toFixed(2)} USD).
                        </div>
                        <div style="font-size:0.75rem; color:#b91c1c; margin-top:2px;">
                            Vacía permanentemente todas las ventas acumuladas de la base de datos.
                        </div>
                    </div>
                    <button type="button" class="btn btn-sm btn-danger" onclick="ejecutarLimpiezaVentas('todas')" ${ventas.length === 0 ? 'disabled' : ''} style="white-space:nowrap; font-weight:700;">
                        <i class="fas fa-skull-crossbones"></i> Vaciar Todo
                    </button>
                </div>
            </div>

            <div style="display:flex; justify-content:flex-end;">
                <button type="button" class="btn btn-outline" onclick="cerrarModalLimpiadorVentas()">Cancelar</button>
            </div>
        </div>
    `;

    modal.classList.add('active');
}

function cerrarModalLimpiadorVentas() {
    const modal = document.getElementById('modal-limpiador-ventas');
    if (modal) modal.classList.remove('active');
}

/**
 * Ejecuta la limpieza de ventas según el alcance seleccionado
 */
async function ejecutarLimpiezaVentas(tipo) {
    const ventas = AppState.ventas || [];
    const fechaHoy = obtenerFechaHoyISO();

    let ventasAEliminar = [];
    let tituloConfirm = '';
    let mensajeConfirm = '';

    if (tipo === 'hoy') {
        ventasAEliminar = ventas.filter(v => String(v.fecha || '').trim().startsWith(fechaHoy));
        if (ventasAEliminar.length === 0) {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Sin Ventas', 'No hay ventas registradas el día de hoy para limpiar.', 'info');
            } else {
                alert('No hay ventas registradas el día de hoy para limpiar.');
            }
            return;
        }
        tituloConfirm = 'Limpiar Ventas de Hoy';
        mensajeConfirm = `¿Confirmas que deseas eliminar las <b>${ventasAEliminar.length}</b> ventas registradas el día de hoy (${fechaHoy})?<br><br>Esta acción reiniciará los indicadores y la tabla de la jornada de hoy.`;
    } else if (tipo === 'todas') {
        ventasAEliminar = [...ventas];
        if (ventasAEliminar.length === 0) {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Historial Vacío', 'El historial de ventas ya se encuentra completamente vacío.', 'info');
            } else {
                alert('El historial de ventas ya se encuentra vacío.');
            }
            return;
        }
        tituloConfirm = 'Vaciar Todo el Historial de Ventas';
        mensajeConfirm = `⚠️ <b>ADVERTENCIA:</b> ¿Estás completamente seguro de que deseas eliminar las <b>${ventasAEliminar.length}</b> ventas de todo el historial acumulado?<br><br>Esta acción vaciará permanentemente las ventas del sistema y no se puede deshacer.`;
    }

    let confirmado = false;
    if (typeof showCustomConfirm === 'function') {
        confirmado = await showCustomConfirm(tituloConfirm, mensajeConfirm, tipo === 'todas' ? 'danger' : 'warning');
    } else {
        confirmado = confirm(mensajeConfirm.replace(/<[^>]+>/g, ''));
    }

    if (!confirmado) return;

    const idsAEliminar = ventasAEliminar.map(v => v.id);
    const cantEliminada = idsAEliminar.length;

    // 1. Filtrar en AppState.ventas
    if (tipo === 'todas') {
        AppState.ventas = [];
    } else {
        AppState.ventas = ventas.filter(v => !idsAEliminar.includes(v.id));
    }

    // Sincronizar variable global ventas si existe
    if (typeof window.ventas !== 'undefined' && Array.isArray(window.ventas)) {
        window.ventas = AppState.ventas;
    }

    // 2. Eliminar en Firestore si está conectado
    if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.eliminarVentas === 'function') {
        window.InventoryApp.Firebase.eliminarVentas(idsAEliminar).catch(err => {
            console.warn('[HistorialVentas] Error al sincronizar eliminación en Firestore:', err);
        });
    }

    // 3. Guardar persistencia local
    if (window.InventoryApp && window.InventoryApp.Persistence && typeof window.InventoryApp.Persistence.guardar === 'function') {
        window.InventoryApp.Persistence.guardar(true);
    }

    // 4. Cerrar modal y actualizar UI
    cerrarModalLimpiadorVentas();
    renderizarHistorialVentasAdmin();
    actualizarBadgeVentasHoy();

    if (typeof renderizarResumenPerdidasEconomicas === 'function') {
        renderizarResumenPerdidasEconomicas();
    }
    if (typeof window.actualizarResumenAuditoria === 'function') {
        window.actualizarResumenAuditoria();
    }

    if (typeof showCustomToast === 'function') {
        showCustomToast(`Se eliminaron ${cantEliminada} transacciones del historial de ventas`, 'success');
    }
}

/**
 * Actualiza el contador del badge de ventas de hoy
 */
function actualizarBadgeVentasHoy() {
    const ventas = AppState.ventas || [];
    const fechaHoy = obtenerFechaHoyISO();
    const ventasHoy = ventas.filter(v => String(v.fecha || '').trim().startsWith(fechaHoy));
    const badgeHoy = document.getElementById('badge-ventas-hoy-count');
    if (badgeHoy) {
        badgeHoy.textContent = ventasHoy.length;
    }
}

/**
 * Confirma una venta o transacción para que sus ganancias se sumen
 * inmediatamente a la barra de recuperación de pérdidas.
 */
async function confirmarVentaAdmin(ventaId, desdeModal = false) {
    const listadoVentas = Array.isArray(AppState.ventas)
        ? AppState.ventas
        : (typeof ventas !== 'undefined' && Array.isArray(ventas) ? ventas : []);

    const venta = listadoVentas.find(v => v.id === ventaId);
    if (!venta) return;

    let confirmado = false;
    const totalStr = `$${Number(venta.total || 0).toFixed(2)}`;
    const msg = `¿Confirmar la transacción <b>#${venta.id}</b> (${totalStr})?<br><br>` +
        `Al confirmarla, sus ganancias se incorporarán de inmediato a la <b>barra de recuperación de pérdidas</b>.`;

    if (typeof showCustomConfirm === 'function') {
        confirmado = await showCustomConfirm('Confirmar Transacción', msg, 'question');
    } else {
        confirmado = confirm(`¿Confirmar la venta #${venta.id} (${totalStr}) para sumar sus ganancias a la recuperación?`);
    }

    if (!confirmado) return;

    // Actualizar estado de la venta
    venta.estado = 'CONFIRMADO';
    venta.confirmada = true;
    venta.pendiente = false;

    // Actualizar transacción asociada si existe
    const ref = String(venta.referencia || '').trim();
    const listadoTx = Array.isArray(AppState.transacciones)
        ? AppState.transacciones
        : (typeof transacciones !== 'undefined' && Array.isArray(transacciones) ? transacciones : []);

    const tx = listadoTx.find(t =>
        (t.id && (t.id === venta.id || t.pedidoId === venta.id)) ||
        (t.pedidoId && t.pedidoId === venta.id) ||
        (ref && ref !== 'N/A' && t.referencia === ref)
    );
    if (tx) {
        tx.estado = 'Pago agregado';
        tx.verificando = false;
    }

    // Actualizar registro en PagosPorVerificar de Firestore/AppState si existe
    const listadoPagos = Array.isArray(AppState.pagosPorVerificar) ? AppState.pagosPorVerificar : [];
    const pago = listadoPagos.find(p =>
        p.id === venta.id || p.ventaId === venta.id || p.pedidoId === venta.id ||
        (ref && ref !== 'N/A' && p.referencia === ref)
    );
    if (pago) {
        pago.estado = 'APROBADO';
    }

    // Guardar persistencia local
    if (window.InventoryApp?.Persistence?.guardar) {
        window.InventoryApp.Persistence.guardar(true);
    }

    // Sincronizar en Firebase Firestore
    if (window.InventoryApp?.Firebase) {
        if (typeof window.InventoryApp.Firebase.actualizarEstadoVenta === 'function') {
            window.InventoryApp.Firebase.actualizarEstadoVenta(venta.id, 'CONFIRMADO').catch(() => {});
        }
        if (tx && typeof window.InventoryApp.Firebase.actualizarEstadoTransaccion === 'function') {
            window.InventoryApp.Firebase.actualizarEstadoTransaccion(tx.id, 'Pago agregado').catch(() => {});
        }
        if (pago && typeof window.InventoryApp.Firebase.actualizarEstadoPagoPorVerificar === 'function') {
            window.InventoryApp.Firebase.actualizarEstadoPagoPorVerificar(pago.id, 'APROBADO').catch(() => {});
        }
    }

    // Re-renderizar vistas afectadas
    if (typeof renderizarHistorialVentasAdmin === 'function') renderizarHistorialVentasAdmin();
    if (typeof renderizarResumenPerdidasEconomicas === 'function') renderizarResumenPerdidasEconomicas();
    if (typeof renderizarTransacciones === 'function') renderizarTransacciones();

    if (desdeModal) {
        abrirModalDetalleVenta(venta.id);
    }

    if (typeof showCustomToast === 'function') {
        showCustomToast(`Transacción #${venta.id} confirmada exitosamente. Ganancias aplicadas a la recuperación.`, 'success');
    }
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
window.confirmarVentaAdmin = confirmarVentaAdmin;
window.abrirModalLimpiadorVentas = abrirModalLimpiadorVentas;
window.cerrarModalLimpiadorVentas = cerrarModalLimpiadorVentas;
window.ejecutarLimpiezaVentas = ejecutarLimpiezaVentas;
window.actualizarBadgeVentasHoy = actualizarBadgeVentasHoy;
