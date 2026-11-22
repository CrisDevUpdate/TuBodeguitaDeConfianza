import { savePushSubscription } from '../../lib/web-push-server.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Método no permitido' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const result = await savePushSubscription({
      subscription: body.subscription,
      role: body.role,
      userId: body.userId,
      cedula: body.cedula,
      nombre: body.nombre,
      userAgent: req.headers['user-agent'] || body.userAgent || ''
    });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('[API Push Subscribe]:', err);
    return res.status(400).json({ success: false, error: err.message });
  }
}
