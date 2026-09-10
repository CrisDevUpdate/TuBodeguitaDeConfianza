import React, { useState, useEffect, useMemo } from 'react';

/**
 * /components/CartCheckoutModal.jsx
 * Modal de Carrito & Checkout con Selector Multibanco Dinámico y Portapapeles
 * Reactividad con Modo Invierno: Oculta fila de Puntos y fija ganancia en 0 Pts si isWinterMode === true.
 */

// Estructura extensible para N bancos
export const DEFAULT_BANK_ACCOUNTS = [
  { id: 'bdv_pm', type: 'Pago Móvil', bank: 'Banco de Venezuela (0102)', phone: '0412-5363849', idNumber: 'V-28.123.456', titular: 'Tu Bodeguita' },
  { id: 'banesco_pm', type: 'Pago Móvil', bank: 'Banesco (0134)', phone: '0412-5363849', idNumber: 'V-28.123.456', titular: 'Tu Bodeguita' },
  { id: 'mercantil_pm', type: 'Pago Móvil', bank: 'Mercantil (0105)', phone: '0412-5363849', idNumber: 'V-28.123.456', titular: 'Tu Bodeguita' },
  { id: 'bdv_trans', type: 'Transferencia', bank: 'Banco de Venezuela', account: '01025646546664', idNumber: 'V-28.123.456', titular: 'Tu Bodeguita' }
];

