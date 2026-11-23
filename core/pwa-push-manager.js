/**
 * core/pwa-push-manager.js
 * Gestión integral de PWA Instalable + Notificaciones Push Reales (Web Push VAPID) + Indicador Offline.
 */
(function () {
    'use strict';

    window.InventoryApp = window.InventoryApp || {};

    let deferredInstallPrompt = null;
    let swRegistration = null;
    let currentSubscription = null;
    let localOsNotificationsEnabled = localStorage.getItem('bodeguita_local_os_notif') === '1';
    let lastPushErrorHint = '';
    let isInstalled = false;
    let isIOS = false;
    let isStandalone = false;
    let recentPushDispatchKeys = new Map();

    function detectarEntorno() {
        const ua = (window.navigator.userAgent || '').toLowerCase();
        isIOS = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        isStandalone =
            (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
            window.navigator.standalone === true ||
            document.referrer.startsWith('android-app://');
        isInstalled = isStandalone;
    }

    function soportaPush() {
        return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    }

    function obtenerDatosUsuarioActual() {
        const u = window.AppState && window.AppState.usuarioActual ? window.AppState.usuarioActual : null;
        if (!u) return { role: 'cliente', userId: '', cedula: '', nombre: '' };
        const rolRaw = String(u.rol || '').trim().toLowerCase();
        const esAdmin =
            rolRaw === 'admin' ||
            rolRaw === 'superadmin' ||
            String(u.id || '').toLowerCase() === 'superadmin' ||
            String(u.cedula || '').toLowerCase() === 'superadmin';
        return {
            role: esAdmin ? 'admin' : 'cliente',
            userId: String(u.id || u.cedula || '').trim(),
            cedula: String(u.cedula || u.id || '').trim(),
            nombre: String(u.nombre || '').trim()
        };
    }

    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    function mostrarToast(msg, tipo = 'info') {
        if (window.InventoryApp && window.InventoryApp.Modal && typeof window.InventoryApp.Modal.toast === 'function') {
            window.InventoryApp.Modal.toast(msg, tipo);
        } else {
            console.log(`[PWA/${tipo}]`, msg);
        }
    }

    /**
     * Registra el Service Worker y sincroniza estado inicial de suscripción Push
     */
    async function registrarServiceWorker() {
        if (!('serviceWorker' in navigator)) return null;
        try {
            const reg = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
            swRegistration = reg;

            // Escuchar mensajes de navegación enviados al tocar una notificación Push
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'PWA_PUSH_NAVIGATE' && event.data.tab) {
                    navegarDesdePush(event.data.tab);
                }
            });

            if (reg.pushManager) {
                currentSubscription = await reg.pushManager.getSubscription();
                if (currentSubscription) {
                    sincronizarSuscripcionUsuario().catch(() => {});
                }
            }
            actualizarUIPWAPush();
            return reg;
        } catch (err) {
            console.warn('[PWA] No se pudo registrar el Service Worker:', err.message);
            return null;
        }
    }

    function navegarDesdePush(tab) {
        if (!tab) return;
        const intentarNavegar = () => {
            if (typeof window.switchTab === 'function') {
                const u = obtenerDatosUsuarioActual();
                const destino = u.role === 'cliente' && tab === 'transacciones' ? 'cliente-cuenta' : tab;
                window.switchTab(destino);
            }
        };
        if (window.AppState && window.AppState.usuarioActual) {
            intentarNavegar();
        } else {
            setTimeout(intentarNavegar, 1200);
        }
    }

    /**
     * Lanza el diálogo nativo de instalación PWA (Chromium/Android/Desktop) o abre guía en iOS Safari
     */
    async function instalarApp() {
        if (isInstalled) {
            mostrarToast('La app ya está instalada en este dispositivo.', 'info');
            return false;
        }
        if (deferredInstallPrompt) {
            try {
                await deferredInstallPrompt.prompt();
                const choice = await deferredInstallPrompt.userChoice;
                if (choice && choice.outcome === 'accepted') {
                    isInstalled = true;
                    deferredInstallPrompt = null;
                    actualizarUIPWAPush();
                    mostrarToast('¡Tu Bodeguita se instaló en tu pantalla de inicio!', 'success');
                    return true;
                }
                return false;
            } catch (err) {
                console.warn('[PWA] Error en prompt de instalación:', err);
                return false;
            }
        }
        if (isIOS) {
            abrirGuiaIOS();
            return false;
        }
        abrirModalPWAPush();
        return false;
    }

    /**
     * Activa y registra las Notificaciones Push Reales para el usuario actual
     */
    async function activarPush() {
        if (isIOS && !isStandalone) {
            abrirGuiaIOS(true);
            return false;
        }

        if (!soportaPush()) {
            mostrarToast('Este navegador no soporta Notificaciones Push. Usa Chrome, Edge o Safari (agregando la app al inicio).', 'warning');
            return false;
        }

        try {
            const permiso = await Notification.requestPermission();
            if (permiso !== 'granted') {
                actualizarUIPWAPush();
                mostrarToast(
                    permiso === 'denied'
                        ? 'Las notificaciones están bloqueadas en tu navegador. Habilítalas en el ícono de candado junto a la URL.'
                        : 'Permiso de notificaciones cancelado.',
                    'warning'
                );
                return false;
            }

            // Esperar SIEMPRE a que el Service Worker esté completamente activo (ready)
            if (!swRegistration) {
                await registrarServiceWorker();
            }
            const readyReg = await navigator.serviceWorker.ready;
            swRegistration = readyReg;

            const keyRes = await fetch('/api/push/public-key', { cache: 'no-store' });
            const keyData = await keyRes.json();
            if (!keyData || !keyData.success || !keyData.publicKey) {
                throw new Error(keyData?.error || 'No se pudo obtener la clave pública VAPID del servidor.');
            }

            const appServerKey = urlBase64ToUint8Array(keyData.publicKey.trim());
            if (appServerKey.length !== 65 || appServerKey[0] !== 0x04) {
                throw new Error('Clave VAPID del servidor inválida. Recarga la app o verifica las variables de entorno.');
            }

            let sub = await readyReg.pushManager.getSubscription();
            // Si había una suscripción vieja con otra clave VAPID, limpiarla primero
            if (sub && sub.options && sub.options.applicationServerKey) {
                const existingKey = new Uint8Array(sub.options.applicationServerKey);
                const sameKey = existingKey.length === appServerKey.length && existingKey.every((v, i) => v === appServerKey[i]);
                if (!sameKey) {
                    await sub.unsubscribe().catch(() => {});
                    sub = null;
                }
            }

            if (!sub) {
                try {
                    sub = await readyReg.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: appServerKey
                    });
                } catch (firstSubErr) {
                    // Reintento único tras 450ms (resuelve fallos transitorios recién instalada la PWA)
                    await new Promise((r) => setTimeout(r, 450));
                    sub = await readyReg.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: appServerKey
                    });
                }
            }

            currentSubscription = sub;
            localOsNotificationsEnabled = false;
            lastPushErrorHint = '';
            try { localStorage.removeItem('bodeguita_local_os_notif'); } catch {}
            await enviarSuscripcionAlServidor(sub);
            actualizarUIPWAPush();
            mostrarToast('¡Notificaciones Push activadas! Recibirás alertas incluso con el teléfono bloqueado.', 'success');
            return true;
        } catch (err) {
            console.error('[PWA Push] Error activando push:', err);
            const rawMsg = String(err && err.message ? err.message : err);
            const esErrorServicioPush = /push service error|Registration failed|AbortError/i.test(rawMsg);

            if (esErrorServicioPush && 'Notification' in window && Notification.permission === 'granted') {
                // El permiso del navegador SÍ fue concedido, pero el navegador/red bloquea Google FCM (ej. Brave, modo incógnito, DNS/VPN o sin Google Play Services).
                localOsNotificationsEnabled = true;
                try { localStorage.setItem('bodeguita_local_os_notif', '1'); } catch {}
                lastPushErrorHint =
                    'Tu navegador bloqueó el servicio Push en la nube (muy común en Brave, modo incógnito o VPN). ' +
                    'Activamos alertas del sistema mientras la app esté abierta. Para recibirlas también con la app cerrada: ' +
                    'en Brave activa "Usar servicios de Google para mensajes push" en Configuración → Privacidad, o instala desde Google Chrome.';
                actualizarUIPWAPush();
                mostrarToast(
                    'Alertas del sistema activadas. Nota: tu navegador bloqueó Push en segundo plano (si usas Brave, habilita "Servicios de Google para mensajes push" en Privacidad).',
                    'warning'
                );
                return true;
            }

            lastPushErrorHint = rawMsg;
            mostrarToast(`No se pudieron activar las alertas Push: ${rawMsg}`, 'danger');
            actualizarUIPWAPush();
            return false;
        }
    }

    async function enviarSuscripcionAlServidor(sub) {
        if (!sub) return;
        const userMeta = obtenerDatosUsuarioActual();
        const res = await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subscription: sub.toJSON ? sub.toJSON() : sub,
                role: userMeta.role,
                userId: userMeta.userId,
                cedula: userMeta.cedula,
                nombre: userMeta.nombre
            })
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`Error registrando suscripción (${res.status}): ${txt}`);
        }
    }

    /**
     * Actualiza la asociación de rol/usuario cuando cambia la sesión (Admin <-> Cliente)
     */
    async function sincronizarSuscripcionUsuario() {
        try {
            if (!soportaPush()) return;
            if (!swRegistration) {
                const reg = await navigator.serviceWorker.getRegistration('/');
                if (reg) swRegistration = reg;
            }
            if (!swRegistration || !swRegistration.pushManager) return;
            const sub = await swRegistration.pushManager.getSubscription();
            currentSubscription = sub;
            if (sub && window.AppState && window.AppState.usuarioActual) {
                await enviarSuscripcionAlServidor(sub);
            }
            actualizarUIPWAPush();
        } catch (err) {
            console.warn('[PWA Push] Aviso sincronizando suscripción de usuario:', err.message);
        }
    }

    /**
     * Desactiva las Notificaciones Push en este dispositivo
     */
    async function desactivarPush() {
        try {
            if (swRegistration && swRegistration.pushManager) {
                const sub = await swRegistration.pushManager.getSubscription();
                if (sub) {
                    const endpoint = sub.endpoint;
                    await sub.unsubscribe();
                    await fetch('/api/push/unsubscribe', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ endpoint })
                    }).catch(() => {});
                }
            }
            currentSubscription = null;
            localOsNotificationsEnabled = false;
            lastPushErrorHint = '';
            try { localStorage.removeItem('bodeguita_local_os_notif'); } catch {}
            actualizarUIPWAPush();
            mostrarToast('Notificaciones Push desactivadas en este dispositivo.', 'info');
            return true;
        } catch (err) {
            console.warn('[PWA Push] Error desactivando push:', err);
            return false;
        }
    }

    /**
     * Muestra una notificación nativa del sistema vía Service Worker (fallback cuando FCM está bloqueado)
     */
    async function mostrarNotificacionLocalSistema(title, body, tab = 'notificaciones') {
        if (!('Notification' in window) || Notification.permission !== 'granted') return false;
        try {
            const reg = swRegistration || (await navigator.serviceWorker.ready);
            if (reg && typeof reg.showNotification === 'function') {
                await reg.showNotification(title || 'Tu Bodeguita de Confianza', {
                    body: body || 'Tienes una nueva notificación.',
                    icon: '/icons/bodeguita-chuches-192.png',
                    badge: '/icons/bodeguita-chuches-192.png',
                    vibrate: [180, 90, 180],
                    tag: 'bodeguita-local-' + Date.now(),
                    data: { tab, url: `/?tab=${encodeURIComponent(tab)}` }
                });
                return true;
            }
            new Notification(title || 'Tu Bodeguita de Confianza', {
                body: body || 'Tienes una nueva notificación.',
                icon: '/icons/bodeguita-chuches-192.png'
            });
            return true;
        } catch (err) {
            console.warn('[PWA Push] Aviso en notificación local:', err);
            return false;
        }
    }

    /**
     * Envía una notificación Push de prueba real a este dispositivo
     */
    async function enviarPruebaPush() {
        try {
            if (!currentSubscription && !localOsNotificationsEnabled) {
                const ok = await activarPush();
                if (!ok) return false;
            }
            if (!currentSubscription && localOsNotificationsEnabled) {
                const okLocal = await mostrarNotificacionLocalSistema(
                    'Tu Bodeguita de Confianza',
                    '¡Alertas del sistema activas! (Modo local: tu navegador bloqueó el servicio Push en la nube).'
                );
                if (okLocal) {
                    mostrarToast('Notificación de prueba enviada a tu dispositivo.', 'success');
                    return true;
                }
                throw new Error('No se pudo mostrar la notificación del sistema.');
            }
            const res = await fetch('/api/push/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    test: true,
                    endpoint: currentSubscription.endpoint,
                    title: 'Tu Bodeguita de Confianza',
                    body: '¡Notificaciones Push activas! Te avisaremos aquí sobre pagos y pedidos.',
                    tab: 'notificaciones',
                    tag: 'bodeguita-test-' + Date.now()
                })
            });
            const data = await res.json();
            if (data.success && data.sent > 0) {
                mostrarToast('Notificación de prueba enviada. Revisa la barra de tu dispositivo.', 'success');
                return true;
            }
            throw new Error(data.error || 'No se confirmó entrega al servicio push del navegador.');
        } catch (err) {
            mostrarToast(`Error enviando prueba Push: ${err.message}`, 'danger');
            return false;
        }
    }

    /**
     * Despacha una notificación Push real desde eventos de negocio (pagos, autopago, avisos)
     */
    function despacharPushEvento(opciones) {
        if (!opciones || !opciones.body) return;
        const now = Date.now();
        const dedupeKey = `${opciones.targetRole || 'admin'}|${opciones.targetUserId || ''}|${opciones.title || ''}|${String(opciones.body || '').slice(0, 60)}`;
        const lastSent = recentPushDispatchKeys.get(dedupeKey);
        if (lastSent && now - lastSent < 10000) {
            return;
        }
        recentPushDispatchKeys.set(dedupeKey, now);
        if (recentPushDispatchKeys.size > 40) {
            const oldestKey = recentPushDispatchKeys.keys().next().value;
            recentPushDispatchKeys.delete(oldestKey);
        }

        fetch('/api/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            keepalive: true,
            body: JSON.stringify({
                title: opciones.title || 'Tu Bodeguita de Confianza',
                body: opciones.body,
                tab: opciones.tab || 'notificaciones',
                tag: opciones.tag || 'bodeguita-event',
                requireInteraction: Boolean(opciones.requireInteraction),
                targetRole: opciones.targetRole || 'admin',
                targetUserId: opciones.targetUserId || '',
                targetNombre: opciones.targetNombre || '',
                broadcast: Boolean(opciones.broadcast)
            })
        }).catch(() => {});
    }

    /**
     * Modal guiado para instalación en iPhone / iPad (iOS Safari)
     */
    function abrirGuiaIOS(conAvisoPush = false) {
        let modal = document.getElementById('modal-pwa-ios-guide');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-pwa-ios-guide';
            modal.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(15,23,42,0.72); z-index:100002; align-items:center; justify-content:center; padding:16px; backdrop-filter:blur(4px);';
            modal.innerHTML = `
                <div style="width:100%; max-width:400px; background:var(--card-bg, #ffffff); color:var(--text-main, #0f172a); border-radius:16px; padding:22px; box-shadow:0 24px 48px rgba(0,0,0,0.35); border:1px solid var(--border, #e2e8f0);">
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:12px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <img src="/icons/bodeguita-chuches-180.png" alt="Bodeguita" style="width:42px; height:42px; border-radius:10px;">
                            <div>
                                <h3 style="margin:0; font-size:1.05rem; font-weight:800;">Instalar en iPhone / iPad</h3>
                                <div style="font-size:0.78rem; color:var(--text-muted, #64748b);">Tu Bodeguita de Confianza</div>
                            </div>
                        </div>
                        <button type="button" onclick="window.InventoryApp.PWAPush.cerrarGuiaIOS()" style="background:transparent; border:1px solid var(--border, #cbd5e1); width:32px; height:32px; border-radius:50%; cursor:pointer; color:var(--text-main, #0f172a);">
                            <i class="fas fa-xmark"></i>
                        </button>
                    </div>
                    <div id="pwa-ios-push-note" style="display:none; background:#e0f2fe; color:#0369a1; border:1px solid #7dd3fc; border-radius:10px; padding:10px 12px; font-size:0.82rem; margin-bottom:12px;">
                        En iPhone, primero debes agregar la app a tu pantalla de inicio y abrirla desde ahí para activar Notificaciones Push.
                    </div>
                    <ol style="margin:0 0 16px; padding-left:20px; font-size:0.9rem; line-height:1.6;">
                        <li>Toca el botón <strong>Compartir</strong> (<i class="fas fa-arrow-up-from-bracket" style="color:#0284c7;"></i>) en la barra inferior de Safari.</li>
                        <li>Desliza hacia abajo y elige <strong>Agregar a pantalla de inicio</strong>.</li>
                        <li>Pulsa <strong>Agregar</strong> y abre <strong>Bodeguita</strong> desde tu inicio.</li>
                    </ol>
                    <button type="button" onclick="window.InventoryApp.PWAPush.cerrarGuiaIOS()" style="width:100%; padding:11px; border:none; border-radius:10px; background:#0284c7; color:#ffffff; font-weight:700; cursor:pointer;">
                        Entendido
                    </button>
                </div>
            `;
            modal.addEventListener('click', (e) => {
                if (e.target === modal) cerrarGuiaIOS();
            });
            document.body.appendChild(modal);
        }
        const note = document.getElementById('pwa-ios-push-note');
        if (note) note.style.display = conAvisoPush ? 'block' : 'none';
        modal.style.display = 'flex';
    }

    function cerrarGuiaIOS() {
        const modal = document.getElementById('modal-pwa-ios-guide');
        if (modal) modal.style.display = 'none';
    }

    /**
     * Modal unificado de PWA Instalable y Notificaciones Push
     */
    function abrirModalPWAPush() {
        let modal = document.getElementById('modal-pwa-push-panel');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-pwa-push-panel';
            modal.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(15,23,42,0.72); z-index:100001; align-items:center; justify-content:center; padding:16px; backdrop-filter:blur(4px);';
            modal.innerHTML = `
                <div style="width:100%; max-width:460px; background:var(--card-bg, #ffffff); color:var(--text-main, #0f172a); border-radius:16px; overflow:hidden; box-shadow:0 24px 48px rgba(0,0,0,0.35); border:1px solid var(--border, #e2e8f0);">
                    <div style="padding:16px 20px; background:linear-gradient(135deg, #0f172a, #0369a1); color:#ffffff; display:flex; align-items:center; justify-content:space-between; gap:12px;">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <img src="/icons/bodeguita-chuches-192.png" alt="Tu Bodeguita" style="width:40px; height:40px; border-radius:10px; box-shadow:0 4px 10px rgba(0,0,0,0.3);">
                            <div>
                                <h3 style="margin:0; font-size:1.05rem; font-weight:800; color:#ffffff;">App Instalable &amp; Alertas Push</h3>
                                <div style="font-size:0.78rem; color:#bae6fd;">Tu Bodeguita de Confianza</div>
                            </div>
                        </div>
                        <button type="button" onclick="window.InventoryApp.PWAPush.cerrarModal()" style="background:rgba(255,255,255,0.14); border:none; color:#ffffff; width:32px; height:32px; border-radius:50%; cursor:pointer;">
                            <i class="fas fa-xmark"></i>
                        </button>
                    </div>
                    <div id="pwa-push-modal-body" style="padding:18px 20px; display:flex; flex-direction:column; gap:14px;"></div>
                </div>
            `;
            modal.addEventListener('click', (e) => {
                if (e.target === modal) cerrarModalPWAPush();
            });
            document.body.appendChild(modal);
        }
        renderizarContenidoModalPWAPush();
        modal.style.display = 'flex';
    }

    function cerrarModalPWAPush() {
        const modal = document.getElementById('modal-pwa-push-panel');
        if (modal) modal.style.display = 'none';
    }

    function renderizarContenidoModalPWAPush() {
        const body = document.getElementById('pwa-push-modal-body');
        if (!body) return;

        const user = obtenerDatosUsuarioActual();
        const pushSupported = soportaPush();
        const permission = pushSupported ? Notification.permission : 'unsupported';
        const isSubscribed = Boolean(currentSubscription && permission === 'granted');
        const isLocalFallback = Boolean(!isSubscribed && localOsNotificationsEnabled && permission === 'granted');

        const installSection = isInstalled
            ? `<div style="display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:12px; background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.35); color:#047857; font-size:0.86rem; font-weight:700;">
                   <i class="fas fa-circle-check" style="font-size:1.1rem;"></i>
                   <span>App instalada y ejecutándose en modo independiente.</span>
               </div>`
            : deferredInstallPrompt
                ? `<div style="padding:14px; border-radius:12px; background:var(--bg-color, #f8fafc); border:1px solid var(--border, #e2e8f0);">
                       <div style="font-weight:800; font-size:0.92rem; margin-bottom:4px;"><i class="fas fa-mobile-screen-button" style="color:#0284c7; margin-right:6px;"></i>Instalar en tu dispositivo</div>
                       <div style="font-size:0.82rem; color:var(--text-muted, #64748b); margin-bottom:10px;">Abre Tu Bodeguita directo desde tu pantalla de inicio, pantalla completa y carga instantánea.</div>
                       <button type="button" onclick="window.InventoryApp.PWAPush.instalarApp()" style="width:100%; padding:10px 14px; border:none; border-radius:10px; background:#0284c7; color:#ffffff; font-weight:700; font-size:0.88rem; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;">
                           <i class="fas fa-download"></i> Instalar App ahora
                       </button>
                   </div>`
                : isIOS
                    ? `<div style="padding:14px; border-radius:12px; background:var(--bg-color, #f8fafc); border:1px solid var(--border, #e2e8f0);">
                           <div style="font-weight:800; font-size:0.92rem; margin-bottom:4px;"><i class="fab fa-apple" style="color:#0284c7; margin-right:6px;"></i>Instalar en iPhone / iPad</div>
                           <div style="font-size:0.82rem; color:var(--text-muted, #64748b); margin-bottom:10px;">Agrégala a tu pantalla de inicio en 2 pasos desde Safari.</div>
                           <button type="button" onclick="window.InventoryApp.PWAPush.abrirGuiaIOS(false)" style="width:100%; padding:10px 14px; border:none; border-radius:10px; background:#0284c7; color:#ffffff; font-weight:700; font-size:0.88rem; cursor:pointer;">
                               Ver pasos para iPhone
                           </button>
                       </div>`
                    : `<div style="padding:12px 14px; border-radius:12px; background:var(--bg-color, #f8fafc); border:1px solid var(--border, #e2e8f0); font-size:0.82rem; color:var(--text-muted, #64748b);">
                           <strong style="color:var(--text-main, #0f172a); display:block; margin-bottom:4px;"><i class="fas fa-mobile-screen" style="color:#0284c7; margin-right:6px;"></i>Instalación PWA</strong>
                           Abre tu dominio en Chrome o Edge y usa el botón <strong>Instalar</strong> en la barra del navegador o menú (⋮ → <em>Instalar aplicación</em>).
                       </div>`;

        const roleCopy = user.role === 'admin'
            ? 'Recibirás alertas push inmediatas cuando un cliente reporte un Pago Móvil, complete un Autopago o envíe un comentario.'
            : 'Recibirás alertas push cuando la tienda apruebe tus pagos o te envíe avisos importantes.';

        let pushActionsHtml = '';
        if (isSubscribed) {
            pushActionsHtml = `
                <div style="display:flex; align-items:center; gap:8px; color:#059669; font-weight:700; font-size:0.85rem; margin-bottom:10px;">
                    <i class="fas fa-bell"></i> Alertas Push activas en este dispositivo (${user.role === 'admin' ? 'Modo Admin' : 'Modo Cliente'})
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button type="button" onclick="window.InventoryApp.PWAPush.enviarPruebaPush()" style="flex:1; padding:9px 12px; border:none; border-radius:9px; background:#0284c7; color:#ffffff; font-weight:700; font-size:0.84rem; cursor:pointer;">
                        <i class="fas fa-paper-plane"></i> Enviar prueba
                    </button>
                    <button type="button" onclick="window.InventoryApp.PWAPush.desactivarPush()" style="padding:9px 12px; border:1px solid #ef4444; border-radius:9px; background:transparent; color:#ef4444; font-weight:700; font-size:0.84rem; cursor:pointer;">
                        Desactivar
                    </button>
                </div>
            `;
        } else if (isLocalFallback) {
            pushActionsHtml = `
                <div style="padding:10px 12px; border-radius:10px; background:rgba(245,158,11,0.14); border:1px solid rgba(245,158,11,0.4); color:#b45309; font-size:0.8rem; line-height:1.45; margin-bottom:10px;">
                    <strong><i class="fas fa-circle-info"></i> Modo Alertas Locales activo:</strong> ${lastPushErrorHint || 'Tu navegador bloqueó el servicio Push en la nube (común en Brave, incógnito o VPN). Activa "Servicios de Google para mensajes push" en Brave o usa Google Chrome para recibir alertas con la app cerrada.'}
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button type="button" onclick="window.InventoryApp.PWAPush.enviarPruebaPush()" style="flex:1; padding:9px 12px; border:none; border-radius:9px; background:#0284c7; color:#ffffff; font-weight:700; font-size:0.84rem; cursor:pointer;">
                        <i class="fas fa-paper-plane"></i> Probar alerta
                    </button>
                    <button type="button" onclick="window.InventoryApp.PWAPush.activarPush()" style="padding:9px 12px; border:1px solid #10b981; border-radius:9px; background:transparent; color:#059669; font-weight:700; font-size:0.84rem; cursor:pointer;">
                        Reintentar Push
                    </button>
                </div>
            `;
        } else if (permission === 'denied') {
            pushActionsHtml = `
                <div style="color:#dc2626; font-size:0.83rem; font-weight:600; line-height:1.45;">
                    <i class="fas fa-bell-slash"></i> Las notificaciones están bloqueadas por el navegador. Toca el ícono de ajustes/candado junto a la dirección web y permite <strong>Notificaciones</strong>.
                </div>
            `;
        } else {
            pushActionsHtml = `
                <button type="button" onclick="window.InventoryApp.PWAPush.activarPush()" style="width:100%; padding:11px 14px; border:none; border-radius:10px; background:#10b981; color:#ffffff; font-weight:800; font-size:0.9rem; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;">
                    <i class="fas fa-bell"></i> Activar Notificaciones Push
                </button>
            `;
        }

        body.innerHTML = `
            ${installSection}
            <div style="padding:14px; border-radius:12px; background:var(--bg-color, #f8fafc); border:1px solid var(--border, #e2e8f0);">
                <div style="font-weight:800; font-size:0.92rem; margin-bottom:4px;">
                    <i class="fas fa-bolt" style="color:#f59e0b; margin-right:6px;"></i>Notificaciones Push (pantalla apagada)
                </div>
                <div style="font-size:0.82rem; color:var(--text-muted, #64748b); line-height:1.45; margin-bottom:12px;">
                    ${roleCopy}
                </div>
                ${pushActionsHtml}
            </div>
        `;
    }

    /**
     * Actualiza todos los botones/indicadores de instalación y push en la interfaz
     */
    function actualizarUIPWAPush() {
        const pushActivo = Boolean((currentSubscription || localOsNotificationsEnabled) && soportaPush() && Notification.permission === 'granted');

        // Botón "Instalar App" en la cabecera y login (oculto si ya está instalada en standalone)
        const installBtns = document.querySelectorAll('.js-pwa-install-btn');
        installBtns.forEach((btn) => {
            if (isInstalled) {
                btn.style.display = 'none';
            } else if (deferredInstallPrompt || isIOS) {
                btn.style.display = 'inline-flex';
                const lbl = btn.querySelector('.js-pwa-install-label');
                if (lbl) lbl.textContent = isIOS ? 'Instalar iOS' : 'Instalar App';
            } else {
                btn.style.display = 'none';
            }
        });

        // Indicador del botón Push en la cabecera
        const pushBtn = document.getElementById('btn-pwa-push-header');
        if (pushBtn) {
            pushBtn.title = pushActivo
                ? 'Notificaciones Push activas (clic para gestionar o probar)'
                : 'Instalar App y activar Notificaciones Push';
            pushBtn.style.color = pushActivo ? '#10b981' : '#38bdf8';
            const dot = pushBtn.querySelector('.pwa-push-active-dot');
            if (dot) dot.style.display = pushActivo ? 'block' : 'none';
        }

        // Si el modal está abierto, re-renderizar su contenido al instante
        const modal = document.getElementById('modal-pwa-push-panel');
        if (modal && modal.style.display === 'flex') {
            renderizarContenidoModalPWAPush();
        }

        // Actualizar tarjetas incrustadas en Configuración / Notificaciones si existen
        const statusTexts = document.querySelectorAll('.js-pwa-push-status-text');
        statusTexts.forEach((el) => {
            el.textContent = pushActivo ? 'Activas en este dispositivo' : 'Desactivadas';
            el.style.color = pushActivo ? '#10b981' : '#f59e0b';
        });
    }

    /**
     * Indicador no intrusivo de estado sin conexión (Offline Indicator)
     */
    function asegurarBannerOffline() {
        let banner = document.getElementById('pwa-offline-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'pwa-offline-banner';
            banner.style.cssText =
                'display:none; position:fixed; bottom:16px; left:16px; z-index:99998; align-items:center; gap:8px; background:#d97706; color:#ffffff; padding:8px 14px; border-radius:10px; font-size:0.8rem; font-weight:700; box-shadow:0 10px 24px rgba(0,0,0,0.28); max-width:calc(100vw - 32px);';
            banner.innerHTML =
                '<span style="width:8px; height:8px; border-radius:50%; background:#ffffff; display:inline-block;"></span><span>Sin conexión — Mostrando datos en caché</span>';
            document.body.appendChild(banner);
        }
        banner.style.display = navigator.onLine ? 'none' : 'inline-flex';
    }

    function init() {
        detectarEntorno();

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredInstallPrompt = e;
            actualizarUIPWAPush();
        });

        window.addEventListener('appinstalled', () => {
            isInstalled = true;
            deferredInstallPrompt = null;
            actualizarUIPWAPush();
            mostrarToast('¡Tu Bodeguita de Confianza ha sido instalada!', 'success');
        });

        window.addEventListener('online', () => {
            asegurarBannerOffline();
            mostrarToast('Conexión a internet restaurada.', 'success');
        });

        window.addEventListener('offline', () => {
            asegurarBannerOffline();
        });

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                asegurarBannerOffline();
                registrarServiceWorker();
                actualizarUIPWAPush();
                manejarQueryTabInicial();
            });
        } else {
            asegurarBannerOffline();
            registrarServiceWorker();
            actualizarUIPWAPush();
            manejarQueryTabInicial();
        }
    }

    function manejarQueryTabInicial() {
        try {
            const params = new URLSearchParams(window.location.search);
            const tab = params.get('tab');
            if (tab) {
                setTimeout(() => navegarDesdePush(tab), 1400);
            }
        } catch {}
    }

    window.InventoryApp.PWAPush = {
        init,
        instalarApp,
        activarPush,
        desactivarPush,
        enviarPruebaPush,
        sincronizarSuscripcionUsuario,
        despacharPushEvento,
        mostrarNotificacionLocalSistema,
        abrirModal: abrirModalPWAPush,
        cerrarModal: cerrarModalPWAPush,
        abrirGuiaIOS,
        cerrarGuiaIOS,
        actualizarUI: actualizarUIPWAPush,
        estaInstalada: () => isInstalled,
        tienePushActivo: () => Boolean((currentSubscription || localOsNotificationsEnabled) && soportaPush() && Notification.permission === 'granted')
    };

    init();
})();
