# Análisis de coherencia · Diseño ↔ Base de datos ↔ API ↔ Front

Fecha: 22/10/2026.

## Verificado

| Capa | Evidencia |
|---|---|
| BD (hidro-75) ↔ API | La migración `Inicial` es el mismo modelo de EF que usa la API: 21 tablas (`fis` + `bit`), catálogos y 12 preguntas (6, 11 y 12 obligatorias si Sí). Prueba de punta a punta contra hidro-75: 28/28. |
| API | xUnit 23/23 (dominio 16, aplicación 7) al 22/10; 95/95 al 26/10 (dominio 47, aplicación 48). |
| API ↔ Front | Mismo contrato (`docs/API-CONTRATO.md`). El front hizo una prueba en vivo de solo lectura contra la API real (me, catálogos, inicio, historial, solicitudes, bitácora → 200). E2E con la API simulada según el contrato. |
| Front | Build sin errores de TS, lint limpio, Vitest 51/51, Playwright 4/4. |
| Diseño ↔ Front | Orden de campos de Visita / Suplidor / Empresa como en el diseño; regla 6/11/12 con “Obligatoria si responde Sí”; control 10 como fecha; sidebar / rail / navegación móvil. |
| Bitácora | API, cambios de datos y clics se registran; solo el propietario consulta (403 para los demás, incluso administradores); no se guardan valores de campos ni contraseñas. |

### Corregido durante el análisis
- La bitácora API y el log técnico registraban **200/500** en respuestas que en realidad eran 409/400/404 (orden de los middlewares). Ya registran el código real.
- Las fechas salían sin zona horaria; ahora van en UTC con `Z`.
- `mediciones.lecturas` ahora trae siempre los 3 equipos.

## Diferencias pendientes (requieren decisión o fase siguiente)

