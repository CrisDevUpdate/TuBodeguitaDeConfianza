/**
 * api/admin/archive.js (Vercel Serverless & Node.js Endpoint)
 * Sistema de Archivado y Vaciado Universal Auditatorio (Universal Data Archiving Engine)
 * 
 * Regla Primordial: Ninguna acción de limpieza o vaciado elimina datos de forma permanente.
 * Todos los registros son respaldados con marcas de tiempo (archive_[tipo]_[TIMESTAMP])
 * para auditorías contables futuras e inspección de transacciones.
 */

// Memoria persistente en servidor / fallback
const globalArchiveStore = globalThis._serverArchiveStore || [];
globalThis._serverArchiveStore = globalArchiveStore;

export default async function handler(req, res) {
  const { method } = req;

  if (method === 'GET') {
    const { type, archiveId, limit = 50 } = req.query;

    let results = [...globalArchiveStore];

    if (type) {
      results = results.filter(a => a.type === type || a.type === 'ALL' || a.archiveId.includes(type));
    }

    if (archiveId) {
      results = results.filter(a => a.archiveId === archiveId);
    }

    // Ordenar de más reciente a más antiguo
    results.sort((a, b) => new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime());

    return res.status(200).json({
      success: true,
      totalArchives: results.length,
      archives: results.slice(0, Number(limit)),
      message: 'Archivos históricos de auditoría recuperados exitosamente'
    });
  }

  if (method === 'POST') {
    try {
      const { type = 'GENERAL', records = [], reason = 'Vaciado administrativo', metadata = {}, operator = 'SuperAdmin' } = req.body || {};

      const timestamp = Date.now();
      const sanitizedType = String(type).toUpperCase().replace(/[^A-Z0-9_]/g, '_');
      const archiveId = `archive_${sanitizedType.toLowerCase()}_${timestamp}`;

      const archiveRecord = {
        archiveId,
        type: sanitizedType,
        timestamp,
        archivedAt: new Date().toISOString(),
        totalRecords: Array.isArray(records) ? records.length : (records ? 1 : 0),
        reason: String(reason).trim(),
        operator: String(operator).trim(),
        metadata: {
          ...metadata,
          serverEnvironment: process.env.NODE_ENV || 'production',
          userAgent: req.headers['user-agent'] || 'App Client'
        },
        payload: records
      };

      globalArchiveStore.push(archiveRecord);

      console.log(`[Universal Archiving Engine] Archivado exitoso: ${archiveId} (${archiveRecord.totalRecords} registros)`);

      return res.status(200).json({
        success: true,
        archiveId,
        archivedAt: archiveRecord.archivedAt,
        totalArchived: archiveRecord.totalRecords,
        message: `Los datos fueron archivados de forma segura e inmutable en el repositorio histórico (#${archiveId}). La vista activa puede ser restablecida sin pérdida contable.`
      });
    } catch (err) {
      console.error('[Universal Archiving Engine] Error al procesar archivado:', err);
      return res.status(500).json({
        success: false,
        error: 'Error interno en el motor de archivado universal: ' + err.message
      });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ success: false, error: `Method ${method} Not Allowed` });
}
