import { borrador7c21, RECIENTES } from '../fixtures/inicio';
import type { Pantalla } from './tipos';

export const PANTALLAS_INICIO: Pantalla[] = [
  {
    id: 'inicio',
    tamanos: ['desktop', 'tablet-h', 'tablet-v', 'movil'],
    ruta: '/',
    escenario: (esc) => {
      esc.inicio = { ...esc.inicio, recientes: RECIENTES };
      const b = borrador7c21();
      esc.detalle[b.id] = b;
    },
    listo: '.ini, .ini-movil',
    antes: async ({ page, tamano, avanzar }) => {
      if (tamano !== 'movil') return;
      // «Continuar borrador»: el borrador #7C21 queda guardado en la tablet al abrirlo, hace 3 min.
      await page.goto(`/fiscalizaciones/${borrador7c21().id}/visita`);
      await page.waitForFunction(
        (id) =>
          new Promise<boolean>((ok) => {
            const r = indexedDB.open('fiscalizacion-egehid');
            r.onsuccess = () => {
              try {
                const g = r.result.transaction('borradores').objectStore('borradores').get(id);
                g.onsuccess = () => ok(!!g.result);
                g.onerror = () => ok(false);
              } catch {
                ok(false);
              }
            };
            r.onerror = () => ok(false);
          }),
        borrador7c21().id,
      );
      await avanzar(180);
      await page.goto('/');
      await page.locator('.ini-continuar').waitFor();
    },
  },
];
