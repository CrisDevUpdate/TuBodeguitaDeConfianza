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

        // Si la transacción proviene de un pedido web de cliente pendiente, descontar el inventario ahora que el Admin validó
        const ventaAsociada = (AppState.ventas || []).find(v => (tx.pedidoId && v.id === tx.pedidoId) || (v.referencia && v.referencia === tx.referencia));
        if (ventaAsociada && !ventaAsociada.descontadoInventario) {
            (ventaAsociada.items || []).forEach(item => {
                if (window.InventoryApp.StockService) {
                    window.InventoryApp.StockService.sale(item.productoId, item.cantidad);
                } else if (typeof descontarStockProducto === 'function') {
                    descontarStockProducto(item.productoId, item.cantidad);
                }
            });
            ventaAsociada.descontadoInventario = true;
            ventaAsociada.estado = 'APROBADO';
            if (typeof otorgarPuntosPorCompra === 'function') {
                otorgarPuntosPorCompra(ventaAsociada.clienteId, ventaAsociada.total, 'Pedido Web Validado');
            }
            if (typeof renderizarInventario === 'function') renderizarInventario();
            if (typeof renderizarPosProductos === 'function') renderizarPosProductos();
            if (typeof renderizarCatalogoCliente === 'function') renderizarCatalogoCliente();
        }

        if (window.InventoryApp.Persistence && typeof window.InventoryApp.Persistence.guardar === 'function') {
            window.InventoryApp.Persistence.guardar(true);
        }

        // Actualizar estado en PagosPorVerificar de Firestore
        if (window.InventoryApp?.Firebase?.actualizarEstadoPagoPorVerificar) {
            window.InventoryApp.Firebase.actualizarEstadoPagoPorVerificar(tx.id, 'APROBADO').catch(() => {});
            if (tx.pedidoId) {
                window.InventoryApp.Firebase.actualizarEstadoPagoPorVerificar(tx.pedidoId, 'APROBADO').catch(() => {});
            }
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

    if (extension === 'csv' || extension === 'xlsx' || extension === 'xls') {
        if (typeof XLSX === 'undefined') {
            alert('No se pudo cargar el lector de archivos. Verifica tu conexión a internet e inténtalo de nuevo.');
            return;
        }
        const lector = new FileReader();
        lector.onload = (e) => {
            try {
                const datos = new Uint8Array(e.target.result);
                const libro = XLSX.read(datos, { type: 'array', raw: false });
                const hoja = libro.Sheets[libro.SheetNames[0]];
                const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: false, defval: '' });
                volcarFilas(filas);
            } catch (error) {
                console.error(error);
                alert('No se pudo procesar el archivo. Verifica que CSV/Excel tenga un formato válido.');
            }
        };
        lector.onerror = () => alert('No se pudo leer el archivo.');
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

