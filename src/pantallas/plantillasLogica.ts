import type { CampoPlantillaDto, PaginaDto, PlantillaResumenDto, TipoCampo } from '../api/plantillas';

/**
 * Lógica del editor de plantillas (sin React): mismas reglas que la API (ReglasPlantillas.cs) para avisar antes de
 * guardar o publicar, y la conversión de coordenadas de pantalla a puntos de la página.
 */
export const MAX_PDF = 4 * 1024 * 1024;
export const MAX_PAGINAS = 10;
const MAX_IDENTIFICADOR = 80;
const MAX_ETIQUETA = 150;
const MAX_FORMULA = 500;

/** Campo en edición: `clave` identifica el campo en la pantalla aunque cambie el identificador. */
export interface CampoEditor extends CampoPlantillaDto {
  clave: string;
}

let secuencia = 0;
const nuevaClave = () => `c${++secuencia}`;

export const desdeDto = (campos: CampoPlantillaDto[]): CampoEditor[] => campos.map((c) => ({ ...c, clave: nuevaClave() }));

export const aDto = (campos: CampoEditor[]): CampoPlantillaDto[] =>
  campos.map(({ clave: _clave, ...c }) => ({ ...c, formula: c.tipo === 'Formula' ? (c.formula ?? '') : null }));

/** Tamaño inicial (puntos) de un campo nuevo según su tipo. */
export const TAM_NUEVO: Record<TipoCampo, [number, number]> = {
  Texto: [140, 16],
  Numero: [110, 16],
  Fecha: [110, 16],
  Casilla: [16, 16],
  Firma: [180, 40],
  Formula: [110, 16],
};

/** Insignia de la lista: borrador en edición, activa o desactivada. */
export function insignia(p: Pick<PlantillaResumenDto, 'estado' | 'versionBorrador'>): [clase: string, texto: string] {
  if (p.estado === 'Desactivada') return ['b-neutral', 'Desactivada'];
  if (p.versionBorrador) return ['b-warn', `Borrador v${p.versionBorrador}`];
  return ['b-ok', 'Activa'];
}

export const subtitulo = (p: Pick<PlantillaResumenDto, 'tipo' | 'version' | 'versionBorrador' | 'totalCampos'>) =>
  `${p.tipo} · v${p.version || p.versionBorrador || 1} · ${p.totalCampos} campos`;

export const identificadorValido = (id: string) => id.length <= MAX_IDENTIFICADOR && /^[a-z][a-z0-9_]*$/.test(id);

/** Lo que el usuario escribe → minúsculas, números y _ (sin tildes). */
export const limpiarIdentificador = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .slice(0, MAX_IDENTIFICADOR);

export const esNumerico = (t: TipoCampo) => t === 'Numero' || t === 'Formula';

/**
 * Sintaxis de las fórmulas: números, identificadores, + − * / (también − × ÷), paréntesis y signo negativo.
 * Devuelve los identificadores usados o el error.
 */
export function analizarFormula(formula: string): { referencias: string[]; error: string | null } {
  const s = formula;
  let i = 0;
  const refs: string[] = [];
  const espacios = () => {
    while (i < s.length && /\s/.test(s[i])) i++;
  };
  const tomar = (ops: string) => {
    espacios();
    if (i < s.length && ops.includes(s[i])) {
      i++;
      return true;
    }
    return false;
  };
  const expresion = (): void => {
    termino();
    while (tomar('+-−')) termino();
  };
  const termino = (): void => {
    factor();
    while (tomar('*×/÷')) factor();
  };
  const factor = (): void => {
    if (tomar('-−')) return factor();
    if (tomar('(')) {
      expresion();
      if (!tomar(')')) throw new Error('Falta cerrar un paréntesis en la fórmula.');
      return;
    }
    espacios();
    if (i >= s.length) throw new Error('La fórmula está incompleta.');
    const inicio = i;
    if (/[0-9.]/.test(s[i])) {
      while (i < s.length && /[0-9.]/.test(s[i])) i++;
      const n = s.slice(inicio, i);
      if (!/^(\d+\.?\d*|\.\d+)$/.test(n)) throw new Error(`Número inválido «${n}» en la fórmula.`);
      return;
    }
    if (/[a-z_]/.test(s[i])) {
      while (i < s.length && /[a-z0-9_]/.test(s[i])) i++;
      refs.push(s.slice(inicio, i));
      return;
    }
    throw new Error(`Símbolo inesperado «${s[i]}» en la fórmula.`);
  };
  try {
    expresion();
    espacios();
    if (i < s.length) throw new Error(`Símbolo inesperado «${s[i]}» en la fórmula.`);
    return { referencias: [...new Set(refs)], error: null };
  } catch (e) {
    return { referencias: [], error: (e as Error).message };
  }
}

/**
 * Errores por campo (clave local). `publicar` agrega las reglas de publicación: al menos un campo y fórmulas que
 * usan identificadores numéricos existentes. Para guardar el borrador basta con lo demás. La clave `''` es general.
 */
