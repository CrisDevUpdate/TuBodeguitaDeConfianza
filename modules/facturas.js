/**
 * modules/facturas.js
 * MÓDULO DE INGRESO DE MERCANCÍA POR FACTURA Y ACTUALIZACIÓN AUTOMÁTICA DE COSTOS
 * 
 * Funcionalidades clave:
 * 1. Captura de datos de factura (N° Documento, Proveedor, Fecha, Política de Costos, Observaciones).
 * 2. Buscador en tiempo real de productos por código o nombre con sugerencias interactivas.
 * 3. Selección y visualización inmediata de Stock Actual y Costo Actual de Reposición.
 * 4. Ingreso de Cantidad Comprada y Nuevo Costo Facturado ($) con cálculo proyectado.
 * 5. Resumen interactivo de la factura con desglose de ítems, totales en USD y Bs.
 * 6. Procesamiento con suma automática al inventario físico, actualización del costo de reposición unitario
 *    y registro inmutable en el Kardex y en el historial de facturas.
 * 7. Sincronización transparente con Firestore y compatibilidad total con el POS y la Auditoría.
 */

window.InventoryApp = window.InventoryApp || {};

(function () {
    // Estado en memoria de la factura que se está elaborando
    const estadoFactura = {
        numero: '',
        proveedor: '',
        fecha: new Date().toISOString().substring(0, 10),
        tipoCosto: 'reposicion', // 'reposicion' (reemplazo directo) | 'promedio' (promedio ponderado)
        items: [],
        productoSeleccionado: null
    };

    /**
     * Valida de forma estricta que se haya ingresado el proveedor antes de agregar o seleccionar productos.
     * Si el proveedor es nuevo (no existe en la base de datos), lo acepta y lo registra automáticamente en Firebase.
     */
    function validarProveedorFactura(conAlerta = true) {
        const inputProv = document.getElementById('factura-proveedor');
        const proveedor = String(inputProv?.value || '').trim();
        if (!proveedor) {
            if (conAlerta) {
                if (typeof showCustomAlert === 'function') {
                    showCustomAlert('Proveedor Requerido', 'Por favor especifica el nombre o razón social del proveedor antes de agregar productos a la factura.', 'warning');
                } else {
                    alert('Por favor especifica primero el nombre o razón social del proveedor.');
                }
            }
            if (inputProv) {
                inputProv.style.borderColor = '#ef4444';
                inputProv.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.2)';
                inputProv.focus();
                inputProv.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return false;
        }

        if (inputProv) {
            inputProv.style.borderColor = '';
            inputProv.style.boxShadow = '';
        }

        estadoFactura.proveedor = proveedor;

        // Asegurar que quede registrado en Firestore Firebase en segundo plano sin interrumpir al usuario
        asegurarProveedorEnFirebase(proveedor);

        return true;
    }

    /**
     * Verifica si un proveedor existe en la base de datos de Firebase / AppState.
     * Si no existe, lo guarda de forma transparente en Firebase Firestore.
     */
    async function asegurarProveedorEnFirebase(nombreProveedor) {
        if (!nombreProveedor) return;
        const nombre = String(nombreProveedor).trim();
        if (nombre.length < 2) return;

        const existe = Array.isArray(AppState.proveedores) && AppState.proveedores.some(p => {
            const nom = typeof p === 'string' ? p : (p?.nombre || '');
            return nom.toLowerCase() === nombre.toLowerCase();
        });

        if (!existe) {
            try {
                if (window.InventoryApp?.Firebase?.guardarProveedor) {
                    await window.InventoryApp.Firebase.guardarProveedor({
                        nombre: nombre,
                        estado: 'ACTIVO',
                        notas: 'Registrado desde factura de compra'
                    });
                } else {
                    if (!Array.isArray(AppState.proveedores)) AppState.proveedores = [];
                    AppState.proveedores.push({ id: 'PROV-' + Date.now(), nombre: nombre, estado: 'ACTIVO' });
                    if (!Array.isArray(AppState.proveedoresFrecuentes)) AppState.proveedoresFrecuentes = [];
                    if (!AppState.proveedoresFrecuentes.includes(nombre)) AppState.proveedoresFrecuentes.push(nombre);
                    if (window.InventoryApp?.Persistence) window.InventoryApp.Persistence.guardar(true);
                }
                actualizarDatalistProveedores();
                console.info(`[Facturas] Proveedor "${nombre}" registrado con éxito en Firebase.`);
            } catch (e) {
                console.warn('[Facturas] Error al registrar proveedor en segundo plano:', e);
            }
        }
    }

    /**
     * Inicializa el módulo de facturas
     */
    function inicializarModuloFacturas() {
        const inputFecha = document.getElementById('factura-fecha');
        if (inputFecha && !inputFecha.value) {
            inputFecha.value = new Date().toISOString().substring(0, 10);
        }

        const inputNumero = document.getElementById('factura-numero');
        if (inputNumero && !inputNumero.value) {
            generarSiguienteNumeroFactura();
        }

        const inputProv = document.getElementById('factura-proveedor');
        if (inputProv && !inputProv._hasValidationListener) {
            inputProv._hasValidationListener = true;
            inputProv.addEventListener('input', () => {
                const val = inputProv.value.trim();
                estadoFactura.proveedor = val;
                if (val) {
                    inputProv.style.borderColor = '';
                    inputProv.style.boxShadow = '';
                }

                // Detector de proveedor nuevo
                const helper = document.getElementById('factura-proveedor-helper');
                if (helper) {
                    if (val.length >= 2) {
                        const existe = (AppState.proveedores || []).some(p => {
                            const nom = typeof p === 'string' ? p : (p?.nombre || '');
                            return nom.toLowerCase() === val.toLowerCase();
                        });
                        if (!existe) {
                            helper.style.display = 'flex';
                            const nombreSpan = document.getElementById('factura-helper-nombre-prov');
                            if (nombreSpan) nombreSpan.textContent = `"${val}"`;
                        } else {
                            helper.style.display = 'none';
                        }
                    } else {
                        helper.style.display = 'none';
                    }
                }
            });

            inputProv.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (validarProveedorFactura(true)) {
                        const searchInput = document.getElementById('factura-search-producto');
                        if (searchInput) searchInput.focus();
                    }
                }
            });
        }

        const inputSearch = document.getElementById('factura-search-producto');
        if (inputSearch && !inputSearch._hasValidationListener) {
            inputSearch._hasValidationListener = true;
            inputSearch.addEventListener('focus', () => {
                const currentProv = document.getElementById('factura-proveedor');
                if (currentProv && !currentProv.value.trim()) {
                    currentProv.style.borderColor = '#ef4444';
                    currentProv.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.15)';
                    if (typeof showCustomToast === 'function') {
                        showCustomToast('Recuerda colocar el Proveedor de la factura', 'warning');
                    }
                }
            });
            inputSearch.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!validarProveedorFactura(true)) {
                        return;
                    }
                    const q = inputSearch.value.trim().toLowerCase();
                    if (!q) return;
                    const prods = Array.isArray(productos) ? productos : (AppState.productos || []);
                    const exacto = prods.find(p => 
                        String(p.codigo || '').toLowerCase() === q || 
                        String(p.id || '').toLowerCase() === q ||
                        String(p.nombre || '').toLowerCase() === q
                    );
                    if (exacto) {
                        seleccionarProductoFactura(exacto.id);
                    }
                }
            });
        }

        const inputCant = document.getElementById('factura-item-cantidad');
        const inputCosto = document.getElementById('factura-item-costo');
        [inputCant, inputCosto].forEach(inp => {
            if (inp && !inp._hasEnterListener) {
                inp._hasEnterListener = true;
                inp.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        agregarItemAFactura();
                    }
                });
            }
        });

        actualizarDatalistProveedores();
        renderizarItemsFacturaActual();
        renderizarHistorialFacturas();
        renderizarKardex();
    }

    /**
     * Genera automáticamente el correlativo sugerido para la nueva factura
     */
    function generarSiguienteNumeroFactura() {
        const inputNumero = document.getElementById('factura-numero');
        if (!inputNumero) return;
        const lista = Array.isArray(AppState.facturasCompras) ? AppState.facturasCompras : [];
        const count = lista.length + 1;
        const sugerido = `FAC-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
        inputNumero.value = sugerido;
        estadoFactura.numero = sugerido;
    }

    /**
     * Actualiza el catálogo datalist de proveedores frecuentes y de Firestore
     */
    function actualizarDatalistProveedores() {
        const datalist = document.getElementById('lista-proveedores-datalist') || document.getElementById('factura-proveedores-datalist');
        if (!datalist) return;

        const proveedores = new Set();

        if (Array.isArray(AppState.proveedores)) {
            AppState.proveedores.forEach(p => {
                if (typeof p === 'string' && p.trim()) proveedores.add(p.trim());
                else if (p && p.nombre && p.nombre.trim()) proveedores.add(p.nombre.trim());
            });
        }
        if (Array.isArray(AppState.proveedoresFrecuentes)) {
            AppState.proveedoresFrecuentes.forEach(p => {
                if (typeof p === 'string' && p.trim()) proveedores.add(p.trim());
                else if (p && p.nombre && p.nombre.trim()) proveedores.add(p.nombre.trim());
            });
        }
        if (Array.isArray(AppState.facturasCompras)) {
            AppState.facturasCompras.forEach(f => {
                if (f && f.proveedor && f.proveedor.trim()) proveedores.add(f.proveedor.trim());
            });
        }

        datalist.innerHTML = Array.from(proveedores)
            .sort()
            .map(prov => `<option value="${prov}"></option>`)
            .join('');
    }

    /**
     * Modal interactivo para Registrar Nuevo Proveedor en Firebase con datos completos
     */
    function abrirModalRegistrarProveedor(nombreInicial = '') {
        const inputActual = document.getElementById('factura-proveedor');
        const valorActual = nombreInicial || (inputActual ? inputActual.value.trim() : '');

        let modal = document.getElementById('modal-registro-proveedor-cloud');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-registro-proveedor-cloud';
            modal.className = 'custom-modal-backdrop';
            modal.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.65); z-index:999999; display:flex; align-items:center; justify-content:center; padding:16px; backdrop-filter:blur(3px);';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div style="background:var(--card-bg, #ffffff); border-radius:14px; max-width:490px; width:100%; box-shadow:0 20px 25px -5px rgba(0,0,0,0.25), 0 8px 10px -6px rgba(0,0,0,0.15); border:1px solid var(--border-color, #e2e8f0); overflow:hidden; animation:modalPopIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
                <div style="background:linear-gradient(135deg, #1e3a8a, #2563eb); padding:16px 20px; color:#ffffff; display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:36px; height:36px; border-radius:10px; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:1.1rem;">
                            <i class="fas fa-truck-loading"></i>
                        </div>
                        <div>
                            <h3 style="margin:0; font-size:1.05rem; font-weight:700; color:#ffffff;">Registrar Proveedor</h3>
                            <p style="margin:2px 0 0 0; font-size:0.75rem; color:#bfdbfe;">Persistencia garantizada en Firebase Firestore</p>
                        </div>
                    </div>
                    <button type="button" onclick="cerrarModalRegistrarProveedor()" style="background:transparent; border:none; color:#ffffff; font-size:1.2rem; cursor:pointer; padding:4px 8px; border-radius:6px; opacity:0.85;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.85'">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <form id="form-registro-proveedor-cloud" onsubmit="guardarNuevoProveedorDesdeModal(event)" style="padding:20px; display:flex; flex-direction:column; gap:14px;">
                    <div>
                        <label style="display:block; font-size:0.8rem; font-weight:700; color:var(--text-color, #1e293b); margin-bottom:4px;">
                            Nombre o Razón Social <span style="color:#ef4444;">*</span>
                        </label>
                        <input type="text" id="modal-prov-nombre" required placeholder="Ej: Distribuidora Los Andes C.A." value="${valorActual}" style="width:100%; padding:9px 12px; border:1px solid var(--border-color, #cbd5e1); border-radius:8px; font-size:0.9rem; font-weight:600; background:var(--input-bg, #ffffff); color:var(--text-color, #0f172a);">
                    </div>

                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                        <div>
                            <label style="display:block; font-size:0.8rem; font-weight:700; color:var(--text-color, #1e293b); margin-bottom:4px;">
                                RIF / Identificación Fiscal
                            </label>
                            <input type="text" id="modal-prov-rif" placeholder="Ej: J-12345678-9" style="width:100%; padding:8px 12px; border:1px solid var(--border-color, #cbd5e1); border-radius:8px; font-size:0.85rem; background:var(--input-bg, #ffffff); color:var(--text-color, #0f172a);">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.8rem; font-weight:700; color:var(--text-color, #1e293b); margin-bottom:4px;">
                                Teléfono / WhatsApp
                            </label>
                            <input type="text" id="modal-prov-telefono" placeholder="Ej: 0414-1234567" style="width:100%; padding:8px 12px; border:1px solid var(--border-color, #cbd5e1); border-radius:8px; font-size:0.85rem; background:var(--input-bg, #ffffff); color:var(--text-color, #0f172a);">
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                        <div>
                            <label style="display:block; font-size:0.8rem; font-weight:700; color:var(--text-color, #1e293b); margin-bottom:4px;">
                                Persona de Contacto
                            </label>
                            <input type="text" id="modal-prov-contacto" placeholder="Ej: Juan Pérez (Vendedor)" style="width:100%; padding:8px 12px; border:1px solid var(--border-color, #cbd5e1); border-radius:8px; font-size:0.85rem; background:var(--input-bg, #ffffff); color:var(--text-color, #0f172a);">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.8rem; font-weight:700; color:var(--text-color, #1e293b); margin-bottom:4px;">
                                Ciudad / Ubicación
                            </label>
                            <input type="text" id="modal-prov-direccion" placeholder="Ej: Galpón 4, Valencia" style="width:100%; padding:8px 12px; border:1px solid var(--border-color, #cbd5e1); border-radius:8px; font-size:0.85rem; background:var(--input-bg, #ffffff); color:var(--text-color, #0f172a);">
                        </div>
                    </div>

                    <div>
                        <label style="display:block; font-size:0.8rem; font-weight:700; color:var(--text-color, #1e293b); margin-bottom:4px;">
                            Notas / Condiciones Comerciales (Opcional)
                        </label>
                        <input type="text" id="modal-prov-notas" placeholder="Ej: Despachos martes y viernes" style="width:100%; padding:8px 12px; border:1px solid var(--border-color, #cbd5e1); border-radius:8px; font-size:0.85rem; background:var(--input-bg, #ffffff); color:var(--text-color, #0f172a);">
                    </div>

                    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:8px; padding-top:12px; border-top:1px solid var(--border-color, #e2e8f0);">
                        <button type="button" onclick="cerrarModalRegistrarProveedor()" style="padding:9px 16px; border:1px solid var(--border-color, #cbd5e1); background:var(--card-bg, #ffffff); color:var(--text-muted, #64748b); border-radius:8px; font-weight:600; font-size:0.88rem; cursor:pointer;">
                            Cancelar
                        </button>
                        <button type="submit" id="btn-guardar-proveedor-submit" style="padding:9px 20px; background:#2563eb; color:#ffffff; border:none; border-radius:8px; font-weight:700; font-size:0.88rem; cursor:pointer; display:inline-flex; align-items:center; gap:8px; box-shadow:0 2px 4px rgba(37,99,235,0.25);">
                            <i class="fas fa-cloud-upload-alt"></i> Guardar en Firebase
                        </button>
                    </div>
                </form>
            </div>
        `;

        modal.style.display = 'flex';
        setTimeout(() => {
            const inputNom = document.getElementById('modal-prov-nombre');
            if (inputNom) inputNom.focus();
        }, 60);
    }

    /**
     * Procesa el formulario del modal y persiste el proveedor en Firebase
     */
    async function guardarNuevoProveedorDesdeModal(e) {
        if (e && e.preventDefault) e.preventDefault();
        const inputNombre = document.getElementById('modal-prov-nombre');
        const inputRif = document.getElementById('modal-prov-rif');
        const inputTel = document.getElementById('modal-prov-telefono');
        const inputContacto = document.getElementById('modal-prov-contacto');
        const inputDireccion = document.getElementById('modal-prov-direccion');
        const inputNotas = document.getElementById('modal-prov-notas');
        const btnSubmit = document.getElementById('btn-guardar-proveedor-submit');

        const nombre = String(inputNombre?.value || '').trim();
        if (!nombre) {
            if (typeof showCustomToast === 'function') {
                showCustomToast('Por favor escribe el nombre del proveedor', 'warning');
            } else {
                alert('El nombre del proveedor es obligatorio');
            }
            return;
        }

        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        }

        try {
            const provObj = {
                nombre: nombre,
                rif: String(inputRif?.value || '').trim(),
                telefono: String(inputTel?.value || '').trim(),
                contacto: String(inputContacto?.value || '').trim(),
                direccion: String(inputDireccion?.value || '').trim(),
                notas: String(inputNotas?.value || '').trim(),
                estado: 'ACTIVO'
            };

            if (window.InventoryApp?.Firebase?.guardarProveedor) {
                await window.InventoryApp.Firebase.guardarProveedor(provObj);
            } else {
                if (!Array.isArray(AppState.proveedores)) AppState.proveedores = [];
                AppState.proveedores.push({ id: 'PROV-' + Date.now(), ...provObj });
                if (!Array.isArray(AppState.proveedoresFrecuentes)) AppState.proveedoresFrecuentes = [];
                AppState.proveedoresFrecuentes.push(nombre);
                if (window.InventoryApp?.Persistence) window.InventoryApp.Persistence.guardar(true);
            }

            actualizarDatalistProveedores();

            // Asignar al input de la factura
            const inputProv = document.getElementById('factura-proveedor');
            if (inputProv) {
                inputProv.value = nombre;
                inputProv.style.borderColor = '#16a34a';
                inputProv.style.boxShadow = '0 0 0 3px rgba(22, 163, 74, 0.15)';
                setTimeout(() => {
                    inputProv.style.borderColor = '';
                    inputProv.style.boxShadow = '';
                }, 1500);
            }
            estadoFactura.proveedor = nombre;

            const helper = document.getElementById('factura-proveedor-helper');
            if (helper) helper.style.display = 'none';

            cerrarModalRegistrarProveedor();

            if (typeof showCustomToast === 'function') {
                showCustomToast(`Proveedor "${nombre}" registrado exitosamente en Firebase`, 'success');
            } else if (typeof showCustomAlert === 'function') {
                showCustomAlert('Proveedor Registrado', `"${nombre}" ha sido registrado en Firebase y asignado a la factura.`, 'success');
            }
        } catch (err) {
            console.error('[Facturas] Error guardando proveedor:', err);
            if (typeof showCustomToast === 'function') {
                showCustomToast('Error al conectar con Firebase, proveedor guardado localmente', 'warning');
            }
            cerrarModalRegistrarProveedor();
        }
    }

    function cerrarModalRegistrarProveedor() {
        const modal = document.getElementById('modal-registro-proveedor-cloud');
        if (modal) modal.style.display = 'none';
    }

    /**
     * Registro rápido con 1 clic desde el aviso interactivo en la factura
     */
    async function guardarProveedorRapidoDesdeInput() {
        const inputProv = document.getElementById('factura-proveedor');
        const nombre = String(inputProv?.value || '').trim();
        if (!nombre) return;

        if (window.InventoryApp?.Firebase?.guardarProveedor) {
            await window.InventoryApp.Firebase.guardarProveedor({ nombre: nombre, estado: 'ACTIVO' });
        }
        actualizarDatalistProveedores();
        const helper = document.getElementById('factura-proveedor-helper');
        if (helper) helper.style.display = 'none';
        if (typeof showCustomToast === 'function') {
            showCustomToast(`"${nombre}" registrado en Firebase`, 'success');
        }
    }

    /**
     * Abre el modal del Directorio de Proveedores Registrados en Firebase
     */
    function abrirDirectorioProveedores() {
        let modal = document.getElementById('modal-directorio-proveedores-cloud');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-directorio-proveedores-cloud';
            modal.className = 'custom-modal-backdrop';
            modal.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.65); z-index:999999; display:flex; align-items:center; justify-content:center; padding:16px; backdrop-filter:blur(3px);';
            document.body.appendChild(modal);
        }

        const proveedores = Array.isArray(AppState.proveedores) ? AppState.proveedores : [];

        modal.innerHTML = `
            <div style="background:var(--card-bg, #ffffff); border-radius:14px; max-width:620px; width:100%; max-height:85vh; display:flex; flex-direction:column; box-shadow:0 20px 25px -5px rgba(0,0,0,0.25); border:1px solid var(--border-color, #e2e8f0); overflow:hidden;">
                <div style="background:linear-gradient(135deg, #1e293b, #334155); padding:16px 20px; color:#ffffff; display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:36px; height:36px; border-radius:10px; background:rgba(255,255,255,0.15); display:flex; align-items:center; justify-content:center; font-size:1.1rem;">
                            <i class="fas fa-address-book"></i>
                        </div>
                        <div>
                            <h3 style="margin:0; font-size:1.05rem; font-weight:700; color:#ffffff;">Directorio de Proveedores</h3>
                            <p style="margin:2px 0 0 0; font-size:0.75rem; color:#cbd5e1;">${proveedores.length} proveedores registrados en Firebase</p>
                        </div>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button type="button" onclick="cerrarDirectorioProveedores(); abrirModalRegistrarProveedor();" style="background:#2563eb; color:#ffffff; border:none; padding:6px 12px; border-radius:6px; font-size:0.8rem; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
                            <i class="fas fa-plus"></i> Nuevo
                        </button>
                        <button type="button" onclick="cerrarDirectorioProveedores()" style="background:transparent; border:none; color:#ffffff; font-size:1.2rem; cursor:pointer; padding:4px 8px; border-radius:6px; opacity:0.85;">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>

                <div style="padding:12px 18px; border-bottom:1px solid var(--border-color, #e2e8f0); background:var(--bg-light, #f8fafc);">
                    <input type="text" id="filtro-directorio-proveedores" oninput="filtrarDirectorioProveedores(this.value)" placeholder="Buscar proveedor por nombre, RIF o teléfono..." style="width:100%; padding:8px 12px; border:1px solid var(--border-color, #cbd5e1); border-radius:8px; font-size:0.88rem; background:var(--input-bg, #ffffff); color:var(--text-color);">
                </div>

                <div id="lista-directorio-proveedores" style="padding:12px 18px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:8px;">
                    ${renderizarFilasDirectorio(proveedores)}
                </div>
            </div>
        `;

        modal.style.display = 'flex';
    }

    function renderizarFilasDirectorio(lista) {
        if (!lista || lista.length === 0) {
            return `
                <div style="text-align:center; padding:30px 10px; color:var(--text-muted);">
                    <i class="fas fa-truck-moving" style="font-size:2rem; opacity:0.4; margin-bottom:10px;"></i>
                    <p style="margin:0; font-size:0.9rem;">No hay proveedores registrados aún.</p>
                </div>
            `;
        }

        return lista.map(p => {
            const nom = p.nombre || 'Sin nombre';
            const rif = p.rif ? `RIF: ${p.rif}` : '';
            const tel = p.telefono ? `Tel: ${p.telefono}` : '';
            const contacto = p.contacto ? `Contacto: ${p.contacto}` : '';
            const sub = [rif, tel, contacto].filter(Boolean).join(' · ');

            return `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:var(--card-bg, #ffffff); border:1px solid var(--border-color, #e2e8f0); border-radius:8px; transition:border-color 0.15s ease;">
                    <div style="min-width:0;">
                        <div style="font-weight:700; font-size:0.92rem; color:var(--text-color);">${nom}</div>
                        ${sub ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">${sub}</div>` : ''}
                    </div>
                    <button type="button" onclick="seleccionarProveedorDesdeDirectorio('${nom.replace(/'/g, "\\'")}')" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; border-radius:6px; padding:6px 12px; font-size:0.8rem; font-weight:700; cursor:pointer; white-space:nowrap; transition:all 0.15s ease;">
                        Seleccionar
                    </button>
                </div>
            `;
        }).join('');
    }

    function filtrarDirectorioProveedores(q) {
        const query = String(q || '').toLowerCase().trim();
        const listaEl = document.getElementById('lista-directorio-proveedores');
        if (!listaEl) return;
        const provs = Array.isArray(AppState.proveedores) ? AppState.proveedores : [];
        const filtrados = provs.filter(p => {
            const n = String(p.nombre || '').toLowerCase();
            const r = String(p.rif || '').toLowerCase();
            const t = String(p.telefono || '').toLowerCase();
            const c = String(p.contacto || '').toLowerCase();
            return n.includes(query) || r.includes(query) || t.includes(query) || c.includes(query);
        });
        listaEl.innerHTML = renderizarFilasDirectorio(filtrados);
    }

    function seleccionarProveedorDesdeDirectorio(nombre) {
        const inputProv = document.getElementById('factura-proveedor');
        if (inputProv) {
            inputProv.value = nombre;
            inputProv.style.borderColor = '#16a34a';
            inputProv.style.boxShadow = '0 0 0 3px rgba(22, 163, 74, 0.15)';
            setTimeout(() => {
                inputProv.style.borderColor = '';
                inputProv.style.boxShadow = '';
            }, 1200);
        }
        estadoFactura.proveedor = nombre;
        const helper = document.getElementById('factura-proveedor-helper');
        if (helper) helper.style.display = 'none';
        cerrarDirectorioProveedores();
        if (typeof showCustomToast === 'function') {
            showCustomToast(`Proveedor "${nombre}" seleccionado`, 'info');
        }
    }

    function cerrarDirectorioProveedores() {
        const modal = document.getElementById('modal-directorio-proveedores-cloud');
        if (modal) modal.style.display = 'none';
    }

    /**
     * Búsqueda reactiva de productos por código o nombre
     */
    function buscarProductosFactura(query) {
        const dropdown = document.getElementById('factura-search-dropdown');
        if (!dropdown) return;

        const q = String(query || '').trim().toLowerCase();
        if (!q) {
            dropdown.style.display = 'none';
            dropdown.innerHTML = '';
            return;
        }

        const prods = Array.isArray(productos) ? productos : (AppState.productos || []);
        const resultados = prods.filter(p => {
            const nom = String(p.nombre || '').toLowerCase();
            const cod = String(p.codigo || '').toLowerCase();
            const id = String(p.id || '').toLowerCase();
            return nom.includes(q) || cod.includes(q) || id.includes(q);
        }).slice(0, 10);

        if (resultados.length === 0) {
            dropdown.innerHTML = `
                <div style="padding:14px; text-align:center; color:var(--text-muted); font-size:0.88rem;">
                    <i class="fas fa-box-open" style="margin-right:6px; opacity:0.5;"></i> No se encontraron productos coincidentes con "<strong>${q}</strong>"
                </div>
            `;
            dropdown.style.display = 'block';
            return;
        }

        dropdown.innerHTML = resultados.map(p => {
            const imgUrl = p.imagen || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=120&auto=format&fit=crop&q=60';
            const stock = Number(p.stock || 0);
            const costo = Number(p.costo || 0).toFixed(2);
            const precio = Number(p.precio || 0).toFixed(2);

            return `
                <div class="factura-search-item" onclick="seleccionarProductoFactura('${p.id}')" style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-bottom:1px solid var(--border-color, #e2e8f0); cursor:pointer; gap:12px; transition:background 0.15s ease;">
                    <div style="display:flex; align-items:center; gap:12px; min-width:0;">
                        <img src="${imgUrl}" alt="${p.nombre}" style="width:40px; height:40px; object-fit:cover; border-radius:8px; border:1px solid rgba(0,0,0,0.08); flex-shrink:0;">
                        <div style="min-width:0;">
                            <div style="font-weight:700; font-size:0.92rem; color:var(--text-color); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.nombre}</div>
                            <div style="font-size:0.75rem; color:var(--text-muted); display:flex; gap:8px; align-items:center; margin-top:2px;">
                                <span class="badge" style="background:#eff6ff; color:#1d4ed8; padding:2px 6px; border-radius:4px; font-weight:700;">${p.codigo || p.id}</span>
                                <span>${p.categoria || 'General'}</span>
                            </div>
                        </div>
                    </div>
                    <div style="text-align:right; flex-shrink:0;">
                        <div style="font-size:0.8rem; color:${stock > 0 ? '#16a34a' : '#dc2626'}; font-weight:700;">
                            Stock: ${stock} unds
                        </div>
                        <div style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">
                            Costo: <strong>$${costo}</strong> · PVP: <strong>$${precio}</strong>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        dropdown.style.display = 'block';
    }

    // Alias para el evento inline de index.html
    function alBuscarProductoFactura(query) {
        buscarProductosFactura(query);
    }

    /**
     * Oculta el dropdown de resultados
     */
    function ocultarDropdownBusquedaFactura() {
        setTimeout(() => {
            const dropdown = document.getElementById('factura-search-dropdown');
            if (dropdown) dropdown.style.display = 'none';
        }, 250);
    }

    /**
     * Selecciona un producto para cargar en la tarjeta de detalles
     */
    function seleccionarProductoFactura(productoId) {
        // Validación estricta previa: No permitir seleccionar ni preparar producto si no se ha colocado el proveedor
        if (!validarProveedorFactura(true)) {
            return;
        }

        const prods = Array.isArray(productos) ? productos : (AppState.productos || []);
        const p = prods.find(prod => prod.id === productoId);
        if (!p) return;

        estadoFactura.productoSeleccionado = p;

        const dropdown = document.getElementById('factura-search-dropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
            dropdown.innerHTML = '';
        }

        const searchInput = document.getElementById('factura-search-producto');
        if (searchInput) searchInput.value = p.nombre;

        // Mostrar panel del producto seleccionado
        const cardSelected = document.getElementById('factura-producto-card-selected');
        if (cardSelected) {
            cardSelected.style.display = 'block';
        }

        // Poblar datos del producto
        const imgEl = document.getElementById('factura-preview-img') || document.getElementById('factura-prod-img');
        if (imgEl) imgEl.src = p.imagen || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=150&auto=format&fit=crop&q=60';

        const nombreEl = document.getElementById('factura-preview-nombre') || document.getElementById('factura-prod-nombre');
        if (nombreEl) nombreEl.textContent = p.nombre;

        const codEl = document.getElementById('factura-preview-codigo') || document.getElementById('factura-prod-id');
        if (codEl) codEl.textContent = p.codigo || p.id;

        const precioEl = document.getElementById('factura-preview-precio') || document.getElementById('factura-prod-precio-actual');
        if (precioEl) precioEl.textContent = `$${Number(p.precio || 0).toFixed(2)}`;

        const stockEl = document.getElementById('factura-preview-stock') || document.getElementById('factura-prod-stock-actual');
        if (stockEl) stockEl.textContent = `${Number(p.stock || 0)} unds`;

        const costoEl = document.getElementById('factura-preview-costo') || document.getElementById('factura-prod-costo-actual');
        if (costoEl) costoEl.textContent = `$${Number(p.costo || 0).toFixed(2)}`;

        // Valores por defecto para la línea de compra
        const inputCant = document.getElementById('factura-item-cantidad');
        if (inputCant) {
            inputCant.value = '1';
        }

        const inputCosto = document.getElementById('factura-item-costo');
        if (inputCosto) {
            // Sugiere el costo actual para rápida edición
            inputCosto.value = Number(p.costo || 0).toFixed(2);
        }

        actualizarCalculosItemFactura();

        if (inputCant) {
            inputCant.focus();
            inputCant.select();
        }
    }

    /**
     * Limpia la selección activa del buscador
     */
    function deseleccionarProductoFactura() {
        estadoFactura.productoSeleccionado = null;
        const cardSelected = document.getElementById('factura-producto-card-selected');
        if (cardSelected) cardSelected.style.display = 'none';

        const searchInput = document.getElementById('factura-search-producto');
        if (searchInput) {
            searchInput.value = '';
            searchInput.focus();
        }

        const dropdown = document.getElementById('factura-search-dropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
            dropdown.innerHTML = '';
        }
    }

    function limpiarBuscadorProductoFactura() {
        deseleccionarProductoFactura();
    }

    /**
     * Calcula en vivo la proyección: nuevo stock, costo unitario resultante y subtotales
     */
    function actualizarCalculosItemFactura() {
        const p = estadoFactura.productoSeleccionado;
        if (!p) return;

        const inputCant = document.getElementById('factura-item-cantidad');
        const inputCosto = document.getElementById('factura-item-costo');
        const selectTipoCosto = document.getElementById('factura-tipo-costo');

        const cant = Math.max(1, parseInt(inputCant?.value, 10) || 1);
        const nuevoCostoFacturado = Math.max(0, parseFloat(inputCosto?.value) || 0);
        const tipoCosto = selectTipoCosto ? selectTipoCosto.value : 'reposicion';

        const stockActual = Math.max(0, Number(p.stock || 0));
        const costoActual = Math.max(0, Number(p.costo || 0));

        const nuevoStock = stockActual + cant;
        const subtotal = cant * nuevoCostoFacturado;

        let costoResultante = nuevoCostoFacturado;
        if (tipoCosto === 'promedio' && stockActual > 0) {
            costoResultante = ((stockActual * costoActual) + (cant * nuevoCostoFacturado)) / nuevoStock;
        }

        const difCosto = costoResultante - costoActual;
        const pctCosto = costoActual > 0 ? ((difCosto / costoActual) * 100) : 0;

        // Visualización de Stock Proyectado
        const elNuevoStock = document.getElementById('factura-preview-nuevo-stock');
        if (elNuevoStock) {
            elNuevoStock.innerHTML = `<strong>${nuevoStock}</strong> unds <span style="color:#16a34a; font-size:0.8rem; font-weight:700;">(+${cant})</span>`;
        }

        // Visualización de Nuevo Costo Proyectado
        const elNuevoCosto = document.getElementById('factura-preview-nuevo-costo');
        if (elNuevoCosto) {
            elNuevoCosto.innerHTML = `<strong>$${costoResultante.toFixed(2)}</strong>`;
        }

        // Visualización de Variación
        const elVariacion = document.getElementById('factura-preview-variacion');
        if (elVariacion) {
            elVariacion.style.display = 'inline-block';
            if (difCosto > 0) {
                elVariacion.style.background = '#fee2e2';
                elVariacion.style.color = '#dc2626';
                elVariacion.innerHTML = `<i class="fas fa-arrow-trend-up"></i> +$${difCosto.toFixed(2)} (+${pctCosto.toFixed(1)}%)`;
            } else if (difCosto < 0) {
                elVariacion.style.background = '#dcfce7';
                elVariacion.style.color = '#15803d';
                elVariacion.innerHTML = `<i class="fas fa-arrow-trend-down"></i> -$${Math.abs(difCosto).toFixed(2)} (${pctCosto.toFixed(1)}%)`;
            } else {
                elVariacion.style.background = '#f1f5f9';
                elVariacion.style.color = '#64748b';
                elVariacion.textContent = 'Sin variación';
            }
        }

        // Subtotal de la línea en USD y Bs
        const elSubtotal = document.getElementById('factura-preview-subtotal');
        const elSubtotalBs = document.getElementById('factura-preview-subtotal-bs');
        const tasa = Number(AppState.tasaUSD_BCV || 0);
        const ves = subtotal * tasa;

        if (elSubtotal) elSubtotal.textContent = `$${subtotal.toFixed(2)}`;
        if (elSubtotalBs) elSubtotalBs.textContent = `(Bs ${ves.toFixed(2)})`;
    }

    function alCambiarInputsFacturaItem() {
        actualizarCalculosItemFactura();
    }

    /**
     * Agrega el producto seleccionado a la tabla de ítems de la factura
     */
    function agregarItemAFactura() {
        // Validación estricta previa: El proveedor es requerido antes de agregar productos a la factura
        if (!validarProveedorFactura(true)) {
            return;
        }

        const p = estadoFactura.productoSeleccionado;
        if (!p) {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Selección Requerida', 'Por favor busca y selecciona un producto primero.', 'warning');
            } else {
                alert('Selecciona un producto primero.');
            }
            return;
        }

        const inputCant = document.getElementById('factura-item-cantidad');
        const inputCosto = document.getElementById('factura-item-costo');
        const selectTipoCosto = document.getElementById('factura-tipo-costo');

        const cantidad = Math.max(1, parseInt(inputCant?.value, 10) || 1);
        const nuevoCosto = Math.max(0, parseFloat(inputCosto?.value) || 0);
        const tipoCosto = selectTipoCosto ? selectTipoCosto.value : 'reposicion';

        if (nuevoCosto <= 0) {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Costo Inválido', 'El nuevo costo unitario facturado debe ser mayor a 0.', 'warning');
            } else {
                alert('El costo unitario facturado debe ser mayor a 0.');
            }
            if (inputCosto) inputCosto.focus();
            return;
        }

        const stockAnterior = Math.max(0, Number(p.stock || 0));
        const costoAnterior = Math.max(0, Number(p.costo || 0));
        const nuevoStock = stockAnterior + cantidad;

        let costoFinal = nuevoCosto;
        if (tipoCosto === 'promedio' && stockAnterior > 0) {
            costoFinal = Number((((stockAnterior * costoAnterior) + (cantidad * nuevoCosto)) / nuevoStock).toFixed(2));
        }

        const subtotalUSD = Number((cantidad * nuevoCosto).toFixed(2));

        // Comprobar si el producto ya está en la factura para consolidarlo
        const idx = estadoFactura.items.findIndex(item => item.productoId === p.id);
        if (idx >= 0) {
            estadoFactura.items[idx].cantidad += cantidad;
            estadoFactura.items[idx].nuevoStock = stockAnterior + estadoFactura.items[idx].cantidad;
            estadoFactura.items[idx].nuevoCosto = nuevoCosto;
            estadoFactura.items[idx].costoFinal = costoFinal;
            estadoFactura.items[idx].subtotalUSD = Number((estadoFactura.items[idx].cantidad * nuevoCosto).toFixed(2));
        } else {
            estadoFactura.items.push({
                productoId: p.id,
                codigo: p.codigo || p.id,
                nombre: p.nombre,
                imagen: p.imagen || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&auto=format&fit=crop&q=60',
                categoria: p.categoria || 'General',
                stockAnterior: stockAnterior,
                cantidad: cantidad,
                nuevoStock: nuevoStock,
                costoAnterior: costoAnterior,
                nuevoCosto: nuevoCosto,
                costoFinal: costoFinal,
                precioVenta: Number(p.precio || 0),
                subtotalUSD: subtotalUSD
            });
        }

        deseleccionarProductoFactura();
        renderizarItemsFacturaActual();

        if (typeof showCustomToast === 'function') {
            showCustomToast(`"${p.nombre}" agregado (+${cantidad} unds a $${nuevoCosto.toFixed(2)})`, 'success');
        }
    }

    /**
     * Remueve un ítem de la factura en preparación
     */
    function eliminarItemFactura(index) {
        if (index >= 0 && index < estadoFactura.items.length) {
            const eliminado = estadoFactura.items.splice(index, 1)[0];
            renderizarItemsFacturaActual();
            if (typeof showCustomToast === 'function') {
                showCustomToast(`"${eliminado.nombre}" removido de la factura.`, 'info');
            }
        }
    }

    /**
     * Vacía todos los ítems cargados en la factura
     */
    function limpiarItemsFactura() {
        if (estadoFactura.items.length === 0) return;
        estadoFactura.items = [];
        renderizarItemsFacturaActual();
        if (typeof showCustomToast === 'function') {
            showCustomToast('Se han vaciado los ítems de la factura.', 'info');
        }
    }

    /**
     * Reinicia por completo el formulario para una nueva factura
     */
    function limpiarFormularioFactura() {
        estadoFactura.items = [];
        estadoFactura.productoSeleccionado = null;

        const inputProv = document.getElementById('factura-proveedor');
        const inputNotas = document.getElementById('factura-notas');
        const inputFecha = document.getElementById('factura-fecha');

        if (inputProv) inputProv.value = '';
        if (inputNotas) inputNotas.value = '';
        if (inputFecha) inputFecha.value = new Date().toISOString().substring(0, 10);

        deseleccionarProductoFactura();
        generarSiguienteNumeroFactura();
        renderizarItemsFacturaActual();

        if (typeof showCustomToast === 'function') {
            showCustomToast('Formulario de factura listo para nuevo registro.', 'info');
        }
    }

    /**
     * Renderiza la tabla y lista móvil de ítems de la factura actual
     */
    function renderizarItemsFacturaActual() {
        const tbody = document.getElementById('factura-items-body') || document.getElementById('factura-items-tbody');
        const mobileContainer = document.getElementById('factura-items-mobile') || document.getElementById('factura-items-mobile-list');
        const btnProcesar = document.getElementById('btn-procesar-factura');

        const items = estadoFactura.items;
        const hayItems = items.length > 0;

        if (btnProcesar) {
            btnProcesar.disabled = !hayItems;
        }

        let totalUnidades = 0;
        let totalUSD = 0;

        items.forEach(item => {
            totalUnidades += item.cantidad;
            totalUSD += item.subtotalUSD;
        });

        const tasa = Number(AppState.tasaUSD_BCV || 0);
        const totalVES = totalUSD * tasa;

        // Renderizado en Desktop (Tabla 6 columnas)
        if (tbody) {
            if (!hayItems) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align:center; color:var(--text-muted); padding:36px;">
                            <i class="fas fa-box-open" style="font-size:2rem; display:block; margin-bottom:8px; opacity:0.4;"></i>
                            Aún no has agregado productos a esta factura.<br>
                            <span style="font-size:0.8rem;">Utiliza el buscador de la izquierda para seleccionar productos.</span>
                        </td>
                    </tr>
                `;
            } else {
                tbody.innerHTML = items.map((item, idx) => {
                    const difCosto = item.nuevoCosto - item.costoAnterior;
                    let difBadge = '<span style="color:var(--text-muted); font-size:0.75rem;">(Igual)</span>';
                    if (difCosto > 0) {
                        difBadge = `<span style="color:#dc2626; font-size:0.75rem; font-weight:700;">(+$${difCosto.toFixed(2)})</span>`;
                    } else if (difCosto < 0) {
                        difBadge = `<span style="color:#16a34a; font-size:0.75rem; font-weight:700;">(-$${Math.abs(difCosto).toFixed(2)})</span>`;
                    }

                    return `
                        <tr>
                            <td>
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <img src="${item.imagen}" alt="${item.nombre}" style="width:36px; height:36px; object-fit:cover; border-radius:6px; border:1px solid rgba(0,0,0,0.08);">
                                    <div>
                                        <div style="font-weight:700; font-size:0.9rem; color:var(--text-color);">${item.nombre}</div>
                                        <div style="font-size:0.75rem; color:var(--text-muted);">${item.codigo}</div>
                                    </div>
                                </div>
                            </td>
                            <td class="text-center font-weight-bold" style="color:#2563eb; font-size:0.95rem;">
                                +${item.cantidad}
                            </td>
                            <td class="text-right" style="color:var(--text-muted); font-size:0.85rem;">
                                $${item.costoAnterior.toFixed(2)}
                            </td>
                            <td class="text-right">
                                <span style="font-weight:800; color:var(--text-color); font-size:0.95rem;">$${item.nuevoCosto.toFixed(2)}</span>
                                <br>${difBadge}
                            </td>
                            <td class="text-right" style="font-weight:800; color:#16a34a; font-size:0.95rem;">
                                $${item.subtotalUSD.toFixed(2)}
                            </td>
                            <td class="text-center">
                                <button type="button" class="btn btn-outline btn-sm" onclick="eliminarItemFactura(${idx})" title="Quitar ítem" style="color:#ef4444; border-color:#fca5a5; padding:4px 8px; border-radius:6px; cursor:pointer;">
                                    <i class="fas fa-trash-can"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }

        // Renderizado Móvil
        if (mobileContainer) {
            if (!hayItems) {
                mobileContainer.innerHTML = '';
            } else {
                mobileContainer.innerHTML = items.map((item, idx) => {
                    const difCosto = item.nuevoCosto - item.costoAnterior;
                    let difBadge = '<span style="color:var(--text-muted); font-size:0.75rem;">(Igual)</span>';
                    if (difCosto > 0) {
                        difBadge = `<span style="color:#dc2626; font-size:0.75rem; font-weight:700;">(+$${difCosto.toFixed(2)})</span>`;
                    } else if (difCosto < 0) {
                        difBadge = `<span style="color:#16a34a; font-size:0.75rem; font-weight:700;">(-$${Math.abs(difCosto).toFixed(2)})</span>`;
                    }

                    return `
                        <div class="factura-mobile-row-card" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:12px; margin-bottom:10px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <img src="${item.imagen}" alt="${item.nombre}" style="width:40px; height:40px; object-fit:cover; border-radius:8px;">
                                    <div>
                                        <div style="font-weight:700; font-size:0.9rem; color:var(--text-color);">${item.nombre}</div>
                                        <span class="badge" style="background:#f1f5f9; color:#475569; font-size:0.7rem;">${item.codigo}</span>
                                    </div>
                                </div>
                                <button type="button" class="btn btn-sm" onclick="eliminarItemFactura(${idx})" style="background:#fee2e2; color:#b91c1c; border:none; border-radius:8px; padding:6px 10px; cursor:pointer;">
                                    <i class="fas fa-trash-can"></i>
                                </button>
                            </div>
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px; padding-top:10px; border-top:1px solid #f1f5f9; font-size:0.82rem;">
                                <div>
                                    <span style="color:var(--text-muted);">Cantidad:</span> <strong style="color:#2563eb;">+${item.cantidad}</strong>
                                    <br>
                                    <span style="color:var(--text-muted);">Stock Final:</span> <strong>${item.nuevoStock} unds</strong>
                                </div>
                                <div style="text-align:right;">
                                    <span style="color:var(--text-muted);">Nuevo Costo:</span> <strong>$${item.nuevoCosto.toFixed(2)}</strong> ${difBadge}
                                    <br>
                                    <span style="color:var(--text-muted);">Subtotal:</span> <strong style="color:#16a34a; font-size:0.95rem;">$${item.subtotalUSD.toFixed(2)}</strong>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        // Actualizar Resumen
        const elResumenItems = document.getElementById('factura-resumen-items') || document.getElementById('factura-total-items-badge');
        if (elResumenItems) elResumenItems.textContent = `${items.length}`;

        const elResumenUnidades = document.getElementById('factura-resumen-unidades') || document.getElementById('factura-total-unidades-badge');
        if (elResumenUnidades) elResumenUnidades.textContent = `${totalUnidades} unds`;

        const elResumenTotalUSD = document.getElementById('factura-resumen-total-usd') || document.getElementById('factura-total-usd-display');
        if (elResumenTotalUSD) elResumenTotalUSD.textContent = `$${totalUSD.toFixed(2)}`;

        const elResumenTotalBS = document.getElementById('factura-resumen-total-bs') || document.getElementById('factura-total-ves-display');
        if (elResumenTotalBS) elResumenTotalBS.textContent = `(Bs ${totalVES.toFixed(2)})`;
    }

    /**
     * PROCESA LA FACTURA DE COMPRA:
     * - Suma automáticamente el stock ingresado al inventario disponible.
     * - Actualiza de inmediato el costo unitario de reposición.
     * - Registra en el Kardex y en el historial inmutable de facturas.
     * - Sincroniza con Firestore.
     */
    async function procesarFacturaCompra() {
        const inputNumero = document.getElementById('factura-numero');
        const inputProveedor = document.getElementById('factura-proveedor');
        const inputFecha = document.getElementById('factura-fecha');
        const selectTipoCosto = document.getElementById('factura-tipo-costo');
        const inputNotas = document.getElementById('factura-notas');

        const numero = String(inputNumero?.value || '').trim().toUpperCase();
        const proveedor = String(inputProveedor?.value || '').trim();
        const fecha = String(inputFecha?.value || new Date().toISOString().substring(0, 10)).trim();
        const tipoCosto = selectTipoCosto ? selectTipoCosto.value : 'reposicion';
        const notas = String(inputNotas?.value || '').trim();

        if (!numero) {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('N° de Factura Requerido', 'Por favor ingresa el número de factura de compra.', 'warning');
            } else {
                alert('Ingresa el número de factura.');
            }
            if (inputNumero) inputNumero.focus();
            return;
        }

        if (!proveedor) {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Proveedor Requerido', 'Por favor especifica el nombre o razón social del proveedor.', 'warning');
            } else {
                alert('Especifica el proveedor.');
            }
            if (inputProveedor) inputProveedor.focus();
            return;
        }

        // Si el usuario configuró un producto pero olvidó presionar "Agregar a la factura", lo sumamos
        if (estadoFactura.items.length === 0 && estadoFactura.productoSeleccionado) {
            agregarItemAFactura();
        }

        if (estadoFactura.items.length === 0) {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Sin Productos', 'Agrega al menos un producto a la factura antes de procesarla.', 'warning');
            } else {
                alert('Agrega al menos un producto a la factura.');
            }
            return;
        }

        let totalUnidades = 0;
        let totalUSD = 0;
        estadoFactura.items.forEach(i => {
            totalUnidades += i.cantidad;
            totalUSD += i.subtotalUSD;
        });

        const tasa = Number(AppState.tasaUSD_BCV || 0);
        const totalVES = totalUSD * tasa;

        const resumenHtml = `
            <div style="text-align:left; font-size:0.9rem; line-height:1.5;">
                <p style="margin:0 0 10px 0;">¿Confirmar el ingreso de la factura <strong>${numero}</strong> del proveedor <strong>${proveedor}</strong>?</p>
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 12px; margin-bottom:12px; font-size:0.85rem;">
                    <div>• <strong>Ítems distintos:</strong> ${estadoFactura.items.length}</div>
                    <div>• <strong>Unidades a sumar al stock:</strong> +${totalUnidades} unds</div>
                    <div>• <strong>Monto total de compra:</strong> $${totalUSD.toFixed(2)} USD (Bs ${totalVES.toFixed(2)})</div>
                    <div>• <strong>Política de costos:</strong> ${tipoCosto === 'promedio' ? 'Costo Promedio Ponderado' : 'Costo de Reposición (Reemplazo Inmediato)'}</div>
                </div>
                <p style="margin:0; font-size:0.8rem; color:#0369a1;">
                    <i class="fas fa-info-circle"></i> <em>Los stocks y costos se actualizarán automáticamente en todo el sistema.</em>
                </p>
            </div>
        `;

        let confirmado = false;
        if (typeof showCustomConfirm === 'function') {
            confirmado = await showCustomConfirm('Ingreso de Factura & Control de Costos', resumenHtml, 'info');
        } else {
            confirmado = confirm(`¿Confirmar ingreso de factura ${numero} por $${totalUSD.toFixed(2)}?`);
        }

        if (!confirmado) return;

        const btnProcesar = document.getElementById('btn-procesar-factura');
        if (btnProcesar) {
            btnProcesar.disabled = true;
            btnProcesar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
        }

        const usuarioNombre = AppState.usuarioActual?.nombre || AppState.usuarioActual?.id || 'SuperAdmin';
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);

        // 1. Actualizar stock y costo de cada producto
        const prods = Array.isArray(productos) ? productos : (AppState.productos || []);
        const productosAfectados = [];
        const itemsKardex = [];

        estadoFactura.items.forEach(item => {
            const p = prods.find(prod => prod.id === item.productoId);
            if (p) {
                const stockAnterior = Math.max(0, Number(p.stock || 0));
                const costoAnterior = Math.max(0, Number(p.costo || 0));

                if (window.InventoryApp?.StockService?.ingresoFactura) {
                    window.InventoryApp.StockService.ingresoFactura(p.id, item.cantidad, item.nuevoCosto, tipoCosto);
                } else {
                    p.stock = stockAnterior + item.cantidad;
                    p.costo = item.costoFinal || item.nuevoCosto;
                    if (p.precio && p.costo > 0) {
                        p.ganancia = Number((((p.precio - p.costo) / p.costo) * 100).toFixed(2));
                    }
                }

                productosAfectados.push(p);

                itemsKardex.push({
                    id: 'KDX-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
                    fecha: timestamp,
                    tipo: 'COMPRA_FACTURA',
                    facturaNumero: numero,
                    proveedor: proveedor,
                    productoId: p.id,
                    codigo: p.codigo,
                    nombre: p.nombre,
                    cantidad: item.cantidad,
                    stockAnterior: stockAnterior,
                    stockNuevo: p.stock,
                    costoAnterior: costoAnterior,
                    costoNuevo: p.costo,
                    subtotalUSD: item.subtotalUSD,
                    usuario: usuarioNombre
                });
            }
        });

        // 2. Registro maestro de la Factura de Compra
        const registroFactura = {
            id: 'FAC-' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            numero: numero,
            proveedor: proveedor,
            fecha: fecha,
            fechaRegistro: timestamp,
            items: [...estadoFactura.items],
            totalItems: estadoFactura.items.length,
            totalUnidades: totalUnidades,
            totalUSD: totalUSD,
            totalVES: totalVES,
            tasaBCV: tasa,
            tipoCosto: tipoCosto,
            notas: notas,
            usuario: usuarioNombre
        };

        if (!Array.isArray(AppState.facturasCompras)) AppState.facturasCompras = [];
        AppState.facturasCompras.unshift(registroFactura);

        if (!Array.isArray(AppState.kardex)) AppState.kardex = [];
        itemsKardex.forEach(k => AppState.kardex.unshift(k));

        if (!Array.isArray(AppState.proveedoresFrecuentes)) AppState.proveedoresFrecuentes = [];
        if (!AppState.proveedoresFrecuentes.includes(proveedor)) {
            AppState.proveedoresFrecuentes.push(proveedor);
        }

        // 3. Persistencia en la nube (Firestore)
        try {
            if (window.InventoryApp?.Firebase) {
                if (typeof window.InventoryApp.Firebase.guardarFacturaCompra === 'function') {
                    window.InventoryApp.Firebase.guardarFacturaCompra(registroFactura, itemsKardex).catch(err => {
                        console.warn('[Facturas] Error al guardar factura en Firestore:', err);
                    });
                }
                productosAfectados.forEach(prod => {
                    if (typeof window.InventoryApp.Firebase.guardarProducto === 'function') {
                        window.InventoryApp.Firebase.guardarProducto(prod).catch(() => {});
                    }
                });
            }
        } catch (e) {
            console.warn('[Facturas] Error en sincronización de nube:', e);
        }

        // 4. Actualizar vistas dependientes del sistema
        if (typeof renderizarInventario === 'function') renderizarInventario();
        if (typeof renderizarPosProductos === 'function') renderizarPosProductos();
        if (typeof renderizarAuditoria === 'function') renderizarAuditoria();
        if (typeof renderizarCatalogoCliente === 'function') renderizarCatalogoCliente();
        if (typeof renderizarKioscoProductos === 'function') renderizarKioscoProductos();

        // 5. Reinicio de la factura en edición
        estadoFactura.items = [];
        estadoFactura.productoSeleccionado = null;
        if (inputNotas) inputNotas.value = '';
        if (inputProveedor) inputProveedor.value = '';

        generarSiguienteNumeroFactura();
        renderizarItemsFacturaActual();
        renderizarHistorialFacturas();
        renderizarKardex();

        if (btnProcesar) {
            btnProcesar.disabled = false;
            btnProcesar.innerHTML = '<i class="fas fa-check-double"></i> Procesar e Ingresar Mercancía';
        }

        if (typeof showCustomAlert === 'function') {
            showCustomAlert(
                '¡Mercancía Ingresada con Éxito!',
                `Se procesó la factura <strong>${numero}</strong> de <strong>${proveedor}</strong>.<br><br>` +
                `• <strong>${totalUnidades} unidades</strong> agregadas al stock.<br>` +
                `• <strong>${productosAfectados.length} productos</strong> con costos unitarios actualizados.<br>` +
                `• Registro inmutable generado en el Kardex e historial.`,
                'success'
            );
        }
    }

    /**
     * Renderiza el historial de facturas ingresadas con soporte para búsqueda
     */
    function renderizarHistorialFacturas(filtro = '') {
        const tbody = document.getElementById('facturas-historial-body') || document.getElementById('facturas-historial-tbody');
        const mobileContainer = document.getElementById('facturas-historial-mobile');
        if (!tbody && !mobileContainer) return;

        const facturas = Array.isArray(AppState.facturasCompras) ? AppState.facturasCompras : [];
        const q = String(filtro || '').trim().toLowerCase();

        const filtradas = facturas.filter(f => {
            if (!q) return true;
            const num = String(f.numero || '').toLowerCase();
            const prov = String(f.proveedor || '').toLowerCase();
            return num.includes(q) || prov.includes(q);
        });

        if (tbody) {
            if (filtradas.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--text-muted); font-size:0.9rem;">No hay facturas de compra procesadas en el sistema.</td></tr>';
            } else {
                tbody.innerHTML = filtradas.map(f => {
                    const totalUSD = Number(f.totalUSD || 0).toFixed(2);
                    const totalVES = Number(f.totalVES || 0).toFixed(2);
                    const itemsCount = (f.items || []).length;
                    const unidades = Number(f.totalUnidades || 0);

                    return `
                        <tr>
                            <td style="font-weight:600; color:var(--text-color); font-size:0.85rem;">${f.fecha || f.fechaRegistro?.split(' ')[0]}</td>
                            <td><span class="badge" style="background:#eff6ff; color:#1d4ed8; font-weight:800; padding:4px 8px; border-radius:6px;">${f.numero}</span></td>
                            <td style="font-weight:600;">${f.proveedor}</td>
                            <td class="text-center font-weight-bold">${itemsCount}</td>
                            <td class="text-center font-weight-bold" style="color:#2563eb;">${unidades} unds</td>
                            <td class="text-right" style="font-weight:800; color:#16a34a; font-size:0.95rem;">$${totalUSD}</td>
                            <td class="text-right" style="font-weight:600; color:var(--text-muted); font-size:0.85rem;">Bs ${totalVES}</td>
                            <td class="text-center">
                                <button type="button" class="btn btn-outline btn-sm" onclick="verDetalleFactura('${f.id}')" title="Ver detalle" style="padding:4px 10px; font-size:0.8rem; border-radius:6px; cursor:pointer;">
                                    <i class="fas fa-eye"></i> Ver
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }

        if (mobileContainer) {
            if (filtradas.length === 0) {
                mobileContainer.innerHTML = '<div style="text-align:center; padding:24px; color:var(--text-muted); font-size:0.9rem;">No hay facturas de compra procesadas en el sistema.</div>';
            } else {
                mobileContainer.innerHTML = filtradas.map(f => {
                    const totalUSD = Number(f.totalUSD || 0).toFixed(2);
                    const totalVES = Number(f.totalVES || 0).toFixed(2);
                    const itemsCount = (f.items || []).length;
                    const unidades = Number(f.totalUnidades || 0);

                    return `
                        <div class="factura-historial-card" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:14px; margin-bottom:10px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                <span class="badge" style="background:#eff6ff; color:#1d4ed8; font-weight:800; padding:3px 8px; border-radius:6px; font-size:0.8rem;">${f.numero}</span>
                                <span style="font-size:0.75rem; color:var(--text-muted);">${f.fecha}</span>
                            </div>
                            <div style="font-weight:700; font-size:0.92rem; color:var(--text-color); margin-bottom:4px;">${f.proveedor}</div>
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; padding-top:8px; border-top:1px solid #f1f5f9; font-size:0.85rem;">
                                <div>
                                    <span style="color:var(--text-muted);">${itemsCount} prods (${unidades} unds)</span>
                                </div>
                                <div style="font-weight:800; color:#16a34a; font-size:1rem;">
                                    $${totalUSD} USD
                                </div>
                            </div>
                            <button type="button" class="btn btn-outline btn-sm" onclick="verDetalleFactura('${f.id}')" style="width:100%; margin-top:10px; font-size:0.8rem; padding:7px; border-radius:8px; cursor:pointer;">
                                <i class="fas fa-eye"></i> Ver Detalle de Factura
                            </button>
                        </div>
                    `;
                }).join('');
            }
        }
    }

    function filtrarHistorialFacturas(filtro) {
        renderizarHistorialFacturas(filtro);
    }

    /**
     * Muestra el modal con el detalle completo de una factura
     */
    function verDetalleFactura(facturaId) {
        const facturas = Array.isArray(AppState.facturasCompras) ? AppState.facturasCompras : [];
        const f = facturas.find(fac => fac.id === facturaId);
        if (!f) return;

        const modalBackdrop = document.getElementById('modal-detalle-factura-backdrop');
        const modalSub = document.getElementById('detalle-factura-subtitulo');
        const modalContent = document.getElementById('detalle-factura-contenido') || document.getElementById('modal-detalle-factura-body');
        if (!modalBackdrop || !modalContent) return;

        if (modalSub) {
            modalSub.textContent = `Factura N° ${f.numero} · Proveedor: ${f.proveedor} · Fecha: ${f.fecha}`;
        }

        const items = f.items || [];
        modalContent.innerHTML = `
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px 16px; margin-bottom:14px; display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px; font-size:0.85rem;">
                <div><strong>N° Factura:</strong> ${f.numero}</div>
                <div><strong>Proveedor:</strong> ${f.proveedor}</div>
                <div><strong>Fecha de Emisión:</strong> ${f.fecha}</div>
                <div><strong>Total Inversión:</strong> <span style="color:#16a34a; font-weight:800;">$${Number(f.totalUSD || 0).toFixed(2)}</span> (Bs ${Number(f.totalVES || 0).toFixed(2)})</div>
                <div><strong>Ítems Comprados:</strong> ${items.length} (${f.totalUnidades || 0} unds)</div>
                <div><strong>Registrado por:</strong> ${f.usuario || 'Admin'}</div>
            </div>

            <div class="audit-table-responsive" style="max-height:360px; overflow-y:auto;">
                <table class="audit-table" style="width:100%; font-size:0.85rem;">
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th class="text-center" style="width:90px;">Cant.</th>
                            <th class="text-right" style="width:100px;">Costo Anterior</th>
                            <th class="text-right" style="width:110px;">Nuevo Costo</th>
                            <th class="text-right" style="width:110px;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(it => `
                            <tr>
                                <td>
                                    <div style="font-weight:700;">${it.nombre}</div>
                                    <div style="font-size:0.75rem; color:var(--text-muted);">${it.codigo}</div>
                                </td>
                                <td class="text-center font-weight-bold" style="color:#2563eb;">+${it.cantidad} unds</td>
                                <td class="text-right" style="color:var(--text-muted);">$${Number(it.costoAnterior || 0).toFixed(2)}</td>
                                <td class="text-right font-weight-bold" style="color:#16a34a;">$${Number(it.nuevoCosto || 0).toFixed(2)}</td>
                                <td class="text-right font-weight-bold" style="color:var(--text-color);">$${Number(it.subtotalUSD || 0).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        modalBackdrop.style.display = 'flex';
    }

    function cerrarModalDetalleFactura() {
        const modalBackdrop = document.getElementById('modal-detalle-factura-backdrop');
        if (modalBackdrop) modalBackdrop.style.display = 'none';
    }

    /**
     * Renderiza el Kardex de movimientos
     */
    function renderizarKardex(tipoFiltro) {
        const tbody = document.getElementById('kardex-historial-body') || document.getElementById('kardex-tbody');
        const mobileContainer = document.getElementById('kardex-historial-mobile');
        if (!tbody && !mobileContainer) return;

        const filtroEl = document.getElementById('kardex-filtro-tipo');
        const filtro = tipoFiltro || (filtroEl ? filtroEl.value : 'TODOS');

        const kardex = Array.isArray(AppState.kardex) ? AppState.kardex : [];
        const filtrados = kardex.filter(k => {
            if (!filtro || filtro === 'TODOS') return true;
            return k.tipo === filtro;
        });

        if (tbody) {
            if (filtrados.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:24px; color:var(--text-muted);">No hay registros en el Kardex para el filtro seleccionado.</td></tr>';
            } else {
                tbody.innerHTML = filtrados.slice(0, 50).map(k => {
                    const esCompra = k.tipo === 'COMPRA_FACTURA';
                    const tipoLabel = esCompra 
                        ? '<span class="badge" style="background:#eff6ff; color:#1d4ed8; font-weight:700;"><i class="fas fa-file-invoice"></i> Compra Factura</span>'
                        : '<span class="badge" style="background:#fef3c7; color:#92400e; font-weight:700;"><i class="fas fa-clipboard-check"></i> Auditoría</span>';

                    const entrada = esCompra ? `+${k.cantidad}` : (k.cantidad > 0 ? `+${k.cantidad}` : '-');
                    const salida = (!esCompra && k.cantidad < 0) ? `${Math.abs(k.cantidad)}` : '-';
                    const ref = k.facturaNumero ? `Factura ${k.facturaNumero}` : (k.motivo || 'Ajuste Físico');

                    return `
                        <tr>
                            <td style="font-size:0.82rem; color:var(--text-muted);">${k.fecha}</td>
                            <td><span class="badge" style="background:#f1f5f9; color:#475569; font-size:0.75rem;">${k.codigo || '-'}</span></td>
                            <td style="font-weight:700;">${k.nombre}</td>
                            <td class="text-center">${tipoLabel}</td>
                            <td class="text-center font-weight-bold" style="color:#16a34a;">${entrada}</td>
                            <td class="text-center font-weight-bold" style="color:#dc2626;">${salida}</td>
                            <td class="text-center font-weight-bold">${k.stockNuevo ?? k.stockFinal ?? '-'}</td>
                            <td class="text-right" style="font-weight:700; color:var(--text-color);">$${Number(k.costoNuevo || k.costo || 0).toFixed(2)}</td>
                            <td style="font-size:0.82rem; color:var(--text-muted);">${ref}</td>
                        </tr>
                    `;
                }).join('');
            }
        }

        if (mobileContainer) {
            if (filtrados.length === 0) {
                mobileContainer.innerHTML = '<div style="text-align:center; padding:24px; color:var(--text-muted);">No hay registros en el Kardex.</div>';
            } else {
                mobileContainer.innerHTML = filtrados.slice(0, 30).map(k => {
                    const esCompra = k.tipo === 'COMPRA_FACTURA';
                    return `
                        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:12px; margin-bottom:8px; font-size:0.85rem;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                                <strong style="color:var(--text-color);">${k.nombre}</strong>
                                <span style="font-size:0.75rem; color:var(--text-muted);">${k.fecha}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span>${k.facturaNumero ? `Fact. ${k.facturaNumero}` : (k.motivo || 'Ajuste')}</span>
                                <strong style="color:${esCompra ? '#16a34a' : '#2563eb'};">${esCompra ? '+' + k.cantidad : k.cantidad} unds</strong>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
    }

    /**
     * Permite abrir la vista de facturas con un producto específico ya seleccionado
     */
    function abrirFacturaConProducto(productoId) {
        if (typeof switchTab === 'function') {
            switchTab('facturas');
        }
        setTimeout(() => {
            seleccionarProductoFactura(productoId);
            const seccionCarga = document.getElementById('factura-producto-card-selected');
            if (seccionCarga) {
                seccionCarga.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 150);
    }

    // Exportaciones globales para el DOM y los módulos
    window.inicializarModuloFacturas = inicializarModuloFacturas;
    window.renderizarModuloFacturas = inicializarModuloFacturas;
    window.generarSiguienteNumeroFactura = generarSiguienteNumeroFactura;
    window.buscarProductosFactura = buscarProductosFactura;
    window.alBuscarProductoFactura = alBuscarProductoFactura;
    window.ocultarDropdownBusquedaFactura = ocultarDropdownBusquedaFactura;
    window.seleccionarProductoFactura = seleccionarProductoFactura;
    window.deseleccionarProductoFactura = deseleccionarProductoFactura;
    window.limpiarBuscadorProductoFactura = limpiarBuscadorProductoFactura;
    window.actualizarCalculosItemFactura = actualizarCalculosItemFactura;
    window.alCambiarInputsFacturaItem = alCambiarInputsFacturaItem;
    window.agregarItemAFactura = agregarItemAFactura;
    window.eliminarItemFactura = eliminarItemFactura;
    window.limpiarItemsFactura = limpiarItemsFactura;
    window.limpiarFormularioFactura = limpiarFormularioFactura;
    window.renderizarItemsFacturaActual = renderizarItemsFacturaActual;
    window.procesarFacturaCompra = procesarFacturaCompra;
    window.renderizarHistorialFacturas = renderizarHistorialFacturas;
    window.filtrarHistorialFacturas = filtrarHistorialFacturas;
    window.verDetalleFactura = verDetalleFactura;
    window.cerrarModalDetalleFactura = cerrarModalDetalleFactura;
    window.renderizarKardex = renderizarKardex;
    window.abrirFacturaConProducto = abrirFacturaConProducto;
    window.validarProveedorFactura = validarProveedorFactura;
    window.actualizarDatalistProveedores = actualizarDatalistProveedores;
    window.abrirModalRegistrarProveedor = abrirModalRegistrarProveedor;
    window.cerrarModalRegistrarProveedor = cerrarModalRegistrarProveedor;
    window.guardarNuevoProveedorDesdeModal = guardarNuevoProveedorDesdeModal;
    window.guardarProveedorRapidoDesdeInput = guardarProveedorRapidoDesdeInput;
    window.abrirDirectorioProveedores = abrirDirectorioProveedores;
    window.cerrarDirectorioProveedores = cerrarDirectorioProveedores;
    window.filtrarDirectorioProveedores = filtrarDirectorioProveedores;
    window.seleccionarProveedorDesdeDirectorio = seleccionarProveedorDesdeDirectorio;

    window.InventoryApp.Facturas = {
        abrirModalRegistrarProveedor,
        cerrarModalRegistrarProveedor,
        abrirDirectorioProveedores,
        cerrarDirectorioProveedores,
        actualizarDatalistProveedores,
        validarProveedorFactura
    };

})();
