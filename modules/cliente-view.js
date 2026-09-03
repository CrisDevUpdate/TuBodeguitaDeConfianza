/**
 * modules/cliente-view.js
 * Módulo de Experiencia del Cliente: Catálogo Visual, Carrito, Estado de Cuenta y Deudas
 * Cero acceso a inventario administrativo, costos o proveedores.
 */

window.InventoryApp = window.InventoryApp || {};

let clienteFiltroCategoria = 'TODAS';
let clienteBusqueda = '';

// Banco local de mensajes de sabiduría, motivación, filosofía y conocimiento universal
const BANCO_MENSAJES_SABIDURIA = [
    { frase: "La perseverancia convierte los pequeños esfuerzos diarios en grandes victorias.", autor: "Sabiduría Universal", categoria: "Motivación" },
    { frase: "El secreto de salir adelante es simplemente comenzar con entusiasmo y determinación.", autor: "Mark Twain", categoria: "Inspiración" },
    { frase: "No cuentes los días, haz que cada uno de tus días cuente.", autor: "Muhammad Ali", categoria: "Superación" },
    { frase: "La gratitud en silencio no le sirve a nadie; agradece hoy la vida y a quienes te rodean.", autor: "Gladys Stern", categoria: "Filosofía" },
    { frase: "El conocimiento es el tesoro más valioso, pero la práctica es la llave que abre sus puertas.", autor: "Thomas Fuller", categoria: "Sabiduría" },
    { frase: "Tu actitud positiva ante los retos determina la altitud a la que llegarás.", autor: "Zig Ziglar", categoria: "Actitud" },
    { frase: "La excelencia no es un acto aislado, sino un hábito que se cultiva día a día.", autor: "Aristóteles", categoria: "Filosofía" },
    { frase: "La vida es como montar en bicicleta: para mantener el equilibrio, debes seguir pedaleando.", autor: "Albert Einstein", categoria: "Reflexión" },
    { frase: "Siembra un pensamiento y cosecharás una acción; siembra un hábito y cosecharás tu destino.", autor: "Proverbio Oriental", categoria: "Sabiduría" },
    { frase: "El optimismo es la fe que conduce al logro; nada puede hacerse sin esperanza y confianza.", autor: "Helen Keller", categoria: "Esperanza" },
    { frase: "El éxito no es la clave de la felicidad; la felicidad es la clave del éxito.", autor: "Albert Schweitzer", categoria: "Éxito" },
    { frase: "Cada nuevo amanecer nos brinda una página en blanco para escribir nuestra mejor historia.", autor: "Pensamiento Positivo", categoria: "Motivación" },
    { frase: "La confianza en uno mismo es el primer secreto del éxito y de la serenidad.", autor: "Ralph Waldo Emerson", categoria: "Confianza" },
    { frase: "La bondad es el único lenguaje que los sordos pueden oír y los ciegos pueden ver.", autor: "Mark Twain", categoria: "Humanidad" },
    { frase: "El mejor momento para plantar un árbol fue hace veinte años. El segundo mejor momento es hoy.", autor: "Proverbio Chino", categoria: "Sabiduría" },
    { frase: "No mires hacia atrás con ira ni hacia adelante con miedo, sino a tu alrededor con atención.", autor: "James Thurber", categoria: "Paz Mental" },
    { frase: "La riqueza no consiste en tener muchas posesiones, sino en tener pocos deseos innecesarios.", autor: "Epicteto", categoria: "Estoicismo" },
    { frase: "Haz de cada día tu obra maestra con dedicación, honestidad y amor.", autor: "John Wooden", categoria: "Superación" },
    { frase: "El único límite a nuestros logros de mañana serán nuestras dudas de hoy.", autor: "Franklin D. Roosevelt", categoria: "Inspiración" },
    { frase: "La alegría compartida es doble alegría; la solidaridad construye comunidades prósperas.", autor: "Proverbio Sueco", categoria: "Unión" },
    { frase: "El árbol más fuerte no es el que crece sin viento, sino el que resiste todas las tormentas.", autor: "Sabiduría Milenaria", categoria: "Resiliencia" },
    { frase: "La paciencia y el buen trato abren puertas que la prisa y la soberbia cierran.", autor: "Reflexión Popular", categoria: "Convivencia" },
    { frase: "El trabajo honesto y constante siempre da frutos dulces y bendiciones duraderas.", autor: "Sabiduría de Hogar", categoria: "Valores" },
    { frase: "Que tu sonrisa sea la luz que inspire a otros a tener un gran día.", autor: "Frase de Vida", categoria: "Alegría" },
    { frase: "Todo logro grande comienza con la sencilla decisión de intentarlo con el corazón.", autor: "Gail Devers", categoria: "Motivación" }
];

let fraseActualSeleccionada = null;

/**
 * Obtiene el saludo correspondiente según la hora local del dispositivo:
 * - Buenos días (05:00 - 11:59)
 * - Buenas tardes (12:00 - 18:59)
 * - Buenas noches (19:00 - 04:59)
 */
function obtenerSaludoSegunHora() {
    const ahora = new Date();
    const hora = ahora.getHours();
    const minutos = ahora.getMinutes();
    const tiempoDecimal = hora + (minutos / 60);

    if (tiempoDecimal >= 5.0 && tiempoDecimal < 12.0) {
        return {
            texto: 'Buenos días',
            icono: '<i class="fas fa-sun" style="color:#fde047;"></i>'
        };
    } else if (tiempoDecimal >= 12.0 && tiempoDecimal < 19.0) {
        return {
            texto: 'Buenas tardes',
            icono: '<i class="fas fa-cloud-sun" style="color:#fb923c;"></i>'
        };
    } else {
        return {
            texto: 'Buenas noches',
            icono: '<i class="fas fa-moon" style="color:#93c5fd;"></i>'
        };
    }
}

/**
 * Selecciona una frase aleatoria del banco de mensajes local
 */
function obtenerFraseSabiduriaAleatoria() {
    const idx = Math.floor(Math.random() * BANCO_MENSAJES_SABIDURIA.length);
    return BANCO_MENSAJES_SABIDURIA[idx];
}

/**
 * Actualiza el encabezado dinámico del cliente (saludo por hora + frase de sabiduría)
 */
async function actualizarEncabezadoClienteDinamico() {
    const usuario = AppState.usuarioActual;
    const nombreUsuario = usuario ? (usuario.nombre || usuario.cedula || 'Cliente') : 'Cliente';
    
    // 1. Saludo según hora
    const saludoInfo = obtenerSaludoSegunHora();
    const elemNombre = document.getElementById('cliente-bienvenida-nombre');
    const elemIcono = document.getElementById('cliente-saludo-icono');

    if (elemNombre) {
        elemNombre.textContent = `¡${saludoInfo.texto}, ${nombreUsuario}!`;
    }
    if (elemIcono) {
        elemIcono.innerHTML = saludoInfo.icono;
    }

    // 2. Frase de Sabiduría con API externa o fallback local
    if (!fraseActualSeleccionada) {
        try {
            const res = await fetch('/api/quotes/wisdom');
            if (res.ok) {
                const data = await res.json();
                if (data && data.frase) {
                    fraseActualSeleccionada = {
                        frase: data.frase,
                        autor: data.autor || 'Sabiduría',
                        categoria: 'Inspiración & Finanzas'
                    };
                }
            }
        } catch {
            // Fallback a banco de frases local
        }
        if (!fraseActualSeleccionada) {
            fraseActualSeleccionada = obtenerFraseSabiduriaAleatoria();
        }
    }

    const elemTexto = document.getElementById('cliente-frase-texto');
    const elemAutor = document.getElementById('cliente-frase-autor');
    const elemCat = document.getElementById('cliente-frase-categoria');

    if (elemTexto && fraseActualSeleccionada) {
        elemTexto.textContent = `"${fraseActualSeleccionada.frase}"`;
    }
    if (elemAutor && fraseActualSeleccionada) {
        elemAutor.textContent = `— ${fraseActualSeleccionada.autor}`;
    }
    if (elemCat && fraseActualSeleccionada) {
        elemCat.textContent = fraseActualSeleccionada.categoria;
    }

    // 3. Puntos en Banner
    const elemPuntos = document.getElementById('cliente-banner-puntos-val');
    if (elemPuntos && usuario) {
        const pts = Number(usuario.puntosAcumulados || 0) - Number(usuario.puntosCanjeados || 0);
        elemPuntos.textContent = `${Math.max(0, pts)} pts`;
    }
}

/**
 * Controla la visualización del campo de referencia según el método de pago:
 * Para Crédito y Efectivo: Opcional y deshabilitado de obligatoriedad
 * Para Pago Móvil y Transferencia: Obligatorio
 */
