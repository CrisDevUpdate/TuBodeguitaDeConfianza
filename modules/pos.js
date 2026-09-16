// --- POS MULTIMONEDA & MOBILE-FIRST ARCHITECTURE ---
let posModoVista = localStorage.getItem('pos_modo_vista') || 'grid';
let posCategoriaActiva = 'TODOS';

function cambiarModoVistaPOS(modo) {
    if (modo !== 'grid' && modo !== 'list') modo = 'grid';
    posModoVista = modo;
    try { localStorage.setItem('pos_modo_vista', modo); } catch {}

    const btnGrid = document.getElementById('btn-pos-view-grid');
    const btnList = document.getElementById('btn-pos-view-list');
    if (btnGrid) btnGrid.classList.toggle('active', modo === 'grid');
    if (btnList) btnList.classList.toggle('active', modo === 'list');

    const gridView = document.getElementById('pos-grid-view');
    const listView = document.getElementById('pos-list-view');
    const container = document.getElementById('pos-catalog-container');

    if (container) {
        container.className = `pos-catalog-container pos-mode-${modo}`;
    }
    if (gridView) gridView.style.display = modo === 'grid' ? 'grid' : 'none';
    if (listView) listView.style.display = modo === 'list' ? 'block' : 'none';

    renderizarPosProductos();
}

function seleccionarCategoriaPOS(cat) {
    posCategoriaActiva = cat || 'TODOS';
    actualizarChipsCategoriasPOS();
    renderizarPosProductos();
}

function limpiarBusquedaPOS() {
    const input = document.getElementById('pos-search');
    if (input) {
        input.value = '';
        input.focus();
    }
    const btnClear = document.getElementById('pos-search-clear');
    if (btnClear) btnClear.style.display = 'none';
    renderizarPosProductos();
}

function actualizarChipsCategoriasPOS() {
    const container = document.getElementById('pos-categories-chips');
    if (!container) return;

    const prods = Array.isArray(productos) ? productos : (AppState.productos || []);
    const categoriasSet = new Set();
    prods.forEach(p => {
        if (p.categoria && typeof p.categoria === 'string' && p.categoria.trim()) {
            categoriasSet.add(p.categoria.trim());
        }
    });

    if (Array.isArray(AppState.categoriasPersonalizadas)) {
        AppState.categoriasPersonalizadas.forEach(c => {
            if (c && typeof c === 'string' && c.trim()) categoriasSet.add(c.trim());
        });
    }

    const categorias = Array.from(categoriasSet).sort();

    const contar = (cat) => {
        if (cat === 'TODOS') return prods.length;
        return prods.filter(p => (p.categoria || '').trim().toLowerCase() === cat.toLowerCase()).length;
    };

    let html = `
        <button type="button" class="pos-chip ${posCategoriaActiva === 'TODOS' ? 'active' : ''}" 
                onclick="seleccionarCategoriaPOS('TODOS')">
            <span>Todos</span>
            <span class="chip-count">${contar('TODOS')}</span>
        </button>
    `;

    categorias.forEach(cat => {
        const count = contar(cat);
        const isActive = posCategoriaActiva.toLowerCase() === cat.toLowerCase();
        html += `
            <button type="button" class="pos-chip ${isActive ? 'active' : ''}" 
                    onclick="seleccionarCategoriaPOS('${cat.replace(/'/g, "\\'")}')">
                <span>${cat}</span>
                <span class="chip-count">${count}</span>
            </button>
        `;
    });

    container.innerHTML = html;
}

