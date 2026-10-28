import type { CalculosDto, LecturaDto, MedicionesDto } from '../api/types';

/** Redondeo a 2 decimales "half away from zero" sin errores de coma flotante habituales. */
export function redondear2(n: number): number {
  const s = Math.sign(n) || 1;
  return (s * Math.round(Math.abs(n) * 100 + 1e-9)) / 100;
}

function aEnteroEscalado(n: number, escala: number): number {
  return Math.round(n * escala);
}

/** Diferencia = EGEHID − proveedor (2 decimales). */
export function diferenciaGalones(proveedor: number | null, egehid: number | null): number | null {
  if (proveedor == null || egehid == null) return null;
  return (aEnteroEscalado(egehid, 100) - aEnteroEscalado(proveedor, 100)) / 100;
}

/** Diferencia % respecto a lo declarado por el proveedor (2 decimales). Null si proveedor es 0. */
export function diferenciaPorcentaje(proveedor: number | null, egehid: number | null): number | null {
  const d = diferenciaGalones(proveedor, egehid);
  if (d == null || proveedor == null || proveedor === 0) return null;
  return redondear2((d / proveedor) * 100);
}

/** Importe = galones × precio, a centavos. Precio con 4 decimales. */
export function importe(galones: number | null, precio: number | null): number | null {
  if (galones == null || precio == null) return null;
  const g = aEnteroEscalado(galones, 100); // centésimas de galón
  const p = aEnteroEscalado(precio, 10000); // diezmilésimas de peso
  // g*p está en 1e-6 pesos → a centavos dividir entre 1e4
  const centavos = Math.sign(g * p) * Math.round(Math.abs(g * p) / 10000);
  return centavos / 100;
}

/** Diferencia de un contador: final − inicial. */
export function diferenciaLectura(l: Pick<LecturaDto, 'inicial' | 'final'>): number | null {
  if (l.inicial == null || l.final == null) return null;
  return (aEnteroEscalado(l.final, 100) - aEnteroEscalado(l.inicial, 100)) / 100;
}

export function calcular(m: MedicionesDto): CalculosDto {
  const impP = importe(m.galonesProveedor, m.precioGalon);
  const impE = importe(m.galonesEgehid, m.precioGalon);
  return {
    diferenciaGal: diferenciaGalones(m.galonesProveedor, m.galonesEgehid),
    diferenciaPct: diferenciaPorcentaje(m.galonesProveedor, m.galonesEgehid),
    importeProveedor: impP,
    importeEgehid: impE,
    diferenciaImporte: impP != null && impE != null ? (Math.round(impE * 100) - Math.round(impP * 100)) / 100 : null,
  };
}

/** Aviso orientativo: diferencia mayor al 1 % o proveedor en cero con EGEHID positivo. */
export function avisoDiferencia(m: Pick<MedicionesDto, 'galonesProveedor' | 'galonesEgehid'>): string | null {
  if (m.galonesProveedor === 0 && (m.galonesEgehid ?? 0) > 0) return 'Proveedor en cero con medición EGEHID positiva';
  const pct = diferenciaPorcentaje(m.galonesProveedor, m.galonesEgehid);
  if (pct != null && Math.abs(pct) > 1) return `Diferencia de ${Math.abs(pct).toFixed(2)} % sobre lo declarado por el proveedor`;
  return null;
}
