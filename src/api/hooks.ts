import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSesion } from '../auth/contexto';
import { escribirCache, leerCache } from '../db/db';
import { CATALOGOS_VACIOS } from '../domain/fiscalizacion';
import { api, ApiError } from './client';
import type {
  BitacoraApiDto,
  BitacoraCambioDto,
  BitacoraUiDto,
  CatalogosDto,
  EstadisticasDto,
  FiscalizacionDto,
  Pagina,
  PaginaFiscalizaciones,
  ResumenInicioDto,
  SolicitudFirmaDto,
  UsuarioBusquedaDto,
  UsuarioDto,
  VersionDto,
} from './types';

/** Pide al servidor y guarda en IndexedDB; si falla por red, devuelve lo guardado. */
export async function conCache<T>(clave: string, pedir: () => Promise<T>): Promise<T> {
  try {
    const v = await pedir();
    await escribirCache(clave, v).catch(() => {});
    return v;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    const guardado = await leerCache<T>(clave).catch(() => undefined);
    if (guardado !== undefined) return guardado;
    throw e;
  }
}

const sinReintentoAuth = (n: number, e: unknown) =>
  !(e instanceof ApiError && [400, 401, 403, 404, 409].includes(e.status)) && n < 2;

export function useMe() {
  const s = useSesion();
  return useQuery({
    queryKey: ['me', s.correo],
    enabled: s.estado === 'autenticado',
    queryFn: () => conCache(`me:${s.correo ?? ''}`, () => api.get<UsuarioDto>('/me')),
    staleTime: 60_000,
    retry: sinReintentoAuth,
  });
}

export function useCatalogos() {
  const s = useSesion();
  return useQuery({
    queryKey: ['catalogos'],
    enabled: s.estado === 'autenticado',
    queryFn: () => conCache('catalogos', () => api.get<CatalogosDto>('/catalogos')),
    staleTime: 10 * 60_000,
    placeholderData: CATALOGOS_VACIOS,
  });
}

export function useResumenInicio() {
  return useQuery({
    queryKey: ['inicio'],
    queryFn: () => conCache('inicio', () => api.get<ResumenInicioDto>('/inicio/resumen')),
    retry: sinReintentoAuth,
  });
}

export interface FiltroFiscalizaciones {
  estado?: string;
  enPapelera?: boolean;
  desde?: string;
  hasta?: string;
  locacionId?: number | string;
  suplidorId?: number | string;
  autorId?: string;
  texto?: string;
  pagina?: number;
  tamano?: number;
}

export function useFiscalizaciones(f: FiltroFiscalizaciones) {
  return useQuery({
    queryKey: ['fiscalizaciones', f],
    queryFn: () => api.get<PaginaFiscalizaciones>('/fiscalizaciones', { ...f, enPapelera: f.enPapelera || undefined }),
    placeholderData: keepPreviousData,
    retry: sinReintentoAuth,
  });
}

export function useFiscalizacion(id: string | undefined) {
  return useQuery({
    queryKey: ['fiscalizacion', id],
    enabled: !!id,
    queryFn: () => conCache(`fisc:${id}`, () => api.get<FiscalizacionDto>(`/fiscalizaciones/${id}`)),
    retry: sinReintentoAuth,
  });
}

export function useVersiones(id: string | undefined, habilitado: boolean) {
  return useQuery({
    queryKey: ['versiones', id],
    enabled: !!id && habilitado,
    queryFn: () => api.get<VersionDto[]>(`/fiscalizaciones/${id}/versiones`),
    retry: sinReintentoAuth,
  });
}

export interface FiltroEstadisticas {
  desde?: string;
  hasta?: string;
  locacionId?: number | string;
  agrupar?: 'dia' | 'semana' | 'mes';
}

export function useEstadisticas(f: FiltroEstadisticas) {
  return useQuery({
    queryKey: ['estadisticas', f],
    queryFn: () => api.get<EstadisticasDto>('/estadisticas', { ...f }),
    placeholderData: keepPreviousData,
    retry: sinReintentoAuth,
  });
}

export function useSolicitudesMias(habilitado = true) {
  return useQuery({
    queryKey: ['solicitudes-mias'],
    enabled: habilitado,
    queryFn: () => api.get<SolicitudFirmaDto[]>('/solicitudes-firma/mias'),
    staleTime: 30_000,
    retry: sinReintentoAuth,
  });
}

export function useUsuarios(texto: string) {
  return useQuery({
    queryKey: ['usuarios', texto],
    queryFn: () => api.get<UsuarioBusquedaDto[]>('/usuarios', { texto }),
    retry: sinReintentoAuth,
  });
}

export type TipoBitacora = 'ui' | 'api' | 'cambios';
export interface FiltroBitacora {
  desde?: string;
  hasta?: string;
  usuario?: string;
  tipo?: string;
  texto?: string;
  pagina?: number;
  tamano?: number;
}
export type FilaBitacora<T extends TipoBitacora> = T extends 'ui'
  ? BitacoraUiDto
  : T extends 'api'
    ? BitacoraApiDto
    : BitacoraCambioDto;

export function useBitacora<T extends TipoBitacora>(tipo: T, f: FiltroBitacora, habilitado: boolean) {
  return useQuery({
    queryKey: ['bitacora', tipo, f],
    enabled: habilitado,
    queryFn: () => api.get<Pagina<FilaBitacora<T>>>(`/bitacora/${tipo}`, { ...f }),
    // conserva la página anterior solo dentro de la misma pestaña (las filas cambian de forma entre pestañas)
    placeholderData: (previo, consulta) => (consulta?.queryKey[1] === tipo ? previo : undefined),
    retry: sinReintentoAuth,
  });
}
