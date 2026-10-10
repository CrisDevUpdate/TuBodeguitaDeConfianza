// --- POS MULTIMONEDA & MOBILE-FIRST ARCHITECTURE ---
let posModoVista = localStorage.getItem('pos_modo_vista') || 'grid';
let posCategoriaActiva = 'TODOS';
let posMostrarAgotados = false;

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
    if (gridView) {
        if (modo === 'grid') {
            gridView.style.removeProperty('display');
        } else {
            gridView.style.setProperty('display', 'none', 'important');
        }
    }
    if (listView) {
        if (modo === 'list') {
            listView.style.setProperty('display', 'block', 'important');
        } else {
            listView.style.setProperty('display', 'none', 'important');
        }
    }

    renderizarPosProductos();
}

function seleccionarCategoriaPOS(cat) {
    posCategoriaActiva = cat || 'TODOS';
    actualizarChipsCategoriasPOS();
    renderizarPosProductos();
}

function toggleMostrarAgotadosPOS() {
    posMostrarAgotados = !posMostrarAgotados;
    actualizarChipsCategoriasPOS();
    renderizarPosProductos();
    if (typeof showCustomToast === 'function') {
        showCustomToast(posMostrarAgotados ? 'Mostrando todos los productos (incluyendo agotados)' : 'Ocultando productos agotados', 'info');
    }
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

/**
 * Habilita el desplazamiento horizontal interactivo (Drag-to-Scroll, Rueda del ratón y Touch)
 * Permite mantener el click y rodar a los lados sin barra de scroll visible.
 */
function inicializarScrollHorizontalInteractivo(container, leftBtnId = 'pos-cat-scroll-left', rightBtnId = 'pos-cat-scroll-right') {
    if (!container) return;

    if (!container.dataset.dragScrollInit) {
        container.dataset.dragScrollInit = 'true';

        let isDown = false;
        let startX = 0;
        let startScrollLeft = 0;
        let hasDragged = false;
        let lastX = 0;
        let lastTime = 0;
        let velocity = 0;

        // 1. ARRASTRE CON RATÓN (PC - "Mantengo el click y voy rodando a un lado")
        container.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // Solo click izquierdo
            isDown = true;
            hasDragged = false;
            startX = e.pageX - container.offsetLeft;
            startScrollLeft = container.scrollLeft;
            lastX = e.pageX;
            lastTime = Date.now();
            velocity = 0;
            container.classList.add('is-dragging');
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            const currentX = e.pageX - container.offsetLeft;
            const walk = currentX - startX;

            if (Math.abs(walk) > 4) {
                hasDragged = true;
                container.classList.add('is-actively-dragging');
                // Prevenir selección indeseada de texto al arrastrar
                e.preventDefault();
            }

            if (hasDragged) {
                const now = Date.now();
                const dt = now - lastTime || 1;
                velocity = (e.pageX - lastX) / dt;
                lastTime = now;
                lastX = e.pageX;

                // Desplazamiento fluido en tiempo real
                container.scrollLeft = startScrollLeft - (walk * 1.15);
                actualizarEstadoBotonesScroll(container, leftBtnId, rightBtnId);
            }
        });

        const terminarArrastre = () => {
            if (!isDown) return;
            isDown = false;
            container.classList.remove('is-dragging');

            if (hasDragged) {
                // Inercia suave al soltar el ratón
                if (Math.abs(velocity) > 0.15) {
                    let vel = velocity * 180;
                    let remaining = vel;
                    const deslizarConInercia = () => {
                        if (Math.abs(remaining) > 0.8) {
                            container.scrollLeft -= remaining * 0.1;
                            remaining *= 0.88;
                            actualizarEstadoBotonesScroll(container, leftBtnId, rightBtnId);
                            requestAnimationFrame(deslizarConInercia);
                        }
                    };
                    requestAnimationFrame(deslizarConInercia);
                }

                // Prevenir que el click accidental se ejecute en el botón sobre el cual se soltó el cursor
                const interceptarClickAccidental = (ev) => {
                    ev.stopPropagation();
                    ev.preventDefault();
                    window.removeEventListener('click', interceptarClickAccidental, true);
                };
                window.addEventListener('click', interceptarClickAccidental, true);
                setTimeout(() => {
                    window.removeEventListener('click', interceptarClickAccidental, true);
                    container.classList.remove('is-actively-dragging');
                    hasDragged = false;
                }, 70);
            } else {
                container.classList.remove('is-actively-dragging');
            }
        };

        window.addEventListener('mouseup', terminarArrastre);

        // 2. RUEDA DEL RATÓN EN PC (Traduce scroll vertical a horizontal sin barra)
        container.addEventListener('wheel', (e) => {
            if (Math.abs(e.deltaY) > 0 || Math.abs(e.deltaX) > 0) {
                e.preventDefault();
                const delta = Math.abs(e.deltaX) > 0 ? e.deltaX : e.deltaY;
                container.scrollLeft += delta * 0.95;
                actualizarEstadoBotonesScroll(container, leftBtnId, rightBtnId);
            }
        }, { passive: false });

        // 3. EVENTOS TOUCH EN MÓVIL (Soporte táctil optimizado y anti-clicks accidentales tras swipe)
        let touchStartX = 0;
        let touchHasDragged = false;

        container.addEventListener('touchstart', (e) => {
            if (e.touches && e.touches.length === 1) {
                touchStartX = e.touches[0].pageX - container.offsetLeft;
                touchHasDragged = false;
            }
        }, { passive: true });

        container.addEventListener('touchmove', (e) => {
            if (e.touches && e.touches.length === 1) {
                const currentTouchX = e.touches[0].pageX - container.offsetLeft;
                if (Math.abs(currentTouchX - touchStartX) > 6) {
                    touchHasDragged = true;
                }
            }
            actualizarEstadoBotonesScroll(container, leftBtnId, rightBtnId);
        }, { passive: true });

        container.addEventListener('touchend', () => {
            if (touchHasDragged) {
                const interceptarClickTouch = (ev) => {
                    ev.stopPropagation();
                    ev.preventDefault();
                    window.removeEventListener('click', interceptarClickTouch, true);
                };
                window.addEventListener('click', interceptarClickTouch, true);
                setTimeout(() => {
                    window.removeEventListener('click', interceptarClickTouch, true);
                    touchHasDragged = false;
                }, 70);
            }
            actualizarEstadoBotonesScroll(container, leftBtnId, rightBtnId);
        }, { passive: true });

        // 4. Sincronizar botones ante scroll nativo
        container.addEventListener('scroll', () => {
            actualizarEstadoBotonesScroll(container, leftBtnId, rightBtnId);
        }, { passive: true });
    }

    // Configurar botones de flecha laterales (‹ y ›)
    const btnLeft = document.getElementById(leftBtnId);
    const btnRight = document.getElementById(rightBtnId);

    if (btnLeft && !btnLeft.dataset.scrollBound) {
        btnLeft.dataset.scrollBound = 'true';
        btnLeft.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            container.scrollBy({ left: -240, behavior: 'smooth' });
        });
    }

    if (btnRight && !btnRight.dataset.scrollBound) {
        btnRight.dataset.scrollBound = 'true';
        btnRight.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            container.scrollBy({ left: 240, behavior: 'smooth' });
        });
    }

    // Actualizar visibilidad y estados de botones
    setTimeout(() => {
        actualizarEstadoBotonesScroll(container, leftBtnId, rightBtnId);
    }, 40);
}

/**
 * Actualiza la opacidad y visibilidad de los botones de navegación lateral del carrusel de categorías
 */
function actualizarEstadoBotonesScroll(container, leftBtnId, rightBtnId) {
    if (!container) return;
    const btnLeft = document.getElementById(leftBtnId);
    const btnRight = document.getElementById(rightBtnId);
    if (!btnLeft && !btnRight) return;

    const maxScroll = container.scrollWidth - container.clientWidth;
    const puedeScroll = maxScroll > 8;

    if (!puedeScroll) {
        if (btnLeft) btnLeft.style.display = 'none';
        if (btnRight) btnRight.style.display = 'none';
        return;
    }

    if (btnLeft) {
        btnLeft.style.display = 'inline-flex';
        const atStart = container.scrollLeft <= 4;
        btnLeft.style.opacity = atStart ? '0.25' : '1';
        btnLeft.style.pointerEvents = atStart ? 'none' : 'auto';
    }

    if (btnRight) {
        btnRight.style.display = 'inline-flex';
        const atEnd = container.scrollLeft >= (maxScroll - 4);
        btnRight.style.opacity = atEnd ? '0.25' : '1';
        btnRight.style.pointerEvents = atEnd ? 'none' : 'auto';
    }
}

// Exponer globalmente
window.inicializarScrollHorizontalInteractivo = inicializarScrollHorizontalInteractivo;
window.actualizarEstadoBotonesScroll = actualizarEstadoBotonesScroll;

// Sincronizar en cambios de tamaño de pantalla
window.addEventListener('resize', () => {
    const posCont = document.getElementById('pos-categories-chips');
    if (posCont) actualizarEstadoBotonesScroll(posCont, 'pos-cat-scroll-left', 'pos-cat-scroll-right');
    const cliCont = document.getElementById('cliente-categorias-chips');
    if (cliCont) actualizarEstadoBotonesScroll(cliCont, 'cliente-cat-scroll-left', 'cliente-cat-scroll-right');
});

