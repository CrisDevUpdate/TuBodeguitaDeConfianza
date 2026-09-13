// --- ESTADO Y DATOS DE LA APLICACIÓN ---
let tasaActiva = 0;
let tasaUSD_BCV = 0;
let tasaEUR_BCV = 0;
let fechaTasaBCV = null;
let monedaSeleccionada = 'USD';

let productos = [];
let clientes = [];
let ventas = [];
let abonos = [];
let transacciones = [];

let carrito = [];
let clienteSeleccionadoId = null;
let productoImagenTemporal = '';

// --- ESTADO DEL MÓDULO DE AUDITORÍA E INVENTARIO FÍSICO ---
// conteosFisicos: conteos capturados aún NO aplicados como ajuste { productoId: cantidadFisica }
let conteosFisicos = {};
// auditorias: historial permanente de ajustes ya aplicados al Stock Digital
let auditorias = [];
// eliminaciones: historial de productos retirados del inventario, con motivo y comentarios.
let eliminaciones = [];
// Historial de clientes eliminados, conservando el motivo y comentario para auditoría.
let clientesEliminados = [];

// --- INICIALIZACIÓN ---
document.addEventListener("DOMContentLoaded", () => {
    // Cada apertura del archivo consulta nuevamente las tasas.
    obtenerTasaOficialBCV();

    renderizarPosProductos();
    renderizarInventario();
    renderizarClientes();
    renderizarHistorialClientesEliminados();
    actualizarSelectClientes();
    renderizarAuditoria();
    renderizarHistorialAuditoria();
    renderizarResumenPerdidasEconomicas();
    actualizarSelectTransacciones();
    renderizarTransacciones();
    prepararCodigoNuevoProducto();
    actualizarVistaImagenProducto();
});

// --- CONEXIÓN BCV API EN VIVO ---
async function obtenerTasaOficialBCV() {
    const lblTasa = document.getElementById('tasaActual');
    const lblFecha = document.getElementById('fechaActualizacion');
    const status = document.getElementById('bcv-sync-status');
    const fechaInventario = document.getElementById('inventario-fecha-tasa');
    const horaInventario = document.getElementById('inventario-hora-consulta');

    const setStatus = (tipo, texto, icono) => {
        if (!status) return;
        status.className = `bcv-sync-status ${tipo || ''}`;
        status.innerHTML = `<i class="fas ${icono}"></i> ${texto}`;
    };

    const formatearBs = (valor) => Number(valor).toLocaleString('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    const actualizarTarjetaInventario = () => {
        const usd = document.getElementById('inventario-tasa-usd');
        const eur = document.getElementById('inventario-tasa-eur');

        if (usd) usd.textContent = tasaUSD_BCV > 0 ? formatearBs(tasaUSD_BCV) : 'No disponible';
        if (eur) eur.textContent = tasaEUR_BCV > 0 ? formatearBs(tasaEUR_BCV) : 'No disponible';

        if (fechaInventario) {
            fechaInventario.textContent = fechaTasaBCV || 'No disponible';
        }

        if (horaInventario) {
            horaInventario.textContent = new Date().toLocaleTimeString('es-VE');
        }
    };

    try {
        setStatus('', 'Consultando BCV...', 'fa-sync-alt');

        /*
         * IMPORTANTE:
         * Se utilizan los endpoints públicos de BCV API.
         * No usamos el endpoint antiguo ve.boletinoficial.net porque puede
         * devolver una tasa distinta/desactualizada.
         *
         * Según la documentación de BCV API:
         * /api/v1/dolar/public
         * /api/v1/euro/public
         */
        const [usdRes, eurRes] = await Promise.all([
            fetch('https://bcvapi.tech/api/v1/dolar/public?ts=' + Date.now(), {
                method: 'GET',
                cache: 'no-store',
                headers: { 'Accept': 'application/json' }
            }),
            fetch('https://bcvapi.tech/api/v1/euro/public?ts=' + Date.now(), {
                method: 'GET',
                cache: 'no-store',
                headers: { 'Accept': 'application/json' }
            })
        ]);

        if (!usdRes.ok) throw new Error(`Dólar BCV API: HTTP ${usdRes.status}`);
        if (!eurRes.ok) throw new Error(`Euro BCV API: HTTP ${eurRes.status}`);

        const usdData = await usdRes.json();
        const eurData = await eurRes.json();

        const usd = parseFloat(usdData.tasa);
        const eur = parseFloat(eurData.tasa);

        if (!Number.isFinite(usd) || usd <= 0) {
            throw new Error('La API no devolvió una tasa USD válida.');
        }

        if (!Number.isFinite(eur) || eur <= 0) {
            throw new Error('La API no devolvió una tasa EUR válida.');
        }

        tasaUSD_BCV = usd;
        tasaEUR_BCV = eur;

        // La fecha pertenece a la tasa BCV, NO a la fecha/hora en que abriste el POS.
        fechaTasaBCV = usdData.fecha || eurData.fecha || 'Última tasa publicada por BCV';

        lblFecha.textContent = fechaTasaBCV;

        actualizarTarjetaInventario();
        actualizarVistaTasaBCV();

        setStatus('success', 'Tasa BCV actualizada', 'fa-check-circle');

        console.info('BCV actualizado:', {
            USD: tasaUSD_BCV,
            EUR: tasaEUR_BCV,
            fecha: fechaTasaBCV
        });

    } catch (error) {
        console.error('ERROR OBTENIENDO TASA BCV:', error);

        actualizarTarjetaInventario();

        // NO mostramos una tasa inventada ni una tasa antigua como si fuera actual.
        lblTasa.textContent = 'No disponible';
        lblFecha.textContent = 'No se pudo consultar BCV';

        setStatus('error', 'Error consultando BCV', 'fa-triangle-exclamation');

        // Si ya había una tasa válida cargada anteriormente durante esta sesión,
        // la conservamos, pero no la presentamos como una nueva actualización.
        if (tasaUSD_BCV > 0 && tasaEUR_BCV > 0) {
            actualizarVistaTasaBCV();
            lblFecha.textContent = fechaTasaBCV || 'Última tasa válida de esta sesión';
        }
    }
}

function seleccionarMonedaBCV(moneda) {
    monedaSeleccionada = moneda;
    document.getElementById('btn-usd').classList.toggle('active', moneda === 'USD');
    document.getElementById('btn-eur').classList.toggle('active', moneda === 'EUR');
    actualizarVistaTasaBCV();
}

function actualizarVistaTasaBCV() {
    const lblTasa = document.getElementById('tasaActual');

    if (monedaSeleccionada === 'USD') {
        tasaActiva = tasaUSD_BCV;
        lblTasa.textContent = `1 USD = ${tasaActiva.toFixed(2)} Bs`;
    } else {
        tasaActiva = tasaEUR_BCV;
        lblTasa.textContent = `1 EUR = ${tasaActiva.toFixed(2)} Bs`;
    }

    renderizarPosProductos();
    renderizarInventario();
    renderizarClientes();
    renderizarCarrito();
    if (clienteSeleccionadoId) verDetalleCliente(clienteSeleccionadoId);
}

