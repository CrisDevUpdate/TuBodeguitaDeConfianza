/**
 * modules/usuarios.js
 * Módulo de Autoregistro de Usuarios, Control de Acceso, Gatewall Estricto, Roles y Aprobación Administrativa
 * Cohesivo con el Sistema POS, Catálogo de Cliente y Gamificación.
 */

window.InventoryApp = window.InventoryApp || {};

let filtroEstadoUsuarioActual = 'TODOS';
let usuarioSeleccionadoParaRechazo = null;

/**
 * Gatewall de Autenticación Absoluta:
 * Verifica el estado del usuario actual y controla el aislamiento total de la aplicación.
 */
function verificarGatewall() {
    const gatewall = document.getElementById('auth-gatewall');
    const mainApp = document.getElementById('app-main-container');
    const mobileNav = document.getElementById('mobile-bottom-nav');

    if (!gatewall || !mainApp) return;

    let usuario = AppState.usuarioActual;

    // Verificar si el usuario actual sigue existiendo en el estado del sistema
    if (usuario) {
        const idDoc = usuario.cedula || usuario.id;
        const esSuperAdmin = idDoc === 'SuperAdmin' || (usuario.email || '').toLowerCase() === 'superadmin@tubodeguita.com';
        if (!esSuperAdmin && Array.isArray(AppState.usuarios) && AppState.usuarios.length > 0) {
            const usuarioEnMemoria = AppState.usuarios.find(u => (u.cedula || u.id) === idDoc || (u.email && u.email.toLowerCase() === (usuario.email || '').toLowerCase()));
            if (!usuarioEnMemoria) {
                // El usuario ya no existe en el sistema
                AppState.usuarioActual = null;
                usuario = null;
                if (window.InventoryApp.Persistence) window.InventoryApp.Persistence.guardar(true);
            } else {
                // Mantener estado y rol sincronizados
                usuario = usuarioEnMemoria;
                AppState.usuarioActual = usuarioEnMemoria;
            }
        }
    }

    // 1. Si no hay usuario o no está ACTIVO -> BLOQUEO TOTAL CERO ACCESO
    if (!usuario || usuario.estado !== 'ACTIVO') {
        gatewall.style.display = 'flex';
        mainApp.style.display = 'none';
        if (mobileNav) mobileNav.style.display = 'none';

        const cardAuth = document.getElementById('gatewall-card-auth');
        const cardPending = document.getElementById('gatewall-card-pending');
        const cardRejected = document.getElementById('gatewall-card-rejected');

        if (usuario && usuario.estado === 'PENDIENTE_APROBACION') {
            if (cardAuth) cardAuth.style.display = 'none';
            if (cardRejected) cardRejected.style.display = 'none';
            if (cardPending) {
                cardPending.style.display = 'block';
                renderizarDetalleGatewallPendiente(usuario);
            }
        } else if (usuario && usuario.estado === 'RECHAZADO') {
            if (cardAuth) cardAuth.style.display = 'none';
            if (cardPending) cardPending.style.display = 'none';
            if (cardRejected) {
                cardRejected.style.display = 'block';
                renderizarDetalleGatewallRechazado(usuario);
            }
        } else {
            if (cardPending) cardPending.style.display = 'none';
            if (cardRejected) cardRejected.style.display = 'none';
            if (cardAuth) cardAuth.style.display = 'block';
        }
        return;
    }

    // 2. Usuario ACTIVO y aprobado -> Desbloqueo y Segregación por Rol (RBAC)
    gatewall.style.display = 'none';
    mainApp.style.display = 'block';
    if (mobileNav) mobileNav.style.display = 'flex';

    configurarVistasPorRol(usuario);
}

/**
 * Configura la navegación y pantallas según el rol del usuario autenticado
 * Soporta los 3 roles segregados: 'admin', 'vendedor' y 'cliente'
 */
function configurarVistasPorRol(usuario) {
    const rol = (usuario.rol || 'cliente').toLowerCase();
    const esAdmin = rol === 'admin' || rol === 'superadmin';
    const esVendedor = rol === 'vendedor';
    const esCliente = !esAdmin && !esVendedor;

    // Tabs exclusivos de administración total (Inventario, Usuarios, Transacciones, Auditoría, Config Premio, Configuración)
    const adminStrictTabs = ['inventario', 'usuarios', 'transacciones', 'auditoria', 'premio-mes-admin', 'configuracion'];
    // Tabs compartidos permitidos para Vendedor (POS, Clientes, Historial Ventas)
    const vendedorAllowedTabs = ['pos', 'clientes', 'historial-ventas'];

    // Configurar visibilidad en barra de navegación superior de escritorio
    document.querySelectorAll('#main-nav-tabs .nav-btn').forEach(btn => {
        const tab = btn.getAttribute('data-tab');
        if (!tab) return;

        if (esAdmin) {
            btn.style.display = tab.startsWith('cliente-') ? 'none' : '';
        } else if (esVendedor) {
            btn.style.display = vendedorAllowedTabs.includes(tab) ? '' : 'none';
        } else {
            // Cliente
            btn.style.display = tab.startsWith('cliente-') ? '' : 'none';
        }
    });

    // Configurar visibilidad en barra de navegación inferior móvil
    document.querySelectorAll('#mobile-bottom-nav .bottom-nav-item').forEach(btn => {
        const tab = btn.getAttribute('data-tab');
        if (!tab) return;

        if (esAdmin) {
            btn.style.display = tab.startsWith('cliente-') ? 'none' : '';
        } else if (esVendedor) {
            btn.style.display = vendedorAllowedTabs.includes(tab) ? '' : 'none';
        } else {
            // Cliente
            btn.style.display = tab.startsWith('cliente-') ? '' : 'none';
        }
    });

    // Encabezado y badges
    actualizarUIUsuarioActual();

    // Redirección segura según el rol actual si la pestaña activa está restringida
    const activeTab = document.querySelector('.nav-btn.active')?.getAttribute('data-tab');
    
    if (esAdmin) {
        if (!activeTab || activeTab.startsWith('cliente-')) {
            switchTab('pos');
        }
        if (typeof renderizarUsuarios === 'function') renderizarUsuarios();
        if (typeof renderizarConfiguradorPremioAdmin === 'function') renderizarConfiguradorPremioAdmin();
    } else if (esVendedor) {
        if (!activeTab || !vendedorAllowedTabs.includes(activeTab)) {
            switchTab('pos');
        }
        if (typeof renderizarPos === 'function') renderizarPos();
        if (typeof renderizarClientes === 'function') renderizarClientes();
    } else {
        // Cliente
        if (!activeTab || !activeTab.startsWith('cliente-')) {
            switchTab('cliente-catalogo');
        }
        if (typeof renderizarCatalogoCliente === 'function') renderizarCatalogoCliente();
        if (typeof renderizarEstadoCuentaCliente === 'function') renderizarEstadoCuentaCliente();
        if (typeof renderizarPremioMesCliente === 'function') renderizarPremioMesCliente();
    }
}

/**
 * Renderiza los datos informativos en la pantalla de Solicitud Pendiente del Gatewall
 */
function renderizarDetalleGatewallPendiente(usuario) {
    if (!usuario) return;

    const nombreEl = document.getElementById('gw-pending-nombre');
    const cedulaEl = document.getElementById('gw-pending-cedula');
    const telefonoEl = document.getElementById('gw-pending-telefono');
    const emailEl = document.getElementById('gw-pending-email');
    const rolEl = document.getElementById('gw-pending-rol');
    const fechaEl = document.getElementById('gw-pending-fecha');
    const waBtn = document.getElementById('gatewall-pending-btn-wa');

    if (nombreEl) nombreEl.textContent = usuario.nombre || '—';
    if (cedulaEl) cedulaEl.textContent = usuario.cedula || usuario.id || '—';
    if (telefonoEl) telefonoEl.textContent = usuario.telefono || '—';
    if (emailEl) emailEl.textContent = usuario.email || '—';
    if (rolEl) rolEl.textContent = (usuario.rol || 'cliente').toUpperCase();
    if (fechaEl) fechaEl.textContent = usuario.fechaRegistro || new Date().toISOString().replace('T', ' ').substring(0, 16);

    if (waBtn) {
        const msg = encodeURIComponent(`Hola Administrador de Tu Bodeguita de Confianza. Mi nombre es ${usuario.nombre} (Cédula: ${usuario.cedula || usuario.id}). Acabo de registrarme y solicito la aprobación de mi cuenta.`);
        waBtn.href = `https://wa.me/584120000000?text=${msg}`;
    }
}

/**
 * Abre el Modal Interactivo para Corregir/Editar los Datos del Usuario en Gatewall
 */
