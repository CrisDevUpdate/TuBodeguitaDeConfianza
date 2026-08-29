/**
 * modules/cliente-view.js
 * Módulo de Experiencia del Cliente: Catálogo Visual, Carrito, Estado de Cuenta y Deudas
 * Cero acceso a inventario administrativo, costos o proveedores.
 */

window.InventoryApp = window.InventoryApp || {};

let clienteFiltroCategoria = 'TODAS';
let clienteBusqueda = '';

/**
 * Renderiza el Catálogo de Productos para la Vista de Cliente
 */
function renderizarCatalogoCliente() {
    const container = document.getElementById('cliente-catalogo-grid');
    if (!container) return;

    let prods = AppState.productos || [];

    // Filtros
    if (clienteBusqueda) {
        const q = clienteBusqueda.toLowerCase();
        prods = prods.filter(p => (p.nombre || '').toLowerCase().includes(q) || (p.codigo || '').toLowerCase().includes(q) || (p.categoria || '').toLowerCase().includes(q));
    }
    if (clienteFiltroCategoria && clienteFiltroCategoria !== 'TODAS') {
        prods = prods.filter(p => (p.categoria || 'General').toUpperCase() === clienteFiltroCategoria.toUpperCase());
    }

    if (prods.length === 0) {
        container.innerHTML = `
            <div class="empty-state-card" style="grid-column: 1 / -1; text-align:center; padding:40px 20px;">
                <i class="fas fa-box-open" style="font-size:2.5rem; color:var(--text-muted); margin-bottom:12px;"></i>
                <h4>No se encontraron productos disponibles</h4>
                <p style="color:var(--text-muted); font-size:0.9rem;">Prueba con otra búsqueda o categoría en el catálogo.</p>
            </div>
        `;
        return;
    }

    const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 0);

    container.innerHTML = prods.map(p => {
        const precioUSD = Number(p.precio || 0);
        const precioVES = tasa > 0 ? (precioUSD * tasa) : 0;
        const stock = Number(p.stock || 0);
        const agotado = stock <= 0;
        const imagenSrc = p.imagen || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=60';

        return `
            <div class="cliente-prod-card ${agotado ? 'card-agotado' : ''}" id="cli-card-${p.id}">
                <div class="cliente-prod-img-wrapper">
                    <img src="${imagenSrc}" alt="${p.nombre}" class="cliente-prod-img" onerror="this.src='https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=60'">
                    <span class="cliente-prod-badge-cat">${p.categoria || 'General'}</span>
                    ${agotado ? '<span class="badge-agotado-pill">Agotado</span>' : `<span class="badge-stock-pill">${stock} Disp.</span>`}
                </div>
                <div class="cliente-prod-body">
                    <span class="cliente-prod-code">Cód: ${p.codigo || p.id}</span>
                    <h4 class="cliente-prod-title">${p.nombre}</h4>
                    
                    <div class="cliente-prod-prices">
                        <div class="price-usd">$${precioUSD.toFixed(2)}</div>
                        <div class="price-ves">Bs. ${precioVES > 0 ? precioVES.toFixed(2) : '—'}</div>
                    </div>

                    <button type="button" class="btn btn-block ${agotado ? 'btn-secondary' : 'btn-primary'} cliente-btn-add" 
                        onclick="agregarAlCarritoCliente('${p.id}')" ${agotado ? 'disabled' : ''}>
                        <i class="fas fa-cart-plus"></i> ${agotado ? 'Sin Existencia' : 'Agregar al Carrito'}
                    </button>
                </div>
            </div>
        `;
    }).join('');

    renderizarCategoriasCatalogo();
}

/**
 * Renderiza los botones de categorías en el catálogo del cliente
 */
function renderizarCategoriasCatalogo() {
    const container = document.getElementById('cliente-catalogo-cats');
    if (!container) return;

    const catsSet = new Set(['TODAS']);
    (AppState.productos || []).forEach(p => {
        if (p.categoria) catsSet.add(p.categoria.toUpperCase());
    });

    const cats = Array.from(catsSet);
    container.innerHTML = cats.map(cat => `
        <button type="button" class="chip-filter ${clienteFiltroCategoria === cat ? 'active' : ''}" onclick="filtrarCatalogoClienteCategoria('${cat}')">
            ${cat === 'TODAS' ? '🌟 Todas' : cat}
        </button>
    `).join('');
}

function filtrarCatalogoClienteCategoria(cat) {
    clienteFiltroCategoria = cat;
    renderizarCatalogoCliente();
}

function buscarEnCatalogoCliente(val) {
    clienteBusqueda = val;
    renderizarCatalogoCliente();
}

/**
 * Agrega un producto al carrito del cliente
 */