function limpiarVistaConciliacion() {
    if (typeof limpiarLoteTransacciones === 'function') limpiarLoteTransacciones();
    const busqueda = document.getElementById('transaccion-busqueda');
    if (busqueda) busqueda.value = '';
    renderizarTransacciones('');
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

function alCambiarMetodoTransaccionDirecta() {
    const tipo = document.getElementById('transaccion-tipo')?.value || 'Efectivo USD';
    const lblMonto = document.getElementById('lbl-transaccion-monto');
    const inputRef = document.getElementById('transaccion-referencia');
    const lblRef = document.getElementById('lbl-transaccion-referencia');
    const esEfectivo = tipo.includes('Efectivo');
    const esUSD = tipo === 'Efectivo USD';

    if (lblMonto) {
        lblMonto.innerHTML = esUSD 
            ? '<i class="fas fa-dollar-sign"></i> Monto ($ USD)' 
            : '<i class="fas fa-coins"></i> Monto (Bs)';
    }

    if (inputRef) {
        const hintRef = document.getElementById('transaccion-referencia-hint');
        if (esEfectivo) {
            inputRef.placeholder = 'Efectivo (opcional)';
            inputRef.required = false;
            if (lblRef) lblRef.innerHTML = '<i class="fas fa-hashtag"></i> N° de Referencia (opcional)';
            if (hintRef) hintRef.textContent = 'Opcional para pagos en efectivo';
        } else {
            inputRef.placeholder = tipo.includes('Móvil') ? 'Teléfono / N° Referencia' : 'N° Referencia Bancaria';
            inputRef.required = true;
            if (lblRef) lblRef.innerHTML = '<i class="fas fa-hashtag"></i> N° de Referencia <span style="color:var(--danger)">*</span>';
            if (hintRef) hintRef.textContent = 'Requerido para conciliar pago bancario';
        }
    }

    alEscribirMontoTransaccionDirecta();
}

function alEscribirMontoTransaccionDirecta() {
    const tipo = document.getElementById('transaccion-tipo')?.value || 'Efectivo USD';
    const inputMonto = document.getElementById('transaccion-monto');
    const smallEquiv = document.getElementById('transaccion-monto-equiv');
    if (!smallEquiv) return;

    const monto = parseFloat(inputMonto?.value) || 0;
    if (monto <= 0) {
        smallEquiv.textContent = tipo === 'Efectivo USD' ? 'Equiv: Bs. 0.00' : 'Equiv: $0.00';
        return;
    }

    if (tasaActiva <= 0) {
        smallEquiv.textContent = 'Tasa BCV no disponible';
        return;
    }

    if (tipo === 'Efectivo USD') {
        const equivVES = (monto * tasaActiva).toFixed(2);
        smallEquiv.innerHTML = `Equiv: <strong style="color:var(--success);">Bs. ${equivVES}</strong> (BCV: ${tasaActiva.toFixed(2)})`;
    } else {
        const equivUSD = (monto / tasaActiva).toFixed(2);
        smallEquiv.innerHTML = `Equiv: <strong style="color:var(--success);">$${equivUSD}</strong> (BCV: ${tasaActiva.toFixed(2)})`;
    }
}

function editarTransaccion(id) {
    const tx = transacciones.find(t => t.id === id);
    if (!tx) return;

    const cliente = document.getElementById('transaccion-cliente');
    const tipo = document.getElementById('transaccion-tipo');
    const referencia = document.getElementById('transaccion-referencia');
    const monto = document.getElementById('transaccion-monto');
    const editId = document.getElementById('transaccion-edit-id');

    if (cliente) cliente.value = tx.clienteId;
    if (tipo) {
        if (tx.tipo === 'Efectivo USD') tipo.value = 'Efectivo USD';
        else if (tx.tipo === 'Efectivo VES') tipo.value = 'Efectivo VES';
        else if (tx.tipo.includes('Móvil')) tipo.value = 'Pago Móvil';
        else tipo.value = 'Transferencia Bancaria';
    }
    if (referencia) referencia.value = tx.referencia;
    
    // Si la transacción se guardó en USD
    if (tx.tipo === 'Efectivo USD') {
        if (monto) monto.value = Number(tx.montoUSD || 0).toFixed(2);
    } else {
        if (monto) monto.value = Number(normalizarMontoTransaccion(tx.montoVES)).toFixed(2);
    }

    if (editId) editId.value = tx.id;

    alCambiarMetodoTransaccionDirecta();

    const btnCancelar = document.getElementById('btn-cancelar-edicion-tx');
    if (btnCancelar) btnCancelar.style.display = 'inline-flex';

    const form = document.getElementById('form-transaccion');
    const button = form?.querySelector('button[type="submit"]');
    if (button) button.innerHTML = '<i class="fas fa-check-circle"></i> Guardar y Aplicar Pago';

    document.getElementById('transaccion-monto')?.focus();
}

function cancelarEdicionTransaccion() {
    const form = document.getElementById('form-transaccion');
    if (!form) return;
    form.reset();
    const editId = document.getElementById('transaccion-edit-id');
    if (editId) editId.value = '';
    const btnCancelar = document.getElementById('btn-cancelar-edicion-tx');
    if (btnCancelar) btnCancelar.style.display = 'none';
    const button = form.querySelector('button[type="submit"]');
    if (button) button.innerHTML = '<i class="fas fa-check-circle"></i> Registrar y Rebajar Deuda';
    alCambiarMetodoTransaccionDirecta();
}

function registrarTransaccion(event) {
    event.preventDefault();
    const clienteId = document.getElementById('transaccion-cliente')?.value;
    const tipo = document.getElementById('transaccion-tipo')?.value || 'Efectivo USD';
    const refEl = document.getElementById('transaccion-referencia');
    let referencia = referenciaNormalizada(refEl ? refEl.value : '');
    const inputMonto = document.getElementById('transaccion-monto');
    const monto = parseFloat(inputMonto?.value) || 0;
    const editId = document.getElementById('transaccion-edit-id')?.value || null;

    if (!clienteId) {
        alert('Por favor selecciona un cliente.');
        return;
    }
    if (!Number.isFinite(monto) || monto <= 0) {
        alert('Por favor ingresa un monto válido mayor a 0.');
        return;
    }

    const esEfectivo = tipo.includes('Efectivo');
    if (!referencia) {
        if (esEfectivo) {
            referencia = 'Efectivo';
        } else {
            alert('Para Pago Móvil o Transferencia Bancaria es necesario ingresar el número de referencia.');
            if (refEl) refEl.focus();
            return;
        }
    }

    if (!esEfectivo && referenciaYaRegistrada(referencia, editId, true)) {
        alert(`La referencia "${referencia}" ya está registrada y conciliada en otra transacción.`);
        return;
    }

    const clienteObj = (clientes || []).find(c => c.id === clienteId);

    // Calcular montos USD y VES según la moneda elegida
    let montoUSD = 0;
    let montoVES = 0;
    if (tipo === 'Efectivo USD') {
        montoUSD = Number(monto.toFixed(2));
        montoVES = tasaActiva > 0 ? Number((monto * tasaActiva).toFixed(2)) : 0;
    } else {
        // Moneda en Bolívares
        montoVES = Number(monto.toFixed(2));
        montoUSD = calcularMontoUSDDesdeBs(montoVES);
    }

    const fechaAhora = new Date().toISOString().replace('T', ' ').substring(0, 16);

    let tx = editId ? transacciones.find(t => t.id === editId) : null;
    if (!tx && !esEfectivo) {
        tx = buscarTransaccionReintentable(referencia);
    }

    if (tx) {
        tx.clienteId = clienteId;
        tx.tipo = tipo;
        tx.referencia = referencia;
        tx.montoVES = montoVES;
        tx.montoUSD = montoUSD;
        tx.tasaMomento = tasaActiva;
        tx.fechaVerificacion = fechaAhora;
        tx.estado = 'Pago agregado';
        tx.verificando = false;
        tx.observacion = 'Abono validado y aplicado directamente por el Administrador.';
    } else {
        tx = {
            id: generarIdTransaccion(),
            clienteId,
            tipo,
            referencia,
            montoVES,
            montoUSD,
            tasaMomento: tasaActiva,
            fecha: fechaAhora,
            fechaVerificacion: fechaAhora,
            estado: 'Pago agregado',
            verificando: false,
            observacion: 'Abono registrado directamente por el Administrador.'
        };
        transacciones.push(tx);
    }

    // Registrar o actualizar abono directo para rebajar la deuda de inmediato
    let nuevoAbono = (AppState.abonos || []).find(a => a.transaccionId === tx.id);
    if (nuevoAbono) {
        nuevoAbono.montoUSD = montoUSD;
        nuevoAbono.montoVES = montoVES;
        nuevoAbono.metodo = tipo;
        nuevoAbono.referencia = referencia;
        nuevoAbono.tasaMomento = tasaActiva;
        nuevoAbono.estado = 'Pago agregado';
    } else {
        nuevoAbono = {
            id: 'A' + ((AppState.abonos || []).length + 1) + '_' + Date.now().toString().slice(-4),
            transaccionId: tx.id,
            clienteId,
            clienteNombre: clienteObj?.nombre || 'Cliente',
            clienteCedula: clienteObj?.cedula || clienteId,
            fecha: fechaAhora,
            montoUSD,
            montoVES,
            metodo: tipo,
            referencia,
            tasaMomento: tasaActiva,
            estado: 'Pago agregado'
        };
        if (!AppState.abonos) AppState.abonos = [];
        AppState.abonos.push(nuevoAbono);
    }

    // Actualizar fecha de último abono del cliente
    if (clienteObj) {
        clienteObj.ultimoAbonoFecha = new Date().toISOString();
        if (window.InventoryApp?.Firebase?.guardarCliente) {
            window.InventoryApp.Firebase.guardarCliente(clienteObj).catch(() => {});
        }
    }

    // Otorgar puntos de fidelización por el pago
    if (typeof otorgarPuntosPorCompra === 'function' && montoUSD > 0) {
        otorgarPuntosPorCompra(clienteId, montoUSD, 'Abono a Cuenta');
    }

    // Guardar en persistencia local
    if (window.InventoryApp?.Persistence?.guardar) {
        window.InventoryApp.Persistence.guardar(true);
    }

    // Sincronizar en Firestore
    if (window.InventoryApp?.Firebase) {
        if (nuevoAbono && typeof window.InventoryApp.Firebase.guardarAbono === 'function') {
            window.InventoryApp.Firebase.guardarAbono(nuevoAbono).catch(err => {
                console.warn('[Firestore] Error guardando abono:', err);
            });
        }
        if (typeof window.InventoryApp.Firebase.guardarTransaccion === 'function') {
            window.InventoryApp.Firebase.guardarTransaccion(tx).catch(err => {
                console.warn('[Firestore] Error guardando transacción:', err);
            });
        }
        if (typeof window.InventoryApp.Firebase.guardarPagoPorVerificar === 'function') {
            window.InventoryApp.Firebase.guardarPagoPorVerificar({
                id: tx.id,
                abonoId: nuevoAbono?.id || tx.id,
                transaccionId: tx.id,
                clienteId,
                clienteNombre: clienteObj?.nombre || 'Cliente',
                clienteCedula: clienteObj?.cedula || clienteId,
                montoUSD,
                totalUSD: montoUSD,
                montoVES,
                totalVES: montoVES,
                metodoPago: tipo,
                tipoPago: tipo,
                tipo,
                referencia,
                fecha: fechaAhora,
                fechaISO: new Date().toISOString(),
                estado: 'APROBADO',
                tipoRegistro: 'ABONO_DIRECTO_ADMIN',
                origen: 'Registrado por Administrador'
            }).catch(() => {});
        }
    }

    cancelarEdicionTransaccion();
    actualizarSelectTransacciones();
    renderizarTransacciones();
    if (typeof renderizarClientes === 'function') renderizarClientes();
    if (clienteSeleccionadoId === clienteId && typeof verDetalleCliente === 'function') {
        verDetalleCliente(clienteId);
    }

    const nombreCliente = clienteObj?.nombre || 'el cliente';
    const msg = `¡Pago registrado! Se han rebajado $${montoUSD.toFixed(2)} (Bs. ${montoVES.toFixed(2)}) de la deuda de ${nombreCliente}.`;
    if (window.InventoryApp?.Modal?.toast) {
        window.InventoryApp.Modal.toast(msg, 'success');
    } else {
        alert(msg);
    }
}

function actualizarSelectTransacciones() {
    const select = document.getElementById('transaccion-cliente');
    if (!select) return;
    const anterior = select.value;
    const listadoClientes = Array.isArray(clientes) ? clientes : (AppState.clientes || []);
    select.innerHTML = listadoClientes.length
        ? listadoClientes.map(c => `<option value="${c.id}">${escaparHtmlInventario(c.nombre || c.id)} · ${escaparHtmlInventario(c.id)}</option>`).join('')
        : '<option value="">No hay clientes registrados</option>';
    if (listadoClientes.some(c => c.id === anterior)) {
        select.value = anterior;
    }
}

function obtenerNombreClienteTransaccion(clienteId) {
    const listadoClientes = Array.isArray(clientes) ? clientes : (AppState.clientes || []);
    const encontrado = listadoClientes.find(c => c.id === clienteId);
    return encontrado ? (encontrado.nombre || encontrado.id) : 'Cliente eliminado';
}

function transaccionesPendientesCliente(clienteId) {
    const listadoTx = Array.isArray(transacciones) ? transacciones : (AppState.transacciones || []);
    return listadoTx.filter(t => t.clienteId === clienteId && t.estado === 'Confirmando').map(t => ({
        fecha: t.fecha,
        concepto: `Pago ${t.tipo || 'Directo'}`,
        detalle: `Ref. ${t.referencia || 'S/R'}`,
        cargoUSD: 0,
        abonoUSD: 0,
        montoPagoVES: `Bs. ${Number(t.montoVES || 0).toFixed(2)}`,
        pendiente: true,
        estado: 'Confirmando'
    }));
}

function renderizarTransacciones(filtro = null) {
    const tbody = document.getElementById('transacciones-body');
    if (!tbody) return;
    const texto = filtro === null ? (document.getElementById('transaccion-busqueda')?.value || '') : filtro;
    const normalizado = typeof referenciaNormalizada === 'function' ? referenciaNormalizada(texto) : (texto || '').trim().toUpperCase();
    const listadoTx = Array.isArray(transacciones) ? transacciones : (AppState.transacciones || []);

    const lista = listadoTx.slice().reverse().filter(t => {
        if (!normalizado) return true;
        const refNorm = typeof referenciaNormalizada === 'function' ? referenciaNormalizada(t.referencia) : (t.referencia || '').trim().toUpperCase();
        const nomNorm = (obtenerNombreClienteTransaccion(t.clienteId) || '').toUpperCase();
        return refNorm.includes(normalizado) || nomNorm.includes(texto.toUpperCase());
    });

    const pendientes = listadoTx.filter(t => t.estado === 'Confirmando').length;
    const agregados = listadoTx.filter(t => t.estado === 'Pago agregado').length;
    const fallidos = listadoTx.filter(t => t.estado === 'Fallido').length;
    const resumen = document.getElementById('transaccion-resumen');
    if (resumen) {
        resumen.textContent = `${pendientes} pendiente${pendientes === 1 ? '' : 's'} · ${fallidos} fallido${fallidos === 1 ? '' : 's'} · ${agregados} pago${agregados === 1 ? '' : 's'} agregado${agregados === 1 ? '' : 's'}`;
    }

    if (!lista.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:25px;">No hay transacciones que coincidan con la búsqueda.</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map(t => {
        const cliente = typeof escaparHtmlInventario === 'function'
            ? escaparHtmlInventario(obtenerNombreClienteTransaccion(t.clienteId))
            : obtenerNombreClienteTransaccion(t.clienteId);
        const estadoClass = t.estado === 'Pago agregado'
            ? 'transaction-approved'
            : (t.estado === 'Fallido' ? 'transaction-failed' : 'transaction-pending');
        const accion = t.estado === 'Pago agregado'
            ? '<span class="transaction-verified" style="color:var(--success); font-weight:600;"><i class="fas fa-check-circle"></i> Conciliado</span>'
            : `<div style="display:flex;gap:6px;flex-wrap:wrap;">
                <button type="button" class="btn btn-warning btn-sm" onclick="editarTransaccion('${t.id}')" ${t.verificando ? 'disabled' : ''}><i class="fas fa-pen"></i> Editar</button>
                <button type="button" class="btn btn-sm ${t.estado === 'Fallido' ? 'btn-danger' : 'btn-warning'}" onclick="procesarVerificacionTransaccion('${t.id}')" ${t.verificando ? 'disabled' : ''}>${t.verificando ? '<i class="fas fa-spinner fa-spin"></i> Verificando...' : '<i class="fas fa-rotate"></i> Reintentar'}</button>
            </div>`;
        const tipoStr = typeof escaparHtmlInventario === 'function' ? escaparHtmlInventario(t.tipo || 'Pago') : (t.tipo || 'Pago');
        const refStr = typeof escaparHtmlInventario === 'function' ? escaparHtmlInventario(t.referencia || 'S/R') : (t.referencia || 'S/R');
        return `<tr>
            <td>${t.fecha || ''}</td>
            <td>${cliente}</td>
            <td>${tipoStr}</td>
            <td><strong>${refStr}</strong></td>
            <td class="num">Bs. ${Number(t.montoVES || 0).toFixed(2)}</td>
            <td class="num">$${Number(t.montoUSD || 0).toFixed(2)}</td>
            <td><span class="transaction-badge ${estadoClass}">${t.estado || 'Confirmando'}</span></td>
            <td>${accion}</td>
        </tr>`;
    }).join('');
}

