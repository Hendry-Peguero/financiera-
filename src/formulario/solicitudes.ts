import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import type { RolFirma, SolicitudFirmaDto, SolicitudFirmaRegistroDto, UsuarioBusquedaDto } from '../api/types';
import { escribirCache, leerCache } from '../db/db';

/**
 * Solicitudes de firma de un registro (GET /fiscalizaciones/{id}/solicitudes-firma): «Acceso enviado» sale del
 * servidor, así se ve igual en cualquier tablet. Sin red se muestra el último estado guardado en esta tablet.
 */
export interface SolicitudesRegistro {
  lista: SolicitudFirmaRegistroDto[];
  /** La consulta falló por red: `lista` es el último estado conocido (o vacía si nunca se consultó). */
  sinConexion: boolean;
  /** Hay un estado guardado en la tablet (solo importa cuando `sinConexion`). */
  conocido: boolean;
}

export const claveSolicitudes = (id: string) => `solicitudes-firma:${id}`;

export async function pedirSolicitudes(id: string): Promise<SolicitudesRegistro> {
  try {
    const lista = await api.get<SolicitudFirmaRegistroDto[]>(`/fiscalizaciones/${id}/solicitudes-firma`);
    await escribirCache(claveSolicitudes(id), lista).catch(() => {});
    return { lista, sinConexion: false, conocido: true };
  } catch (e) {
    // 404: el borrador todavía no llegó al servidor, así que no puede tener solicitudes
    if (e instanceof ApiError && e.status === 404) return { lista: [], sinConexion: false, conocido: true };
    if (e instanceof ApiError) throw e;
    const guardada = await leerCache<SolicitudFirmaRegistroDto[]>(claveSolicitudes(id)).catch(() => undefined);
    return { lista: guardada ?? [], sinConexion: true, conocido: guardada !== undefined };
  }
}

export function useSolicitudesRegistro(id: string) {
  return useQuery({
    queryKey: ['solicitudes-registro', id],
    queryFn: () => pedirSolicitudes(id),
    staleTime: 30_000,
    retry: false,
  });
}

/** Tras «Dar acceso»: agrega la solicitud creada (con el nombre elegido) y vuelve a consultar al servidor. */
export function useAgregarSolicitud(id: string) {
  const qc = useQueryClient();
  return (sol: SolicitudFirmaDto, destino: UsuarioBusquedaDto) => {
    const nueva = desdeCreada(sol, destino);
    const clave = ['solicitudes-registro', id];
    const previa = qc.getQueryData<SolicitudesRegistro>(clave);
    const lista = conNueva(previa?.lista ?? [], nueva);
    qc.setQueryData<SolicitudesRegistro>(clave, { lista, sinConexion: false, conocido: true });
    void escribirCache(claveSolicitudes(id), lista).catch(() => {});
    void qc.invalidateQueries({ queryKey: clave });
  };
}

/** La respuesta del POST no trae el firmante: se completa con el usuario elegido en el diálogo. */
export function desdeCreada(sol: SolicitudFirmaDto, destino: UsuarioBusquedaDto): SolicitudFirmaRegistroDto {
  return {
    id: sol.id,
    rol: sol.rol,
    usuarioDestinoId: destino.id,
    firmante: destino.nombreCompleto,
    correoFirmante: '',
    solicitadaPor: sol.solicitadaPor,
    estado: sol.estado,
    comentario: null,
    creadaEn: sol.creadaEn,
    expiraEn: sol.expiraEn,
    firmadaEn: null,
  };
}

/** Como en la API: la nueva solicitud de un rol deja expiradas las pendientes anteriores de ese rol. */
export function conNueva(lista: SolicitudFirmaRegistroDto[], nueva: SolicitudFirmaRegistroDto): SolicitudFirmaRegistroDto[] {
  return [
    nueva,
    ...lista
      .filter((s) => s.id !== nueva.id)
      .map((s) => (s.rol === nueva.rol && s.estado === 'Pendiente' ? { ...s, estado: 'Expirada' as const } : s)),
  ];
}

/** La solicitud más reciente de cada rol. */
export function ultimaPorRol(lista: SolicitudFirmaRegistroDto[]): Map<RolFirma, SolicitudFirmaRegistroDto> {
  const m = new Map<RolFirma, SolicitudFirmaRegistroDto>();
  for (const s of lista) {
    const actual = m.get(s.rol);
    if (!actual || Date.parse(s.creadaEn) > Date.parse(actual.creadaEn)) m.set(s.rol, s);
  }
  return m;
}

export type EstadoAcceso = 'enviado' | 'rechazado' | 'vencido';

/**
 * Qué mostrar en la fila de un rol todavía sin firma según su última solicitud. Una pendiente guardada en la
 * tablet que ya pasó su vencimiento se muestra vencida aunque el servidor no lo haya dicho.
 */
export function estadoAcceso(sol: SolicitudFirmaRegistroDto | undefined, ahora = Date.now()): EstadoAcceso | null {
  if (!sol) return null;
  if (sol.estado === 'Pendiente') return Date.parse(sol.expiraEn) <= ahora ? 'vencido' : 'enviado';
  if (sol.estado === 'Rechazada') return 'rechazado';
  if (sol.estado === 'Expirada') return 'vencido';
  return null; // Firmada: la fila ya muestra la firma
}
