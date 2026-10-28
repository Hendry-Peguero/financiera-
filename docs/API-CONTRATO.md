# Contrato de la API (JSON, camelCase)

Base: `/api`. Auth: `Authorization: Bearer <access_token Auth0>`.
En desarrollo (`Auth:Mode=Dev` en la API / `VITE_AUTH_MODE=dev` en el front) se acepta el encabezado `X-Dev-User: correo@dominio` en lugar del token.
Fechas `yyyy-MM-dd`, horas `HH:mm` (24 h), momentos ISO 8601 UTC. Decimales como número JSON.
Errores: `ProblemDetails` (RFC 7807); validación → 400 con `errors: { campo: [mensajes] }`; concurrencia → 409.

## Enums (strings)
- `Rol`: `Administrador` | `Auditor` | `Firmante`
- `EstadoFiscalizacion`: `Borrador` | `Finalizado` | `Modificado` | `EdicionPendiente`
- `Equipo`: `MedidorDigital` | `Dispensador` | `Electrobomba`
- `RolFirma`: `AuditorActuante1` | `AuditorActuante2` | `EncargadoRecibir` | `SupervisorCombustibles` | `RepresentanteProveedor` | `AuditorCierre1` | `AuditorCierre2` | `AuditorUai`
- `ModoFirma`: `Predeterminada` | `EnSuEquipo` | `EnEstaTablet`
- `EstadoSolicitud`: `Pendiente` | `Firmada` | `Rechazada` | `Expirada`
- `TipoEventoUi`: `click` | `navegacion` | `envio` | `error` | `online` | `offline`

## GET /me → UsuarioDto
```json
{ "id": "guid", "correo": "maria.rosario@hidroelectrica.gov.do", "nombreCompleto": "María Rosario Peña",
  "cargo": "Auditora de campo", "rol": "Administrador", "tieneFirma": true, "esPropietarioBitacora": true,
  "perfilCompleto": true }
```
`PUT /me/perfil` `{ nombreCompleto, cargo }` → UsuarioDto · `PUT /me/firma` `{ imagenBase64 }` (PNG) → 204 · `GET /me/firma` → `{ imagenBase64 }`

## GET /catalogos
```json
{ "locaciones": [{ "id": 1, "nombre": "C.H. Jigüey", "provincia": "Ocoa" }],
  "suplidores": [{ "id": 1, "nombre": "Sunix Petroleum, S.R.L." }],
  "productos": [{ "id": 1, "nombre": "Gasoil óptimo", "unidad": "gal" }],
  "preguntasControl": [{ "numero": 6, "texto": "¿Se evidenció presencia de agua en los tanques?",
                         "observacionObligatoriaSiSi": true, "tipoObservacion": "Texto" }] }
```