function switchTab(tabId) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view-content').forEach(v => v.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(tabId).classList.add('active');
}

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
    if (!idInput.value) {
        codigoInput.value = generarSiguienteCodigoProducto();
        codigoInput.readOnly = true;
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
            productos[idx] = { ...productos[idx], ...datosProducto, id: productos[idx].id };
        }
    } else {
        productos.push({
            id: "P" + (productos.length + 1),
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
    // Cargamos cada campo desde su propia propiedad.
    // Compatibilidad con registros antiguos: si existía "description", también lo recuperamos.
    document.getElementById('prod-descripcion').value = p.descripcion ?? p.description ?? '';
    document.getElementById('prod-contenido').value = p.contenido ?? p.medida ?? p.presentacion ?? '';

    productoImagenTemporal = p.imagen || '';
    actualizarVistaImagenProducto();

    document.getElementById('btn-prod-save').innerHTML = '<i class="fas fa-save"></i> Actualizar Producto';
}

function escaparHtmlInventario(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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
        p.stock = stockDespues;
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


// --- POS MULTIMONEDA ---
function renderizarPosProductos(filtro = "") {
    const tbody = document.getElementById('pos-productos-body');
    const filtrados = productos.filter(p => 
        p.nombre.toLowerCase().includes(filtro.toLowerCase()) || 
        p.codigo.toLowerCase().includes(filtro.toLowerCase())
    );

    tbody.innerHTML = filtrados.map(p => `
        <tr>
            <td>${p.codigo}</td>
            <td>${p.nombre}</td>
            <td class="num">$${p.precio.toFixed(2)}</td>
            <td class="num">Bs. ${tasaActiva > 0 ? (p.precio * tasaActiva).toFixed(2) : '—'}</td>
            <td class="num">${p.stock}</td>
            <td>
                <button class="btn" onclick="agregarAlCarrito('${p.id}')" ${p.stock <= 0 ? 'disabled' : ''}>
                    ${p.stock > 0 ? '+ Agregar' : 'Agotado'}
                </button>
            </td>
        </tr>
    `).join('');
}

function filtrarPosProductos() {
    renderizarPosProductos(document.getElementById('pos-search').value);
}

function agregarAlCarrito(id) {
    const p = productos.find(prod => prod.id === id);
    const itemEnCarrito = carrito.find(item => item.productoId === id);

    if (itemEnCarrito) {
        if (itemEnCarrito.cantidad < p.stock) itemEnCarrito.cantidad++;
        else alert("Stock máximo alcanzado");
    } else {
        carrito.push({ productoId: id, nombre: p.nombre, precio: p.precio, cantidad: 1 });
    }
    renderizarCarrito();
}

function renderizarCarrito() {
    const tbody = document.getElementById('pos-carrito-body');
    let totalUSD = 0;

    tbody.innerHTML = carrito.map((item, idx) => {
        const subtotal = item.cantidad * item.precio;
        totalUSD += subtotal;
        return `
            <tr>
                <td>${item.nombre}</td>
                <td class="num">${item.cantidad}</td>
                <td class="num">$${subtotal.toFixed(2)}</td>
                <td><button class="btn btn-danger" onclick="eliminarDelCarrito(${idx})">X</button></td>
            </tr>
        `;
    }).join('');

    document.getElementById('pos-total-usd').textContent = `$${totalUSD.toFixed(2)}`;
    document.getElementById('pos-total-ves').textContent = `Bs. ${tasaActiva > 0 ? (totalUSD * tasaActiva).toFixed(2) : '—'}`;
}

function eliminarDelCarrito(idx) {
    carrito.splice(idx, 1);
    renderizarCarrito();
}

function procesarVenta() {
    if (carrito.length === 0) return alert("El carrito está vacío");

    const clienteId = document.getElementById('pos-cliente-select').value;
    const tipoPago = document.getElementById('pos-tipo-pago').value;
    const total = carrito.reduce((sum, i) => sum + (i.cantidad * i.precio), 0);

    carrito.forEach(item => {
        const p = productos.find(prod => prod.id === item.productoId);
        if (p) p.stock -= item.cantidad;
    });

    ventas.push({
        id: "V" + (ventas.length + 1),
        clienteId: clienteId,
        fecha: new Date().toISOString().replace('T', ' ').substring(0, 16),
        items: carrito.map(item => {
            const producto = productos.find(p => p.id === item.productoId);
            return { ...item, costo: Number(producto?.costo || item.costo || 0) };
        }),
        total: total,
        tipo: tipoPago
    });

    carrito = [];
    renderizarCarrito();
    renderizarPosProductos();
    renderizarInventario();
    renderizarClientes();
    renderizarAuditoria(document.getElementById('auditoria-search') ? document.getElementById('auditoria-search').value : "");
    renderizarResumenPerdidasEconomicas();
    alert("Transacción procesada correctamente");
}

// --- CLIENTES Y DEUDAS MULTIMONEDA ---
function guardarCliente(e) {
    e.preventDefault();
    clientes.push({
        id: document.getElementById('cli-id').value,
        nombre: document.getElementById('cli-nombre').value,
        telefono: document.getElementById('cli-telefono').value
    });

    document.getElementById('form-cliente').reset();
    actualizarSelectClientes();
    actualizarSelectTransacciones();
    renderizarClientes();
}

function actualizarSelectClientes() {
    document.getElementById('pos-cliente-select').innerHTML = 
        clientes.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
}

function calcularEstadoFinancieroCliente(clienteId) {
    const ventasCli = ventas.filter(v => v.clienteId === clienteId);
    // Solo los abonos aprobados impactan la deuda. Los pagos en Confirmando
    // permanecen visibles como conciliación, pero no se contabilizan.
    const abonosCli = abonos.filter(a => a.clienteId === clienteId && (a.estado === 'Pago agregado' || !a.estado));

    const totalCompradoUSD = ventasCli.reduce((sum, v) => sum + Number(v.total || 0), 0);
    const totalCreditoUSD = ventasCli.filter(v => v.tipo === 'Crédito').reduce((sum, v) => sum + Number(v.total || 0), 0);
    const totalAbonadoUSD = abonosCli.reduce((sum, a) => sum + Number(a.montoUSD || 0), 0);

    const saldoDeudaUSD = totalCreditoUSD - totalAbonadoUSD;

    return {
        totalCompradoUSD,
        totalCompradoVES: totalCompradoUSD * tasaActiva,
        saldoDeudaUSD,
        saldoDeudaVES: saldoDeudaUSD * tasaActiva
    };
}

function renderizarClientes() {
    const tbody = document.getElementById('clientes-body');
    tbody.innerHTML = clientes.map(c => {
        const { totalCompradoUSD, saldoDeudaUSD, saldoDeudaVES } = calcularEstadoFinancieroCliente(c.id);
        return `
            <tr>
                <td>${c.id}</td>
                <td>${c.nombre}</td>
                <td>${c.telefono}</td>
                <td class="num">$${totalCompradoUSD.toFixed(2)}</td>
                <td class="num" style="color: ${saldoDeudaUSD > 0 ? 'var(--danger)' : 'inherit'}; font-weight: bold;">
                    $${saldoDeudaUSD.toFixed(2)}
                </td>
                <td class="num" style="color: ${saldoDeudaVES > 0 ? 'var(--danger)' : 'inherit'}; font-weight: bold;">
                    Bs. ${tasaActiva > 0 ? saldoDeudaVES.toFixed(2) : '—'}
                </td>
                <td style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button class="btn" onclick="verDetalleCliente('${c.id}')">Panel 360°</button>
                    <button class="btn btn-danger" onclick="abrirModalEliminarCliente('${c.id}')">Eliminar</button>
                </td>
            </tr>
        `;
    }).join('');
}

function abrirModalEliminarCliente(clienteId) {
    const cliente = clientes.find(c => c.id === clienteId);
    if (!cliente) return;

    const modal = document.getElementById('modal-eliminar-cliente');
    if (!modal) return;

    const estado = calcularEstadoFinancieroCliente(clienteId);
    document.getElementById('eliminar-cliente-id').value = cliente.id;
    document.getElementById('eliminar-cliente-identificador').value = cliente.id;
    document.getElementById('eliminar-cliente-nombre').value = cliente.nombre;
    document.getElementById('eliminar-cliente-telefono').value = cliente.telefono || '';
    document.getElementById('eliminar-cliente-deuda').value = `$${estado.saldoDeudaUSD.toFixed(2)}`;
    document.getElementById('eliminar-cliente-motivo').value = '';
    document.getElementById('eliminar-cliente-comentario').value = '';
    modal.classList.add('active');
    setTimeout(() => document.getElementById('eliminar-cliente-motivo').focus(), 50);
}

function cerrarModalEliminarCliente() {
    const modal = document.getElementById('modal-eliminar-cliente');
    if (modal) modal.classList.remove('active');
}

function confirmarEliminacionCliente(event) {
    event.preventDefault();

    const clienteId = document.getElementById('eliminar-cliente-id').value;
    const motivo = document.getElementById('eliminar-cliente-motivo').value.trim();
    const comentario = document.getElementById('eliminar-cliente-comentario').value.trim();
    const indice = clientes.findIndex(c => c.id === clienteId);
    if (indice === -1) {
        cerrarModalEliminarCliente();
        return;
    }
    if (!motivo || !comentario) {
        alert('Debes indicar el motivo y el comentario para eliminar al cliente.');
        return;
    }

    const cliente = clientes[indice];
    const estado = calcularEstadoFinancieroCliente(clienteId);
    const fecha = new Date().toISOString().replace('T', ' ').substring(0, 16);

    clientesEliminados.push({
        id: cliente.id,
        nombre: cliente.nombre,
        telefono: cliente.telefono,
        fecha,
        totalCompradoUSD: estado.totalCompradoUSD,
        deudaUSD: estado.saldoDeudaUSD,
        perdidaUSD: Math.max(0, estado.saldoDeudaUSD),
        motivo,
        comentario
    });

    // No se borran ventas ni abonos: se conservan para auditoría y el historial financiero.
    clientes.splice(indice, 1);

    if (clienteSeleccionadoId === clienteId) {
        clienteSeleccionadoId = null;
        const detalle = document.getElementById('cliente-detalle-card');
        if (detalle) detalle.style.display = 'none';
    }

    cerrarModalEliminarCliente();
    actualizarSelectClientes();
    renderizarClientes();
    renderizarHistorialClientesEliminados();
    renderizarResumenPerdidasEconomicas();

    alert(`Cliente ${cliente.nombre} eliminado correctamente. El historial de ventas y pagos se conservó.`);
}

function renderizarHistorialClientesEliminados() {
    const tbody = document.getElementById('clientes-eliminados-body');
    if (!tbody) return;

    tbody.innerHTML = clientesEliminados.length ? clientesEliminados.slice().reverse().map(c => `
        <tr>
            <td>${c.fecha}</td>
            <td>${c.id}</td>
            <td>${c.nombre}</td>
            <td class="num">$${Number(c.deudaUSD || 0).toFixed(2)}</td>
            <td class="num" style="color:${Number(c.perdidaUSD || 0) > 0 ? 'var(--danger)' : 'var(--text-muted)'}; font-weight:700;">${Number(c.perdidaUSD || 0) > 0 ? '-$' : '$'}${Number(c.perdidaUSD || 0).toFixed(2)}</td>
            <td>${c.motivo}</td>
            <td>${c.comentario}</td>
        </tr>
    `).join('') : `<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">No hay clientes eliminados.</td></tr>`;
}

function limpiarHistorialClientesEliminados() {
    if (!clientesEliminados.length) return;
    if (!confirm('¿Seguro que deseas limpiar el historial de clientes eliminados? Esto no restaurará los clientes.')) return;
    clientesEliminados = [];
    renderizarHistorialClientesEliminados();
    renderizarResumenPerdidasEconomicas();
}

function verDetalleCliente(id) {
    clienteSeleccionadoId = id;
    const cliente = clientes.find(c => c.id === id);
    const { totalCompradoUSD, totalCompradoVES, saldoDeudaUSD, saldoDeudaVES } = calcularEstadoFinancieroCliente(id);

    document.getElementById('det-cliente-nombre').textContent = `Panel Cliente: ${cliente.nombre}`;
    document.getElementById('det-kpi-comprado-usd').textContent = `$${totalCompradoUSD.toFixed(2)}`;
    document.getElementById('det-kpi-comprado-ves').textContent = `Bs. ${tasaActiva > 0 ? totalCompradoVES.toFixed(2) : '—'}`;

    document.getElementById('det-kpi-deuda-usd').textContent = `$${saldoDeudaUSD.toFixed(2)}`;
    document.getElementById('det-kpi-deuda-ves').textContent = `Bs. ${tasaActiva > 0 ? saldoDeudaVES.toFixed(2) : '—'}`;

    const transacciones = [];
    ventas.filter(v => v.clienteId === id).forEach(v => {
        transacciones.push({
            fecha: v.fecha,
            concepto: `Venta (${v.tipo})`,
            detalle: v.items.map(i => `${i.cantidad}x ${i.nombre}`).join(', '),
            cargoUSD: v.tipo === 'Crédito' ? v.total : 0,
            abonoUSD: 0,
            montoPagoVES: '-'
        });
    });

    abonos.filter(a => a.clienteId === id).forEach(a => {
        const aprobado = a.estado === 'Pago agregado' || !a.estado;
        transacciones.push({
            fecha: a.fecha,
            concepto: aprobado ? `Abono / Pago` : `Pago (${a.estado})`,
            detalle: a.referencia ? `${a.metodo} · Ref. ${a.referencia}` : a.metodo,
            cargoUSD: 0,
            abonoUSD: aprobado ? Number(a.montoUSD || 0) : 0,
            montoPagoVES: a.montoVES > 0 ? `Bs. ${Number(a.montoVES).toFixed(2)}` : '-',
            pendiente: !aprobado
        });
    });

    transacciones.push(...transaccionesPendientesCliente(id));

    transacciones.sort((a,b) => new Date(a.fecha) - new Date(b.fecha));

    let saldoAcumuladoUSD = 0;
    const tbody = document.getElementById('det-historial-body');
    tbody.innerHTML = transacciones.map(t => {
        saldoAcumuladoUSD += (t.cargoUSD - t.abonoUSD);
        const estadoTransaccion = t.estado || (t.pendiente ? 'Confirmando' : 'Pago agregado');
        return `
            <tr>
                <td>${t.fecha}</td>
                <td>${t.concepto} ${t.pendiente ? `<span class="transaction-badge transaction-pending">Confirmando</span>` : (t.estado ? `<span class="transaction-badge transaction-approved">${t.estado}</span>` : ``)}</td>
                <td>${t.detalle}</td>
                <td class="num">$${t.cargoUSD.toFixed(2)}</td>
                <td class="num">$${t.abonoUSD.toFixed(2)}</td>
                <td class="num">${t.montoPagoVES}</td>
                <td class="num"><strong>$${saldoAcumuladoUSD.toFixed(2)}</strong></td>
                <td class="num"><strong>Bs. ${tasaActiva > 0 ? (saldoAcumuladoUSD * tasaActiva).toFixed(2) : '—'}</strong></td>
            </tr>
        `;
    }).join('');

    document.getElementById('cliente-detalle-card').style.display = 'block';
}

// --- MODAL ABONOS MULTIMONEDA ---
function abrirModalAbono() {
    if (!clienteSeleccionadoId) {
        alert('Selecciona primero un cliente.');
        return;
    }
    const modal = document.getElementById('modal-abono');
    if (modal) modal.classList.add('active');
    actualizarMonedaAbono();
}

function cerrarModalAbono() {
    const modal = document.getElementById('modal-abono');
    if (modal) modal.classList.remove('active');
}

function actualizarMonedaAbono() {
    const metodo = document.getElementById('abono-metodo').value;
    const lbl = document.getElementById('lbl-abono-monto');
    const refGroup = document.getElementById('abono-referencia-group');
    const refInput = document.getElementById('abono-referencia');
    const esTransaccion = metodo === 'Transferencia VES' || metodo === 'Pago Móvil VES';

    lbl.textContent = metodo === 'Efectivo USD' ? 'Monto a Abonar ($)' : 'Monto a Abonar (Bs)';
    if (refGroup) refGroup.style.display = esTransaccion ? 'flex' : 'none';
    if (refInput) refInput.required = esTransaccion;
    calcularEquivalenteAbono();
}

function calcularEquivalenteAbono() {
    const metodo = document.getElementById('abono-metodo').value;
    const monto = parseFloat(document.getElementById('abono-monto').value) || 0;
    const eqField = document.getElementById('abono-equivalente');
    if (tasaActiva <= 0) {
        eqField.value = 'Tasa BCV no disponible';
        return;
    }
    if (metodo === 'Efectivo USD') {
        eqField.value = `Bs. ${(monto * tasaActiva).toFixed(2)}`;
    } else {
        eqField.value = `$${(monto / tasaActiva).toFixed(2)}`;
    }
}

function generarIdTransaccion() {
    return 'TX' + Date.now() + Math.floor(Math.random() * 1000);
}

function referenciaNormalizada(ref) {
    // La referencia se compara sin espacios, guiones accidentales y diferencias de mayúsculas.
    // Así, "12 34-56" y "123456" se consideran la misma referencia.
    return String(ref || '')
        .trim()
        .replace(/[\s-]+/g, '')
        .toUpperCase();
}

function normalizarMontoTransaccion(valor) {
    let texto = String(valor ?? '').trim();
    if (!texto) return NaN;

    // Acepta tanto 2000, 2000.5 como 2000,50 y devuelve un número real.
    texto = texto.replace(/\s/g, '');
    if (texto.includes(',') && texto.includes('.')) {
        // Si hay ambos separadores, el último se interpreta como decimal.
        const ultimo = Math.max(texto.lastIndexOf(','), texto.lastIndexOf('.'));
        const entero = texto.slice(0, ultimo).replace(/[.,]/g, '');
        const decimal = texto.slice(ultimo + 1).replace(/\D/g, '');
        texto = `${entero}.${decimal}`;
    } else if (texto.includes(',')) {
        texto = texto.replace(',', '.');
    }

    const numero = Number(texto);
    return Number.isFinite(numero) ? numero : NaN;
}

function formatearMontoTransaccion(forzar = false) {
    const input = document.getElementById('transaccion-monto');
    if (!input) return;
    const numero = normalizarMontoTransaccion(input.value);
    if (Number.isFinite(numero) && numero > 0) {
        input.value = numero.toFixed(2);
    } else if (forzar && input.value.trim() !== '') {
        input.value = '';
    }
}

function normalizarEntradaMontoTransaccion() {
    const input = document.getElementById('transaccion-monto');
    if (!input) return;
    // Solo conserva caracteres válidos mientras se escribe; no fuerza .00 hasta salir del campo.
    input.value = input.value.replace(/[^0-9.,]/g, '');
}

function referenciaYaRegistrada(ref, excluirId = null, soloAprobadas = true) {
    const r = referenciaNormalizada(ref);
    if (!r) return false;
    return transacciones.some(t => {
        if (t.id === excluirId) return false;
        if (soloAprobadas && t.estado !== 'Pago agregado') return false;
        return referenciaNormalizada(t.referencia) === r;
    });
}

function buscarTransaccionReintentable(ref, excluirId = null) {
    const r = referenciaNormalizada(ref);
    if (!r) return null;
    return [...transacciones].reverse().find(t =>
        t.id !== excluirId &&
        (t.estado === 'Confirmando' || t.estado === 'Fallido') &&
        referenciaNormalizada(t.referencia) === r
    ) || null;
}

function calcularMontoUSDDesdeBs(montoVES) {
    const monto = normalizarMontoTransaccion(montoVES);
    return tasaActiva > 0 && Number.isFinite(monto) ? Number((monto / tasaActiva).toFixed(2)) : 0;
}

// Adaptador de verificación. Si luego conectas un backend/banco, define:
// window.verificarTransaccionBancaria = async (tx) => ({ valid: true/false, ... });
async function verificarTransaccionBancaria(tx) {
    if (typeof window.verificarTransaccionBancaria === 'function' && window.verificarTransaccionBancaria !== verificarTransaccionBancaria) {
        return await window.verificarTransaccionBancaria({
            ...tx,
            referencia: referenciaNormalizada(tx.referencia),
            montoVES: normalizarMontoTransaccion(tx.montoVES),
            montoUSD: calcularMontoUSDDesdeBs(tx.montoVES)
        });
    }

    await new Promise(resolve => setTimeout(resolve, 900));
    const referencia = referenciaNormalizada(tx.referencia);
    // No exigimos decimales: 2000 y 2000.00 representan exactamente el mismo monto.
    const referenciaValida = /^[A-Z0-9]{4,40}$/.test(referencia);
    const montoNormalizado = normalizarMontoTransaccion(tx.montoVES);
    const montoValido = Number.isFinite(montoNormalizado) && montoNormalizado > 0;
    const clienteValido = clientes.some(c => c.id === tx.clienteId);
    const duplicadaAprobada = referenciaYaRegistrada(referencia, tx.id, true);

    return {
        valid: referenciaValida && montoValido && clienteValido && !duplicadaAprobada,
        motivo: !referenciaValida
            ? 'Referencia inválida. Usa entre 4 y 40 caracteres alfanuméricos.'
            : !montoValido
                ? 'Monto inválido.'
                : !clienteValido
                    ? 'Cliente no encontrado.'
                    : duplicadaAprobada
                        ? 'La referencia ya fue conciliada en otra transacción.'
                        : ''
    };
}

async function procesarVerificacionTransaccion(id, opciones = {}) {
    const silencioso = Boolean(opciones.silencioso);
    const tx = transacciones.find(t => t.id === id);
    if (!tx || (tx.estado !== 'Confirmando' && tx.estado !== 'Fallido')) {
        return { ok: false, tx, motivo: 'La transacción no está pendiente de verificación.' };
    }

    tx.estado = 'Confirmando';
    tx.verificando = true;
    renderizarTransacciones();

    try {
        const resultado = await verificarTransaccionBancaria(tx);
        if (!resultado || !resultado.valid) {
            tx.verificando = false;
            tx.estado = 'Fallido';
            tx.observacion = resultado?.motivo || 'No fue posible validar la transacción.';
            renderizarTransacciones();
            if (!silencioso) alert(`La referencia ${tx.referencia} no fue validada: ${tx.observacion}`);
            return { ok: false, tx, motivo: tx.observacion };
        }

        tx.verificando = false;
        tx.estado = 'Pago agregado';
        tx.fechaVerificacion = new Date().toISOString().replace('T', ' ').substring(0, 16);
        tx.observacion = 'Transacción validada y agregada al historial.';
        tx.montoVES = Number(normalizarMontoTransaccion(tx.montoVES).toFixed(2));
        tx.montoUSD = calcularMontoUSDDesdeBs(tx.montoVES);

        const yaExisteAbono = abonos.some(a => a.transaccionId === tx.id);
        if (!yaExisteAbono) {
            abonos.push({
                id: 'A' + (abonos.length + 1),
                transaccionId: tx.id,
                clienteId: tx.clienteId,
                fecha: tx.fechaVerificacion,
                montoUSD: tx.montoUSD,
                montoVES: tx.montoVES,
                metodo: tx.tipo,
                referencia: tx.referencia,
                tasaMomento: tx.tasaMomento,
                estado: 'Pago agregado'
            });
        }

        renderizarTransacciones();
        renderizarClientes();
        if (clienteSeleccionadoId === tx.clienteId) verDetalleCliente(tx.clienteId);
        if (!silencioso) {
            alert(`Pago agregado: la referencia ${tx.referencia} fue validada y ahora sí afecta la deuda del cliente.`);
        }
        return { ok: true, tx, montoVES: tx.montoVES, montoUSD: tx.montoUSD };
    } catch (error) {
        tx.verificando = false;
        tx.estado = 'Fallido';
        tx.observacion = 'Error durante la verificación. Puedes corregir los datos y reintentar.';
        renderizarTransacciones();
        console.error(error);
        if (!silencioso) alert(`Error verificando la referencia ${tx.referencia}.`);
        return { ok: false, tx, motivo: tx.observacion };
    }
}

// Detecta el separador de columnas de una línea del lote.
// Se evita usar la coma como separador de columnas porque también se usa
// como separador decimal en los montos (ej. 850,50).
function detectarSeparadorLote(linea) {
    if (linea.includes('|')) return '|';
    if (linea.includes('\t')) return '\t';
    if (linea.includes(';')) return ';';
    return '|';
}

// Interpreta una línea de texto (pegada, o proveniente de un CSV/Excel) y
// devuelve los datos de la transacción detectados, sin exigir un formato rígido:
//  - Acepta 4 columnas: Cliente | Tipo | Referencia | Monto
//  - Acepta 3 columnas: Cliente | Referencia | Monto (el Tipo se asume Transferencia Bancaria)
// Quita acentos/diacríticos y normaliza mayúsculas/espacios, para comparar
// nombres de forma flexible: "Cristián Flores", "cristian flores" y
// "CRISTIAN  FLORES" deben considerarse el mismo valor.
function normalizarTextoBusqueda(texto) {
    return String(texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

// Busca un cliente por ID/Cédula/RIF exacto o por Nombre y Apellido
// (sin importar mayúsculas, minúsculas o acentos). Devuelve el objeto
// cliente encontrado o null si no hay coincidencia.
function resolverClientePorIdONombre(entrada) {
    const texto = String(entrada || '').trim();
    if (!texto) return null;

    // 1) Coincidencia exacta por ID / Cédula / RIF (como se guardó, sin distinguir mayúsculas).
    const porId = clientes.find(c => String(c.id || '').trim().toLowerCase() === texto.toLowerCase());
    if (porId) return porId;

    // 2) Coincidencia por Nombre y Apellido, normalizando acentos/mayúsculas.
    const nombreNormalizado = normalizarTextoBusqueda(texto);
    const porNombre = clientes.find(c => normalizarTextoBusqueda(c.nombre) === nombreNormalizado);
    if (porNombre) return porNombre;

    return null;
}

function parsearLineaLote(linea, numeroLinea = 0) {
    const original = String(linea ?? '').trim();
    const resultado = {
        numeroLinea,
        original,
        clienteId: '',
        clienteEntrada: '',
        clienteNombre: '',
        tipo: '',
        referencia: '',
        montoVES: NaN,
        valido: false,
        error: ''
    };

    if (!original) {
        resultado.error = 'Línea vacía.';
        return resultado;
    }

    const separador = detectarSeparadorLote(original);
    const partes = original.split(separador).map(p => p.trim()).filter((p, i, arr) => !(p === '' && i === arr.length - 1));

    if (partes.length < 3) {
        resultado.error = 'Faltan columnas. Usa Cliente | Referencia | Monto (Tipo opcional).';
        return resultado;
    }

    let clienteEntrada, tipoTexto, referenciaTexto, montoTexto;

    if (partes.length >= 4) {
        [clienteEntrada, tipoTexto, referenciaTexto] = partes;
        montoTexto = partes.slice(3).join(separador);
    } else {
        [clienteEntrada, referenciaTexto, montoTexto] = partes;
        tipoTexto = '';
    }

    resultado.clienteEntrada = clienteEntrada;

    // Búsqueda flexible: acepta tanto el ID/Cédula/RIF como el Nombre y Apellido del cliente.
    const clienteEncontrado = resolverClientePorIdONombre(clienteEntrada);
    if (clienteEncontrado) {
        resultado.clienteId = clienteEncontrado.id;
        resultado.clienteNombre = clienteEncontrado.nombre;
    }

    const tipoNormalizado = tipoTexto.toLowerCase();
    resultado.tipo = tipoNormalizado.includes('móvil') || tipoNormalizado.includes('movil')
        ? 'Pago Móvil'
        : (tipoNormalizado.includes('transfer') || !tipoTexto ? 'Transferencia Bancaria' : '');

    resultado.referencia = referenciaNormalizada(referenciaTexto);
    resultado.montoVES = normalizarMontoTransaccion(montoTexto);

    if (!clienteEntrada) {
        resultado.error = 'Falta el ID/Cédula o el Nombre del cliente.';
    } else if (!clienteEncontrado) {
        resultado.error = `No existe ningún cliente con ID o nombre "${clienteEntrada}".`;
    } else if (!resultado.tipo) {
        resultado.error = 'Tipo inválido. Usa Pago Móvil o Transferencia Bancaria.';
    } else if (!resultado.referencia || !/^[A-Z0-9]{4,40}$/.test(resultado.referencia)) {
        resultado.error = 'Referencia inválida (usa 4 a 40 caracteres alfanuméricos).';
    } else if (!Number.isFinite(resultado.montoVES) || resultado.montoVES <= 0) {
        resultado.error = 'Monto inválido.';
    } else if (referenciaYaRegistrada(resultado.referencia, null, true)) {
        resultado.error = `La referencia ${resultado.referencia} ya está conciliada.`;
    } else {
        resultado.valido = true;
    }


    return resultado;
}

// Pequeño debounce genérico para no recalcular la vista previa en cada tecla
// cuando el usuario pega bloques grandes (100-200 líneas).
function debounce(fn, espera = 220) {
    let temporizador = null;
    return (...args) => {
        clearTimeout(temporizador);
        temporizador = setTimeout(() => fn(...args), espera);
    };
}

// Muestra una tabla con lo que el sistema detectó del bloque de texto pegado,
// para que el usuario confirme antes de agregarlo al lote / verificarlo.
function previsualizarLote() {
    const input = document.getElementById('transaccion-lote-input');
    const preview = document.getElementById('transaccion-lote-preview');
    const body = document.getElementById('transaccion-lote-preview-body');
    const resumen = document.getElementById('transaccion-lote-preview-resumen');
    if (!input || !preview || !body || !resumen) return;

    const lineas = input.value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    if (!lineas.length) {
        preview.style.display = 'none';
        body.innerHTML = '';
        return;
    }

    const filas = lineas.map((linea, index) => parsearLineaLote(linea, index + 1));
    const validas = filas.filter(f => f.valido).length;
    const conError = filas.length - validas;

    resumen.textContent = `${filas.length} línea(s) detectada(s) · ${validas} válida(s) · ${conError} con error`;

    body.innerHTML = filas.map(f => `
        <tr class="${f.valido ? 'fila-valida' : 'fila-error'}">
            <td>${f.numeroLinea}</td>
            <td>
                ${f.clienteNombre
                    ? `${escaparHtmlInventario(f.clienteNombre)} <small class="transaction-batch-cliente-id">(${escaparHtmlInventario(f.clienteId)})</small>`
                    : escaparHtmlInventario(f.clienteEntrada || '—')
                }
            </td>
            <td>${escaparHtmlInventario(f.tipo || '—')}</td>
            <td>${escaparHtmlInventario(f.referencia || '—')}</td>
            <td class="num">${Number.isFinite(f.montoVES) ? f.montoVES.toFixed(2) : '—'}</td>
            <td>
                ${f.valido
                    ? '<span class="transaction-batch-row-status ok"><i class="fas fa-circle-check"></i> Lista</span>'
                    : `<span class="transaction-batch-row-status error"><i class="fas fa-triangle-exclamation"></i> Error</span><small class="transaction-batch-row-error-msg">${escaparHtmlInventario(f.error)}</small>`
                }
            </td>
        </tr>
    `).join('');

    preview.style.display = 'block';
}

const previsualizarLoteDebounced = debounce(previsualizarLote);

// Lee un archivo CSV o Excel (.xlsx/.xls) y vuelca su contenido como líneas
// "Cliente | Tipo | Referencia | Monto" dentro del área de texto, reutilizando
// el mismo parser flexible que el pegado manual.
function manejarArchivoLote(evento) {
    const archivo = evento.target.files && evento.target.files[0];
    const nombreEl = document.getElementById('transaccion-lote-archivo-nombre');
    const input = document.getElementById('transaccion-lote-input');
    if (!archivo || !input) return;

    const extension = archivo.name.split('.').pop().toLowerCase();

    const volcarFilas = (filas) => {
        const lineasTexto = filas
            .filter(fila => fila.some(celda => String(celda ?? '').trim() !== ''))
            .map(fila => fila.map(celda => String(celda ?? '').trim()).join(' | '));

        if (!lineasTexto.length) {
            alert('No se encontraron filas con datos en el archivo.');
            return;
        }

        const contenidoPrevio = input.value.trim();
        input.value = (contenidoPrevio ? contenidoPrevio + '\n' : '') + lineasTexto.join('\n');
        previsualizarLote();
    };

    if (extension === 'csv') {
        const lector = new FileReader();
        lector.onload = (e) => {
            const texto = String(e.target.result || '');
            const filas = texto.split(/\r?\n/).filter(l => l.trim() !== '').map(linea => {
                const separador = linea.includes(';') ? ';' : ',';
                return linea.split(separador);
            });
            volcarFilas(filas);
        };
        lector.onerror = () => alert('No se pudo leer el archivo CSV.');
        lector.readAsText(archivo, 'UTF-8');
    } else if (extension === 'xlsx' || extension === 'xls') {
        if (typeof XLSX === 'undefined') {
            alert('No se pudo cargar el lector de Excel. Verifica tu conexión a internet e inténtalo de nuevo.');
            return;
        }
        const lector = new FileReader();
        lector.onload = (e) => {
            try {
                const datos = new Uint8Array(e.target.result);
                const libro = XLSX.read(datos, { type: 'array' });
                const hoja = libro.Sheets[libro.SheetNames[0]];
                const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: false, defval: '' });
                volcarFilas(filas);
            } catch (error) {
                console.error(error);
                alert('No se pudo procesar el archivo Excel. Verifica que el formato sea válido.');
            }
        };
        lector.onerror = () => alert('No se pudo leer el archivo Excel.');
        lector.readAsArrayBuffer(archivo);
    } else {
        alert('Formato no soportado. Usa un archivo .csv, .xlsx o .xls.');
        evento.target.value = '';
        return;
    }

    if (nombreEl) nombreEl.textContent = `Archivo cargado: ${archivo.name}`;
    evento.target.value = '';
}

// Reinicia la pantalla de carga masiva: vacía el área de texto, la vista previa
// y el panel de resultados/contadores, para empezar un nuevo lote desde cero.
// No afecta las transacciones que ya quedaron registradas en la tabla principal.
function limpiarLoteTransacciones() {
    const input = document.getElementById('transaccion-lote-input');
    const archivoInput = document.getElementById('transaccion-lote-archivo');
    const nombreEl = document.getElementById('transaccion-lote-archivo-nombre');
    const preview = document.getElementById('transaccion-lote-preview');
    const previewBody = document.getElementById('transaccion-lote-preview-body');
    const resultadoEl = document.getElementById('transaccion-lote-resultado');
    const progreso = document.getElementById('transaccion-lote-progreso');

    if (input) input.value = '';
    if (archivoInput) archivoInput.value = '';
    if (nombreEl) nombreEl.textContent = 'Ningún archivo cargado. También puedes pegar directamente el texto abajo.';
    if (preview) preview.style.display = 'none';
    if (previewBody) previewBody.innerHTML = '';
    if (resultadoEl) {
        resultadoEl.style.display = 'none';
        resultadoEl.innerHTML = '';
    }
    if (progreso) {
        progreso.innerHTML = 'Las transacciones en <b>Confirmando</b> esperan aquí hasta que ejecutes la verificación.';
    }
}

function agregarTransaccionesAlLote() {
    const input = document.getElementById('transaccion-lote-input');
    if (!input) return;

    const lineas = input.value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lineas.length) {
        alert('Pega o carga al menos una transacción en el área de carga múltiple.');
        return;
    }

    const filas = lineas.map((linea, index) => parsearLineaLote(linea, index + 1));
    const errores = filas.filter(f => !f.valido).map(f => `Línea ${f.numeroLinea}: ${f.error}`);
    let agregadas = 0;

    filas.filter(f => f.valido).forEach(f => {
        const { clienteId, tipo, referencia, montoVES } = f;

        let tx = buscarTransaccionReintentable(referencia);
        if (tx && (tx.estado === 'Confirmando' || tx.estado === 'Fallido')) {
            tx.clienteId = clienteId;
            tx.tipo = tipo;
            tx.referencia = referencia;
            tx.montoVES = Number(montoVES.toFixed(2));
            tx.montoUSD = calcularMontoUSDDesdeBs(tx.montoVES);
            tx.tasaMomento = tasaActiva;
            tx.estado = 'Confirmando';
            tx.verificando = false;
            tx.observacion = 'Datos corregidos/cargados en lote. Esperando verificación.';
        } else {
            tx = {
                id: generarIdTransaccion(),
                clienteId,
                tipo,
                referencia,
                montoVES: Number(montoVES.toFixed(2)),
                montoUSD: calcularMontoUSDDesdeBs(montoVES),
                tasaMomento: tasaActiva,
                fecha: new Date().toISOString().replace('T', ' ').substring(0, 16),
                estado: 'Confirmando',
                verificando: false,
                observacion: 'Cargada en lote. Esperando verificación.'
            };
            transacciones.push(tx);
        }
        agregadas++;
    });

    input.value = '';
    const preview = document.getElementById('transaccion-lote-preview');
    const previewBody = document.getElementById('transaccion-lote-preview-body');
    if (preview) preview.style.display = 'none';
    if (previewBody) previewBody.innerHTML = '';

    actualizarSelectTransacciones();
    renderizarTransacciones();

    let mensaje = `${agregadas} transacción(es) agregada(s) al lote en estado Confirmando.`;
    if (errores.length) mensaje += `\n\nNo se agregaron ${errores.length}:\n• ${errores.join('\n• ')}`;
    alert(mensaje);
}

async function verificarTodasLasTransacciones() {
    const pendientes = transacciones.filter(t => t.estado === 'Confirmando' && !t.verificando);
    const boton = document.getElementById('btn-verificar-todas');
    const progreso = document.getElementById('transaccion-lote-progreso');
    const resultadoEl = document.getElementById('transaccion-lote-resultado');

    if (!pendientes.length) {
        alert('No hay transacciones pendientes en estado Confirmando para verificar.');
        return;
    }

    if (!confirm(`¿Verificar las ${pendientes.length} transacciones pendientes? Solo las que resulten válidas pasarán a Pago agregado y afectarán la deuda.`)) {
        return;
    }

    if (boton) {
        boton.disabled = true;
        boton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando lote...';
    }
    if (resultadoEl) resultadoEl.style.display = 'none';

    const resultados = [];
    for (let i = 0; i < pendientes.length; i++) {
        const tx = pendientes[i];
        if (progreso) progreso.innerHTML = `<b>Procesando ${i + 1} de ${pendientes.length}:</b> referencia ${escaparHtmlInventario(tx.referencia)}`;
        const resultado = await procesarVerificacionTransaccion(tx.id, { silencioso: true });
        resultados.push(resultado);
    }

    const aprobadas = resultados.filter(r => r.ok);
    const fallidas = resultados.filter(r => !r.ok);
    const montoVES = aprobadas.reduce((sum, r) => sum + Number(r.montoVES || 0), 0);
    const montoUSD = aprobadas.reduce((sum, r) => sum + Number(r.montoUSD || 0), 0);
    const pendientesRestantes = transacciones.filter(t => t.estado === 'Confirmando').length;

    if (progreso) {
        progreso.innerHTML = `<b>Lote finalizado.</b> ${aprobadas.length} agregada(s), ${fallidas.length} fallida(s), ${pendientesRestantes} pendiente(s).`;
    }

    if (resultadoEl) {
        resultadoEl.style.display = 'block';
        resultadoEl.innerHTML = `
            <div class="transaction-batch-result-title"><i class="fas fa-clipboard-check"></i> Resultado de la verificación masiva</div>
            <div class="transaction-batch-result-grid">
                <div><strong>${aprobadas.length}</strong><span>Pago(s) agregado(s)</span></div>
                <div><strong>Bs. ${montoVES.toFixed(2)}</strong><span>Monto conciliado</span></div>
                <div><strong>$${montoUSD.toFixed(2)}</strong><span>Equivalente USD</span></div>
                <div><strong>${fallidas.length}</strong><span>Fallida(s)</span></div>
                <div><strong>${pendientesRestantes}</strong><span>Pendiente(s)</span></div>
            </div>
            ${fallidas.length ? `<div class="transaction-batch-failures"><b>Referencias no validadas:</b><ul>${fallidas.map(r => `<li><strong>${escaparHtmlInventario(r.tx?.referencia || '—')}</strong> — ${escaparHtmlInventario(r.motivo || 'No validada')}</li>`).join('')}</ul></div>` : '<div class="transaction-batch-success"><i class="fas fa-circle-check"></i> Todas las transacciones del lote fueron conciliadas correctamente.</div>'}
        `;
    }

    renderizarTransacciones();
    renderizarClientes();
    if (clienteSeleccionadoId) verDetalleCliente(clienteSeleccionadoId);

    if (boton) {
        boton.disabled = false;
        boton.innerHTML = '<i class="fas fa-check-double"></i> Verificar todas las pendientes';
    }
}

function editarTransaccion(id) {
    const tx = transacciones.find(t => t.id === id);
    if (!tx || tx.estado === 'Pago agregado') return;

    const cliente = document.getElementById('transaccion-cliente');
    const tipo = document.getElementById('transaccion-tipo');
    const referencia = document.getElementById('transaccion-referencia');
    const monto = document.getElementById('transaccion-monto');
    const editId = document.getElementById('transaccion-edit-id');

    if (cliente) cliente.value = tx.clienteId;
    if (tipo) tipo.value = tx.tipo;
    if (referencia) referencia.value = tx.referencia;
    if (monto) monto.value = Number(normalizarMontoTransaccion(tx.montoVES)).toFixed(2);
    if (editId) editId.value = tx.id;

    const form = document.getElementById('form-transaccion');
    const button = form?.querySelector('button[type="submit"]');
    if (button) button.innerHTML = '<i class="fas fa-rotate"></i> Guardar y Reintentar';

    document.getElementById('transaccion-referencia')?.focus();
}

function cancelarEdicionTransaccion() {
    const form = document.getElementById('form-transaccion');
    if (!form) return;
    form.reset();
    const editId = document.getElementById('transaccion-edit-id');
    if (editId) editId.value = '';
    const button = form.querySelector('button[type="submit"]');
    if (button) button.innerHTML = '<i class="fas fa-paper-plane"></i> Registrar y Confirmar';
}

function registrarTransaccion(event) {
    event.preventDefault();
    const clienteId = document.getElementById('transaccion-cliente').value;
    const tipo = document.getElementById('transaccion-tipo').value;
    const referencia = referenciaNormalizada(document.getElementById('transaccion-referencia').value);
    const montoVES = normalizarMontoTransaccion(document.getElementById('transaccion-monto').value);
    const editId = document.getElementById('transaccion-edit-id')?.value || null;

    if (!clienteId || !referencia || !Number.isFinite(montoVES) || montoVES <= 0) {
        alert('Completa cliente, referencia y monto válido.');
        return;
    }

    // Una referencia conciliada sí es única. Las que están Confirmando/Fallido
    // pueden corregirse y reutilizarse sin crear falsos duplicados.
    if (referenciaYaRegistrada(referencia, editId, true)) {
        alert('Esa referencia ya está conciliada en otra transacción.');
        return;
    }

    let tx = editId ? transacciones.find(t => t.id === editId) : null;

    // Si el usuario vuelve a escribir una referencia que ya existe en un registro
    // no conciliado, reutilizamos ese registro en vez de bloquearlo.
    if (!tx) tx = buscarTransaccionReintentable(referencia);

    if (tx && (tx.estado === 'Confirmando' || tx.estado === 'Fallido')) {
        tx.clienteId = clienteId;
        tx.tipo = tipo;
        tx.referencia = referencia;
        tx.montoVES = Number(montoVES.toFixed(2));
        tx.montoUSD = calcularMontoUSDDesdeBs(tx.montoVES);
        tx.tasaMomento = tasaActiva;
        tx.estado = 'Confirmando';
        tx.verificando = false;
        tx.observacion = 'Datos corregidos. Esperando nueva verificación.';
    } else {
        tx = {
            id: generarIdTransaccion(),
            clienteId,
            tipo,
            referencia,
            montoVES: Number(montoVES.toFixed(2)),
            montoUSD: calcularMontoUSDDesdeBs(montoVES),
            tasaMomento: tasaActiva,
            fecha: new Date().toISOString().replace('T', ' ').substring(0, 16),
            estado: 'Confirmando',
            verificando: false,
            observacion: 'Referencia registrada. Esperando verificación.'
        };
        transacciones.push(tx);
    }

    cancelarEdicionTransaccion();
    actualizarSelectTransacciones();
    renderizarTransacciones();
    alert(`Transacción ${tx.estado === 'Confirmando' ? 'registrada en estado Confirmando' : 'actualizada'}. La deuda todavía NO ha cambiado. Pulsa \"Verificar\" en la fila cuando quieras iniciar la conciliación.`);
}

function actualizarSelectTransacciones() {
    const select = document.getElementById('transaccion-cliente');
    if (!select) return;
    const anterior = select.value;
    select.innerHTML = clientes.length
        ? clientes.map(c => `<option value="${c.id}">${escaparHtmlInventario(c.nombre)} · ${escaparHtmlInventario(c.id)}</option>`).join('')
        : '<option value="">No hay clientes registrados</option>';
    if (clientes.some(c => c.id === anterior)) select.value = anterior;
}

function transaccionesPendientesCliente(clienteId) {
    return transacciones.filter(t => t.clienteId === clienteId && t.estado === 'Confirmando').map(t => ({
        fecha: t.fecha,
        concepto: `Pago ${t.tipo}`,
        detalle: `Ref. ${t.referencia}`,
        cargoUSD: 0,
        abonoUSD: 0,
        montoPagoVES: `Bs. ${Number(t.montoVES || 0).toFixed(2)}`,
        pendiente: true,
        estado: 'Confirmando'
    }));
}

function obtenerNombreClienteTransaccion(clienteId) {
    return clientes.find(c => c.id === clienteId)?.nombre || 'Cliente eliminado';
}

function renderizarTransacciones(filtro = null) {
    const tbody = document.getElementById('transacciones-body');
    if (!tbody) return;
    const texto = filtro === null ? (document.getElementById('transaccion-busqueda')?.value || '') : filtro;
    const normalizado = referenciaNormalizada(texto);
    const lista = transacciones.slice().reverse().filter(t => !normalizado || referenciaNormalizada(t.referencia).includes(normalizado));

    const pendientes = transacciones.filter(t => t.estado === 'Confirmando').length;
    const agregados = transacciones.filter(t => t.estado === 'Pago agregado').length;
    const fallidos = transacciones.filter(t => t.estado === 'Fallido').length;
    const resumen = document.getElementById('transaccion-resumen');
    if (resumen) resumen.textContent = `${pendientes} pendiente${pendientes === 1 ? '' : 's'} · ${fallidos} fallido${fallidos === 1 ? '' : 's'} · ${agregados} pago${agregados === 1 ? '' : 's'} agregado${agregados === 1 ? '' : 's'}`;

    if (!lista.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:25px;">No hay transacciones que coincidan con la referencia.</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map(t => {
        const cliente = escaparHtmlInventario(obtenerNombreClienteTransaccion(t.clienteId));
        const estadoClass = t.estado === 'Pago agregado'
            ? 'transaction-approved'
            : (t.estado === 'Fallido' ? 'transaction-failed' : 'transaction-pending');
        const accion = t.estado === 'Pago agregado'
            ? '<span class="transaction-verified"><i class="fas fa-check-circle"></i> Conciliado</span>'
            : `<div style="display:flex;gap:6px;flex-wrap:wrap;">
                <button class="btn btn-warning btn-sm" onclick="editarTransaccion('${t.id}')" ${t.verificando ? 'disabled' : ''}><i class="fas fa-pen"></i> Editar</button>
                <button class="btn btn-sm ${t.estado === 'Fallido' ? 'btn-danger' : 'btn-warning'}" onclick="procesarVerificacionTransaccion('${t.id}')" ${t.verificando ? 'disabled' : ''}>${t.verificando ? '<i class="fas fa-spinner fa-spin"></i> Verificando...' : '<i class="fas fa-rotate"></i> Reintentar'}</button>
            </div>`;
        return `<tr>
            <td>${t.fecha}</td>
            <td>${cliente}</td>
            <td>${escaparHtmlInventario(t.tipo)}</td>
            <td><strong>${escaparHtmlInventario(t.referencia)}</strong></td>
            <td class="num">Bs. ${Number(t.montoVES || 0).toFixed(2)}</td>
            <td class="num">$${Number(t.montoUSD || 0).toFixed(2)}</td>
            <td><span class="transaction-badge ${estadoClass}">${t.estado}</span></td>
            <td>${accion}</td>
        </tr>`;
    }).join('');
}

function filtrarTransacciones() {
    renderizarTransacciones(document.getElementById('transaccion-busqueda')?.value || '');
}

function guardarAbono(e) {
    e.preventDefault();
    const metodo = document.getElementById('abono-metodo').value;
    const montoIngresado = parseFloat(document.getElementById('abono-monto').value);
    const esTransaccion = metodo === 'Transferencia VES' || metodo === 'Pago Móvil VES';

    if (!Number.isFinite(montoIngresado) || montoIngresado <= 0) return alert('Ingresa un monto válido.');

    if (esTransaccion) {
        const referencia = referenciaNormalizada(document.getElementById('abono-referencia')?.value);
        if (!referencia) return alert('Ingresa el número de referencia bancaria.');
        if (referenciaYaRegistrada(referencia)) return alert('Esa referencia ya está registrada.');
        const tx = {
            id: generarIdTransaccion(),
            clienteId: clienteSeleccionadoId,
            tipo: metodo === 'Pago Móvil VES' ? 'Pago Móvil' : 'Transferencia Bancaria',
            referencia,
            montoVES: montoIngresado,
            montoUSD: calcularMontoUSDDesdeBs(montoIngresado),
            tasaMomento: tasaActiva,
            fecha: new Date().toISOString().replace('T', ' ').substring(0, 16),
            estado: 'Confirmando',
            verificando: false,
            observacion: 'Referencia registrada. Esperando verificación.'
        };
        transacciones.push(tx);
        document.getElementById('abono-monto').value = '';
        document.getElementById('abono-referencia').value = '';
        cerrarModalAbono();
        renderizarTransacciones();
        verDetalleCliente(clienteSeleccionadoId);
        alert('Pago registrado como "Confirmando". No se ha reducido la deuda todavía. Debes ir a Tipos de Transacciones y pulsar Verificar para conciliarlo.');
        return;
    }

    let montoUSD = 0;
    let montoVES = 0;
    if (metodo === 'Efectivo USD') {
        montoUSD = montoIngresado;
    } else {
        montoVES = montoIngresado;
        montoUSD = calcularMontoUSDDesdeBs(montoIngresado);
    }

    abonos.push({
        id: 'A' + (abonos.length + 1),
        clienteId: clienteSeleccionadoId,
        fecha: new Date().toISOString().replace('T', ' ').substring(0, 16),
        montoUSD,
        montoVES,
        metodo,
        tasaMomento: tasaActiva,
        estado: 'Pago agregado'
    });

    document.getElementById('abono-monto').value = '';
    cerrarModalAbono();
    verDetalleCliente(clienteSeleccionadoId);
    renderizarClientes();
}

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

    // Actualiza el stock digital para que coincida con el stock físico contado.
    p.stock = stockFisico;

    // Deja registro en el historial de auditoría.
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
        // La pérdida real por faltante se calcula al costo, no al precio de venta.
        // Si el conteo físico es menor que el digital, esas unidades no están disponibles
        // y representan una pérdida económica mientras no sean repuestas.
        perdidaUSD: diferencia < 0 ? Math.abs(diferencia) * Number(p.costo || 0) : 0
    });

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

        p.stock = stockFisico;

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
function calcularEstadoPerdidasPendientes() {
    const pendientes = new Map(); // productoId -> [{ unidades, costo }]
    const impactos = new Map();   // auditoria.id -> impacto monetario de ese movimiento

    const cronologico = [...auditorias].sort((a, b) => {
        const da = new Date(String(a.fecha || '').replace(' ', 'T'));
        const db = new Date(String(b.fecha || '').replace(' ', 'T'));
        return da - db;
    });

    cronologico.forEach(a => {
        const productoId = a.productoId || a.codigo || a.nombre;
        const diferencia = Number(a.diferencia) || 0;
        const productoActual = productos.find(p => p.id === a.productoId);
        const costo = Number(a.costo ?? (productoActual ? productoActual.costo : 0)) || 0;

        if (!pendientes.has(productoId)) pendientes.set(productoId, []);
        const cola = pendientes.get(productoId);

        if (diferencia < 0) {
            const unidades = Math.abs(diferencia);
            cola.push({ unidades, costo });
            impactos.set(a.id, unidades * costo); // pérdida generada
        } else if (diferencia > 0) {
            let porReponer = diferencia;
            let recuperadoUSD = 0;

            while (porReponer > 0 && cola.length) {
                const lote = cola[0];
                const usadas = Math.min(porReponer, lote.unidades);
                recuperadoUSD += usadas * lote.costo;
                lote.unidades -= usadas;
                porReponer -= usadas;
                if (lote.unidades <= 0) cola.shift();
            }

            // Se guarda como negativo porque reduce la deuda pendiente.
            impactos.set(a.id, -recuperadoUSD);
        } else {
            impactos.set(a.id, 0);
        }
    });

    let totalPendiente = 0;
    pendientes.forEach(cola => {
        cola.forEach(lote => {
            totalPendiente += lote.unidades * lote.costo;
        });
    });

    return { totalPendiente, impactos };
}

