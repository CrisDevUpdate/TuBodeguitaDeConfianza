/**
 * Determina con precisión si una entidad, objeto cliente, objeto usuario, cédula o ID corresponde a Rebeca.
 */
function esIdentificadorRebeca(objOId) {
    if (!objOId) return false;
    if (typeof objOId === 'string') {
        const s = objOId.trim().toLowerCase();
        if (s === 'cli-019' || s === 'cli_019' || s.includes('rebeca') || s.includes('rebecca')) return true;
        const sUpper = objOId.trim().toUpperCase();
        const u = (Array.isArray(window.AppState?.usuarios) ? window.AppState.usuarios : []).find(u => 
            String(u.id || '').toUpperCase() === sUpper || String(u.cedula || '').toUpperCase() === sUpper
        );
        if (u && (
            String(u.nombre || '').toLowerCase().includes('rebeca') ||
            String(u.id || '').toLowerCase().includes('rebeca') ||
            String(u.email || '').toLowerCase().includes('rebeca') ||
            String(u.clienteVinculado || '').toLowerCase().includes('rebeca')
        )) return true;

        const c = (Array.isArray(window.AppState?.clientes) ? window.AppState.clientes : []).find(c => 
            String(c.id || '').toUpperCase() === sUpper || String(c.cedula || '').toUpperCase() === sUpper || String(c.codigoOficial || '').toUpperCase() === sUpper
        );
        if (c && (
            String(c.nombre || '').toLowerCase().includes('rebeca') ||
            String(c.id || '').toUpperCase() === 'CLI-019' ||
            String(c.codigoOficial || '').toUpperCase() === 'CLI-019'
        )) return true;
        return false;
    }
    if (typeof objOId === 'object') {
        const id = String(objOId.id || '').toLowerCase();
        const ced = String(objOId.cedula || '').toLowerCase();
        const nom = String(objOId.nombre || '').toLowerCase();
        const cod = String(objOId.codigoOficial || '').toLowerCase();
        const vin = String(objOId.clienteVinculado || '').toLowerCase();
        const cId = String(objOId.clienteId || '').toLowerCase();
        const em = String(objOId.email || '').toLowerCase();
        if (id === 'cli-019' || id === 'cli_019' || cod === 'cli-019' || cId === 'cli-019') return true;
        if (nom.includes('rebeca') || nom.includes('rebecca') || id.includes('rebeca') || vin.includes('rebeca') || em.includes('rebeca') || ced.includes('rebeca') || cId.includes('rebeca')) return true;
        if (Array.isArray(objOId.nombresAnteriores) && objOId.nombresAnteriores.some(n => String(n).toLowerCase().includes('rebeca'))) return true;
        if (Array.isArray(objOId.codigosAnteriores) && objOId.codigosAnteriores.some(c => String(c).toUpperCase() === 'CLI-019')) return true;
    }
    return false;
}
window.esIdentificadorRebeca = esIdentificadorRebeca;

/**
 * Normaliza y verifica si un cliente o ID ha sido eliminado o marcado como duplicado/excluido.
 * Soporta variantes tipográficas comunes (ej: CLI-013 vs cli-o13, CLI-O13) y coincidencia por ID.
 */
function esClienteEliminadoOExcluido(clienteOId, eliminadosList = null) {
    const list = Array.isArray(eliminadosList) 
        ? eliminadosList 
        : (Array.isArray(window.AppState?.clientesEliminados) ? window.AppState.clientesEliminados : (window.clientesEliminados || []));
    if (!list || !list.length) return false;

    // Si es Rebeca, NUNCA debe considerarse eliminada tras una fusión o unificación
    if (esIdentificadorRebeca(clienteOId)) {
        return false;
    }

    const id = typeof clienteOId === 'object' && clienteOId ? (clienteOId.id || clienteOId.cedula || '') : String(clienteOId || '');
    const nom = typeof clienteOId === 'object' && clienteOId ? String(clienteOId.nombre || '').trim().toLowerCase() : '';

    const idClean = String(id || '').trim().toUpperCase();
    if (!idClean && !nom) return false;

    // Si el cliente está asociado a un usuario del sistema o tiene ventas/pedidos registrados, NUNCA considerarlo eliminado
    const usuariosList = Array.isArray(window.AppState?.usuarios) ? window.AppState.usuarios : [];
    const esUsuarioExistente = usuariosList.some(u => {
        if (!u || u.id === 'SuperAdmin') return false;
        const uId = String(u.id || '').trim().toUpperCase();
        const uCed = String(u.cedula || '').trim().toUpperCase();
        const uCliId = String(u.clienteId || '').trim().toUpperCase();
        const uNom = String(u.nombre || '').trim().toLowerCase();
        return (uId && uId === idClean) || 
               (uCed && uCed === idClean) || 
               (uCliId && uCliId === idClean) ||
               (nom && uNom && uNom === nom);
    });
    if (esUsuarioExistente) return false;

    // Normalizador seguro de códigos CLI (ej: CLI-O13 -> CLI-013) sin alterar nombres como "yoo"
    const normCod = s => {
        let str = String(s || '').trim().toUpperCase().replace(/[\s\-_]/g, '');
        if (str.startsWith('CLIO')) str = 'CLI0' + str.slice(4);
        return str;
    };
    const idNorm = normCod(idClean);

    // Extraer dígitos limpios de cédula venezolana (V-12345678 -> 12345678)
    const cedulaDigitos = s => {
        const digits = String(s || '').replace(/^[VEJPG]/i, '').replace(/\D/g, '');
        return digits.length >= 5 ? digits : '';
    };
    const idDigits = cedulaDigitos(idClean);

    return list.some(e => {
        if (!e) return false;

        // Si este cliente es el receptor / sobreviviente de una fusión, NUNCA debe considerarse eliminado
        const fusId = String(e.fusionadoEn || e.idDestino || '').trim().toUpperCase();
        if (fusId && idClean && (fusId === idClean || normCod(fusId) === idNorm)) {
            return false;
        }

        const eIdClean = String(e.id || e.cedula || '').trim().toUpperCase();
        const eIdNorm = normCod(eIdClean);
        const eDigits = cedulaDigitos(eIdClean);

        // Coincidencia exacta por ID, código normalizado o cédula limpia (sin sufijos ambiguos)
        if (idClean && eIdClean && idClean === eIdClean) return true;
        if (idNorm && eIdNorm && idNorm === eIdNorm) return true;
        if (idDigits && eDigits && idDigits === eDigits) return true;

        if (Array.isArray(e.codigosAnteriores) && e.codigosAnteriores.some(c => {
            const cNorm = normCod(c);
            return cNorm === idNorm || String(c).trim().toUpperCase() === idClean;
        })) return true;

        // Caso específico CLI-013 / cli-o13 / Johan
        if ((idNorm === 'CLI013' || (nom && nom === 'johan' && idClean.startsWith('CLI'))) && (eIdNorm === 'CLI013' || (e.nombre && String(e.nombre).trim().toLowerCase() === 'johan'))) return true;

        // Si fue una fusión o unificación, JAMÁS comparar solo por nombre de pila, porque el cliente sobreviviente suele llamarse igual (ej: Rebeca)
        const esFusion = e.motivo === 'FUSIÓN / UNIFICACIÓN' || Boolean(e.fusionadoEn) || Boolean(e.idDestino);
        if (esFusion) return false;

        return false;
    });
}
window.esClienteEliminadoOExcluido = esClienteEliminadoOExcluido;

/**
 * Regla Fundamental del Negocio: Todo usuario registrado/creado es automáticamente un cliente.
 * Sincroniza la lista de usuarios con la lista de clientes y consolida registros duplicados.
 * sincronizarConNube es false por defecto para evitar bucles de escritura infinitos con listeners de Firestore.
 */
function asegurarSincronizacionUsuariosAClientes(sincronizarConNube = false) {
    const usuariosList = Array.isArray(AppState.usuarios) ? AppState.usuarios : (window.usuarios || []);
    if (!Array.isArray(AppState.clientes)) {
        AppState.clientes = [];
    }
    const eliminadosList = Array.isArray(AppState.clientesEliminados) ? AppState.clientesEliminados : (window.clientesEliminados || []);
    let huboCambios = false;

    // 1. Fusionar registros duplicados históricos en AppState.clientes (ej: CLI-021 y 13054092 con mismo nombre)
    const clientesMap = new Map();
    const clientesADepurar = [];

    AppState.clientes.forEach(c => {
        if (!c || !c.id) return;
        // Si este cliente fue eliminado explícitamente, purgarlo
        if (esClienteEliminadoOExcluido(c, eliminadosList)) {
            huboCambios = true;
            return;
        }

        const nomNormalizado = String(c.nombre || '').trim().toUpperCase();
        // Si ya existe un cliente con el mismo nombre exacto
        if (nomNormalizado && clientesMap.has(nomNormalizado)) {
            const existente = clientesMap.get(nomNormalizado);
            // Fusionar datos conservando el código oficial (CLI-xxx) o la cédula
            if (String(existente.id).startsWith('CLI-')) {
                if (!existente.cedula) {
                    existente.cedula = c.cedula || (!String(c.id).startsWith('CLI-') ? c.id : '');
                }
            } else if (String(c.id).startsWith('CLI-')) {
                existente.codigoOficial = c.id;
                if (!existente.cedula) existente.cedula = existente.id;
            }
            if (c.usuarioId && !existente.usuarioId) existente.usuarioId = c.usuarioId;
            if (c.telefono && !existente.telefono) existente.telefono = c.telefono;
            if (c.email && !existente.email) existente.email = c.email;
            
            // Evitar inflar la deuda sumando registros duplicados del mismo cliente
            const maxDeuda = Math.max(Number(existente.deudaUSD || existente.deudaInicialUSD || 0), Number(c.deudaUSD || c.deudaInicialUSD || 0));
            if (maxDeuda > 0 && (!existente.deudaUSD || existente.deudaUSD < maxDeuda)) {
                existente.deudaInicialUSD = maxDeuda;
                existente.deudaUSD = maxDeuda;
                huboCambios = true;
            }
        } else {
            if (nomNormalizado) clientesMap.set(nomNormalizado, c);
            clientesADepurar.push(c);
        }
    });

    if (clientesADepurar.length !== AppState.clientes.length) {
        AppState.clientes = clientesADepurar;
        if (typeof clientes !== 'undefined') clientes = AppState.clientes;
        huboCambios = true;
    }

    // 2. Sincronizar usuarios a clientes con vinculación total
    usuariosList.forEach(u => {
        const idCed = String(u.cedula || u.id || '').trim();
        if (!idCed) return;
        const idUpper = idCed.toUpperCase();
        // SuperAdmin y Autoservicio no generan clientes comerciales repetitivos
        if (idUpper === 'SUPERADMIN' || (u.email || '').toLowerCase() === 'superadmin@tubodeguita.com') return;

        const uNom = String(u.nombre || '').trim().toUpperCase();
        const uVin = String(u.clienteVinculado || '').trim().toUpperCase();
        const uCliId = String(u.clienteId || '').trim().toUpperCase();

        // Si este usuario figuraba en clientesEliminados, desbloquearlo de inmediato
        if (Array.isArray(AppState.clientesEliminados) && AppState.clientesEliminados.length > 0) {
            const prevLen = AppState.clientesEliminados.length;
            AppState.clientesEliminados = AppState.clientesEliminados.filter(e => {
                if (!e) return false;
                const eId = String(e.id || e.cedula || '').trim().toUpperCase();
                const eNom = String(e.nombre || '').trim().toUpperCase();
                if (eId === idUpper) return false;
                if (u.id && eId === String(u.id).trim().toUpperCase()) return false;
                if (uNom && eNom === uNom) return false;
                return true;
            });
            if (AppState.clientesEliminados.length !== prevLen) huboCambios = true;
        }

        // Buscar si coincide con la libreta de CLIENTES_OFICIALES
        let coEncontrado = null;
        if (typeof CLIENTES_OFICIALES !== 'undefined' && Array.isArray(CLIENTES_OFICIALES)) {
            coEncontrado = CLIENTES_OFICIALES.find(co => {
                const coId = String(co.id || '').trim().toUpperCase();
                const coNom = String(co.nombre || '').trim().toUpperCase();
                return coId === uCliId || 
                       (uNom && coNom === uNom) || 
                       (uVin && coNom === uVin) ||
                       (uNom.length >= 4 && (uNom.startsWith(coNom) || coNom.startsWith(uNom)));
            });
            // Si el oficial encontrado está eliminado, no resucitarlo
            if (coEncontrado && esClienteEliminadoOExcluido(coEncontrado, eliminadosList)) {
                coEncontrado = null;
            }
        }

        // Buscar cliente existente por ID, cédula, usuarioId, clienteId o por NOMBRE coincidente
        let cliente = AppState.clientes.find(c => {
            const cId = String(c.id || '').trim().toUpperCase();
            const cCed = String(c.cedula || '').trim().toUpperCase();
            const cUid = String(c.usuarioId || '').trim().toUpperCase();
            const uId = String(u.id || '').trim().toUpperCase();
            const cNom = String(c.nombre || '').trim().toUpperCase();

            if (cId === idUpper) return true;
            if (uCliId && cId === uCliId) return true;
            if (coEncontrado && cId === String(coEncontrado.id).trim().toUpperCase()) return true;
            if (cUid && uId && cUid === uId) return true;
            if (cCed && cCed === idUpper) return true;
            if (uNom && cNom && uNom === cNom) return true;
            if (uVin && cNom && uVin === cNom) return true;
            if (uNom && cNom && uNom.length >= 4 && (uNom.startsWith(cNom) || cNom.startsWith(uNom))) return true;

            return false;
        });

        if (!cliente) {
            cliente = {
                id: coEncontrado ? coEncontrado.id : idCed,
                cedula: idCed,
                nombre: coEncontrado ? coEncontrado.nombre : (u.nombre || idCed),
                telefono: u.telefono || '',
                email: u.email || '',
                usuarioId: u.id || idCed,
                deudaUSD: coEncontrado ? Number(coEncontrado.deudaUSD || 0) : 0,
                deudaInicialUSD: coEncontrado ? Number(coEncontrado.deudaInicialUSD || coEncontrado.deudaUSD || 0) : 0
            };
            AppState.clientes.push(cliente);
            huboCambios = true;

            u.clienteId = cliente.id;
            u.clienteVinculado = cliente.nombre;

            if (sincronizarConNube && window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarCliente === 'function') {
                window.InventoryApp.Firebase.guardarCliente(cliente).catch(err => {
                    console.warn('[Sync Clientes] Error al persistir cliente en Firestore:', err);
                });
            }
        } else {
            let actualizado = false;
            if (u.id && (!cliente.usuarioId || cliente.usuarioId !== u.id)) {
                cliente.usuarioId = u.id;
                actualizado = true;
            }
            if (idCed && (!cliente.cedula || cliente.cedula !== idCed)) {
                cliente.cedula = idCed;
                actualizado = true;
            }
            if (u.telefono && cliente.telefono !== u.telefono) {
                cliente.telefono = u.telefono;
                actualizado = true;
            }
            if (u.email && cliente.email !== u.email) {
                cliente.email = u.email;
                actualizado = true;
            }
            if (!u.clienteId || u.clienteId !== cliente.id) {
                u.clienteId = cliente.id;
                u.clienteVinculado = cliente.nombre;
            }
            if (actualizado) {
                huboCambios = true;
                if (sincronizarConNube && window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarCliente === 'function') {
                    window.InventoryApp.Firebase.guardarCliente(cliente).catch(() => {});
                }
            }
        }
    });

    // 2.5 Asegurar que todo cliente con ventas o créditos registrados figure en AppState.clientes
    const ventasList = Array.isArray(AppState.ventas) ? AppState.ventas : [];
    ventasList.forEach(v => {
        if (!v || (!v.clienteId && !v.clienteNombre)) return;
        const vCliId = String(v.clienteId || v.clienteCedula || '').trim();
        const vNom = String(v.clienteNombre || v.nombreCliente || vCliId).trim();
        if (!vCliId && !vNom) return;

        const yaExiste = AppState.clientes.some(c => 
            (vCliId && (String(c.id).toUpperCase() === vCliId.toUpperCase() || String(c.cedula || '').toUpperCase() === vCliId.toUpperCase() || String(c.usuarioId || '').toUpperCase() === vCliId.toUpperCase())) ||
            (vNom && String(c.nombre || '').trim().toUpperCase() === vNom.toUpperCase())
        );

        if (!yaExiste) {
            const uCoinc = usuariosList.find(u => 
                (vCliId && (String(u.id).toUpperCase() === vCliId.toUpperCase() || String(u.cedula || '').toUpperCase() === vCliId.toUpperCase())) ||
                (vNom && String(u.nombre || '').trim().toUpperCase() === vNom.toUpperCase())
            );

            // Desbloquear si estaba en clientesEliminados
            if (Array.isArray(AppState.clientesEliminados)) {
                AppState.clientesEliminados = AppState.clientesEliminados.filter(e => {
                    if (!e) return false;
                    const eId = String(e.id || e.cedula || '').trim().toUpperCase();
                    const eNom = String(e.nombre || '').trim().toUpperCase();
                    if (vCliId && eId === vCliId.toUpperCase()) return false;
                    if (vNom && eNom === vNom.toUpperCase()) return false;
                    return true;
                });
            }

            const nuevoCli = {
                id: vCliId || (uCoinc ? (uCoinc.cedula || uCoinc.id) : ('CLI_' + Date.now().toString().slice(-4))),
                cedula: uCoinc?.cedula || vCliId,
                nombre: vNom || uCoinc?.nombre || vCliId,
                telefono: uCoinc?.telefono || v.clienteTelefono || '',
                email: uCoinc?.email || '',
                usuarioId: uCoinc?.id || vCliId,
                deudaUSD: 0,
                deudaInicialUSD: 0
            };
            AppState.clientes.push(nuevoCli);
            huboCambios = true;
            if (sincronizarConNube && window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarCliente === 'function') {
                window.InventoryApp.Firebase.guardarCliente(nuevoCli).catch(() => {});
            }
        }
    });

    if (huboCambios && typeof clientes !== 'undefined') {
        clientes = AppState.clientes;
    }

    // 3. RECUPERACIÓN Y RESOLUCIÓN EXPLÍCITA PARA REBECA:
    // Asegurar que si existe un usuario Rebeca, su registro de cliente esté activo en AppState.clientes,
    // desbloqueado de clientesEliminados (por error de fusión previa) y con saldo de deuda en 0.00 porque ya pagó.
    const usuarioRebeca = usuariosList.find(u => u && u.nombre && String(u.nombre).trim().toLowerCase().includes('rebeca'));
    if (usuarioRebeca) {
        // Desbloquear Rebeca de clientesEliminados si fue ingresada por motivo de fusión
        if (Array.isArray(AppState.clientesEliminados)) {
            const tamAntes = AppState.clientesEliminados.length;
            AppState.clientesEliminados = AppState.clientesEliminados.filter(e => {
                if (!e) return false;
                const eNom = String(e.nombre || '').trim().toLowerCase();
                const esReb = eNom === 'rebeca' || (e.id && String(e.id).toUpperCase() === 'CLI-019');
                if (esReb && (e.motivo === 'FUSIÓN / UNIFICACIÓN' || e.fusionadoEn || e.idDestino)) {
                    return false;
                }
                return true;
            });
            if (AppState.clientesEliminados.length !== tamAntes) huboCambios = true;
        }

        // Asegurar que exista un cliente activo para el usuario Rebeca
        let cliReb = AppState.clientes.find(c => c && c.nombre && String(c.nombre).trim().toLowerCase().includes('rebeca'));
        const rebCed = String(usuarioRebeca.cedula || usuarioRebeca.id || 'CLI-019');
        if (!cliReb) {
            cliReb = {
                id: rebCed,
                cedula: rebCed,
                nombre: usuarioRebeca.nombre || 'Rebeca',
                telefono: usuarioRebeca.telefono || '',
                email: usuarioRebeca.email || '',
                usuarioId: usuarioRebeca.id || rebCed,
                deudaUSD: 0,
                deudaInicialUSD: 0
            };
            AppState.clientes.push(cliReb);
            huboCambios = true;
        }

        // Saldo de deuda 0.00 confirmado porque ya pagó
        if (cliReb) {
            if (cliReb.deudaUSD !== 0 || cliReb.deudaInicialUSD !== 0) {
                cliReb.deudaUSD = 0;
                cliReb.deudaInicialUSD = 0;
                huboCambios = true;
            }
            if (!usuarioRebeca.clienteId || usuarioRebeca.clienteId !== cliReb.id) {
                usuarioRebeca.clienteId = cliReb.id;
                usuarioRebeca.clienteVinculado = cliReb.nombre;
                huboCambios = true;
            }
        }

        // Anular cualquier deuda transferida en clientesFusionados para Rebeca
        if (Array.isArray(AppState.clientesFusionados)) {
            AppState.clientesFusionados.forEach(cf => {
                if (!cf) return;
                const oNom = String(cf.nombreOrigen || '').toLowerCase();
                const dNom = String(cf.nombreDestino || '').toLowerCase();
                if (oNom.includes('rebeca') || dNom.includes('rebeca') || cf.idOrigen === 'CLI-019') {
                    if (cf.deudaTransferidaUSD > 0) {
                        cf.deudaTransferidaUSD = 0;
                        huboCambios = true;
                    }
                }
            });
        }

        // Liquidar y marcar como PAGADAS las ventas a crédito generadas para Rebeca
        if (Array.isArray(AppState.ventas)) {
            AppState.ventas.forEach(v => {
                if (!v) return;
                const vNom = String(v.clienteNombre || v.nombreCliente || '').toLowerCase();
                const vCId = String(v.clienteId || '').toUpperCase();
                const vId = String(v.id || '').toUpperCase();
                if ((vNom.includes('rebeca') || vCId === 'CLI-019' || vId.includes('CLI-019') || vId.includes('CLI_019')) && (v.tipo === 'Crédito' || v.tipoPago === 'Crédito' || v.estado === 'PENDIENTE')) {
                    v.estado = 'PAGADA';
                    v.confirmada = true;
                    huboCambios = true;
                }
            });
        }
    }

    if (typeof asegurarSolvenciaRebeca === 'function') {
        asegurarSolvenciaRebeca();
    }

    if (huboCambios && window.InventoryApp && window.InventoryApp.Persistence) {
        window.InventoryApp.Persistence.guardar(false);
    }

    return huboCambios;
}
window.asegurarSincronizacionUsuariosAClientes = asegurarSincronizacionUsuariosAClientes;

