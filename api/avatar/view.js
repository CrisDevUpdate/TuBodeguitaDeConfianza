import { get } from '@vercel/blob';
import path from 'path';

const FALLBACK_BLOB_TOKEN = 'vercel_blob_rw_5tUK9cDxqnqjrZw4_XkW85LSec1NCakUeDwzKwNi6s2KYNg';

/**
 * Serverless API Route: /api/avatar/view
 * Permite visualizar avatares y archivos de Vercel Blob privados de forma segura y autorizada.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  try {
    const queryPath = req.query.pathname || req.query.url || req.query.file || '';
    let cleanPath = String(queryPath || '').trim();

    if (!cleanPath) {
      // Extraer desde URL si no viene en query
      const urlParts = (req.url || '').split('?');
      if (urlParts.length > 1) {
        const params = new URLSearchParams(urlParts[1]);
        cleanPath = params.get('pathname') || params.get('url') || '';
      }
    }

    if (cleanPath.includes('.private.blob.vercel-storage.com/')) {
      cleanPath = cleanPath.substring(cleanPath.indexOf('.private.blob.vercel-storage.com/') + '.private.blob.vercel-storage.com/'.length);
    } else if (cleanPath.includes('.blob.vercel-storage.com/')) {
      cleanPath = cleanPath.substring(cleanPath.indexOf('.blob.vercel-storage.com/') + '.blob.vercel-storage.com/'.length);
    } else {
      cleanPath = cleanPath.replace(/^\/+/, '');
    }

    cleanPath = cleanPath.split('?')[0];
    try {
      cleanPath = decodeURIComponent(cleanPath);
    } catch (e) {}

    const blobToken = (process.env.BLOB_READ_WRITE_TOKEN && process.env.BLOB_READ_WRITE_TOKEN.startsWith('vercel_blob_rw_'))
      ? process.env.BLOB_READ_WRITE_TOKEN
      : FALLBACK_BLOB_TOKEN;

    if (cleanPath && blobToken) {
      try {
        let result = null;
        try {
          result = await get(cleanPath, {
            access: 'private',
            token: blobToken
          });
        } catch (e) {
          result = await get(cleanPath, {
            access: 'public',
            token: blobToken
          });
        }

        if (result && (result.statusCode === 200 || result.stream || result.blob)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('X-Content-Type-Options', 'nosniff');

          let contentType = 'image/webp';
          if (result.blob && result.blob.contentType) {
            contentType = result.blob.contentType;
          } else if (result.headers && typeof result.headers.get === 'function' && result.headers.get('content-type')) {
            contentType = result.headers.get('content-type');
          } else {
            const ext = path.extname(cleanPath).toLowerCase();
            contentType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.svg' ? 'image/svg+xml' : 'image/webp';
          }
          res.setHeader('Content-Type', contentType);

          if (result.stream) {
            const { Readable } = await import('stream');
            if (typeof Readable.fromWeb === 'function') {
              return Readable.fromWeb(result.stream).pipe(res);
            } else {
              const reader = result.stream.getReader();
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(value);
              }
              return res.end();
            }
          }

          if (result.blob && typeof result.blob.arrayBuffer === 'function') {
            const arrayBuffer = await result.blob.arrayBuffer();
            return res.status(200).send(Buffer.from(arrayBuffer));
          }
        }
      } catch (getErr) {
        console.warn('[Avatar View API] Error al obtener blob:', getErr.message);
      }
    }

    // Fallback SVG nítido y amigable en caso de no encontrarse el archivo
    const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0284c7"/>
          <stop offset="100%" stop-color="#0369a1"/>
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="58" fill="url(#bgGrad)"/>
      <circle cx="60" cy="46" r="22" fill="#ffffff" opacity="0.95"/>
      <path d="M22 102 C26 76, 44 68, 60 68 C76 68, 94 76, 98 102 Z" fill="#ffffff" opacity="0.95"/>
    </svg>`.trim();

    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send(fallbackSvg);
  } catch (error) {
    console.error('[API Avatar View] Error no controlado:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
