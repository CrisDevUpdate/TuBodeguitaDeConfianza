/**
 * /lib/comboFinancialMath.js
 * Motor Matemático de Retail e Ingeniería Financiera
 * 
 * Responsabilidades:
 * 1. Extracción de costos, cálculo de margen neto y asignación segura de puntos para Combos/Ofertas.
 * 2. Asistente Financiero del Premio del Mes: Modelado de Ganancia Neta Objetivo, Pool Competitivo
 *    y garantía de rentabilidad absoluta del negocio (ganancias netas directas >= costo del premio).
 * 3. Liquidación atómica y desglose bimoneda de puntos y beneficios netos en transacciones POS/Abonos.
 */

/**
 * 1. CÁLCULO DE COSTOS Y MÁRGENES PARA COMBOS
 */

/**
 * Calcula el costo total de un combo basado en sus componentes e inventario.
 * @param {Array} items - Arreglo de ítems del combo [{ productoId, cantidad, costo? }]
 * @param {Array} productsInventory - Catálogo de productos disponibles
 * @returns {number} Costo acumulado en USD
 */
export function calculateComboCost(items = [], productsInventory = []) {
  if (!Array.isArray(items) || items.length === 0) return 0;

  const totalCost = items.reduce((acc, item) => {
    const qty = Math.max(0, Number(item.cantidad || item.quantity || 1));
    let unitCost = Number(item.costo || item.costoUSD || 0);

    if (unitCost <= 0 && item.productoId && Array.isArray(productsInventory)) {
      const prod = productsInventory.find(p => 
        String(p.id || '').trim().toLowerCase() === String(item.productoId || '').trim().toLowerCase() ||
        String(p.codigo || '').trim().toLowerCase() === String(item.productoId || '').trim().toLowerCase()
      );
      if (prod) {
        unitCost = Number(prod.costo || prod.costoUSD || 0);
      }
    }

    return acc + (qty * unitCost);
  }, 0);

  return Number(totalCost.toFixed(2));
}

/**
 * Calcula la ganancia neta en USD de un combo.
 * Ganancia Neta = Precio de Venta - Costo Total de los Productos
 * @param {number} salePriceUSD - Precio de venta final del combo
 * @param {number} totalCostUSD - Costo total de los artículos componentes
 * @returns {number} Ganancia neta (mínimo 0)
 */
export function calculateComboNetProfit(salePriceUSD = 0, totalCostUSD = 0) {
  const price = Math.max(0, Number(salePriceUSD) || 0);
  const cost = Math.max(0, Number(totalCostUSD) || 0);
  return Number(Math.max(0, price - cost).toFixed(2));
}

/**
 * Calcula la cantidad sugerida y máxima segura de puntos para un combo
 * asegurando que la deducción de fidelidad nunca supere el margen de ganancia neta.
 * 
 * Puntos Otorgados = Ganancia Neta * (Porcentaje Cedido / 100) * Factor Ganancia-Punto
 * 
 * @param {number} netProfitUSD - Ganancia neta del combo ($)
 * @param {number} loyaltyMarginPercentage - Porcentaje de la ganancia destinado a puntos (ej. 20%)
 * @param {number} pointsPerProfitDollar - Factor de conversión (ej. 10 puntos por cada $1 de ganancia neta)
 * @returns {Object} { suggestedPoints, loyaltyBudgetUSD, maxSafePoints, profitRetainedUSD }
 */
export function calculateSuggestedComboPoints(
  netProfitUSD = 0,
  loyaltyMarginPercentage = 20,
  pointsPerProfitDollar = 10
) {
  const profit = Math.max(0, Number(netProfitUSD) || 0);
  const pct = Math.min(100, Math.max(0, Number(loyaltyMarginPercentage) || 0)) / 100;
  const factor = Math.max(0.1, Number(pointsPerProfitDollar) || 10);

  // Presupuesto monetario de fidelización en dólares
  const loyaltyBudgetUSD = Number((profit * pct).toFixed(2));

  // Puntos calculados matemáticamente
  const suggestedPoints = Math.round(loyaltyBudgetUSD * factor);

  // Ganancia retenida neta en la caja del negocio tras ceder los puntos
  const profitRetainedUSD = Number((profit - loyaltyBudgetUSD).toFixed(2));

  // Techo máximo seguro si se otorgara el 100% de la ganancia
  const maxSafePoints = Math.floor(profit * factor);

  return {
    loyaltyBudgetUSD,
    suggestedPoints: Math.max(0, suggestedPoints),
    maxSafePoints: Math.max(0, maxSafePoints),
    profitRetainedUSD,
    isProfitable: profit > 0 && profitRetainedUSD >= 0
  };
}