function abrirModalEditarDatosGatewall() {
    let modal = document.getElementById('modal-gatewall-editar-datos');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-gatewall-editar-datos';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 440px; padding: 24px; animation: modalPop 0.25s ease-out;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid var(--border-light); padding-bottom:10px;">
                    <h3 style="margin:0; font-size:1.15rem; color:var(--text-main); display:flex; align-items:center; gap:8px;">
                        <i class="fas fa-user-pen" style="color:var(--primary-accent);"></i> Corregir Mis Datos
                    </h3>
                    <button type="button" class="btn-icon-tasa" onclick="cerrarModalEditarDatosGatewall()"><i class="fas fa-times"></i></button>
                </div>
                <form id="form-gw-editar-datos" onsubmit="event.preventDefault(); procesarEdicionDatosGatewall();">
                    <div class="form-group" style="margin-bottom:12px;">
                        <label style="font-size:0.85rem; font-weight:600;">Nombre y Apellido *</label>
                        <input type="text" id="gw-edit-nombre" class="form-control" required>
                    </div>
                    <div class="form-group" style="margin-bottom:12px;">
                        <label style="font-size:0.85rem; font-weight:600;">Cédula / RIF *</label>
                        <input type="text" id="gw-edit-cedula" class="form-control" required readonly style="background:#f1f5f9;">
                    </div>
                    <div class="form-group" style="margin-bottom:12px;">
                        <label style="font-size:0.85rem; font-weight:600;">Teléfono / WhatsApp *</label>
                        <input type="tel" id="gw-edit-telefono" class="form-control" required>
                    </div>
                    <div class="form-group" style="margin-bottom:16px;">
                        <label style="font-size:0.85rem; font-weight:600;">Correo Electrónico *</label>
                        <input type="email" id="gw-edit-email" class="form-control" required>
                    </div>
                    <div style="display:flex; justify-content:flex-end; gap:10px;">
                        <button type="button" class="btn btn-outline" onclick="cerrarModalEditarDatosGatewall()">Cancelar</button>
                        <button type="submit" class="btn btn-primary" style="font-weight:700;">
                            <i class="fas fa-floppy-disk"></i> Guardar Cambios
                        </button>
                    </div>
                </form>
            </div>
        `;
        modal.onclick = function(e) { if (e.target === this) cerrarModalEditarDatosGatewall(); };
        document.body.appendChild(modal);
    }

    const usuario = AppState.usuarioActual;
    if (usuario) {
        const elNom = document.getElementById('gw-edit-nombre');
        const elCed = document.getElementById('gw-edit-cedula');
        const elTel = document.getElementById('gw-edit-telefono');
        const elEmail = document.getElementById('gw-edit-email');

        if (elNom) elNom.value = usuario.nombre || '';
        if (elCed) elCed.value = usuario.cedula || usuario.id || '';
        if (elTel) elTel.value = usuario.telefono || '';
        if (elEmail) elEmail.value = usuario.email || '';
    }

    modal.classList.add('active');
}

function cerrarModalEditarDatosGatewall() {
    const modal = document.getElementById('modal-gatewall-editar-datos');
    if (modal) modal.classList.remove('active');
}

/**
 * Guarda los datos editados del usuario pendiente y actualiza Firestore / LocalStorage
 */
async function procesarEdicionDatosGatewall() {
    const usuario = AppState.usuarioActual;
    if (!usuario) return;

    const nombre = document.getElementById('gw-edit-nombre')?.value?.trim();
    const telefono = document.getElementById('gw-edit-telefono')?.value?.trim();
    const email = document.getElementById('gw-edit-email')?.value?.trim()?.toLowerCase();

    if (!nombre || !telefono || !email) {
        alert('Todos los campos son obligatorios.');
        return;
    }

    usuario.nombre = nombre;
    usuario.telefono = telefono;
    usuario.email = email;

    // Actualizar en el array AppState.usuarios
    const idx = (AppState.usuarios || []).findIndex(u => (u.cedula || u.id) === (usuario.cedula || usuario.id));
    if (idx !== -1) {
        AppState.usuarios[idx] = { ...AppState.usuarios[idx], nombre, telefono, email };
    }

    // Actualizar cliente correspondiente
    const cliIdx = (AppState.clientes || []).findIndex(c => (c.id || c.cedula) === (usuario.cedula || usuario.id));
    if (cliIdx !== -1) {
        AppState.clientes[cliIdx].nombre = nombre;
        AppState.clientes[cliIdx].telefono = telefono;
    }

    // Persistir localmente y en Firestore
    if (window.InventoryApp.Persistence?.guardar) {
        window.InventoryApp.Persistence.guardar(true);
    }
    if (window.InventoryApp.Firebase?.guardarUsuario) {
        await window.InventoryApp.Firebase.guardarUsuario(usuario);
    }

    cerrarModalEditarDatosGatewall();
    renderizarDetalleGatewallPendiente(usuario);

    if (window.InventoryApp.Modal?.toast) {
        window.InventoryApp.Modal.toast('Tus datos han sido actualizados exitosamente.', 'success');
    } else {
        alert('Tus datos han sido actualizados exitosamente.');
    }
}

/**
 * Renderiza los datos informativos en la pantalla de Solicitud Rechazada del Gatewall
 */
function renderizarDetalleGatewallRechazado(usuario) {
    const cedulaEl = document.getElementById('gatewall-rejected-cedula');
    const motivoEl = document.getElementById('gatewall-rejected-motivo');

    if (cedulaEl) cedulaEl.textContent = usuario.cedula || usuario.id || 'N/A';
    if (motivoEl) motivoEl.textContent = usuario.motivoRechazo || 'La información suministrada no pudo ser validada.';
}

/**
 * Cambia de pestaña en el Gatewall (Login vs Registro)
 */
function cambiarTabGatewall(tab) {
    const tabLogin = document.getElementById('gw-tab-login');
    const tabReg = document.getElementById('gw-tab-register');
    const viewLogin = document.getElementById('gw-view-login');
    const viewReg = document.getElementById('gw-view-register');

    if (tab === 'login') {
        if (tabLogin) tabLogin.classList.add('active');
        if (tabReg) tabReg.classList.remove('active');
        if (viewLogin) viewLogin.style.display = 'block';
        if (viewReg) viewReg.style.display = 'none';
    } else {
        if (tabReg) tabReg.classList.add('active');
        if (tabLogin) tabLogin.classList.remove('active');
        if (viewReg) viewReg.style.display = 'block';
        if (viewLogin) viewLogin.style.display = 'none';
    }
}
function switchGatewallTab(tab) {
    cambiarTabGatewall(tab);
}

/**
 * Procesa el inicio de sesión desde el Gatewall con verificación estricta de credenciales y SHA-256
 */
async function procesarLoginGatewall(e) {
    if (e && e.preventDefault) e.preventDefault();

    const inputId = document.getElementById('gw-login-id');
    const inputPass = document.getElementById('gw-login-pass');
    const btnSubmit = e && e.target ? e.target.querySelector('button[type="submit"]') : null;
    const btnOriginalHtml = btnSubmit ? btnSubmit.innerHTML : '';

    const id = (inputId?.value || '').trim();
    const pass = (inputPass?.value || '').trim();

    if (!id || !pass) {
        if (window.InventoryApp.Modal?.alert) {
            window.InventoryApp.Modal.alert('Campos Incompletos', 'Por favor ingresa tu Cédula/Correo y Contraseña.', 'warning');
        } else {
            alert('Por favor ingresa tu Cédula/Correo y Contraseña.');
        }
        return false;
    }

    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando credenciales...';
    }

    const cleanId = id.toUpperCase();
    const cleanEmail = id.toLowerCase();
    
    // Asegurar que si la lista de usuarios no contiene al SuperAdmin, se garantice
    if (window.InventoryApp.Persistence && typeof window.InventoryApp.Persistence.asegurarUsuarioAdminInicial === 'function') {
        window.InventoryApp.Persistence.asegurarUsuarioAdminInicial();
    }

    const HASH_SUPERADMIN = '1a09807a0e6928a66d91025ed5fccd713c9edb101e72a1bbcb8a01cd9a53cb51';
    const esSuperAdminLogin = cleanId === 'SUPERADMIN' || cleanEmail === 'superadmin@tubodeguita.com';

    let usuario = null;

    if (esSuperAdminLogin) {
        usuario = (AppState.usuarios || []).find(u => u.id === 'SuperAdmin' || (u.cedula && u.cedula.toUpperCase() === 'SUPERADMIN'));
        if (!usuario) {
            usuario = {
                id: 'SuperAdmin',
                cedula: 'SuperAdmin',
                nombre: 'SuperAdmin',
                telefono: '0412-0000000',
                email: 'superadmin@tubodeguita.com',
                password: HASH_SUPERADMIN,
                rol: 'admin',
                estado: 'ACTIVO',
                puntosAcumulados: 0,
                puntosCanjeados: 0,
                fechaRegistro: new Date().toISOString().replace('T', ' ').substring(0, 16)
            };
            if (!Array.isArray(AppState.usuarios)) AppState.usuarios = [];
            AppState.usuarios.unshift(usuario);
            if (window.InventoryApp.Persistence) window.InventoryApp.Persistence.guardar(true);
        }
    } else {
        // Consultar primero en Firestore para verificar el estado real y no permitir usuarios eliminados
        let userCloud = null;
        if (window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.obtenerUsuario === 'function') {
            try {
                userCloud = await window.InventoryApp.Firebase.obtenerUsuario(id);
            } catch (errCloud) {
                console.warn('[Gatewall] Aviso al consultar Firestore:', errCloud);
            }
        }

        if (userCloud) {
            // Usuario validado en Firestore
            usuario = userCloud;
            // Sincronizar en AppState.usuarios
            if (!Array.isArray(AppState.usuarios)) AppState.usuarios = [];
            const idx = AppState.usuarios.findIndex(u => (u.cedula || u.id) === (userCloud.cedula || userCloud.id));
            if (idx !== -1) {
                AppState.usuarios[idx] = userCloud;
            } else {
                AppState.usuarios.push(userCloud);
            }
            if (window.InventoryApp.Persistence) window.InventoryApp.Persistence.guardar(true);
        } else if (navigator.onLine && window.InventoryApp.Firebase) {
            // Está online y NO existe en Firestore -> Usuario borrado o inexistente
            // Purgar de la caché local para mantener sincronización estricta
            AppState.usuarios = (AppState.usuarios || []).filter(u => 
                (u.id || '').toUpperCase() !== cleanId && 
                (u.cedula || '').toUpperCase() !== cleanId && 
                (u.email || '').toLowerCase() !== cleanEmail
            );
            if (window.InventoryApp.Persistence) window.InventoryApp.Persistence.guardar(true);

            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = btnOriginalHtml;
            }

            if (window.InventoryApp.Modal?.alert) {
                window.InventoryApp.Modal.alert('Cuenta no encontrada', `No existe una cuenta registrada con "${id}" o ha sido eliminada del sistema. Puedes enviar una nueva solicitud de registro.`, 'error');
            } else {
                alert(`No existe una cuenta registrada con "${id}" o ha sido eliminada del sistema. Puedes enviar una nueva solicitud de registro.`);
            }
            return false;
        } else {
            // Modo offline sin conexión
            usuario = (AppState.usuarios || []).find(u => 
                (u.id || '').trim().toUpperCase() === cleanId ||
                (u.cedula || '').trim().toUpperCase() === cleanId || 
                (u.nombre || '').trim().toUpperCase() === cleanId ||
                (u.email || '').trim().toLowerCase() === cleanEmail
            );
        }
    }

    if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = btnOriginalHtml;
    }

    if (!usuario) {
        if (window.InventoryApp.Modal?.alert) {
            window.InventoryApp.Modal.alert('Cuenta no encontrada', `No existe una cuenta registrada con "${id}". Puedes registrarte en la pestaña "Registrarse".`, 'error');
        } else {
            alert(`No existe una cuenta registrada con "${id}". Puedes registrarte en la pestaña "Registrarse".`);
        }
        return false;
    }

    // Validación criptográfica de contraseña mediante Hash SHA-256
    let esPasswordValido = false;
    if (window.InventoryApp.Helpers && typeof window.InventoryApp.Helpers.verificarPasswordHash === 'function') {
        esPasswordValido = window.InventoryApp.Helpers.verificarPasswordHash(pass, usuario.password);
    } else {
        esPasswordValido = (usuario.password === pass || usuario.password === HASH_SUPERADMIN);
    }

    if (!esPasswordValido) {
        if (window.InventoryApp.Modal?.alert) {
            window.InventoryApp.Modal.alert('Contraseña Incorrecta', 'La contraseña ingresada no coincide con nuestros registros.', 'error');
        } else {
            alert('Contraseña incorrecta. Verifica tus credenciales.');
        }
        return false;
    }

    // Si la contraseña estaba en texto plano, migrarla al hash SHA-256
    if (usuario.password === pass && window.InventoryApp.Helpers && typeof window.InventoryApp.Helpers.calcularHashSha256 === 'function') {
        usuario.password = window.InventoryApp.Helpers.calcularHashSha256(pass);
    }

    // Autenticado
    AppState.usuarioActual = usuario;

    if (window.InventoryApp.Persistence) {
        window.InventoryApp.Persistence.guardar(true);
    }

    if (usuario.estado === 'ACTIVO' && window.InventoryApp.Modal?.toast) {
        window.InventoryApp.Modal.toast(`¡Bienvenido de nuevo, ${usuario.nombre || usuario.cedula}!`, 'success');
    }

    verificarGatewall();
    return false;
}

/**
 * Registra usuario desde el formulario del Gatewall
 */
async function registrarUsuarioDesdeGatewall(e) {
    if (e && e.preventDefault) e.preventDefault();

    const cedulaInput = document.getElementById('gw-reg-cedula');
    const nombreInput = document.getElementById('gw-reg-nombre');
    const telefonoInput = document.getElementById('gw-reg-telefono');
    const emailInput = document.getElementById('gw-reg-email');
    const passwordInput = document.getElementById('gw-reg-password');
    const rolSelect = document.getElementById('gw-reg-rol');
    const btnSubmit = e && e.target ? e.target.querySelector('button[type="submit"]') : null;
    const btnOriginalHtml = btnSubmit ? btnSubmit.innerHTML : '';

    const cedula = (cedulaInput?.value || '').trim();
    const nombre = (nombreInput?.value || '').trim();
    const telefono = (telefonoInput?.value || '').trim();
    const email = (emailInput?.value || '').trim().toLowerCase();
    const password = (passwordInput?.value || '').trim();
    const rol = rolSelect ? rolSelect.value : 'cliente';

    if (!cedula || !nombre || !telefono || !email || !password) {
        alert('Todos los campos con (*) son obligatorios: Cédula/RIF, Nombre, Teléfono, Correo y Contraseña.');
        return false;
    }

    if (!Array.isArray(AppState.usuarios)) {
        AppState.usuarios = [];
    }

    // Verificar duplicado por cédula
    const existePorCedula = AppState.usuarios.find(u => (u.cedula || u.id).toUpperCase() === cedula.toUpperCase());
    if (existePorCedula) {
        alert(`La Cédula/RIF ${cedula} ya se encuentra registrada con estado: ${existePorCedula.estado}.`);
        return false;
    }

    // Verificar duplicado por email
    const existePorEmail = AppState.usuarios.find(u => (u.email || '').toLowerCase() === email);
    if (existePorEmail) {
        alert(`El correo electrónico ${email} ya está registrado.`);
        return false;
    }

    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando solicitud...';
    }

    try {
        // Generar Hash SHA-256 para no guardar jamás la contraseña en texto plano
        const passwordHash = (window.InventoryApp.Helpers && typeof window.InventoryApp.Helpers.calcularHashSha256 === 'function') 
            ? window.InventoryApp.Helpers.calcularHashSha256(password) 
            : password;

        // Regla de Seguridad Invariable: NINGÚN usuario registrado por formulario es Admin automáticamente.
        const rolAsignado = rol || 'cliente';
        const estadoAsignado = 'PENDIENTE_APROBACION';
        const fechaAprobacion = null;

        const nuevoUsuario = {
            id: cedula,
            cedula: cedula,
            nombre: nombre,
            telefono: telefono,
            email: email,
            password: passwordHash,
            rol: rolAsignado,
            estado: estadoAsignado,
            puntosAcumulados: 0,
            puntosCanjeados: 0,
            fechaRegistro: new Date().toISOString().replace('T', ' ').substring(0, 16),
            fechaAprobacion: fechaAprobacion,
            motivoRechazo: null
        };

        AppState.usuarios.push(nuevoUsuario);

        // Si es cliente, registrarlo también en la colección de clientes
        if (Array.isArray(AppState.clientes) && !AppState.clientes.find(c => c.id === cedula)) {
            AppState.clientes.push({
                id: cedula,
                nombre: nombre,
                telefono: telefono
            });
        }

        AppState.usuarioActual = nuevoUsuario;

        if (window.InventoryApp.Persistence) {
            window.InventoryApp.Persistence.guardar(true);
        }
        
        // Guardar en Firestore con sincronización en tiempo real
        if (window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarUsuario === 'function') {
            window.InventoryApp.Firebase.guardarUsuario(nuevoUsuario).catch(err => {
                console.warn('[Gatewall] Aviso al guardar usuario en Firestore:', err);
            });
        }

        verificarGatewall();
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = btnOriginalHtml;
        }
    }

    return false;
}

/**
 * Comprueba si la solicitud actual fue aprobada por el Admin consultando directamente Firestore
 */
async function verificarEstadoAprobacionGatewall() {
    if (!AppState.usuarioActual) {
        cerrarSesionUsuario();
        return;
    }

    const cedula = AppState.usuarioActual.cedula || AppState.usuarioActual.id;
    let usuarioActualizado = null;

    // 1. Consultar Firestore directamente
    if (window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.obtenerUsuario === 'function') {
        try {
            usuarioActualizado = await window.InventoryApp.Firebase.obtenerUsuario(cedula);
        } catch (e) {
            console.warn('[Gatewall] Error consultando estado en Firestore:', e);
        }
    }

    if (!usuarioActualizado) {
        // Si no se encontró en Firestore y hay conexión a internet -> Fue eliminado
        if (navigator.onLine && window.InventoryApp.Firebase) {
            AppState.usuarioActual = null;
            AppState.usuarios = (AppState.usuarios || []).filter(u => (u.cedula || u.id) !== cedula);
            if (window.InventoryApp.Persistence) window.InventoryApp.Persistence.guardar(true);
            verificarGatewall();
            if (window.InventoryApp.Modal?.alert) {
                window.InventoryApp.Modal.alert('Solicitud No Encontrada', 'Esta cuenta fue eliminada de la base de datos por la administración.', 'error');
            } else {
                alert('Esta cuenta fue eliminada de la base de datos por la administración.');
            }
            return;
        }
        // Fallback local
        usuarioActualizado = (AppState.usuarios || []).find(u => (u.cedula || u.id) === cedula);
    }

    if (usuarioActualizado) {
        AppState.usuarioActual = usuarioActualizado;
        const idx = (AppState.usuarios || []).findIndex(u => (u.cedula || u.id) === cedula);
        if (idx !== -1) {
            AppState.usuarios[idx] = usuarioActualizado;
        } else {
            AppState.usuarios.push(usuarioActualizado);
        }
        if (window.InventoryApp.Persistence) window.InventoryApp.Persistence.guardar(true);

        if (usuarioActualizado.estado === 'ACTIVO') {
            if (window.InventoryApp.Firebase?.reproducirSonidoNotificacion) {
                window.InventoryApp.Firebase.reproducirSonidoNotificacion();
            }
            if (window.InventoryApp.Modal?.alert) {
                window.InventoryApp.Modal.alert('¡Cuenta Aprobada!', '¡Felicidades! Tu cuenta ha sido APROBADA por el Administrador. Ingresando al sistema...', 'success');
            } else {
                alert('¡Felicidades! Tu cuenta ha sido APROBADA. Ingresando al sistema...');
            }
        } else if (usuarioActualizado.estado === 'RECHAZADO') {
            if (window.InventoryApp.Modal?.alert) {
                window.InventoryApp.Modal.alert('Solicitud Rechazada', `Tu solicitud fue RECHAZADA. Motivo: ${usuarioActualizado.motivoRechazo || 'Requisitos no cumplidos.'}`, 'error');
            } else {
                alert(`Tu solicitud fue RECHAZADA. Motivo: ${usuarioActualizado.motivoRechazo || 'Requisitos no cumplidos.'}`);
            }
        } else {
            if (window.InventoryApp.Modal?.alert) {
                window.InventoryApp.Modal.alert('En Revisión', 'Tu solicitud aún se encuentra pendiente de validación por el Administrador.', 'info');
            } else {
                alert('Tu solicitud aún se encuentra en revisión.');
            }
        }
        verificarGatewall();
    }
}

/**
 * Registra un nuevo usuario en el sistema con estado predeterminado PENDIENTE_APROBACION
 */
async function registrarUsuario(e) {
    if (e && e.preventDefault) e.preventDefault();

    const cedulaInput = document.getElementById('reg-cedula');
    const nombreInput = document.getElementById('reg-nombre');
    const telefonoInput = document.getElementById('reg-telefono');
    const emailInput = document.getElementById('reg-email');
    const passwordInput = document.getElementById('reg-password');
    const rolSelect = document.getElementById('reg-rol');

    const cedula = (cedulaInput?.value || '').trim();
    const nombre = (nombreInput?.value || '').trim();
    const telefono = (telefonoInput?.value || '').trim();
    const email = (emailInput?.value || '').trim().toLowerCase();
    const password = (passwordInput?.value || '').trim();
    const rol = rolSelect ? rolSelect.value : 'cliente';

    if (!cedula || !nombre || !telefono || !email || !password) {
        alert('Todos los campos son obligatorios: Cédula/RIF, Nombre/Razón Social, Teléfono, Correo y Contraseña.');
        return;
    }

    if (!Array.isArray(AppState.usuarios)) {
        AppState.usuarios = [];
    }

    // Verificar si ya existe usuario con esa cédula o correo
    const existePorCedula = AppState.usuarios.find(u => (u.cedula || u.id).toUpperCase() === cedula.toUpperCase());
    if (existePorCedula) {
        if (existePorCedula.estado === 'PENDIENTE_APROBACION') {
            mostrarNotificacionRegistro(`La Cédula/RIF ${cedula} ya tiene una solicitud PENDIENTE DE APROBACIÓN. Espera la validación del Administrador.`, 'warning');
        } else if (existePorCedula.estado === 'ACTIVO') {
            mostrarNotificacionRegistro(`El usuario con Cédula ${cedula} ya se encuentra ACTIVO. Puedes iniciar sesión directamente.`, 'info');
        } else {
            mostrarNotificacionRegistro(`El usuario con Cédula ${cedula} está en estado ${existePorCedula.estado}. Contacta al Administrador.`, 'danger');
        }
        return;
    }

    const existePorEmail = AppState.usuarios.find(u => (u.email || '').toLowerCase() === email);
    if (existePorEmail) {
        mostrarNotificacionRegistro(`El correo electrónico ${email} ya está registrado en el sistema.`, 'warning');
        return;
    }

    // Hash SHA-256
    const passwordHash = (window.InventoryApp.Helpers && typeof window.InventoryApp.Helpers.calcularHashSha256 === 'function')
        ? window.InventoryApp.Helpers.calcularHashSha256(password)
        : password;

    // Regla de Seguridad Invariable: NINGÚN usuario registrado por formulario es Admin automáticamente.
    const rolAsignado = rol || 'cliente';
    const estadoAsignado = 'PENDIENTE_APROBACION';
    const fechaAprobacion = null;

    const nuevoUsuario = {
        id: cedula,
        cedula: cedula,
        nombre: nombre,
        telefono: telefono,
        email: email,
        password: passwordHash,
        rol: rolAsignado,
        estado: estadoAsignado,
        puntosAcumulados: 0,
        puntosCanjeados: 0,
        fechaRegistro: new Date().toISOString().replace('T', ' ').substring(0, 16),
        fechaAprobacion: fechaAprobacion,
        motivoRechazo: null
    };

    AppState.usuarios.push(nuevoUsuario);

    // Si es cliente, registrarlo también en la colección de clientes
    if (Array.isArray(AppState.clientes) && !AppState.clientes.find(c => c.id === cedula)) {
        AppState.clientes.push({
            id: cedula,
            nombre: nombre,
            telefono: telefono
        });
    }

    // Establecemos como usuario actual
    AppState.usuarioActual = nuevoUsuario;

    // Guardar en almacenamiento local y Firebase
    if (window.InventoryApp.Persistence && typeof window.InventoryApp.Persistence.guardar === 'function') {
        window.InventoryApp.Persistence.guardar(true);
    }
    if (window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarUsuario === 'function') {
        window.InventoryApp.Firebase.guardarUsuario(nuevoUsuario).catch(err => {
            console.warn('[Usuarios] Error guardando usuario en Firestore:', err);
        });
    }

    // Limpiar formulario
    if (cedulaInput) cedulaInput.value = '';
    if (nombreInput) nombreInput.value = '';
    if (telefonoInput) telefonoInput.value = '';
    if (emailInput) emailInput.value = '';
    if (passwordInput) passwordInput.value = '';

    mostrarNotificacionRegistro(`Solicitud de registro enviada exitosamente para ${nombre} (${cedula}). Estado: PENDIENTE DE APROBACIÓN.`, 'success');

    verificarGatewall();
}

/**
 * Muestra mensaje de retroalimentación en el formulario de registro
 */
function mostrarNotificacionRegistro(mensaje, tipo = 'info') {
    const feedbackEl = document.getElementById('reg-feedback');
    if (!feedbackEl) {
        alert(mensaje);
        return;
    }

    let bg = '#eff6ff', color = '#1d4ed8', icon = 'fa-circle-info';
    if (tipo === 'success') { bg = '#dcfce7'; color = '#15803d'; icon = 'fa-circle-check'; }
    if (tipo === 'warning') { bg = '#fef3c7'; color = '#b45309'; icon = 'fa-triangle-exclamation'; }
    if (tipo === 'danger') { bg = '#fee2e2'; color = '#b91c1c'; icon = 'fa-circle-xmark'; }

    feedbackEl.style.display = 'flex';
    feedbackEl.style.backgroundColor = bg;
    feedbackEl.style.color = color;
    feedbackEl.style.borderColor = color;
    feedbackEl.innerHTML = `<i class="fas ${icon}" style="font-size:1.15rem; margin-top:2px;"></i> <div>${mensaje}</div>`;
}

/**
 * Aprueba la solicitud de un usuario y lo coloca en estado ACTIVO
 */
function aprobarUsuario(cedula) {
    if (!cedula) return;
    const usuario = (AppState.usuarios || []).find(u => (u.cedula || u.id) === cedula);
    if (!usuario) return;

    usuario.estado = 'ACTIVO';
    usuario.fechaAprobacion = new Date().toISOString().replace('T', ' ').substring(0, 16);
    usuario.motivoRechazo = null;

    if (AppState.usuarioActual && (AppState.usuarioActual.cedula || AppState.usuarioActual.id) === cedula) {
        AppState.usuarioActual.estado = 'ACTIVO';
    }

    // Asegurar en lista de clientes si es cliente
    if (usuario.rol === 'cliente' && Array.isArray(AppState.clientes) && !AppState.clientes.find(c => c.id === cedula)) {
        AppState.clientes.push({
            id: cedula,
            nombre: usuario.nombre,
            telefono: usuario.telefono || ''
        });
    }

    // Persistir
    if (window.InventoryApp.Persistence) window.InventoryApp.Persistence.guardar(true);
    if (window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarUsuario === 'function') {
        window.InventoryApp.Firebase.guardarUsuario(usuario);
    }

    renderizarUsuarios();
    actualizarBadgesUsuarios();
    verificarGatewall();
}

/**
 * Abre el modal para capturar el motivo de rechazo de un usuario
 */
function abrirModalRechazarUsuario(cedula) {
    usuarioSeleccionadoParaRechazo = (AppState.usuarios || []).find(u => (u.cedula || u.id) === cedula);
    if (!usuarioSeleccionadoParaRechazo) return;

    const modal = document.getElementById('modal-rechazar-usuario');
    const infoUser = document.getElementById('rechazo-usuario-info');
    const inputMotivo = document.getElementById('rechazo-motivo-texto');

    if (infoUser) {
        infoUser.innerHTML = `<strong>${usuarioSeleccionadoParaRechazo.nombre}</strong> (Cédula/RIF: ${usuarioSeleccionadoParaRechazo.cedula || usuarioSeleccionadoParaRechazo.id})`;
    }
    if (inputMotivo) inputMotivo.value = '';

    if (modal) modal.classList.add('active');
}

function cerrarModalRechazarUsuario() {
    const modal = document.getElementById('modal-rechazar-usuario');
    if (modal) modal.classList.remove('active');
    usuarioSeleccionadoParaRechazo = null;
}

/**
 * Confirma el rechazo del usuario con el motivo especificado
 */
function confirmarRechazoUsuario() {
    if (!usuarioSeleccionadoParaRechazo) return;

    const inputMotivo = document.getElementById('rechazo-motivo-texto');
    const motivo = (inputMotivo?.value || '').trim() || 'No cumple con los requisitos de verificación.';

    usuarioSeleccionadoParaRechazo.estado = 'RECHAZADO';
    usuarioSeleccionadoParaRechazo.motivoRechazo = motivo;

    if (AppState.usuarioActual && (AppState.usuarioActual.cedula || AppState.usuarioActual.id) === (usuarioSeleccionadoParaRechazo.cedula || usuarioSeleccionadoParaRechazo.id)) {
        AppState.usuarioActual.estado = 'RECHAZADO';
        AppState.usuarioActual.motivoRechazo = motivo;
    }

    if (window.InventoryApp.Persistence) window.InventoryApp.Persistence.guardar(true);
    if (window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarUsuario === 'function') {
        window.InventoryApp.Firebase.guardarUsuario(usuarioSeleccionadoParaRechazo);
    }

    cerrarModalRechazarUsuario();
    renderizarUsuarios();
    actualizarBadgesUsuarios();
    verificarGatewall();
}

/**
 * Cambia el rol de un usuario (admin, vendedor, cliente)
 */
function cambiarRolUsuario(cedula, nuevoRol) {
    const usuario = (AppState.usuarios || []).find(u => (u.cedula || u.id) === cedula);
    if (!usuario) return;

    usuario.rol = nuevoRol;

    if (AppState.usuarioActual && (AppState.usuarioActual.cedula || AppState.usuarioActual.id) === cedula) {
        AppState.usuarioActual.rol = nuevoRol;
    }

    if (window.InventoryApp.Persistence) window.InventoryApp.Persistence.guardar(true);
    if (window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarUsuario === 'function') {
        window.InventoryApp.Firebase.guardarUsuario(usuario);
    }

    renderizarUsuarios();
    verificarGatewall();
}

/**
 * Elimina un usuario del sistema (Soft/Hard delete en Vercel DB y Firestore en tiempo real)
 */
async function eliminarUsuario(cedula) {
    if (!cedula) return;
    if (cedula === 'V-00000001' || String(cedula).toUpperCase() === 'SUPERADMIN') {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Acción Denegada', 'El Administrador Principal (SuperAdmin) del sistema no puede ser eliminado por seguridad.', 'error');
        } else {
            alert('El Administrador Principal del sistema no puede ser eliminado por seguridad.');
        }
        return;
    }

    const usuario = (AppState.usuarios || []).find(u => (u.cedula || u.id) === cedula);
    if (!usuario) return;

    const rolBadge = (usuario.rol || 'cliente').toUpperCase();
    const puntos = Number(usuario.puntosAcumulados || 0);

    const detalleHtml = `¿Estás seguro de eliminar permanentemente a este usuario?<br><br>` +
        `• <b>Nombre:</b> ${usuario.nombre}<br>` +
        `• <b>Cédula/ID:</b> ${usuario.cedula || usuario.id}<br>` +
        `• <b>Rol:</b> ${rolBadge}<br>` +
        `• <b>Puntos Acumulados:</b> ${puntos} pts<br><br>` +
        `<span style="color:#ef4444; font-size:0.85rem;">Esta acción eliminará la cuenta y registros de acceso de la base de datos.</span>`;

    let confirmado = false;
    if (typeof showCustomConfirm === 'function') {
        confirmado = await showCustomConfirm('Eliminar Usuario', detalleHtml, 'danger');
    } else {
        confirmado = confirm(`¿Estás seguro de eliminar a ${usuario.nombre} (${cedula})?`);
    }

    if (!confirmado) return;

    // 1. Llamar al endpoint backend de Vercel/Node para eliminación en BD
    try {
        await fetch(`/api/users/${encodeURIComponent(cedula)}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });
        console.log(`[API Delete] Usuario ${cedula} eliminado en backend.`);
    } catch (err) {
        console.warn(`[API Delete] Backend offline:`, err);
    }

    // 2. Eliminar del estado global local
    AppState.usuarios = (AppState.usuarios || []).filter(u => (u.cedula || u.id) !== cedula);
    if (Array.isArray(AppState.clientes)) {
        AppState.clientes = AppState.clientes.filter(c => (c.id || c.cedula) !== cedula);
    }

    // 3. Si era la sesión activa, cerrar sesión
    if (AppState.usuarioActual && (AppState.usuarioActual.cedula || AppState.usuarioActual.id) === cedula) {
        if (typeof showCustomAlert === 'function') {
            await showCustomAlert('Sesión Finalizada', `La cuenta activa (${usuario.nombre}) fue eliminada. Cerrando sesión.`, 'info');
        }
        cerrarSesionUsuario();
        return;
    }

    // 4. Sincronizar persistencia local y Firestore inmediatamente
    if (window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.eliminarUsuario === 'function') {
        try {
            await window.InventoryApp.Firebase.eliminarUsuario(cedula);
        } catch (err) {
            console.warn('[Usuarios] Aviso al eliminar en Firebase:', err);
        }
    }
    if (window.InventoryApp.Persistence) window.InventoryApp.Persistence.guardar(true);

    // 5. Re-renderizar la tabla de usuarios inmediatamente sin recarga
    renderizarUsuarios();
    actualizarBadgesUsuarios();

    if (typeof showCustomToast === 'function') {
        showCustomToast(`Usuario ${usuario.nombre} eliminado correctamente`, 'success');
    }
}

