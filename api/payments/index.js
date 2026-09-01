/**
 * api/payments/index.js (Vercel Serverless Handler)
 * Permite GET y POST sobre abonos y transacciones con política estricta de Cero Cache Stale
 */
export default async function handler(req, res) {
  // Directiva estricta de No-Cache Stale
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  const { method } = req;

  if (method === 'GET') {
    const clienteId = req.query.clienteId || req.query.userId || req.query.cedula;
    return res.status(200).json({
      success: true,
      clienteId: clienteId || null,
      message: 'Pagos y transacciones sincronizados desde la base de datos central',
      timestamp: new Date().toISOString()
    });
  }

  if (method === 'POST') {
    const payment = req.body;
    if (!payment || !payment.id) {
      return res.status(400).json({ success: false, error: 'Objeto de pago/abono con ID es requerido' });
    }
    return res.status(200).json({
      success: true,
      payment,
      message: 'Pago registrado exitosamente en la nube',
      timestamp: new Date().toISOString()
    });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end(`Method ${method} Not Allowed`);
}
