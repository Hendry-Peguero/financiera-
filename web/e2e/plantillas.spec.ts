import { expect, test, type Page } from '@playwright/test';
import { instalarApiSimulada } from './apiSimulada';

const ADMIN = 'admin@egehid.test';

async function entrar(page: Page, correo: string) {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(correo);
  await page.getByRole('button', { name: /Entrar/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Buen(os|as) (días|tardes|noches)/ })).toBeVisible();
}

test('plantillas: crear, colocar y arrastrar un campo, guardar el borrador y publicar la versión 1', async ({ page }) => {
  const api = instalarApiSimulada(page, { correo: ADMIN, rol: 'Administrador' });
  await entrar(page, ADMIN);
  await page.getByRole('navigation', { name: 'ADMINISTRACIÓN' }).getByRole('link', { name: 'Plantillas' }).click();

  // la oficial es de solo lectura
  await expect(page.locator('.pl-item', { hasText: 'Combustible y aceites' })).toContainText('Activa');
  await expect(page.getByRole('button', { name: /Publicar versión/ })).toBeDisabled();

  await page.getByRole('button', { name: 'Nueva plantilla', exact: true }).click();
  await expect(page.locator('.pl-item', { hasText: 'Nueva plantilla' })).toContainText('Borrador v1');

  // con la herramienta «Texto» (activa por omisión) se toca la página para agregar un campo
  const hoja = page.getByLabel('Página 1 de 1 de Nueva plantilla');
  await hoja.click({ position: { x: 50, y: 100 } });
  await expect(page.getByLabel('Identificador')).toHaveValue('campo_1');
  await page.getByLabel('Tipo').selectOption('Numero');

  // arrastre: el desplazamiento en puntos sale del tamaño medido de la página (la interfaz va al 80 %)
  const ejeX = page.getByLabel('X', { exact: true });
  const x0 = Number(await ejeX.inputValue());
  const caja = (await page.locator('.pl-campo-pdf', { hasText: 'campo_1' }).boundingBox())!;
  const anchoHoja = (await hoja.boundingBox())!.width;
  await page.mouse.move(caja.x + 6, caja.y + 4);
  await page.mouse.down();
  await page.mouse.move(caja.x + 6 + 44, caja.y + 4, { steps: 6 });
  await page.mouse.up();
  const esperado = x0 + (44 * 612) / anchoHoja;
  await expect.poll(async () => Math.abs(Number(await ejeX.inputValue()) - esperado)).toBeLessThanOrEqual(1);

  // autoguardado del borrador y publicación
  await expect.poll(() => api.noGet.filter((x) => /^PUT \/plantillas\/\d+\/borrador$/.test(x)).length).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Publicar versión 1' }).click();
  await expect(page.locator('.pl-toast')).toContainText('Versión 1 publicada');
  await expect(page.locator('.pl-item', { hasText: 'Nueva plantilla' })).toContainText('Activa');
  expect(api.plantillas.lista.at(-1)?.versiones[0].campos).toMatchObject([{ identificador: 'campo_1', tipo: 'Numero' }]);
});
