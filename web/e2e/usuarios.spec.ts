import { expect, test, type Page } from '@playwright/test';
import { instalarApiSimulada } from './apiSimulada';

const ADMIN = 'admin@egehid.test';

async function entrar(page: Page, correo: string) {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(correo);
  await page.getByRole('button', { name: /Entrar/ }).click();
}

const fila = (page: Page, texto: string) => page.getByRole('row').filter({ hasText: texto });

test('usuarios: el administrador registra por correo, cambia el rol y desactiva; no puede desactivarse a sí mismo', async ({ page }) => {
  const api = instalarApiSimulada(page, { correo: ADMIN, rol: 'Administrador' });
  await entrar(page, ADMIN);
  await page.getByRole('navigation', { name: 'ADMINISTRACIÓN' }).getByRole('link', { name: 'Usuarios' }).click();
  await expect(page).toHaveURL(/\/usuarios$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Usuarios' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /^Todos/ })).toContainText('3');
  await expect(page.getByRole('tab', { name: /^Desactivados/ })).toContainText('1');
  await expect(fila(page, 'Ana Lucía Pérez')).toContainText('Desactivado');

  // su propia cuenta: ni quitarse el rol ni desactivarse
  await expect(fila(page, ADMIN)).toContainText('Usted');
  await page.getByRole('button', { name: 'Acciones de María Rosario Peña' }).click();
  await expect(page.getByRole('menuitem', { name: /Desactivar usuario/ })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: /Cambiar a Auditor/ })).toBeDisabled();
  await page.keyboard.press('Escape');

  // registrar por correo: valida el correo y avisa si ya existe
  await page.getByRole('button', { name: 'Registrar usuario' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Registrar usuario' });
  await dialogo.getByLabel('Correo').fill('luis.feliz');
  await expect(dialogo).toContainText('Escriba un correo válido');
  await dialogo.getByLabel('Correo').fill('Luis.Feliz@EGEHID.test');
  await dialogo.getByLabel(/Firmante/).check();
  await dialogo.getByRole('button', { name: 'Registrar' }).click();
  await expect(dialogo).toBeHidden();
  await expect(page.getByRole('status').filter({ hasText: 'Se registró luis.feliz@egehid.test como Firmante' })).toBeVisible();
  await expect(fila(page, 'luis.feliz@egehid.test')).toContainText('Pendiente de ingreso');
  await expect(fila(page, 'luis.feliz@egehid.test')).toContainText('Firmante');

  await page.getByRole('button', { name: 'Registrar usuario' }).click();
  await dialogo.getByLabel('Correo').fill('luis.feliz@egehid.test');
  await dialogo.getByRole('button', { name: 'Registrar' }).click();
  await expect(dialogo).toContainText('Ya existe un usuario con ese correo.');
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();

  // cambiar el rol (confirma porque da permisos de administrador) y desactivar
  const preguntas: string[] = [];
  page.on('dialog', (d) => {
    preguntas.push(d.message());
    void d.accept();
  });
  await page.getByRole('button', { name: 'Acciones de Pedro Almonte' }).click();
  await page.getByRole('menuitem', { name: 'Cambiar a Administrador' }).click();
  await expect(fila(page, 'Pedro Almonte')).toContainText('Administrador');
  await expect(page.getByRole('status').filter({ hasText: 'Pedro Almonte ahora es Administrador.' })).toBeVisible();

  await page.getByRole('button', { name: 'Acciones de Pedro Almonte' }).click();
  await page.getByRole('menuitem', { name: 'Desactivar usuario' }).click();
  await expect(fila(page, 'Pedro Almonte')).toContainText('Desactivado');
  await expect(page.getByRole('tab', { name: /^Desactivados/ })).toContainText('2');
  expect(preguntas).toEqual([
    '¿Cambiar el rol de Pedro Almonte a Administrador?',
    '¿Desactivar a Pedro Almonte? No podrá entrar a la aplicación hasta que lo active de nuevo.',
  ]);

  // pestaña «Desactivados» y volver a activar
  await page.getByRole('tab', { name: /^Desactivados/ }).click();
  await expect(page.getByRole('row')).toHaveCount(3); // encabezado + Ana + Pedro
  await page.getByRole('button', { name: 'Acciones de Ana Lucía Pérez' }).click();
  await page.getByRole('menuitem', { name: 'Activar usuario' }).click();
  await expect(page.getByRole('row')).toHaveCount(2);

  const pedro = api.usuarios.find((u) => u.nombreCompleto === 'Pedro Almonte')!;
  expect(pedro).toMatchObject({ rol: 'Administrador', activo: false });
  expect(api.noGet.filter((x) => x.includes('/admin/usuarios'))).toEqual([
    'POST /admin/usuarios',
    'POST /admin/usuarios',
    `PUT /admin/usuarios/${pedro.id}/rol`,
    `POST /admin/usuarios/${pedro.id}/desactivar`,
    'POST /admin/usuarios/55555555-5555-4555-8555-555555555555/activar',
  ]);
});

test('usuarios: un auditor no ve el menú ni la pantalla', async ({ page }) => {
  const pedidos: string[] = [];
  page.on('request', (r) => r.url().includes('/admin/usuarios') && pedidos.push(r.url()));
  instalarApiSimulada(page, { correo: 'auditor@egehid.test', rol: 'Auditor' });
  await entrar(page, 'auditor@egehid.test');
  await expect(page.getByRole('heading', { level: 1, name: /Buen(os|as) (días|tardes|noches)/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Usuarios' })).toHaveCount(0);
  await page.goto('/usuarios');
  await expect(page).toHaveURL(/\/$/);
  expect(pedidos).toEqual([]);
});

test('usuarios: un usuario desactivado ve el aviso y puede cerrar sesión', async ({ page }) => {
  instalarApiSimulada(page, { correo: 'desactivado@egehid.test', desactivado: true });
  await entrar(page, 'desactivado@egehid.test');
  await expect(page.getByRole('alert')).toContainText('Su usuario está desactivado. Pida a un administrador de la aplicación que lo active.');
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login/);
});