function manejarCambioMetodoPagoCliente(metodo) {
    const inputRef = document.getElementById('cliente-pago-referencia');
    const asterisco = document.getElementById('cliente-ref-asterisco');
    const textoAyuda = document.getElementById('cliente-pago-ayuda-texto');
    const btnConfirmar = document.getElementById('btn-cliente-confirmar-pedido');

    if (!inputRef) return;

    if (metodo === 'Crédito') {
        inputRef.required = false;
        inputRef.placeholder = 'No requerida para compras a Crédito';
        if (asterisco) asterisco.style.display = 'none';
        if (textoAyuda) {
            textoAyuda.innerHTML = '* Al comprar a <b>Crédito</b> el inventario se descontará de inmediato, sumará a tu historial de deudas y puntos, y se abrirá WhatsApp para registrar la solicitud.';
        }
        if (btnConfirmar) {
            btnConfirmar.innerHTML = '<i class="fas fa-check-circle"></i> Confirmar Pedido a Crédito';
            btnConfirmar.className = 'btn btn-success';
        }
    } else if (metodo === 'Pago Móvil VES' || metodo === 'Transferencia Bancaria VES') {
        inputRef.required = true;
        inputRef.placeholder = 'Ej: 123456789012 (Obligatorio para conciliar)';
        if (asterisco) asterisco.style.display = 'inline';
        if (textoAyuda) {
            textoAyuda.innerHTML = '* La orden quedará como <b>PENDIENTE DE CONFIRMACIÓN</b> y el inventario se descontará cuando el Administrador valide la transferencia o pago móvil.';
        }
        if (btnConfirmar) {
            btnConfirmar.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Comprobante y Pedido';
            btnConfirmar.className = 'btn btn-primary';
        }
    } else {
        // Efectivo USD / VES
        inputRef.required = false;
        inputRef.placeholder = 'Opcional para pagos en efectivo';
        if (asterisco) asterisco.style.display = 'none';
        if (textoAyuda) {
            textoAyuda.innerHTML = '* Pago en efectivo directo en caja física al retirar tus productos.';
        }
        if (btnConfirmar) {
            btnConfirmar.innerHTML = '<i class="fas fa-check-circle"></i> Confirmar Pedido en Efectivo';
            btnConfirmar.className = 'btn btn-success';
        }
    }
}

/**
 * Renderiza el Catálogo de Productos para la Vista de Cliente
 * Utiliza el CatalogManager inteligente con Infinite Scroll y Ranking por Ventas/Puntos
 */
function renderizarCatalogoCliente() {
    // Actualizar saludo dinámico y frase de sabiduría
    actualizarEncabezadoClienteDinamico();

    if (window.InventoryApp && window.InventoryApp.Catalog && typeof window.InventoryApp.Catalog.renderizarCatalogoCompleto === 'function') {
        window.InventoryApp.Catalog.renderizarCatalogoCompleto('cliente-catalogo-grid');
    } else {
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
            renderizarCategoriasCatalogo();
            renderizarCarritoCliente();
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
                        ${agotado ? '<span class="badge-agotado-pill">Agotado</span>' : '<span class="badge-stock-pill" style="background:#16a34a; color:#fff;">Disponible</span>'}
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
    }

    renderizarCategoriasCatalogo();
    renderizarCarritoCliente();
}

/**
 * Renderiza los botones de categorías en el catálogo del cliente
 */