export default function CartCheckoutModal({
  isOpen = true,
  onClose = () => {},
  cartItems = [],
  exchangeRate = 0,
  customer = null,
  bankAccounts = DEFAULT_BANK_ACCOUNTS,
  onProcessOrder = () => {}
}) {
  const [selectedBankId, setSelectedBankId] = useState(bankAccounts[0]?.id || 'bdv_pm');
  const [copiedKey, setCopiedKey] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('Crédito');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [comment, setComment] = useState('');
  const [isWinterMode, setIsWinterMode] = useState(false);

  // Sincronización de Modo Invierno desde Firestore (/config/gamification) y AppState
  useEffect(() => {
    let unsubscribe = null;

    if (typeof window !== 'undefined') {
      const checkLocalWinter = () => {
        return Boolean(
          window.AppState?.isWinterMode ?? 
          window.AppState?.temporadaInviernoActiva ?? 
          (window.AppState?.premioMes?.temporadaActiva === false)
        );
      };
      setIsWinterMode(checkLocalWinter());

      if (window.firebase && typeof window.firebase.firestore === 'function') {
        try {
          const db = window.firebase.firestore();
          unsubscribe = db.collection('config').doc('gamification').onSnapshot((doc) => {
            if (doc.exists) {
              setIsWinterMode(Boolean(doc.data()?.isWinterMode));
            } else {
              setIsWinterMode(checkLocalWinter());
            }
          }, () => {
            setIsWinterMode(checkLocalWinter());
          });
        } catch (e) {
          setIsWinterMode(checkLocalWinter());
        }
      }
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Banco actualmente seleccionado
  const selectedBank = useMemo(() => {
    return bankAccounts.find(b => b.id === selectedBankId) || bankAccounts[0];
  }, [bankAccounts, selectedBankId]);

  // Cálculos de Totales y Puntos
  const totalUSD = useMemo(() => {
    return (cartItems || []).reduce((sum, item) => sum + (Number(item.cantidad || 0) * Number(item.precio || 0)), 0);
  }, [cartItems]);

  const effectiveRate = Number(exchangeRate || (typeof window !== 'undefined' ? window.AppState?.tasaActiva || window.AppState?.tasaUSD_BCV : 0) || 0);
  const totalVES = effectiveRate > 0 ? (totalUSD * effectiveRate) : 0;

  // Si isWinterMode === true: Ganancia de puntos se fija estrictamente en 0
  const pointsEarned = useMemo(() => {
    if (isWinterMode) return 0;
    const ptsRatio = Number(typeof window !== 'undefined' ? window.AppState?.premioMes?.puntosPorDolar : 1) || 1;
    return Math.floor(totalUSD * ptsRatio);
  }, [totalUSD, isWinterMode]);

  // Manejo de Portapapeles con feedback temporal
  const copyToClipboard = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2200);
    }).catch(() => {
      // Fallback para entornos con restricciones
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2200);
    });
  };

  // Copiar todos los datos de la cuenta seleccionada
  const copyAllBankDetails = () => {
    if (!selectedBank) return;
    const lines = [
      `*Datos de Pago - ${selectedBank.bank}*`,
      `• Tipo: ${selectedBank.type}`,
      selectedBank.phone ? `• Teléfono: ${selectedBank.phone}` : null,
      selectedBank.account ? `• Nro de Cuenta: ${selectedBank.account}` : null,
      selectedBank.idNumber ? `• C.I / RIF: ${selectedBank.idNumber}` : null,
      selectedBank.titular ? `• Titular: ${selectedBank.titular}` : null
    ].filter(Boolean).join('\n');

    copyToClipboard(lines, 'all');
  };

  if (!isOpen) return null;

  return (
    <div className="cart-checkout-modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(3px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '16px'
    }}>
      <div className="cart-checkout-modal-card" style={{
        background: '#ffffff',
        borderRadius: '16px',
        maxWidth: '540px',
        width: '100%',
        maxHeight: '92vh',
        overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e2e8f0',
        padding: '22px'
      }}>
        {/* Encabezado del Modal */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          borderBottom: '1px solid #f1f5f9',
          paddingBottom: '12px'
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '1.2rem',
            color: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 800
          }}>
            <span style={{ color: '#2563eb' }}>🛒</span> Mi Carrito de Compras
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              fontWeight: 'bold',
              fontSize: '1.1rem'
            }}
          >
            ✕
          </button>
        </div>

        {/* Resumen Financiero y Reactividad de Puntos */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '14px 18px',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ color: '#64748b', fontSize: '0.95rem', fontWeight: 600 }}>Total a Pagar (USD):</span>
            <strong style={{ fontSize: '1.35rem', color: '#1d4ed8', fontWeight: 900 }}>
              ${totalUSD.toFixed(2)}
            </strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isWinterMode ? '0' : '8px' }}>
            <span style={{ color: '#64748b', fontSize: '0.95rem', fontWeight: 600 }}>Total en Bolívares (VES):</span>
            <strong style={{ fontSize: '1.2rem', color: '#16a34a', fontWeight: 800 }}>
              Bs. {totalVES > 0 ? totalVES.toFixed(2) : '0.00'}
            </strong>
          </div>

          {/* REGLA ESTRICTA: Si isWinterMode === true se OCULTA POR COMPLETO la fila de Puntos */}
          {!isWinterMode && (
            <div id="cliente-carrito-puntos-row" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px dashed #cbd5e1',
              paddingTop: '8px'
            }}>
              <span style={{ color: '#d97706', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🏆</span> Puntos para el Premio del Mes:
              </span>
              <strong id="cliente-carrito-puntos-preview" style={{ color: '#d97706', fontSize: '1.05rem', fontWeight: 900 }}>
                +{pointsEarned} Pts
              </strong>
            </div>
          )}
        </div>

        {/* SELECTOR MULTIBANCO DINÁMICO */}
        <div style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '18px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <strong style={{ color: '#1e40af', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🏦</span> Cuentas para Pago Móvil y Transferencias:
            </strong>
          </div>

          {/* Menú Desplegable <select> Dinámico de Entidades Bancarias */}
          <div style={{ marginBottom: '12px' }}>
            <label htmlFor="select-multibanco-cart" style={{ display: 'block', fontSize: '0.8rem', color: '#1e40af', fontWeight: 700, marginBottom: '4px' }}>
              Selecciona el Banco Destino:
            </label>
            <select
              id="select-multibanco-cart"
              value={selectedBankId}
              onChange={(e) => setSelectedBankId(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #93c5fd',
                background: '#ffffff',
                color: '#1e3a8a',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              {bankAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.type}: {account.bank}
                </option>
              ))}
            </select>
          </div>

          {/* Tarjeta de Detalles del Banco Seleccionado con Botones de Copiado */}
          {selectedBank && (
            <div style={{
              background: '#ffffff',
              border: '1px solid #dbeafe',
              borderRadius: '10px',
              padding: '12px 14px',
              boxShadow: '0 1px 3px rgba(30, 64, 175, 0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 800, color: '#1e40af', fontSize: '0.88rem' }}>
                  {selectedBank.bank}
                </span>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  background: selectedBank.type === 'Pago Móvil' ? '#dbeafe' : '#fef3c7',
                  color: selectedBank.type === 'Pago Móvil' ? '#1d4ed8' : '#b45309'
                }}>
                  {selectedBank.type}
                </span>
              </div>

              {/* Teléfono Pago Móvil */}
              {selectedBank.phone && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '0.82rem', color: '#475569' }}>
                    Teléfono: <strong style={{ color: '#0f172a' }}>{selectedBank.phone}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(selectedBank.phone, 'phone')}
                    style={{
                      background: copiedKey === 'phone' ? '#10b981' : '#eff6ff',
                      color: copiedKey === 'phone' ? '#ffffff' : '#2563eb',
                      border: '1px solid #bfdbfe',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {copiedKey === 'phone' ? '✓ Copiado' : 'Copiar'}
                  </button>
                </div>
              )}

              {/* C.I / RIF */}
              {selectedBank.idNumber && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '0.82rem', color: '#475569' }}>
                    C.I / RIF: <strong style={{ color: '#0f172a' }}>{selectedBank.idNumber}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(selectedBank.idNumber, 'idNumber')}
                    style={{
                      background: copiedKey === 'idNumber' ? '#10b981' : '#eff6ff',
                      color: copiedKey === 'idNumber' ? '#ffffff' : '#2563eb',
                      border: '1px solid #bfdbfe',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {copiedKey === 'idNumber' ? '✓ Copiado' : 'Copiar'}
                  </button>
                </div>
              )}

              {/* Número de Cuenta (Transferencia) */}
              {selectedBank.account && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '0.82rem', color: '#475569' }}>
                    Cuenta: <strong style={{ color: '#0f172a', letterSpacing: '0.5px' }}>{selectedBank.account}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(selectedBank.account, 'account')}
                    style={{
                      background: copiedKey === 'account' ? '#10b981' : '#eff6ff',
                      color: copiedKey === 'account' ? '#ffffff' : '#2563eb',
                      border: '1px solid #bfdbfe',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {copiedKey === 'account' ? '✓ Copiado' : 'Copiar'}
                  </button>
                </div>
              )}

              {/* Titular */}
              {selectedBank.titular && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                  <span style={{ fontSize: '0.82rem', color: '#475569' }}>
                    Titular: <strong style={{ color: '#0f172a' }}>{selectedBank.titular}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(selectedBank.titular, 'titular')}
                    style={{
                      background: copiedKey === 'titular' ? '#10b981' : '#eff6ff',
                      color: copiedKey === 'titular' ? '#ffffff' : '#2563eb',
                      border: '1px solid #bfdbfe',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {copiedKey === 'titular' ? '✓ Copiado' : 'Copiar'}
                  </button>
                </div>
              )}

              {/* Botón Maestro: Copiar todos los datos */}
              <button
                type="button"
                onClick={copyAllBankDetails}
                style={{
                  width: '100%',
                  marginTop: '8px',
                  background: copiedKey === 'all' ? '#16a34a' : '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '7px',
                  padding: '7px 12px',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'background 0.2s ease'
                }}
              >
                <span>{copiedKey === 'all' ? '✅' : '📋'}</span>
                {copiedKey === 'all' ? '¡Todos los datos copiados con éxito!' : 'Copiar todos los datos de este banco'}
              </button>
            </div>
          )}
        </div>

        {/* Formulario de Checkout */}
        <form onSubmit={(e) => {
          e.preventDefault();
          onProcessOrder({
            paymentMethod,
            referenceNumber,
            comment,
            selectedBank,
            totalUSD,
            totalVES,
            pointsEarned
          });
        }}>
          {/* Método de Pago */}
          <div style={{ marginBottom: '14px' }}>
            <label htmlFor="cart-checkout-payment-method" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
              Método de Pago <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <select
              id="cart-checkout-payment-method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontWeight: 700,
                fontSize: '0.92rem',
                color: '#1e293b'
              }}
            >
              <option value="Crédito">⭐ Crédito / Fiado (Confirmación Directa x WhatsApp)</option>
              <option value="Pago Móvil VES">Pago Móvil (Bolívares VES)</option>
              <option value="Transferencia Bancaria VES">Transferencia Bancaria (Bolívares VES)</option>
              <option value="Efectivo USD">Efectivo ($ Dólares)</option>
              <option value="Efectivo VES">Efectivo (Bs. Bolívares)</option>
            </select>
          </div>

          {/* Número de Referencia */}
          <div style={{ marginBottom: '14px' }}>
            <label htmlFor="cart-checkout-ref" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
              Número de Referencia de Pago {paymentMethod !== 'Crédito' && <span style={{ color: '#dc2626' }}>*</span>}
            </label>
            <input
              type="text"
              id="cart-checkout-ref"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder={paymentMethod === 'Crédito' ? 'Opcional para Crédito' : 'Ej: Últimos 4 o 6 dígitos'}
              required={paymentMethod !== 'Crédito'}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
                background: '#f8fafc',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Comentario u Observación */}
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="cart-checkout-comment" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
              Comentario u Observación (Opcional)
            </label>
            <input
              type="text"
              id="cart-checkout-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ej: Entregar en la tarde, billete de $20, etc."
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
                background: '#f8fafc',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Botones de Envío */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="submit"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                background: '#2563eb',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.95rem',
                cursor: 'pointer'
              }}
            >
              Confirmar Compra
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#64748b',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              Seguir Comprando
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
