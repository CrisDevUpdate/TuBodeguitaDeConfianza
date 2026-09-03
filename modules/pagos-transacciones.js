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
    limpiarLoteTransacciones();
    const busqueda = document.getElementById('transaccion-busqueda');
    if (busqueda) busqueda.value = '';
    const resumen = document.getElementById('transaccion-resumen');
    if (resumen) resumen.textContent = '0 pendientes · 0 fallidos · 0 pagos agregados';
    const resultado = document.getElementById('transaccion-lote-resultado');
    if (resultado) {
        resultado.style.display = 'none';
        resultado.innerHTML = '';
    }
    const progreso = document.getElementById('transaccion-lote-progreso');
    if (progreso) progreso.innerHTML = 'Vista reiniciada. Las transacciones guardadas no fueron eliminadas.';
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

        if (window.InventoryApp && window.InventoryApp.Persistence) {
            window.InventoryApp.Persistence.guardar(true);
        }
        if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarTransaccion === 'function') {
            window.InventoryApp.Firebase.guardarTransaccion(tx).catch(err => {
                console.warn('[Firebase] Error al guardar transacción en Firestore:', err);
            });
        }

        // Guardar inmediatamente en PagosPorVerificar de Firebase Firestore
        if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarPagoPorVerificar === 'function') {
            const clienteObj = (clientes || []).find(c => c.id === clienteSeleccionadoId);
            window.InventoryApp.Firebase.guardarPagoPorVerificar({
                id: tx.id,
                pedidoId: tx.id,
                transaccionId: tx.id,
                clienteId: clienteSeleccionadoId,
                clienteNombre: clienteObj ? clienteObj.nombre : clienteSeleccionadoId,
                clienteCedula: clienteObj ? (clienteObj.cedula || clienteObj.id) : clienteSeleccionadoId,
                montoUSD: tx.montoUSD,
                totalUSD: tx.montoUSD,
                montoVES: tx.montoVES,
                totalVES: tx.montoVES,
                metodoPago: tx.tipo,
                tipoPago: tx.tipo,
                tipo: tx.tipo,
                referencia: tx.referencia,
                fecha: tx.fecha,
                fechaISO: new Date().toISOString(),
                estado: 'PENDIENTE_VERIFICACION',
                tipoRegistro: 'TRANSACCION_ABONO',
                origen: 'Abono / Pago Móvil Registrado'
            }).catch(err => console.warn('[Firebase] Error al registrar abono en PagosPorVerificar:', err));
        }

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

    const clienteObj = clientes.find(c => c.id === clienteSeleccionadoId);
    const nuevoAbono = {
        id: 'A' + (abonos.length + 1) + '_' + Date.now().toString().slice(-4),
        clienteId: clienteSeleccionadoId,
        clienteNombre: clienteObj?.nombre || 'Cliente',
        clienteCedula: clienteObj?.cedula || clienteSeleccionadoId,
        fecha: new Date().toISOString().replace('T', ' ').substring(0, 16),
        montoUSD,
        montoVES,
        metodo,
        tasaMomento: tasaActiva,
        estado: 'Pago agregado'
    };
    abonos.push(nuevoAbono);

    // Actualizar fecha de último abono en cliente para pausar penalización por mora
    if (clienteObj) {
        clienteObj.ultimoAbonoFecha = new Date().toISOString();
        if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarCliente === 'function') {
            window.InventoryApp.Firebase.guardarCliente(clienteObj).catch(() => {});
        }
    }

    // Fidelización y Gamificación: Otorgar puntos por el monto abonado
    if (typeof otorgarPuntosPorCompra === 'function' && montoUSD > 0) {
        otorgarPuntosPorCompra(clienteSeleccionadoId, montoUSD, 'Abono a Cuenta');
    }

    // Persistir localmente
    if (window.InventoryApp && window.InventoryApp.Persistence) {
        window.InventoryApp.Persistence.guardar(true);
    }

    // Guardar abono en Firestore
    if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarAbono === 'function') {
        window.InventoryApp.Firebase.guardarAbono(nuevoAbono).catch(err => {
            console.warn('[Abonos] Error al guardar abono en Firestore:', err);
        });
    }

    // Registrar en PagosPorVerificar de Firestore
    if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarPagoPorVerificar === 'function') {
        window.InventoryApp.Firebase.guardarPagoPorVerificar({
            id: nuevoAbono.id,
            abonoId: nuevoAbono.id,
            clienteId: clienteSeleccionadoId,
            clienteNombre: clienteObj?.nombre || 'Cliente',
            clienteCedula: clienteObj?.cedula || clienteSeleccionadoId,
            montoUSD: nuevoAbono.montoUSD,
            totalUSD: nuevoAbono.montoUSD,
            montoVES: nuevoAbono.montoVES,
            totalVES: nuevoAbono.montoVES,
            metodoPago: nuevoAbono.metodo,
            tipoPago: nuevoAbono.metodo,
            tipo: nuevoAbono.metodo,
            referencia: 'Efectivo',
            fecha: nuevoAbono.fecha,
            fechaISO: new Date().toISOString(),
            estado: 'PENDIENTE_VERIFICACION',
            tipoRegistro: 'ABONO_EFECTIVO',
            origen: 'Abono en Efectivo'
        }).catch(err => console.warn('[Abonos] Error al registrar abono en PagosPorVerificar:', err));
    }

    document.getElementById('abono-monto').value = '';
    cerrarModalAbono();
    verDetalleCliente(clienteSeleccionadoId);
    renderizarClientes();
    if (window.InventoryApp && window.InventoryApp.Modal && typeof window.InventoryApp.Modal.toast === 'function') {
        window.InventoryApp.Modal.toast(`Abono de $${montoUSD.toFixed(2)} registrado correctamente.`, 'success');
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
 * Actualiza los badges de abonos y pagos pendientes por aprobar
 */
function actualizarBadgesAbonos() {
    const listaAbonos = Array.isArray(AppState.abonos) ? AppState.abonos : [];
    const abonosPend = listaAbonos.filter(a => a.estado === 'PENDIENTE_CONFIRMACION').length;
    const listaPagosVerif = Array.isArray(AppState.pagosPorVerificar) ? AppState.pagosPorVerificar : [];
    const pagosVerifPend = listaPagosVerif.filter(p => !p.estado || p.estado === 'PENDIENTE_VERIFICACION' || p.estado === 'PENDIENTE_CONFIRMACION' || p.estado === 'PENDIENTE' || p.estado === 'POR_VERIFICAR').length;
    const pendientes = abonosPend + pagosVerifPend;

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

    renderizarAbonosPendientesReportados();
    if (window.InventoryApp?.Modal?.toast) {
        window.InventoryApp.Modal.toast(`✅ Pago #${id} verificado y aprobado con éxito en Firebase.`, 'success');
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
 * Renderiza la sección de pagos reportados pendientes en el Panel de Transacciones y Clientes Admin
 */
function renderizarAbonosPendientesReportados() {
    actualizarBadgesAbonos();

    const containers = [
        document.getElementById('abonos-pendientes-admin-container'),
        document.getElementById('abonos-pendientes-clientes-container')
    ].filter(Boolean);

    if (containers.length === 0) return;

    const abonosPendientes = (AppState.abonos || []).filter(a => a.estado === 'PENDIENTE_CONFIRMACION');
    const pagosVerificarPendientes = (AppState.pagosPorVerificar || []).filter(p => !p.estado || p.estado === 'PENDIENTE_VERIFICACION' || p.estado === 'PENDIENTE_CONFIRMACION' || p.estado === 'PENDIENTE' || p.estado === 'POR_VERIFICAR');

    if (abonosPendientes.length === 0 && pagosVerificarPendientes.length === 0) {
        containers.forEach(c => {
            c.innerHTML = `
                <div style="background:#f8fafc; border:1px dashed var(--border); border-radius:10px; padding:14px; text-align:center; color:var(--text-muted); font-size:0.88rem;">
                    <i class="fas fa-check-double" style="color:#16a34a; margin-right:6px;"></i> Todos los reportes de ventas y pagos se encuentran al día. Sin pagos pendientes por verificar en Firebase.
                </div>
            `;
        });
        return;
    }

    let htmlContent = '';

    // 1. Módulo Pagos y Ventas por Verificar (PagosPorVerificar de Firebase)
    if (pagosVerificarPendientes.length > 0) {
        htmlContent += `
            <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:12px; padding:16px; margin-bottom:18px; box-shadow:0 2px 8px rgba(220,38,38,0.08);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
                    <h4 style="margin:0; font-size:1rem; color:#991b1b; display:flex; align-items:center; gap:8px;">
                        <span style="display:inline-flex; width:26px; height:26px; border-radius:50%; background:#dc2626; color:#ffffff; align-items:center; justify-content:center; font-size:0.8rem; font-weight:800;">${pagosVerificarPendientes.length}</span>
                        <i class="fas fa-file-invoice-dollar" style="color:#dc2626;"></i> Ventas y Pagos por Verificar (Firebase: PagosPorVerificar)
                    </h4>
                    <small style="color:#991b1b; font-weight:600;">Revisa comprobante de Pago Móvil o Efectivo y aprueba la transacción</small>
                </div>
                <div class="table-responsive">
                    <table style="width:100%; font-size:0.85rem; border-collapse:collapse;">
                        <thead>
                            <tr style="background:#fee2e2; border-bottom:1px solid #fecaca;">
                                <th style="padding:8px; text-align:left;">Fecha</th>
                                <th style="padding:8px; text-align:left;">Venta / ID</th>
                                <th style="padding:8px; text-align:left;">Cliente</th>
                                <th style="padding:8px; text-align:left;">Método / Ref</th>
                                <th style="padding:8px; text-align:left;">Detalle</th>
                                <th style="padding:8px; text-align:right;">Total ($)</th>
                                <th style="padding:8px; text-align:right;">Total (Bs)</th>
                                <th style="padding:8px; text-align:center;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pagosVerificarPendientes.map(p => {
                                const itemsTexto = Array.isArray(p.items) 
                                    ? p.items.map(it => `${it.cantidad}x ${it.nombre || it.productoId}`).join(', ') 
                                    : (p.nota || p.origen || 'Venta general');
                                const totalUSD = Number(p.totalUSD || p.montoUSD || p.total || 0);
                                const totalVES = Number(p.totalVES || p.montoVES || 0);
                                return `
                                <tr style="border-bottom:1px solid #fee2e2; background:rgba(255,255,255,0.7);">
                                    <td style="padding:8px; white-space:nowrap;">${p.fecha || ''}</td>
                                    <td style="padding:8px;"><code>#${p.id}</code></td>
                                    <td style="padding:8px;">
                                        <strong>${p.clienteNombre || p.clienteId || 'Cliente'}</strong>
                                        <br><small style="color:var(--text-muted);">${p.clienteCedula || p.clienteId || ''} ${p.clienteTelefono ? '• ' + p.clienteTelefono : ''}</small>
                                    </td>
                                    <td style="padding:8px;">
                                        <strong style="color:#b91c1c;">${p.metodoPago || p.tipoPago || p.tipo || 'Pago'}</strong>
                                        <br><code>Ref: ${p.referencia || 'N/A'}</code>
                                    </td>
                                    <td style="padding:8px; max-width:220px; font-size:0.8rem; color:#475569;" title="${itemsTexto}">
                                        <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${itemsTexto}</div>
                                    </td>
                                    <td style="padding:8px; text-align:right; font-weight:700; color:var(--primary-accent);">$${totalUSD.toFixed(2)}</td>
                                    <td style="padding:8px; text-align:right; font-weight:600; color:#16a34a;">Bs. ${totalVES.toFixed(2)}</td>
                                    <td style="padding:8px; text-align:center; white-space:nowrap;">
                                        <button type="button" class="btn btn-sm btn-success" onclick="aprobarPagoPorVerificarAdmin('${p.id}')" style="padding:6px 12px; margin-right:4px; font-weight:700;">
                                            <i class="fas fa-check"></i> Aprobar
                                        </button>
                                        <button type="button" class="btn btn-sm btn-danger" onclick="rechazarPagoPorVerificarAdmin('${p.id}')" style="padding:6px 12px; font-weight:700;">
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
    }

    // 2. Módulo Abonos de Clientes Pendientes por Conciliar
    if (abonosPendientes.length > 0) {
        htmlContent += `
        <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:12px; padding:16px; margin-bottom:18px; box-shadow:0 2px 8px rgba(217,119,6,0.08);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
                <h4 style="margin:0; font-size:1rem; color:#92400e; display:flex; align-items:center; gap:8px;">
                    <span style="display:inline-flex; width:26px; height:26px; border-radius:50%; background:#d97706; color:#ffffff; align-items:center; justify-content:center; font-size:0.8rem; font-weight:800;">${abonosPendientes.length}</span>
                    <i class="fas fa-bell" style="color:#d97706;"></i> Abonos de Clientes Pendientes por Conciliar
                </h4>
                <small style="color:#92400e; font-weight:600;">Verifica los datos bancarios y aprueba para liberar saldo y puntos</small>
            </div>
            <div class="table-responsive">
                <table style="width:100%; font-size:0.85rem; border-collapse:collapse;">
                    <thead>
                        <tr style="background:#fef3c7; border-bottom:1px solid #fde68a;">
                            <th style="padding:8px; text-align:left;">Fecha</th>
                            <th style="padding:8px; text-align:left;">Cliente</th>
                            <th style="padding:8px; text-align:left;">Método / Ref</th>
                            <th style="padding:8px; text-align:right;">Monto ($)</th>
                            <th style="padding:8px; text-align:right;">Monto (Bs)</th>
                            <th style="padding:8px; text-align:center;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${abonosPendientes.map(a => `
                            <tr style="border-bottom:1px solid #fef3c7; background:rgba(255,255,255,0.6);">
                                <td style="padding:8px; white-space:nowrap;">${a.fecha}</td>
                                <td style="padding:8px;"><strong>${a.clienteNombre || a.clienteId}</strong><br><small style="color:var(--text-muted);">${a.clienteId}</small></td>
                                <td style="padding:8px;">
                                    <strong>${a.formaPago || a.metodo}</strong><br>
                                    <code>Ref: ${a.referencia || 'Sin Ref'}</code>
                                    ${a.nota ? `<br><small style="color:#64748b; font-style:italic;">Nota: ${a.nota}</small>` : ''}
                                </td>
                                <td style="padding:8px; text-align:right; font-weight:700; color:var(--primary-accent);">$${Number(a.montoUSD || 0).toFixed(2)}</td>
                                <td style="padding:8px; text-align:right; font-weight:600; color:#16a34a;">Bs. ${Number(a.montoVES || 0).toFixed(2)}</td>
                                <td style="padding:8px; text-align:center; white-space:nowrap;">
                                    <button type="button" class="btn btn-sm btn-success" onclick="aprobarAbonoReportadoAdmin('${a.id}')" style="padding:6px 12px; margin-right:4px; font-weight:700;">
                                        <i class="fas fa-check"></i> Aprobar
                                    </button>
                                    <button type="button" class="btn btn-sm btn-danger" onclick="rechazarAbonoReportadoAdmin('${a.id}')" style="padding:6px 12px; font-weight:700;">
                                        <i class="fas fa-times"></i> Rechazar
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        `;
    }

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
window.procesarVerificacionTransaccion = procesarVerificacionTransaccion;
window.guardarAbono = guardarAbono;
window.abrirModalAbono = abrirModalAbono;
window.cerrarModalAbono = cerrarModalAbono;
window.actualizarMonedaAbono = actualizarMonedaAbono;
window.calcularEquivalenteAbono = calcularEquivalenteAbono;