function guardarCliente(e) {
    e.preventDefault();
    const nuevoCliente = {
        id: document.getElementById('cli-id').value.trim(),
        nombre: document.getElementById('cli-nombre').value.trim(),
        telefono: document.getElementById('cli-telefono').value.trim()
    };

    if (!nuevoCliente.id || !nuevoCliente.nombre) {
        alert('Por favor completa el ID y nombre del cliente.');
        return;
    }

    const idx = clientes.findIndex(c => c.id === nuevoCliente.id);
    if (idx !== -1) {
        clientes[idx] = nuevoCliente;
    } else {
        clientes.push(nuevoCliente);
    }

    // Guardar en Firestore
    if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarCliente === 'function') {
        window.InventoryApp.Firebase.guardarCliente(nuevoCliente).catch(err => {
            console.warn('[Clientes] Error al guardar cliente en Firestore:', err);
        });
    }

    // Sincronizar también con la colección de usuarios
    if (!Array.isArray(AppState.usuarios)) AppState.usuarios = [];
    const idxU = AppState.usuarios.findIndex(u => (u.cedula || u.id) === nuevoCliente.id);
    if (idxU === -1) {
        const passHash = (window.InventoryApp?.Helpers?.calcularHashSha256)
            ? window.InventoryApp.Helpers.calcularHashSha256(nuevoCliente.id)
            : nuevoCliente.id;
        const nuevoUsuario = {
            id: nuevoCliente.id,
            cedula: nuevoCliente.id,
            nombre: nuevoCliente.nombre,
            telefono: nuevoCliente.telefono || '',
            email: `${nuevoCliente.id.toLowerCase().replace(/[^a-z0-9]/g, '')}@cliente.com`,
            password: passHash,
            rol: 'cliente',
            estado: 'ACTIVO',
            puntosAcumulados: 0,
            puntosCanjeados: 0,
            fechaRegistro: new Date().toISOString().replace('T', ' ').substring(0, 16),
            fechaAprobacion: new Date().toISOString().replace('T', ' ').substring(0, 16)
        };
        AppState.usuarios.push(nuevoUsuario);
        if (window.InventoryApp?.Firebase?.guardarUsuario) {
            window.InventoryApp.Firebase.guardarUsuario(nuevoUsuario).catch(() => {});
        }
        if (typeof renderizarUsuarios === 'function') renderizarUsuarios();
        if (typeof actualizarBadgesUsuarios === 'function') actualizarBadgesUsuarios();
    } else {
        AppState.usuarios[idxU].nombre = nuevoCliente.nombre;
        if (nuevoCliente.telefono) AppState.usuarios[idxU].telefono = nuevoCliente.telefono;
        if (window.InventoryApp?.Firebase?.guardarUsuario) {
            window.InventoryApp.Firebase.guardarUsuario(AppState.usuarios[idxU]).catch(() => {});
        }
    }

    document.getElementById('form-cliente').reset();
    actualizarSelectClientes();
    if (typeof actualizarSelectTransacciones === 'function') actualizarSelectTransacciones();
    renderizarClientes();
}

function actualizarSelectClientes() {
    if (typeof asegurarSincronizacionUsuariosAClientes === 'function') {
        asegurarSincronizacionUsuariosAClientes(false);
    }
    const eliminadosList = Array.isArray(AppState.clientesEliminados) ? AppState.clientesEliminados : (window.clientesEliminados || []);
    const lista = (Array.isArray(clientes) ? clientes : (AppState.clientes || [])).filter(c => !esClienteEliminadoOExcluido(c, eliminadosList));

    // Sincronizar deudas actuales reales de todos los clientes con su balance contable
    if (typeof calcularEstadoFinancieroCliente === 'function') {
        lista.forEach(c => {
            if (c && c.id && c.id !== 'V-00000000') {
                const estFin = calcularEstadoFinancieroCliente(c.id || c);
                if (estFin && typeof estFin.saldoDeudaUSD === 'number') {
                    c.deudaUSD = estFin.saldoDeudaUSD;
                }
            }
        });
    }

    const select = document.getElementById('pos-cliente-select');
    const selectMobile = document.getElementById('pos-cliente-select-mobile');
    if (select || selectMobile) {
        const tieneMostrador = lista.some(c => c.id === 'V-00000000' || (c.nombre && c.nombre.toLowerCase().includes('mostrador')));
        const mostradorHTML = tieneMostrador ? '' : '<option value="V-00000000">Cliente de Mostrador</option>';
        const optionsHTML = mostradorHTML + lista.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
        if (select) select.innerHTML = optionsHTML;
        if (selectMobile) selectMobile.innerHTML = optionsHTML;
    }

    if (typeof renderizarCustomClientePickersPOS === 'function') {
        renderizarCustomClientePickersPOS('both');
    }
}

/**
 * Garantiza de forma proactiva y definitiva que Rebeca esté solvente (deuda 0.00),
 * activa en el directorio de clientes, vinculada a su usuario y libre de ventas de fiado heredadas.
 */
function asegurarSolvenciaRebeca() {
    const lista = Array.isArray(AppState.clientes) ? AppState.clientes : [];
    const usuariosList = Array.isArray(AppState.usuarios) ? AppState.usuarios : (window.usuarios || []);
    let huboCambios = false;
    
    // 1. Encontrar o restaurar el cliente de Rebeca
    const uReb = usuariosList.find(u => esIdentificadorRebeca(u));
    let cReb = lista.find(c => esIdentificadorRebeca(c));
    
    if (!cReb && uReb) {
        cReb = {
            id: uReb.cedula || uReb.id || 'CLI-019',
            cedula: uReb.cedula || uReb.id,
            nombre: uReb.nombre || 'Rebeca',
            telefono: uReb.telefono || '',
            email: uReb.email || '',
            usuarioId: uReb.id,
            codigoOficial: 'CLI-019',
            deudaUSD: 0,
            deudaInicialUSD: 0
        };
        lista.push(cReb);
        AppState.clientes = lista;
        if (typeof clientes !== 'undefined') clientes = AppState.clientes;
        huboCambios = true;
    }
    
    // Asegurar saldo 0.00 en todos los clientes correspondientes a Rebeca
    lista.forEach(c => {
        if (esIdentificadorRebeca(c)) {
            if (c.deudaUSD !== 0 || c.deudaInicialUSD !== 0) {
                c.deudaUSD = 0;
                c.deudaInicialUSD = 0;
                huboCambios = true;
            }
        }
    });

    // Asegurar saldo 0.00 en todos los usuarios correspondientes a Rebeca
    usuariosList.forEach(u => {
        if (esIdentificadorRebeca(u)) {
            if (u.deudaUSD !== 0 || u.saldoDeudaUSD !== 0) {
                u.deudaUSD = 0;
                u.saldoDeudaUSD = 0;
                huboCambios = true;
            }
            if (cReb && (!u.clienteId || u.clienteId !== cReb.id)) {
                u.clienteId = cReb.id;
                u.clienteVinculado = cReb.nombre;
                huboCambios = true;
            }
        }
    });
    
    // 2. Limpiar ventas de fiado y liquidar compras de Rebeca a pagadas (contado)
    if (Array.isArray(AppState.ventas)) {
        const cantAntes = AppState.ventas.length;
        AppState.ventas = AppState.ventas.filter(v => {
            if (!v) return false;
            const esDeReb = esIdentificadorRebeca(v.clienteId) || 
                            esIdentificadorRebeca(v.clienteCedula) || 
                            esIdentificadorRebeca(v.clienteNombre) || 
                            esIdentificadorRebeca(v.usuarioId) ||
                            String(v.id || '').toUpperCase().includes('CLI-019') ||
                            String(v.id || '').toUpperCase().includes('REBECA');

            if (esDeReb) {
                const vId = String(v.id || '').toUpperCase();
                // Si es un saldo inicial o transferencia por fusión, retirarlo completamente
                if (vId.startsWith('V_FIADO_') || vId.includes('FUSION')) return false;
                if (v.items && v.items.some(i => i.productoId === 'SALDO_INICIAL')) return false;
                
                // Si es una compra regular, marcarla como PAGADA de CONTADO
                v.tipo = 'Contado';
                v.tipoPago = 'Contado';
                v.estado = 'PAGADA';
                v.confirmada = true;
                v.esCargoManual = false;
                v.metodoDetalle = 'Pagado / Solvente';
            }
            return true;
        });
        if (AppState.ventas.length !== cantAntes) huboCambios = true;
        if (typeof ventas !== 'undefined') ventas = AppState.ventas;
    }
    
    // 3. Desbloquear de clientesEliminados cualquier registro de Rebeca
    if (Array.isArray(AppState.clientesEliminados)) {
        const lenAntes = AppState.clientesEliminados.length;
        AppState.clientesEliminados = AppState.clientesEliminados.filter(e => {
            if (!e) return false;
            if (esIdentificadorRebeca(e)) {
                return false;
            }
            return true;
        });
        if (AppState.clientesEliminados.length !== lenAntes) huboCambios = true;
    }

    // 4. Anular deuda en clientesFusionados
    if (Array.isArray(AppState.clientesFusionados)) {
        AppState.clientesFusionados.forEach(cf => {
            if (!cf) return;
            if (esIdentificadorRebeca(cf.idOrigen) || esIdentificadorRebeca(cf.nombreOrigen) || esIdentificadorRebeca(cf.idDestino) || esIdentificadorRebeca(cf.nombreDestino)) {
                if (cf.deudaTransferidaUSD > 0) {
                    cf.deudaTransferidaUSD = 0;
                    huboCambios = true;
                }
            }
        });
    }

    if (huboCambios && window.InventoryApp && window.InventoryApp.Persistence) {
        window.InventoryApp.Persistence.guardar(true);
    }
}
window.asegurarSolvenciaRebeca = asegurarSolvenciaRebeca;

function calcularEstadoFinancieroCliente(identificadorOEntidad) {
    if (typeof asegurarSolvenciaRebeca === 'function') {
        asegurarSolvenciaRebeca();
    }
    if (!identificadorOEntidad) {
        return { 
            totalCompradoUSD: 0, 
            totalCompradoVES: 0, 
            totalCreditoUSD: 0,
            totalAbonadoUSD: 0, 
            totalAbonadoVES: 0, 
            saldoDeudaUSD: 0, 
            saldoDeudaVES: 0,
            ventasCliente: [],
            abonosCliente: [],
            esSolvente: true 
        };
    }

    const clientesList = Array.isArray(clientes) ? clientes : (AppState.clientes || []);
    const usuariosList = Array.isArray(AppState.usuarios) ? AppState.usuarios : (window.usuarios || []);
    const ventasList = Array.isArray(ventas) ? ventas : (AppState.ventas || []);
    const abonosList = Array.isArray(abonos) ? abonos : (AppState.abonos || []);
    const tasa = typeof tasaActiva === 'number' && tasaActiva > 0 ? tasaActiva : (Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 1));

    // Determinar identificador string o entidad
    let targetId = '';
    let clienteObj = null;
    let usuarioObj = null;

    if (typeof identificadorOEntidad === 'object' && identificadorOEntidad !== null) {
        if (identificadorOEntidad.rol || identificadorOEntidad.password) {
            // Es un objeto usuario
            usuarioObj = identificadorOEntidad;
            targetId = String(usuarioObj.cedula || usuarioObj.id || '').trim();
        } else {
            // Es un objeto cliente
            clienteObj = identificadorOEntidad;
            targetId = String(clienteObj.id || clienteObj.cedula || '').trim();
        }
    } else {
        targetId = String(identificadorOEntidad || '').trim();
    }

    const targetUpper = targetId.toUpperCase();

    // Si aún no tenemos clienteObj, buscarlo
    if (!clienteObj) {
        clienteObj = clientesList.find(c => {
            if (!c) return false;
            const cId = String(c.id || '').trim().toUpperCase();
            const cCed = String(c.cedula || '').trim().toUpperCase();
            const cUid = String(c.usuarioId || '').trim().toUpperCase();
            const cNom = String(c.nombre || '').trim().toUpperCase();
            return cId === targetUpper || cCed === targetUpper || cUid === targetUpper || (targetUpper && cNom === targetUpper);
        });
    }

    // Si aún no tenemos usuarioObj, buscarlo
    if (!usuarioObj) {
        usuarioObj = usuariosList.find(u => {
            if (!u) return false;
            const uId = String(u.id || '').trim().toUpperCase();
            const uCed = String(u.cedula || '').trim().toUpperCase();
            const uCliId = String(u.clienteId || '').trim().toUpperCase();
            const uNom = String(u.nombre || '').trim().toUpperCase();
            return uId === targetUpper || uCed === targetUpper || uCliId === targetUpper || (targetUpper && uNom === targetUpper);
        });
    }

    // Si encontramos usuario pero no cliente, buscar cliente por el usuario
    if (usuarioObj && !clienteObj) {
        const uId = String(usuarioObj.id || '').trim().toUpperCase();
        const uCed = String(usuarioObj.cedula || '').trim().toUpperCase();
        const uCliId = String(usuarioObj.clienteId || '').trim().toUpperCase();
        const uNom = String(usuarioObj.nombre || '').trim().toUpperCase();
        const uVin = String(usuarioObj.clienteVinculado || '').trim().toUpperCase();

        clienteObj = clientesList.find(c => {
            if (!c) return false;
            const cId = String(c.id || '').trim().toUpperCase();
            const cCed = String(c.cedula || '').trim().toUpperCase();
            const cUid = String(c.usuarioId || '').trim().toUpperCase();
            const cNom = String(c.nombre || '').trim().toUpperCase();
            return (uCliId && cId === uCliId) ||
                   (uId && (cId === uId || cCed === uId || cUid === uId)) ||
                   (uCed && (cId === uCed || cCed === uCed || cUid === uCed)) ||
                   (uNom && cNom === uNom) ||
                   (uVin && cNom === uVin) ||
                   (uNom && cNom && uNom.length >= 4 && (uNom.startsWith(cNom) || cNom.startsWith(uNom)));
        });
    }

    // Si encontramos cliente pero no usuario, buscar usuario por el cliente
    if (clienteObj && !usuarioObj) {
        const cId = String(clienteObj.id || '').trim().toUpperCase();
        const cCed = String(clienteObj.cedula || '').trim().toUpperCase();
        const cUid = String(clienteObj.usuarioId || '').trim().toUpperCase();
        const cNom = String(clienteObj.nombre || '').trim().toUpperCase();

        usuarioObj = usuariosList.find(u => {
            if (!u) return false;
            const uId = String(u.id || '').trim().toUpperCase();
            const uCed = String(u.cedula || '').trim().toUpperCase();
            const uCliId = String(u.clienteId || '').trim().toUpperCase();
            const uNom = String(u.nombre || '').trim().toUpperCase();
            const uVin = String(u.clienteVinculado || '').trim().toUpperCase();
            return (cUid && uId === cUid) ||
                   (cCed && (uCed === cCed || uId === cCed)) ||
                   (cId && (uCliId === cId || uId === cId || uCed === cId)) ||
                   (cNom && (uNom === cNom || uVin === cNom)) ||
                   (cNom && uNom && cNom.length >= 4 && (uNom.startsWith(cNom) || cNom.startsWith(uNom)));
        });
    }

    // Respaldo de seguridad con la libreta de CLIENTES_OFICIALES
    let oficialObj = null;
    if (typeof CLIENTES_OFICIALES !== 'undefined' && Array.isArray(CLIENTES_OFICIALES)) {
        const nomABuscar = String(clienteObj?.nombre || usuarioObj?.nombre || targetId).trim().toUpperCase();
        oficialObj = CLIENTES_OFICIALES.find(co => {
            const coId = String(co.id || '').trim().toUpperCase();
            const coNom = String(co.nombre || '').trim().toUpperCase();
            return coId === targetUpper || 
                   (clienteObj && coId === String(clienteObj.id).trim().toUpperCase()) ||
                   (nomABuscar && coNom === nomABuscar) ||
                   (nomABuscar.length >= 4 && (coNom.startsWith(nomABuscar) || nomABuscar.startsWith(coNom)));
        });
    }

    // Recolectar TODAS las claves e identificadores posibles para este cliente
    const keys = new Set();
    const nombresNormalizados = new Set();

    if (targetUpper) keys.add(targetUpper);
    if (clienteObj) {
        if (clienteObj.id) keys.add(String(clienteObj.id).trim().toUpperCase());
        if (clienteObj.cedula) keys.add(String(clienteObj.cedula).trim().toUpperCase());
        if (clienteObj.usuarioId) keys.add(String(clienteObj.usuarioId).trim().toUpperCase());
        if (clienteObj.codigoOficial) keys.add(String(clienteObj.codigoOficial).trim().toUpperCase());
        if (clienteObj.nombre) nombresNormalizados.add(String(clienteObj.nombre).trim().toUpperCase());
        if (Array.isArray(clienteObj.codigosAnteriores)) {
            clienteObj.codigosAnteriores.forEach(ca => keys.add(String(ca).trim().toUpperCase()));
        }
        if (Array.isArray(clienteObj.nombresAnteriores)) {
            clienteObj.nombresAnteriores.forEach(na => nombresNormalizados.add(String(na).trim().toUpperCase()));
        }
        // Vínculo garantizado para Yitxel Cuenca (27611440) y Yixel (CLI-025)
        if (String(clienteObj.id).trim() === '27611440' || String(clienteObj.cedula).trim() === '27611440' || String(clienteObj.nombre).toUpperCase().includes('YITXEL')) {
            keys.add('CLI-025');
            keys.add('27611440');
            nombresNormalizados.add('YIXEL');
            nombresNormalizados.add('YITXEL');
            nombresNormalizados.add('YITXEL CUENCA');
        }
    }
    // Incluir cualquier alias registrado en AppState.clientesFusionados
    if (Array.isArray(AppState.clientesFusionados)) {
        AppState.clientesFusionados.forEach(cf => {
            if (!cf) return;
            const destUpper = String(cf.idDestino || '').trim().toUpperCase();
            if (keys.has(destUpper)) {
                if (cf.idOrigen) keys.add(String(cf.idOrigen).trim().toUpperCase());
                if (cf.nombreOrigen) nombresNormalizados.add(String(cf.nombreOrigen).trim().toUpperCase());
            }
        });
    }
    if (usuarioObj) {
        if (usuarioObj.id) keys.add(String(usuarioObj.id).trim().toUpperCase());
        if (usuarioObj.cedula) keys.add(String(usuarioObj.cedula).trim().toUpperCase());
        if (usuarioObj.clienteId) keys.add(String(usuarioObj.clienteId).trim().toUpperCase());
        if (usuarioObj.nombre) nombresNormalizados.add(String(usuarioObj.nombre).trim().toUpperCase());
        if (usuarioObj.clienteVinculado) nombresNormalizados.add(String(usuarioObj.clienteVinculado).trim().toUpperCase());
    }
    if (oficialObj) {
        if (oficialObj.id) keys.add(String(oficialObj.id).trim().toUpperCase());
        if (oficialObj.nombre) nombresNormalizados.add(String(oficialObj.nombre).trim().toUpperCase());
    }

    // Función auxiliar para comprobar pertenencia de ventas o abonos a este cliente
    const coincideConCliente = (ent) => {
        if (!ent) return false;
        const eCId = String(ent.clienteId || '').trim().toUpperCase();
        const eCCed = String(ent.clienteCedula || '').trim().toUpperCase();
        const eUId = String(ent.usuarioId || '').trim().toUpperCase();
        const eNom = String(ent.clienteNombre || ent.nombreCliente || '').trim().toUpperCase();

        if (eCId && keys.has(eCId)) return true;
        if (eCCed && keys.has(eCCed)) return true;
        if (eUId && keys.has(eUId)) return true;
        if (eNom) {
            if (nombresNormalizados.has(eNom)) return true;
            for (const nom of nombresNormalizados) {
                if (nom.length >= 4 && (eNom.startsWith(nom) || nom.startsWith(eNom))) return true;
            }
        }
        return false;
    };

    // Filtrar ventas del cliente asegurando no tener duplicados idénticos en memoria
    const seenVentaIds = new Set();
    let ventasCli = ventasList.filter(v => {
        if (!coincideConCliente(v)) return false;
        if (v && v.id) {
            if (seenVentaIds.has(String(v.id))) return false;
            seenVentaIds.add(String(v.id));
        }
        return true;
    });

    // VINCULACIÓN GARANTIZADA: Si es Yitxel Cuenca (27611440) o absorbió a CLI-025 / Yixel
    const esYitxel = targetUpper === '27611440' || (clienteObj && (String(clienteObj.id).trim() === '27611440' || String(clienteObj.cedula).trim() === '27611440' || String(clienteObj.nombre).trim().toUpperCase().includes('YITXEL')));
    if (esYitxel) {
        const yaTieneVentaCLI025 = ventasCli.some(v => v.id === 'V_FIADO_CLI-025' || (String(v.clienteId).toUpperCase() === 'CLI-025' && Number(v.total || v.totalUSD || 0) === 1.80));
        if (!yaTieneVentaCLI025) {
            const fiadoLibreta = {
                id: 'V_FIADO_CLI-025',
                clienteId: '27611440',
                clienteNombre: 'Yitxel Cuenca',
                clienteCedula: '27611440',
                usuarioId: '27611440',
                vendedorId: 'ADMIN',
                vendedorNombre: 'Josna / Administración',
                fecha: '2026-09-23 12:00',
                items: [{
                    productoId: 'SALDO_INICIAL',
                    nombre: 'Saldo pendiente / Cuenta fiada libreta (Yixel - CLI-025)',
                    cantidad: 1,
                    precio: 1.80,
                    costo: 0,
                    subtotal: 1.80
                }],
                total: 1.80,
                totalUSD: 1.80,
                tipo: 'Crédito',
                tipoPago: 'Crédito',
                metodoDetalle: 'Crédito (Fiado inicial libreta)',
                referencia: 'Saldo inicial registrado por Josna (CLI-025 / Yixel)',
                estado: 'PENDIENTE',
                confirmada: false
            };
            ventasCli.unshift(fiadoLibreta);

            // Asegurar que también esté en AppState.ventas global
            if (Array.isArray(AppState.ventas) && !AppState.ventas.some(v => v.id === 'V_FIADO_CLI-025')) {
                AppState.ventas.unshift(fiadoLibreta);
                if (window.InventoryApp && window.InventoryApp.Persistence) {
                    window.InventoryApp.Persistence.guardar(true);
                }
            }
        }
    }

    // Comprobar cualquier otro cliente fusionado en AppState.clientesFusionados
    if (Array.isArray(AppState.clientesFusionados)) {
        AppState.clientesFusionados.forEach(cf => {
            if (!cf) return;
            const destUpper = String(cf.idDestino || '').trim().toUpperCase();
            if (destUpper === targetUpper || (clienteObj && destUpper === String(clienteObj.id).trim().toUpperCase())) {
                const yaTieneVenta = ventasCli.some(v => v.id === `V_FIADO_${cf.idOrigen}` || v.id === `V_FIADO_${cf.idOrigen}_FUSION`);
                if (!yaTieneVenta && Number(cf.deudaTransferidaUSD || 0) > 0) {
                    ventasCli.unshift({
                        id: `V_FIADO_${cf.idOrigen}_FUSION`,
                        clienteId: targetUpper,
                        clienteNombre: clienteObj?.nombre || 'Cliente',
                        fecha: cf.fecha ? cf.fecha.replace('T', ' ').substring(0, 16) : '2026-09-23 12:00',
                        items: [{
                            productoId: 'SALDO_INICIAL',
                            nombre: `Saldo pendiente transferido (${cf.nombreOrigen || cf.idOrigen})`,
                            cantidad: 1,
                            precio: Number(cf.deudaTransferidaUSD),
                            costo: 0,
                            subtotal: Number(cf.deudaTransferidaUSD)
                        }],
                        total: Number(cf.deudaTransferidaUSD),
                        totalUSD: Number(cf.deudaTransferidaUSD),
                        tipo: 'Crédito',
                        tipoPago: 'Crédito',
                        referencia: `Saldo transferido por unificación (${cf.nombreOrigen || cf.idOrigen})`,
                        estado: 'PENDIENTE',
                        confirmada: false
                    });
                }
            }
        });
    }

    // Filtrar abonos del cliente (solo abonos agregados, aprobados o confirmados)
    const abonosCli = abonosList.filter(a => {
        if (!coincideConCliente(a)) return false;
        const st = String(a.estado || '').toLowerCase();
        // Excluir rechazados y cancelados
        if (st === 'rechazado' || st === 'cancelado' || st === 'anulado') return false;
        // Solo considerar confirmados / agregados / aprobados (o sin estado explícito)
        return st === 'pago agregado' || st === 'confirmado' || st === 'aprobado' || !a.estado;
    });

    const totalCompradoUSD = ventasCli.reduce((sum, v) => sum + Number(v.total || v.totalUSD || 0), 0);
    const totalCreditoVentas = ventasCli
        .filter(v => v.tipo === 'Crédito' || v.tipoPago === 'Crédito' || v.esCargoManual || (v.items && v.items.some(i => i.productoId === 'CARGO_MANUAL')) || String(v.id).startsWith('CARGO_') || String(v.metodoDetalle || '').toLowerCase().includes('crédito'))
        .reduce((sum, v) => sum + Number(v.total || v.totalUSD || 0), 0);

    // Sumar abonos sanitizados
    let totalAbonadoUSD = 0;
    abonosCli.forEach(a => {
        const { montoUSD } = typeof sanitizarAbonoMonedas === 'function'
            ? sanitizarAbonoMonedas(a, tasa)
            : { montoUSD: Number(a.montoUSD || a.monto || 0) };
        totalAbonadoUSD += montoUSD;
    });
    totalAbonadoUSD = Number(totalAbonadoUSD.toFixed(2));

    // Determinar deuda inicial registrada directamente (saldo previo al sistema)
    let deudaDirecta = 0;
    if (typeof clienteObj?.deudaInicialUSD === 'number') {
        deudaDirecta = clienteObj.deudaInicialUSD;
    } else if (typeof oficialObj?.deudaInicialUSD === 'number') {
        deudaDirecta = oficialObj.deudaInicialUSD;
    } else if (clienteObj?.deudaUSD !== undefined && clienteObj?.deudaUSD !== null) {
        // Si no tiene deudaInicialUSD fijada, deducir la deuda inicial restando los créditos ya contabilizados
        if (totalCreditoVentas > 0) {
            deudaDirecta = Math.max(0, Number(clienteObj.deudaUSD || 0) - totalCreditoVentas + totalAbonadoUSD);
        } else {
            deudaDirecta = Number(clienteObj.deudaUSD || 0);
        }
        clienteObj.deudaInicialUSD = deudaDirecta;
    }

    // Verificar si ya existe una venta inicial de fiado en ventasCli (ej: V_FIADO_CLI-021)
    const tieneVentaFiadoInicial = ventasCli.some(v => v.id && String(v.id).startsWith('V_FIADO_'));

    let totalCreditoEfectivo = 0;
    if (tieneVentaFiadoInicial) {
        // La venta V_FIADO_ ya incluye la deuda inicial en totalCreditoVentas
        totalCreditoEfectivo = totalCreditoVentas;
    } else {
        // Si no está como V_FIADO_ en ventas, sumamos la deuda directa + las compras a crédito nuevas
        totalCreditoEfectivo = totalCreditoVentas + deudaDirecta;
    }

    // Regla de Negocio: Rebeca ya pagó toda deuda previa y no debe nada ($0.00)
    const esRebecaFin = (typeof esIdentificadorRebeca === 'function' && (
            esIdentificadorRebeca(identificadorOEntidad) ||
            esIdentificadorRebeca(targetId) ||
            esIdentificadorRebeca(targetUpper) ||
            esIdentificadorRebeca(clienteObj) ||
            esIdentificadorRebeca(usuarioObj) ||
            esIdentificadorRebeca(oficialObj)
        )) ||
        targetUpper === 'CLI-019' || 
        targetUpper.includes('REBECA') ||
        (clienteObj && (String(clienteObj.id).trim().toUpperCase() === 'CLI-019' || String(clienteObj.codigoOficial || '').trim().toUpperCase() === 'CLI-019' || String(clienteObj.nombre || '').trim().toUpperCase().includes('REBECA'))) ||
        (usuarioObj && String(usuarioObj.nombre || '').trim().toUpperCase().includes('REBECA')) ||
        (nombresNormalizados && (nombresNormalizados.has('REBECA') || Array.from(nombresNormalizados).some(n => n.includes('REBECA'))));

    if (esRebecaFin) {
        if (clienteObj) {
            clienteObj.deudaUSD = 0;
            clienteObj.deudaInicialUSD = 0;
        }
        if (usuarioObj) {
            usuarioObj.deudaUSD = 0;
            usuarioObj.saldoDeudaUSD = 0;
        }
        // Purgar de ventasCli cualquier venta de fiado transferida
        ventasCli = ventasCli.filter(v => {
            if (!v || !v.id) return true;
            const vId = String(v.id).toUpperCase();
            if (vId.startsWith('V_FIADO_') || vId.includes('FUSION')) return false;
            if (v.items && v.items.some(i => i.productoId === 'SALDO_INICIAL')) return false;
            return true;
        });

        // Convertir cualquier compra de crédito previa a pagada de contado
        ventasCli.forEach(v => {
            v.tipo = 'Contado';
            v.tipoPago = 'Contado';
            v.estado = 'PAGADA';
            v.confirmada = true;
            v.esCargoManual = false;
            v.metodoDetalle = 'Pagado / Solvente';
        });

        totalCreditoEfectivo = totalAbonadoUSD;
    }

    let saldoDeudaUSD = Math.max(0, Number((totalCreditoEfectivo - totalAbonadoUSD).toFixed(2)));
    if (esRebecaFin) {
        saldoDeudaUSD = 0;
    }
    const saldoDeudaVES = tasa > 0 ? Number((saldoDeudaUSD * tasa).toFixed(2)) : 0;
    const totalCompradoTotalUSD = Math.max(totalCompradoUSD, totalCreditoEfectivo);
    const totalCompradoVES = tasa > 0 ? Number((totalCompradoTotalUSD * tasa).toFixed(2)) : 0;
    const totalAbonadoVES = tasa > 0 ? Number((totalAbonadoUSD * tasa).toFixed(2)) : 0;

    return {
        totalCompradoUSD: totalCompradoTotalUSD,
        totalCompradoVES,
        totalCreditoUSD: esRebecaFin ? totalAbonadoUSD : totalCreditoEfectivo,
        totalAbonadoUSD,
        totalAbonadoVES,
        saldoDeudaUSD,
        saldoDeudaVES,
        clienteObj,
        usuarioObj,
        ventasCliente: ventasCli,
        abonosCliente: abonosCli,
        esSolvente: esRebecaFin ? true : (saldoDeudaUSD <= 0.01)
    };
}
window.calcularEstadoFinancieroCliente = calcularEstadoFinancieroCliente;

