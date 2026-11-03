import Dexie, { type Table } from 'dexie';
import type { EventoUiDto, FiscalizacionDto } from '../api/types';

/** Borrador guardado en la tablet. */
export interface BorradorLocal {
  id: string;
  datos: FiscalizacionDto;
  /** ms epoch del último cambio local */
  actualizadoLocal: number;
  /** ms epoch de la última sincronización exitosa */
  sincronizadoEn: number | null;
  /** true si hay cambios locales que no se han enviado */
  pendiente: boolean;
  /** 'borrador' = PUT normal; 'correccion' = se envía con POST /corregir manualmente */
  modo: 'borrador' | 'correccion';
  /** mensaje de conflicto (409) si lo hubo */
  conflicto: string | null;
  /** `actual` del 409: versión vigente en el servidor, para «usar versión del servidor» */
  conflictoActual?: FiscalizacionDto | null;
  ultimoError: string | null;
  /** ms epoch: la última vez que el servidor devolvió guardado exactamente lo que se envió */
  confirmadoEn?: number | null;
  /** «Finalizar» sin red: 'pendiente' hasta que el servidor lo confirme; 'confirmado' = finalizado y verificado */
  finalizar?: 'pendiente' | 'confirmado' | null;
  /** ms epoch de la finalización confirmada (se borra de la tablet DIAS_CONSERVAR días después) */
  finalizadoEn?: number | null;
}

export interface FotoLocal {
  id: string;
  fiscalizacionId: string;
  orden: number;
  descripcion: string;
  blob: Blob;
  tamanoBytes: number;
  tomadaEn: number;
  /** id en el servidor una vez subida (el mismo id local: el servidor lo respeta) */
  servidorId: string | null;
  /** huella SHA-256 del archivo; el servidor rechaza la foto si no coincide */
  sha256?: string | null;
}

export type TipoTareaSync = 'put' | 'foto' | 'borrar-foto' | 'finalizar';

export interface TareaSync {
  /** clave única: put:{id}, foto:{fotoId}, borrar-foto:{fiscId}:{fotoServidorId}, finalizar:{id} */
  clave: string;
  tipo: TipoTareaSync;
  fiscalizacionId: string;
  refId: string | null;
  creadoEn: number;
  intentos: number;
  ultimoError: string | null;
}

export interface EventoUiLocal extends EventoUiDto {
  seq?: number;
}

export interface CacheEntrada {
  clave: string;
  valor: unknown;
  guardadoEn: number;
}

export class FiscalizacionDb extends Dexie {
  borradores!: Table<BorradorLocal, string>;
  fotos!: Table<FotoLocal, string>;
  cola!: Table<TareaSync, string>;
  eventosUi!: Table<EventoUiLocal, number>;
  cache!: Table<CacheEntrada, string>;

  constructor(nombre = 'fiscalizacion-egehid') {
    super(nombre);
    this.version(1).stores({
      borradores: 'id, actualizadoLocal, pendiente',
      fotos: 'id, fiscalizacionId, [fiscalizacionId+orden]',
      cola: 'clave, tipo, fiscalizacionId, creadoEn',
      eventosUi: '++seq, idCliente, momento',
      cache: 'clave',
    });
  }
}

export const db = new FiscalizacionDb();

export async function leerCache<T>(clave: string): Promise<T | undefined> {
  const e = await db.cache.get(clave);
  return e?.valor as T | undefined;
}

export async function escribirCache(clave: string, valor: unknown) {
  await db.cache.put({ clave, valor, guardadoEn: Date.now() });
}
