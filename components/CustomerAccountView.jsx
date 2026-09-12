import React, { useMemo } from 'react';

/**
 * /components/CustomerAccountView.jsx
 * Vista Móvil Rediseñada de "Mi Cuenta" para el Rol CLIENTE.
 * 
 * Características:
 * 1. Clean Hero Header: Avatar sutil, saludo en negrita, badge de puntos y píldora minimalista de tasa BCV.
 * 2. Hero Wallet Card: Billetera digital con gradiente elegante (índigo/esmeralda), saldo en USD/VES y botón CTA directo.
 * 3. 2x2 Grid Metrics: Cuadrícula compacta y limpia (Total Comprado, Total Abonado, Pedidos Activos, Puntos por Liberar).
 * 4. Card-Based Lists: Tarjetas de transacción sin tablas rígidas ni overflow horizontal roto.
 * 5. Cero ruido administrativo: Selector de tema visual trasladado a "Perfil" y padding-bottom seguro para barra móvil.
 */

export default function CustomerAccountView({
  currentUser = {},
  sales = [],
  payments = [],
  exchangeRate = 0,
  onOpenPaymentModal
}) {
  const cedula = currentUser?.cedula || currentUser?.id || '';
  const tasa = Number(exchangeRate || 0);

  // Filtrar ventas del cliente actual
  const clientSales = useMemo(() => {
    return (sales || []).filter(v => v.clienteId === cedula || v.clienteId === currentUser?.id);
  }, [sales, cedula, currentUser?.id]);

  // Filtrar abonos del cliente actual
  const clientPayments = useMemo(() => {
    return (payments || []).filter(a => a.clienteId === cedula || a.clienteId === currentUser?.id);
  }, [payments, cedula, currentUser?.id]);

  // Abonos aprobados/conciliados
  const approvedPayments = useMemo(() => {
    return clientPayments.filter(a => 
      a.estado === 'Pago agregado' || 
      a.estado === 'Confirmado' || 
      a.estado === 'APROBADO' || 
      !a.estado
    );
  }, [clientPayments]);

  // Cálculos financieros
  const totalCompradoUSD = useMemo(() => {
    return clientSales.reduce((sum, v) => sum + Number(v.total || 0), 0);
  }, [clientSales]);

  const totalCreditoUSD = useMemo(() => {
    return clientSales
      .filter(v => v.tipo === 'Crédito' || v.tipo === 'credito')
      .reduce((sum, v) => sum + Number(v.total || 0), 0);
  }, [clientSales]);

  const totalAbonadoUSD = useMemo(() => {
    return approvedPayments.reduce((sum, a) => {
      const usdVal = Number(a.montoUSD || 0);
      const vesVal = Number(a.montoVES || 0);
      if (usdVal > 0) return sum + usdVal;
      if (vesVal > 0 && tasa > 0) return sum + (vesVal / tasa);
      return sum + Number(a.monto || 0);
    }, 0);
  }, [approvedPayments, tasa]);

  const saldoDeudaUSD = Math.max(0, Number((totalCreditoUSD - totalAbonadoUSD).toFixed(2)));
  const saldoDeudaVES = tasa > 0 ? saldoDeudaUSD * tasa : 0;
  const totalCompradoVES = tasa > 0 ? totalCompradoUSD * tasa : 0;
  const totalAbonadoVES = tasa > 0 ? totalAbonadoUSD * tasa : 0;

  const esSolvente = saldoDeudaUSD <= 0.01;

  // Puntos pendientes por liberar de compras a crédito aún no saldadas
  const puntosPorLiberar = useMemo(() => {
    if (esSolvente) return 0;
    return clientSales
      .filter(v => (v.tipo === 'Crédito' || v.tipo === 'credito') && v.puntosOtorgados)
      .reduce((sum, v) => sum + Number(v.puntosOtorgados || 0), 0);
  }, [clientSales, esSolvente]);

  // Formato para bolívares venezolanos
  const formatVES = (val) => {
    return Number(val || 0).toLocaleString('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  return (
    <div className="customer-account-container" id="customer-account-view">
      {/* 💳 TARJETA PRINCIPAL DE ESTADO DE CUENTA (HERO WALLET CARD) */}
      <section className={`hero-wallet-card ${esSolvente ? 'wallet-solvente' : 'wallet-deuda'}`}>
        <div className="wallet-card-header">
          <span className="wallet-chip-label">
            <i className={`fas ${esSolvente ? 'fa-shield-check' : 'fa-wallet'}`} />
            {esSolvente ? 'Billetera Solvente' : 'Saldo Pendiente de Pago'}
          </span>
          <span className="wallet-status-tag">
            <i className={`fas ${esSolvente ? 'fa-circle-check' : 'fa-clock'}`} />
            {esSolvente ? 'Al día' : 'Pendiente'}
          </span>
        </div>

        <div className="wallet-balance-block">
          <span className="wallet-balance-title">
            {esSolvente ? 'Deuda Actual' : 'Total a Pagar'}
          </span>
          <div className="wallet-balance-amount">
            ${saldoDeudaUSD.toFixed(2)}
            <span className="wallet-balance-currency">USD</span>
          </div>
          <span className="wallet-balance-ves">
            ≈ Bs. {tasa > 0 ? formatVES(saldoDeudaVES) : '—'}
          </span>
        </div>

        <button
          type="button"
          className="wallet-cta-btn"
          onClick={() => {
            if (typeof onOpenPaymentModal === 'function') {
              onOpenPaymentModal();
            } else if (typeof window.abrirModalReportarPagoCliente === 'function') {
              window.abrirModalReportarPagoCliente();
            }
          }}
        >
          <i className="fas fa-credit-card" />
          <span>Pagar / Reportar Abono</span>
        </button>
      </section>

      {/* 📊 3. GRILLA DE MÉTRICAS COMPACTA (2x2 GRID METRICS) */}
      <section className="customer-metrics-grid">
        {/* Total Comprado */}
        <div className="metric-soft-card">
          <div className="metric-header">
            <div className="metric-icon-box metric-icon-blue">
              <i className="fas fa-bag-shopping" />
            </div>
            <span className="metric-label">Total Comprado</span>
          </div>
          <div className="metric-value">${totalCompradoUSD.toFixed(2)}</div>
          <span className="metric-subtext">Bs. {formatVES(totalCompradoVES)}</span>
        </div>

        {/* Total Abonado */}
        <div className="metric-soft-card">
          <div className="metric-header">
            <div className="metric-icon-box metric-icon-green">
              <i className="fas fa-receipt" />
            </div>
            <span className="metric-label">Total Abonado</span>
          </div>
          <div className="metric-value">${totalAbonadoUSD.toFixed(2)}</div>
          <span className="metric-subtext">Bs. {formatVES(totalAbonadoVES)} ({approvedPayments.length})</span>
        </div>

        {/* Pedidos Activos */}
        <div className="metric-soft-card">
          <div className="metric-header">
            <div className="metric-icon-box metric-icon-purple">
              <i className="fas fa-box" />
            </div>
            <span className="metric-label">Pedidos Activos</span>
          </div>
          <div className="metric-value">
            {clientSales.length} {clientSales.length === 1 ? 'Pedido' : 'Pedidos'}
          </div>
          <span className="metric-subtext">Historial registrado</span>
        </div>

        {/* Puntos por Liberar */}
        <div className="metric-soft-card">
          <div className="metric-header">
            <div className="metric-icon-box metric-icon-amber">
              <i className="fas fa-lock" />
            </div>
            <span className="metric-label">Puntos por Liberar</span>
          </div>
          <div className="metric-value" style={{ color: puntosPorLiberar > 0 ? '#b45309' : undefined }}>
            +{puntosPorLiberar} Pts
          </div>
          <span className="metric-subtext">
            {esSolvente ? 'Todos liberados' : 'Bloqueados hasta pagar'}
          </span>
        </div>
      </section>

      {/* 📑 4. LISTADOS MÓVILES BASADOS EN TARJETAS (CARD-BASED LISTS) */}

      {/* Sección A: Mis Compras y Pedidos */}
      <section className="customer-section">
        <div className="customer-section-header">
          <h3 className="customer-section-title">
            <i className="fas fa-bag-shopping" style={{ color: '#2563eb' }} />
            <span>Mis Compras y Pedidos</span>
          </h3>
          <span className="customer-section-badge">
            {clientSales.length} compras
          </span>
        </div>

        <div className="cards-list-wrapper">
          {clientSales.length === 0 ? (
            <div className="empty-cards-state">
              <i className="fas fa-box-open" />
              <p>Aún no tienes compras o pedidos registrados en el sistema.</p>
            </div>
          ) : (
            clientSales.slice().reverse().map((sale) => {
              const totalUSD = Number(sale.total || 0);
              const totalVES = tasa > 0 ? totalUSD * tasa : 0;
              const esCredito = sale.tipo === 'Crédito' || sale.tipo === 'credito';
              const esPendiente = sale.estado === 'PENDIENTE_CONFIRMACION';
              const itemsCount = (sale.items || []).reduce((acc, it) => acc + (Number(it.cantidad) || 1), 0);
              const itemsDesc = (sale.items || []).map(i => `${i.cantidad}x ${i.nombre}`).join(', ') || 'Compra de productos';

              let badgeClass = 'badge-approved';
              let badgeText = 'Contado';
              let badgeIcon = 'fa-check';

              if (esPendiente) {
                badgeClass = 'badge-pending';
                badgeText = 'Por Confirmar';
                badgeIcon = 'fa-hourglass-half';
              } else if (esCredito) {
                if (saldoDeudaUSD > 0) {
                  badgeClass = 'badge-pending';
                  badgeText = 'Pendiente';
                  badgeIcon = 'fa-clock';
                } else {
                  badgeClass = 'badge-settled';
                  badgeText = 'Liquidado';
                  badgeIcon = 'fa-circle-check';
                }
              }

              return (
                <div className="transaction-card" key={sale.id || Math.random()}>
                  <div className="tx-left">
                    <div className={`tx-icon-pill ${esCredito ? 'tx-icon-credit' : 'tx-icon-sale'}`}>
                      <i className={`fas ${esCredito ? 'fa-hand-holding-dollar' : 'fa-cart-shopping'}`} />
                    </div>
                    <div className="tx-details">
                      <div className="tx-ref">
                        <span>#{sale.id}</span>
                        <span className="tx-type-tag">{sale.tipo || 'Contado'}</span>
                      </div>
                      <span className="tx-desc" title={itemsDesc}>
                        {itemsCount > 0 ? `${itemsCount} art. • ` : ''}{itemsDesc}
                      </span>
                      <span className="tx-date">
                        <i className="far fa-calendar-alt" /> {sale.fecha || 'Fecha N/A'}
                      </span>
                    </div>
                  </div>

                  <div className="tx-right">
                    <span className="tx-amount">${totalUSD.toFixed(2)}</span>
                    <span className="tx-amount-ves">Bs. {formatVES(totalVES)}</span>
                    <span className={`tx-status-badge ${badgeClass}`}>
                      <i className={`fas ${badgeIcon}`} />
                      {badgeText}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Sección B: Mis Pagos y Abonos Registrados */}
      <section className="customer-section">
        <div className="customer-section-header">
          <h3 className="customer-section-title">
            <i className="fas fa-money-bill-wave" style={{ color: '#16a34a' }} />
            <span>Mis Pagos y Abonos</span>
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="customer-section-badge">
              {clientPayments.length} abonos
            </span>
            <button
              type="button"
              className="customer-section-action-btn"
              onClick={() => {
                if (typeof onOpenPaymentModal === 'function') {
                  onOpenPaymentModal();
                } else if (typeof window.abrirModalReportarPagoCliente === 'function') {
                  window.abrirModalReportarPagoCliente();
                }
              }}
            >
              <i className="fas fa-plus" /> Reportar
            </button>
          </div>
        </div>

        <div className="cards-list-wrapper">
          {clientPayments.length === 0 ? (
            <div className="empty-cards-state">
              <i className="fas fa-receipt" />
              <p>Sin pagos reportados todavía. Presiona "Reportar" para registrar tu comprobante.</p>
            </div>
          ) : (
            clientPayments.slice().reverse().map((payment) => {
              const esPendiente = payment.estado === 'PENDIENTE_CONFIRMACION';
              const esRechazado = payment.estado === 'RECHAZADO';
              const isDivisa = Boolean(
                payment.formaPago === 'Efectivo USD' ||
                payment.moneda === 'USD' ||
                (payment.montoUSD && Number(payment.montoUSD) > 0 && !payment.montoVES)
              );

              const montoUSD = Number(payment.montoUSD || 0);
              const montoVES = Number(payment.montoVES || 0);
              const mainAmountStr = isDivisa
                ? `$${montoUSD.toFixed(2)} USD`
                : `Bs. ${formatVES(montoVES > 0 ? montoVES : (montoUSD * tasa))}`;
              const subAmountStr = isDivisa && tasa > 0
                ? `Bs. ${formatVES(montoUSD * tasa)}`
                : (montoUSD > 0 ? `$${montoUSD.toFixed(2)} USD` : '');

              let statusClass = 'badge-approved';
              let statusText = 'Aprobado';
              let statusIcon = 'fa-check';

              if (esPendiente) {
                statusClass = 'badge-pending';
                statusText = 'En Verificación';
                statusIcon = 'fa-hourglass-half';
              } else if (esRechazado) {
                statusClass = 'badge-rejected';
                statusText = 'Rechazado';
                statusIcon = 'fa-times-circle';
              }

              const metodo = payment.formaPago || payment.metodo || 'Pago Móvil';

              return (
                <div className="transaction-card" key={payment.id || Math.random()}>
                  <div className="tx-left">
                    <div className={`tx-icon-pill ${isDivisa ? 'tx-icon-pago' : 'tx-icon-ves'}`}>
                      <i className={`fas ${isDivisa ? 'fa-dollar-sign' : 'fa-mobile-screen'}`} />
                    </div>
                    <div className="tx-details">
                      <div className="tx-ref">
                        <span>Ref: {payment.referencia || 'S/R'}</span>
                        <span className="tx-type-tag">{metodo}</span>
                      </div>
                      <span className="tx-desc">
                        {payment.nota ? `Nota: ${payment.nota}` : metodo}
                      </span>
                      <span className="tx-date">
                        <i className="far fa-calendar-alt" /> {payment.fecha || 'Fecha N/A'}
                      </span>
                    </div>
                  </div>

                  <div className="tx-right">
                    <span
                      className="tx-amount"
                      style={{
                        color: esPendiente ? '#d97706' : (esRechazado ? '#dc2626' : '#16a34a')
                      }}
                    >
                      {mainAmountStr}
                    </span>
                    {subAmountStr && <span className="tx-amount-ves">{subAmountStr}</span>}
                    <span className={`tx-status-badge ${statusClass}`}>
                      <i className={`fas ${statusIcon}`} />
                      {statusText}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
