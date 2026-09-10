import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * /components/AdminRewardConfig.jsx
 * Panel Administrativo: Configuración del Premio del Mes & Sistema de Puntos
 * Diseño de 2 Columnas, Carga Directa a Vercel Blob Storage y Presets Compactos.
 */

const PRESETS_PREMIOS = [
  {
    id: 'preset-cafetera',
    nombre: 'Cafetera Espresso Digital 1.5L',
    puntos: 200,
    puntosPorDolar: 1,
    imagen: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600&auto=format&fit=crop&q=80',
    descripcion: 'Cafetera eléctrica con bomba de alta presión para espresso y capuchino.'
  },
  {
    id: 'preset-freidora',
    nombre: 'Freidora de Aire Digital 4.5L',
    puntos: 250,
    puntosPorDolar: 1,
    imagen: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=600&auto=format&fit=crop&q=80',
    descripcion: 'Freidora sin aceite con pantalla táctil y 8 programas preestablecidos.'
  },
  {
    id: 'preset-licuadora',
    nombre: 'Licuadora Profesional 1200W',
    puntos: 180,
    puntosPorDolar: 1,
    imagen: 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=600&auto=format&fit=crop&q=80',
    descripcion: 'Vaso de vidrio refractario resistente a cambios bruscos de temperatura.'
  },
  {
    id: 'preset-ollas',
    nombre: 'Juego de Ollas de Granito Antiadherente',
    puntos: 300,
    puntosPorDolar: 1,
    imagen: 'https://images.unsplash.com/photo-1583778176476-4a8b02a64c01?w=600&auto=format&fit=crop&q=80',
    descripcion: 'Set de 7 piezas de aluminio forjado con recubrimiento de granito ecológico.'
  }
];

