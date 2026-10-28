import { expect, test, type Page } from '@playwright/test';
import { instalarApiSimulada } from './apiSimulada';

const AUDITOR = 'auditor@egehid.test';

async function entrar(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(AUDITOR);
  await page.getByRole('button', { name: /Entrar/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Buen(os|as) (días|tardes|noches)/ })).toBeVisible();
}

/** Borra lo que la tablet recuerda de las solicitudes: lo que se vea después sale del servidor. */
async function olvidarCacheSolicitudes(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((ok, mal) => {
        const r = indexedDB.open('fiscalizacion-egehid');
        r.onsuccess = () => {
          const tx = r.result.transaction('cache', 'readwrite');
          const store = tx.objectStore('cache');
          const cursor = store.openCursor();
          cursor.onsuccess = () => {
            const c = cursor.result;
            if (!c) return;
            if (String(c.key).startsWith('solicitudes-firma:')) c.delete();
            c.continue();
          };
          tx.oncomplete = () => {
            r.result.close();
            ok();
          };
          tx.onerror = () => mal(tx.error);
        };
        r.onerror = () => mal(r.error);
      }),
  );
}

test('«Acceso enviado» sale del servidor: se ve tras borrar la tablet y refleja un rechazo', async ({ page }) => {
  const api = instalarApiSimulada(page, { correo: AUDITOR });
  await entrar(page);

  await page.getByRole('navigation', { name: 'PRINCIPAL' }).getByRole('link', { name: 'Nueva fiscalización' }).click();
  await expect(page).toHaveURL(/\/fiscalizaciones\/[0-9a-f-]{36}\/visita$/);
  await page.getByLabel('Hora de salida').fill('07:15');
  await expect.poll(() => api.puts.length).toBeGreaterThan(0);

  await page.locator('.pasos-lista a', { hasText: 'Firmas' }).click();
  await expect(page).toHaveURL(/\/firmas$/);
  const fila = page.locator('[data-rol="SupervisorCombustibles"]');
  await expect(fila).toContainText('Sin asignar');

  // Dar acceso a Pedro Almonte
  await fila.getByRole('button', { name: 'Dar acceso' }).click();
  const dialogo = page.getByRole('dialog');
  await dialogo.getByPlaceholder('Nombre o correo').fill('pedro');
  await dialogo.getByRole('option', { name: /Pedro Almonte/ }).click();
  await dialogo.getByRole('button', { name: 'Dar acceso y solicitar firma' }).click();
  await expect(dialogo).toHaveCount(0);
  await expect(fila).toHaveClass(/enviada/);
  await expect(fila).toContainText('Pedro Almonte');
  await expect(fila).toContainText('Acceso enviado · firmará en su tablet');
  expect(api.solicitudes).toHaveLength(1);

  // Otra tablet (sin nada guardado): la solicitud se sigue viendo porque viene de la API
  await olvidarCacheSolicitudes(page);
  await page.reload();
  await expect(fila).toHaveClass(/enviada/);
  await expect(fila).toContainText('Pedro Almonte');

  // Pedro la rechaza en su equipo: al volver a consultar, la fila lo muestra y se puede dar acceso de nuevo
  api.solicitudes[0].estado = 'Rechazada';
  api.solicitudes[0].comentario = 'No estuve en la descarga';
  await page.reload();
  await expect(fila).toContainText('Rechazó el acceso · No estuve en la descarga');
  await expect(fila).not.toHaveClass(/enviada/);
  await expect(fila.getByRole('button', { name: 'Dar acceso' })).toBeVisible();
});
