# App móvil (Android) · plan y operación

Fecha: 27/10/2026. Objetivo: una **app Android (APK)** para tablets y teléfonos que **se actualiza sola** y que
**nunca pierde un formulario**: sin red queda guardado en el equipo y solo se da por enviado cuando el servidor
confirma que lo guardó.

## 1. Decisiones

| Tema | Decisión |
|---|---|
| Empaquetado | **Capacitor 8.5** (MIT) envuelve la misma app web (React + Vite) en un APK. Un solo código para web, tablet y teléfono. |
| Actualización | **@capgo/capacitor-updater 8.54** (MPL-2.0, sin modificar) en **modo manual y autoalojado**: la app pregunta a NUESTRA API (`GET /api/app/version`), descarga el paquete web, verifica su SHA-256 y lo aplica la próxima vez que la app se cierre o pase a segundo plano. Sin servicios externos: `statsUrl`, `updateUrl` y `channelUrl` vacíos. |
| Reinstalar el APK | Solo si cambia código **nativo** (plugins nuevos). El APK tiene `versionCode` = «versión nativa»; cada publicación indica `nativaMinima` y la app avisa si hay que reinstalar. |
| Rollback | Si una versión nueva no confirma que arrancó (`notifyAppReady`) en 10 s, el plugin vuelve sola a la anterior. |
| Datos sin red | IndexedDB (Dexie) en el equipo; cola de envío; nada se borra sin confirmación del servidor; copia local 30 días después de confirmada. |
| Herramientas | JDK 21 + Android SDK 36 + Gradle en `E:\Herramientas` (C: tiene poco espacio). |
| iOS | Fuera de alcance (exigiría una Mac). La web/PWA sigue disponible. |

## 2. Envío confirmado (que nada se pierda)

Problema: «falsa alarma de Wi-Fi» — el equipo dice que hay red (portal de hotel/Fortinet, Wi-Fi sin internet,
proxy) y una app ingenua manda los datos, los borra y nunca llegaron.

Reglas (implementadas en `web/src/offline/colaSync.ts` y `confirmacion.ts`, probadas en `colaSync.test.ts` y
`confirmacion.test.ts`):

1. **Todo se guarda primero en el equipo** (cada cambio) y se encola. La cola se procesa al guardar, al volver la
   red y cada 30 s.
2. **Antes de enviar**, `GET /api/salud` debe responder la marca `servicio: "fiscalizacion-egehid"` en ≤ 6 s. Un
   portal de Wi-Fi o un proxy no la tienen → no se envía nada.
3. **Registro (PUT)**: la respuesta debe ser *este* registro (mismo `id`, con número y estado) y traer guardado lo
   que se mandó, **campo por campo** (con las mismas normalizaciones de la API: espacios, horas, 2 decimales). Si no
   coincide, queda pendiente y se avisa. Una respuesta HTML / JSON ajeno / de otro registro detiene la cola.
4. **Fotos**: se envían con el `id` generado en el equipo y su **SHA-256**. El servidor no duplica un reintento
   (mismo id → devuelve la guardada) y **rechaza una foto incompleta** (huella distinta). La respuesta debe traer el
   mismo id y la misma huella.
5. **Finalizar funciona sin red**: queda «en espera» en el equipo. Se envía cuando el registro y todas sus fotos
   están confirmados; después la app **vuelve a leer el registro** del servidor y debe estar finalizado. Repetir
   finalizar (respuesta perdida) devuelve el registro ya finalizado, sin otra versión.
6. Si el servidor **rechaza** finalizar (400/409: falta una firma, etc.) el registro vuelve a borrador con el motivo.
7. **Nada se borra del equipo sin confirmación.** Un registro finalizado y confirmado se conserva **30 días** y luego
   se limpia solo (`purgarConfirmados`).

## 3. Actualizaciones de la app

- La app (solo dentro del APK) llama `notifyAppReady()` al arrancar y revisa `GET /api/app/version` al abrir, al
  volver a primer plano y cada 30 min (`web/src/app/actualizaciones.ts`).
