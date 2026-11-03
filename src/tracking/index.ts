import { api } from '../api/client';
import type { EventoUiDto } from '../api/types';
import { db } from '../db/db';
import { Rastreador, type AlmacenEventos } from './rastreador';

export const almacenDexie: AlmacenEventos = {
  async agregar(e) {
    await db.eventosUi.add({ ...e });
  },
  contar: () => db.eventosUi.count(),
  async tomar(n) {
    const filas = await db.eventosUi.orderBy('seq').limit(n).toArray();
    return filas.map(({ seq, ...evento }) => ({ clave: seq as number, evento: evento as EventoUiDto }));
  },
  async borrar(claves) {
    await db.eventosUi.bulkDelete(claves);
  },
};

let sesionActiva = false;

/** La sesión indica si ya se puede enviar (hay usuario autenticado). */
export function marcarSesionRastreo(activa: boolean) {
  sesionActiva = activa;
  if (activa) void rastreador.vaciar();
}

export const rastreador = new Rastreador({
  almacen: almacenDexie,
  enviar: (eventos) => api.post<void>('/bitacora/ui', { eventos }),
  puedeEnviar: () => sesionActiva && navigator.onLine,
});
