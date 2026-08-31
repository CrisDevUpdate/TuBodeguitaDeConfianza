/**
 * components/ThemeSelector.js
 * MÓDULO 3: Motor de Temas y Personalización de Estilos (Admin vs. Cliente)
 * 
 * Funcionalidades:
 * 1. Control Global (Admin): Define paleta del sistema por defecto para nuevos usuarios y visitas.
 * 2. Preferencia Individual (Cliente): Aislamiento de ámbito en Mi Perfil / Configuración.
 * 3. Aplicación Dinámica e Inmediata de Variables CSS.
 */

window.InventoryApp = window.InventoryApp || {};

const THEME_PRESETS = [
    {
        id: 'indigo_classic',
        nombre: 'Índigo Corporativo',
        primary: '#1e293b',
        primaryAccent: '#2563eb',
        primaryHover: '#1d4ed8',
        bgColor: '#f1f5f9',
        cardBg: '#ffffff',
        textMain: '#0f172a',
        textMuted: '#64748b',
        border: '#cbd5e1',
        borderLight: '#e2e8f0',
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        mode: 'light',
        badge: 'Por Defecto'
    },
    {
        id: 'emerald_botanic',
        nombre: 'Esmeralda Prosperidad',
        primary: '#064e3b',
        primaryAccent: '#059669',
        primaryHover: '#047857',
        bgColor: '#f0fdf4',
        cardBg: '#ffffff',
        textMain: '#064e3b',
        textMuted: '#047857',
        border: '#a7f3d0',
        borderLight: '#d1fae5',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        mode: 'light',
        badge: 'Ecológico'
    },
    {
        id: 'deep_ocean',
        nombre: 'Océano Profundo',
        primary: '#0f172a',
        primaryAccent: '#0284c7',
        primaryHover: '#0369a1',
        bgColor: '#f0f9ff',
        cardBg: '#ffffff',
        textMain: '#082f49',
        textMuted: '#0369a1',
        border: '#bae6fd',
        borderLight: '#e0f2fe',
        fontFamily: "'Outfit', system-ui, sans-serif",
        mode: 'light',
        badge: 'Fresco'
    },
    {
        id: 'warm_sunset',
        nombre: 'Ámbar Cálido',
        primary: '#451a03',
        primaryAccent: '#d97706',
        primaryHover: '#b45309',
        bgColor: '#fffbeb',
        cardBg: '#ffffff',
        textMain: '#451a03',
        textMuted: '#78350f',
        border: '#fde68a',
        borderLight: '#fef3c7',
        fontFamily: "'Poppins', system-ui, sans-serif",
        mode: 'light',
        badge: 'Cálido'
    },
    {
        id: 'dark_oled',
        nombre: 'Cyber Dark OLED',
        primary: '#090d16',
        primaryAccent: '#3b82f6',
        primaryHover: '#60a5fa',
        bgColor: '#0b0f19',
        cardBg: '#131b2e',
        textMain: '#f8fafc',
        textMuted: '#94a3b8',
        border: '#1e293b',
        borderLight: '#334155',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        mode: 'dark',
        badge: 'Noche'
    }
];

class ThemeManager {
    constructor() {
        this.globalTheme = THEME_PRESETS[0];
        this.currentAppliedTheme = THEME_PRESETS[0];
        this.STORAGE_KEY_GLOBAL = 'app_theme_global_config';
        this.STORAGE_KEY_CLIENT = 'app_theme_client_pref';
    }

    /**
     * Inicializa y aplica el tema adecuado al cargar la aplicación
     */
    init() {
        // 1. Cargar tema global guardado
        try {
            const savedGlobal = localStorage.getItem(this.STORAGE_KEY_GLOBAL);
            if (savedGlobal) {
                this.globalTheme = { ...this.globalTheme, ...JSON.parse(savedGlobal) };
            }
        } catch (e) {
            console.warn('[Theme] Error cargando tema global:', e);
        }

        // 2. Determinar si hay usuario actual con preferencia individual
        const usuario = window.AppState?.usuarioActual;
        const isAdmin = usuario && usuario.rol === 'admin';

        let themeToApply = this.globalTheme;

        if (!isAdmin && usuario) {
            // Revisar si el cliente tiene preferencias guardadas
            if (usuario.preferences?.theme) {
                themeToApply = { ...this.globalTheme, ...usuario.preferences.theme };
            } else {
                const clientPref = localStorage.getItem(`${this.STORAGE_KEY_CLIENT}_${usuario.id || usuario.cedula}`);
                if (clientPref) {
                    try {
                        themeToApply = { ...this.globalTheme, ...JSON.parse(clientPref) };
                    } catch (e) {}
                }
            }
        }

        this.applyTheme(themeToApply);
    }

