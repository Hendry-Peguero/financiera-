import type { EstadisticasDto, FiscalizacionResumenDto } from '../api/types';
import { fechaExcel, hojaHistorial, hojasEstadisticas } from './exportarExcel';

const fila = (n: Partial<FiscalizacionResumenDto> = {}): FiscalizacionResumenDto => ({
  id: 'a',
  numero: '5E0B',
  fecha: '2026-10-19',
  locacion: 'Presa de Tavera',
  suplidor: 'Sunix',
  autor: 'José Guzmán',
  galonesProveedor: 4224.8,
  galonesEgehid: 4212.4,
  diferenciaGal: -12.4,
  version: 2,
  estado: 'Finalizado',
  enPapelera: false,
  ...n,
});

describe('hojaHistorial', () => {
  it('arma una fila por registro con fecha real, galones como número y la diferencia en fracción', () => {
    const h = hojaHistorial([fila()]);
    expect(h.columnas.map((c) => c.titulo)).toEqual([
      'N.º',
      'Fecha',
      'Destino',
      'Suplidor',
      'Autor',
      'Proveedor (gal)',
      'EGEHID (gal)',
      'Diferencia (gal)',
      'Diferencia (%)',
      'Revisión',
      'Estado',
    ]);
    const [r] = h.filas;
    expect(r[0]).toBe('5E0B');
    expect(r[1]).toEqual(new Date(Date.UTC(2026, 9, 19)));
    expect(r.slice(5, 8)).toEqual([4224.8, 4212.4, -12.4]);
    expect(r[8] as number).toBeCloseTo(-0.002935, 5);
    expect(r[9]).toBe(2);
    expect(r[10]).toBe('Finalizado');
    expect(h.columnas[1].formato).toBe('fecha');
    expect(h.columnas[5].formato).toBe('galones');
    expect(h.columnas[8].formato).toBe('pct');
  });

  it('deja vacíos los datos que faltan y marca la papelera', () => {
    const [r] = hojaHistorial([
      fila({ fecha: null, galonesProveedor: null, diferenciaGal: null, version: 0, estado: 'Borrador', enPapelera: true }),
    ]).filas;
    expect(r[1]).toBeNull();
    expect(r[5]).toBeNull();
    expect(r[8]).toBeNull();
    expect(r[9]).toBeNull();
    expect(r[10]).toBe('En papelera');
  });
});

describe('hojasEstadisticas', () => {
  const e: EstadisticasDto = {
    total: 4,
    galonesProveedor: 10000,
    galonesEgehid: 9971,
    diferencia: -29,
    diferenciaPct: -0.29,
    series: [
      { periodo: 'S41', proveedor: 6000, egehid: 5980 },
      { periodo: 'S42', proveedor: 4000, egehid: 3991 },
    ],
    porLocacion: [
      { locacion: 'Tavera', galones: 7000 },
      { locacion: 'Jimenoa', galones: 2971 },
    ],
    avisos: [{ fiscalizacionId: 'x', numero: '5E0B', locacion: 'Tavera', tipo: 'DiferenciaMayor1Pct', mensaje: 'Diferencia de −1.2 %' }],
  };
  const hojas = hojasEstadisticas(e, { desde: '2026-08-01', hasta: '2026-10-20', locacion: 'Todas las locaciones', agrupar: 'Semana' });

  it('incluye resumen, periodos, locaciones y avisos', () => {
    expect(hojas.map((h) => h.nombre)).toEqual(['Resumen', 'Por periodo', 'Por locación', 'Avisos']);
  });

  it('resumen: filtros e indicadores con su formato', () => {
    const r = Object.fromEntries(hojas[0].filas.map(([k, v]) => [k as string, v]));
    expect(r['Desde']).toEqual(new Date(Date.UTC(2026, 7, 1)));
    expect(r['Locación']).toBe('Todas las locaciones');
    expect(r['Adquisiciones fiscalizadas']).toEqual({ valor: 4, formato: 'entero' });
    expect(r['Galones medidos EGEHID']).toEqual({ valor: 9971, formato: 'galones' });
    expect(r['Diferencia sobre lo declarado']).toEqual({ valor: -0.0029, formato: 'pct' });
    expect(r['Promedio proveedor por entrega (gal)']).toEqual({ valor: 2500, formato: 'galones' });
    expect(hojas[0].filtro).toBe(false);
  });

  it('periodos con diferencia en galones y porcentaje; locaciones con su parte del total', () => {
    expect(hojas[1].filas[0]).toEqual(['S41', 6000, 5980, -20, -20 / 6000]);
    expect(hojas[2].filas[0][0]).toBe('Tavera');
    expect(hojas[2].filas[0][2] as number).toBeCloseTo(7000 / 9971, 6);
    expect(hojas[3].filas[0]).toEqual(['5E0B', 'Tavera', 'Diferencia mayor de 1 %', 'Diferencia de −1.2 %']);
  });

  it('sin entregas no divide entre cero', () => {
    const [res] = hojasEstadisticas({ ...e, total: 0, series: [{ periodo: 'S1', proveedor: 0, egehid: 0 }], porLocacion: [] }, {
      locacion: 'x',
      agrupar: 'Día',
    });
    const r = Object.fromEntries(res.filas.map(([k, v]) => [k as string, v]));
    expect(r['Promedio EGEHID por entrega (gal)']).toEqual({ valor: null, formato: 'galones' });
    expect(r['Desde']).toBeNull();
  });
});

describe('fechaExcel', () => {
  it('convierte yyyy-MM-dd a fecha UTC y rechaza lo demás', () => {
    expect(fechaExcel('2026-01-31T10:00:00')).toEqual(new Date(Date.UTC(2026, 0, 31)));
    expect(fechaExcel('31/01/2026')).toBeNull();
    expect(fechaExcel(undefined)).toBeNull();
  });
});
