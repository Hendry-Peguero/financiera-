import { escenarioDarAcceso, escenarioFirmarEnTablet, escenarioRevisar, ID_A3F9, ID_SOLICITUD } from '../fixtures/firmas';
import { recortarReferencia } from '../comparar';
import { a3f9Controles } from '../fixtures/formulario';
import { dibujarFirma, escribir } from './ayudas';
import type { Pantalla, Tamano } from './tipos';

/** Zona del trazo de la firma predeterminada (.rf-trazo-img) en cada tamaño: x, y, ancho; alto 64. */
const TRAZO: Record<Tamano, [string, number, number, number]> = {
  desktop: ['desktop-firmas-revisar-y-firmar-firmante', 996, 205, 372],
  'tablet-h': ['tablet-h-firmas-revisar-y-firmar-firmante', 836, 205, 372],
  'tablet-v': ['tablet-v-firmas-revisar-y-firmar-firmante', 72, 933, 656],
  movil: ['movil-firma-solicitada-firmante', 38, 390, 314],
};

/** Firma predeterminada de Ana Pérez: el trazo de la referencia, como PNG de GET /me/firma. */
function firmaAna(t: Tamano): string {
  const [ref, x, y, w] = TRAZO[t];
  return recortarReferencia(ref, x, y, w, 64).toString('base64');
}

export const PANTALLAS_FIRMAS: Pantalla[] = [
  {
    id: 'firmas-firmar-en-esta-tablet',
    tamanos: ['desktop', 'tablet-h', 'tablet-v'],
    ruta: `/fiscalizaciones/${ID_A3F9}/firmar/RepresentanteProveedor`,
    escenario: escenarioFirmarEnTablet,
    listo: '[data-lienzo-firma]',
    antes: async ({ page }) => {
      await escribir(page, 'Nombre completo', 'Ramón A. Peña');
      await escribir(page, 'Cédula (opcional)', '001-1234567-8');
      await dibujarFirma(page, 'Ramón Peña', { tam: 42, y: 62 });
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    },
  },
  {
    id: 'firmas-revisar-y-firmar-firmante',
    referencia: { movil: 'firma-solicitada-firmante' },
    tamanos: ['desktop', 'tablet-h', 'tablet-v', 'movil'],
    ruta: `/firmas/solicitudes/${ID_SOLICITUD}`,
    escenario: (esc, t) => escenarioRevisar(esc, firmaAna(t)),
    listo: (t) => (t === 'movil' ? '.rfm-resumen .rfm-dato' : '.rf-firmada'),
    antes: async ({ page }) => {
      await page.locator('.rf-check').check();
    },
  },
  {
    id: 'firmas-dar-acceso-al-formulario',
    tamanos: ['desktop', 'tablet-h', 'tablet-v'],
    // Sobre «Controles y firmas» (mismo fondo que formulario-controles-y-firmas).
    ruta: `/fiscalizaciones/${ID_A3F9}/controles`,
    escenario: (esc) => escenarioDarAcceso(esc, a3f9Controles()),
    listo: '[data-rol="AuditorCierre2"]',
    antes: async ({ page, avanzar }) => {
      await avanzar(12);
      // dispatchEvent: abre el diálogo sin desplazar la página (en Tablet V la fila queda bajo el pliegue).
      await page
        .locator('[data-rol="AuditorCierre2"]')
        .getByRole('button', { name: /dar acceso|reenviar/i })
        .dispatchEvent('click');
      await page.locator('#da-buscar').fill('ana');
      await page.getByRole('option', { name: /Ana Pérez/ }).click();
    },
  },
];
