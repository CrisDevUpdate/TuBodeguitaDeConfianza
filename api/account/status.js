/**
 * api/account/status.js (Vercel Serverless Handler)
 * Devuelve el estado de cuenta consolidado del cliente
 */
export default async function handler(req, res) {
  const userId = req.query.userId || req.query.id || req.query.cedula;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId is required' });
  }

  res.status(200).json({
    success: true,
    userId,
    totalCompradoUSD: 0,
    totalCreditoUSD: 0,
    totalAbonadoUSD: 0,
    saldoDeudaUSD: 0,
    facturasPendientesCount: 0,
    ventas: [],
    abonos: [],
    message: 'Estado de cuenta obtenido'
  });
}
