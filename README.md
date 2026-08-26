# Inventario + POS — Versión Beta 1.0.0

## Nombre de versión
**Versión Beta — Arquitectura Producción**

Esta entrega es la **primera mejora beta sobre la Versión 0** del proyecto. Conserva el contrato de handlers inline del HTML y reorganiza la aplicación para una evolución segura.

## Arquitectura
- `index.html` — interfaz principal.
- `core/app-state.js` — estado compartido y servicio central de stock.
- `core/helpers.js` — utilidades puras: normalización de texto, referencias, montos, HTML seguro y fechas.
- `core/persistence.js` — persistencia automática local con recuperación al abrir el sistema.
- `core/bcv.js` — tasas BCV y conversión visual.
- `modules/productos.js` — productos, precios, imágenes, inventario y retiros.
- `modules/pos.js` — catálogo POS, carrito y ventas.
- `modules/clientes.js` — clientes y estado financiero.
- `modules/pagos-transacciones.js` — pagos, referencias, conciliación y procesamiento por lotes.
- `modules/auditoria.js` — conteo físico y ajustes.
- `modules/perdidas.js` — pérdidas y recuperación.
- `app.js` — composition root / inicialización.
- `original/` — respaldo de la implementación anterior.

## Reglas de negocio protegidas
1. El ID interno (`P1`, `P2`, ...) es independiente del código visible (`PROD-001`, ...).
2. El ID interno no se reutiliza durante la vida del dato.
3. Editar un producto existente no puede modificar stock.
4. El stock solo cambia mediante Venta, Retiro o Auditoría.
5. Costo, precio y margen permanecen almacenados en USD; BCV solo convierte la representación a Bs.
6. Las imágenes se redimensionan a un máximo de 900 px y se almacenan como JPEG Base64.
7. Descripción y Contenido/Medida permanecen como campos independientes.

## Conciliación bancaria / Mercantil
- Resolución de cliente por ID/Cédula/RIF o nombre completo sin distinguir acentos, mayúsculas ni espacios repetidos.
- Carga masiva mediante pegado, CSV, XLSX y XLS.
- Parser común para texto y archivos.
- Montos normalizados a 2 decimales y soporte de formatos con coma/punto decimal.
- Referencias aprobadas son únicas; referencias `Confirmando` o `Fallido` pueden corregirse y reintentarse sin falsos duplicados.
- Verificación individual y por lote.
- Adaptador listo para conectar una API bancaria real mediante `window.verificarTransaccionBancaria`.
- `Limpiar vista` reinicia la pantalla de conciliación sin borrar transacciones históricas ni alterar deudas.

## Persistencia
La Beta incorpora **guardado automático local** mediante `localStorage`, incluyendo productos, clientes, ventas, pagos, transacciones, auditorías, retiros, historial de clientes y trabajo de auditoría pendiente. Si el navegador bloquea el almacenamiento o se alcanza su cuota, la aplicación continúa funcionando en memoria y muestra el estado correspondiente.

> Para una instalación multiusuario real con varios equipos, la siguiente etapa recomendada sería reemplazar esta capa por una API + base de datos transaccional. La Beta deja aislada la persistencia para facilitar ese cambio.

## Validación
Los scripts se mantienen como scripts clásicos para preservar los `onclick`/`onsubmit` existentes. Se conserva la carpeta `original/` como respaldo.