function agregarAlCarritoCliente(id) {
    const p = (AppState.productos || []).find(prod => prod.id === id);
    if (!p || Number(p.stock || 0) <= 0) {
        alert('Producto no disponible.');
        return;
    }

    if (!Array.isArray(AppState.carrito)) {
        AppState.carrito = [];
    }

    const itemEnCarrito = AppState.carrito.find(item => item.productoId === id);

    if (itemEnCarrito) {
        if (itemEnCarrito.cantidad < Number(p.stock || 0)) {
            itemEnCarrito.cantidad++;
        } else {
            alert(`Stock máximo disponible alcanzado (${p.stock} unid).`);
            return;
        }
    } else {
        AppState.carrito.push({
            productoId: id,
            nombre: p.nombre,
            precio: Number(p.precio || 0),
            cantidad: 1
        });
    }

    renderizarCarritoCliente();
    renderizarPosProductos();
    renderizarCarrito(); // sync admin pos carrito
}

/**
 * Renderiza el carrito para la vista de cliente
 */
function renderizarCarritoCliente() {
    const tbody = document.getElementById('cliente-carrito-body');
    const badgeCount = document.getElementById('cliente-carrito-count');
    const totalUsdEl = document.getElementById('cliente-carrito-total-usd');
    const totalVesEl = document.getElementById('cliente-carrito-total-ves');
    const ptsPreviewEl = document.getElementById('cliente-carrito-puntos-preview');

    const carrito = AppState.carrito || [];
    let totalUSD = 0;
    let cantTotal = 0;

    if (tbody) {
        if (carrito.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">Tu carrito está vacío. ¡Selecciona productos del catálogo!</td></tr>`;
        } else {
            tbody.innerHTML = carrito.map((item, idx) => {
                const subtotal = item.cantidad * item.precio;
                totalUSD += subtotal;
                cantTotal += item.cantidad;
                return `
                    <tr>
                        <td>
                            <strong>${item.nombre}</strong><br>
                            <small style="color:var(--text-muted);">$${item.precio.toFixed(2)} c/u</small>
                        </td>
                        <td class="num" style="white-space:nowrap;">
                            <button type="button" class="btn-qty" onclick="modificarCantidadCarritoCliente(${idx}, -1)">-</button>
                            <span style="display:inline-block; min-width:20px; font-weight:700;">${item.cantidad}</span>
                            <button type="button" class="btn-qty" onclick="modificarCantidadCarritoCliente(${idx}, 1)">+</button>
                        </td>
                        <td class="num font-bold">$${subtotal.toFixed(2)}</td>
                        <td>
                            <button type="button" class="btn btn-sm btn-danger" onclick="eliminarDelCarritoCliente(${idx})"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 0);
    const totalVES = tasa > 0 ? (totalUSD * tasa) : 0;
    const ptsPorDolar = Number(AppState.premioMes?.puntosPorDolar || 1);
    const ptsGanables = Math.floor(totalUSD * ptsPorDolar);

    if (badgeCount) badgeCount.textContent = cantTotal;
    if (totalUsdEl) totalUsdEl.textContent = `$${totalUSD.toFixed(2)}`;
    if (totalVesEl) totalVesEl.textContent = `Bs. ${totalVES > 0 ? totalVES.toFixed(2) : '—'}`;
    if (ptsPreviewEl) ptsPreviewEl.textContent = `+${ptsGanables} Pts`;
}

function modificarCantidadCarritoCliente(idx, delta) {
    const item = AppState.carrito[idx];
    if (!item) return;

    const producto = (AppState.productos || []).find(p => p.id === item.productoId);
    const nuevaCant = item.cantidad + delta;

    if (nuevaCant <= 0) {
        AppState.carrito.splice(idx, 1);
    } else if (producto && nuevaCant > Number(producto.stock || 0)) {
        alert(`Stock máximo disponible alcanzado (${producto.stock}).`);
        return;
    } else {
        item.cantidad = nuevaCant;
    }

    renderizarCarritoCliente();
    renderizarCarrito();
}

function eliminarDelCarritoCliente(idx) {
    AppState.carrito.splice(idx, 1);
    renderizarCarritoCliente();
    renderizarCarrito();
}

function vaciarCarritoCliente() {
    AppState.carrito = [];
    renderizarCarritoCliente();
    renderizarCarrito();
}

/**
 * Procesa la compra / pedido desde la vista del Cliente
 */
function procesarCompraCliente() {
    const usuario = AppState.usuarioActual;
    if (!usuario || usuario.estado !== 'ACTIVO') {
        alert('Debes tener una cuenta ACTIVA y aprobada para realizar pedidos.');
        return;
    }

    const carrito = AppState.carrito || [];
    if (carrito.length === 0) {
        alert('Tu carrito está vacío. Agrega productos del catálogo para continuar.');
        return;
    }

    const tipoPagoSelect = document.getElementById('cliente-tipo-pago');
    const tipoPago = tipoPagoSelect ? tipoPagoSelect.value : 'Contado';
    const totalUSD = carrito.reduce((sum, item) => sum + (item.cantidad * item.precio), 0);

    // Validar existencias
    for (const item of carrito) {
        const prod = (AppState.productos || []).find(p => p.id === item.productoId);
        if (!prod || Number(item.cantidad) > Number(prod.stock || 0)) {
            alert(`Stock insuficiente para el producto "${item.nombre}". Pedido cancelado.`);
            return;
        }
    }

    // Descontar inventario
    for (const item of carrito) {
        if (window.InventoryApp.StockService) {
            window.InventoryApp.StockService.sale(item.productoId, item.cantidad);
        }
    }

    const itemsVendidos = carrito.map(item => {
        const prod = (AppState.productos || []).find(p => p.id === item.productoId);
        return {
            ...item,
            costo: Number(prod?.costo || 0)
        };
    });

    const clienteCedula = usuario.cedula || usuario.id;

    // Asegurar que el usuario esté en clientes
    if (Array.isArray(AppState.clientes) && !AppState.clientes.find(c => c.id === clienteCedula)) {
        AppState.clientes.push({
            id: clienteCedula,
            nombre: usuario.nombre,
            telefono: usuario.telefono || ''
        });
    }

    // Crear venta
    const nuevaVenta = {
        id: "PED_" + (AppState.ventas.length + 1) + "_" + Date.now().toString().slice(-4),
        clienteId: clienteCedula,
        vendedorId: clienteCedula,
        vendedorNombre: usuario.nombre,
        fecha: new Date().toISOString().replace('T', ' ').substring(0, 16),
        items: itemsVendidos,
        total: totalUSD,
        tipo: tipoPago
    };

    AppState.ventas.push(nuevaVenta);

    // Gamificación: Si la compra es de Contado, otorgar puntos de inmediato
    let puntosGanados = 0;
    if (tipoPago === 'Contado') {
        puntosGanados = otorgarPuntosPorCompra(clienteCedula, totalUSD, 'Compra en Línea');
    }

    // Sincronizar en Firebase y LocalStorage
    if (window.InventoryApp.Persistence && typeof window.InventoryApp.Persistence.guardar === 'function') {
        window.InventoryApp.Persistence.guardar(true);
    }
    if (window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.registrarVenta === 'function') {
        window.InventoryApp.Firebase.registrarVenta(nuevaVenta, itemsVendidos).catch(e => console.warn(e));
    }

    AppState.carrito = [];
    renderizarCarritoCliente();
    renderizarCatalogoCliente();
    renderizarEstadoCuentaCliente();
    renderizarPremioMesCliente();

    // Mensaje de confirmación
    if (tipoPago === 'Contado') {
        alert(`🎉 ¡Compra procesada con éxito!\n\nNúmero de Ticket: #${nuevaVenta.id}\nTotal: $${totalUSD.toFixed(2)}\n⭐ ¡Has ganado +${puntosGanados} PUNTOS para el Premio del Mes!`);
    } else {
        alert(`📋 ¡Pedido a Crédito registrado!\n\nNúmero de Ticket: #${nuevaVenta.id}\nTotal a Pagar: $${totalUSD.toFixed(2)}\nRecuerda que tus puntos se activarán automáticamente al cancelar la deuda.`);
    }
}

/**
 * Renderiza la sección personal de Estado de Cuenta & Deudas del Cliente
 */
function renderizarEstadoCuentaCliente() {
    const usuario = AppState.usuarioActual;
    if (!usuario) return;

    const cedula = usuario.cedula || usuario.id;
    const ventasCliente = (AppState.ventas || []).filter(v => v.clienteId === cedula);
    const abonosCliente = (AppState.abonos || []).filter(a => a.clienteId === cedula && (a.estado === 'Pago agregado' || !a.estado));

    const totalCompradoUSD = ventasCliente.reduce((sum, v) => sum + Number(v.total || 0), 0);
    const totalCreditoUSD = ventasCliente.filter(v => v.tipo === 'Crédito').reduce((sum, v) => sum + Number(v.total || 0), 0);
    const totalAbonadoUSD = abonosCliente.reduce((sum, a) => sum + Number(a.montoUSD || 0), 0);
    const saldoDeudaUSD = Math.max(0, totalCreditoUSD - totalAbonadoUSD);

    const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 0);
    const saldoDeudaVES = tasa > 0 ? (saldoDeudaUSD * tasa) : 0;
    const totalCompradoVES = tasa > 0 ? (totalCompradoUSD * tasa) : 0;

    // Resumen KPIs
    const kpiTotalComprado = document.getElementById('cli-kpi-total-comprado');
    const kpiDeudaUsd = document.getElementById('cli-kpi-deuda-usd');
    const kpiDeudaVes = document.getElementById('cli-kpi-deuda-ves');
    const kpiTotalAbonado = document.getElementById('cli-kpi-total-abonado');
    const kpiFacturasTotal = document.getElementById('cli-kpi-facturas-total');

    if (kpiTotalComprado) kpiTotalComprado.textContent = `$${totalCompradoUSD.toFixed(2)}`;
    if (kpiDeudaUsd) kpiDeudaUsd.textContent = `$${saldoDeudaUSD.toFixed(2)}`;
    if (kpiDeudaVes) kpiDeudaVes.textContent = `Bs. ${saldoDeudaVES > 0 ? saldoDeudaVES.toFixed(2) : '—'}`;
    if (kpiTotalAbonado) kpiTotalAbonado.textContent = `$${totalAbonadoUSD.toFixed(2)}`;
    if (kpiFacturasTotal) kpiFacturasTotal.textContent = ventasCliente.length;

    // Tabla de Compras & Facturas
    const tbodyVentas = document.getElementById('cli-historial-compras-body');
    if (tbodyVentas) {
        if (ventasCliente.length === 0) {
            tbodyVentas.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">Aún no tienes compras registradas en el sistema.</td></tr>`;
        } else {
            tbodyVentas.innerHTML = ventasCliente.slice().reverse().map(v => {
                const totalUSD = Number(v.total || 0);
                const itemsStr = (v.items || []).map(i => `${i.cantidad}x ${i.nombre}`).join(', ');
                const esCredito = v.tipo === 'Crédito';
                const statusBadge = esCredito 
                    ? (saldoDeudaUSD > 0 ? '<span class="badge-status badge-warning"><i class="fas fa-clock"></i> Pendiente</span>' : '<span class="badge-status badge-active"><i class="fas fa-check"></i> Cancelado</span>')
                    : '<span class="badge-status badge-active"><i class="fas fa-check"></i> Contado</span>';

                return `
                    <tr>
                        <td><strong>#${v.id}</strong></td>
                        <td>${v.fecha}</td>
                        <td style="max-width:240px; font-size:0.85rem;" title="${itemsStr}">
                            ${itemsStr || 'Venta de productos'}
                        </td>
                        <td><span class="badge-status-pill ${esCredito ? 'badge-warning' : 'badge-success'}">${v.tipo}</span></td>
                        <td class="num font-bold">$${totalUSD.toFixed(2)}</td>
                        <td>${statusBadge}</td>
                    </tr>
                `;
            }).join('');
        }
    }

    // Tabla de Abonos realizados
    const tbodyAbonos = document.getElementById('cli-historial-abonos-body');
    if (tbodyAbonos) {
        if (abonosCliente.length === 0) {
            tbodyAbonos.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:16px; color:var(--text-muted);">Sin abonos de pago registrados.</td></tr>`;
        } else {
            tbodyAbonos.innerHTML = abonosCliente.slice().reverse().map(a => `
                <tr>
                    <td>${a.fecha}</td>
                    <td>${a.formaPago || 'Transferencia / Pago Móvil'}</td>
                    <td>${a.referencia || 'N/A'}</td>
                    <td class="num font-bold" style="color:var(--success);">$${Number(a.montoUSD || 0).toFixed(2)}</td>
                    <td><span class="badge-status badge-active"><i class="fas fa-check"></i> Aprobado</span></td>
                </tr>
            `).join('');
        }
    }
}

// Exportar a la ventana global
window.renderizarCatalogoCliente = renderizarCatalogoCliente;
window.renderizarCategoriasCatalogo = renderizarCategoriasCatalogo;
window.filtrarCatalogoClienteCategoria = filtrarCatalogoClienteCategoria;
window.buscarEnCatalogoCliente = buscarEnCatalogoCliente;
window.agregarAlCarritoCliente = agregarAlCarritoCliente;
window.renderizarCarritoCliente = renderizarCarritoCliente;
window.modificarCantidadCarritoCliente = modificarCantidadCarritoCliente;
window.eliminarDelCarritoCliente = eliminarDelCarritoCliente;
window.vaciarCarritoCliente = vaciarCarritoCliente;
window.procesarCompraCliente = procesarCompraCliente;
window.renderizarEstadoCuentaCliente = renderizarEstadoCuentaCliente;