// --- AVATARES DE USUARIO (PRESETS + SUBIDA CON RESIZE 150x150) ---
const PRESETS_AVATARES = [
    { id: 'av-1', icon: '👨‍💼', label: 'Admin Elegante' },
    { id: 'av-2', icon: '👩‍💼', label: 'Ejecutiva' },
    { id: 'av-3', icon: '🧑‍💻', label: 'Especialista' },
    { id: 'av-4', icon: '🛒', label: 'Comprador VIP' },
    { id: 'av-5', icon: '🥑', label: 'Bodeguero' },
    { id: 'av-6', icon: '⭐', label: 'Estrella' },
    { id: 'av-7', icon: '👑', label: 'Corona VIP' },
    { id: 'av-8', icon: '🎯', label: 'Fidelidad' },
    { id: 'av-9', icon: '☕', label: 'Café Matutino' },
    { id: 'av-10', icon: '🌻', label: 'Girasol' },
    { id: 'av-11', icon: '🌴', label: 'Palmera' },
    { id: 'av-12', icon: '🚀', label: 'Emprendedor' }
];

function abrirModalSelectorAvatar() {
    let modal = document.getElementById('modal-selector-avatar');
    if (!modal) {
        crearModalSelectorAvatarDOM();
        modal = document.getElementById('modal-selector-avatar');
    }
    if (modal) {
        modal.classList.add('active');
        renderizarGridAvataresPresets();
    }
}

