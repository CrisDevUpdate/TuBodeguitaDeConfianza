import { put } from '@vercel/blob';
import path from 'path';

const FALLBACK_BLOB_TOKEN = 'vercel_blob_rw_5tUK9cDxqnqjrZw4_XkW85LSec1NCakUeDwzKwNi6s2KYNg';

/**
 * Serverless API Route: /api/upload/blob (y /api/avatar/upload)
 * Sube imágenes a Vercel Blob Storage y retorna URL persistente vía proxy seguro.
 * Soporta tanto JSON ({ filename, folder, fileData, contentType }) como cuerpo binario directo.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-blob-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido. Utilizar POST.' });
  }

  try {
    const queryFilename = req.query && typeof req.query.filename === 'string' ? req.query.filename : '';
    const queryFolder = req.query && typeof req.query.folder === 'string' ? req.query.folder : '';

    let bodyObj = null;
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body) && !(req.body instanceof Uint8Array)) {
      bodyObj = req.body;
    } else if (typeof req.body === 'string' && req.body.trim().startsWith('{')) {
      try {
        bodyObj = JSON.parse(req.body);
      } catch (e) {
        bodyObj = null;
      }
    }

    const folder = (bodyObj && bodyObj.folder) || queryFolder || 'productos';
    let rawFilename = queryFilename || (bodyObj && bodyObj.filename) || `upload_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.webp`;
    rawFilename = String(rawFilename).replace(/\\/g, '/').replace(/^\/+/, '');

    // Evitar prefijos duplicados como "productos/productos/..." o "avatars/productos/..."
    const targetPath = rawFilename.includes('/') ? rawFilename : `${folder}/${rawFilename}`;

    let buffer = null;
    let contentType = (bodyObj && bodyObj.contentType) || req.headers['content-type'] || 'image/webp';

    if (bodyObj && bodyObj.fileData && typeof bodyObj.fileData === 'string') {
      const fileData = bodyObj.fileData;
      if (fileData.startsWith('data:')) {
        const parts = fileData.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        if (mimeMatch) contentType = mimeMatch[1];
        buffer = Buffer.from(parts[1] || '', 'base64');
      } else {
        buffer = Buffer.from(fileData, 'base64');
      }
    } else if (Buffer.isBuffer(req.body) && req.body.length > 0) {
      buffer = req.body;
    } else if (req.body instanceof Uint8Array && req.body.length > 0) {
      buffer = Buffer.from(req.body);
    } else if (typeof req.body === 'string' && req.body.length > 0) {
      if (req.body.startsWith('data:')) {
        const parts = req.body.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        if (mimeMatch) contentType = mimeMatch[1];
        buffer = Buffer.from(parts[1] || '', 'base64');
      } else {
        buffer = Buffer.from(req.body, 'binary');
      }
    } else if (req.readable) {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      if (chunks.length > 0) {
        const rawBuf = Buffer.concat(chunks);
        const headerCt = String(req.headers['content-type'] || '').toLowerCase();
        if (headerCt.includes('application/json')) {
          try {
            const parsed = JSON.parse(rawBuf.toString('utf8'));
            if (parsed && parsed.fileData) {
              const fd = parsed.fileData;
              if (fd.startsWith('data:')) {
                const parts = fd.split(',');
                const mimeMatch = parts[0].match(/:(.*?);/);
                if (mimeMatch) contentType = mimeMatch[1];
                buffer = Buffer.from(parts[1] || '', 'base64');
              } else {
                buffer = Buffer.from(fd, 'base64');
              }
              if (parsed.contentType) contentType = parsed.contentType;
            }
          } catch (e) {}
        } else {
          buffer = rawBuf;
        }
      }
    }

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere el contenido del archivo (fileData en base64 o cuerpo binario).'
      });
    }

    if (!contentType || contentType.includes('application/json') || contentType.includes('application/octet-stream')) {
      const ext = path.extname(targetPath).toLowerCase();
      contentType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.svg' ? 'image/svg+xml' : 'image/webp';
    }

    const headerToken = req.headers['x-blob-token'];
    const blobToken =
      (typeof headerToken === 'string' && headerToken.startsWith('vercel_blob_rw_'))
        ? headerToken
        : (process.env.BLOB_READ_WRITE_TOKEN && process.env.BLOB_READ_WRITE_TOKEN.startsWith('vercel_blob_rw_'))
          ? process.env.BLOB_READ_WRITE_TOKEN
          : FALLBACK_BLOB_TOKEN;

    let blob = null;
    try {
      blob = await put(targetPath, buffer, {
        access: 'private',
        token: blobToken,
        contentType,
        allowOverwrite: true
      });
    } catch (privErr) {
      if (privErr.message && (privErr.message.includes('public') || privErr.message.includes('access'))) {
        blob = await put(targetPath, buffer, {
          access: 'public',
          token: blobToken,
          contentType,
          allowOverwrite: true
        });
      } else {
        throw privErr;
      }
    }

    const viewUrl = `/api/avatar/view?pathname=${encodeURIComponent(blob.pathname)}`;

    return res.status(200).json({
      success: true,
      url: viewUrl,
      viewUrl,
      rawUrl: blob.url,
      rawDirectUrl: blob.url,
      downloadUrl: viewUrl,
      pathname: blob.pathname,
      contentType: blob.contentType || contentType,
      provider: 'vercel-blob'
    });
  } catch (error) {
    console.error('[API Upload Blob] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error procesando subida de archivo'
    });
  }
}
