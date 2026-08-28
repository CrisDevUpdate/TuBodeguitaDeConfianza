/* core/persistence.js - Persistencia Dual: Local (Caché Offline) + Nube (Firebase Firestore) */
window.InventoryApp = window.InventoryApp || {};

(function () {
    const STORAGE_KEY = 'inventoryapp.beta.v1.state';
    let ultimoSnapshot = '';
    let temporizador = null;

    const claves = [
        'productos', 'clientes', 'ventas', 'abonos', 'transacciones', 'carrito',
        'conteosFisicos', 'auditorias', 'eliminaciones', 'clientesEliminados',
        'clienteSeleccionadoId', 'nextProductSequence'
    ];

    function construirSnapshot() {
        const datos = {};
        claves.forEach((clave) => { datos[clave] = AppState[clave]; });
        return JSON.stringify(datos);
    }

    function guardar(force = false) {
        try {
            const snapshot = construirSnapshot();
            if (!force && snapshot === ultimoSnapshot) return false;
            localStorage.setItem(STORAGE_KEY, snapshot);
            ultimoSnapshot = snapshot;
            return true;
        } catch (error) {
            console.warn('No fue posible persistir los datos localmente.', error);
            const status = document.getElementById('persistencia-status');
            if (status) {
                status.textContent = 'Almacenamiento local no disponible';
                status.classList.add('error');
            }
            return false;
        }
    }

    function cargar() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return false;
            const datos = JSON.parse(raw);
            if (!datos || typeof datos !== 'object') return false;

            claves.forEach((clave) => {
                if (Object.prototype.hasOwnProperty.call(datos, clave)) {
                    AppState[clave] = datos[clave];
                }
            });

            ultimoSnapshot = construirSnapshot();
            return true;
        } catch (error) {
            console.warn('No fue posible cargar el respaldo local. Se iniciará con el estado actual.', error);
            return false;
        }
    }

    function iniciar() {
        // 1. Carga inmediata de caché local para arranque instantáneo (0ms)
        const cargado = cargar();
        
        if (temporizador) clearInterval(temporizador);
        temporizador = setInterval(() => guardar(false), 2000);
        window.addEventListener('beforeunload', () => guardar(true));
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') guardar(true);
        });

        // 2. Inicializar conexión a Firebase Firestore en segundo plano
        if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.init === 'function') {
            window.InventoryApp.Firebase.init().catch(err => {
                console.warn('[Persistence] Aviso al inicializar Firebase:', err);
            });
        }

        return cargado;
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

    window.InventoryApp.Persistence = {
        cargar,
        guardar,
        iniciar,
        limpiarTodo,
        exportarRespaldoJSON,
        importarRespaldoJSON,
        STORAGE_KEY
    };
})();
