import type { UsuarioAdminDto } from '../../../src/api/tiposUsuarios';
import { ID_USUARIO, MARIA } from './base';

/**
 * GET /admin/usuarios (pantalla «Usuarios», que no está en el diseño): personas que aparecen en las pantallas del
 * diseño. La prueba visual solo la usa para «Usuarios» en Mi cuenta (móvil) y para las capturas de la pantalla.
 */
const fila = (
  n: number,
  correo: string,
  nombreCompleto: string,
  cargo: string | null,
  rol: UsuarioAdminDto['rol'],
  ultimoAcceso: string | null,
  registros: number,
  extra: Partial<UsuarioAdminDto> = {},
): UsuarioAdminDto => ({
  id: `${String(n).repeat(8)}-0000-4000-8000-00000000000${n}`.slice(0, 36),
  correo,
  nombreCompleto,
  cargo,
  rol,
  activo: true,
  tieneFirma: !!cargo,
  perfilCompleto: !!nombreCompleto && !!cargo,
  pendienteIngreso: false,
  creadoEn: '2026-08-04T13:00:00Z',
  ultimoAcceso,
  registros,
  esUsted: false,
  ...extra,
});

export const USUARIOS_ADMIN: UsuarioAdminDto[] = [
  fila(1, 'ana.perez@hidroelectrica.gov.do', 'Ana Lucía Pérez', 'Auditora de campo', 'Auditor', '2026-10-20T12:15:00Z', 31),
  fila(2, 'carlos.mendez@hidroelectrica.gov.do', 'Carlos Méndez', 'Encargado de combustibles', 'Firmante', '2026-10-17T19:40:00Z', 0),
  fila(3, 'jose.guzman@hidroelectrica.gov.do', 'José M. Guzmán', 'Auditor de campo', 'Auditor', '2026-10-19T21:05:00Z', 27),
  { ...fila(4, MARIA.correo, MARIA.nombreCompleto, MARIA.cargo, 'Administrador', '2026-10-20T14:40:00Z', 46), id: ID_USUARIO, esUsted: true },
  fila(5, 'pedro.almonte@hidroelectrica.gov.do', 'Pedro Almonte', 'Supervisor de combustibles', 'Firmante', '2026-10-14T15:20:00Z', 0),
  fila(6, 'rosa.castillo@hidroelectrica.gov.do', 'Rosa Castillo', 'Auditora UAI', 'Auditor', null, 0, { perfilCompleto: false, cargo: null, tieneFirma: false }),
  fila(7, 'l.feliz@hidroelectrica.gov.do', '', null, 'Auditor', null, 0, { pendienteIngreso: true, creadoEn: '2026-10-18T13:00:00Z' }),
  fila(8, 'ramon.pena@hidroelectrica.gov.do', 'Ramón Antonio Peña', 'Auditor de campo', 'Auditor', '2026-07-30T13:10:00Z', 12, { activo: false }),
];

/** Misma lógica de filtros y conteos que la API (ServicioAdminUsuarios.ListarAsync). */
export function respuestaUsuarios(q: URLSearchParams) {
  const t = (q.get('texto') ?? '').toLowerCase();
  const rol = q.get('rol');
  let items = USUARIOS_ADMIN.filter(
    (u) => (!t || `${u.nombreCompleto} ${u.correo} ${u.cargo ?? ''}`.toLowerCase().includes(t)) && (!rol || u.rol === rol),
  );
  const conteos = {
    todos: items.length,
    activos: items.filter((u) => u.activo).length,
    inactivos: items.filter((u) => !u.activo).length,
    pendientes: items.filter((u) => u.pendienteIngreso).length,
    Administrador: USUARIOS_ADMIN.filter((u) => u.rol === 'Administrador').length,
    Auditor: USUARIOS_ADMIN.filter((u) => u.rol === 'Auditor').length,
    Firmante: USUARIOS_ADMIN.filter((u) => u.rol === 'Firmante').length,
  };
  if (q.get('estado') === 'activos') items = items.filter((u) => u.activo);
  if (q.get('estado') === 'inactivos') items = items.filter((u) => !u.activo);
  const pagina = Number(q.get('pagina') ?? 1);
  const tamano = Number(q.get('tamano') ?? 20);
  return { items: items.slice((pagina - 1) * tamano, pagina * tamano), total: items.length, pagina, tamano, conteos };
}
