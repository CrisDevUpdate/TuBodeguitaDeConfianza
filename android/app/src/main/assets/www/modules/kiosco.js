/**
 * Módulo: Auto-Servicio de Confianza (Self-Checkout)
 * Sistema: Tu Bodeguita de Confianza
 * 
 * Permite a clientes realizar compras de forma autónoma, táctil y guiada.
 * Los pedidos se guardan con estado "PENDIENTE_CONFIRMACION" (sin descontar stock).
 * El administrador recibe alertas en tiempo real para aprobar/cobrar el pedido.
 */

(function() {
    'use strict';

    let carritoKiosco = [];
    let categoriaKioscoActiva = 'TODOS';
    let busquedaKiosco = '';
    let kioscoMostrarAgotados = false;
    let clienteKiosco = null; // { cedula, nombre, telefono, clienteObj, usuarioObj }
    let metodoModalidadKiosco = 'CREDITO'; // 'CREDITO' (por defecto) o 'CONTADO'
    let metodoPagoKiosco = 'PAGO_MOVIL'; // PAGO_MOVIL, EFECTIVO_USD, EFECTIVO_VES, PUNTO_VENTA
    let pasoKiosco = 1; // 1: Catálogo, 2: Identificación, 3: Pago, 4: Confirmación
    let timerRegresoInactividad = null;
    const TIEMPO_INACTIVIDAD_CONFIRMACION = 25000; // 25s para volver al inicio tras compra

    // Banco de sabiduría y frases motivacionales para el Auto-servicio de Confianza
    const BANCO_FRASES_AUTOSERVICIO = [
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

    /**
     * Retorna el saludo dinámico según la hora del día dirigido a todos los clientes
     */
    function obtenerSaludoGeneralSegunHora() {
        const ahora = new Date();
        const hora = ahora.getHours();
        const minutos = ahora.getMinutes();
        const tiempoDecimal = hora + (minutos / 60);

        if (tiempoDecimal >= 5.0 && tiempoDecimal < 12.0) {
            return {
                texto: '¡Buenos días!',
                mensaje: 'Te damos una cordial bienvenida a tu Auto-servicio de Confianza. Haz tu compra rápida, cómoda y sin esperas.',
                icono: '<i class="fas fa-sun" style="color:#fde047;"></i>'
            };
        } else if (tiempoDecimal >= 12.0 && tiempoDecimal < 19.0) {
            return {
                texto: '¡Buenas tardes!',
                mensaje: '¡Qué alegría tenerte aquí! Bienvenido a tu Auto-servicio de Confianza. Haz tu pedido a tu propio ritmo.',
                icono: '<i class="fas fa-cloud-sun" style="color:#fb923c;"></i>'
            };
        } else {
            return {
                texto: '¡Buenas noches!',
                mensaje: 'Es un verdadero placer atenderte en tu Auto-servicio de Confianza. Selecciona tus productos favoritos con total tranquilidad.',
                icono: '<i class="fas fa-moon" style="color:#93c5fd;"></i>'
            };
        }
    }

    /**
     * Consulta o actualiza la frase motivacional del Auto-servicio
     */
    async function actualizarFraseMotivacionalKiosco() {
        let fraseObj = null;
        try {
            const res = await fetch('/api/quotes/wisdom');
            if (res.ok) {
                const data = await res.json();
                if (data && data.frase) {
                    fraseObj = {
                        frase: data.frase,
                        autor: data.autor || 'Sabiduría Universal',
                        categoria: 'Inspiración'
                    };
                }
            }
        } catch {
            // fallback local
        }
        if (!fraseObj) {
            const idx = Math.floor(Math.random() * BANCO_FRASES_AUTOSERVICIO.length);
            fraseObj = BANCO_FRASES_AUTOSERVICIO[idx];
        }

        const elTexto = document.getElementById('kiosco-frase-texto');
        const elAutor = document.getElementById('kiosco-frase-autor');
        const elCat = document.getElementById('kiosco-frase-categoria');
        if (elTexto) elTexto.textContent = `"${fraseObj.frase}"`;
        if (elAutor) elAutor.textContent = `— ${fraseObj.autor}`;
        if (elCat) elCat.textContent = fraseObj.categoria;
    }

    /**
     * Inicializa el módulo de Auto-servicio de Confianza
     */
    function initKiosco() {
        const usuario = window.AppState?.usuarioActual;
        const rol = (usuario?.rol || '').toLowerCase();
        const esKiosco = rol === 'autoservicio' || rol === 'kiosco';
        const activeTab = document.querySelector('.view-content.active')?.id;

        if (esKiosco || activeTab === 'kiosco-view') {
            document.body.classList.add('modo-autoservicio');
            const mainHeader = document.querySelector('.bodeguita-main-header') || document.getElementById('bodeguita-main-header');
            if (mainHeader) mainHeader.style.setProperty('display', 'none', 'important');
            const mainNavTabs = document.getElementById('main-nav-tabs');
            if (mainNavTabs) mainNavTabs.style.setProperty('display', 'none', 'important');
        }

        renderizarHeaderKiosco();
        renderizarCategoriasKiosco();
        renderizarProductosKiosco();
        actualizarResumenCarritoKiosco();
    }

    /**
     * Renderiza o actualiza la cabecera visual de Auto-servicio (Tasa BCV, fecha, saludo por hora y frase motivacional)
     */
    function renderizarHeaderKiosco() {
        // 1. Tasa oficial
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

        // 2. Saludo general dinámico por hora sin nombre específico de usuario
        const saludo = obtenerSaludoGeneralSegunHora();
        const elIcono = document.getElementById('kiosco-saludo-icono');
        const elTexto = document.getElementById('kiosco-saludo-texto');
        if (elIcono) elIcono.innerHTML = saludo.icono;
        if (elTexto) elTexto.textContent = `${saludo.texto} ${saludo.mensaje}`;

        // 3. Frase motivacional
        actualizarFraseMotivacionalKiosco();
    }

    /**
     * Renderiza los chips de categorías para el catálogo táctil
     */
    function renderizarCategoriasKiosco() {
        const contenedor = document.getElementById('kiosco-categorias-chips');
        if (!contenedor) return;

        const productos = Array.isArray(window.AppState?.productos) ? window.AppState.productos : [];
        const totalAgotados = productos.filter(p => Number(p.stock || 0) <= 0).length;
        const totalCombos = productos.filter(p => Boolean(p.esCombo === true || String(p.nombre || '').toLowerCase().includes('combo') || String(p.categoria || '').toLowerCase().includes('combo'))).length;

        const categoriasSet = new Set(['TODOS']);
        productos.forEach(p => {
            if (p && p.categoria && String(p.categoria).trim()) {
                categoriasSet.add(String(p.categoria).trim());
            }
        });

        const iconoPorCategoria = (nombreCat) => {
            const c = String(nombreCat || '').toLowerCase();
            if (c === 'todos') return 'fa-th-large';
            if (c.includes('bebida') || c.includes('refresco') || c.includes('jugo')) return 'fa-wine-bottle';
            if (c.includes('dulce') || c.includes('caramelo')) return 'fa-candy-cane';
            if (c.includes('snack') || c.includes('chuchería') || c.includes('chucheria') || c.includes('papas')) return 'fa-cookie-bite';
            if (c.includes('galleta')) return 'fa-cookie';
            if (c.includes('chocolate')) return 'fa-cubes';
            if (c.includes('vívere') || c.includes('viveres') || c.includes('grano') || c.includes('harina')) return 'fa-wheat-awn';
            if (c.includes('lácteo') || c.includes('lacteo') || c.includes('queso')) return 'fa-cheese';
            return 'fa-tag';
        };

        const categorias = Array.from(categoriasSet);
        let html = categorias.map(cat => {
            const esActiva = (cat === categoriaKioscoActiva);
            const icono = iconoPorCategoria(cat);
            return `
                <button type="button" class="kiosco-cat-chip ${esActiva ? 'active' : ''}" 
                        onclick="window.KioscoModule.seleccionarCategoria('${cat.replace(/'/g, "\\'")}')">
                    <i class="fas ${icono}"></i>
                    <span>${cat}</span>
                </button>
            `;
        }).join('');

        if (totalCombos > 0 && !categoriasSet.has('Combos') && !categoriasSet.has('COMBOS')) {
            const esCombosActiva = (categoriaKioscoActiva === 'COMBOS');
            html += `
                <button type="button" class="kiosco-cat-chip ${esCombosActiva ? 'active' : ''}" 
                        onclick="window.KioscoModule.seleccionarCategoria('COMBOS')"
                        style="${esCombosActiva ? '' : 'color:#ea580c; border-color:rgba(249,115,22,0.4); background:rgba(234,88,12,0.08);'}">
                    <i class="fas fa-fire"></i>
                    <span>Combos (${totalCombos})</span>
                </button>
            `;
        }

        // Chip dedicado para productos agotados (igual que en el punto de venta)
        const isAgotadosActive = (categoriaKioscoActiva === 'AGOTADOS');
        html += `
            <button type="button" class="kiosco-cat-chip chip-filter-agotados ${isAgotadosActive ? 'active' : ''}" 
                    onclick="window.KioscoModule.seleccionarCategoria('AGOTADOS')"
                    style="${isAgotadosActive ? 'background: #ef4444 !important; border-color: #dc2626 !important; color: #ffffff !important; box-shadow: 0 2px 8px rgba(239,68,68,0.35); font-weight: 800;' : 'border-color: rgba(239, 68, 68, 0.45); color: #ef4444; background: rgba(239, 68, 68, 0.08); font-weight: 700;'}"
                    title="Ver productos actualmente agotados">
                <i class="fas fa-ban"></i>
                <span>🚫 Agotados (${totalAgotados})</span>
            </button>
        `;

        contenedor.innerHTML = html;
    }

    /**
     * Alterna la visibilidad de los productos agotados en el catálogo de Auto-servicio
     */
    function toggleMostrarAgotadosKiosco() {
        kioscoMostrarAgotados = !kioscoMostrarAgotados;
        renderizarCategoriasKiosco();
        renderizarProductosKiosco();
        if (typeof showCustomToast === 'function') {
            showCustomToast(kioscoMostrarAgotados ? 'Mostrando todos los productos (incluyendo agotados)' : 'Ocultando productos agotados', 'info');
        } else if (window.InventoryApp?.Modal?.toast) {
            window.InventoryApp.Modal.toast(kioscoMostrarAgotados ? 'Mostrando productos agotados' : 'Ocultando productos agotados', 'info');
        }
    }

    /**
     * Filtra y renderiza los productos en la cuadrícula táctil del Kiosco
     */
    function renderizarProductosKiosco() {
        const grid = document.getElementById('kiosco-productos-grid');
        if (!grid) return;

        const productos = Array.isArray(window.AppState?.productos) ? window.AppState.productos : [];
        const tasa = Number(window.AppState?.tasaActiva || window.AppState?.tasaUSD_BCV || 0);
        const totalAgotados = productos.filter(p => Number(p.stock || 0) <= 0).length;

        const filtrados = productos.filter(p => {
            if (!p) return false;
            const stock = Number(p.stock || 0);
            const esAgotado = stock <= 0;

            // Si la categoría seleccionada es AGOTADOS
            if (categoriaKioscoActiva === 'AGOTADOS') {
                if (!esAgotado) return false;
            } else {
                // Por defecto, productos agotados NO aparecen a menos que kioscoMostrarAgotados sea true
                if (esAgotado && !kioscoMostrarAgotados) return false;

                if (categoriaKioscoActiva !== 'TODOS') {
                    if (categoriaKioscoActiva === 'COMBOS') {
                        const esCombo = Boolean(p.esCombo === true || String(p.nombre || '').toLowerCase().includes('combo') || String(p.categoria || '').toLowerCase().includes('combo'));
                        if (!esCombo) return false;
                    } else {
                        const catProd = String(p.categoria || '').trim().toLowerCase();
                        if (catProd !== categoriaKioscoActiva.toLowerCase()) return false;
                    }
                }
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

        // Barra informativa y conmutador visual de agotados
        let metaEl = document.getElementById('kiosco-catalog-meta');
        if (!metaEl && grid.parentNode) {
            metaEl = document.createElement('div');
            metaEl.id = 'kiosco-catalog-meta';
            metaEl.style.cssText = 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; padding:8px 14px; margin-bottom:12px; background:var(--bg-card, #ffffff); border:1px solid var(--border-color, #e2e8f0); border-radius:10px; font-size:0.84rem;';
            grid.parentNode.insertBefore(metaEl, grid);
        }

        if (metaEl) {
            if (categoriaKioscoActiva === 'AGOTADOS') {
                metaEl.innerHTML = `
                    <span style="color:#ef4444; font-weight:700;">
                        <i class="fas fa-ban"></i> Viendo únicamente ${filtrados.length} ${filtrados.length === 1 ? 'producto agotado' : 'productos agotados'}
                    </span>
                    <button type="button" class="btn btn-sm btn-outline" onclick="window.KioscoModule.seleccionarCategoria('TODOS')" style="font-size:0.75rem; padding:4px 10px; border-radius:6px; font-weight:600;">
                        <i class="fas fa-arrow-left"></i> Ver Disponibles
                    </button>
                `;
            } else {
                let infoTxt = `<span><strong>${filtrados.length}</strong> ${filtrados.length === 1 ? 'producto disponible' : 'productos disponibles'}</span>`;
                if (totalAgotados > 0) {
                    if (kioscoMostrarAgotados) {
                        infoTxt += `
                            <span style="display:inline-flex; align-items:center; gap:8px;">
                                <span style="background:rgba(234,179,8,0.15); color:#ca8a04; border:1px solid rgba(234,179,8,0.3); border-radius:999px; padding:2px 8px; font-weight:700; font-size:0.74rem;">
                                    <i class="fas fa-eye"></i> Mostrando agotados
                                </span>
                                <button type="button" onclick="window.KioscoModule.toggleMostrarAgotados()" style="background:none; border:none; color:var(--primary-accent, #0284c7); text-decoration:underline; font-size:0.75rem; cursor:pointer; font-weight:600;">
                                    Ocultar agotados
                                </button>
                            </span>
                        `;
                    } else {
                        infoTxt += `
                            <span style="display:inline-flex; align-items:center; gap:8px;">
                                <span style="color:var(--text-muted, #94a3b8); font-size:0.76rem;">(${totalAgotados} agotado${totalAgotados === 1 ? '' : 's'} oculto${totalAgotados === 1 ? '' : 's'})</span>
                                <button type="button" onclick="window.KioscoModule.toggleMostrarAgotados()" style="background:none; border:none; color:var(--primary-accent, #0284c7); text-decoration:underline; font-size:0.75rem; cursor:pointer; font-weight:600;">
                                    Ver agotados
                                </button>
                            </span>
                        `;
                    }
                }
                metaEl.innerHTML = infoTxt;
            }
        }

        if (filtrados.length === 0) {
            if (categoriaKioscoActiva === 'AGOTADOS') {
                grid.innerHTML = `
                    <div class="kiosco-empty-products" style="grid-column: 1 / -1; padding: 40px 16px; text-align: center;">
                        <i class="fas fa-check-circle" style="font-size: 2.8rem; margin-bottom: 8px; color: #10b981;"></i>
                        <h3 style="font-weight: 700; margin: 4px 0; color: #10b981;">¡Excelente! No hay productos agotados</h3>
                        <p style="color: var(--text-muted, #64748b); font-size:0.9rem;">Todos los productos cuentan con existencias disponibles para la venta.</p>
                        <div style="margin-top: 14px;">
                            <button type="button" class="btn btn-sm btn-primary" onclick="window.KioscoModule.seleccionarCategoria('TODOS')" style="font-size: 0.85rem; padding: 8px 16px; border-radius: 8px;">
                                <i class="fas fa-arrow-left"></i> Volver a Disponibles
                            </button>
                        </div>
                    </div>
                `;
            } else {
                const agotadosCoincidentes = productos.filter(p => {
                    if (Number(p.stock || 0) > 0) return false;
                    if (!busquedaKiosco) return false;
                    const term = busquedaKiosco.toLowerCase().trim();
                    const nom = String(p.nombre || '').toLowerCase();
                    const cod = String(p.codigo || p.id || '').toLowerCase();
                    const cat = String(p.categoria || '').toLowerCase();
                    return nom.includes(term) || cod.includes(term) || cat.includes(term);
                });

                if (agotadosCoincidentes.length > 0) {
                    grid.innerHTML = `
                        <div style="grid-column: 1 / -1; padding: 36px 16px; text-align: center; background: rgba(239, 68, 68, 0.04); border: 1px dashed rgba(239, 68, 68, 0.35); border-radius: 12px;">
                            <i class="fas fa-ban" style="font-size: 2.4rem; margin-bottom: 8px; color: #ef4444;"></i>
                            <h3 style="font-weight: 700; margin: 4px 0; color: #ef4444;">${agotadosCoincidentes.length === 1 ? 'El producto coincide con un ítem agotado' : 'Los productos coincidentes están agotados'}</h3>
                            <p style="margin-bottom: 12px; color: var(--text-muted, #64748b); font-size:0.88rem;">No aparece en el catálogo porque su existencia es 0.</p>
                            <button type="button" class="btn btn-sm" onclick="window.KioscoModule.seleccionarCategoria('AGOTADOS')" style="background: #ef4444; color: #fff; font-weight: 700; border-radius: 8px; padding: 8px 16px; border: none; cursor: pointer;">
                                <i class="fas fa-eye"></i> Ver en Agotados (${agotadosCoincidentes.length})
                            </button>
                        </div>
                    `;
                } else {
                    grid.innerHTML = `
                        <div class="kiosco-empty-products" style="grid-column: 1 / -1;">
                            <i class="fas fa-box-open"></i>
                            <p>No se encontraron productos disponibles</p>
                            <small>Intenta con otra categoría o limpia el buscador</small>
                        </div>
                    `;
                }
            }
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
            const stockBadgeClass = agotado 
                ? 'badge-stock-tag stock-agotado' 
                : (stock <= 5 ? 'badge-stock-tag stock-low badge-stock-low' : 'badge-stock-tag stock-normal');

            return `
                <div class="kiosco-product-card cliente-prod-card pos-row-item ${agotado ? 'card-agotado' : ''} ${esCombo ? 'es-combo es-super-combo' : ''}" 
                     id="kiosco-card-${p.id}"
                     onclick="if (!event.target.closest('button') && !${agotado}) window.KioscoModule.agregarAlCarrito('${p.id}');"
                     style="${agotado ? '' : 'cursor: pointer;'}"
                     title="${agotado ? 'Producto agotado' : 'Toca para agregar a tu orden'}">
                    
                    <div class="kiosco-product-img-wrap cliente-prod-img-wrapper">
                        <img src="${imagenSrc}" alt="${p.nombre}" class="cliente-prod-img" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=60'">
                        ${agotado ? '<div class="kiosco-badge-agotado badge-agotado-pill">Agotado</div>' : ''}
                        ${esCombo ? '<div class="kiosco-badge-combo"><i class="fas fa-fire"></i> Combo</div>' : ''}
                        ${cantEnCarrito > 0 ? `<div class="kiosco-badge-en-carrito"><i class="fas fa-check"></i> ${cantEnCarrito} en orden</div>` : ''}
                    </div>

                    <div class="kiosco-product-info cliente-prod-body">
                        <div class="cliente-prod-meta">
                            <span class="cliente-prod-code">Cód: ${p.codigo || p.id}</span>
                            <span class="kiosco-product-category cliente-prod-badge-cat">${p.categoria || 'General'}</span>
                            <span class="${stockBadgeClass}" title="Existencia: ${stock} unidades">Stock: ${stock}</span>
                        </div>
                        <h3 class="kiosco-product-name cliente-prod-title" title="${p.nombre}">${p.nombre}</h3>
                        
                        <div class="kiosco-product-pricing cliente-prod-prices">
                            <span class="kiosco-price-usd price-usd">$${precioUSD.toFixed(2)}</span>
                            <span class="kiosco-price-ves price-ves">Bs. ${precioVES > 0 ? precioVES.toFixed(2) : '—'}</span>
                        </div>

                        <div class="kiosco-product-stock-tag ${stock <= 3 && !agotado ? 'stock-bajo' : ''}">
                            ${agotado ? 'Sin existencias' : (stock <= 5 ? `¡Solo quedan ${stock}!` : `Disponible: ${stock}`)}
                        </div>
                    </div>

                    <div class="kiosco-product-action cliente-prod-action">
                        <button type="button" class="kiosco-btn-add-touch cliente-btn-add ${agotado ? 'disabled' : ''}" ${agotado ? 'disabled' : ''} 
                                onclick="event.stopPropagation(); window.KioscoModule.agregarAlCarrito('${p.id}')"
                                title="${agotado ? 'Agotado' : (cantEnCarrito > 0 ? 'Agregar más' : 'Agregar')}">
                            <i class="fas ${cantEnCarrito > 0 ? 'fa-plus' : 'fa-cart-plus'}"></i>
                            <span class="kiosco-btn-text cliente-btn-text">${agotado ? 'Agotado' : (cantEnCarrito > 0 ? 'Agregar más' : 'Agregar')}</span>
                        </button>
                    </div>
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

        // Barra inferior flotante para pantallas táctiles verticales (solo visible si la vista de auto-servicio está activa)
        const barMobile = document.getElementById('kiosco-bottom-cart-bar');
        const kioscoView = document.getElementById('kiosco-view');
        const esKioscoVisible = document.body.classList.contains('modo-autoservicio') && kioscoView && kioscoView.classList.contains('active');
        if (barMobile) {
            barMobile.style.display = (esKioscoVisible && totalItems > 0) ? 'flex' : 'none';
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
     * Busca el cliente exclusivamente en la base de datos (AppState.clientes y AppState.usuarios)
     * al ingresar su cédula en el Kiosco. Muestra su nombre y solicita la clave de usuario.
     */
    function alEscribirCedulaKiosco(cedulaIngresada) {
        const clean = String(cedulaIngresada || '').trim().toUpperCase();
        const digitsOnly = clean.replace(/\D/g, '');
        const boxReconocido = document.getElementById('kiosco-cliente-reconocido-box');
        const boxNoEncontrado = document.getElementById('kiosco-cliente-no-encontrado-box');
        const grupoClave = document.getElementById('kiosco-grupo-clave-usuario');
        const displayNombre = document.getElementById('kiosco-cliente-nombre-display');
        const displayCedula = document.getElementById('kiosco-cliente-cedula-display');
        const btnAvanzar = document.getElementById('kiosco-btn-avanzar-pago');
        const inputClave = document.getElementById('kiosco-input-clave-usuario');
        const errorClave = document.getElementById('kiosco-clave-error-msg');

        if (errorClave) errorClave.style.display = 'none';

        if (clean.length < 3) {
            clienteKiosco = null;
            if (boxReconocido) boxReconocido.style.display = 'none';
            if (boxNoEncontrado) boxNoEncontrado.style.display = 'none';
            if (grupoClave) grupoClave.style.display = 'none';
            if (inputClave) inputClave.value = '';
            if (btnAvanzar) btnAvanzar.disabled = false;
            return;
        }

        const clientes = Array.isArray(window.AppState?.clientes) ? window.AppState.clientes : [];
        const usuarios = Array.isArray(window.AppState?.usuarios) ? window.AppState.usuarios : [];

        // Buscar en la base de datos de clientes
        let cli = clientes.find(c => {
            const cId = String(c.id || c.cedula || '').trim().toUpperCase();
            const cDig = cId.replace(/\D/g, '');
            return cId === clean || (digitsOnly.length >= 3 && cDig === digitsOnly);
        });

        // Buscar también en la lista de usuarios del sistema
        let usr = usuarios.find(u => {
            const uCed = String(u.cedula || u.id || '').trim().toUpperCase();
            const uDig = uCed.replace(/\D/g, '');
            return uCed === clean || (digitsOnly.length >= 3 && uDig === digitsOnly);
        });

        if (cli || usr) {
            const nombreCompleto = cli?.nombre || usr?.nombre || 'Cliente Registrado';
            const cedulaFinal = cli?.id || usr?.cedula || clean;
            const telefonoFinal = cli?.telefono || usr?.telefono || '';

            clienteKiosco = {
                cedula: cedulaFinal,
                nombre: nombreCompleto,
                telefono: telefonoFinal,
                clienteObj: cli,
                usuarioObj: usr
            };

            if (boxNoEncontrado) boxNoEncontrado.style.display = 'none';
            if (boxReconocido) {
                boxReconocido.style.display = 'flex';
                if (displayNombre) displayNombre.textContent = `¡Hola, ${nombreCompleto}!`;
                if (displayCedula) displayCedula.textContent = `Cédula: ${cedulaFinal}`;
            }
            if (grupoClave) {
                grupoClave.style.display = 'block';
            }
            if (btnAvanzar) btnAvanzar.disabled = false;
        } else {
            clienteKiosco = null;
            if (boxReconocido) boxReconocido.style.display = 'none';
            if (grupoClave) {
                grupoClave.style.display = 'none';
                if (inputClave) inputClave.value = '';
            }
            if (boxNoEncontrado) boxNoEncontrado.style.display = 'flex';
            if (btnAvanzar) btnAvanzar.disabled = true;
        }
    }

    /**
     * Alterna la visibilidad de la contraseña en el Kiosco
     */
    function toggleVerClaveUsuarioKiosco() {
        const inputClave = document.getElementById('kiosco-input-clave-usuario');
        const icono = document.getElementById('kiosco-icono-ver-clave');
        if (!inputClave) return;
        if (inputClave.type === 'password') {
            inputClave.type = 'text';
            if (icono) icono.className = 'fas fa-eye-slash';
        } else {
            inputClave.type = 'password';
            if (icono) icono.className = 'fas fa-eye';
        }
    }

    /**
     * Limpia el mensaje y estilo de error de contraseña
     */
    function limpiarErrorClaveKiosco() {
        const errorClave = document.getElementById('kiosco-clave-error-msg');
        const inputClave = document.getElementById('kiosco-input-clave-usuario');
        if (errorClave) errorClave.style.display = 'none';
        if (inputClave) inputClave.style.borderColor = '#cbd5e1';
    }

    /**
     * Valida la identificación del cliente y su contraseña de usuario antes de avanzar al Paso 3
     */
    function avanzarPasoPago() {
        const inputCedula = document.getElementById('kiosco-input-cedula');
        const inputClave = document.getElementById('kiosco-input-clave-usuario');
        const errorClave = document.getElementById('kiosco-clave-error-msg');

        if (!clienteKiosco) {
            const cedulaVal = String(inputCedula?.value || '').trim();
            if (!cedulaVal) {
                if (window.InventoryApp?.Modal?.toast) {
                    window.InventoryApp.Modal.toast('Por favor ingresa tu número de cédula.', 'warning');
                }
                inputCedula?.focus();
                return;
            }
            alEscribirCedulaKiosco(cedulaVal);
            if (!clienteKiosco) {
                if (window.InventoryApp?.Modal?.toast) {
                    window.InventoryApp.Modal.toast('Solo clientes registrados en nuestra base de datos pueden continuar.', 'error');
                }
                return;
            }
        }

        const claveIngresada = String(inputClave?.value || '').trim();
        if (!claveIngresada) {
            if (errorClave) {
                errorClave.innerHTML = '<i class="fas fa-circle-exclamation"></i> Ingresa tu clave de usuario para autorizar la compra.';
                errorClave.style.display = 'flex';
            }
            if (inputClave) {
                inputClave.style.borderColor = '#dc2626';
                inputClave.focus();
            }
            return;
        }

        // Buscar usuario en BD para validar su contraseña
        const usuarios = Array.isArray(window.AppState?.usuarios) ? window.AppState.usuarios : [];
        const cleanCed = String(clienteKiosco.cedula || '').replace(/\D/g, '');
        let usr = clienteKiosco.usuarioObj || usuarios.find(u => {
            const uCed = String(u.cedula || u.id || '').replace(/\D/g, '');
            return cleanCed && uCed === cleanCed;
        });

        // Verificación de la clave
        let claveValida = false;

        // Clave maestra de respaldo por seguridad operativa
        if (claveIngresada === '1409' || claveIngresada === 'admin1409') {
            claveValida = true;
        } else if (usr && usr.password) {
            if (typeof window.verificarPasswordHash === 'function') {
                claveValida = window.verificarPasswordHash(claveIngresada, usr.password);
            } else {
                claveValida = String(usr.password) === claveIngresada;
            }
        } else if (clienteKiosco.clienteObj && clienteKiosco.clienteObj.password) {
            if (typeof window.verificarPasswordHash === 'function') {
                claveValida = window.verificarPasswordHash(claveIngresada, clienteKiosco.clienteObj.password);
            } else {
                claveValida = String(clienteKiosco.clienteObj.password) === claveIngresada;
            }
        } else {
            // Si el cliente no tenía contraseña configurada en la BD, se autoriza con su cédula o sus últimos 4 dígitos
            const cedSoloDigitos = String(clienteKiosco.cedula).replace(/\D/g, '');
            const ultimos4 = cedSoloDigitos.slice(-4);
            if (claveIngresada === cedSoloDigitos || claveIngresada === ultimos4 || claveIngresada === '1234') {
                claveValida = true;
            }
        }

        if (!claveValida) {
            if (errorClave) {
                errorClave.innerHTML = '<i class="fas fa-circle-exclamation"></i> Clave de usuario incorrecta. Por favor verifica tu contraseña.';
                errorClave.style.display = 'flex';
            }
            if (inputClave) {
                inputClave.style.borderColor = '#dc2626';
                inputClave.select();
                inputClave.focus();
            }
            return;
        }

        // Clave validada correctamente
        limpiarErrorClaveKiosco();
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
                        <div class="kiosco-bank-row"><span>Pago Directo:</span> <strong>Puedes utilizar la modalidad a Crédito o cancelar en efectivo directo.</strong></div>
                    </div>
                `;
            }
        }

        // Por defecto: TODO A CRÉDITO
        seleccionarModalidadKiosco('CREDITO');
    }

    /**
     * Alterna la modalidad de pago entre TODO A CRÉDITO (por defecto) y AL CONTADO
     */
    function seleccionarModalidadKiosco(modalidad) {
        metodoModalidadKiosco = modalidad; // 'CREDITO' o 'CONTADO'

        const cardCredito = document.getElementById('kiosco-mode-card-credito');
        const cardContado = document.getElementById('kiosco-mode-card-contado');
        const panelCredito = document.getElementById('kiosco-panel-credito');
        const panelContado = document.getElementById('kiosco-panel-contado');
        const btnConfirmar = document.getElementById('kiosco-btn-confirmar-final');

        if (modalidad === 'CREDITO') {
            if (cardCredito) cardCredito.classList.add('active');
            if (cardContado) cardContado.classList.remove('active');
            if (panelCredito) panelCredito.style.display = 'block';
            if (panelContado) panelContado.style.display = 'none';
            if (btnConfirmar) {
                btnConfirmar.innerHTML = '<i class="fas fa-bag-shopping"></i> Confirmar y Retirar Productos';
                btnConfirmar.style.background = '#16a34a';
                btnConfirmar.style.borderColor = '#16a34a';
            }
        } else {
            // Modalidad CONTADO
            if (cardCredito) cardCredito.classList.remove('active');
            if (cardContado) cardContado.classList.add('active');
            if (panelCredito) panelCredito.style.display = 'none';
            if (panelContado) panelContado.style.display = 'block';
            if (btnConfirmar) {
                btnConfirmar.innerHTML = '<i class="fas fa-bag-shopping"></i> Confirmar y Retirar Productos';
                btnConfirmar.style.background = '#0284c7';
                btnConfirmar.style.borderColor = '#0284c7';
            }
            seleccionarMetodoPagoKiosco(metodoPagoKiosco);
        }
    }

    /**
     * Abre el modal tradicional de cobro al contado con el carrito y cliente del Kiosco
     */
    function abrirModalContadoSiempre() {
        if (!carritoKiosco.length) return;

        // 1. Sincronizar el carrito del POS con el carrito del Kiosco
        if (window.AppState) {
            window.AppState.carrito = carritoKiosco.map(it => ({ ...it }));
        }
        if (typeof window.carrito !== 'undefined') {
            window.carrito = carritoKiosco.map(it => ({ ...it }));
        }

        // 2. Sincronizar condición de pago al contado en POS
        const desktopCond = document.getElementById('pos-tipo-pago');
        const mobileCond = document.getElementById('pos-tipo-pago-mobile');
        if (desktopCond) desktopCond.value = 'Contado';
        if (mobileCond) mobileCond.value = 'Contado';
        if (typeof window.sincronizarCondicionPago === 'function') {
            window.sincronizarCondicionPago('pos-tipo-pago');
        }

        // 3. Sincronizar cliente en selectores de POS
        const clienteIdSelect = document.getElementById('pos-cliente-select') || document.getElementById('pos-cliente-select-mobile');
        if (clienteIdSelect && clienteKiosco) {
            let optionExists = Array.from(clienteIdSelect.options).some(o => o.value === clienteKiosco.cedula);
            if (!optionExists) {
                const opt = document.createElement('option');
                opt.value = clienteKiosco.cedula;
                opt.textContent = `${clienteKiosco.nombre} (${clienteKiosco.cedula})`;
                clienteIdSelect.appendChild(opt);
            }
            clienteIdSelect.value = clienteKiosco.cedula;
        }

        // 4. Actualizar vista de carrito POS si está disponible
        if (typeof window.renderizarCarrito === 'function') {
            window.renderizarCarrito();
        }

        // 5. Abrir el modal unificado de checkout de siempre
        if (typeof window.abrirModalCheckoutPOS === 'function') {
            window.abrirModalCheckoutPOS();
        }
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
     * Envía y asienta la compra de auto-servicio de confianza
     * El cliente retira los productos él mismo, por lo que el inventario se descuenta de inmediato
     * y la compra queda confirmada y cargada a su cuenta (a crédito) o registrada (al contado).
     */
    async function confirmarPedidoKiosco() {
        if (carritoKiosco.length === 0 || !clienteKiosco) return;

        const btnConfirmar = document.getElementById('kiosco-btn-confirmar-final');
        if (btnConfirmar) {
            btnConfirmar.disabled = true;
            btnConfirmar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Confirmando Compra...';
        }

        try {
            const tasa = Number(window.AppState?.tasaActiva || window.AppState?.tasaUSD_BCV || 0);
            let totalUSD = 0;
            carritoKiosco.forEach(it => totalUSD += (it.precio * it.cantidad));
            const totalVES = tasa > 0 ? (totalUSD * tasa) : 0;

            const inputRef = document.getElementById('kiosco-input-referencia');
            const referencia = String(inputRef?.value || '').trim() || (metodoPagoKiosco === 'PAGO_MOVIL' ? 'PAGO-MOVIL-AUTOSERVICIO' : 'EFECTIVO-DIRECTO');

            // Generar identificador de pedido único de Auto-servicio de Confianza
            const consecutivo = (window.AppState?.ventas?.length || 0) + 1;
            const pedidoId = `AUT_${consecutivo}_${Date.now().toString().slice(-4)}`;
            const fechaHora = new Date().toISOString().replace('T', ' ').substring(0, 16);

            const itemsPedido = carritoKiosco.map(item => ({
                productoId: item.productoId,
                nombre: item.nombre,
                cantidad: item.cantidad,
                precio: item.precio,
                costo: item.costo,
                subtotal: (item.precio * item.cantidad)
            }));

            // Validar stock disponible para todos los ítems antes de proceder
            for (const it of itemsPedido) {
                const prod = (window.AppState?.productos || []).find(p => String(p.id) === String(it.productoId));
                const stockDisp = Number(prod?.stock || 0);
                if (!prod || stockDisp < Number(it.cantidad || 0)) {
                    if (window.InventoryApp?.Modal?.alert) {
                        window.InventoryApp.Modal.alert(
                            'Stock Insuficiente',
                            `El producto "${it.nombre}" solo cuenta con ${stockDisp} unidades disponibles en inventario. Por favor ajusta la cantidad en tu compra.`,
                            'warning'
                        );
                    }
                    if (btnConfirmar) {
                        btnConfirmar.disabled = false;
                        btnConfirmar.innerHTML = '<i class="fas fa-bag-shopping"></i> Confirmar y Retirar Productos';
                    }
                    return;
                }
            }

            // 1. Guardar cliente en AppState si no existe aún
            if (Array.isArray(window.AppState?.clientes)) {
                const existeCli = window.AppState.clientes.find(c => String(c.id).toUpperCase() === clienteKiosco.cedula.toUpperCase());
                if (!existeCli) {
                    window.AppState.clientes.push({
                        id: clienteKiosco.cedula,
                        nombre: clienteKiosco.nombre,
                        telefono: clienteKiosco.telefono,
                        deudaUSD: 0,
                        email: ''
                    });
                }
            }

            // 2. Débito atómico de inventario (el cliente retira los productos él mismo)
            for (const it of itemsPedido) {
                if (window.InventoryApp?.StockService?.sale) {
                    window.InventoryApp.StockService.sale(it.productoId, it.cantidad);
                } else if (Array.isArray(window.AppState?.productos)) {
                    const prod = window.AppState.productos.find(p => String(p.id) === String(it.productoId));
                    if (prod) {
                        prod.stock = Math.max(0, Number(prod.stock || 0) - Number(it.cantidad || 0));
                    }
                }

                // Sincronizar stock actualizado del producto en Firestore en tiempo real
                const prodActualizado = (window.AppState?.productos || []).find(p => String(p.id) === String(it.productoId));
                if (prodActualizado && window.InventoryApp?.Firebase?.guardarProducto) {
                    window.InventoryApp.Firebase.guardarProducto(prodActualizado).catch(() => {});
                }
            }

            // 3. Crear registro de venta confirmada
            const esCredito = (metodoModalidadKiosco === 'CREDITO');
            const cedKiosco = String(clienteKiosco.cedula || '').trim();
            const nomKiosco = String(clienteKiosco.nombre || '').trim();

            const clienteExistente = (window.AppState?.clientes || []).find(c => {
                if (!c) return false;
                const cId = String(c.id || '').trim().toUpperCase();
                const cCed = String(c.cedula || '').trim().toUpperCase();
                const cNom = String(c.nombre || '').trim().toUpperCase();
                return (cedKiosco && (cId === cedKiosco.toUpperCase() || cCed === cedKiosco.toUpperCase())) ||
                       (nomKiosco && (cNom === nomKiosco.toUpperCase() || (nomKiosco.length >= 4 && (cNom.startsWith(nomKiosco.toUpperCase()) || nomKiosco.toUpperCase().startsWith(cNom)))));
            });

            const finalClienteId = clienteExistente ? clienteExistente.id : cedKiosco;
            const finalClienteNombre = clienteExistente ? clienteExistente.nombre : nomKiosco;

            const nuevaVentaKiosco = {
                id: pedidoId,
                clienteId: finalClienteId,
                clienteCedula: cedKiosco,
                clienteNombre: finalClienteNombre,
                clienteTelefono: clienteKiosco.telefono,
                usuarioId: clienteExistente?.usuarioId || null,
                vendedorId: 'AutoServicio',
                vendedorNombre: 'Auto-servicio de Confianza',
                fecha: fechaHora,
                items: itemsPedido,
                total: totalUSD,
                totalUSD: totalUSD,
                totalVES: totalVES,
                tipo: esCredito ? 'Crédito' : (metodoPagoKiosco === 'PAGO_MOVIL' ? 'Pago Móvil' : 'Efectivo'),
                tipoPago: esCredito ? 'Crédito' : (metodoPagoKiosco === 'PAGO_MOVIL' ? 'Pago Móvil' : 'Efectivo'),
                modalidad: metodoModalidadKiosco,
                referencia: esCredito ? 'Crédito Auto-servicio' : referencia,
                estado: 'CONFIRMADA',
                confirmada: true,
                descontadoInventario: true,
                esKiosco: true,
                origen: 'Auto-servicio de Confianza',
                nota: 'Compra confirmada en autoservicio. Productos retirados directamente por el cliente.'
            };

            if (!Array.isArray(window.AppState.ventas)) window.AppState.ventas = [];
            window.AppState.ventas.unshift(nuevaVentaKiosco);

            // 4. Si es Crédito, asentar el monto adeudado en la cuenta corriente del cliente
            if (esCredito) {
                if (clienteExistente) {
                    clienteExistente.deudaUSD = Number(clienteExistente.deudaUSD || 0) + totalUSD;
                    if (window.InventoryApp?.Firebase?.guardarCliente) {
                        window.InventoryApp.Firebase.guardarCliente(clienteExistente).catch(() => {});
                    }
                }
            }

            // 5. Sincronizar venta en Firebase Firestore
            if (window.InventoryApp?.Firebase?.registrarVenta) {
                window.InventoryApp.Firebase.registrarVenta(nuevaVentaKiosco, itemsPedido).catch(err => {
                    console.warn('[Kiosco] Error al guardar venta en Firestore:', err);
                });
            }

            // 6. Notificar al sistema
            if (typeof window.registrarNotificacion === 'function') {
                window.registrarNotificacion({
                    id: 'notif_kiosco_' + pedidoId,
                    tipo: esCredito ? 'credito' : 'pedido_kiosco',
                    titulo: esCredito ? 'Compra a Crédito (Auto-servicio)' : 'Compra en Auto-Servicio',
                    mensaje: `Cliente ${clienteKiosco.nombre} (${clienteKiosco.cedula}) realizó una compra ${esCredito ? 'a CRÉDITO' : 'al CONTADO'} por $${totalUSD.toFixed(2)} (${itemsPedido.length} productos) y retiró sus productos directamente.`,
                    clienteId: clienteKiosco.cedula,
                    clienteNombre: clienteKiosco.nombre,
                    montoUSD: totalUSD,
                    montoVES: totalVES,
                    referenciaId: pedidoId,
                    paraAdmin: true,
                    paraCliente: false,
                    destino: { tab: 'historial-ventas' }
                });
            }

            // 7. Refrescar vistas del sistema si aplican
            if (typeof renderizarPosProductos === 'function') renderizarPosProductos();
            if (typeof renderizarInventario === 'function') renderizarInventario();
            if (typeof renderizarClientes === 'function') renderizarClientes();
            if (typeof renderizarHistorialVentasAdmin === 'function') renderizarHistorialVentasAdmin();
            if (typeof actualizarBadgeVentasHoy === 'function') actualizarBadgeVentasHoy();

            // 8. Guardar en persistencia local
            if (window.InventoryApp?.Persistence?.guardar) {
                window.InventoryApp.Persistence.guardar(true);
            }

            // 9. Mostrar Pantalla de Confirmación y Ticket Visual (Paso 4)
            mostrarPantallaExitoKiosco(nuevaVentaKiosco);

        } catch (error) {
            console.error('[Kiosco] Error al procesar compra:', error);
            if (window.InventoryApp?.Modal?.alert) {
                window.InventoryApp.Modal.alert('Inconveniente al Procesar', 'Ocurrió un inconveniente al registrar la compra. Por favor verifica tus datos e inténtalo de nuevo.', 'warning');
            }
        } finally {
            if (btnConfirmar) {
                btnConfirmar.disabled = false;
                btnConfirmar.innerHTML = '<i class="fas fa-bag-shopping"></i> Confirmar y Retirar Productos';
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

        // Mostrar badge de modalidad en ticket
        const badgeModo = document.getElementById('kiosco-ticket-modalidad-badge');
        if (badgeModo) {
            if (venta.tipo === 'Crédito' || venta.modalidad === 'CREDITO') {
                badgeModo.style.background = '#dcfce7';
                badgeModo.style.color = '#15803d';
                badgeModo.style.borderColor = '#86efac';
                badgeModo.innerHTML = '<i class="fas fa-file-invoice-dollar"></i> Modalidad: Crédito (Cargado a tu Cuenta Corriente)';
            } else {
                badgeModo.style.background = '#f0f9ff';
                badgeModo.style.color = '#0369a1';
                badgeModo.style.borderColor = '#bae6fd';
                badgeModo.innerHTML = '<i class="fas fa-money-bill-wave"></i> Modalidad: Al Contado (Auto-pago Registrado)';
            }
        }

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
        const inClave = document.getElementById('kiosco-input-clave-usuario');
        const boxRec = document.getElementById('kiosco-cliente-reconocido-box');
        const boxNoRec = document.getElementById('kiosco-cliente-no-encontrado-box');
        const grpClave = document.getElementById('kiosco-grupo-clave-usuario');
        const errClave = document.getElementById('kiosco-error-clave-msg');

        if (inCed) inCed.value = '';
        if (inNom) inNom.value = '';
        if (inTel) inTel.value = '';
        if (inRef) inRef.value = '';
        if (inClave) inClave.value = '';
        if (boxRec) boxRec.style.display = 'none';
        if (boxNoRec) boxNoRec.style.display = 'none';
        if (grpClave) grpClave.style.display = 'none';
        if (errClave) errClave.style.display = 'none';

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
     * Salir del modo Auto-servicio de Confianza mediante modal CSS y clave protegida (1409)
     */
    function solicitarSalidaKiosco() {
        const modal = document.getElementById('modal-kiosco-exit-pin');
        const input = document.getElementById('kiosco-exit-pin-input');
        const errorEl = document.getElementById('kiosco-exit-pin-error');
        const eyeIcon = document.getElementById('kiosco-exit-eye-icon');

        if (errorEl) {
            errorEl.style.display = 'none';
            errorEl.textContent = '';
        }
        if (input) {
            input.value = '';
            input.type = 'password';
        }
        if (eyeIcon) {
            eyeIcon.className = 'fas fa-eye';
        }

        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => {
                if (input) input.focus();
            }, 80);
        }
    }

    /**
     * Cierra el modal CSS de salida de auto-servicio
     */
    function cerrarModalSalidaKiosco() {
        const modal = document.getElementById('modal-kiosco-exit-pin');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * Alterna la visibilidad del PIN en el modal CSS
     */
    function toggleVerPinKiosco() {
        const input = document.getElementById('kiosco-exit-pin-input');
        const eyeIcon = document.getElementById('kiosco-exit-eye-icon');
        if (!input) return;

        if (input.type === 'password') {
            input.type = 'text';
            if (eyeIcon) eyeIcon.className = 'fas fa-eye-slash';
        } else {
            input.type = 'password';
            if (eyeIcon) eyeIcon.className = 'fas fa-eye';
        }
    }

    /**
     * Confirma la salida del modo auto-servicio validando el PIN contra 1409
     */
    function confirmarSalidaPinKiosco() {
        const input = document.getElementById('kiosco-exit-pin-input');
        const errorEl = document.getElementById('kiosco-exit-pin-error');
        const cleanPin = String(input ? input.value : '').trim();

        const HASH_1409 = 'efe8564971192c24d29c7aedb7c5230aeaf13dbac7815bb7bd2206bdcc483350';
        let passValido = (cleanPin === '1409');

        if (!passValido && window.InventoryApp?.Helpers?.verificarPasswordHash) {
            passValido = window.InventoryApp.Helpers.verificarPasswordHash(cleanPin, HASH_1409);
        }

        if (passValido) {
            cerrarModalSalidaKiosco();
            cerrarModalWizardKiosco();
            document.body.classList.remove('modo-autoservicio');

            // Ocultar barra flotante de autoservicio y limpiar carrito
            const barMobile = document.getElementById('kiosco-bottom-cart-bar');
            if (barMobile) barMobile.style.display = 'none';
            carritoKiosco = [];
            actualizarResumenCarritoKiosco();

            const mainHeader = document.querySelector('.bodeguita-main-header') || document.getElementById('bodeguita-main-header');
            if (mainHeader) mainHeader.style.removeProperty('display');
            const mainNavTabs = document.getElementById('main-nav-tabs');
            if (mainNavTabs) mainNavTabs.style.removeProperty('display');

            if (window.InventoryApp?.Modal?.toast) {
                window.InventoryApp.Modal.toast('Sesión de Auto-servicio finalizada', 'info', 3000);
            }

            // Regresar a sesión admin o pos
            if (typeof window.volverASesionAdmin === 'function') {
                window.volverASesionAdmin();
            } else if (typeof window.cerrarSesionUsuario === 'function') {
                window.cerrarSesionUsuario();
            } else if (typeof switchTab === 'function') {
                switchTab('pos');
            }
        } else {
            if (errorEl) {
                errorEl.innerHTML = '<i class="fas fa-circle-exclamation"></i> Clave de seguridad incorrecta. Inténtalo de nuevo.';
                errorEl.style.display = 'flex';
            }
            if (input) {
                input.select();
                input.focus();
            }
        }
    }

    // Exponer API global
    window.solicitarSalidaKiosco = solicitarSalidaKiosco;
    window.cerrarModalSalidaKiosco = cerrarModalSalidaKiosco;
    window.toggleVerClaveUsuarioKiosco = toggleVerClaveUsuarioKiosco;
    window.limpiarErrorClaveKiosco = limpiarErrorClaveKiosco;
    window.seleccionarModalidadKiosco = seleccionarModalidadKiosco;
    window.abrirModalContadoSiempre = abrirModalContadoSiempre;
    window.toggleMostrarAgotadosKiosco = toggleMostrarAgotadosKiosco;

    window.KioscoModule = {
        init: initKiosco,
        actualizarVista: initKiosco,
        renderHeader: renderizarHeaderKiosco,
        renderCategorias: renderizarCategoriasKiosco,
        renderProductos: renderizarProductosKiosco,
        toggleMostrarAgotados: toggleMostrarAgotadosKiosco,
        agregarAlCarrito,
        modificarCantidad,
        vaciarCarrito,
        seleccionarCategoria,
        alBuscarProducto,
        iniciarCheckout: iniciarCheckoutKiosco,
        alEscribirCedula: alEscribirCedulaKiosco,
        toggleVerClaveUsuario: toggleVerClaveUsuarioKiosco,
        limpiarErrorClave: limpiarErrorClaveKiosco,
        avanzarPasoPago,
        seleccionarModalidad: seleccionarModalidadKiosco,
        abrirModalContadoSiempre: abrirModalContadoSiempre,
        mostrarPasoWizard,
        seleccionarMetodoPago: seleccionarMetodoPagoKiosco,
        confirmarPedido: confirmarPedidoKiosco,
        reiniciarKiosco: reiniciarKioscoManual,
        cerrarWizard: cerrarModalWizardKiosco,
        solicitarSalida: solicitarSalidaKiosco,
        cerrarModalSalida: cerrarModalSalidaKiosco,
        toggleVerPin: toggleVerPinKiosco,
        confirmarSalidaPin: confirmarSalidaPinKiosco
    };

})();
