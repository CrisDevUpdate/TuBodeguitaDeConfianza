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

    const usuario = AppState.usuarioActual;

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
 */
function configurarVistasPorRol(usuario) {
    const esAdmin = usuario.rol === 'admin';

    // Elementos de navegación exclusiva de Administrador
    const adminNavItems = document.querySelectorAll('.nav-admin-only');
    adminNavItems.forEach(el => {
        el.style.display = esAdmin ? '' : 'none';
    });

    // Elementos de navegación exclusiva de Cliente
    const clienteNavItems = document.querySelectorAll('.nav-cliente-only');
    clienteNavItems.forEach(el => {
        el.style.display = esAdmin ? 'none' : '';
    });

    // Encabezado y badges
    actualizarUIUsuarioActual();

    // Redirección inicial según rol si la pestaña activa no corresponde
    const activeTab = document.querySelector('.nav-btn.active')?.getAttribute('data-tab');
    
    if (esAdmin) {
        if (!activeTab || activeTab.startsWith('cliente-')) {
            switchTab('pos');
        }
        if (typeof renderizarUsuarios === 'function') renderizarUsuarios();
        if (typeof renderizarConfiguradorPremioAdmin === 'function') renderizarConfiguradorPremioAdmin();
    } else {
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
    const nombreEl = document.getElementById('gatewall-pending-nombre');
    const cedulaEl = document.getElementById('gatewall-pending-cedula');
    const rolEl = document.getElementById('gatewall-pending-rol');
    const fechaEl = document.getElementById('gatewall-pending-fecha');
    const waBtn = document.getElementById('gatewall-pending-btn-wa');

    if (nombreEl) nombreEl.textContent = usuario.nombre || 'Usuario';
    if (cedulaEl) cedulaEl.textContent = usuario.cedula || usuario.id || 'N/A';
    if (rolEl) rolEl.textContent = (usuario.rol || 'cliente').toUpperCase();
    if (fechaEl) fechaEl.textContent = usuario.fechaRegistro || new Date().toISOString().substring(0, 16);

    if (waBtn) {
        const telefonoLimpio = (usuario.telefono || '').replace(/\D/g, '');
        const msg = encodeURIComponent(`Hola Administrador de Tu Bodeguita de Confianza. Mi nombre es ${usuario.nombre} (Cédula: ${usuario.cedula}). Acabo de registrarme y solicito la aprobación de mi cuenta.`);
        waBtn.href = `https://wa.me/584120000000?text=${msg}`;
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
 * Procesa el inicio de sesión desde el Gatewall con verificación estricta de credenciales
 */
function procesarLoginGatewall(e) {
    if (e && e.preventDefault) e.preventDefault();

    const inputId = document.getElementById('gw-login-id');
    const inputPass = document.getElementById('gw-login-pass');

    const id = (inputId?.value || '').trim();
    const pass = (inputPass?.value || '').trim();

    if (!id || !pass) {
        alert('Por favor ingresa tu Cédula/Correo y Contraseña.');
        return;
    }

    const cleanId = id.toUpperCase();
    const usuario = (AppState.usuarios || []).find(u => 
        (u.cedula || u.id || '').toUpperCase() === cleanId || 
        (u.email || '').toLowerCase() === id.toLowerCase()
    );

    if (!usuario) {
        alert(`No existe una cuenta registrada con "${id}". Puedes registrarte en la pestaña "Registrarse".`);
        return;
    }

    // Validación estricta de contraseña
    if (usuario.password && usuario.password !== pass) {
        alert('Contraseña incorrecta. Verifica tus credenciales.');
        return;
    }

    // Autenticado
    AppState.usuarioActual = usuario;

    if (window.InventoryApp.Persistence) {
        window.InventoryApp.Persistence.guardar(true);
    }

    verificarGatewall();
}

/**
 * Registra usuario desde el formulario del Gatewall
 */
function registrarUsuarioDesdeGatewall(e) {
    if (e && e.preventDefault) e.preventDefault();

    const cedulaInput = document.getElementById('gw-reg-cedula');
    const nombreInput = document.getElementById('gw-reg-nombre');
    const telefonoInput = document.getElementById('gw-reg-telefono');
    const emailInput = document.getElementById('gw-reg-email');
    const passwordInput = document.getElementById('gw-reg-password');
    const rolSelect = document.getElementById('gw-reg-rol');

    const cedula = (cedulaInput?.value || '').trim();
    const nombre = (nombreInput?.value || '').trim();
    const telefono = (telefonoInput?.value || '').trim();
    const email = (emailInput?.value || '').trim().toLowerCase();
    const password = (passwordInput?.value || '').trim();
    const rol = rolSelect ? rolSelect.value : 'cliente';

    if (!cedula || !nombre || !telefono || !email || !password) {
        alert('Todos los campos con (*) son obligatorios: Cédula/RIF, Nombre, Teléfono, Correo y Contraseña.');
        return;
    }

    if (!Array.isArray(AppState.usuarios)) {
        AppState.usuarios = [];
    }

    // Verificar duplicado por cédula
    const existePorCedula = AppState.usuarios.find(u => (u.cedula || u.id).toUpperCase() === cedula.toUpperCase());
    if (existePorCedula) {
        alert(`La Cédula/RIF ${cedula} ya se encuentra registrada con estado: ${existePorCedula.estado}.`);
        return;
    }

    // Verificar duplicado por email
    const existePorEmail = AppState.usuarios.find(u => (u.email || '').toLowerCase() === email);
    if (existePorEmail) {
        alert(`El correo electrónico ${email} ya está registrado.`);
        return;
    }

    const nuevoUsuario = {
        id: cedula,
        cedula: cedula,
        nombre: nombre,
        telefono: telefono,
        email: email,
        password: password,
        rol: rol,
        estado: 'PENDIENTE_APROBACION',
        puntosAcumulados: 0,
        puntosCanjeados: 0,
        fechaRegistro: new Date().toISOString().replace('T', ' ').substring(0, 16),
        fechaAprobacion: null,
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

    // Establecemos como usuario actual para mostrar pantalla de aprobación pendiente
    AppState.usuarioActual = nuevoUsuario;

    // Guardar
    if (window.InventoryApp.Persistence) {
        window.InventoryApp.Persistence.guardar(true);
    }
    if (window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarUsuario === 'function') {
        window.InventoryApp.Firebase.guardarUsuario(nuevoUsuario);
    }

    verificarGatewall();
}

/**
 * Comprueba si la solicitud actual fue aprobada por el Admin
 */
function verificarEstadoAprobacionGatewall() {
    if (!AppState.usuarioActual) {
        cerrarSesionUsuario();
        return;
    }

    const cedula = AppState.usuarioActual.cedula || AppState.usuarioActual.id;
    const actualizado = (AppState.usuarios || []).find(u => (u.cedula || u.id) === cedula);

    if (actualizado) {
        AppState.usuarioActual = actualizado;
        if (actualizado.estado === 'ACTIVO') {
            alert('¡Felicidades! Tu cuenta ha sido APROBADA. Ingresando al sistema...');
        } else if (actualizado.estado === 'RECHAZADO') {
            alert('Tu solicitud fue RECHAZADA. Revisa el motivo especificado.');
        } else {
            alert('Tu solicitud aún se encuentra en revisión.');
        }
        verificarGatewall();
    }
}

/**
 * Registra un nuevo usuario en el sistema con estado predeterminado PENDIENTE_APROBACION
 */
function registrarUsuario(e) {
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

    const nuevoUsuario = {
        id: cedula,
        cedula: cedula,
        nombre: nombre,
        telefono: telefono,
        email: email,
        password: password,
        rol: rol,
        estado: 'PENDIENTE_APROBACION',
        puntosAcumulados: 0,
        puntosCanjeados: 0,
        fechaRegistro: new Date().toISOString().replace('T', ' ').substring(0, 16),
        fechaAprobacion: null,
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

    // Establecemos como usuario actual para mostrar pantalla de aprobación pendiente
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
 * Elimina un usuario del sistema
 */
function eliminarUsuario(cedula) {
    if (!cedula) return;
    if (cedula === 'V-00000001') {
        alert('El Administrador Principal del sistema no puede ser eliminado.');
        return;
    }

    const usuario = (AppState.usuarios || []).find(u => (u.cedula || u.id) === cedula);
    if (!usuario) return;

    if (!confirm(`¿Estás seguro de eliminar permanentemente al usuario ${usuario.nombre} (${cedula})?`)) {
        return;
    }

    AppState.usuarios = AppState.usuarios.filter(u => (u.cedula || u.id) !== cedula);

    if (AppState.usuarioActual && (AppState.usuarioActual.cedula || AppState.usuarioActual.id) === cedula) {
        cerrarSesionUsuario();
        return;
    }

    if (window.InventoryApp.Persistence) window.InventoryApp.Persistence.guardar(true);
    if (window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.eliminarUsuario === 'function') {
        window.InventoryApp.Firebase.eliminarUsuario(cedula);
    }

    renderizarUsuarios();
    actualizarBadgesUsuarios();
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
        if (usuario.rol === 'admin') {
            headerStatus.className = 'badge-status-pill badge-success';
            headerStatus.textContent = 'ADMIN';
        } else {
            headerStatus.className = 'badge-status-pill badge-warning';
            headerStatus.textContent = 'CLIENTE VIP';
        }
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
}

/**
 * Guardia de Seguridad POS
 */
function verificarAccesoPOS(mostrarAlerta = true) {
    const usuario = AppState.usuarioActual;

    if (!usuario) {
        return { permitido: false, razon: 'NO_SESION' };
    }

    if (usuario.rol === 'admin') {
        return { permitido: true, usuario };
    }

    if (usuario.estado === 'ACTIVO') {
        return { permitido: true, usuario };
    }

    return { permitido: false, razon: usuario.estado, usuario };
}

// Exportar funciones a la ventana global
window.verificarGatewall = verificarGatewall;
window.configurarVistasPorRol = configurarVistasPorRol;
window.switchGatewallTab = switchGatewallTab;
window.procesarLoginGatewall = procesarLoginGatewall;
window.registrarUsuario = registrarUsuario;
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
