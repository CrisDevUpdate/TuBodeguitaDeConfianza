## 4.3.9-beta
- Reinicio por espacios de trabajo: los datos anteriores se conservan intactos y se archivan como JSON por registro.
- Cada reinicio crea un namespace nuevo de Firestore para empezar con una base operativa limpia.
- Se crea automáticamente el único usuario inicial SuperAdmin en el nuevo espacio.
- El acceso al reinicio está en Configuraciones y exige la contraseña especial de confirmación.
- Se genera además un respaldo JSON descargable en cada reinicio.

# CHANGELOG

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
