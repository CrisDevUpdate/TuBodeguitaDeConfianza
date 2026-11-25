/**
 * modules/pedidos-adelantados.js
 * Pedidos / Encargos por Adelantado desde el Catálogo del Cliente directo al POS.
 *
 * - Los clientes arman su carrito y lo envían como encargo (Retiro en tienda o Delivery)
 *   sin descontar inventario ni cargar deuda todavía.
 * - Admin y Vendedor reciben el pedido en tiempo real en el POS, pueden actualizar su
 *   estado (Pendiente -> Preparando -> Listo) y cargarlo completo al carrito del POS en 1 clic.
 * - Al finalizar la venta en el POS (Contado o Crédito), el encargo se marca automáticamente
 *   como COMPLETADO y sincroniza en Firestore para que el cliente vea todo en vivo.
 */
(function () {
    window.InventoryApp = window.InventoryApp || {};

    const CACHE_KEY = 'bodeguita_pedidos_adelantados_v1';
    const ESTADOS_ACTIVOS = new Set(['PENDIENTE', 'PREPARANDO', 'LISTO']);
    let filtroBandejaPOS = 'ACTIVOS';

    function esc(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function toast(msg, tipo = 'info', duracion = 3200) {
        try {
            if (typeof window.showCustomToast === 'function') {
                window.showCustomToast(msg, tipo, duracion);
            } else if (window.InventoryApp?.Modal?.toast) {
                window.InventoryApp.Modal.toast(msg, tipo, duracion);
            }
        } catch {}
    }

    function obtenerTasaActual() {
        if (typeof window.obtenerTasaBCVDelDia === 'function') {
            const t = Number(window.obtenerTasaBCVDelDia() || 0);
            if (t > 0) return t;
        }
        return Number(window.AppState?.tasaActiva || window.AppState?.tasaUSD_BCV || 0);
    }

    function obtenerListaPedidos() {
        if (!Array.isArray(window.AppState?.pedidosAdelantados)) {
            try {
                const raw = localStorage.getItem(CACHE_KEY);
                window.AppState.pedidosAdelantados = raw ? JSON.parse(raw) : [];
            } catch {
                window.AppState.pedidosAdelantados = [];
            }
        }
        return window.AppState.pedidosAdelantados;
    }

    function guardarCacheLocalPedidos() {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(obtenerListaPedidos()));
        } catch {}
    }

    function normalizarCedula(val) {
        return String(val || '').trim().toUpperCase();
    }

    function obtenerPedidosDelClienteActual() {
        const u = window.AppState?.usuarioActual;
        if (!u) return [];
        const ced = normalizarCedula(u.cedula || u.id);
        const uid = normalizarCedula(u.id || u.cedula);
        return obtenerListaPedidos()
            .filter(p => {
                if (!p) return false;
                const pCed = normalizarCedula(p.clienteCedula || p.clienteId);
                const pId = normalizarCedula(p.clienteId || p.clienteCedula);
                return (ced && (pCed === ced || pId === ced)) || (uid && (pId === uid || pCed === uid));
            })
            .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
    }

    function obtenerPedidosActivosTodos() {
        return obtenerListaPedidos()
            .filter(p => p && ESTADOS_ACTIVOS.has(String(p.estado || 'PENDIENTE').toUpperCase()))
            .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
    }

    function formatearTiempoRelativo(ts, fechaStr) {
        const n = Number(ts || 0);
        if (!n) return fechaStr || '';
        const diffMin = Math.max(0, Math.floor((Date.now() - n) / 60000));
        if (diffMin < 1) return 'Hace un momento';
        if (diffMin < 60) return `Hace ${diffMin} min`;
        const h = Math.floor(diffMin / 60);
        if (h < 24) return `Hace ${h} h`;
        const d = Math.floor(h / 24);
        return `Hace ${d} día${d === 1 ? '' : 's'}`;
    }

    function badgeEstadoHTML(estado) {
        const est = String(estado || 'PENDIENTE').toUpperCase();
        if (est === 'PENDIENTE') {
            return '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:999px;font-size:0.72rem;font-weight:700;background:#fef3c7;color:#b45309;border:1px solid #fcd34d;"><i class="fas fa-clock"></i> Pendiente</span>';
        }
        if (est === 'PREPARANDO') {
            return '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:999px;font-size:0.72rem;font-weight:700;background:#dbeafe;color:#1d4ed8;border:1px solid #93c5fd;"><i class="fas fa-box-open"></i> Preparando</span>';
        }
        if (est === 'LISTO') {
            return '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:999px;font-size:0.72rem;font-weight:700;background:#dcfce7;color:#15803d;border:1px solid #86efac;"><i class="fas fa-circle-check"></i> Listo</span>';
        }
        if (est === 'COMPLETADO') {
            return '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:999px;font-size:0.72rem;font-weight:700;background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;"><i class="fas fa-receipt"></i> Cobrado</span>';
        }
        return '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:999px;font-size:0.72rem;font-weight:700;background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;"><i class="fas fa-ban"></i> Cancelado</span>';
    }

    // =========================================================================
    // 1. FLUJO CLIENTE: ENVIAR CARRITO COMO ENCARGO POR ADELANTADO
    // =========================================================================

    function abrirModalEnviarEncargo() {
        const usuario = window.AppState?.usuarioActual;
        if (!usuario || usuario.estado !== 'ACTIVO') {
            toast('Tu cuenta debe estar activa para enviar un encargo.', 'warning');
            return;
        }
        const carritoActual = Array.isArray(window.AppState?.carrito) ? window.AppState.carrito : [];
        if (carritoActual.length === 0) {
            toast('Tu carrito está vacío. Agrega productos del catálogo primero.', 'warning');
            return;
        }

        const totalUSD = carritoActual.reduce((s, i) => s + (Number(i.cantidad || 0) * Number(i.precio || 0)), 0);
        const tasa = obtenerTasaActual();
        const totalVES = tasa > 0 ? totalUSD * tasa : 0;
        const cantTotal = carritoActual.reduce((s, i) => s + Number(i.cantidad || 0), 0);

        const metodoPre = document.getElementById('cliente-tipo-pago')?.value || 'Pago Móvil VES';
        const notaPre = (document.getElementById('cliente-pago-comentario')?.value || '').trim();

        let modal = document.getElementById('modal-cliente-enviar-encargo');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-cliente-enviar-encargo';
            modal.className = 'modal';
            modal.onclick = function (e) { if (e.target === this) cerrarModalEnviarEncargo(); };
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="modal-content" style="max-width:460px; width:95%; padding:0; overflow:hidden; border-radius:18px; animation: modalPop 0.22s ease-out;">
                <div style="display:flex; justify-content:space-between; align-items:center; padding:14px 18px; background:linear-gradient(135deg, #0f172a, #1e3a8a); color:#ffffff;">
                    <div>
                        <h3 style="margin:0; font-size:1.05rem; font-weight:800; display:flex; align-items:center; gap:8px; color:#ffffff;">
                            <i class="fas fa-bag-shopping" style="color:#fde047;"></i> Enviar Encargo a la Bodega
                        </h3>
                        <small style="color:#cbd5e1; font-size:0.74rem;">Lo preparamos para que solo retires o recibas sin hacer cola</small>
                    </div>
                    <button type="button" onclick="cerrarModalEnviarEncargo()" style="background:rgba(255,255,255,0.14); border:none; color:#ffffff; width:30px; height:30px; border-radius:50%; font-size:1.1rem; cursor:pointer;">&times;</button>
                </div>

                <form id="form-cliente-enviar-encargo" onsubmit="event.preventDefault(); confirmarEnvioEncargoCliente();" style="padding:16px 18px; display:flex; flex-direction:column; gap:12px; max-height:76vh; overflow-y:auto;">
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="font-size:0.76rem; color:#64748b; font-weight:600;">Resumen del encargo</div>
                            <strong style="font-size:0.9rem; color:#0f172a;">${cantTotal} artículo${cantTotal === 1 ? '' : 's'}</strong>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:1.08rem; font-weight:800; color:var(--primary-accent, #2563eb);">$${totalUSD.toFixed(2)}</div>
                            <div style="font-size:0.78rem; font-weight:700; color:#16a34a;">${tasa > 0 ? 'Bs. ' + totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'Tasa BCV al cobrar'}</div>
                        </div>
                    </div>

                    <div>
                        <label style="display:block; font-size:0.8rem; font-weight:700; color:var(--text-main); margin-bottom:6px;">¿Cómo deseas recibir tu pedido?</label>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                            <label id="encargo-opt-retiro" style="display:flex; align-items:center; justify-content:center; gap:6px; padding:10px; border-radius:10px; border:2px solid #2563eb; background:#eff6ff; color:#1e40af; font-weight:700; font-size:0.84rem; cursor:pointer;">
                                <input type="radio" name="encargo-modalidad" value="RETIRO_TIENDA" checked onchange="actualizarModalidadEncargoUI(this.value)" style="display:none;">
                                <i class="fas fa-store"></i> Retirar en Tienda
                            </label>
                            <label id="encargo-opt-delivery" style="display:flex; align-items:center; justify-content:center; gap:6px; padding:10px; border-radius:10px; border:1px solid #cbd5e1; background:#ffffff; color:#475569; font-weight:700; font-size:0.84rem; cursor:pointer;">
                                <input type="radio" name="encargo-modalidad" value="DELIVERY" onchange="actualizarModalidadEncargoUI(this.value)" style="display:none;">
                                <i class="fas fa-motorcycle"></i> Delivery
                            </label>
                        </div>
                    </div>

                    <div id="encargo-direccion-wrap" style="display:none;">
                        <label for="encargo-direccion" style="display:block; font-size:0.8rem; font-weight:700; color:var(--text-main); margin-bottom:4px;">Dirección o punto de referencia <span style="color:#dc2626;">*</span></label>
                        <input type="text" id="encargo-direccion" maxlength="160" placeholder="Ej: Calle 4, casa azul al lado de la farmacia..." style="width:100%; padding:9px 11px; border-radius:8px; border:1px solid #cbd5e1; font-size:0.85rem;">
                    </div>

                    <div>
                        <label for="encargo-hora-estimada" style="display:block; font-size:0.8rem; font-weight:700; color:var(--text-main); margin-bottom:4px;">¿Cuándo pasas / lo necesitas?</label>
                        <select id="encargo-hora-estimada" style="width:100%; padding:9px 11px; border-radius:8px; border:1px solid #cbd5e1; font-size:0.85rem; font-weight:600;">
                            <option value="Lo antes posible" selected>Lo antes posible</option>
                            <option value="En 15 - 30 minutos">En 15 - 30 minutos</option>
                            <option value="En 1 hora">En 1 hora</option>
                            <option value="Más tarde hoy">Más tarde hoy</option>
                        </select>
                    </div>

                    <div>
                        <label for="encargo-metodo-pago" style="display:block; font-size:0.8rem; font-weight:700; color:var(--text-main); margin-bottom:4px;">¿Cómo planeas pagar al recibir?</label>
                        <select id="encargo-metodo-pago" style="width:100%; padding:9px 11px; border-radius:8px; border:1px solid #cbd5e1; font-size:0.85rem; font-weight:600;">
                            <option value="Pago Móvil VES" ${metodoPre === 'Pago Móvil VES' ? 'selected' : ''}>Pago Móvil (Bs.)</option>
                            <option value="Efectivo USD" ${metodoPre === 'Efectivo USD' ? 'selected' : ''}>Efectivo ($ Dólares)</option>
                            <option value="Efectivo VES" ${metodoPre === 'Efectivo VES' ? 'selected' : ''}>Efectivo (Bs.)</option>
                            <option value="Crédito" ${metodoPre === 'Crédito' ? 'selected' : ''}>Crédito / Fiado</option>
                            <option value="Transferencia Bancaria VES" ${metodoPre === 'Transferencia Bancaria VES' ? 'selected' : ''}>Transferencia Bancaria (Bs.)</option>
                        </select>
                    </div>

                    <div>
                        <label for="encargo-nota" style="display:block; font-size:0.8rem; font-weight:700; color:var(--text-main); margin-bottom:4px;">Nota adicional (opcional)</label>
                        <input type="text" id="encargo-nota" maxlength="180" value="${esc(notaPre)}" placeholder="Ej: Que estén bien fríos, llevo billete de $20..." style="width:100%; padding:9px 11px; border-radius:8px; border:1px solid #cbd5e1; font-size:0.85rem;">
                    </div>

                    <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:8px 10px; font-size:0.75rem; color:#166534; line-height:1.35;">
                        <i class="fas fa-circle-info"></i> Este encargo llegará directo a la tienda para que te lo preparen. El cobro y descuento final se hace al confirmar tu entrega.
                    </div>

                    <div style="display:flex; gap:10px; margin-top:4px;">
                        <button type="button" class="btn btn-outline" onclick="cerrarModalEnviarEncargo()" style="flex:1; padding:10px; font-weight:600;">Cancelar</button>
                        <button type="submit" id="btn-confirmar-envio-encargo" class="btn btn-primary" style="flex:1.4; padding:10px; font-weight:800; background:linear-gradient(135deg, #2563eb, #1d4ed8); border:none; color:#ffffff; border-radius:10px; display:flex; align-items:center; justify-content:center; gap:6px;">
                            <i class="fas fa-paper-plane"></i> Enviar Encargo
                        </button>
                    </div>
                </form>
            </div>
        `;

        modal.classList.add('active');
    }

    function actualizarModalidadEncargoUI(valor) {
        const optRetiro = document.getElementById('encargo-opt-retiro');
        const optDelivery = document.getElementById('encargo-opt-delivery');
        const dirWrap = document.getElementById('encargo-direccion-wrap');
        const esDeliv = valor === 'DELIVERY';

        if (optRetiro) {
            optRetiro.style.border = esDeliv ? '1px solid #cbd5e1' : '2px solid #2563eb';
            optRetiro.style.background = esDeliv ? '#ffffff' : '#eff6ff';
            optRetiro.style.color = esDeliv ? '#475569' : '#1e40af';
        }
        if (optDelivery) {
            optDelivery.style.border = esDeliv ? '2px solid #2563eb' : '1px solid #cbd5e1';
            optDelivery.style.background = esDeliv ? '#eff6ff' : '#ffffff';
            optDelivery.style.color = esDeliv ? '#1e40af' : '#475569';
        }
        if (dirWrap) {
            dirWrap.style.display = esDeliv ? 'block' : 'none';
            if (esDeliv) {
                setTimeout(() => document.getElementById('encargo-direccion')?.focus(), 50);
            }
        }
    }

    function cerrarModalEnviarEncargo() {
        const modal = document.getElementById('modal-cliente-enviar-encargo');
        if (modal) modal.classList.remove('active');
    }

    async function confirmarEnvioEncargoCliente() {
        const usuario = window.AppState?.usuarioActual;
        const carritoActual = Array.isArray(window.AppState?.carrito) ? window.AppState.carrito : [];
        if (!usuario || carritoActual.length === 0) return;

        const modalidad = document.querySelector('input[name="encargo-modalidad"]:checked')?.value || 'RETIRO_TIENDA';
        const direccion = (document.getElementById('encargo-direccion')?.value || '').trim().slice(0, 160);
        if (modalidad === 'DELIVERY' && direccion.length < 4) {
            toast('Indica una dirección o punto de referencia para el delivery.', 'warning');
            document.getElementById('encargo-direccion')?.focus();
            return;
        }

        const horaEstimada = (document.getElementById('encargo-hora-estimada')?.value || 'Lo antes posible').trim().slice(0, 60);
        const metodoPago = (document.getElementById('encargo-metodo-pago')?.value || 'Pago Móvil VES').trim().slice(0, 50);
        const nota = (document.getElementById('encargo-nota')?.value || '').trim().slice(0, 180);

        const btn = document.getElementById('btn-confirmar-envio-encargo');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
        }

        const items = carritoActual.slice(0, 100).map(item => {
            const prod = (window.AppState?.productos || []).find(p => p.id === item.productoId);
            return {
                productoId: String(item.productoId || prod?.id || ''),
                codigo: String(item.codigo || prod?.codigo || ''),
                nombre: String(item.nombre || prod?.nombre || 'Producto').slice(0, 120),
                cantidad: Number(item.cantidad || 1),
                precio: Number(item.precio || prod?.precio || 0),
                costo: Number(prod?.costo || 0),
                categoria: String(prod?.categoria || item.categoria || '')
            };
        });

        const totalUSD = Number(items.reduce((s, i) => s + (i.cantidad * i.precio), 0).toFixed(2));
        const tasa = obtenerTasaActual();
        const totalVES = tasa > 0 ? Number((totalUSD * tasa).toFixed(2)) : 0;
        const ahora = Date.now();
        const codigoCorto = `P-${String(ahora).slice(-4)}`;
        const cedula = String(usuario.cedula || usuario.id || '').trim();
        const clienteMatch = (window.AppState?.clientes || []).find(c =>
            normalizarCedula(c.id) === normalizarCedula(cedula) ||
            normalizarCedula(c.cedula) === normalizarCedula(cedula)
        );

        const pedido = {
            id: `PED-${ahora}`,
            codigoCorto,
            clienteId: String(clienteMatch?.id || cedula || usuario.id || ''),
            clienteCedula: cedula,
            clienteNombre: String(usuario.nombre || 'Cliente').trim().slice(0, 120),
            clienteTelefono: String(usuario.telefono || clienteMatch?.telefono || '').trim().slice(0, 40),
            modalidadEntrega: modalidad,
            horaEstimada,
            direccionEntrega: modalidad === 'DELIVERY' ? direccion : '',
            metodoPagoPreferido: metodoPago,
            nota,
            items,
            totalUSD,
            totalVES,
            tasaReferencia: tasa,
            estado: 'PENDIENTE',
            ventaId: '',
            motivoCancelacion: '',
            atendidoPor: '',
            fecha: new Date(ahora).toISOString().replace('T', ' ').substring(0, 16),
            timestamp: ahora,
            updatedAt: new Date(ahora).toISOString(),
            sincronizadoNube: false
        };

        const lista = obtenerListaPedidos();
        lista.unshift(pedido);
        guardarCacheLocalPedidos();

        try {
            if (window.InventoryApp?.Firebase?.guardarPedidoAdelantado) {
                const ok = await window.InventoryApp.Firebase.guardarPedidoAdelantado(pedido);
                if (ok) {
                    pedido.sincronizadoNube = true;
                    guardarCacheLocalPedidos();
                }
            }
        } catch (err) {
            console.warn('[PedidosAdelantados] Guardado local (reintentará en nube):', err);
        }

        // Registrar notificación para el administrador/vendedor
        if (typeof window.registrarNotificacion === 'function') {
            const modalTxt = modalidad === 'DELIVERY' ? '🛵 Delivery' : '🏪 Retiro en tienda';
            window.registrarNotificacion({
                tipo: 'pedido_adelantado',
                titulo: `Nuevo Encargo ${codigoCorto}`,
                mensaje: `${pedido.clienteNombre} envió un encargo (${modalTxt}) de ${items.length} producto(s) por $${totalUSD.toFixed(2)}.`,
                clienteId: pedido.clienteId,
                clienteNombre: pedido.clienteNombre,
                montoUSD: totalUSD,
                montoVES: totalVES,
                referenciaId: pedido.id,
                destino: { tab: 'pos', subAccion: 'abrirPedidosAdelantados', idRef: pedido.id }
            });
        }

        // Vaciar carrito del cliente y cerrar modales
        window.AppState.carrito = [];
        if (typeof window.renderizarCarritoCliente === 'function') window.renderizarCarritoCliente();
        if (typeof window.cerrarModalCarritoCliente === 'function') window.cerrarModalCarritoCliente();
        cerrarModalEnviarEncargo();
        actualizarBadgeEncargosCliente();

        toast(`¡Encargo ${codigoCorto} enviado a la bodega! Te avisaremos apenas esté listo.`, 'success', 4500);
        abrirModalMisEncargosCliente();
    }

    function actualizarBadgeEncargosCliente() {
        const badge = document.getElementById('cliente-encargos-badge');
        const btn = document.getElementById('btn-cliente-mis-encargos');
        if (!badge && !btn) return;

        const activos = obtenerPedidosDelClienteActual().filter(p => ESTADOS_ACTIVOS.has(String(p.estado || '').toUpperCase()));
        const hayListo = activos.some(p => String(p.estado || '').toUpperCase() === 'LISTO');

        if (badge) {
            if (activos.length > 0) {
                badge.textContent = activos.length;
                badge.style.display = 'inline-flex';
                badge.style.background = hayListo ? '#16a34a' : '#f59e0b';
            } else {
                badge.style.display = 'none';
            }
        }
        if (btn) {
            btn.style.borderColor = hayListo ? '#4ade80' : 'rgba(96,165,250,0.45)';
        }
    }

    function abrirModalMisEncargosCliente() {
        let modal = document.getElementById('modal-cliente-mis-encargos');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-cliente-mis-encargos';
            modal.className = 'modal';
            modal.onclick = function (e) { if (e.target === this) cerrarModalMisEncargosCliente(); };
            document.body.appendChild(modal);
        }
        renderizarContenidoMisEncargosCliente();
        modal.classList.add('active');
    }

    function cerrarModalMisEncargosCliente() {
        const modal = document.getElementById('modal-cliente-mis-encargos');
        if (modal) modal.classList.remove('active');
    }

    function renderizarContenidoMisEncargosCliente() {
        const modal = document.getElementById('modal-cliente-mis-encargos');
        if (!modal) return;

        const pedidos = obtenerPedidosDelClienteActual().slice(0, 20);
        const listaHtml = pedidos.length === 0
            ? `
                <div style="text-align:center; padding:34px 16px; color:#64748b;">
                    <i class="fas fa-bag-shopping" style="font-size:2.3rem; opacity:0.35; margin-bottom:10px; display:block;"></i>
                    <strong style="display:block; color:var(--text-main); margin-bottom:4px;">Aún no tienes encargos</strong>
                    <span style="font-size:0.84rem;">Agrega productos a tu carrito y toca <b>"Enviar como Encargo"</b> para que te lo vayamos preparando.</span>
                </div>
            `
            : pedidos.map(p => {
                const est = String(p.estado || 'PENDIENTE').toUpperCase();
                const esDelivery = p.modalidadEntrega === 'DELIVERY';
                const progresoMsg = est === 'LISTO'
                    ? (esDelivery ? '🛵 ¡Tu pedido está listo y saliendo!' : '✅ ¡Tu pedido ya está listo para retirar en tienda!')
                    : est === 'PREPARANDO'
                        ? '🛍️ En la bodega ya están armando tu pedido...'
                        : est === 'PENDIENTE'
                            ? '⏳ Recibido en tienda. Esperando confirmación.'
                            : est === 'COMPLETADO'
                                ? '🎉 Pedido entregado y registrado.'
                                : `❌ Cancelado${p.motivoCancelacion ? ': ' + esc(p.motivoCancelacion) : ''}`;

                const itemsHtml = (p.items || []).map(it =>
                    `<div style="display:flex; justify-content:space-between; font-size:0.78rem; padding:2px 0; color:#334155;">
                        <span>${it.cantidad}x ${esc(it.nombre)}</span>
                        <strong>$${(Number(it.cantidad || 0) * Number(it.precio || 0)).toFixed(2)}</strong>
                    </div>`
                ).join('');

                return `
                    <div style="border:1px solid ${est === 'LISTO' ? '#86efac' : '#e2e8f0'}; background:${est === 'LISTO' ? '#f0fdf4' : '#ffffff'}; border-radius:12px; padding:12px; margin-bottom:10px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:6px; flex-wrap:wrap;">
                            <div>
                                <strong style="font-size:0.92rem; color:#0f172a;">Encargo ${esc(p.codigoCorto || p.id)}</strong>
                                <span style="font-size:0.72rem; color:#64748b; margin-left:6px;">${esc(formatearTiempoRelativo(p.timestamp, p.fecha))}</span>
                            </div>
                            ${badgeEstadoHTML(est)}
                        </div>

                        <div style="font-size:0.8rem; font-weight:600; color:${est === 'LISTO' ? '#15803d' : '#334155'}; margin-bottom:8px;">
                            ${progresoMsg}
                        </div>

                        <div style="display:flex; gap:8px; flex-wrap:wrap; font-size:0.74rem; color:#475569; margin-bottom:8px;">
                            <span style="background:#f1f5f9; padding:2px 8px; border-radius:6px; font-weight:600;">
                                ${esDelivery ? '🛵 Delivery' : '🏪 Retiro en tienda'}
                            </span>
                            <span style="background:#f1f5f9; padding:2px 8px; border-radius:6px; font-weight:600;">
                                🕒 ${esc(p.horaEstimada || 'Lo antes posible')}
                            </span>
                            <span style="background:#f1f5f9; padding:2px 8px; border-radius:6px; font-weight:600;">
                                💳 ${esc(p.metodoPagoPreferido || 'A convenir')}
                            </span>
                        </div>

                        ${p.direccionEntrega ? `<div style="font-size:0.76rem; color:#475569; margin-bottom:6px;"><i class="fas fa-location-dot" style="color:#2563eb;"></i> ${esc(p.direccionEntrega)}</div>` : ''}
                        ${p.nota ? `<div style="font-size:0.76rem; color:#475569; font-style:italic; margin-bottom:6px;">"${esc(p.nota)}"</div>` : ''}

                        <div style="border-top:1px dashed #cbd5e1; border-bottom:1px dashed #cbd5e1; padding:6px 0; margin:6px 0;">
                            ${itemsHtml}
                        </div>

                        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-top:6px;">
                            <div>
                                <strong style="font-size:0.98rem; color:var(--primary-accent, #2563eb);">$${Number(p.totalUSD || 0).toFixed(2)}</strong>
                                ${Number(p.totalVES || 0) > 0 ? `<span style="font-size:0.78rem; color:#16a34a; font-weight:700; margin-left:6px;">Bs. ${Number(p.totalVES).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>` : ''}
                            </div>
                            <div style="display:flex; gap:6px;">
                                ${est === 'PENDIENTE' ? `
                                    <button type="button" class="btn btn-sm btn-outline" onclick="cancelarEncargoPorCliente('${esc(p.id)}')" style="font-size:0.74rem; padding:4px 10px; color:#dc2626; border-color:#fecaca;">
                                        <i class="fas fa-times"></i> Cancelar
                                    </button>
                                ` : ''}
                                ${ESTADOS_ACTIVOS.has(est) ? `
                                    <button type="button" class="btn btn-sm" onclick="avisarWhatsAppEncargoCliente('${esc(p.id)}')" style="font-size:0.74rem; padding:4px 10px; background:#dcfce7; color:#15803d; border:1px solid #86efac; font-weight:700;">
                                        <i class="fab fa-whatsapp"></i> Avisar
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

        modal.innerHTML = `
            <div class="modal-content" style="max-width:500px; width:95%; max-height:84vh; display:flex; flex-direction:column; padding:0; overflow:hidden; border-radius:18px;">
                <div style="display:flex; justify-content:space-between; align-items:center; padding:14px 18px; background:linear-gradient(135deg, #0f172a, #1e293b); color:#ffffff; flex-shrink:0;">
                    <h3 style="margin:0; font-size:1.05rem; font-weight:800; display:flex; align-items:center; gap:8px; color:#ffffff;">
                        <i class="fas fa-box-open" style="color:#fde047;"></i> Mis Encargos
                    </h3>
                    <button type="button" onclick="cerrarModalMisEncargosCliente()" style="background:rgba(255,255,255,0.14); border:none; color:#ffffff; width:30px; height:30px; border-radius:50%; font-size:1.1rem; cursor:pointer;">&times;</button>
                </div>
                <div style="padding:14px 16px; overflow-y:auto; flex:1; background:#f8fafc;">
                    ${listaHtml}
                </div>
            </div>
        `;
    }

    async function cancelarEncargoPorCliente(pedidoId) {
        const pedido = obtenerListaPedidos().find(p => p && p.id === pedidoId);
        if (!pedido) return;
        if (String(pedido.estado).toUpperCase() !== 'PENDIENTE') {
            toast('Este encargo ya está en preparación y no se puede cancelar desde aquí.', 'warning');
            return;
        }
        let ok = true;
        if (window.InventoryApp?.Modal?.confirm) {
            ok = await window.InventoryApp.Modal.confirm(
                'Cancelar Encargo',
                `¿Deseas cancelar tu encargo <strong>${esc(pedido.codigoCorto)}</strong>?`,
                'warning'
            );
        }
        if (!ok) return;
        await actualizarEstadoPedido(pedidoId, 'CANCELADO', { motivoCancelacion: 'Cancelado por el cliente' });
        toast('Encargo cancelado.', 'info');
    }

    function avisarWhatsAppEncargoCliente(pedidoId) {
        const pedido = obtenerListaPedidos().find(p => p && p.id === pedidoId);
        if (!pedido) return;
        const rawTel = window.AppState?.telefonoWhatsApp || '0412-5363849';
        const telTienda = typeof window.normalizarNumeroWhatsApp === 'function' ? window.normalizarNumeroWhatsApp(rawTel) : '584125363849';
        const itemsTxt = (pedido.items || []).map(i => `• ${i.cantidad}x ${i.nombre}`).join('\n');
        const modTxt = pedido.modalidadEntrega === 'DELIVERY'
            ? `🛵 Delivery (${pedido.direccionEntrega || 'por confirmar'})`
            : '🏪 Retiro en tienda';
        const msg = `¡Hola! Acabo de enviar el encargo *${pedido.codigoCorto}* desde la app.\n\n` +
            `👤 *Cliente:* ${pedido.clienteNombre}\n` +
            `📦 *Entrega:* ${modTxt} (${pedido.horaEstimada})\n` +
            `💳 *Pago:* ${pedido.metodoPagoPreferido}\n\n` +
            `*Productos:*\n${itemsTxt}\n\n` +
            `💵 *Total aprox.:* $${Number(pedido.totalUSD || 0).toFixed(2)}` +
            (pedido.nota ? `\n📝 *Nota:* ${pedido.nota}` : '');

        if (typeof window.abrirWhatsAppEnlace === 'function') {
            window.abrirWhatsAppEnlace({ telefono: telTienda, mensaje: msg, app: 'normal' });
        } else {
            window.location.href = `https://api.whatsapp.com/send?phone=${telTienda}&text=${encodeURIComponent(msg)}`;
        }
    }

    // =========================================================================
    // 2. FLUJO ADMIN / VENDEDOR EN EL POS: RECEPCIÓN, ESTADOS Y CARGA EN 1 CLIC
    // =========================================================================

    function renderizarBarraPOS() {
        const bar = document.getElementById('pos-pedidos-adelantados-bar');
        const chipCount = document.getElementById('pos-btn-encargos-count');
        const activos = obtenerPedidosActivosTodos();
        const pendientes = activos.filter(p => String(p.estado).toUpperCase() === 'PENDIENTE').length;

        if (chipCount) {
            chipCount.textContent = activos.length;
            chipCount.style.display = activos.length > 0 ? 'inline-flex' : 'none';
        }

        if (!bar) return;

        if (activos.length === 0) {
            bar.style.display = 'none';
            bar.innerHTML = '';
            return;
        }

        const primero = activos[0];
        const esDeliv = primero.modalidadEntrega === 'DELIVERY';
        bar.style.display = 'flex';
        bar.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; width:100%; background:linear-gradient(135deg, #eff6ff, #fefce8); border:1px solid #93c5fd; border-left:4px solid ${pendientes > 0 ? '#f59e0b' : '#2563eb'}; border-radius:12px; padding:10px 14px; margin-bottom:10px; box-shadow:0 2px 8px rgba(37,99,235,0.08);">
                <div style="display:flex; align-items:center; gap:10px; min-width:210px; flex:1;">
                    <div style="width:36px; height:36px; border-radius:10px; background:${pendientes > 0 ? '#f59e0b' : '#2563eb'}; color:#ffffff; display:flex; align-items:center; justify-content:center; font-size:1rem; flex-shrink:0;">
                        <i class="fas fa-bell-concierge"></i>
                    </div>
                    <div style="line-height:1.25;">
                        <div style="font-size:0.86rem; font-weight:800; color:#0f172a;">
                            ${activos.length} encargo${activos.length === 1 ? '' : 's'} de clientes en curso
                            ${pendientes > 0 ? `<span style="background:#fef3c7; color:#b45309; padding:1px 7px; border-radius:999px; font-size:0.72rem; margin-left:4px; border:1px solid #fcd34d;">${pendientes} nuevo${pendientes === 1 ? '' : 's'}</span>` : ''}
                        </div>
                        <div style="font-size:0.76rem; color:#475569;">
                            Último: <strong>${esc(primero.clienteNombre)}</strong> (${esc(primero.codigoCorto)}) · ${esDeliv ? '🛵 Delivery' : '🏪 Retiro'} · <strong>$${Number(primero.totalUSD || 0).toFixed(2)}</strong>
                        </div>
                    </div>
                </div>
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                    <button type="button" class="btn btn-sm btn-success" onclick="cargarPedidoAdelantadoEnPOS('${esc(primero.id)}')" style="font-weight:700; font-size:0.78rem; padding:7px 12px; border-radius:8px;">
                        <i class="fas fa-cart-arrow-down"></i> Cargar último al POS
                    </button>
                    <button type="button" class="btn btn-sm btn-primary" onclick="abrirModalBandejaPedidosPOS()" style="font-weight:700; font-size:0.78rem; padding:7px 12px; border-radius:8px;">
                        <i class="fas fa-list-check"></i> Ver Bandeja (${activos.length})
                    </button>
                </div>
            </div>
        `;
    }

    function abrirModalBandejaPedidosPOS(filtro = null) {
        if (filtro) filtroBandejaPOS = filtro;
        let modal = document.getElementById('modal-pos-pedidos-adelantados');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-pos-pedidos-adelantados';
            modal.className = 'modal';
            modal.onclick = function (e) { if (e.target === this) cerrarModalBandejaPedidosPOS(); };
            document.body.appendChild(modal);
        }
        renderizarContenidoBandejaPOS();
        modal.classList.add('active');
    }

    function cerrarModalBandejaPedidosPOS() {
        const modal = document.getElementById('modal-pos-pedidos-adelantados');
        if (modal) modal.classList.remove('active');
    }

    function cambiarFiltroBandejaPedidosPOS(nuevoFiltro) {
        filtroBandejaPOS = nuevoFiltro || 'ACTIVOS';
        renderizarContenidoBandejaPOS();
    }

    function renderizarContenidoBandejaPOS() {
        const modal = document.getElementById('modal-pos-pedidos-adelantados');
        if (!modal) return;

        const todos = obtenerListaPedidos().slice().sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
        const activos = todos.filter(p => ESTADOS_ACTIVOS.has(String(p.estado || 'PENDIENTE').toUpperCase()));
        const completados = todos.filter(p => String(p.estado || '').toUpperCase() === 'COMPLETADO');
        const cancelados = todos.filter(p => String(p.estado || '').toUpperCase() === 'CANCELADO');

        const lista = filtroBandejaPOS === 'COMPLETADOS'
            ? completados
            : (filtroBandejaPOS === 'CANCELADOS' ? cancelados : activos);

        const esAdmin = typeof window.esUsuarioAdmin === 'function'
            ? window.esUsuarioAdmin(window.AppState?.usuarioActual)
            : String(window.AppState?.usuarioActual?.rol || '').toLowerCase() === 'admin';

        const tabStyle = (key) => filtroBandejaPOS === key
            ? 'background:#2563eb; color:#ffffff; border:1px solid #2563eb; font-weight:700;'
            : 'background:#ffffff; color:#475569; border:1px solid #cbd5e1; font-weight:600;';

        const cardsHtml = lista.length === 0
            ? `
                <div style="text-align:center; padding:36px 16px; color:#64748b;">
                    <i class="fas fa-inbox" style="font-size:2.3rem; opacity:0.35; margin-bottom:10px; display:block;"></i>
                    <strong style="display:block; color:var(--text-main); margin-bottom:4px;">Sin encargos en esta sección</strong>
                    <span style="font-size:0.84rem;">Cuando un cliente envíe un encargo desde el catálogo aparecerá aquí al instante.</span>
                </div>
            `
            : lista.map(p => {
                const est = String(p.estado || 'PENDIENTE').toUpperCase();
                const esDeliv = p.modalidadEntrega === 'DELIVERY';
                const esActivoEnPOS = window.AppState?.pedidoPOSActivoId === p.id;
                const itemsHtml = (p.items || []).map(it => {
                    const prodVivo = (window.AppState?.productos || []).find(pr => pr.id === it.productoId || (it.codigo && pr.codigo === it.codigo));
                    const stockVivo = Number(prodVivo?.stock || 0);
                    const sinStock = !prodVivo || stockVivo < Number(it.cantidad || 0);
                    return `
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:0.8rem; padding:3px 0; color:#1e293b;">
                            <span>
                                <strong>${it.cantidad}x</strong> ${esc(it.nombre)}
                                ${sinStock ? `<span style="color:#dc2626; font-size:0.7rem; font-weight:700;"> (Stock: ${stockVivo})</span>` : ''}
                            </span>
                            <span style="font-weight:700; white-space:nowrap;">$${(Number(it.cantidad || 0) * Number(it.precio || 0)).toFixed(2)}</span>
                        </div>
                    `;
                }).join('');

                return `
                    <div style="background:#ffffff; border:${esActivoEnPOS ? '2px solid #16a34a' : '1px solid #e2e8f0'}; border-radius:12px; padding:13px 14px; margin-bottom:10px; box-shadow:0 2px 6px rgba(15,23,42,0.04);">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
                            <div>
                                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                                    <strong style="font-size:0.96rem; color:#0f172a;">${esc(p.clienteNombre)}</strong>
                                    <span style="font-size:0.74rem; font-weight:700; background:#f1f5f9; color:#334155; padding:2px 7px; border-radius:6px;">${esc(p.codigoCorto || p.id)}</span>
                                    ${esActivoEnPOS ? '<span style="font-size:0.7rem; font-weight:800; background:#dcfce7; color:#15803d; padding:2px 7px; border-radius:6px;">EN CARRITO POS</span>' : ''}
                                </div>
                                <div style="font-size:0.74rem; color:#64748b; margin-top:2px;">
                                    ${p.clienteCedula ? `C.I: ${esc(p.clienteCedula)} · ` : ''}${p.clienteTelefono ? `📱 ${esc(p.clienteTelefono)} · ` : ''}${esc(formatearTiempoRelativo(p.timestamp, p.fecha))}
                                </div>
                            </div>
                            ${badgeEstadoHTML(est)}
                        </div>

                        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px; font-size:0.74rem;">
                            <span style="background:${esDeliv ? '#ede9fe' : '#e0f2fe'}; color:${esDeliv ? '#6d28d9' : '#0369a1'}; padding:3px 8px; border-radius:6px; font-weight:700;">
                                ${esDeliv ? '🛵 Delivery' : '🏪 Retiro en tienda'}
                            </span>
                            <span style="background:#f8fafc; border:1px solid #e2e8f0; color:#334155; padding:3px 8px; border-radius:6px; font-weight:600;">
                                🕒 ${esc(p.horaEstimada || 'Lo antes posible')}
                            </span>
                            <span style="background:#f8fafc; border:1px solid #e2e8f0; color:#334155; padding:3px 8px; border-radius:6px; font-weight:600;">
                                💳 ${esc(p.metodoPagoPreferido || 'A convenir')}
                            </span>
                        </div>

                        ${p.direccionEntrega ? `<div style="background:#f5f3ff; border:1px solid #ddd6fe; border-radius:8px; padding:6px 10px; font-size:0.78rem; color:#5b21b6; margin-bottom:8px;"><i class="fas fa-location-dot"></i> <strong>Dirección:</strong> ${esc(p.direccionEntrega)}</div>` : ''}
                        ${p.nota ? `<div style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:6px 10px; font-size:0.78rem; color:#92400e; margin-bottom:8px;"><i class="fas fa-comment-dots"></i> <strong>Nota:</strong> ${esc(p.nota)}</div>` : ''}

                        <div style="border-top:1px dashed #cbd5e1; border-bottom:1px dashed #cbd5e1; padding:6px 0; margin:6px 0;">
                            ${itemsHtml}
                        </div>

                        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; margin-top:8px;">
                            <div>
                                <span style="font-size:0.74rem; color:#64748b;">Total estimado:</span>
                                <strong style="font-size:1.04rem; color:var(--primary-accent, #2563eb); margin-left:4px;">$${Number(p.totalUSD || 0).toFixed(2)}</strong>
                                ${Number(p.totalVES || 0) > 0 ? `<span style="font-size:0.78rem; color:#16a34a; font-weight:700; margin-left:6px;">Bs. ${Number(p.totalVES).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>` : ''}
                            </div>

                            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                                ${ESTADOS_ACTIVOS.has(est) ? `
                                    <button type="button" class="btn btn-sm btn-success" onclick="cargarPedidoAdelantadoEnPOS('${esc(p.id)}')" style="font-weight:700; font-size:0.76rem; padding:6px 11px; border-radius:8px;">
                                        <i class="fas fa-cart-arrow-down"></i> Cargar al POS y Cobrar
                                    </button>
                                    ${est === 'PENDIENTE' ? `
                                        <button type="button" class="btn btn-sm btn-outline" onclick="cambiarEstadoPedidoAdelantado('${esc(p.id)}', 'PREPARANDO')" style="font-size:0.74rem; padding:6px 9px; border-radius:8px; color:#1d4ed8; border-color:#93c5fd;">
                                            <i class="fas fa-box-open"></i> Preparando
                                        </button>
                                    ` : ''}
                                    ${est !== 'LISTO' ? `
                                        <button type="button" class="btn btn-sm btn-outline" onclick="cambiarEstadoPedidoAdelantado('${esc(p.id)}', 'LISTO')" style="font-size:0.74rem; padding:6px 9px; border-radius:8px; color:#15803d; border-color:#86efac;">
                                            <i class="fas fa-check"></i> Marcar Listo
                                        </button>
                                    ` : ''}
                                    ${p.clienteTelefono ? `
                                        <button type="button" class="btn btn-sm" onclick="notificarClientePedidoWhatsApp('${esc(p.id)}')" style="font-size:0.74rem; padding:6px 9px; border-radius:8px; background:#dcfce7; color:#15803d; border:1px solid #86efac; font-weight:700;" title="Avisar al cliente por WhatsApp">
                                            <i class="fab fa-whatsapp"></i>
                                        </button>
                                    ` : ''}
                                    <button type="button" class="btn btn-sm btn-outline" onclick="cancelarPedidoAdelantadoAdmin('${esc(p.id)}')" style="font-size:0.74rem; padding:6px 9px; border-radius:8px; color:#dc2626; border-color:#fecaca;" title="Cancelar encargo">
                                        <i class="fas fa-times"></i>
                                    </button>
                                ` : `
                                    ${p.ventaId ? `<span style="font-size:0.74rem; color:#475569; font-weight:600;">Venta #${esc(p.ventaId)}</span>` : ''}
                                    ${esAdmin ? `
                                        <button type="button" class="btn btn-sm btn-outline" onclick="eliminarPedidoAdelantadoAdmin('${esc(p.id)}')" style="font-size:0.74rem; padding:5px 9px; border-radius:8px; color:#dc2626; border-color:#fecaca;">
                                            <i class="fas fa-trash"></i> Eliminar
                                        </button>
                                    ` : ''}
                                `}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

        modal.innerHTML = `
            <div class="modal-content" style="max-width:680px; width:96%; max-height:86vh; display:flex; flex-direction:column; padding:0; overflow:hidden; border-radius:18px;">
                <div style="display:flex; justify-content:space-between; align-items:center; padding:14px 18px; background:linear-gradient(135deg, #0f172a, #1e3a8a); color:#ffffff; flex-shrink:0;">
                    <div>
                        <h3 style="margin:0; font-size:1.08rem; font-weight:800; display:flex; align-items:center; gap:8px; color:#ffffff;">
                            <i class="fas fa-bell-concierge" style="color:#fde047;"></i> Encargos de Clientes
                        </h3>
                        <small style="color:#cbd5e1; font-size:0.74rem;">Aprueba, prepara y carga cualquier encargo directo al carrito del POS</small>
                    </div>
                    <button type="button" onclick="cerrarModalBandejaPedidosPOS()" style="background:rgba(255,255,255,0.14); border:none; color:#ffffff; width:30px; height:30px; border-radius:50%; font-size:1.1rem; cursor:pointer;">&times;</button>
                </div>

                <div style="display:flex; gap:8px; padding:10px 16px; background:#f8fafc; border-bottom:1px solid #e2e8f0; flex-shrink:0; flex-wrap:wrap;">
                    <button type="button" onclick="cambiarFiltroBandejaPedidosPOS('ACTIVOS')" style="padding:6px 12px; border-radius:8px; font-size:0.78rem; cursor:pointer; ${tabStyle('ACTIVOS')}">
                        Activos (${activos.length})
                    </button>
                    <button type="button" onclick="cambiarFiltroBandejaPedidosPOS('COMPLETADOS')" style="padding:6px 12px; border-radius:8px; font-size:0.78rem; cursor:pointer; ${tabStyle('COMPLETADOS')}">
                        Cobrados (${completados.length})
                    </button>
                    <button type="button" onclick="cambiarFiltroBandejaPedidosPOS('CANCELADOS')" style="padding:6px 12px; border-radius:8px; font-size:0.78rem; cursor:pointer; ${tabStyle('CANCELADOS')}">
                        Cancelados (${cancelados.length})
                    </button>
                </div>

                <div style="padding:14px 16px; overflow-y:auto; flex:1; background:#f8fafc;">
                    ${cardsHtml}
                </div>
            </div>
        `;
    }

    async function actualizarEstadoPedido(pedidoId, nuevoEstado, extra = {}) {
        const lista = obtenerListaPedidos();
        const pedido = lista.find(p => p && p.id === pedidoId);
        if (!pedido) return false;

        pedido.estado = nuevoEstado;
        pedido.updatedAt = new Date().toISOString();
        pedido.atendidoPor = window.AppState?.usuarioActual?.nombre || pedido.atendidoPor || '';
        Object.assign(pedido, extra);
        guardarCacheLocalPedidos();

        try {
            if (window.InventoryApp?.Firebase?.guardarPedidoAdelantado) {
                await window.InventoryApp.Firebase.guardarPedidoAdelantado(pedido);
            }
        } catch (err) {
            console.warn('[PedidosAdelantados] Error sincronizando cambio de estado:', err);
        }

        refrescarTodasLasVistasPedidos();
        return true;
    }

    async function cambiarEstadoPedidoAdelantado(pedidoId, nuevoEstado) {
        const ok = await actualizarEstadoPedido(pedidoId, nuevoEstado);
        if (!ok) return;
        const msg = nuevoEstado === 'LISTO'
            ? 'Encargo marcado como LISTO. El cliente ya lo ve en su celular.'
            : (nuevoEstado === 'PREPARANDO' ? 'Encargo marcado en preparación.' : `Estado actualizado a ${nuevoEstado}.`);
        toast(msg, 'success');
    }

    async function cancelarPedidoAdelantadoAdmin(pedidoId) {
        const pedido = obtenerListaPedidos().find(p => p && p.id === pedidoId);
        if (!pedido) return;
        let ok = true;
        if (window.InventoryApp?.Modal?.confirm) {
            ok = await window.InventoryApp.Modal.confirm(
                'Cancelar Encargo',
                `¿Seguro que deseas cancelar el encargo <strong>${esc(pedido.codigoCorto)}</strong> de <strong>${esc(pedido.clienteNombre)}</strong>?`,
                'warning'
            );
        }
        if (!ok) return;
        await actualizarEstadoPedido(pedidoId, 'CANCELADO', { motivoCancelacion: 'Cancelado por la tienda' });
        if (window.AppState?.pedidoPOSActivoId === pedidoId) {
            limpiarPedidoActivoEnPOS();
        }
        toast(`Encargo ${pedido.codigoCorto} cancelado.`, 'info');
    }

    async function eliminarPedidoAdelantadoAdmin(pedidoId) {
        const pedido = obtenerListaPedidos().find(p => p && p.id === pedidoId);
        if (!pedido) return;
        let ok = true;
        if (window.InventoryApp?.Modal?.confirm) {
            ok = await window.InventoryApp.Modal.confirm(
                'Eliminar Registro',
                `¿Eliminar definitivamente el encargo <strong>${esc(pedido.codigoCorto)}</strong> del historial?`,
                'danger'
            );
        }
        if (!ok) return;

        window.AppState.pedidosAdelantados = obtenerListaPedidos().filter(p => p && p.id !== pedidoId);
        guardarCacheLocalPedidos();
        if (window.InventoryApp?.Firebase?.eliminarPedidoAdelantado) {
            window.InventoryApp.Firebase.eliminarPedidoAdelantado(pedidoId).catch(() => {});
        }
        refrescarTodasLasVistasPedidos();
        toast('Encargo eliminado del historial.', 'success');
    }

    function notificarClientePedidoWhatsApp(pedidoId) {
        const pedido = obtenerListaPedidos().find(p => p && p.id === pedidoId);
        if (!pedido || !pedido.clienteTelefono) {
            toast('Este cliente no tiene teléfono registrado.', 'warning');
            return;
        }
        const tel = typeof window.normalizarNumeroWhatsApp === 'function'
            ? window.normalizarNumeroWhatsApp(pedido.clienteTelefono)
            : pedido.clienteTelefono;
        const est = String(pedido.estado || '').toUpperCase();
        const estadoTexto = est === 'LISTO'
            ? (pedido.modalidadEntrega === 'DELIVERY' ? 'ya está LISTO y listo para salir en delivery 🛵' : 'ya está LISTO para retirar en la bodega 🏪')
            : 'está siendo preparado en este momento 🛍️';
        const tasa = obtenerTasaActual();
        const bsStr = tasa > 0 ? ` (Bs. ${(Number(pedido.totalUSD || 0) * tasa).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : '';
        const msg = `¡Hola ${pedido.clienteNombre}! 👋 Te escribimos de *Tu Bodeguita de Confianza*.\n\n` +
            `Tu encargo *${pedido.codigoCorto}* ${estadoTexto}.\n` +
            `💵 *Total:* $${Number(pedido.totalUSD || 0).toFixed(2)}${bsStr}\n\n` +
            `¡Gracias por preferirnos!`;

        if (typeof window.abrirWhatsAppEnlace === 'function') {
            window.abrirWhatsAppEnlace({ telefono: tel, mensaje: msg, app: 'normal' });
        } else {
            window.location.href = `https://api.whatsapp.com/send?phone=${tel}&text=${encodeURIComponent(msg)}`;
        }
    }

    function cargarPedidoAdelantadoEnPOS(pedidoId) {
        const pedido = obtenerListaPedidos().find(p => p && p.id === pedidoId);
        if (!pedido) return;

        // Asegurar que estamos en la pestaña POS
        if (document.body.getAttribute('data-active-tab') !== 'pos' && typeof window.switchTab === 'function') {
            window.switchTab('pos');
        }

        const productosLista = Array.isArray(window.AppState?.productos) ? window.AppState.productos : [];
        const nuevoCarrito = [];
        const advertencias = [];

        (pedido.items || []).forEach(it => {
            const prod = productosLista.find(p =>
                String(p.id) === String(it.productoId) ||
                (it.codigo && String(p.codigo).toUpperCase() === String(it.codigo).toUpperCase())
            );
            if (!prod) {
                advertencias.push(`"${it.nombre}" ya no existe en el inventario`);
                return;
            }
            const stockDisp = Number(prod.stock || 0);
            if (stockDisp <= 0) {
                advertencias.push(`"${prod.nombre}" está agotado`);
                return;
            }
            const cantSolicitada = Number(it.cantidad || 1);
            const cantFinal = Math.min(cantSolicitada, stockDisp);
            if (cantFinal < cantSolicitada) {
                advertencias.push(`"${prod.nombre}" se ajustó de ${cantSolicitada} a ${cantFinal} por stock disponible`);
            }
            nuevoCarrito.push({
                productoId: prod.id,
                codigo: prod.codigo || it.codigo || '',
                nombre: prod.nombre || it.nombre,
                cantidad: cantFinal,
                precio: Number(prod.precio ?? it.precio ?? 0),
                costo: Number(prod.costo ?? it.costo ?? 0),
                imagen: prod.imagen || ''
            });
        });

        if (nuevoCarrito.length === 0) {
            toast('Ninguno de los productos de este encargo tiene stock disponible ahora mismo.', 'warning', 4500);
            return;
        }

        // Cargar items en el carrito POS global
        window.AppState.carrito = nuevoCarrito;
        window.AppState.pedidoPOSActivoId = pedido.id;

        // Seleccionar automáticamente al cliente en el POS
        if (typeof window.asegurarSincronizacionUsuariosAClientes === 'function') {
            window.asegurarSincronizacionUsuariosAClientes(false);
        }
        const clientesLista = Array.isArray(window.AppState?.clientes) ? window.AppState.clientes : [];
        const cliMatch = clientesLista.find(c =>
            (pedido.clienteId && normalizarCedula(c.id) === normalizarCedula(pedido.clienteId)) ||
            (pedido.clienteCedula && (normalizarCedula(c.cedula) === normalizarCedula(pedido.clienteCedula) || normalizarCedula(c.id) === normalizarCedula(pedido.clienteCedula))) ||
            (pedido.clienteNombre && String(c.nombre || '').trim().toLowerCase() === String(pedido.clienteNombre || '').trim().toLowerCase())
        );

        if (typeof window.actualizarSelectClientes === 'function') window.actualizarSelectClientes();
        if (typeof window.renderizarCustomClientePickersPOS === 'function') window.renderizarCustomClientePickersPOS('both');

        if (cliMatch && typeof window.seleccionarClientePOS === 'function') {
            window.seleccionarClientePOS(cliMatch.id, 'desktop');
        }

        // Ajustar condición de pago en POS según preferencia del cliente
        const esCredito = String(pedido.metodoPagoPreferido || '').toLowerCase().includes('crédito') ||
                          String(pedido.metodoPagoPreferido || '').toLowerCase().includes('credito');
        const cond = esCredito ? 'Crédito' : 'Contado';
        const desktopSel = document.getElementById('pos-tipo-pago');
        const mobileSel = document.getElementById('pos-tipo-pago-mobile');
        if (desktopSel) desktopSel.value = cond;
        if (mobileSel) mobileSel.value = cond;
        if (typeof window.sincronizarCondicionPago === 'function') window.sincronizarCondicionPago('pos-tipo-pago');

        // Si estaba PENDIENTE, pasarlo a PREPARANDO automáticamente
        if (String(pedido.estado || '').toUpperCase() === 'PENDIENTE') {
            actualizarEstadoPedido(pedido.id, 'PREPARANDO').catch(() => {});
        }

        if (typeof window.renderizarCarrito === 'function') window.renderizarCarrito();
        renderizarBannerPedidoActivoEnPOS();
        cerrarModalBandejaPedidosPOS();

        // En pantallas móviles abrir el drawer del carrito para cobrar enseguida
        if (window.innerWidth < 900 && typeof window.abrirDrawerCarritoMobile === 'function') {
            window.abrirDrawerCarritoMobile();
        }

        if (advertencias.length > 0) {
            toast(`Encargo ${pedido.codigoCorto} cargado con ajustes: ${advertencias.join('; ')}.`, 'warning', 5500);
        } else {
            toast(`Encargo ${pedido.codigoCorto} de ${pedido.clienteNombre} cargado en el POS. ¡Listo para cobrar!`, 'success', 4000);
        }
    }

    function renderizarBannerPedidoActivoEnPOS() {
        const pedidoId = window.AppState?.pedidoPOSActivoId;
        const pedido = pedidoId ? obtenerListaPedidos().find(p => p && p.id === pedidoId) : null;

        ['pos-desktop-cart-panel', 'pos-drawer-items-list'].forEach(containerId => {
            const container = document.getElementById(containerId);
            if (!container) return;
            const bannerId = `pos-active-preorder-banner-${containerId}`;
            let banner = document.getElementById(bannerId);

            if (!pedido) {
                if (banner) banner.remove();
                return;
            }

            if (!banner) {
                banner = document.createElement('div');
                banner.id = bannerId;
                if (containerId === 'pos-desktop-cart-panel') {
                    const header = container.querySelector('.pos-cart-header');
                    if (header && header.nextSibling) {
                        container.insertBefore(banner, header.nextSibling);
                    } else {
                        container.prepend(banner);
                    }
                } else {
                    container.parentNode.insertBefore(banner, container);
                }
            }

            const esDeliv = pedido.modalidadEntrega === 'DELIVERY';
            banner.innerHTML = `
                <div style="margin:8px 12px; padding:8px 11px; border-radius:10px; background:#ecfdf5; border:1px solid #86efac; display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <div style="font-size:0.76rem; color:#166534; line-height:1.3;">
                        <strong style="display:block;"><i class="fas fa-bag-shopping"></i> Atendiendo Encargo ${esc(pedido.codigoCorto)} — ${esc(pedido.clienteNombre)}</strong>
                        <span>${esDeliv ? '🛵 Delivery' : '🏪 Retiro'} · Pago sugerido: ${esc(pedido.metodoPagoPreferido || 'A convenir')}</span>
                    </div>
                    <button type="button" onclick="limpiarPedidoActivoEnPOS()" title="Desvincular encargo del carrito" style="background:transparent; border:none; color:#15803d; cursor:pointer; font-size:0.85rem; padding:4px;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        });
    }

    function limpiarPedidoActivoEnPOS() {
        window.AppState.pedidoPOSActivoId = null;
        renderizarBannerPedidoActivoEnPOS();
        renderizarBarraPOS();
    }

    async function completarPedidoActivoPorVenta(ventaId) {
        const pedidoId = window.AppState?.pedidoPOSActivoId;
        if (!pedidoId) return;
        window.AppState.pedidoPOSActivoId = null;
        renderizarBannerPedidoActivoEnPOS();
        await actualizarEstadoPedido(pedidoId, 'COMPLETADO', {
            ventaId: String(ventaId || ''),
            fechaCompletado: new Date().toISOString()
        });
    }

    function refrescarTodasLasVistasPedidos() {
        renderizarBarraPOS();
        renderizarBannerPedidoActivoEnPOS();
        actualizarBadgeEncargosCliente();
        if (document.getElementById('modal-pos-pedidos-adelantados')?.classList.contains('active')) {
            renderizarContenidoBandejaPOS();
        }
        if (document.getElementById('modal-cliente-mis-encargos')?.classList.contains('active')) {
            renderizarContenidoMisEncargosCliente();
        }
    }

    // Exportar API global
    window.abrirModalEnviarEncargo = abrirModalEnviarEncargo;
    window.cerrarModalEnviarEncargo = cerrarModalEnviarEncargo;
    window.actualizarModalidadEncargoUI = actualizarModalidadEncargoUI;
    window.confirmarEnvioEncargoCliente = confirmarEnvioEncargoCliente;
    window.abrirModalMisEncargosCliente = abrirModalMisEncargosCliente;
    window.cerrarModalMisEncargosCliente = cerrarModalMisEncargosCliente;
    window.cancelarEncargoPorCliente = cancelarEncargoPorCliente;
    window.avisarWhatsAppEncargoCliente = avisarWhatsAppEncargoCliente;
    window.abrirModalBandejaPedidosPOS = abrirModalBandejaPedidosPOS;
    window.cerrarModalBandejaPedidosPOS = cerrarModalBandejaPedidosPOS;
    window.cambiarFiltroBandejaPedidosPOS = cambiarFiltroBandejaPedidosPOS;
    window.cargarPedidoAdelantadoEnPOS = cargarPedidoAdelantadoEnPOS;
    window.cambiarEstadoPedidoAdelantado = cambiarEstadoPedidoAdelantado;
    window.cancelarPedidoAdelantadoAdmin = cancelarPedidoAdelantadoAdmin;
    window.eliminarPedidoAdelantadoAdmin = eliminarPedidoAdelantadoAdmin;
    window.notificarClientePedidoWhatsApp = notificarClientePedidoWhatsApp;
    window.limpiarPedidoActivoEnPOS = limpiarPedidoActivoEnPOS;

    window.InventoryApp.PedidosAdelantados = {
        abrirModalEnviarEncargo,
        abrirModalMisEncargosCliente,
        abrirModalBandejaPedidosPOS,
        cargarPedidoAdelantadoEnPOS,
        completarPedidoActivoPorVenta,
        limpiarPedidoActivoEnPOS,
        renderizarBarraPOS,
        renderizarBannerPedidoActivoEnPOS,
        actualizarBadgeEncargosCliente,
        refrescarTodasLasVistasPedidos
    };
})();
