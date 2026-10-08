/**
 * modules/caja-turnos.js
 * Módulo Administrativo de Apertura, Control de Turno y Arqueo de Caja (Cortes X y Z)
 * Diseñado para "Tu Bodeguita de Confianza"
 * Soporta operaciones bimonetarias (USD y Bs. BCV), denominaciones de billetes,
 * lotes electrónicos (Punto de Venta, Pago Móvil, Biopago), Cuentas por Cobrar (Fiado)
 * y persistencia en Firestore y LocalStorage.
 */

window.InventoryApp = window.InventoryApp || {};

(function () {
    const STORAGE_KEY_TURNO_ACTIVO = 'bodeguita_turno_caja_activo_v1';
    const STORAGE_KEY_HISTORIAL_TURNOS = 'bodeguita_historial_turnos_caja_v1';
    const STORAGE_KEY_EGRESOS = 'bodeguita_egresos_caja_v1';

    // =========================================================================
    // 1. INICIALIZACIÓN Y PERSISTENCIA LOCAL / FIRESTORE
    // =========================================================================

    function inicializarModuloCaja() {
        if (!AppState.turnosCaja) AppState.turnosCaja = [];
        if (!AppState.egresosCaja) AppState.egresosCaja = [];

        // 1. Restaurar historial local si memoria está vacía
        try {
            const rawHist = localStorage.getItem(STORAGE_KEY_HISTORIAL_TURNOS);
            if (rawHist) {
                const parsed = JSON.parse(rawHist);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    AppState.turnosCaja = parsed;
                }
            }
            const rawEg = localStorage.getItem(STORAGE_KEY_EGRESOS);
            if (rawEg) {
                const parsedEg = JSON.parse(rawEg);
                if (Array.isArray(parsedEg)) AppState.egresosCaja = parsedEg;
            }
        } catch (e) {
            console.warn('[CajaTurnos] Error al restaurar historial local:', e);
        }

        // 2. Restaurar turno activo y regla de bloqueo
        try {
            const rawExigir = localStorage.getItem('bodeguita_exigir_turno_vendedor');
            if (rawExigir !== null) AppState.exigirTurnoVendedor = rawExigir === 'true';

            const rawActivo = localStorage.getItem(STORAGE_KEY_TURNO_ACTIVO);
            if (rawActivo) {
                const parsedActivo = JSON.parse(rawActivo);
                if (parsedActivo && parsedActivo.estado === 'ABIERTO') {
                    AppState.turnoActivo = parsedActivo;
                }
            }
        } catch (e) {}

        // 3. Si no hay en localStorage, verificar en la lista
        if (!AppState.turnoActivo) {
            const activoEnLista = (AppState.turnosCaja || []).find(t => t.estado === 'ABIERTO');
            if (activoEnLista) {
                AppState.turnoActivo = activoEnLista;
                guardarTurnoActivoLocal(activoEnLista);
            }
        }

        actualizarBadgesTurno();
        renderizarVistaCajaTurnos();
    }

    function guardarTurnoActivoLocal(turno) {
        AppState.turnoActivo = turno;
        if (turno) {
            try {
                localStorage.setItem(STORAGE_KEY_TURNO_ACTIVO, JSON.stringify(turno));
            } catch (e) {}
        } else {
            localStorage.removeItem(STORAGE_KEY_TURNO_ACTIVO);
        }
    }

    function sincronizarTurnoCloud(turno) {
        if (!turno || !turno.id) return;
        try {
            if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarTurnoCaja === 'function') {
                window.InventoryApp.Firebase.guardarTurnoCaja(turno).catch(err => {
                    console.warn('[CajaTurnos] Error guardando turno en Firestore:', err);
                });
            } else if (typeof firebase !== 'undefined' && firebase.firestore) {
                const db = firebase.firestore();
                db.collection('cajas_turnos').doc(String(turno.id)).set(turno, { merge: true }).catch(() => {});
            }
        } catch (e) {}
    }

    function guardarHistorialTurnos() {
        try {
            localStorage.setItem(STORAGE_KEY_HISTORIAL_TURNOS, JSON.stringify(AppState.turnosCaja || []));
            localStorage.setItem(STORAGE_KEY_EGRESOS, JSON.stringify(AppState.egresosCaja || []));
        } catch (e) {}
    }

    // =========================================================================
    // 2. CÁLCULO EN TIEMPO REAL DEL RESUMEN DEL TURNO
    // =========================================================================

    /**
     * Calcula todos los ingresos, egresos, saldos físicos y conciliación de lotes para un turno
     */
    function calcularResumenTurno(turno) {
        if (!turno) {
            return {
                efectivoUSD: 0,
                efectivoVES: 0,
                pagoMovilVES: 0,
                puntoDeVentaVES: 0,
                biopagoVES: 0,
                transferenciaVES: 0,
                ventasCreditoUSD: 0,
                ventasCreditoVES: 0,
                totalVentasNetasUSD: 0,
                totalVentasNetasVES: 0,
                abonosUSD: 0,
                abonosVES: 0,
                egresosUSD: 0,
                egresosVES: 0,
                fondoInicialUSD: 0,
                fondoInicialVES: 0,
                totalTransacciones: 0,
                ventasTurno: [],
                egresosTurno: [],
                abonosTurno: []
            };
        }

        const fechaInicio = new Date(turno.fechaApertura).getTime();
        const fechaFin = turno.fechaCierre ? new Date(turno.fechaCierre).getTime() : Date.now();
        const tasaTurno = Number(turno.tasaBCVApertura || AppState.tasaActiva || AppState.tasaUSD_BCV || 42);

        const fondoUSD = Number(turno.fondoInicial?.totalUSD || turno.fondoInicialUSD || 0);
        const fondoVES = Number(turno.fondoInicial?.totalVES || turno.fondoInicialVES || 0);

        // 1. Filtrar ventas del turno (por turnoId o por intervalo temporal)
        const listaVentas = Array.isArray(AppState.ventas) ? AppState.ventas : [];
        const ventasTurno = listaVentas.filter(v => {
            if (v.turnoId && v.turnoId === turno.id) return true;
            if (!v.fecha) return false;
            const tVenta = new Date(v.fecha).getTime();
            return !isNaN(tVenta) && tVenta >= fechaInicio && tVenta <= fechaFin;
        });

        // 2. Filtrar abonos de fiados recibidos durante el turno
        const listaAbonos = Array.isArray(AppState.abonos) ? AppState.abonos : [];
        const abonosTurno = listaAbonos.filter(a => {
            if (a.turnoId && a.turnoId === turno.id) return true;
            if (!a.fecha) return false;
            const tAbono = new Date(a.fecha).getTime();
            return !isNaN(tAbono) && tAbono >= fechaInicio && tAbono <= fechaFin;
        });

        // 3. Filtrar egresos de caja chica
        const listaEgresos = Array.isArray(AppState.egresosCaja) ? AppState.egresosCaja : [];
        const egresosTurno = listaEgresos.filter(e => e.turnoId === turno.id);

        let ventasEfectivoUSD = 0;
        let ventasEfectivoVES = 0;
        let pagoMovilVES = 0;
        let puntoDeVentaVES = 0;
        let biopagoVES = 0;
        let transferenciaVES = 0;
        let ventasCreditoUSD = 0;
        let ventasCreditoVES = 0;
        let totalVentasNetasUSD = 0;

        ventasTurno.forEach(v => {
            const mUSD = Number(v.totalUSD || v.total || 0);
            const mVES = Number(v.totalVES || (mUSD * tasaTurno) || 0);
            const metodo = String(v.metodoDetalle || v.tipoPago || v.tipo || '').toLowerCase();

            totalVentasNetasUSD += mUSD;

            if (v.tipo === 'Crédito' || metodo.includes('crédito') || metodo.includes('fiado')) {
                ventasCreditoUSD += mUSD;
                ventasCreditoVES += mVES;
            } else if (metodo.includes('efectivo usd') || (metodo.includes('efectivo') && !metodo.includes('ves') && !metodo.includes('bs'))) {
                ventasEfectivoUSD += mUSD;
            } else if (metodo.includes('efectivo ves') || metodo.includes('bolívares') || metodo.includes('efectivo bs')) {
                ventasEfectivoVES += mVES;
            } else if (metodo.includes('pago móvil') || metodo.includes('pago movil')) {
                pagoMovilVES += mVES;
            } else if (metodo.includes('punto de venta') || metodo.includes('punto') || metodo.includes('tarjeta')) {
                puntoDeVentaVES += mVES;
            } else if (metodo.includes('biopago')) {
                biopagoVES += mVES;
            } else if (metodo.includes('transferencia')) {
                transferenciaVES += mVES;
            } else {
                // Fallback por defecto en efectivo si no fue crédito
                ventasEfectivoUSD += mUSD;
            }
        });

        // Abonos recibidos en caja
        let abonosUSD = 0;
        let abonosVES = 0;
        abonosTurno.forEach(a => {
            const mUSD = Number(a.montoUSD || a.totalUSD || 0);
            const mVES = Number(a.montoVES || a.totalVES || (mUSD * tasaTurno) || 0);
            const met = String(a.metodo || a.metodoPago || a.tipo || '').toLowerCase();

            if (met.includes('usd') || met.includes('divisa') || (met.includes('efectivo') && !met.includes('ves'))) {
                abonosUSD += mUSD;
            } else if (met.includes('pago móvil') || met.includes('pago movil')) {
                pagoMovilVES += mVES;
            } else if (met.includes('punto')) {
                puntoDeVentaVES += mVES;
            } else if (met.includes('biopago')) {
                biopagoVES += mVES;
            } else {
                abonosVES += mVES;
            }
        });

        // Egresos de caja chica
        let egresosUSD = 0;
        let egresosVES = 0;
        egresosTurno.forEach(e => {
            if (e.moneda === 'USD') egresosUSD += Number(e.montoUSD || e.monto || 0);
            else egresosVES += Number(e.montoVES || e.monto || 0);
        });

        // Fórmulas de gaveta esperada
        const esperadoEfectivoUSD = fondoUSD + ventasEfectivoUSD + abonosUSD - egresosUSD;
        const esperadoEfectivoVES = fondoVES + ventasEfectivoVES + abonosVES - egresosVES;

        return {
            fondoInicialUSD: fondoUSD,
            fondoInicialVES: fondoVES,
            ventasEfectivoUSD,
            ventasEfectivoVES,
            abonosUSD,
            abonosVES,
            egresosUSD,
            egresosVES,
            esperadoEfectivoUSD: Math.max(0, esperadoEfectivoUSD),
            esperadoEfectivoVES: Math.max(0, esperadoEfectivoVES),
            pagoMovilVES,
            puntoDeVentaVES,
            biopagoVES,
            transferenciaVES,
            ventasCreditoUSD,
            ventasCreditoVES,
            totalVentasNetasUSD,
            totalVentasNetasVES: totalVentasNetasUSD * tasaTurno,
            totalTransacciones: ventasTurno.length,
            ventasTurno,
            egresosTurno,
            abonosTurno
        };
    }

    // =========================================================================
    // 3. APERTURA DE TURNO
    // =========================================================================

    function abrirModalAperturaTurno() {
        if (AppState.turnoActivo && AppState.turnoActivo.estado === 'ABIERTO') {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Turno ya abierto', `Ya existe un turno activo (#${AppState.turnoActivo.numeroTurno}) a nombre de ${AppState.turnoActivo.cajeroNombre || 'Cajero'}. Debes cerrarlo o arquearlo para abrir uno nuevo.`, 'info');
            } else {
                alert(`Ya existe un turno activo (#${AppState.turnoActivo.numeroTurno}).`);
            }
            return;
        }

        let modal = document.getElementById('modal-caja-apertura');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-caja-apertura';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }
        modal.onclick = function(e) {
            if (e.target === modal) cerrarModalAperturaTurno();
        };

        const usuarioSesion = AppState.usuarioActual || { nombre: 'Administrador Principal', cedula: 'Admin' };
        const proxNumero = (AppState.turnosCaja?.length || 0) + 1;
        const tasaActual = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 42.00);

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 640px; animation: modalPop 0.25s ease-out; border-radius: 18px; padding: 24px;" onclick="event.stopPropagation();">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid var(--border-color, #e2e8f0); padding-bottom:14px; margin-bottom:18px; gap:12px;">
                    <div>
                        <h3 style="margin:0; font-size:1.3rem; display:flex; align-items:center; gap:8px; color:var(--text-main, #0f172a);">
                            <i class="fas fa-cash-register" style="color:#10b981;"></i> Apertura de Turno #${proxNumero}
                        </h3>
                        <p style="margin:4px 0 0; font-size:0.85rem; color:var(--text-muted, #64748b);">
                            Registra el fondo inicial en gaveta por denominación para iniciar operaciones.
                        </p>
                    </div>
                    <button type="button" onclick="cerrarModalAperturaTurno()" aria-label="Cerrar modal" title="Cerrar (Esc o clic afuera)" style="background:#f1f5f9; border:none; color:#334155; width:36px; height:36px; min-width:36px; min-height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:1.15rem; transition:all 0.2s; box-shadow:0 1px 3px rgba(0,0,0,0.1);"><i class="fas fa-times" style="color:#334155;"></i></button>
                </div>

                <form id="form-apertura-turno" onsubmit="event.preventDefault(); confirmarAperturaTurno();">
                    <!-- Datos del Cajero y Tasa -->
                    <div style="background:var(--bg-canvas-subtle, #f8fafc); border:1px solid var(--border-color, #e2e8f0); border-radius:12px; padding:12px 16px; margin-bottom:18px; display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                        <div>
                            <span style="font-size:0.8rem; color:var(--text-muted, #64748b); display:block;">Cajero / Operador:</span>
                            <strong style="font-size:0.95rem; color:var(--text-main, #0f172a);">${usuarioSesion.nombre} (${usuarioSesion.cedula || 'Activo'})</strong>
                        </div>
                        <div style="text-align:right;">
                            <span style="font-size:0.8rem; color:var(--text-muted, #64748b); display:block;">Tasa BCV del Turno:</span>
                            <strong style="font-size:0.95rem; color:#16a34a;">Bs. ${tasaActual.toFixed(2)} / USD</strong>
                        </div>
                    </div>

                    <!-- Pestañas de Denominación: USD y Bs -->
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:18px;">
                        <!-- Columna Fondo Inicial USD -->
                        <div style="background:var(--bg-card, #ffffff); border:1px solid var(--border-color, #e2e8f0); border-radius:12px; padding:14px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                                <span style="font-weight:700; font-size:0.88rem; color:#16a34a;"><i class="fas fa-dollar-sign"></i> Fondo Efectivo USD</span>
                                <strong id="lbl-apertura-total-usd" style="font-size:1rem; color:#16a34a;">$0.00</strong>
                            </div>
                            <div style="display:flex; flex-direction:column; gap:6px; font-size:0.82rem;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span>Billetes $100:</span>
                                    <input type="number" min="0" value="0" class="input-denom-usd" data-val="100" oninput="recalcularFondoApertura()" style="width:70px; text-align:center; padding:3px; border-radius:6px; border:1px solid #cbd5e1;">
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span>Billetes $50:</span>
                                    <input type="number" min="0" value="0" class="input-denom-usd" data-val="50" oninput="recalcularFondoApertura()" style="width:70px; text-align:center; padding:3px; border-radius:6px; border:1px solid #cbd5e1;">
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span>Billetes $20:</span>
                                    <input type="number" min="0" value="0" class="input-denom-usd" data-val="20" oninput="recalcularFondoApertura()" style="width:70px; text-align:center; padding:3px; border-radius:6px; border:1px solid #cbd5e1;">
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span>Billetes $10:</span>
                                    <input type="number" min="0" value="0" class="input-denom-usd" data-val="10" oninput="recalcularFondoApertura()" style="width:70px; text-align:center; padding:3px; border-radius:6px; border:1px solid #cbd5e1;">
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span>Billetes $5:</span>
                                    <input type="number" min="0" value="0" class="input-denom-usd" data-val="5" oninput="recalcularFondoApertura()" style="width:70px; text-align:center; padding:3px; border-radius:6px; border:1px solid #cbd5e1;">
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span>Billetes $1:</span>
                                    <input type="number" min="0" value="0" class="input-denom-usd" data-val="1" oninput="recalcularFondoApertura()" style="width:70px; text-align:center; padding:3px; border-radius:6px; border:1px solid #cbd5e1;">
                                </div>
                            </div>
                        </div>

                        <!-- Columna Fondo Inicial Bs -->
                        <div style="background:var(--bg-card, #ffffff); border:1px solid var(--border-color, #e2e8f0); border-radius:12px; padding:14px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                                <span style="font-weight:700; font-size:0.88rem; color:#2563eb;"><i class="fas fa-coins"></i> Fondo Efectivo Bs</span>
                                <strong id="lbl-apertura-total-ves" style="font-size:1rem; color:#2563eb;">Bs. 0.00</strong>
                            </div>
                            <div style="display:flex; flex-direction:column; gap:6px; font-size:0.82rem;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span>Billetes Bs 100:</span>
                                    <input type="number" min="0" value="0" class="input-denom-ves" data-val="100" oninput="recalcularFondoApertura()" style="width:70px; text-align:center; padding:3px; border-radius:6px; border:1px solid #cbd5e1;">
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span>Billetes Bs 50:</span>
                                    <input type="number" min="0" value="0" class="input-denom-ves" data-val="50" oninput="recalcularFondoApertura()" style="width:70px; text-align:center; padding:3px; border-radius:6px; border:1px solid #cbd5e1;">
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span>Billetes Bs 20:</span>
                                    <input type="number" min="0" value="0" class="input-denom-ves" data-val="20" oninput="recalcularFondoApertura()" style="width:70px; text-align:center; padding:3px; border-radius:6px; border:1px solid #cbd5e1;">
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span>Billetes Bs 10:</span>
                                    <input type="number" min="0" value="0" class="input-denom-ves" data-val="10" oninput="recalcularFondoApertura()" style="width:70px; text-align:center; padding:3px; border-radius:6px; border:1px solid #cbd5e1;">
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span>Billetes / Monedas Bs 5:</span>
                                    <input type="number" min="0" value="0" class="input-denom-ves" data-val="5" oninput="recalcularFondoApertura()" style="width:70px; text-align:center; padding:3px; border-radius:6px; border:1px solid #cbd5e1;">
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style="margin-bottom:18px;">
                        <label style="display:block; font-size:0.82rem; font-weight:600; margin-bottom:4px; color:var(--text-main, #0f172a);">Nota / Observación de Apertura (Opcional):</label>
                        <input type="text" id="apertura-nota" placeholder="Ej: Gaveta con sencillo para vuelto..." style="width:100%; padding:8px 12px; border:1px solid #cbd5e1; border-radius:8px; font-size:0.85rem;">
                    </div>

                    <!-- Botones de Acción -->
                    <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid var(--border-color, #e2e8f0); padding-top:14px;">
                        <button type="button" class="btn btn-outline" onclick="cerrarModalAperturaTurno()">Cancelar</button>
                        <button type="submit" class="btn btn-primary" style="background:#10b981; border-color:#10b981; color:#ffffff; font-weight:700;">
                            <i class="fas fa-key"></i> Confirmar Apertura de Caja
                        </button>
                    </div>
                </form>
            </div>
        `;
        modal.classList.add('active');
        recalcularFondoApertura();
    }

    function recalcularFondoApertura() {
        let totalUSD = 0;
        document.querySelectorAll('.input-denom-usd').forEach(inp => {
            const denom = Number(inp.getAttribute('data-val') || 0);
            const cant = Number(inp.value || 0);
            totalUSD += (denom * cant);
        });

        let totalVES = 0;
        document.querySelectorAll('.input-denom-ves').forEach(inp => {
            const denom = Number(inp.getAttribute('data-val') || 0);
            const cant = Number(inp.value || 0);
            totalVES += (denom * cant);
        });

        const lblUSD = document.getElementById('lbl-apertura-total-usd');
        if (lblUSD) lblUSD.textContent = `$${totalUSD.toFixed(2)}`;

        const lblVES = document.getElementById('lbl-apertura-total-ves');
        if (lblVES) lblVES.textContent = `Bs. ${totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;
    }

    function cerrarModalAperturaTurno() {
        const modal = document.getElementById('modal-caja-apertura');
        if (modal) modal.classList.remove('active');
    }

    function confirmarAperturaTurno() {
        let totalUSD = 0;
        const denomsUSD = {};
        document.querySelectorAll('.input-denom-usd').forEach(inp => {
            const denom = String(inp.getAttribute('data-val') || '0');
            const cant = Number(inp.value || 0);
            denomsUSD[denom] = cant;
            totalUSD += (Number(denom) * cant);
        });

        let totalVES = 0;
        const denomsVES = {};
        document.querySelectorAll('.input-denom-ves').forEach(inp => {
            const denom = String(inp.getAttribute('data-val') || '0');
            const cant = Number(inp.value || 0);
            denomsVES[denom] = cant;
            totalVES += (Number(denom) * cant);
        });

        const usuarioSesion = AppState.usuarioActual || { nombre: 'Administrador Principal', cedula: 'Admin', id: 'admin' };
        const tasaActual = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 42.00);
        const numeroTurno = (AppState.turnosCaja?.length || 0) + 1;
        const ahoraISO = new Date().toISOString();

        const nuevoTurno = {
            id: `TURNO-${Date.now().toString().slice(-6)}-${numeroTurno}`,
            numeroTurno: numeroTurno,
            fechaApertura: ahoraISO,
            fechaCierre: null,
            estado: 'ABIERTO',
            cajeroId: usuarioSesion.cedula || usuarioSesion.id || 'Admin',
            cajeroNombre: usuarioSesion.nombre || 'Cajero',
            tasaBCVApertura: tasaActual,
            tasaBCVCierre: null,
            fondoInicialUSD: totalUSD,
            fondoInicialVES: totalVES,
            fondoInicial: {
                totalUSD: totalUSD,
                totalVES: totalVES,
                denominacionesUSD: denomsUSD,
                denominacionesVES: denomsVES
            },
            notaApertura: (document.getElementById('apertura-nota')?.value || '').trim(),
            sistemaEsperado: null,
            cajeroDeclarado: null,
            diferencias: null,
            observaciones: ''
        };

        AppState.turnoActivo = nuevoTurno;
        if (!Array.isArray(AppState.turnosCaja)) AppState.turnosCaja = [];
        AppState.turnosCaja.unshift(nuevoTurno);

        guardarTurnoActivoLocal(nuevoTurno);
        guardarHistorialTurnos();
        sincronizarTurnoCloud(nuevoTurno);

        cerrarModalAperturaTurno();
        actualizarBadgesTurno();
        renderizarVistaCajaTurnos();

        if (typeof showCustomToast === 'function') {
            showCustomToast(`Turno #${numeroTurno} abierto exitosamente con fondo de $${totalUSD.toFixed(2)} USD`, 'success');
        }
    }

    // =========================================================================
    // 4. CORTE X (VISTA PREVIA / SUPERVISIÓN SIN CERRAR TURNO)
    // =========================================================================

    function generarCorteX() {
        const turno = AppState.turnoActivo;
        if (!turno || turno.estado !== 'ABIERTO') {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('No hay turno abierto', 'Debes abrir un turno para generar el reporte de Corte X.', 'warning');
            } else {
                alert('No hay turno activo para generar Corte X.');
            }
            return;
        }

        const resumen = calcularResumenTurno(turno);
        mostrarModalReporteCorte(turno, resumen, 'CORTE_X');
    }

    // =========================================================================
    // 5. ARQUEO DE CAJA Y CORTE Z (CIERRE FINAL DEL TURNO)
    // =========================================================================

    function abrirModalArqueoCierre() {
        const turno = AppState.turnoActivo;
        if (!turno || turno.estado !== 'ABIERTO') {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Caja sin turno activo', 'No existe un turno abierto para arquear.', 'info');
            } else {
                alert('No hay turno abierto para cerrar.');
            }
            return;
        }

        const resumen = calcularResumenTurno(turno);

        let modal = document.getElementById('modal-caja-arqueo');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-caja-arqueo';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }
        modal.onclick = function(e) {
            if (e.target === modal) cerrarModalArqueo();
        };

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 860px; animation: modalPop 0.25s ease-out; border-radius: 20px; padding: 24px; max-height:92vh; overflow-y:auto;" onclick="event.stopPropagation();">
                <!-- Header Arqueo -->
                <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid var(--border-color, #e2e8f0); padding-bottom:14px; margin-bottom:18px; gap:12px;">
                    <div>
                        <h3 style="margin:0; font-size:1.35rem; display:flex; align-items:center; gap:8px; color:var(--text-main, #0f172a);">
                            <i class="fas fa-lock" style="color:#ef4444;"></i> Arqueo Físico y Cierre Final (Corte Z)
                        </h3>
                        <p style="margin:4px 0 0; font-size:0.85rem; color:var(--text-muted, #64748b);">
                            Turno #${turno.numeroTurno} | Cajero: <strong>${turno.cajeroNombre}</strong> | Apertura: ${new Date(turno.fechaApertura).toLocaleTimeString()}
                        </p>
                    </div>
                    <button type="button" onclick="cerrarModalArqueo()" aria-label="Cerrar modal" title="Cerrar (Esc o clic afuera)" style="background:#f1f5f9; border:none; color:#334155; width:36px; height:36px; min-width:36px; min-height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:1.15rem; transition:all 0.2s; box-shadow:0 1px 3px rgba(0,0,0,0.1);"><i class="fas fa-times" style="color:#334155;"></i></button>
                </div>

                <!-- Formularios de Conteo Físico por Denominación -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px;">
                    <!-- Efectivo USD -->
                    <div style="background:var(--bg-canvas-subtle, #f8fafc); border:1px solid var(--border-color, #e2e8f0); border-radius:14px; padding:16px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <span style="font-weight:700; font-size:0.9rem; color:#16a34a;"><i class="fas fa-dollar-sign"></i> Conteo Físico Efectivo USD</span>
                            <span style="font-size:0.8rem; background:#dcfce7; color:#15803d; padding:2px 8px; border-radius:12px; font-weight:700;" id="lbl-arqueo-total-usd">$0.00</span>
                        </div>
                        <div style="display:flex; flex-direction:column; gap:6px; font-size:0.82rem;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span>Billetes $100:</span>
                                <input type="number" min="0" value="0" class="input-arqueo-usd" data-val="100" oninput="recalcularArqueoDiferencias()" style="width:75px; text-align:center; padding:4px; border-radius:6px; border:1px solid #cbd5e1;">
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span>Billetes $50:</span>
                                <input type="number" min="0" value="0" class="input-arqueo-usd" data-val="50" oninput="recalcularArqueoDiferencias()" style="width:75px; text-align:center; padding:4px; border-radius:6px; border:1px solid #cbd5e1;">
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span>Billetes $20:</span>
                                <input type="number" min="0" value="0" class="input-arqueo-usd" data-val="20" oninput="recalcularArqueoDiferencias()" style="width:75px; text-align:center; padding:4px; border-radius:6px; border:1px solid #cbd5e1;">
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span>Billetes $10:</span>
                                <input type="number" min="0" value="0" class="input-arqueo-usd" data-val="10" oninput="recalcularArqueoDiferencias()" style="width:75px; text-align:center; padding:4px; border-radius:6px; border:1px solid #cbd5e1;">
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span>Billetes $5:</span>
                                <input type="number" min="0" value="0" class="input-arqueo-usd" data-val="5" oninput="recalcularArqueoDiferencias()" style="width:75px; text-align:center; padding:4px; border-radius:6px; border:1px solid #cbd5e1;">
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span>Billetes $1:</span>
                                <input type="number" min="0" value="0" class="input-arqueo-usd" data-val="1" oninput="recalcularArqueoDiferencias()" style="width:75px; text-align:center; padding:4px; border-radius:6px; border:1px solid #cbd5e1;">
                            </div>
                        </div>
                    </div>

                    <!-- Efectivo Bs y Comprobantes Electrónicos -->
                    <div style="background:var(--bg-canvas-subtle, #f8fafc); border:1px solid var(--border-color, #e2e8f0); border-radius:14px; padding:16px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <span style="font-weight:700; font-size:0.9rem; color:#2563eb;"><i class="fas fa-coins"></i> Conteo Físico Efectivo Bs</span>
                            <span style="font-size:0.8rem; background:#dbeafe; color:#1d4ed8; padding:2px 8px; border-radius:12px; font-weight:700;" id="lbl-arqueo-total-ves">Bs. 0.00</span>
                        </div>
                        <div style="display:flex; flex-direction:column; gap:6px; font-size:0.82rem; margin-bottom:12px;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span>Billetes Bs 100:</span>
                                <input type="number" min="0" value="0" class="input-arqueo-ves" data-val="100" oninput="recalcularArqueoDiferencias()" style="width:75px; text-align:center; padding:4px; border-radius:6px; border:1px solid #cbd5e1;">
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span>Billetes Bs 50:</span>
                                <input type="number" min="0" value="0" class="input-arqueo-ves" data-val="50" oninput="recalcularArqueoDiferencias()" style="width:75px; text-align:center; padding:4px; border-radius:6px; border:1px solid #cbd5e1;">
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span>Billetes Bs 20:</span>
                                <input type="number" min="0" value="0" class="input-arqueo-ves" data-val="20" oninput="recalcularArqueoDiferencias()" style="width:75px; text-align:center; padding:4px; border-radius:6px; border:1px solid #cbd5e1;">
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span>Billetes Bs 10:</span>
                                <input type="number" min="0" value="0" class="input-arqueo-ves" data-val="10" oninput="recalcularArqueoDiferencias()" style="width:75px; text-align:center; padding:4px; border-radius:6px; border:1px solid #cbd5e1;">
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span>Billetes / Monedas Bs 5:</span>
                                <input type="number" min="0" value="0" class="input-arqueo-ves" data-val="5" oninput="recalcularArqueoDiferencias()" style="width:75px; text-align:center; padding:4px; border-radius:6px; border:1px solid #cbd5e1;">
                            </div>
                        </div>

                        <!-- Lotes de Bancos -->
                        <div style="border-top:1px dashed #cbd5e1; padding-top:10px;">
                            <span style="font-weight:700; font-size:0.82rem; color:var(--text-main, #0f172a); display:block; margin-bottom:8px;">
                                Lotes Declarados por Cajero (Bs.):
                            </span>
                            <div style="display:flex; flex-direction:column; gap:6px; font-size:0.8rem;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span>Punto de Venta (Lote POS):</span>
                                    <input type="number" step="0.01" min="0" value="${resumen.puntoDeVentaVES.toFixed(2)}" id="arqueo-lote-punto" oninput="recalcularArqueoDiferencias()" style="width:90px; text-align:right; padding:3px; border-radius:6px; border:1px solid #cbd5e1;">
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span>Pago Móvil (Comprobantes):</span>
                                    <input type="number" step="0.01" min="0" value="${resumen.pagoMovilVES.toFixed(2)}" id="arqueo-lote-pagomovil" oninput="recalcularArqueoDiferencias()" style="width:90px; text-align:right; padding:3px; border-radius:6px; border:1px solid #cbd5e1;">
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span>Biopago BDV:</span>
                                    <input type="number" step="0.01" min="0" value="${resumen.biopagoVES.toFixed(2)}" id="arqueo-lote-biopago" oninput="recalcularArqueoDiferencias()" style="width:90px; text-align:right; padding:3px; border-radius:6px; border:1px solid #cbd5e1;">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- TABLA COMPARATIVA: SISTEMA VS DECLARADO CON DIFERENCIAS -->
                <div style="border:1px solid var(--border-color, #e2e8f0); border-radius:14px; overflow:hidden; margin-bottom:18px;">
                    <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                        <thead style="background:var(--bg-canvas-subtle, #f8fafc); font-weight:700; color:var(--text-main, #0f172a); border-bottom:1px solid var(--border-color, #e2e8f0);">
                            <tr>
                                <th style="padding:10px 14px; text-align:left;">Canal / Forma de Pago</th>
                                <th style="padding:10px 14px; text-align:right;">Esperado (Sistema)</th>
                                <th style="padding:10px 14px; text-align:right;">Declarado (Cajero)</th>
                                <th style="padding:10px 14px; text-align:right;">Diferencia</th>
                                <th style="padding:10px 14px; text-align:center;">Estado</th>
                            </tr>
                        </thead>
                        <tbody id="tbody-arqueo-comparacion" style="font-family:monospace;">
                            <!-- Inyectado dinámicamente -->
                        </tbody>
                    </table>
                </div>

                <!-- Justificación y Observaciones -->
                <div style="margin-bottom:20px;">
                    <label style="display:block; font-size:0.82rem; font-weight:700; margin-bottom:6px; color:var(--text-main, #0f172a);">
                        Observaciones / Justificación del Cuadre:
                    </label>
                    <textarea id="arqueo-observaciones" rows="2" placeholder="Explica aquí si hubo faltantes, billetes en mal estado o diferencias de lote..." style="width:100%; padding:8px 12px; border:1px solid #cbd5e1; border-radius:8px; font-size:0.85rem; font-family:sans-serif;"></textarea>
                </div>

                <!-- Acciones del Modal -->
                <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-color, #e2e8f0); padding-top:16px;">
                    <button type="button" class="btn btn-outline" onclick="generarCorteX()">
                        <i class="fas fa-print"></i> Ver Vista Previa (Corte X)
                    </button>
                    <div style="display:flex; gap:10px;">
                        <button type="button" class="btn btn-outline" onclick="cerrarModalArqueo()">Cancelar</button>
                        <button type="button" class="btn btn-primary" onclick="confirmarCierreTurnoCorteZ()" style="background:#ef4444; border-color:#ef4444; color:#ffffff; font-weight:800; padding:10px 20px;">
                            <i class="fas fa-lock"></i> Cerrar Turno Definitivamente (Corte Z)
                        </button>
                    </div>
                </div>
            </div>
        `;
        modal.classList.add('active');
        recalcularArqueoDiferencias();
    }

    function cerrarModalArqueo() {
        const modal = document.getElementById('modal-caja-arqueo');
        if (modal) modal.classList.remove('active');
    }

    function recalcularArqueoDiferencias() {
        const turno = AppState.turnoActivo;
        if (!turno) return;
        const resumen = calcularResumenTurno(turno);

        // 1. Declarado USD
        let declaradoUSD = 0;
        const denomsUSD = {};
        document.querySelectorAll('.input-arqueo-usd').forEach(inp => {
            const denom = Number(inp.getAttribute('data-val') || 0);
            const cant = Number(inp.value || 0);
            denomsUSD[denom] = cant;
            declaradoUSD += (denom * cant);
        });

        // 2. Declarado Bs
        let declaradoVES = 0;
        const denomsVES = {};
        document.querySelectorAll('.input-arqueo-ves').forEach(inp => {
            const denom = Number(inp.getAttribute('data-val') || 0);
            const cant = Number(inp.value || 0);
            denomsVES[denom] = cant;
            declaradoVES += (denom * cant);
        });

        // 3. Declarado Lotes
        const lotePunto = Number(document.getElementById('arqueo-lote-punto')?.value || 0);
        const lotePagoMovil = Number(document.getElementById('arqueo-lote-pagomovil')?.value || 0);
        const loteBiopago = Number(document.getElementById('arqueo-lote-biopago')?.value || 0);

        // Actualizar badges superiores
        const lblUSD = document.getElementById('lbl-arqueo-total-usd');
        if (lblUSD) lblUSD.textContent = `$${declaradoUSD.toFixed(2)}`;
        const lblVES = document.getElementById('lbl-arqueo-total-ves');
        if (lblVES) lblVES.textContent = `Bs. ${declaradoVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;

        // Comparaciones
        const difUSD = declaradoUSD - resumen.esperadoEfectivoUSD;
        const difVES = declaradoVES - resumen.esperadoEfectivoVES;
        const difPunto = lotePunto - resumen.puntoDeVentaVES;
        const difPagoMovil = lotePagoMovil - resumen.pagoMovilVES;
        const difBiopago = loteBiopago - resumen.biopagoVES;

        function formatearEstado(dif, esDivisa = false) {
            const simbolo = esDivisa ? '$' : 'Bs. ';
            const absDif = Math.abs(dif).toFixed(2);
            if (Math.abs(dif) < 0.01) {
                return `<span style="background:#dcfce7; color:#15803d; font-weight:700; padding:2px 8px; border-radius:6px; font-size:0.75rem;">CUADRADO</span>`;
            } else if (dif < 0) {
                return `<span style="background:#fee2e2; color:#b91c1c; font-weight:700; padding:2px 8px; border-radius:6px; font-size:0.75rem;">FALTANTE -${simbolo}${absDif}</span>`;
            } else {
                return `<span style="background:#fef3c7; color:#b45309; font-weight:700; padding:2px 8px; border-radius:6px; font-size:0.75rem;">SOBRANTE +${simbolo}${absDif}</span>`;
            }
        }

        const tbody = document.getElementById('tbody-arqueo-comparacion');
        if (tbody) {
            tbody.innerHTML = `
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:8px 14px; font-family:sans-serif; font-weight:600;">Efectivo Divisas (USD en Gaveta)</td>
                    <td style="padding:8px 14px; text-align:right;">$${resumen.esperadoEfectivoUSD.toFixed(2)}</td>
                    <td style="padding:8px 14px; text-align:right; font-weight:700;">$${declaradoUSD.toFixed(2)}</td>
                    <td style="padding:8px 14px; text-align:right; font-weight:700; color:${difUSD < 0 ? '#ef4444' : (difUSD > 0 ? '#d97706' : '#10b981')}">${difUSD >= 0 ? '+' : ''}$${difUSD.toFixed(2)}</td>
                    <td style="padding:8px 14px; text-align:center;">${formatearEstado(difUSD, true)}</td>
                </tr>
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:8px 14px; font-family:sans-serif; font-weight:600;">Efectivo Bolívares (VES en Gaveta)</td>
                    <td style="padding:8px 14px; text-align:right;">Bs. ${resumen.esperadoEfectivoVES.toFixed(2)}</td>
                    <td style="padding:8px 14px; text-align:right; font-weight:700;">Bs. ${declaradoVES.toFixed(2)}</td>
                    <td style="padding:8px 14px; text-align:right; font-weight:700; color:${difVES < 0 ? '#ef4444' : (difVES > 0 ? '#d97706' : '#10b981')}">${difVES >= 0 ? '+' : ''}Bs. ${difVES.toFixed(2)}</td>
                    <td style="padding:8px 14px; text-align:center;">${formatearEstado(difVES, false)}</td>
                </tr>
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:8px 14px; font-family:sans-serif; font-weight:600;">Punto de Venta / Tarjetas (VES)</td>
                    <td style="padding:8px 14px; text-align:right;">Bs. ${resumen.puntoDeVentaVES.toFixed(2)}</td>
                    <td style="padding:8px 14px; text-align:right; font-weight:700;">Bs. ${lotePunto.toFixed(2)}</td>
                    <td style="padding:8px 14px; text-align:right; font-weight:700; color:${difPunto < 0 ? '#ef4444' : (difPunto > 0 ? '#d97706' : '#10b981')}">${difPunto >= 0 ? '+' : ''}Bs. ${difPunto.toFixed(2)}</td>
                    <td style="padding:8px 14px; text-align:center;">${formatearEstado(difPunto, false)}</td>
                </tr>
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:8px 14px; font-family:sans-serif; font-weight:600;">Pago Móvil (VES)</td>
                    <td style="padding:8px 14px; text-align:right;">Bs. ${resumen.pagoMovilVES.toFixed(2)}</td>
                    <td style="padding:8px 14px; text-align:right; font-weight:700;">Bs. ${lotePagoMovil.toFixed(2)}</td>
                    <td style="padding:8px 14px; text-align:right; font-weight:700; color:${difPagoMovil < 0 ? '#ef4444' : (difPagoMovil > 0 ? '#d97706' : '#10b981')}">${difPagoMovil >= 0 ? '+' : ''}Bs. ${difPagoMovil.toFixed(2)}</td>
                    <td style="padding:8px 14px; text-align:center;">${formatearEstado(difPagoMovil, false)}</td>
                </tr>
                <tr>
                    <td style="padding:8px 14px; font-family:sans-serif; font-weight:600;">Biopago BDV (VES)</td>
                    <td style="padding:8px 14px; text-align:right;">Bs. ${resumen.biopagoVES.toFixed(2)}</td>
                    <td style="padding:8px 14px; text-align:right; font-weight:700;">Bs. ${loteBiopago.toFixed(2)}</td>
                    <td style="padding:8px 14px; text-align:right; font-weight:700; color:${difBiopago < 0 ? '#ef4444' : (difBiopago > 0 ? '#d97706' : '#10b981')}">${difBiopago >= 0 ? '+' : ''}Bs. ${difBiopago.toFixed(2)}</td>
                    <td style="padding:8px 14px; text-align:center;">${formatearEstado(difBiopago, false)}</td>
                </tr>
            `;
        }
    }

    function confirmarCierreTurnoCorteZ() {
        const turno = AppState.turnoActivo;
        if (!turno) return;

        const resumen = calcularResumenTurno(turno);

        // Recolectar lo declarado
        let declaradoUSD = 0;
        const denomsUSD = {};
        document.querySelectorAll('.input-arqueo-usd').forEach(inp => {
            const denom = Number(inp.getAttribute('data-val') || 0);
            const cant = Number(inp.value || 0);
            denomsUSD[denom] = cant;
            declaradoUSD += (denom * cant);
        });

        let declaradoVES = 0;
        const denomsVES = {};
        document.querySelectorAll('.input-arqueo-ves').forEach(inp => {
            const denom = Number(inp.getAttribute('data-val') || 0);
            const cant = Number(inp.value || 0);
            denomsVES[denom] = cant;
            declaradoVES += (denom * cant);
        });

        const lotePunto = Number(document.getElementById('arqueo-lote-punto')?.value || 0);
        const lotePagoMovil = Number(document.getElementById('arqueo-lote-pagomovil')?.value || 0);
        const loteBiopago = Number(document.getElementById('arqueo-lote-biopago')?.value || 0);
        const obs = (document.getElementById('arqueo-observaciones')?.value || '').trim();

        const difUSD = declaradoUSD - resumen.esperadoEfectivoUSD;
        const difVES = declaradoVES - resumen.esperadoEfectivoVES;

        // Si hay faltante considerable y no hay justificación, pedir confirmación
        if ((difUSD < -1 || difVES < -50) && !obs) {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Justificación Requerida', 'Se detectó un faltante en caja. Por favor escribe una breve explicación en el campo de Observaciones antes de cerrar.', 'warning');
            } else {
                alert('Por favor especifica el motivo del faltante en las observaciones.');
            }
            return;
        }

        const ahoraISO = new Date().toISOString();
        const tasaCierre = Number(AppState.tasaActiva || AppState.tasaUSD_BCV || turno.tasaBCVApertura || 42);

        turno.fechaCierre = ahoraISO;
        turno.tasaBCVCierre = tasaCierre;
        turno.estado = 'CERRADO';
        turno.observaciones = obs;

        turno.sistemaEsperado = {
            efectivoUSD: resumen.esperadoEfectivoUSD,
            efectivoVES: resumen.esperadoEfectivoVES,
            pagoMovilVES: resumen.pagoMovilVES,
            puntoDeVentaVES: resumen.puntoDeVentaVES,
            biopagoVES: resumen.biopagoVES,
            ventasCreditoUSD: resumen.ventasCreditoUSD,
            ventasCreditoVES: resumen.ventasCreditoVES,
            totalVentasNetasUSD: resumen.totalVentasNetasUSD,
            totalTransacciones: resumen.totalTransacciones
        };

        turno.cajeroDeclarado = {
            efectivoUSD: declaradoUSD,
            efectivoVES: declaradoVES,
            denominacionesUSD: denomsUSD,
            denominacionesVES: denomsVES,
            lotesDeclarados: {
                pagoMovilVES: lotePagoMovil,
                puntoDeVentaVES: lotePunto,
                biopagoVES: loteBiopago
            }
        };

        turno.diferencias = {
            diferenciaEfectivoUSD: difUSD,
            diferenciaEfectivoVES: difVES,
            diferenciaPuntoVES: lotePunto - resumen.puntoDeVentaVES,
            diferenciaPagoMovilVES: lotePagoMovil - resumen.pagoMovilVES,
            diferenciaBiopagoVES: loteBiopago - resumen.biopagoVES,
            estadoAuditoria: (Math.abs(difUSD) < 0.01 && Math.abs(difVES) < 0.01) ? 'CUADRADO' : (difUSD < 0 || difVES < 0 ? 'CON_FALTANTE' : 'CON_SOBRANTE')
        };

        // Guardar y sincronizar
        guardarTurnoActivoLocal(null); // Limpiar turno activo
        guardarHistorialTurnos();
        sincronizarTurnoCloud(turno);

        cerrarModalArqueo();
        actualizarBadgesTurno();
        renderizarVistaCajaTurnos();

        // Mostrar Ticket Oficial de Corte Z
        mostrarModalReporteCorte(turno, resumen, 'CORTE_Z');

        if (typeof showCustomToast === 'function') {
            showCustomToast(`Turno #${turno.numeroTurno} CERRADO exitosamente (Corte Z generado)`, 'success');
        }
    }

    // =========================================================================
    // 6. VISOR DE TICKET TÉRMICO (CORTE X / CORTE Z)
    // =========================================================================

    function mostrarModalReporteCorte(turno, resumen, tipoReporte = 'CORTE_Z') {
        let modal = document.getElementById('modal-caja-ticket-reporte');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-caja-ticket-reporte';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }
        modal.onclick = function(e) {
            if (e.target === modal) cerrarModalTicketReporte();
        };

        const esCorteZ = tipoReporte === 'CORTE_Z';
        const titulo = esCorteZ ? 'REPORTE DE CIERRE DEFINITIVO (CORTE Z)' : 'REPORTE PARCIAL DE SUPERVISIÓN (CORTE X)';
        const fechaHora = new Date().toLocaleString();
        const tasa = Number(turno.tasaBCVCierre || turno.tasaBCVApertura || AppState.tasaActiva || AppState.tasaUSD_BCV || 42);

        const difUSD = turno.diferencias ? turno.diferencias.diferenciaEfectivoUSD : 0;
        const difVES = turno.diferencias ? turno.diferencias.diferenciaEfectivoVES : 0;

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px; animation: modalPop 0.25s ease-out; border-radius: 18px; padding: 22px;" onclick="event.stopPropagation();">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid #e2e8f0; padding-bottom:10px; margin-bottom:14px; gap:12px;">
                    <h3 style="margin:0; font-size:1.15rem; color:#0f172a; display:flex; align-items:center; gap:8px; flex:1;">
                        <i class="fas fa-receipt" style="color:${esCorteZ ? '#ef4444' : '#2563eb'};"></i> ${titulo}
                    </h3>
                    <button type="button" onclick="cerrarModalTicketReporte()" aria-label="Cerrar modal" title="Cerrar (Esc o clic afuera)" style="background:#f1f5f9; border:none; color:#334155; width:36px; height:36px; min-width:36px; min-height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:1.15rem; transition:all 0.2s; box-shadow:0 1px 3px rgba(0,0,0,0.1);"><i class="fas fa-times" style="color:#334155;"></i></button>
                </div>

                <!-- Simulación de Ticket Térmico -->
                <div id="ticket-termico-print-area" style="background:#ffffff; color:#000000; font-family:'Courier New', monospace; font-size:0.82rem; padding:16px; border:1px dashed #94a3b8; border-radius:8px; line-height:1.35; max-height:65vh; overflow-y:auto;">
                    <div style="text-align:center; font-weight:bold; margin-bottom:8px;">
                        <div>TU BODEGUITA DE CONFIANZA</div>
                        <div>RIF: J-50000000-0</div>
                        <div>${titulo}</div>
                        <div>----------------------------------------</div>
                    </div>

                    <div>Turno N°: ${turno.numeroTurno}</div>
                    <div>Cajero: ${turno.cajeroNombre}</div>
                    <div>Apertura: ${new Date(turno.fechaApertura).toLocaleTimeString()}</div>
                    ${turno.fechaCierre ? `<div>Cierre: ${new Date(turno.fechaCierre).toLocaleTimeString()}</div>` : `<div>Emitido: ${fechaHora}</div>`}
                    <div>Tasa BCV: Bs. ${tasa.toFixed(2)} / USD</div>
                    <div>----------------------------------------</div>

                    <div style="font-weight:bold;">1. FONDO INICIAL EN GAVETA:</div>
                    <div style="display:flex; justify-content:space-between;">
                        <span>- Efectivo USD:</span>
                        <span>$${Number(turno.fondoInicial?.totalUSD || turno.fondoInicialUSD || 0).toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between;">
                        <span>- Efectivo Bolívares:</span>
                        <span>Bs. ${Number(turno.fondoInicial?.totalVES || turno.fondoInicialVES || 0).toFixed(2)}</span>
                    </div>
                    <div>----------------------------------------</div>

                    <div style="font-weight:bold;">2. VENTAS POR FORMA DE PAGO:</div>
                    <div style="display:flex; justify-content:space-between;">
                        <span>- Efectivo USD:</span>
                        <span>$${resumen.ventasEfectivoUSD.toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between;">
                        <span>- Efectivo Bolívares:</span>
                        <span>Bs. ${resumen.ventasEfectivoVES.toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between;">
                        <span>- Pago Móvil:</span>
                        <span>Bs. ${resumen.pagoMovilVES.toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between;">
                        <span>- Punto de Venta:</span>
                        <span>Bs. ${resumen.puntoDeVentaVES.toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between;">
                        <span>- Biopago BDV:</span>
                        <span>Bs. ${resumen.biopagoVES.toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; border-top:1px dashed #000; padding-top:4px;">
                        <span>- Ventas a Crédito (Fiado):</span>
                        <span>$${resumen.ventasCreditoUSD.toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-weight:bold; margin-top:4px;">
                        <span>TOTAL VENTAS DEL TURNO:</span>
                        <span>$${resumen.totalVentasNetasUSD.toFixed(2)}</span>
                    </div>
                    <div style="font-size:0.75rem;">(Transacciones: ${resumen.totalTransacciones} ventas)</div>
                    <div>----------------------------------------</div>

                    <div style="font-weight:bold;">3. EGRESOS DE CAJA CHICA:</div>
                    <div style="display:flex; justify-content:space-between;">
                        <span>- Salidas en USD:</span>
                        <span>-$${resumen.egresosUSD.toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between;">
                        <span>- Salidas en Bolívares:</span>
                        <span>-Bs. ${resumen.egresosVES.toFixed(2)}</span>
                    </div>
                    <div>----------------------------------------</div>

                    <div style="font-weight:bold;">4. ARQUEO FINAL EN GAVETA:</div>
                    <div>EFECTIVO DIVISAS (USD):</div>
                    <div style="display:flex; justify-content:space-between;">
                        <span>  Esperado:</span>
                        <span>$${resumen.esperadoEfectivoUSD.toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between;">
                        <span>  Declarado:</span>
                        <span>$${Number(turno.cajeroDeclarado?.efectivoUSD || (esCorteZ ? 0 : resumen.esperadoEfectivoUSD)).toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-weight:bold;">
                        <span>  DIFERENCIA:</span>
                        <span>${difUSD >= 0 ? '+' : ''}$${difUSD.toFixed(2)} ${difUSD === 0 ? '(CUADRADO)' : (difUSD < 0 ? '(FALTANTE)' : '(SOBRANTE)')}</span>
                    </div>

                    <div style="margin-top:6px;">EFECTIVO BOLÍVARES (VES):</div>
                    <div style="display:flex; justify-content:space-between;">
                        <span>  Esperado:</span>
                        <span>Bs. ${resumen.esperadoEfectivoVES.toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between;">
                        <span>  Declarado:</span>
                        <span>Bs. ${Number(turno.cajeroDeclarado?.efectivoVES || (esCorteZ ? 0 : resumen.esperadoEfectivoVES)).toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-weight:bold;">
                        <span>  DIFERENCIA:</span>
                        <span>${difVES >= 0 ? '+' : ''}Bs. ${difVES.toFixed(2)}</span>
                    </div>
                    <div>----------------------------------------</div>

                    ${turno.observaciones ? `
                    <div>OBSERVACIONES:</div>
                    <div style="font-size:0.75rem; margin-bottom:8px;">${turno.observaciones}</div>
                    <div>----------------------------------------</div>
                    ` : ''}

                    <div style="text-align:center; margin-top:14px;">
                        <div>_________________________</div>
                        <div>Firma del Cajero</div>
                        <div style="margin-top:14px;">_________________________</div>
                        <div>Firma del Administrador</div>
                        <div style="margin-top:10px; font-weight:bold;">*** FIN DE REPORTE ***</div>
                    </div>
                </div>

                <!-- Botones de Acción para Ticket -->
                <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
                    <button type="button" class="btn btn-outline" onclick="cerrarModalTicketReporte()" style="font-weight:700;">
                        <i class="fas fa-times"></i> Cerrar
                    </button>
                    <button type="button" class="btn btn-outline" onclick="imprimirTicketCorte()"><i class="fas fa-print"></i> Imprimir Ticket</button>
                    <button type="button" class="btn btn-primary" onclick="compartirTicketPorWhatsApp('${turno.id}')" style="background:#25d366; border-color:#25d366; color:#ffffff;">
                        <i class="fab fa-whatsapp"></i> Enviar WhatsApp
                    </button>
                </div>
            </div>
        `;
        modal.classList.add('active');
    }

    function cerrarModalTicketReporte() {
        const modal = document.getElementById('modal-caja-ticket-reporte');
        if (modal) modal.classList.remove('active');
    }

    function imprimirTicketCorte() {
        const printContent = document.getElementById('ticket-termico-print-area');
        if (!printContent) return;

        const ventana = window.open('', '_blank', 'width=380,height=600');
        ventana.document.write(`
            <html>
                <head>
                    <title>Reporte de Caja - Tu Bodeguita</title>
                    <style>
                        body { font-family: 'Courier New', monospace; font-size: 11px; margin: 0; padding: 10px; color: #000; }
                        @media print { @page { margin: 0; } body { margin: 5mm; } }
                    </style>
                </head>
                <body>
                    ${printContent.innerHTML}
                    <script>window.onload = function() { window.print(); window.close(); };</script>
                </body>
            </html>
        `);
        ventana.document.close();
    }

    function compartirTicketPorWhatsApp(turnoId) {
        const turno = (AppState.turnosCaja || []).find(t => t.id === turnoId) || AppState.turnoActivo;
        if (!turno) return;
        const resumen = calcularResumenTurno(turno);

        const difUSD = turno.diferencias ? turno.diferencias.diferenciaEfectivoUSD : 0;
        const msg = encodeURIComponent(
            `📊 *TU BODEGUITA DE CONFIANZA*\n` +
            `*Reporte de Turno #${turno.numeroTurno} (${turno.estado})*\n` +
            `👤 Cajero: ${turno.cajeroNombre}\n` +
            `💵 Fondo Inicial USD: $${Number(turno.fondoInicialUSD || 0).toFixed(2)}\n` +
            `🛍️ Ventas del Turno: $${resumen.totalVentasNetasUSD.toFixed(2)}\n` +
            `💵 Efectivo USD en Gaveta: $${resumen.esperadoEfectivoUSD.toFixed(2)}\n` +
            `⚖️ Diferencia USD: ${difUSD >= 0 ? '+' : ''}$${difUSD.toFixed(2)}\n` +
            `💳 Ventas Crédito/Fiado: $${resumen.ventasCreditoUSD.toFixed(2)}\n` +
            `📅 Fecha: ${new Date(turno.fechaApertura).toLocaleDateString()}`
        );

        const tel = AppState.telefonoWhatsApp ? String(AppState.telefonoWhatsApp).replace(/\D/g, '') : '';
        const url = tel ? `https://wa.me/${tel}?text=${msg}` : `https://wa.me/?text=${msg}`;
        window.open(url, '_blank');
    }

    // =========================================================================
    // 7. REGISTRO DE EGRESO DE CAJA CHICA
    // =========================================================================

    function abrirModalEgresoCaja() {
        const turno = AppState.turnoActivo;
        if (!turno || turno.estado !== 'ABIERTO') {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('No hay turno abierto', 'Para registrar un egreso de dinero de gaveta, primero debes abrir un turno.', 'warning');
            } else {
                alert('No hay turno abierto.');
            }
            return;
        }

        let modal = document.getElementById('modal-caja-egreso');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-caja-egreso';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }
        modal.onclick = function(e) {
            if (e.target === modal) cerrarModalEgresoCaja();
        };

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 480px; animation: modalPop 0.25s ease-out; border-radius: 16px; padding: 22px;" onclick="event.stopPropagation();">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid #e2e8f0; padding-bottom:10px; margin-bottom:14px; gap:12px;">
                    <h3 style="margin:0; font-size:1.2rem; color:#0f172a; display:flex; align-items:center; gap:8px;">
                        <i class="fas fa-hand-holding-usd" style="color:#ef4444;"></i> Registrar Salida / Egreso de Caja Chica
                    </h3>
                    <button type="button" onclick="cerrarModalEgresoCaja()" aria-label="Cerrar modal" title="Cerrar (Esc o clic afuera)" style="background:#f1f5f9; border:none; color:#334155; width:36px; height:36px; min-width:36px; min-height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:1.15rem; transition:all 0.2s; box-shadow:0 1px 3px rgba(0,0,0,0.1);"><i class="fas fa-times" style="color:#334155;"></i></button>
                </div>

                <form onsubmit="event.preventDefault(); confirmarEgresoCaja();">
                    <div style="margin-bottom:12px;">
                        <label style="display:block; font-size:0.82rem; font-weight:600; margin-bottom:4px;">Moneda del Egreso:</label>
                        <select id="egreso-moneda" class="pos-cart-select" style="width:100%; padding:8px; border-radius:8px; border:1px solid #cbd5e1;">
                            <option value="USD">Dólares Efectivo ($ USD)</option>
                            <option value="VES">Bolívares Efectivo (Bs. VES)</option>
                        </select>
                    </div>

                    <div style="margin-bottom:12px;">
                        <label style="display:block; font-size:0.82rem; font-weight:600; margin-bottom:4px;">Monto que sale de gaveta:</label>
                        <input type="number" step="0.01" min="0.01" id="egreso-monto" required placeholder="0.00" style="width:100%; padding:8px 12px; border-radius:8px; border:1px solid #cbd5e1; font-weight:bold; font-size:1.1rem;">
                    </div>

                    <div style="margin-bottom:12px;">
                        <label style="display:block; font-size:0.82rem; font-weight:600; margin-bottom:4px;">Motivo / Justificación:</label>
                        <input type="text" id="egreso-motivo" required placeholder="Ej: Pago de hielo, bolsas, flete pan..." style="width:100%; padding:8px 12px; border-radius:8px; border:1px solid #cbd5e1; font-size:0.85rem;">
                    </div>

                    <div style="margin-bottom:16px;">
                        <label style="display:block; font-size:0.82rem; font-weight:600; margin-bottom:4px;">Autorizado por:</label>
                        <input type="text" id="egreso-autorizado" value="${AppState.usuarioActual?.nombre || 'Administrador'}" style="width:100%; padding:8px 12px; border-radius:8px; border:1px solid #cbd5e1; font-size:0.85rem;">
                    </div>

                    <div style="display:flex; justify-content:flex-end; gap:8px;">
                        <button type="button" class="btn btn-outline" onclick="cerrarModalEgresoCaja()">Cancelar</button>
                        <button type="submit" class="btn btn-primary" style="background:#ef4444; border-color:#ef4444; color:#ffffff; font-weight:700;">
                            <i class="fas fa-check"></i> Registrar Salida
                        </button>
                    </div>
                </form>
            </div>
        `;
        modal.classList.add('active');
    }

    function cerrarModalEgresoCaja() {
        const modal = document.getElementById('modal-caja-egreso');
        if (modal) modal.classList.remove('active');
    }

    function confirmarEgresoCaja() {
        const turno = AppState.turnoActivo;
        if (!turno) return;

        const moneda = document.getElementById('egreso-moneda')?.value || 'USD';
        const monto = Number(document.getElementById('egreso-monto')?.value || 0);
        const motivo = (document.getElementById('egreso-motivo')?.value || '').trim();
        const autorizado = (document.getElementById('egreso-autorizado')?.value || '').trim();

        if (monto <= 0 || !motivo) return;

        const nuevoEgreso = {
            id: `EGR-${Date.now().toString().slice(-6)}`,
            turnoId: turno.id,
            moneda: moneda,
            monto: monto,
            montoUSD: moneda === 'USD' ? monto : 0,
            montoVES: moneda === 'VES' ? monto : 0,
            motivo: motivo,
            autorizadoPor: autorizado,
            fecha: new Date().toISOString()
        };

        if (!Array.isArray(AppState.egresosCaja)) AppState.egresosCaja = [];
        AppState.egresosCaja.unshift(nuevoEgreso);

        guardarHistorialTurnos();

        // Registrar en Firestore si está disponible
        try {
            if (typeof firebase !== 'undefined' && firebase.firestore) {
                firebase.firestore().collection('egresos_caja').doc(nuevoEgreso.id).set(nuevoEgreso).catch(() => {});
            }
        } catch (e) {}

        cerrarModalEgresoCaja();
        renderizarVistaCajaTurnos();

        if (typeof showCustomToast === 'function') {
            showCustomToast(`Egreso registrado: ${moneda === 'USD' ? '$' : 'Bs. '}${monto.toFixed(2)} (${motivo})`, 'info');
        }
    }

    // =========================================================================
    // 8. RENDERIZADO VISUAL DEL DASHBOARD DE CONTROL DE CAJA
    // =========================================================================

    function actualizarBadgesTurno() {
        const turno = AppState.turnoActivo;
        const badge = document.getElementById('badge-turno-status');
        if (badge) {
            if (turno && turno.estado === 'ABIERTO') {
                badge.style.display = 'inline-block';
                badge.style.background = '#10b981';
                badge.textContent = `Turno #${turno.numeroTurno} ACTIVO`;
            } else {
                badge.style.display = 'inline-block';
                badge.style.background = '#ef4444';
                badge.textContent = `Caja CERRADA`;
            }
        }

        const barPos = document.getElementById('pos-turno-banner');
        if (barPos) {
            const exigirTurno = Boolean(AppState.exigirTurnoVendedor);
            const usuarioActual = AppState.usuarioActual;
            const esAdmin = typeof esUsuarioAdmin === 'function' ? esUsuarioAdmin(usuarioActual) : (usuarioActual?.rol === 'admin' || usuarioActual?.rol === 'superadmin' || usuarioActual?.id === 'SuperAdmin');
            const esVendedor = !esAdmin && (usuarioActual?.rol === 'vendedor');

            if (turno && turno.estado === 'ABIERTO') {
                barPos.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px; padding:6px 12px; margin-bottom:10px; font-size:0.82rem; color:#065f46;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#10b981;"></span>
                            <strong>Turno #${turno.numeroTurno} Abierto:</strong> ${turno.cajeroNombre} | Fondo: $${Number(turno.fondoInicialUSD || 0).toFixed(2)} USD
                        </div>
                        <div style="display:flex; gap:6px;">
                            <button type="button" class="btn btn-xs" onclick="InventoryApp.CajaTurnos.generarCorteX()" style="background:#ffffff; border:1px solid #10b981; color:#047857; font-weight:700; padding:2px 8px; border-radius:6px;">Corte X</button>
                            <button type="button" class="btn btn-xs" onclick="InventoryApp.CajaTurnos.abrirModalArqueoCierre()" style="background:#ef4444; color:#ffffff; font-weight:700; padding:2px 8px; border-radius:6px;">Cierre / Corte Z</button>
                        </div>
                    </div>
                `;
            } else if (exigirTurno && esVendedor) {
                barPos.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:#fef2f2; border:1px solid #f87171; border-radius:8px; padding:8px 12px; margin-bottom:10px; font-size:0.84rem; color:#991b1b; box-shadow:0 1px 3px rgba(239,68,68,0.1);">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <i class="fas fa-lock" style="font-size:1.15rem; color:#dc2626;"></i>
                            <div>
                                <strong>Ventas Bloqueadas (Turno Requerido):</strong> Como vendedor, debes abrir turno con tu fondo inicial antes de poder vender o fiar.
                            </div>
                        </div>
                        <button type="button" class="btn btn-xs" onclick="InventoryApp.CajaTurnos.abrirModalAperturaTurno()" style="background:#dc2626; color:#ffffff; font-weight:700; padding:4px 12px; border-radius:6px; flex-shrink:0;">
                            <i class="fas fa-key"></i> + Abrir Turno Ahora
                        </button>
                    </div>
                `;
            } else {
                barPos.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:#fff1f2; border:1px solid #fecdd3; border-radius:8px; padding:6px 12px; margin-bottom:10px; font-size:0.82rem; color:#9f1239;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#ef4444;"></span>
                            <strong>Caja sin turno activo:</strong> Registra la apertura para conciliar el dinero del día.
                        </div>
                        <button type="button" class="btn btn-xs" onclick="InventoryApp.CajaTurnos.abrirModalAperturaTurno()" style="background:#10b981; color:#ffffff; font-weight:700; padding:2px 10px; border-radius:6px;">+ Abrir Turno</button>
                    </div>
                `;
            }
        }
    }

    function renderizarVistaCajaTurnos() {
        const container = document.getElementById('caja-turnos');
        if (!container) return;

        const turno = AppState.turnoActivo;
        const resumen = calcularResumenTurno(turno);
        const historial = Array.isArray(AppState.turnosCaja) ? AppState.turnosCaja : [];

        let headerHTML = '';
        if (turno && turno.estado === 'ABIERTO') {
            const horasTranscurridas = ((Date.now() - new Date(turno.fechaApertura).getTime()) / (1000 * 60 * 60)).toFixed(1);
            headerHTML = `
                <div style="background:var(--bg-card, #ffffff); border:1px solid var(--border-color, #e2e8f0); border-radius:16px; padding:20px; margin-bottom:20px; box-shadow:0 2px 4px rgba(0,0,0,0.03);">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                        <div>
                            <div style="display:flex; align-items:center; gap:10px;">
                                <span style="background:#10b981; color:#ffffff; font-weight:800; font-size:0.8rem; padding:4px 10px; border-radius:20px;">TURNO #${turno.numeroTurno} ABIERTO</span>
                                <h2 style="margin:0; font-size:1.4rem; color:var(--text-main, #0f172a);">Cajero: ${turno.cajeroNombre}</h2>
                            </div>
                            <p style="margin:6px 0 0; font-size:0.85rem; color:var(--text-muted, #64748b);">
                                Apertura: ${new Date(turno.fechaApertura).toLocaleTimeString()} (${horasTranscurridas} hrs en servicio) | Tasa BCV: <strong>Bs. ${Number(turno.tasaBCVApertura || 42).toFixed(2)}</strong>
                            </p>
                        </div>
                        <div style="display:flex; gap:10px; flex-wrap:wrap;">
                            <button type="button" class="btn btn-outline" onclick="InventoryApp.CajaTurnos.abrirModalEgresoCaja()" style="display:flex; align-items:center; gap:6px;">
                                <i class="fas fa-hand-holding-usd" style="color:#ef4444;"></i> Salida / Caja Chica
                            </button>
                            <button type="button" class="btn btn-outline" onclick="InventoryApp.CajaTurnos.generarCorteX()" style="display:flex; align-items:center; gap:6px;">
                                <i class="fas fa-print" style="color:#2563eb;"></i> Vista Previa (Corte X)
                            </button>
                            <button type="button" class="btn btn-primary" onclick="InventoryApp.CajaTurnos.abrirModalArqueoCierre()" style="background:#ef4444; border-color:#ef4444; color:#ffffff; font-weight:700; display:flex; align-items:center; gap:6px;">
                                <i class="fas fa-lock"></i> Arqueo & Corte Z (Cierre)
                            </button>
                        </div>
                    </div>
                </div>

                <!-- 4 TARJETAS KPI DE FLUJO DE CAJA -->
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:16px; margin-bottom:20px;">
                    <!-- Efectivo USD en Gaveta -->
                    <div style="background:linear-gradient(135deg, #ecfdf5, #d1fae5); border:1px solid #a7f3d0; border-radius:14px; padding:16px;">
                        <span style="font-size:0.8rem; font-weight:700; color:#065f46; display:block; margin-bottom:4px;">GAVETA EFECTIVO USD</span>
                        <strong style="font-size:1.6rem; color:#047857; display:block;">$${resumen.esperadoEfectivoUSD.toFixed(2)}</strong>
                        <span style="font-size:0.75rem; color:#065f46;">Fondo: $${resumen.fondoInicialUSD.toFixed(2)} + Ventas: $${resumen.ventasEfectivoUSD.toFixed(2)}</span>
                    </div>

                    <!-- Efectivo Bs en Gaveta -->
                    <div style="background:linear-gradient(135deg, #eff6ff, #dbeafe); border:1px solid #bfdbfe; border-radius:14px; padding:16px;">
                        <span style="font-size:0.8rem; font-weight:700; color:#1e40af; display:block; margin-bottom:4px;">GAVETA EFECTIVO BS</span>
                        <strong style="font-size:1.6rem; color:#1d4ed8; display:block;">Bs. ${resumen.esperadoEfectivoVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong>
                        <span style="font-size:0.75rem; color:#1e40af;">Fondo: Bs. ${resumen.fondoInicialVES.toFixed(2)} + Ventas: Bs. ${resumen.ventasEfectivoVES.toFixed(2)}</span>
                    </div>

                    <!-- Lotes Electrónicos -->
                    <div style="background:linear-gradient(135deg, #faf5ff, #f3e8ff); border:1px solid #e9d5ff; border-radius:14px; padding:16px;">
                        <span style="font-size:0.8rem; font-weight:700; color:#6b21a8; display:block; margin-bottom:4px;">BANCOS & LOTES (VES)</span>
                        <strong style="font-size:1.6rem; color:#7e22ce; display:block;">Bs. ${(resumen.pagoMovilVES + resumen.puntoDeVentaVES + resumen.biopagoVES).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong>
                        <span style="font-size:0.75rem; color:#6b21a8;">P.Venta: Bs. ${resumen.puntoDeVentaVES.toFixed(2)} | P.Móvil: Bs. ${resumen.pagoMovilVES.toFixed(2)}</span>
                    </div>

                    <!-- Ventas Fiado / Crédito -->
                    <div style="background:linear-gradient(135deg, #fffbeb, #fef3c7); border:1px solid #fde68a; border-radius:14px; padding:16px;">
                        <span style="font-size:0.8rem; font-weight:700; color:#92400e; display:block; margin-bottom:4px;">VENTAS A CRÉDITO (FIADO)</span>
                        <strong style="font-size:1.6rem; color:#b45309; display:block;">$${resumen.ventasCreditoUSD.toFixed(2)}</strong>
                        <span style="font-size:0.75rem; color:#92400e;">Cuentas x Cobrar generadas en el turno</span>
                    </div>
                </div>
            `;
        } else {
            headerHTML = `
                <div style="background:var(--bg-card, #ffffff); border:1px solid var(--border-color, #e2e8f0); border-radius:16px; padding:24px; margin-bottom:20px; text-align:center;">
                    <div style="max-width:500px; margin:0 auto;">
                        <div style="width:64px; height:64px; border-radius:50%; background:#fef2f2; color:#ef4444; display:flex; align-items:center; justify-content:center; font-size:1.8rem; margin:0 auto 14px;">
                            <i class="fas fa-cash-register"></i>
                        </div>
                        <h2 style="margin:0 0 8px; font-size:1.4rem; color:var(--text-main, #0f172a);">La Caja Principal está Cerrada</h2>
                        <p style="margin:0 0 18px; font-size:0.9rem; color:var(--text-muted, #64748b);">
                            Para iniciar una jornada de ventas con control exacto de gaveta y denominaciones, realiza la apertura de turno.
                        </p>
                        <button type="button" class="btn btn-primary" onclick="InventoryApp.CajaTurnos.abrirModalAperturaTurno()" style="background:#10b981; border-color:#10b981; color:#ffffff; font-weight:700; padding:10px 24px; font-size:0.95rem; border-radius:10px;">
                            <i class="fas fa-key"></i> + Abrir Nuevo Turno de Caja
                        </button>
                    </div>
                </div>
            `;
        }

        // Historial de Turnos y Cortes Anteriores
        let filasHistorial = '';
        if (historial.length === 0) {
            filasHistorial = `<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-muted, #94a3b8);">No hay turnos registrados aún.</td></tr>`;
        } else {
            filasHistorial = historial.map(t => {
                const esActivo = t.estado === 'ABIERTO';
                const difUSD = t.diferencias ? t.diferencias.diferenciaEfectivoUSD : 0;
                let badgeEstado = '';
                if (esActivo) {
                    badgeEstado = `<span style="background:#dcfce7; color:#15803d; font-weight:700; padding:3px 8px; border-radius:6px; font-size:0.75rem;">ABIERTO</span>`;
                } else if (Math.abs(difUSD) < 0.01) {
                    badgeEstado = `<span style="background:#e0e7ff; color:#3730a3; font-weight:700; padding:3px 8px; border-radius:6px; font-size:0.75rem;">CUADRADO</span>`;
                } else if (difUSD < 0) {
                    badgeEstado = `<span style="background:#fee2e2; color:#b91c1c; font-weight:700; padding:3px 8px; border-radius:6px; font-size:0.75rem;">FALTANTE -$${Math.abs(difUSD).toFixed(2)}</span>`;
                } else {
                    badgeEstado = `<span style="background:#fef3c7; color:#92400e; font-weight:700; padding:3px 8px; border-radius:6px; font-size:0.75rem;">SOBRANTE +$${difUSD.toFixed(2)}</span>`;
                }

                return `
                    <tr style="border-bottom:1px solid var(--border-color, #e2e8f0); font-size:0.85rem;">
                        <td style="padding:10px 14px; font-weight:700;">Turno #${t.numeroTurno}</td>
                        <td style="padding:10px 14px;">${new Date(t.fechaApertura).toLocaleDateString()} ${new Date(t.fechaApertura).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
                        <td style="padding:10px 14px;">${t.cajeroNombre || 'Cajero'}</td>
                        <td style="padding:10px 14px; font-weight:700; color:#16a34a;">$${Number(t.fondoInicialUSD || t.fondoInicial?.totalUSD || 0).toFixed(2)}</td>
                        <td style="padding:10px 14px; font-weight:700;">$${Number(t.sistemaEsperado?.totalVentasNetasUSD || 0).toFixed(2)}</td>
                        <td style="padding:10px 14px;">${badgeEstado}</td>
                        <td style="padding:10px 14px; text-align:right;">
                            <button type="button" class="btn btn-xs btn-outline" onclick="InventoryApp.CajaTurnos.reimprimirTicketTurno('${t.id}')" title="Ver Ticket">
                                <i class="fas fa-receipt"></i> Ver Ticket
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        container.innerHTML = `
            <div style="max-width:1200px; margin:0 auto; padding:10px;">
                ${headerHTML}

                <!-- TABLA HISTORIAL DE CORTES Z Y TURNOS -->
                <div style="background:var(--bg-card, #ffffff); border:1px solid var(--border-color, #e2e8f0); border-radius:16px; padding:20px; box-shadow:0 2px 4px rgba(0,0,0,0.03);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                        <h3 style="margin:0; font-size:1.15rem; color:var(--text-main, #0f172a); display:flex; align-items:center; gap:8px;">
                            <i class="fas fa-history" style="color:var(--primary-accent, #2563eb);"></i> Historial de Turnos y Cortes Anteriores
                        </h3>
                    </div>

                    <div style="overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; text-align:left;">
                            <thead style="background:var(--bg-canvas-subtle, #f8fafc); border-bottom:1px solid var(--border-color, #e2e8f0); font-size:0.8rem; font-weight:700; color:var(--text-muted, #64748b);">
                                <tr>
                                    <th style="padding:10px 14px;">N° Turno</th>
                                    <th style="padding:10px 14px;">Fecha Apertura</th>
                                    <th style="padding:10px 14px;">Cajero</th>
                                    <th style="padding:10px 14px;">Fondo Inicial</th>
                                    <th style="padding:10px 14px;">Total Ventas</th>
                                    <th style="padding:10px 14px;">Estado / Cuadre</th>
                                    <th style="padding:10px 14px; text-align:right;">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filasHistorial}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    function reimprimirTicketTurno(turnoId) {
        const turno = (AppState.turnosCaja || []).find(t => t.id === turnoId);
        if (!turno) return;
        const resumen = calcularResumenTurno(turno);
        mostrarModalReporteCorte(turno, resumen, turno.estado === 'CERRADO' ? 'CORTE_Z' : 'CORTE_X');
    }

    // Auto-inicialización al cargar el DOM
    if (typeof document !== 'undefined') {
        // Escucha global para cerrar modales al hacer clic fuera en el fondo (backdrop)
        document.addEventListener('click', (e) => {
            const el = e.target;
            if (el && el.classList && el.classList.contains('modal') && el.classList.contains('active')) {
                if (el.id === 'modal-caja-ticket-reporte') cerrarModalTicketReporte();
                else if (el.id === 'modal-caja-apertura') cerrarModalAperturaTurno();
                else if (el.id === 'modal-caja-arqueo') cerrarModalArqueo();
                else if (el.id === 'modal-caja-egreso') cerrarModalEgresoCaja();
            }
        });

        // Escucha tecla Escape para cerrar cualquier modal de caja abierto
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                cerrarModalTicketReporte();
                cerrarModalAperturaTurno();
                cerrarModalArqueo();
                cerrarModalEgresoCaja();
            }
        });

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(inicializarModuloCaja, 150);
            });
        } else {
            setTimeout(inicializarModuloCaja, 150);
        }
    }

    // =========================================================================
    // 9. EXPORTACIÓN PÚBLICA
    // =========================================================================

    window.InventoryApp.CajaTurnos = {
        init: inicializarModuloCaja,
        abrirModalAperturaTurno,
        cerrarModalAperturaTurno,
        confirmarAperturaTurno,
        generarCorteX,
        abrirModalArqueoCierre,
        cerrarModalArqueo,
        confirmarCierreTurnoCorteZ,
        abrirModalEgresoCaja,
        cerrarModalEgresoCaja,
        confirmarEgresoCaja,
        recalcularFondoApertura,
        recalcularArqueoDiferencias,
        reimprimirTicketTurno,
        calcularResumenTurno,
        actualizarBadgesTurno,
        renderizarVistaCajaTurnos,
        imprimirTicketCorte,
        compartirTicketPorWhatsApp,
        cerrarModalTicketReporte
    };

    // Alias globales para inline HTML
    window.abrirModalAperturaTurno = abrirModalAperturaTurno;
    window.cerrarModalAperturaTurno = cerrarModalAperturaTurno;
    window.recalcularFondoApertura = recalcularFondoApertura;
    window.confirmarAperturaTurno = confirmarAperturaTurno;
    window.generarCorteX = generarCorteX;
    window.abrirModalArqueoCierre = abrirModalArqueoCierre;
    window.cerrarModalArqueo = cerrarModalArqueo;
    window.recalcularArqueoDiferencias = recalcularArqueoDiferencias;
    window.confirmarCierreTurnoCorteZ = confirmarCierreTurnoCorteZ;
    window.abrirModalEgresoCaja = abrirModalEgresoCaja;
    window.cerrarModalEgresoCaja = cerrarModalEgresoCaja;
    window.confirmarEgresoCaja = confirmarEgresoCaja;
    window.imprimirTicketCorte = imprimirTicketCorte;
    window.cerrarModalTicketReporte = cerrarModalTicketReporte;
})();
