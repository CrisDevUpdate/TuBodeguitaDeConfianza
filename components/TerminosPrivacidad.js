/**
 * components/TerminosPrivacidad.js
 * Módulo de Cumplimiento Legal, Habeas Data, Transparencia en IA y Términos de Servicio
 * "Tu Bodeguita de Confianza"
 * 
 * Titular: Tu Bodeguita de Confianza / Cristian Flores
 * Contacto: 04125363849 | Cris.Dev.Update@gmail.com
 */

(function () {
    const STORAGE_KEY_TERMINOS = 'bodeguita_terminos_aceptados_v1';
    const WHATSAPP_NUMERO = '584125363849';
    const CORREO_SOPORTE = 'Cris.Dev.Update@gmail.com';
    const HORARIO_ATENCION = 'Lunes a Sábado: 8:00 AM – 8:00 PM | Domingos: 9:00 AM – 4:00 PM';

    // Generar o inyectar los elementos DOM al iniciar
    function inicializarModuloTerminos() {
        inyectarModalTerminos();
        inyectarBannerPrimeraVisita();
        verificarBannerPrimeraVisita();
    }

    /**
     * Construye e inyecta el Modal de Términos y Privacidad si no existe
     */
    function inyectarModalTerminos() {
        if (document.getElementById('modal-terminos-privacidad')) return;

        const modalDiv = document.createElement('div');
        modalDiv.id = 'modal-terminos-privacidad';
        modalDiv.className = 'modal';
        modalDiv.setAttribute('role', 'dialog');
        modalDiv.setAttribute('aria-modal', 'true');
        modalDiv.setAttribute('aria-labelledby', 'terminos-modal-titulo');

        modalDiv.innerHTML = `
            <div class="modal-terminos-content" onclick="event.stopPropagation()">
                <!-- Encabezado Formal -->
                <div class="terminos-modal-header">
                    <div class="terminos-header-left">
                        <div class="terminos-header-icon">
                            <i class="fas fa-shield-halved"></i>
                        </div>
                        <div class="terminos-header-titles">
                            <h2 id="terminos-modal-titulo">
                                Términos, Condiciones y Privacidad
                                <span class="terminos-badge-version">VIGENTE 2026</span>
                            </h2>
                            <p>Tu Bodeguita de Confianza • Marco de Seguridad, Habeas Data e Inteligencia Artificial</p>
                        </div>
                    </div>
                    <button type="button" class="terminos-modal-close-btn" onclick="cerrarModalTerminosCondiciones()" title="Cerrar modal" aria-label="Cerrar">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- Chips de Navegación Rápida -->
                <div class="terminos-quick-nav">
                    <button type="button" class="terminos-nav-chip active" data-target="sec-habeas-data" onclick="irASeccionTerminos('sec-habeas-data')">
                        <i class="fas fa-database"></i> 1. Habeas Data
                    </button>
                    <button type="button" class="terminos-nav-chip" data-target="sec-ia-transparencia" onclick="irASeccionTerminos('sec-ia-transparencia')">
                        <i class="fas fa-robot"></i> 2. Uso de IA
                    </button>
                    <button type="button" class="terminos-nav-chip" data-target="sec-cuentas-puntos" onclick="irASeccionTerminos('sec-cuentas-puntos')">
                        <i class="fas fa-star"></i> 3. Cuentas y Fidelización
                    </button>
                    <button type="button" class="terminos-nav-chip" data-target="sec-no-venta-datos" onclick="irASeccionTerminos('sec-no-venta-datos')">
                        <i class="fas fa-lock"></i> 4. Confidencialidad
                    </button>
                    <button type="button" class="terminos-nav-chip" data-target="sec-contacto-soporte" onclick="irASeccionTerminos('sec-contacto-soporte')">
                        <i class="fas fa-headset"></i> 5. Titular y Soporte
                    </button>
                </div>

                <!-- Cuerpo Scrollable con Redacción Legal Profesional -->
                <div class="terminos-modal-body" id="terminos-modal-body-scroll">
                    
                    <!-- Preámbulo -->
                    <div style="background:var(--bg-card, #f8fafc); border:1px solid var(--border-light, #e2e8f0); border-radius:10px; padding:14px 16px; margin-bottom:20px;">
                        <p style="margin:0; font-size:0.88rem; color:var(--text-main, #334155);">
                            Bienvenido a <strong>Tu Bodeguita de Confianza</strong>. Nuestro compromiso es brindarte un servicio transparente, seguro y eficiente. A través de este documento te explicamos con claridad cómo protegemos tu información personal, cómo opera nuestra tecnología y cómo garantizamos tus derechos en cada compra, abono o consulta.
                        </p>
                    </div>

                    <!-- SECCIÓN 1: AVISO DE BASE DE DATOS Y HABEAS DATA -->
                    <section class="terminos-section" id="sec-habeas-data">
                        <h3 class="terminos-section-title">
                            <i class="fas fa-database"></i> 1. Aviso de Base de Datos y Política de Habeas Data
                        </h3>
                        <p>
                            En cumplimiento de los principios universales de protección de datos personales y Habeas Data, declaramos que <strong>Tu Bodeguita de Confianza</strong> recopila y almacena de forma segura exclusivamente datos operativos necesarios para el funcionamiento de la relación comercial con nuestros clientes.
                        </p>
                        
                        <div class="terminos-callout primary">
                            <i class="fas fa-info-circle terminos-callout-icon"></i>
                            <div>
                                <strong>Datos tratados exclusivamente para la operación:</strong>
                                <ul style="margin:6px 0 0 0; padding-left:18px;">
                                    <li><strong>Identificación y contacto:</strong> Nombres, apellidos, número de cédula/ID o RIF, número de teléfono (WhatsApp) y correo electrónico.</li>
                                    <li><strong>Historial comercial:</strong> Registro histórico de compras realizadas, comprobantes, balance de cuentas por cobrar (fiados) y recibos de abonos o pagos.</li>
                                    <li><strong>Programa de lealtad:</strong> Puntos acumulados por compras, canjes de recompensas y participación en dinámicas de fidelización.</li>
                                </ul>
                            </div>
                        </div>

                        <p>
                            <strong>Finalidad estricta y limitada:</strong> La información almacenada se utiliza exclusivamente para:
                        </p>
                        <ol style="margin-top:4px; padding-left:20px;">
                            <li>Gestión y conciliación de estados de cuenta individuales y cobros transparentes.</li>
                            <li>Control exacto del inventario físico y emisión de comprobantes de despacho.</li>
                            <li>Cálculo matemático de puntos y beneficios del programa de fidelización del cliente.</li>
                            <li>Notificaciones operativas solicitadas por el cliente sobre su saldo o pedidos.</li>
                        </ol>

                        <div class="terminos-callout success">
                            <i class="fas fa-shield-check terminos-callout-icon"></i>
                            <div>
                                <strong>Tus Derechos de Habeas Data (Consulta, Rectificación y Supresión):</strong><br>
                                Como titular de tus datos, tienes derecho en cualquier momento y sin costo alguno a:
                                <ul style="margin:4px 0 0 0; padding-left:18px;">
                                    <li><strong>Consultar</strong> la totalidad de datos e historial registrados a tu nombre.</li>
                                    <li><strong>Actualizar o rectificar</strong> cualquier dato inexacto o desactualizado.</li>
                                    <li><strong>Solicitar la eliminación</strong> de tu cuenta y datos personales, siempre que no existan obligaciones contables o saldos pendientes de pago conforme a la ley mercantil.</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    <!-- SECCIÓN 2: DECLARACIÓN TRANSPARENTE DEL USO DE INTELIGENCIA ARTIFICIAL (IA) -->
                    <section class="terminos-section" id="sec-ia-transparencia">
                        <h3 class="terminos-section-title">
                            <i class="fas fa-robot"></i> 2. Declaración Transparente del Uso de Inteligencia Artificial (IA)
                        </h3>
                        <p>
                            En <strong>Tu Bodeguita de Confianza</strong> creemos en la innovación responsable y la total transparencia algorítmica hacia nuestra comunidad. El sistema incorpora modelos y herramientas de Inteligencia Artificial y automatización con un alcance rigurosamente delimitado:
                        </p>

                        <div class="terminos-callout info">
                            <i class="fas fa-microchip terminos-callout-icon"></i>
                            <div>
                                <strong>Tareas exclusivas donde interviene la Inteligencia Artificial:</strong>
                                <ul style="margin:4px 0 0 0; padding-left:18px;">
                                    <li><strong>Lectura óptica y procesamiento de facturas de proveedores (OCR inteligente):</strong> Asiste en digitalizar renglones, precios de costo mayorista y descripciones de mercancía para mantener los precios al día.</li>
                                    <li><strong>Conciliación inteligente de inventario:</strong> Detección de mermas, sugerencias de stock mínimo y optimización de rotación de productos.</li>
                                    <li><strong>Atención y categorización automatizada:</strong> Agilización de consultas operativas frecuentes dentro de la plataforma.</li>
                                </ul>
                            </div>
                        </div>

                        <div class="terminos-callout warning">
                            <i class="fas fa-shield-halved terminos-callout-icon"></i>
                            <div>
                                <strong>Garantías Cruciales de Seguridad Bancaria y Humana:</strong>
                                <ul style="margin:4px 0 0 0; padding-left:18px;">
                                    <li><strong>Cero almacenamiento de datos bancarios confidenciales:</strong> Los algoritmos de IA jamás recopilan, procesan ni almacenan números de tarjetas, claves secretas, pines ni credenciales interbancarias.</li>
                                    <li><strong>No reemplaza la supervisión humana:</strong> Las sugerencias generadas por IA son únicamente herramientas de apoyo contable y están siempre sujetas a la revisión, validación y confirmación por parte del administrador humano a cargo.</li>
                                    <li><strong>Sin decisiones automatizadas discriminatorias:</strong> Ninguna decisión de crédito, precio o atención se toma de forma autónoma sin criterio y supervisión comercial humana.</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    <!-- SECCIÓN 3: PROGRAMA DE FIDELIZACIÓN, CRÉDITOS Y FIADOS -->
                    <section class="terminos-section" id="sec-cuentas-puntos">
                        <h3 class="terminos-section-title">
                            <i class="fas fa-star"></i> 3. Gestión de Cuentas, Créditos (Fiados) y Puntos de Lealtad
                        </h3>
                        <p>
                            La plataforma ofrece una experiencia multimoneda que combina transacciones en Dólares Estadounidenses ($ USD) y Bolívares (Bs. VES) utilizando como referencia oficial la tasa publicada por el Banco Central de Venezuela (BCV).
                        </p>
                        <ul style="padding-left:20px; margin-top:6px;">
                            <li><strong>Transparencia en el Estado de Cuenta:</strong> Los clientes pueden acceder en tiempo real a su estado de cuenta para auditar cada compra efectuada, fecha, monto, tasa de conversión y pagos o abonos registrados.</li>
                            <li><strong>Responsabilidad en Compras a Crédito:</strong> El registro de fiados constituye una obligación financiera de buena fe entre el cliente y el comercio. El cliente acepta mantener sus datos de contacto actualizados para facilitar la conciliación.</li>
                            <li><strong>Programa de Puntos:</strong> Las compras generan puntos de lealtad calculados según los márgenes comerciales de cada producto. Los puntos son personales, acumulables según las políticas vigentes y pueden canjearse por recompensas o premios autorizados por la administración.</li>
                        </ul>
                    </section>

                    <!-- SECCIÓN 4: CONFIDENCIALIDAD Y NO VENTA DE DATOS -->
                    <section class="terminos-section" id="sec-no-venta-datos">
                        <h3 class="terminos-section-title">
                            <i class="fas fa-lock"></i> 4. Confidencialidad y Compromiso de No Venta de Datos
                        </h3>
                        <p>
                            Asumimos un compromiso categórico: <strong>Tus datos personales NUNCA serán vendidos, alquilados, cedidos ni compartidos con empresas publicitarias, intermediarios de mercadeo ni terceros ajenos a la operación de Tu Bodeguita de Confianza.</strong>
                        </p>
                        <p>
                            El acceso a las bases de datos está restringido mediante roles de usuario autorizados (Administrador / Operador), con credenciales cifradas y almacenamiento en la nube de alta disponibilidad con protocolos de seguridad estándar.
                        </p>
                    </section>

                    <!-- SECCIÓN 5: TITULARIDAD, CONTACTO Y ATENCIÓN AL CLIENTE -->
                    <section class="terminos-section" id="sec-contacto-soporte">
                        <h3 class="terminos-section-title">
                            <i class="fas fa-headset"></i> 5. Titularidad del Servicio y Canales de Atención
                        </h3>
                        <p>
                            Para cualquier consulta respecto a estos Términos, ejercicio de tus derechos de Habeas Data (acceso, corrección o eliminación de datos) o soporte operativo, puedes contactarnos directamente:
                        </p>

                        <div class="terminos-contact-grid">
                            <div class="terminos-contact-card">
                                <div class="terminos-contact-icon owner">
                                    <i class="fas fa-store"></i>
                                </div>
                                <div class="terminos-contact-info">
                                    <span class="label">Responsable / Titular</span>
                                    <span class="val">Tu Bodeguita de Confianza</span>
                                    <small style="display:block; color:var(--text-muted); font-size:0.78rem; margin-top:2px;">Cristian Flores</small>
                                </div>
                            </div>

                            <div class="terminos-contact-card">
                                <div class="terminos-contact-icon whatsapp">
                                    <i class="fab fa-whatsapp"></i>
                                </div>
                                <div class="terminos-contact-info">
                                    <span class="label">WhatsApp de Atención</span>
                                    <a class="val" href="https://wa.me/${WHATSAPP_NUMERO}?text=Hola%2C%20me%20comunico%20desde%20Tu%20Bodeguita%20de%20Confianza" target="_blank" rel="noopener">
                                        0412-5363849
                                    </a>
                                </div>
                            </div>

                            <div class="terminos-contact-card">
                                <div class="terminos-contact-icon email">
                                    <i class="fas fa-envelope"></i>
                                </div>
                                <div class="terminos-contact-info">
                                    <span class="label">Correo Electrónico</span>
                                    <a class="val" href="mailto:${CORREO_SOPORTE}?subject=Consulta%20Terminos%20y%20Privacidad">
                                        ${CORREO_SOPORTE}
                                    </a>
                                </div>
                            </div>

                            <div class="terminos-contact-card">
                                <div class="terminos-contact-icon schedule">
                                    <i class="far fa-clock"></i>
                                </div>
                                <div class="terminos-contact-info">
                                    <span class="label">Horario de Atención</span>
                                    <span class="val" style="font-size:0.8rem; font-weight:700;">
                                        ${HORARIO_ATENCION}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </section>

                </div>

                <!-- Pie de Acciones del Modal -->
                <div class="terminos-modal-footer">
                    <div style="font-size:0.78rem; color:var(--text-muted);">
                        <i class="fas fa-check-circle" style="color:#10b981;"></i> Documento aplicable a usuarios, clientes y operadores.
                    </div>
                    <div class="terminos-modal-footer-actions">
                        <button type="button" class="btn btn-outline" onclick="solicitarHabeasDataWhatsApp()" style="font-size:0.82rem; font-weight:700;">
                            <i class="fab fa-whatsapp" style="color:#16a34a;"></i> Contactar por WhatsApp
                        </button>
                        <button type="button" class="btn btn-outline" onclick="imprimirTerminosCondiciones()" style="font-size:0.82rem; font-weight:700;">
                            <i class="fas fa-print"></i> Imprimir
                        </button>
                        <button type="button" class="btn btn-primary" onclick="aceptarTerminosCondiciones(true)" style="font-size:0.85rem; font-weight:800; background:linear-gradient(135deg, #2563eb, #3b82f6); border:none; padding:8px 20px;">
                            <i class="fas fa-check"></i> Entendido y Aceptar
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Cerrar al hacer clic en el backdrop exterior
        modalDiv.addEventListener('click', function (e) {
            if (e.target === modalDiv) {
                cerrarModalTerminosCondiciones();
            }
        });

        document.body.appendChild(modalDiv);
    }

    /**
     * Construye e inyecta el Banner Flotante de Primera Visita
     */
    function inyectarBannerPrimeraVisita() {
        if (document.getElementById('banner-terminos-privacidad')) return;

        const bannerDiv = document.createElement('div');
        bannerDiv.id = 'banner-terminos-privacidad';
        bannerDiv.className = 'terminos-first-banner';
        bannerDiv.setAttribute('role', 'alert');
        bannerDiv.setAttribute('aria-live', 'polite');

        bannerDiv.innerHTML = `
            <div class="terminos-first-banner-text">
                <i class="fas fa-shield-halved terminos-first-banner-icon"></i>
                <span>
                    <strong>Privacidad y Transparencia:</strong> Al utilizar <em>Tu Bodeguita de Confianza</em>, aceptas nuestros 
                    <a href="javascript:void(0)" onclick="abrirModalTerminosCondiciones()" style="color:#60a5fa; font-weight:700; text-decoration:underline;">Términos de Servicio y Tratamiento Seguro de Datos (Habeas Data & IA)</a>.
                </span>
            </div>
            <div class="terminos-first-banner-actions">
                <button type="button" class="terminos-banner-btn-read" onclick="abrirModalTerminosCondiciones()">
                    Leer Términos
                </button>
                <button type="button" class="terminos-banner-btn-accept" onclick="aceptarTerminosCondiciones(false)">
                    <i class="fas fa-check"></i> Aceptar
                </button>
            </div>
        `;

        document.body.appendChild(bannerDiv);
    }

    /**
     * Verifica si el usuario ya aceptó los términos previamente en localStorage o en su perfil
     */
    function verificarBannerPrimeraVisita() {
        try {
            const aceptado = localStorage.getItem(STORAGE_KEY_TERMINOS);
            const usuario = window.AppState?.usuarioActual;
            if (aceptado === 'true' || (usuario && usuario.terminosAceptados === true)) {
                return;
            }
            setTimeout(() => {
                const recheckAceptado = localStorage.getItem(STORAGE_KEY_TERMINOS);
                const recheckUsuario = window.AppState?.usuarioActual;
                if (recheckAceptado === 'true' || (recheckUsuario && recheckUsuario.terminosAceptados === true)) {
                    return;
                }
                const banner = document.getElementById('banner-terminos-privacidad');
                if (banner) {
                    banner.classList.add('visible');
                }
            }, 1200);
        } catch (e) {
            console.warn('Error al verificar almacenamiento de términos:', e);
        }
    }

    /**
     * Abre el Modal con soporte de anclaje a una sección opcional
     */
    function abrirModalTerminosCondiciones(seccionId) {
        inyectarModalTerminos();
        const modal = document.getElementById('modal-terminos-privacidad');
        if (!modal) return;

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        if (seccionId) {
            setTimeout(() => {
                irASeccionTerminos(seccionId);
            }, 100);
        }
    }

    /**
     * Cierra el modal
     */
    function cerrarModalTerminosCondiciones() {
        const modal = document.getElementById('modal-terminos-privacidad');
        if (modal) {
            modal.classList.remove('active');
        }
        document.body.style.overflow = '';
    }

    /**
     * Desplaza el scroll interno del modal a una sección específica
     */
    function irASeccionTerminos(seccionId) {
        const modal = document.getElementById('modal-terminos-privacidad');
        if (modal) {
            modal.querySelectorAll('.terminos-nav-chip').forEach(c => c.classList.remove('active'));
            const activeBtn = modal.querySelector(`.terminos-nav-chip[data-target="${seccionId}"]`);
            if (activeBtn) activeBtn.classList.add('active');
        }

        const target = document.getElementById(seccionId);
        const scrollContainer = document.getElementById('terminos-modal-body-scroll');
        if (target && scrollContainer) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    /**
     * Registra la aceptación de términos en localStorage y oculta el banner
     */
    function aceptarTerminosCondiciones(cerrarModal = true) {
        try {
            localStorage.setItem(STORAGE_KEY_TERMINOS, 'true');
            localStorage.setItem(STORAGE_KEY_TERMINOS + '_timestamp', new Date().toISOString());

            if (window.AppState?.usuarioActual) {
                window.AppState.usuarioActual.terminosAceptados = true;
                if (window.InventoryApp?.Persistence?.guardar) {
                    window.InventoryApp.Persistence.guardar(true);
                }
                if (window.InventoryApp?.Firebase?.guardarUsuario) {
                    window.InventoryApp.Firebase.guardarUsuario(window.AppState.usuarioActual).catch(() => {});
                }
            }
        } catch (e) {
            console.warn('No se pudo guardar la aceptación de términos en localStorage:', e);
        }

        const banner = document.getElementById('banner-terminos-privacidad');
        if (banner) {
            banner.classList.remove('visible');
            setTimeout(() => {
                banner.remove();
            }, 400);
        }

        if (cerrarModal) {
            cerrarModalTerminosCondiciones();
            if (window.InventoryApp && typeof window.InventoryApp.showToast === 'function') {
                window.InventoryApp.showToast('Términos y Política de Privacidad aceptados correctamente.', 'success', 3000);
            }
        }
    }

    /**
     * Abre WhatsApp con mensaje prediseñado para consultar o ejercer Habeas Data
     */
    function solicitarHabeasDataWhatsApp(tipo = 'consulta') {
        let texto = 'Hola, me comunico respecto a la Política de Privacidad y Habeas Data de Tu Bodeguita de Confianza.';
        if (tipo === 'rectificacion') {
            texto += ' Deseo solicitar una actualización/rectificación en mis datos registrados.';
        } else if (tipo === 'eliminacion') {
            texto += ' Deseo consultar el proceso para solicitar la supresión de mis datos personales.';
        } else {
            texto += ' Deseo realizar una consulta sobre mi estado de cuenta y datos personales.';
        }

        if (typeof abrirWhatsAppEnlace === 'function') {
            abrirWhatsAppEnlace({ telefono: WHATSAPP_NUMERO, mensaje: texto, app: 'normal' });
        } else {
            const url = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(texto)}&app=normal`;
            window.open(url, '_blank');
        }
    }

    /**
     * Imprimir los términos
     */
    function imprimirTerminosCondiciones() {
        abrirModalTerminosCondiciones();
        setTimeout(() => {
            window.print();
        }, 250);
    }

    // Exponer API global para ser llamada desde botones del footer, gatewall, menú y vistas
    window.abrirModalTerminosCondiciones = abrirModalTerminosCondiciones;
    window.cerrarModalTerminosCondiciones = cerrarModalTerminosCondiciones;
    window.irASeccionTerminos = irASeccionTerminos;
    window.aceptarTerminosCondiciones = aceptarTerminosCondiciones;
    window.solicitarHabeasDataWhatsApp = solicitarHabeasDataWhatsApp;
    window.imprimirTerminosCondiciones = imprimirTerminosCondiciones;

    window.InventoryApp = window.InventoryApp || {};
    window.InventoryApp.TerminosPrivacidad = {
        abrir: abrirModalTerminosCondiciones,
        cerrar: cerrarModalTerminosCondiciones,
        aceptar: aceptarTerminosCondiciones,
        solicitarHabeasDataWhatsApp,
        imprimir: imprimirTerminosCondiciones,
        STORAGE_KEY: STORAGE_KEY_TERMINOS,
        TITULAR: 'Tu Bodeguita de Confianza',
        RESPONSABLE: 'Cristian Flores',
        TELEFONO: WHATSAPP_NUMERO,
        CORREO: CORREO_SOPORTE,
        HORARIO: HORARIO_ATENCION
    };

    // Inicializar al cargar el documento
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializarModuloTerminos);
    } else {
        inicializarModuloTerminos();
    }
})();
