import { ApiError, RedError } from '../api/client';
import type { FiscalizacionDto, FotoDto } from '../api/types';
import type { BorradorLocal, FotoLocal, TareaSync } from '../db/db';
import { aCuerpoPut, camposServidor, normalizar } from '../domain/fiscalizacion';
import { diferencias, exigirRegistro, RespuestaNoConfiable, sha256 } from './confirmacion';

/** Persistencia que necesita la cola (Dexie en la app; memoria en pruebas). */
export interface AlmacenSync {
  tareas(): Promise<TareaSync[]>;
  guardarTarea(t: TareaSync): Promise<void>;
  borrarTarea(clave: string): Promise<void>;
  borrador(id: string): Promise<BorradorLocal | undefined>;
  guardarBorrador(b: BorradorLocal): Promise<void>;
  foto(id: string): Promise<FotoLocal | undefined>;
  guardarFoto(f: FotoLocal): Promise<void>;
}

/** Operaciones remotas. */
export interface RemotoSync {
  /** true solo si responde ESTA API (GET /salud con su marca); un portal de Wi-Fi o un proxy dan false */
  salud(): Promise<boolean>;
  put(id: string, cuerpo: ReturnType<typeof aCuerpoPut>): Promise<FiscalizacionDto>;
  /** sube con el id local y la huella: el servidor no duplica en un reintento y rechaza un archivo incompleto */
  subirFoto(fiscalizacionId: string, foto: FotoLocal, sha256: string): Promise<FotoDto>;
  borrarFoto(fiscalizacionId: string, fotoServidorId: string): Promise<void>;
  finalizar(id: string): Promise<FiscalizacionDto>;
  obtener(id: string): Promise<FiscalizacionDto>;
}

export interface ResultadoSync {
  enviadas: number;
  /** registros finalizados y verificados en esta pasada */
  finalizados: string[];
  conflictos: string[];
  errores: string[];
  /** true si se detuvo por falta de red */
  sinRed: boolean;
}

export const claveput = (id: string) => `put:${id}`;
export const claveFoto = (fotoId: string) => `foto:${fotoId}`;
export const claveBorrarFoto = (fiscId: string, servidorId: string) => `borrar-foto:${fiscId}:${servidorId}`;
export const claveFinalizar = (id: string) => `finalizar:${id}`;

/** Encola (o reemplaza) el PUT de una fiscalización. Una sola tarea por fiscalización. */
export async function encolarPut(almacen: AlmacenSync, fiscalizacionId: string, ahora = Date.now()) {
  const existentes = await almacen.tareas();
  const previa = existentes.find((t) => t.clave === claveput(fiscalizacionId));
  await almacen.guardarTarea({
    clave: claveput(fiscalizacionId),
    tipo: 'put',
    fiscalizacionId,
    refId: null,
    creadoEn: previa?.creadoEn ?? ahora,
    intentos: previa?.intentos ?? 0,
    ultimoError: null,
  });
}

export async function encolarFoto(almacen: AlmacenSync, foto: FotoLocal, ahora = Date.now()) {
  await almacen.guardarTarea({
    clave: claveFoto(foto.id),
    tipo: 'foto',
    fiscalizacionId: foto.fiscalizacionId,
    refId: foto.id,
    creadoEn: ahora,
    intentos: 0,
    ultimoError: null,
  });
}

export async function encolarBorrarFoto(almacen: AlmacenSync, fiscId: string, servidorId: string, ahora = Date.now()) {
  await almacen.guardarTarea({
    clave: claveBorrarFoto(fiscId, servidorId),
    tipo: 'borrar-foto',
    fiscalizacionId: fiscId,
    refId: servidorId,
    creadoEn: ahora,
    intentos: 0,
    ultimoError: null,
  });
}

/** «Finalizar» en cola: se envía cuando el registro y sus fotos ya están confirmados en el servidor. */
export async function encolarFinalizar(almacen: AlmacenSync, fiscalizacionId: string, ahora = Date.now()) {
  const previa = (await almacen.tareas()).find((t) => t.clave === claveFinalizar(fiscalizacionId));
  await almacen.guardarTarea({
    clave: claveFinalizar(fiscalizacionId),
    tipo: 'finalizar',
    fiscalizacionId,
    refId: null,
    creadoEn: previa?.creadoEn ?? ahora,
    intentos: previa?.intentos ?? 0,
    ultimoError: null,
  });
}

function mensaje(e: unknown): string {
  if (e instanceof ApiError) return e.mensajes.join(' ');
  return (e as Error)?.message ?? String(e);
}