| # | Tema | Situación | Propuesta |
|---|---|---|---|
| 1 | **PDF** (Vista previa, “Finalizar y generar PDF”, Descargar PDF, Informe PDF) | **Hecho (26/10/2026; desde 27/10 con el formato del formulario en papel, ver #3)**: la API genera el PDF oficial con PDFsharp 6.2.4 (MIT; no QuestPDF) al finalizar y al corregir, lo guarda y llena `PdfRuta`; `GET /fiscalizaciones/{id}/pdf`, `/versiones/{v}/pdf` (Administrador) y `/pdf/vista-previa` («BORRADOR»). El front descarga desde la API (Detalle, PDF por versión, Vista previa del formulario y de «Revisar»); el visor HTML queda como vista en pantalla. Sin cambios de esquema. «Informe PDF» de Estadísticas sigue imprimiendo la página (no es el PDF de una fiscalización). | Definir si el informe de estadísticas necesita un PDF propio. |
| 2 | **Exportar Excel** (Historial, Estadísticas) | **Hecho (26/10/2026)**: `.xlsx` desde el front (`web/src/pantallas/exportarExcel.ts`). | — |
| 3 | **Plantillas** (importar PDF, editor de campos) | Implementado (26/10/2026): `/api/plantillas` (sección «Plantillas» del contrato) y editor con pdf.js. Sin cambios de esquema. Las plantillas personalizadas todavía no se llenan como fiscalizaciones. **27/10/2026**: el PDF oficial es ahora una copia del formulario en papel (`diseno/Modelo - Formulario Fiscalización Combustible y Aceites (1).pdf`): la plantilla oficial tiene ese PDF base y sus 103 campos en la posición de cada celda; el generador escribe los valores encima (+ anexo de fotos, 6 por página) y el visor del Detalle hace lo mismo en HTML. Encabezado de control de documentos (código, versión, fechas) editable por el Administrador en Plantillas (migración `EncabezadoPlantilla`, 4 columnas en `fis.Plantilla`). El motor de llenado (`GeneradorPdf.RellenarPagina`) sirve para cualquier plantilla. | Falta decidir cómo se capturan los datos de una plantilla personalizada (hoy solo se diseña). |
| 4 | **Pantalla de Login** | El diseño habla de “cuenta local en esta tablet”, contraseña, “Crear cuenta”, “¿Olvidó su contraseña?”. Con Auth0 eso lo maneja Auth0. | Actualizar el diseño a “Entrar con mi correo”. |
| 5 | **Mi cuenta**: respaldo cifrado `.fisc`, SharePoint/Entra, bloqueo por intentos | Pensado para datos solo en la tablet. Ahora los datos viven en hidro-75 y Auth0 bloquea por intentos. | Quitar del diseño o redefinir. |
| 6 | **Estado “Edición pendiente”** | Aparece en Historial; no hay regla que lo active. | 27/10/2026: el usuario aún no lo define. Sin cambios hasta decidir. |
| 7 | **Firmas obligatorias** | **Decidido (27/10/2026)**: se exigen 4 para finalizar: Auditor actuante 1, Encargado de recibir, Supervisor de combustibles y Representante del proveedor. Auditor actuante 2, auditores de cierre y UAI son opcionales. Aplicado en dominio (`ValidadorFiscalizacion.FirmasRequeridas`), front (`ROLES_FIRMA`) y contrato. | — |
| 8 | **Solicitudes de firma por formulario** | **Hecho (26/10/2026)**: `GET /fiscalizaciones/{id}/solicitudes-firma` (mismo permiso que ver el registro) con firmante, estado (`Pendiente`/`Firmada`/`Rechazada`/`Expirada`), creada, vence (+7 días) y firmada. «Participantes y firmas» muestra «Acceso enviado · {firmante}», rechazos con motivo y accesos vencidos desde el servidor; sin red, el último estado guardado con aviso. Sin cambios de esquema. «Reenviar» usa el POST existente; no hay cancelar (no está en el diseño). | — |
| 9 | **Ficha camión / Chofer en “Datos de la empresa”** | **Decidido (27/10/2026)**: el formulario en papel tiene dos pares y **ambos son de la empresa**, independientes del suplidor (`empresa.fichaCamion1` / `chofer1` y `fichaCamion2` / `chofer2`). Migración `CamionEmpresa` (columnas `FichaCamionEmpresa`, `ChoferEmpresa`). | — |
| 10 | **Total a entregar / Total a recibir** vs **Galones proveedor / EGEHID** | Son campos separados; pueden ser el mismo concepto. | Confirmar. |
| 11 | **Login SQL `userapp1`** | La contraseña dada falla. La API usa autenticación de Windows en desarrollo. | Confirmar la contraseña y guardarla en user-secrets / variable de entorno. |
| 12 | **Auth0** | Sin tenant configurado; probado solo el modo Dev. | Crear la SPA y la API en Auth0 (`api/README.md`). |
| 13 | **Datos de prueba en hidro-75** | Registro A6FB-D3E8, usuario `prueba.auditor@egehid.test` y sus filas de bitácora. | Borrar cuando se autorice. |
| 14 | **Gestión de usuarios** | **Hecho (26/10/2026)**: pantalla «Usuarios» (Administración; no existe en el diseño: se hizo con las pestañas, filtros, tabla, chips y menú «⋮» del Historial y tarjetas en el móvil) en el menú lateral, el riel, «Mi cuenta → Administración» en móvil y en Tablet V. API `/api/admin/usuarios` (sección «Usuarios (Administración)» del contrato): lista con filtros y conteos, registro anticipado por correo + rol, cambio de rol, activar / desactivar. Reglas: solo Administrador (403), no se desactiva ni se quita el rol a sí mismo, nunca cero administradores activos, el desactivado recibe 403 en toda la API (ya lo hacía `MiddlewareUsuario`). Cambios en `bit.BitacoraCambio` por el interceptor. **Sin cambios de esquema** (`Usuario.Activo` y `Rol` ya existían). | 27/10/2026: las solicitudes de firma de un desactivado **se dejan** pendientes (vencen a los 7 días). Falta decidir si hace falta eliminar usuarios (hoy solo se desactivan). |
