# CHANGELOG

## 4.1.1-beta — Blindaje integral de alertas y sonidos de nuevos registros (Exclusivo Administrador)
- Se añadió validación estricta dentro de `reproducirSonidoNotificacion()` para bloquear cualquier sonido Web Audio API si la sesión actual no es un Administrador activo.
- Se añadió comprobación contextual en el listener en tiempo real de Firestore para ignorar completamente notificaciones y sonidos si la sesión corresponde a un cliente o si la interfaz activa es una vista de cliente (`cliente-*`).
- Se corrigió la función de registro en el panel de usuarios para preservar la sesión del administrador activo cuando crea o registra usuarios.
- Se implementaron cabeceras `no-cache` en el servidor y versiones de control de caché (`?v=4.1.1`) en las etiquetas de script de `index.html` para garantizar que los navegadores y dispositivos de clientes ejecuten inmediatamente la lógica actualizada.

## 4.1.0-beta — Restricción de notificaciones de nuevos clientes al Administrador
- Las alertas visuales (toast) y el sonido de notificación de nuevas solicitudes de registro ahora se emiten exclusivamente para el Administrador activo.
- Los clientes u otros usuarios conectados ya no reciben alertas ni sonidos cuando se registra un nuevo cliente en el sistema.

## 4.0.0-beta — Ayuda contextual del Stock
- Recuperado el texto informativo del Stock sin ocupar espacio permanente en el formulario.
- Añadido un icono de información junto a “Stock Inicial”.
- Al pasar el mouse o enfocar el icono aparece un tooltip con sombra, sin alterar la distribución del formulario.
- Se mantiene la regla de negocio: al editar, el stock solo cambia mediante Venta, Retiro o Auditoría.

## 3.0.0-beta — Corrección de desbordamiento del campo Stock
- Corregido el desbordamiento visual del input `prod-stock` dentro de `product-form-top`.
- Todos los controles de formulario respetan el ancho de su celda mediante `box-sizing: border-box` y `max-width: 100%`.
- La cuadrícula superior usa columnas flexibles con `minmax(0, ...)`, evitando que el campo Stock sobresalga del contenedor.


## Versión 2 Beta — 2.0.0-beta
- Simplificado el campo de Stock del formulario de producto.
- Eliminado el texto auxiliar `prod-stock-help` que ocupaba espacio y deformaba visualmente el formulario.
- Se mantiene intacta la regla de negocio: al editar un producto, el stock continúa bloqueado y solo puede cambiar mediante Venta, Retiro o Auditoría.

## Versión 1 Beta — 1.0.0-beta
- Refactorización modular y mejoras de persistencia/conciliación.