/**
 * Procesa la cola en orden de creación. Nada se da por enviado (ni se saca de la cola) sin confirmación:
 * - Antes de empezar: GET /salud debe responder ESTA API; si no (sin red, portal de Wi-Fi, proxy) no se envía nada.
 * - PUT: lee el borrador MÁS RECIENTE al momento de enviar. La respuesta debe ser este registro y traer guardado
 *   lo que se envió (campo por campo); si no, la tarea queda para reintentar. Guarda rowVersion/numero/estado sin
 *   pisar cambios locales hechos mientras tanto.
 * - 409 → marca conflicto en el borrador y saca la tarea (no se reintenta a ciegas).
 * - Error de red o respuesta no confiable → se detiene y conserva todo.
 * - Fotos: solo después de que la fiscalización exista en el servidor; van con su id y su huella SHA-256, y la
 *   respuesta debe devolver los dos iguales.
 * - Finalizar: cuando el registro está confirmado y sin fotos pendientes; después se vuelve a leer el registro del
 *   servidor y debe estar finalizado. Si el servidor lo rechaza (400/409), queda como borrador con el motivo.
 */
export async function procesarCola(
  almacen: AlmacenSync,
  remoto: RemotoSync,
  ahora: () => number = Date.now,
): Promise<ResultadoSync> {
  const r: ResultadoSync = { enviadas: 0, finalizados: [], conflictos: [], errores: [], sinRed: false };
  const tareas = (await almacen.tareas()).sort((a, b) => a.creadoEn - b.creadoEn);
  if (!tareas.length) return r;
  if (!(await remoto.salud().catch(() => false))) {
    r.sinRed = true;
    return r;
  }
  const putsFallidos = new Set<string>();
  /** registros con algo todavía sin confirmar en esta pasada (no se finalizan) */
  const sinConfirmar = new Set<string>();

  for (const t of tareas) {
    try {
      if (t.tipo === 'put') {
        const b = await almacen.borrador(t.fiscalizacionId);
        if (!b || b.modo === 'correccion' || b.conflicto) {
          // las correcciones se envían a mano (POST /corregir); con conflicto se espera la decisión del usuario
          await almacen.borrarTarea(t.clave);
          continue;
        }
        const enviadoEn = b.actualizadoLocal;
        const cuerpo = aCuerpoPut(b.datos);
        const dto = exigirRegistro(await remoto.put(b.id, cuerpo), b.id);
        const distintos = diferencias(cuerpo, dto);
        const actual = await almacen.borrador(b.id);
        if (!actual) {
          // se eliminó en la tablet mientras se enviaba: no se vuelve a crear
          await almacen.borrarTarea(t.clave);
          continue;
        }
        const cambiosMientras = actual.actualizadoLocal > enviadoEn;
        const confirmado = distintos.length === 0;
        const msg = confirmado ? null : `El servidor no guardó igual: ${distintos.slice(0, 3).join(', ')}. Se reintentará.`;
        await almacen.guardarBorrador({
          ...actual,
          // rowVersion devuelto = el que se debe enviar en el próximo PUT
          datos: { ...actual.datos, ...camposServidor(dto) },
          sincronizadoEn: ahora(),
          confirmadoEn: confirmado ? ahora() : (actual.confirmadoEn ?? null),
          pendiente: cambiosMientras || !confirmado,
          conflicto: null,
          conflictoActual: null,
          ultimoError: msg,
        });
        if (confirmado && !cambiosMientras) await almacen.borrarTarea(t.clave);
        else sinConfirmar.add(b.id);
        if (msg) {
          r.errores.push(msg);
          await almacen.guardarTarea({ ...t, intentos: t.intentos + 1, ultimoError: msg });
        }
        r.enviadas++;
      } else if (t.tipo === 'foto') {
        const b = await almacen.borrador(t.fiscalizacionId);
        if (putsFallidos.has(t.fiscalizacionId) || (b && b.sincronizadoEn == null)) {
          // la fiscalización aún no existe en el servidor
          continue;
        }
        const f = t.refId ? await almacen.foto(t.refId) : undefined;
        if (!f || f.servidorId) {
          await almacen.borrarTarea(t.clave);
          continue;
        }
        sinConfirmar.add(t.fiscalizacionId);
        const huella = f.sha256 ?? (await sha256(f.blob));
        if (!f.sha256) await almacen.guardarFoto({ ...f, sha256: huella });
        const dto = await remoto.subirFoto(t.fiscalizacionId, { ...f, sha256: huella }, huella);
        if (!dto || dto.id !== f.id || dto.sha256 !== huella) throw new RespuestaNoConfiable('la foto no volvió con el mismo id y huella');
        await almacen.guardarFoto({ ...f, sha256: huella, servidorId: dto.id });
        await almacen.borrarTarea(t.clave);
        sinConfirmar.delete(t.fiscalizacionId);
        r.enviadas++;
      } else if (t.tipo === 'borrar-foto') {
        if (t.refId) await remoto.borrarFoto(t.fiscalizacionId, t.refId);
        await almacen.borrarTarea(t.clave);
        r.enviadas++;
      } else if (t.tipo === 'finalizar') {
        const b = await almacen.borrador(t.fiscalizacionId);
        if (!b || b.modo === 'correccion') {
          await almacen.borrarTarea(t.clave);
          continue;
        }
        // espera a que el registro y todas sus fotos estén confirmados (puede quedar para la próxima pasada)
        const otras = (await almacen.tareas()).some((x) => x.fiscalizacionId === t.fiscalizacionId && x.tipo !== 'finalizar');
        if (b.conflicto || b.pendiente || !b.confirmadoEn || otras || sinConfirmar.has(b.id) || putsFallidos.has(b.id)) continue;
        const fin = exigirRegistro(await remoto.finalizar(b.id), b.id);
        if (fin.estado === 'Borrador') throw new RespuestaNoConfiable('el registro sigue como borrador');
        // segunda confirmación: se vuelve a leer del servidor
        const leido = exigirRegistro(await remoto.obtener(b.id), b.id);
        if (leido.estado === 'Borrador') throw new RespuestaNoConfiable('al leerlo de nuevo sigue como borrador');
        const vigente = await almacen.borrador(b.id);
        if (!vigente) {
          await almacen.borrarTarea(t.clave);
          continue;
        }
        await almacen.guardarBorrador({
          ...vigente,
          datos: normalizar(leido),
          sincronizadoEn: ahora(),
          confirmadoEn: ahora(),
          finalizar: 'confirmado',
          finalizadoEn: ahora(),
          pendiente: false,
          ultimoError: null,
        });
        await almacen.borrarTarea(t.clave);
        r.finalizados.push(b.id);
        r.enviadas++;
      }
    } catch (e) {
      if (e instanceof RedError || e instanceof RespuestaNoConfiable || e instanceof SyntaxError) {
        // sin red, o algo respondió que no es la API (p. ej. HTML de un portal): se detiene y no borra nada
        r.sinRed = true;
        if (!(e instanceof RedError)) {
          const msg = mensaje(e);
          r.errores.push(msg);
          await almacen.guardarTarea({ ...t, intentos: t.intentos + 1, ultimoError: msg });
        }
        break;
      }
      if (e instanceof ApiError && t.tipo === 'finalizar' && (e.status === 400 || e.status === 409)) {
        // el servidor no lo acepta como finalizado (pendientes, ya no es borrador…): vuelve a ser borrador con el motivo
        const b = await almacen.borrador(t.fiscalizacionId);
        const msg = `No se pudo finalizar: ${mensaje(e)}`;
        if (b) await almacen.guardarBorrador({ ...b, finalizar: null, ultimoError: msg });
        await almacen.borrarTarea(t.clave);
        r.errores.push(msg);
        continue;
      }
      if (t.tipo === 'put') putsFallidos.add(t.fiscalizacionId);
      if (e instanceof ApiError && e.status === 409 && t.tipo === 'put') {
        const b = await almacen.borrador(t.fiscalizacionId);
        const actualServidor = (e.actual as FiscalizacionDto | null) ?? null;
        const msg = e.problema?.title || 'El registro cambió en el servidor o ya no es un borrador.';
        if (b) await almacen.guardarBorrador({ ...b, conflicto: msg, conflictoActual: actualServidor });
        await almacen.borrarTarea(t.clave);
        r.conflictos.push(t.fiscalizacionId);
        continue;
      }
      if (e instanceof ApiError && e.status === 404 && t.tipo === 'borrar-foto') {
        await almacen.borrarTarea(t.clave);
        continue;
      }
      const msg = mensaje(e);
      r.errores.push(msg);
      await almacen.guardarTarea({ ...t, intentos: t.intentos + 1, ultimoError: msg });
      if (t.tipo === 'put') {
        const b = await almacen.borrador(t.fiscalizacionId);
        if (b) await almacen.guardarBorrador({ ...b, ultimoError: msg });
      }
    }
  }
  return r;
}
