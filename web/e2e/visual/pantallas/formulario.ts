import type { FiscalizacionDto } from '../../../src/api/types';
import { recortarReferencia } from '../comparar';
import type { Escenario } from '../fixtures/base';
import { a3f9Controles, a3f9Fotos, a3f9Mediciones, a3f9Visita, ID_A3F9, solicitudesA3f9 } from '../fixtures/formulario';
import type { Contexto, Pantalla, Tamano } from './tipos';

const GRANDES: Tamano[] = ['desktop', 'tablet-h', 'tablet-v'];

const conDatos = (dto: () => FiscalizacionDto) => (esc: Escenario) => {
  esc.detalle[ID_A3F9] = dto();
};

/** «Autoguardado en la tablet · hace 12 s». */
async function hace12s({ page, avanzar }: Contexto) {
  await avanzar(12);
  // El texto se refresca con el tic de 1 s.
  await page.waitForTimeout(1100);
}

/** Las fotos de ejemplo salen recortadas del propio diseño (desktop-formulario-fotos-y-revision.png). */
function fotosDelDiseno(esc: Escenario) {
  for (let i = 0; i < 6; i++)
    esc.fotos[`fa3f9-${i + 1}`] = recortarReferencia('desktop-formulario-fotos-y-revision', 272 + i * 123.4, 317, 111, 95);
}

export const PANTALLAS_FORMULARIO: Pantalla[] = [
  {
    id: 'formulario-visita',
    tamanos: GRANDES,
    ruta: `/fiscalizaciones/${ID_A3F9}/visita`,
    escenario: conDatos(a3f9Visita),
    listo: '.fm-pasos, .fm-hm',
    antes: hace12s,
  },
  {
    id: 'formulario-mediciones',
    tamanos: [...GRANDES, 'movil'],
    ruta: `/fiscalizaciones/${ID_A3F9}/visita`,
    escenario: conDatos(a3f9Mediciones),
    listo: '.fm-pasos, .fm-hm',
    antes: async ({ page, tamano, avanzar }) => {
      // Llega desde «Visita» (con 1 pendiente) tocando la sección 3: aparece el aviso «guardada con 1 pendiente».
      if (tamano === 'movil') {
        await page.goto(`/fiscalizaciones/${ID_A3F9}/mediciones`);
        await page.locator('.fm-hm').waitFor();
      } else {
        await page.locator('.paso', { hasText: 'Mediciones' }).click();
        await page.locator('.fm-toast').waitFor();
      }
      await avanzar(12);
      await page.waitForTimeout(1100);
    },
  },
  {
    id: 'formulario-controles-y-firmas',
    referencia: { movil: 'formulario-controles' },
    tamanos: [...GRANDES, 'movil'],
    ruta: `/fiscalizaciones/${ID_A3F9}/controles`,
    escenario: (esc) => {
      esc.detalle[ID_A3F9] = a3f9Controles();
      // Acceso ya enviado al supervisor de combustibles (lo informa la API).
      esc.solicitudesRegistro[ID_A3F9] = solicitudesA3f9();
    },
    listo: '.fm-controles',
    antes: async ({ page, tamano, avanzar }) => {
      if (tamano !== 'movil') await page.locator('.fm-firma.enviada').waitFor();
      await avanzar(12);
      await page.waitForTimeout(1100);
    },
  },
  {
    id: 'formulario-fotos-y-revision',
    tamanos: GRANDES,
    ruta: `/fiscalizaciones/${ID_A3F9}/fotos`,
    escenario: (esc) => {
      esc.detalle[ID_A3F9] = a3f9Fotos();
      fotosDelDiseno(esc);
    },
    listo: '.fm-pasos, .fm-hm',
    antes: hace12s,
  },
  {
    id: 'formulario-ir-a-seccion',
    tamanos: ['movil'],
    ruta: `/fiscalizaciones/${ID_A3F9}/mediciones`,
    escenario: conDatos(a3f9Mediciones),
    listo: '.fm-pasos, .fm-hm',
    antes: async ({ page, avanzar }) => {
      await avanzar(12);
      await page.waitForTimeout(1100);
      await page.locator('.fm-paso-movil').click();
      await page.locator('.fm-hoja').waitFor();
    },
  },
];
