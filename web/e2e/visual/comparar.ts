import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));
export const DIR_REF = path.resolve(aqui, '../../design-ref/png');
export const DIR_REPORTE = path.resolve(aqui, 'report');
export const DIR_RESULTADOS = path.join(DIR_REPORTE, 'resultados');

export interface Resultado {
  pantalla: string;
  ancho: number;
  alto: number;
  diferentes: number;
  porcentaje: number;
}

export function leerReferencia(pantalla: string): PNG {
  return PNG.sync.read(fs.readFileSync(path.join(DIR_REF, `${pantalla}.png`)));
}

/** Recorta una zona de la imagen de referencia (fotos y firmas de ejemplo del diseño). */
export function recortarReferencia(pantalla: string, x: number, y: number, w: number, h: number): Buffer {
  const ref = leerReferencia(pantalla);
  const out = new PNG({ width: w, height: h });
  PNG.bitblt(ref, out, x, y, w, h, 0, 0);
  return PNG.sync.write(out);
}

/** Compara la captura con design-ref/png/<pantalla>.png y guarda captura, diferencia y resultado. */
export function comparar(pantalla: string, captura: Buffer): Resultado {
  const ref = leerReferencia(pantalla);
  const act = PNG.sync.read(captura);
  const { width, height } = ref;
  if (act.width !== width || act.height !== height)
    throw new Error(`${pantalla}: tamaño ${act.width}×${act.height} distinto de la referencia ${width}×${height}`);
  const diff = new PNG({ width, height });
  const diferentes = pixelmatch(ref.data, act.data, diff.data, width, height, { threshold: 0.1, alpha: 0.35 });
  fs.mkdirSync(DIR_RESULTADOS, { recursive: true });
  fs.writeFileSync(path.join(DIR_REPORTE, `${pantalla}.actual.png`), captura);
  fs.writeFileSync(path.join(DIR_REPORTE, `${pantalla}.diff.png`), PNG.sync.write(diff));
  const r: Resultado = { pantalla, ancho: width, alto: height, diferentes, porcentaje: (100 * diferentes) / (width * height) };
  fs.writeFileSync(path.join(DIR_RESULTADOS, `${pantalla}.json`), JSON.stringify(r));
  return r;
}
