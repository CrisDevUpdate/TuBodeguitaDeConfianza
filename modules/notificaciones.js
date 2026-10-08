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
    /**
     * Retorna exclusivamente las notificaciones permitidas para el usuario en sesión activa.
     * Regla estricta del sistema:
     * "Los clientes sólo deben llegarles la notificación que el admin aprobó su transacción,
     * no todas las notificaciones que le llegan al admin"
     */
    function obtenerNotificacionesParaUsuarioActual(incluirOcultas = false) {
        const usuario = window.AppState?.usuarioActual;
        if (!usuario) return [];
        limpiarNotificacionesDuplicadas();
        const lista = Array.isArray(AppState.notificaciones) ? AppState.notificaciones : [];
        let resultado = [];

        if (esUsuarioAdmin()) {
            // El administrador ve las notificaciones de gestión (pagos reportados, ventas, créditos, auditorías, etc.) y avisos enviados a clientes
            resultado = lista;
        } else if (esUsuarioCliente()) {
            const miCedula = String(usuario.cedula || usuario.id || '').trim().toLowerCase();
            const miNombre = String(usuario.nombre || '').trim().toLowerCase();

            resultado = lista.filter(n => {
                const notifClienteId = String(n.id_cliente || n.clienteId || n.clienteCedula || '').trim().toLowerCase();
                const notifClienteNom = String(n.clienteNombre || '').trim().toLowerCase();
                const esMio = (notifClienteId && notifClienteId === miCedula) || 
                              (notifClienteNom && notifClienteNom === miNombre);

                if (!esMio) return false;

                // 1. Notificaciones In-App dirigidas a este cliente (avisos, recordatorios, promociones)
                if (n.tipo_destinatario === 'CLIENTE' || n.tipo === 'cliente_inapp' || n.tipo === 'aviso_cliente' || (n.paraCliente === true && n.tipo !== 'aprobacion')) {
                    return true;
                }

                // 2. Debe ser estrictamente una notificación de aprobación de su transacción
                const esAprobacion = n.tipo === 'aprobacion' || 
                                     n.subTipo === 'aprobacion_admin' || 
                                     n.tipo === 'pago_aprobado' ||
                                     (String(n.titulo || '').toLowerCase().includes('aprobad') && !String(n.titulo || '').toLowerCase().includes('pendiente')) ||
                                     (String(n.mensaje || '').toLowerCase().includes('aprobó') || String(n.mensaje || '').toLowerCase().includes('aprobado') || String(n.mensaje || '').toLowerCase().includes('conciliado'));

                // Excluir cualquier alerta administrativa interna
                const esAlertaAdmin = n.tipo === 'credito' || 
                                      n.tipo === 'inventario' || 
                                      n.tipo === 'sistema' ||
                                      n.tipo === 'comentario' ||
                                      String(n.titulo || '').toLowerCase().includes('reportado') ||
                                      String(n.titulo || '').toLowerCase().includes('pendiente') ||
                                      String(n.titulo || '').toLowerCase().includes('nuevo pago');

                return esAprobacion && !esAlertaAdmin;
            });
        } else {
            // Otros roles (vendedores)
            resultado = lista.filter(n => n.paraCliente !== true);
        }

        // Deduplicación estricta para garantizar que nunca se listen 2 notificaciones por la misma transacción o pago
        const clavesVistas = new Set();
        const listaDeduplicada = [];

        for (const notif of resultado) {
            const refUnica = notif.referenciaId || notif.pagoId || notif.transaccionId;
            let clave = notif.id;
            if (refUnica && (notif.tipo === 'pago' || notif.tipo === 'aprobacion')) {
                clave = `${notif.tipo}_${refUnica}`;
            } else if (notif.clienteId && Number(notif.montoUSD || 0) > 0 && notif.tipo === 'pago') {
                const minKey = String(notif.fecha || '').substring(0, 16);
                clave = `pago_${notif.clienteId}_${Number(notif.montoUSD).toFixed(2)}_${minKey}`;
            }

            if (clavesVistas.has(clave)) {
                continue;
            }
            clavesVistas.add(clave);
            listaDeduplicada.push(notif);
        }

        // Si se solicita la vista de archivo en BD, retorna únicamente las que fueron eliminadas/ocultas en la app
        if (incluirOcultas) {
            return listaDeduplicada.filter(n => n.eliminada === true || n.oculta === true);
        }

        // Por regla general del sistema: Las notificaciones eliminadas/ocultas NO se muestran en la app,
        // pero permanecen 100% conservadas y almacenadas en la base de datos
        return listaDeduplicada.filter(n => !n.eliminada && !n.oculta);
    }

    /**
     * Limpia notificaciones duplicadas existentes en AppState.notificaciones
     */
    function limpiarNotificacionesDuplicadas() {
        if (!Array.isArray(AppState.notificaciones) || AppState.notificaciones.length === 0) return;
        const vistas = new Set();
        const depuradas = [];

        for (const n of AppState.notificaciones) {
            const refUnica = n.referenciaId || n.pagoId || n.transaccionId;
            let clave = n.id;
            if (refUnica && (n.tipo === 'pago' || n.tipo === 'aprobacion')) {
                clave = `${n.tipo}_${refUnica}`;
            } else if (n.clienteId && Number(n.montoUSD || 0) > 0 && n.tipo === 'pago') {
                const minKey = String(n.fecha || '').substring(0, 16);
                clave = `pago_${n.clienteId}_${Number(n.montoUSD).toFixed(2)}_${minKey}`;
            }

            if (!vistas.has(clave)) {
                vistas.add(clave);
                depuradas.push(n);
            }
        }

        if (depuradas.length !== AppState.notificaciones.length) {
            AppState.notificaciones = depuradas;
            if (window.InventoryApp?.Persistence?.guardar) {
                window.InventoryApp.Persistence.guardar(true);
            }
        }
    }

    /**
     * Registra una nueva notificación en el sistema y sincroniza
     */
    function registrarNotificacion(datos) {
        if (!datos || !datos.mensaje) return;

        if (!Array.isArray(AppState.notificaciones)) {
            AppState.notificaciones = [];
        }

        const idCli = datos.id_cliente || datos.clienteId || null;
        const esClienteDest = datos.tipo_destinatario === 'CLIENTE' || datos.paraCliente === true || (!datos.paraAdmin && Boolean(idCli) && datos.tipo === 'cliente_inapp');
        const tipoDest = datos.tipo_destinatario || (esClienteDest ? 'CLIENTE' : 'ADMIN');
        const esAprob = datos.tipo === 'aprobacion' || datos.subTipo === 'aprobacion_admin';
        const prioridadVal = String(datos.prioridad || (datos.tipo === 'pago' ? 'PAGO' : (datos.tipo === 'inventario' ? 'URGENTE' : 'INFO'))).toUpperCase();
        const leidoVal = datos.leido !== undefined ? Boolean(datos.leido) : (datos.leida !== undefined ? Boolean(datos.leida) : false);

        const nuevaNotif = {
            id: datos.id || ('notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
            tipo_destinatario: tipoDest, // 'ADMIN' o 'CLIENTE'
            id_cliente: idCli,           // ID o Cédula del cliente (obligatorio si CLIENTE)
            clienteId: idCli,            // retrocompatibilidad
            clienteNombre: datos.clienteNombre || null,
            leido: leidoVal,             // booleano requerido
            leida: leidoVal,             // retrocompatibilidad
            prioridad: prioridadVal,     // 'INFO', 'PAGO' o 'URGENTE'
            tipoAviso: datos.tipoAviso || datos.tipo_aviso || (prioridadVal === 'PAGO' ? 'Recordatorio de Pago' : 'Aviso General'),
            tipo: datos.tipo || (tipoDest === 'CLIENTE' ? 'cliente_inapp' : (esAprob ? 'aprobacion' : 'sistema')),
            subTipo: datos.subTipo || (esAprob ? 'aprobacion_admin' : (tipoDest === 'CLIENTE' ? 'aviso_admin' : null)),
            titulo: datos.titulo || (tipoDest === 'CLIENTE' ? 'Aviso de la Tienda' : (esAprob ? 'Transacción Aprobada' : 'Notificación del Sistema')),
            mensaje: datos.mensaje,
            emisor: datos.emisor || (esUsuarioAdmin() ? (AppState.usuarioActual?.nombre || 'Administración') : 'Sistema'),
            montoUSD: Number(datos.montoUSD || 0),
            montoVES: Number(datos.montoVES || 0),
            esDivisasUSD: Boolean(datos.esDivisasUSD),
            referenciaId: datos.referenciaId || null,
            pagoId: datos.pagoId || datos.referenciaId || null,
            transaccionId: datos.transaccionId || null,
            estadoPago: datos.estadoPago || null,
            fecha: datos.fecha || new Date().toISOString().replace('T', ' ').substring(0, 16),
            timestamp: datos.timestamp || Date.now(),
            paraCliente: tipoDest === 'CLIENTE' || Boolean(datos.paraCliente),
            paraAdmin: tipoDest === 'ADMIN' || Boolean(datos.paraAdmin),
            destino: datos.destino || (tipoDest === 'CLIENTE' ? { tab: 'cliente-cuenta' } : (esAprob ? { tab: 'cliente-cuenta' } : { tab: 'pos' })),
            eliminada: false,
            oculta: false
        };

        // Evitar duplicados idénticos: buscar si ya existe notificación para este pago/abono/transacción
        const refBuscar = nuevaNotif.referenciaId || nuevaNotif.pagoId || nuevaNotif.transaccionId;
        const yaExisteIdx = AppState.notificaciones.findIndex(n => {
            if (refBuscar) {
                const nRef = n.referenciaId || n.pagoId || n.transaccionId;
                if (nRef && nRef === refBuscar && (n.tipo === nuevaNotif.tipo || nuevaNotif.tipo === 'pago')) {
                    return true;
                }
            }
            if (n.mensaje === nuevaNotif.mensaje && Math.abs(n.timestamp - nuevaNotif.timestamp) < 60000) {
                return true;
            }
            if (nuevaNotif.clienteId && n.clienteId === nuevaNotif.clienteId &&
                Math.abs(Number(n.montoUSD || 0) - Number(nuevaNotif.montoUSD || 0)) < 0.01 &&
                Math.abs(n.timestamp - nuevaNotif.timestamp) < 60000 &&
                n.tipo === nuevaNotif.tipo) {
                return true;
            }
            return false;
        });

        if (yaExisteIdx >= 0) {
            // Actualizar notificación existente en vez de crear una segunda duplicada
            AppState.notificaciones[yaExisteIdx] = {
                ...AppState.notificaciones[yaExisteIdx],
                ...nuevaNotif,
                id: AppState.notificaciones[yaExisteIdx].id // preservar ID original
            };
            if (window.InventoryApp?.Persistence?.guardar) {
                window.InventoryApp.Persistence.guardar(true);
            }
            actualizarBadgesNotificaciones();
            const vista = document.getElementById('notificaciones');
            if (vista && vista.classList.contains('active')) {
                renderizarNotificaciones(filtroActivo);
            }
            return;
        }

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
        if (notif && (!notif.leida || !notif.leido)) {
            notif.leida = true;
            notif.leido = true;
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
            n.leido = true;
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
     * Elimina una notificación de la vista de la app sin borrarla de la base de datos
     */
    function eliminarNotificacion(id, event) {
        if (event) event.stopPropagation();
        if (!Array.isArray(AppState.notificaciones)) return;
        const notif = AppState.notificaciones.find(n => n.id === id);
        if (notif) {
            notif.eliminada = true;
            notif.oculta = true;
            notif.fechaEliminada = new Date().toISOString();
        }

        if (window.InventoryApp?.Persistence?.guardar) {
            window.InventoryApp.Persistence.guardar(true);
        }
        if (window.InventoryApp?.Firebase?.ocultarNotificacion) {
            window.InventoryApp.Firebase.ocultarNotificacion(id).catch(() => {});
        } else if (window.InventoryApp?.Firebase?.guardarNotificacion && notif) {
            window.InventoryApp.Firebase.guardarNotificacion(notif).catch(() => {});
        }

        actualizarBadgesNotificaciones();
        renderizarNotificaciones(filtroActivo);

        if (window.InventoryApp?.Modal?.toast) {
            window.InventoryApp.Modal.toast('Notificación eliminada de la vista (conservada en la base de datos)', 'info');
        }
    }

    /**
     * Limpia todas las notificaciones que ya fueron leídas del usuario actual,
     * quitándolas de la vista de la app pero manteniéndolas almacenadas en la base de datos.
     */
    function limpiarNotificacionesLeidas() {
        if (!Array.isArray(AppState.notificaciones)) return;
        const listaUsuario = obtenerNotificacionesParaUsuarioActual(false);
        const leidas = listaUsuario.filter(n => n.leida);
        if (leidas.length === 0) {
            if (window.InventoryApp?.Modal?.toast) {
                window.InventoryApp.Modal.toast('No hay notificaciones leídas pendientes por limpiar', 'info');
            }
            return;
        }

        const ahoraIso = new Date().toISOString();
        leidas.forEach(n => {
            n.eliminada = true;
            n.oculta = true;
            n.fechaEliminada = ahoraIso;
            if (window.InventoryApp?.Firebase?.ocultarNotificacion) {
                window.InventoryApp.Firebase.ocultarNotificacion(n.id).catch(() => {});
            } else if (window.InventoryApp?.Firebase?.guardarNotificacion) {
                window.InventoryApp.Firebase.guardarNotificacion(n).catch(() => {});
            }
        });

        if (window.InventoryApp?.Persistence?.guardar) {
            window.InventoryApp.Persistence.guardar(true);
        }

        actualizarBadgesNotificaciones();
        renderizarNotificaciones(filtroActivo);

        if (window.InventoryApp?.Modal?.toast) {
            window.InventoryApp.Modal.toast(`Se quitaron ${leidas.length} notificación(es) leída(s) de la vista (conservadas en BD)`, 'info');
        }
    }

    /**
     * Restaura una notificación previamente eliminada de la vista para que vuelva a mostrarse en la app
     */
    function restaurarNotificacion(id, event) {
        if (event) event.stopPropagation();
        if (!Array.isArray(AppState.notificaciones)) return;
        const notif = AppState.notificaciones.find(n => n.id === id);
        if (!notif) return;

        notif.eliminada = false;
        notif.oculta = false;
        delete notif.fechaEliminada;

        if (window.InventoryApp?.Persistence?.guardar) {
            window.InventoryApp.Persistence.guardar(true);
        }
        if (window.InventoryApp?.Firebase?.guardarNotificacion) {
            window.InventoryApp.Firebase.guardarNotificacion(notif).catch(() => {});
        }

        actualizarBadgesNotificaciones();
        renderizarNotificaciones(filtroActivo);

        if (window.InventoryApp?.Modal?.toast) {
            window.InventoryApp.Modal.toast('Notificación restaurada a la vista de la app', 'success');
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
                const inputFiltro = document.getElementById('historial-filtro-cliente');
                if (inputFiltro && idRef) {
                    inputFiltro.value = idRef;
                    if (typeof window.filtrarHistorialGeneralPorCliente === 'function') {
                        window.filtrarHistorialGeneralPorCliente(idRef);
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
     * =========================================================================
     * PANEL ADMINISTRATIVO: ENVÍO DE NOTIFICACIONES IN-APP DIRIGIDAS A CLIENTES
     * =========================================================================
     */

    /**
     * Abre el modal del Administrador para redactar y emitir una notificación dirigida a un cliente
     */
    function abrirModalEnviarNotificacionCliente(clienteIdPreseleccionado = null) {
        let modal = document.getElementById('modal-enviar-notificacion-cliente');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-enviar-notificacion-cliente';
            modal.className = 'modal-overlay';
            modal.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(0,0,0,0.65); z-index:99999; align-items:center; justify-content:center; padding:16px; backdrop-filter:blur(3px);';
            modal.innerHTML = `
                <div class="card" style="width:100%; max-width:560px; padding:0; overflow:hidden; border-radius:14px; box-shadow:0 25px 30px -5px rgba(0,0,0,0.35); background:var(--bg-card);">
                    <div style="padding:16px 20px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; background:var(--bg-card);">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="display:inline-flex; width:34px; height:34px; border-radius:8px; background:#e0f2fe; color:#0284c7; align-items:center; justify-content:center; font-size:1.1rem;">
                                <i class="fas fa-paper-plane"></i>
                            </span>
                            <div>
                                <h3 style="margin:0; font-size:1.15rem; color:var(--text-main);">Enviar Notificación In-App a Cliente</h3>
                                <small style="color:var(--text-muted); font-size:0.78rem;">El cliente recibirá este aviso en pantalla de forma prominente al abrir la app</small>
                            </div>
                        </div>
                        <button type="button" class="btn btn-sm btn-outline" onclick="cerrarModalEnviarNotificacionCliente()" title="Cerrar (X)" style="border-radius:50%; width:32px; height:32px; padding:0; display:flex; align-items:center; justify-content:center;">
                            <i class="fas fa-xmark"></i>
                        </button>
                    </div>
                    
                    <form onsubmit="enviarNotificacionACliente(event)" style="padding:20px; max-height:80vh; overflow-y:auto;">
                        <!-- 1. Buscador y Selector de Cliente -->
                        <div class="form-group" style="margin-bottom:14px;">
                            <label style="font-weight:700; font-size:0.85rem; display:block; margin-bottom:6px; color:var(--text-main);">
                                Cliente Destinatario <span style="color:#ef4444;">*</span>
                            </label>
                            <input type="text" id="notif-form-buscar-cliente" class="form-control" placeholder="🔍 Filtrar por nombre o cédula..." style="margin-bottom:8px; font-size:0.88rem;" oninput="filtrarOpcionesClientesNotif(this.value)">
                            <select id="notif-form-select-cliente" class="form-control" required style="font-size:0.88rem; font-weight:600;" onchange="actualizarInfoClienteSeleccionadoNotif(this.value)">
                                <option value="">-- Selecciona un cliente --</option>
                            </select>
                            <div id="notif-form-cliente-kpi" style="margin-top:6px; font-size:0.8rem; display:none; padding:8px 12px; border-radius:8px; background:var(--bg-main); border:1px solid var(--border-color);"></div>
                        </div>

                        <!-- 2. Prioridad y Tipo de Aviso -->
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
                            <div class="form-group">
                                <label style="font-weight:700; font-size:0.85rem; display:block; margin-bottom:6px; color:var(--text-main);">
                                    Prioridad <span style="color:#ef4444;">*</span>
                                </label>
                                <select id="notif-form-prioridad" class="form-control" required style="font-size:0.88rem;">
                                    <option value="INFO">🟢 INFO (Informativa)</option>
                                    <option value="PAGO">🟡 PAGO (Recordatorio)</option>
                                    <option value="URGENTE">🔴 URGENTE (Prioritaria)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label style="font-weight:700; font-size:0.85rem; display:block; margin-bottom:6px; color:var(--text-main);">
                                    Tipo de Aviso
                                </label>
                                <select id="notif-form-tipo-aviso" class="form-control" style="font-size:0.88rem;" onchange="sugerirPlantillaPorTipoAviso(this.value)">
                                    <option value="Recordatorio de Pago">Recordatorio de Pago</option>
                                    <option value="Promoción">Promoción / Oferta</option>
                                    <option value="Aviso General">Aviso General</option>
                                    <option value="Estado de Cuenta">Estado de Cuenta</option>
                                </select>
                            </div>
                        </div>

                        <!-- 3. Botones de Plantillas Rápidas -->
                        <div style="margin-bottom:14px;">
                            <label style="font-size:0.8rem; font-weight:600; color:var(--text-muted); display:block; margin-bottom:6px;">
                                <i class="fas fa-bolt" style="color:#f59e0b;"></i> Plantillas rápidas de redacción:
                            </label>
                            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                                <button type="button" class="btn btn-sm btn-outline" onclick="aplicarPlantillaNotificacion('pago')" style="font-size:0.75rem; padding:3px 8px;">
                                    💳 Cobro / Pago
                                </button>
                                <button type="button" class="btn btn-sm btn-outline" onclick="aplicarPlantillaNotificacion('promocion')" style="font-size:0.75rem; padding:3px 8px;">
                                    🏷️ Promoción
                                </button>
                                <button type="button" class="btn btn-sm btn-outline" onclick="aplicarPlantillaNotificacion('aviso')" style="font-size:0.75rem; padding:3px 8px;">
                                    📢 Comunicado
                                </button>
                                <button type="button" class="btn btn-sm btn-outline" onclick="aplicarPlantillaNotificacion('urgente')" style="font-size:0.75rem; padding:3px 8px; color:#ef4444; border-color:#fca5a5;">
                                    ⚠️ Urgente
                                </button>
                            </div>
                        </div>

                        <!-- 4. Título -->
                        <div class="form-group" style="margin-bottom:14px;">
                            <label style="font-weight:700; font-size:0.85rem; display:block; margin-bottom:6px; color:var(--text-main);">
                                Título de la Alerta <span style="color:#ef4444;">*</span>
                            </label>
                            <input type="text" id="notif-form-titulo" class="form-control" placeholder="Ej: Recordatorio de Pago Pendiente" required style="font-size:0.9rem; font-weight:600;">
                        </div>

                        <!-- 5. Cuerpo del Mensaje -->
                        <div class="form-group" style="margin-bottom:16px;">
                            <label style="font-weight:700; font-size:0.85rem; display:block; margin-bottom:6px; color:var(--text-main);">
                                Mensaje a Mostrar en Pantalla <span style="color:#ef4444;">*</span>
                            </label>
                            <textarea id="notif-form-mensaje" class="form-control" rows="4" placeholder="Escribe el mensaje que el cliente leerá al abrir su pantalla..." required style="width:100%; font-size:0.9rem; line-height:1.5; padding:10px; border-radius:8px;"></textarea>
                        </div>

                        <!-- Botones de Acción -->
                        <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid var(--border-color); padding-top:14px;">
                            <button type="button" class="btn btn-outline" onclick="cerrarModalEnviarNotificacionCliente()">Cancelar</button>
                            <button type="submit" class="btn btn-primary" id="btn-enviar-notif-cliente-submit" style="font-weight:700;">
                                <i class="fas fa-paper-plane"></i> Emitir Notificación
                            </button>
                        </div>
                    </form>
                </div>
            `;
            document.body.appendChild(modal);

            // Cerrar al hacer clic en el backdrop fuera de la tarjeta
            modal.addEventListener('click', (ev) => {
                if (ev.target === modal) cerrarModalEnviarNotificacionCliente();
            });
        }

        poblarSelectClientesNotif(clienteIdPreseleccionado);
        modal.style.display = 'flex';
    }

    /**
     * Cierra el modal de envío de notificación a cliente
     */
    function cerrarModalEnviarNotificacionCliente() {
        const modal = document.getElementById('modal-enviar-notificacion-cliente');
        if (modal) modal.style.display = 'none';
    }

    /**
     * Llena el selector de clientes en el formulario
     */
    function poblarSelectClientesNotif(preseleccionado = null) {
        const select = document.getElementById('notif-form-select-cliente');
        if (!select) return;

        const clientes = Array.isArray(AppState.clientes) ? AppState.clientes : [];
        const clientesOrdenados = [...clientes].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

        select.innerHTML = '<option value="">-- Selecciona un cliente destinatario --</option>';

        clientesOrdenados.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            const deudaUSD = Number(c.deudaUSD || 0);
            const deudaStr = deudaUSD > 0.01 ? ` [Deuda: $${deudaUSD.toFixed(2)}]` : ' [Solvente]';
            opt.textContent = `${c.nombre} (C.I. ${c.id})${deudaStr}`;
            if (preseleccionado && String(c.id).toUpperCase() === String(preseleccionado).toUpperCase()) {
                opt.selected = true;
            }
            select.appendChild(opt);
        });

        if (preseleccionado) {
            actualizarInfoClienteSeleccionadoNotif(preseleccionado);
            aplicarPlantillaNotificacion('pago');
        } else {
            const kpi = document.getElementById('notif-form-cliente-kpi');
            if (kpi) kpi.style.display = 'none';
        }
    }

    /**
     * Filtra dinámicamente las opciones del selector de cliente según la búsqueda
     */
    function filtrarOpcionesClientesNotif(query) {
        const select = document.getElementById('notif-form-select-cliente');
        if (!select) return;
        const q = String(query || '').trim().toLowerCase();
        const opts = select.querySelectorAll('option');
        let primeroVisible = null;

        opts.forEach((opt, idx) => {
            if (idx === 0) return;
            const txt = opt.textContent.toLowerCase();
            const coincide = !q || txt.includes(q);
            opt.style.display = coincide ? '' : 'none';
            if (coincide && !primeroVisible) primeroVisible = opt;
        });

        if (q && primeroVisible) {
            select.value = primeroVisible.value;
            actualizarInfoClienteSeleccionadoNotif(primeroVisible.value);
        }
    }

    /**
     * Muestra resumen del cliente seleccionado (nombre, cédula y deuda actual)
     */
    function actualizarInfoClienteSeleccionadoNotif(clienteId) {
        const kpi = document.getElementById('notif-form-cliente-kpi');
        if (!kpi) return;
        if (!clienteId) {
            kpi.style.display = 'none';
            return;
        }

        const cliente = (AppState.clientes || []).find(c => String(c.id).toUpperCase() === String(clienteId).toUpperCase());
        if (!cliente) {
            kpi.style.display = 'none';
            return;
        }

        const tasa = AppState.tasaActiva || AppState.tasaUSD_BCV || 1;
        let saldoDeudaUSD = 0;
        if (typeof calcularEstadoFinancieroCliente === 'function') {
            const est = calcularEstadoFinancieroCliente(cliente.id);
            saldoDeudaUSD = Number(est?.saldoDeudaUSD || 0);
        } else {
            saldoDeudaUSD = Number(cliente.deudaUSD || 0);
        }
        const saldoDeudaVES = saldoDeudaUSD * tasa;

        kpi.style.display = 'block';
        kpi.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
                <div>
                    <strong><i class="fas fa-user-check" style="color:#0284c7; margin-right:4px;"></i> ${cliente.nombre}</strong>
                    <span style="color:var(--text-muted); font-size:0.75rem;">(C.I. ${cliente.id})</span>
                </div>
                <div>
                    <span style="font-weight:700; color:${saldoDeudaUSD > 0.01 ? '#b45309' : '#16a34a'};">
                        ${saldoDeudaUSD > 0.01 ? `Deuda: $${saldoDeudaUSD.toFixed(2)} USD (Bs. ${saldoDeudaVES.toLocaleString('es-VE', {minimumFractionDigits:2})})` : 'Solvente ($0.00)'}
                    </span>
                </div>
            </div>
        `;
    }

    /**
     * Aplica plantillas de texto predefinidas para redactar más rápido
     */
    function aplicarPlantillaNotificacion(tipo) {
        const selectCliente = document.getElementById('notif-form-select-cliente');
        const selectPrioridad = document.getElementById('notif-form-prioridad');
        const selectTipoAviso = document.getElementById('notif-form-tipo-aviso');
        const inputTitulo = document.getElementById('notif-form-titulo');
        const textareaMensaje = document.getElementById('notif-form-mensaje');

        const clienteId = selectCliente?.value;
        const cliente = clienteId ? (AppState.clientes || []).find(c => String(c.id).toUpperCase() === String(clienteId).toUpperCase()) : null;
        const nombreCliente = cliente ? cliente.nombre : 'Cliente';
        const tasa = AppState.tasaActiva || AppState.tasaUSD_BCV || 1;
        let deudaUSD = 0;
        if (typeof calcularEstadoFinancieroCliente === 'function' && cliente) {
            deudaUSD = Number(calcularEstadoFinancieroCliente(cliente.id)?.saldoDeudaUSD || 0);
        } else if (cliente) {
            deudaUSD = Number(cliente.deudaUSD || 0);
        }
        const deudaVES = (deudaUSD * tasa).toLocaleString('es-VE', { minimumFractionDigits: 2 });

        if (tipo === 'pago') {
            if (selectPrioridad) selectPrioridad.value = 'PAGO';
            if (selectTipoAviso) selectTipoAviso.value = 'Recordatorio de Pago';
            if (inputTitulo) inputTitulo.value = 'Recordatorio de Pago Pendiente';
            if (textareaMensaje) {
                textareaMensaje.value = `Estimado(a) ${nombreCliente}, te saludamos cordialmente desde Tu Bodeguita de Confianza. Te recordamos que cuentas con un saldo pendiente de $${deudaUSD.toFixed(2)} USD (Bs. ${deudaVES}). Agradecemos conciliar tu abono vía Pago Móvil o en nuestra tienda para mantener tu crédito activo. ¡Muchas gracias por tu puntualidad!`;
            }
        } else if (tipo === 'promocion') {
            if (selectPrioridad) selectPrioridad.value = 'INFO';
            if (selectTipoAviso) selectTipoAviso.value = 'Promoción';
            if (inputTitulo) inputTitulo.value = '¡Nuevas Ofertas y Promociones en Tu Bodeguita!';
            if (textareaMensaje) {
                textareaMensaje.value = `¡Hola ${nombreCliente}! Queremos invitarte a conocer nuestras nuevas ofertas y combos especiales disponibles esta semana. Pasa por nuestra tienda y aprovecha los mejores precios. ¡Te esperamos!`;
            }
        } else if (tipo === 'aviso') {
            if (selectPrioridad) selectPrioridad.value = 'INFO';
            if (selectTipoAviso) selectTipoAviso.value = 'Aviso General';
            if (inputTitulo) inputTitulo.value = 'Aviso Importante para Nuestros Clientes';
            if (textareaMensaje) {
                textareaMensaje.value = `Estimado(a) ${nombreCliente}, te informamos que ahora puedes consultar tu estado de cuenta actualizado, verificar tus abonos y revisar promociones directamente desde nuestra aplicación. ¡Estamos a tu completa orden!`;
            }
        } else if (tipo === 'urgente') {
            if (selectPrioridad) selectPrioridad.value = 'URGENTE';
            if (selectTipoAviso) selectTipoAviso.value = 'Recordatorio de Pago';
            if (inputTitulo) inputTitulo.value = 'Urgente: Regularización de Cuenta Requerida';
            if (textareaMensaje) {
                textareaMensaje.value = `Estimado(a) ${nombreCliente}, nos comunicamos para solicitarte regularizar a la brevedad tu saldo deudor pendiente de $${deudaUSD.toFixed(2)} USD en Tu Bodeguita de Confianza para evitar la suspensión temporal del beneficio de fiado. Agradecemos contactarnos pronto.`;
            }
        }
    }

    function sugerirPlantillaPorTipoAviso(tipoAviso) {
        if (tipoAviso === 'Recordatorio de Pago' || tipoAviso === 'Estado de Cuenta') {
            aplicarPlantillaNotificacion('pago');
        } else if (tipoAviso === 'Promoción') {
            aplicarPlantillaNotificacion('promocion');
        } else if (tipoAviso === 'Aviso General') {
            aplicarPlantillaNotificacion('aviso');
        }
    }

    /**
     * Procesa el formulario del Administrador y emite la notificación dirigida al cliente
     */
    function enviarNotificacionACliente(e) {
        if (e && e.preventDefault) e.preventDefault();

        const selectCliente = document.getElementById('notif-form-select-cliente');
        const selectPrioridad = document.getElementById('notif-form-prioridad');
        const selectTipoAviso = document.getElementById('notif-form-tipo-aviso');
        const inputTitulo = document.getElementById('notif-form-titulo');
        const textareaMensaje = document.getElementById('notif-form-mensaje');
        const btnSubmit = document.getElementById('btn-enviar-notif-cliente-submit');

        const clienteId = selectCliente ? selectCliente.value.trim() : '';
        const prioridad = selectPrioridad ? selectPrioridad.value : 'INFO';
        const tipoAviso = selectTipoAviso ? selectTipoAviso.value : 'Aviso General';
        const titulo = inputTitulo ? inputTitulo.value.trim() : '';
        const mensaje = textareaMensaje ? textareaMensaje.value.trim() : '';

        if (!clienteId) {
            alert('Por favor selecciona el cliente destinatario de la notificación.');
            if (selectCliente) selectCliente.focus();
            return false;
        }

        if (!titulo || !mensaje) {
            alert('El título y el cuerpo del mensaje son obligatorios.');
            if (!titulo && inputTitulo) inputTitulo.focus();
            else if (textareaMensaje) textareaMensaje.focus();
            return false;
        }

        const cliente = (AppState.clientes || []).find(c => String(c.id).toUpperCase() === String(clienteId).toUpperCase());
        const clienteNombre = cliente ? cliente.nombre : clienteId;

        const tasa = AppState.tasaActiva || AppState.tasaUSD_BCV || 1;
        let deudaUSD = 0;
        if (typeof calcularEstadoFinancieroCliente === 'function' && cliente) {
            deudaUSD = Number(calcularEstadoFinancieroCliente(cliente.id)?.saldoDeudaUSD || 0);
        } else if (cliente) {
            deudaUSD = Number(cliente.deudaUSD || 0);
        }
        const deudaVES = deudaUSD * tasa;

        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Emitiendo...';
        }

        try {
            registrarNotificacion({
                tipo_destinatario: 'CLIENTE',
                id_cliente: clienteId,
                clienteId: clienteId,
                clienteNombre: clienteNombre,
                tipo: 'cliente_inapp',
                subTipo: 'aviso_admin',
                tipoAviso: tipoAviso,
                prioridad: prioridad,
                titulo: titulo,
                mensaje: mensaje,
                leido: false,
                leida: false,
                paraCliente: true,
                paraAdmin: true,
                montoUSD: deudaUSD,
                montoVES: deudaVES,
                emisor: AppState.usuarioActual?.nombre || 'Administración'
            });

            cerrarModalEnviarNotificacionCliente();

            if (window.InventoryApp?.Modal?.toast) {
                window.InventoryApp.Modal.toast(`Notificación in-app emitida exitosamente a ${clienteNombre}`, 'success');
            } else {
                alert(`Notificación in-app emitida exitosamente a ${clienteNombre}`);
            }

            const vista = document.getElementById('notificaciones');
            if (vista && vista.classList.contains('active')) {
                renderizarNotificaciones(filtroActivo);
            }
        } finally {
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = '<i class="fas fa-paper-plane"></i> Emitir Notificación';
            }
        }
        return false;
    }

    /**
     * =========================================================================
     * INTERFAZ Y LÓGICA DEL CLIENTE: RECEPCIÓN IN-APP PROMINENTE Y ACTUALIZACIÓN
     * =========================================================================
     */

    /**
     * Consulta las notificaciones pendientes dirigidas a un cliente específico
     */
    async function consultarNotificacionesPendientesCliente(clienteId) {
        if (!clienteId) return [];
        const cId = String(clienteId).trim().toLowerCase();

        // 1. Si Firebase está disponible, consultar en Firestore
        if (window.InventoryApp?.Firebase?.consultarNotificacionesPendientesCliente) {
            try {
                const remotas = await window.InventoryApp.Firebase.consultarNotificacionesPendientesCliente(clienteId);
                if (Array.isArray(remotas) && remotas.length > 0) {
                    if (!Array.isArray(AppState.notificaciones)) AppState.notificaciones = [];
                    remotas.forEach(r => {
                        const idx = AppState.notificaciones.findIndex(n => n.id === r.id);
                        if (idx >= 0) {
                            AppState.notificaciones[idx] = { ...AppState.notificaciones[idx], ...r };
                        } else {
                            AppState.notificaciones.unshift(r);
                        }
                    });
                }
            } catch (err) {
                console.warn('[Notificaciones] Error en consulta remota:', err);
            }
        }

        // 2. Filtrar pendientes en AppState.notificaciones
        const lista = Array.isArray(AppState.notificaciones) ? AppState.notificaciones : [];
        const pendientes = lista.filter(n => {
            const notifCliId = String(n.id_cliente || n.clienteId || n.clienteCedula || '').trim().toLowerCase();
            const esMio = (notifCliId === cId);
            const noLeido = (n.leido === false || n.leida === false);
            const esDirigida = n.tipo_destinatario === 'CLIENTE' || n.tipo === 'cliente_inapp' || n.tipo === 'aviso_cliente' || n.paraCliente === true;
            return esMio && noLeido && esDirigida && !n.eliminada && !n.oculta;
        });

        // Ordenar por prioridad (URGENTE > PAGO > INFO) y fecha descendente
        const pesos = { URGENTE: 3, PAGO: 2, INFO: 1 };
        pendientes.sort((a, b) => {
            const pA = pesos[String(a.prioridad || '').toUpperCase()] || 1;
            const pB = pesos[String(b.prioridad || '').toUpperCase()] || 1;
            if (pA !== pB) return pB - pA;
            return (b.timestamp || 0) - (a.timestamp || 0);
        });

        return pendientes;
    }

    /**
     * Revisa al iniciar sesión o cargar la app si el cliente tiene notificaciones in-app
     * pendientes y las presenta de forma prominente en pantalla.
     */
    let _notifInAppEnCurso = false;
    async function verificarYMostrarNotificacionesPendientesCliente(usuario) {
        if (!usuario) usuario = window.AppState?.usuarioActual;
        if (!usuario || _notifInAppEnCurso) return;

        const rol = String(usuario.rol || '').trim().toLowerCase();
        const idDoc = String(usuario.cedula || usuario.id || '').trim();
        if (rol === 'admin' || rol === 'superadmin' || idDoc === 'SuperAdmin') return;

        try {
            _notifInAppEnCurso = true;
            const pendientes = await consultarNotificacionesPendientesCliente(idDoc);
            if (pendientes && pendientes.length > 0) {
                mostrarModalNotificacionInAppCliente(pendientes, 0);
            }
        } finally {
            _notifInAppEnCurso = false;
        }
    }

    /**
     * Muestra el modal prominente in-app para el cliente
     */
    function mostrarModalNotificacionInAppCliente(listaNotificaciones, indice = 0) {
        if (!Array.isArray(listaNotificaciones) || listaNotificaciones.length === 0) return;
        if (indice >= listaNotificaciones.length) {
            cerrarModalNotificacionInAppCliente();
            return;
        }

        const notif = listaNotificaciones[indice];
        const total = listaNotificaciones.length;

        let modal = document.getElementById('modal-notificacion-inapp-cliente');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-notificacion-inapp-cliente';
            modal.className = 'modal-overlay';
            modal.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:999999; align-items:center; justify-content:center; padding:16px; backdrop-filter:blur(4px);';
            document.body.appendChild(modal);

            // Click fuera de la tarjeta cierra el modal
            modal.addEventListener('click', (e) => {
                if (e.target === modal) cerrarModalNotificacionInAppCliente();
            });
        }

        const prioridad = String(notif.prioridad || 'INFO').toUpperCase();
        let configPrioridad = {
            badgeColor: '#0284c7',
            badgeBg: '#e0f2fe',
            badgeIcon: 'fa-circle-info',
            badgeLabel: notif.tipoAviso || 'INFORMACIÓN',
            borderColor: '#38bdf8'
        };

        if (prioridad === 'URGENTE') {
            configPrioridad = {
                badgeColor: '#dc2626',
                badgeBg: '#fee2e2',
                badgeIcon: 'fa-triangle-exclamation',
                badgeLabel: 'URGENTE',
                borderColor: '#ef4444'
            };
        } else if (prioridad === 'PAGO') {
            configPrioridad = {
                badgeColor: '#b45309',
                badgeBg: '#fef3c7',
                badgeIcon: 'fa-hand-holding-dollar',
                badgeLabel: 'RECORDATORIO DE PAGO',
                borderColor: '#f59e0b'
            };
        }

        // Obtener saldo del cliente si es aviso de pago
        let bloqueSaldoHtml = '';
        if (prioridad === 'PAGO' || (notif.tipoAviso || '').toLowerCase().includes('pago')) {
            const usuarioSesion = window.AppState?.usuarioActual;
            const cId = usuarioSesion ? (usuarioSesion.cedula || usuarioSesion.id) : notif.id_cliente;
            const cliente = (AppState.clientes || []).find(c => String(c.id).toUpperCase() === String(cId).toUpperCase());
            const tasa = AppState.tasaActiva || AppState.tasaUSD_BCV || 1;
            let deudaUSD = 0;
            if (typeof calcularEstadoFinancieroCliente === 'function' && cliente) {
                const est = calcularEstadoFinancieroCliente(cliente.id);
                deudaUSD = Number(est?.saldoDeudaUSD || 0);
            } else if (cliente) {
                deudaUSD = Number(cliente.deudaUSD || 0);
            } else if (notif.montoUSD > 0) {
                deudaUSD = Number(notif.montoUSD);
            }
            const deudaVES = deudaUSD * tasa;

            if (deudaUSD > 0.01) {
                bloqueSaldoHtml = `
                    <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:12px 16px; margin:14px 0; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                        <div>
                            <span style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:#92400e; display:block;">Tu Saldo Pendiente Actual:</span>
                            <span style="font-size:1.15rem; font-weight:800; color:#b45309;">$${deudaUSD.toFixed(2)} USD</span>
                            <span style="font-size:0.85rem; font-weight:600; color:#78350f; margin-left:4px;">(Bs. ${deudaVES.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})})</span>
                        </div>
                        <button type="button" class="btn btn-sm btn-primary" onclick="irAEstadoCuentaDesdeInApp('${notif.id}', ${indice}, ${total})" style="font-weight:700; font-size:0.8rem;">
                            <i class="fas fa-file-invoice-dollar"></i> Ver Mi Cuenta
                        </button>
                    </div>
                `;
            }
        }

        modal.innerHTML = `
            <div class="card" style="width:100%; max-width:520px; padding:0; overflow:hidden; border-radius:14px; box-shadow:0 25px 35px -5px rgba(0,0,0,0.4); border-top:5px solid ${configPrioridad.borderColor}; background:var(--bg-card); animation:modalInAppScale 0.22s ease-out;">
                <!-- Cabecera -->
                <div style="padding:16px 20px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; background:var(--bg-card);">
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <span style="background:${configPrioridad.badgeBg}; color:${configPrioridad.badgeColor}; font-size:0.75rem; font-weight:800; padding:3px 10px; border-radius:14px; text-transform:uppercase; display:inline-flex; align-items:center; gap:5px;">
                            <i class="fas ${configPrioridad.badgeIcon}"></i> ${configPrioridad.badgeLabel}
                        </span>
                        ${total > 1 ? `<span style="font-size:0.75rem; color:var(--text-muted); background:var(--bg-main); padding:2px 8px; border-radius:10px; font-weight:600;">Aviso ${indice + 1} de ${total}</span>` : ''}
                    </div>
                    <button type="button" class="btn btn-sm btn-outline" onclick="cerrarModalNotificacionInAppCliente()" title="Cerrar (X)" style="border-radius:50%; width:32px; height:32px; padding:0; display:flex; align-items:center; justify-content:center;">
                        <i class="fas fa-xmark"></i>
                    </button>
                </div>

                <!-- Contenido -->
                <div style="padding:22px 20px;">
                    <h3 style="margin:0 0 6px; font-size:1.25rem; color:var(--text-main); font-weight:800; line-height:1.3;">
                        ${notif.titulo}
                    </h3>
                    <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:14px; display:flex; align-items:center; gap:6px;">
                        <i class="fas fa-store" style="color:var(--primary-accent);"></i>
                        <span>Tu Bodeguita de Confianza</span> • <span>${notif.fecha}</span>
                    </div>

                    <div style="background:var(--bg-main); border:1px solid var(--border-color); border-radius:10px; padding:16px; font-size:0.95rem; line-height:1.6; color:var(--text-main); white-space:pre-wrap; word-break:break-word;">
${notif.mensaje}
                    </div>

                    ${bloqueSaldoHtml}
                </div>

                <!-- Pie de Acciones -->
                <div style="padding:14px 20px; border-top:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; background:var(--bg-card); flex-wrap:wrap; gap:8px;">
                    <button type="button" class="btn btn-sm btn-outline" onclick="cerrarModalNotificacionInAppCliente()">
                        Cerrar
                    </button>
                    <button type="button" class="btn btn-primary" onclick="aceptarYMarcarLeidaNotificacionInApp('${notif.id}', ${indice}, ${total})" style="font-weight:700; padding:8px 18px; font-size:0.9rem;">
                        <i class="fas fa-check"></i> ${indice + 1 < total ? 'Aceptar y Siguiente' : 'Aceptar / Marcar como leído'}
                    </button>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
    }

    /**
     * Cierra el modal de notificación in-app del cliente
     */
    function cerrarModalNotificacionInAppCliente() {
        const modal = document.getElementById('modal-notificacion-inapp-cliente');
        if (modal) modal.style.display = 'none';
    }

    /**
     * Marca la notificación in-app como leída y avanza a la siguiente si hay más
     */
    async function aceptarYMarcarLeidaNotificacionInApp(notifId, indiceActual, total) {
        marcarNotificacionLeida(notifId, false);
        const usuarioSesion = window.AppState?.usuarioActual;
        const cId = usuarioSesion ? (usuarioSesion.cedula || usuarioSesion.id) : null;
        
        if (cId && indiceActual + 1 < total) {
            const restantes = await consultarNotificacionesPendientesCliente(cId);
            if (restantes && restantes.length > 0) {
                mostrarModalNotificacionInAppCliente(restantes, 0);
                return;
            }
        }
        cerrarModalNotificacionInAppCliente();
        if (window.InventoryApp?.Modal?.toast) {
            window.InventoryApp.Modal.toast('Notificación marcada como leída.', 'info');
        }
    }

    /**
     * Conduce al cliente a su Estado de Cuenta marcando la notificación como leída
     */
    function irAEstadoCuentaDesdeInApp(notifId, indiceActual, total) {
        aceptarYMarcarLeidaNotificacionInApp(notifId, indiceActual, total);
        if (typeof switchTab === 'function') {
            switchTab('cliente-cuenta');
        }
        setTimeout(() => {
            if (typeof renderizarEstadoCuentaCliente === 'function') {
                renderizarEstadoCuentaCliente();
            }
        }, 120);
    }

    // Escuchar tecla Escape para cerrar ambos modales
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            cerrarModalNotificacionInAppCliente();
            cerrarModalEnviarNotificacionCliente();
        }
    });

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

            const esPendiente = a.estado === 'PENDIENTE_CONFIRMACION' || a.estado === 'PENDIENTE' || a.estado === 'Confirmando' || a.estado === 'POR_VERIFICAR';
            const esAprobado = a.estado === 'Pago agregado' || a.estado === 'Confirmado';
            const esRechazado = a.estado === 'RECHAZADO' || a.estado === 'Rechazado';
            const tituloAbono = esPendiente ? 'Transacción por Aprobar' : (esAprobado ? 'Transacción Aprobada' : (esRechazado ? 'Transacción Rechazada' : 'Abono Registrado'));
            const estadoPagoVal = esPendiente ? 'PENDIENTE_VERIFICACION' : (esAprobado ? 'APROBADO' : (esRechazado ? 'RECHAZADO' : 'APROBADO'));
            const msgTexto = esPendiente
                ? `${nombre} registró un pago ${textoMonto} [${metodo}${ref}]. Requiere confirmación.`
                : `${nombre} agregó un pago ${textoMonto} [${metodo}${ref}]`;

            notifs.push({
                id: 'notif_init_abn_' + a.id,
                tipo: 'pago',
                subTipo: esPendiente ? 'pago_pendiente' : null,
                titulo: tituloAbono,
                mensaje: msgTexto,
                clienteId: a.clienteId,
                clienteNombre: nombre,
                montoUSD: montoUSD,
                montoVES: montoVES,
                esDivisasUSD: esDivisa,
                referenciaId: a.id,
                pagoId: a.id,
                transaccionId: a.transaccionId || null,
                estadoPago: estadoPagoVal,
                fecha: a.fecha || new Date().toISOString().replace('T', ' ').substring(0, 16),
                timestamp: isNaN(ts) ? Date.now() : ts,
                leida: !esPendiente,
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

        const esVistaArchivoBD = (filtro === 'eliminadas' || filtro === 'bd_archivo');
        const lista = esVistaArchivoBD 
            ? obtenerNotificacionesParaUsuarioActual(true)
            : obtenerNotificacionesParaUsuarioActual(false);
        const listaOcultasEnBD = obtenerNotificacionesParaUsuarioActual(true);
        const countOcultasEnBD = listaOcultasEnBD.length;
        const total = lista.length;
        const noLeidas = esVistaArchivoBD ? 0 : lista.filter(n => !n.leida).length;

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
                        const esDirigida = n.tipo_destinatario === 'CLIENTE' || n.tipo === 'cliente_inapp' || n.tipo === 'aviso_cliente' || (n.paraCliente && n.tipo !== 'aprobacion');
                        const prioridad = String(n.prioridad || (n.tipo === 'pago' ? 'PAGO' : 'INFO')).toUpperCase();

                        let badgeColor = '#16a34a';
                        let badgeBg = '#dcfce7';
                        let badgeIcon = 'fa-circle-check';
                        let badgeTexto = 'TRANSACCIÓN APROBADA';
                        let borderColor = '#16a34a';

                        if (esDirigida) {
                            if (prioridad === 'URGENTE') {
                                badgeColor = '#dc2626';
                                badgeBg = '#fee2e2';
                                badgeIcon = 'fa-triangle-exclamation';
                                badgeTexto = 'URGENTE';
                                borderColor = '#ef4444';
                            } else if (prioridad === 'PAGO' || (n.tipoAviso || '').toLowerCase().includes('pago')) {
                                badgeColor = '#b45309';
                                badgeBg = '#fef3c7';
                                badgeIcon = 'fa-hand-holding-dollar';
                                badgeTexto = n.tipoAviso || 'RECORDATORIO DE PAGO';
                                borderColor = '#f59e0b';
                            } else {
                                badgeColor = '#0284c7';
                                badgeBg = '#e0f2fe';
                                badgeIcon = 'fa-circle-info';
                                badgeTexto = n.tipoAviso || 'INFORMACIÓN';
                                borderColor = '#38bdf8';
                            }
                        }

                        const noLeidaClase = !n.leida ? `background:var(--bg-card); border-left:4px solid ${borderColor}; font-weight:600;` : `background:var(--bg-card); border-left:4px solid ${borderColor}; opacity:0.85;`;

                        return `
                            <div class="card notificacion-card-item" 
                                 onclick="irANotificacion('${n.id}')"
                                 style="${noLeidaClase}">
                                
                                <div class="notif-item-left-block">
                                    <div class="notif-item-icon-box" style="background:${badgeBg}; color:${badgeColor};">
                                        <i class="fas ${badgeIcon}"></i>
                                    </div>
                                    <div class="notif-item-body">
                                        <div class="notif-item-header-meta">
                                            <span style="background:${badgeBg}; color:${badgeColor}; font-size:0.72rem; font-weight:700; padding:2px 8px; border-radius:12px; text-transform:uppercase;">
                                                <i class="fas ${badgeIcon}" style="font-size:0.68rem; margin-right:3px;"></i> ${badgeTexto}
                                            </span>
                                            <span style="font-size:0.8rem; color:var(--text-muted);">
                                                <i class="fas fa-clock" style="font-size:0.75rem; margin-right:3px;"></i> ${tiempoRel} • ${n.fecha}
                                            </span>
                                            ${!n.leida ? `<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${badgeColor};" title="Nueva / No leída"></span>` : `<span style="font-size:0.72rem; color:var(--text-muted);"><i class="fas fa-check"></i> Leída</span>`}
                                        </div>
                                        ${n.titulo && esDirigida ? `<h4 style="margin:4px 0 2px; font-size:0.95rem; font-weight:800; color:var(--text-main);">${n.titulo}</h4>` : ''}
                                        <div class="notif-item-msg" style="white-space:pre-wrap;">
                                            ${n.mensaje}
                                        </div>
                                        ${(Number(n.montoUSD || 0) > 0 || Number(n.montoVES || 0) > 0) ? `
                                            <div style="display:flex; align-items:center; gap:12px; font-size:0.8rem; color:var(--text-muted); flex-wrap:wrap; margin-top:4px;">
                                                ${(n.esDivisasUSD || String(n.mensaje || '').includes('divisas')) 
                                                    ? `<span style="color:var(--primary-accent); font-weight:700;">$${Number(n.montoUSD || 0).toFixed(2)} USD</span>` 
                                                    : `<span style="color:#16a34a; font-weight:700;">Bs. ${Number(n.montoVES || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>`}
                                                ${n.referenciaId ? `<code>#${n.referenciaId}</code>` : ''}
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>

                                <div class="notif-item-actions-block" onclick="event.stopPropagation();">
                                    ${!n.leida ? `
                                        <button type="button" 
                                                class="btn btn-sm btn-outline" 
                                                onclick="marcarNotificacionLeida('${n.id}'); renderizarNotificaciones(filtroActivo); event.stopPropagation();" 
                                                style="padding:6px 12px; font-size:0.8rem; font-weight:700; color:${badgeColor}; border-color:${borderColor};">
                                            <i class="fas fa-check"></i> <span>Marcar Leída</span>
                                        </button>
                                    ` : ''}
                                    ${(prioridad === 'PAGO' || (n.tipoAviso || '').toLowerCase().includes('pago')) ? `
                                        <button type="button" 
                                                class="btn btn-sm btn-primary" 
                                                onclick="switchTab('cliente-cuenta'); event.stopPropagation();" 
                                                style="padding:6px 12px; font-size:0.8rem; font-weight:700;">
                                            <i class="fas fa-file-invoice-dollar"></i> <span>Mi Cuenta</span>
                                        </button>
                                    ` : ''}
                                    <button type="button" 
                                            class="btn btn-sm btn-outline" 
                                            onclick="eliminarNotificacion('${n.id}', event)" 
                                            title="Eliminar de la vista (se conservará en la base de datos)" 
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
        const countDirigidas = lista.filter(n => n.tipo_destinatario === 'CLIENTE' || n.tipo === 'cliente_inapp' || n.tipo === 'aviso_cliente' || n.paraCliente === true).length;

        // Filtrado de la lista
        let listaFiltrada = lista;
        if (!esVistaArchivoBD) {
            if (filtro === 'no_leidas') {
                listaFiltrada = lista.filter(n => !n.leida);
            } else if (filtro === 'cliente_inapp') {
                listaFiltrada = lista.filter(n => n.tipo_destinatario === 'CLIENTE' || n.tipo === 'cliente_inapp' || n.tipo === 'aviso_cliente' || n.paraCliente === true);
            } else if (filtro !== 'todas') {
                listaFiltrada = lista.filter(n => n.tipo === filtro);
            }
        }

        // Definición de estilos y badges por tipo
        const configTipos = {
            cliente_inapp: {
                label: 'Aviso a Cliente',
                icon: 'fa-paper-plane',
                color: '#0284c7',
                bgBadge: '#e0f2fe',
                borderLeft: '#0284c7'
            },
            aviso_cliente: {
                label: 'Aviso a Cliente',
                icon: 'fa-paper-plane',
                color: '#0284c7',
                bgBadge: '#e0f2fe',
                borderLeft: '#0284c7'
            },
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
                        <button type="button" class="btn btn-sm btn-outline" onclick="limpiarNotificacionesLeidas()" title="Ocultar de la app las notificaciones leídas (se conservan en la base de datos)">
                            <i class="fas fa-trash-can"></i> Limpiar leídas
                        </button>
                        <button type="button" class="btn btn-sm btn-outline" onclick="abrirModalComentarioCliente()">
                            <i class="fas fa-plus"></i> Nuevo Comentario
                        </button>
                        <button type="button" class="btn btn-sm btn-primary" onclick="abrirModalEnviarNotificacionCliente()" style="background:#0284c7; border-color:#0284c7; color:#fff;" title="Enviar notificación in-app dirigida a la pantalla de un cliente">
                            <i class="fas fa-paper-plane"></i> Enviar a Cliente
                        </button>
                    </div>
                </div>

                <!-- Barra de Filtros Rápidos -->
                <div style="display:flex; gap:8px; flex-wrap:wrap; border-top:1px solid var(--border-color); padding-top:14px; align-items:center;">
                    <button type="button" class="btn btn-sm ${filtro === 'todas' ? 'btn-primary' : 'btn-outline'}" onclick="renderizarNotificaciones('todas')">
                        Todas (${total})
                    </button>
                    <button type="button" class="btn btn-sm ${filtro === 'no_leidas' ? 'btn-primary' : 'btn-outline'}" onclick="renderizarNotificaciones('no_leidas')">
                        Pendientes (${noLeidas})
                    </button>
                    <button type="button" class="btn btn-sm ${filtro === 'cliente_inapp' ? 'btn-primary' : 'btn-outline'}" onclick="renderizarNotificaciones('cliente_inapp')">
                        <i class="fas fa-paper-plane" style="color:#0284c7;"></i> A Clientes (${countDirigidas})
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
                    ${countOcultasEnBD > 0 ? `
                        <button type="button" class="btn btn-sm ${esVistaArchivoBD ? 'btn-primary' : 'btn-outline'}" onclick="renderizarNotificaciones('bd_archivo')" title="Notificaciones que fueron eliminadas de la app pero permanecen guardadas en la base de datos">
                            <i class="fas fa-database"></i> En Base de Datos (${countOcultasEnBD})
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- Listado de Notificaciones Interactivas -->
            <div id="lista-notificaciones-container" style="display:flex; flex-direction:column; gap:10px;">
                ${esVistaArchivoBD ? `
                    <div class="card" style="background:#f8fafc; border:1px solid #cbd5e1; padding:12px 16px; margin-bottom:4px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
                        <div style="display:flex; align-items:center; gap:8px; color:#334155; font-size:0.88rem;">
                            <i class="fas fa-database" style="color:#0284c7; font-size:1.15rem;"></i>
                            <span>Estas notificaciones fueron <b>eliminadas de la vista activa de la app</b>, pero están <b>100% conservadas en la base de datos</b>.</span>
                        </div>
                        <span class="badge" style="background:#e0f2fe; color:#0369a1; font-weight:700; padding:4px 10px; border-radius:12px;">${listaFiltrada.length} en base de datos</span>
                    </div>
                ` : ''}
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
                    
                    const refId = n.referenciaId || n.pagoId || n.transaccionId || '';
                    const abonosList = Array.isArray(AppState.abonos) ? AppState.abonos : [];
                    const txList = Array.isArray(AppState.transacciones) ? AppState.transacciones : (window.transacciones || []);
                    const pagosVerifList = Array.isArray(AppState.pagosPorVerificar) ? AppState.pagosPorVerificar : [];

                    const abonoAsoc = abonosList.find(a => a.id === refId || a.transaccionId === refId);
                    const txAsoc = txList.find(t => t.id === refId || t.id === n.transaccionId);
                    const pagoVerifAsoc = pagosVerifList.find(p => p.id === refId || p.abonoId === refId || p.transaccionId === refId || p.pedidoId === refId);

                    let estadoPago = n.estadoPago || null;
                    if (!estadoPago) {
                        if (abonoAsoc) estadoPago = abonoAsoc.estado;
                        else if (pagoVerifAsoc) estadoPago = pagoVerifAsoc.estado;
                        else if (txAsoc) estadoPago = txAsoc.estado;
                    }

                    const esPagoOTransaccion = n.tipo === 'pago' || n.subTipo === 'pago_pendiente' || Boolean(abonoAsoc) || Boolean(pagoVerifAsoc);
                    const esAprobadoPago = estadoPago === 'Pago agregado' || estadoPago === 'APROBADO' || estadoPago === 'Confirmado';
                    const esRechazadoPago = estadoPago === 'RECHAZADO' || estadoPago === 'Rechazado';
                    const esPendientePago = esPagoOTransaccion && !esAprobadoPago && !esRechazadoPago;

                    const esDirigidaACliente = n.tipo_destinatario === 'CLIENTE' || n.tipo === 'cliente_inapp' || n.tipo === 'aviso_cliente' || (n.paraCliente && !n.paraAdmin);
                    const prioridadVal = String(n.prioridad || (n.tipo === 'pago' ? 'PAGO' : 'INFO')).toUpperCase();

                    return `
                        <div class="card notificacion-card-item" 
                             onclick="irANotificacion('${n.id}')"
                             style="border-left:4px solid ${esDirigidaACliente ? (prioridadVal === 'URGENTE' ? '#ef4444' : (prioridadVal === 'PAGO' ? '#f59e0b' : '#38bdf8')) : (esPendientePago ? '#f59e0b' : cfg.borderLeft)}; ${noLeidaClase}">
                            
                            <div class="notif-item-left-block">
                                <div class="notif-item-icon-box" style="background:${esDirigidaACliente ? (prioridadVal === 'URGENTE' ? '#fee2e2' : (prioridadVal === 'PAGO' ? '#fef3c7' : '#e0f2fe')) : (esPendientePago ? '#fef3c7' : cfg.bgBadge)}; color:${esDirigidaACliente ? (prioridadVal === 'URGENTE' ? '#dc2626' : (prioridadVal === 'PAGO' ? '#b45309' : '#0284c7')) : (esPendientePago ? '#d97706' : cfg.color)};">
                                    <i class="fas ${esDirigidaACliente ? (prioridadVal === 'URGENTE' ? 'fa-triangle-exclamation' : (prioridadVal === 'PAGO' ? 'fa-hand-holding-dollar' : 'fa-paper-plane')) : cfg.icon}"></i>
                                </div>
                                <div class="notif-item-body">
                                    <div class="notif-item-header-meta">
                                        ${esDirigidaACliente ? `
                                            <span style="background:${prioridadVal === 'URGENTE' ? '#fee2e2' : (prioridadVal === 'PAGO' ? '#fef3c7' : '#e0f2fe')}; color:${prioridadVal === 'URGENTE' ? '#dc2626' : (prioridadVal === 'PAGO' ? '#b45309' : '#0284c7')}; font-size:0.72rem; font-weight:700; padding:2px 8px; border-radius:12px; text-transform:uppercase; display:inline-flex; align-items:center; gap:4px;">
                                                <i class="fas fa-paper-plane"></i> AVISO IN-APP: ${n.tipoAviso || prioridadVal}
                                            </span>
                                            <span style="background:#f1f5f9; color:#475569; font-size:0.72rem; font-weight:700; padding:2px 8px; border-radius:12px;">
                                                <i class="fas fa-user" style="color:#0284c7;"></i> ${n.clienteNombre || n.id_cliente || n.clienteId || 'Cliente'}
                                            </span>
                                        ` : (esPendientePago ? `
                                            <span style="background:#fef3c7; color:#b45309; font-size:0.72rem; font-weight:700; padding:2px 8px; border-radius:12px; text-transform:uppercase; display:inline-flex; align-items:center; gap:4px;">
                                                <i class="fas fa-hourglass-half"></i> Por Aprobar
                                            </span>
                                        ` : `
                                            <span style="background:${cfg.bgBadge}; color:${cfg.color}; font-size:0.72rem; font-weight:700; padding:2px 8px; border-radius:12px; text-transform:uppercase;">
                                                ${cfg.label}
                                            </span>
                                        `)}
                                        <span style="font-size:0.8rem; color:var(--text-muted);">
                                            <i class="fas fa-clock" style="font-size:0.75rem; margin-right:3px;"></i> ${tiempoRel} • ${n.fecha}
                                        </span>
                                        ${esDirigidaACliente ? (
                                            (n.leido || n.leida) 
                                                ? `<span style="font-size:0.72rem; color:#16a34a; font-weight:700; display:inline-flex; align-items:center; gap:3px;"><i class="fas fa-check-double"></i> Leída</span>` 
                                                : `<span style="font-size:0.72rem; color:#dc2626; font-weight:700; display:inline-flex; align-items:center; gap:3px;"><i class="fas fa-hourglass-start"></i> No vista</span>`
                                        ) : (!n.leida ? `<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#ef4444;" title="No leída"></span>` : '')}
                                    </div>
                                    ${n.titulo ? `<div style="font-size:0.92rem; font-weight:700; margin:4px 0 2px; color:var(--text-main);">${n.titulo}</div>` : ''}
                                    <div class="notif-item-msg" style="white-space:pre-wrap;">
                                        ${n.mensaje}
                                    </div>
                                    <div style="display:flex; align-items:center; gap:12px; font-size:0.8rem; color:var(--text-muted); flex-wrap:wrap; margin-top:4px;">
                                        ${n.clienteNombre && !esDirigidaACliente ? `<span><i class="fas fa-user" style="margin-right:4px;"></i> ${n.clienteNombre}</span>` : ''}
                                        ${(n.esDivisasUSD || String(n.mensaje || '').includes('divisas'))
                                            ? `<span style="color:var(--primary-accent); font-weight:700;">$${Number(n.montoUSD || 0).toFixed(2)} USD</span>`
                                            : (Number(n.montoVES || 0) > 0 ? `<span style="color:#16a34a; font-weight:700;">Bs. ${Number(n.montoVES || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>` : '')}
                                        ${n.referenciaId ? `<code>#${n.referenciaId}</code>` : ''}
                                    </div>
                                </div>
                            </div>

                            <div class="notif-item-actions-block" onclick="event.stopPropagation();">
                                ${esDirigidaACliente ? `
                                    <button type="button" 
                                            class="btn btn-sm btn-outline" 
                                            onclick="abrirModalEnviarNotificacionCliente('${n.id_cliente || n.clienteId}'); event.stopPropagation();" 
                                            title="Enviar otro aviso in-app a este cliente" 
                                            style="padding:6px 12px; font-weight:700; font-size:0.8rem; display:inline-flex; align-items:center; gap:6px; color:#0284c7; border-color:#0284c7;">
                                        <i class="fas fa-paper-plane"></i> <span>Enviar Otro</span>
                                    </button>
                                ` : (esPendientePago ? `
                                    <button type="button" 
                                            class="btn btn-sm btn-outline" 
                                            onclick="irANotificacion('${n.id}'); event.stopPropagation();" 
                                            title="Verificar y gestionar pago en Transacciones" 
                                            style="padding:6px 14px; font-weight:700; font-size:0.82rem; display:inline-flex; align-items:center; gap:6px; color:#0284c7; border-color:#0284c7; background:rgba(2, 132, 199, 0.05); border-radius:6px; cursor:pointer;">
                                        <span>Ver en Transacciones</span>
                                        <i class="fas fa-arrow-right"></i>
                                    </button>
                                ` : (esAprobadoPago ? `
                                    <span class="badge" style="background:#dcfce7; color:#16a34a; font-size:0.75rem; font-weight:700; padding:4px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;">
                                        <i class="fas fa-circle-check"></i> Aprobado
                                    </span>
                                    <span class="btn btn-sm btn-outline" style="padding:5px 10px; font-size:0.75rem; font-weight:600; display:inline-flex; align-items:center; gap:4px; pointer-events:none;">
                                        <span>Conciliado</span>
                                    </span>
                                ` : (esRechazadoPago ? `
                                    <span class="badge" style="background:#fee2e2; color:#dc2626; font-size:0.75rem; font-weight:700; padding:4px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;">
                                        <i class="fas fa-circle-xmark"></i> Rechazado
                                    </span>
                                ` : `
                                    <span class="btn btn-sm btn-outline" style="padding:6px 12px; font-size:0.8rem; font-weight:600; display:inline-flex; align-items:center; gap:6px; pointer-events:none;">
                                        <span>Ir al sitio</span>
                                        <i class="fas fa-arrow-right"></i>
                                    </span>
                                `)))}
                                ${esVistaArchivoBD ? `
                                    <button type="button" 
                                            class="btn btn-sm btn-outline" 
                                            onclick="restaurarNotificacion('${n.id}', event)" 
                                            title="Restaurar a la vista activa de la app" 
                                            style="padding:5px 10px; font-size:0.75rem; font-weight:600; display:inline-flex; align-items:center; gap:4px; color:#0284c7; border-color:#0284c7;">
                                        <i class="fas fa-rotate-left"></i> <span>Restaurar</span>
                                    </button>
                                ` : `
                                    <button type="button" 
                                            class="btn btn-sm btn-outline" 
                                            onclick="eliminarNotificacion('${n.id}', event)" 
                                            title="Eliminar de la vista (se conservará en la base de datos)" 
                                            style="border-radius:50%; width:30px; height:30px; padding:0; display:flex; align-items:center; justify-content:center; color:var(--text-muted);">
                                        <i class="fas fa-xmark"></i>
                                    </button>
                                `}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    /**
     * Permite aprobar directamente una transacción de pago desde la notificación
     */
    async function aprobarPagoDesdeNotificacion(notifId, refId, event) {
        if (event) event.stopPropagation();
        const notif = (AppState.notificaciones || []).find(n => n.id === notifId);
        const targetId = refId || notif?.referenciaId || notif?.pagoId || notif?.transaccionId;

        if (!targetId) {
            if (window.InventoryApp?.Modal?.toast) {
                window.InventoryApp.Modal.toast('No se encontró el identificador del pago a procesar.', 'warning');
            }
            return;
        }

        try {
            if (typeof window.aprobarPagoOVerificacionUnificado === 'function') {
                await window.aprobarPagoOVerificacionUnificado(targetId);
            } else if (typeof window.aprobarAbonoReportadoAdmin === 'function') {
                await window.aprobarAbonoReportadoAdmin(targetId);
            }
        } catch (e) {
            console.error('Error al aprobar desde notificación:', e);
        }

        if (notif) {
            notif.estadoPago = 'APROBADO';
            notif.leida = true;
            notif.titulo = 'Transacción Aprobada';
        }

        if (window.InventoryApp?.Persistence?.guardar) {
            window.InventoryApp.Persistence.guardar(true);
        }

        actualizarBadgesNotificaciones();
        renderizarNotificaciones(filtroActivo);
    }
    window.aprobarPagoDesdeNotificacion = aprobarPagoDesdeNotificacion;

    /**
     * Permite rechazar directamente una transacción de pago desde la notificación
     */
    async function rechazarPagoDesdeNotificacion(notifId, refId, event) {
        if (event) event.stopPropagation();
        const notif = (AppState.notificaciones || []).find(n => n.id === notifId);
        const targetId = refId || notif?.referenciaId || notif?.pagoId || notif?.transaccionId;

        if (!targetId) {
            if (window.InventoryApp?.Modal?.toast) {
                window.InventoryApp.Modal.toast('No se encontró el identificador del pago.', 'warning');
            }
            return;
        }

        try {
            if (typeof window.rechazarPagoOVerificacionUnificado === 'function') {
                await window.rechazarPagoOVerificacionUnificado(targetId);
            } else if (typeof window.rechazarAbonoReportadoAdmin === 'function') {
                await window.rechazarAbonoReportadoAdmin(targetId);
            }
        } catch (e) {
            console.error('Error al rechazar desde notificación:', e);
        }

        if (notif) {
            notif.estadoPago = 'RECHAZADO';
            notif.leida = true;
            notif.titulo = 'Transacción Rechazada';
        }

        if (window.InventoryApp?.Persistence?.guardar) {
            window.InventoryApp.Persistence.guardar(true);
        }

        actualizarBadgesNotificaciones();
        renderizarNotificaciones(filtroActivo);
    }
    window.rechazarPagoDesdeNotificacion = rechazarPagoDesdeNotificacion;

    // Exponer globalmente
    window.InventoryApp = window.InventoryApp || {};
    window.InventoryApp.Notifications = {
        registrar: registrarNotificacion,
        marcarLeida: marcarNotificacionLeida,
        marcarTodasLeidas: marcarTodasNotificacionesLeidas,
        eliminar: eliminarNotificacion,
        restaurar: restaurarNotificacion,
        limpiarLeidas: limpiarNotificacionesLeidas,
        render: renderizarNotificaciones,
        actualizarBadges: actualizarBadgesNotificaciones,
        generarIniciales: generarNotificacionesInicialesSiVacio,
        aprobarDesdeNotificacion: aprobarPagoDesdeNotificacion,
        rechazarDesdeNotificacion: rechazarPagoDesdeNotificacion,
        abrirModalEnviar: abrirModalEnviarNotificacionCliente,
        cerrarModalEnviar: cerrarModalEnviarNotificacionCliente,
        enviarACliente: enviarNotificacionACliente,
        verificarPendientesCliente: verificarYMostrarNotificacionesPendientesCliente,
        consultarPendientesCliente: consultarNotificacionesPendientesCliente,
        mostrarModalInApp: mostrarModalNotificacionInAppCliente,
        cerrarModalInApp: cerrarModalNotificacionInAppCliente
    };

    window.registrarNotificacion = registrarNotificacion;
    window.marcarNotificacionLeida = marcarNotificacionLeida;
    window.marcarTodasNotificacionesLeidas = marcarTodasNotificacionesLeidas;
    window.eliminarNotificacion = eliminarNotificacion;
    window.restaurarNotificacion = restaurarNotificacion;
    window.limpiarNotificacionesLeidas = limpiarNotificacionesLeidas;
    window.irANotificacion = irANotificacion;
    window.renderizarNotificaciones = renderizarNotificaciones;
    window.actualizarBadgesNotificaciones = actualizarBadgesNotificaciones;

    // Métodos para Notificaciones In-App Dirigidas a Clientes
    window.abrirModalEnviarNotificacionCliente = abrirModalEnviarNotificacionCliente;
    window.cerrarModalEnviarNotificacionCliente = cerrarModalEnviarNotificacionCliente;
    window.enviarNotificacionACliente = enviarNotificacionACliente;
    window.filtrarOpcionesClientesNotif = filtrarOpcionesClientesNotif;
    window.actualizarInfoClienteSeleccionadoNotif = actualizarInfoClienteSeleccionadoNotif;
    window.aplicarPlantillaNotificacion = aplicarPlantillaNotificacion;
    window.sugerirPlantillaPorTipoAviso = sugerirPlantillaPorTipoAviso;
    window.verificarYMostrarNotificacionesPendientesCliente = verificarYMostrarNotificacionesPendientesCliente;
    window.consultarNotificacionesPendientesCliente = consultarNotificacionesPendientesCliente;
    window.mostrarModalNotificacionInAppCliente = mostrarModalNotificacionInAppCliente;
    window.cerrarModalNotificacionInAppCliente = cerrarModalNotificacionInAppCliente;
    window.aceptarYMarcarLeidaNotificacionInApp = aceptarYMarcarLeidaNotificacionInApp;
    window.irAEstadoCuentaDesdeInApp = irAEstadoCuentaDesdeInApp;

})();
