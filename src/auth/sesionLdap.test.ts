import { beforeEach, describe, expect, it, vi } from 'vitest';
import { borrarSesionLdap, CLAVE_LDAP, guardarSesionLdap, leerSesionLdap } from './sesionLdap';

const s = { token: 'abc', expira: '2026-12-01T00:00:00Z', correo: 'ana@egehid.com', nombre: 'Ana' };
const ahora = Date.parse('2026-10-29T12:00:00Z');

/** Node 25 expone un `localStorage` global incompleto que tapa el de jsdom: almacén en memoria. */
function memoria(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

describe('sesión de dominio guardada', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoria());
    vi.stubGlobal('sessionStorage', memoria());
  });

  it('mantener la guarda en localStorage y se lee mientras no vence', () => {
    guardarSesionLdap(s, true);
    expect(localStorage.getItem(CLAVE_LDAP)).not.toBeNull();
    expect(leerSesionLdap(ahora)?.correo).toBe('ana@egehid.com');
  });

  it('sin mantener queda solo en sessionStorage, y la renovación no la mueve', () => {
    guardarSesionLdap(s, false);
    guardarSesionLdap({ ...s, token: 'nuevo' });
    expect(localStorage.getItem(CLAVE_LDAP)).toBeNull();
    expect(leerSesionLdap(ahora)?.token).toBe('nuevo');
  });

  it('una sesión vencida o dañada se descarta', () => {
    guardarSesionLdap({ ...s, expira: '2026-10-01T00:00:00Z' }, true);
    expect(leerSesionLdap(ahora)).toBeNull();
    expect(localStorage.getItem(CLAVE_LDAP)).toBeNull();
    localStorage.setItem(CLAVE_LDAP, '{no es json');
    expect(leerSesionLdap(ahora)).toBeNull();
  });

  it('salir borra de los dos almacenes', () => {
    guardarSesionLdap(s, true);
    sessionStorage.setItem(CLAVE_LDAP, JSON.stringify(s));
    borrarSesionLdap();
    expect(leerSesionLdap(ahora)).toBeNull();
  });
});