    /**
     * Aplica los valores de la paleta al root del DOM
     */
    applyTheme(theme) {
        if (!theme) return;
        this.currentAppliedTheme = theme;

        const isDark = theme.mode === 'dark' || theme.id === 'dark_oled';
        const root = document.documentElement;
        
        // Colores de texto con contraste garantizado en dark y light mode
        const textPrimary = isDark ? (theme.textMain && theme.textMain.startsWith('#F') ? theme.textMain : '#F9FAFB') : (theme.textMain || '#0f172a');
        const textSecondary = isDark ? '#E5E7EB' : '#334155';
        const textMuted = isDark ? (theme.textMuted || '#9CA3AF') : (theme.textMuted || '#64748b');

        if (theme.primary) root.style.setProperty('--primary', theme.primary);
        if (theme.primaryAccent) root.style.setProperty('--primary-accent', theme.primaryAccent);
        if (theme.primaryHover) root.style.setProperty('--primary-hover', theme.primaryHover);
        if (theme.bgColor) root.style.setProperty('--bg-color', theme.bgColor);
        if (theme.cardBg) root.style.setProperty('--card-bg', theme.cardBg);
        
        root.style.setProperty('--text-main', textPrimary);
        root.style.setProperty('--text-primary', textPrimary);
        root.style.setProperty('--text-secondary', textSecondary);
        root.style.setProperty('--text-muted', textMuted);

        if (theme.border) root.style.setProperty('--border', theme.border);
        if (theme.borderLight) root.style.setProperty('--border-light', theme.borderLight);
        if (theme.fontFamily) root.style.setProperty('--font-main', theme.fontFamily);

        if (isDark) {
            root.style.setProperty('--input-bg', '#1e293b');
            root.style.setProperty('--modal-bg', '#131b2e');
            root.style.setProperty('--table-header-bg', '#0f172a');
            root.style.setProperty('--table-row-hover', '#1e293b');
            document.documentElement.setAttribute('data-theme', 'dark');
            document.body.setAttribute('data-theme', 'dark');
            document.body.classList.add('dark-theme');
        } else {
            root.style.setProperty('--input-bg', '#ffffff');
            root.style.setProperty('--modal-bg', '#ffffff');
            root.style.setProperty('--table-header-bg', '#f8fafc');
            root.style.setProperty('--table-row-hover', '#f1f5f9');
            document.documentElement.setAttribute('data-theme', 'light');
            document.body.setAttribute('data-theme', 'light');
            document.body.classList.remove('dark-theme');
        }
    }

    /**
     * Guarda el tema como configuración Global del Administrador
     */
    async saveGlobalTheme(theme) {
        this.globalTheme = { ...theme };
        localStorage.setItem(this.STORAGE_KEY_GLOBAL, JSON.stringify(this.globalTheme));
        this.applyTheme(this.globalTheme);

        // Sincronizar con API / Firestore si está disponible
        try {
            await fetch('/api/theme/preferences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scope: 'global', theme: this.globalTheme })
            });
        } catch (e) {}

