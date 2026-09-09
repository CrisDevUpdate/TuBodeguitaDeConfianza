import { obtenerVercelBlobToken } from '../_lib/blob.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-blob-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const token = obtenerVercelBlobToken(req);
  const isValidFormat = Boolean(token && token.startsWith('vercel_blob_rw_'));

  res.status(200).json({
    success: true,
    connected: isValidFormat,
    status: isValidFormat ? 'configured' : 'not_configured',
    message: isValidFormat ? 'Token con formato válido de Vercel Blob.' : 'No se ha configurado BLOB_READ_WRITE_TOKEN.',
    tokenPrefix: token ? `${token.substring(0, 8)}...` : null,
    tokenLength: token ? token.length : 0,
    hasEnvVar: Boolean(process.env.BLOB_READ_WRITE_TOKEN)
  });
}
