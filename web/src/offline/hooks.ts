import { useEffect, useState, useSyncExternalStore } from 'react';
import { db, type BorradorLocal } from '../db/db';
import { sincronizador } from './sync';

function suscribirRed(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

export function useEnLinea(): boolean {
  return useSyncExternalStore(
    suscribirRed,
    () => navigator.onLine,
    () => true,
  );
}

export function useSincronizador() {
  const [, forzar] = useState(0);
  useEffect(() => sincronizador.suscribir(() => forzar((n) => n + 1)), []);
  return { pendientes: sincronizador.pendientes, ultimo: sincronizador.ultimo, sincronizar: () => sincronizador.sincronizar() };
}

/** Re-render periódico (para "hace N s"). */
export function useTic(ms = 1000) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setAhora(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return ahora;
}

/** Borradores guardados en esta tablet (se refresca con cada sincronización). */
export function useBorradoresLocales() {
  const [lista, setLista] = useState<BorradorLocal[]>([]);
  useEffect(() => {
    let vivo = true;
    const leer = () =>
      void db.borradores
        .toArray()
        .then((l) => vivo && setLista(l.sort((a, b) => b.actualizadoLocal - a.actualizadoLocal)))
        .catch(() => {});
    leer();
    const quitar = sincronizador.suscribir(leer);
    return () => {
      vivo = false;
      quitar();
    };
  }, []);
  return lista;
}
