// --- AUDITORÍA E INVENTARIO FÍSICO (CONTEO / TOMA DE INVENTARIO) ---

const CONTEOS_SESSION_STORAGE_KEY = 'bodeguita_conteos_sesion_v1';
const CONTEOS_LOCAL_BACKUP_KEY = 'bodeguita_conteos_respaldo_v1';

// Carga los conteos físicos temporales en memoria
function cargarConteosSesion() {
    // Purga proactiva para evitar residuos de inventario en almacenamiento del navegador
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(CONTEOS_LOCAL_BACKUP_KEY);
        }
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem(CONTEOS_SESSION_STORAGE_KEY);
        }
    } catch (e) {}
}

// Mantiene los conteos en memoria operativa (AppState / conteosFisicos)
function guardarConteosSesion() {
    // Los datos operativos y de auditoría se sincronizan exclusivamente con Firestore al aplicar el ajuste
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(CONTEOS_LOCAL_BACKUP_KEY);
        }
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem(CONTEOS_SESSION_STORAGE_KEY);
        }
    } catch (e) {}
}

// Si la toma actual está vacía pero ya existen auditorías registradas en el historial,
// pre-cargar el último stock físico registrado para dar continuidad inmediata al usuario.
function sincronizarConteosDesdeHistorialSiVacio() {
    if (Object.keys(conteosFisicos).length > 0) return;
    const listaAud = Array.isArray(AppState.auditorias) ? AppState.auditorias : (typeof auditorias !== 'undefined' ? auditorias : []);
    if (!listaAud || listaAud.length === 0) return;

    let cargados = 0;
    // Recorrer cronológicamente para que el último prevalezca
    listaAud.forEach(a => {
        if (a.productoId && a.stockFisico !== undefined && a.stockFisico !== null) {
            conteosFisicos[a.productoId] = Number(a.stockFisico);
            cargados++;
        }
    });

    if (cargados > 0) {
        guardarConteosSesion();
    }
}

// Inicializar en carga
cargarConteosSesion();
sincronizarConteosDesdeHistorialSiVacio();

// Calcula la diferencia (Físico - Digital) para un producto.
// Devuelve null si el producto todavía no tiene un conteo físico capturado.
function calcularDiferenciaAuditoria(productoId) {
    const prods = Array.isArray(productos) ? productos : (AppState.productos || []);
    const p = prods.find(prod => prod.id === productoId);
    if (!p) return null;

    const fisico = conteosFisicos[productoId];
    if (fisico === undefined || fisico === null || fisico === '') return null;

    return Number(fisico) - Number(p.stock || 0);
}

