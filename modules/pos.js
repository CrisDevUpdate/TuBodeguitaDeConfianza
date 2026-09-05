// --- POS MULTIMONEDA ---
function renderizarPosProductos(filtro = "") {
    const tbody = document.getElementById('pos-productos-body');
    const filtrados = productos.filter(p => 
        p.nombre.toLowerCase().includes(filtro.toLowerCase()) || 
        p.codigo.toLowerCase().includes(filtro.toLowerCase())
    );

    tbody.innerHTML = filtrados.map(p => `
        <tr>
            <td>${p.codigo}</td>
            <td>${p.nombre}</td>
            <td class="num">$${p.precio.toFixed(2)}</td>
            <td class="num">Bs. ${tasaActiva > 0 ? (p.precio * tasaActiva).toFixed(2) : '—'}</td>
            <td class="num">${p.stock}</td>
            <td>
                <button class="btn" onclick="agregarAlCarrito('${p.id}')" ${p.stock <= 0 ? 'disabled' : ''}>
                    ${p.stock > 0 ? '+ Agregar' : 'Agotado'}
                </button>
            </td>
        </tr>
    `).join('');
}

function filtrarPosProductos() {
    renderizarPosProductos(document.getElementById('pos-search').value);
}

function agregarAlCarrito(id) {
    const p = productos.find(prod => prod.id === id);
    const itemEnCarrito = carrito.find(item => item.productoId === id);

    if (itemEnCarrito) {
        if (itemEnCarrito.cantidad < p.stock) itemEnCarrito.cantidad++;
        else alert("Stock máximo alcanzado");
    } else {
        carrito.push({ productoId: id, nombre: p.nombre, precio: p.precio, cantidad: 1 });
    }
    renderizarCarrito();
}

function renderizarCarrito() {
    const tbody = document.getElementById('pos-carrito-body');
    let totalUSD = 0;

    tbody.innerHTML = carrito.map((item, idx) => {
        const subtotal = item.cantidad * item.precio;
        totalUSD += subtotal;
        return `
            <tr>
                <td>${item.nombre}</td>
                <td class="num">${item.cantidad}</td>
                <td class="num">$${subtotal.toFixed(2)}</td>
                <td><button class="btn btn-danger" onclick="eliminarDelCarrito(${idx})">X</button></td>
            </tr>
        `;
    }).join('');

    document.getElementById('pos-total-usd').textContent = `$${totalUSD.toFixed(2)}`;
    document.getElementById('pos-total-ves').textContent = `Bs. ${tasaActiva > 0 ? (totalUSD * tasaActiva).toFixed(2) : '—'}`;
}

function eliminarDelCarrito(idx) {
    carrito.splice(idx, 1);
    renderizarCarrito();
}

function procesarVenta() {
    // Guardia de Control de Acceso y Aprobación de Usuarios
    if (typeof verificarAccesoPOS === 'function') {
        const acceso = verificarAccesoPOS(true);
        if (!acceso.permitido) {
            return; // Bloqueado: PENDIENTE_APROBACION, RECHAZADO o SIN_SESION
        }
    }

    if (carrito.length === 0) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Carrito Vacío', 'Agrega al menos un producto al carrito para procesar la venta.', 'warning');
        } else {
            alert('El carrito está vacío');
        }
        return;
    }

    // Prevalidamos todo el carrito antes de abrir el checkout
    for (const item of carrito) {
        const producto = productos.find(p => p.id === item.productoId);
        if (!producto || Number(item.cantidad) <= 0 || Number(item.cantidad) > Number(producto.stock || 0)) {
            const msg = `Stock insuficiente para ${item.nombre}. Stock disponible: ${producto ? producto.stock : 0}.`;
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Stock Insuficiente', msg, 'warning');
            } else {
                alert(msg);
            }
            return;
        }
    }

    abrirModalCheckoutPOS();
}

/**
 * Abre el Modal Unificado de Checkout para POS (Admin / Vendedor)
 */