function filtrarTransacciones() {
    renderizarTransacciones(document.getElementById('transaccion-busqueda')?.value || '');
}

function guardarAbono(e) {
    e.preventDefault();
    const metodo = document.getElementById('abono-metodo')?.value || 'Efectivo USD';
    const montoIngresado = parseFloat(document.getElementById('abono-monto')?.value) || 0;
    const esTransaccion = metodo === 'Transferencia VES' || metodo === 'Pago Móvil VES';
    const clienteId = clienteSeleccionadoId;

    if (!clienteId) {
        alert('No se ha seleccionado ningún cliente.');
        return;
    }

    if (!Number.isFinite(montoIngresado) || montoIngresado <= 0) {
        alert('Por favor ingresa un monto válido mayor a 0.');
        return;
    }

    let referencia = 'Efectivo';
    if (esTransaccion) {
        referencia = referenciaNormalizada(document.getElementById('abono-referencia')?.value);
        if (!referencia) {
            alert('Por favor ingresa el número de referencia bancaria o pago móvil.');
            document.getElementById('abono-referencia')?.focus();
            return;
        }
        if (referenciaYaRegistrada(referencia, null, true)) {
            alert(`La referencia "${referencia}" ya está conciliada en otra transacción.`);
            return;
        }
    }

    let montoUSD = 0;
    let montoVES = 0;
    if (metodo === 'Efectivo USD') {
        montoUSD = Number(montoIngresado.toFixed(2));
        montoVES = tasaActiva > 0 ? Number((montoIngresado * tasaActiva).toFixed(2)) : 0;
    } else {
        montoVES = Number(montoIngresado.toFixed(2));
        montoUSD = calcularMontoUSDDesdeBs(montoVES);
    }

    const clienteObj = (clientes || []).find(c => c.id === clienteId);
    const fechaAhora = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const tipoTx = metodo === 'Pago Móvil VES' ? 'Pago Móvil' : (metodo === 'Transferencia VES' ? 'Transferencia Bancaria' : metodo);

    // Crear la transacción directa como "Pago agregado"
    const tx = {
        id: generarIdTransaccion(),
        clienteId,
        tipo: tipoTx,
        referencia,
        montoVES,
        montoUSD,
        tasaMomento: tasaActiva,
        fecha: fechaAhora,
        fechaVerificacion: fechaAhora,
        estado: 'Pago agregado',
        verificando: false,
        observacion: 'Abono registrado desde el perfil del cliente.'
    };
    transacciones.push(tx);

    // Crear el abono que reduce la deuda de inmediato
    const nuevoAbono = {
        id: 'A' + ((AppState.abonos || []).length + 1) + '_' + Date.now().toString().slice(-4),
        transaccionId: tx.id,
        clienteId,
        clienteNombre: clienteObj?.nombre || 'Cliente',
        clienteCedula: clienteObj?.cedula || clienteId,
        fecha: fechaAhora,
        montoUSD,
        montoVES,
        metodo: tipoTx,
        referencia,
        tasaMomento: tasaActiva,
        estado: 'Pago agregado'
    };
    if (!AppState.abonos) AppState.abonos = [];
    AppState.abonos.push(nuevoAbono);

    // Actualizar fecha de último abono del cliente
    if (clienteObj) {
        clienteObj.ultimoAbonoFecha = new Date().toISOString();
        if (window.InventoryApp?.Firebase?.guardarCliente) {
            window.InventoryApp.Firebase.guardarCliente(clienteObj).catch(() => {});
        }
    }

    // Puntos de fidelización
    if (typeof otorgarPuntosPorCompra === 'function' && montoUSD > 0) {
        otorgarPuntosPorCompra(clienteId, montoUSD, 'Abono a Cuenta');
    }

    // Persistir localmente
    if (window.InventoryApp?.Persistence?.guardar) {
        window.InventoryApp.Persistence.guardar(true);
    }

    // Sincronizar con Firestore
    if (window.InventoryApp?.Firebase) {
        if (typeof window.InventoryApp.Firebase.guardarAbono === 'function') {
            window.InventoryApp.Firebase.guardarAbono(nuevoAbono).catch(() => {});
        }
        if (typeof window.InventoryApp.Firebase.guardarTransaccion === 'function') {
            window.InventoryApp.Firebase.guardarTransaccion(tx).catch(() => {});
        }
        if (typeof window.InventoryApp.Firebase.guardarPagoPorVerificar === 'function') {
            window.InventoryApp.Firebase.guardarPagoPorVerificar({
                id: tx.id,
                abonoId: nuevoAbono.id,
                transaccionId: tx.id,
                clienteId,
                clienteNombre: clienteObj?.nombre || 'Cliente',
                clienteCedula: clienteObj?.cedula || clienteId,
                montoUSD,
                totalUSD: montoUSD,
                montoVES,
                totalVES: montoVES,
                metodoPago: tipoTx,
                tipoPago: tipoTx,
                tipo: tipoTx,
                referencia,
                fecha: fechaAhora,
                fechaISO: new Date().toISOString(),
                estado: 'APROBADO',
                tipoRegistro: esTransaccion ? 'ABONO_DIRECTO_DIGITAL' : 'ABONO_EFECTIVO',
                origen: 'Abono Registrado por Administrador'
            }).catch(() => {});
        }
    }

    const inputMonto = document.getElementById('abono-monto');
    if (inputMonto) inputMonto.value = '';
    const inputRef = document.getElementById('abono-referencia');
    if (inputRef) inputRef.value = '';

    cerrarModalAbono();
    renderizarTransacciones();
    if (typeof renderizarClientes === 'function') renderizarClientes();
    if (typeof verDetalleCliente === 'function') verDetalleCliente(clienteId);
    if (typeof renderizarHistorialVentasAdmin === 'function') renderizarHistorialVentasAdmin();
    if (typeof actualizarBadgeVentasHoy === 'function') actualizarBadgeVentasHoy();
    if (typeof renderizarNotificaciones === 'function') renderizarNotificaciones();
    if (typeof actualizarBadgesNotificaciones === 'function') actualizarBadgesNotificaciones();

    // Registrar en Centro de Notificaciones
    if (typeof window.registrarNotificacion === 'function') {
        const nomCliente = clienteObj?.nombre || clienteId;
        const esDivisa = metodo === 'Efectivo USD';
        const bsFmt = Number(montoVES || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 });
        const usdFmt = Number(montoUSD || 0).toFixed(2);
        const refStr = referencia && referencia !== 'Efectivo' ? ` - Ref: ${referencia}` : '';
        const msgNotif = esDivisa
            ? `${nomCliente} agregó un pago en divisas de $${usdFmt} USD (${tipoTx}${refStr})`
            : `${nomCliente} agregó un pago de Bs. ${bsFmt} ($${usdFmt} USD) (${tipoTx}${refStr})`;

        window.registrarNotificacion({
            tipo: 'pago',
            titulo: 'Abono Registrado',
            mensaje: msgNotif,
            clienteId: clienteId,
            clienteNombre: nomCliente,
            montoUSD: Number(montoUSD),
            montoVES: Number(montoVES),
            referenciaId: nuevoAbono.id,
            destino: {
                tab: 'transacciones',
                subAccion: 'verPago',
                idRef: nuevoAbono.id,
                clienteId: clienteId
            }
        });
    }

    const msg = `¡Abono de $${montoUSD.toFixed(2)} (Bs. ${montoVES.toFixed(2)}) aplicado con éxito! Deuda rebajada de inmediato.`;
    if (window.InventoryApp?.Modal?.toast) {
        window.InventoryApp.Modal.toast(msg, 'success');
    } else {
        alert(msg);
    }
}