// Renderiza (o re-renderiza) la tabla de conteo de auditoría, opcionalmente filtrada.
function renderizarAuditoria(filtro = "") {
    const tbody = document.getElementById('auditoria-body');
    const mobileList = document.getElementById('auditoria-mobile-list');
    if (!tbody && !mobileList) return;

    if (typeof inicializarSesionConteoActual === 'function') {
        inicializarSesionConteoActual();
    }
    if (typeof renderizarHistorialSesionesConteo === 'function') {
        renderizarHistorialSesionesConteo();
    }

    // Asegurar conteos de sesión
    if (Object.keys(conteosFisicos).length === 0) {
        cargarConteosSesion();
        sincronizarConteosDesdeHistorialSiVacio();
    }

    const prods = Array.isArray(productos) ? productos : (AppState.productos || []);
    const filtrados = prods.filter(p =>
        (p.nombre || '').toLowerCase().includes(filtro.toLowerCase()) ||
        (p.codigo || '').toLowerCase().includes(filtro.toLowerCase())
    );

    if (tbody) {
        tbody.innerHTML = filtrados.map(p => {
            const tieneConteo = conteosFisicos.hasOwnProperty(p.id) && conteosFisicos[p.id] !== '' && conteosFisicos[p.id] !== null;
            const valorFisico = tieneConteo ? conteosFisicos[p.id] : '';
            const diferencia = tieneConteo ? (Number(conteosFisicos[p.id]) - Number(p.stock || 0)) : null;

            let difHtml = '<span class="audit-diff-badge empty">—</span>';
            let estadoHtml = '<span class="audit-status-pill conforme" style="opacity:0.75;">Sin Conteo</span>';
            let inputClass = 'audit-physical-input reactive-neutral';
            let btnDisabled = true;
            let btnText = '<i class="fas fa-check"></i> <span>Aplicar</span>';
            let btnStyle = '';

            if (diferencia !== null) {
                if (diferencia > 0) {
                    difHtml = `<span class="audit-diff-badge surplus">+${diferencia}</span>`;
                    estadoHtml = '<span class="audit-status-pill pending"><i class="fas fa-arrow-trend-up" style="margin-right:3px;"></i> Sobrante</span>';
                    inputClass = 'audit-physical-input reactive-surplus';
                    btnDisabled = false;
                    btnText = '<i class="fas fa-rotate"></i> <span>Ajustar</span>';
                } else if (diferencia < 0) {
                    difHtml = `<span class="audit-diff-badge deficit">${diferencia}</span>`;
                    estadoHtml = '<span class="audit-status-pill pending"><i class="fas fa-triangle-exclamation" style="margin-right:3px;"></i> Faltante</span>';
                    inputClass = 'audit-physical-input reactive-deficit';
                    btnDisabled = false;
                    btnText = '<i class="fas fa-triangle-exclamation"></i> <span>Ajustar</span>';
                } else {
                    difHtml = '<span class="audit-diff-badge match">0</span>';
                    estadoHtml = '<span class="audit-status-pill conforme"><i class="fas fa-check-circle" style="margin-right:3px;"></i> Conforme</span>';
                    inputClass = 'audit-physical-input reactive-match';
                    btnDisabled = true;
                    btnText = '<i class="fas fa-check-double"></i> <span>Al día</span>';
                    btnStyle = 'opacity:0.6; cursor:default;';
                }
            }

            return `
                <tr>
                    <td><span class="audit-badge-code">${p.codigo}</span></td>
                    <td>
                        <div class="audit-product-cell">
                            <div class="audit-thumb-wrap">
                                ${p.imagen ? `<img src="${p.imagen}" alt="${p.nombre}" class="audit-thumb-img">` : `<i class="fas fa-image"></i>`}
                            </div>
                            <div class="audit-product-details">
                                <span class="audit-product-name">${p.nombre}</span>
                                <span class="audit-product-sub">Costo: $${Number(p.costo || 0).toFixed(2)} · Precio: $${Number(p.precio || 0).toFixed(2)}</span>
                            </div>
                        </div>
                    </td>
                    <td class="text-center"><span class="audit-digital-stock-badge">${p.stock}</span></td>
                    <td class="text-center">
                        <input type="number" min="0" step="1" class="${inputClass}"
                            id="auditoria-input-${p.id}"
                            value="${valorFisico}"
                            placeholder="—"
                            oninput="actualizarConteoFisico('${p.id}', this.value)">
                    </td>
                    <td class="text-center" id="auditoria-dif-${p.id}">${difHtml}</td>
                    <td class="text-center" id="auditoria-estado-${p.id}">${estadoHtml}</td>
                    <td class="text-right">
                        <button class="audit-btn-apply-row" id="auditoria-btn-${p.id}" onclick="aplicarAjusteInventario('${p.id}')" ${btnDisabled ? 'disabled' : ''} style="${btnStyle}">
                            ${btnText}
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    if (mobileList) {
        if (filtrados.length === 0) {
            mobileList.innerHTML = '<div class="card" style="text-align:center; padding:30px 16px; color:var(--text-muted);"><i class="fas fa-box-open" style="font-size:2rem; opacity:0.4; margin-bottom:8px; display:block;"></i>No se encontraron productos en auditoría.</div>';
        } else {
            mobileList.innerHTML = filtrados.map(p => {
                const tieneConteo = conteosFisicos.hasOwnProperty(p.id) && conteosFisicos[p.id] !== '' && conteosFisicos[p.id] !== null;
                const valorFisico = tieneConteo ? conteosFisicos[p.id] : '';
                const diferencia = tieneConteo ? (Number(conteosFisicos[p.id]) - Number(p.stock || 0)) : null;

                let difHtml = '<span class="audit-diff-badge empty">—</span>';
                let estadoHtml = '<span class="audit-status-pill conforme" style="opacity:0.75;">Sin Conteo</span>';
                let inputClass = 'audit-physical-input reactive-neutral';
                let btnDisabled = true;
                let btnText = '<i class="fas fa-check"></i> <span>Aplicar</span>';
                let btnStyle = '';

                if (diferencia !== null) {
                    if (diferencia > 0) {
                        difHtml = `<span class="audit-diff-badge surplus">+${diferencia}</span>`;
                        estadoHtml = '<span class="audit-status-pill pending"><i class="fas fa-arrow-trend-up" style="margin-right:3px;"></i> Sobrante</span>';
                        inputClass = 'audit-physical-input reactive-surplus';
                        btnDisabled = false;
                        btnText = '<i class="fas fa-rotate"></i> <span>Ajustar</span>';
                    } else if (diferencia < 0) {
                        difHtml = `<span class="audit-diff-badge deficit">${diferencia}</span>`;
                        estadoHtml = '<span class="audit-status-pill pending"><i class="fas fa-triangle-exclamation" style="margin-right:3px;"></i> Faltante</span>';
                        inputClass = 'audit-physical-input reactive-deficit';
                        btnDisabled = false;
                        btnText = '<i class="fas fa-triangle-exclamation"></i> <span>Ajustar</span>';
                    } else {
                        difHtml = '<span class="audit-diff-badge match">0</span>';
                        estadoHtml = '<span class="audit-status-pill conforme"><i class="fas fa-check-circle" style="margin-right:3px;"></i> Conforme</span>';
                        inputClass = 'audit-physical-input reactive-match';
                        btnDisabled = true;
                        btnText = '<i class="fas fa-check-double"></i> <span>Al día</span>';
                        btnStyle = 'opacity:0.6; cursor:default;';
                    }
                }

                return `
                    <div class="auditoria-item-card">
                        <div class="auditoria-item-top">
                            <div class="auditoria-item-img-wrap">
                                ${p.imagen ? `<img src="${p.imagen}" alt="${p.nombre}" class="auditoria-item-img">` : `<div class="auditoria-item-noimg"><i class="fas fa-image"></i></div>`}
                            </div>
                            <div class="auditoria-item-info">
                                <div class="auditoria-item-title-row">
                                    <span class="auditoria-item-name">${p.nombre}</span>
                                    <span class="audit-badge-code">${p.codigo}</span>
                                </div>
                                <div class="auditoria-item-sub">
                                    <span>Costo: $${Number(p.costo || 0).toFixed(2)}</span>
                                    <span>· Precio: $${Number(p.precio || 0).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        <div class="auditoria-item-middle">
                            <div class="auditoria-stock-badge digital">
                                <span class="lbl">Stock Digital</span>
                                <span class="val">${p.stock}</span>
                            </div>
                            <div class="auditoria-stock-badge physical">
                                <label class="lbl" for="auditoria-mob-input-${p.id}">Conteo Físico</label>
                                <input type="number" min="0" step="1" class="${inputClass}"
                                    id="auditoria-mob-input-${p.id}"
                                    value="${valorFisico}"
                                    placeholder="—"
                                    oninput="actualizarConteoFisico('${p.id}', this.value); if(document.getElementById('auditoria-input-${p.id}')) document.getElementById('auditoria-input-${p.id}').value = this.value;">
                            </div>
                            <div class="auditoria-stock-badge diff" id="auditoria-mob-dif-${p.id}">
                                ${difHtml}
                            </div>
                        </div>

                        <div class="auditoria-item-bottom">
                            <div id="auditoria-mob-estado-${p.id}">${estadoHtml}</div>
                            <button class="audit-btn-apply-row" id="auditoria-mob-btn-${p.id}" onclick="aplicarAjusteInventario('${p.id}')" ${btnDisabled ? 'disabled' : ''} style="${btnStyle}">
                                ${btnText}
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    actualizarResumenAuditoria();
}

function filtrarAuditoria() {
    renderizarAuditoria(document.getElementById('auditoria-search')?.value || "");
}

// Se dispara cuando el usuario captura/edita la cantidad física de un producto.
// Actualiza solo la fila afectada (no re-renderiza toda la tabla) para no perder el foco del input.
function actualizarConteoFisico(productoId, valor) {
    const trimmed = String(valor ?? '').trim();
    if (trimmed === '') {
        delete conteosFisicos[productoId];
    } else {
        const parsed = parseInt(trimmed, 10);
        if (isNaN(parsed) || parsed < 0) {
            delete conteosFisicos[productoId];
        } else {
            conteosFisicos[productoId] = parsed;
        }
    }

    guardarConteosSesion();
    actualizarFilaAuditoria(productoId);
    actualizarResumenAuditoria();
    if (typeof renderizarResumenPerdidasEconomicas === 'function') {
        renderizarResumenPerdidasEconomicas();
    }
}

// Compara en tiempo real el Stock Físico contra el Stock Digital y actualiza
// la celda de diferencia, el badge de estado y habilita/deshabilita el botón de ajuste.
function actualizarFilaAuditoria(productoId) {
    const difCell = document.getElementById(`auditoria-dif-${productoId}`);
    const estadoCell = document.getElementById(`auditoria-estado-${productoId}`);
    const btnAjuste = document.getElementById(`auditoria-btn-${productoId}`);
    const inputFisico = document.getElementById(`auditoria-input-${productoId}`);

    const mobDifCell = document.getElementById(`auditoria-mob-dif-${productoId}`);
    const mobEstadoCell = document.getElementById(`auditoria-mob-estado-${productoId}`);
    const mobBtnAjuste = document.getElementById(`auditoria-mob-btn-${productoId}`);
    const mobInputFisico = document.getElementById(`auditoria-mob-input-${productoId}`);

    const diferencia = calcularDiferenciaAuditoria(productoId);

    if (diferencia === null) {
        if (difCell) difCell.innerHTML = '<span class="audit-diff-badge empty">—</span>';
        if (estadoCell) estadoCell.innerHTML = '<span class="audit-status-pill conforme" style="opacity:0.75;">Sin Conteo</span>';
        if (btnAjuste) {
            btnAjuste.disabled = true;
            btnAjuste.style.opacity = '';
            btnAjuste.style.cursor = '';
            btnAjuste.innerHTML = '<i class="fas fa-check"></i> <span>Aplicar</span>';
        }
        if (inputFisico) inputFisico.className = 'audit-physical-input reactive-neutral';

        if (mobDifCell) mobDifCell.innerHTML = '<span class="audit-diff-badge empty">—</span>';
        if (mobEstadoCell) mobEstadoCell.innerHTML = '<span class="audit-status-pill conforme" style="opacity:0.75;">Sin Conteo</span>';
        if (mobBtnAjuste) {
            mobBtnAjuste.disabled = true;
            mobBtnAjuste.style.opacity = '';
            mobBtnAjuste.style.cursor = '';
            mobBtnAjuste.innerHTML = '<i class="fas fa-check"></i> <span>Aplicar</span>';
        }
        if (mobInputFisico) mobInputFisico.className = 'audit-physical-input reactive-neutral';
        return;
    }

    if (diferencia > 0) {
        const difHtml = `<span class="audit-diff-badge surplus">+${diferencia}</span>`;
        const estHtml = '<span class="audit-status-pill pending"><i class="fas fa-arrow-trend-up" style="margin-right:3px;"></i> Sobrante</span>';
        if (difCell) difCell.innerHTML = difHtml;
        if (estadoCell) estadoCell.innerHTML = estHtml;
        if (inputFisico) inputFisico.className = 'audit-physical-input reactive-surplus';
        if (btnAjuste) {
            btnAjuste.disabled = false;
            btnAjuste.style.opacity = '1';
            btnAjuste.style.cursor = 'pointer';
            btnAjuste.innerHTML = '<i class="fas fa-rotate"></i> <span>Ajustar</span>';
        }

        if (mobDifCell) mobDifCell.innerHTML = difHtml;
        if (mobEstadoCell) mobEstadoCell.innerHTML = estHtml;
        if (mobInputFisico) mobInputFisico.className = 'audit-physical-input reactive-surplus';
        if (mobBtnAjuste) {
            mobBtnAjuste.disabled = false;
            mobBtnAjuste.style.opacity = '1';
            mobBtnAjuste.style.cursor = 'pointer';
            mobBtnAjuste.innerHTML = '<i class="fas fa-rotate"></i> <span>Ajustar</span>';
        }
    } else if (diferencia < 0) {
        const difHtml = `<span class="audit-diff-badge deficit">${diferencia}</span>`;
        const estHtml = '<span class="audit-status-pill pending"><i class="fas fa-triangle-exclamation" style="margin-right:3px;"></i> Faltante</span>';
        if (difCell) difCell.innerHTML = difHtml;
        if (estadoCell) estadoCell.innerHTML = estHtml;
        if (inputFisico) inputFisico.className = 'audit-physical-input reactive-deficit';
        if (btnAjuste) {
            btnAjuste.disabled = false;
            btnAjuste.style.opacity = '1';
            btnAjuste.style.cursor = 'pointer';
            btnAjuste.innerHTML = '<i class="fas fa-triangle-exclamation"></i> <span>Ajustar</span>';
        }

        if (mobDifCell) mobDifCell.innerHTML = difHtml;
        if (mobEstadoCell) mobEstadoCell.innerHTML = estHtml;
        if (mobInputFisico) mobInputFisico.className = 'audit-physical-input reactive-deficit';
        if (mobBtnAjuste) {
            mobBtnAjuste.disabled = false;
            mobBtnAjuste.style.opacity = '1';
            mobBtnAjuste.style.cursor = 'pointer';
            mobBtnAjuste.innerHTML = '<i class="fas fa-triangle-exclamation"></i> <span>Ajustar</span>';
        }
    } else {
        const difHtml = '<span class="audit-diff-badge match">0</span>';
        const estHtml = '<span class="audit-status-pill conforme"><i class="fas fa-check-circle" style="margin-right:3px;"></i> Conforme</span>';
        if (difCell) difCell.innerHTML = difHtml;
        if (estadoCell) estadoCell.innerHTML = estHtml;
        if (inputFisico) inputFisico.className = 'audit-physical-input reactive-match';
        if (btnAjuste) {
            btnAjuste.disabled = true;
            btnAjuste.style.opacity = '0.6';
            btnAjuste.style.cursor = 'default';
            btnAjuste.innerHTML = '<i class="fas fa-check-double"></i> <span>Al día</span>';
        }

        if (mobDifCell) mobDifCell.innerHTML = difHtml;
        if (mobEstadoCell) mobEstadoCell.innerHTML = estHtml;
        if (mobInputFisico) mobInputFisico.className = 'audit-physical-input reactive-match';
        if (mobBtnAjuste) {
            mobBtnAjuste.disabled = true;
            mobBtnAjuste.style.opacity = '0.6';
            mobBtnAjuste.style.cursor = 'default';
            mobBtnAjuste.innerHTML = '<i class="fas fa-check-double"></i> <span>Al día</span>';
        }
    }
}

// Actualiza los KPIs resumen (contados / sobrantes / faltantes / conformes) según los conteos físicos.
function actualizarResumenAuditoria() {
    const kpiContados = document.getElementById('auditoria-kpi-contados');
    if (!kpiContados) return;

    const prods = Array.isArray(productos) ? productos : (AppState.productos || []);
    const totalProductosCatalogo = prods.length;

    let totalContados = 0;
    let sobrantesProductos = 0;
    let sobrantesUnidades = 0;
    let faltantesProductos = 0;
    let faltantesUnidades = 0;
    let conformes = 0;

    prods.forEach(p => {
        if (conteosFisicos.hasOwnProperty(p.id) && conteosFisicos[p.id] !== '' && conteosFisicos[p.id] !== null) {
            totalContados++;
            const fisico = Number(conteosFisicos[p.id]);
            const digital = Number(p.stock || 0);
            const dif = fisico - digital;
            if (dif > 0) {
                sobrantesProductos++;
                sobrantesUnidades += dif;
            } else if (dif < 0) {
                faltantesProductos++;
                faltantesUnidades += Math.abs(dif);
            } else {
                conformes++;
            }
        }
    });

    kpiContados.textContent = totalContados;

    // Subtexto interactivo explicativo para feedback en tiempo real
    const cardContados = document.getElementById('kpi-card-contados');
    if (cardContados) {
        const subtextEl = cardContados.querySelector('.audit-kpi-subtext');
        if (subtextEl) {
            subtextEl.textContent = totalContados > 0 
                ? `${totalContados} de ${totalProductosCatalogo} productos al día`
                : 'Inventario físico registrado';
        }
    }

    const elSobrantes = document.getElementById('auditoria-kpi-sobrantes');
    if (elSobrantes) {
        elSobrantes.textContent = sobrantesUnidades > 0 ? `+${sobrantesUnidades}` : '0';
    }
    const cardSobrantes = document.getElementById('kpi-card-sobrantes');
    if (cardSobrantes) {
        const subtextEl = cardSobrantes.querySelector('.audit-kpi-subtext');
        if (subtextEl) {
            subtextEl.textContent = sobrantesUnidades > 0 
                ? `${sobrantesUnidades} unds en ${sobrantesProductos} producto${sobrantesProductos !== 1 ? 's' : ''}`
                : 'Físico mayor al digital';
        }
    }

    const elFaltantes = document.getElementById('auditoria-kpi-faltantes');
    if (elFaltantes) {
        elFaltantes.textContent = faltantesUnidades > 0 ? `-${faltantesUnidades}` : '0';
    }
    const cardFaltantes = document.getElementById('kpi-card-faltantes');
    if (cardFaltantes) {
        const subtextEl = cardFaltantes.querySelector('.audit-kpi-subtext');
        if (subtextEl) {
            subtextEl.textContent = faltantesUnidades > 0 
                ? `${faltantesUnidades} unds en ${faltantesProductos} producto${faltantesProductos !== 1 ? 's' : ''}`
                : 'Requiere ajuste contable';
        }
    }

    const elConformes = document.getElementById('auditoria-kpi-conformes');
    if (elConformes) elConformes.textContent = conformes;
    const cardConformes = document.getElementById('kpi-card-conformes');
    if (cardConformes) {
        const subtextEl = cardConformes.querySelector('.audit-kpi-subtext');
        if (subtextEl) {
            subtextEl.textContent = conformes > 0 
                ? `${conformes} producto${conformes !== 1 ? 's' : ''} sin diferencias`
                : 'Coincidencia 100% precisa';
        }
    }

    const btnApplyAll = document.getElementById('btn-aplicar-todos-ajustes');
    if (btnApplyAll) {
        const discrepancias = sobrantesProductos + faltantesProductos;
        btnApplyAll.disabled = discrepancias === 0;
        const spanText = btnApplyAll.querySelector('span');
        if (spanText) {
            spanText.textContent = discrepancias > 0 
                ? `Aplicar ${discrepancias} Ajuste(s)` 
                : 'Sin Ajustes Pendientes';
        }
    }
}

// Permite buscar/"escanear" un producto por código exacto desde el campo dedicado
// y llevar al usuario directo al input de conteo físico de ese producto.
// Normaliza un código para que pueda encontrarse por su parte numérica.
// Ejemplos: 1, 01, 001, PROD-1, PROD-01 y PROD-001 -> PROD-001.
function buscarProductoPorCodigoFlexible(valor) {
    const entrada = String(valor || '').trim();
    if (!entrada) return null;

    const entradaNormalizada = entrada.toUpperCase().replace(/\s+/g, '');

    // 1) Primero intentamos coincidencia exacta con el código real.
    let encontrados = productos.filter(p =>
        String(p.codigo || '').trim().toUpperCase() === entradaNormalizada
    );
    if (encontrados.length === 1) return encontrados[0];
    if (encontrados.length > 1) return encontrados[0];

    // 2) Si escribieron solamente números (1, 01, 001), usamos el
    //    número final del código del producto, ignorando los ceros a la izquierda.
    const numeroEntrada = entradaNormalizada.match(/^\d+$/);
    if (numeroEntrada) {
        const numeroBuscado = parseInt(numeroEntrada[0], 10);
        encontrados = productos.filter(p => {
            const match = String(p.codigo || '').toUpperCase().match(/(\d+)$/);
            return match && parseInt(match[1], 10) === numeroBuscado;
        });
    } else {
        // 3) También permitimos PROD-1 / PROD-01 / PROD-001:
        //    comparamos el prefijo y el número final.
        const matchEntrada = entradaNormalizada.match(/^(.*?)(\d+)$/);
        if (matchEntrada) {
            const prefijoEntrada = matchEntrada[1].replace(/[-_\s]+$/, '');
            const numeroBuscado = parseInt(matchEntrada[2], 10);

            encontrados = productos.filter(p => {
                const codigoProducto = String(p.codigo || '').toUpperCase().replace(/\s+/g, '');
                const matchProducto = codigoProducto.match(/^(.*?)(\d+)$/);
                if (!matchProducto) return false;

                const prefijoProducto = matchProducto[1].replace(/[-_\s]+$/, '');
                return prefijoProducto === prefijoEntrada &&
                    parseInt(matchProducto[2], 10) === numeroBuscado;
            });
        }
    }

    return encontrados.length === 1 ? encontrados[0] : null;
}

function escanearProductoAuditoria(event) {
    if (event.key !== 'Enter') return;

    const scanInput = document.getElementById('auditoria-scan');
    const codigo = scanInput.value.trim();
    if (!codigo) return;

    const p = buscarProductoPorCodigoFlexible(codigo);
    if (!p) {
        alert(`No se encontró un producto asociado al código "${codigo}".\\n\\nPuedes usar, por ejemplo: 1, 01, 001 o PROD-001.`);
        return;
    }

    // Limpia el filtro de texto para asegurar que el producto sea visible en la tabla.
    const searchInput = document.getElementById('auditoria-search');
    if (searchInput) searchInput.value = '';
    renderizarAuditoria();

    const inputFisico = document.getElementById(`auditoria-input-${p.id}`);
    if (inputFisico) {
        inputFisico.scrollIntoView({ behavior: 'smooth', block: 'center' });
        inputFisico.focus();
    }

    // Dejamos el campo listo para el siguiente escaneo.
    scanInput.value = '';
}

// Variable global para el ajuste de auditoría en curso
let productoAjusteAuditoriaActual = null;

// Abre el modal de conciliación de discrepancia de auditoría física
function abrirModalAjusteAuditoria(productoId) {
    const prods = Array.isArray(productos) ? productos : (AppState.productos || []);
    const p = prods.find(prod => prod.id === productoId);
    if (!p) return;

    const diferencia = calcularDiferenciaAuditoria(productoId);
    if (diferencia === null) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Conteo Requerido', 'Ingresa el conteo físico antes de aplicar el ajuste.', 'warning');
        } else {
            alert('Ingresa el conteo físico antes de aplicar el ajuste.');
        }
        return;
    }

    if (diferencia === 0) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Inventario Conforme', `El conteo físico de "${p.nombre}" coincide exactamente con el stock del sistema (${p.stock} unds). No se requiere ajuste.`, 'info');
        } else {
            alert('El conteo físico coincide con el stock digital.');
        }
        return;
    }

    productoAjusteAuditoriaActual = {
        producto: p,
        diferencia: diferencia,
        stockFisico: Number(conteosFisicos[productoId] || 0),
        stockAnterior: Number(p.stock || 0)
    };

    const modal = document.getElementById('modal-ajuste-auditoria');
    if (!modal) {
        // Fallback rápido si el elemento modal no estuviera en DOM
        return aplicarAjusteInventarioLegacy(productoId);
    }

    // Datos del producto
    const imgEl = document.getElementById('audit-modal-prod-img');
    if (imgEl) imgEl.src = p.imagen || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&auto=format&fit=crop&q=60';

    const nombreEl = document.getElementById('audit-modal-prod-nombre');
    if (nombreEl) nombreEl.textContent = p.nombre;

    const codEl = document.getElementById('audit-modal-prod-codigo');
    if (codEl) codEl.textContent = `${p.codigo || p.id}`;

    const digitalEl = document.getElementById('audit-modal-stock-digital');
    if (digitalEl) digitalEl.textContent = `${p.stock} unds`;

    const fisicoEl = document.getElementById('audit-modal-stock-fisico');
    if (fisicoEl) fisicoEl.textContent = `${productoAjusteAuditoriaActual.stockFisico} unds`;

    const difEl = document.getElementById('audit-modal-diferencia');
    if (difEl) {
        if (diferencia > 0) {
            difEl.innerHTML = `<span style="color:#16a34a; font-weight:800; font-size:1.1rem;"><i class="fas fa-arrow-trend-up"></i> +${diferencia} unds (Sobrante)</span>`;
        } else {
            difEl.innerHTML = `<span style="color:#dc2626; font-weight:800; font-size:1.1rem;"><i class="fas fa-triangle-exclamation"></i> ${diferencia} unds (Faltante)</span>`;
        }
    }

    // Informar inmutabilidad de precios
    const preciosEl = document.getElementById('audit-modal-precios-inmutables');
    if (preciosEl) {
        preciosEl.innerHTML = `
            <div style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:8px; padding:8px 12px; font-size:0.8rem; color:#475569; display:flex; align-items:center; gap:8px;">
                <i class="fas fa-lock" style="color:#0284c7;"></i>
                <span>Precios Base Inmutables: Costo <strong>$${Number(p.costo || 0).toFixed(2)}</strong> · PVP <strong>$${Number(p.precio || 0).toFixed(2)}</strong> (Permanecen intactos)</span>
            </div>
        `;
    }

    // Contenedor de Motivos Dinámicos según sea Sobrante o Faltante
    const motivosContainer = document.getElementById('audit-modal-motivos-list');
    if (motivosContainer) {
        if (diferencia > 0) {
            // SOBRANTE (Físico > Sistema)
            motivosContainer.innerHTML = `
                <div style="font-weight:700; font-size:0.92rem; color:#166534; margin-bottom:10px; display:flex; align-items:center; gap:8px;">
                    <i class="fas fa-arrow-trend-up"></i> Selecciona el motivo del SOBRANTE: <span style="color:var(--danger)">*</span>
                </div>

                <div role="button" tabindex="0" class="audit-modal-reason-card is-selected-sobrante" onclick="alSeleccionarMotivoAuditoria(this, 'Error de conteo previo', 'sobrante')" onkeydown="if(event.key==='Enter'||event.key===' '){alSeleccionarMotivoAuditoria(this, 'Error de conteo previo', 'sobrante'); event.preventDefault();}">
                    <div class="audit-reason-radio-indicator">
                        <i class="fas fa-check"></i>
                    </div>
                    <div class="audit-reason-badge-icon">
                        <i class="fas fa-clipboard-check"></i>
                    </div>
                    <div class="audit-reason-text-wrap">
                        <strong class="audit-reason-title">a) Error de conteo previo</strong>
                        <span class="audit-reason-desc">
                            Solo ajusta el número de existencias físicas en el sistema sin solicitar costos ni alterar precios base.
                        </span>
                    </div>
                    <input type="radio" name="audit-motivo-seleccionado" value="Error de conteo previo" checked style="display:none;">
                </div>

                <div role="button" tabindex="0" class="audit-modal-reason-card" onclick="alSeleccionarMotivoAuditoria(this, 'Mercancía no registrada / Compra no ingresada', 'sobrante')" onkeydown="if(event.key==='Enter'||event.key===' '){alSeleccionarMotivoAuditoria(this, 'Mercancía no registrada / Compra no ingresada', 'sobrante'); event.preventDefault();}">
                    <div class="audit-reason-radio-indicator">
                        <i class="fas fa-check"></i>
                    </div>
                    <div class="audit-reason-badge-icon">
                        <i class="fas fa-boxes-stacked"></i>
                    </div>
                    <div class="audit-reason-text-wrap">
                        <strong class="audit-reason-title">b) Mercancía no registrada / Compra no ingresada</strong>
                        <span class="audit-reason-desc">
                            Mercancía física encontrada en almacén no documentada previamente.
                        </span>
                    </div>
                    <input type="radio" name="audit-motivo-seleccionado" value="Mercancía no registrada / Compra no ingresada" style="display:none;">
                </div>

                <!-- ⚠️ ADVERTENCIA OBLIGATORIA SOBRE COMPRAS Y FACTURAS -->
                <div id="audit-warning-compra-factura" style="background:#fffbeb; border:1px solid #fde68a; border-radius:12px; padding:12px 14px; margin-top:12px;">
                    <div style="display:flex; align-items:flex-start; gap:10px;">
                        <i class="fas fa-triangle-exclamation" style="color:#d97706; font-size:1.2rem; margin-top:2px;"></i>
                        <div style="flex:1;">
                            <strong style="color:#92400e; font-size:0.85rem; display:block; margin-bottom:4px;">
                                ⚠️ Atención sobre Costos y Reposición:
                            </strong>
                            <p style="margin:0 0 8px 0; font-size:0.82rem; color:#78350f; line-height:1.4;">
                                Si este sobrante corresponde a <strong>mercancía nueva recibida de un proveedor</strong>, debe ingresarse obligatoriamente por el <strong>Módulo de Facturas</strong> para registrar el costo facturado de reposición y no desfasar la contabilidad.
                            </p>
                            <button type="button" class="btn btn-sm" onclick="irACargarFacturaDesdeAuditoria('${p.id}')" style="background:#d97706; color:#ffffff; border:none; font-weight:700; border-radius:8px; padding:8px 14px; font-size:0.82rem; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
                                <i class="fas fa-file-invoice-dollar"></i> Ir a Cargar por Módulo de Facturas
                            </button>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // FALTANTE (Físico < Sistema)
            motivosContainer.innerHTML = `
                <div style="font-weight:700; font-size:0.92rem; color:#991b1b; margin-bottom:10px; display:flex; align-items:center; gap:8px;">
                    <i class="fas fa-triangle-exclamation"></i> Selecciona el motivo del FALTANTE: <span style="color:var(--danger)">*</span>
                </div>

                <div role="button" tabindex="0" class="audit-modal-reason-card is-selected-faltante" onclick="alSeleccionarMotivoAuditoria(this, 'Merma / Daño / Vencimiento', 'faltante')" onkeydown="if(event.key==='Enter'||event.key===' '){alSeleccionarMotivoAuditoria(this, 'Merma / Daño / Vencimiento', 'faltante'); event.preventDefault();}">
                    <div class="audit-reason-radio-indicator">
                        <i class="fas fa-check"></i>
                    </div>
                    <div class="audit-reason-badge-icon">
                        <i class="fas fa-ban"></i>
                    </div>
                    <div class="audit-reason-text-wrap">
                        <strong class="audit-reason-title">a) Merma / Daño / Vencimiento</strong>
                        <span class="audit-reason-desc">
                            Pérdida de inventario por producto caducado, rotura física o deterioro de empaque.
                        </span>
                    </div>
                    <input type="radio" name="audit-motivo-seleccionado" value="Merma / Daño / Vencimiento" checked style="display:none;">
                </div>

                <div role="button" tabindex="0" class="audit-modal-reason-card" onclick="alSeleccionarMotivoAuditoria(this, 'Error de despacho / Venta no registrada', 'faltante')" onkeydown="if(event.key==='Enter'||event.key===' '){alSeleccionarMotivoAuditoria(this, 'Error de despacho / Venta no registrada', 'faltante'); event.preventDefault();}">
                    <div class="audit-reason-radio-indicator">
                        <i class="fas fa-check"></i>
                    </div>
                    <div class="audit-reason-badge-icon">
                        <i class="fas fa-cart-arrow-down"></i>
                    </div>
                    <div class="audit-reason-text-wrap">
                        <strong class="audit-reason-title">b) Error de despacho / Venta no registrada</strong>
                        <span class="audit-reason-desc">
                            Salida física de almacén no registrada oportunamente en el sistema POS.
                        </span>
                    </div>
                    <input type="radio" name="audit-motivo-seleccionado" value="Error de despacho / Venta no registrada" style="display:none;">
                </div>

                <div role="button" tabindex="0" class="audit-modal-reason-card" onclick="alSeleccionarMotivoAuditoria(this, 'Pérdida desconocida', 'faltante')" onkeydown="if(event.key==='Enter'||event.key===' '){alSeleccionarMotivoAuditoria(this, 'Pérdida desconocida', 'faltante'); event.preventDefault();}">
                    <div class="audit-reason-radio-indicator">
                        <i class="fas fa-check"></i>
                    </div>
                    <div class="audit-reason-badge-icon">
                        <i class="fas fa-magnifying-glass"></i>
                    </div>
                    <div class="audit-reason-text-wrap">
                        <strong class="audit-reason-title">c) Pérdida desconocida</strong>
                        <span class="audit-reason-desc">
                            Discrepancia no explicada sujeta a investigación interna de almacén.
                        </span>
                    </div>
                    <input type="radio" name="audit-motivo-seleccionado" value="Pérdida desconocida" style="display:none;">
                </div>
            `;
        }
    }

    const inputNotas = document.getElementById('audit-modal-notas');
    if (inputNotas) inputNotas.value = '';

    modal.style.display = 'flex';
}
window.abrirModalAjusteAuditoria = abrirModalAjusteAuditoria;

function alSeleccionarMotivoAuditoria(elem, valor, tipo) {
    const container = document.getElementById('audit-modal-motivos-list');
    if (!container) return;

    const cards = container.querySelectorAll('.audit-modal-reason-card');
    cards.forEach(card => {
        card.classList.remove('is-selected-sobrante', 'is-selected-faltante');
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = false;
    });

    const targetCard = (elem && elem.classList && elem.classList.contains('audit-modal-reason-card'))
        ? elem
        : (elem ? elem.closest('.audit-modal-reason-card') : null);

    if (targetCard) {
        if (tipo === 'sobrante') {
            targetCard.classList.add('is-selected-sobrante');
        } else {
            targetCard.classList.add('is-selected-faltante');
        }
        const radio = targetCard.querySelector('input[type="radio"]');
        if (radio) {
            radio.checked = true;
        }
    }
}
window.alSeleccionarMotivoAuditoria = alSeleccionarMotivoAuditoria;

function cerrarModalAjusteAuditoria() {
    const modal = document.getElementById('modal-ajuste-auditoria');
    if (modal) modal.style.display = 'none';
    productoAjusteAuditoriaActual = null;
}
window.cerrarModalAjusteAuditoria = cerrarModalAjusteAuditoria;

// Redirige al módulo de facturas para ingresar mercancía nueva
function irACargarFacturaDesdeAuditoria(productoId) {
    cerrarModalAjusteAuditoria();
    if (typeof switchTab === 'function') {
        switchTab('facturas');
    }
    setTimeout(() => {
        if (typeof window.abrirFacturaConProducto === 'function') {
            window.abrirFacturaConProducto(productoId);
        }
    }, 150);
}
window.irACargarFacturaDesdeAuditoria = irACargarFacturaDesdeAuditoria;

// Confirma y aplica el ajuste con el motivo obligatorio
async function confirmarAjusteAuditoria() {
    if (!productoAjusteAuditoriaActual) return;
    const { producto: p, diferencia, stockFisico, stockAnterior } = productoAjusteAuditoriaActual;

    const radios = document.getElementsByName('audit-motivo-seleccionado');
    let motivoSeleccionado = '';
    for (const r of radios) {
        if (r.checked) {
            motivoSeleccionado = r.value;
            break;
        }
    }

    if (!motivoSeleccionado) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Motivo Obligatorio', 'Debes seleccionar obligatoriamente un motivo para el ajuste de inventario.', 'warning');
        } else {
            alert('Debes seleccionar obligatoriamente un motivo para el ajuste.');
        }
        return;
    }

    const inputNotas = document.getElementById('audit-modal-notas');
    const notas = String(inputNotas?.value || '').trim();

    // Actualiza el stock exclusivamente mediante el servicio formal de auditoría (sin alterar precios base ni costos)
    if (!InventoryApp.StockService.ajuste(p.id, stockFisico)) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Error', 'No fue posible aplicar el ajuste de inventario.', 'error');
        } else {
            alert('No fue posible aplicar el ajuste de inventario.');
        }
        return;
    }

    const usuarioNombre = AppState.usuarioActual?.nombre || AppState.usuarioActual?.id || 'SuperAdmin';
    const timestamp = typeof obtenerFechaSeleccionadaConteo === 'function' ? obtenerFechaSeleccionadaConteo() : new Date().toISOString().replace('T', ' ').substring(0, 16);

    // Deja registro en el historial de auditoría con el motivo obligatorio
    const registroAuditoria = {
        id: "AJ" + (auditorias.length + 1) + '_' + Date.now().toString().slice(-4),
        fecha: timestamp,
        productoId: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        stockTeorico: stockAnterior,
        stockAnterior: stockAnterior,
        stockFisico: stockFisico,
        diferencia: diferencia,
        motivo: motivoSeleccionado,
        notas: notas,
        costo: Number(p.costo || 0),
        precio: Number(p.precio || 0),
        perdidaUSD: diferencia < 0 ? Math.abs(diferencia) * Number(p.costo || 0) : 0,
        usuario: usuarioNombre
    };
    auditorias.push(registroAuditoria);

    // Enviar payload de auditoría al backend centralizado /api/inventory/adjust
    try {
        fetch('/api/inventory/adjust', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productoId: p.id,
                codigo: p.codigo,
                nombre: p.nombre,
                stockAnterior: stockAnterior,
                nuevoStock: stockFisico,
                diferencia: diferencia,
                motivo: motivoSeleccionado,
                notas: notas,
                usuario: usuarioNombre,
                timestamp: timestamp
            })
        }).catch(err => console.warn('[API Adjust] Fallback local:', err));
    } catch {}

    // Sincronizar ajuste en Firestore (sin alterar precios base)
    if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.registrarAuditoria === 'function') {
        window.InventoryApp.Firebase.registrarAuditoria(registroAuditoria, p.id, stockFisico).catch(err => {
            console.warn('[Auditoria] Error sincronizando ajuste en Firestore:', err);
        });
    }

    // Conservamos el conteo físico verificado
    conteosFisicos[p.id] = stockFisico;
    guardarConteosSesion();

    cerrarModalAjusteAuditoria();

    renderizarInventario();
    renderizarPosProductos();
    renderizarAuditoria(document.getElementById('auditoria-search') ? document.getElementById('auditoria-search').value : "");
    renderizarHistorialAuditoria();
    if (typeof renderizarResumenPerdidasEconomicas === 'function') {
        renderizarResumenPerdidasEconomicas();
    }

    if (typeof showCustomToast === 'function') {
        showCustomToast(`Ajuste aplicado para "${p.nombre}" (${diferencia > 0 ? '+' : ''}${diferencia} unds - Motivo: ${motivoSeleccionado})`, 'success');
    }
}
window.confirmarAjusteAuditoria = confirmarAjusteAuditoria;

// Aplica el ajuste de UN producto abriendo el modal de conciliación obligatoria
function aplicarAjusteInventario(productoId) {
    abrirModalAjusteAuditoria(productoId);
}
window.aplicarAjusteInventario = aplicarAjusteInventario;

// Fallback legacy en caso de ausencia de DOM
async function aplicarAjusteInventarioLegacy(productoId) {
    const p = productos.find(prod => prod.id === productoId);
    if (!p) return;

    const diferencia = calcularDiferenciaAuditoria(productoId);
    if (diferencia === null) return;

    const stockFisico = Number(conteosFisicos[productoId] || 0);
    const stockAnterior = Number(p.stock || 0);

    if (!InventoryApp.StockService.ajuste(productoId, stockFisico)) return;

    const usuarioNombre = AppState.usuarioActual?.nombre || AppState.usuarioActual?.id || 'SuperAdmin';
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const motivo = diferencia > 0 ? 'Error de conteo previo' : 'Pérdida desconocida';

    const registroAuditoria = {
        id: "AJ" + (auditorias.length + 1) + '_' + Date.now().toString().slice(-4),
        fecha: timestamp,
        productoId: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        stockTeorico: stockAnterior,
        stockAnterior: stockAnterior,
        stockFisico: stockFisico,
        diferencia: diferencia,
        motivo: motivo,
        costo: Number(p.costo || 0),
        precio: Number(p.precio || 0),
        perdidaUSD: diferencia < 0 ? Math.abs(diferencia) * Number(p.costo || 0) : 0,
        usuario: usuarioNombre
    };
    auditorias.push(registroAuditoria);

    if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.registrarAuditoria === 'function') {
        window.InventoryApp.Firebase.registrarAuditoria(registroAuditoria, productoId, stockFisico).catch(() => {});
    }

    conteosFisicos[productoId] = stockFisico;
    guardarConteosSesion();
    renderizarAuditoria();
    renderizarHistorialAuditoria();
}

// Aplica en bloque todos los ajustes pendientes (todos los productos con conteo físico capturado que difieran del stock digital).
async function aplicarTodosLosAjustes() {
    const todosContados = Object.keys(conteosFisicos);
    if (todosContados.length === 0) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Sin Conteos', 'No hay conteos físicos registrados para aplicar.', 'warning');
        } else {
            alert('No hay conteos físicos registrados para aplicar.');
        }
        return;
    }

    // Filtrar solo aquellos que tienen discrepancia real con el stock digital
    const pendientes = todosContados.filter(id => {
        const dif = calcularDiferenciaAuditoria(id);
        return dif !== null && dif !== 0;
    });

    if (pendientes.length === 0) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Inventario Conforme', 'Todos los productos contados coinciden exactamente con el stock digital. No se requieren ajustes contables.', 'info');
        } else {
            alert('Todos los productos contados coinciden con el stock digital.');
        }
        return;
    }

    let confirmado = false;
    const msg = `¿Confirmar ajuste contable para <b>${pendientes.length} producto(s)</b> con discrepancias detectadas?<br><br>El Stock Digital de cada producto se actualizará para coincidir con el inventario físico verificado.`;
    if (typeof showCustomConfirm === 'function') {
        confirmado = await showCustomConfirm('Ajuste Masivo de Inventario', msg, 'warning');
    } else {
        confirmado = confirm(`¿Confirmar ${pendientes.length} ajuste(s) de inventario?`);
    }

    if (!confirmado) return;

    for (const productoId of pendientes) {
        const prods = Array.isArray(productos) ? productos : (AppState.productos || []);
        const p = prods.find(prod => prod.id === productoId);
        if (!p) continue;

        const diferencia = calcularDiferenciaAuditoria(productoId);
        if (diferencia === null || diferencia === 0) continue;

        const stockFisico = Number(conteosFisicos[productoId] || 0);
        const stockAnterior = Number(p.stock || 0);

        if (InventoryApp.StockService.ajuste(productoId, stockFisico)) {
            const timestamp = typeof obtenerFechaSeleccionadaConteo === 'function' ? obtenerFechaSeleccionadaConteo() : new Date().toISOString().replace('T', ' ').substring(0, 16);
            const registroAuditoria = {
                id: "AJ" + (auditorias.length + 1) + '_' + Date.now().toString().slice(-4),
                fecha: timestamp,
                productoId: p.id,
                codigo: p.codigo,
                nombre: p.nombre,
                stockAnterior: stockAnterior,
                stockFisico: stockFisico,
                diferencia: diferencia,
                costo: Number(p.costo || 0),
                perdidaUSD: diferencia < 0 ? Math.abs(diferencia) * Number(p.costo || 0) : 0
            };
            auditorias.push(registroAuditoria);

            try {
                fetch('/api/inventory/adjust', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        productoId: p.id,
                        codigo: p.codigo,
                        nombre: p.nombre,
                        stockAnterior: stockAnterior,
                        nuevoStock: stockFisico,
                        diferencia: diferencia,
                        motivo: 'Ajuste Masivo de Auditoría',
                        timestamp: timestamp
                    })
                }).catch(() => {});
            } catch {}

            if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.registrarAuditoria === 'function') {
                window.InventoryApp.Firebase.registrarAuditoria(registroAuditoria, productoId, stockFisico).catch(() => {});
            }
        }
        // Mantiene el conteo físico en memoria y sesión para que quede registrado como Conforme (Al día)
        conteosFisicos[productoId] = stockFisico;
    }

    guardarConteosSesion();

    renderizarInventario();
    renderizarPosProductos();
    renderizarAuditoria();
    renderizarHistorialAuditoria();
    if (typeof renderizarResumenPerdidasEconomicas === 'function') {
        renderizarResumenPerdidasEconomicas();
    }

    if (typeof showCustomToast === 'function') {
        showCustomToast(`Se aplicaron exitosamente ${pendientes.length} ajuste(s) de inventario`, 'success');
    }
}

// Pre-carga el stock digital actual como conteo físico para todos los productos (Marcando todos conformes como base)
function precargarStockTeoricoAuditoria() {
    const prods = Array.isArray(productos) ? productos : (AppState.productos || []);
    if (prods.length === 0) {
        if (typeof showCustomToast === 'function') {
            showCustomToast('No hay productos en el catálogo para auditar.', 'info');
        }
        return;
    }

    prods.forEach(p => {
        conteosFisicos[p.id] = Number(p.stock || 0);
    });

    guardarConteosSesion();
    renderizarAuditoria(document.getElementById('auditoria-search')?.value || "");
    if (typeof renderizarResumenPerdidasEconomicas === 'function') {
        renderizarResumenPerdidasEconomicas();
    }

    if (typeof showCustomToast === 'function') {
        showCustomToast(`Se cargó el stock digital para ${prods.length} productos (Marcados Conformes)`, 'success');
    }
}

// Limpia filtros de búsqueda y restablece la visualización completa sin alterar los conteos físicos
function reiniciarTomaInventario() {
    const searchInput = document.getElementById('auditoria-search');
    if (searchInput) searchInput.value = '';
    const scanInput = document.getElementById('auditoria-scan');
    if (scanInput) scanInput.value = '';

    renderizarAuditoria('');
    if (typeof renderizarResumenPerdidasEconomicas === 'function') {
        renderizarResumenPerdidasEconomicas();
    }
}

// Exponer funciones en el ámbito global para eventos inline HTML
window.calcularDiferenciaAuditoria = calcularDiferenciaAuditoria;
window.renderizarAuditoria = renderizarAuditoria;
window.filtrarAuditoria = filtrarAuditoria;
window.actualizarConteoFisico = actualizarConteoFisico;
window.actualizarFilaAuditoria = actualizarFilaAuditoria;
window.actualizarResumenAuditoria = actualizarResumenAuditoria;
window.buscarProductoPorCodigoFlexible = buscarProductoPorCodigoFlexible;
window.escanearProductoAuditoria = escanearProductoAuditoria;
window.aplicarAjusteInventario = aplicarAjusteInventario;
window.aplicarTodosLosAjustes = aplicarTodosLosAjustes;
window.precargarStockTeoricoAuditoria = precargarStockTeoricoAuditoria;
window.reiniciarTomaInventario = reiniciarTomaInventario;
window.cargarConteosSesion = cargarConteosSesion;
window.guardarConteosSesion = guardarConteosSesion;

// =========================================================================
// --- GESTIÓN DE SESIONES Y TOMAS DE CONTEO FÍSICO CON FECHA SELECCIONABLE ---
// =========================================================================

const SESIONES_CONTEO_STORAGE_KEY = 'bodeguita_sesiones_conteo_v1';

function obtenerSesionesConteo() {
    if (!Array.isArray(AppState.sesionesConteo)) {
        try {
            const raw = localStorage.getItem(SESIONES_CONTEO_STORAGE_KEY);
            AppState.sesionesConteo = raw ? JSON.parse(raw) : [];
        } catch (_) {
            AppState.sesionesConteo = [];
        }
    }
    return AppState.sesionesConteo;
}

function guardarSesionesConteo(sesiones) {
    AppState.sesionesConteo = sesiones || [];
    try {
        localStorage.setItem(SESIONES_CONTEO_STORAGE_KEY, JSON.stringify(AppState.sesionesConteo));
    } catch (_) {}
}

function obtenerFechaSeleccionadaConteo() {
    const el = document.getElementById('auditoria-session-fecha');
    if (el && el.value) {
        return el.value.replace('T', ' ');
    }
    return new Date().toISOString().replace('T', ' ').substring(0, 16);
}

function alCambiarFechaSesionConteo(val) {
    if (!val) return;
    if (typeof showCustomToast === 'function') {
        const d = new Date(val);
        const fStr = isNaN(d.getTime()) ? val : d.toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short' });
        showCustomToast(`Fecha del conteo fijada: ${fStr}`, 'info');
    }
}

let sesionConteoIniciada = false;
function inicializarSesionConteoActual() {
    const inputFecha = document.getElementById('auditoria-session-fecha');
    if (inputFecha && !inputFecha.value) {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(now.getTime() - offset)).toISOString().slice(0, 16);
        inputFecha.value = localISOTime;
    }

    const inputUser = document.getElementById('auditoria-session-usuario');
    if (inputUser && !inputUser.value) {
        inputUser.value = AppState.usuarioActual?.nombre || 'Administrador';
    }

    const badgeTotal = document.getElementById('badge-total-sesiones-conteo');
    if (badgeTotal) {
        const sesiones = obtenerSesionesConteo();
        badgeTotal.textContent = sesiones.length;
    }
}

/**
 * Guarda y registra formalmente una sesión de conteo físico con su fecha,
 * productos contados, detalle y balance de faltantes/sobrantes.
 */
async function guardarYRegistrarSesionConteo(autoAjustar = false) {
    const prods = Array.isArray(productos) ? productos : (AppState.productos || []);
    const contadosIds = Object.keys(conteosFisicos).filter(id => {
        const val = conteosFisicos[id];
        return val !== '' && val !== null && val !== undefined;
    });

    if (contadosIds.length === 0) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Sin Productos Contados', 'Ingresa el conteo físico de al menos 1 producto en la tabla antes de guardar el registro.', 'warning');
        } else {
            alert('Ingresa el conteo físico de al menos 1 producto antes de guardar el registro.');
        }
        return;
    }

    const fechaSeleccionada = obtenerFechaSeleccionadaConteo();
    const tituloInput = document.getElementById('auditoria-session-titulo')?.value?.trim();
    const usuarioInput = document.getElementById('auditoria-session-usuario')?.value?.trim() || AppState.usuarioActual?.nombre || 'Administrador';

    let conformes = 0;
    let sobrantesProds = 0;
    let sobrantesUnds = 0;
    let faltantesProds = 0;
    let faltantesUnds = 0;
    let perdidaTotalUSD = 0;

    const productosDetalle = [];

    contadosIds.forEach(id => {
        const p = prods.find(item => item.id === id);
        if (!p) return;

        const stockDigital = Number(p.stock || 0);
        const stockFisico = Number(conteosFisicos[id]);
        const diferencia = stockFisico - stockDigital;
        const costo = Number(p.costo || 0);
        const precio = Number(p.precio || 0);

        let estado = 'CONFORME';
        let perdidaUSD = 0;

        if (diferencia > 0) {
            estado = 'SOBRANTE';
            sobrantesProds++;
            sobrantesUnds += diferencia;
        } else if (diferencia < 0) {
            estado = 'FALTANTE';
            faltantesProds++;
            faltantesUnds += Math.abs(diferencia);
            perdidaUSD = Math.abs(diferencia) * costo;
            perdidaTotalUSD += perdidaUSD;
        } else {
            conformes++;
        }

        productosDetalle.push({
            productoId: p.id,
            codigo: p.codigo || p.id,
            nombre: p.nombre,
            categoria: p.categoria || 'General',
            stockDigital: stockDigital,
            stockFisico: stockFisico,
            diferencia: diferencia,
            estado: estado,
            costo: costo,
            precio: precio,
            perdidaUSD: perdidaUSD
        });
    });

    const tituloFinal = tituloInput || `Conteo de ${productosDetalle.length} productos`;
    const nuevaSesion = {
        id: `CONTEO-${Date.now()}`,
        fecha: fechaSeleccionada,
        titulo: tituloFinal,
        usuario: usuarioInput,
        totalContados: productosDetalle.length,
        conformes: conformes,
        sobrantesProductos: sobrantesProds,
        sobrantesUnidades: sobrantesUnds,
        faltantesProductos: faltantesProds,
        faltantesUnidades: faltantesUnds,
        perdidaTotalUSD: perdidaTotalUSD,
        productos: productosDetalle,
        ajustado: false,
        fechaCreacion: new Date().toISOString()
    };

    const sesiones = obtenerSesionesConteo();
    sesiones.unshift(nuevaSesion);
    guardarSesionesConteo(sesiones);

    // Sincronizar en la nube Firestore
    if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarSesionConteo === 'function') {
        window.InventoryApp.Firebase.guardarSesionConteo(nuevaSesion).catch(err => {
            console.warn('[Auditoría] Error sincronizando sesión en la nube:', err);
        });
    }

    renderizarHistorialSesionesConteo();

    const badgeTotal = document.getElementById('badge-total-sesiones-conteo');
    if (badgeTotal) badgeTotal.textContent = sesiones.length;

    const discrepancias = sobrantesProds + faltantesProds;
    let mensajeConfirmacion = `
        <div style="text-align:left; font-size:0.9rem; line-height:1.5;">
            <p>Se ha guardado el registro del conteo <strong>"${tituloFinal}"</strong> con fecha <strong>${fechaSeleccionada}</strong>.</p>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px; margin:12px 0;">
                <div>📦 <strong>Total contados:</strong> ${productosDetalle.length} productos</div>
                <div style="color:#16a34a;">🟢 <strong>Conformes:</strong> ${conformes} productos</div>
                <div style="color:#d97706;">🟡 <strong>Sobrantes:</strong> ${sobrantesProds} productos (+${sobrantesUnds} unds)</div>
                <div style="color:#dc2626;">🔴 <strong>Faltantes:</strong> ${faltantesProds} productos (-${faltantesUnds} unds)</div>
            </div>
            ${discrepancias > 0 
                ? '<p>¿Deseas aplicar los ajustes contables de inventario de este conteo ahora mismo?</p>'
                : '<p style="color:#16a34a; font-weight:700;">¡Todos los productos contados coinciden exactamente con el sistema!</p>'
            }
        </div>
    `;

    if (discrepancias > 0 && !autoAjustar) {
        let aplicarAhora = false;
        if (typeof showCustomConfirm === 'function') {
            aplicarAhora = await showCustomConfirm('Conteo Registrado con Éxito', mensajeConfirmacion, 'question');
        } else {
            aplicarAhora = confirm(`Conteo registrado con éxito. ¿Deseas aplicar los ajustes contables ahora?`);
        }

        if (aplicarAhora) {
            nuevaSesion.ajustado = true;
            guardarSesionesConteo(sesiones);
            await aplicarTodosLosAjustes();
            renderizarHistorialSesionesConteo();
            return;
        }
    } else if (autoAjustar) {
        nuevaSesion.ajustado = true;
        guardarSesionesConteo(sesiones);
    }

    if (typeof showCustomToast === 'function') {
        showCustomToast(`Registro de conteo guardado: ${productosDetalle.length} productos auditados`, 'success');
    }
}

/**
 * Renderiza la lista/tarjetas de sesiones de conteo tanto en el dashboard como en el modal
 */
function renderizarHistorialSesionesConteo() {
    const contenedorDashboard = document.getElementById('auditoria-sesiones-lista');
    const contenedorModal = document.getElementById('modal-sesiones-conteo-lista-body');
    const badgeTotal = document.getElementById('badge-total-sesiones-conteo');

    const sesiones = obtenerSesionesConteo();
    if (badgeTotal) badgeTotal.textContent = sesiones.length;

    if (!contenedorDashboard && !contenedorModal) return;

    if (sesiones.length === 0) {
        const vacioHtml = `
            <div style="text-align:center; padding:32px 16px; color:var(--text-muted); background:var(--bg-card, #ffffff); border-radius:12px; border:1px dashed var(--border-light, #e2e8f0);">
                <i class="fas fa-boxes-stacked" style="font-size:2.2rem; color:#94a3b8; margin-bottom:10px; opacity:0.6;"></i>
                <div style="font-weight:700; font-size:1rem; margin-bottom:4px; color:var(--text-main);">No hay tomas de inventario registradas aún</div>
                <p style="font-size:0.84rem; margin:0 auto; max-width:440px;">
                    Cuando cuentes tus productos, presiona el botón <strong>"Guardar Registro de este Conteo"</strong> arriba para archivar el informe de ese día con su balance de faltantes y sobrantes.
                </p>
            </div>
        `;
        if (contenedorDashboard) contenedorDashboard.innerHTML = vacioHtml;
        if (contenedorModal) contenedorModal.innerHTML = vacioHtml;
        return;
    }

    const cardsHtml = sesiones.map(s => {
        const fechaFormateada = s.fecha || 'Fecha no registrada';
        const estadoAjusteHtml = s.ajustado 
            ? `<span class="badge" style="background:#dcfce7; color:#15803d; border:1px solid #86efac; font-size:0.75rem; padding:3px 8px; border-radius:6px; font-weight:800;"><i class="fas fa-check-double"></i> Ajustes Aplicados</span>`
            : `<span class="badge" style="background:#fef3c7; color:#92400e; border:1px solid #fde68a; font-size:0.75rem; padding:3px 8px; border-radius:6px; font-weight:800;"><i class="fas fa-hourglass-half"></i> Pendiente de Ajuste</span>`;

        return `
            <div class="card" style="margin-bottom:12px; border:1px solid var(--border-light, #e2e8f0); border-radius:12px; padding:16px; background:var(--bg-card, #ffffff); box-shadow:0 1px 4px rgba(0,0,0,0.03); transition:transform 0.15s ease, box-shadow 0.15s ease;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px; margin-bottom:10px;">
                    <div>
                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                            <strong style="font-size:1rem; color:var(--text-main);">${s.titulo || 'Conteo de inventario'}</strong>
                            ${estadoAjusteHtml}
                        </div>
                        <div style="font-size:0.82rem; color:var(--text-muted); display:flex; align-items:center; gap:12px; margin-top:4px; flex-wrap:wrap;">
                            <span><i class="fas fa-calendar-day" style="color:#2563eb;"></i> <strong>Fecha:</strong> ${fechaFormateada}</span>
                            <span><i class="fas fa-user" style="color:#64748b;"></i> <strong>Auditor:</strong> ${s.usuario || 'Administrador'}</span>
                        </div>
                    </div>

                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        <button type="button" class="btn btn-sm btn-outline" onclick="verDetalleSesionConteo('${s.id}')" style="font-weight:700; font-size:0.82rem;" title="Ver lista de productos contados">
                            <i class="fas fa-eye" style="color:#2563eb;"></i> Ver Detalle
                        </button>
                        <button type="button" class="btn btn-sm btn-outline" onclick="imprimirActaSesionConteo('${s.id}')" style="font-weight:700; font-size:0.82rem;" title="Imprimir informe oficial">
                            <i class="fas fa-print"></i> Imprimir Acta
                        </button>
                        <button type="button" class="btn btn-sm btn-outline" onclick="cargarSesionConteoEnMesa('${s.id}')" style="font-weight:700; font-size:0.82rem; color:#0284c7; border-color:#bae6fd;" title="Cargar estos conteos en la tabla para seguir trabajando">
                            <i class="fas fa-rotate"></i> Cargar Conteo
                        </button>
                        <button type="button" class="btn btn-sm" onclick="eliminarSesionConteo('${s.id}')" style="background:none; border:none; color:#ef4444; padding:4px 8px; cursor:pointer;" title="Eliminar registro">
                            <i class="fas fa-trash-can"></i>
                        </button>
                    </div>
                </div>

                <!-- Métricas Resumen del Conteo -->
                <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; padding-top:10px; border-top:1px dashed var(--border-light, #f1f5f9); font-size:0.82rem;">
                    <span style="background:#f1f5f9; color:#334155; padding:3px 10px; border-radius:6px; font-weight:700;">
                        📦 <strong>${s.totalContados}</strong> contados
                    </span>
                    <span style="background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; padding:3px 10px; border-radius:6px; font-weight:700;">
                        🟢 <strong>${s.conformes}</strong> conformes
                    </span>
                    ${s.sobrantesProductos > 0 ? `
                        <span style="background:#fffbeb; color:#92400e; border:1px solid #fde68a; padding:3px 10px; border-radius:6px; font-weight:700;">
                            🟡 <strong>+${s.sobrantesUnidades}</strong> sobrantes (${s.sobrantesProductos} prods)
                        </span>
                    ` : ''}
                    ${s.faltantesProductos > 0 ? `
                        <span style="background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; padding:3px 10px; border-radius:6px; font-weight:700;">
                            🔴 <strong>-${s.faltantesUnidades}</strong> faltantes (${s.faltantesProductos} prods)
                        </span>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    if (contenedorDashboard) {
        // En el dashboard mostramos las últimas 5 sesiones para no saturar la vista
        const primeras5 = sesiones.slice(0, 5);
        let previewHtml = cardsHtml;
        if (sesiones.length > 5) {
            previewHtml = primeras5.map(s => {
                const sItem = sesiones.find(x => x.id === s.id) || s;
                return `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-bottom:1px solid var(--border-light, #f1f5f9); gap:10px; flex-wrap:wrap;">
                        <div>
                            <strong style="font-size:0.92rem; color:var(--text-main);">${s.titulo}</strong>
                            <div style="font-size:0.78rem; color:var(--text-muted); display:flex; gap:10px;">
                                <span>📅 ${s.fecha}</span>
                                <span>👤 ${s.usuario}</span>
                                <span>📦 ${s.totalContados} contados</span>
                            </div>
                        </div>
                        <div style="display:flex; gap:6px;">
                            <button type="button" class="btn btn-sm btn-outline" onclick="verDetalleSesionConteo('${s.id}')">
                                <i class="fas fa-eye"></i> Detalle
                            </button>
                            <button type="button" class="btn btn-sm btn-outline" onclick="imprimirActaSesionConteo('${s.id}')">
                                <i class="fas fa-print"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
            previewHtml += `
                <div style="text-align:center; padding-top:12px;">
                    <button type="button" class="btn btn-sm btn-outline" onclick="abrirModalHistorialSesionesConteo()" style="font-weight:700;">
                        Ver los ${sesiones.length} conteos completos...
                    </button>
                </div>
            `;
        }
        contenedorDashboard.innerHTML = previewHtml;
    }

    if (contenedorModal) {
        contenedorModal.innerHTML = cardsHtml;
    }
}

