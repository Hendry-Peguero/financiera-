export type ModoAuth = 'auth0' | 'dev';

const env = import.meta.env;

/** Clave en localStorage de la dirección de la API elegida en la tablet (solo si el build lo permite). */
const CLAVE_SERVIDOR = 'fisc.servidor';

/**
 * PRUEBAS: el APK de prueba (VITE_PERMITIR_SERVIDOR=1) deja escribir la dirección de la API en la pantalla de inicio
 * de sesión, porque la IP de la PC cambia de una red a otra. En producción la dirección es fija.
 */
export const permiteCambiarServidor = env.VITE_PERMITIR_SERVIDOR === '1';

const apiPorDefecto = (env.VITE_API_URL ?? 'http://localhost:5080/api').replace(/\/+$/, '');

function servidorGuardado(): string | null {
  if (!permiteCambiarServidor) return null;
  try {
    return localStorage.getItem(CLAVE_SERVIDOR);
  } catch {
    return null;
  }
}

/** «192.168.1.17» o «http://192.168.1.17:5080» → «http://192.168.1.17:5080/api». */
export function normalizarServidor(texto: string): string {
  let s = texto.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`;
  if (!/:\d+$/.test(s.replace(/\/api$/, '')) && !/^https:/i.test(s)) s = s.replace(/(\/api)?$/, ':5080$1');
  if (!/\/api$/.test(s)) s = `${s}/api`;
  return s;
}

export function guardarServidor(url: string | null) {
  try {
    if (url) localStorage.setItem(CLAVE_SERVIDOR, normalizarServidor(url));
    else localStorage.removeItem(CLAVE_SERVIDOR);
  } catch {
    /* sin almacenamiento: queda la dirección por defecto */
  }
}

export const config = {
  modoAuth: (env.VITE_AUTH_MODE === 'dev' ? 'dev' : 'auth0') as ModoAuth,
  get apiUrl(): string {
    return servidorGuardado() ?? apiPorDefecto;
  },
  apiPorDefecto,
  /** Versión del paquete web (web/package.json); la app Android la compara con la publicada para actualizarse. */
  version: (env.VITE_VERSION_APP as string | undefined) ?? '0.0.0',
  auth0: {
    domain: env.VITE_AUTH0_DOMAIN ?? '',
    clientId: env.VITE_AUTH0_CLIENT_ID ?? '',
    audience: env.VITE_AUTH0_AUDIENCE ?? '',
  },
};