## FiscalizacionDto (GET /fiscalizaciones/{id}; cuerpo de PUT sin los campos marcados *solo lectura*)
```json
{
  "id": "guid (lo genera el cliente)",
  "numero": "A3F9-21C0",                       // solo lectura
  "estado": "Borrador",                        // solo lectura
  "versionActual": 0,                          // solo lectura
  "rowVersion": "base64 | null",               // obligatorio en PUT si existe (409 si cambió)
  "autor": { "id": "guid", "nombreCompleto": "..." },   // solo lectura
  "creadoEn": "...", "actualizadoEn": "...",   // solo lectura
  "visita": { "fecha": "2026-10-20", "horaSalida": "07:15", "inicioProceso": "09:05",
              "locacionId": 1, "horaLlegada": "08:40", "finProceso": null },
  "suplidor": { "fichaCamion": "FT-221", "chofer": "Ramón Antonio Peña", "placa": "L-384920",
                "conduce": "CD-0048213", "nombre": "Sunix Petroleum, S.R.L.", "suplidorId": 1, "totalEntregarGal": 8000.00 },
  "empresa": { "fichaCamion1": "FT-118", "chofer1": "Pedro Almonte", "fichaCamion2": "FT-305", "chofer2": "José Luis Martínez",
               "responsable": "Ing. Carlos Méndez", "totalRecibirGal": 8000.00 },
  "mediciones": {
    "productoId": 1, "galonesProveedor": 4212.40, "galonesEgehid": 4200.00, "precioGalon": 248.6000,
    "lecturas": [{ "equipo": "MedidorDigital", "inicial": 128450.20, "final": 132650.20 }],
    "vara": { "inicialMedida": "34 ½ pulg", "inicialGalones": 1520.00, "finalMedida": "58 pulg", "finalGalones": 5720.00 }
  },
  "calculos": { "diferenciaGal": -12.40, "diferenciaPct": -0.29, "importeProveedor": 1047202.64,
                "importeEgehid": 1044120.00, "diferenciaImporte": -3082.64 },   // solo lectura
  "controles": [{ "numero": 6, "respuesta": true, "observacion": "Agua en el fondo del tanque 2" }],
  "observacionesGenerales": "...",
  "fotos": [{ "id": "guid", "orden": 1, "descripcion": "...", "tamanoBytes": 123 }],   // solo lectura
  "firmas": [{ "rol": "AuditorActuante1", "nombreFirmante": "Ana Lucía Pérez", "cedula": null,
               "modo": "Predeterminada", "firmadoEn": "...", "usuarioId": "guid|null" }],     // solo lectura
  "pendientes": { "visita": ["Falta la hora de fin del proceso."], "controles": [], "firmas": ["Falta Auditor de cierre 2"] }  // solo lectura
}
```
`PUT /fiscalizaciones/{id}` crea si no existe (idempotente) o actualiza un Borrador → FiscalizacionDto. 409 si no es Borrador o rowVersion distinto.
`POST /fiscalizaciones/{id}/finalizar` → FiscalizacionDto; 400 con `errors` si hay pendientes. **Repetible** (27/10/2026): si el registro ya está Finalizado o Modificado (la tablet reintenta porque no recibió la respuesta) devuelve el registro tal cual, 200, sin crear otra versión.
`POST /fiscalizaciones/{id}/corregir` cuerpo = PUT → crea nueva versión, estado `Modificado`.
`DELETE /fiscalizaciones/{id}` → papelera (204). `POST /fiscalizaciones/{id}/restaurar` (Administrador).

- `suplidor.nombre` (27/10/2026): la empresa suplidora es **texto libre**. Al guardar (PUT y corregir) la API la enlaza al catálogo por nombre (sin distinguir mayúsculas, acentos ni espacios) y llena `suplidorId`; si no existe, agrega el suplidor al catálogo. Sin `nombre` (clientes anteriores) toma el del catálogo por `suplidorId`. Se guarda como se escribió (columna `NombreSuplidor`, migración `NombreSuplidor`, que llena los registros anteriores). `empresa.responsable` también es texto libre.

## GET /fiscalizaciones → Pagina<FiscalizacionResumenDto>
Query: `estado, enPapelera(bool), desde, hasta, locacionId, suplidorId, autorId, texto, pagina(1), tamano(20)`
```json
{ "items": [{ "id": "guid", "numero": "A3F9-21C0", "fecha": "2026-10-20", "locacion": "C.H. Jigüey",
              "suplidor": "Sunix Petroleum", "autor": "María Rosario", "galonesProveedor": 4212.40,
              "galonesEgehid": 4200.00, "diferenciaGal": -12.40, "version": 1, "estado": "Finalizado" }],
  "total": 126, "pagina": 1, "tamano": 20,
  "conteos": { "todos": 126, "Borrador": 5, "Finalizado": 109, "Modificado": 9, "EdicionPendiente": 1, "papelera": 2 } }
```

## Fotos
`POST /fiscalizaciones/{id}/fotos` multipart (`archivo`, `descripcion`, `orden`, y desde 27/10/2026 opcionales `id` y `sha256`) → FotoDto `{ id, orden, descripcion, tamanoBytes, sha256 }` (máx 20; 400 si excede).
- `id` (Guid generado en la tablet): la foto se guarda con ese id. **Repetible**: si ya existe en este registro devuelve la guardada (200, sin duplicar); si pertenece a otro registro → 409.
- `sha256` (hex): huella del archivo; si la del archivo recibido no coincide → 400 «La foto llegó incompleta o dañada» y no se guarda.
- `sha256` en la respuesta y en `FiscalizacionDto.fotos[]`: huella del archivo guardado; la tablet solo marca la foto como subida si coinciden id y huella.
`GET /fiscalizaciones/{id}/fotos/{fotoId}` → imagen. `DELETE` → 204.

