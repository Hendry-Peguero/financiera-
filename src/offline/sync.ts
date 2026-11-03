import { api, ApiError, RedError, solicitar } from '../api/client';
import type { FiscalizacionDto, FotoDto } from '../api/types';
import { db, type BorradorLocal, type FotoLocal } from '../db/db';
import { camposServidor, fusionarEditable, normalizar } from '../domain/fiscalizacion';
import {
  encolarBorrarFoto,
  encolarFinalizar,
  encolarFoto,
  encolarPut,
  procesarCola,
  type AlmacenSync,
  type RemotoSync,
  type ResultadoSync,
} from './colaSync';
import { DIAS_CONSERVAR, esSaludDeLaApi } from './confirmacion';

export const almacenSyncDexie: AlmacenSync = {
  tareas: () => db.cola.toArray(),
  guardarTarea: async (t) => void (await db.cola.put(t)),
  borrarTarea: (clave) => db.cola.delete(clave),
  borrador: (id) => db.borradores.get(id),
  guardarBorrador: async (b) => void (await db.borradores.put(b)),
  foto: (id) => db.fotos.get(id),
  guardarFoto: async (f) => void (await db.fotos.put(f)),
};

export const remotoApi: RemotoSync = {
  // 6 s como máximo: con una Wi-Fi «falsa» la petición puede quedarse colgada
  salud: async () => esSaludDeLaApi(await solicitar<unknown>('/salud', { signal: AbortSignal.timeout(6000) })),
  put: (id, cuerpo) => api.put<FiscalizacionDto>(`/fiscalizaciones/${id}`, cuerpo),
  subirFoto: (fiscId, f, sha256) => {
    const fd = new FormData();
    fd.append('archivo', f.blob, `foto-${f.orden}.jpg`);
    fd.append('descripcion', f.descripcion ?? '');
    fd.append('orden', String(f.orden));
    fd.append('id', f.id);
    fd.append('sha256', sha256);
    return api.form<FotoDto>(`/fiscalizaciones/${fiscId}/fotos`, fd);
  },
  borrarFoto: (fiscId, servidorId) => api.del(`/fiscalizaciones/${fiscId}/fotos/${servidorId}`),
  finalizar: (id) => api.post<FiscalizacionDto>(`/fiscalizaciones/${id}/finalizar`),
  obtener: (id) => api.get<FiscalizacionDto>(`/fiscalizaciones/${id}`),
};

/**
 * Borra de la tablet los registros finalizados y CONFIRMADOS por el servidor hace más de DIAS_CONSERVAR días (con
 * sus fotos). Nada sin confirmar se borra nunca.
 */
export async function purgarConfirmados(ahora = Date.now()): Promise<number> {
  const limite = ahora - DIAS_CONSERVAR * 24 * 60 * 60 * 1000;
  const viejos = (await db.borradores.toArray()).filter(
    (b) => b.finalizar === 'confirmado' && b.finalizadoEn != null && b.finalizadoEn < limite && !b.pendiente,
  );
  for (const b of viejos) {
    if ((await db.cola.where('fiscalizacionId').equals(b.id).count()) > 0) continue;
    await db.fotos.where('fiscalizacionId').equals(b.id).delete();
    await db.borradores.delete(b.id);
  }
  return viejos.length;
}

/**
 * «Finalizar» desde la tablet, con o sin red: queda en cola y el sincronizador lo envía cuando el registro y sus
 * fotos estén confirmados en el servidor.
 */
export async function encolarFinalizacion(id: string) {
  const b = await db.borradores.get(id);
  if (!b) return;
  await db.borradores.put({ ...b, finalizar: 'pendiente', ultimoError: null });
  await encolarPut(almacenSyncDexie, id);
  await encolarFinalizar(almacenSyncDexie, id);
  sincronizador.emitir();
}

type Oyente = () => void;

/** Orquesta la sincronización: al guardar, al volver la red y cada 30 s. */
class Sincronizador {
  private oyentes = new Set<Oyente>();
  private corriendo: Promise<ResultadoSync> | null = null;
  habilitado = false;
  ultimo: ResultadoSync | null = null;
  pendientes = 0;
  private timer: number | null = null;

  suscribir(fn: Oyente) {
    this.oyentes.add(fn);
    return () => void this.oyentes.delete(fn);
  }
  emitir() {
    this.oyentes.forEach((f) => f());
  }

  async actualizarConteo() {
    this.pendientes = await db.cola.count();
    this.emitir();
  }

  iniciar() {
    if (this.timer != null) return;
    this.habilitado = true;
    window.addEventListener('online', this.alVolverRed);
    this.timer = window.setInterval(() => void this.sincronizar(), 30_000);
    void this.sincronizar();
  }

