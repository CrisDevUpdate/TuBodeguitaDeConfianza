/* Factory Reset - backup JSON + protected Firestore reset */
(function () {
    'use strict';

    const PASSWORD = '140902';
    const COLLECTIONS = [
        'productos', 'clientes', 'ventas', 'abonos', 'transacciones',
        'auditorias', 'perdidas', 'premios', 'usuarios', 'clientesEliminados',
        'eliminaciones', 'config', 'app_state', 'settings', 'season',
        'pagos', 'recompensas', 'notificaciones'
    ];

    function getCurrentUser() {
        return window.AppState?.currentUser || window.AppState?.usuarioActual ||
            window.InventoryApp?.Auth?.currentUser || window.usuarioActual || null;
    }

    function isAdmin() {
        const u = getCurrentUser();
        return !!u && (String(u.rol || u.role || '').toLowerCase() === 'admin' ||
            String(u.usuario || u.username || '').toLowerCase() === 'superadmin');
    }

    function showToast(message, type) {
        if (typeof window.mostrarToast === 'function') return window.mostrarToast(message, type || 'info');
        const box = document.createElement('div');
        box.textContent = message;
        box.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:100000;padding:13px 16px;border-radius:12px;background:#111827;color:white;box-shadow:0 10px 30px rgba(0,0,0,.25);font-weight:700;max-width:360px;';
        document.body.appendChild(box);
        setTimeout(() => box.remove(), 4500);
    }

    function downloadBackup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const previous = Number(localStorage.getItem('factoryResetBackupSequence') || 0) + 1;
        localStorage.setItem('factoryResetBackupSequence', String(previous));
        const payload = {
            backupType: 'TuBodeguitaDeConfianza factory reset',
            version: '4.3.9-beta',
            sequence: previous,
            createdAt: new Date().toISOString(),
            appState: window.AppState || {},
            collectionsBackedUp: COLLECTIONS
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `TuBodeguita-backup-reinicio-${String(previous).padStart(3, '0')}-${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function customConfirm(title, body, onAccept) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.62);display:flex;align-items:center;justify-content:center;padding:20px;';
        overlay.innerHTML = `<div style="width:min(520px,100%);background:#fff;border-radius:18px;padding:24px;box-shadow:0 25px 70px rgba(0,0,0,.3);font-family:inherit;"><h3 style="margin:0 0 10px;color:#991b1b;"><i class="fas fa-triangle-exclamation"></i> ${title}</h3><p style="line-height:1.55;color:#475569;margin:0 0 18px;">${body}</p><div style="display:flex;justify-content:flex-end;gap:10px;"><button type="button" data-cancel class="btn btn-outline">Cancelar</button><button type="button" data-accept class="btn" style="background:#dc2626;color:#fff;">Continuar</button></div></div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('[data-cancel]').onclick = () => overlay.remove();
        overlay.querySelector('[data-accept]').onclick = () => { overlay.remove(); onAccept(); };
    }

    function askPassword(onOk) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.68);display:flex;align-items:center;justify-content:center;padding:20px;';
        overlay.innerHTML = `<div style="width:min(430px,100%);background:#fff;border-radius:18px;padding:24px;box-shadow:0 25px 70px rgba(0,0,0,.3);"><h3 style="margin:0 0 8px;">Autorización de Administrador</h3><p style="color:#64748b;margin:0 0 16px;">Introduce la contraseña especial para confirmar el reinicio.</p><input id="factory-reset-pass" type="password" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="Contraseña especial" style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #cbd5e1;border-radius:10px;font-size:1.1rem;letter-spacing:.25em;"><div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px;"><button type="button" data-cancel class="btn btn-outline">Cancelar</button><button type="button" data-accept class="btn btn-primary">Autorizar reinicio</button></div></div>`;
        document.body.appendChild(overlay);
        const input = overlay.querySelector('#factory-reset-pass');
        setTimeout(() => input.focus(), 50);
        const reject = () => { overlay.remove(); showToast('Contraseña incorrecta. El reinicio fue cancelado.', 'error'); };
        overlay.querySelector('[data-cancel]').onclick = () => overlay.remove();
        overlay.querySelector('[data-accept]').onclick = () => {
            if (input.value !== PASSWORD) return reject();
            overlay.remove();
            onOk();
        };
        input.addEventListener('keydown', e => { if (e.key === 'Enter') overlay.querySelector('[data-accept]').click(); });
    }

    async function deleteAllFirestore() {
        const firebase = window.firebase;
        if (!firebase?.firestore) {
            throw new Error('No se encontró el cliente Firestore en la aplicación.');
        }
        const db = firebase.firestore();
        for (const name of COLLECTIONS) {
            while (true) {
                const snap = await db.collection(name).limit(400).get();
                if (snap.empty) break;
                const batch = db.batch();
                snap.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
            }
        }
        await db.collection('usuarios').doc('SUPERADMIN').set({
            id: 'SUPERADMIN', usuario: 'SuperAdmin', username: 'SuperAdmin',
            nombre: 'SuperAdmin', email: '', rol: 'admin', estado: 'ACTIVO',
            activo: true, aprobado: true, password: '1810',
            fechaCreacion: new Date().toISOString(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await db.collection('config').doc('general').set({
            databaseResetCompleted: true,
            version: '4.3.9-beta',
            seasonActive: false,
            activePrizeId: null,
            resetAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    async function resetFactory() {
        if (!isAdmin()) return showToast('Solo un Administrador puede reiniciar el sistema.', 'error');
        customConfirm('Reinicio de fábrica', 'Se eliminarán los registros actuales de la aplicación. Antes se descargará un respaldo JSON independiente. Esta acción no se puede deshacer.', () => {
            askPassword(async () => {
                try {
                    downloadBackup();
                    await deleteAllFirestore();
                    localStorage.clear();
                    sessionStorage.clear();
                    showToast('Reinicio completado. Solo queda SuperAdmin.', 'success');
                    setTimeout(() => window.location.reload(), 1200);
                } catch (error) {
                    console.error('[FactoryReset]', error);
                    showToast('No fue posible completar el reinicio: ' + (error.message || error), 'error');
                }
            });
        });
    }

    function findConfigAnchor() {
        return document.querySelector('[data-tab="configuracion"], [data-tab="config"], #configuracion, #config, .tab-content.configuracion, .tab-content.config');
    }

    function renderButton() {
        const old = document.getElementById('factory-reset-panel');
        if (old) old.remove();
        if (!isAdmin()) return;
        const activeConfig = document.querySelector('.nav-btn.active[data-tab="configuracion"], .nav-btn.active[data-tab="config"]');
        if (!activeConfig) return;
        const panel = findConfigAnchor();
        const card = document.createElement('section');
        card.id = 'factory-reset-panel';
        card.style.cssText = 'margin:22px 0;padding:20px;border:1px solid #fecaca;border-radius:16px;background:linear-gradient(135deg,#fff,#fff7f7);box-shadow:0 8px 24px rgba(15,23,42,.08);';
        card.innerHTML = `<div style="display:flex;align-items:center;gap:14px;justify-content:space-between;flex-wrap:wrap;"><div><h3 style="margin:0 0 5px;color:#991b1b;"><i class="fas fa-rotate-left"></i> Reinicio de fábrica</h3><p style="margin:0;color:#64748b;font-size:.9rem;">Elimina los registros y deja únicamente el usuario SuperAdmin. Antes se genera un respaldo JSON.</p></div><button type="button" id="btn-factory-reset" class="btn" style="background:#dc2626;color:#fff;border:0;padding:12px 18px;border-radius:10px;font-weight:800;"><i class="fas fa-trash-can"></i> Reiniciar de fábrica</button></div>`;
        (panel || document.querySelector('.container'))?.appendChild(card);
        card.querySelector('#btn-factory-reset').onclick = resetFactory;
    }

    function instalarBoton() {
        renderButton();
        document.querySelectorAll('[data-tab="configuracion"], [data-tab="config"]').forEach(el => {
            if (!el.dataset.factoryResetBound) {
                el.dataset.factoryResetBound = '1';
                el.addEventListener('click', () => setTimeout(renderButton, 50));
            }
        });
    }

    window.InventoryApp = window.InventoryApp || {};
    window.InventoryApp.FactoryReset = { instalarBoton, resetFactory };
    document.addEventListener('DOMContentLoaded', () => {
        instalarBoton();
        setTimeout(instalarBoton, 800);
        setTimeout(instalarBoton, 1800);
    });
})();
