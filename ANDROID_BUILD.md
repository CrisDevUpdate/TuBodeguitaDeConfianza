# Versión 1.3 — Android conectada a Vercel

La aplicación Android utiliza como origen principal de producción:

`https://tubodeguitadeconfianza.vercel.app/`

La decisión evita el problema de las rutas relativas `/api/...`: el WebView carga el mismo dominio donde vive el frontend y donde Vercel expone el backend. Por tanto, las llamadas relativas del código existente conservan su comportamiento.

## Características

- Aplicación Android basada en el código existente.
- Vercel como origen principal.
- Firebase/Firestore mediante HTTPS.
- APIs `/api/*` de producción accesibles desde Android.
- Almacenamiento DOM/local del WebView.
- Fallback a `android/app/src/main/assets/www/` si falla la carga inicial de Internet.
- Permiso `INTERNET`.
- Navegación Atrás de Android.

## Compilación

Abrir `android/` con Android Studio y usar **Build → Build APK(s)**.

El proyecto requiere Android SDK y las dependencias Gradle correspondientes.
