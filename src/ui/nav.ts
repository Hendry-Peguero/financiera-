import type { Rol, UsuarioDto } from '../api/types';
import type { NombreIcono } from './Icono';

export type SeccionNav = 'PRINCIPAL' | 'ADMINISTRACIÓN' | 'CUENTA';

export interface ItemNav {
  ruta: string;
  texto: string;
  /** Etiqueta en el riel de Tablet H */
  corto: string;
  icono: NombreIcono;
  seccion: SeccionNav;
  /** No aparece en el riel (Tablet H) */
  sinRiel?: boolean;
  exacta?: boolean;
}

/**
 * Menú del diseño: PRINCIPAL (Inicio, Nueva fiscalización, Historial, Estadísticas), ADMINISTRACIÓN (Plantillas,
 * Versiones y cambios, Papelera y Usuarios — solo Administrador) y CUENTA (Mi cuenta, Respaldo cifrado).
 * «Bitácora» va al final de ADMINISTRACIÓN y solo existe para el propietario (esPropietarioBitacora).
 */
export function itemsNav(me: Pick<UsuarioDto, 'rol' | 'esPropietarioBitacora'> | null | undefined): ItemNav[] {
  const items: ItemNav[] = [
    { ruta: '/', texto: 'Inicio', corto: 'Inicio', icono: 'layout-dashboard', seccion: 'PRINCIPAL', exacta: true },
    { ruta: '/fiscalizaciones/nueva', texto: 'Nueva fiscalización', corto: 'Nueva', icono: 'file-plus-2', seccion: 'PRINCIPAL' },
    { ruta: '/historial', texto: 'Historial', corto: 'Historial', icono: 'history', seccion: 'PRINCIPAL' },
    { ruta: '/estadisticas', texto: 'Estadísticas', corto: 'Estadíst.', icono: 'chart-column', seccion: 'PRINCIPAL' },
  ];
  if (me?.rol === 'Administrador')
    items.push(
      { ruta: '/plantillas', texto: 'Plantillas', corto: 'Plantillas', icono: 'layout-template', seccion: 'ADMINISTRACIÓN' },
      { ruta: '/versiones', texto: 'Versiones y cambios', corto: 'Versiones', icono: 'git-compare', seccion: 'ADMINISTRACIÓN' },
      { ruta: '/papelera', texto: 'Papelera', corto: 'Papelera', icono: 'trash-2', seccion: 'ADMINISTRACIÓN' },
      // No está en el diseño: gestión de usuarios (rol, activar / desactivar, registro por correo)
      { ruta: '/usuarios', texto: 'Usuarios', corto: 'Usuarios', icono: 'users', seccion: 'ADMINISTRACIÓN' },
    );
  if (me?.esPropietarioBitacora)
    items.push({ ruta: '/bitacora', texto: 'Bitácora', corto: 'Bitácora', icono: 'scroll-text', seccion: 'ADMINISTRACIÓN' });
  items.push(
    { ruta: '/cuenta', texto: 'Mi cuenta', corto: 'Cuenta', icono: 'user-round', seccion: 'CUENTA', exacta: true },
    { ruta: '/cuenta/respaldo', texto: 'Respaldo cifrado', corto: 'Respaldo', icono: 'shield-check', seccion: 'CUENTA', sinRiel: true },
  );
  return items;
}

export function iniciales(nombre: string | null | undefined, correo?: string | null): string {
  const base = (nombre ?? '').trim() || (correo ?? '').split('@')[0];
  const partes = base.split(/[\s._-]+/).filter(Boolean);
  return ((partes[0]?.[0] ?? '?') + (partes[1]?.[0] ?? '')).toUpperCase();
}

/** «María Rosario Peña» → «María Rosario» (nombre corto de la tarjeta de usuario). */
export function nombreCorto(nombre: string | null | undefined, correo?: string | null): string {
  const n = (nombre ?? '').trim();
  if (!n) return (correo ?? '').split('@')[0];
  return n.split(/\s+/).slice(0, 2).join(' ');
}

/** «María Rosario Peña» → «María» */
export function primerNombre(nombre: string | null | undefined): string {
  return (nombre ?? '').trim().split(/\s+/)[0] ?? '';
}

const ROLES: Record<Rol, [string, string]> = {
  Administrador: ['Administrador', 'Administradora'],
  Auditor: ['Auditor', 'Auditora'],
  Firmante: ['Firmante', 'Firmante'],
};

/** Rol visible; usa la forma femenina si el cargo está en femenino («Auditora de campo» → «Administradora»). */
export function rolVisible(rol: Rol | null | undefined, cargo?: string | null): string {
  if (!rol) return '';
  const primera = (cargo ?? '').trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  const femenino = /(ora|era|ada|ica)$/.test(primera);
  return ROLES[rol][femenino ? 1 : 0];
}