/**
 * MÓDULO 4: Consenso y Aprobación Atómica de Abonos Reportados por Clientes
 */
async function aprobarAbonoReportadoAdmin(abonoId) {
    const abono = (AppState.abonos || []).find(a => a.id === abonoId);
    if (!abono) return;

    const confirmado = await (window.InventoryApp.Modal?.confirm 
        ? window.InventoryApp.Modal.confirm(
            'Aprobar Abono de Cliente',
            `¿Deseas validar el abono de <b>$${Number(abono.montoUSD || 0).toFixed(2)}</b> (Ref: <code>${abono.referencia || 'N/A'}</code>) del cliente <b>${abono.clienteNombre || abono.clienteId}</b>?<br><br>Esto descontará la deuda, liberará sus puntos acumulables y actualizará su fecha de solvencia.`,
            { confirmText: 'Sí, Validar Abono', cancelText: 'Cancelar' }
        )
        : confirm(`¿Validar abono de $${abono.montoUSD} para ${abono.clienteNombre}?`));

    if (!confirmado) return;

    // 1. Marcar abono como confirmado
    abono.estado = 'Pago agregado';
    abono.fechaAprobacion = new Date().toISOString().replace('T', ' ').substring(0, 16);

    // 2. Actualizar último abono y pausar mora
    const cliente = (AppState.clientes || []).find(c => c.id === abono.clienteId);
    if (cliente) {
        cliente.ultimoAbonoFecha = new Date().toISOString();
    }

    // 3. Liberar y acreditar puntos de lealtad
    if (typeof otorgarPuntosPorCompra === 'function' && Number(abono.montoUSD || 0) > 0) {
        otorgarPuntosPorCompra(abono.clienteId, Number(abono.montoUSD), 'Abono Conciliado por Admin');
    }

    // 4. Persistir localmente
    if (window.InventoryApp.Persistence?.guardar) {
        window.InventoryApp.Persistence.guardar(true);
    }

    // 5. Sincronizar en Firebase Firestore
    if (window.InventoryApp?.Firebase?.guardarAbono) {
        window.InventoryApp.Firebase.guardarAbono(abono).catch(err => {
            console.warn('[Firebase] Fallo al sincronizar abono aprobado:', err);
        });
    }
    if (cliente && window.InventoryApp?.Firebase?.guardarCliente) {
        window.InventoryApp.Firebase.guardarCliente(cliente).catch(err => {
            console.warn('[Firebase] Fallo al sincronizar cliente tras abono aprobado:', err);
        });
    }

    // Actualizar estado en PagosPorVerificar de Firestore
    if (window.InventoryApp?.Firebase?.actualizarEstadoPagoPorVerificar) {
        window.InventoryApp.Firebase.actualizarEstadoPagoPorVerificar(abono.id, 'APROBADO').catch(() => {});
        if (abono.transaccionId) {
            window.InventoryApp.Firebase.actualizarEstadoPagoPorVerificar(abono.transaccionId, 'APROBADO').catch(() => {});
        }
    }

    // 6. Refrescar vistas
    if (typeof renderizarClientes === 'function') renderizarClientes();
    if (typeof renderizarTransacciones === 'function') renderizarTransacciones();
    if (typeof renderizarAbonosPendientesReportados === 'function') renderizarAbonosPendientesReportados();
    if (typeof renderizarEstadoCuentaCliente === 'function') renderizarEstadoCuentaCliente();
    if (typeof renderizarHistorialVentasAdmin === 'function') renderizarHistorialVentasAdmin();
    if (typeof actualizarBadgeVentasHoy === 'function') actualizarBadgeVentasHoy();
    if (typeof renderizarNotificaciones === 'function') renderizarNotificaciones();
    if (typeof actualizarBadgesNotificaciones === 'function') actualizarBadgesNotificaciones();

    if (window.InventoryApp.Modal?.toast) {
        window.InventoryApp.Modal.toast(`✅ Abono de $${Number(abono.montoUSD).toFixed(2)} aprobado y conciliado exitosamente.`, 'success');
    }
}

