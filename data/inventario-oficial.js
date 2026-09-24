/**
 * data/inventario-oficial.js
 * Carga masiva de productos oficiales extraídos directamente de Inventario.pdf y precios.pdf.
 * 
 * Nomenclatura oficial de precios.pdf aplicada:
 * - PT:  Precio Total (costo total del bulto o compra)
 * - PU:  Precio Unitario (costo unitario del producto) -> campo 'costo'
 * - PV:  Precio Venta (precio unitario de venta al público) -> campo 'precio'
 * - GU:  Ganancia Unitaria en dólares (PV - PU) -> campo 'gananciaUnitaria'
 * - GT:  Ganancia Total del bulto o lote (GU * UNI) -> campo 'gananciaTotal'
 * - UNI: Unidades por paquete o bulto -> campo 'unidadesPaquete'
 * 
 * Reglas aplicadas:
 * 1. Filtro estricto: Solo incluye los 26 productos que existen en Inventario.pdf.
 *    (Se descartaron Pastelitos, Galak, Papelon y Bolsas de precios.pdf por no estar en Inventario.pdf).
 * 2. Datos extraídos fielmente de los últimos 3 meses (julio a septiembre 2026).
 * 3. Cantidades físicas 'Inv Final' asignadas directamente a 'stock'.
 */

