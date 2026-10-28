import { ApiError } from '../api/client';
import type { Rol } from '../api/types';
import type { UsuarioAdminDto } from '../api/usuarios';
import { aFecha, fecha } from '../domain/format';

/** Roles y lo que permite cada uno (texto de ayuda de «Registrar usuario» y del menú). */
export const ROLES: { rol: Rol; texto: string; descripcion: string }[] = [
  { rol: 'Auditor', texto: 'Auditor', descripcion: 'Registra, firma y finaliza fiscalizaciones.' },
  { rol: 'Firmante', texto: 'Firmante', descripcion: 'Firma los formularios a los que le dan acceso.' },
  { rol: 'Administrador', texto: 'Administrador', descripcion: 'Además gestiona usuarios, plantillas, versiones y papelera.' },
];

export type AccionUsuario = { tipo: 'rol'; rol: Rol } | { tipo: 'activar' } | { tipo: 'desactivar' };

export interface OpcionAccion {
  accion: AccionUsuario;
  texto: string;
  peligro?: boolean;
  /** Motivo por el que no se permite (se muestra deshabilitada). */
  bloqueo?: string;
}

/**
 * Acciones del menú de una fila. Mismas reglas que la API: el administrador no se desactiva ni se quita el rol
 * (la API además impide dejar el sistema sin administradores activos).
 */
export function accionesUsuario(u: Pick<UsuarioAdminDto, 'rol' | 'activo' | 'esUsted'>): OpcionAccion[] {
  const propia = u.esUsted ? 'Es su cuenta' : undefined;
  const roles: OpcionAccion[] = ROLES.filter((r) => r.rol !== u.rol).map((r) => ({
    accion: { tipo: 'rol', rol: r.rol },
    texto: `Cambiar a ${r.texto}`,
    bloqueo: u.rol === 'Administrador' ? propia : undefined,
  }));
  return [
    ...roles,
    u.activo
      ? { accion: { tipo: 'desactivar' }, texto: 'Desactivar usuario', peligro: true, bloqueo: propia }
      : { accion: { tipo: 'activar' }, texto: 'Activar usuario' },
  ];
}

/** Pregunta de confirmación antes de aplicar la acción (null = no hace falta). */
export function confirmacion(u: Pick<UsuarioAdminDto, 'nombreCompleto' | 'correo' | 'rol'>, a: AccionUsuario): string | null {
  const quien = nombreUsuario(u);
  if (a.tipo === 'desactivar') return `¿Desactivar a ${quien}? No podrá entrar a la aplicación hasta que lo active de nuevo.`;
  if (a.tipo === 'rol' && (a.rol === 'Administrador' || u.rol === 'Administrador'))
    return `¿Cambiar el rol de ${quien} a ${a.rol}?`;
  return null;
}

/** Mensaje después de aplicar la acción. */
export function mensajeHecho(u: Pick<UsuarioAdminDto, 'nombreCompleto' | 'correo'>, a: AccionUsuario): string {
  const quien = nombreUsuario(u);
  if (a.tipo === 'activar') return `${quien} está activo de nuevo.`;
  if (a.tipo === 'desactivar') return `${quien} quedó desactivado.`;
  return `${quien} ahora es ${a.rol}.`;
}

/** Nombre o, si todavía no completó el perfil, el correo. */
export function nombreUsuario(u: Pick<UsuarioAdminDto, 'nombreCompleto' | 'correo'>): string {
  return u.nombreCompleto.trim() || u.correo;
}

/** Chip de estado: Desactivado / Pendiente de ingreso / Perfil incompleto / Activo. */
export function estadoUsuario(u: Pick<UsuarioAdminDto, 'activo' | 'pendienteIngreso' | 'perfilCompleto'>): { texto: string; clase: string } {
  if (!u.activo) return { texto: 'Desactivado', clase: 'b-error' };
  if (u.pendienteIngreso) return { texto: 'Pendiente de ingreso', clase: 'b-warn' };
  if (!u.perfilCompleto) return { texto: 'Perfil incompleto', clase: 'b-info' };
  return { texto: 'Activo', clase: 'b-ok' };
}

/** «Hoy 08:40», «Ayer 17:05», «12/10/2026» o «Nunca». */
export function ultimoAcceso(iso: string | null | undefined, ahora = new Date()): string {
  if (!iso) return 'Nunca';
  const d = aFecha(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((dia(ahora) - dia(d)) / 86_400_000);
  const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (dias === 0) return `Hoy ${hora}`;
  if (dias === 1) return `Ayer ${hora}`;
  const p = (x: number) => String(x).padStart(2, '0');
  return fecha(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
}

/** Mismo criterio que la API (ReglasUsuarios.NormalizarCorreo). */
export function correoValido(correo: string): boolean {
  const c = correo.trim();
  return c.length <= 256 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c);
}

/** La API responde 403 «Usuario desactivado.» a cualquier petición de un usuario desactivado. */
export function esUsuarioDesactivado(e: unknown): boolean {
  return e instanceof ApiError && e.status === 403 && /desactivado/i.test(e.problema?.title ?? '');
}
