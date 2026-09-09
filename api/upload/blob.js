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

    // Si existe el token de Vercel Blob en las variables de entorno
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      // Convertir base64 a Buffer si viene como data URI
      let buffer;
      if (fileData.startsWith('data:')) {
        const base64Data = fileData.split(',')[1];
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        buffer = Buffer.from(fileData, 'base64');
      }

      const blob = await put(targetPath, buffer, {
        access: 'public',
        contentType: contentType || 'image/jpeg'
      });

      return res.status(200).json({
        success: true,
        url: blob.url,
        downloadUrl: blob.downloadUrl,
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