        if (window.InventoryApp.Modal?.toast) {
            window.InventoryApp.Modal.toast('Paleta global de la tienda actualizada con éxito', 'success');
        }
    }

    /**
     * Guarda el tema como preferencia individual y aislada del Cliente
     */
    async saveClientTheme(theme, userId) {
        const uid = userId || window.AppState?.usuarioActual?.id || window.AppState?.usuarioActual?.cedula;
        if (!uid) return;

        const clientTheme = { ...theme, userId: uid };
        localStorage.setItem(`${this.STORAGE_KEY_CLIENT}_${uid}`, JSON.stringify(clientTheme));

        // Asignar en usuario activo
        if (window.AppState?.usuarioActual) {
            window.AppState.usuarioActual.preferences = window.AppState.usuarioActual.preferences || {};
            window.AppState.usuarioActual.preferences.theme = clientTheme;
            if (window.InventoryApp.Persistence?.guardar) {
                window.InventoryApp.Persistence.guardar(true);
            }
        }

        this.applyTheme(clientTheme);

        try {
            await fetch('/api/theme/preferences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scope: 'user', userId: uid, theme: clientTheme })
            });
        } catch (e) {}

        if (window.InventoryApp.Modal?.toast) {
            window.InventoryApp.Modal.toast('Tu estilo personalizado ha sido guardado', 'success');
        }
    }

    /**
     * Renderiza el componente Selector de Tema para la Vista del Cliente
     */
    renderizarSelectorCliente(containerId = 'cliente-theme-selector-container') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const currentId = this.currentAppliedTheme?.id || 'indigo_classic';

        container.innerHTML = `
            <div class="theme-selector-card" style="background:var(--card-bg); border:1px solid var(--border-light); border-radius:14px; padding:18px; margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                    <div>
                        <h4 style="margin:0; font-size:1rem; color:var(--text-main); display:flex; align-items:center; gap:8px;">
                            <i class="fas fa-palette" style="color:var(--primary-accent);"></i> Mi Estilo Visual Personalizado
                        </h4>
                        <p style="margin:2px 0 0 0; font-size:0.8rem; color:var(--text-muted);">
                            Elige la apariencia que más te guste. Solo cambiará en tu dispositivo.
                        </p>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px;">
                    ${THEME_PRESETS.map(preset => `
                        <div class="theme-preset-card ${preset.id === currentId ? 'active' : ''}" 
                             onclick="window.InventoryApp.Theme.seleccionarPresetCliente('${preset.id}')"
                             style="cursor:pointer; border:2px solid ${preset.id === currentId ? 'var(--primary-accent)' : 'var(--border-light)'}; border-radius:10px; padding:10px; background:${preset.bgColor}; transition:all 0.2s ease;">
                            <div style="display:flex; gap:4px; margin-bottom:8px;">
                                <span style="width:18px; height:18px; border-radius:4px; background:${preset.primary}; display:inline-block;"></span>
                                <span style="width:18px; height:18px; border-radius:4px; background:${preset.primaryAccent}; display:inline-block;"></span>
                                <span style="width:18px; height:18px; border-radius:4px; background:${preset.cardBg}; border:1px solid #ccc; display:inline-block;"></span>
                            </div>
                            <div style="font-weight:600; font-size:0.82rem; color:${preset.textMain};">${preset.nombre}</div>
                            <span style="font-size:0.7rem; color:${preset.textMuted};">${preset.badge}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Renderiza el Gestor de Tema Global para el Panel de Configuración del Administrador
     */
    renderizarGestorAdmin(containerId = 'admin-theme-manager-container') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const current = this.globalTheme || THEME_PRESETS[0];

        container.innerHTML = `
            <div class="admin-theme-card" style="background:var(--card-bg); border:1px solid var(--border-light); border-radius:14px; padding:20px; margin-bottom:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid var(--border-light); padding-bottom:10px;">
                    <div>
                        <h3 style="margin:0; font-size:1.1rem; color:var(--text-main); display:flex; align-items:center; gap:8px;">
                            <i class="fas fa-swatchbook" style="color:var(--primary-accent);"></i> Paleta Global de Marca & UI (Por Defecto)
                        </h3>
                        <p style="margin:2px 0 0 0; font-size:0.84rem; color:var(--text-muted);">
                            Configura los colores oficiales que verán todos los nuevos visitantes y clientes sin preferencia.
                        </p>
                    </div>
                </div>

                <!-- Presets Rápidos -->
                <div style="margin-bottom:16px;">
                    <label style="font-size:0.85rem; font-weight:600; color:var(--text-main); display:block; margin-bottom:8px;">Presets de Marca</label>
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:10px;">
                        ${THEME_PRESETS.map(preset => `
                            <button type="button" class="btn btn-sm ${preset.id === current.id ? 'btn-primary' : 'btn-outline'}" 
                                    onclick="window.InventoryApp.Theme.aplicarPresetAdmin('${preset.id}')"
                                    style="display:flex; align-items:center; gap:6px; justify-content:flex-start; text-align:left; padding:8px 10px;">
                                <span style="width:12px; height:12px; border-radius:3px; background:${preset.primaryAccent};"></span>
                                <span style="font-size:0.8rem;">${preset.nombre}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>

                <!-- Controles Detallados de Colores -->
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:14px; margin-bottom:16px;">
                    <div class="form-group">
                        <label style="font-size:0.8rem; font-weight:600;">Color Primario (Header/Sidebar)</label>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <input type="color" id="theme-admin-primary" value="${current.primary}" style="width:40px; height:36px; border:none; border-radius:6px; cursor:pointer;" onchange="window.InventoryApp.Theme.previewColorChange()">
                            <input type="text" id="theme-admin-primary-hex" value="${current.primary}" class="form-control" style="font-size:0.85rem; padding:6px 10px;" readonly>
                        </div>
                    </div>

                    <div class="form-group">
                        <label style="font-size:0.8rem; font-weight:600;">Color Acento (Botones/Acciones)</label>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <input type="color" id="theme-admin-accent" value="${current.primaryAccent}" style="width:40px; height:36px; border:none; border-radius:6px; cursor:pointer;" onchange="window.InventoryApp.Theme.previewColorChange()">
                            <input type="text" id="theme-admin-accent-hex" value="${current.primaryAccent}" class="form-control" style="font-size:0.85rem; padding:6px 10px;" readonly>
                        </div>
                    </div>

                    <div class="form-group">
                        <label style="font-size:0.8rem; font-weight:600;">Fondo del Sistema (Canvas)</label>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <input type="color" id="theme-admin-bg" value="${current.bgColor}" style="width:40px; height:36px; border:none; border-radius:6px; cursor:pointer;" onchange="window.InventoryApp.Theme.previewColorChange()">
                            <input type="text" id="theme-admin-bg-hex" value="${current.bgColor}" class="form-control" style="font-size:0.85rem; padding:6px 10px;" readonly>
                        </div>
                    </div>

                    <div class="form-group">
                        <label style="font-size:0.8rem; font-weight:600;">Modo de Visualización</label>
                        <select id="theme-admin-mode" class="form-control" style="padding:6px 10px; font-size:0.85rem;" onchange="window.InventoryApp.Theme.previewColorChange()">
                            <option value="light" ${current.mode !== 'dark' ? 'selected' : ''}>☀️ Modo Claro (Light)</option>
                            <option value="dark" ${current.mode === 'dark' ? 'selected' : ''}>🌙 Modo Oscuro (Dark)</option>
                        </select>
                    </div>
                </div>

                <div style="display:flex; justify-content:flex-end; gap:10px;">
                    <button type="button" class="btn btn-outline" onclick="window.InventoryApp.Theme.restaurarDefaultAdmin()">
                        <i class="fas fa-rotate-left"></i> Restaurar Default
                    </button>
                    <button type="button" class="btn btn-primary" onclick="window.InventoryApp.Theme.guardarAdminCustomTheme()">
                        <i class="fas fa-floppy-disk"></i> Guardar Tema Global
                    </button>
                </div>
            </div>
        `;
    }

    seleccionarPresetCliente(presetId) {
        const preset = THEME_PRESETS.find(p => p.id === presetId);
        if (preset) {
            this.saveClientTheme(preset);
            this.renderizarSelectorCliente();
        }
    }

    aplicarPresetAdmin(presetId) {
        const preset = THEME_PRESETS.find(p => p.id === presetId);
        if (preset) {
            this.saveGlobalTheme(preset);
            this.renderizarGestorAdmin();
        }
    }

    previewColorChange() {
        const primary = document.getElementById('theme-admin-primary')?.value;
        const accent = document.getElementById('theme-admin-accent')?.value;
        const bg = document.getElementById('theme-admin-bg')?.value;
        const mode = document.getElementById('theme-admin-mode')?.value;

        if (document.getElementById('theme-admin-primary-hex')) document.getElementById('theme-admin-primary-hex').value = primary;
        if (document.getElementById('theme-admin-accent-hex')) document.getElementById('theme-admin-accent-hex').value = accent;
        if (document.getElementById('theme-admin-bg-hex')) document.getElementById('theme-admin-bg-hex').value = bg;

        this.applyTheme({
            ...this.globalTheme,
            primary,
            primaryAccent: accent,
            bgColor: bg,
            mode
        });
    }

    guardarAdminCustomTheme() {
        const primary = document.getElementById('theme-admin-primary')?.value || this.globalTheme.primary;
        const accent = document.getElementById('theme-admin-accent')?.value || this.globalTheme.primaryAccent;
        const bg = document.getElementById('theme-admin-bg')?.value || this.globalTheme.bgColor;
        const mode = document.getElementById('theme-admin-mode')?.value || 'light';

        const customTheme = {
            id: 'custom_admin_' + Date.now(),
            nombre: 'Tema Personalizado de Marca',
            primary,
            primaryAccent: accent,
            primaryHover: accent,
            bgColor: bg,
            cardBg: mode === 'dark' ? '#131b2e' : '#ffffff',
            textMain: mode === 'dark' ? '#f8fafc' : '#0f172a',
            textMuted: mode === 'dark' ? '#94a3b8' : '#64748b',
            border: mode === 'dark' ? '#1e293b' : '#cbd5e1',
            borderLight: mode === 'dark' ? '#334155' : '#e2e8f0',
            mode
        };

        this.saveGlobalTheme(customTheme);
        this.renderizarGestorAdmin();
    }

    restaurarDefaultAdmin() {
        this.saveGlobalTheme(THEME_PRESETS[0]);
        this.renderizarGestorAdmin();
    }
}

// Instanciar singleton
window.InventoryApp.Theme = new ThemeManager();

// Inicializar al cargar el DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.InventoryApp.Theme.init());
} else {
    window.InventoryApp.Theme.init();
}
