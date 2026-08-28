// --- AUDITORÍA E INVENTARIO FÍSICO (CONTEO / TOMA DE INVENTARIO) ---

// Calcula la diferencia (Físico - Digital) para un producto.
// Devuelve null si el producto todavía no tiene un conteo físico capturado.
function calcularDiferenciaAuditoria(productoId) {
    const p = productos.find(prod => prod.id === productoId);
    if (!p) return null;

    const fisico = conteosFisicos[productoId];
    if (fisico === undefined || fisico === null || fisico === '') return null;

    return Number(fisico) - p.stock;
}

// Renderiza (o re-renderiza) la tabla de conteo de auditoría, opcionalmente filtrada.
function renderizarAuditoria(filtro = "") {
    const tbody = document.getElementById('auditoria-body');
    if (!tbody) return;

    const filtrados = productos.filter(p =>
        p.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
        p.codigo.toLowerCase().includes(filtro.toLowerCase())
    );

    tbody.innerHTML = filtrados.map(p => {
        const valorFisico = conteosFisicos.hasOwnProperty(p.id) ? conteosFisicos[p.id] : '';
        return `
            <tr>
                <td>${p.codigo}</td>
                <td>${p.nombre}</td>
                <td class="num">${p.stock}</td>
                <td class="num">
                    <input type="number" min="0" step="1" class="input-conteo-fisico"
                        id="auditoria-input-${p.id}"
                        value="${valorFisico}"
                        placeholder="Cant."
                        oninput="actualizarConteoFisico('${p.id}', this.value)">
                </td>
                <td class="num" id="auditoria-dif-${p.id}">—</td>
                <td id="auditoria-estado-${p.id}"><span class="badge badge-pendiente">Pendiente</span></td>
                <td>
                    <button class="btn btn-warning" id="auditoria-btn-${p.id}" onclick="aplicarAjusteInventario('${p.id}')" disabled>Aplicar Ajuste</button>
                </td>
            </tr>
        `;
    }).join('');

    // Recalcula diferencia/estado para las filas que ya tienen un conteo capturado.
    filtrados.forEach(p => {
        if (conteosFisicos.hasOwnProperty(p.id)) {
            actualizarFilaAuditoria(p.id);
        }
    });

    actualizarResumenAuditoria();
}

function filtrarAuditoria() {
    renderizarAuditoria(document.getElementById('auditoria-search').value);
}

// Se dispara cuando el usuario captura/edita la cantidad física de un producto.
// Actualiza solo la fila afectada (no re-renderiza toda la tabla) para no perder el foco del input.
function actualizarConteoFisico(productoId, valor) {
    if (valor === '' || valor === null) {
        delete conteosFisicos[productoId];
    } else {
        conteosFisicos[productoId] = parseInt(valor, 10);
    }
    actualizarFilaAuditoria(productoId);
    actualizarResumenAuditoria();
}

// Compara en tiempo real el Stock Físico contra el Stock Digital y actualiza
// la celda de diferencia, el badge de estado y habilita/deshabilita el botón de ajuste.
function actualizarFilaAuditoria(productoId) {
    const difCell = document.getElementById(`auditoria-dif-${productoId}`);
    const estadoCell = document.getElementById(`auditoria-estado-${productoId}`);
    const btnAjuste = document.getElementById(`auditoria-btn-${productoId}`);
    if (!difCell || !estadoCell || !btnAjuste) return;

    const diferencia = calcularDiferenciaAuditoria(productoId);

    if (diferencia === null) {
        difCell.textContent = '—';
        difCell.style.color = '';
        estadoCell.innerHTML = '<span class="badge badge-pendiente">Pendiente</span>';
        btnAjuste.disabled = true;
        return;
    }

    difCell.textContent = (diferencia > 0 ? '+' : '') + diferencia;

    if (diferencia > 0) {
        // Sobrante: el conteo físico superó al stock digital.
        difCell.style.color = 'var(--success)';
        estadoCell.innerHTML = '<span class="badge badge-sobrante">Sobrante</span>';
    } else if (diferencia < 0) {
        // Faltante: el conteo físico es menor al stock digital.
        difCell.style.color = 'var(--danger)';
        estadoCell.innerHTML = '<span class="badge badge-faltante">Faltante</span>';
    } else {
        // Conforme: el conteo físico coincide exactamente con el stock digital.
        difCell.style.color = 'var(--text-muted)';
        estadoCell.innerHTML = '<span class="badge badge-conforme">Conforme</span>';
    }

    btnAjuste.disabled = false;
}