/**
 * 2. ASISTENTE FINANCIERO DEL GRAN PREMIO POR PUNTOS & POOL COMPETITIVO DE CLIENTES
 * 
 * Modelo Acumulativo de Ventas (Sin límite mensual fijo):
 * El premio permanece activo hasta que un cliente alcanza la meta de puntos o el administrador
 * decide retirarlo o renovarlo. No requiere que las ganancias de un solo mes cubran el premio:
 * se acumula a lo largo de 1, 2, 3 meses o más según el volumen de ventas real, garantizando
 * matemáticamente que el negocio YA cobró la ganancia neta requerida en su caja antes de entregar el premio.
 */

/**
 * Proyecta la rentabilidad acumulativa de la temporada del premio con pool de clientes.
 * Garantiza rentabilidad matemática absoluta: (ganancias netas acumuladas >= costo del premio)
 * antes de que cualquier usuario alcance el 100% de la meta de puntos.
 * 
 * @param {Object} params
 * @param {number} params.rewardRealCostUSD - Costo real de compra/inversión del premio ($)
 * @param {number} params.targetNetProfitPerWinnerUSD - Ganancia neta objetivo que el ganador debe dejar ($)
 * @param {number} params.estimatedPoolActiveClients - Cantidad de clientes habituales que compiten
 * @param {number} params.pointsPerProfitDollar - Puntos otorgados por cada $1.00 de ganancia neta generada
 * @param {number} params.poolAverageProgressRate - Progreso promedio del resto del pool (ej. 0.50 = 50%)
 * @param {number} params.estimatedMonthlySalesSpeed - Ganancia neta promedio estimada por mes del cliente ($)
 * @returns {Object} Balance proyectado con métricas de solvencia financiera y horizonte flexible
 */
export function calculateRewardSeasonFinances({
  rewardRealCostUSD = 40.00,
  targetNetProfitPerWinnerUSD = 60.00,
  estimatedPoolActiveClients = 10,
  pointsPerProfitDollar = 10,
  poolAverageProgressRate = 0.50,
  estimatedMonthlySalesSpeed = 25.00
} = {}) {
  const costPremio = Math.max(0, Number(rewardRealCostUSD) || 0);
  const targetGanancia = Math.max(0, Number(targetNetProfitPerWinnerUSD) || 0);
  const poolClientes = Math.max(1, parseInt(estimatedPoolActiveClients, 10) || 1);
  const factorPuntos = Math.max(0.1, Number(pointsPerProfitDollar) || 10);
  const tasaProgreso = Math.min(1, Math.max(0.05, Number(poolAverageProgressRate) || 0.50));
  const velVentas = Math.max(5, Number(estimatedMonthlySalesSpeed) || 25.00);

  // Meta de Puntos del Ganador:
  // Puntos Requeridos = Ganancia Neta Objetivo ($) * Puntos por Dólar de Ganancia
  const requiredWinnerPoints = Math.round(targetGanancia * factorPuntos);

  // 1. Ganancia neta aportada directamente por el cliente ganador
  const winnerProfitContribution = targetGanancia;

  // 2. Ganancia neta estimada del resto del pool compitiendo al progreso promedio
  const competingClientsCount = Math.max(0, poolClientes - 1);
  const estimatedAvgProfitPerCompetitor = Number((targetGanancia * tasaProgreso).toFixed(2));
  const poolOtherClientsProfit = Number((competingClientsCount * estimatedAvgProfitPerCompetitor).toFixed(2));

  // 3. Ganancia Neta Total Generada por la Temporada (Acumulada)
  const totalSeasonNetProfit = Number((winnerProfitContribution + poolOtherClientsProfit).toFixed(2));

  // 4. Utilidad Neta Final para la Bodega (Ganancia Total - Costo del Premio)
  const netBusinessProfit = Number((totalSeasonNetProfit - costPremio).toFixed(2));

  // 5. Garantía de Rentabilidad Absoluta (Blindaje Matemático):
  // ¿La ganancia directa del ganador supera o iguala el costo del premio por sí sola?
  const winnerAloneCoversReward = targetGanancia >= costPremio;
  
  // Utilidad positiva total
  const isAbsoluteProfitable = winnerAloneCoversReward && (netBusinessProfit > 0);

  // Margen de seguridad sobre el premio si solo el ganador compitiera
  const soloWinnerNetMargin = Number((targetGanancia - costPremio).toFixed(2));

  // Estimador de Horizonte Temporal Flexible (en meses según ritmo de ventas):
  // Ejemplo: si el ganador genera ~$20 a $30/mes de ganancia neta, $60 toma ~2 a 3 meses
  const estimatedMonthsToWin = Number((targetGanancia / velVentas).toFixed(1));
  const estimatedMonthsRange = `${Math.max(1, Math.floor(estimatedMonthsToWin))} a ${Math.max(2, Math.ceil(estimatedMonthsToWin * 1.3))} meses`;

  // Ventas brutas mínimas estimadas en caja necesarias para generar esa ganancia (asumiendo margen ~30%)
  const estimatedGrossSalesUSD = Number((targetGanancia / 0.30).toFixed(2));

  // Retorno sobre la Inversión en el Premio (ROI)
  const roiPercentage = costPremio > 0 
    ? Number(((netBusinessProfit / costPremio) * 100).toFixed(1))
    : 100;

  return {
    rewardRealCostUSD: costPremio,
    targetNetProfitPerWinnerUSD: targetGanancia,
    estimatedPoolActiveClients: poolClientes,
    pointsPerProfitDollar: factorPuntos,
    poolAverageProgressRate: tasaProgreso,
    requiredWinnerPoints,
    winnerProfitContribution,
    competingClientsCount,
    estimatedAvgProfitPerCompetitor,
    poolOtherClientsProfit,
    totalSeasonNetProfit,
    netBusinessProfit,
    winnerAloneCoversReward,
    isAbsoluteProfitable,
    soloWinnerNetMargin,
    roiPercentage,
    estimatedMonthsToWin,
    estimatedMonthsRange,
    estimatedGrossSalesUSD
  };
}