## Firmas
`PUT /fiscalizaciones/{id}/firmas/{rol}` `{ nombreFirmante, cedula, modo, imagenBase64 }` (si `modo=Predeterminada` sin imagen → usa la firma del usuario) → FiscalizacionDto.
`POST /fiscalizaciones/{id}/solicitudes-firma` `{ rol, usuarioDestinoId }` → SolicitudFirmaDto.
`GET /solicitudes-firma/mias` → SolicitudFirmaDto[] `{ id, fiscalizacionId, numero, rol, solicitadaPor, creadaEn, expiraEn, estado }`
`POST /solicitudes-firma/{id}/firmar` `{ usarPredeterminada, imagenBase64 }` · `POST /solicitudes-firma/{id}/rechazar` `{ comentario }`.
`GET /fiscalizaciones/{id}/solicitudes-firma` → SolicitudFirmaRegistroDto[] (todas las del registro, la más reciente primero). Mismo permiso que ver el registro (autor, administrador o firmante con solicitud en él; 403 / 404).
```json
[{ "id": "guid", "rol": "SupervisorCombustibles", "usuarioDestinoId": "guid", "firmante": "Pedro Almonte",
   "correoFirmante": "pedro.almonte@hidroelectrica.gov.do", "solicitadaPor": "María Rosario Peña",
   "estado": "Pendiente", "comentario": null, "creadaEn": "...", "expiraEn": "... (+7 días)", "firmadaEn": null }]
```
- `estado`: `Pendiente` | `Firmada` | `Rechazada` (`comentario` = motivo) | `Expirada` (venció a los 7 días o se reemplazó al volver a dar acceso al mismo rol). Una pendiente vencida se informa `Expirada` sin escribir en la base.
- `firmadaEn`: hora de la firma del rol hecha por el usuario destino (solo si `Firmada`). `firmante` = nombre del usuario (o su correo si no completó el perfil).
- «Reenviar» = un nuevo `POST /fiscalizaciones/{id}/solicitudes-firma` para el rol (la anterior queda `Expirada`). No hay cancelar solicitud (no está en el diseño).
- El front muestra «Acceso enviado» desde esta lista (la última por rol) y la guarda en la tablet; sin red muestra el último estado conocido con un aviso.
`GET /usuarios?texto=` → `[{ id, nombreCompleto, cargo, tieneFirma }]` (para elegir firmante; solo usuarios activos, máx. 20). La gestión de usuarios está en «Usuarios (Administración)».

## Versiones (Administrador)
`GET /fiscalizaciones/{id}/versiones` → `[{ version, creadoEn, creadoPor, resumen, vigente, cambios: [{ campo, valorAnterior, valorNuevo }] }]`

## PDF oficial
Generado por la API con PDFsharp 6.2.4 (MIT), fuente Inter incrustada (SIL OFL). **Desde 27/10/2026 es el formulario en papel de EGEHID** («Formulario Fiscalización Combustible y Aceites», A4, una página; PDF base en `api/src/Fiscalizacion.Application/Plantillas/Recursos/FormularioOficial.pdf`) con cada valor escrito en su celda según los campos de la plantilla oficial; después, 1 página A4 de anexo por cada 6 fotos. Bajo el formulario: `Fiscalización N.º {numero} · Rev. {version} · {producto}`, fecha de generación y «Página n de N».
- Encabezado (Código, Versión, Fechas de elaboración y aprobación): el de la plantilla oficial al generar (`PUT /plantillas/1/encabezado`); vacío si no se ha llenado.
- «Datos de la empresa»: los dos pares Ficha camión / Chofer son de la empresa: `empresa.fichaCamion1` / `chofer1` y `empresa.fichaCamion2` / `chofer2` (no copian los del suplidor).
- «Personal participante»: Auditor actuante 1 y 2, Encargado de recibir, Supervisor de combustibles y Representante del proveedor; el nombre del firmante se separa en Nombre y Apellido (las 2 últimas palabras son los apellidos, salvo una inicial en medio: «José M. Guzmán»). Las líneas del pie («Auditor actuante», «Auditor actuante», «Auditor UAI») son Auditor de cierre 1, 2 y Auditor UAI, con el nombre bajo la firma.
- Control interno: «X» en Sí o No; observación en su celda (la 10 como fecha dd/MM/yyyy). Lo que no tiene valor queda en blanco, como en papel.
- El visor del front (`DocumentoPdf.tsx`) dibuja lo mismo sobre `formulario-oficial.png` con las celdas de `formularioOficial.json` (una prueba de la API verifica que coincida con `PlantillaOficial.cs`).
- Al **finalizar** y al **corregir** se genera el PDF de la nueva versión desde su `SnapshotJson`, se guarda en disco como las fotos (`Pdf:Ruta`, por defecto `App_Data/pdf`; `{fiscalización}/v{version}.pdf`) y se llena `FiscalizacionVersion.PdfRuta`. Si la generación falla, el registro se guarda igual y el PDF se genera la primera vez que se pide.

