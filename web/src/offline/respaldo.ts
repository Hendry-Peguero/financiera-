import { db, type BorradorLocal, type FotoLocal, type TareaSync } from '../db/db';

/**
 * Respaldo cifrado (.fisc) de lo que vive solo en esta tablet: borradores, fotos sin subir y la cola de
 * sincronización. AES-GCM 256 con clave PBKDF2-SHA-256 derivada de la contraseña (mínimo 10 caracteres).
 * Recuperar solo agrega lo que falta y exige el mismo correo; nunca sobrescribe datos existentes.
 */
export const MIN_CONTRASENA = 10;
const ITERACIONES = 210_000;
const CLAVE_ULTIMO = 'fisc.ultimoRespaldo';

interface FotoSerializada extends Omit<FotoLocal, 'blob'> {
  tipo: string;
  base64: string;
}

interface Contenido {
  borradores: BorradorLocal[];
  fotos: FotoSerializada[];
  cola: TareaSync[];
}

export interface ArchivoFisc {
  formato: 'fisc';
  version: 1;
  correo: string;
  creadoEn: string;
  iteraciones: number;
  sal: string;
  iv: string;
  datos: string;
}

export interface ResumenLocal {
  borradores: number;
  fotos: number;
  pendientes: number;
  bytes: number;
}

export interface ResultadoRecuperacion {
  borradores: number;
  fotos: number;
  tareas: number;
  omitidos: number;
}

export class ErrorRespaldo extends Error {}

const b64 = (b: ArrayBuffer | Uint8Array) => {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function clave(contrasena: string, sal: Uint8Array, iteraciones: number, uso: KeyUsage) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(contrasena), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sal as BufferSource, iterations: iteraciones },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    [uso],
  );
}

export async function resumenLocal(): Promise<ResumenLocal> {
  const [borradores, fotos, pendientes] = await Promise.all([db.borradores.toArray(), db.fotos.toArray(), db.cola.count()]);
  const bytes = fotos.reduce((s, f) => s + f.tamanoBytes, 0) + (borradores.length ? JSON.stringify(borradores).length : 0);
  return { borradores: borradores.length, fotos: fotos.length, pendientes, bytes };
}

export function ultimoRespaldo(): number | null {
  try {
    const v = Number(localStorage.getItem(CLAVE_ULTIMO));
    return v > 0 ? v : null;
  } catch {
    return null;
  }
}

export async function crearRespaldo(contrasena: string, correo: string): Promise<{ archivo: Blob; nombre: string }> {
  if (contrasena.length < MIN_CONTRASENA) throw new ErrorRespaldo(`La contraseña debe tener al menos ${MIN_CONTRASENA} caracteres.`);
  const [borradores, fotos, cola] = await Promise.all([db.borradores.toArray(), db.fotos.toArray(), db.cola.toArray()]);
  const contenido: Contenido = {
    borradores,
    fotos: await Promise.all(
      fotos.map(async ({ blob, ...f }) => ({ ...f, tipo: blob.type || 'image/jpeg', base64: b64(await blob.arrayBuffer()) })),
    ),
    cola,
  };
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const k = await clave(contrasena, sal, ITERACIONES, 'encrypt');
  const cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(JSON.stringify(contenido)));
  const ahora = new Date();
  const archivo: ArchivoFisc = {
    formato: 'fisc',
    version: 1,
    correo: correo.toLowerCase(),
    creadoEn: ahora.toISOString(),
    iteraciones: ITERACIONES,
    sal: b64(sal),
    iv: b64(iv),
    datos: b64(cifrado),
  };
  try {
    localStorage.setItem(CLAVE_ULTIMO, String(ahora.getTime()));
  } catch {
    // sin almacenamiento: solo se pierde la fecha del último respaldo
  }
  const p = (n: number) => String(n).padStart(2, '0');
  const nombre = `respaldo_${ahora.getFullYear()}${p(ahora.getMonth() + 1)}${p(ahora.getDate())}_${p(ahora.getHours())}${p(ahora.getMinutes())}.fisc`;
  return { archivo: new Blob([JSON.stringify(archivo)], { type: 'application/octet-stream' }), nombre };
}

export async function recuperarRespaldo(texto: string, contrasena: string, correo: string): Promise<ResultadoRecuperacion> {
  let a: ArchivoFisc;
  try {
    a = JSON.parse(texto) as ArchivoFisc;
  } catch {
    throw new ErrorRespaldo('El archivo no es un respaldo .fisc válido.');
  }
  if (a?.formato !== 'fisc' || a.version !== 1) throw new ErrorRespaldo('El archivo no es un respaldo .fisc válido.');
  if (a.correo !== correo.toLowerCase()) throw new ErrorRespaldo('El respaldo pertenece a otro correo.');
  let contenido: Contenido;
  try {
    const k = await clave(contrasena, deB64(a.sal), a.iteraciones, 'decrypt');
    const plano = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(a.iv) as BufferSource }, k, deB64(a.datos) as BufferSource);
    contenido = JSON.parse(new TextDecoder().decode(plano)) as Contenido;
  } catch {
    throw new ErrorRespaldo('Contraseña incorrecta o archivo dañado.');
  }
  const r: ResultadoRecuperacion = { borradores: 0, fotos: 0, tareas: 0, omitidos: 0 };
  await db.transaction('rw', db.borradores, db.fotos, db.cola, async () => {
    for (const b of contenido.borradores) {
      if (await db.borradores.get(b.id)) r.omitidos++;
      else {
        await db.borradores.add(b);
        r.borradores++;
      }
    }
    for (const { tipo, base64, ...f } of contenido.fotos) {
      if (await db.fotos.get(f.id)) r.omitidos++;
      else {
        await db.fotos.add({ ...f, blob: new Blob([deB64(base64) as BlobPart], { type: tipo }) });
        r.fotos++;
      }
    }
    for (const t of contenido.cola) {
      if (await db.cola.get(t.clave)) continue;
      await db.cola.add(t);
      r.tareas++;
    }
  });
  return r;
}
