import React, { useState, useMemo, useCallback } from 'react';
import { 
  calculateComboCost, 
  calculateComboNetProfit, 
  calculateSuggestedComboPoints 
} from '../lib/comboFinancialMath.js';

/**
 * /components/AdminComboBuilder.jsx
 * Constructor de Combos y Ofertas con Asignación Segura de Puntos
 * 
 * Funcionalidades:
 * - Selección multi-artículo de inventario con cantidades independientes.
 * - Extracción automática de costo unitario y cómputo de Costo Total del Combo.
 * - Determinación del Precio de Venta y Ganancia Neta en tiempo real.
 * - Calculadora de Puntos Rentables según porcentaje de margen cedido.
 * - Previsualización de Insignia Oficial: "🔥 Super Combo: +N Puntos".
 * - Persistencia atómica en Cloud Firestore (/products y /productos) y sincronización con AppState.
 */

export default function AdminComboBuilder({
  productosDisponibles = null,
  onComboSaved = null,
  onClose = null
}) {
  // Obtener inventario desde props, AppState o window.productos
  const inventario = useMemo(() => {
    if (Array.isArray(productosDisponibles) && productosDisponibles.length > 0) {
      return productosDisponibles;
    }
    if (typeof window !== 'undefined') {
      if (Array.isArray(window.AppState?.productos)) return window.AppState.productos;
      if (Array.isArray(window.productos)) return window.productos;
    }
    return [];
  }, [productosDisponibles]);

  // Factor de conversión global (Puntos por dólar de ganancia)
  const factorPuntosGanancia = useMemo(() => {
    if (typeof window !== 'undefined') {
      return Number(window.AppState?.premioMes?.pointsPerProfitDollar || 10);
    }
    return 10;
  }, []);

  // Estados del Formulario del Combo
  const [nombreCombo, setNombreCombo] = useState('');
  const [codigoCombo, setCodigoCombo] = useState(() => {
    const num = Math.floor(100 + Math.random() * 900);
    return `CMB-${num}`;
  });
  const [descripcionCombo, setDescripcionCombo] = useState('');
  const [imagenCombo, setImagenCombo] = useState('https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=600&auto=format&fit=crop&q=80');
  
  // Artículos seleccionados en el combo: [{ productoId, nombre, codigo, cantidad, costoUnitario, stockDisponible }]
  const [selectedItems, setSelectedItems] = useState([]);

  // Estados Financieros
  const [precioVentaUSD, setPrecioVentaUSD] = useState('');
  const [porcentajeMargenFidelidad, setPorcentajeMargenFidelidad] = useState(20);
  const [puntosManuales, setPuntosManuales] = useState('');
  const [usarPuntosSugeridos, setUsarPuntosSugeridos] = useState(true);

  // Estados de Interfaz
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(null);

  // Cálculo en tiempo real de Costo Total
  const costoTotalCombo = useMemo(() => {
    return calculateComboCost(selectedItems, inventario);
  }, [selectedItems, inventario]);

  // Cálculo de Ganancia Neta
  const gananciaNetaCombo = useMemo(() => {
    const precio = parseFloat(precioVentaUSD) || 0;
    return calculateComboNetProfit(precio, costoTotalCombo);
  }, [precioVentaUSD, costoTotalCombo]);

  // Sugerencia de Puntos Seguros
  const calculoPuntos = useMemo(() => {
    return calculateSuggestedComboPoints(
      gananciaNetaCombo,
      porcentajeMargenFidelidad,
      factorPuntosGanancia
    );
  }, [gananciaNetaCombo, porcentajeMargenFidelidad, factorPuntosGanancia]);

  // Puntos definitivos a asignar
  const puntosFinales = useMemo(() => {
    if (usarPuntosSugeridos) {
      return calculoPuntos.suggestedPoints;
    }
    const valManual = parseInt(puntosManuales, 10);
    return isNaN(valManual) || valManual < 0 ? 0 : valManual;
  }, [usarPuntosSugeridos, calculoPuntos.suggestedPoints, puntosManuales]);

  // Stock virtual del combo (limitado por el stock disponible de sus componentes)
  const stockDisponibleCombo = useMemo(() => {
    if (selectedItems.length === 0) return 0;
    let maxCombos = Infinity;
    selectedItems.forEach(it => {
      const prod = inventario.find(p => p.id === it.productoId || p.codigo === it.codigo);
      const stockProd = Number(prod?.stock || it.stockDisponible || 0);
      const cantReq = Math.max(1, it.cantidad);
      const posibles = Math.floor(stockProd / cantReq);
      if (posibles < maxCombos) maxCombos = posibles;
    });
    return maxCombos === Infinity ? 0 : Math.max(0, maxCombos);
  }, [selectedItems, inventario]);

  // Agregar producto al combo
  const handleAddProduct = (producto) => {
    setSelectedItems(prev => {
      const existsIndex = prev.findIndex(item => item.productoId === producto.id);
      const costo = Number(producto.costo || producto.costoUSD || 0);
      const stock = Number(producto.stock || 0);

      if (existsIndex >= 0) {
        const updated = [...prev];
        updated[existsIndex].cantidad += 1;
        return updated;
      } else {
        return [
          ...prev,
          {
            productoId: producto.id,
            nombre: producto.nombre,
            codigo: producto.codigo || producto.id,
            cantidad: 1,
            costoUnitario: costo,
            stockDisponible: stock
          }
        ];
      }
    });
  };

  // Modificar cantidad de producto en el combo
  const handleUpdateQuantity = (productoId, delta) => {
    setSelectedItems(prev => {
      return prev.map(item => {
        if (item.productoId === productoId) {
          const nuevaCant = Math.max(1, item.cantidad + delta);
          return { ...item, cantidad: nuevaCant };
        }
        return item;
      });
    });
  };

  // Remover producto del combo
  const handleRemoveProduct = (productoId) => {
    setSelectedItems(prev => prev.filter(item => item.productoId !== productoId));
  };

  // Filtrado de productos para el catálogo de selección
  const productosFiltrados = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return inventario.slice(0, 8);
    return inventario.filter(p => 
      !p.esCombo && (
        (p.nombre || '').toLowerCase().includes(q) ||
        (p.codigo || '').toLowerCase().includes(q)
      )
    ).slice(0, 10);
  }, [inventario, searchTerm]);

  // Guardar Combo Atómicamente en Firestore y AppState
  const handleGuardarCombo = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!nombreCombo.trim()) {
      alert('Por favor asigna un nombre comercial al combo.');
      return;
    }

    if (selectedItems.length === 0) {
      alert('Debes incluir al menos un producto en el combo.');
      return;
    }

    const precioVenta = parseFloat(precioVentaUSD);
    if (isNaN(precioVenta) || precioVenta <= 0) {
      alert('El precio de venta debe ser un número positivo mayor a $0.00.');
      return;
    }

    if (precioVenta < costoTotalCombo) {
      const confirmacion = window.confirm(
        `Atención: El precio de venta ($${precioVenta.toFixed(2)}) es menor que el costo de los productos ($${costoTotalCombo.toFixed(2)}). Esto generará pérdida. ¿Deseas continuar?`
      );
      if (!confirmacion) return;
    }

    setIsSaving(true);
    setSaveFeedback(null);

    const comboId = `COMBO_${Date.now()}`;
    const badgeText = `🔥 Super Combo: +${puntosFinales} Puntos`;

    const comboData = {
      id: comboId,
      codigo: codigoCombo.trim() || `CMB-${Math.floor(100 + Math.random() * 900)}`,
      nombre: nombreCombo.trim(),
      categoria: 'Combos y Ofertas',
      precio: precioVenta,
      precioUSD: precioVenta,
      costo: costoTotalCombo,
      costoUSD: costoTotalCombo,
      costoTotalCombo: costoTotalCombo,
      gananciaNeta: gananciaNetaCombo,
      porcentajeFidelidad: porcentajeMargenFidelidad,
      puntosCombo: puntosFinales,
      points_given: puntosFinales,
      puntosPromo: puntosFinales,
      badge: badgeText,
      badgeText: badgeText,
      esCombo: true,
      tipo: 'combo',
      descripcion: descripcionCombo.trim() || `Combo especial que incluye: ${selectedItems.map(it => `${it.cantidad}x ${it.nombre}`).join(', ')}`,
      imagen: imagenCombo.trim(),
      items: selectedItems.map(it => ({
        productoId: it.productoId,
        nombre: it.nombre,
        codigo: it.codigo,
        cantidad: it.cantidad,
        costoUnitario: it.costoUnitario,
        subtotalCosto: Number((it.cantidad * it.costoUnitario).toFixed(2))
      })),
      stock: stockDisponibleCombo,
      activo: true,
      updatedAt: new Date().toISOString()
    };

    try {
      // 1. Guardar en AppState local
      if (typeof window !== 'undefined' && window.AppState) {
        window.AppState.productos = window.AppState.productos || [];
        const idx = window.AppState.productos.findIndex(p => p.id === comboId);
        if (idx !== -1) {
          window.AppState.productos[idx] = comboData;
        } else {
          window.AppState.productos.unshift(comboData);
        }
        if (Array.isArray(window.productos)) {
          window.productos.unshift(comboData);
        }
      }

      // 2. Persistir en Firestore (en collections 'products' y 'productos' para sincronización total)
      if (typeof window !== 'undefined' && window.InventoryApp?.Firebase?.guardarProducto) {
        await window.InventoryApp.Firebase.guardarProducto(comboData);
      } else if (typeof window !== 'undefined' && window.firebase?.firestore) {
        const db = window.firebase.firestore();
        const batch = db.batch();
        const prodRef = db.collection('products').doc(comboId);
        const productosRef = db.collection('productos').doc(comboId);
        batch.set(prodRef, comboData, { merge: true });
        batch.set(productosRef, comboData, { merge: true });
        await batch.commit();
      }

      // 3. Persistencia local contingente
      if (typeof window !== 'undefined' && window.InventoryApp?.Persistence?.guardar) {
        window.InventoryApp.Persistence.guardar(true);
      }

      // 4. Refrescar vistas del catálogo si existen
      if (typeof window !== 'undefined' && window.InventoryApp?.Catalog?.renderGrid) {
        window.InventoryApp.Catalog.renderGrid(true);
      }
      if (typeof window !== 'undefined' && typeof window.renderizarCatalogoCliente === 'function') {
        window.renderizarCatalogoCliente();
      }

      setSaveFeedback({
        tipo: 'success',
        mensaje: `¡${badgeText} guardado y publicado en el catálogo exitosamente!`
      });

      if (typeof onComboSaved === 'function') {
        onComboSaved(comboData);
      }

      // Resetear tras éxito
      setTimeout(() => {
        setNombreCombo('');
        setPrecioVentaUSD('');
        setSelectedItems([]);
        setCodigoCombo(`CMB-${Math.floor(100 + Math.random() * 900)}`);
        setSaveFeedback(null);
      }, 2500);

    } catch (err) {
      console.error('[AdminComboBuilder] Error al guardar combo:', err);
      setSaveFeedback({
        tipo: 'error',
        mensaje: `Error al persistir combo en Firestore: ${err.message}`
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="admin-combo-builder-root" className="w-full max-w-7xl mx-auto p-4 sm:p-6 bg-slate-50 text-slate-800 rounded-2xl shadow-sm border border-slate-200">
      
      {/* Header del Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm tracking-wider uppercase">
            <span>🍔 Ingeniería de Ofertas</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>Margen Seguro</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Constructor de Combos Rentables
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Diseña combos con extracción automática de costos, cálculo de ganancia neta y asignación blindada de puntos de fidelización.
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="self-start sm:self-center px-4 py-2 text-sm font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition"
          >
            Cerrar Constructor
          </button>
        )}
      </div>

      {saveFeedback && (
        <div className={`p-4 mb-6 rounded-xl border text-sm font-medium ${
          saveFeedback.tipo === 'success' 
            ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
            : 'bg-rose-50 border-rose-300 text-rose-800'
        }`}>
          {saveFeedback.mensaje}
        </div>
      )}

      {/* Cuadrícula Principal de 2 Columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* COLUMNA IZQUIERDA: Selección de Productos y Definición de Precios (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Tarjeta: Información Básica del Combo */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span>1. Identidad de la Oferta</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">Nombre Comercial del Combo *</label>
                <input
                  type="text"
                  value={nombreCombo}
                  onChange={(e) => setNombreCombo(e.target.value)}
                  placeholder="Ej: Mega Combo Parrillero Familiar"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Código SKU</label>
                <input
                  type="text"
                  value={codigoCombo}
                  onChange={(e) => setCodigoCombo(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-slate-50 text-slate-600 font-mono text-center"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-slate-600 mb-1">URL de Imagen del Combo</label>
                <input
                  type="url"
                  value={imagenCombo}
                  onChange={(e) => setImagenCombo(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-600"
                />
              </div>
            </div>
          </div>

          {/* Tarjeta: Selección de Productos del Inventario */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                2. Composición del Combo (Productos del Inventario)
              </h3>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre o código..."
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full sm:w-56"
              />
            </div>

            {/* Listado de Productos Disponibles para Agregar */}
            <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-100 mb-4 bg-slate-50">
              {productosFiltrados.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  No se encontraron productos en el inventario.
                </div>
              ) : (
                productosFiltrados.map(prod => {
                  const costo = Number(prod.costo || prod.costoUSD || 0);
                  const precio = Number(prod.precio || prod.precioUSD || 0);
                  const stock = Number(prod.stock || 0);
                  return (
                    <div key={prod.id} className="p-2.5 flex items-center justify-between hover:bg-white transition text-xs">
                      <div>
                        <span className="font-semibold text-slate-800">{prod.nombre}</span>
                        <span className="text-slate-400 ml-2 font-mono">({prod.codigo || prod.id})</span>
                        <div className="text-slate-500 text-[11px] mt-0.5">
                          Costo Base: <span className="font-semibold text-slate-700">${costo.toFixed(2)}</span> | 
                          PVP: ${precio.toFixed(2)} | 
                          Stock: <span className={stock > 0 ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>{stock} un.</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddProduct(prod)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-bold transition flex items-center gap-1 shadow-sm"
                      >
                        <span>+</span> Añadir
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Lista de Artículos Incluidos en el Combo */}
            <div className="mt-4">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Artículos Incluidos ({selectedItems.length})
              </h4>
              {selectedItems.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                  Selecciona productos arriba para armar la composición de la oferta.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedItems.map((item) => {
                    const subtotal = (item.cantidad * item.costoUnitario).toFixed(2);
                    return (
                      <div 
                        key={item.productoId}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex-1">
                          <span className="font-bold text-slate-800">{item.nombre}</span>
                          <div className="text-slate-500 text-[11px]">
                            Costo Unitario: ${item.costoUnitario.toFixed(2)} &bull; Subtotal: <strong className="text-slate-700">${subtotal}</strong>
                          </div>
                        </div>

                        {/* Control de Cantidad */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.productoId, -1)}
                            className="w-7 h-7 flex items-center justify-center bg-white border border-slate-300 rounded font-bold hover:bg-slate-100"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-bold text-slate-800 text-sm">
                            {item.cantidad}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.productoId, 1)}
                            className="w-7 h-7 flex items-center justify-center bg-white border border-slate-300 rounded font-bold hover:bg-slate-100"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveProduct(item.productoId)}
                            className="ml-2 text-rose-500 hover:text-rose-700 p-1"
                            title="Eliminar del combo"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Totalizador de Costo Base Extraído */}
            <div className="mt-4 p-3 bg-slate-100 rounded-lg flex items-center justify-between text-xs font-bold text-slate-700">
              <span>Costo Total de los Productos (Suma Base):</span>
              <span className="text-sm text-slate-900 font-mono">${costoTotalCombo.toFixed(2)} USD</span>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: Ingeniería Financiera, Puntos y Preview (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">

          {/* Tarjeta: Definición de Precio y Margen Neto */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span>3. Precio y Ganancia Neta</span>
            </h3>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Precio Final de Venta del Combo ($ USD) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={precioVentaUSD}
                  onChange={(e) => setPrecioVentaUSD(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2.5 text-lg font-bold text-slate-900 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Panel de Desglose de Ganancia Neta en Tiempo Real */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Precio de Venta:</span>
                <span className="font-bold text-slate-800">${Number(precioVentaUSD || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>(-) Costo Total Productos:</span>
                <span className="font-bold text-rose-600">-${costoTotalCombo.toFixed(2)}</span>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between items-baseline font-bold">
                <span className="text-slate-800 text-sm">Ganancia Neta del Combo:</span>
                <span className={`text-base font-mono ${gananciaNetaCombo > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  ${gananciaNetaCombo.toFixed(2)} USD
                </span>
              </div>
              {Number(precioVentaUSD || 0) > 0 && Number(precioVentaUSD || 0) < costoTotalCombo && (
                <div className="p-2 bg-rose-100 text-rose-700 rounded text-[11px] font-semibold">
                  ⚠️ Alerta: El precio actual no cubre los costos del combo.
                </div>
              )}
            </div>
          </div>

          {/* Tarjeta: Calculadora de Puntos Seguros por Oferta */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-2 flex items-center justify-between">
              <span>4. Calculadora de Puntos Seguros</span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                Rentabilidad Blindada
              </span>
            </h3>

            <p className="text-xs text-slate-500 mb-3">
              Define qué porcentaje de la ganancia neta estás dispuesto a ceder en fidelización:
            </p>

            {/* Selector de Margen de Fidelidad */}
            <div className="mb-4">
              <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                <span>Porcentaje cedido a Puntos:</span>
                <span className="text-emerald-600">{porcentajeMargenFidelidad}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={porcentajeMargenFidelidad}
                onChange={(e) => {
                  setPorcentajeMargenFidelidad(Number(e.target.value));
                  setUsarPuntosSugeridos(true);
                }}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between gap-1 mt-2">
                {[10, 15, 20, 25, 30].map(pct => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      setPorcentajeMargenFidelidad(pct);
                      setUsarPuntosSugeridos(true);
                    }}
                    className={`px-2 py-1 text-[11px] font-bold rounded border transition ${
                      porcentajeMargenFidelidad === pct 
                        ? 'bg-emerald-600 text-white border-emerald-600' 
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* Resultado de la Fórmula */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl mb-4 text-xs space-y-1.5">
              <div className="flex justify-between text-emerald-900">
                <span>Presupuesto Fidelización:</span>
                <span className="font-semibold">${calculoPuntos.loyaltyBudgetUSD.toFixed(2)} USD</span>
              </div>
              <div className="flex justify-between text-emerald-900">
                <span>Ganancia Neta Retenida (Caja):</span>
                <span className="font-bold">${calculoPuntos.profitRetainedUSD.toFixed(2)} USD</span>
              </div>
              <div className="border-t border-emerald-200 pt-1.5 flex justify-between items-center">
                <span className="font-bold text-emerald-950">Puntos Sugeridos Calculados:</span>
                <span className="text-base font-extrabold text-emerald-700 font-mono">
                  +{calculoPuntos.suggestedPoints} pts
                </span>
              </div>
            </div>

            {/* Selector Sugerido vs Manual */}
            <div className="flex items-center gap-3 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={usarPuntosSugeridos}
                  onChange={(e) => setUsarPuntosSugeridos(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Usar sugerencia automática calculada</span>
              </label>

              {!usarPuntosSugeridos && (
                <input
                  type="number"
                  min="0"
                  max={calculoPuntos.maxSafePoints}
                  value={puntosManuales}
                  onChange={(e) => setPuntosManuales(e.target.value)}
                  placeholder={`Max: ${calculoPuntos.maxSafePoints}`}
                  className="w-24 px-2 py-1 text-xs border border-slate-300 rounded font-bold"
                />
              )}
            </div>
          </div>

          {/* Tarjeta: Insignia y Previsualización para el Catálogo */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Insignia Automática en Catálogo (Vista Cliente)
            </h3>

            {/* Badge Requerido */}
            <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between shadow-inner">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full font-black text-xs shadow">
                <span>🔥 Super Combo: +{puntosFinales} Puntos</span>
              </div>
              <span className="text-[11px] text-slate-400">
                Stock: {stockDisponibleCombo} combos
              </span>
            </div>

            {/* Botón de Guardado */}
            <button
              type="button"
              disabled={isSaving || selectedItems.length === 0}
              onClick={handleGuardarCombo}
              className={`w-full mt-5 py-3 px-4 rounded-xl font-bold text-sm text-white transition flex items-center justify-center gap-2 shadow-md ${
                isSaving || selectedItems.length === 0
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98]'
              }`}
            >
              {isSaving ? (
                <span>Guardando Combo en Firestore...</span>
              ) : (
                <>
                  <span>🔥 Publicar Combo en el Catálogo (+{puntosFinales} Pts)</span>
                </>
              )}
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}
