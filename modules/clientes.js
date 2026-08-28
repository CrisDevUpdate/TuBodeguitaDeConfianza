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

    document.getElementById('form-cliente').reset();
    actualizarSelectClientes();
    actualizarSelectTransacciones();
    renderizarClientes();
}

function actualizarSelectClientes() {
    document.getElementById('pos-cliente-select').innerHTML = 
        clientes.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
}

function calcularEstadoFinancieroCliente(clienteId) {
    const ventasCli = ventas.filter(v => v.clienteId === clienteId);
    // Solo los abonos aprobados impactan la deuda. Los pagos en Confirmando
    // permanecen visibles como conciliación, pero no se contabilizan.
    const abonosCli = abonos.filter(a => a.clienteId === clienteId && (a.estado === 'Pago agregado' || !a.estado));

    const totalCompradoUSD = ventasCli.reduce((sum, v) => sum + Number(v.total || 0), 0);
    const totalCreditoUSD = ventasCli.filter(v => v.tipo === 'Crédito').reduce((sum, v) => sum + Number(v.total || 0), 0);
    const totalAbonadoUSD = abonosCli.reduce((sum, a) => sum + Number(a.montoUSD || 0), 0);

    const saldoDeudaUSD = totalCreditoUSD - totalAbonadoUSD;

    return {
        totalCompradoUSD,
        totalCompradoVES: totalCompradoUSD * tasaActiva,
        saldoDeudaUSD,
        saldoDeudaVES: saldoDeudaUSD * tasaActiva
    };
}

function renderizarClientes() {
    const tbody = document.getElementById('clientes-body');
    tbody.innerHTML = clientes.map(c => {
        const { totalCompradoUSD, saldoDeudaUSD, saldoDeudaVES } = calcularEstadoFinancieroCliente(c.id);
        return `
            <tr>
                <td>${c.id}</td>
                <td>${c.nombre}</td>
                <td>${c.telefono}</td>
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
        const aprobado = a.estado === 'Pago agregado' || !a.estado;
        transacciones.push({
            fecha: a.fecha,
            concepto: aprobado ? `Abono / Pago` : `Pago (${a.estado})`,
            detalle: a.referencia ? `${a.metodo} · Ref. ${a.referencia}` : a.metodo,
            cargoUSD: 0,
            abonoUSD: aprobado ? Number(a.montoUSD || 0) : 0,
            montoPagoVES: a.montoVES > 0 ? `Bs. ${Number(a.montoVES).toFixed(2)}` : '-',
            pendiente: !aprobado
        });
    });

    transacciones.push(...transaccionesPendientesCliente(id));

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

