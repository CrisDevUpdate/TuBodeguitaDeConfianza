/**
 * /context/AppState.js
 * Single Source of Truth & Central State Manager for Tu Bodeguita de Confianza
 * 
 * Expone estado global sincronizado en window.AppState y window.InventoryApp.state
 * compatible con módulos ES, Serverless API Handlers y scripts del navegador.
 */

window.InventoryApp = window.InventoryApp || {};

if (!window.AppState) {
    window.AppState = window.InventoryApp.state || {
        tasaActiva: 0,
        tasaUSD_BCV: 0,
        tasaEUR_BCV: 0,
        fechaTasaBCV: null,
        monedaSeleccionada: 'USD',
        productos: [],
        clientes: [],
        ventas: [],
        abonos: [],
        transacciones: [],
        carrito: [],
        clienteSeleccionadoId: null,
        productoImagenTemporal: '',
        conteosFisicos: {},
        auditorias: [],
        eliminaciones: [],
        clientesEliminados: [],
        usuarios: [
            {
                id: 'SuperAdmin',
                cedula: 'SuperAdmin',
                nombre: 'SuperAdmin',
                telefono: '0412-0000000',
                email: 'superadmin@tubodeguita.com',
                password: '1a09807a0e6928a66d91025ed5fccd713c9edb101e72a1bbcb8a01cd9a53cb51',
                rol: 'admin',
                estado: 'ACTIVO',
                puntosAcumulados: 0,
                puntosCanjeados: 0,
                fechaRegistro: '2026-08-28 12:00'
            }
        ],
        usuarioActual: null,
        premioMes: {
            nombre: 'Cafetera Espresso Digital 1.5L',
            imagen: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600&auto=format&fit=crop&q=80',
            puntosRequeridos: 200,
            puntosPorDolar: 1,
            temporadaActiva: true,
            descripcion: 'Premio exclusivo del mes para nuestros clientes más fieles. ¡Acumula puntos con cada compra completada!'
        },
        canjesPremios: [],
        nextProductSequence: 1,
        archivosHistoricos: []
    };
    window.InventoryApp.state = window.AppState;
}

export const AppState = window.AppState;
export default AppState;
