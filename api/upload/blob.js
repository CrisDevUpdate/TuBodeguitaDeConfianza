import { put, list } from '@vercel/blob';
import path from 'path';

const FALLBACK_BLOB_TOKEN = 'vercel_blob_rw_5tUK9cDxqnqjrZw4_XkW85LSec1NCakUeDwzKwNi6s2KYNg';
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/tubodeguitadeconfianza/databases/(default)/documents';

function resolveBlobToken(req) {
  const headerToken = req.headers['x-blob-token'];
  if (typeof headerToken === 'string' && headerToken.startsWith('vercel_blob_rw_')) {
    return headerToken;
  }
  if (process.env.BLOB_READ_WRITE_TOKEN && process.env.BLOB_READ_WRITE_TOKEN.startsWith('vercel_blob_rw_')) {
    return process.env.BLOB_READ_WRITE_TOKEN;
  }
  return FALLBACK_BLOB_TOKEN;
}

/**
 * Serverless API Route unificada: /api/upload/blob
 * Atiende (vía rewrites en vercel.json):
 *   - POST /api/upload/blob
 *   - POST /api/avatar/upload
 *   - GET  /api/blob/list (?action=list)
 *   - POST /api/blob/sync-firestore-images (?action=sync)
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-blob-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = (req.query && typeof req.query.action === 'string' ? req.query.action : '').trim().toLowerCase();
  const blobToken = resolveBlobToken(req);

  // 1. Listado de archivos en Vercel Blob (/api/blob/list)
  if (action === 'list' || (req.method === 'GET' && !action)) {
    try {
      const { blobs } = await list({ token: blobToken, limit: 250 });
      const items = (blobs || []).map((b) => ({
        pathname: b.pathname,
        size: b.size,
        uploadedAt: b.uploadedAt,
        url: b.url,
        viewUrl: `/api/avatar/view?pathname=${encodeURIComponent(b.pathname)}`
      }));
      return res.status(200).json({ success: true, count: items.length, blobs: items });
    } catch (err) {
      console.error('[API Blob List]:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 2. Migración de fotos Base64 de Firestore a Vercel Blob con respaldo automático (/api/blob/sync-firestore-images)
  if (action === 'sync') {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Método no permitido. Utilizar POST.' });
    }
    try {
      const allDocs = [];
      let pageToken = '';
      do {
        const url = `${FIRESTORE_BASE}/productos?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
        const fsRes = await fetch(url);
        const fsData = await fsRes.json();
        if (fsData && Array.isArray(fsData.documents)) {
          allDocs.push(...fsData.documents);
        }
        pageToken = fsData && fsData.nextPageToken ? fsData.nextPageToken : '';
      } while (pageToken);

      const results = [];
      for (const doc of allDocs) {
        const id = doc.name.split('/').pop();
        const f = doc.fields || {};
        const nombre = (f.nombre && f.nombre.stringValue) || id;
        const img = (f.imagen && f.imagen.stringValue) || '';

        if (img && img.startsWith('data:')) {
          try {
            const parts = img.split(',');
            const mimeMatch = parts[0].match(/:(.*?);/);
            const mime = mimeMatch ? mimeMatch[1] : 'image/webp';
            const buf = Buffer.from(parts[1] || '', 'base64');
            const ext = mime.includes('png') ? 'png' : mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : 'webp';
            const targetName = `productos/prod_${id}.${ext}`;

            const vRes = await put(targetName, buf, {
              access: 'private',
              token: blobToken,
              contentType: mime,
              allowOverwrite: true
            });

            const viewUrl = `/api/avatar/view?pathname=${encodeURIComponent(vRes.pathname)}`;

            const backupRes = await fetch(`${FIRESTORE_BASE}/respaldo_imagenes_productos/${encodeURIComponent(id)}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fields: {
                  productoId: { stringValue: id },
                  nombre: { stringValue: nombre },
                  imagenBase64: { stringValue: img },
                  blobPathname: { stringValue: vRes.pathname },
                  blobUrl: { stringValue: viewUrl },
                  respaldadoEn: { stringValue: new Date().toISOString() }
                }
              })
            });

            if (!backupRes.ok) {
              throw new Error(`No se pudo guardar respaldo en Firebase (${backupRes.status})`);
            }

            const patchRes = await fetch(`${FIRESTORE_BASE}/productos/${encodeURIComponent(id)}?updateMask.fieldPaths=imagen`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fields: {
                  imagen: { stringValue: viewUrl }
                }
              })
            });

            if (!patchRes.ok) {
              throw new Error(`No se pudo actualizar producto ${id} (${patchRes.status})`);
            }

            results.push({ id, nombre, status: 'migrated_to_blob', pathname: vRes.pathname, viewUrl, backedUpInFirebase: true });
          } catch (itemErr) {
            results.push({ id, nombre, status: 'error', error: itemErr.message });
          }
        } else if (img) {
          results.push({ id, nombre, status: 'already_url', url: img.substring(0, 80) });
        }
      }

      return res.status(200).json({ success: true, total: allDocs.length, processed: results });
    } catch (err) {
      console.error('[API Blob Sync]:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 3. Subida de imagen a Vercel Blob (/api/upload/blob y /api/avatar/upload)
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
      } catch {
        bodyObj = null;
      }
    }

    const folder = (bodyObj && bodyObj.folder) || queryFolder || 'productos';
    let rawFilename = queryFilename || (bodyObj && bodyObj.filename) || `upload_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.webp`;
    rawFilename = String(rawFilename).replace(/\\/g, '/').replace(/^\/+/, '');

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
          } catch {}
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
