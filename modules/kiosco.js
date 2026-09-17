/**
 * Módulo: Kiosco de Auto-Servicio (Self-Checkout)
 * Sistema: Tu Bodeguita de Confianza
 * 
 * Permite a clientes realizar compras de forma autónoma, táctil y guiada.
 * Los pedidos se guardan en Firestore con estado "PENDIENTE_CONFIRMACION" (sin descontar stock).
 * El administrador recibe alertas en tiempo real para aprobar/cobrar el pedido.
 */

(function() {
    'use strict';

    let carritoKiosco = [];
    let categoriaKioscoActiva = 'TODOS';
    let busquedaKiosco = '';
    let clienteKiosco = null; // { cedula, nombre, telefono }
    let metodoPagoKiosco = 'PAGO_MOVIL'; // PAGO_MOVIL, EFECTIVO_USD, EFECTIVO_VES, PUNTO_VENTA
    let pasoKiosco = 1; // 1: Catálogo, 2: Identificación, 3: Pago, 4: Confirmación
    let timerRegresoInactividad = null;
    const TIEMPO_INACTIVIDAD_CONFIRMACION = 25000; // 25s para volver al inicio tras compra

    /**
     * Inicializa el módulo de Kiosco
     */
    function initKiosco() {
        renderizarHeaderKiosco();
        renderizarCategoriasKiosco();
        renderizarProductosKiosco();
        actualizarResumenCarritoKiosco();
    }

    /**
     * Renderiza o actualiza la cabecera visual del Kiosco (Tasa BCV y fecha)
     */
    function renderizarHeaderKiosco() {
        const tasaUSD = Number(window.AppState?.tasaActiva || window.AppState?.tasaUSD_BCV || 0);
        const fechaAct = window.AppState?.fechaActualizacionTasa || new Date().toLocaleDateString('es-VE');
        
        const elTasa = document.getElementById('kiosco-tasa-valor');
        if (elTasa) {
            elTasa.textContent = tasaUSD > 0 ? `Bs. ${tasaUSD.toFixed(2)}` : 'Sincronizando...';
        }
        const elFecha = document.getElementById('kiosco-tasa-fecha');
        if (elFecha) {
            elFecha.textContent = fechaAct;
        }
    }

    /**
     * Renderiza los chips de categorías para el catálogo táctil
     */
    function renderizarCategoriasKiosco() {
        const contenedor = document.getElementById('kiosco-categorias-chips');
        if (!contenedor) return;

        const productos = Array.isArray(window.AppState?.productos) ? window.AppState.productos : [];
        const categoriasSet = new Set(['TODOS']);
        productos.forEach(p => {
            if (p && p.categoria && String(p.categoria).trim()) {
                categoriasSet.add(String(p.categoria).trim());
            }
        });

        const categorias = Array.from(categoriasSet);
        contenedor.innerHTML = categorias.map(cat => {
            const esActiva = (cat === categoriaKioscoActiva);
            const icono = cat === 'TODOS' ? 'fa-th-large' : 'fa-tag';
            return `
                <button type="button" class="kiosco-cat-chip ${esActiva ? 'active' : ''}" 
                        onclick="window.KioscoModule.seleccionarCategoria('${cat.replace(/'/g, "\\'")}')">
                    <i class="fas ${icono}"></i>
                    <span>${cat}</span>
                </button>
            `;
        }).join('');
    }

    /**
     * Filtra y renderiza los productos en la cuadrícula táctil del Kiosco
     */
    function renderizarProductosKiosco() {
        const grid = document.getElementById('kiosco-productos-grid');
        if (!grid) return;

        const productos = Array.isArray(window.AppState?.productos) ? window.AppState.productos : [];
        const tasa = Number(window.AppState?.tasaActiva || window.AppState?.tasaUSD_BCV || 0);

        const filtrados = productos.filter(p => {
            if (!p) return false;
            // Filtro de categoría
            if (categoriaKioscoActiva !== 'TODOS' && String(p.categoria || '').trim() !== categoriaKioscoActiva) {
                return false;
            }
            // Filtro de búsqueda
            if (busquedaKiosco) {
                const term = busquedaKiosco.toLowerCase().trim();
                const nom = String(p.nombre || '').toLowerCase();
                const cod = String(p.codigo || p.id || '').toLowerCase();
                const cat = String(p.categoria || '').toLowerCase();
                if (!nom.includes(term) && !cod.includes(term) && !cat.includes(term)) {
                    return false;
                }
            }
            return true;
        });

        if (filtrados.length === 0) {
            grid.innerHTML = `
                <div class="kiosco-empty-products">
                    <i class="fas fa-box-open"></i>
                    <p>No se encontraron productos disponibles</p>
                    <small>Intenta con otra categoría o limpia el buscador</small>
                </div>
            `;
            return;
        }

        grid.innerHTML = filtrados.map(p => {
            const stock = Number(p.stock || 0);
            const precioUSD = Number(p.precio || 0);
            const precioVES = tasa > 0 ? (precioUSD * tasa) : 0;
            const agotado = stock <= 0;
            const esCombo = Boolean(p.esCombo === true || String(p.nombre || '').toLowerCase().includes('combo') || String(p.categoria || '').toLowerCase().includes('combo'));

            const rawImg = p.imagen;
            const imagenSrc = (typeof normalizarUrlBlob === 'function' ? normalizarUrlBlob(rawImg) : rawImg) || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=60';

            // Cantidad ya agregada al carrito
            const itemEnCarrito = carritoKiosco.find(i => i.productoId === p.id);
            const cantEnCarrito = itemEnCarrito ? itemEnCarrito.cantidad : 0;

            return `
                <div class="kiosco-product-card ${agotado ? 'card-agotado' : ''} ${esCombo ? 'es-combo' : ''}" 
                     id="kiosco-card-${p.id}"
                     onclick="${agotado ? '' : `window.KioscoModule.agregarAlCarrito('${p.id}')`}">
                    
                    <div class="kiosco-product-img-wrap">
                        <img src="${imagenSrc}" alt="${p.nombre}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=60'">
                        ${agotado ? '<div class="kiosco-badge-agotado">Agotado</div>' : ''}
                        ${esCombo ? '<div class="kiosco-badge-combo"><i class="fas fa-fire"></i> Combo</div>' : ''}
                        ${cantEnCarrito > 0 ? `<div class="kiosco-badge-en-carrito"><i class="fas fa-check"></i> ${cantEnCarrito} en orden</div>` : ''}
                    </div>

                    <div class="kiosco-product-info">
                        <div class="kiosco-product-category">${p.categoria || 'General'}</div>
                        <h3 class="kiosco-product-name" title="${p.nombre}">${p.nombre}</h3>
                        
                        <div class="kiosco-product-pricing">
                            <span class="kiosco-price-usd">$${precioUSD.toFixed(2)}</span>
                            <span class="kiosco-price-ves">Bs. ${precioVES > 0 ? precioVES.toFixed(2) : '—'}</span>
                        </div>

                        <div class="kiosco-product-stock-tag ${stock <= 3 && !agotado ? 'stock-bajo' : ''}">
                            ${agotado ? 'Sin existencias' : (stock <= 5 ? `¡Solo quedan ${stock}!` : `Disponible: ${stock}`)}
                        </div>
                    </div>

                    <button type="button" class="kiosco-btn-add-touch ${agotado ? 'disabled' : ''}" ${agotado ? 'disabled' : ''} 
                            onclick="event.stopPropagation(); window.KioscoModule.agregarAlCarrito('${p.id}')">
                        <i class="fas ${cantEnCarrito > 0 ? 'fa-plus' : 'fa-cart-plus'}"></i>
                        <span>${agotado ? 'Agotado' : (cantEnCarrito > 0 ? 'Agregar más' : 'Agregar')}</span>
                    </button>
                </div>
            `;
        }).join('');
    }

    /**
     * Agrega un producto al carrito del Kiosco
     */
    function agregarAlCarrito(productoId) {
        const productos = Array.isArray(window.AppState?.productos) ? window.AppState.productos : [];
        const prod = productos.find(p => p.id === productoId);
        if (!prod) return;

        const stockDisponible = Number(prod.stock || 0);
        if (stockDisponible <= 0) {
            if (window.InventoryApp?.Modal?.toast) {
                window.InventoryApp.Modal.toast('Este producto está agotado actualmente.', 'warning');
            }
            return;
        }

        const itemExistente = carritoKiosco.find(i => i.productoId === productoId);
        if (itemExistente) {
            if (itemExistente.cantidad >= stockDisponible) {
                if (window.InventoryApp?.Modal?.toast) {
                    window.InventoryApp.Modal.toast(`No puedes agregar más de ${stockDisponible} unidades de este producto.`, 'warning');
                }
                return;
            }
            itemExistente.cantidad++;
        } else {
            carritoKiosco.push({
                productoId: prod.id,
                nombre: prod.nombre,
                precio: Number(prod.precio || 0),
                costo: Number(prod.costo || 0),
                cantidad: 1,
                imagen: prod.imagen
            });
        }

        // Animación táctil
        animarCardProducto(productoId);
        actualizarResumenCarritoKiosco();
        renderizarProductosKiosco();

        if (window.InventoryApp?.Modal?.toast) {
            window.InventoryApp.Modal.toast(`Agregado: ${prod.nombre}`, 'info', 1500);
        }
    }

    /**
     * Modifica la cantidad de un ítem en el carrito
     */
    function modificarCantidad(index, delta) {
        if (!carritoKiosco[index]) return;
        const item = carritoKiosco[index];
        const productos = Array.isArray(window.AppState?.productos) ? window.AppState.productos : [];
        const prod = productos.find(p => p.id === item.productoId);
        const stockDisponible = Number(prod?.stock || 999);

        const nuevaCantidad = item.cantidad + delta;
        if (nuevaCantidad <= 0) {
            carritoKiosco.splice(index, 1);
        } else if (nuevaCantidad > stockDisponible) {
            if (window.InventoryApp?.Modal?.toast) {
                window.InventoryApp.Modal.toast(`Stock máximo disponible alcanzado (${stockDisponible})`, 'warning');
            }
            return;
        } else {
            item.cantidad = nuevaCantidad;
        }

        actualizarResumenCarritoKiosco();
        renderizarProductosKiosco();
    }

    /**
     * Vacía el carrito del Kiosco de forma inmediata sin confirmación
     */
    function vaciarCarrito() {
        if (carritoKiosco.length === 0) return;
        carritoKiosco = [];
        actualizarResumenCarritoKiosco();
        renderizarProductosKiosco();
        if (window.InventoryApp?.Modal?.toast) {
            window.InventoryApp.Modal.toast('Carrito vaciado', 'info', 1800);
        }
    }

    /**
     * Anima visualmente la tarjeta de producto tras tocar agregar
     */
    function animarCardProducto(id) {
        const card = document.getElementById(`kiosco-card-${id}`);
        if (card) {
            card.classList.add('kiosco-card-pop');
            setTimeout(() => card.classList.remove('kiosco-card-pop'), 300);
        }
    }

    /**
     * Actualiza la barra lateral / flotante de la orden actual
     */
    function actualizarResumenCarritoKiosco() {
        const tasa = Number(window.AppState?.tasaActiva || window.AppState?.tasaUSD_BCV || 0);
        let totalUSD = 0;
        let totalItems = 0;

        carritoKiosco.forEach(it => {
            totalUSD += (it.precio * it.cantidad);
            totalItems += it.cantidad;
        });

        const totalVES = tasa > 0 ? (totalUSD * tasa) : 0;

        // Badges numéricos
        const elCount = document.getElementById('kiosco-badge-total-items');
        if (elCount) elCount.textContent = totalItems;
        const elDrawerCount = document.getElementById('kiosco-drawer-total-count');
        if (elDrawerCount) elDrawerCount.textContent = `${totalItems} ${totalItems === 1 ? 'producto' : 'productos'}`;

        // Totales en pantalla
        const elTotUSD = document.getElementById('kiosco-total-usd');
        if (elTotUSD) elTotUSD.textContent = `$${totalUSD.toFixed(2)}`;
        const elTotVES = document.getElementById('kiosco-total-ves');
        if (elTotVES) elTotVES.textContent = `Bs. ${tasa > 0 ? totalVES.toFixed(2) : '—'}`;

        // Botón Continuar / Proceder
        const btnContinuar = document.getElementById('kiosco-btn-continuar-pedido');
        if (btnContinuar) {
            btnContinuar.disabled = (carritoKiosco.length === 0);
        }

        // Barra inferior flotante para pantallas táctiles verticales
        const barMobile = document.getElementById('kiosco-bottom-cart-bar');
        if (barMobile) {
            barMobile.style.display = totalItems > 0 ? 'flex' : 'none';
        }
        const barMobileUSD = document.getElementById('kiosco-mobile-total-usd');
        if (barMobileUSD) barMobileUSD.textContent = `$${totalUSD.toFixed(2)}`;
        const barMobileVES = document.getElementById('kiosco-mobile-total-ves');
        if (barMobileVES) barMobileVES.textContent = `Bs. ${tasa > 0 ? totalVES.toFixed(2) : '—'}`;
        const barMobileCount = document.getElementById('kiosco-mobile-cart-count');
        if (barMobileCount) barMobileCount.textContent = totalItems;

        // Lista de ítems en el panel lateral de orden
        const listaEl = document.getElementById('kiosco-items-orden-lista');
        const emptyEl = document.getElementById('kiosco-orden-vacia');
        if (listaEl && emptyEl) {
            if (carritoKiosco.length === 0) {
                listaEl.innerHTML = '';
                listaEl.style.display = 'none';
                emptyEl.style.display = 'flex';
            } else {
                emptyEl.style.display = 'none';
                listaEl.style.display = 'flex';
                listaEl.innerHTML = carritoKiosco.map((item, idx) => {
                    const subtotalUSD = item.precio * item.cantidad;
                    return `
                        <div class="kiosco-cart-item">
                            <div class="kiosco-cart-item-info">
                                <strong>${item.nombre}</strong>
                                <small>$${item.precio.toFixed(2)} c/u</small>
                            </div>
                            <div class="kiosco-cart-item-controls">
                                <div class="kiosco-stepper">
                                    <button type="button" onclick="window.KioscoModule.modificarCantidad(${idx}, -1)">-</button>
                                    <span>${item.cantidad}</span>
                                    <button type="button" onclick="window.KioscoModule.modificarCantidad(${idx}, 1)">+</button>
                                </div>
                                <div class="kiosco-cart-item-subtotal">
                                    $${subtotalUSD.toFixed(2)}
                                </div>
                                <button type="button" class="kiosco-btn-remove-item" onclick="window.KioscoModule.modificarCantidad(${idx}, -${item.cantidad})" title="Quitar">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
    }

    /**
     * Inicia el flujo Guiado (Wizard): Paso 2 - Identificación del Cliente
     */
    function iniciarCheckoutKiosco() {
        if (carritoKiosco.length === 0) {
            if (window.InventoryApp?.Modal?.toast) {
                window.InventoryApp.Modal.toast('Agrega al menos un producto a tu pedido.', 'warning');
            }
            return;
        }

        pasoKiosco = 2;
        mostrarModalWizardKiosco();
        mostrarPasoWizard(2);
    }

    /**
     * Muestra el modal del Wizard de Compra
     */
    function mostrarModalWizardKiosco() {
        const modal = document.getElementById('modal-kiosco-wizard');
        if (modal) {
            modal.classList.add('active');
            modal.style.display = 'flex';
        }
    }

    /**
     * Cierra el modal del Wizard de Compra
     */
    function cerrarModalWizardKiosco() {
        const modal = document.getElementById('modal-kiosco-wizard');
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
        }
        pasoKiosco = 1;
    }

    /**
     * Muestra el paso correspondiente del Wizard
     */
    function mostrarPasoWizard(paso) {
        pasoKiosco = paso;

        // Actualizar stepper visual
        const step1 = document.getElementById('kiosco-step-indicator-1');
        const step2 = document.getElementById('kiosco-step-indicator-2');
        const step3 = document.getElementById('kiosco-step-indicator-3');
        const step4 = document.getElementById('kiosco-step-indicator-4');

        if (step1) step1.className = `kiosco-step-item ${paso >= 1 ? 'active' : ''} ${paso > 1 ? 'completed' : ''}`;
        if (step2) step2.className = `kiosco-step-item ${paso >= 2 ? 'active' : ''} ${paso > 2 ? 'completed' : ''}`;
        if (step3) step3.className = `kiosco-step-item ${paso >= 3 ? 'active' : ''} ${paso > 3 ? 'completed' : ''}`;
        if (step4) step4.className = `kiosco-step-item ${paso >= 4 ? 'active' : ''}`;

        // Mostrar contenedor de vista del paso
        const vistaPaso2 = document.getElementById('kiosco-wizard-paso-2');
        const vistaPaso3 = document.getElementById('kiosco-wizard-paso-3');
        const vistaPaso4 = document.getElementById('kiosco-wizard-paso-4');

        if (vistaPaso2) vistaPaso2.style.display = (paso === 2 ? 'block' : 'none');
        if (vistaPaso3) vistaPaso3.style.display = (paso === 3 ? 'block' : 'none');
        if (vistaPaso4) vistaPaso4.style.display = (paso === 4 ? 'block' : 'none');

        if (paso === 3) {
            prepararPasoPagoKiosco();
        }
    }

    /**
     * Busca o autocompleta cliente al ingresar su cédula en el Kiosco
     */
    function alEscribirCedulaKiosco(cedulaIngresada) {
        const clean = String(cedulaIngresada || '').trim().toUpperCase();
        if (clean.length < 4) return;

        const clientes = Array.isArray(window.AppState?.clientes) ? window.AppState.clientes : [];
        const cli = clientes.find(c => String(c.id || c.cedula || '').trim().toUpperCase() === clean);

        const inputNombre = document.getElementById('kiosco-input-nombre');
        const inputTelefono = document.getElementById('kiosco-input-telefono');
        const badgeAutofill = document.getElementById('kiosco-cliente-autofill-badge');

        if (cli) {
            if (inputNombre && !inputNombre.value) inputNombre.value = cli.nombre || '';
            if (inputTelefono && !inputTelefono.value) inputTelefono.value = cli.telefono || '';
            if (badgeAutofill) {
                badgeAutofill.style.display = 'inline-flex';
                badgeAutofill.innerHTML = `<i class="fas fa-check-circle"></i> ¡Cliente frecuente reconocido!`;
            }
        } else {
            if (badgeAutofill) badgeAutofill.style.display = 'none';
        }
    }

    /**
     * Valida la identificación y avanza al Paso 3: Selección de Pago
     */
    function avanzarPasoPago() {
        const inputCedula = document.getElementById('kiosco-input-cedula');
        const inputNombre = document.getElementById('kiosco-input-nombre');
        const inputTelefono = document.getElementById('kiosco-input-telefono');

        const cedula = String(inputCedula?.value || '').trim();
        const nombre = String(inputNombre?.value || '').trim();
        const telefono = String(inputTelefono?.value || '').trim();

        if (!cedula) {
            if (window.InventoryApp?.Modal?.toast) {
                window.InventoryApp.Modal.toast('Por favor ingresa tu número de Cédula o RIF.', 'warning');
            }
            inputCedula?.focus();
            return;
        }

        if (!nombre) {
            if (window.InventoryApp?.Modal?.toast) {
                window.InventoryApp.Modal.toast('Por favor escribe tu Nombre y Apellido para identificarte.', 'warning');
            }
            inputNombre?.focus();
            return;
        }

        clienteKiosco = { cedula, nombre, telefono };
        mostrarPasoWizard(3);
    }

    /**
     * Prepara el resumen y los datos bancarios para el paso de Pago
     */
    function prepararPasoPagoKiosco() {
        const tasa = Number(window.AppState?.tasaActiva || window.AppState?.tasaUSD_BCV || 0);
        let totalUSD = 0;
        carritoKiosco.forEach(it => totalUSD += (it.precio * it.cantidad));
        const totalVES = tasa > 0 ? (totalUSD * tasa) : 0;

        // Nombre y cédula
        const elClienteNom = document.getElementById('kiosco-pago-cliente-resumen');
        if (elClienteNom && clienteKiosco) {
            elClienteNom.textContent = `${clienteKiosco.nombre} (${clienteKiosco.cedula})`;
        }

        // Totales
        const elUSD = document.getElementById('kiosco-pago-total-usd');
        if (elUSD) elUSD.textContent = `$${totalUSD.toFixed(2)}`;
        const elVES = document.getElementById('kiosco-pago-total-ves');
        if (elVES) elVES.textContent = `Bs. ${tasa > 0 ? totalVES.toFixed(2) : '—'}`;

        // Cuentas bancarias configuradas
        const datosPagoMovil = document.getElementById('kiosco-datos-pago-movil');
        if (datosPagoMovil) {
            const cuentas = Array.isArray(window.AppState?.cuentasBancarias) ? window.AppState.cuentasBancarias : [];
            const cuentaPM = cuentas.find(c => String(c.tipo || '').toLowerCase().includes('móvil') || String(c.tipo || '').toLowerCase().includes('movil')) || cuentas[0];
            if (cuentaPM) {
                datosPagoMovil.innerHTML = `
                    <div class="kiosco-bank-card">
                        <div class="kiosco-bank-row"><span>Banco:</span> <strong>${cuentaPM.banco || 'Banco Nacional'}</strong></div>
                        <div class="kiosco-bank-row"><span>Teléfono:</span> <strong>${cuentaPM.telefono || '0412-0000000'}</strong></div>
                        <div class="kiosco-bank-row"><span>Cédula / RIF:</span> <strong>${cuentaPM.cedula || 'V-00000000'}</strong></div>
                    </div>
                `;
            } else {
                datosPagoMovil.innerHTML = `
                    <div class="kiosco-bank-card">
                        <div class="kiosco-bank-row"><span>Pago en Caja:</span> <strong>Indica tu cédula al operador para pagar en mostrador.</strong></div>
                    </div>
                `;
            }
        }

        seleccionarMetodoPagoKiosco(metodoPagoKiosco);
    }

    /**
     * Cambia el método de pago seleccionado en el Wizard
     */
    function seleccionarMetodoPagoKiosco(metodo) {
        metodoPagoKiosco = metodo;

        document.querySelectorAll('.kiosco-pay-method-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-metodo') === metodo);
        });

        const boxPM = document.getElementById('kiosco-box-pago-movil');
        const boxEfectivo = document.getElementById('kiosco-box-efectivo');
        const inputRef = document.getElementById('kiosco-input-referencia');

        if (metodo === 'PAGO_MOVIL') {
            if (boxPM) boxPM.style.display = 'block';
            if (boxEfectivo) boxEfectivo.style.display = 'none';
            if (inputRef) {
                inputRef.placeholder = 'Últimos 4 o 6 dígitos de referencia bancaria';
                inputRef.required = false; // No bloquea si el cliente pagará en mostrador
            }
        } else {
            if (boxPM) boxPM.style.display = 'none';
            if (boxEfectivo) boxEfectivo.style.display = 'block';
            if (inputRef) {
                inputRef.placeholder = 'Referencia no requerida para efectivo';
                inputRef.value = '';
            }
        }
    }

    /**
     * Envía y asienta el pedido de auto-servicio con estado PENDIENTE_CONFIRMACION
     * Regla estricta: NO descuenta el inventario de inmediato. Queda en cola de aprobación para el Administrador.
     */
    async function confirmarPedidoKiosco() {
        if (carritoKiosco.length === 0 || !clienteKiosco) return;

        const btnConfirmar = document.getElementById('kiosco-btn-confirmar-final');
        if (btnConfirmar) {
            btnConfirmar.disabled = true;
            btnConfirmar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando Pedido...';
        }

        try {
            const tasa = Number(window.AppState?.tasaActiva || window.AppState?.tasaUSD_BCV || 0);
            let totalUSD = 0;
            carritoKiosco.forEach(it => totalUSD += (it.precio * it.cantidad));
            const totalVES = tasa > 0 ? (totalUSD * tasa) : 0;

            const inputRef = document.getElementById('kiosco-input-referencia');
            const referencia = String(inputRef?.value || '').trim() || (metodoPagoKiosco === 'PAGO_MOVIL' ? 'PAGO-MOVIL-KIOSCO' : 'EFECTIVO-EN-CAJA');

            // Generar identificador de pedido único de Kiosco
            const consecutivo = (window.AppState?.ventas?.length || 0) + 1;
            const pedidoId = `KIO_${consecutivo}_${Date.now().toString().slice(-4)}`;
            const fechaHora = new Date().toISOString().replace('T', ' ').substring(0, 16);

            const itemsPedido = carritoKiosco.map(item => ({
                productoId: item.productoId,
                nombre: item.nombre,
                cantidad: item.cantidad,
                precio: item.precio,
                costo: item.costo,
                subtotal: (item.precio * item.cantidad)
            }));

            // 1. Guardar cliente en AppState si no existe aún
            if (Array.isArray(window.AppState?.clientes)) {
                const existeCli = window.AppState.clientes.find(c => String(c.id).toUpperCase() === clienteKiosco.cedula.toUpperCase());
                if (!existeCli) {
                    window.AppState.clientes.push({
                        id: clienteKiosco.cedula,
                        nombre: clienteKiosco.nombre,
                        telefono: clienteKiosco.telefono,
                        email: ''
                    });
                }
            }

            // 2. Crear registro de venta pendiente (Sin descontar stock de inventario)
            const nuevaVentaKiosco = {
                id: pedidoId,
                clienteId: clienteKiosco.cedula,
                clienteNombre: clienteKiosco.nombre,
                clienteTelefono: clienteKiosco.telefono,
                vendedorId: 'AutoServicio',
                vendedorNombre: 'Kiosco Auto-Servicio',
                fecha: fechaHora,
                items: itemsPedido,
                total: totalUSD,
                totalUSD: totalUSD,
                totalVES: totalVES,
                tipo: metodoPagoKiosco === 'PAGO_MOVIL' ? 'Pago Móvil' : 'Efectivo',
                tipoPago: metodoPagoKiosco === 'PAGO_MOVIL' ? 'Pago Móvil' : 'Efectivo',
                referencia: referencia,
                estado: 'PENDIENTE_CONFIRMACION',
                confirmada: false,
                descontadoInventario: false, // Importante: no descontado hasta aprobación
                esKiosco: true,
                origen: 'Kiosco Auto-Servicio'
            };

            if (!Array.isArray(window.AppState.ventas)) window.AppState.ventas = [];
            window.AppState.ventas.unshift(nuevaVentaKiosco);

            // 3. Crear registro en PagosPorVerificar para que aparezca en Transacciones Admin con badge de alerta
            const nuevoPagoPorVerificar = {
                id: pedidoId,
                pedidoId: pedidoId,
                ventaId: pedidoId,
                clienteId: clienteKiosco.cedula,
                clienteCedula: clienteKiosco.cedula,
                clienteNombre: clienteKiosco.nombre,
                clienteTelefono: clienteKiosco.telefono,
                totalUSD: totalUSD,
                montoUSD: totalUSD,
                totalVES: totalVES,
                montoVES: totalVES,
                tasaMomento: tasa,
                metodoPago: metodoPagoKiosco === 'PAGO_MOVIL' ? 'Pago Móvil (Kiosco)' : 'Efectivo (Kiosco)',
                tipoPago: metodoPagoKiosco === 'PAGO_MOVIL' ? 'Pago Móvil' : 'Efectivo',
                tipo: 'VENTA_KIOSCO',
                tipoRegistro: 'VENTA',
                referencia: referencia,
                items: itemsPedido,
                fecha: fechaHora,
                fechaISO: new Date().toISOString(),
                estado: 'PENDIENTE_VERIFICACION',
                esKiosco: true,
                origen: 'Kiosco Auto-Servicio',
                nota: `Pedido de Auto-Servicio #${pedidoId} realizado por ${clienteKiosco.nombre} (${itemsPedido.length} productos)`
            };

            if (!Array.isArray(window.AppState.pagosPorVerificar)) window.AppState.pagosPorVerificar = [];
            window.AppState.pagosPorVerificar.unshift(nuevoPagoPorVerificar);

            // 4. Sincronizar en Firebase Firestore
            if (window.InventoryApp?.Firebase?.guardarPagoPorVerificar) {
                window.InventoryApp.Firebase.guardarPagoPorVerificar(nuevoPagoPorVerificar).catch(err => {
                    console.warn('[Kiosco] Error al guardar en PagosPorVerificar:', err);
                });
            }

            // 5. Notificar a administradores y actualizar badges
            if (typeof window.registrarNotificacion === 'function') {
                window.registrarNotificacion({
                    id: 'notif_kiosco_' + pedidoId,
                    tipo: 'pedido_kiosco',
                    titulo: 'Nuevo Pedido en Kiosco',
                    mensaje: `Cliente ${clienteKiosco.nombre} (${clienteKiosco.cedula}) realizó el pedido #${pedidoId} por $${totalUSD.toFixed(2)} (${itemsPedido.length} productos). Pendiente por facturar y entregar.`,
                    clienteId: clienteKiosco.cedula,
                    clienteNombre: clienteKiosco.nombre,
                    montoUSD: totalUSD,
                    montoVES: totalVES,
                    referenciaId: pedidoId,
                    paraAdmin: true,
                    paraCliente: false,
                    destino: { tab: 'transacciones' }
                });
            }

            if (typeof renderizarAbonosPendientesReportados === 'function') {
                renderizarAbonosPendientesReportados();
            }
            if (typeof actualizarBadgesAbonos === 'function') {
                actualizarBadgesAbonos();
            }

            // 6. Guardar en almacenamiento de sesión
            if (window.InventoryApp?.Persistence?.guardar) {
                window.InventoryApp.Persistence.guardar(true);
            }

            // 7. Mostrar Pantalla de Confirmación y Ticket Visual (Paso 4)
            mostrarPantallaExitoKiosco(nuevaVentaKiosco);

        } catch (error) {
            console.error('[Kiosco] Error al procesar pedido:', error);
            if (window.InventoryApp?.Modal?.alert) {
                window.InventoryApp.Modal.alert('Error al Procesar', 'Ocurrió un inconveniente al generar tu orden. Por favor acércate a la caja para ser atendido.', 'error');
            }
        } finally {
            if (btnConfirmar) {
                btnConfirmar.disabled = false;
                btnConfirmar.innerHTML = '<i class="fas fa-check-circle"></i> Enviar Pedido a Caja';
            }
        }
    }

    /**
     * Muestra la pantalla de éxito con el ticket y número de orden
     */
    function mostrarPantallaExitoKiosco(venta) {
        mostrarPasoWizard(4);

        const elNumOrden = document.getElementById('kiosco-ticket-num-orden');
        if (elNumOrden) elNumOrden.textContent = `#${venta.id}`;

        const elNombre = document.getElementById('kiosco-ticket-cliente');
        if (elNombre) elNombre.textContent = `${venta.clienteNombre} (C.I: ${venta.clienteId})`;

        const elTotal = document.getElementById('kiosco-ticket-total');
        if (elTotal) {
            const vesStr = Number(venta.totalVES || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 });
            elTotal.innerHTML = `<strong>$${Number(venta.totalUSD || 0).toFixed(2)} USD</strong> <small>(Bs. ${vesStr})</small>`;
        }

        const listaItems = document.getElementById('kiosco-ticket-items');
        if (listaItems) {
            listaItems.innerHTML = (venta.items || []).map(it => `
                <div class="kiosco-ticket-item-row">
                    <span><strong>${it.cantidad}x</strong> ${it.nombre}</span>
                    <span>$${(it.precio * it.cantidad).toFixed(2)}</span>
                </div>
            `).join('');
        }

        // Vaciar carrito
        carritoKiosco = [];
        actualizarResumenCarritoKiosco();
        renderizarProductosKiosco();

        // Limpiar inputs
        const inCed = document.getElementById('kiosco-input-cedula');
        const inNom = document.getElementById('kiosco-input-nombre');
        const inTel = document.getElementById('kiosco-input-telefono');
        const inRef = document.getElementById('kiosco-input-referencia');
        if (inCed) inCed.value = '';
        if (inNom) inNom.value = '';
        if (inTel) inTel.value = '';
        if (inRef) inRef.value = '';
        clienteKiosco = null;

        // Iniciar cuenta regresiva para reiniciar la pantalla de auto-servicio
        iniciarTimerReinicioKiosco();
    }

    /**
     * Timer de auto-limpieza para que el kiosco vuelva a la pantalla de compra para el siguiente cliente
     */
    function iniciarTimerReinicioKiosco() {
        if (timerRegresoInactividad) clearInterval(timerRegresoInactividad);

        let segundosRestantes = 25;
        const elTimer = document.getElementById('kiosco-ticket-timer');
        if (elTimer) elTimer.textContent = `${segundosRestantes}s`;

        timerRegresoInactividad = setInterval(() => {
            segundosRestantes--;
            if (elTimer) elTimer.textContent = `${segundosRestantes}s`;

            if (segundosRestantes <= 0) {
                clearInterval(timerRegresoInactividad);
                timerRegresoInactividad = null;
                cerrarModalWizardKiosco();
            }
        }, 1000);
    }

    /**
     * Reinicia manualmente al finalizar
     */
    function reiniciarKioscoManual() {
        if (timerRegresoInactividad) {
            clearInterval(timerRegresoInactividad);
            timerRegresoInactividad = null;
        }
        cerrarModalWizardKiosco();
    }

    /**
     * Filtra por categoría seleccionada
     */
    function seleccionarCategoria(cat) {
        categoriaKioscoActiva = cat;
        renderizarCategoriasKiosco();
        renderizarProductosKiosco();
    }

    /**
     * Búsqueda en vivo de productos
     */
    function alBuscarProducto(term) {
        busquedaKiosco = term || '';
        renderizarProductosKiosco();
    }

    /**
     * Salir del modo Kiosco mediante PIN de Seguridad del Administrador
     */
    function solicitarSalidaKiosco() {
        const pinIngresado = prompt('Seguridad Kiosco: Ingresa la contraseña de Administrador para salir del modo auto-servicio:');
        if (!pinIngresado) return;

        const HASH_SUPERADMIN = '1a09807a0e6928a66d91025ed5fccd713c9edb101e72a1bbcb8a01cd9a53cb51';
        let passValido = false;

        if (window.InventoryApp?.Helpers?.verificarPasswordHash) {
            passValido = window.InventoryApp.Helpers.verificarPasswordHash(pinIngresado, HASH_SUPERADMIN);
        } else {
            passValido = (pinIngresado === '123456' || pinIngresado === 'admin' || pinIngresado === 'SuperAdmin');
        }

        // También verificar si coincide con cualquier admin registrado
        if (!passValido) {
            const adminUser = (window.AppState?.usuarios || []).find(u => u.rol === 'admin');
            if (adminUser) {
                if (window.InventoryApp?.Helpers?.verificarPasswordHash) {
                    passValido = window.InventoryApp.Helpers.verificarPasswordHash(pinIngresado, adminUser.password);
                } else {
                    passValido = (pinIngresado === adminUser.password);
                }
            }
        }

        if (passValido) {
            // Regresar a sesión admin o cerrar sesión
            if (typeof window.volverASesionAdmin === 'function') {
                window.volverASesionAdmin();
            } else if (typeof window.cerrarSesionUsuario === 'function') {
                window.cerrarSesionUsuario();
            }
        } else {
            alert('Contraseña incorrecta. El Kiosco permanece protegido.');
        }
    }

    // Exponer API global
    window.KioscoModule = {
        init: initKiosco,
        renderHeader: renderizarHeaderKiosco,
        renderCategorias: renderizarCategoriasKiosco,
        renderProductos: renderizarProductosKiosco,
        agregarAlCarrito,
        modificarCantidad,
        vaciarCarrito,
        seleccionarCategoria,
        alBuscarProducto,
        iniciarCheckout: iniciarCheckoutKiosco,
        alEscribirCedula: alEscribirCedulaKiosco,
        avanzarPasoPago,
        mostrarPasoWizard,
        seleccionarMetodoPago: seleccionarMetodoPagoKiosco,
        confirmarPedido: confirmarPedidoKiosco,
        reiniciarKiosco: reiniciarKioscoManual,
        cerrarWizard: cerrarModalWizardKiosco,
        solicitarSalida: solicitarSalidaKiosco
    };

})();
