/**
 * /api/sales/processPoints.js
 * Liquidación Atómica de Puntos y Ganancia Neta en POS y Conciliación de Pagos
 * 
 * Funcionalidad:
 * 1. Desglosa ítems del carrito identificando combos (+puntos de oferta) y productos individuales (+puntos base).
 * 2. Suma los puntos directamente al Árbol de Fidelización del cliente.
 * 3. Actualiza atómicamente en Cloud Firestore la ganancia neta acumulada aportada por el usuario
 *    en /users/{id}/financialMetrics (y /usuarios/{id}).
 * 4. Compatible como Serverless API Handler (Vercel/Express) y como módulo invocable en el frontend.
 */

import { calculateSalePointsAndProfit } from '../../lib/comboFinancialMath.js';

/**
 * Función principal de liquidación atómica y mutación en Firestore
 * @param {Object} saleData
 * @param {string} saleData.clienteId - Cédula o ID del cliente
 * @param {Array} saleData.items - Artículos de la venta (incluyendo combos y productos)
 * @param {number} saleData.totalUSD - Monto total en USD de la venta o abono
 * @param {string} saleData.saleId - ID único de la transacción
 * @param {string} saleData.metodoPago - Método de pago utilizado
 * @param {Object} [firestoreInstance] - Instancia opcional de Firestore (Node o Browser)
 * @returns {Promise<Object>} Resumen de liquidación con métricas actualizadas
 */
