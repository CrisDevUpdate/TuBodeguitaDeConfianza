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
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);

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
