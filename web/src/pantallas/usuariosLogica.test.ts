import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/client';
import type { UsuarioAdminDto } from '../api/usuarios';
import { itemsNav } from '../ui/nav';
import { accionesUsuario, confirmacion, correoValido, esUsuarioDesactivado, estadoUsuario, mensajeHecho, nombreUsuario, ultimoAcceso } from './usuariosLogica';

function u(p: Partial<UsuarioAdminDto> = {}): UsuarioAdminDto {
  return {
    id: 'u1',
    correo: 'ana.perez@egehid.gob.do',
    nombreCompleto: 'Ana Pérez',
    cargo: 'Auditora',
    rol: 'Auditor',
    activo: true,
    tieneFirma: true,
    perfilCompleto: true,
    pendienteIngreso: false,
    creadoEn: '2026-10-01T12:00:00Z',
    ultimoAcceso: null,
    registros: 0,
    esUsted: false,
    ...p,
  };
}

describe('menú «Usuarios»', () => {
  it('solo el administrador lo ve, en ADMINISTRACIÓN', () => {
    const base = { esPropietarioBitacora: false };
    expect(itemsNav({ ...base, rol: 'Auditor' }).some((i) => i.ruta === '/usuarios')).toBe(false);
    expect(itemsNav({ ...base, rol: 'Firmante' }).some((i) => i.ruta === '/usuarios')).toBe(false);
    const item = itemsNav({ ...base, rol: 'Administrador' }).find((i) => i.ruta === '/usuarios');
    expect(item).toMatchObject({ texto: 'Usuarios', seccion: 'ADMINISTRACIÓN', icono: 'users' });
    expect(item?.sinRiel).toBeFalsy();
  });
});

describe('acciones de un usuario', () => {
  it('a otro usuario: los otros dos roles y desactivar', () => {
    const a = accionesUsuario(u());
    expect(a.map((x) => x.texto)).toEqual(['Cambiar a Firmante', 'Cambiar a Administrador', 'Desactivar usuario']);
    expect(a.every((x) => !x.bloqueo)).toBe(true);
    expect(a.at(-1)?.peligro).toBe(true);
  });

  it('desactivado: activar en lugar de desactivar', () => {
    expect(accionesUsuario(u({ activo: false })).at(-1)).toMatchObject({ accion: { tipo: 'activar' }, texto: 'Activar usuario' });
  });

  it('el administrador no se quita el rol ni se desactiva', () => {
    const a = accionesUsuario(u({ rol: 'Administrador', esUsted: true }));
    expect(a.map((x) => [x.texto, x.bloqueo])).toEqual([
      ['Cambiar a Auditor', 'Es su cuenta'],
      ['Cambiar a Firmante', 'Es su cuenta'],
      ['Desactivar usuario', 'Es su cuenta'],
    ]);
  });

  it('confirma desactivar y los cambios que tocan al administrador', () => {
    expect(confirmacion(u(), { tipo: 'desactivar' })).toMatch(/^¿Desactivar a Ana Pérez\? No podrá entrar/);
    expect(confirmacion(u(), { tipo: 'rol', rol: 'Administrador' })).toBe('¿Cambiar el rol de Ana Pérez a Administrador?');
    expect(confirmacion(u({ rol: 'Administrador' }), { tipo: 'rol', rol: 'Auditor' })).toBe('¿Cambiar el rol de Ana Pérez a Auditor?');
    expect(confirmacion(u(), { tipo: 'rol', rol: 'Firmante' })).toBeNull();
    expect(confirmacion(u(), { tipo: 'activar' })).toBeNull();
  });

  it('mensajes y nombre (el correo si no completó el perfil)', () => {
    expect(nombreUsuario(u({ nombreCompleto: '  ' }))).toBe('ana.perez@egehid.gob.do');
    expect(mensajeHecho(u(), { tipo: 'rol', rol: 'Firmante' })).toBe('Ana Pérez ahora es Firmante.');
    expect(mensajeHecho(u(), { tipo: 'desactivar' })).toBe('Ana Pérez quedó desactivado.');
    expect(mensajeHecho(u(), { tipo: 'activar' })).toBe('Ana Pérez está activo de nuevo.');
  });
});

describe('estado y último acceso', () => {
  it('chip de estado', () => {
    expect(estadoUsuario(u({ activo: false, pendienteIngreso: true }))).toEqual({ texto: 'Desactivado', clase: 'b-error' });
    expect(estadoUsuario(u({ pendienteIngreso: true, perfilCompleto: false }))).toEqual({ texto: 'Pendiente de ingreso', clase: 'b-warn' });
    expect(estadoUsuario(u({ perfilCompleto: false }))).toEqual({ texto: 'Perfil incompleto', clase: 'b-info' });
    expect(estadoUsuario(u())).toEqual({ texto: 'Activo', clase: 'b-ok' });
  });

  it('último acceso relativo al día local', () => {
    const ahora = new Date(2026, 9, 20, 10, 47);
    expect(ultimoAcceso(null, ahora)).toBe('Nunca');
    expect(ultimoAcceso(new Date(2026, 9, 20, 8, 5).toISOString(), ahora)).toBe('Hoy 08:05');
    expect(ultimoAcceso(new Date(2026, 9, 19, 17, 30).toISOString(), ahora)).toBe('Ayer 17:30');
    expect(ultimoAcceso(new Date(2026, 9, 12, 9, 0).toISOString(), ahora)).toBe('12/10/2026');
  });
});

describe('validaciones', () => {
  it('correo como la API', () => {
    expect(correoValido(' pedro@egehid.gob.do ')).toBe(true);
    expect(correoValido('pedro@egehid')).toBe(false);
    expect(correoValido('pedro egehid.gob.do')).toBe(false);
    expect(correoValido('')).toBe(false);
  });

  it('reconoce el 403 de usuario desactivado', () => {
    expect(esUsuarioDesactivado(new ApiError(403, { title: 'Usuario desactivado.' }))).toBe(true);
    expect(esUsuarioDesactivado(new ApiError(403, { title: 'Prohibido' }))).toBe(false);
    expect(esUsuarioDesactivado(new ApiError(401, { title: 'Usuario desactivado.' }))).toBe(false);
    expect(esUsuarioDesactivado(new Error('x'))).toBe(false);
  });
});