let busquedaCliente = '';
let filtroEstadoCliente = 'todos'; // 'todos' | 'deuda' | 'al-dia'

function toggleFormularioNuevoCliente() {
    const form = document.getElementById('form-cliente');
    const txt = document.getElementById('txt-toggle-nuevo-cliente');
    const icono = document.getElementById('icono-toggle-nuevo-cliente');
    if (!form) return;
    const estaOculto = form.style.display === 'none' || !form.style.display;
    if (estaOculto) {
        form.style.display = 'grid';
        if (txt) txt.textContent = 'Ocultar';
        if (icono) {
            icono.classList.remove('fa-chevron-down');
            icono.classList.add('fa-chevron-up');
        }
        const primerInput = document.getElementById('cli-id');
        if (primerInput) setTimeout(() => primerInput.focus(), 50);
    } else {
        form.style.display = 'none';
        if (txt) txt.textContent = '+ Agregar';
        if (icono) {
            icono.classList.remove('fa-chevron-up');
            icono.classList.add('fa-chevron-down');
        }
    }
}
window.toggleFormularioNuevoCliente = toggleFormularioNuevoCliente;

function alBuscarCliente(val) {
    busquedaCliente = (val || '').toLowerCase().trim();
    const btnLimpiar = document.getElementById('btn-limpiar-buscar-cliente');
    if (btnLimpiar) btnLimpiar.style.display = busquedaCliente ? 'block' : 'none';
    renderizarClientes();
}
window.alBuscarCliente = alBuscarCliente;

function limpiarBuscadorCliente() {
    busquedaCliente = '';
    const input = document.getElementById('input-buscar-cliente');
    if (input) input.value = '';
    const btnLimpiar = document.getElementById('btn-limpiar-buscar-cliente');
    if (btnLimpiar) btnLimpiar.style.display = 'none';
    renderizarClientes();
}
window.limpiarBuscadorCliente = limpiarBuscadorCliente;

function filtrarClientesEstado(estado) {
    filtroEstadoCliente = estado || 'todos';
    ['todos', 'deuda', 'al-dia'].forEach(st => {
        const chip = document.getElementById(`chip-cli-${st}`);
        if (chip) {
            if (st === filtroEstadoCliente) chip.classList.add('active');
            else chip.classList.remove('active');
        }
    });
    renderizarClientes();
}
window.filtrarClientesEstado = filtrarClientesEstado;

function asegurarClientesOficiales() {
    if (typeof CLIENTES_OFICIALES !== 'undefined' && Array.isArray(CLIENTES_OFICIALES)) {
        const eliminadosList = Array.isArray(AppState.clientesEliminados) ? AppState.clientesEliminados : (window.clientesEliminados || []);
        const fusionadosList = Array.isArray(AppState.clientesFusionados) ? AppState.clientesFusionados : [];

        // Filtrar clientes oficiales que fueron eliminados o excluidos
        const oficialesActivos = CLIENTES_OFICIALES.filter(co => !esClienteEliminadoOExcluido(co, eliminadosList));

        if (!Array.isArray(clientes) || clientes.length === 0) {
            clientes = JSON.parse(JSON.stringify(oficialesActivos));
            AppState.clientes = clientes;
        } else {
            // Purgar de la lista activa cualquier cliente que figure en clientesEliminados
            if (eliminadosList.length > 0) {
                const clientesFiltrados = clientes.filter(c => !esClienteEliminadoOExcluido(c, eliminadosList));
                if (clientesFiltrados.length !== clientes.length) {
                    clientes = clientesFiltrados;
                    AppState.clientes = clientes;
                }
            }

            const abonosList = Array.isArray(abonos) ? abonos : (AppState.abonos || []);

            oficialesActivos.forEach(co => {
                const idCoUpper = String(co.id || '').toUpperCase();
                // Si fue fusionado explícitamente, o si otro cliente lo absorbió
                const estaFusionado = fusionadosList.some(f => String(f.idOrigen || f.id || '').toUpperCase() === idCoUpper);
                const fueAbsorbido = clientes.some(c => 
                    (Array.isArray(c.codigosAnteriores) && c.codigosAnteriores.map(x => String(x).toUpperCase()).includes(idCoUpper)) ||
                    (c.id === '27611440' && idCoUpper === 'CLI-025')
                );

                if (estaFusionado || fueAbsorbido) return;

                const cExistente = clientes.find(c => c.id === co.id || (c.nombre && c.nombre.trim().toLowerCase() === co.nombre.trim().toLowerCase()));
                if (!cExistente) {
                    clientes.push(JSON.parse(JSON.stringify(co)));
                } else {
                    if ((cExistente.deudaUSD === undefined || cExistente.deudaUSD === null || cExistente.deudaUSD === 0) && co.deudaUSD > 0) {
                        const tieneAbono = abonosList.some(a => 
                            (a.clienteId === cExistente.id || a.clienteNombre === cExistente.nombre || a.clienteCedula === cExistente.cedula) &&
                            (a.estado === 'Pago agregado' || a.estado === 'Confirmado' || !a.estado)
                        );
                        if (!tieneAbono) {
                            cExistente.deudaUSD = co.deudaUSD;
                            cExistente.deudaInicialUSD = co.deudaInicialUSD;
                        }
                    }
                    if (cExistente.deudaInicialUSD === undefined || cExistente.deudaInicialUSD === null) {
                        cExistente.deudaInicialUSD = co.deudaInicialUSD;
                    }
                }
            });
            AppState.clientes = clientes;
        }
    }
}

function asegurarDeudaConsolidadaYitxelCuenca() {
    const lista = Array.isArray(AppState.clientes) ? AppState.clientes : [];
    const yitxel = lista.find(c => String(c.id).trim() === '27611440' || String(c.cedula).trim() === '27611440' || (c.nombre && String(c.nombre).trim().toUpperCase().includes('YITXEL')));
    if (!yitxel) return;

    // Asegurar identificadores consolidados
    yitxel.codigoOficial = 'CLI-025';
    yitxel.codigosAnteriores = Array.isArray(yitxel.codigosAnteriores) ? yitxel.codigosAnteriores : [];
    if (!yitxel.codigosAnteriores.includes('CLI-025')) yitxel.codigosAnteriores.push('CLI-025');

    yitxel.nombresAnteriores = Array.isArray(yitxel.nombresAnteriores) ? yitxel.nombresAnteriores : [];
    if (!yitxel.nombresAnteriores.includes('Yixel')) yitxel.nombresAnteriores.push('Yixel');

    if (!yitxel.telefono) yitxel.telefono = '04125611155';

    // Registrar en clientesFusionados si no estaba
    if (!Array.isArray(AppState.clientesFusionados)) AppState.clientesFusionados = [];
    if (!AppState.clientesFusionados.some(f => f.idOrigen === 'CLI-025')) {
        AppState.clientesFusionados.push({
            idOrigen: 'CLI-025',
            nombreOrigen: 'Yixel',
            idDestino: '27611440',
            nombreDestino: 'Yitxel Cuenca',
            deudaTransferidaUSD: 1.80,
            comprasTransferidasUSD: 1.80,
            fecha: new Date().toISOString()
        });
    }

    // Asegurar que la venta fiado de $1.80 esté en AppState.ventas asignada a Yitxel Cuenca (27611440)
    if (!Array.isArray(AppState.ventas)) AppState.ventas = [];
    let ventaFiado = AppState.ventas.find(v => v.id === 'V_FIADO_CLI-025' || (v.clienteId === 'CLI-025') || (v.clienteNombre && String(v.clienteNombre).trim().toUpperCase() === 'YIXEL'));

    let huboCambioVenta = false;
    if (!ventaFiado) {
        ventaFiado = {
            id: 'V_FIADO_CLI-025',
            clienteId: '27611440',
            clienteNombre: 'Yitxel Cuenca',
            clienteCedula: '27611440',
            usuarioId: '27611440',
            codigoOficial: 'CLI-025',
            vendedorId: 'ADMIN',
            vendedorNombre: 'Josna / Administración',
            fecha: '2026-09-23 12:00',
            items: [
                {
                    productoId: 'SALDO_INICIAL',
                    nombre: 'Saldo pendiente / Cuenta fiada libreta Josna (Yixel - CLI-025)',
                    cantidad: 1,
                    precio: 1.80,
                    costo: 0,
                    subtotal: 1.80
                }
            ],
            total: 1.80,
            totalUSD: 1.80,
            tipo: 'Crédito',
            tipoPago: 'Crédito',
            metodoDetalle: 'Crédito (Fiado inicial libreta)',
            referencia: 'Saldo inicial libreta registrado por Josna (CLI-025)',
            estado: 'PENDIENTE',
            confirmada: false
        };
        AppState.ventas.unshift(ventaFiado);
        huboCambioVenta = true;
    } else {
        if (ventaFiado.clienteId !== '27611440' || ventaFiado.clienteNombre !== 'Yitxel Cuenca' || ventaFiado.tipo !== 'Crédito' || Number(ventaFiado.total || 0) !== 1.80) {
            ventaFiado.clienteId = '27611440';
            ventaFiado.clienteNombre = 'Yitxel Cuenca';
            ventaFiado.clienteCedula = '27611440';
            ventaFiado.usuarioId = '27611440';
            ventaFiado.tipo = 'Crédito';
            ventaFiado.tipoPago = 'Crédito';
            ventaFiado.total = 1.80;
            ventaFiado.totalUSD = 1.80;
            huboCambioVenta = true;
        }
    }

    // Asegurar que CLI-025 no exista como cliente separado en AppState.clientes
    const idxSec = AppState.clientes.findIndex(c => String(c.id).trim().toUpperCase() === 'CLI-025');
    if (idxSec !== -1) {
        AppState.clientes.splice(idxSec, 1);
        if (typeof clientes !== 'undefined') clientes = AppState.clientes;
        huboCambioVenta = true;
    }

    // Guardar únicamente en almacenamiento local (nunca disparar escrituras en la nube durante renderizado)
    if (huboCambioVenta && window.InventoryApp && window.InventoryApp.Persistence) {
        window.InventoryApp.Persistence.guardar(false);
    }
}
window.asegurarDeudaConsolidadaYitxelCuenca = asegurarDeudaConsolidadaYitxelCuenca;

