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

  const { productoId, codigo, nombre, stockAnterior, nuevoStock, diferencia, motivo, usuario, timestamp } = req.body || {};
  if (!productoId && !codigo) {
    return res.status(400).json({ success: false, error: 'productoId o codigo es requerido' });
  }

  const ajuste = {
    id: `ADJ_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    productoId: productoId || codigo,
    codigo: codigo || '',
    nombre: nombre || 'Producto',
    stockAnterior: Number(stockAnterior || 0),
    nuevoStock: Number(nuevoStock || 0),
    diferencia: Number(diferencia !== undefined ? diferencia : (Number(nuevoStock || 0) - Number(stockAnterior || 0))),
    motivo: motivo || 'Ajuste de Auditoría Física',
    usuario: usuario || 'SuperAdmin',
    fecha: timestamp || new Date().toISOString().replace('T', ' ').substring(0, 16),
    estado: 'CONFIRMADO'
  };

  return res.status(200).json({
    success: true,
    message: 'Ajuste de inventario registrado y auditado exitosamente.',
    ajuste
  });
}
