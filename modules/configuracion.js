/**
 * modules/configuracion.js
 * MÓDULO DE CONFIGURACIÓN DEL SISTEMA (ADMIN & SUPERADMIN)
 * 
 * Incluye:
 * - MÓDULO 2: Reinicio General de Fábrica (Hard-Reset) exclusivo para SuperAdmin con validación de clave ('1810') y palabra ('CONFIRMAR').
 * - MÓDULO 3: Motor de Temas y Paletas de Marca Global del Sistema (Admin).
 * - MÓDULO 5: Interruptor de Temporada de Invierno y Generador de Notificaciones de Marketing por WhatsApp (04125363849).
 * - Herramientas de Respaldo JSON / Excel y Sincronización de Base de Datos en la Nube.
 */

window.InventoryApp = window.InventoryApp || {};

/**
 * Renderiza la Vista Completa de Configuración
 */
function renderizarConfiguracionAdmin() {
    const container = document.getElementById('configuracion');
    if (!container) return;

    const usuario = AppState.usuarioActual;
    const esSuperAdmin = usuario && (usuario.rol === 'admin' || usuario.id === 'SuperAdmin' || usuario.cedula === 'SuperAdmin');
    const inviernoActivo = !!AppState.temporadaInviernoActiva;

    container.innerHTML = `
        <div class="card" style="margin-bottom:20px; border-left: 4px solid var(--primary-accent);">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                <div>
                    <h2 style="margin:0; font-size:1.4rem; color:var(--text-main); display:flex; align-items:center; gap:10px;">
                        <i class="fas fa-gear" style="color:var(--primary-accent);"></i> Configuración del Sistema
                    </h2>
                    <p style="margin:4px 0 0 0; color:var(--text-muted); font-size:0.88rem;">
                        Control central de apariencia, marketing, reglas de temporada y mantenimiento del sistema.
                    </p>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="badge" style="background:#e0f2fe; color:#0369a1; font-weight:700; padding:6px 12px; border-radius:20px;">
                        <i class="fas fa-shield-halved"></i> ${usuario?.nombre || 'Administrador'} (${(usuario?.rol || 'ADMIN').toUpperCase()})
                    </span>
                </div>
            </div>
        </div>

        <!-- MÓDULO: Cuentas Bancarias & Métodos de Pago Móvil (Admin) -->
        <div id="config-cuentas-bancarias-box"></div>

        <!-- MÓDULO 3: Motor de Temas y Paletas Globales -->
        <div id="config-theme-manager-box"></div>

        <!-- MÓDULO 5: Temporada de Invierno & Notificaciones de Marketing WhatsApp -->
        <div class="card" style="margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid var(--border-light); padding-bottom:10px; flex-wrap:wrap; gap:10px;">
                <div>
                    <h3 style="margin:0; font-size:1.15rem; color:var(--text-main); display:flex; align-items:center; gap:8px;">
                        <i class="fas fa-snowflake" style="color:#38bdf8;"></i> Módulo de Gamificación & Temporada de Invierno
                    </h3>
                    <p style="margin:2px 0 0 0; font-size:0.84rem; color:var(--text-muted);">
                        Control de ciclo estacional de puntos y recompensas de fidelización.
                    </p>
                </div>
                <div>
                    <span class="badge ${inviernoActivo ? 'badge-info' : 'badge-active'}" style="font-size:0.82rem; padding:5px 12px;">
                        <i class="fas ${inviernoActivo ? 'fa-snowflake' : 'fa-sun'}"></i> ${inviernoActivo ? 'Temporada de Invierno ACTIVA' : 'Temporada Regular (Puntos Activos)'}
                    </span>
                </div>
            </div>

            <div style="background:${inviernoActivo ? '#f0f9ff' : '#f8fafc'}; border:1px solid ${inviernoActivo ? '#bae6fd' : 'var(--border-light)'}; border-radius:10px; padding:16px; margin-bottom:18px;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                    <div style="flex:1; min-width:280px;">
                        <strong style="color:${inviernoActivo ? '#0369a1' : 'var(--text-main)'}; font-size:0.95rem; display:flex; align-items:center; gap:6px;">
                            <i class="fas fa-toggle-on" style="font-size:1.1rem; color:${inviernoActivo ? '#0284c7' : 'var(--text-muted)'};"></i> Interruptor: Activar Modo Temporada de Invierno
                        </strong>
                        <p style="margin:4px 0 0 0; font-size:0.83rem; color:var(--text-muted); line-height:1.4;">
                            Al activar el invierno, <b>se ocultan los puntos en el catálogo</b>, <b>se congela la acumulación de nuevos puntos</b> y el árbol muestra el diseño invernal con bufanda y chistes/mensajes humorísticos sobre el frío cuando los clientes consultan sus premios.
                        </p>
                    </div>
                    <div>
                        <button type="button" class="btn ${inviernoActivo ? 'btn-danger' : 'btn-primary'}" onclick="toggleTemporadaInviernoConfig()" style="font-weight:700; padding:10px 18px;">
                            <i class="fas ${inviernoActivo ? 'fa-sun' : 'fa-snowflake'}"></i> ${inviernoActivo ? 'Desactivar Invierno (Volver a Regular)' : 'Activar Temporada de Invierno ❄️'}
                        </button>
                    </div>
                </div>
            </div>

            <!-- Notificaciones de Marketing por WhatsApp -->
            <div style="border-top:1px solid var(--border-light); padding-top:16px;">
                <h4 style="margin:0 0 10px 0; font-size:1rem; color:var(--text-main); display:flex; align-items:center; gap:8px;">
                    <i class="fab fa-whatsapp" style="color:#22c55e;"></i> Generador de Marketing y Difusión WhatsApp (Oficial: 0412-5363849)
                </h4>
                <p style="margin:0 0 14px 0; font-size:0.82rem; color:var(--text-muted);">
                    Envía avisos de nuevos premios y confirmaciones de ganadores con textos persuasivos listos para WhatsApp.
                </p>

                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:14px;">
                    <!-- Plantilla 1: Anuncio de Premios -->
                    <div style="background:#ffffff; border:1px solid var(--border); border-radius:10px; padding:14px; display:flex; flex-direction:column; justify-content:space-between;">
                        <div>
                            <span class="badge" style="background:#dcfce7; color:#15803d; font-weight:700; margin-bottom:6px; display:inline-block;">📢 Plantilla: Lanzamiento de Premios</span>
                            <h5 style="margin:4px 0 8px 0; font-size:0.92rem; color:var(--text-main);">Flyer & Emoción de Premios</h5>
                            <textarea id="wa-text-anuncio-premio" class="form-control" rows="5" style="font-size:0.82rem; font-family:monospace; line-height:1.4; resize:none;">🎉 ¡GRAN NOTICIA EN TU BODEGUITA DE CONFIANZA! 🏆🎁

✨ ¡Llegaron los Nuevos Premios de este Mes!
Acumula puntos con cada compra o abono puntual y haz florecer tu Árbol de Recompensas 🌳✨

👉 Consulta tu saldo de puntos y catálogo aquí:
📱 WhatsApp de Atención: 0412-5363849
🏪 TuBodeguitaDeConfianza — Josnairit Salazar</textarea>
                        </div>
                        <div style="display:flex; gap:8px; margin-top:10px;">
                            <button type="button" class="btn btn-sm btn-outline" onclick="copiarTextoConfig('wa-text-anuncio-premio')" style="flex:1;">
                                <i class="fas fa-copy"></i> Copiar
                            </button>
                            <button type="button" class="btn btn-sm btn-success" onclick="abrirWhatsAppMarketing('wa-text-anuncio-premio')" style="flex:2;">
                                <i class="fab fa-whatsapp"></i> Enviar al 04125363849
                            </button>
                        </div>
                    </div>

                    <!-- Plantilla 2: Confirmación de Ganador -->
                    <div style="background:#ffffff; border:1px solid var(--border); border-radius:10px; padding:14px; display:flex; flex-direction:column; justify-content:space-between;">
                        <div>
                            <span class="badge" style="background:#fef3c7; color:#b45309; font-weight:700; margin-bottom:6px; display:inline-block;">🏆 Plantilla: Confirmación de Ganador</span>
                            <h5 style="margin:4px 0 8px 0; font-size:0.92rem; color:var(--text-main);">Felicitaciones por Canje de Premio</h5>
                            <textarea id="wa-text-confirmacion-ganador" class="form-control" rows="5" style="font-size:0.82rem; font-family:monospace; line-height:1.4; resize:none;">🌟 ¡FELICITACIONES, ERES NUESTRO GANADOR! 🌳🎉

Tu Árbol de Fidelización ha alcanzado el 100% de florecimiento dorado 🌻✨
Tu canje del Premio del Mes ha sido confirmado con éxito. Puedes retirarlo en nuestra tienda presentando tu comprobante.

¡Gracias por ser parte de la familia de Tu Bodeguita de Confianza! 💚
📲 Contacto Oficial: 0412-5363849</textarea>
                        </div>
                        <div style="display:flex; gap:8px; margin-top:10px;">
                            <button type="button" class="btn btn-sm btn-outline" onclick="copiarTextoConfig('wa-text-confirmacion-ganador')" style="flex:1;">
                                <i class="fas fa-copy"></i> Copiar
                            </button>
                            <button type="button" class="btn btn-sm btn-success" onclick="abrirWhatsAppMarketing('wa-text-confirmacion-ganador')" style="flex:2;">
                                <i class="fab fa-whatsapp"></i> Enviar al 04125363849
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- MÓDULO 2: REINICIO GENERAL DE FÁBRICA (HARD-RESET EXCLUSIVO SUPERADMIN) -->
        ${esSuperAdmin ? `
            <div class="card" style="margin-bottom:20px; border: 2px solid #ef4444; background:#fef2f2;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:14px;">
                    <div style="flex:1; min-width:280px;">
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                            <span style="background:#dc2626; color:#ffffff; padding:4px 8px; border-radius:6px; font-size:0.75rem; font-weight:800; text-transform:uppercase;">
                                <i class="fas fa-triangle-exclamation"></i> Zona Crítica / SuperAdmin
                            </span>
                        </div>
                        <h3 style="margin:4px 0 6px 0; font-size:1.2rem; color:#991b1b; display:flex; align-items:center; gap:8px;">
                            <i class="fas fa-bomb"></i> Reinicio General de Fábrica (Hard-Reset)
                        </h3>
                        <p style="margin:0; font-size:0.86rem; color:#7f1d1d; line-height:1.45;">
                            Esta operación trunca y restaura el sistema a su estado original virgen de fábrica.
                            <b>Archiva el historial anterior con marca de tiempo</b> y restablece a cero:
                        </p>
                        <ul style="margin:8px 0 0 16px; padding:0; font-size:0.82rem; color:#991b1b; line-height:1.4;">
                            <li>Historial de ventas (diarias y acumuladas) y deudas pendientes.</li>
                            <li>Registros de auditoría, conteos físicos y mermas.</li>
                            <li>Usuarios y clientes secundarios registrados (preservando intacto a SuperAdmin).</li>
                            <li>Stock de inventario y catálogo de premios.</li>
                            <li>Puntos de fidelización y progreso del árbol (reinicio a 0%).</li>
                        </ul>
                    </div>
                    <div style="align-self:center;">
                        <button type="button" class="btn btn-danger" onclick="abrirModalHardResetSuperAdmin()" style="font-weight:800; padding:12px 22px; font-size:0.95rem; box-shadow: 0 4px 12px rgba(220,38,38,0.35);">
                            <i class="fas fa-trash-can-arrow-up"></i> Reinicio General de Fábrica
                        </button>
                    </div>
                </div>
            </div>
        ` : ''}

        <!-- MÓDULO DE SINCRONIZACIÓN Y BASE DE DATOS FIREBASE CLOUD -->
        <div class="card" style="margin-bottom:20px; border-left: 4px solid var(--primary-accent);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px; margin-bottom:12px;">
                <div>
                    <h3 style="margin:0; font-size:1.15rem; color:var(--text-main); display:flex; align-items:center; gap:8px;">
                        <i class="fas fa-cloud-bolt" style="color:var(--primary-accent);"></i> Base de Datos & Sincronización Firebase (Multi-dispositivo)
                    </h3>
                    <p style="margin:4px 0 0 0; font-size:0.84rem; color:var(--text-muted);">
                        Sincronización en tiempo real entre tu teléfono y tu PC mediante Cloud Firestore.
                    </p>
                </div>
                <div>
                    <span style="font-size:0.8rem; color:var(--text-muted); font-weight:600;">Proyecto:</span>
                    <code style="background:var(--bg-secondary); padding:4px 8px; border-radius:6px; font-weight:700; color:var(--primary-accent); border:1px solid var(--border-light);">tubodeguitadeconfianza</code>
                </div>
            </div>

            <div style="background:var(--bg-secondary); border:1px solid var(--border-light); border-radius:8px; padding:12px; margin-bottom:14px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
                <div style="font-size:0.85rem; color:var(--text-main);">
                    <i class="fas fa-circle-check" style="color:#16a34a; margin-right:4px;"></i> 
                    <strong>Sincronización Multi-dispositivo:</strong> Ambos dispositivos (teléfono y PC) se actualizan instantáneamente.
                </div>
                <div style="display:flex; gap:8px;">
                    <button type="button" class="btn btn-sm btn-outline" onclick="restablecerConfiguracionFirebaseUI()" title="Restablecer al proyecto tubodeguitadeconfianza">
                        <i class="fas fa-arrow-rotate-left"></i> Restablecer Proyecto Oficial
                    </button>
                    <button type="button" class="btn btn-sm btn-primary" onclick="abrirModalCloudSync()">
                        <i class="fas fa-sliders"></i> Abrir Panel de Sincronización
                    </button>
                </div>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px;">
                <button type="button" class="btn btn-success" onclick="ejecutarSincronizacionNube()" style="padding:10px; display:flex; align-items:center; justify-content:center; gap:8px; font-weight:700;">
                    <i class="fas fa-rotate"></i> Forzar Sincronización (Descargar)
                </button>
                <button type="button" class="btn btn-outline" onclick="ejecutarSubidaCompletaNube()" style="padding:10px; display:flex; align-items:center; justify-content:center; gap:8px; font-weight:600;">
                    <i class="fas fa-cloud-arrow-up"></i> Subir Todo a Firestore
                </button>
                <button type="button" class="btn btn-outline" onclick="probarConexionFirebaseModal(); abrirModalCloudSync();" style="padding:10px; display:flex; align-items:center; justify-content:center; gap:8px; font-weight:600;">
                    <i class="fas fa-bolt"></i> Probar Conexión (Ping)
                </button>
            </div>
        </div>

        <!-- Gestión de Fotos en la Nube Vercel Blob -->
        <div class="card" style="margin-bottom:20px; border-left: 4px solid #0284c7;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
                <div>
                    <h3 style="margin:0 0 6px 0; font-size:1.1rem; color:var(--text-main); display:flex; align-items:center; gap:8px;">
                        <i class="fas fa-cloud" style="color:#0284c7;"></i> Almacén de Fotos en la Nube (Vercel Blob)
                    </h3>
                    <p style="margin:0; font-size:0.84rem; color:var(--text-muted);">
                        Tus fotos de productos se almacenan de forma segura y permanente en Vercel Blob (Store ID: <code>store_5tUK9cDxqnqjrZw4</code>).
                    </p>
                </div>
                <div style="display:flex; align-items:center; gap:6px;">
                    <span class="badge" style="background:#dcfce7; color:#15803d; font-weight:700; padding:4px 10px; border-radius:12px; font-size:0.75rem;">
                        <i class="fas fa-circle-check"></i> Vercel Blob Activo
                    </span>
                </div>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:10px; margin-bottom:12px;">
                <button type="button" class="btn btn-primary" onclick="abrirModalVisorBlob()" style="padding:10px; display:flex; align-items:center; justify-content:center; gap:8px; font-weight:700;">
                    <i class="fas fa-images"></i> Ver Fotos en Vercel Blob
                </button>
                <button type="button" class="btn btn-outline" onclick="sincronizarFotosVercelBlob()" id="btn-sync-blob-photos" style="padding:10px; display:flex; align-items:center; justify-content:center; gap:8px; font-weight:600;">
                    <i class="fas fa-arrows-rotate"></i> Sincronizar Fotos a Blob
                </button>
            </div>

            <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:8px; padding:12px; font-size:0.82rem; color:var(--text-muted);">
                <div style="font-weight:700; color:var(--text-main); margin-bottom:4px;">
                    <i class="fas fa-compass" style="color:#0284c7;"></i> ¿Cómo ver tus fotos en la consola de Vercel?
                </div>
                <ol style="margin:0; padding-left:18px; line-height:1.5;">
                    <li>Inicia sesión en <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" style="color:#0284c7; font-weight:600; text-decoration:underline;">vercel.com</a>.</li>
                    <li>Ve a la pestaña superior <strong>"Storage"</strong>.</li>
                    <li>Haz clic en tu almacén Blob (<strong>store_5tUK9cDxqnqjrZw4</strong>).</li>
                    <li>Entra en la pestaña <strong>"Blobs"</strong> o <strong>"Browser"</strong>: allí verás la carpeta <code>productos/</code> con todas tus fotos subidas.</li>
                </ol>
            </div>
        </div>

        <!-- Gestión de Respaldos y Base de Datos -->
        <div class="card" style="margin-bottom:20px;">
            <h3 style="margin:0 0 12px 0; font-size:1.1rem; color:var(--text-main); display:flex; align-items:center; gap:8px;">
                <i class="fas fa-database" style="color:var(--primary-accent);"></i> Respaldos y Exportación de Datos
            </h3>
            <p style="margin:0 0 14px 0; font-size:0.84rem; color:var(--text-muted);">
                Descarga copias de seguridad de toda la base de datos o exporta tus archivos maestros en cualquier momento.
            </p>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
                <button type="button" class="btn btn-outline" onclick="descargarRespaldoLocal()" style="padding:10px; display:flex; align-items:center; justify-content:center; gap:8px; font-weight:600;">
                    <i class="fas fa-file-arrow-down" style="color:#2563eb;"></i> Exportar Respaldo JSON
                </button>
                <button type="button" class="btn btn-outline" onclick="descargarMasterExcel()" style="padding:10px; display:flex; align-items:center; justify-content:center; gap:8px; font-weight:600;">
                    <i class="fas fa-file-excel" style="color:#16a34a;"></i> Descargar Máster Excel (.xlsx)
                </button>
            </div>
        </div>
    `;

    // Renderizar Gestor de Cuentas Bancarias y Métodos de Pago
    if (typeof renderizarGestionCuentasBancariasAdmin === 'function') {
        renderizarGestionCuentasBancariasAdmin();
    }

    // Renderizar Selector de Temas del Administrador
    if (window.InventoryApp && window.InventoryApp.Theme && typeof window.InventoryApp.Theme.renderizarGestorAdmin === 'function') {
        window.InventoryApp.Theme.renderizarGestorAdmin('config-theme-manager-box');
    }
}

