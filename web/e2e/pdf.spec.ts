import { expect, test, type Page } from '@playwright/test';
import { instalarApiSimulada } from './apiSimulada';

const AUDITOR = 'auditor@egehid.test';
const SIN_RED = 'Sin conexión: el PDF oficial lo genera el servidor.';

async function entrar(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(AUDITOR);
  await page.getByRole('button', { name: /Entrar/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Buen(os|as) (días|tardes|noches)/ })).toBeVisible();
}

/** Crea un borrador (lo envía con PUT) y devuelve su id. */
async function nuevoBorrador(page: Page, api: ReturnType<typeof instalarApiSimulada>) {
  await page.getByRole('navigation', { name: 'PRINCIPAL' }).getByRole('link', { name: 'Nueva fiscalización' }).click();
  await expect(page).toHaveURL(/\/fiscalizaciones\/[0-9a-f-]{36}\/visita$/);
  await page.getByLabel('Hora de salida').fill('07:15');
  await expect.poll(() => api.puts.length).toBeGreaterThan(0);
  return /\/fiscalizaciones\/([0-9a-f-]{36})\//.exec(page.url())![1];
}

test('la vista previa del borrador abre el PDF que genera la API (marca BORRADOR)', async ({ page }) => {
  const api = instalarApiSimulada(page, { correo: AUDITOR });
  await entrar(page);
  const id = await nuevoBorrador(page, api);

  const ventana = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Vista previa PDF' }).click();
  await ventana;
  await expect.poll(() => api.pdfs).toContain(`/fiscalizaciones/${id}/pdf/vista-previa`);
});

test('«Descargar PDF» baja el PDF oficial de la versión vigente; sin red avisa', async ({ page, context }) => {
  const api = instalarApiSimulada(page, { correo: AUDITOR });
  await entrar(page);
  const borrador = api.fiscalizaciones.get(await nuevoBorrador(page, api))!;
  // otro registro, ya finalizado en el servidor (versión 1); el borrador local sigue sincronizándose aparte
  const id = 'f1000000-0000-4000-8000-000000000001';
  const d = { ...borrador, id, numero: 'F100-0000', estado: 'Finalizado', versionActual: 1, pendientes: {} };
  api.fiscalizaciones.set(id, d);

  await page.goto(`/fiscalizaciones/${id}`);
  const boton = page.getByRole('button', { name: 'Descargar PDF' });
  const descarga = page.waitForEvent('download');
  await boton.click();
  const archivo = await descarga;
  expect(archivo.suggestedFilename()).toBe('Fiscalizacion-F100-v1.pdf');
  expect(api.pdfs).toContain(`/fiscalizaciones/${id}/pdf`);

  await context.setOffline(true);
  await boton.click();
  await expect(page.getByText(SIN_RED)).toBeVisible();
  expect(api.pdfs).toHaveLength(1);
  await context.setOffline(false);
});
