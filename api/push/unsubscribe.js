import { deletePushSubscription } from '../../lib/web-push-server.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Método no permitido' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    await deletePushSubscription(body.endpoint);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[API Push Unsubscribe]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
