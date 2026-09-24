/**
 * Regla Fundamental del Negocio: Todo usuario registrado/creado es automáticamente un cliente.
 * Sincroniza la lista de usuarios con la lista de clientes.
 * sincronizarConNube es false por defecto para evitar bucles de escritura infinitos con listeners de Firestore.
 */
function asegurarSincronizacionUsuariosAClientes(sincronizarConNube = false) {
    const usuariosList = Array.isArray(AppState.usuarios) ? AppState.usuarios : (window.usuarios || []);
    if (!Array.isArray(AppState.clientes)) {
        AppState.clientes = [];
    }
    const eliminadosList = Array.isArray(AppState.clientesEliminados) ? AppState.clientesEliminados : (window.clientesEliminados || []);
    let huboCambios = false;

    usuariosList.forEach(u => {
        const idCed = String(u.cedula || u.id || '').trim();
        if (!idCed) return;
        const idUpper = idCed.toUpperCase();
        // SuperAdmin y Autoservicio no generan clientes comerciales repetitivos
        if (idUpper === 'SUPERADMIN' || (u.email || '').toLowerCase() === 'superadmin@tubodeguita.com') return;

        // Si fue eliminado explícitamente y figura en clientesEliminados, respetamos la eliminación
        const estaEliminado = eliminadosList.some(ce => String(ce.id).trim().toUpperCase() === idUpper);
        if (estaEliminado) return;

        let cliente = AppState.clientes.find(c => String(c.id).trim().toUpperCase() === idUpper);
        if (!cliente) {
            cliente = {
                id: idCed,
                nombre: u.nombre || idCed,
                telefono: u.telefono || '',
                email: u.email || ''
            };
            AppState.clientes.push(cliente);
            huboCambios = true;

            // Sincronizar en la nube en Firestore ÚNICAMENTE si se solicitó explícitamente fuera de listeners
            if (sincronizarConNube && window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarCliente === 'function') {
                window.InventoryApp.Firebase.guardarCliente(cliente).catch(err => {
                    console.warn('[Sync Clientes] Error al persistir cliente en Firestore:', err);
                });
            }
        } else {
            let actualizado = false;
            if (u.nombre && cliente.nombre !== u.nombre) {
                cliente.nombre = u.nombre;
                actualizado = true;
            }
            if (u.telefono && cliente.telefono !== u.telefono) {
                cliente.telefono = u.telefono;
                actualizado = true;
            }
            if (u.email && cliente.email !== u.email) {
                cliente.email = u.email;
                actualizado = true;
            }
            if (actualizado) {
                huboCambios = true;
                if (sincronizarConNube && window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarCliente === 'function') {
                    window.InventoryApp.Firebase.guardarCliente(cliente).catch(() => {});
                }
            }
        }
    });

    return huboCambios;
}
window.asegurarSincronizacionUsuariosAClientes = asegurarSincronizacionUsuariosAClientes;

function guardarCliente(e) {
    e.preventDefault();
    const nuevoCliente = {
        id: document.getElementById('cli-id').value.trim(),
        nombre: document.getElementById('cli-nombre').value.trim(),
        telefono: document.getElementById('cli-telefono').value.trim()
    };

    if (!nuevoCliente.id || !nuevoCliente.nombre) {
        alert('Por favor completa el ID y nombre del cliente.');
        return;
    }

    const idx = clientes.findIndex(c => c.id === nuevoCliente.id);
    if (idx !== -1) {
        clientes[idx] = nuevoCliente;
    } else {
        clientes.push(nuevoCliente);
    }

    // Guardar en Firestore
    if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarCliente === 'function') {
        window.InventoryApp.Firebase.guardarCliente(nuevoCliente).catch(err => {
            console.warn('[Clientes] Error al guardar cliente en Firestore:', err);
        });
    }

    // Sincronizar también con la colección de usuarios
    if (!Array.isArray(AppState.usuarios)) AppState.usuarios = [];
    const idxU = AppState.usuarios.findIndex(u => (u.cedula || u.id) === nuevoCliente.id);
    if (idxU === -1) {
        const passHash = (window.InventoryApp?.Helpers?.calcularHashSha256)
            ? window.InventoryApp.Helpers.calcularHashSha256(nuevoCliente.id)
            : nuevoCliente.id;
        const nuevoUsuario = {
            id: nuevoCliente.id,
            cedula: nuevoCliente.id,
            nombre: nuevoCliente.nombre,
            telefono: nuevoCliente.telefono || '',
            email: `${nuevoCliente.id.toLowerCase().replace(/[^a-z0-9]/g, '')}@cliente.com`,
            password: passHash,
            rol: 'cliente',
            estado: 'ACTIVO',
            puntosAcumulados: 0,
            puntosCanjeados: 0,
            fechaRegistro: new Date().toISOString().replace('T', ' ').substring(0, 16),
            fechaAprobacion: new Date().toISOString().replace('T', ' ').substring(0, 16)
        };
        AppState.usuarios.push(nuevoUsuario);
        if (window.InventoryApp?.Firebase?.guardarUsuario) {
            window.InventoryApp.Firebase.guardarUsuario(nuevoUsuario).catch(() => {});
        }
        if (typeof renderizarUsuarios === 'function') renderizarUsuarios();
        if (typeof actualizarBadgesUsuarios === 'function') actualizarBadgesUsuarios();
    } else {
        AppState.usuarios[idxU].nombre = nuevoCliente.nombre;
        if (nuevoCliente.telefono) AppState.usuarios[idxU].telefono = nuevoCliente.telefono;
        if (window.InventoryApp?.Firebase?.guardarUsuario) {
            window.InventoryApp.Firebase.guardarUsuario(AppState.usuarios[idxU]).catch(() => {});
        }
    }

    document.getElementById('form-cliente').reset();
    actualizarSelectClientes();
    if (typeof actualizarSelectTransacciones === 'function') actualizarSelectTransacciones();
    renderizarClientes();
}

