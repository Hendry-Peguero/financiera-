import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, configurarAuth, RedError, solicitar, type ProveedorAuth } from '../api/client';
import { config } from '../config';
import { CLAVE_DEV, leerUsuarioDev, SesionContext, type OpcionesEntrar, type Sesion } from './contexto';
import { borrarSesionLdap, guardarSesionLdap, leerSesionLdap, type SesionLdapGuardada } from './sesionLdap';
import { marcarSesionRastreo } from '../tracking';

/** Encabezados del modo dev: se leen en cada petición (no dependen del orden de los efectos de React). */
const authDev: ProveedorAuth = async () => {
  const c = leerUsuarioDev();
  const h: Record<string, string> = {};
  if (c) h['X-Dev-User'] = c;
  return h;
};

function SesionDev({ children }: { children: ReactNode }) {
  const [correo, setCorreo] = useState<string | null>(() => leerUsuarioDev());

  useEffect(() => {
    configurarAuth(authDev);
    marcarSesionRastreo(!!correo);
  }, [correo]);

  const entrar = useCallback(async (c?: string) => {
    const limpio = (c ?? '').trim().toLowerCase();
    if (!limpio) throw new Error('Escriba su correo.');
    localStorage.setItem(CLAVE_DEV, limpio);
    configurarAuth(authDev);
    marcarSesionRastreo(true);
    setCorreo(limpio);
  }, []);

  const salir = useCallback(() => {
    localStorage.removeItem(CLAVE_DEV);
    marcarSesionRastreo(false);
    setCorreo(null);
  }, []);

  const valor = useMemo<Sesion>(
    () => ({ modo: 'dev', estado: correo ? 'autenticado' : 'anonimo', correo, error: null, entrar, salir }),
    [correo, entrar, salir],
  );
  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>;
}

const authLdap: ProveedorAuth = async (): Promise<Record<string, string>> => {
  const s = leerSesionLdap();
  return s ? { Authorization: `Bearer ${s.token}` } : {};
};

/**
 * Usuario y contraseña del dominio EGEHID: la API valida contra el Active Directory y entrega un token de varios días,
 * guardado en la tablet para trabajar sin conexión. Al abrir con red se renueva.
 */
function SesionLdap({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<SesionLdapGuardada | null>(() => leerSesionLdap());

  useEffect(() => {
    configurarAuth(authLdap);
    marcarSesionRastreo(!!sesion);
  }, [sesion]);

  const salir = useCallback(() => {
    borrarSesionLdap();
    marcarSesionRastreo(false);
    setSesion(null);
  }, []);

  // Renovación al abrir: un 401 significa que el token ya no sirve; sin red o con otro error se sigue con el guardado.
  const hayToken = !!sesion;
  useEffect(() => {
    if (!hayToken || !navigator.onLine) return;
    solicitar<SesionLdapGuardada>('/auth/renovar', { metodo: 'POST', cuerpo: {} })
      .then((s) => setSesion(guardarSesionLdap(s)))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) salir();
      });
  }, [hayToken, salir]);

  const entrar = useCallback(async (usuario?: string, op?: OpcionesEntrar) => {
    const u = (usuario ?? '').trim();
    if (!u || !op?.clave) throw new Error('Escriba su usuario y contraseña.');
    let s: SesionLdapGuardada;
    try {
      s = await solicitar<SesionLdapGuardada>('/auth/login', { metodo: 'POST', cuerpo: { usuario: u, clave: op.clave } });
    } catch (e) {
      if (e instanceof RedError) throw new Error('No se pudo contactar al servidor. Para el primer inicio de sesión hace falta conexión.', { cause: e });
      if (e instanceof ApiError && e.status === 429) throw new Error('Demasiados intentos. Espere un minuto y vuelva a intentar.', { cause: e });
      throw e;
    }
    setSesion(guardarSesionLdap(s, op.mantener !== false));
  }, []);

  const valor = useMemo<Sesion>(
    () => ({ modo: 'ldap', estado: sesion ? 'autenticado' : 'anonimo', correo: sesion?.correo ?? null, error: null, entrar, salir }),
    [sesion, entrar, salir],
  );
  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>;
}

