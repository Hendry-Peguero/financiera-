import { expect, test } from '@playwright/test';
import { instalarApiVisual } from './apiMock';
import { comparar } from './comparar';
import { escenarioBase } from './fixtures/base';
import { PANTALLAS } from './pantallas';
import { AHORA, VIEWPORTS, type Tamano } from './pantallas/tipos';

/**
 * Captura cada pantalla con la API simulada (datos del diseño) y la compara con design-ref/png.
 * El resultado (porcentaje de píxeles distintos) queda en e2e/visual/report; el resumen lo escribe resumen.ts.
 * Filtrar: npx playwright test -c playwright.visual.config.ts -g "desktop-inicio"
 */
const LIMITE = Number(process.env.VISUAL_LIMITE ?? 100);

for (const p of PANTALLAS) {
  for (const tamano of p.tamanos) {
    const nombre = `${tamano}-${p.referencia?.[tamano] ?? p.id}`;
    test(nombre, async ({ browser }) => {
      const contexto = await browser.newContext({
        viewport: VIEWPORTS[tamano],
        locale: 'es-DO',
        timezoneId: 'America/Santo_Domingo',
        deviceScaleFactor: 1,
        hasTouch: tamano === 'movil',
      });
      const page = await contexto.newPage();
      const errores: string[] = [];
      page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));
      page.on('console', (m) => m.type() === 'error' && errores.push(`console: ${m.text()}`));
      const esc = escenarioBase();
      const cambiado = p.escenario?.(esc, tamano);
      const escenario = cambiado ?? esc;
      await instalarApiVisual(page, escenario);
      await page.clock.setFixedTime(AHORA);
      const almacen: Record<string, string> = { ...(p.localStorage ?? {}) };
      if (!p.anonimo && escenario.me) almacen['fisc.devUser'] = escenario.me.correo;
      await page.addInitScript((datos: Record<string, string>) => {
        // El diseño muestra la tablet sin conexión («Sin conexión», «Guardado local activo»).
        Object.defineProperty(Navigator.prototype, 'onLine', { get: () => false, configurable: true });
        for (const [k, v] of Object.entries(datos)) localStorage.setItem(k, v);
      }, almacen);

      const ruta = typeof p.ruta === 'function' ? p.ruta(tamano) : p.ruta;
      await page.goto(ruta);
      await page.addStyleTag({
        content: '*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}',
      });
      const listo = typeof p.listo === 'function' ? p.listo(tamano) : p.listo;
      if (listo)
        await page
          .locator(listo)
          .first()
          .waitFor({ state: 'visible', timeout: 15_000 })
          .catch(async (e: Error) => {
            comparar(nombre, await page.screenshot());
            throw new Error([e.message, ...errores].join('\n'));
          });
      let reloj = AHORA.getTime();
      await p.antes?.({
        page,
        tamano,
        avanzar: async (s) => {
          reloj += s * 1000;
          await page.clock.setFixedTime(new Date(reloj));
        },
      });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(400);
      await page.mouse.move(0, 0);
      const captura = await page.screenshot({ fullPage: false, animations: 'disabled', caret: 'hide' });
      if (process.env.VISUAL_MEDIR) {
        // Depuración: VISUAL_MEDIR=".kpi,.ini-cab" imprime las cajas de esos selectores.
        const cajas = await page.evaluate((sel) => {
          return sel.split(';').flatMap((s) =>
            Array.from(document.querySelectorAll(s))
              .slice(0, 12)
              .map((e) => {
                const r = e.getBoundingClientRect();
                return `${s} ${Math.round(r.x * 10) / 10},${Math.round(r.y * 10) / 10} ${Math.round(r.width * 10) / 10}×${Math.round(r.height * 10) / 10} «${(e.textContent ?? '').trim().slice(0, 30)}»`;
              }),
          );
        }, process.env.VISUAL_MEDIR);
        console.log(`\n[${nombre}]\n${cajas.join('\n')}`);
      }
      const r = comparar(nombre, captura);
      test.info().annotations.push({ type: 'diferencia', description: `${r.porcentaje.toFixed(2)} %` });
      await contexto.close();
      expect(r.porcentaje, `${nombre}: ${r.porcentaje.toFixed(2)} % de píxeles distintos`).toBeLessThanOrEqual(LIMITE);
    });
  }
}

export type { Tamano };