function actualizarSelectClientes() {
    if (typeof asegurarSincronizacionUsuariosAClientes === 'function') {
        asegurarSincronizacionUsuariosAClientes();
    }
    const select = document.getElementById('pos-cliente-select');
    const selectMobile = document.getElementById('pos-cliente-select-mobile');
    if (!select && !selectMobile) return;
    const lista = Array.isArray(clientes) ? clientes : (AppState.clientes || []);
    const optionsHTML = lista.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    if (select) select.innerHTML = optionsHTML;
    if (selectMobile) selectMobile.innerHTML = optionsHTML;
}

function calcularEstadoFinancieroCliente(clienteId) {
    if (!clienteId) return { totalCompradoUSD: 0, totalCompradoVES: 0, saldoDeudaUSD: 0, saldoDeudaVES: 0 };

    const clientesList = Array.isArray(clientes) ? clientes : (AppState.clientes || []);
    const clienteObj = clientesList.find(c => 
        String(c.id).toUpperCase() === String(clienteId).toUpperCase() ||
        (c.cedula && String(c.cedula).toUpperCase() === String(clienteId).toUpperCase()) ||
        (c.usuarioId && String(c.usuarioId).toUpperCase() === String(clienteId).toUpperCase())
    );

    const keys = new Set();
    keys.add(String(clienteId).toUpperCase());
    if (clienteObj) {
        if (clienteObj.id) keys.add(String(clienteObj.id).toUpperCase());
        if (clienteObj.cedula) keys.add(String(clienteObj.cedula).toUpperCase());
        if (clienteObj.usuarioId) keys.add(String(clienteObj.usuarioId).toUpperCase());
        if (clienteObj.nombre) keys.add(String(clienteObj.nombre).trim().toUpperCase());
    }

    const ventasList = Array.isArray(ventas) ? ventas : (AppState.ventas || []);
    const abonosList = Array.isArray(abonos) ? abonos : (AppState.abonos || []);

    const ventasCli = ventasList.filter(v => {
        if (!v) return false;
        const vCId = String(v.clienteId || '').toUpperCase();
        const vCCed = String(v.clienteCedula || '').toUpperCase();
        const vUId = String(v.usuarioId || '').toUpperCase();
        return keys.has(vCId) || keys.has(vCCed) || keys.has(vUId);
    });

    const abonosCli = abonosList.filter(a => {
        if (!a) return false;
        const aCId = String(a.clienteId || '').toUpperCase();
        const aCCed = String(a.clienteCedula || '').toUpperCase();
        const aUId = String(a.usuarioId || '').toUpperCase();
        const coincide = keys.has(aCId) || keys.has(aCCed) || keys.has(aUId);
        return coincide && (a.estado === 'Pago agregado' || a.estado === 'Confirmado' || !a.estado);
    });

    const totalCompradoUSD = ventasCli.reduce((sum, v) => sum + Number(v.total || 0), 0);
    const totalCreditoUSD = ventasCli.filter(v => v.tipo === 'Crédito' || v.tipoPago === 'Crédito').reduce((sum, v) => sum + Number(v.total || 0), 0);
    
    let totalAbonadoUSD = 0;
    abonosCli.forEach(a => {
        const { montoUSD } = typeof sanitizarAbonoMonedas === 'function'
            ? sanitizarAbonoMonedas(a, tasaActiva)
            : { montoUSD: Number(a.montoUSD || 0) };
        totalAbonadoUSD += montoUSD;
    });

    const deudaDirecta = Number(clienteObj?.deudaInicialUSD ?? clienteObj?.deudaUSD ?? 0);
    const totalCreditoEfectivo = totalCreditoUSD > 0 ? totalCreditoUSD : deudaDirecta;

    const saldoDeudaUSD = Math.max(0, totalCreditoEfectivo - totalAbonadoUSD);

    return {
        totalCompradoUSD: Math.max(totalCompradoUSD, totalCreditoEfectivo),
        totalCompradoVES: Math.max(totalCompradoUSD, totalCreditoEfectivo) * tasaActiva,
        saldoDeudaUSD,
        saldoDeudaVES: saldoDeudaUSD * tasaActiva
    };
}

let busquedaCliente = '';
let filtroEstadoCliente = 'todos'; // 'todos' | 'deuda' | 'al-dia'