// Resumen económico de pérdidas y recuperación con las ganancias generadas.
// Las pérdidas por daño/vencimiento/merma y las deudas de clientes eliminados
// forman una deuda económica. Las ganancias obtenidas por ventas la van reduciendo.
function obtenerCostoHistoricoProducto(productoId, item = null) {
    if (item && Number.isFinite(Number(item.costo))) return Number(item.costo);
    const actual = productos.find(p => p.id === productoId);
    if (actual) return Number(actual.costo || 0);
    const baja = [...eliminaciones].reverse().find(e => e.productoId === productoId && Number(e.costo) >= 0);
    if (baja) return Number(baja.costo || 0);
    const ajuste = [...auditorias].reverse().find(a => a.productoId === productoId && Number(a.costo) >= 0);
    return ajuste ? Number(ajuste.costo || 0) : 0;
}

function calcularGananciaGeneradaVentas() {
    return ventas.reduce((total, venta) => {
        const gananciaVenta = (venta.items || []).reduce((sum, item) => {
            const costo = obtenerCostoHistoricoProducto(item.productoId, item);
            const precio = Number(item.precio || 0);
            const cantidad = Number(item.cantidad || 0);
            return sum + ((precio - costo) * cantidad);
        }, 0);
        return total + gananciaVenta;
    }, 0);
}

