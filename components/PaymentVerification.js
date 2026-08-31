/**
 * /components/PaymentVerification.js
 * Sincronización en Tiempo Real de Pagos Reportados (Real-Time Payment Notification & Verification Engine)
 * 
 * Funcionalidades:
 * 1. Monitoreo reactivo y en tiempo real de abonos reportados en estado PENDIENTE_CONFIRMACION.
 * 2. Notificaciones auditivas / visuales en tiempo real para el Administrador al llegar un nuevo pago.
 * 3. Actualización dinámica de badges y contadores en la barra de navegación superior e inferior.
 * 4. Conciliación atómica con acreditación de puntos de lealtad, reducción de deuda y actualización de solvencia.
 * 5. Re-fetch automático y fallback periódico (cada 3.5s) si se interrumpe la conexión.
 */

window.InventoryApp = window.InventoryApp || {};

class PaymentVerificationEngine {
    constructor() {
        this.pollInterval = null;
        this.ultimoConteoPendientes = 0;
        this.iniciado = false;
    }

    init() {
        if (this.iniciado) return;
        this.iniciado = true;

        // Comprobar estado inicial
        this.verificarNuevosPagos();

        // Iniciar ciclo de sondeo en tiempo real de respaldo
        if (!this.pollInterval) {
            this.pollInterval = setInterval(() => {
                this.verificarNuevosPagos();
            }, 3500);
        }

        console.log('[PaymentVerification] Motor de sincronización en tiempo real inicializado.');
    }

    /**
     * Obtiene los abonos pendientes de confirmación
     */
    obtenerAbonosPendientes() {
        const abonos = window.AppState?.abonos || [];
        return abonos.filter(a => a.estado === 'PENDIENTE_CONFIRMACION' || a.estado === 'Confirmando');
    }

    /**
     * Comprueba si han entrado nuevos pagos reportados y actualiza UI / Badges
     */
    verificarNuevosPagos() {
        const pendientes = this.obtenerAbonosPendientes();
        const conteoActual = pendientes.length;

        // Actualizar badges en UI
        this.actualizarBadgesNavegacion(conteoActual);

        // Si hay nuevos pagos respecto al ciclo anterior y el usuario es Admin, emitir alerta
        const esAdmin = window.AppState?.usuarioActual?.rol === 'admin' || window.AppState?.usuarioActual?.id === 'SuperAdmin';
        if (esAdmin && conteoActual > this.ultimoConteoPendientes && this.ultimoConteoPendientes >= 0) {
            const nuevoAbono = pendientes[0];
            if (nuevoAbono && this.ultimoConteoPendientes > 0) {
                this.notificarNuevoPagoDetectado(nuevoAbono);
            }
        }

        this.ultimoConteoPendientes = conteoActual;

        // Si la vista de verificación está montada en pantalla, refrescarla reactivamente
        const container = document.getElementById('payment-verification-live-container');
        if (container && esAdmin) {
            this.renderizarPanelVerificacion('payment-verification-live-container');
        }
    }

    /**
     * Actualiza los puntos rojos de notificación en las pestañas del Admin
     */
    actualizarBadgesNavegacion(conteo) {
        const badgeMobile = document.getElementById('badge-transacciones-mobile');
        const badgeDesktop = document.getElementById('badge-transacciones-desktop');
        const badgeAbonos = document.getElementById('badge-abonos-pendientes-count');

        if (badgeMobile) {
            badgeMobile.style.display = conteo > 0 ? 'inline-block' : 'none';
            badgeMobile.textContent = conteo > 0 ? conteo : '';
        }
        if (badgeDesktop) {
            badgeDesktop.style.display = conteo > 0 ? 'inline-block' : 'none';
            badgeDesktop.textContent = conteo > 0 ? `${conteo} pendientes` : '';
        }
        if (badgeAbonos) {
            badgeAbonos.textContent = conteo;
        }
    }