export default function AdminRewardConfig({ 
  initialReward = null, 
  onSaveSuccess = null, 
  onBackToUsers = null 
}) {
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // Inicialización de estado con datos de AppState o valores por defecto
  const [formData, setFormData] = useState(() => {
    const globalState = typeof window !== 'undefined' ? window.AppState?.premioMes : null;
    return {
      nombre: initialReward?.nombre || globalState?.nombre || 'Cafetera Espresso Digital 1.5L',
      puntosRequeridos: initialReward?.puntosRequeridos || globalState?.puntosRequeridos || 200,
      puntosPorDolar: initialReward?.puntosPorDolar || globalState?.puntosPorDolar || 1,
      mes: initialReward?.mes || globalState?.mes || 'Mes en Curso',
      descripcion: initialReward?.descripcion || globalState?.descripcion || 'Premio exclusivo del mes para nuestros clientes más fieles. ¡Acumula puntos con cada compra completada!',
      imagen: initialReward?.imagen || globalState?.imagen || 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600&auto=format&fit=crop&q=80'
    };
  });

  const [selectedPresetId, setSelectedPresetId] = useState('preset-cafetera');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadNotice, setUploadNotice] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Auto-ajuste de altura para el textarea
  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(84, textareaRef.current.scrollHeight)}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [formData.descripcion, adjustTextareaHeight]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'puntosRequeridos' || name === 'puntosPorDolar' ? Number(value) : value
    }));
    setSaveSuccess(false);
  };

  // 1. Subida directa a Vercel Blob Storage (/api/upload/blob)
  const uploadImageToBlob = async (file) => {
    if (!file) return;

    if (!file.type.match(/^image\/(png|jpeg|jpg|webp)$/)) {
      alert('Por favor selecciona una imagen válida (.png, .jpg, .webp).');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      alert('La imagen excede el límite de 8MB. Por favor sube una imagen más ligera.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(20);
    setUploadNotice('Procesando archivo para Vercel Blob...');

    try {
      // Conversión a Base64 Data URL para envío unificado
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setUploadProgress(50);
      setUploadNotice('Subiendo a Vercel Blob CDN...');

      const response = await fetch('/api/upload/blob', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileData: base64Data,
          filename: `premios/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
          folder: 'premios',
          contentType: file.type
        })
      });

      setUploadProgress(85);

      if (!response.ok) {
        throw new Error(`Error en subida (${response.status}): ${await response.text()}`);
      }

      const resData = await response.json();
      const publicUrl = resData.url || resData.viewUrl || resData.rawDirectUrl;

      if (!publicUrl) {
        throw new Error('El servidor no retornó una URL pública válida.');
      }

      setUploadProgress(100);
      setUploadNotice('¡Imagen subida exitosamente a Vercel Blob!');

      // Actualizar estado de formulario con la URL pública inmutable
      setFormData(prev => ({
        ...prev,
        imagen: publicUrl
      }));
      setSelectedPresetId(null);

      // Auto-guardado en Firestore de la nueva URL del premio
      await persistRewardToFirestore({ ...formData, imagen: publicUrl });

      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        setUploadNotice(null);
      }, 1500);

    } catch (err) {
      console.error('[AdminRewardConfig] Error subiendo imagen a Vercel Blob:', err);
      alert(`No se pudo subir la imagen a Vercel Blob: ${err.message}`);
      setIsUploading(false);
      setUploadProgress(0);
      setUploadNotice(null);
    }
  };

  // Drag & Drop Handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      uploadImageToBlob(file);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadImageToBlob(e.target.files[0]);
    }
  };

  // 2. Aplicar plantilla preconfigurada
  const handleApplyPreset = (preset) => {
    setSelectedPresetId(preset.id);
    setFormData(prev => ({
      ...prev,
      nombre: preset.nombre,
      puntosRequeridos: preset.puntos,
      puntosPorDolar: preset.puntosPorDolar || 1,
      descripcion: preset.descripcion,
      imagen: preset.imagen
    }));
    setSaveSuccess(false);
  };

  // 3. Persistir en Firebase Firestore & AppState
  const persistRewardToFirestore = async (rewardData) => {
    const payload = {
      nombre: rewardData.nombre.trim(),
      puntosRequeridos: Number(rewardData.puntosRequeridos) || 200,
      puntosPorDolar: Number(rewardData.puntosPorDolar) || 1,
      mes: rewardData.mes.trim() || 'Mes en Curso',
      descripcion: rewardData.descripcion.trim(),
      imagen: rewardData.imagen.trim(),
      temporadaActiva: true,
      updatedAt: new Date().toISOString()
    };

    // Actualizar AppState en tiempo de ejecución
    if (typeof window !== 'undefined') {
      window.AppState = window.AppState || {};
      window.AppState.premioMes = { ...window.AppState.premioMes, ...payload };

      // Sincronizar inputs nativos del DOM si existen
      const inTit = document.getElementById('premio-admin-titulo');
      const inPts = document.getElementById('premio-admin-puntos');
      const inPtsDol = document.getElementById('premio-admin-pts-dolar');
      const inMes = document.getElementById('premio-admin-mes');
      const inDesc = document.getElementById('premio-admin-desc');
      const inImg = document.getElementById('premio-admin-img');
      if (inTit) inTit.value = payload.nombre;
      if (inPts) inPts.value = payload.puntosRequeridos;
      if (inPtsDol) inPtsDol.value = payload.puntosPorDolar;
      if (inMes) inMes.value = payload.mes;
      if (inDesc) inDesc.value = payload.descripcion;
      if (inImg) inImg.value = payload.imagen;
    }

    // Persistir directamente en Cloud Firestore
    try {
      if (window.InventoryApp?.Firebase?.guardarConfiguracionGlobal) {
        await window.InventoryApp.Firebase.guardarConfiguracionGlobal({
          premioMes: payload
        });
      } else if (window.firebase?.firestore) {
        const db = window.firebase.firestore();
        await db.collection('premios').doc('mes').set(payload, { merge: true });
        await db.collection('configuracion').doc('gamificacion').set({ premioMes: payload }, { merge: true });
      }
    } catch (fsErr) {
      console.warn('[AdminRewardConfig] Aviso Firestore (usando fallback local):', fsErr.message);
    }

    // Persistencia local de contingencia
    if (window.InventoryApp?.Persistence?.guardar) {
      window.InventoryApp.Persistence.guardar(true);
    }

    // Refrescar vistas conectadas
    if (typeof window.renderizarPremioMesCliente === 'function') {
      window.renderizarPremioMesCliente();
    }
  };

  // Guardar y Activar Premio
  const handleSaveAndActivate = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!formData.nombre.trim()) {
      alert('Por favor ingresa el nombre del Premio del Mes.');
      return;
    }

    if (formData.puntosRequeridos <= 0) {
      alert('Los puntos requeridos deben ser un número positivo mayor a 0.');
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await persistRewardToFirestore(formData);
      setSaveSuccess(true);

      if (typeof onSaveSuccess === 'function') {
        onSaveSuccess(formData);
      }

      if (window.InventoryApp?.Modal?.alert) {
        window.InventoryApp.Modal.alert(
          '¡Premio Activado!',
          `El Premio del Mes "${formData.nombre}" (${formData.puntosRequeridos} pts) está listo y visible para todos tus clientes.`
        );
      }
    } catch (err) {
      alert(`Error al guardar configuración: ${err.message}`);
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveSuccess(false), 4000);
    }
  };

  // Anunciar por WhatsApp
  const handleAnnounceWhatsApp = () => {
    const texto = 
      `🌟 *¡NUEVA TEMPORADA DE PREMIOS EN TU BODEGUITA DE CONFIANZA!* 🌟\n\n` +
      `🎁 *Gran Premio del Mes:* ${formData.nombre}\n` +
      `🎯 *Meta de Puntos:* ${formData.puntosRequeridos} pts\n` +
      `⭐ *Puntos por cada $1 de compra:* ${formData.puntosPorDolar || 1} pts\n` +
      `📅 *Vigencia:* ${formData.mes}\n\n` +
      `📝 *Detalles:* ${formData.descripcion}\n\n` +
      `🛒 ¡Visita nuestro catálogo online, acumula puntos con cada compra y haz crecer tu Árbol de Fidelidad hasta la Cosecha Dorada!\n\n` +
      `_Tu Bodeguita de Confianza - Calidad y cercanía para tu hogar._`;

    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
  };

  const charCount = formData.descripcion.length;
  const maxChars = 280;

  return (
    <div id="admin-reward-config-root" className="reward-config-container">
      {/* Header del Módulo */}
      <div id="reward-config-header" className="reward-config-header">
        <div className="reward-config-header-title">
          <div className="reward-config-header-icon" aria-hidden="true">
            <i className="fas fa-trophy"></i>
          </div>
          <div>
            <h2 id="reward-config-title">Configuración del Premio del Mes & Sistema de Puntos</h2>
            <p>Establece el incentivo del mes, la equivalencia de puntos por dólar consumido y gestiona la imagen en Vercel Blob.</p>
          </div>
        </div>

        {onBackToUsers && (
          <button 
            type="button" 
            id="btn-back-to-users" 
            className="reward-config-back-btn"
            onClick={onBackToUsers}
          >
            <i className="fas fa-users-gear"></i> Ir a Panel de Usuarios
          </button>
        )}
      </div>

      {/* Grid de 2 Columnas Equilibrado */}
      <form id="reward-config-form" onSubmit={handleSaveAndActivate}>
        <div className="reward-config-grid">
          
          {/* Columna Izquierda: Datos y Parámetros */}
          <div id="reward-config-col-left" className="reward-config-card">
            <div className="reward-config-card-header">
              <h3><i className="fas fa-sliders" style={{ color: 'var(--rc-emerald-600)' }}></i> Parámetros de la Temporada</h3>
            </div>

            {/* Fila 1: Nombre del Premio */}
            <div className="reward-form-group">
              <label htmlFor="reward-input-nombre">
                Nombre del Premio del Mes <span className="required-mark">*</span>
              </label>
              <input
                type="text"
                id="reward-input-nombre"
                name="nombre"
                className="reward-input"
                required
                value={formData.nombre}
                onChange={handleInputChange}
                placeholder="Ej: Cafetera Espresso Digital 1.5L / Freidora de Aire"
              />
            </div>

            {/* Fila 2: Puntos Requeridos y Puntos por Dólar */}
            <div className="reward-form-row">
              <div className="reward-form-group">
                <label htmlFor="reward-input-puntos">
                  Puntos Requeridos <span className="required-mark">*</span>
                </label>
                <input
                  type="number"
                  id="reward-input-puntos"
                  name="puntosRequeridos"
                  className="reward-input"
                  min="1"
                  step="1"
                  required
                  value={formData.puntosRequeridos}
                  onChange={handleInputChange}
                  placeholder="Ej: 200"
                />
              </div>

              <div className="reward-form-group">
                <label htmlFor="reward-input-pts-dolar">
                  Puntos por cada $1.00 <span className="required-mark">*</span>
                </label>
                <input
                  type="number"
                  id="reward-input-pts-dolar"
                  name="puntosPorDolar"
                  className="reward-input"
                  min="0.1"
                  step="0.1"
                  required
                  value={formData.puntosPorDolar}
                  onChange={handleInputChange}
                  placeholder="Ej: 1"
                />
              </div>
            </div>

            {/* Fila 3: Mes de Vigencia */}
            <div className="reward-form-group">
              <label htmlFor="reward-input-mes">Período de Vigencia</label>
              <input
                type="text"
                id="reward-input-mes"
                name="mes"
                className="reward-input"
                value={formData.mes}
                onChange={handleInputChange}
                placeholder="Ej: Mes en Curso / Octubre 2026"
              />
            </div>

            {/* Fila 4: Descripción Detallada con Contador Adaptable */}
            <div className="reward-form-group">
              <label htmlFor="reward-input-desc">
                <span>Descripción Detallada del Premio <span className="required-mark">*</span></span>
              </label>
              <textarea
                ref={textareaRef}
                id="reward-input-desc"
                name="descripcion"
                className="reward-textarea"
                rows="3"
                required
                maxLength={maxChars}
                value={formData.descripcion}
                onChange={handleInputChange}
                placeholder="Describe qué incluye el premio y condiciones de canje para tus clientes..."
              />
              <div className={`reward-char-counter ${charCount > maxChars - 30 ? 'warning' : ''}`}>
                {charCount} / {maxChars} caracteres
              </div>
            </div>

            {/* Plantillas Rápidas Preconfiguradas (Rediseñadas en Chips Horizontales) */}
            <div id="reward-presets-container" className="reward-presets-section">
              <div className="reward-presets-title">
                <i className="fas fa-wand-magic-sparkles" style={{ color: 'var(--rc-amber-500)' }}></i>
                <span>Plantillas Rápidas Preconfiguradas</span>
              </div>
              <div className="reward-presets-grid">
                {PRESETS_PREMIOS.map((preset) => (
                  <div
                    key={preset.id}
                    id={`preset-chip-${preset.id}`}
                    className={`reward-preset-chip ${selectedPresetId === preset.id ? 'active' : ''}`}
                    onClick={() => handleApplyPreset(preset)}
                    role="button"
                    tabIndex="0"
                    title={`Aplicar plantilla: ${preset.nombre}`}
                  >
                    <img
                      src={preset.imagen}
                      alt={preset.nombre}
                      className="reward-preset-thumb"
                      loading="lazy"
                    />
                    <div className="reward-preset-info">
                      <div className="reward-preset-name">{preset.nombre}</div>
                      <div className="reward-preset-meta">
                        <span className="reward-preset-badge">{preset.puntos} Pts</span>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      className="reward-preset-apply-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApplyPreset(preset);
                      }}
                    >
                      {selectedPresetId === preset.id ? 'Activo' : 'Usar'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Columna Derecha: Dropzone Vercel Blob & Live Preview */}
          <div id="reward-config-col-right" className="reward-config-card">
            <div className="reward-config-card-header">
              <h3><i className="fas fa-cloud-arrow-up" style={{ color: 'var(--rc-emerald-600)' }}></i> Multimedia & Live Preview</h3>
              <span className="reward-dropzone-badge">
                <i className="fas fa-bolt"></i> Vercel Blob Storage
              </span>
            </div>

            {/* Dropzone Multimedia */}
            <div
              id="reward-dropzone-box"
              className={`reward-dropzone ${isDragging ? 'dragging' : ''} ${formData.imagen ? 'has-file' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              role="button"
              tabIndex="0"
              aria-label="Zona para arrastrar o seleccionar imagen del premio"
            >
              <input
                ref={fileInputRef}
                type="file"
                id="reward-file-input"
                className="reward-dropzone-input"
                accept="image/png, image/jpeg, image/webp"
                onChange={handleFileSelect}
              />

              <div className="reward-dropzone-content">
                <div className="reward-dropzone-icon">
                  <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-up'}`}></i>
                </div>
                <div>
                  <p className="reward-dropzone-title">
                    {isUploading ? 'Subiendo archivo a Vercel Blob...' : 'Arrastra una imagen o haz clic aquí'}
                  </p>
                  <p className="reward-dropzone-hint">Soporta PNG, JPG o WEBP (Máximo 8MB)</p>
                </div>
              </div>

              {/* Barra de Progreso de Subida */}
              {isUploading && (
                <div id="reward-upload-progress-container" className="reward-upload-progress">
                  <div className="reward-progress-bar-track">
                    <div 
                      className="reward-progress-bar-fill" 
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <div className="reward-upload-status">
                    <span>{uploadNotice}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                </div>
              )}
            </div>

            {/* Previsualización en Tiempo Real: Tarjeta de Perspectiva del Cliente */}
            <div id="reward-live-preview-wrapper">
              <div style={{ marginBottom: '10px', fontSize: '0.82rem', fontWeight: '700', color: 'var(--rc-slate-600)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="fas fa-eye" style={{ color: 'var(--rc-emerald-600)' }}></i> Vista Previa del Cliente (En Vivo):
              </div>

              <div id="reward-client-preview-card" className="reward-preview-box">
                <div className="reward-preview-img-wrapper">
                  <img
                    id="preview-premio-img"
                    src={formData.imagen}
                    alt={formData.nombre}
                    className="reward-preview-img"
                    onError={(e) => {
                      e.target.src = 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600&auto=format&fit=crop&q=80';
                    }}
                  />
                  <div id="preview-premio-badge" className="reward-preview-badge-points">
                    <i className="fas fa-star"></i> {formData.puntosRequeridos} Pts Requeridos
                  </div>
                  <div className="reward-preview-vigencia-badge">
                    <i className="fas fa-calendar-check"></i> {formData.mes}
                  </div>
                </div>

                <div className="reward-preview-body">
                  <h4 id="preview-premio-titulo" className="reward-preview-title">
                    {formData.nombre || 'Nombre del Premio'}
                  </h4>
                  <p id="preview-premio-desc" className="reward-preview-desc">
                    {formData.descripcion || 'Descripción detallada del premio del mes.'}
                  </p>

                  <div className="reward-preview-footer">
                    <span>Equivalencia:</span>
                    <span className="reward-preview-rate">
                      $1.00 = +{formData.puntosPorDolar || 1} Pts
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* Barra de Acción Inferior */}
        <div id="reward-action-bar-container" className="reward-action-bar">
          <button
            type="button"
            id="btn-anunciar-whatsapp"
            className="reward-btn-whatsapp"
            onClick={handleAnnounceWhatsApp}
          >
            <i className="fab fa-whatsapp" style={{ fontSize: '1.15rem' }}></i>
            <span>Anunciar Nueva Temporada por WhatsApp</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {saveSuccess && (
              <span className="reward-success-badge">
                <i className="fas fa-circle-check"></i> ¡Premio Guardado y Activado!
              </span>
            )}

            <button
              type="submit"
              id="btn-guardar-activar-premio"
              className="reward-btn-save"
              disabled={isSaving || isUploading}
            >
              {isSaving ? (
                <>
                  <span className="reward-spinner" aria-hidden="true"></span>
                  <span>Guardando en Firestore...</span>
                </>
              ) : (
                <>
                  <i className="fas fa-floppy-disk"></i>
                  <span>Guardar y Activar Premio del Mes</span>
                </>
              )}
            </button>
          </div>
        </div>

      </form>
    </div>
  );
}
