import fs from 'node:fs';
import path from 'node:path';
import { DIR_REPORTE, DIR_RESULTADOS, type Resultado } from './comparar';

const ORDEN = ['desktop', 'tablet-h', 'tablet-v', 'movil'];

/** globalTeardown: tabla con el % de píxeles distintos por pantalla (report/resumen.md y report/index.html). */
export default function resumen() {
  if (!fs.existsSync(DIR_RESULTADOS)) return;
  const res: Resultado[] = fs
    .readdirSync(DIR_RESULTADOS)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(DIR_RESULTADOS, f), 'utf8')) as Resultado);
  const tam = (p: string) => ORDEN.findIndex((o) => p.startsWith(`${o}-`));
  res.sort((a, b) => tam(a.pantalla) - tam(b.pantalla) || a.pantalla.localeCompare(b.pantalla));
  const filas = res.map((r) => `| ${r.pantalla} | ${r.porcentaje.toFixed(2)} % | ${r.diferentes} |`);
  const md = [
    '# Comparación visual con el diseño',
    '',
    `Generado: ${new Date().toISOString()} · pixelmatch (threshold 0.1, sin antialias)`,
    '',
    '| Pantalla | % píxeles distintos | Píxeles |',
    '|---|---:|---:|',
    ...filas,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(DIR_REPORTE, 'resumen.md'), md);
  const html = `<!doctype html><meta charset="utf-8"><title>Comparación visual</title>
<style>body{font:13px system-ui;margin:16px}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px}
img{max-width:32vw;border:1px solid #ccc}.f{display:flex;gap:8px;margin:8px 0 24px}</style>
<h1>Comparación visual</h1><table><tr><th>Pantalla</th><th>%</th></tr>${res
    .map((r) => `<tr><td><a href="#${r.pantalla}">${r.pantalla}</a></td><td>${r.porcentaje.toFixed(2)} %</td></tr>`)
    .join('')}</table>${res
    .map(
      (r) =>
        `<h2 id="${r.pantalla}">${r.pantalla} · ${r.porcentaje.toFixed(2)} %</h2><div class="f"><img src="../../../design-ref/png/${r.pantalla}.png"><img src="${r.pantalla}.actual.png"><img src="${r.pantalla}.diff.png"></div>`,
    )
    .join('')}`;
  fs.writeFileSync(path.join(DIR_REPORTE, 'index.html'), html);
  console.log(`\n${md}`);
}
