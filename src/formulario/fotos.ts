import { useCallback, useEffect, useState } from 'react';
import { db, type FotoLocal } from '../db/db';
import { sincronizador } from '../offline/sync';

export const MAX_FOTOS = 20;

export function useFotosLocales(fiscalizacionId: string) {
  const [fotos, setFotos] = useState<FotoLocal[]>([]);
  const leer = useCallback(
    () =>
      db.fotos
        .where('fiscalizacionId')
        .equals(fiscalizacionId)
        .sortBy('orden')
        .then(setFotos)
        .catch(() => {}),
    [fiscalizacionId],
  );
  useEffect(() => {
    void leer();
    return sincronizador.suscribir(() => void leer());
  }, [leer]);
  return { fotos, leer };
}

