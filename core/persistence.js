/* core/persistence.js - persistence local resilient */
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
        const cargado = cargar();
        if (temporizador) clearInterval(temporizador);
        temporizador = setInterval(() => guardar(false), 1500);
        window.addEventListener('beforeunload', () => guardar(true));
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') guardar(true);
        });

        const status = document.getElementById('persistencia-status');
        if (status) {
            status.textContent = cargado ? 'Datos locales restaurados' : 'Guardado automático activo';
            status.classList.toggle('success', true);
        }
        return cargado;
    }

    function limpiarTodo() {
        localStorage.removeItem(STORAGE_KEY);
        ultimoSnapshot = '';
    }

    window.InventoryApp.Persistence = { cargar, guardar, iniciar, limpiarTodo, STORAGE_KEY };
})();
