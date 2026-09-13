import React, { useState } from 'react';

/**
 * /components/PendingApprovalView.jsx
 * Vista de Gatewall para Solicitud en Revisión con Corrección de Datos en Vivo
 * Sincroniza con Firestore y bloquea el acceso a las rutas hasta aprobación del SuperAdmin.
 */
export default function PendingApprovalView({ 
  user = {}, 
  onCheckApproval, 
  onUpdateUserData, 
  onLogout 
}) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    nombre: user?.nombre || '',
    cedula: user?.cedula || user?.id || '',
    telefono: user?.telefono || '',
    email: user?.email || '',
    rol: user?.rol || 'cliente'
  });
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!formData.nombre || !formData.cedula || !formData.telefono || !formData.email) {
      alert('Todos los campos son requeridos para actualizar tu solicitud.');
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);
    try {
      if (typeof onUpdateUserData === 'function') {
        await onUpdateUserData(formData);
      }
      setIsEditModalOpen(false);
      setStatusMessage('¡Tus datos han sido actualizados exitosamente!');
    } catch (err) {
      alert('Error al actualizar datos: ' + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  const waNumber = '584120000000';
  const waMsg = encodeURIComponent(
    `Hola Administrador de Tu Bodeguita de Confianza. Mi nombre es ${user?.nombre || formData.nombre} (Cédula: ${user?.cedula || formData.cedula}). Acabo de registrarme y solicito la aprobación de mi cuenta.`
  );
  const waUrl = `https://wa.me/${waNumber}?text=${waMsg}`;

  return (
    <div className="gatewall-container" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a, #1e293b)',
      padding: '20px'
    }}>
      <div className="gatewall-card" style={{
        background: '#ffffff',
        borderRadius: '16px',
        maxWidth: '480px',
        width: '100%',
        padding: '32px 24px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
        textAlign: 'center'
      }}>
        {/* Ícono de Estado en Espera */}
        <div style={{
          width: '68px',
          height: '68px',
          borderRadius: '50%',
          background: '#fef3c7',
          color: '#d97706',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2rem',
          margin: '0 auto 16px auto',
          boxShadow: '0 4px 12px rgba(217, 119, 6, 0.2)'
        }}>
          <i className="fas fa-clock fa-spin"></i>
        </div>

        <h3 style={{ color: '#0f172a', margin: '0 0 6px 0', fontSize: '1.4rem' }}>
          Solicitud en Revisión
        </h3>
        <p style={{ color: '#64748b', fontSize: '0.92rem', lineHeight: '1.5', margin: '0 0 20px 0' }}>
          Tu cuenta ha sido creada exitosamente y se encuentra en estado <strong>PENDIENTE DE APROBACIÓN</strong> por el Administrador.
        </p>

        {statusMessage && (
          <div style={{
            background: '#dcfce7',
            color: '#16a34a',
            padding: '10px',
            borderRadius: '8px',
            fontSize: '0.88rem',
            marginBottom: '16px',
            fontWeight: '600'
          }}>
            {statusMessage}
          </div>
        )}

        {/* Resumen Fiel de Datos Registrados */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'left',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ color: '#64748b', fontSize: '0.88rem' }}>Cédula / RIF:</span>
            <strong style={{ color: '#0f172a', fontSize: '0.92rem' }}>{user?.cedula || user?.id || formData.cedula || '—'}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ color: '#64748b', fontSize: '0.88rem' }}>Solicitante:</span>
            <strong style={{ color: '#0f172a', fontSize: '0.92rem' }}>{user?.nombre || formData.nombre || '—'}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ color: '#64748b', fontSize: '0.88rem' }}>Teléfono:</span>
            <strong style={{ color: '#0f172a', fontSize: '0.92rem' }}>{user?.telefono || formData.telefono || '—'}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ color: '#64748b', fontSize: '0.88rem' }}>Correo:</span>
            <strong style={{ color: '#0f172a', fontSize: '0.92rem' }}>{user?.email || formData.email || '—'}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ color: '#64748b', fontSize: '0.88rem' }}>Rol solicitado:</span>
            <span style={{
              background: '#e0f2fe',
              color: '#0369a1',
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              fontWeight: '700',
              textTransform: 'uppercase'
            }}>
              {user?.rol || formData.rol || 'CLIENTE'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
            <span style={{ color: '#64748b', fontSize: '0.88rem' }}>Fecha de registro:</span>
            <strong style={{ color: '#0f172a', fontSize: '0.88rem' }}>
              {user?.fechaRegistro || new Date().toLocaleDateString('es-VE')}
            </strong>
          </div>
        </div>

        {/* Acciones del Gatewall */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button 
            type="button" 
            onClick={() => setIsEditModalOpen(true)}
            style={{
              padding: '11px',
              background: '#f1f5f9',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              fontWeight: '700',
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <i className="fas fa-user-pen"></i> Editar mis datos
          </button>

          <a 
            href={waUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{
              padding: '12px',
              background: '#25d366',
              color: '#ffffff',
              borderRadius: '10px',
              fontWeight: '700',
              fontSize: '0.92rem',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 10px rgba(37, 211, 102, 0.25)'
            }}
          >
            <i className="fab fa-whatsapp" style={{ fontSize: '1.2rem' }}></i> Notificar al Administrador por WhatsApp
          </a>

          <button 
            type="button" 
            onClick={onCheckApproval}
            style={{
              padding: '11px',
              background: '#ffffff',
              color: '#2563eb',
              border: '1px solid #bfdbfe',
              borderRadius: '10px',
              fontWeight: '600',
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <i className="fas fa-rotate"></i> Comprobar Estado de Aprobación
          </button>

          <button 
            type="button" 
            onClick={onLogout}
            style={{
              padding: '10px',
              background: 'transparent',
              color: '#ef4444',
              border: 'none',
              fontWeight: '600',
              fontSize: '0.88rem',
              cursor: 'pointer',
              marginTop: '4px'
            }}
          >
            <i className="fas fa-arrow-right-from-bracket"></i> Salir / Iniciar con otra cuenta
          </button>
        </div>
      </div>

      {/* Modal Interactivo de Corrección de Datos */}
      {isEditModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '14px',
            maxWidth: '440px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ margin: 0, color: '#0f172a', fontSize: '1.15rem' }}>
                <i className="fas fa-user-edit" style={{ color: '#2563eb', marginRight: '8px' }}></i>
                Corregir Mis Datos
              </h4>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#94a3b8' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                  Nombre y Apellido *
                </label>
                <input 
                  type="text" 
                  name="nombre" 
                  value={formData.nombre} 
                  onChange={handleInputChange}
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                  Cédula / RIF *
                </label>
                <input 
                  type="text" 
                  name="cedula" 
                  value={formData.cedula} 
                  onChange={handleInputChange}
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                  Teléfono / WhatsApp *
                </label>
                <input 
                  type="tel" 
                  name="telefono" 
                  value={formData.telefono} 
                  onChange={handleInputChange}
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                  Correo Electrónico *
                </label>
                <input 
                  type="email" 
                  name="email" 
                  value={formData.email} 
                  onChange={handleInputChange}
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setIsEditModalOpen(false)}
                  style={{ padding: '9px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  style={{ padding: '9px 18px', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' }}
                >
                  {isSaving ? 'Guardando...' : 'Guardar y Reenviar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
