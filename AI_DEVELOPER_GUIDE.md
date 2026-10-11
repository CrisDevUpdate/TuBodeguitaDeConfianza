# Guía Maestra del Proyecto: "Tu Bodeguita de Confianza"
> **Documento de Referencia para Ingenieros de Software y Modelos de Inteligencia Artificial (IA)**  
> **Versión:** 2.0 (Producción / Multi-dispositivo)  
> **Última actualización:** Octubre 2026

---

## 1. ¿Qué es "Tu Bodeguita de Confianza"?

**Tu Bodeguita de Confianza** es una plataforma integral de gestión comercial (POS + ERP + Portal de Clientes + Fidelización) diseñada específicamente para la realidad económica, contable y operativa del comercio minorista y bodegas en **Venezuela**.

### Contexto de Negocio y Desafíos que Resuelve:
1. **Economía Bimoneda (USD y VES):** Manejo simultáneo de precios, costos, ventas y deudas en Dólares Estadounidenses (USD) y Bolívares (VES), con sincronización en tiempo real de la tasa oficial del **Banco Central de Venezuela (BCV)**.
2. **Gestión de Fiado / Crédito Informal:** Registro fidedigno de la libreta de cuentas fiadas tradicional, con cálculo matemático exacto de saldos deudores, abonos parciales, compras a crédito y estados de cuenta para clientes.
3. **Conciliación de Pagos Bancarios (Pago Móvil / Transferencias):** Flujo de reporte de pagos por parte de clientes y verificación/aprobación por parte del administrador contra referencias bancarias.
4. **Control Estricto de Inventario y Auditoría Física:** Registro de compras mediante facturas con cálculo de costo de reposición, kardex permanente, y auditorías con conteo ciego para identificar mermas o pérdidas económicas.
5. **Gamificación y Fidelización de Clientes:** Dinámica de puntos ("Desafío del Árbol", "Premio del Mes") que premia el pronto pago y compras de combos especiales, incentivando a los clientes a mantener su saldo solvente.
6. **Múltiples Puntos de Contacto:** Funciona como aplicación de escritorio, Web App móvil (PWA) y aplicación nativa Android (APK vía Capacitor/WebView).

---

## 2. Arquitectura Tecnológica

La aplicación utiliza una arquitectura desacoplada, orientada a eventos e híbrida (Offline-First + Cloud Realtime).

```
                      ┌──────────────────────────────────────┐
                      │          Firebase Firestore          │
                      │    (Fuente Única de Verdad Cloud)    │
                      └──────────────────┬───────────────────┘
                                         │ Realtime Listeners (onSnapshot)
                                         │ CRUD Batch & Set Operations
                                         ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                             CLIENTE / FRONTEND                             │
│                                                                            │
│  ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────────┐ │
│  │   core/app-state │ ──> │ modules/*.js     │ ──> │ index.html          │ │
│  │ (Memoria Global) │     │ (Lógica Negocio) │     │ (UI + Inline Events)│ │
│  └─────────┬────────┘     └──────────────────┘     └─────────────────────┘ │
│            │                                                               │
│            ▼ Local Caches                                                  │
│   localStorage / IndexedDB (ImageCache)                                    │
└────────────────────────────────────────┬───────────────────────────────────┘
                                         │ HTTP REST (/api/*)
                                         ▼
                      ┌──────────────────────────────────────┐
                      │          Backend Node.js / Express   │
                      │       (server.js - ESM Module)       │
                      │                                      │
                      │  - Proxy BCV (DolarApi, BCVApi)      │
                      │  - Vercel Blob (Subida de fotos)     │
                      │  - Reglas complejas y endpoints      │
                      └──────────────────────────────────────┘
```

### Componentes Técnicos Clave:
- **Frontend Core:** Vanilla JavaScript modular moderno (ES6+), organizado en `core/` y `modules/`, integrado con `window.InventoryApp` y variables globales reactivas (`AppState`).
- **Diseño & UI:** Tailwind CSS v4, FontAwesome 6, tema visual dinámico (Selector de temas) y estilos personalizados en `styles.css`.
- **Backend / API:** Node.js 20+ con Express en modo ESM (`"type": "module"` en `package.json`), corriendo en el puerto 3000 (`server.js`).
- **Persistencia en la Nube:** Google Firebase Firestore (SDK Web v8/v9 compat), configurado en `core/firebase-service.js`.
- **Almacenamiento de Multimedia:** `@vercel/blob` gestionado a través de proxy server-side (`/api/avatar/upload`, `/api/blob/*`) y respaldo en IndexedDB local (`core/image-cache-service.js`).
- **Exportación Contable:** `xlsx-js-style` para generar reportes ejecutivos en Excel con colores, fórmulas y tipografía profesional.

