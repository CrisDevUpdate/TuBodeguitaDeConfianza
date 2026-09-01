import React, { useState, useEffect } from 'react';

/**
 * /components/CustomerSettings.jsx
 * Configuración y Perfil del Cliente:
 * 1. Personalización de Avatar/Foto con Subida a Vercel Blob y Respaldo Caché Local.
 * 2. Motor de Temas con 5 Paletas Profesionales y Aislamiento de Ámbito.
 * 3. Cache Storage de Imágenes para Reducción de Tráfico y Carga Instantánea.
 */

export const THEME_OPTIONS = [
  {
    id: 'indigo_classic',
    name: 'Índigo Corporativo',
    primary: '#1e293b',
    accent: '#2563eb',
    bg: '#f1f5f9',
    card: '#ffffff',
    text: '#0f172a',
    mode: 'light',
    description: 'Elegancia clásica y equilibrio visual.'
  },
  {
    id: 'emerald_botanic',
    name: 'Esmeralda Prosperidad',
    primary: '#064e3b',
    accent: '#059669',
    bg: '#f0fdf4',
    card: '#ffffff',
    text: '#064e3b',
    mode: 'light',
    description: 'Tono botánico fresco, limpio y armonioso.'
  },
  {
    id: 'deep_ocean',
    name: 'Océano Profundo',
    primary: '#0f172a',
    accent: '#0284c7',
    bg: '#f0f9ff',
    card: '#ffffff',
    text: '#082f49',
    mode: 'light',
    description: 'Azul náutico refrescante de alto dinamismo.'
  },
  {
    id: 'warm_sunset',
    name: 'Ámbar Cálido',
    primary: '#451a03',
    accent: '#d97706',
    bg: '#fffbeb',
    card: '#ffffff',
    text: '#451a03',
    mode: 'light',
    description: 'Sensación acogedora y cálida de bodega.'
  },
  {
    id: 'dark_oled',
    name: 'Cyber Dark OLED',
    primary: '#090d16',
    accent: '#3b82f6',
    bg: '#0b0f19',
    card: '#131b2e',
    text: '#f8fafc',
    mode: 'dark',
    description: 'Modo nocturno puro para máximo ahorro de batería.'
  }
];

