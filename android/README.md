# Tu Bodeguita de Confianza — Android

## Versión 1.4 — Android conectada a Vercel

Esta versión convierte la aplicación existente en una aplicación Android que abre primero la instalación oficial desplegada en Vercel:

`https://tubodeguitadeconfianza.vercel.app/`

Esto es importante porque el frontend usa endpoints relativos `/api/...` y el backend de producción está en el mismo dominio. Al abrir ese dominio dentro del WebView, rutas como `/api/bcv/all`, `/api/avatar/upload`, `/api/users`, `/api/payments`, etc. se resuelven automáticamente contra Vercel sin modificar cada módulo del POS.

### Funcionamiento

- Con Internet: utiliza la versión real de producción en Vercel y sus APIs.
- Sin conexión durante el arranque: intenta cargar una copia local incluida dentro del APK.
- Firebase sigue funcionando mediante HTTPS cuando hay conexión.
- Se mantiene almacenamiento DOM/local del WebView.
- El botón Atrás de Android conserva la navegación de la aplicación.
- El APK no necesita Node.js ni `server.js` instalado en el teléfono.

### Compilar APK

Abrir `android/` con Android Studio y ejecutar:

**Build → Build APK(s)**

APK debug:

`android/app/build/outputs/apk/debug/app-debug.apk`

Para distribución final se debe generar una variante release firmada.