---

## 3. Estructura de Directorios y Mapa de Archivos

```
.
├── server.js                      # Servidor Express: Proxies BCV, endpoints Vercel Blob, APIs
├── app.js                         # Composition Root: Inicializa módulos al cargar el DOM
├── index.html                     # SPA Principal: Todas las vistas, modales y layouts
├── package.json                   # Configuración del proyecto y scripts
├── metadata.json                  # Metadatos del runtime AI Studio
├── firebase-applet-config.json    # Configuración de credenciales de Firebase Firestore
├── firestore.rules                # Reglas de seguridad de Firestore
├── core/                          # Núcleo de la aplicación (Servicios transversales)
│   ├── app-state.js               # Estado reactivo global (AppState) y Proxies
│   ├── firebase-service.js        # Servicio de integración y listeners con Firestore
│   ├── persistence.js             # Capa de almacenamiento local (localStorage + sesión)
│   ├── bcv.js                     # Motor de tasa cambiaria BCV (scraping/APIs y caché)
│   ├── modal.js                   # Sistema de alertas, confirmaciones y toasts flotantes
│   ├── helpers.js                 # Utilidades: fechas, monedas, normalizaciones, switchTab
│   ├── image-cache-service.js     # Caché de imágenes en IndexedDB y subida a Vercel Blob
│   ├── google-drive-service.js    # Respaldo y restauración directa con Google Drive
│   └── excel-exporter.js          # Exportador de reportes contables en Excel (.xlsx)
├── modules/                       # Módulos funcionales de negocio
│   ├── pos.js                     # Punto de Venta: Catálogo POS, carrito, cálculo de ventas
│   ├── productos.js               # Mantenimiento de productos, precios, combos y catálogo
│   ├── clientes.js                # Libreta de clientes, deudas, unificación y cargos
│   ├── cliente-view.js            # Portal personal del Cliente (Catálogo, cuenta, pagos)
│   ├── pagos-transacciones.js     # Conciliación bancaria, abonos, pagos por verificar
│   ├── facturas.js                # Facturas de compras a proveedores, costos de reposición
│   ├── movimientos-stock.js       # Kardex permanente y auditoría de movimientos de almacén
│   ├── auditoria.js               # Auditoría física de inventario con conteo ciego
│   ├── perdidas.js                # Libro de pérdidas económicas por vencimiento o merma
│   ├── caja-turnos.js             # Control de turnos de caja, apertura, retiro y arqueo
│   ├── usuarios.js                # Control de acceso (RBAC), usuarios y aprobaciones
│   ├── notificaciones.js          # Centro de notificaciones internas y alertas en vivo
│   ├── premio-mes.js              # Gamificación: Desafío del Árbol, premios y Modo Invierno
│   ├── kiosco.js                  # Modo Kiosco de auto-atención para tabletas
│   └── configuracion.js           # Panel de configuración administrativa y datos del negocio
├── data/                          # Datos iniciales y semillas (Seed data)
│   ├── clientes-oficiales.js      # Lista inicial de clientes oficiales de la bodega
│   ├── inventario-oficial.js      # Catálogo inicial de productos
│   └── banco-frases.js            # Frases célebres y sabiduría diaria
└── api/                           # Controladores auxiliares del servidor Node.js
```

---

## 4. Roles de Usuario y Control de Acceso (RBAC)

La aplicación implementa un sistema estricto de roles gobernado por la función `verificarGatewall()` en `modules/usuarios.js`:

