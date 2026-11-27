/**
 * modules/cierre-diario.js
 * Cierre del Día / Resumen Diario Automático (con envío por WhatsApp, copiar e imprimir)
 * - Funciona de forma independiente aunque el módulo de turnos de caja esté desactivado.
 * - Calcula en tiempo real desde ventas, abonos y egresos del día seleccionado (0 lecturas extra en la nube).
 */
(function () {
    window.InventoryApp = window.InventoryApp || {};

    let fechaSeleccionadaISO = '';
    let notaCierreActual = '';

    function esc(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function toast(msg, tipo = 'info', duracion = 3200) {
        try {
            if (typeof window.showCustomToast === 'function') {
                window.showCustomToast(msg, tipo, duracion);
            } else if (window.InventoryApp?.Modal?.toast) {
                window.InventoryApp.Modal.toast(msg, tipo, duracion);
            }
        } catch {}
    }

    function obtenerFechaLocalISO(offsetDias = 0) {
        const d = new Date();
        if (offsetDias) d.setDate(d.getDate() + offsetDias);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function formatearFechaBonita(isoDate) {
        if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || '';
        const [y, m, d] = isoDate.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        return `${dias[dt.getDay()]} ${String(d).padStart(2, '0')} ${meses[m - 1]} ${y}`;
    }

    function fmtUSD(val) {
        return '$' + Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function fmtBs(val) {
        return 'Bs. ' + Number(val || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function obtenerTasaActual() {
        if (typeof window.obtenerTasaBCVDelDia === 'function') {
            const t = Number(window.obtenerTasaBCVDelDia() || 0);
            if (t > 0) return t;
        }
        return Number(window.AppState?.tasaActiva || window.AppState?.tasaUSD_BCV || 0);
    }

    /**
     * Extrae la fecha local YYYY-MM-DD de cualquier venta, abono o egreso
     */
    function extraerFechaLocalRegistro(reg) {
        if (!reg) return '';

        const parsearCadena = (str) => {
            if (!str || typeof str !== 'string') return '';
            const s = str.trim();
            if (!s || s === '—' || s === '-') return '';

            // YYYY-MM-DD (al principio de cadena)
            const mIso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
            if (mIso) {
                return `${mIso[1]}-${String(mIso[2]).padStart(2, '0')}-${String(mIso[3]).padStart(2, '0')}`;
            }

            // DD/MM/YYYY o DD-MM-YYYY
            const mLat = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
            if (mLat) {
                return `${mLat[3]}-${String(mLat[2]).padStart(2, '0')}-${String(mLat[1]).padStart(2, '0')}`;
            }

            const ms = Date.parse(s);
            if (!isNaN(ms)) {
                const dt = new Date(ms);
                return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
            }
            return '';
        };

        // 1. Revisar campos de fecha explícitos en texto
        for (const campo of [reg.fecha, reg.fechaISO, reg.fechaPago, reg.fechaRegistro]) {
            if (campo instanceof Date && !isNaN(campo.getTime())) {
                return `${campo.getFullYear()}-${String(campo.getMonth() + 1).padStart(2, '0')}-${String(campo.getDate()).padStart(2, '0')}`;
            }
            if (campo && typeof campo.toDate === 'function') {
                const dt = campo.toDate();
                return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
            }
            if (typeof campo === 'string') {
                const res = parsearCadena(campo);
                if (res) return res;
            }
        }

        // 2. Timestamp numérico o Firestore Timestamp
        for (const ts of [reg.timestamp, reg.createdAt]) {
            if (typeof ts === 'number' && !isNaN(ts) && ts > 0) {
                const dt = new Date(ts < 10000000000 ? ts * 1000 : ts);
                return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
            }
            if (ts && typeof ts.toDate === 'function') {
                const dt = ts.toDate();
                return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
            }
            if (ts && typeof ts.seconds === 'number') {
                const dt = new Date(ts.seconds * 1000);
                return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
            }
            if (typeof ts === 'string') {
                const res = parsearCadena(ts);
                if (res) return res;
            }
        }

        return '';
    }

    function esVentaValida(v) {
        if (!v) return false;
        const est = String(v.estado || '').toUpperCase();
        if (est === 'ANULADA' || est === 'RECHAZADO' || est === 'RECHAZADA' || est === 'ELIMINADA' || est === 'CANCELADA') {
            return false;
        }
        if (v.anulada === true || v.eliminada === true) return false;
        return Number(v.totalUSD ?? v.total ?? 0) >= 0;
    }

    function esVentaCredito(v) {
        if (!v) return false;
        return Boolean(
            v.tipo === 'Crédito' || v.tipo === 'credito' ||
            v.tipoPago === 'Crédito' || v.tipoPago === 'credito' ||
            v.metodoPago === 'Crédito' || v.modalidad === 'CREDITO' ||
            v.esCredito === true ||
            String(v.id || '').toUpperCase().startsWith('CRE_') ||
            v.referencia === 'CRÉDITO-REGISTRADO' ||
            String(v.referencia || '').toLowerCase().includes('crédito') ||
            String(v.metodoDetalle || '').toLowerCase().includes('crédito') ||
            String(v.metodoDetalle || '').toLowerCase().includes('fiado')
        );
    }

    function esAbonoValido(a) {
        if (!a) return false;
        const est = String(a.estado || 'APROBADO').toUpperCase();
        if (
            est === 'RECHAZADO' || est === 'RECHAZADA' ||
            est === 'ANULADO' || est === 'ANULADA' ||
            est === 'ELIMINADO' || est === 'ELIMINADA' ||
            est === 'PENDIENTE' || est === 'PENDIENTE_VERIFICACION' || est === 'PENDIENTE_CONFIRMACION' || est === 'POR_VERIFICAR'
        ) {
            return false;
        }
        if (a.anulado === true || a.eliminado === true) return false;
        return Number(a.montoUSD ?? a.totalUSD ?? a.monto ?? 0) > 0;
    }

    function clasificarMetodoPago(textoMetodo) {
        const m = String(textoMetodo || '').toLowerCase();
        if (m.includes('pago móvil') || m.includes('pago movil') || m.includes('pagomovil')) {
            return { key: 'pago_movil', label: 'Pago Móvil (Bs.)', icon: 'fa-mobile-screen-button', color: '#0284c7', esBs: true };
        }
        if (m.includes('punto de venta') || m.includes('punto') || m.includes('tarjeta') || m.includes('débito') || m.includes('debito')) {
            return { key: 'punto_venta', label: 'Punto de Venta (Bs.)', icon: 'fa-credit-card', color: '#7c3aed', esBs: true };
        }
        if (m.includes('biopago')) {
            return { key: 'biopago', label: 'Biopago BDV (Bs.)', icon: 'fa-fingerprint', color: '#db2777', esBs: true };
        }
        if (m.includes('transferencia')) {
            return { key: 'transferencia', label: 'Transferencia (Bs.)', icon: 'fa-building-columns', color: '#0d9488', esBs: true };
        }
        if (m.includes('efectivo ves') || m.includes('efectivo bs') || m.includes('bolívares') || m.includes('bolivares') || (m.includes('bs') && !m.includes('usd'))) {
            return { key: 'efectivo_ves', label: 'Efectivo (Bs.)', icon: 'fa-money-bill-wave', color: '#059669', esBs: true };
        }
        if (m.includes('efectivo') || m.includes('usd') || m.includes('divisa') || m.includes('dólar') || m.includes('dolar') || m.includes('zelle')) {
            return { key: 'efectivo_usd', label: 'Efectivo ($ USD)', icon: 'fa-dollar-sign', color: '#16a34a', esBs: false };
        }
        return { key: 'efectivo_usd', label: 'Efectivo ($ USD)', icon: 'fa-dollar-sign', color: '#16a34a', esBs: false };
    }

    /**
     * Calcula el resumen financiero completo de una fecha YYYY-MM-DD
     */
    function calcularResumenDia(fechaISO) {
        const tasa = obtenerTasaActual();
        const ventasTodas = Array.isArray(window.AppState?.ventas) ? window.AppState.ventas : [];
        const abonosTodos = Array.isArray(window.AppState?.abonos) ? window.AppState.abonos : [];
        const egresosTodos = Array.isArray(window.AppState?.egresosCaja) ? window.AppState.egresosCaja : [];
        const productos = Array.isArray(window.AppState?.productos) ? window.AppState.productos : [];
        const clientes = Array.isArray(window.AppState?.clientes) ? window.AppState.clientes : [];

        const mapaProductos = new Map();
        productos.forEach(p => { if (p && p.id) mapaProductos.set(String(p.id), p); });

        const mapaClientes = new Map();
        clientes.forEach(c => {
            if (!c) return;
            if (c.id) mapaClientes.set(String(c.id).toUpperCase(), c.nombre || c.id);
            if (c.cedula) mapaClientes.set(String(c.cedula).toUpperCase(), c.nombre || c.cedula);
        });

        const ventasDia = ventasTodas.filter(v => esVentaValida(v) && extraerFechaLocalRegistro(v) === fechaISO);
        const abonosDia = abonosTodos.filter(a => esAbonoValido(a) && extraerFechaLocalRegistro(a) === fechaISO);
        const egresosDia = egresosTodos.filter(e => e && extraerFechaLocalRegistro(e) === fechaISO);

        let contadoUSD = 0;
        let contadoVES = 0;
        let cantContado = 0;

        let creditoUSD = 0;
        let creditoVES = 0;
        let cantCredito = 0;

        let costoTotalUSD = 0;
        let unidadesVendidas = 0;

        const metodosMap = new Map();
        const agregarMetodo = (rawMetodo, montoUSD, montoVES) => {
            const meta = clasificarMetodoPago(rawMetodo);
            const cur = metodosMap.get(meta.key) || { ...meta, usd: 0, ves: 0, ops: 0 };
            cur.usd += Number(montoUSD || 0);
            cur.ves += Number(montoVES || 0);
            cur.ops += 1;
            metodosMap.set(meta.key, cur);
        };

        const productosMap = new Map();

        ventasDia.forEach(v => {
            const mUSD = Number(v.totalUSD ?? v.total ?? 0);
            const tasaVenta = Number(v.tasaMomento || v.tasaBCV || tasa || 0);
            const mVES = Number(v.totalVES || (tasaVenta > 0 ? mUSD * tasaVenta : 0));

            if (esVentaCredito(v)) {
                creditoUSD += mUSD;
                creditoVES += mVES;
                cantCredito += 1;
            } else {
                contadoUSD += mUSD;
                contadoVES += mVES;
                cantContado += 1;
                const rawMet = v.metodoDetalle || v.metodoPago || v.tipoPago || v.tipo || 'Efectivo USD';
                agregarMetodo(rawMet, mUSD, mVES);
            }

            // Costo, ganancia y ranking de productos
            const items = Array.isArray(v.items) ? v.items : [];
            items.forEach(it => {
                const cant = Number(it.cantidad || 0);
                const precio = Number(it.precio || 0);
                const prodRef = mapaProductos.get(String(it.productoId || it.id || ''));
                const factor = Number(it.factorStock || 1);
                const costoUnit = (it.costo != null && Number(it.costo) > 0)
                    ? Number(it.costo)
                    : (Number(prodRef?.costo || 0) * factor);

                costoTotalUSD += cant * costoUnit;
                unidadesVendidas += cant;

                const prodKey = String(it.productoId || it.nombre || 'Producto');
                const nombreProd = String(it.nombre || prodRef?.nombre || 'Producto');
                const prev = productosMap.get(prodKey) || { nombre: nombreProd, cantidad: 0, totalUSD: 0 };
                prev.cantidad += cant;
                prev.totalUSD += cant * precio;
                productosMap.set(prodKey, prev);
            });
        });

        // Abonos de fiados cobrados ese día
        let abonosUSD = 0;
        let abonosVES = 0;
        const detalleAbonos = [];

        abonosDia.forEach(a => {
            const mUSD = Number(a.montoUSD ?? a.totalUSD ?? a.monto ?? 0);
            const tasaAb = Number(a.tasaBCV || a.tasaMomento || tasa || 0);
            const mVES = Number(a.montoVES || a.totalVES || (tasaAb > 0 ? mUSD * tasaAb : 0));
            abonosUSD += mUSD;
            abonosVES += mVES;

            const rawMet = a.metodo || a.metodoPago || a.tipoPago || a.tipo || 'Efectivo USD';
            agregarMetodo(rawMet, mUSD, mVES);

            const cliKey = String(a.clienteId || a.clienteCedula || '').toUpperCase();
            const cliNombre = a.clienteNombre || mapaClientes.get(cliKey) || a.clienteId || 'Cliente';
            detalleAbonos.push({
                cliente: cliNombre,
                montoUSD: mUSD,
                montoVES: mVES,
                metodo: rawMet
            });
        });

        // Egresos de caja chica del día (si se registraron)
        let egresosUSD = 0;
        let egresosVES = 0;
        egresosDia.forEach(e => {
            if (e.moneda === 'USD') {
                const u = Number(e.montoUSD || e.monto || 0);
                egresosUSD += u;
                if (tasa > 0) egresosVES += u * tasa;
            } else {
                const bs = Number(e.montoVES || e.monto || 0);
                egresosVES += bs;
                if (tasa > 0) egresosUSD += bs / tasa;
            }
        });

        const totalVendidoUSD = contadoUSD + creditoUSD;
        const totalVendidoVES = contadoVES + creditoVES;
        const totalIngresadoBrutoUSD = contadoUSD + abonosUSD;
        const totalIngresadoBrutoVES = contadoVES + abonosVES;
        const totalNetoCajaUSD = Math.max(0, totalIngresadoBrutoUSD - egresosUSD);
        const totalNetoCajaVES = Math.max(0, totalIngresadoBrutoVES - egresosVES);

        const gananciaEstimadaUSD = Math.max(0, totalVendidoUSD - costoTotalUSD);
        const gananciaEstimadaVES = tasa > 0 ? gananciaEstimadaUSD * tasa : 0;
        const margenPct = totalVendidoUSD > 0 ? ((gananciaEstimadaUSD / totalVendidoUSD) * 100) : 0;

        const ordenMetodos = ['efectivo_usd', 'pago_movil', 'efectivo_ves', 'punto_venta', 'biopago', 'transferencia'];
        const metodos = Array.from(metodosMap.values()).sort((a, b) => {
            const ia = ordenMetodos.indexOf(a.key);
            const ib = ordenMetodos.indexOf(b.key);
            return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        });

        const topProductos = Array.from(productosMap.values())
            .sort((a, b) => b.cantidad - a.cantidad || b.totalUSD - a.totalUSD)
            .slice(0, 5);

        return {
            fechaISO,
            fechaBonita: formatearFechaBonita(fechaISO),
            tasa,
            totalVentasCount: ventasDia.length,
            cantContado,
            contadoUSD,
            contadoVES,
            cantCredito,
            creditoUSD,
            creditoVES,
            totalVendidoUSD,
            totalVendidoVES,
            cantAbonos: abonosDia.length,
            abonosUSD,
            abonosVES,
            detalleAbonos,
            cantEgresos: egresosDia.length,
            egresosUSD,
            egresosVES,
            totalIngresadoBrutoUSD,
            totalIngresadoBrutoVES,
            totalNetoCajaUSD,
            totalNetoCajaVES,
            costoTotalUSD,
            gananciaEstimadaUSD,
            gananciaEstimadaVES,
            margenPct,
            unidadesVendidas,
            metodos,
            topProductos
        };
    }

    /**
     * Genera el texto formateado listo para WhatsApp o portapapeles
     */
    function construirTextoCierre(resumen, nota = '') {
        const lineas = [
            `📊 *CIERRE DEL DÍA — TU BODEGUITA DE CONFIANZA*`,
            `📅 *Fecha:* ${resumen.fechaBonita}`,
            resumen.tasa > 0 ? `💱 *Tasa BCV:* Bs. ${resumen.tasa.toFixed(2)} / $` : '',
            ``,
            `🧾 *RESUMEN DE VENTAS (${resumen.totalVentasCount} ${resumen.totalVentasCount === 1 ? 'venta' : 'ventas'})*`,
            `• Contado (${resumen.cantContado}): *${fmtUSD(resumen.contadoUSD)}*${resumen.contadoVES > 0 ? ` (${fmtBs(resumen.contadoVES)})` : ''}`,
            `• Crédito / Fiado (${resumen.cantCredito}): *${fmtUSD(resumen.creditoUSD)}*${resumen.creditoVES > 0 ? ` (${fmtBs(resumen.creditoVES)})` : ''}`,
            `• *Total Vendido:* *${fmtUSD(resumen.totalVendidoUSD)}*${resumen.totalVendidoVES > 0 ? ` (${fmtBs(resumen.totalVendidoVES)})` : ''}`,
            ``,
            `💵 *INGRESOS RECIBIDOS EN CAJA*`,
            `• Ventas de contado: ${fmtUSD(resumen.contadoUSD)}`,
            `• Abonos de fiados (${resumen.cantAbonos}): ${fmtUSD(resumen.abonosUSD)}${resumen.abonosVES > 0 ? ` (${fmtBs(resumen.abonosVES)})` : ''}`
        ];

        if (resumen.cantEgresos > 0) {
            lineas.push(`• Egresos / Gastos (${resumen.cantEgresos}): -${fmtUSD(resumen.egresosUSD)}`);
            lineas.push(`• *Neto en Caja:* *${fmtUSD(resumen.totalNetoCajaUSD)}*${resumen.totalNetoCajaVES > 0 ? ` (${fmtBs(resumen.totalNetoCajaVES)})` : ''}`);
        } else {
            lineas.push(`• *Total Ingresado:* *${fmtUSD(resumen.totalIngresadoBrutoUSD)}*${resumen.totalIngresadoBrutoVES > 0 ? ` (${fmtBs(resumen.totalIngresadoBrutoVES)})` : ''}`);
        }

        if (resumen.metodos.length > 0) {
            lineas.push(``, `💳 *DESGLOSE POR MÉTODO DE PAGO*`);
            resumen.metodos.forEach(m => {
                const detalle = m.esBs
                    ? `${fmtBs(m.ves)} (${fmtUSD(m.usd)})`
                    : `${fmtUSD(m.usd)}`;
                lineas.push(`• ${m.label}: *${detalle}* [${m.ops} op.]`);
            });
        }

        if (resumen.totalVendidoUSD > 0) {
            lineas.push(
                ``,
                `📈 *GANANCIA ESTIMADA DEL DÍA*`,
                `• Utilidad aprox.: *${fmtUSD(resumen.gananciaEstimadaUSD)}* (${resumen.margenPct.toFixed(1)}% margen)${resumen.gananciaEstimadaVES > 0 ? ` · ${fmtBs(resumen.gananciaEstimadaVES)}` : ''}`
            );
        }

        if (resumen.topProductos.length > 0) {
            lineas.push(``, `🏆 *TOP MÁS VENDIDOS*`);
            resumen.topProductos.forEach((p, idx) => {
                const cantTxt = Number.isInteger(p.cantidad) ? p.cantidad : Number(p.cantidad).toFixed(2);
                lineas.push(`${idx + 1}. ${p.nombre} — ${cantTxt} und (${fmtUSD(p.totalUSD)})`);
            });
        }

        const notaLimpia = String(nota || '').trim();
        if (notaLimpia) {
            lineas.push(``, `📝 *Nota del cierre:* ${notaLimpia}`);
        }

        const responsable = window.AppState?.usuarioActual?.nombre || '';
        if (responsable) {
            lineas.push(``, `👤 Generado por: ${responsable}`);
        }

        return lineas.filter(l => l !== null && l !== undefined).join('\n').replace(/\n{3,}/g, '\n\n');
    }

    function abrirModalCierreDiario(fechaInicial = null) {
        fechaSeleccionadaISO = (fechaInicial && /^\d{4}-\d{2}-\d{2}$/.test(fechaInicial))
            ? fechaInicial
            : obtenerFechaLocalISO(0);

        let modal = document.getElementById('modal-cierre-diario-bodega');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-cierre-diario-bodega';
            modal.className = 'modal';
            modal.onclick = function (e) { if (e.target === this) cerrarModalCierreDiario(); };
            document.body.appendChild(modal);
        }

        renderizarModalCierreDiario();
        modal.classList.add('active');
    }

    function cerrarModalCierreDiario() {
        const modal = document.getElementById('modal-cierre-diario-bodega');
        if (modal) modal.classList.remove('active');
    }

    function cambiarFechaCierreDiario(nuevaFechaISO) {
        if (!nuevaFechaISO || !/^\d{4}-\d{2}-\d{2}$/.test(nuevaFechaISO)) return;
        fechaSeleccionadaISO = nuevaFechaISO;
        renderizarModalCierreDiario();
    }

    function actualizarNotaCierreDiario(valor) {
        notaCierreActual = String(valor || '').slice(0, 260);
    }

    function renderizarModalCierreDiario() {
        const modal = document.getElementById('modal-cierre-diario-bodega');
        if (!modal) return;

        const hoyISO = obtenerFechaLocalISO(0);
        const ayerISO = obtenerFechaLocalISO(-1);
        const r = calcularResumenDia(fechaSeleccionadaISO);

        const sinMovimientos = r.totalVentasCount === 0 && r.cantAbonos === 0 && r.cantEgresos === 0;

        const metodosHtml = r.metodos.length === 0
            ? `<div style="font-size:0.82rem; color:#64748b; padding:10px 0; text-align:center;">Sin cobros en caja o electrónicos registrados en esta fecha.</div>`
            : r.metodos.map(m => `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:8px 10px; border-radius:10px; background:#f8fafc; border:1px solid #e2e8f0;">
                    <div style="display:flex; align-items:center; gap:8px; min-width:0;">
                        <span style="width:28px; height:28px; border-radius:8px; background:${m.color}18; color:${m.color}; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; font-size:0.84rem;">
                            <i class="fas ${m.icon}"></i>
                        </span>
                        <div style="min-width:0;">
                            <div style="font-size:0.82rem; font-weight:700; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(m.label)}</div>
                            <div style="font-size:0.7rem; color:#64748b;">${m.ops} ${m.ops === 1 ? 'operación' : 'operaciones'}</div>
                        </div>
                    </div>
                    <div style="text-align:right; flex-shrink:0;">
                        <div style="font-size:0.88rem; font-weight:800; color:#0f172a;">${m.esBs ? fmtBs(m.ves) : fmtUSD(m.usd)}</div>
                        ${m.esBs ? `<div style="font-size:0.72rem; color:#64748b; font-weight:600;">≈ ${fmtUSD(m.usd)}</div>` : (r.tasa > 0 ? `<div style="font-size:0.72rem; color:#16a34a; font-weight:600;">${fmtBs(m.usd * r.tasa)}</div>` : '')}
                    </div>
                </div>
            `).join('');

        const topProductosHtml = r.topProductos.length === 0
            ? ''
            : `
                <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:12px;">
                    <div style="font-size:0.8rem; font-weight:800; color:#0f172a; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                        <i class="fas fa-trophy" style="color:#d97706;"></i> Top 5 Más Vendidos del Día
                    </div>
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        ${r.topProductos.map((p, idx) => {
                            const cantTxt = Number.isInteger(p.cantidad) ? p.cantidad : Number(p.cantidad).toFixed(2);
                            return `
                                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:0.8rem; padding:5px 8px; background:#f8fafc; border-radius:8px;">
                                    <span style="color:#1e293b; font-weight:600; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                        <strong style="color:#2563eb; margin-right:4px;">#${idx + 1}</strong> ${esc(p.nombre)}
                                    </span>
                                    <span style="white-space:nowrap; font-weight:700; color:#0f172a;">
                                        ${cantTxt} und · <span style="color:#16a34a;">${fmtUSD(p.totalUSD)}</span>
                                    </span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;

        const abonosListaHtml = r.detalleAbonos.length === 0
            ? ''
            : `
                <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:12px;">
                    <div style="font-size:0.8rem; font-weight:800; color:#0f172a; margin-bottom:8px; display:flex; align-items:center; justify-content:space-between;">
                        <span><i class="fas fa-hand-holding-dollar" style="color:#059669;"></i> Abonos de Fiados Cobrados (${r.cantAbonos})</span>
                        <strong style="color:#059669;">${fmtUSD(r.abonosUSD)}</strong>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:5px; max-height:140px; overflow-y:auto;">
                        ${r.detalleAbonos.map(ab => `
                            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.78rem; padding:4px 8px; background:#f0fdf4; border-radius:7px;">
                                <span style="color:#166534; font-weight:600;">${esc(ab.cliente)} <span style="color:#64748b; font-weight:500;">· ${esc(ab.metodo)}</span></span>
                                <strong style="color:#15803d;">${fmtUSD(ab.montoUSD)}</strong>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;

        modal.innerHTML = `
            <div class="modal-content" style="max-width:640px; width:96%; max-height:90vh; display:flex; flex-direction:column; padding:0; overflow:hidden; border-radius:18px; animation: modalPop 0.22s ease-out;">
                <!-- Header -->
                <div style="display:flex; justify-content:space-between; align-items:center; padding:14px 18px; background:linear-gradient(135deg, #0f172a, #1e3a8a); color:#ffffff; flex-shrink:0;">
                    <div>
                        <h3 style="margin:0; font-size:1.08rem; font-weight:800; display:flex; align-items:center; gap:8px; color:#ffffff;">
                            <i class="fas fa-calendar-check" style="color:#4ade80;"></i> Cierre del Día
                        </h3>
                        <small style="color:#cbd5e1; font-size:0.75rem;">${esc(r.fechaBonita)}${r.tasa > 0 ? ` · Tasa BCV: Bs. ${r.tasa.toFixed(2)}` : ''}</small>
                    </div>
                    <button type="button" onclick="cerrarModalCierreDiario()" style="background:rgba(255,255,255,0.14); border:none; color:#ffffff; width:32px; height:32px; border-radius:50%; font-size:1.15rem; cursor:pointer;">&times;</button>
                </div>

                <!-- Selector de fecha rápido -->
                <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; padding:10px 16px; background:#f8fafc; border-bottom:1px solid #e2e8f0; flex-shrink:0;">
                    <div style="display:flex; gap:6px;">
                        <button type="button" onclick="cambiarFechaCierreDiario('${hoyISO}')" style="padding:6px 12px; border-radius:8px; font-size:0.78rem; cursor:pointer; font-weight:700; ${fechaSeleccionadaISO === hoyISO ? 'background:#2563eb; color:#ffffff; border:1px solid #2563eb;' : 'background:#ffffff; color:#475569; border:1px solid #cbd5e1;'}">
                            Hoy
                        </button>
                        <button type="button" onclick="cambiarFechaCierreDiario('${ayerISO}')" style="padding:6px 12px; border-radius:8px; font-size:0.78rem; cursor:pointer; font-weight:700; ${fechaSeleccionadaISO === ayerISO ? 'background:#2563eb; color:#ffffff; border:1px solid #2563eb;' : 'background:#ffffff; color:#475569; border:1px solid #cbd5e1;'}">
                            Ayer
                        </button>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <label for="cierre-diario-date-input" style="font-size:0.76rem; color:#64748b; font-weight:600; margin:0;">Otra fecha:</label>
                        <input type="date" id="cierre-diario-date-input" value="${esc(fechaSeleccionadaISO)}" max="${hoyISO}" onchange="cambiarFechaCierreDiario(this.value)" style="padding:5px 9px; border:1px solid #cbd5e1; border-radius:8px; font-size:0.8rem; font-weight:600; color:#0f172a; background:#ffffff;">
                    </div>
                </div>

                <!-- Cuerpo con Scroll -->
                <div style="padding:14px 16px; overflow-y:auto; flex:1; background:#f1f5f9; display:flex; flex-direction:column; gap:12px;">
                    ${sinMovimientos ? `
                        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; padding:34px 18px; text-align:center; color:#64748b;">
                            <i class="fas fa-store-slash" style="font-size:2.2rem; opacity:0.35; margin-bottom:10px; display:block;"></i>
                            <strong style="display:block; color:#0f172a; font-size:0.96rem; margin-bottom:4px;">Sin ventas ni abonos en esta fecha</strong>
                            <span style="font-size:0.82rem;">Cuando registres ventas en el POS o abonos de clientes, aquí aparecerá el cierre completo automáticamente.</span>
                        </div>
                    ` : `
                        <!-- Tarjeta Destacada: Total Ingresado vs Total Vendido -->
                        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:10px;">
                            <div style="background:linear-gradient(135deg, #16a34a, #15803d); color:#ffffff; border-radius:14px; padding:13px 14px; box-shadow:0 4px 12px rgba(22,163,74,0.18);">
                                <div style="font-size:0.72rem; font-weight:700; opacity:0.9; text-transform:uppercase; letter-spacing:0.3px;">
                                    <i class="fas fa-wallet"></i> ${r.cantEgresos > 0 ? 'Neto Ingresado' : 'Total Ingresado'}
                                </div>
                                <div style="font-size:1.45rem; font-weight:900; margin-top:4px; line-height:1.1;">${fmtUSD(r.cantEgresos > 0 ? r.totalNetoCajaUSD : r.totalIngresadoBrutoUSD)}</div>
                                <div style="font-size:0.78rem; font-weight:700; opacity:0.92; margin-top:3px;">${r.totalIngresadoBrutoVES > 0 ? fmtBs(r.cantEgresos > 0 ? r.totalNetoCajaVES : r.totalIngresadoBrutoVES) : 'Contado + Abonos'}</div>
                                <div style="font-size:0.69rem; opacity:0.85; margin-top:4px;">Contado (${r.cantContado}) + Abonos (${r.cantAbonos})</div>
                            </div>

                            <div style="background:#ffffff; border:1px solid #cbd5e1; border-left:4px solid #2563eb; border-radius:14px; padding:13px 14px;">
                                <div style="font-size:0.72rem; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.3px;">
                                    <i class="fas fa-receipt" style="color:#2563eb;"></i> Total Vendido (${r.totalVentasCount})
                                </div>
                                <div style="font-size:1.35rem; font-weight:900; color:#0f172a; margin-top:4px; line-height:1.1;">${fmtUSD(r.totalVendidoUSD)}</div>
                                <div style="font-size:0.76rem; font-weight:700; color:#16a34a; margin-top:3px;">${r.totalVendidoVES > 0 ? fmtBs(r.totalVendidoVES) : `${r.unidadesVendidas} productos`}</div>
                                <div style="font-size:0.7rem; color:#64748b; margin-top:4px;">Contado: ${fmtUSD(r.contadoUSD)} · Fiado: ${fmtUSD(r.creditoUSD)}</div>
                            </div>

                            <div style="background:#ffffff; border:1px solid #cbd5e1; border-left:4px solid #ea580c; border-radius:14px; padding:13px 14px;">
                                <div style="font-size:0.72rem; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.3px;">
                                    <i class="fas fa-chart-line" style="color:#ea580c;"></i> Ganancia Estimada
                                </div>
                                <div style="font-size:1.35rem; font-weight:900; color:#0f172a; margin-top:4px; line-height:1.1;">${fmtUSD(r.gananciaEstimadaUSD)}</div>
                                <div style="font-size:0.76rem; font-weight:700; color:#ea580c; margin-top:3px;">Margen aprox. ${r.margenPct.toFixed(1)}%</div>
                                <div style="font-size:0.7rem; color:#64748b; margin-top:4px;">Costo merc.: ${fmtUSD(r.costoTotalUSD)}</div>
                            </div>
                        </div>

                        <!-- Resumen Contado vs Fiado + Abonos -->
                        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(145px, 1fr)); gap:8px;">
                            <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px;">
                                <div style="font-size:0.72rem; color:#64748b; font-weight:700;">Ventas Contado</div>
                                <div style="font-size:1.05rem; font-weight:800; color:#15803d; margin-top:2px;">${fmtUSD(r.contadoUSD)}</div>
                                <div style="font-size:0.71rem; color:#64748b;">${r.cantContado} ${r.cantContado === 1 ? 'venta' : 'ventas'}</div>
                            </div>
                            <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px;">
                                <div style="font-size:0.72rem; color:#64748b; font-weight:700;">Ventas Fiado / Crédito</div>
                                <div style="font-size:1.05rem; font-weight:800; color:#d97706; margin-top:2px;">${fmtUSD(r.creditoUSD)}</div>
                                <div style="font-size:0.71rem; color:#64748b;">${r.cantCredito} ${r.cantCredito === 1 ? 'venta' : 'ventas'}</div>
                            </div>
                            <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px;">
                                <div style="font-size:0.72rem; color:#64748b; font-weight:700;">Abonos Cobrados</div>
                                <div style="font-size:1.05rem; font-weight:800; color:#2563eb; margin-top:2px;">${fmtUSD(r.abonosUSD)}</div>
                                <div style="font-size:0.71rem; color:#64748b;">${r.cantAbonos} ${r.cantAbonos === 1 ? 'abono' : 'abonos'}</div>
                            </div>
                            ${r.cantEgresos > 0 ? `
                                <div style="background:#ffffff; border:1px solid #fecaca; border-radius:10px; padding:10px 12px;">
                                    <div style="font-size:0.72rem; color:#dc2626; font-weight:700;">Gastos / Egresos</div>
                                    <div style="font-size:1.05rem; font-weight:800; color:#dc2626; margin-top:2px;">-${fmtUSD(r.egresosUSD)}</div>
                                    <div style="font-size:0.71rem; color:#64748b;">${r.cantEgresos} ${r.cantEgresos === 1 ? 'egreso' : 'egresos'}</div>
                                </div>
                            ` : ''}
                        </div>

                        <!-- Desglose por Método de Pago -->
                        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:12px;">
                            <div style="font-size:0.8rem; font-weight:800; color:#0f172a; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                                <i class="fas fa-money-bill-transfer" style="color:#2563eb;"></i> Desglose por Método de Pago (Contado + Abonos)
                            </div>
                            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(230px, 1fr)); gap:8px;">
                                ${metodosHtml}
                            </div>
                        </div>

                        ${abonosListaHtml}
                        ${topProductosHtml}

                        <!-- Nota opcional para el reporte -->
                        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:10px 12px;">
                            <label for="cierre-diario-nota-input" style="display:block; font-size:0.76rem; font-weight:700; color:#475569; margin-bottom:5px;">
                                <i class="fas fa-pen-to-square" style="color:#2563eb;"></i> Nota opcional para incluir en tu resumen de WhatsApp
                            </label>
                            <input type="text" id="cierre-diario-nota-input" maxlength="260" value="${esc(notaCierreActual)}" oninput="actualizarNotaCierreDiario(this.value)" placeholder="Ej: Se pagó hielo $2, caja cuadrada completa..." style="width:100%; padding:8px 10px; border:1px solid #cbd5e1; border-radius:8px; font-size:0.82rem; color:#0f172a; background:#f8fafc;">
                        </div>
                    `}
                </div>

                <!-- Footer Acciones -->
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; padding:12px 16px; background:#ffffff; border-top:1px solid #e2e8f0; flex-shrink:0;">
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button type="button" class="btn btn-sm btn-outline" onclick="copiarCierreDiarioTexto()" ${sinMovimientos ? 'disabled' : ''} style="font-weight:700; font-size:0.8rem; padding:8px 12px; border-radius:9px;">
                            <i class="fas fa-copy"></i> Copiar
                        </button>
                        <button type="button" class="btn btn-sm btn-outline" onclick="imprimirCierreDiario()" ${sinMovimientos ? 'disabled' : ''} style="font-weight:700; font-size:0.8rem; padding:8px 12px; border-radius:9px;">
                            <i class="fas fa-print"></i> Imprimir
                        </button>
                    </div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button type="button" class="btn btn-sm btn-outline" onclick="cerrarModalCierreDiario()" style="font-weight:600; font-size:0.8rem; padding:8px 12px; border-radius:9px;">
                            Cerrar
                        </button>
                        <button type="button" class="btn btn-sm" onclick="enviarCierreDiarioWhatsApp()" ${sinMovimientos ? 'disabled' : ''} style="font-weight:800; font-size:0.82rem; padding:8px 15px; border-radius:9px; background:#16a34a; color:#ffffff; border:none; display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 8px rgba(22,163,74,0.28);">
                            <i class="fab fa-whatsapp" style="font-size:1rem;"></i> Enviar por WhatsApp
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    function enviarCierreDiarioWhatsApp() {
        const r = calcularResumenDia(fechaSeleccionadaISO);
        const nota = document.getElementById('cierre-diario-nota-input')?.value ?? notaCierreActual;
        const mensaje = construirTextoCierre(r, nota);

        const rawTel = window.AppState?.telefonoWhatsApp || '';
        const tel = rawTel && typeof window.normalizarNumeroWhatsApp === 'function'
            ? window.normalizarNumeroWhatsApp(rawTel)
            : String(rawTel).replace(/\D/g, '');

        if (tel && typeof window.abrirWhatsAppEnlace === 'function') {
            window.abrirWhatsAppEnlace({ telefono: tel, mensaje, app: 'normal' });
            return;
        }

        // Si no hay número configurado, abrir WhatsApp selector de contacto directo
        const url = tel
            ? `https://api.whatsapp.com/send?phone=${tel}&text=${encodeURIComponent(mensaje)}`
            : `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
        window.location.href = url;
    }

    async function copiarCierreDiarioTexto() {
        const r = calcularResumenDia(fechaSeleccionadaISO);
        const nota = document.getElementById('cierre-diario-nota-input')?.value ?? notaCierreActual;
        const texto = construirTextoCierre(r, nota);

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(texto);
                toast('¡Resumen del día copiado! Listo para pegar donde quieras.', 'success');
                return;
            }
        } catch {}

        try {
            const ta = document.createElement('textarea');
            ta.value = texto;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
            toast('¡Resumen del día copiado!', 'success');
        } catch {
            toast('No se pudo copiar automáticamente.', 'warning');
        }
    }

    function imprimirCierreDiario() {
        const r = calcularResumenDia(fechaSeleccionadaISO);
        const nota = document.getElementById('cierre-diario-nota-input')?.value ?? notaCierreActual;
        const texto = construirTextoCierre(r, nota);

        const htmlPrint = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Cierre del Día - ${esc(r.fechaISO)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; padding: 20px; max-width: 520px; margin: 0 auto; }
  h2 { margin: 0 0 4px 0; font-size: 18px; }
  .sub { color: #475569; font-size: 12px; margin-bottom: 14px; border-bottom: 2px solid #0f172a; padding-bottom: 8px; }
  pre { white-space: pre-wrap; font-family: inherit; font-size: 13px; line-height: 1.55; margin: 0; }
</style>
</head>
<body>
  <h2>Tu Bodeguita de Confianza — Cierre del Día</h2>
  <div class="sub">${esc(r.fechaBonita)}${r.tasa > 0 ? ` · Tasa BCV: Bs. ${r.tasa.toFixed(2)}` : ''}</div>
  <pre>${esc(texto.replace(/\*/g, ''))}</pre>
</body>
</html>`;

        // Usar iframe oculto en lugar de window.open para compatibilidad total móvil / iframe
        let frame = document.getElementById('cierre-diario-print-frame');
        if (frame) frame.remove();
        frame = document.createElement('iframe');
        frame.id = 'cierre-diario-print-frame';
        frame.style.position = 'fixed';
        frame.style.right = '0';
        frame.style.bottom = '0';
        frame.style.width = '0';
        frame.style.height = '0';
        frame.style.border = '0';
        document.body.appendChild(frame);

        const doc = frame.contentDocument || frame.contentWindow?.document;
        if (!doc) {
            toast('No se pudo preparar la impresión.', 'warning');
            return;
        }
        doc.open();
        doc.write(htmlPrint);
        doc.close();
        setTimeout(() => {
            try {
                frame.contentWindow?.focus();
                frame.contentWindow?.print();
            } catch {
                toast('No se pudo abrir la ventana de impresión.', 'warning');
            }
        }, 180);
    }

    // Exportar API global
    window.abrirModalCierreDiario = abrirModalCierreDiario;
    window.cerrarModalCierreDiario = cerrarModalCierreDiario;
    window.cambiarFechaCierreDiario = cambiarFechaCierreDiario;
    window.actualizarNotaCierreDiario = actualizarNotaCierreDiario;
    window.enviarCierreDiarioWhatsApp = enviarCierreDiarioWhatsApp;
    window.copiarCierreDiarioTexto = copiarCierreDiarioTexto;
    window.imprimirCierreDiario = imprimirCierreDiario;

    window.InventoryApp.CierreDiario = {
        abrir: abrirModalCierreDiario,
        cerrar: cerrarModalCierreDiario,
        calcularResumenDia,
        construirTextoCierre
    };
})();
