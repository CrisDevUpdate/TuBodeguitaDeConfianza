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

let estaSubiendoImagenProducto = false;
let promesaSubidaImagen = null;

async function procesarImagenProducto(archivo) {
    if (!archivo.type || !archivo.type.startsWith('image/')) {
        alert('Selecciona una imagen válida en formato JPG, PNG o WEBP.');
        return;
    }

    if (archivo.size > 5 * 1024 * 1024) {
        alert('La imagen supera el límite de 5 MB. Selecciona una imagen más liviana.');
        return;
    }

    const dropzone = document.getElementById('product-image-dropzone');
    const lector = new FileReader();
    lector.onload = () => {
        const imagen = new Image();
        imagen.onload = async () => {
            const maxDimension = 900;
            const escala = Math.min(1, maxDimension / Math.max(imagen.width, imagen.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(imagen.width * escala));
            canvas.height = Math.max(1, Math.round(imagen.height * escala));
            const contexto = canvas.getContext('2d');
            contexto.drawImage(imagen, 0, 0, canvas.width, canvas.height);
            
            const optimizadoDataUrl = canvas.toDataURL('image/webp', 0.85);
            productoImagenTemporal = optimizadoDataUrl;
            actualizarVistaImagenProducto('subiendo');

            // Subir a Vercel Blob
            try {
                estaSubiendoImagenProducto = true;
                if (dropzone) dropzone.classList.add('uploading-blob');

                if (window.InventoryApp && window.InventoryApp.ImageCache) {
                    const nombreBlob = `prod_${Date.now()}.webp`;
                    promesaSubidaImagen = window.InventoryApp.ImageCache.subirImagenVercelBlob(optimizadoDataUrl, 'productos', nombreBlob);
                    const resultado = await promesaSubidaImagen;
                    if (resultado && (resultado.viewUrl || resultado.url)) {
                        productoImagenTemporal = resultado.viewUrl || resultado.url;
                        console.log('[Productos] Imagen subida y asociada a Vercel Blob con éxito:', productoImagenTemporal);
                        actualizarVistaImagenProducto('completado');
                    } else {
                        actualizarVistaImagenProducto('listo');
                    }
                }
            } catch (blobErr) {
                console.warn('[Productos] Aviso al subir a Vercel Blob:', blobErr);
                actualizarVistaImagenProducto('error', blobErr.message);
            } finally {
                estaSubiendoImagenProducto = false;
                promesaSubidaImagen = null;
                if (dropzone) dropzone.classList.remove('uploading-blob');
            }
        };
        imagen.onerror = () => alert('No fue posible procesar la imagen seleccionada.');
        imagen.src = lector.result;
    };
    lector.onerror = () => alert('No fue posible leer la imagen seleccionada.');
    lector.readAsDataURL(archivo);
}

function actualizarVistaImagenProducto(estadoBlob = null) {
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

    // Indicador visual de estado Vercel Blob
    let statusBadge = document.getElementById('product-blob-status-badge');
    if (!statusBadge && preview) {
        statusBadge = document.createElement('div');
        statusBadge.id = 'product-blob-status-badge';
        statusBadge.style.cssText = 'margin-top:6px; font-size:0.75rem; font-weight:600; display:flex; align-items:center; justify-content:center; gap:6px; padding:4px 8px; border-radius:6px;';
        preview.appendChild(statusBadge);
    }

    if (statusBadge) {
        if (!tieneImagen) {
            statusBadge.innerHTML = '';
            statusBadge.style.display = 'none';
        } else if (estadoBlob === 'subiendo' || estaSubiendoImagenProducto) {
            statusBadge.style.display = 'flex';
            statusBadge.style.background = '#e0f2fe';
            statusBadge.style.color = '#0369a1';
            statusBadge.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo imagen a Vercel Blob...';
        } else if (estadoBlob === 'error') {
            statusBadge.style.display = 'flex';
            statusBadge.style.background = '#fee2e2';
            statusBadge.style.color = '#b91c1c';
            statusBadge.innerHTML = '<i class="fas fa-circle-exclamation"></i> Error al subir a Blob (reintentando...)';
        } else if (productoImagenTemporal && (productoImagenTemporal.includes('blob') || productoImagenTemporal.includes('/api/avatar/view'))) {
            statusBadge.style.display = 'flex';
            statusBadge.style.background = '#dcfce7';
            statusBadge.style.color = '#15803d';
            statusBadge.innerHTML = '<i class="fas fa-circle-check"></i> Almacenada en Vercel Blob';
        } else {
            statusBadge.innerHTML = '';
            statusBadge.style.display = 'none';
        }
    }
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

async function guardarProducto(e) {
    if (e && e.preventDefault) e.preventDefault();

    const id = document.getElementById('prod-id').value.trim();
    const descripcion = document.getElementById('prod-descripcion').value.trim();
    const contenido = document.getElementById('prod-contenido').value.trim();
    const btnSave = document.getElementById('btn-prod-save');
    const originalBtnHtml = btnSave ? btnSave.innerHTML : '';

    // Si la imagen todavía se está subiendo en segundo plano, esperar a que culmine
    if (estaSubiendoImagenProducto && promesaSubidaImagen) {
        if (btnSave) {
            btnSave.disabled = true;
            btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Finalizando subida a Blob...';
        }
        try {
            await promesaSubidaImagen;
        } catch (err) {
            console.warn('[Productos] Espera de subida:', err);
        }
    }

    // Si la imagen sigue en formato base64/dataURI temporal, asegurar la subida a Vercel Blob
    let imagenFinal = productoImagenTemporal || '';
    if (imagenFinal.startsWith('data:')) {
        if (btnSave) {
            btnSave.disabled = true;
            btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo imagen a Blob...';
        }
        try {
            if (window.InventoryApp && window.InventoryApp.ImageCache) {
                const resultado = await window.InventoryApp.ImageCache.subirImagenVercelBlob(imagenFinal, 'productos', `prod_${Date.now()}.webp`);
                if (resultado && (resultado.viewUrl || resultado.url)) {
                    imagenFinal = resultado.viewUrl || resultado.url;
                    productoImagenTemporal = imagenFinal;
                    console.log('[Productos] Imagen subida y asociada a Vercel Blob:', imagenFinal);
                    actualizarVistaImagenProducto('completado');
                }
            }
        } catch (uploadErr) {
            console.warn('[Productos] Aviso al subir imagen a Vercel Blob en guardado:', uploadErr);
            if (window.InventoryApp && window.InventoryApp.Modal && window.InventoryApp.Modal.toast) {
                window.InventoryApp.Modal.toast('Aviso: La imagen no pudo vincularse a Vercel Blob en este momento.', 'warning');
            }
        } finally {
            if (btnSave) {
                btnSave.disabled = false;
                btnSave.innerHTML = originalBtnHtml;
            }
        }
    }

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
        imagen: imagenFinal
    };

    let productoGuardado = null;
    if (id) {
        const idx = productos.findIndex(p => p.id === id);
        if (idx !== -1) {
            // Conservamos cualquier dato adicional del producto que ya exista.
            // Esto evita que editar Contenido/Medida borre la Descripción u otros campos.
            // Regla arquitectónica: editar un producto NO puede modificar stock.
            // El stock solo cambia mediante venta, retiro o auditoría.
            const stockActual = productos[idx].stock;
            productoGuardado = { ...productos[idx], ...datosProducto, stock: stockActual, id: productos[idx].id };
            productos[idx] = productoGuardado;
        }
    } else {
        // El ID interno nunca depende de la longitud del arreglo: no se reutiliza
        // aunque se eliminen productos durante la sesión.
        const nuevoId = `P${AppState.nextProductSequence++}`;
        productoGuardado = {
            id: nuevoId,
            ...datosProducto
        };
        productos.push(productoGuardado);
    }

    // Persistir directamente en Firebase Firestore
    if (productoGuardado && window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarProducto === 'function') {
        try {
            await window.InventoryApp.Firebase.guardarProducto(productoGuardado);
        } catch (err) {
            console.warn('[Productos] Error en guardado cloud:', err);
        }
    }

    if (window.InventoryApp && window.InventoryApp.Persistence) {
        window.InventoryApp.Persistence.guardar(true);
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
async function confirmarEliminacionProducto(event) {
    if (event && event.preventDefault) event.preventDefault();

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
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Cantidad Inválida', `La cantidad a retirar debe ser un número entero entre 1 y ${stockAntes}.`, 'warning');
        } else {
            alert(`La cantidad a retirar debe ser un número entero entre 1 y ${stockAntes}.`);
        }
        return;
    }

    if (!motivo || !comentario) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Campos Requeridos', 'Debes indicar el motivo de retiro y un comentario explicativo.', 'warning');
        } else {
            alert('Debes indicar el motivo de retiro y un comentario sobre el producto.');
        }
        return;
    }

    const indiceEliminado = productos.findIndex(prod => prod.id === productoId);
    const codigoAnterior = p.codigo;
    const nombre = p.nombre;
    const stockDespues = stockAntes - cantidad;
    const eliminaProductoCompleto = stockDespues === 0;

    const accionTexto = eliminaProductoCompleto
        ? 'Se retirará todo el stock y el producto será retirado del catálogo activo.'
        : `Se retirarán ${cantidad} unidades y quedarán ${stockDespues} unidades en inventario.`;

    const detalleHtml = `¿Confirmar retiro de <b>${cantidad} und(s)</b> de "${nombre}" (${codigoAnterior})?<br><br>` +
        `• <b>Motivo:</b> ${motivo}<br>` +
        `• <b>Comentario:</b> ${comentario}<br>` +
        `• <b>Resultado:</b> ${accionTexto}`;

    let confirmado = false;
    if (typeof showCustomConfirm === 'function') {
        confirmado = await showCustomConfirm('Confirmar Retiro / Baja de Producto', detalleHtml, 'warning');
    } else {
        confirmado = confirm(`¿Confirmar retiro de ${cantidad} und(s) de "${nombre}" (${codigoAnterior})?\nMotivo: ${motivo}`);
    }

    if (!confirmado) return;

    const registroEliminacion = {
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
    };
    eliminaciones.push(registroEliminacion);

    if (eliminaProductoCompleto) {
        productos.splice(indiceEliminado, 1);
        delete conteosFisicos[productoId];
        carrito = carrito.filter(item => item.productoId !== productoId);
    } else {
        if (!InventoryApp.StockService.retiro(productoId, cantidad)) {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Error', 'No fue posible aplicar el retiro de stock.', 'error');
            } else {
                alert('No fue posible aplicar el retiro de stock.');
            }
            return;
        }
        delete conteosFisicos[productoId];

        carrito = carrito.map(item => {
            if (item.productoId !== productoId) return item;
            return { ...item, cantidad: Math.min(item.cantidad, stockDespues) };
        }).filter(item => item.cantidad > 0);
    }

    // Sincronizar retiro en Firebase Firestore
    if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.registrarEliminacion === 'function') {
        window.InventoryApp.Firebase.registrarEliminacion(registroEliminacion, productoId, stockDespues).catch(err => {
            console.warn('[Productos] Error sincronizando eliminación en Firestore:', err);
        });
    }

    cerrarModalEliminarProducto();
    renderizarInventario();
    renderizarPosProductos();
    renderizarAuditoria(document.getElementById('auditoria-search') ? document.getElementById('auditoria-search').value : "");
    renderizarHistorialEliminaciones();

    if (typeof showCustomToast === 'function') {
        showCustomToast(`Retiro de ${cantidad} unds registrado para ${nombre}`, 'success');
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

async function limpiarHistorialEliminaciones() {
    if (eliminaciones.length === 0) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Historial Vacío', 'El historial ya está vacío.', 'info');
        } else {
            alert('El historial ya está vacío.');
        }
        return;
    }

    let confirmado = false;
    if (typeof showCustomConfirm === 'function') {
        confirmado = await showCustomConfirm('Limpiar Historial', '¿Seguro que deseas limpiar todo el historial de productos retirados? Esta acción no altera el stock digital.', 'warning');
    } else {
        confirmado = confirm('¿Seguro que deseas limpiar todo el historial de productos retirados?');
    }

    if (!confirmado) return;

    eliminaciones = [];
    renderizarHistorialEliminaciones();
    renderizarResumenPerdidasEconomicas();
    if (typeof showCustomToast === 'function') {
        showCustomToast('Historial de retiros limpiado', 'info');
    }
}