    /**
     * Notificación flotante visual y amigable
     */
    notificarNuevoPagoDetectado(abono) {
        if (window.InventoryApp && window.InventoryApp.Modal && typeof window.InventoryApp.Modal.toast === 'function') {
            window.InventoryApp.Modal.toast(`🔔 Nuevo pago reportado por $${Number(abono.montoUSD || 0).toFixed(2)} (${abono.clienteNombre || abono.clienteId}). Ref: ${abono.referencia || 'N/A'}`, 'info');
        }
    }

    /**
     * Renderiza la tabla completa de Verificación de Pagos en Tiempo Real
     */
    renderizarPanelVerificacion(containerId = 'payment-verification-live-container') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const pendientes = this.obtenerAbonosPendientes();
        const tasa = Number(window.AppState?.tasaActiva || window.AppState?.tasaUSD_BCV || 0);

        if (pendientes.length === 0) {
            container.innerHTML = `
                <div class="card" style="background:var(--card-bg, #ffffff); border:1px solid var(--border-light, #e2e8f0); border-radius:14px; padding:24px; text-align:center;">
                    <div style="width:54px; height:54px; border-radius:50%; background:#dcfce7; color:#16a34a; display:flex; align-items:center; justify-content:center; font-size:1.6rem; margin:0 auto 12px auto;">
                        <i class="fas fa-check-double"></i>
                    </div>
                    <h4 style="margin:0 0 6px 0; color:var(--text-primary, #0f172a); font-size:1.05rem;">Sin pagos pendientes por verificar</h4>
                    <p style="margin:0; color:var(--text-muted, #64748b); font-size:0.86rem;">
                        Todos los abonos reportados por los clientes han sido conciliados. El sistema monitorea en tiempo real cualquier nuevo reporte.
                    </p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="card" style="background:var(--card-bg, #ffffff); border:1px solid #fde68a; border-radius:14px; padding:20px; box-shadow:0 4px 14px rgba(217, 119, 6, 0.08);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
                    <div>
                        <h3 style="margin:0; font-size:1.15rem; color:#92400e; display:flex; align-items:center; gap:8px;">
                            <i class="fas fa-bell fa-bounce" style="color:#d97706;"></i> Pagos Reportados Pendientes de Aprobación
                            <span class="badge" style="background:#d97706; color:#ffffff; font-size:0.75rem; padding:3px 8px; border-radius:12px;">
                                ${pendientes.length} por conciliar
                            </span>
                        </h3>
                        <p style="margin:4px 0 0 0; font-size:0.82rem; color:var(--text-muted, #64748b);">
                            Verifica la referencia bancaria y presiona "Aprobar" para descontar la deuda del cliente y liberar sus puntos.
                        </p>
                    </div>
                    <button type="button" class="btn btn-outline btn-sm" onclick="window.InventoryApp.PaymentVerification.verificarNuevosPagos()" style="font-size:0.8rem; display:flex; align-items:center; gap:6px;">
                        <i class="fas fa-rotate"></i> Actualizar Ahora
                    </button>
                </div>

                <div class="table-responsive">
                    <table style="width:100%; border-collapse:collapse; font-size:0.88rem;">
                        <thead>
                            <tr style="background:var(--table-header-bg, #f8fafc); border-bottom:2px solid var(--border-light, #e2e8f0);">
                                <th style="padding:10px 8px; text-align:left;">Fecha / Hora</th>
                                <th style="padding:10px 8px; text-align:left;">Cliente</th>
                                <th style="padding:10px 8px; text-align:left;">Método & Banco</th>
                                <th style="padding:10px 8px; text-align:left;">Nº Referencia</th>
                                <th style="padding:10px 8px; text-align:right;">Monto ($ USD)</th>
                                <th style="padding:10px 8px; text-align:right;">Equiv. (Bs)</th>
                                <th style="padding:10px 8px; text-align:center;">Acción Inmediata</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pendientes.map(a => {
                                const montoUSD = Number(a.montoUSD || 0);
                                const montoVES = Number(a.montoVES || (tasa > 0 ? montoUSD * tasa : 0));
                                return `
                                    <tr style="border-bottom:1px solid var(--border-light, #e2e8f0); transition:background 0.2s ease;">
                                        <td style="padding:10px 8px; color:var(--text-muted, #64748b); font-size:0.82rem;">
                                            ${a.fecha || 'Reciente'}
                                        </td>
                                        <td style="padding:10px 8px;">
                                            <strong style="color:var(--text-primary, #0f172a); display:block;">${a.clienteNombre || a.clienteId}</strong>
                                            <small style="color:var(--text-muted, #64748b); font-size:0.75rem;">C.I: ${a.clienteId}</small>
                                        </td>
                                        <td style="padding:10px 8px;">
                                            <span class="badge" style="background:#eff6ff; color:#1e40af; font-weight:600; font-size:0.78rem;">
                                                ${a.formaPago || a.metodo || 'Pago Móvil / Transferencia'}
                                            </span>
                                            ${a.nota ? `<br><small style="color:var(--text-muted, #64748b); font-size:0.74rem;">Nota: ${a.nota}</small>` : ''}
                                        </td>
                                        <td style="padding:10px 8px;">
                                            <div style="display:flex; align-items:center; gap:6px;">
                                                <code style="font-size:0.9rem; font-weight:700; background:#f1f5f9; padding:2px 6px; border-radius:4px; color:var(--text-primary, #0f172a);">
                                                    ${a.referencia || 'Sin Ref'}
                                                </code>
                                                <button type="button" class="btn-copy-small" onclick="window.InventoryApp.BankSelector?.copiarAlPortapapeles('${a.referencia}', 'Referencia')" title="Copiar referencia">
                                                    <i class="fas fa-copy"></i>
                                                </button>
                                            </div>
                                        </td>
                                        <td style="padding:10px 8px; text-align:right; font-weight:700; color:var(--primary-accent, #2563eb); font-size:0.95rem;">
                                            $${montoUSD.toFixed(2)}
                                        </td>
                                        <td style="padding:10px 8px; text-align:right; font-weight:600; color:#16a34a; font-size:0.86rem;">
                                            Bs. ${montoVES.toFixed(2)}
                                        </td>
                                        <td style="padding:10px 8px; text-align:center; white-space:nowrap;">
                                            <button type="button" class="btn btn-sm btn-success" onclick="window.InventoryApp.PaymentVerification.aprobarPago('${a.id}')" 
                                                    style="padding:6px 12px; font-weight:700; font-size:0.8rem; margin-right:4px; box-shadow:0 2px 6px rgba(22,163,74,0.2);">
                                                <i class="fas fa-check"></i> Aprobar
                                            </button>
                                            <button type="button" class="btn btn-sm btn-danger" onclick="window.InventoryApp.PaymentVerification.rechazarPago('${a.id}')"
                                                    style="padding:6px 10px; font-weight:600; font-size:0.8rem;">
                                                <i class="fas fa-times"></i> Rechazar
                                            </button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    /**
     * Aprueba y concilia un pago en tiempo real
     */
    async aprobarPago(abonoId) {
        if (typeof window.aprobarAbonoReportadoAdmin === 'function') {
            await window.aprobarAbonoReportadoAdmin(abonoId);
            this.verificarNuevosPagos();
        }
    }

    /**
     * Rechaza un pago con confirmación
     */
    async rechazarPago(abonoId) {
        if (typeof window.rechazarAbonoReportadoAdmin === 'function') {
            await window.rechazarAbonoReportadoAdmin(abonoId);
            this.verificarNuevosPagos();
        }
    }
}

window.InventoryApp.PaymentVerification = new PaymentVerificationEngine();

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.InventoryApp.PaymentVerification.init());
} else {
    window.InventoryApp.PaymentVerification.init();
}
