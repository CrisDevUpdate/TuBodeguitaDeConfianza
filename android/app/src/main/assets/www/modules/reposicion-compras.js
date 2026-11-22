/**
 * modules/reposicion-compras.js
 * Predicción de Agotamiento y Lista Automática de Compras (Descargable)
 * Analiza la velocidad real de ventas recientes (incluyendo componentes de combos y fardos),
 * estima cuántos días de inventario quedan por producto y genera una lista editable
 * y descargable en Excel (.xlsx), Texto (.txt), CSV (.csv) o lista lista para WhatsApp.
 *
 * IMPORTANTE: Módulo 100% de solo lectura respecto a la base de datos. No altera stock ni precios.
 */
(function () {
    'use strict';

    window.InventoryApp = window.InventoryApp || {};

    const state = {
        ventanaDias: 14,
        diasCobertura: 7,
        filtroEstado: 'reponer', // 'reponer' | 'criticos' | 'todos'
        busqueda: '',
        incluirSinVentasBajos: true,
        cantidadesEditadas: {}, // { prodId: number }
        seleccionados: {},      // { prodId: boolean }
        ultimoAnalisis: null
    };

    function escaparHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function normalizarTexto(str) {
        return String(str || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }

    function obtenerTasaBCVActual() {
        if (window.AppState && Number(window.AppState.tasaBCV) > 0) return Number(window.AppState.tasaBCV);
        if (window.AppState && Number(window.AppState.tasaCambio) > 0) return Number(window.AppState.tasaCambio);
        if (typeof tasaBCV !== 'undefined' && Number(tasaBCV) > 0) return Number(tasaBCV);
        return 1;
    }

    function obtenerUmbralStockMinimo() {
        try {
            if (window.InventoryApp && typeof window.InventoryApp.obtenerUmbralStockBajo === 'function') {
                const u = Number(window.InventoryApp.obtenerUmbralStockBajo());
                if (Number.isFinite(u) && u >= 1) return u;
            }
        } catch (_e) {}
        return 5;
    }

    /**
     * Parsea fechas en múltiples formatos usados por el sistema (ISO, YYYY-MM-DD HH:mm, DD/MM/YYYY, Firestore Timestamp)
     */
    function parsearFechaSegura(valor) {
        if (!valor) return null;
        if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor;
        if (typeof valor === 'number') {
            const d = new Date(valor);
            return isNaN(d.getTime()) ? null : d;
        }
        if (typeof valor === 'object') {
            if (typeof valor.toDate === 'function') {
                const d = valor.toDate();
                return isNaN(d.getTime()) ? null : d;
            }
            if (typeof valor.seconds === 'number') {
                const d = new Date(valor.seconds * 1000);
                return isNaN(d.getTime()) ? null : d;
            }
        }
        const raw = String(valor).trim();
        if (!raw) return null;

        // DD/MM/YYYY o DD-MM-YYYY con hora opcional
        const matchDMY = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
        if (matchDMY) {
            const d = new Date(
                Number(matchDMY[3]),
                Number(matchDMY[2]) - 1,
                Number(matchDMY[1]),
                Number(matchDMY[4] || 12),
                Number(matchDMY[5] || 0),
                Number(matchDMY[6] || 0)
            );
            return isNaN(d.getTime()) ? null : d;
        }

        // ISO / YYYY-MM-DD HH:mm
        const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
        const parsed = new Date(normalized);
        if (!isNaN(parsed.getTime())) return parsed;

        const fallback = new Date(raw);
        return isNaN(fallback.getTime()) ? null : fallback;
    }

    function esComboVirtual(p) {
        if (!p) return false;
        if (typeof window.esProductoCombo === 'function') {
            try {
                return Boolean(window.esProductoCombo(p));
            } catch (_e) {}
        }
        return Boolean(
            p.esCombo === true ||
            p.isCombo === true ||
            String(p.tipo || '').toLowerCase() === 'combo' ||
            (Array.isArray(p.componentes) && p.componentes.length > 0) ||
            (Array.isArray(p.items) && p.items.length > 0)
        );
    }

    /**
     * Construye un mapa de último proveedor conocido por producto desde facturas de compra y kardex
     */
    function construirMapaProveedores() {
        const provMap = new Map(); // prodKey -> { proveedor, ts }
        const registrar = (key, proveedor, fecha) => {
            if (!key || !proveedor) return;
            const cleanProv = String(proveedor).trim();
            if (!cleanProv || cleanProv.toLowerCase() === 'proveedor general') return;
            const ts = parsearFechaSegura(fecha)?.getTime() || 0;
            const prev = provMap.get(key);
            if (!prev || ts >= prev.ts) {
                provMap.set(key, { proveedor: cleanProv, ts });
            }
        };

        const facturas = Array.isArray(window.AppState?.facturasCompras) ? window.AppState.facturasCompras : [];
        facturas.forEach(f => {
            if (!f) return;
            const prov = f.proveedor || f.nombreProveedor || '';
            const fecha = f.fecha || f.fechaEmision || f.createdAt;
            const items = Array.isArray(f.items) ? f.items : (Array.isArray(f.productos) ? f.productos : []);
            items.forEach(it => {
                if (!it) return;
                if (it.productoId || it.id) registrar(`ID:${String(it.productoId || it.id).toUpperCase()}`, prov, fecha);
                if (it.codigo) registrar(`COD:${String(it.codigo).toUpperCase()}`, prov, fecha);
                if (it.nombre) registrar(`NOM:${normalizarTexto(it.nombre)}`, prov, fecha);
            });
        });

        const kardex = Array.isArray(window.AppState?.kardex) ? window.AppState.kardex : [];
        kardex.forEach(k => {
            if (!k || !k.proveedor) return;
            if (k.productoId) registrar(`ID:${String(k.productoId).toUpperCase()}`, k.proveedor, k.fecha);
            if (k.codigo) registrar(`COD:${String(k.codigo).toUpperCase()}`, k.proveedor, k.fecha);
            if (k.nombre) registrar(`NOM:${normalizarTexto(k.nombre)}`, k.proveedor, k.fecha);
        });

        return provMap;
    }

    /**
     * Calcula la predicción de agotamiento y sugerencia de reposición para todos los productos físicos.
     */
    function calcularPrediccionReposicion(opciones = {}) {
        const ventanaDias = Math.max(1, Number(opciones.ventanaDias || state.ventanaDias || 14));
        const diasCobertura = Math.max(1, Number(opciones.diasCobertura || state.diasCobertura || 7));
        const umbralMinimo = Math.max(1, Number(opciones.umbralMinimo || obtenerUmbralStockMinimo()));
        const incluirSinVentasBajos = opciones.incluirSinVentasBajos !== undefined
            ? Boolean(opciones.incluirSinVentasBajos)
            : state.incluirSinVentasBajos;

        const productosRaw = Array.isArray(window.AppState?.productos)
            ? window.AppState.productos
            : (typeof productos !== 'undefined' && Array.isArray(productos) ? productos : []);

        const ventasRaw = Array.isArray(window.AppState?.ventas)
            ? window.AppState.ventas
            : (typeof ventas !== 'undefined' && Array.isArray(ventas) ? ventas : []);

        const tasaBCV = obtenerTasaBCVActual();
        const ahora = Date.now();
        const limiteMs = ahora - ventanaDias * 24 * 60 * 60 * 1000;

        // Índices rápidos de productos físicos y combos
        const productosFisicos = productosRaw.filter(p => p && p.id && !esComboVirtual(p));
        const combosMap = new Map();
        productosRaw.forEach(p => {
            if (p && esComboVirtual(p)) {
                combosMap.set(String(p.id).toUpperCase(), p);
                if (p.codigo) combosMap.set(String(p.codigo).toUpperCase(), p);
                if (p.nombre) combosMap.set(normalizarTexto(p.nombre), p);
            }
        });

        const byId = new Map();
        const byCod = new Map();
        const byNom = new Map();
        productosFisicos.forEach(p => {
            byId.set(String(p.id).toUpperCase(), p);
            if (p.codigo) byCod.set(String(p.codigo).toUpperCase(), p);
            if (p.nombre) byNom.set(normalizarTexto(p.nombre), p);
        });

        const resolverProductoFisico = (item) => {
            if (!item) return null;
            const idKey = String(item.productoId || item.id || '').trim().toUpperCase();
            if (idKey && byId.has(idKey)) return byId.get(idKey);
            const codKey = String(item.codigo || '').trim().toUpperCase();
            if (codKey && byCod.has(codKey)) return byCod.get(codKey);
            const nomKey = normalizarTexto(item.nombre || '');
            if (nomKey && byNom.has(nomKey)) return byNom.get(nomKey);
            return null;
        };

        // Acumular unidades vendidas en la ventana de días
        const ventasPorProd = new Map(); // prodId -> { unidades, tickets, ultimaVentaMs }
        let ventasValidasEnVentana = 0;

        const sumarVenta = (prod, unidades, fechaMs) => {
            if (!prod || !prod.id || unidades <= 0) return;
            const key = String(prod.id);
            const prev = ventasPorProd.get(key) || { unidades: 0, tickets: 0, ultimaVentaMs: 0 };
            prev.unidades += unidades;
            prev.tickets += 1;
            if (fechaMs > prev.ultimaVentaMs) prev.ultimaVentaMs = fechaMs;
            ventasPorProd.set(key, prev);
        };

        ventasRaw.forEach(v => {
            if (!v || !Array.isArray(v.items) || v.items.length === 0) return;
            const estadoUp = String(v.estado || '').trim().toUpperCase();
            if (estadoUp === 'RECHAZADA' || estadoUp === 'ANULADA' || estadoUp === 'CANCELADA') return;
            if (v.esAjusteAdministrativo) return;

            const fechaVenta = parsearFechaSegura(v.fecha || v.createdAt || v.timestamp);
            if (!fechaVenta) return;
            const fechaMs = fechaVenta.getTime();
            if (fechaMs < limiteMs || fechaMs > ahora + 24 * 60 * 60 * 1000) return;

            ventasValidasEnVentana += 1;

            v.items.forEach(item => {
                if (!item) return;
                const itemIdUp = String(item.productoId || item.id || '').toUpperCase();
                if (itemIdUp === 'SALDO_INICIAL' || itemIdUp === 'CARGO_MANUAL') return;

                const qty = Math.max(0, Number(item.cantidad || 1));
                if (qty <= 0) return;

                // ¿Es un combo? Desglosar en sus productos físicos componentes
                const comboRef = combosMap.get(itemIdUp) ||
                    (item.codigo ? combosMap.get(String(item.codigo).toUpperCase()) : null) ||
                    (item.nombre ? combosMap.get(normalizarTexto(item.nombre)) : null);
                const comps = Array.isArray(item.componentes) && item.componentes.length > 0
                    ? item.componentes
                    : (Array.isArray(comboRef?.componentes) && comboRef.componentes.length > 0
                        ? comboRef.componentes
                        : (Array.isArray(comboRef?.items) ? comboRef.items : null));

                if (comps && comps.length > 0) {
                    comps.forEach(comp => {
                        const prodComp = resolverProductoFisico(comp);
                        if (prodComp) {
                            const cantComp = Math.max(1, Number(comp.cantidad || 1)) * qty;
                            sumarVenta(prodComp, cantComp, fechaMs);
                        }
                    });
                    return;
                }

                const prod = resolverProductoFisico(item);
                if (!prod) return;

                // Si se vendió por fardo/bulto, convertir a unidades reales de inventario
                let unidadesReales = qty;
                const esFardo = Boolean(item.esFardo || item.modalidad === 'FARDO' || String(item.tipoVenta || '').toUpperCase() === 'FARDO');
                const undsPorFardo = Number(item.unidadesPorFardo || prod.unidadesPorFardo || 0);
                if (esFardo && undsPorFardo > 1 && !item.yaConvertidoAUnidades) {
                    unidadesReales = qty * undsPorFardo;
                }

                sumarVenta(prod, unidadesReales, fechaMs);
            });
        });

        const provMap = construirMapaProveedores();

        const filas = productosFisicos.map(p => {
            const stockActual = Math.max(0, Number(p.stock || 0));
            const stats = ventasPorProd.get(String(p.id)) || { unidades: 0, tickets: 0, ultimaVentaMs: 0 };
            const vendidoPeriodo = Number(stats.unidades || 0);
            const velocidadDiaria = vendidoPeriodo / ventanaDias;

            let diasRestantes = null;
            if (stockActual <= 0) {
                diasRestantes = 0;
            } else if (velocidadDiaria > 0) {
                diasRestantes = stockActual / velocidadDiaria;
            }

            let estado = 'SALUDABLE';
            let prioridad = 4;
            if (stockActual <= 0) {
                estado = 'AGOTADO';
                prioridad = 0;
            } else if (diasRestantes !== null && diasRestantes <= 3) {
                estado = 'CRITICO';
                prioridad = 1;
            } else if (diasRestantes !== null && diasRestantes <= diasCobertura) {
                estado = 'PRONTO';
                prioridad = 2;
            } else if (velocidadDiaria === 0 && stockActual <= umbralMinimo) {
                estado = 'STOCK_BAJO';
                prioridad = 3;
            }

            let cantidadSugerida = 0;
            if (velocidadDiaria > 0) {
                const objetivo = Math.ceil(velocidadDiaria * diasCobertura);
                cantidadSugerida = Math.max(0, objetivo - stockActual);
                if (stockActual <= 0 && cantidadSugerida === 0) {
                    cantidadSugerida = Math.max(1, umbralMinimo);
                }
            } else if (stockActual <= 0) {
                cantidadSugerida = umbralMinimo;
            } else if (stockActual <= umbralMinimo && incluirSinVentasBajos) {
                cantidadSugerida = Math.max(1, umbralMinimo - stockActual);
            }

            const necesitaReposicion =
                estado === 'AGOTADO' ||
                estado === 'CRITICO' ||
                estado === 'PRONTO' ||
                (incluirSinVentasBajos && estado === 'STOCK_BAJO');

            const costoUnitUSD = Math.max(0, Number(p.costo || p.costoUSD || 0));
            const precioVentaUSD = Math.max(0, Number(p.precio || p.precioUSD || 0));

            const provEntry =
                provMap.get(`ID:${String(p.id).toUpperCase()}`) ||
                (p.codigo ? provMap.get(`COD:${String(p.codigo).toUpperCase()}`) : null) ||
                (p.nombre ? provMap.get(`NOM:${normalizarTexto(p.nombre)}`) : null);

            return {
                id: String(p.id),
                codigo: String(p.codigo || p.id),
                nombre: String(p.nombre || 'Producto sin nombre'),
                categoria: String(p.categoria || 'General'),
                medida: String(p.medida || p.presentacion || p.descripcion || ''),
                proveedor: provEntry ? provEntry.proveedor : '',
                stockActual,
                vendidoPeriodo,
                velocidadDiaria,
                diasRestantes,
                estado,
                prioridad,
                necesitaReposicion,
                cantidadSugerida,
                costoUnitUSD,
                precioVentaUSD,
                unidadesPorFardo: Number(p.unidadesPorFardo || 0)
            };
        });

        // Ordenar por urgencia -> menores días restantes -> mayor ritmo de venta -> nombre
        filas.sort((a, b) => {
            if (a.prioridad !== b.prioridad) return a.prioridad - b.prioridad;
            const dA = a.diasRestantes === null ? 999999 : a.diasRestantes;
            const dB = b.diasRestantes === null ? 999999 : b.diasRestantes;
            if (dA !== dB) return dA - dB;
            if (b.velocidadDiaria !== a.velocidadDiaria) return b.velocidadDiaria - a.velocidadDiaria;
            return a.nombre.localeCompare(b.nombre, 'es');
        });

        const totalAgotados = filas.filter(f => f.estado === 'AGOTADO').length;
        const totalCriticos = filas.filter(f => f.estado === 'CRITICO').length;
        const totalPronto = filas.filter(f => f.estado === 'PRONTO').length;
        const totalStockBajo = filas.filter(f => f.estado === 'STOCK_BAJO').length;
        const urgentesCount = totalAgotados + totalCriticos;

        return {
            generadoEn: new Date(),
            ventanaDias,
            diasCobertura,
            umbralMinimo,
            tasaBCV,
            ventasValidasEnVentana,
            filas,
            resumen: {
                totalProductos: filas.length,
                totalAgotados,
                totalCriticos,
                totalPronto,
                totalStockBajo,
                urgentesCount,
                totalAReponer: filas.filter(f => f.necesitaReposicion).length
            }
        };
    }

    /**
     * Obtiene la cantidad final a pedir para un producto (editada por usuario o sugerida)
     */
    function obtenerCantidadPedir(fila) {
        if (Object.prototype.hasOwnProperty.call(state.cantidadesEditadas, fila.id)) {
            return Math.max(0, Number(state.cantidadesEditadas[fila.id]) || 0);
        }
        return fila.cantidadSugerida;
    }

    function estaSeleccionado(fila) {
        if (Object.prototype.hasOwnProperty.call(state.seleccionados, fila.id)) {
            return Boolean(state.seleccionados[fila.id]);
        }
        return Boolean(fila.necesitaReposicion && obtenerCantidadPedir(fila) > 0);
    }

    function obtenerFilasFiltradas(analisis) {
        const q = normalizarTexto(state.busqueda);
        return analisis.filas.filter(f => {
            if (state.filtroEstado === 'reponer' && !f.necesitaReposicion) return false;
            if (state.filtroEstado === 'criticos' && f.estado !== 'AGOTADO' && f.estado !== 'CRITICO') return false;
            if (q) {
                const hay = normalizarTexto(`${f.codigo} ${f.nombre} ${f.categoria} ${f.proveedor} ${f.medida}`);
                if (!hay.includes(q)) return false;
            }
            return true;
        });
    }

    function obtenerItemsSeleccionadosParaDescargar() {
        const analisis = state.ultimoAnalisis || calcularPrediccionReposicion();
        return analisis.filas
            .filter(f => estaSeleccionado(f) && obtenerCantidadPedir(f) > 0)
            .map(f => {
                const cantPedir = obtenerCantidadPedir(f);
                const subtotalUSD = Number((cantPedir * f.costoUnitUSD).toFixed(2));
                const subtotalVES = Number((subtotalUSD * analisis.tasaBCV).toFixed(2));
                return { ...f, cantPedir, subtotalUSD, subtotalVES };
            });
    }

    function formatearDiasRestantes(fila) {
        if (fila.stockActual <= 0) return 'Agotado (0 d)';
        if (fila.diasRestantes === null) return 'Sin ventas rec.';
        if (fila.diasRestantes < 1) return '< 1 día';
        if (fila.diasRestantes >= 60) return '+60 días';
        const redondeado = fila.diasRestantes < 10
            ? fila.diasRestantes.toFixed(1).replace('.0', '')
            : Math.round(fila.diasRestantes).toString();
        return `~${redondeado} ${redondeado === '1' ? 'día' : 'días'}`;
    }

    function etiquetaEstado(estado) {
        switch (estado) {
            case 'AGOTADO': return 'Agotado';
            case 'CRITICO': return 'Urgente (≤3d)';
            case 'PRONTO': return 'Reponer pronto';
            case 'STOCK_BAJO': return 'Stock bajo';
            default: return 'Stock saludable';
        }
    }

    function notificar(mensaje, tipo = 'info') {
        if (window.InventoryApp?.Modal?.toast) {
            window.InventoryApp.Modal.toast(mensaje, tipo);
        } else if (typeof window.mostrarNotificacionToast === 'function') {
            window.mostrarNotificacionToast(mensaje, tipo);
        } else {
            alert(mensaje);
        }
    }

    /**
     * Inyecta estilos propios del modal una sola vez (limpios, responsivos y coherentes con el sistema)
     */
    function asegurarEstilosModal() {
        if (document.getElementById('reposicion-compras-styles')) return;
        const style = document.createElement('style');
        style.id = 'reposicion-compras-styles';
        style.textContent = `
            #modal-reposicion-compras .rep-modal-box {
                max-width: 1120px;
                width: 96%;
                max-height: 92vh;
                display: flex;
                flex-direction: column;
                padding: 0;
                overflow: hidden;
                border-radius: 16px;
            }
            .rep-header {
                padding: 18px 22px;
                background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
                color: #ffffff;
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 14px;
            }
            .rep-header h3 {
                margin: 0;
                font-size: 1.15rem;
                font-weight: 800;
                display: flex;
                align-items: center;
                gap: 10px;
                color: #ffffff;
            }
            .rep-header p {
                margin: 5px 0 0;
                font-size: 0.84rem;
                color: #cbd5e1;
                line-height: 1.35;
            }
            .rep-close-btn {
                background: rgba(255,255,255,0.14);
                border: 1px solid rgba(255,255,255,0.25);
                color: #ffffff;
                width: 34px;
                height: 34px;
                border-radius: 50%;
                cursor: pointer;
                font-size: 1.2rem;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                transition: background 0.15s ease;
            }
            .rep-close-btn:hover { background: rgba(255,255,255,0.26); }

            .rep-body {
                padding: 16px 20px;
                overflow-y: auto;
                flex: 1;
                background: #f8fafc;
            }
            .rep-kpis {
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                gap: 10px;
                margin-bottom: 14px;
            }
            .rep-kpi {
                background: #ffffff;
                border: 1px solid #e2e8f0;
                border-left: 4px solid #3b82f6;
                border-radius: 10px;
                padding: 10px 12px;
            }
            .rep-kpi-label {
                font-size: 0.72rem;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.03em;
                color: #64748b;
            }
            .rep-kpi-val {
                font-size: 1.25rem;
                font-weight: 800;
                color: #0f172a;
                margin-top: 2px;
                font-variant-numeric: tabular-nums;
            }
            .rep-kpi-sub {
                font-size: 0.75rem;
                color: #64748b;
                margin-top: 2px;
                font-variant-numeric: tabular-nums;
            }
            .rep-controls {
                background: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                padding: 12px 14px;
                margin-bottom: 14px;
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                align-items: flex-end;
            }
            .rep-ctrl-group {
                display: flex;
                flex-direction: column;
                gap: 4px;
                min-width: 145px;
            }
            .rep-ctrl-group label {
                font-size: 0.73rem;
                font-weight: 700;
                color: #475569;
            }
            .rep-ctrl-group select,
            .rep-ctrl-group input[type="text"] {
                height: 36px;
                padding: 0 10px;
                border: 1px solid #cbd5e1;
                border-radius: 8px;
                font-size: 0.85rem;
                background: #ffffff;
                color: #0f172a;
            }
            .rep-ctrl-search {
                flex: 1;
                min-width: 190px;
            }
            .rep-toolbar-mini {
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 8px;
                margin-bottom: 10px;
                font-size: 0.82rem;
                color: #475569;
            }
            .rep-table-wrap {
                background: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                overflow: hidden;
            }
            .rep-table-scroll {
                overflow-x: auto;
            }
            .rep-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 0.85rem;
            }
            .rep-table th {
                background: #f1f5f9;
                color: #334155;
                font-weight: 700;
                font-size: 0.75rem;
                text-transform: uppercase;
                letter-spacing: 0.02em;
                padding: 10px 10px;
                text-align: left;
                border-bottom: 1px solid #e2e8f0;
                white-space: nowrap;
            }
            .rep-table td {
                padding: 10px;
                border-bottom: 1px solid #f1f5f9;
                vertical-align: middle;
                color: #0f172a;
            }
            .rep-table tr:hover td { background: #f8fafc; }
            .rep-table tr.rep-row-unchecked td { opacity: 0.55; }
            .rep-num { text-align: right !important; font-variant-numeric: tabular-nums; white-space: nowrap; }

            .rep-status-tag {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                padding: 3px 8px;
                border-radius: 6px;
                font-size: 0.74rem;
                font-weight: 700;
                white-space: nowrap;
            }
            .rep-st-AGOTADO { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
            .rep-st-CRITICO { background: #ffedd5; color: #c2410c; border: 1px solid #fed7aa; }
            .rep-st-PRONTO { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
            .rep-st-STOCK_BAJO { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
            .rep-st-SALUDABLE { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }

            .rep-stepper {
                display: inline-flex;
                align-items: center;
                border: 1px solid #cbd5e1;
                border-radius: 8px;
                overflow: hidden;
                background: #ffffff;
            }
            .rep-stepper button {
                width: 28px;
                height: 30px;
                border: none;
                background: #f1f5f9;
                color: #0f172a;
                font-weight: 800;
                cursor: pointer;
                font-size: 0.95rem;
            }
            .rep-stepper button:hover { background: #e2e8f0; }
            .rep-stepper input {
                width: 52px;
                height: 30px;
                border: none;
                border-left: 1px solid #e2e8f0;
                border-right: 1px solid #e2e8f0;
                text-align: center;
                font-weight: 800;
                font-size: 0.88rem;
                color: #0f172a;
                font-variant-numeric: tabular-nums;
            }
            .rep-mobile-cards { display: none; }

            .rep-footer {
                padding: 14px 20px;
                background: #ffffff;
                border-top: 1px solid #e2e8f0;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 10px;
            }
            .rep-footer-summary {
                font-size: 0.86rem;
                color: #334155;
            }
            .rep-footer-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                align-items: center;
            }
            .rep-btn-dl {
                display: inline-flex;
                align-items: center;
                gap: 7px;
                padding: 9px 14px;
                border-radius: 9px;
                font-weight: 700;
                font-size: 0.84rem;
                cursor: pointer;
                border: 1px solid transparent;
                transition: transform 0.1s ease, filter 0.15s ease;
            }
            .rep-btn-dl:hover { filter: brightness(0.95); }
            .rep-btn-dl:active { transform: scale(0.98); }
            .rep-btn-xlsx { background: #15803d; color: #ffffff; }
            .rep-btn-txt { background: #1e3a8a; color: #ffffff; }
            .rep-btn-csv { background: #f1f5f9; color: #0f172a; border-color: #cbd5e1; }
            .rep-btn-wa { background: #16a34a; color: #ffffff; }

            @media (max-width: 820px) {
                .rep-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                .rep-table-wrap { display: none; }
                .rep-mobile-cards {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .rep-m-card {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 12px;
                }
                .rep-m-card.rep-row-unchecked { opacity: 0.55; }
                .rep-m-top {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 8px;
                }
                .rep-m-metrics {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 6px;
                    margin: 10px 0;
                    padding: 8px;
                    background: #f8fafc;
                    border-radius: 8px;
                    font-size: 0.78rem;
                }
                .rep-m-bottom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                    border-top: 1px solid #f1f5f9;
                    padding-top: 10px;
                }
                .rep-footer-actions { width: 100%; }
                .rep-btn-dl { flex: 1; justify-content: center; }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Crea el contenedor del modal en el DOM si aún no existe
     */
    function asegurarModalDOM() {
        asegurarEstilosModal();
        let modal = document.getElementById('modal-reposicion-compras');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'modal-reposicion-compras';
        modal.className = 'modal';
        modal.onclick = function (ev) {
            if (ev.target === modal) cerrarModalReposicionCompras();
        };

        modal.innerHTML = `
            <div class="modal-content rep-modal-box">
                <div class="rep-header">
                    <div>
                        <h3><i class="fas fa-cart-flatbed"></i> Predicción de Agotamiento &amp; Lista de Compras</h3>
                        <p id="rep-subtitle">Analiza tu ritmo real de ventas y descarga tu lista sugerida para el proveedor.</p>
                    </div>
                    <button type="button" class="rep-close-btn" onclick="cerrarModalReposicionCompras()" title="Cerrar">&times;</button>
                </div>

                <div class="rep-body">
                    <div class="rep-kpis" id="rep-kpis-container"></div>

                    <div class="rep-controls">
                        <div class="rep-ctrl-group">
                            <label for="rep-sel-ventana">Base de ventas</label>
                            <select id="rep-sel-ventana" onchange="window._repCambiarParametro('ventanaDias', this.value)">
                                <option value="7">Últimos 7 días</option>
                                <option value="14" selected>Últimos 14 días</option>
                                <option value="30">Últimos 30 días</option>
                            </select>
                        </div>
                        <div class="rep-ctrl-group">
                            <label for="rep-sel-cobertura">Stock a cubrir</label>
                            <select id="rep-sel-cobertura" onchange="window._repCambiarParametro('diasCobertura', this.value)">
                                <option value="7" selected>Para 7 días (1 sem.)</option>
                                <option value="14">Para 14 días (2 sem.)</option>
                                <option value="21">Para 21 días (3 sem.)</option>
                                <option value="30">Para 30 días (1 mes)</option>
                            </select>
                        </div>
                        <div class="rep-ctrl-group">
                            <label for="rep-sel-filtro">Mostrar</label>
                            <select id="rep-sel-filtro" onchange="window._repCambiarParametro('filtroEstado', this.value)">
                                <option value="reponer" selected>Necesitan reposición</option>
                                <option value="criticos">Solo agotados y urgentes (≤3d)</option>
                                <option value="todos">Todo el inventario</option>
                            </select>
                        </div>
                        <div class="rep-ctrl-group rep-ctrl-search">
                            <label for="rep-input-buscar">Buscar producto / categoría / proveedor</label>
                            <input type="text" id="rep-input-buscar" placeholder="Ej: Harina, Bebidas, PROD-005..." oninput="window._repCambiarParametro('busqueda', this.value)">
                        </div>
                    </div>

                    <div class="rep-toolbar-mini">
                        <label style="display:inline-flex; align-items:center; gap:7px; cursor:pointer; font-weight:600;">
                            <input type="checkbox" id="rep-chk-sin-ventas" checked onchange="window._repCambiarParametro('incluirSinVentasBajos', this.checked)">
                            Incluir productos con stock bajo aunque no hayan vendido recientemente
                        </label>
                        <div style="display:flex; gap:8px; align-items:center;">
                            <button type="button" class="btn btn-sm btn-outline" onclick="window._repSeleccionarVisibles(true)" style="padding:4px 10px; font-size:0.78rem;">Marcar visibles</button>
                            <button type="button" class="btn btn-sm btn-outline" onclick="window._repSeleccionarVisibles(false)" style="padding:4px 10px; font-size:0.78rem;">Desmarcar visibles</button>
                            <button type="button" class="btn btn-sm btn-outline" onclick="window._repRestablecerSugerencias()" style="padding:4px 10px; font-size:0.78rem;" title="Volver a las cantidades calculadas automáticamente"><i class="fas fa-rotate-left"></i> Recalcular</button>
                        </div>
                    </div>

                    <div class="rep-table-wrap">
                        <div class="rep-table-scroll">
                            <table class="rep-table">
                                <thead>
                                    <tr>
                                        <th style="width:36px; text-align:center;">
                                            <input type="checkbox" id="rep-chk-all" onchange="window._repSeleccionarVisibles(this.checked)" title="Seleccionar / deseleccionar visibles">
                                        </th>
                                        <th>Producto</th>
                                        <th class="rep-num">Stock</th>
                                        <th class="rep-num">Ritmo Venta</th>
                                        <th>Días Restantes</th>
                                        <th style="text-align:center;">Cant. a Pedir</th>
                                        <th class="rep-num">Costo Unit.</th>
                                        <th class="rep-num">Subtotal Est.</th>
                                    </tr>
                                </thead>
                                <tbody id="rep-tbody"></tbody>
                            </table>
                        </div>
                    </div>

                    <div id="rep-mobile-cards" class="rep-mobile-cards"></div>
                </div>

                <div class="rep-footer">
                    <div class="rep-footer-summary" id="rep-footer-summary"></div>
                    <div class="rep-footer-actions">
                        <button type="button" class="rep-btn-dl rep-btn-xlsx" onclick="descargarListaComprasExcel()">
                            <i class="fas fa-file-excel"></i> Descargar Excel (.xlsx)
                        </button>
                        <button type="button" class="rep-btn-dl rep-btn-txt" onclick="descargarListaComprasTXT()">
                            <i class="fas fa-file-lines"></i> Descargar Lista (.txt)
                        </button>
                        <button type="button" class="rep-btn-dl rep-btn-csv" onclick="descargarListaComprasCSV()">
                            <i class="fas fa-file-csv"></i> CSV
                        </button>
                        <button type="button" class="rep-btn-dl rep-btn-wa" onclick="copiarListaComprasWhatsApp()">
                            <i class="fab fa-whatsapp"></i> Copiar WhatsApp
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        return modal;
    }

    function renderizarModalReposicion() {
        const analisis = calcularPrediccionReposicion();
        state.ultimoAnalisis = analisis;

        const sub = document.getElementById('rep-subtitle');
        if (sub) {
            sub.textContent = `Basado en ${analisis.ventasValidasEnVentana} ventas de los últimos ${analisis.ventanaDias} días · Meta: cubrir ${analisis.diasCobertura} días · Tasa BCV: Bs. ${analisis.tasaBCV.toFixed(2)}`;
        }

        const selItems = obtenerItemsSeleccionadosParaDescargar();
        const totalUnidadesPedir = selItems.reduce((acc, it) => acc + it.cantPedir, 0);
        const totalInversionUSD = selItems.reduce((acc, it) => acc + it.subtotalUSD, 0);
        const totalInversionVES = totalInversionUSD * analisis.tasaBCV;

        const kpisEl = document.getElementById('rep-kpis-container');
        if (kpisEl) {
            kpisEl.innerHTML = `
                <div class="rep-kpi" style="border-left-color:#dc2626;">
                    <div class="rep-kpi-label">Agotados hoy</div>
                    <div class="rep-kpi-val" style="color:#dc2626;">${analisis.resumen.totalAgotados}</div>
                    <div class="rep-kpi-sub">Stock en 0 unidades</div>
                </div>
                <div class="rep-kpi" style="border-left-color:#ea580c;">
                    <div class="rep-kpi-label">Se agotan en ≤ 3 días</div>
                    <div class="rep-kpi-val" style="color:#c2410c;">${analisis.resumen.totalCriticos}</div>
                    <div class="rep-kpi-sub">+ ${analisis.resumen.totalPronto} para reponer pronto</div>
                </div>
                <div class="rep-kpi" style="border-left-color:#2563eb;">
                    <div class="rep-kpi-label">En tu lista de compras</div>
                    <div class="rep-kpi-val" style="color:#1d4ed8;">${selItems.length} prod.</div>
                    <div class="rep-kpi-sub">${totalUnidadesPedir} unidades totales</div>
                </div>
                <div class="rep-kpi" style="border-left-color:#15803d;">
                    <div class="rep-kpi-label">Inversión estimada</div>
                    <div class="rep-kpi-val" style="color:#15803d;">$${totalInversionUSD.toFixed(2)}</div>
                    <div class="rep-kpi-sub">Bs. ${totalInversionVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
            `;
        }

        const filasVisibles = obtenerFilasFiltradas(analisis);
        const tbody = document.getElementById('rep-tbody');
        const mobileWrap = document.getElementById('rep-mobile-cards');
        const chkAll = document.getElementById('rep-chk-all');

        if (chkAll) {
            chkAll.checked = filasVisibles.length > 0 && filasVisibles.every(f => estaSeleccionado(f));
        }

        if (filasVisibles.length === 0) {
            const emptyMsg = state.filtroEstado === 'reponer'
                ? '¡Excelente! No hay productos urgentes por reponer con los parámetros actuales.'
                : 'No se encontraron productos que coincidan con este filtro.';
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align:center; padding:34px 16px; color:#64748b;">
                            <i class="fas fa-circle-check" style="font-size:2rem; color:#16a34a; margin-bottom:8px; display:block;"></i>
                            <strong>${escaparHtml(emptyMsg)}</strong>
                        </td>
                    </tr>
                `;
            }
            if (mobileWrap) {
                mobileWrap.innerHTML = `
                    <div style="text-align:center; padding:28px 14px; background:#fff; border-radius:12px; border:1px solid #e2e8f0; color:#64748b;">
                        <i class="fas fa-circle-check" style="font-size:1.8rem; color:#16a34a; margin-bottom:8px; display:block;"></i>
                        <strong>${escaparHtml(emptyMsg)}</strong>
                    </div>
                `;
            }
        } else {
            if (tbody) {
                tbody.innerHTML = filasVisibles.map(f => {
                    const checked = estaSeleccionado(f);
                    const qty = obtenerCantidadPedir(f);
                    const subUSD = qty * f.costoUnitUSD;
                    const ritmoStr = f.velocidadDiaria > 0
                        ? `${f.velocidadDiaria.toFixed(1)}/día`
                        : '0/día';
                    const vendidoSub = f.vendidoPeriodo > 0
                        ? `${f.vendidoPeriodo} und. en ${analisis.ventanaDias}d`
                        : `Sin ventas en ${analisis.ventanaDias}d`;
                    const provHtml = f.proveedor
                        ? `<span style="color:#0369a1; font-weight:600;"> · ${escaparHtml(f.proveedor)}</span>`
                        : '';
                    const idEsc = escaparHtml(f.id);

                    return `
                        <tr class="${checked ? '' : 'rep-row-unchecked'}">
                            <td style="text-align:center;">
                                <input type="checkbox" ${checked ? 'checked' : ''} onchange="window._repToggleItem('${idEsc}', this.checked)">
                            </td>
                            <td>
                                <div style="font-weight:700; color:#0f172a;">${escaparHtml(f.nombre)}</div>
                                <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">
                                    ${escaparHtml(f.codigo)} · ${escaparHtml(f.categoria)}${provHtml}
                                </div>
                            </td>
                            <td class="rep-num" style="font-weight:800; color:${f.stockActual <= 0 ? '#dc2626' : '#0f172a'};">
                                ${f.stockActual}
                            </td>
                            <td class="rep-num">
                                <div style="font-weight:700;">${ritmoStr}</div>
                                <div style="font-size:0.72rem; color:#64748b;">${vendidoSub}</div>
                            </td>
                            <td>
                                <span class="rep-status-tag rep-st-${f.estado}">
                                    ${escaparHtml(formatearDiasRestantes(f))}
                                </span>
                                <div style="font-size:0.71rem; color:#64748b; margin-top:2px;">${etiquetaEstado(f.estado)}</div>
                            </td>
                            <td style="text-align:center;">
                                <div class="rep-stepper">
                                    <button type="button" onclick="window._repAjustarCantidad('${idEsc}', -1)" title="Restar 1">&minus;</button>
                                    <input type="number" min="0" max="9999" value="${qty}" onchange="window._repFijarCantidad('${idEsc}', this.value)" aria-label="Cantidad a pedir">
                                    <button type="button" onclick="window._repAjustarCantidad('${idEsc}', 1)" title="Sumar 1">+</button>
                                </div>
                            </td>
                            <td class="rep-num">$${f.costoUnitUSD.toFixed(2)}</td>
                            <td class="rep-num">
                                <div style="font-weight:800; color:#0f172a;">$${subUSD.toFixed(2)}</div>
                                <div style="font-size:0.72rem; color:#64748b;">Bs. ${(subUSD * analisis.tasaBCV).toFixed(2)}</div>
                            </td>
                        </tr>
                    `;
                }).join('');
            }

            if (mobileWrap) {
                mobileWrap.innerHTML = filasVisibles.map(f => {
                    const checked = estaSeleccionado(f);
                    const qty = obtenerCantidadPedir(f);
                    const subUSD = qty * f.costoUnitUSD;
                    const idEsc = escaparHtml(f.id);

                    return `
                        <div class="rep-m-card ${checked ? '' : 'rep-row-unchecked'}">
                            <div class="rep-m-top">
                                <label style="display:flex; align-items:flex-start; gap:8px; cursor:pointer; flex:1;">
                                    <input type="checkbox" ${checked ? 'checked' : ''} onchange="window._repToggleItem('${idEsc}', this.checked)" style="margin-top:3px; width:18px; height:18px;">
                                    <div>
                                        <div style="font-weight:800; color:#0f172a; font-size:0.92rem;">${escaparHtml(f.nombre)}</div>
                                        <div style="font-size:0.75rem; color:#64748b;">${escaparHtml(f.codigo)} · ${escaparHtml(f.categoria)}${f.proveedor ? ' · ' + escaparHtml(f.proveedor) : ''}</div>
                                    </div>
                                </label>
                                <span class="rep-status-tag rep-st-${f.estado}">${escaparHtml(formatearDiasRestantes(f))}</span>
                            </div>
                            <div class="rep-m-metrics">
                                <div><span style="color:#64748b; display:block;">Stock actual</span><strong>${f.stockActual} und.</strong></div>
                                <div><span style="color:#64748b; display:block;">Venta (${analisis.ventanaDias}d)</span><strong>${f.vendidoPeriodo} (${f.velocidadDiaria.toFixed(1)}/d)</strong></div>
                                <div><span style="color:#64748b; display:block;">Costo unit.</span><strong>$${f.costoUnitUSD.toFixed(2)}</strong></div>
                            </div>
                            <div class="rep-m-bottom">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <span style="font-size:0.78rem; font-weight:700; color:#475569;">Pedir:</span>
                                    <div class="rep-stepper">
                                        <button type="button" onclick="window._repAjustarCantidad('${idEsc}', -1)">&minus;</button>
                                        <input type="number" min="0" max="9999" value="${qty}" onchange="window._repFijarCantidad('${idEsc}', this.value)">
                                        <button type="button" onclick="window._repAjustarCantidad('${idEsc}', 1)">+</button>
                                    </div>
                                </div>
                                <div style="text-align:right;">
                                    <div style="font-weight:800; color:#15803d;">$${subUSD.toFixed(2)}</div>
                                    <div style="font-size:0.72rem; color:#64748b;">Bs. ${(subUSD * analisis.tasaBCV).toFixed(2)}</div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        const footerSum = document.getElementById('rep-footer-summary');
        if (footerSum) {
            footerSum.innerHTML = `<strong>${selItems.length}</strong> productos seleccionados · <strong>${totalUnidadesPedir}</strong> unidades · Est.: <strong style="color:#15803d;">$${totalInversionUSD.toFixed(2)}</strong> <span style="color:#64748b;">(Bs. ${totalInversionVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>`;
        }
    }

    // =========================================================================
    // CONTROLES INTERACTIVOS DEL MODAL
    // =========================================================================

    function abrirModalReposicionCompras() {
        const modal = asegurarModalDOM();
        const selV = document.getElementById('rep-sel-ventana');
        const selC = document.getElementById('rep-sel-cobertura');
        const selF = document.getElementById('rep-sel-filtro');
        const chkS = document.getElementById('rep-chk-sin-ventas');
        const inpB = document.getElementById('rep-input-buscar');
        if (selV) selV.value = String(state.ventanaDias);
        if (selC) selC.value = String(state.diasCobertura);
        if (selF) selF.value = state.filtroEstado;
        if (chkS) chkS.checked = state.incluirSinVentasBajos;
        if (inpB) inpB.value = state.busqueda;

        renderizarModalReposicion();
        modal.classList.add('active');
    }

    function cerrarModalReposicionCompras() {
        const modal = document.getElementById('modal-reposicion-compras');
        if (modal) modal.classList.remove('active');
    }

    window._repCambiarParametro = function (clave, valor) {
        if (clave === 'ventanaDias' || clave === 'diasCobertura') {
            state[clave] = Number(valor) || 7;
            // Al cambiar parámetros de predicción, recalcular cantidades sugeridas limpiamente
            state.cantidadesEditadas = {};
            state.seleccionados = {};
        } else if (clave === 'incluirSinVentasBajos') {
            state.incluirSinVentasBajos = Boolean(valor);
            state.seleccionados = {};
        } else {
            state[clave] = valor;
        }
        renderizarModalReposicion();
    };

    window._repToggleItem = function (prodId, checked) {
        state.seleccionados[prodId] = Boolean(checked);
        if (checked && state.ultimoAnalisis) {
            const fila = state.ultimoAnalisis.filas.find(f => f.id === prodId);
            if (fila && obtenerCantidadPedir(fila) <= 0) {
                state.cantidadesEditadas[prodId] = Math.max(1, fila.cantidadSugerida || 1);
            }
        }
        renderizarModalReposicion();
    };

    window._repAjustarCantidad = function (prodId, delta) {
        const analisis = state.ultimoAnalisis || calcularPrediccionReposicion();
        const fila = analisis.filas.find(f => f.id === prodId);
        if (!fila) return;
        const actual = obtenerCantidadPedir(fila);
        const nueva = Math.max(0, actual + Number(delta || 0));
        state.cantidadesEditadas[prodId] = nueva;
        state.seleccionados[prodId] = nueva > 0;
        renderizarModalReposicion();
    };

    window._repFijarCantidad = function (prodId, val) {
        const nueva = Math.max(0, Math.floor(Number(val) || 0));
        state.cantidadesEditadas[prodId] = nueva;
        state.seleccionados[prodId] = nueva > 0;
        renderizarModalReposicion();
    };

    window._repSeleccionarVisibles = function (marcar) {
        const analisis = state.ultimoAnalisis || calcularPrediccionReposicion();
        const visibles = obtenerFilasFiltradas(analisis);
        visibles.forEach(f => {
            state.seleccionados[f.id] = Boolean(marcar);
            if (marcar && obtenerCantidadPedir(f) <= 0) {
                state.cantidadesEditadas[f.id] = Math.max(1, f.cantidadSugerida || 1);
            }
        });
        renderizarModalReposicion();
    };

    window._repRestablecerSugerencias = function () {
        state.cantidadesEditadas = {};
        state.seleccionados = {};
        renderizarModalReposicion();
        notificar('Cantidades restablecidas a la sugerencia automática.', 'info');
    };

    // =========================================================================
    // DESCARGAS Y EXPORTACIÓN (EXCEL .XLSX, TXT, CSV Y WHATSAPP)
    // =========================================================================

    function dispararDescargaArchivo(contenido, nombreArchivo, mimeType) {
        const blob = new Blob([contenido], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombreArchivo;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 200);
    }

    function obtenerFechaArchivo() {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    function descargarListaComprasExcel() {
        const analisis = state.ultimoAnalisis || calcularPrediccionReposicion();
        const items = obtenerItemsSeleccionadosParaDescargar();
        if (!items.length) {
            notificar('Marca al menos un producto con cantidad mayor a 0 para descargar la lista.', 'warning');
            return false;
        }

        const XLSX_LIB = (typeof XLSX !== 'undefined' ? XLSX : window.XLSX);
        if (!XLSX_LIB) {
            notificar('Librería Excel no disponible sin conexión; se descargará en formato CSV compatible con Excel.', 'info');
            return descargarListaComprasCSV();
        }

        try {
            const fechaISO = obtenerFechaArchivo();
            const tasa = analisis.tasaBCV;
            const wb = XLSX_LIB.utils.book_new();

            // Hoja 1: Lista de Compras
            const header = [
                'Listo',
                'Código',
                'Producto',
                'Categoría',
                'Proveedor Habitual',
                'Stock Actual',
                `Venta (${analisis.ventanaDias}d)`,
                'Venta / Día',
                'Días Restantes',
                'Urgencia',
                'Cant. a Pedir',
                'Costo Unit. ($)',
                'Subtotal ($)',
                'Subtotal (Bs)'
            ];

            const rows = items.map(it => ([
                '[  ]',
                it.codigo,
                it.nombre,
                it.categoria,
                it.proveedor || 'Sin asignar',
                it.stockActual,
                it.vendidoPeriodo,
                Number(it.velocidadDiaria.toFixed(2)),
                formatearDiasRestantes(it),
                etiquetaEstado(it.estado),
                it.cantPedir,
                Number(it.costoUnitUSD.toFixed(2)),
                it.subtotalUSD,
                it.subtotalVES
            ]));

            const totalUnds = items.reduce((a, b) => a + b.cantPedir, 0);
            const totalUSD = Number(items.reduce((a, b) => a + b.subtotalUSD, 0).toFixed(2));
            const totalVES = Number((totalUSD * tasa).toFixed(2));

            rows.push([
                '',
                'TOTAL',
                `${items.length} productos en lista de compra`,
                '',
                `Tasa BCV: Bs. ${tasa.toFixed(2)}`,
                '',
                '',
                '',
                '',
                '',
                totalUnds,
                '',
                totalUSD,
                totalVES
            ]);

            const ws = XLSX_LIB.utils.aoa_to_sheet([header, ...rows]);
            const lastRow = rows.length + 1;

            // Fórmulas dinámicas nativas de Excel para que al editar cantidades en Excel se recalcule todo
            for (let r = 2; r < lastRow; r++) {
                ws[`M${r}`] = { t: 'n', f: `K${r}*L${r}`, v: Number(rows[r - 2][12]), z: '$#,##0.00' };
                ws[`N${r}`] = { t: 'n', f: `M${r}*${tasa}`, v: Number(rows[r - 2][13]), z: '"Bs. "#,##0.00' };
            }
            ws[`K${lastRow}`] = { t: 'n', f: `SUM(K2:K${lastRow - 1})`, v: totalUnds, z: '#,##0' };
            ws[`M${lastRow}`] = { t: 'n', f: `SUM(M2:M${lastRow - 1})`, v: totalUSD, z: '$#,##0.00' };
            ws[`N${lastRow}`] = { t: 'n', f: `SUM(N2:N${lastRow - 1})`, v: totalVES, z: '"Bs. "#,##0.00' };

            ws['!cols'] = [
                { wch: 8 },  // Listo
                { wch: 13 }, // Código
                { wch: 34 }, // Producto
                { wch: 18 }, // Categoría
                { wch: 22 }, // Proveedor
                { wch: 13 }, // Stock
                { wch: 14 }, // Venta periodo
                { wch: 12 }, // Venta/dia
                { wch: 16 }, // Días restantes
                { wch: 16 }, // Urgencia
                { wch: 14 }, // Cant a pedir
                { wch: 15 }, // Costo Unit
                { wch: 15 }, // Subtotal USD
                { wch: 18 }  // Subtotal Bs
            ];

            if (window.InventoryApp?.ExcelExporter?.aplicarDisenoEjecutivo) {
                window.InventoryApp.ExcelExporter.aplicarDisenoEjecutivo(wb, ws, 'Lista_de_Compras', {
                    headerRow: 0,
                    totalRow: lastRow - 1,
                    sheetIndex: 0,
                    orientation: 'landscape'
                });
            }
            XLSX_LIB.utils.book_append_sheet(wb, ws, 'Lista_de_Compras');

            // Hoja 2: Resumen por Proveedor
            const porProv = new Map();
            items.forEach(it => {
                const prov = it.proveedor || 'Sin proveedor asignado';
                const prev = porProv.get(prov) || { productos: 0, unidades: 0, usd: 0 };
                prev.productos += 1;
                prev.unidades += it.cantPedir;
                prev.usd += it.subtotalUSD;
                porProv.set(prov, prev);
            });

            const provHeader = ['Proveedor', 'Productos', 'Unidades a Pedir', 'Inversión Est. ($)', 'Inversión Est. (Bs)'];
            const provRows = Array.from(porProv.entries())
                .sort((a, b) => b[1].usd - a[1].usd)
                .map(([prov, d]) => [
                    prov,
                    d.productos,
                    d.unidades,
                    Number(d.usd.toFixed(2)),
                    Number((d.usd * tasa).toFixed(2))
                ]);
            provRows.push(['TOTAL GENERAL', items.length, totalUnds, totalUSD, totalVES]);

            const wsProv = XLSX_LIB.utils.aoa_to_sheet([provHeader, ...provRows]);
            wsProv['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 22 }];
            if (window.InventoryApp?.ExcelExporter?.aplicarDisenoEjecutivo) {
                window.InventoryApp.ExcelExporter.aplicarDisenoEjecutivo(wb, wsProv, 'Por_Proveedor', {
                    headerRow: 0,
                    totalRow: provRows.length,
                    sheetIndex: 1,
                    orientation: 'portrait'
                });
            }
            XLSX_LIB.utils.book_append_sheet(wb, wsProv, 'Por_Proveedor');

            const nombreArchivo = `Lista_Compras_TuBodeguita_${fechaISO}.xlsx`;
            XLSX_LIB.writeFile(wb, nombreArchivo);
            notificar(`Lista de compras descargada en Excel (${nombreArchivo}).`, 'success');
            return true;
        } catch (err) {
            console.warn('[Reposición] Error generando Excel, usando CSV fallback:', err);
            return descargarListaComprasCSV();
        }
    }

    function descargarListaComprasCSV() {
        const analisis = state.ultimoAnalisis || calcularPrediccionReposicion();
        const items = obtenerItemsSeleccionadosParaDescargar();
        if (!items.length) {
            notificar('Marca al menos un producto con cantidad mayor a 0 para descargar.', 'warning');
            return false;
        }

        const escCSV = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const encabezados = [
            'Código', 'Producto', 'Categoría', 'Proveedor', 'Stock Actual',
            `Vendidos (${analisis.ventanaDias}d)`, 'Venta/Día', 'Días Restantes',
            'Urgencia', 'Cantidad a Pedir', 'Costo Unit. USD', 'Subtotal USD', 'Subtotal Bs'
        ];

        const lineas = [encabezados.map(escCSV).join(',')];
        items.forEach(it => {
            lineas.push([
                it.codigo,
                it.nombre,
                it.categoria,
                it.proveedor || 'Sin asignar',
                it.stockActual,
                it.vendidoPeriodo,
                it.velocidadDiaria.toFixed(2),
                formatearDiasRestantes(it),
                etiquetaEstado(it.estado),
                it.cantPedir,
                it.costoUnitUSD.toFixed(2),
                it.subtotalUSD.toFixed(2),
                it.subtotalVES.toFixed(2)
            ].map(escCSV).join(','));
        });

        const fechaISO = obtenerFechaArchivo();
        const nombreArchivo = `Lista_Compras_TuBodeguita_${fechaISO}.csv`;
        dispararDescargaArchivo('\uFEFF' + lineas.join('\r\n'), nombreArchivo, 'text/csv;charset=utf-8;');
        notificar(`Lista descargada en CSV (${nombreArchivo}).`, 'success');
        return true;
    }

    function construirTextoListaCompras(formatoWhatsApp = false) {
        const analisis = state.ultimoAnalisis || calcularPrediccionReposicion();
        const items = obtenerItemsSeleccionadosParaDescargar();
        const fechaHoy = new Date().toLocaleDateString('es-VE');
        const totalUnds = items.reduce((a, b) => a + b.cantPedir, 0);
        const totalUSD = items.reduce((a, b) => a + b.subtotalUSD, 0);
        const totalVES = totalUSD * analisis.tasaBCV;

        const b = t => (formatoWhatsApp ? `*${t}*` : t);
        const grupos = [
            { key: 'AGOTADO', titulo: 'AGOTADOS (PRIORIDAD MAXIMA)' },
            { key: 'CRITICO', titulo: 'URGENTE (SE AGOTAN EN <= 3 DIAS)' },
            { key: 'PRONTO', titulo: `REPONER PRONTO (COBERTURA ${analisis.diasCobertura} DIAS)` },
            { key: 'STOCK_BAJO', titulo: 'STOCK BAJO PREVENTIVO' },
            { key: 'SALUDABLE', titulo: 'OTROS PRODUCTOS SELECCIONADOS' }
        ];

        const out = [];
        out.push(b('LISTA DE COMPRAS - TU BODEGUITA DE CONFIANZA'));
        out.push(`Fecha: ${fechaHoy} | Tasa BCV: Bs. ${analisis.tasaBCV.toFixed(2)}`);
        out.push(`Analisis: ultimos ${analisis.ventanaDias} dias | Meta: cubrir ${analisis.diasCobertura} dias`);
        out.push('----------------------------------------');

        grupos.forEach(g => {
            const sub = items.filter(it => it.estado === g.key);
            if (!sub.length) return;
            out.push('');
            out.push(b(g.titulo));
            sub.forEach(it => {
                const provTxt = it.proveedor ? ` [${it.proveedor}]` : '';
                const precioTxt = it.costoUnitUSD > 0 ? ` — Est: $${it.subtotalUSD.toFixed(2)}` : '';
                const stockTxt = it.stockActual <= 0 ? 'Stock: 0' : `Stock: ${it.stockActual}, ${formatearDiasRestantes(it)}`;
                out.push(`[ ] ${it.cantPedir}x ${it.nombre} (${it.codigo})${provTxt} | ${stockTxt}${precioTxt}`);
            });
        });

        out.push('');
        out.push('----------------------------------------');
        out.push(b(`TOTAL: ${items.length} productos | ${totalUnds} unidades`));
        out.push(b(`INVERSION ESTIMADA: $${totalUSD.toFixed(2)} USD (Bs. ${totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`));

        return out.join('\n');
    }

    function descargarListaComprasTXT() {
        const items = obtenerItemsSeleccionadosParaDescargar();
        if (!items.length) {
            notificar('Marca al menos un producto con cantidad mayor a 0 para descargar.', 'warning');
            return false;
        }
        const texto = construirTextoListaCompras(false);
        const fechaISO = obtenerFechaArchivo();
        const nombreArchivo = `Lista_Compras_TuBodeguita_${fechaISO}.txt`;
        dispararDescargaArchivo(texto, nombreArchivo, 'text/plain;charset=utf-8;');
        notificar(`Lista descargada en texto (${nombreArchivo}).`, 'success');
        return true;
    }

    async function copiarListaComprasWhatsApp() {
        const items = obtenerItemsSeleccionadosParaDescargar();
        if (!items.length) {
            notificar('Marca al menos un producto con cantidad mayor a 0 para copiar.', 'warning');
            return false;
        }
        const texto = construirTextoListaCompras(true);
        try {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                await navigator.clipboard.writeText(texto);
            } else {
                const ta = document.createElement('textarea');
                ta.value = texto;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            notificar('Lista copiada al portapapeles. Ya puedes pegarla en WhatsApp.', 'success');
            return true;
        } catch (_err) {
            notificar('No se pudo copiar automáticamente; descarga la lista en formato .txt o Excel.', 'warning');
            return false;
        }
    }

    /**
     * Actualiza el contador de alertas urgentes en el botón de "Lista de Compras" dentro de Inventario
     */
    function actualizarBadgeReposicionCompras() {
        const badge = document.getElementById('badge-reposicion-urgentes');
        if (!badge) return;
        try {
            const analisis = calcularPrediccionReposicion();
            const urgentes = analisis.resumen.urgentesCount;
            if (urgentes > 0) {
                badge.textContent = String(urgentes);
                badge.style.display = 'inline-flex';
                badge.title = `${analisis.resumen.totalAgotados} agotado(s) y ${analisis.resumen.totalCriticos} por agotarse en 3 días o menos`;
            } else {
                badge.style.display = 'none';
            }
        } catch (_e) {}
    }

    // Exportar API global
    window.calcularPrediccionReposicion = calcularPrediccionReposicion;
    window.abrirModalReposicionCompras = abrirModalReposicionCompras;
    window.cerrarModalReposicionCompras = cerrarModalReposicionCompras;
    window.descargarListaComprasExcel = descargarListaComprasExcel;
    window.descargarListaComprasCSV = descargarListaComprasCSV;
    window.descargarListaComprasTXT = descargarListaComprasTXT;
    window.copiarListaComprasWhatsApp = copiarListaComprasWhatsApp;
    window.actualizarBadgeReposicionCompras = actualizarBadgeReposicionCompras;

    window.InventoryApp.ReposicionCompras = {
        calcularPrediccionReposicion,
        abrirModalReposicionCompras,
        cerrarModalReposicionCompras,
        descargarListaComprasExcel,
        descargarListaComprasCSV,
        descargarListaComprasTXT,
        copiarListaComprasWhatsApp,
        actualizarBadgeReposicionCompras
    };

    // Actualizar el badge cuando cargue el DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(actualizarBadgeReposicionCompras, 800));
    } else {
        setTimeout(actualizarBadgeReposicionCompras, 800);
    }
})();
