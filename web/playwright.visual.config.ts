import { defineConfig } from '@playwright/test';

// Prueba visual: compara cada pantalla con design-ref/png (pixelmatch). API SIMULADA con page.route;
// la URL de API es ficticia para que ninguna petición llegue a la API real.
const PUERTO = Number(process.env.VISUAL_PORT ?? 5175);

export default defineConfig({
  testDir: './e2e/visual',
  testMatch: /.*\.visual\.ts$/,
  timeout: 60_000,
  fullyParallel: true,
  workers: Number(process.env.VISUAL_WORKERS ?? 4),
  reporter: [['list']],
  globalTeardown: './e2e/visual/resumen.ts',
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    locale: 'es-DO',
    timezoneId: 'America/Santo_Domingo',
    deviceScaleFactor: 1,
    browserName: 'chromium',
    // Suavizado en escala de grises y sin hinting, como el render del diseño (Pencil/Skia).
    launchOptions: { args: ['--disable-lcd-text', '--font-render-hinting=none'] },
  },
  webServer: {
    command: `npx vite --port ${PUERTO} --strictPort`,
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: !!process.env.VISUAL_REUSAR,
    timeout: 120_000,
    env: {
      VITE_AUTH_MODE: 'dev',
      VITE_API_URL: 'http://api.simulada.test/api',
      // compara a tamaño real del diseño (la app normal va al 80 %)
      VITE_ESCALA_DISENO: '1',
    },
  },
});
