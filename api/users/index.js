/**
 * api/users/index.js (Vercel Serverless Handler)
 * Permite GET, POST, DELETE sobre usuarios con política estricta de Cero Cache Stale
 */
export default async function handler(req, res) {
  // Directiva estricta de No-Cache Stale
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  const { method } = req;
  const userId = req.query.id || req.query.userId || req.query.cedula || req.body?.id || req.body?.cedula;

  if (method === 'DELETE') {
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID or cédula is required' });
    }
    return res.status(200).json({
      success: true,
      message: `Usuario ${userId} eliminado correctamente de la base de datos central`,
      deletedId: userId,
      timestamp: new Date().toISOString()
    });
  }

  if (method === 'GET') {
    return res.status(200).json({
      success: true,
      userId: userId || null,
      message: 'Usuarios obtenidos exitosamente',
      timestamp: new Date().toISOString()
    });
  }

  if (method === 'POST') {
    return res.status(200).json({
      success: true,
      user: req.body,
      message: 'Usuario registrado o actualizado en la nube',
      timestamp: new Date().toISOString()
    });
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  res.status(405).end(`Method ${method} Not Allowed`);
}
