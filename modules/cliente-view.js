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
 * Selecciona una frase aleatoria del banco de 1000 mensajes (o fallback)
 */
function obtenerFraseSabiduriaAleatoria() {
    const banco = (Array.isArray(window.BANCO_FRASES_1000) && window.BANCO_FRASES_1000.length > 0)
        ? window.BANCO_FRASES_1000
        : BANCO_MENSAJES_SABIDURIA;
    const idx = Math.floor(Math.random() * banco.length);
    return banco[idx];
}

/**
 * Permite cambiar la frase/curiosidad al azar interactivamente
 */
function cambiarFraseAleatoria() {
    fraseActualSeleccionada = obtenerFraseSabiduriaAleatoria();
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
}
window.cambiarFraseAleatoria = cambiarFraseAleatoria;

/**
 * Actualiza el encabezado dinámico del cliente (saludo por hora + frase de sabiduría)
 */
async function actualizarEncabezadoClienteDinamico() {
    const usuario = AppState.usuarioActual;
    const esAutoServicio = usuario && (
        usuario.rol === 'autoservicio' || 
        usuario.rol === 'kiosco' || 
        (usuario.id || '').toUpperCase() === 'AUTOSERVICIO' ||
        (usuario.cedula || '').toUpperCase() === 'AUTOSERVICIO' ||
        (usuario.nombre || '').toUpperCase().includes('AUTOSERVICIO')
    );
    const nombreUsuario = usuario ? (usuario.nombre || usuario.cedula || 'Cliente') : 'Cliente';
    
    // 1. Saludo según hora general
    const saludoInfo = obtenerSaludoSegunHora();
    const elemNombre = document.getElementById('cliente-bienvenida-nombre');
    const elemIcono = document.getElementById('cliente-saludo-icono');

    if (elemNombre) {
        if (esAutoServicio) {
            elemNombre.textContent = `¡${saludoInfo.texto}! Te damos la bienvenida a Tu Bodeguita de Confianza`;
        } else {
            elemNombre.textContent = `¡${saludoInfo.texto}, ${nombreUsuario}!`;
        }
    }
    if (elemIcono) {
        elemIcono.innerHTML = saludoInfo.icono;
    }

    // 2. Frase de Sabiduría / Curiosidad / Sarcasmo con API o banco de 1000 frases
    if (!fraseActualSeleccionada) {
        try {
            const res = await fetch('/api/quotes/wisdom');
            if (res.ok) {
                const data = await res.json();
                if (data && data.frase) {
                    fraseActualSeleccionada = {
                        frase: data.frase,
                        autor: data.autor || 'Sabiduría',
                        categoria: data.categoria || 'Curiosidades & Sabiduría'
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

    // Tarjeta de frases y curiosidades visible para todos los clientes; la descarga de TXT solo para el Administrador
    const esAdmin = typeof esUsuarioAdmin === 'function'
        ? esUsuarioAdmin(usuario)
        : Boolean(usuario && (usuario.rol === 'admin' || usuario.rol === 'superadmin' || usuario.id === 'SuperAdmin' || usuario.cedula === 'SuperAdmin'));

    if (esAdmin) {
        document.body.classList.add('is-admin-mode');
    } else {
        document.body.classList.remove('is-admin-mode');
    }

    const cardFrase = document.getElementById('cliente-frase-sabiduria-card');
    if (cardFrase) {
        cardFrase.style.setProperty('display', 'flex', 'important');
        cardFrase.style.setProperty('visibility', 'visible', 'important');
        cardFrase.style.setProperty('opacity', '1', 'important');
    }

    const elemTexto = document.getElementById('cliente-frase-texto');
    const elemAutor = document.getElementById('cliente-frase-autor');
    const elemCat = document.getElementById('cliente-frase-categoria');

    if (elemTexto && fraseActualSeleccionada) {
        elemTexto.textContent = `"${fraseActualSeleccionada.frase}"`;
        elemTexto.style.setProperty('display', 'block', 'important');
        elemTexto.style.setProperty('visibility', 'visible', 'important');
    }
    if (elemAutor && fraseActualSeleccionada) {
        elemAutor.textContent = `— ${fraseActualSeleccionada.autor}`;
    }
    if (elemCat && fraseActualSeleccionada) {
        elemCat.textContent = fraseActualSeleccionada.categoria;
    }

    // La opción de descargar el archivo TXT con las 1000 frases es exclusiva del Administrador
    const elemDescargarTxt = document.getElementById('cliente-frase-descargar-txt');
    if (elemDescargarTxt) {
        elemDescargarTxt.style.display = esAdmin ? 'inline-flex' : 'none';
    }

    // 3. Puntos en Banner
    const elemPuntos = document.getElementById('cliente-banner-puntos-val');
    if (elemPuntos && usuario) {
        const pts = Number(usuario.puntosAcumulados || 0) - Number(usuario.puntosCanjeados || 0);
        elemPuntos.textContent = `${Math.max(0, pts)} pts`;
    }
}

/**
 * Controla la visualización del campo de referencia y coordenadas según el método de pago:
 * Para Crédito y Efectivo: Opcional y deshabilitado de obligatoriedad; oculta coordenadas bancarias
 * Para Pago Móvil y Transferencia: Obligatorio y muestra coordenadas bancarias
 */
function manejarCambioMetodoPagoCliente(metodo) {
    const inputRef = document.getElementById('cliente-pago-referencia');
    const grupoRef = document.getElementById('cliente-grupo-referencia');
    const asterisco = document.getElementById('cliente-ref-asterisco');
    const textoAyuda = document.getElementById('cliente-pago-ayuda-texto');
    const btnConfirmar = document.getElementById('btn-cliente-confirmar-pedido');
    const multiBancoCont = document.getElementById('cliente-multibanco-container');

    // Mostrar el contenedor de coordenadas bancarias SOLO si seleccionó Pago Móvil o Transferencia
    if (multiBancoCont) {
        if (metodo === 'Pago Móvil VES' || metodo === 'Transferencia Bancaria VES') {
            multiBancoCont.style.display = 'block';
            poblarSelectorBancosCheckout();
        } else {
            multiBancoCont.style.display = 'none';
        }
    }

    if (metodo === 'Crédito') {
        if (grupoRef) grupoRef.style.display = 'none';
        if (inputRef) {
            inputRef.required = false;
            inputRef.placeholder = 'No requerida para compras a Crédito';
        }
        if (asterisco) asterisco.style.display = 'none';
        if (textoAyuda) {
            textoAyuda.innerHTML = '* Al comprar a <b>Crédito</b> el inventario se descontará de inmediato, sumará a tu historial de deudas y puntos, y podrás notificar a la tienda.';
        }
        if (btnConfirmar) {
            btnConfirmar.innerHTML = '<i class="fas fa-check-circle"></i> Confirmar Pedido a Crédito';
            btnConfirmar.className = 'btn btn-success';
        }
    } else if (metodo === 'Pago Móvil VES' || metodo === 'Transferencia Bancaria VES') {
        if (grupoRef) grupoRef.style.display = 'block';
        if (inputRef) {
            inputRef.required = true;
            inputRef.placeholder = 'Ej: 123456789012 (Obligatorio para conciliar)';
        }
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
        if (grupoRef) grupoRef.style.display = 'none';
        if (inputRef) {
            inputRef.required = false;
            inputRef.placeholder = 'Opcional para pagos en efectivo';
        }
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

    const container = document.getElementById('cliente-catalogo-grid');
    if (!container) return;

    const esComboHelper = (p) => (typeof esProductoCombo === 'function') ? esProductoCombo(p) : Boolean(p.esCombo === true || p.tipo === 'combo' || String(p.categoria || '').toLowerCase().includes('combo') || String(p.nombre || '').toLowerCase().includes('combo'));
    const todosLosCombos = (AppState.productos || []).filter(esComboHelper);
    const hayCombosParaDestacar = todosLosCombos.length > 0 && (!clienteBusqueda || clienteBusqueda.trim() === '');

    // 🔥 GESTIÓN DE CARRUSEL HORIZONTAL DE COMBOS DESTACADOS (Exclusivo para Combos)
    const carouselWrapper = document.getElementById('cliente-combos-carousel-wrapper');
    const carouselRail = document.getElementById('cliente-combos-carousel-rail');
    const carouselCount = document.getElementById('cliente-combos-carousel-count');

    const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 0);
    const ptsPorDolar = Number(AppState.premioMes?.puntosPorDolar || 1);
    const inviernoActivo = Boolean(AppState.isWinterMode || AppState.temporadaInviernoActiva || AppState.premioMes?.temporadaActiva === false);

    if (carouselWrapper && carouselRail) {
        if (hayCombosParaDestacar) {
            carouselWrapper.style.display = 'block';
            if (carouselCount) carouselCount.textContent = `${todosLosCombos.length} combos listos`;

            carouselRail.innerHTML = todosLosCombos.map(combo => {
                const precioUSD = Number(combo.precio || 0);
                const precioVES = tasa > 0 ? (precioUSD * tasa) : 0;
                const stock = Number(combo.stock || 0);
                const agotado = stock <= 0;
                const imagenSrc = (typeof obtenerImagenProducto === 'function' ? obtenerImagenProducto(combo) : (combo.imagen || ''));
                const pts = Number(combo.puntosCombo ?? combo.points_given ?? combo.puntosPromo ?? Math.max(1, Math.floor(precioUSD * ptsPorDolar)));

                return `
                    <div class="combo-carousel-item ${agotado ? 'card-agotado' : ''}" onclick="agregarAlCarritoCliente('${combo.id}')" title="Toca para agregar">
                        <div class="combo-carousel-img-wrap">
                            <img src="${imagenSrc}" data-original-src="${combo.imagen || ''}" data-prod-nombre="${combo.nombre ? combo.nombre.replace(/"/g, '&quot;') : ''}" data-prod-cat="Combos" alt="${combo.nombre}" class="combo-carousel-img" onerror="alFallarCargaImagen(this)">
                            <span class="combo-carousel-badge"><i class="fas fa-fire"></i> SUPER COMBO</span>
                        </div>
                        <div class="combo-carousel-body">
                            <h5 class="combo-carousel-name">${combo.nombre}</h5>
                            <div class="combo-carousel-pts" style="${inviernoActivo ? 'display:none!important;' : ''}">
                                <i class="fas fa-star" style="color:#f59e0b;"></i> +${pts} pts bono
                            </div>
                            <div class="combo-carousel-footer">
                                <div>
                                    <div class="combo-carousel-price">$${precioUSD.toFixed(2)}</div>
                                    <small style="font-size:0.68rem; color:var(--text-muted);">${precioVES > 0 ? 'Bs. ' + precioVES.toFixed(2) : ''}</small>
                                </div>
                                <button type="button" class="combo-carousel-btn" ${agotado ? 'disabled' : ''} onclick="event.stopPropagation(); agregarAlCarritoCliente('${combo.id}');">
                                    <i class="fas fa-cart-plus"></i> ${agotado ? 'Agotado' : 'Pedir'}
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            carouselWrapper.style.display = 'none';
        }
    }

    // Si el usuario filtró por 'COMBOS' y ya están todos en el carrusel superior, no duplicarlos abajo
    if (hayCombosParaDestacar && clienteFiltroCategoria === 'COMBOS') {
        container.innerHTML = `
            <div class="empty-state-card" style="grid-column: 1 / -1; text-align:center; padding:28px 16px; background:rgba(234,88,12,0.05); border:1px dashed rgba(249,115,22,0.3); border-radius:12px; margin-top:6px;">
                <i class="fas fa-fire" style="font-size:2rem; color:#ea580c; margin-bottom:8px; display:inline-block;"></i>
                <h4 style="color:#ea580c; font-size:1rem; font-weight:700; margin:0 0 4px 0;">Super Combos Destacados</h4>
                <p style="color:var(--text-muted); font-size:0.85rem; margin:0 auto; max-width:380px;">
                    Todos los combos disponibles están organizados arriba en el apartado destacado listos para agregar a tu pedido.
                </p>
            </div>
        `;
        renderizarCategoriasCatalogo();
        renderizarCarritoCliente();
        return;
    }

    let prods = [...(AppState.productos || [])];

    // Excluir combos del grid general si ya se muestran en el carrusel superior para evitar duplicidad
    if (hayCombosParaDestacar) {
        prods = prods.filter(p => !esComboHelper(p));
    }

    if (clienteFiltroCategoria === 'AGOTADOS' || clienteFiltroCategoria === 'STOCK_BAJO') {
        clienteFiltroCategoria = 'TODAS';
    }

    // Filtros de búsqueda y categorías
    if (clienteBusqueda) {
        const q = clienteBusqueda.toLowerCase();
        prods = prods.filter(p => (p.nombre || '').toLowerCase().includes(q) || (p.codigo || '').toLowerCase().includes(q) || (p.categoria || '').toLowerCase().includes(q));
    }
    
    // Para clientes, únicamente productos disponibles en inventario
    prods = prods.filter(p => Number(p.stock || 0) > 0);
    if (clienteFiltroCategoria && clienteFiltroCategoria !== 'TODAS' && clienteFiltroCategoria !== 'COMBOS') {
        prods = prods.filter(p => (p.categoria || 'General').trim().toUpperCase() === clienteFiltroCategoria.trim().toUpperCase());
    }

    // Ordenamiento por Stock, Puntos y Alfabético
    prods.sort((a, b) => {
        const stockA = Number(a.stock || 0);
        const stockB = Number(b.stock || 0);
        if (stockA > 0 && stockB <= 0) return -1;
        if (stockA <= 0 && stockB > 0) return 1;

        const puntosA = Number(a.puntosPromo || a.points_given || a.puntosCombo || a.puntos || 0);
        const puntosB = Number(b.puntosPromo || b.points_given || b.puntosCombo || b.puntos || 0);
        if (puntosB !== puntosA) return puntosB - puntosA;

        return (a.nombre || '').localeCompare(b.nombre || '');
    });

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

    container.innerHTML = prods.map(p => {
        const esCombo = esComboHelper(p);
        // Si el carrusel de combos está activo, los combos jamás deben renderizarse en la cuadrícula inferior
        if (esCombo && hayCombosParaDestacar) {
            return '';
        }

        const precioUSD = Number(p.precio || 0);
        const precioVES = tasa > 0 ? (precioUSD * tasa) : 0;
        const stock = Number(p.stock || 0);
        const agotado = stock <= 0;
        const imagenSrc = (typeof obtenerImagenProducto === 'function' ? obtenerImagenProducto(p) : (p.imagen || ''));

        const puntosGanados = esCombo && (p.puntosCombo !== undefined || p.points_given !== undefined || p.puntosPromo !== undefined)
            ? Number(p.puntosCombo ?? p.points_given ?? p.puntosPromo)
            : (p.puntos !== undefined && Number(p.puntos) > 0 
                ? Number(p.puntos) 
                : (precioUSD > 0 ? Math.max(1, Math.floor(precioUSD * ptsPorDolar)) : 0));

        const umbralBajo = typeof obtenerUmbralStockBajo === 'function' ? obtenerUmbralStockBajo() : 5;
        const stockBadgeClass = agotado 
            ? 'badge-stock-tag stock-agotado' 
            : (stock > 0 && stock <= umbralBajo ? 'badge-stock-tag stock-low badge-stock-low' : 'badge-stock-tag stock-normal');

        return `
            <div class="cliente-prod-card pos-row-item ${agotado ? 'card-agotado' : ''} ${esCombo ? 'es-super-combo' : ''}" id="cli-card-${p.id}"
                onclick="if (!event.target.closest('button') && !${agotado}) agregarAlCarritoCliente('${p.id}');"
                style="${agotado ? '' : 'cursor: pointer;'}"
                title="${agotado ? 'Producto agotado' : 'Toca para agregar al carrito'}">
                <div class="cliente-prod-img-wrapper">
                    <img src="${imagenSrc}" data-original-src="${p.imagen || ''}" data-prod-nombre="${p.nombre ? p.nombre.replace(/"/g, '&quot;') : ''}" data-prod-cat="${(p.categoria || 'Snacks').replace(/"/g, '&quot;')}" alt="${p.nombre}" class="cliente-prod-img" onerror="alFallarCargaImagen(this)">
                    ${agotado ? '<span class="badge-agotado-pill">Agotado</span>' : ''}
                </div>
                <div class="cliente-prod-body">
                    <div class="cliente-prod-meta">
                        <span class="cliente-prod-code">Cód: ${p.codigo || p.id}</span>
                        <span class="cliente-prod-badge-cat">${esCombo ? '🔥 Combo' : (p.categoria || 'General')}</span>
                        <span class="${stockBadgeClass}" title="Existencia: ${stock} unidades">Stock: ${stock}</span>
                    </div>
                    <h4 class="cliente-prod-title" title="${p.nombre}">${p.nombre}</h4>
                    
                    <div class="cliente-prod-prices">
                        <span class="price-usd">$${precioUSD.toFixed(2)}</span>
                        <span class="price-ves">Bs. ${precioVES > 0 ? precioVES.toFixed(2) : '—'}</span>
                    </div>
                </div>
                <div class="cliente-prod-action">
                    <button type="button" class="btn ${agotado ? 'btn-secondary' : 'btn-primary'} cliente-btn-add" 
                        onclick="agregarAlCarritoCliente('${p.id}')" ${agotado ? 'disabled' : ''} title="${agotado ? 'Agotado' : 'Agregar al carrito'}">
                        <i class="fas fa-plus"></i>
                        <span class="cliente-btn-text">${agotado ? 'Agotado' : (esCombo ? 'Pedir Combo' : 'Agregar')}</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    renderizarCategoriasCatalogo();
    renderizarCarritoCliente();
}

/**
 * Renderiza los botones de categorías en el catálogo del cliente
 */
function renderizarCategoriasCatalogo() {
    const container = document.getElementById('cliente-catalogo-cats') || document.getElementById('cliente-categorias-chips');
    if (!container) return;

    const catsSet = new Set();

    // 1. Categorías personalizadas configuradas en el sistema
    const baseBodega = ['Bebidas', 'Dulces', 'Snacks', 'Chucherías', 'Víveres'];
    baseBodega.forEach(c => catsSet.add(c));

    (AppState.categoriasPersonalizadas || []).forEach(c => {
        if (c && typeof c === 'string' && c.trim() && !c.toLowerCase().includes('combo')) {
            catsSet.add(c.trim());
        }
    });

    // 2. Categorías presentes en los productos existentes
    (AppState.productos || []).forEach(p => {
        if (p.categoria && typeof p.categoria === 'string' && p.categoria.trim()) {
            const cat = p.categoria.trim();
            if (!cat.toLowerCase().includes('combo') && !cat.toLowerCase().includes('general')) {
                catsSet.add(cat);
            }
        }
    });

    const cats = Array.from(catsSet);
    const totalCombos = (AppState.productos || []).filter(p => (typeof esProductoCombo === 'function') ? esProductoCombo(p) : Boolean(p.esCombo === true || p.tipo === 'combo' || String(p.categoria || '').toLowerCase().includes('combo') || String(p.nombre || '').toLowerCase().includes('combo'))).length;

    let html = `
        <button type="button" class="chip-filter ${clienteFiltroCategoria === 'TODAS' ? 'active' : ''}" onclick="filtrarCatalogoClienteCategoria('TODAS')">
            🌟 Todas
        </button>
    `;

    if (totalCombos > 0) {
        html += `
            <button type="button" class="chip-filter ${clienteFiltroCategoria === 'COMBOS' ? 'active' : ''}" onclick="filtrarCatalogoClienteCategoria('COMBOS')" style="background: linear-gradient(135deg, rgba(234,88,12,0.18), rgba(245,158,11,0.22)); border-color: rgba(249,115,22,0.45); color: #ea580c; font-weight: 800;">
                🔥 Combos (${totalCombos})
            </button>
        `;
    }

    const iconoPorCategoria = (cat) => {
        const c = cat.toLowerCase();
        if (c.includes('bebida') || c.includes('refresco') || c.includes('jugo')) return '🥤';
        if (c.includes('dulce') || c.includes('caramelo') || c.includes('chupeta')) return '🍬';
        if (c.includes('snack') || c.includes('chuchería') || c.includes('chucheria') || c.includes('chips') || c.includes('dorito')) return '🍿';
        if (c.includes('galleta')) return '🍪';
        if (c.includes('chocolate')) return '🍫';
        if (c.includes('vívere') || c.includes('viveres') || c.includes('grano') || c.includes('harina')) return '🥫';
        if (c.includes('lácteo') || c.includes('lacteo') || c.includes('queso')) return '🧀';
        return '🏷️';
    };

    html += cats.map(cat => {
        const isActive = clienteFiltroCategoria.trim().toUpperCase() === cat.trim().toUpperCase();
        return `
            <button type="button" class="chip-filter ${isActive ? 'active' : ''}" onclick="filtrarCatalogoClienteCategoria('${cat}')">
                ${iconoPorCategoria(cat)} ${cat}
            </button>
        `;
    }).join('');

    container.innerHTML = html;
    if (typeof inicializarScrollHorizontalInteractivo === 'function') {
        inicializarScrollHorizontalInteractivo(container, 'cliente-cat-scroll-left', 'cliente-cat-scroll-right');
    }
}

function filtrarCatalogoClienteCategoria(cat) {
    clienteFiltroCategoria = cat;
    renderizarCatalogoCliente();
    if (cat === 'COMBOS') {
        const carousel = document.getElementById('cliente-combos-carousel-wrapper');
        if (carousel) {
            carousel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
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
    const p = (AppState.productos || []).find(prod => prod.id === id) || (AppState.combos || []).find(c => c.id === id);
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
            if (!itemEnCarrito.imagen && p.imagen) itemEnCarrito.imagen = p.imagen;
        } else {
            alert(`Stock máximo disponible alcanzado (${p.stock} unid).`);
            return;
        }
    } else {
        AppState.carrito.push({
            productoId: id,
            nombre: p.nombre,
            precio: Number(p.precio || 0),
            cantidad: 1,
            imagen: p.imagen || ''
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
 * Renderiza el carrito para la vista de cliente (Con miniaturas de imagen y cero scroll horizontal)
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
            tbody.innerHTML = `
                <div style="text-align:center; padding:24px 12px; color:var(--text-muted);">
                    <i class="fas fa-shopping-basket" style="font-size:2.2rem; color:#cbd5e1; margin-bottom:8px; display:block;"></i>
                    <p style="margin:0 0 4px 0; font-size:0.92rem; font-weight:700; color:#475569;">Tu carrito está vacío</p>
                    <small style="color:#94a3b8; font-size:0.78rem;">Agrega productos desde el catálogo para continuar</small>
                </div>
            `;
        } else {
            tbody.innerHTML = carrito.map((item, idx) => {
                const subtotal = item.cantidad * item.precio;
                totalUSD += subtotal;
                cantTotal += item.cantidad;

                const prod = (AppState.productos || []).find(p => p.id === item.productoId) 
                          || (AppState.combos || []).find(c => c.id === item.productoId);
                const rawImg = item.imagen || prod?.imagen || '';
                const imagenSrc = (typeof obtenerImagenProducto === 'function' ? obtenerImagenProducto(prod || item) : (rawImg || ''));

                return `
                    <div class="cliente-cart-item-row" id="cart-item-${idx}">
                        <!-- Miniatura con la imagen del producto -->
                        <div class="cliente-cart-item-img">
                            <img src="${imagenSrc}" data-original-src="${rawImg}" data-prod-nombre="${item.nombre ? item.nombre.replace(/"/g, '&quot;') : ''}" data-prod-cat="General" alt="${item.nombre}" onerror="alFallarCargaImagen(this)">
                        </div>

                        <!-- Información: Nombre, Precio unitario y Subtotal -->
                        <div class="cliente-cart-item-info">
                            <div class="cliente-cart-item-name" title="${item.nombre}">${item.nombre}</div>
                            <div class="cliente-cart-item-meta">
                                <span class="cliente-cart-item-price">$${item.precio.toFixed(2)} c/u</span>
                                <span style="color:#cbd5e1;">•</span>
                                <strong class="cliente-cart-item-subtotal">$${subtotal.toFixed(2)}</strong>
                            </div>
                        </div>

                        <!-- Controles de Cantidad -->
                        <div class="cliente-cart-item-qty">
                            <button type="button" class="btn-qty-client" onclick="modificarCantidadCarritoCliente(${idx}, -1)" title="Disminuir" aria-label="Disminuir cantidad">-</button>
                            <span style="display:inline-block; min-width:24px; text-align:center; font-weight:700; font-size:0.85rem; color:#0f172a;">${item.cantidad}</span>
                            <button type="button" class="btn-qty-client" onclick="modificarCantidadCarritoCliente(${idx}, 1)" title="Aumentar" aria-label="Aumentar cantidad">+</button>
                        </div>

                        <!-- Botón para Eliminar Producto -->
                        <button type="button" class="cliente-cart-item-del" onclick="eliminarDelCarritoCliente(${idx})" title="Eliminar producto" aria-label="Eliminar ${item.nombre}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
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
    const inviernoActivo = Boolean(AppState.isWinterMode || AppState.temporadaInviernoActiva || AppState.premioMes?.temporadaActiva === false);
    const ptsGanables = inviernoActivo ? 0 : Math.floor(totalUSD * ptsPorDolar);

    document.querySelectorAll('#cliente-carrito-count, .cliente-carrito-count').forEach(el => el.textContent = cantTotal);
    if (badgeCount) badgeCount.textContent = cantTotal;
    if (floatingCount) floatingCount.textContent = cantTotal;
    if (totalUsdEl) totalUsdEl.textContent = `$${totalUSD.toFixed(2)}`;
    if (floatingTotalUsd) floatingTotalUsd.textContent = `$${totalUSD.toFixed(2)}`;
    if (totalVesEl) totalVesEl.textContent = `Bs. ${totalVES > 0 ? totalVES.toFixed(2) : '—'}`;
    if (floatingTotalVes) floatingTotalVes.textContent = `Bs. ${totalVES > 0 ? totalVES.toFixed(2) : '—'}`;
    if (ptsPreviewEl) ptsPreviewEl.textContent = `+${ptsGanables} Pts`;

    const puntosRow = document.getElementById('cliente-carrito-puntos-row');
    if (puntosRow) {
        puntosRow.style.display = inviernoActivo ? 'none' : 'flex';
    }

    // Visibilidad de barra flotante de carrito
    if (floatingBar) {
        floatingBar.style.display = cantTotal > 0 ? 'flex' : 'none';
    }
}

function modificarCantidadCarritoCliente(idx, delta) {
    const item = AppState.carrito[idx];
    if (!item) return;

    const producto = (AppState.productos || []).find(p => p.id === item.productoId) 
                  || (AppState.combos || []).find(c => c.id === item.productoId);
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
    if (!AppState.carrito || AppState.carrito.length === 0) {
        if (typeof showCustomToast === 'function') {
            showCustomToast("El carrito ya está vacío", "info");
        }
        return;
    }

    AppState.carrito = [];
    renderizarCarritoCliente();
    if (typeof renderizarCarrito === 'function') renderizarCarrito();
    if (typeof showCustomToast === 'function') {
        showCustomToast("Carrito vaciado", "info");
    }
}

/**
 * Retorna la lista activa de cuentas bancarias desde AppState (excluye cuentas pausadas)
 */
function obtenerCuentasBancariasActivas() {
    let lista = AppState.cuentasBancarias;
    if (!Array.isArray(lista)) {
        lista = [];
    }
    // Retorna estrictamente solo las cuentas activas (no pausadas)
    return lista.filter(c => c && c.activo !== false);
}

/**
 * Puebla el selector de bancos del modal de carrito/checkout con solo cuentas activas
 */
function poblarSelectorBancosCheckout() {
    const select = document.getElementById('cliente-banco-selector');
    const card = document.getElementById('cliente-banco-card');
    if (!select) return;

    const cuentas = obtenerCuentasBancariasActivas();
    
    if (cuentas.length === 0) {
        select.innerHTML = '<option value="" disabled selected>⚠️ No hay cuentas bancarias activas temporalmente</option>';
        if (card) {
            card.innerHTML = `
                <div style="text-align:center; padding:14px 10px; color:#b45309; background:#fffbeb; border:1px dashed #f59e0b; border-radius:8px; font-size:0.83rem;">
                    <i class="fas fa-pause-circle" style="font-size:1.4rem; margin-bottom:6px; display:block;"></i>
                    Los pagos electrónicos / móviles se encuentran en pausa temporal.<br>
                    <span style="font-size:0.78rem; font-weight:500; color:#92400e;">Puedes continuar tu pedido a Crédito o consultar directamente por WhatsApp.</span>
                </div>
            `;
        }
        return;
    }

    const valorPrevio = select.value;

    select.innerHTML = cuentas.map(c => {
        const banco = c.banco || c.bank || 'Banco';
        const tipo = c.tipo || c.type || 'Pago Móvil';
        return `<option value="${c.id}">${tipo}: ${banco}</option>`;
    }).join('');

    if (valorPrevio && cuentas.some(c => c.id === valorPrevio)) {
        select.value = valorPrevio;
    } else if (cuentas[0]) {
        select.value = cuentas[0].id;
    }
    actualizarDetallesBancoCliente(select.value);
}

function actualizarDetallesBancoCliente(bancoId = null) {
    const card = document.getElementById('cliente-banco-card');
    if (!card) return;

    const cuentas = obtenerCuentasBancariasActivas();
    if (cuentas.length === 0) {
        card.innerHTML = `
            <div style="text-align:center; padding:14px 10px; color:#b45309; background:#fffbeb; border:1px dashed #f59e0b; border-radius:8px; font-size:0.83rem;">
                <i class="fas fa-pause-circle" style="font-size:1.4rem; margin-bottom:6px; display:block;"></i>
                Los pagos electrónicos / móviles se encuentran en pausa temporal.
            </div>
        `;
        return;
    }

    const select = document.getElementById('cliente-banco-selector');
    const targetId = bancoId || (select ? select.value : (cuentas[0] ? cuentas[0].id : ''));
    const banco = cuentas.find(b => b.id === targetId) || cuentas[0];
    if (!banco) return;

    const nombreBanco = banco.banco || banco.bank || 'Banco';
    const tipoBanco = banco.tipo || banco.type || 'Pago Móvil';
    const tlf = banco.telefono || banco.phone || '';
    const rif = banco.cedulaRif || banco.idNumber || '';
    const numCuenta = banco.cuenta || banco.account || '';
    const tit = banco.titular || 'Tu Bodeguita';
    const nota = banco.instrucciones || '';

    const esPM = tipoBanco.toLowerCase().includes('móvil') || tipoBanco.toLowerCase().includes('movil');
    const badgeBg = esPM ? '#dbeafe' : (tipoBanco.toLowerCase().includes('divisas') ? '#dcfce7' : '#fef3c7');
    const badgeColor = esPM ? '#1d4ed8' : (tipoBanco.toLowerCase().includes('divisas') ? '#15803d' : '#b45309');

    card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <strong style="color:#1e40af; font-size:0.88rem;">${nombreBanco}</strong>
            <span style="font-size:0.72rem; font-weight:800; padding:2px 8px; border-radius:9999px; background:${badgeBg}; color:${badgeColor};">${tipoBanco}</span>
        </div>
        ${tlf ? `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:4px 0; border-bottom:1px solid #f1f5f9;">
            <span style="color:#475569; font-size:0.8rem;">Teléfono Pago Móvil: <strong>${tlf}</strong></span>
            <button type="button" class="btn btn-sm" onclick="copiarDatoBancoCliente('${tlf}', this)" style="padding:2px 7px; font-size:0.72rem; background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe;">Copiar</button>
        </div>` : ''}
        ${rif ? `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:4px 0; border-bottom:1px solid #f1f5f9;">
            <span style="color:#475569; font-size:0.8rem;">C.I / RIF: <strong>${rif}</strong></span>
            <button type="button" class="btn btn-sm" onclick="copiarDatoBancoCliente('${rif}', this)" style="padding:2px 7px; font-size:0.72rem; background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe;">Copiar</button>
        </div>` : ''}
        ${numCuenta ? `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:4px 0; border-bottom:1px solid #f1f5f9;">
            <span style="color:#475569; font-size:0.8rem;">Nº Cuenta: <strong style="letter-spacing:0.5px;">${numCuenta}</strong></span>
            <button type="button" class="btn btn-sm" onclick="copiarDatoBancoCliente('${numCuenta}', this)" style="padding:2px 7px; font-size:0.72rem; background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe;">Copiar</button>
        </div>` : ''}
        ${tit ? `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:4px 0;">
            <span style="color:#475569; font-size:0.8rem;">Titular: <strong>${tit}</strong></span>
            <button type="button" class="btn btn-sm" onclick="copiarDatoBancoCliente('${tit}', this)" style="padding:2px 7px; font-size:0.72rem; background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe;">Copiar</button>
        </div>` : ''}
        ${nota ? `
        <div style="margin-top:4px; padding-top:4px; border-top:1px dashed #e2e8f0; font-size:0.75rem; color:#64748b;">
            <i class="fas fa-info-circle"></i> ${nota}
        </div>` : ''}
        <button type="button" onclick="copiarTodosDatosBanco('${banco.id}', this)" class="btn btn-block" style="margin-top:8px; background:#2563eb; color:#ffffff; font-size:0.78rem; font-weight:700; padding:6px; border:none; border-radius:6px; display:flex; align-items:center; justify-content:center; gap:6px;">
            <i class="fas fa-copy"></i> Copiar todos los datos de este banco
        </button>
    `;
}

function copiarDatoBancoCliente(texto, btn) {
    if (!texto) return;
    navigator.clipboard.writeText(texto).then(() => {
        if (btn) {
            const original = btn.textContent;
            btn.textContent = '✓ Copiado';
            btn.style.background = '#10b981';
            btn.style.color = '#ffffff';
            setTimeout(() => {
                btn.textContent = original;
                btn.style.background = '#eff6ff';
                btn.style.color = '#2563eb';
            }, 1800);
        }
    });
}

function copiarTodosDatosBanco(bancoId, btn = null) {
    const cuentas = obtenerCuentasBancariasActivas();
    const select = document.getElementById('cliente-banco-selector') || document.getElementById('abono-cli-banco-selector');
    const targetId = bancoId || (select ? select.value : (cuentas[0] ? cuentas[0].id : ''));
    const banco = cuentas.find(b => b.id === targetId) || cuentas[0];
    if (!banco) return;

    const nombre = banco.banco || banco.bank || 'Banco';
    const tipo = banco.tipo || banco.type || 'Pago Móvil';
    const tlf = banco.telefono || banco.phone;
    const rif = banco.cedulaRif || banco.idNumber;
    const cuenta = banco.cuenta || banco.account;
    const titular = banco.titular;
    const nota = banco.instrucciones;

    const lineas = [
        `*Datos de Pago - ${nombre}*`,
        `• Tipo: ${tipo}`,
        tlf ? `• Teléfono Pago Móvil: ${tlf}` : null,
        rif ? `• C.I / RIF: ${rif}` : null,
        cuenta ? `• Nº Cuenta: ${cuenta}` : null,
        titular ? `• Titular: ${titular}` : null,
        nota ? `• Nota: ${nota}` : null
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(lineas).then(() => {
        if (btn) {
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> ¡Datos copiados!';
            btn.style.background = '#16a34a';
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.style.background = '#2563eb';
            }, 2000);
        }
        if (window.InventoryApp?.Modal?.toast) {
            window.InventoryApp.Modal.toast(`📋 Coordenadas de ${nombre} copiadas`, 'success');
        }
    });
}

window.obtenerCuentasBancariasActivas = obtenerCuentasBancariasActivas;
window.poblarSelectorBancosCheckout = poblarSelectorBancosCheckout;
window.actualizarDetallesBancoCliente = actualizarDetallesBancoCliente;
window.copiarDatoBancoCliente = copiarDatoBancoCliente;
window.copiarTodosDatosBanco = copiarTodosDatosBanco;

function abrirModalCarritoCliente() {
    const modal = document.getElementById('modal-cliente-carrito');
    if (modal) {
        modal.classList.add('active');
        const selectMetodo = document.getElementById('cliente-tipo-pago');
        if (selectMetodo) {
            selectMetodo.value = 'Crédito';
            manejarCambioMetodoPagoCliente('Crédito');
        }
        poblarSelectorBancosCheckout();
        actualizarDetallesBancoCliente();
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
        const selectBanco = document.getElementById('cliente-banco-selector');
        const cuentaId = selectBanco ? selectBanco.value : '';
        const cuentas = typeof obtenerCuentasBancariasActivas === 'function' ? obtenerCuentasBancariasActivas() : [];
        const cuentaDestino = cuentas.find(c => c.id === cuentaId) || cuentas[0];
        const bancoLinea = cuentaDestino ? `🏦 *Banco / Destino:* ${cuentaDestino.banco || cuentaDestino.bank} (${cuentaDestino.telefono || cuentaDestino.phone || cuentaDestino.cuenta || ''})\n` : '';

        msg = `🛒 *PEDIDO - TU BODEGUITA DE CONFIANZA*\n\n` +
            `👤 *Cliente:* ${usuario.nombre || 'Cliente'} (C.I/RIF: ${usuario.cedula || usuario.id || 'N/A'})\n` +
            `📱 *Teléfono:* ${usuario.telefono || 'N/A'}\n` +
            `🔢 *Referencia Bancaria:* ${ref || 'N/A'}\n` +
            `💳 *Método de Pago:* ${metodo}\n` +
            bancoLinea + `\n` +
            `📦 *Productos Solicitados:*\n${prodsTexto || 'Sin productos'}\n\n` +
            `💵 *Total a Pagar:* $${totalUSD.toFixed(2)}\n` +
            `🇻🇪 *Equivalente en Bolívares:* Bs. ${totalVES.toFixed(2)} (Tasa BCV: ${tasa > 0 ? tasa.toFixed(2) : '—'})\n\n` +
            `📎 *Adjunto mi comprobante de pago para su validación.*`;
    }

    return msg;
}

/**
 * Abre el enlace directo a WhatsApp dirigido al número oficial configurado.
 * Usa la URL directa y normalizada para evitar la pantalla "404. Esta página no existe".
 */
function abrirWhatsAppComprobante(datosPedido = null) {
    const rawTel = AppState.telefonoWhatsApp || '0412-5363849';
    const numeroWhatsApp = (typeof normalizarNumeroWhatsApp === 'function') 
        ? normalizarNumeroWhatsApp(rawTel) 
        : '584125363849';

    const textoPlano = generarMensajeWhatsApp(datosPedido);

    if (typeof abrirWhatsAppEnlace === 'function') {
        abrirWhatsAppEnlace({ telefono: numeroWhatsApp, mensaje: textoPlano, app: 'normal' });
    } else {
        const url = `https://api.whatsapp.com/send?phone=${numeroWhatsApp}&text=${encodeURIComponent(textoPlano)}&app=normal`;
        const nuevaVentana = window.open(url, '_blank');
        if (!nuevaVentana || nuevaVentana.closed || typeof nuevaVentana.closed === 'undefined') {
            const a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                if (document.body.contains(a)) document.body.removeChild(a);
            }, 300);
        }
    }
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
    
    // Validar estado de la temporada de invierno / pausas de incentivos
    const inviernoActivo = Boolean(
        AppState.isWinterMode || 
        AppState.temporadaInviernoActiva || 
        AppState.premioMes?.temporadaActiva === false ||
        AppState.premioMes?.estado === 'PAUSADO' ||
        AppState.premioMes?.estado === 'GANADOR_ALCANZADO'
    );
    const ptsPorDolar = Number(AppState.premioMes?.puntosPorDolar || 1);
    const puntosEstimados = inviernoActivo ? 0 : Math.floor(totalUSD * ptsPorDolar);

    const comentarioInput = document.getElementById('cliente-pago-comentario');
    const comentario = (comentarioInput ? comentarioInput.value : '').trim();

    // Preparar objeto de pedido para la confirmación
    const datosPedido = {
        carrito: [...carrito],
        totalUSD: totalUSD,
        totalVES: totalVES,
        metodoPago: tipoPago,
        referencia: referencia,
        comentario: comentario,
        esCredito: esCredito,
        inviernoActivo: inviernoActivo,
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
    const inviernoActivo = Boolean(datosPedido.inviernoActivo);

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
                ${(!inviernoActivo && datosPedido.puntosEstimados > 0) ? `
                <div style="display:flex; justify-content:space-between; border-top:1px dashed #cbd5e1; padding-top:8px; margin-top:4px;">
                    <span style="color:#d97706; font-weight:600;"><i class="fas fa-trophy"></i> Puntos a ganar:</span>
                    <strong style="color:#d97706;">+${datosPedido.puntosEstimados} pts</strong>
                </div>
                ` : ''}
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

    // 1. Descontar de forma automática el stock del inventario (cola preventiva de pedidos)
    for (const item of carrito) {
        if (window.InventoryApp && window.InventoryApp.StockService && typeof window.InventoryApp.StockService.sale === 'function') {
            window.InventoryApp.StockService.sale(item.productoId, item.cantidad);
        } else {
            const prod = (AppState.productos || []).find(p => p.id === item.productoId);
            if (prod) prod.stock = Math.max(0, Number(prod.stock || 0) - Number(item.cantidad));
        }
        // Sincronizar en Firestore para reflejar el stock reservado a otros clientes en tiempo real
        const prodActualizado = (AppState.productos || []).find(p => p.id === item.productoId);
        if (prodActualizado && window.InventoryApp?.Firebase?.guardarProducto) {
            window.InventoryApp.Firebase.guardarProducto(prodActualizado).catch(() => {});
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

    // 3. Otorgar puntos de fidelización al cliente (Solo si la temporada está activa y NO es crédito)
    // Regla de Integridad: Las compras a crédito mantienen los puntos congelados hasta su correspondiente abono/conciliación
    let puntosGanados = 0;
    const inviernoActivo = Boolean(
        AppState.isWinterMode || 
        AppState.temporadaInviernoActiva || 
        AppState.premioMes?.temporadaActiva === false ||
        AppState.premioMes?.estado === 'PAUSADO' ||
        AppState.premioMes?.estado === 'GANADOR_ALCANZADO'
    );
    if (!inviernoActivo && !esCredito && typeof otorgarPuntosPorCompra === 'function') {
        puntosGanados = otorgarPuntosPorCompra(clienteCedula, totalUSD, 'Compra en Tienda Cliente');
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
        estado: esCredito ? 'CONFIRMADO' : 'PENDIENTE_CONFIRMACION',
        confirmada: esCredito ? true : false,
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
            estado: esCredito ? 'Confirmado' : 'Confirmando',
            verificando: false,
            observacion: esCredito
                ? `Compra #${nuevoPedidoId} a crédito procesada para ${usuario.nombre}. Stock descontado automáticamente.`
                : `Compra #${nuevoPedidoId} por verificar pago para ${usuario.nombre}. Pendiente de confirmación bancaria.`
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

    // Manejo de Notificaciones y Verificación según el método de pago
    if (esCredito) {
        // Las transacciones a crédito NO requieren verificación/aprobación.
        // Se refleja de inmediato en el Centro de Notificaciones:
        if (typeof window.registrarNotificacion === 'function') {
            const bsStr = Number(totalVES || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 });
            window.registrarNotificacion({
                tipo: 'credito',
                titulo: 'Crédito Concedido',
                mensaje: `${usuario.nombre} sacó un crédito por Bs. ${bsStr} ($${Number(totalUSD).toFixed(2)} USD) (Pedido #${nuevoPedidoId})`,
                clienteId: clienteCedula,
                clienteNombre: usuario.nombre,
                montoUSD: Number(totalUSD),
                montoVES: Number(totalVES),
                referenciaId: nuevoPedidoId,
                destino: {
                    tab: 'clientes',
                    subAccion: 'verCliente',
                    clienteId: clienteCedula,
                    idRef: nuevoPedidoId
                }
            });
        }
    } else {
        // Sincronizar en la colección y documento PagosPorVerificar en Firebase Firestore solo para pagos pendientes de conciliar
        const datosPagoPorVerificar = {
            id: nuevoPedidoId,
            pedidoId: nuevoPedidoId,
            ventaId: nuevoPedidoId,
            clienteId: clienteCedula,
            clienteNombre: usuario.nombre,
            clienteCedula: clienteCedula,
            clienteTelefono: usuario.telefono || '',
            clienteEmail: usuario.email || '',
            totalUSD: totalUSD,
            montoUSD: totalUSD,
            totalVES: totalVES,
            montoVES: totalVES,
            metodoPago: tipoPago,
            tipoPago: tipoPago,
            tipo: tipoPago,
            referencia: referencia || (tipoPago.includes('Efectivo') ? 'Efectivo por verificar' : 'N/A'),
            items: itemsVendidos,
            fecha: fechaHora,
            fechaISO: new Date().toISOString(),
            estado: 'PENDIENTE_VERIFICACION',
            tipoRegistro: 'VENTA',
            origen: 'Tienda Online'
        };
        if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarPagoPorVerificar === 'function') {
            window.InventoryApp.Firebase.guardarPagoPorVerificar(datosPagoPorVerificar).catch(err => {
                console.warn('[Firebase] Error al registrar en PagosPorVerificar:', err);
            });
        }
        if (typeof window.registrarNotificacion === 'function') {
            const esDivisa = String(tipoPago).includes('USD') || String(tipoPago).includes('Divisa');
            const bsStr = Number(totalVES || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 });
            const msgPago = esDivisa
                ? `${usuario.nombre} reportó un pago en divisas de $${Number(totalUSD).toFixed(2)} USD (${tipoPago} - Ref: ${referencia || 'N/A'})`
                : `${usuario.nombre} reportó un pago de Bs. ${bsStr} (${tipoPago} - Ref: ${referencia || 'N/A'})`;

            window.registrarNotificacion({
                tipo: 'pago',
                titulo: 'Nuevo Pago Reportado',
                mensaje: msgPago,
                clienteId: clienteCedula,
                clienteNombre: usuario.nombre,
                montoUSD: Number(totalUSD),
                montoVES: Number(totalVES),
                referenciaId: nuevoPedidoId,
                destino: {
                    tab: 'transacciones',
                    subAccion: 'verPago',
                    idRef: nuevoPedidoId,
                    clienteId: clienteCedula
                }
            });
        }
    }

    // Registrar notificación de comentario si el cliente escribió una observación
    if (datos.comentario && typeof window.registrarNotificacion === 'function') {
        window.registrarNotificacion({
            tipo: 'comentario',
            titulo: 'Comentario en Pedido',
            mensaje: `${usuario.nombre} dejó un comentario: "${datos.comentario}"`,
            clienteId: clienteCedula,
            clienteNombre: usuario.nombre,
            referenciaId: nuevoPedidoId,
            destino: {
                tab: 'clientes',
                subAccion: 'verCliente',
                clienteId: clienteCedula,
                idRef: nuevoPedidoId,
                textoComentario: datos.comentario
            }
        });
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
    const comentarioLimpiarInput = document.getElementById('cliente-pago-comentario');
    if (comentarioLimpiarInput) comentarioLimpiarInput.value = '';

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
    if (typeof actualizarBadgeVentasHoy === 'function') actualizarBadgeVentasHoy();
    if (typeof renderizarNotificaciones === 'function') renderizarNotificaciones();
    if (typeof actualizarBadgesNotificaciones === 'function') actualizarBadgesNotificaciones();

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

let _ultimoSyncAccountStatus = 0;

/**
 * Calcula las métricas de compra y abono para la vista de cuenta del cliente
 * REGLA DE NEGOCIO:
 * Al pagar toda su deuda (esSolvente), el total comprado vuelve a 0.00 para el cliente,
 * así el cliente no ve cuánto ha gastado en la bodega.
 * El Administrador sí conserva la visibilidad de la cifra histórica acumulada real.
 */
function calcularMetricasCompradoCliente(estadoFin, usuario, ventasCliente, abonosAprobados) {
    const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 0);
    const esAdminReal = (typeof esUsuarioAdmin === 'function' ? esUsuarioAdmin(usuario) : (usuario?.rol === 'admin')) ||
                        (String(usuario?.id || '').toLowerCase() === 'superadmin') ||
                        (String(usuario?.email || '').toLowerCase() === 'superadmin@tubodeguita.com');

    const totalAbonadoHistoricoUSD = estadoFin ? Number(estadoFin.totalAbonadoUSD || 0) : 0;
    const totalAbonadoHistoricoVES = estadoFin ? Number(estadoFin.totalAbonadoVES || 0) : 0;
    const totalCompradoHistoricoUSD = estadoFin ? Number(estadoFin.totalCompradoUSD || 0) : 0;
    const totalCompradoHistoricoVES = estadoFin ? Number(estadoFin.totalCompradoVES || 0) : 0;
    const saldoDeudaUSD = estadoFin ? Number(estadoFin.saldoDeudaUSD || 0) : 0;
    const saldoDeudaVES = estadoFin ? Number(estadoFin.saldoDeudaVES || 0) : 0;
    const esSolvente = estadoFin ? estadoFin.esSolvente : (saldoDeudaUSD <= 0.01);

    if (esAdminReal) {
        return {
            totalCompradoUSD: totalCompradoHistoricoUSD,
            totalCompradoVES: totalCompradoHistoricoVES,
            totalAbonadoUSD: totalAbonadoHistoricoUSD,
            totalAbonadoVES: totalAbonadoHistoricoVES,
            saldoDeudaUSD,
            saldoDeudaVES,
            esSolvente,
            esAdminReal: true,
            totalCompradoHistoricoUSD,
            totalCompradoHistoricoVES
        };
    }

    if (esSolvente) {
        return {
            totalCompradoUSD: 0,
            totalCompradoVES: 0,
            totalAbonadoUSD: 0,
            totalAbonadoVES: 0,
            saldoDeudaUSD: 0,
            saldoDeudaVES: 0,
            esSolvente: true,
            esAdminReal: false,
            totalCompradoHistoricoUSD,
            totalCompradoHistoricoVES
        };
    }

    // Si tiene deuda activa, calculamos el total comprado y abonado del ciclo actual
    // para no mostrar el acumulado de compras que ya fueron saldadas en el pasado
    let totalCompradoCicloUSD = 0;
    let totalAbonadoCicloUSD = 0;

    const eventos = [];
    (ventasCliente || []).forEach(v => {
        const esCred = v.tipo === 'Crédito' || v.tipo === 'credito' || v.tipoPago === 'Crédito' || !v.tipo;
        if (esCred) {
            eventos.push({
                tipo: 'venta',
                monto: Number(v.total || v.totalUSD || 0),
                fecha: new Date(v.fecha || 0).getTime()
            });
        }
    });
    (abonosAprobados || []).forEach(a => {
        const { montoUSD } = typeof sanitizarAbonoMonedas === 'function'
            ? sanitizarAbonoMonedas(a, tasa)
            : { montoUSD: Number(a.montoUSD || a.monto || 0) };
        eventos.push({
            tipo: 'abono',
            monto: montoUSD,
            fecha: new Date(a.fecha || 0).getTime()
        });
    });

    eventos.sort((a, b) => a.fecha - b.fecha);

    let bal = 0;
    let idxUltimoCero = -1;
    eventos.forEach((ev, i) => {
        if (ev.tipo === 'venta') bal += ev.monto;
        else if (ev.tipo === 'abono') bal = Math.max(0, bal - ev.monto);
        if (bal <= 0.01) {
            idxUltimoCero = i;
        }
    });

    for (let i = idxUltimoCero + 1; i < eventos.length; i++) {
        if (eventos[i].tipo === 'venta') totalCompradoCicloUSD += eventos[i].monto;
        else if (eventos[i].tipo === 'abono') totalAbonadoCicloUSD += eventos[i].monto;
    }

    if (totalCompradoCicloUSD < saldoDeudaUSD) {
        totalCompradoCicloUSD = Number((saldoDeudaUSD + totalAbonadoCicloUSD).toFixed(2));
    }

    totalCompradoCicloUSD = Number(totalCompradoCicloUSD.toFixed(2));
    totalAbonadoCicloUSD = Number(totalAbonadoCicloUSD.toFixed(2));
    const totalCompradoCicloVES = tasa > 0 ? Number((totalCompradoCicloUSD * tasa).toFixed(2)) : 0;
    const totalAbonadoCicloVES = tasa > 0 ? Number((totalAbonadoCicloUSD * tasa).toFixed(2)) : 0;

    return {
        totalCompradoUSD: totalCompradoCicloUSD,
        totalCompradoVES: totalCompradoCicloVES,
        totalAbonadoUSD: totalAbonadoCicloUSD,
        totalAbonadoVES: totalAbonadoCicloVES,
        saldoDeudaUSD,
        saldoDeudaVES,
        esSolvente: false,
        esAdminReal: false,
        totalCompradoHistoricoUSD,
        totalCompradoHistoricoVES
    };
}
window.calcularMetricasCompradoCliente = calcularMetricasCompradoCliente;

/**
 * Renderiza la sección personal de Estado de Cuenta & Deudas del Cliente
 * Sincroniza con el endpoint /api/account/status?userId=ID y renderiza la vista completa
 */
async function renderizarEstadoCuentaCliente() {
    const container = document.getElementById('cliente-estado-cuenta-container');
    const usuario = AppState.usuarioActual;
    if (!container || !usuario) return;

    const cedula = usuario.cedula || usuario.id;

    // Sincronización directa y segura con Firestore para garantizar abonos y deuda 100% al día
    const now = Date.now();
    if (window.InventoryApp?.Firebase?.sincronizarEstadoCuentaCliente) {
        const tiempoSinSync = now - _ultimoSyncAccountStatus;
        if (tiempoSinSync > 15000 || !AppState.abonos || AppState.abonos.length === 0) {
            _ultimoSyncAccountStatus = now;
            try {
                await window.InventoryApp.Firebase.sincronizarEstadoCuentaCliente(cedula);
            } catch (errSync) {
                console.warn('[ClienteView] Aviso sincronizando estado de cuenta desde Firestore:', errSync);
            }
        }
    } else if (now - _ultimoSyncAccountStatus > 30000) {
        _ultimoSyncAccountStatus = now;
        try {
            const resp = await fetch(`/api/account/status?userId=${encodeURIComponent(cedula)}`);
            if (resp.ok) {
                const data = await resp.json();
                console.log('[API Account Status] Sincronizado:', data);
            }
        } catch (e) {
            // Modo local fallback
        }
    }

    if (typeof asegurarSincronizacionUsuariosAClientes === 'function') {
        asegurarSincronizacionUsuariosAClientes(false);
    }

    const estadoFin = typeof calcularEstadoFinancieroCliente === 'function'
        ? calcularEstadoFinancieroCliente(usuario)
        : null;
    window.ultimoEstadoFinancieroCliente = estadoFin;

    const clienteEncontrado = estadoFin?.clienteObj || (AppState.clientes || []).find(c => 
        (c.cedula && String(c.cedula).toUpperCase() === String(cedula).toUpperCase()) ||
        (c.usuarioId && String(c.usuarioId).toUpperCase() === String(usuario.id).toUpperCase()) ||
        (usuario.clienteId && String(c.id).toUpperCase() === String(usuario.clienteId).toUpperCase()) ||
        (usuario.nombre && c.nombre && String(c.nombre).trim().toUpperCase() === String(usuario.nombre).trim().toUpperCase())
    );

    const ventasCliente = estadoFin?.ventasCliente || [];
    const abonosAprobados = estadoFin?.abonosCliente || [];
    const todosAbonosCliente = (AppState.abonos || []).filter(a => {
        if (!a) return false;
        const aCId = String(a.clienteId || '').toUpperCase();
        const aCCed = String(a.clienteCedula || '').toUpperCase();
        const aUId = String(a.usuarioId || '').toUpperCase();
        const aNom = String(a.clienteNombre || '').toUpperCase();
        const uCed = String(cedula || '').toUpperCase();
        const uId = String(usuario.id || '').toUpperCase();
        const uNom = String(usuario.nombre || '').toUpperCase();
        const cId = clienteEncontrado ? String(clienteEncontrado.id || '').toUpperCase() : '';
        return (cId && aCId === cId) || (uCed && (aCCed === uCed || aCId === uCed)) || (uId && aUId === uId) || (uNom && aNom === uNom);
    });

    const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 0);

    // Ocultar botón redundante "Volver Admin" en vista cliente si no es admin personificando
    const esAdminReal = (typeof esUsuarioAdmin === 'function' ? esUsuarioAdmin(usuario) : (usuario?.rol === 'admin')) ||
                        (String(usuario?.id || '').toLowerCase() === 'superadmin') ||
                        (String(usuario?.email || '').toLowerCase() === 'superadmin@tubodeguita.com');

    // REGLA DE NEGOCIO:
    // Al pagar toda su deuda (esSolvente), el total comprado vuelve a 0.00 para el cliente,
    // de modo que no vea su acumulado histórico de gasto en la bodega.
    // El Administrador sí conserva la visibilidad de la cifra histórica acumulada real.
    const metricas = calcularMetricasCompradoCliente(estadoFin, usuario, ventasCliente, abonosAprobados);
    const { totalCompradoUSD, totalCompradoVES, totalAbonadoUSD, totalAbonadoVES, saldoDeudaUSD, saldoDeudaVES, esSolvente, totalCompradoHistoricoUSD } = metricas;

    window.ultimoSaldoDeudaUSD = saldoDeudaUSD;
    window.ultimoSaldoDeudaVES = saldoDeudaVES;
    window.ultimoEstadoFinancieroCliente = estadoFin;

    const formatVES = (val) => Number(val || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const puntosPorLiberar = esSolvente ? 0 : ventasCliente
        .filter(v => (v.tipo === 'Crédito' || v.tipo === 'credito') && v.puntosOtorgados)
        .reduce((sum, v) => sum + Number(v.puntosOtorgados || 0), 0);

    const btnVolverAdmin = document.getElementById('btn-volver-admin');
    if (btnVolverAdmin && !esAdminReal) {
        btnVolverAdmin.style.display = 'none';
    }

    container.innerHTML = `
        <div class="customer-account-container" id="customer-account-view">
            <!-- 💳 TARJETA PRINCIPAL DE ESTADO DE CUENTA (HERO WALLET CARD) -->
            <section class="hero-wallet-card ${esSolvente ? 'wallet-solvente' : 'wallet-deuda'}">
                <div class="wallet-card-header">
                    <span class="wallet-chip-label">
                        <i class="fas ${esSolvente ? 'fa-shield-check' : 'fa-wallet'}"></i>
                        ${esSolvente ? 'Billetera Solvente' : 'Saldo Pendiente de Pago'}
                    </span>
                    <span class="wallet-status-tag">
                        <i class="fas ${esSolvente ? 'fa-circle-check' : 'fa-clock'}"></i>
                        ${esSolvente ? 'Al día' : 'Pendiente'}
                    </span>
                </div>

                <div class="wallet-balance-block">
                    <span class="wallet-balance-title">
                        ${esSolvente ? 'Deuda Actual' : 'Total a Pagar'}
                    </span>
                    <div class="wallet-balance-amount">
                        $${saldoDeudaUSD.toFixed(2)}
                        <span class="wallet-balance-currency">USD</span>
                    </div>
                    <span class="wallet-balance-ves">
                        ≈ Bs. ${tasa > 0 ? formatVES(saldoDeudaVES) : '—'}
                    </span>
                </div>

                <button type="button" class="wallet-cta-btn" onclick="abrirModalReportarPagoCliente({ saldoUSD: ${saldoDeudaUSD}, saldoVES: ${saldoDeudaVES} })">
                    <i class="fas fa-credit-card"></i>
                    <span>Pagar / Reportar Abono</span>
                </button>
            </section>

            <!-- 📊 3. GRILLA DE MÉTRICAS COMPACTA (2x2 GRID METRICS) -->
            <section class="customer-metrics-grid">
                <!-- Total Comprado -->
                <div class="metric-soft-card">
                    <div class="metric-header">
                        <div class="metric-icon-box metric-icon-blue">
                            <i class="fas fa-bag-shopping"></i>
                        </div>
                        <span class="metric-label">Total Comprado</span>
                    </div>
                    <div class="metric-value">$${totalCompradoUSD.toFixed(2)}</div>
                    <span class="metric-subtext">Bs. ${formatVES(totalCompradoVES)}</span>
                    ${esAdminReal 
                        ? `<div style="margin-top:4px;"><span class="badge" style="background:#e0f2fe; color:#0369a1; font-size:0.65rem; font-weight:700; padding:2px 6px; border-radius:4px;" title="Total histórico visible solo para administración. El cliente solvente ve $0.00">👑 Histórico Admin: $${totalCompradoHistoricoUSD.toFixed(2)}</span></div>` 
                        : (esSolvente ? `<div style="margin-top:4px;"><span class="badge" style="background:#dcfce7; color:#15803d; font-size:0.65rem; font-weight:700; padding:2px 6px; border-radius:4px;"><i class="fas fa-check"></i> Al día ($0.00)</span></div>` : `<div style="margin-top:4px;"><span class="badge" style="background:#fef3c7; color:#b45309; font-size:0.65rem; font-weight:700; padding:2px 6px; border-radius:4px;"><i class="fas fa-clock"></i> Ciclo activo</span></div>`)}
                </div>

                <!-- Total Abonado -->
                <div class="metric-soft-card">
                    <div class="metric-header">
                        <div class="metric-icon-box metric-icon-green">
                            <i class="fas fa-receipt"></i>
                        </div>
                        <span class="metric-label">Total Abonado</span>
                    </div>
                    <div class="metric-value">$${totalAbonadoUSD.toFixed(2)}</div>
                    <span class="metric-subtext">Bs. ${formatVES(totalAbonadoVES)} ${esAdminReal ? `(${abonosAprobados.length})` : (esSolvente ? '(Cuenta saldada)' : `(${abonosAprobados.length})`)}</span>
                    ${esAdminReal ? `<div style="margin-top:4px;"><span class="badge" style="background:#e0f2fe; color:#0369a1; font-size:0.65rem; font-weight:700; padding:2px 6px; border-radius:4px;">👑 Histórico Admin</span></div>` : (esSolvente ? `<div style="margin-top:4px;"><span class="badge" style="background:#dcfce7; color:#15803d; font-size:0.65rem; font-weight:700; padding:2px 6px; border-radius:4px;"><i class="fas fa-shield-check"></i> Solvente</span></div>` : '')}
                </div>

                <!-- Pedidos Activos -->
                <div class="metric-soft-card">
                    <div class="metric-header">
                        <div class="metric-icon-box metric-icon-purple">
                            <i class="fas fa-box"></i>
                        </div>
                        <span class="metric-label">Pedidos Activos</span>
                    </div>
                    <div class="metric-value">${ventasCliente.length} ${ventasCliente.length === 1 ? 'Pedido' : 'Pedidos'}</div>
                    <span class="metric-subtext">Historial registrado</span>
                </div>

                <!-- Puntos por Liberar -->
                <div class="metric-soft-card">
                    <div class="metric-header">
                        <div class="metric-icon-box metric-icon-amber">
                            <i class="fas fa-lock"></i>
                        </div>
                        <span class="metric-label">Puntos por Liberar</span>
                    </div>
                    <div class="metric-value" style="${puntosPorLiberar > 0 ? 'color:#b45309;' : ''}">+${puntosPorLiberar} Pts</div>
                    <span class="metric-subtext">${esSolvente ? 'Todos liberados' : 'Bloqueados hasta pagar'}</span>
                </div>
            </section>

            <!-- 📑 4. LISTADOS MÓVILES BASADOS EN TARJETAS (CARD-BASED LISTS) -->

            <!-- Sección A: Mis Compras y Pedidos -->
            <section class="customer-section">
                <div class="customer-section-header">
                    <h3 class="customer-section-title">
                        <i class="fas fa-bag-shopping" style="color:#2563eb;"></i>
                        <span>Mis Compras y Pedidos</span>
                    </h3>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="customer-section-badge">${ventasCliente.length} compras</span>
                        <button type="button" class="customer-section-action-btn customer-btn-excel" onclick="descargarHistorialDeudaClienteExcel()" title="Descargar estado de cuenta e historial de deuda en Excel (.xlsx)">
                            <i class="fas fa-file-excel" style="color:#10b981;"></i>
                            <span>Descargar Excel</span>
                        </button>
                    </div>
                </div>

                <div class="cards-list-wrapper">
                    ${ventasCliente.length === 0 ? `
                        <div class="empty-cards-state">
                            <i class="fas fa-box-open"></i>
                            <p>Aún no tienes compras o pedidos registrados en el sistema.</p>
                        </div>
                    ` : (typeof window.ordenarListadoVentas === 'function' ? window.ordenarListadoVentas(ventasCliente, 'fecha', 'desc') : ventasCliente.slice().sort((a,b) => new Date(b.fecha || 0) - new Date(a.fecha || 0))).map(v => {
                        const totalUSD = Number(v.total || 0);
                        const tasaVenta = Number(v.tasa || tasa || 1);
                        const totalVES = tasaVenta > 0 ? (totalUSD * tasaVenta) : (tasa > 0 ? totalUSD * tasa : 0);
                        const esCredito = v.tipo === 'Crédito';
                        const esPendiente = v.estado === 'PENDIENTE_CONFIRMACION';
                        const itemsCount = (v.items || []).reduce((acc, it) => acc + (Number(it.cantidad) || 1), 0);
                        const itemsDesc = (v.items || []).map(i => `${i.cantidad}x ${i.nombre}`).join(', ') || 'Compra de productos';

                        let badgeClass = 'badge-approved';
                        let badgeText = 'Contado';
                        let badgeIcon = 'fa-check';

                        if (esPendiente) {
                            badgeClass = 'badge-pending';
                            badgeText = 'Por Confirmar';
                            badgeIcon = 'fa-hourglass-half';
                        } else if (esCredito) {
                            if (saldoDeudaUSD > 0) {
                                badgeClass = 'badge-pending';
                                badgeText = 'Pendiente';
                                badgeIcon = 'fa-clock';
                            } else {
                                badgeClass = 'badge-settled';
                                badgeText = 'Liquidado';
                                badgeIcon = 'fa-circle-check';
                            }
                        }

                        // Motivo explicativo de la deuda ("¿Por qué debo esto?")
                        let motivoIcon = 'fa-hand-holding-dollar';
                        let motivoColor = '#2563eb';
                        let motivoBg = '#eff6ff';
                        let motivoTitulo = 'Compra a Crédito (Fiado) en Tienda';
                        let motivoDesc = `Esta compra fue registrada a crédito (fiado) en caja el ${v.fecha || 'la fecha indicada'}. Retiraste los productos detallados abajo sin pago de contado inmediato, cargándose el importe de $${totalUSD.toFixed(2)} USD a tu cuenta pendiente de pago.`;

                        if (v.esCargoManual || (v.items && v.items.some(i => i.productoId === 'CARGO_MANUAL')) || String(v.id).startsWith('CARGO_')) {
                            motivoIcon = 'fa-hand-holding-dollar';
                            motivoColor = '#dc2626';
                            motivoBg = '#fef2f2';
                            motivoTitulo = 'Préstamo de Dinero / Cargo Manual a Cuenta';
                            motivoDesc = `Se registró un préstamo o cargo directo a tu cuenta de $${totalUSD.toFixed(2)} USD el ${v.fecha || 'la fecha indicada'}. Motivo registrado: "${v.motivo || v.referencia || 'Préstamo de dinero en efectivo'}". Este importe fue sumado a tu cuenta sin retiro de productos de inventario.`;
                        } else if (v.id && String(v.id).startsWith('V_FIADO_')) {
                            motivoIcon = 'fa-book-bookmark';
                            motivoColor = '#b45309';
                            motivoBg = '#fef3c7';
                            motivoTitulo = 'Saldo Deudor de Libreta Fiada Histórica';
                            motivoDesc = `Este importe de $${totalUSD.toFixed(2)} USD proviene de la libreta física de cuentas fiadas de la bodega, transferida por la administración (Josna). Corresponde a compras previas pendientes de pago.`;
                        } else if (v.origen === 'Kiosco' || String(v.id).startsWith('PED_')) {
                            motivoIcon = 'fa-store';
                            motivoColor = '#7c3aed';
                            motivoBg = '#f5f3ff';
                            motivoTitulo = 'Pedido a Crédito en Auto-servicio';
                            motivoDesc = `Pedido solicitado a través de la plataforma de Auto-servicio con modalidad de pago a crédito/fiado pendiente de liquidación.`;
                        } else if (!esCredito) {
                            motivoIcon = 'fa-circle-check';
                            motivoColor = '#15803d';
                            motivoBg = '#f0fdf4';
                            motivoTitulo = 'Compra de Contado (Saldada)';
                            motivoDesc = `Esta compra fue cobrada y pagada en su totalidad de contado al momento de la entrega de la mercancía. No genera deuda pendiente.`;
                        }

                        // Filas de la tabla de artículos ("¿Qué debo exactamente?")
                        const tieneItems = Array.isArray(v.items) && v.items.length > 0;
                        const itemsRowsHtml = tieneItems ? v.items.map(it => {
                            const cant = Number(it.cantidad) || 1;
                            const pUSD = Number(it.precio || it.precioUSD || 0);
                            const subUSD = Number(it.subtotal || (cant * pUSD));
                            const pVES = tasaVenta > 0 ? (pUSD * tasaVenta) : 0;
                            const subVES = tasaVenta > 0 ? (subUSD * tasaVenta) : 0;
                            return `
                                <tr>
                                    <td>
                                        <div style="font-weight:700; color:#0f172a;">${it.nombre || 'Producto'}</div>
                                    </td>
                                    <td style="text-align:center;">
                                        <span class="tx-item-qty">${cant}x</span>
                                    </td>
                                    <td style="text-align:right;">
                                        <div>$${pUSD.toFixed(2)}</div>
                                        <div style="font-size:0.68rem; color:#64748b;">Bs. ${formatVES(pVES)}</div>
                                    </td>
                                    <td style="text-align:right; font-weight:700;">
                                        <div>$${subUSD.toFixed(2)}</div>
                                        <div style="font-size:0.68rem; color:#2563eb;">Bs. ${formatVES(subVES)}</div>
                                    </td>
                                </tr>
                            `;
                        }).join('') : `
                            <tr>
                                <td>
                                    <div style="font-weight:700; color:#0f172a;">${v.referencia || 'Compra de productos'}</div>
                                </td>
                                <td style="text-align:center;"><span class="tx-item-qty">1x</span></td>
                                <td style="text-align:right;">$${totalUSD.toFixed(2)}</td>
                                <td style="text-align:right; font-weight:700;">$${totalUSD.toFixed(2)}</td>
                            </tr>
                        `;

                        return `
                            <div class="transaction-card tx-card-expandable" id="tx-card-${v.id}" onclick="toggleDesgloseVentaCliente('${v.id}')" role="button" tabindex="0" title="Toca para desglosar qué debes exactamente y por qué">
                                <div class="tx-card-main-row">
                                    <div class="tx-left">
                                        <div class="tx-icon-pill ${esCredito ? 'tx-icon-credit' : 'tx-icon-sale'}">
                                            <i class="fas ${esCredito ? 'fa-hand-holding-dollar' : 'fa-cart-shopping'}"></i>
                                        </div>
                                        <div class="tx-details">
                                            <div class="tx-ref">
                                                <span>#${v.id}</span>
                                                <span class="tx-type-tag">${v.tipo || 'Contado'}</span>
                                            </div>
                                            <span class="tx-desc" title="${itemsDesc}">
                                                ${itemsCount > 0 ? `${itemsCount} art. • ` : ''}${itemsDesc}
                                            </span>
                                            <span class="tx-date">
                                                <i class="far fa-calendar-alt"></i> ${v.fecha || 'Fecha N/A'}
                                            </span>
                                        </div>
                                    </div>
                                    <div class="tx-right">
                                        <span class="tx-amount">$${totalUSD.toFixed(2)}</span>
                                        <span class="tx-amount-ves">Bs. ${formatVES(totalVES)}</span>
                                        <div style="display:flex; align-items:center; gap:6px;">
                                            <span class="tx-status-badge ${badgeClass}">
                                                <i class="fas ${badgeIcon}"></i>
                                                ${badgeText}
                                            </span>
                                            <span class="tx-chevron-wrap" id="chevron-wrap-${v.id}">
                                                <i class="fas fa-chevron-down tx-chevron" id="chevron-${v.id}"></i>
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div class="tx-expand-bar">
                                    <span class="tx-expand-hint">
                                        <i class="fas fa-list-check"></i> Toca para saber qué debes exactamente y por qué
                                    </span>
                                    <span style="font-size:0.7rem; color:#94a3b8;">
                                        ${itemsCount} ${itemsCount === 1 ? 'artículo' : 'artículos'}
                                    </span>
                                </div>

                                <!-- Panel Desplegable de Desglose Exacto -->
                                <div class="tx-desglose-panel" id="desglose-${v.id}" style="display:none;" onclick="event.stopPropagation()">
                                    <!-- 1. Explicación de la Deuda (Por qué debo esto) -->
                                    <div class="tx-desglose-motivo-box" style="background:${motivoBg}; border:1px solid ${motivoColor}33;">
                                        <div class="tx-desglose-motivo-icon" style="color:${motivoColor};">
                                            <i class="fas ${motivoIcon}"></i>
                                        </div>
                                        <div class="tx-desglose-motivo-content">
                                            <h4 class="tx-desglose-motivo-title" style="color:${motivoColor};">
                                                ¿Por qué debo esto? — ${motivoTitulo}
                                            </h4>
                                            <p class="tx-desglose-motivo-desc">
                                                ${motivoDesc}
                                            </p>
                                        </div>
                                    </div>

                                    <!-- 2. Desglose Ítem por Ítem (Qué debo exactamente) -->
                                    <div style="font-size:0.78rem; font-weight:800; color:#1e293b; margin-bottom:6px; display:flex; align-items:center; gap:6px;">
                                        <i class="fas fa-list-check" style="color:#2563eb;"></i>
                                        <span>Artículos Adquiridos en esta Operación:</span>
                                    </div>

                                    <div class="tx-items-table-wrapper">
                                        <table class="tx-items-table">
                                            <thead>
                                                <tr>
                                                    <th>Producto / Concepto</th>
                                                    <th style="text-align:center;">Cant.</th>
                                                    <th style="text-align:right;">Precio Unit.</th>
                                                    <th style="text-align:right;">Subtotal</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${itemsRowsHtml}
                                            </tbody>
                                        </table>
                                    </div>

                                    <!-- 3. Resumen Financiero y Estado de Deuda de esta Compra -->
                                    <div class="tx-desglose-totales-box">
                                        <div class="tx-totales-row">
                                            <span>Subtotal Artículos:</span>
                                            <strong>$${totalUSD.toFixed(2)} USD</strong>
                                        </div>
                                        <div class="tx-totales-row">
                                            <span>Tasa de Cambio Referencial:</span>
                                            <span>Bs. ${formatVES(tasaVenta)} / USD</span>
                                        </div>
                                        <div class="tx-totales-row highlight">
                                            <span>Total de la Compra:</span>
                                            <span style="color:#2563eb;">$${totalUSD.toFixed(2)} USD ≈ Bs. ${formatVES(totalVES)}</span>
                                        </div>
                                        <div class="tx-totales-row" style="margin-top:4px;">
                                            <span>Estado Financiero:</span>
                                            <span>
                                                ${esCredito 
                                                    ? (saldoDeudaUSD > 0.01 
                                                        ? `<strong style="color:#b45309;"><i class="fas fa-clock"></i> Pendiente por Pagar: $${totalUSD.toFixed(2)} USD</strong>`
                                                        : `<strong style="color:#16a34a;"><i class="fas fa-circle-check"></i> Totalmente Liquidado</strong>`
                                                      )
                                                    : `<strong style="color:#16a34a;"><i class="fas fa-check"></i> Pagado de Contado</strong>`
                                                }
                                            </span>
                                        </div>
                                    </div>

                                    <!-- 4. Botones de Acción -->
                                    <div class="tx-desglose-actions">
                                        ${(esCredito && saldoDeudaUSD > 0.01) ? `
                                            <button type="button" class="btn-desglose-pagar" onclick="abrirModalReportarPagoCliente({ referenciaCompra: '${v.id}', montoUSD: ${totalUSD} })">
                                                <i class="fas fa-credit-card"></i> Pagar / Abonar a esta Compra
                                            </button>
                                        ` : ''}
                                        <button type="button" class="btn-desglose-cerrar" onclick="toggleDesgloseVentaCliente('${v.id}')">
                                            <i class="fas fa-chevron-up"></i> Ocultar Desglose
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </section>

            <!-- Sección B: Mis Pagos y Abonos Registrados -->
            <section class="customer-section">
                <div class="customer-section-header">
                    <h3 class="customer-section-title">
                        <i class="fas fa-money-bill-wave" style="color:#16a34a;"></i>
                        <span>Mis Pagos y Abonos</span>
                    </h3>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="customer-section-badge">${todosAbonosCliente.length} abonos</span>
                        <button type="button" class="customer-section-action-btn" onclick="abrirModalReportarPagoCliente({ saldoUSD: ${saldoDeudaUSD}, saldoVES: ${saldoDeudaVES} })">
                            <i class="fas fa-plus"></i> Reportar
                        </button>
                    </div>
                </div>

                <div class="cards-list-wrapper">
                    ${todosAbonosCliente.length === 0 ? `
                        <div class="empty-cards-state">
                            <i class="fas fa-receipt"></i>
                            <p>Sin pagos reportados todavía. Presiona "Reportar" para registrar tu comprobante.</p>
                        </div>
                    ` : todosAbonosCliente.slice().reverse().map(a => {
                        const esPendiente = a.estado === 'PENDIENTE_CONFIRMACION';
                        const esRechazado = a.estado === 'RECHAZADO';
                        const tasaAbono = Number(a.tasaMomento || AppState.tasaActiva || AppState.tasaUSD_BCV || 0);

                        const { esDivisa, montoUSD: usdVal, montoVES: vesVal } = typeof sanitizarAbonoMonedas === 'function'
                            ? sanitizarAbonoMonedas(a, tasaAbono)
                            : { esDivisa: false, montoUSD: Number(a.montoUSD || 0), montoVES: Number(a.montoVES || 0) };

                        const montoPrincipal = esDivisa
                            ? `$${usdVal.toFixed(2)} USD`
                            : `Bs. ${formatVES(vesVal)}`;
                        const montoSecundario = esDivisa
                            ? (vesVal > 0 ? `Bs. ${formatVES(vesVal)}` : '')
                            : (usdVal > 0 ? `$${usdVal.toFixed(2)} USD` : '');

                        const metodoTxt = a.formaPago || a.metodo || 'Pago Móvil';

                        let statusClass = 'badge-approved';
                        let statusText = 'Aprobado';
                        let statusIcon = 'fa-check';

                        if (esPendiente) {
                            statusClass = 'badge-pending';
                            statusText = 'En Verificación';
                            statusIcon = 'fa-hourglass-half';
                        } else if (esRechazado) {
                            statusClass = 'badge-rejected';
                            statusText = 'Rechazado';
                            statusIcon = 'fa-times-circle';
                        }

                        return `
                            <div class="transaction-card">
                                <div class="tx-left">
                                    <div class="tx-icon-pill ${esDivisa ? 'tx-icon-pago' : 'tx-icon-ves'}">
                                        <i class="fas ${esDivisa ? 'fa-dollar-sign' : 'fa-mobile-screen'}"></i>
                                    </div>
                                    <div class="tx-details">
                                        <div class="tx-ref">
                                            <span>Ref: ${a.referencia || 'S/R'}</span>
                                            <span class="tx-type-tag">${metodoTxt}</span>
                                        </div>
                                        <span class="tx-desc">
                                            ${a.nota ? `Nota: ${a.nota}` : metodoTxt}
                                        </span>
                                        <span class="tx-date">
                                            <i class="far fa-calendar-alt"></i> ${a.fecha || 'Fecha N/A'}
                                        </span>
                                    </div>
                                </div>
                                <div class="tx-right">
                                    <span class="tx-amount" style="color:${esPendiente ? '#d97706' : (esRechazado ? '#dc2626' : '#16a34a')};">
                                        ${montoPrincipal}
                                    </span>
                                    ${montoSecundario ? `<span class="tx-amount-ves">${montoSecundario}</span>` : ''}
                                    <span class="tx-status-badge ${statusClass}">
                                        <i class="fas ${statusIcon}"></i>
                                        ${statusText}
                                    </span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </section>
        </div>
    `;
}

/**
 * Alterna el panel de desglose detallado de una compra ("¿Qué debo exactamente y por qué?")
 */
function toggleDesgloseVentaCliente(vId) {
    if (!vId) return;
    const panel = document.getElementById(`desglose-${vId}`);
    const card = document.getElementById(`tx-card-${vId}`);
    const chevron = document.getElementById(`chevron-${vId}`);
    if (!panel) return;

    const estaAbierto = panel.style.display !== 'none';
    if (estaAbierto) {
        panel.style.display = 'none';
        if (card) {
            card.classList.remove('tx-card-expanded');
            card.setAttribute('aria-expanded', 'false');
        }
        if (chevron) chevron.classList.remove('tx-chevron-rotated');
    } else {
        panel.style.display = 'block';
        if (card) {
            card.classList.add('tx-card-expanded');
            card.setAttribute('aria-expanded', 'true');
        }
        if (chevron) chevron.classList.add('tx-chevron-rotated');
    }
}
window.toggleDesgloseVentaCliente = toggleDesgloseVentaCliente;

/**
 * Descarga el historial completo de deuda y estado de cuenta del cliente en formato Excel (.xlsx)
 */
function descargarHistorialDeudaClienteExcel() {
    const usuario = window.AppState?.usuarioActual || (typeof obtenerUsuarioActual === 'function' ? obtenerUsuarioActual() : null);
    if (!usuario) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Sesión no encontrada', 'No se pudo identificar la sesión del cliente activo.', 'warning');
        } else {
            alert('No se pudo identificar la sesión del cliente activo.');
        }
        return;
    }

    if (typeof asegurarSincronizacionUsuariosAClientes === 'function') {
        asegurarSincronizacionUsuariosAClientes();
    }

    const estadoFin = typeof calcularEstadoFinancieroCliente === 'function'
        ? calcularEstadoFinancieroCliente(usuario)
        : null;

    const clienteObj = estadoFin?.clienteObj || usuario;
    const nombreCliente = String(clienteObj.nombre || usuario.nombre || 'Cliente').trim();
    const cedulaCliente = String(usuario.cedula || usuario.id || clienteObj.cedula || clienteObj.id || 'N/A').trim();
    const telefonoCliente = clienteObj.telefono || usuario.telefono || 'No registrado';
    const emailCliente = clienteObj.email || usuario.email || 'No registrado';

    const tasa = Number(window.AppState?.tasaActiva || window.AppState?.tasaUSD_BCV || 0);
    const metricas = calcularMetricasCompradoCliente(estadoFin, usuario, estadoFin?.ventasCliente || [], estadoFin?.abonosCliente || []);
    const { totalCompradoUSD, totalCompradoVES, totalAbonadoUSD, totalAbonadoVES, saldoDeudaUSD, saldoDeudaVES, esSolvente } = metricas;

    const ventas = (estadoFin?.ventasCliente || []).slice().sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
    const abonos = (window.AppState?.abonos || []).filter(a => {
        if (!a) return false;
        const aCId = String(a.clienteId || '').toUpperCase();
        const aCCed = String(a.clienteCedula || '').toUpperCase();
        const aUId = String(a.usuarioId || '').toUpperCase();
        const aNom = String(a.clienteNombre || '').toUpperCase();
        const uCed = String(cedulaCliente || '').toUpperCase();
        const uId = String(usuario.id || '').toUpperCase();
        const uNom = String(usuario.nombre || '').toUpperCase();
        const cId = clienteObj?.id ? String(clienteObj.id).toUpperCase() : '';
        return (cId && aCId === cId) || (uCed && (aCCed === uCed || aCId === uCed)) || (uId && aUId === uId) || (uNom && aNom === uNom);
    });

    if (window.InventoryApp?.ExcelExporter?.exportarEstadoCuentaClienteCompleto) {
        return window.InventoryApp.ExcelExporter.exportarEstadoCuentaClienteCompleto({
            cliente: clienteObj,
            usuario,
            ventas,
            abonos,
            estado: estadoFin,
            tasa
        });
    } else if (typeof window.exportarEstadoCuentaClienteCompleto === 'function') {
        return window.exportarEstadoCuentaClienteCompleto({
            cliente: clienteObj,
            usuario,
            ventas,
            abonos,
            estado: estadoFin,
            tasa
        });
    }

    const fechaHoy = new Date().toLocaleString('es-VE');
    const fechaISO = new Date().toISOString().slice(0, 10);
    const formatVESNum = (v) => Number(v || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Fallback a CSV compatible con Microsoft Excel
    descargarHistorialDeudaCSV(clienteObj, ventas, abonos, { saldoDeudaUSD, saldoDeudaVES, totalCompradoUSD, totalCompradoVES, totalAbonadoUSD, totalAbonadoVES, tasa, fechaHoy, fechaISO, formatVESNum });
}
window.descargarHistorialDeudaClienteExcel = descargarHistorialDeudaClienteExcel;

/**
 * Fallback de exportación en CSV con delimitador latinoamericano (;) y UTF-8 BOM
 */
function descargarHistorialDeudaCSV(cliente, ventas, abonos, datos) {
    const sep = ';';
    let csv = '\uFEFF';

    csv += `TU BODEGUITA DE CONFIANZA - ESTADO DE CUENTA E HISTORIAL DE DEUDA\n`;
    csv += `Fecha de Emisión:${sep}${datos.fechaHoy}\n`;
    csv += `Cliente:${sep}${cliente.nombre || 'Cliente'}\n`;
    csv += `Cédula / ID:${sep}${cliente.cedula || cliente.id || 'N/A'}\n`;
    csv += `Tasa Oficial BCV:${sep}Bs. ${datos.tasa.toFixed(2)}\n`;
    csv += `SALDO TOTAL DEUDA USD:${sep}$${datos.saldoDeudaUSD.toFixed(2)}\n`;
    csv += `SALDO TOTAL DEUDA VES:${sep}Bs. ${datos.formatVESNum(datos.saldoDeudaVES)}\n`;
    csv += `\n`;

    csv += `DESGLOSE DE COMPRAS Y DEUDAS\n`;
    csv += `N° Comprobante${sep}Fecha${sep}Tipo${sep}Motivo de la Deuda${sep}Artículos${sep}Total USD${sep}Total VES${sep}Estado\n`;

    ventas.forEach(v => {
        const totUSD = Number(v.total || 0);
        const tasaV = Number(v.tasa || datos.tasa || 1);
        const totVES = tasaV > 0 ? (totUSD * tasaV) : 0;
        const itemsDesc = (v.items || []).map(i => `${i.cantidad}x ${i.nombre}`).join(' | ') || 'Productos';
        let motivo = 'Compra a crédito en tienda sin pago inmediato';
        if (v.esCargoManual || (v.items && v.items.some(i => i.productoId === 'CARGO_MANUAL')) || String(v.id).startsWith('CARGO_')) {
            motivo = `Préstamo / Cargo: ${v.motivo || v.referencia || 'Préstamo de dinero en efectivo'}`;
        } else if (v.id && String(v.id).startsWith('V_FIADO_')) motivo = 'Saldo inicial transferido de libreta fiada';
        else if (v.origen === 'Kiosco' || String(v.id).startsWith('PED_')) motivo = 'Pedido a crédito Auto-servicio';
        else if (v.tipo === 'Contado') motivo = 'Compra pagada de contado';

        const estado = (v.tipo === 'Crédito') ? (datos.saldoDeudaUSD > 0.01 ? 'PENDIENTE' : 'LIQUIDADO') : 'CONTADO';
        csv += `"${v.id}"${sep}"${v.fecha || ''}"${sep}"${v.tipo || 'Crédito'}"${sep}"${motivo}"${sep}"${itemsDesc}"${sep}${totUSD.toFixed(2)}${sep}${totVES.toFixed(2)}${sep}"${estado}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = (cliente.nombre || 'Cliente').replace(/[^a-zA-Z0-9]/g, '_');
    link.href = url;
    link.setAttribute('download', `Historial_Deuda_${safeName}_${datos.fechaISO}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
window.descargarHistorialDeudaCSV = descargarHistorialDeudaCSV;

/**
 * Abre el Modal para que el Cliente reporte un Abono / Pago con selector dinámico de banco
 */
function abrirModalReportarPagoCliente(opciones = {}) {
    let modal = document.getElementById('modal-cliente-reportar-pago');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-cliente-reportar-pago';
        modal.className = 'modal';
        modal.onclick = function(e) { if (e.target === this) cerrarModalReportarPagoCliente(); };
        document.body.appendChild(modal);
    }

    const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 0);
    const cuentas = typeof obtenerCuentasBancariasActivas === 'function' ? obtenerCuentasBancariasActivas() : [];

    // 1. Obtener la deuda actual del cliente (en USD y en Bolívares con tasa BCV activa)
    const { saldoUSD, saldoVES } = obtenerDeudaActualCliente(opciones);
    window._modalAbonoSaldoUSD = saldoUSD;
    window._modalAbonoSaldoVES = saldoVES;

    const tieneDeuda = saldoUSD > 0.009;
    const formatVESNum = (v) => Number(v || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const montoInicial = (monedaAbonoSeleccionada === 'USD')
        ? (saldoUSD > 0.009 ? saldoUSD.toFixed(2) : '')
        : (saldoVES > 0.009 ? saldoVES.toFixed(2) : '');

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 540px; padding: 22px; animation: modalPop 0.25s ease-out;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid var(--border-light); padding-bottom:10px;">
                <h3 style="margin:0; font-size:1.15rem; color:var(--text-main); display:flex; align-items:center; gap:8px;">
                    <i class="fas fa-money-bill-transfer" style="color:var(--primary-accent);"></i> Reportar Abono a Cuenta
                </h3>
                <button type="button" class="btn-icon-tasa" onclick="cerrarModalReportarPagoCliente()"><i class="fas fa-times"></i></button>
            </div>

            <!-- Selector Dinámico de Banco o Método al que Transfirió/Pagó -->
            <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:12px; padding:12px 14px; margin-bottom:14px;">
                <label for="abono-cli-banco-selector" style="display:block; font-size:0.82rem; font-weight:700; color:#1e40af; margin-bottom:6px;">
                    <i class="fas fa-building-columns"></i> Selecciona la Cuenta o Destino del pago:
                </label>
                <select id="abono-cli-banco-selector" onchange="actualizarCoordenadasModalAbono(this.value)" style="width:100%; padding:9px 12px; border-radius:8px; border:1px solid #93c5fd; background:#ffffff; font-weight:700; color:#1e3a8a; cursor:pointer; font-size:0.88rem;">
                    ${cuentas.map(c => {
                        const banco = c.banco || c.bank || 'Banco';
                        const tipo = c.tipo || c.type || 'Pago Móvil';
                        return `<option value="${c.id}">${tipo}: ${banco}</option>`;
                    }).join('')}
                    <option value="efectivo_usd">💵 Efectivo Divisas ($ USD) en Tienda</option>
                    <option value="efectivo_ves">🇻🇪 Efectivo Bolívares (Bs. VES) en Tienda</option>
                </select>
            </div>

            <!-- Coordenadas Dinámicas del Banco o Método Seleccionado -->
            <div id="abono-coordenadas-card-dinamica" style="background:var(--bg-card); border:1px solid var(--border-light); border-radius:10px; padding:12px; margin-bottom:14px;">
                <!-- Rellenado dinámicamente por actualizarCoordenadasModalAbono() -->
            </div>

            <!-- 🏷️ TARJETA DESTACADA: MONTO QUE DEBEN (AUTO-CARGADO Y 100% EDITABLE) -->
            ${tieneDeuda ? `
                <div id="abono-modal-deuda-banner" style="background:#eff6ff; border:1.5px solid #93c5fd; border-radius:12px; padding:12px 14px; margin-bottom:14px; box-shadow:0 1px 3px rgba(37,99,235,0.08);">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                        <div>
                            <span style="font-size:0.75rem; text-transform:uppercase; font-weight:800; color:#1e40af; letter-spacing:0.5px; display:flex; align-items:center; gap:5px;">
                                <i class="fas fa-file-invoice-dollar" style="color:#2563eb;"></i> Tu Deuda Pendiente Actual:
                            </span>
                            <div style="display:flex; align-items:baseline; gap:8px; margin-top:2px;">
                                <strong id="abono-modal-deuda-principal" style="font-size:1.15rem; color:#1e3a8a; font-weight:800;">
                                    Bs. ${formatVESNum(saldoVES)}
                                </strong>
                                <span id="abono-modal-deuda-secundario" style="font-size:0.85rem; color:#475569; font-weight:700;">
                                    (≈ $${saldoUSD.toFixed(2)} USD)
                                </span>
                            </div>
                        </div>
                        <div style="display:flex; gap:6px;">
                            <button type="button" onclick="cargarMontoEnModalAbono(1.0)" style="background:#2563eb; color:#ffffff; border:none; border-radius:6px; padding:6px 12px; font-size:0.75rem; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:4px; box-shadow:0 1px 2px rgba(0,0,0,0.1);" title="Cargar el 100% de la deuda">
                                <i class="fas fa-check-circle"></i> Pagar Total
                            </button>
                            <button type="button" onclick="cargarMontoEnModalAbono(0.5)" style="background:#e0e7ff; color:#3730a3; border:none; border-radius:6px; padding:6px 10px; font-size:0.75rem; font-weight:700; cursor:pointer;" title="Abonar el 50% de la deuda">
                                50%
                            </button>
                        </div>
                    </div>
                    <div style="margin-top:8px; font-size:0.76rem; color:#1e40af; background:#dbeafe; padding:6px 10px; border-radius:6px; display:flex; align-items:center; gap:6px;">
                        <i class="fas fa-pen-to-square" style="color:#2563eb;"></i>
                        <span>El monto adeudado ya fue colocado en la casilla de abajo. <strong>Puedes editarlo libremente</strong> por si deseas abonar una cantidad menor.</span>
                    </div>
                </div>
            ` : `
                <div id="abono-modal-deuda-banner" style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:8px 12px; margin-bottom:12px; font-size:0.8rem; color:#15803d; display:flex; align-items:center; gap:6px;">
                    <i class="fas fa-circle-check" style="color:#16a34a;"></i>
                    <span>Actualmente estás <strong>Solvente / Al día ($0.00)</strong>. Ingresa el monto que desees abonar a favor.</span>
                </div>
            `}

            <form id="form-cliente-reportar-pago" onsubmit="event.preventDefault(); procesarReportePagoCliente();">
                <div class="form-group" style="margin-bottom:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                        <label id="abono-cli-monto-label" style="font-size:0.85rem; font-weight:700; color:var(--text-main); margin:0;">
                            Monto a Abonar en Bolívares (Bs. VES) <span style="color:var(--danger);">*</span>
                        </label>
                        <div style="display:inline-flex; border:1px solid #cbd5e1; border-radius:6px; overflow:hidden; font-size:0.75rem; font-weight:700;">
                            <button type="button" id="btn-abono-moneda-ves" onclick="seleccionarMonedaAbonoCliente('VES')" style="padding:3px 10px; border:none; background:#2563eb; color:#ffffff; cursor:pointer; transition:all 0.15s;">Bs. VES</button>
                            <button type="button" id="btn-abono-moneda-usd" onclick="seleccionarMonedaAbonoCliente('USD')" style="padding:3px 10px; border:none; background:#f1f5f9; color:#475569; cursor:pointer; transition:all 0.15s;">$ USD</button>
                        </div>
                    </div>
                    <input type="number" id="abono-cli-monto" step="0.01" min="0.01" class="form-control" placeholder="Ej: 1000.00" value="${montoInicial}" required oninput="calcularEquivalenteAbonoCliente(this.value)">
                    <small id="abono-cli-conversion-text" style="color:var(--text-muted); font-size:0.8rem; display:block; margin-top:4px;">
                        Equivalente en Divisas ($ USD): <strong id="abono-cli-conversion-preview" style="color:var(--primary-accent);">$0.00 USD</strong> (Tasa BCV: 1 USD = Bs. ${tasa > 0 ? tasa.toFixed(2) : '—'})
                    </small>
                    <div id="abono-cli-deuda-hint" style="display:none; margin-top:8px;"></div>
                </div>

                <div class="form-group" style="margin-bottom:12px;">
                    <label id="abono-cli-referencia-label" style="font-size:0.85rem; font-weight:600;">
                        Número de Referencia Bancaria / Pago Móvil <span id="abono-cli-referencia-req" style="color:var(--danger);">*</span>
                    </label>
                    <input type="text" id="abono-cli-referencia" class="form-control" placeholder="Últimos 6 u 8 dígitos del comprobante" required>
                </div>

                <div class="form-group" style="margin-bottom:16px;">
                    <label style="font-size:0.85rem; font-weight:600;">Nota u Observación (Opcional)</label>
                    <input type="text" id="abono-cli-nota" class="form-control" placeholder="Ej: Abono de cuenta semanal">
                </div>

                <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:10px; font-size:0.82rem; color:#1e40af; margin-bottom:16px;">
                    <i class="fas fa-info-circle"></i> Tu pago quedará registrado en estado <b>PENDIENTE DE CONFIRMACIÓN</b>. Al ser verificado por el Administrador, se descontará de tu deuda y sumará a tu récord de pagos puntuales.
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
    actualizarCoordenadasModalAbono();

    // 2. Si se suministró referencia de compra específica, precargar en la nota
    if (opciones && opciones.referenciaCompra) {
        const inputNota = document.getElementById('abono-cli-nota');
        if (inputNota) {
            inputNota.value = `Abono a compra #${opciones.referenciaCompra}`;
        }
    }

    // 3. Pre-cargar monto y calcular equivalente
    const inputMonto = document.getElementById('abono-cli-monto');
    if (inputMonto) {
        if (montoInicial && Number(montoInicial) > 0) {
            inputMonto.value = montoInicial;
            calcularEquivalenteAbonoCliente(inputMonto.value);
        } else {
            const montoPrecarga = (monedaAbonoSeleccionada === 'USD') ? saldoUSD : saldoVES;
            if (montoPrecarga > 0.009) {
                inputMonto.value = Number(montoPrecarga).toFixed(2);
                calcularEquivalenteAbonoCliente(inputMonto.value);
            }
        }
    }

    // 4. Mostrar hint interactivo si aplica
    actualizarHintDeudaModalAbono(opciones);
}

/**
 * Obtiene el saldo deudor actual del cliente tanto en Divisas ($ USD) como en Bolívares (Bs. VES)
 */
function obtenerDeudaActualCliente(opciones = {}) {
    const usuario = (opciones && opciones.usuario) || (typeof AppState !== 'undefined' ? AppState.usuarioActual : null);
    const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 0);

    let saldoUSD = 0;
    let saldoVES = 0;

    // 1. Opciones directas recibidas
    if (opciones) {
        if (typeof opciones.saldoUSD === 'number' && opciones.saldoUSD > 0) saldoUSD = opciones.saldoUSD;
        else if (typeof opciones.deudaUSD === 'number' && opciones.deudaUSD > 0) saldoUSD = opciones.deudaUSD;
        else if (typeof opciones.montoUSD === 'number' && opciones.montoUSD > 0) saldoUSD = opciones.montoUSD;
        else if (typeof opciones.totalUSD === 'number' && opciones.totalUSD > 0) saldoUSD = opciones.totalUSD;

        if (typeof opciones.saldoVES === 'number' && opciones.saldoVES > 0) saldoVES = opciones.saldoVES;
        else if (typeof opciones.deudaVES === 'number' && opciones.deudaVES > 0) saldoVES = opciones.deudaVES;
        else if (typeof opciones.montoVES === 'number' && opciones.montoVES > 0) saldoVES = opciones.montoVES;
    }

    // 2. Caché global reciente del cliente en ventana
    if (saldoUSD <= 0) {
        if (typeof window.ultimoSaldoDeudaUSD === 'number' && window.ultimoSaldoDeudaUSD > 0) {
            saldoUSD = window.ultimoSaldoDeudaUSD;
        } else if (typeof window._modalAbonoSaldoUSD === 'number' && window._modalAbonoSaldoUSD > 0) {
            saldoUSD = window._modalAbonoSaldoUSD;
        } else if (window.ultimoEstadoFinancieroCliente && typeof window.ultimoEstadoFinancieroCliente.saldoDeudaUSD === 'number' && window.ultimoEstadoFinancieroCliente.saldoDeudaUSD > 0) {
            saldoUSD = window.ultimoEstadoFinancieroCliente.saldoDeudaUSD;
        }
    }

    if (saldoVES <= 0) {
        if (typeof window.ultimoSaldoDeudaVES === 'number' && window.ultimoSaldoDeudaVES > 0) {
            saldoVES = window.ultimoSaldoDeudaVES;
        } else if (typeof window._modalAbonoSaldoVES === 'number' && window._modalAbonoSaldoVES > 0) {
            saldoVES = window._modalAbonoSaldoVES;
        } else if (window.ultimoEstadoFinancieroCliente && typeof window.ultimoEstadoFinancieroCliente.saldoDeudaVES === 'number' && window.ultimoEstadoFinancieroCliente.saldoDeudaVES > 0) {
            saldoVES = window.ultimoEstadoFinancieroCliente.saldoDeudaVES;
        }
    }

    // 3. Cálculo directo mediante calcularEstadoFinancieroCliente
    if (saldoUSD <= 0 && typeof calcularEstadoFinancieroCliente === 'function') {
        let estado = null;
        if (opciones && opciones.clienteId) {
            estado = calcularEstadoFinancieroCliente(opciones.clienteId);
        } else if (usuario) {
            estado = calcularEstadoFinancieroCliente(usuario);
            if ((!estado || estado.saldoDeudaUSD <= 0) && usuario.clienteId) {
                estado = calcularEstadoFinancieroCliente(usuario.clienteId);
            }
            if ((!estado || estado.saldoDeudaUSD <= 0) && usuario.cedula) {
                estado = calcularEstadoFinancieroCliente(usuario.cedula);
            }
        }

        if (estado && typeof estado.saldoDeudaUSD === 'number' && estado.saldoDeudaUSD > 0) {
            saldoUSD = Number(estado.saldoDeudaUSD);
            if (estado.saldoDeudaVES) saldoVES = Number(estado.saldoDeudaVES);
        }
    }

    // 4. Búsqueda directa en AppState.clientes y CLIENTES_OFICIALES
    if (saldoUSD <= 0 && usuario) {
        const uCed = String(usuario.cedula || usuario.id || '').trim().toUpperCase();
        const uCliId = String(usuario.clienteId || '').trim().toUpperCase();
        const uNom = String(usuario.nombre || '').trim().toUpperCase();

        const cli = (AppState.clientes || []).find(c => {
            if (!c) return false;
            const cId = String(c.id || '').trim().toUpperCase();
            const cCed = String(c.cedula || '').trim().toUpperCase();
            const cNom = String(c.nombre || '').trim().toUpperCase();
            return (uCliId && cId === uCliId) || (uCed && (cId === uCed || cCed === uCed)) || (uNom && cNom === uNom);
        });

        if (cli) {
            const d = Number(cli.deudaUSD || cli.deudaInicialUSD || 0);
            if (d > 0) saldoUSD = d;
        }

        if (saldoUSD <= 0 && typeof CLIENTES_OFICIALES !== 'undefined' && Array.isArray(CLIENTES_OFICIALES)) {
            const co = CLIENTES_OFICIALES.find(c => {
                const cId = String(c.id || '').trim().toUpperCase();
                const cNom = String(c.nombre || '').trim().toUpperCase();
                return (uCliId && cId === uCliId) || (uCed && cId === uCed) || (uNom && cNom === uNom);
            });
            if (co && Number(co.deudaUSD || 0) > 0) saldoUSD = Number(co.deudaUSD);
        }
    }

    // Conversión simétrica entre VES y USD con tasa BCV
    if (saldoVES <= 0 && saldoUSD > 0 && tasa > 0) {
        saldoVES = Number((saldoUSD * tasa).toFixed(2));
    } else if (saldoUSD <= 0 && saldoVES > 0 && tasa > 0) {
        saldoUSD = Number((saldoVES / tasa).toFixed(2));
    }

    return { saldoUSD, saldoVES, tasa };
}
window.obtenerDeudaActualCliente = obtenerDeudaActualCliente;

/**
 * Carga de forma inmediata el monto total o un porcentaje de la deuda en la casilla editable
 */
function cargarMontoEnModalAbono(factor = 1.0) {
    const inputEl = document.getElementById('abono-cli-monto');
    if (!inputEl) return;
    const { saldoUSD, saldoVES } = obtenerDeudaActualCliente();
    const esUSD = (monedaAbonoSeleccionada === 'USD');
    const base = esUSD ? saldoUSD : saldoVES;
    const valor = Number((base * factor).toFixed(2));
    if (valor > 0) {
        inputEl.value = valor.toFixed(2);
        calcularEquivalenteAbonoCliente(inputEl.value);
        inputEl.focus();
        inputEl.select();
    }
}
window.cargarMontoEnModalAbono = cargarMontoEnModalAbono;

/**
 * Muestra un aviso en el modal indicando que el monto de la deuda fue precargado automáticamente
 * y que puede ser editado si el cliente desea pagar una cantidad menor.
 */
function actualizarHintDeudaModalAbono(opciones = {}) {
    const hintEl = document.getElementById('abono-cli-deuda-hint');
    if (!hintEl) return;
    const { saldoUSD, saldoVES } = obtenerDeudaActualCliente(opciones);
    if (saldoVES > 0.01) {
        hintEl.style.display = 'block';
        const formatVESNum = (v) => Number(v || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const esUSD = (monedaAbonoSeleccionada === 'USD');
        const montoTexto = esUSD ? `$${saldoUSD.toFixed(2)} USD` : `Bs. ${formatVESNum(saldoVES)}`;
        hintEl.innerHTML = `
            <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:8px 12px; display:flex; justify-content:space-between; align-items:center; gap:8px;">
                <span style="font-size:0.78rem; color:#1e40af; line-height:1.4;">
                    <i class="fas fa-circle-check" style="color:#2563eb; margin-right:4px;"></i>
                    Monto adeudado (<strong>${montoTexto}</strong>) precargado. Puedes editarlo si vas a abonar menos.
                </span>
                <button type="button" onclick="cargarMontoEnModalAbono(1.0)" style="background:#2563eb; color:#ffffff; border:none; border-radius:6px; padding:4px 10px; font-size:0.73rem; font-weight:700; cursor:pointer; flex-shrink:0; transition:all 0.15s;" title="Restaurar monto total de la deuda">
                    Pagar Total
                </button>
            </div>
        `;
    } else {
        hintEl.style.display = 'none';
        hintEl.innerHTML = '';
    }
}
window.actualizarHintDeudaModalAbono = actualizarHintDeudaModalAbono;

/**
 * Restablece el valor del input al total adeudado completo
 */
function restablecerMontoDeudaTotalModalAbono() {
    cargarMontoEnModalAbono(1.0);
}
window.restablecerMontoDeudaTotalModalAbono = restablecerMontoDeudaTotalModalAbono;

let monedaAbonoSeleccionada = 'VES';

function seleccionarMonedaAbonoCliente(moneda = 'VES') {
    const monedaAnterior = monedaAbonoSeleccionada;
    monedaAbonoSeleccionada = moneda;
    const btnVES = document.getElementById('btn-abono-moneda-ves');
    const btnUSD = document.getElementById('btn-abono-moneda-usd');
    const labelEl = document.getElementById('abono-cli-monto-label');
    const inputEl = document.getElementById('abono-cli-monto');
    const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 0);

    if (btnVES && btnUSD) {
        if (moneda === 'USD') {
            btnUSD.style.background = '#16a34a';
            btnUSD.style.color = '#ffffff';
            btnVES.style.background = '#f1f5f9';
            btnVES.style.color = '#475569';
        } else {
            btnVES.style.background = '#2563eb';
            btnVES.style.color = '#ffffff';
            btnUSD.style.background = '#f1f5f9';
            btnUSD.style.color = '#475569';
        }
    }

    if (labelEl) {
        labelEl.innerHTML = moneda === 'USD'
            ? 'Monto a Abonar en Divisas ($ USD) <span style="color:var(--danger);">*</span>'
            : 'Monto a Abonar en Bolívares (Bs. VES) <span style="color:var(--danger);">*</span>';
    }

    if (inputEl) {
        inputEl.placeholder = moneda === 'USD' ? 'Ej: 20.00' : 'Ej: 1000.00';

        // Si el usuario cambia entre VES y USD y ya hay un valor ingresado, convertirlo proporcionalmente
        if (inputEl.value && tasa > 0 && monedaAnterior !== moneda) {
            const valNum = parseFloat(inputEl.value);
            if (!isNaN(valNum) && valNum > 0) {
                if (moneda === 'USD') {
                    // De VES a USD
                    inputEl.value = (valNum / tasa).toFixed(2);
                } else {
                    // De USD a VES
                    inputEl.value = (valNum * tasa).toFixed(2);
                }
            }
        } else if (!inputEl.value) {
            const { saldoUSD, saldoVES } = obtenerDeudaActualCliente();
            const autoMonto = (moneda === 'USD') ? saldoUSD : saldoVES;
            if (autoMonto > 0.009) {
                inputEl.value = autoMonto.toFixed(2);
            }
        }

        if (inputEl.value) {
            calcularEquivalenteAbonoCliente(inputEl.value);
        } else {
            const textEl = document.getElementById('abono-cli-conversion-text');
            if (textEl) {
                textEl.innerHTML = moneda === 'USD'
                    ? `Equivalente en Bolívares: <strong id="abono-cli-conversion-preview" style="color:#16a34a;">Bs. 0.00</strong> (Tasa BCV: 1 USD = Bs. ${tasa > 0 ? tasa.toFixed(2) : '—'})`
                    : `Equivalente en Divisas ($ USD): <strong id="abono-cli-conversion-preview" style="color:var(--primary-accent);">$0.00 USD</strong> (Tasa BCV: 1 USD = Bs. ${tasa > 0 ? tasa.toFixed(2) : '—'})`;
            }
        }
    }

    actualizarHintDeudaModalAbono();
}
window.seleccionarMonedaAbonoCliente = seleccionarMonedaAbonoCliente;

/**
 * Renderiza dinámicamente las coordenadas bancarias según el banco seleccionado en el modal de abonos
 */
function actualizarCoordenadasModalAbono(cuentaId = null) {
    const card = document.getElementById('abono-coordenadas-card-dinamica');
    if (!card) return;

    const select = document.getElementById('abono-cli-banco-selector');
    const targetId = cuentaId || (select ? select.value : '');
    const refReq = document.getElementById('abono-cli-referencia-req');
    const refInput = document.getElementById('abono-cli-referencia');

    // Manejo de pago en efectivo en tienda
    if (targetId === 'efectivo_usd' || targetId === 'efectivo_ves') {
        const esUSD = targetId === 'efectivo_usd';
        card.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px; padding:4px 2px;">
                <div style="width:38px; height:38px; border-radius:8px; background:${esUSD ? '#dcfce7' : '#fef3c7'}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                    <i class="fas fa-hand-holding-dollar" style="font-size:1.25rem; color:${esUSD ? '#15803d' : '#b45309'};"></i>
                </div>
                <div>
                    <strong style="color:var(--text-main); font-size:0.88rem; display:block;">
                        ${esUSD ? 'Efectivo Divisas ($ USD) - Pago en Tienda' : 'Efectivo Bolívares (Bs. VES) - Pago en Tienda'}
                    </strong>
                    <span style="font-size:0.75rem; color:var(--text-muted); display:block; margin-top:2px;">
                        Entrega personal en caja o mostrador. El encargado confirmará la recepción física de los billetes.
                    </span>
                </div>
            </div>
        `;

        if (refReq) refReq.style.display = 'none';
        if (refInput) {
            refInput.required = false;
            refInput.placeholder = 'Opcional (ej: Entregado en mostrador o N° de recibo)';
        }
        seleccionarMonedaAbonoCliente(esUSD ? 'USD' : 'VES');
        return;
    }

    const cuentas = typeof obtenerCuentasBancariasActivas === 'function' ? obtenerCuentasBancariasActivas() : [];
    const cuenta = cuentas.find(c => c.id === targetId) || cuentas[0];
    if (!cuenta) {
        card.innerHTML = `
            <div style="text-align:center; padding:12px; color:#b45309; background:#fffbeb; border:1px dashed #f59e0b; border-radius:8px; font-size:0.82rem;">
                <i class="fas fa-pause-circle" style="font-size:1.2rem; margin-bottom:4px; display:block;"></i>
                Las cuentas bancarias digitales se encuentran pausadas temporalmente.<br>
                Por favor selecciona <strong>Efectivo en Tienda</strong> arriba para registrar tu abono.
            </div>
        `;
        if (refReq) refReq.style.display = 'none';
        if (refInput) refInput.required = false;
        return;
    }

    const nombreBanco = cuenta.banco || cuenta.bank || 'Banco';
    const tipo = cuenta.tipo || cuenta.type || 'Pago Móvil';
    const tlf = cuenta.telefono || cuenta.phone || '';
    const rif = cuenta.cedulaRif || cuenta.idNumber || '';
    const numCuenta = cuenta.cuenta || cuenta.account || '';
    const titular = cuenta.titular || 'Tu Bodeguita de Confianza';
    const nota = cuenta.instrucciones || '';

    const esPM = tipo.toLowerCase().includes('móvil') || tipo.toLowerCase().includes('movil');
    const badgeBg = esPM ? '#e0f2fe' : (tipo.toLowerCase().includes('divisas') ? '#dcfce7' : '#fef3c7');
    const badgeColor = esPM ? '#0369a1' : (tipo.toLowerCase().includes('divisas') ? '#15803d' : '#b45309');

    card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:6px;">
            <div style="display:flex; align-items:center; gap:8px;">
                <strong style="color:#1e40af; font-size:0.9rem; display:flex; align-items:center; gap:6px;">
                    <i class="fas fa-building-columns"></i> ${nombreBanco}
                </strong>
                <span style="font-size:0.72rem; font-weight:800; padding:2px 8px; border-radius:9999px; background:${badgeBg}; color:${badgeColor};">${tipo}</span>
            </div>
            <button type="button" class="btn btn-sm btn-outline" style="font-size:0.75rem; padding:3px 8px;" onclick="copiarTodosDatosBanco('${cuenta.id}', this)">
                <i class="fas fa-copy"></i> Copiar Todo
            </button>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; font-size:0.82rem;">
            ${tlf ? `
            <div style="background:var(--bg-main); padding:6px 10px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <span style="color:var(--text-muted); display:block; font-size:0.72rem;">Teléfono Pago Móvil:</span>
                    <strong style="color:var(--text-main); font-size:0.82rem;">${tlf}</strong>
                </div>
                <button type="button" class="btn btn-sm" onclick="copiarDatoBancoCliente('${tlf}', this)" style="padding:2px 6px; font-size:0.7rem; background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe;">Copiar</button>
            </div>` : ''}

            ${rif ? `
            <div style="background:var(--bg-main); padding:6px 10px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <span style="color:var(--text-muted); display:block; font-size:0.72rem;">Cédula / RIF:</span>
                    <strong style="color:var(--text-main); font-size:0.82rem;">${rif}</strong>
                </div>
                <button type="button" class="btn btn-sm" onclick="copiarDatoBancoCliente('${rif}', this)" style="padding:2px 6px; font-size:0.7rem; background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe;">Copiar</button>
            </div>` : ''}

            ${numCuenta ? `
            <div style="background:var(--bg-main); padding:6px 10px; border-radius:6px; grid-column:span 2; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <span style="color:var(--text-muted); display:block; font-size:0.72rem;">Nº Cuenta (20 dígitos):</span>
                    <strong style="color:var(--text-main); font-size:0.76rem; letter-spacing:0.5px;">${numCuenta}</strong>
                </div>
                <button type="button" class="btn btn-sm" onclick="copiarDatoBancoCliente('${numCuenta}', this)" style="padding:2px 6px; font-size:0.7rem; background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe;">Copiar</button>
            </div>` : ''}

            <div style="background:var(--bg-main); padding:6px 10px; border-radius:6px; grid-column:span 2; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <span style="color:var(--text-muted); display:block; font-size:0.72rem;">Titular:</span>
                    <strong style="color:var(--text-main); font-size:0.8rem;">${titular}</strong>
                </div>
                <button type="button" class="btn btn-sm" onclick="copiarDatoBancoCliente('${titular}', this)" style="padding:2px 6px; font-size:0.7rem; background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe;">Copiar</button>
            </div>

            ${nota ? `
            <div style="grid-column:span 2; font-size:0.75rem; color:var(--text-muted); padding-top:2px;">
                <i class="fas fa-circle-info" style="color:var(--primary-accent);"></i> ${nota}
            </div>` : ''}
        </div>
    `;

    if (refReq) refReq.style.display = 'inline';
    if (refInput) {
        refInput.required = true;
        refInput.placeholder = 'Últimos 6 u 8 dígitos del comprobante';
    }

    const esCuentaDivisa = tipo.toLowerCase().includes('divisa') || tipo.toLowerCase().includes('usd') || tipo.toLowerCase().includes('zelle');
    seleccionarMonedaAbonoCliente(esCuentaDivisa ? 'USD' : 'VES');
}

function copiarDatosBancariosCompletos() {
    const select = document.getElementById('abono-cli-banco-selector');
    const cuentaId = select ? select.value : null;
    copiarTodosDatosBanco(cuentaId);
}

window.actualizarCoordenadasModalAbono = actualizarCoordenadasModalAbono;
window.copiarDatosBancariosCompletos = copiarDatosBancariosCompletos;

function calcularEquivalenteAbonoCliente(val) {
    const previewEl = document.getElementById('abono-cli-conversion-preview');
    if (!previewEl) return;
    const esDivisa = (monedaAbonoSeleccionada === 'USD');
    const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 0);
    const monto = parseFloat(val) || 0;

    if (esDivisa) {
        const montoVES = tasa > 0 ? (monto * tasa) : 0;
        previewEl.textContent = `Bs. ${montoVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
        const montoUSD = tasa > 0 ? (monto / tasa) : 0;
        previewEl.textContent = `$${montoUSD.toFixed(2)} USD`;
    }
}

/**
 * Re-popula el selector de bancos en el modal de abono si está abierto
 */
function poblarSelectorBancosModalAbono(cuentaIdPreferida = null) {
    const select = document.getElementById('abono-cli-banco-selector');
    if (!select) return;

    const cuentas = typeof obtenerCuentasBancariasActivas === 'function' ? obtenerCuentasBancariasActivas() : [];
    const valActual = cuentaIdPreferida || select.value;

    let optionsHtml = '';
    if (cuentas.length > 0) {
        optionsHtml += cuentas.map(c => {
            const banco = c.banco || c.bank || 'Banco';
            const tipo = c.tipo || c.type || 'Pago Móvil';
            return `<option value="${c.id}">${tipo}: ${banco}</option>`;
        }).join('');
    }
    optionsHtml += `
        <option value="efectivo_usd">💵 Efectivo Divisas ($ USD) en Tienda</option>
        <option value="efectivo_ves">🇻🇪 Efectivo Bolívares (Bs. VES) en Tienda</option>
    `;
    select.innerHTML = optionsHtml;

    const idsValidos = [...cuentas.map(c => c.id), 'efectivo_usd', 'efectivo_ves'];
    if (valActual && idsValidos.includes(valActual)) {
        select.value = valActual;
    } else if (cuentas.length > 0) {
        select.value = cuentas[0].id;
    } else {
        select.value = 'efectivo_usd';
    }

    actualizarCoordenadasModalAbono(select.value);
}
window.poblarSelectorBancosModalAbono = poblarSelectorBancosModalAbono;

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

    const montoIngresado = parseFloat(document.getElementById('abono-cli-monto')?.value);
    let referencia = document.getElementById('abono-cli-referencia')?.value.trim() || '';
    const nota = document.getElementById('abono-cli-nota')?.value.trim() || '';
    const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 0);

    const selectBanco = document.getElementById('abono-cli-banco-selector');
    const cuentaId = selectBanco ? selectBanco.value : '';

    let metodo = 'Pago Móvil VES';
    let bancoDestino = 'Banco';
    let cuentaDestinoId = '';
    let cuentaDestinoNumero = '';
    let cuentaDestinoTelefono = '';
    let cuentaSeleccionada = null;

    if (cuentaId === 'efectivo_usd') {
        metodo = 'Efectivo Divisas ($ USD)';
        bancoDestino = 'Tienda / Caja Física';
        if (!referencia) referencia = 'EFECTIVO-USD';
    } else if (cuentaId === 'efectivo_ves') {
        metodo = 'Efectivo Bolívares (Bs. VES)';
        bancoDestino = 'Tienda / Caja Física';
        if (!referencia) referencia = 'EFECTIVO-VES';
    } else {
        const cuentas = typeof obtenerCuentasBancariasActivas === 'function' ? obtenerCuentasBancariasActivas() : [];
        cuentaSeleccionada = cuentas.find(c => c.id === cuentaId) || cuentas[0] || null;
        if (cuentaSeleccionada) {
            bancoDestino = cuentaSeleccionada.banco || cuentaSeleccionada.bank || 'Banco';
            const tipo = cuentaSeleccionada.tipo || cuentaSeleccionada.type || 'Pago Móvil';
            metodo = `${tipo}: ${bancoDestino}`;
            cuentaDestinoId = cuentaSeleccionada.id || '';
            cuentaDestinoNumero = cuentaSeleccionada.cuenta || cuentaSeleccionada.account || '';
            cuentaDestinoTelefono = cuentaSeleccionada.telefono || cuentaSeleccionada.phone || '';
        }
    }

    if (isNaN(montoIngresado) || montoIngresado <= 0) {
        if (window.InventoryApp.Modal?.alert) {
            window.InventoryApp.Modal.alert('Monto Inválido', 'Por favor ingresa un monto válido a abonar.', 'warning');
        }
        return;
    }

    if (cuentaId !== 'efectivo_usd' && cuentaId !== 'efectivo_ves' && !referencia) {
        if (window.InventoryApp.Modal?.alert) {
            window.InventoryApp.Modal.alert('Referencia Requerida', 'Debes ingresar el número de referencia del comprobante bancario.', 'warning');
        }
        return;
    }

    const esDivisasUSD = (monedaAbonoSeleccionada === 'USD');

    // Calcular montos en Bolívares (VES) y Divisas ($ USD) según la moneda seleccionada
    let montoUSD = 0;
    let montoVES = 0;
    if (esDivisasUSD) {
        montoUSD = Number(montoIngresado.toFixed(2));
        montoVES = tasa > 0 ? Number((montoUSD * tasa).toFixed(2)) : 0;
    } else {
        montoVES = Number(montoIngresado.toFixed(2));
        montoUSD = tasa > 0 ? Number((montoVES / tasa).toFixed(2)) : 0;
    }

    const fechaHora = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const cliVinculado = (AppState.clientes || []).find(c => 
        (usuario.clienteId && String(c.id).toUpperCase() === String(usuario.clienteId).toUpperCase()) ||
        (c.cedula && String(c.cedula).toUpperCase() === String(usuario.cedula || usuario.id).toUpperCase()) ||
        (c.usuarioId && String(c.usuarioId).toUpperCase() === String(usuario.id).toUpperCase()) ||
        (usuario.nombre && c.nombre && String(c.nombre).trim().toUpperCase() === String(usuario.nombre).trim().toUpperCase())
    );

    const idCliFinal = cliVinculado ? cliVinculado.id : String(usuario.cedula || usuario.id || '').trim();
    const nomCliFinal = cliVinculado ? cliVinculado.nombre : String(usuario.nombre || usuario.cedula || 'Cliente').trim();
    const cedCliFinal = String(usuario.cedula || usuario.id || (cliVinculado ? cliVinculado.cedula : '')).trim();

    const nuevoAbono = {
        id: `ABN_${Date.now()}`,
        clienteId: idCliFinal,
        clienteNombre: nomCliFinal,
        clienteCedula: cedCliFinal,
        usuarioId: usuario.id || null,
        montoUSD: montoUSD,
        montoVES: montoVES,
        tasaMomento: tasa,
        formaPago: metodo,
        metodo: metodo,
        bancoDestino: bancoDestino,
        cuentaDestinoId: cuentaSeleccionada ? cuentaSeleccionada.id : '',
        cuentaDestinoNumero: cuentaSeleccionada ? (cuentaSeleccionada.cuenta || cuentaSeleccionada.account || '') : '',
        cuentaDestinoTelefono: cuentaSeleccionada ? (cuentaSeleccionada.telefono || cuentaSeleccionada.phone || '') : '',
        esDivisasUSD: esDivisasUSD,
        monedaOriginal: esDivisasUSD ? 'USD' : 'VES',
        referencia: String(referencia || '').trim(),
        nota: String(nota || '').trim(),
        fecha: fechaHora,
        estado: 'PENDIENTE_CONFIRMACION',
        registradoPor: 'CLIENTE'
    };

    AppState.abonos = AppState.abonos || [];
    const idxExistente = AppState.abonos.findIndex(a => a.id === nuevoAbono.id);
    if (idxExistente >= 0) {
        AppState.abonos[idxExistente] = nuevoAbono;
    } else {
        AppState.abonos.unshift(nuevoAbono);
    }

    cerrarModalReportarPagoCliente();

    // Persistir localmente
    if (window.InventoryApp.Persistence?.guardar) {
        window.InventoryApp.Persistence.guardar(true);
    }

    // Persistir en Firebase Cloud de manera directa
    if (window.InventoryApp?.Firebase?.guardarAbono) {
        try {
            await window.InventoryApp.Firebase.guardarAbono(nuevoAbono);
        } catch (err) {
            console.warn('[Firebase] Advertencia al sincronizar reporte de abono en Firestore:', err);
        }
    }

    // Registrar en PagosPorVerificar para la respectiva revisión del Administrador
    if (window.InventoryApp?.Firebase?.guardarPagoPorVerificar) {
        window.InventoryApp.Firebase.guardarPagoPorVerificar({
            id: nuevoAbono.id,
            pedidoId: nuevoAbono.id,
            abonoId: nuevoAbono.id,
            clienteId: nuevoAbono.clienteId,
            clienteNombre: nuevoAbono.clienteNombre || AppState.usuarioActual?.nombre || 'Cliente',
            clienteCedula: nuevoAbono.clienteCedula || nuevoAbono.clienteId,
            clienteTelefono: AppState.usuarioActual?.telefono || '',
            totalUSD: nuevoAbono.montoUSD,
            montoUSD: nuevoAbono.montoUSD,
            totalVES: nuevoAbono.montoVES,
            montoVES: nuevoAbono.montoVES,
            metodoPago: nuevoAbono.metodo,
            tipoPago: nuevoAbono.metodo,
            tipo: nuevoAbono.metodo,
            bancoDestino: bancoDestino,
            cuentaDestinoId: cuentaSeleccionada ? cuentaSeleccionada.id : '',
            esDivisasUSD: nuevoAbono.esDivisasUSD,
            monedaOriginal: nuevoAbono.monedaOriginal,
            referencia: nuevoAbono.referencia || 'N/A',
            fecha: nuevoAbono.fecha,
            fechaISO: new Date().toISOString(),
            estado: 'PENDIENTE_VERIFICACION',
            tipoRegistro: 'ABONO',
            nota: nuevoAbono.nota || '',
            origen: 'Reporte de Abono Cliente'
        }).catch(err => console.warn('[Firebase] Error al registrar abono en PagosPorVerificar:', err));
    }

    renderizarEstadoCuentaCliente();
    if (typeof renderizarAbonosPendientesReportados === 'function') {
        renderizarAbonosPendientesReportados();
    }
    if (typeof actualizarBadgesAbonos === 'function') {
        actualizarBadgesAbonos();
    }

    // Registrar en el Centro de Notificaciones
    if (typeof window.registrarNotificacion === 'function') {
        const nomCliente = nuevoAbono.clienteNombre || AppState.usuarioActual?.nombre || 'Cliente';
        const bsFmt = Number(nuevoAbono.montoVES || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 });
        const usdFmt = Number(nuevoAbono.montoUSD || 0).toFixed(2);
        const refStr = referencia ? ` - Ref: ${referencia}` : '';

        const mensajeNotif = esDivisasUSD
            ? `${nomCliente} agregó un pago en divisas de $${usdFmt} USD (${nuevoAbono.metodo}${refStr})`
            : `${nomCliente} agregó un pago de Bs. ${bsFmt} ($${usdFmt} USD) (${nuevoAbono.metodo}${refStr})`;

        window.registrarNotificacion({
            tipo: 'pago',
            titulo: 'Abono Reportado',
            mensaje: mensajeNotif,
            clienteId: nuevoAbono.clienteId,
            clienteNombre: nomCliente,
            montoUSD: Number(nuevoAbono.montoUSD || 0),
            montoVES: Number(nuevoAbono.montoVES || 0),
            referenciaId: nuevoAbono.id,
            destino: {
                tab: 'transacciones',
                subAccion: 'verPago',
                idRef: nuevoAbono.id,
                clienteId: nuevoAbono.clienteId
            }
        });

        if (nuevoAbono.nota && nuevoAbono.nota.trim()) {
            window.registrarNotificacion({
                tipo: 'comentario',
                titulo: 'Comentario en Abono',
                mensaje: `${nomCliente} dejó un comentario: "${nuevoAbono.nota}"`,
                clienteId: nuevoAbono.clienteId,
                clienteNombre: nomCliente,
                referenciaId: nuevoAbono.id,
                destino: {
                    tab: 'transacciones',
                    subAccion: 'verComentario',
                    idRef: nuevoAbono.id,
                    clienteId: nuevoAbono.clienteId,
                    textoComentario: nuevoAbono.nota
                }
            });
        }
    }

    if (window.InventoryApp.Modal?.toast) {
        const bsFmt = Number(nuevoAbono.montoVES || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 });
        const usdFmt = Number(nuevoAbono.montoUSD || 0).toFixed(2);
        const toastMsg = esDivisasUSD
            ? `✅ Tu abono en divisas de $${usdFmt} USD fue reportado con éxito (Ref: ${referencia}) y está en verificación.`
            : `✅ Tu abono de Bs. ${bsFmt} fue reportado con éxito (Ref: ${referencia}) y está en verificación.`;
        window.InventoryApp.Modal.toast(toastMsg, 'success');
    }
}

/**
 * Renderiza la vista de Mi Perfil & Ajustes del Cliente
 */
function renderizarPerfilCliente() {
    const container = document.getElementById('cliente-perfil-container');
    const usuario = AppState.usuarioActual;
    if (!container || !usuario) return;

    const rawAvatar = usuario.avatar || '';
    const avatarEsImagen = rawAvatar.startsWith('http') || rawAvatar.startsWith('data:image') || rawAvatar.startsWith('/api/');
    let avatarMarkup = '';
    if (avatarEsImagen) {
        const urlFinal = typeof normalizarUrlBlob === 'function' ? normalizarUrlBlob(rawAvatar) : rawAvatar;
        avatarMarkup = `<img src="${urlFinal}" alt="Avatar" style="width: 84px; height: 84px; border-radius: 50%; object-fit: cover; border: 3px solid var(--primary-accent); box-shadow: 0 4px 12px rgba(0,0,0,0.1);" onerror="alFallarAvatar(this, '${(usuario.nombre || 'U').substring(0, 2)}')">`;
    } else if (rawAvatar) {
        avatarMarkup = `<div style="width: 84px; height: 84px; border-radius: 50%; border: 3px solid var(--primary-accent); display: flex; align-items: center; justify-content: center; font-size: 2.6rem; background: var(--bg-card); box-shadow: 0 4px 12px rgba(0,0,0,0.1);">${rawAvatar}</div>`;
    } else {
        avatarMarkup = `<img src="${typeof generarSvgAvatar === 'function' ? generarSvgAvatar((usuario.nombre || 'U').substring(0, 2)) : ''}" alt="Avatar" style="width: 84px; height: 84px; border-radius: 50%; object-fit: cover; border: 3px solid var(--primary-accent); box-shadow: 0 4px 12px rgba(0,0,0,0.1);">`;
    }
    const puntos = typeof obtenerPuntosCliente === 'function' ? obtenerPuntosCliente(usuario.cedula || usuario.id) : (usuario.puntos || 0);

    container.innerHTML = `
        <div style="max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px;">
            <!-- Tarjeta de Identidad de Perfil -->
            <div class="card" style="background: linear-gradient(135deg, var(--bg-card), var(--bg-main)); border: 1px solid var(--border-light); padding: 24px; position: relative;">
                <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
                    <div style="position: relative; cursor: pointer;" onclick="abrirModalSelectorAvatar()" title="Haz clic para cambiar tu foto de perfil">
                        ${avatarMarkup}
                        <button type="button" class="btn btn-sm btn-primary" onclick="event.stopPropagation(); abrirModalSelectorAvatar();" style="position: absolute; bottom: 0; right: 0; border-radius: 50%; width: 28px; height: 28px; padding: 0; display: flex; align-items: center; justify-content: center;" title="Cambiar Avatar">
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

            <!-- Privacidad, Habeas Data y Términos de Servicio -->
            <div class="card" style="border-left: 4px solid #10b981;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
                    <h3 style="margin:0; font-size: 1.15rem; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-shield-halved" style="color: #10b981;"></i> Privacidad, Habeas Data & Transparencia IA
                    </h3>
                    <span style="font-size:0.75rem; background:rgba(16,185,129,0.12); color:#10b981; border:1px solid rgba(16,185,129,0.35); padding:3px 10px; border-radius:12px; font-weight:700;">
                        Tus Datos Están Protegidos
                    </span>
                </div>
                <p style="color: var(--text-muted); font-size: 0.86rem; margin-bottom: 14px; line-height:1.55;">
                    En <strong>Tu Bodeguita de Confianza</strong> tratamos tu información de contacto e historial únicamente para fines contables y de fidelización. Nunca comercializamos tus datos y garantizamos tu derecho de consulta, rectificación o eliminación.
                </p>
                <div style="display:flex; flex-wrap:wrap; gap:10px;">
                    <button type="button" class="btn btn-outline" onclick="abrirModalTerminosCondiciones()" style="font-weight:700; font-size:0.84rem; display:inline-flex; align-items:center; gap:6px;">
                        <i class="fas fa-file-contract" style="color:var(--primary-accent);"></i> Ver Términos y Política de Privacidad
                    </button>
                    <button type="button" class="btn btn-outline" onclick="solicitarHabeasDataWhatsApp('consulta')" style="font-weight:700; font-size:0.84rem; color:#16a34a; border-color:#86efac; display:inline-flex; align-items:center; gap:6px;">
                        <i class="fab fa-whatsapp"></i> Ejercer Derechos de Habeas Data
                    </button>
                </div>
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

    if (window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarUsuario === 'function') {
        window.InventoryApp.Firebase.guardarUsuario(usuario);
    }
    if (cInState && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarCliente === 'function') {
        window.InventoryApp.Firebase.guardarCliente(cInState);
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

    if (window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarUsuario === 'function') {
        window.InventoryApp.Firebase.guardarUsuario(usuario);
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
window.toggleDesgloseVentaCliente = toggleDesgloseVentaCliente;
window.descargarHistorialDeudaClienteExcel = descargarHistorialDeudaClienteExcel;
window.descargarHistorialDeudaCSV = descargarHistorialDeudaCSV;
window.abrirModalReportarPagoCliente = abrirModalReportarPagoCliente;
window.cerrarModalReportarPagoCliente = cerrarModalReportarPagoCliente;
window.procesarReportePagoCliente = procesarReportePagoCliente;
window.calcularEquivalenteAbonoCliente = calcularEquivalenteAbonoCliente;
window.copiarDatosBancariosCompletos = copiarDatosBancariosCompletos;
window.renderizarPerfilCliente = renderizarPerfilCliente;
window.guardarAjustesPerfilCliente = guardarAjustesPerfilCliente;
window.cambiarPasswordPerfilCliente = cambiarPasswordPerfilCliente;
