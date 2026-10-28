import type { Page } from '@playwright/test';

/**
 * Simula una firma dibujada: escribe el texto con la fuente Caveat en el lienzo ([data-lienzo-firma]),
 * como la firma de ejemplo del diseño. Solo afecta la imagen del lienzo (prueba visual).
 */
export async function dibujarFirma(
  page: Page,
  texto: string,
  op: { tam?: number; peso?: number; x?: number; y?: number; selector?: string } = {},
) {
  await page.evaluate(
    async ({ texto, tam, peso, x, y, selector }) => {
      await document.fonts.load(`${peso} ${tam}px Caveat`);
      const c = document.querySelector<HTMLCanvasElement>(selector);
      const ctx = c?.getContext('2d');
      if (!c || !ctx) throw new Error('No hay lienzo de firma');
      const r = c.getBoundingClientRect();
      ctx.save();
      ctx.setTransform(c.width / r.width, 0, 0, c.height / r.height, 0, 0);
      ctx.font = `${peso} ${tam}px Caveat`;
      ctx.fillStyle = '#1e3a8a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(texto, x ?? r.width / 2, y ?? r.height / 2);
      ctx.restore();
    },
    { texto, tam: op.tam ?? 40, peso: op.peso ?? 400, x: op.x ?? null, y: op.y ?? null, selector: op.selector ?? '[data-lienzo-firma]' },
  );
}

/** Escribe en un campo sin disparar el rastreo de valores (solo para preparar la captura). */
export async function escribir(page: Page, etiqueta: string, valor: string) {
  await page.getByLabel(etiqueta, { exact: true }).fill(valor);
}
