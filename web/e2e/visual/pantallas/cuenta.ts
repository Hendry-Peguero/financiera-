import { PAPELERA } from '../fixtures/cuenta';
import type { Pantalla } from './tipos';

export const PANTALLAS_CUENTA: Pantalla[] = [
  {
    id: 'mi-cuenta-y-respaldo',
    referencia: { movil: 'mi-cuenta' },
    tamanos: ['desktop', 'tablet-h', 'tablet-v', 'movil'],
    ruta: '/cuenta',
    escenario: (esc) => {
      esc.papelera = PAPELERA;
      esc.conteos = { ...esc.conteos, papelera: PAPELERA.length };
    },
    listo: (t) => (t === 'movil' ? '.cu-movil' : '.cu-borrado'),
    antes: async ({ page, tamano }) => {
      // Contraseña escrita (14 caracteres) como en el diseño: los botones de respaldo quedan activos.
      if (tamano !== 'movil') await page.locator('#respaldo input[type=password]').fill('respaldo-2026!');
    },
  },
];
