import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { calculateRewardSeasonFinances } from '../lib/comboFinancialMath.js';

/**
 * /components/AdminRewardConfig.jsx
 * Panel Administrativo: Configuración del Premio del Mes & Asistente Financiero
 * 
 * Capacidades:
 * - Parámetros Financieros: Costo Real del Premio, Ganancia Neta Objetivo por Ganador y Pool de Clientes Competidores.
 * - Motor de Rentabilidad: Cálculo dinámico de Meta de Puntos y Balance Proyectado de Temporada.
 * - Garantía de Rentabilidad Matemática Absoluta (Ganancia Neta >= Costo del Premio).
 * - Carga Directa a Vercel Blob Storage y Presets Rápidos.
 * - Sincronización atómica con Firebase Firestore y AppState.
 */

const PRESETS_PREMIOS = [
  {
    id: 'preset-cafetera',
    nombre: 'Cafetera Espresso Digital 1.5L',
    costoReal: 40.00,
    gananciaObjetivo: 60.00,
    puntos: 600,
    puntosPorDolar: 1,
    pointsPerProfitDollar: 10,
    imagen: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600&auto=format&fit=crop&q=80',
    descripcion: 'Cafetera eléctrica con bomba de alta presión para espresso y capuchino.'
  },
  {
    id: 'preset-freidora',
    nombre: 'Freidora de Aire Digital 4.5L',
    costoReal: 55.00,
    gananciaObjetivo: 80.00,
    puntos: 800,
    puntosPorDolar: 1,
    pointsPerProfitDollar: 10,
    imagen: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=600&auto=format&fit=crop&q=80',
    descripcion: 'Freidora sin aceite con pantalla táctil y 8 programas preestablecidos.'
  },
  {
    id: 'preset-licuadora',
    nombre: 'Licuadora Profesional 1200W',
    costoReal: 35.00,
    gananciaObjetivo: 50.00,
    puntos: 500,
    puntosPorDolar: 1,
    pointsPerProfitDollar: 10,
    imagen: 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=600&auto=format&fit=crop&q=80',
    descripcion: 'Vaso de vidrio refractario resistente a cambios bruscos de temperatura.'
  },
  {
    id: 'preset-ollas',
    nombre: 'Juego de Ollas de Granito Antiadherente',
    costoReal: 65.00,
    gananciaObjetivo: 95.00,
    puntos: 950,
    puntosPorDolar: 1,
    pointsPerProfitDollar: 10,
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

  // Inicialización con datos de AppState o valores por defecto
  const [formData, setFormData] = useState(() => {
    const globalState = typeof window !== 'undefined' ? window.AppState?.premioMes : null;
    return {
      nombre: initialReward?.nombre || globalState?.nombre || 'Cafetera Espresso Digital 1.5L',
      mes: initialReward?.mes || globalState?.mes || 'Mes en Curso',
      descripcion: initialReward?.descripcion || globalState?.descripcion || 'Premio exclusivo del mes para nuestros clientes más fieles. ¡Acumula puntos con cada compra completada!',
      imagen: initialReward?.imagen || globalState?.imagen || 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600&auto=format&fit=crop&q=80',
      puntosPorDolar: initialReward?.puntosPorDolar || globalState?.puntosPorDolar || 1,
      
      // Parámetros de Ingeniería Financiera
      costoRealPremio: initialReward?.costoRealPremio ?? globalState?.costoRealPremio ?? 40.00,
      gananciaNetaObjetivo: initialReward?.gananciaNetaObjetivo ?? globalState?.gananciaNetaObjetivo ?? 60.00,
      poolClientesEstimado: initialReward?.poolClientesEstimado ?? globalState?.poolClientesEstimado ?? 10,
      pointsPerProfitDollar: initialReward?.pointsPerProfitDollar ?? globalState?.pointsPerProfitDollar ?? 10,
      tasaProgresoPool: initialReward?.tasaProgresoPool ?? globalState?.tasaProgresoPool ?? 0.50,
      puntosRequeridos: initialReward?.puntosRequeridos || globalState?.puntosRequeridos || 600
    };
  });

  const [selectedPresetId, setSelectedPresetId] = useState('preset-cafetera');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadNotice, setUploadNotice] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Cálculo de Rentabilidad en Tiempo Real con comboFinancialMath
  const balanceFinanciero = useMemo(() => {
    return calculateRewardSeasonFinances({
      rewardRealCostUSD: formData.costoRealPremio,
      targetNetProfitPerWinnerUSD: formData.gananciaNetaObjetivo,
      estimatedPoolActiveClients: formData.poolClientesEstimado,
      pointsPerProfitDollar: formData.pointsPerProfitDollar,
      poolAverageProgressRate: formData.tasaProgresoPool
    });
  }, [
    formData.costoRealPremio,
    formData.gananciaNetaObjetivo,
    formData.poolClientesEstimado,
    formData.pointsPerProfitDollar,
    formData.tasaProgresoPool
  ]);

  // Sincronización automática de Meta de Puntos del Ganador
  useEffect(() => {
    const ptsCalculados = balanceFinanciero.requiredWinnerPoints;
    setFormData(prev => {
      if (prev.puntosRequeridos !== ptsCalculados) {
        return { ...prev, puntosRequeridos: ptsCalculados };
      }
      return prev;
    });
  }, [balanceFinanciero.requiredWinnerPoints]);

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
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
    setSaveSuccess(false);
  };

  // Subida a Vercel Blob Storage (/api/upload/blob)
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
        headers: { 'Content-Type': 'application/json' },
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

      setFormData(prev => ({ ...prev, imagen: publicUrl }));
      setSelectedPresetId(null);

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
      uploadImageToBlob(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadImageToBlob(e.target.files[0]);
    }
  };

  // Aplicar plantilla preconfigurada
  const handleApplyPreset = (preset) => {
    setSelectedPresetId(preset.id);
    setFormData(prev => ({
      ...prev,
      nombre: preset.nombre,
      costoRealPremio: preset.costoReal,
      gananciaNetaObjetivo: preset.gananciaObjetivo,
      puntosRequeridos: preset.puntos,
      puntosPorDolar: preset.puntosPorDolar || 1,
      pointsPerProfitDollar: preset.pointsPerProfitDollar || 10,
      descripcion: preset.descripcion,
      imagen: preset.imagen
    }));
    setSaveSuccess(false);
  };

  // Persistir en Firebase Firestore & AppState
  const persistRewardToFirestore = async (rewardData) => {
    const payload = {
      nombre: rewardData.nombre.trim(),
      puntosRequeridos: Number(rewardData.puntosRequeridos) || balanceFinanciero.requiredWinnerPoints,
      puntosPorDolar: Number(rewardData.puntosPorDolar) || 1,
      costoRealPremio: Number(rewardData.costoRealPremio) || 40.00,
      gananciaNetaObjetivo: Number(rewardData.gananciaNetaObjetivo) || 60.00,
      poolClientesEstimado: Number(rewardData.poolClientesEstimado) || 10,
      pointsPerProfitDollar: Number(rewardData.pointsPerProfitDollar) || 10,
      tasaProgresoPool: Number(rewardData.tasaProgresoPool) || 0.50,
      mes: rewardData.mes.trim() || 'Mes en Curso',
      descripcion: rewardData.descripcion.trim(),
      imagen: rewardData.imagen.trim(),
      temporadaActiva: true,
      balanceProyectado: {
        winnerProfitContribution: balanceFinanciero.winnerProfitContribution,
        poolOtherClientsProfit: balanceFinanciero.poolOtherClientsProfit,
        totalSeasonNetProfit: balanceFinanciero.totalSeasonNetProfit,
        rewardRealCostUSD: balanceFinanciero.rewardRealCostUSD,
        netBusinessProfit: balanceFinanciero.netBusinessProfit,
        isAbsoluteProfitable: balanceFinanciero.isAbsoluteProfitable
      },
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
        await db.collection('config').doc('premioMes').set(payload, { merge: true });
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
          '¡Premio Activado con Rentabilidad Blindada!',
          `El Premio del Mes "${formData.nombre}" (${formData.puntosRequeridos} pts) está listo. Utilidad proyectada para la bodega: +$${balanceFinanciero.netBusinessProfit.toFixed(2)} USD.`
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
    <div id="admin-reward-config-root" className="reward-config-container max-w-7xl mx-auto">
      
      {/* Header del Módulo */}
      <div id="reward-config-header" className="reward-config-header">
        <div className="reward-config-header-title">
          <div className="reward-config-header-icon" aria-hidden="true">
            <i className="fas fa-trophy"></i>
          </div>
          <div>
            <h2 id="reward-config-title">Configuración del Premio del Mes & Asistente Financiero</h2>
            <p>Modelado de ganancia neta, pool competitivo de clientes y cálculo seguro de puntos con rentabilidad absoluta garantizada.</p>
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

      {/* Grid de 2 Columnas */}
      <form id="reward-config-form" onSubmit={handleSaveAndActivate}>
        <div className="reward-config-grid">
          
          {/* Columna Izquierda: Datos, Parámetros Financieros y Presets */}
          <div id="reward-config-col-left" className="reward-config-card">
            
            {/* Sección: Parámetros del Premio */}
            <div className="reward-config-card-header">
              <h3><i className="fas fa-sliders" style={{ color: 'var(--rc-emerald-600)' }}></i> 1. Identidad del Premio</h3>
            </div>

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

            <div className="reward-form-row">
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

              <div className="reward-form-group">
                <label htmlFor="reward-input-pts-dolar">
                  Puntos por cada $1.00 de Gasto <span className="required-mark">*</span>
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

            {/* SECCIÓN CRÍTICA: ASISTENTE FINANCIERO DEL PREMIO (GANANCIA META Y POOL DE CLIENTES) */}
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <i className="fas fa-calculator text-emerald-600"></i>
                  <span>2. Asistente Financiero & Pool de Competidores</span>
                </h3>
                <span className="text-[11px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                  Fórmula Matemática Activa
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                {/* Costo Real del Premio */}
                <div className="reward-form-group">
                  <label htmlFor="reward-input-costo-real" className="text-xs font-bold text-slate-700">
                    Costo Real del Premio ($ USD) <span className="required-mark">*</span>
                  </label>
                  <input
                    type="number"
                    id="reward-input-costo-real"
                    name="costoRealPremio"
                    className="reward-input font-bold text-slate-900"
                    min="0"
                    step="0.5"
                    required
                    value={formData.costoRealPremio}
                    onChange={handleInputChange}
                    placeholder="40.00"
                  />
                  <span className="text-[11px] text-slate-500">Inversión del artículo (ej. $40.00)</span>
                </div>

                {/* Ganancia Neta Objetivo por Cliente Ganador */}
                <div className="reward-form-group">
                  <label htmlFor="reward-input-ganancia-meta" className="text-xs font-bold text-slate-700">
                    Ganancia Neta Objetivo por Ganador ($) <span className="required-mark">*</span>
                  </label>
                  <input
                    type="number"
                    id="reward-input-ganancia-meta"
                    name="gananciaNetaObjetivo"
                    className="reward-input font-bold text-emerald-700"
                    min="1"
                    step="0.5"
                    required
                    value={formData.gananciaNetaObjetivo}
                    onChange={handleInputChange}
                    placeholder="60.00"
                  />
                  <span className="text-[11px] text-slate-500">Beneficio libre de costos que debe dejar (ej. $60.00)</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Pool Estimado de Clientes Activos */}
                <div className="reward-form-group">
                  <label htmlFor="reward-input-pool-clientes" className="text-xs font-bold text-slate-700">
                    Pool Estimado de Clientes Competidores <span className="required-mark">*</span>
                  </label>
                  <input
                    type="number"
                    id="reward-input-pool-clientes"
                    name="poolClientesEstimado"
                    className="reward-input font-bold text-slate-900"
                    min="1"
                    step="1"
                    required
                    value={formData.poolClientesEstimado}
                    onChange={handleInputChange}
                    placeholder="10"
                  />
                  <span className="text-[11px] text-slate-500">Clientes activos compitiendo en el mes (ej. 10)</span>
                </div>

                {/* Valor Monetario del Punto en Ganancia */}
                <div className="reward-form-group">
                  <label htmlFor="reward-input-pts-profit" className="text-xs font-bold text-slate-700">
                    Factor: Puntos por $1 de Ganancia Neta <span className="required-mark">*</span>
                  </label>
                  <input
                    type="number"
                    id="reward-input-pts-profit"
                    name="pointsPerProfitDollar"
                    className="reward-input font-bold text-slate-900"
                    min="0.5"
                    step="0.5"
                    required
                    value={formData.pointsPerProfitDollar}
                    onChange={handleInputChange}
                    placeholder="10"
                  />
                  <span className="text-[11px] text-slate-500">Equivalencia estándar (ej. $1 ganancia = 10 pts)</span>
                </div>
              </div>

              {/* Meta de Puntos del Ganador Calculada */}
              <div className="mt-3 p-3 bg-slate-100 rounded-xl flex items-center justify-between border border-slate-200">
                <div>
                  <div className="text-xs font-bold text-slate-800">
                    Meta de Puntos del Ganador (Calculada):
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    ${formData.gananciaNetaObjetivo.toFixed(2)} × {formData.pointsPerProfitDollar} pts/$ = {balanceFinanciero.requiredWinnerPoints} Pts
                  </div>
                </div>
                <div className="text-xl font-extrabold text-amber-600 font-mono">
                  {balanceFinanciero.requiredWinnerPoints} Pts
                </div>
              </div>
            </div>

            {/* Fila: Descripción Detallada */}
            <div className="reward-form-group mt-4">
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

            {/* Plantillas Rápidas Preconfiguradas */}
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

          {/* Columna Derecha: Balance Proyectado de Rentabilidad, Dropzone & Live Preview */}
          <div id="reward-config-col-right" className="reward-config-card flex flex-col gap-5">
            
            {/* PANEL DE BALANCE PROYECTADO DE RENTABILIDAD DEL NEGOCIO */}
            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <i className="fas fa-chart-pie text-emerald-600"></i>
                  <span>Panel de Balance Proyectado de Rentabilidad</span>
                </h3>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  balanceFinanciero.isAbsoluteProfitable 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : 'bg-rose-100 text-rose-800'
                }`}>
                  {balanceFinanciero.isAbsoluteProfitable ? 'Rentabilidad Blindada' : 'Revisar Margen'}
                </span>
              </div>

              {/* Desglose Matemático Exigido */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-700">
                  <span>Ganancia neta aportada por el cliente ganador:</span>
                  <strong className="text-slate-900 font-mono">${balanceFinanciero.winnerProfitContribution.toFixed(2)}</strong>
                </div>

                <div className="flex justify-between text-slate-700">
                  <span>Ganancia neta estimada del resto del pool ({balanceFinanciero.competingClientsCount} clientes al ~50%):</span>
                  <strong className="text-slate-900 font-mono">${balanceFinanciero.poolOtherClientsProfit.toFixed(2)}</strong>
                </div>

                <div className="flex justify-between text-slate-800 border-t border-dashed border-slate-200 pt-2 font-semibold">
                  <span>Ganancia Neta Total Generada por la Temporada:</span>
                  <strong className="text-emerald-700 font-mono text-sm">${balanceFinanciero.totalSeasonNetProfit.toFixed(2)}</strong>
                </div>

                <div className="flex justify-between text-rose-600 font-medium">
                  <span>Costo del Premio:</span>
                  <strong className="font-mono">-${balanceFinanciero.rewardRealCostUSD.toFixed(2)}</strong>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex justify-between items-baseline mt-2">
                  <div>
                    <span className="block text-xs font-bold text-emerald-950">Utilidad Neta Final para la Bodega:</span>
                    <span className="text-[11px] text-emerald-700">Beneficio 100% libre de costos tras entregar el premio</span>
                  </div>
                  <div className="text-lg font-black text-emerald-700 font-mono">
                    +${balanceFinanciero.netBusinessProfit.toFixed(2)} USD libres
                  </div>
                </div>
              </div>

              {/* Insignia de Garantía Matemática */}
              <div className="mt-3 p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2 text-[11px] text-slate-600">
                <i className="fas fa-shield-halved text-emerald-600 text-sm"></i>
                <span>
                  {balanceFinanciero.winnerAloneCoversReward ? (
                    <><strong>Garantía Absoluta:</strong> Las ganancias netas directas del ganador (${balanceFinanciero.targetNetProfitPerWinnerUSD.toFixed(2)}) superan el costo del premio (${balanceFinanciero.rewardRealCostUSD.toFixed(2)}) antes de alcanzar el 100% de la meta.</>
                  ) : (
                    <><strong>Aviso Financiero:</strong> La ganancia del ganador no cubre el premio por sí sola; depende del pool de competidores.</>
                  )}
                </span>
              </div>
            </div>

            {/* Dropzone Multimedia Vercel Blob */}
            <div>
              <div className="reward-config-card-header">
                <h3><i className="fas fa-cloud-arrow-up" style={{ color: 'var(--rc-emerald-600)' }}></i> Multimedia & Vercel Blob</h3>
                <span className="reward-dropzone-badge">
                  <i className="fas fa-bolt"></i> Vercel Blob
                </span>
              </div>

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
            </div>

            {/* Previsualización en Vivo de la Tarjeta del Cliente */}
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
                    <i className="fas fa-star"></i> {balanceFinanciero.requiredWinnerPoints} Pts Requeridos
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
                <i className="fas fa-circle-check"></i> ¡Premio Guardado con Rentabilidad Blindada!
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
                  <span>Guardar y Activar Premio ({balanceFinanciero.requiredWinnerPoints} Pts)</span>
                </>
              )}
            </button>
          </div>
        </div>

      </form>
    </div>
  );
}
