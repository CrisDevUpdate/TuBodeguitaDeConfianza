/* core/dataset-manager.js
 * Reinicio de espacio de trabajo sin borrar datos históricos.
 * Cada reinicio conserva el dataset anterior como JSON en Firestore,
 * crea un nuevo namespace de colecciones y deja únicamente SuperAdmin.
 */
window.InventoryApp = window.InventoryApp || {};

(function () {
    const ADMIN_RESET_PASSWORD_HASH = '80c074001de1a499efd2fcb3a32d77b70afb677982879c7cdb6ed99069961076';
    const DATA_COLLECTION_KEYS = [
        'PRODUCTOS','CLIENTES','VENTAS','ABONOS','TRANSACCIONES','AUDITORIAS',
        'ELIMINACIONES','CLIENTES_ELIMINADOS','USUARIOS'
    ];

    const SUPERADMIN = {
        id: 'SuperAdmin',
        cedula: 'SuperAdmin',
        nombre: 'SuperAdmin',
        telefono: '0412-0000000',
        email: 'superadmin@tubodeguita.com',
        password: '1a09807a0e6928a66d91025ed5fccd713c9edb101e72a1bbcb8a01cd9a53cb51',
        rol: 'admin',
        estado: 'ACTIVO',
        activo: true,
        aprobado: true,
        puntosAcumulados: 0,
        puntosCanjeados: 0
    };

    function toast(message, type = 'success') {
        if (typeof window.showToast === 'function') return window.showToast(message, type);
        const el = document.createElement('div');
        el.textContent = message;
        el.style.cssText = `position:fixed;right:20px;bottom:20px;z-index:120000;background:${type === 'error' ? '#dc2626' : '#16a34a'};color:#fff;padding:14px 18px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2);font-weight:700;`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 4500);
    }

    function getCurrentUser() {
        return window.AppState?.usuarioActual || window.InventoryApp?.Session?.usuarioActual || null;
    }

    function isAdmin() {
        const u = getCurrentUser();
        return !!u && String(u.rol || '').toLowerCase() === 'admin';
    }

    async function sha256(value) {
        const data = new TextEncoder().encode(value);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function activeDatasetId() {
        try { return localStorage.getItem('bodeguita_active_dataset') || 'legacy'; }
        catch (_) { return 'legacy'; }
    }

    function nextDatasetId() {
        const now = new Date();
        const stamp = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
        return `dataset_${stamp}`;
    }

    async function waitForFirebase(timeoutMs = 15000) {
        const started = Date.now();
        while (Date.now() - started < timeoutMs) {
            const service = window.InventoryApp?.Firebase;
            const db = service?.getFirestore?.();
            if (db) return db;
            await new Promise(resolve => setTimeout(resolve, 250));
        }
        return null;
    }

    function firebaseReady() {
        const service = window.InventoryApp?.Firebase;
        return !!(service && typeof service.getFirestore === 'function' && service.getFirestore());
    }

    async function askPassword() {
        return new Promise(resolve => {
            const old = document.getElementById('dataset-reset-modal');
            if (old) old.remove();
            const modal = document.createElement('div');
            modal.id = 'dataset-reset-modal';
            modal.style.cssText = 'position:fixed;inset:0;z-index:120000;background:rgba(15,23,42,.78);display:flex;align-items:center;justify-content:center;padding:20px;';
            modal.innerHTML = `
                <div style="width:min(520px,100%);background:#fff;border-radius:22px;padding:26px;box-shadow:0 30px 90px rgba(0,0,0,.28);">
                    <div style="display:flex;gap:14px;align-items:center;margin-bottom:12px;">
                        <div style="width:48px;height:48px;border-radius:14px;background:#ede9fe;color:#6d28d9;display:grid;place-items:center;font-size:21px;"><i class="fas fa-database"></i></div>
                        <div><h3 style="margin:0">Nuevo espacio de trabajo</h3><small style="color:#64748b">Solo Administrador</small></div>
                    </div>
                    <p style="color:#334155;line-height:1.55;margin:12px 0;">Los datos actuales <strong>no serán eliminados</strong>. Se conservarán como respaldo JSON y el sistema comenzará a trabajar en un nuevo espacio vacío.</p>
                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:12px;margin:14px 0;font-size:.9rem;color:#475569;">
                        <strong>Espacio actual:</strong> ${activeDatasetId()}<br>
                        <strong>Nuevo espacio:</strong> ${nextDatasetId()}
                    </div>
                    <label style="display:block;font-weight:700;color:#334155;margin-bottom:7px;">Contraseña especial de confirmación</label>
                    <input id="dataset-reset-password" type="password" inputmode="numeric" autocomplete="off" placeholder="Contraseña de confirmación" style="width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid #cbd5e1;border-radius:12px;outline:none;">
                    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px;">
                        <button id="dataset-reset-cancel" type="button" class="btn btn-outline">Cancelar</button>
                        <button id="dataset-reset-confirm" type="button" class="btn btn-primary"><i class="fas fa-layer-group"></i> Crear nueva base</button>
                    </div>
                </div>`;
            document.body.appendChild(modal);
            const input = modal.querySelector('#dataset-reset-password');
            modal.querySelector('#dataset-reset-cancel').onclick = () => { modal.remove(); resolve(false); };
            modal.querySelector('#dataset-reset-confirm').onclick = async () => {
                const hash = await sha256(input.value || '');
                if (hash !== ADMIN_RESET_PASSWORD_HASH) {
                    input.value = '';
                    input.focus();
                    toast('Contraseña especial incorrecta.', 'error');
                    return;
                }
                modal.remove();
                resolve(true);
            };
            input.addEventListener('keydown', event => {
                if (event.key === 'Enter') modal.querySelector('#dataset-reset-confirm').click();
                if (event.key === 'Escape') modal.querySelector('#dataset-reset-cancel').click();
            });
            input.focus();
        });
    }

    async function readCollection(db, collectionName) {
        const result = [];
        let lastDoc = null;
        while (true) {
            let query = db.collection(collectionName)
                .orderBy(firebase.firestore.FieldPath.documentId())
                .limit(400);
            if (lastDoc) query = query.startAfter(lastDoc);
            const snap = await query.get();
            if (snap.empty) break;
            snap.docs.forEach(doc => result.push({ id: doc.id, ...doc.data() }));
            lastDoc = snap.docs[snap.docs.length - 1].id;
            if (snap.size < 400) break;
        }
        return result;
    }

    function toJsonSafe(value) {
        return JSON.parse(JSON.stringify(value, (key, val) => {
            if (val && typeof val.toDate === 'function') return val.toDate().toISOString();
            if (val && typeof val === 'object' && val.constructor && val.constructor.name === 'Timestamp') return val.toDate().toISOString();
            return val;
        }));
    }

    async function archiveCurrentDataset(db, datasetId, newDatasetId, snapshot) {
        const archiveId = `${datasetId}__${newDatasetId}`;
        const manifestRef = db.collection('data_archives').doc(archiveId);
        const manifest = {
            archiveId,
            sourceDataset: datasetId,
            newDataset: newDatasetId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            format: 'JSON-per-record',
            collections: {}
        };

        for (const key of DATA_COLLECTION_KEYS) {
            const collectionName = typeof window.InventoryApp.Firebase.getCollectionName === 'function'
                ? window.InventoryApp.Firebase.getCollectionName(key)
                : key.toLowerCase();
            const records = snapshot[key] || [];
            manifest.collections[key] = records.length;
            for (const record of records) {
                const safe = toJsonSafe(record);
                await manifestRef.collection(key.toLowerCase()).doc(String(record.id)).set({
                    json: JSON.stringify(safe),
                    archivedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        }

        await manifestRef.set(manifest, { merge: true });
        return { archiveId, manifest };
    }

    function downloadJsonArchive(archiveId, snapshot) {
        try {
            const payload = {
                version: '4.3.10-beta',
                archiveId,
                exportedAt: new Date().toISOString(),
                ...snapshot
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${archiveId}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (e) {
            console.warn('[DatasetManager] No se pudo descargar el respaldo JSON:', e);
        }
    }

    async function createNewWorkspace() {
        if (!isAdmin()) {
            toast('Solo un Administrador puede crear un nuevo espacio.', 'error');
            return false;
        }
        if (!(await askPassword())) return false;

        const db = await waitForFirebase();
        if (!db) {
            toast('Firebase todavía no terminó de conectarse. Espera unos segundos y vuelve a intentarlo.', 'error');
            return false;
        }

        const firebaseService = window.InventoryApp.Firebase;
        const current = activeDatasetId();
        const next = nextDatasetId();
        const archiveId = `${current}__${next}`;
        const snapshot = {};

        try {
            toast('Guardando la base actual como respaldo…');

            for (const key of DATA_COLLECTION_KEYS) {
                const collectionName = firebaseService.getCollectionName(key);
                snapshot[key] = await readCollection(db, collectionName);
            }

            await archiveCurrentDataset(db, current, next, snapshot);

            // No se borra ningún documento. El cambio de namespace hace que
            // las nuevas operaciones se escriban en colecciones completamente nuevas.
            localStorage.setItem('bodeguita_active_dataset', next);
            await db.collection('config').doc('dataset_control').set({
                activeDatasetId: next,
                previousDatasetId: current,
                lastArchiveId: archiveId,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            // El nuevo espacio comienza únicamente con SuperAdmin.
            await db.collection(`${next}__usuarios`).doc('SuperAdmin').set({
                ...SUPERADMIN,
                fechaRegistro: new Date().toISOString(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            downloadJsonArchive(archiveId, snapshot);

            toast(`Nuevo espacio ${next} creado. Los datos anteriores siguen intactos.`);
            setTimeout(() => window.location.reload(), 900);
            return true;
        } catch (error) {
            console.error('[DatasetManager]', error);
            toast(`No se pudo crear el nuevo espacio: ${error.message || error}`, 'error');
            return false;
        }
    }

    function installSettingsButton() {
        const nav = document.querySelector('#main-nav-tabs');
        if (!nav || document.getElementById('btn-dataset-reset')) return;
        if (!isAdmin()) return;

        const btn = document.createElement('button');
        btn.id = 'btn-dataset-reset';
        btn.type = 'button';
        btn.className = 'nav-btn nav-admin-only';
        btn.innerHTML = '<i class="fas fa-database"></i> Configuraciones';
        btn.title = 'Crear un nuevo espacio sin borrar los datos históricos';
        btn.onclick = () => createNewWorkspace();
        nav.appendChild(btn);
    }

    function scheduleButtonInstall() {
        [500, 1500, 3000, 5000].forEach(delay => setTimeout(installSettingsButton, delay));
    }

    window.InventoryApp.DatasetManager = {
        createNewWorkspace,
        installSettingsButton,
        getActiveDatasetId: activeDatasetId
    };

    document.addEventListener('DOMContentLoaded', scheduleButtonInstall);
    window.addEventListener('inventoryapp:firebase-ready', scheduleButtonInstall);
    window.addEventListener('inventoryapp:session-ready', scheduleButtonInstall);
    window.addEventListener('inventoryapp:user-changed', scheduleButtonInstall);
})();
