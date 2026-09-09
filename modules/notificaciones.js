/* modules/notificaciones.js - Centro de Notificaciones y Actividad en Vivo */
(function () {
    let filtroActivo = 'todas';

    /**
     * Calcula el tiempo transcurrido en formato amigable
     */
    function formatearTiempoRelativo(timestamp) {
        if (!timestamp) return 'Reciente';
        const ahora = Date.now();
        const diffSegundos = Math.max(0, Math.floor((ahora - Number(timestamp)) / 1000));

        if (diffSegundos < 60) return 'Hace unos segundos';
        const minutos = Math.floor(diffSegundos / 60);
        if (minutos < 60) return `Hace ${minutos} min`;
        const horas = Math.floor(minutos / 60);
        if (horas < 24) return `Hace ${horas} h`;
        const dias = Math.floor(horas / 24);
        if (dias === 1) return 'Ayer';
        if (dias < 7) return `Hace ${dias} días`;
        return new Date(timestamp).toLocaleDateString();
    }

    /**
     * Verifica si el usuario en sesión es Administrador o SuperAdmin
     */
    function esUsuarioAdmin() {
        const usuario = window.AppState?.usuarioActual;
        if (!usuario) return false;
        const rol = String(usuario.rol || '').trim().toLowerCase();
        return rol === 'admin' || rol === 'superadmin' || usuario.id === 'SuperAdmin' || usuario.cedula === 'SuperAdmin';
    }

    /**
     * Verifica si el usuario en sesión es Cliente
     */
    function esUsuarioCliente() {
        const usuario = window.AppState?.usuarioActual;
        if (!usuario) return false;
        const rol = String(usuario.rol || '').trim().toLowerCase();
        return rol === 'cliente' || (!esUsuarioAdmin() && rol !== 'vendedor');
    }

    /**
     * Retorna exclusivamente las notificaciones permitidas para el usuario en sesión activa.
     * Regla estricta del sistema:
     * "Los clientes sólo deben llegarles la notificación que el admin aprobó su transacción,
     * no todas las notificaciones que le llegan al admin"
     */
    function obtenerNotificacionesParaUsuarioActual() {
        const usuario = window.AppState?.usuarioActual;
        if (!usuario) return [];
        const lista = Array.isArray(AppState.notificaciones) ? AppState.notificaciones : [];

        if (esUsuarioAdmin()) {
            // El administrador ve las notificaciones de gestión (pagos reportados, ventas, créditos, auditorías, etc.)
            // No se le llena la pantalla con notificaciones dirigidas exclusivamente al cliente individual
            return lista.filter(n => n.paraCliente !== true || n.paraAdmin === true);
        }

        if (esUsuarioCliente()) {
            const miCedula = String(usuario.cedula || usuario.id || '').trim().toLowerCase();
            const miNombre = String(usuario.nombre || '').trim().toLowerCase();

            return lista.filter(n => {
                const notifClienteId = String(n.clienteId || n.clienteCedula || '').trim().toLowerCase();
                const notifClienteNom = String(n.clienteNombre || '').trim().toLowerCase();
                const esMio = (notifClienteId && notifClienteId === miCedula) || 
                              (notifClienteNom && notifClienteNom === miNombre);

                if (!esMio) return false;

                // Debe ser estrictamente una notificación de aprobación de su transacción
                const esAprobacion = n.tipo === 'aprobacion' || 
                                     n.subTipo === 'aprobacion_admin' || 
                                     n.tipo === 'pago_aprobado' ||
                                     (String(n.titulo || '').toLowerCase().includes('aprobad') && !String(n.titulo || '').toLowerCase().includes('pendiente')) ||
                                     (String(n.mensaje || '').toLowerCase().includes('aprobó') || String(n.mensaje || '').toLowerCase().includes('aprobado') || String(n.mensaje || '').toLowerCase().includes('conciliado'));

                // Excluir cualquier alerta administrativa (créditos dados, reportes pendientes, comentarios, inventario)
                const esAlertaAdmin = n.tipo === 'credito' || 
                                      n.tipo === 'inventario' || 
                                      n.tipo === 'sistema' ||
                                      n.tipo === 'comentario' ||
                                      String(n.titulo || '').toLowerCase().includes('reportado') ||
                                      String(n.titulo || '').toLowerCase().includes('pendiente') ||
                                      String(n.titulo || '').toLowerCase().includes('nuevo pago');

                return esAprobacion && !esAlertaAdmin;
            });
        }

        // Otros roles (vendedores)
        return lista.filter(n => n.paraCliente !== true);
    }

    /**
     * Registra una nueva notificación en el sistema y sincroniza
     */
    function registrarNotificacion(datos) {
        if (!datos || !datos.mensaje) return;

        if (!Array.isArray(AppState.notificaciones)) {
            AppState.notificaciones = [];
        }

        const esAprob = datos.tipo === 'aprobacion' || datos.subTipo === 'aprobacion_admin';
        const nuevaNotif = {
            id: datos.id || ('notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
            tipo: datos.tipo || 'sistema', // 'aprobacion', 'pago', 'credito', 'comentario', 'venta', 'inventario', 'sistema'
            subTipo: datos.subTipo || (esAprob ? 'aprobacion_admin' : null),
            titulo: datos.titulo || (esAprob ? 'Transacción Aprobada' : 'Notificación del Sistema'),
            mensaje: datos.mensaje,
            clienteId: datos.clienteId || null,
            clienteNombre: datos.clienteNombre || null,
            montoUSD: Number(datos.montoUSD || 0),
            montoVES: Number(datos.montoVES || 0),
            referenciaId: datos.referenciaId || null,
            fecha: datos.fecha || new Date().toISOString().replace('T', ' ').substring(0, 16),
            timestamp: datos.timestamp || Date.now(),
            leida: datos.leida !== undefined ? Boolean(datos.leida) : false,
            paraCliente: datos.paraCliente !== undefined ? Boolean(datos.paraCliente) : esAprob,
            paraAdmin: datos.paraAdmin !== undefined ? Boolean(datos.paraAdmin) : !esAprob,
            destino: datos.destino || (esAprob ? { tab: 'cliente-cuenta' } : { tab: 'pos' })
        };

        // Evitar duplicados idénticos en menos de 5 segundos
        const yaExiste = AppState.notificaciones.find(n => 
            n.mensaje === nuevaNotif.mensaje && 
            Math.abs(n.timestamp - nuevaNotif.timestamp) < 5000
        );
        if (yaExiste) return;

        AppState.notificaciones.unshift(nuevaNotif);

        // Limitar tamaño máximo para optimizar rendimiento
        if (AppState.notificaciones.length > 200) {
            AppState.notificaciones = AppState.notificaciones.slice(0, 200);
        }

        // Persistir y sincronizar
        if (window.InventoryApp?.Persistence?.guardar) {
            window.InventoryApp.Persistence.guardar(true);
        }
        if (window.InventoryApp?.Firebase?.guardarNotificacion) {
            window.InventoryApp.Firebase.guardarNotificacion(nuevaNotif).catch(() => {});
        }

        actualizarBadgesNotificaciones();

        // Si la pestaña actual es 'notificaciones', refrescar la vista
        const vista = document.getElementById('notificaciones');
        if (vista && vista.classList.contains('active')) {
            renderizarNotificaciones(filtroActivo);
        }
    }

    /**
     * Marca una notificación como leída
     */
    function marcarNotificacionLeida(id, evitarRender = false) {
        if (!Array.isArray(AppState.notificaciones)) return;
        const notif = AppState.notificaciones.find(n => n.id === id);
        if (notif && !notif.leida) {
            notif.leida = true;
            if (window.InventoryApp?.Persistence?.guardar) {
                window.InventoryApp.Persistence.guardar(true);
            }
            if (window.InventoryApp?.Firebase?.marcarNotificacionLeida) {
                window.InventoryApp.Firebase.marcarNotificacionLeida(id).catch(() => {});
            }
            actualizarBadgesNotificaciones();
            if (!evitarRender) {
                renderizarNotificaciones(filtroActivo);
            }
        }
    }

    /**
     * Marca todas las notificaciones del usuario actual como leídas
     */
    function marcarTodasNotificacionesLeidas() {
        const listaUsuario = obtenerNotificacionesParaUsuarioActual();
        if (listaUsuario.length === 0) return;

        listaUsuario.forEach(n => { 
            n.leida = true; 
            if (window.InventoryApp?.Firebase?.marcarNotificacionLeida) {
                window.InventoryApp.Firebase.marcarNotificacionLeida(n.id).catch(() => {});
            }
        });

        if (window.InventoryApp?.Persistence?.guardar) {
            window.InventoryApp.Persistence.guardar(true);
        }

        actualizarBadgesNotificaciones();
        renderizarNotificaciones(filtroActivo);

        if (window.InventoryApp?.Modal?.toast) {
            window.InventoryApp.Modal.toast('Todas tus notificaciones han sido marcadas como leídas', 'success');
        }
    }

    /**
     * Elimina una notificación puntual
     */
    function eliminarNotificacion(id, event) {
        if (event) event.stopPropagation();
        if (!Array.isArray(AppState.notificaciones)) return;
        AppState.notificaciones = AppState.notificaciones.filter(n => n.id !== id);

        if (window.InventoryApp?.Persistence?.guardar) {
            window.InventoryApp.Persistence.guardar(true);
        }
        if (window.InventoryApp?.Firebase?.eliminarNotificacion) {
            window.InventoryApp.Firebase.eliminarNotificacion(id).catch(() => {});
        }

        actualizarBadgesNotificaciones();
        renderizarNotificaciones(filtroActivo);
    }

    /**
     * Limpia todas las notificaciones que ya fueron leídas del usuario actual
     */
    function limpiarNotificacionesLeidas() {
        if (!Array.isArray(AppState.notificaciones)) return;
        const listaUsuario = obtenerNotificacionesParaUsuarioActual();
        const idsAEliminar = new Set(listaUsuario.filter(n => n.leida).map(n => n.id));
        if (idsAEliminar.size === 0) return;

        AppState.notificaciones = AppState.notificaciones.filter(n => !idsAEliminar.has(n.id));

        if (window.InventoryApp?.Persistence?.guardar) {
            window.InventoryApp.Persistence.guardar(true);
        }

        actualizarBadgesNotificaciones();
        renderizarNotificaciones(filtroActivo);

        if (window.InventoryApp?.Modal?.toast) {
            window.InventoryApp.Modal.toast(`Se eliminaron ${idsAEliminar.size} notificación(es) leída(s)`, 'info');
        }
    }

    /**
     * Hace clic en una notificación: la marca como leída y navega al sitio correspondiente
     */
    function irANotificacion(id) {
        if (!Array.isArray(AppState.notificaciones)) return;
        const notif = AppState.notificaciones.find(n => n.id === id);
        if (!notif) return;

        // 1. Marcar como leída
        marcarNotificacionLeida(id, true);

        // Si es cliente, llevarlo directamente a su estado de cuenta para ver la deuda rebajada y el abono
        if (esUsuarioCliente()) {
            if (typeof switchTab === 'function') {
                switchTab('cliente-cuenta');
            }
            setTimeout(() => {
                if (typeof window.renderizarEstadoCuentaCliente === 'function') {
                    window.renderizarEstadoCuentaCliente();
                }
            }, 100);
            if (window.InventoryApp?.Modal?.toast) {
                window.InventoryApp.Modal.toast('Consultando tu estado de cuenta actualizado', 'info');
            }
            return;
        }

        const destino = notif.destino || {};
        const tab = destino.tab || 'pos';

        // 2. Navegar a la pestaña correspondiente
        if (typeof switchTab === 'function') {
            switchTab(tab);
        }

        // 3. Ejecutar acción de destino según el tipo
        setTimeout(() => {
            if (tab === 'clientes') {
                const clienteId = destino.clienteId || notif.clienteId;
                if (clienteId && typeof window.abrirModalEstadoCuenta === 'function') {
                    window.abrirModalEstadoCuenta(clienteId);
                } else if (clienteId && typeof window.seleccionarCliente === 'function') {
                    window.seleccionarCliente(clienteId);
                }
            } else if (tab === 'transacciones') {
                // Scroll hacia el área de pagos pendientes o formulario
                const container = document.getElementById('abonos-pendientes-admin-container');
                if (container) {
                    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    container.style.transition = 'box-shadow 0.3s ease';
                    container.style.boxShadow = '0 0 0 4px rgba(2, 132, 199, 0.4)';
                    setTimeout(() => { container.style.boxShadow = 'none'; }, 2000);
                }
            } else if (tab === 'historial-ventas') {
                const idRef = destino.idRef || notif.referenciaId;
                const inputFiltro = document.getElementById('historial-filtro-texto');
                if (inputFiltro && idRef) {
                    inputFiltro.value = idRef;
                    if (typeof window.filtrarHistorialGeneral === 'function') {
                        window.filtrarHistorialGeneral();
                    }
                }
            } else if (tab === 'inventario') {
                const idRef = destino.idRef || notif.referenciaId;
                const search = document.getElementById('search');
                if (search && idRef) {
                    search.value = idRef;
                    if (typeof window.filtrarInventario === 'function') {
                        window.filtrarInventario();
                    }
                }
            }

            // Si es un comentario, abrir modal emergente para leerlo completo
            if (notif.tipo === 'comentario' || destino.subAccion === 'verComentario') {
                abrirModalDetalleComentario(notif);
            }
        }, 150);

        if (window.InventoryApp?.Modal?.toast) {
            window.InventoryApp.Modal.toast(`Accediendo a: ${notif.titulo}`, 'info');
        }
    }

    /**
     * Muestra un modal con el comentario completo y datos del cliente
     */
    function abrirModalDetalleComentario(notif) {
        let modal = document.getElementById('modal-detalle-comentario-notif');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-detalle-comentario-notif';
            modal.className = 'modal-overlay';
            modal.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:99999; align-items:center; justify-content:center; padding:16px; backdrop-filter:blur(3px);';
            modal.innerHTML = `
                <div class="card" style="width:100%; max-width:540px; padding:0; overflow:hidden; border-radius:12px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.3);">
                    <div style="padding:16px 20px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; background:var(--bg-card);">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <i class="fas fa-comment-dots" style="color:#0284c7; font-size:1.25rem;"></i>
                            <h3 id="comentario-notif-titulo" style="margin:0; font-size:1.1rem; color:var(--text-main);">Comentario de Cliente</h3>
                        </div>
                        <button type="button" class="btn btn-sm btn-outline" onclick="cerrarModalDetalleComentario()" style="border-radius:50%; width:32px; height:32px; padding:0; display:flex; align-items:center; justify-content:center;">
                            <i class="fas fa-xmark"></i>
                        </button>
                    </div>
                    <div style="padding:20px; font-size:0.95rem;" id="comentario-notif-cuerpo"></div>
                    <div style="padding:14px 20px; border-top:1px solid var(--border-color); display:flex; justify-content:flex-end; gap:10px; background:var(--bg-card);">
                        <button type="button" class="btn btn-outline" onclick="cerrarModalDetalleComentario()">Cerrar</button>
                        <button type="button" class="btn btn-primary" id="btn-comentario-ir-cliente" style="font-weight:700;">Ver Cuenta del Cliente</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        const cuerpo = document.getElementById('comentario-notif-cuerpo');
        const btnCliente = document.getElementById('btn-comentario-ir-cliente');
        const clienteNom = notif.clienteNombre || notif.clienteId || 'Cliente';

        cuerpo.innerHTML = `
            <div style="background:var(--bg-main); border:1px solid var(--border-color); border-radius:10px; padding:16px; margin-bottom:14px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <strong><i class="fas fa-user" style="color:#0284c7; margin-right:6px;"></i> ${clienteNom}</strong>
                    <span style="font-size:0.8rem; color:var(--text-muted);">${notif.fecha}</span>
                </div>
                <div style="font-size:1rem; color:var(--text-main); font-style:italic; line-height:1.5; background:rgba(255,255,255,0.7); padding:12px; border-radius:8px; border-left:4px solid #0284c7;">
                    "${notif.mensaje.replace(/^[^\"]*\"?|\"?$/g, '')}"
                </div>
            </div>
            <div style="font-size:0.82rem; color:var(--text-muted);">
                ${notif.referenciaId ? `<span>Referencia / Pedido: <code>#${notif.referenciaId}</code></span>` : ''}
            </div>
        `;

        btnCliente.onclick = () => {
            cerrarModalDetalleComentario();
            if (notif.clienteId && typeof window.abrirModalEstadoCuenta === 'function') {
                if (typeof switchTab === 'function') switchTab('clientes');
                setTimeout(() => window.abrirModalEstadoCuenta(notif.clienteId), 150);
            }
        };

        modal.style.display = 'flex';
    }

    window.cerrarModalDetalleComentario = function() {
        const modal = document.getElementById('modal-detalle-comentario-notif');
        if (modal) modal.style.display = 'none';
    };

    /**
     * Permite a un cliente o usuario dejar un comentario o sugerencia directamente a la tienda
     */
    window.abrirModalComentarioCliente = function() {
        let modal = document.getElementById('modal-dejar-comentario-cliente');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-dejar-comentario-cliente';
            modal.className = 'modal-overlay';
            modal.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:99999; align-items:center; justify-content:center; padding:16px; backdrop-filter:blur(3px);';
            modal.innerHTML = `
                <div class="card" style="width:100%; max-width:500px; padding:0; overflow:hidden; border-radius:12px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.3);">
                    <div style="padding:16px 20px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; background:var(--bg-card);">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <i class="fas fa-comment-dots" style="color:#0284c7; font-size:1.25rem;"></i>
                            <h3 style="margin:0; font-size:1.1rem; color:var(--text-main);">Dejar un Comentario o Sugerencia</h3>
                        </div>
                        <button type="button" class="btn btn-sm btn-outline" onclick="cerrarModalComentarioCliente()" style="border-radius:50%; width:32px; height:32px; padding:0; display:flex; align-items:center; justify-content:center;">
                            <i class="fas fa-xmark"></i>
                        </button>
                    </div>
                    <form onsubmit="enviarComentarioCliente(event)" style="padding:20px;">
                        <p style="margin:0 0 12px; font-size:0.88rem; color:var(--text-muted);">Tu opinión es fundamental para nosotros. Envíanos cualquier duda, pedido especial o sugerencia de productos:</p>
                        <div class="form-group" style="margin-bottom:14px;">
                            <label style="font-weight:600; display:block; margin-bottom:6px; font-size:0.85rem;">Tu Comentario / Mensaje <span style="color:#ef4444;">*</span></label>
                            <textarea id="input-comentario-cliente-texto" class="form-control" rows="4" placeholder="Escribe aquí tu mensaje o comentario para la administración..." required style="width:100%; font-size:0.9rem; padding:10px; border-radius:8px;"></textarea>
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:10px;">
                            <button type="button" class="btn btn-outline" onclick="cerrarModalComentarioCliente()">Cancelar</button>
                            <button type="submit" class="btn btn-primary" style="font-weight:700;"><i class="fas fa-paper-plane"></i> Enviar Comentario</button>
                        </div>
                    </form>
                </div>
            `;
            document.body.appendChild(modal);
        }
        const input = document.getElementById('input-comentario-cliente-texto');
        if (input) input.value = '';
        modal.style.display = 'flex';
    };

    window.cerrarModalComentarioCliente = function() {
        const modal = document.getElementById('modal-dejar-comentario-cliente');
        if (modal) modal.style.display = 'none';
    };

    window.enviarComentarioCliente = function(e) {
        if (e) e.preventDefault();
        const input = document.getElementById('input-comentario-cliente-texto');
        const comentario = input ? input.value.trim() : '';
        if (!comentario) return;

        const usuario = AppState.usuarioActual || {};
        const nombre = usuario.nombre || usuario.id || 'Cliente';
        const cedula = usuario.cedula || usuario.id || 'Anonimo';

        registrarNotificacion({
            tipo: 'comentario',
            titulo: 'Nuevo Comentario de Cliente',
            mensaje: `${nombre} dejó un comentario: "${comentario}"`,
            clienteId: cedula,
            clienteNombre: nombre,
            fecha: new Date().toISOString().replace('T', ' ').substring(0, 16),
            timestamp: Date.now(),
            destino: {
                tab: 'clientes',
                subAccion: 'verComentario',
                clienteId: cedula,
                textoComentario: comentario
            }
        });

        cerrarModalComentarioCliente();
        if (window.InventoryApp?.Modal?.toast) {
            window.InventoryApp.Modal.toast('¡Muchas gracias! Tu comentario fue enviado exitosamente.', 'success');
        } else {
            alert('¡Muchas gracias! Tu comentario fue enviado exitosamente.');
        }
    };

    /**
     * Actualiza los contadores y badges visuales de notificaciones en el header y navbar
     * respetando el rol del usuario (clientes sólo cuentan sus transacciones aprobadas).
     */
    function actualizarBadgesNotificaciones() {
        const lista = obtenerNotificacionesParaUsuarioActual();
        const noLeidas = lista.filter(n => !n.leida).length;

        const badgeDesk = document.getElementById('badge-notificaciones-desktop');
        const badgeMob = document.getElementById('badge-notificaciones-mobile');
        const badgeHeader = document.getElementById('badge-header-notificaciones');

        if (badgeDesk) {
            if (noLeidas > 0) {
                badgeDesk.style.display = 'inline-flex';
                badgeDesk.textContent = noLeidas > 99 ? '99+' : noLeidas;
            } else {
                badgeDesk.style.display = 'none';
            }
        }

        if (badgeMob) {
            if (noLeidas > 0) {
                badgeMob.style.display = 'block';
            } else {
                badgeMob.style.display = 'none';
            }
        }

        if (badgeHeader) {
            if (noLeidas > 0) {
                badgeHeader.style.display = 'inline-flex';
                badgeHeader.textContent = noLeidas > 99 ? '99+' : noLeidas;
            } else {
                badgeHeader.style.display = 'none';
            }
        }
    }

    /**
     * Si la lista de notificaciones está vacía, genera automáticamente notificaciones
     * a partir del historial real para que el usuario nunca vea una pantalla en blanco.
     * Si el usuario es Cliente: ÚNICAMENTE se generan notificaciones de aprobación de sus transacciones.
     */
    function generarNotificacionesInicialesSiVacio() {
        if (!Array.isArray(AppState.notificaciones)) {
            AppState.notificaciones = [];
        }

        const usuario = window.AppState?.usuarioActual;

        // Caso CLIENTE: Nunca generar alertas de negocio general (créditos, inventario, comentarios).
        if (esUsuarioCliente() && usuario) {
            const miId = String(usuario.cedula || usuario.id || '').trim().toLowerCase();
            const yaTiene = AppState.notificaciones.some(n => {
                const cId = String(n.clienteId || n.clienteCedula || '').trim().toLowerCase();
                return cId === miId && (n.tipo === 'aprobacion' || n.subTipo === 'aprobacion_admin');
            });

            // Si no tiene notificaciones de aprobación previas, buscar en sus abonos aprobados
            if (!yaTiene) {
                const abonos = Array.isArray(AppState.abonos) ? AppState.abonos : [];
                abonos.forEach(a => {
                    const cId = String(a.clienteId || '').trim().toLowerCase();
                    const estado = String(a.estado || '').toLowerCase();
                    if (cId === miId && (estado === 'pago agregado' || estado === 'confirmado')) {
                        const ts = a.fechaAprobacion ? new Date(a.fechaAprobacion).getTime() : (a.fecha ? new Date(a.fecha).getTime() : Date.now());
                        const { esDivisa, montoUSD, montoVES } = typeof sanitizarAbonoMonedas === 'function'
                            ? sanitizarAbonoMonedas(a, AppState.tasaActiva || AppState.tasaUSD_BCV || 0)
                            : { esDivisa: String(a.formaPago || a.metodo || '').includes('USD'), montoUSD: Number(a.montoUSD || 0), montoVES: Number(a.montoVES || 0) };
                        const bsStr = montoVES.toLocaleString('es-VE', { minimumFractionDigits: 2 });
                        const usdStr = montoUSD.toFixed(2);
                        const montoMsg = esDivisa ? `$${usdStr} USD` : `Bs. ${bsStr}`;
                        const refStr = a.referencia ? ` (Ref: ${a.referencia})` : '';

                        AppState.notificaciones.push({
                            id: 'notif_aprob_abn_hist_' + a.id,
                            tipo: 'aprobacion',
                            subTipo: 'aprobacion_admin',
                            titulo: 'Transacción Aprobada',
                            mensaje: `El Administrador aprobó tu abono de ${montoMsg}${refStr}. Tu deuda fue rebajada con éxito.`,
                            clienteId: usuario.cedula || usuario.id,
                            clienteNombre: usuario.nombre || usuario.id,
                            montoUSD: montoUSD,
                            montoVES: montoVES,
                            esDivisasUSD: esDivisa,
                            referenciaId: a.id,
                            fecha: a.fechaAprobacion || a.fecha || new Date().toISOString().replace('T', ' ').substring(0, 16),
                            timestamp: isNaN(ts) ? Date.now() : ts,
                            leida: true,
                            paraCliente: true,
                            paraAdmin: false,
                            destino: { tab: 'cliente-cuenta', subAccion: 'verAbono', idRef: a.id }
                        });
                    }
                });
            }
            return;
        }

        // Caso ADMINISTRADOR / GESTIÓN:
        if (AppState.notificaciones.length > 0) return;

        const notifs = [];

        // 1. Notificaciones de Crédito
        const ventas = Array.isArray(AppState.ventas) ? AppState.ventas : [];
        ventas.forEach(v => {
            const esCred = v.tipo === 'Crédito' || v.tipoPago === 'Crédito' || v.esCredito === true;
            if (esCred) {
                const ts = v.fecha ? new Date(v.fecha).getTime() : Date.now();
                notifs.push({
                    id: 'notif_init_cred_' + v.id,
                    tipo: 'credito',
                    titulo: 'Crédito Concedido',
                    mensaje: `${v.clienteNombre || v.clienteId || 'Cliente'} sacó un crédito por $${Number(v.total || 0).toFixed(2)} (Pedido #${v.id})`,
                    clienteId: v.clienteId,
                    clienteNombre: v.clienteNombre || v.clienteId,
                    montoUSD: Number(v.total || 0),
                    montoVES: Number(v.totalVES || 0),
                    referenciaId: v.id,
                    fecha: v.fecha || new Date().toISOString().replace('T', ' ').substring(0, 16),
                    timestamp: isNaN(ts) ? Date.now() : ts,
                    leida: true,
                    paraAdmin: true,
                    paraCliente: false,
                    destino: {
                        tab: 'clientes',
                        subAccion: 'verCliente',
                        clienteId: v.clienteId,
                        idRef: v.id
                    }
                });
            }
        });

        // 2. Notificaciones de Pagos y Abonos
        const abonos = Array.isArray(AppState.abonos) ? AppState.abonos : [];
        abonos.forEach(a => {
            const ts = a.fecha ? new Date(a.fecha).getTime() : Date.now();
            const cliente = (AppState.clientes || []).find(c => c.id === a.clienteId);
            const nombre = a.clienteNombre || (cliente ? cliente.nombre : a.clienteId);
            const metodo = a.formaPago || a.metodo || 'Abono';
            const ref = a.referencia ? ` (Ref: ${a.referencia})` : '';

            const { esDivisa, montoUSD, montoVES } = typeof sanitizarAbonoMonedas === 'function'
                ? sanitizarAbonoMonedas(a, AppState.tasaActiva || AppState.tasaUSD_BCV || 0)
                : { esDivisa: String(metodo).includes('USD'), montoUSD: Number(a.montoUSD || 0), montoVES: Number(a.montoVES || 0) };
            const bsStr = montoVES.toLocaleString('es-VE', { minimumFractionDigits: 2 });
            const usdStr = montoUSD.toFixed(2);
            const textoMonto = esDivisa ? `en divisas de $${usdStr} USD` : `de Bs. ${bsStr}`;

            notifs.push({
                id: 'notif_init_abn_' + a.id,
                tipo: 'pago',
                titulo: 'Abono Registrado',
                mensaje: `${nombre} agregó un pago ${textoMonto} [${metodo}${ref}]`,
                clienteId: a.clienteId,
                clienteNombre: nombre,
                montoUSD: montoUSD,
                montoVES: montoVES,
                esDivisasUSD: esDivisa,
                referenciaId: a.id,
                fecha: a.fecha || new Date().toISOString().replace('T', ' ').substring(0, 16),
                timestamp: isNaN(ts) ? Date.now() : ts,
                leida: true,
                paraAdmin: true,
                paraCliente: false,
                destino: {
                    tab: 'transacciones',
                    subAccion: 'verPago',
                    idRef: a.id,
                    clienteId: a.clienteId
                }
            });

            // Si el abono tiene nota o comentario
            if (a.nota) {
                notifs.push({
                    id: 'notif_init_com_abn_' + a.id,
                    tipo: 'comentario',
                    titulo: 'Comentario en Abono',
                    mensaje: `${nombre} dejó un comentario: "${a.nota}"`,
                    clienteId: a.clienteId,
                    clienteNombre: nombre,
                    referenciaId: a.id,
                    fecha: a.fecha || new Date().toISOString().replace('T', ' ').substring(0, 16),
                    timestamp: isNaN(ts) ? Date.now() + 100 : ts + 100,
                    leida: true,
                    paraAdmin: true,
                    paraCliente: false,
                    destino: {
                        tab: 'transacciones',
                        subAccion: 'verComentario',
                        idRef: a.id,
                        clienteId: a.clienteId,
                        textoComentario: a.nota
                    }
                });
            }
        });

        // 3. Comentarios en retiros de inventario (auditoría de mermas)
        const eliminaciones = Array.isArray(AppState.eliminaciones) ? AppState.eliminaciones : [];
        eliminaciones.slice(0, 5).forEach(e => {
            if (e.comentario) {
                const ts = e.fecha ? new Date(e.fecha).getTime() : Date.now();
                notifs.push({
                    id: 'notif_init_com_ret_' + (e.id || Math.random().toString(36).substring(2, 7)),
                    tipo: 'comentario',
                    titulo: 'Comentario de Retiro',
                    mensaje: `Observación de retiro (${e.nombre || 'Producto'}): "${e.comentario}"`,
                    referenciaId: e.id,
                    fecha: e.fecha || new Date().toISOString().replace('T', ' ').substring(0, 16),
                    timestamp: isNaN(ts) ? Date.now() : ts,
                    leida: true,
                    paraAdmin: true,
                    paraCliente: false,
                    destino: {
                        tab: 'inventario',
                        subAccion: 'verInventario'
                    }
                });
            }
        });

        // Ordenar por fecha descendente
        notifs.sort((a, b) => b.timestamp - a.timestamp);
        AppState.notificaciones = notifs;
        actualizarBadgesNotificaciones();
    }

    /**
     * Renderiza la vista principal del Centro de Notificaciones
     * adaptada estrictamente al perfil del usuario autenticado.
     */
    function renderizarNotificaciones(filtro = 'todas') {
        filtroActivo = filtro;
        const contenedor = document.getElementById('notificaciones');
        if (!contenedor) return;

        generarNotificacionesInicialesSiVacio();

        const lista = obtenerNotificacionesParaUsuarioActual();
        const total = lista.length;
        const noLeidas = lista.filter(n => !n.leida).length;

        // ==========================================
        // VISTA DEDICADA PARA EL PERFIL CLIENTE
        // ==========================================
        if (esUsuarioCliente()) {
            let listaFiltrada = lista;
            if (filtro === 'no_leidas') {
                listaFiltrada = lista.filter(n => !n.leida);
            }

            contenedor.innerHTML = `
                <div class="card" style="margin-bottom:18px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="display:inline-flex; width:40px; height:40px; border-radius:10px; background:#dcfce7; color:#16a34a; align-items:center; justify-content:center; font-size:1.25rem;">
                                <i class="fas fa-circle-check"></i>
                            </span>
                            <div>
                                <h2 style="margin:0; font-size:1.35rem; color:var(--text-main);">Tus Notificaciones</h2>
                                <small style="color:var(--text-muted);">Avisos de transacciones y abonos aprobados por la administración</small>
                            </div>
                        </div>
                        <div style="display:flex; gap:8px; flex-wrap:wrap;">
                            <button type="button" class="btn btn-sm btn-outline" onclick="switchTab('cliente-cuenta')">
                                <i class="fas fa-file-invoice-dollar"></i> Mi Estado de Cuenta
                            </button>
                            <button type="button" class="btn btn-sm btn-outline" onclick="switchTab('cliente-catalogo')">
                                <i class="fas fa-store"></i> Ver Productos
                            </button>
                            <button type="button" class="btn btn-sm btn-primary" onclick="marcarTodasNotificacionesLeidas()" ${noLeidas === 0 ? 'disabled' : ''}>
                                <i class="fas fa-check-double"></i> Marcar todas leídas
                            </button>
                        </div>
                    </div>

                    <!-- Filtros sencillos para cliente -->
                    <div style="display:flex; gap:8px; flex-wrap:wrap; border-top:1px solid var(--border-color); padding-top:14px;">
                        <button type="button" class="btn btn-sm ${filtro === 'todas' ? 'btn-primary' : 'btn-outline'}" onclick="renderizarNotificaciones('todas')">
                            Todas (${total})
                        </button>
                        <button type="button" class="btn btn-sm ${filtro === 'no_leidas' ? 'btn-primary' : 'btn-outline'}" onclick="renderizarNotificaciones('no_leidas')">
                            Nuevas (${noLeidas})
                        </button>
                    </div>
                </div>

                <!-- Listado de notificaciones de aprobación -->
                <div id="lista-notificaciones-container" style="display:flex; flex-direction:column; gap:10px;">
                    ${listaFiltrada.length === 0 ? `
                        <div class="card" style="text-align:center; padding:40px 20px; color:var(--text-muted);">
                            <i class="fas fa-bell-slash" style="font-size:2.8rem; color:var(--border-color); margin-bottom:12px;"></i>
                            <h4 style="margin:0; color:var(--text-main); font-size:1.1rem;">No tienes notificaciones pendientes</h4>
                            <p style="margin:6px 0 16px; font-size:0.88rem;">Te avisaremos aquí inmediatamente cuando el Administrador apruebe tus abonos o compras.</p>
                            <button type="button" class="btn btn-sm btn-outline" onclick="switchTab('cliente-cuenta')">
                                <i class="fas fa-arrow-left"></i> Ir a Mi Estado de Cuenta
                            </button>
                        </div>
                    ` : listaFiltrada.map(n => {
                        const tiempoRel = formatearTiempoRelativo(n.timestamp);
                        const noLeidaClase = !n.leida ? 'background:#f0fdf4; border-left:4px solid #16a34a; font-weight:600;' : 'background:var(--bg-card); border-left:4px solid #16a34a;';

                        return `
                            <div class="card notificacion-card-item" 
                                 onclick="irANotificacion('${n.id}')"
                                 style="margin:0; padding:14px 18px; cursor:pointer; transition:all 0.18s ease; ${noLeidaClase} position:relative; box-shadow:0 1px 4px rgba(0,0,0,0.04); display:flex; justify-content:space-between; align-items:center; gap:14px;"
                                 onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.08)';"
                                 onmouseout="this.style.transform='none'; this.style.boxShadow='0 1px 4px rgba(0,0,0,0.04)';">
                                
                                <div style="display:flex; align-items:flex-start; gap:14px; flex:1;">
                                    <div style="width:40px; height:40px; border-radius:10px; background:#dcfce7; color:#16a34a; display:flex; align-items:center; justify-content:center; font-size:1.2rem; flex-shrink:0; margin-top:2px;">
                                        <i class="fas fa-circle-check"></i>
                                    </div>
                                    <div style="flex:1;">
                                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;">
                                            <span style="background:#dcfce7; color:#16a34a; font-size:0.72rem; font-weight:700; padding:2px 8px; border-radius:12px; text-transform:uppercase;">
                                                TRANSACCIÓN APROBADA
                                            </span>
                                            <span style="font-size:0.8rem; color:var(--text-muted);">
                                                <i class="fas fa-clock" style="font-size:0.75rem; margin-right:3px;"></i> ${tiempoRel} • ${n.fecha}
                                            </span>
                                            ${!n.leida ? `<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#16a34a;" title="Nueva"></span>` : ''}
                                        </div>
                                        <div style="font-size:0.95rem; color:var(--text-main); margin-bottom:4px; line-height:1.4;">
                                            ${n.mensaje}
                                        </div>
                                        <div style="display:flex; align-items:center; gap:12px; font-size:0.8rem; color:var(--text-muted); flex-wrap:wrap;">
                                            ${(n.esDivisasUSD || String(n.mensaje || '').includes('divisas')) 
                                                ? `<span style="color:var(--primary-accent); font-weight:700;">$${Number(n.montoUSD || 0).toFixed(2)} USD</span>` 
                                                : `<span style="color:#16a34a; font-weight:700;">Bs. ${Number(n.montoVES || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>`}
                                            ${n.referenciaId ? `<code>#${n.referenciaId}</code>` : ''}
                                        </div>
                                    </div>
                                </div>

                                <div style="display:flex; align-items:center; gap:10px; flex-shrink:0;">
                                    <span class="btn btn-sm btn-outline" style="padding:6px 12px; font-size:0.8rem; font-weight:600; display:inline-flex; align-items:center; gap:6px; pointer-events:none; color:#16a34a; border-color:#86efac;">
                                        <span>Ver Estado de Cuenta</span>
                                        <i class="fas fa-arrow-right"></i>
                                    </span>
                                    <button type="button" 
                                            class="btn btn-sm btn-outline" 
                                            onclick="eliminarNotificacion('${n.id}', event)" 
                                            title="Eliminar notificación" 
                                            style="border-radius:50%; width:30px; height:30px; padding:0; display:flex; align-items:center; justify-content:center; color:var(--text-muted);">
                                        <i class="fas fa-xmark"></i>
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
            return;
        }

        // ==========================================
        // VISTA ADMINISTRADOR / GESTIÓN DEL NEGOCIO
        // ==========================================
        const countPagos = lista.filter(n => n.tipo === 'pago').length;
        const countCreditos = lista.filter(n => n.tipo === 'credito').length;
        const countComentarios = lista.filter(n => n.tipo === 'comentario').length;
        const countVentas = lista.filter(n => n.tipo === 'venta').length;

        // Filtrado de la lista
        let listaFiltrada = lista;
        if (filtro === 'no_leidas') {
            listaFiltrada = lista.filter(n => !n.leida);
        } else if (filtro !== 'todas') {
            listaFiltrada = lista.filter(n => n.tipo === filtro);
        }

        // Definición de estilos y badges por tipo
        const configTipos = {
            aprobacion: {
                label: 'Aprobación',
                icon: 'fa-circle-check',
                color: '#16a34a',
                bgBadge: '#dcfce7',
                borderLeft: '#16a34a'
            },
            pago: {
                label: 'Pago / Abono',
                icon: 'fa-hand-holding-dollar',
                color: '#16a34a',
                bgBadge: '#dcfce7',
                borderLeft: '#16a34a'
            },
            credito: {
                label: 'Crédito',
                icon: 'fa-credit-card',
                color: '#d97706',
                bgBadge: '#fef3c7',
                borderLeft: '#d97706'
            },
            comentario: {
                label: 'Comentario',
                icon: 'fa-comment-dots',
                color: '#0284c7',
                bgBadge: '#e0f2fe',
                borderLeft: '#0284c7'
            },
            venta: {
                label: 'Venta / Pedido',
                icon: 'fa-bag-shopping',
                color: '#059669',
                bgBadge: '#d1fae5',
                borderLeft: '#059669'
            },
            inventario: {
                label: 'Inventario / Alerta',
                icon: 'fa-triangle-exclamation',
                color: '#e11d48',
                bgBadge: '#ffe4e6',
                borderLeft: '#e11d48'
            },
            sistema: {
                label: 'Sistema',
                icon: 'fa-bell',
                color: '#64748b',
                bgBadge: '#f1f5f9',
                borderLeft: '#64748b'
            }
        };

        contenedor.innerHTML = `
            <div class="card" style="margin-bottom:18px;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
                    <div>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="display:inline-flex; width:36px; height:36px; border-radius:10px; background:#e0f2fe; color:#0284c7; align-items:center; justify-content:center; font-size:1.15rem;">
                                <i class="fas fa-bell"></i>
                            </span>
                            <div>
                                <h2 style="margin:0; font-size:1.35rem; color:var(--text-main);">Centro de Notificaciones</h2>
                                <small style="color:var(--text-muted);">Registro en vivo de pagos, créditos, comentarios y eventos de tu negocio</small>
                            </div>
                        </div>
                    </div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button type="button" class="btn btn-sm btn-outline" onclick="marcarTodasNotificacionesLeidas()" ${noLeidas === 0 ? 'disabled' : ''}>
                            <i class="fas fa-check-double"></i> Marcar todas como leídas
                        </button>
                        <button type="button" class="btn btn-sm btn-outline" onclick="limpiarNotificacionesLeidas()">
                            <i class="fas fa-trash-can"></i> Limpiar leídas
                        </button>
                        <button type="button" class="btn btn-sm btn-primary" onclick="abrirModalComentarioCliente()">
                            <i class="fas fa-plus"></i> Nuevo Comentario
                        </button>
                    </div>
                </div>

                <!-- Barra de Filtros Rápidos -->
                <div style="display:flex; gap:8px; flex-wrap:wrap; border-top:1px solid var(--border-color); padding-top:14px;">
                    <button type="button" class="btn btn-sm ${filtro === 'todas' ? 'btn-primary' : 'btn-outline'}" onclick="renderizarNotificaciones('todas')">
                        Todas (${total})
                    </button>
                    <button type="button" class="btn btn-sm ${filtro === 'no_leidas' ? 'btn-primary' : 'btn-outline'}" onclick="renderizarNotificaciones('no_leidas')">
                        Pendientes (${noLeidas})
                    </button>
                    <button type="button" class="btn btn-sm ${filtro === 'pago' ? 'btn-primary' : 'btn-outline'}" onclick="renderizarNotificaciones('pago')">
                        <i class="fas fa-hand-holding-dollar" style="color:#16a34a;"></i> Pagos (${countPagos})
                    </button>
                    <button type="button" class="btn btn-sm ${filtro === 'credito' ? 'btn-primary' : 'btn-outline'}" onclick="renderizarNotificaciones('credito')">
                        <i class="fas fa-credit-card" style="color:#d97706;"></i> Créditos (${countCreditos})
                    </button>
                    <button type="button" class="btn btn-sm ${filtro === 'comentario' ? 'btn-primary' : 'btn-outline'}" onclick="renderizarNotificaciones('comentario')">
                        <i class="fas fa-comment-dots" style="color:#0284c7;"></i> Comentarios (${countComentarios})
                    </button>
                    <button type="button" class="btn btn-sm ${filtro === 'venta' ? 'btn-primary' : 'btn-outline'}" onclick="renderizarNotificaciones('venta')">
                        <i class="fas fa-bag-shopping" style="color:#059669;"></i> Ventas (${countVentas})
                    </button>
                </div>
            </div>

            <!-- Listado de Notificaciones Interactivas -->
            <div id="lista-notificaciones-container" style="display:flex; flex-direction:column; gap:10px;">
                ${listaFiltrada.length === 0 ? `
                    <div class="card" style="text-align:center; padding:40px 20px; color:var(--text-muted);">
                        <i class="fas fa-bell-slash" style="font-size:2.8rem; color:var(--border-color); margin-bottom:12px;"></i>
                        <h4 style="margin:0; color:var(--text-main); font-size:1.1rem;">Sin notificaciones en esta categoría</h4>
                        <p style="margin:6px 0 0; font-size:0.88rem;">No hay registros para mostrar con el filtro seleccionado.</p>
                    </div>
                ` : listaFiltrada.map(n => {
                    const cfg = configTipos[n.tipo] || configTipos.sistema;
                    const tiempoRel = formatearTiempoRelativo(n.timestamp);
                    const noLeidaClase = !n.leida ? 'background:#f8fafc; font-weight:600;' : 'background:var(--bg-card);';
                    
                    return `
                        <div class="card notificacion-card-item" 
                             onclick="irANotificacion('${n.id}')"
                             style="margin:0; padding:14px 18px; cursor:pointer; border-left:4px solid ${cfg.borderLeft}; transition:all 0.18s ease; ${noLeidaClase} position:relative; box-shadow:0 1px 4px rgba(0,0,0,0.04); display:flex; justify-content:space-between; align-items:center; gap:14px;"
                             onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.08)';"
                             onmouseout="this.style.transform='none'; this.style.boxShadow='0 1px 4px rgba(0,0,0,0.04)';">
                            
                            <div style="display:flex; align-items:flex-start; gap:14px; flex:1;">
                                <div style="width:40px; height:40px; border-radius:10px; background:${cfg.bgBadge}; color:${cfg.color}; display:flex; align-items:center; justify-content:center; font-size:1.15rem; flex-shrink:0; margin-top:2px;">
                                    <i class="fas ${cfg.icon}"></i>
                                </div>
                                <div style="flex:1;">
                                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;">
                                        <span style="background:${cfg.bgBadge}; color:${cfg.color}; font-size:0.72rem; font-weight:700; padding:2px 8px; border-radius:12px; text-transform:uppercase;">
                                            ${cfg.label}
                                        </span>
                                        <span style="font-size:0.8rem; color:var(--text-muted);">
                                            <i class="fas fa-clock" style="font-size:0.75rem; margin-right:3px;"></i> ${tiempoRel} • ${n.fecha}
                                        </span>
                                        ${!n.leida ? `<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#ef4444;" title="No leída"></span>` : ''}
                                    </div>
                                    <div style="font-size:0.95rem; color:var(--text-main); margin-bottom:4px; line-height:1.4;">
                                        ${n.mensaje}
                                    </div>
                                    <div style="display:flex; align-items:center; gap:12px; font-size:0.8rem; color:var(--text-muted); flex-wrap:wrap;">
                                        ${n.clienteNombre ? `<span><i class="fas fa-user" style="margin-right:4px;"></i> ${n.clienteNombre}</span>` : ''}
                                        ${(n.esDivisasUSD || String(n.mensaje || '').includes('divisas'))
                                            ? `<span style="color:var(--primary-accent); font-weight:700;">$${Number(n.montoUSD || 0).toFixed(2)} USD</span>`
                                            : `<span style="color:#16a34a; font-weight:700;">Bs. ${Number(n.montoVES || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>`}
                                        ${n.referenciaId ? `<code>#${n.referenciaId}</code>` : ''}
                                    </div>
                                </div>
                            </div>

                            <div style="display:flex; align-items:center; gap:10px; flex-shrink:0;">
                                <span class="btn btn-sm btn-outline" style="padding:6px 12px; font-size:0.8rem; font-weight:600; display:inline-flex; align-items:center; gap:6px; pointer-events:none;">
                                    <span>Ir al sitio</span>
                                    <i class="fas fa-arrow-right"></i>
                                </span>
                                <button type="button" 
                                        class="btn btn-sm btn-outline" 
                                        onclick="eliminarNotificacion('${n.id}', event)" 
                                        title="Eliminar notificación" 
                                        style="border-radius:50%; width:30px; height:30px; padding:0; display:flex; align-items:center; justify-content:center; color:var(--text-muted);">
                                    <i class="fas fa-xmark"></i>
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    // Exponer globalmente
    window.InventoryApp = window.InventoryApp || {};
    window.InventoryApp.Notifications = {
        registrar: registrarNotificacion,
        marcarLeida: marcarNotificacionLeida,
        marcarTodasLeidas: marcarTodasNotificacionesLeidas,
        eliminar: eliminarNotificacion,
        limpiarLeidas: limpiarNotificacionesLeidas,
        render: renderizarNotificaciones,
        actualizarBadges: actualizarBadgesNotificaciones,
        generarIniciales: generarNotificacionesInicialesSiVacio
    };

    window.registrarNotificacion = registrarNotificacion;
    window.marcarNotificacionLeida = marcarNotificacionLeida;
    window.marcarTodasNotificacionesLeidas = marcarTodasNotificacionesLeidas;
    window.eliminarNotificacion = eliminarNotificacion;
    window.limpiarNotificacionesLeidas = limpiarNotificacionesLeidas;
    window.irANotificacion = irANotificacion;
    window.renderizarNotificaciones = renderizarNotificaciones;
    window.actualizarBadgesNotificaciones = actualizarBadgesNotificaciones;

})();