/**
 * Rechaza un reporte de abono incorrecto o no verificado
 */
async function rechazarAbonoReportadoAdmin(abonoId) {
    const abono = (AppState.abonos || []).find(a => a.id === abonoId);
    if (!abono) return;

    const confirmado = await (window.InventoryApp.Modal?.confirm 
        ? window.InventoryApp.Modal.confirm(
            'Rechazar Reporte de Abono',
            `¿Estás seguro de rechazar el reporte de abono #${abono.id} por $${Number(abono.montoUSD || 0).toFixed(2)}?`,
            { confirmText: 'Rechazar Pago', isDanger: true }
        )
        : confirm(`¿Rechazar abono #${abono.id}?`));

    if (!confirmado) return;

    abono.estado = 'RECHAZADO';
    abono.fechaRechazo = new Date().toISOString().replace('T', ' ').substring(0, 16);

    if (window.InventoryApp.Persistence?.guardar) {
        window.InventoryApp.Persistence.guardar(true);
    }

    if (window.InventoryApp?.Firebase?.guardarAbono) {
        window.InventoryApp.Firebase.guardarAbono(abono).catch(err => {
            console.warn('[Firebase] Fallo al sincronizar abono rechazado:', err);
        });
    }

    // Actualizar estado en PagosPorVerificar de Firestore
    if (window.InventoryApp?.Firebase?.actualizarEstadoPagoPorVerificar) {
        window.InventoryApp.Firebase.actualizarEstadoPagoPorVerificar(abono.id, 'RECHAZADO', 'Rechazado por administrador').catch(() => {});
        if (abono.transaccionId) {
            window.InventoryApp.Firebase.actualizarEstadoPagoPorVerificar(abono.transaccionId, 'RECHAZADO', 'Rechazado por administrador').catch(() => {});
        }
    }

    if (typeof renderizarAbonosPendientesReportados === 'function') renderizarAbonosPendientesReportados();
    if (typeof renderizarEstadoCuentaCliente === 'function') renderizarEstadoCuentaCliente();

    if (window.InventoryApp.Modal?.toast) {
        window.InventoryApp.Modal.toast(`Reporte de abono #${abono.id} marcado como rechazado.`, 'warning');
    }
}

/**
 * Obtiene la lista unificada y deduplicada de pagos y abonos pendientes por verificar.
 * Las transacciones a crédito se excluyen automáticamente ya que no requieren aprobación.
 */
