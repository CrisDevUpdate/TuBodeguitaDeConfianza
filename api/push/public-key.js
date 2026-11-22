import { getVapidKeys } from '../../lib/web-push-server.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Método no permitido' });

  try {
    const keys = await getVapidKeys();
    return res.status(200).json({ success: true, publicKey: keys.publicKey });
  } catch (err) {
    console.error('[API Push Public Key]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
