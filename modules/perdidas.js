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

// Determina si una venta o transacción se encuentra debidamente confirmada.
// Solo las ventas confirmadas pueden transferir sus ganancias a la recuperación de pérdidas.
function esVentaOTransaccionConfirmada(venta) {
    if (!venta) return false;

    // 1. Verificación de flags explícitos
    if (venta.confirmada === true) return true;
    if (venta.pendiente === true || venta.confirmada === false) return false;

    // 2. Verificación de estado de la venta
    const estado = String(venta.estado || '').trim().toUpperCase();
    const estadosNoConfirmados = [
        'PENDIENTE',
        'PENDIENTE_CONFIRMACION',
        'PENDIENTE_VERIFICACION',
        'POR_VERIFICAR',
        'CONFIRMANDO',
        'FALLIDO',
        'RECHAZADO',
        'CANCELADO'
    ];
    if (estadosNoConfirmados.includes(estado)) {
        return false;
    }

    // 3. Si la venta tiene una referencia o transacción bancaria vinculada en AppState.transacciones
    const ref = String(venta.referencia || '').trim();
    const txList = Array.isArray(window.AppState?.transacciones) 
        ? window.AppState.transacciones 
        : (typeof transacciones !== 'undefined' && Array.isArray(transacciones) ? transacciones : []);

    const txAsociada = txList.find(t =>
        (t.id && (t.id === venta.id || t.pedidoId === venta.id)) ||
        (t.pedidoId && t.pedidoId === venta.id) ||
        (ref && ref !== 'N/A' && ref !== 'CRÉDITO-REGISTRADO' && String(t.referencia || '').trim() === ref)
    );
    if (txAsociada) {
        const estadoTx = String(txAsociada.estado || '').trim().toLowerCase();
        if (estadoTx === 'confirmando' || estadoTx === 'fallido' || estadoTx.includes('pendiente')) {
            return false;
        }
    }

    // 4. Si existe en la lista de PagosPorVerificar de Firestore/AppState
    const pagosVerif = Array.isArray(window.AppState?.pagosPorVerificar) ? window.AppState.pagosPorVerificar : [];
    const pago = pagosVerif.find(p =>
        p.id === venta.id || p.ventaId === venta.id || p.pedidoId === venta.id ||
        (ref && ref !== 'N/A' && String(p.referencia || '').trim() === ref)
    );
    if (pago) {
        const pEst = String(pago.estado || '').trim().toUpperCase();
        if (pEst !== 'APROBADO' && pEst !== 'CONFIRMADO' && pEst !== 'PAGO AGREGADO') {
            return false;
        }
    }

    // Por defecto, si el estado no está pendiente
    return true;
}
window.esVentaOTransaccionConfirmada = esVentaOTransaccionConfirmada;

// --- PERSISTENCIA Y MANEJO DE CICLOS DE RECUPERACIÓN CONTABLE ---
function guardarCiclosRecuperacion() {
    try {
        const payload = {
            ciclosRecuperacion: window.AppState?.ciclosRecuperacion || [],
            cicloRecuperacionActual: window.AppState?.cicloRecuperacionActual || { id: 'ciclo_actual', numero: 1, fechaInicio: null, estado: 'ACTIVO' }
        };
        localStorage.setItem('bodeguita_ciclos_recuperacion', JSON.stringify(payload));
        if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarConfiguracionGlobal === 'function') {
            window.InventoryApp.Firebase.guardarConfiguracionGlobal(payload);
        }
    } catch (e) {
        console.warn('[Auditoría] Error guardando ciclos de recuperación:', e);
    }
}

function cargarCiclosRecuperacion() {
    try {
        const raw = localStorage.getItem('bodeguita_ciclos_recuperacion');
        if (raw) {
            const data = JSON.parse(raw);
            if (data && Array.isArray(data.ciclosRecuperacion) && (!window.AppState?.ciclosRecuperacion || window.AppState.ciclosRecuperacion.length === 0)) {
                if (window.AppState) window.AppState.ciclosRecuperacion = data.ciclosRecuperacion;
            }
            if (data && data.cicloRecuperacionActual && (!window.AppState?.cicloRecuperacionActual || !window.AppState.cicloRecuperacionActual.fechaInicio)) {
                if (window.AppState) window.AppState.cicloRecuperacionActual = data.cicloRecuperacionActual;
            }
        }
    } catch (e) {
        console.warn('[Auditoría] Error cargando ciclos de recuperación:', e);
    }
}
cargarCiclosRecuperacion();

// Utilidad universal para interpretar timestamps y cadenas de fechas
function parsearFechaAvanzada(fechaStr) {
    if (!fechaStr) return null;
    if (fechaStr instanceof Date) return isNaN(fechaStr.getTime()) ? null : fechaStr;
    if (typeof fechaStr === 'number') {
        const d = new Date(fechaStr);
        return isNaN(d.getTime()) ? null : d;
    }
    const str = String(fechaStr).trim();
    if (!str) return null;

    // Formato ISO estándar o con espacio (YYYY-MM-DD HH:mm:ss)
    const norm = str.replace(' ', 'T');
    let d = new Date(norm);
    if (!isNaN(d.getTime())) return d;

    // Formato común español: DD/MM/YYYY o DD-MM-YYYY
    const partes = str.split(/[\/\-\s:]/);
    if (partes.length >= 3) {
        const p1 = parseInt(partes[0], 10);
        const p2 = parseInt(partes[1], 10);
        const p3 = parseInt(partes[2], 10);
        if (p3 > 1000) { // DD/MM/YYYY
            d = new Date(p3, p2 - 1, p1);
            if (!isNaN(d.getTime())) return d;
        } else if (p1 > 1000) { // YYYY/MM/DD
            d = new Date(p1, p2 - 1, p3);
            if (!isNaN(d.getTime())) return d;
        }
    }
    return null;
}

