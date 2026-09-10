import React, { useState, useMemo, useCallback } from 'react';

/**
 * /components/PhysicalAuditView.jsx
 * Dashboard Industrial de Auditoría, Inventario Físico (Conteo en Tiempo Real)
 * y Resumen Financiero de Pérdidas y Recuperación.
 */

// Formateador de moneda con separación de enteros y centavos en opacidad atenuada
function FormattedCurrency({ amount = 0, className = '' }) {
  const numericVal = Number(amount) || 0;
  const isNegative = numericVal < 0;
  const absVal = Math.abs(numericVal);
  const parts = absVal.toFixed(2).split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decPart = parts[1];

  return (
    <div className={`audit-currency-display ${className}`}>
      <span className="audit-currency-symbol">{isNegative ? '-$' : '$'}</span>
      <span>{intPart}</span>
      <span className="audit-currency-cents">.{decPart}</span>
    </div>
  );
}

export default function PhysicalAuditView({
  productosData,
  conteosIniciales,
  auditoriasData,
  eliminacionesData,
  clientesEliminadosData,
  ventasData,
  onApplyAdjustmentProp,
  onApplyAllProp,
  currentUserName = 'SuperAdmin'
}) {
  // 1. Estados reactivos locales con sincronización hacia window si existe
  const [productList, setProductList] = useState(() => {
    if (productosData && Array.isArray(productosData)) return productosData;
    if (typeof window !== 'undefined' && Array.isArray(window.productos)) return window.productos;
    return [
      { id: 'P1', codigo: 'PROD-001', nombre: 'Harina PAN 1kg', stock: 24, costo: 1.10, precio: 1.40, imagen: '' },
      { id: 'P2', codigo: 'PROD-002', nombre: 'Arroz Primor 1kg', stock: 15, costo: 1.05, precio: 1.35, imagen: '' },
      { id: 'P3', codigo: 'PROD-003', nombre: 'Aceite Mazeite 1L', stock: 8, costo: 2.90, precio: 3.60, imagen: '' },
      { id: 'P4', codigo: 'PROD-004', nombre: 'Azúcar Montalbán 1kg', stock: 30, costo: 1.15, precio: 1.45, imagen: '' },
      { id: 'P5', codigo: 'PROD-005', nombre: 'Café Fama de América 250g', stock: 12, costo: 2.20, precio: 2.85, imagen: '' }
    ];
  });

  const [physicalCounts, setPhysicalCounts] = useState(() => {
    if (conteosIniciales) return { ...conteosIniciales };
    if (typeof window !== 'undefined' && window.conteosFisicos) return { ...window.conteosFisicos };
    return {};
  });

  const [scanCode, setScanCode] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedId, setHighlightedId] = useState(null);
  const [appliedBadgeMap, setAppliedBadgeMap] = useState({});

  // 2. Cálculo de diferencia Físico vs Digital
  const getDifference = useCallback((productId, physicalVal, digitalStock) => {
    if (physicalVal === undefined || physicalVal === null || physicalVal === '') {
      return null;
    }
    const numPhysical = Number(physicalVal);
    if (isNaN(numPhysical)) return null;
    return numPhysical - digitalStock;
  }, []);

  // 3. Manejo de cambios en el input de conteo físico
  const handlePhysicalChange = (productId, val) => {
    const updated = { ...physicalCounts };
    if (val === '' || val === null) {
      delete updated[productId];
    } else {
      updated[productId] = Math.max(0, parseInt(val, 10) || 0);
    }
    setPhysicalCounts(updated);

    // Si existe el objeto global en el applet, mantenerlo en sincronía
    if (typeof window !== 'undefined') {
      window.conteosFisicos = updated;
      if (typeof window.actualizarResumenAuditoria === 'function') {
        window.actualizarResumenAuditoria();
      }
    }
  };

  // 4. Filtrado dinámico de la tabla
  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return productList;
    return productList.filter(p =>
      (p.nombre && p.nombre.toLowerCase().includes(term)) ||
      (p.codigo && p.codigo.toLowerCase().includes(term))
    );
  }, [productList, searchTerm]);

  // 5. KPIs Superiores calculados en tiempo real
  const kpiStats = useMemo(() => {
    const countedIds = Object.keys(physicalCounts);
    let sobrantesProductos = 0;
    let sobrantesUnidades = 0;
    let faltantesProductos = 0;
    let faltantesUnidades = 0;
    let conformes = 0;

    countedIds.forEach(id => {
      const prod = productList.find(p => p.id === id);
      if (!prod) return;
      const dif = getDifference(id, physicalCounts[id], prod.stock);
      if (dif === null) return;
      if (dif > 0) {
        sobrantesProductos++;
        sobrantesUnidades += dif;
      } else if (dif < 0) {
        faltantesProductos++;
        faltantesUnidades += Math.abs(dif);
      } else {
        conformes++;
      }
    });

    return {
      contados: countedIds.length,
      sobrantes: sobrantesUnidades > 0 ? `+${sobrantesUnidades}` : '0',
      sobrantesUnidades,
      sobrantesProductos,
      faltantes: faltantesUnidades > 0 ? `-${faltantesUnidades}` : '0',
      faltantesUnidades,
      faltantesProductos,
      conformes,
      totalProductos: productList.length
    };
  }, [physicalCounts, productList, getDifference]);

  // 6. Escaneo por código con atajo ↵ Enter
  const handleScannerSubmit = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const query = scanCode.trim().toUpperCase();
    if (!query) return;

    // Buscar coincidencia flexible por código exacto o numérico
    const matched = productList.find(p => {
      const pCod = String(p.codigo || '').toUpperCase();
      if (pCod === query) return true;
      const numQuery = query.replace(/\D/g, '');
      const numProd = pCod.replace(/\D/g, '');
      return numQuery && numQuery === numProd;
    });

    if (matched) {
      setHighlightedId(matched.id);
      setSearchTerm('');
      setScanCode('');
      setTimeout(() => {
        const inputEl = document.getElementById(`physical-input-${matched.id}`);
        if (inputEl) {
          inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          inputEl.focus();
          inputEl.select();
        }
      }, 80);
    } else {
      alert(`Código "${query}" no encontrado en el inventario.`);
    }
  };

  // 7. Aplicar ajuste individual
  const handleApplySingle = (product) => {
    const physicalVal = physicalCounts[product.id];
    const diff = getDifference(product.id, physicalVal, product.stock);
    if (diff === null) return;

    if (onApplyAdjustmentProp) {
      onApplyAdjustmentProp(product.id, physicalVal);
    } else if (typeof window !== 'undefined' && typeof window.aplicarAjusteInventario === 'function') {
      window.aplicarAjusteInventario(product.id);
    }

    // Actualizar estado local reactivo
    setProductList(prev =>
      prev.map(p => p.id === product.id ? { ...p, stock: Number(physicalVal) } : p)
    );

    // Marcar estado visual como ajustado
    setAppliedBadgeMap(prev => ({ ...prev, [product.id]: true }));

    // Mantener el conteo registrado en perfecta coincidencia con el stock digital ajustado
    const updated = { ...physicalCounts, [product.id]: Number(physicalVal) };
    setPhysicalCounts(updated);
    if (typeof window !== 'undefined') window.conteosFisicos = updated;
  };

  // 8. Aplicar todos los ajustes pendientes
  const handleApplyAll = () => {
    const pendingIds = Object.keys(physicalCounts);
    if (pendingIds.length === 0) return;

    if (onApplyAllProp) {
      onApplyAllProp(physicalCounts);
    } else if (typeof window !== 'undefined' && typeof window.aplicarTodosLosAjustes === 'function') {
      window.aplicarTodosLosAjustes();
    }

    // Actualizar el stock digital en base a los conteos físicos cargados
    setProductList(prev =>
      prev.map(p => {
        if (physicalCounts.hasOwnProperty(p.id)) {
          return { ...p, stock: Number(physicalCounts[p.id]) };
        }
        return p;
      })
    );

    // Mantiene los conteos registrados como verificados
    const updated = { ...physicalCounts };
    setPhysicalCounts(updated);
    if (typeof window !== 'undefined') window.conteosFisicos = updated;
  };

  // 9. Métricas Financieras (Resumen de Pérdidas y Recuperación)
  const financialSummary = useMemo(() => {
    const elim = eliminacionesData || (typeof window !== 'undefined' && window.eliminaciones) || [];
    const cliElim = clientesEliminadosData || (typeof window !== 'undefined' && window.clientesEliminados) || [];
    const vtas = ventasData || (typeof window !== 'undefined' && window.ventas) || [];

    // Pérdidas por daño / merma / retiro
    const perdidaProductos = elim.reduce((sum, e) => {
      const val = Number(e.perdidaUSD);
      if (Number.isFinite(val)) return sum + Math.max(0, val);
      return sum + ((Number(e.cantidadRetirada) || 0) * (Number(e.costo) || 0));
    }, 0);

    // Deudas de clientes dados de baja
    const deudaClientes = cliElim.reduce((sum, c) => {
      return sum + Math.max(0, Number(c.perdidaUSD ?? c.deudaUSD ?? 0));
    }, 0);

    // Faltantes de inventario pendientes
    let perdidaFaltantes = 0;
    Object.keys(physicalCounts).forEach(id => {
      const prod = productList.find(p => p.id === id);
      if (!prod) return;
      const dif = getDifference(id, physicalCounts[id], prod.stock);
      if (dif !== null && dif < 0) {
        perdidaFaltantes += Math.abs(dif) * (Number(prod.costo) || 0);
      }
    });

    const perdidaBruta = perdidaProductos + deudaClientes + perdidaFaltantes;

    // Ganancia generada por ventas (solo transacciones debidamente confirmadas)
    const gananciaGenerada = vtas.reduce((total, v) => {
      // Si existe la función centralizada de verificación, utilizarla
      if (typeof window !== 'undefined' && typeof window.esVentaOTransaccionConfirmada === 'function') {
        if (!window.esVentaOTransaccionConfirmada(v)) return total;
      } else {
        if (v.confirmada === false || v.pendiente === true) return total;
        const est = String(v.estado || '').toUpperCase();
        if (['PENDIENTE', 'PENDIENTE_CONFIRMACION', 'PENDIENTE_VERIFICACION', 'CONFIRMANDO', 'FALLIDO', 'RECHAZADO', 'CANCELADO'].includes(est)) {
          return total;
        }
      }

      const gVenta = (v.items || []).reduce((sub, item) => {
        const precio = Number(item.precio) || 0;
        const costo = Number(item.costo) || (precio * 0.7);
        const cant = Number(item.cantidad) || 0;
        return sub + ((precio - costo) * cant);
      }, 0);
      return total + gVenta;
    }, 0);

    const perdidaPendiente = Math.max(0, perdidaBruta - gananciaGenerada);
    const ratioRecuperacion = perdidaBruta > 0
      ? Math.min(100, Math.round((gananciaGenerada / perdidaBruta) * 100))
      : (gananciaGenerada > 0 ? 100 : 0);

    return {
      perdidaProductos,
      deudaClientes,
      perdidaFaltantes,
      perdidaBruta,
      gananciaGenerada,
      perdidaPendiente,
      ratioRecuperacion
    };
  }, [eliminacionesData, clientesEliminadosData, ventasData, physicalCounts, productList, getDifference]);

  const hasPendingCounts = Object.keys(physicalCounts).length > 0;

  return (
    <div className="audit-dashboard">

      {/* --------------------------------------------------------------------
          💎 1. MÉTRICAS SUPERIORES (KPI STRIP - GLASSMORPHISM / SOFT-CARD)
          -------------------------------------------------------------------- */}
      <div className="audit-kpi-strip">
        {/* Productos Contados */}
        <div className="audit-kpi-card" id="kpi-card-contados">
          <div className="audit-kpi-icon-wrap primary">
            <i className="fas fa-barcode"></i>
          </div>
          <div className="audit-kpi-content">
            <span className="audit-kpi-label">Productos Contados</span>
            <div className="audit-kpi-value primary" id="auditoria-kpi-contados">
              {kpiStats.contados}
            </div>
            <span className="audit-kpi-subtext">De {kpiStats.totalProductos} ítems en catálogo</span>
          </div>
        </div>

        {/* Sobrantes */}
        <div className="audit-kpi-card" id="kpi-card-sobrantes">
          <div className="audit-kpi-icon-wrap success">
            <i className="fas fa-arrow-trend-up"></i>
          </div>
          <div className="audit-kpi-content">
            <span className="audit-kpi-label">Sobrantes Físicos</span>
            <div className="audit-kpi-value success" id="auditoria-kpi-sobrantes">
              {kpiStats.sobrantes}
            </div>
            <span className="audit-kpi-subtext">
              {kpiStats.sobrantesUnidades > 0
                ? `${kpiStats.sobrantesUnidades} unds en ${kpiStats.sobrantesProductos} producto${kpiStats.sobrantesProductos !== 1 ? 's' : ''}`
                : 'Físico mayor al digital'}
            </span>
          </div>
        </div>

        {/* Faltantes */}
        <div className="audit-kpi-card" id="kpi-card-faltantes">
          <div className="audit-kpi-icon-wrap danger">
            <i className="fas fa-triangle-exclamation"></i>
          </div>
          <div className="audit-kpi-content">
            <span className="audit-kpi-label">Faltantes Físicos</span>
            <div className="audit-kpi-value danger" id="auditoria-kpi-faltantes">
              {kpiStats.faltantes}
            </div>
            <span className="audit-kpi-subtext">
              {kpiStats.faltantesUnidades > 0
                ? `${kpiStats.faltantesUnidades} unds en ${kpiStats.faltantesProductos} producto${kpiStats.faltantesProductos !== 1 ? 's' : ''}`
                : 'Requiere ajuste / merma'}
            </span>
          </div>
        </div>

        {/* Conformes */}
        <div className="audit-kpi-card" id="kpi-card-conformes">
          <div className="audit-kpi-icon-wrap indigo">
            <i className="fas fa-circle-check"></i>
          </div>
          <div className="audit-kpi-content">
            <span className="audit-kpi-label">Conformes (Exactos)</span>
            <div className="audit-kpi-value indigo" id="auditoria-kpi-conformes">
              {kpiStats.conformes}
            </div>
            <span className="audit-kpi-subtext">
              {kpiStats.conformes > 0
                ? `${kpiStats.conformes} producto${kpiStats.conformes !== 1 ? 's' : ''} sin diferencias`
                : 'Coincidencia 100% precisa'}
            </span>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------
          ⚡ 2. BARRA DE ACCIONES Y ENTRADA DE DATOS (COMMAND BAR FLOTANTE)
          -------------------------------------------------------------------- */}
      <div className="audit-command-bar">
        {/* Input Escáner de Código de Barras */}
        <div className="audit-input-group">
          <span className="audit-input-icon-left">
            <i className="fas fa-barcode"></i>
          </span>
          <input
            type="text"
            className="audit-input-field"
            id="auditoria-scan"
            placeholder="Escanear o escribir código..."
            value={scanCode}
            onChange={(e) => setScanCode(e.target.value)}
            onKeyDown={handleScannerSubmit}
          />
          <span className="audit-shortcut-badge">↵ Enter</span>
        </div>

        {/* Input Filtrar / Buscar por Texto */}
        <div className="audit-input-group">
          <span className="audit-input-icon-left">
            <i className="fas fa-magnifying-glass"></i>
          </span>
          <input
            type="text"
            className="audit-input-field"
            id="auditoria-search"
            placeholder="Filtrar por código o nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              className="audit-clear-btn"
              onClick={() => setSearchTerm('')}
              title="Limpiar búsqueda"
            >
              <i className="fas fa-xmark"></i>
            </button>
          )}
        </div>

        {/* Botón Principal Gradiente Esmeralda */}
        <button
          type="button"
          className="audit-btn-apply-all"
          onClick={handleApplyAll}
          disabled={!hasPendingCounts}
          title={hasPendingCounts ? 'Aplica todos los conteos al inventario' : 'No hay conteos pendientes'}
        >
          <i className="fas fa-rotate"></i>
          <span>Aplicar Todos los Ajustes</span>
        </button>
      </div>

      {/* --------------------------------------------------------------------
          📋 3. TABLA DE CONCILIACIÓN EN TIEMPO REAL
          -------------------------------------------------------------------- */}
      <div className="audit-table-card">
        <div className="audit-table-header-bar">
          <h3 className="audit-table-title">
            <i className="fas fa-clipboard-check"></i>
            <span>Conteo Físico vs. Stock Teórico</span>
          </h3>
          <span className="audit-table-counter">
            Mostrando {filteredProducts.length} de {productList.length} productos
          </span>
        </div>

        <div className="audit-table-responsive">
          <table className="audit-table">
            <thead>
              <tr>
                <th style={{ width: '120px' }}>Código</th>
                <th>Producto</th>
                <th className="text-center" style={{ width: '130px' }}>Stock Digital</th>
                <th className="text-center" style={{ width: '140px' }}>Stock Físico</th>
                <th className="text-center" style={{ width: '120px' }}>Diferencia</th>
                <th className="text-center" style={{ width: '130px' }}>Estado</th>
                <th className="text-right" style={{ width: '110px' }}>Acción</th>
              </tr>
            </thead>
            <tbody id="auditoria-body">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--audit-slate-400)' }}>
                    <i className="fas fa-box-open" style={{ fontSize: '1.75rem', marginBottom: '0.5rem', display: 'block' }}></i>
                    No se encontraron productos que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const physicalVal = physicalCounts[p.id];
                  const hasValue = physicalVal !== undefined && physicalVal !== null && physicalVal !== '';
                  const diff = getDifference(p.id, physicalVal, p.stock);
                  const isHighlighted = highlightedId === p.id;
                  const wasAdjusted = appliedBadgeMap[p.id];

                  // Clase reactiva para el borde del input
                  let reactiveClass = 'reactive-neutral';
                  if (hasValue && diff !== null) {
                    if (diff === 0) reactiveClass = 'reactive-match';
                    else if (diff < 0) reactiveClass = 'reactive-deficit';
                    else if (diff > 0) reactiveClass = 'reactive-surplus';
                  }

                  return (
                    <tr
                      key={p.id}
                      style={{
                        backgroundColor: isHighlighted ? 'rgba(59, 130, 246, 0.08)' : undefined,
                        transition: 'background-color 0.3s ease'
                      }}
                    >
                      {/* Código con Badge Monospace */}
                      <td>
                        <span className="audit-badge-code">{p.codigo}</span>
                      </td>

                      {/* Producto con Miniatura y Nombre */}
                      <td>
                        <div className="audit-product-cell">
                          <div className="audit-thumb-wrap">
                            {p.imagen ? (
                              <img src={p.imagen} alt={p.nombre} className="audit-thumb-img" />
                            ) : (
                              <i className="fas fa-image"></i>
                            )}
                          </div>
                          <div className="audit-product-details">
                            <span className="audit-product-name">{p.nombre}</span>
                            <span className="audit-product-sub">
                              Costo: ${Number(p.costo || 0).toFixed(2)} · Precio: ${Number(p.precio || 0).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Stock Digital en Caja Neutra */}
                      <td className="text-center">
                        <span className="audit-digital-stock-badge">{p.stock}</span>
                      </td>

                      {/* Input Stock Físico con Borde Reactivo */}
                      <td className="text-center">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          id={`physical-input-${p.id}`}
                          className={`audit-physical-input ${reactiveClass}`}
                          placeholder="—"
                          value={hasValue ? physicalVal : ''}
                          onChange={(e) => handlePhysicalChange(p.id, e.target.value)}
                        />
                      </td>

                      {/* Diferencia Dinámica */}
                      <td className="text-center">
                        {diff === null ? (
                          <span className="audit-diff-badge empty">—</span>
                        ) : diff === 0 ? (
                          <span className="audit-diff-badge match">0</span>
                        ) : diff > 0 ? (
                          <span className="audit-diff-badge surplus">+{diff}</span>
                        ) : (
                          <span className="audit-diff-badge deficit">{diff}</span>
                        )}
                      </td>

                      {/* Estado con Píldora y Pulso Sutil si está Pendiente */}
                      <td className="text-center">
                        {wasAdjusted ? (
                          <span className="audit-status-pill adjusted">
                            <i className="fas fa-check-double"></i> Ajustado
                          </span>
                        ) : hasValue ? (
                          <span className="audit-status-pill pending">
                            Pendiente
                          </span>
                        ) : (
                          <span className="audit-status-pill conforme">
                            Sin Conteo
                          </span>
                        )}
                      </td>

                      {/* Botón Compacto "Aplicar" con micro-interacción */}
                      <td className="text-right">
                        <button
                          type="button"
                          className="audit-btn-apply-row"
                          onClick={() => handleApplySingle(p)}
                          disabled={!hasValue}
                          title={hasValue ? 'Aplicar ajuste a este ítem' : 'Ingrese cantidad física'}
                        >
                          <i className="fas fa-check"></i>
                          <span>Aplicar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --------------------------------------------------------------------
          🛡️ 4. SECCIÓN "RESUMEN DE PÉRDIDAS Y RECUPERACIÓN" (FINANCIAL AUDIT)
          -------------------------------------------------------------------- */}
      <div className="audit-financial-card">
        {/* Encabezado Estilizado con Badge de Estado Financiero */}
        <div className="audit-financial-header">
          <div className="audit-financial-titles">
            <h3>
              <i className="fas fa-scale-balanced" style={{ color: 'var(--audit-primary)' }}></i>
              <span>Auditoría Financiera: Pérdidas y Recuperación</span>
            </h3>
            <p>
              Seguimiento contable en tiempo real: las pérdidas originadas por mermas, vencimientos,
              deudas incobrables y faltantes físicos son compensadas progresivamente por el margen neto de ventas.
            </p>
          </div>

          <div
            className={`audit-financial-status-badge ${
              financialSummary.perdidaPendiente === 0 ? 'healthy' : 'critical'
            }`}
          >
            <i
              className={`fas ${
                financialSummary.perdidaPendiente === 0 ? 'fa-circle-check' : 'fa-triangle-exclamation'
              }`}
            ></i>
            <span>
              {financialSummary.perdidaPendiente === 0 ? 'Equilibrio / Sin Deuda' : 'Balance Pendiente'}
            </span>
          </div>
        </div>

        {/* Tarjetas de Balance con Barra Superior de Color */}
        <div className="audit-balance-grid">
          {/* Pérdidas por Productos Dañados / Vencidos */}
          <div className="audit-balance-item top-danger">
            <span className="audit-balance-item-label">Dañados / Vencidos</span>
            <FormattedCurrency amount={financialSummary.perdidaProductos} className="danger" />
          </div>

          {/* Deudas de Clientes Eliminados */}
          <div className="audit-balance-item top-warning">
            <span className="audit-balance-item-label">Clientes Incobrables</span>
            <FormattedCurrency amount={financialSummary.deudaClientes} className="danger" />
          </div>

          {/* Faltantes de Inventario Pendientes */}
          <div className="audit-balance-item top-slate">
            <span className="audit-balance-item-label">Faltantes en Conteo</span>
            <FormattedCurrency amount={financialSummary.perdidaFaltantes} />
          </div>

          {/* Ganancia Generada por Ventas */}
          <div className="audit-balance-item top-success">
            <span className="audit-balance-item-label">Ganancia Neta Ventas</span>
            <FormattedCurrency amount={financialSummary.gananciaGenerada} className="success" />
          </div>

          {/* Pérdida Pendiente Global a Recuperar */}
          <div className="audit-balance-item top-primary">
            <span className="audit-balance-item-label">Pérdida Pendiente</span>
            <FormattedCurrency
              amount={financialSummary.perdidaPendiente}
              className={financialSummary.perdidaPendiente > 0 ? 'danger' : 'success'}
            />
          </div>
        </div>

        {/* Barra de Progreso Visual: Ganancia vs. Pérdida Pendiente */}
        <div className="audit-progress-section">
          <div className="audit-progress-meta">
            <span className="audit-progress-label">
              <i className="fas fa-chart-pie" style={{ color: 'var(--audit-primary)' }}></i>
              Tasa de Compensación y Cobertura Operativa
            </span>
            <span className="audit-progress-percentage">
              {financialSummary.ratioRecuperacion}% Recuperado
            </span>
          </div>

          <div className="audit-progress-track">
            <div
              className="audit-progress-fill"
              style={{ width: `${financialSummary.ratioRecuperacion}%` }}
            ></div>
          </div>

          <div className="audit-progress-legend">
            <div className="audit-legend-item">
              <span className="audit-legend-dot recovered"></span>
              <span>Compensado con Ganancias (${financialSummary.gananciaGenerada.toFixed(2)})</span>
            </div>
            <div className="audit-legend-item">
              <span className="audit-legend-dot pending"></span>
              <span>Por Recuperar (${financialSummary.perdidaPendiente.toFixed(2)})</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
