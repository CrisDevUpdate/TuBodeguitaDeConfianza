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
        this.STORAGE_KEY_ACTIVE = 'app_theme_active_palette';
        this.STORAGE_KEY_CLIENT = 'app_theme_client_pref';
    }

    /**
     * Alias compatible con app.js (window.InventoryApp.Theme.inicializarTema())
     */
    inicializarTema() {
        this.init();
    }

    /**
     * Inicializa y aplica el tema adecuado al cargar la aplicación
     */
    init() {
        let loadedTheme = null;

        // 1. Cargar paleta activa local (prioridad máxima para persistencia local de usuario)
        try {
            const savedActive = localStorage.getItem(this.STORAGE_KEY_ACTIVE);
            if (savedActive) {
                loadedTheme = JSON.parse(savedActive);
            }
        } catch (e) {
            console.warn('[Theme] Error cargando paleta activa local:', e);
        }

        // 2. Si no hay activa, cargar configuración global guardada
        if (!loadedTheme) {
            try {
                const savedGlobal = localStorage.getItem(this.STORAGE_KEY_GLOBAL);
                if (savedGlobal) {
                    loadedTheme = JSON.parse(savedGlobal);
                }
            } catch (e) {
                console.warn('[Theme] Error cargando tema global:', e);
            }
        }

        // 3. Revisar si hay usuario cliente logueado con preferencia individual
        const usuario = window.AppState?.usuarioActual;
        const isAdmin = usuario && (usuario.rol === 'admin' || usuario.esAdmin);

        if (!isAdmin && usuario) {
            if (usuario.preferences?.theme) {
                loadedTheme = { ...THEME_PRESETS[0], ...(loadedTheme || {}), ...usuario.preferences.theme };
            } else {
                const clientPref = localStorage.getItem(`${this.STORAGE_KEY_CLIENT}_${usuario.id || usuario.cedula}`);
                if (clientPref) {
                    try {
                        loadedTheme = { ...THEME_PRESETS[0], ...(loadedTheme || {}), ...JSON.parse(clientPref) };
                    } catch (e) {}
                }
            }
        }

        const finalTheme = loadedTheme ? { ...THEME_PRESETS[0], ...loadedTheme } : THEME_PRESETS[0];
        this.globalTheme = finalTheme;
        this.currentAppliedTheme = finalTheme;

        this.applyTheme(finalTheme);
    }

    /**
     * Aplica los valores de la paleta al root del DOM y sincroniza estado visual
     */
    applyTheme(theme) {
        if (!theme) return;
        this.currentAppliedTheme = theme;

        const root = document.documentElement;
        if (theme.primary) root.style.setProperty('--primary', theme.primary);
        if (theme.primaryAccent) root.style.setProperty('--primary-accent', theme.primaryAccent);
        if (theme.primaryHover) root.style.setProperty('--primary-hover', theme.primaryHover || theme.primaryAccent);
        if (theme.bgColor) root.style.setProperty('--bg-color', theme.bgColor);
        if (theme.cardBg) root.style.setProperty('--card-bg', theme.cardBg);
        if (theme.textMain) root.style.setProperty('--text-main', theme.textMain);
        if (theme.textMuted) root.style.setProperty('--text-muted', theme.textMuted);
        if (theme.border) root.style.setProperty('--border', theme.border);
        if (theme.borderLight) root.style.setProperty('--border-light', theme.borderLight);
        if (theme.fontFamily) root.style.setProperty('--font-main', theme.fontFamily);

        const themeMode = theme.mode === 'dark' ? 'dark' : 'light';
        root.setAttribute('data-theme', theme.id || (themeMode === 'dark' ? 'dark_oled' : 'indigo_classic'));
        root.setAttribute('data-mode', themeMode);

        if (themeMode === 'dark') {
            root.classList.add('dark-theme');
            if (document.body) document.body.classList.add('dark-theme');
        } else {
            root.classList.remove('dark-theme');
            if (document.body) document.body.classList.remove('dark-theme');
        }

        // Sincronizar barra de estado / meta tag theme-color
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', theme.primary || (themeMode === 'dark' ? '#090d16' : '#1e293b'));
        }
    }

    /**
     * Guarda el tema como configuración Global y Activa en LocalStorage
     */
    async saveGlobalTheme(theme) {
        this.globalTheme = { ...theme };
        this.currentAppliedTheme = { ...theme };

        try {
            localStorage.setItem(this.STORAGE_KEY_GLOBAL, JSON.stringify(this.globalTheme));
            localStorage.setItem(this.STORAGE_KEY_ACTIVE, JSON.stringify(this.globalTheme));
        } catch (e) {
            console.warn('[Theme] Error guardando en localStorage:', e);
        }

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
            window.InventoryApp.Modal.toast('Paleta de colores guardada localmente para tu dispositivo', 'success');
        }
    }

    /**
     * Guarda el tema como preferencia individual y aislada del Cliente
     */
    async saveClientTheme(theme, userId) {
        const uid = userId || window.AppState?.usuarioActual?.id || window.AppState?.usuarioActual?.cedula || 'invitado';
        const clientTheme = { ...theme, userId: uid };

        try {
            localStorage.setItem(`${this.STORAGE_KEY_CLIENT}_${uid}`, JSON.stringify(clientTheme));
            localStorage.setItem(this.STORAGE_KEY_ACTIVE, JSON.stringify(clientTheme));
        } catch (e) {
            console.warn('[Theme] Error guardando cliente en localStorage:', e);
        }

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
            window.InventoryApp.Modal.toast('Tu estilo personalizado ha sido guardado localmente', 'success');
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
                            Elige la apariencia que más te guste. Se guardará de modo local para ti.
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
    renderizarGestorAdmin(containerId = 'config-theme-manager-box') {
        let container = document.getElementById(containerId);
        if (!container) {
            container = document.getElementById('admin-theme-manager-container');
        }
        if (!container) return;

        const current = this.currentAppliedTheme || this.globalTheme || THEME_PRESETS[0];

        // Determinar qué preset está actualmente activo
        const isPresetActive = (p) => {
            if (current.id && current.id === p.id) return true;
            if (current.mode === p.mode && 
                current.primary?.toLowerCase() === p.primary?.toLowerCase() && 
                current.primaryAccent?.toLowerCase() === p.primaryAccent?.toLowerCase()) {
                return true;
            }
            return false;
        };

        container.innerHTML = `
            <div class="card admin-theme-card" style="background:var(--card-bg); border:1px solid var(--border-light); border-radius:14px; padding:20px; margin-bottom:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid var(--border-light); padding-bottom:10px; flex-wrap:wrap; gap:8px;">
                    <div>
                        <h3 style="margin:0; font-size:1.1rem; color:var(--text-main); display:flex; align-items:center; gap:8px;">
                            <i class="fas fa-swatchbook" style="color:var(--primary-accent);"></i> Paleta de Colores & Modo Visual (Persistencia Local)
                        </h3>
                        <p style="margin:2px 0 0 0; font-size:0.84rem; color:var(--text-muted);">
                            Personaliza los colores del sistema. Tu configuración queda guardada localmente y se mantiene al reiniciar la app.
                        </p>
                    </div>
                    <div>
                        <span class="badge" style="background:${current.mode === 'dark' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(37, 99, 235, 0.1)'}; color:${current.mode === 'dark' ? '#60a5fa' : '#2563eb'}; font-weight:700; border:1px solid var(--primary-accent); padding:4px 10px;">
                            <i class="fas ${current.mode === 'dark' ? 'fa-moon' : 'fa-sun'}"></i> ${current.mode === 'dark' ? 'Modo Oscuro Activo' : 'Modo Claro Activo'}
                        </span>
                    </div>
                </div>

                <!-- Presets Rápidos -->
                <div style="margin-bottom:16px;">
                    <label style="font-size:0.85rem; font-weight:700; color:var(--text-main); display:block; margin-bottom:8px;">
                        Presets Rápidos de Sistema
                    </label>
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:10px;">
                        ${THEME_PRESETS.map(preset => {
                            const active = isPresetActive(preset);
                            return `
                                <button type="button" class="btn btn-sm ${active ? 'btn-primary' : 'btn-outline'}" 
                                        onclick="window.InventoryApp.Theme.aplicarPresetAdmin('${preset.id}')"
                                        style="display:flex; align-items:center; gap:8px; justify-content:flex-start; text-align:left; padding:8px 12px; font-weight:${active ? '700' : '500'};">
                                    <span style="width:14px; height:14px; border-radius:4px; background:${preset.primaryAccent}; border:1px solid rgba(0,0,0,0.2); flex-shrink:0;"></span>
                                    <span style="font-size:0.82rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${preset.nombre}</span>
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- Controles Detallados de Colores -->
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:14px; margin-bottom:16px;">
                    <div class="form-group" style="margin-bottom:0;">
                        <label style="font-size:0.8rem; font-weight:700; color:var(--text-main); margin-bottom:6px; display:block;">Color Primario (Header/Sidebar)</label>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <input type="color" id="theme-admin-primary" value="${current.primary || '#1e293b'}" class="theme-color-input" oninput="window.InventoryApp.Theme.previewColorChange('primary')">
                            <input type="text" id="theme-admin-primary-hex" value="${(current.primary || '#1e293b').toUpperCase()}" class="form-control theme-hex-input" maxlength="7" oninput="window.InventoryApp.Theme.onHexInput('primary', this.value)" style="font-size:0.85rem; padding:6px 10px; font-family:monospace; font-weight:700; width:95px; text-transform:uppercase;">
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom:0;">
                        <label style="font-size:0.8rem; font-weight:700; color:var(--text-main); margin-bottom:6px; display:block;">Color Acento (Botones/Acciones)</label>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <input type="color" id="theme-admin-accent" value="${current.primaryAccent || '#2563eb'}" class="theme-color-input" oninput="window.InventoryApp.Theme.previewColorChange('accent')">
                            <input type="text" id="theme-admin-accent-hex" value="${(current.primaryAccent || '#2563eb').toUpperCase()}" class="form-control theme-hex-input" maxlength="7" oninput="window.InventoryApp.Theme.onHexInput('accent', this.value)" style="font-size:0.85rem; padding:6px 10px; font-family:monospace; font-weight:700; width:95px; text-transform:uppercase;">
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom:0;">
                        <label style="font-size:0.8rem; font-weight:700; color:var(--text-main); margin-bottom:6px; display:block;">Fondo del Sistema (Canvas)</label>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <input type="color" id="theme-admin-bg" value="${current.bgColor || '#f1f5f9'}" class="theme-color-input" oninput="window.InventoryApp.Theme.previewColorChange('bg')">
                            <input type="text" id="theme-admin-bg-hex" value="${(current.bgColor || '#f1f5f9').toUpperCase()}" class="form-control theme-hex-input" maxlength="7" oninput="window.InventoryApp.Theme.onHexInput('bg', this.value)" style="font-size:0.85rem; padding:6px 10px; font-family:monospace; font-weight:700; width:95px; text-transform:uppercase;">
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom:0;">
                        <label style="font-size:0.8rem; font-weight:700; color:var(--text-main); margin-bottom:6px; display:block;">Modo de Visualización</label>
                        <select id="theme-admin-mode" class="form-control" style="padding:7px 10px; font-size:0.85rem; font-weight:600;" onchange="window.InventoryApp.Theme.previewColorChange('mode')">
                            <option value="light" ${current.mode !== 'dark' ? 'selected' : ''}>☀️ Modo Claro (Light)</option>
                            <option value="dark" ${current.mode === 'dark' ? 'selected' : ''}>🌙 Modo Oscuro (Dark)</option>
                        </select>
                    </div>
                </div>

                <!-- Barra de Vista Previa en Vivo -->
                <div style="background:var(--bg-color); border:1px solid var(--border); border-radius:10px; padding:12px 14px; margin-bottom:16px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-size:0.8rem; font-weight:700; color:var(--text-main);">Vista Previa en Vivo:</span>
                        <span style="background:var(--primary); color:#ffffff; padding:4px 10px; border-radius:6px; font-size:0.75rem; font-weight:700;">Header</span>
                        <span style="background:var(--primary-accent); color:#ffffff; padding:4px 10px; border-radius:6px; font-size:0.75rem; font-weight:700;">Botón Acción</span>
                        <span style="background:var(--card-bg); color:var(--text-main); border:1px solid var(--border-light); padding:4px 10px; border-radius:6px; font-size:0.75rem; font-weight:600;">Tarjeta</span>
                    </div>
                    <div style="font-size:0.78rem; color:var(--text-muted);">
                        <i class="fas fa-check-circle" style="color:var(--primary-accent);"></i> Guardado local activo
                    </div>
                </div>

                <div style="display:flex; justify-content:flex-end; gap:10px; flex-wrap:wrap;">
                    <button type="button" class="btn btn-outline" onclick="window.InventoryApp.Theme.restaurarDefaultAdmin()" style="font-weight:600; padding:9px 16px;">
                        <i class="fas fa-rotate-left"></i> Restaurar Default
                    </button>
                    <button type="button" class="btn btn-primary" onclick="window.InventoryApp.Theme.guardarAdminCustomTheme()" style="font-weight:700; padding:9px 20px;">
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

    onHexInput(field, hexValue) {
        if (!hexValue) return;
        let cleanHex = hexValue.trim();
        if (!cleanHex.startsWith('#')) cleanHex = '#' + cleanHex;

        if (/^#([0-9A-F]{3}){1,2}$/i.test(cleanHex)) {
            const picker = document.getElementById(`theme-admin-${field}`);
            if (picker) {
                picker.value = cleanHex;
                this.previewColorChange(field);
            }
        }
    }

    previewColorChange(sourceField) {
        const primary = document.getElementById('theme-admin-primary')?.value || this.currentAppliedTheme.primary;
        const accent = document.getElementById('theme-admin-accent')?.value || this.currentAppliedTheme.primaryAccent;
        const bg = document.getElementById('theme-admin-bg')?.value || this.currentAppliedTheme.bgColor;
        const mode = document.getElementById('theme-admin-mode')?.value || 'light';

        const hexPrimary = document.getElementById('theme-admin-primary-hex');
        const hexAccent = document.getElementById('theme-admin-accent-hex');
        const hexBg = document.getElementById('theme-admin-bg-hex');

        if (hexPrimary && sourceField !== 'primary-hex') hexPrimary.value = primary.toUpperCase();
        if (hexAccent && sourceField !== 'accent-hex') hexAccent.value = accent.toUpperCase();
        if (hexBg && sourceField !== 'bg-hex') hexBg.value = bg.toUpperCase();

        const isDark = mode === 'dark';

        const updatedTheme = {
            ...this.currentAppliedTheme,
            id: isDark && bg === '#0b0f19' && primary === '#090d16' ? 'dark_oled' : 'custom_user_theme',
            nombre: isDark ? 'Tema Oscuro Personalizado' : 'Tema Personalizado',
            primary,
            primaryAccent: accent,
            primaryHover: accent,
            bgColor: bg,
            cardBg: isDark ? '#131b2e' : '#ffffff',
            textMain: isDark ? '#f8fafc' : '#0f172a',
            textMuted: isDark ? '#94a3b8' : '#64748b',
            border: isDark ? '#1e293b' : '#cbd5e1',
            borderLight: isDark ? '#334155' : '#e2e8f0',
            mode
        };

        this.currentAppliedTheme = updatedTheme;
        this.globalTheme = updatedTheme;
        this.applyTheme(updatedTheme);

        // PERSISTENCIA LOCAL INMEDIATA: Cada cambio se guarda de inmediato para que si el usuario
        // reinicia la app o recarga, NO se pierda su configuración bajo ninguna circunstancia.
        try {
            localStorage.setItem(this.STORAGE_KEY_ACTIVE, JSON.stringify(updatedTheme));
            localStorage.setItem(this.STORAGE_KEY_GLOBAL, JSON.stringify(updatedTheme));
        } catch (e) {
            console.warn('[Theme] Error en persistencia local reactiva:', e);
        }
    }

    guardarAdminCustomTheme() {
        const primary = document.getElementById('theme-admin-primary')?.value || this.currentAppliedTheme.primary;
        const accent = document.getElementById('theme-admin-accent')?.value || this.currentAppliedTheme.primaryAccent;
        const bg = document.getElementById('theme-admin-bg')?.value || this.currentAppliedTheme.bgColor;
        const mode = document.getElementById('theme-admin-mode')?.value || 'light';

        const isDark = mode === 'dark';

        const customTheme = {
            id: 'custom_admin_' + Date.now(),
            nombre: isDark ? 'Cyber Dark Personalizado' : 'Tema Personalizado de Marca',
            primary,
            primaryAccent: accent,
            primaryHover: accent,
            bgColor: bg,
            cardBg: isDark ? '#131b2e' : '#ffffff',
            textMain: isDark ? '#f8fafc' : '#0f172a',
            textMuted: isDark ? '#94a3b8' : '#64748b',
            border: isDark ? '#1e293b' : '#cbd5e1',
            borderLight: isDark ? '#334155' : '#e2e8f0',
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