function obtenerPagosPendientesUnificados() {
    const unificados = [];
    const idsProcesados = new Set();
    const refsProcesadas = new Set();

    const esCredito = (item) => {
        if (!item) return false;
        if (item.esCredito === true) return true;
        const metodo = String(item.metodoPago || item.tipoPago || item.metodo || item.formaPago || item.tipo || '').toLowerCase();
        return metodo.includes('crédito') || metodo.includes('credito');
    };

    // 1. Recorrer Abonos reportados
    const abonos = Array.isArray(AppState.abonos) ? AppState.abonos : [];
    abonos.forEach(a => {
        const estado = a.estado || 'PENDIENTE_CONFIRMACION';
        const esPendiente = estado === 'PENDIENTE_CONFIRMACION' || estado === 'PENDIENTE' || estado === 'POR_VERIFICAR';
        if (esPendiente && !esCredito(a)) {
            const idNorm = String(a.id || '').trim();
            const refNorm = String(a.referencia || '').trim().toLowerCase();
            if (idNorm && !idsProcesados.has(idNorm)) {
                idsProcesados.add(idNorm);
                if (refNorm && refNorm !== 'sin ref' && refNorm !== 'n/a') {
                    refsProcesadas.add(refNorm);
                }

                const metodoStr = a.formaPago || a.metodo || 'Abono';
                const esDivisaUSD = String(metodoStr).includes('USD') || String(metodoStr).includes('Divisa');
                const tasaVal = Number(a.tasaMomento || AppState.tasaActiva || AppState.tasaUSD_BCV || 0);

                let usd = Number(a.montoUSD || a.monto || 0);
                let ves = Number(a.montoVES || 0);
                // Sanación de datos: si un pago en Bolívares se guardó erróneamente con el monto en Bs asignado a USD
                if (!esDivisaUSD && usd >= 50 && ves > usd * 10 && tasaVal > 0) {
                    ves = usd;
                    usd = Number((ves / tasaVal).toFixed(2));
                } else if (!esDivisaUSD && (!ves || ves === 0) && tasaVal > 0) {
                    ves = usd * tasaVal;
                }

                unificados.push({
                    id: a.id,
                    abonoId: a.id,
                    ventaId: a.ventaId || null,
                    origen: 'abono',
                    fecha: a.fecha || '',
                    clienteId: a.clienteId,
                    clienteNombre: a.clienteNombre || a.clienteId,
                    metodo: metodoStr,
                    referencia: a.referencia || 'Sin Ref',
                    nota: a.nota || a.comentario || '',
                    montoUSD: usd,
                    montoVES: ves,
                    esDivisaUSD
                });
            }
        }
    });

    // 2. Recorrer PagosPorVerificar de Firestore
    const pagosVerif = Array.isArray(AppState.pagosPorVerificar) ? AppState.pagosPorVerificar : [];
    pagosVerif.forEach(p => {
        const estado = p.estado || 'PENDIENTE_VERIFICACION';
        const esPendiente = estado === 'PENDIENTE_VERIFICACION' || estado === 'PENDIENTE_CONFIRMACION' || estado === 'PENDIENTE' || estado === 'POR_VERIFICAR';
        if (esPendiente && !esCredito(p)) {
            const idNorm = String(p.id || '').trim();
            const abonoIdNorm = String(p.abonoId || '').trim();
            const pedidoIdNorm = String(p.pedidoId || p.ventaId || '').trim();
            const refNorm = String(p.referencia || '').trim().toLowerCase();

            // Si ya fue incluido en unificados, evitar duplicación
            if (idsProcesados.has(idNorm) || (abonoIdNorm && idsProcesados.has(abonoIdNorm))) {
                return;
            }
            if (refNorm && refNorm !== 'sin ref' && refNorm !== 'n/a' && refsProcesadas.has(refNorm)) {
                return;
            }

            idsProcesados.add(idNorm);
            if (abonoIdNorm) idsProcesados.add(abonoIdNorm);
            if (pedidoIdNorm) idsProcesados.add(pedidoIdNorm);
            if (refNorm && refNorm !== 'sin ref' && refNorm !== 'n/a') {
                refsProcesadas.add(refNorm);
            }

            const itemsTexto = Array.isArray(p.items) 
                ? p.items.map(it => `${it.cantidad}x ${it.nombre || it.productoId}`).join(', ') 
                : (p.nota || p.origen || 'Venta o pago');

            const metodoStr = p.metodoPago || p.tipoPago || p.tipo || 'Pago Móvil / Transferencia';
            const esDivisaUSD = String(metodoStr).includes('USD') || String(metodoStr).includes('Divisa');
            const tasaVal = Number(p.tasaMomento || AppState.tasaActiva || AppState.tasaUSD_BCV || 0);

            let usd = Number(p.totalUSD || p.montoUSD || p.total || 0);
            let ves = Number(p.totalVES || p.montoVES || 0);
            if (!esDivisaUSD && usd >= 50 && ves > usd * 10 && tasaVal > 0) {
                ves = usd;
                usd = Number((ves / tasaVal).toFixed(2));
            } else if (!esDivisaUSD && (!ves || ves === 0) && tasaVal > 0) {
                ves = usd * tasaVal;
            }

            unificados.push({
                id: p.id,
                abonoId: p.abonoId || null,
                ventaId: p.ventaId || p.pedidoId || null,
                origen: 'pagosPorVerificar',
                fecha: p.fecha || '',
                clienteId: p.clienteId || p.clienteCedula,
                clienteNombre: p.clienteNombre || p.clienteId,
                metodo: metodoStr,
                referencia: p.referencia || 'N/A',
                nota: itemsTexto,
                montoUSD: usd,
                montoVES: ves,
                esDivisaUSD
            });
        }
    });

    return unificados;
}

/**
 * Actualiza los badges de abonos y pagos pendientes por aprobar (deduplicados y sin crédito)
 */
function actualizarBadgesAbonos() {
    const unificados = obtenerPagosPendientesUnificados();
    const pendientes = unificados.length;

    const bDesk = document.getElementById('badge-abonos-desktop');
    const bMob = document.getElementById('badge-abonos-mobile');

    if (bDesk) {
        if (pendientes > 0) {
            bDesk.style.display = 'inline-flex';
            bDesk.textContent = pendientes;
        } else {
            bDesk.style.display = 'none';
        }
    }

    if (bMob) {
        if (pendientes > 0) {
            bMob.style.display = 'block';
        } else {
            bMob.style.display = 'none';
        }
    }
}

/**
 * Aprueba una venta o pago registrado en PagosPorVerificar
 */
window.aprobarPagoPorVerificarAdmin = async function(id) {
    if (!id) return;
    const lista = AppState.pagosPorVerificar || [];
    const item = lista.find(p => p.id === id);
    if (!item) return;

    item.estado = 'APROBADO';
    item.fechaAprobacion = new Date().toISOString();

    // 1. Si es venta, confirmar en AppState.ventas
    const ventaId = item.ventaId || item.pedidoId || (item.tipoRegistro === 'VENTA' ? item.id : null);
    if (ventaId) {
        const venta = (AppState.ventas || []).find(v => v.id === ventaId);
        if (venta) {
            venta.estado = 'CONFIRMADO';
            if (window.InventoryApp?.Firebase?.registrarVenta) {
                window.InventoryApp.Firebase.registrarVenta(venta, venta.items || []).catch(() => {});
            }
        }
    }

    // 2. Si es abono, confirmar en AppState.abonos
    const abonoId = item.abonoId || (item.tipoRegistro === 'ABONO' ? item.id : null);
    if (abonoId) {
        const abono = (AppState.abonos || []).find(a => a.id === abonoId);
        if (abono) {
            abono.estado = 'Pago agregado';
            if (window.InventoryApp?.Firebase?.guardarAbono) {
                window.InventoryApp.Firebase.guardarAbono(abono).catch(() => {});
            }
        }
    }

    // 3. Sincronizar en Firebase colección PagosPorVerificar
    if (window.InventoryApp?.Firebase?.actualizarEstadoPagoPorVerificar) {
        await window.InventoryApp.Firebase.actualizarEstadoPagoPorVerificar(id, 'APROBADO');
    }

    // 4. Persistir localmente
    if (window.InventoryApp?.Persistence?.guardar) {
        window.InventoryApp.Persistence.guardar(true);
    }

    // 5. Registrar en Centro de Notificaciones
    if (typeof window.registrarNotificacion === 'function') {
        const clienteNom = item.clienteNombre || item.clienteId || 'Cliente';
        const monto = Number(item.totalUSD || item.montoUSD || 0);
        window.registrarNotificacion({
            tipo: 'pago',
            titulo: 'Pago Aprobado y Conciliado',
            mensaje: `El pago #${id} por $${monto.toFixed(2)} de ${clienteNom} fue verificado y aprobado.`,
            clienteId: item.clienteId,
            clienteNombre: clienteNom,
            montoUSD: monto,
            referenciaId: id,
            destino: { tab: 'transacciones', subAccion: 'verPago', idRef: id }
        });
    }

    renderizarAbonosPendientesReportados();
    if (typeof renderizarHistorialVentasAdmin === 'function') renderizarHistorialVentasAdmin();
    if (typeof actualizarBadgeVentasHoy === 'function') actualizarBadgeVentasHoy();
    if (typeof renderizarNotificaciones === 'function') renderizarNotificaciones();
    if (typeof actualizarBadgesNotificaciones === 'function') actualizarBadgesNotificaciones();
    if (typeof renderizarTransacciones === 'function') renderizarTransacciones();
    if (typeof renderizarClientes === 'function') renderizarClientes();

    if (window.InventoryApp?.Modal?.toast) {
        window.InventoryApp.Modal.toast(`✅ Pago #${id} verificado y aprobado con éxito.`, 'success');
    }
};

