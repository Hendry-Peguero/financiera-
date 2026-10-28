import { ID_5E0B, LISTA_MOVIL, registro5e0b, VERSIONES_5E0B } from '../fixtures/registros';
import type { Pantalla } from './tipos';

export const PANTALLAS_REGISTROS: Pantalla[] = [
  {
    id: 'historial',
    tamanos: ['desktop', 'tablet-h', 'tablet-v', 'movil'],
    ruta: '/historial',
    escenario: (esc, t) => {
      if (t === 'movil') esc.lista = LISTA_MOVIL;
    },
    listo: '.hist-fila, .hist-tarjeta',
  },
  {
    id: 'detalle-y-versiones',
    referencia: { movil: 'detalle-del-registro' },
    tamanos: ['desktop', 'tablet-h', 'tablet-v', 'movil'],
    ruta: `/fiscalizaciones/${ID_5E0B}`,
    escenario: (esc) => {
      esc.detalle[ID_5E0B] = registro5e0b();
      esc.versiones[ID_5E0B] = VERSIONES_5E0B;
    },
    listo: (t) => (t === 'movil' ? '.det-m-version' : '.det-version'),
  },
];