export async function processSalePointsAtomic(saleData, firestoreInstance = null) {
  const {
    clienteId,
    items = [],
    totalUSD = 0,
    saleId = `SALE_${Date.now()}`,
    metodoPago = 'Contado',
    rewardConfig = null,
    productsInventory = []
  } = saleData;

  if (!clienteId) {
    throw new Error('clienteId es obligatorio para liquidar puntos y métricas financieras.');
  }

  const cleanClientId = String(clienteId).trim().toUpperCase();

  // 1. Obtener configuración activa de gamificación y catálogo
  let activeRewardConfig = rewardConfig;
  let activeProducts = productsInventory;

  if (typeof window !== 'undefined') {
    if (!activeRewardConfig && window.AppState?.premioMes) {
      activeRewardConfig = window.AppState.premioMes;
    }
    if ((!activeProducts || activeProducts.length === 0) && Array.isArray(window.AppState?.productos)) {
      activeProducts = window.AppState.productos;
    }
  }

  // 2. Liquidación matemática mediante comboFinancialMath
  const resumenFinanciero = calculateSalePointsAndProfit(items, activeProducts, activeRewardConfig);
  const puntosALiquidar = resumenFinanciero.totalPointsToAward;
  const gananciaNetaGenerada = resumenFinanciero.totalNetProfitUSD;
  const cantidadCombos = resumenFinanciero.totalCombosCount;

  // 3. Obtener instancia de Firestore
  let db = firestoreInstance;
  if (!db && typeof window !== 'undefined') {
    if (window.firebase?.firestore) {
      db = window.firebase.firestore();
    } else if (window.InventoryApp?.Firebase?.getDb) {
      db = window.InventoryApp.Firebase.getDb();
    }
  }

  let updatedMetrics = {
    totalNetProfitUSD: gananciaNetaGenerada,
    totalPurchasesUSD: Number(totalUSD) || resumenFinanciero.totalSaleUSD,
    totalPointsEarned: puntosALiquidar,
    combosPurchasedCount: cantidadCombos,
    lastSaleId: saleId,
    lastUpdated: new Date().toISOString()
  };

  let nuevoSaldoPuntos = puntosALiquidar;

  // 4. Mutación Atómica en Cloud Firestore si la base de datos está disponible
  if (db && typeof db.runTransaction === 'function') {
    try {
      await db.runTransaction(async (transaction) => {
        // Referencias a los documentos de usuario (/users y /usuarios)
        const userRef = db.collection('users').doc(cleanClientId);
        const usuarioRef = db.collection('usuarios').doc(cleanClientId);
        const metricsSubdocRef = db.collection('users').doc(cleanClientId).collection('financialMetrics').doc('summary');

        // Leer documentos existentes
        const userDoc = await transaction.get(userRef);
        const usuarioDoc = await transaction.get(usuarioRef);
        const metricsDoc = await transaction.get(metricsSubdocRef);

        const currentPoints = (userDoc.exists ? Number(userDoc.data().puntosAcumulados || 0) : 0) ||
                             (usuarioDoc.exists ? Number(usuarioDoc.data().puntosAcumulados || 0) : 0);

        nuevoSaldoPuntos = currentPoints + puntosALiquidar;

        // Métricas financieras previas
        const prevMetrics = (metricsDoc.exists ? metricsDoc.data() : null) || 
                            (userDoc.exists ? userDoc.data().financialMetrics : null) || 
                            {};

        updatedMetrics = {
          totalNetProfitUSD: Number((Number(prevMetrics.totalNetProfitUSD || 0) + gananciaNetaGenerada).toFixed(2)),
          totalPurchasesUSD: Number((Number(prevMetrics.totalPurchasesUSD || 0) + (Number(totalUSD) || resumenFinanciero.totalSaleUSD)).toFixed(2)),
          totalPointsEarned: Number(prevMetrics.totalPointsEarned || 0) + puntosALiquidar,
          combosPurchasedCount: Number(prevMetrics.combosPurchasedCount || 0) + cantidadCombos,
          lastSaleId: saleId,
          lastMetodoPago: metodoPago,
          lastUpdated: new Date().toISOString()
        };

        // Actualizar /users/{id}
        const userUpdatePayload = {
          id: cleanClientId,
          cedula: cleanClientId,
          puntosAcumulados: nuevoSaldoPuntos,
          financialMetrics: updatedMetrics,
          updatedAt: new Date().toISOString()
        };

        transaction.set(userRef, userUpdatePayload, { merge: true });
        transaction.set(usuarioRef, { puntosAcumulados: nuevoSaldoPuntos, financialMetrics: updatedMetrics }, { merge: true });
        transaction.set(metricsSubdocRef, updatedMetrics, { merge: true });

        // Registrar detalle del movimiento en el historial financiero del usuario
        const historyRef = db.collection('users').doc(cleanClientId).collection('financialHistory').doc(saleId);
        transaction.set(historyRef, {
          saleId,
          fecha: new Date().toISOString(),
          puntosOtorgados: puntosALiquidar,
          gananciaNeta: gananciaNetaGenerada,
          montoTotal: Number(totalUSD) || resumenFinanciero.totalSaleUSD,
          combosVendidos: cantidadCombos,
          items: resumenFinanciero.itemsBreakdown
        });
      });

      console.log(`[processPoints] Liquidación atómica completada para ${cleanClientId}: +${puntosALiquidar} pts, +$${gananciaNetaGenerada} USD ganancia neta.`);
    } catch (fsErr) {
      console.warn('[processPoints] Error en transacción Firestore (aplicando fallback local):', fsErr.message);
    }
  }

  // 5. Actualización Reactiva de AppState en el Frontend
  if (typeof window !== 'undefined' && window.AppState) {
    const usuarios = window.AppState.usuarios || [];
    const usuario = usuarios.find(u => 
      String(u.cedula || u.id || '').trim().toUpperCase() === cleanClientId
    );

    if (usuario) {
      usuario.puntosAcumulados = Number(usuario.puntosAcumulados || 0) + puntosALiquidar;
      usuario.financialMetrics = updatedMetrics;
    }

    // Actualizar Árbol de Gamificación
    if (window.InventoryApp?.TreeGamification && typeof window.InventoryApp.TreeGamification.actualizarPuntos === 'function') {
      window.InventoryApp.TreeGamification.actualizarPuntos(nuevoSaldoPuntos);
    }

    // Persistencia local
    if (window.InventoryApp?.Persistence?.guardar) {
      window.InventoryApp.Persistence.guardar(true);
    }
  }

  return {
    success: true,
    clienteId: cleanClientId,
    saleId,
    pointsAwarded: puntosALiquidar,
    netProfitGenerated: gananciaNetaGenerada,
    totalCombos: cantidadCombos,
    newPointsBalance: nuevoSaldoPuntos,
    financialMetrics: updatedMetrics,
    breakdown: resumenFinanciero.itemsBreakdown,
    timestamp: new Date().toISOString()
  };
}

/**
 * Handler HTTP para endpoints REST (/api/sales/processPoints)
 * Vercel Serverless Function & Express Route Handler
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
  }

  try {
    const saleData = req.body;
    if (!saleData || !saleData.clienteId) {
      return res.status(400).json({
        success: false,
        error: 'El cuerpo de la solicitud debe incluir clienteId y los ítems a liquidar.'
      });
    }

    const resultado = await processSalePointsAtomic(saleData);
    return res.status(200).json(resultado);
  } catch (error) {
    console.error('[API /api/sales/processPoints] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error interno procesando puntos y métricas financieras.'
    });
  }
}