function actualizarChipsCategoriasPOS() {
    const container = document.getElementById('pos-categories-chips');
    if (!container) return;

    const prods = Array.isArray(productos) ? productos : (AppState.productos || []);
    const categoriasSet = new Set();
    
    // Categorías base
    const baseBodega = ['Bebidas', 'Dulces', 'Snacks', 'Chucherías', 'Víveres'];
    baseBodega.forEach(c => categoriasSet.add(c));

    if (Array.isArray(AppState.categoriasPersonalizadas)) {
        AppState.categoriasPersonalizadas.forEach(c => {
            if (c && typeof c === 'string' && c.trim() && !c.toLowerCase().includes('combo')) {
                categoriasSet.add(c.trim());
            }
        });
    }

    prods.forEach(p => {
        if (p.categoria && typeof p.categoria === 'string' && p.categoria.trim()) {
            const cat = p.categoria.trim();
            if (!cat.toLowerCase().includes('combo') && !cat.toLowerCase().includes('general')) {
                categoriasSet.add(cat);
            }
        }
    });

    const categorias = Array.from(categoriasSet).sort();
    const totalCombos = prods.filter(p => (typeof esProductoCombo === 'function') ? esProductoCombo(p) : Boolean(p.esCombo === true || p.tipo === 'combo' || String(p.categoria || '').toLowerCase().includes('combo') || String(p.nombre || '').toLowerCase().includes('combo'))).length;
    const totalAgotados = prods.filter(p => Number(p.stock || 0) <= 0).length;
    const umbralBajo = typeof obtenerUmbralStockBajo === 'function' ? obtenerUmbralStockBajo() : 5;
    const totalStockBajo = prods.filter(p => {
        const s = Number(p.stock || 0);
        return s > 0 && s <= umbralBajo;
    }).length;

    const iconoPorCategoria = (nombreCat) => {
        const c = String(nombreCat || '').toLowerCase();
        if (c.includes('bebida') || c.includes('refresco') || c.includes('jugo')) return '🥤';
        if (c.includes('dulce') || c.includes('caramelo')) return '🍬';
        if (c.includes('snack') || c.includes('chuchería') || c.includes('chucheria') || c.includes('papas')) return '🍿';
        if (c.includes('galleta')) return '🍪';
        if (c.includes('chocolate')) return '🍫';
        if (c.includes('vívere') || c.includes('viveres') || c.includes('grano') || c.includes('harina')) return '🥫';
        if (c.includes('lácteo') || c.includes('lacteo') || c.includes('queso')) return '🧀';
        return '🏷️';
    };

    let html = `
        <button type="button" class="chip-filter ${posCategoriaActiva === 'TODOS' ? 'active' : ''}" 
                onclick="seleccionarCategoriaPOS('TODOS')">
            🌟 Todos
        </button>
    `;

    // Chip dedicado para productos con Stock Bajo (Amarillo)
    const isStockBajoActive = posCategoriaActiva === 'STOCK_BAJO';
    html += `
        <button type="button" class="chip-filter chip-filter-stock-bajo ${isStockBajoActive ? 'active' : ''}" 
                onclick="seleccionarCategoriaPOS('STOCK_BAJO')"
                style="${isStockBajoActive 
                    ? 'background: #f59e0b !important; border-color: #d97706 !important; color: #ffffff !important; box-shadow: 0 2px 8px rgba(245,158,11,0.35); font-weight: 800;' 
                    : 'border-color: rgba(245, 158, 11, 0.45); color: #d97706; background: rgba(245, 158, 11, 0.08); font-weight: 700;'}"
                title="Filtrar productos con existencia &le; ${umbralBajo}">
            ⚠️ Stock &le; ${umbralBajo} (${totalStockBajo})
        </button>
    `;

    if (totalCombos > 0) {
        html += `
            <button type="button" class="chip-filter ${posCategoriaActiva === 'COMBOS' ? 'active' : ''}" 
                    onclick="seleccionarCategoriaPOS('COMBOS')" 
                    style="background: linear-gradient(135deg, rgba(234,88,12,0.18), rgba(245,158,11,0.22)); border-color: rgba(249,115,22,0.45); color: #ea580c; font-weight: 800;">
                🔥 Combos (${totalCombos})
            </button>
        `;
    }

    categorias.forEach(cat => {
        const isActive = posCategoriaActiva.toLowerCase() === cat.toLowerCase();
        html += `
            <button type="button" class="chip-filter ${isActive ? 'active' : ''}" 
                    onclick="seleccionarCategoriaPOS('${cat.replace(/'/g, "\\'")}')">
                ${iconoPorCategoria(cat)} ${cat}
            </button>
        `;
    });

    // Chip dedicado para productos agotados (tal como "Bebidas", "Chocolates", etc.)
    const isAgotadosActive = posCategoriaActiva === 'AGOTADOS';
    html += `
        <button type="button" class="chip-filter chip-filter-agotados ${isAgotadosActive ? 'active' : ''}" 
                onclick="seleccionarCategoriaPOS('AGOTADOS')"
                style="${isAgotadosActive ? 'background: #ef4444 !important; border-color: #dc2626 !important; color: #ffffff !important; box-shadow: 0 2px 8px rgba(239,68,68,0.35); font-weight: 800;' : 'border-color: rgba(239, 68, 68, 0.45); color: #ef4444; background: rgba(239, 68, 68, 0.08); font-weight: 700;'}"
                title="Ver productos actualmente agotados">
            🚫 Agotados (${totalAgotados})
        </button>
    `;

    container.innerHTML = html;

    // Activar soporte interactivo de arrastre, rueda y controles
    inicializarScrollHorizontalInteractivo(container, 'pos-cat-scroll-left', 'pos-cat-scroll-right');

    // Desplazar suavemente hacia la categoría activa si está fuera de vista
    const activeChip = container.querySelector('.chip-filter.active');
    if (activeChip) {
        try {
            activeChip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        } catch {}
    }
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
    const totalAgotados = prods.filter(p => Number(p.stock || 0) <= 0).length;

    const filtrados = prods.filter(p => {
        const stock = Number(p.stock || 0);
        const esAgotado = stock <= 0;

        // Si la categoría seleccionada es AGOTADOS
        if (posCategoriaActiva === 'AGOTADOS') {
            if (!esAgotado) return false;
        } else if (posCategoriaActiva === 'STOCK_BAJO') {
            const umbralBajo = typeof obtenerUmbralStockBajo === 'function' ? obtenerUmbralStockBajo() : 5;
            if (stock <= 0 || stock > umbralBajo) return false;
        } else {
            // Por defecto, productos agotados NO aparecen a menos que posMostrarAgotados sea true
            if (esAgotado && !posMostrarAgotados) return false;

            if (posCategoriaActiva !== 'TODOS') {
                if (posCategoriaActiva === 'COMBOS') {
                    const esCombo = (typeof esProductoCombo === 'function') ? esProductoCombo(p) : Boolean(p.esCombo === true || p.tipo === 'combo' || String(p.categoria || '').toLowerCase().includes('combo') || String(p.nombre || '').toLowerCase().includes('combo'));
                    if (!esCombo) return false;
                } else {
                    const catProd = (p.categoria || '').trim().toLowerCase();
                    if (catProd !== posCategoriaActiva.toLowerCase()) return false;
                }
            }
        }

        if (!f) return true;
        const nombre = (p.nombre || "").toLowerCase();
        const codigo = (p.codigo || "").toLowerCase();
        const cat = (p.categoria || "").toLowerCase();
        return nombre.includes(f) || codigo.includes(f) || cat.includes(f);
    });

    const countEl = document.getElementById('pos-catalog-count');
    if (countEl) {
        if (posCategoriaActiva === 'AGOTADOS') {
            countEl.innerHTML = `<span style="color:#ef4444; font-weight:700;"><i class="fas fa-ban"></i> ${filtrados.length} ${filtrados.length === 1 ? 'producto agotado' : 'productos agotados'}</span>`;
        } else if (posCategoriaActiva === 'STOCK_BAJO') {
            const umbralBajo = typeof obtenerUmbralStockBajo === 'function' ? obtenerUmbralStockBajo() : 5;
            countEl.innerHTML = `<span style="color:#d97706; font-weight:700;"><i class="fas fa-triangle-exclamation"></i> ${filtrados.length} con stock bajo (&le; ${umbralBajo})</span>`;
        } else {
            let txt = `${filtrados.length} ${filtrados.length === 1 ? 'producto disponible' : 'productos disponibles'}`;
            if (totalAgotados > 0 && !posMostrarAgotados) {
                txt += ` <span style="font-size:0.75rem; color:var(--text-muted, #94a3b8); font-weight:normal;">(${totalAgotados} agotado${totalAgotados === 1 ? '' : 's'} oculto${totalAgotados === 1 ? '' : 's'})</span>`;
            }
            countEl.innerHTML = txt;
        }
    }

    const activeCatEl = document.getElementById('pos-catalog-active-cat');
    if (activeCatEl) {
        if (posCategoriaActiva === 'AGOTADOS') {
            activeCatEl.innerHTML = `<span style="background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3); border-radius:999px; padding:2px 10px; font-weight:700;">🚫 Viendo sólo Agotados</span> <button type="button" onclick="seleccionarCategoriaPOS('TODOS')" style="margin-left:6px; background:none; border:none; color:var(--accent-primary, #2563eb); text-decoration:underline; font-size:0.75rem; cursor:pointer; font-weight:600;">Ver disponibles</button>`;
            activeCatEl.style.display = 'inline-flex';
            activeCatEl.style.alignItems = 'center';
        } else if (posCategoriaActiva === 'STOCK_BAJO') {
            const umbralBajo = typeof obtenerUmbralStockBajo === 'function' ? obtenerUmbralStockBajo() : 5;
            activeCatEl.innerHTML = `<span style="background:rgba(245,158,11,0.15); color:#d97706; border:1px solid rgba(245,158,11,0.35); border-radius:999px; padding:2px 10px; font-weight:700;">⚠️ Viendo Stock Bajo (&le; ${umbralBajo})</span> <button type="button" onclick="seleccionarCategoriaPOS('TODOS')" style="margin-left:6px; background:none; border:none; color:var(--accent-primary, #2563eb); text-decoration:underline; font-size:0.75rem; cursor:pointer; font-weight:600;">Ver todos</button>`;
            activeCatEl.style.display = 'inline-flex';
            activeCatEl.style.alignItems = 'center';
        } else if (posCategoriaActiva !== 'TODOS') {
            activeCatEl.innerHTML = `Filtro: <strong>${posCategoriaActiva}</strong> <button type="button" onclick="seleccionarCategoriaPOS('TODOS')" style="margin-left:4px; background:none; border:none; color:var(--accent-primary, #2563eb); font-weight:bold; cursor:pointer;" title="Quitar filtro">×</button>`;
            activeCatEl.style.display = 'inline-block';
        } else if (posMostrarAgotados) {
            activeCatEl.innerHTML = `<span style="background:rgba(234,179,8,0.15); color:#ca8a04; border:1px solid rgba(234,179,8,0.3); border-radius:999px; padding:2px 10px; font-weight:700;"><i class="fas fa-eye"></i> Mostrando agotados</span> <button type="button" onclick="toggleMostrarAgotadosPOS()" style="margin-left:6px; background:none; border:none; color:var(--accent-primary, #2563eb); text-decoration:underline; font-size:0.75rem; cursor:pointer;">Ocultar</button>`;
            activeCatEl.style.display = 'inline-flex';
            activeCatEl.style.alignItems = 'center';
        } else {
            activeCatEl.style.display = 'none';
        }
    }

    actualizarChipsCategoriasPOS();

    // 1. Renderizar Cuadrícula Compacta
    const gridEl = document.getElementById('pos-grid-view');
    if (gridEl) {
        if (!gridEl.classList.contains('cliente-catalogo-grid')) {
            gridEl.classList.add('cliente-catalogo-grid');
        }
        if (filtrados.length === 0) {
            if (posCategoriaActiva === 'AGOTADOS') {
                gridEl.innerHTML = `
                    <div style="grid-column: 1 / -1; padding: 40px 16px; text-align: center; color: var(--text-muted, #94a3b8);">
                        <i class="fas fa-check-circle" style="font-size: 2.4rem; margin-bottom: 8px; color: #10b981;"></i>
                        <p style="font-weight: 700; margin: 4px 0; color: #10b981;">¡Excelente! No hay productos agotados</p>
                        <small>Todos los productos cuentan con existencias disponibles para la venta.</small>
                        <div style="margin-top: 14px;">
                            <button type="button" class="btn btn-sm btn-primary" onclick="seleccionarCategoriaPOS('TODOS')" style="font-size: 0.8rem; padding: 6px 14px; border-radius: 8px;">
                                <i class="fas fa-arrow-left"></i> Volver a Disponibles
                            </button>
                        </div>
                    </div>
                `;
            } else {
                const agotadosCoincidentes = prods.filter(p => {
                    if (Number(p.stock || 0) > 0) return false;
                    if (!f) return false;
                    const nombre = (p.nombre || "").toLowerCase();
                    const codigo = (p.codigo || "").toLowerCase();
                    const cat = (p.categoria || "").toLowerCase();
                    return nombre.includes(f) || codigo.includes(f) || cat.includes(f);
                });

                if (agotadosCoincidentes.length > 0) {
                    gridEl.innerHTML = `
                        <div style="grid-column: 1 / -1; padding: 36px 16px; text-align: center; background: rgba(239, 68, 68, 0.04); border: 1px dashed rgba(239, 68, 68, 0.35); border-radius: 12px;">
                            <i class="fas fa-ban" style="font-size: 2.2rem; margin-bottom: 8px; color: #ef4444;"></i>
                            <p style="font-weight: 700; margin: 4px 0; color: #ef4444;">${agotadosCoincidentes.length === 1 ? 'El producto coincide con un ítem agotado' : 'Los productos coincidentes están agotados'}</p>
                            <small style="display:block; margin-bottom: 12px; color: var(--text-secondary, #64748b);">No aparece en la venta normal porque su existencia es 0.</small>
                            <button type="button" class="btn btn-sm" onclick="seleccionarCategoriaPOS('AGOTADOS')" style="background: #ef4444; color: #fff; font-weight: 700; border-radius: 8px; padding: 6px 14px; border: none; cursor: pointer;">
                                <i class="fas fa-eye"></i> Ver en Agotados (${agotadosCoincidentes.length})
                            </button>
                        </div>
                    `;
                } else {
                    gridEl.innerHTML = `
                        <div style="grid-column: 1 / -1; padding: 40px 16px; text-align: center; color: var(--text-muted, #94a3b8);">
                            <i class="fas fa-box-open" style="font-size: 2.2rem; margin-bottom: 8px; opacity: 0.4;"></i>
                            <p style="font-weight: 700; margin: 4px 0; color: var(--text-secondary, #475569);">No se encontraron productos disponibles</p>
                            <small>Intenta buscar con otro término o selecciona "Todos"</small>
                        </div>
                    `;
                }
            }
        } else {
            gridEl.innerHTML = filtrados.map(p => {
                const stock = Number(p.stock || 0);
                const precioUSD = Number(p.precio || 0);
                const precioVES = tasa > 0 ? (precioUSD * tasa) : 0;
                const esAgotado = stock <= 0;
                const esCombo = Boolean(p.esCombo === true || p.tipo === 'combo' || String(p.categoria || '').toLowerCase().includes('combo') || String(p.nombre || '').toLowerCase().includes('combo'));
                const umbralBajo = typeof obtenerUmbralStockBajo === 'function' ? obtenerUmbralStockBajo() : 5;
                const esStockBajo = stock > 0 && stock <= umbralBajo;
                const stockBadgeClass = esAgotado 
                    ? 'badge-stock-tag stock-agotado' 
                    : (esStockBajo ? 'badge-stock-tag stock-low badge-stock-low' : 'badge-stock-tag stock-normal');
                
                const imagenSrc = (typeof obtenerImagenProducto === 'function' ? obtenerImagenProducto(p) : (p.imagen || ''));

                const esPesable = Boolean(p.es_pesable || p.esPesable);
                const unidadMedida = p.unidad_medida || p.unidadMedida || 'kg';
                const tieneEmpaque = Boolean(p.tiene_empaque_multiple || p.tieneEmpaqueMultiple);
                const nombreEmpaque = p.empaque_nombre || p.empaqueNombre || 'Fardo';
                const contenidoEmpaque = Number(p.empaque_contenido || p.empaqueContenido || 1);
                const precioEmpaque = Number(p.empaque_precio || p.empaquePrecio || (precioUSD * contenidoEmpaque));
                const empaquesDisponibles = contenidoEmpaque > 0 ? Math.floor(stock / contenidoEmpaque) : 0;

                let actionHtml = '';
                if (esPesable) {
                    actionHtml = `
                        <button type="button" class="btn pos-btn-balanza" onclick="event.stopPropagation(); abrirCalculadoraBalanzaPOS('${p.id}')" ${esAgotado ? 'disabled=""' : ''} title="Abrir báscula digital para ${p.nombre}">
                            <i class="fas fa-scale-balanced"></i>
                            <span class="cliente-btn-text">Balanza</span>
                        </button>
                    `;
                } else if (tieneEmpaque) {
                    actionHtml = `
                        <div class="pos-dual-pills" style="margin-top:2px;">
                            <button type="button" class="pos-dual-pill-btn" onclick="event.stopPropagation(); agregarAlCarritoConPresentacion('${p.id}', 'unidad', 1)" ${esAgotado ? 'disabled=""' : ''} title="Vender 1 Unidad al detal ($${precioUSD.toFixed(2)})">
                                <i class="fas fa-cube"></i> Und
                            </button>
                            <button type="button" class="pos-dual-pill-btn" onclick="event.stopPropagation(); agregarAlCarritoConPresentacion('${p.id}', 'empaque', 1)" ${esAgotado || empaquesDisponibles <= 0 ? 'disabled=""' : ''} title="Vender 1 ${nombreEmpaque} ($${precioEmpaque.toFixed(2)})">
                                <i class="fas fa-boxes-stacked"></i> ${nombreEmpaque}
                            </button>
                        </div>
                    `;
                } else {
                    actionHtml = `
                        <button type="button" class="btn ${esAgotado ? 'btn-secondary' : 'btn-primary'} cliente-btn-add" id="btn-pos-add-${p.id}" onclick="agregarAlCarrito('${p.id}')" ${esAgotado ? 'disabled=""' : ''} title="${esAgotado ? 'Agotado' : 'Agregar al carrito'}">
                            <i class="fas fa-plus"></i>
                            <span class="cliente-btn-text">${esAgotado ? 'Agotado' : 'Agregar'}</span>
                        </button>
                    `;
                }

                let badgeModalidad = '';
                if (esPesable) {
                    badgeModalidad = `<span class="badge-stock-tag" style="background:#fef3c7; color:#b45309; border:1px solid #fde68a;" title="Producto pesable (balanza)"><i class="fas fa-scale-balanced"></i> ${unidadMedida}</span>`;
                } else if (tieneEmpaque) {
                    badgeModalidad = `<span class="badge-stock-tag" style="background:#e0f2fe; color:#0284c7; border:1px solid #bae6fd;" title="Venta por unidad o ${nombreEmpaque}"><i class="fas fa-boxes-stacked"></i> x${contenidoEmpaque}</span>`;
                }

                return `
            <div class="cliente-prod-card pos-row-item ${esAgotado ? 'card-agotado' : ''} ${esCombo ? 'es-super-combo' : ''}" id="pos-card-${p.id}" onclick="if (!event.target.closest('button') && !${esAgotado}) agregarAlCarrito('${p.id}');" style="${esAgotado ? '' : 'cursor: pointer;'}" title="${esAgotado ? 'Producto agotado' : (esPesable ? 'Toca para pesar en balanza' : (tieneEmpaque ? 'Toca para elegir presentación' : 'Toca para agregar al carrito'))}">
                <div class="cliente-prod-img-wrapper">
                    <img src="${imagenSrc}" data-original-src="${p.imagen || ''}" data-prod-nombre="${p.nombre ? p.nombre.replace(/"/g, '&quot;') : ''}" data-prod-cat="${(p.categoria || 'Snacks').replace(/"/g, '&quot;')}" alt="${p.nombre}" class="cliente-prod-img" onerror="alFallarCargaImagen(this)">
                    ${esAgotado ? '<span class="badge-agotado-pill">Agotado</span>' : ''}
                </div>
                <div class="cliente-prod-body">
                    <div class="cliente-prod-meta">
                        <span class="cliente-prod-code">Cód: ${p.codigo || p.id}</span>
                        <span class="cliente-prod-badge-cat">${esCombo ? '🔥 Combo' : (p.categoria || 'General')}</span>
                        ${badgeModalidad}
                        <span class="${stockBadgeClass}" title="Existencia central: ${stock} ${esPesable ? unidadMedida : 'unidades'}">Stock: ${stock} ${esPesable ? unidadMedida : ''}</span>
                    </div>
                    <h4 class="cliente-prod-title" title="${p.nombre}">${p.nombre}</h4>
                    
                    <div class="cliente-prod-prices">
                        <span class="price-usd">$${precioUSD.toFixed(2)}${esPesable ? `/${unidadMedida}` : ''}</span>
                        <span class="price-ves">Bs. ${precioVES > 0 ? precioVES.toFixed(2) : '—'}</span>
                    </div>
                </div>
                <div class="cliente-prod-action">
                    ${actionHtml}
                </div>
            </div>`;
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
                        ${posCategoriaActiva === 'AGOTADOS' ? '🎉 ¡No hay productos agotados!' : 'No hay productos disponibles que coincidan con el filtro'}
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = filtrados.map(p => {
                const stock = Number(p.stock || 0);
                const precioUSD = Number(p.precio || 0);
                const precioVES = tasa > 0 ? (precioUSD * tasa) : 0;
                const esAgotado = stock <= 0;
                const umbralBajo = typeof obtenerUmbralStockBajo === 'function' ? obtenerUmbralStockBajo() : 5;
                const stockClase = esAgotado ? 'out-stock' : (stock > 0 && stock <= umbralBajo ? 'low-stock' : 'in-stock');
                
                const esPesable = Boolean(p.es_pesable || p.esPesable);
                const unidadMedida = p.unidad_medida || p.unidadMedida || 'kg';
                const tieneEmpaque = Boolean(p.tiene_empaque_multiple || p.tieneEmpaqueMultiple);
                const nombreEmpaque = p.empaque_nombre || p.empaqueNombre || 'Fardo';
                const contenidoEmpaque = Number(p.empaque_contenido || p.empaqueContenido || 1);
                const precioEmpaque = Number(p.empaque_precio || p.empaquePrecio || (precioUSD * contenidoEmpaque));
                const empaquesDisponibles = contenidoEmpaque > 0 ? Math.floor(stock / contenidoEmpaque) : 0;

                const stockTexto = esAgotado ? 'Agotado' : `${stock} ${esPesable ? unidadMedida : 'disp.'}`;

                const miniThumbHTML = `
                    <img src="${typeof obtenerImagenProducto === 'function' ? obtenerImagenProducto(p) : (p.imagen || '')}" data-original-src="${p.imagen || ''}" data-prod-nombre="${p.nombre ? p.nombre.replace(/"/g, '&quot;') : ''}" data-prod-cat="${(p.categoria || 'Snacks').replace(/"/g, '&quot;')}" alt="${p.nombre}" class="pos-list-thumb" loading="lazy" 
                         onerror="alFallarCargaImagen(this)">
                `;

                let accionFilaHtml = '';
                if (esPesable) {
                    accionFilaHtml = `
                        <button type="button" class="btn pos-btn-balanza" style="padding: 5px 10px; font-size: 0.76rem; font-weight: 800; min-height: 32px;" 
                                onclick="abrirCalculadoraBalanzaPOS('${p.id}')" ${esAgotado ? 'disabled' : ''}>
                            <i class="fas fa-scale-balanced"></i> Balanza
                        </button>
                    `;
                } else if (tieneEmpaque) {
                    accionFilaHtml = `
                        <div style="display:flex; gap:4px; justify-content:center;">
                            <button type="button" class="btn btn-outline" style="padding: 4px 8px; font-size: 0.74rem; font-weight: 700; min-height: 30px;" 
                                    onclick="agregarAlCarritoConPresentacion('${p.id}', 'unidad', 1)" ${esAgotado ? 'disabled' : ''} title="Vender 1 unidad">
                                + Und
                            </button>
                            <button type="button" class="btn btn-primary" style="padding: 4px 8px; font-size: 0.74rem; font-weight: 700; min-height: 30px;" 
                                    onclick="agregarAlCarritoConPresentacion('${p.id}', 'empaque', 1)" ${esAgotado || empaquesDisponibles <= 0 ? 'disabled' : ''} title="Vender 1 ${nombreEmpaque} ($${precioEmpaque.toFixed(2)})">
                                + ${nombreEmpaque}
                            </button>
                        </div>
                    `;
                } else {
                    accionFilaHtml = `
                        <button type="button" class="btn btn-success" style="padding: 6px 12px; font-size: 0.78rem; font-weight: 800; min-height: 32px;" 
                                onclick="agregarAlCarrito('${p.id}')" ${esAgotado ? 'disabled' : ''}>
                            ${esAgotado ? 'Agotado' : '+ Agregar'}
                        </button>
                    `;
                }

                return `
                    <tr>
                        <td class="pos-list-cell-thumb">${miniThumbHTML}</td>
                        <td style="font-weight: 700; font-size: 0.76rem; color: var(--text-muted);">${p.codigo || '—'}</td>
                        <td class="pos-list-cell-details">
                            <div class="pos-list-prod-info">
                                <strong class="pos-list-name">${p.nombre}</strong>
                                <span class="pos-list-code">${p.categoria || 'Sin categoría'}${esPesable ? ` • ⚖️ Pesable (${unidadMedida})` : (tieneEmpaque ? ` • 📦 Doble Empaque (${nombreEmpaque})` : '')}</span>
                            </div>
                        </td>
                        <td class="num" style="font-weight: 900; color: var(--accent-primary, #2563eb);">$${precioUSD.toFixed(2)}${esPesable ? `/${unidadMedida}` : ''}</td>
                        <td class="num" style="font-size: 0.8rem; color: var(--text-muted);">Bs. ${tasa > 0 ? precioVES.toFixed(2) : '—'}</td>
                        <td class="num"><span class="pos-badge-stock ${stockClase}" style="position:static;">${stockTexto}</span></td>
                        <td class="pos-list-cell-action" style="text-align: center;">
                            ${accionFilaHtml}
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

// =========================================================================
// MOTOR DE PRODUCTOS PESABLES (BALANZA DIGITAL) Y DOBLE PRESENTACIÓN (EMPAQUES)
// =========================================================================

let balanzaProductoActual = null;
let balanzaModoActual = 'peso'; // 'peso' | 'dinero'

/**
 * Abre la calculadora digital de balanza para productos fraccionados/pesables
 */
function abrirCalculadoraBalanzaPOS(productoId) {
    const prods = Array.isArray(productos) ? productos : (AppState.productos || []);
    const p = prods.find(prod => prod.id === productoId);
    if (!p) return;

    balanzaProductoActual = p;
    balanzaModoActual = 'peso';

    const modal = document.getElementById('modal-calculadora-balanza-pos');
    if (!modal) return;

    const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 0);
    const precioKg = Number(p.precio || 0);
    const stock = Number(p.stock || 0);
    const unidad = p.unidad_medida || p.unidadMedida || 'kg';

    const elNombre = document.getElementById('balanza-prod-nombre');
    const elPrecioKg = document.getElementById('balanza-prod-preciokg');
    const elStock = document.getElementById('balanza-stock-disponible');
    const elUnitInfo = document.getElementById('balanza-precio-unitario-info');
    const elUnidadDisplay = document.getElementById('balanza-display-unidad');
    const inputId = document.getElementById('balanza-producto-id');

    if (elNombre) elNombre.textContent = p.nombre;
    if (elPrecioKg) elPrecioKg.textContent = `Precio: $${precioKg.toFixed(2)} / ${unidad}${tasa > 0 ? ` (Bs. ${(precioKg * tasa).toFixed(2)})` : ''}`;
    if (elStock) elStock.innerHTML = `<i class="fas fa-boxes-stacked"></i> Stock disp: <strong>${stock} ${unidad}</strong>`;
    if (elUnitInfo) elUnitInfo.textContent = `$${precioKg.toFixed(2)} / ${unidad}`;
    if (elUnidadDisplay) elUnidadDisplay.textContent = unidad;
    if (inputId) inputId.value = p.id;

    // Resetear modos y valores iniciales
    cambiarModoBalanza('peso');
    const inputKg = document.getElementById('balanza-input-kg');
    const inputG = document.getElementById('balanza-input-g');
    const inputMontoUSD = document.getElementById('balanza-input-monto-usd');
    const inputMontoVES = document.getElementById('balanza-input-monto-ves');

    // Valor predeterminado sugerido
    const pesoInicial = stock >= 0.5 ? 0.500 : (stock > 0 ? Number(stock.toFixed(3)) : 0.250);
    if (inputKg) inputKg.value = pesoInicial.toFixed(3);
    if (inputG) inputG.value = Math.round(pesoInicial * 1000);
    if (inputMontoUSD) inputMontoUSD.value = (pesoInicial * precioKg).toFixed(2);
    if (inputMontoVES) inputMontoVES.value = tasa > 0 ? (pesoInicial * precioKg * tasa).toFixed(2) : '';

    actualizarDisplaysBalanza(pesoInicial);

    modal.style.display = 'flex';
    if (inputKg) {
        setTimeout(() => {
            inputKg.focus();
            inputKg.select();
        }, 120);
    }
}

function cerrarCalculadoraBalanzaPOS() {
    const modal = document.getElementById('modal-calculadora-balanza-pos');
    if (modal) modal.style.display = 'none';
    balanzaProductoActual = null;
}

function cambiarModoBalanza(modo) {
    balanzaModoActual = modo;
    const btnPeso = document.getElementById('btn-modo-balanza-peso');
    const btnDinero = document.getElementById('btn-modo-balanza-dinero');
    const secPeso = document.getElementById('seccion-balanza-peso');
    const secDinero = document.getElementById('seccion-balanza-dinero');

    if (modo === 'peso') {
        if (btnPeso) {
            btnPeso.style.background = '#0284c7';
            btnPeso.style.color = '#ffffff';
            btnPeso.style.fontWeight = '800';
        }
        if (btnDinero) {
            btnDinero.style.background = 'transparent';
            btnDinero.style.color = 'var(--text-muted)';
            btnDinero.style.fontWeight = '700';
        }
        if (secPeso) secPeso.style.display = 'block';
        if (secDinero) secDinero.style.display = 'none';
        const inputKg = document.getElementById('balanza-input-kg');
        if (inputKg) { inputKg.focus(); inputKg.select(); }
    } else {
        if (btnPeso) {
            btnPeso.style.background = 'transparent';
            btnPeso.style.color = 'var(--text-muted)';
            btnPeso.style.fontWeight = '700';
        }
        if (btnDinero) {
            btnDinero.style.background = '#0284c7';
            btnDinero.style.color = '#ffffff';
            btnDinero.style.fontWeight = '800';
        }
        if (secPeso) secPeso.style.display = 'none';
        if (secDinero) secDinero.style.display = 'block';
        const inputUSD = document.getElementById('balanza-input-monto-usd');
        if (inputUSD) { inputUSD.focus(); inputUSD.select(); }
    }
}

function alCambiarPesoKg(valor) {
    if (!balanzaProductoActual) return;
    const kg = Math.max(0, parseFloat(valor) || 0);
    const inputG = document.getElementById('balanza-input-g');
    if (inputG && document.activeElement !== inputG) {
        inputG.value = Math.round(kg * 1000);
    }
    actualizarDisplaysBalanza(kg);
}

function alCambiarPesoGramos(valor) {
    if (!balanzaProductoActual) return;
    const g = Math.max(0, parseFloat(valor) || 0);
    const kg = g / 1000;
    const inputKg = document.getElementById('balanza-input-kg');
    if (inputKg && document.activeElement !== inputKg) {
        inputKg.value = kg.toFixed(3);
    }
    actualizarDisplaysBalanza(kg);
}

function aplicarPresetPeso(kg) {
    const inputKg = document.getElementById('balanza-input-kg');
    const inputG = document.getElementById('balanza-input-g');
    if (inputKg) inputKg.value = Number(kg).toFixed(3);
    if (inputG) inputG.value = Math.round(kg * 1000);
    cambiarModoBalanza('peso');
    actualizarDisplaysBalanza(kg);
}

function alCambiarMontoDineroUSD(valor) {
    if (!balanzaProductoActual) return;
    const montoUSD = Math.max(0, parseFloat(valor) || 0);
    const precioKg = Number(balanzaProductoActual.precio || 0);
    const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 0);

    const inputVES = document.getElementById('balanza-input-monto-ves');
    if (inputVES && document.activeElement !== inputVES && tasa > 0) {
        inputVES.value = (montoUSD * tasa).toFixed(2);
    }

    const kg = precioKg > 0 ? (montoUSD / precioKg) : 0;
    const inputKg = document.getElementById('balanza-input-kg');
    const inputG = document.getElementById('balanza-input-g');
    if (inputKg && document.activeElement !== inputKg) inputKg.value = kg.toFixed(3);
    if (inputG && document.activeElement !== inputG) inputG.value = Math.round(kg * 1000);

    actualizarDisplaysBalanza(kg);
}

function alCambiarMontoDineroVES(valor) {
    if (!balanzaProductoActual) return;
    const montoVES = Math.max(0, parseFloat(valor) || 0);
    const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 0);
    const montoUSD = tasa > 0 ? (montoVES / tasa) : 0;

    const inputUSD = document.getElementById('balanza-input-monto-usd');
    if (inputUSD && document.activeElement !== inputUSD) {
        inputUSD.value = montoUSD.toFixed(2);
    }

    const precioKg = Number(balanzaProductoActual.precio || 0);
    const kg = precioKg > 0 ? (montoUSD / precioKg) : 0;
    const inputKg = document.getElementById('balanza-input-kg');
    const inputG = document.getElementById('balanza-input-g');
    if (inputKg && document.activeElement !== inputKg) inputKg.value = kg.toFixed(3);
    if (inputG && document.activeElement !== inputG) inputG.value = Math.round(kg * 1000);

    actualizarDisplaysBalanza(kg);
}

function actualizarDisplaysBalanza(kg) {
    if (!balanzaProductoActual) return;
    const precioKg = Number(balanzaProductoActual.precio || 0);
    const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 0);
    const totalUSD = kg * precioKg;
    const totalVES = tasa > 0 ? (totalUSD * tasa) : 0;

    const dispPeso = document.getElementById('balanza-display-peso');
    const dispUsd = document.getElementById('balanza-display-monto-usd');
    const dispVes = document.getElementById('balanza-display-monto-ves');

    if (dispPeso) dispPeso.textContent = kg.toFixed(3);
    if (dispUsd) dispUsd.textContent = `$${totalUSD.toFixed(2)}`;
    if (dispVes) dispVes.textContent = `Bs. ${tasa > 0 ? totalVES.toFixed(2) : '—'}`;
}

function confirmarAgregarBalanzaAlCarrito() {
    if (!balanzaProductoActual) return;
    const inputKg = document.getElementById('balanza-input-kg');
    let kg = parseFloat(inputKg ? inputKg.value : 0) || 0;
    kg = Number(kg.toFixed(3));

    if (kg <= 0) {
        if (typeof showCustomToast === 'function') {
            showCustomToast('Ingresa un peso válido mayor a 0', 'warning');
        }
        return;
    }

    const stock = Number(balanzaProductoActual.stock || 0);
    if (kg > stock) {
        if (typeof showCustomToast === 'function') {
            showCustomToast(`Stock insuficiente. Disponible: ${stock} ${balanzaProductoActual.unidad_medida || balanzaProductoActual.unidadMedida || 'kg'}`, 'error');
        } else if (typeof showCustomAlert === 'function') {
            showCustomAlert('Stock Insuficiente', `Disponible en balanza: ${stock}.`, 'warning');
        }
        return;
    }

    agregarAlCarritoConPresentacion(balanzaProductoActual.id, 'unidad', kg);
    cerrarCalculadoraBalanzaPOS();
    if (typeof showCustomToast === 'function') {
        showCustomToast(`Balanza: Agregado ${kg.toFixed(3)} ${balanzaProductoActual.unidad_medida || balanzaProductoActual.unidadMedida || 'kg'} de ${balanzaProductoActual.nombre}`, 'success');
    }
}

/**
 * Modal para seleccionar si se vende por Unidad al detal o por Empaque Múltiple (Fardo / Bulto)
 */
function abrirModalSelectorPresentacionPOS(productoId) {
    const prods = Array.isArray(productos) ? productos : (AppState.productos || []);
    const p = prods.find(prod => prod.id === productoId);
    if (!p) return;

    const modal = document.getElementById('modal-selector-presentacion-pos');
    const nombreEl = document.getElementById('presentacion-modal-nombre');
    const opcionesEl = document.getElementById('presentacion-modal-opciones');
    if (!modal || !opcionesEl) return;

    if (nombreEl) nombreEl.textContent = p.nombre;

    const stock = Number(p.stock || 0);
    const precioUnd = Number(p.precio || 0);
    const contenidoEmpaque = Number(p.empaque_contenido || p.empaqueContenido || 1);
    const nombreEmpaque = p.empaque_nombre || p.empaqueNombre || 'Fardo';
    const precioEmpaque = Number(p.empaque_precio || p.empaquePrecio || (precioUnd * contenidoEmpaque));
    const empaquesCompletos = contenidoEmpaque > 0 ? Math.floor(stock / contenidoEmpaque) : 0;
    const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 0);

    opcionesEl.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:12px;">
            <!-- Opción 1: Unidad al Detal -->
            <div class="presentacion-opt-card" onclick="agregarAlCarritoConPresentacion('${p.id}', 'unidad', 1); cerrarModalSelectorPresentacionPOS();">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-weight:800; font-size:1rem; color:var(--text-main); display:flex; align-items:center; gap:6px;">
                            <i class="fas fa-cube" style="color:#0284c7;"></i> Unidad al Detal
                        </div>
                        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
                            Descuenta 1 unidad del inventario central (${stock} und disp.)
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:1.15rem; font-weight:900; color:#0284c7;">$${precioUnd.toFixed(2)}</div>
                        <div style="font-size:0.75rem; color:var(--text-muted);">${tasa > 0 ? `Bs. ${(precioUnd * tasa).toFixed(2)}` : ''}</div>
                    </div>
                </div>
            </div>

            <!-- Opción 2: Empaque Múltiple (Fardo / Bulto) -->
            <div class="presentacion-opt-card" onclick="if(${empaquesCompletos} > 0) { agregarAlCarritoConPresentacion('${p.id}', 'empaque', 1); cerrarModalSelectorPresentacionPOS(); }" style="${empaquesCompletos <= 0 ? 'opacity:0.6; cursor:not-allowed;' : ''}">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-weight:800; font-size:1rem; color:var(--text-main); display:flex; align-items:center; gap:6px;">
                            <i class="fas fa-boxes-stacked" style="color:#10b981;"></i> ${nombreEmpaque} Completo
                            <span style="background:#e0f2fe; color:#0284c7; font-size:0.7rem; padding:2px 6px; border-radius:6px; font-weight:700;">Contiene ${contenidoEmpaque} und</span>
                        </div>
                        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
                            Descuenta ${contenidoEmpaque} unidades del inventario central (${empaquesCompletos} ${nombreEmpaque.toLowerCase()}s disp.)
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:1.15rem; font-weight:900; color:#10b981;">$${precioEmpaque.toFixed(2)}</div>
                        <div style="font-size:0.75rem; color:var(--text-muted);">${tasa > 0 ? `Bs. ${(precioEmpaque * tasa).toFixed(2)}` : ''}</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
}

function cerrarModalSelectorPresentacionPOS() {
    const modal = document.getElementById('modal-selector-presentacion-pos');
    if (modal) modal.style.display = 'none';
}

/**
 * Agrega un producto al carrito respetando su presentación (Unidad o Empaque Múltiple)
 * y permitiendo cantidades enteras o decimales (pesables).
 */
function agregarAlCarritoConPresentacion(id, tipoPresentacion = 'unidad', cantidadDeseada = 1) {
    const prods = Array.isArray(productos) ? productos : (AppState.productos || []);
    const p = prods.find(prod => prod.id === id);
    if (!p) return;

    const stockActual = Number(p.stock || 0);
    const esEmpaque = tipoPresentacion === 'empaque';
    const factorStock = esEmpaque ? Number(p.empaque_contenido || p.empaqueContenido || 1) : 1;
    const precio = esEmpaque 
        ? Number(p.empaque_precio || p.empaquePrecio || (Number(p.precio || 0) * factorStock))
        : Number(p.precio || 0);
    const nombrePres = esEmpaque ? (p.empaque_nombre || p.empaqueNombre || 'Fardo') : 'Unidad';
    const esPesable = Boolean(p.es_pesable || p.esPesable);
    const unidadMedida = p.unidad_medida || p.unidadMedida || 'und';

    // Stock central consumido actualmente en el carrito por este producto (sumando todas las presentaciones)
    const stockConsumidoEnCarrito = carrito
        .filter(item => item.productoId === id)
        .reduce((sum, item) => sum + (Number(item.cantidad || 0) * Number(item.factorStock || 1)), 0);

    const stockRequeridoParaEste = Number(cantidadDeseada) * factorStock;

    if ((stockConsumidoEnCarrito + stockRequeridoParaEste) > stockActual + 0.0001) {
        if (typeof showCustomToast === 'function') {
            showCustomToast(`Stock insuficiente para ${p.nombre}. Disponible central: ${stockActual} ${unidadMedida}`, 'warning');
        } else if (typeof showCustomAlert === 'function') {
            showCustomAlert("Stock Insuficiente", `Stock insuficiente para ${p.nombre}. Disponible central: ${stockActual} ${unidadMedida}.`, 'warning');
        }
        return;
    }

    // Buscar si ya existe este ítem con la MISMA presentación en el carrito
    const itemEnCarrito = carrito.find(item => item.productoId === id && (item.tipoPresentacion || 'unidad') === tipoPresentacion);

    if (itemEnCarrito) {
        itemEnCarrito.cantidad = Number((Number(itemEnCarrito.cantidad || 0) + Number(cantidadDeseada)).toFixed(3));
    } else {
        carrito.push({
            productoId: id,
            nombre: esEmpaque ? `${p.nombre} (${nombrePres})` : p.nombre,
            nombreBase: p.nombre,
            precio: precio,
            cantidad: Number(Number(cantidadDeseada).toFixed(3)),
            imagen: p.imagen || '',
            codigo: p.codigo || '',
            esPesable: esPesable,
            unidadMedida: unidadMedida,
            tipoPresentacion: tipoPresentacion,
            nombrePresentacion: nombrePres,
            factorStock: factorStock
        });
    }

    renderizarCarrito();

    if (window.navigator && window.navigator.vibrate) {
        try { window.navigator.vibrate(25); } catch {}
    }
    animarBotonAgregar(id);
    animarBarraCarritoMobile();
}

/**
 * Entrada estándar de producto desde el catálogo POS
 */
function agregarAlCarrito(id) {
    const prods = Array.isArray(productos) ? productos : (AppState.productos || []);
    const p = prods.find(prod => prod.id === id);
    if (!p) return;

    // Si es pesable, abrir directamente la balanza digital
    if (p.es_pesable || p.esPesable) {
        abrirCalculadoraBalanzaPOS(id);
        return;
    }

    // Si tiene empaque múltiple (Fardo / Bulto), abrir selector de presentación
    if (p.tiene_empaque_multiple || p.tieneEmpaqueMultiple) {
        abrirModalSelectorPresentacionPOS(id);
        return;
    }

    // Producto convencional por unidad
    agregarAlCarritoConPresentacion(id, 'unidad', 1);
}

function modificarCantidadCarrito(idx, delta) {
    if (!carrito[idx]) return;
    const item = carrito[idx];
    const prods = Array.isArray(productos) ? productos : (AppState.productos || []);
    const prod = prods.find(p => p.id === item.productoId);
    const stockCentral = prod ? Number(prod.stock || 0) : 9999;
    const factorStock = Number(item.factorStock || 1);

    // Calcular cuánto stock consumen los OTROS ítems del mismo producto en el carrito
    const stockOtrosItems = carrito
        .filter((it, i) => i !== idx && it.productoId === item.productoId)
        .reduce((sum, it) => sum + (Number(it.cantidad || 0) * Number(it.factorStock || 1)), 0);

    const stockDisponibleParaEste = Math.max(0, stockCentral - stockOtrosItems);
    const cantMaxPermitida = factorStock > 0 ? (stockDisponibleParaEste / factorStock) : 9999;

    const esPesable = Boolean(item.esPesable);
    const paso = esPesable ? (item.cantidad <= 0.5 ? 0.050 : 0.100) : 1;
    const incremento = delta > 0 ? paso : -paso;

    if (delta > 0) {
        if ((Number(item.cantidad) + incremento) <= (cantMaxPermitida + 0.0001)) {
            item.cantidad = Number((Number(item.cantidad) + incremento).toFixed(3));
        } else {
            if (typeof showCustomToast === 'function') {
                showCustomToast(`Stock máximo alcanzado (${stockCentral} disp. en inventario central)`, 'warning');
            } else if (typeof showCustomAlert === 'function') {
                showCustomAlert('Stock Máximo', `Stock máximo alcanzado para ${item.nombre}.`, 'warning');
            }
            return;
        }
    } else if (delta < 0) {
        const umbralMin = esPesable ? 0.05 : 1;
        if (Number(item.cantidad) > umbralMin) {
            item.cantidad = Number((Number(item.cantidad) + incremento).toFixed(3));
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
    const prods = Array.isArray(productos) ? productos : (AppState.productos || []);
    const prod = prods.find(p => p.id === item.productoId);
    const stockCentral = prod ? Number(prod.stock || 0) : 9999;
    const factorStock = Number(item.factorStock || 1);

    const stockOtrosItems = carrito
        .filter((it, i) => i !== idx && it.productoId === item.productoId)
        .reduce((sum, it) => sum + (Number(it.cantidad || 0) * Number(it.factorStock || 1)), 0);

    const stockDisponibleParaEste = Math.max(0, stockCentral - stockOtrosItems);
    const cantMaxPermitida = factorStock > 0 ? (stockDisponibleParaEste / factorStock) : 9999;

    let cant = parseFloat(valor);
    if (isNaN(cant) || cant <= 0) cant = item.esPesable ? 0.05 : 1;
    cant = Number(cant.toFixed(3));

    if (cant > (cantMaxPermitida + 0.0001)) {
        cant = Number(cantMaxPermitida.toFixed(3));
        if (typeof showCustomToast === 'function') {
            showCustomToast(`Ajustado al stock máximo disponible (${cant})`, 'warning');
        }
    }
    item.cantidad = cant;
    renderizarCarrito();
    animarBarraCarritoMobile();
}

function vaciarCarritoPOS() {
    if (!carrito || carrito.length === 0) {
        if (typeof showCustomToast === 'function') {
            showCustomToast("El carrito ya está vacío", "info");
        }
        return;
    }

    carrito = [];
    const desktopSel = document.getElementById('pos-tipo-pago');
    const mobileSel = document.getElementById('pos-tipo-pago-mobile');
    if (desktopSel) desktopSel.value = 'Crédito';
    if (mobileSel) mobileSel.value = 'Crédito';
    sincronizarCondicionPago('pos-tipo-pago');
    renderizarCarrito();
    animarBarraCarritoMobile();
    if (typeof showCustomToast === 'function') {
        showCustomToast("Carrito vaciado", "info");
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
        totalItemsCount += (item.esPesable ? 1 : Math.ceil(Number(item.cantidad || 0)));
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
            const subtotal = Number(item.cantidad) * Number(item.precio);
            const esPesable = Boolean(item.esPesable);
            const cantStr = esPesable ? Number(item.cantidad).toFixed(3) : item.cantidad;
            const unidadMed = item.unidadMedida || 'und';
            
            const presBadge = item.tipoPresentacion === 'empaque'
                ? `<span style="background:#e0f2fe; color:#0284c7; padding:1px 6px; border-radius:4px; font-size:0.68rem; font-weight:700;">📦 ${item.nombrePresentacion || 'Fardo'} (x${item.factorStock} und)</span>`
                : (esPesable ? `<span style="background:#fef3c7; color:#b45309; padding:1px 6px; border-radius:4px; font-size:0.68rem; font-weight:700;">⚖️ Balanza (${unidadMed})</span>` : '');

            return `
                <tr>
                    <td>
                        <div style="font-weight: 800; color: var(--text-primary); display:flex; align-items:center; flex-wrap:wrap; gap:4px;">
                            <span>${item.nombre}</span>
                            ${presBadge}
                        </div>
                        <div style="font-size: 0.72rem; color: var(--text-muted);">$${item.precio.toFixed(2)} c/${item.tipoPresentacion === 'empaque' ? (item.nombrePresentacion || 'empaque') : unidadMed}</div>
                    </td>
                    <td class="num">
                        <div class="pos-stepper">
                            <button type="button" class="pos-stepper-btn" onclick="modificarCantidadCarrito(${idx}, -1)">-</button>
                            <input type="number" class="pos-stepper-val" value="${cantStr}" 
                                   min="${esPesable ? '0.001' : '1'}" 
                                   step="${esPesable ? '0.001' : '1'}" 
                                   onchange="establecerCantidadCarrito(${idx}, this.value)" 
                                   inputmode="decimal">
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
                const subtotal = Number(item.cantidad) * Number(item.precio);
                const prods = Array.isArray(productos) ? productos : (AppState.productos || []);
                const prod = prods.find(p => p.id === item.productoId);
                const rawImg = item.imagen || (prod ? prod.imagen : '');
                const thumbSrc = (typeof obtenerImagenProducto === 'function' ? obtenerImagenProducto(prod || item) : (rawImg || ''));
                const esPesable = Boolean(item.esPesable);
                const cantStr = esPesable ? Number(item.cantidad).toFixed(3) : item.cantidad;
                const unidadMed = item.unidadMedida || 'und';

                const presBadge = item.tipoPresentacion === 'empaque'
                    ? `<span style="background:#e0f2fe; color:#0284c7; padding:1px 6px; border-radius:4px; font-size:0.68rem; font-weight:700;">📦 ${item.nombrePresentacion || 'Fardo'} (x${item.factorStock} und)</span>`
                    : (esPesable ? `<span style="background:#fef3c7; color:#b45309; padding:1px 6px; border-radius:4px; font-size:0.68rem; font-weight:700;">⚖️ ${unidadMed}</span>` : '');

                return `
                    <div class="pos-drawer-item-row" id="pos-drawer-item-${idx}">
                        <div class="pos-drawer-item-thumb-wrap">
                            <img src="${thumbSrc}" data-original-src="${rawImg}" data-prod-nombre="${item.nombre ? item.nombre.replace(/"/g, '&quot;') : ''}" data-prod-cat="General" alt="${item.nombre}" class="pos-drawer-item-thumb" 
                                 onerror="alFallarCargaImagen(this)">
                        </div>
                        <div class="pos-drawer-item-content">
                            <div class="pos-drawer-item-header-row">
                                <div style="display:flex; flex-direction:column; gap:2px; flex:1;">
                                    <span class="pos-drawer-item-name" title="${item.nombre}">${item.nombre}</span>
                                    <div>${presBadge}</div>
                                </div>
                                <button type="button" class="pos-btn-del-item" onclick="eliminarDelCarrito(${idx})" title="Eliminar ítem" aria-label="Eliminar ${item.nombre}">
                                    <i class="fas fa-trash-can"></i>
                                </button>
                            </div>
                            <div class="pos-drawer-item-footer-row">
                                <div class="pos-drawer-item-prices">
                                    <span class="pos-drawer-item-price">$${item.precio.toFixed(2)} c/${item.tipoPresentacion === 'empaque' ? (item.nombrePresentacion || 'empaque') : unidadMed}</span>
                                </div>
                                <div class="pos-stepper">
                                    <button type="button" class="pos-stepper-btn" onclick="modificarCantidadCarrito(${idx}, -1)" aria-label="Disminuir">-</button>
                                    <input type="number" class="pos-stepper-val" value="${cantStr}" 
                                           min="${esPesable ? '0.001' : '1'}" 
                                           step="${esPesable ? '0.001' : '1'}" 
                                           onchange="establecerCantidadCarrito(${idx}, this.value)" 
                                           inputmode="decimal">
                                    <button type="button" class="pos-stepper-btn" onclick="modificarCantidadCarrito(${idx}, 1)" aria-label="Aumentar">+</button>
                                </div>
                                <span class="pos-drawer-item-subtotal">$${subtotal.toFixed(2)}</span>
                            </div>
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
    sincronizarCondicionPago('pos-tipo-pago');
    if (typeof renderizarCustomClientePickersPOS === 'function') {
        renderizarCustomClientePickersPOS('mobile');
    }
    const overlay = document.getElementById('pos-cart-drawer-overlay');
    if (overlay) {
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function cerrarDrawerCarritoMobile() {
    if (typeof cerrarDropdownClientePOS === 'function') {
        cerrarDropdownClientePOS('mobile');
    }
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

    if (typeof actualizarCustomClienteTriggerDisplay === 'function') {
        actualizarCustomClienteTriggerDisplay();
    }
}

/**
 * Sincroniza el selector de condición (Contado vs Crédito) entre escritorio y móvil
 * y actualiza dinámicamente el estilo y texto del botón de cobro
 */
function sincronizarCondicionPago(origenId) {
    const desktopSel = document.getElementById('pos-tipo-pago');
    const mobileSel = document.getElementById('pos-tipo-pago-mobile');
    let val = 'Crédito';

    if (origenId === 'pos-tipo-pago' && desktopSel) {
        val = desktopSel.value;
        if (mobileSel) mobileSel.value = val;
    } else if (origenId === 'pos-tipo-pago-mobile' && mobileSel) {
        val = mobileSel.value;
        if (desktopSel) desktopSel.value = val;
    } else if (desktopSel) {
        val = desktopSel.value;
        if (mobileSel) mobileSel.value = val;
    } else if (mobileSel) {
        val = mobileSel.value;
    }

    const btnDesktop = document.getElementById('btn-pos-checkout-desktop');
    const btnMobile = document.getElementById('btn-pos-checkout-mobile');

    if (val === 'Crédito') {
        if (btnDesktop) {
            btnDesktop.innerHTML = '<i class="fas fa-file-invoice-dollar"></i> Asentar Venta a Crédito';
            btnDesktop.style.background = 'linear-gradient(135deg, #2563eb, #1d4ed8)';
            btnDesktop.style.borderColor = '#1d4ed8';
        }
        if (btnMobile) {
            btnMobile.innerHTML = '<i class="fas fa-file-invoice-dollar"></i> Asentar Venta a Crédito';
            btnMobile.style.background = 'linear-gradient(135deg, #2563eb, #1d4ed8)';
        }
    } else {
        if (btnDesktop) {
            btnDesktop.innerHTML = '<i class="fas fa-check-circle"></i> Completar Transacción';
            btnDesktop.style.background = '';
            btnDesktop.style.borderColor = '';
        }
        if (btnMobile) {
            btnMobile.innerHTML = '<i class="fas fa-check-circle"></i> Confirmar & Cobrar';
            btnMobile.style.background = '';
        }
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

    // Guardia de Bloqueo por Turno de Caja (exclusivo para rol Vendedor si está configurado por el Administrador)
    const exigirTurno = Boolean(AppState.exigirTurnoVendedor);
    const usuarioActual = AppState.usuarioActual;
    const esAdmin = typeof esUsuarioAdmin === 'function' ? esUsuarioAdmin(usuarioActual) : (usuarioActual?.rol === 'admin' || usuarioActual?.rol === 'superadmin' || usuarioActual?.id === 'SuperAdmin');
    const esVendedor = !esAdmin && (usuarioActual?.rol === 'vendedor');

    if (exigirTurno && esVendedor) {
        const turnoActivo = AppState.turnoActivo && AppState.turnoActivo.estado === 'ABIERTO';
        if (!turnoActivo) {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert(
                    'Apertura de Turno Requerida',
                    'Como vendedor, debes realizar la Apertura de Turno con el fondo inicial de la gaveta antes de poder procesar ventas o créditos en la caja.',
                    'warning'
                );
            } else {
                alert('Como vendedor, debes realizar la Apertura de Turno de caja antes de vender.');
            }
            if (window.InventoryApp?.CajaTurnos?.abrirModalAperturaTurno) {
                setTimeout(() => {
                    window.InventoryApp.CajaTurnos.abrirModalAperturaTurno();
                }, 400);
            }
            return;
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

    // Prevalidamos todo el carrito antes de abrir el checkout considerando factores de empaque y decimales
    const consumoPorProducto = {};
    for (const item of carrito) {
        const factor = Number(item.factorStock || 1);
        const consumo = Number((Number(item.cantidad || 0) * factor).toFixed(4));
        consumoPorProducto[item.productoId] = (consumoPorProducto[item.productoId] || 0) + consumo;
    }

    for (const [prodId, req] of Object.entries(consumoPorProducto)) {
        const producto = (productos || []).find(p => p.id === prodId);
        if (!producto || req <= 0 || req > (Number(producto.stock || 0) + 0.0001)) {
            const msg = `Stock insuficiente para ${producto?.nombre || 'el producto'}. Requerido en inventario central: ${req}, disponible: ${producto ? producto.stock : 0}.`;
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Stock Insuficiente', msg, 'warning');
            } else {
                alert(msg);
            }
            return;
        }
    }

    // Detectar si la condición de venta es Contado o Crédito
    const desktopCond = document.getElementById('pos-tipo-pago')?.value;
    const mobileCond = document.getElementById('pos-tipo-pago-mobile')?.value;
    const condicion = desktopCond || mobileCond || 'Crédito';

    const clienteIdSelect = document.getElementById('pos-cliente-select') || document.getElementById('pos-cliente-select-mobile');
    const clienteId = clienteIdSelect ? clienteIdSelect.value : (clientes[0]?.id || 'V-00000000');
    const listaClientes = Array.isArray(clientes) ? clientes : (AppState.clientes || []);
    const clienteObj = listaClientes.find(c => c.id === clienteId) || { id: clienteId, nombre: 'Cliente de Mostrador' };

    if (condicion === 'Crédito') {
        // En ventas a crédito es indispensable tener un cliente asignado con cuenta
        if (!clienteId || clienteId === 'V-00000000' || (clienteObj.nombre && clienteObj.nombre.toLowerCase().includes('mostrador'))) {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Cliente Requerido', 'Para registrar una venta a Crédito (Fiado), debes seleccionar un cliente registrado en el selector de clientes.', 'warning');
            } else {
                alert('Para vender a crédito debes seleccionar un cliente registrado.');
            }
            return;
        }

        // Flujo directo y simplificado para crédito: Solo confirmación directa a cuenta corriente
        abrirModalConfirmacionCreditoPOS(clienteObj);
    } else {
        // Flujo al contado: Abre el modal para registrar método de cobro en caja
        abrirModalCheckoutPOS();
    }
}

/**
 * Abre el Modal de Confirmación Simplificado para Ventas a Crédito (Fiado)
 * No pide método de pago ni número de referencia redundantes.
 */
function abrirModalConfirmacionCreditoPOS(clienteObj) {
    let modal = document.getElementById('modal-pos-confirmar-credito');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-pos-confirmar-credito';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    const totalUSD = carrito.reduce((sum, i) => sum + (i.cantidad * i.precio), 0);
    const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 0);
    const totalVES = tasa > 0 ? (totalUSD * tasa) : 0;
    const totalArticulos = carrito.reduce((s, i) => s + i.cantidad, 0);

    let deudaActual = 0;
    if (typeof calcularEstadoFinancieroCliente === 'function') {
        const estFin = calcularEstadoFinancieroCliente(clienteObj.id || clienteObj);
        deudaActual = estFin ? Number(estFin.saldoDeudaUSD || 0) : Number(clienteObj.deudaUSD || 0);
    } else {
        deudaActual = Number(clienteObj.deudaUSD || 0);
    }
    clienteObj.deudaUSD = deudaActual;
    const nuevaDeuda = deudaActual + totalUSD;

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 480px; animation: modalPop 0.25s ease-out; border-radius: 16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid var(--border, #e2e8f0); padding-bottom:10px;">
                <h3 style="margin:0; font-size:1.2rem; display:flex; align-items:center; gap:8px; color:var(--text-main, #0f172a);">
                    <i class="fas fa-file-invoice-dollar" style="color:var(--accent-primary, #2563eb);"></i> Confirmar Venta a Crédito
                </h3>
                <button type="button" class="btn-icon-tasa" onclick="cerrarModalConfirmacionCreditoPOS()"><i class="fas fa-times"></i></button>
            </div>

            <!-- Resumen Directo de la Operación -->
            <div style="background:var(--bg-canvas-subtle, #f8fafc); border:1px solid var(--border-color, #e2e8f0); border-radius:12px; padding:14px; margin-bottom:14px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <span style="color:var(--text-muted, #64748b); font-size:0.88rem;">Cliente Asignado:</span>
                    <strong style="color:var(--text-main, #0f172a); font-size:0.95rem;">${clienteObj.nombre} (${clienteObj.id})</strong>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <span style="color:var(--text-muted, #64748b); font-size:0.88rem;">Artículos en Carrito:</span>
                    <strong>${totalArticulos} unidades</strong>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px; border-top:1px dashed #cbd5e1; padding-top:8px;">
                    <span style="color:var(--text-muted, #64748b); font-size:0.88rem;">Monto a Fiar (USD):</span>
                    <strong style="color:var(--accent-primary, #2563eb); font-size:1.25rem;">$${totalUSD.toFixed(2)}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <span style="color:var(--text-muted, #64748b); font-size:0.88rem;">Equivalente Bolívares:</span>
                    <strong style="color:#16a34a; font-size:1.05rem;">Bs. ${totalVES > 0 ? totalVES.toFixed(2) : '—'}</strong>
                </div>

                ${deudaActual > 0 ? `
                <div style="display:flex; justify-content:space-between; margin-top:10px; padding-top:8px; border-top:1px solid #e2e8f0; font-size:0.84rem;">
                    <span style="color:#dc2626;">Deuda pendiente previa:</span>
                    <strong style="color:#dc2626;">$${deudaActual.toFixed(2)} USD</strong>
                </div>
                <div style="display:flex; justify-content:space-between; margin-top:4px; font-size:0.86rem; font-weight:700;">
                    <span style="color:var(--text-main, #0f172a);">Nuevo saldo deudor:</span>
                    <span style="color:#b91c1c;">$${nuevaDeuda.toFixed(2)} USD</span>
                </div>
                ` : `
                <div style="display:flex; justify-content:space-between; margin-top:8px; font-size:0.82rem; color:#16a34a;">
                    <span><i class="fas fa-check-circle"></i> El cliente no tiene deudas pendientes</span>
                </div>
                `}
            </div>

            <!-- Información al Cajero -->
            <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:10px 12px; margin-bottom:14px; display:flex; gap:10px; align-items:flex-start;">
                <i class="fas fa-info-circle" style="color:#2563eb; font-size:1.1rem; margin-top:2px;"></i>
                <div style="font-size:0.84rem; color:#1e40af; line-height:1.4;">
                    Esta venta se registrará automáticamente como <strong>Crédito (Fiado)</strong> en la cuenta corriente del cliente. No requiere método de pago en caja ni comprobante bancario.
                </div>
            </div>

            <div style="text-align:center; margin-bottom:14px;">
                <a href="javascript:void(0)" onclick="cambiarAContadoDesdeModal()" style="font-size:0.82rem; color:var(--text-muted, #64748b); text-decoration:underline;">
                    <i class="fas fa-cash-register"></i> ¿Cobrar al Contado en caja en vez de fiar?
                </a>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button type="button" class="btn btn-outline" onclick="cerrarModalConfirmacionCreditoPOS()">Cancelar</button>
                <button type="button" class="btn btn-success" id="btn-ejecutar-credito-pos" onclick="ejecutarVentaCreditoDirecta('${clienteObj.id}')" style="font-weight:700; padding:10px 20px; display:inline-flex; align-items:center; gap:8px; background:linear-gradient(135deg, #2563eb, #1d4ed8); border-color:#1d4ed8;">
                    <i class="fas fa-check"></i> Asentar Venta a Crédito
                </button>
            </div>
        </div>
    `;

    modal.classList.add('active');
}

function cerrarModalConfirmacionCreditoPOS() {
    const modal = document.getElementById('modal-pos-confirmar-credito');
    if (modal) modal.classList.remove('active');
}

function cambiarACreditoDesdeModal() {
    cerrarModalCheckoutPOS();
    const desktopSel = document.getElementById('pos-tipo-pago');
    const mobileSel = document.getElementById('pos-tipo-pago-mobile');
    if (desktopSel) desktopSel.value = 'Crédito';
    if (mobileSel) mobileSel.value = 'Crédito';
    sincronizarCondicionPago('pos-tipo-pago');

    const clienteIdSelect = document.getElementById('pos-cliente-select') || document.getElementById('pos-cliente-select-mobile');
    const clienteId = clienteIdSelect ? clienteIdSelect.value : (clientes[0]?.id || 'V-00000000');
    const listaClientes = Array.isArray(clientes) ? clientes : (AppState.clientes || []);
    const clienteObj = listaClientes.find(c => c.id === clienteId) || { id: clienteId, nombre: 'Cliente de Mostrador' };

    if (!clienteId || clienteId === 'V-00000000' || (clienteObj.nombre && clienteObj.nombre.toLowerCase().includes('mostrador'))) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Cliente Requerido', 'Para registrar una venta a Crédito (Fiado), debes seleccionar un cliente registrado.', 'warning');
        }
        return;
    }
    abrirModalConfirmacionCreditoPOS(clienteObj);
}

function cambiarAContadoDesdeModal() {
    cerrarModalConfirmacionCreditoPOS();
    const desktopSel = document.getElementById('pos-tipo-pago');
    const mobileSel = document.getElementById('pos-tipo-pago-mobile');
    if (desktopSel) desktopSel.value = 'Contado';
    if (mobileSel) mobileSel.value = 'Contado';
    sincronizarCondicionPago('pos-tipo-pago');
    abrirModalCheckoutPOS();
}

/**
 * Asienta la venta a crédito directamente en cuenta corriente sin pedir métodos de pago en caja
 */
async function ejecutarVentaCreditoDirecta(clienteIdParam) {
    const clienteIdSelect = document.getElementById('pos-cliente-select') || document.getElementById('pos-cliente-select-mobile');
    const clienteId = clienteIdParam || (clienteIdSelect ? clienteIdSelect.value : (clientes[0]?.id || 'V-00000000'));
    const listaClientes = Array.isArray(clientes) ? clientes : (AppState.clientes || []);
    const clienteObj = listaClientes.find(c => c.id === clienteId) || { id: clienteId, nombre: 'Cliente de Mostrador' };

    const total = carrito.reduce((sum, i) => sum + (i.cantidad * i.precio), 0);
    const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 0);
    const totalVES = tasa > 0 ? (total * tasa) : 0;

    const btnConfirmar = document.getElementById('btn-ejecutar-credito-pos');
    if (btnConfirmar) {
        btnConfirmar.disabled = true;
        btnConfirmar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Asentando...';
    }

    // Prevalidación de stock atómica considerando factores de empaque y decimales
    const stockRequeridoCredito = {};
    for (const item of carrito) {
        const factor = Number(item.factorStock || 1);
        const consumo = Number((Number(item.cantidad || 0) * factor).toFixed(4));
        stockRequeridoCredito[item.productoId] = (stockRequeridoCredito[item.productoId] || 0) + consumo;
    }

    for (const [prodId, req] of Object.entries(stockRequeridoCredito)) {
        const producto = (productos || []).find(p => p.id === prodId);
        if (!producto || req <= 0 || req > (Number(producto.stock || 0) + 0.0001)) {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Stock Insuficiente', `Stock insuficiente para ${producto?.nombre || 'el producto'}. Requerido: ${req}, disponible central: ${producto?.stock || 0}. Operación cancelada.`, 'warning');
            }
            cerrarModalConfirmacionCreditoPOS();
            return;
        }
    }

    // Débito atómico proporcional de inventario central
    for (const item of carrito) {
        const factor = Number(item.factorStock || 1);
        const cantADescontar = Number((Number(item.cantidad || 0) * factor).toFixed(4));
        InventoryApp.StockService.sale(item.productoId, cantADescontar);
    }

    const itemsVendidos = carrito.map(item => {
        const producto = (productos || []).find(p => p.id === item.productoId);
        const factor = Number(item.factorStock || 1);
        return { 
            ...item, 
            costo: Number(producto?.costo || item.costo || 0) * factor,
            stockDescontado: Number((Number(item.cantidad || 0) * factor).toFixed(4))
        };
    });

    const vendedor = AppState.usuarioActual || { cedula: 'SuperAdmin', nombre: 'SuperAdmin' };

    const nuevaVenta = {
        id: "V" + (ventas.length + 1) + "_" + Date.now().toString().slice(-4),
        turnoId: AppState.turnoActivo?.id || '',
        clienteId: clienteId,
        vendedorId: vendedor.cedula || vendedor.id || '',
        vendedorNombre: vendedor.nombre || '',
        fecha: new Date().toISOString().replace('T', ' ').substring(0, 16),
        items: itemsVendidos,
        total: total,
        tipo: 'Crédito',
        metodoDetalle: 'Crédito (Fiado)',
        referencia: 'Cuenta Corriente',
        estado: 'PENDIENTE',
        confirmada: false
    };

    ventas.push(nuevaVenta);

    // Actualizar cuenta corriente / deuda del cliente
    const clienteExistente = listaClientes.find(c => c.id === clienteId);
    if (clienteExistente) {
        if (typeof calcularEstadoFinancieroCliente === 'function') {
            const estFin = calcularEstadoFinancieroCliente(clienteExistente.id || clienteExistente);
            if (estFin) clienteExistente.deudaUSD = estFin.saldoDeudaUSD;
        } else {
            clienteExistente.deudaUSD = Number(clienteExistente.deudaUSD || 0) + total;
        }
        if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarCliente === 'function') {
            window.InventoryApp.Firebase.guardarCliente(clienteExistente).catch(() => {});
        }
    }

    // Sincronizar con Firebase Firestore
    if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.registrarVenta === 'function') {
        window.InventoryApp.Firebase.registrarVenta(nuevaVenta, itemsVendidos).catch(err => {
            console.warn('[POS] Error al registrar venta a crédito en Firestore:', err);
        });
    }

    // Notificación en Centro de Notificaciones
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
    const desktopSel = document.getElementById('pos-tipo-pago');
    const mobileSel = document.getElementById('pos-tipo-pago-mobile');
    if (desktopSel) desktopSel.value = 'Crédito';
    if (mobileSel) mobileSel.value = 'Crédito';
    sincronizarCondicionPago('pos-tipo-pago');
    cerrarModalConfirmacionCreditoPOS();
    cerrarDrawerCarritoMobile();
    renderizarCarrito();
    renderizarPosProductos();
    renderizarInventario();
    renderizarClientes();
    if (typeof actualizarSelectClientes === 'function') actualizarSelectClientes();
    if (typeof renderizarCustomClientePickersPOS === 'function') renderizarCustomClientePickersPOS('both');
    renderizarAuditoria(document.getElementById('auditoria-search') ? document.getElementById('auditoria-search').value : "");
    renderizarResumenPerdidasEconomicas();
    if (typeof renderizarHistorialVentasAdmin === 'function') renderizarHistorialVentasAdmin();
    if (typeof actualizarBadgeVentasHoy === 'function') actualizarBadgeVentasHoy();
    if (typeof renderizarNotificaciones === 'function') renderizarNotificaciones();
    if (typeof actualizarBadgesNotificaciones === 'function') actualizarBadgesNotificaciones();

    if (typeof showCustomToast === 'function') {
        showCustomToast(`¡Venta a Crédito #${nuevaVenta.id} registrada en cuenta de ${clienteObj.nombre}! ($${total.toFixed(2)})`, 'success');
    } else if (typeof showCustomAlert === 'function') {
        showCustomAlert('¡Crédito Registrado!', `La venta fue cargada a la cuenta de ${clienteObj.nombre} por $${total.toFixed(2)} USD.`, 'success');
    }
}