/**
 * Rechaza un pago registrado en PagosPorVerificar
 */
window.rechazarPagoPorVerificarAdmin = async function(id) {
    if (!id) return;
    const motivo = prompt('Ingresa el motivo del rechazo (ej. Comprobante bancario no coincide):', 'Comprobante de pago no validado en banco');
    if (motivo === null) return;

    const lista = AppState.pagosPorVerificar || [];
    const item = lista.find(p => p.id === id);
    if (item) {
        item.estado = 'RECHAZADO';
        item.motivoRechazo = motivo;
        item.fechaRechazo = new Date().toISOString();
    }

    const ventaId = item?.ventaId || item?.pedidoId || (item?.tipoRegistro === 'VENTA' ? item.id : null);
    if (ventaId) {
        const venta = (AppState.ventas || []).find(v => v.id === ventaId);
        if (venta) {
            venta.estado = 'RECHAZADO';
            venta.motivoRechazo = motivo;
        }
    }

    const abonoId = item?.abonoId || (item?.tipoRegistro === 'ABONO' ? item.id : null);
    if (abonoId) {
        const abono = (AppState.abonos || []).find(a => a.id === abonoId);
        if (abono) {
            abono.estado = 'RECHAZADO';
            abono.motivoRechazo = motivo;
        }
    }

    if (window.InventoryApp?.Firebase?.actualizarEstadoPagoPorVerificar) {
        await window.InventoryApp.Firebase.actualizarEstadoPagoPorVerificar(id, 'RECHAZADO', motivo);
    }

    if (window.InventoryApp?.Persistence?.guardar) {
        window.InventoryApp.Persistence.guardar(true);
    }

    renderizarAbonosPendientesReportados();
    if (window.InventoryApp?.Modal?.toast) {
        window.InventoryApp.Modal.toast(`⚠️ Pago #${id} marcado como Rechazado.`, 'warning');
    }
};

/**
 * Aprueba un reporte de pago o abono desde la lista unificada
 */
window.aprobarPagoOVerificacionUnificado = async function(id) {
    if (!id) return;
    const unificados = obtenerPagosPendientesUnificados();
    const item = unificados.find(u => u.id === id || u.abonoId === id || u.ventaId === id);

    const idAbono = item ? (item.abonoId || item.id) : id;
    const abono = (AppState.abonos || []).find(a => a.id === idAbono || a.id === id);
    if (abono) {
        await aprobarAbonoReportadoAdmin(abono.id);
        return;
    }

    const idPago = item ? item.id : id;
    await window.aprobarPagoPorVerificarAdmin(idPago);
};

/**
 * Rechaza un reporte de pago o abono desde la lista unificada
 */
window.rechazarPagoOVerificacionUnificado = async function(id) {
    if (!id) return;
    const unificados = obtenerPagosPendientesUnificados();
    const item = unificados.find(u => u.id === id || u.abonoId === id || u.ventaId === id);

    const idAbono = item ? (item.abonoId || item.id) : id;
    const abono = (AppState.abonos || []).find(a => a.id === idAbono || a.id === id);
    if (abono) {
        await rechazarAbonoReportadoAdmin(abono.id);
        return;
    }

    const idPago = item ? item.id : id;
    await window.rechazarPagoPorVerificarAdmin(idPago);
};

/**
 * Renderiza la sección única y deduplicada de pagos y abonos pendientes por verificar
 */
