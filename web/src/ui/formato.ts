import type { FiscalizacionResumenDto } from '../api/types';

const nf2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** 4,212.40 con guion ASCII («-12.40»), como en las tablas del diseño. */
export function numTabla(n: number | null | undefined, decimales = 2): string {
  if (n == null || Number.isNaN(n)) return '—';
  const s = (decimales === 0 ? nf0 : nf2).format(Math.abs(n));
  return n < 0 ? `-${s}` : s;
}

/** «+0.00», «-12.40», «+2,100.00» */
export function conSigno(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return n < 0 ? numTabla(n) : `+${numTabla(n)}`;
}

/** 182,450 */
export function entero(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return nf0.format(n);
}

/** «Buenos días» / «Buenas tardes» / «Buenas noches» */
export function saludo(h = new Date().getHours()): string {
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

/** «#A3F9» (número corto de las listas de Inicio). */
export function numeroCorto(numero: string | null | undefined): string {
  return numero ? `#${numero.slice(0, 4)}` : '—';
}

/** Diferencia que merece atención (rojo): más de 0.5 % del proveedor, o proveedor en cero con EGEHID > 0. */
export function diferenciaAlerta(f: Pick<FiscalizacionResumenDto, 'galonesProveedor' | 'galonesEgehid' | 'diferenciaGal'>): boolean {
  const d = f.diferenciaGal;
  if (d == null) return false;
  const p = f.galonesProveedor ?? 0;
  if (p === 0) return (f.galonesEgehid ?? 0) > 0;
  return Math.abs(d / p) > 0.005;
}

/** Ruta al abrir un registro: los borradores van al formulario. */
export function rutaRegistro(f: Pick<FiscalizacionResumenDto, 'id' | 'estado' | 'enPapelera'>): string {
  return f.estado === 'Borrador' && !f.enPapelera ? `/fiscalizaciones/${f.id}/visita` : `/fiscalizaciones/${f.id}`;
}

/** «dd/MM» de yyyy-MM-dd */
export function diaMes(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}` : '—';
}