| Endpoint | Quién | Respuesta |
|---|---|---|
| `GET /fiscalizaciones/{id}/pdf` | quien puede ver el registro | `application/pdf` de la versión vigente (`Fiscalizacion-A3F9-v2.pdf`). 409 si es un Borrador. Se regenera si `PdfRuta` falta o el archivo no existe. |
| `GET /fiscalizaciones/{id}/versiones/{v}/pdf` | Administrador (403) | PDF de esa versión (404 si no existe). |
| `GET /fiscalizaciones/{id}/pdf/vista-previa` | quien puede ver el registro | PDF del estado actual al vuelo, sin guardarlo, con marca de agua «BORRADOR» (o «VISTA PREVIA» si ya está finalizado). |

Todas con `Cache-Control: no-store`. El front las pide con la sesión (`Authorization` o `X-Dev-User`) y descarga el blob; sin red muestra «Sin conexión: el PDF oficial lo genera el servidor…».

## Inicio y estadísticas
`GET /inicio/resumen` → `{ finalizadosMes, finalizadosMesAnterior, borradores, borradoresFirmasIncompletas, galonesMes, avisos: AvisoDto[], recientes: FiscalizacionResumenDto[] }`
`AvisoDto` = `{ fiscalizacionId, numero, locacion, tipo: "DiferenciaMayor1Pct"|"ProveedorCero"|"SobreMediana", mensaje }`
`GET /estadisticas?desde&hasta&locacionId&agrupar=semana` → `{ total, galonesProveedor, galonesEgehid, diferencia, diferenciaPct, series: [{ periodo, proveedor, egehid }], porLocacion: [{ locacion, galones }], avisos: AvisoDto[] }`

## Bitácora
`POST /bitacora/ui` (cualquier autenticado) cuerpo:
```json
{ "eventos": [{ "idCliente": "uuid", "momento": "ISO", "sesionId": "uuid", "tipo": "click", "ruta": "/fiscalizaciones/..",
                "elemento": "Guardar borrador", "detalle": { "selector": "button#guardar", "x": 10, "y": 20 },
                "dispositivo": "Tablet · Chrome 140" }] }
```
→ 202. Idempotente por `idCliente`.
Solo propietario (`esPropietarioBitacora`): `GET /bitacora/ui`, `GET /bitacora/api`, `GET /bitacora/cambios` con query `desde, hasta, usuario (correo), tipo, texto, pagina, tamano` → `Pagina<...>` con los campos de las tablas del plan.

## Precisiones de la implementación (API real, verificada contra hidro-75)
- `GET /api/salud` (anónimo) → `{ estado: "ok", servicio: "fiscalizacion-egehid", hora }`. La app solo sincroniza si `servicio` coincide (así distingue la API de un portal de Wi-Fi o un proxy que respondan 200).
- Paginados: `{ items, total, pagina, tamano }`. `GET /fiscalizaciones` agrega `conteos` con claves `todos`, `papelera`, `Borrador`, `Finalizado`, `Modificado`, `EdicionPendiente`.
- `FiscalizacionDto` y `FiscalizacionResumenDto` incluyen además `enPapelera`.
- `pendientes` siempre trae las 6 claves: `visita`, `suplidor`, `mediciones`, `controles`, `fotos`, `firmas` (arreglos, vacíos si no hay).
- `PUT /fiscalizaciones/{id}`: en la creación `rowVersion` va `null`; si el registro ya existe, `rowVersion` es obligatorio (null o distinto → 409). El 409 trae `actual` (FiscalizacionDto vigente) cuando aplica.
- 400 de validación: `errors` con claves de sección (`visita`, `controles`, `firmas`, …) o `mediciones.lecturas`.
- Firmas requeridas para finalizar: `AuditorActuante1`, `EncargadoRecibir`, `SupervisorCombustibles`, `RepresentanteProveedor` (decidido 27/10/2026; auditores de cierre y UAI son opcionales).
- `PUT /firmas/{rol}`: `modo=EnEstaTablet` exige `nombreFirmante` + `imagenBase64` (PNG); `Predeterminada` sin imagen usa la firma guardada del usuario; el nombre en esos modos es el del usuario.
- Fotos: multipart con campos `archivo`, `descripcion`, `orden`; JPEG/PNG/WebP, máx. 8 MB, máx. 20.
- `GET /me/firma` → 404 si no tiene firma.
- `GET /fiscalizaciones/{id}/versiones` y `POST /{id}/restaurar`: solo Administrador (403).
- Bitácora (solo propietario), filas tal cual las tablas:
  - `ui`: `{ id, idCliente, momento, recibidoEn, usuarioId, correo, sesionId, tipo, ruta, elemento, detalle (string JSON), dispositivo }` — filtro `tipo` = tipo de evento.
  - `api`: `{ id, momento, usuarioId, correo, metodo, ruta, query, statusCode, duracionMs, ip, userAgent, correlationId }` — filtro `tipo` = método HTTP.
  - `cambios`: `{ id, momento, usuarioId, correo, entidad, entidadId, accion, valoresAnteriores, valoresNuevos, correlationId }` — filtro `tipo` = entidad.
  - `POST /bitacora/ui`: máx. 500 eventos por lote; tipos válidos `click|navegacion|envio|error|online|offline` (otros se descartan).