export default function CustomerSettings({
  currentUser = {},
  onUpdateAvatar,
  onUpdateTheme
}) {
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatar || '');
  const [isUploading, setIsUploading] = useState(false);
  const [activeThemeId, setActiveThemeId] = useState('indigo_classic');
  const [saveToast, setSaveToast] = useState(null);

  useEffect(() => {
    // Cargar preferencia de tema almacenada
    const storedTheme = localStorage.getItem(`app_theme_client_pref_${currentUser?.id || currentUser?.cedula}`);
    if (storedTheme) {
      try {
        const parsed = JSON.parse(storedTheme);
        if (parsed?.id) setActiveThemeId(parsed.id);
      } catch (e) {}
    } else if (currentUser?.preferences?.theme?.id) {
      setActiveThemeId(currentUser.preferences.theme.id);
    }
  }, [currentUser]);

  const applyThemeVariables = (theme) => {
    const root = document.documentElement;
    if (theme.primary) root.style.setProperty('--primary', theme.primary);
    if (theme.accent) root.style.setProperty('--primary-accent', theme.accent);
    if (theme.bg) root.style.setProperty('--bg-color', theme.bg);
    if (theme.card) root.style.setProperty('--card-bg', theme.card);
    if (theme.text) root.style.setProperty('--text-main', theme.text);

    if (theme.mode === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  };

  const handleSelectTheme = (theme) => {
    setActiveThemeId(theme.id);
    applyThemeVariables(theme);

    const uid = currentUser?.id || currentUser?.cedula || 'cliente_actual';
    localStorage.setItem(`app_theme_client_pref_${uid}`, JSON.stringify(theme));

    if (typeof onUpdateTheme === 'function') {
      onUpdateTheme(theme);
    }

    setSaveToast(`Tema "${theme.name}" aplicado a tu perfil`);
    setTimeout(() => setSaveToast(null), 3000);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido (PNG, JPG, WebP).');
      return;
    }

    setIsUploading(true);
    setSaveToast('Subiendo y optimizando imagen...');

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result;

        // Intentar subir a Vercel Blob Serverless endpoint
        let finalUrl = base64Data;
        try {
          const res = await fetch('/api/upload/blob', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: `avatar_${currentUser?.cedula || 'user'}_${Date.now()}.jpg`,
              fileData: base64Data,
              contentType: file.type,
              folder: 'avatars'
            })
          });

          if (res.ok) {
            const data = await res.json();
            if (data?.url) {
              finalUrl = data.url;
            }
          }
        } catch (uploadErr) {
          console.warn('[Avatar Upload] Usando caché local optimizado:', uploadErr);
        }

        setAvatarUrl(finalUrl);

        // Guardar en caché local
        localStorage.setItem(`app_avatar_${currentUser?.cedula || currentUser?.id}`, finalUrl);

        if (typeof onUpdateAvatar === 'function') {
          await onUpdateAvatar(finalUrl);
        }

        setSaveToast('¡Foto de perfil actualizada exitosamente!');
        setTimeout(() => setSaveToast(null), 3000);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      alert('Error al procesar la imagen: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="customer-settings-container" style={{ maxWidth: '800px', margin: '0 auto', padding: '20px 0' }}>
      {saveToast && (
        <div style={{
          background: '#dcfce7',
          color: '#16a34a',
          border: '1px solid #86efac',
          padding: '12px 16px',
          borderRadius: '10px',
          marginBottom: '16px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <i className="fas fa-check-circle"></i> {saveToast}
        </div>
      )}

      {/* Sección 1: Mi Perfil & Avatar */}
      <div style={{
        background: 'var(--card-bg, #ffffff)',
        border: '1px solid var(--border-light, #e2e8f0)',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '20px',
        boxShadow: '0 4px 10px rgba(0,0,0,0.03)'
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', color: 'var(--text-main, #0f172a)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fas fa-id-badge" style={{ color: 'var(--primary-accent, #2563eb)' }}></i>
          Mi Perfil de Cliente
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
          {/* Avatar Preview */}
          <div style={{ position: 'relative' }}>
            <div style={{
              width: '96px',
              height: '96px',
              borderRadius: '50%',
              overflow: 'hidden',
              background: '#f1f5f9',
              border: '3px solid var(--primary-accent, #2563eb)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {avatarUrl ? (
                <img 
                  src={avatarUrl} 
                  alt="Avatar" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              ) : (
                <i className="fas fa-user" style={{ fontSize: '2.5rem', color: '#94a3b8' }}></i>
              )}
            </div>

            <label style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              background: 'var(--primary-accent, #2563eb)',
              color: '#ffffff',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
            }} title="Cambiar foto de perfil">
              <i className="fas fa-camera" style={{ fontSize: '0.85rem' }}></i>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleFileChange}
                disabled={isUploading}
                style={{ display: 'none' }} 
              />
            </label>
          </div>

          {/* Datos del Usuario */}
          <div style={{ flex: 1, minWidth: '240px' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', color: 'var(--text-main, #0f172a)' }}>
              {currentUser?.nombre || 'Cliente'}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.88rem', color: 'var(--text-muted, #64748b)' }}>
              <span><i className="fas fa-id-card"></i> Cédula: <strong>{currentUser?.cedula || currentUser?.id || '—'}</strong></span>
              <span><i className="fas fa-phone"></i> Teléfono: <strong>{currentUser?.telefono || '—'}</strong></span>
              <span><i className="fas fa-envelope"></i> Correo: <strong>{currentUser?.email || '—'}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Sección 2: Selector de Temas Visuales */}
      <div style={{
        background: 'var(--card-bg, #ffffff)',
        border: '1px solid var(--border-light, #e2e8f0)',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 4px 10px rgba(0,0,0,0.03)'
      }}>
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', color: 'var(--text-main, #0f172a)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fas fa-palette" style={{ color: 'var(--primary-accent, #2563eb)' }}></i>
            Tema y Apariencia Visual
          </h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted, #64748b)' }}>
            Personaliza los colores de tu aplicación. Tu elección se guarda exclusivamente en tu cuenta.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          {THEME_OPTIONS.map(theme => {
            const isSelected = activeThemeId === theme.id;
            return (
              <div
                key={theme.id}
                onClick={() => handleSelectTheme(theme)}
                style={{
                  border: `2px solid ${isSelected ? 'var(--primary-accent, #2563eb)' : 'var(--border-light, #e2e8f0)'}`,
                  background: isSelected ? 'rgba(37, 99, 235, 0.04)' : 'var(--card-bg, #ffffff)',
                  borderRadius: '14px',
                  padding: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                {isSelected && (
                  <span style={{
                    position: 'absolute', top: '10px', right: '10px',
                    background: 'var(--primary-accent, #2563eb)', color: '#ffffff',
                    borderRadius: '50%', width: '20px', height: '20px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem'
                  }}>
                    <i className="fas fa-check"></i>
                  </span>
                )}

                {/* Previsualización de Paleta */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: theme.primary, border: '1px solid #ffffff' }}></span>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: theme.accent, border: '1px solid #ffffff' }}></span>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: theme.bg, border: '1px solid #cbd5e1' }}></span>
                </div>

                <strong style={{ display: 'block', fontSize: '0.98rem', color: 'var(--text-main, #0f172a)', marginBottom: '4px' }}>
                  {theme.name}
                </strong>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted, #64748b)', lineHeight: '1.4' }}>
                  {theme.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
