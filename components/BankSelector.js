/**
 * /components/BankSelector.js
 * Pasarela Multibanco Dinámica y Portapapeles Inteligente (Multi-Bank Selector & Clipboard Utility)
 * 
 * Funcionalidades:
 * 1. Estructura dinámica de bancos escalable para agregar nuevas entidades bancarias.
 * 2. Bancos iniciales configurados (Pago Móvil y Transferencias para BDV y Mercantil).
 * 3. Copiado individual de cada dato (teléfono, cédula, cuenta, banco).
 * 4. Copiado global formateado en un solo texto listo para apps bancarias o WhatsApp.
 * 5. Retroalimentación visual interactiva en tiempo real.
 */

window.InventoryApp = window.InventoryApp || {};

const BANCOS_PREDETERMINADOS = [
    {
        id: 'pm_bdv_0102',
        nombre: 'Banco de Venezuela',
        tipo: 'Pago Móvil',
        codigoBanco: '0102',
        telefono: '04125363849',
        telefonoFormato: '0412-536.38.49',
        cedula: '30544641',
        cedulaFormato: 'V-30.544.641',
        cuenta: '',
        titular: 'Tu Bodeguita de Confianza',
        icono: 'fa-mobile-screen-button',
        colorBadge: '#b91c1c',
        badgeBg: '#fee2e2',
        activo: true
    },
    {
        id: 'pm_mercantil_0105',
        nombre: 'Banco Mercantil',
        tipo: 'Pago Móvil',
        codigoBanco: '0105',
        telefono: '04125363849',
        telefonoFormato: '0412-536.38.49',
        cedula: '30544641',
        cedulaFormato: 'V-30.544.641',
        cuenta: '',
        titular: 'Tu Bodeguita de Confianza',
        icono: 'fa-mobile-screen-button',
        colorBadge: '#1d4ed8',
        badgeBg: '#dbeafe',
        activo: true
    },
    {
        id: 'transf_bdv_0102',
        nombre: 'Banco de Venezuela',
        tipo: 'Transferencia Bancaria',
        codigoBanco: '0102',
        telefono: '',
        cedula: '30544641',
        cedulaFormato: 'V-30.544.641',
        cuenta: '01025646546664',
        cuentaFormato: '0102-5646-54-6664',
        titular: 'Tu Bodeguita de Confianza',
        icono: 'fa-building-columns',
        colorBadge: '#b91c1c',
        badgeBg: '#fee2e2',
        activo: true
    },
    {
        id: 'transf_mercantil_0105',
        nombre: 'Banco Mercantil',
        tipo: 'Transferencia Bancaria',
        codigoBanco: '0105',
        telefono: '',
        cedula: '30544641',
        cedulaFormato: 'V-30.544.641',
        cuenta: '010545645646456',
        cuentaFormato: '0105-4564-56-46456',
        titular: 'Tu Bodeguita de Confianza',
        icono: 'fa-building-columns',
        colorBadge: '#1d4ed8',
        badgeBg: '#dbeafe',
        activo: true
    }
];

class MultiBankSelectorManager {
    constructor() {
        this.STORAGE_KEY = 'app_bancos_configurados';
        this.bancos = this.cargarBancos();
        this.bancoSeleccionadoId = this.bancos[0]?.id || 'pm_bdv_0102';
    }

