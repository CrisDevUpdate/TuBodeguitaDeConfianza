import React, { useState, useMemo } from 'react';

/**
 * /components/CustomerPayments.jsx
 * Pasarela de Abonos y Pagos del Cliente con Selector de Bancos (Venezuela & Mercantil),
 * Copiado Individual/Global de Datos de Pago Móvil, Cálculo Bimoneda en Tiempo Real
 * y Registro Seguro de Comprobantes en Firestore / LocalState.
 */

export const BANK_CONFIGS = [
  {
    id: 'bcv_venezuela',
    nombre: 'Banco de Venezuela (0102)',
    shortName: 'Venezuela',
    tipo: 'Pago Móvil & Transferencia',
    bancoCodigo: '0102',
    telefono: '0412-1234567',
    cedula: 'V-20123456',
    cuenta: '0102-0123-45-0000123456',
    titular: 'Tu Bodeguita De Confianza C.A.',
    color: '#b91c1c',
    badge: 'Recomendado'
  },
  {
    id: 'mercantil',
    nombre: 'Banco Mercantil (0105)',
    shortName: 'Mercantil',
    tipo: 'Pago Móvil & Transferencia',
    bancoCodigo: '0105',
    telefono: '0414-7654321',
    cedula: 'J-501234567',
    cuenta: '0105-0987-65-0000987654',
    titular: 'Tu Bodeguita De Confianza C.A.',
    color: '#0369a1',
    badge: 'Disponible'
  }
];

