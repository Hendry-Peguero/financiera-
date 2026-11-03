import type { FiscalizacionDto, FiscalizacionPut } from '../api/types';

/**
 * Confirmación de envío: la tablet solo da algo por enviado cuando la respuesta es de la API (no de un portal de
 * Wi-Fi ni de un proxy) y lo que el servidor guardó coincide con lo que se mandó. Hasta entonces nada se borra.
 */

/** La respuesta no prueba que el servidor guardó los datos (HTML de un portal, JSON ajeno, otro registro…). */
export class RespuestaNoConfiable extends Error {
  constructor(motivo: string) {
    super(`Respuesta no confirmada por el servidor: ${motivo}`);
    this.name = 'RespuestaNoConfiable';
  }
}

/** Nombre que devuelve GET /api/salud (ServicioSalud.Nombre en la API). */
export const SERVICIO_API = 'fiscalizacion-egehid';

export function esSaludDeLaApi(x: unknown): boolean {
  return typeof x === 'object' && x !== null && (x as { servicio?: unknown }).servicio === SERVICIO_API;
}

/** Es una FiscalizacionDto de ESTE registro. */
export function exigirRegistro(x: unknown, id: string): FiscalizacionDto {
  const d = x as Partial<FiscalizacionDto> | null | undefined;
  if (!d || typeof d !== 'object') throw new RespuestaNoConfiable('la respuesta está vacía o no es un registro');
  if (d.id !== id) throw new RespuestaNoConfiable('la respuesta es de otro registro');
  if (typeof d.estado !== 'string' || typeof d.numero !== 'string' || !d.visita || !d.suplidor || !d.mediciones)
    throw new RespuestaNoConfiable('a la respuesta le faltan datos del registro');
  return d as FiscalizacionDto;
}

// ---- comparación de lo enviado con lo guardado ----

/** Igual que la API (Texto.Limpiar): sin espacios a los lados y vacío = null. */
const texto = (s: string | null | undefined) => (s == null || s.trim() === '' ? null : s.trim());
/** «07:15», «07:15:00» → «07:15». */
const hora = (h: string | null | undefined) => (h ? h.slice(0, 5) : null);
/** Las columnas guardan 2 decimales (4 el precio): basta con coincidir a la centésima. */
const mismoNumero = (a: number | null | undefined, b: number | null | undefined) =>
  a == null || b == null ? a == null && b == null : Math.abs(a - b) < 0.006;

/**
 * Diferencias entre lo enviado y lo que el servidor devolvió como guardado (campo por campo, con las mismas
 * normalizaciones de la API). Lista vacía = coincide.
 */
export function diferencias(enviado: FiscalizacionPut, guardado: FiscalizacionDto): string[] {
  const d: string[] = [];
  const t = (campo: string, a: string | null | undefined, b: string | null | undefined) => texto(a) !== texto(b) && d.push(campo);
  const n = (campo: string, a: number | null | undefined, b: number | null | undefined) => !mismoNumero(a, b) && d.push(campo);
  const v = enviado.visita;
  const gv = guardado.visita;
  if (v) {
    t('visita.fecha', v.fecha, gv.fecha?.slice(0, 10));
    for (const k of ['horaSalida', 'inicioProceso', 'horaLlegada', 'finProceso'] as const) t(`visita.${k}`, hora(v[k]), hora(gv[k]));
    if ((v.locacionId ?? null) !== (gv.locacionId ?? null)) d.push('visita.locacionId');
  }
  const s = enviado.suplidor;
  const gs = guardado.suplidor;
  if (s) {
    for (const k of ['fichaCamion', 'chofer', 'placa', 'conduce'] as const) t(`suplidor.${k}`, s[k], gs[k]);
    // con nombre (texto libre) el servidor elige el suplidorId: se compara el nombre
    if (texto(s.nombre)) t('suplidor.nombre', s.nombre, gs.nombre);
    else if ((s.suplidorId ?? null) !== (gs.suplidorId ?? null)) d.push('suplidor.suplidorId');
    n('suplidor.totalEntregarGal', s.totalEntregarGal, gs.totalEntregarGal);
  }
  const e = enviado.empresa;
  const ge = guardado.empresa;
  if (e) {
    for (const k of ['fichaCamion1', 'chofer1', 'fichaCamion2', 'chofer2', 'responsable'] as const) t(`empresa.${k}`, e[k], ge[k]);
    n('empresa.totalRecibirGal', e.totalRecibirGal, ge.totalRecibirGal);
  }
  const m = enviado.mediciones;
  const gm = guardado.mediciones;
  if (m) {
    if ((m.productoId ?? null) !== (gm.productoId ?? null)) d.push('mediciones.productoId');
    n('mediciones.galonesProveedor', m.galonesProveedor, gm.galonesProveedor);
    n('mediciones.galonesEgehid', m.galonesEgehid, gm.galonesEgehid);
    n('mediciones.precioGalon', m.precioGalon, gm.precioGalon);
    for (const l of m.lecturas ?? []) {
      const g = gm.lecturas?.find((x) => x.equipo === l.equipo);
      n(`lecturas.${l.equipo}.inicial`, l.inicial, g?.inicial);
      n(`lecturas.${l.equipo}.final`, l.final, g?.final);
    }
    if (m.vara) {
      t('vara.inicialMedida', m.vara.inicialMedida, gm.vara?.inicialMedida);
      t('vara.finalMedida', m.vara.finalMedida, gm.vara?.finalMedida);
      n('vara.inicialGalones', m.vara.inicialGalones, gm.vara?.inicialGalones);
      n('vara.finalGalones', m.vara.finalGalones, gm.vara?.finalGalones);
    }
  }
  for (const c of enviado.controles ?? []) {
    const g = guardado.controles?.find((x) => x.numero === c.numero);
    if ((c.respuesta ?? null) !== (g?.respuesta ?? null)) d.push(`control.${c.numero}`);
    t(`control.${c.numero}.observacion`, c.observacion, g?.observacion);
  }
  if (enviado.observacionesGenerales !== undefined) t('observacionesGenerales', enviado.observacionesGenerales, guardado.observacionesGenerales);
  return d;
}

/** Huella SHA-256 (hex en minúsculas) de un archivo, igual que la API. */
export async function sha256(blob: Blob): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Días que la tablet conserva un registro finalizado y confirmado antes de borrarlo. */
export const DIAS_CONSERVAR = 30;
