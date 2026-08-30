/**
 * components/Catalog.js
 * Catálogo Fluido con Infinite Scroll, Priorización Inteligente de Productos
 * y Garantía de Códigos/IDs Estáticos Autoincrementales.
 * 
 * Principios:
 * 1. IDs y Códigos Estáticos: El ID o código interno de cada producto es inmutable
 *    y autoincremental. Nunca se re-indexa al eliminar ítems anteriores.
 * 2. Orden Inteligente: Prioriza productos con mayor volumen de ventas (total_sales)
 *    y mayor otorgamiento de puntos de fidelidad (points_given / puntosPromo).
 * 3. Infinite Scroll / Carga Progresiva: Carga productos en lotes (chunks) a medida
 *    que el usuario hace scroll, garantizando fluidez y rendimiento.
 */

window.InventoryApp = window.InventoryApp || {};

class CatalogManager {
    constructor() {
        this.chunkSize = 8;
        this.displayedCount = 8;
        this.currentFilterCategory = 'TODOS';
        this.currentSearch = '';
        this.observer = null;
        this.isLoadingMore = false;
    }

    /**
     * Calcula métricas de ventas históricas para cada producto
     */
    obtenerMetricasVentas() {
        const ventasMap = {};
        const todasVentas = AppState.ventas || [];

        todasVentas.forEach(v => {
            if (Array.isArray(v.items)) {
                v.items.forEach(item => {
                    const id = item.productoId || item.id;
                    if (id) {
                        ventasMap[id] = (ventasMap[id] || 0) + Number(item.cantidad || 1);
                    }
                });
            }
        });

        return ventasMap;
    }

    /**
     * Algoritmo de Priorización y Ordenamiento Inteligente de Catálogo
     * Orden:
     * 1. Productos con stock > 0 primero
     * 2. Mayor volumen de ventas (total_sales DESC)
     * 3. Mayor bono de puntos de fidelización (points_given / puntosPromo DESC)
     * 4. Fecha de creación reciente / Orden alfabético
     */
    obtenerProductosOrdenados(filtroCategoria = 'TODOS', busqueda = '') {
        const metricasVentas = this.obtenerMetricasVentas();
        let lista = [...(AppState.productos || [])];

        // 1. Filtrar por búsqueda si existe
        if (busqueda && busqueda.trim()) {
            const q = busqueda.trim().toLowerCase();
            lista = lista.filter(p => {
                const nombre = (p.nombre || '').toLowerCase();
                const codigo = (p.codigo || '').toLowerCase();
                const categoria = (p.categoria || '').toLowerCase();
                const descripcion = (p.descripcion || p.description || '').toLowerCase();
                const contenido = (p.contenido || p.medida || '').toLowerCase();
                return nombre.includes(q) || codigo.includes(q) || categoria.includes(q) || descripcion.includes(q) || contenido.includes(q);
            });
        }

        // 2. Filtrar por Categoría
        if (filtroCategoria && filtroCategoria !== 'TODOS') {
            lista = lista.filter(p => (p.categoria || '').toLowerCase() === filtroCategoria.toLowerCase());
        }

        // 3. Aplicar Algoritmo de Ranking y Priorización
        lista.sort((a, b) => {
            const stockA = Number(a.stock || 0);
            const stockB = Number(b.stock || 0);

            // Disponibilidad en inventario primero
            if (stockA > 0 && stockB <= 0) return -1;
            if (stockA <= 0 && stockB > 0) return 1;

            // Ventas históricas (total_sales)
            const salesA = metricasVentas[a.id] || Number(a.total_sales || 0);
            const salesB = metricasVentas[b.id] || Number(b.total_sales || 0);

            if (salesB !== salesA) {
                return salesB - salesA; // Mayor a menor ventas
            }

            // Puntos de fidelización otorgados
            const puntosA = Number(a.puntosPromo || a.points_given || Math.round(Number(a.precio || 0)));
            const puntosB = Number(b.puntosPromo || b.points_given || Math.round(Number(b.precio || 0)));

            if (puntosB !== puntosA) {
                return puntosB - puntosA; // Mayor a menor puntos
            }

            // Desempate por nombre
            return (a.nombre || '').localeCompare(b.nombre || '');
        });

        return lista;
    }