let tokenAuth0: (() => Promise<string | undefined>) | null = null;
let avisarToken: () => void = () => {};
let tokenRegistrado = new Promise<void>((ok) => (avisarToken = ok));

/**
 * Los efectos de los hijos (consultas) corren antes que el del proveedor: si aún no se registró la función
 * del token, se espera un momento en lugar de enviar la petición sin credenciales.
 */
const authAuth0: ProveedorAuth = async () => {
  const h: Record<string, string> = {};
  if (!tokenAuth0) await Promise.race([tokenRegistrado, new Promise((ok) => setTimeout(ok, 3000))]);
  if (!tokenAuth0) return h;
  try {
    const token = await tokenAuth0();
    if (token) h.Authorization = `Bearer ${token}`;
  } catch {
    /* sin token: la API responderá 401 */
  }
  return h;
};

function PuenteAuth0({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, user, error, loginWithRedirect, logout, getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    if (isAuthenticated) {
      tokenAuth0 = () => getAccessTokenSilently();
      avisarToken();
    } else {
      tokenAuth0 = null;
      tokenRegistrado = new Promise<void>((ok) => (avisarToken = ok));
    }
    configurarAuth(authAuth0);
    marcarSesionRastreo(isAuthenticated);
  }, [isAuthenticated, getAccessTokenSilently]);

  const valor = useMemo<Sesion>(
    () => ({
      modo: 'auth0',
      estado: isLoading ? 'cargando' : isAuthenticated ? 'autenticado' : 'anonimo',
      correo: user?.email ?? null,
      error: error?.message ?? null,
      entrar: (correo?: string, op?: OpcionesEntrar) =>
        loginWithRedirect({
          appState: { returnTo: window.location.pathname === '/login' ? '/' : window.location.pathname },
          authorizationParams: {
            ...(correo?.trim() ? { login_hint: correo.trim() } : {}),
            ...(op?.registro ? { screen_hint: 'signup' } : {}),
          },
        }),
      salir: () => logout({ logoutParams: { returnTo: window.location.origin } }),
    }),
    [isLoading, isAuthenticated, user, error, loginWithRedirect, logout],
  );
  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>;
}

function SinConfiguracion({ children }: { children: ReactNode }) {
  const valor = useMemo<Sesion>(
    () => ({
      modo: 'auth0',
      estado: 'anonimo',
      correo: null,
      error: 'Falta configurar Auth0 (VITE_AUTH0_DOMAIN y VITE_AUTH0_CLIENT_ID).',
      entrar: async () => {},
      salir: () => {},
    }),
    [],
  );
  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>;
}

export function SesionProvider({ children, alVolver }: { children: ReactNode; alVolver?: (ruta: string) => void }) {
  if (config.modoAuth === 'dev') return <SesionDev>{children}</SesionDev>;
  if (config.modoAuth === 'ldap') return <SesionLdap>{children}</SesionLdap>;
  if (!config.auth0.domain || !config.auth0.clientId) return <SinConfiguracion>{children}</SinConfiguracion>;
  return (
    <Auth0Provider
      domain={config.auth0.domain}
      clientId={config.auth0.clientId}
      cacheLocation="localstorage"
      useRefreshTokens
      useRefreshTokensFallback={false}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: config.auth0.audience || undefined,
        scope: 'openid profile email offline_access',
      }}
      onRedirectCallback={(appState) => alVolver?.((appState?.returnTo as string) ?? '/')}
    >
      <PuenteAuth0>{children}</PuenteAuth0>
    </Auth0Provider>
  );
}

if (config.modoAuth === 'dev') configurarAuth(authDev);
else if (config.modoAuth === 'ldap') configurarAuth(authLdap);
else configurarAuth(authAuth0);
