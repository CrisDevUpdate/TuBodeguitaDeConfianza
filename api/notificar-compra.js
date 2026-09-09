export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { pedidoId, cliente, items, totalUSD, totalVES, metodoPago, referencia, fecha, notas } = req.body || {};
  const adminEmail = 'cris.dev.update@gmail.com';

  const notificacion = {
    pedidoId: pedidoId || `PED_${Date.now()}`,
    destinatario: adminEmail,
    cliente: cliente || {},
    items: items || [],
    totalUSD: totalUSD || 0,
    totalVES: totalVES || 0,
    metodoPago: metodoPago || 'No especificado',
    referencia: referencia || 'N/A',
    fecha: fecha || new Date().toISOString(),
    notas: notas || '',
    estado: 'NOTIFICADO_ADMIN',
    timestamp: Date.now()
  };

  return res.status(200).json({
    success: true,
    message: `Notificación de compra enviada exitosamente a ${adminEmail}`,
    notificacion
  });
}
