import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EventoUiDto } from '../api/types';
import { etiquetaElemento, infoClic, selectorCorto } from './etiqueta';
import { AlmacenMemoria, Rastreador } from './rastreador';

function montar(html: string) {
  document.body.innerHTML = html;
  return document.body;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('etiqueta de clics', () => {
  it('prioriza data-track, luego aria-label, luego el texto visible', () => {
    montar(`
      <button id="a" data-track="Guardar borrador" aria-label="otro">Texto</button>
      <button id="b" aria-label="Cerrar">×</button>
      <a id="c" href="#">  Ver   historial
        completo → </a>`);
    expect(etiquetaElemento(document.getElementById('a'))).toBe('Guardar borrador');
    expect(etiquetaElemento(document.getElementById('b'))).toBe('Cerrar');
    expect(etiquetaElemento(document.getElementById('c'))).toBe('Ver historial completo →');
  });

  it('recorta el texto a 80 caracteres', () => {
    montar(`<button id="x">${'a'.repeat(200)}</button>`);
    const e = etiquetaElemento(document.getElementById('x'))!;
    expect(e.length).toBe(80);
    expect(e.endsWith('…')).toBe(true);
  });

  it('sube al elemento accionable y arma un selector corto', () => {
    montar(`<nav class="pasos"><a class="paso actual" href="#"><span class="paso-num">4</span><span>Controles</span></a></nav>`);
    const span = document.querySelector('.paso-num')!;
    const info = infoClic(span)!;
    expect(info.elemento).toBe('4Controles');
    expect(info.selector).toBe('nav.pasos > a.paso.actual');
    expect(selectorCorto(document.querySelector('nav')!)).toBe('nav.pasos');
  });

  it('nunca usa el valor escrito en un campo; usa su etiqueta', () => {
    montar(`
      <label for="chofer">Chofer</label><input id="chofer" value="Ramón Antonio Peña">
      <textarea id="obs" placeholder="Observación (opcional)">texto privado</textarea>
      <select id="dest" name="destino"><option selected>C.H. Jigüey</option></select>`);
    expect(infoClic(document.getElementById('chofer'))!.elemento).toBe('Chofer');
    expect(infoClic(document.getElementById('obs'))!.elemento).toBe('Observación (opcional)');
    expect(infoClic(document.getElementById('dest'))!.elemento).toBe('destino');
  });

  it('ignora por completo los campos de contraseña (y su label)', () => {
    montar(`<label id="l" for="p">Contraseña</label><input id="p" type="password" value="secreta">`);
    expect(infoClic(document.getElementById('p'))).toBeNull();
    expect(infoClic(document.getElementById('l'))).toBeNull();
  });
});

describe('Rastreador', () => {
  const nuevo = (almacen: AlmacenMemoria, enviar: (e: EventoUiDto[]) => Promise<void>, extra = {}) =>
    new Rastreador({ almacen, enviar, ruta: () => '/fiscalizaciones/nueva', dispositivo: 'Pruebas', sesionId: 'ses-1', ...extra });

  it('registra clics en captura sin valores de inputs ni contraseñas', async () => {
    const almacen = new AlmacenMemoria();
    const r = nuevo(almacen, async () => {}, { intervaloMs: 60_000 });
    const quitar = r.instalar(window);
    montar(`
      <button id="g" data-track="Guardar borrador">Guardar</button>
      <input id="t" aria-label="Chofer" value="valor-secreto">
      <input id="p" type="password" value="clave-secreta">`);
    // un listener que corta la propagación no impide el registro (fase de captura)
    document.getElementById('g')!.addEventListener('click', (e) => e.stopPropagation());
    document.getElementById('g')!.click();
    document.getElementById('t')!.click();
    document.getElementById('p')!.click();
    await vi.waitFor(() => expect(almacen.items.length).toBe(2));
    quitar();
    const todo = JSON.stringify(almacen.items);
    expect(todo).not.toContain('valor-secreto');
    expect(todo).not.toContain('clave-secreta');
    const [a, b] = almacen.items.map((i) => i.evento);
    expect(a).toMatchObject({ tipo: 'click', elemento: 'Guardar borrador', ruta: '/fiscalizaciones/nueva', sesionId: 'ses-1' });
    expect((a.detalle as { selector: string }).selector).toBe('button#g');
    expect(b.elemento).toBe('Chofer');
  });

  it('envía por lotes (≤ tamaño de lote) y vacía la cola; si falla, conserva', async () => {
    const almacen = new AlmacenMemoria();
    const lotes: number[] = [];
    let fallar = true;
    const r = nuevo(almacen, async (e) => {
      if (fallar) throw new Error('sin red');
      lotes.push(e.length);
    }, { tamanoLote: 3 });
    for (let i = 0; i < 7; i++) await r.registrar('navegacion', `/r${i}`);
    await r.vaciar();
    expect(almacen.items.length).toBe(7);
    fallar = false;
    await r.vaciar();
    expect(lotes).toEqual([3, 3, 1]);
    expect(almacen.items.length).toBe(0);
  });

  it('no envía sin sesión o sin red', async () => {
    const almacen = new AlmacenMemoria();
    const enviar = vi.fn(async () => {});
    const r = nuevo(almacen, enviar, { puedeEnviar: () => false });
    await r.registrar('click', 'X');
    await r.vaciar();
    expect(enviar).not.toHaveBeenCalled();
  });

  it('registra online/offline y errores de la ventana; al volver la red envía', async () => {
    const almacen = new AlmacenMemoria();
    const enviados: EventoUiDto[] = [];
    const r = nuevo(almacen, async (e) => void enviados.push(...e), { intervaloMs: 60_000 });
    const quitar = r.instalar(window);
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new ErrorEvent('error', { message: 'Fallo X' }));
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(enviados.map((e) => e.tipo)).toEqual(['offline', 'error', 'online']));
    quitar();
    expect(enviados[1].elemento).toBe('Fallo X');
  });

  it('el intervalo de envío es de 10 s por defecto', async () => {
    vi.useFakeTimers();
    try {
      const almacen = new AlmacenMemoria();
      const enviar = vi.fn(async () => {});
      const r = nuevo(almacen, enviar);
      const quitar = r.instalar(window);
      await r.registrar('navegacion', '/');
      expect(enviar).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(enviar).toHaveBeenCalledTimes(1);
      quitar();
    } finally {
      vi.useRealTimers();
    }
  });
});