function calcularResumenPerdidasEconomicas() {
    const perdidaProductos = eliminaciones.reduce((sum, e) => {
        if (Number.isFinite(Number(e.perdidaUSD))) return sum + Math.max(0, Number(e.perdidaUSD));
        return sum + calcularPerdidaBajaProducto(e.motivo, e.cantidadRetirada, e.costo);
    }, 0);

    const deudaClientesEliminados = clientesEliminados.reduce((sum, c) => sum + Math.max(0, Number(c.perdidaUSD ?? c.deudaUSD ?? 0)), 0);
    const perdidaFaltantes = calcularEstadoPerdidasPendientes().totalPendiente;
    const perdidaBruta = perdidaProductos + deudaClientesEliminados + perdidaFaltantes;
    const gananciaGenerada = Math.max(0, calcularGananciaGeneradaVentas());
    const perdidaPendiente = Math.max(0, perdidaBruta - gananciaGenerada);

    return { perdidaProductos, deudaClientesEliminados, perdidaFaltantes, perdidaBruta, gananciaGenerada, perdidaPendiente };
}

function renderizarResumenPerdidasEconomicas() {
    const r = calcularResumenPerdidasEconomicas();
    const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = `$${value.toFixed(2)}`;
    };
    set('perdidas-productos-usd', r.perdidaProductos);
    set('perdidas-clientes-usd', r.deudaClientesEliminados);
    set('perdidas-faltantes-usd', r.perdidaFaltantes);
    set('ganancia-generada-usd', r.gananciaGenerada);
    set('perdida-pendiente-global-usd', r.perdidaPendiente);

    const card = document.getElementById('perdida-pendiente-global-card');
    if (card) {
        card.style.borderLeftColor = r.perdidaPendiente > 0 ? 'var(--danger)' : 'var(--success)';
        card.style.background = r.perdidaPendiente > 0 ? '#fff1f2' : '#f0fdf4';
    }
}

