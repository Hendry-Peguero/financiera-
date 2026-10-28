# Fiscalización de combustible y aceites · Front (React)

Aplicación web de EGEHID para registrar fiscalizaciones en campo (tablet, móvil y escritorio).
Funciona sin conexión: los borradores, las fotos y los eventos de la bitácora se guardan en la tablet
(IndexedDB) y se sincronizan con la API al volver la red.

Stack: Vite 8 · React 19 · TypeScript 6 · React Router 7 · TanStack Query 5 · Dexie 4 · `@auth0/auth0-react` ·
Vitest 4 + Testing Library + fake-indexeddb · Playwright.

## Puesta en marcha

```bash
cd web
npm install
npx playwright install chromium   # solo para las pruebas E2E
npm run dev                       # http://localhost:5173
```

La API debe estar en `VITE_API_URL` (por defecto `http://localhost:5080/api`) y permitir el origen
`http://localhost:5173` en `Cors:Origenes`.

## Variables de entorno

| Variable | Uso |
|---|---|
| `VITE_AUTH_MODE` | `auth0` (producción) o `dev` (correo simulado con el encabezado `X-Dev-User`). |
| `VITE_API_URL` | URL base de la API, con `/api`. |
| `VITE_AUTH0_DOMAIN` | Dominio del tenant de Auth0 (`tu-tenant.us.auth0.com`). |
| `VITE_AUTH0_CLIENT_ID` | Client ID de la aplicación SPA. |
| `VITE_AUTH0_AUDIENCE` | Identificador de la API en Auth0 (`https://fiscalizacion.egehid.gob.do/api`). |

- `.env.development` ya trae el modo `dev` para trabajar en local.
- Para producción, copie `.env.example` a `.env` (o `.env.production`) y complete los valores de Auth0.

## Auth0 (aplicación SPA)

1. **Applications → Create Application → Single Page Application.** Copie *Domain* y *Client ID*.
2. **Allowed Callback URLs / Allowed Logout URLs / Allowed Web Origins:** `http://localhost:5173` y la URL de producción.
3. **Refresh Token Rotation:** activada (el front usa `useRefreshTokens` y `cacheLocation="localstorage"` para que la
   sesión siga abierta en la tablet aunque se cierre la app o no haya red).
4. **APIs:** cree la API con el identificador del *audience* y active *Allow Offline Access*.
5. **Conexiones:** *Username-Password* o *Passwordless (email)*. Sin conexiones de dominio.
6. **Action post-login** que agregue el correo al access token (claim `https://fiscalizacion/email`); la API identifica
   al usuario por su correo.

El botón **«Entrar con mi correo»** abre el Universal Login. Después del ingreso la app pide `GET /api/me`; si el
perfil no está completo (`perfilCompleto = false`) lleva a **/primer-ingreso** para registrar nombre, cargo y firma.

## Modo desarrollo (`VITE_AUTH_MODE=dev`)

La pantalla de ingreso muestra un campo de correo. El correo se guarda en `localStorage` (`fisc.devUser`) y se envía
en cada petición como `X-Dev-User`. La API debe estar en `Development` con `Auth:Mode=Dev`.
El propietario de la bitácora es el correo configurado en `Bitacora:Propietarios` de la API.

## Pantallas

| Ruta | Pantalla |
|---|---|
| `/login` | Ingreso (Auth0 o correo de desarrollo) |
| `/primer-ingreso` | Perfil y firma predeterminada |
| `/` | Inicio: indicadores, actividad reciente, borradores en la tablet, avisos |
| `/fiscalizaciones/nueva` | Crea el Guid en la tablet y abre el formulario |
| `/fiscalizaciones/:id/:seccion` | Formulario en 7 secciones (`visita`, `suplidor`, `mediciones`, `controles`, `fotos`, `firmas`, `revisar`) con navegación libre |
| `/fiscalizaciones/:id` | Detalle; pestaña de versiones solo para Administrador; «Corregir registro» |
| `/historial` | Pestañas por estado con conteos, filtros y paginación |
| `/estadisticas` | Indicadores, barras proveedor vs. EGEHID, galones por locación y avisos |
| `/papelera` | Restaurar registros (Administrador) |
| `/plantillas` | Plantillas de formularios (Administrador): importar PDF (pdf.js, carga diferida), colocar, arrastrar y redimensionar campos, autoguardado del borrador, publicar versiones, duplicar, desactivar |
| `/usuarios` | Usuarios (Administrador; no está en el diseño): pestañas Todos / Activos / Desactivados, búsqueda, filtro por rol, cambiar rol, activar / desactivar y «Registrar usuario» (correo + rol antes de su primer ingreso). En móvil y Tablet V se llega desde «Mi cuenta → Administración» |
| `/cuenta` | Perfil, firma predeterminada, estado local, cerrar sesión |
| `/firmas/solicitudes` | Firmas que le solicitaron: firmar con la predeterminada o una nueva, o rechazar |
| `/bitacora` | Solo si `me.esPropietarioBitacora`: Clics/UI, API y Cambios (para los demás ni el menú ni la ruta existen) |

Diseño responsivo: barra lateral (escritorio), riel (tablet horizontal), barra superior y navegación inferior (móvil).

## Sin conexión

- **Autoguardado:** cada cambio del formulario se guarda en IndexedDB 500 ms después de la última tecla
  («Autoguardado en la tablet · hace N s»), y también al salir u ocultar la app.
- **Cola de sincronización** (`src/offline`): `PUT /fiscalizaciones/{id}` con `rowVersion = null` al crear y, después,
  con el `rowVersion` devuelto por la API. Si hay un **409** se guarda `actual` y el formulario ofrece
  «Usar versión del servidor» o «Conservar mis cambios» (si sigue en Borrador).
- **Fotos:** se comprimen a JPEG de ~1600 px, se guardan en la tablet y se suben (multipart `archivo`, `descripcion`,
  `orden`) cuando el registro ya existe en el servidor. Máximo 20.
- **Catálogos, perfil, inicio:** se guardan en caché y se muestran sin red.
- Indicador «Sin conexión» / «Sincronizando N» / «En línea» en la barra superior.
- Firmar, finalizar y corregir necesitan red (antes se envían los cambios pendientes).

## Bitácora de clics

`src/tracking`: un listener de `click` en fase de captura, cambios de ruta, errores de la ventana y eventos
`online`/`offline` → cola en IndexedDB → `POST /api/bitacora/ui` por lotes (cada 10 s, al llegar a 50 eventos y al
volver la red; máximo 500 por lote). Etiqueta: `data-track` → `aria-label` → texto visible (80 caracteres) + selector
corto. **Nunca** se registra el valor de un campo, y nada de los campos de contraseña.

## Pruebas

```bash
npm test            # Vitest (unitarias y de componentes)
npm run test:e2e    # Playwright (Chromium) con la API simulada
npm run lint
npm run build
```

- Unitarias: cálculos (−12.40 gal, −0.29 %, −RD$ 3,082.64), validación y regla de los controles 6/11/12, pendientes,
  etiquetas del rastreador sin valores, cola de sincronización (rowVersion y 409), autoguardado, error en línea de
  Controles, Bitácora oculta para quien no es propietario.
- E2E: el servidor de Vite arranca en el puerto 5174 en modo `dev` con `VITE_API_URL=http://api.simulada.test/api`, y
  todas las respuestas salen de `e2e/apiSimulada.ts` (`page.route`). Las pruebas **nunca** llaman a la API real.