## Plantillas
Formularios con PDF base y campos colocados encima (fase 3). Medidas en **puntos PDF** con el origen **arriba a la izquierda** de cada página (y hacia abajo); una página carta mide 612 × 792. Las páginas giradas se miden como se ven.
Leer: cualquier usuario autenticado, pero solo ve plantillas `Activa` con versión publicada (y solo versiones publicadas; lo demás → 404). Gestionar: **Administrador** (403 para los demás).

- `TipoPlantilla`: `Oficial` | `Personalizada` · `EstadoPlantilla`: `Activa` | `Borrador` (nunca publicada) | `Desactivada`
- `TipoCampo`: `Texto` | `Numero` | `Fecha` | `Casilla` | `Firma` | `Formula` (en la pantalla, «Diferencia»)
- Versiones: cada plantilla tiene a lo sumo un **borrador** (la versión más alta sin publicar). Editar una plantilla publicada crea el borrador `vigente + 1` con su mismo PDF y campos; publicar lo deja vigente.
- La plantilla **oficial** (`id = 1`, «Combustible y aceites», v2) es el formulario en papel de EGEHID: no guarda PDF ni campos en la base; la API sirve su PDF base (A4, `tienePdf: true`, 1 página de 595.56 × 842.04) y describe sus 103 campos en la posición exacta de cada celda. Es de solo lectura (no se edita, publica ni desactiva → 400), salvo el encabezado. Duplicarla copia el PDF base y los campos. Las fiscalizaciones nuevas siempre usan la versión publicada de la oficial.
- `encabezado` (en `PlantillaDto`): `{ codigo, version, fechaElaboracion, fechaAprobacion }` (texto ≤ 40 / ≤ 20, fechas `yyyy-MM-dd`, todo opcional) — el control de documentos que se imprime arriba del formulario.

`GET /plantillas` → `PlantillaResumenDto[]` (oficial primero, luego por nombre)
```json
[{ "id": 2, "nombre": "Recepción de lubricantes", "tipo": "Personalizada", "estado": "Activa",
   "version": 3, "versionBorrador": 4, "totalCampos": 46, "publicadaEn": "2026-09-15T14:02:00Z" }]
```
`version` = publicada vigente (0 si nunca se publicó) · `versionBorrador` = versión en edición o `null` (siempre `null` para quien no es Administrador) · `totalCampos` de la vigente (o del borrador si nunca se publicó).

`GET /plantillas/{id}?version=` → `PlantillaDto`. Sin `version`: el borrador (Administrador) o la publicada vigente.
```json
{ "id": 2, "nombre": "Recepción de lubricantes", "tipo": "Personalizada", "estado": "Activa", "version": 3, "versionBorrador": 4,
  "editable": true,
  "versiones": [{ "version": 4, "publicada": false, "publicadaEn": null, "totalCampos": 11, "tienePdf": true },
                { "version": 3, "publicada": true, "publicadaEn": "2026-09-15T14:02:00Z", "totalCampos": 46, "tienePdf": true }],
  "actual": { "version": 4, "publicada": false, "publicadaEn": null, "tienePdf": true,
              "paginas": [{ "ancho": 612, "alto": 792 }],
              "campos": [{ "identificador": "diferencia", "etiqueta": "Diferencia de cubetas", "tipo": "Formula",
                           "formula": "cant_recibida - cant_facturada", "pagina": 1, "x": 170, "y": 252, "ancho": 110, "alto": 16,
                           "obligatorio": true, "enEstadisticas": true, "imprimirPdf": true }] } }
```
`editable` = Administrador y plantilla no oficial. Sin PDF base, `paginas` son páginas carta.