export default function CustomerPayments({
  currentUser = {},
  clientAccount = { saldoDeudorUSD: 0, limiteCreditoUSD: 50 },
  exchangeRate = 0,
  paymentHistory = [],
  onSubmitPayment
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState(BANK_CONFIGS[0].id);
  const [amountEntered, setAmountEntered] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Pago Móvil VES');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedBank = useMemo(() => {
    return BANK_CONFIGS.find(b => b.id === selectedBankId) || BANK_CONFIGS[0];
  }, [selectedBankId]);

  const isDivisa = paymentMethod === 'Efectivo USD' || paymentMethod.includes('USD') || paymentMethod.includes('Divisa');
  const numericEntered = parseFloat(amountEntered) || 0;

  const numericUSD = isDivisa 
    ? numericEntered 
    : (exchangeRate > 0 ? (numericEntered / exchangeRate) : 0);
  const numericVES = isDivisa 
    ? (exchangeRate > 0 ? (numericEntered * exchangeRate) : 0) 
    : numericEntered;

  const equivalentVES = numericVES.toFixed(2);
  const equivalentUSD = numericUSD.toFixed(2);
  const deudaUSD = Number(clientAccount?.saldoDeudorUSD || 0);

  const copyToClipboard = async (text, key) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (e) {
      console.warn('Error al copiar:', e);
    }
  };

  const copyAllBankData = () => {
    const fullText = `DATOS DE PAGO - ${selectedBank.nombre}\n` +
      `• Banco: ${selectedBank.nombre}\n` +
      `• Teléfono Pago Móvil: ${selectedBank.telefono}\n` +
      `• Cédula/RIF: ${selectedBank.cedula}\n` +
      `• Nro. Cuenta: ${selectedBank.cuenta}\n` +
      `• Titular: ${selectedBank.titular}\n` +
      (isDivisa 
        ? `• Monto: $${numericUSD.toFixed(2)} USD (Equiv. Bs. ${equivalentVES})`
        : `• Monto: Bs. ${numericVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })} (Equiv. $${equivalentUSD} USD)`);
    copyToClipboard(fullText, 'ALL');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (numericEntered <= 0) {
      alert('Por favor ingresa un monto válido a abonar.');
      return;
    }
    if (!referenceNumber.trim()) {
      alert('Debes ingresar el número de referencia del comprobante bancario.');
      return;
    }

    setIsSubmitting(true);
    try {
      const paymentPayload = {
        id: `ABN_${Date.now()}`,
        clienteId: currentUser?.cedula || currentUser?.id,
        clienteNombre: currentUser?.nombre || 'Cliente',
        montoUSD: Number(numericUSD.toFixed(2)),
        montoVES: Number(numericVES.toFixed(2)),
        esDivisasUSD: isDivisa,
        monedaOriginal: isDivisa ? 'USD' : 'VES',
        tasaMomento: exchangeRate,
        banco: selectedBank.nombre,
        formaPago: paymentMethod,
        metodo: paymentMethod,
        referencia: referenceNumber.trim(),
        nota: notes.trim(),
        fecha: new Date().toISOString().replace('T', ' ').substring(0, 16),
        estado: 'PENDIENTE_CONFIRMACION',
        registradoPor: 'CLIENTE'
      };

      if (typeof onSubmitPayment === 'function') {
        await onSubmitPayment(paymentPayload);
      }

      setIsModalOpen(false);
      setAmountEntered('');
      setReferenceNumber('');
      setNotes('');
      const alertMsg = isDivisa 
        ? `¡Abono en divisas de $${numericUSD.toFixed(2)} USD reportado con éxito!` 
        : `¡Abono de Bs. ${numericVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })} reportado con éxito!`;
      alert(`${alertMsg} Se encuentra en verificación.`);
    } catch (err) {
      alert('Error al reportar abono: ' + (err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="customer-payments-container" style={{ padding: '16px 0' }}>
      {/* Resumen de Deuda y Botón de Pago Rápido */}
      <div style={{
        background: deudaUSD > 0 ? 'linear-gradient(135deg, #451a03, #78350f)' : 'linear-gradient(135deg, #064e3b, #047857)',
        color: '#ffffff',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)'
      }}>
        <div>
          <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9 }}>
            {deudaUSD > 0 ? 'Saldo Deudor Pendiente' : 'Estado de Cuenta al Día'}
          </span>
          <div style={{ fontSize: '2rem', fontWeight: '800', marginTop: '4px' }}>
            ${deudaUSD.toFixed(2)} USD
          </div>
          <small style={{ opacity: 0.85, fontSize: '0.9rem' }}>
            Equivalente BCV: Bs. {(deudaUSD * (exchangeRate || 0)).toFixed(2)}
          </small>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          style={{
            background: '#ffffff',
            color: deudaUSD > 0 ? '#b45309' : '#047857',
            padding: '12px 24px',
            borderRadius: '12px',
            border: 'none',
            fontWeight: '700',
            fontSize: '1rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}
        >
          <i className="fas fa-hand-holding-dollar"></i> Reportar Nuevo Abono
        </button>
      </div>

      {/* Floating Action Button (FAB) para Mobile y Desktop */}
      <button 
        type="button" 
        className="customer-fab-payment"
        onClick={() => setIsModalOpen(true)}
        title="Reportar Abono / Pago"
      >
        <i className="fas fa-money-bill-transfer"></i>
        <span>Hacer Abono</span>
      </button>

      {/* Modal de Pago / Pasarela de Abonos */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '18px', maxWidth: '520px', width: '100%',
            padding: '24px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fas fa-money-bill-transfer" style={{ color: '#2563eb' }}></i> Reportar Abono / Pago
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#94a3b8' }}
              >
                &times;
              </button>
            </div>

            {/* Selector de Banco Destino */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>
                Selecciona la Cuenta Bancaria Destino:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {BANK_CONFIGS.map(bank => (
                  <div
                    key={bank.id}
                    onClick={() => setSelectedBankId(bank.id)}
                    style={{
                      border: `2px solid ${selectedBankId === bank.id ? bank.color : '#e2e8f0'}`,
                      background: selectedBankId === bank.id ? `${bank.color}0a` : '#f8fafc',
                      borderRadius: '10px',
                      padding: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <strong style={{ display: 'block', fontSize: '0.9rem', color: bank.color }}>{bank.shortName}</strong>
                    <small style={{ color: '#64748b', fontSize: '0.75rem' }}>{bank.bancoCodigo}</small>
                  </div>
                ))}
              </div>
            </div>

            {/* Ficha de Datos Bancarios con Copiado Rápido */}
            <div style={{
              background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px',
              padding: '14px', marginBottom: '18px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: '700', color: selectedBank.color }}>
                  {selectedBank.nombre}
                </span>
                <button
                  type="button"
                  onClick={copyAllBankData}
                  style={{
                    background: copiedKey === 'ALL' ? '#16a34a' : '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  <i className="fas fa-copy"></i> {copiedKey === 'ALL' ? '¡Todos Copiados!' : 'Copiar Todos los Datos'}
                </button>
              </div>

              {/* Teléfono */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #e2e8f0' }}>
                <div>
                  <small style={{ color: '#64748b', display: 'block' }}>Teléfono Pago Móvil:</small>
                  <strong style={{ color: '#0f172a', fontSize: '0.92rem' }}>{selectedBank.telefono}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(selectedBank.telefono, 'TEL')}
                  style={{ padding: '3px 8px', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  {copiedKey === 'TEL' ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>

              {/* Cédula */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #e2e8f0' }}>
                <div>
                  <small style={{ color: '#64748b', display: 'block' }}>Cédula / RIF:</small>
                  <strong style={{ color: '#0f172a', fontSize: '0.92rem' }}>{selectedBank.cedula}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(selectedBank.cedula, 'CED')}
                  style={{ padding: '3px 8px', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  {copiedKey === 'CED' ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>

              {/* Cuenta Bancaria */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}>
                <div>
                  <small style={{ color: '#64748b', display: 'block' }}>Número de Cuenta:</small>
                  <code style={{ color: '#0f172a', fontSize: '0.82rem' }}>{selectedBank.cuenta}</code>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(selectedBank.cuenta, 'CTA')}
                  style={{ padding: '3px 8px', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  {copiedKey === 'CTA' ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            {/* Formulario de Reporte de Pago */}
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  Forma de Pago Utilizada *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                >
                  <option value="Pago Móvil VES">📱 Pago Móvil (Bs. VES)</option>
                  <option value="Transferencia Bancaria VES">🏦 Transferencia Bancaria (Bs. VES)</option>
                  <option value="Efectivo USD">💵 Efectivo ($ USD)</option>
                  <option value="Efectivo VES">🇻🇪 Efectivo (Bs. VES)</option>
                </select>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  {isDivisa ? 'Monto a Abonar en Divisas ($ USD) *' : 'Monto a Abonar en Bolívares (Bs. VES) *'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amountEntered}
                  onChange={(e) => setAmountEntered(e.target.value)}
                  placeholder={isDivisa ? 'Ej: 20.00' : 'Ej: 1000.00'}
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', fontWeight: '700', boxSizing: 'border-box' }}
                />
                <small style={{ color: isDivisa ? '#16a34a' : '#0284c7', fontWeight: '700', display: 'block', marginTop: '4px' }}>
                  {isDivisa 
                    ? `Equivalente en Bolívares: Bs. ${equivalentVES} (Tasa: ${exchangeRate > 0 ? exchangeRate.toFixed(2) : '—'})`
                    : `Equivalente en Divisas ($ USD): $${equivalentUSD} USD (Tasa: ${exchangeRate > 0 ? exchangeRate.toFixed(2) : '—'})`}
                </small>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  Número de Referencia Bancaria *
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="Últimos dígitos del comprobante"
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  Nota u Observación (Opcional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: Abono de la semana"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ padding: '10px 18px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{ padding: '10px 22px', background: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' }}
                >
                  {isSubmitting ? 'Procesando...' : 'Enviar Reporte de Pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
