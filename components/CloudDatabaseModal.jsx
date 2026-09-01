import React, { useState } from 'react';

/**
 * /components/CloudDatabaseModal.jsx
 * Modal de Administración de Base de Datos en la Nube con Segregación RBAC Estricta.
 * Acceso Exclusivo para SuperAdmin y Administrador. Bloqueado para Clientes y Vendedores.
 */
export default function CloudDatabaseModal({
  isOpen,
  onClose,
  currentUser,
  stats = { productos: 0, clientes: 0, ventas: 0, transacciones: 0 },
  onForceSync,
  onExportJson,
  onConnectDrive,
  onFactoryReset
}) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  // RBAC Estricto: Si no es Admin/SuperAdmin, bloquear completamente
  const rol = (currentUser?.rol || '').toLowerCase();
  const isAdmin = (rol === 'admin' || rol === 'superadmin') && currentUser?.estado === 'ACTIVO';

  if (!isOpen) return null;

  if (!isAdmin) {
    return (
      <div className="modal-overlay" style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
      }}>
        <div style={{
          background: '#ffffff', borderRadius: '14px', maxWidth: '420px', width: '90%',
          padding: '24px', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
        }}>
          <div style={{
            width: '54px', height: '54px', borderRadius: '50%', background: '#fee2e2',
            color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.6rem', margin: '0 auto 12px auto'
          }}>
            <i className="fas fa-lock"></i>
          </div>
          <h3 style={{ color: '#0f172a', margin: '0 0 6px 0' }}>Acceso Restringido</h3>
          <p style={{ color: '#64748b', fontSize: '0.88rem', margin: '0 0 18px 0' }}>
            Este módulo de base de datos en la nube está reservado exclusivamente para el Administrador del sistema.
          </p>
          <button 
            onClick={onClose}
            style={{
              padding: '10px 20px', background: '#0f172a', color: '#ffffff',
              border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600'
            }}
          >
            Entendido
          </button>
        </div>
      </div>
    );
  }

  const handleSyncClick = async () => {
    setIsSyncing(true);
    setSyncSuccess(false);
    try {
      if (typeof onForceSync === 'function') {
        await onForceSync();
      }
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 2500);
    } catch (err) {
      alert('Error en sincronización: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px'
    }}>
      <div style={{
        background: '#ffffff', borderRadius: '16px', maxWidth: '580px', width: '100%',
        padding: '28px 24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', maxHeight: '90vh', overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
              <i className="fas fa-cloud-bolt"></i>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>Gestión de Base de Datos en la Nube</h3>
              <small style={{ color: '#64748b' }}>Firebase Firestore & Copias de Seguridad</small>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#94a3b8' }}>&times;</button>
        </div>

        {/* Resumen de Entidades */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Productos</span>
            <strong style={{ fontSize: '1.2rem', color: '#0f172a' }}>{stats.productos}</strong>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Clientes</span>
            <strong style={{ fontSize: '1.2rem', color: '#0f172a' }}>{stats.clientes}</strong>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Ventas</span>
            <strong style={{ fontSize: '1.2rem', color: '#0f172a' }}>{stats.ventas}</strong>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Transac.</span>
            <strong style={{ fontSize: '1.2rem', color: '#0f172a' }}>{stats.transacciones}</strong>
          </div>
        </div>

        {/* Acciones Administrativas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button 
            type="button"
            onClick={handleSyncClick}
            disabled={isSyncing}
            style={{
              padding: '12px', background: syncSuccess ? '#16a34a' : '#2563eb', color: '#ffffff',
              border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}
          >
            <i className={`fas ${isSyncing ? 'fa-spinner fa-spin' : syncSuccess ? 'fa-check' : 'fa-rotate'}`}></i>
            {isSyncing ? 'Sincronizando con Firestore...' : syncSuccess ? '¡Sincronización Exitosa!' : 'Forzar Sincronización Nube'}
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button 
              type="button"
              onClick={onExportJson}
              style={{
                padding: '11px', background: '#f8fafc', color: '#334155',
                border: '1px solid #cbd5e1', borderRadius: '10px', fontWeight: '600', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
            >
              <i className="fas fa-file-arrow-down"></i> Exportar Respaldo JSON
            </button>

            <button 
              type="button"
              onClick={onConnectDrive}
              style={{
                padding: '11px', background: '#f8fafc', color: '#334155',
                border: '1px solid #cbd5e1', borderRadius: '10px', fontWeight: '600', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
            >
              <i className="fab fa-google-drive"></i> Google Drive Backup
            </button>
          </div>

          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '14px', marginTop: '6px' }}>
            <button 
              type="button"
              onClick={onFactoryReset}
              style={{
                width: '100%', padding: '11px', background: '#fff1f2', color: '#e11d48',
                border: '1px solid #fecdd3', borderRadius: '10px', fontWeight: '700', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
            >
              <i className="fas fa-triangle-exclamation"></i> Reinicio General de Fábrica
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
