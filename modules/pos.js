// --- POS MULTIMONEDA ---
function renderizarPosProductos(filtro = "") {
    const tbody = document.getElementById('pos-productos-body');
    const filtrados = productos.filter(p => 
        p.nombre.toLowerCase().includes(filtro.toLowerCase()) || 
        p.codigo.toLowerCase().includes(filtro.toLowerCase())
    );

    tbody.innerHTML = filtrados.map(p => `
        <tr>
            <td>${p.codigo}</td>
            <td>${p.nombre}</td>
            <td class="num">$${p.precio.toFixed(2)}</td>
            <td class="num">Bs. ${tasaActiva > 0 ? (p.precio * tasaActiva).toFixed(2) : '—'}</td>
            <td class="num">${p.stock}</td>
            <td>
                <button class="btn" onclick="agregarAlCarrito('${p.id}')" ${p.stock <= 0 ? 'disabled' : ''}>
                    ${p.stock > 0 ? '+ Agregar' : 'Agotado'}
                </button>
            </td>
        </tr>
    `).join('');
}

function filtrarPosProductos() {
    renderizarPosProductos(document.getElementById('pos-search').value);
}

function agregarAlCarrito(id) {
    const p = productos.find(prod => prod.id === id);
    const itemEnCarrito = carrito.find(item => item.productoId === id);

    if (itemEnCarrito) {
        if (itemEnCarrito.cantidad < p.stock) itemEnCarrito.cantidad++;
        else alert("Stock máximo alcanzado");
    } else {
        carrito.push({ productoId: id, nombre: p.nombre, precio: p.precio, cantidad: 1 });
    }
    renderizarCarrito();
}

function renderizarCarrito() {
    const tbody = document.getElementById('pos-carrito-body');
    let totalUSD = 0;

    tbody.innerHTML = carrito.map((item, idx) => {
        const subtotal = item.cantidad * item.precio;
        totalUSD += subtotal;
        return `
            <tr>
                <td>${item.nombre}</td>
                <td class="num">${item.cantidad}</td>
                <td class="num">$${subtotal.toFixed(2)}</td>
                <td><button class="btn btn-danger" onclick="eliminarDelCarrito(${idx})">X</button></td>
            </tr>
        `;
    }).join('');

    document.getElementById('pos-total-usd').textContent = `$${totalUSD.toFixed(2)}`;
    document.getElementById('pos-total-ves').textContent = `Bs. ${tasaActiva > 0 ? (totalUSD * tasaActiva).toFixed(2) : '—'}`;
}

function eliminarDelCarrito(idx) {
    carrito.splice(idx, 1);
    renderizarCarrito();
}

function procesarVenta() {
    // Guardia de Control de Acceso y Aprobación de Usuarios
    if (typeof verificarAccesoPOS === 'function') {
        const acceso = verificarAccesoPOS(true);
        if (!acceso.permitido) {
            return; // Bloqueado: PENDIENTE_APROBACION, RECHAZADO o SIN_SESION
        }
    }

    if (carrito.length === 0) return alert("El carrito está vacío");

    const clienteId = document.getElementById('pos-cliente-select').value;
    const tipoPago = document.getElementById('pos-tipo-pago').value;
    const total = carrito.reduce((sum, i) => sum + (i.cantidad * i.precio), 0);

    // Prevalidamos todo el carrito antes de tocar stock: la venta es atómica.
    for (const item of carrito) {
        const producto = productos.find(p => p.id === item.productoId);
        if (!producto || Number(item.cantidad) <= 0 || Number(item.cantidad) > Number(producto.stock || 0)) {
            alert(`Stock insuficiente para ${item.nombre}. La venta fue cancelada sin modificar inventario.`);
            return;
        }
    }

    for (const item of carrito) {
        InventoryApp.StockService.sale(item.productoId, item.cantidad);
    }

    const itemsVendidos = carrito.map(item => {
        const producto = productos.find(p => p.id === item.productoId);
        return { ...item, costo: Number(producto?.costo || item.costo || 0) };
    });

    const vendedor = AppState.usuarioActual || { cedula: 'V-00000001', nombre: 'Administrador' };

    const nuevaVenta = {
        id: "V" + (ventas.length + 1) + "_" + Date.now().toString().slice(-4),
        clienteId: clienteId,
        vendedorId: vendedor.cedula || vendedor.id || '',
        vendedorNombre: vendedor.nombre || '',
        fecha: new Date().toISOString().replace('T', ' ').substring(0, 16),
        items: itemsVendidos,
        total: total,
        tipo: tipoPago
    };

    ventas.push(nuevaVenta);

    // Fidelización y Gamificación: Otorgar puntos si la venta es de contado
    let puntosGanados = 0;
    if (tipoPago === 'Contado' && typeof otorgarPuntosPorCompra === 'function') {
        puntosGanados = otorgarPuntosPorCompra(clienteId, total, 'Venta POS Contado');
    }

    // Sincronizar venta y actualización de stock en Firebase Firestore
    if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.registrarVenta === 'function') {
        window.InventoryApp.Firebase.registrarVenta(nuevaVenta, itemsVendidos).catch(err => {
            console.warn('[POS] Error al registrar venta en Firestore:', err);
        });
    }

    carrito = [];
    renderizarCarrito();
    renderizarPosProductos();
    renderizarInventario();
    renderizarClientes();
    renderizarAuditoria(document.getElementById('auditoria-search') ? document.getElementById('auditoria-search').value : "");
    renderizarResumenPerdidasEconomicas();
    
    if (puntosGanados > 0) {
        alert(`Transacción procesada correctamente.\n⭐ ¡El cliente acumuló +${puntosGanados} puntos para el Premio del Mes!`);
    } else {
        alert("Transacción procesada correctamente");
    }
}

// --- CLIENTES Y DEUDAS MULTIMONEDA ---
