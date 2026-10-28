import { expect, test, type Page } from '@playwright/test';
import { instalarApiSimulada } from './apiSimulada';

const AUDITOR = 'auditor@egehid.test';

async function entrar(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(AUDITOR);
  await page.getByRole('button', { name: /Entrar/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Buen(os|as) (días|tardes|noches)|Hola,/ })).toBeVisible();
}

/** Borradores guardados en la tablet (IndexedDB). */
const borradoresLocales = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((ok) => {
        const r = indexedDB.open('fiscalizacion-egehid');
        r.onsuccess = () => {
          const c = r.result.transaction('borradores').objectStore('borradores').count();
          c.onsuccess = () => ok(c.result);
        };
      }),
  );

/** Crea un borrador y espera a que llegue al servidor (simulado). */
async function crearBorrador(page: Page, api: ReturnType<typeof instalarApiSimulada>) {
  await page.goto('/fiscalizaciones/nueva');
  await expect(page).toHaveURL(/\/fiscalizaciones\/([0-9a-f-]{36})\/visita$/);
  const id = /\/fiscalizaciones\/([0-9a-f-]{36})\//.exec(page.url())![1];
  await page.getByLabel('Hora de salida').fill('07:15');
  await expect.poll(() => api.puts.some((p) => p.id === id), { timeout: 15_000 }).toBe(true);
  return id;
}

test('un auditor elimina su borrador desde el formulario: se va del servidor y de la tablet', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const api = instalarApiSimulada(page, { correo: AUDITOR });
  await entrar(page);
  const id = await crearBorrador(page, api);
  expect(await borradoresLocales(page)).toBe(1);

  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Eliminar borrador' }).click();
  await expect(page).toHaveURL(/\/historial$/);
  expect(api.borrados).toEqual([id]);
  expect(await borradoresLocales(page)).toBe(0);
});

test('un auditor (no administrador) elimina su borrador desde el menú ⋮ del Historial', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const api = instalarApiSimulada(page, { correo: AUDITOR });
  await entrar(page);
  const id = await crearBorrador(page, api);
  await page.goto('/historial');

  const numero = `${id.slice(0, 4)}-${id.slice(4, 8)}`.toUpperCase();
  await page.getByRole('button', { name: `Acciones de ${numero}` }).click();
  await expect(page.getByRole('menuitem', { name: 'Mover a papelera' })).toHaveCount(0); // eso es solo para finalizados (admin)
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('menuitem', { name: 'Eliminar borrador' }).click();
  await expect.poll(() => api.borrados).toEqual([id]);
  await expect.poll(() => borradoresLocales(page)).toBe(0);
  await expect(page.getByRole('button', { name: `Acciones de ${numero}` })).toHaveCount(0);
});

test('móvil: la tarjeta del Historial tiene el menú y no abre el registro al usarlo', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const api = instalarApiSimulada(page, { correo: AUDITOR });
  await entrar(page);
  const id = await crearBorrador(page, api);
  await page.goto('/historial');
  const numero = `${id.slice(0, 4)}-${id.slice(4, 8)}`.toUpperCase();
  await page.getByRole('button', { name: `Acciones de ${numero}` }).click();
  await expect(page).toHaveURL(/\/historial$/);
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('menuitem', { name: 'Eliminar borrador' }).click();
  await expect.poll(() => api.borrados).toEqual([id]);
  await expect(page).toHaveURL(/\/historial$/);
});
