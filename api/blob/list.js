import { list } from '@vercel/blob';
import { obtenerVercelBlobToken } from '../_lib/blob.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-blob-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const token = obtenerVercelBlobToken(req);
    if (!token) {
      return res.status(400).json({ success: false, error: 'Token de Vercel Blob no configurado' });
    }

    const result = await list({ token });
    const blobs = (result.blobs || []).map(b => ({
      pathname: b.pathname,
      size: b.size,
      uploadedAt: b.uploadedAt,
      url: b.url,
      viewUrl: `/api/blob/view?pathname=${encodeURIComponent(b.pathname)}`
    }));

    return res.status(200).json({ success: true, count: blobs.length, blobs });
  } catch (err) {
    console.error('[Blob List Serverless Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
