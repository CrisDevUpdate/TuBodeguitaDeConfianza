/**
 * components/Checkout.js
 * MÓDULO 6: Componente de Checkout POS & Scroll Vertical Independiente
 * Manejo de tickets largos, multimoneda BCV en tiempo real, validación atómica y Zero-Alert
 */

window.InventoryApp = window.InventoryApp || {};

class PosCheckoutManager {
    constructor() {
        this.currentPaymentMethod = 'Efectivo USD';
        this.splitPayments = [];
    }

    /**
     * Abre el modal de checkout para el carrito actual
     */
    iniciarCheckout() {
        const carrito = window.AppState?.carrito || [];
        const productos = window.AppState?.productos || [];

        if (carrito.length === 0) {
            if (window.InventoryApp.Modal?.toast) {
                window.InventoryApp.Modal.toast('El carrito está vacío. Agrega productos para procesar la venta.', 'warning');
            }
            return;
        }

        // Validar inventario disponible
        for (const item of carrito) {
            const prod = productos.find(p => p.id === item.productoId);
            const stockActual = Number(prod?.stock || 0);
            if (!prod || item.cantidad <= 0 || item.cantidad > stockActual) {
                if (window.InventoryApp.Modal?.alert) {
                    window.InventoryApp.Modal.alert(
                        'Inventario Insuficiente',
                        `No hay suficiente stock para "${item.nombre}". Stock disponible: ${stockActual}.`,
                        'warning'
                    );
                }
                return;
            }
        }

        this.renderizarModalCheckout();
    }

