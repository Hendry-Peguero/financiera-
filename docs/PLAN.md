# Plan · Fiscalización de combustible y aceites (EGEHID)

Derivado de las interfaces en `diseno/diseno.pen` (Desktop, Tablet H, Tablet V, Móvil).

## 1. Decisiones

| Tema | Decisión |
|---|---|
| Base de datos | SQL Server en **hidro-75**, BD `Fiscalizacion` (esquemas `fis` y `bit`). Se desarrolla también contra hidro-75. |
| API | .NET 10, arquitectura Onion, EF Core 10 (ORM), Serilog. |
| Autenticación | SSO con **Auth0** por **correo** (no usuario de dominio). La API valida JWT de Auth0; el usuario se identifica por su correo verificado. |
| Front | React 19 + TypeScript + Vite, `@auth0/auth0-react`, React Router, TanStack Query. |
| Sin conexión | Borradores, fotos y eventos de bitácora en IndexedDB (Dexie). Cola de sincronización hacia la API cuando hay red; **nada se da por enviado ni se borra sin confirmación del servidor** (ver `docs/APP-MOVIL.md`). |
| App móvil | **APK Android con Capacitor 8** que se **actualiza sola** desde la API (paquete web verificado con SHA-256, rollback automático). Plan y operación en `docs/APP-MOVIL.md`. |
| Pruebas | xUnit (dominio y aplicación), Vitest + Testing Library (front), Playwright (E2E). |
| Bitácora | Exclusiva para el dueño del sistema: registra cada petición a la API, cada cambio de datos y **cada clic / navegación** del front. |

## 2. Estructura del repositorio

```
api/
  src/Fiscalizacion.Domain          entidades, enums, reglas (sin dependencias)
  src/Fiscalizacion.Application     casos de uso, DTOs, interfaces (repos, reloj, usuario actual)
  src/Fiscalizacion.Infrastructure  EF Core (DbContext, configuraciones, migraciones), almacenamiento de fotos, PDF
  src/Fiscalizacion.Api             controladores, auth Auth0, middleware de bitácora, Swagger
  tests/Fiscalizacion.Domain.Tests
  tests/Fiscalizacion.Application.Tests
web/                                React + Vite; tests con Vitest; e2e/ con Playwright
db/                                 script SQL idempotente para HIDRO75 (generado desde migraciones)
docs/                               este plan
```

Regla Onion: Domain ← Application ← Infrastructure / Api. Domain no conoce EF ni ASP.NET; Application solo usa las abstracciones de EF Core (`IAppDbContext`, sin SQL Server) para las consultas; Infrastructure implementa el DbContext.

## 3. Modelo de datos (SQL Server)

### Catálogos
- **Usuario**: Id, Auth0Sub (único), Correo (único), NombreCompleto, Cargo, Rol (`Administrador`, `Auditor`, `Firmante`), FirmaPredeterminada (varbinary PNG), Activo, CreadoEn, UltimoAcceso.
- **Locacion**: Id, Nombre (“C.H. Jigüey”), Provincia (“Ocoa”), Activa.
- **Suplidor**: Id, Nombre (“Sunix Petroleum, S.R.L.”), Rnc, Activo.
- **Producto**: Id, Nombre (“Gasoil óptimo”), Unidad (`gal`).
- **ControlPregunta**: Numero (1–12), Texto, ObservacionObligatoriaSiSi (6, 11, 12 = true), TipoObservacion (`Texto` | `Fecha` — la 10 es fecha de calibración), Activa.

### Fiscalización
- **Fiscalizacion**: Id (Guid, generado en la tablet), Numero (`A3F9-21C0`, único), PlantillaVersionId, AutorId, Estado (`Borrador`, `Finalizado`, `Modificado`, `EdicionPendiente`), VersionActual, EnPapelera / EliminadoEn / EliminadoPorId, CreadoEn, ActualizadoEn, RowVersion (concurrencia).
  - *Visita*: Fecha, HoraSalida, InicioProceso, LocacionId (destino), HoraLlegada, FinProceso.
  - *Datos del suplidor*: FichaCamion, Chofer, Placa, Conduce, SuplidorId (empresa), TotalEntregarGal.
  - *Datos de la empresa*: FichaCamion2, Chofer2, Responsable, TotalRecibirGal.
  - *Mediciones*: ProductoId, GalonesProveedor, GalonesEgehid, PrecioGalon (decimal 18,4, nullable).
  - *Vara*: VaraInicialMedida, VaraInicialGalones, VaraFinalMedida, VaraFinalGalones.
  - ObservacionesGenerales.
  - Calculados (no se guardan, se exponen): Diferencia = EGEHID − proveedor, Diferencia %, importes.