export function validarCampos(campos: CampoEditor[], paginas: PaginaDto[], publicar: boolean): Record<string, string[]> {
  const errores: Record<string, string[]> = {};
  const agregar = (clave: string, m: string) => (errores[clave] ??= []).push(m);
  const vistos = new Set<string>();
  for (const c of campos) {
    if (!identificadorValido(c.identificador))
      agregar(c.clave, 'El identificador usa minúsculas, números y _ (empieza por letra, máx. 80).');
    else if (vistos.has(c.identificador)) agregar(c.clave, `El identificador «${c.identificador}» está repetido.`);
    vistos.add(c.identificador);
    if (!c.etiqueta.trim()) agregar(c.clave, 'Falta la etiqueta visible.');
    else if (c.etiqueta.length > MAX_ETIQUETA) agregar(c.clave, `La etiqueta supera ${MAX_ETIQUETA} caracteres.`);
    if ((c.formula?.length ?? 0) > MAX_FORMULA) agregar(c.clave, `La fórmula supera ${MAX_FORMULA} caracteres.`);
    const p = paginas[c.pagina - 1];
    if (!p) agregar(c.clave, `La página debe estar entre 1 y ${paginas.length}.`);
    else {
      if (c.ancho <= 0 || c.alto <= 0) agregar(c.clave, 'El ancho y el alto deben ser mayores que 0.');
      if (c.x < 0 || c.y < 0 || c.x + c.ancho > p.ancho + 1 || c.y + c.alto > p.alto + 1)
        agregar(c.clave, 'El campo queda fuera de la página.');
    }
  }
  if (!publicar) return errores;
  if (campos.length === 0) agregar('', 'Agregue al menos un campo antes de publicar.');
  const porId = new Map(campos.map((c) => [c.identificador, c]));
  for (const c of campos.filter((x) => x.tipo === 'Formula')) {
    if (!c.formula?.trim()) {
      agregar(c.clave, 'Falta la fórmula.');
      continue;
    }
    const { referencias, error } = analizarFormula(c.formula);
    if (error) {
      agregar(c.clave, error);
      continue;
    }
    for (const r of referencias) {
      const otro = porId.get(r);
      if (r === c.identificador) agregar(c.clave, 'La fórmula no puede usar su propio campo.');
      else if (!otro) agregar(c.clave, `La fórmula usa «${r}», que no existe.`);
      else if (!esNumerico(otro.tipo)) agregar(c.clave, `«${r}» no es numérico (use campos Número o Diferencia).`);
    }
  }
  return errores;
}

/** Campo nuevo de la herramienta elegida en (x, y), con un identificador libre y dentro de la página. */
export function nuevoCampo(tipo: TipoCampo, pagina: number, x: number, y: number, campos: CampoEditor[], p: PaginaDto): CampoEditor {
  const [ancho, alto] = TAM_NUEVO[tipo];
  const usados = new Set(campos.map((c) => c.identificador));
  let n = campos.length + 1;
  while (usados.has(`campo_${n}`)) n++;
  return {
    clave: nuevaClave(),
    identificador: `campo_${n}`,
    etiqueta: `Campo ${n}`,
    tipo,
    formula: tipo === 'Formula' ? '' : null,
    pagina,
    ...limitar({ x, y, ancho: Math.min(ancho, p.ancho), alto: Math.min(alto, p.alto) }, p),
    obligatorio: false,
    enEstadisticas: false,
    imprimirPdf: true,
  };
}

type Caja = Pick<CampoPlantillaDto, 'x' | 'y' | 'ancho' | 'alto'>;

/** Redondea a enteros y mantiene la caja dentro de la página. */
export function limitar(c: Caja, p: PaginaDto): Caja {
  const ancho = Math.max(4, Math.min(Math.round(c.ancho), Math.floor(p.ancho)));
  const alto = Math.max(4, Math.min(Math.round(c.alto), Math.floor(p.alto)));
  return {
    x: Math.max(0, Math.min(Math.round(c.x), Math.floor(p.ancho) - ancho)),
    y: Math.max(0, Math.min(Math.round(c.y), Math.floor(p.alto) - alto)),
    ancho,
    alto,
  };
}

/**
 * Píxeles de pantalla → puntos de la página. Usa el tamaño medido del elemento (getBoundingClientRect), no px fijos:
 * la interfaz se dibuja al 80 % (rem) y al 100 % en la prueba visual.
 */
export function escala(rect: Pick<DOMRect, 'width'>, p: PaginaDto) {
  return rect.width > 0 ? p.ancho / rect.width : 1;
}

export function aPagina(clienteX: number, clienteY: number, rect: Pick<DOMRect, 'left' | 'top' | 'width'>, p: PaginaDto) {
  const k = escala(rect, p);
  return { x: (clienteX - rect.left) * k, y: (clienteY - rect.top) * k };
}

/** Arrastre: mueve (`mover`) o cambia el tamaño desde la esquina inferior derecha, con el delta en píxeles. */
export function arrastrar(inicial: Caja, dxPx: number, dyPx: number, k: number, modo: 'mover' | 'tamano', p: PaginaDto): Caja {
  const dx = dxPx * k;
  const dy = dyPx * k;
  if (modo === 'mover') return limitar({ ...inicial, x: inicial.x + dx, y: inicial.y + dy }, p);
  return limitar(
    {
      ...inicial,
      ancho: Math.min(inicial.ancho + dx, p.ancho - inicial.x),
      alto: Math.min(inicial.alto + dy, p.alto - inicial.y),
    },
    p,
  );
}

/** Mismos datos (para saber si hay cambios sin guardar). */
export const firmaCampos = (nombre: string, campos: CampoEditor[]) => JSON.stringify([nombre, aDto(campos)]);