    /**
     * Inicializa el observador de Infinite Scroll
     */
    setupInfiniteScroll() {
        if (this.observer) {
            this.observer.disconnect();
        }

        const sentinel = document.getElementById('catalog-scroll-sentinel');
        if (!sentinel) return;

        this.observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !this.isLoadingMore) {
                this.cargarMasProductos();
            }
        }, { rootMargin: '200px' });

        this.observer.observe(sentinel);
    }

    /**
     * Carga el siguiente lote de productos progresivamente
     */
    cargarMasProductos() {
        const productosTotales = this.obtenerProductosOrdenados(this.currentFilterCategory, this.currentSearch);
        if (this.displayedCount >= productosTotales.length) {
            const sentinel = document.getElementById('catalog-scroll-sentinel');
            if (sentinel) sentinel.style.display = 'none';
            return;
        }

        this.isLoadingMore = true;
        const spinner = document.getElementById('catalog-loading-spinner');
        if (spinner) spinner.style.display = 'block';

        setTimeout(() => {
            this.displayedCount += this.chunkSize;
            this.renderGrid(false);
            this.isLoadingMore = false;
            if (spinner) spinner.style.display = 'none';
        }, 150);
    }

    /**
     * Renderiza el grid de productos con las tarjetas optimizadas
     */
    renderGrid(resetCount = true) {
        if (resetCount) {
            this.displayedCount = this.chunkSize;
        }

        const container = document.getElementById('cliente-catalogo-grid');
        if (!container) return;

        const productosOrdenados = this.obtenerProductosOrdenados(this.currentFilterCategory, this.currentSearch);
        const metricasVentas = this.obtenerMetricasVentas();

        if (productosOrdenados.length === 0) {
            container.innerHTML = `
                <div class="empty-state-catalog" style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; background: #ffffff; border-radius: 12px; border: 1px dashed var(--border);">
                    <div style="font-size: 3rem; color: var(--text-muted); margin-bottom: 12px;"><i class="fas fa-box-open"></i></div>
                    <h3 style="margin: 0 0 6px 0; color: var(--text-main);">No encontramos productos disponibles</h3>
                    <p style="margin: 0; color: var(--text-muted); font-size: 0.9rem;">Prueba con otra búsqueda o selecciona una categoría diferente.</p>
                    <button type="button" class="btn btn-primary" onclick="InventoryApp.Catalog.filtrarPorCategoria('TODOS')" style="margin-top: 15px;">
                        Ver todos los productos
                    </button>
                </div>
            `;
            const sentinel = document.getElementById('catalog-scroll-sentinel');
            if (sentinel) sentinel.style.display = 'none';
            return;
        }

        const productosAVisualizar = productosOrdenados.slice(0, this.displayedCount);
        const tasa = AppState.tasaActiva || 0;

        const temporadaActiva = AppState.premioMes?.temporadaActiva !== false;

        container.innerHTML = productosAVisualizar.map(p => {
            const stock = Number(p.stock || 0);
            const ventas = metricasVentas[p.id] || 0;
            const precioUSD = Number(p.precio || 0);
            const precioVES = tasa > 0 ? (precioUSD * tasa) : 0;
            const ptsPorDolar = Number(AppState.premioMes?.puntosPorDolar || 1);
            const puntosGanados = Math.max(1, Math.floor(precioUSD * ptsPorDolar));
            const esMasVendido = ventas >= 3;
            const esAgotado = stock <= 0;

            const imagenSrc = p.imagen || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';

            return `
                <div class="cliente-prod-card reveal-on-scroll ${esAgotado ? 'agotado' : ''}" id="prod-card-${p.id}">
                    <!-- Thumbnail con Badges Flotantes -->
                    <div class="cliente-prod-thumb-wrapper">
                        <img src="${imagenSrc}" alt="${p.nombre}" class="cliente-prod-thumb" loading="lazy" onerror="this.onerror=null; this.src='https://placehold.co/300x200?text=Producto';">
                        
                        <!-- Badges Superiores -->
                        <div class="cliente-prod-badges">
                            ${esMasVendido ? `
                                <span class="badge-tag badge-bestseller">
                                    <i class="fas fa-fire"></i> Más Vendido
                                </span>
                            ` : ''}
                            ${p.categoria ? `
                                <span class="badge-tag badge-cat">${p.categoria}</span>
                            ` : ''}
                        </div>

                        <!-- Indicador de Puntos (Solo si la temporada de incentivos está activa) -->
                        ${temporadaActiva ? `
                        <div class="cliente-prod-points-badge">
                            <i class="fas fa-star"></i> +${puntosGanados} pts
                        </div>
                        ` : ''}

                        ${esAgotado ? `
                            <div class="cliente-prod-agotado-overlay">
                                <span>Agotado</span>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Cuerpo de la Tarjeta -->
                    <div class="cliente-prod-body">
                        <!-- Código SKU Estático y Contenido -->
                        <div class="cliente-prod-meta">
                            <span class="cliente-prod-code">${p.codigo || p.id}</span>
                            ${p.contenido ? `<span class="cliente-prod-content">${p.contenido}</span>` : ''}
                        </div>

                        <h4 class="cliente-prod-title" title="${p.nombre}">${p.nombre}</h4>

                        ${p.descripcion ? `
                            <p class="cliente-prod-desc">${p.descripcion}</p>
                        ` : '<div style="height:12px;"></div>'}

                        <!-- Precios Bimoneda -->
                        <div class="cliente-prod-prices">
                            <div>
                                <div class="cliente-prod-price-usd">$${precioUSD.toFixed(2)}</div>
                                <div class="cliente-prod-price-ves">Bs. ${tasa > 0 ? precioVES.toFixed(2) : '—'}</div>
                            </div>
                            <div class="cliente-prod-stock-badge ${esAgotado ? 'sin-stock' : 'disponible'}">
                                ${!esAgotado ? '<i class="fas fa-check-circle" style="color:#16a34a;"></i> Disponible' : '<i class="fas fa-times-circle" style="color:#ef4444;"></i> Agotado'}
                            </div>
                        </div>

                        <!-- Botón de Agregar al Carrito -->
                        <button type="button" class="btn btn-add-client-cart ${esAgotado ? 'btn-disabled' : ''}" onclick="agregarAlCarritoCliente('${p.id}')" ${esAgotado ? 'disabled' : ''}>
                            <i class="fas fa-cart-plus"></i> ${esAgotado ? 'Agotado' : 'Agregar al Carrito'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Verificar si debe mostrarse el centinela de scroll
        let sentinel = document.getElementById('catalog-scroll-sentinel');
        if (!sentinel) {
            sentinel = document.createElement('div');
            sentinel.id = 'catalog-scroll-sentinel';
            sentinel.style.width = '100%';
            sentinel.style.height = '30px';
            sentinel.style.display = 'flex';
            sentinel.style.justifyContent = 'center';
            sentinel.style.alignItems = 'center';
            sentinel.innerHTML = `
                <div id="catalog-loading-spinner" style="display:none; color:var(--primary-accent); font-size:0.9rem;">
                    <i class="fas fa-spinner fa-spin"></i> Cargando más productos...
                </div>
            `;
            container.parentElement.appendChild(sentinel);
        }

        if (this.displayedCount >= productosOrdenados.length) {
            sentinel.style.display = 'none';
        } else {
            sentinel.style.display = 'flex';
            this.setupInfiniteScroll();
        }
    }

    /**
     * Filtra el catálogo por categoría y actualiza los botones interactivos
     */
    filtrarPorCategoria(cat) {
        this.currentFilterCategory = cat;
        
        // Actualizar chips de UI
        const buttons = document.querySelectorAll('#cliente-categorias-chips .chip-filter');
        buttons.forEach(btn => {
            if (btn.getAttribute('data-cat') === cat || (cat === 'TODOS' && btn.textContent.trim().toUpperCase() === 'TODOS')) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        this.renderGrid(true);
    }

    /**
     * Filtra el catálogo por texto de búsqueda
     */
    filtrarPorBusqueda(texto) {
        this.currentSearch = texto;
        this.renderGrid(true);
    }

    /**
     * Genera los chips dinámicos de categorías disponibles
     */
    renderizarChipsCategorias() {
        const container = document.getElementById('cliente-categorias-chips');
        if (!container) return;

        const categoriasSet = new Set();
        (AppState.productos || []).forEach(p => {
            if (p.categoria && p.categoria.trim()) {
                categoriasSet.add(p.categoria.trim());
            }
        });

        const categorias = Array.from(categoriasSet);

        container.innerHTML = `
            <button type="button" class="chip-filter ${this.currentFilterCategory === 'TODOS' ? 'active' : ''}" data-cat="TODOS" onclick="InventoryApp.Catalog.filtrarPorCategoria('TODOS')">
                <i class="fas fa-border-all"></i> Todos (${AppState.productos?.length || 0})
            </button>
            ${categorias.map(cat => `
                <button type="button" class="chip-filter ${this.currentFilterCategory.toLowerCase() === cat.toLowerCase() ? 'active' : ''}" data-cat="${cat}" onclick="InventoryApp.Catalog.filtrarPorCategoria('${cat}')">
                    ${cat}
                </button>
            `).join('')}
        `;
    }
}

// Instancia global
window.InventoryApp.Catalog = new CatalogManager();
