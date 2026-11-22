import {
  getVapidKeys,
  savePushSubscription,
  deletePushSubscription,
  sendWebPushNotification
} from '../lib/web-push-server.js';

/**
 * Serverless API Route unificada: /api/push
 * Atiende (vía rewrites en vercel.json):
 *   - GET  /api/push/public-key
 *   - POST /api/push/subscribe
 *   - POST /api/push/unsubscribe
 *   - POST /api/push/send
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let action = (req.query && typeof req.query.action === 'string' ? req.query.action : '').trim().toLowerCase();
  if (!action && req.url) {
    const cleanPath = req.url.split('?')[0].replace(/\/+$/, '');
    const parts = cleanPath.split('/');
    const last = parts[parts.length - 1];
    if (last && last !== 'push') action = last.toLowerCase();
  }

  try {
    if (action === 'public-key' || (req.method === 'GET' && !action)) {
      const keys = await getVapidKeys();
      return res.status(200).json({ success: true, publicKey: keys.publicKey });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Método no permitido. Utilizar POST.' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    if (action === 'subscribe') {
      const result = await savePushSubscription({
        subscription: body.subscription,
        role: body.role,
        userId: body.userId,
        cedula: body.cedula,
        nombre: body.nombre,
        userAgent: req.headers['user-agent'] || body.userAgent || ''
      });
      return res.status(200).json({ success: true, ...result });
    }

    if (action === 'unsubscribe') {
      await deletePushSubscription(body.endpoint);
      return res.status(200).json({ success: true });
    }

    if (action === 'send') {
      const stats = await sendWebPushNotification(body);
      return res.status(200).json({ success: true, ...stats });
    }

    return res.status(404).json({ success: false, error: `Acción push desconocida: ${action || 'ninguna'}` });
  } catch (err) {
    console.error(`[API Push/${action || 'unknown'}]:`, err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
