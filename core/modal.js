/**
 * core/modal.js
 * Sistema Centralizado de Modales y Notificaciones Personalizadas
 * "Protocolo Cero-Alert": Reemplaza completamente window.alert, window.confirm y window.prompt
 * con modales interactivos y fluidos construidos directamente en el DOM.
 */

window.InventoryApp = window.InventoryApp || {};

(function() {
    // Inyectar contenedor de modales y toasts en el DOM
    function inicializarDOMModales() {
        if (!document.getElementById('custom-modal-backdrop')) {
            const backdrop = document.createElement('div');
            backdrop.id = 'custom-modal-backdrop';
            backdrop.className = 'custom-modal-backdrop';
            backdrop.innerHTML = `
                <div class="custom-modal-card" id="custom-modal-card">
                    <div class="custom-modal-icon-wrapper" id="custom-modal-icon-wrapper">
                        <i class="fas fa-info" id="custom-modal-icon"></i>
                    </div>
                    <h3 class="custom-modal-title" id="custom-modal-title">Título</h3>
                    <div class="custom-modal-body" id="custom-modal-body">Mensaje</div>
                    <div class="custom-modal-actions" id="custom-modal-actions">
                        <button type="button" class="btn btn-primary" id="custom-modal-btn-confirm">Aceptar</button>
                    </div>
                </div>
            `;
            document.body.appendChild(backdrop);
        }

        if (!document.getElementById('custom-toast-container')) {
            const toastContainer = document.createElement('div');
            toastContainer.id = 'custom-toast-container';
            toastContainer.className = 'custom-toast-container';
            document.body.appendChild(toastContainer);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializarDOMModales);
    } else {
        inicializarDOMModales();
    }

    /**
     * Muestra un Toast no bloqueante
     */
    function showToast(mensaje, tipo = 'info', duracionMs = 3500) {
        inicializarDOMModales();
        const container = document.getElementById('custom-toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `custom-toast-item toast-${tipo}`;
        
        let iconHtml = '<i class="fas fa-info-circle"></i>';
        if (tipo === 'success') iconHtml = '<i class="fas fa-check-circle"></i>';
        if (tipo === 'warning') iconHtml = '<i class="fas fa-triangle-exclamation"></i>';
        if (tipo === 'error' || tipo === 'danger') iconHtml = '<i class="fas fa-circle-xmark"></i>';

        toast.innerHTML = `
            <div class="toast-icon">${iconHtml}</div>
            <div class="toast-text">${mensaje}</div>
            <button type="button" class="toast-close" onclick="this.parentElement.remove()">&times;</button>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-fade-out');
            setTimeout(() => toast.remove(), 300);
        }, duracionMs);
    }

    /**
     * Muestra un Modal de Alerta personalizado (sustituto de window.alert)
     */
    function showAlert(titulo, mensaje, tipo = 'info') {
        return new Promise((resolve) => {
            inicializarDOMModales();
            const backdrop = document.getElementById('custom-modal-backdrop');
            const card = document.getElementById('custom-modal-card');
            const titleEl = document.getElementById('custom-modal-title');
            const bodyEl = document.getElementById('custom-modal-body');
            const iconWrapper = document.getElementById('custom-modal-icon-wrapper');
            const iconEl = document.getElementById('custom-modal-icon');
            const actionsEl = document.getElementById('custom-modal-actions');

            if (!backdrop) {
                console.log(`[Alert: ${tipo}] ${titulo}: ${mensaje}`);
                resolve();
                return;
            }

            // Configurar tipo e ícono
            iconWrapper.className = `custom-modal-icon-wrapper icon-${tipo}`;
            if (tipo === 'success') {
                iconEl.className = 'fas fa-check';
            } else if (tipo === 'warning') {
                iconEl.className = 'fas fa-triangle-exclamation';
            } else if (tipo === 'error' || tipo === 'danger') {
                iconEl.className = 'fas fa-circle-xmark';
            } else {
                iconEl.className = 'fas fa-info';
            }

            titleEl.textContent = titulo || 'Notificación';
            bodyEl.innerHTML = typeof mensaje === 'string' ? mensaje.replace(/\n/g, '<br>') : mensaje;

            actionsEl.innerHTML = `
                <button type="button" class="btn btn-primary" id="custom-modal-btn-confirm" style="min-width: 140px;">
                    Entendido
                </button>
            `;

            const btnConfirm = document.getElementById('custom-modal-btn-confirm');
            const cerrar = () => {
                backdrop.classList.remove('active');
                card.classList.remove('active');
                btnConfirm.removeEventListener('click', cerrar);
                resolve();
            };

            btnConfirm.addEventListener('click', cerrar);
            backdrop.classList.add('active');
            card.classList.add('active');
            btnConfirm.focus();
        });
    }

    /**
     * Muestra un Modal de Confirmación personalizado (sustituto de window.confirm)
     */
    function showConfirm(titulo, mensaje, opciones = {}) {
        const {
            confirmText = 'Confirmar',
            cancelText = 'Cancelar',
            isDanger = false,
            tipo = isDanger ? 'danger' : 'info'
        } = opciones;

        return new Promise((resolve) => {
            inicializarDOMModales();
            const backdrop = document.getElementById('custom-modal-backdrop');
            const card = document.getElementById('custom-modal-card');
            const titleEl = document.getElementById('custom-modal-title');
            const bodyEl = document.getElementById('custom-modal-body');
            const iconWrapper = document.getElementById('custom-modal-icon-wrapper');
            const iconEl = document.getElementById('custom-modal-icon');
            const actionsEl = document.getElementById('custom-modal-actions');

            if (!backdrop) {
                resolve(false);
                return;
            }

            iconWrapper.className = `custom-modal-icon-wrapper icon-${tipo}`;
            if (tipo === 'danger' || isDanger) {
                iconEl.className = 'fas fa-trash-can';
            } else if (tipo === 'warning') {
                iconEl.className = 'fas fa-triangle-exclamation';
            } else {
                iconEl.className = 'fas fa-question';
            }

            titleEl.textContent = titulo || 'Confirmación requerida';
            bodyEl.innerHTML = typeof mensaje === 'string' ? mensaje.replace(/\n/g, '<br>') : mensaje;

            actionsEl.innerHTML = `
                <button type="button" class="btn btn-outline" id="custom-modal-btn-cancel" style="min-width: 120px;">
                    ${cancelText}
                </button>
                <button type="button" class="btn ${isDanger ? 'btn-danger' : 'btn-primary'}" id="custom-modal-btn-confirm" style="min-width: 140px;">
                    ${confirmText}
                </button>
            `;

            const btnCancel = document.getElementById('custom-modal-btn-cancel');
            const btnConfirm = document.getElementById('custom-modal-btn-confirm');

            const handleCancel = () => {
                backdrop.classList.remove('active');
                card.classList.remove('active');
                resolve(false);
            };

            const handleConfirm = () => {
                backdrop.classList.remove('active');
                card.classList.remove('active');
                resolve(true);
            };

            btnCancel.onclick = handleCancel;
            btnConfirm.onclick = handleConfirm;

            backdrop.classList.add('active');
            card.classList.add('active');
            btnConfirm.focus();
        });
    }

    /**
     * Muestra un Modal de Entrada personalizado (sustituto de window.prompt)
     */
    function showPrompt(titulo, mensaje, valorInicial = '', opciones = {}) {
        const {
            placeholder = 'Escribe aquí...',
            inputType = 'text',
            confirmText = 'Aceptar',
            cancelText = 'Cancelar',
            isPassword = false
        } = opciones;

        return new Promise((resolve) => {
            inicializarDOMModales();
            const backdrop = document.getElementById('custom-modal-backdrop');
            const card = document.getElementById('custom-modal-card');
            const titleEl = document.getElementById('custom-modal-title');
            const bodyEl = document.getElementById('custom-modal-body');
            const iconWrapper = document.getElementById('custom-modal-icon-wrapper');
            const iconEl = document.getElementById('custom-modal-icon');
            const actionsEl = document.getElementById('custom-modal-actions');

            if (!backdrop) {
                resolve(null);
                return;
            }

            iconWrapper.className = 'custom-modal-icon-wrapper icon-info';
            iconEl.className = 'fas fa-pen-to-square';

            titleEl.textContent = titulo || 'Ingreso de Información';
            
            const sanitizedMsg = typeof mensaje === 'string' ? mensaje.replace(/\n/g, '<br>') : mensaje;
            bodyEl.innerHTML = `
                <div style="margin-bottom:12px;">${sanitizedMsg}</div>
                <input type="${isPassword ? 'password' : inputType}" id="custom-modal-prompt-input" class="form-control" value="${valorInicial}" placeholder="${placeholder}" style="width:100%; padding:10px 14px; font-size:1rem; border:1px solid var(--border); border-radius:8px; outline:none;" autocomplete="off" />
            `;

            actionsEl.innerHTML = `
                <button type="button" class="btn btn-outline" id="custom-modal-prompt-cancel" style="min-width: 110px;">
                    ${cancelText}
                </button>
                <button type="button" class="btn btn-primary" id="custom-modal-prompt-confirm" style="min-width: 130px;">
                    ${confirmText}
                </button>
            `;

            const inputEl = document.getElementById('custom-modal-prompt-input');
            const btnCancel = document.getElementById('custom-modal-prompt-cancel');
            const btnConfirm = document.getElementById('custom-modal-prompt-confirm');

            const handleCancel = () => {
                backdrop.classList.remove('active');
                card.classList.remove('active');
                resolve(null);
            };

            const handleConfirm = () => {
                const val = inputEl ? inputEl.value : '';
                backdrop.classList.remove('active');
                card.classList.remove('active');
                resolve(val);
            };

            btnCancel.onclick = handleCancel;
            btnConfirm.onclick = handleConfirm;
            inputEl.onkeydown = (e) => {
                if (e.key === 'Enter') handleConfirm();
                if (e.key === 'Escape') handleCancel();
            };

            backdrop.classList.add('active');
            card.classList.add('active');
            setTimeout(() => inputEl && inputEl.focus(), 50);
        });
    }

    // Exponer API en namespace global y de aplicación
    window.InventoryApp.Modal = {
        alert: showAlert,
        confirm: showConfirm,
        prompt: showPrompt,
        toast: showToast
    };

    window.showCustomAlert = showAlert;
    window.showCustomConfirm = showConfirm;
    window.showCustomPrompt = showPrompt;
    window.showCustomToast = showToast;

    // Graceful overrides de primitivas nativas del navegador para evitar popups nativos
    window.alert = function(msg) {
        let title = 'Notificación del Sistema';
        let tipo = 'info';
        const strMsg = String(msg || '');
        if (strMsg.includes('correctamente') || strMsg.includes('éxito') || strMsg.includes('exitosamente') || strMsg.includes('🎉') || strMsg.includes('🏆') || strMsg.includes('✅')) {
            tipo = 'success';
            title = '¡Operación Exitosa!';
        } else if (strMsg.includes('insuficiente') || strMsg.includes('error') || strMsg.includes('Error') || strMsg.includes('cancelad') || strMsg.includes('⚠️') || strMsg.includes('ATENCIÓN')) {
            tipo = 'warning';
            title = 'Atención Requerida';
        }
        showAlert(title, strMsg, tipo);
    };

    window.confirm = function(msg) {
        console.warn('[Zero-Alert Protocol] Interceptada llamada nativa a window.confirm. Usa window.showCustomConfirm().');
        return false;
    };

    window.prompt = function(msg, def) {
        console.warn('[Zero-Alert Protocol] Interceptada llamada nativa a window.prompt. Usa window.showCustomPrompt().');
        return def || null;
    };

})();
