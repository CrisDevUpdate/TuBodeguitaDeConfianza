/**
 * core/google-drive-service.js
 * Integración con Google Drive API v3 y Firebase Auth para respaldos y exportaciones seguras.
 */

window.InventoryApp = window.InventoryApp || {};

(function () {
    const DRIVE_SCOPES = [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.activity',
        'https://www.googleapis.com/auth/drive.activity.readonly',
        'https://www.googleapis.com/auth/drive.appdata',
        'https://www.googleapis.com/auth/drive.apps.readonly',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.install',
        'https://www.googleapis.com/auth/drive.meet.readonly',
        'https://www.googleapis.com/auth/drive.metadata',
        'https://www.googleapis.com/auth/drive.metadata.readonly',
        'https://www.googleapis.com/auth/drive.photos.readonly',
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.scripts'
    ];

    let cachedAccessToken = null;
    let currentUser = null;
    let isSigningIn = false;
    let authInitialized = false;

    /**
     * Inicializa Firebase Auth y el observador de sesión
     */
    function initAuth(onUserChanged) {
        if (typeof firebase === 'undefined' || !firebase.auth) {
            console.warn('[Google Drive] Firebase Auth SDK no encontrado.');
            return;
        }

        if (authInitialized) return;
        authInitialized = true;

        firebase.auth().onAuthStateChanged(async (user) => {
            currentUser = user;
            if (!user) {
                cachedAccessToken = null;
            }
            actualizarUIDrive();
            if (typeof onUserChanged === 'function') {
                onUserChanged(user, cachedAccessToken);
            }
        });
    }

    /**
     * Inicia sesión con Google y solicita los permisos de Google Drive
     */
    async function loginGoogleDrive() {
        if (typeof firebase === 'undefined' || !firebase.auth) {
            alert('El servicio de autenticación de Google aún no está listo.');
            return null;
        }

        try {
            isSigningIn = true;
            const provider = new firebase.auth.GoogleAuthProvider();
            DRIVE_SCOPES.forEach(scope => provider.addScope(scope));

            const result = await firebase.auth().signInWithPopup(provider);
            const credential = result.credential;
            
            if (credential && credential.accessToken) {
                cachedAccessToken = credential.accessToken;
            }

            currentUser = result.user;
            actualizarUIDrive();
            await listarRespaldosDrive();
            return { user: currentUser, accessToken: cachedAccessToken };
        } catch (error) {
            console.error('[Google Drive] Error al autenticar:', error);
            alert('Error al conectar con Google Drive: ' + (error.message || error));
            return null;
        } finally {
            isSigningIn = false;
        }
    }

    /**
     * Cierra la sesión de Google
     */
    async function logoutGoogleDrive() {
        try {
            if (firebase && firebase.auth) {
                await firebase.auth().signOut();
            }
            cachedAccessToken = null;
            currentUser = null;
            actualizarUIDrive();
        } catch (e) {
            console.error('[Google Drive] Error cerrando sesión:', e);
        }
    }

    /**
     * Obtiene el token de acceso en memoria
     */
    async function getAccessToken() {
        if (cachedAccessToken) return cachedAccessToken;
        if (!currentUser) return null;

        try {
            // Intentar re-autenticación silenciosa si es necesario
            const provider = new firebase.auth.GoogleAuthProvider();
            DRIVE_SCOPES.forEach(scope => provider.addScope(scope));
            const result = await currentUser.reauthenticateWithPopup(provider);
            if (result && result.credential && result.credential.accessToken) {
                cachedAccessToken = result.credential.accessToken;
                return cachedAccessToken;
            }
        } catch (e) {
            console.warn('[Google Drive] No se pudo renovar el token:', e);
        }
        return null;
    }

    /**
     * Sube un respaldo JSON a Google Drive
     */
    async function guardarRespaldoEnDrive() {
        const token = await getAccessToken();
        if (!token) {
            alert('Por favor conecta tu cuenta de Google Drive primero.');
            await loginGoogleDrive();
            return false;
        }

        const btn = document.getElementById('btn-drive-backup-now');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo a Google Drive...';
        }

        try {
            const fechaStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const nombreArchivo = `TuBodeguita_Backup_${fechaStr}.json`;

            const datos = {
                productos: AppState.productos,
                clientes: AppState.clientes,
                ventas: AppState.ventas,
                abonos: AppState.abonos,
                transacciones: AppState.transacciones,
                auditorias: AppState.auditorias,
                eliminaciones: AppState.eliminaciones,
                clientesEliminados: AppState.clientesEliminados,
                nextProductSequence: AppState.nextProductSequence,
                fechaRespaldo: new Date().toISOString(),
                version: window.InventoryApp.version || '4.0.0'
            };

            const metadata = {
                name: nombreArchivo,
                mimeType: 'application/json',
                description: 'Respaldo automático del Sistema POS TuBodeguitaDeConfianza'
            };

            const boundary = '-------314159265358979323846';
            const delimiter = "\r\n--" + boundary + "\r\n";
            const closeDelim = "\r\n--" + boundary + "--";

            const multipartRequestBody =
                delimiter +
                'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
                JSON.stringify(metadata) +
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                JSON.stringify(datos, null, 2) +
                closeDelim;

            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': `multipart/related; boundary=${boundary}`
                },
                body: multipartRequestBody
            });

            if (!response.ok) {
                const errJson = await response.json().catch(() => ({}));
                throw new Error(errJson.error?.message || 'Error HTTP ' + response.status);
            }

            const fileData = await response.json();
            alert(`¡Respaldo guardado exitosamente en tu Google Drive!\nArchivo: ${nombreArchivo}`);
            await listarRespaldosDrive();
            return fileData;
        } catch (error) {
            console.error('[Google Drive] Error al subir respaldo:', error);
            alert('Error al guardar en Google Drive: ' + error.message);
            return false;
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fab fa-google-drive"></i> Crear Respaldo en Google Drive';
            }
        }
    }

    /**
     * Lista los respaldos guardados en Google Drive
     */
    async function listarRespaldosDrive() {
        const contenedor = document.getElementById('drive-backups-list');
        if (!contenedor) return;

        const token = await getAccessToken();
        if (!token) {
            contenedor.innerHTML = '<div style="color:var(--text-muted); font-size:0.8rem; padding:10px; text-align:center;">Inicia sesión con Google para ver tus respaldos en la nube.</div>';
            return;
        }

        contenedor.innerHTML = '<div style="color:var(--text-muted); font-size:0.8rem; padding:10px; text-align:center;"><i class="fas fa-spinner fa-spin"></i> Cargando archivos desde Google Drive...</div>';

        try {
            const query = encodeURIComponent("name contains 'TuBodeguita_Backup' and trashed = false");
            const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,createdTime,size,webViewLink)&orderBy=createdTime desc&pageSize=10`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Error al consultar Google Drive');
            }

            const data = await response.json();
            const files = data.files || [];

            if (files.length === 0) {
                contenedor.innerHTML = '<div style="color:var(--text-muted); font-size:0.8rem; padding:10px; text-align:center;">No hay respaldos previos en tu Google Drive. Haz clic en el botón para crear el primero.</div>';
                return;
            }

            let html = '<div style="display:flex; flex-direction:column; gap:8px; max-height:220px; overflow-y:auto;">';
            files.forEach(f => {
                const fecha = new Date(f.createdTime).toLocaleString('es-VE');
                const tamanoKB = f.size ? Math.round(f.size / 1024) + ' KB' : 'N/A';
                html += `
                    <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:6px; padding:8px 12px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="font-weight:600; font-size:0.82rem; color:var(--text-main); display:flex; align-items:center; gap:6px;">
                                <i class="fas fa-file-code" style="color:#0284c7;"></i> ${f.name}
                            </div>
                            <div style="font-size:0.72rem; color:var(--text-muted);">
                                ${fecha} • ${tamanoKB}
                            </div>
                        </div>
                        <div style="display:flex; gap:6px;">
                            <button type="button" class="btn btn-sm btn-success" onclick="InventoryApp.GoogleDrive.restaurarDesdeDrive('${f.id}', '${f.name}')" title="Restaurar base de datos">
                                <i class="fas fa-download"></i> Restaurar
                            </button>
                            <button type="button" class="btn btn-sm btn-danger" onclick="InventoryApp.GoogleDrive.eliminarDeDrive('${f.id}', '${f.name}')" title="Eliminar de Google Drive">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            contenedor.innerHTML = html;
        } catch (error) {
            console.error('[Google Drive] Error listando archivos:', error);
            contenedor.innerHTML = `<div style="color:#ef4444; font-size:0.8rem; padding:10px; text-align:center;">Error al cargar lista: ${error.message}</div>`;
        }
    }

    /**
     * Descarga y restaura la base de datos desde un archivo de Google Drive
     */
    async function restaurarDesdeDrive(fileId, fileName) {
        if (!confirm(`¿Estás seguro de que deseas restaurar la base de datos desde "${fileName}"? Se sobreescribirán los datos locales y se sincronizará con Firestore.`)) {
            return;
        }

        const token = await getAccessToken();
        if (!token) {
            alert('Sesión expirada. Por favor vuelve a conectar Google Drive.');
            return;
        }

        try {
            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Error al descargar archivo de Google Drive');

            const datos = await response.json();
            if (!datos || typeof datos !== 'object') throw new Error('Contenido de archivo no válido');

            // Cargar en AppState
            const claves = ['productos', 'clientes', 'ventas', 'abonos', 'transacciones', 'auditorias', 'eliminaciones', 'clientesEliminados', 'nextProductSequence'];
            claves.forEach(k => {
                if (datos.hasOwnProperty(k)) {
                    AppState[k] = datos[k];
                }
            });

            // Guardar localmente
            if (window.InventoryApp.Persistence) {
                window.InventoryApp.Persistence.guardar(true);
            }

            // Sincronizar hacia Firestore
            if (window.InventoryApp.Firebase) {
                await window.InventoryApp.Firebase.syncToCloud();
            }

            alert('¡Base de datos restaurada exitosamente desde Google Drive!');
            window.location.reload();
        } catch (error) {
            console.error('[Google Drive] Error al restaurar:', error);
            alert('Error al restaurar desde Google Drive: ' + error.message);
        }
    }

    /**
     * Elimina un archivo de Google Drive con confirmación explícita
     */
    async function eliminarDeDrive(fileId, fileName) {
        // MANDATORY: Explicit confirmation dialog before destructive action
        const confirmado = window.confirm(`¿Deseas eliminar permanentemente el respaldo "${fileName}" de tu Google Drive? Esta acción no se puede deshacer.`);
        if (!confirmado) return;

        const token = await getAccessToken();
        if (!token) {
            alert('Por favor autentícate con Google Drive.');
            return;
        }

        try {
            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok && response.status !== 204) {
                throw new Error('Error al eliminar archivo de Google Drive');
            }

            alert(`Respaldo "${fileName}" eliminado de Google Drive.`);
            await listarRespaldosDrive();
        } catch (error) {
            console.error('[Google Drive] Error al eliminar:', error);
            alert('Error al eliminar el archivo: ' + error.message);
        }
    }

    /**
     * Exporta el inventario o ventas como archivo CSV en Google Drive
     */
    async function exportarCSVADrive(tipo = 'productos') {
        const token = await getAccessToken();
        if (!token) {
            alert('Por favor inicia sesión con Google primero.');
            await loginGoogleDrive();
            return;
        }

        let csvContent = '';
        let fileName = '';

        if (tipo === 'productos') {
            fileName = `Inventario_Productos_${new Date().toISOString().slice(0, 10)}.csv`;
            csvContent = "ID,Codigo,Nombre,Costo_USD,Ganancia_USD,Precio_USD,Stock,Descripcion,Contenido\n";
            AppState.productos.forEach(p => {
                csvContent += `"${p.id}","${p.codigo || ''}","${(p.nombre || '').replace(/"/g, '""')}",${p.costo || 0},${p.ganancia || 0},${p.precio || 0},${p.stock || 0},"${(p.descripcion || '').replace(/"/g, '""')}","${p.contenido || ''}"\n`;
            });
        } else if (tipo === 'ventas') {
            fileName = `Reporte_Ventas_${new Date().toISOString().slice(0, 10)}.csv`;
            csvContent = "ID_Venta,Cliente_ID,Fecha,Total_USD,Tipo_Pago,Cantidad_Items\n";
            AppState.ventas.forEach(v => {
                csvContent += `"${v.id}","${v.clienteId || ''}","${v.fecha || ''}",${v.total || 0},"${v.tipo || ''}",${(v.items || []).length}\n`;
            });
        }

        try {
            const metadata = {
                name: fileName,
                mimeType: 'text/csv',
                description: `Exportación de datos de TuBodeguitaDeConfianza (${tipo})`
            };

            const boundary = '-------314159265358979323846';
            const delimiter = "\r\n--" + boundary + "\r\n";
            const closeDelim = "\r\n--" + boundary + "--";

            const multipartRequestBody =
                delimiter +
                'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
                JSON.stringify(metadata) +
                delimiter +
                'Content-Type: text/csv\r\n\r\n' +
                csvContent +
                closeDelim;

            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': `multipart/related; boundary=${boundary}`
                },
                body: multipartRequestBody
            });

            if (!response.ok) throw new Error('Error al guardar CSV en Google Drive');

            alert(`¡Reporte "${fileName}" guardado exitosamente en tu Google Drive!`);
            await listarRespaldosDrive();
        } catch (e) {
            console.error('[Google Drive] Error exportando CSV:', e);
            alert('Error al exportar CSV a Google Drive: ' + e.message);
        }
    }

    /**
     * Actualiza la interfaz visual de conexión con Google Drive
     */
    function actualizarUIDrive() {
        const userContainer = document.getElementById('drive-user-status');
        const loginBtn = document.getElementById('btn-google-drive-login');
        const logoutBtn = document.getElementById('btn-google-drive-logout');
        const backupSection = document.getElementById('drive-actions-section');

        if (currentUser) {
            if (userContainer) {
                userContainer.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px;">
                        <img src="${currentUser.photoURL || 'https://www.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png'}" style="width:28px; height:28px; border-radius:50%; border:1px solid #cbd5e1;" alt="User">
                        <div>
                            <div style="font-weight:600; font-size:0.82rem; color:var(--text-main);">${currentUser.displayName || currentUser.email}</div>
                            <div style="font-size:0.7rem; color:#16a34a;"><i class="fas fa-check-circle"></i> Conectado a Google Drive</div>
                        </div>
                    </div>
                `;
            }
            if (loginBtn) loginBtn.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'inline-flex';
            if (backupSection) backupSection.style.display = 'block';
        } else {
            if (userContainer) {
                userContainer.innerHTML = `
                    <div style="font-size:0.8rem; color:var(--text-muted);">
                        <i class="fab fa-google-drive" style="color:#0284c7;"></i> Conecta tu cuenta de Google para respaldar y restaurar directamente.
                    </div>
                `;
            }
            if (loginBtn) loginBtn.style.display = 'inline-flex';
            if (logoutBtn) logoutBtn.style.display = 'none';
            if (backupSection) backupSection.style.display = 'none';
        }
    }

    // Exportar módulo
    window.InventoryApp.GoogleDrive = {
        init: initAuth,
        login: loginGoogleDrive,
        logout: logoutGoogleDrive,
        guardarRespaldo: guardarRespaldoEnDrive,
        listarRespaldos: listarRespaldosDrive,
        restaurarDesdeDrive,
        eliminarDeDrive,
        exportarCSVADrive,
        actualizarUI: actualizarUIDrive,
        getAccessToken
    };
})();