function renderizarCategoriasCatalogo() {
    const container = document.getElementById('cliente-catalogo-cats') || document.getElementById('cliente-categorias-chips');
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

function filtrarCatalogoPorCategoria(cat) {
    filtrarCatalogoClienteCategoria(cat === 'TODOS' ? 'TODAS' : cat);
}

function buscarEnCatalogoCliente(val) {
    clienteBusqueda = val;
    renderizarCatalogoCliente();
}

function filtrarCatalogoCliente(val) {
    buscarEnCatalogoCliente(val);
}

/**
 * Agrega un producto al carrito del cliente
 */
function agregarAlCarritoCliente(id) {
    const p = (AppState.productos || []).find(prod => prod.id === id);
    if (!p || Number(p.stock || 0) <= 0) {
        alert('Producto no disponible o sin existencia.');
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
    if (typeof renderizarPosProductos === 'function') renderizarPosProductos();
    if (typeof renderizarCarrito === 'function') renderizarCarrito();

    // Feedback visual flotante
    const floatingBar = document.getElementById('cliente-floating-cart-bar');
    if (floatingBar) {
        floatingBar.classList.add('pulse-highlight');
        setTimeout(() => floatingBar.classList.remove('pulse-highlight'), 600);
    }
}

/**
 * Renderiza el carrito para la vista de cliente
 */
function renderizarCarritoCliente() {
    const tbody = document.getElementById('cliente-carrito-body');
    const badgeCount = document.getElementById('cliente-carrito-count');
    const floatingCount = document.getElementById('cliente-floating-cart-count');
    const totalUsdEl = document.getElementById('cliente-carrito-total-usd');
    const floatingTotalUsd = document.getElementById('cliente-floating-total-usd');
    const totalVesEl = document.getElementById('cliente-carrito-total-ves');
    const floatingTotalVes = document.getElementById('cliente-floating-total-ves');
    const ptsPreviewEl = document.getElementById('cliente-carrito-puntos-preview');
    const floatingBar = document.getElementById('cliente-floating-cart-bar');

    const carrito = AppState.carrito || [];
    let totalUSD = 0;
    let cantTotal = 0;

    if (tbody) {
        if (carrito.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:24px; color:var(--text-muted);">Tu carrito está vacío. ¡Explora el catálogo y agrega tus productos!</td></tr>`;
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
                            <span style="display:inline-block; min-width:24px; text-align:center; font-weight:700;">${item.cantidad}</span>
                            <button type="button" class="btn-qty" onclick="modificarCantidadCarritoCliente(${idx}, 1)">+</button>
                        </td>
                        <td class="num font-bold">$${subtotal.toFixed(2)}</td>
                        <td>
                            <button type="button" class="btn btn-sm btn-danger" onclick="eliminarDelCarritoCliente(${idx})" title="Eliminar"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    } else {
        carrito.forEach(item => {
            totalUSD += (item.cantidad * item.precio);
            cantTotal += item.cantidad;
        });
    }

    const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 0);
    const totalVES = tasa > 0 ? (totalUSD * tasa) : 0;
    const ptsPorDolar = Number(AppState.premioMes?.puntosPorDolar || 1);
    const ptsGanables = Math.floor(totalUSD * ptsPorDolar);

    if (badgeCount) badgeCount.textContent = cantTotal;
    if (floatingCount) floatingCount.textContent = cantTotal;
    if (totalUsdEl) totalUsdEl.textContent = `$${totalUSD.toFixed(2)}`;
    if (floatingTotalUsd) floatingTotalUsd.textContent = `$${totalUSD.toFixed(2)}`;
    if (totalVesEl) totalVesEl.textContent = `Bs. ${totalVES > 0 ? totalVES.toFixed(2) : '—'}`;
    if (floatingTotalVes) floatingTotalVes.textContent = `Bs. ${totalVES > 0 ? totalVES.toFixed(2) : '—'}`;
    if (ptsPreviewEl) ptsPreviewEl.textContent = `+${ptsGanables} Pts`;

    // Visibilidad de barra flotante de carrito
    if (floatingBar) {
        floatingBar.style.display = cantTotal > 0 ? 'flex' : 'none';
    }
}

function modificarCantidadCarritoCliente(idx, delta) {
    const item = AppState.carrito[idx];
    if (!item) return;

    const producto = (AppState.productos || []).find(p => p.id === item.productoId);
    const nuevaCant = item.cantidad + delta;

    if (nuevaCant <= 0) {
        AppState.carrito.splice(idx, 1);
    } else if (producto && nuevaCant > Number(producto.stock || 0)) {
        alert(`Stock máximo disponible alcanzado (${producto.stock} unid).`);
        return;
    } else {
        item.cantidad = nuevaCant;
    }

    renderizarCarritoCliente();
    if (typeof renderizarCarrito === 'function') renderizarCarrito();
}

function eliminarDelCarritoCliente(idx) {
    AppState.carrito.splice(idx, 1);
    renderizarCarritoCliente();
    if (typeof renderizarCarrito === 'function') renderizarCarrito();
}

function vaciarCarritoCliente() {
    if (AppState.carrito && AppState.carrito.length > 0) {
        if (confirm('¿Deseas vaciar todos los productos del carrito?')) {
            AppState.carrito = [];
            renderizarCarritoCliente();
            if (typeof renderizarCarrito === 'function') renderizarCarrito();
        }
    }
}

function abrirModalCarritoCliente() {
    const modal = document.getElementById('modal-cliente-carrito');
    if (modal) {
        modal.classList.add('active');
        const selectMetodo = document.getElementById('cliente-tipo-pago');
        if (selectMetodo) {
            selectMetodo.value = 'Crédito';
            manejarCambioMetodoPagoCliente('Crédito');
        }
        renderizarCarritoCliente();
    }
}

function cerrarModalCarritoCliente() {
    const modal = document.getElementById('modal-cliente-carrito');
    if (modal) modal.classList.remove('active');
}

/**
 * Genera el mensaje estructurado de WhatsApp con todos los detalles del pedido
 */
function generarMensajeWhatsApp(datosPedido = null) {
    const usuario = AppState.usuarioActual || {};
    const carrito = datosPedido ? datosPedido.items : (AppState.carrito || []);
    const ref = datosPedido ? datosPedido.referencia : (document.getElementById('cliente-pago-referencia')?.value || 'N/A').trim();
    const metodo = datosPedido ? datosPedido.metodoPago : (document.getElementById('cliente-tipo-pago')?.value || 'Crédito');
    const totalUSD = datosPedido ? datosPedido.totalUSD : carrito.reduce((sum, i) => sum + (i.cantidad * i.precio), 0);
    const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 0);
    const totalVES = tasa > 0 ? (totalUSD * tasa) : (datosPedido ? datosPedido.totalVES : 0);
    const esCredito = metodo === 'Crédito';

    const prodsTexto = carrito.map(i => `• ${i.cantidad}x ${i.nombre} ($${(i.cantidad * i.precio).toFixed(2)})`).join('\n');

    let msg = '';
    if (esCredito) {
        msg = `📋 *SOLICITUD DE COMPRA A CRÉDITO - TU BODEGUITA DE CONFIANZA*\n\n` +
            `👤 *Cliente:* ${usuario.nombre || 'Cliente'}\n` +
            `🪪 *C.I / RIF:* ${usuario.cedula || usuario.id || 'N/A'}\n` +
            `📱 *Teléfono:* ${usuario.telefono || 'N/A'}\n` +
            `💳 *Método:* Compra a Crédito / Cuenta Corriente\n\n` +
            `📦 *Detalle de Productos:*\n${prodsTexto || 'Sin productos'}\n\n` +
            `💰 *Monto Total de la Deuda Registrada:*\n` +
            `💵 *Total Deuda USD:* $${totalUSD.toFixed(2)}\n` +
            `🇻🇪 *Equivalente en Bolívares:* Bs. ${totalVES.toFixed(2)} (Tasa BCV: ${tasa > 0 ? tasa.toFixed(2) : '—'})\n\n` +
            `✅ *Confirmación:* La compra a crédito ha sido registrada en el sistema. Solicito confirmación y entrega de mi pedido.`;
    } else {
        msg = `🛒 *PEDIDO - TU BODEGUITA DE CONFIANZA*\n\n` +
            `👤 *Cliente:* ${usuario.nombre || 'Cliente'} (C.I/RIF: ${usuario.cedula || usuario.id || 'N/A'})\n` +
            `📱 *Teléfono:* ${usuario.telefono || 'N/A'}\n` +
            `🔢 *Referencia Bancaria:* ${ref || 'N/A'}\n` +
            `💳 *Método de Pago:* ${metodo}\n\n` +
            `📦 *Productos Solicitados:*\n${prodsTexto || 'Sin productos'}\n\n` +
            `💵 *Total a Pagar:* $${totalUSD.toFixed(2)}\n` +
            `🇻🇪 *Equivalente en Bolívares:* Bs. ${totalVES.toFixed(2)} (Tasa BCV: ${tasa > 0 ? tasa.toFixed(2) : '—'})\n\n` +
            `📎 *Adjunto mi comprobante de pago para su validación.*`;
    }

    return encodeURIComponent(msg);
}

/**
 * Abre el enlace directo a WhatsApp (https://wa.me/584125363849) dirigido al número 04125363849
 */
function abrirWhatsAppComprobante(datosPedido = null) {
    const numeroWhatsApp = '584125363849';
    const textoCodificado = generarMensajeWhatsApp(datosPedido);
    const url = `https://wa.me/${numeroWhatsApp}?text=${textoCodificado}`;
    window.open(url, '_blank');
}

/**
 * 1. PASO 1: Doble verificación antes de procesar la compra.
 * Valida sesión, stock y datos; luego abre el modal de confirmación.
 */
function procesarCompraCliente() {
    solicitarConfirmacionCompraCliente();
}

function solicitarConfirmacionCompraCliente() {
    const usuario = AppState.usuarioActual;
    if (!usuario || usuario.estado !== 'ACTIVO') {
        alert('Debes tener una cuenta ACTIVA y verificada para realizar pedidos.');
        return;
    }

    const carrito = AppState.carrito || [];
    if (carrito.length === 0) {
        alert('Tu carrito está vacío. Agrega productos del catálogo para continuar.');
        return;
    }

    const tipoPagoSelect = document.getElementById('cliente-tipo-pago');
    const tipoPago = tipoPagoSelect ? tipoPagoSelect.value : 'Crédito';
    const esCredito = (tipoPago === 'Crédito');
    
    const referenciaInput = document.getElementById('cliente-pago-referencia');
    const referencia = (referenciaInput ? referenciaInput.value : '').trim();

    // Validar referencia obligatoria solo si es Pago Móvil o Transferencia
    const requiereReferencia = (tipoPago === 'Pago Móvil VES' || tipoPago === 'Transferencia Bancaria VES');
    if (requiereReferencia && !referencia) {
        alert('⚠️ Debes ingresar obligatoriamente tu Número de Referencia Bancaria para validar el Pago Móvil o Transferencia.');
        if (referenciaInput) referenciaInput.focus();
        return;
    }

    // Validar existencias de todos los productos
    for (const item of carrito) {
        const prod = (AppState.productos || []).find(p => p.id === item.productoId);
        if (!prod || Number(item.cantidad) > Number(prod.stock || 0)) {
            alert(`Stock insuficiente para el producto "${item.nombre}". Por favor ajusta la cantidad.`);
            return;
        }
    }

    const totalUSD = carrito.reduce((sum, item) => sum + (item.cantidad * item.precio), 0);
    const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 0);
    const totalVES = tasa > 0 ? (totalUSD * tasa) : 0;
    const ptsPorDolar = Number(AppState.premioMes?.puntosPorDolar || 1);
    const puntosEstimados = Math.floor(totalUSD * ptsPorDolar);

    // Preparar objeto de pedido para la confirmación
    const datosPedido = {
        carrito: [...carrito],
        totalUSD: totalUSD,
        totalVES: totalVES,
        metodoPago: tipoPago,
        referencia: referencia,
        esCredito: esCredito,
        puntosEstimados: puntosEstimados,
        usuario: usuario
    };

    mostrarModalDobleConfirmacion(datosPedido);
}

/**
 * Muestra la ventana emergente de doble verificación: "¿Estás seguro de realizar esta compra?"
 */