/**
 * Alterna el estado de la Temporada de Invierno y sincroniza con Firestore /config/gamification
 */
async function toggleTemporadaInviernoConfig() {
    const nuevoEstado = !Boolean(AppState.temporadaInviernoActiva || AppState.isWinterMode);
    AppState.temporadaInviernoActiva = nuevoEstado;
    AppState.isWinterMode = nuevoEstado;
    if (AppState.premioMes) {
        AppState.premioMes.temporadaActiva = !nuevoEstado;
    }

    // Regla de Visibilidad Inmediata: Inyectar estilo para catálogo y carrito
    let styleTag = document.getElementById('winter-mode-global-style');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'winter-mode-global-style';
        document.head.appendChild(styleTag);
    }
    if (nuevoEstado) {
        styleTag.textContent = `
            .cliente-prod-points-badge,
            .combo-points-badge,
            #cliente-carrito-puntos-row,
            .puntos-premio-row,
            [data-points-badge] {
                display: none !important;
            }
        `;
    } else {
        styleTag.textContent = '';
    }

    // Ocultar/mostrar inmediatamente en el DOM del carrito
    const carritoPuntosRow = document.getElementById('cliente-carrito-puntos-row');
    if (carritoPuntosRow) {
        carritoPuntosRow.style.display = nuevoEstado ? 'none' : 'flex';
    }
    const carritoPuntosPreview = document.getElementById('cliente-carrito-puntos-preview');
    if (carritoPuntosPreview && nuevoEstado) {
        carritoPuntosPreview.textContent = '+0 Pts';
    }

    // Persistir directamente a Firestore: /config/gamification
    try {
        if (window.firebase && typeof window.firebase.firestore === 'function') {
            const db = window.firebase.firestore();
            await db.collection('config').doc('gamification').set({
                isWinterMode: nuevoEstado,
                updatedAt: new Date().toISOString(),
                updatedBy: 'Admin'
            }, { merge: true });

            await db.collection('configuracion').doc('gamificacion').set({
                isWinterMode: nuevoEstado,
                temporadaInviernoActiva: nuevoEstado,
                updatedAt: new Date().toISOString()
            }, { merge: true }).catch(() => {});
        }
    } catch (fsErr) {
        console.warn('[configuracion.js] Advertencia escribiendo /config/gamification en Firestore:', fsErr.message);
    }

    // Persistir estado localmente
    if (window.InventoryApp?.Persistence?.guardar) {
        window.InventoryApp.Persistence.guardar(true);
    }

    // Refrescar vistas
    renderizarConfiguracionAdmin();
    if (typeof renderizarConfiguradorPremioAdmin === 'function') renderizarConfiguradorPremioAdmin();
    if (typeof renderizarCatalogoCliente === 'function') renderizarCatalogoCliente();
    if (typeof renderizarPremioMesCliente === 'function') renderizarPremioMesCliente();
    if (typeof renderizarCarritoCliente === 'function') renderizarCarritoCliente();

    const activo = nuevoEstado;
    if (window.InventoryApp.Modal?.toast) {
        window.InventoryApp.Modal.toast(
            activo ? '❄️ Temporada de Invierno activada con éxito. Puntos en pausa y ocultos en catálogo/carrito.' : '☀️ Temporada regular restaurada. Acumulación y puntos activos.',
            activo ? 'info' : 'success'
        );
    }
}