- **LecturaEquipo**: FiscalizacionId, Equipo (`MedidorDigital`, `Dispensador`, `Electrobomba`), Inicial, Final (nullable).
- **RespuestaControl**: FiscalizacionId, PreguntaNumero, Respuesta (bit null), Observacion.
  - Regla: si la pregunta es 6, 11 o 12 y Respuesta = Sí → Observacion obligatoria para finalizar.
- **Foto**: Id, FiscalizacionId, Orden, Descripcion, RutaArchivo, Sha256, TamanoBytes, TomadaEn. Máx. 20 por registro.
- **Firma**: FiscalizacionId, Rol (`AuditorActuante1`, `AuditorActuante2`, `EncargadoRecibir`, `SupervisorCombustibles`, `RepresentanteProveedor`, `AuditorCierre1`, `AuditorCierre2`, `AuditorUai`), NombreFirmante, Cedula, UsuarioId (null si firmó “aquí” sin usuario), Modo (`Predeterminada`, `EnSuEquipo`, `EnEstaTablet`), Imagen (PNG), Sha256, FirmadoEn.
- **SolicitudFirma**: Id, FiscalizacionId, Rol, UsuarioDestinoId, SolicitadaPorId, Estado (`Pendiente`, `Firmada`, `Rechazada`, `Expirada`), Comentario, CreadaEn, ExpiraEn (+7 días).
- **FiscalizacionVersion**: FiscalizacionId, Version, SnapshotJson, PdfRuta, Resumen, CreadoPorId, CreadoEn.
- **CambioCampo**: VersionId, Campo, ValorAnterior, ValorNuevo.

### Plantillas (fase 3)
- **Plantilla**: Id, Nombre, Tipo (`Oficial`, `Personalizada`), Estado (`Activa`, `Borrador`, `Desactivada`), CodigoDocumento, VersionDocumento, FechaElaboracion, FechaAprobacion (encabezado impreso).
- **PlantillaVersion**: PlantillaId, Version, PdfBase, Publicada, PublicadaEn.
- **PlantillaCampo**: PlantillaVersionId, Identificador, Etiqueta, Tipo (`Texto`, `Numero`, `Fecha`, `Casilla`, `Firma`, `Formula`), Formula, Pagina, X, Y, Ancho, Alto, Obligatorio, EnEstadisticas, ImprimirPdf.

### Bitácora (solo dueño)
- **BitacoraApi**: Id, Momento, UsuarioId, Correo, Metodo, Ruta, Query, StatusCode, DuracionMs, Ip, UserAgent, CorrelationId.
- **BitacoraCambio**: Id, Momento, UsuarioId, Entidad, EntidadId, Accion (`Crear`, `Modificar`, `Eliminar`), ValoresAnteriores (JSON), ValoresNuevos (JSON), CorrelationId. Se llena automáticamente con un interceptor de EF Core.
- **BitacoraUi**: Id, Momento (cliente), RecibidoEn, UsuarioId, SesionId, Tipo (`click`, `navegacion`, `envio`, `error`, `online`, `offline`), Ruta, Elemento (texto / `data-track` / selector), Detalle (JSON), Dispositivo.
- **Serilog**: además, logs técnicos a archivo diario y a la tabla `LogTecnico`.

Acceso: política `BitacoraOwner` = el correo está en `Bitacora:Propietarios` (appsettings). Nadie más, ni siquiera los administradores, ve `/bitacora` ni `GET /api/bitacora/*`.

## 4. API (REST, `/api`)

| Recurso | Endpoints |
|---|---|
| Sesión | `GET /me` (crea el usuario al primer ingreso por correo), `PUT /me/perfil`, `PUT /me/firma` |
| Usuarios (Administrador) | `GET /admin/usuarios?texto&rol&estado&pagina`, `POST /admin/usuarios` (registro anticipado por correo + rol), `PUT /admin/usuarios/{id}/rol`, `POST /admin/usuarios/{id}/activar` · `/desactivar`. El administrador no se desactiva ni se quita el rol; siempre queda al menos un administrador activo; un usuario desactivado recibe 403 en toda la API. |
| Catálogos | `GET /catalogos` (locaciones, suplidores, productos, preguntas de control) |
| Fiscalizaciones | `GET /fiscalizaciones?estado&desde&hasta&locacionId&suplidorId&autorId&texto&pagina`, `GET /fiscalizaciones/{id}`, `PUT /fiscalizaciones/{id}` (crear o actualizar borrador, idempotente por Id de la tablet, control con RowVersion), `POST /{id}/finalizar`, `POST /{id}/corregir`, `DELETE /{id}` (a papelera), `POST /{id}/restaurar` |
| Fotos | `POST /fiscalizaciones/{id}/fotos`, `GET .../fotos/{fotoId}`, `DELETE .../fotos/{fotoId}` |
| Firmas | `PUT /fiscalizaciones/{id}/firmas/{rol}`, `POST /{id}/solicitudes-firma`, `GET /{id}/solicitudes-firma`, `GET /solicitudes-firma/mias`, `POST /solicitudes-firma/{id}/firmar`, `POST /solicitudes-firma/{id}/rechazar` |
| Versiones | `GET /fiscalizaciones/{id}/versiones`, `GET .../versiones/{v}` (solo administrador) |
| Inicio / estadísticas | `GET /inicio/resumen`, `GET /estadisticas?desde&hasta&locacionId&agrupar=dia|semana|mes`, `GET /avisos` |
| Bitácora | `POST /bitacora/ui` (lote de eventos del front, cualquier usuario autenticado), `GET /bitacora/ui`, `GET /bitacora/api`, `GET /bitacora/cambios` (solo dueño) |