function renderizarPosProductos(filtro = null) {
    const searchInput = document.getElementById('pos-search');
    const f = (filtro !== null ? filtro : (searchInput ? searchInput.value : "")).trim().toLowerCase();

    const btnClear = document.getElementById('pos-search-clear');
    if (btnClear) {
        btnClear.style.display = f.length > 0 ? 'inline-block' : 'none';
    }

    const prods = Array.isArray(productos) ? productos : (AppState.productos || []);
    const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || tasaActiva || 0);

    const filtrados = prods.filter(p => {
        if (posCategoriaActiva !== 'TODOS') {
            const catProd = (p.categoria || '').trim().toLowerCase();
            if (catProd !== posCategoriaActiva.toLowerCase()) return false;
        }
        if (!f) return true;
        const nombre = (p.nombre || "").toLowerCase();
        const codigo = (p.codigo || "").toLowerCase();
        const cat = (p.categoria || "").toLowerCase();
        return nombre.includes(f) || codigo.includes(f) || cat.includes(f);
    });

    const countEl = document.getElementById('pos-catalog-count');
    if (countEl) {
        countEl.textContent = `${filtrados.length} ${filtrados.length === 1 ? 'producto encontrado' : 'productos encontrados'}`;
    }

    const activeCatEl = document.getElementById('pos-catalog-active-cat');
    if (activeCatEl) {
        if (posCategoriaActiva !== 'TODOS') {
            activeCatEl.textContent = `Filtro: ${posCategoriaActiva}`;
            activeCatEl.style.display = 'inline-block';
        } else {
            activeCatEl.style.display = 'none';
        }
    }

    actualizarChipsCategoriasPOS();

    // 1. Renderizar Cuadrícula Compacta
    const gridEl = document.getElementById('pos-grid-view');
    if (gridEl) {
        if (filtrados.length === 0) {
            gridEl.innerHTML = `
                <div style="grid-column: 1 / -1; padding: 40px 16px; text-align: center; color: var(--text-muted, #94a3b8);">
                    <i class="fas fa-box-open" style="font-size: 2.2rem; margin-bottom: 8px; opacity: 0.4;"></i>
                    <p style="font-weight: 700; margin: 4px 0; color: var(--text-secondary, #475569);">No se encontraron productos</p>
                    <small>Intenta buscar con otro término o selecciona "Todos"</small>
                </div>
            `;
        } else {
            gridEl.innerHTML = filtrados.map(p => {
                const stock = Number(p.stock || 0);
                const precioUSD = Number(p.precio || 0);
                const precioVES = tasa > 0 ? (precioUSD * tasa) : 0;
                const esAgotado = stock <= 0;
                const stockClase = esAgotado ? 'out-stock' : (stock <= 5 ? 'low-stock' : 'in-stock');
                const stockTexto = esAgotado ? 'Agotado' : (stock <= 5 ? `¡Solo ${stock}!` : `Stock: ${stock}`);

                const imagenHTML = p.imagen ? `
                    <img src="${p.imagen}" alt="${p.nombre}" class="pos-thumb-img" loading="lazy" 
                         onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'pos-thumb-fallback\\'><i class=\\'fas fa-box\\'></i></div>';">
                ` : `
                    <div class="pos-thumb-fallback"><i class="fas fa-box"></i></div>
                `;

                return `
                    <div class="pos-card-item ${esAgotado ? 'agotado' : ''}" id="pos-card-${p.id}">
                        <div class="pos-thumb-wrap">
                            ${imagenHTML}
                            <span class="pos-badge-stock ${stockClase}">${stockTexto}</span>
                            ${p.categoria ? `<span class="pos-badge-cat">${p.categoria}</span>` : ''}
                        </div>
                        <div class="pos-card-details">
                            <span class="pos-card-code">${p.codigo || 'S/C'}</span>
                            <div class="pos-card-name" title="${p.nombre}">${p.nombre}</div>
                        </div>
                        <div class="pos-card-pricing">
                            <span class="pos-price-usd">$${precioUSD.toFixed(2)}</span>
                            <span class="pos-price-ves">Bs. ${tasa > 0 ? precioVES.toFixed(2) : '—'}</span>
                        </div>
                        <button type="button" class="pos-btn-add" id="btn-pos-add-${p.id}" 
                                onclick="agregarAlCarrito('${p.id}')" ${esAgotado ? 'disabled' : ''}>
                            <i class="fas fa-plus"></i>
                            <span>${esAgotado ? 'Agotado' : '+ Agregar'}</span>
                        </button>
                    </div>
                `;
            }).join('');
        }
    }

    // 2. Renderizar Lista Compacta (tbody pos-productos-body)
    const tbody = document.getElementById('pos-productos-body');
    if (tbody) {
        if (filtrados.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 30px; color: var(--text-muted, #94a3b8);">
                        No hay productos que coincidan con el filtro
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = filtrados.map(p => {
                const stock = Number(p.stock || 0);
                const precioUSD = Number(p.precio || 0);
                const precioVES = tasa > 0 ? (precioUSD * tasa) : 0;
                const esAgotado = stock <= 0;
                const stockClase = esAgotado ? 'out-stock' : (stock <= 5 ? 'low-stock' : 'in-stock');
                const stockTexto = esAgotado ? 'Agotado' : `${stock} disp.`;

                const miniThumbHTML = p.imagen ? `
                    <img src="${p.imagen}" alt="${p.nombre}" class="pos-list-thumb" loading="lazy" 
                         onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'pos-list-thumb-fallback\\'><i class=\\'fas fa-box\\'></i></div>';">
                ` : `
                    <div class="pos-list-thumb-fallback"><i class="fas fa-box"></i></div>
                `;

                return `
                    <tr>
                        <td class="pos-list-cell-thumb">${miniThumbHTML}</td>
                        <td style="font-weight: 700; font-size: 0.76rem; color: var(--text-muted);">${p.codigo || '—'}</td>
                        <td class="pos-list-cell-details">
                            <div class="pos-list-prod-info">
                                <strong class="pos-list-name">${p.nombre}</strong>
                                <span class="pos-list-code">${p.categoria || 'Sin categoría'}</span>
                            </div>
                        </td>
                        <td class="num" style="font-weight: 900; color: var(--accent-primary, #2563eb);">$${precioUSD.toFixed(2)}</td>
                        <td class="num" style="font-size: 0.8rem; color: var(--text-muted);">Bs. ${tasa > 0 ? precioVES.toFixed(2) : '—'}</td>
                        <td class="num"><span class="pos-badge-stock ${stockClase}" style="position:static;">${stockTexto}</span></td>
                        <td class="pos-list-cell-action" style="text-align: center;">
                            <button type="button" class="btn btn-success" style="padding: 6px 12px; font-size: 0.78rem; font-weight: 800; min-height: 32px;" 
                                    onclick="agregarAlCarrito('${p.id}')" ${esAgotado ? 'disabled' : ''}>
                                ${esAgotado ? 'Agotado' : '+ Agregar'}
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }
}

function filtrarPosProductos() {
    const input = document.getElementById('pos-search');
    renderizarPosProductos(input ? input.value : "");
}

function agregarAlCarrito(id) {
    const p = (productos || []).find(prod => prod.id === id);
    if (!p) return;
    const itemEnCarrito = carrito.find(item => item.productoId === id);

    if (itemEnCarrito) {
        if (itemEnCarrito.cantidad < Number(p.stock || 0)) {
            itemEnCarrito.cantidad++;
        } else {
            if (typeof showCustomToast === 'function') {
                showCustomToast(`Stock máximo alcanzado para ${p.nombre}`, 'warning');
            } else if (typeof showCustomAlert === 'function') {
                showCustomAlert("Stock Máximo", `Stock máximo alcanzado para ${p.nombre}.`, 'warning');
            } else {
                alert("Stock máximo alcanzado");
            }
            return;
        }
    } else {
        if (Number(p.stock || 0) <= 0) {
            if (typeof showCustomToast === 'function') {
                showCustomToast(`${p.nombre} está agotado`, 'error');
            }
            return;
        }
        carrito.push({
            productoId: id,
            nombre: p.nombre,
            precio: Number(p.precio || 0),
            cantidad: 1,
            imagen: p.imagen || '',
            codigo: p.codigo || ''
        });
    }

    renderizarCarrito();

    if (window.navigator && window.navigator.vibrate) {
        try { window.navigator.vibrate(25); } catch {}
    }
    animarBotonAgregar(id);
    animarBarraCarritoMobile();
}

function modificarCantidadCarrito(idx, delta) {
    if (!carrito[idx]) return;
    const item = carrito[idx];
    const prod = (productos || []).find(p => p.id === item.productoId);
    const stockMax = prod ? Number(prod.stock || 0) : 9999;

    if (delta > 0) {
        if (item.cantidad < stockMax) {
            item.cantidad++;
        } else {
            if (typeof showCustomToast === 'function') {
                showCustomToast(`Stock máximo alcanzado (${stockMax} unid.)`, 'warning');
            } else if (typeof showCustomAlert === 'function') {
                showCustomAlert('Stock Máximo', `Stock máximo alcanzado para ${item.nombre}.`, 'warning');
            }
            return;
        }
    } else if (delta < 0) {
        if (item.cantidad > 1) {
            item.cantidad--;
        } else {
            eliminarDelCarrito(idx);
            return;
        }
    }
    renderizarCarrito();
    animarBarraCarritoMobile();
}

function establecerCantidadCarrito(idx, valor) {
    if (!carrito[idx]) return;
    const item = carrito[idx];
    const prod = (productos || []).find(p => p.id === item.productoId);
    const stockMax = prod ? Number(prod.stock || 0) : 9999;
    let cant = parseInt(valor, 10);

    if (isNaN(cant) || cant <= 0) cant = 1;
    if (cant > stockMax) {
        cant = stockMax;
        if (typeof showCustomToast === 'function') {
            showCustomToast(`Ajustado al stock máximo (${stockMax})`, 'warning');
        }
    }
    item.cantidad = cant;
    renderizarCarrito();
    animarBarraCarritoMobile();
}

function vaciarCarritoPOS() {
    if (!carrito || carrito.length === 0) return;
    if (confirm("¿Estás seguro de vaciar el carrito?")) {
        carrito = [];
        renderizarCarrito();
        if (typeof showCustomToast === 'function') {
            showCustomToast("Carrito vaciado", "info");
        }
    }
}

function renderizarCarrito() {
    const tbody = document.getElementById('pos-carrito-body');
    const drawerList = document.getElementById('pos-drawer-items-list');
    const emptyState = document.getElementById('pos-cart-empty-state');
    const cartTable = document.getElementById('pos-cart-table');
    const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || tasaActiva || 0);

    let totalUSD = 0;
    let totalItemsCount = 0;

    carrito.forEach(item => {
        totalUSD += Number(item.cantidad || 0) * Number(item.precio || 0);
        totalItemsCount += Number(item.cantidad || 0);
    });

    const totalVES = tasa > 0 ? (totalUSD * tasa) : 0;

    // 1. Actualizar Resumen en Textos Compartidos
    const elUsd = document.getElementById('pos-total-usd');
    const elVes = document.getElementById('pos-total-ves');
    if (elUsd) elUsd.textContent = `$${totalUSD.toFixed(2)}`;
    if (elVes) elVes.textContent = `Bs. ${tasa > 0 ? totalVES.toFixed(2) : '—'}`;

    // Badges de contador
    const badgeDesktop = document.getElementById('pos-cart-badge-count');
    if (badgeDesktop) badgeDesktop.textContent = `${totalItemsCount} ${totalItemsCount === 1 ? 'item' : 'items'}`;

    const badgeMobile = document.getElementById('pos-mobile-badge-count');
    if (badgeMobile) badgeMobile.textContent = totalItemsCount;

    const badgeDrawer = document.getElementById('pos-drawer-badge-count');
    if (badgeDrawer) badgeDrawer.textContent = `${totalItemsCount} ${totalItemsCount === 1 ? 'item' : 'items'}`;

    // Totales en barra móvil
    const mobileUsd = document.getElementById('pos-mobile-total-usd');
    const mobileVes = document.getElementById('pos-mobile-total-ves');
    if (mobileUsd) mobileUsd.textContent = `$${totalUSD.toFixed(2)}`;
    if (mobileVes) mobileVes.textContent = `Bs. ${tasa > 0 ? totalVES.toFixed(2) : '—'}`;

    // Totales en Drawer
    const drawerUsd = document.getElementById('pos-drawer-total-usd');
    const drawerVes = document.getElementById('pos-drawer-total-ves');
    if (drawerUsd) drawerUsd.textContent = `$${totalUSD.toFixed(2)}`;
    if (drawerVes) drawerVes.textContent = `Bs. ${tasa > 0 ? totalVES.toFixed(2) : '—'}`;

    // Mostrar / Ocultar empty state en desktop
    if (emptyState) {
        emptyState.style.display = carrito.length === 0 ? 'flex' : 'none';
    }
    if (cartTable) {
        cartTable.style.display = carrito.length === 0 ? 'none' : 'table';
    }

    // 2. Renderizar Tabla Desktop
    if (tbody) {
        tbody.innerHTML = carrito.map((item, idx) => {
            const subtotal = item.cantidad * item.precio;
            return `
                <tr>
                    <td>
                        <div style="font-weight: 800; color: var(--text-primary);">${item.nombre}</div>
                        <div style="font-size: 0.72rem; color: var(--text-muted);">$${item.precio.toFixed(2)} c/u</div>
                    </td>
                    <td class="num">
                        <div class="pos-stepper">
                            <button type="button" class="pos-stepper-btn" onclick="modificarCantidadCarrito(${idx}, -1)">-</button>
                            <input type="number" class="pos-stepper-val" value="${item.cantidad}" min="1" 
                                   onchange="establecerCantidadCarrito(${idx}, this.value)" inputmode="numeric">
                            <button type="button" class="pos-stepper-btn" onclick="modificarCantidadCarrito(${idx}, 1)">+</button>
                        </div>
                    </td>
                    <td class="num" style="font-weight: 900; color: var(--accent-primary, #2563eb);">$${subtotal.toFixed(2)}</td>
                    <td>
                        <button type="button" class="pos-btn-del-item" onclick="eliminarDelCarrito(${idx})" title="Eliminar ítem">
                            <i class="fas fa-times"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // 3. Renderizar Lista en Drawer Móvil
    if (drawerList) {
        if (carrito.length === 0) {
            drawerList.innerHTML = `
                <div class="pos-cart-empty">
                    <i class="fas fa-cart-arrow-down"></i>
                    <p>El carrito está vacío</p>
                    <small>Toca "+ Agregar" en los productos que deseas cobrar</small>
                </div>
            `;
        } else {
            drawerList.innerHTML = carrito.map((item, idx) => {
                const subtotal = item.cantidad * item.precio;
                const prod = (productos || []).find(p => p.id === item.productoId);
                const thumbSrc = item.imagen || (prod ? prod.imagen : '');

                const thumbHTML = thumbSrc ? `
                    <img src="${thumbSrc}" alt="${item.nombre}" class="pos-drawer-item-thumb" 
                         onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'40\\' height=\\'40\\' fill=\\'%23cbd5e1\\'><rect width=\\'40\\' height=\\'40\\'/></svg>';">
                ` : `
                    <div class="pos-drawer-item-thumb" style="display:flex; align-items:center; justify-content:center; background:#f1f5f9; color:#94a3b8;">
                        <i class="fas fa-box"></i>
                    </div>
                `;

                return `
                    <div class="pos-drawer-item-row">
                        <div class="pos-drawer-item-left">
                            ${thumbHTML}
                            <div class="pos-drawer-item-info">
                                <span class="pos-drawer-item-name">${item.nombre}</span>
                                <span class="pos-drawer-item-price">$${item.precio.toFixed(2)} c/u</span>
                            </div>
                        </div>
                        <div class="pos-drawer-item-right">
                            <div class="pos-stepper">
                                <button type="button" class="pos-stepper-btn" onclick="modificarCantidadCarrito(${idx}, -1)">-</button>
                                <input type="number" class="pos-stepper-val" value="${item.cantidad}" min="1" 
                                       onchange="establecerCantidadCarrito(${idx}, this.value)" inputmode="numeric">
                                <button type="button" class="pos-stepper-btn" onclick="modificarCantidadCarrito(${idx}, 1)">+</button>
                            </div>
                            <span class="pos-drawer-item-subtotal">$${subtotal.toFixed(2)}</span>
                            <button type="button" class="pos-btn-del-item" onclick="eliminarDelCarrito(${idx})" title="Eliminar">
                                <i class="fas fa-trash-can" style="font-size:0.78rem;"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
}

function eliminarDelCarrito(idx) {
    carrito.splice(idx, 1);
    renderizarCarrito();
}

function abrirDrawerCarritoMobile() {
    sincronizarClienteSelects('pos-cliente-select');
    const overlay = document.getElementById('pos-cart-drawer-overlay');
    if (overlay) {
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function cerrarDrawerCarritoMobile() {
    const overlay = document.getElementById('pos-cart-drawer-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function procesarVentaDesdeDrawer() {
    cerrarDrawerCarritoMobile();
    procesarVenta();
}

function sincronizarClienteSelects(origenId) {
    const desktopSel = document.getElementById('pos-cliente-select');
    const mobileSel = document.getElementById('pos-cliente-select-mobile');
    if (!desktopSel || !mobileSel) return;

    if (mobileSel.options.length === 0 && desktopSel.options.length > 0) {
        mobileSel.innerHTML = desktopSel.innerHTML;
    }

    if (origenId === 'pos-cliente-select' && desktopSel.value) {
        mobileSel.value = desktopSel.value;
    } else if (origenId === 'pos-cliente-select-mobile' && mobileSel.value) {
        desktopSel.value = mobileSel.value;
    }
}

function toggleMainNavTabs() {
    const tabs = document.getElementById('main-nav-tabs');
    const chevron = document.querySelector('.main-nav-mobile-chevron');
    if (!tabs) return;

    const isCollapsed = tabs.classList.contains('nav-tabs-collapsed-mobile');
    if (isCollapsed) {
        tabs.classList.remove('nav-tabs-collapsed-mobile');
        if (chevron) chevron.classList.remove('open');
    } else {
        tabs.classList.add('nav-tabs-collapsed-mobile');
        if (chevron) chevron.classList.add('open');
    }
}

function animarBotonAgregar(id) {
    const btn = document.getElementById(`btn-pos-add-${id}`);
    if (btn) {
        btn.classList.add('added-pop');
        setTimeout(() => btn.classList.remove('added-pop'), 320);
    }
}

function animarBarraCarritoMobile() {
    const bar = document.getElementById('pos-mobile-cart-bar');
    if (bar) {
        bar.classList.add('bar-pulse');
        setTimeout(() => bar.classList.remove('bar-pulse'), 350);
    }
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
        estado: estadoTransaccion,
        confirmada: estadoTransaccion === 'CONFIRMADO' || estadoTransaccion === 'PAGADO' || metodoPago === 'Efectivo USD' || metodoPago === 'Efectivo VES'
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
        puntosGanados = otorgarPuntosPorCompra(clienteId, total, 'Venta POS Contado', itemsVendidos);
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
            const nomCliente = clienteObj ? clienteObj.nombre : clienteId;
            const bsStr = Number(totalVES || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 });
            window.registrarNotificacion({
                tipo: 'credito',
                titulo: 'Crédito Concedido',
                mensaje: `${nomCliente} sacó un crédito por Bs. ${bsStr} ($${Number(total).toFixed(2)} USD) (Venta POS #${nuevaVenta.id})`,
                clienteId: clienteId,
                clienteNombre: nomCliente,
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
                estado: estadoTransaccion === 'CONFIRMADO' ? 'APROBADO' : 'PENDIENTE_VERIFICACION',
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
    cerrarDrawerCarritoMobile();
    renderizarCarrito();
    renderizarPosProductos();
    renderizarInventario();
    renderizarClientes();
    renderizarAuditoria(document.getElementById('auditoria-search') ? document.getElementById('auditoria-search').value : "");
    renderizarResumenPerdidasEconomicas();
    if (typeof renderizarHistorialVentasAdmin === 'function') renderizarHistorialVentasAdmin();
    if (typeof actualizarBadgeVentasHoy === 'function') actualizarBadgeVentasHoy();
    if (typeof renderizarNotificaciones === 'function') renderizarNotificaciones();
    if (typeof actualizarBadgesNotificaciones === 'function') actualizarBadgesNotificaciones();

    if (typeof showCustomToast === 'function') {
        showCustomToast(`Venta #${nuevaVenta.id} completada exitosamente ($${total.toFixed(2)})`, 'success');
    }

    if (puntosGanados > 0 && typeof showCustomAlert === 'function') {
        showCustomAlert('¡Transacción Asentada!', `La venta fue procesada con éxito.\n⭐ ¡El cliente acumuló +${puntosGanados} puntos para el Premio del Mes!`, 'success');
    }
}

// Exportar globalmente para eventos en línea y compatibilidad
window.renderizarPosProductos = renderizarPosProductos;
window.filtrarPosProductos = filtrarPosProductos;
window.agregarAlCarrito = agregarAlCarrito;
window.modificarCantidadCarrito = modificarCantidadCarrito;
window.establecerCantidadCarrito = establecerCantidadCarrito;
window.vaciarCarritoPOS = vaciarCarritoPOS;
window.renderizarCarrito = renderizarCarrito;
window.eliminarDelCarrito = eliminarDelCarrito;
window.cambiarModoVistaPOS = cambiarModoVistaPOS;
window.seleccionarCategoriaPOS = seleccionarCategoriaPOS;
window.limpiarBusquedaPOS = limpiarBusquedaPOS;
window.abrirDrawerCarritoMobile = abrirDrawerCarritoMobile;
window.cerrarDrawerCarritoMobile = cerrarDrawerCarritoMobile;
window.procesarVentaDesdeDrawer = procesarVentaDesdeDrawer;
window.sincronizarClienteSelects = sincronizarClienteSelects;
window.toggleMainNavTabs = toggleMainNavTabs;
window.procesarVenta = procesarVenta;
window.abrirModalCheckoutPOS = abrirModalCheckoutPOS;
window.cerrarModalCheckoutPOS = cerrarModalCheckoutPOS;
window.ejecutarFinalizacionCheckoutPOS = ejecutarFinalizacionCheckoutPOS;

// --- CLIENTES Y DEUDAS MULTIMONEDA ---