| Rol | Vistas Permitidas | Capacidades |
| :--- | :--- | :--- |
| **`admin` / `superadmin`** | Acceso a las 16 vistas del sistema | Acceso total: auditoría, facturas de compra, configuración, inventario, balance general, unificación de clientes y aprobación de usuarios. |
| **`vendedor`** | `pos`, `clientes` | Cobro en caja, registro de ventas, consulta de catálogo y consulta de saldos de clientes. |
| **`autoservicio` / `kiosco`** | `kiosco-view` | Interfaz simplificada para tablet en el mostrador; cuenta con temporizador de inactividad que reinicia la sesión tras cada compra. |
| **`cliente`** | `cliente-catalogo`, `cliente-cuenta`, `cliente-premio` | Catálogo de compras en línea, visualización de su estado de cuenta personal, reporte de abonos/comprobantes y participación en gamificación. |
| **`PENDIENTE_APROBACION`** | Pantalla de bloqueo | Usuarios recién registrados que esperan que el Administrador apruebe su cuenta antes de ingresar al sistema. |

---

## 5. Modelos de Datos en Firebase Firestore

Todas las entidades residen en colecciones de primer nivel en Firestore:

### 1. `productos`
```typescript
interface Producto {
  id: string;               // ID interno único (ej: "P1", "P20")
  codigo: string;           // Código visible o de barras (ej: "PROD-001", "7591031...")
  nombre: string;           // Nombre del producto
  categoria: string;        // Categoría (ej: "Víveres", "Lácteos", "Combos")
  costo: number;            // Costo unitario en USD
  precio: number;           // Precio de venta al público en USD
  ganancia: number;         // Margen de ganancia en USD (precio - costo)
  stock: number;            // Existencias físicas disponibles
  imagen: string;           // URL de Vercel Blob o DataURL optimizada
  descripcion?: string;     // Descripción detallada
  contenido?: string;       // Medida o presentación (ej: "1 Kg", "500 ml")
  esCombo?: boolean;        // true si es un paquete de varios productos
  items?: Array<{ productoId: string, cantidad: number }>; // Si es combo
  puntosCombo?: number;     // Puntos de gamificación otorgados
  updatedAt: Timestamp;
}
```

### 2. `clientes`
```typescript
interface Cliente {
  id: string;               // Cédula o código (ej: "CLI-001", "V-27611440")
  cedula?: string;          // Cédula de identidad (V-xxxxxxx)
  usuarioId?: string;       // ID del usuario de sesión vinculado en AppState.usuarios
  codigoOficial?: string;   // Código asignado si proviene de la libreta (CLI-xxx)
  nombre: string;           // Nombre completo
  telefono: string;         // Teléfono / WhatsApp
  email?: string;           // Correo electrónico
  deudaUSD: number;         // Deuda total acumulada en USD
  deudaInicialUSD: number;  // Saldo de apertura proveniente de la libreta física
  codigosAnteriores?: string[]; // Historial de códigos si fue unificado
  updatedAt: Timestamp;
}
```

### 3. `ventas`
```typescript
interface Venta {
  id: string;               // ID único (ej: "V_1728554902123", "V_FIADO_...")
  fecha: string;            // Formato "YYYY-MM-DD HH:mm"
  clienteId: string;        // ID del cliente
  clienteNombre: string;    // Nombre del cliente al momento de la venta
  vendedorId: string;       // Usuario que facturó
  items: Array<{
    productoId: string;
    nombre: string;
    cantidad: number;
    precio: number;         // Precio unitario USD
    costo: number;          // Costo unitario USD
    subtotal: number;       // cantidad * precio
  }>;
  total: number;            // Total en USD
  totalUSD: number;         // Total garantizado en USD
  totalVES?: number;        // Equivalente en Bolívares según tasa BCV
  tasaBCV?: number;         // Tasa cambiaria del momento de la transacción
  tipoPago: 'Efectivo' | 'Pago Móvil' | 'Punto de Venta' | 'Zelle' | 'Crédito' | 'Mixto';
  estado: 'PAGADA' | 'PENDIENTE'; // PENDIENTE representa venta a crédito (fiado)
  confirmada: boolean;
}
```

