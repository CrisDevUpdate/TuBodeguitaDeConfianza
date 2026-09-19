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

// Aplica el ajuste de UN producto: actualiza el Stock Digital para que coincida
// con el Stock Físico contado y deja el registro correspondiente en el historial.
async function aplicarAjusteInventario(productoId) {
    const p = productos.find(prod => prod.id === productoId);
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

    const stockFisico = Number(conteosFisicos[productoId] || 0);
    const stockAnterior = Number(p.stock || 0);

    // Confirmación mediante Modal Personalizado
    const difTexto = (diferencia > 0 ? `+${diferencia}` : `${diferencia}`);
    const mensajeHtml = `¿Confirmar ajuste de inventario para <b>"${p.nombre}"</b>?<br><br>` +
        `• <b>Stock Anterior:</b> ${stockAnterior} unds<br>` +
        `• <b>Nuevo Stock Físico:</b> ${stockFisico} unds<br>` +
        `• <b>Diferencia:</b> <span style="color:${diferencia >= 0 ? '#16a34a' : '#ef4444'}; font-weight:700;">${difTexto} unds</span><br>` +
        `• <b>Motivo:</b> Auditoría Física de Inventario`;

    let confirmado = false;
    if (typeof showCustomConfirm === 'function') {
        confirmado = await showCustomConfirm('Auditoría de Inventario', mensajeHtml, 'warning');
    } else {
        confirmado = confirm(`¿Confirmar ajuste para ${p.nombre}?\nAnterior: ${stockAnterior}\nNuevo: ${stockFisico}\nDiferencia: ${difTexto}`);
    }

    if (!confirmado) return;

    // Actualiza el stock exclusivamente mediante el servicio formal de auditoría.
    if (!InventoryApp.StockService.ajuste(productoId, stockFisico)) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Error', 'No fue posible aplicar el ajuste de inventario.', 'error');
        } else {
            alert('No fue posible aplicar el ajuste de inventario.');
        }
        return;
    }

    const usuarioNombre = AppState.usuarioActual?.nombre || AppState.usuarioActual?.id || 'SuperAdmin';
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);

    // Deja registro en el historial de auditoría.
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
                motivo: 'Auditoría Física de Inventario',
                usuario: usuarioNombre,
                timestamp: timestamp
            })
        }).catch(err => console.warn('[API Adjust] Fallback local:', err));
    } catch {}

    // Sincronizar ajuste en Firestore
    if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.registrarAuditoria === 'function') {
        window.InventoryApp.Firebase.registrarAuditoria(registroAuditoria, productoId, stockFisico).catch(err => {
            console.warn('[Auditoria] Error sincronizando ajuste en Firestore:', err);
        });
    }

    // Conservamos el conteo físico verificado (ahora en exacta concordancia con el nuevo stock digital)
    conteosFisicos[productoId] = stockFisico;
    guardarConteosSesion();

    renderizarInventario();
    renderizarPosProductos();
    renderizarAuditoria(document.getElementById('auditoria-search') ? document.getElementById('auditoria-search').value : "");
    renderizarHistorialAuditoria();
    if (typeof renderizarResumenPerdidasEconomicas === 'function') {
        renderizarResumenPerdidasEconomicas();
    }

    if (typeof showCustomToast === 'function') {
        showCustomToast(`Ajuste aplicado para ${p.nombre} (Stock Digital: ${stockFisico})`, 'success');
    }
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
            const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
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

// Calcula la pérdida pendiente real, compensando faltantes con sobrantes/reposiciones
// posteriores del mismo producto. Se procesa en orden cronológico y cada sobrante
// reduce primero los faltantes pendientes (FIFO), para que una corrección sí quite la deuda.
