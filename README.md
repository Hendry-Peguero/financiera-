# Fiscalización de combustible y aceites · EGEHID

Aplicación para registrar fiscalizaciones en campo (tablet, teléfono y escritorio). Funciona sin conexión y solo da
un formulario por enviado cuando el servidor confirma que lo guardó.

| Carpeta | Contenido |
|---|---|
| `api/` | API .NET 10 (Onion, EF Core 10, SQL Server). Detalle en [api/README.md](api/README.md). |
| `web/` | Front React + Vite (web/PWA) y app Android con Capacitor (`web/android`). Detalle en [web/README.md](web/README.md). |
| `db/` | Scripts SQL: crear la base y esquema idempotente. |
| `docs/` | Plan, contrato de la API, app móvil ([docs/APP-MOVIL.md](docs/APP-MOVIL.md)). |
| `diseno/` | Diseño (`diseno.pen`, respaldos) y el PDF del formulario oficial en papel. |
| `apk/` | APK de prueba ya compilados. |
| `tablet.ps1` | Levanta API + front en la red local para probar desde el navegador de una tablet. |

---

## 1. Requisitos

| Herramienta | Versión | Para |
|---|---|---|
| .NET SDK | 10 | API |
| Node.js | 22 o superior (probado con 25) | front |
| SQL Server | Express o superior | base de datos (autenticación de Windows) |
| JDK 21 + Android SDK 36 | solo para compilar el APK | app Android |

Herramientas de .NET del proyecto (`dotnet ef`):

```powershell
cd api
dotnet tool restore
```

## 2. Base de datos

Hay dos opciones. La API elige la base según el **perfil de arranque** (`api/src/Fiscalizacion.Api/Properties/launchSettings.json`).

**A) Servidor de EGEHID (hidro-75)** — perfil `http`. Solo dentro de la red de EGEHID. La base `Fiscalizacion` ya existe;
si hay que crearla desde cero:

```powershell
sqlcmd -S hidro-75 -E -C -i db\00_crear_bd.sql
sqlcmd -S hidro-75 -E -C -I -d Fiscalizacion -i db\Fiscalizacion_HIDRO75.sql
```

**B) Base local provisional** (fuera de la red) — perfiles `http-provisional` y `red-provisional`, contra
`.\SQLEXPRESS`, base `Fiscalizacion_Provisional`:

```powershell
sqlcmd -S .\SQLEXPRESS -E -C -Q "CREATE DATABASE [Fiscalizacion_Provisional]"
sqlcmd -S .\SQLEXPRESS -E -C -I -d Fiscalizacion_Provisional -i db\Fiscalizacion_HIDRO75.sql
```

Con un login SQL en vez de Windows, la cadena va en *user-secrets* (nunca en los archivos), ver [api/README.md](api/README.md).

## 3. Levantar la API

```powershell
cd api
dotnet run --project src/Fiscalizacion.Api --launch-profile http              # hidro-75, http://localhost:5080
dotnet run --project src/Fiscalizacion.Api --launch-profile http-provisional  # base local, http://localhost:5080
dotnet run --project src/Fiscalizacion.Api --launch-profile red-provisional   # base local, abierta a la red (APK)
```

Comprobar: `http://localhost:5080/api/salud` debe responder `"servicio":"fiscalizacion-egehid"`.

En desarrollo la API está en modo **Dev**: no hay Auth0; se entra con un correo (encabezado `X-Dev-User`).
El **primer usuario** que entra queda como Administrador; los siguientes, Auditor.

## 4. Levantar el front (navegador)

```powershell
cd web
npm install
npm run dev        # http://localhost:5173 — pide un correo para entrar
```

La API debe estar corriendo en `http://localhost:5080`.

### Probar desde el navegador de una tablet (misma Wi-Fi)

```powershell
.\tablet.ps1       # desde la raíz: abre una ventana con la API y otra con el front en https://<IP>:5173
```

Una sola vez, como administrador: abrir el puerto 5173 en el firewall (el script muestra el comando).

## 5. App Android (APK)

Guía completa en [docs/APP-MOVIL.md](docs/APP-MOVIL.md). Resumen para **probar**:

1. Firewall (una vez, como administrador):
   ```powershell
   New-NetFirewallRule -DisplayName 'Fiscalizacion API 5080' -Direction Inbound -Protocol TCP -LocalPort 5080 -Action Allow -Profile Any
   ```
2. API abierta a la red: perfil `red-provisional` (paso 3).
3. Instalar `apk/fiscalizacion-<versión>-prueba.apk` en la tablet/teléfono (permitir «orígenes desconocidos»).
4. En el inicio de sesión: **«Servidor de la API»** = IP de la PC (`ipconfig` → IPv4) → **Probar** → entrar con un correo.

**Compilar el APK** (requiere JDK 21 y Android SDK; el script los busca en `E:\Herramientas`, ajustar las rutas si están en otro lugar):

```powershell
cd web
.\scripts\compilar-apk.ps1        # → apk\fiscalizacion-<versión>-prueba.apk
```

**Actualizar las apps instaladas sin reinstalar** (solo cambios del front):

```powershell
cd web
# 1) subir "version" en package.json (p. ej. 0.1.5 → 0.1.6)
.\scripts\publicar-actualizacion.ps1 -Notas "Qué cambió"
```

La app la descarga al abrirse y la aplica al cerrarla o salir de ella. Reinstalar el APK solo hace falta si cambia
código nativo (plugins).

## 6. Pruebas

```powershell
cd api;  dotnet test
cd web;  npm test                 # unitarias (Vitest)
cd web;  npm run test:e2e         # E2E (Playwright; antes: npx playwright install chromium)
cd web;  npm run test:visual      # comparación con el diseño
```

## 7. Usuarios de prueba (modo Dev)

| Correo | Rol |
|---|---|
| `hpeguerovaldez@gmail.com` | Administrador (y dueño de la bitácora) |
| `auditor.prueba@egehid.gob.do` | Auditor |

## 8. Lo que NO está en el repositorio

- `node_modules/`, `bin/`, `obj/`, `dist/`: se regeneran con `npm install` / `dotnet build`.
- `api/src/Fiscalizacion.Api/App_Data/`: fotos, PDF y paquetes de actualización generados al usar la app.
- Contraseñas, cadenas con contraseña, `.env` / `.env.local` y llaves de firma del APK (`*.jks`, `keystore.properties`).

## 9. Pendiente para producción

Auth0 (tenant y app nativa), API publicada en HTTPS, firma del APK de producción. Ver [docs/APP-MOVIL.md](docs/APP-MOVIL.md) §6.