  detener() {
    this.habilitado = false;
    window.removeEventListener('online', this.alVolverRed);
    if (this.timer != null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private alVolverRed = () => void this.sincronizar();

  sincronizar(): Promise<ResultadoSync | null> {
    if (!this.habilitado || !navigator.onLine) {
      void this.actualizarConteo();
      return Promise.resolve(null);
    }
    if (this.corriendo) return this.corriendo;
    this.corriendo = purgarConfirmados()
      .catch(() => 0)
      .then(() => procesarCola(almacenSyncDexie, remotoApi))
      .then((r) => {
        this.ultimo = r;
        return r;
      })
      .finally(() => {
        this.corriendo = null;
        void this.actualizarConteo();
      });
    return this.corriendo;
  }
}

export const sincronizador = new Sincronizador();

// ---------- Borradores ----------

export async function crearBorradorLocal(datos: FiscalizacionDto): Promise<BorradorLocal> {
  const b: BorradorLocal = {
    id: datos.id,
    datos,
    actualizadoLocal: Date.now(),
    sincronizadoEn: null,
    pendiente: true,
    modo: 'borrador',
    conflicto: null,
    conflictoActual: null,
    ultimoError: null,
  };
  await db.borradores.put(b);
  await encolarPut(almacenSyncDexie, datos.id);
  void sincronizador.sincronizar();
  return b;
}

/**
 * Guarda en IndexedDB y encola el PUT (si no es una corrección ni hay conflicto).
 * Los campos que solo cambia el servidor (rowVersion, número, firmas, fotos…) se toman de lo guardado,
 * nunca del estado de la pantalla, para respetar el rowVersion vigente.
 */
export async function guardarBorradorLocal(datos: FiscalizacionDto): Promise<BorradorLocal> {
  const previo = await db.borradores.get(datos.id);
  const b: BorradorLocal = {
    id: datos.id,
    datos: previo ? fusionarEditable(previo.datos, datos) : datos,
    actualizadoLocal: Date.now(),
    sincronizadoEn: previo?.sincronizadoEn ?? null,
    pendiente: true,
    modo: previo?.modo ?? 'borrador',
    conflicto: previo?.conflicto ?? null,
    conflictoActual: previo?.conflictoActual ?? null,
    ultimoError: previo?.ultimoError ?? null,
  };
  await db.borradores.put(b);
  if (b.modo === 'borrador' && !b.conflicto) {
    await encolarPut(almacenSyncDexie, datos.id);
    void sincronizador.sincronizar();
  }
  return b;
}

/** Copia del servidor a la tablet (al abrir un registro que no estaba localmente). */
export async function importarDelServidor(dto: FiscalizacionDto, modo: BorradorLocal['modo'] = 'borrador') {
  const b: BorradorLocal = {
    id: dto.id,
    datos: normalizar(dto),
    actualizadoLocal: Date.now(),
    sincronizadoEn: Date.now(),
    pendiente: false,
    modo,
    conflicto: null,
    conflictoActual: null,
    ultimoError: null,
  };
  await db.borradores.put(b);
  return b;
}

/** Tras un conflicto: descarta lo local y recarga el servidor. */
export async function descartarLocal(id: string) {
  await db.borradores.delete(id);
  await db.cola.where('fiscalizacionId').equals(id).delete();
}

/** Conflicto 409 → «Usar versión del servidor»: reemplaza lo local por `actual`. */
export async function usarVersionServidor(id: string): Promise<BorradorLocal | null> {
  const b = await db.borradores.get(id);
  if (!b?.conflictoActual) return null;
  const actual = b.conflictoActual;
  const nuevo: BorradorLocal = {
    ...b,
    datos: normalizar(actual),
    actualizadoLocal: Date.now(),
    sincronizadoEn: Date.now(),
    pendiente: false,
    modo: actual.estado === 'Borrador' ? 'borrador' : b.modo,
    conflicto: null,
    conflictoActual: null,
    ultimoError: null,
  };
  await db.borradores.put(nuevo);
  await db.cola.delete(`put:${id}`);
  sincronizador.emitir();
  return nuevo;
}

/** Conflicto 409 → «Conservar mis cambios»: reenvía con el rowVersion vigente (solo si sigue en Borrador). */
export async function conservarMisCambios(id: string) {
  const b = await db.borradores.get(id);
  const actual = b?.conflictoActual;
  if (!b || !actual || actual.estado !== 'Borrador') return;
  await db.borradores.put({
    ...b,
    datos: { ...b.datos, ...camposServidor(actual), rowVersion: actual.rowVersion },
    conflicto: null,
    conflictoActual: null,
  });
  await encolarPut(almacenSyncDexie, id);
  void sincronizador.sincronizar();
}

/** Aplica la respuesta del servidor (firmas, rowVersion, pendientes…) sin pisar los datos editables locales. */
export async function aplicarRespuestaServidor(dto: FiscalizacionDto) {
  const b = await db.borradores.get(dto.id);
  if (!b) return;
  await db.borradores.put({ ...b, datos: { ...b.datos, ...camposServidor(dto) }, sincronizadoEn: Date.now() });
  sincronizador.emitir();
}

// ---------- Fotos ----------

export async function agregarFotoLocal(fiscalizacionId: string, blob: Blob, descripcion = ''): Promise<FotoLocal> {
  const existentes = await db.fotos.where('fiscalizacionId').equals(fiscalizacionId).toArray();
  const orden = existentes.reduce((m, f) => Math.max(m, f.orden), 0) + 1;
  const f: FotoLocal = {
    id: crypto.randomUUID(),
    fiscalizacionId,
    orden,
    descripcion,
    blob,
    tamanoBytes: blob.size,
    tomadaEn: Date.now(),
    servidorId: null,
  };
  await db.fotos.put(f);
  await encolarFoto(almacenSyncDexie, f);
  void sincronizador.sincronizar();
  return f;
}

export async function borrarFotoLocal(foto: FotoLocal) {
  await db.fotos.delete(foto.id);
  await db.cola.delete(`foto:${foto.id}`);
  if (foto.servidorId) {
    await encolarBorrarFoto(almacenSyncDexie, foto.fiscalizacionId, foto.servidorId);
    void sincronizador.sincronizar();
  }
}

export async function borrarFotoServidor(fiscalizacionId: string, servidorId: string) {
  const b = await db.borradores.get(fiscalizacionId);
  if (b) await db.borradores.put({ ...b, datos: { ...b.datos, fotos: (b.datos.fotos ?? []).filter((f) => f.id !== servidorId) } });
  sincronizador.emitir();
  await encolarBorrarFoto(almacenSyncDexie, fiscalizacionId, servidorId);
  void sincronizador.sincronizar();
}

export async function actualizarDescripcionFoto(fotoId: string, descripcion: string) {
  const f = await db.fotos.get(fotoId);
  if (f && !f.servidorId) await db.fotos.put({ ...f, descripcion });
}

/**
 * Antes de una acción en línea (firmar, finalizar, corregir): envía lo pendiente y confirma que el
 * borrador existe en el servidor con los últimos cambios. Devuelve un mensaje de error o null.
 */
export async function asegurarSincronizado(id: string): Promise<string | null> {
  if (!navigator.onLine) return 'Sin conexión: esta acción necesita red.';
  const b = await db.borradores.get(id);
  if (!b) return null;
  if (b.modo === 'correccion') return null;
  for (let i = 0; i < 3; i++) {
    const x = await db.borradores.get(id);
    if (!x || x.conflicto || (!x.pendiente && x.sincronizadoEn != null)) break;
    await encolarPut(almacenSyncDexie, id);
    const r = await sincronizador.sincronizar();
    if (r?.sinRed) break;
  }
  const d = await db.borradores.get(id);
  if (d?.conflicto) return `Conflicto: ${d.conflicto}`;
  if (!d || d.sincronizadoEn == null || d.pendiente) return d?.ultimoError ?? 'No se pudo sincronizar el borrador.';
  return null;
}

/**
 * Elimina un borrador (lo pide su autor o el Administrador): primero saca de la cola todo lo pendiente de enviar,
 * luego lo manda a la papelera del servidor (si ya estaba allí; el Administrador puede restaurarlo) y al final borra
 * la copia de la tablet con sus fotos. Un borrador que nunca llegó al servidor se elimina aunque no haya red.
 */
export async function eliminarBorrador(id: string): Promise<void> {
  const b = await db.borradores.get(id);
  const soloLocal = !!b && b.sincronizadoEn == null;
  await db.cola.where('fiscalizacionId').equals(id).delete();
  try {
    await api.del(`/fiscalizaciones/${id}`);
  } catch (e) {
    const noEstaba = e instanceof ApiError && e.status === 404;
    if (!noEstaba && !(soloLocal && e instanceof RedError)) {
      // no se pudo borrar en el servidor: lo local queda como estaba (se vuelve a encolar el envío)
      if (b && b.pendiente) await encolarPut(almacenSyncDexie, id);
      if (e instanceof RedError) throw new Error('Sin conexión: este borrador ya está en el servidor; elimínelo cuando haya red.', { cause: e });
      throw e;
    }
  }
  await db.fotos.where('fiscalizacionId').equals(id).delete();
  await db.borradores.delete(id);
  sincronizador.emitir();
  void sincronizador.actualizarConteo();
}
