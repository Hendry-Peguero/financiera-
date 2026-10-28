import type { Page } from '@playwright/test';
import { MARIA, type Escenario } from './base';

/** Correo y contraseña de ejemplo del diseño (desktop-login.html). */
export async function escribirAcceso(page: Page) {
  await page.locator('#login-correo').fill('maria.rosario@hidroelectrica.gov.do');
  const clave = page.locator('#login-clave');
  if (await clave.count()) await clave.fill('contrasena12');
}

/** Primer ingreso: perfil aún incompleto, con nombre y cargo ya escritos. */
export function escenarioPrimerIngreso(esc: Escenario) {
  esc.me = { ...MARIA, perfilCompleto: false, tieneFirma: false };
}
