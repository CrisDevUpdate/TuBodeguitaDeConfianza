// --- INVENTARIO Y PRECIOS ---
// Genera el siguiente código de producto automáticamente.
// Ejemplo: PROD-001, PROD-002, PROD-003 -> PROD-004.
// No depende del índice del arreglo: toma el mayor número existente.
function generarSiguienteCodigoProducto() {
    let mayorNumero = 0;

    productos.forEach(p => {
        const codigo = String(p.codigo || '').trim().toUpperCase();
        const match = codigo.match(/(\d+)$/);
        if (match) {
            const numero = parseInt(match[1], 10);
            if (Number.isFinite(numero) && numero > mayorNumero) {
                mayorNumero = numero;
            }
        }
    });

    return `PROD-${String(mayorNumero + 1).padStart(3, '0')}`;
}

function prepararCodigoNuevoProducto() {
    const idInput = document.getElementById('prod-id');
    const codigoInput = document.getElementById('prod-codigo');
    const boton = document.getElementById('btn-prod-save');
    if (!codigoInput || !idInput) return;

    // Solo se genera automáticamente al crear un producto nuevo.
    const stockInput = document.getElementById('prod-stock');
    if (!idInput.value) {
        codigoInput.value = generarSiguienteCodigoProducto();
        codigoInput.readOnly = true;
        if (stockInput) {
            stockInput.readOnly = false;
            stockInput.title = 'Stock inicial del nuevo producto.';
        }
        if (boton) boton.textContent = 'Guardar Producto';
    }
}

function calcularPreciosDesdeCosto() {
    const costo = parseFloat(document.getElementById('prod-costo').value) || 0;
    const ganancia = parseFloat(document.getElementById('prod-ganancia').value) || 0;
    const precioSugerido = costo * (1 + (ganancia / 100));
    document.getElementById('prod-precio').value = precioSugerido.toFixed(2);
}

function calcularGananciaDesdePrecio() {
    const costo = parseFloat(document.getElementById('prod-costo').value) || 0;
    const precio = parseFloat(document.getElementById('prod-precio').value) || 0;
    if (costo > 0) {
        const gananciaCalculada = ((precio - costo) / costo) * 100;
        document.getElementById('prod-ganancia').value = gananciaCalculada.toFixed(2);
    }
}

// --- IMAGEN Y PRESENTACIÓN DEL PRODUCTO ---
function abrirSelectorImagenProducto() {
    const input = document.getElementById('prod-imagen-input');
    if (input) input.click();
}

function seleccionarImagenProducto(event) {
    const archivo = event.target.files && event.target.files[0];
    if (archivo) procesarImagenProducto(archivo);
}

function cambiarImagenProducto(event) {
    if (event) event.stopPropagation();
    abrirSelectorImagenProducto();
}

function eliminarImagenProducto(event) {
    if (event) event.stopPropagation();
    productoImagenTemporal = '';
    const input = document.getElementById('prod-imagen-input');
    if (input) input.value = '';
    actualizarVistaImagenProducto();
}

function manejarDragImagenProducto(event) {
    event.preventDefault();
    event.stopPropagation();
    const dropzone = document.getElementById('product-image-dropzone');
    if (dropzone) dropzone.classList.add('drag-over');
}

function manejarDragLeaveImagenProducto(event) {
    event.preventDefault();
    event.stopPropagation();
    const dropzone = document.getElementById('product-image-dropzone');
    if (dropzone && !dropzone.contains(event.relatedTarget)) dropzone.classList.remove('drag-over');
}

function manejarDropImagenProducto(event) {
    event.preventDefault();
    event.stopPropagation();
    const dropzone = document.getElementById('product-image-dropzone');
    if (dropzone) dropzone.classList.remove('drag-over');
    const archivo = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (archivo) procesarImagenProducto(archivo);
}