function renderizarAbonosPendientesReportados() {
    actualizarBadgesAbonos();

    const containers = [
        document.getElementById('abonos-pendientes-admin-container'),
        document.getElementById('abonos-pendientes-clientes-container')
    ].filter(Boolean);

    if (containers.length === 0) return;

    const unificados = obtenerPagosPendientesUnificados();

    if (unificados.length === 0) {
        containers.forEach(c => {
            c.innerHTML = `
                <div style="background:#f8fafc; border:1px dashed var(--border); border-radius:10px; padding:14px; text-align:center; color:var(--text-muted); font-size:0.88rem;">
                    <i class="fas fa-check-double" style="color:#16a34a; margin-right:6px;"></i> Todos los reportes de pagos se encuentran al día. Sin pagos pendientes por verificar.
                </div>
            `;
        });
        return;
    }

    // ÚNICA notificación/tabla consolidada
    const htmlContent = `
        <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:12px; padding:16px; margin-bottom:18px; box-shadow:0 2px 8px rgba(217,119,6,0.08);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
                <h4 style="margin:0; font-size:1rem; color:#92400e; display:flex; align-items:center; gap:8px;">
                    <span style="display:inline-flex; width:26px; height:26px; border-radius:50%; background:#d97706; color:#ffffff; align-items:center; justify-content:center; font-size:0.8rem; font-weight:800;">${unificados.length}</span>
                    <i class="fas fa-file-invoice-dollar" style="color:#d97706;"></i> Pagos y Abonos Pendientes por Verificar
                </h4>
                <small style="color:#92400e; font-weight:600;">Revisa comprobante bancario (Pago Móvil / Transferencia) y aprueba para liberar saldo</small>
            </div>
            <div class="table-responsive">
                <table style="width:100%; font-size:0.85rem; border-collapse:collapse;">
                    <thead>
                        <tr style="background:#fef3c7; border-bottom:1px solid #fde68a;">
                            <th style="padding:8px; text-align:left;">Fecha</th>
                            <th style="padding:8px; text-align:left;">ID / Ref</th>
                            <th style="padding:8px; text-align:left;">Cliente</th>
                            <th style="padding:8px; text-align:left;">Método</th>
                            <th style="padding:8px; text-align:left;">Detalle / Nota</th>
                            <th style="padding:8px; text-align:right;">Monto Registrado</th>
                            <th style="padding:8px; text-align:right;">Equivalente</th>
                            <th style="padding:8px; text-align:center;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${unificados.map(u => {
                            const esDivisa = u.esDivisaUSD;
                            const montoPrincipal = esDivisa 
                                ? `$${u.montoUSD.toFixed(2)} USD` 
                                : `Bs. ${u.montoVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                            const montoEquivalente = esDivisa
                                ? (u.montoVES > 0 ? `Bs. ${u.montoVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}` : '—')
                                : `$${u.montoUSD.toFixed(2)} USD`;

                            return `
                            <tr style="border-bottom:1px solid #fef3c7; background:rgba(255,255,255,0.7);">
                                <td style="padding:8px; white-space:nowrap;">${u.fecha || ''}</td>
                                <td style="padding:8px;">
                                    <code>#${u.id}</code>
                                    ${u.referencia && u.referencia !== 'N/A' && u.referencia !== 'Sin Ref' ? `<br><small style="color:var(--text-muted);">Ref: ${u.referencia}</small>` : ''}
                                </td>
                                <td style="padding:8px;">
                                    <strong>${u.clienteNombre || u.clienteId || 'Cliente'}</strong>
                                    <br><small style="color:var(--text-muted);">${u.clienteId || ''}</small>
                                </td>
                                <td style="padding:8px;">
                                    <strong style="color:#b45309;">${u.metodo}</strong>
                                </td>
                                <td style="padding:8px; max-width:200px; font-size:0.8rem; color:#475569;" title="${u.nota || ''}">
                                    <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${u.nota || 'Abono a cuenta'}</div>
                                </td>
                                <td style="padding:8px; text-align:right; font-weight:700; color:var(--primary-accent);">${montoPrincipal}</td>
                                <td style="padding:8px; text-align:right; font-weight:600; color:#16a34a;">${montoEquivalente}</td>
                                <td style="padding:8px; text-align:center; white-space:nowrap;">
                                    <button type="button" class="btn btn-sm btn-success" onclick="aprobarPagoOVerificacionUnificado('${u.id}')" style="padding:6px 12px; margin-right:4px; font-weight:700;">
                                        <i class="fas fa-check"></i> Aprobar
                                    </button>
                                    <button type="button" class="btn btn-sm btn-danger" onclick="rechazarPagoOVerificacionUnificado('${u.id}')" style="padding:6px 12px; font-weight:700;">
                                        <i class="fas fa-times"></i> Rechazar
                                    </button>
                                </td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    containers.forEach(c => {
        c.innerHTML = htmlContent;
    });
}

/**
 * Regla de Negocio (Mora): Descuento automático de 2 puntos semanales si el cliente
 * pasa 7 días consecutivos sin realizar un abono mínimo de 1 USD (o equivalente en Bs).
 */
function verificarPenalizacionesPorMoraGlobal() {
    const clientes = AppState.clientes || [];
    const ventas = AppState.ventas || [];
    const abonos = AppState.abonos || [];
    const usuarios = AppState.usuarios || [];
    const ahora = Date.now();
    let penalizacionesAplicadas = 0;

    clientes.forEach(c => {
        // Calcular si tiene deuda pendiente
        const ventasCli = ventas.filter(v => v.clienteId === c.id);
        const abonosCli = abonos.filter(a => a.clienteId === c.id && (a.estado === 'Pago agregado' || !a.estado));
        const totalCreditoUSD = ventasCli.filter(v => v.tipo === 'Crédito').reduce((sum, v) => sum + Number(v.total || 0), 0);
        const totalAbonadoUSD = abonosCli.reduce((sum, a) => sum + Number(a.montoUSD || 0), 0);
        const saldoDeuda = totalCreditoUSD - totalAbonadoUSD;

        if (saldoDeuda > 1.0) {
            // Determinar fecha base para el conteo de mora
            let fechaBaseMs = c.ultimoAbonoFecha ? new Date(c.ultimoAbonoFecha).getTime() : null;
            if (!fechaBaseMs) {
                // Tomar la fecha de la última venta a crédito
                const ultimaVentaCredito = ventasCli.filter(v => v.tipo === 'Crédito').slice(-1)[0];
                if (ultimaVentaCredito?.fecha) {
                    fechaBaseMs = new Date(ultimaVentaCredito.fecha).getTime();
                }
            }

            if (fechaBaseMs && !isNaN(fechaBaseMs)) {
                const diasTranscurridos = Math.floor((ahora - fechaBaseMs) / (1000 * 60 * 60 * 24));
                const semanasMora = Math.floor(diasTranscurridos / 7);

                if (semanasMora > 0) {
                    const usuarioObj = usuarios.find(u => u.id === c.id || u.cedula === c.id);
                    if (usuarioObj && (usuarioObj.puntosAcumulados || 0) > 0) {
                        const semanasYaPenalizadas = c.semanasPenalizadasMora || 0;
                        const semanasNuevas = semanasMora - semanasYaPenalizadas;

                        if (semanasNuevas > 0) {
                            const puntosADescontar = semanasNuevas * 2;
                            usuarioObj.puntosAcumulados = Math.max(0, (usuarioObj.puntosAcumulados || 0) - puntosADescontar);
                            c.semanasPenalizadasMora = semanasMora;
                            penalizacionesAplicadas++;

                            console.log(`[Regla Mora] Cliente ${c.nombre} (${c.id}): -${puntosADescontar} pts aplicados por ${semanasMora} semanas en mora.`);
                        }
                    }
                }
            }
        } else {
            // Solvente: reiniciar contador de penalizaciones
            c.semanasPenalizadasMora = 0;
        }
    });

    if (penalizacionesAplicadas > 0 && window.InventoryApp.Persistence?.guardar) {
        window.InventoryApp.Persistence.guardar(true);
    }
}

// Ejecutar verificación de mora periódicamente
setTimeout(verificarPenalizacionesPorMoraGlobal, 2000);

// Exportar funciones en el namespace global
window.aprobarAbonoReportadoAdmin = aprobarAbonoReportadoAdmin;
window.rechazarAbonoReportadoAdmin = rechazarAbonoReportadoAdmin;
window.renderizarAbonosPendientesReportados = renderizarAbonosPendientesReportados;
window.actualizarBadgesAbonos = actualizarBadgesAbonos;
window.verificarPenalizacionesPorMoraGlobal = verificarPenalizacionesPorMoraGlobal;
window.renderizarTransacciones = renderizarTransacciones;
window.actualizarSelectTransacciones = actualizarSelectTransacciones;
window.transaccionesPendientesCliente = transaccionesPendientesCliente;
window.obtenerNombreClienteTransaccion = obtenerNombreClienteTransaccion;
window.procesarVerificacionTransaccion = procesarVerificacionTransaccion;
window.registrarTransaccion = registrarTransaccion;
window.editarTransaccion = editarTransaccion;
window.cancelarEdicionTransaccion = cancelarEdicionTransaccion;
window.alCambiarMetodoTransaccionDirecta = alCambiarMetodoTransaccionDirecta;
window.alEscribirMontoTransaccionDirecta = alEscribirMontoTransaccionDirecta;
window.filtrarTransacciones = filtrarTransacciones;
window.limpiarVistaConciliacion = limpiarVistaConciliacion;
window.guardarAbono = guardarAbono;
window.abrirModalAbono = abrirModalAbono;
window.cerrarModalAbono = cerrarModalAbono;
window.actualizarMonedaAbono = actualizarMonedaAbono;
window.calcularEquivalenteAbono = calcularEquivalenteAbono;


