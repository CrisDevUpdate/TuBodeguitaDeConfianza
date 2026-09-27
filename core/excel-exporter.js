/**
 * core/excel-exporter.js
 * Módulo Financiero Senior de Exportación y Diseño para Microsoft Excel / Google Sheets (.xlsx)
 * Diseñado con paleta ejecutiva (Azul Marino / Acero / Gris / Blanco), fórmulas dinámicas nativas,
 * Dashboard KPI integrado, formatos condicionales automáticos y optimización de impresión (Letter / 1 pág ancho).
 */
(function() {
    'use strict';

    window.InventoryApp = window.InventoryApp || {};

    /**
     * Sanitiza valores de celda cumpliendo con el límite estricto de 32,767 caracteres de Excel
     */
    function sanitizarValor(val, maxLen = 32000) {
        if (val === null || val === undefined) return '';
        if (typeof val === 'number') return isNaN(val) ? 0 : val;
        if (typeof val === 'boolean') return val;
        if (typeof val === 'object') {
            try { val = JSON.stringify(val); } catch (e) { val = String(val); }
        }
        let str = String(val);
        if (str.startsWith('data:image/') || str.startsWith('data:application/') || str.startsWith('data:video/')) {
            return `[Archivo / Imagen Base64 ~${Math.round(str.length / 1024)} KB]`;
        }
        if (str.length > maxLen) {
            return str.substring(0, maxLen - 20) + '... [TRUNCADO]';
        }
        return str;
    }

    function sanitizarDatos(lista) {
        if (!Array.isArray(lista)) return [];
        return lista.map(item => {
            if (!item || typeof item !== 'object') return item;
            const nuevo = {};
            for (const [k, v] of Object.entries(item)) {
                nuevo[k] = sanitizarValor(v);
            }
            return nuevo;
        });
    }

    /**
     * Calcula anchos generosos para legibilidad ejecutiva
     */
    function calcularAnchos(datos, padding = 4) {
        if (!datos || !datos.length) return [];
        const llaves = Object.keys(datos[0]);
        return llaves.map(k => {
            let maxLen = String(k || '').length;
            const limite = Math.min(datos.length, 120);
            for (let i = 0; i < limite; i++) {
                const rawVal = datos[i][k];
                const str = (typeof rawVal === 'string' && rawVal.startsWith('data:')) ? '[Imagen]' : String(rawVal ?? '');
                if (str.length > maxLen) maxLen = Math.min(str.length, 60);
            }
            return { wch: Math.max(maxLen + padding, 12) };
        });
    }

    /**
     * Aplica el diseño ejecutivo sobrio, paleta azul marino/acero, formatos numéricos,
     * formato condicional y configuración de impresión a cualquier hoja.
     */
    function aplicarDisenoEjecutivo(wb, ws, sheetName, config = {}) {
        if (!ws || !ws['!ref']) return;
        const XLSX_LIB = (typeof XLSX !== 'undefined' ? XLSX : window.XLSX);
        if (!XLSX_LIB) return;

        const range = XLSX_LIB.utils.decode_range(ws['!ref']);
        const headerRow = config.headerRow !== undefined ? config.headerRow : 0;
        const totalRow = config.totalRow !== undefined ? config.totalRow : -1;
        const titleRow = config.titleRow !== undefined ? config.titleRow : -1;
        const sheetIndex = config.sheetIndex !== undefined ? config.sheetIndex : 0;

        const thinBorder = {
            top: { style: 'thin', color: { rgb: 'CBD5E1' } },
            bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
            left: { style: 'thin', color: { rgb: 'CBD5E1' } },
            right: { style: 'thin', color: { rgb: 'CBD5E1' } }
        };

        const styleHeader = {
            font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '1E3A8A' } }, // Azul Marino Ejecutivo
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: {
                top: { style: 'medium', color: { rgb: '0F172A' } },
                bottom: { style: 'medium', color: { rgb: '0F172A' } },
                left: { style: 'thin', color: { rgb: '3B82F6' } },
                right: { style: 'thin', color: { rgb: '3B82F6' } }
            }
        };

        const styleTotal = {
            font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '0F172A' } },
            fill: { fgColor: { rgb: 'E2E8F0' } }, // Acero claro
            border: {
                top: { style: 'thin', color: { rgb: '64748B' } },
                bottom: { style: 'double', color: { rgb: '0F172A' } },
                left: { style: 'thin', color: { rgb: 'CBD5E1' } },
                right: { style: 'thin', color: { rgb: 'CBD5E1' } }
            },
            alignment: { vertical: 'center' }
        };

        const colNames = {};
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const hCell = ws[XLSX_LIB.utils.encode_cell({ r: headerRow, c: C })];
            colNames[C] = String(hCell ? hCell.v || '' : '');
        }

        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellAddr = XLSX_LIB.utils.encode_cell({ r: R, c: C });
                let cell = ws[cellAddr];
                if (!cell) {
                    cell = { t: 's', v: '' };
                    ws[cellAddr] = cell;
                }

                if (R === titleRow) {
                    cell.s = {
                        font: { name: 'Calibri', sz: 13, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: '0F172A' } },
                        alignment: { horizontal: 'left', vertical: 'center' },
                        border: thinBorder
                    };
                    continue;
                }

                if (R === headerRow) {
                    cell.s = styleHeader;
                    continue;
                }

                const cName = colNames[C] || '';
                const isTotal = (R === totalRow);

                // Formatos de moneda y porcentaje uniformes
                if (!cell.z) {
                    if (cName.includes('($ USD)') || cName.includes('($)') || cName.includes('Costo') || cName.includes('Precio') || cName.includes('Ganancia') || cName.includes('Valor Total') || cName.includes('Impacto') || cName.includes('Pérdida')) {
                        cell.z = '$#,##0.00';
                        if (typeof cell.v === 'number') cell.t = 'n';
                    } else if (cName.includes('(Bs)') || cName.includes('Estimado (Bs)') || cName.includes('Total Factura (Bs)') || cName.includes('Monto Abonado (Bs)') || cName.includes('Tasa')) {
                        cell.z = 'Bs. #,##0.00';
                        if (typeof cell.v === 'number') cell.t = 'n';
                    } else if (cName.includes('(%)') || cName.includes('Margen') || cName.includes('Progreso')) {
                        cell.z = '0.0%';
                        if (typeof cell.v === 'number') cell.t = 'n';
                    } else if (cName.includes('Stock') || cName.includes('Cantidad') || cName.includes('Puntos') || cName === 'N°' || cName.includes('Ítems') || cName.includes('Entrada') || cName.includes('Salida')) {
                        if (typeof cell.v === 'number') {
                            cell.z = '#,##0';
                            cell.t = 'n';
                        }
                    }
                }

                if (isTotal) {
                    const alignH = (cell.t === 'n' || cell.f) ? 'right' : 'left';
                    cell.s = {
                        ...styleTotal,
                        alignment: { ...styleTotal.alignment, horizontal: alignH }
                    };
                    continue;
                }

                // Celdas de datos con alternancia suave
                const isEven = (R % 2 === 0);
                let cellFill = isEven ? { rgb: 'FFFFFF' } : { rgb: 'F8FAFC' };
                let fontColor = { rgb: '0F172A' };
                let bold = false;
                let alignH = (cell.t === 'n' || cell.f) ? 'right' : ((cell.t === 's' && String(cell.v).length <= 16 && !cName.includes('Nombre') && !cName.includes('Detalle')) ? 'center' : 'left');

                // Formato condicional
                const valStr = String(cell.v || '').trim().toUpperCase();
                if (valStr === 'AGOTADO' || valStr === 'STOCK BAJO' || valStr === 'INACTIVO' || valStr === 'CRÍTICO' || valStr === 'BLOQUEADO') {
                    cellFill = { rgb: 'FEE2E2' };
                    fontColor = { rgb: '991B1B' };
                    bold = true;
                    alignH = 'center';
                } else if (valStr === 'CON SALDO PENDIENTE' || valStr === 'PENDIENTE') {
                    cellFill = valStr === 'CON SALDO PENDIENTE' ? { rgb: 'FFEDD5' } : { rgb: 'FEF3C7' };
                    fontColor = valStr === 'CON SALDO PENDIENTE' ? { rgb: 'C2410C' } : { rgb: '92400E' };
                    bold = true;
                    alignH = 'center';
                } else if (valStr === 'AL DÍA' || valStr === 'PAGADA' || valStr === 'DISPONIBLE' || valStr === 'ACTIVO' || valStr === 'CONFIRMADO' || valStr === 'ENTREGADO' || valStr === 'VERIFICADO') {
                    cellFill = { rgb: 'DCFCE7' };
                    fontColor = { rgb: '166534' };
                    bold = true;
                    alignH = 'center';
                }

                cell.s = {
                    font: { name: 'Calibri', sz: 10, bold, color: fontColor },
                    fill: { fgColor: cellFill },
                    border: thinBorder,
                    alignment: { horizontal: alignH, vertical: 'center', wrapText: true }
                };
            }
        }

        // Configuración de impresión: Carta (Letter), 1 página ancho, títulos repetidos y pie de página
        const numCols = range.e.c - range.s.c + 1;
        const orientacion = (numCols >= 7 || config.orientation === 'landscape') ? 'landscape' : 'portrait';

        ws['!pageSetup'] = {
            paperSize: 1, // Letter
            orientation: orientacion,
            fitToWidth: 1, // Ajustar al ancho de 1 página
            fitToHeight: 0,
            fitToPage: true
        };

        ws['!margins'] = { left: 0.5, right: 0.5, top: 0.7, bottom: 0.7, header: 0.3, footer: 0.3 };

        const fechaStr = new Date().toLocaleDateString('es-VE');
        ws['!headerFooter'] = {
            oddHeader: '&L&BTu Bodeguita de Confianza&B&RReporte Ejecutivo',
            oddFooter: '&LTu Bodeguita de Confianza - Respaldo Oficial&CFecha: ' + fechaStr + '&RPágina &P de &N'
        };

        ws['!views'] = [{ showGridLines: true }];

        if (wb && headerRow >= 0) {
            wb.Workbook = wb.Workbook || {};
            wb.Workbook.Names = wb.Workbook.Names || [];
            const rExcel = headerRow + 1;
            wb.Workbook.Names.push({
                Name: '_xlnm.Print_Titles',
                Ref: `'${sheetName}'!$${rExcel}:$${rExcel}`,
                Sheet: sheetIndex
            });
        }
    }

    /**
     * Construye la hoja principal DASHBOARD ejecutiva
     */
    function construirDashboard(wb, AppState, ctx) {
        const XLSX_LIB = (typeof XLSX !== 'undefined' ? XLSX : window.XLSX);
        const { tasaActual, fechaLegible, prodLastRow, cliLastRow, ventasLastRow, deudaTotalUSD, totalClientesDeuda, valCostoTotal, valVentaTotal, facturacionTotalUSD } = ctx;

        // Top 5 Clientes con Deuda
        const topClientesDeuda = [...ctx.dataClientes]
            .filter(c => Number(c['Saldo Deudor ($ USD)']) > 0)
            .sort((a, b) => Number(b['Saldo Deudor ($ USD)']) - Number(a['Saldo Deudor ($ USD)']))
            .slice(0, 5);

        // Top 5 Productos con Mayor Margen
        const topProductosMargen = [...ctx.dataProductos]
            .map(p => {
                const c = Number(p['Costo Unitario ($ USD)'] || 0);
                const pr = Number(p['Precio Venta ($ USD)'] || 0);
                const margenNum = pr > 0 ? (pr - c) / pr : 0;
                return { ...p, margenNum };
            })
            .sort((a, b) => b.margenNum - a.margenNum)
            .slice(0, 5);

        // Ventas por Condición
        const ventasContado = (AppState.ventas || []).filter(v => (v.tipo || v.tipoPago || '').toLowerCase().includes('contado'));
        const ventasCredito = (AppState.ventas || []).filter(v => (v.tipo || v.tipoPago || '').toLowerCase().includes('crédito') || (v.tipo || v.tipoPago || '').toLowerCase().includes('credito'));
        const totalContadoUSD = ventasContado.reduce((sum, v) => sum + Number(v.total || v.totalUSD || 0), 0);
        const totalCreditoUSD = ventasCredito.reduce((sum, v) => sum + Number(v.total || v.totalUSD || 0), 0);
        const countContado = ventasContado.length;
        const countCredito = ventasCredito.length;

        // Matriz de celdas para el Dashboard
        const wsData = [
            ['TU BODEGUITA DE CONFIANZA - DASHBOARD FINANCIERO EJECUTIVO'],
            [`Fecha de Emisión: ${fechaLegible}  |  Tasa Oficial BCV: Bs. ${tasaActual.toFixed(2)} / USD  |  Respaldo Maestro Consolidado`],
            [],
            ['', '📦 INVENTARIO VALORADO', '', '', '💳 CUENTAS POR COBRAR', '', '', '📈 FACTURACIÓN Y VENTAS', '', '', '🚨 SALUD DEL STOCK', ''],
            ['', 'Valor al Costo ($ USD)', valCostoTotal, '', 'Total Deuda ($ USD)', deudaTotalUSD, '', 'Facturación Total ($ USD)', facturacionTotalUSD, '', 'Productos Agotados', ctx.prodAgotados],
            ['', 'Valor a la Venta ($ USD)', valVentaTotal, '', 'Total Deuda Estimada (Bs)', Number((deudaTotalUSD * tasaActual).toFixed(2)), '', 'Facturación Total (Bs)', Number((facturacionTotalUSD * tasaActual).toFixed(2)), '', 'Stock Crítico (<=3 unid)', ctx.prodCriticos],
            ['', 'Ganancia Proyectada ($)', Number((valVentaTotal - valCostoTotal).toFixed(2)), '', 'Clientes con Deuda', totalClientesDeuda, '', 'Total Operaciones', (AppState.ventas || []).length, '', 'Total SKUs Catálogo', (AppState.productos || []).length],
            ['', 'Margen Global Proyectado', valVentaTotal > 0 ? (valVentaTotal - valCostoTotal) / valVentaTotal : 0, '', 'Estado Cartera', totalClientesDeuda > 0 ? 'CON SALDO PENDIENTE' : 'AL DÍA', '', 'Ticket Promedio ($ USD)', (AppState.ventas || []).length > 0 ? facturacionTotalUSD / (AppState.ventas || []).length : 0, '', 'Disponibilidad Catálogo', (AppState.productos || []).length > 0 ? ((AppState.productos || []).length - ctx.prodAgotados) / (AppState.productos || []).length : 1],
            [],
            ['', '🚨 TOP 5 CLIENTES CON MAYOR DEUDA (ALERTAS DE COBRO)', '', '', '', '', '', '📊 DISTRIBUCIÓN DE VENTAS POR CONDICIÓN', '', '', ''],
            ['', 'N°', 'Cédula / ID', 'Nombre Cliente', 'Saldo ($ USD)', 'Saldo (Bs)', 'Condición', 'Cant. Ventas', 'Total ($ USD)', 'Total (Bs)', '% Participación']
        ];

        // Filas para Top Clientes y Distribución de Ventas
        for (let i = 0; i < 5; i++) {
            const cli = topClientesDeuda[i];
            const cliRow = cli ? [
                '',
                i + 1,
                cli['Cédula / RIF / ID'] || '',
                cli['Nombre Completo / Razón Social'] || '',
                Number(cli['Saldo Deudor ($ USD)'] || 0),
                Number(cli['Saldo Deudor Estimado (Bs)'] || 0)
            ] : ['', i + 1, '-', 'Sin deudas registradas', 0, 0];

            let distRow = [];
            if (i === 0) {
                distRow = ['Contado', countContado, totalContadoUSD, Number((totalContadoUSD * tasaActual).toFixed(2)), facturacionTotalUSD > 0 ? totalContadoUSD / facturacionTotalUSD : 0];
            } else if (i === 1) {
                distRow = ['Crédito', countCredito, totalCreditoUSD, Number((totalCreditoUSD * tasaActual).toFixed(2)), facturacionTotalUSD > 0 ? totalCreditoUSD / facturacionTotalUSD : 0];
            } else if (i === 2) {
                distRow = ['TOTAL FACTURACIÓN', countContado + countCredito, facturacionTotalUSD, Number((facturacionTotalUSD * tasaActual).toFixed(2)), 1.0];
            } else {
                distRow = ['', '', '', '', ''];
            }

            wsData.push([...cliRow, ...distRow]);
        }

        wsData.push([]);
        wsData.push(['', '🏆 TOP 5 PRODUCTOS CON MAYOR MARGEN BRUTO (%)', '', '', '', '', '', '⚠️ PRODUCTOS EN RIESGO DE AGOTARSE O AGOTADOS', '', '', '']);
        wsData.push(['', 'Ranking', 'Código / SKU', 'Nombre del Producto', 'Costo ($ USD)', 'Precio ($ USD)', 'Margen (%)', 'Código', 'Producto', 'Stock Actual', 'Estado Stock']);

        // Productos Críticos / Agotados
        const prodsRiesgo = [...ctx.dataProductos]
            .filter(p => Number(p['Stock Actual'] || 0) <= 3)
            .sort((a, b) => Number(a['Stock Actual'] || 0) - Number(b['Stock Actual'] || 0))
            .slice(0, 5);

        for (let j = 0; j < 5; j++) {
            const pm = topProductosMargen[j];
            const pr = prodsRiesgo[j];

            const pMargenRow = pm ? [
                '',
                j + 1,
                pm['Código / SKU'] || '',
                pm['Nombre del Producto'] || '',
                Number(pm['Costo Unitario ($ USD)'] || 0),
                Number(pm['Precio Venta ($ USD)'] || 0),
                pm.margenNum || 0
            ] : ['', j + 1, '-', 'Sin productos', 0, 0, 0];

            const pRiesgoRow = pr ? [
                pr['Código / SKU'] || '',
                pr['Nombre del Producto'] || '',
                Number(pr['Stock Actual'] || 0),
                pr['Estado Stock'] || 'STOCK BAJO'
            ] : ['-', 'Sin productos en riesgo', 0, 'DISPONIBLE'];

            wsData.push([...pMargenRow, ...pRiesgoRow]);
        }

        const ws = XLSX_LIB.utils.aoa_to_sheet(wsData);

        // Conectar fórmulas nativas en las tarjetas KPI del Dashboard
        if (prodLastRow > 1) {
            ws['C5'] = { t: 'n', f: `SUM(Inventario_Productos!K2:K${prodLastRow})`, v: valCostoTotal, z: '$#,##0.00' };
            ws['C6'] = { t: 'n', f: `SUM(Inventario_Productos!L2:L${prodLastRow})`, v: valVentaTotal, z: '$#,##0.00' };
            ws['C7'] = { t: 'n', f: `C6-C5`, v: valVentaTotal - valCostoTotal, z: '$#,##0.00' };
            ws['C8'] = { t: 'n', f: `IFERROR(C7/C6,0)`, v: valVentaTotal > 0 ? (valVentaTotal - valCostoTotal) / valVentaTotal : 0, z: '0.0%' };
        }
        if (cliLastRow > 1) {
            ws['F5'] = { t: 'n', f: `SUM(Clientes_CuentasCobrar!F2:F${cliLastRow})`, v: deudaTotalUSD, z: '$#,##0.00' };
            ws['F6'] = { t: 'n', f: `SUM(Clientes_CuentasCobrar!G2:G${cliLastRow})`, v: deudaTotalUSD * tasaActual, z: 'Bs. #,##0.00' };
            ws['F7'] = { t: 'n', f: `COUNTIF(Clientes_CuentasCobrar!H2:H${cliLastRow},\"CON SALDO PENDIENTE\")`, v: totalClientesDeuda, z: '#,##0' };
        }
        if (ventasLastRow > 1) {
            ws['I5'] = { t: 'n', f: `SUM(Ventas_Historial!H2:H${ventasLastRow})`, v: facturacionTotalUSD, z: '$#,##0.00' };
            ws['I6'] = { t: 'n', f: `SUM(Ventas_Historial!I2:I${ventasLastRow})`, v: facturacionTotalUSD * tasaActual, z: 'Bs. #,##0.00' };
            ws['I7'] = { t: 'n', f: `COUNTA(Ventas_Historial!B2:B${ventasLastRow})`, v: (AppState.ventas || []).length, z: '#,##0' };
            ws['I8'] = { t: 'n', f: `IFERROR(I5/I7,0)`, v: (AppState.ventas || []).length > 0 ? facturacionTotalUSD / (AppState.ventas || []).length : 0, z: '$#,##0.00' };
        }
        if (prodLastRow > 1) {
            ws['L5'] = { t: 'n', f: `COUNTIF(Inventario_Productos!N2:N${prodLastRow},\"AGOTADO\")`, v: ctx.prodAgotados, z: '#,##0' };
            ws['L6'] = { t: 'n', f: `COUNTIF(Inventario_Productos!N2:N${prodLastRow},\"STOCK BAJO\")`, v: ctx.prodCriticos, z: '#,##0' };
            ws['L7'] = { t: 'n', f: `COUNTA(Inventario_Productos!B2:B${prodLastRow})`, v: (AppState.productos || []).length, z: '#,##0' };
            ws['L8'] = { t: 'n', f: `IFERROR((L7-L5)/L7,1)`, v: (AppState.productos || []).length > 0 ? ((AppState.productos || []).length - ctx.prodAgotados) / (AppState.productos || []).length : 1, z: '0.0%' };
        }

        // Estilos del Banner Superior
        ws['A1'].s = {
            font: { name: 'Calibri', sz: 15, bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '1E3A8A' } },
            alignment: { horizontal: 'center', vertical: 'center' }
        };
        ws['A2'].s = {
            font: { name: 'Calibri', sz: 10, bold: false, color: { rgb: 'E2E8F0' } },
            fill: { fgColor: { rgb: '0F172A' } },
            alignment: { horizontal: 'center', vertical: 'center' }
        };

        // Estilos de Tarjetas KPI
        const kpiCols = [
            { h: 'B4', c1: 'B', c2: 'C' },
            { h: 'E4', c1: 'E', c2: 'F' },
            { h: 'H4', c1: 'H', c2: 'I' },
            { h: 'K4', c1: 'K', c2: 'L' }
        ];
        const cardHeaderStyle = {
            font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '1E3A8A' } },
            alignment: { horizontal: 'center', vertical: 'center' }
        };
        const labelStyle = {
            font: { name: 'Calibri', sz: 9, bold: false, color: { rgb: '475569' } },
            fill: { fgColor: { rgb: 'F8FAFC' } },
            border: { top: { style: 'thin', color: { rgb: 'CBD5E1' } }, bottom: { style: 'thin', color: { rgb: 'CBD5E1' } }, left: { style: 'thin', color: { rgb: 'CBD5E1' } }, right: { style: 'thin', color: { rgb: 'CBD5E1' } } }
        };
        const valStyle = {
            font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '1E3A8A' } },
            fill: { fgColor: { rgb: 'FFFFFF' } },
            alignment: { horizontal: 'right', vertical: 'center' },
            border: { top: { style: 'thin', color: { rgb: 'CBD5E1' } }, bottom: { style: 'thin', color: { rgb: 'CBD5E1' } }, left: { style: 'thin', color: { rgb: 'CBD5E1' } }, right: { style: 'thin', color: { rgb: 'CBD5E1' } } }
        };

        kpiCols.forEach(k => {
            if (ws[k.h]) ws[k.h].s = cardHeaderStyle;
            for (let r = 5; r <= 8; r++) {
                const cL = ws[k.c1 + r];
                const cV = ws[k.c2 + r];
                if (cL) cL.s = labelStyle;
                if (cV) {
                    const isAlert = String(cV.v).includes('PENDIENTE') || (k.c2 === 'L' && (r === 5 || r === 6) && Number(cV.v) > 0);
                    cV.s = isAlert ? {
                        ...valStyle,
                        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '991B1B' } },
                        fill: { fgColor: { rgb: 'FEE2E2' } }
                    } : valStyle;
                }
            }
        });

        // Configuración de anchos de columna del Dashboard
        ws['!cols'] = [
            { wch: 3 },  // A
            { wch: 25 }, // B
            { wch: 20 }, // C
            { wch: 4 },  // D
            { wch: 25 }, // E
            { wch: 20 }, // F
            { wch: 4 },  // G
            { wch: 25 }, // H
            { wch: 20 }, // I
            { wch: 4 },  // J
            { wch: 25 }, // K
            { wch: 20 }  // L
        ];

        // Configurar opciones de impresión para el Dashboard (Carta Horizontal)
        ws['!pageSetup'] = {
            paperSize: 1,
            orientation: 'landscape',
            fitToWidth: 1,
            fitToHeight: 0,
            fitToPage: true
        };
        ws['!margins'] = { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 };
        ws['!views'] = [{ showGridLines: true }];

        XLSX_LIB.utils.book_append_sheet(wb, ws, 'DASHBOARD');
    }

    /**
     * Función principal que compila y descarga el libro Excel con todas las 16 hojas
     */
    function exportarMasterExcelCompleto(AppState, CLIENTES_OFICIALES) {
        const XLSX_LIB = (typeof XLSX !== 'undefined' ? XLSX : window.XLSX);
        if (!XLSX_LIB) {
            alert('La librería SheetJS / xlsx-js-style no está disponible.');
            return false;
        }

        try {
            const wb = XLSX_LIB.utils.book_new();
            const fechaLegible = new Date().toLocaleString('es-VE');
            const tasaActual = Number(AppState.tasaUSD_BCV || AppState.tasaActiva || 0);

            // =========================================================
            // 1. SINCRONIZACIÓN Y PREPARACIÓN DE DATOS DE CLIENTES
            // =========================================================
            if (typeof CLIENTES_OFICIALES !== 'undefined' && Array.isArray(CLIENTES_OFICIALES) && Array.isArray(AppState.clientes)) {
                CLIENTES_OFICIALES.forEach(co => {
                    const cMatch = AppState.clientes.find(c => c.id === co.id || (c.nombre && co.nombre && c.nombre.trim().toLowerCase() === co.nombre.trim().toLowerCase()));
                    if (cMatch) {
                        if ((cMatch.deudaUSD === undefined || cMatch.deudaUSD === null || cMatch.deudaUSD === 0) && co.deudaUSD > 0) {
                            const abonosList = Array.isArray(AppState.abonos) ? AppState.abonos : [];
                            const tieneAbono = abonosList.some(a => 
                                (a.clienteId === cMatch.id || a.clienteNombre === cMatch.nombre || a.clienteCedula === cMatch.cedula) &&
                                (a.estado === 'Pago agregado' || a.estado === 'Confirmado' || !a.estado)
                            );
                            if (!tieneAbono) {
                                cMatch.deudaUSD = co.deudaUSD;
                                cMatch.deudaInicialUSD = co.deudaInicialUSD;
                            }
                        }
                    }
                });
            }

            const listaClientesOrdenada = [...(AppState.clientes || [])].sort((a, b) => {
                const idA = String(a.id || '').toUpperCase();
                const idB = String(b.id || '').toUpperCase();
                const matchA = idA.match(/^CLI-(\d+)$/);
                const matchB = idB.match(/^CLI-(\d+)$/);
                if (matchA && matchB) return parseInt(matchA[1], 10) - parseInt(matchB[1], 10);
                if (matchA) return -1;
                if (matchB) return 1;
                return (a.nombre || '').localeCompare(b.nombre || '');
            });

            const dataClientes = listaClientesOrdenada.map((c, idx) => {
                let estadoFin = null;
                if (typeof window.calcularEstadoFinancieroCliente === 'function') {
                    estadoFin = window.calcularEstadoFinancieroCliente(c.id);
                }

                let saldoDeuda = 0;
                if (estadoFin && typeof estadoFin.saldoDeudaUSD === 'number') {
                    saldoDeuda = estadoFin.saldoDeudaUSD;
                } else {
                    saldoDeuda = Number(c.deudaUSD ?? c.deudaInicialUSD ?? c.saldoDeudor ?? c.deuda ?? c.saldo ?? 0);
                }

                if (saldoDeuda === 0 && typeof CLIENTES_OFICIALES !== 'undefined' && Array.isArray(CLIENTES_OFICIALES)) {
                    const co = CLIENTES_OFICIALES.find(o => o.id === c.id || (o.nombre && c.nombre && o.nombre.trim().toLowerCase() === c.nombre.trim().toLowerCase()));
                    if (co && co.deudaUSD > 0) {
                        const abonosCli = (AppState.abonos || []).filter(a => 
                            a && (a.clienteId === c.id || a.clienteNombre === c.nombre || a.clienteCedula === c.cedula) &&
                            (a.estado === 'Pago agregado' || a.estado === 'Confirmado' || !a.estado)
                        );
                        const totalAbonado = abonosCli.reduce((sum, a) => sum + Number(a.monto || a.montoUSD || 0), 0);
                        if (totalAbonado < co.deudaUSD) {
                            saldoDeuda = Number((co.deudaUSD - totalAbonado).toFixed(2));
                        }
                    }
                }

                const totalComprado = estadoFin && typeof estadoFin.totalCompradoUSD === 'number'
                    ? estadoFin.totalCompradoUSD 
                    : Number(c.totalCompradoUSD ?? c.totalComprado ?? c.compras ?? (saldoDeuda > 0 ? saldoDeuda : 0)) || 0;
                const totalAbonado = estadoFin && typeof estadoFin.totalAbonadoUSD === 'number'
                    ? estadoFin.totalAbonadoUSD 
                    : Number(c.totalAbonadoUSD ?? c.totalAbonado ?? c.abonos ?? 0) || 0;
                const saldoBs = tasaActual > 0 
                    ? Number((saldoDeuda * tasaActual).toFixed(2)) 
                    : (estadoFin && typeof estadoFin.saldoDeudaVES === 'number' ? Number((estadoFin.saldoDeudaVES || 0).toFixed(2)) : 0);

                const usuarioVinculado = (AppState.usuarios || []).find(u => 
                    u.clienteId === c.id || 
                    (u.cedula && String(u.cedula).toUpperCase() === String(c.id).toUpperCase()) ||
                    (c.cedula && String(u.cedula).toUpperCase() === String(c.cedula).toUpperCase())
                );

                const puntosAcum = Number(c.puntosAcumulados || usuarioVinculado?.puntosAcumulados || 0) || 0;
                const puntosCanj = Number(c.puntosCanjeados || usuarioVinculado?.puntosCanjeados || 0) || 0;
                const puntosDisp = Math.max(0, puntosAcum - puntosCanj);

                return {
                    'N°': idx + 1,
                    'Cédula / RIF / ID': c.cedula || c.id || '',
                    'Nombre Completo / Razón Social': c.nombre || '',
                    'Teléfono / WhatsApp': c.telefono || '',
                    'Correo Electrónico': c.email || usuarioVinculado?.email || '',
                    'Saldo Deudor ($ USD)': Number((Number(saldoDeuda) || 0).toFixed(2)),
                    'Saldo Deudor Estimado (Bs)': Number((Number(saldoBs) || 0).toFixed(2)),
                    'Estado de Cuenta': (Number(saldoDeuda) || 0) > 0 ? 'CON SALDO PENDIENTE' : 'AL DÍA',
                    'Total Compras Registradas ($ USD)': Number((Number(totalComprado) || 0).toFixed(2)),
                    'Total Abonos Realizados ($ USD)': Number((Number(totalAbonado) || 0).toFixed(2)),
                    'Puntos Acumulados': puntosAcum,
                    'Puntos Canjeados': puntosCanj,
                    'Puntos Disponibles': puntosDisp,
                    'Usuario Vinculado': usuarioVinculado ? `${usuarioVinculado.cedula} (${usuarioVinculado.nombre})` : 'Sin usuario'
                };
            });

            // =========================================================
            // 2. PREPARACIÓN DE DATOS DE PRODUCTOS E INVENTARIO
            // =========================================================
            const listaProductosOrdenada = [...(AppState.productos || [])].sort((a, b) => {
                const catA = (a.categoria || 'General').toLowerCase();
                const catB = (b.categoria || 'General').toLowerCase();
                if (catA !== catB) return catA.localeCompare(catB);
                return (a.nombre || '').localeCompare(b.nombre || '');
            });

            let prodAgotados = 0;
            let prodCriticos = 0;
            const dataProductos = listaProductosOrdenada.map((p, idx) => {
                const costo = Number(p.costo || 0);
                const precio = Number(p.precio || 0);
                const stock = Number(p.stock || 0);
                const ganancia = precio - costo;
                const margen = precio > 0 ? ((precio - costo) / precio) : 0;
                let estadoStock = 'DISPONIBLE';
                if (stock <= 0) { estadoStock = 'AGOTADO'; prodAgotados++; }
                else if (stock <= 3) { estadoStock = 'STOCK BAJO'; prodCriticos++; }

                const valCosto = Number((stock * costo).toFixed(2));
                const valVenta = Number((stock * precio).toFixed(2));
                const gananciaProyectada = Number((valVenta - valCosto).toFixed(2));

                const rawImg = String(p.imagen || p.image || '');
                const urlImg = rawImg.startsWith('data:') 
                    ? `[Imagen Base64 ~${Math.round(rawImg.length / 1024)} KB]` 
                    : rawImg.slice(0, 2000);

                return {
                    'N°': idx + 1,
                    'ID Producto': p.id || '',
                    'Código / SKU': p.codigo || '',
                    'Nombre del Producto': p.nombre || '',
                    'Categoría': p.categoria || 'General',
                    'Costo Unitario ($ USD)': Number(costo.toFixed(2)),
                    'Precio Venta ($ USD)': Number(precio.toFixed(2)),
                    'Ganancia Unitaria ($ USD)': Number(ganancia.toFixed(2)),
                    'Margen Bruto (%)': margen,
                    'Stock Actual': stock,
                    'Valor Total Costo ($ USD)': valCosto,
                    'Valor Total Venta ($ USD)': valVenta,
                    'Ganancia Proyectada ($ USD)': gananciaProyectada,
                    'Estado Stock': estadoStock,
                    'URL Imagen / Almacén': urlImg
                };
            });

            // Métricas maestras consolidadas
            const valCostoTotal = dataProductos.reduce((acc, p) => acc + (Number(p['Valor Total Costo ($ USD)']) || 0), 0);
            const valVentaTotal = dataProductos.reduce((acc, p) => acc + (Number(p['Valor Total Venta ($ USD)']) || 0), 0);
            const deudaTotalUSD = dataClientes.reduce((acc, c) => acc + (Number(c['Saldo Deudor ($ USD)']) || 0), 0);
            const totalClientesDeuda = dataClientes.filter(c => Number(c['Saldo Deudor ($ USD)']) > 0).length;
            const facturacionTotalUSD = (AppState.ventas || []).reduce((acc, v) => acc + (Number(v.total || v.totalUSD) || 0), 0);

            const prodLastRow = Math.max(dataProductos.length + 1, 2);
            const cliLastRow = Math.max(dataClientes.length + 1, 2);
            const ventasLastRow = Math.max((AppState.ventas || []).length + 1, 2);

            const contextData = {
                tasaActual,
                fechaLegible,
                prodLastRow,
                cliLastRow,
                ventasLastRow,
                valCostoTotal,
                valVentaTotal,
                deudaTotalUSD,
                totalClientesDeuda,
                facturacionTotalUSD,
                prodAgotados,
                prodCriticos,
                dataClientes,
                dataProductos
            };

            // =========================================================
            // HOJA 1: DASHBOARD EJECUTIVO & TARJETAS KPI
            // =========================================================
            construirDashboard(wb, AppState, contextData);

            // =========================================================
            // HOJA 2: RESUMEN GENERAL & PARÁMETROS MAESTROS
            // =========================================================
            const stockTotalUnidades = dataProductos.reduce((acc, p) => acc + (Number(p['Stock Actual']) || 0), 0);
            const abonosTotales = (AppState.abonos || []).reduce((acc, a) => acc + (Number(a.monto || a.montoUSD) || 0), 0);
            const comprasTotales = (AppState.facturasCompras || []).reduce((acc, f) => acc + (Number(f.totalUSD || f.total) || 0), 0);
            const puntosTotales = (AppState.usuarios || []).reduce((acc, u) => acc + (Number(u.puntosAcumulados) || 0), 0);

            const dataResumenAOA = [
                ['Indicador / Métrica', 'Valor', 'Detalles / Observaciones'],
                ['Fecha y Hora del Respaldo', fechaLegible, 'Generado desde Tu Bodeguita de Confianza'],
                ['Versión del Sistema', window.InventoryApp?.version || '4.5.0', 'Respaldo Integral Maestro Multi-Hoja'],
                ['Tasa Oficial BCV Vigente (Bs/USD)', tasaActual, `Tasa de referencia para cálculos en Bolívares (${AppState.fechaTasaBCV || 'Vigente'})`],
                ['Total de Productos en Catálogo', (AppState.productos || []).length, 'Productos registrados en inventario'],
                ['Stock Total de Unidades Físicas', stockTotalUnidades, 'Suma de unidades físicas en estantería'],
                ['Valorización de Inventario al Costo ($ USD)', valCostoTotal, 'Inversión neta en mercancía disponible'],
                ['Valorización de Inventario a Precio Venta ($ USD)', valVentaTotal, 'Ingreso proyectado en vitrina'],
                ['Margen Proyectado Bruto ($ USD)', Number((valVentaTotal - valCostoTotal).toFixed(2)), 'Ganancia bruta potencial en stock'],
                ['Total de Clientes en Directorio', (AppState.clientes || []).length, 'Clientes registrados en el sistema'],
                ['Total Cuentas por Cobrar (Deuda Clientes $ USD)', deudaTotalUSD, `Equivalente aprox: Bs. ${(deudaTotalUSD * tasaActual).toFixed(2)} (${totalClientesDeuda} clientes con saldo)`],
                ['Total de Ventas Registradas', (AppState.ventas || []).length, 'Operaciones históricas de venta'],
                ['Facturación Histórica Total ($ USD)', facturacionTotalUSD, 'Monto histórico vendido acumulado'],
                ['Total Abonos y Pagos a Deudas ($ USD)', abonosTotales, 'Monto recaudado de cuentas por cobrar'],
                ['Total Facturas de Compras Registradas', (AppState.facturasCompras || []).length, 'Facturas de reposición de proveedores'],
                ['Total Invertido en Compras ($ USD)', comprasTotales, 'Monto pagado a proveedores por reposición'],
                ['Total Proveedores Registrados', (AppState.proveedores || []).length, 'Directorio comercial de proveedores'],
                ['Cuentas Bancarias / Métodos Configurados', (AppState.cuentasBancarias || []).length, 'Canales de recepción de pagos'],
                ['Transacciones / Pagos Reportados', (AppState.transacciones || []).length, 'Conciliaciones bancarias y pagos reportados'],
                ['Movimientos Registrados en Kardex', (AppState.kardex || []).length, 'Entradas, salidas y ajustes de inventario'],
                ['Auditorías Físicas Realizadas', (AppState.auditorias || []).length, 'Revisiones y conteos físicos'],
                ['Mermas y Registros Eliminados', (AppState.eliminaciones || []).length + (AppState.clientesEliminados || []).length, 'Bajas de productos y clientes eliminados'],
                ['Total de Usuarios del Sistema', (AppState.usuarios || []).length, 'SuperAdmin, vendedores y clientes'],
                ['Total Puntos Acumulados por Clientes', puntosTotales, 'Programa de gamificación y fidelidad'],
                ['Premio del Mes Activo', AppState.premioMes?.nombre || 'No configurado', `Meta: ${AppState.premioMes?.puntosRequeridos || 600} pts (${AppState.premioMes?.vigenciaTexto || 'Vigente'})`]
            ];

            const wsResumen = XLSX_LIB.utils.aoa_to_sheet(dataResumenAOA);
            // Formatos específicos
            wsResumen['B4'] = { t: 'n', v: tasaActual, z: 'Bs. #,##0.00' };
            wsResumen['B7'] = { t: 'n', f: `SUM(Inventario_Productos!K2:K${prodLastRow})`, v: valCostoTotal, z: '$#,##0.00' };
            wsResumen['B8'] = { t: 'n', f: `SUM(Inventario_Productos!L2:L${prodLastRow})`, v: valVentaTotal, z: '$#,##0.00' };
            wsResumen['B9'] = { t: 'n', f: `B8-B7`, v: valVentaTotal - valCostoTotal, z: '$#,##0.00' };
            wsResumen['B11'] = { t: 'n', f: `SUM(Clientes_CuentasCobrar!F2:F${cliLastRow})`, v: deudaTotalUSD, z: '$#,##0.00' };
            wsResumen['B13'] = { t: 'n', f: `SUM(Ventas_Historial!H2:H${ventasLastRow})`, v: facturacionTotalUSD, z: '$#,##0.00' };

            wsResumen['!cols'] = [{ wch: 42 }, { wch: 22 }, { wch: 55 }];
            aplicarDisenoEjecutivo(wb, wsResumen, 'Resumen_General', { headerRow: 0, sheetIndex: 1 });
            XLSX_LIB.utils.book_append_sheet(wb, wsResumen, 'Resumen_General');

            // =========================================================
            // HOJA 3: INVENTARIO DE PRODUCTOS (FÓRMULAS DINÁMICAS NATIVAS)
            // =========================================================
            const dataProdFinal = dataProductos.length ? dataProductos : [{
                'N°': 1, 'ID Producto': '', 'Código / SKU': '', 'Nombre del Producto': 'Sin productos registrados',
                'Categoría': '', 'Costo Unitario ($ USD)': 0, 'Precio Venta ($ USD)': 0, 'Ganancia Unitaria ($ USD)': 0,
                'Margen Bruto (%)': 0, 'Stock Actual': 0, 'Valor Total Costo ($ USD)': 0, 'Valor Total Venta ($ USD)': 0,
                'Ganancia Proyectada ($ USD)': 0, 'Estado Stock': '', 'URL Imagen / Almacén': ''
            }];

            const wsProductos = XLSX_LIB.utils.json_to_sheet(sanitizarDatos(dataProdFinal));

            // Inyectar fórmulas dinámicas en cada fila de producto
            for (let i = 0; i < dataProdFinal.length; i++) {
                const r = i + 2;
                const p = dataProdFinal[i];
                // Ganancia Unitaria: =[@[Precio Venta]] - [@[Costo Unitario]]
                wsProductos['H' + r] = { t: 'n', f: `G${r}-F${r}`, v: Number(p['Ganancia Unitaria ($ USD)'] || 0), z: '$#,##0.00' };
                // Margen Bruto (%): =IFERROR(([@[Precio Venta]] - [@[Costo Unitario]]) / [@[Precio Venta]], 0)
                wsProductos['I' + r] = { t: 'n', f: `IFERROR((G${r}-F${r})/G${r},0)`, v: Number(p['Margen Bruto (%)'] || 0), z: '0.0%' };
                // Valor Total Costo: =[@[Stock Actual]] * [@[Costo Unitario]]
                wsProductos['K' + r] = { t: 'n', f: `J${r}*F${r}`, v: Number(p['Valor Total Costo ($ USD)'] || 0), z: '$#,##0.00' };
                // Valor Total Venta: =[@[Stock Actual]] * [@[Precio Venta]]
                wsProductos['L' + r] = { t: 'n', f: `J${r}*G${r}`, v: Number(p['Valor Total Venta ($ USD)'] || 0), z: '$#,##0.00' };
                // Ganancia Proyectada: =[@[Valor Total Venta]] - [@[Valor Total Costo]]
                wsProductos['M' + r] = { t: 'n', f: `L${r}-K${r}`, v: Number(p['Ganancia Proyectada ($ USD)'] || 0), z: '$#,##0.00' };
                // Estado Stock: =IF([@[Stock Actual]]<=0, "AGOTADO", IF([@[Stock Actual]]<=3, "STOCK BAJO", "DISPONIBLE"))
                wsProductos['N' + r] = { t: 's', f: `IF(J${r}<=0,\"AGOTADO\",IF(J${r}<=3,\"STOCK BAJO\",\"DISPONIBLE\"))`, v: String(p['Estado Stock'] || 'DISPONIBLE') };
            }

            // Fila de Totales Generales
            const totProdR = dataProdFinal.length + 2;
            wsProductos['D' + totProdR] = { t: 's', v: 'TOTAL GENERAL' };
            wsProductos['I' + totProdR] = { t: 'n', f: `IFERROR((L${totProdR}-K${totProdR})/L${totProdR},0)`, v: valVentaTotal > 0 ? (valVentaTotal - valCostoTotal) / valVentaTotal : 0, z: '0.0%' };
            wsProductos['J' + totProdR] = { t: 'n', f: `SUM(J2:J${totProdR - 1})`, v: stockTotalUnidades, z: '#,##0' };
            wsProductos['K' + totProdR] = { t: 'n', f: `SUM(K2:K${totProdR - 1})`, v: valCostoTotal, z: '$#,##0.00' };
            wsProductos['L' + totProdR] = { t: 'n', f: `SUM(L2:L${totProdR - 1})`, v: valVentaTotal, z: '$#,##0.00' };
            wsProductos['M' + totProdR] = { t: 'n', f: `SUM(M2:M${totProdR - 1})`, v: valVentaTotal - valCostoTotal, z: '$#,##0.00' };

            wsProductos['!ref'] = `A1:O${totProdR}`;
            wsProductos['!cols'] = calcularAnchos(dataProdFinal);
            aplicarDisenoEjecutivo(wb, wsProductos, 'Inventario_Productos', { headerRow: 0, totalRow: totProdR - 1, sheetIndex: 2 });
            XLSX_LIB.utils.book_append_sheet(wb, wsProductos, 'Inventario_Productos');

            // =========================================================
            // HOJA 4: CLIENTES Y CUENTAS POR COBRAR (DINÁMICA A TASA BCV)
            // =========================================================
            const dataCliFinal = dataClientes.length ? dataClientes : [{
                'N°': 1, 'Cédula / RIF / ID': '', 'Nombre Completo / Razón Social': 'Sin clientes registrados',
                'Teléfono / WhatsApp': '', 'Correo Electrónico': '', 'Saldo Deudor ($ USD)': 0, 'Saldo Deudor Estimado (Bs)': 0,
                'Estado de Cuenta': 'AL DÍA', 'Total Compras Registradas ($ USD)': 0, 'Total Abonos Realizados ($ USD)': 0,
                'Puntos Acumulados': 0, 'Puntos Canjeados': 0, 'Puntos Disponibles': 0, 'Usuario Vinculado': 'Sin usuario'
            }];

            const wsClientes = XLSX_LIB.utils.json_to_sheet(sanitizarDatos(dataCliFinal));

            // Fórmulas dinámicas: Saldo en Bs vinculado dinámicamente a la celda de la Tasa BCV (Resumen_General!$B$4)
            for (let k = 0; k < dataCliFinal.length; k++) {
                const r = k + 2;
                const c = dataCliFinal[k];
                wsClientes['G' + r] = { t: 'n', f: `F${r}*Resumen_General!$B$4`, v: Number(c['Saldo Deudor Estimado (Bs)'] || 0), z: 'Bs. #,##0.00' };
                wsClientes['H' + r] = { t: 's', f: `IF(F${r}>0,\"CON SALDO PENDIENTE\",\"AL DÍA\")`, v: String(c['Estado de Cuenta'] || 'AL DÍA') };
            }

            // Fila de Totales de Clientes
            const totCliR = dataCliFinal.length + 2;
            wsClientes['C' + totCliR] = { t: 's', v: 'TOTAL GENERAL' };
            wsClientes['F' + totCliR] = { t: 'n', f: `SUM(F2:F${totCliR - 1})`, v: deudaTotalUSD, z: '$#,##0.00' };
            wsClientes['G' + totCliR] = { t: 'n', f: `SUM(G2:G${totCliR - 1})`, v: deudaTotalUSD * tasaActual, z: 'Bs. #,##0.00' };
            wsClientes['I' + totCliR] = { t: 'n', f: `SUM(I2:I${totCliR - 1})`, z: '$#,##0.00' };
            wsClientes['J' + totCliR] = { t: 'n', f: `SUM(J2:J${totCliR - 1})`, z: '$#,##0.00' };
            wsClientes['K' + totCliR] = { t: 'n', f: `SUM(K2:K${totCliR - 1})`, z: '#,##0' };
            wsClientes['L' + totCliR] = { t: 'n', f: `SUM(L2:L${totCliR - 1})`, z: '#,##0' };
            wsClientes['M' + totCliR] = { t: 'n', f: `SUM(M2:M${totCliR - 1})`, z: '#,##0' };

            wsClientes['!ref'] = `A1:N${totCliR}`;
            wsClientes['!cols'] = calcularAnchos(dataCliFinal);
            aplicarDisenoEjecutivo(wb, wsClientes, 'Clientes_CuentasCobrar', { headerRow: 0, totalRow: totCliR - 1, sheetIndex: 3 });
            XLSX_LIB.utils.book_append_sheet(wb, wsClientes, 'Clientes_CuentasCobrar');

            // =========================================================
            // HOJA 5: CUENTAS BANCARIAS Y MÉTODOS DE PAGO
            // =========================================================
            const dataCuentas = (AppState.cuentasBancarias || []).map((cb, idx) => ({
                'N°': idx + 1,
                'ID': cb.id || '',
                'Banco': cb.banco || cb.bank || '',
                'Tipo de Método': cb.tipo || cb.type || 'Pago Móvil',
                'Titular de la Cuenta': cb.titular || '',
                'Cédula / RIF Titular': cb.cedulaRif || cb.idNumber || '',
                'Teléfono Asociado': cb.telefono || cb.phone || '',
                'Número de Cuenta': cb.cuenta || cb.account || '',
                'Correo Electrónico': cb.correo || '',
                'Estado': cb.activo !== false ? 'ACTIVO' : 'INACTIVO',
                'Instrucciones de Pago': cb.instrucciones || ''
            }));
            const dataCuentasFinal = dataCuentas.length ? dataCuentas : [{ 'N°': 1, 'ID': '', 'Banco': 'Sin cuentas registradas', 'Tipo de Método': '', 'Titular de la Cuenta': '', 'Cédula / RIF Titular': '', 'Teléfono Asociado': '', 'Número de Cuenta': '', 'Correo Electrónico': '', 'Estado': '', 'Instrucciones de Pago': '' }];
            const wsCuentas = XLSX_LIB.utils.json_to_sheet(sanitizarDatos(dataCuentasFinal));
            wsCuentas['!cols'] = calcularAnchos(dataCuentasFinal);
            aplicarDisenoEjecutivo(wb, wsCuentas, 'Cuentas_Bancarias', { headerRow: 0, sheetIndex: 4 });
            XLSX_LIB.utils.book_append_sheet(wb, wsCuentas, 'Cuentas_Bancarias');

            // =========================================================
            // HOJA 6: HISTORIAL DE VENTAS
            // =========================================================
            const dataVentas = (AppState.ventas || []).map((v, idx) => {
                const totalUSD = Number(v.total || v.totalUSD || 0);
                const tasaVenta = Number(v.tasa || v.tasaCambio || tasaActual || 0);
                const totalBs = Number(v.totalBs || (totalUSD * (tasaVenta > 0 ? tasaVenta : tasaActual)).toFixed(2));
                const cantItems = (v.items || []).reduce((acc, it) => acc + (Number(it.cantidad) || 1), 0);
                const rawItems = (v.items || []).map(it => `${it.cantidad || 1}x ${it.nombre || 'Producto'} ($${Number(it.precio || 0).toFixed(2)})`).join(' | ');

                return {
                    'N°': idx + 1,
                    'ID Venta': v.id || '',
                    'Fecha y Hora': v.fecha || '',
                    'Cédula Cliente': v.clienteCedula || v.clienteId || 'General',
                    'Nombre Cliente': v.clienteNombre || v.cliente || 'Cliente General',
                    'Condición de Pago': v.tipo || v.tipoPago || 'Contado',
                    'Estado Pago': v.estadoPago || ((v.tipo === 'Crédito' || v.tipoPago === 'Crédito') ? (v.pagada ? 'PAGADA' : 'PENDIENTE') : 'PAGADA'),
                    'Total Venta ($ USD)': Number(totalUSD.toFixed(2)),
                    'Total Venta (Bs)': Number(totalBs.toFixed(2)),
                    'Tasa Cambio (Bs/$)': Number(tasaVenta.toFixed(2)),
                    'Cantidad de Artículos': cantItems,
                    'Detalle de Productos Vendidos': rawItems.length > 25000 ? rawItems.slice(0, 25000) + '... [TRUNCADO]' : rawItems || 'Sin detalle',
                    'Vendedor / Operador': v.vendedorNombre || v.vendedor || 'Caja Principal'
                };
            });
            const dataVentasFinal = dataVentas.length ? dataVentas : [{ 'N°': 1, 'ID Venta': '', 'Fecha y Hora': '', 'Cédula Cliente': '', 'Nombre Cliente': 'Sin ventas', 'Condición de Pago': '', 'Estado Pago': '', 'Total Venta ($ USD)': 0, 'Total Venta (Bs)': 0, 'Tasa Cambio (Bs/$)': 0, 'Cantidad de Artículos': 0, 'Detalle de Productos Vendidos': '', 'Vendedor / Operador': '' }];
            const wsVentas = XLSX_LIB.utils.json_to_sheet(sanitizarDatos(dataVentasFinal));

            // Fila de totales en ventas
            const totVentasR = dataVentasFinal.length + 2;
            wsVentas['E' + totVentasR] = { t: 's', v: 'TOTALES FACTURACIÓN' };
            wsVentas['H' + totVentasR] = { t: 'n', f: `SUM(H2:H${totVentasR - 1})`, v: facturacionTotalUSD, z: '$#,##0.00' };
            wsVentas['I' + totVentasR] = { t: 'n', f: `SUM(I2:I${totVentasR - 1})`, v: facturacionTotalUSD * tasaActual, z: 'Bs. #,##0.00' };
            wsVentas['K' + totVentasR] = { t: 'n', f: `SUM(K2:K${totVentasR - 1})`, z: '#,##0' };
            wsVentas['!ref'] = `A1:M${totVentasR}`;
            wsVentas['!cols'] = calcularAnchos(dataVentasFinal);
            aplicarDisenoEjecutivo(wb, wsVentas, 'Ventas_Historial', { headerRow: 0, totalRow: totVentasR - 1, sheetIndex: 5 });
            XLSX_LIB.utils.book_append_sheet(wb, wsVentas, 'Ventas_Historial');

            // =========================================================
            // HOJA 7: PAGOS Y ABONOS A DEUDAS
            // =========================================================
            const dataAbonos = (AppState.abonos || []).map((a, idx) => {
                const montoUSD = Number(a.monto || a.montoUSD || 0);
                const tasaAbono = Number(a.tasa || tasaActual || 0);
                const montoBs = Number(a.montoBs || (montoUSD * tasaAbono).toFixed(2));
                return {
                    'N°': idx + 1,
                    'ID Abono': a.id || '',
                    'Fecha y Hora': a.fecha || '',
                    'Cédula Cliente': a.clienteCedula || a.clienteId || '',
                    'Nombre Cliente': a.clienteNombre || a.cliente || '',
                    'Monto Abonado ($ USD)': Number(montoUSD.toFixed(2)),
                    'Monto Abonado (Bs)': Number(montoBs.toFixed(2)),
                    'Tasa Aplicada (Bs/$)': Number(tasaAbono.toFixed(2)),
                    'Referencia Bancaria': a.referencia || '',
                    'Banco / Método': a.metodo || a.banco || 'Pago Móvil',
                    'Saldo Anterior ($ USD)': Number(Number(a.saldoAnterior || 0).toFixed(2)),
                    'Saldo Restante ($ USD)': Number(Number(a.saldoRestante || 0).toFixed(2)),
                    'Estado': a.estado || 'Confirmado',
                    'Registrado Por': a.usuario || 'Administración'
                };
            });
            const dataAbonosFinal = dataAbonos.length ? dataAbonos : [{ 'N°': 1, 'ID Abono': '', 'Fecha y Hora': '', 'Cédula Cliente': '', 'Nombre Cliente': 'Sin abonos', 'Monto Abonado ($ USD)': 0, 'Monto Abonado (Bs)': 0, 'Tasa Aplicada (Bs/$)': 0, 'Referencia Bancaria': '', 'Banco / Método': '', 'Saldo Anterior ($ USD)': 0, 'Saldo Restante ($ USD)': 0, 'Estado': '', 'Registrado Por': '' }];
            const wsAbonos = XLSX_LIB.utils.json_to_sheet(sanitizarDatos(dataAbonosFinal));
            const totAbonosR = dataAbonosFinal.length + 2;
            wsAbonos['E' + totAbonosR] = { t: 's', v: 'TOTAL ABONADO' };
            wsAbonos['F' + totAbonosR] = { t: 'n', f: `SUM(F2:F${totAbonosR - 1})`, v: abonosTotales, z: '$#,##0.00' };
            wsAbonos['G' + totAbonosR] = { t: 'n', f: `SUM(G2:G${totAbonosR - 1})`, z: 'Bs. #,##0.00' };
            wsAbonos['!ref'] = `A1:N${totAbonosR}`;
            wsAbonos['!cols'] = calcularAnchos(dataAbonosFinal);
            aplicarDisenoEjecutivo(wb, wsAbonos, 'Pagos_Abonos', { headerRow: 0, totalRow: totAbonosR - 1, sheetIndex: 6 });
            XLSX_LIB.utils.book_append_sheet(wb, wsAbonos, 'Pagos_Abonos');

            // =========================================================
            // HOJA 8: TRANSACCIONES POR VERIFICAR
            // =========================================================
            const dataTx = (AppState.transacciones || []).map((t, idx) => {
                const montoOrig = Number(t.monto || 0);
                const montoUSD = Number(t.montoUSD || (t.moneda === 'USD' ? montoOrig : (tasaActual > 0 ? (montoOrig / tasaActual) : 0)));
                return {
                    'N°': idx + 1,
                    'Referencia': t.referencia || t.ref || '',
                    'Fecha y Hora': t.fecha || '',
                    'Cliente': t.cliente || t.clienteNombre || '',
                    'Banco Origen': t.bancoOrigen || '',
                    'Banco Destino': t.bancoDestino || '',
                    'Monto Original': Number(montoOrig.toFixed(2)),
                    'Moneda': t.moneda || 'VES',
                    'Monto ($ USD Equiv)': Number(montoUSD.toFixed(2)),
                    'Estado': t.estado || 'PENDIENTE',
                    'Tipo Operación': t.tipo || 'Pago Reportado'
                };
            });
            const dataTxFinal = dataTx.length ? dataTx : [{ 'N°': 1, 'Referencia': '', 'Fecha y Hora': '', 'Cliente': 'Sin transacciones', 'Banco Origen': '', 'Banco Destino': '', 'Monto Original': 0, 'Moneda': 'VES', 'Monto ($ USD Equiv)': 0, 'Estado': '', 'Tipo Operación': '' }];
            const wsTx = XLSX_LIB.utils.json_to_sheet(sanitizarDatos(dataTxFinal));
            const totTxR = dataTxFinal.length + 2;
            wsTx['F' + totTxR] = { t: 's', v: 'TOTAL RECAUDADO EQUIV' };
            wsTx['I' + totTxR] = { t: 'n', f: `SUM(I2:I${totTxR - 1})`, z: '$#,##0.00' };
            wsTx['!ref'] = `A1:K${totTxR}`;
            wsTx['!cols'] = calcularAnchos(dataTxFinal);
            aplicarDisenoEjecutivo(wb, wsTx, 'Transacciones_Verificar', { headerRow: 0, totalRow: totTxR - 1, sheetIndex: 7 });
            XLSX_LIB.utils.book_append_sheet(wb, wsTx, 'Transacciones_Verificar');

            // =========================================================
            // HOJA 9: PUNTOS DE FIDELIZACIÓN
            // =========================================================
            const metaPuntos = Number(AppState.premioMes?.puntosRequeridos || 600);
            const dataPuntos = (AppState.usuarios || [])
                .filter(u => u.rol === 'cliente' || Number(u.puntosAcumulados || 0) > 0)
                .map((u, idx) => {
                    const acum = Number(u.puntosAcumulados || 0);
                    const canj = Number(u.puntosCanjeados || 0);
                    const disp = Math.max(0, acum - canj);
                    const prog = metaPuntos > 0 ? (disp / metaPuntos) : 0;
                    let nivel = 'Bronce';
                    if (disp >= 500) nivel = 'Diamante VIP';
                    else if (disp >= 300) nivel = 'Oro';
                    else if (disp >= 100) nivel = 'Plata';

                    return {
                        'N°': idx + 1,
                        'Cédula / RIF': u.cedula || '',
                        'Nombre Cliente': u.nombre || '',
                        'Teléfono (WhatsApp)': u.telefono || '',
                        'Puntos Acumulados': acum,
                        'Puntos Canjeados': canj,
                        'Puntos Disponibles': disp,
                        'Premio en Juego': AppState.premioMes?.nombre || 'Premio Fidelidad',
                        'Meta de Puntos': metaPuntos,
                        'Progreso hacia Premio (%)': prog,
                        'Nivel de Fidelidad': nivel
                    };
                }).sort((a, b) => b['Puntos Disponibles'] - a['Puntos Disponibles']);

            const dataPuntosFinal = dataPuntos.length ? dataPuntos : [{ 'N°': 1, 'Cédula / RIF': '', 'Nombre Cliente': 'Sin clientes en puntos', 'Teléfono (WhatsApp)': '', 'Puntos Acumulados': 0, 'Puntos Canjeados': 0, 'Puntos Disponibles': 0, 'Premio en Juego': '', 'Meta de Puntos': 0, 'Progreso hacia Premio (%)': 0, 'Nivel de Fidelidad': '' }];
            const wsPuntos = XLSX_LIB.utils.json_to_sheet(sanitizarDatos(dataPuntosFinal));
            const totPtsR = dataPuntosFinal.length + 2;
            wsPuntos['D' + totPtsR] = { t: 's', v: 'TOTALES' };
            wsPuntos['E' + totPtsR] = { t: 'n', f: `SUM(E2:E${totPtsR - 1})`, z: '#,##0' };
            wsPuntos['F' + totPtsR] = { t: 'n', f: `SUM(F2:F${totPtsR - 1})`, z: '#,##0' };
            wsPuntos['G' + totPtsR] = { t: 'n', f: `SUM(G2:G${totPtsR - 1})`, z: '#,##0' };
            wsPuntos['!ref'] = `A1:K${totPtsR}`;
            wsPuntos['!cols'] = calcularAnchos(dataPuntosFinal);
            aplicarDisenoEjecutivo(wb, wsPuntos, 'Puntos_Fidelizacion', { headerRow: 0, totalRow: totPtsR - 1, sheetIndex: 8 });
            XLSX_LIB.utils.book_append_sheet(wb, wsPuntos, 'Puntos_Fidelizacion');

            // =========================================================
            // HOJA 10: CANJES DE PREMIOS REALIZADOS
            // =========================================================
            const dataCanjes = (AppState.canjesPremios || []).map((c, idx) => ({
                'N°': idx + 1,
                'ID Canje': c.id || '',
                'Fecha Canje': c.fecha || '',
                'Cédula Cliente': c.clienteCedula || '',
                'Nombre Cliente': c.clienteNombre || '',
                'Premio Canjeado': c.premioNombre || c.premio || '',
                'Puntos Deducidos': Number(c.puntos || 0),
                'Estado de Entrega': c.estado || 'ENTREGADO'
            }));
            const dataCanjesFinal = dataCanjes.length ? dataCanjes : [{ 'N°': 1, 'ID Canje': '', 'Fecha Canje': '', 'Cédula Cliente': '', 'Nombre Cliente': 'Sin canjes', 'Premio Canjeado': '', 'Puntos Deducidos': 0, 'Estado de Entrega': '' }];
            const wsCanjes = XLSX_LIB.utils.json_to_sheet(sanitizarDatos(dataCanjesFinal));
            const totCanjesR = dataCanjesFinal.length + 2;
            wsCanjes['F' + totCanjesR] = { t: 's', v: 'TOTAL PUNTOS CANJEADOS' };
            wsCanjes['G' + totCanjesR] = { t: 'n', f: `SUM(G2:G${totCanjesR - 1})`, z: '#,##0' };
            wsCanjes['!ref'] = `A1:H${totCanjesR}`;
            wsCanjes['!cols'] = calcularAnchos(dataCanjesFinal);
            aplicarDisenoEjecutivo(wb, wsCanjes, 'Canjes_Premios', { headerRow: 0, totalRow: totCanjesR - 1, sheetIndex: 9 });
            XLSX_LIB.utils.book_append_sheet(wb, wsCanjes, 'Canjes_Premios');

            // =========================================================
            // HOJA 11: FACTURAS DE COMPRAS Y REPOSICIÓN
            // =========================================================
            const dataCompras = (AppState.facturasCompras || []).map((fc, idx) => {
                const totalUSD = Number(fc.totalUSD || fc.total || 0);
                const totalBs = Number(fc.totalBs || (totalUSD * tasaActual).toFixed(2));
                const itemsStr = (fc.items || []).map(it => `${it.cantidad || 1}x ${it.nombre || 'Prod'} (Costo: $${Number(it.costoUnitario || it.costo || 0).toFixed(2)})`).join(' | ');
                return {
                    'N°': idx + 1,
                    'N° Factura / Control': fc.numeroFactura || fc.id || '',
                    'Fecha de Emisión': fc.fechaEmision || fc.fecha || '',
                    'Proveedor': fc.proveedor || '',
                    'Total Factura ($ USD)': Number(totalUSD.toFixed(2)),
                    'Total Factura (Bs)': Number(totalBs.toFixed(2)),
                    'Cantidad de Ítems': (fc.items || []).length,
                    'Método de Costo': fc.metodoCosto || 'Reposición Directa',
                    'Detalle de Mercancía': itemsStr.length > 25000 ? itemsStr.slice(0, 25000) + '... [TRUNCADO]' : itemsStr || 'Sin detalle',
                    'Observaciones': fc.notas || ''
                };
            });
            const dataComprasFinal = dataCompras.length ? dataCompras : [{ 'N°': 1, 'N° Factura / Control': '', 'Fecha de Emisión': '', 'Proveedor': 'Sin compras', 'Total Factura ($ USD)': 0, 'Total Factura (Bs)': 0, 'Cantidad de Ítems': 0, 'Método de Costo': '', 'Detalle de Mercancía': '', 'Observaciones': '' }];
            const wsCompras = XLSX_LIB.utils.json_to_sheet(sanitizarDatos(dataComprasFinal));
            for (let cIdx = 0; cIdx < dataComprasFinal.length; cIdx++) {
                const r = cIdx + 2;
                wsCompras['F' + r] = { t: 'n', f: `E${r}*Resumen_General!$B$4`, v: Number(dataComprasFinal[cIdx]['Total Factura (Bs)'] || 0), z: 'Bs. #,##0.00' };
            }
            const totCompR = dataComprasFinal.length + 2;
            wsCompras['D' + totCompR] = { t: 's', v: 'TOTAL COMPRAS' };
            wsCompras['E' + totCompR] = { t: 'n', f: `SUM(E2:E${totCompR - 1})`, v: comprasTotales, z: '$#,##0.00' };
            wsCompras['F' + totCompR] = { t: 'n', f: `SUM(F2:F${totCompR - 1})`, z: 'Bs. #,##0.00' };
            wsCompras['G' + totCompR] = { t: 'n', f: `SUM(G2:G${totCompR - 1})`, z: '#,##0' };
            wsCompras['!ref'] = `A1:J${totCompR}`;
            wsCompras['!cols'] = calcularAnchos(dataComprasFinal);
            aplicarDisenoEjecutivo(wb, wsCompras, 'Facturas_Compras', { headerRow: 0, totalRow: totCompR - 1, sheetIndex: 10 });
            XLSX_LIB.utils.book_append_sheet(wb, wsCompras, 'Facturas_Compras');

            // =========================================================
            // HOJA 12: DIRECTORIO DE PROVEEDORES
            // =========================================================
            const dataProveedores = (AppState.proveedores || []).map((pr, idx) => ({
                'N°': idx + 1,
                'ID Proveedor': pr.id || '',
                'Nombre / Razón Social': pr.nombre || '',
                'RIF / Identificación': pr.rif || '',
                'Teléfono / WhatsApp': pr.telefono || '',
                'Persona de Contacto': pr.contacto || '',
                'Dirección / Ubicación': pr.direccion || '',
                'Notas Comerciales': pr.notas || '',
                'Estado': pr.activo !== false ? 'ACTIVO' : 'INACTIVO'
            }));
            const dataProveedoresFinal = dataProveedores.length ? dataProveedores : [{ 'N°': 1, 'ID Proveedor': '', 'Nombre / Razón Social': 'Sin proveedores', 'RIF / Identificación': '', 'Teléfono / WhatsApp': '', 'Persona de Contacto': '', 'Dirección / Ubicación': '', 'Notas Comerciales': '', 'Estado': '' }];
            const wsProveedores = XLSX_LIB.utils.json_to_sheet(sanitizarDatos(dataProveedoresFinal));
            wsProveedores['!cols'] = calcularAnchos(dataProveedoresFinal);
            aplicarDisenoEjecutivo(wb, wsProveedores, 'Proveedores', { headerRow: 0, sheetIndex: 11 });
            XLSX_LIB.utils.book_append_sheet(wb, wsProveedores, 'Proveedores');

            // =========================================================
            // HOJA 13: KARDEX DE MOVIMIENTOS DE INVENTARIO
            // =========================================================
            const dataKardex = (AppState.kardex || []).map((k, idx) => {
                const ent = Number(k.entrada || 0);
                const sal = Number(k.salida || 0);
                const costoU = Number(k.costo || 0);
                const valorMov = Number(((Math.max(ent, sal) || 1) * costoU).toFixed(2));
                return {
                    'N°': idx + 1,
                    'Fecha y Hora': k.fecha || '',
                    'Código Producto': k.codigo || '',
                    'Nombre del Producto': k.nombre || '',
                    'Tipo de Movimiento': k.tipo || '',
                    'Entrada (Unidades)': ent,
                    'Salida (Unidades)': sal,
                    'Stock Anterior': Number(k.stockAnterior || 0),
                    'Stock Resultante': Number(k.stockNuevo ?? k.stockResultante ?? (Number(k.stockAnterior || 0) + ent - sal)),
                    'Costo Unitario ($ USD)': Number(costoU.toFixed(2)),
                    'Valor Movimiento ($ USD)': valorMov,
                    'Referencia / Motivo': k.referencia || k.motivo || ''
                };
            });
            const dataKardexFinal = dataKardex.length ? dataKardex : [{ 'N°': 1, 'Fecha y Hora': '', 'Código Producto': '', 'Nombre del Producto': 'Sin movimientos', 'Tipo de Movimiento': '', 'Entrada (Unidades)': 0, 'Salida (Unidades)': 0, 'Stock Anterior': 0, 'Stock Resultante': 0, 'Costo Unitario ($ USD)': 0, 'Valor Movimiento ($ USD)': 0, 'Referencia / Motivo': '' }];
            const wsKardex = XLSX_LIB.utils.json_to_sheet(sanitizarDatos(dataKardexFinal));
            for (let kIdx = 0; kIdx < dataKardexFinal.length; kIdx++) {
                const r = kIdx + 2;
                wsKardex['I' + r] = { t: 'n', f: `H${r}+F${r}-G${r}`, v: Number(dataKardexFinal[kIdx]['Stock Resultante'] || 0), z: '#,##0' };
                wsKardex['K' + r] = { t: 'n', f: `MAX(F${r},G${r})*J${r}`, v: Number(dataKardexFinal[kIdx]['Valor Movimiento ($ USD)'] || 0), z: '$#,##0.00' };
            }
            const totKardexR = dataKardexFinal.length + 2;
            wsKardex['E' + totKardexR] = { t: 's', v: 'TOTALES' };
            wsKardex['F' + totKardexR] = { t: 'n', f: `SUM(F2:F${totKardexR - 1})`, z: '#,##0' };
            wsKardex['G' + totKardexR] = { t: 'n', f: `SUM(G2:G${totKardexR - 1})`, z: '#,##0' };
            wsKardex['K' + totKardexR] = { t: 'n', f: `SUM(K2:K${totKardexR - 1})`, z: '$#,##0.00' };
            wsKardex['!ref'] = `A1:L${totKardexR}`;
            wsKardex['!cols'] = calcularAnchos(dataKardexFinal);
            aplicarDisenoEjecutivo(wb, wsKardex, 'Kardex_Movimientos', { headerRow: 0, totalRow: totKardexR - 1, sheetIndex: 12 });
            XLSX_LIB.utils.book_append_sheet(wb, wsKardex, 'Kardex_Movimientos');

            // =========================================================
            // HOJA 14: AUDITORÍAS E INVENTARIO FÍSICO
            // =========================================================
            const dataAud = (AppState.auditorias || []).map((a, idx) => ({
                'N°': idx + 1,
                'ID Auditoría': a.id || '',
                'Fecha y Hora': a.fecha || '',
                'Responsable': a.responsable || '',
                'Total Productos Auditados': a.totalItems || (a.items || []).length || 0,
                'Productos con Diferencias': a.totalDiferencias || 0,
                'Impacto Económico ($ USD)': Number(Number(a.impactoUSD || a.perdidaUSD || 0).toFixed(2)),
                'Observaciones': a.observaciones || a.motivo || ''
            }));
            const dataAudFinal = dataAud.length ? dataAud : [{ 'N°': 1, 'ID Auditoría': '', 'Fecha y Hora': '', 'Responsable': 'Sin auditorías', 'Total Productos Auditados': 0, 'Productos con Diferencias': 0, 'Impacto Económico ($ USD)': 0, 'Observaciones': '' }];
            const wsAud = XLSX_LIB.utils.json_to_sheet(sanitizarDatos(dataAudFinal));
            const totAudR = dataAudFinal.length + 2;
            wsAud['D' + totAudR] = { t: 's', v: 'TOTAL IMPACTO' };
            wsAud['E' + totAudR] = { t: 'n', f: `SUM(E2:E${totAudR - 1})`, z: '#,##0' };
            wsAud['F' + totAudR] = { t: 'n', f: `SUM(F2:F${totAudR - 1})`, z: '#,##0' };
            wsAud['G' + totAudR] = { t: 'n', f: `SUM(G2:G${totAudR - 1})`, z: '$#,##0.00' };
            wsAud['!ref'] = `A1:H${totAudR}`;
            wsAud['!cols'] = calcularAnchos(dataAudFinal);
            aplicarDisenoEjecutivo(wb, wsAud, 'Auditorias_Inventario', { headerRow: 0, totalRow: totAudR - 1, sheetIndex: 13 });
            XLSX_LIB.utils.book_append_sheet(wb, wsAud, 'Auditorias_Inventario');

            // =========================================================
            // HOJA 15: MERMAS, BAJAS Y PÉRDIDAS
            // =========================================================
            const bajasYmermas = [
                ...(AppState.eliminaciones || []).map(e => ({
                    'ID Registro': e.id || '',
                    'Fecha y Hora': e.fecha || '',
                    'Código / Cédula': e.codigo || '',
                    'Nombre / Concepto': e.nombre || '',
                    'Tipo de Baja': e.tipo || 'Merma / Producto Eliminado',
                    'Cantidad': Number(e.cantidad || e.stock || 1),
                    'Pérdida Económica ($ USD)': Number(Number(e.costo || e.perdida || 0).toFixed(2)),
                    'Motivo': e.motivo || '',
                    'Registrado Por': e.usuario || 'Administración'
                })),
                ...(AppState.clientesEliminados || []).map(ce => ({
                    'ID Registro': ce.id || '',
                    'Fecha y Hora': ce.fecha || '',
                    'Código / Cédula': ce.cedula || '',
                    'Nombre / Concepto': ce.nombre || '',
                    'Tipo de Baja': 'Cliente Incobrable / Eliminado',
                    'Cantidad': 1,
                    'Pérdida Económica ($ USD)': Number(Number(ce.deuda || ce.saldo || 0).toFixed(2)),
                    'Motivo': ce.motivo || 'Cuenta incobrable',
                    'Registrado Por': ce.usuario || 'Administración'
                }))
            ].sort((a, b) => new Date(b['Fecha y Hora'] || 0) - new Date(a['Fecha y Hora'] || 0));

            const bajasYmermasFinal = bajasYmermas.length ? bajasYmermas : [{ 'ID Registro': '', 'Fecha y Hora': '', 'Código / Cédula': '', 'Nombre / Concepto': 'Sin mermas registradas', 'Tipo de Baja': '', 'Cantidad': 0, 'Pérdida Económica ($ USD)': 0, 'Motivo': '', 'Registrado Por': '' }];
            const wsMermas = XLSX_LIB.utils.json_to_sheet(sanitizarDatos(bajasYmermasFinal));
            const totMermasR = bajasYmermasFinal.length + 2;
            wsMermas['E' + totMermasR] = { t: 's', v: 'TOTAL PÉRDIDAS' };
            wsMermas['F' + totMermasR] = { t: 'n', f: `SUM(F2:F${totMermasR - 1})`, z: '#,##0' };
            wsMermas['G' + totMermasR] = { t: 'n', f: `SUM(G2:G${totMermasR - 1})`, z: '$#,##0.00' };
            wsMermas['!ref'] = `A1:I${totMermasR}`;
            wsMermas['!cols'] = calcularAnchos(bajasYmermasFinal);
            aplicarDisenoEjecutivo(wb, wsMermas, 'Mermas_Bajas', { headerRow: 0, totalRow: totMermasR - 1, sheetIndex: 14 });
            XLSX_LIB.utils.book_append_sheet(wb, wsMermas, 'Mermas_Bajas');

            // =========================================================
            // HOJA 16: USUARIOS Y ACCESO AL SISTEMA
            // =========================================================
            const rolPrio = { 'superadmin': 1, 'admin': 2, 'administrador': 2, 'vendedor': 3, 'cajero': 4, 'cliente': 5 };
            const listaUsuariosOrdenada = [...(AppState.usuarios || [])].sort((a, b) => {
                const pA = rolPrio[String(a.rol || '').toLowerCase()] || 9;
                const pB = rolPrio[String(b.rol || '').toLowerCase()] || 9;
                if (pA !== pB) return pA - pB;
                return (a.nombre || '').localeCompare(b.nombre || '');
            });

            const dataUsuarios = listaUsuariosOrdenada.map((u, idx) => ({
                'N°': idx + 1,
                'Cédula / RIF / ID': u.cedula || u.id || '',
                'Nombre y Apellido / Razón Social': u.nombre || '',
                'Teléfono': u.telefono || '',
                'Correo Electrónico': u.email || '',
                'Rol': (u.rol || 'cliente').toUpperCase(),
                'Estado de Acceso': u.estado || 'ACTIVO',
                'Puntos Acumulados': Number(u.puntosAcumulados || 0),
                'Puntos Canjeados': Number(u.puntosCanjeados || 0),
                'Fecha de Registro': u.fechaRegistro || ''
            }));
            const dataUsuariosFinal = dataUsuarios.length ? dataUsuarios : [{ 'N°': 1, 'Cédula / RIF / ID': '', 'Nombre y Apellido / Razón Social': 'Sin usuarios', 'Teléfono': '', 'Correo Electrónico': '', 'Rol': '', 'Estado de Acceso': '', 'Puntos Acumulados': 0, 'Puntos Canjeados': 0, 'Fecha de Registro': '' }];
            const wsUsuarios = XLSX_LIB.utils.json_to_sheet(sanitizarDatos(dataUsuariosFinal));
            wsUsuarios['!cols'] = calcularAnchos(dataUsuariosFinal);
            aplicarDisenoEjecutivo(wb, wsUsuarios, 'Usuarios_Sistema', { headerRow: 0, sheetIndex: 15 });
            XLSX_LIB.utils.book_append_sheet(wb, wsUsuarios, 'Usuarios_Sistema');

            // =========================================================
            // DESCARGA DEL LIBRO MAESTRO
            // =========================================================
            const nombreArchivo = `TuBodeguita_Respaldo_Ejecutivo_${new Date().toISOString().slice(0, 10)}.xlsx`;
            XLSX_LIB.writeFile(wb, nombreArchivo);

            if (typeof window.mostrarNotificacionToast === 'function') {
                window.mostrarNotificacionToast(`✅ Master Excel generado con éxito (${nombreArchivo}) con Dashboard y Fórmulas`, 'success');
            }

            return true;
        } catch (e) {
            console.error('Error al exportar máster Excel profesional:', e);
            alert('Error al generar el libro máster Excel: ' + e.message);
            return false;
        }
    }

    window.InventoryApp.ExcelExporter = {
        sanitizarValor,
        sanitizarDatos,
        calcularAnchos,
        aplicarDisenoEjecutivo,
        exportarMasterExcelCompleto
    };
})();
