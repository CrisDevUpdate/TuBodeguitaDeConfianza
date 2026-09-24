import { list } from '@vercel/blob';

function getBlobToken(req) {
  if (process.env.BLOB_READ_WRITE_TOKEN && process.env.BLOB_READ_WRITE_TOKEN.startsWith('vercel_blob_rw_')) {
    return process.env.BLOB_READ_WRITE_TOKEN;
  }
  return 'vercel_blob_rw_5tUK9cDxqnqjrZw4_XkW85LSec1NCakUeDwzKwNi6s2KYNg';
}

/**
 * Serverless API Route: GET /api/blob/list
 * Retorna la lista de archivos e imágenes guardados en Vercel Blob Storage
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Método no permitido. Utilizar GET.' });
  }

  try {
    const token = getBlobToken(req);
    if (!token) {
      return res.status(400).json({ success: false, error: 'Token de Vercel Blob no configurado.' });
    }

    const result = await list({ token });
    const blobs = (result.blobs || []).map(b => ({
      pathname: b.pathname,
      size: b.size,
      uploadedAt: b.uploadedAt,
      url: b.url,
      downloadUrl: b.downloadUrl,
      viewUrl: `/api/avatar/view?pathname=${encodeURIComponent(b.pathname)}`
    }));

    return res.status(200).json({
      success: true,
      count: blobs.length,
      blobs
    });
  } catch (err) {
    console.error('[Blob List Serverless Error]:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Error consultando archivos en Vercel Blob'
    });
  }
}
