/*
 * core/factory-reset.js
 * Reinicio de fábrica controlado desde la aplicación.
 * Solo SuperAdmin puede ejecutarlo y requiere confirmación personalizada.
 */
window.InventoryApp = window.InventoryApp || {};

(function () {
    const COLLECTIONS = [
        'productos','clientes','ventas','abonos','transacciones','auditorias',
        'eliminaciones','clientesEliminados','usuarios','config','app_state',
        'premios','perdidas','pagos','recompensas','notificaciones','settings','season'
    ];
    const SUPERADMIN = {
        id: 'SuperAdmin', cedula: 'SuperAdmin', nombre: 'SuperAdmin',
        telefono: '0412-0000000', email: 'superadmin@tubodeguita.com',
        password: '1a09807a0e6928a66d91025ed5fccd713c9edb101e72a1bbcb8a01cd9a53cb51',
        rol: 'admin', estado: 'ACTIVO', activo: true, aprobado: true,
        puntosAcumulados: 0, puntosCanjeados: 0
    };

    function esSuperAdmin() {
        const u = AppState.usuarioActual;
        return !!u && ((u.id || '').toLowerCase() === 'superadmin' || (u.nombre || '').toLowerCase() === 'superadmin');
    }

    function modalConfirmacion() {
        return new Promise(resolve => {
            const old = document.getElementById('factory-reset-modal');
            if (old) old.remove();
            const modal = document.createElement('div');
            modal.id = 'factory-reset-modal';
            modal.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.72);display:flex;align-items:center;justify-content:center;padding:20px;';
            modal.innerHTML = `<div style="width:min(480px,100%);background:#fff;border-radius:18px;padding:24px;box-shadow:0 25px 70px rgba(0,0,0,.25);font-family:inherit">
                <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px"><div style="width:44px;height:44px;border-radius:12px;background:#fee2e2;color:#dc2626;display:grid;place-items:center;font-size:20px">⚠</div><div><h3 style="margin:0">Reinicio de fábrica</h3><small style="color:#64748b">Acción exclusiva de SuperAdmin</small></div></div>
                <p style="color:#334155;line-height:1.5">Se eliminarán permanentemente productos, clientes, ventas, pagos, transacciones, auditorías, premios y usuarios. Solo quedará <strong>SuperAdmin</strong>.</p>
                <p style="font-weight:700;color:#b91c1c">Esta acción no se puede deshacer.</p>
                <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px"><button id="factory-reset-cancel" class="btn btn-outline" type="button">Cancelar</button><button id="factory-reset-ok" class="btn btn-danger" type="button">Sí, reiniciar</button></div>
            </div>`;
            document.body.appendChild(modal);
            modal.querySelector('#factory-reset-cancel').onclick = () => { modal.remove(); resolve(false); };
            modal.querySelector('#factory-reset-ok').onclick = () => { modal.remove(); resolve(true); };
        });
    }

    function toast(mensaje, tipo='success') {
        if (typeof window.showToast === 'function') return window.showToast(mensaje, tipo);
        const el = document.createElement('div');
        el.textContent = mensaje;
        el.style.cssText = `position:fixed;right:20px;bottom:20px;z-index:100001;background:${tipo==='error'?'#dc2626':'#16a34a'};color:#fff;padding:14px 18px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2);font-weight:700;`;
        document.body.appendChild(el); setTimeout(() => el.remove(), 4500);
    }

    async function borrarColeccion(nombre) {
        if (!window.InventoryApp.Firebase || !window.InventoryApp.Firebase.getFirestore) throw new Error('Servicio Firebase no disponible');
        const db = window.InventoryApp.Firebase.getFirestore();
        if (!db) throw new Error('Firestore no está conectado');
        while (true) {
            const snap = await db.collection(nombre).limit(450).get();
            if (snap.empty) break;
            const batch = db.batch();
            snap.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }
    }

    async function reiniciarFabrica() {
        if (!esSuperAdmin()) { toast('Solo SuperAdmin puede reiniciar el sistema.', 'error'); return false; }
        if (!(await modalConfirmacion())) return false;
        try {
            if (!window.InventoryApp.Firebase || typeof window.InventoryApp.Firebase.resetDatabase !== 'function') throw new Error('La función de reinicio de Firebase no está disponible.');
            toast('Reiniciando el sistema…', 'success');
            await window.InventoryApp.Firebase.resetDatabase(SUPERADMIN, COLLECTIONS);
            AppState.productos=[]; AppState.clientes=[]; AppState.ventas=[]; AppState.abonos=[]; AppState.transacciones=[]; AppState.auditorias=[]; AppState.eliminaciones=[]; AppState.clientesEliminados=[]; AppState.usuarios=[{...SUPERADMIN}]; AppState.carrito=[]; AppState.premioMes=null; AppState.canjesPremios=[]; AppState.usuarioActual={...SUPERADMIN};
            if (window.InventoryApp.Persistence && typeof window.InventoryApp.Persistence.guardar === 'function') window.InventoryApp.Persistence.guardar(true);
            if (typeof refrescarTodasLasVistas === 'function') refrescarTodasLasVistas();
            toast('Reinicio completado. Solo queda SuperAdmin.', 'success');
            return true;
        } catch (e) {
            console.error('[FactoryReset]', e);
            toast(`No se pudo reiniciar: ${e.message}`, 'error');
            return false;
        }
    }

    function instalarBoton() {
        if (!esSuperAdmin() || document.getElementById('btn-factory-reset')) return;
        const host = document.querySelector('#main-nav-tabs') || document.querySelector('header');
        if (!host) return;
        const btn = document.createElement('button');
        btn.id = 'btn-factory-reset'; btn.type='button'; btn.className='nav-btn';
        btn.style.cssText='margin-left:auto;color:#b91c1c;border-color:#fecaca;';
        btn.innerHTML='<i class="fas fa-rotate-left"></i> Reiniciar de fábrica';
        btn.onclick = reiniciarFabrica;
        host.appendChild(btn);
    }

    window.InventoryApp.FactoryReset = { reiniciarFabrica, instalarBoton };
    document.addEventListener('DOMContentLoaded', instalarBoton);
    setTimeout(instalarBoton, 1500);
})();