    cargarBancos() {
        try {
            const guardados = localStorage.getItem(this.STORAGE_KEY);
            if (guardados) {
                const parsed = JSON.parse(guardados);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        } catch (e) {
            console.warn('[BankSelector] Error cargando bancos:', e);
        }
        return [...BANCOS_PREDETERMINADOS];
    }

    guardarBancos() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.bancos));
        } catch (e) {
            console.warn('[BankSelector] Error guardando bancos:', e);
        }
    }

    obtenerBancos(soloActivos = true) {
        return soloActivos ? this.bancos.filter(b => b.activo !== false) : this.bancos;
    }

    obtenerBancoPorId(id) {
        return this.bancos.find(b => b.id === id) || this.bancos[0] || null;
    }

    agregarBanco(nuevoBanco) {
        if (!nuevoBanco || !nuevoBanco.nombre) return false;
        const id = nuevoBanco.id || `bank_${Date.now()}`;
        const bancoNormalizado = {
            id,
            nombre: nuevoBanco.nombre.trim(),
            tipo: nuevoBanco.tipo || 'Pago Móvil',
            codigoBanco: nuevoBanco.codigoBanco ? String(nuevoBanco.codigoBanco).trim() : '0102',
            telefono: nuevoBanco.telefono ? String(nuevoBanco.telefono).trim() : '',
            telefonoFormato: nuevoBanco.telefonoFormato || nuevoBanco.telefono || '',
            cedula: nuevoBanco.cedula ? String(nuevoBanco.cedula).trim() : '30544641',
            cedulaFormato: nuevoBanco.cedulaFormato || `V-${nuevoBanco.cedula || '30544641'}`,
            cuenta: nuevoBanco.cuenta ? String(nuevoBanco.cuenta).trim() : '',
            cuentaFormato: nuevoBanco.cuentaFormato || nuevoBanco.cuenta || '',
            titular: nuevoBanco.titular || 'Tu Bodeguita de Confianza',
            icono: (nuevoBanco.tipo === 'Pago Móvil') ? 'fa-mobile-screen-button' : 'fa-building-columns',
            colorBadge: nuevoBanco.colorBadge || '#2563eb',
            badgeBg: nuevoBanco.badgeBg || '#eff6ff',
            activo: true
        };

        this.bancos.push(bancoNormalizado);
        this.guardarBancos();
        return bancoNormalizado;
    }

    eliminarBanco(id) {
        this.bancos = this.bancos.filter(b => b.id !== id);
        this.guardarBancos();
    }

    /**
     * Utilidad universal de portapapeles con fallback robusto
     */
    async copiarAlPortapapeles(texto, labelCampo = '') {
        const textoLimpio = String(texto || '').trim();
        if (!textoLimpio) return;

        let exito = false;
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(textoLimpio);
                exito = true;
            } catch (err) {
                exito = false;
            }
        }

        if (!exito) {
            // Fallback execCommand
            try {
                const textarea = document.createElement('textarea');
                textarea.value = textoLimpio;
                textarea.style.position = 'fixed';
                textarea.style.left = '-999999px';
                textarea.style.top = '-999999px';
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                exito = document.execCommand('copy');
                document.body.removeChild(textarea);
            } catch (e) {
                exito = false;
            }
        }

        if (exito) {
            this.mostrarFeedbackCopiado(labelCampo || textoLimpio);
        } else {
            prompt('Copia manualmente este dato:', textoLimpio);
        }
    }

    /**
     * Genera el resumen global formateado de la entidad bancaria
     */
    generarTextoCompletoBanco(bancoId) {
        const banco = this.obtenerBancoPorId(bancoId);
        if (!banco) return '';

        let resumen = `🏦 *DATOS DE PAGO - TU BODEGUITA DE CONFIANZA*\n`;
        resumen += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
        resumen += `🔹 *Método:* ${banco.tipo}\n`;
        resumen += `🔹 *Banco:* ${banco.nombre} (${banco.codigoBanco})\n`;
        if (banco.telefono) {
            resumen += `📱 *Teléfono:* ${banco.telefono}\n`;
        }
        resumen += `🪪 *C.I / RIF:* ${banco.cedula}\n`;
        if (banco.cuenta) {
            resumen += `💳 *Nº de Cuenta:* ${banco.cuenta}\n`;
        }
        resumen += `👤 *Titular:* ${banco.titular || 'Tu Bodeguita de Confianza'}\n`;
        resumen += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
        resumen += `Por favor incluye el número de referencia al confirmar tu pago.`;

        return resumen;
    }

    /**
     * Copia todos los datos bancarios en un solo clic
     */
    copiarTodosLosDatos(bancoId) {
        const texto = this.generarTextoCompletoBanco(bancoId);
        this.copiarAlPortapapeles(texto, 'Datos bancarios completos');
    }

    /**
     * Feedback visual elegante
     */
    mostrarFeedbackCopiado(nombreDato) {
        if (window.InventoryApp && window.InventoryApp.Modal && typeof window.InventoryApp.Modal.toast === 'function') {
            window.InventoryApp.Modal.toast(`📋 ¡${nombreDato} copiado al portapapeles!`, 'success');
            return;
        }

        // Toast de emergencia si el modal no estuviese montado
        let toast = document.getElementById('bank-copy-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'bank-copy-toast';
            toast.style.position = 'fixed';
            toast.style.bottom = '24px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.background = '#0f172a';
            toast.style.color = '#ffffff';
            toast.style.padding = '10px 18px';
            toast.style.borderRadius = '24px';
            toast.style.fontSize = '0.88rem';
            toast.style.fontWeight = '600';
            toast.style.zIndex = '99999';
            toast.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
            toast.style.display = 'flex';
            toast.style.alignItems = 'center';
            toast.style.gap = '8px';
            toast.style.transition = 'all 0.3s ease';
            document.body.appendChild(toast);
        }

        toast.innerHTML = `<i class="fas fa-check-circle" style="color:#22c55e;"></i> Copiado: <b>${nombreDato}</b>`;
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';

        setTimeout(() => {
            if (toast) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(-50%) translateY(10px)';
            }
        }, 2200);
    }

    /**
     * Renderiza el componente interactivo en cualquier contenedor del DOM
     */
    renderizarSelector(containerId, opciones = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const bancosDisponibles = this.obtenerBancos(true);
        if (bancosDisponibles.length === 0) {
            container.innerHTML = `<div style="padding:10px; color:var(--text-muted);">No hay bancos configurados.</div>`;
            return;
        }

        const selectedId = opciones.selectedId || this.bancoSeleccionadoId;
        const bancoActivo = this.obtenerBancoPorId(selectedId);
        this.bancoSeleccionadoId = bancoActivo.id;

        const esPagoMovil = (bancoActivo.tipo === 'Pago Móvil');

        container.innerHTML = `
            <div class="bank-selector-wrapper" style="background:var(--card-bg, #ffffff); border:1px solid var(--border-light, #e2e8f0); border-radius:14px; padding:16px; margin: 12px 0 16px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                
                <!-- Encabezado con Select Desplegable Escalable -->
                <div style="margin-bottom:12px;">
                    <label style="font-size:0.82rem; font-weight:700; color:var(--text-primary, #0f172a); display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
                        <span><i class="fas fa-building-columns" style="color:var(--primary-accent, #2563eb); margin-right:6px;"></i> Selecciona la Cuenta / Banco de Destino:</span>
                        <span class="badge" style="background:${bancoActivo.badgeBg}; color:${bancoActivo.colorBadge}; font-size:0.75rem; padding:2px 8px; border-radius:12px;">
                            ${bancoActivo.tipo}
                        </span>
                    </label>
                    
                    <select id="bank-selector-dropdown-${containerId}" class="form-control" 
                            style="font-weight:600; font-size:0.9rem; padding:8px 12px; cursor:pointer;"
                            onchange="window.InventoryApp.BankSelector.cambiarBanco('${containerId}', this.value)">
                        ${bancosDisponibles.map(b => `
                            <option value="${b.id}" ${b.id === bancoActivo.id ? 'selected' : ''}>
                                ${b.tipo === 'Pago Móvil' ? '📱' : '🏦'} ${b.nombre} (${b.codigoBanco}) - ${b.tipo}
                            </option>
                        `).join('')}
                    </select>
                </div>

                <!-- Tarjeta de Datos con Copiado Inteligente -->
                <div class="bank-details-card" style="background:var(--table-header-bg, #f8fafc); border:1px solid var(--border-light, #e2e8f0); border-radius:10px; padding:12px; font-size:0.88rem;">
                    
                    <!-- Fila Banco -->
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px dashed var(--border-light, #e2e8f0); padding-bottom:6px;">
                        <span style="color:var(--text-muted, #64748b); font-size:0.82rem;">Entidad Bancaria:</span>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <strong style="color:var(--text-primary, #0f172a);">${bancoActivo.nombre} (Cód: ${bancoActivo.codigoBanco})</strong>
                            <button type="button" class="btn-copy-small" onclick="window.InventoryApp.BankSelector.copiarAlPortapapeles('${bancoActivo.codigoBanco}', 'Código de Banco')" title="Copiar código de banco">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                    </div>

                    ${esPagoMovil ? `
                    <!-- Fila Teléfono (Pago Móvil) -->
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px dashed var(--border-light, #e2e8f0); padding-bottom:6px;">
                        <span style="color:var(--text-muted, #64748b); font-size:0.82rem;">Número de Teléfono:</span>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <strong style="color:var(--primary-accent, #2563eb); font-size:0.95rem;">${bancoActivo.telefonoFormato || bancoActivo.telefono}</strong>
                            <button type="button" class="btn-copy-small" onclick="window.InventoryApp.BankSelector.copiarAlPortapapeles('${bancoActivo.telefono}', 'Teléfono')" title="Copiar teléfono">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                    </div>
                    ` : `
                    <!-- Fila Cuenta (Transferencia) -->
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px dashed var(--border-light, #e2e8f0); padding-bottom:6px;">
                        <span style="color:var(--text-muted, #64748b); font-size:0.82rem;">Número de Cuenta:</span>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <code style="font-size:0.85rem; font-weight:700; color:var(--text-primary, #0f172a); background:#e2e8f0; padding:2px 6px; border-radius:4px;">${bancoActivo.cuenta}</code>
                            <button type="button" class="btn-copy-small" onclick="window.InventoryApp.BankSelector.copiarAlPortapapeles('${bancoActivo.cuenta}', 'Número de Cuenta')" title="Copiar número de cuenta">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                    </div>
                    `}

                    <!-- Fila Cédula / RIF -->
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px dashed var(--border-light, #e2e8f0); padding-bottom:6px;">
                        <span style="color:var(--text-muted, #64748b); font-size:0.82rem;">Cédula / RIF:</span>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <strong style="color:var(--text-primary, #0f172a);">${bancoActivo.cedulaFormato || bancoActivo.cedula}</strong>
                            <button type="button" class="btn-copy-small" onclick="window.InventoryApp.BankSelector.copiarAlPortapapeles('${bancoActivo.cedula}', 'Cédula / RIF')" title="Copiar cédula">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Fila Titular -->
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="color:var(--text-muted, #64748b); font-size:0.82rem;">Titular:</span>
                        <span style="font-weight:600; color:var(--text-primary, #0f172a); font-size:0.84rem;">${bancoActivo.titular}</span>
                    </div>
                </div>

                <!-- Botón Global de Copiado Inteligente -->
                <div style="margin-top:10px;">
                    <button type="button" class="btn btn-block" 
                            style="background:linear-gradient(135deg, var(--primary-accent, #2563eb), var(--primary-hover, #1d4ed8)); color:#ffffff; font-weight:700; font-size:0.88rem; padding:10px; border:none; border-radius:8px; display:flex; align-items:center; justify-content:center; gap:8px; cursor:pointer; box-shadow:0 3px 8px rgba(37,99,235,0.25);"
                            onclick="window.InventoryApp.BankSelector.copiarTodosLosDatos('${bancoActivo.id}')">
                        <i class="fas fa-paste"></i> Copiar todos los datos de pago
                    </button>
                </div>
            </div>
        `;
    }

    cambiarBanco(containerId, bancoId) {
        this.bancoSeleccionadoId = bancoId;
        this.renderizarSelector(containerId, { selectedId: bancoId });
    }
}

// Instanciar singleton
window.InventoryApp.BankSelector = new MultiBankSelectorManager();
