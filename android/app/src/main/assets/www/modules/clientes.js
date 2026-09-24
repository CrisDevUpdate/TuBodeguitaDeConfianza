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

        // Si el usuario ya está vinculado a un cliente existente (por clienteId, usuarioId o cédula),
        // no debemos crear un nuevo cliente duplicado. Buscamos primero si ya existe un cliente vinculado.
        let cliente = AppState.clientes.find(c => {
            const cId = String(c.id || '').trim().toUpperCase();
            const cCed = String(c.cedula || '').trim().toUpperCase();
            const cUid = String(c.usuarioId || '').trim().toUpperCase();
            const uId = String(u.id || '').trim().toUpperCase();
            const uCliId = String(u.clienteId || '').trim().toUpperCase();

            // 1. Coincidencia por id del cliente y cédula/id del usuario
            if (cId === idUpper) return true;
            // 2. Coincidencia explícita si el usuario apunta al cliente vía u.clienteId
            if (uCliId && cId === uCliId) return true;
            // 3. Coincidencia si el cliente guarda usuarioId y coincide con u.id
            if (cUid && uId && cUid === uId) return true;
            // 4. Coincidencia si el cliente tiene campo cedula registrado
            if (cCed && cCed === idUpper) return true;

            return false;
        });

        if (!cliente) {
            cliente = {
                id: idCed,
                nombre: u.nombre || idCed,
                telefono: u.telefono || '',
                email: u.email || '',
                usuarioId: u.id || null
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
            // Asegurar que el cliente tenga las referencias de vinculación con el usuario
            if (u.id && (!cliente.usuarioId || cliente.usuarioId !== u.id)) {
                cliente.usuarioId = u.id;
                actualizado = true;
            }
            if (u.cedula && (!cliente.cedula || cliente.cedula !== u.cedula)) {
                cliente.cedula = u.cedula;
                actualizado = true;
            }
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
    const tieneMostrador = lista.some(c => c.id === 'V-00000000' || (c.nombre && c.nombre.toLowerCase().includes('mostrador')));
    const mostradorHTML = tieneMostrador ? '' : '<option value="V-00000000">Cliente de Mostrador</option>';
    const optionsHTML = mostradorHTML + lista.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    if (select) select.innerHTML = optionsHTML;
    if (selectMobile) selectMobile.innerHTML = optionsHTML;

    if (typeof renderizarCustomClientePickersPOS === 'function') {
        renderizarCustomClientePickersPOS('both');
    }
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
        totalAbonadoUSD,
        totalAbonadoVES: totalAbonadoUSD * tasaActiva,
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
            const abonosList = Array.isArray(abonos) ? abonos : (AppState.abonos || []);
            CLIENTES_OFICIALES.forEach(co => {
                const cExistente = clientes.find(c => c.id === co.id || (c.nombre && c.nombre.trim().toLowerCase() === co.nombre.trim().toLowerCase()));
                if (!cExistente) {
                    clientes.push(JSON.parse(JSON.stringify(co)));
                } else {
                    if ((cExistente.deudaUSD === undefined || cExistente.deudaUSD === null || cExistente.deudaUSD === 0) && co.deudaUSD > 0) {
                        const tieneAbono = abonosList.some(a => 
                            (a.clienteId === cExistente.id || a.clienteNombre === cExistente.nombre || a.clienteCedula === cExistente.cedula) &&
                            (a.estado === 'Pago agregado' || a.estado === 'Confirmado' || !a.estado)
                        );
                        if (!tieneAbono) {
                            cExistente.deudaUSD = co.deudaUSD;
                            cExistente.deudaInicialUSD = co.deudaInicialUSD;
                        }
                    }
                    if (cExistente.deudaInicialUSD === undefined || cExistente.deudaInicialUSD === null) {
                        cExistente.deudaInicialUSD = co.deudaInicialUSD;
                    }
                }
            });
            AppState.clientes = clientes;
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

    // Email del cliente o usuario vinculado
    const emailCli = cliente.email || (Array.isArray(AppState.usuarios) && AppState.usuarios.find(u => (u.cedula || u.id) === cliente.id || u.id === cliente.usuarioId)?.email) || '';
    const emailTextEl = document.getElementById('det-cliente-email-text');
    if (emailTextEl) emailTextEl.innerHTML = `<i class="fas fa-envelope"></i> Correo: <strong>${emailCli || '—'}</strong>`;

    // Botón WhatsApp
    const btnWa = document.getElementById('det-btn-whatsapp');
    if (btnWa) {
        if (cliente.telefono && cliente.telefono.trim()) {
            btnWa.style.display = 'inline-flex';
        } else {
            btnWa.style.display = 'none';
        }
    }

    // Botón Correo Electrónico
    const btnEmail = document.getElementById('det-btn-email');
    if (btnEmail) {
        if (emailCli && emailCli.trim()) {
            btnEmail.style.display = 'inline-flex';
        } else {
            btnEmail.style.display = 'none';
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

    let clienteUltimasTransacciones = [];
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

            clienteUltimasTransacciones.push({
                ...t,
                saldoAcumuladoUSD,
                saldoVES
            });

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

    // Almacenar transacciones del cliente seleccionado en memoria para exportación/envío
    window._cliente360Transacciones = clienteUltimasTransacciones;

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

/**
 * Obtiene los datos consolidados del cliente actualmente abierto en la Ficha 360°
 */
function obtenerDatosContextoCliente360() {
    if (!clienteSeleccionadoId) return null;
    const lista = Array.isArray(clientes) ? clientes : (AppState.clientes || []);
    const cliente = lista.find(c => c.id === clienteSeleccionadoId);
    if (!cliente) return null;

    const tasa = typeof tasaActiva === 'number' && tasaActiva > 0 ? tasaActiva : (AppState.tasaActiva || 1);
    const estado = calcularEstadoFinancieroCliente(cliente.id);
    const usuarioAsoc = Array.isArray(AppState.usuarios) && AppState.usuarios.find(u => (u.cedula || u.id) === cliente.id || u.id === cliente.usuarioId);
    const emailCli = cliente.email || usuarioAsoc?.email || '';
    const telCli = (cliente.telefono && cliente.telefono.trim()) || (cliente.tlf && cliente.tlf.trim()) || (cliente.phone && cliente.phone.trim()) || (usuarioAsoc?.telefono && usuarioAsoc.telefono.trim()) || '';
    
    // Obtener transacciones detalladas
    let transacciones = window._cliente360Transacciones || [];
    if (!transacciones.length) {
        // Generar en caso de no haber pasado por verDetalleCliente previamente
        const listaVentas = Array.isArray(ventas) ? ventas : (AppState.ventas || []);
        const listaAbonos = Array.isArray(abonos) ? abonos : (AppState.abonos || []);
        const id = cliente.id;
        const tx = [];

        listaVentas.filter(v => v.clienteId === id).forEach(v => {
            tx.push({
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
            tx.push({
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

        tx.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
        let saldoAcumulado = 0;
        transacciones = tx.map(t => {
            saldoAcumulado += (t.cargoUSD - t.abonoUSD);
            return {
                ...t,
                saldoAcumuladoUSD: saldoAcumulado,
                saldoVES: tasa > 0 ? saldoAcumulado * tasa : 0
            };
        });
    }

    return {
        cliente,
        emailCli,
        telCli,
        tasa,
        estado,
        transacciones
    };
}

/**
 * Enviar información completa del estado de cuenta y desglose financiero al cliente.
 * Cierra automáticamente el modal Ficha 360° para evitar bloqueos y abre el modal especializado.
 */
function enviarInformacionCliente() {
    const ctx = obtenerDatosContextoCliente360();
    if (!ctx) {
        if (typeof showAlert === 'function') {
            showAlert('Atención', 'No se pudo cargar la información del cliente.', 'warning');
        } else {
            alert('No se pudo cargar la información del cliente.');
        }
        return;
    }

    // Cerrar el modal 360° para que no quede detrás ni cause superposiciones
    cerrarModalDetalleCliente();

    // Abrir el modal especializado de envío de información
    abrirModalEnviarInfo(ctx);
}
window.enviarInformacionCliente = enviarInformacionCliente;

/**
 * Abre el modal dedicado de envío de información al cliente
 */
function abrirModalEnviarInfo(ctx) {
    if (!ctx) ctx = obtenerDatosContextoCliente360();
    if (!ctx) return;

    window._ctxEnvioInfoActivo = ctx;
    const { cliente, emailCli, tasa, estado, transacciones } = ctx;
    const { saldoDeudaUSD, saldoDeudaVES, totalCompradoUSD, totalAbonadoUSD } = estado;
    const montoBsStr = `Bs. ${saldoDeudaVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const elNombre = document.getElementById('env-info-cliente-nombre');
    const elDeudaVES = document.getElementById('env-info-deuda-ves');
    const elDeudaUSD = document.getElementById('env-info-deuda-usd');
    const elResumen = document.getElementById('env-info-resumen-movimientos');
    const inputTel = document.getElementById('env-info-telefono-input');
    const inputEmail = document.getElementById('env-info-correo-input');

    if (elNombre) elNombre.textContent = `${cliente.nombre} (${cliente.id || 'S/C'})`;
    if (elDeudaVES) elDeudaVES.textContent = montoBsStr;
    if (elDeudaUSD) elDeudaUSD.textContent = `$${saldoDeudaUSD.toFixed(2)} USD`;
    if (elResumen) {
        elResumen.innerHTML = `Total Comprado: <strong>$${totalCompradoUSD.toFixed(2)}</strong> | Total Abonado: <strong>$${(totalAbonadoUSD || 0).toFixed(2)}</strong> | Tasa BCV: <strong>Bs. ${tasa.toFixed(2)}</strong>`;
    }

    const tel = (cliente.telefono && cliente.telefono.trim()) || (ctx.telCli && ctx.telCli.trim()) || (cliente.tlf && cliente.tlf.trim()) || (cliente.phone && cliente.phone.trim()) || '';
    if (inputTel) inputTel.value = tel;
    if (inputEmail) inputEmail.value = (ctx.emailCli && ctx.emailCli.trim()) || (cliente.email && cliente.email.trim()) || '';

    const modal = document.getElementById('modal-enviar-informacion');
    if (modal) {
        modal.classList.add('active');
    }
}
window.abrirModalEnviarInfo = abrirModalEnviarInfo;

/**
 * Cierra el modal de envío de información
 */
function cerrarModalEnviarInfo() {
    const modal = document.getElementById('modal-enviar-informacion');
    if (modal) {
        modal.classList.remove('active');
    }
}
window.cerrarModalEnviarInfo = cerrarModalEnviarInfo;

/**
 * Permite al usuario volver a la Ficha 360° desde el modal de envío
 */
function volverAFicha360DesdeEnvio() {
    cerrarModalEnviarInfo();
    const ctx = window._ctxEnvioInfoActivo;
    const cid = (ctx && ctx.cliente && ctx.cliente.id) || clienteSeleccionadoId;
    if (cid) {
        verDetalleCliente(cid, true);
    }
}
window.volverAFicha360DesdeEnvio = volverAFicha360DesdeEnvio;

/**
 * Genera el texto estructurado del estado de cuenta con la deuda en Bs explícita
 */
function generarTextoEstadoCuentaEnvio(ctx, incluirTransacciones = true) {
    const { cliente, tasa, estado, transacciones } = ctx;
    const { saldoDeudaUSD, saldoDeudaVES, totalCompradoUSD, totalAbonadoUSD } = estado;
    const montoBsStr = `Bs. ${saldoDeudaVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    let texto = `🏪 *TU BODEGUITA DE CONFIANZA*\n`;
    texto += `📄 *ESTADO DE CUENTA - ${cliente.nombre}* (C.I. ${cliente.id})\n`;
    texto += `📅 Fecha: ${new Date().toLocaleDateString('es-VE')}\n`;
    texto += `💵 Tasa Oficial BCV: Bs. ${tasa.toFixed(2)} / USD\n\n`;
    texto += `📊 *RESUMEN FINANCIERO:*\n`;
    texto += `• Total Comprado (Crédito): $${totalCompradoUSD.toFixed(2)} USD\n`;
    texto += `• Total Abonado / Pagado: $${(totalAbonadoUSD || 0).toFixed(2)} USD\n`;
    texto += `• Saldo Pendiente: $${saldoDeudaUSD.toFixed(2)} USD\n`;
    texto += `• *Deuda a pagar: ${montoBsStr}*\n\n`;

    if (incluirTransacciones && transacciones && transacciones.length > 0) {
        texto += `📝 *EN QUÉ SE BASA EL SALDO (MOVIMIENTOS):*\n`;
        const ultimos = transacciones.slice(-6);
        ultimos.forEach((t, i) => {
            const monto = t.cargoUSD > 0 ? `+$${t.cargoUSD.toFixed(2)}` : `-$${t.abonoUSD.toFixed(2)}`;
            texto += `${i + 1}. [${t.fecha ? t.fecha.substring(0, 10) : ''}] ${t.concepto}: ${monto} | Saldo: $${t.saldoAcumuladoUSD.toFixed(2)}\n   Detalle: ${t.detalle || '—'}\n`;
        });
        texto += `\n`;
    }

    if (saldoDeudaUSD > 0.01) {
        texto += `💳 *Datos de Pago Móvil:*\n`;
        texto += `• Banco: Mercantil / Banesco / Venezuela\n`;
        texto += `• Teléfono: 0414-0000000\n`;
        texto += `• C.I.: V-00000000\n\n`;
        texto += `Agradecemos enviar su comprobante por este medio. ¡Muchas gracias por su preferencia! 🙏`;
    } else {
        texto += `✨ ¡Su cuenta se encuentra totalmente al día y solvente! Gracias por su confianza.`;
    }

    return texto;
}

/**
 * Ejecuta el envío por WhatsApp con el número ingresado o predeterminado
 */
function ejecutarEnvioInfoWhatsapp() {
    const ctx = window._ctxEnvioInfoActivo || obtenerDatosContextoCliente360();
    if (!ctx) return;

    const inputTel = document.getElementById('env-info-telefono-input');
    const tel = (inputTel ? inputTel.value.trim() : '') || (ctx.cliente.telefono && ctx.cliente.telefono.trim()) || (ctx.telCli && ctx.telCli.trim());

    if (!tel) {
        if (typeof showAlert === 'function') {
            showAlert('Teléfono Requerido', 'Por favor ingresa un número de teléfono de WhatsApp en el campo correspondiente.', 'warning');
        } else {
            alert('Por favor ingresa un número de teléfono de WhatsApp.');
        }
        if (inputTel) inputTel.focus();
        return;
    }

    // Si el cliente no tenía teléfono guardado y se ingresó uno, guardarlo automáticamente
    if (!ctx.cliente.telefono && tel) {
        ctx.cliente.telefono = tel;
        if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarCliente === 'function') {
            window.InventoryApp.Firebase.guardarCliente(ctx.cliente).catch(() => {});
        }
    }

    let phoneClean = tel.replace(/[^0-9]/g, '');
    if (phoneClean.startsWith('0')) {
        phoneClean = '58' + phoneClean.substring(1);
    } else if (phoneClean.length === 10 && !phoneClean.startsWith('58')) {
        phoneClean = '58' + phoneClean;
    }

    const texto = generarTextoEstadoCuentaEnvio(ctx, true);
    const urlWa = `https://wa.me/${phoneClean}?text=${encodeURIComponent(texto)}`;

    if (typeof showToast === 'function') {
        showToast('Abriendo WhatsApp para enviar información...', 'success');
    }

    const link = document.createElement('a');
    link.href = urlWa;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => link.remove(), 200);
}
window.ejecutarEnvioInfoWhatsapp = ejecutarEnvioInfoWhatsapp;

/**
 * Ejecuta el envío por Correo Electrónico con el correo ingresado o predeterminado
 */
function ejecutarEnvioInfoCorreo() {
    const ctx = window._ctxEnvioInfoActivo || obtenerDatosContextoCliente360();
    if (!ctx) return;

    const inputEmail = document.getElementById('env-info-correo-input');
    const email = (inputEmail ? inputEmail.value.trim() : '') || (ctx.emailCli && ctx.emailCli.trim()) || (ctx.cliente.email && ctx.cliente.email.trim());

    if (!email) {
        if (typeof showAlert === 'function') {
            showAlert('Correo Requerido', 'Por favor ingresa un correo electrónico en el campo correspondiente.', 'warning');
        } else {
            alert('Por favor ingresa un correo electrónico.');
        }
        if (inputEmail) inputEmail.focus();
        return;
    }

    // Si el cliente no tenía email guardado y se ingresó uno, guardarlo automáticamente
    if (!ctx.cliente.email && email) {
        ctx.cliente.email = email;
        if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarCliente === 'function') {
            window.InventoryApp.Firebase.guardarCliente(ctx.cliente).catch(() => {});
        }
    }

    const { cliente, estado } = ctx;
    const { saldoDeudaVES } = estado;
    const montoBsStr = `Bs. ${saldoDeudaVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const asunto = `Estado de Cuenta - ${cliente.nombre} - Deuda a pagar: ${montoBsStr}`;
    const texto = generarTextoEstadoCuentaEnvio(ctx, true).replace(/\*/g, '');

    const mailtoUrl = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(texto)}`;

    if (typeof showToast === 'function') {
        showToast('Abriendo cliente de correo...', 'success');
    }

    window.location.href = mailtoUrl;
}
window.ejecutarEnvioInfoCorreo = ejecutarEnvioInfoCorreo;

/**
 * Copia el estado de cuenta formateado al portapapeles
 */
function ejecutarCopiarInfoPortapapeles() {
    const ctx = window._ctxEnvioInfoActivo || obtenerDatosContextoCliente360();
    if (!ctx) return;

    const texto = generarTextoEstadoCuentaEnvio(ctx, true).replace(/\*/g, '');
    const { saldoDeudaVES } = ctx.estado;
    const montoBsStr = `Bs. ${saldoDeudaVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(() => {
            if (typeof showToast === 'function') {
                showToast(`¡Estado de cuenta copiado al portapapeles! (Deuda a pagar: ${montoBsStr})`, 'success');
            } else if (typeof showAlert === 'function') {
                showAlert('Copiado', `Se ha copiado el estado de cuenta al portapapeles con la 'Deuda a pagar: ${montoBsStr}'.`, 'success');
            } else {
                alert(`Se ha copiado el estado de cuenta al portapapeles con la 'Deuda a pagar: ${montoBsStr}'.`);
            }
        }).catch(() => {
            copiarFallbackTexto(texto, montoBsStr);
        });
    } else {
        copiarFallbackTexto(texto, montoBsStr);
    }
}
window.ejecutarCopiarInfoPortapapeles = ejecutarCopiarInfoPortapapeles;

function copiarFallbackTexto(texto, montoBsStr) {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
        document.execCommand('copy');
        if (typeof showToast === 'function') {
            showToast(`¡Estado de cuenta copiado! (Deuda a pagar: ${montoBsStr})`, 'success');
        } else {
            alert(`Estado de cuenta copiado. Deuda a pagar: ${montoBsStr}`);
        }
    } catch(e) {
        alert(`Información:\nDeuda a pagar: ${montoBsStr}`);
    }
    ta.remove();
}

/**
 * Copia el resumen de estado de cuenta directamente al portapapeles cuando el cliente no tiene canales configurados
 */
function copiarEstadoCuentaPortapapeles(ctx) {
    window._ctxEnvioInfoActivo = ctx;
    ejecutarCopiarInfoPortapapeles();
}
window.copiarEstadoCuentaPortapapeles = copiarEstadoCuentaPortapapeles;

/**
 * Enviar desglose de estado de cuenta y deuda por WhatsApp
 */
function enviarWhatsappCliente() {
    const ctx = obtenerDatosContextoCliente360();
    if (!ctx) return;
    const { cliente, tasa, estado, transacciones } = ctx;

    if (!cliente.telefono || !cliente.telefono.trim()) {
        const agregar = confirm('Este cliente no tiene número de teléfono registrado.\n\n¿Desea copiar la información al portapapeles para enviarla manualmente?');
        if (agregar) {
            copiarEstadoCuentaPortapapeles(ctx);
        }
        return;
    }

    let tel = cliente.telefono.replace(/[^0-9]/g, '');
    if (tel.startsWith('0')) {
        tel = '58' + tel.substring(1);
    } else if (tel.length === 10 && !tel.startsWith('58')) {
        tel = '58' + tel;
    }

    const { saldoDeudaUSD, saldoDeudaVES, totalCompradoUSD, totalAbonadoUSD } = estado;
    const montoBsStr = `Bs. ${saldoDeudaVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    let mensaje = '';

    if (saldoDeudaUSD > 0.01) {
        mensaje = `🏪 *TU BODEGUITA DE CONFIANZA*\n`;
        mensaje += `📄 *ESTADO DE CUENTA Y SALDO PENDIENTE*\n\n`;
        mensaje += `👤 *Cliente:* ${cliente.nombre} (C.I. ${cliente.id})\n`;
        mensaje += `📅 *Fecha:* ${new Date().toLocaleDateString('es-VE')}\n`;
        mensaje += `💵 *Tasa BCV:* Bs. ${tasa.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / USD\n\n`;
        mensaje += `📊 *RESUMEN DE CUENTA:*\n`;
        mensaje += `• Total Créditos Otorgados: $${totalCompradoUSD.toFixed(2)}\n`;
        mensaje += `• Total Pagos/Abonos: $${(totalAbonadoUSD || 0).toFixed(2)}\n`;
        mensaje += `• Saldo Pendiente: $${saldoDeudaUSD.toFixed(2)} USD\n`;
        mensaje += `• *Deuda a pagar:* *${montoBsStr}*\n\n`;

        // Detalle de los movimientos en los que se basa la deuda
        const ultimos = transacciones.slice(-6);
        if (ultimos.length) {
            mensaje += `📝 *EN QUÉ SE BASA EL SALDO (MOVIMIENTOS):*\n`;
            ultimos.forEach(t => {
                const tipoSigno = t.cargoUSD > 0 ? `+ $${t.cargoUSD.toFixed(2)}` : `- $${t.abonoUSD.toFixed(2)}`;
                mensaje += `• ${t.fecha ? t.fecha.substring(0, 10) : ''}: ${t.concepto} (${tipoSigno})\n  _${t.detalle || 'Sin detalle'}_\n`;
            });
            mensaje += `\n`;
        }

        mensaje += `🙏 Agradecemos su puntual abono o pago. Para confirmar referencias o reportar pagos por la app, estamos siempre a su orden. ¡Muchas gracias por su preferencia!`;
    } else {
        mensaje = `🏪 *TU BODEGUITA DE CONFIANZA*\n`;
        mensaje += `📄 *ESTADO DE CUENTA AL DÍA*\n\n`;
        mensaje += `Estimado(a) *${cliente.nombre}* (C.I. ${cliente.id}),\n\n`;
        mensaje += `Le confirmamos que su cuenta se encuentra actualmente *SOLVENTE y al día con saldo $0.00*.\n`;
        mensaje += `• *Deuda a pagar:* *Bs. 0,00*\n`;
        mensaje += `• Total Compras acumuladas: $${totalCompradoUSD.toFixed(2)}\n`;
        mensaje += `• Total Abonos: $${(totalAbonadoUSD || 0).toFixed(2)}\n\n`;
        mensaje += `¡Muchas gracias por su confianza y lealtad con nosotros! 🎉`;
    }

    const url = `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
}
window.enviarWhatsappCliente = enviarWhatsappCliente;

/**
 * Enviar estado de cuenta y desglose de deuda por Correo Electrónico añadido por el usuario
 */
function enviarCorreoCliente() {
    const ctx = obtenerDatosContextoCliente360();
    if (!ctx) return;
    const { cliente, emailCli, tasa, estado, transacciones } = ctx;

    if (!emailCli || !emailCli.trim()) {
        const agregar = confirm('Este cliente no tiene correo electrónico registrado ni vinculado.\n\n¿Desea copiar la información al portapapeles para enviarla manualmente?');
        if (agregar) {
            copiarEstadoCuentaPortapapeles(ctx);
        }
        return;
    }

    const { saldoDeudaUSD, saldoDeudaVES, totalCompradoUSD, totalAbonadoUSD } = estado;
    const montoBsStr = `Bs. ${saldoDeudaVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const asunto = `Estado de Cuenta - Tu Bodeguita de Confianza - ${cliente.nombre}`;
    
    let cuerpo = `Estimado(a) ${cliente.nombre} (C.I. ${cliente.id}),\n\n`;
    cuerpo += `Reciba un cordial saludo de Tu Bodeguita de Confianza. A continuación le presentamos el resumen de su estado de cuenta a la fecha (${new Date().toLocaleDateString('es-VE')}):\n\n`;
    
    cuerpo += `--- RESUMEN FINANCIERO ---\n`;
    cuerpo += `Total Comprado/Crédito: $${totalCompradoUSD.toFixed(2)} USD\n`;
    cuerpo += `Total Abonado/Pagado: $${(totalAbonadoUSD || 0).toFixed(2)} USD\n`;
    cuerpo += `Saldo Pendiente Actual: $${saldoDeudaUSD.toFixed(2)} USD\n`;
    cuerpo += `Deuda a pagar: ${montoBsStr}\n`;
    cuerpo += `Tasa de Cambio Oficial (BCV): Bs. ${tasa.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / USD\n\n`;

    if (transacciones && transacciones.length > 0) {
        cuerpo += `--- DETALLE DE MOVIMIENTOS (EN QUÉ SE BASA LA CUENTA) ---\n`;
        transacciones.forEach((t, idx) => {
            const monto = t.cargoUSD > 0 ? `Cargo: +$${t.cargoUSD.toFixed(2)}` : `Abono: -$${t.abonoUSD.toFixed(2)}`;
            cuerpo += `${idx + 1}. [${t.fecha}] ${t.concepto} | ${monto} | Saldo: $${t.saldoAcumuladoUSD.toFixed(2)}\n`;
            if (t.detalle) {
                cuerpo += `   Detalle: ${t.detalle}\n`;
            }
        });
        cuerpo += `\n`;
    }

    if (saldoDeudaUSD > 0.01) {
        cuerpo += `Le recordamos que puede realizar sus abonos por transferencia bancaria, pago móvil o en efectivo / divisas directamente en el negocio o reportándolo por la aplicación.\n\n`;
    } else {
        cuerpo += `Su cuenta se encuentra actualmente completamente al día. ¡Agradecemos sinceramente su preferencia!\n\n`;
    }

    cuerpo += `Atentamente,\nTu Bodeguita de Confianza`;

    const mailtoUrl = `mailto:${encodeURIComponent(emailCli)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
    window.location.href = mailtoUrl;
}
window.enviarCorreoCliente = enviarCorreoCliente;

/**
 * Descarga el estado de cuenta y desglose de movimientos en formato Excel (.xlsx)
 */
function descargarEstadoCuentaCliente() {
    const ctx = obtenerDatosContextoCliente360();
    if (!ctx) {
        alert('No se pudo cargar la información del cliente para la descarga.');
        return;
    }
    const { cliente, emailCli, tasa, estado, transacciones } = ctx;

    if (typeof XLSX === 'undefined') {
        alert('La librería SheetJS (XLSX) no está cargada. Descargando como formato CSV/Texto...');
        descargarEstadoCuentaCSV(ctx);
        return;
    }

    const { saldoDeudaUSD, saldoDeudaVES, totalCompradoUSD, totalAbonadoUSD } = estado;
    const wb = XLSX.utils.book_new();

    // Hoja 1: Resumen de la cuenta
    const datosResumen = [
        { 'Parámetro': 'Nombre del Cliente', 'Valor': cliente.nombre },
        { 'Parámetro': 'Cédula / Identificación', 'Valor': cliente.id },
        { 'Parámetro': 'Teléfono de Contacto', 'Valor': cliente.telefono || 'No registrado' },
        { 'Parámetro': 'Correo Electrónico', 'Valor': emailCli || 'No registrado' },
        { 'Parámetro': 'Fecha de Emisión', 'Valor': new Date().toLocaleString('es-VE') },
        { 'Parámetro': 'Tasa Oficial BCV', 'Valor': `Bs. ${tasa.toFixed(2)}` },
        { 'Parámetro': 'Total Comprado (Créditos)', 'Valor': `$${totalCompradoUSD.toFixed(2)} USD` },
        { 'Parámetro': 'Total Abonado / Pagado', 'Valor': `$${(totalAbonadoUSD || 0).toFixed(2)} USD` },
        { 'Parámetro': 'SALDO DEUDA ACTUAL (USD)', 'Valor': `$${saldoDeudaUSD.toFixed(2)} USD` },
        { 'Parámetro': 'Deuda a pagar (Bolívares)', 'Valor': `Bs. ${saldoDeudaVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
        { 'Parámetro': 'SALDO DEUDA ACTUAL (VES)', 'Valor': `Bs. ${saldoDeudaVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
        { 'Parámetro': 'Estado Financiero', 'Valor': saldoDeudaUSD > 0.01 ? 'DEUDOR / PENDIENTE' : 'SOLVENTE / AL DÍA' }
    ];
    const wsResumen = XLSX.utils.json_to_sheet(datosResumen);
    wsResumen['!cols'] = [{ wch: 30 }, { wch: 45 }];
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen_Cliente');

    // Hoja 2: Detalle de Movimientos (En qué se basa la deuda)
    const datosMovimientos = (transacciones.length ? transacciones : [{
        fecha: new Date().toISOString().substring(0, 10),
        concepto: 'Sin movimientos',
        detalle: 'No se registran operaciones para este cliente',
        cargoUSD: 0,
        abonoUSD: 0,
        montoPagoVES: '-',
        saldoAcumuladoUSD: 0,
        saldoVES: 0
    }]).map(t => ({
        'Fecha': t.fecha,
        'Concepto': t.concepto,
        'Detalle / Artículos': t.detalle || '',
        'Cargo ($)': Number((t.cargoUSD || 0).toFixed(2)),
        'Abono ($)': Number((t.abonoUSD || 0).toFixed(2)),
        'Monto en Bs (VES)': t.montoPagoVES,
        'Saldo Resultante ($)': Number((t.saldoAcumuladoUSD || 0).toFixed(2)),
        'Saldo Resultante (Bs)': Number((t.saldoVES || 0).toFixed(2))
    }));

    const wsMovimientos = XLSX.utils.json_to_sheet(datosMovimientos);
    wsMovimientos['!cols'] = [
        { wch: 18 }, // Fecha
        { wch: 22 }, // Concepto
        { wch: 40 }, // Detalle
        { wch: 14 }, // Cargo
        { wch: 14 }, // Abono
        { wch: 18 }, // Bs
        { wch: 20 }, // Saldo USD
        { wch: 22 }  // Saldo Bs
    ];
    XLSX.utils.book_append_sheet(wb, wsMovimientos, 'Detalle_Movimientos');

    const cleanName = (cliente.nombre || cliente.id).replace(/[^a-zA-Z0-9]/g, '_');
    const fechaArchivo = new Date().toISOString().substring(0, 10);
    const nombreArchivo = `Estado_Cuenta_${cleanName}_${fechaArchivo}.xlsx`;

    XLSX.writeFile(wb, nombreArchivo);
}
window.descargarEstadoCuentaCliente = descargarEstadoCuentaCliente;

/**
 * Fallback en caso de que XLSX no esté disponible (descarga CSV)
 */
function descargarEstadoCuentaCSV(ctx) {
    const { cliente, emailCli, tasa, estado, transacciones } = ctx;
    const { saldoDeudaUSD, saldoDeudaVES, totalCompradoUSD, totalAbonadoUSD } = estado;

    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
    csvContent += `ESTADO DE CUENTA - TU BODEGUITA DE CONFIANZA\n`;
    csvContent += `Cliente,"${cliente.nombre}"\n`;
    csvContent += `Cedula,"${cliente.id}"\n`;
    csvContent += `Telefono,"${cliente.telefono || ''}"\n`;
    csvContent += `Correo,"${emailCli || ''}"\n`;
    csvContent += `Fecha Emision,"${new Date().toLocaleString('es-VE')}"\n`;
    csvContent += `Tasa BCV,"Bs. ${tasa.toFixed(2)}"\n`;
    csvContent += `Total Comprado ($),"${totalCompradoUSD.toFixed(2)}"\n`;
    csvContent += `Total Abonado ($),"${(totalAbonadoUSD || 0).toFixed(2)}"\n`;
    csvContent += `Saldo Pendiente ($),"${saldoDeudaUSD.toFixed(2)}"\n`;
    csvContent += `Deuda a pagar (Bs),"Bs. ${saldoDeudaVES.toFixed(2)}"\n\n`;

    csvContent += `Fecha,Operacion,Concepto,Detalle,Cargo USD,Abono USD,Saldo USD\n`;
    transacciones.forEach(t => {
        csvContent += `"${t.fecha}","${t.tipoOperacion}","${t.concepto}","${(t.detalle || '').replace(/"/g, '""')}","${t.cargoUSD.toFixed(2)}","${t.abonoUSD.toFixed(2)}","${t.saldoAcumuladoUSD.toFixed(2)}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const cleanName = (cliente.nombre || cliente.id).replace(/[^a-zA-Z0-9]/g, '_');
    link.setAttribute('download', `Estado_Cuenta_${cleanName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Imprimir o exportar como PDF el Estado de Cuenta profesional del cliente
 */
function imprimirEstadoCuentaCliente() {
    const ctx = obtenerDatosContextoCliente360();
    if (!ctx) {
        alert('No se pudo cargar la información del cliente para imprimir.');
        return;
    }
    const { cliente, emailCli, tasa, estado, transacciones } = ctx;
    const { saldoDeudaUSD, saldoDeudaVES, totalCompradoUSD, totalAbonadoUSD } = estado;
    const tieneDeuda = saldoDeudaUSD > 0.01;

    const ventana = window.open('', '_blank', 'width=900,height=750');
    if (!ventana) {
        alert('Por favor permite abrir ventanas emergentes para imprimir el informe.');
        return;
    }

    const rowsHtml = transacciones.map(t => {
        const esCargo = t.cargoUSD > 0;
        const esAbono = t.abonoUSD > 0;
        return `
            <tr>
                <td style="white-space:nowrap; padding:7px 10px; border:1px solid #e2e8f0;">${t.fecha}</td>
                <td style="padding:7px 10px; border:1px solid #e2e8f0; font-weight:600;">${t.concepto}</td>
                <td style="padding:7px 10px; border:1px solid #e2e8f0; font-size:11px; color:#475569;">${t.detalle || '—'}</td>
                <td style="text-align:right; padding:7px 10px; border:1px solid #e2e8f0; color:${esCargo ? '#dc2626' : 'inherit'}; font-weight:${esCargo ? 'bold' : 'normal'};">
                    ${esCargo ? `$${t.cargoUSD.toFixed(2)}` : '—'}
                </td>
                <td style="text-align:right; padding:7px 10px; border:1px solid #e2e8f0; color:${esAbono ? '#16a34a' : 'inherit'}; font-weight:${esAbono ? 'bold' : 'normal'};">
                    ${esAbono ? `$${t.abonoUSD.toFixed(2)}` : '—'}
                </td>
                <td style="text-align:right; padding:7px 10px; border:1px solid #e2e8f0; font-weight:bold; color:${t.saldoAcumuladoUSD > 0 ? '#dc2626' : '#16a34a'};">
                    $${t.saldoAcumuladoUSD.toFixed(2)}
                </td>
            </tr>
        `;
    }).join('');

    ventana.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Estado de Cuenta - ${cliente.nombre}</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #1e293b; }
                .header { border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; }
                h1 { margin: 0 0 4px 0; font-size: 20px; color: #0f172a; }
                .subtitle { margin: 0; font-size: 13px; color: #64748b; }
                .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 13px; }
                .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
                .kpi-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #f8fafc; }
                .kpi-card.danger { background: #fef2f2; border-color: #fecaca; }
                .kpi-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
                .kpi-amount { font-size: 18px; font-weight: 800; }
                .kpi-amount.danger { color: #dc2626; }
                .kpi-amount.success { color: #16a34a; }
                .kpi-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
                th { background: #f1f5f9; text-align: left; padding: 8px 10px; border: 1px solid #e2e8f0; font-weight: 700; color: #334155; }
                @media print {
                    body { padding: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <h1>🏪 TU BODEGUITA DE CONFIANZA</h1>
                    <p class="subtitle">Ficha 360° · Estado de Cuenta y Desglose Financiero</p>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:12px; color:#64748b;">Fecha Emisión:</div>
                    <div style="font-weight:700; font-size:13px;">${new Date().toLocaleString('es-VE')}</div>
                    <div style="font-size:11px; color:#64748b; margin-top:2px;">Tasa BCV: Bs. ${tasa.toFixed(2)}</div>
                </div>
            </div>

            <div class="meta-box">
                <div>
                    <div><strong>Cliente:</strong> ${cliente.nombre}</div>
                    <div><strong>Cédula:</strong> ${cliente.id}</div>
                </div>
                <div>
                    <div><strong>Teléfono:</strong> ${cliente.telefono || 'No registrado'}</div>
                    <div><strong>Correo:</strong> ${emailCli || 'No registrado'}</div>
                </div>
            </div>

            <div class="kpis">
                <div class="kpi-card">
                    <div class="kpi-title">Total Comprado (Crédito)</div>
                    <div class="kpi-amount">$${totalCompradoUSD.toFixed(2)}</div>
                    <div class="kpi-sub">Bs. ${(totalCompradoUSD * tasa).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-title">Total Abonado / Pagado</div>
                    <div class="kpi-amount success">$${(totalAbonadoUSD || 0).toFixed(2)}</div>
                    <div class="kpi-sub">Bs. ${((totalAbonadoUSD || 0) * tasa).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div class="kpi-card ${tieneDeuda ? 'danger' : ''}">
                    <div class="kpi-title">${tieneDeuda ? 'Deuda a pagar (Bolívares)' : 'Estado de Deuda'}</div>
                    <div class="kpi-amount ${tieneDeuda ? 'danger' : 'success'}">Bs. ${saldoDeudaVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div class="kpi-sub" style="font-weight:600;">Deuda a pagar: Bs. ${saldoDeudaVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ($${saldoDeudaUSD.toFixed(2)} USD)</div>
                </div>
            </div>

            <h3 style="font-size:14px; margin-bottom:6px; color:#0f172a;">Detalle de Operaciones (En qué se basa el saldo)</h3>
            <table>
                <thead>
                    <tr>
                        <th style="width:14%;">Fecha</th>
                        <th style="width:20%;">Concepto</th>
                        <th>Detalle / Artículos</th>
                        <th style="text-align:right; width:12%;">Cargo ($)</th>
                        <th style="text-align:right; width:12%;">Abono ($)</th>
                        <th style="text-align:right; width:14%;">Saldo Resultante</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml || '<tr><td colspan="6" style="text-align:center; padding:16px;">No hay movimientos registrados.</td></tr>'}
                </tbody>
            </table>

            <div style="margin-top:24px; padding-top:12px; border-top:1px dashed #cbd5e1; font-size:11px; color:#64748b; text-align:center;">
                Comprobante informativo de Tu Bodeguita de Confianza. Gracias por su preferencia.
            </div>

            <div class="no-print" style="margin-top:20px; text-align:center;">
                <button onclick="window.print()" style="padding:10px 20px; background:#2563eb; color:#fff; border:none; border-radius:8px; font-weight:700; cursor:pointer;">
                    Imprimir Informe / Guardar PDF
                </button>
            </div>
        </body>
        </html>
    `);

    ventana.document.close();
}
window.imprimirEstadoCuentaCliente = imprimirEstadoCuentaCliente;

// Listener para cerrar modal con tecla Escape
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        const modal = document.getElementById('modal-cliente-detalle');
        if (modal && modal.classList.contains('active')) {
            cerrarModalDetalleCliente();
        }
    }
});

