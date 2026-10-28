import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { api, ApiError } from './client';
import { conCache } from './hooks';
import type { CampoPlantillaDto, EncabezadoPlantillaDto, PlantillaDto, PlantillaResumenDto } from './tiposPlantillas';

/** Plantillas de formularios (fase 3): consultas y acciones. Los tipos están en tiposPlantillas.ts. */
export type * from './tiposPlantillas';

const noReintentar = (n: number, e: unknown) => !(e instanceof ApiError && [400, 401, 403, 404, 409].includes(e.status)) && n < 2;

export function usePlantillas(habilitado = true) {
  return useQuery({
    queryKey: ['plantillas'],
    enabled: habilitado,
    queryFn: () => conCache('plantillas', () => api.get<PlantillaResumenDto[]>('/plantillas')),
    retry: noReintentar,
  });
}

/** Detalle: sin `version` trae el borrador (Administrador) o la publicada vigente. */
export function usePlantilla(id: number | undefined, version?: number) {
  return useQuery({
    queryKey: ['plantilla', id, version ?? null],
    enabled: id !== undefined,
    queryFn: () =>
      conCache(`plantilla:${id}:${version ?? ''}`, () => api.get<PlantillaDto>(`/plantillas/${id}`, { version })),
    retry: noReintentar,
  });
}

/** PDF base de una versión (lo dibuja pdf.js en el editor). */
export function usePdfPlantilla(id: number, version: number, habilitado: boolean) {
  return useQuery({
    queryKey: ['plantilla-pdf', id, version],
    enabled: habilitado,
    queryFn: async () => new Uint8Array(await (await api.blob(`/plantillas/${id}/versiones/${version}/pdf`)).arrayBuffer()),
    staleTime: Infinity,
    retry: noReintentar,
  });
}

/** Cuerpo de PUT /plantillas/{id}/borrador. */
export interface GuardarBorradorDto {
  nombre?: string | null;
  campos: CampoPlantillaDto[];
}

/**
 * Acciones del Administrador. Cada una deja la plantilla devuelta en la caché del detalle y vuelve a pedir la lista.
 * Necesitan red (las plantillas no se editan sin conexión).
 */
export function useAccionesPlantilla() {
  const qc = useQueryClient();
  const aplicar = useCallback(
    (p: PlantillaDto | undefined) => {
      if (p) qc.setQueryData(['plantilla', p.id, null], p);
      void qc.invalidateQueries({ queryKey: ['plantillas'] });
      return p;
    },
    [qc],
  );
  return {
    crear: useCallback(async (nombre: string) => aplicar(await api.post<PlantillaDto>('/plantillas', { nombre }))!, [aplicar]),
    importar: useCallback(
      async (archivo: File, nombre?: string) => {
        const fd = new FormData();
        fd.append('archivo', archivo, archivo.name);
        if (nombre) fd.append('nombre', nombre);
        return aplicar(await api.form<PlantillaDto>('/plantillas/importar', fd))!;
      },
      [aplicar],
    ),
    reemplazarPdf: useCallback(
      async (id: number, archivo: File) => {
        const fd = new FormData();
        fd.append('archivo', archivo, archivo.name);
        const p = aplicar(await api.form<PlantillaDto>(`/plantillas/${id}/borrador/pdf`, fd))!;
        void qc.invalidateQueries({ queryKey: ['plantilla-pdf', id] });
        return p;
      },
      [aplicar, qc],
    ),
    duplicar: useCallback(
      async (id: number, nombre?: string) => aplicar(await api.post<PlantillaDto>(`/plantillas/${id}/duplicar`, { nombre: nombre ?? null }))!,
      [aplicar],
    ),
    guardarBorrador: useCallback(
      async (id: number, dto: GuardarBorradorDto) => aplicar(await api.put<PlantillaDto>(`/plantillas/${id}/borrador`, dto))!,
      [aplicar],
    ),
    /** Devuelve undefined si la plantilla nunca se publicó y quedó eliminada. */
    descartarBorrador: useCallback(
      async (id: number) => {
        const p = await api.del(`/plantillas/${id}/borrador`).then((r) => r as unknown as PlantillaDto | undefined);
        if (!p) qc.removeQueries({ queryKey: ['plantilla', id] });
        return aplicar(p);
      },
      [aplicar, qc],
    ),
    /** Código, versión y fechas del documento (también en la oficial). */
    guardarEncabezado: useCallback(
      async (id: number, dto: EncabezadoPlantillaDto) => aplicar(await api.put<PlantillaDto>(`/plantillas/${id}/encabezado`, dto))!,
      [aplicar],
    ),
    publicar: useCallback(async (id: number) => aplicar(await api.post<PlantillaDto>(`/plantillas/${id}/publicar`))!, [aplicar]),
    desactivar: useCallback(async (id: number) => aplicar(await api.post<PlantillaDto>(`/plantillas/${id}/desactivar`))!, [aplicar]),
    activar: useCallback(async (id: number) => aplicar(await api.post<PlantillaDto>(`/plantillas/${id}/activar`))!, [aplicar]),
  };
}
