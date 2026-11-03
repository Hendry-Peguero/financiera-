import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, RedError } from '../api/client';
import type { FiscalizacionDto } from '../api/types';
import { db, type BorradorLocal } from '../db/db';
import { camposServidor, normalizar } from '../domain/fiscalizacion';
import { guardarBorradorLocal, importarDelServidor, sincronizador } from '../offline/sync';

export type EstadoCarga = 'cargando' | 'listo' | 'no-encontrado' | 'solo-lectura' | 'error';

export type MetaBorrador = Omit<BorradorLocal, 'datos'>;

export const RETARDO_AUTOGUARDADO = 500;

function meta(b: BorradorLocal): MetaBorrador {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { datos, ...resto } = b;
  return resto;
}

/**
 * Estado del formulario: carga desde IndexedDB (o del servidor la primera vez), guarda en la tablet
 * con 500 ms de espera tras cada cambio y refleja lo que devuelve la sincronización (rowVersion, firmas…).
 */
export function useBorrador(id: string) {
  const [datos, setDatos] = useState<FiscalizacionDto | null>(null);
  const [info, setInfo] = useState<MetaBorrador | null>(null);
  const [estado, setEstado] = useState<EstadoCarga>('cargando');
  const [error, setError] = useState<string | null>(null);
  const ultimo = useRef<FiscalizacionDto | null>(null);
  const temporizador = useRef<number | null>(null);
  const porGuardar = useRef(false);

  const guardarYa = useCallback(async () => {
    if (temporizador.current != null) window.clearTimeout(temporizador.current);
    temporizador.current = null;
    if (!porGuardar.current || !ultimo.current) return;
    porGuardar.current = false;
    const b = await guardarBorradorLocal(ultimo.current);
    setInfo(meta(b));
  }, []);

  // Carga inicial
  useEffect(() => {
    let vivo = true;
    (async () => {
      const local = await db.borradores.get(id);
      if (local) {
        if (!vivo) return;
        ultimo.current = normalizar(local.datos);
        setDatos(ultimo.current);
        setInfo(meta(local));
        setEstado('listo');
        return;
      }
      try {
        const dto = await api.get<FiscalizacionDto>(`/fiscalizaciones/${id}`);
        if (!vivo) return;
        if (dto.estado !== 'Borrador' || dto.enPapelera) {
          setEstado('solo-lectura');
          return;
        }
        const b = await importarDelServidor(dto);
        if (!vivo) return;
        ultimo.current = b.datos;
        setDatos(b.datos);
        setInfo(meta(b));
        setEstado('listo');
      } catch (e) {
        if (!vivo) return;
        if (e instanceof ApiError && (e.status === 404 || e.status === 403)) setEstado('no-encontrado');
        else {
          setError(e instanceof RedError ? 'Sin conexión y este registro no está guardado en la tablet.' : (e as Error).message);
          setEstado('error');
        }
      }
    })();
    return () => {
      vivo = false;
    };
  }, [id]);

  // Cambios que vienen del servidor (sincronización, firmas, conflicto)
  useEffect(() => {
    return sincronizador.suscribir(() => {
      void db.borradores.get(id).then((b) => {
        if (!b) return;
        setInfo(meta(b));
        if (!ultimo.current) return;
        ultimo.current = { ...ultimo.current, ...camposServidor(b.datos) };
        setDatos(ultimo.current);
      });
    });
  }, [id]);

  // Al salir de la pantalla, ocultar la app o cerrar la pestaña: guardar lo pendiente sin esperar los 500 ms
  useEffect(() => {
    const alOcultar = () => {
      if (document.visibilityState === 'hidden') void guardarYa();
    };
    const alSalir = () => void guardarYa();
    window.addEventListener('pagehide', alSalir);
    window.addEventListener('beforeunload', alSalir);
    document.addEventListener('visibilitychange', alOcultar);
    return () => {
      window.removeEventListener('pagehide', alSalir);
      window.removeEventListener('beforeunload', alSalir);
      document.removeEventListener('visibilitychange', alOcultar);
      void guardarYa();
    };
  }, [guardarYa]);

  const actualizar = useCallback(
    (fn: (d: FiscalizacionDto) => FiscalizacionDto) => {
      if (!ultimo.current) return;
      ultimo.current = fn(ultimo.current);
      setDatos(ultimo.current);
      porGuardar.current = true;
      if (temporizador.current != null) window.clearTimeout(temporizador.current);
      temporizador.current = window.setTimeout(() => void guardarYa(), RETARDO_AUTOGUARDADO);
    },
    [guardarYa],
  );

  /** Vuelve a leer todo (p. ej. tras «usar versión del servidor»). */
  const recargar = useCallback(async () => {
    const b = await db.borradores.get(id);
    if (!b) return;
    ultimo.current = normalizar(b.datos);
    setDatos(ultimo.current);
    setInfo(meta(b));
  }, [id]);

  return { datos, info, estado, error, actualizar, guardarYa, recargar };
}
