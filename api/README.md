# API · Fiscalización (EGEHID)

.NET 10, arquitectura Onion, EF Core 10 sobre SQL Server (**hidro-75**, base `Fiscalizacion`).

```
src/Fiscalizacion.Domain          entidades, enums y reglas (cálculos, pendientes, 6/11/12, avisos)
src/Fiscalizacion.Application     casos de uso y DTOs (contrato en docs/API-CONTRATO.md)
src/Fiscalizacion.Infrastructure  DbContext, configuraciones, migraciones, interceptor de bitácora, fotos en disco
src/Fiscalizacion.Api             controladores, Auth0/Dev, bitácora de peticiones, Serilog
tests/                            xUnit: dominio y aplicación (EF InMemory)
```

## Ejecutar

```bash
dotnet run --project src/Fiscalizacion.Api --launch-profile http   # http://localhost:5080
dotnet test
```

`appsettings.Development.json` conecta a hidro-75 con autenticación de Windows y activa el modo Dev:
cualquier petición con `X-Dev-User: correo@dominio` queda autenticada (solo en Development).

### Base provisional (PROVISIONAL, fuera de la red de hidro-75)
Mientras hidro-75 no es accesible se trabaja contra `.\SQLEXPRESS`, base `Fiscalizacion_Provisional` (misma migración `Inicial`):

```bash
dotnet run --project src/Fiscalizacion.Api --launch-profile http-provisional
```

El perfil solo sobrescribe la cadena y las rutas de fotos y PDF (`App_Data/provisional/`) con variables de entorno; `appsettings.Development.json` sigue apuntando a hidro-75.
Para volver, usar el perfil `http`. Los datos de la base provisional **no se migran** a hidro-75; al terminar se borra con
`sqlcmd -S .\SQLEXPRESS -E -C -Q "DROP DATABASE [Fiscalizacion_Provisional]"` y se elimina el perfil `http-provisional`.
Si se agrega una migración mientras tanto, aplicarla en las dos bases.

### Cadena con `userapp1`
No se guardan contraseñas en los archivos. Para usar el login SQL:

```bash
dotnet user-secrets --project src/Fiscalizacion.Api set "ConnectionStrings:Fiscalizacion" "Server=hidro-75;Database=Fiscalizacion;User Id=userapp1;Password=...;TrustServerCertificate=true;MultipleActiveResultSets=true"
```

En producción, la variable de entorno `ConnectionStrings__Fiscalizacion`. `userapp1` tiene `db_datareader` y `db_datawriter` en la base.

## Base de datos

- `db/00_crear_bd.sql`: crea la base y da acceso a `userapp1`.
- `db/Fiscalizacion_HIDRO75.sql`: script idempotente (tablas, índices, catálogos, 12 preguntas). Ejecutar con `sqlcmd -I` (QUOTED_IDENTIFIER activo).
- Nueva migración: `dotnet ef migrations add <Nombre> -p src/Fiscalizacion.Infrastructure -s src/Fiscalizacion.Infrastructure -o Persistencia/Migraciones` y regenerar el script con `dotnet ef migrations script --idempotent ... -o ../db/Fiscalizacion_HIDRO75.sql`. `dotnet ef` usa la variable `FISCALIZACION_DB` como cadena.

## Auth0 (SSO por correo, sin usuario de dominio)

1. Application **Single Page Application** → Domain y Client ID para `web/.env`.
2. API con identificador `https://fiscalizacion.egehid.gob.do/api` → `Auth0:Audience`; `Auth0:Domain` = tenant.
3. Conexión Username-Password o Passwordless (email). Sin conexiones enterprise/AD.
4. Action post-login que agregue el correo al access token:
   ```js
   exports.onExecutePostLogin = async (event, api) => {
     api.accessToken.setCustomClaim('https://fiscalizacion/email', event.user.email);
   };
   ```
5. En producción, `Auth:Mode` = `Auth0`.

El primer usuario que entra queda como **Administrador**; los siguientes, **Auditor**. Después, el administrador gestiona
roles y acceso en `/api/admin/usuarios` (pantalla «Usuarios»): puede registrar un correo por adelantado con su rol, y
un usuario desactivado recibe 403 en toda la API.

## Bitácora (solo propietario)

- `bit.BitacoraApi`: cada petición (método, ruta, estado, duración, IP, usuario). Se escribe en segundo plano.
- `bit.BitacoraCambio`: cada alta/cambio/baja con valores antes y después (interceptor de EF; imágenes solo por tamaño).
- `bit.BitacoraUi`: clics, navegación, errores y conexión enviados por el front.
- `bit.LogTecnico`: advertencias y errores de Serilog; además `logs/api-*.log`.

Acceso: `Bitacora:Propietarios` en `appsettings.json`.