function mostrarModalDobleConfirmacion(datosPedido) {
    let modal = document.getElementById('modal-cliente-doble-confirmacion');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-cliente-doble-confirmacion';
        modal.className = 'modal';
        modal.onclick = function(e) { if (e.target === this) cerrarModalDobleConfirmacion(); };
        document.body.appendChild(modal);
    }

    const cantArticulos = datosPedido.carrito.reduce((sum, i) => sum + i.cantidad, 0);

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 480px; text-align:center; padding:24px; animation: modalPop 0.25s ease-out;">
            <div style="width:60px; height:60px; border-radius:50%; background:#eff6ff; color:#2563eb; display:flex; align-items:center; justify-content:center; font-size:1.8rem; margin:0 auto 14px auto;">
                <i class="fas fa-question"></i>
            </div>

            <h3 style="margin-bottom:8px; font-size:1.3rem; color:var(--text-main);">¿Estás seguro de realizar esta compra?</h3>
            <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:18px;">
                Por favor verifica el resumen de tu pedido antes de continuar:
            </p>

            <div style="background:#f8fafc; border:1px solid var(--border); border-radius:10px; padding:14px; text-align:left; margin-bottom:20px; font-size:0.9rem;">
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <span style="color:var(--text-muted);">Artículos:</span>
                    <strong>${cantArticulos} producto(s)</strong>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <span style="color:var(--text-muted);">Método de Pago:</span>
                    <strong style="color:var(--primary-accent);">${datosPedido.metodoPago}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <span style="color:var(--text-muted);">Total en Dólares ($):</span>
                    <strong style="font-size:1.15rem; color:var(--primary-accent);">$${datosPedido.totalUSD.toFixed(2)}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <span style="color:var(--text-muted);">Equivalente en Bolívares:</span>
                    <strong style="font-size:1.05rem; color:#16a34a;">Bs. ${datosPedido.totalVES.toFixed(2)}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; border-top:1px dashed #cbd5e1; padding-top:8px; margin-top:4px;">
                    <span style="color:#d97706; font-weight:600;"><i class="fas fa-trophy"></i> Puntos a ganar:</span>
                    <strong style="color:#d97706;">+${datosPedido.puntosEstimados} pts</strong>
                </div>
            </div>

            <div style="display:flex; gap:12px; justify-content:center;">
                <button type="button" class="btn btn-outline" onclick="cerrarModalDobleConfirmacion()" style="flex:1; padding:12px; font-weight:600;">
                    Cancelar
                </button>
                <button type="button" id="btn-confirmar-compra-final" class="btn btn-success" onclick="ejecutarCompraConfirmadaCliente()" style="flex:1.2; padding:12px; font-weight:700; background:#16a34a;">
                    <i class="fas fa-check"></i> Sí, confirmar
                </button>
            </div>
        </div>
    `;

    modal.classList.add('active');
    window._datosPedidoPendienteConfirmacion = datosPedido;
}

function cerrarModalDobleConfirmacion() {
    const modal = document.getElementById('modal-cliente-doble-confirmacion');
    if (modal) modal.classList.remove('active');
    window._datosPedidoPendienteConfirmacion = null;
}

/**
 * 2. PASO 2: Procesamiento de la Transacción al hacer clic en "Sí, confirmar"
 * - Registra inmediatamente la compra en la base de datos de Vercel/Firestore/Estado.
 * - Descuenta de forma automática el stock del inventario.
 * - Registra el monto en el estado de cuenta/deudas del cliente y otorga puntos de fidelización.
 * - Muestra la Pantalla de Éxito y Agradecimiento con WhatsApp 100% opcional (sin redirección automática).
 */
async function ejecutarCompraConfirmadaCliente() {
    const datos = window._datosPedidoPendienteConfirmacion;
    if (!datos) return;

    const btnConfirmar = document.getElementById('btn-confirmar-compra-final');
    if (btnConfirmar) {
        btnConfirmar.disabled = true;
        btnConfirmar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
    }

    const usuario = datos.usuario || AppState.usuarioActual;
    const clienteCedula = usuario.cedula || usuario.id;
    const carrito = datos.carrito || [];
    const totalUSD = datos.totalUSD;
    const totalVES = datos.totalVES;
    const tipoPago = datos.metodoPago;
    const referencia = datos.referencia;
    const esCredito = datos.esCredito;

    const itemsVendidos = carrito.map(item => {
        const prod = (AppState.productos || []).find(p => p.id === item.productoId);
        return {
            ...item,
            costo: Number(prod?.costo || 0)
        };
    });

    // 1. Descontar de forma automática el stock del inventario
    for (const item of carrito) {
        if (window.InventoryApp && window.InventoryApp.StockService && typeof window.InventoryApp.StockService.sale === 'function') {
            window.InventoryApp.StockService.sale(item.productoId, item.cantidad);
        } else {
            const prod = (AppState.productos || []).find(p => p.id === item.productoId);
            if (prod) prod.stock = Math.max(0, Number(prod.stock || 0) - Number(item.cantidad));
        }
    }

    // 2. Asegurar que el usuario esté en el listado de clientes
    if (Array.isArray(AppState.clientes) && !AppState.clientes.find(c => c.id === clienteCedula)) {
        AppState.clientes.push({
            id: clienteCedula,
            nombre: usuario.nombre,
            telefono: usuario.telefono || ''
        });
    }

    const nuevoPedidoId = (esCredito ? "CRE_" : "PED_") + (AppState.ventas.length + 1) + "_" + Date.now().toString().slice(-4);
    const fechaHora = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 0);

    // 3. Otorgar puntos de fidelización al cliente
    let puntosGanados = 0;
    if (typeof otorgarPuntosPorCompra === 'function') {
        puntosGanados = otorgarPuntosPorCompra(clienteCedula, totalUSD, esCredito ? 'Compra a Crédito Cliente' : 'Compra en Tienda Cliente');
    }

    // 4. Registrar inmediatamente la compra en la base de datos (AppState.ventas)
    const nuevaVenta = {
        id: nuevoPedidoId,
        clienteId: clienteCedula,
        clienteNombre: usuario.nombre,
        clienteTelefono: usuario.telefono || '',
        vendedorId: clienteCedula,
        vendedorNombre: usuario.nombre,
        fecha: fechaHora,
        items: itemsVendidos,
        total: totalUSD,
        totalVES: totalVES,
        tipo: tipoPago,
        tipoPago: tipoPago,
        referencia: referencia || (esCredito ? 'CRÉDITO-REGISTRADO' : 'N/A'),
        estado: 'CONFIRMADO',
        descontadoInventario: true,
        confirmacionWhatsApp: false
    };

    AppState.ventas.push(nuevaVenta);

    // 5. Registrar en transacciones contables
    if (Array.isArray(AppState.transacciones)) {
        const nuevaTx = {
            id: 'TX_' + Date.now(),
            pedidoId: nuevoPedidoId,
            clienteId: clienteCedula,
            tipo: tipoPago,
            referencia: referencia || (esCredito ? 'CRÉDITO-REGISTRADO' : 'VENTA-WEB'),
            montoVES: totalVES,
            montoUSD: totalUSD,
            tasaMomento: tasa,
            fecha: fechaHora,
            estado: 'Confirmado',
            verificando: false,
            observacion: `Compra #${nuevoPedidoId} procesada con éxito para ${usuario.nombre}. Stock descontado automáticamente.`
        };
        AppState.transacciones.push(nuevaTx);
    }

    // 6. Notificación asíncrona al backend / API
    try {
        fetch('/api/notificar-compra', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pedidoId: nuevoPedidoId,
                cliente: {
                    nombre: usuario.nombre,
                    cedula: clienteCedula,
                    telefono: usuario.telefono || '',
                    email: usuario.email || ''
                },
                items: itemsVendidos,
                totalUSD: totalUSD,
                totalVES: totalVES,
                metodoPago: tipoPago,
                referencia: referencia || (esCredito ? 'CRÉDITO-REGISTRADO' : 'N/A'),
                fecha: fechaHora,
                notas: 'Compra procesada y confirmada con descuento automático de stock y registro en cuenta.'
            })
        }).catch(err => console.warn('[Notificación Email Admin] Fallback:', err));
    } catch (e) {
        console.warn(e);
    }

    // 7. Sincronizar en Firebase Firestore y LocalStorage de Vercel
    if (window.InventoryApp.Persistence && typeof window.InventoryApp.Persistence.guardar === 'function') {
        window.InventoryApp.Persistence.guardar(true);
    }
    if (window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.registrarVenta === 'function') {
        window.InventoryApp.Firebase.registrarVenta(nuevaVenta, itemsVendidos).catch(e => console.warn(e));
    }

    const datosPedidoCompletado = {
        pedidoId: nuevoPedidoId,
        items: [...itemsVendidos],
        totalUSD: totalUSD,
        totalVES: totalVES,
        metodoPago: tipoPago,
        referencia: referencia,
        esCredito: esCredito,
        puntosGanados: puntosGanados,
        nombreCliente: usuario.nombre
    };

    // 8. Limpiar carrito y cerrar modales de proceso
    AppState.carrito = [];
    const referenciaInput = document.getElementById('cliente-pago-referencia');
    if (referenciaInput) referenciaInput.value = '';

    cerrarModalDobleConfirmacion();
    cerrarModalCarritoCliente();

    // 9. Actualizar todas las vistas
    renderizarCarritoCliente();
    renderizarCatalogoCliente();
    renderizarEstadoCuentaCliente();
    renderizarPremioMesCliente();
    if (typeof renderizarPosProductos === 'function') renderizarPosProductos();
    if (typeof renderizarInventario === 'function') renderizarInventario();
    if (typeof renderizarClientes === 'function') renderizarClientes();
    if (typeof renderizarHistorialVentasAdmin === 'function') renderizarHistorialVentasAdmin();

    // 10. Pantalla de Éxito y Agradecimiento (WhatsApp 100% Opcional, SIN redirección automática)
    mostrarModalConfirmacionPedido(datosPedidoCompletado);
}

/**
 * 3. Pantalla de Éxito y Agradecimiento:
 * Muestra el mensaje cálido y elegante con WhatsApp 100% Opcional.
 */