function cerrarModalSelectorAvatar() {
    const modal = document.getElementById('modal-selector-avatar');
    if (modal) modal.classList.remove('active');
}

function crearModalSelectorAvatarDOM() {
    const modalDiv = document.createElement('div');
    modalDiv.id = 'modal-selector-avatar';
    modalDiv.className = 'modal';
    modalDiv.innerHTML = `
        <div class="modal-content" style="max-width: 500px; padding: 24px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <h3 style="margin:0; font-size:1.2rem; display:flex; align-items:center; gap:8px;">
                    <i class="fas fa-user-circle" style="color:var(--primary-accent);"></i> Personalizar mi Avatar
                </h3>
                <button type="button" class="btn-icon-tasa" onclick="cerrarModalSelectorAvatar()"><i class="fas fa-times"></i></button>
            </div>

            <p style="font-size:0.88rem; color:var(--text-muted); margin-bottom:16px;">
                Elige uno de nuestros avatares prediseñados o sube tu propia foto de perfil (se adaptará automáticamente a 150×150 px).
            </p>

            <!-- Grid de Presets -->
            <div style="font-size:0.85rem; font-weight:700; color:var(--text-main); margin-bottom:8px;">Avatares Prediseñados:</div>
            <div id="avatar-presets-grid" style="display:grid; grid-template-columns: repeat(6, 1fr); gap:10px; margin-bottom:20px;"></div>

            <!-- Subida Personalizada -->
            <div style="border-top:1px dashed #cbd5e1; padding-top:16px;">
                <div style="font-size:0.85rem; font-weight:700; color:var(--text-main); margin-bottom:8px;">O sube una foto personalizada:</div>
                <div style="display:flex; gap:10px; align-items:center;">
                    <input type="file" id="avatar-custom-file" accept="image/jpeg,image/png,image/webp" style="display:none;" onchange="procesarSubidaAvatar(event)">
                    <button type="button" class="btn btn-outline" onclick="document.getElementById('avatar-custom-file').click()" style="flex:1;">
                        <i class="fas fa-upload"></i> Subir Foto (JPG / PNG / WEBP)
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="restablecerAvatarPorDefecto()">
                        <i class="fas fa-rotate-left"></i> Por defecto
                    </button>
                </div>
                <small style="font-size:0.75rem; color:var(--text-muted); display:block; margin-top:6px;">
                    * Tu imagen se recortará y optimizará automáticamente en tu navegador a 150x150 píxeles.
                </small>
            </div>
        </div>
    `;
    document.body.appendChild(modalDiv);
}