function procesarImagenProducto(archivo) {
    if (!archivo.type || !archivo.type.startsWith('image/')) {
        alert('Selecciona una imagen válida en formato JPG, PNG o WEBP.');
        return;
    }

    if (archivo.size > 2 * 1024 * 1024) {
        alert('La imagen supera el límite de 2 MB. Selecciona una imagen más liviana.');
        return;
    }

    const lector = new FileReader();
    lector.onload = () => {
        const imagen = new Image();
        imagen.onload = () => {
            const maxDimension = 900;
            const escala = Math.min(1, maxDimension / Math.max(imagen.width, imagen.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(imagen.width * escala));
            canvas.height = Math.max(1, Math.round(imagen.height * escala));
            const contexto = canvas.getContext('2d');
            contexto.drawImage(imagen, 0, 0, canvas.width, canvas.height);
            productoImagenTemporal = canvas.toDataURL('image/jpeg', 0.82);
            actualizarVistaImagenProducto();
        };
        imagen.onerror = () => alert('No fue posible procesar la imagen seleccionada.');
        imagen.src = lector.result;
    };
    lector.onerror = () => alert('No fue posible leer la imagen seleccionada.');
    lector.readAsDataURL(archivo);
}

function actualizarVistaImagenProducto() {
    const empty = document.getElementById('product-image-empty');
    const preview = document.getElementById('product-image-preview');
    const actions = document.getElementById('product-image-actions');
    const img = document.getElementById('prod-imagen-preview');
    const dropzone = document.getElementById('product-image-dropzone');

    const tieneImagen = Boolean(productoImagenTemporal);
    if (empty) empty.hidden = tieneImagen;
    if (preview) preview.hidden = !tieneImagen;
    if (actions) actions.hidden = !tieneImagen;
    if (img) img.src = tieneImagen ? productoImagenTemporal : '';
    if (dropzone) dropzone.classList.toggle('has-image', tieneImagen);
}

function resetearFormularioProducto() {
    const form = document.getElementById('form-producto');
    if (form) form.reset();
    const id = document.getElementById('prod-id');
    if (id) id.value = '';
    const input = document.getElementById('prod-imagen-input');
    if (input) input.value = '';
    productoImagenTemporal = '';
    actualizarVistaImagenProducto();
    const stockInput = document.getElementById('prod-stock');
    if (stockInput) {
        stockInput.readOnly = false;
        stockInput.title = 'Stock inicial del nuevo producto.';
    }
    const boton = document.getElementById('btn-prod-save');
    if (boton) boton.innerHTML = '<i class="fas fa-save"></i> Guardar Producto';
}

function guardarProducto(e) {
    e.preventDefault();

    const id = document.getElementById('prod-id').value.trim();
    const descripcion = document.getElementById('prod-descripcion').value.trim();
    const contenido = document.getElementById('prod-contenido').value.trim();

    // IMPORTANTE: Descripción y Contenido/Medida son campos independientes.
    // Nunca usamos uno para construir o reemplazar el otro.
    const datosProducto = {
        codigo: document.getElementById('prod-codigo').value,
        nombre: document.getElementById('prod-nombre').value,
        costo: parseFloat(document.getElementById('prod-costo').value),
        ganancia: parseFloat(document.getElementById('prod-ganancia').value),
        precio: parseFloat(document.getElementById('prod-precio').value),
        stock: parseInt(document.getElementById('prod-stock').value),
        descripcion,
        contenido,
        imagen: productoImagenTemporal || ''
    };

    if (id) {
        const idx = productos.findIndex(p => p.id === id);
        if (idx !== -1) {
            // Conservamos cualquier dato adicional del producto que ya exista.
            // Esto evita que editar Contenido/Medida borre la Descripción u otros campos.
            // Regla arquitectónica: editar un producto NO puede modificar stock.
        // El stock solo cambia mediante venta, retiro o auditoría.
        const stockActual = productos[idx].stock;
        productos[idx] = { ...productos[idx], ...datosProducto, stock: stockActual, id: productos[idx].id };
        }
    } else {
        // El ID interno nunca depende de la longitud del arreglo: no se reutiliza
        // aunque se eliminen productos durante la sesión.
        const nuevoId = `P${AppState.nextProductSequence++}`;
        productos.push({
            id: nuevoId,
            ...datosProducto
        });
    }

    resetearFormularioProducto();
    prepararCodigoNuevoProducto();

    renderizarInventario();
    renderizarPosProductos();
    renderizarAuditoria(document.getElementById('auditoria-search') ? document.getElementById('auditoria-search').value : "");
}

function editarProducto(id) {
    const p = productos.find(prod => prod.id === id);
    if (!p) return;

    document.getElementById('prod-id').value = p.id;
    document.getElementById('prod-codigo').value = p.codigo;
    document.getElementById('prod-codigo').readOnly = true;
    document.getElementById('prod-nombre').value = p.nombre;
    document.getElementById('prod-costo').value = p.costo;
    document.getElementById('prod-ganancia').value = p.ganancia;
    document.getElementById('prod-precio').value = p.precio;
    document.getElementById('prod-stock').value = p.stock;
    document.getElementById('prod-stock').readOnly = true;
    document.getElementById('prod-stock').title = 'El stock solo se modifica mediante Venta, Retiro o Auditoría.';
    // Cargamos cada campo desde su propia propiedad.
    // Compatibilidad con registros antiguos: si existía "description", también lo recuperamos.
    document.getElementById('prod-descripcion').value = p.descripcion ?? p.description ?? '';
    document.getElementById('prod-contenido').value = p.contenido ?? p.medida ?? p.presentacion ?? '';

    productoImagenTemporal = p.imagen || '';
    actualizarVistaImagenProducto();

    document.getElementById('btn-prod-save').innerHTML = '<i class="fas fa-save"></i> Actualizar Producto';
}

function normalizarDatosProducto(p) {
    if (!p || typeof p !== 'object') return p;

    // Migración segura de datos anteriores. La descripción y el contenido
    // permanecen separados aunque el producto haya sido creado con una versión vieja.
    if (p.descripcion === undefined && p.description !== undefined) {
        p.descripcion = p.description;
    }
    if (p.contenido === undefined) {
        p.contenido = p.medida ?? p.presentacion ?? '';
    }

    return p;
}

function normalizarProductos() {
    productos = productos.map(normalizarDatosProducto);
}

function renderizarInventario() {
    normalizarProductos();
    const tbody = document.getElementById('inventario-body');

    // Valor del inventario a costo: cuánto dinero está invertido actualmente en stock.
    const totalCosto = productos.reduce((total, p) => {
        return total + (Number(p.costo) || 0) * (Number(p.stock) || 0);
    }, 0);

    // Ganancia esperada si se vende todo el stock al precio de venta configurado.
    const gananciaEsperada = productos.reduce((total, p) => {
        return total + ((Number(p.precio) || 0) - (Number(p.costo) || 0)) * (Number(p.stock) || 0);
    }, 0);

    const totalCostoUsd = document.getElementById('inventario-total-costo-usd');
    const totalCostoBs = document.getElementById('inventario-total-costo-ves');
    const gananciaUsd = document.getElementById('inventario-ganancia-esperada-usd');
    const gananciaBs = document.getElementById('inventario-ganancia-esperada-ves');

    if (totalCostoUsd) totalCostoUsd.textContent = `$${totalCosto.toFixed(2)}`;
    if (totalCostoBs) totalCostoBs.textContent = `Bs. ${tasaActiva > 0 ? (totalCosto * tasaActiva).toFixed(2) : '—'}`;
    if (gananciaUsd) gananciaUsd.textContent = `$${gananciaEsperada.toFixed(2)}`;
    if (gananciaBs) gananciaBs.textContent = `Bs. ${tasaActiva > 0 ? (gananciaEsperada * tasaActiva).toFixed(2) : '—'}`;

    tbody.innerHTML = productos.map(p => `
        <tr>
            <td>${p.codigo}</td>
            <td>
                <div class="inventory-product-cell">
                    <div class="inventory-product-thumb">
                        ${p.imagen ? `<img src="${p.imagen}" alt="${p.nombre}" loading="lazy">` : '<i class="fas fa-box-open"></i>'}
                    </div>
                    <div>
                        <div class="inventory-product-name">${p.nombre}</div>
                    </div>
                </div>
            </td>
            <td class="inventory-description">${p.descripcion ? escaparHtmlInventario(p.descripcion) : '<span class="inventory-empty">Sin descripción</span>'}</td>
            <td class="inventory-content-cell">${p.contenido ? escaparHtmlInventario(p.contenido) : '<span class="inventory-empty">—</span>'}</td>
            <td class="num">$${p.costo.toFixed(2)}</td>
            <td class="num">${p.ganancia}%</td>
            <td class="num"><strong>$${p.precio.toFixed(2)}</strong></td>
            <td class="num">Bs. ${tasaActiva > 0 ? (p.precio * tasaActiva).toFixed(2) : '—'}</td>
            <td class="num">${p.stock}</td>
            <td class="inventory-actions">
                <button class="btn btn-warning" onclick="editarProducto('${p.id}')">Editar</button>
                <button class="btn btn-danger" onclick="abrirModalEliminarProducto('${p.id}')">Retirar</button>
            </td>
        </tr>
    `).join('');

    renderizarHistorialEliminaciones();
    renderizarResumenPerdidasEconomicas();
}

// Calcula el valor de una baja que representa pérdida económica.
// Daño, vencimiento y merma/pérdida se contabilizan al costo de compra.
function esMotivoConPerdidaProducto(motivo = '') {
    const m = motivo.toLowerCase();
    return m.includes('dañado') || m.includes('vencido') || m.includes('pérdida') || m.includes('merma');
}

function calcularPerdidaBajaProducto(motivo, cantidad, costo) {
    return esMotivoConPerdidaProducto(motivo) ? Math.max(0, Number(cantidad) || 0) * Math.max(0, Number(costo) || 0) : 0;
}

// Abre el formulario de retiro del producto. El código no se puede cambiar desde aquí:
// al confirmar la eliminación, los productos restantes se renumeran automáticamente.
function abrirModalEliminarProducto(productoId) {
    const p = productos.find(prod => prod.id === productoId);
    if (!p) return;

    const modal = document.getElementById('modal-eliminar-producto');
    const productoIdInput = document.getElementById('eliminar-producto-id');
    const codigo = document.getElementById('eliminar-producto-codigo');
    const nombre = document.getElementById('eliminar-producto-nombre');
    const stockActual = document.getElementById('eliminar-stock-actual');
    const cantidad = document.getElementById('eliminar-cantidad');
    const comentario = document.getElementById('eliminar-comentario');
    const motivo = document.getElementById('eliminar-motivo');

    if (!modal || !productoIdInput || !codigo || !nombre || !stockActual || !cantidad || !comentario || !motivo) return;

    productoIdInput.value = p.id;
    codigo.value = p.codigo;
    nombre.value = p.nombre;
    stockActual.value = Number(p.stock) || 0;
    cantidad.value = '';
    cantidad.max = Math.max(0, Number(p.stock) || 0);
    comentario.value = '';
    motivo.value = '';
    modal.classList.add('active');
    setTimeout(() => cantidad.focus(), 50);
}

function cerrarModalEliminarProducto() {
    const modal = document.getElementById('modal-eliminar-producto');
    if (modal) modal.classList.remove('active');
}

// Retira una cantidad de unidades. Si se retira todo el stock, el producto se elimina
// y los códigos posteriores se corren hacia atrás.
function confirmarEliminacionProducto(event) {
    event.preventDefault();

    const productoId = document.getElementById('eliminar-producto-id').value;
    const motivo = document.getElementById('eliminar-motivo').value.trim();
    const comentario = document.getElementById('eliminar-comentario').value.trim();
    const cantidad = parseInt(document.getElementById('eliminar-cantidad').value, 10);
    const p = productos.find(prod => prod.id === productoId);

    if (!p) {
        cerrarModalEliminarProducto();
        return;
    }

    const stockAntes = Number(p.stock) || 0;

    if (!Number.isInteger(cantidad) || cantidad <= 0 || cantidad > stockAntes) {
        alert(`La cantidad a retirar debe ser un número entero entre 1 y ${stockAntes}.`);
        return;
    }

    if (!motivo || !comentario) {
        alert('Debes indicar el motivo de retiro y un comentario sobre el producto.');
        return;
    }

    const indiceEliminado = productos.findIndex(prod => prod.id === productoId);
    const codigoAnterior = p.codigo;
    const nombre = p.nombre;
    const stockDespues = stockAntes - cantidad;
    const eliminaProductoCompleto = stockDespues === 0;

    const accionTexto = eliminaProductoCompleto
        ? 'Se retirará todo el stock y el producto será eliminado del listado. Los códigos posteriores se correrán hacia atrás.'
        : `Se retirarán ${cantidad} unidades y quedarán ${stockDespues} unidades en inventario. El código del producto se conservará.`;

    if (!confirm(`¿Confirmar retiro de ${cantidad} unidad(es) de "${nombre}" (${codigoAnterior})?\n\nMotivo: ${motivo}\n\n${accionTexto}`)) {
        return;
    }

    eliminaciones.push({
        id: 'EL' + Date.now(),
        fecha: new Date().toLocaleString('es-VE'),
        productoId: p.id,
        codigo: codigoAnterior,
        nombre,
        stockAntes,
        cantidadRetirada: cantidad,
        stockDespues,
        stock: stockAntes,
        costo: p.costo,
        precio: p.precio,
        motivo,
        comentario,
        perdidaUSD: calcularPerdidaBajaProducto(motivo, cantidad, p.costo),
        tipo: eliminaProductoCompleto ? 'Eliminación completa' : 'Retiro parcial'
    });

    if (eliminaProductoCompleto) {
        productos.splice(indiceEliminado, 1);
        delete conteosFisicos[productoId];
        carrito = carrito.filter(item => item.productoId !== productoId);

        // Renumeración completa, conservando el orden actual del inventario.
        productos.forEach((producto, index) => {
            producto.codigo = `PROD-${String(index + 1).padStart(3, '0')}`;
        });
    } else {
        if (!InventoryApp.StockService.retiro(productoId, cantidad)) {
            alert('No fue posible aplicar el retiro de stock.');
            return;
        }
        // El conteo físico pendiente se limpia porque el stock digital acaba de cambiar.
        delete conteosFisicos[productoId];

        // Si el producto está en el carrito y supera el stock disponible, se limita al nuevo stock.
        carrito = carrito.map(item => {
            if (item.productoId !== productoId) return item;
            return { ...item, cantidad: Math.min(item.cantidad, stockDespues) };
        }).filter(item => item.cantidad > 0);
    }

    resetearFormularioProducto();
    prepararCodigoNuevoProducto();

    cerrarModalEliminarProducto();
    renderizarInventario();
    renderizarPosProductos();
    renderizarCarrito();
    renderizarAuditoria(document.getElementById('auditoria-search') ? document.getElementById('auditoria-search').value : '');
    renderizarHistorialAuditoria();
    renderizarHistorialEliminaciones();

    if (eliminaProductoCompleto) {
        alert(`Se retiraron las ${cantidad} unidades y el producto fue eliminado. Los códigos posteriores fueron corridos hacia atrás.`);
    } else {
        alert(`Se retiraron ${cantidad} unidades de ${nombre}. Stock restante: ${stockDespues}.`);
    }
}

function renderizarHistorialEliminaciones() {
    const tbody = document.getElementById('eliminaciones-body');
    if (!tbody) return;

    if (eliminaciones.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color: var(--text-muted);">Aún no hay retiros registrados.</td></tr>';
        return;
    }

    tbody.innerHTML = [...eliminaciones].reverse().map(e => `
        <tr>
            <td>${e.fecha}</td>
            <td>${e.codigo}</td>
            <td>${e.nombre}</td>
            <td class="num">${Number(e.stockAntes ?? e.stock ?? 0)}</td>
            <td class="num">${Number(e.cantidadRetirada ?? e.stock ?? 0)}</td>
            <td class="num">${Number(e.stockDespues ?? 0)}</td>
            <td>${e.motivo}</td>
            <td>${e.comentario}</td>
            <td class="num">$${Number(e.costo || 0).toFixed(2)}</td>
            <td class="num" style="color:${Number(e.perdidaUSD || 0) > 0 ? 'var(--danger)' : 'var(--text-muted)'}; font-weight:700;">${Number(e.perdidaUSD || 0) > 0 ? '-$' : '$'}${Number(e.perdidaUSD || 0).toFixed(2)}</td>
        </tr>
    `).join('');
}

function limpiarHistorialEliminaciones() {
    if (eliminaciones.length === 0) {
        alert('El historial ya está vacío.');
        return;
    }

    if (!confirm('¿Seguro que deseas limpiar todo el historial de productos retirados? Esta acción no cambia el inventario; solo borra los registros del historial.')) {
        return;
    }

    eliminaciones = [];
    renderizarHistorialEliminaciones();
    renderizarResumenPerdidasEconomicas();
    alert('Historial de retiros limpiado correctamente.');
}