function mostrarModalConfirmacionPedido(pedido) {
    let modal = document.getElementById('modal-pedido-confirmado');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-pedido-confirmado';
        modal.className = 'modal active';
        modal.onclick = function(e) { if (e.target === this) cerrarModalConfirmacionPedido(); };
        document.body.appendChild(modal);
    } else {
        modal.classList.add('active');
    }

    const nombreCliente = pedido.nombreCliente || AppState.usuarioActual?.nombre || 'Cliente';
    const esCredito = pedido.esCredito || (pedido.metodoPago === 'Crédito');

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 520px; text-align:center; padding:28px 24px; animation: modalPop 0.25s ease-out;">
            <div style="width:72px; height:72px; border-radius:50%; background:#dcfce7; color:#16a34a; display:flex; align-items:center; justify-content:center; font-size:2.2rem; margin:0 auto 16px auto; box-shadow:0 4px 12px rgba(22, 163, 74, 0.2);">
                <i class="fas fa-check"></i>
            </div>
            
            <h3 style="margin-bottom:8px; font-size:1.35rem; color:var(--text-main);">
                ¡Muchas gracias por tu compra, ${nombreCliente}!
            </h3>
            <p style="color:var(--text-muted); font-size:0.95rem; margin-bottom:18px; line-height:1.45;">
                Tu pedido ha sido procesado con éxito y registrado en tu cuenta.
            </p>

            <div style="background:#f8fafc; border:1px solid var(--border); border-radius:12px; padding:16px; text-align:left; margin-bottom:18px; font-size:0.9rem;">
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <span style="color:var(--text-muted);">Orden / Comprobante:</span>
                    <strong style="color:var(--primary-accent);">#${pedido.pedidoId}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <span style="color:var(--text-muted);">${esCredito ? 'Deuda Registrada:' : 'Total Pagado:'}</span>
                    <strong style="color:${esCredito ? '#d97706' : 'inherit'}; font-size:1.05rem;">
                        $${pedido.totalUSD.toFixed(2)} <span style="font-size:0.85rem; color:#16a34a;">(Bs. ${pedido.totalVES.toFixed(2)})</span>
                    </strong>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <span style="color:var(--text-muted);">Método de Pago:</span>
                    <span style="font-weight:600;">${pedido.metodoPago}</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <span style="color:var(--text-muted);">Estado del Inventario:</span>
                    <span class="badge-status-pill badge-success" style="font-size:0.78rem; font-weight:700;">
                        <i class="fas fa-check-double"></i> Stock Descontado
                    </span>
                </div>
                ${pedido.puntosGanados > 0 ? `
                <div style="display:flex; justify-content:space-between; border-top:1px dashed #cbd5e1; padding-top:8px; margin-top:4px;">
                    <span style="color:#d97706; font-weight:600;"><i class="fas fa-trophy"></i> Puntos Premio del Mes:</span>
                    <strong style="color:#d97706; font-size:1rem;"><i class="fas fa-star"></i> +${pedido.puntosGanados} pts</strong>
                </div>` : ''}
            </div>

            <!-- Botón Opcional de WhatsApp (Sin redirección automática) -->
            <div style="display:flex; flex-direction:column; gap:10px;">
                <button type="button" class="btn btn-block" onclick="abrirWhatsAppComprobante(window.ultimoPedidoRegistrado)" 
                    style="background:#25d366; color:#ffffff; font-weight:700; font-size:0.95rem; padding:12px; border:none; border-radius:10px; display:flex; align-items:center; justify-content:center; gap:8px; cursor:pointer; box-shadow:0 4px 10px rgba(37, 211, 102, 0.25);">
                    <i class="fab fa-whatsapp" style="font-size:1.3rem;"></i> Enviar comprobante por WhatsApp
                </button>
                <button type="button" class="btn btn-block btn-outline" onclick="cerrarModalConfirmacionPedido()" style="padding:10px; font-weight:600;">
                    Volver al Catálogo
                </button>
            </div>
            
            <small style="color:var(--text-muted); font-size:0.78rem; display:block; margin-top:12px;">
                Tu compra ya se encuentra confirmada y guardada en el sistema. El envío a WhatsApp es opcional.
            </small>
        </div>
    `;

    window.ultimoPedidoRegistrado = pedido;
}

function cerrarModalConfirmacionPedido() {
    const modal = document.getElementById('modal-pedido-confirmado');
    if (modal) modal.classList.remove('active');
}

/**
 * Renderiza la sección personal de Estado de Cuenta & Deudas del Cliente
 * Sincroniza con el endpoint /api/account/status?userId=ID y renderiza la vista completa
 */
async function renderizarEstadoCuentaCliente() {
    const container = document.getElementById('cliente-estado-cuenta-container');
    const usuario = AppState.usuarioActual;
    if (!container || !usuario) return;

    const cedula = usuario.cedula || usuario.id;

    // Sincronización asíncrona con el endpoint de estado de cuenta backend
    try {
        const resp = await fetch(`/api/account/status?userId=${encodeURIComponent(cedula)}`);
        if (resp.ok) {
            const data = await resp.json();
            console.log('[API Account Status] Sincronizado:', data);
        }
    } catch (e) {
        // Modo local fallback
    }

    const ventasCliente = (AppState.ventas || []).filter(v => (v.clienteId === cedula || v.clienteId === usuario.id));
    const abonosAprobados = (AppState.abonos || []).filter(a => (a.clienteId === cedula || a.clienteId === usuario.id) && (a.estado === 'Pago agregado' || a.estado === 'Confirmado' || !a.estado));
    const todosAbonosCliente = (AppState.abonos || []).filter(a => (a.clienteId === cedula || a.clienteId === usuario.id));

    const totalCompradoUSD = ventasCliente.reduce((sum, v) => sum + Number(v.total || 0), 0);
    const totalCreditoUSD = ventasCliente.filter(v => v.tipo === 'Crédito').reduce((sum, v) => sum + Number(v.total || 0), 0);
    const totalAbonadoUSD = abonosAprobados.reduce((sum, a) => sum + Number(a.montoUSD || 0), 0);
    const saldoDeudaUSD = Math.max(0, totalCreditoUSD - totalAbonadoUSD);

    const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 0);
    const saldoDeudaVES = tasa > 0 ? (saldoDeudaUSD * tasa) : 0;
    const totalCompradoVES = tasa > 0 ? (totalCompradoUSD * tasa) : 0;
    const esSolvente = saldoDeudaUSD <= 0.01;

    container.innerHTML = `
        <!-- Tarjeta de Solvencia / Estado General -->
        <div class="card" style="margin-bottom:20px; background:${esSolvente ? 'linear-gradient(135deg, #065f46, #047857)' : 'linear-gradient(135deg, #78350f, #92400e)'}; color:#ffffff; border:none; box-shadow:0 4px 15px rgba(0,0,0,0.12);">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
                <div style="display:flex; align-items:center; gap:14px;">
                    <div style="width:54px; height:54px; border-radius:50%; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:1.8rem;">
                        <i class="fas ${esSolvente ? 'fa-shield-check' : 'fa-hand-holding-dollar'}"></i>
                    </div>
                    <div>
                        <h2 style="margin:0; font-size:1.3rem; color:#ffffff;">
                            ${esSolvente ? '¡Cuenta 100% Solvente y al Día!' : 'Saldo Pendiente por Pagar'}
                        </h2>
                        <p style="margin:4px 0 0 0; font-size:0.88rem; color:rgba(255,255,255,0.85); line-height:1.4;">
                            ${esSolvente 
                                ? 'No tienes deudas pendientes. Tu cuenta corriente se encuentra totalmente solvente.' 
                                : `Tienes un saldo pendiente de $${saldoDeudaUSD.toFixed(2)} (Bs. ${saldoDeudaVES > 0 ? saldoDeudaVES.toFixed(2) : '—'}).`}
                        </p>
                    </div>
                </div>
                <div style="text-align:right;">
                    <span style="font-size:0.75rem; text-transform:uppercase; color:rgba(255,255,255,0.75); display:block;">Total Deuda</span>
                    <strong style="font-size:1.6rem; color:#ffffff;">$${saldoDeudaUSD.toFixed(2)}</strong>
                    <small style="display:block; font-size:0.85rem; color:rgba(255,255,255,0.85);">Bs. ${saldoDeudaVES > 0 ? saldoDeudaVES.toFixed(2) : '—'}</small>
                </div>
            </div>
        </div>

        <!-- KPIs Resumen Financiero -->
        <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap:16px; margin-bottom:24px;">
            <div class="stat-card" style="border-left:4px solid #2563eb;">
                <div class="stat-icon" style="background:#dbeafe; color:#2563eb;"><i class="fas fa-bag-shopping"></i></div>
                <div class="stat-info">
                    <span class="stat-label">Total Comprado ($)</span>
                    <h3 class="stat-value">$${totalCompradoUSD.toFixed(2)}</h3>
                    <small style="color:var(--text-muted); font-size:0.75rem;">Bs. ${totalCompradoVES > 0 ? totalCompradoVES.toFixed(2) : '—'}</small>
                </div>
            </div>

            <div class="stat-card" style="border-left:4px solid ${esSolvente ? '#16a34a' : '#d97706'};">
                <div class="stat-icon" style="background:${esSolvente ? '#dcfce7' : '#fef3c7'}; color:${esSolvente ? '#16a34a' : '#d97706'};">
                    <i class="fas ${esSolvente ? 'fa-circle-check' : 'fa-clock'}"></i>
                </div>
                <div class="stat-info">
                    <span class="stat-label">Deuda Pendiente</span>
                    <h3 class="stat-value" style="color:${esSolvente ? '#16a34a' : '#d97706'};">$${saldoDeudaUSD.toFixed(2)}</h3>
                    <small style="color:var(--text-muted); font-size:0.75rem;">${esSolvente ? 'Al día' : `Bs. ${saldoDeudaVES.toFixed(2)}`}</small>
                </div>
            </div>

            <div class="stat-card" style="border-left:4px solid #16a34a;">
                <div class="stat-icon" style="background:#dcfce7; color:#16a34a;"><i class="fas fa-receipt"></i></div>
                <div class="stat-info">
                    <span class="stat-label">Total Abonado ($)</span>
                    <h3 class="stat-value">$${totalAbonadoUSD.toFixed(2)}</h3>
                    <small style="color:var(--text-muted); font-size:0.75rem;">${abonosAprobados.length} pagos conciliados</small>
                </div>
            </div>

            <div class="stat-card" style="border-left:4px solid #8b5cf6;">
                <div class="stat-icon" style="background:#ede9fe; color:#8b5cf6;"><i class="fas fa-file-invoice"></i></div>
                <div class="stat-info">
                    <span class="stat-label">Total Pedidos</span>
                    <h3 class="stat-value">${ventasCliente.length}</h3>
                    <small style="color:var(--text-muted); font-size:0.75rem;">Historial completo</small>
                </div>
            </div>
        </div>

        <!-- Tabla: Historial de Pedidos y Compras -->
        <div class="card" style="margin-bottom:24px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                <h3 style="margin:0; font-size:1.15rem; display:flex; align-items:center; gap:8px;">
                    <i class="fas fa-history" style="color:var(--primary-accent);"></i> Mis Compras y Pedidos
                </h3>
                <span class="badge" style="background:#f1f5f9; color:var(--text-muted); font-weight:700;">${ventasCliente.length} compras</span>
            </div>

            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>ID Venta</th>
                            <th>Fecha</th>
                            <th>Artículos</th>
                            <th>Método</th>
                            <th class="num">Total ($)</th>
                            <th style="text-align:center;">Estado</th>
                        </tr>
                    </thead>
                    <tbody id="cli-historial-compras-body">
                        ${ventasCliente.length === 0 ? `
                            <tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-muted);">Aún no tienes compras registradas en el sistema.</td></tr>
                        ` : ventasCliente.slice().reverse().map(v => {
                            const totalUSD = Number(v.total || 0);
                            const itemsStr = (v.items || []).map(i => `${i.cantidad}x ${i.nombre}`).join(', ');
                            const esCredito = v.tipo === 'Crédito';
                            const esPendiente = v.estado === 'PENDIENTE_CONFIRMACION';

                            let statusBadge = '<span class="badge-status badge-active"><i class="fas fa-check"></i> Contado</span>';
                            if (esPendiente) {
                                statusBadge = '<span class="badge-status badge-warning"><i class="fas fa-hourglass-half"></i> Pendiente Confirmación</span>';
                            } else if (esCredito) {
                                statusBadge = saldoDeudaUSD > 0 
                                    ? '<span class="badge-status badge-warning"><i class="fas fa-clock"></i> Pendiente de Pago</span>' 
                                    : '<span class="badge-status badge-active"><i class="fas fa-check"></i> Cancelado</span>';
                            }

                            return `
                                <tr>
                                    <td><strong>#${v.id}</strong></td>
                                    <td>${v.fecha}</td>
                                    <td style="max-width:240px; font-size:0.85rem;" title="${itemsStr}">
                                        ${itemsStr || 'Venta de productos'}
                                    </td>
                                    <td><span class="badge-status-pill ${esCredito ? 'badge-warning' : 'badge-success'}">${v.tipo}</span></td>
                                    <td class="num font-bold">$${totalUSD.toFixed(2)}</td>
                                    <td style="text-align:center;">${statusBadge}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Tabla: Historial de Abonos y Pagos -->
        <div class="card" style="margin-bottom:24px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
                <div>
                    <h3 style="margin:0; font-size:1.15rem; display:flex; align-items:center; gap:8px;">
                        <i class="fas fa-money-check-dollar" style="color:#16a34a;"></i> Mis Pagos y Abonos Registrados
                    </h3>
                    <p style="margin:2px 0 0 0; font-size:0.82rem; color:var(--text-muted);">
                        Reporta tus abonos o transferencias para que el Administrador los concilie y libere tus puntos.
                    </p>
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <span class="badge" style="background:#f1f5f9; color:var(--text-muted); font-weight:700;">${todosAbonosCliente.length} abonos</span>
                    <button type="button" class="btn btn-primary btn-sm" onclick="abrirModalReportarPagoCliente()" style="display:flex; align-items:center; gap:6px; font-weight:700; padding:8px 14px;">
                        <i class="fas fa-plus-circle"></i> Reportar Nuevo Abono
                    </button>
                </div>
            </div>

            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Método de Pago</th>
                            <th>Referencia</th>
                            <th class="num">Monto ($)</th>
                            <th style="text-align:center;">Estado</th>
                        </tr>
                    </thead>
                    <tbody id="cli-historial-abonos-body">
                        ${todosAbonosCliente.length === 0 ? `
                            <tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">Sin abonos de pago registrados todavía. Puedes hacer clic en "Reportar Nuevo Abono" para registrar tu pago.</td></tr>
                        ` : todosAbonosCliente.slice().reverse().map(a => {
                            const esPendiente = a.estado === 'PENDIENTE_CONFIRMACION';
                            const esRechazado = a.estado === 'RECHAZADO';
                            return `
                                <tr>
                                    <td>${a.fecha}</td>
                                    <td>${a.formaPago || a.metodo || 'Transferencia / Pago Móvil'}</td>
                                    <td><code>${a.referencia || 'N/A'}</code>${a.nota ? `<br><small style="color:var(--text-muted); font-style:italic;">Nota: ${a.nota}</small>` : ''}</td>
                                    <td class="num font-bold" style="color:${esPendiente ? '#d97706' : (esRechazado ? '#dc2626' : 'var(--success)')};">$${Number(a.montoUSD || 0).toFixed(2)}</td>
                                    <td style="text-align:center;">
                                        ${esPendiente 
                                            ? '<span class="badge-status badge-warning"><i class="fas fa-hourglass-half"></i> En Verificación</span>' 
                                            : (esRechazado 
                                                ? '<span class="badge-status" style="background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5;"><i class="fas fa-times-circle"></i> Rechazado</span>'
                                                : '<span class="badge-status badge-active"><i class="fas fa-check"></i> Aprobado</span>')}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- MÓDULO 3: Motor de Temas y Personalización de Estilo en Vista Cliente -->
        <div id="cliente-theme-selector-container"></div>
    `;

    // Renderizar Selector de Temas del Cliente
    if (window.InventoryApp && window.InventoryApp.Theme && typeof window.InventoryApp.Theme.renderizarSelectorCliente === 'function') {
        window.InventoryApp.Theme.renderizarSelectorCliente('cliente-theme-selector-container');
    }
}

/**
 * Abre el Modal para que el Cliente reporte un Abono / Pago
 */
function abrirModalReportarPagoCliente() {
    let modal = document.getElementById('modal-cliente-reportar-pago');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-cliente-reportar-pago';
        modal.className = 'modal';
        modal.onclick = function(e) { if (e.target === this) cerrarModalReportarPagoCliente(); };
        document.body.appendChild(modal);
    }

    const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 0);

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 520px; padding: 24px; animation: modalPop 0.25s ease-out;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid var(--border-light); padding-bottom:10px;">
                <h3 style="margin:0; font-size:1.15rem; color:var(--text-main); display:flex; align-items:center; gap:8px;">
                    <i class="fas fa-money-bill-transfer" style="color:var(--primary-accent);"></i> Reportar Abono a Cuenta
                </h3>
                <button type="button" class="btn-icon-tasa" onclick="cerrarModalReportarPagoCliente()"><i class="fas fa-times"></i></button>
            </div>

            <!-- Coordenadas Bancarias del Comercio para Pago Rápido -->
            <div style="background:var(--bg-card); border:1px solid var(--border-light); border-radius:10px; padding:12px; margin-bottom:14px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span style="font-size:0.8rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">
                        <i class="fas fa-building-columns"></i> Coordenadas Bancarias
                    </span>
                    <button type="button" class="btn btn-sm btn-outline" style="font-size:0.75rem; padding:3px 8px;" onclick="copiarDatosBancariosCompletos()">
                        <i class="fas fa-copy"></i> Copiar Todo
                    </button>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; font-size:0.82rem;">
                    <div style="background:var(--bg-main); padding:6px 10px; border-radius:6px;">
                        <span style="color:var(--text-muted); display:block; font-size:0.72rem;">Pago Móvil / Banco:</span>
                        <strong style="color:var(--text-main);">Bancamiga (0172)</strong>
                    </div>
                    <div style="background:var(--bg-main); padding:6px 10px; border-radius:6px;">
                        <span style="color:var(--text-muted); display:block; font-size:0.72rem;">Cédula / RIF:</span>
                        <strong style="color:var(--text-main);">V-30.544.641</strong>
                    </div>
                    <div style="background:var(--bg-main); padding:6px 10px; border-radius:6px; grid-column:span 2;">
                        <span style="color:var(--text-muted); display:block; font-size:0.72rem;">Teléfono Pago Móvil:</span>
                        <strong style="color:var(--text-main);">0412-1234567</strong>
                    </div>
                </div>
            </div>

            <form id="form-cliente-reportar-pago" onsubmit="event.preventDefault(); procesarReportePagoCliente();">
                <div class="form-group" style="margin-bottom:12px;">
                    <label style="font-size:0.85rem; font-weight:600;">Monto a Abonar en Dólares ($ USD) <span style="color:var(--danger);">*</span></label>
                    <input type="number" id="abono-cli-monto-usd" step="0.01" min="0.5" class="form-control" placeholder="0.00" required oninput="calcularEquivalenteAbonoCliente(this.value)">
                    <small style="color:var(--text-muted); font-size:0.8rem; display:block; margin-top:3px;">
                        Equivalente BCV: <strong id="abono-cli-monto-ves-preview" style="color:#16a34a;">Bs. 0.00</strong> (Tasa: ${tasa > 0 ? tasa.toFixed(2) : '—'})
                    </small>
                </div>

                <div class="form-group" style="margin-bottom:12px;">
                    <label style="font-size:0.85rem; font-weight:600;">Forma / Método de Pago <span style="color:var(--danger);">*</span></label>
                    <select id="abono-cli-metodo" class="form-control" required>
                        <option value="Pago Móvil VES" selected>📱 Pago Móvil (VES)</option>
                        <option value="Transferencia Bancaria VES">🏦 Transferencia Bancaria (VES)</option>
                        <option value="Efectivo USD">💵 Efectivo ($ USD)</option>
                        <option value="Efectivo VES">🇻🇪 Efectivo (Bs. VES)</option>
                    </select>
                </div>

                <div class="form-group" style="margin-bottom:12px;">
                    <label style="font-size:0.85rem; font-weight:600;">Número de Referencia Bancaria <span style="color:var(--danger);">*</span></label>
                    <input type="text" id="abono-cli-referencia" class="form-control" placeholder="Últimos 6 u 8 dígitos del comprobante" required>
                </div>

                <div class="form-group" style="margin-bottom:16px;">
                    <label style="font-size:0.85rem; font-weight:600;">Nota u Observación (Opcional)</label>
                    <input type="text" id="abono-cli-nota" class="form-control" placeholder="Ej: Pago de abono semanal">
                </div>

                <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:10px; font-size:0.82rem; color:#1e40af; margin-bottom:16px;">
                    <i class="fas fa-info-circle"></i> Tu pago quedará registrado en estado <b>PENDIENTE DE CONFIRMACIÓN</b>. Al ser aprobado por el Administrador, se descontará de tu deuda y sumará a tu récord de pagos puntuales.
                </div>

                <div style="display:flex; justify-content:flex-end; gap:10px;">
                    <button type="button" class="btn btn-outline" onclick="cerrarModalReportarPagoCliente()">Cancelar</button>
                    <button type="submit" class="btn btn-primary" style="font-weight:700; padding:10px 18px;">
                        <i class="fas fa-paper-plane"></i> Enviar Reporte de Pago
                    </button>
                </div>
            </form>
        </div>
    `;

    modal.classList.add('active');
}

function copiarDatosBancariosCompletos() {
    const texto = `Coordenadas Bancarias Tu Bodeguita:\nBanco: Bancamiga (0172)\nRIF: V-30544641\nTeléfono: 0412-1234567`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(() => {
            if (window.InventoryApp.Modal?.toast) window.InventoryApp.Modal.toast('📋 Coordenadas bancarias copiadas al portapapeles', 'success');
        });
    } else {
        alert('Coordenadas Bancarias:\n' + texto);
    }
}

function calcularEquivalenteAbonoCliente(usdVal) {
    const previewEl = document.getElementById('abono-cli-monto-ves-preview');
    const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 0);
    const montoUSD = parseFloat(usdVal) || 0;
    const montoVES = tasa > 0 ? (montoUSD * tasa) : 0;
    if (previewEl) {
        previewEl.textContent = `Bs. ${montoVES.toFixed(2)}`;
    }
}