function toggleFormularioNuevoCliente() {
    const form = document.getElementById('form-cliente');
    const txt = document.getElementById('txt-toggle-nuevo-cliente');
    const icono = document.getElementById('icono-toggle-nuevo-cliente');
    if (!form) return;
    const estaOculto = form.style.display === 'none' || !form.style.display;
    if (estaOculto) {
        form.style.display = 'grid';
        if (txt) txt.textContent = 'Ocultar';
        if (icono) {
            icono.classList.remove('fa-chevron-down');
            icono.classList.add('fa-chevron-up');
        }
        const primerInput = document.getElementById('cli-id');
        if (primerInput) setTimeout(() => primerInput.focus(), 50);
    } else {
        form.style.display = 'none';
        if (txt) txt.textContent = '+ Agregar';
        if (icono) {
            icono.classList.remove('fa-chevron-up');
            icono.classList.add('fa-chevron-down');
        }
    }
}
window.toggleFormularioNuevoCliente = toggleFormularioNuevoCliente;

function alBuscarCliente(val) {
    busquedaCliente = (val || '').toLowerCase().trim();
    const btnLimpiar = document.getElementById('btn-limpiar-buscar-cliente');
    if (btnLimpiar) btnLimpiar.style.display = busquedaCliente ? 'block' : 'none';
    renderizarClientes();
}
window.alBuscarCliente = alBuscarCliente;

function limpiarBuscadorCliente() {
    busquedaCliente = '';
    const input = document.getElementById('input-buscar-cliente');
    if (input) input.value = '';
    const btnLimpiar = document.getElementById('btn-limpiar-buscar-cliente');
    if (btnLimpiar) btnLimpiar.style.display = 'none';
    renderizarClientes();
}
window.limpiarBuscadorCliente = limpiarBuscadorCliente;

function filtrarClientesEstado(estado) {
    filtroEstadoCliente = estado || 'todos';
    ['todos', 'deuda', 'al-dia'].forEach(st => {
        const chip = document.getElementById(`chip-cli-${st}`);
        if (chip) {
            if (st === filtroEstadoCliente) chip.classList.add('active');
            else chip.classList.remove('active');
        }
    });
    renderizarClientes();
}
window.filtrarClientesEstado = filtrarClientesEstado;

function asegurarClientesOficiales() {
    if (typeof CLIENTES_OFICIALES !== 'undefined' && Array.isArray(CLIENTES_OFICIALES)) {
        if (!Array.isArray(clientes) || clientes.length === 0) {
            clientes = JSON.parse(JSON.stringify(CLIENTES_OFICIALES));
            AppState.clientes = clientes;
        } else {
            CLIENTES_OFICIALES.forEach(co => {
                const existe = clientes.some(c => c.id === co.id || (c.nombre && c.nombre.trim().toLowerCase() === co.nombre.trim().toLowerCase()));
                if (!existe) {
                    clientes.push(JSON.parse(JSON.stringify(co)));
                }
            });
        }
    }
}

