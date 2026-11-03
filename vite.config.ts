/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { readFileSync } from 'node:fs';

/** Versión del paquete web: la app Android la compara con la publicada para actualizarse sola. */
const version = (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }).version;
import type { Plugin as PluginPostcss } from 'postcss';

/**
 * Los estilos se escriben en px del diseño; aquí se pasan a rem (px / 16) para que toda la interfaz escale con el
 * font-size de <html> (base.css lo fija en 80 %). Quedan en px los valores menores de 2px (bordes finos, redondeo
 * del alto de línea) y los @media (anchos reales de pantalla).
 */
const conPiso = new WeakSet<object>(); // PostCSS vuelve a visitar la declaración cambiada: no convertir su 10px
const pxARem: PluginPostcss = {
  postcssPlugin: 'px-a-rem',
  Declaration(decl) {
    if (!decl.value.includes('px') || conPiso.has(decl)) return;
    // Textos: al 80 % no bajan de 10px (ni del tamaño del diseño si era menor). Al 100 % queda igual que el diseño.
    // Las hojas del PDF (.pdf-*, .pl-*-pdf/.pl-pdf-*) se escalan completas, sin piso.
    const fuente = decl.prop === 'font-size' ? /^(\d*\.?\d+)px$/.exec(decl.value.trim()) : null;
    const selector = decl.parent?.type === 'rule' ? (decl.parent as { selector: string }).selector : '';
    if (fuente && Number(fuente[1]) < 12.5 && !/\.pdf-|\.pl-[\w-]*pdf/.test(selector)) {
      const v = Number(fuente[1]);
      decl.value = `max(${+(v / 16).toFixed(5)}rem, ${Math.min(v, 10)}px)`;
      conPiso.add(decl);
      return;
    }
    decl.value = decl.value.replace(/(?<![\w.#-])(-?\d*\.?\d+)px\b/g, (m, n: string) => {
      const v = Number(n);
      return Math.abs(v) < 2 ? m : `${+(v / 16).toFixed(5)}rem`;
    });
  },
};

/**
 * Modo «tablet» (npm run tablet, PRUEBA): la tablet entra por la red local a https://<IP de la PC>:5173.
 * HTTPS con certificado autofirmado porque crypto.randomUUID / crypto.subtle solo existen en contexto seguro, y
 * /api se pasa a la API local (localhost:5080): misma origen, sin CORS y la API no se expone a la red.
 */
export default defineConfig(({ mode }) => ({
  plugins: mode === 'tablet' ? [react(), basicSsl()] : [react()],
  css: { postcss: { plugins: [pxARem] } },
  define: { 'import.meta.env.VITE_VERSION_APP': JSON.stringify(version) },
  server:
    mode === 'tablet'
      ? { port: 5173, strictPort: true, host: true, proxy: { '/api': { target: 'http://localhost:5080', changeOrigin: true } } }
      : { port: 5173, strictPort: true },
  build: {
    rolldownOptions: {
      output: {
        // librerías aparte: el código de la app cambia más seguido que React/Auth0/Dexie
        codeSplitting: {
          groups: [
            // pdf.js va aparte y solo se descarga al abrir una plantilla con PDF (import dinámico en pantallas/pdfjs.ts)
            { name: 'pdfjs', test: /node_modules[\\/]pdfjs-dist[\\/]/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
            // exceljs (~1 MB) queda fuera: solo se carga al exportar a Excel (import dinámico)
            { name: 'vendor', test: /node_modules[\\/](?!exceljs[\\/])/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
}));