- Si hay una versión mayor que la suya (`web/package.json` → `config.version`): descarga
  `GET /api/app/paquetes/{archivo}` con su `sha256`, la marca como siguiente (`next`) y muestra «Versión X
  descargada: se aplicará al cerrar o salir de la app». Lo escrito ya está guardado, así que aplicar no pierde datos.
- Si `nativaMinima` > `versionCode` del APK: aviso «hay que instalar de nuevo la app (APK)».

### Publicar una actualización
```powershell
cd E:\Fiscalizacion\web
# 1) subir "version" en package.json (0.1.0 → 0.1.1)
# 2) publicar (por defecto en la carpeta App:Ruta de la API local)
.\scripts\publicar-actualizacion.ps1 -Notas "Bitácora con nueva interfaz"
# en producción: -Destino "\\servidor\...\App_Data\app" -Modo produccion-apk
```
Deja `<versión>.zip` y `version.json` (versión, archivo, sha256, notas, publicadaEn, nativaMinima) en `App:Ruta`.

## 4. Compilar el APK

```powershell
cd E:\Fiscalizacion\web
.\scripts\compilar-apk.ps1               # PRUEBA → E:\Fiscalizacion\apk\fiscalizacion-<versión>-prueba.apk
.\scripts\compilar-apk.ps1 -Produccion   # PRODUCCIÓN (requiere firma y .env.produccion-apk)
```

**APK de prueba** (`.env.apk`): modo de sesión Dev (correo, sin Auth0), API por `http://`, y en el inicio de sesión
un campo **«Servidor de la API (prueba)»** con «Probar» (la IP de la PC cambia de red en red). La app usa el esquema
`http://localhost` dentro del APK (cuenta como contexto seguro para el cifrado) y permite tráfico sin cifrar.

**Producción** (`CAP_PRODUCCION=1`): esquema `https`, solo HTTPS (`httpsOnly`), API publicada con certificado
válido, Auth0 configurado para app nativa (pendiente: callback con esquema propio `gob.egehid.fiscalizacion://`).

### Firma del APK (producción)
Crear una vez la llave y **guardarla fuera del repositorio** (sin ella no se puede publicar otro APK que actualice al
instalado):
```powershell
& "E:\Herramientas\jdk\<jdk-21…>\bin\keytool.exe" -genkeypair -v -keystore E:\Seguro\fiscalizacion.jks -alias fiscalizacion -keyalg RSA -keysize 4096 -validity 10000
```
y `web/android/keystore.properties` (no se versiona) con `storeFile`, `storePassword`, `keyAlias`, `keyPassword`;
`android/app/build.gradle` debe leerlo en `signingConfigs.release` (pendiente de configurar al crear la llave).

## 5. Probar en una tablet (red local)

1. Firewall (una vez, como administrador): `New-NetFirewallRule -DisplayName 'Fiscalizacion API 5080' -Direction Inbound -Protocol TCP -LocalPort 5080 -Action Allow -Profile Any`
2. API escuchando en la red: `dotnet run --project src/Fiscalizacion.Api --launch-profile red-provisional`
   (perfil con `http://0.0.0.0:5080` y CORS para `http://localhost` / `https://localhost` del APK).
3. Instalar `E:\Fiscalizacion\apk\fiscalizacion-…-prueba.apk` en la tablet (copiarlo y abrirlo; permitir
   «instalar apps de origen desconocido»).
4. En el inicio de sesión: «Servidor de la API» = IP de la PC (p. ej. `172.22.20.120`) → Probar → entrar con un correo.
5. Prueba de envío seguro: activar modo avión, llenar y finalizar (queda «En espera de conexión»), cerrar la app,
   volver a abrirla, quitar modo avión → se envía y confirma solo.
6. Prueba de actualización: subir `version`, `publicar-actualizacion.ps1`, abrir la app → aviso «Versión … descargada»
   → salir y volver a entrar → versión nueva.

## 6. Pendientes

- Firma de producción y `signingConfigs.release`.
- Auth0 nativo (cuando exista el tenant) y API publicada en HTTPS.
- Ícono y pantalla de inicio con la marca EGEHID (hoy: los de Capacitor).
- Distribución inicial del APK (MDM de Tecnología o instalación manual).