/**
 * Copia texto de marketing al portapapeles
 */
function copiarTextoConfig(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;

    el.select();
    navigator.clipboard.writeText(el.value).then(() => {
        if (window.InventoryApp.Modal?.toast) {
            window.InventoryApp.Modal.toast('Texto copiado al portapapeles con éxito', 'success');
        }
    }).catch(() => {
        document.execCommand('copy');
        if (window.InventoryApp.Modal?.toast) {
            window.InventoryApp.Modal.toast('Texto copiado al portapapeles', 'success');
        }
    });
}

/**
 * Abre WhatsApp con el texto y número oficial
 */
function abrirWhatsAppMarketing(elementId) {
    const el = document.getElementById(elementId);
    const texto = el ? el.value : '';
    const telefonoOficial = '584125363849';
    const url = `https://wa.me/${telefonoOficial}?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
}

/**
 * Abre el Modal de Seguridad para el Hard-Reset de SuperAdmin
 */
function abrirModalHardResetSuperAdmin() {
    let modal = document.getElementById('modal-hard-reset-superadmin');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-hard-reset-superadmin';
        modal.className = 'modal';
        modal.onclick = function(e) { if (e.target === this) cerrarModalHardResetSuperAdmin(); };
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 520px; padding: 26px; border: 2px solid #ef4444; animation: modalPop 0.25s ease-out;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid #fee2e2; padding-bottom:10px;">
                <h3 style="margin:0; font-size:1.2rem; color:#b91c1c; display:flex; align-items:center; gap:8px;">
                    <i class="fas fa-triangle-exclamation" style="color:#dc2626;"></i> Confirmación de Hard-Reset
                </h3>
                <button type="button" class="btn-icon-tasa" onclick="cerrarModalHardResetSuperAdmin()"><i class="fas fa-times"></i></button>
            </div>

            <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:12px; margin-bottom:16px; font-size:0.85rem; color:#991b1b; line-height:1.45;">
                <strong>⚠️ ATENCIÓN: ACCIÓN DESTRUCTIVA IRREVERSIBLE</strong><br>
                Se archivará una copia con timestamp en la nube y se restablecerán a <b>CERO (0)</b> todas las ventas, deudas, auditorías, clientes secundarios, productos e inventario. El usuario <b>SuperAdmin</b> permanecerá intacto.
            </div>

            <form id="form-hard-reset-superadmin" onsubmit="event.preventDefault(); procesarEjecucionHardReset();">
                <div class="form-group" style="margin-bottom:12px;">
                    <label style="font-size:0.85rem; font-weight:700; color:#1e293b;">Contraseña de SuperAdmin <span style="color:var(--danger);">*</span></label>
                    <input type="password" id="reset-superadmin-password" class="form-control" placeholder="Ingresa tu clave de SuperAdmin (1810)" required autocomplete="current-password">
                </div>

                <div class="form-group" style="margin-bottom:16px;">
                    <label style="font-size:0.85rem; font-weight:700; color:#1e293b;">
                        Palabra de Seguridad: Escribe <span style="color:#dc2626; font-weight:800;">CONFIRMAR</span> para proceder <span style="color:var(--danger);">*</span>
                    </label>
                    <input type="text" id="reset-superadmin-keyword" class="form-control" placeholder="CONFIRMAR" required style="font-weight:700; letter-spacing:1px;">
                </div>

                <div id="reset-loading-spinner" style="display:none; text-align:center; padding:10px; color:#dc2626; font-weight:700;">
                    <i class="fas fa-spinner fa-spin"></i> Ejecutando Reinicio de Fábrica y Archivando...
                </div>

                <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid var(--border-light); padding-top:14px;">
                    <button type="button" class="btn btn-outline" onclick="cerrarModalHardResetSuperAdmin()">Cancelar</button>
                    <button type="submit" id="btn-submit-hard-reset" class="btn btn-danger" style="font-weight:800; padding:10px 20px;">
                        <i class="fas fa-bomb"></i> Ejecutar Reinicio Definitivo
                    </button>
                </div>
            </form>
        </div>
    `;

    modal.classList.add('active');
}

/**
 * Cierra el modal de Hard-Reset
 */
function cerrarModalHardResetSuperAdmin() {
    const modal = document.getElementById('modal-hard-reset-superadmin');
    if (modal) modal.classList.remove('active');
}

/**
 * Ejecuta el Hard-Reset atómico en cliente, servidor y nube
 */