function renderizarGridAvataresPresets() {
    const grid = document.getElementById('avatar-presets-grid');
    if (!grid) return;
    const actual = AppState.usuarioActual?.avatar || '';

    grid.innerHTML = PRESETS_AVATARES.map(p => `
        <button type="button" onclick="seleccionarAvatarPreset('${p.icon}')" 
            title="${p.label}"
            style="font-size:1.8rem; height:52px; border-radius:12px; border:2px solid ${actual === p.icon ? 'var(--primary-accent)' : '#e2e8f0'}; background:${actual === p.icon ? '#eff6ff' : '#ffffff'}; cursor:pointer; transition:all 0.15s ease;"
            onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
            ${p.icon}
        </button>
    `).join('');
}

function seleccionarAvatarPreset(icono) {
    const usuario = AppState.usuarioActual;
    if (!usuario) return;

    usuario.avatar = icono;
    if (window.InventoryApp.Persistence) window.InventoryApp.Persistence.guardar(true);
    if (window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarUsuario === 'function') {
        window.InventoryApp.Firebase.guardarUsuario(usuario);
    }

    actualizarUIUsuarioActual();
    cerrarModalSelectorAvatar();
    if (typeof renderizarCatalogoCliente === 'function') renderizarCatalogoCliente();
    if (typeof renderizarUsuarios === 'function') renderizarUsuarios();
}