Reglas para finalizar: visita completa (incluye fin del proceso), 12 controles respondidos, observación en 6/11/12 si Sí, firmas de participantes y auditores de cierre. Al finalizar → versión 1 y PDF. Corregir un finalizado → nueva versión con `CambioCampo` y estado `Modificado`.

Avisos (orientativos): diferencia > 1 %, proveedor en 0 con EGEHID > 0, entrega > 150 % de la mediana de las últimas 5 de la misma locación.

## 5. Front (React)

Pantallas: Inicio, Nueva fiscalización / Formulario (7 secciones: Visita, Suplidor y empresa, Mediciones, Controles, Fotografías, Firmas, Revisar), Historial, Detalle y versiones, Estadísticas, Papelera, **Usuarios** (Administrador; no está en el diseño, sigue el estilo del Historial), Mi cuenta, Firma solicitada, **Bitácora** (solo dueño).

- Login: botón “Entrar con mi correo” → Auth0 Universal Login (correo + contraseña o código por correo). Sin usuario de dominio.
- Autoguardado en IndexedDB cada cambio; sincroniza con `PUT /fiscalizaciones/{id}` al haber red.
- Rastreo: un listener global de `click` en captura + cambio de ruta → cola en IndexedDB → `POST /bitacora/ui` por lotes (cada 10 s o 50 eventos, y al volver la red). Los campos de contraseña nunca se registran.
- Diseño responsivo según las vistas Desktop / Tablet H / Tablet V / Móvil.

## 6. Pruebas

- **xUnit**: reglas de dominio (diferencias, validación de finalización, observación obligatoria 6/11/12, reglas de usuarios), casos de uso con repos en memoria, autorización de la gestión de usuarios y 403 del usuario desactivado.
- **Vitest**: cálculos, validaciones, cola offline, rastreador de clics, componentes clave.
- **Playwright**: login simulado (modo `VITE_AUTH_MODE=dev`), crear fiscalización, marcar Sí en el ítem 6 sin observación → no permite finalizar, bitácora visible solo para el dueño, gestión de usuarios (registrar, cambiar rol, desactivar; un auditor no la ve; un desactivado ve el aviso).

## 7. Configuración de Auth0 (lo que falta de tu lado)

1. Crear Application tipo **Single Page Application** → `Domain` y `Client ID` en `web/.env`.
2. Crear API con identificador `https://fiscalizacion.egehid.gob.do/api` → `Auth0:Audience` en la API.
3. Conexión **Username-Password** o **Passwordless (email)**; desactivar conexiones de dominio / enterprise.
4. Action post-login que agregue `email` al access token (claim `https://fiscalizacion/email`).
5. Callback / logout / web origins: `http://localhost:5173` y la URL de producción.

## 8. Fases

1. **Base** (esta entrega): BD + migraciones + script HIDRO75, API Onion con Auth0, fiscalizaciones, controles, firmas, fotos, bitácora completa; front con login, inicio, formulario, historial, bitácora, offline; pruebas.
2. **Cierre**: PDF oficial (QuestPDF — revisar licencia para EGEHID), versiones y cambios por campo en UI, estadísticas con gráficos, exportar Excel.
3. **Plantillas**: importar PDF y editor de campos.

## 9. Pendientes / riesgos

- HIDRO75 no es accesible desde esta máquina: se entrega `db/Fiscalizacion_HIDRO75.sql` para que el DBA lo ejecute.
- La pantalla de Login del diseño habla de “cuenta local en esta tablet”; con Auth0 cambia a “Entrar con mi correo”. Hay que ajustar el diseño.
- Primer acceso sin conexión: Auth0 necesita red para iniciar sesión; después la sesión se mantiene con refresh tokens.