/**
 * Abre el Modal Unificado de Checkout para POS (Ventas al Contado)
 */
function abrirModalCheckoutPOS() {
    let modal = document.getElementById('modal-pos-checkout-unificado');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-pos-checkout-unificado';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    const clienteIdSelect = document.getElementById('pos-cliente-select') || document.getElementById('pos-cliente-select-mobile');
    const clienteId = clienteIdSelect ? clienteIdSelect.value : (clientes[0]?.id || 'V-00000000');
    const listaClientes = Array.isArray(clientes) ? clientes : (AppState.clientes || []);
    const clienteObj = listaClientes.find(c => c.id === clienteId) || { id: clienteId, nombre: 'Cliente de Mostrador' };

    const totalUSD = carrito.reduce((sum, i) => sum + (i.cantidad * i.precio), 0);
    const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 0);
    const totalVES = tasa > 0 ? (totalUSD * tasa) : 0;
    const ptsPorDolar = Number(AppState.premioMes?.puntosPorDolar || 1);
    const temporadaActiva = AppState.premioMes?.temporadaActiva !== false;
    const ptsEstimados = temporadaActiva ? Math.floor(totalUSD * ptsPorDolar) : 0;

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 520px; animation: modalPop 0.25s ease-out; border-radius:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid var(--border, #e2e8f0); padding-bottom:10px;">
                <h3 style="margin:0; font-size:1.25rem; display:flex; align-items:center; gap:8px; color:var(--text-main, #0f172a);">
                    <i class="fas fa-cash-register" style="color:var(--primary-accent, #2563eb);"></i> Confirmación de Cobro (Contado)
                </h3>
                <button type="button" class="btn-icon-tasa" onclick="cerrarModalCheckoutPOS()"><i class="fas fa-times"></i></button>
            </div>

            <!-- Resumen de Cliente y Montos -->
            <div style="background:var(--bg-canvas-subtle, #f8fafc); border:1px solid var(--border-color, #e2e8f0); border-radius:10px; padding:14px; margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                    <span style="color:var(--text-muted, #64748b); font-size:0.88rem;">Cliente Asignado:</span>
                    <strong>${clienteObj.nombre} (${clienteObj.id})</strong>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                    <span style="color:var(--text-muted, #64748b); font-size:0.88rem;">Total Artículos:</span>
                    <strong>${carrito.reduce((s, i) => s + i.cantidad, 0)} unidades</strong>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                    <span style="color:var(--text-muted, #64748b); font-size:0.88rem;">Total a Cobrar (USD):</span>
                    <strong style="color:var(--primary-accent, #2563eb); font-size:1.2rem;">$${totalUSD.toFixed(2)}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; border-top:1px dashed #cbd5e1; padding-top:6px;">
                    <span style="color:var(--text-muted, #64748b); font-size:0.88rem;">Total en Bolívares (VES):</span>
                    <strong style="color:#16a34a; font-size:1.1rem;">Bs. ${totalVES > 0 ? totalVES.toFixed(2) : '—'}</strong>
                </div>
                ${temporadaActiva ? `
                <div style="display:flex; justify-content:space-between; margin-top:6px; font-size:0.82rem; color:#d97706;">
                    <span><i class="fas fa-star"></i> Puntos Premio del Mes:</span>
                    <strong>+${ptsEstimados} Pts</strong>
                </div>` : ''}
            </div>

            <!-- Formulario de Cobro en Caja -->
            <form onsubmit="event.preventDefault(); ejecutarFinalizacionCheckoutPOS();">
                <div class="form-group" style="margin-bottom:12px;">
                    <label for="pos-checkout-metodo">Método de Pago <span style="color:var(--danger, #ef4444);">*</span></label>
                    <select id="pos-checkout-metodo" required onchange="manejarCambioMetodoPOS(this.value)">
                        <option value="Efectivo USD" selected>Efectivo ($ Dólares)</option>
                        <option value="Efectivo VES">Efectivo (Bs. Bolívares)</option>
                        <option value="Pago Móvil VES">Pago Móvil (Bolívares VES)</option>
                        <option value="Punto de Venta VES">Punto de Venta / Tarjeta (VES)</option>
                        <option value="Biopago BDV">Biopago BDV (Bolívares VES)</option>
                        <option value="Transferencia Bancaria VES">Transferencia Bancaria (Bolívares VES)</option>
                    </select>
                    <div style="text-align:right; margin-top:4px;">
                        <a href="javascript:void(0)" onclick="cambiarACreditoDesdeModal()" style="font-size:0.8rem; color:var(--primary-accent, #2563eb); text-decoration:underline;">
                            <i class="fas fa-file-invoice-dollar"></i> ¿Deseas fiar esta compra? Cambiar a Crédito
                        </a>
                    </div>
                </div>

                <div class="form-group" id="pos-checkout-grupo-ref" style="margin-bottom:12px;">
                    <label for="pos-checkout-referencia" id="pos-checkout-label-ref">
                        Referencia Bancaria <span id="pos-ref-required-mark" style="display:none; color:var(--danger, #ef4444);">*</span>
                    </label>
                    <input type="text" id="pos-checkout-referencia" placeholder="Opcional (Ej: Serial del billete o N/A)">
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
    if (inputRef) {
        inputRef.required = requiereRef;
        if (metodo.includes('Efectivo')) {
            inputRef.placeholder = 'Opcional (Ej: Serial o N/A para efectivo)';
        } else if (metodo.includes('Punto de Venta')) {
            inputRef.placeholder = 'Opcional (Ej: Últimos 4 dígitos del voucher)';
        } else {
            inputRef.placeholder = 'Ej: 894521 (Últimos 4-6 dígitos)';
        }
    }
}

function cerrarModalCheckoutPOS() {
    const modal = document.getElementById('modal-pos-checkout-unificado');
    if (modal) modal.classList.remove('active');
}

async function ejecutarFinalizacionCheckoutPOS() {
    const clienteIdSelect = document.getElementById('pos-cliente-select') || document.getElementById('pos-cliente-select-mobile');
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
    const listaClientes = Array.isArray(clientes) ? clientes : (AppState.clientes || []);
    const clienteObj = listaClientes.find(c => c.id === clienteId) || { id: clienteId, nombre: 'Cliente de Mostrador' };
    const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 0);
    const totalVES = tasa > 0 ? (total * tasa) : 0;

    // Prevalidación de stock atómica considerando factores de empaque y decimales
    const stockRequeridoContado = {};
    for (const item of carrito) {
        const factor = Number(item.factorStock || 1);
        const consumo = Number((Number(item.cantidad || 0) * factor).toFixed(4));
        stockRequeridoContado[item.productoId] = (stockRequeridoContado[item.productoId] || 0) + consumo;
    }

    for (const [prodId, req] of Object.entries(stockRequeridoContado)) {
        const producto = (productos || []).find(p => p.id === prodId);
        if (!producto || req <= 0 || req > (Number(producto.stock || 0) + 0.0001)) {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Stock Insuficiente', `Stock insuficiente para ${producto?.nombre || 'el producto'}. Requerido: ${req}, disponible central: ${producto?.stock || 0}. Operación cancelada.`, 'warning');
            }
            cerrarModalCheckoutPOS();
            return;
        }
    }

    // Débito atómico proporcional de inventario central
    for (const item of carrito) {
        const factor = Number(item.factorStock || 1);
        const cantADescontar = Number((Number(item.cantidad || 0) * factor).toFixed(4));
        InventoryApp.StockService.sale(item.productoId, cantADescontar);
    }

    const itemsVendidos = carrito.map(item => {
        const producto = (productos || []).find(p => p.id === item.productoId);
        const factor = Number(item.factorStock || 1);
        return { 
            ...item, 
            costo: Number(producto?.costo || item.costo || 0) * factor,
            stockDescontado: Number((Number(item.cantidad || 0) * factor).toFixed(4))
        };
    });

    const vendedor = AppState.usuarioActual || { cedula: 'SuperAdmin', nombre: 'SuperAdmin' };

    const nuevaVenta = {
        id: "V" + (ventas.length + 1) + "_" + Date.now().toString().slice(-4),
        turnoId: AppState.turnoActivo?.id || '',
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
            if (typeof calcularEstadoFinancieroCliente === 'function') {
                const estFin = calcularEstadoFinancieroCliente(clienteExistente.id || clienteExistente);
                if (estFin) clienteExistente.deudaUSD = estFin.saldoDeudaUSD;
            } else {
                clienteExistente.deudaUSD = Number(clienteExistente.deudaUSD || 0) + total;
            }
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
    const desktopSel = document.getElementById('pos-tipo-pago');
    const mobileSel = document.getElementById('pos-tipo-pago-mobile');
    if (desktopSel) desktopSel.value = 'Crédito';
    if (mobileSel) mobileSel.value = 'Crédito';
    sincronizarCondicionPago('pos-tipo-pago');
    cerrarModalCheckoutPOS();
    cerrarDrawerCarritoMobile();
    renderizarCarrito();
    renderizarPosProductos();
    renderizarInventario();
    renderizarClientes();
    if (typeof actualizarSelectClientes === 'function') actualizarSelectClientes();
    if (typeof renderizarCustomClientePickersPOS === 'function') renderizarCustomClientePickersPOS('both');
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
window.toggleMostrarAgotadosPOS = toggleMostrarAgotadosPOS;
window.limpiarBusquedaPOS = limpiarBusquedaPOS;
window.abrirDrawerCarritoMobile = abrirDrawerCarritoMobile;
window.cerrarDrawerCarritoMobile = cerrarDrawerCarritoMobile;
window.procesarVentaDesdeDrawer = procesarVentaDesdeDrawer;
window.sincronizarClienteSelects = sincronizarClienteSelects;
window.toggleMainNavTabs = toggleMainNavTabs;
window.procesarVenta = procesarVenta;
window.sincronizarCondicionPago = sincronizarCondicionPago;
window.abrirModalCheckoutPOS = abrirModalCheckoutPOS;
window.cerrarModalCheckoutPOS = cerrarModalCheckoutPOS;
window.abrirModalConfirmacionCreditoPOS = abrirModalConfirmacionCreditoPOS;
window.cerrarModalConfirmacionCreditoPOS = cerrarModalConfirmacionCreditoPOS;
window.ejecutarVentaCreditoDirecta = ejecutarVentaCreditoDirecta;
window.cambiarACreditoDesdeModal = cambiarACreditoDesdeModal;
window.cambiarAContadoDesdeModal = cambiarAContadoDesdeModal;
window.ejecutarFinalizacionCheckoutPOS = ejecutarFinalizacionCheckoutPOS;

// ============================================================================
// SELECTOR PERSONALIZADO DE CLIENTES EN CARRITO POS CON BARRA DE DESPLAZAMIENTO
// ============================================================================

/**
 * Renderiza el listado desplazable de clientes en los componentes personalizados (Desktop y Móvil)
 * Garantiza que la barra de desplazamiento vertical esté activa y delimita la altura para no tapar la pantalla.
 */
function renderizarCustomClientePickersPOS(tipo = 'both') {
    const targets = [];
    if (tipo === 'both' || tipo === 'desktop') {
        const desktopList = document.getElementById('pos-client-list-desktop');
        if (desktopList) targets.push({ container: desktopList, tipo: 'desktop' });
    }
    if (tipo === 'both' || tipo === 'mobile') {
        const mobileList = document.getElementById('pos-client-list-mobile');
        if (mobileList) targets.push({ container: mobileList, tipo: 'mobile' });
    }

    if (targets.length === 0) return;

    // Obtener lista completa de clientes (con fallback seguro a listas oficiales)
    let listaClientes = [];
    if (Array.isArray(window.clientes) && window.clientes.length > 0) {
        listaClientes = window.clientes;
    } else if (Array.isArray(window.AppState?.clientes) && window.AppState.clientes.length > 0) {
        listaClientes = window.AppState.clientes;
    } else if (typeof CLIENTES_OFICIALES !== 'undefined' && Array.isArray(CLIENTES_OFICIALES)) {
        listaClientes = CLIENTES_OFICIALES;
    }

    // Asegurar que Cliente de Mostrador esté presente como primera opción
    const tieneMostrador = listaClientes.some(c => c && (c.id === 'V-00000000' || (c.nombre && c.nombre.toLowerCase().includes('mostrador'))));
    const items = tieneMostrador 
        ? [...listaClientes] 
        : [{ id: 'V-00000000', nombre: 'Cliente de Mostrador', cedula: 'V-00000000', deudaUSD: 0 }, ...listaClientes];

    // Obtener cliente seleccionado actualmente en los selects ocultos
    const desktopSel = document.getElementById('pos-cliente-select');
    const mobileSel = document.getElementById('pos-cliente-select-mobile');
    const valorActual = (desktopSel && desktopSel.value) || (mobileSel && mobileSel.value) || items[0]?.id || 'V-00000000';

    targets.forEach(({ container, tipo: t }) => {
        const html = items.map(c => {
            if (!c) return '';
            const cId = c.id || c.cedula || 'CLI-000';
            const isSelected = String(cId) === String(valorActual);
            const avatarChar = c.nombre ? c.nombre.trim().charAt(0).toUpperCase() : 'C';

            // Obtener siempre la deuda real actual exacta (sincronizada al 100% con Clientes y Cuentas por Cobrar)
            let deudaUSD = 0;
            if (cId === 'V-00000000') {
                deudaUSD = 0;
            } else if (typeof calcularEstadoFinancieroCliente === 'function') {
                const estFin = calcularEstadoFinancieroCliente(c.id || c);
                deudaUSD = estFin && typeof estFin.saldoDeudaUSD === 'number' ? estFin.saldoDeudaUSD : Number(c.deudaUSD || 0);
                c.deudaUSD = deudaUSD;
            } else {
                deudaUSD = Number(c.deudaUSD || 0);
            }

            let badgeHtml = '';
            if (deudaUSD > 0) {
                badgeHtml = `<span class="pos-client-debt-tag" title="Deuda pendiente: $${deudaUSD.toFixed(2)} USD"><i class="fas fa-exclamation-circle"></i> Debe $${deudaUSD.toFixed(2)}</span>`;
            } else if (cId === 'V-00000000') {
                badgeHtml = `<span class="pos-client-clean-tag"><i class="fas fa-store"></i> Mostrador</span>`;
            } else {
                badgeHtml = `<span class="pos-client-clean-tag"><i class="fas fa-check"></i> Al día</span>`;
            }

            const searchKey = `${c.nombre || ''} ${c.id || ''} ${c.cedula || ''}`.toLowerCase();

            return `
                <div class="pos-client-item ${isSelected ? 'selected' : ''}" 
                     data-id="${cId}" 
                     data-search="${searchKey}" 
                     role="option" 
                     aria-selected="${isSelected ? 'true' : 'false'}"
                     onclick="seleccionarClientePOS('${cId}', '${t}')">
                    <div class="pos-client-item-left">
                        <div class="pos-client-item-avatar">${avatarChar}</div>
                        <div class="pos-client-item-details">
                            <span class="pos-client-item-name">${c.nombre || 'Sin nombre'}</span>
                            <span class="pos-client-item-meta">
                                <i class="fas fa-id-card"></i> ${c.cedula || c.id || 'V-00000000'}
                            </span>
                        </div>
                    </div>
                    <div class="pos-client-item-right">
                        ${badgeHtml}
                        ${isSelected ? '<i class="fas fa-check pos-client-check"></i>' : ''}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    });

    actualizarCustomClienteTriggerDisplay();
}

/**
 * Actualiza la información visual (Nombre, Avatar, Deuda) en el botón activador del selector
 */
function actualizarCustomClienteTriggerDisplay() {
    const desktopSel = document.getElementById('pos-cliente-select');
    const mobileSel = document.getElementById('pos-cliente-select-mobile');
    const valorActual = (desktopSel && desktopSel.value) || (mobileSel && mobileSel.value) || 'V-00000000';

    let listaClientes = [];
    if (Array.isArray(window.clientes) && window.clientes.length > 0) {
        listaClientes = window.clientes;
    } else if (Array.isArray(window.AppState?.clientes) && window.AppState.clientes.length > 0) {
        listaClientes = window.AppState.clientes;
    } else if (typeof CLIENTES_OFICIALES !== 'undefined' && Array.isArray(CLIENTES_OFICIALES)) {
        listaClientes = CLIENTES_OFICIALES;
    }

    const clienteObj = listaClientes.find(c => c && (String(c.id) === String(valorActual) || String(c.cedula) === String(valorActual))) || {
        id: valorActual,
        nombre: valorActual === 'V-00000000' ? 'Cliente de Mostrador' : 'Cliente Asignado',
        deudaUSD: 0
    };

    let deudaUSD = 0;
    if (clienteObj.id === 'V-00000000') {
        deudaUSD = 0;
    } else if (typeof calcularEstadoFinancieroCliente === 'function') {
        const estFin = calcularEstadoFinancieroCliente(clienteObj.id || clienteObj);
        deudaUSD = estFin && typeof estFin.saldoDeudaUSD === 'number' ? estFin.saldoDeudaUSD : Number(clienteObj.deudaUSD || 0);
        clienteObj.deudaUSD = deudaUSD;
    } else {
        deudaUSD = Number(clienteObj.deudaUSD || 0);
    }
    const avatarChar = clienteObj.nombre ? clienteObj.nombre.trim().charAt(0).toUpperCase() : 'C';

    ['desktop', 'mobile'].forEach(tipo => {
        const nameEl = document.getElementById(`pos-client-name-${tipo}`);
        const badgeEl = document.getElementById(`pos-client-badge-${tipo}`);
        const avatarEl = document.getElementById(`pos-client-avatar-${tipo}`);

        if (nameEl) nameEl.textContent = clienteObj.nombre || 'Cliente de Mostrador';
        if (avatarEl) avatarEl.textContent = avatarChar;

        if (badgeEl) {
            if (deudaUSD > 0) {
                badgeEl.innerHTML = `<span class="pos-client-debt-tag" style="padding:1px 6px; font-size:0.68rem;"><i class="fas fa-exclamation-circle"></i> Debe $${deudaUSD.toFixed(2)} USD</span>`;
            } else if (clienteObj.id === 'V-00000000') {
                badgeEl.textContent = 'Venta Contado (Sin cuenta de crédito)';
            } else {
                badgeEl.innerHTML = `<span class="pos-client-clean-tag" style="padding:1px 6px; font-size:0.68rem;"><i class="fas fa-check"></i> Al día ($0.00 deuda)</span>`;
            }
        }

        // Marcar visualmente el item seleccionado en la lista desplazable
        const listEl = document.getElementById(`pos-client-list-${tipo}`);
        if (listEl) {
            listEl.querySelectorAll('.pos-client-item').forEach(item => {
                const isSelected = item.getAttribute('data-id') === String(valorActual);
                item.classList.toggle('selected', isSelected);
                item.setAttribute('aria-selected', isSelected ? 'true' : 'false');
                const checkIcon = item.querySelector('.pos-client-check');
                if (isSelected && !checkIcon) {
                    const rightBox = item.querySelector('.pos-client-item-right');
                    if (rightBox) {
                        const icon = document.createElement('i');
                        icon.className = 'fas fa-check pos-client-check';
                        rightBox.appendChild(icon);
                    }
                } else if (!isSelected && checkIcon) {
                    checkIcon.remove();
                }
            });
        }
    });
}

/**
 * Abre o cierra el desplegable de clientes asegurando el foco y posicionamiento del scroll
 */
function toggleDropdownClientePOS(tipo) {
    const menu = document.getElementById(`pos-client-menu-${tipo}`);
    const trigger = document.getElementById(`pos-client-trigger-${tipo}`);
    if (!menu || !trigger) return;

    const estaAbierto = menu.classList.contains('open');

    // Cerrar cualquier otro selector antes de abrir
    cerrarDropdownClientePOS('all');

    if (!estaAbierto) {
        // Al desplegar el selector de clientes en el carrito, refrescar con las deudas actuales exactas en tiempo real
        renderizarCustomClientePickersPOS(tipo);

        menu.classList.add('open');
        trigger.classList.add('active');
        trigger.setAttribute('aria-expanded', 'true');

        // Limpiar buscador y resetear lista
        const searchInput = document.getElementById(`pos-client-search-${tipo}`);
        if (searchInput) {
            searchInput.value = '';
            filtrarClientesDropdownPOS('', tipo);
            setTimeout(() => searchInput.focus(), 60);
        }

        // Asegurar que el elemento seleccionado esté visible en la barra de scroll
        const scrollContainer = document.getElementById(`pos-client-list-${tipo}`);
        if (scrollContainer) {
            const activeItem = scrollContainer.querySelector('.pos-client-item.selected');
            if (activeItem) {
                setTimeout(() => {
                    activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }, 80);
            }
        }
    }
}

/**
 * Cierra el menú desplegable del selector
 */
function cerrarDropdownClientePOS(tipo = 'all') {
    const tipos = (tipo === 'all') ? ['desktop', 'mobile'] : [tipo];
    tipos.forEach(t => {
        const menu = document.getElementById(`pos-client-menu-${t}`);
        const trigger = document.getElementById(`pos-client-trigger-${t}`);
        if (menu) menu.classList.remove('open');
        if (trigger) {
            trigger.classList.remove('active');
            trigger.setAttribute('aria-expanded', 'false');
        }
    });
}

/**
 * Asigna un cliente al carrito POS y sincroniza ambos ambientes
 */
function seleccionarClientePOS(clienteId, tipo) {
    const desktopSel = document.getElementById('pos-cliente-select');
    const mobileSel = document.getElementById('pos-cliente-select-mobile');

    if (desktopSel) desktopSel.value = clienteId;
    if (mobileSel) mobileSel.value = clienteId;

    sincronizarClienteSelects('pos-cliente-select');

    if (desktopSel) {
        desktopSel.dispatchEvent(new Event('change', { bubbles: true }));
    }

    cerrarDropdownClientePOS('all');

    // Pequeño aviso amigable si se fió con cliente de mostrador
    const tipoPago = document.getElementById('pos-tipo-pago')?.value || document.getElementById('pos-tipo-pago-mobile')?.value;
    if (tipoPago === 'Crédito' && clienteId === 'V-00000000') {
        if (typeof showCustomToast === 'function') {
            showCustomToast('Para vender a Crédito debes asignar un cliente registrado.', 'warning');
        }
    }
}

/**
 * Filtra los clientes en tiempo real dentro de la lista con scrollbar
 */
function filtrarClientesDropdownPOS(texto, tipo) {
    const listEl = document.getElementById(`pos-client-list-${tipo}`);
    if (!listEl) return;

    const q = (texto || '').toLowerCase().trim();
    const items = listEl.querySelectorAll('.pos-client-item');
    let visibles = 0;

    items.forEach(item => {
        const searchData = item.getAttribute('data-search') || '';
        const match = !q || searchData.includes(q);
        item.style.display = match ? 'flex' : 'none';
        if (match) visibles++;
    });

    let emptyState = listEl.querySelector('.pos-client-empty');
    if (visibles === 0) {
        if (!emptyState) {
            emptyState = document.createElement('div');
            emptyState.className = 'pos-client-empty';
            emptyState.innerHTML = `
                <i class="fas fa-user-slash" style="font-size:1.5rem; margin-bottom:6px; display:block; color:var(--text-muted, #94a3b8);"></i>
                <span>No se encontró ningún cliente para "<strong>${texto}</strong>"</span>
            `;
            listEl.appendChild(emptyState);
        } else {
            emptyState.innerHTML = `
                <i class="fas fa-user-slash" style="font-size:1.5rem; margin-bottom:6px; display:block; color:var(--text-muted, #94a3b8);"></i>
                <span>No se encontró ningún cliente para "<strong>${texto}</strong>"</span>
            `;
            emptyState.style.display = 'block';
        }
    } else if (emptyState) {
        emptyState.style.display = 'none';
    }
}

/**
 * Limpia el campo de búsqueda del selector
 */
function limpiarBusquedaClienteDropdownPOS(tipo) {
    const searchInput = document.getElementById(`pos-client-search-${tipo}`);
    if (searchInput) {
        searchInput.value = '';
        filtrarClientesDropdownPOS('', tipo);
        searchInput.focus();
    }
}

// Escuchar clics fuera para cerrar desplegables
if (typeof document !== 'undefined') {
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.pos-custom-client-picker')) {
            cerrarDropdownClientePOS('all');
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            cerrarDropdownClientePOS('all');
        }
    });

    // Auto-inicialización
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            renderizarCustomClientePickersPOS('both');
            sincronizarCondicionPago('pos-tipo-pago');
        });
    } else {
        setTimeout(() => {
            renderizarCustomClientePickersPOS('both');
            sincronizarCondicionPago('pos-tipo-pago');
        }, 120);
    }
}

// Exportar globalmente los nuevos métodos interactivos
window.renderizarCustomClientePickersPOS = renderizarCustomClientePickersPOS;
window.actualizarCustomClienteTriggerDisplay = actualizarCustomClienteTriggerDisplay;
window.toggleDropdownClientePOS = toggleDropdownClientePOS;
window.cerrarDropdownClientePOS = cerrarDropdownClientePOS;
window.seleccionarClientePOS = seleccionarClientePOS;
window.filtrarClientesDropdownPOS = filtrarClientesDropdownPOS;
window.limpiarBusquedaClienteDropdownPOS = limpiarBusquedaClienteDropdownPOS;

// Métodos de Balanza Digital y Múltiples Empaques
window.abrirCalculadoraBalanzaPOS = abrirCalculadoraBalanzaPOS;
window.cerrarCalculadoraBalanzaPOS = cerrarCalculadoraBalanzaPOS;
window.cambiarModoBalanza = cambiarModoBalanza;
window.alCambiarPesoKg = alCambiarPesoKg;
window.alCambiarPesoGramos = alCambiarPesoGramos;
window.aplicarPresetPeso = aplicarPresetPeso;
window.alCambiarMontoDineroUSD = alCambiarMontoDineroUSD;
window.alCambiarMontoDineroVES = alCambiarMontoDineroVES;
window.confirmarAgregarBalanzaAlCarrito = confirmarAgregarBalanzaAlCarrito;
window.abrirModalSelectorPresentacionPOS = abrirModalSelectorPresentacionPOS;
window.cerrarModalSelectorPresentacionPOS = cerrarModalSelectorPresentacionPOS;
window.agregarAlCarritoConPresentacion = agregarAlCarritoConPresentacion;

// --- CLIENTES Y DEUDAS MULTIMONEDA ---