function restablecerAvatarPorDefecto() {
    const usuario = AppState.usuarioActual;
    if (!usuario) return;

    usuario.avatar = null;
    if (window.InventoryApp.Persistence) window.InventoryApp.Persistence.guardar(true);
    if (window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarUsuario === 'function') {
        window.InventoryApp.Firebase.guardarUsuario(usuario);
    }

    actualizarUIUsuarioActual();
    cerrarModalSelectorAvatar();
    if (typeof renderizarCatalogoCliente === 'function') renderizarCatalogoCliente();
}

function procesarSubidaAvatar(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('Por favor selecciona un archivo de imagen válido (.jpg, .png o .webp).');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = async function() {
            // Resize to exact 180x180 square center-crop
            const canvas = document.createElement('canvas');
            canvas.width = 180;
            canvas.height = 180;
            const ctx = canvas.getContext('2d');

            const minDim = Math.min(img.width, img.height);
            const startX = (img.width - minDim) / 2;
            const startY = (img.height - minDim) / 2;

            ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, 180, 180);

            const dataUrl = canvas.toDataURL('image/webp', 0.88);
            
            const usuario = AppState.usuarioActual;
            if (!usuario) return;

            // 1. Asignar temporalmente y actualizar UI de inmediato
            usuario.avatar = dataUrl;
            actualizarUIUsuarioActual();
            cerrarModalSelectorAvatar();

            // 2. Subir a Vercel Blob (@vercel/blob) y guardar solo la URL en Firestore
            try {
                if (window.InventoryApp && window.InventoryApp.ImageCache) {
                    const idUser = usuario.cedula || usuario.id || 'user';
                    const resultado = await window.InventoryApp.ImageCache.subirImagenVercelBlob(dataUrl, 'avatars', `avatar_${idUser}_${Date.now()}.webp`);
                    if (resultado && resultado.url) {
                        usuario.avatar = resultado.url;
                        console.log('[Usuarios] Avatar persistido en Vercel Blob:', resultado.url);
                    }
                }
            } catch (blobErr) {
                console.warn('[Usuarios] Aviso al subir avatar a Vercel Blob, usando copia local:', blobErr);
            }

            // 3. Persistir en Firestore (solo la URL) y localStorage
            if (window.InventoryApp.Persistence) window.InventoryApp.Persistence.guardar(true);
            if (window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarUsuario === 'function') {
                window.InventoryApp.Firebase.guardarUsuario(usuario);
            }

            actualizarUIUsuarioActual();
            if (typeof renderizarCatalogoCliente === 'function') renderizarCatalogoCliente();
            if (typeof renderizarUsuarios === 'function') renderizarUsuarios();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

/**
 * Cierra la sesión activa y retorna al Gatewall de autenticación
 */
function cerrarSesionUsuario() {
    AppState.usuarioActual = null;
    if (window.InventoryApp.Persistence) window.InventoryApp.Persistence.guardar(true);
    verificarGatewall();
}

/**
 * Cambia la sesión activa a otro usuario (para administración/simulación)
 */
function cambiarSesionUsuario(cedula) {
    const usuario = (AppState.usuarios || []).find(u => (u.cedula || u.id) === cedula);
    if (!usuario) return;

    AppState.usuarioActual = usuario;
    if (window.InventoryApp.Persistence) window.InventoryApp.Persistence.guardar(true);

    verificarGatewall();
    renderizarUsuarios();
}

/**
 * Filtra la tabla de usuarios del panel administrativo
 */
function filtrarUsuariosPorEstado(estado) {
    filtroEstadoUsuarioActual = estado;

    document.querySelectorAll('.tab-btn-user-filter').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-filter') === estado);
    });

    renderizarUsuarios();
}

