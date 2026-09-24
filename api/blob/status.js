function getBlobToken(req) {
  if (process.env.BLOB_READ_WRITE_TOKEN && process.env.BLOB_READ_WRITE_TOKEN.startsWith('vercel_blob_rw_')) {
    return process.env.BLOB_READ_WRITE_TOKEN;
  }
  return 'vercel_blob_rw_5tUK9cDxqnqjrZw4_XkW85LSec1NCakUeDwzKwNi6s2KYNg';
}

/**
 * Serverless API Route: GET /api/blob/status
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const token = getBlobToken(req);
  const isValidFormat = Boolean(token && token.startsWith('vercel_blob_rw_'));

  return res.status(200).json({
    success: true,
    connected: isValidFormat,
    status: isValidFormat ? 'configured' : 'not_configured',
    message: isValidFormat ? 'Token con formato válido de Vercel Blob.' : 'No se ha configurado BLOB_READ_WRITE_TOKEN.',
    storeId: 'store_5tUK9cDxqnqjrZw4'
  });
}
