/* core/persistence.js - Persistencia Híbrida: Firestore Nube + Respaldo Local Continuo */
window.InventoryApp = window.InventoryApp || {};

(function () {
    const STORAGE_KEY = 'inventoryapp.beta.v1.state';

    const claves = [
        'productos', 'clientes', 'ventas', 'abonos', 'transacciones', 'carrito',
        'conteosFisicos', 'auditorias', 'eliminaciones', 'clientesEliminados',
        'clienteSeleccionadoId', 'nextProductSequence', 'usuarios', 'usuarioActual',
        'premioMes', 'canjesPremios', 'temporadaInviernoActiva', 'treeProgress'
    ];

    function asegurarUsuarioAdminInicial() {
        if (!AppState.premioMes || typeof AppState.premioMes !== 'object') {
            AppState.premioMes = {
                nombre: 'Cafetera Espresso Digital 1.5L',
                imagen: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600&auto=format&fit=crop&q=80',
                puntosRequeridos: 200,
                puntosPorDolar: 1,
                descripcion: 'Premio exclusivo del mes para nuestros clientes más fieles. ¡Acumula puntos con cada compra completada!'
            };
        }
        if (!Array.isArray(AppState.canjesPremios)) {
            AppState.canjesPremios = [];
        }

        if (!Array.isArray(AppState.usuarios)) {
            AppState.usuarios = [];
        }

        // 1. Garantizar existencia y permisos totales del SuperAdmin
        let superAdmin = AppState.usuarios.find(u => 
            (u.id || '').toUpperCase() === 'SUPERADMIN' ||
            (u.cedula || '').toUpperCase() === 'SUPERADMIN' ||
            (u.nombre || '').toUpperCase() === 'SUPERADMIN' ||
            (u.email || '').toLowerCase() === 'superadmin@tubodeguita.com'
        );

        // Hash SHA-256 criptográfico para SuperAdmin
        const HASH_SUPERADMIN = '1a09807a0e6928a66d91025ed5fccd713c9edb101e72a1bbcb8a01cd9a53cb51';

        if (!superAdmin) {
            superAdmin = {
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
            AppState.usuarios.push(superAdmin);
        } else {
            superAdmin.password = HASH_SUPERADMIN;
            superAdmin.rol = 'admin';
            superAdmin.estado = 'ACTIVO';
        }
    }

    function guardar(force = false) {
        // 1. Respaldo inmediato y continuo en localStorage para máxima tolerancia a fallos/offline
        try {
            const stateToSave = {};
            claves.forEach(k => {
                if (AppState[k] !== undefined) {
                    stateToSave[k] = AppState[k];
                }
            });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
        } catch (e) {
            console.warn('[Persistence] Error guardando copia en localStorage:', e);
        }
        return true;
    }

    function cargar() {
        // Cargar estado local previo como respaldo inmediato
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                claves.forEach(k => {
                    if (parsed[k] !== undefined) {
                        AppState[k] = parsed[k];
                    }
                });
            }
        } catch (e) {
            console.warn('[Persistence] Error cargando copia local de localStorage:', e);
        }
        // Garantizar SuperAdmin base
        asegurarUsuarioAdminInicial();
        if (!AppState.usuarioActual) {
            AppState.usuarioActual = null;
        }
        return true;
    }

    function iniciar() {
        // 1. Inicializar estado base en memoria y restaurar caché local
        cargar();
        
        // 2. Inicializar conexión a Firebase Firestore
        if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.init === 'function') {
            window.InventoryApp.Firebase.init().then(() => {
                console.log('[Persistence] Firebase conectado y datos sincronizados.');
            }).catch(err => {
                console.warn('[Persistence] Aviso al inicializar Firebase:', err);
            });
        }

        return true;
    }

    async function limpiarBaseDeDatosVirgen() {
        // 1. Limpiar estado en memoria
        AppState.productos = [];
        AppState.clientes = [];
        AppState.ventas = [];
        AppState.abonos = [];
        AppState.transacciones = [];
        AppState.carrito = [];
        AppState.clienteSeleccionadoId = null;
        AppState.productoImagenTemporal = '';
        AppState.conteosFisicos = {};
        AppState.auditorias = [];
        AppState.eliminaciones = [];
        AppState.clientesEliminados = [];
        AppState.nextProductSequence = 1;
        AppState.canjesPremios = [];
        
        // 2. SuperAdmin intacto con clave 1810
        asegurarUsuarioAdminInicial();
        AppState.usuarioActual = null;

        // 3. Limpiar localStorage
        localStorage.removeItem(STORAGE_KEY);
        guardar(true);

        // 4. Limpiar en Firestore si está conectado
        if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.purgarBaseDeDatosCompleta === 'function') {
            await window.InventoryApp.Firebase.purgarBaseDeDatosCompleta();
        }

        return true;
    }

    function limpiarTodo() {
        localStorage.removeItem(STORAGE_KEY);
        ultimoSnapshot = '';
    }

    /**
     * Exporta toda la base de datos a un archivo JSON descargable
     */
    function exportarRespaldoJSON() {
        const datos = {};
        claves.forEach(k => { datos[k] = AppState[k]; });
        datos.fechaExportacion = new Date().toISOString();
        datos.version = window.InventoryApp.version || '4.0.0';

        const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bodeguita-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Importa y restaura base de datos desde un archivo JSON
     */
    function importarRespaldoJSON(archivo) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const datos = JSON.parse(e.target.result);
                    if (!datos || typeof datos !== 'object') throw new Error('Formato de archivo inválido');

                    claves.forEach(clave => {
                        if (datos.hasOwnProperty(clave)) {
                            AppState[clave] = datos[clave];
                        }
                    });

                    guardar(true);

                    // Sincronizar hacia Firebase
                    if (window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.syncToCloud === 'function') {
                        await window.InventoryApp.Firebase.syncToCloud();
                    }

                    resolve(true);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsText(archivo);
        });
    }

    /**
     * Exporta toda la base de datos completa a un archivo máster Excel (.xlsx) multihajas
     */
    function exportarMasterExcel() {
        if (typeof XLSX === 'undefined') {
            alert('La librería SheetJS (XLSX) no está disponible en este momento.');
            return;
        }

        try {
            const wb = XLSX.utils.book_new();

            // 1. Hoja de Usuarios
            const dataUsuarios = (AppState.usuarios || []).map(u => ({
                'Cédula / RIF': u.cedula || u.id || '',
                'Nombre y Apellido / Razón Social': u.nombre || '',
                'Teléfono': u.telefono || '',
                'Correo Electrónico': u.email || '',
                'Rol': u.rol || 'cliente',
                'Estado': u.estado || 'PENDIENTE_APROBACION',
                'Puntos Acumulados': Number(u.puntosAcumulados || 0),
                'Puntos Canjeados': Number(u.puntosCanjeados || 0),
                'Fecha de Registro': u.fechaRegistro || ''
            }));
            const wsUsuarios = XLSX.utils.json_to_sheet(dataUsuarios.length ? dataUsuarios : [{ 'Cédula / RIF': '', 'Nombre y Apellido / Razón Social': '', 'Teléfono': '', 'Correo Electrónico': '', 'Rol': '', 'Estado': '', 'Puntos Acumulados': 0, 'Puntos Canjeados': 0, 'Fecha de Registro': '' }]);
            XLSX.utils.book_append_sheet(wb, wsUsuarios, 'Usuarios');

            // 2. Hoja de Premio del Mes & Gamificación
            const pm = AppState.premioMes || {};
            const dataPremio = [{
                'Nombre Premio': pm.nombre || '',
                'URL Imagen': pm.imagen || '',
                'Puntos Requeridos': Number(pm.puntosRequeridos || 200),
                'Puntos por Dólar': Number(pm.puntosPorDolar || 1),
                'Descripción': pm.descripcion || ''
            }];
            const wsPremio = XLSX.utils.json_to_sheet(dataPremio);
            XLSX.utils.book_append_sheet(wb, wsPremio, 'PremioDelMes');

            // 3. Hoja de Canjes Realizados
            const dataCanjes = (AppState.canjesPremios || []).map(c => ({
                'ID Canje': c.id || '',
                'Cédula Cliente': c.clienteCedula || '',
                'Nombre Cliente': c.clienteNombre || '',
                'Premio': c.premioNombre || '',
                'Puntos Canjeados': Number(c.puntos || 0),
                'Fecha Canje': c.fecha || '',
                'Estado Entrega': c.estado || 'ENTREGADO'
            }));
            const wsCanjes = XLSX.utils.json_to_sheet(dataCanjes.length ? dataCanjes : [{ 'ID Canje': '', 'Cédula Cliente': '', 'Nombre Cliente': '', 'Premio': '', 'Puntos Canjeados': 0, 'Fecha Canje': '', 'Estado Entrega': '' }]);
            XLSX.utils.book_append_sheet(wb, wsCanjes, 'Canjes');

            // 4. Hoja de Productos
            const dataProductos = (AppState.productos || []).map(p => ({
                'ID': p.id || '',
                'Código': p.codigo || '',
                'Nombre': p.nombre || '',
                'Categoría': p.categoria || '',
                'Costo ($)': Number(p.costo || 0),
                'Precio ($)': Number(p.precio || 0),
                'Stock': Number(p.stock || 0)
            }));
            const wsProductos = XLSX.utils.json_to_sheet(dataProductos.length ? dataProductos : [{ 'ID': '', 'Código': '', 'Nombre': '', 'Categoría': '', 'Costo ($)': 0, 'Precio ($)': 0, 'Stock': 0 }]);
            XLSX.utils.book_append_sheet(wb, wsProductos, 'Productos');

            // 3. Hoja de Clientes
            const dataClientes = (AppState.clientes || []).map(c => ({
                'ID / Cédula': c.id || '',
                'Nombre': c.nombre || '',
                'Teléfono': c.telefono || ''
            }));
            const wsClientes = XLSX.utils.json_to_sheet(dataClientes.length ? dataClientes : [{ 'ID / Cédula': '', 'Nombre': '', 'Teléfono': '' }]);
            XLSX.utils.book_append_sheet(wb, wsClientes, 'Clientes');

            // 4. Hoja de Ventas
            const dataVentas = (AppState.ventas || []).map(v => ({
                'ID Venta': v.id || '',
                'Cliente ID': v.clienteId || '',
                'Fecha': v.fecha || '',
                'Total ($)': Number(v.total || 0),
                'Condición Pago': v.tipo || 'Contado',
                'Items': JSON.stringify(v.items || [])
            }));
            const wsVentas = XLSX.utils.json_to_sheet(dataVentas.length ? dataVentas : [{ 'ID Venta': '', 'Cliente ID': '', 'Fecha': '', 'Total ($)': 0, 'Condición Pago': '', 'Items': '' }]);
            XLSX.utils.book_append_sheet(wb, wsVentas, 'Ventas');

            // 5. Hoja de Transacciones / Referencias
            const dataTx = (AppState.transacciones || []).map(t => ({
                'Referencia': t.referencia || '',
                'Cliente': t.cliente || '',
                'Monto': Number(t.monto || 0),
                'Moneda': t.moneda || 'VES',
                'Fecha': t.fecha || '',
                'Estado': t.estado || ''
            }));
            const wsTx = XLSX.utils.json_to_sheet(dataTx.length ? dataTx : [{ 'Referencia': '', 'Cliente': '', 'Monto': 0, 'Moneda': '', 'Fecha': '', 'Estado': '' }]);
            XLSX.utils.book_append_sheet(wb, wsTx, 'Transacciones');

            // 6. Hoja de Auditorías
            const dataAud = (AppState.auditorias || []).map(a => ({
                'ID': a.id || '',
                'Fecha': a.fecha || '',
                'Responsable': a.responsable || '',
                'Total Items': a.totalItems || 0,
                'Items con Diferencia': a.totalDiferencias || 0
            }));
            const wsAud = XLSX.utils.json_to_sheet(dataAud.length ? dataAud : [{ 'ID': '', 'Fecha': '', 'Responsable': '', 'Total Items': 0, 'Items con Diferencia': 0 }]);
            XLSX.utils.book_append_sheet(wb, wsAud, 'Auditorias');

            const nombreArchivo = `TuBodeguita_MasterBackup_${new Date().toISOString().slice(0, 10)}.xlsx`;
            XLSX.writeFile(wb, nombreArchivo);
            return true;
        } catch (e) {
            console.error('Error al exportar máster Excel:', e);
            alert('Error al generar el archivo máster Excel: ' + e.message);
            return false;
        }
    }

    /**
     * Importa y sincroniza base de datos completa desde un archivo máster Excel (.xlsx)
     */
    function importarMasterExcel(archivo) {
        return new Promise((resolve, reject) => {
            if (typeof XLSX === 'undefined') {
                return reject(new Error('Librería XLSX no disponible.'));
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });

                    // 1. Procesar Usuarios
                    if (workbook.SheetNames.includes('Usuarios')) {
                        const sheet = workbook.Sheets['Usuarios'];
                        const json = XLSX.utils.sheet_to_json(sheet);
                        if (json.length > 0) {
                            const usuariosImportados = json.map(row => ({
                                id: String(row['Cédula / RIF'] || row['cedula'] || row['id'] || '').trim(),
                                cedula: String(row['Cédula / RIF'] || row['cedula'] || row['id'] || '').trim(),
                                nombre: String(row['Nombre y Apellido / Razón Social'] || row['nombre'] || '').trim(),
                                telefono: String(row['Teléfono'] || row['telefono'] || '').trim(),
                                email: String(row['Correo Electrónico'] || row['email'] || '').trim(),
                                rol: String(row['Rol'] || row['rol'] || 'cliente').toLowerCase(),
                                estado: String(row['Estado'] || row['estado'] || 'PENDIENTE_APROBACION').toUpperCase(),
                                puntosAcumulados: Number(row['Puntos Acumulados'] || row['puntosAcumulados'] || 0),
                                puntosCanjeados: Number(row['Puntos Canjeados'] || row['puntosCanjeados'] || 0),
                                fechaRegistro: String(row['Fecha de Registro'] || row['fechaRegistro'] || new Date().toISOString().substring(0, 16)),
                                password: '123'
                            })).filter(u => u.cedula && u.nombre);

                            if (usuariosImportados.length > 0) {
                                AppState.usuarios = usuariosImportados;
                            }
                        }
                    }

                    // 2. Procesar Premio del Mes
                    if (workbook.SheetNames.includes('PremioDelMes')) {
                        const sheet = workbook.Sheets['PremioDelMes'];
                        const json = XLSX.utils.sheet_to_json(sheet);
                        if (json.length > 0 && json[0]['Nombre Premio']) {
                            AppState.premioMes = {
                                nombre: String(json[0]['Nombre Premio'] || '').trim(),
                                imagen: String(json[0]['URL Imagen'] || '').trim(),
                                puntosRequeridos: Number(json[0]['Puntos Requeridos'] || 200),
                                puntosPorDolar: Number(json[0]['Puntos por Dólar'] || 1),
                                descripcion: String(json[0]['Descripción'] || '').trim()
                            };
                        }
                    }

                    // 3. Procesar Canjes
                    if (workbook.SheetNames.includes('Canjes')) {
                        const sheet = workbook.Sheets['Canjes'];
                        const json = XLSX.utils.sheet_to_json(sheet);
                        if (json.length > 0) {
                            AppState.canjesPremios = json.map(row => ({
                                id: String(row['ID Canje'] || row['id'] || ''),
                                clienteCedula: String(row['Cédula Cliente'] || row['clienteCedula'] || ''),
                                clienteNombre: String(row['Nombre Cliente'] || row['clienteNombre'] || ''),
                                premioNombre: String(row['Premio'] || row['premioNombre'] || ''),
                                puntos: Number(row['Puntos Canjeados'] || row['puntos'] || 0),
                                fecha: String(row['Fecha Canje'] || row['fecha'] || ''),
                                estado: String(row['Estado Entrega'] || row['estado'] || 'ENTREGADO')
                            })).filter(c => c.clienteCedula && c.premioNombre);
                        }
                    }

                    // 4. Procesar Productos
                    if (workbook.SheetNames.includes('Productos')) {
                        const sheet = workbook.Sheets['Productos'];
                        const json = XLSX.utils.sheet_to_json(sheet);
                        if (json.length > 0) {
                            const productosImportados = json.map(row => ({
                                id: String(row['ID'] || row['id'] || ('P' + Math.random().toString(36).substr(2, 6))),
                                codigo: String(row['Código'] || row['codigo'] || '').trim(),
                                nombre: String(row['Nombre'] || row['nombre'] || '').trim(),
                                categoria: String(row['Categoría'] || row['categoria'] || 'General').trim(),
                                costo: Number(row['Costo ($)'] || row['costo'] || 0),
                                precio: Number(row['Precio ($)'] || row['precio'] || 0),
                                stock: Number(row['Stock'] || row['stock'] || 0)
                            })).filter(p => p.nombre);

                            if (productosImportados.length > 0) {
                                AppState.productos = productosImportados;
                            }
                        }
                    }

                    // 3. Procesar Clientes
                    if (workbook.SheetNames.includes('Clientes')) {
                        const sheet = workbook.Sheets['Clientes'];
                        const json = XLSX.utils.sheet_to_json(sheet);
                        if (json.length > 0) {
                            const clientesImportados = json.map(row => ({
                                id: String(row['ID / Cédula'] || row['id'] || '').trim(),
                                nombre: String(row['Nombre'] || row['nombre'] || '').trim(),
                                telefono: String(row['Teléfono'] || row['telefono'] || '').trim()
                            })).filter(c => c.id && c.nombre);

                            if (clientesImportados.length > 0) {
                                AppState.clientes = clientesImportados;
                            }
                        }
                    }

                    asegurarUsuarioAdminInicial();
                    guardar(true);

                    // Sincronizar hacia Firebase si está disponible
                    if (window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.syncToCloud === 'function') {
                        await window.InventoryApp.Firebase.syncToCloud();
                    }

                    resolve(true);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(archivo);
        });
    }

    window.InventoryApp.Persistence = {
        cargar,
        guardar,
        iniciar,
        limpiarTodo,
        limpiarBaseDeDatosVirgen,
        exportarRespaldoJSON,
        importarRespaldoJSON,
        exportarMasterExcel,
        importarMasterExcel,
        asegurarUsuarioAdminInicial,
        STORAGE_KEY
    };
})();