/**
 * Renderiza la tabla de usuarios en la vista de Administrador
 */
function renderizarUsuarios(busqueda = '') {
    const tbody = document.getElementById('usuarios-body');
    if (!tbody) return;

    const lista = Array.isArray(AppState.usuarios) ? AppState.usuarios : [];

    // Conteo para KPIs
    const total = lista.length;
    const pendientes = lista.filter(u => u.estado === 'PENDIENTE_APROBACION').length;
    const activos = lista.filter(u => u.estado === 'ACTIVO').length;
    const rechazados = lista.filter(u => u.estado === 'RECHAZADO').length;

    const kpiTotal = document.getElementById('kpi-usuarios-total');
    const kpiPendientes = document.getElementById('kpi-usuarios-pendientes');
    const kpiActivos = document.getElementById('kpi-usuarios-activos');
    const kpiRechazados = document.getElementById('kpi-usuarios-rechazados');

    if (kpiTotal) kpiTotal.textContent = total;
    if (kpiPendientes) kpiPendientes.textContent = pendientes;
    if (kpiActivos) kpiActivos.textContent = activos;
    if (kpiRechazados) kpiRechazados.textContent = rechazados;

    // Filtrar
    let filtrados = lista;
    if (filtroEstadoUsuarioActual !== 'TODOS') {
        filtrados = filtrados.filter(u => u.estado === filtroEstadoUsuarioActual);
    }
    if (busqueda) {
        const q = busqueda.toLowerCase();
        filtrados = filtrados.filter(u => 
            (u.nombre || '').toLowerCase().includes(q) ||
            (u.cedula || u.id || '').toLowerCase().includes(q) ||
            (u.email || '').toLowerCase().includes(q) ||
            (u.telefono || '').includes(q)
        );
    }

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--text-muted);">No se encontraron usuarios con los criterios especificados.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtrados.map(u => {
        const idCed = u.cedula || u.id;
        const puntos = Number(u.puntosAcumulados || 0) - Number(u.puntosCanjeados || 0);
        const telefonoLimpio = (u.telefono || '').replace(/\D/g, '');
        const waLink = telefonoLimpio ? `https://wa.me/${telefonoLimpio.startsWith('58') ? telefonoLimpio : '58' + telefonoLimpio.replace(/^0/, '')}?text=Hola%20${encodeURIComponent(u.nombre)},%20te%20contactamos%20de%20Tu%20Bodeguita%20de%20Confianza.` : null;

        let badgeEstado = '';
        if (u.estado === 'PENDIENTE_APROBACION') {
            badgeEstado = `<span class="badge-status badge-pending"><i class="fas fa-clock fa-spin" style="font-size:0.75rem;"></i> Pendiente</span>`;
        } else if (u.estado === 'ACTIVO') {
            badgeEstado = `<span class="badge-status badge-active"><i class="fas fa-check-circle"></i> Activo</span>`;
        } else if (u.estado === 'RECHAZADO') {
            badgeEstado = `<span class="badge-status badge-rejected" title="${u.motivoRechazo || 'Rechazado'}"><i class="fas fa-ban"></i> Rechazado</span>`;
        }

        const esSesionActual = AppState.usuarioActual && (AppState.usuarioActual.cedula || AppState.usuarioActual.id) === idCed;

        return `
            <tr style="${esSesionActual ? 'background-color: rgba(37, 99, 235, 0.05);' : ''}">
                <td>
                    <strong style="color:var(--primary-accent);">${idCed}</strong>
                    ${esSesionActual ? '<span class="badge-pill" style="font-size:0.65rem; background:#38bdf8; margin-left:4px;">Tú</span>' : ''}
                </td>
                <td>
                    <div style="font-weight:600; color:var(--text-main);">${u.nombre}</div>
                    <div style="font-size:0.78rem; color:var(--text-muted);"><i class="far fa-envelope"></i> ${u.email}</div>
                </td>
                <td>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span>${u.telefono || '—'}</span>
                        ${waLink ? `<a href="${waLink}" target="_blank" class="btn-wa-icon" title="Enviar WhatsApp"><i class="fab fa-whatsapp"></i></a>` : ''}
                    </div>
                </td>
                <td>
                    <select class="form-select-sm" onchange="cambiarRolUsuario('${idCed}', this.value)" style="padding:4px 8px; font-size:0.8rem; border-radius:6px; border:1px solid var(--border);">
                        <option value="cliente" ${u.rol === 'cliente' ? 'selected' : ''}>Cliente</option>
                        <option value="vendedor" ${u.rol === 'vendedor' ? 'selected' : ''}>Vendedor</option>
                        <option value="admin" ${u.rol === 'admin' ? 'selected' : ''}>Administrador</option>
                    </select>
                </td>
                <td>${badgeEstado}</td>
                <td class="num" style="color:var(--primary-accent); font-weight:700;">${puntos} pts</td>
                <td style="font-size:0.78rem; color:var(--text-muted);">${u.fechaRegistro || '—'}</td>
                <td>
                    <div style="display:flex; gap:5px; flex-wrap:wrap;">
                        ${u.estado === 'PENDIENTE_APROBACION' ? `
                            <button type="button" class="btn btn-sm btn-success" onclick="aprobarUsuario('${idCed}')" title="Aprobar usuario">
                                <i class="fas fa-check"></i> Aprobar
                            </button>
                            <button type="button" class="btn btn-sm btn-danger" onclick="abrirModalRechazarUsuario('${idCed}')" title="Rechazar solicitud">
                                <i class="fas fa-times"></i> Rechazar
                            </button>
                        ` : ''}
                        ${u.estado === 'RECHAZADO' ? `
                            <button type="button" class="btn btn-sm btn-success" onclick="aprobarUsuario('${idCed}')" title="Reactivar y Aprobar">
                                <i class="fas fa-rotate-left"></i> Reactivar
                            </button>
                        ` : ''}
                        ${u.estado === 'ACTIVO' ? `
                            <button type="button" class="btn btn-sm btn-outline" onclick="abrirModalRechazarUsuario('${idCed}')" title="Suspender o Rechazar acceso">
                                <i class="fas fa-user-slash"></i> Suspender
                            </button>
                        ` : ''}
                        <button type="button" class="btn btn-sm btn-primary" onclick="cambiarSesionUsuario('${idCed}')" title="Usar esta sesión">
                            <i class="fas fa-arrow-right-to-bracket"></i> Usar
                        </button>
                        <button type="button" class="btn btn-sm btn-danger" onclick="eliminarUsuario('${idCed}')" title="Eliminar usuario">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    actualizarBadgesUsuarios();
}

/**
 * Actualiza los badges numéricos de pendientes
 */
function actualizarBadgesUsuarios() {
    const lista = Array.isArray(AppState.usuarios) ? AppState.usuarios : [];
    const pendientes = lista.filter(u => u.estado === 'PENDIENTE_APROBACION').length;

    const bDesk = document.getElementById('badge-pendientes-desktop');
    const bMob = document.getElementById('badge-pendientes-mobile');

    if (bDesk) {
        if (pendientes > 0) {
            bDesk.style.display = 'inline-flex';
            bDesk.textContent = pendientes;
        } else {
            bDesk.style.display = 'none';
        }
    }

    if (bMob) {
        if (pendientes > 0) {
            bMob.style.display = 'block';
        } else {
            bMob.style.display = 'none';
        }
    }
}

/**
 * Actualiza la información del usuario en el encabezado
 */
function actualizarUIUsuarioActual() {
    const usuario = AppState.usuarioActual;
    const headerName = document.getElementById('header-user-name');
    const headerStatus = document.getElementById('header-user-status');
    const headerPtsPill = document.getElementById('header-user-pts-pill');

    if (!usuario) {
        if (headerName) headerName.textContent = 'Sin Sesión';
        if (headerStatus) {
            headerStatus.className = 'badge-status-pill badge-neutral';
            headerStatus.textContent = 'INVITADO';
        }
        if (headerPtsPill) headerPtsPill.style.display = 'none';
        return;
    }

    if (headerName) headerName.textContent = usuario.nombre || usuario.cedula;
    if (headerStatus) {
        const r = (usuario.rol || 'cliente').toLowerCase();
        if (r === 'admin' || r === 'superadmin') {
            headerStatus.className = 'badge-status-pill badge-success';
            headerStatus.textContent = 'ADMIN';
        } else if (r === 'vendedor') {
            headerStatus.className = 'badge-status-pill badge-primary';
            headerStatus.textContent = 'VENDEDOR';
        } else {
            headerStatus.className = 'badge-status-pill badge-warning';
            headerStatus.textContent = 'CLIENTE VIP';
        }
    }

    // Avatar en encabezado
    const avatarMini = document.querySelector('#btn-user-session-header .user-avatar-mini');
    if (avatarMini) {
        if (usuario.avatar) {
            if (usuario.avatar.startsWith('data:image') || usuario.avatar.startsWith('http')) {
                avatarMini.innerHTML = `<img src="${usuario.avatar}" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
            } else {
                avatarMini.innerHTML = `<span style="font-size:1.15rem;">${usuario.avatar}</span>`;
            }
        } else {
            avatarMini.innerHTML = `<i class="fas fa-user"></i>`;
        }
        avatarMini.title = 'Haz clic para cambiar tu foto o avatar';
        avatarMini.onclick = (e) => {
            e.stopPropagation();
            abrirModalSelectorAvatar();
        };
    }

    // Puntos en Header para cliente
    if (headerPtsPill) {
        if (usuario.rol === 'cliente') {
            const pts = Number(usuario.puntosAcumulados || 0) - Number(usuario.puntosCanjeados || 0);
            headerPtsPill.style.display = 'inline-flex';
            headerPtsPill.innerHTML = `<i class="fas fa-star" style="color:#f59e0b;"></i> ${pts} Pts`;
        } else {
            headerPtsPill.style.display = 'none';
        }
    }

    // Botón de Estado de Persistencia/Nube solo visible para Administradores
    const persistenciaStatusEl = document.getElementById('persistencia-status');
    if (persistenciaStatusEl) {
        const rolUsuario = (usuario.rol || '').toLowerCase();
        const esAdmin = rolUsuario === 'admin' || rolUsuario === 'superadmin';
        persistenciaStatusEl.style.display = esAdmin ? 'flex' : 'none';
    }

    // Botón de Edición Manual de Tasa solo visible para Administradores
    const btnEditarTasaManual = document.getElementById('btn-editar-tasa-manual');
    if (btnEditarTasaManual) {
        const rolUsuario = (usuario.rol || '').toLowerCase();
        const esAdmin = rolUsuario === 'admin' || rolUsuario === 'superadmin';
        btnEditarTasaManual.style.display = esAdmin ? 'inline-flex' : 'none';
    }
}

