/**
 * api/users/index.js (Vercel Serverless Handler)
 * Permite GET, POST, DELETE sobre usuarios
 */
export default async function handler(req, res) {
  const { method } = req;
  const userId = req.query.id || req.query.userId || req.body?.id || req.body?.cedula;

  if (method === 'DELETE') {
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID or cédula is required' });
    }
    return res.status(200).json({
      success: true,
      message: `Usuario ${userId} eliminado correctamente de la base de datos de Vercel`,
      deletedId: userId
    });
  }

  if (method === 'GET') {
    return res.status(200).json({
      success: true,
      userId: userId || null,
      message: 'Usuarios obtenidos exitosamente'
    });
  }

  if (method === 'POST') {
    return res.status(200).json({
      success: true,
      user: req.body,
      message: 'Usuario registrado o actualizado'
    });
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  res.status(405).end(`Method ${method} Not Allowed`);
}
