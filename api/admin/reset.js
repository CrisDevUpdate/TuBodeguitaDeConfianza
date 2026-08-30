/**
 * api/admin/reset.js (Vercel Serverless Function & Standalone Handler)
 * MÓDULO 2: Reinicio General de Fábrica (Hard-Reset) - Exclusivo SuperAdmin
 * 
 * Mecanismo de Seguridad y Truncado por Reemplazo:
 * - Valida clave de SuperAdmin ('1810' o hash SHA-256).
 * - Preserva intacto al usuario SuperAdmin.
 * - Archiva el historial anterior con marca de tiempo.
 * - Restablece a cero ventas, deudas, auditorías, inventario, usuarios secundarios y gamificación (0%).
 */

import crypto from 'crypto';

// In-memory archive storage
const archiveVault = [];

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido. Utiliza POST.' });
  }

  try {
    const { adminPassword, confirmationKeyword, previousData } = req.body || {};

    // 1. Validar Palabra de Confirmación
    if (!confirmationKeyword || String(confirmationKeyword).trim().toUpperCase() !== 'CONFIRMAR') {
      return res.status(400).json({
        success: false,
        error: 'Palabra de seguridad inválida. Debes escribir "CONFIRMAR" exactamente.'
      });
    }

    // 2. Validar Clave de SuperAdmin
    const HASH_SUPERADMIN_DEFAULT = '1a09807a0e6928a66d91025ed5fccd713c9edb101e72a1bbcb8a01cd9a53cb51';
    let inputHash = '';
    if (adminPassword) {
      inputHash = crypto.createHash('sha256').update(String(adminPassword).trim()).digest('hex');
    }

    if (adminPassword !== '1810' && inputHash !== HASH_SUPERADMIN_DEFAULT) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales de SuperAdmin inválidas. Acceso denegado al Hard-Reset.'
      });
    }

    // 3. Archivar datos previos con Timestamp
    const timestamp = new Date().toISOString();
    const archiveRecord = {
      archiveId: `ARCHIVE_${Date.now()}`,
      archivedAt: timestamp,
      totalSalesArchived: Array.isArray(previousData?.ventas) ? previousData.ventas.length : 0,
      totalProductsArchived: Array.isArray(previousData?.productos) ? previousData.productos.length : 0,
      totalClientsArchived: Array.isArray(previousData?.clientes) ? previousData.clientes.length : 0,
      snapshot: previousData || null
    };
    archiveVault.push(archiveRecord);

    // 4. Estructura Virgen de Producción
    const superAdminUser = {
      id: 'SuperAdmin',
      cedula: 'SuperAdmin',
      nombre: 'SuperAdmin',
      telefono: '0412-0000000',
      email: 'superadmin@tubodeguita.com',
      password: HASH_SUPERADMIN_DEFAULT,
      rol: 'admin',
      estado: 'ACTIVO',
      puntosAcumulados: 0,
      puntosCanjeados: 0,
      fechaRegistro: timestamp.replace('T', ' ').substring(0, 16)
    };

    const cleanState = {
      productos: [],
      clientes: [],
      ventas: [],
      abonos: [],
      transacciones: [],
      auditorias: [],
      eliminaciones: [],
      clientesEliminados: [],
      conteosFisicos: {},
      carrito: [],
      canjesPremios: [],
      nextProductSequence: 1,
      usuarios: [superAdminUser],
      usuarioActual: superAdminUser,
      premioMes: {
        nombre: 'Premio del Mes',
        puntosRequeridos: 200,
        puntosPorDolar: 1,
        imagen: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600&auto=format&fit=crop&q=80',
        descripcion: 'Premio exclusivo del mes para nuestros clientes más fieles.',
        mes: 'Mes en Curso',
        temporadaActiva: true
      },
      treeProgress: {
        porcentaje: 0,
        puntosActuales: 0,
        puntosMeta: 200,
        ciclo: 1
      }
    };

    return res.status(200).json({
      success: true,
      message: '✅ Reinicio General de Fábrica ejecutado con éxito. Estado 100% virgen instanciado.',
      archiveInfo: {
        archiveId: archiveRecord.archiveId,
        archivedAt: archiveRecord.archivedAt
      },
      cleanState
    });

  } catch (error) {
    console.error('[API Reset Error]', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno durante el reinicio de fábrica: ' + (error.message || error)
    });
  }
}
