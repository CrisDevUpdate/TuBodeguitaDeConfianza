import { get } from '@vercel/blob';

function getBlobToken(req) {
  if (process.env.BLOB_READ_WRITE_TOKEN && process.env.BLOB_READ_WRITE_TOKEN.startsWith('vercel_blob_rw_')) {
    return process.env.BLOB_READ_WRITE_TOKEN;
  }
  return 'vercel_blob_rw_5tUK9cDxqnqjrZw4_XkW85LSec1NCakUeDwzKwNi6s2KYNg';
}

/**
 * Serverless API Route: GET /api/avatar/view?pathname=...
 * Obtiene y transmite imágenes almacenadas en Vercel Blob de forma segura
 */
export default async function handler(req, res) {
  try {
    const pathnameParam = req.query.pathname || req.query.path || req.query.filename;
    if (!pathnameParam) {
      return res.status(400).send('Se requiere el parámetro pathname.');
    }

    const cleanPath = String(pathnameParam).replace(/^\/+/, '');
    const token = getBlobToken(req);

    if (!token) {
      return res.status(404).send('Token de Blob no disponible');
    }

    let result = null;
    try {
      result = await get(cleanPath, {
        access: 'private',
        token
      });
    } catch (e) {
      result = await get(cleanPath, {
        access: 'public',
        token
      });
    }

    if (!result) {
      return res.status(404).send('Archivo no encontrado en Vercel Blob');
    }

    const contentType = (result.blob && result.blob.contentType) || 
                        (result.headers && result.headers.get && result.headers.get('content-type')) || 
                        'image/webp';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (result.stream) {
      const reader = result.stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      return res.end();
    } else if (result.blob) {
      const arrayBuffer = await result.blob.arrayBuffer();
      return res.end(Buffer.from(arrayBuffer));
    }

    return res.status(404).send('No se pudo leer la imagen');
  } catch (err) {
    console.error('[Avatar View Error]:', err);
    return res.status(500).send(err.message);
  }
}
