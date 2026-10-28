import type { FiscalizacionResumenDto } from '../../../src/api/types';
import { idDe } from './base';

/** Papelera de desktop-mi-cuenta-y-respaldo.html (2 registros). */
export const PAPELERA: FiscalizacionResumenDto[] = [
  ['4A19-6B2E', 'C.H. Sabaneta', '2026-10-15', 'José M. Guzmán'],
  ['F201-7C3A', 'C.H. Las Barías', '2026-10-09', 'Ana L. Pérez'],
].map(([numero, locacion, fecha, autor]) => ({
  id: idDe(numero),
  numero,
  fecha,
  locacion,
  suplidor: null,
  autor,
  galonesProveedor: null,
  galonesEgehid: null,
  diferenciaGal: null,
  version: 1,
  estado: 'Finalizado',
  enPapelera: true,
}));
