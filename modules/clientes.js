/**
 * Regla Fundamental del Negocio: Todo usuario registrado/creado es automáticamente un cliente.
 * Sincroniza la lista de usuarios con la lista de clientes y asegura su persistencia en Firestore.
 */
function asegurarSincronizacionUsuariosAClientes() {
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
        // SuperAdmin no es cliente comercial
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

            // Sincronizar en la nube en Firestore
            if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarCliente === 'function') {
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
                if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarCliente === 'function') {
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
    if (!select) return;
    const lista = Array.isArray(clientes) ? clientes : (AppState.clientes || []);
    select.innerHTML = lista.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
}

function calcularEstadoFinancieroCliente(clienteId) {
    const ventasCli = ventas.filter(v => v.clienteId === clienteId);
    // Solo los abonos aprobados impactan la deuda. Los pagos en Confirmando
    // permanecen visibles como conciliación, pero no se contabilizan.
    const abonosCli = abonos.filter(a => a.clienteId === clienteId && (a.estado === 'Pago agregado' || a.estado === 'Confirmado' || !a.estado));

    const totalCompradoUSD = ventasCli.reduce((sum, v) => sum + Number(v.total || 0), 0);
    const totalCreditoUSD = ventasCli.filter(v => v.tipo === 'Crédito').reduce((sum, v) => sum + Number(v.total || 0), 0);
    
    let totalAbonadoUSD = 0;
    abonosCli.forEach(a => {
        const { montoUSD } = typeof sanitizarAbonoMonedas === 'function'
            ? sanitizarAbonoMonedas(a, tasaActiva)
            : { montoUSD: Number(a.montoUSD || 0) };
        totalAbonadoUSD += montoUSD;
    });

    const saldoDeudaUSD = Math.max(0, totalCreditoUSD - totalAbonadoUSD);

    return {
        totalCompradoUSD,
        totalCompradoVES: totalCompradoUSD * tasaActiva,
        saldoDeudaUSD,
        saldoDeudaVES: saldoDeudaUSD * tasaActiva
    };
}

function renderizarClientes() {
    if (typeof asegurarSincronizacionUsuariosAClientes === 'function') {
        asegurarSincronizacionUsuariosAClientes();
    }
    const tbody = document.getElementById('clientes-body');
    if (!tbody) return;

    const lista = Array.isArray(clientes) ? clientes : (AppState.clientes || []);

    if (!lista.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:25px; color:var(--text-muted);">No hay clientes registrados en el directorio.</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map(c => {
        const { totalCompradoUSD, saldoDeudaUSD, saldoDeudaVES } = calcularEstadoFinancieroCliente(c.id);
        const idSafe = typeof escaparHtmlInventario === 'function' ? escaparHtmlInventario(c.id) : c.id;
        const nomSafe = typeof escaparHtmlInventario === 'function' ? escaparHtmlInventario(c.nombre || c.id) : (c.nombre || c.id);
        const telSafe = typeof escaparHtmlInventario === 'function' ? escaparHtmlInventario(c.telefono || '—') : (c.telefono || '—');
        return `
            <tr>
                <td><strong>${idSafe}</strong></td>
                <td>${nomSafe}</td>
                <td>${telSafe}</td>
                <td class="num">$${totalCompradoUSD.toFixed(2)}</td>
                <td class="num" style="color: ${saldoDeudaUSD > 0 ? 'var(--danger)' : 'inherit'}; font-weight: bold;">
                    $${saldoDeudaUSD.toFixed(2)}
                </td>
                <td class="num" style="color: ${saldoDeudaVES > 0 ? 'var(--danger)' : 'inherit'}; font-weight: bold;">
                    Bs. ${tasaActiva > 0 ? saldoDeudaVES.toFixed(2) : '—'}
                </td>
                <td style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button class="btn" onclick="verDetalleCliente('${c.id}')">Panel 360°</button>
                    <button class="btn btn-danger" onclick="abrirModalEliminarCliente('${c.id}')">Eliminar</button>
                </td>
            </tr>
        `;
    }).join('');
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