function abrirModalHistorialSesionesConteo() {
    renderizarHistorialSesionesConteo();
    const modal = document.getElementById('modal-historial-sesiones-conteo');
    if (modal) modal.style.display = 'flex';
}

function cerrarModalHistorialSesionesConteo() {
    const modal = document.getElementById('modal-historial-sesiones-conteo');
    if (modal) modal.style.display = 'none';
}

/**
 * Muestra el detalle producto por producto de una sesión de conteo guardada
 */
function verDetalleSesionConteo(sesionId) {
    const sesiones = obtenerSesionesConteo();
    const s = sesiones.find(x => x.id === sesionId);
    if (!s) return;

    const modal = document.getElementById('modal-detalle-sesion-conteo');
    if (!modal) return;

    const titEl = document.getElementById('detalle-sesion-titulo-hdr');
    if (titEl) {
        titEl.innerHTML = `<i class="fas fa-clipboard-check" style="color:#2563eb;"></i> ${s.titulo || 'Detalle del Conteo'}`;
    }

    const subEl = document.getElementById('detalle-sesion-subtitulo-hdr');
    if (subEl) {
        subEl.textContent = `Fecha: ${s.fecha} · Responsable: ${s.usuario || 'Administrador'} · ${s.totalContados} productos registrados`;
    }

    const bodyEl = document.getElementById('detalle-sesion-body-content');
    if (bodyEl) {
        const productosRows = (s.productos || []).map(p => {
            const dif = Number(p.diferencia || 0);
            let difBadge = `<span class="badge" style="background:#f1f5f9; color:#475569; font-weight:700;">0 (Exacto)</span>`;
            if (dif > 0) {
                difBadge = `<span class="badge" style="background:#fef3c7; color:#92400e; font-weight:800; border:1px solid #fde68a;">+${dif} (Sobrante)</span>`;
            } else if (dif < 0) {
                difBadge = `<span class="badge" style="background:#fee2e2; color:#dc2626; font-weight:800; border:1px solid #fca5a5;">${dif} (Faltante)</span>`;
            }

            return `
                <tr>
                    <td><code>${p.codigo || p.productoId}</code></td>
                    <td>
                        <strong style="color:var(--text-main);">${p.nombre}</strong>
                        <div style="font-size:0.75rem; color:var(--text-muted);">${p.categoria || 'General'}</div>
                    </td>
                    <td class="text-center" style="font-weight:600;">${p.stockDigital}</td>
                    <td class="text-center" style="font-weight:700; color:#2563eb;">${p.stockFisico}</td>
                    <td class="text-center">${difBadge}</td>
                    <td class="text-right" style="font-weight:600;">
                        ${p.perdidaUSD > 0 ? `<span style="color:#dc2626;">-$${p.perdidaUSD.toFixed(2)}</span>` : '<span style="color:var(--text-muted);">$0.00</span>'}
                    </td>
                </tr>
            `;
        }).join('');

        bodyEl.innerHTML = `
            <!-- Strip resumen del resultado -->
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:10px; margin-bottom:16px;">
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px; text-align:center;">
                    <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Total Contados</span>
                    <strong style="font-size:1.2rem; color:#2563eb;">${s.totalContados}</strong>
                </div>
                <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:10px; text-align:center;">
                    <span style="font-size:0.75rem; color:#15803d; display:block;">Conformes</span>
                    <strong style="font-size:1.2rem; color:#15803d;">${s.conformes}</strong>
                </div>
                <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:10px; text-align:center;">
                    <span style="font-size:0.75rem; color:#92400e; display:block;">Sobrantes</span>
                    <strong style="font-size:1.2rem; color:#92400e;">+${s.sobrantesUnidades || 0}</strong>
                </div>
                <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:10px; text-align:center;">
                    <span style="font-size:0.75rem; color:#b91c1c; display:block;">Faltantes</span>
                    <strong style="font-size:1.2rem; color:#b91c1c;">-${s.faltantesUnidades || 0}</strong>
                </div>
            </div>

            <!-- Tabla detallada -->
            <div style="max-height:55vh; overflow-y:auto; border:1px solid #e2e8f0; border-radius:10px;">
                <table class="table" style="width:100%; margin:0; font-size:0.86rem;">
                    <thead style="position:sticky; top:0; background:#f8fafc; border-bottom:1px solid #e2e8f0; z-index:2;">
                        <tr>
                            <th style="width:110px;">Código</th>
                            <th>Producto</th>
                            <th class="text-center" style="width:110px;">Stock Teórico</th>
                            <th class="text-center" style="width:110px;">Stock Físico</th>
                            <th class="text-center" style="width:130px;">Diferencia</th>
                            <th class="text-right" style="width:100px;">Impacto ($)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${productosRows}
                    </tbody>
                </table>
            </div>
        `;
    }

    const btnImp = document.getElementById('btn-imprimir-acta-detalle');
    if (btnImp) {
        btnImp.onclick = () => imprimirActaSesionConteo(sesionId);
    }

    const footerLeft = document.getElementById('detalle-sesion-footer-left');
    if (footerLeft) {
        if (!s.ajustado) {
            footerLeft.innerHTML = `
                <button type="button" class="btn btn-warning" onclick="aplicarAjustesDesdeSesion('${s.id}')" style="font-weight:700; font-size:0.85rem;">
                    <i class="fas fa-rotate"></i> Aplicar Ajustes Contables de este Conteo
                </button>
            `;
        } else {
            footerLeft.innerHTML = `
                <span style="font-size:0.82rem; color:#15803d; font-weight:700;">
                    <i class="fas fa-check-circle"></i> Los ajustes contables ya fueron aplicados a este inventario.
                </span>
            `;
        }
    }

    modal.style.display = 'flex';
}

