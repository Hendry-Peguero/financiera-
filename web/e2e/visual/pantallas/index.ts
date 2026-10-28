import { PANTALLAS_ACCESO } from './acceso';
import { PANTALLAS_CUENTA } from './cuenta';
import { PANTALLAS_ESTADISTICAS } from './estadisticas';
import { PANTALLAS_FIRMAS } from './firmas';
import { PANTALLAS_FORMULARIO } from './formulario';
import { PANTALLAS_INICIO } from './inicio';
import { PANTALLAS_PLANTILLAS } from './plantillas';
import { PANTALLAS_REGISTROS } from './registros';
import type { Pantalla } from './tipos';

/** Pantallas del diseño (cada grupo en su archivo). */
export const PANTALLAS: Pantalla[] = [
  ...PANTALLAS_ACCESO,
  ...PANTALLAS_INICIO,
  ...PANTALLAS_FORMULARIO,
  ...PANTALLAS_FIRMAS,
  ...PANTALLAS_REGISTROS,
  ...PANTALLAS_ESTADISTICAS,
  ...PANTALLAS_PLANTILLAS,
  ...PANTALLAS_CUENTA,
];
