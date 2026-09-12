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
            // Siguiendo los principios de la foto de perfil:
            // Escalado optimizado y liviano (~480px) para máxima nitidez y peso ultraligero (~20-35KB)
            const maxDimension = 480;
            const escala = Math.min(1, maxDimension / Math.max(imagen.width, imagen.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(imagen.width * escala));
            canvas.height = Math.max(1, Math.round(imagen.height * escala));
            const contexto = canvas.getContext('2d');
            contexto.drawImage(imagen, 0, 0, canvas.width, canvas.height);
            
            let optimizadoDataUrl = '';
            try {
                optimizadoDataUrl = canvas.toDataURL('image/webp', 0.85);
            } catch (e) {
                optimizadoDataUrl = canvas.toDataURL('image/jpeg', 0.85);
            }
            productoImagenTemporal = optimizadoDataUrl;
            actualizarVistaImagenProducto('subiendo');

            // Subir a Vercel Blob en segundo plano a través de la API segura
            try {
                estaSubiendoImagenProducto = true;
                if (dropzone) dropzone.classList.add('uploading-blob');

                if (window.InventoryApp && window.InventoryApp.ImageCache) {
                    const nombreBlob = `prod_${Date.now()}.webp`;
                    promesaSubidaImagen = window.InventoryApp.ImageCache.subirImagenVercelBlob(optimizadoDataUrl, 'productos', nombreBlob);
                    const resultado = await promesaSubidaImagen;
                    if (resultado && (resultado.viewUrl || resultado.url || resultado.pathname)) {
                        const finalBlobUrl = resultado.viewUrl || resultado.url || (resultado.pathname ? `/api/avatar/view?pathname=${encodeURIComponent(resultado.pathname)}` : optimizadoDataUrl);
                        productoImagenTemporal = finalBlobUrl;
                        console.log('[Productos] Imagen subida y asociada a Vercel Blob con éxito:', productoImagenTemporal);
                        actualizarVistaImagenProducto('completado');
                    } else {
                        actualizarVistaImagenProducto('listo');
                    }
                }
            } catch (blobErr) {
                // Siguiendo el principio de la foto de perfil: no bloqueamos ni alarmamos con errores,
                // mantenemos la copia optimizada local lista para guardar
                console.warn('[Productos] Aviso al subir a Vercel Blob, manteniendo copia optimizada:', blobErr);
                actualizarVistaImagenProducto('listo');
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
    const urlSegura = tieneImagen ? (typeof normalizarUrlBlob === 'function' ? normalizarUrlBlob(productoImagenTemporal) : productoImagenTemporal) : '';
    if (img) img.src = urlSegura;
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
            statusBadge.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando imagen con Vercel Blob...';
        } else if (productoImagenTemporal && (productoImagenTemporal.includes('blob') || productoImagenTemporal.includes('/api/avatar/view') || productoImagenTemporal.includes('/api/blob/view'))) {
            statusBadge.style.display = 'flex';
            statusBadge.style.background = '#dcfce7';
            statusBadge.style.color = '#15803d';
            statusBadge.innerHTML = '<i class="fas fa-circle-check"></i> Almacenada en Vercel Blob (carpeta: <strong>productos/</strong>) <button type="button" onclick="if(window.abrirModalVisorBlob) window.abrirModalVisorBlob();" style="margin-left:8px; border:none; background:none; color:#0369a1; text-decoration:underline; font-weight:700; cursor:pointer; font-size:0.75rem;">Ver fotos</button>';
        } else {
            statusBadge.style.display = 'flex';
            statusBadge.style.background = '#f1f5f9';
            statusBadge.style.color = '#475569';
            statusBadge.innerHTML = '<i class="fas fa-check"></i> Imagen optimizada lista para guardar';
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
            btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando imagen...';
        }
        try {
            await promesaSubidaImagen;
        } catch (err) {
            console.warn('[Productos] Espera de subida en segundo plano:', err);
        }
    }

    // Si la imagen sigue en formato base64/dataURI temporal, asegurar subida a Vercel Blob
    let imagenFinal = productoImagenTemporal || '';
    if (imagenFinal.startsWith('data:')) {
        if (btnSave) {
            btnSave.disabled = true;
            btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Vinculando a Vercel Blob...';
        }
        try {
            if (window.InventoryApp && window.InventoryApp.ImageCache) {
                const resultado = await window.InventoryApp.ImageCache.subirImagenVercelBlob(imagenFinal, 'productos', `prod_${Date.now()}.webp`);
                if (resultado && (resultado.viewUrl || resultado.url || resultado.pathname)) {
                    imagenFinal = resultado.viewUrl || resultado.url || (resultado.pathname ? `/api/avatar/view?pathname=${encodeURIComponent(resultado.pathname)}` : imagenFinal);
                    productoImagenTemporal = imagenFinal;
                    console.log('[Productos] Imagen sincronizada con Vercel Blob:', imagenFinal);
                    actualizarVistaImagenProducto('completado');
                }
            }
        } catch (uploadErr) {
            // Siguiendo los principios de la foto de perfil:
            // No emitimos aviso bloqueante de error ("Aviso: La imagen no pudo vincularse").
            // Mantenemos la copia optimizada local para que se guarde de forma segura
            // y se replique en Firestore y en los teléfonos de inmediato.
            console.warn('[Productos] Aviso al subir imagen a Vercel Blob en guardado, manteniendo copia optimizada:', uploadErr);
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
    if (typeof renderizarResumenPerdidasEconomicas === 'function') {
        renderizarResumenPerdidasEconomicas();
    }
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
                        ${p.imagen ? `<img src="${typeof normalizarUrlBlob === 'function' ? normalizarUrlBlob(p.imagen) : p.imagen}" alt="${p.nombre}" loading="lazy">` : '<i class="fas fa-box-open"></i>'}
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
    if (typeof renderizarResumenPerdidasEconomicas === 'function') {
        renderizarResumenPerdidasEconomicas();
    }

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

// --- CONSTRUCTOR DE COMBOS & OFERTAS CON CÁLCULO SEGURO DE PUNTOS ---
let itemsComboActual = [];

function abrirConstructorCombosAdmin() {
    itemsComboActual = [];
    const modal = document.getElementById('modal-admin-combo-builder');
    if (!modal) return;

    // Poblar selector de productos con costos
    const selectProd = document.getElementById('combo-select-producto');
    if (selectProd) {
        const prodsDisponibles = (productos || []).filter(p => !p.esCombo);
        selectProd.innerHTML = '<option value="">-- Seleccionar producto del inventario --</option>' +
            prodsDisponibles.map(p => `
                <option value="${p.id}" data-costo="${p.costo || 0}" data-nombre="${escaparHtmlInventario(p.nombre)}" data-stock="${p.stock || 0}">
                    ${p.codigo || ''} - ${p.nombre} (Costo: $${Number(p.costo || 0).toFixed(2)} | Stock: ${p.stock || 0})
                </option>
            `).join('');
    }

    // Auto-generar código de combo
    let maxComboNum = 0;
    (productos || []).forEach(p => {
        const c = String(p.codigo || '').toUpperCase();
        const m = c.match(/COMBO-(\d+)/);
        if (m) {
            const num = parseInt(m[1], 10);
            if (num > maxComboNum) maxComboNum = num;
        }
    });
    const codigoInput = document.getElementById('combo-builder-codigo');
    if (codigoInput) codigoInput.value = `COMBO-${String(maxComboNum + 1).padStart(3, '0')}`;

    const nombreInput = document.getElementById('combo-builder-nombre');
    if (nombreInput) nombreInput.value = '';

    const precioInput = document.getElementById('combo-builder-precio');
    if (precioInput) precioInput.value = '';

    const pctFidelidad = document.getElementById('combo-builder-pct-fidelidad');
    if (pctFidelidad) pctFidelidad.value = '15';

    const factorInput = document.getElementById('combo-builder-factor-puntos');
    if (factorInput) factorInput.value = '10';

    const descInput = document.getElementById('combo-builder-desc');
    if (descInput) descInput.value = 'Super Combo Promocional con Puntos Especiales';

    renderizarItemsComboModal();
    recalcularMatematicaComboModal();
    modal.style.display = 'flex';
}

function cerrarConstructorCombosAdmin() {
    const modal = document.getElementById('modal-admin-combo-builder');
    if (modal) modal.style.display = 'none';
}

function agregarProductoAComboAdmin() {
    const select = document.getElementById('combo-select-producto');
    const cantInput = document.getElementById('combo-item-cantidad');
    if (!select || !select.value) {
        alert('Por favor selecciona un producto del catálogo.');
        return;
    }

    const prodId = select.value;
    const prod = (productos || []).find(p => p.id === prodId);
    if (!prod) return;

    const cantidad = Math.max(1, parseInt(cantInput?.value, 10) || 1);
    const itemExistente = itemsComboActual.find(i => i.productoId === prodId);

    if (itemExistente) {
        itemExistente.cantidad += cantidad;
    } else {
        itemsComboActual.push({
            productoId: prod.id,
            codigo: prod.codigo || '',
            nombre: prod.nombre,
            costoUnitario: Number(prod.costo || 0),
            cantidad: cantidad
        });
    }

    if (cantInput) cantInput.value = '1';
    select.value = '';

    renderizarItemsComboModal();
    recalcularMatematicaComboModal();
}

function eliminarItemDeComboAdmin(index) {
    if (index >= 0 && index < itemsComboActual.length) {
        itemsComboActual.splice(index, 1);
        renderizarItemsComboModal();
        recalcularMatematicaComboModal();
    }
}

function renderizarItemsComboModal() {
    const tbody = document.getElementById('combo-items-table-body');
    const emptyMsg = document.getElementById('combo-items-empty-msg');
    if (!tbody) return;

    if (itemsComboActual.length === 0) {
        tbody.innerHTML = '';
        if (emptyMsg) emptyMsg.style.display = 'block';
        return;
    }

    if (emptyMsg) emptyMsg.style.display = 'none';
    tbody.innerHTML = itemsComboActual.map((item, idx) => {
        const subtotalCosto = item.costoUnitario * item.cantidad;
        return `
            <tr>
                <td style="font-weight:600; color:#1e293b;">${item.nombre}</td>
                <td style="text-align:center;">
                    <span style="display:inline-block; padding:2px 8px; background:#e2e8f0; border-radius:6px; font-weight:700;">
                        ${item.cantidad}
                    </span>
                </td>
                <td class="num">$${item.costoUnitario.toFixed(2)}</td>
                <td class="num" style="font-weight:700; color:#0f172a;">$${subtotalCosto.toFixed(2)}</td>
                <td style="text-align:center;">
                    <button type="button" class="btn btn-danger" onclick="eliminarItemDeComboAdmin(${idx})" style="padding:3px 8px; font-size:0.75rem;">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function recalcularMatematicaComboModal() {
    // 1. Costo Base Consolidado
    const costoTotal = itemsComboActual.reduce((acc, item) => acc + (item.costoUnitario * item.cantidad), 0);
    const costoTotalEl = document.getElementById('combo-builder-costo-total');
    if (costoTotalEl) costoTotalEl.textContent = `$${costoTotal.toFixed(2)}`;

    // 2. Precio de Venta
    const precioInput = document.getElementById('combo-builder-precio');
    const precioVenta = Math.max(0, parseFloat(precioInput?.value) || 0);

    // 3. Ganancia Neta
    const margenNeto = Math.max(0, precioVenta - costoTotal);
    const margenEl = document.getElementById('combo-builder-margen-neto');
    if (margenEl) {
        margenEl.textContent = `$${margenNeto.toFixed(2)}`;
        margenEl.style.color = margenNeto > 0 ? '#059669' : '#dc2626';
    }

    // 4. Parámetros de Fidelización
    const pctFidelidad = Math.min(100, Math.max(1, parseFloat(document.getElementById('combo-builder-pct-fidelidad')?.value) || 15));
    const factorPuntos = Math.max(1, parseFloat(document.getElementById('combo-builder-factor-puntos')?.value) || 10);

    // 5. Puntos Sugeridos Seguros
    const puntosSugeridos = Math.max(1, Math.floor(margenNeto * (pctFidelidad / 100) * factorPuntos));
    const sugeridosEl = document.getElementById('combo-builder-puntos-sugeridos');
    if (sugeridosEl) sugeridosEl.textContent = `${puntosSugeridos} Pts`;

    // 6. Input de Puntos Asignados
    const puntosInput = document.getElementById('combo-builder-puntos');
    if (puntosInput && (!puntosInput.dataset.manual || puntosInput.value === '')) {
        puntosInput.value = puntosSugeridos;
    }

    const puntosAsignados = parseInt(puntosInput?.value, 10) || puntosSugeridos;

    // 7. Alerta de Rentabilidad
    const alertaEl = document.getElementById('combo-builder-alerta-rentabilidad');
    const valorMonetarioPuntos = puntosAsignados / factorPuntos;
    const superaMargen = valorMonetarioPuntos > margenNeto;

    if (alertaEl) {
        if (precioVenta > 0 && superaMargen) {
            alertaEl.style.display = 'block';
            alertaEl.innerHTML = `
                <i class="fas fa-triangle-exclamation"></i> 
                <strong>Advertencia de Margen:</strong> Los puntos asignados equivalen a $${valorMonetarioPuntos.toFixed(2)} en costo de fidelización, superando la ganancia neta ($${margenNeto.toFixed(2)}). Reduce los puntos para garantizar rentabilidad.
            `;
        } else {
            alertaEl.style.display = 'none';
        }
    }

    // 8. Preview Badge del Catálogo
    const previewBadge = document.getElementById('combo-builder-preview-badge');
    if (previewBadge) {
        previewBadge.innerHTML = `🔥 Super Combo: +${puntosAsignados} Puntos`;
    }
}

async function guardarComboAdmin(e) {
    if (e && e.preventDefault) e.preventDefault();

    if (itemsComboActual.length === 0) {
        alert('Debes agregar al menos un producto al combo.');
        return;
    }

    const nombre = (document.getElementById('combo-builder-nombre')?.value || '').trim();
    const codigo = (document.getElementById('combo-builder-codigo')?.value || '').trim() || `COMBO-${Date.now()}`;
    const precio = parseFloat(document.getElementById('combo-builder-precio')?.value) || 0;
    const desc = (document.getElementById('combo-builder-desc')?.value || '').trim();
    const puntos = parseInt(document.getElementById('combo-builder-puntos')?.value, 10) || 1;

    const costoTotal = itemsComboActual.reduce((acc, item) => acc + (item.costoUnitario * item.cantidad), 0);

    if (!nombre) {
        alert('Por favor ingresa el nombre del combo.');
        return;
    }
    if (precio <= 0) {
        alert('El precio de venta del combo debe ser mayor a 0.');
        return;
    }
    if (precio < costoTotal) {
        const confirmar = confirm(`El precio de venta ($${precio.toFixed(2)}) es menor que el costo consolidado ($${costoTotal.toFixed(2)}). ¿Deseas continuar de todos modos?`);
        if (!confirmar) return;
    }

    // Calcular stock disponible basado en los ingredientes/productos incluidos
    let stockCalculado = 999;
    itemsComboActual.forEach(item => {
        const prod = (productos || []).find(p => p.id === item.productoId);
        if (prod) {
            const disponibles = Math.floor(Number(prod.stock || 0) / Number(item.cantidad || 1));
            if (disponibles < stockCalculado) stockCalculado = disponibles;
        }
    });
    if (stockCalculado < 0 || stockCalculado === 999) stockCalculado = 10;

    const nuevoCombo = {
        id: 'combo_' + Date.now(),
        codigo: codigo,
        nombre: nombre,
        descripcion: desc || 'Super Combo con puntos especiales',
        costo: Number(costoTotal.toFixed(2)),
        precio: Number(precio.toFixed(2)),
        ganancia: costoTotal > 0 ? Math.round(((precio - costoTotal) / costoTotal) * 100) : 100,
        stock: stockCalculado,
        categoria: 'Combos & Ofertas',
        esCombo: true,
        tipo: 'combo',
        isCombo: true,
        items: itemsComboActual,
        puntosCombo: puntos,
        points_given: puntos,
        margenNetoUnitario: Number((precio - costoTotal).toFixed(2)),
        badge: `🔥 Super Combo: +${puntos} Puntos`,
        imagen: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80',
        fechaCreacion: new Date().toISOString()
    };

    productos.push(nuevoCombo);
    AppState.productos = productos;

    // Sincronizar con Firestore si está disponible
    if (window.InventoryApp?.Firebase) {
        if (typeof window.InventoryApp.Firebase.guardarProducto === 'function') {
            window.InventoryApp.Firebase.guardarProducto(nuevoCombo).catch(e => console.warn('[Combo] Error guardando producto en Firestore:', e));
        }
    }

    // Guardar persistencia local
    if (window.InventoryApp?.Persistence?.guardar) {
        window.InventoryApp.Persistence.guardar(true);
    }

    renderizarInventario();
    if (typeof renderizarCatalogoCliente === 'function') {
        renderizarCatalogoCliente();
    }

    cerrarConstructorCombosAdmin();

    if (window.InventoryApp?.Modal?.alert) {
        window.InventoryApp.Modal.alert(
            '¡Combo Creado!',
            `El combo "${nombre}" (${codigo}) ha sido guardado exitosamente.\nPuntos asignados: +${puntos} Pts.\nMargen Neto: $${(precio - costoTotal).toFixed(2)}.`
        );
    } else {
        alert(`¡Combo "${nombre}" creado exitosamente con +${puntos} Puntos!`);
    }
}

window.abrirConstructorCombosAdmin = abrirConstructorCombosAdmin;
window.cerrarConstructorCombosAdmin = cerrarConstructorCombosAdmin;
window.agregarProductoAComboAdmin = agregarProductoAComboAdmin;
window.eliminarItemDeComboAdmin = eliminarItemDeComboAdmin;
window.recalcularMatematicaComboModal = recalcularMatematicaComboModal;
window.guardarComboAdmin = guardarComboAdmin;

