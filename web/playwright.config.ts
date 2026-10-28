import { defineConfig, devices } from '@playwright/test';

// E2E con la API SIMULADA (page.route). El servidor de Vite usa una URL de API ficticia para que
// ninguna petición pueda llegar a la API real aunque esté encendida.
const PUERTO = 5174;

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/visual/**'],
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    trace: 'retain-on-failure',
    locale: 'es-DO',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `npx vite --port ${PUERTO} --strictPort`,
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_AUTH_MODE: 'dev',
      VITE_API_URL: 'http://api.simulada.test/api',
    },
  },
});
