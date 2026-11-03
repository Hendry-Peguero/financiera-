import { describe, expect, it } from 'vitest';
import type { CampoPlantillaDto } from '../api/plantillas';
import {
  aDto,
  analizarFormula,
  aPagina,
  arrastrar,
  desdeDto,
  firmaCampos,
  insignia,
  limpiarIdentificador,
  nuevoCampo,
  subtitulo,
  validarCampos,
} from './plantillasLogica';

const PAGINA = { ancho: 440, alto: 600 };

const campo = (identificador: string, extra: Partial<CampoPlantillaDto> = {}): CampoPlantillaDto => ({
  identificador,
  etiqueta: identificador,
  tipo: 'Numero',
  formula: null,
  pagina: 1,
  x: 170,
  y: 60,
  ancho: 110,
  alto: 16,
  obligatorio: false,
  enEstadisticas: false,
  imprimirPdf: true,
  ...extra,
});

describe('lista de plantillas', () => {
  it('insignia: borrador en edición, activa o desactivada', () => {
    expect(insignia({ estado: 'Activa', versionBorrador: 4 })).toEqual(['b-warn', 'Borrador v4']);
    expect(insignia({ estado: 'Activa', versionBorrador: null })).toEqual(['b-ok', 'Activa']);
    expect(insignia({ estado: 'Desactivada', versionBorrador: 2 })).toEqual(['b-neutral', 'Desactivada']);
    expect(insignia({ estado: 'Borrador', versionBorrador: 1 })).toEqual(['b-warn', 'Borrador v1']);
  });

  it('subtítulo con la versión vigente (o la del borrador si nunca se publicó)', () => {
    expect(subtitulo({ tipo: 'Personalizada', version: 3, versionBorrador: 4, totalCampos: 46 })).toBe('Personalizada · v3 · 46 campos');
    expect(subtitulo({ tipo: 'Personalizada', version: 0, versionBorrador: 1, totalCampos: 0 })).toBe('Personalizada · v1 · 0 campos');
  });
});

describe('fórmulas', () => {
  it('acepta + − × ÷, paréntesis y signo, y devuelve los identificadores', () => {
    expect(analizarFormula('cant_recibida − cant_facturada')).toEqual({ referencias: ['cant_recibida', 'cant_facturada'], error: null });
    expect(analizarFormula('(a + b) × 2 ÷ -c').referencias).toEqual(['a', 'b', 'c']);
    expect(analizarFormula('a*a/1.5').referencias).toEqual(['a']);
  });

  it.each(['a +', '(a + b', 'a b', 'a % b', '1..2', ''])('«%s» es inválida', (f) => {
    expect(analizarFormula(f).error).not.toBeNull();
  });
});

describe('validación (mismas reglas que la API)', () => {
  it('borrador: identificador único y con formato, dentro de la página', () => {
    const cs = desdeDto([campo('cant'), campo('cant'), campo('Mal'), campo('lejos', { x: 400 }), campo('pag2', { pagina: 2 })]);
    const e = validarCampos(cs, [PAGINA], false);
    expect(e[cs[0].clave]).toBeUndefined();
    expect(e[cs[1].clave]?.[0]).toMatch(/repetido/);
    expect(e[cs[2].clave]?.[0]).toMatch(/minúsculas/);
    expect(e[cs[3].clave]?.[0]).toMatch(/fuera de la página/);
    expect(e[cs[4].clave]?.[0]).toMatch(/página debe estar/);
  });

  it('borrador: la fórmula incompleta se puede guardar; publicar la valida', () => {
    const cs = desdeDto([campo('recibida'), campo('lote', { tipo: 'Texto' }), campo('dif', { tipo: 'Formula', formula: 'recibida − facturada' })]);
    expect(validarCampos(cs, [PAGINA], false)).toEqual({});
    expect(validarCampos(cs, [PAGINA], true)[cs[2].clave]).toEqual(['La fórmula usa «facturada», que no existe.']);
    cs[2].formula = 'recibida * lote';
    expect(validarCampos(cs, [PAGINA], true)[cs[2].clave]?.[0]).toMatch(/no es numérico/);
    cs[2].formula = 'dif + 1';
    expect(validarCampos(cs, [PAGINA], true)[cs[2].clave]?.[0]).toMatch(/su propio campo/);
  });

  it('publicar sin campos no se permite', () => {
    expect(validarCampos([], [PAGINA], true)['']).toEqual(['Agregue al menos un campo antes de publicar.']);
  });
});

describe('edición', () => {
  it('identificador: minúsculas, sin tildes, _ en lugar de otros símbolos', () => {
    expect(limpiarIdentificador('Diferencia Cubetas-2º')).toBe('diferencia_cubetas_2_');
    expect(limpiarIdentificador('Recepción')).toBe('recepcion');
  });

  it('campo nuevo con identificador libre, tamaño por tipo y dentro de la página', () => {
    const cs = desdeDto([campo('campo_2')]);
    const n = nuevoCampo('Firma', 1, 400, 590, cs, PAGINA);
    expect(n).toMatchObject({ identificador: 'campo_3', tipo: 'Firma', formula: null, x: 260, y: 560, ancho: 180, alto: 40 });
    expect(nuevoCampo('Formula', 1, 10, 10, [], PAGINA)).toMatchObject({ identificador: 'campo_1', formula: '' });
  });

  it('pantalla → puntos de la página con el tamaño medido (al 80 % y al 100 %)', () => {
    // al 100 %: la página mide 440 px para 440 pt
    expect(aPagina(270, 160, { left: 100, top: 100, width: 440 }, PAGINA)).toEqual({ x: 170, y: 60 });
    // al 80 %: mide 352 px; el mismo punto de la página está 20 % más cerca
    expect(aPagina(236, 148, { left: 100, top: 100, width: 352 }, PAGINA)).toEqual({ x: 170, y: 60 });
    // carta (612 pt) dibujada en 440 px
    expect(aPagina(100 + 220, 100, { left: 100, top: 100, width: 440 }, { ancho: 612, alto: 792 }).x).toBeCloseTo(306);
  });

  it('arrastrar mueve o cambia el tamaño con el delta escalado y no sale de la página', () => {
    const caja = { x: 170, y: 252, ancho: 110, alto: 16 };
    expect(arrastrar(caja, 8, -4, 1.25, 'mover', PAGINA)).toEqual({ x: 180, y: 247, ancho: 110, alto: 16 });
    expect(arrastrar(caja, 1000, 1000, 1, 'mover', PAGINA)).toEqual({ x: 330, y: 584, ancho: 110, alto: 16 });
    expect(arrastrar(caja, 40, 8, 1, 'tamano', PAGINA)).toEqual({ x: 170, y: 252, ancho: 150, alto: 24 });
    expect(arrastrar(caja, 1000, -100, 1, 'tamano', PAGINA)).toEqual({ x: 170, y: 252, ancho: 270, alto: 4 });
  });

  it('aDto quita la clave local y deja la fórmula solo en campos Diferencia', () => {
    const cs = desdeDto([campo('a', { formula: 'x' }), campo('d', { tipo: 'Formula', formula: null })]);
    expect(aDto(cs)).toEqual([campo('a'), campo('d', { tipo: 'Formula', formula: '' })]);
    expect(firmaCampos('X', cs)).toBe(firmaCampos('X', desdeDto(aDto(cs))));
  });
});