async function procesarEjecucionHardReset() {
    const password = document.getElementById('reset-superadmin-password')?.value;
    const keyword = document.getElementById('reset-superadmin-keyword')?.value?.trim()?.toUpperCase();
    const spinner = document.getElementById('reset-loading-spinner');
    const submitBtn = document.getElementById('btn-submit-hard-reset');

    if (keyword !== 'CONFIRMAR' && keyword !== 'RESET-DEFINITIVO') {
        if (window.InventoryApp.Modal?.alert) {
            window.InventoryApp.Modal.alert('Palabra Incorrecta', 'Debes escribir la palabra "CONFIRMAR" exactamente en mayúsculas.', 'warning');
        }
        return;
    }

    const HASH_SUPERADMIN_DEFAULT = '1a09807a0e6928a66d91025ed5fccd713c9edb101e72a1bbcb8a01cd9a53cb51';
    const inputHash = typeof calcularHashSha256 === 'function' ? calcularHashSha256(password) : '';
    const esClaveValida = password === '1810' || inputHash === HASH_SUPERADMIN_DEFAULT || password === AppState.usuarioActual?.password;

    if (!esClaveValida) {
        if (window.InventoryApp.Modal?.alert) {
            window.InventoryApp.Modal.alert('Acceso Denegado', 'La contraseña de SuperAdmin es incorrecta.', 'danger');
        }
        return;
    }

    if (spinner) spinner.style.display = 'block';
    if (submitBtn) submitBtn.disabled = true;

    try {
        // 1. Invocar endpoint API server-side
        const previousSnapshot = {
            ventas: AppState.ventas || [],
            productos: AppState.productos || [],
            clientes: AppState.clientes || [],
            abonos: AppState.abonos || [],
            auditorias: AppState.auditorias || []
        };

        try {
            await fetch('/api/admin/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    adminPassword: password,
                    confirmationKeyword: 'CONFIRMAR',
                    previousData: previousSnapshot
                })
            });
        } catch (apiErr) {
            console.warn('[HardReset] Advertencia al contactar /api/admin/reset:', apiErr);
        }

        // 2. Limpiar Base de Datos en Persistence (Firestore + LocalStorage)
        if (window.InventoryApp.Persistence && typeof window.InventoryApp.Persistence.limpiarBaseDeDatosVirgen === 'function') {
            await window.InventoryApp.Persistence.limpiarBaseDeDatosVirgen();
        } else {
            // Limpieza manual de respaldo
            AppState.productos = [];
            AppState.clientes = [];
            AppState.ventas = [];
            AppState.abonos = [];
            AppState.transacciones = [];
            AppState.auditorias = [];
            AppState.eliminaciones = [];
            AppState.clientesEliminados = [];
            AppState.conteosFisicos = {};
            AppState.carrito = [];
            AppState.canjesPremios = [];
            AppState.nextProductSequence = 1;
            AppState.treeProgress = { porcentaje: 0, puntosActuales: 0, puntosMeta: 200, ciclo: 1 };
            AppState.temporadaInviernoActiva = false;

            const superAdminUser = {
                id: 'SuperAdmin',
                cedula: 'SuperAdmin',
                nombre: 'SuperAdmin',
                telefono: '0412-0000000',
                email: 'superadmin@tubodeguita.com',
                password: HASH_SUPERADMIN_DEFAULT,
                rol: 'admin',
                estado: 'ACTIVO',
                puntosAcumulados: 0,
                puntosCanjeados: 0,
                fechaRegistro: new Date().toISOString().replace('T', ' ').substring(0, 16)
            };
            AppState.usuarios = [superAdminUser];
            AppState.usuarioActual = null;

            if (window.InventoryApp.Persistence?.guardar) {
                window.InventoryApp.Persistence.guardar(true);
            }
        }

        cerrarModalHardResetSuperAdmin();

        // 3. Notificación de éxito Zero-Alert
        if (window.InventoryApp.Modal?.alert) {
            await window.InventoryApp.Modal.alert(
                'Reinicio de Fábrica Completado',
                '✅ El sistema ha sido restablecido a su estado virgen con éxito.<br>Todas las tablas, ventas y deudas están en cero (0) y el SuperAdmin está activo.',
                'success'
            );
        }

        // 4. Refrescar todas las pantallas
        if (typeof renderizarPosProductos === 'function') renderizarPosProductos();
        if (typeof renderizarInventario === 'function') renderizarInventario();
        if (typeof renderizarClientes === 'function') renderizarClientes();
        if (typeof renderizarTransacciones === 'function') renderizarTransacciones();
        if (typeof renderizarAuditoria === 'function') renderizarAuditoria();
        if (typeof renderizarUsuarios === 'function') renderizarUsuarios();
        if (typeof renderizarHistorialVentasAdmin === 'function') renderizarHistorialVentasAdmin();
        if (typeof renderizarConfiguradorPremioAdmin === 'function') renderizarConfiguradorPremioAdmin();
        if (typeof renderizarConfiguracionAdmin === 'function') renderizarConfiguracionAdmin();
        if (typeof switchTab === 'function') switchTab('pos');

    } catch (err) {
        console.error('Error durante el Hard Reset:', err);
        if (window.InventoryApp.Modal?.alert) {
            window.InventoryApp.Modal.alert('Error en Reinicio', 'Ocurrió un inconveniente durante el reinicio: ' + (err.message || err), 'danger');
        }
    } finally {
        if (spinner) spinner.style.display = 'none';
        if (submitBtn) submitBtn.disabled = false;
    }
}

// Exportar funciones globales
window.descargarRespaldoLocal = function() {
    if (window.InventoryApp.Persistence?.exportarRespaldoJSON) {
        window.InventoryApp.Persistence.exportarRespaldoJSON();
    }
};

window.descargarMasterExcel = function() {
    if (window.InventoryApp.Persistence?.exportarMasterExcel) {
        window.InventoryApp.Persistence.exportarMasterExcel();
    }
};

window.abrirModalVisorBlob = async function() {
    let modal = document.getElementById('modal-visor-blob');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-visor-blob';
        modal.className = 'modal-overlay';
        modal.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:9999; align-items:center; justify-content:center; padding:16px; backdrop-filter:blur(3px);';
        modal.innerHTML = `
            <div class="card" style="width:100%; max-width:700px; max-height:85vh; display:flex; flex-direction:column; padding:0; overflow:hidden; box-shadow:0 20px 25px -5px rgba(0,0,0,0.3); border-radius:12px;">
                <div style="padding:16px 20px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; background:var(--bg-card);">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <i class="fas fa-cloud" style="color:#0284c7; font-size:1.25rem;"></i>
                        <h3 style="margin:0; font-size:1.15rem; color:var(--text-main);">Fotos en Vercel Blob</h3>
                    </div>
                    <button type="button" class="btn btn-sm btn-outline" onclick="cerrarModalVisorBlob()" style="border-radius:50%; width:32px; height:32px; padding:0; display:flex; align-items:center; justify-content:center;">
                        <i class="fas fa-xmark"></i>
                    </button>
                </div>
                <div id="visor-blob-content" style="padding:20px; overflow-y:auto; flex:1; min-height:220px;">
                    <div style="text-align:center; padding:30px; color:var(--text-muted);">
                        <i class="fas fa-spinner fa-spin" style="font-size:1.5rem; color:#0284c7; margin-bottom:10px;"></i>
                        <div>Consultando imágenes en tu almacén de Vercel Blob...</div>
                    </div>
                </div>
                <div style="padding:12px 20px; border-top:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; background:var(--bg-card); font-size:0.8rem; color:var(--text-muted);">
                    <span>Store ID: <code>store_5tUK9cDxqnqjrZw4</code></span>
                    <button type="button" class="btn btn-sm btn-primary" onclick="cerrarModalVisorBlob()">Cerrar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    modal.style.display = 'flex';
    const content = document.getElementById('visor-blob-content');
    content.innerHTML = `
        <div style="text-align:center; padding:30px; color:var(--text-muted);">
            <i class="fas fa-spinner fa-spin" style="font-size:1.5rem; color:#0284c7; margin-bottom:10px;"></i>
            <div>Consultando imágenes en tu almacén de Vercel Blob...</div>
        </div>
    `;

    try {
        const res = await fetch('/api/blob/list');
        const data = await res.json();

        if (!data.success) {
            content.innerHTML = `
                <div style="text-align:center; padding:20px; color:#ef4444;">
                    <i class="fas fa-circle-exclamation" style="font-size:2rem; margin-bottom:10px;"></i>
                    <div style="font-weight:700;">No fue posible obtener el listado de fotos</div>
                    <div style="font-size:0.85rem; margin-top:6px;">${data.error || 'Error desconocido'}</div>
                </div>
            `;
            return;
        }

        const blobs = (data.blobs || []).filter(b => b.size > 0 && !b.pathname.endsWith('/'));
        if (blobs.length === 0) {
            content.innerHTML = `
                <div style="text-align:center; padding:30px; color:var(--text-muted);">
                    <i class="fas fa-image" style="font-size:2.5rem; color:var(--border-color); margin-bottom:10px;"></i>
                    <div style="font-weight:700; color:var(--text-main);">Aún no hay fotos en tu almacén Blob</div>
                    <div style="font-size:0.85rem; margin-top:6px;">Al registrar o editar un producto y adjuntar una imagen, se subirá aquí automáticamente.</div>
                </div>
            `;
            return;
        }

        let html = `
            <div style="margin-bottom:14px; font-size:0.85rem; color:var(--text-muted); display:flex; justify-content:space-between; align-items:center;">
                <span>Total de fotos guardadas: <strong>${blobs.length}</strong></span>
                <span class="badge" style="background:#dcfce7; color:#15803d; font-weight:600; padding:3px 8px; border-radius:10px;">En la Nube</span>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:12px;">
        `;

        blobs.forEach(b => {
            const kb = (b.size / 1024).toFixed(1);
            const dateStr = b.uploadedAt ? new Date(b.uploadedAt).toLocaleDateString() : '';
            const nombre = b.pathname.split('/').pop();
            html += `
                <div style="border:1px solid var(--border-color); border-radius:8px; overflow:hidden; background:var(--bg-main); display:flex; flex-direction:column;">
                    <div style="height:120px; background:#000; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                        <img src="${b.viewUrl || b.url}" alt="${nombre}" style="max-height:100%; max-width:100%; object-fit:contain;" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'40\\' height=\\'40\\'><text y=\\'25\\' font-size=\\'20\\'>🖼️</text></svg>'">
                    </div>
                    <div style="padding:10px; font-size:0.75rem; display:flex; flex-direction:column; gap:4px; flex:1;">
                        <span style="font-weight:700; color:var(--text-main); word-break:break-all;" title="${b.pathname}">${nombre}</span>
                        <div style="color:var(--text-muted); display:flex; justify-content:space-between;">
                            <span>${kb} KB</span>
                            <span>${dateStr}</span>
                        </div>
                        <a href="${b.viewUrl || b.url}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline" style="margin-top:6px; text-align:center; padding:4px 6px; font-size:0.72rem; text-decoration:none; display:block;">
                            <i class="fas fa-up-right-from-square"></i> Ver imagen
                        </a>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        content.innerHTML = html;

    } catch (err) {
        content.innerHTML = `
            <div style="text-align:center; padding:20px; color:#ef4444;">
                <i class="fas fa-triangle-exclamation" style="font-size:2rem; margin-bottom:10px;"></i>
                <div style="font-weight:700;">Error de conexión con Vercel Blob</div>
                <div style="font-size:0.85rem; margin-top:6px;">${err.message || err}</div>
            </div>
        `;
    }
};