// Actualiza los KPIs resumen (contados / sobrantes / faltantes / conformes) según los conteos pendientes.
function actualizarResumenAuditoria() {
    const kpiContados = document.getElementById('auditoria-kpi-contados');
    if (!kpiContados) return;

    const ids = Object.keys(conteosFisicos);
    let sobrantes = 0, faltantes = 0, conformes = 0;

    ids.forEach(id => {
        const dif = calcularDiferenciaAuditoria(id);
        if (dif > 0) sobrantes++;
        else if (dif < 0) faltantes++;
        else conformes++;
    });

    kpiContados.textContent = ids.length;
    document.getElementById('auditoria-kpi-sobrantes').textContent = sobrantes;
    document.getElementById('auditoria-kpi-faltantes').textContent = faltantes;
    document.getElementById('auditoria-kpi-conformes').textContent = conformes;
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
function aplicarAjusteInventario(productoId) {
    const p = productos.find(prod => prod.id === productoId);
    if (!p) return;

    const diferencia = calcularDiferenciaAuditoria(productoId);
    if (diferencia === null) {
        alert('Ingresa el conteo físico antes de aplicar el ajuste.');
        return;
    }

    const stockFisico = conteosFisicos[productoId];
    const stockAnterior = p.stock;

    if (diferencia !== 0 && !confirm(`¿Aplicar ajuste de inventario para "${p.nombre}"?\n\nStock Digital actual: ${stockAnterior}\nStock Físico contado: ${stockFisico}\nDiferencia: ${diferencia > 0 ? '+' : ''}${diferencia}\n\nEl Stock Digital se actualizará para coincidir con el Stock Físico.`)) {
        return;
    }

    // Actualiza el stock exclusivamente mediante el servicio formal de auditoría.
    if (!InventoryApp.StockService.ajuste(productoId, stockFisico)) {
        alert('No fue posible aplicar el ajuste de inventario.');
        return;
    }

    // Deja registro en el historial de auditoría.
    const registroAuditoria = {
        id: "AJ" + (auditorias.length + 1) + '_' + Date.now().toString().slice(-4),
        fecha: new Date().toISOString().replace('T', ' ').substring(0, 16),
        productoId: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        stockAnterior: stockAnterior,
        stockFisico: stockFisico,
        diferencia: diferencia,
        costo: Number(p.costo || 0),
        // La pérdida real por faltante se calcula al costo, no al precio de venta.
        // Si el conteo físico es menor que el digital, esas unidades no están disponibles
        // y representan una pérdida económica mientras no sean repuestas.
        perdidaUSD: diferencia < 0 ? Math.abs(diferencia) * Number(p.costo || 0) : 0
    };
    auditorias.push(registroAuditoria);

    // Sincronizar ajuste en Firestore
    if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.registrarAuditoria === 'function') {
        window.InventoryApp.Firebase.registrarAuditoria(registroAuditoria, productoId, stockFisico).catch(err => {
            console.warn('[Auditoria] Error sincronizando ajuste en Firestore:', err);
        });
    }

    delete conteosFisicos[productoId];

    renderizarInventario();
    renderizarPosProductos();
    renderizarAuditoria(document.getElementById('auditoria-search') ? document.getElementById('auditoria-search').value : "");
    renderizarHistorialAuditoria();
}

// Aplica en bloque todos los ajustes pendientes (todos los productos con conteo físico capturado).
function aplicarTodosLosAjustes() {
    const pendientes = Object.keys(conteosFisicos);
    if (pendientes.length === 0) {
        alert('No hay conteos físicos pendientes de aplicar.');
        return;
    }

    if (!confirm(`¿Aplicar ${pendientes.length} ajuste(s) de inventario pendiente(s)? El Stock Digital de cada producto se actualizará para coincidir con su Stock Físico contado.`)) {
        return;
    }

    pendientes.forEach(productoId => {
        const p = productos.find(prod => prod.id === productoId);
        if (!p) return;

        const diferencia = calcularDiferenciaAuditoria(productoId);
        const stockFisico = conteosFisicos[productoId];
        const stockAnterior = p.stock;

        if (!InventoryApp.StockService.ajuste(productoId, stockFisico)) return;

        auditorias.push({
            id: "AJ" + (auditorias.length + 1),
            fecha: new Date().toISOString().replace('T', ' ').substring(0, 16),
            productoId: p.id,
            codigo: p.codigo,
            nombre: p.nombre,
            stockAnterior: stockAnterior,
            stockFisico: stockFisico,
            diferencia: diferencia,
            costo: Number(p.costo || 0),
            perdidaUSD: diferencia < 0 ? Math.abs(diferencia) * Number(p.costo || 0) : 0
        });
    });

    conteosFisicos = {};

    renderizarInventario();
    renderizarPosProductos();
    renderizarAuditoria();
    renderizarHistorialAuditoria();
    renderizarResumenPerdidasEconomicas();
}

// Calcula la pérdida pendiente real, compensando faltantes con sobrantes/reposiciones
// posteriores del mismo producto. Se procesa en orden cronológico y cada sobrante
// reduce primero los faltantes pendientes (FIFO), para que una corrección sí quite la deuda.
