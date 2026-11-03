import { App } from '@capacitor/app';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { useSyncExternalStore } from 'react';
import { construirUrl, solicitar } from '../api/client';
import { config } from '../config';
import { esApp } from './plataforma';

/**
 * Actualización automática de la app Android (sin reinstalar el APK):
 * 1. Al arrancar, avisa al plugin que esta versión abrió bien (si no, a los 10 s vuelve sola a la anterior).
 * 2. Al abrir la app, al volver a ella y cada 30 min pregunta a la API la última versión (GET /app/version).
 * 3. Si es más nueva, descarga el paquete (el plugin verifica la huella SHA-256) y lo deja para la próxima vez que
 *    la app pase a segundo plano o se reabra: nunca interrumpe a alguien llenando un formulario (y lo escrito ya
 *    está guardado en la tablet).
 * Si la versión publicada necesita un APK más nuevo (`nativaMinima`), avisa que hay que reinstalarlo.
 */

/** GET /api/app/version */
export interface VersionApp {
  version: string;
  ruta: string;
  sha256: string;
  notas: string | null;
  publicadaEn: string;
  nativaMinima: number;
}

export type EstadoActualizacion =
  | { tipo: 'al-dia' }
  | { tipo: 'lista'; version: string; notas: string | null }
  | { tipo: 'reinstalar'; version: string };

const CADA = 30 * 60 * 1000;

let estado: EstadoActualizacion = { tipo: 'al-dia' };
const oyentes = new Set<() => void>();
const poner = (e: EstadoActualizacion) => {
  estado = e;
  oyentes.forEach((f) => f());
};

/** -1, 0 o 1 comparando versiones «1.2.10» con «1.2.9» por partes numéricas. */
export function compararVersiones(a: string, b: string): number {
  const pa = a.split(/[.+-]/).map((x) => Number.parseInt(x, 10) || 0);
  const pb = b.split(/[.+-]/).map((x) => Number.parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

let revisando = false;
let preparada: string | null = null;

async function revisar() {
  if (revisando) return;
  revisando = true;
  try {
    const v = await solicitar<VersionApp | undefined>('/app/version', { signal: AbortSignal.timeout(8000) });
    if (!v || compararVersiones(v.version, config.version) <= 0 || preparada === v.version) return;
    const nativa = Number.parseInt((await App.getInfo()).build, 10) || 0;
    if (nativa < v.nativaMinima) {
      poner({ tipo: 'reinstalar', version: v.version });
      return;
    }
    const paquete = await CapacitorUpdater.download({ version: v.version, url: construirUrl(v.ruta), checksum: v.sha256 });
    await CapacitorUpdater.next({ id: paquete.id });
    preparada = v.version;
    poner({ tipo: 'lista', version: v.version, notas: v.notas });
  } catch {
    // sin red o servidor caído: se vuelve a intentar en la próxima revisión
  } finally {
    revisando = false;
  }
}

let iniciado = false;

export function iniciarActualizaciones() {
  if (iniciado || !esApp()) return;
  iniciado = true;
  void CapacitorUpdater.notifyAppReady();
  void revisar();
  void App.addListener('appStateChange', (s) => {
    if (s.isActive) void revisar();
  });
  window.setInterval(() => void revisar(), CADA);
}

export function useActualizacion(): EstadoActualizacion {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f);
      return () => void oyentes.delete(f);
    },
    () => estado,
  );
}