`GET /plantillas/{id}/versiones/{version}/pdf` → `application/pdf` (404 si esa versión no tiene PDF base).

Solo Administrador (todas devuelven `PlantillaDto` salvo donde se indica):
| Método y ruta | Cuerpo | Efecto |
|---|---|---|
| `POST /plantillas` | `{ nombre }` | Plantilla personalizada en blanco (borrador v1, sin PDF: una página carta). Nombre único (400 `errors.nombre`). |
| `POST /plantillas/importar` | multipart `archivo` (PDF), `nombre` opcional | Borrador v1 con el PDF. Nombre: el dado o el del archivo; si ya existe se agrega « (2)». |
| `POST /plantillas/{id}/duplicar` | `{ nombre? }` | Copia el borrador (o la vigente) con PDF y campos en una personalizada nueva («… (copia)»). Sirve también para la oficial. |
| `PUT /plantillas/{id}/borrador` | `{ nombre?, campos: CampoPlantillaDto[] }` | Reemplaza los campos del borrador (lo crea si no hay) y, si viene, el nombre. |
| `PUT /plantillas/{id}/encabezado` | `{ codigo?, version?, fechaElaboracion?, fechaAprobacion? }` | Guarda el encabezado (también en la oficial). 400 `errors.codigo` / `errors.version` si son largos, `errors.fechaAprobacion` si es anterior a la de elaboración. |
| `POST /plantillas/{id}/borrador/pdf` | multipart `archivo` | Cambia el PDF base del borrador (los campos deben seguir dentro de las páginas). |
| `DELETE /plantillas/{id}/borrador` | — | Descarta el borrador → 200 con la vigente; si nunca se publicó, elimina la plantilla → **204**. |
| `POST /plantillas/{id}/publicar` | — | Publica el borrador (`publicadaEn` = ahora) y deja la plantilla `Activa`. 400 si no hay borrador. |
| `POST /plantillas/{id}/desactivar` · `/activar` | — | Estado `Desactivada` / `Activa` (activar exige una versión publicada). |

Validación (400; `errors` con claves `campos.{identificador}`, `campos` o `nombre`):
- PDF: `application/pdf` (o `octet-stream`) que empiece con `%PDF`, **máx. 4 MB** (el límite de la petición es 5 MB → 413 si se pasa), legible (no dañado ni con contraseña), 1 a **10 páginas**.
- Al guardar el borrador: identificador `^[a-z][a-z0-9_]*$` (máx. 80) y **único en la versión**; etiqueta obligatoria (máx. 150); fórmula máx. 500; `pagina` existente (sin PDF base: hasta 10 páginas carta); `ancho`, `alto` > 0 y el campo dentro de la página (margen 1 pt); máx. 500 campos. Las medidas se redondean a 2 decimales; la fórmula se descarta si el tipo no es `Formula`.
- Al publicar, además: al menos un campo; cada `Formula` con fórmula válida (números, identificadores, `+ - * /` — también `− × ÷` —, paréntesis y signo) que use solo identificadores **existentes** de tipo `Numero` o `Formula`, sin usarse a sí misma ni formar ciclos.

## Usuarios (Administración)
Solo **Administrador** (403 para los demás: política `Administrador` en el controlador y verificación en el servicio). Sin cambios de esquema: usa `fis.Usuario.Rol` y `fis.Usuario.Activo`. Cada cambio queda en `bit.BitacoraCambio` (entidad `Usuario`, acción `Modificar` con `Rol` / `Activo` antes y después; el alta anticipada como `Crear`).