function cerrarModalReportarPagoCliente() {
    const modal = document.getElementById('modal-cliente-reportar-pago');
    if (modal) modal.classList.remove('active');
}

/**
 * Procesa el formulario del reporte de pago del cliente
 */
async function procesarReportePagoCliente() {
    const usuario = AppState.usuarioActual;
    if (!usuario) return;

    const montoUSD = parseFloat(document.getElementById('abono-cli-monto-usd')?.value);
    const metodo = document.getElementById('abono-cli-metodo')?.value;
    const referencia = document.getElementById('abono-cli-referencia')?.value.trim();
    const nota = document.getElementById('abono-cli-nota')?.value.trim() || '';
    const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 0);

    if (isNaN(montoUSD) || montoUSD <= 0) {
        if (window.InventoryApp.Modal?.alert) {
            window.InventoryApp.Modal.alert('Monto Inválido', 'Por favor ingresa un monto válido a abonar.', 'warning');
        }
        return;
    }

    if (!referencia) {
        if (window.InventoryApp.Modal?.alert) {
            window.InventoryApp.Modal.alert('Referencia Requerida', 'Debes ingresar el número de referencia del comprobante.', 'warning');
        }
        return;
    }

    const fechaHora = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const nuevoAbono = {
        id: `ABN_${Date.now()}`,
        clienteId: usuario.cedula || usuario.id,
        clienteNombre: usuario.nombre,
        montoUSD: montoUSD,
        montoVES: tasa > 0 ? (montoUSD * tasa) : 0,
        tasaMomento: tasa,
        formaPago: metodo,
        metodo: metodo,
        referencia: referencia,
        nota: nota,
        fecha: fechaHora,
        estado: 'PENDIENTE_CONFIRMACION',
        registradoPor: 'CLIENTE'
    };

    AppState.abonos = AppState.abonos || [];
    AppState.abonos.push(nuevoAbono);

    cerrarModalReportarPagoCliente();

    // Persistir localmente
    if (window.InventoryApp.Persistence?.guardar) {
        window.InventoryApp.Persistence.guardar(true);
    }

    // Persistir en Firebase Cloud
    if (window.InventoryApp?.Firebase?.guardarAbono) {
        window.InventoryApp.Firebase.guardarAbono(nuevoAbono).catch(err => {
            console.warn('[Firebase] Advertencia al sincronizar reporte de abono en Firestore:', err);
        });
    }

    renderizarEstadoCuentaCliente();

    if (window.InventoryApp.Modal?.toast) {
        window.InventoryApp.Modal.toast(`✅ Tu abono de $${montoUSD.toFixed(2)} fue reportado con éxito (Ref: ${referencia}) y está pendiente de verificación.`, 'success');
    }
}