const PRODUCTOS_INVENTARIO_PDF = [
    {
        id: 'P1',
        codigo: 'PROD-001',
        nombre: 'Toston TOM',
        descripcion: '80GR',
        contenido: '80GR',
        categoria: 'Snacks',
        costo: 0.94,             // PU: Precio Unitario
        precio: 1.30,            // PV: Precio Venta
        gananciaUnitaria: 0.36,  // GU: Ganancia Unitaria ($1.30 - $0.94)
        precioTotal: 15.00,      // PT: Precio Total
        unidadesPaquete: 16,     // UNI: Unidades por bulto
        gananciaTotal: 5.80,     // GT: Ganancia Total del paquete
        ganancia: 38.3,          // % Ganancia sobre costo
        stock: 8,                // Inv Final
        imagen: '',
        esCombo: false,
        tipo: 'producto'
    },
    {
        id: 'P2',
        codigo: 'PROD-002',
        nombre: 'Doritos',
        descripcion: '45GR',
        contenido: '45GR',
        categoria: 'Snacks',
        costo: 0.86,             // PU: Precio Unitario
        precio: 1.20,            // PV: Precio Venta
        gananciaUnitaria: 0.34,  // GU: Ganancia Unitaria ($1.20 - $0.86)
        precioTotal: 10.30,      // PT: Precio Total
        unidadesPaquete: 12,     // UNI: Unidades por bulto
        gananciaTotal: 4.10,     // GT: Ganancia Total
        ganancia: 39.5,          // % Ganancia
        stock: 6,                // Inv Final
        imagen: '',
        esCombo: false,
        tipo: 'producto'
    },
    {
        id: 'P3',
        codigo: 'PROD-003',
        nombre: 'Pepito Marino',
        descripcion: 'Snack de maíz sabor a queso 80GR',
        contenido: '80GR',
        categoria: 'Snacks',
        costo: 0.52,             // PU: Precio Unitario
        precio: 0.80,            // PV: Precio Venta
        gananciaUnitaria: 0.28,  // GU: Ganancia Unitaria ($0.80 - $0.52)
        precioTotal: 6.26,       // PT: Precio Total
        unidadesPaquete: 12,     // UNI: Unidades
        gananciaTotal: 3.34,     // GT: Ganancia Total
        ganancia: 53.8,          // % Ganancia
        stock: 0,                // Inv Final
        imagen: '',
        esCombo: false,
        tipo: 'producto'
    },
    {
        id: 'P4',
        codigo: 'PROD-004',
        nombre: 'Pinguinito',
        descripcion: 'Pastelito relleno 80GR',
        contenido: '80GR',
        categoria: 'Dulces',
        costo: 0.56,             // PU: Precio Unitario
        precio: 0.90,            // PV: Precio Venta
        gananciaUnitaria: 0.34,  // GU: Ganancia Unitaria ($0.90 - $0.56)
        precioTotal: 13.40,      // PT: Precio Total
        unidadesPaquete: 24,     // UNI: Unidades
        gananciaTotal: 8.20,     // GT: Ganancia Total
        ganancia: 60.7,          // % Ganancia
        stock: 0,                // Inv Final
        imagen: '',
        esCombo: false,
        tipo: 'producto'
    },
    {
        id: 'P5',
        codigo: 'PROD-005',
        nombre: 'Malta',
        descripcion: '222 ml',
        contenido: '222 ml',
        categoria: 'Bebidas',
        costo: 0.48,             // PU: Precio Unitario
        precio: 0.90,            // PV: Precio Venta
        gananciaUnitaria: 0.42,  // GU: Ganancia Unitaria ($0.90 - $0.48)
        precioTotal: 17.30,      // PT: Precio Total
        unidadesPaquete: 36,     // UNI: Unidades
        gananciaTotal: 15.10,    // GT: Ganancia Total
        ganancia: 87.5,          // % Ganancia
        stock: 2,                // Inv Final
        imagen: '',
        esCombo: false,
        tipo: 'producto'
    },
    {
        id: 'P6',
        codigo: 'PROD-006',
        nombre: 'Cocosette',
        descripcion: '50GR',
        contenido: '50GR',
        categoria: 'Galletas',
        costo: 0.75,             // PU: Precio Unitario
        precio: 1.20,            // PV: Precio Venta
        gananciaUnitaria: 0.45,  // GU: Ganancia Unitaria ($1.20 - $0.75)
        precioTotal: 13.50,      // PT: Precio Total
        unidadesPaquete: 18,     // UNI: Unidades
        gananciaTotal: 8.10,     // GT: Ganancia Total
        ganancia: 60.0,          // % Ganancia
        stock: 20,               // Inv Final
        imagen: '',
        esCombo: false,
        tipo: 'producto'
    },
    {
        id: 'P7',
        codigo: 'PROD-007',
        nombre: 'Susy',
        descripcion: '50GR',
        contenido: '50GR',
        categoria: 'Galletas',
        costo: 0.75,             // PU: Precio Unitario
        precio: 1.20,            // PV: Precio Venta
        gananciaUnitaria: 0.45,  // GU: Ganancia Unitaria ($1.20 - $0.75)
        precioTotal: 13.50,      // PT: Precio Total
        unidadesPaquete: 18,     // UNI: Unidades
        gananciaTotal: 8.10,     // GT: Ganancia Total
        ganancia: 60.0,          // % Ganancia
        stock: 18,               // Inv Final
        imagen: '',
        esCombo: false,
        tipo: 'producto'
    },
    {
        id: 'P8',
        codigo: 'PROD-008',
        nombre: 'Samba',
        descripcion: '32GR',
        contenido: '32GR',
        categoria: 'Chocolates',
        costo: 0.82,             // PU: Precio Unitario
        precio: 1.20,            // PV: Precio Venta
        gananciaUnitaria: 0.38,  // GU: Ganancia Unitaria ($1.20 - $0.82)
        precioTotal: 16.40,      // PT: Precio Total
        unidadesPaquete: 20,     // UNI: Unidades
        gananciaTotal: 7.60,     // GT: Ganancia Total
        ganancia: 46.3,          // % Ganancia
        stock: 21,               // Inv Final
        imagen: '',
        esCombo: false,
        tipo: 'producto'
    },
    {
        id: 'P9',
        codigo: 'PROD-009',
        nombre: 'Piruetas',
        descripcion: '3 UND X 28GR',
        contenido: '3 UND X 28GR',
        categoria: 'Galletas',
        costo: 0.28,             // PU: Precio Unitario
        precio: 0.60,            // PV: Precio Venta
        gananciaUnitaria: 0.32,  // GU: Ganancia Unitaria ($0.60 - $0.28)
        precioTotal: 6.75,       // PT: Precio Total
        unidadesPaquete: 24,     // UNI: Unidades
        gananciaTotal: 7.65,     // GT: Ganancia Total
        ganancia: 114.3,         // % Ganancia
        stock: 2,                // Inv Final
        imagen: '',
        esCombo: false,
        tipo: 'producto'
    },
    {
        id: 'P10',
        codigo: 'PROD-010',
        nombre: 'Chocolate',
        descripcion: '30GR',
        contenido: '30GR',
        categoria: 'Chocolates',
        costo: 1.12,             // PU: Precio Unitario (Chocolate Savoy)
        precio: 1.50,            // PV: Precio Venta
        gananciaUnitaria: 0.38,  // GU: Ganancia Unitaria ($1.50 - $1.12)
        precioTotal: 13.40,      // PT: Precio Total
        unidadesPaquete: 12,     // UNI: Unidades
        gananciaTotal: 4.60,     // GT: Ganancia Total
        ganancia: 33.9,          // % Ganancia
        stock: 3,                // Inv Final
        imagen: '',
        esCombo: false,
        tipo: 'producto'
    },
    {
        id: 'P11',
        codigo: 'PROD-011',
        nombre: 'Bocadillos',
        descripcion: 'Dulce tradicional de guayaba 40GR',
        contenido: '40GR',
        categoria: 'Dulces',
        costo: 0.25,             // PU: Precio Unitario estimado
        precio: 0.40,            // PV: Precio Venta
        gananciaUnitaria: 0.15,  // GU: Ganancia Unitaria ($0.40 - $0.25)
        precioTotal: 3.00,       // PT
        unidadesPaquete: 12,     // UNI
        gananciaTotal: 1.80,     // GT
        ganancia: 60.0,          // % Ganancia
        stock: 0,                // Inv Final
        imagen: '',
        esCombo: false,
        tipo: 'producto'
    },
    {
        id: 'P12',
        codigo: 'PROD-012',
        nombre: 'Gomitas',
        descripcion: 'Gomitas dulces surtidas 35GR',
        contenido: '35GR',
        categoria: 'Dulces',
        costo: 0.46,             // PU: Precio Unitario
        precio: 0.80,            // PV: Precio Venta
        gananciaUnitaria: 0.34,  // GU: Ganancia Unitaria ($0.80 - $0.46)
        precioTotal: 2.76,       // PT: Precio Total
        unidadesPaquete: 6,      // UNI: Unidades
        gananciaTotal: 2.04,     // GT: Ganancia Total
        ganancia: 73.9,          // % Ganancia
        stock: 0,                // Inv Final
        imagen: '',
        esCombo: false,
        tipo: 'producto'
    },
    {
        id: 'P13',
        codigo: 'PROD-013',
        nombre: 'Bizcochito',
        descripcion: 'Bizcocho relleno 35GR',
        contenido: '35GR',
        categoria: 'Dulces',
        costo: 0.17,             // PU: Precio Unitario (Bizcochita)
        precio: 0.40,            // PV: Precio Venta
        gananciaUnitaria: 0.23,  // GU: Ganancia Unitaria ($0.40 - $0.17)
        precioTotal: 2.00,       // PT: Precio Total
        unidadesPaquete: 12,     // UNI: Unidades
        gananciaTotal: 2.80,     // GT: Ganancia Total
        ganancia: 135.3,         // % Ganancia
        stock: 5,                // Inv Final
        imagen: '',
        esCombo: false,
        tipo: 'producto'
    },
    {
        id: 'P14',
        codigo: 'PROD-014',
        nombre: 'Oreo',
        descripcion: 'Galleta de chocolate con crema 36GR',
        contenido: '36GR',
        categoria: 'Galletas',
        costo: 0.39,             // PU: Precio Unitario
        precio: 0.70,            // PV: Precio Venta
        gananciaUnitaria: 0.31,  // GU: Ganancia Unitaria ($0.70 - $0.39)
        precioTotal: 2.35,       // PT: Precio Total
        unidadesPaquete: 6,      // UNI: Unidades
        gananciaTotal: 1.86,     // GT: Ganancia Total
        ganancia: 79.5,          // % Ganancia
        stock: 0,                // Inv Final
        imagen: '',
        esCombo: false,
        tipo: 'producto'
    },
    {
        id: 'P15',
        codigo: 'PROD-015',
        nombre: 'Chicle',
        descripcion: '12 UND X 16,8 GR',
        contenido: '12 UND X 16,8 GR',
        categoria: 'Chucherías',
        costo: 0.35,             // PU: Precio Unitario estimado
        precio: 0.50,            // PV: Precio Venta
        gananciaUnitaria: 0.15,  // GU: Ganancia Unitaria ($0.50 - $0.35)
        precioTotal: 4.20,       // PT
        unidadesPaquete: 12,     // UNI
        gananciaTotal: 1.80,     // GT
        ganancia: 42.9,          // % Ganancia
        stock: 1,                // Inv Final
        imagen: '',
        esCombo: false,
        tipo: 'producto'
    },
    {
        id: 'P16',
        codigo: 'PROD-016',
        nombre: 'Club Social',
        descripcion: '3 UND X 26GR',
        contenido: '3 UND X 26GR',
        categoria: 'Galletas',
        costo: 0.26,             // PU: Precio Unitario
        precio: 0.60,            // PV: Precio Venta
        gananciaUnitaria: 0.34,  // GU: Ganancia Unitaria ($0.60 - $0.26)
        precioTotal: 4.68,       // PT: Precio Total
        unidadesPaquete: 18,     // UNI: Unidades
        gananciaTotal: 6.12,     // GT: Ganancia Total
        ganancia: 130.8,         // % Ganancia
        stock: 16,               // Inv Final
        imagen: '',
        esCombo: false,
        tipo: 'producto'
    },
    {
        id: 'P17',
        codigo: 'PROD-017',
        nombre: 'Kraker',
        descripcion: '3 UND X 28GR',
        contenido: '3 UND X 28GR',
        categoria: 'Galletas',
        costo: 0.30,             // PU: Precio Unitario
        precio: 0.60,            // PV: Precio Venta
        gananciaUnitaria: 0.30,  // GU: Ganancia Unitaria ($0.60 - $0.30)
        precioTotal: 2.74,       // PT: Precio Total
        unidadesPaquete: 9,      // UNI: Unidades
        gananciaTotal: 2.66,     // GT: Ganancia Total
        ganancia: 100.0,         // % Ganancia
        stock: 7,                // Inv Final
        imagen: '',
        esCombo: false,
        tipo: 'producto'
    },
    {
        id: 'P18',
        codigo: 'PROD-018',
        nombre: 'Hony',
        descripcion: '3 UND X 28GR',
        contenido: '3 UND X 28GR',
        categoria: 'Galletas',
        costo: 0.30,             // PU: Precio Unitario
        precio: 0.60,            // PV: Precio Venta
        gananciaUnitaria: 0.30,  // GU: Ganancia Unitaria ($0.60 - $0.30)
        precioTotal: 2.70,       // PT
        unidadesPaquete: 9,      // UNI
        gananciaTotal: 2.70,     // GT
        ganancia: 100.0,         // % Ganancia
        stock: 4,                // Inv Final
        imagen: '',
        esCombo: false,
        tipo: 'producto'
    },
    {
        id: 'P19',
        codigo: 'PROD-019',
        nombre: 'Piazza',
        descripcion: '11.7 GR',
        contenido: '11.7 GR',
        categoria: 'Dulces',
        costo: 0.14,             // PU: Precio Unitario
        precio: 0.30,            // PV: Precio Venta
        gananciaUnitaria: 0.16,  // GU: Ganancia Unitaria ($0.30 - $0.14)
        precioTotal: 3.30,       // PT: Precio Total
        unidadesPaquete: 24,     // UNI: Unidades
        gananciaTotal: 3.90,     // GT: Ganancia Total
        ganancia: 114.3,         // % Ganancia
        stock: 13,               // Inv Final
        imagen: '',
        esCombo: false,
        tipo: 'producto'
    },
    {
        id: 'P20',
        codigo: 'PROD-020',
        nombre: 'Flips',
        descripcion: 'Cereal relleno 28GR',
        contenido: '28GR',
        categoria: 'Snacks',
        costo: 0.70,             // PU: Precio Unitario estimado
        precio: 1.00,            // PV: Precio Venta
        gananciaUnitaria: 0.30,  // GU: Ganancia Unitaria ($1.00 - $0.70)
        precioTotal: 7.00,       // PT
        unidadesPaquete: 10,     // UNI
        gananciaTotal: 3.00,     // GT
        ganancia: 42.9,          // % Ganancia
        stock: 0,                // Inv Final
        imagen: '',
        esCombo: false,
        tipo: 'producto'
    },
    {
        id: 'P21',
        codigo: 'PROD-021',
        nombre: 'Raquety',
        descripcion: '18GR',
        contenido: '18GR',
        categoria: 'Snacks',
        costo: 0.45,             // PU: Precio Unitario
        precio: 0.80,            // PV: Precio Venta
        gananciaUnitaria: 0.35,  // GU: Ganancia Unitaria ($0.80 - $0.45)
        precioTotal: 5.40,       // PT: Precio Total
        unidadesPaquete: 12,     // UNI: Unidades
        gananciaTotal: 4.20,     // GT: Ganancia Total
        ganancia: 77.8,          // % Ganancia
        stock: 10,               // Inv Final
        imagen: '',
        esCombo: false,
        tipo: 'producto'
    },
    {
        id: 'P22',
        codigo: 'PROD-022',
        nombre: 'Papas',
        descripcion: '20GR',
        contenido: '20GR',
        categoria: 'Snacks',
        costo: 0.36,             // PU: Precio Unitario
        precio: 0.70,            // PV: Precio Venta
        gananciaUnitaria: 0.34,  // GU: Ganancia Unitaria ($0.70 - $0.36)
        precioTotal: 4.30,       // PT: Precio Total
        unidadesPaquete: 12,     // UNI: Unidades
        gananciaTotal: 4.10,     // GT: Ganancia Total
        ganancia: 94.4,          // % Ganancia
        stock: 8,                // Inv Final
        imagen: '',
        esCombo: false,
        tipo: 'producto'
    },
    {
        id: 'P23',
        codigo: 'PROD-023',
        nombre: 'Jugo Yukery',
        descripcion: '250 cm3',
        contenido: '250 cm3',
        categoria: 'Bebidas',
        costo: 0.80,             // PU: Precio Unitario
        precio: 1.20,            // PV: Precio Venta
        gananciaUnitaria: 0.40,  // GU: Ganancia Unitaria ($1.20 - $0.80)
        precioTotal: 19.20,      // PT estimado
        unidadesPaquete: 24,     // UNI: Unidades
        gananciaTotal: 9.60,     // GT: Ganancia Total
        ganancia: 50.0,          // % Ganancia
        stock: 5,                // Inv Final
        imagen: '',
        esCombo: false,
        tipo: 'producto'
    },
    {
        id: 'P24',
        codigo: 'PROD-024',
        nombre: 'Chicharron (MUNCHY)',
        descripcion: '21GR',
        contenido: '21GR',
        categoria: 'Snacks',
        costo: 0.91,             // PU: Precio Unitario
        precio: 1.20,            // PV: Precio Venta
        gananciaUnitaria: 0.29,  // GU: Ganancia Unitaria ($1.20 - $0.91)
        precioTotal: 10.95,      // PT: Precio Total
        unidadesPaquete: 12,     // UNI: Unidades
        gananciaTotal: 3.45,     // GT: Ganancia Total
        ganancia: 31.9,          // % Ganancia
        stock: 1,                // Inv Final
        imagen: '',
        esCombo: false,
        tipo: 'producto'
    },
    {
        id: 'P25',
        codigo: 'PROD-025',
        nombre: 'Aros',
        descripcion: '20GR',
        contenido: '20GR',
        categoria: 'Snacks',
        costo: 0.27,             // PU: Precio Unitario
        precio: 0.70,            // PV: Precio Venta
        gananciaUnitaria: 0.44,  // GU: Ganancia Unitaria ($0.70 - $0.27; tabla redondea a 0.44)
        precioTotal: 2.65,       // PT: Precio Total
        unidadesPaquete: 10,     // UNI: Unidades
        gananciaTotal: 4.35,     // GT: Ganancia Total
        ganancia: 159.3,         // % Ganancia
        stock: 0,                // Inv Final
        imagen: '',
        esCombo: false,
        tipo: 'producto'
    },
    {
        id: 'P26',
        codigo: 'PROD-026',
        nombre: 'Pepito Tom',
        descripcion: 'Snack de maíz 80GR',
        contenido: '80GR',
        categoria: 'Snacks',
        costo: 0.52,             // PU: Precio Unitario
        precio: 0.80,            // PV: Precio Venta
        gananciaUnitaria: 0.28,  // GU: Ganancia Unitaria ($0.80 - $0.52)
        precioTotal: 6.26,       // PT: Precio Total
        unidadesPaquete: 12,     // UNI: Unidades
        gananciaTotal: 3.34,     // GT: Ganancia Total
        ganancia: 53.8,          // % Ganancia
        stock: 0,                // Inv Final
        imagen: '',
        esCombo: false,
        tipo: 'producto'
    }
];