function renderizarClientes() {
    asegurarClientesOficiales();
    if (typeof asegurarSincronizacionUsuariosAClientes === 'function') {
        asegurarSincronizacionUsuariosAClientes();
    }
    const tbody = document.getElementById('clientes-body');
    const mobileList = document.getElementById('clientes-mobile-list');
    if (!tbody && !mobileList) return;

    const lista = Array.isArray(clientes) ? clientes : (AppState.clientes || []);
    const tasa = typeof tasaActiva === 'number' && tasaActiva > 0 ? tasaActiva : (AppState.tasaActiva || 1);

    // Calcular métricas financieras globales para los KPIs
    let clientesConDeuda = 0;
    let totalDeudaGlobalUSD = 0;

    const clientesConEstado = lista.map(c => {
        const estadoFin = calcularEstadoFinancieroCliente(c.id);
        if (estadoFin.saldoDeudaUSD > 0) {
            clientesConDeuda++;
            totalDeudaGlobalUSD += estadoFin.saldoDeudaUSD;
        }
        return {
            ...c,
            ...estadoFin
        };
    });

    // Actualizar KPIs de Cartera en cabecera
    const kpiTotalCli = document.getElementById('cli-kpi-total-clientes');
    if (kpiTotalCli) kpiTotalCli.textContent = lista.length;

    const kpiConDeuda = document.getElementById('cli-kpi-con-deuda');
    if (kpiConDeuda) kpiConDeuda.textContent = clientesConDeuda;

    const kpiDeudaUsd = document.getElementById('cli-kpi-total-deuda-usd');
    if (kpiDeudaUsd) kpiDeudaUsd.textContent = `$${totalDeudaGlobalUSD.toFixed(2)}`;

    const kpiDeudaVes = document.getElementById('cli-kpi-total-deuda-ves');
    if (kpiDeudaVes) {
        kpiDeudaVes.textContent = `Bs. ${tasa > 0 ? (totalDeudaGlobalUSD * tasa).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}`;
    }

    // Actualizar contadores en chips de filtro
    const countTodos = document.getElementById('count-cli-todos');
    if (countTodos) countTodos.textContent = lista.length;

    const countDeuda = document.getElementById('count-cli-deuda');
    if (countDeuda) countDeuda.textContent = clientesConDeuda;

    const countAlDia = document.getElementById('count-cli-al-dia');
    if (countAlDia) countAlDia.textContent = Math.max(0, lista.length - clientesConDeuda);

    const countEliminados = document.getElementById('count-cli-eliminados');
    if (countEliminados) {
        const eliminadosList = Array.isArray(clientesEliminados) ? clientesEliminados : (AppState.clientesEliminados || []);
        countEliminados.textContent = eliminadosList.length;
    }

    // Filtrar lista según búsqueda y estado
    let clientesFiltrados = clientesConEstado.filter(c => {
        // Filtro por estado
        if (filtroEstadoCliente === 'deuda' && c.saldoDeudaUSD <= 0) return false;
        if (filtroEstadoCliente === 'al-dia' && c.saldoDeudaUSD > 0) return false;

        // Filtro por texto de búsqueda
        if (busquedaCliente) {
            const idLower = String(c.id || '').toLowerCase();
            const nomLower = String(c.nombre || '').toLowerCase();
            const telLower = String(c.telefono || '').toLowerCase();
            if (!idLower.includes(busquedaCliente) && !nomLower.includes(busquedaCliente) && !telLower.includes(busquedaCliente)) {
                return false;
            }
        }
        return true;
    });

    const counterBadge = document.getElementById('cli-counter-badge');
    if (counterBadge) {
        if (busquedaCliente || filtroEstadoCliente !== 'todos') {
            counterBadge.textContent = `Mostrando ${clientesFiltrados.length} de ${lista.length} clientes`;
        } else {
            counterBadge.textContent = `${lista.length} clientes registrados`;
        }
    }

    if (!clientesFiltrados.length) {
        const mensajeVacio = lista.length === 0
            ? 'No hay clientes registrados en el directorio.'
            : 'No se encontraron clientes que coincidan con la búsqueda o filtro seleccionado.';

        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:35px 20px; color:var(--text-muted);"><i class="fas fa-search" style="font-size:1.8rem; opacity:0.35; margin-bottom:10px; display:block;"></i>${mensajeVacio}</td></tr>`;
        }
        if (mobileList) {
            mobileList.innerHTML = `<div class="card" style="text-align:center; padding:35px 20px; color:var(--text-muted); border-radius:14px;"><i class="fas fa-search" style="font-size:2rem; opacity:0.35; margin-bottom:10px; display:block;"></i>${mensajeVacio}</div>`;
        }
        return;
    }

    if (tbody) {
        const usuariosList = Array.isArray(AppState.usuarios) ? AppState.usuarios : (window.usuarios || []);

        tbody.innerHTML = clientesFiltrados.map(c => {
            const idSafe = typeof escaparHtmlInventario === 'function' ? escaparHtmlInventario(c.id) : c.id;
            const nomSafe = typeof escaparHtmlInventario === 'function' ? escaparHtmlInventario(c.nombre || c.id) : (c.nombre || c.id);
            const telSafe = typeof escaparHtmlInventario === 'function' ? escaparHtmlInventario(c.telefono || '—') : (c.telefono || '—');
            const tieneDeuda = c.saldoDeudaUSD > 0;

            const userVinculado = usuariosList.find(u => 
                u.clienteId === c.id || 
                (u.cedula && String(u.cedula).toUpperCase() === String(c.id).toUpperCase()) ||
                (c.cedula && String(u.cedula).toUpperCase() === String(c.cedula).toUpperCase()) ||
                (c.usuarioId && String(u.id).toUpperCase() === String(c.usuarioId).toUpperCase())
            );
            const userBadge = userVinculado 
                ? `<span class="badge" style="background:rgba(22,163,74,0.1); color:#15803d; font-size:0.7rem; padding:2px 6px; border-radius:4px; margin-left:6px; font-weight:600;" title="Cuenta de usuario activa: ${userVinculado.cedula}"><i class="fas fa-user-check"></i> Usuario: ${userVinculado.cedula}</span>`
                : `<span class="badge" style="background:rgba(100,116,139,0.08); color:var(--text-muted); font-size:0.7rem; padding:2px 6px; border-radius:4px; margin-left:6px;" title="Sin cuenta de usuario creada aún"><i class="fas fa-user-clock"></i> Sin usuario</span>`;

            return `
                <tr>
                    <td><strong>${idSafe}</strong></td>
                    <td style="font-weight:600; color:var(--text-main);">
                        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                            <span>${nomSafe}</span>
                            ${userBadge}
                        </div>
                    </td>
                    <td>${telSafe}</td>
                    <td class="num">$${c.totalCompradoUSD.toFixed(2)}</td>
                    <td class="num" style="color: ${tieneDeuda ? 'var(--danger)' : '#16a34a'}; font-weight: bold;">
                        $${c.saldoDeudaUSD.toFixed(2)}
                    </td>
                    <td class="num" style="color: ${tieneDeuda ? 'var(--danger)' : '#16a34a'}; font-weight: bold;">
                        Bs. ${tasa > 0 ? c.saldoDeudaVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                    </td>
                    <td style="text-align:center; white-space:nowrap;">
                        <div style="display:inline-flex; gap:6px; align-items:center;">
                            <button type="button" class="btn btn-sm btn-primary" onclick="verDetalleCliente('${c.id}')" style="display:inline-flex; align-items:center; gap:5px; font-weight:600; padding:5px 10px; border-radius:8px;">
                                <i class="fas fa-gauge"></i> Panel 360°
                            </button>
                            <button type="button" class="btn btn-sm btn-outline-danger" onclick="abrirModalEliminarCliente('${c.id}')" title="Eliminar cliente" style="padding:5px 9px; border-radius:8px;">
                                <i class="fas fa-trash-can"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    if (mobileList) {
        const usuariosList = Array.isArray(AppState.usuarios) ? AppState.usuarios : (window.usuarios || []);

        mobileList.innerHTML = clientesFiltrados.map(c => {
            const idSafe = typeof escaparHtmlInventario === 'function' ? escaparHtmlInventario(c.id) : c.id;
            const nomSafe = typeof escaparHtmlInventario === 'function' ? escaparHtmlInventario(c.nombre || c.id) : (c.nombre || c.id);
            const telSafe = typeof escaparHtmlInventario === 'function' ? escaparHtmlInventario(c.telefono || '—') : (c.telefono || '—');
            const tieneDeuda = c.saldoDeudaUSD > 0;
            const iniciales = (c.nombre || c.id || 'CL')
                .split(' ')
                .map(w => w[0])
                .filter(Boolean)
                .slice(0, 2)
                .join('')
                .toUpperCase();

            const userVinculado = usuariosList.find(u => 
                u.clienteId === c.id || 
                (u.cedula && String(u.cedula).toUpperCase() === String(c.id).toUpperCase()) ||
                (c.cedula && String(u.cedula).toUpperCase() === String(c.cedula).toUpperCase()) ||
                (c.usuarioId && String(u.id).toUpperCase() === String(c.usuarioId).toUpperCase())
            );
            const userBadge = userVinculado 
                ? `<span class="badge" style="background:rgba(22,163,74,0.1); color:#15803d; font-size:0.68rem; padding:1px 5px; border-radius:4px; font-weight:600;"><i class="fas fa-user-check"></i> Usuario: ${userVinculado.cedula}</span>`
                : `<span class="badge" style="background:rgba(100,116,139,0.08); color:var(--text-muted); font-size:0.68rem; padding:1px 5px; border-radius:4px;"><i class="fas fa-user-clock"></i> Sin usuario</span>`;

            return `
                <div class="clientes-item-card">
                    <div class="clientes-item-top">
                        <div class="clientes-item-avatar">
                            <span>${iniciales}</span>
                        </div>
                        <div class="clientes-item-info">
                            <div class="clientes-item-name" style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                                <span>${nomSafe}</span>
                                ${userBadge}
                            </div>
                            <div class="clientes-item-meta">
                                <span><i class="fas fa-id-card"></i> ${idSafe}</span>
                                ${c.telefono ? `<span><i class="fas fa-phone"></i> ${telSafe}</span>` : ''}
                            </div>
                        </div>
                        <div class="clientes-item-financial">
                            ${tieneDeuda ? `
                                <div class="clientes-item-deuda-pill badge-danger">
                                    <span class="lbl">Deuda</span>
                                    <span class="val">$${c.saldoDeudaUSD.toFixed(2)}</span>
                                    <small class="sub">Bs. ${tasa > 0 ? c.saldoDeudaVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</small>
                                </div>
                            ` : `
                                <div class="clientes-item-deuda-pill badge-success">
                                    <span class="val"><i class="fas fa-check-circle"></i> Al día</span>
                                    <small class="sub">$0.00</small>
                                </div>
                            `}
                        </div>
                    </div>
                    <div class="clientes-item-bottom">
                        <div class="clientes-item-comprado">
                            <span class="lbl">Comprado total:</span>
                            <span class="val">$${c.totalCompradoUSD.toFixed(2)}</span>
                        </div>
                        <div class="clientes-item-actions">
                            <button type="button" class="btn btn-sm btn-primary" onclick="verDetalleCliente('${c.id}')" style="display:inline-flex; align-items:center; gap:5px; font-weight:600; padding:6px 12px; border-radius:8px;">
                                <i class="fas fa-gauge"></i> Panel 360°
                            </button>
                            <button type="button" class="btn btn-sm btn-outline-danger" onclick="abrirModalEliminarCliente('${c.id}')" title="Eliminar cliente" style="padding:6px 10px; border-radius:8px;">
                                <i class="fas fa-trash-can"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

function abrirModalEliminarCliente(clienteId) {
    const cliente = clientes.find(c => c.id === clienteId);
    if (!cliente) return;

    const modal = document.getElementById('modal-eliminar-cliente');
    if (!modal) return;

    const estado = calcularEstadoFinancieroCliente(clienteId);
    document.getElementById('eliminar-cliente-id').value = cliente.id;
    document.getElementById('eliminar-cliente-identificador').value = cliente.id;
    document.getElementById('eliminar-cliente-nombre').value = cliente.nombre;
    document.getElementById('eliminar-cliente-telefono').value = cliente.telefono || '';
    document.getElementById('eliminar-cliente-deuda').value = `$${estado.saldoDeudaUSD.toFixed(2)}`;
    document.getElementById('eliminar-cliente-motivo').value = '';
    document.getElementById('eliminar-cliente-comentario').value = '';
    modal.classList.add('active');
    setTimeout(() => document.getElementById('eliminar-cliente-motivo').focus(), 50);
}

function cerrarModalEliminarCliente() {
    const modal = document.getElementById('modal-eliminar-cliente');
    if (modal) modal.classList.remove('active');
}

function confirmarEliminacionCliente(event) {
    event.preventDefault();

    const clienteId = document.getElementById('eliminar-cliente-id').value;
    const motivo = document.getElementById('eliminar-cliente-motivo').value.trim();
    const comentario = document.getElementById('eliminar-cliente-comentario').value.trim();
    const indice = clientes.findIndex(c => c.id === clienteId);
    if (indice === -1) {
        cerrarModalEliminarCliente();
        return;
    }
    if (!motivo || !comentario) {
        alert('Debes indicar el motivo y el comentario para eliminar al cliente.');
        return;
    }

    const cliente = clientes[indice];
    const estado = calcularEstadoFinancieroCliente(clienteId);
    const fecha = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const registroEliminado = {
        id: cliente.id,
        nombre: cliente.nombre,
        telefono: cliente.telefono,
        fecha,
        totalCompradoUSD: estado.totalCompradoUSD,
        deudaUSD: estado.saldoDeudaUSD,
        perdidaUSD: Math.max(0, estado.saldoDeudaUSD),
        motivo,
        comentario
    };
    clientesEliminados.push(registroEliminado);

    // No se borran ventas ni abonos: se conservan para auditoría y el historial financiero.
    clientes.splice(indice, 1);

    // Sincronizar eliminación en Firestore
    if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.eliminarCliente === 'function') {
        window.InventoryApp.Firebase.eliminarCliente(clienteId, registroEliminado).catch(err => {
            console.warn('[Clientes] Error al eliminar cliente en Firestore:', err);
        });
    }

    if (clienteSeleccionadoId === clienteId) {
        clienteSeleccionadoId = null;
        const detalle = document.getElementById('cliente-detalle-card');
        if (detalle) detalle.style.display = 'none';
    }

    cerrarModalEliminarCliente();
    actualizarSelectClientes();
    renderizarClientes();
    renderizarHistorialClientesEliminados();
    renderizarResumenPerdidasEconomicas();

    alert(`Cliente ${cliente.nombre} eliminado correctamente. El historial de ventas y pagos se conservó.`);
}

function renderizarHistorialClientesEliminados() {
    const tbody = document.getElementById('clientes-eliminados-body');
    if (!tbody) return;

    tbody.innerHTML = clientesEliminados.length ? clientesEliminados.slice().reverse().map(c => `
        <tr>
            <td>${c.fecha}</td>
            <td>${c.id}</td>
            <td>${c.nombre}</td>
            <td class="num">$${Number(c.deudaUSD || 0).toFixed(2)}</td>
            <td class="num" style="color:${Number(c.perdidaUSD || 0) > 0 ? 'var(--danger)' : 'var(--text-muted)'}; font-weight:700;">${Number(c.perdidaUSD || 0) > 0 ? '-$' : '$'}${Number(c.perdidaUSD || 0).toFixed(2)}</td>
            <td>${c.motivo}</td>
            <td>${c.comentario}</td>
        </tr>
    `).join('') : `<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">No hay clientes eliminados.</td></tr>`;
}

function limpiarHistorialClientesEliminados() {
    if (!clientesEliminados.length) return;
    if (!confirm('¿Seguro que deseas limpiar el historial de clientes eliminados? Esto no restaurará los clientes.')) return;
    clientesEliminados = [];
    renderizarHistorialClientesEliminados();
    renderizarResumenPerdidasEconomicas();
}

function verDetalleCliente(id, abrirModal = true) {
    clienteSeleccionadoId = id;
    const lista = Array.isArray(clientes) ? clientes : (AppState.clientes || []);
    const cliente = lista.find(c => c.id === id);
    if (!cliente) return;

    const tasa = typeof tasaActiva === 'number' && tasaActiva > 0 ? tasaActiva : (AppState.tasaActiva || 1);
    const { totalCompradoUSD, totalCompradoVES, saldoDeudaUSD, saldoDeudaVES } = calcularEstadoFinancieroCliente(id);
    const tieneDeuda = saldoDeudaUSD > 0;
    const iniciales = (cliente.nombre || cliente.id || 'CL')
        .split(' ')
        .map(w => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase();

    // Actualizar cabecera del modal
    const avatarEl = document.getElementById('det-cliente-avatar');
    if (avatarEl) avatarEl.textContent = iniciales;

    const nombreEl = document.getElementById('det-cliente-nombre');
    if (nombreEl) nombreEl.textContent = cliente.nombre || cliente.id;

    const badgeEstadoEl = document.getElementById('det-cliente-estado-badge');
    if (badgeEstadoEl) {
        if (tieneDeuda) {
            badgeEstadoEl.className = 'det-status-badge badge-danger';
            badgeEstadoEl.innerHTML = `<i class="fas fa-triangle-exclamation"></i> Deuda: $${saldoDeudaUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        } else {
            badgeEstadoEl.className = 'det-status-badge badge-success';
            badgeEstadoEl.innerHTML = `<i class="fas fa-check-circle"></i> Al día ($0.00)`;
        }
    }

    const idTextEl = document.getElementById('det-cliente-id-text');
    if (idTextEl) idTextEl.innerHTML = `<i class="fas fa-id-card"></i> Cédula: <strong>${cliente.id}</strong>`;

    const telTextEl = document.getElementById('det-cliente-tel-text');
    if (telTextEl) telTextEl.innerHTML = `<i class="fas fa-phone"></i> Tel: <strong>${cliente.telefono || '—'}</strong>`;

    // Botón WhatsApp
    const btnWa = document.getElementById('det-btn-whatsapp');
    if (btnWa) {
        if (cliente.telefono && cliente.telefono.trim()) {
            btnWa.style.display = 'inline-flex';
        } else {
            btnWa.style.display = 'none';
        }
    }

    // KPIs del modal con formato de miles
    const compUsdEl = document.getElementById('det-kpi-comprado-usd');
    if (compUsdEl) compUsdEl.textContent = `$${totalCompradoUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const compVesEl = document.getElementById('det-kpi-comprado-ves');
    if (compVesEl) compVesEl.textContent = `Bs. ${tasa > 0 ? totalCompradoVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}`;

    const deudaUsdEl = document.getElementById('det-kpi-deuda-usd');
    if (deudaUsdEl) deudaUsdEl.textContent = `$${saldoDeudaUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const deudaVesEl = document.getElementById('det-kpi-deuda-ves');
    if (deudaVesEl) deudaVesEl.textContent = `Bs. ${tasa > 0 ? saldoDeudaVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}`;

    const deudaCardEl = document.getElementById('det-kpi-deuda-card');
    if (deudaCardEl) {
        deudaCardEl.className = tieneDeuda ? 'det-kpi-card danger' : 'det-kpi-card';
    }

    // Construir lista de transacciones
    const listaVentas = Array.isArray(ventas) ? ventas : (AppState.ventas || []);
    const listaAbonos = Array.isArray(abonos) ? abonos : (AppState.abonos || []);

    const transacciones = [];
    listaVentas.filter(v => v.clienteId === id).forEach(v => {
        transacciones.push({
            tipoOperacion: 'cargo',
            fecha: v.fecha,
            concepto: `Venta (${v.tipo || 'Contado'})`,
            detalle: (v.items || []).map(i => `${i.cantidad}x ${i.nombre}`).join(', ') || 'Compra de productos',
            cargoUSD: v.tipo === 'Crédito' ? Number(v.total || 0) : 0,
            abonoUSD: 0,
            montoPagoVES: '-'
        });
    });

    listaAbonos.filter(a => a.clienteId === id).forEach(a => {
        const aprobado = a.estado === 'Pago agregado' || a.estado === 'Confirmado' || !a.estado;
        const { esDivisa, montoUSD, montoVES } = typeof sanitizarAbonoMonedas === 'function'
            ? sanitizarAbonoMonedas(a, tasa)
            : { esDivisa: false, montoUSD: Number(a.montoUSD || 0), montoVES: Number(a.montoVES || 0) };

        const nombreMetodo = a.formaPago || a.metodo || 'Abono';
        const badgeMoneda = esDivisa ? ' (Divisas $)' : ' (Bs. VES)';
        transacciones.push({
            tipoOperacion: 'abono',
            fecha: a.fecha,
            concepto: aprobado ? `Abono / Pago${badgeMoneda}` : `Pago (${a.estado})${badgeMoneda}`,
            detalle: a.referencia && a.referencia !== 'N/A' && a.referencia !== 'Sin Ref' ? `${nombreMetodo} · Ref. ${a.referencia}` : nombreMetodo,
            cargoUSD: 0,
            abonoUSD: aprobado ? montoUSD : 0,
            montoPagoVES: montoVES > 0 ? `Bs. ${Number(montoVES).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-',
            pendiente: !aprobado
        });
    });

    if (typeof transaccionesPendientesCliente === 'function') {
        transacciones.push(...transaccionesPendientesCliente(id));
    }

    transacciones.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    // Actualizar badge contador
    const countEl = document.getElementById('det-movimientos-contador');
    if (countEl) {
        countEl.textContent = `${transacciones.length} movimiento${transacciones.length === 1 ? '' : 's'}`;
    }

    let saldoAcumuladoUSD = 0;
    const rowsDesktop = [];
    const cardsMobile = [];

    if (!transacciones.length) {
        const mensajeVacio = `
            <div style="text-align:center; padding:32px 16px; color:var(--text-muted, #64748b);">
                <i class="fas fa-folder-open" style="font-size:2rem; opacity:0.35; margin-bottom:8px; display:block;"></i>
                No hay movimientos registrados para este cliente.
            </div>
        `;
        const tbody = document.getElementById('det-historial-body');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:32px 16px; color:var(--text-muted);">${mensajeVacio}</td></tr>`;
        }
        const mobileContainer = document.getElementById('det-historial-mobile');
        if (mobileContainer) {
            mobileContainer.innerHTML = mensajeVacio;
        }
    } else {
        transacciones.forEach(t => {
            saldoAcumuladoUSD += (t.cargoUSD - t.abonoUSD);
            const saldoVES = tasa > 0 ? (saldoAcumuladoUSD * tasa) : 0;
            const saldoEsDeudor = saldoAcumuladoUSD > 0;
            const esCargo = t.cargoUSD > 0;
            const esAbono = t.abonoUSD > 0;

            // Fila Desktop
            rowsDesktop.push(`
                <tr>
                    <td style="white-space:nowrap; padding:8px 10px;">${t.fecha}</td>
                    <td style="padding:8px 10px;">
                        ${t.concepto}
                        ${t.pendiente ? `<span class="transaction-badge transaction-pending" style="font-size:0.7rem; margin-left:4px;">Confirmando</span>` : ''}
                    </td>
                    <td style="padding:8px 10px; max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escaparHtmlInventario ? escaparHtmlInventario(t.detalle) : t.detalle}">
                        ${escaparHtmlInventario ? escaparHtmlInventario(t.detalle) : t.detalle}
                    </td>
                    <td class="num" style="padding:8px 10px; color:${esCargo ? '#dc2626' : 'inherit'}; font-weight:${esCargo ? '700' : 'normal'};">
                        ${esCargo ? `$${t.cargoUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td class="num" style="padding:8px 10px; color:${esAbono ? '#16a34a' : 'inherit'}; font-weight:${esAbono ? '700' : 'normal'};">
                        ${esAbono ? `$${t.abonoUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td class="num" style="padding:8px 10px;">${t.montoPagoVES}</td>
                    <td class="num" style="padding:8px 10px; font-weight:bold; color:${saldoEsDeudor ? 'var(--danger, #dc2626)' : '#16a34a'};">
                        $${saldoAcumuladoUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td class="num" style="padding:8px 10px; font-weight:bold; color:${saldoEsDeudor ? 'var(--danger, #dc2626)' : '#16a34a'};">
                        Bs. ${tasa > 0 ? saldoVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                    </td>
                </tr>
            `);

            // Tarjeta Mobile Ergonómica (sin scroll horizontal)
            cardsMobile.push(`
                <div class="det-tx-card">
                    <div class="det-tx-top">
                        <div class="det-tx-title-group">
                            <div class="det-tx-icon ${esAbono ? 'det-tx-icon-abono' : 'det-tx-icon-cargo'}">
                                <i class="fas ${esAbono ? 'fa-hand-holding-dollar' : 'fa-cart-shopping'}"></i>
                            </div>
                            <div style="min-width:0;">
                                <div class="det-tx-title">${t.concepto}</div>
                                <div style="font-size:0.72rem; color:#64748b;">${t.fecha}</div>
                            </div>
                        </div>
                        <div class="det-tx-amount ${esAbono ? 'det-tx-amount-abono' : 'det-tx-amount-cargo'}">
                            ${esCargo ? `+$${t.cargoUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                            ${esAbono ? `-$${t.abonoUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                            ${!esCargo && !esAbono ? '$0.00' : ''}
                        </div>
                    </div>
                    ${t.detalle ? `<div class="det-tx-details">${escaparHtmlInventario ? escaparHtmlInventario(t.detalle) : t.detalle}</div>` : ''}
                    <div class="det-tx-meta">
                        <span>Saldo resultante:</span>
                        <span class="det-tx-balance" style="color:${saldoEsDeudor ? '#dc2626' : '#16a34a'};">
                            <strong>$${saldoAcumuladoUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                            ${tasa > 0 ? `<small style="color:#64748b; margin-left:4px;">(Bs. ${saldoVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</small>` : ''}
                        </span>
                    </div>
                </div>
            `);
        });

        const tbody = document.getElementById('det-historial-body');
        if (tbody) tbody.innerHTML = rowsDesktop.join('');

        const mobileContainer = document.getElementById('det-historial-mobile');
        if (mobileContainer) mobileContainer.innerHTML = cardsMobile.join('');
    }

    // Abrir modal si abrirModal es verdadero
    const modal = document.getElementById('modal-cliente-detalle');
    if (modal && (abrirModal || modal.classList.contains('active'))) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}
window.verDetalleCliente = verDetalleCliente;

function cerrarModalDetalleCliente() {
    const modal = document.getElementById('modal-cliente-detalle');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
}
window.cerrarModalDetalleCliente = cerrarModalDetalleCliente;

function enviarWhatsappCliente() {
    if (!clienteSeleccionadoId) return;
    const lista = Array.isArray(clientes) ? clientes : (AppState.clientes || []);
    const cliente = lista.find(c => c.id === clienteSeleccionadoId);
    if (!cliente || !cliente.telefono) {
        alert('Este cliente no tiene número de teléfono registrado.');
        return;
    }
    const tasa = typeof tasaActiva === 'number' && tasaActiva > 0 ? tasaActiva : (AppState.tasaActiva || 1);
    const { saldoDeudaUSD, saldoDeudaVES } = calcularEstadoFinancieroCliente(cliente.id);
    let tel = cliente.telefono.replace(/[^0-9]/g, '');
    if (tel.startsWith('0')) {
        tel = '58' + tel.substring(1);
    } else if (tel.length === 10 && !tel.startsWith('58')) {
        tel = '58' + tel;
    }

    let mensaje = '';
    if (saldoDeudaUSD > 0) {
        mensaje = `Hola ${cliente.nombre}, le saludamos cordialmente de Tu Bodeguita de Confianza. Le informamos que mantiene un saldo pendiente en cuenta de $${saldoDeudaUSD.toFixed(2)} (equivalente a Bs. ${tasa > 0 ? saldoDeudaVES.toFixed(2) : '0.00'}). Agradecemos su gentil atención para coordinar su abono o pago. ¡Muchas gracias!`;
    } else {
        mensaje = `Hola ${cliente.nombre}, le saludamos de Tu Bodeguita de Confianza. Le confirmamos que su cuenta se encuentra actualmente al día con saldo $0.00. ¡Muchas gracias por su preferencia!`;
    }

    const url = `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
}
window.enviarWhatsappCliente = enviarWhatsappCliente;

// Listener para cerrar modal con tecla Escape
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        const modal = document.getElementById('modal-cliente-detalle');
        if (modal && modal.classList.contains('active')) {
            cerrarModalDetalleCliente();
        }
    }
});

