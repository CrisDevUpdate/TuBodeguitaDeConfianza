import { put } from '@vercel/blob';

const FALLBACK_BLOB_TOKEN = 'vercel_blob_rw_5tUK9cDxqnqjrZw4_XkW85LSec1NCakUeDwzKwNi6s2KYNg';
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/tubodeguitadeconfianza/databases/(default)/documents';

/**
 * Serverless API Route: /api/blob/sync-firestore-images
 * Migra imágenes Base64 de productos desde Firestore hacia Vercel Blob,
 * guardando SIEMPRE un respaldo completo en la colección `respaldo_imagenes_productos`
 * antes de reemplazar `productos/{id}.imagen` por la URL liviana de Vercel Blob.
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
    const headerToken = req.headers['x-blob-token'];
    const token =
      (typeof headerToken === 'string' && headerToken.startsWith('vercel_blob_rw_'))
        ? headerToken
        : (process.env.BLOB_READ_WRITE_TOKEN && process.env.BLOB_READ_WRITE_TOKEN.startsWith('vercel_blob_rw_'))
          ? process.env.BLOB_READ_WRITE_TOKEN
          : FALLBACK_BLOB_TOKEN;

    // Obtener todos los productos con paginación
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

          // 1. Subir imagen a Vercel Blob
          const vRes = await put(targetName, buf, {
            access: 'private',
            token,
            contentType: mime,
            allowOverwrite: true
          });

          const viewUrl = `/api/avatar/view?pathname=${encodeURIComponent(vRes.pathname)}`;

          // 2. Guardar respaldo completo de la imagen Base64 en Firestore ANTES de modificar el producto
          const backupUrl = `${FIRESTORE_BASE}/respaldo_imagenes_productos/${encodeURIComponent(id)}`;
          const backupRes = await fetch(backupUrl, {
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
            throw new Error(`No se pudo confirmar el respaldo en Firebase (${backupRes.status})`);
          }

          // 3. Actualizar documento del producto con la URL liviana de Vercel Blob
          const patchUrl = `${FIRESTORE_BASE}/productos/${encodeURIComponent(id)}?updateMask.fieldPaths=imagen`;
          const patchRes = await fetch(patchUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fields: {
                imagen: { stringValue: viewUrl }
              }
            })
          });

          if (!patchRes.ok) {
            throw new Error(`Error actualizando producto ${id} (${patchRes.status})`);
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
    console.error('[API Sync Firestore Images Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