    /**
     * Renderiza el modal de confirmación y cobro de POS
     */
    renderizarModalCheckout() {
        let modal = document.getElementById('modal-pos-checkout-unificado');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-pos-checkout-unificado';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }

        const carrito = window.AppState?.carrito || [];
        const clientes = window.AppState?.clientes || [];
        const clienteSelectEl = document.getElementById('pos-cliente-select');
        const clienteId = clienteSelectEl ? clienteSelectEl.value : (clientes[0]?.id || 'V-00000000');
        const clienteObj = clientes.find(c => c.id === clienteId) || { id: clienteId, nombre: 'Cliente de Mostrador' };

        const totalUSD = carrito.reduce((sum, item) => sum + (Number(item.cantidad) * Number(item.precio)), 0);
        const tasa = Number(window.AppState?.tasaActiva || window.AppState?.tasaUSD_BCV || 0);
        const totalVES = tasa > 0 ? (totalUSD * tasa) : 0;
        const ptsPorDolar = Number(window.AppState?.premioMes?.puntosPorDolar || 1);
        const temporadaActiva = window.AppState?.premioMes?.temporadaActiva !== false;
        const ptsGanados = temporadaActiva ? Math.floor(totalUSD * ptsPorDolar) : 0;

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 540px; max-height: 90vh; display: flex; flex-direction: column;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid var(--border-light); padding-bottom:10px;">
                    <h3 style="margin:0; font-size:1.15rem; display:flex; align-items:center; gap:8px; color:var(--text-main);">
                        <i class="fas fa-cash-register" style="color:var(--primary-accent);"></i> Finalizar Venta en Caja (POS)
                    </h3>
                    <button type="button" class="btn-icon-tasa" onclick="window.InventoryApp.Checkout.cerrarModal()"><i class="fas fa-times"></i></button>
                </div>

                <!-- Contenedor con Scroll Independiente para el Desglose del Ticket -->
                <div class="pos-checkout-scroll" style="flex:1; overflow-y:auto; padding-right:6px; margin-bottom:14px;">
                    <!-- Resumen del Cliente -->
                    <div style="background:var(--bg-color); border:1px solid var(--border-light); border-radius:10px; padding:12px; margin-bottom:12px;">
                        <div style="display:flex; justify-content:space-between; font-size:0.88rem; margin-bottom:4px;">
                            <span style="color:var(--text-muted);">Cliente:</span>
                            <strong>${clienteObj.nombre} (${clienteObj.id})</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:0.88rem;">
                            <span style="color:var(--text-muted);">Tasa BCV Aplicada:</span>
                            <span style="font-weight:600; color:var(--primary-accent);">Bs. ${tasa > 0 ? tasa.toFixed(2) : '—'} / USD</span>
                        </div>
                    </div>

                    <!-- Lista de Ítems en el Carrito -->
                    <div style="margin-bottom:12px;">
                        <label style="font-size:0.82rem; font-weight:600; color:var(--text-muted); text-transform:uppercase; margin-bottom:6px; display:block;">Artículos a Facturar (${carrito.length})</label>
                        <div style="border:1px solid var(--border-light); border-radius:8px; overflow:hidden;">
                            <table style="width:100%; font-size:0.85rem; border-collapse:collapse;">
                                <thead style="background:#f8fafc; border-bottom:1px solid var(--border-light);">
                                    <tr>
                                        <th style="padding:8px 10px; text-align:left;">Producto</th>
                                        <th style="padding:8px 10px; text-align:center;">Cant.</th>
                                        <th style="padding:8px 10px; text-align:right;">Subtotal ($)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${carrito.map(item => `
                                        <tr style="border-bottom:1px solid #f1f5f9;">
                                            <td style="padding:8px 10px;">${item.nombre}</td>
                                            <td style="padding:8px 10px; text-align:center; font-weight:600;">${item.cantidad}</td>
                                            <td style="padding:8px 10px; text-align:right; font-weight:600;">$${(item.cantidad * item.precio).toFixed(2)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Cuadro de Totales Multimoneda -->
                    <div style="background:#ffffff; border:2px solid var(--primary-accent); border-radius:10px; padding:12px; margin-bottom:14px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                            <span style="font-size:0.95rem; font-weight:600; color:var(--text-main);">Total a Cobrar (USD):</span>
                            <span style="font-size:1.35rem; font-weight:800; color:var(--primary-accent);">$${totalUSD.toFixed(2)}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px dashed var(--border-light); padding-top:6px;">
                            <span style="font-size:0.88rem; color:var(--text-muted);">Equivalente Oficial (VES):</span>
                            <span style="font-size:1.15rem; font-weight:700; color:#16a34a;">Bs. ${totalVES > 0 ? totalVES.toFixed(2) : '—'}</span>
                        </div>
                        ${temporadaActiva ? `
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px; font-size:0.82rem; color:#d97706;">
                                <span><i class="fas fa-seedling"></i> Puntos de fidelidad:</span>
                                <strong>+${ptsGanados} pts</strong>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Métodos de Pago y Referencia -->
                    <div class="form-group" style="margin-bottom:12px;">
                        <label for="pos-checkout-metodo-sel" style="font-weight:600; font-size:0.85rem;">Método de Pago</label>
                        <select id="pos-checkout-metodo-sel" class="form-control" onchange="window.InventoryApp.Checkout.manejarCambioMetodo(this.value)">
                            <option value="Efectivo USD" selected>💵 Efectivo ($ USD)</option>
                            <option value="Efectivo VES">🇻🇪 Efectivo (Bs. VES)</option>
                            <option value="Pago Móvil VES">📱 Pago Móvil (VES)</option>
                            <option value="Transferencia Bancaria VES">🏦 Transferencia Bancaria (VES)</option>
                            <option value="Crédito">📋 Crédito / Fiado en Cuenta</option>
                        </select>
                    </div>

                    <div class="form-group" id="pos-checkout-ref-box" style="margin-bottom:12px; display:none;">
                        <label for="pos-checkout-ref-input" style="font-weight:600; font-size:0.85rem;">
                            Número de Referencia / Comprobante <span style="color:var(--danger);">*</span>
                        </label>
                        <input type="text" id="pos-checkout-ref-input" class="form-control" placeholder="Ej: 849201">
                    </div>
                </div>

                <!-- Footer de Acciones Fijo -->
                <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid var(--border-light); padding-top:12px;">
                    <button type="button" class="btn btn-outline" onclick="window.InventoryApp.Checkout.cerrarModal()">Cancelar</button>
                    <button type="button" class="btn btn-primary" onclick="window.InventoryApp.Checkout.confirmarCobro()" style="font-weight:700; padding:10px 20px;">
                        <i class="fas fa-check-circle"></i> Confirmar y Cobrar
                    </button>
                </div>
            </div>
        `;

        modal.classList.add('active');
    }

    manejarCambioMetodo(metodo) {
        this.currentPaymentMethod = metodo;
        const refBox = document.getElementById('pos-checkout-ref-box');
        const refInput = document.getElementById('pos-checkout-ref-input');

        if (refBox) {
            const requiereRef = metodo === 'Pago Móvil VES' || metodo === 'Transferencia Bancaria VES';
            refBox.style.display = requiereRef ? 'block' : 'none';
            if (refInput) refInput.required = requiereRef;
        }
    }

    cerrarModal() {
        const modal = document.getElementById('modal-pos-checkout-unificado');
        if (modal) modal.classList.remove('active');
    }

    async confirmarCobro() {
        const carrito = window.AppState?.carrito || [];
        const productos = window.AppState?.productos || [];
        const clientes = window.AppState?.clientes || [];
        const ventas = window.AppState?.ventas || [];

        if (carrito.length === 0) return;

        const clienteSelectEl = document.getElementById('pos-cliente-select');
        const clienteId = clienteSelectEl ? clienteSelectEl.value : (clientes[0]?.id || 'V-00000000');
        const metodo = document.getElementById('pos-checkout-metodo-sel')?.value || 'Efectivo USD';
        const refInput = document.getElementById('pos-checkout-ref-input');
        const referencia = refInput ? refInput.value.trim() : '';

        if ((metodo === 'Pago Móvil VES' || metodo === 'Transferencia Bancaria VES') && !referencia) {
            if (window.InventoryApp.Modal?.alert) {
                window.InventoryApp.Modal.alert('Referencia Requerida', 'Por favor ingresa el número de referencia bancaria para conciliar el pago.', 'warning');
            }
            return;
        }

        const totalUSD = carrito.reduce((sum, item) => sum + (Number(item.cantidad) * Number(item.precio)), 0);
        const tasa = Number(window.AppState?.tasaActiva || window.AppState?.tasaUSD_BCV || 0);
        const totalVES = tasa > 0 ? (totalUSD * tasa) : 0;
        const fechaHora = new Date().toISOString().replace('T', ' ').substring(0, 16);

        // 1. Descontar Stock de Inventario
        carrito.forEach(item => {
            if (window.InventoryApp.StockService?.sale) {
                window.InventoryApp.StockService.sale(item.productoId, item.cantidad);
            } else {
                const p = productos.find(prod => prod.id === item.productoId);
                if (p) p.stock = Math.max(0, Number(p.stock) - Number(item.cantidad));
            }
        });

        // 2. Registrar Venta
        const ventaId = 'V' + (ventas.length + 1);
        const nuevaVenta = {
            id: ventaId,
            clienteId,
            fecha: fechaHora,
            items: JSON.parse(JSON.stringify(carrito)),
            total: totalUSD,
            totalVES,
            tasaMomento: tasa,
            tipo: metodo === 'Crédito' ? 'Crédito' : 'Contado',
            metodoPago: metodo,
            referencia: referencia || undefined,
            estado: 'PAGADO',
            descontadoInventario: true
        };
        ventas.push(nuevaVenta);

        // 3. Acreditar Puntos si la compra es de contado y la temporada está activa
        const temporadaActiva = window.AppState?.premioMes?.temporadaActiva !== false;
        if (metodo !== 'Crédito' && temporadaActiva) {
            if (typeof window.otorgarPuntosPorCompra === 'function') {
                window.otorgarPuntosPorCompra(clienteId, totalUSD, 'Venta POS');
            }
        }

        // 4. Limpiar Carrito y Persistir
        window.AppState.carrito = [];
        this.cerrarModal();

        if (window.InventoryApp.Persistence?.guardar) {
            window.InventoryApp.Persistence.guardar(true);
        }

        // 5. Refrescar Vistas
        if (typeof window.renderizarPosProductos === 'function') window.renderizarPosProductos();
        if (typeof window.renderizarCarrito === 'function') window.renderizarCarrito();
        if (typeof window.renderizarInventario === 'function') window.renderizarInventario();
        if (typeof window.renderizarHistorialVentas === 'function') window.renderizarHistorialVentas();

        if (window.InventoryApp.Modal?.toast) {
            window.InventoryApp.Modal.toast(`✅ Venta ${ventaId} procesada exitosamente por $${totalUSD.toFixed(2)}`, 'success');
        }
    }
}

window.InventoryApp.Checkout = new PosCheckoutManager();