function verDetalleCliente(id) {
    clienteSeleccionadoId = id;
    const cliente = clientes.find(c => c.id === id);
    const { totalCompradoUSD, totalCompradoVES, saldoDeudaUSD, saldoDeudaVES } = calcularEstadoFinancieroCliente(id);

    document.getElementById('det-cliente-nombre').textContent = `Panel Cliente: ${cliente.nombre}`;
    document.getElementById('det-kpi-comprado-usd').textContent = `$${totalCompradoUSD.toFixed(2)}`;
    document.getElementById('det-kpi-comprado-ves').textContent = `Bs. ${tasaActiva > 0 ? totalCompradoVES.toFixed(2) : '—'}`;

    document.getElementById('det-kpi-deuda-usd').textContent = `$${saldoDeudaUSD.toFixed(2)}`;
    document.getElementById('det-kpi-deuda-ves').textContent = `Bs. ${tasaActiva > 0 ? saldoDeudaVES.toFixed(2) : '—'}`;

    const transacciones = [];
    ventas.filter(v => v.clienteId === id).forEach(v => {
        transacciones.push({
            fecha: v.fecha,
            concepto: `Venta (${v.tipo})`,
            detalle: v.items.map(i => `${i.cantidad}x ${i.nombre}`).join(', '),
            cargoUSD: v.tipo === 'Crédito' ? v.total : 0,
            abonoUSD: 0,
            montoPagoVES: '-'
        });
    });

    abonos.filter(a => a.clienteId === id).forEach(a => {
        const aprobado = a.estado === 'Pago agregado' || a.estado === 'Confirmado' || !a.estado;
        const { esDivisa, montoUSD, montoVES } = typeof sanitizarAbonoMonedas === 'function'
            ? sanitizarAbonoMonedas(a, tasaActiva)
            : { esDivisa: false, montoUSD: Number(a.montoUSD || 0), montoVES: Number(a.montoVES || 0) };

        const nombreMetodo = a.formaPago || a.metodo || 'Abono';
        const badgeMoneda = esDivisa ? ' (Divisas $)' : ' (Bs. VES)';
        transacciones.push({
            fecha: a.fecha,
            concepto: aprobado ? `Abono / Pago${badgeMoneda}` : `Pago (${a.estado})${badgeMoneda}`,
            detalle: a.referencia && a.referencia !== 'N/A' && a.referencia !== 'Sin Ref' ? `${nombreMetodo} · Ref. ${a.referencia}` : nombreMetodo,
            cargoUSD: 0,
            abonoUSD: aprobado ? montoUSD : 0,
            montoPagoVES: montoVES > 0 ? `Bs. ${Number(montoVES).toLocaleString('es-VE', { minimumFractionDigits: 2 })}` : '-',
            pendiente: !aprobado
        });
    });

    if (typeof transaccionesPendientesCliente === 'function') {
        transacciones.push(...transaccionesPendientesCliente(id));
    }

    transacciones.sort((a,b) => new Date(a.fecha) - new Date(b.fecha));

    let saldoAcumuladoUSD = 0;
    const tbody = document.getElementById('det-historial-body');
    tbody.innerHTML = transacciones.map(t => {
        saldoAcumuladoUSD += (t.cargoUSD - t.abonoUSD);
        const estadoTransaccion = t.estado || (t.pendiente ? 'Confirmando' : 'Pago agregado');
        return `
            <tr>
                <td>${t.fecha}</td>
                <td>${t.concepto} ${t.pendiente ? `<span class="transaction-badge transaction-pending">Confirmando</span>` : (t.estado ? `<span class="transaction-badge transaction-approved">${t.estado}</span>` : ``)}</td>
                <td>${t.detalle}</td>
                <td class="num">$${t.cargoUSD.toFixed(2)}</td>
                <td class="num">$${t.abonoUSD.toFixed(2)}</td>
                <td class="num">${t.montoPagoVES}</td>
                <td class="num"><strong>$${saldoAcumuladoUSD.toFixed(2)}</strong></td>
                <td class="num"><strong>Bs. ${tasaActiva > 0 ? (saldoAcumuladoUSD * tasaActiva).toFixed(2) : '—'}</strong></td>
            </tr>
        `;
    }).join('');

    document.getElementById('cliente-detalle-card').style.display = 'block';
}

