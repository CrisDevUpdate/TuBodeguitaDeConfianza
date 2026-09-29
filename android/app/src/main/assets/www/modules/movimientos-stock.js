/**
 * Módulo de Movimientos de Stock y Kardex 360° para Tu Bodeguita de Confianza
 * Permite trazabilidad exacta de entradas, salidas por ventas en caja,
 * compras por factura, bajas/mermas y ajustes de auditoría física.
 */

(function () {
    'use strict';

    let productoActualId = 'TODOS';
    let filtroActivoTipo = 'TODOS';
    let busquedaFiltroTexto = '';

    /**
     * Normaliza un texto para comparaciones seguras
     */
    function normalizarStr(str) {
        return String(str || '').toLowerCase().trim();
    }

    /**
     * Obtiene el listado completo y trazable de movimientos de stock
     * para un producto específico o para todos los productos ('TODOS')
     */
    function obtenerMovimientosProducto(productoId) {
        const prods = Array.isArray(AppState.productos) ? AppState.productos : (typeof productos !== 'undefined' ? productos : []);
        const ventasLista = Array.isArray(AppState.ventas) ? AppState.ventas : (typeof ventas !== 'undefined' ? ventas : []);
        const facturasLista = Array.isArray(AppState.facturasCompras) ? AppState.facturasCompras : [];
        const eliminacionesLista = Array.isArray(AppState.eliminaciones) ? AppState.eliminaciones : (typeof eliminaciones !== 'undefined' ? eliminaciones : []);
        const auditoriasLista = Array.isArray(AppState.auditorias) ? AppState.auditorias : (typeof auditorias !== 'undefined' ? auditorias : []);
        const kardexOficial = Array.isArray(AppState.kardex) ? AppState.kardex : [];

        const esGlobal = !productoId || productoId === 'TODOS';
        const productoTarget = esGlobal ? null : prods.find(p => String(p.id) === String(productoId));

        const todosLosMovimientos = [];

        // 1. RECOLECTAR SALIDAS POR VENTAS (POS, Mostrador, Crédito, Kiosco)
        ventasLista.forEach(v => {
            if (!v || !Array.isArray(v.items)) return;
            const fechaVenta = v.fecha || 'Sin fecha';
            const vendedor = v.vendedorNombre || v.vendedorId || 'Cajero POS';
            const cliente = v.clienteNombre || (v.clienteId ? (AppState.clientes?.find(c => c.id === v.clienteId)?.nombre || v.clienteId) : 'Cliente Mostrador');
            const tipoVenta = v.tipo === 'Crédito' || v.tipoPago === 'Crédito' ? 'Venta Fiado / Crédito' : 'Venta en Caja';

            v.items.forEach(item => {
                if (!item) return;
                const matchId = String(item.id || item.productoId) === String(productoId);
                const matchCod = productoTarget && item.codigo && String(item.codigo).toUpperCase() === String(productoTarget.codigo).toUpperCase();
                const matchNom = productoTarget && item.nombre && normalizarStr(item.nombre) === normalizarStr(productoTarget.nombre);

                if (esGlobal || matchId || matchCod || matchNom) {
                    const cant = Math.abs(Number(item.cantidad) || 1);
                    const prodRef = prods.find(p => String(p.id) === String(item.id || item.productoId)) || {
                        id: item.id || item.productoId,
                        nombre: item.nombre || 'Producto',
                        codigo: item.codigo || '-'
                    };

                    todosLosMovimientos.push({
                        id: 'V_' + (v.id || Date.now()) + '_' + Math.random().toString(36).substr(2, 4),
                        fecha: fechaVenta,
                        fechaTimestamp: new Date(fechaVenta).getTime() || 0,
                        tipo: 'VENTA',
                        subtipo: tipoVenta,
                        productoId: prodRef.id,
                        productoCodigo: prodRef.codigo || item.codigo || '-',
                        productoNombre: prodRef.nombre || item.nombre || 'Producto',
                        cantidad: -cant,
                        signo: '-',
                        unidadesMovidas: cant,
                        referencia: `Ticket / Recibo ${v.id || 'N/A'} · Cliente: ${cliente}`,
                        precioUnitario: Number(item.precio || prodRef.precio || 0),
                        costoUnitario: Number(item.costo || prodRef.costo || 0),
                        responsable: vendedor,
                        notas: v.metodoDetalle || v.tipoPago || ''
                    });
                }
            });
        });

        // 2. RECOLECTAR ENTRADAS POR COMPRAS (Facturas de Proveedores)
        // Revisamos tanto AppState.kardex como AppState.facturasCompras para no perder ninguna
        const facturasProcesadasSet = new Set();
        kardexOficial.forEach(k => {
            if (!k) return;
            const esCompra = k.tipo === 'COMPRA_FACTURA' || String(k.tipo).includes('COMPRA');
            if (!esCompra) return;

            const matchId = String(k.productoId) === String(productoId);
            const matchCod = productoTarget && k.codigo && String(k.codigo).toUpperCase() === String(productoTarget.codigo).toUpperCase();
            const matchNom = productoTarget && k.nombre && normalizarStr(k.nombre) === normalizarStr(productoTarget.nombre);

            if (esGlobal || matchId || matchCod || matchNom) {
                const cant = Math.abs(Number(k.cantidad) || 1);
                const uniqueKey = `FAC_${k.facturaNumero || ''}_${k.productoId || k.nombre}_${k.fecha}`;
                facturasProcesadasSet.add(uniqueKey);

                todosLosMovimientos.push({
                    id: k.id || ('KDX_' + Date.now()),
                    fecha: k.fecha || 'Sin fecha',
                    fechaTimestamp: new Date(k.fecha).getTime() || 0,
                    tipo: 'COMPRA',
                    subtipo: 'Compra Factura Proveedor',
                    productoId: k.productoId || (productoTarget ? productoTarget.id : '-'),
                    productoCodigo: k.codigo || (productoTarget ? productoTarget.codigo : '-'),
                    productoNombre: k.nombre || (productoTarget ? productoTarget.nombre : 'Producto'),
                    cantidad: cant,
                    signo: '+',
                    unidadesMovidas: cant,
                    referencia: `Factura #${k.facturaNumero || 'N/A'} · Proveedor: ${k.proveedor || 'Proveedor General'}`,
                    precioUnitario: Number(k.costoNuevo || k.costo || 0),
                    costoUnitario: Number(k.costoNuevo || k.costo || 0),
                    responsable: k.usuario || 'Administración',
                    notas: k.notas || ''
                });
            }
        });

        // Revisar si hay facturas de compra registradas directamente en facturasCompras que no estén en kardex
        facturasLista.forEach(f => {
            if (!f || !Array.isArray(f.items)) return;
            const fechaFact = f.fecha || 'Sin fecha';
            const prov = f.proveedor || 'Proveedor';
            const numFact = f.numeroFactura || f.numero || 'N/A';
            const usuario = f.usuario || 'Administración';

            f.items.forEach(it => {
                if (!it) return;
                const matchId = String(it.productoId) === String(productoId);
                const matchCod = productoTarget && it.codigo && String(it.codigo).toUpperCase() === String(productoTarget.codigo).toUpperCase();
                const matchNom = productoTarget && it.nombre && normalizarStr(it.nombre) === normalizarStr(productoTarget.nombre);

                if (esGlobal || matchId || matchCod || matchNom) {
                    const uniqueKey = `FAC_${numFact}_${it.productoId || it.nombre}_${fechaFact}`;
                    if (facturasProcesadasSet.has(uniqueKey)) return; // Ya incluida desde kardex
                    facturasProcesadasSet.add(uniqueKey);

                    const cant = Math.abs(Number(it.cantidad) || 1);
                    todosLosMovimientos.push({
                        id: 'FAC_' + (f.id || Date.now()) + '_' + Math.random().toString(36).substr(2, 4),
                        fecha: fechaFact,
                        fechaTimestamp: new Date(fechaFact).getTime() || 0,
                        tipo: 'COMPRA',
                        subtipo: 'Compra Factura Proveedor',
                        productoId: it.productoId || (productoTarget ? productoTarget.id : '-'),
                        productoCodigo: it.codigo || (productoTarget ? productoTarget.codigo : '-'),
                        productoNombre: it.nombre || (productoTarget ? productoTarget.nombre : 'Producto'),
                        cantidad: cant,
                        signo: '+',
                        unidadesMovidas: cant,
                        referencia: `Factura #${numFact} · Proveedor: ${prov}`,
                        precioUnitario: Number(it.costoUnitario || it.costo || 0),
                        costoUnitario: Number(it.costoUnitario || it.costo || 0),
                        responsable: usuario,
                        notas: f.notas || ''
                    });
                }
            });
        });

        // 3. RECOLECTAR SALIDAS POR BAJAS / MERMAS / RETIROS
        eliminacionesLista.forEach(el => {
            if (!el) return;
            const matchId = String(el.productoId) === String(productoId);
            const matchCod = productoTarget && el.codigo && String(el.codigo).toUpperCase() === String(productoTarget.codigo).toUpperCase();
            const matchNom = productoTarget && el.nombre && normalizarStr(el.nombre) === normalizarStr(productoTarget.nombre);

            if (esGlobal || matchId || matchCod || matchNom) {
                const cant = Math.abs(Number(el.cantidadRetirada) || Number(el.cantidad) || 1);
                todosLosMovimientos.push({
                    id: el.id || ('RET_' + Date.now()),
                    fecha: el.fecha || 'Sin fecha',
                    fechaTimestamp: new Date(el.fecha).getTime() || 0,
                    tipo: 'RETIRO',
                    subtipo: el.tipo || 'Baja / Retiro de Stock',
                    productoId: el.productoId || (productoTarget ? productoTarget.id : '-'),
                    productoCodigo: el.codigo || (productoTarget ? productoTarget.codigo : '-'),
                    productoNombre: el.nombre || (productoTarget ? productoTarget.nombre : 'Producto'),
                    cantidad: -cant,
                    signo: '-',
                    unidadesMovidas: cant,
                    referencia: `Baja por: ${el.motivo || 'Retiro manual'}${el.comentario ? ' · ' + el.comentario : ''}`,
                    precioUnitario: Number(el.precio || 0),
                    costoUnitario: Number(el.costo || 0),
                    responsable: 'Administrador',
                    notas: `Pérdida est: $${Number(el.perdidaUSD || 0).toFixed(2)}`
                });
            }
        });

        // 4. RECOLECTAR AJUSTES DE AUDITORÍA FÍSICA
        auditoriasLista.forEach(aud => {
            if (!aud) return;
            const matchId = String(aud.productoId) === String(productoId);
            const matchCod = productoTarget && aud.codigo && String(aud.codigo).toUpperCase() === String(productoTarget.codigo).toUpperCase();
            const matchNom = productoTarget && aud.nombre && normalizarStr(aud.nombre) === normalizarStr(productoTarget.nombre);

            if (esGlobal || matchId || matchCod || matchNom) {
                const dif = Number(aud.diferencia || 0);
                if (dif === 0) return; // Si no hubo diferencia, no alteró stock

                const esSobrante = dif > 0;
                todosLosMovimientos.push({
                    id: aud.id || ('AUD_' + Date.now()),
                    fecha: aud.fecha || 'Sin fecha',
                    fechaTimestamp: new Date(aud.fecha).getTime() || 0,
                    tipo: 'AUDITORIA',
                    subtipo: esSobrante ? 'Auditoría: Sobrante Físico' : 'Auditoría: Faltante Físico',
                    productoId: aud.productoId || (productoTarget ? productoTarget.id : '-'),
                    productoCodigo: aud.codigo || (productoTarget ? productoTarget.codigo : '-'),
                    productoNombre: aud.nombre || (productoTarget ? productoTarget.nombre : 'Producto'),
                    cantidad: dif,
                    signo: esSobrante ? '+' : '-',
                    unidadesMovidas: Math.abs(dif),
                    referencia: `Conteo Físico: Antes ${aud.stockAnterior ?? '?'}, Físico ${aud.stockFisico ?? '?'} · Motivo: ${aud.motivo || 'Auditoría periódica'}`,
                    precioUnitario: Number(aud.precio || (productoTarget ? productoTarget.precio : 0)),
                    costoUnitario: Number(aud.costo || (productoTarget ? productoTarget.costo : 0)),
                    responsable: aud.usuario || 'Auditor',
                    notas: aud.notas || ''
                });
            }
        });

        // 5. INVENTARIO BASE / INICIAL (Para reconstruir la línea base cuando se consulta un producto)
        if (!esGlobal && productoTarget) {
            const stockActual = Math.max(0, Number(productoTarget.stock || 0));
            // Calcular suma neta de movimientos registrados
            const sumaMovimientos = todosLosMovimientos.reduce((acc, m) => acc + Number(m.cantidad || 0), 0);
            const stockBaseInicial = stockActual - sumaMovimientos;

            if (stockBaseInicial > 0 || todosLosMovimientos.length === 0) {
                todosLosMovimientos.push({
                    id: 'BASE_' + productoTarget.id,
                    fecha: productoTarget.fechaCreacion || '2026-09-01 08:00',
                    fechaTimestamp: 1, // El más antiguo para ordenamiento
                    tipo: 'INICIAL',
                    subtipo: 'Inventario Base / Carga Inicial',
                    productoId: productoTarget.id,
                    productoCodigo: productoTarget.codigo || '-',
                    productoNombre: productoTarget.nombre,
                    cantidad: stockBaseInicial > 0 ? stockBaseInicial : stockActual,
                    signo: '+',
                    unidadesMovidas: stockBaseInicial > 0 ? stockBaseInicial : stockActual,
                    referencia: 'Stock inicial registrado al dar de alta el producto',
                    precioUnitario: Number(productoTarget.precio || 0),
                    costoUnitario: Number(productoTarget.costo || 0),
                    responsable: 'Sistema / Apertura',
                    notas: 'Inventario Base'
                });
            }
        }

        // Ordenar cronológicamente ascendente (antiguos primero) para computar saldo acumulado
        todosLosMovimientos.sort((a, b) => {
            const tA = a.fechaTimestamp || 0;
            const tB = b.fechaTimestamp || 0;
            if (tA !== tB) return tA - tB;
            return String(a.fecha).localeCompare(String(b.fecha));
        });

        // Si es consulta por producto único, computar exactamente Stock Anterior y Stock Resultante paso a paso
        if (!esGlobal && productoTarget) {
            let saldoCorrido = 0;
            todosLosMovimientos.forEach(m => {
                m.stockAnterior = saldoCorrido;
                saldoCorrido += Number(m.cantidad || 0);
                m.stockNuevo = saldoCorrido;
            });
        } else {
            // En modo global, mostrar stockAnterior y stockNuevo si los tiene registrados
            todosLosMovimientos.forEach(m => {
                m.stockAnterior = m.stockAnterior ?? '-';
                m.stockNuevo = m.stockNuevo ?? '-';
            });
        }

        // Para la visualización en tabla, ordenar descendente (los más recientes arriba)
        todosLosMovimientos.reverse();

        // Calcular KPIs de resumen
        let stockActual = 0;
        let valorStockUSD = 0;
        let totalEntradas = 0;
        let totalVentas = 0;
        let totalBajas = 0;
        let totalAuditorias = 0;

        if (!esGlobal && productoTarget) {
            stockActual = Number(productoTarget.stock || 0);
            valorStockUSD = stockActual * Number(productoTarget.costo || 0);
            todosLosMovimientos.forEach(m => {
                if (m.tipo === 'COMPRA' || m.tipo === 'INICIAL' || (m.tipo === 'AUDITORIA' && m.cantidad > 0)) {
                    totalEntradas += Math.abs(Number(m.cantidad) || 0);
                } else if (m.tipo === 'VENTA') {
                    totalVentas += Math.abs(Number(m.cantidad) || 0);
                } else if (m.tipo === 'RETIRO') {
                    totalBajas += Math.abs(Number(m.cantidad) || 0);
                } else if (m.tipo === 'AUDITORIA' && m.cantidad < 0) {
                    totalAuditorias += Math.abs(Number(m.cantidad) || 0);
                }
            });
        } else {
            stockActual = prods.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
            valorStockUSD = prods.reduce((sum, p) => sum + ((Number(p.stock) || 0) * (Number(p.costo) || 0)), 0);
            todosLosMovimientos.forEach(m => {
                if (m.tipo === 'COMPRA' || m.tipo === 'INICIAL' || (m.tipo === 'AUDITORIA' && m.cantidad > 0)) {
                    totalEntradas += Math.abs(Number(m.cantidad) || 0);
                } else if (m.tipo === 'VENTA') {
                    totalVentas += Math.abs(Number(m.cantidad) || 0);
                } else if (m.tipo === 'RETIRO') {
                    totalBajas += Math.abs(Number(m.cantidad) || 0);
                } else if (m.tipo === 'AUDITORIA' && m.cantidad < 0) {
                    totalAuditorias += Math.abs(Number(m.cantidad) || 0);
                }
            });
        }

        return {
            esGlobal,
            producto: productoTarget,
            movimientos: todosLosMovimientos,
            kpis: {
                stockActual,
                valorStockUSD,
                totalEntradas,
                totalVentas,
                totalBajas,
                totalAuditorias
            }
        };
    }

    /**
     * Renderiza el contenido del modal de movimientos de stock
     */
    function renderizarDesgloseMovimientosStock(productoIdOpt) {
        const selectProd = document.getElementById('kdx-select-producto');
        const headerCard = document.getElementById('kdx-producto-header-card');
        const tbody = document.getElementById('kdx-tabla-movimientos-body');
        const resumenConteo = document.getElementById('kdx-resumen-conteo');

        const kpiStockActual = document.getElementById('kdx-kpi-stock-actual');
        const kpiStockValor = document.getElementById('kdx-kpi-stock-valor');
        const kpiEntradas = document.getElementById('kdx-kpi-entradas');
        const kpiEntradasSub = document.getElementById('kdx-kpi-entradas-sub');
        const kpiVentas = document.getElementById('kdx-kpi-ventas');
        const kpiVentasSub = document.getElementById('kdx-kpi-ventas-sub');
        const kpiBajas = document.getElementById('kdx-kpi-bajas');
        const kpiBajasSub = document.getElementById('kdx-kpi-bajas-sub');

        if (productoIdOpt !== undefined) {
            productoActualId = productoIdOpt;
            if (selectProd && selectProd.value !== productoActualId) {
                selectProd.value = productoActualId;
            }
        } else if (selectProd) {
            productoActualId = selectProd.value || 'TODOS';
        }

        const data = obtenerMovimientosProducto(productoActualId);
        const { esGlobal, producto, movimientos, kpis } = data;
        const tasa = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 0);

        // 1. RENDERIZAR HEADER CARD DEL PRODUCTO O GLOBAL
        if (headerCard) {
            if (esGlobal) {
                const totalCatalogItems = (AppState.productos || []).length;
                headerCard.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                        <div style="display:flex; align-items:center; gap:14px;">
                            <div style="width:48px; height:48px; border-radius:12px; background:#e0f2fe; color:#0284c7; display:flex; align-items:center; justify-content:center; font-size:1.4rem;">
                                <i class="fas fa-warehouse"></i>
                            </div>
                            <div>
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <h4 style="margin:0; font-size:1.15rem; font-weight:800; color:var(--text-color);">Kardex General del Negocio</h4>
                                    <span class="badge" style="background:#0284c7; color:#fff; font-weight:700; font-size:0.75rem; border-radius:20px; padding:3px 10px;">Vista Consolidada</span>
                                </div>
                                <span style="font-size:0.85rem; color:var(--text-muted);">
                                    Mostrando todos los flujos de entradas, ventas y bajas de los <strong>${totalCatalogItems} productos</strong> registrados en bodega.
                                </span>
                            </div>
                        </div>
                        <div style="display:flex; gap:12px; text-align:right;">
                            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:6px 12px;">
                                <span style="font-size:0.72rem; color:var(--text-muted); font-weight:700; display:block;">CATÁLOGO</span>
                                <strong style="font-size:1.05rem; color:var(--text-color);">${totalCatalogItems} productos</strong>
                            </div>
                            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:6px 12px;">
                                <span style="font-size:0.72rem; color:var(--text-muted); font-weight:700; display:block;">VALOR INVENTARIO</span>
                                <strong style="font-size:1.05rem; color:#0284c7;">$${kpis.valorStockUSD.toFixed(2)}</strong>
                            </div>
                        </div>
                    </div>
                `;
            } else if (producto) {
                const p = producto;
                const pUSD = Number(p.precio || 0);
                const pVES = tasa > 0 ? pUSD * tasa : 0;
                const cUSD = Number(p.costo || 0);
                const margen = Number(p.ganancia || 0);
                const stock = Number(p.stock || 0);
                const esAgotado = stock <= 0;
                const esBajo = stock > 0 && stock <= 5;
                const imgUrl = p.imagen || '';

                headerCard.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px;">
                        <div style="display:flex; align-items:center; gap:14px; flex:1; min-width:280px;">
                            <div style="width:58px; height:58px; border-radius:12px; overflow:hidden; background:#f1f5f9; border:1px solid #e2e8f0; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                                ${imgUrl 
                                    ? `<img src="${imgUrl}" alt="${p.nombre}" style="width:100%; height:100%; object-fit:cover;" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-box\\' style=\\'color:#94a3b8; font-size:1.5rem;\\'></i>';">`
                                    : `<i class="fas fa-box" style="color:#94a3b8; font-size:1.5rem;"></i>`
                                }
                            </div>
                            <div>
                                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:2px;">
                                    <span class="badge" style="background:#f1f5f9; color:#475569; font-weight:800; font-size:0.78rem;">#${p.codigo || p.id}</span>
                                    <span class="badge" style="background:#eff6ff; color:#1d4ed8; font-weight:700; font-size:0.75rem;">${p.categoria || 'General'}</span>
                                    ${esAgotado 
                                        ? `<span class="badge" style="background:#fee2e2; color:#dc2626; font-weight:800; font-size:0.75rem;"><i class="fas fa-circle-xmark"></i> Agotado (0 unds)</span>`
                                        : (esBajo 
                                            ? `<span class="badge" style="background:#fef3c7; color:#b45309; font-weight:800; font-size:0.75rem;"><i class="fas fa-triangle-exclamation"></i> Stock Bajo (${stock} unds)</span>`
                                            : `<span class="badge" style="background:#dcfce7; color:#15803d; font-weight:800; font-size:0.75rem;"><i class="fas fa-check-circle"></i> En Stock (${stock} unds)</span>`
                                        )
                                    }
                                </div>
                                <h4 style="margin:0; font-size:1.18rem; font-weight:800; color:var(--text-color);">${p.nombre}</h4>
                                <span style="font-size:0.8rem; color:var(--text-muted);">${p.contenido || p.descripcion || 'Sin descripción adicional'}</span>
                            </div>
                        </div>

                        <!-- Bloque de Precios y Costo -->
                        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
                            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:6px 12px; text-align:center;">
                                <span style="font-size:0.7rem; color:var(--text-muted); font-weight:700; display:block;">COSTO (PU)</span>
                                <strong style="font-size:1.02rem; color:var(--text-color);">$${cUSD.toFixed(2)}</strong>
                            </div>
                            <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:6px 12px; text-align:center;">
                                <span style="font-size:0.7rem; color:#15803d; font-weight:700; display:block;">PRECIO PVP</span>
                                <strong style="font-size:1.15rem; color:#16a34a;">$${pUSD.toFixed(2)}</strong>
                                <small style="display:block; font-size:0.7rem; color:#15803d; font-weight:600;">Bs. ${pVES > 0 ? pVES.toFixed(2) : '—'}</small>
                            </div>
                            <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:6px 12px; text-align:center;">
                                <span style="font-size:0.7rem; color:#1d4ed8; font-weight:700; display:block;">MARGEN %</span>
                                <strong style="font-size:1.02rem; color:#2563eb;">${margen >= 0 ? '+' : ''}${margen}%</strong>
                            </div>
                        </div>
                    </div>
                `;
            }
        }

        // 2. ACTUALIZAR KPIS
        if (kpiStockActual) kpiStockActual.textContent = `${kpis.stockActual} unid.`;
        if (kpiStockValor) kpiStockValor.textContent = `Valorización: $${kpis.valorStockUSD.toFixed(2)} USD`;
        if (kpiEntradas) kpiEntradas.textContent = `+${kpis.totalEntradas} unid.`;
        if (kpiEntradasSub) kpiEntradasSub.textContent = esGlobal ? 'Compras y stock base global' : 'Compras y base de este producto';
        if (kpiVentas) kpiVentas.textContent = `-${kpis.totalVentas} unid.`;
        if (kpiVentasSub) kpiVentasSub.textContent = esGlobal ? 'Ventas totales en caja y crédito' : 'Despachadas al cliente en mostrador';
        if (kpiBajas) kpiBajas.textContent = `-${kpis.totalBajas + kpis.totalAuditorias} unid.`;
        if (kpiBajasSub) kpiBajasSub.textContent = `Bajas: ${kpis.totalBajas} · Faltantes: ${kpis.totalAuditorias}`;

        // 3. APLICAR FILTROS Y BÚSQUEDA A LA TABLA
        let listaFiltrada = [...movimientos];

        // Filtro por tipo
        if (filtroActivoTipo !== 'TODOS') {
            listaFiltrada = listaFiltrada.filter(m => {
                if (filtroActivoTipo === 'COMPRA') return m.tipo === 'COMPRA' || m.tipo === 'INICIAL';
                if (filtroActivoTipo === 'VENTA') return m.tipo === 'VENTA';
                if (filtroActivoTipo === 'RETIRO') return m.tipo === 'RETIRO';
                if (filtroActivoTipo === 'AUDITORIA') return m.tipo === 'AUDITORIA';
                return true;
            });
        }

        // Filtro por búsqueda de texto
        if (busquedaFiltroTexto) {
            const q = normalizarStr(busquedaFiltroTexto);
            listaFiltrada = listaFiltrada.filter(m =>
                normalizarStr(m.referencia).includes(q) ||
                normalizarStr(m.productoNombre).includes(q) ||
                normalizarStr(m.productoCodigo).includes(q) ||
                normalizarStr(m.responsable).includes(q) ||
                normalizarStr(m.subtipo).includes(q) ||
                normalizarStr(m.fecha).includes(q)
            );
        }

        // 4. RENDERIZAR TABLA DE MOVIMIENTOS
        if (tbody) {
            if (listaFiltrada.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align:center; padding:36px 16px; color:var(--text-muted);">
                            <i class="fas fa-boxes-packing" style="font-size:2.2rem; opacity:0.3; margin-bottom:8px; display:block;"></i>
                            <div style="font-weight:700; font-size:1rem; color:var(--text-color);">No se encontraron movimientos de stock</div>
                            <small>${busquedaFiltroTexto || filtroActivoTipo !== 'TODOS' ? 'Intenta seleccionando otro filtro o limpiando la búsqueda.' : 'No hay transacciones registradas para este producto todavía.'}</small>
                        </td>
                    </tr>
                `;
            } else {
                tbody.innerHTML = listaFiltrada.map(m => {
                    let badgeTipo = '';
                    if (m.tipo === 'COMPRA') {
                        badgeTipo = `<span class="badge" style="background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; font-weight:800; font-size:0.75rem; padding:3px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;"><i class="fas fa-arrow-down"></i> Entrada (Compra)</span>`;
                    } else if (m.tipo === 'VENTA') {
                        badgeTipo = `<span class="badge" style="background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; font-weight:800; font-size:0.75rem; padding:3px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;"><i class="fas fa-arrow-up"></i> Salida (Venta)</span>`;
                    } else if (m.tipo === 'RETIRO') {
                        badgeTipo = `<span class="badge" style="background:#fff7ed; color:#c2410c; border:1px solid #fed7aa; font-weight:800; font-size:0.75rem; padding:3px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;"><i class="fas fa-trash-can"></i> Baja / Merma</span>`;
                    } else if (m.tipo === 'AUDITORIA') {
                        const esSob = m.cantidad > 0;
                        badgeTipo = `<span class="badge" style="background:#f0f9ff; color:#0369a1; border:1px solid #bae6fd; font-weight:800; font-size:0.75rem; padding:3px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;"><i class="fas fa-clipboard-check"></i> ${esSob ? 'Auditoría (+)' : 'Auditoría (-)'}</span>`;
                    } else if (m.tipo === 'INICIAL') {
                        badgeTipo = `<span class="badge" style="background:#faf5ff; color:#7e22ce; border:1px solid #e9d5ff; font-weight:800; font-size:0.75rem; padding:3px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;"><i class="fas fa-boxes-stacked"></i> Base Inicial</span>`;
                    }

                    const esPositivo = m.cantidad > 0;
                    const cantidadTexto = esPositivo ? `+${m.cantidad}` : `${m.cantidad}`;
                    const colorCantidad = esPositivo ? '#16a34a' : '#dc2626';

                    // Stock anterior y nuevo
                    let stockTransicionHtml = '—';
                    if (m.stockAnterior !== '-' && m.stockNuevo !== '-') {
                        const stockFin = Number(m.stockNuevo);
                        const finColor = stockFin <= 0 ? '#dc2626' : (stockFin <= 5 ? '#d97706' : '#15803d');
                        stockTransicionHtml = `
                            <span style="font-size:0.84rem; display:inline-flex; align-items:center; gap:4px; font-weight:700;">
                                <span style="color:#64748b;">${m.stockAnterior}</span>
                                <i class="fas fa-arrow-right" style="font-size:0.68rem; color:#94a3b8;"></i>
                                <strong style="color:${finColor};">${m.stockNuevo}</strong>
                            </span>
                        `;
                    }

                    const nombreProdBadge = esGlobal ? `
                        <div style="font-size:0.78rem; font-weight:700; color:#0369a1; margin-bottom:2px;">
                            ${m.productoNombre} <span style="font-size:0.7rem; color:#64748b; font-weight:normal;">(#${m.productoCodigo})</span>
                        </div>
                    ` : '';

                    const valorPrecioCosto = m.tipo === 'VENTA' 
                        ? `$${Number(m.precioUnitario || 0).toFixed(2)} (PVP)`
                        : `$${Number(m.costoUnitario || 0).toFixed(2)} (Costo)`;

                    return `
                        <tr style="border-bottom:1px solid #f1f5f9; transition:background 0.15s ease;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
                            <td style="padding:10px 12px; font-size:0.82rem; color:#64748b; white-space:nowrap;">
                                <i class="far fa-clock" style="margin-right:4px;"></i>${m.fecha}
                            </td>
                            <td style="padding:10px 12px; text-align:center;">
                                ${badgeTipo}
                                <div style="font-size:0.72rem; color:#64748b; margin-top:2px;">${m.subtipo}</div>
                            </td>
                            <td style="padding:10px 12px;">
                                ${nombreProdBadge}
                                <div style="font-weight:600; color:var(--text-color);">${m.referencia}</div>
                                ${m.notas ? `<small style="color:#64748b; display:block; font-size:0.75rem;">${m.notas}</small>` : ''}
                            </td>
                            <td style="padding:10px 12px; text-align:center; font-weight:900; font-size:1.02rem; color:${colorCantidad}; white-space:nowrap;">
                                ${cantidadTexto} unds
                            </td>
                            <td style="padding:10px 12px; text-align:center;">
                                ${stockTransicionHtml}
                            </td>
                            <td style="padding:10px 12px; text-align:right; font-weight:700; color:var(--text-color); font-size:0.85rem; white-space:nowrap;">
                                ${valorPrecioCosto}
                            </td>
                            <td style="padding:10px 12px; text-align:center; font-size:0.82rem; color:#475569;">
                                <span class="badge" style="background:#f1f5f9; color:#475569; font-weight:600;">
                                    <i class="fas fa-user" style="font-size:0.7rem; margin-right:3px;"></i>${m.responsable}
                                </span>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }

        // 5. RESUMEN DE CONTEO
        if (resumenConteo) {
            resumenConteo.innerHTML = `Mostrando <strong>${listaFiltrada.length}</strong> de <strong>${movimientos.length}</strong> movimientos registrados.`;
        }
    }

    /**
     * Llena el select de productos del modal de movimientos
     */
    function actualizarSelectProductosKardex(idSeleccionado) {
        const select = document.getElementById('kdx-select-producto');
        if (!select) return;

        const prods = Array.isArray(AppState.productos) ? AppState.productos : (typeof productos !== 'undefined' ? productos : []);
        const ordenados = [...prods].sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || '')));

        let optionsHtml = `<option value="TODOS">📦 TODOS LOS PRODUCTOS (DESGLOSE GLOBAL)</option>`;
        ordenados.forEach(p => {
            const stock = Number(p.stock || 0);
            const stockLabel = stock <= 0 ? ' [AGOTADO]' : ` [Stock: ${stock}]`;
            optionsHtml += `<option value="${p.id}">#${p.codigo || p.id} - ${p.nombre}${stockLabel}</option>`;
        });

        select.innerHTML = optionsHtml;

        if (idSeleccionado && (idSeleccionado === 'TODOS' || prods.some(p => String(p.id) === String(idSeleccionado)))) {
            select.value = idSeleccionado;
            productoActualId = idSeleccionado;
        } else {
            select.value = productoActualId || 'TODOS';
        }
    }

    /**
     * Abre el modal de movimientos de stock
     */
    function abrirModalMovimientosStock(productoIdOpt) {
        const modal = document.getElementById('modal-movimientos-stock');
        if (!modal) return;

        const idTarget = productoIdOpt || productoActualId || 'TODOS';
        actualizarSelectProductosKardex(idTarget);
        productoActualId = idTarget;

        // Resetear filtros
        filtroActivoTipo = 'TODOS';
        busquedaFiltroTexto = '';
        const searchInput = document.getElementById('kdx-input-busqueda');
        if (searchInput) searchInput.value = '';

        // Resetear chips
        ['todos', 'compras', 'ventas', 'retiros', 'auditorias'].forEach(tipo => {
            const chip = document.getElementById(`chip-kdx-${tipo}`);
            if (chip) {
                if (tipo === 'todos') chip.classList.add('active');
                else chip.classList.remove('active');
            }
        });

        renderizarDesgloseMovimientosStock(idTarget);
        modal.style.display = 'flex';
    }

    /**
     * Cierra el modal de movimientos de stock
     */
    function cerrarModalMovimientosStock() {
        const modal = document.getElementById('modal-movimientos-stock');
        if (modal) modal.style.display = 'none';
    }

    /**
     * Callback al cambiar de producto en el select del modal
     */
    function alCambiarProductoMovimientos(nuevoId) {
        productoActualId = nuevoId || 'TODOS';
        renderizarDesgloseMovimientosStock(productoActualId);
    }

    /**
     * Filtra la tabla de movimientos por tipo
     */
    function filtrarMovimientosStock(tipo) {
        filtroActivoTipo = tipo || 'TODOS';

        const map = {
            'TODOS': 'todos',
            'COMPRA': 'compras',
            'VENTA': 'ventas',
            'RETIRO': 'retiros',
            'AUDITORIA': 'auditorias'
        };

        ['todos', 'compras', 'ventas', 'retiros', 'auditorias'].forEach(t => {
            const chip = document.getElementById(`chip-kdx-${t}`);
            if (chip) {
                if (t === map[filtroActivoTipo]) chip.classList.add('active');
                else chip.classList.remove('active');
            }
        });

        renderizarDesgloseMovimientosStock();
    }

    /**
     * Filtra la tabla por texto en tiempo real
     */
    function alBuscarMovimientosStock(texto) {
        busquedaFiltroTexto = String(texto || '').trim();
        renderizarDesgloseMovimientosStock();
    }

    /**
     * Exporta el kardex de movimientos a archivo Excel (.xlsx)
     */
    function descargarKardexProductoExcel() {
        const data = obtenerMovimientosProducto(productoActualId);
        const { esGlobal, producto, movimientos } = data;

        const nombreBase = esGlobal 
            ? 'Kardex_Movimientos_Global' 
            : `Kardex_${(producto?.codigo || producto?.nombre || 'Producto').replace(/[^a-zA-Z0-9_-]/g, '_')}`;

        const fechaHoy = new Date().toISOString().substring(0, 10);
        const nombreArchivo = `${nombreBase}_${fechaHoy}.xlsx`;

        const filasExportar = movimientos.map((m, idx) => ({
            'N°': idx + 1,
            'Fecha y Hora': m.fecha,
            'Tipo de Movimiento': m.subtipo,
            'Código': m.productoCodigo,
            'Producto': m.productoNombre,
            'Referencia / Concepto': m.referencia,
            'Entrada / Salida': m.signo === '+' ? 'Entrada (+)' : 'Salida (-)',
            'Cantidad (Unds)': m.cantidad,
            'Stock Anterior': m.stockAnterior,
            'Stock Resultante': m.stockNuevo,
            'Precio / Costo Unitario ($)': m.tipo === 'VENTA' ? m.precioUnitario : m.costoUnitario,
            'Responsable': m.responsable,
            'Notas': m.notas || ''
        }));

        if (typeof XLSX !== 'undefined' && XLSX.utils) {
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(filasExportar);

            // Ajustar ancho de columnas
            ws['!cols'] = [
                { wch: 5 },  // N°
                { wch: 18 }, // Fecha
                { wch: 25 }, // Tipo
                { wch: 12 }, // Código
                { wch: 30 }, // Producto
                { wch: 45 }, // Referencia
                { wch: 14 }, // Entrada/Salida
                { wch: 15 }, // Cantidad
                { wch: 14 }, // Stock Anterior
                { wch: 15 }, // Stock Resultante
                { wch: 18 }, // Precio/Costo
                { wch: 20 }, // Responsable
                { wch: 25 }  // Notas
            ];

            XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
            XLSX.writeFile(wb, nombreArchivo);
        } else {
            // Fallback a CSV
            let csv = '\uFEFF'; // BOM para tildes en Excel
            const headers = ['N°', 'Fecha y Hora', 'Tipo de Movimiento', 'Código', 'Producto', 'Referencia / Concepto', 'Cantidad', 'Stock Anterior', 'Stock Resultante', 'Precio/Costo ($)', 'Responsable'];
            csv += headers.join(';') + '\n';

            filasExportar.forEach(f => {
                const fila = [
                    f['N°'],
                    `"${f['Fecha y Hora']}"`,
                    `"${f['Tipo de Movimiento']}"`,
                    `"${f['Código']}"`,
                    `"${f['Producto']}"`,
                    `"${(f['Referencia / Concepto'] || '').replace(/"/g, '""')}"`,
                    f['Cantidad (Unds)'],
                    f['Stock Anterior'],
                    f['Stock Resultante'],
                    f['Precio / Costo Unitario ($)'],
                    `"${f['Responsable']}"`
                ];
                csv += fila.join(';') + '\n';
            });

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${nombreBase}_${fechaHoy}.csv`;
            link.click();
        }
    }

    /**
     * Genera e imprime reporte amigable de los movimientos de stock
     */
    function imprimirKardexProducto() {
        const data = obtenerMovimientosProducto(productoActualId);
        const { esGlobal, producto, movimientos, kpis } = data;
        const fechaImpresion = new Date().toLocaleString('es-VE');

        const titulo = esGlobal 
            ? 'Kardex Global de Movimientos de Inventario' 
            : `Kardex de Movimientos: ${producto?.nombre} (${producto?.codigo || '-'})`;

        const ventana = window.open('', '_blank', 'width=950,height=750');
        if (!ventana) {
            alert('Por favor habilita las ventanas emergentes en tu navegador para imprimir.');
            return;
        }

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>${titulo}</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; padding: 24px; font-size: 13px; line-height: 1.4; }
                    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 16px; }
                    .brand { font-size: 20px; font-weight: 800; color: #0284c7; }
                    .subtitle { font-size: 12px; color: #64748b; }
                    .kpi-row { display: flex; gap: 12px; margin-bottom: 18px; }
                    .kpi-box { flex: 1; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; }
                    .kpi-title { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; }
                    .kpi-val { font-size: 18px; font-weight: 800; margin-top: 2px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
                    th, td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; }
                    th { background: #f1f5f9; font-weight: 700; }
                    .num { text-align: center; }
                    .positivo { color: #16a34a; font-weight: 800; }
                    .negativo { color: #dc2626; font-weight: 800; }
                    @media print {
                        body { padding: 0; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <div class="brand">Tu Bodeguita de Confianza</div>
                        <div class="subtitle">${titulo} · Fecha de consulta: ${fechaImpresion}</div>
                    </div>
                    <button class="no-print" onclick="window.print()" style="padding: 8px 16px; background:#0284c7; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">
                        Imprimir / Guardar PDF
                    </button>
                </div>

                <div class="kpi-row">
                    <div class="kpi-box">
                        <div class="kpi-title">Stock Actual</div>
                        <div class="kpi-val" style="color:#0284c7;">${kpis.stockActual} unds</div>
                    </div>
                    <div class="kpi-box">
                        <div class="kpi-title">Total Entradas</div>
                        <div class="kpi-val" style="color:#16a34a;">+${kpis.totalEntradas} unds</div>
                    </div>
                    <div class="kpi-box">
                        <div class="kpi-title">Total Salidas x Venta</div>
                        <div class="kpi-val" style="color:#dc2626;">-${kpis.totalVentas} unds</div>
                    </div>
                    <div class="kpi-box">
                        <div class="kpi-title">Total Bajas / Mermas</div>
                        <div class="kpi-val" style="color:#ea580c;">-${kpis.totalBajas + kpis.totalAuditorias} unds</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width:120px;">Fecha</th>
                            <th style="width:110px;">Tipo</th>
                            ${esGlobal ? '<th>Producto</th>' : ''}
                            <th>Concepto / Referencia</th>
                            <th class="num" style="width:90px;">Movimiento</th>
                            <th class="num" style="width:110px;">Stock Ant ➡️ Fin</th>
                            <th class="num" style="width:90px;">Costo/PVP</th>
                            <th style="width:100px;">Responsable</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${movimientos.map(m => `
                            <tr>
                                <td>${m.fecha}</td>
                                <td>${m.subtipo}</td>
                                ${esGlobal ? `<td><b>${m.productoNombre}</b> (${m.productoCodigo})</td>` : ''}
                                <td>${m.referencia}</td>
                                <td class="num ${m.cantidad > 0 ? 'positivo' : 'negativo'}">${m.cantidad > 0 ? '+' : ''}${m.cantidad}</td>
                                <td class="num">${m.stockAnterior !== '-' ? `${m.stockAnterior} ➡️ ${m.stockNuevo}` : '—'}</td>
                                <td class="num">$${Number(m.tipo === 'VENTA' ? m.precioUnitario : m.costoUnitario).toFixed(2)}</td>
                                <td>${m.responsable}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `;

        ventana.document.write(html);
        ventana.document.close();
    }

    // Exportar funciones globalmente para uso en botones HTML y módulos
    window.obtenerMovimientosProducto = obtenerMovimientosProducto;
    window.renderizarDesgloseMovimientosStock = renderizarDesgloseMovimientosStock;
    window.abrirModalMovimientosStock = abrirModalMovimientosStock;
    window.cerrarModalMovimientosStock = cerrarModalMovimientosStock;
    window.alCambiarProductoMovimientos = alCambiarProductoMovimientos;
    window.filtrarMovimientosStock = filtrarMovimientosStock;
    window.alBuscarMovimientosStock = alBuscarMovimientosStock;
    window.descargarKardexProductoExcel = descargarKardexProductoExcel;
    window.imprimirKardexProducto = imprimirKardexProducto;

    if (!window.InventoryApp) window.InventoryApp = {};
    window.InventoryApp.MovimientosStock = {
        obtenerMovimientosProducto,
        renderizarDesgloseMovimientosStock,
        abrirModalMovimientosStock,
        cerrarModalMovimientosStock,
        alCambiarProductoMovimientos,
        filtrarMovimientosStock,
        alBuscarMovimientosStock,
        descargarKardexProductoExcel,
        imprimirKardexProducto
    };

})();
