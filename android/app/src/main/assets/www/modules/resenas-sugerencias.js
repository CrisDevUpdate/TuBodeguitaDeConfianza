/**
 * modules/resenas-sugerencias.js
 * Módulo de Reseñas y Sugerencias de Clientes para el Programa
 * - Vista Cliente (#cliente-resenas): Calificación 1-5 estrellas, categoría, comentario, mis envíos y reseñas de clientes.
 * - Vista Admin (#admin-resenas-container y #config-resenas-sugerencias-box): Revisión, filtros, respuesta directa, sincronización Firebase y eliminación permanente.
 * - Persistencia en tiempo real en Firebase Firestore (colección: resenas_sugerencias).
 */

(function () {
    const TIPOS_OPINION = {
        resena: {
            id: 'resena',
            etiqueta: 'Reseña del programa',
            corto: 'Reseña',
            icono: 'fa-star',
            color: '#d97706',
            bg: '#fef3c7',
            border: '#fde68a',
            placeholder: 'Cuéntanos qué te gusta del programa, qué tan fácil es usarlo y cómo ha sido tu experiencia...'
        },
        sugerencia: {
            id: 'sugerencia',
            etiqueta: 'Sugerencia',
            corto: 'Sugerencia',
            icono: 'fa-lightbulb',
            color: '#0284c7',
            bg: '#e0f2fe',
            border: '#bae6fd',
            placeholder: '¿Qué producto, función o detalle te gustaría ver próximamente en Tu Bodeguita?'
        },
        mejora: {
            id: 'mejora',
            etiqueta: 'Idea de mejora',
            corto: 'Mejora',
            icono: 'fa-wand-magic-sparkles',
            color: '#7c3aed',
            bg: '#f3e8ff',
            border: '#ddd6fe',
            placeholder: '¿Hay alguna pantalla, botón o proceso que podríamos hacer más rápido o cómodo?'
        },
        problema: {
            id: 'problema',
            etiqueta: 'Reportar fallo',
            corto: 'Fallo',
            icono: 'fa-bug',
            color: '#dc2626',
            bg: '#fee2e2',
            border: '#fecaca',
            placeholder: 'Describe brevemente qué ocurrió y en qué pantalla estabas para poder corregirlo rápido...'
        }
    };

    const ETIQUETAS_ESTRELLAS = {
        1: 'Muy mala — Necesita mejoras urgentes',
        2: 'Regular — Puede mejorar bastante',
        3: 'Buena — Cumple con lo que necesito',
        4: 'Muy buena — Me gusta mucho usarla',
        5: '¡Excelente! — Me encanta el programa'
    };

    let tipoSeleccionado = 'resena';
    let calificacionSeleccionada = 5;
    let tabListaCliente = 'mis_envios'; // 'mis_envios' | 'comunidad'
    let filtroAdmin = 'todas'; // 'todas' | 'nuevas' | 'resena' | 'sugerencia' | 'mejora' | 'problema'
    let respuestaAbiertaId = null;
    let ultimaSincronizacionResenasMs = 0;

    function esc(str) {
        if (typeof window.escaparHtmlInventario === 'function') {
            return window.escaparHtmlInventario(str);
        }
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function esAdminActual() {
        const u = window.AppState?.usuarioActual;
        if (!u) return false;
        if (typeof window.esUsuarioAdmin === 'function') {
            return window.esUsuarioAdmin(u);
        }
        const rol = String(u.rol || '').trim().toLowerCase();
        return rol === 'admin' || rol === 'superadmin' || rol === 'administrador' || String(u.id || '').toUpperCase() === 'SUPERADMIN';
    }

    function obtenerListaResenas() {
        const lista = Array.isArray(window.AppState?.resenasSugerencias)
            ? window.AppState.resenasSugerencias
            : [];
        return [...lista].sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
    }

    function obtenerIdentificadoresUsuario(usuario) {
        if (!usuario) return [];
        return [usuario.id, usuario.cedula, usuario.email]
            .map(v => String(v || '').trim().toLowerCase())
            .filter(Boolean);
    }

    function perteneceAUsuario(item, usuario) {
        if (!item || !usuario) return false;
        const idsUsuario = obtenerIdentificadoresUsuario(usuario);
        const itemId = String(item.clienteId || '').trim().toLowerCase();
        const itemCed = String(item.clienteCedula || '').trim().toLowerCase();
        if (itemId && idsUsuario.includes(itemId)) return true;
        if (itemCed && idsUsuario.includes(itemCed)) return true;
        return false;
    }

    function renderizarEstrellasEstaticas(cantidad, tam = '0.88rem') {
        const n = Math.max(1, Math.min(5, Math.round(Number(cantidad || 5))));
        let html = `<span style="display:inline-flex; align-items:center; gap:2px; font-size:${tam};" aria-label="${n} de 5 estrellas">`;
        for (let i = 1; i <= 5; i++) {
            html += `<i class="fas fa-star" style="color:${i <= n ? '#f59e0b' : '#cbd5e1'};"></i>`;
        }
        html += '</span>';
        return html;
    }

    function calcularEstadisticas(lista) {
        const total = lista.length;
        const conEstrellas = lista.filter(r => Number(r.calificacion || 0) >= 1 && Number(r.calificacion || 0) <= 5);
        const promedio = conEstrellas.length > 0
            ? (conEstrellas.reduce((sum, r) => sum + Number(r.calificacion || 0), 0) / conEstrellas.length)
            : 0;
        const nuevas = lista.filter(r => String(r.estado || 'NUEVA').toUpperCase() === 'NUEVA').length;
        return { total, conEstrellas: conEstrellas.length, promedio, nuevas };
    }

    function formatearFechaCorta(fechaStr) {
        if (typeof window.formatearFechaLegible === 'function') {
            return window.formatearFechaLegible(fechaStr);
        }
        return fechaStr || 'Reciente';
    }

    function mostrarAviso(mensaje, tipo = 'info') {
        if (typeof window.showCustomToast === 'function') {
            window.showCustomToast(mensaje, tipo);
        } else if (window.InventoryApp?.Modal?.toast) {
            window.InventoryApp.Modal.toast(mensaje, tipo);
        } else {
            alert(mensaje);
        }
    }

    function guardarCacheResenasLocal() {
        try {
            localStorage.setItem('bodeguita_cache_resenas_v1', JSON.stringify(window.AppState?.resenasSugerencias || []));
        } catch (_) {}
    }

    function actualizarBadgeResenasAdmin() {
        const stats = calcularEstadisticas(obtenerListaResenas());
        const badgeDesk = document.getElementById('badge-resenas-admin-desktop');
        if (badgeDesk) {
            if (stats.nuevas > 0) {
                badgeDesk.textContent = stats.nuevas;
                badgeDesk.style.display = 'inline-flex';
            } else {
                badgeDesk.style.display = 'none';
            }
        }
    }

    async function sincronizarResenasDesdeFirebase(forzar = false) {
        const ahora = Date.now();
        if (!forzar && (ahora - ultimaSincronizacionResenasMs) < 12000) {
            return;
        }
        ultimaSincronizacionResenasMs = ahora;

        if (window.InventoryApp?.Firebase?.cargarResenasSugerencias) {
            await window.InventoryApp.Firebase.cargarResenasSugerencias();
            actualizarBadgeResenasAdmin();
            const activeView = document.querySelector('.view-content.active')?.id;
            if (activeView === 'cliente-resenas') {
                renderizarVistaResenasCliente(true);
            } else if (activeView === 'admin-resenas' || activeView === 'configuracion') {
                renderizarBuzonResenasAdmin(true);
            }
            if (forzar) {
                mostrarAviso('Reseñas sincronizadas con Firebase.', 'success');
            }
        }
    }

    // =========================================================================
    // VISTA CLIENTE: RESEÑAS Y SUGERENCIAS
    // =========================================================================

    function seleccionarTipoOpinionCliente(tipo) {
        if (!TIPOS_OPINION[tipo]) return;
        tipoSeleccionado = tipo;

        document.querySelectorAll('.resena-tipo-btn').forEach(btn => {
            const esActivo = btn.getAttribute('data-tipo') === tipo;
            const cfg = TIPOS_OPINION[btn.getAttribute('data-tipo')];
            btn.classList.toggle('active', esActivo);
            if (cfg) {
                btn.style.background = esActivo ? cfg.bg : 'var(--bg-color, #f8fafc)';
                btn.style.borderColor = esActivo ? cfg.color : 'var(--border-light, #e2e8f0)';
                btn.style.color = esActivo ? cfg.color : 'var(--text-main, #1e293b)';
                btn.style.boxShadow = esActivo ? `0 4px 12px -4px ${cfg.color}40` : 'none';
            }
        });

        const textarea = document.getElementById('resena-comentario-input');
        if (textarea) {
            textarea.placeholder = TIPOS_OPINION[tipo].placeholder;
        }
    }

    function seleccionarEstrellasCliente(valor) {
        const n = Math.max(1, Math.min(5, parseInt(valor, 10) || 5));
        calificacionSeleccionada = n;
        actualizarUIEstrellasCliente(n);
    }

    function previsualizarEstrellasCliente(valor) {
        const n = Math.max(1, Math.min(5, parseInt(valor, 10) || calificacionSeleccionada));
        actualizarUIEstrellasCliente(n);
    }

    function restaurarEstrellasCliente() {
        actualizarUIEstrellasCliente(calificacionSeleccionada);
    }

    function actualizarUIEstrellasCliente(n) {
        document.querySelectorAll('.resena-star-btn').forEach(btn => {
            const v = parseInt(btn.getAttribute('data-star'), 10);
            const icon = btn.querySelector('i');
            if (icon) {
                icon.style.color = v <= n ? '#f59e0b' : '#cbd5e1';
                icon.style.transform = v <= n ? 'scale(1.12)' : 'scale(1)';
            }
        });
        const label = document.getElementById('resena-star-label');
        if (label) {
            label.textContent = ETIQUETAS_ESTRELLAS[n] || '';
        }
    }

    function actualizarContadorComentarioCliente(el) {
        const counter = document.getElementById('resena-char-counter');
        if (!counter || !el) return;
        const len = String(el.value || '').length;
        counter.textContent = `${len} / 600`;
        counter.style.color = len > 540 ? '#dc2626' : 'var(--text-muted, #64748b)';
    }

    function cambiarTabListaResenasCliente(tab) {
        tabListaCliente = tab === 'comunidad' ? 'comunidad' : 'mis_envios';
        renderizarVistaResenasCliente(true);
    }

    async function enviarResenaSugerenciaCliente(event) {
        if (event && typeof event.preventDefault === 'function') {
            event.preventDefault();
        }

        const usuario = window.AppState?.usuarioActual;
        if (!usuario) {
            mostrarAviso('Inicia sesión para enviar tu reseña o sugerencia.', 'warning');
            return;
        }

        const inputTitulo = document.getElementById('resena-titulo-input');
        const inputComentario = document.getElementById('resena-comentario-input');
        const btnEnviar = document.getElementById('btn-enviar-resena-cliente');

        const titulo = String(inputTitulo?.value || '').trim().slice(0, 80);
        const comentario = String(inputComentario?.value || '').trim().slice(0, 600);

        if (comentario.length < 5) {
            mostrarAviso('Por favor escribe al menos 5 caracteres en tu reseña o sugerencia.', 'warning');
            if (inputComentario) inputComentario.focus();
            return;
        }

        const tipoCfg = TIPOS_OPINION[tipoSeleccionado] || TIPOS_OPINION.resena;
        const ahora = Date.now();
        const fechaLocal = typeof window.obtenerFechaHoraLocal === 'function'
            ? window.obtenerFechaHoraLocal(new Date(ahora))
            : new Date(ahora).toISOString().replace('T', ' ').substring(0, 16);

        const nuevaOpinion = {
            id: `RES_${ahora}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
            clienteId: String(usuario.id || usuario.cedula || '').trim(),
            clienteCedula: String(usuario.cedula || usuario.id || '').trim(),
            clienteNombre: String(usuario.nombre || 'Cliente').trim().slice(0, 80),
            clienteTelefono: String(usuario.telefono || '').trim().slice(0, 30),
            tipo: tipoCfg.id,
            calificacion: Math.max(1, Math.min(5, Number(calificacionSeleccionada || 5))),
            titulo: titulo,
            comentario: comentario,
            estado: 'NUEVA',
            respuestaAdmin: '',
            fechaRespuesta: '',
            fecha: fechaLocal,
            timestamp: ahora,
            sincronizadoNube: false,
            updatedAt: new Date(ahora).toISOString()
        };

        if (btnEnviar) {
            btnEnviar.disabled = true;
            btnEnviar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando en Firebase...';
        }

        try {
            if (!Array.isArray(window.AppState.resenasSugerencias)) {
                window.AppState.resenasSugerencias = [];
            }
            window.AppState.resenasSugerencias.unshift(nuevaOpinion);
            guardarCacheResenasLocal();

            if (window.InventoryApp?.Persistence?.guardar) {
                window.InventoryApp.Persistence.guardar(false);
            }

            let guardadoEnFirebase = false;
            if (window.InventoryApp?.Firebase?.guardarResenaSugerencia) {
                guardadoEnFirebase = await window.InventoryApp.Firebase.guardarResenaSugerencia(nuevaOpinion);
                nuevaOpinion.sincronizadoNube = Boolean(guardadoEnFirebase);
                guardarCacheResenasLocal();
            }

            // Notificar al Administrador en tiempo real sobre la nueva reseña o sugerencia
            if (typeof window.registrarNotificacion === 'function') {
                const estrellasTxt = '★'.repeat(nuevaOpinion.calificacion);
                window.registrarNotificacion({
                    tipo: 'comentario',
                    titulo: `Nueva ${tipoCfg.corto} de ${nuevaOpinion.clienteNombre} (${estrellasTxt})`,
                    mensaje: `${nuevaOpinion.titulo ? nuevaOpinion.titulo + ': ' : ''}${nuevaOpinion.comentario.slice(0, 140)}`,
                    clienteId: nuevaOpinion.clienteId,
                    clienteNombre: nuevaOpinion.clienteNombre,
                    referenciaId: nuevaOpinion.id,
                    paraAdmin: true,
                    destino: { tab: 'admin-resenas' },
                    prioridad: nuevaOpinion.tipo === 'problema' ? 'alta' : 'normal'
                });
            }

            // Reiniciar campos
            if (inputTitulo) inputTitulo.value = '';
            if (inputComentario) inputComentario.value = '';
            calificacionSeleccionada = 5;
            tabListaCliente = 'mis_envios';

            actualizarBadgeResenasAdmin();
            renderizarVistaResenasCliente(true);
            if (guardadoEnFirebase) {
                mostrarAviso('¡Gracias! Tu reseña se guardó en Firebase correctamente.', 'success');
            } else {
                mostrarAviso('Tu opinión se guardó localmente y se subirá a Firebase al reconectar.', 'info');
            }
        } catch (err) {
            console.warn('[Reseñas] Error al enviar opinión:', err);
            mostrarAviso('Tu opinión se guardó localmente. Se sincronizará con Firebase al reconectar.', 'info');
            renderizarVistaResenasCliente(true);
        }
    }

    function renderizarTarjetaOpinionCliente(item, mostrarNombreCompleto = false) {
        const cfg = TIPOS_OPINION[item.tipo] || TIPOS_OPINION.resena;
        const estado = String(item.estado || 'NUEVA').toUpperCase();
        const estadoBadge = estado === 'ATENDIDA'
            ? { texto: 'Respondida', bg: '#dcfce7', color: '#15803d', icon: 'fa-check-double' }
            : (estado === 'LEIDA'
                ? { texto: 'Revisada', bg: '#e0f2fe', color: '#0369a1', icon: 'fa-eye' }
                : { texto: 'Recibida', bg: '#f1f5f9', color: '#475569', icon: 'fa-clock' });

        const nombreMostrar = mostrarNombreCompleto
            ? (item.clienteNombre || 'Cliente')
            : (String(item.clienteNombre || 'Cliente').trim().split(/\s+/)[0] || 'Cliente');

        const inicial = (nombreMostrar.charAt(0) || 'C').toUpperCase();
        const puedeEliminar = esAdminActual();

        return `
            <div style="background:var(--card-bg, #ffffff); border:1px solid var(--border-light, #e2e8f0); border-radius:14px; padding:14px 16px; display:flex; flex-direction:column; gap:10px; box-shadow:0 2px 8px rgba(15,23,42,0.04);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:36px; height:36px; border-radius:10px; background:${cfg.bg}; color:${cfg.color}; border:1px solid ${cfg.border}; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.95rem; flex-shrink:0;">
                            ${esc(inicial)}
                        </div>
                        <div>
                            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                                <strong style="font-size:0.9rem; color:var(--text-main, #0f172a);">${esc(nombreMostrar)}</strong>
                                <span style="font-size:0.7rem; font-weight:700; padding:2px 8px; border-radius:6px; background:${cfg.bg}; color:${cfg.color}; border:1px solid ${cfg.border};">
                                    <i class="fas ${cfg.icono}"></i> ${esc(cfg.corto)}
                                </span>
                            </div>
                            <div style="display:flex; align-items:center; gap:8px; margin-top:2px;">
                                ${renderizarEstrellasEstaticas(item.calificacion, '0.78rem')}
                                <small style="font-size:0.72rem; color:var(--text-muted, #64748b);">${esc(formatearFechaCorta(item.fecha))}</small>
                            </div>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                        ${mostrarNombreCompleto ? `
                            <span style="font-size:0.72rem; font-weight:700; padding:3px 9px; border-radius:8px; background:${estadoBadge.bg}; color:${estadoBadge.color}; display:inline-flex; align-items:center; gap:5px;">
                                <i class="fas ${estadoBadge.icon}"></i> ${estadoBadge.texto}
                            </span>
                        ` : ''}
                        ${puedeEliminar ? `
                            <button type="button" class="btn btn-sm" onclick="eliminarResenaAdmin('${esc(item.id)}')" style="font-size:0.72rem; padding:4px 9px; background:#fef2f2; color:#dc2626; border:1px solid #fecaca; border-radius:7px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
                                <i class="fas fa-trash-can"></i> Eliminar
                            </button>
                        ` : ''}
                    </div>
                </div>

                ${item.titulo ? `<div style="font-weight:800; font-size:0.92rem; color:var(--text-main, #0f172a);">${esc(item.titulo)}</div>` : ''}

                <p style="margin:0; font-size:0.88rem; color:var(--text-main, #334155); line-height:1.5; white-space:pre-line;">${esc(item.comentario)}</p>

                ${item.respuestaAdmin ? `
                    <div style="background:linear-gradient(135deg, rgba(14,165,233,0.08), rgba(16,185,129,0.08)); border-left:3px solid #0284c7; border-radius:0 10px 10px 0; padding:10px 12px; margin-top:2px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:4px;">
                            <strong style="font-size:0.78rem; color:#0369a1; display:inline-flex; align-items:center; gap:5px;">
                                <i class="fas fa-reply"></i> Respuesta de Tu Bodeguita
                            </strong>
                            ${item.fechaRespuesta ? `<small style="font-size:0.68rem; color:#64748b;">${esc(formatearFechaCorta(item.fechaRespuesta))}</small>` : ''}
                        </div>
                        <p style="margin:0; font-size:0.84rem; color:var(--text-main, #1e293b); line-height:1.45; white-space:pre-line;">${esc(item.respuestaAdmin)}</p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    function renderizarVistaResenasCliente(omitirSync = false) {
        const container = document.getElementById('cliente-resenas-container');
        if (!container) return;

        if (!omitirSync) {
            sincronizarResenasDesdeFirebase(false);
        }

        const usuario = window.AppState?.usuarioActual;
        const todas = obtenerListaResenas();
        const stats = calcularEstadisticas(todas);
        const misEnvios = usuario ? todas.filter(r => perteneceAUsuario(r, usuario)) : [];
        const resenasComunidad = todas.filter(r => r.tipo !== 'problema');
        const cfgActual = TIPOS_OPINION[tipoSeleccionado] || TIPOS_OPINION.resena;

        const listaVisible = tabListaCliente === 'mis_envios' ? misEnvios : resenasComunidad;

        container.innerHTML = `
            <div style="max-width:920px; margin:0 auto; display:flex; flex-direction:column; gap:16px; padding-bottom:24px;">
                <!-- Encabezado cálido y resumen de calificación -->
                <div class="card" style="background:linear-gradient(135deg, #0f172a, #1e3a8a); color:#ffffff; border:none; padding:20px; border-radius:16px; box-shadow:0 8px 24px rgba(15,23,42,0.16);">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px;">
                        <div style="flex:1; min-width:240px;">
                            <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(253,224,71,0.16); color:#fde047; padding:3px 10px; border-radius:8px; font-size:0.74rem; font-weight:800; margin-bottom:8px;">
                                <i class="fas fa-heart"></i> TU OPINIÓN IMPORTA
                            </div>
                            <h2 style="margin:0; font-size:1.35rem; color:#ffffff; font-weight:800; letter-spacing:-0.01em;">
                                Reseñas y Sugerencias del Programa
                            </h2>
                            <p style="margin:6px 0 0 0; font-size:0.86rem; color:#cbd5e1; line-height:1.45;">
                                Cuéntanos cómo te va usando la app, sugiere productos o funciones nuevas, o avísanos si algo puede mejorar.
                            </p>
                        </div>

                        <div style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.18); border-radius:14px; padding:12px 18px; text-align:center; min-width:155px;">
                            ${stats.conEstrellas > 0 ? `
                                <div style="font-size:1.85rem; font-weight:900; color:#fde047; line-height:1; font-variant-numeric:tabular-nums;">
                                    ${stats.promedio.toFixed(1)} <span style="font-size:0.9rem; color:#cbd5e1; font-weight:600;">/ 5</span>
                                </div>
                                <div style="margin:5px 0 3px 0;">${renderizarEstrellasEstaticas(stats.promedio, '0.82rem')}</div>
                                <small style="font-size:0.72rem; color:#cbd5e1;">${stats.total} ${stats.total === 1 ? 'opinión registrada' : 'opiniones registradas'}</small>
                            ` : `
                                <div style="font-size:1.4rem; color:#fde047; margin-bottom:4px;"><i class="fas fa-star"></i></div>
                                <strong style="font-size:0.82rem; color:#ffffff; display:block;">¡Estrena el buzón!</strong>
                                <small style="font-size:0.72rem; color:#cbd5e1;">Sé el primero en opinar</small>
                            `}
                        </div>
                    </div>
                </div>

                <!-- Formulario interactivo de Reseña / Sugerencia -->
                <form class="card" id="form-cliente-resena" onsubmit="enviarResenaSugerenciaCliente(event)" style="padding:20px; border-radius:16px; display:flex; flex-direction:column; gap:16px;">
                    <div>
                        <label style="display:block; font-size:0.84rem; font-weight:800; color:var(--text-main, #0f172a); margin-bottom:8px;">
                            1. ¿Qué deseas compartir hoy?
                        </label>
                        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:8px;">
                            ${Object.values(TIPOS_OPINION).map(t => {
                                const activo = t.id === tipoSeleccionado;
                                return `
                                    <button type="button" class="resena-tipo-btn ${activo ? 'active' : ''}" data-tipo="${t.id}"
                                        onclick="seleccionarTipoOpinionCliente('${t.id}')"
                                        style="display:flex; align-items:center; justify-content:center; gap:7px; padding:10px 12px; border-radius:10px; font-size:0.82rem; font-weight:700; cursor:pointer; border:2px solid ${activo ? t.color : 'var(--border-light, #e2e8f0)'}; background:${activo ? t.bg : 'var(--bg-color, #f8fafc)'}; color:${activo ? t.color : 'var(--text-main, #1e293b)'}; box-shadow:${activo ? `0 4px 12px -4px ${t.color}40` : 'none'}; transition:transform 0.14s ease, border-color 0.15s ease, background-color 0.15s ease;">
                                        <i class="fas ${t.icono}"></i>
                                        <span>${esc(t.etiqueta)}</span>
                                    </button>
                                `;
                            }).join('')}
                        </div>
                    </div>

                    <div style="background:var(--bg-color, #f8fafc); border:1px solid var(--border-light, #e2e8f0); border-radius:12px; padding:14px 16px;">
                        <label style="display:block; font-size:0.84rem; font-weight:800; color:var(--text-main, #0f172a); margin-bottom:8px;">
                            2. ¿Cómo calificas el programa?
                        </label>
                        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
                            <div style="display:inline-flex; align-items:center; gap:6px;" onmouseleave="restaurarEstrellasCliente()">
                                ${[1, 2, 3, 4, 5].map(n => `
                                    <button type="button" class="resena-star-btn" data-star="${n}"
                                        onclick="seleccionarEstrellasCliente(${n})"
                                        onmouseenter="previsualizarEstrellasCliente(${n})"
                                        aria-label="${n} estrellas"
                                        style="background:transparent; border:none; padding:4px; cursor:pointer; font-size:1.75rem; line-height:1;">
                                        <i class="fas fa-star" style="color:${n <= calificacionSeleccionada ? '#f59e0b' : '#cbd5e1'}; transition:transform 0.14s ease, color 0.14s ease;"></i>
                                    </button>
                                `).join('')}
                            </div>
                            <span id="resena-star-label" style="font-size:0.84rem; font-weight:700; color:#b45309; background:#fef3c7; border:1px solid #fde68a; padding:4px 12px; border-radius:8px;">
                                ${esc(ETIQUETAS_ESTRELLAS[calificacionSeleccionada])}
                            </span>
                        </div>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:12px;">
                        <div>
                            <label for="resena-titulo-input" style="display:block; font-size:0.82rem; font-weight:700; color:var(--text-main, #0f172a); margin-bottom:5px;">
                                Título breve <span style="color:var(--text-muted); font-weight:500;">(opcional)</span>
                            </label>
                            <input type="text" id="resena-titulo-input" maxlength="80"
                                placeholder="Ej: Me encanta el escáner rápido / Sugerencia para el catálogo"
                                style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid var(--border, #cbd5e1); background:var(--card-bg, #ffffff); color:var(--text-main, #0f172a); font-size:0.9rem;">
                        </div>

                        <div>
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                                <label for="resena-comentario-input" style="font-size:0.82rem; font-weight:700; color:var(--text-main, #0f172a);">
                                    3. Escribe tu reseña o sugerencia <span style="color:#ef4444;">*</span>
                                </label>
                                <small id="resena-char-counter" style="font-size:0.74rem; color:var(--text-muted, #64748b); font-variant-numeric:tabular-nums;">0 / 600</small>
                            </div>
                            <textarea id="resena-comentario-input" rows="4" maxlength="600" required
                                oninput="actualizarContadorComentarioCliente(this)"
                                placeholder="${esc(cfgActual.placeholder)}"
                                style="width:100%; padding:11px 12px; border-radius:10px; border:1px solid var(--border, #cbd5e1); background:var(--card-bg, #ffffff); color:var(--text-main, #0f172a); font-size:0.9rem; resize:vertical; min-height:96px; font-family:inherit; line-height:1.45;"></textarea>
                        </div>
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                        <small style="font-size:0.78rem; color:var(--text-muted, #64748b); display:inline-flex; align-items:center; gap:6px;">
                            <i class="fas fa-cloud-arrow-up" style="color:#10b981;"></i>
                            Enviando como <strong>${esc(usuario?.nombre || 'Cliente')}</strong> · Guardado en Firebase en tiempo real.
                        </small>
                        <button type="submit" id="btn-enviar-resena-cliente" class="btn btn-primary" style="padding:11px 22px; font-weight:800; font-size:0.92rem; display:inline-flex; align-items:center; gap:8px; border-radius:10px;">
                            <i class="fas fa-paper-plane"></i> Enviar mi opinión
                        </button>
                    </div>
                </form>

                <!-- Listado: Mis Envíos / Reseñas de Clientes -->
                <div class="card" style="padding:18px; border-radius:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px; border-bottom:1px solid var(--border-light, #e2e8f0); padding-bottom:12px;">
                        <div style="display:flex; gap:8px; flex-wrap:wrap;">
                            <button type="button" class="chip-filter ${tabListaCliente === 'mis_envios' ? 'active' : ''}"
                                onclick="cambiarTabListaResenasCliente('mis_envios')">
                                <i class="fas fa-inbox"></i> Mis envíos (${misEnvios.length})
                            </button>
                            <button type="button" class="chip-filter ${tabListaCliente === 'comunidad' ? 'active' : ''}"
                                onclick="cambiarTabListaResenasCliente('comunidad')">
                                <i class="fas fa-comments"></i> Reseñas de clientes (${resenasComunidad.length})
                            </button>
                        </div>
                    </div>

                    ${listaVisible.length === 0 ? `
                        <div style="text-align:center; padding:30px 16px; color:var(--text-muted, #64748b);">
                            <i class="fas ${tabListaCliente === 'mis_envios' ? 'fa-comment-dots' : 'fa-star'}" style="font-size:2rem; color:#cbd5e1; margin-bottom:10px; display:block;"></i>
                            <strong style="display:block; color:var(--text-main, #334155); margin-bottom:4px;">
                                ${tabListaCliente === 'mis_envios' ? 'Aún no has enviado reseñas ni sugerencias' : 'Aún no hay reseñas publicadas'}
                            </strong>
                            <span style="font-size:0.84rem;">
                                ${tabListaCliente === 'mis_envios'
                                    ? 'Usa el formulario de arriba para contarnos qué te parece el programa o qué mejorarías.'
                                    : '¡Anímate a dejar la primera reseña de Tu Bodeguita!'}
                            </span>
                        </div>
                    ` : `
                        <div style="display:flex; flex-direction:column; gap:12px;">
                            ${listaVisible.map(item => renderizarTarjetaOpinionCliente(item, tabListaCliente === 'mis_envios')).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    // =========================================================================
    // BUZÓN ADMINISTRADOR (PESTAÑA DEDICADA + CONFIGURACIÓN)
    // =========================================================================

    function filtrarBuzonResenasAdmin(filtro) {
        filtroAdmin = filtro || 'todas';
        renderizarBuzonResenasAdmin(true);
    }

    async function marcarResenaLeidaAdmin(id) {
        if (!esAdminActual()) {
            mostrarAviso('Solo el administrador puede gestionar reseñas.', 'warning');
            return;
        }
        const lista = window.AppState?.resenasSugerencias || [];
        const item = lista.find(r => r.id === id);
        if (!item) return;

        if (String(item.estado || '').toUpperCase() === 'NUEVA') {
            item.estado = 'LEIDA';
            item.updatedAt = new Date().toISOString();
            guardarCacheResenasLocal();
            if (window.InventoryApp?.Firebase?.guardarResenaSugerencia) {
                await window.InventoryApp.Firebase.guardarResenaSugerencia(item);
            }
            actualizarBadgeResenasAdmin();
            renderizarBuzonResenasAdmin(true);
            mostrarAviso('Opinión marcada como revisada.', 'info');
        }
    }

    function toggleResponderResenaAdmin(id) {
        if (!esAdminActual()) return;
        respuestaAbiertaId = respuestaAbiertaId === id ? null : id;
        renderizarBuzonResenasAdmin(true);
        if (respuestaAbiertaId) {
            setTimeout(() => {
                const input = document.getElementById(`admin-reply-input-${id}`);
                if (input) input.focus();
            }, 40);
        }
    }

    async function guardarRespuestaResenaAdmin(id) {
        if (!esAdminActual()) {
            mostrarAviso('Solo el administrador puede responder reseñas.', 'warning');
            return;
        }
        const input = document.getElementById(`admin-reply-input-${id}`);
        const texto = String(input?.value || '').trim().slice(0, 500);
        if (texto.length < 2) {
            mostrarAviso('Escribe una respuesta breve antes de enviar.', 'warning');
            return;
        }

        const lista = window.AppState?.resenasSugerencias || [];
        const item = lista.find(r => r.id === id);
        if (!item) return;

        const fechaResp = typeof window.obtenerFechaHoraLocal === 'function'
            ? window.obtenerFechaHoraLocal(new Date())
            : new Date().toISOString().replace('T', ' ').substring(0, 16);

        item.respuestaAdmin = texto;
        item.fechaRespuesta = fechaResp;
        item.estado = 'ATENDIDA';
        item.updatedAt = new Date().toISOString();
        respuestaAbiertaId = null;

        guardarCacheResenasLocal();
        let guardadoCloud = false;
        if (window.InventoryApp?.Firebase?.guardarResenaSugerencia) {
            guardadoCloud = await window.InventoryApp.Firebase.guardarResenaSugerencia(item);
            item.sincronizadoNube = Boolean(guardadoCloud);
            guardarCacheResenasLocal();
        }

        // Enviar aviso in-app al cliente para que vea que su opinión fue respondida
        if (typeof window.registrarNotificacion === 'function' && item.clienteId) {
            window.registrarNotificacion({
                tipo: 'cliente_inapp',
                tipo_destinatario: 'CLIENTE',
                paraCliente: true,
                id_cliente: item.clienteId,
                clienteId: item.clienteId,
                clienteNombre: item.clienteNombre,
                titulo: '💬 Respuesta a tu reseña / sugerencia',
                mensaje: `Tu Bodeguita respondió tu mensaje: "${texto.slice(0, 140)}"`,
                referenciaId: item.id,
                destino: { tab: 'cliente-resenas' }
            });
        }

        actualizarBadgeResenasAdmin();
        renderizarBuzonResenasAdmin(true);
        mostrarAviso(guardadoCloud ? 'Respuesta guardada en Firebase y enviada al cliente.' : 'Respuesta guardada localmente.', 'success');
    }

    async function eliminarResenaAdmin(id) {
        if (!esAdminActual()) {
            mostrarAviso('Solo el administrador puede eliminar reseñas.', 'warning');
            return;
        }
        const lista = window.AppState?.resenasSugerencias || [];
        const item = lista.find(r => r.id === id);
        if (!item) return;

        let confirmado = true;
        if (typeof window.showCustomConfirm === 'function') {
            confirmado = await window.showCustomConfirm(
                'Eliminar reseña / sugerencia',
                `¿Seguro que deseas eliminar permanentemente la opinión enviada por <strong>${esc(item.clienteNombre || 'este cliente')}</strong>? Esta acción también la borrará de Firebase.`,
                {
                    confirmText: 'Sí, eliminar',
                    cancelText: 'Cancelar',
                    isDanger: true,
                    tipo: 'danger'
                }
            );
        }
        if (!confirmado) return;

        window.AppState.resenasSugerencias = lista.filter(r => r.id !== id);
        guardarCacheResenasLocal();
        if (window.InventoryApp?.Persistence?.guardar) {
            window.InventoryApp.Persistence.guardar(false);
        }

        let eliminadaNube = false;
        if (window.InventoryApp?.Firebase?.eliminarResenaSugerencia) {
            eliminadaNube = await window.InventoryApp.Firebase.eliminarResenaSugerencia(id);
        }

        actualizarBadgeResenasAdmin();
        renderizarBuzonResenasAdmin(true);
        renderizarVistaResenasCliente(true);

        mostrarAviso(
            eliminadaNube ? 'Reseña eliminada permanentemente de Firebase.' : 'Reseña eliminada localmente.',
            'success'
        );
    }

    function generarHtmlBuzonAdmin() {
        const todas = obtenerListaResenas();
        const stats = calcularEstadisticas(todas);

        const filtradas = todas.filter(item => {
            if (filtroAdmin === 'todas') return true;
            if (filtroAdmin === 'nuevas') return String(item.estado || 'NUEVA').toUpperCase() === 'NUEVA';
            return item.tipo === filtroAdmin;
        });

        return `
            <div class="card" style="margin-bottom:20px; border-left:4px solid #f59e0b;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; border-bottom:1px solid var(--border-light, #e2e8f0); padding-bottom:12px; margin-bottom:14px;">
                    <div>
                        <h3 style="margin:0; font-size:1.18rem; color:var(--text-main); display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                            <i class="fas fa-star" style="color:#f59e0b;"></i> Buzón de Reseñas y Sugerencias de Clientes
                            ${stats.nuevas > 0 ? `<span style="background:#ef4444; color:#ffffff; font-size:0.72rem; font-weight:800; padding:2px 8px; border-radius:999px;">${stats.nuevas} nueva${stats.nuevas === 1 ? '' : 's'}</span>` : ''}
                        </h3>
                        <p style="margin:3px 0 0 0; font-size:0.84rem; color:var(--text-muted);">
                            Almacenado en Firebase (<code>resenas_sugerencias</code>). Responde, marca como leída o elimina cualquier reseña como administrador.
                        </p>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                        <button type="button" class="btn btn-outline btn-sm" onclick="sincronizarResenasDesdeFirebase(true)" style="font-size:0.78rem; padding:6px 11px; display:inline-flex; align-items:center; gap:6px; font-weight:700;">
                            <i class="fas fa-cloud-arrow-down" style="color:#0284c7;"></i> Sincronizar Firebase
                        </button>
                        <div style="display:flex; align-items:center; gap:10px; background:var(--bg-color, #f8fafc); border:1px solid var(--border-light, #e2e8f0); padding:7px 14px; border-radius:10px;">
                            <div style="text-align:center;">
                                <strong style="font-size:1.05rem; color:#d97706; display:block; line-height:1.1; font-variant-numeric:tabular-nums;">
                                    ${stats.conEstrellas > 0 ? `★ ${stats.promedio.toFixed(1)}` : '—'}
                                </strong>
                                <small style="font-size:0.68rem; color:var(--text-muted);">Promedio</small>
                            </div>
                            <div style="width:1px; height:24px; background:var(--border-light, #e2e8f0);"></div>
                            <div style="text-align:center;">
                                <strong style="font-size:1.05rem; color:var(--text-main); display:block; line-height:1.1; font-variant-numeric:tabular-nums;">${stats.total}</strong>
                                <small style="font-size:0.68rem; color:var(--text-muted);">Total</small>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Filtros rápidos -->
                <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px;">
                    ${[
                        { id: 'todas', label: `Todas (${todas.length})` },
                        { id: 'nuevas', label: `Nuevas (${stats.nuevas})` },
                        { id: 'resena', label: '⭐ Reseñas' },
                        { id: 'sugerencia', label: '💡 Sugerencias' },
                        { id: 'mejora', label: '🚀 Mejoras' },
                        { id: 'problema', label: '🛠️ Fallos' }
                    ].map(f => `
                        <button type="button" class="chip-filter ${filtroAdmin === f.id ? 'active' : ''}"
                            onclick="filtrarBuzonResenasAdmin('${f.id}')" style="font-size:0.78rem; padding:5px 11px;">
                            ${f.label}
                        </button>
                    `).join('')}
                </div>

                ${filtradas.length === 0 ? `
                    <div style="text-align:center; padding:30px 14px; background:var(--bg-color, #f8fafc); border:1px dashed var(--border, #cbd5e1); border-radius:12px; color:var(--text-muted);">
                        <i class="fas fa-inbox" style="font-size:1.8rem; color:#cbd5e1; margin-bottom:8px; display:block;"></i>
                        <strong style="display:block; color:var(--text-main); font-size:0.92rem;">Sin mensajes en esta categoría</strong>
                        <span style="font-size:0.82rem;">Cuando tus clientes envíen reseñas o sugerencias desde su pestaña «Reseñas & Sugerencias», aparecerán aquí en tiempo real.</span>
                    </div>
                ` : `
                    <div style="display:flex; flex-direction:column; gap:12px;">
                        ${filtradas.map(item => {
                            const cfg = TIPOS_OPINION[item.tipo] || TIPOS_OPINION.resena;
                            const est = String(item.estado || 'NUEVA').toUpperCase();
                            const esNueva = est === 'NUEVA';
                            const replyOpen = respuestaAbiertaId === item.id;
                            const enFirebase = item.sincronizadoNube !== false;
                            return `
                                <div style="background:var(--card-bg, #ffffff); border:1px solid ${esNueva ? '#fcd34d' : 'var(--border-light, #e2e8f0)'}; border-radius:12px; padding:14px; box-shadow:${esNueva ? '0 3px 10px rgba(245,158,11,0.12)' : 'none'};">
                                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap; margin-bottom:8px;">
                                        <div>
                                            <div style="display:flex; align-items:center; gap:7px; flex-wrap:wrap;">
                                                <strong style="font-size:0.94rem; color:var(--text-main);">${esc(item.clienteNombre || 'Cliente')}</strong>
                                                <span style="font-size:0.7rem; font-weight:700; padding:2px 8px; border-radius:6px; background:${cfg.bg}; color:${cfg.color}; border:1px solid ${cfg.border};">
                                                    <i class="fas ${cfg.icono}"></i> ${esc(cfg.corto)}
                                                </span>
                                                ${esNueva ? `<span style="font-size:0.68rem; font-weight:800; padding:2px 7px; border-radius:6px; background:#fef2f2; color:#dc2626; border:1px solid #fecaca;">NUEVA</span>` : ''}
                                                ${est === 'ATENDIDA' ? `<span style="font-size:0.68rem; font-weight:800; padding:2px 7px; border-radius:6px; background:#dcfce7; color:#15803d;">RESPONDIDA</span>` : ''}
                                                <span style="font-size:0.67rem; font-weight:700; padding:2px 7px; border-radius:6px; background:${enFirebase ? '#f0fdf4' : '#fffbeb'}; color:${enFirebase ? '#15803d' : '#b45309'}; border:1px solid ${enFirebase ? '#bbf7d0' : '#fde68a'};">
                                                    <i class="fas ${enFirebase ? 'fa-cloud-check' : 'fa-cloud-arrow-up'}"></i> ${enFirebase ? 'Firebase' : 'Pendiente'}
                                                </span>
                                            </div>
                                            <div style="display:flex; align-items:center; gap:8px; margin-top:3px;">
                                                ${renderizarEstrellasEstaticas(item.calificacion, '0.8rem')}
                                                <small style="font-size:0.74rem; color:var(--text-muted);">${esc(formatearFechaCorta(item.fecha))}${item.clienteTelefono ? ` • ${esc(item.clienteTelefono)}` : ''}</small>
                                            </div>
                                        </div>
                                        <div style="display:flex; gap:6px; flex-wrap:wrap;">
                                            ${esNueva ? `
                                                <button type="button" class="btn btn-outline btn-sm" onclick="marcarResenaLeidaAdmin('${esc(item.id)}')" style="font-size:0.76rem; padding:5px 10px;">
                                                    <i class="fas fa-check"></i> Leída
                                                </button>
                                            ` : ''}
                                            <button type="button" class="btn btn-primary btn-sm" onclick="toggleResponderResenaAdmin('${esc(item.id)}')" style="font-size:0.76rem; padding:5px 10px;">
                                                <i class="fas fa-reply"></i> ${item.respuestaAdmin ? 'Editar respuesta' : 'Responder'}
                                            </button>
                                            <button type="button" class="btn btn-sm" onclick="eliminarResenaAdmin('${esc(item.id)}')" style="font-size:0.76rem; padding:5px 10px; background:#fef2f2; color:#dc2626; border:1px solid #fecaca; border-radius:8px; font-weight:700; display:inline-flex; align-items:center; gap:5px; cursor:pointer;" title="Eliminar reseña permanentemente de Firebase">
                                                <i class="fas fa-trash-can"></i> Eliminar
                                            </button>
                                        </div>
                                    </div>

                                    ${item.titulo ? `<div style="font-weight:800; font-size:0.9rem; color:var(--text-main); margin-bottom:4px;">${esc(item.titulo)}</div>` : ''}
                                    <p style="margin:0; font-size:0.86rem; color:var(--text-main); line-height:1.45; white-space:pre-line;">${esc(item.comentario)}</p>

                                    ${item.respuestaAdmin && !replyOpen ? `
                                        <div style="margin-top:10px; background:rgba(2,132,199,0.06); border-left:3px solid #0284c7; padding:8px 10px; border-radius:0 8px 8px 0;">
                                            <small style="font-weight:800; color:#0369a1; display:block; margin-bottom:2px;">Tu respuesta (${esc(formatearFechaCorta(item.fechaRespuesta))}):</small>
                                            <span style="font-size:0.83rem; color:var(--text-main); white-space:pre-line;">${esc(item.respuestaAdmin)}</span>
                                        </div>
                                    ` : ''}

                                    ${replyOpen ? `
                                        <div style="margin-top:10px; background:var(--bg-color, #f8fafc); border:1px solid var(--border-light, #e2e8f0); border-radius:10px; padding:10px; display:flex; flex-direction:column; gap:8px;">
                                            <textarea id="admin-reply-input-${esc(item.id)}" rows="2" maxlength="500"
                                                placeholder="Escribe tu respuesta para ${esc(item.clienteNombre || 'el cliente')}..."
                                                style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--border, #cbd5e1); font-size:0.85rem; font-family:inherit; resize:vertical;">${esc(item.respuestaAdmin || '')}</textarea>
                                            <div style="display:flex; justify-content:flex-end; gap:8px;">
                                                <button type="button" class="btn btn-outline btn-sm" onclick="toggleResponderResenaAdmin('${esc(item.id)}')">Cancelar</button>
                                                <button type="button" class="btn btn-success btn-sm" onclick="guardarRespuestaResenaAdmin('${esc(item.id)}')">
                                                    <i class="fas fa-paper-plane"></i> Enviar respuesta
                                                </button>
                                            </div>
                                        </div>
                                    ` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                `}
            </div>
        `;
    }

    function renderizarBuzonResenasAdmin(omitirSync = false) {
        if (!omitirSync) {
            sincronizarResenasDesdeFirebase(false);
        }

        actualizarBadgeResenasAdmin();
        const html = generarHtmlBuzonAdmin();

        const adminTabContainer = document.getElementById('admin-resenas-container');
        if (adminTabContainer) {
            adminTabContainer.innerHTML = `<div style="max-width:980px; margin:0 auto;">${html}</div>`;
        }

        const configBox = document.getElementById('config-resenas-sugerencias-box');
        if (configBox) {
            configBox.innerHTML = html;
        }
    }

    // Exportar funciones globales
    window.renderizarVistaResenasCliente = renderizarVistaResenasCliente;
    window.seleccionarTipoOpinionCliente = seleccionarTipoOpinionCliente;
    window.seleccionarEstrellasCliente = seleccionarEstrellasCliente;
    window.previsualizarEstrellasCliente = previsualizarEstrellasCliente;
    window.restaurarEstrellasCliente = restaurarEstrellasCliente;
    window.actualizarContadorComentarioCliente = actualizarContadorComentarioCliente;
    window.cambiarTabListaResenasCliente = cambiarTabListaResenasCliente;
    window.enviarResenaSugerenciaCliente = enviarResenaSugerenciaCliente;

    window.renderizarBuzonResenasAdmin = renderizarBuzonResenasAdmin;
    window.filtrarBuzonResenasAdmin = filtrarBuzonResenasAdmin;
    window.marcarResenaLeidaAdmin = marcarResenaLeidaAdmin;
    window.toggleResponderResenaAdmin = toggleResponderResenaAdmin;
    window.guardarRespuestaResenaAdmin = guardarRespuestaResenaAdmin;
    window.eliminarResenaAdmin = eliminarResenaAdmin;
    window.sincronizarResenasDesdeFirebase = sincronizarResenasDesdeFirebase;
    window.actualizarBadgeResenasAdmin = actualizarBadgeResenasAdmin;

    window.InventoryApp = window.InventoryApp || {};
    window.InventoryApp.Resenas = {
        renderCliente: renderizarVistaResenasCliente,
        renderAdmin: renderizarBuzonResenasAdmin,
        syncFirebase: sincronizarResenasDesdeFirebase,
        updateBadge: actualizarBadgeResenasAdmin
    };
})();