`GET /admin/usuarios?texto&rol&estado&pagina(1)&tamano(20)` → `Pagina<UsuarioAdminDto>` + `conteos`
- `texto` busca en nombre, correo y cargo · `rol` = `Administrador|Auditor|Firmante` · `estado` = `activos` | `inactivos` (sin valor: todos).
- Orden: activos primero, luego por nombre (los que aún no tienen nombre al final).
- `conteos`: `todos`, `activos`, `inactivos`, `pendientes` (con `texto` y `rol` aplicados, sin `estado`) y `Administrador`, `Auditor`, `Firmante` (de todo el sistema).
```json
{ "items": [{ "id": "guid", "correo": "ana.perez@hidroelectrica.gov.do", "nombreCompleto": "Ana Lucía Pérez", "cargo": "Auditora de campo",
              "rol": "Auditor", "activo": true, "tieneFirma": true, "perfilCompleto": true, "pendienteIngreso": false,
              "creadoEn": "...", "ultimoAcceso": "...", "registros": 31, "esUsted": false }],
  "total": 8, "pagina": 1, "tamano": 20,
  "conteos": { "todos": 8, "activos": 7, "inactivos": 1, "pendientes": 1, "Administrador": 1, "Auditor": 5, "Firmante": 2 } }
```
`registros` = fiscalizaciones de las que es autor (sin papelera) · `pendienteIngreso` = registrado por un administrador y todavía no entró (sin `Auth0Sub` ni `ultimoAcceso`) · `esUsted` = es quien consulta.

| Método y ruta | Cuerpo | Respuesta / reglas |
|---|---|---|
| `POST /admin/usuarios` | `{ correo, rol, nombreCompleto? }` | `UsuarioAdminDto`. **Registro anticipado**: al entrar por primera vez con ese correo (Auth0 o `X-Dev-User`) se usa esta fila y conserva el rol (y el nombre, si se dio); el cargo y la firma se completan en `/primer-ingreso`. 400 `errors.correo` si el correo no es válido o ya existe (se guarda en minúsculas). |
| `PUT /admin/usuarios/{id}/rol` | `{ rol }` | `UsuarioAdminDto`. |
| `POST /admin/usuarios/{id}/desactivar` · `/activar` | — | `UsuarioAdminDto`. |

Reglas (400 con `title`): «No puede desactivar su propia cuenta.», «No puede quitarse a sí mismo el rol de Administrador.», «Debe quedar al menos un administrador activo.» (al quitar el rol o desactivar al último administrador activo). Si no hay cambio real no se escribe nada. 404 si el usuario no existe.

Usuario **desactivado**: cualquier petición autenticada responde **403** `{ "title": "Usuario desactivado." }` (incluido `GET /me`); el front muestra «Su usuario está desactivado…» con «Cerrar sesión». No aparece en `GET /usuarios` (elegir firmante). Las solicitudes de firma que ya tenía pendientes no se cancelan (vencen a los 7 días).

## App Android: actualización automática (27/10/2026)
Anónimos (la app los llama antes de iniciar sesión; el paquete es el mismo front público). Detalle en `docs/APP-MOVIL.md`.

| Método y ruta | Respuesta |
|---|---|
| `GET /api/app/version` | 200 `VersionAppDto` de la última publicada · **204** si no hay ninguna. `Cache-Control: no-store`. |
| `GET /api/app/paquetes/{archivo}` | `application/zip` del paquete web (nombre `^[A-Za-z0-9][A-Za-z0-9._-]{0,80}\.zip$`; otro nombre o inexistente → 404). |

```json
{ "version": "0.1.1", "ruta": "/app/paquetes/0.1.1.zip", "sha256": "9f2c…", "notas": "Bitácora con nueva interfaz",
  "publicadaEn": "2026-10-27T18:00:00Z", "nativaMinima": 1 }
```
`ruta` es relativa a la base de la API. `sha256` = huella del zip (la app la verifica antes de aplicarlo). `nativaMinima` = `versionCode` mínimo del APK instalado; si el APK es más viejo, la app pide reinstalarlo.
Se publica con `web/scripts/publicar-actualizacion.ps1`, que deja `{App:Ruta}/<versión>.zip` y `version.json` (`App:Ruta` por defecto `App_Data/app`). Un `version.json` que apunta a un zip inexistente se ignora.

## Envío confirmado desde la tablet (27/10/2026)
Reglas del cliente que dependen de la API (ver `docs/APP-MOVIL.md` §2): antes de sincronizar exige `/salud` con `servicio`; un PUT solo cuenta como guardado si la respuesta es el mismo registro y trae los mismos datos; las fotos van con `id` + `sha256`; finalizar se repite sin efecto; después de finalizar la app vuelve a leer `GET /fiscalizaciones/{id}`.
