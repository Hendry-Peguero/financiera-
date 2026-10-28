import { expect, test, type Page } from '@playwright/test';
import { instalarApiSimulada } from './apiSimulada';

const DUENO = 'dueno@egehid.test';
const AUDITOR = 'auditor@egehid.test';

async function entrar(page: Page, correo: string) {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(correo);
  await page.getByRole('button', { name: /Entrar/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Buen(os|as) (días|tardes|noches)/ })).toBeVisible();
}

const paso = (page: Page, nombre: string) => page.locator('.pasos-lista a', { hasText: nombre });

test('nueva fiscalización: control 6 = Sí sin observación impide finalizar', async ({ page }) => {
  const api = instalarApiSimulada(page, { correo: AUDITOR });
  await entrar(page, AUDITOR);

  await page.getByRole('navigation', { name: 'PRINCIPAL' }).getByRole('link', { name: 'Nueva fiscalización' }).click();
  await expect(page).toHaveURL(/\/fiscalizaciones\/[0-9a-f-]{36}\/visita$/);
  await expect(page.getByRole('heading', { level: 1, name: /Fiscalización #/ })).toBeVisible();

  // Visita (orden del diseño)
  const visita = page.getByRole('region', { name: 'Datos de la visita' });
  const etiquetas = await visita.locator('label').allInnerTexts();
  expect(etiquetas).toEqual(['Fecha', 'Hora de salida', 'Inicio del proceso', 'Destino', 'Hora de llegada', 'Fin del proceso']);
  await page.getByLabel('Hora de salida').fill('07:15');
  await page.getByLabel('Inicio del proceso').fill('09:05');
  await page.getByLabel('Destino').selectOption({ label: 'C.H. Jigüey (Ocoa)' });
  await page.getByLabel('Hora de llegada').fill('08:40');
  await page.getByLabel('Fin del proceso').fill('11:20');
  await expect(page.getByTestId('autoguardado')).toContainText('Autoguardado en la tablet');

  // Controles: 6 = Sí sin observación
  await paso(page, 'Controles').click();
  await expect(page).toHaveURL(/\/controles$/);
  await page.getByRole('button', { name: 'Control 6: Sí' }).click();
  await expect(page.getByLabel('Observación del control 6')).toHaveAttribute('placeholder', 'Obligatoria si responde Sí');
  await expect(page.locator('[data-control="6"]').getByRole('alert')).toHaveText('La observación es obligatoria si responde Sí.');

  // Revisar: no se puede finalizar y aparece el pendiente
  await paso(page, 'Revisar').click();
  const finalizar = page.getByRole('button', { name: 'Finalizar y generar PDF' });
  await expect(finalizar).toBeDisabled();
  const pendCtl = page.getByRole('list', { name: 'Pendientes de Controles' });
  await expect(pendCtl).toContainText('El control 6 respondió Sí: la observación es obligatoria.');

  // Agregar la observación → el pendiente desaparece
  await paso(page, 'Controles').click();
  await page.getByLabel('Observación del control 6').fill('Agua en el fondo del tanque 2');
  await expect(page.locator('[data-control="6"]').getByRole('alert')).toHaveCount(0);
  await paso(page, 'Revisar').click();
  await expect(page.getByRole('list', { name: 'Pendientes de Controles' })).not.toContainText('El control 6');
  // «Visita» reúne visita, suplidor y empresa: la visita está completa, faltan los datos del suplidor
  const pendVisita = page.getByRole('list', { name: 'Pendientes de Visita, suplidor y empresa' });
  await expect(pendVisita).not.toContainText('Falta la hora');
  await expect(pendVisita).toContainText('Falta el conduce.');
  await expect(finalizar).toBeDisabled(); // aún faltan otros controles y firmas

  // Se sincronizó con PUT: el primero sin rowVersion, los siguientes con el rowVersion devuelto
  await expect.poll(() => api.puts.length).toBeGreaterThan(0);
  expect(api.puts[0].rowVersion).toBeNull();
  await expect.poll(() => api.puts.length, { timeout: 15_000 }).toBeGreaterThan(1);
  expect(api.puts.slice(1).every((p) => p.rowVersion !== null)).toBe(true);
});

test('la bitácora no existe para un usuario que no es el propietario', async ({ page }) => {
  instalarApiSimulada(page, { correo: AUDITOR, propietario: false });
  await entrar(page, AUDITOR);
  await expect(page.getByRole('link', { name: 'Bitácora' })).toHaveCount(0);
  await page.goto('/bitacora');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Bitácora' })).toHaveCount(0);
});

test('el propietario ve la bitácora y los clics se registran sin valores de campos', async ({ page }) => {
  const api = instalarApiSimulada(page, { correo: DUENO, propietario: true });
  await entrar(page, DUENO);
  await page.getByRole('link', { name: 'Bitácora' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Bitácora' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Clics y navegación/ })).toBeVisible();
  await page.getByRole('tab', { name: /Peticiones a la API/ }).click();
  await page.getByRole('tab', { name: /Cambios de datos/ }).click();
  await page.getByLabel('Usuario (correo)').fill('secreto-escrito@ejemplo.com');

  // al volver la red / cada 10 s se envían los eventos por lote
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => api.eventosUi.length, { timeout: 15_000 }).toBeGreaterThan(0);
  const todo = JSON.stringify(api.eventosUi);
  expect(todo).toContain('navegacion');
  expect(todo).toContain('click');
  expect(todo).not.toContain('secreto-escrito');
});

test('sin conexión: indicador visible y el borrador queda guardado en la tablet', async ({ page, context }) => {
  instalarApiSimulada(page, { correo: AUDITOR });
  await entrar(page, AUDITOR);
  await page.getByRole('navigation', { name: 'PRINCIPAL' }).getByRole('link', { name: 'Nueva fiscalización' }).click();
  await expect(page).toHaveURL(/\/visita$/);
  await context.setOffline(true);
  await expect(page.locator('.topbar').getByText('Sin conexión')).toBeVisible();
  await page.getByLabel('Hora de salida').fill('06:50');
  await expect(page.getByTestId('autoguardado')).toContainText('pendiente de enviar');
  // volver a abrir la sección: los datos salen de IndexedDB
  await page.locator('.pasos-lista a', { hasText: 'Mediciones' }).click();
  await page.locator('.pasos-lista a', { hasText: 'Visita' }).click();
  await expect(page.getByLabel('Hora de salida')).toHaveValue('06:50 AM');
  await context.setOffline(false);
  await expect(page.locator('.topbar').getByText('Sin conexión')).toHaveCount(0);
});