// Determina los límites de fecha (desde, hasta) según el filtro activo y el ciclo contable
function obtenerLimitesFiltroFecha(filtro, customDesde, customHasta, fechaInicioCiclo, fechaFinCiclo) {
    const ahora = new Date();
    let desde = null;
    let hasta = null;

    if (filtro === 'hoy') {
        desde = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 0, 0, 0);
        hasta = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59, 999);
    } else if (filtro === 'semana') {
        const diaSem = ahora.getDay(); // 0 domingo, 1 lunes...
        const distLunes = (diaSem + 6) % 7; // días hacia atrás hasta el lunes
        desde = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - distLunes, 0, 0, 0, 0);
        hasta = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59, 999);
    } else if (filtro === 'mes') {
        desde = new Date(ahora.getFullYear(), ahora.getMonth(), 1, 0, 0, 0, 0);
        hasta = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (filtro === 'ultimos30') {
        desde = new Date(ahora.getTime() - (30 * 24 * 60 * 60 * 1000));
        hasta = ahora;
    } else if (filtro === 'personalizado' && customDesde) {
        desde = new Date(customDesde + 'T00:00:00');
        hasta = customHasta ? new Date(customHasta + 'T23:59:59') : ahora;
    }

    // Acotar según el inicio del ciclo contable si existe
    if (fechaInicioCiclo) {
        const cicloIni = parsearFechaAvanzada(fechaInicioCiclo);
        if (cicloIni) {
            if (!desde || desde < cicloIni) {
                desde = cicloIni;
            }
        }
    }

    // Acotar según el fin del ciclo (para ciclos archivados/cerrados)
    if (fechaFinCiclo) {
        const cicloFin = parsearFechaAvanzada(fechaFinCiclo);
        if (cicloFin) {
            if (!hasta || hasta > cicloFin) {
                hasta = cicloFin;
            }
        }
    }

    return { desde, hasta };
}

function estaEnRangoDeFechas(fechaItem, desde, hasta) {
    if (!desde && !hasta) return true;
    const d = parsearFechaAvanzada(fechaItem);
    if (!d) return true; // Si no tiene fecha, incluir por defecto para no perder registros
    if (desde && d < desde) return false;
    if (hasta && d > hasta) return false;
    return true;
}

