/**
 * modules/escaner-barras.js
 * Escáner de Código de Barras con Cámara para Tu Bodeguita de Confianza
 * Soporta POS (venta directa al carrito), Inventario (búsqueda y asignación de EAN/UPC),
 * Facturas de Compra (ingreso de mercancía) y Auditoría Física (conteo rápido +1).
 *
 * Motor dual:
 *  1) BarcodeDetector nativo (Chrome Android / Edge / Android WebView - latencia mínima y offline)
 *  2) Fallback automático ZXing (iOS Safari / Firefox / navegadores sin BarcodeDetector)
 *  3) Respaldo desde foto y entrada manual/lector USB
 */
(function () {
    'use strict';

    window.InventoryApp = window.InventoryApp || {};

    const FORMATOS_NATIVOS = [
        'ean_13', 'ean_8', 'upc_a', 'upc_e',
        'code_128', 'code_39', 'code_93',
        'itf', 'codabar', 'qr_code'
    ];

    const state = {
        abierto: false,
        modo: 'pos', // 'pos' | 'inventario' | 'producto_form' | 'factura' | 'auditoria'
        continuo: false,
        sonidoActivo: true,
        linternaActiva: false,
        stream: null,
        videoTrack: null,
        cameras: [],
        cameraIndex: 0,
        detectorNativo: null,
        zxingReader: null,
        scanTimer: null,
        procesandoFrame: false,
        ultimoCodigo: '',
        ultimoCodigoTs: 0,
        escaneosSesion: 0,
        callbackCustom: null
    };

    function escaparHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function normalizarCodigo(val) {
        return String(val || '').trim().replace(/\s+/g, '');
    }

    function notificar(mensaje, tipo = 'info') {
        if (window.InventoryApp?.Modal?.toast) {
            window.InventoryApp.Modal.toast(mensaje, tipo);
        } else if (typeof window.mostrarNotificacionToast === 'function') {
            window.mostrarNotificacionToast(mensaje, tipo);
        } else {
            console.log(`[Escáner] ${mensaje}`);
        }
    }

    /**
     * Sonido tipo caja registradora (Web Audio API, sin archivos externos)
     */
    function reproducirBeep(exito = true) {
        if (!state.sonidoActivo) return;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = exito ? 'sine' : 'triangle';
            osc.frequency.setValueAtTime(exito ? 1180 : 320, ctx.currentTime);
            gain.gain.setValueAtTime(0.14, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (exito ? 0.13 : 0.22));
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + (exito ? 0.14 : 0.24));
            setTimeout(() => ctx.close().catch(() => {}), 320);
        } catch (_e) {}
        try {
            if (navigator.vibrate) navigator.vibrate(exito ? 55 : [70, 40, 70]);
        } catch (_e) {}
    }

    /**
     * Busca un producto en el inventario por código de barras (EAN/UPC), código interno o ID
     */
    function buscarProductoPorCodigoDeBarras(codigoRaw) {
        const clean = normalizarCodigo(codigoRaw);
        if (!clean) return null;
        const cleanUp = clean.toUpperCase();
        const lista = Array.isArray(window.AppState?.productos)
            ? window.AppState.productos
            : (typeof productos !== 'undefined' && Array.isArray(productos) ? productos : []);

        // 1. Coincidencia exacta por codigoBarras / barcode / ean
        let match = lista.find(p => {
            if (!p) return false;
            const cb = normalizarCodigo(p.codigoBarras || p.barcode || p.ean || '').toUpperCase();
            return Boolean(cb && cb === cleanUp);
        });
        if (match) return match;

        // 2. Coincidencia exacta por código interno (PROD-001) o ID
        match = lista.find(p => {
            if (!p) return false;
            const cod = normalizarCodigo(p.codigo || '').toUpperCase();
            const id = normalizarCodigo(p.id || '').toUpperCase();
            return (cod && cod === cleanUp) || (id && id === cleanUp);
        });
        if (match) return match;

        // 3. Coincidencia sin ceros a la izquierda para EAN-13 vs UPC-A (12 vs 13 dígitos)
        const digits = clean.replace(/\D/g, '');
        if (digits.length >= 6) {
            const sinCeros = digits.replace(/^0+/, '');
            match = lista.find(p => {
                if (!p) return false;
                const cbDigits = String(p.codigoBarras || p.barcode || p.ean || '').replace(/\D/g, '');
                if (!cbDigits) return false;
                return cbDigits === digits || cbDigits.replace(/^0+/, '') === sinCeros;
            });
            if (match) return match;
        }

        // 4. Búsqueda flexible de códigos internos (ej: "9" -> "PROD-009")
        if (typeof window.buscarProductoPorCodigoFlexible === 'function') {
            const flex = window.buscarProductoPorCodigoFlexible(clean);
            if (flex) return flex;
        }

        return null;
    }

    /**
     * Carga ZXing UMD bajo demanda solo si el navegador no soporta BarcodeDetector nativo
     */
    function cargarZXingBajoDemanda() {
        if (window.ZXing && window.ZXing.BrowserMultiFormatReader) {
            return Promise.resolve(window.ZXing);
        }
        return new Promise((resolve, reject) => {
            const existing = document.getElementById('zxing-umd-script');
            if (existing) {
                existing.addEventListener('load', () => resolve(window.ZXing));
                existing.addEventListener('error', () => reject(new Error('No se pudo cargar ZXing')));
                return;
            }
            const script = document.createElement('script');
            script.id = 'zxing-umd-script';
            script.src = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
            script.async = true;
            script.onload = () => {
                if (window.ZXing) resolve(window.ZXing);
                else reject(new Error('ZXing no disponible tras carga'));
            };
            script.onerror = () => reject(new Error('Sin conexión para cargar motor alternativo de escaneo'));
            document.head.appendChild(script);
        });
    }

    /**
     * Inyecta estilos del modal del escáner una sola vez
     */
    function asegurarEstilos() {
        if (document.getElementById('escaner-barras-styles')) return;
        const style = document.createElement('style');
        style.id = 'escaner-barras-styles';
        style.textContent = `
            #modal-escaner-barras {
                z-index: 10050;
            }
            #modal-escaner-barras .scan-modal-box {
                max-width: 540px;
                width: 95%;
                padding: 0;
                border-radius: 16px;
                overflow: hidden;
                background: #0f172a;
                color: #f8fafc;
                border: 1px solid rgba(148, 163, 184, 0.25);
            }
            .scan-header {
                padding: 14px 18px;
                background: #0f172a;
                border-bottom: 1px solid rgba(148, 163, 184, 0.2);
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
            }
            .scan-header-title {
                margin: 0;
                font-size: 1rem;
                font-weight: 800;
                color: #ffffff;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .scan-header-sub {
                font-size: 0.76rem;
                color: #94a3b8;
                margin-top: 2px;
            }
            .scan-close-btn {
                width: 34px;
                height: 34px;
                border-radius: 50%;
                border: 1px solid rgba(255,255,255,0.22);
                background: rgba(255,255,255,0.1);
                color: #ffffff;
                font-size: 1.2rem;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }
            .scan-viewport {
                position: relative;
                width: 100%;
                aspect-ratio: 4 / 3;
                max-height: 340px;
                background: #020617;
                overflow: hidden;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            #scan-video {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
            }
            .scan-reticle {
                position: absolute;
                inset: 0;
                pointer-events: none;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .scan-frame {
                width: 78%;
                height: 46%;
                border: 2px solid rgba(56, 189, 248, 0.9);
                border-radius: 12px;
                box-shadow: 0 0 0 9999px rgba(2, 6, 23, 0.48);
                position: relative;
                overflow: hidden;
                transition: border-color 0.15s ease;
            }
            .scan-frame.scan-hit {
                border-color: #22c55e;
                box-shadow: 0 0 0 9999px rgba(2, 6, 23, 0.35), 0 0 24px rgba(34, 197, 94, 0.75);
            }
            .scan-laser {
                position: absolute;
                left: 6%;
                right: 6%;
                height: 2px;
                background: #ef4444;
                box-shadow: 0 0 10px #ef4444;
                top: 50%;
                animation: scanLaserMove 2.1s ease-in-out infinite;
            }
            @keyframes scanLaserMove {
                0%, 100% { top: 20%; }
                50% { top: 80%; }
            }
            .scan-cam-overlay-tools {
                position: absolute;
                top: 10px;
                right: 10px;
                display: flex;
                gap: 6px;
                z-index: 4;
            }
            .scan-icon-btn {
                width: 36px;
                height: 36px;
                border-radius: 9px;
                border: 1px solid rgba(255,255,255,0.22);
                background: rgba(15, 23, 42, 0.78);
                color: #f8fafc;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 0.9rem;
            }
            .scan-icon-btn.active {
                background: #eab308;
                color: #0f172a;
                border-color: #facc15;
            }
            .scan-status-msg {
                position: absolute;
                bottom: 10px;
                left: 10px;
                right: 10px;
                background: rgba(15, 23, 42, 0.85);
                color: #e2e8f0;
                padding: 7px 12px;
                border-radius: 8px;
                font-size: 0.78rem;
                text-align: center;
                backdrop-filter: blur(4px);
                z-index: 3;
            }
            .scan-feedback-banner {
                display: none;
                padding: 11px 16px;
                font-size: 0.86rem;
                font-weight: 700;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                flex-wrap: wrap;
            }
            .scan-feedback-banner.is-ok { background: #14532d; color: #dcfce7; display: flex; }
            .scan-feedback-banner.is-warn { background: #78350f; color: #fef3c7; display: flex; }
            .scan-feedback-banner.is-err { background: #7f1d1d; color: #fee2e2; display: flex; }

            .scan-controls-bar {
                padding: 14px 16px;
                background: #1e293b;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .scan-toggles-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 10px;
                font-size: 0.8rem;
                color: #cbd5e1;
            }
            .scan-manual-row {
                display: flex;
                gap: 8px;
                align-items: center;
            }
            .scan-manual-row input {
                flex: 1;
                height: 38px;
                padding: 0 12px;
                border-radius: 8px;
                border: 1px solid #475569;
                background: #0f172a;
                color: #ffffff;
                font-size: 0.88rem;
                font-weight: 600;
            }
            .scan-manual-row button {
                height: 38px;
                padding: 0 14px;
                border-radius: 8px;
                border: none;
                background: #2563eb;
                color: #ffffff;
                font-weight: 700;
                font-size: 0.84rem;
                cursor: pointer;
                white-space: nowrap;
            }
            .scan-photo-btn {
                height: 34px;
                padding: 0 11px;
                border-radius: 8px;
                border: 1px solid #475569;
                background: #0f172a;
                color: #e2e8f0;
                font-size: 0.78rem;
                font-weight: 600;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 6px;
            }
            /* Botón reutilizable de cámara junto a buscadores */
            .btn-scan-camera-inline {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                background: #0f172a;
                color: #ffffff;
                border: 1px solid #1e293b;
                border-radius: 9px;
                padding: 0 12px;
                height: 38px;
                font-size: 0.82rem;
                font-weight: 700;
                cursor: pointer;
                white-space: nowrap;
                transition: background 0.15s ease, transform 0.1s ease;
            }
            .btn-scan-camera-inline:hover { background: #1e3a8a; }
            .btn-scan-camera-inline:active { transform: scale(0.97); }
        `;
        document.head.appendChild(style);
    }

    function asegurarModalDOM() {
        asegurarEstilos();
        let modal = document.getElementById('modal-escaner-barras');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'modal-escaner-barras';
        modal.className = 'modal';
        modal.onclick = function (ev) {
            if (ev.target === modal) cerrarEscanerCodigoBarras();
        };

        modal.innerHTML = `
            <div class="modal-content scan-modal-box">
                <div class="scan-header">
                    <div>
                        <h3 class="scan-header-title" id="scan-modal-title">
                            <i class="fas fa-barcode" style="color:#38bdf8;"></i> Escáner de Código de Barras
                        </h3>
                        <div class="scan-header-sub" id="scan-modal-sub">Apunta la cámara al código de barras del producto</div>
                    </div>
                    <button type="button" class="scan-close-btn" onclick="cerrarEscanerCodigoBarras()" title="Cerrar escáner">&times;</button>
                </div>

                <div class="scan-viewport">
                    <video id="scan-video" playsinline muted autoplay></video>
                    <div class="scan-reticle">
                        <div class="scan-frame" id="scan-frame-box">
                            <div class="scan-laser"></div>
                        </div>
                    </div>
                    <div class="scan-cam-overlay-tools">
                        <button type="button" id="btn-scan-torch" class="scan-icon-btn" style="display:none;" onclick="window._scanToggleLinterna()" title="Encender/Apagar linterna">
                            <i class="fas fa-bolt"></i>
                        </button>
                        <button type="button" id="btn-scan-switch-cam" class="scan-icon-btn" style="display:none;" onclick="window._scanCambiarCamara()" title="Cambiar cámara">
                            <i class="fas fa-camera-rotate"></i>
                        </button>
                        <button type="button" id="btn-scan-sound" class="scan-icon-btn active" onclick="window._scanToggleSonido()" title="Activar/Silenciar sonido">
                            <i class="fas fa-volume-high"></i>
                        </button>
                    </div>
                    <div class="scan-status-msg" id="scan-status-msg">Iniciando cámara...</div>
                </div>

                <div class="scan-feedback-banner" id="scan-feedback-banner"></div>

                <div class="scan-controls-bar">
                    <div class="scan-toggles-row">
                        <label style="display:inline-flex; align-items:center; gap:7px; cursor:pointer; font-weight:600;">
                            <input type="checkbox" id="scan-chk-continuo" onchange="window._scanToggleContinuo(this.checked)">
                            Escaneo continuo (varios productos seguidos)
                        </label>
                        <label class="scan-photo-btn" title="Si la cámara en vivo no abre, toma una foto al código">
                            <i class="fas fa-image"></i> Desde foto
                            <input type="file" id="scan-file-input" accept="image/*" capture="environment" style="display:none;" onchange="window._scanDesdeArchivo(this)">
                        </label>
                    </div>

                    <div class="scan-manual-row">
                        <input type="text" id="scan-manual-input" placeholder="O escribe / pega el código manualmente..." onkeydown="if(event.key==='Enter'){ event.preventDefault(); window._scanProcesarManual(); }">
                        <button type="button" onclick="window._scanProcesarManual()">
                            <i class="fas fa-check"></i> Usar
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && state.abierto) {
                cerrarEscanerCodigoBarras();
            }
        });

        return modal;
    }

    function setEstadoCamara(texto) {
        const el = document.getElementById('scan-status-msg');
        if (el) el.textContent = texto;
    }

    function mostrarFeedback(tipo, html) {
        const el = document.getElementById('scan-feedback-banner');
        if (!el) return;
        el.className = 'scan-feedback-banner';
        if (tipo === 'ok') el.classList.add('is-ok');
        else if (tipo === 'warn') el.classList.add('is-warn');
        else if (tipo === 'err') el.classList.add('is-err');
        el.innerHTML = html;
    }

    function limpiarFeedback() {
        const el = document.getElementById('scan-feedback-banner');
        if (el) {
            el.className = 'scan-feedback-banner';
            el.innerHTML = '';
        }
    }

    function destellarMarco() {
        const frame = document.getElementById('scan-frame-box');
        if (!frame) return;
        frame.classList.add('scan-hit');
        setTimeout(() => frame.classList.remove('scan-hit'), 450);
    }

    function detenerCamara() {
        if (state.scanTimer) {
            clearInterval(state.scanTimer);
            state.scanTimer = null;
        }
        if (state.zxingReader) {
            try { state.zxingReader.reset(); } catch (_e) {}
            state.zxingReader = null;
        }
        if (state.stream) {
            try {
                state.stream.getTracks().forEach(t => t.stop());
            } catch (_e) {}
            state.stream = null;
        }
        state.videoTrack = null;
        state.linternaActiva = false;
        state.procesandoFrame = false;

        const video = document.getElementById('scan-video');
        if (video) {
            try { video.pause(); } catch (_e) {}
            video.srcObject = null;
        }
        const btnTorch = document.getElementById('btn-scan-torch');
        if (btnTorch) {
            btnTorch.style.display = 'none';
            btnTorch.classList.remove('active');
        }
    }

    async function iniciarCamara(deviceIdEspecifico = null) {
        detenerCamara();
        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
            setEstadoCamara('Tu navegador no permite cámara en vivo. Usa "Desde foto" o escribe el código.');
            return;
        }

        setEstadoCamara('Solicitando acceso a la cámara...');
        try {
            const videoConstraints = deviceIdEspecifico
                ? { deviceId: { exact: deviceIdEspecifico }, width: { ideal: 1280 }, height: { ideal: 720 } }
                : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } };

            const stream = await navigator.mediaDevices.getUserMedia({
                video: videoConstraints,
                audio: false
            });

            if (!state.abierto) {
                stream.getTracks().forEach(t => t.stop());
                return;
            }

            state.stream = stream;
            const tracks = stream.getVideoTracks();
            state.videoTrack = tracks.length > 0 ? tracks[0] : null;

            const video = document.getElementById('scan-video');
            if (video) {
                video.srcObject = stream;
                await video.play().catch(() => {});
            }

            // Detectar soporte de linterna (torch)
            const btnTorch = document.getElementById('btn-scan-torch');
            if (state.videoTrack && typeof state.videoTrack.getCapabilities === 'function') {
                try {
                    const caps = state.videoTrack.getCapabilities();
                    if (caps && caps.torch && btnTorch) {
                        btnTorch.style.display = 'inline-flex';
                    }
                } catch (_e) {}
            }

            // Enumerar cámaras disponibles para botón de cambio
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                state.cameras = devices.filter(d => d.kind === 'videoinput');
                const btnSwitch = document.getElementById('btn-scan-switch-cam');
                if (btnSwitch) {
                    btnSwitch.style.display = state.cameras.length > 1 ? 'inline-flex' : 'none';
                }
            } catch (_e) {}

            // Iniciar motor de decodificación
            await iniciarDecodificador(video);
        } catch (err) {
            console.warn('[Escáner] No se pudo abrir la cámara:', err);
            const msg = (err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'))
                ? 'Permiso de cámara bloqueado. Actívalo en tu navegador, usa "Desde foto" o escribe el código.'
                : 'No se encontró cámara disponible. Usa "Desde foto" o escribe el código abajo.';
            setEstadoCamara(msg);
        }
    }

    async function iniciarDecodificador(video) {
        if (!video) return;

        // Motor 1: BarcodeDetector nativo
        if ('BarcodeDetector' in window) {
            try {
                let formatos = FORMATOS_NATIVOS;
                if (typeof window.BarcodeDetector.getSupportedFormats === 'function') {
                    const soportados = await window.BarcodeDetector.getSupportedFormats();
                    const filtrados = FORMATOS_NATIVOS.filter(f => soportados.includes(f));
                    if (filtrados.length > 0) formatos = filtrados;
                }
                state.detectorNativo = new window.BarcodeDetector({ formats: formatos });
                setEstadoCamara('Cámara lista · Centra el código de barras dentro del recuadro');

                state.scanTimer = setInterval(async () => {
                    if (!state.abierto || state.procesandoFrame || !video || video.readyState < 2) return;
                    state.procesandoFrame = true;
                    try {
                        const codes = await state.detectorNativo.detect(video);
                        if (Array.isArray(codes) && codes.length > 0 && codes[0].rawValue) {
                            manejarCodigoDetectado(codes[0].rawValue);
                        }
                    } catch (_e) {} finally {
                        state.procesandoFrame = false;
                    }
                }, 160);
                return;
            } catch (nativeErr) {
                console.warn('[Escáner] BarcodeDetector falló, cambiando a motor ZXing:', nativeErr);
            }
        }

        // Motor 2: ZXing UMD fallback (iOS Safari / Firefox / Desktop)
        setEstadoCamara('Cargando lector compatible...');
        try {
            const ZXing = await cargarZXingBajoDemanda();
            if (!state.abierto) return;
            const reader = new ZXing.BrowserMultiFormatReader();
            state.zxingReader = reader;
            setEstadoCamara('Cámara lista · Centra el código de barras dentro del recuadro');

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

            state.scanTimer = setInterval(() => {
                if (!state.abierto || state.procesandoFrame || !video || video.readyState < 2 || !video.videoWidth) return;
                state.procesandoFrame = true;
                try {
                    const w = Math.min(video.videoWidth, 800);
                    const h = Math.round(video.videoHeight * (w / video.videoWidth));
                    canvas.width = w;
                    canvas.height = h;
                    ctx.drawImage(video, 0, 0, w, h);
                    const imgEl = new Image();
                    imgEl.onload = () => {
                        reader.decodeFromImageElement(imgEl)
                            .then(result => {
                                if (result && result.getText) {
                                    manejarCodigoDetectado(result.getText());
                                }
                            })
                            .catch(() => {})
                            .finally(() => { state.procesandoFrame = false; });
                    };
                    imgEl.onerror = () => { state.procesandoFrame = false; };
                    imgEl.src = canvas.toDataURL('image/jpeg', 0.8);
                } catch (_e) {
                    state.procesandoFrame = false;
                }
            }, 340);
        } catch (err) {
            console.warn('[Escáner] No se pudo iniciar ZXing:', err);
            setEstadoCamara('No fue posible iniciar el lector automático en este navegador. Usa entrada manual abajo.');
        }
    }

    /**
     * Procesa un código recién leído (con anti-rebote para evitar lecturas duplicadas accidentales)
     */
    function manejarCodigoDetectado(rawValue, desdeManual = false) {
        const codigo = normalizarCodigo(rawValue);
        if (!codigo) return;

        const ahora = Date.now();
        if (!desdeManual && codigo === state.ultimoCodigo && (ahora - state.ultimoCodigoTs) < 1600) {
            return;
        }
        state.ultimoCodigo = codigo;
        state.ultimoCodigoTs = ahora;
        destellarMarco();

        if (typeof state.callbackCustom === 'function') {
            reproducirBeep(true);
            state.callbackCustom(codigo);
            if (!state.continuo) cerrarEscanerCodigoBarras();
            return;
        }

        // Acción según el módulo desde el que se abrió el escáner
        if (state.modo === 'producto_form') {
            procesarEscaneoFormularioProducto(codigo);
        } else if (state.modo === 'pos') {
            procesarEscaneoPOS(codigo);
        } else if (state.modo === 'factura') {
            procesarEscaneoFactura(codigo);
        } else if (state.modo === 'auditoria') {
            procesarEscaneoAuditoria(codigo);
        } else {
            procesarEscaneoInventario(codigo);
        }
    }

    function procesarEscaneoFormularioProducto(codigo) {
        const inputBarras = document.getElementById('prod-codigo-barras');
        const idActual = document.getElementById('prod-id')?.value?.trim() || '';

        // Verificar si otro producto ya tiene ese código de barras
        const existente = buscarProductoPorCodigoDeBarras(codigo);
        if (existente && String(existente.id) !== String(idActual)) {
            reproducirBeep(false);
            mostrarFeedback('warn', `
                <span><i class="fas fa-triangle-exclamation"></i> El código <strong>${escaparHtml(codigo)}</strong> ya está asignado a "${escaparHtml(existente.nombre)}" (${escaparHtml(existente.codigo)}).</span>
            `);
            if (inputBarras) inputBarras.value = codigo;
            return;
        }

        reproducirBeep(true);
        if (inputBarras) {
            inputBarras.value = codigo;
            inputBarras.dispatchEvent(new Event('input', { bubbles: true }));
        }
        notificar(`Código de barras ${codigo} capturado.`, 'success');
        cerrarEscanerCodigoBarras();
    }

    function procesarEscaneoPOS(codigo) {
        const prod = buscarProductoPorCodigoDeBarras(codigo);
        if (!prod) {
            reproducirBeep(false);
            mostrarFeedback('err', `
                <span><i class="fas fa-circle-xmark"></i> Código <strong>${escaparHtml(codigo)}</strong> no registrado en tu inventario.</span>
            `);
            return;
        }

        const stockDisp = Number(prod.stock || 0);
        if (stockDisp <= 0) {
            reproducirBeep(false);
            mostrarFeedback('warn', `
                <span><i class="fas fa-ban"></i> <strong>${escaparHtml(prod.nombre)}</strong> está agotado (Stock: 0).</span>
            `);
            return;
        }

        reproducirBeep(true);
        state.escaneosSesion += 1;

        if (typeof window.agregarAlCarrito === 'function') {
            window.agregarAlCarrito(prod.id);
        } else {
            const posSearch = document.getElementById('pos-search');
            if (posSearch) {
                posSearch.value = prod.codigo || prod.nombre;
                if (typeof window.filtrarPosProductos === 'function') window.filtrarPosProductos();
            }
        }

        mostrarFeedback('ok', `
            <span><i class="fas fa-cart-plus"></i> <strong>+1 ${escaparHtml(prod.nombre)}</strong> ($${Number(prod.precio || 0).toFixed(2)}) agregado al carrito</span>
            <span style="font-size:0.76rem; opacity:0.9;">Escaneados: ${state.escaneosSesion}</span>
        `);

        if (!state.continuo) {
            setTimeout(() => cerrarEscanerCodigoBarras(), 420);
        }
    }

    function procesarEscaneoInventario(codigo) {
        const prod = buscarProductoPorCodigoDeBarras(codigo);
        if (prod) {
            reproducirBeep(true);
            const inputBuscar = document.getElementById('inventario-buscar-input');
            if (inputBuscar) {
                inputBuscar.value = prod.codigoBarras || prod.codigo || prod.nombre;
            }
            if (typeof window.filtrarInventarioTexto === 'function') {
                window.filtrarInventarioTexto(prod.codigoBarras || prod.codigo || prod.nombre);
            }
            notificar(`Producto encontrado: ${prod.nombre} (Stock: ${prod.stock})`, 'success');
            cerrarEscanerCodigoBarras();
            return;
        }

        reproducirBeep(false);
        const codEsc = escaparHtml(codigo);
        mostrarFeedback('warn', `
            <span><i class="fas fa-box-open"></i> Código <strong>${codEsc}</strong> no registrado.</span>
            <button type="button" onclick="window._scanCrearProductoConCodigo('${codEsc}')" style="background:#f59e0b; color:#0f172a; border:none; border-radius:7px; padding:6px 11px; font-weight:800; font-size:0.78rem; cursor:pointer;">
                + Crear producto con este código
            </button>
        `);
    }

    function procesarEscaneoFactura(codigo) {
        const prod = buscarProductoPorCodigoDeBarras(codigo);
        if (!prod) {
            reproducirBeep(false);
            mostrarFeedback('err', `
                <span><i class="fas fa-circle-xmark"></i> Código <strong>${escaparHtml(codigo)}</strong> no encontrado en el catálogo.</span>
            `);
            return;
        }

        reproducirBeep(true);
        if (typeof window.seleccionarProductoFactura === 'function') {
            window.seleccionarProductoFactura(prod.id);
        } else {
            const inp = document.getElementById('factura-search-producto');
            if (inp) {
                inp.value = prod.codigo || prod.nombre;
                if (typeof window.alBuscarProductoFactura === 'function') window.alBuscarProductoFactura(inp.value);
            }
        }
        notificar(`Producto cargado en factura: ${prod.nombre}`, 'success');
        cerrarEscanerCodigoBarras();
        setTimeout(() => {
            const cantInput = document.getElementById('factura-item-cantidad');
            if (cantInput) {
                cantInput.focus();
                cantInput.select();
            }
        }, 180);
    }

    function procesarEscaneoAuditoria(codigo) {
        const prod = buscarProductoPorCodigoDeBarras(codigo);
        if (!prod) {
            reproducirBeep(false);
            mostrarFeedback('err', `
                <span><i class="fas fa-circle-xmark"></i> Código <strong>${escaparHtml(codigo)}</strong> no encontrado para auditoría.</span>
            `);
            return;
        }

        reproducirBeep(true);
        state.escaneosSesion += 1;

        // Leer conteo físico actual del producto y sumar +1 automáticamente
        const inputDesk = document.getElementById(`auditoria-input-${prod.id}`);
        const inputMob = document.getElementById(`auditoria-mob-input-${prod.id}`);
        const actualRaw = (inputDesk && inputDesk.value !== '')
            ? inputDesk.value
            : ((inputMob && inputMob.value !== '') ? inputMob.value : '');
        const actualNum = actualRaw === '' ? 0 : Math.max(0, Number(actualRaw) || 0);
        const nuevoConteo = actualNum + 1;

        if (typeof window.actualizarConteoFisico === 'function') {
            window.actualizarConteoFisico(prod.id, String(nuevoConteo));
        }
        if (inputDesk) inputDesk.value = String(nuevoConteo);
        if (inputMob) inputMob.value = String(nuevoConteo);

        const dif = nuevoConteo - Number(prod.stock || 0);
        const difTxt = dif === 0 ? 'Conforme (0)' : (dif > 0 ? `+${dif} sobrante` : `${dif} faltante`);

        mostrarFeedback('ok', `
            <span><i class="fas fa-clipboard-check"></i> <strong>+1 ${escaparHtml(prod.nombre)}</strong> → Conteo físico: <strong>${nuevoConteo}</strong> (Digital: ${Number(prod.stock || 0)} · ${difTxt})</span>
        `);

        if (!state.continuo) {
            cerrarEscanerCodigoBarras();
            const target = inputDesk || inputMob;
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                target.focus();
            }
        }
    }

    // =========================================================================
    // API PÚBLICA Y CONTROLES DEL MODAL
    // =========================================================================

    function abrirEscanerCodigoBarras(modo = 'pos', opciones = {}) {
        const modal = asegurarModalDOM();
        state.modo = modo || 'pos';
        state.abierto = true;
        state.ultimoCodigo = '';
        state.ultimoCodigoTs = 0;
        state.escaneosSesion = 0;
        state.callbackCustom = typeof opciones.onDetect === 'function' ? opciones.onDetect : null;

        // En POS y Auditoría el modo continuo viene activado por defecto para escanear rápido
        state.continuo = opciones.continuo !== undefined
            ? Boolean(opciones.continuo)
            : (state.modo === 'pos' || state.modo === 'auditoria');

        const titulos = {
            pos: { t: 'Escáner POS · Agregar al Carrito', s: 'Escanea cada producto para sumarlo automáticamente a la venta' },
            inventario: { t: 'Escáner de Inventario', s: 'Busca un producto por su código de barras o créalo al instante' },
            producto_form: { t: 'Capturar Código de Barras', s: 'Escanea el código EAN/UPC impreso en el empaque del producto' },
            factura: { t: 'Escáner de Ingreso (Facturas)', s: 'Escanea el producto para cargarlo de inmediato en la factura' },
            auditoria: { t: 'Escáner de Conteo Físico (+1)', s: 'Cada escaneo suma +1 unidad al conteo físico de auditoría' }
        };
        const info = titulos[state.modo] || titulos.pos;

        const titleEl = document.getElementById('scan-modal-title');
        const subEl = document.getElementById('scan-modal-sub');
        const chkCont = document.getElementById('scan-chk-continuo');
        const manualInp = document.getElementById('scan-manual-input');
        const fileInp = document.getElementById('scan-file-input');

        if (titleEl) titleEl.innerHTML = `<i class="fas fa-barcode" style="color:#38bdf8;"></i> ${info.t}`;
        if (subEl) subEl.textContent = info.s;
        if (chkCont) chkCont.checked = state.continuo;
        if (manualInp) manualInp.value = '';
        if (fileInp) fileInp.value = '';
        limpiarFeedback();

        modal.classList.add('active');
        iniciarCamara();
    }

    function cerrarEscanerCodigoBarras() {
        state.abierto = false;
        detenerCamara();
        const modal = document.getElementById('modal-escaner-barras');
        if (modal) modal.classList.remove('active');
    }

    window._scanToggleContinuo = function (activo) {
        state.continuo = Boolean(activo);
    };

    window._scanToggleSonido = function () {
        state.sonidoActivo = !state.sonidoActivo;
        const btn = document.getElementById('btn-scan-sound');
        if (btn) {
            btn.classList.toggle('active', state.sonidoActivo);
            btn.innerHTML = state.sonidoActivo
                ? '<i class="fas fa-volume-high"></i>'
                : '<i class="fas fa-volume-xmark"></i>';
        }
    };

    window._scanToggleLinterna = async function () {
        if (!state.videoTrack || typeof state.videoTrack.applyConstraints !== 'function') return;
        try {
            state.linternaActiva = !state.linternaActiva;
            await state.videoTrack.applyConstraints({ advanced: [{ torch: state.linternaActiva }] });
            const btn = document.getElementById('btn-scan-torch');
            if (btn) btn.classList.toggle('active', state.linternaActiva);
        } catch (_e) {
            state.linternaActiva = false;
            notificar('Tu cámara no permite controlar la linterna desde el navegador.', 'info');
        }
    };

    window._scanCambiarCamara = function () {
        if (!state.cameras || state.cameras.length < 2) return;
        state.cameraIndex = (state.cameraIndex + 1) % state.cameras.length;
        const nextCam = state.cameras[state.cameraIndex];
        if (nextCam && nextCam.deviceId) {
            iniciarCamara(nextCam.deviceId);
        }
    };

    window._scanProcesarManual = function () {
        const inp = document.getElementById('scan-manual-input');
        if (!inp) return;
        const val = normalizarCodigo(inp.value);
        if (!val) return;
        inp.value = '';
        manejarCodigoDetectado(val, true);
    };

    window._scanCrearProductoConCodigo = function (codigo) {
        cerrarEscanerCodigoBarras();
        if (typeof window.nuevoProductoDesdeInventario === 'function') {
            window.nuevoProductoDesdeInventario();
        }
        setTimeout(() => {
            const inp = document.getElementById('prod-codigo-barras');
            if (inp) {
                inp.value = codigo;
                inp.dispatchEvent(new Event('input', { bubbles: true }));
            }
            const nom = document.getElementById('prod-nombre');
            if (nom) nom.focus();
        }, 120);
    };

    window._scanDesdeArchivo = async function (inputEl) {
        const file = inputEl && inputEl.files && inputEl.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        try {
            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = url;
            });

            // Intentar BarcodeDetector nativo primero
            if ('BarcodeDetector' in window) {
                try {
                    const det = new window.BarcodeDetector({ formats: FORMATOS_NATIVOS });
                    const codes = await det.detect(img);
                    if (codes && codes.length > 0 && codes[0].rawValue) {
                        manejarCodigoDetectado(codes[0].rawValue, true);
                        return;
                    }
                } catch (_e) {}
            }

            // Intentar ZXing sobre la imagen
            const ZXing = await cargarZXingBajoDemanda();
            const reader = new ZXing.BrowserMultiFormatReader();
            const res = await reader.decodeFromImageElement(img);
            if (res && res.getText) {
                manejarCodigoDetectado(res.getText(), true);
                return;
            }
            mostrarFeedback('warn', '<span>No se detectó ningún código de barras en la foto. Intenta acercar un poco más con buena luz.</span>');
        } catch (_err) {
            mostrarFeedback('warn', '<span>No se pudo leer un código en esa imagen. Prueba con mejor enfoque o escríbelo manualmente.</span>');
        } finally {
            URL.revokeObjectURL(url);
            inputEl.value = '';
        }
    };

    // Exportar API global
    window.abrirEscanerCodigoBarras = abrirEscanerCodigoBarras;
    window.cerrarEscanerCodigoBarras = cerrarEscanerCodigoBarras;
    window.buscarProductoPorCodigoDeBarras = buscarProductoPorCodigoDeBarras;

    window.InventoryApp.EscanerBarras = {
        abrir: abrirEscanerCodigoBarras,
        cerrar: cerrarEscanerCodigoBarras,
        buscarProducto: buscarProductoPorCodigoDeBarras
    };

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', asegurarEstilos, { once: true });
        } else {
            asegurarEstilos();
        }
    }
})();
