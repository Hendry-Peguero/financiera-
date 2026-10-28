import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { FiscalizacionDto } from '../api/types';
import { db } from '../db/db';
import { aCuerpoPut } from '../domain/fiscalizacion';
import { useEnLinea } from '../offline/hooks';
import { descartarLocal, encolarFinalizacion, importarDelServidor, sincronizador } from '../offline/sync';
import { mensajeError } from '../ui/errores';

export type Modo = 'borrador' | 'correccion';

async function limpiarLocal(id: string) {
  await descartarLocal(id);
  await db.fotos.where('fiscalizacionId').equals(id).delete();
}

/**
 * Finalizar (o guardar la corrección).
 * - Finalizar funciona con o sin red: queda en la cola de la tablet y se envía cuando el servidor esté disponible; el
 *   registro solo se da por finalizado cuando el servidor lo confirma (y lo vuelve a leer). La copia local NO se
 *   borra: queda DIAS_CONSERVAR días como respaldo.
 * - La corrección de un registro finalizado necesita red (POST /corregir).
 */
export function useFinalizar({
  datos,
  modo,
  guardarYa,
  recargar,
}: {
  datos: FiscalizacionDto | null;
  modo: Modo;
  guardarYa: () => Promise<void>;
  recargar: () => Promise<void>;
}) {
  const enLinea = useEnLinea();
  const navegar = useNavigate();
  const qc = useQueryClient();
  const [errores, setErrores] = useState<string[]>([]);
  const [conflicto, setConflicto] = useState<FiscalizacionDto | null>(null);
  const [enviando, setEnviando] = useState(false);
  /** «Finalizar» quedó en la cola de la tablet esperando al servidor */
  const [enEspera, setEnEspera] = useState(false);

  // al abrir el formulario: ¿ya había un «Finalizar» en espera para este registro?
  const id = datos?.id;
  useEffect(() => {
    if (!id) return;
    let vigente = true;
    void db.borradores.get(id).then((b) => vigente && setEnEspera(b?.finalizar === 'pendiente'));
    return () => {
      vigente = false;
    };
  }, [id]);

  const terminar = async (dto: FiscalizacionDto, conservarLocal = false) => {
    if (!conservarLocal) await limpiarLocal(dto.id);
    qc.setQueryData(['fiscalizacion', dto.id], dto);
    await qc.invalidateQueries({ queryKey: ['fiscalizaciones'] });
    await qc.invalidateQueries({ queryKey: ['inicio'] });
    navegar(`/fiscalizaciones/${dto.id}`, { replace: true });
  };

  const fallo = (e: unknown) => {
    if (e instanceof ApiError && e.status === 400 && Object.keys(e.errores).length) setErrores(Object.values(e.errores).flat());
    else setErrores([mensajeError(e)]);
    if (e instanceof ApiError && e.status === 409 && e.actual) setConflicto(e.actual as FiscalizacionDto);
  };

  const finalizar = async () => {
    if (!datos) return;
    setErrores([]);
    setEnviando(true);
    try {
      await guardarYa();
      await encolarFinalizacion(datos.id);
      // hasta 3 pasadas: registro → fotos → finalizar (cada una espera la confirmación de la anterior)
      for (let i = 0; i < 3; i++) {
        const r = await sincronizador.sincronizar();
        const b = await db.borradores.get(datos.id);
        if (b?.finalizar === 'confirmado') {
          await terminar(b.datos, true);
          return;
        }
        if (b?.finalizar !== 'pendiente') {
          // el servidor lo rechazó: vuelve a ser borrador con el motivo
          setEnEspera(false);
          setErrores([b?.ultimoError ?? 'No se pudo finalizar.']);
          return;
        }
        if (!r || r.sinRed || b.conflicto) break;
      }
      setEnEspera(true);
    } catch (e) {
      fallo(e);
    } finally {
      setEnviando(false);
    }
  };

  const corregir = async () => {
    if (!datos) return;
    setErrores([]);
    setConflicto(null);
    setEnviando(true);
    try {
      await guardarYa();
      const guardado = (await db.borradores.get(datos.id))?.datos ?? datos;
      const dto = await api.post<FiscalizacionDto>(`/fiscalizaciones/${datos.id}/corregir`, aCuerpoPut(guardado));
      await terminar(dto);
    } catch (e) {
      fallo(e);
    } finally {
      setEnviando(false);
    }
  };

  const usarServidor = async () => {
    if (!conflicto) return;
    await importarDelServidor(conflicto, modo);
    setConflicto(null);
    setErrores([]);
    await recargar();
  };

  return { enLinea, errores, conflicto, enviando, enEspera, finalizar, corregir, usarServidor };
}