function calcularGananciaGeneradaVentas(limiteDesde = null, limiteHasta = null) {
    const listadoVentas = Array.isArray(window.AppState?.ventas)
        ? window.AppState.ventas
        : (typeof ventas !== 'undefined' && Array.isArray(ventas) ? ventas : []);

    return listadoVentas.reduce((total, venta) => {
        // Solo acumula ganancias si la transacción ha sido confirmada
        if (!esVentaOTransaccionConfirmada(venta)) {
            return total;
        }

        // Filtro de fecha
        if (!estaEnRangoDeFechas(venta.fecha || venta.fechaISO, limiteDesde, limiteHasta)) {
            return total;
        }

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
    const state = window.AppState || {};
    const cicloSelId = state.cicloSeleccionadoRecuperacion || 'actual';
    const filtroFecha = state.filtroFechaRecuperacion || 'todos';
    const customRange = state.rangoFechaPersonalizadoRecuperacion || { desde: '', hasta: '' };

    let fechaInicioCiclo = null;
    let fechaFinCiclo = null;
    let cicloInfo = { id: 'actual', numero: 1, estado: 'ACTIVO', label: 'Ciclo Actual (En Curso)' };

    if (cicloSelId === 'actual') {
        const cicloAct = state.cicloRecuperacionActual || {};
        fechaInicioCiclo = cicloAct.fechaInicio || null;
        cicloInfo = {
            id: 'actual',
            numero: cicloAct.numero || 1,
            fechaInicio: fechaInicioCiclo,
            estado: 'ACTIVO',
            label: `Ciclo #${cicloAct.numero || 1} (En Curso)`
        };
    } else {
        const cicloHist = (state.ciclosRecuperacion || []).find(c => c.id === cicloSelId);
        if (cicloHist) {
            fechaInicioCiclo = cicloHist.fechaInicio || null;
            fechaFinCiclo = cicloHist.fechaFin || cicloHist.fechaCierre || null;
            cicloInfo = {
                id: cicloHist.id,
                numero: cicloHist.numero || 1,
                fechaInicio: fechaInicioCiclo,
                fechaFin: fechaFinCiclo,
                estado: 'CERRADO',
                label: `Ciclo #${cicloHist.numero || 1} (Cerrado - 100% Recuperado)`
            };
        }
    }

    const { desde, hasta } = obtenerLimitesFiltroFecha(filtroFecha, customRange.desde, customRange.hasta, fechaInicioCiclo, fechaFinCiclo);

    const listElim = Array.isArray(state.eliminaciones) ? state.eliminaciones : (typeof eliminaciones !== 'undefined' ? eliminaciones : []);
    const listCliElim = Array.isArray(state.clientesEliminados) ? state.clientesEliminados : (typeof clientesEliminados !== 'undefined' ? clientesEliminados : []);
    const listAud = Array.isArray(state.auditorias) ? state.auditorias : (typeof auditorias !== 'undefined' ? auditorias : []);
    const listProd = Array.isArray(state.productos) ? state.productos : (typeof productos !== 'undefined' ? productos : []);
    const listVentas = Array.isArray(state.ventas) ? state.ventas : (typeof ventas !== 'undefined' ? ventas : []);

    const movimientos = [];

    // 1. Pérdidas por Productos Dañados / Vencidos / Retirados
    let perdidaProductos = 0;
    listElim.forEach(e => {
        if (estaEnRangoDeFechas(e.fecha, desde, hasta)) {
            const monto = Number.isFinite(Number(e.perdidaUSD))
                ? Math.max(0, Number(e.perdidaUSD))
                : (typeof calcularPerdidaBajaProducto === 'function'
                    ? calcularPerdidaBajaProducto(e.motivo, e.cantidadRetirada, e.costo)
                    : (Number(e.cantidadRetirada || 0) * Number(e.costo || 0)));
            perdidaProductos += monto;
            movimientos.push({
                id: e.id || `elim_${Math.random()}`,
                fecha: e.fecha || new Date().toISOString(),
                tipo: 'merma',
                tipoLabel: 'Merma / Dañado',
                concepto: `${e.nombre || e.codigo || 'Producto dado de baja'} (${e.motivo || 'Dañado/Vencido'})`,
                detalle: `${Number(e.cantidadRetirada || 1)} un. retiradas del stock`,
                perdidaUSD: monto,
                gananciaUSD: 0,
                impacto: -monto
            });
        }
    });

    // 2. Deudas de Clientes Eliminados
    let deudaClientesEliminados = 0;
    listCliElim.forEach(c => {
        if (estaEnRangoDeFechas(c.fecha || c.fechaEliminacion, desde, hasta)) {
            const monto = Math.max(0, Number(c.perdidaUSD ?? c.deudaUSD ?? 0));
            deudaClientesEliminados += monto;
            movimientos.push({
                id: c.id || `cli_elim_${Math.random()}`,
                fecha: c.fecha || c.fechaEliminacion || new Date().toISOString(),
                tipo: 'cliente',
                tipoLabel: 'Cliente Incobrable',
                concepto: `Deuda incobrable: ${c.nombre || 'Cliente eliminado'}`,
                detalle: `Cédula/RIF: ${c.cedula || 'N/A'} - Saldo declarado incobrable`,
                perdidaUSD: monto,
                gananciaUSD: 0,
                impacto: -monto
            });
        }
    });

    // 3. Faltantes y Ajustes en Conteo Físico (Auditorías Aplicadas)
    let perdidaFaltantes = 0;
    listAud.forEach(a => {
        if (estaEnRangoDeFechas(a.fecha, desde, hasta)) {
            const dif = Number(a.diferencia) || 0;
            const productoActual = listProd.find(p => p.id === a.productoId);
            const costo = Number(a.costo ?? (productoActual ? productoActual.costo : 0)) || 0;
            const cod = a.codigo || (productoActual ? productoActual.codigo : '');
            const nom = a.nombre || (productoActual ? productoActual.nombre : 'Producto auditado');

            if (dif < 0) { // Faltante de stock
                const monto = Math.abs(dif) * costo;
                perdidaFaltantes += monto;
                movimientos.push({
                    id: a.id || `aud_${Math.random()}`,
                    fecha: a.fecha || new Date().toISOString(),
                    tipo: 'faltante',
                    tipoLabel: 'Faltante en Conteo',
                    concepto: `${cod ? `[${cod}] ` : ''}${nom}`,
                    detalle: `Stock Digital: ${a.stockAnterior || 0} → Físico: ${a.stockFisico || 0} (Faltante: ${dif} un.) · Costo: $${costo.toFixed(2)}/u`,
                    perdidaUSD: monto,
                    gananciaUSD: 0,
                    impacto: -monto
                });
            } else if (dif > 0) { // Sobrante de stock
                const monto = dif * costo;
                movimientos.push({
                    id: a.id || `aud_${Math.random()}`,
                    fecha: a.fecha || new Date().toISOString(),
                    tipo: 'faltante',
                    tipoLabel: 'Sobrante en Conteo',
                    concepto: `${cod ? `[${cod}] ` : ''}${nom}`,
                    detalle: `Stock Digital: ${a.stockAnterior || 0} → Físico: ${a.stockFisico || 0} (Sobrante: +${dif} un.) · Costo: $${costo.toFixed(2)}/u`,
                    perdidaUSD: 0,
                    gananciaUSD: monto,
                    impacto: monto
                });
            }
        }
    });

    // Faltantes de conteos físicos actualmente en captura (solo si estamos viendo ciclo actual y el filtro incluye la fecha de hoy)
    if (cicloSelId === 'actual') {
        const ahoraHoy = new Date();
        const incluyeHoy = (!hasta || hasta >= new Date(ahoraHoy.getFullYear(), ahoraHoy.getMonth(), ahoraHoy.getDate(), 0, 0, 0));
        if (incluyeHoy) {
            const conteos = (typeof conteosFisicos !== 'undefined' && conteosFisicos) ? conteosFisicos : (state.conteosFisicos || {});
            Object.keys(conteos).forEach(id => {
                const p = listProd.find(prod => prod.id === id);
                if (!p) return;
                const dif = typeof calcularDiferenciaAuditoria === 'function' ? calcularDiferenciaAuditoria(id) : null;
                if (dif !== null && dif < 0) {
                    const monto = Math.abs(dif) * Number(p.costo || 0);
                    perdidaFaltantes += monto;
                    movimientos.push({
                        id: `conteo_activo_${p.id}`,
                        fecha: new Date().toISOString().replace('T', ' ').substring(0, 16),
                        tipo: 'faltante',
                        tipoLabel: 'Faltante en Conteo (Activo)',
                        concepto: `${p.codigo ? `[${p.codigo}] ` : ''}${p.nombre}`,
                        detalle: `Diferencia de ${dif} un. antes de aplicar ajuste contable`,
                        perdidaUSD: monto,
                        gananciaUSD: 0,
                        impacto: -monto
                    });
                }
            });
        }
    }

    // 4. Ganancia Generada por Ventas Confirmadas (Amortización)
    let gananciaGenerada = 0;
    listVentas.forEach(v => {
        if (esVentaOTransaccionConfirmada(v) && estaEnRangoDeFechas(v.fecha || v.fechaISO, desde, hasta)) {
            const gananciaVenta = (v.items || []).reduce((sum, item) => {
                const costo = obtenerCostoHistoricoProducto(item.productoId, item);
                const precio = Number(item.precio || 0);
                const cantidad = Number(item.cantidad || 0);
                return sum + ((precio - costo) * cantidad);
            }, 0);

            if (gananciaVenta > 0) {
                gananciaGenerada += gananciaVenta;
                movimientos.push({
                    id: v.id || `venta_${Math.random()}`,
                    fecha: v.fecha || v.fechaISO || new Date().toISOString(),
                    tipo: 'venta',
                    tipoLabel: 'Ganancia Venta',
                    concepto: `Venta #${(v.id || '').substring(0, 8)} - ${v.clienteNombre || 'Cliente mostrador'}`,
                    detalle: `Total venta: $${Number(v.totalUSD || 0).toFixed(2)} | Margen neto aplicado a recuperación`,
                    perdidaUSD: 0,
                    gananciaUSD: gananciaVenta,
                    impacto: gananciaVenta
                });
            }
        }
    });

    // Ordenar movimientos cronológicamente
    movimientos.sort((a, b) => {
        const da = parsearFechaAvanzada(a.fecha) || new Date(0);
        const db = parsearFechaAvanzada(b.fecha) || new Date(0);
        return da - db;
    });

    // Calcular saldos acumulados progresivos
    let saldoAcumulado = 0;
    movimientos.forEach(m => {
        saldoAcumulado += m.impacto;
        m.saldoResultante = saldoAcumulado;
    });

    const perdidaBruta = perdidaProductos + deudaClientesEliminados + perdidaFaltantes;
    const perdidaPendiente = Math.max(0, perdidaBruta - gananciaGenerada);
    const excedente = Math.max(0, gananciaGenerada - perdidaBruta);

    let ratioRecuperacion = 0;
    if (perdidaBruta > 0) {
        ratioRecuperacion = Math.min(100, Math.max(0, Math.round((gananciaGenerada / perdidaBruta) * 100)));
    } else if (gananciaGenerada > 0 || (perdidaProductos === 0 && deudaClientesEliminados === 0 && perdidaFaltantes === 0)) {
        ratioRecuperacion = 100;
    } else {
        ratioRecuperacion = 0;
    }

    // Texto descriptivo del rango para el badge
    let rangoTexto = 'Historial Completo';
    if (filtroFecha === 'hoy') rangoTexto = 'Hoy';
    else if (filtroFecha === 'semana') rangoTexto = 'Esta Semana';
    else if (filtroFecha === 'mes') rangoTexto = 'Este Mes';
    else if (filtroFecha === 'ultimos30') rangoTexto = 'Últimos 30 días';
    else if (filtroFecha === 'personalizado') {
        rangoTexto = customRange.desde && customRange.hasta 
            ? `${customRange.desde} al ${customRange.hasta}` 
            : 'Personalizado';
    }

    return {
        perdidaProductos,
        deudaClientesEliminados,
        perdidaFaltantes,
        perdidaBruta,
        gananciaGenerada,
        perdidaPendiente,
        ratioRecuperacion,
        excedente,
        movimientos,
        filtroFecha,
        rangoTexto,
        cicloInfo,
        limiteDesde: desde,
        limiteHasta: hasta
    };
}

function renderizarResumenPerdidasEconomicas() {
    const r = calcularResumenPerdidasEconomicas();
    const set = (id, value, isPositive = false) => {
        const el = document.getElementById(id);
        if (!el) return;
        const num = Number(value) || 0;
        const absVal = Math.abs(num);
        const parts = absVal.toFixed(2).split('.');
        const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        const decPart = parts[1];
        el.innerHTML = `
            <span class="audit-currency-symbol">${num < 0 ? '-$' : '$'}</span>
            <span>${intPart}</span>
            <span class="audit-currency-cents">.${decPart}</span>
        `;
    };

    set('perdidas-productos-usd', r.perdidaProductos);
    set('perdidas-clientes-usd', r.deudaClientesEliminados);
    set('perdidas-faltantes-usd', r.perdidaFaltantes);
    set('ganancia-generada-usd', r.gananciaGenerada, true);
    set('perdida-pendiente-global-usd', r.perdidaPendiente);

    // Barra de Progreso y Tasa de Recuperación
    const fillEl = document.getElementById('audit-recovery-progress-fill');
    if (fillEl) {
        fillEl.style.width = `${r.ratioRecuperacion}%`;
        fillEl.setAttribute('aria-valuenow', r.ratioRecuperacion);
    }

    const pctEl = document.getElementById('audit-recovery-percentage');
    if (pctEl) {
        if (r.perdidaBruta === 0 && r.gananciaGenerada === 0) {
            pctEl.textContent = '100% (Sin Pérdidas)';
        } else {
            pctEl.textContent = `${r.ratioRecuperacion}% Recuperado`;
        }
    }

    const legendGanEl = document.getElementById('audit-legend-ganancias');
    if (legendGanEl) {
        legendGanEl.textContent = `Compensado con Ganancias ($${r.gananciaGenerada.toFixed(2)})`;
    }

    const legendPendEl = document.getElementById('audit-legend-pendientes');
    if (legendPendEl) {
        legendPendEl.textContent = `Por Recuperar ($${r.perdidaPendiente.toFixed(2)})`;
    }

    // Badge de Estado Financiero
    const statusBadge = document.getElementById('audit-financial-status-badge');
    if (statusBadge) {
        if (r.perdidaBruta === 0) {
            statusBadge.className = 'audit-financial-status-badge healthy';
            statusBadge.innerHTML = '<i class="fas fa-circle-check"></i> <span>Sin Pérdidas Registradas</span>';
        } else if (r.perdidaPendiente <= 0) {
            statusBadge.className = 'audit-financial-status-badge healthy';
            statusBadge.innerHTML = '<i class="fas fa-circle-check"></i> <span>100% Recuperado / Sin Deuda</span>';
        } else {
            statusBadge.className = 'audit-financial-status-badge critical';
            statusBadge.innerHTML = `<i class="fas fa-triangle-exclamation"></i> <span>Balance Pendiente ($${r.perdidaPendiente.toFixed(2)})</span>`;
        }
    }

    // Botón de Reinicio de Ciclo (se habilita al 100% de recuperación)
    const btnReset = document.getElementById('btn-reiniciar-ciclo-recuperacion');
    if (btnReset) {
        const puedeReiniciar = (r.ratioRecuperacion >= 100 || r.perdidaPendiente <= 0);
        if (puedeReiniciar && r.cicloInfo.estado === 'ACTIVO') {
            btnReset.removeAttribute('disabled');
            btnReset.classList.remove('disabled');
            btnReset.innerHTML = '<i class="fas fa-rotate"></i> <span>Reiniciar Ciclo (100% Recuperado)</span>';
            btnReset.title = 'El balance está completamente recuperado. Haz clic para cerrar este ciclo y comenzar uno nuevo.';
        } else if (r.cicloInfo.estado === 'CERRADO') {
            btnReset.setAttribute('disabled', 'true');
            btnReset.classList.add('disabled');
            btnReset.innerHTML = '<i class="fas fa-lock"></i> <span>Ciclo Archivador Cerrado</span>';
            btnReset.title = 'Este ciclo ya fue cerrado y archivado en el historial.';
        } else {
            btnReset.setAttribute('disabled', 'true');
            btnReset.classList.add('disabled');
            btnReset.innerHTML = '<i class="fas fa-rotate"></i> <span>Reiniciar Ciclo (Requiere 100%)</span>';
            btnReset.title = `Aún faltan $${r.perdidaPendiente.toFixed(2)} por compensar con ventas para reiniciar el ciclo.`;
        }
    }

    // Actualizar Selector de Ciclos
    const selectCiclos = document.getElementById('audit-filtro-ciclo');
    if (selectCiclos) {
        const ciclosHist = window.AppState?.ciclosRecuperacion || [];
        const cicloAct = window.AppState?.cicloRecuperacionActual || { numero: 1 };
        const selVal = window.AppState?.cicloSeleccionadoRecuperacion || 'actual';

        let htmlOptions = `<option value="actual" ${selVal === 'actual' ? 'selected' : ''}>Ciclo #${cicloAct.numero || 1} (En curso - Activo)</option>`;
        ciclosHist.forEach(c => {
            const fechaTxt = (c.fechaFin || c.fechaCierre || '').substring(0, 10);
            htmlOptions += `<option value="${c.id}" ${selVal === c.id ? 'selected' : ''}>Ciclo #${c.numero || 1} (${fechaTxt} - 100% Recuperado)</option>`;
        });
        selectCiclos.innerHTML = htmlOptions;
    }

    // Actualizar Pills de Filtro de Fechas
    const pills = document.querySelectorAll('.audit-filter-pill');
    pills.forEach(p => {
        const filtro = p.getAttribute('data-filtro');
        if (filtro === r.filtroFecha) {
            p.classList.add('active');
        } else {
            p.classList.remove('active');
        }
    });

    const customDateBox = document.getElementById('audit-custom-dates-box');
    if (customDateBox) {
        customDateBox.style.display = r.filtroFecha === 'personalizado' ? 'flex' : 'none';
    }

    const badgeRango = document.getElementById('audit-active-filter-badge');
    if (badgeRango) {
        badgeRango.innerHTML = `<i class="fas fa-calendar-check"></i> Mostrando: <strong>${r.rangoTexto}</strong> (${r.movimientos.length} eventos)`;
    }

    // Renderizar tabla del Historial de Movimientos de este ciclo y filtro
    renderizarTablaMovimientosRecuperacion(r);
}

// Renderiza la tabla de desglose e historial financiero
function renderizarTablaMovimientosRecuperacion(resumen = null) {
    const tbody = document.getElementById('audit-movements-tbody');
    if (!tbody) return;

    const r = resumen || calcularResumenPerdidasEconomicas();
    const tipoFiltro = window.AppState?.filtroTipoHistorialRecuperacion || 'todos';

    // Actualizar tabs de tipo de movimiento
    const tabs = document.querySelectorAll('.audit-mov-tab');
    tabs.forEach(t => {
        const tf = t.getAttribute('data-tipo');
        if (tf === tipoFiltro) t.classList.add('active');
        else t.classList.remove('active');
    });

    let lista = r.movimientos;
    if (tipoFiltro !== 'todos') {
        lista = lista.filter(m => m.tipo === tipoFiltro);
    }

    if (lista.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding: 2rem 1rem; color: var(--audit-slate-400);">
                    <i class="fas fa-inbox" style="font-size:1.6rem; display:block; margin-bottom:0.5rem; opacity:0.5;"></i>
                    No se registraron movimientos contables en el rango seleccionado (${r.rangoTexto}).
                </td>
            </tr>
        `;
        return;
    }

    // Renderizar de más reciente a más antiguo
    const ordenada = [...lista].reverse();
    tbody.innerHTML = ordenada.map(m => {
        let badgeClass = 'merma';
        let icono = 'fa-dumpster';
        if (m.tipo === 'cliente') { badgeClass = 'cliente'; icono = 'fa-user-xmark'; }
        else if (m.tipo === 'faltante') {
            if (m.tipoLabel && m.tipoLabel.includes('Sobrante')) {
                badgeClass = 'sobrante';
                icono = 'fa-arrow-trend-up';
            } else {
                badgeClass = 'faltante';
                icono = 'fa-clipboard-question';
            }
        }
        else if (m.tipo === 'venta') { badgeClass = 'venta'; icono = 'fa-cash-register'; }

        const strFecha = m.fecha ? String(m.fecha).replace('T', ' ').substring(0, 16) : 'N/A';

        return `
            <tr>
                <td style="white-space:nowrap; font-size:0.78rem; font-family:var(--audit-font-mono); color:var(--audit-slate-500);">
                    ${strFecha}
                </td>
                <td>
                    <span class="audit-badge-tipo ${badgeClass}">
                        <i class="fas ${icono}"></i> ${m.tipoLabel}
                    </span>
                </td>
                <td>
                    <strong style="color:var(--audit-slate-800); display:block;">${m.concepto}</strong>
                    <small style="color:var(--audit-slate-500); font-size:0.75rem;">${m.detalle || ''}</small>
                </td>
                <td style="text-align:right;">
                    ${m.perdidaUSD > 0 ? `<span class="audit-monto-negativo">-$${m.perdidaUSD.toFixed(2)}</span>` : '<span style="color:var(--audit-slate-400);">-</span>'}
                </td>
                <td style="text-align:right;">
                    ${m.gananciaUSD > 0 ? `<span class="audit-monto-positivo">+$${m.gananciaUSD.toFixed(2)}</span>` : '<span style="color:var(--audit-slate-400);">-</span>'}
                </td>
                <td style="text-align:right; font-family:var(--audit-font-mono); font-weight:700; color:${m.saldoResultante >= 0 ? '#16a34a' : '#dc2626'};">
                    ${m.saldoResultante >= 0 ? '+$' : '-$'}${Math.abs(m.saldoResultante).toFixed(2)}
                </td>
            </tr>
        `;
    }).join('');
}

// Handlers de Interacción para Filtros
function establecerFiltroFechaRecuperacion(tipo) {
    if (!window.AppState) return;
    window.AppState.filtroFechaRecuperacion = tipo;
    renderizarResumenPerdidasEconomicas();
}
window.establecerFiltroFechaRecuperacion = establecerFiltroFechaRecuperacion;

function aplicarRangoPersonalizadoRecuperacion() {
    if (!window.AppState) return;
    const desdeInput = document.getElementById('audit-fecha-desde');
    const hastaInput = document.getElementById('audit-fecha-hasta');
    window.AppState.filtroFechaRecuperacion = 'personalizado';
    window.AppState.rangoFechaPersonalizadoRecuperacion = {
        desde: desdeInput ? desdeInput.value : '',
        hasta: hastaInput ? hastaInput.value : ''
    };
    renderizarResumenPerdidasEconomicas();
}
window.aplicarRangoPersonalizadoRecuperacion = aplicarRangoPersonalizadoRecuperacion;

function cambiarCicloRecuperacion(cicloId) {
    if (!window.AppState) return;
    window.AppState.cicloSeleccionadoRecuperacion = cicloId;
    renderizarResumenPerdidasEconomicas();
}
window.cambiarCicloRecuperacion = cambiarCicloRecuperacion;

function cambiarTabMovimientosRecuperacion(tipo) {
    if (!window.AppState) return;
    window.AppState.filtroTipoHistorialRecuperacion = tipo;
    renderizarTablaMovimientosRecuperacion();
}
window.cambiarTabMovimientosRecuperacion = cambiarTabMovimientosRecuperacion;

// --- SOLICITUD Y CIERRE / REINICIO DE CICLO (100% COMPLETADO) ---
function solicitarReinicioCicloRecuperacion() {
    const r = calcularResumenPerdidasEconomicas();
    if (r.ratioRecuperacion < 100 && r.perdidaPendiente > 0) {
        if (window.InventoryApp && typeof window.InventoryApp.showModal === 'function') {
            window.InventoryApp.showModal({
                title: 'Recuperación Incompleta',
                message: `La barra de recuperación aún no alcanza el 100%. Falta un saldo pendiente de $${r.perdidaPendiente.toFixed(2)} para compensar con ganancias de ventas antes de reiniciar el ciclo contable.`,
                type: 'warning'
            });
        } else {
            alert(`Aún faltan $${r.perdidaPendiente.toFixed(2)} por compensar para alcanzar el 100% recuperado.`);
        }
        return;
    }

    abrirModalInformeRecuperacion(null, true);
}
window.solicitarReinicioCicloRecuperacion = solicitarReinicioCicloRecuperacion;

// Abre el modal con el informe contable y diagrama visual interactivo
function abrirModalInformeRecuperacion(cicloData = null, modoCierre = false) {
    const r = cicloData || calcularResumenPerdidasEconomicas();
    const modal = document.getElementById('modal-informe-recuperacion');
    if (!modal) return;

    // Poblar KPIs
    const elPerdida = document.getElementById('audit-report-perdida-total');
    const elGanancia = document.getElementById('audit-report-ganancia-total');
    const elExcedente = document.getElementById('audit-report-excedente');
    const elTasa = document.getElementById('audit-report-tasa');

    if (elPerdida) elPerdida.textContent = `$${r.perdidaBruta.toFixed(2)}`;
    if (elGanancia) elGanancia.textContent = `$${r.gananciaGenerada.toFixed(2)}`;
    if (elExcedente) {
        elExcedente.textContent = `+$${r.excedente.toFixed(2)}`;
        elExcedente.className = 'val success';
    }
    if (elTasa) elTasa.textContent = `${r.ratioRecuperacion}%`;

    // Renderizar Diagrama Visual SVG en el contenedor
    renderizarDiagramaVisualRecuperacion(r);

    // Veredicto
    const verdictBox = document.getElementById('audit-report-verdict-box');
    if (verdictBox) {
        if (r.perdidaPendiente <= 0) {
            verdictBox.className = 'audit-verdict-box';
            verdictBox.innerHTML = `
                <i class="fas fa-circle-check" style="font-size:1.4rem; color:#10b981; margin-top:2px;"></i>
                <div>
                    <strong>Auditoría Contable 100% Saneada y Compensada</strong>
                    <p style="margin:4px 0 0 0;">
                        Todas las pérdidas originadas por productos dañados ($${r.perdidaProductos.toFixed(2)}), 
                        deudas incobrables ($${r.deudaClientesEliminados.toFixed(2)}) y faltantes de inventario ($${r.perdidaFaltantes.toFixed(2)}) 
                        fueron absorbidas satisfactoriamente con la ganancia neta de las ventas comerciales ($${r.gananciaGenerada.toFixed(2)}), 
                        generando un excedente neto operativo a favor del negocio de <strong>+$${r.excedente.toFixed(2)}</strong>.
                    </p>
                </div>
            `;
        } else {
            verdictBox.className = 'audit-verdict-box pending';
            verdictBox.innerHTML = `
                <i class="fas fa-clock" style="font-size:1.4rem; color:#ef4444; margin-top:2px;"></i>
                <div>
                    <strong>Balance en Proceso de Recuperación</strong>
                    <p style="margin:4px 0 0 0;">
                        Se han amortizado $${r.gananciaGenerada.toFixed(2)} del total de pérdidas ($${r.perdidaBruta.toFixed(2)}). 
                        Resta compensar un saldo de <strong>$${r.perdidaPendiente.toFixed(2)}</strong> con ventas futuras para alcanzar el 100%.
                    </p>
                </div>
            `;
        }
    }

    // Botón de Confirmar Cierre dentro del Modal
    const btnConfirmar = document.getElementById('audit-report-btn-confirmar-cierre');
    if (btnConfirmar) {
        if (r.cicloInfo.estado === 'ACTIVO' && (r.ratioRecuperacion >= 100 || r.perdidaPendiente <= 0)) {
            btnConfirmar.style.display = 'inline-flex';
        } else {
            btnConfirmar.style.display = 'none';
        }
    }

    modal.classList.add('active');
}
window.abrirModalInformeRecuperacion = abrirModalInformeRecuperacion;

function cerrarModalInformeRecuperacion() {
    const modal = document.getElementById('modal-informe-recuperacion');
    if (modal) modal.classList.remove('active');
}
window.cerrarModalInformeRecuperacion = cerrarModalInformeRecuperacion;

// Genera un diagrama gráfico SVG de alta resolución con comparación visual de barras y balance
function renderizarDiagramaVisualRecuperacion(r) {
    const wrap = document.getElementById('audit-report-diagram-svg-wrap');
    if (!wrap) return;

    const maxVal = Math.max(r.perdidaBruta, r.gananciaGenerada, 1);
    const pDañados = (r.perdidaProductos / maxVal) * 100;
    const pDeudas = (r.deudaClientesEliminados / maxVal) * 100;
    const pFaltantes = (r.perdidaFaltantes / maxVal) * 100;
    const pGanancia = (r.gananciaGenerada / maxVal) * 100;
    const pExcedente = (r.excedente / maxVal) * 100;

    wrap.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:1.1rem; width:100%;">
            <!-- Barra 1: Dañados y Vencidos -->
            <div>
                <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:0.25rem;">
                    <span style="font-weight:700; color:#ef4444;"><i class="fas fa-trash-can"></i> Mermas / Vencidos</span>
                    <span style="font-family:var(--audit-font-mono); font-weight:700; color:#ef4444;">$${r.perdidaProductos.toFixed(2)}</span>
                </div>
                <div style="height:12px; background:#f1f5f9; border-radius:999px; overflow:hidden;">
                    <div style="height:100%; width:${Math.max(1, pDañados)}%; background:#ef4444; border-radius:999px; transition:width 0.5s ease;"></div>
                </div>
            </div>

            <!-- Barra 2: Clientes Incobrables -->
            <div>
                <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:0.25rem;">
                    <span style="font-weight:700; color:#f59e0b;"><i class="fas fa-user-xmark"></i> Clientes Incobrables</span>
                    <span style="font-family:var(--audit-font-mono); font-weight:700; color:#f59e0b;">$${r.deudaClientesEliminados.toFixed(2)}</span>
                </div>
                <div style="height:12px; background:#f1f5f9; border-radius:999px; overflow:hidden;">
                    <div style="height:100%; width:${Math.max(1, pDeudas)}%; background:#f59e0b; border-radius:999px; transition:width 0.5s ease;"></div>
                </div>
            </div>

            <!-- Barra 3: Faltantes Físicos -->
            <div>
                <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:0.25rem;">
                    <span style="font-weight:700; color:#64748b;"><i class="fas fa-boxes-stacked"></i> Faltantes en Conteo Físico</span>
                    <span style="font-family:var(--audit-font-mono); font-weight:700; color:#64748b;">$${r.perdidaFaltantes.toFixed(2)}</span>
                </div>
                <div style="height:12px; background:#f1f5f9; border-radius:999px; overflow:hidden;">
                    <div style="height:100%; width:${Math.max(1, pFaltantes)}%; background:#64748b; border-radius:999px; transition:width 0.5s ease;"></div>
                </div>
            </div>

            <!-- Barra 4: Ganancia Neta Ventas (Compensación) -->
            <div>
                <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:0.25rem;">
                    <span style="font-weight:700; color:#10b981;"><i class="fas fa-sack-dollar"></i> Ganancia Neta Ventas (Compensación)</span>
                    <span style="font-family:var(--audit-font-mono); font-weight:700; color:#10b981;">$${r.gananciaGenerada.toFixed(2)}</span>
                </div>
                <div style="height:16px; background:#f1f5f9; border-radius:999px; overflow:hidden; border:1px solid #a7f3d0;">
                    <div style="height:100%; width:${Math.max(1, Math.min(100, pGanancia))}%; background:linear-gradient(90deg, #10b981, #059669); border-radius:999px; transition:width 0.5s ease;"></div>
                </div>
            </div>

            <!-- Resumen de Cobertura -->
            <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1px solid var(--audit-slate-200); border-radius:0.75rem; padding:0.75rem 1rem; margin-top:0.35rem;">
                <div style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; font-weight:700;">
                    <i class="fas fa-chart-pie" style="color:var(--audit-primary);"></i>
                    <span>Tasa de Amortización Efectiva:</span>
                </div>
                <div style="font-family:var(--audit-font-mono); font-size:1.1rem; font-weight:800; color:${r.ratioRecuperacion >= 100 ? '#10b981' : '#f59e0b'};">
                    ${r.ratioRecuperacion}% Recuperado
                </div>
            </div>
        </div>
    `;
}

// Confirma el reinicio del ciclo: archiva el ciclo actual y comienza uno nuevo
function confirmarReinicioCiclo() {
    const state = window.AppState || {};
    const r = calcularResumenPerdidasEconomicas();
    const ahoraStr = new Date().toISOString();

    const cicloCerrado = {
        id: `ciclo_${Date.now()}`,
        numero: state.cicloRecuperacionActual?.numero || (state.ciclosRecuperacion?.length || 0) + 1,
        fechaInicio: state.cicloRecuperacionActual?.fechaInicio || ahoraStr,
        fechaFin: ahoraStr,
        fechaCierre: ahoraStr,
        perdidaProductos: r.perdidaProductos,
        deudaClientesEliminados: r.deudaClientesEliminados,
        perdidaFaltantes: r.perdidaFaltantes,
        perdidaBruta: r.perdidaBruta,
        gananciaGenerada: r.gananciaGenerada,
        perdidaPendiente: 0,
        excedente: r.excedente,
        ratioRecuperacion: 100,
        estado: 'CERRADO',
        cerradoPor: state.usuarioActual?.nombre || state.usuarioActual?.id || 'SuperAdmin',
        totalMovimientos: r.movimientos.length
    };

    if (!Array.isArray(state.ciclosRecuperacion)) {
        state.ciclosRecuperacion = [];
    }
    state.ciclosRecuperacion.unshift(cicloCerrado);

    // Iniciar nuevo ciclo fresco
    const nuevoNumero = cicloCerrado.numero + 1;
    state.cicloRecuperacionActual = {
        id: `ciclo_${Date.now() + 1}`,
        numero: nuevoNumero,
        fechaInicio: ahoraStr,
        estado: 'ACTIVO'
    };
    state.cicloSeleccionadoRecuperacion = 'actual';
    state.filtroFechaRecuperacion = 'todos';

    // Persistir
    guardarCiclosRecuperacion();

    // Notificación sonora y visual
    if (typeof playChimeNotification === 'function') {
        try { playChimeNotification(); } catch (e) {}
    }

    cerrarModalInformeRecuperacion();

    if (window.InventoryApp && typeof window.InventoryApp.showToast === 'function') {
        window.InventoryApp.showToast(`¡Ciclo #${cicloCerrado.numero} completado y cerrado con éxito! La barra de recuperación se ha reiniciado para el Ciclo #${nuevoNumero}.`, 'success', 5000);
    } else {
        alert(`¡Ciclo #${cicloCerrado.numero} completado! La barra de recuperación se ha reiniciado con éxito.`);
    }

    renderizarResumenPerdidasEconomicas();
}
window.confirmarReinicioCiclo = confirmarReinicioCiclo;

// Exportación del informe en archivo CSV compatible al 100% con Microsoft Excel y Google Sheets
function descargarInformeRecuperacionExcel(cicloData = null) {
    const r = cicloData || calcularResumenPerdidasEconomicas();
    const ahora = new Date();
    const fechaEmision = ahora.toLocaleString('es-VE');
    const nombreCiclo = r.cicloInfo?.label || `Ciclo #${r.cicloInfo?.numero || 1}`;

    const sep = ';'; // Delimitador estándar europeo/latinoamericano para Excel
    let csv = '\uFEFF'; // UTF-8 BOM para soporte total de tildes y caracteres especiales en Excel

    csv += `INFORME CONTABLE DE AUDITORÍA FINANCIERA: PÉRDIDAS Y RECUPERACIÓN\n`;
    csv += `Sistema: Tu Bodeguita de Confianza\n`;
    csv += `Fecha de Emisión:${sep}${fechaEmision}\n`;
    csv += `Ciclo Analizado:${sep}${nombreCiclo}\n`;
    csv += `Filtro Temporal:${sep}${r.rangoTexto}\n`;
    csv += `Estado del Ciclo:${sep}${r.cicloInfo?.estado === 'CERRADO' || r.ratioRecuperacion >= 100 ? '100% RECUPERADO / SANEADO' : 'BALANCE EN PROCESO'}\n\n`;

    csv += `RESUMEN EJECUTIVO DEL BALANCE\n`;
    csv += `Concepto${sep}Monto (USD)\n`;
    csv += `Pérdidas por Mermas / Vencimientos:${sep}$${r.perdidaProductos.toFixed(2)}\n`;
    csv += `Pérdidas por Clientes Incobrables:${sep}$${r.deudaClientesEliminados.toFixed(2)}\n`;
    csv += `Pérdidas por Faltantes en Conteo Físico:${sep}$${r.perdidaFaltantes.toFixed(2)}\n`;
    csv += `TOTAL PÉRDIDAS BRUTAS:${sep}$${r.perdidaBruta.toFixed(2)}\n`;
    csv += `Ganancia Neta Ventas Confirmadas:${sep}$${r.gananciaGenerada.toFixed(2)}\n`;
    csv += `Pérdida Pendiente Final:${sep}$${r.perdidaPendiente.toFixed(2)}\n`;
    csv += `Tasa de Cobertura / Recuperación:${sep}${r.ratioRecuperacion}%\n`;
    csv += `Excedente Financiero Favorable:${sep}+$${r.excedente.toFixed(2)}\n\n`;

    csv += `HISTORIAL DETALLADO DE MOVIMIENTOS\n`;
    csv += `Fecha / Hora${sep}Tipo${sep}Concepto${sep}Detalle${sep}Pérdida Originada (-USD)${sep}Ganancia Compensada (+USD)${sep}Saldo Resultante (USD)\n`;

    r.movimientos.forEach(m => {
        const fecha = (m.fecha || '').replace('T', ' ').substring(0, 16);
        const tipo = m.tipoLabel || m.tipo;
        const concepto = `"${(m.concepto || '').replace(/"/g, '""')}"`;
        const detalle = `"${(m.detalle || '').replace(/"/g, '""')}"`;
        const perdida = m.perdidaUSD > 0 ? `-$${m.perdidaUSD.toFixed(2)}` : '$0.00';
        const ganancia = m.gananciaUSD > 0 ? `+$${m.gananciaUSD.toFixed(2)}` : '$0.00';
        const saldo = `${m.saldoResultante >= 0 ? '+$' : '-$'}${Math.abs(m.saldoResultante).toFixed(2)}`;

        csv += `${fecha}${sep}${tipo}${sep}${concepto}${sep}${detalle}${sep}${perdida}${sep}${ganancia}${sep}${saldo}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `informe_auditoria_financiera_ciclo_${r.cicloInfo?.numero || 1}_${ahora.toISOString().substring(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
window.descargarInformeRecuperacionExcel = descargarInformeRecuperacionExcel;

// Impresión limpia del reporte
function imprimirReporteAuditoria(cicloData = null) {
    const r = cicloData || calcularResumenPerdidasEconomicas();
    const ventana = window.open('', '_blank', 'width=900,height=700');
    if (!ventana) return;

    ventana.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Informe de Auditoría Financiera - Ciclo #${r.cicloInfo?.numero || 1}</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #1e293b; }
                h1 { font-size: 20px; margin: 0 0 6px 0; color: #0f172a; }
                p { margin: 4px 0; font-size: 13px; color: #64748b; }
                .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }
                .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #f8fafc; }
                .card span { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; }
                .card strong { font-size: 18px; font-family: monospace; display: block; margin-top: 4px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
                th { background: #f1f5f9; }
                .num { text-align: right; font-family: monospace; }
                .success { color: #16a34a; }
                .danger { color: #dc2626; }
            </style>
        </head>
        <body>
            <h1>Informe Contable de Auditoría Financiera: Pérdidas y Recuperación</h1>
            <p><strong>Ciclo:</strong> ${r.cicloInfo?.label || 'Ciclo Actual'} | <strong>Rango:</strong> ${r.rangoTexto} | <strong>Fecha Emisión:</strong> ${new Date().toLocaleString('es-VE')}</p>
            <hr style="border:0; border-top:1px solid #e2e8f0; margin:16px 0;">
            <div class="grid">
                <div class="card">
                    <span>Pérdidas Totales</span>
                    <strong class="danger">$${r.perdidaBruta.toFixed(2)}</strong>
                </div>
                <div class="card">
                    <span>Ganancia Neta Ventas</span>
                    <strong class="success">$${r.gananciaGenerada.toFixed(2)}</strong>
                </div>
                <div class="card">
                    <span>Excedente Financiero</span>
                    <strong class="success">+$${r.excedente.toFixed(2)}</strong>
                </div>
                <div class="card">
                    <span>Tasa de Recuperación</span>
                    <strong style="color:#2563eb;">${r.ratioRecuperacion}%</strong>
                </div>
            </div>

            <h3>Movimientos Contables Registrados</h3>
            <table>
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th>Concepto</th>
                        <th class="num">Pérdida</th>
                        <th class="num">Ganancia</th>
                        <th class="num">Saldo</th>
                    </tr>
                </thead>
                <tbody>
                    ${r.movimientos.map(m => `
                        <tr>
                            <td>${(m.fecha || '').replace('T', ' ').substring(0, 16)}</td>
                            <td>${m.tipoLabel}</td>
                            <td>${m.concepto}</td>
                            <td class="num danger">${m.perdidaUSD > 0 ? '-$' + m.perdidaUSD.toFixed(2) : '-'}</td>
                            <td class="num success">${m.gananciaUSD > 0 ? '+$' + m.gananciaUSD.toFixed(2) : '-'}</td>
                            <td class="num">${m.saldoResultante >= 0 ? '+$' : '-$'}${Math.abs(m.saldoResultante).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <script>window.onload = function() { window.print(); };</script>
        </body>
        </html>
    `);
    ventana.document.close();
}
window.imprimirReporteAuditoria = imprimirReporteAuditoria;

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
