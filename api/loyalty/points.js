/**
 * api/loyalty/points.js (Vercel Serverless Handler)
 * Devuelve los puntos y progreso del premio mensual del cliente
 */
export default async function handler(req, res) {
  const userId = req.query.userId || req.query.id || req.query.cedula;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId is required' });
  }

  res.status(200).json({
    success: true,
    userId,
    puntosDisponibles: 0,
    puntosAcumulados: 0,
    puntosCanjeados: 0,
    metaPuntos: 200,
    porcentajeMeta: 0,
    ciclo: 1,
    reputacion: 'CLIENTE_DESTACADO'
  });
}
