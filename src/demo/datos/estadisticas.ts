import type { EstadisticasDto } from '../../api/types';
export type Tamano = 'desktop' | 'tablet-h' | 'tablet-v' | 'movil';
import { idDe } from './base';

/**
 * Estadísticas de desktop-estadisticas.html: 126 entregas, 512,340.20 / 511,102.45 gal, 11 semanas (S32–S42).
 * Las barras del diseño miden N px (iguales en todos los tamaños); el área de barras de la app mide ALTO px y llega
 * a 60k, así que galones = N / ALTO × 60 000.
 */
const ALTO: Record<Tamano, number> = {
  desktop: 446,
  'tablet-h': 446,
  'tablet-v': 417,
  movil: 456,
};
const PROVEEDOR = [308, 364, 330, 393, 297, 345, 411, 327, 375, 355, 321];
const EGEHID = [306, 364, 329, 391, 297, 343, 409, 326, 373, 354, 320];

/** «Otras 9 locaciones» suman 142,412 gal. */
const OTRAS: [string, number][] = [
  ['C.H. Jimenoa', 24310],
  ['C.H. Rincón', 21980],
  ['C.H. Hatillo', 19640],
  ['C.H. Pinalito', 17200],
  ['C.H. Palomino', 15880],
  ['C.H. Sabaneta', 13950],
  ['C.H. Las Barías', 11870],
  ['C.H. López Angostura', 9632],
  ['C.H. Brazo Derecho', 7950],
];

export function estadisticas(t: Tamano): EstadisticasDto {
  const gal = (px: number) => Math.round((px / ALTO[t]) * 60000);
  return {
    total: 126,
    galonesProveedor: 512340.2,
    galonesEgehid: 511102.45,
    diferencia: -1237.75,
    diferenciaPct: -0.24,
    series: PROVEEDOR.map((p, i) => ({
      periodo: `S${32 + i}`,
      proveedor: gal(p),
      egehid: gal(EGEHID[i]),
    })),
    porLocacion: [
      { locacion: 'C.H. Valdesia', galones: 98420 },
      { locacion: 'C.H. Jigüey', galones: 84150 },
      { locacion: 'C.H. Aguacate', galones: 71300 },
      { locacion: 'C.H. Monción', galones: 62880 },
      { locacion: 'C.H. Tavera', galones: 51940 },
      ...OTRAS.map(([locacion, galones]) => ({ locacion, galones })),
    ],
    avisos: [
      {
        fiscalizacionId: idDe('2B6A-77E1'),
        numero: '2B6A-77E1',
        locacion: 'C.H. Monción',
        tipo: 'DiferenciaMayor1Pct',
        mensaje: 'Diferencia −1.30 % > 1 %',
      },
      {
        fiscalizacionId: idDe('B812-4A50'),
        numero: 'B812-4A50',
        locacion: 'C.H. Pinalito',
        tipo: 'ProveedorCero',
        mensaje: 'Proveedor 0 · EGEHID 2,100 gal',
      },
      {
        fiscalizacionId: idDe('5E0B-3D77'),
        numero: '5E0B-3D77',
        locacion: 'C.H. Valdesia',
        tipo: 'SobreMediana',
        mensaje: '162 % de la mediana reciente',
      },
    ],
  };
}