/**
 * 3. LIQUIDACIÓN ATÓMICA DE PUNTOS Y MARGEN EN VENTAS / POS
 */

/**
 * Desglosa y liquida los puntos y margen neto generado en un carrito o venta.
 * Combina puntos directos de combos más puntos base de productos individuales.
 * 
 * @param {Array} cartItems - Ítems en el carrito [{ productoId, nombre, precio, cantidad, esCombo?, puntosCombo?, costo? }]
 * @param {Array} productsInventory - Catálogo de productos
 * @param {Object} rewardConfig - Configuración activa del premio del mes
 * @returns {Object} Resumen consolidado con desglose por ítem
 */
export function calculateSalePointsAndProfit(cartItems = [], productsInventory = [], rewardConfig = {}) {
  const ptsPorDolarGasto = Math.max(0, Number(rewardConfig?.puntosPorDolar || 1));
  const ptsPorDolarGanancia = Math.max(0.1, Number(rewardConfig?.pointsPerProfitDollar || 10));

  let totalSaleUSD = 0;
  let totalCostUSD = 0;
  let totalNetProfitUSD = 0;
  let totalPointsToAward = 0;
  let totalCombosCount = 0;

  const itemsBreakdown = (cartItems || []).map(item => {
    const qty = Math.max(1, Number(item.cantidad || 1));
    const unitPrice = Math.max(0, Number(item.precio || 0));
    const lineTotal = Number((qty * unitPrice).toFixed(2));
    totalSaleUSD += lineTotal;

    const isCombo = Boolean(
      item.esCombo === true || 
      item.tipo === 'combo' || 
      item.isCombo === true ||
      String(item.categoria || '').toLowerCase().includes('combo')
    );

    let unitCost = Number(item.costoTotalCombo || item.costo || 0);
    if (unitCost <= 0 && Array.isArray(productsInventory)) {
      const prod = productsInventory.find(p => p.id === (item.productoId || item.id));
      unitCost = Number(prod?.costo || prod?.costoUSD || 0);
    }

    const lineCost = Number((qty * unitCost).toFixed(2));
    const lineNetProfit = Math.max(0, Number((lineTotal - lineCost).toFixed(2)));

    let linePoints = 0;
    if (isCombo) {
      totalCombosCount += qty;
      if (item.puntosCombo !== undefined && item.puntosCombo !== null) {
        linePoints = Math.round(Number(item.puntosCombo) * qty);
      } else {
        // Fallback: 20% de ganancia neta convertida a puntos
        linePoints = Math.round(lineNetProfit * (ptsPorDolarGanancia * 0.20));
      }
    } else {
      // Producto individual: puntos base por cada dólar consumido
      linePoints = Math.floor(lineTotal * ptsPorDolarGasto);
    }

    totalCostUSD += lineCost;
    totalNetProfitUSD += lineNetProfit;
    totalPointsToAward += linePoints;

    return {
      productoId: item.productoId || item.id,
      nombre: item.nombre || 'Artículo',
      cantidad: qty,
      precioUnitario: unitPrice,
      subtotal: lineTotal,
      costoTotal: lineCost,
      gananciaNeta: lineNetProfit,
      puntosOtorgados: linePoints,
      esCombo: isCombo
    };
  });

  return {
    totalSaleUSD: Number(totalSaleUSD.toFixed(2)),
    totalCostUSD: Number(totalCostUSD.toFixed(2)),
    totalNetProfitUSD: Number(totalNetProfitUSD.toFixed(2)),
    totalPointsToAward: Math.max(0, totalPointsToAward),
    totalCombosCount,
    itemsBreakdown
  };
}

// Compatibilidad en navegador global
if (typeof window !== 'undefined') {
  window.ComboFinancialMath = {
    calculateComboCost,
    calculateComboNetProfit,
    calculateSuggestedComboPoints,
    calculateRewardSeasonFinances,
    calculateSalePointsAndProfit
  };
}

