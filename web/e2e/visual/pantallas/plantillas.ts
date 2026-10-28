import type { Pantalla } from './tipos';

/**
 * Editor de plantillas (fase 3) con la API simulada (fixtures/plantillas.ts): se abre «Recepción de lubricantes»
 * (la que tiene borrador), su PDF base lo dibuja pdf.js y se selecciona el campo «diferencia» como en el diseño.
 */
export const PANTALLAS_PLANTILLAS: Pantalla[] = [
  {
    id: 'plantillas',
    tamanos: ['desktop', 'tablet-h', 'tablet-v'],
    ruta: '/plantillas',
    listo: '.pl-pagina[data-pdf="listo"]',
    antes: async ({ page }) => {
      await page.locator('.pl-campo-pdf', { hasText: /^diferencia =/ }).click();
      await page.locator('.pl-props', { hasText: 'Propiedades del campo' }).waitFor();
    },
  },
];