// Renderiza el historial de ajustes ya aplicados (los más recientes primero).
function renderizarHistorialAuditoria() {
    const tbody = document.getElementById('auditoria-historial-body');
    if (!tbody) return;

    const estadoPerdidas = calcularEstadoPerdidasPendientes();
    const perdidaTotalEl = document.getElementById('auditoria-perdida-total');
    if (perdidaTotalEl) {
        perdidaTotalEl.textContent = `Pérdida pendiente por faltantes: $${estadoPerdidas.totalPendiente.toFixed(2)}`;
        perdidaTotalEl.style.background = estadoPerdidas.totalPendiente > 0 ? '#fff1f2' : '#eef2f7';
        perdidaTotalEl.style.color = estadoPerdidas.totalPendiente > 0 ? 'var(--danger)' : 'var(--text-muted)';
    }

    if (auditorias.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: var(--text-muted);">Aún no se han aplicado ajustes de inventario.</td></tr>';
        renderizarResumenPerdidasEconomicas();
        return;
    }

    const ordenado = [...auditorias].reverse();
    tbody.innerHTML = ordenado.map(a => {
        const impacto = Number(estadoPerdidas.impactos.get(a.id) || 0);
        let textoPerdida = '$0.00';
        let colorPerdida = 'var(--text-muted)';

        if (impacto > 0) {
            textoPerdida = '-$' + impacto.toFixed(2);
            colorPerdida = 'var(--danger)';
        } else if (impacto < 0) {
            textoPerdida = '+$' + Math.abs(impacto).toFixed(2);
            colorPerdida = 'var(--success)';
        }

        return `
        <tr>
            <td>${a.fecha}</td>
            <td>${a.codigo}</td>
            <td>${a.nombre}</td>
            <td class="num">${a.stockAnterior}</td>
            <td class="num"><strong>${a.stockFisico}</strong></td>
            <td class="num" style="color: ${a.diferencia > 0 ? 'var(--success)' : a.diferencia < 0 ? 'var(--danger)' : 'var(--text-muted)'}; font-weight: bold;">
                ${a.diferencia > 0 ? '+' : ''}${a.diferencia}
            </td>
            <td class="num" style="color: ${colorPerdida}; font-weight:700;">
                ${textoPerdida}
            </td>
        </tr>
    `;
    }).join('');
}