### 4. `abonos` (Pagos a Deudas)
```typescript
interface Abono {
  id: string;               // ID único
  fecha: string;            // Fecha del abono
  clienteId: string;        // Cédula o ID del cliente
  clienteNombre: string;
  montoUSD: number;         // Monto acreditado a la deuda en USD
  montoVES: number;         // Monto pagado en Bolívares
  tasaBCV: number;
  metodo: string;           // "Pago Móvil", "Dólares Efectivo", etc.
  referencia: string;       // Número de comprobante bancario
  comprobanteImg?: string;  // Foto del capture bancario
  estado: 'PENDIENTE_CONFIRMACION' | 'Pago agregado' | 'Confirmado' | 'RECHAZADO';
}
```

### 5. `usuarios` (Cuentas del Sistema)
```typescript
interface Usuario {
  id: string;               // Cédula o 'SuperAdmin'
  cedula: string;
  nombre: string;
  email: string;
  password: string;         // Hash SHA-256
  rol: 'admin' | 'vendedor' | 'autoservicio' | 'cliente';
  estado: 'ACTIVO' | 'PENDIENTE_APROBACION' | 'RECHAZADO';
  clienteId?: string;       // Vínculo con su registro en 'clientes'
  avatar?: string;          // URL de foto de perfil
  puntosFidelidad?: number; // Puntos del Desafío del Árbol
}
```

---

## 6. Reglas de Negocio Inviolables

Cualquier cambio de código realizado por otra IA debe respetar rigurosamente estas reglas:

### Regla 1: Todo Usuario Registrado es Automáticamente un Cliente
- Si un usuario se registra en la aplicación (incluso como cliente desde el portal web), debe existir inmediatamente una entidad en `AppState.clientes` vinculada a él con su cédula, nombre, teléfono y email.
- Si un cliente realiza una compra a crédito, su cuenta deudor se asocia unívocamente a su perfil.

### Regla 2: El Stock de Productos NUNCA se Modifica Directamente
- El campo `producto.stock` **no debe editarse manualmente** en un formulario de edición de precios o nombres.
- El stock solo se modifica mediante:
  1. **Venta concretada:** descuenta unidades vendidas.
  2. **Factura de compra a proveedor:** incrementa unidades recibidas y actualiza el costo de reposición (`costoReposicionUSD`).
  3. **Ajuste de Auditoría Física:** ajusta discrepancias tras conteo ciego.
  4. **Retiro justificado:** merma, consumo interno o daño registrado en `movimientos-stock.js`.

### Regla 3: Moneda Base en USD y Conversión Visual a VES
- Todos los cálculos matemáticos internos (subtotales, ganancias, costos, deudas y precios) se almacenan y procesan en **Dólares Estadounidenses (USD)**.
- El Bolívar (VES) se calcula en el momento de la visualización o facturación multiplicando por `AppState.tasaActiva || AppState.tasaUSD_BCV`.
- Esto previene distorsiones causadas por la inflación y devaluación diaria.

### Regla 4: Cálculo Matemático del Balance Contable del Cliente
La deuda actual de un cliente (`deudaUSD`) se calcula siempre mediante la ecuación contable:
$$\text{Saldo Deudor} = \text{deudaInicialUSD} + \sum(\text{Ventas a Crédito PENDIENTE}) - \sum(\text{Abonos Aprobados})$$
- Un abono en estado `PENDIENTE_CONFIRMACION` **no rebaja la deuda** hasta que el Administrador lo apruebe en la pestaña de transacciones.

### Regla 5: Prevención Absoluta de Bucles de Escritura con Firestore (CRÍTICO)
- **Nunca ejecutar escrituras a Firestore desde dentro de un callback de renderizado de vistas (`renderizarClientes`, `renderizarEstadoCuentaCliente`, etc.).**
- La función `asegurarSincronizacionUsuariosAClientes(sincronizarConNube = false)` debe llamarse con `false` por defecto en todos los refrescos visuales.
- Todos los listeners `onSnapshot` deben descartar eventos locales pendientes con:
  ```javascript
  if (snapshot.metadata && snapshot.metadata.hasPendingWrites) return;
  ```
- Todas las funciones de guardado a Firestore (`guardarClienteCloud`, `guardarUsuarioCloud`) deben implementar **dirty-checking de hashes** para no reenviar escrituras si los datos no cambiaron.

---

## 7. Flujos Clave de la Aplicación