/**
 * Renderiza la vista de Mi Perfil & Ajustes del Cliente
 */
function renderizarPerfilCliente() {
    const container = document.getElementById('cliente-perfil-container');
    const usuario = AppState.usuarioActual;
    if (!container || !usuario) return;

    const avatarUrl = usuario.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
    const puntos = typeof obtenerPuntosCliente === 'function' ? obtenerPuntosCliente(usuario.cedula || usuario.id) : (usuario.puntos || 0);

    container.innerHTML = `
        <div style="max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px;">
            <!-- Tarjeta de Identidad de Perfil -->
            <div class="card" style="background: linear-gradient(135deg, var(--bg-card), var(--bg-main)); border: 1px solid var(--border-light); padding: 24px; position: relative;">
                <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
                    <div style="position: relative;">
                        <img src="${avatarUrl}" alt="Avatar" style="width: 84px; height: 84px; border-radius: 50%; object-fit: cover; border: 3px solid var(--primary-accent); box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                        <button type="button" class="btn btn-sm btn-primary" onclick="abrirModalSelectorAvatar()" style="position: absolute; bottom: 0; right: 0; border-radius: 50%; width: 28px; height: 28px; padding: 0; display: flex; align-items: center; justify-content: center;" title="Cambiar Avatar">
                            <i class="fas fa-camera" style="font-size: 0.75rem;"></i>
                        </button>
                    </div>
                    <div style="flex: 1; min-width: 200px;">
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <h2 style="margin: 0; font-size: 1.4rem; color: var(--text-main);">${usuario.nombre}</h2>
                            <span class="badge-status badge-active" style="font-size: 0.75rem;"><i class="fas fa-shield-check"></i> Cliente Verificado</span>
                        </div>
                        <p style="margin: 4px 0 0 0; color: var(--text-muted); font-size: 0.88rem;">
                            <i class="fas fa-id-card"></i> Cédula / RIF: <strong>${usuario.cedula || usuario.id}</strong>
                        </p>
                        <p style="margin: 2px 0 0 0; color: var(--text-muted); font-size: 0.88rem;">
                            <i class="fas fa-calendar-alt"></i> Miembro desde: ${usuario.fecha || usuario.fechaCreacion || '2026'}
                        </p>
                    </div>
                    <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 12px; padding: 12px 18px; text-align: center;">
                        <span style="font-size: 0.75rem; text-transform: uppercase; color: #d97706; font-weight: 700; display: block;">Puntos Acumulados</span>
                        <strong style="font-size: 1.5rem; color: #d97706;"><i class="fas fa-trophy"></i> ${puntos} pts</strong>
                    </div>
                </div>
            </div>

            <!-- Formulario de Edición de Datos de Contacto -->
            <div class="card">
                <h3 style="margin-bottom: 16px; font-size: 1.15rem; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-user-pen" style="color: var(--primary-accent);"></i> Mis Datos de Contacto
                </h3>
                <form id="form-cliente-perfil-datos" onsubmit="event.preventDefault(); guardarAjustesPerfilCliente();">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 16px;">
                        <div class="form-group">
                            <label style="font-size: 0.85rem; font-weight: 600;">Nombre Completo <span style="color:var(--danger);">*</span></label>
                            <input type="text" id="perfil-cli-nombre" class="form-control" value="${escaparHtmlInventario(usuario.nombre)}" required>
                        </div>
                        <div class="form-group">
                            <label style="font-size: 0.85rem; font-weight: 600;">Teléfono Móvil (WhatsApp) <span style="color:var(--danger);">*</span></label>
                            <input type="tel" id="perfil-cli-telefono" class="form-control" value="${escaparHtmlInventario(usuario.telefono || '')}" required>
                        </div>
                        <div class="form-group">
                            <label style="font-size: 0.85rem; font-weight: 600;">Correo Electrónico</label>
                            <input type="email" id="perfil-cli-email" class="form-control" value="${escaparHtmlInventario(usuario.email || '')}" placeholder="usuario@correo.com">
                        </div>
                    </div>
                    <div style="display: flex; justify-content: flex-end;">
                        <button type="submit" class="btn btn-primary" style="font-weight: 700; padding: 10px 20px;">
                            <i class="fas fa-floppy-disk"></i> Guardar Cambios de Contacto
                        </button>
                    </div>
                </form>
            </div>

            <!-- Cambio de Contraseña Segura -->
            <div class="card">
                <h3 style="margin-bottom: 16px; font-size: 1.15rem; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-key" style="color: #f59e0b;"></i> Seguridad y Contraseña
                </h3>
                <form id="form-cliente-perfil-pwd" onsubmit="event.preventDefault(); cambiarPasswordPerfilCliente();">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 16px;">
                        <div class="form-group">
                            <label style="font-size: 0.85rem; font-weight: 600;">Contraseña Actual</label>
                            <input type="password" id="perfil-cli-pwd-actual" class="form-control" placeholder="••••••••" required>
                        </div>
                        <div class="form-group">
                            <label style="font-size: 0.85rem; font-weight: 600;">Nueva Contraseña</label>
                            <input type="password" id="perfil-cli-pwd-nueva" class="form-control" placeholder="Mínimo 4 caracteres" minlength="4" required>
                        </div>
                    </div>
                    <div style="display: flex; justify-content: flex-end;">
                        <button type="submit" class="btn btn-warning" style="font-weight: 700; padding: 10px 20px;">
                            <i class="fas fa-shield-halved"></i> Actualizar Contraseña
                        </button>
                    </div>
                </form>
            </div>

            <!-- Selector de Temas Visuales -->
            <div class="card">
                <h3 style="margin-bottom: 12px; font-size: 1.15rem; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-palette" style="color: #8b5cf6;"></i> Apariencia y Tema Visual
                </h3>
                <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 16px;">
                    Selecciona tu paleta visual favorita. Tu preferencia se guardará automáticamente en este dispositivo.
                </p>
                <div id="perfil-theme-selector-embed"></div>
            </div>
        </div>
    `;

    // Renderizar selector de temas embebido
    if (window.InventoryApp && window.InventoryApp.Theme && typeof window.InventoryApp.Theme.renderizarSelectorCliente === 'function') {
        window.InventoryApp.Theme.renderizarSelectorCliente('perfil-theme-selector-embed');
    }
}

