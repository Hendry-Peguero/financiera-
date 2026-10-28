import { expect, test, type Page } from '@playwright/test';
import { instalarApiSimulada } from './apiSimulada';

const AUDITOR = 'auditor@egehid.test';

async function entrar(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(AUDITOR);
  await page.getByRole('button', { name: /Entrar/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Buen(os|as) (días|tardes|noches)|Hola,/ })).toBeVisible();
}

// Una sola navegación en Tablet V y móvil: la barra inferior también está dentro del formulario.
for (const [nombre, viewport] of [
  ['tablet vertical', { width: 800, height: 1280 }],
  ['móvil', { width: 390, height: 844 }],
] as const) {
  test(`formulario en ${nombre}: la barra inferior sigue visible y lleva a otras pantallas`, async ({ page }) => {
    await page.setViewportSize(viewport);
    instalarApiSimulada(page, { correo: AUDITOR });
    await entrar(page);
    await page.goto('/fiscalizaciones/nueva');
    await expect(page).toHaveURL(/\/fiscalizaciones\/[0-9a-f-]{36}\/visita$/);
    const barra = page.getByRole('navigation', { name: 'Navegación inferior' });
    await expect(barra).toBeVisible();
    await expect(page.getByRole('button', { name: 'Menú' })).toHaveCount(0); // un solo tipo de menú
    // los botones del formulario quedan visibles encima de la barra
    const siguiente = page.getByRole('button', { name: /Siguiente/ });
    await expect(siguiente).toBeVisible();
    const cajaSig = (await siguiente.boundingBox())!;
    const cajaBarra = (await barra.boundingBox())!;
    expect(cajaSig.y + cajaSig.height).toBeLessThanOrEqual(cajaBarra.y + 1);
    await page.screenshot({ path: `test-results/barra-formulario-${viewport.width}.png` });

    await barra.getByRole('link', { name: 'Historial' }).click();
    await expect(page).toHaveURL(/\/historial$/);
  });
}