function abrirModalCheckoutPOS() {
    let modal = document.getElementById('modal-pos-checkout-unificado');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-pos-checkout-unificado';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    const clienteIdSelect = document.getElementById('pos-cliente-select');
    const clienteId = clienteIdSelect ? clienteIdSelect.value : (clientes[0]?.id || 'V-00000000');
    const clienteObj = clientes.find(c => c.id === clienteId) || { id: clienteId, nombre: 'Cliente de Mostrador' };

    const totalUSD = carrito.reduce((sum, i) => sum + (i.cantidad * i.precio), 0);
    const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 0);
    const totalVES = tasa > 0 ? (totalUSD * tasa) : 0;
    const ptsPorDolar = Number(AppState.premioMes?.puntosPorDolar || 1);
    const temporadaActiva = AppState.premioMes?.temporadaActiva !== false;
    const ptsEstimados = temporadaActiva ? Math.floor(totalUSD * ptsPorDolar) : 0;

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 520px; animation: modalPop 0.25s ease-out;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid var(--border); padding-bottom:10px;">
                <h3 style="margin:0; font-size:1.25rem; display:flex; align-items:center; gap:8px; color:var(--text-main);">
                    <i class="fas fa-cash-register" style="color:var(--primary-accent);"></i> Confirmación de Checkout POS
                </h3>
                <button type="button" class="btn-icon-tasa" onclick="cerrarModalCheckoutPOS()"><i class="fas fa-times"></i></button>
            </div>

            <!-- Resumen de Cliente y Montos -->
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:14px; margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                    <span style="color:var(--text-muted); font-size:0.88rem;">Cliente Asignado:</span>
                    <strong>${clienteObj.nombre} (${clienteObj.id})</strong>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                    <span style="color:var(--text-muted); font-size:0.88rem;">Total Artículos:</span>
                    <strong>${carrito.reduce((s, i) => s + i.cantidad, 0)} unidades</strong>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                    <span style="color:var(--text-muted); font-size:0.88rem;">Total a Cobrar (USD):</span>
                    <strong style="color:var(--primary-accent); font-size:1.2rem;">$${totalUSD.toFixed(2)}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; border-top:1px dashed #cbd5e1; padding-top:6px;">
                    <span style="color:var(--text-muted); font-size:0.88rem;">Total en Bolívares (VES):</span>
                    <strong style="color:#16a34a; font-size:1.1rem;">Bs. ${totalVES > 0 ? totalVES.toFixed(2) : '—'}</strong>
                </div>
                ${temporadaActiva ? `
                <div style="display:flex; justify-content:space-between; margin-top:6px; font-size:0.82rem; color:#d97706;">
                    <span><i class="fas fa-star"></i> Puntos Premio del Mes:</span>
                    <strong>+${ptsEstimados} Pts</strong>
                </div>` : ''}
            </div>

            <!-- Formulario de Checkout Unificado -->
            <form onsubmit="event.preventDefault(); ejecutarFinalizacionCheckoutPOS();">
                <div class="form-group" style="margin-bottom:12px;">
                    <label for="pos-checkout-metodo">Método de Pago <span style="color:var(--danger);">*</span></label>
                    <select id="pos-checkout-metodo" required onchange="manejarCambioMetodoPOS(this.value)">
                        <option value="Efectivo USD">Efectivo ($ Dólares)</option>
                        <option value="Efectivo VES">Efectivo (Bs. Bolívares)</option>
                        <option value="Pago Móvil VES">Pago Móvil (Bolívares VES)</option>
                        <option value="Transferencia Bancaria VES">Transferencia Bancaria (Bolívares VES)</option>
                        <option value="Crédito">Crédito / Fiado (Cuenta Corriente)</option>
                    </select>
                </div>

                <div class="form-group" id="pos-checkout-grupo-ref" style="margin-bottom:12px;">
                    <label for="pos-checkout-referencia" id="pos-checkout-label-ref">
                        Referencia Bancaria <span id="pos-ref-required-mark" style="display:none; color:var(--danger);">*</span>
                    </label>
                    <input type="text" id="pos-checkout-referencia" placeholder="Ej: 894521 (Últimos 4-6 dígitos)">
                </div>

                <div class="form-group" style="margin-bottom:16px;">
                    <label for="pos-checkout-estado">Estado de la Transacción</label>
                    <select id="pos-checkout-estado">
                        <option value="CONFIRMADO" selected>CONFIRMADO / PAGADO</option>
                        <option value="PENDIENTE">PENDIENTE DE REVISIÓN</option>
                    </select>
                </div>

                <div style="display:flex; justify-content:flex-end; gap:10px;">
                    <button type="button" class="btn btn-outline" onclick="cerrarModalCheckoutPOS()">Cancelar</button>
                    <button type="submit" class="btn btn-success" style="font-weight:700; padding:10px 20px;">
                        <i class="fas fa-check"></i> Asentar Venta & Débito
                    </button>
                </div>
            </form>
        </div>
    `;

    modal.classList.add('active');
}

function manejarCambioMetodoPOS(metodo) {
    const mark = document.getElementById('pos-ref-required-mark');
    const inputRef = document.getElementById('pos-checkout-referencia');
    const requiereRef = (metodo === 'Pago Móvil VES' || metodo === 'Transferencia Bancaria VES');

    if (mark) mark.style.display = requiereRef ? 'inline' : 'none';
    if (inputRef) inputRef.required = requiereRef;
}

function cerrarModalCheckoutPOS() {
    const modal = document.getElementById('modal-pos-checkout-unificado');
    if (modal) modal.classList.remove('active');
}

async function ejecutarFinalizacionCheckoutPOS() {
    const clienteIdSelect = document.getElementById('pos-cliente-select');
    const clienteId = clienteIdSelect ? clienteIdSelect.value : (clientes[0]?.id || 'V-00000000');
    const metodoPago = document.getElementById('pos-checkout-metodo')?.value || 'Efectivo USD';
    const referencia = (document.getElementById('pos-checkout-referencia')?.value || '').trim();
    const estadoTransaccion = document.getElementById('pos-checkout-estado')?.value || 'CONFIRMADO';

    const requiereRef = (metodoPago === 'Pago Móvil VES' || metodoPago === 'Transferencia Bancaria VES');
    if (requiereRef && !referencia) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Referencia Obligatoria', 'Debes ingresar el número de referencia para transacciones bancarias.', 'warning');
        } else {
            alert('Debes ingresar la referencia bancaria.');
        }
        return;
    }

    const total = carrito.reduce((sum, i) => sum + (i.cantidad * i.precio), 0);
    const clienteObj = clientes.find(c => c.id === clienteId) || { id: clienteId, nombre: 'Cliente de Mostrador' };
    const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 0);
    const totalVES = tasa > 0 ? (total * tasa) : 0;

    // Prevalidación de stock atómica
    for (const item of carrito) {
        const producto = productos.find(p => p.id === item.productoId);
        if (!producto || Number(item.cantidad) <= 0 || Number(item.cantidad) > Number(producto.stock || 0)) {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Stock Insuficiente', `Stock insuficiente para ${item.nombre}. Operación cancelada.`, 'warning');
            }
            cerrarModalCheckoutPOS();
            return;
        }
    }

    // Débito atómico de inventario
    for (const item of carrito) {
        InventoryApp.StockService.sale(item.productoId, item.cantidad);
    }

    const itemsVendidos = carrito.map(item => {
        const producto = productos.find(p => p.id === item.productoId);
        return { ...item, costo: Number(producto?.costo || item.costo || 0) };
    });

    const vendedor = AppState.usuarioActual || { cedula: 'SuperAdmin', nombre: 'SuperAdmin' };

    const nuevaVenta = {
        id: "V" + (ventas.length + 1) + "_" + Date.now().toString().slice(-4),
        clienteId: clienteId,
        vendedorId: vendedor.cedula || vendedor.id || '',
        vendedorNombre: vendedor.nombre || '',
        fecha: new Date().toISOString().replace('T', ' ').substring(0, 16),
        items: itemsVendidos,
        total: total,
        tipo: metodoPago === 'Crédito' ? 'Crédito' : 'Contado',
        metodoDetalle: metodoPago,
        referencia: referencia || 'N/A',
        estado: estadoTransaccion
    };

    ventas.push(nuevaVenta);

    // Si la venta es a Crédito, asegurar registro en estado de cuenta de cliente
    if (metodoPago === 'Crédito') {
        const clienteExistente = clientes.find(c => c.id === clienteId);
        if (clienteExistente) {
            clienteExistente.deudaUSD = Number(clienteExistente.deudaUSD || 0) + total;
            if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarCliente === 'function') {
                window.InventoryApp.Firebase.guardarCliente(clienteExistente).catch(() => {});
            }
        }
    }

    // Fidelización y Gamificación: Otorgar puntos si aplica
    let puntosGanados = 0;
    const temporadaActiva = AppState.premioMes?.temporadaActiva !== false;
    if (temporadaActiva && (metodoPago !== 'Crédito') && typeof otorgarPuntosPorCompra === 'function') {
        puntosGanados = otorgarPuntosPorCompra(clienteId, total, 'Venta POS Contado');
    }

    // Sincronizar con Firebase Firestore
    if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.registrarVenta === 'function') {
        window.InventoryApp.Firebase.registrarVenta(nuevaVenta, itemsVendidos).catch(err => {
            console.warn('[POS] Error al registrar venta en Firestore:', err);
        });
    }

    // Sincronizar en el Centro de Notificaciones y PagosPorVerificar de Firestore
    if (metodoPago === 'Crédito') {
        // Las transacciones a crédito NO requieren verificación/aprobación.
        // Se refleja de inmediato en el Centro de Notificaciones:
        if (typeof window.registrarNotificacion === 'function') {
            window.registrarNotificacion({
                tipo: 'credito',
                titulo: 'Crédito Concedido',
                mensaje: `${clienteObj ? clienteObj.nombre : clienteId} sacó un crédito por $${Number(total).toFixed(2)} (Venta POS #${nuevaVenta.id})`,
                clienteId: clienteId,
                clienteNombre: clienteObj ? clienteObj.nombre : clienteId,
                montoUSD: Number(total),
                montoVES: Number(totalVES),
                referenciaId: nuevaVenta.id,
                destino: {
                    tab: 'clientes',
                    subAccion: 'verCliente',
                    clienteId: clienteId,
                    idRef: nuevaVenta.id
                }
            });
        }
    } else {
        // Solo registrar en PagosPorVerificar si requiere validación bancaria o pago
        if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarPagoPorVerificar === 'function') {
            window.InventoryApp.Firebase.guardarPagoPorVerificar({
                id: nuevaVenta.id,
                pedidoId: nuevaVenta.id,
                ventaId: nuevaVenta.id,
                clienteId: clienteId,
                clienteNombre: clienteObj ? clienteObj.nombre : clienteId,
                clienteCedula: clienteObj ? (clienteObj.cedula || clienteObj.id) : clienteId,
                totalUSD: total,
                montoUSD: total,
                totalVES: totalVES,
                montoVES: totalVES,
                metodoPago: metodoPago,
                tipoPago: metodoPago,
                tipo: metodoPago,
                referencia: referencia || (metodoPago.includes('Efectivo') ? 'Efectivo en caja POS' : 'N/A'),
                items: itemsVendidos,
                fecha: nuevaVenta.fecha,
                fechaISO: new Date().toISOString(),
                estado: 'PENDIENTE_VERIFICACION',
                tipoRegistro: 'VENTA_POS',
                origen: 'POS Mostrador'
            }).catch(() => {});
        }
    }

    // Sincronizar con backend local si está disponible
    try {
        fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clienteId,
                totalUSD: total,
                nuevaVentaId: nuevaVenta.id
            })
        }).catch(() => {});
    } catch {}

    carrito = [];
    cerrarModalCheckoutPOS();
    renderizarCarrito();
    renderizarPosProductos();
    renderizarInventario();
    renderizarClientes();
    renderizarAuditoria(document.getElementById('auditoria-search') ? document.getElementById('auditoria-search').value : "");
    renderizarResumenPerdidasEconomicas();

    if (typeof showCustomToast === 'function') {
        showCustomToast(`Venta #${nuevaVenta.id} completada exitosamente ($${total.toFixed(2)})`, 'success');
    }

    if (puntosGanados > 0 && typeof showCustomAlert === 'function') {
        showCustomAlert('¡Transacción Asentada!', `La venta fue procesada con éxito.\n⭐ ¡El cliente acumuló +${puntosGanados} puntos para el Premio del Mes!`, 'success');
    }
}

// --- CLIENTES Y DEUDAS MULTIMONEDA ---