window.cerrarModalVisorBlob = function() {
    const modal = document.getElementById('modal-visor-blob');
    if (modal) modal.style.display = 'none';
};

window.sincronizarFotosVercelBlob = async function() {
    const btn = document.getElementById('btn-sync-blob-photos');
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando fotos...';
    }

    try {
        const res = await fetch('/api/blob/sync-firestore-images', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            const migradas = (data.processed || []).filter(p => p.status === 'migrated_to_blob').length;
            if (window.InventoryApp?.Modal?.toast) {
                window.InventoryApp.Modal.toast(`Sincronización completada con éxito. ${migradas} foto(s) migradas a Vercel Blob.`, 'success');
            } else {
                alert(`Sincronización completada. ${migradas} fotos migradas a Vercel Blob.`);
            }
            // Forzar descarga de Firestore para refrescar la app
            if (typeof ejecutarSincronizacionNube === 'function') {
                ejecutarSincronizacionNube();
            }
        } else {
            throw new Error(data.error || 'Error en sincronización');
        }
    } catch (err) {
        if (window.InventoryApp?.Modal?.toast) {
            window.InventoryApp.Modal.toast(`Error al sincronizar fotos: ${err.message}`, 'danger');
        } else {
            alert(`Error al sincronizar fotos: ${err.message}`);
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
};

window.renderizarConfiguracionAdmin = renderizarConfiguracionAdmin;
window.toggleTemporadaInviernoConfig = toggleTemporadaInviernoConfig;
window.copiarTextoConfig = copiarTextoConfig;
window.abrirWhatsAppMarketing = abrirWhatsAppMarketing;
window.abrirModalHardResetSuperAdmin = abrirModalHardResetSuperAdmin;
window.cerrarModalHardResetSuperAdmin = cerrarModalHardResetSuperAdmin;
window.procesarEjecucionHardReset = procesarEjecucionHardReset;

/**
 * =========================================================================
 * MÓDULO DE GESTIÓN DINÁMICA DE CUENTAS BANCARIAS & MÉTODOS DE PAGO MÓVIL
 * =========================================================================
 */

/**
 * Renderiza el gestor de Cuentas Bancarias en la vista de Configuración
 */
function renderizarGestionCuentasBancariasAdmin() {
    const box = document.getElementById('config-cuentas-bancarias-box');
    if (!box) return;

    if (!Array.isArray(AppState.cuentasBancarias) || AppState.cuentasBancarias.length === 0) {
        AppState.cuentasBancarias = [
            {
                id: 'bancamiga_pm',
                banco: 'Bancamiga (0172)',
                bank: 'Bancamiga (0172)',
                tipo: 'Pago Móvil / Transferencia',
                type: 'Pago Móvil',
                telefono: '0412-1234567',
                phone: '0412-1234567',
                cedulaRif: 'V-30.544.641',
                idNumber: 'V-30.544.641',
                titular: 'Josnairit Salazar / Tu Bodeguita',
                cuenta: '01720111223344556677',
                account: '01720111223344556677',
                correo: '',
                activo: true,
                instrucciones: 'Reportar comprobante con los últimos 6 u 8 dígitos de referencia'
            },
            {
                id: 'bdv_pm',
                banco: 'Banco de Venezuela (0102)',
                bank: 'Banco de Venezuela (0102)',
                tipo: 'Pago Móvil',
                type: 'Pago Móvil',
                telefono: '0412-5363849',
                phone: '0412-5363849',
                cedulaRif: 'V-28.123.456',
                idNumber: 'V-28.123.456',
                titular: 'Tu Bodeguita de Confianza',
                cuenta: '01020000000000000000',
                account: '01020000000000000000',
                correo: '',
                activo: true,
                instrucciones: ''
            },
            {
                id: 'banesco_pm',
                banco: 'Banesco (0134)',
                bank: 'Banesco (0134)',
                tipo: 'Pago Móvil',
                type: 'Pago Móvil',
                telefono: '0412-5363849',
                phone: '0412-5363849',
                cedulaRif: 'V-28.123.456',
                idNumber: 'V-28.123.456',
                titular: 'Tu Bodeguita de Confianza',
                cuenta: '',
                account: '',
                correo: '',
                activo: true,
                instrucciones: ''
            },
            {
                id: 'mercantil_pm',
                banco: 'Mercantil (0105)',
                bank: 'Mercantil (0105)',
                tipo: 'Pago Móvil',
                type: 'Pago Móvil',
                telefono: '0412-5363849',
                phone: '0412-5363849',
                cedulaRif: 'V-28.123.456',
                idNumber: 'V-28.123.456',
                titular: 'Tu Bodeguita de Confianza',
                cuenta: '',
                account: '',
                correo: '',
                activo: true,
                instrucciones: ''
            }
        ];
    }

    const cuentas = AppState.cuentasBancarias;
    const activasCount = cuentas.filter(c => c.activo !== false).length;

    let cuentasHtml = '';
    if (cuentas.length === 0) {
        cuentasHtml = `
            <div id="sin-cuentas-msg" style="text-align:center; padding:30px 20px; background:var(--bg-main); border-radius:10px; border:1px dashed var(--border-color);">
                <i class="fas fa-building-columns" style="font-size:2.4rem; color:var(--text-muted); margin-bottom:10px;"></i>
                <p style="margin:0; font-weight:600; color:var(--text-main);">No hay cuentas bancarias configuradas</p>
                <small style="color:var(--text-muted);">Haz clic en "+ Agregar Banco / Cuenta" para configurar una cuenta de pago móvil o transferencia.</small>
            </div>
        `;
    } else {
        cuentasHtml = `
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(310px, 1fr)); gap:14px;">
                ${cuentas.map(c => {
                    const esActivo = c.activo !== false;
                    const bancoNombre = c.banco || c.bank || 'Banco Sin Nombre';
                    const tipoNombre = c.tipo || c.type || 'Pago Móvil';
                    const tlf = c.telefono || c.phone || 'No configurado';
                    const rif = c.cedulaRif || c.idNumber || 'No configurado';
                    const numCuenta = c.cuenta || c.account || '';
                    const tit = c.titular || 'Tu Bodeguita';
                    const notas = c.instrucciones || c.correo || '';

                    const esPagoMovil = tipoNombre.toLowerCase().includes('móvil') || tipoNombre.toLowerCase().includes('movil');
                    const badgeBg = esPagoMovil ? '#e0f2fe' : (tipoNombre.toLowerCase().includes('divisas') ? '#dcfce7' : '#fef3c7');
                    const badgeColor = esPagoMovil ? '#0369a1' : (tipoNombre.toLowerCase().includes('divisas') ? '#15803d' : '#b45309');

                    return `
                        <div class="card" id="cuenta-card-${c.id}" style="padding:14px; margin:0; border: 1.5px solid ${esActivo ? 'var(--border-light)' : '#cbd5e1'}; background:${esActivo ? 'var(--bg-card)' : '#f8fafc'}; opacity:${esActivo ? '1' : '0.78'}; position:relative; display:flex; flex-direction:column; justify-content:space-between; border-radius:10px;">
                            <div>
                                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; gap:8px;">
                                    <div>
                                        <h4 style="margin:0; font-size:0.98rem; font-weight:800; color:var(--text-main); display:flex; align-items:center; gap:6px;">
                                            <i class="fas fa-building-columns" style="color:var(--primary-accent);"></i> ${bancoNombre}
                                        </h4>
                                        <div style="display:flex; align-items:center; gap:6px; margin-top:4px; flex-wrap:wrap;">
                                            <span style="font-size:0.72rem; font-weight:700; padding:2px 8px; border-radius:9999px; background:${badgeBg}; color:${badgeColor};">
                                                ${tipoNombre}
                                            </span>
                                            <span style="font-size:0.7rem; font-weight:700; padding:2px 8px; border-radius:9999px; background:${esActivo ? '#dcfce7' : '#f1f5f9'}; color:${esActivo ? '#166534' : '#64748b'};">
                                                <i class="fas ${esActivo ? 'fa-circle-check' : 'fa-circle-pause'}"></i> ${esActivo ? 'Activa (Visible)' : 'Pausada (Oculta)'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div style="font-size:0.82rem; display:flex; flex-direction:column; gap:5px; margin-bottom:12px; background:var(--bg-main); padding:10px; border-radius:8px;">
                                    <div style="display:flex; justify-content:space-between; align-items:center;">
                                        <span style="color:var(--text-muted); font-size:0.78rem;">Teléfono Pago Móvil:</span>
                                        <strong style="color:var(--text-main);">${tlf}</strong>
                                    </div>
                                    <div style="display:flex; justify-content:space-between; align-items:center;">
                                        <span style="color:var(--text-muted); font-size:0.78rem;">C.I / RIF:</span>
                                        <strong style="color:var(--text-main);">${rif}</strong>
                                    </div>
                                    ${numCuenta ? `
                                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:6px;">
                                        <span style="color:var(--text-muted); font-size:0.78rem; white-space:nowrap;">Nº Cuenta:</span>
                                        <strong style="color:var(--text-main); font-size:0.76rem; word-break:break-all; text-align:right;">${numCuenta}</strong>
                                    </div>` : ''}
                                    <div style="display:flex; justify-content:space-between; align-items:center;">
                                        <span style="color:var(--text-muted); font-size:0.78rem;">Titular:</span>
                                        <strong style="color:var(--text-main); font-size:0.78rem;">${tit}</strong>
                                    </div>
                                    ${notas ? `
                                    <div style="margin-top:4px; padding-top:4px; border-top:1px dashed var(--border-color); font-size:0.74rem; color:var(--text-muted);">
                                        <i class="fas fa-info-circle"></i> ${notas}
                                    </div>` : ''}
                                </div>
                            </div>

                            <div style="display:flex; gap:6px; flex-wrap:wrap; border-top:1px solid var(--border-light); padding-top:10px; margin-top:4px;">
                                <button type="button" id="btn-editar-cuenta-${c.id}" class="btn btn-sm btn-primary" onclick="abrirModalEditarCuentaBancaria('${c.id}')" style="flex:1; padding:5px 8px; font-size:0.78rem; font-weight:700; display:flex; align-items:center; justify-content:center; gap:5px;">
                                    <i class="fas fa-pen-to-square"></i> Editar
                                </button>
                                <button type="button" id="btn-toggle-cuenta-${c.id}" class="btn btn-sm ${esActivo ? 'btn-outline' : 'btn-success'}" onclick="toggleActivarCuentaBancaria('${c.id}')" style="padding:5px 8px; font-size:0.78rem; font-weight:600;" title="${esActivo ? 'Ocultar a clientes' : 'Mostrar a clientes'}">
                                    <i class="fas ${esActivo ? 'fa-eye-slash' : 'fa-eye'}"></i> ${esActivo ? 'Pausar' : 'Activar'}
                                </button>
                                <button type="button" id="btn-copiar-cuenta-${c.id}" class="btn btn-sm btn-outline" onclick="copiarCoordenadasCuenta('${c.id}', this)" style="padding:5px 8px; font-size:0.78rem;" title="Copiar datos al portapapeles">
                                    <i class="fas fa-copy"></i>
                                </button>
                                <button type="button" id="btn-eliminar-cuenta-${c.id}" class="btn btn-sm btn-danger" onclick="eliminarCuentaBancaria('${c.id}')" style="padding:5px 8px; font-size:0.78rem;" title="Eliminar cuenta">
                                    <i class="fas fa-trash-can"></i>
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    box.innerHTML = `
        <div class="card" id="card-config-cuentas-bancarias" style="margin-bottom:20px; border-left:4px solid #2563eb;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; border-bottom:1px solid var(--border-light); padding-bottom:12px; flex-wrap:wrap; gap:12px;">
                <div>
                    <h3 style="margin:0; font-size:1.15rem; color:var(--text-main); display:flex; align-items:center; gap:8px;">
                        <i class="fas fa-building-columns" style="color:#2563eb;"></i> Cuentas Bancarias & Métodos de Pago Móvil
                    </h3>
                    <p style="margin:3px 0 0 0; font-size:0.84rem; color:var(--text-muted); max-width:650px; line-height:1.4;">
                        Configura las cuentas de banco, pagos móvil, números de cuenta y datos que verán los clientes. <b>Cualquier cambio se asocia y actualiza automáticamente en toda la app</b> (reporte de abonos de clientes, checkout del carrito y WhatsApp).
                    </p>
                </div>
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <span class="badge" style="background:#eff6ff; color:#1d4ed8; font-weight:700; padding:6px 12px; border-radius:20px; font-size:0.8rem;">
                        ${activasCount} de ${cuentas.length} Activas
                    </span>
                    <button type="button" id="btn-admin-agregar-cuenta" class="btn btn-primary" onclick="abrirModalEditarCuentaBancaria()" style="font-weight:700; font-size:0.85rem; padding:8px 14px; display:flex; align-items:center; gap:6px;">
                        <i class="fas fa-plus-circle"></i> + Agregar Banco / Cuenta
                    </button>
                </div>
            </div>

            ${cuentasHtml}
        </div>
    `;
}

/**
 * Abre el modal para agregar o editar una cuenta bancaria con diseño limpio y moderno
 */
function abrirModalEditarCuentaBancaria(id = null) {
    let modal = document.getElementById('modal-admin-cuenta-bancaria');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-admin-cuenta-bancaria';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    const cuenta = id ? (AppState.cuentasBancarias || []).find(c => c.id === id) : null;
    const esEdicion = !!cuenta;

    const bancoVal = cuenta ? (cuenta.banco || cuenta.bank || '') : '';
    const tipoVal = cuenta ? (cuenta.tipo || cuenta.type || 'Pago Móvil / Transferencia') : 'Pago Móvil / Transferencia';
    const tlfVal = cuenta ? (cuenta.telefono || cuenta.phone || '') : '';
    const cedulaVal = cuenta ? (cuenta.cedulaRif || cuenta.idNumber || '') : '';
    const cuentaVal = cuenta ? (cuenta.cuenta || cuenta.account || '') : '';
    const titularVal = cuenta ? (cuenta.titular || '') : 'Josnairit Salazar / Tu Bodeguita';
    const instrucVal = cuenta ? (cuenta.instrucciones || '') : '';

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px; padding: 22px 24px; animation: modalPop 0.22s ease-out; border-radius:14px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; border-bottom:1px solid var(--border-light); padding-bottom:12px;">
                <div>
                    <h3 style="margin:0; font-size:1.1rem; color:var(--text-main); display:flex; align-items:center; gap:8px; font-weight:800;">
                        <i class="fas fa-building-columns" style="color:var(--primary-accent);"></i> ${esEdicion ? 'Editar Cuenta Bancaria' : 'Nueva Cuenta Bancaria'}
                    </h3>
                    <p style="margin:4px 0 0 0; font-size:0.78rem; color:var(--text-muted);">
                        Configura los datos de cobro que verán tus clientes al pagar.
                    </p>
                </div>
                <button type="button" class="btn-icon-tasa" onclick="cerrarModalEditarCuentaBancaria()" style="cursor:pointer;"><i class="fas fa-times"></i></button>
            </div>

            <form id="form-admin-cuenta-bancaria" onsubmit="event.preventDefault(); guardarCuentaBancariaAdmin();">
                <input type="hidden" id="cuenta-bancaria-id" value="${cuenta ? cuenta.id : ''}">

                <div class="form-group" style="margin-bottom:12px;">
                    <label style="font-size:0.82rem; font-weight:700; color:var(--text-main); display:block; margin-bottom:5px;">
                        Entidad Bancaria <span style="color:var(--danger);">*</span>
                    </label>
                    <input type="text" id="cuenta-bancaria-banco" class="form-control" value="${bancoVal}" placeholder="Ej: Bancamiga (0172), Banco de Venezuela (0102)..." required style="font-weight:700; font-size:0.9rem;">
                    
                    <!-- Chips de selección rápida sin selector redundante -->
                    <div style="display:flex; flex-wrap:wrap; gap:5px; margin-top:6px;">
                        <span style="font-size:0.72rem; color:var(--text-muted); align-self:center; font-weight:600;">Sugerencias:</span>
                        <button type="button" onclick="asignarBancoSugeridoModal('Bancamiga (0172)', 'Pago Móvil / Transferencia')" style="padding:2px 8px; font-size:0.72rem; border-radius:12px; border:1px solid #cbd5e1; background:#f8fafc; cursor:pointer; color:#334155; font-weight:600;">Bancamiga</button>
                        <button type="button" onclick="asignarBancoSugeridoModal('Banco de Venezuela (0102)', 'Pago Móvil / Transferencia')" style="padding:2px 8px; font-size:0.72rem; border-radius:12px; border:1px solid #cbd5e1; background:#f8fafc; cursor:pointer; color:#334155; font-weight:600;">Venezuela</button>
                        <button type="button" onclick="asignarBancoSugeridoModal('Banesco (0134)', 'Pago Móvil / Transferencia')" style="padding:2px 8px; font-size:0.72rem; border-radius:12px; border:1px solid #cbd5e1; background:#f8fafc; cursor:pointer; color:#334155; font-weight:600;">Banesco</button>
                        <button type="button" onclick="asignarBancoSugeridoModal('Mercantil (0105)', 'Pago Móvil / Transferencia')" style="padding:2px 8px; font-size:0.72rem; border-radius:12px; border:1px solid #cbd5e1; background:#f8fafc; cursor:pointer; color:#334155; font-weight:600;">Mercantil</button>
                        <button type="button" onclick="asignarBancoSugeridoModal('BBVA Provincial (0108)', 'Pago Móvil / Transferencia')" style="padding:2px 8px; font-size:0.72rem; border-radius:12px; border:1px solid #cbd5e1; background:#f8fafc; cursor:pointer; color:#334155; font-weight:600;">Provincial</button>
                        <button type="button" onclick="asignarBancoSugeridoModal('BNC (0191)', 'Pago Móvil / Transferencia')" style="padding:2px 8px; font-size:0.72rem; border-radius:12px; border:1px solid #cbd5e1; background:#f8fafc; cursor:pointer; color:#334155; font-weight:600;">BNC</button>
                    </div>
                </div>

                <div class="form-group" style="margin-bottom:12px;">
                    <label style="font-size:0.82rem; font-weight:700; color:var(--text-main); display:block; margin-bottom:5px;">
                        Tipo de Operación / Método <span style="color:var(--danger);">*</span>
                    </label>
                    <select id="cuenta-bancaria-tipo" class="form-control" required style="font-weight:600; font-size:0.88rem;">
                        <option value="Pago Móvil / Transferencia" ${tipoVal === 'Pago Móvil / Transferencia' ? 'selected' : ''}>📱 Pago Móvil y Transferencia Bancaria</option>
                        <option value="Pago Móvil" ${tipoVal === 'Pago Móvil' ? 'selected' : ''}>📱 Solo Pago Móvil</option>
                        <option value="Transferencia Bancaria" ${tipoVal === 'Transferencia Bancaria' || tipoVal === 'Transferencia' ? 'selected' : ''}>🏦 Solo Transferencia Bancaria (VES)</option>
                        <option value="Divisas USD (Digital / Zelle / Zinli)" ${tipoVal.includes('Divisas') || tipoVal.includes('USD') ? 'selected' : ''}>💵 Cuenta en Divisas ($ USD / Digital)</option>
                    </select>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:12px;">
                    <div class="form-group" style="margin:0;">
                        <label style="font-size:0.82rem; font-weight:700; color:var(--text-main); display:block; margin-bottom:5px;">
                            Teléfono Pago Móvil:
                        </label>
                        <input type="text" id="cuenta-bancaria-telefono" class="form-control" value="${tlfVal}" placeholder="Ej: 0412-1234567" maxlength="20" style="font-weight:700;">
                    </div>
                    <div class="form-group" style="margin:0;">
                        <label style="font-size:0.82rem; font-weight:700; color:var(--text-main); display:block; margin-bottom:5px;">
                            Cédula / RIF Titular:
                        </label>
                        <input type="text" id="cuenta-bancaria-cedula" class="form-control" value="${cedulaVal}" placeholder="Ej: V-30.544.641" maxlength="20" style="font-weight:700;">
                    </div>
                </div>

                <div class="form-group" style="margin-bottom:12px;">
                    <label style="font-size:0.82rem; font-weight:700; color:var(--text-main); display:block; margin-bottom:5px;">
                        Número de Cuenta Bancaria (20 dígitos):
                    </label>
                    <input type="text" id="cuenta-bancaria-cuenta" class="form-control" value="${cuentaVal}" placeholder="Ej: 01720000000000000000 (Opcional si solo usas Pago Móvil)" maxlength="24" style="letter-spacing:0.5px; font-family:monospace; font-size:0.88rem;">
                </div>

                <div class="form-group" style="margin-bottom:12px;">
                    <label style="font-size:0.82rem; font-weight:700; color:var(--text-main); display:block; margin-bottom:5px;">
                        Nombre del Titular de la Cuenta:
                    </label>
                    <input type="text" id="cuenta-bancaria-titular" class="form-control" value="${titularVal}" placeholder="Ej: Josnairit Salazar / Tu Bodeguita">
                </div>

                <div class="form-group" style="margin-bottom:18px;">
                    <label style="font-size:0.82rem; font-weight:700; color:var(--text-main); display:block; margin-bottom:5px;">
                        Instrucciones o Nota Adicional para el Cliente:
                    </label>
                    <input type="text" id="cuenta-bancaria-instrucciones" class="form-control" value="${instrucVal}" placeholder="Ej: Reportar comprobante con últimos 6 u 8 dígitos de referencia">
                </div>

                <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid var(--border-light); padding-top:14px;">
                    <button type="button" class="btn btn-outline" onclick="cerrarModalEditarCuentaBancaria()">Cancelar</button>
                    <button type="submit" id="btn-guardar-cuenta-bancaria-modal" class="btn btn-primary" style="font-weight:700; padding:10px 20px;">
                        <i class="fas fa-check"></i> Guardar Cambios
                    </button>
                </div>
            </form>
        </div>
    `;

    modal.classList.add('active');
}

/**
 * Cierra el modal de edición de cuentas
 */
function cerrarModalEditarCuentaBancaria() {
    const modal = document.getElementById('modal-admin-cuenta-bancaria');
    if (modal) modal.classList.remove('active');
}

/**
 * Asigna banco y tipo sugerido rápidamente al formulario
 */
function asignarBancoSugeridoModal(banco, tipo = 'Pago Móvil / Transferencia') {
    const inputBanco = document.getElementById('cuenta-bancaria-banco');
    if (inputBanco) inputBanco.value = banco;
    const selectTipo = document.getElementById('cuenta-bancaria-tipo');
    if (selectTipo) selectTipo.value = tipo;
}
window.asignarBancoSugeridoModal = asignarBancoSugeridoModal;

/**
 * Guarda o actualiza la cuenta bancaria configurada por el admin
 */
async function guardarCuentaBancariaAdmin() {
    const idEl = document.getElementById('cuenta-bancaria-id');
    const id = idEl ? idEl.value.trim() : '';
    const banco = (document.getElementById('cuenta-bancaria-banco')?.value || '').trim();
    const tipo = (document.getElementById('cuenta-bancaria-tipo')?.value || 'Pago Móvil / Transferencia').trim();
    const telefono = (document.getElementById('cuenta-bancaria-telefono')?.value || '').trim();
    const cedulaRif = (document.getElementById('cuenta-bancaria-cedula')?.value || '').trim();
    const cuenta = (document.getElementById('cuenta-bancaria-cuenta')?.value || '').trim();
    const titular = (document.getElementById('cuenta-bancaria-titular')?.value || '').trim();
    const instrucciones = (document.getElementById('cuenta-bancaria-instrucciones')?.value || '').trim();

    if (!banco) {
        if (window.InventoryApp.Modal?.toast) {
            window.InventoryApp.Modal.toast('Ingresa el nombre de la entidad bancaria', 'danger');
        }
        return;
    }

    if (!telefono && !cuenta) {
        if (window.InventoryApp.Modal?.toast) {
            window.InventoryApp.Modal.toast('Indica al menos un teléfono de Pago Móvil o un número de cuenta', 'danger');
        }
        return;
    }

    AppState.cuentasBancarias = Array.isArray(AppState.cuentasBancarias) ? AppState.cuentasBancarias : [];
    const idFinal = id || `banco_${Date.now()}`;

    // Mantener el estado activo actual de la cuenta si ya existía, o activar por defecto si es nueva
    const cuentaExistente = id ? AppState.cuentasBancarias.find(c => c.id === id) : null;
    const activo = cuentaExistente ? (cuentaExistente.activo !== false) : true;

    const nuevaCuenta = {
        id: idFinal,
        banco,
        bank: banco,
        tipo,
        type: tipo.includes('Transferencia') && !tipo.includes('Pago Móvil') ? 'Transferencia' : 'Pago Móvil',
        telefono,
        phone: telefono,
        cedulaRif,
        idNumber: cedulaRif,
        cuenta,
        account: cuenta,
        titular: titular || 'Josnairit Salazar / Tu Bodeguita',
        instrucciones,
        correo: '',
        activo
    };

    const idx = AppState.cuentasBancarias.findIndex(c => c.id === idFinal);
    if (idx >= 0) {
        AppState.cuentasBancarias[idx] = nuevaCuenta;
    } else {
        AppState.cuentasBancarias.push(nuevaCuenta);
    }

    // Persistir localmente en sesión y caché
    if (window.InventoryApp?.Persistence?.guardar) {
        window.InventoryApp.Persistence.guardar(true);
    }
    try {
        localStorage.setItem('bodeguita_cache_cuentas_bancarias', JSON.stringify(AppState.cuentasBancarias));
    } catch (e) {}

    // Sincronizar en Firestore
    if (window.InventoryApp?.Firebase?.guardarCuentasBancarias) {
        try {
            await window.InventoryApp.Firebase.guardarCuentasBancarias(AppState.cuentasBancarias);
        } catch (err) {
            console.warn('[configuracion.js] Advertencia guardando cuentas bancarias en Firestore:', err);
        }
    }

    cerrarModalEditarCuentaBancaria();
    renderizarGestionCuentasBancariasAdmin();

    // Actualizar dinámicamente vistas del cliente
    if (typeof poblarSelectorBancosCheckout === 'function') poblarSelectorBancosCheckout();
    if (typeof actualizarDetallesBancoCliente === 'function') actualizarDetallesBancoCliente();
    if (typeof actualizarCoordenadasModalAbono === 'function') actualizarCoordenadasModalAbono();

    if (window.InventoryApp.Modal?.toast) {
        window.InventoryApp.Modal.toast('✅ Cuenta bancaria guardada y sincronizada exitosamente', 'success');
    }
}

/**
 * Alterna el estado activo/inactivo de una cuenta
 */
async function toggleActivarCuentaBancaria(id) {
    if (!id || !Array.isArray(AppState.cuentasBancarias)) return;
    const c = AppState.cuentasBancarias.find(x => x.id === id);
    if (!c) return;

    c.activo = (c.activo === false) ? true : false;

    if (window.InventoryApp?.Persistence?.guardar) {
        window.InventoryApp.Persistence.guardar(true);
    }
    try {
        localStorage.setItem('bodeguita_cache_cuentas_bancarias', JSON.stringify(AppState.cuentasBancarias));
    } catch (e) {}

    if (window.InventoryApp?.Firebase?.guardarCuentasBancarias) {
        try {
            await window.InventoryApp.Firebase.guardarCuentasBancarias(AppState.cuentasBancarias);
        } catch (err) {
            console.warn('[configuracion.js] Error sincronizando pausa en Firestore:', err);
        }
    }

    renderizarGestionCuentasBancariasAdmin();
    if (typeof poblarSelectorBancosCheckout === 'function') poblarSelectorBancosCheckout();
    if (typeof actualizarDetallesBancoCliente === 'function') actualizarDetallesBancoCliente();
    if (typeof actualizarCoordenadasModalAbono === 'function') actualizarCoordenadasModalAbono();

    if (window.InventoryApp.Modal?.toast) {
        window.InventoryApp.Modal.toast(
            c.activo ? `🟢 Cuenta ${c.banco || c.bank} activada para clientes` : `⏸️ Cuenta ${c.banco || c.bank} pausada (oculta para clientes)`,
            c.activo ? 'success' : 'info'
        );
    }
}

/**
 * Elimina una cuenta bancaria con confirmación in-app
 */
async function eliminarCuentaBancaria(id) {
    if (!id || !Array.isArray(AppState.cuentasBancarias)) return;
    const c = AppState.cuentasBancarias.find(x => x.id === id);
    if (!c) return;

    const nombreBanco = c.banco || c.bank || 'la cuenta seleccionada';

    // Usar modal in-app con promesa (evita interceptor nativo de confirm que siempre retorna false)
    let confirmado = false;
    if (window.InventoryApp?.Modal?.confirm) {
        confirmado = await window.InventoryApp.Modal.confirm(
            'Eliminar Cuenta Bancaria',
            `¿Estás seguro de eliminar permanentemente la cuenta de <strong>${nombreBanco}</strong>?<br><small style="color:var(--text-muted);">Los clientes ya no podrán verla ni seleccionarla para compras o abonos.</small>`,
            { confirmText: 'Sí, Eliminar', cancelText: 'Cancelar', isDanger: true, tipo: 'danger' }
        );
    } else if (typeof window.showCustomConfirm === 'function') {
        confirmado = await window.showCustomConfirm(
            'Eliminar Cuenta Bancaria',
            `¿Estás seguro de eliminar la cuenta de ${nombreBanco}?`,
            { confirmText: 'Sí, Eliminar', cancelText: 'Cancelar', isDanger: true, tipo: 'danger' }
        );
    } else {
        confirmado = true;
    }

    if (!confirmado) return;

    AppState.cuentasBancarias = AppState.cuentasBancarias.filter(x => x.id !== id);

    if (window.InventoryApp?.Persistence?.guardar) {
        window.InventoryApp.Persistence.guardar(true);
    }
    try {
        localStorage.setItem('bodeguita_cache_cuentas_bancarias', JSON.stringify(AppState.cuentasBancarias));
    } catch (e) {}

    if (window.InventoryApp?.Firebase?.guardarCuentasBancarias) {
        try {
            await window.InventoryApp.Firebase.guardarCuentasBancarias(AppState.cuentasBancarias);
        } catch (err) {
            console.warn('[configuracion.js] Error al eliminar cuenta en Firebase:', err);
        }
    }

    renderizarGestionCuentasBancariasAdmin();
    if (typeof poblarSelectorBancosCheckout === 'function') poblarSelectorBancosCheckout();
    if (typeof actualizarDetallesBancoCliente === 'function') actualizarDetallesBancoCliente();
    if (typeof actualizarCoordenadasModalAbono === 'function') actualizarCoordenadasModalAbono();

    if (window.InventoryApp.Modal?.toast) {
        window.InventoryApp.Modal.toast(`🗑️ Cuenta de ${nombreBanco} eliminada exitosamente`, 'info');
    }
}

/**
 * Copia las coordenadas formateadas de una cuenta al portapapeles
 */
function copiarCoordenadasCuenta(id, btn = null) {
    const c = (AppState.cuentasBancarias || []).find(x => x.id === id);
    if (!c) return;

    const lineas = [
        `*Coordenadas Bancarias - ${c.banco || c.bank}*`,
        `• Tipo: ${c.tipo || c.type || 'Pago Móvil'}`,
        (c.telefono || c.phone) ? `• Teléfono Pago Móvil: ${c.telefono || c.phone}` : null,
        (c.cedulaRif || c.idNumber) ? `• C.I / RIF: ${c.cedulaRif || c.idNumber}` : null,
        (c.cuenta || c.account) ? `• Nº Cuenta: ${c.cuenta || c.account}` : null,
        c.titular ? `• Titular: ${c.titular}` : null,
        c.instrucciones ? `• Nota: ${c.instrucciones}` : null
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(lineas).then(() => {
        if (btn) {
            const original = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check" style="color:#10b981;"></i>';
            setTimeout(() => { btn.innerHTML = original; }, 1800);
        }
        if (window.InventoryApp.Modal?.toast) {
            window.InventoryApp.Modal.toast(`📋 Coordenadas de ${c.banco || c.bank} copiadas`, 'success');
        }
    });
}

window.renderizarGestionCuentasBancariasAdmin = renderizarGestionCuentasBancariasAdmin;
window.abrirModalEditarCuentaBancaria = abrirModalEditarCuentaBancaria;
window.cerrarModalEditarCuentaBancaria = cerrarModalEditarCuentaBancaria;
window.asignarBancoSugeridoModal = asignarBancoSugeridoModal;
window.alSeleccionarBancoSugeridoAdmin = asignarBancoSugeridoModal;
window.guardarCuentaBancariaAdmin = guardarCuentaBancariaAdmin;
window.toggleActivarCuentaBancaria = toggleActivarCuentaBancaria;
window.eliminarCuentaBancaria = eliminarCuentaBancaria;
window.copiarCoordenadasCuenta = copiarCoordenadasCuenta;