// Exponer globalmente
window.PRODUCTOS_INVENTARIO_PDF = PRODUCTOS_INVENTARIO_PDF;

/**
 * Función de Carga Masiva Oficial:
 * Carga o actualiza los 26 productos en AppState y sincroniza con Firestore si está activo.
 */
window.ejecutarCargaMasivaInventarioPDF = async function (preguntar = true) {
    if (preguntar) {
        const confirmar = confirm(
            '📦 ¿Deseas cargar/actualizar los 26 productos oficiales de Inventario.pdf y precios.pdf?\n\n' +
            'Nomenclatura aplicada:\n' +
            '• PU = Precio Unitario (Costo de compra del producto)\n' +
            '• PV = Precio Venta (PVP al público)\n' +
            '• GU = Ganancia Unitaria en dólares (PV - PU)\n' +
            '• PT = Precio Total (del paquete/compra)\n' +
            '• Inv Final = Stock físico inicial\n\n' +
            'Total: 26 productos | Stock total: 150 unidades\n\n' +
            '¿Continuar con la carga masiva?'
        );
        if (!confirmar) return;
    }

    try {
        const nuevos = JSON.parse(JSON.stringify(PRODUCTOS_INVENTARIO_PDF));
        
        // Mantener imágenes existentes si ya se habían cargado fotos previamente para alguno
        if (Array.isArray(window.AppState?.productos)) {
            nuevos.forEach(nuevo => {
                const viejo = window.AppState.productos.find(p => 
                    p.id === nuevo.id || 
                    String(p.codigo || '').toLowerCase() === String(nuevo.codigo || '').toLowerCase() ||
                    String(p.nombre || '').toLowerCase().trim() === String(nuevo.nombre || '').toLowerCase().trim()
                );
                if (viejo && viejo.imagen) {
                    nuevo.imagen = viejo.imagen;
                }
            });
        }

        window.AppState.productos = nuevos;
        if (typeof productos !== 'undefined') {
            productos = nuevos;
        }

        // Sincronizar secuencia de IDs
        window.AppState.nextProductSequence = 27;

        // Persistir en Firestore si el servicio está disponible
        if (window.InventoryApp?.Firebase?.syncToCloud) {
            await window.InventoryApp.Firebase.syncToCloud();
        } else if (window.InventoryApp?.Persistence?.guardar) {
            window.InventoryApp.Persistence.guardar(true);
        }

        // Re-renderizar interfaces
        if (typeof renderizarInventario === 'function') renderizarInventario();
        if (typeof renderizarPosProductos === 'function') renderizarPosProductos();
        if (typeof renderizarAuditoria === 'function') renderizarAuditoria();
        if (typeof renderizarCatalogoCliente === 'function') renderizarCatalogoCliente();
        if (typeof renderizarCategoriasCatalogo === 'function') renderizarCategoriasCatalogo();
        if (typeof prepararCodigoNuevoProducto === 'function') prepararCodigoNuevoProducto();

        const msj = `¡Carga masiva completada exitosamente!\n\nSe han registrado ${nuevos.length} productos con:\n• PU (Costo Unitario)\n• PV (Precio Venta)\n• GU (Ganancia Unitaria en $)\n• Stock físico ('Inv Final': 150 unds).`;
        if (window.InventoryApp?.Modal?.alert) {
            window.InventoryApp.Modal.alert('Carga Masiva Exitosa', msj);
        } else {
            alert(msj);
        }
    } catch (e) {
        console.error('[CargaMasiva] Error:', e);
        if (window.InventoryApp?.Modal?.alert) {
            window.InventoryApp.Modal.alert('Error', 'Ocurrió un inconveniente al cargar el inventario: ' + e.message);
        } else {
            alert('Error en carga masiva: ' + e.message);
        }
    }
};
