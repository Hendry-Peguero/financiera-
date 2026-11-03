/** Sesión con usuario de dominio: el token que entrega la API en /auth/login y /auth/renovar. */
export interface SesionLdapGuardada {
  token: string;
  /** ISO UTC. */
  expira: string;
  correo: string;
  nombre?: string | null;
}

export const CLAVE_LDAP = 'fisc.sesionDominio';

function almacenes(): Storage[] {
  return [safe(() => localStorage), safe(() => sessionStorage)].filter((a): a is Storage => !!a);
}

function valida(s: unknown, ahora: number): s is SesionLdapGuardada {
  const v = s as SesionLdapGuardada | null;
  return !!v && typeof v.token === 'string' && typeof v.correo === 'string' && Date.parse(v.expira) > ahora;
}

/** La sesión guardada si sigue vigente; una vencida o dañada se borra. */
export function leerSesionLdap(ahora = Date.now()): SesionLdapGuardada | null {
  for (const a of almacenes()) {
    try {
      const txt = a.getItem(CLAVE_LDAP);
      if (!txt) continue;
      const s: unknown = JSON.parse(txt);
      if (valida(s, ahora)) return s;
      a.removeItem(CLAVE_LDAP);
    } catch {
      /* dañada: se ignora */
    }
  }
  return null;
}

/**
 * `mantener` = true queda en localStorage (sobrevive al cerrar la app); false, solo en sessionStorage.
 * Sin indicarlo (renovación) se queda donde estaba.
 */
export function guardarSesionLdap(s: SesionLdapGuardada, mantener?: boolean): SesionLdapGuardada {
  const [local, sesion] = [safe(() => localStorage), safe(() => sessionStorage)];
  const enSesion = mantener === undefined ? !!sesion?.getItem(CLAVE_LDAP) && !local?.getItem(CLAVE_LDAP) : !mantener;
  borrarSesionLdap();
  const destino = enSesion ? sesion : local;
  try {
    destino?.setItem(CLAVE_LDAP, JSON.stringify({ token: s.token, expira: s.expira, correo: s.correo, nombre: s.nombre ?? null }));
  } catch {
    /* sin almacenamiento: la sesión dura lo que la página */
  }
  return s;
}

export function borrarSesionLdap() {
  for (const a of almacenes()) {
    try {
      a.removeItem(CLAVE_LDAP);
    } catch {
      /* nada que borrar */
    }
  }
}

function safe(f: () => Storage): Storage | null {
  try {
    return f();
  } catch {
    return null;
  }
}
