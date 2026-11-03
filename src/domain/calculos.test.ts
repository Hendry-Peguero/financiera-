import { describe, expect, it } from 'vitest';
import { avisoDiferencia, calcular, diferenciaGalones, diferenciaLectura, diferenciaPorcentaje, importe } from './calculos';
import { nuevaFiscalizacion } from './fiscalizacion';
import { aFecha, dinero, num, pct } from './format';

describe('cálculos de mediciones (caso del diseño)', () => {
  const m = { ...nuevaFiscalizacion('x').mediciones, galonesProveedor: 4212.4, galonesEgehid: 4200, precioGalon: 248.6 };

  it('diferencia = EGEHID − proveedor = −12.40 gal', () => {
    expect(diferenciaGalones(4212.4, 4200)).toBe(-12.4);
  });

  it('diferencia % = −0.29 %', () => {
    expect(diferenciaPorcentaje(4212.4, 4200)).toBe(-0.29);
  });

  it('importes a centavos: 1,047,202.64 · 1,044,120.00 · −3,082.64', () => {
    const c = calcular(m);
    expect(c.importeProveedor).toBe(1047202.64);
    expect(c.importeEgehid).toBe(1044120);
    expect(c.diferenciaImporte).toBe(-3082.64);
    expect(c.diferenciaGal).toBe(-12.4);
    expect(c.diferenciaPct).toBe(-0.29);
  });

  it('formato del diseño: −12.40, −0.29 %, −RD$ 3,082.64', () => {
    const c = calcular(m);
    expect(num(c.diferenciaGal)).toBe('−12.40');
    expect(pct(c.diferenciaPct)).toBe('−0.29 %');
    expect(dinero(c.diferenciaImporte)).toBe('−RD$ 3,082.64');
    expect(dinero(c.importeProveedor)).toBe('RD$ 1,047,202.64');
  });

  it('sin precio no hay importes; proveedor 0 no da porcentaje', () => {
    const c = calcular({ ...m, precioGalon: null });
    expect(c.importeProveedor).toBeNull();
    expect(c.diferenciaImporte).toBeNull();
    expect(diferenciaPorcentaje(0, 2100)).toBeNull();
    expect(importe(null, 10)).toBeNull();
  });

  it('lecturas: final − inicial sin errores de coma flotante', () => {
    expect(diferenciaLectura({ inicial: 128450.2, final: 132650.2 })).toBe(4200);
    expect(diferenciaLectura({ inicial: 9882.1, final: 14082.4 })).toBe(4200.3);
    expect(diferenciaLectura({ inicial: 56210, final: null })).toBeNull();
  });

  it('avisos orientativos', () => {
    expect(avisoDiferencia({ galonesProveedor: 4212.4, galonesEgehid: 4200 })).toBeNull();
    expect(avisoDiferencia({ galonesProveedor: 5471.2, galonesEgehid: 5400 })).toMatch(/1\.30 %/);
    expect(avisoDiferencia({ galonesProveedor: 0, galonesEgehid: 2100 })).toMatch(/Proveedor en cero/);
  });
});

describe('momentos de la API', () => {
  it('sin zona se interpretan como UTC (la API real no envía la Z)', () => {
    expect(aFecha('2026-10-22T18:58:44.34').toISOString()).toBe('2026-10-22T18:58:44.340Z');
    expect(aFecha('2026-10-22T18:58:44Z').toISOString()).toBe('2026-10-22T18:58:44.000Z');
  });
});
