import type { FiscalizacionDto } from '../api/types';
import { aFecha, hoyIso } from '../domain/format';

const p2 = (x: number) => String(x).padStart(2, '0');

function hora12De(d: Date): string {
  const h = d.getHours();
  return `${p2(h % 12 === 0 ? 12 : h % 12)}:${p2(d.getMinutes())} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** Momento ISO → «19/10/2026 10:22 AM» (hora local). */
export function momento12(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = aFecha(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${hora12De(d)}`;
}

/** Momento ISO → «19/10 10:22 AM» (lista de versiones del móvil). */
export function momento12Corto(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = aFecha(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)} ${hora12De(d)}`;
}

/** «José M. Guzmán» → «J. Guzmán» (firma manuscrita del PDF). */
export function firmaInicial(nombre: string | null | undefined): string {
  const p = (nombre ?? '').replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean);
  if (p.length < 2) return p[0] ?? '';
  return `${p[0][0]}. ${p[p.length - 1]}`;
}

/** Quita el paréntesis final: «María Rosario (administradora)» → «María Rosario». */
export function sinParentesis(texto: string): string {
  return texto.replace(/\s*\(.*?\)\s*$/, '');
}

/** Periodo por defecto del Historial: del 1.º del mes en curso a hoy. */
export function periodoMes(hoy = new Date()): { desde: string; hasta: string } {
  return { desde: hoyIso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: hoyIso(hoy) };
}

const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

/** yyyy-MM-dd → «OCTUBRE 2026» (grupos de la lista del móvil). */
export function mesAnio(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})/.exec(iso ?? '');
  return m ? `${MESES[Number(m[2]) - 1]} ${m[1]}` : 'SIN FECHA';
}

/** «Fiscalizacion-5E0B-v3.pdf» */
export function nombrePdf(f: Pick<FiscalizacionDto, 'numero' | 'versionActual'>): string {
  return `Fiscalizacion-${(f.numero ?? 'borrador').slice(0, 4)}-v${f.versionActual || 1}.pdf`;
}
