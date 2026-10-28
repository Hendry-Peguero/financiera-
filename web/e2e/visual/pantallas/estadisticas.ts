import { estadisticas } from '../fixtures/estadisticas';
import type { Pantalla } from './tipos';

export const PANTALLAS_ESTADISTICAS: Pantalla[] = [
  {
    id: 'estadisticas',
    tamanos: ['desktop', 'tablet-h', 'tablet-v', 'movil'],
    ruta: '/estadisticas',
    escenario: (esc, t) => {
      esc.estadisticas = estadisticas(t);
    },
    listo: '.est-area',
  },
];