function guardarAjustesPerfilCliente() {
    const usuario = AppState.usuarioActual;
    if (!usuario) return;

    const nombre = document.getElementById('perfil-cli-nombre')?.value.trim();
    const telefono = document.getElementById('perfil-cli-telefono')?.value.trim();
    const email = document.getElementById('perfil-cli-email')?.value.trim();

    if (!nombre) {
        alert('El nombre no puede estar vacío.');
        return;
    }

    usuario.nombre = nombre;
    if (telefono) usuario.telefono = telefono;
    if (email) usuario.email = email;

    // Actualizar también en la colección global de usuarios
    const uInState = (AppState.usuarios || []).find(u => (u.id === usuario.id || u.cedula === usuario.cedula));
    if (uInState) {
        uInState.nombre = nombre;
        uInState.telefono = telefono;
        uInState.email = email;
    }

    // Actualizar cliente vinculado
    const cInState = (AppState.clientes || []).find(c => (c.id === usuario.cedula || c.id === usuario.id));
    if (cInState) {
        cInState.nombre = nombre;
        cInState.telefono = telefono;
    }

    if (window.InventoryApp.Persistence?.guardar) {
        window.InventoryApp.Persistence.guardar(true);
    }

    actualizarUIUsuarioActual();
    renderizarPerfilCliente();

    if (window.InventoryApp.Modal?.toast) {
        window.InventoryApp.Modal.toast('✅ Perfil actualizado correctamente.', 'success');
    } else {
        alert('Perfil actualizado correctamente.');
    }
}

function cambiarPasswordPerfilCliente() {
    const usuario = AppState.usuarioActual;
    if (!usuario) return;

    const pwdActual = document.getElementById('perfil-cli-pwd-actual')?.value.trim();
    const pwdNueva = document.getElementById('perfil-cli-pwd-nueva')?.value.trim();

    if (!verificarPasswordHash(pwdActual, usuario.passwordHash || usuario.password)) {
        alert('❌ La contraseña actual ingresada es incorrecta.');
        return;
    }

    if (!pwdNueva || pwdNueva.length < 4) {
        alert('❌ La nueva contraseña debe tener al menos 4 caracteres.');
        return;
    }

    const nuevoHash = calcularHashSha256(pwdNueva);
    usuario.passwordHash = nuevoHash;
    usuario.password = nuevoHash;

    const uInState = (AppState.usuarios || []).find(u => (u.id === usuario.id || u.cedula === usuario.cedula));
    if (uInState) {
        uInState.passwordHash = nuevoHash;
        uInState.password = nuevoHash;
    }

    if (window.InventoryApp.Persistence?.guardar) {
        window.InventoryApp.Persistence.guardar(true);
    }

    document.getElementById('perfil-cli-pwd-actual').value = '';
    document.getElementById('perfil-cli-pwd-nueva').value = '';

    if (window.InventoryApp.Modal?.toast) {
        window.InventoryApp.Modal.toast('🔒 Contraseña actualizada exitosamente.', 'success');
    } else {
        alert('Contraseña actualizada exitosamente.');
    }
}

// Exportar a la ventana global
window.BANCO_MENSAJES_SABIDURIA = BANCO_MENSAJES_SABIDURIA;
window.obtenerSaludoSegunHora = obtenerSaludoSegunHora;
window.obtenerFraseSabiduriaAleatoria = obtenerFraseSabiduriaAleatoria;
window.actualizarEncabezadoClienteDinamico = actualizarEncabezadoClienteDinamico;
window.manejarCambioMetodoPagoCliente = manejarCambioMetodoPagoCliente;
window.renderizarCatalogoCliente = renderizarCatalogoCliente;
window.renderizarCategoriasCatalogo = renderizarCategoriasCatalogo;
window.filtrarCatalogoClienteCategoria = filtrarCatalogoClienteCategoria;
window.filtrarCatalogoPorCategoria = filtrarCatalogoPorCategoria;
window.buscarEnCatalogoCliente = buscarEnCatalogoCliente;
window.filtrarCatalogoCliente = filtrarCatalogoCliente;
window.agregarAlCarritoCliente = agregarAlCarritoCliente;
window.renderizarCarritoCliente = renderizarCarritoCliente;
window.modificarCantidadCarritoCliente = modificarCantidadCarritoCliente;
window.eliminarDelCarritoCliente = eliminarDelCarritoCliente;
window.vaciarCarritoCliente = vaciarCarritoCliente;
window.abrirModalCarritoCliente = abrirModalCarritoCliente;
window.cerrarModalCarritoCliente = cerrarModalCarritoCliente;
window.abrirWhatsAppComprobante = abrirWhatsAppComprobante;
window.solicitarConfirmacionCompraCliente = solicitarConfirmacionCompraCliente;
window.mostrarModalDobleConfirmacion = mostrarModalDobleConfirmacion;
window.cerrarModalDobleConfirmacion = cerrarModalDobleConfirmacion;
window.ejecutarCompraConfirmadaCliente = ejecutarCompraConfirmadaCliente;
window.cerrarModalConfirmacionPedido = cerrarModalConfirmacionPedido;
window.procesarCompraCliente = procesarCompraCliente;
window.renderizarEstadoCuentaCliente = renderizarEstadoCuentaCliente;
window.abrirModalReportarPagoCliente = abrirModalReportarPagoCliente;
window.cerrarModalReportarPagoCliente = cerrarModalReportarPagoCliente;
window.procesarReportePagoCliente = procesarReportePagoCliente;
window.calcularEquivalenteAbonoCliente = calcularEquivalenteAbonoCliente;
window.copiarDatosBancariosCompletos = copiarDatosBancariosCompletos;
window.renderizarPerfilCliente = renderizarPerfilCliente;
window.guardarAjustesPerfilCliente = guardarAjustesPerfilCliente;
window.cambiarPasswordPerfilCliente = cambiarPasswordPerfilCliente;