function renderizarClientes() {
    asegurarClientesOficiales();
    asegurarDeudaConsolidadaYitxelCuenca();
    if (typeof asegurarSincronizacionUsuariosAClientes === 'function') {
        asegurarSincronizacionUsuariosAClientes(false);
    }
    if (typeof verificarSugerenciasFusionClientes === 'function') {
        verificarSugerenciasFusionClientes();
    }

    const lista = Array.isArray(clientes) ? clientes : (AppState.clientes || []);

    // Sincronizar deudas consistentes para todos los clientes con su balance contable
    if (typeof calcularEstadoFinancieroCliente === 'function') {
        lista.forEach(c => {
            if (c && c.id && c.id !== 'V-00000000') {
                const estadoFin = calcularEstadoFinancieroCliente(c.id || c);
                if (estadoFin && typeof estadoFin.saldoDeudaUSD === 'number') {
                    c.deudaUSD = estadoFin.saldoDeudaUSD;
                }
            }
        });
    }

    if (typeof renderizarCustomClientePickersPOS === 'function') {
        renderizarCustomClientePickersPOS('both');
    }

    const tbody = document.getElementById('clientes-body');
    const mobileList = document.getElementById('clientes-mobile-list');
    if (!tbody && !mobileList) return;

    const tasa = typeof tasaActiva === 'number' && tasaActiva > 0 ? tasaActiva : (AppState.tasaActiva || 1);

    // Calcular métricas financieras globales para los KPIs
    let clientesConDeuda = 0;
    let totalDeudaGlobalUSD = 0;

    const clientesConEstado = lista.map(c => {
        const estadoFin = calcularEstadoFinancieroCliente(c.id);
        c.deudaUSD = estadoFin.saldoDeudaUSD; // Asegurar consistencia absoluta de deuda en todo el sistema
        if (estadoFin.saldoDeudaUSD > 0) {
            clientesConDeuda++;
            totalDeudaGlobalUSD += estadoFin.saldoDeudaUSD;
        }
        return {
            ...c,
            ...estadoFin
        };
    });

    // Actualizar KPIs de Cartera en cabecera
    const kpiTotalCli = document.getElementById('cli-kpi-total-clientes');
    if (kpiTotalCli) kpiTotalCli.textContent = lista.length;

    const kpiConDeuda = document.getElementById('cli-kpi-con-deuda');
    if (kpiConDeuda) kpiConDeuda.textContent = clientesConDeuda;

    const kpiDeudaUsd = document.getElementById('cli-kpi-total-deuda-usd');
    if (kpiDeudaUsd) kpiDeudaUsd.textContent = `$${totalDeudaGlobalUSD.toFixed(2)}`;

    const kpiDeudaVes = document.getElementById('cli-kpi-total-deuda-ves');
    if (kpiDeudaVes) {
        kpiDeudaVes.textContent = `Bs. ${tasa > 0 ? (totalDeudaGlobalUSD * tasa).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}`;
    }

    // Actualizar contadores en chips de filtro
    const countTodos = document.getElementById('count-cli-todos');
    if (countTodos) countTodos.textContent = lista.length;

    const countDeuda = document.getElementById('count-cli-deuda');
    if (countDeuda) countDeuda.textContent = clientesConDeuda;

    const countAlDia = document.getElementById('count-cli-al-dia');
    if (countAlDia) countAlDia.textContent = Math.max(0, lista.length - clientesConDeuda);

    const countEliminados = document.getElementById('count-cli-eliminados');
    if (countEliminados) {
        const eliminadosList = Array.isArray(clientesEliminados) ? clientesEliminados : (AppState.clientesEliminados || []);
        countEliminados.textContent = eliminadosList.length;
    }

    const usuariosListGlobal = Array.isArray(AppState.usuarios) ? AppState.usuarios : (window.usuarios || []);

    // Filtrar lista según búsqueda y estado
    let clientesFiltrados = clientesConEstado.filter(c => {
        // Filtro por estado
        if (filtroEstadoCliente === 'deuda' && c.saldoDeudaUSD <= 0) return false;
        if (filtroEstadoCliente === 'al-dia' && c.saldoDeudaUSD > 0) return false;

        // Filtro por texto de búsqueda
        if (busquedaCliente) {
            const b = busquedaCliente.toLowerCase();
            const idLower = String(c.id || '').toLowerCase();
            const cedLower = String(c.cedula || '').toLowerCase();
            const nomLower = String(c.nombre || '').toLowerCase();
            const telLower = String(c.telefono || '').toLowerCase();
            const emLower = String(c.email || '').toLowerCase();
            const uIdLower = String(c.usuarioId || '').toLowerCase();
            const codLower = String(c.codigoOficial || '').toLowerCase();

            // Buscar también en usuario vinculado de AppState.usuarios
            const uVinc = usuariosListGlobal.find(u => 
                (u.clienteId && u.clienteId === c.id) || 
                (u.cedula && String(u.cedula).toUpperCase() === String(c.id).toUpperCase()) ||
                (c.cedula && String(u.cedula).toUpperCase() === String(c.cedula).toUpperCase()) ||
                (c.usuarioId && String(u.id).toUpperCase() === String(c.usuarioId).toUpperCase()) ||
                (c.nombre && u.nombre && String(u.nombre).trim().toUpperCase() === String(c.nombre).trim().toUpperCase())
            );
            const uIdVinc = String(uVinc?.id || '').toLowerCase();
            const uCedVinc = String(uVinc?.cedula || '').toLowerCase();
            const uNomVinc = String(uVinc?.nombre || '').toLowerCase();
            const uEmVinc = String(uVinc?.email || '').toLowerCase();
            const uTelVinc = String(uVinc?.telefono || '').toLowerCase();

            const match = idLower.includes(b) || 
                          cedLower.includes(b) || 
                          nomLower.includes(b) || 
                          telLower.includes(b) || 
                          emLower.includes(b) || 
                          uIdLower.includes(b) || 
                          codLower.includes(b) ||
                          uIdVinc.includes(b) ||
                          uCedVinc.includes(b) ||
                          uNomVinc.includes(b) ||
                          uEmVinc.includes(b) ||
                          uTelVinc.includes(b);

            if (!match) {
                return false;
            }
        }
        return true;
    });

    const counterBadge = document.getElementById('cli-counter-badge');
    if (counterBadge) {
        if (busquedaCliente || filtroEstadoCliente !== 'todos') {
            counterBadge.textContent = `Mostrando ${clientesFiltrados.length} de ${lista.length} clientes`;
        } else {
            counterBadge.textContent = `${lista.length} clientes registrados`;
        }
    }

    if (!clientesFiltrados.length) {
        const mensajeVacio = lista.length === 0
            ? 'No hay clientes registrados en el directorio.'
            : 'No se encontraron clientes que coincidan con la búsqueda o filtro seleccionado.';

        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:35px 20px; color:var(--text-muted);"><i class="fas fa-search" style="font-size:1.8rem; opacity:0.35; margin-bottom:10px; display:block;"></i>${mensajeVacio}</td></tr>`;
        }
        if (mobileList) {
            mobileList.innerHTML = `<div class="card" style="text-align:center; padding:35px 20px; color:var(--text-muted); border-radius:14px;"><i class="fas fa-search" style="font-size:2rem; opacity:0.35; margin-bottom:10px; display:block;"></i>${mensajeVacio}</div>`;
        }
        return;
    }

    if (tbody) {
        const usuariosList = Array.isArray(AppState.usuarios) ? AppState.usuarios : (window.usuarios || []);

        tbody.innerHTML = clientesFiltrados.map(c => {
            const idSafe = typeof escaparHtmlInventario === 'function' ? escaparHtmlInventario(c.id) : c.id;
            const nomSafe = typeof escaparHtmlInventario === 'function' ? escaparHtmlInventario(c.nombre || c.id) : (c.nombre || c.id);
            const telSafe = typeof escaparHtmlInventario === 'function' ? escaparHtmlInventario(c.telefono || '—') : (c.telefono || '—');
            const tieneDeuda = c.saldoDeudaUSD > 0;

            const userVinculado = usuariosList.find(u => 
                u.clienteId === c.id || 
                (u.cedula && String(u.cedula).toUpperCase() === String(c.id).toUpperCase()) ||
                (c.cedula && String(u.cedula).toUpperCase() === String(c.cedula).toUpperCase()) ||
                (c.usuarioId && String(u.id).toUpperCase() === String(c.usuarioId).toUpperCase())
            );
            const userBadge = userVinculado 
                ? `<span class="badge" style="background:rgba(22,163,74,0.1); color:#15803d; font-size:0.7rem; padding:2px 6px; border-radius:4px; margin-left:6px; font-weight:600;" title="Cuenta de usuario activa: ${userVinculado.cedula}"><i class="fas fa-user-check"></i> Usuario: ${userVinculado.cedula}</span>`
                : `<span class="badge" style="background:rgba(100,116,139,0.08); color:var(--text-muted); font-size:0.7rem; padding:2px 6px; border-radius:4px; margin-left:6px;" title="Sin cuenta de usuario creada aún"><i class="fas fa-user-clock"></i> Sin usuario</span>`;

            return `
                <tr>
                    <td><strong>${idSafe}</strong></td>
                    <td style="font-weight:600; color:var(--text-main);">
                        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                            <span>${nomSafe}</span>
                            ${userBadge}
                        </div>
                    </td>
                    <td>${telSafe}</td>
                    <td class="num">$${c.totalCompradoUSD.toFixed(2)}</td>
                    <td class="num" style="color: ${tieneDeuda ? 'var(--danger)' : '#16a34a'}; font-weight: bold;">
                        $${c.saldoDeudaUSD.toFixed(2)}
                    </td>
                    <td class="num" style="color: ${tieneDeuda ? 'var(--danger)' : '#16a34a'}; font-weight: bold;">
                        Bs. ${tasa > 0 ? c.saldoDeudaVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                    </td>
                    <td style="text-align:center; white-space:nowrap;">
                        <div style="display:inline-flex; gap:6px; align-items:center;">
                            <button type="button" class="btn btn-sm" onclick="abrirModalSumarDeudaCliente('${c.id}')" title="Sumar deuda o préstamo de dinero sin afectar inventario" style="background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5; padding:5px 9px; border-radius:8px; font-weight:700; display:inline-flex; align-items:center; gap:4px;">
                                <i class="fas fa-hand-holding-dollar"></i> +Deuda
                            </button>
                            <button type="button" class="btn btn-sm btn-primary" onclick="verDetalleCliente('${c.id}')" style="display:inline-flex; align-items:center; gap:5px; font-weight:600; padding:5px 10px; border-radius:8px;">
                                <i class="fas fa-gauge"></i> Panel 360°
                            </button>
                            <button type="button" class="btn btn-sm btn-outline-danger" onclick="abrirModalEliminarCliente('${c.id}')" title="Eliminar cliente" style="padding:5px 9px; border-radius:8px;">
                                <i class="fas fa-trash-can"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    if (mobileList) {
        const usuariosList = Array.isArray(AppState.usuarios) ? AppState.usuarios : (window.usuarios || []);

        mobileList.innerHTML = clientesFiltrados.map(c => {
            const idSafe = typeof escaparHtmlInventario === 'function' ? escaparHtmlInventario(c.id) : c.id;
            const nomSafe = typeof escaparHtmlInventario === 'function' ? escaparHtmlInventario(c.nombre || c.id) : (c.nombre || c.id);
            const telSafe = typeof escaparHtmlInventario === 'function' ? escaparHtmlInventario(c.telefono || '—') : (c.telefono || '—');
            const tieneDeuda = c.saldoDeudaUSD > 0;
            const iniciales = (c.nombre || c.id || 'CL')
                .split(' ')
                .map(w => w[0])
                .filter(Boolean)
                .slice(0, 2)
                .join('')
                .toUpperCase();

            const userVinculado = usuariosList.find(u => 
                u.clienteId === c.id || 
                (u.cedula && String(u.cedula).toUpperCase() === String(c.id).toUpperCase()) ||
                (c.cedula && String(u.cedula).toUpperCase() === String(c.cedula).toUpperCase()) ||
                (c.usuarioId && String(u.id).toUpperCase() === String(c.usuarioId).toUpperCase())
            );
            const userBadge = userVinculado 
                ? `<span class="badge" style="background:rgba(22,163,74,0.1); color:#15803d; font-size:0.68rem; padding:1px 5px; border-radius:4px; font-weight:600;"><i class="fas fa-user-check"></i> Usuario: ${userVinculado.cedula}</span>`
                : `<span class="badge" style="background:rgba(100,116,139,0.08); color:var(--text-muted); font-size:0.68rem; padding:1px 5px; border-radius:4px;"><i class="fas fa-user-clock"></i> Sin usuario</span>`;

            return `
                <div class="clientes-item-card">
                    <div class="clientes-item-top">
                        <div class="clientes-item-avatar">
                            <span>${iniciales}</span>
                        </div>
                        <div class="clientes-item-info">
                            <div class="clientes-item-name" style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                                <span>${nomSafe}</span>
                                ${userBadge}
                            </div>
                            <div class="clientes-item-meta">
                                <span><i class="fas fa-id-card"></i> ${idSafe}</span>
                                ${c.telefono ? `<span><i class="fas fa-phone"></i> ${telSafe}</span>` : ''}
                            </div>
                        </div>
                        <div class="clientes-item-financial">
                            ${tieneDeuda ? `
                                <div class="clientes-item-deuda-pill badge-danger">
                                    <span class="lbl">Deuda</span>
                                    <span class="val">$${c.saldoDeudaUSD.toFixed(2)}</span>
                                    <small class="sub">Bs. ${tasa > 0 ? c.saldoDeudaVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</small>
                                </div>
                            ` : `
                                <div class="clientes-item-deuda-pill badge-success">
                                    <span class="val"><i class="fas fa-check-circle"></i> Al día</span>
                                    <small class="sub">$0.00</small>
                                </div>
                            `}
                        </div>
                    </div>
                    <div class="clientes-item-bottom">
                        <div class="clientes-item-comprado">
                            <span class="lbl">Comprado total:</span>
                            <span class="val">$${c.totalCompradoUSD.toFixed(2)}</span>
                        </div>
                        <div class="clientes-item-actions">
                            <button type="button" class="btn btn-sm" onclick="abrirModalSumarDeudaCliente('${c.id}')" title="Sumar deuda o préstamo de dinero sin afectar inventario" style="background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5; padding:6px 10px; border-radius:8px; font-weight:700; display:inline-flex; align-items:center; gap:4px;">
                                <i class="fas fa-hand-holding-dollar"></i> +Deuda
                            </button>
                            <button type="button" class="btn btn-sm btn-primary" onclick="verDetalleCliente('${c.id}')" style="display:inline-flex; align-items:center; gap:5px; font-weight:600; padding:6px 12px; border-radius:8px;">
                                <i class="fas fa-gauge"></i> Panel 360°
                            </button>
                            <button type="button" class="btn btn-sm btn-outline-danger" onclick="abrirModalEliminarCliente('${c.id}')" title="Eliminar cliente" style="padding:6px 10px; border-radius:8px;">
                                <i class="fas fa-trash-can"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

function abrirModalEliminarCliente(clienteId) {
    const cliente = clientes.find(c => c.id === clienteId);
    if (!cliente) return;

    const modal = document.getElementById('modal-eliminar-cliente');
    if (!modal) return;

    const estado = calcularEstadoFinancieroCliente(clienteId);
    document.getElementById('eliminar-cliente-id').value = cliente.id;
    document.getElementById('eliminar-cliente-identificador').value = cliente.id;
    document.getElementById('eliminar-cliente-nombre').value = cliente.nombre;
    document.getElementById('eliminar-cliente-telefono').value = cliente.telefono || '';
    document.getElementById('eliminar-cliente-deuda').value = `$${estado.saldoDeudaUSD.toFixed(2)}`;
    document.getElementById('eliminar-cliente-motivo').value = '';
    document.getElementById('eliminar-cliente-comentario').value = '';
    modal.classList.add('active');
    setTimeout(() => document.getElementById('eliminar-cliente-motivo').focus(), 50);
}

function cerrarModalEliminarCliente() {
    const modal = document.getElementById('modal-eliminar-cliente');
    if (modal) modal.classList.remove('active');
}

function confirmarEliminacionCliente(event) {
    event.preventDefault();

    const clienteId = document.getElementById('eliminar-cliente-id').value;
    const motivo = document.getElementById('eliminar-cliente-motivo').value.trim();
    const comentario = document.getElementById('eliminar-cliente-comentario').value.trim();
    
    // Búsqueda flexible tolerante a mayúsculas/minúsculas y 'O' vs '0' (ej CLI-013 vs cli-o13)
    const norm = s => String(s || '').trim().toUpperCase().replace(/[\s\-_]/g, '').replace(/O/g, '0');
    const targetNorm = norm(clienteId);

    const indice = clientes.findIndex(c => {
        if (!c) return false;
        if (c.id === clienteId || String(c.id).toUpperCase() === String(clienteId).toUpperCase()) return true;
        if (norm(c.id) === targetNorm) return true;
        return false;
    });

    if (indice === -1) {
        cerrarModalEliminarCliente();
        return;
    }
    if (!motivo || !comentario) {
        alert('Debes indicar el motivo y el comentario para eliminar al cliente.');
        return;
    }

    const cliente = clientes[indice];
    const estado = calcularEstadoFinancieroCliente(cliente.id || clienteId);
    const fecha = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const motivoLower = motivo.toLowerCase();
    const esDuplicadoOError = motivoLower.includes('duplicad') || 
                              motivoLower.includes('error') || 
                              motivoLower.includes('incorrect') || 
                              motivoLower.includes('inactivo') || 
                              motivoLower.includes('solicitud');

    // Regla de Negocio: Si la eliminación es por duplicados o error de registro,
    // NO genera pérdida económica alguna (perdidaUSD = 0) para no inflar mermas ni afectar márgenes del negocio.
    // Tampoco altera el inventario físico ni los productos (el conteo físico se respeta 100%).
    const perdidaCalculada = esDuplicadoOError ? 0 : Math.max(0, estado.saldoDeudaUSD);

    const codigosVariantes = [cliente.id, clienteId];
    if (/^CLI-[0O]13$/i.test(cliente.id) || /^CLI-[0O]13$/i.test(clienteId)) {
        codigosVariantes.push('CLI-013', 'cli-o13', 'CLI-O13', 'cli-013');
    }

    const registroEliminado = {
        id: cliente.id,
        cedula: cliente.cedula || cliente.id,
        nombre: cliente.nombre,
        telefono: cliente.telefono || '',
        fecha,
        totalCompradoUSD: estado.totalCompradoUSD,
        deudaUSD: estado.saldoDeudaUSD,
        perdidaUSD: perdidaCalculada,
        motivo,
        comentario,
        codigosAnteriores: Array.from(new Set(codigosVariantes)),
        esDuplicado: esDuplicadoOError
    };

    if (!Array.isArray(AppState.clientesEliminados)) {
        AppState.clientesEliminados = [];
    }
    AppState.clientesEliminados.push(registroEliminado);
    if (typeof clientesEliminados !== 'undefined' && clientesEliminados !== AppState.clientesEliminados) {
        clientesEliminados.push(registroEliminado);
    }

    // Purgar todas las copias o instancias duplicadas de este cliente de AppState.clientes y window.clientes
    const idNormElim = norm(cliente.id);
    const nombreElim = String(cliente.nombre || '').trim().toLowerCase();
    AppState.clientes = (AppState.clientes || []).filter(c => {
        if (!c) return false;
        if (c.id === cliente.id || c.id === clienteId) return false;
        if (norm(c.id) === idNormElim) return false;
        if (nombreElim && c.nombre && String(c.nombre).trim().toLowerCase() === nombreElim && esDuplicadoOError) {
            return false;
        }
        return true;
    });
    clientes = AppState.clientes;

    // Guardar en almacenamiento local persistente de inmediato
    if (window.InventoryApp && window.InventoryApp.Persistence) {
        window.InventoryApp.Persistence.guardar(true);
    }

    // Sincronizar eliminación en Firestore
    if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.eliminarCliente === 'function') {
        window.InventoryApp.Firebase.eliminarCliente(clienteId, registroEliminado).catch(err => {
            console.warn('[Clientes] Error al eliminar cliente en Firestore:', err);
        });
        if (cliente.id !== clienteId) {
            window.InventoryApp.Firebase.eliminarCliente(cliente.id, registroEliminado).catch(() => {});
        }
    }

    if (clienteSeleccionadoId === clienteId || clienteSeleccionadoId === cliente.id) {
        clienteSeleccionadoId = null;
        const detalle = document.getElementById('cliente-detalle-card');
        if (detalle) detalle.style.display = 'none';
    }

    cerrarModalEliminarCliente();
    actualizarSelectClientes();
    renderizarClientes();
    renderizarHistorialClientesEliminados();
    if (typeof renderizarResumenPerdidasEconomicas === 'function') {
        renderizarResumenPerdidasEconomicas();
    }

    alert(`Cliente ${cliente.nombre} eliminado correctamente.${esDuplicadoOError ? ' (Eliminado como duplicado/error de registro: no afecta inventario ni margen de pérdidas).' : ''}`);
}

function renderizarHistorialClientesEliminados() {
    const tbody = document.getElementById('clientes-eliminados-body');
    if (!tbody) return;

    tbody.innerHTML = clientesEliminados.length ? clientesEliminados.slice().reverse().map(c => `
        <tr>
            <td>${c.fecha}</td>
            <td>${c.id}</td>
            <td>${c.nombre}</td>
            <td class="num">$${Number(c.deudaUSD || 0).toFixed(2)}</td>
            <td class="num" style="color:${Number(c.perdidaUSD || 0) > 0 ? 'var(--danger)' : 'var(--text-muted)'}; font-weight:700;">${Number(c.perdidaUSD || 0) > 0 ? '-$' : '$'}${Number(c.perdidaUSD || 0).toFixed(2)}</td>
            <td>${c.motivo}</td>
            <td>${c.comentario}</td>
        </tr>
    `).join('') : `<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">No hay clientes eliminados.</td></tr>`;
}

function limpiarHistorialClientesEliminados() {
    if (!clientesEliminados.length) return;
    if (!confirm('¿Seguro que deseas limpiar el historial de clientes eliminados? Esto no restaurará los clientes.')) return;
    clientesEliminados = [];
    renderizarHistorialClientesEliminados();
    renderizarResumenPerdidasEconomicas();
}

function verDetalleCliente(id, abrirModal = true) {
    clienteSeleccionadoId = id;
    const lista = Array.isArray(clientes) ? clientes : (AppState.clientes || []);
    const cliente = lista.find(c => c.id === id);
    if (!cliente) return;

    const tasa = typeof tasaActiva === 'number' && tasaActiva > 0 ? tasaActiva : (AppState.tasaActiva || 1);
    const { totalCompradoUSD, totalCompradoVES, saldoDeudaUSD, saldoDeudaVES, ventasCliente, abonosCliente } = calcularEstadoFinancieroCliente(id);
    const tieneDeuda = saldoDeudaUSD > 0;
    const iniciales = (cliente.nombre || cliente.id || 'CL')
        .split(' ')
        .map(w => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase();

    // Actualizar cabecera del modal
    const avatarEl = document.getElementById('det-cliente-avatar');
    if (avatarEl) avatarEl.textContent = iniciales;

    const nombreEl = document.getElementById('det-cliente-nombre');
    if (nombreEl) nombreEl.textContent = cliente.nombre || cliente.id;

    const badgeEstadoEl = document.getElementById('det-cliente-estado-badge');
    if (badgeEstadoEl) {
        if (tieneDeuda) {
            badgeEstadoEl.className = 'det-status-badge badge-danger';
            badgeEstadoEl.innerHTML = `<i class="fas fa-triangle-exclamation"></i> Deuda: $${saldoDeudaUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        } else {
            badgeEstadoEl.className = 'det-status-badge badge-success';
            badgeEstadoEl.innerHTML = `<i class="fas fa-check-circle"></i> Al día ($0.00 en portal cliente)`;
        }
    }

    const idTextEl = document.getElementById('det-cliente-id-text');
    if (idTextEl) idTextEl.innerHTML = `<i class="fas fa-id-card"></i> Cédula: <strong>${cliente.id}</strong>`;

    const telTextEl = document.getElementById('det-cliente-tel-text');
    if (telTextEl) telTextEl.innerHTML = `<i class="fas fa-phone"></i> Tel: <strong>${cliente.telefono || '—'}</strong>`;

    // Email del cliente o usuario vinculado
    const emailCli = cliente.email || (Array.isArray(AppState.usuarios) && AppState.usuarios.find(u => (u.cedula || u.id) === cliente.id || u.id === cliente.usuarioId)?.email) || '';
    const emailTextEl = document.getElementById('det-cliente-email-text');
    if (emailTextEl) emailTextEl.innerHTML = `<i class="fas fa-envelope"></i> Correo: <strong>${emailCli || '—'}</strong>`;

    // Botón WhatsApp
    const btnWa = document.getElementById('det-btn-whatsapp');
    if (btnWa) {
        if (cliente.telefono && cliente.telefono.trim()) {
            btnWa.style.display = 'inline-flex';
        } else {
            btnWa.style.display = 'none';
        }
    }

    // Botón Correo Electrónico
    const btnEmail = document.getElementById('det-btn-email');
    if (btnEmail) {
        if (emailCli && emailCli.trim()) {
            btnEmail.style.display = 'inline-flex';
        } else {
            btnEmail.style.display = 'none';
        }
    }

    // KPIs del modal con formato de miles
    const compUsdEl = document.getElementById('det-kpi-comprado-usd');
    if (compUsdEl) compUsdEl.textContent = `$${totalCompradoUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const compVesEl = document.getElementById('det-kpi-comprado-ves');
    if (compVesEl) compVesEl.textContent = `Bs. ${tasa > 0 ? totalCompradoVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}`;

    const deudaUsdEl = document.getElementById('det-kpi-deuda-usd');
    if (deudaUsdEl) deudaUsdEl.textContent = `$${saldoDeudaUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const deudaVesEl = document.getElementById('det-kpi-deuda-ves');
    if (deudaVesEl) deudaVesEl.textContent = `Bs. ${tasa > 0 ? saldoDeudaVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}`;

    const deudaCardEl = document.getElementById('det-kpi-deuda-card');
    if (deudaCardEl) {
        deudaCardEl.className = tieneDeuda ? 'det-kpi-card danger' : 'det-kpi-card';
    }

    // Construir lista de transacciones
    const listaVentas = Array.isArray(ventas) ? ventas : (AppState.ventas || []);
    const listaAbonos = Array.isArray(abonos) ? abonos : (AppState.abonos || []);

    const transacciones = [];
    (ventasCliente || []).forEach(v => {
        const esCargoManual = v.esCargoManual || (v.items && v.items.some(i => i.productoId === 'CARGO_MANUAL')) || String(v.id).startsWith('CARGO_');
        const esPrestamo = v.esPrestamo || String(v.motivo || '').toLowerCase().includes('préstamo') || String(v.motivo || '').toLowerCase().includes('prestamo');

        let concepto = `Venta (${v.tipo || 'Contado'})`;
        let detalle = (v.items || []).map(i => `${i.cantidad}x ${i.nombre}`).join(', ') || v.detalle || v.referencia || 'Compra de productos';

        if (esCargoManual) {
            concepto = esPrestamo ? '💵 Préstamo de Dinero' : '➕ Cargo a Cuenta';
            detalle = `Motivo: ${v.motivo || v.referencia || (v.items && v.items[0]?.nombre) || 'Préstamo de dinero en efectivo'}`;
        }

        transacciones.push({
            id: v.id,
            ventaId: v.id,
            esVenta: true,
            esCargoManual: !!esCargoManual,
            esPrestamo: !!esPrestamo,
            tipoOperacion: 'cargo',
            fecha: v.fecha || '2026-09-23 12:00',
            concepto: concepto,
            detalle: detalle,
            cargoUSD: (v.tipo === 'Crédito' || v.tipoPago === 'Crédito' || esCargoManual) ? Number(v.total || v.totalUSD || 0) : 0,
            abonoUSD: 0,
            montoPagoVES: '-'
        });
    });

    const idsMovimientosAbonos = new Set();
    (abonosCliente || []).forEach(a => {
        const aprobado = a.estado === 'Pago agregado' || a.estado === 'Confirmado' || !a.estado;
        const { esDivisa, montoUSD, montoVES } = typeof sanitizarAbonoMonedas === 'function'
            ? sanitizarAbonoMonedas(a, tasa)
            : { esDivisa: false, montoUSD: Number(a.montoUSD || 0), montoVES: Number(a.montoVES || 0) };

        if (a.id) idsMovimientosAbonos.add(String(a.id).trim());
        if (a.transaccionId) idsMovimientosAbonos.add(String(a.transaccionId).trim());

        const nombreMetodo = a.formaPago || a.metodo || 'Abono';
        const badgeMoneda = esDivisa ? ' (Divisas $)' : ' (Bs. VES)';
        transacciones.push({
            id: a.id,
            transaccionId: a.transaccionId || null,
            tipoOperacion: 'abono',
            fecha: a.fecha,
            concepto: aprobado ? `Abono / Pago${badgeMoneda}` : `Pago (${a.estado})${badgeMoneda}`,
            detalle: a.referencia && a.referencia !== 'N/A' && a.referencia !== 'Sin Ref' ? `${nombreMetodo} · Ref. ${a.referencia}` : nombreMetodo,
            cargoUSD: 0,
            abonoUSD: aprobado ? montoUSD : 0,
            montoPagoVES: montoVES > 0 ? `Bs. ${Number(montoVES).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-',
            pendiente: !aprobado
        });
    });

    if (typeof transaccionesPendientesCliente === 'function') {
        const pendientes = transaccionesPendientesCliente(id);
        pendientes.forEach(p => {
            const pId = String(p.id || '').trim();
            if (!pId || !idsMovimientosAbonos.has(pId)) {
                transacciones.push(p);
            }
        });
    }

    transacciones.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    // Actualizar badge contador
    const countEl = document.getElementById('det-movimientos-contador');
    if (countEl) {
        countEl.textContent = `${transacciones.length} movimiento${transacciones.length === 1 ? '' : 's'}`;
    }

    let saldoAcumuladoUSD = 0;
    const rowsDesktop = [];
    const cardsMobile = [];

    let clienteUltimasTransacciones = [];
    if (!transacciones.length) {
        const mensajeVacio = `
            <div style="text-align:center; padding:32px 16px; color:var(--text-muted, #64748b);">
                <i class="fas fa-folder-open" style="font-size:2rem; opacity:0.35; margin-bottom:8px; display:block;"></i>
                No hay movimientos registrados para este cliente.
            </div>
        `;
        const tbody = document.getElementById('det-historial-body');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:32px 16px; color:var(--text-muted);">${mensajeVacio}</td></tr>`;
        }
        const mobileContainer = document.getElementById('det-historial-mobile');
        if (mobileContainer) {
            mobileContainer.innerHTML = mensajeVacio;
        }
    } else {
        transacciones.forEach(t => {
            saldoAcumuladoUSD += (t.cargoUSD - t.abonoUSD);
            const saldoVES = tasa > 0 ? (saldoAcumuladoUSD * tasa) : 0;
            const saldoEsDeudor = saldoAcumuladoUSD > 0;
            const esCargo = t.cargoUSD > 0;
            const esAbono = t.abonoUSD > 0;

            clienteUltimasTransacciones.push({
                ...t,
                saldoAcumuladoUSD,
                saldoVES
            });

            const esVentaDeshacible = t.esVenta && t.ventaId && !String(t.ventaId).startsWith('V_FIADO_');
            const esCargoManual = t.esCargoManual;
            const accionTd = esVentaDeshacible ? `
                <td style="padding:6px 10px; text-align:center; white-space:nowrap;">
                    <button type="button" class="btn btn-sm" onclick="deshacerVentaCompra('${t.ventaId}', '${id}')" title="${esCargoManual ? 'Anular este préstamo o cargo manual' : 'Deshacer / Anular esta compra cargada por error'}" style="background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5; border-radius:6px; padding:3px 8px; font-size:0.75rem; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:4px; transition:all 0.15s ease;">
                        <i class="fas fa-rotate-left"></i> ${esCargoManual ? 'Anular cargo' : 'Deshacer'}
                    </button>
                </td>
            ` : `<td style="padding:6px 10px; text-align:center; color:var(--text-muted); font-size:0.8rem;">—</td>`;

            // Fila Desktop
            rowsDesktop.push(`
                <tr>
                    <td style="white-space:nowrap; padding:8px 10px;">${t.fecha}</td>
                    <td style="padding:8px 10px;">
                        ${t.concepto}
                        ${t.pendiente ? `<span class="transaction-badge transaction-pending" style="font-size:0.7rem; margin-left:4px;">Confirmando</span>` : ''}
                    </td>
                    <td style="padding:8px 10px; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escaparHtmlInventario ? escaparHtmlInventario(t.detalle) : t.detalle}">
                        ${escaparHtmlInventario ? escaparHtmlInventario(t.detalle) : t.detalle}
                    </td>
                    <td class="num" style="padding:8px 10px; color:${esCargo ? '#dc2626' : 'inherit'}; font-weight:${esCargo ? '700' : 'normal'};">
                        ${esCargo ? `$${t.cargoUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td class="num" style="padding:8px 10px; color:${esAbono ? '#16a34a' : 'inherit'}; font-weight:${esAbono ? '700' : 'normal'};">
                        ${esAbono ? `$${t.abonoUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td class="num" style="padding:8px 10px;">${t.montoPagoVES}</td>
                    <td class="num" style="padding:8px 10px; font-weight:bold; color:${saldoEsDeudor ? 'var(--danger, #dc2626)' : '#16a34a'};">
                        $${saldoAcumuladoUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td class="num" style="padding:8px 10px; font-weight:bold; color:${saldoEsDeudor ? 'var(--danger, #dc2626)' : '#16a34a'};">
                        Bs. ${tasa > 0 ? saldoVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                    </td>
                    ${accionTd}
                </tr>
            `);

            // Tarjeta Mobile Ergonómica (sin scroll horizontal)
            cardsMobile.push(`
                <div class="det-tx-card">
                    <div class="det-tx-top">
                        <div class="det-tx-title-group">
                            <div class="det-tx-icon ${esAbono ? 'det-tx-icon-abono' : (esCargoManual ? 'det-tx-icon-prestamo' : 'det-tx-icon-cargo')}">
                                <i class="fas ${esAbono ? 'fa-hand-holding-dollar' : (esCargoManual ? 'fa-hand-holding-dollar' : 'fa-cart-shopping')}"></i>
                            </div>
                            <div style="min-width:0;">
                                <div class="det-tx-title">${t.concepto}</div>
                                <div style="font-size:0.72rem; color:#64748b;">${t.fecha}</div>
                            </div>
                        </div>
                        <div class="det-tx-amount ${esAbono ? 'det-tx-amount-abono' : 'det-tx-amount-cargo'}">
                            ${esCargo ? `+$${t.cargoUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                            ${esAbono ? `-$${t.abonoUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                            ${!esCargo && !esAbono ? '$0.00' : ''}
                        </div>
                    </div>
                    ${t.detalle ? `<div class="det-tx-details" style="${esCargoManual ? 'background:#fef2f2; border-left:3px solid #dc2626; padding:6px 8px; border-radius:4px; font-weight:600;' : ''}">${escaparHtmlInventario ? escaparHtmlInventario(t.detalle) : t.detalle}</div>` : ''}
                    <div class="det-tx-meta">
                        <span>Saldo resultante:</span>
                        <span class="det-tx-balance" style="color:${saldoEsDeudor ? '#dc2626' : '#16a34a'};">
                            <strong>$${saldoAcumuladoUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                            ${tasa > 0 ? `<small style="color:#64748b; margin-left:4px;">(Bs. ${saldoVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</small>` : ''}
                        </span>
                    </div>
                    ${esVentaDeshacible ? `
                        <div style="display:flex; justify-content:flex-end; margin-top:8px; padding-top:6px; border-top:1px dashed #e2e8f0;">
                            <button type="button" class="btn btn-sm" onclick="deshacerVentaCompra('${t.ventaId}', '${id}')" style="background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5; border-radius:6px; padding:4px 10px; font-size:0.75rem; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:5px;">
                                <i class="fas fa-rotate-left"></i> ${esCargoManual ? 'Anular este cargo / préstamo' : 'Deshacer esta compra'}
                            </button>
                        </div>
                    ` : ''}
                </div>
            `);
        });

        const tbody = document.getElementById('det-historial-body');
        if (tbody) tbody.innerHTML = rowsDesktop.join('');

        const mobileContainer = document.getElementById('det-historial-mobile');
        if (mobileContainer) mobileContainer.innerHTML = cardsMobile.join('');
    }

    // Almacenar transacciones del cliente seleccionado en memoria para exportación/envío
    window._cliente360Transacciones = clienteUltimasTransacciones;

    // Abrir modal si abrirModal es verdadero
    const modal = document.getElementById('modal-cliente-detalle');
    if (modal && (abrirModal || modal.classList.contains('active'))) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}
window.verDetalleCliente = verDetalleCliente;

function cerrarModalDetalleCliente() {
    const modal = document.getElementById('modal-cliente-detalle');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
}
window.cerrarModalDetalleCliente = cerrarModalDetalleCliente;

/**
 * Obtiene los datos consolidados del cliente actualmente abierto en la Ficha 360°
 */
function obtenerDatosContextoCliente360() {
    if (!clienteSeleccionadoId) return null;
    const lista = Array.isArray(clientes) ? clientes : (AppState.clientes || []);
    const cliente = lista.find(c => c.id === clienteSeleccionadoId);
    if (!cliente) return null;

    const tasa = typeof tasaActiva === 'number' && tasaActiva > 0 ? tasaActiva : (AppState.tasaActiva || 1);
    const estado = calcularEstadoFinancieroCliente(cliente.id);
    const usuarioAsoc = Array.isArray(AppState.usuarios) && AppState.usuarios.find(u => (u.cedula || u.id) === cliente.id || u.id === cliente.usuarioId);
    const emailCli = cliente.email || usuarioAsoc?.email || '';
    const telCli = (cliente.telefono && cliente.telefono.trim()) || (cliente.tlf && cliente.tlf.trim()) || (cliente.phone && cliente.phone.trim()) || (usuarioAsoc?.telefono && usuarioAsoc.telefono.trim()) || '';
    
    // Obtener transacciones detalladas
    let transacciones = window._cliente360Transacciones || [];
    if (!transacciones.length) {
        // Generar en caso de no haber pasado por verDetalleCliente previamente
        const listaVentas = Array.isArray(ventas) ? ventas : (AppState.ventas || []);
        const listaAbonos = Array.isArray(abonos) ? abonos : (AppState.abonos || []);
        const id = cliente.id;
        const tx = [];

        listaVentas.filter(v => v.clienteId === id).forEach(v => {
            const esCargoManual = v.esCargoManual || (v.items && v.items.some(i => i.productoId === 'CARGO_MANUAL')) || String(v.id).startsWith('CARGO_');
            const esPrestamo = v.esPrestamo || String(v.motivo || '').toLowerCase().includes('préstamo') || String(v.motivo || '').toLowerCase().includes('prestamo');
            let concepto = `Venta (${v.tipo || 'Contado'})`;
            let detalle = (v.items || []).map(i => `${i.cantidad}x ${i.nombre}`).join(', ') || 'Compra de productos';

            if (esCargoManual) {
                concepto = esPrestamo ? '💵 Préstamo de Dinero' : '➕ Cargo a Cuenta';
                detalle = `Motivo: ${v.motivo || v.referencia || (v.items && v.items[0]?.nombre) || 'Préstamo de dinero en efectivo'}`;
            }

            tx.push({
                tipoOperacion: 'cargo',
                fecha: v.fecha,
                concepto: concepto,
                detalle: detalle,
                cargoUSD: (v.tipo === 'Crédito' || esCargoManual) ? Number(v.total || v.totalUSD || 0) : 0,
                abonoUSD: 0,
                montoPagoVES: '-'
            });
        });

        listaAbonos.filter(a => a.clienteId === id).forEach(a => {
            const aprobado = a.estado === 'Pago agregado' || a.estado === 'Confirmado' || !a.estado;
            const { esDivisa, montoUSD, montoVES } = typeof sanitizarAbonoMonedas === 'function'
                ? sanitizarAbonoMonedas(a, tasa)
                : { esDivisa: false, montoUSD: Number(a.montoUSD || 0), montoVES: Number(a.montoVES || 0) };

            const nombreMetodo = a.formaPago || a.metodo || 'Abono';
            const badgeMoneda = esDivisa ? ' (Divisas $)' : ' (Bs. VES)';
            tx.push({
                tipoOperacion: 'abono',
                fecha: a.fecha,
                concepto: aprobado ? `Abono / Pago${badgeMoneda}` : `Pago (${a.estado})${badgeMoneda}`,
                detalle: a.referencia && a.referencia !== 'N/A' && a.referencia !== 'Sin Ref' ? `${nombreMetodo} · Ref. ${a.referencia}` : nombreMetodo,
                cargoUSD: 0,
                abonoUSD: aprobado ? montoUSD : 0,
                montoPagoVES: montoVES > 0 ? `Bs. ${Number(montoVES).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-',
                pendiente: !aprobado
            });
        });

        tx.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
        let saldoAcumulado = 0;
        transacciones = tx.map(t => {
            saldoAcumulado += (t.cargoUSD - t.abonoUSD);
            return {
                ...t,
                saldoAcumuladoUSD: saldoAcumulado,
                saldoVES: tasa > 0 ? saldoAcumulado * tasa : 0
            };
        });
    }

    return {
        cliente,
        emailCli,
        telCli,
        tasa,
        estado,
        transacciones
    };
}

/**
 * Enviar información completa del estado de cuenta y desglose financiero al cliente.
 * Cierra automáticamente el modal Ficha 360° para evitar bloqueos y abre el modal especializado.
 */
function enviarInformacionCliente() {
    const ctx = obtenerDatosContextoCliente360();
    if (!ctx) {
        if (typeof showAlert === 'function') {
            showAlert('Atención', 'No se pudo cargar la información del cliente.', 'warning');
        } else {
            alert('No se pudo cargar la información del cliente.');
        }
        return;
    }

    // Cerrar el modal 360° para que no quede detrás ni cause superposiciones
    cerrarModalDetalleCliente();

    // Abrir el modal especializado de envío de información
    abrirModalEnviarInfo(ctx);
}
window.enviarInformacionCliente = enviarInformacionCliente;

/**
 * Abre el modal dedicado de envío de información al cliente
 */
function abrirModalEnviarInfo(ctx) {
    if (!ctx) ctx = obtenerDatosContextoCliente360();
    if (!ctx) return;

    window._ctxEnvioInfoActivo = ctx;
    const { cliente, emailCli, tasa, estado, transacciones } = ctx;
    const { saldoDeudaUSD, saldoDeudaVES, totalCompradoUSD, totalAbonadoUSD } = estado;
    const montoBsStr = `Bs. ${saldoDeudaVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const elNombre = document.getElementById('env-info-cliente-nombre');
    const elDeudaVES = document.getElementById('env-info-deuda-ves');
    const elDeudaUSD = document.getElementById('env-info-deuda-usd');
    const elResumen = document.getElementById('env-info-resumen-movimientos');
    const inputTel = document.getElementById('env-info-telefono-input');
    const inputEmail = document.getElementById('env-info-correo-input');

    if (elNombre) elNombre.textContent = `${cliente.nombre} (${cliente.id || 'S/C'})`;
    if (elDeudaVES) elDeudaVES.textContent = montoBsStr;
    if (elDeudaUSD) elDeudaUSD.textContent = `$${saldoDeudaUSD.toFixed(2)} USD`;
    if (elResumen) {
        elResumen.innerHTML = `Total Comprado: <strong>$${totalCompradoUSD.toFixed(2)}</strong> | Total Abonado: <strong>$${(totalAbonadoUSD || 0).toFixed(2)}</strong> | Tasa BCV: <strong>Bs. ${tasa.toFixed(2)}</strong>`;
    }

    const tel = (cliente.telefono && cliente.telefono.trim()) || (ctx.telCli && ctx.telCli.trim()) || (cliente.tlf && cliente.tlf.trim()) || (cliente.phone && cliente.phone.trim()) || '';
    if (inputTel) inputTel.value = tel;
    if (inputEmail) inputEmail.value = (ctx.emailCli && ctx.emailCli.trim()) || (cliente.email && cliente.email.trim()) || '';

    const modal = document.getElementById('modal-enviar-informacion');
    if (modal) {
        modal.classList.add('active');
    }
}
window.abrirModalEnviarInfo = abrirModalEnviarInfo;

/**
 * Cierra el modal de envío de información
 */
function cerrarModalEnviarInfo() {
    const modal = document.getElementById('modal-enviar-informacion');
    if (modal) {
        modal.classList.remove('active');
    }
}
window.cerrarModalEnviarInfo = cerrarModalEnviarInfo;

/**
 * Permite al usuario volver a la Ficha 360° desde el modal de envío
 */
function volverAFicha360DesdeEnvio() {
    cerrarModalEnviarInfo();
    const ctx = window._ctxEnvioInfoActivo;
    const cid = (ctx && ctx.cliente && ctx.cliente.id) || clienteSeleccionadoId;
    if (cid) {
        verDetalleCliente(cid, true);
    }
}
window.volverAFicha360DesdeEnvio = volverAFicha360DesdeEnvio;

/**
 * Genera el texto estructurado del estado de cuenta con la deuda en Bs explícita
 */
function generarTextoEstadoCuentaEnvio(ctx, incluirTransacciones = true) {
    const { cliente, tasa, estado, transacciones } = ctx;
    const { saldoDeudaUSD, saldoDeudaVES, totalCompradoUSD, totalAbonadoUSD } = estado;
    const montoBsStr = `Bs. ${saldoDeudaVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    let texto = `🏪 *TU BODEGUITA DE CONFIANZA*\n`;
    texto += `📄 *ESTADO DE CUENTA - ${cliente.nombre}* (C.I. ${cliente.id})\n`;
    texto += `📅 Fecha: ${new Date().toLocaleDateString('es-VE')}\n`;
    texto += `💵 Tasa Oficial BCV: Bs. ${tasa.toFixed(2)} / USD\n\n`;
    texto += `📊 *RESUMEN FINANCIERO:*\n`;
    texto += `• Total Comprado (Crédito): $${totalCompradoUSD.toFixed(2)} USD\n`;
    texto += `• Total Abonado / Pagado: $${(totalAbonadoUSD || 0).toFixed(2)} USD\n`;
    texto += `• Saldo Pendiente: $${saldoDeudaUSD.toFixed(2)} USD\n`;
    texto += `• *Deuda a pagar: ${montoBsStr}*\n\n`;

    if (incluirTransacciones && transacciones && transacciones.length > 0) {
        texto += `📝 *EN QUÉ SE BASA EL SALDO (MOVIMIENTOS):*\n`;
        const ultimos = transacciones.slice(-6);
        ultimos.forEach((t, i) => {
            const monto = t.cargoUSD > 0 ? `+$${t.cargoUSD.toFixed(2)}` : `-$${t.abonoUSD.toFixed(2)}`;
            texto += `${i + 1}. [${t.fecha ? t.fecha.substring(0, 10) : ''}] ${t.concepto}: ${monto} | Saldo: $${t.saldoAcumuladoUSD.toFixed(2)}\n   Detalle: ${t.detalle || '—'}\n`;
        });
        texto += `\n`;
    }

    if (saldoDeudaUSD > 0.01) {
        texto += `💳 *Datos de Pago Móvil:*\n`;
        texto += `• Banco: Mercantil / Banesco / Venezuela\n`;
        texto += `• Teléfono: 0414-0000000\n`;
        texto += `• C.I.: V-00000000\n\n`;
        texto += `Agradecemos enviar su comprobante por este medio. ¡Muchas gracias por su preferencia! 🙏`;
    } else {
        texto += `✨ ¡Su cuenta se encuentra totalmente al día y solvente! Gracias por su confianza.`;
    }

    return texto;
}

/**
 * Ejecuta el envío por WhatsApp con el número ingresado o predeterminado
 */
function ejecutarEnvioInfoWhatsapp() {
    const ctx = window._ctxEnvioInfoActivo || obtenerDatosContextoCliente360();
    if (!ctx) return;

    const inputTel = document.getElementById('env-info-telefono-input');
    const tel = (inputTel ? inputTel.value.trim() : '') || (ctx.cliente.telefono && ctx.cliente.telefono.trim()) || (ctx.telCli && ctx.telCli.trim());

    if (!tel) {
        if (typeof showAlert === 'function') {
            showAlert('Teléfono Requerido', 'Por favor ingresa un número de teléfono de WhatsApp en el campo correspondiente.', 'warning');
        } else {
            alert('Por favor ingresa un número de teléfono de WhatsApp.');
        }
        if (inputTel) inputTel.focus();
        return;
    }

    // Si el cliente no tenía teléfono guardado y se ingresó uno, guardarlo automáticamente
    if (!ctx.cliente.telefono && tel) {
        ctx.cliente.telefono = tel;
        if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarCliente === 'function') {
            window.InventoryApp.Firebase.guardarCliente(ctx.cliente).catch(() => {});
        }
    }

    let phoneClean = tel.replace(/[^0-9]/g, '');
    if (phoneClean.startsWith('0')) {
        phoneClean = '58' + phoneClean.substring(1);
    } else if (phoneClean.length === 10 && !phoneClean.startsWith('58')) {
        phoneClean = '58' + phoneClean;
    }

    const texto = generarTextoEstadoCuentaEnvio(ctx, true);

    if (typeof showToast === 'function') {
        showToast('Abriendo WhatsApp para enviar información...', 'success');
    }

    if (typeof abrirWhatsAppEnlace === 'function') {
        abrirWhatsAppEnlace({ telefono: phoneClean, mensaje: texto });
    } else {
        const urlWa = `https://wa.me/${phoneClean}?text=${encodeURIComponent(texto)}&app=normal`;
        const link = document.createElement('a');
        link.href = urlWa;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => link.remove(), 200);
    }
}
window.ejecutarEnvioInfoWhatsapp = ejecutarEnvioInfoWhatsapp;

/**
 * Ejecuta el envío por Correo Electrónico con el correo ingresado o predeterminado
 */
function ejecutarEnvioInfoCorreo() {
    const ctx = window._ctxEnvioInfoActivo || obtenerDatosContextoCliente360();
    if (!ctx) return;

    const inputEmail = document.getElementById('env-info-correo-input');
    const email = (inputEmail ? inputEmail.value.trim() : '') || (ctx.emailCli && ctx.emailCli.trim()) || (ctx.cliente.email && ctx.cliente.email.trim());

    if (!email) {
        if (typeof showAlert === 'function') {
            showAlert('Correo Requerido', 'Por favor ingresa un correo electrónico en el campo correspondiente.', 'warning');
        } else {
            alert('Por favor ingresa un correo electrónico.');
        }
        if (inputEmail) inputEmail.focus();
        return;
    }

    // Si el cliente no tenía email guardado y se ingresó uno, guardarlo automáticamente
    if (!ctx.cliente.email && email) {
        ctx.cliente.email = email;
        if (window.InventoryApp && window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarCliente === 'function') {
            window.InventoryApp.Firebase.guardarCliente(ctx.cliente).catch(() => {});
        }
    }

    const { cliente, estado } = ctx;
    const { saldoDeudaVES } = estado;
    const montoBsStr = `Bs. ${saldoDeudaVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const asunto = `Estado de Cuenta - ${cliente.nombre} - Deuda a pagar: ${montoBsStr}`;
    const texto = generarTextoEstadoCuentaEnvio(ctx, true).replace(/\*/g, '');

    const mailtoUrl = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(texto)}`;

    if (typeof showToast === 'function') {
        showToast('Abriendo cliente de correo...', 'success');
    }

    window.location.href = mailtoUrl;
}
window.ejecutarEnvioInfoCorreo = ejecutarEnvioInfoCorreo;

/**
 * Copia el estado de cuenta formateado al portapapeles
 */
function ejecutarCopiarInfoPortapapeles() {
    const ctx = window._ctxEnvioInfoActivo || obtenerDatosContextoCliente360();
    if (!ctx) return;

    const texto = generarTextoEstadoCuentaEnvio(ctx, true).replace(/\*/g, '');
    const { saldoDeudaVES } = ctx.estado;
    const montoBsStr = `Bs. ${saldoDeudaVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(() => {
            if (typeof showToast === 'function') {
                showToast(`¡Estado de cuenta copiado al portapapeles! (Deuda a pagar: ${montoBsStr})`, 'success');
            } else if (typeof showAlert === 'function') {
                showAlert('Copiado', `Se ha copiado el estado de cuenta al portapapeles con la 'Deuda a pagar: ${montoBsStr}'.`, 'success');
            } else {
                alert(`Se ha copiado el estado de cuenta al portapapeles con la 'Deuda a pagar: ${montoBsStr}'.`);
            }
        }).catch(() => {
            copiarFallbackTexto(texto, montoBsStr);
        });
    } else {
        copiarFallbackTexto(texto, montoBsStr);
    }
}
window.ejecutarCopiarInfoPortapapeles = ejecutarCopiarInfoPortapapeles;

/**
 * Abre el formulario para redactar y emitir una Notificación In-App dirigida al cliente seleccionado
 */
function ejecutarEnvioNotificacionInAppDesdeModal() {
    const ctx = window._ctxEnvioInfoActivo || (typeof obtenerDatosContextoCliente360 === 'function' ? obtenerDatosContextoCliente360() : null);
    const cid = (ctx && ctx.cliente && ctx.cliente.id) || window.clienteSeleccionadoId;
    cerrarModalEnviarInfo();
    if (typeof abrirModalEnviarNotificacionCliente === 'function') {
        abrirModalEnviarNotificacionCliente(cid);
    } else if (window.abrirModalEnviarNotificacionCliente) {
        window.abrirModalEnviarNotificacionCliente(cid);
    } else if (window.InventoryApp?.Notifications?.abrirModalEnviar) {
        window.InventoryApp.Notifications.abrirModalEnviar(cid);
    }
}
window.ejecutarEnvioNotificacionInAppDesdeModal = ejecutarEnvioNotificacionInAppDesdeModal;

function copiarFallbackTexto(texto, montoBsStr) {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
        document.execCommand('copy');
        if (typeof showToast === 'function') {
            showToast(`¡Estado de cuenta copiado! (Deuda a pagar: ${montoBsStr})`, 'success');
        } else {
            alert(`Estado de cuenta copiado. Deuda a pagar: ${montoBsStr}`);
        }
    } catch(e) {
        alert(`Información:\nDeuda a pagar: ${montoBsStr}`);
    }
    ta.remove();
}

/**
 * Copia el resumen de estado de cuenta directamente al portapapeles cuando el cliente no tiene canales configurados
 */
function copiarEstadoCuentaPortapapeles(ctx) {
    window._ctxEnvioInfoActivo = ctx;
    ejecutarCopiarInfoPortapapeles();
}
window.copiarEstadoCuentaPortapapeles = copiarEstadoCuentaPortapapeles;

/**
 * Enviar desglose de estado de cuenta y deuda por WhatsApp
 */
function enviarWhatsappCliente() {
    const ctx = obtenerDatosContextoCliente360();
    if (!ctx) return;
    const { cliente, tasa, estado, transacciones } = ctx;

    if (!cliente.telefono || !cliente.telefono.trim()) {
        const agregar = confirm('Este cliente no tiene número de teléfono registrado.\n\n¿Desea copiar la información al portapapeles para enviarla manualmente?');
        if (agregar) {
            copiarEstadoCuentaPortapapeles(ctx);
        }
        return;
    }

    let tel = cliente.telefono.replace(/[^0-9]/g, '');
    if (tel.startsWith('0')) {
        tel = '58' + tel.substring(1);
    } else if (tel.length === 10 && !tel.startsWith('58')) {
        tel = '58' + tel;
    }

    const { saldoDeudaUSD, saldoDeudaVES, totalCompradoUSD, totalAbonadoUSD } = estado;
    const montoBsStr = `Bs. ${saldoDeudaVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    let mensaje = '';

    if (saldoDeudaUSD > 0.01) {
        mensaje = `🏪 *TU BODEGUITA DE CONFIANZA*\n`;
        mensaje += `📄 *ESTADO DE CUENTA Y SALDO PENDIENTE*\n\n`;
        mensaje += `👤 *Cliente:* ${cliente.nombre} (C.I. ${cliente.id})\n`;
        mensaje += `📅 *Fecha:* ${new Date().toLocaleDateString('es-VE')}\n`;
        mensaje += `💵 *Tasa BCV:* Bs. ${tasa.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / USD\n\n`;
        mensaje += `📊 *RESUMEN DE CUENTA:*\n`;
        mensaje += `• Total Créditos Otorgados: $${totalCompradoUSD.toFixed(2)}\n`;
        mensaje += `• Total Pagos/Abonos: $${(totalAbonadoUSD || 0).toFixed(2)}\n`;
        mensaje += `• Saldo Pendiente: $${saldoDeudaUSD.toFixed(2)} USD\n`;
        mensaje += `• *Deuda a pagar:* *${montoBsStr}*\n\n`;

        // Detalle de los movimientos en los que se basa la deuda
        const ultimos = transacciones.slice(-6);
        if (ultimos.length) {
            mensaje += `📝 *EN QUÉ SE BASA EL SALDO (MOVIMIENTOS):*\n`;
            ultimos.forEach(t => {
                const tipoSigno = t.cargoUSD > 0 ? `+ $${t.cargoUSD.toFixed(2)}` : `- $${t.abonoUSD.toFixed(2)}`;
                mensaje += `• ${t.fecha ? t.fecha.substring(0, 10) : ''}: ${t.concepto} (${tipoSigno})\n  _${t.detalle || 'Sin detalle'}_\n`;
            });
            mensaje += `\n`;
        }

        mensaje += `🙏 Agradecemos su puntual abono o pago. Para confirmar referencias o reportar pagos por la app, estamos siempre a su orden. ¡Muchas gracias por su preferencia!`;
    } else {
        mensaje = `🏪 *TU BODEGUITA DE CONFIANZA*\n`;
        mensaje += `📄 *ESTADO DE CUENTA AL DÍA*\n\n`;
        mensaje += `Estimado(a) *${cliente.nombre}* (C.I. ${cliente.id}),\n\n`;
        mensaje += `Le confirmamos que su cuenta se encuentra actualmente *SOLVENTE y al día con saldo $0.00*.\n`;
        mensaje += `• *Deuda a pagar:* *Bs. 0,00*\n`;
        mensaje += `• Total Compras acumuladas: $${totalCompradoUSD.toFixed(2)}\n`;
        mensaje += `• Total Abonos: $${(totalAbonadoUSD || 0).toFixed(2)}\n\n`;
        mensaje += `¡Muchas gracias por su confianza y lealtad con nosotros! 🎉`;
    }

    if (typeof abrirWhatsAppEnlace === 'function') {
        abrirWhatsAppEnlace({ telefono: tel, mensaje });
    } else {
        const url = `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}&app=normal`;
        window.open(url, '_blank');
    }
}
window.enviarWhatsappCliente = enviarWhatsappCliente;

/**
 * Enviar estado de cuenta y desglose de deuda por Correo Electrónico añadido por el usuario
 */
function enviarCorreoCliente() {
    const ctx = obtenerDatosContextoCliente360();
    if (!ctx) return;
    const { cliente, emailCli, tasa, estado, transacciones } = ctx;

    if (!emailCli || !emailCli.trim()) {
        const agregar = confirm('Este cliente no tiene correo electrónico registrado ni vinculado.\n\n¿Desea copiar la información al portapapeles para enviarla manualmente?');
        if (agregar) {
            copiarEstadoCuentaPortapapeles(ctx);
        }
        return;
    }

    const { saldoDeudaUSD, saldoDeudaVES, totalCompradoUSD, totalAbonadoUSD } = estado;
    const montoBsStr = `Bs. ${saldoDeudaVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const asunto = `Estado de Cuenta - Tu Bodeguita de Confianza - ${cliente.nombre}`;
    
    let cuerpo = `Estimado(a) ${cliente.nombre} (C.I. ${cliente.id}),\n\n`;
    cuerpo += `Reciba un cordial saludo de Tu Bodeguita de Confianza. A continuación le presentamos el resumen de su estado de cuenta a la fecha (${new Date().toLocaleDateString('es-VE')}):\n\n`;
    
    cuerpo += `--- RESUMEN FINANCIERO ---\n`;
    cuerpo += `Total Comprado/Crédito: $${totalCompradoUSD.toFixed(2)} USD\n`;
    cuerpo += `Total Abonado/Pagado: $${(totalAbonadoUSD || 0).toFixed(2)} USD\n`;
    cuerpo += `Saldo Pendiente Actual: $${saldoDeudaUSD.toFixed(2)} USD\n`;
    cuerpo += `Deuda a pagar: ${montoBsStr}\n`;
    cuerpo += `Tasa de Cambio Oficial (BCV): Bs. ${tasa.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / USD\n\n`;

    if (transacciones && transacciones.length > 0) {
        cuerpo += `--- DETALLE DE MOVIMIENTOS (EN QUÉ SE BASA LA CUENTA) ---\n`;
        transacciones.forEach((t, idx) => {
            const monto = t.cargoUSD > 0 ? `Cargo: +$${t.cargoUSD.toFixed(2)}` : `Abono: -$${t.abonoUSD.toFixed(2)}`;
            cuerpo += `${idx + 1}. [${t.fecha}] ${t.concepto} | ${monto} | Saldo: $${t.saldoAcumuladoUSD.toFixed(2)}\n`;
            if (t.detalle) {
                cuerpo += `   Detalle: ${t.detalle}\n`;
            }
        });
        cuerpo += `\n`;
    }

    if (saldoDeudaUSD > 0.01) {
        cuerpo += `Le recordamos que puede realizar sus abonos por transferencia bancaria, pago móvil o en efectivo / divisas directamente en el negocio o reportándolo por la aplicación.\n\n`;
    } else {
        cuerpo += `Su cuenta se encuentra actualmente completamente al día. ¡Agradecemos sinceramente su preferencia!\n\n`;
    }

    cuerpo += `Atentamente,\nTu Bodeguita de Confianza`;

    const mailtoUrl = `mailto:${encodeURIComponent(emailCli)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
    window.location.href = mailtoUrl;
}
window.enviarCorreoCliente = enviarCorreoCliente;

/**
 * Descarga el estado de cuenta y desglose de movimientos en formato Excel (.xlsx)
 */
function descargarEstadoCuentaCliente() {
    const ctx = obtenerDatosContextoCliente360();
    if (!ctx) {
        alert('No se pudo cargar la información del cliente para la descarga.');
        return;
    }

    if (window.InventoryApp?.ExcelExporter?.exportarEstadoCuentaClienteCompleto) {
        return window.InventoryApp.ExcelExporter.exportarEstadoCuentaClienteCompleto({
            cliente: ctx.cliente,
            estado: ctx.estado,
            tasa: ctx.tasa,
            transacciones: ctx.transacciones
        });
    } else if (typeof window.exportarEstadoCuentaClienteCompleto === 'function') {
        return window.exportarEstadoCuentaClienteCompleto({
            cliente: ctx.cliente,
            estado: ctx.estado,
            tasa: ctx.tasa,
            transacciones: ctx.transacciones
        });
    }

    const { cliente, emailCli, tasa, estado, transacciones } = ctx;

    if (typeof XLSX === 'undefined') {
        alert('La librería SheetJS (XLSX) no está cargada. Descargando como formato CSV/Texto...');
        descargarEstadoCuentaCSV(ctx);
        return;
    }

    const { saldoDeudaUSD, saldoDeudaVES, totalCompradoUSD, totalAbonadoUSD } = estado;
    const wb = XLSX.utils.book_new();

    const sanitizarVal = (v) => {
        if (v === null || v === undefined) return '';
        if (typeof v === 'number' || typeof v === 'boolean') return v;
        const s = String(v);
        if (s.startsWith('data:')) return '[Archivo / Imagen Base64]';
        return s.length > 32000 ? s.slice(0, 31980) + '... [TRUNCADO]' : s;
    };
    const sanitizarLista = (lista) => lista.map(row => {
        const obj = {};
        for (const [k, val] of Object.entries(row)) obj[k] = sanitizarVal(val);
        return obj;
    });

    // Hoja 1: Resumen de la cuenta
    const datosResumen = [
        { 'Parámetro': 'Nombre del Cliente', 'Valor': cliente.nombre },
        { 'Parámetro': 'Cédula / Identificación', 'Valor': cliente.id },
        { 'Parámetro': 'Teléfono de Contacto', 'Valor': cliente.telefono || 'No registrado' },
        { 'Parámetro': 'Correo Electrónico', 'Valor': emailCli || 'No registrado' },
        { 'Parámetro': 'Fecha de Emisión', 'Valor': new Date().toLocaleString('es-VE') },
        { 'Parámetro': 'Tasa Oficial BCV', 'Valor': `Bs. ${tasa.toFixed(2)}` },
        { 'Parámetro': 'Total Comprado (Créditos)', 'Valor': `$${totalCompradoUSD.toFixed(2)} USD` },
        { 'Parámetro': 'Total Abonado / Pagado', 'Valor': `$${(totalAbonadoUSD || 0).toFixed(2)} USD` },
        { 'Parámetro': 'SALDO DEUDA ACTUAL (USD)', 'Valor': `$${saldoDeudaUSD.toFixed(2)} USD` },
        { 'Parámetro': 'Deuda a pagar (Bolívares)', 'Valor': `Bs. ${saldoDeudaVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
        { 'Parámetro': 'SALDO DEUDA ACTUAL (VES)', 'Valor': `Bs. ${saldoDeudaVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
        { 'Parámetro': 'Estado Financiero', 'Valor': saldoDeudaUSD > 0.01 ? 'DEUDOR / PENDIENTE' : 'SOLVENTE / AL DÍA' }
    ];
    const wsResumen = XLSX.utils.json_to_sheet(sanitizarLista(datosResumen));
    wsResumen['!cols'] = [{ wch: 30 }, { wch: 45 }];
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen_Cliente');

    // Hoja 2: Detalle de Movimientos (En qué se basa la deuda)
    const datosMovimientos = (transacciones.length ? transacciones : [{
        fecha: new Date().toISOString().substring(0, 10),
        concepto: 'Sin movimientos',
        detalle: 'No se registran operaciones para este cliente',
        cargoUSD: 0,
        abonoUSD: 0,
        montoPagoVES: '-',
        saldoAcumuladoUSD: 0,
        saldoVES: 0
    }]).map(t => ({
        'Fecha': t.fecha,
        'Concepto': t.concepto,
        'Detalle / Artículos': t.detalle || '',
        'Cargo ($)': Number((t.cargoUSD || 0).toFixed(2)),
        'Abono ($)': Number((t.abonoUSD || 0).toFixed(2)),
        'Monto en Bs (VES)': t.montoPagoVES,
        'Saldo Resultante ($)': Number((t.saldoAcumuladoUSD || 0).toFixed(2)),
        'Saldo Resultante (Bs)': Number((t.saldoVES || 0).toFixed(2))
    }));

    const wsMovimientos = XLSX.utils.json_to_sheet(sanitizarLista(datosMovimientos));
    wsMovimientos['!cols'] = [
        { wch: 18 }, // Fecha
        { wch: 22 }, // Concepto
        { wch: 40 }, // Detalle
        { wch: 14 }, // Cargo
        { wch: 14 }, // Abono
        { wch: 18 }, // Bs
        { wch: 20 }, // Saldo USD
        { wch: 22 }  // Saldo Bs
    ];
    XLSX.utils.book_append_sheet(wb, wsMovimientos, 'Detalle_Movimientos');

    const cleanName = (cliente.nombre || cliente.id).replace(/[^a-zA-Z0-9]/g, '_');
    const fechaArchivo = new Date().toISOString().substring(0, 10);
    const nombreArchivo = `Estado_Cuenta_${cleanName}_${fechaArchivo}.xlsx`;

    XLSX.writeFile(wb, nombreArchivo);
}
window.descargarEstadoCuentaCliente = descargarEstadoCuentaCliente;

/**
 * Fallback en caso de que XLSX no esté disponible (descarga CSV)
 */
function descargarEstadoCuentaCSV(ctx) {
    const { cliente, emailCli, tasa, estado, transacciones } = ctx;
    const { saldoDeudaUSD, saldoDeudaVES, totalCompradoUSD, totalAbonadoUSD } = estado;

    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
    csvContent += `ESTADO DE CUENTA - TU BODEGUITA DE CONFIANZA\n`;
    csvContent += `Cliente,"${cliente.nombre}"\n`;
    csvContent += `Cedula,"${cliente.id}"\n`;
    csvContent += `Telefono,"${cliente.telefono || ''}"\n`;
    csvContent += `Correo,"${emailCli || ''}"\n`;
    csvContent += `Fecha Emision,"${new Date().toLocaleString('es-VE')}"\n`;
    csvContent += `Tasa BCV,"Bs. ${tasa.toFixed(2)}"\n`;
    csvContent += `Total Comprado ($),"${totalCompradoUSD.toFixed(2)}"\n`;
    csvContent += `Total Abonado ($),"${(totalAbonadoUSD || 0).toFixed(2)}"\n`;
    csvContent += `Saldo Pendiente ($),"${saldoDeudaUSD.toFixed(2)}"\n`;
    csvContent += `Deuda a pagar (Bs),"Bs. ${saldoDeudaVES.toFixed(2)}"\n\n`;

    csvContent += `Fecha,Operacion,Concepto,Detalle,Cargo USD,Abono USD,Saldo USD\n`;
    transacciones.forEach(t => {
        csvContent += `"${t.fecha}","${t.tipoOperacion}","${t.concepto}","${(t.detalle || '').replace(/"/g, '""')}","${t.cargoUSD.toFixed(2)}","${t.abonoUSD.toFixed(2)}","${t.saldoAcumuladoUSD.toFixed(2)}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const cleanName = (cliente.nombre || cliente.id).replace(/[^a-zA-Z0-9]/g, '_');
    link.setAttribute('download', `Estado_Cuenta_${cleanName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Imprimir o exportar como PDF el Estado de Cuenta profesional del cliente
 */
function imprimirEstadoCuentaCliente() {
    const ctx = obtenerDatosContextoCliente360();
    if (!ctx) {
        alert('No se pudo cargar la información del cliente para imprimir.');
        return;
    }
    const { cliente, emailCli, tasa, estado, transacciones } = ctx;
    const { saldoDeudaUSD, saldoDeudaVES, totalCompradoUSD, totalAbonadoUSD } = estado;
    const tieneDeuda = saldoDeudaUSD > 0.01;

    const ventana = window.open('', '_blank', 'width=900,height=750');
    if (!ventana) {
        alert('Por favor permite abrir ventanas emergentes para imprimir el informe.');
        return;
    }

    const rowsHtml = transacciones.map(t => {
        const esCargo = t.cargoUSD > 0;
        const esAbono = t.abonoUSD > 0;
        return `
            <tr>
                <td style="white-space:nowrap; padding:7px 10px; border:1px solid #e2e8f0;">${t.fecha}</td>
                <td style="padding:7px 10px; border:1px solid #e2e8f0; font-weight:600;">${t.concepto}</td>
                <td style="padding:7px 10px; border:1px solid #e2e8f0; font-size:11px; color:#475569;">${t.detalle || '—'}</td>
                <td style="text-align:right; padding:7px 10px; border:1px solid #e2e8f0; color:${esCargo ? '#dc2626' : 'inherit'}; font-weight:${esCargo ? 'bold' : 'normal'};">
                    ${esCargo ? `$${t.cargoUSD.toFixed(2)}` : '—'}
                </td>
                <td style="text-align:right; padding:7px 10px; border:1px solid #e2e8f0; color:${esAbono ? '#16a34a' : 'inherit'}; font-weight:${esAbono ? 'bold' : 'normal'};">
                    ${esAbono ? `$${t.abonoUSD.toFixed(2)}` : '—'}
                </td>
                <td style="text-align:right; padding:7px 10px; border:1px solid #e2e8f0; font-weight:bold; color:${t.saldoAcumuladoUSD > 0 ? '#dc2626' : '#16a34a'};">
                    $${t.saldoAcumuladoUSD.toFixed(2)}
                </td>
            </tr>
        `;
    }).join('');

    ventana.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Estado de Cuenta - ${cliente.nombre}</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #1e293b; }
                .header { border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; }
                h1 { margin: 0 0 4px 0; font-size: 20px; color: #0f172a; }
                .subtitle { margin: 0; font-size: 13px; color: #64748b; }
                .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 13px; }
                .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
                .kpi-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #f8fafc; }
                .kpi-card.danger { background: #fef2f2; border-color: #fecaca; }
                .kpi-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
                .kpi-amount { font-size: 18px; font-weight: 800; }
                .kpi-amount.danger { color: #dc2626; }
                .kpi-amount.success { color: #16a34a; }
                .kpi-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
                th { background: #f1f5f9; text-align: left; padding: 8px 10px; border: 1px solid #e2e8f0; font-weight: 700; color: #334155; }
                @media print {
                    body { padding: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <h1>🏪 TU BODEGUITA DE CONFIANZA</h1>
                    <p class="subtitle">Ficha 360° · Estado de Cuenta y Desglose Financiero</p>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:12px; color:#64748b;">Fecha Emisión:</div>
                    <div style="font-weight:700; font-size:13px;">${new Date().toLocaleString('es-VE')}</div>
                    <div style="font-size:11px; color:#64748b; margin-top:2px;">Tasa BCV: Bs. ${tasa.toFixed(2)}</div>
                </div>
            </div>

            <div class="meta-box">
                <div>
                    <div><strong>Cliente:</strong> ${cliente.nombre}</div>
                    <div><strong>Cédula:</strong> ${cliente.id}</div>
                </div>
                <div>
                    <div><strong>Teléfono:</strong> ${cliente.telefono || 'No registrado'}</div>
                    <div><strong>Correo:</strong> ${emailCli || 'No registrado'}</div>
                </div>
            </div>

            <div class="kpis">
                <div class="kpi-card">
                    <div class="kpi-title">Total Comprado (Crédito)</div>
                    <div class="kpi-amount">$${totalCompradoUSD.toFixed(2)}</div>
                    <div class="kpi-sub">Bs. ${(totalCompradoUSD * tasa).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-title">Total Abonado / Pagado</div>
                    <div class="kpi-amount success">$${(totalAbonadoUSD || 0).toFixed(2)}</div>
                    <div class="kpi-sub">Bs. ${((totalAbonadoUSD || 0) * tasa).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div class="kpi-card ${tieneDeuda ? 'danger' : ''}">
                    <div class="kpi-title">${tieneDeuda ? 'Deuda a pagar (Bolívares)' : 'Estado de Deuda'}</div>
                    <div class="kpi-amount ${tieneDeuda ? 'danger' : 'success'}">Bs. ${saldoDeudaVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div class="kpi-sub" style="font-weight:600;">Deuda a pagar: Bs. ${saldoDeudaVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ($${saldoDeudaUSD.toFixed(2)} USD)</div>
                </div>
            </div>

            <h3 style="font-size:14px; margin-bottom:6px; color:#0f172a;">Detalle de Operaciones (En qué se basa el saldo)</h3>
            <table>
                <thead>
                    <tr>
                        <th style="width:14%;">Fecha</th>
                        <th style="width:20%;">Concepto</th>
                        <th>Detalle / Artículos</th>
                        <th style="text-align:right; width:12%;">Cargo ($)</th>
                        <th style="text-align:right; width:12%;">Abono ($)</th>
                        <th style="text-align:right; width:14%;">Saldo Resultante</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml || '<tr><td colspan="6" style="text-align:center; padding:16px;">No hay movimientos registrados.</td></tr>'}
                </tbody>
            </table>

            <div style="margin-top:24px; padding-top:12px; border-top:1px dashed #cbd5e1; font-size:11px; color:#64748b; text-align:center;">
                Comprobante informativo de Tu Bodeguita de Confianza. Gracias por su preferencia.
            </div>

            <div class="no-print" style="margin-top:20px; text-align:center;">
                <button onclick="window.print()" style="padding:10px 20px; background:#2563eb; color:#fff; border:none; border-radius:8px; font-weight:700; cursor:pointer;">
                    Imprimir Informe / Guardar PDF
                </button>
            </div>
        </body>
        </html>
    `);

    ventana.document.close();
}
window.imprimirEstadoCuentaCliente = imprimirEstadoCuentaCliente;

// Listener para cerrar modal con tecla Escape
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        const modal = document.getElementById('modal-cliente-detalle');
        if (modal && modal.classList.contains('active')) {
            cerrarModalDetalleCliente();
        }
        const modalFus = document.getElementById('modal-fusionar-clientes');
        if (modalFus && modalFus.style.display !== 'none') {
            cerrarModalFusionarClientes();
        }
    }
});

// =========================================================================
// --- MOTOR DE FUSIÓN Y UNIFICACIÓN DE CLIENTES DUPLICADOS ---
// =========================================================================

/**
 * Detecta si existen clientes duplicados conocidos (como Yitxel Cuenca y Yixel CLI-025)
 * o con datos idénticos y muestra un banner inteligente en la vista de clientes.
 */
function verificarSugerenciasFusionClientes() {
    const banner = document.getElementById('alerta-sugerencia-fusion-clientes');
    if (!banner) return;

    const lista = Array.isArray(clientes) ? clientes : (AppState.clientes || []);

    // 1. Caso específico: Yitxel Cuenca (27611440) y Yixel (CLI-025)
    const cliYitxel = lista.find(c => String(c.id).trim() === '27611440' || String(c.cedula).trim() === '27611440');
    const cliYixel = lista.find(c => String(c.id).trim().toUpperCase() === 'CLI-025' || String(c.nombre).trim().toUpperCase() === 'YIXEL');

    if (cliYitxel && cliYixel && cliYitxel.id !== cliYixel.id) {
        const estYitxel = calcularEstadoFinancieroCliente(cliYitxel.id);
        const estYixel = calcularEstadoFinancieroCliente(cliYixel.id);
        const deudaConsolidada = (estYitxel.saldoDeudaUSD + estYixel.saldoDeudaUSD).toFixed(2);

        banner.style.display = 'block';
        banner.innerHTML = `
            <div style="background:linear-gradient(135deg, #eff6ff, #e0e7ff); border:1px solid #c7d2fe; border-left:5px solid #4f46e5; border-radius:12px; padding:14px 18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; box-shadow:0 2px 8px rgba(79,70,229,0.08);">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="width:40px; height:40px; border-radius:10px; background:#4f46e5; color:#fff; display:flex; align-items:center; justify-content:center; font-size:1.2rem; flex-shrink:0;">
                        <i class="fas fa-link"></i>
                    </div>
                    <div>
                        <strong style="color:#1e1b4b; font-size:0.95rem; display:block;">
                            Cuentas Duplicadas Detectadas: ${cliYitxel.nombre} (${cliYitxel.id}) y ${cliYixel.nombre} (${cliYixel.id})
                        </strong>
                        <span style="font-size:0.82rem; color:#4338ca; display:block; margin-top:2px;">
                            Al registrar al usuario no se vinculó la deuda de la libreta ($${estYixel.saldoDeudaUSD.toFixed(2)}). Puedes unificarlos ahora para consolidar su deuda total en <strong>$${deudaConsolidada}</strong>.
                        </span>
                    </div>
                </div>
                <div style="display:flex; gap:8px;">
                    <button type="button" class="btn btn-sm btn-primary" onclick="abrirModalFusionarClientes('${cliYitxel.id}', '${cliYixel.id}')" style="background:#4f46e5; border-color:#4338ca; color:#fff; font-weight:800; padding:8px 16px; border-radius:8px; display:inline-flex; align-items:center; gap:6px; box-shadow:0 3px 8px rgba(79,70,229,0.3);">
                        <i class="fas fa-wand-magic-sparkles"></i> Unificar Ahora en 1 Clic
                    </button>
                </div>
            </div>
        `;
        return;
    }

    // Si no hay duplicados conocidos pendientes, ocultamos el banner
    banner.style.display = 'none';
    banner.innerHTML = '';
}
window.verificarSugerenciasFusionClientes = verificarSugerenciasFusionClientes;

/**
 * Abre el Modal de Fusión / Unificación de Clientes y llena los selectores
 */
function abrirModalFusionarClientes(preselectPrincipalId = null, preselectSecundarioId = null) {
    const modal = document.getElementById('modal-fusionar-clientes');
    const selPrin = document.getElementById('fusion-cliente-principal');
    const selSec = document.getElementById('fusion-cliente-secundario');
    if (!modal || !selPrin || !selSec) return;

    const lista = Array.isArray(clientes) ? clientes : (AppState.clientes || []);
    const usuariosList = Array.isArray(AppState.usuarios) ? AppState.usuarios : (window.usuarios || []);

    if (lista.length < 2) {
        if (typeof showCustomToast === 'function') {
            showCustomToast('Se requieren al menos 2 clientes registrados para realizar una fusión.', 'warning');
        } else {
            alert('Se requieren al menos 2 clientes registrados para realizar una fusión.');
        }
        return;
    }

    // Ordenar clientes: primero los que tienen usuario o compras, luego alfabéticamente
    const clientesOrdenados = [...lista].sort((a, b) => {
        const uA = usuariosList.some(u => u.clienteId === a.id || String(u.cedula) === String(a.id));
        const uB = usuariosList.some(u => u.clienteId === b.id || String(u.cedula) === String(b.id));
        if (uA && !uB) return -1;
        if (!uA && uB) return 1;
        return String(a.nombre || '').localeCompare(String(b.nombre || ''));
    });

    const optionsHtml = clientesOrdenados.map(c => {
        const tieneUser = usuariosList.some(u => u.clienteId === c.id || String(u.cedula) === String(c.id) || String(u.id) === String(c.usuarioId));
        const est = calcularEstadoFinancieroCliente(c.id);
        const tagUser = tieneUser ? ' [👤 Con Usuario]' : '';
        const tagDeuda = est.saldoDeudaUSD > 0 ? ` [Deuda: $${est.saldoDeudaUSD.toFixed(2)}]` : '';
        return `<option value="${c.id}">${c.nombre} (ID: ${c.id})${tagUser}${tagDeuda}</option>`;
    }).join('');

    selPrin.innerHTML = optionsHtml;
    selSec.innerHTML = optionsHtml;

    // Determinar selecciones iniciales
    if (preselectPrincipalId && lista.some(c => c.id === preselectPrincipalId)) {
        selPrin.value = preselectPrincipalId;
    } else {
        // Por defecto: si existe Yitxel Cuenca 27611440, preseleccionarla
        const yitxel = lista.find(c => c.id === '27611440' || c.cedula === '27611440');
        if (yitxel) selPrin.value = yitxel.id;
        else selPrin.value = clientesOrdenados[0].id;
    }

    if (preselectSecundarioId && lista.some(c => c.id === preselectSecundarioId)) {
        selSec.value = preselectSecundarioId;
    } else {
        // Por defecto: si existe Yixel CLI-025, preseleccionarla como secundario
        const yixel = lista.find(c => c.id === 'CLI-025' || (c.nombre && c.nombre.trim().toUpperCase() === 'YIXEL'));
        if (yixel && yixel.id !== selPrin.value) {
            selSec.value = yixel.id;
        } else {
            // Primer cliente diferente del principal
            const otro = clientesOrdenados.find(c => c.id !== selPrin.value);
            if (otro) selSec.value = otro.id;
        }
    }

    alCambiarSeleccionFusion();
    modal.style.display = 'flex';
}
window.abrirModalFusionarClientes = abrirModalFusionarClientes;

function cerrarModalFusionarClientes() {
    const modal = document.getElementById('modal-fusionar-clientes');
    if (modal) modal.style.display = 'none';
}
window.cerrarModalFusionarClientes = cerrarModalFusionarClientes;

/**
 * Actualiza las tarjetas y la vista previa en vivo al cambiar la selección en el modal
 */
function alCambiarSeleccionFusion() {
    const selPrin = document.getElementById('fusion-cliente-principal');
    const selSec = document.getElementById('fusion-cliente-secundario');
    const cardPrin = document.getElementById('fusion-card-principal');
    const cardSec = document.getElementById('fusion-card-secundario');
    const previewRes = document.getElementById('fusion-preview-resultado');
    const btnConfirmar = document.getElementById('btn-confirmar-fusion');

    if (!selPrin || !selSec || !cardPrin || !cardSec || !previewRes) return;

    const idPrin = selPrin.value;
    const idSec = selSec.value;

    const lista = Array.isArray(clientes) ? clientes : (AppState.clientes || []);
    const usuariosList = Array.isArray(AppState.usuarios) ? AppState.usuarios : (window.usuarios || []);
    const tasa = typeof tasaActiva === 'number' && tasaActiva > 0 ? tasaActiva : (AppState.tasaActiva || 1);

    if (idPrin === idSec) {
        cardPrin.innerHTML = `<span style="color:#dc2626; font-weight:700;">No puedes fusionar un cliente consigo mismo. Selecciona un cliente diferente.</span>`;
        cardSec.innerHTML = `<span style="color:#dc2626; font-weight:700;">Selecciona un cliente secundario diferente.</span>`;
        previewRes.innerHTML = `<div style="color:#dc2626; font-weight:700; text-align:center;">Por favor selecciona dos clientes distintos.</div>`;
        if (btnConfirmar) btnConfirmar.disabled = true;
        return;
    }

    if (btnConfirmar) btnConfirmar.disabled = false;

    const cliPrin = lista.find(c => c.id === idPrin);
    const cliSec = lista.find(c => c.id === idSec);

    if (!cliPrin || !cliSec) return;

    const estPrin = calcularEstadoFinancieroCliente(idPrin);
    const estSec = calcularEstadoFinancieroCliente(idSec);

    const userPrin = usuariosList.find(u => u.clienteId === cliPrin.id || String(u.cedula) === String(cliPrin.id) || String(u.id) === String(cliPrin.usuarioId));
    const userSec = usuariosList.find(u => u.clienteId === cliSec.id || String(u.cedula) === String(cliSec.id) || String(u.id) === String(cliSec.usuarioId));

    // Renderizar Card Principal
    cardPrin.innerHTML = `
        <div style="background:#fff; border:1px solid #e0e7ff; border-radius:8px; padding:8px 10px;">
            <div style="font-weight:700; color:#1e1b4b; font-size:0.9rem;">${cliPrin.nombre}</div>
            <div style="color:var(--text-muted); font-size:0.78rem;">ID: <strong>${cliPrin.id}</strong> · Tel: <strong>${cliPrin.telefono || '—'}</strong></div>
            <div style="margin-top:4px; display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                ${userPrin 
                    ? `<span class="badge" style="background:#dcfce7; color:#15803d; font-size:0.72rem; padding:2px 6px; border-radius:4px; font-weight:700;"><i class="fas fa-user-check"></i> Usuario: ${userPrin.cedula || userPrin.id}</span>`
                    : `<span class="badge" style="background:#f1f5f9; color:#64748b; font-size:0.72rem; padding:2px 6px; border-radius:4px;"><i class="fas fa-user-slash"></i> Sin Usuario</span>`
                }
                <span class="badge" style="background:#eff6ff; color:#1d4ed8; font-size:0.72rem; padding:2px 6px; border-radius:4px; font-weight:700;">
                    Comprado: $${estPrin.totalCompradoUSD.toFixed(2)}
                </span>
                <span class="badge" style="background:${estPrin.saldoDeudaUSD > 0 ? '#fee2e2' : '#f0fdf4'}; color:${estPrin.saldoDeudaUSD > 0 ? '#b91c1c' : '#15803d'}; font-size:0.72rem; padding:2px 6px; border-radius:4px; font-weight:700;">
                    Deuda: $${estPrin.saldoDeudaUSD.toFixed(2)}
                </span>
            </div>
        </div>
    `;

    // Renderizar Card Secundario
    cardSec.innerHTML = `
        <div style="background:#fff; border:1px solid #ffedd5; border-radius:8px; padding:8px 10px;">
            <div style="font-weight:700; color:#7c2d12; font-size:0.9rem;">${cliSec.nombre}</div>
            <div style="color:var(--text-muted); font-size:0.78rem;">ID: <strong>${cliSec.id}</strong> · Tel: <strong>${cliSec.telefono || '—'}</strong></div>
            <div style="margin-top:4px; display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                ${userSec 
                    ? `<span class="badge" style="background:#dcfce7; color:#15803d; font-size:0.72rem; padding:2px 6px; border-radius:4px; font-weight:700;"><i class="fas fa-user-check"></i> Usuario: ${userSec.cedula || userSec.id}</span>`
                    : `<span class="badge" style="background:#f1f5f9; color:#64748b; font-size:0.72rem; padding:2px 6px; border-radius:4px;"><i class="fas fa-user-slash"></i> Sin Usuario</span>`
                }
                <span class="badge" style="background:#fff7ed; color:#c2410c; font-size:0.72rem; padding:2px 6px; border-radius:4px; font-weight:700;">
                    Aportará Compras: $${estSec.totalCompradoUSD.toFixed(2)}
                </span>
                <span class="badge" style="background:${estSec.saldoDeudaUSD > 0 ? '#fee2e2' : '#f0fdf4'}; color:${estSec.saldoDeudaUSD > 0 ? '#b91c1c' : '#15803d'}; font-size:0.72rem; padding:2px 6px; border-radius:4px; font-weight:700;">
                    Aportará Deuda: $${estSec.saldoDeudaUSD.toFixed(2)}
                </span>
            </div>
        </div>
    `;

    // Calcular resultado unificado respetando opción de transferir o no la deuda
    const chkTransferir = document.getElementById('fusion-transferir-deuda');
    const transferirDeuda = chkTransferir ? chkTransferir.checked : true;
    const deudaSecundaria = transferirDeuda ? estSec.saldoDeudaUSD : 0;

    const totalCompradoConsolidado = (estPrin.totalCompradoUSD + estSec.totalCompradoUSD).toFixed(2);
    const deudaConsolidada = (estPrin.saldoDeudaUSD + deudaSecundaria).toFixed(2);
    const deudaVES = (Number(deudaConsolidada) * tasa).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const ventasTransferir = estSec.ventasCliente.length;
    const abonosTransferir = estSec.abonosCliente.length;

    previewRes.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
            <div>
                <strong style="color:#15803d; font-size:0.95rem; display:flex; align-items:center; gap:6px;">
                    <i class="fas fa-chart-line"></i> Resultado Consolidado para: "${cliPrin.nombre}"
                </strong>
                <div style="font-size:0.82rem; color:#166534; margin-top:4px;">
                    Se reasignarán <strong>${ventasTransferir} compras/ventas</strong> y <strong>${abonosTransferir} pagos/abonos</strong> del registro secundario.
                </div>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <div style="background:#fff; border:1px solid #bbf7d0; border-radius:8px; padding:6px 12px; text-align:center;">
                    <span style="font-size:0.72rem; color:var(--text-muted); display:block;">Total Comprado Final</span>
                    <strong style="font-size:1.1rem; color:#15803d;">$${totalCompradoConsolidado}</strong>
                </div>
                <div style="background:#fff; border:1px solid ${deudaConsolidada > 0 ? '#fecaca' : '#bbf7d0'}; border-radius:8px; padding:6px 12px; text-align:center;">
                    <span style="font-size:0.72rem; color:var(--text-muted); display:block;">Nueva Deuda Consolidada</span>
                    <strong style="font-size:1.1rem; color:${deudaConsolidada > 0 ? '#dc2626' : '#15803d'};">$${deudaConsolidada}</strong>
                    <small style="font-size:0.72rem; color:${deudaConsolidada > 0 ? '#dc2626' : '#15803d'}; display:block;">Bs. ${deudaVES}</small>
                </div>
            </div>
        </div>
    `;
}
window.alCambiarSeleccionFusion = alCambiarSeleccionFusion;

/**
 * Ejecuta la fusión integral de dos clientes, consolidando deudas, ventas, abonos y cuentas.
 */
async function ejecutarFusionClientes() {
    const selPrin = document.getElementById('fusion-cliente-principal');
    const selSec = document.getElementById('fusion-cliente-secundario');
    if (!selPrin || !selSec) return;

    const idPrin = selPrin.value;
    const idSec = selSec.value;

    if (!idPrin || !idSec || idPrin === idSec) {
        alert('Por favor selecciona dos clientes distintos para fusionar.');
        return;
    }

    const lista = Array.isArray(clientes) ? clientes : (AppState.clientes || []);
    const cliPrin = lista.find(c => c.id === idPrin);
    const cliSec = lista.find(c => c.id === idSec);

    if (!cliPrin || !cliSec) {
        alert('No se encontraron los datos de los clientes seleccionados.');
        return;
    }

    const estPrin = calcularEstadoFinancieroCliente(idPrin);
    const estSec = calcularEstadoFinancieroCliente(idSec);

    const chkTransferir = document.getElementById('fusion-transferir-deuda');
    const transferirDeuda = chkTransferir ? chkTransferir.checked : true;
    const deudaSecundariaATransferir = transferirDeuda
        ? Number(estSec.saldoDeudaUSD || cliSec.deudaUSD || cliSec.deudaInicialUSD || 0)
        : 0;
    const deudaFinal = (estPrin.saldoDeudaUSD + deudaSecundariaATransferir).toFixed(2);

    let confirmado = false;
    const mensajeConfirm = `¿Confirmas fusionar la cuenta de "${cliSec.nombre}" (${cliSec.id}) dentro de "${cliPrin.nombre}" (${cliPrin.id})?\n\n• Deuda a transferir: $${deudaSecundariaATransferir.toFixed(2)}${!transferirDeuda ? ' (Desmarcado: ya fue pagada)' : ''}.\n• La nueva deuda total consolidada será de $${deudaFinal}.\n• Todas las ventas y abonos se conservarán y se transferirán a ${cliPrin.nombre}.\n• El registro duplicado "${cliSec.nombre}" se retirará del directorio activo.`;

    if (typeof showCustomConfirm === 'function') {
        confirmado = await showCustomConfirm(
            'Confirmar Fusión de Clientes',
            `<div style="text-align:left; font-size:0.9rem; line-height:1.5;">
                <p>¿Estás seguro de fusionar <strong>${cliSec.nombre} (${cliSec.id})</strong> dentro de <strong>${cliPrin.nombre} (${cliPrin.id})</strong>?</p>
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px; margin:10px 0;">
                    <div>💵 <strong>Deuda a transferir:</strong> ${deudaSecundariaATransferir > 0 ? `+$${deudaSecundariaATransferir.toFixed(2)}` : '<span style="color:#15803d; font-weight:700;">$0.00 (Ya pagada / Sin deuda)</span>'}</div>
                    <div>📦 <strong>Compras a transferir:</strong> ${estSec.ventasCliente.length} ventas ($${estSec.totalCompradoUSD.toFixed(2)})</div>
                    <div style="color:${deudaFinal > 0 ? '#dc2626' : '#15803d'}; font-weight:700; margin-top:6px; font-size:1rem;">
                        ${deudaFinal > 0 ? `🔴 Deuda Final Consolidada: $${deudaFinal}` : '🟢 Cuenta Solvente y Al Día: $0.00'}
                    </div>
                </div>
                <small style="color:var(--text-muted);">Esta acción es irreversible y garantiza la exactitud de los saldos.</small>
            </div>`,
            'warning'
        );
    } else {
        confirmado = confirm(mensajeConfirm);
    }

    if (!confirmado) return;

    // 1. Identificadores que pertenecían al cliente secundario
    const secundarioIds = new Set([
        String(cliSec.id || '').trim().toUpperCase(),
        String(cliSec.cedula || '').trim().toUpperCase(),
        String(cliSec.codigoOficial || '').trim().toUpperCase()
    ].filter(Boolean));

    const secundarioNombres = new Set([
        String(cliSec.nombre || '').trim().toUpperCase()
    ].filter(Boolean));

    // 2. Reasignar Ventas
    const ventasList = Array.isArray(ventas) ? ventas : (AppState.ventas || []);
    const ventasModificadas = [];

    ventasList.forEach(v => {
        if (!v) return;
        const vCId = String(v.clienteId || '').trim().toUpperCase();
        const vNom = String(v.clienteNombre || v.nombreCliente || '').trim().toUpperCase();

        if (secundarioIds.has(vCId) || (vNom && secundarioNombres.has(vNom))) {
            v.clienteId = cliPrin.id;
            v.clienteNombre = cliPrin.nombre;
            v.clienteCedula = cliPrin.cedula || cliPrin.id;
            if (cliPrin.usuarioId) v.usuarioId = cliPrin.usuarioId;
            ventasModificadas.push(v);
        }
    });

    // 3. Reasignar Abonos
    const abonosList = Array.isArray(abonos) ? abonos : (AppState.abonos || []);
    const abonosModificados = [];

    abonosList.forEach(a => {
        if (!a) return;
        const aCId = String(a.clienteId || '').trim().toUpperCase();
        const aNom = String(a.clienteNombre || a.nombreCliente || '').trim().toUpperCase();

        if (secundarioIds.has(aCId) || (aNom && secundarioNombres.has(aNom))) {
            a.clienteId = cliPrin.id;
            a.clienteNombre = cliPrin.nombre;
            a.clienteCedula = cliPrin.cedula || cliPrin.id;
            if (cliPrin.usuarioId) a.usuarioId = cliPrin.usuarioId;
            abonosModificados.push(a);
        }
    });

    // 4. Reasignar Transacciones
    const txList = Array.isArray(AppState.transacciones) ? AppState.transacciones : [];
    txList.forEach(t => {
        if (!t) return;
        const tCId = String(t.clienteId || '').trim().toUpperCase();
        const tNom = String(t.clienteNombre || '').trim().toUpperCase();
        if (secundarioIds.has(tCId) || (tNom && secundarioNombres.has(tNom))) {
            t.clienteId = cliPrin.id;
            t.clienteNombre = cliPrin.nombre;
        }
    });

    // 5. Reasignar Pagos por verificar
    const pagosPend = Array.isArray(AppState.pagosPorVerificar) ? AppState.pagosPorVerificar : [];
    pagosPend.forEach(p => {
        if (!p) return;
        const pCId = String(p.clienteId || '').trim().toUpperCase();
        if (secundarioIds.has(pCId)) {
            p.clienteId = cliPrin.id;
            p.clienteNombre = cliPrin.nombre;
            p.clienteCedula = cliPrin.cedula || cliPrin.id;
        }
    });

    // 6. Consolidar datos en el cliente principal
    cliPrin.codigosAnteriores = Array.isArray(cliPrin.codigosAnteriores) ? cliPrin.codigosAnteriores : [];
    if (!cliPrin.codigosAnteriores.includes(cliSec.id)) cliPrin.codigosAnteriores.push(cliSec.id);
    if (cliSec.codigoOficial && !cliPrin.codigosAnteriores.includes(cliSec.codigoOficial)) cliPrin.codigosAnteriores.push(cliSec.codigoOficial);

    cliPrin.nombresAnteriores = Array.isArray(cliPrin.nombresAnteriores) ? cliPrin.nombresAnteriores : [];
    if (!cliPrin.nombresAnteriores.includes(cliSec.nombre)) cliPrin.nombresAnteriores.push(cliSec.nombre);

    if (String(cliSec.id).startsWith('CLI-') && !cliPrin.codigoOficial) {
        cliPrin.codigoOficial = cliSec.id;
    }

    if (!cliPrin.telefono && cliSec.telefono) cliPrin.telefono = cliSec.telefono;
    if (!cliPrin.email && cliSec.email) cliPrin.email = cliSec.email;
    if (!cliPrin.usuarioId && cliSec.usuarioId) cliPrin.usuarioId = cliSec.usuarioId;

    // Transferir o crear venta de crédito para la deuda del cliente secundario (si el admin confirmó transferirla)
    const tieneVentaFiadoSec = ventasModificadas.some(v => v.id && String(v.id).startsWith('V_FIADO_'));
    if (deudaSecundariaATransferir > 0 && !tieneVentaFiadoSec) {
        const ventaCreditoTransferida = {
            id: `V_FIADO_${cliSec.id}_FUSION`,
            clienteId: cliPrin.id,
            clienteNombre: cliPrin.nombre,
            clienteCedula: cliPrin.cedula || cliPrin.id,
            usuarioId: cliPrin.usuarioId || null,
            vendedorId: 'ADMIN',
            vendedorNombre: 'Josna / Administración',
            fecha: new Date().toISOString().replace('T', ' ').substring(0, 16),
            items: [
                {
                    productoId: 'SALDO_INICIAL',
                    nombre: `Saldo pendiente consolidado (${cliSec.nombre} - ${cliSec.id})`,
                    cantidad: 1,
                    precio: Number(deudaSecundariaATransferir.toFixed(2)),
                    costo: 0,
                    subtotal: Number(deudaSecundariaATransferir.toFixed(2))
                }
            ],
            total: Number(deudaSecundariaATransferir.toFixed(2)),
            totalUSD: Number(deudaSecundariaATransferir.toFixed(2)),
            tipo: 'Crédito',
            tipoPago: 'Crédito',
            metodoDetalle: 'Crédito (Transferencia por unificación)',
            referencia: `Saldo transferido por fusión de cuenta ${cliSec.nombre} (${cliSec.id})`,
            estado: 'PENDIENTE',
            confirmada: false
        };
        ventasList.unshift(ventaCreditoTransferida);
        ventasModificadas.push(ventaCreditoTransferida);
        cliPrin.deudaInicialUSD = Number((Number(cliPrin.deudaInicialUSD || 0) + deudaSecundariaATransferir).toFixed(2));
        cliPrin.deudaUSD = Number((Number(cliPrin.deudaUSD || 0) + deudaSecundariaATransferir).toFixed(2));
    }

    // 7. Actualizar vinculación de usuarios
    const usuariosList = Array.isArray(AppState.usuarios) ? AppState.usuarios : (window.usuarios || []);
    usuariosList.forEach(u => {
        if (!u) return;
        if (u.clienteId === cliSec.id || (cliSec.cedula && u.cedula === cliSec.cedula)) {
            u.clienteId = cliPrin.id;
            u.clienteVinculado = cliPrin.nombre;
        }
        if (u.clienteId === cliPrin.id || (cliPrin.cedula && u.cedula === cliPrin.cedula)) {
            u.clienteId = cliPrin.id;
            u.clienteVinculado = cliPrin.nombre;
        }
    });

    // 8. Registrar en historial de clientes fusionados
    if (!Array.isArray(AppState.clientesFusionados)) AppState.clientesFusionados = [];
    AppState.clientesFusionados.push({
        idOrigen: cliSec.id,
        nombreOrigen: cliSec.nombre,
        idDestino: cliPrin.id,
        nombreDestino: cliPrin.nombre,
        deudaTransferidaUSD: deudaSecundariaATransferir,
        comprasTransferidasUSD: estSec.totalCompradoUSD,
        fecha: new Date().toISOString()
    });

    // 9. Quitar al cliente secundario del directorio activo y asegurar presencia del cliente principal
    AppState.clientes = lista.filter(c => c.id !== cliSec.id);
    if (!AppState.clientes.some(c => c.id === cliPrin.id)) {
        AppState.clientes.push(cliPrin);
    }
    if (typeof clientes !== 'undefined') clientes = AppState.clientes;

    // 10. Persistencia local y en la nube Firestore
    if (window.InventoryApp && window.InventoryApp.Persistence) {
        window.InventoryApp.Persistence.guardar(true);
    }

    if (window.InventoryApp && window.InventoryApp.Firebase) {
        if (typeof window.InventoryApp.Firebase.fusionarClientes === 'function') {
            window.InventoryApp.Firebase.fusionarClientes(cliPrin.id, cliSec.id, cliPrin, ventasModificadas, abonosModificados).catch(err => {
                console.warn('[Fusión Clientes] Error en Firestore:', err);
            });
        } else {
            if (typeof window.InventoryApp.Firebase.eliminarCliente === 'function') {
                window.InventoryApp.Firebase.eliminarCliente(cliSec.id, {
                    motivo: 'FUSIÓN / UNIFICACIÓN',
                    nombre: cliSec.nombre,
                    fusionadoEn: cliPrin.id,
                    fecha: new Date().toISOString().replace('T', ' ').substring(0, 16)
                }).catch(() => {});
            }
            if (typeof window.InventoryApp.Firebase.guardarCliente === 'function') {
                window.InventoryApp.Firebase.guardarCliente(cliPrin).catch(() => {});
            }
        }
    }

    // 11. Cerrar modal y refrescar toda la UI
    cerrarModalFusionarClientes();
    actualizarSelectClientes();
    renderizarClientes();

    // Si el cliente estaba abierto en el Panel 360°, refrescarlo con el cliente consolidado
    if (typeof clienteSeleccionadoId !== 'undefined' && (clienteSeleccionadoId === cliSec.id || clienteSeleccionadoId === cliPrin.id)) {
        verDetalleCliente(cliPrin.id);
    }

    if (typeof showCustomToast === 'function') {
        showCustomToast(`¡Clientes unificados! La cuenta de ${cliPrin.nombre} ahora tiene una deuda total de $${deudaFinal}`, 'success');
    } else {
        alert(`¡Clientes unificados con éxito!\nLa cuenta de ${cliPrin.nombre} ahora consolida todas las compras y su deuda total es de $${deudaFinal}.`);
    }
}
window.ejecutarFusionClientes = ejecutarFusionClientes;

// Función atajo para unificar a Yitxel Cuenca de inmediato si se desea llamar por consola o script
window.unificarYitxelCuencaInmediato = async function() {
    const lista = Array.isArray(clientes) ? clientes : (AppState.clientes || []);
    const yitxel = lista.find(c => String(c.id).trim() === '27611440' || String(c.cedula).trim() === '27611440');
    const yixel = lista.find(c => String(c.id).trim().toUpperCase() === 'CLI-025' || String(c.nombre).trim().toUpperCase() === 'YIXEL');
    if (!yitxel || !yixel) {
        console.log('No se encontraron ambos clientes activos (posiblemente ya fueron fusionados).');
        return;
    }
    abrirModalFusionarClientes(yitxel.id, yixel.id);
};

// Asegurar consolidación automática de la deuda de Yitxel Cuenca
if (typeof asegurarDeudaConsolidadaYitxelCuenca === 'function') {
    setTimeout(asegurarDeudaConsolidadaYitxelCuenca, 250);
}

/**
 * =========================================================================================
 * FUNCIONALIDAD: SUMAR DEUDA / PRÉSTAMO MANUAL A CLIENTES (SIN AFECTAR INVENTARIO)
 * =========================================================================================
 */

let isGuardandoCargoManual = false;

/**
 * Abre el modal para sumar deuda o registrar un préstamo de dinero en efectivo a un cliente
 */
function abrirModalSumarDeudaCliente(clienteId) {
    const modal = document.getElementById('modal-sumar-deuda-cliente');
    if (!modal) return;

    isGuardandoCargoManual = false;
    const submitBtn = modal.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Cargar a la Deuda';
    }

    const lista = Array.isArray(clientes) ? clientes : (AppState.clientes || []);
    let cliente = null;
    if (clienteId) {
        cliente = lista.find(c => String(c.id) === String(clienteId) || String(c.cedula) === String(clienteId));
    }
    if (!cliente && typeof clienteSeleccionadoId !== 'undefined' && clienteSeleccionadoId) {
        cliente = lista.find(c => String(c.id) === String(clienteSeleccionadoId) || String(c.cedula) === String(clienteSeleccionadoId));
    }

    if (!cliente) {
        if (typeof showCustomToast === 'function') {
            showCustomToast('Selecciona un cliente válido para agregar deuda.', 'warning');
        } else {
            alert('Selecciona un cliente válido para agregar deuda.');
        }
        return;
    }

    // Calcular estado financiero actual
    const estado = typeof calcularEstadoFinancieroCliente === 'function' 
        ? calcularEstadoFinancieroCliente(cliente.id) 
        : { saldoDeudaUSD: Number(cliente.deudaUSD || 0) };
    
    const saldoActual = estado.saldoDeudaUSD || 0;

    // Rellenar campos del modal
    const inputId = document.getElementById('sumar-deuda-cliente-id');
    const txtNombre = document.getElementById('sumar-deuda-cliente-nombre');
    const txtActual = document.getElementById('sumar-deuda-cliente-actual');
    const inputMonto = document.getElementById('sumar-deuda-monto');
    const inputMotivo = document.getElementById('sumar-deuda-motivo');
    const inputFecha = document.getElementById('sumar-deuda-fecha');
    const txtNuevoSaldo = document.getElementById('sumar-deuda-nuevo-saldo');
    const txtEquivVes = document.getElementById('sumar-deuda-equiv-ves');

    if (inputId) inputId.value = cliente.id;
    if (txtNombre) txtNombre.textContent = `${cliente.nombre} (${cliente.id})`;
    if (txtActual) txtActual.textContent = `$${saldoActual.toFixed(2)}`;

    if (inputMonto) {
        inputMonto.value = '';
    }
    if (inputMotivo) {
        inputMotivo.value = '';
    }
    if (inputFecha) {
        const ahora = new Date();
        const yyyy = ahora.getFullYear();
        const mm = String(ahora.getMonth() + 1).padStart(2, '0');
        const dd = String(ahora.getDate()).padStart(2, '0');
        const hh = String(ahora.getHours()).padStart(2, '0');
        const min = String(ahora.getMinutes()).padStart(2, '0');
        inputFecha.value = `${yyyy}-${mm}-${dd} ${hh}:${min}`;
    }
    if (txtNuevoSaldo) {
        txtNuevoSaldo.textContent = `$${saldoActual.toFixed(2)} USD`;
    }
    if (txtEquivVes) {
        txtEquivVes.textContent = '≈ Bs. 0,00';
    }

    modal.style.display = 'flex';
    setTimeout(() => {
        if (inputMonto) inputMonto.focus();
    }, 80);
}
window.abrirModalSumarDeudaCliente = abrirModalSumarDeudaCliente;

function cerrarModalSumarDeudaCliente() {
    const modal = document.getElementById('modal-sumar-deuda-cliente');
    if (modal) modal.style.display = 'none';
}
window.cerrarModalSumarDeudaCliente = cerrarModalSumarDeudaCliente;

function calcularEquivalenteSumarDeuda() {
    const inputId = document.getElementById('sumar-deuda-cliente-id');
    const inputMonto = document.getElementById('sumar-deuda-monto');
    const txtEquivVes = document.getElementById('sumar-deuda-equiv-ves');
    const txtNuevoSaldo = document.getElementById('sumar-deuda-nuevo-saldo');

    const monto = parseFloat(inputMonto ? inputMonto.value : 0) || 0;
    const tasa = typeof tasaActiva === 'number' && tasaActiva > 0 ? tasaActiva : (Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 1));
    const equivVES = tasa > 0 ? (monto * tasa) : 0;

    if (txtEquivVes) {
        txtEquivVes.textContent = `≈ Bs. ${equivVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    const cId = inputId ? inputId.value : '';
    const estado = cId && typeof calcularEstadoFinancieroCliente === 'function'
        ? calcularEstadoFinancieroCliente(cId)
        : { saldoDeudaUSD: 0 };
    const saldoActual = estado.saldoDeudaUSD || 0;
    const nuevoTotal = Math.max(0, saldoActual + monto);

    if (txtNuevoSaldo) {
        txtNuevoSaldo.textContent = `$${nuevoTotal.toFixed(2)} USD`;
    }
}
window.calcularEquivalenteSumarDeuda = calcularEquivalenteSumarDeuda;

function aplicarChipMotivoDeuda(motivo) {
    const inputMotivo = document.getElementById('sumar-deuda-motivo');
    if (inputMotivo) {
        inputMotivo.value = motivo;
        inputMotivo.focus();
    }
}
window.aplicarChipMotivoDeuda = aplicarChipMotivoDeuda;

async function guardarCargoManualCliente(event) {
    if (event && event.preventDefault) event.preventDefault();

    if (isGuardandoCargoManual) {
        console.warn('[Cargos] Guardado de cargo en progreso, ignorando envío duplicado.');
        return;
    }
    isGuardandoCargoManual = true;

    const modal = document.getElementById('modal-sumar-deuda-cliente');
    const submitBtn = modal ? modal.querySelector('button[type="submit"]') : null;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    }

    try {
        const inputId = document.getElementById('sumar-deuda-cliente-id');
        const inputMonto = document.getElementById('sumar-deuda-monto');
        const inputMotivo = document.getElementById('sumar-deuda-motivo');
        const inputFecha = document.getElementById('sumar-deuda-fecha');

        const clienteId = inputId ? inputId.value : '';
        const monto = parseFloat(inputMonto ? inputMonto.value : 0) || 0;
        const motivo = (inputMotivo ? inputMotivo.value : '').trim();
        const fechaHora = (inputFecha ? inputFecha.value : '').trim() || new Date().toISOString().replace('T', ' ').substring(0, 16);

        if (!clienteId) {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Error', 'No se ha especificado el cliente.', 'warning');
            } else {
                alert('No se ha especificado el cliente.');
            }
            return;
        }

        if (monto <= 0) {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Monto Inválido', 'Ingresa un monto en dólares mayor a cero.', 'warning');
            } else {
                alert('Ingresa un monto en dólares mayor a cero.');
            }
            if (inputMonto) inputMonto.focus();
            return;
        }

        if (!motivo) {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Motivo Requerido', 'Debes especificar el motivo del agregue a la deuda (ej. Préstamo de dinero en efectivo).', 'warning');
            } else {
                alert('Debes especificar el motivo del agregue a la deuda.');
            }
            if (inputMotivo) inputMotivo.focus();
            return;
        }

        const lista = Array.isArray(clientes) ? clientes : (AppState.clientes || []);
        const cliente = lista.find(c => String(c.id) === String(clienteId) || String(c.cedula) === String(clienteId));
        if (!cliente) {
            alert('Cliente no encontrado en el sistema.');
            return;
        }

        // Fijar deudaInicialUSD en el cliente antes de registrar el cargo para proteger la línea base
        if (typeof cliente.deudaInicialUSD !== 'number') {
            const estPre = typeof calcularEstadoFinancieroCliente === 'function' ? calcularEstadoFinancieroCliente(cliente.id) : null;
            cliente.deudaInicialUSD = (estPre && typeof estPre.saldoDeudaUSD === 'number') ? estPre.saldoDeudaUSD : Number(cliente.deudaUSD || 0);
        }

        const tasa = typeof tasaActiva === 'number' && tasaActiva > 0 ? tasaActiva : (Number(AppState.tasaActiva || AppState.tasaUSD_BCV || 1));
        const totalVES = tasa > 0 ? Number((monto * tasa).toFixed(2)) : 0;
        const cargoId = `CARGO_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

        // Construir registro de cargo / préstamo (sin descontar inventario)
        const cargoVenta = {
            id: cargoId,
            clienteId: cliente.id,
            clienteNombre: cliente.nombre,
            clienteCedula: cliente.cedula || cliente.id,
            usuarioId: cliente.usuarioId || cliente.id,
            vendedorId: AppState.usuarioActual?.id || 'ADMIN',
            vendedorNombre: AppState.usuarioActual?.nombre || 'Josna / Administración',
            fecha: fechaHora,
            tipo: 'Crédito',
            tipoPago: 'Crédito',
            esCargoManual: true,
            esPrestamo: true,
            afectaInventario: false,
            items: [{
                productoId: 'CARGO_MANUAL',
                nombre: `Préstamo / Cargo de Dinero: ${motivo}`,
                cantidad: 1,
                precio: monto,
                costo: 0,
                subtotal: monto
            }],
            total: monto,
            totalUSD: monto,
            totalVES: totalVES,
            tasa: tasa,
            motivo: motivo,
            referencia: motivo,
            concepto: 'Préstamo / Cargo manual',
            metodoDetalle: 'Préstamo / Cargo directo a cuenta (sin descontar inventario)',
            estado: 'CONFIRMADA',
            confirmada: true,
            origen: 'Administración'
        };

        // 1. Agregar a AppState.ventas SIN DUPLICAR
        if (!Array.isArray(AppState.ventas)) AppState.ventas = [];
        if (!AppState.ventas.some(v => v.id === cargoVenta.id)) {
            AppState.ventas.unshift(cargoVenta);
        }
        if (typeof ventas !== 'undefined' && Array.isArray(ventas) && ventas !== AppState.ventas) {
            if (!ventas.some(v => v.id === cargoVenta.id)) {
                ventas.unshift(cargoVenta);
            }
        }

        // 2. Recalcular estado financiero y actualizar deuda del cliente
        let nuevoEst = null;
        if (typeof calcularEstadoFinancieroCliente === 'function') {
            nuevoEst = calcularEstadoFinancieroCliente(cliente.id);
            if (nuevoEst && typeof nuevoEst.saldoDeudaUSD === 'number') {
                cliente.deudaUSD = nuevoEst.saldoDeudaUSD;
            }
        } else {
            cliente.deudaUSD = Number(((Number(cliente.deudaUSD || 0)) + monto).toFixed(2));
        }

        // 3. Persistir de inmediato en almacenamiento local (para sobrevivir recargas de página 100% garantizado)
        if (window.InventoryApp?.Persistence?.guardar) {
            window.InventoryApp.Persistence.guardar(true);
        }

        // 4. Persistir en Firestore en segundo plano (ventas y cliente)
        if (window.InventoryApp?.Firebase) {
            try {
                if (typeof window.InventoryApp.Firebase.registrarVenta === 'function') {
                    window.InventoryApp.Firebase.registrarVenta(cargoVenta, []).catch(e => console.warn('[Cargos] Firebase venta warning:', e));
                } else if (typeof window.InventoryApp.Firebase.guardarVenta === 'function') {
                    window.InventoryApp.Firebase.guardarVenta(cargoVenta, []).catch(e => console.warn('[Cargos] Firebase venta warning:', e));
                }
                if (typeof window.InventoryApp.Firebase.guardarCliente === 'function') {
                    window.InventoryApp.Firebase.guardarCliente(cliente).catch(e => console.warn('[Cargos] Firebase cliente warning:', e));
                }
            } catch (e) {
                console.warn('[Cargos] Error al invocar guardado en Firebase:', e);
            }
        }

        // 5. Registrar notificación para auditoría administrativa
        if (typeof window.registrarNotificacion === 'function') {
            window.registrarNotificacion({
                id: 'notif_cargo_' + Date.now(),
                tipo: 'auditoria',
                subTipo: 'cargo_manual_deuda',
                titulo: 'Préstamo / Deuda Agregada',
                mensaje: `Se sumaron $${monto.toFixed(2)} USD a la cuenta de ${cliente.nombre}. Motivo: ${motivo}.`,
                montoUSD: monto,
                paraAdmin: true,
                paraCliente: false
            });
        }

        // 6. Cerrar modal de sumar deuda
        cerrarModalSumarDeudaCliente();

        // 7. Refrescar interfaces
        if (typeof renderizarClientes === 'function') renderizarClientes();
        if (typeof actualizarSelectClientes === 'function') actualizarSelectClientes();
        if (typeof renderizarCustomClientePickersPOS === 'function') renderizarCustomClientePickersPOS('both');

        // Refrescar Ficha 360° si está abierta
        const modal360 = document.getElementById('modal-cliente-detalle');
        if (modal360 && modal360.style.display !== 'none' && typeof verDetalleCliente === 'function') {
            verDetalleCliente(cliente.id);
        }

        // 8. Mensaje de confirmación al usuario
        const deudaFinalStr = nuevoEst ? nuevoEst.saldoDeudaUSD.toFixed(2) : cliente.deudaUSD.toFixed(2);
        if (typeof showCustomAlert === 'function') {
            showCustomAlert(
                'Deuda Actualizada',
                `Se han sumado con éxito <b>$${monto.toFixed(2)} USD</b> a la deuda de <b>${cliente.nombre}</b>.<br><br>` +
                `📝 <b>Motivo:</b> ${motivo}<br>` +
                `💳 <b>Nueva Deuda Total:</b> $${deudaFinalStr} USD<br>` +
                `📦 <b>Inventario:</b> No fue afectado (sin movimiento de stock).`,
                'success'
            );
        } else if (typeof showCustomToast === 'function') {
            showCustomToast(`+$${monto.toFixed(2)} USD cargados a ${cliente.nombre} (${motivo})`, 'success');
        } else {
            alert(`¡Deuda sumada con éxito!\n\nSe sumaron $${monto.toFixed(2)} USD a ${cliente.nombre}.\nMotivo: ${motivo}\nNueva deuda total: $${deudaFinalStr} USD\nEl inventario no fue afectado.`);
        }
    } finally {
        isGuardandoCargoManual = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Cargar a la Deuda';
        }
    }
}
window.guardarCargoManualCliente = guardarCargoManualCliente;



