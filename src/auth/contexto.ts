import { createContext, useContext } from 'react';
import type { ModoAuth } from '../config';

export interface OpcionesEntrar {
  registro?: boolean;
  /** Contraseña del dominio (modo ldap). */
  clave?: string;
  /** Modo ldap: false guarda la sesión solo hasta cerrar la app/pestaña. */
  mantener?: boolean;
}

export interface Sesion {
  modo: ModoAuth;
  estado: 'cargando' | 'anonimo' | 'autenticado';
  correo: string | null;
  error: string | null;
  /**
   * En modo dev requiere el correo; en ldap, el usuario de dominio y `opciones.clave`; en Auth0 redirige al Universal Login (con el correo como login_hint;
   * `registro` abre la pantalla de crear cuenta).
   */
  entrar(correo?: string, opciones?: OpcionesEntrar): Promise<void>;
  salir(): void;
}

export const SesionContext = createContext<Sesion | null>(null);

export function useSesion(): Sesion {
  const s = useContext(SesionContext);
  if (!s) throw new Error('useSesion debe usarse dentro de <SesionProvider>');
  return s;
}

export const CLAVE_DEV = 'fisc.devUser';

export function leerUsuarioDev(): string | null {
  try {
    return localStorage.getItem(CLAVE_DEV);
  } catch {
    return null;
  }
}

