/**
 * Módulo de Tasas Oficiales BCV (USD / EUR)
 * - Auto-actualización periódica en segundo plano
 * - Soporte para múltiples fuentes en línea
 * - Modo Manual (Offline / Personalizado)
 * - Persistencia local y recálculo automático en todas las vistas
 */

// Variables de control de sincronización
let bcvEsManual = false;
let bcvAutoInterval = null;

// Formatea números a estilo venezolano (ej: 75,50)
function formatearBs(valor) {
    if (!valor || isNaN(valor)) return '0,00';
    return Number(valor).toLocaleString('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4
    });
}

function actualizarTarjetaInventario() {
    const usdEl = document.getElementById('inventario-tasa-usd');
    const eurEl = document.getElementById('inventario-tasa-eur');
    const fechaInventario = document.getElementById('inventario-fecha-tasa');
    const horaInventario = document.getElementById('inventario-hora-consulta');

    if (usdEl) usdEl.textContent = (tasaUSD_BCV > 0) ? `Bs. ${formatearBs(tasaUSD_BCV)}` : 'No disponible';
    if (eurEl) eurEl.textContent = (tasaEUR_BCV > 0) ? `Bs. ${formatearBs(tasaEUR_BCV)}` : 'No disponible';

    if (fechaInventario) {
        fechaInventario.textContent = fechaTasaBCV ? `${fechaTasaBCV}${bcvEsManual ? ' (Manual)' : ''}` : 'No disponible';
    }

    if (horaInventario) {
        horaInventario.textContent = new Date().toLocaleTimeString('es-VE', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
}

function actualizarVistaTasaBCV() {
    const lblTasa = document.getElementById('tasaActual');
    const lblFecha = document.getElementById('fechaActualizacion');
    const badgeTipo = document.getElementById('tasa-badge-tipo');

    if (monedaSeleccionada === 'EUR') {
        tasaActiva = tasaEUR_BCV || (tasaUSD_BCV * 1.08);
        if (lblTasa) {
            lblTasa.textContent = tasaActiva > 0 ? `1 EUR = Bs. ${formatearBs(tasaActiva)}` : 'No disponible';
        }
    } else {
        tasaActiva = tasaUSD_BCV;
        if (lblTasa) {
            lblTasa.textContent = tasaActiva > 0 ? `1 USD = Bs. ${formatearBs(tasaActiva)}` : 'No disponible';
        }
    }

    if (lblFecha && fechaTasaBCV) {
        lblFecha.textContent = `Actualizado: ${fechaTasaBCV}${bcvEsManual ? ' (Manual)' : ''}`;
    }

    if (badgeTipo) {
        if (bcvEsManual) {
            badgeTipo.style.display = 'inline-flex';
            badgeTipo.className = 'tasa-badge manual';
            badgeTipo.innerHTML = '<i class="fas fa-hand-holding-dollar"></i> Manual';
        } else if (tasaUSD_BCV > 0) {
            badgeTipo.style.display = 'inline-flex';
            badgeTipo.className = 'tasa-badge auto';
            badgeTipo.innerHTML = '<i class="fas fa-bolt"></i> En Vivo';
        } else {
            badgeTipo.style.display = 'none';
        }
    }

    actualizarTarjetaInventario();

    // Actualizar todas las vistas que dependen del cálculo en Bolívares
    if (typeof renderizarPosProductos === 'function') renderizarPosProductos();
    if (typeof renderizarInventario === 'function') renderizarInventario();
    if (typeof renderizarClientes === 'function') renderizarClientes();
    if (typeof renderizarCarrito === 'function') renderizarCarrito();
    if (typeof renderizarTransacciones === 'function') renderizarTransacciones();
    if (typeof clienteSeleccionadoId !== 'undefined' && clienteSeleccionadoId && typeof verDetalleCliente === 'function') {
        verDetalleCliente(clienteSeleccionadoId);
    }
}

// Carga tasas guardadas en localStorage para disponibilidad inmediata offline
function cargarTasasLocales() {
    try {
        const raw = localStorage.getItem('bodeguita_tasas_bcv');
        if (raw) {
            const data = JSON.parse(raw);
            if (data && data.tasaUSD && parseFloat(data.tasaUSD) > 0) {
                tasaUSD_BCV = parseFloat(data.tasaUSD);
                tasaEUR_BCV = parseFloat(data.tasaEUR) || (tasaUSD_BCV * 1.08);
                fechaTasaBCV = data.fechaTasaBCV || new Date().toLocaleDateString('es-VE');
                bcvEsManual = !!data.esManual;
                actualizarVistaTasaBCV();
                return true;
            }
        }
    } catch {
        // Ignorar fallas al leer localStorage
    }
    return false;
}

function guardarTasasLocales() {
    try {
        localStorage.setItem('bodeguita_tasas_bcv', JSON.stringify({
            tasaUSD: tasaUSD_BCV,
            tasaEUR: tasaEUR_BCV,
            fechaTasaBCV: fechaTasaBCV,
            esManual: bcvEsManual,
            updatedAt: Date.now()
        }));
    } catch {
        // Ignorar fallas de cuota de localStorage
    }
}

// Consulta de tasas oficiales en línea
async function obtenerTasaOficialBCV(forzar = false) {
    const status = document.getElementById('bcv-sync-status');
    const btnHeaderRefresh = document.getElementById('btn-refresh-tasa');
    
    if (btnHeaderRefresh) {
        btnHeaderRefresh.classList.add('rotating');
    }

    const setStatus = (tipo, texto, icono) => {
        if (!status) return;
        status.className = `bcv-sync-status ${tipo || ''}`;
        status.innerHTML = `<i class="fas ${icono}"></i> ${texto}`;
    };

    setStatus('', 'Consultando BCV...', 'fa-sync-alt fa-spin');

    let usd = 0;
    let eur = 0;
    let fecha = new Date().toLocaleDateString('es-VE');

    // 1. Consultar endpoint local seguro del servidor
    try {
        const url = `/api/bcv/all?ts=${Date.now()}${forzar ? '&force=true' : ''}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(4500) });
        if (res.ok) {
            const data = await res.json();
            if (data?.usd?.tasa && parseFloat(data.usd.tasa) > 0) {
                usd = parseFloat(data.usd.tasa);
                eur = parseFloat(data.eur?.tasa) || (usd * 1.08);
                fecha = data.usd.fecha || fecha;
                bcvEsManual = false;
            }
        }
    } catch (e) {
        console.warn('[BCV] Backend sync fallback:', e.message);
    }

    // 2. Intentar fuente directa en cliente (DolarApi)
    if (!usd || usd <= 0) {
        try {
            const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', { signal: AbortSignal.timeout(3500) });
            if (res.ok) {
                const data = await res.json();
                const val = data.promedio || data.price || data.tasa;
                if (val && !isNaN(val) && parseFloat(val) > 0) {
                    usd = parseFloat(val);
                    fecha = data.fechaActualizacion ? new Date(data.fechaActualizacion).toLocaleDateString('es-VE') : fecha;
                    bcvEsManual = false;
                }
            }
        } catch (e) {
            console.warn('[BCV] DolarApi client fallback:', e.message);
        }
    }

    // 3. Intentar fuente directa en cliente (BCV API Tech)
    if (!usd || usd <= 0) {
        try {
            const res = await fetch('https://bcvapi.tech/api/v1/dolar/public', { signal: AbortSignal.timeout(3500) });
            if (res.ok) {
                const data = await res.json();
                const val = data.tasa || data.promedio;
                if (val && !isNaN(val) && parseFloat(val) > 0) {
                    usd = parseFloat(val);
                    fecha = data.fecha || fecha;
                    bcvEsManual = false;
                }
            }
        } catch (e) {
            console.warn('[BCV] BCVApi client fallback:', e.message);
        }
    }

    if (btnHeaderRefresh) {
        setTimeout(() => btnHeaderRefresh.classList.remove('rotating'), 500);
    }

    // 4. Evaluar resultado
    if (usd > 0) {
        tasaUSD_BCV = usd;
        tasaEUR_BCV = (eur > 0) ? eur : (usd * 1.08);
        fechaTasaBCV = fecha;
        guardarTasasLocales();
        actualizarVistaTasaBCV();
        setStatus('success', 'Tasas sincronizadas en vivo', 'fa-check-circle');
        return true;
    }

    // Si falló internet pero tenemos una tasa previa guardada localmente
    const teniaCache = cargarTasasLocales();
    if (teniaCache) {
        if (bcvEsManual) {
            setStatus('manual', 'Modo Manual Activo', 'fa-hand-holding-dollar');
        } else {
            setStatus('success', 'Tasa guardada activa', 'fa-check-circle');
        }
    } else {
        // Valor referencial por defecto para que el POS funcione de inmediato
        tasaUSD_BCV = 791.32;
        tasaEUR_BCV = 921.81;
        fechaTasaBCV = new Date().toLocaleDateString('es-VE');
        actualizarVistaTasaBCV();
        setStatus('manual', 'Sin conexión (Configurar Manual)', 'fa-sliders');
    }

    return false;
}

// Fijar tasa de cambio manualmente
function fijarTasaManual(usd, eur = null) {
    const parsedUsd = parseFloat(usd);
    if (isNaN(parsedUsd) || parsedUsd <= 0) {
        alert('Por favor ingrese un valor de tasa válido.');
        return false;
    }

    tasaUSD_BCV = parsedUsd;
    tasaEUR_BCV = (eur && !isNaN(parseFloat(eur)) && parseFloat(eur) > 0) ? parseFloat(eur) : (parsedUsd * 1.08);
    fechaTasaBCV = new Date().toLocaleDateString('es-VE') + ' ' + new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
    bcvEsManual = true;

    guardarTasasLocales();
    actualizarVistaTasaBCV();

    const status = document.getElementById('bcv-sync-status');
    if (status) {
        status.className = 'bcv-sync-status manual';
        status.innerHTML = '<i class="fas fa-hand-holding-dollar"></i> Tasa Manual';
    }

    // Enviar al servidor si está disponible
    fetch('/api/bcv/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usd: tasaUSD_BCV, eur: tasaEUR_BCV, fecha: fechaTasaBCV })
    }).catch(() => {});

    return true;
}

function seleccionarMonedaBCV(moneda) {
    monedaSeleccionada = moneda;
    const btnUsd = document.getElementById('btn-usd');
    const btnEur = document.getElementById('btn-eur');
    if (btnUsd) btnUsd.classList.toggle('active', moneda === 'USD');
    if (btnEur) btnEur.classList.toggle('active', moneda === 'EUR');
    actualizarVistaTasaBCV();
}

function switchTab(tabId) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view-content').forEach(v => v.classList.remove('active'));
    
    if (window.event && window.event.target) {
        window.event.target.classList.add('active');
    }
    const targetView = document.getElementById(tabId);
    if (targetView) targetView.classList.add('active');
}

// Modal de configuración manual
function abrirModalTasaManual() {
    const modal = document.getElementById('modal-tasa-manual');
    if (!modal) return;
    
    const inputUsd = document.getElementById('manual-tasa-usd');
    const inputEur = document.getElementById('manual-tasa-eur');
    const spanActual = document.getElementById('modal-tasa-actual-info');
    
    if (inputUsd) inputUsd.value = tasaUSD_BCV ? tasaUSD_BCV.toFixed(2) : '';
    if (inputEur) inputEur.value = tasaEUR_BCV ? tasaEUR_BCV.toFixed(2) : '';
    if (spanActual) {
        spanActual.textContent = `Tasa actual: 1 USD = Bs. ${formatearBs(tasaUSD_BCV)} (${bcvEsManual ? 'Fijada Manualmente' : 'Automática'})`;
    }
    
    modal.style.display = 'flex';
}

function cerrarModalTasaManual() {
    const modal = document.getElementById('modal-tasa-manual');
    if (modal) modal.style.display = 'none';
}

function guardarTasaManualDesdeModal(e) {
    if (e) e.preventDefault();
    const inputUsd = document.getElementById('manual-tasa-usd');
    const inputEur = document.getElementById('manual-tasa-eur');
    
    const usdVal = parseFloat(inputUsd?.value);
    const eurVal = parseFloat(inputEur?.value);
    
    if (!usdVal || isNaN(usdVal) || usdVal <= 0) {
        alert('Por favor ingrese un valor de tasa válido (ejemplo: 75.40)');
        return;
    }
    
    fijarTasaManual(usdVal, eurVal || (usdVal * 1.08));
    cerrarModalTasaManual();
}

async function restaurarAutoSincronizacionBCV() {
    const btn = document.getElementById('btn-restaurar-auto-bcv');
    if (btn) btn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Conectando...';
    
    try {
        const ok = await obtenerTasaOficialBCV(true);
        if (ok) {
            cerrarModalTasaManual();
        } else {
            alert('No se pudo conectar a los servidores de BCV en este momento. Se mantendrá la tasa actual.');
        }
    } finally {
        if (btn) btn.innerHTML = '<i class="fas fa-cloud-download-alt"></i> Actualizar en vivo (Internet)';
    }
}

// Iniciar sincronización automática
function iniciarSincronizacionBCV() {
    cargarTasasLocales();
    obtenerTasaOficialBCV();

    if (bcvAutoInterval) clearInterval(bcvAutoInterval);
    // Auto-actualizar cada 3 minutos
    bcvAutoInterval = setInterval(() => {
        if (!bcvEsManual) {
            obtenerTasaOficialBCV();
        }
    }, 180000);

    window.addEventListener('online', () => {
        if (!bcvEsManual) {
            obtenerTasaOficialBCV();
        }
    });
}

// Alias para compatibilidad con código existente
window.consultarTasas = obtenerTasaOficialBCV;
window.obtenerTasaOficialBCV = obtenerTasaOficialBCV;
window.iniciarSincronizacionBCV = iniciarSincronizacionBCV;
window.fijarTasaManual = fijarTasaManual;
window.abrirModalTasaManual = abrirModalTasaManual;
window.cerrarModalTasaManual = cerrarModalTasaManual;
window.guardarTasaManualDesdeModal = guardarTasaManualDesdeModal;
window.restaurarAutoSincronizacionBCV = restaurarAutoSincronizacionBCV;
window.seleccionarMonedaBCV = seleccionarMonedaBCV;
window.switchTab = switchTab;
