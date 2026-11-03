import { ApiError, RedError } from '../api/client';

export function mensajeError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 403) return 'No tiene permiso para ver esto.';
    if (e.status === 404) return 'No encontrado.';
    return e.mensajes.join(' ');
  }
  if (e instanceof RedError) return 'Sin conexión con el servidor.';
  // mensaje ya armado (p. ej. el error guardado en el estado de una pantalla)
  if (typeof e === 'string' && e) return e;
  return (e as Error)?.message ?? 'Error inesperado.';
}

