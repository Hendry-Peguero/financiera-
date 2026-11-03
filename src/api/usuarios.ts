import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { api, ApiError } from './client';
import type { Rol } from './types';
import type { FiltroUsuarios, NuevoUsuarioDto, PaginaUsuarios, UsuarioAdminDto } from './tiposUsuarios';

/** Gestión de usuarios (solo Administrador). Los tipos están en tiposUsuarios.ts (los usa también e2e). */
export type * from './tiposUsuarios';

const noReintentar = (n: number, e: unknown) => !(e instanceof ApiError && [400, 401, 403, 404, 409].includes(e.status)) && n < 2;

export function useUsuariosAdmin(f: FiltroUsuarios) {
  return useQuery({
    queryKey: ['admin-usuarios', f],
    queryFn: () =>
      api.get<PaginaUsuarios>('/admin/usuarios', {
        texto: f.texto,
        rol: f.rol,
        estado: f.estado === 'todos' ? undefined : f.estado,
        pagina: f.pagina,
        tamano: f.tamano,
      }),
    placeholderData: keepPreviousData,
    retry: noReintentar,
  });
}

/** Acciones: necesitan red; al terminar se vuelve a pedir la lista (conteos incluidos). */
export function useAccionesUsuarios() {
  const qc = useQueryClient();
  const listo = useCallback(
    async <T>(p: Promise<T>) => {
      const r = await p;
      await qc.invalidateQueries({ queryKey: ['admin-usuarios'] });
      // la lista de firmantes (Dar acceso) excluye a los desactivados
      void qc.invalidateQueries({ queryKey: ['usuarios'] });
      return r;
    },
    [qc],
  );
  return {
    registrar: (dto: NuevoUsuarioDto) => listo(api.post<UsuarioAdminDto>('/admin/usuarios', dto)),
    cambiarRol: (id: string, rol: Rol) => listo(api.put<UsuarioAdminDto>(`/admin/usuarios/${id}/rol`, { rol })),
    activar: (id: string) => listo(api.post<UsuarioAdminDto>(`/admin/usuarios/${id}/activar`)),
    desactivar: (id: string) => listo(api.post<UsuarioAdminDto>(`/admin/usuarios/${id}/desactivar`)),
  };
}