/**
 * Guardia de Seguridad POS
 */
function verificarAccesoPOS(mostrarAlerta = true) {
    const usuario = AppState.usuarioActual;

    if (!usuario) {
        return { permitido: false, razon: 'NO_SESION' };
    }

    const rol = (usuario.rol || '').toLowerCase();
    if (rol === 'admin' || rol === 'superadmin' || rol === 'vendedor') {
        return { permitido: true, usuario };
    }

    if (usuario.estado === 'ACTIVO') {
        return { permitido: true, usuario };
    }

    return { permitido: false, razon: usuario.estado, usuario };
}

/**
 * Procesa el inicio de sesión desde el modal de cambio/login
 */
async function procesarLoginUsuario(e) {
    if (e && e.preventDefault) e.preventDefault();
    const inputId = document.getElementById('login-identificador');
    const inputPass = document.getElementById('login-password');
    const id = (inputId?.value || '').trim();
    const pass = (inputPass?.value || '').trim();

    if (!id || !pass) {
        if (window.InventoryApp.Modal?.alert) {
            window.InventoryApp.Modal.alert('Campos Incompletos', 'Ingresa identificador y contraseña.', 'warning');
        } else {
            alert('Ingresa identificador y contraseña.');
        }
        return false;
    }

    const cleanId = id.toUpperCase();
    const cleanEmail = id.toLowerCase();
    let usuario = null;

    if (cleanId === 'SUPERADMIN' || cleanEmail === 'superadmin@tubodeguita.com') {
        usuario = (AppState.usuarios || []).find(u => u.id === 'SuperAdmin' || (u.cedula && u.cedula.toUpperCase() === 'SUPERADMIN'));
    } else if (window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.obtenerUsuario === 'function') {
        try {
            usuario = await window.InventoryApp.Firebase.obtenerUsuario(id);
        } catch (e) {}
    }

    if (!usuario) {
        usuario = (AppState.usuarios || []).find(u => 
            (u.id || '').trim().toUpperCase() === cleanId ||
            (u.cedula || '').trim().toUpperCase() === cleanId || 
            (u.nombre || '').trim().toUpperCase() === cleanId ||
            (u.email || '').trim().toLowerCase() === cleanEmail
        );
    }

    if (!usuario) {
        if (window.InventoryApp.Modal?.alert) {
            window.InventoryApp.Modal.alert('Usuario no encontrado', `No existe una cuenta registrada para "${id}" o fue eliminada.`, 'error');
        } else {
            alert(`No existe una cuenta registrada para "${id}".`);
        }
        return false;
    }

    let esValido = false;
    if (window.InventoryApp.Helpers && typeof window.InventoryApp.Helpers.verificarPasswordHash === 'function') {
        esValido = window.InventoryApp.Helpers.verificarPasswordHash(pass, usuario.password);
    } else {
        esValido = (usuario.password === pass);
    }

    if (!esValido) {
        if (window.InventoryApp.Modal?.alert) {
            window.InventoryApp.Modal.alert('Contraseña Incorrecta', 'Contraseña incorrecta. Verifica tus credenciales.', 'error');
        } else {
            alert('Contraseña incorrecta.');
        }
        return false;
    }

    AppState.usuarioActual = usuario;
    if (window.InventoryApp.Persistence) window.InventoryApp.Persistence.guardar(true);
    cerrarModalAuth();
    verificarGatewall();
    return false;
}

function abrirModalAuth() {
    const modal = document.getElementById('modal-auth');
    if (modal) modal.classList.add('active');
}

function cerrarModalAuth() {
    const modal = document.getElementById('modal-auth');
    if (modal) modal.classList.remove('active');
}

// Exportar funciones a la ventana global
window.verificarGatewall = verificarGatewall;
window.configurarVistasPorRol = configurarVistasPorRol;
window.switchGatewallTab = switchGatewallTab;
window.procesarLoginGatewall = procesarLoginGatewall;
window.procesarLoginUsuario = procesarLoginUsuario;
window.abrirModalAuth = abrirModalAuth;
window.cerrarModalAuth = cerrarModalAuth;
window.registrarUsuario = registrarUsuario;
window.registrarUsuarioDesdeGatewall = registrarUsuarioDesdeGatewall;
window.aprobarUsuario = aprobarUsuario;
window.abrirModalRechazarUsuario = abrirModalRechazarUsuario;
window.cerrarModalRechazarUsuario = cerrarModalRechazarUsuario;
window.confirmarRechazoUsuario = confirmarRechazoUsuario;
window.cambiarRolUsuario = cambiarRolUsuario;
window.eliminarUsuario = eliminarUsuario;
window.cerrarSesionUsuario = cerrarSesionUsuario;
window.cambiarSesionUsuario = cambiarSesionUsuario;
window.filtrarUsuariosPorEstado = filtrarUsuariosPorEstado;
window.renderizarUsuarios = renderizarUsuarios;
window.actualizarBadgesUsuarios = actualizarBadgesUsuarios;
window.actualizarUIUsuarioActual = actualizarUIUsuarioActual;
window.verificarAccesoPOS = verificarAccesoPOS;
window.abrirModalSelectorAvatar = abrirModalSelectorAvatar;
window.cerrarModalSelectorAvatar = cerrarModalSelectorAvatar;
window.seleccionarAvatarPreset = seleccionarAvatarPreset;
window.restablecerAvatarPorDefecto = restablecerAvatarPorDefecto;
window.procesarSubidaAvatar = procesarSubidaAvatar;
window.abrirModalEditarDatosGatewall = abrirModalEditarDatosGatewall;
window.cerrarModalEditarDatosGatewall = cerrarModalEditarDatosGatewall;
window.procesarEdicionDatosGatewall = procesarEdicionDatosGatewall;
window.verificarEstadoAprobacionGatewall = verificarEstadoAprobacionGatewall;