function cerrarModalDetalleSesionConteo() {
    const modal = document.getElementById('modal-detalle-sesion-conteo');
    if (modal) modal.style.display = 'none';
}

/**
 * Carga los conteos físicos de una sesión específica en la mesa de trabajo activa
 */
function cargarSesionConteoEnMesa(sesionId) {
    const sesiones = obtenerSesionesConteo();
    const s = sesiones.find(x => x.id === sesionId);
    if (!s) return;

    if (!Array.isArray(s.productos) || s.productos.length === 0) {
        if (typeof showCustomToast === 'function') {
            showCustomToast('La sesión seleccionada no contiene productos para cargar.', 'warning');
        }
        return;
    }

    s.productos.forEach(item => {
        conteosFisicos[item.productoId] = Number(item.stockFisico);
    });

    guardarConteosSesion();

    const inputFecha = document.getElementById('auditoria-session-fecha');
    if (inputFecha && s.fecha) {
        try {
            inputFecha.value = s.fecha.replace(' ', 'T').slice(0, 16);
        } catch (_) {}
    }

    const inputTitulo = document.getElementById('auditoria-session-titulo');
    if (inputTitulo) inputTitulo.value = s.titulo || '';

    const inputUsuario = document.getElementById('auditoria-session-usuario');
    if (inputUsuario) inputUsuario.value = s.usuario || '';

    renderizarAuditoria();
    cerrarModalHistorialSesionesConteo();
    cerrarModalDetalleSesionConteo();

    // Scroll hacia la tabla
    const tabla = document.querySelector('.audit-table-card');
    if (tabla) {
        tabla.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (typeof showCustomToast === 'function') {
        showCustomToast(`Se cargaron los ${s.productos.length} productos del conteo "${s.titulo}" en la mesa de trabajo.`, 'success');
    }
}

/**
 * Genera un acta oficial de conteo físico para imprimir
 */
function imprimirActaSesionConteo(sesionId) {
    const sesiones = obtenerSesionesConteo();
    const s = sesiones.find(x => x.id === sesionId);
    if (!s) return;

    const nombreBodega = AppState.config?.nombreComercial || 'Tu Bodeguita de Confianza';
    const fechaHora = s.fecha || new Date().toLocaleString('es-VE');
    const auditor = s.usuario || 'Administrador';

    const filasHtml = (s.productos || []).map((p, idx) => {
        const dif = Number(p.diferencia || 0);
        const difTexto = dif > 0 ? `+${dif}` : (dif < 0 ? `${dif}` : '0');
        const colorDif = dif > 0 ? '#b45309' : (dif < 0 ? '#b91c1c' : '#15803d');
        return `
            <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
                <td style="padding: 6px 8px; text-align: center;">${idx + 1}</td>
                <td style="padding: 6px 8px;"><strong>${p.codigo || ''}</strong></td>
                <td style="padding: 6px 8px;">${p.nombre}</td>
                <td style="padding: 6px 8px; text-align: center;">${p.stockDigital}</td>
                <td style="padding: 6px 8px; text-align: center; font-weight: bold;">${p.stockFisico}</td>
                <td style="padding: 6px 8px; text-align: center; font-weight: bold; color: ${colorDif};">${difTexto}</td>
                <td style="padding: 6px 8px; text-align: center;">${p.estado}</td>
            </tr>
        `;
    }).join('');

    const ventanaPrint = window.open('', '_blank', 'width=800,height=900');
    if (!ventanaPrint) {
        alert('Por favor habilita las ventanas emergentes para imprimir el acta de conteo.');
        return;
    }

    ventanaPrint.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Acta Oficial de Conteo Físico - ${s.titulo}</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; padding: 24px; margin: 0; }
                h1, h2, h3, p { margin: 0 0 6px 0; }
                .header-acta { border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
                .kpi-box { display: inline-block; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 14px; margin-right: 8px; font-size: 12px; }
                table { width: 100%; border-collapse: collapse; margin-top: 14px; }
                th { background: #f1f5f9; padding: 8px; font-size: 11px; text-align: left; border-bottom: 2px solid #cbd5e1; }
                .firmas { margin-top: 50px; display: flex; justify-content: space-around; text-align: center; }
                .firma-linea { border-top: 1px solid #334155; width: 220px; padding-top: 6px; font-size: 12px; font-weight: bold; }
                @media print { body { padding: 10px; } }
            </style>
        </head>
        <body>
            <div class="header-acta">
                <div>
                    <h2>${nombreBodega}</h2>
                    <h3 style="color:#2563eb; font-size:16px;">ACTA OFICIAL DE TOMA DE INVENTARIO FÍSICO</h3>
                    <p style="font-size:12px; color:#64748b;">Referencia: <strong>${s.titulo}</strong></p>
                </div>
                <div style="text-align: right; font-size: 12px;">
                    <p><strong>Fecha del Conteo:</strong> ${fechaHora}</p>
                    <p><strong>Auditor / Responsable:</strong> ${auditor}</p>
                    <p><strong>Estado:</strong> ${s.ajustado ? 'Ajustes Aplicados en Sistema' : 'Registro de Conteo Físico'}</p>
                </div>
            </div>

            <div>
                <div class="kpi-box">Total Contados: <strong>${s.totalContados}</strong></div>
                <div class="kpi-box">Conformes: <strong style="color:#15803d;">${s.conformes}</strong></div>
                <div class="kpi-box">Sobrantes: <strong style="color:#b45309;">+${s.sobrantesUnidades || 0}</strong></div>
                <div class="kpi-box">Faltantes: <strong style="color:#b91c1c;">-${s.faltantesUnidades || 0}</strong></div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 30px; text-align: center;">#</th>
                        <th style="width: 90px;">Código</th>
                        <th>Producto</th>
                        <th style="width: 80px; text-align: center;">Stock Digital</th>
                        <th style="width: 80px; text-align: center;">Stock Físico</th>
                        <th style="width: 80px; text-align: center;">Diferencia</th>
                        <th style="width: 90px; text-align: center;">Estado</th>
                    </tr>
                </thead>
                <tbody>
                    ${filasHtml}
                </tbody>
            </table>

            <div class="firmas">
                <div>
                    <div class="firma-linea">Firma del Auditor / Responsable<br><small style="font-weight:normal; font-size:10px;">${auditor}</small></div>
                </div>
                <div>
                    <div class="firma-linea">Firma del Gerente / Administrador<br><small style="font-weight:normal; font-size:10px;">Conforme y Aprobado</small></div>
                </div>
            </div>

            <script>
                window.onload = function() {
                    window.print();
                };
            </script>
        </body>
        </html>
    `);
    ventanaPrint.document.close();
}

/**
 * Elimina un registro de sesión de conteo con confirmación
 */
async function eliminarSesionConteo(sesionId) {
    let confirmado = false;
    if (typeof showCustomConfirm === 'function') {
        confirmado = await showCustomConfirm('Eliminar Registro', '¿Seguro que deseas eliminar este registro de conteo físico? Esta acción no altera el inventario actual.', 'warning');
    } else {
        confirmado = confirm('¿Eliminar este registro de conteo físico?');
    }

    if (!confirmado) return;

    let sesiones = obtenerSesionesConteo();
    sesiones = sesiones.filter(s => s.id !== sesionId);
    guardarSesionesConteo(sesiones);

    renderizarHistorialSesionesConteo();
    cerrarModalDetalleSesionConteo();

    if (typeof showCustomToast === 'function') {
        showCustomToast('Registro de conteo eliminado.', 'info');
    }
}

/**
 * Aplica los ajustes contables directamente desde una sesión previamente guardada
 */
async function aplicarAjustesDesdeSesion(sesionId) {
    const sesiones = obtenerSesionesConteo();
    const s = sesiones.find(x => x.id === sesionId);
    if (!s) return;

    // Cargar los productos de la sesión a la mesa y ejecutar el ajuste masivo
    cargarSesionConteoEnMesa(sesionId);
    s.ajustado = true;
    guardarSesionesConteo(sesiones);

    await aplicarTodosLosAjustes();
    verDetalleSesionConteo(sesionId);
}

// Exponer en window para llamadas inline HTML
window.obtenerSesionesConteo = obtenerSesionesConteo;
window.guardarSesionesConteo = guardarSesionesConteo;
window.obtenerFechaSeleccionadaConteo = obtenerFechaSeleccionadaConteo;
window.alCambiarFechaSesionConteo = alCambiarFechaSesionConteo;
window.inicializarSesionConteoActual = inicializarSesionConteoActual;
window.guardarYRegistrarSesionConteo = guardarYRegistrarSesionConteo;
window.renderizarHistorialSesionesConteo = renderizarHistorialSesionesConteo;
window.abrirModalHistorialSesionesConteo = abrirModalHistorialSesionesConteo;
window.cerrarModalHistorialSesionesConteo = cerrarModalHistorialSesionesConteo;
window.verDetalleSesionConteo = verDetalleSesionConteo;
window.cerrarModalDetalleSesionConteo = cerrarModalDetalleSesionConteo;
window.imprimirActaSesionConteo = imprimirActaSesionConteo;
window.cargarSesionConteoEnMesa = cargarSesionConteoEnMesa;
window.eliminarSesionConteo = eliminarSesionConteo;
window.aplicarAjustesDesdeSesion = aplicarAjustesDesdeSesion;

// Calcula la pérdida pendiente real, compensando faltantes con sobrantes/reposiciones
// posteriores del mismo producto. Se procesa en orden cronológico y cada sobrante
// reduce primero los faltantes pendientes (FIFO), para que una corrección sí quite la deuda.

