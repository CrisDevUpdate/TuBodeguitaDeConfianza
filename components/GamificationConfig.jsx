import React, { useState, useEffect, useCallback } from 'react';

/**
 * /components/GamificationConfig.jsx
 * Módulo de Gamificación & Temporada de Invierno
 * Conexión reactiva atómica con Firestore: /config/gamification { isWinterMode: boolean }
 */

export default function GamificationConfig({ onStatusChange = null }) {
  const [isWinterMode, setIsWinterMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Helper para obtener la instancia de Firestore
  const getFirestore = useCallback(() => {
    if (typeof window !== 'undefined' && window.firebase && typeof window.firebase.firestore === 'function') {
      return window.firebase.firestore();
    }
    return null;
  }, []);

  // Función para aplicar la visibilidad inmediata de puntos en toda la app (Catálogo y Carrito)
  const applyPointsVisibility = useCallback((winterActive) => {
    // 1. Inyectar / actualizar regla de estilo global para catálogo y carrito
    let styleTag = document.getElementById('winter-mode-global-style');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'winter-mode-global-style';
      document.head.appendChild(styleTag);
    }

    if (winterActive) {
      styleTag.textContent = `
        .cliente-prod-points-badge,
        .combo-points-badge,
        #cliente-carrito-puntos-row,
        .puntos-premio-row,
        [data-points-badge] {
          display: none !important;
        }
      `;
    } else {
      styleTag.textContent = '';
    }

    // 2. Ocultar o mostrar de forma imperativa en el DOM existente
    const catalogBadges = document.querySelectorAll('.cliente-prod-points-badge, .combo-points-badge, [data-points-badge]');
    catalogBadges.forEach(el => {
      el.style.display = winterActive ? 'none' : '';
    });

    const carritoPuntosRow = document.getElementById('cliente-carrito-puntos-row');
    if (carritoPuntosRow) {
      carritoPuntosRow.style.display = winterActive ? 'none' : 'flex';
    }

    const carritoPuntosPreview = document.getElementById('cliente-carrito-puntos-preview');
    if (carritoPuntosPreview && winterActive) {
      carritoPuntosPreview.textContent = '+0 Pts';
    }

    // 3. Sincronizar AppState global
    if (typeof window !== 'undefined' && window.AppState) {
      window.AppState.isWinterMode = winterActive;
      window.AppState.temporadaInviernoActiva = winterActive;
      if (window.AppState.premioMes) {
        window.AppState.premioMes.temporadaActiva = !winterActive;
      }
    }

    // 4. Refrescar vistas conectadas si existen
    if (typeof window.renderizarCatalogoCliente === 'function') {
      window.renderizarCatalogoCliente();
    }
    if (typeof window.renderizarCarritoCliente === 'function') {
      window.renderizarCarritoCliente();
    }
    if (typeof window.renderizarPremioMesCliente === 'function') {
      window.renderizarPremioMesCliente();
    }
    if (window.InventoryApp?.Catalog && typeof window.InventoryApp.Catalog.renderizar === 'function') {
      window.InventoryApp.Catalog.renderizar();
    }
  }, []);

  // Suscripción en tiempo real a Firestore: /config/gamification
  useEffect(() => {
    let unsubscribe = null;
    const db = getFirestore();

    const applyInitialFallback = () => {
      const fallbackState = Boolean(
        window.AppState?.isWinterMode ?? 
        window.AppState?.temporadaInviernoActiva ?? 
        (window.AppState?.premioMes?.temporadaActiva === false)
      );
      setIsWinterMode(fallbackState);
      applyPointsVisibility(fallbackState);
      setLoading(false);
    };

    if (db) {
      try {
        const configDocRef = db.collection('config').doc('gamification');
        unsubscribe = configDocRef.onSnapshot(
          (docSnap) => {
            if (docSnap.exists) {
              const data = docSnap.data();
              const winterActive = Boolean(data?.isWinterMode);
              setIsWinterMode(winterActive);
              applyPointsVisibility(winterActive);
              if (onStatusChange) onStatusChange(winterActive);
            } else {
              applyInitialFallback();
            }
            setLoading(false);
          },
          (err) => {
            console.warn('[GamificationConfig] Firestore onSnapshot fallback:', err.message);
            applyInitialFallback();
          }
        );
      } catch (err) {
        console.warn('[GamificationConfig] Error en suscripción a Firestore:', err);
        applyInitialFallback();
      }
    } else {
      applyInitialFallback();
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [getFirestore, applyPointsVisibility, onStatusChange]);

  // Handler principal: Conmutación del Modo Invierno en Firestore y Estado Global
  const handleToggleWinterMode = async () => {
    if (saving) return;
    setSaving(true);
    const newStatus = !isWinterMode;

    try {
      // 1. Actualización inmediata en UI y estado local reactivo
      setIsWinterMode(newStatus);
      applyPointsVisibility(newStatus);

      // 2. Escritura directa en Firestore: /config/gamification
      const db = getFirestore();
      if (db) {
        await db.collection('config').doc('gamification').set({
          isWinterMode: newStatus,
          updatedAt: new Date().toISOString(),
          updatedBy: 'Admin'
        }, { merge: true });

        // Espejo en configuracion/gamificacion para redundancia de seguridad
        await db.collection('configuracion').doc('gamificacion').set({
          isWinterMode: newStatus,
          temporadaInviernoActiva: newStatus,
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(() => {});
      }

      // 3. Persistencia local para contingencia offline
      if (window.InventoryApp?.Persistence?.guardar) {
        window.InventoryApp.Persistence.guardar(true);
      }

      // 4. Notificación visual al usuario
      const msg = newStatus
        ? '❄️ Modo Invierno Activado: Puntos ocultos en catálogo y carrito en 0 Pts.'
        : '☀️ Modo Regular Restaurado: Puntos visibles y acumulación activa.';
      
      setToastMessage(msg);
      setTimeout(() => setToastMessage(null), 4000);

      if (window.InventoryApp?.Modal?.toast) {
        window.InventoryApp.Modal.toast(msg, newStatus ? 'info' : 'success');
      }

      if (onStatusChange) onStatusChange(newStatus);
    } catch (error) {
      console.error('[GamificationConfig] Error conmutando Modo Invierno:', error);
      // Rollback visual si la escritura falla
      setIsWinterMode(!newStatus);
      applyPointsVisibility(!newStatus);
      alert('Error al sincronizar con Firestore: ' + (error.message || 'Error desconocido'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="gamification-config-card" style={{
      background: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      marginBottom: '20px'
    }}>
      {/* Encabezado del Módulo */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '16px',
        borderBottom: '1px solid #f1f5f9',
        paddingBottom: '14px'
      }}>
        <div>
          <h3 style={{
            margin: 0,
            fontSize: '1.2rem',
            color: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 800
          }}>
            <span style={{ fontSize: '1.3rem' }}>❄️</span> Módulo de Gamificación & Temporada de Invierno
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            Control de ciclo estacional de puntos y recompensas de fidelización.
          </p>
        </div>

        <div>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.82rem',
            fontWeight: 800,
            padding: '6px 14px',
            borderRadius: '9999px',
            background: isWinterMode ? '#e0f2fe' : '#dcfce7',
            color: isWinterMode ? '#0369a1' : '#15803d',
            border: isWinterMode ? '1px solid #bae6fd' : '1px solid #bbf7d0'
          }}>
            <span>{isWinterMode ? '❄️' : '⚙️'}</span>
            {isWinterMode ? 'Temporada de Invierno ACTIVA' : 'Temporada Regular (Puntos Activos)'}
          </span>
        </div>
      </div>

      {/* Contenedor del Interruptor */}
      <div style={{
        background: isWinterMode ? '#f0f9ff' : '#f8fafc',
        border: `1px solid ${isWinterMode ? '#bae6fd' : '#e2e8f0'}`,
        borderRadius: '10px',
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div style={{ flex: 1, minWidth: '280px' }}>
          <strong style={{
            color: isWinterMode ? '#0284c7' : '#334155',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '1.1rem' }}>🔘</span>
            Interruptor: Activar Modo Temporada de Invierno
          </strong>
          <p style={{
            margin: '6px 0 0 0',
            fontSize: '0.84rem',
            color: '#64748b',
            lineHeight: 1.45
          }}>
            Al activar el invierno, <b>se ocultan los puntos en el catálogo</b>, <b>se congela la acumulación de nuevos puntos</b> y el árbol muestra el diseño invernal con bufanda y chistes/mensajes humorísticos sobre el frío cuando los clientes consultan sus premios.
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={handleToggleWinterMode}
            disabled={loading || saving}
            style={{
              padding: '11px 20px',
              fontWeight: 800,
              fontSize: '0.9rem',
              borderRadius: '8px',
              border: 'none',
              cursor: (loading || saving) ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              color: '#ffffff',
              background: isWinterMode ? '#dc2626' : '#2563eb',
              boxShadow: isWinterMode 
                ? '0 4px 12px rgba(220, 38, 38, 0.25)' 
                : '0 4px 12px rgba(37, 99, 235, 0.25)',
              transition: 'all 0.2s ease',
              opacity: (loading || saving) ? 0.7 : 1
            }}
          >
            <span>{isWinterMode ? '☀️' : '❄️'}</span>
            {saving 
              ? 'Sincronizando Firestore...' 
              : isWinterMode 
                ? 'Desactivar Invierno (Volver a Regular)' 
                : 'Activar Temporada de Invierno ❄️'
            }
          </button>
        </div>
      </div>

      {/* Alerta de Notificación Flotante */}
      {toastMessage && (
        <div style={{
          marginTop: '12px',
          padding: '10px 14px',
          borderRadius: '8px',
          fontSize: '0.85rem',
          fontWeight: 700,
          background: isWinterMode ? '#f0fdf4' : '#eff6ff',
          color: isWinterMode ? '#15803d' : '#1d4ed8',
          border: isWinterMode ? '1px solid #bbf7d0' : '1px solid #bfdbfe',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>{isWinterMode ? '✅' : 'ℹ️'}</span>
          {toastMessage}
        </div>
      )}
    </div>
  );
}
