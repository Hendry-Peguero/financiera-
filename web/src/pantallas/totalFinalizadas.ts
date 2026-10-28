import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { PaginaFiscalizaciones } from '../api/types';

/** Último total de fiscalizaciones finalizadas conocido en esta tablet (se muestra en el ingreso). */
export const CLAVE_TOTAL_FINALIZADAS = 'fisc.totalFinalizadas';

export function leerTotalFinalizadas(): number | null {
  try {
    const v = localStorage.getItem(CLAVE_TOTAL_FINALIZADAS);
    const n = v == null ? NaN : Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** Finalizadas = registros que pasaron por «Finalizar» (incluye los corregidos). */
export function totalFinalizadasDe(conteos: PaginaFiscalizaciones['conteos'] | undefined): number | null {
  if (!conteos || conteos.Finalizado == null) return null;
  return (conteos.Finalizado ?? 0) + (conteos.Modificado ?? 0) + (conteos.EdicionPendiente ?? 0);
}

export function guardarTotalFinalizadas(n: number | null) {
  if (n == null) return;
  try {
    localStorage.setItem(CLAVE_TOTAL_FINALIZADAS, String(n));
  } catch {
    /* sin almacenamiento */
  }
}

/**
 * Recuerda el total cada vez que llega una respuesta de GET /fiscalizaciones (trae `conteos`).
 * Basta montarlo una vez dentro del QueryClientProvider.
 */
export function useRecordarTotalFinalizadas() {
  const qc = useQueryClient();
  useEffect(() => {
    return qc.getQueryCache().subscribe((ev) => {
      if (ev.type !== 'updated' || ev.query.queryKey[0] !== 'fiscalizaciones') return;
      const d = ev.query.state.data as PaginaFiscalizaciones | undefined;
      guardarTotalFinalizadas(totalFinalizadasDe(d?.conteos));
    });
  }, [qc]);
}