### A. Flujo de Venta en POS (`modules/pos.js`)
1. El cajero selecciona productos por categoría, buscador o escáner de código de barras.
2. Los artículos se añaden al carrito (`AppState.carrito`). Se validan existencias en inventario.
3. Se selecciona el cliente (de la lista de clientes o "Consumidor Final").
4. Se elige el método de pago:
   - **Contado (Efectivo / Pago Móvil / Punto):** Calcula vuelto en Bolívares o USD.
   - **Crédito (Fiado):** Valida que el cliente esté registrado, añade la venta como `PENDIENTE` y suma a su saldo deudor.
5. Se descuenta el stock en memoria y se envía la transacción a Firestore (`guardarVentaCloud`).
6. Se limpian los campos y se refresca el stock visualmente.

### B. Flujo de Abonos y Cobranzas (`modules/pagos-transacciones.js` & `cliente-view.js`)
1. El cliente entra a su portal (`cliente-cuenta`), ve su saldo pendiente y hace clic en **"Reportar Abono"**.
2. Ingresa el monto (USD o Bs), método (Pago Móvil / Transferencia) y referencia bancaria (últimos 4 a 6 dígitos).
3. Se crea un registro en `abonos` con estado `PENDIENTE_CONFIRMACION`.
4. El Administrador recibe una alerta sonora y visual en tiempo real en su panel.
5. El Administrador revisa el extracto bancario en la pestaña **Transacciones**:
   - Si hace clic en **Aprobar:** El estado pasa a `Confirmado`, se rebaja la deuda del cliente automáticamente y se le otorgan puntos de gamificación.
   - Si hace clic en **Rechazar:** El abono se marca como rechazado y no altera la deuda.

### C. Flujo de Facturas de Proveedores y Kardex (`modules/facturas.js`)
1. El Administrador recibe mercancía y abre **Facturas**.
2. Ingresa los datos del proveedor, número de factura y lista de productos con su costo de compra.
3. Al guardar la factura:
   - Se incrementa el inventario de cada producto recibido.
   - Se actualiza el costo unitario de reposición en el producto (`costoReposicionUSD`).
   - Se genera una entrada formal en el Kardex permanente (`kardex`).

### D. Flujo de Turnos de Caja (`modules/caja-turnos.js`)
1. El vendedor inicia su jornada abriendo caja con un fondo inicial en efectivo (USD y Bs).
2. Cada venta en efectivo alimenta automáticamente el saldo esperado en caja del turno activo.
3. Si se realiza un pago a proveedores o gasto menor en efectivo, se registra como **Egreso de Caja**.
4. Al final de la jornada, se ejecuta el **Cierre y Arqueo de Caja**: el cajero cuenta el dinero físico, el sistema calcula si hay faltante o sobrante y emite el comprobante de liquidación del turno.

---

## 8. Guía para la Próxima IA: Cómo Seguir Desarrollando

Al recibir un nuevo requerimiento para este proyecto, sigue este protocolo:

1. **Mantén el contrato de eventos inline:**
   - La interfaz utiliza eventos HTML estándar (`onclick="guardarCliente(event)"`, `onchange="calcularVuelto()"`). No los elimines ni los reemplaces por sintaxis incompatibles.
2. **Utiliza las utilidades globales de `core/helpers.js`:**
   - Para formatear moneda: `formatearMoneda(monto, 'USD')` o `formatearMoneda(monto, 'VES')`.
   - Para normalizar textos y búsquedas: `normalizarTexto(texto)`.
   - Para cambiar de pestaña programáticamente: `switchTab('nombre-pestana')`.
3. **Persistencia dual (Local + Cloud):**
   - Siempre que modifiques una variable en `AppState`, llama a:
     ```javascript
     if (window.InventoryApp?.Persistence) {
         window.InventoryApp.Persistence.guardar(false);
     }
     ```
   - Si la acción amerita persistencia en la nube (ej. nueva venta, nuevo producto), usa la función correspondiente en `window.InventoryApp.Firebase.*`.
4. **Respetar la tasa BCV:**
   - Nunca inventes una tasa de cambio fija en el código. Lee siempre `AppState.tasaActiva || AppState.tasaUSD_BCV`.
5. **Verificación antes de finalizar tareas:**
   - Ejecuta `npm run lint` para validar la sintaxis del backend.
   - Ejecuta `compile_applet` para garantizar que la compilación y los tipos del proyecto están intactos.
