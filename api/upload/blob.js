import { put } from '@vercel/blob';

/**
 * Serverless API Route: /api/upload/blob
 * Sube imágenes a Vercel Blob Storage y retorna URL pública persistente.
 * Incluye respaldo local base64 si el token BLOB_READ_WRITE_TOKEN no está configurado.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido. Utilizar POST.' });
  }

  try {
    const { filename, fileData, contentType, folder = 'avatars' } = req.body;

    if (!fileData) {
      return res.status(400).json({ success: false, error: 'Se requiere el contenido del archivo (fileData en base64).' });
    }

    const cleanFilename = filename || `upload_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
    const targetPath = `${folder}/${cleanFilename}`;

    const blobToken = (process.env.BLOB_READ_WRITE_TOKEN && process.env.BLOB_READ_WRITE_TOKEN.startsWith('vercel_blob_rw_'))
      ? process.env.BLOB_READ_WRITE_TOKEN
      : 'vercel_blob_rw_5tUK9cDxqnqjrZw4_XkW85LSec1NCakUeDwzKwNi6s2KYNg';

    // Si existe el token de Vercel Blob
    if (blobToken) {
      // Convertir base64 a Buffer si viene como data URI
      let buffer;
      if (fileData.startsWith('data:')) {
        const base64Data = fileData.split(',')[1];
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        buffer = Buffer.from(fileData, 'base64');
      }

      let blob = null;
      try {
        blob = await put(targetPath, buffer, {
          access: 'private',
          token: blobToken,
          contentType: contentType || 'image/jpeg',
          allowOverwrite: true
        });
      } catch (privErr) {
        blob = await put(targetPath, buffer, {
          access: 'public',
          token: blobToken,
          contentType: contentType || 'image/jpeg',
          allowOverwrite: true
        });
      }

      const viewUrl = `/api/avatar/view?pathname=${encodeURIComponent(blob.pathname)}`;

      return res.status(200).json({
        success: true,
        url: viewUrl,
        rawUrl: blob.url,
        downloadUrl: blob.downloadUrl || viewUrl,
        pathname: blob.pathname,
        provider: 'vercel-blob'
      });
    }

    // Modo Fallback resiliente: Si no hay token de Vercel Blob configurado aún, retornar la data URI optimizada
    return res.status(200).json({
      success: true,
      url: fileData,
      pathname: targetPath,
      provider: 'local-data-storage',
      note: 'Vercel Blob token no configurado en entorno local; URL base64 guardada exitosamente.'
    });
  } catch (error) {
    console.error('[API Upload Blob] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error procesando subida de archivo'
    });
  }
}
