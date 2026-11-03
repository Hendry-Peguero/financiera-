import type { Pagina, Rol } from './types';

/** Gestión de usuarios (solo Administrador): GET/POST /admin/usuarios, PUT …/{id}/rol, POST …/{id}/activar|desactivar. */
export interface UsuarioAdminDto {
  id: string;
  correo: string;
  nombreCompleto: string;
  cargo: string | null;
  rol: Rol;
  activo: boolean;
  tieneFirma: boolean;
  perfilCompleto: boolean;
  /** Registrado por un administrador y todavía no ha entrado. */
  pendienteIngreso: boolean;
  creadoEn: string;
  ultimoAcceso: string | null;
  /** Fiscalizaciones de las que es autor (sin las de la papelera). */
  registros: number;
  /** Es el administrador que mira la lista (no puede desactivarse ni quitarse el rol). */
  esUsted: boolean;
}

export type EstadoUsuarios = 'todos' | 'activos' | 'inactivos';

export type ClaveConteoUsuarios = EstadoUsuarios | 'pendientes' | Rol;

export interface PaginaUsuarios extends Pagina<UsuarioAdminDto> {
  conteos: Partial<Record<ClaveConteoUsuarios, number>>;
}

export interface FiltroUsuarios {
  texto?: string;
  rol?: Rol;
  estado?: EstadoUsuarios;
  pagina?: number;
  tamano?: number;
}

export interface NuevoUsuarioDto {
  correo: string;
  rol: Rol;
  nombreCompleto?: string | null;
}
