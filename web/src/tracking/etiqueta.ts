/**
 * Extracción de la etiqueta y el selector de un elemento clicado, para la bitácora de UI.
 * NUNCA se lee el valor de inputs/textarea/select, y nada de campos de contraseña.
 */

const ACCIONABLE =
  '[data-track],a,button,[role="button"],[role="tab"],[role="link"],[role="menuitem"],[role="option"],[role="radio"],[role="checkbox"],[role="switch"],summary,label,input,select,textarea';

const MAX_ETIQUETA = 80;

function limpiar(t: string | null | undefined): string {
  return (t ?? '').replace(/\s+/g, ' ').trim();
}

function recortar(t: string, max = MAX_ETIQUETA): string {
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export function esCampoPassword(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLInputElement && el.type === 'password') return true;
  // Un clic dentro de un label/contenedor asociado a un password también se ignora
  const label = el.closest('label');
  if (label) {
    const ctrl = (label as HTMLLabelElement).control;
    if (ctrl instanceof HTMLInputElement && ctrl.type === 'password') return true;
    if (label.querySelector('input[type="password"]')) return true;
  }
  return false;
}

/** Elemento "significativo" más cercano al objetivo del clic. */
export function elementoAccionable(objetivo: Element | null): Element | null {
  if (!objetivo) return null;
  return objetivo.closest(ACCIONABLE) ?? objetivo;
}

function esCampoDeEntrada(el: Element): boolean {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
}

function textoVisible(el: Element): string {
  // innerText no existe en jsdom; textContent es el respaldo.
  const html = el as HTMLElement;
  const t = typeof html.innerText === 'string' && html.innerText !== '' ? html.innerText : el.textContent;
  return limpiar(t);
}

/** Nombre accesible para campos de entrada SIN leer su valor. */
function nombreDeCampo(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
  const labels = el.labels ? Array.from(el.labels) : [];
  const deLabel = labels
    .map((l) => {
      // texto del label sin el texto de controles anidados (p. ej. opciones de un select)
      const copia = l.cloneNode(true) as HTMLElement;
      copia.querySelectorAll('input,select,textarea,option').forEach((n) => n.remove());
      return limpiar(copia.textContent);
    })
    .find((t) => t);
  if (deLabel) return deLabel;
  const ph = el.getAttribute('placeholder');
  if (ph) return limpiar(ph);
  const nombre = el.getAttribute('name') ?? el.id;
  if (nombre) return nombre;
  return el instanceof HTMLInputElement ? `input[${el.type}]` : el.tagName.toLowerCase();
}

/**
 * Etiqueta: data-track → aria-label → innerText recortado (80). Para campos de entrada se usa
 * su label/placeholder/name (nunca su valor). Devuelve null si es un campo de contraseña.
 */
export function etiquetaElemento(el: Element | null): string | null {
  if (!el) return null;
  if (esCampoPassword(el)) return null;
  const track = el.getAttribute('data-track');
  if (track) return recortar(limpiar(track));
  const aria = el.getAttribute('aria-label');
  if (aria) return recortar(limpiar(aria));
  if (esCampoDeEntrada(el)) return recortar(nombreDeCampo(el as HTMLInputElement));
  if (el instanceof HTMLLabelElement) {
    const ctrl = el.control;
    if (ctrl && esCampoPassword(ctrl)) return null;
    const copia = el.cloneNode(true) as HTMLElement;
    copia.querySelectorAll('input,select,textarea,option').forEach((n) => n.remove());
    const t = limpiar(copia.textContent);
    return t ? recortar(t) : null;
  }
  const texto = textoVisible(el);
  if (texto) return recortar(texto);
  const title = el.getAttribute('title') ?? el.getAttribute('alt');
  if (title) return recortar(limpiar(title));
  return null;
}

function parteSelector(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (el.id && /^[A-Za-z][\w-]*$/.test(el.id)) return `${tag}#${el.id}`;
  const clases = Array.from(el.classList)
    .filter((c) => /^[A-Za-z][\w-]*$/.test(c))
    .slice(0, 2);
  return clases.length ? `${tag}.${clases.join('.')}` : tag;
}

/** Selector CSS corto: hasta 3 niveles, se detiene en el primer ancestro con id. */
export function selectorCorto(el: Element | null, niveles = 3): string {
  if (!el) return '';
  const partes: string[] = [];
  let actual: Element | null = el;
  while (actual && partes.length < niveles && actual.tagName !== 'BODY' && actual.tagName !== 'HTML') {
    const p = parteSelector(actual);
    partes.unshift(p);
    if (p.includes('#')) break;
    actual = actual.parentElement;
  }
  return partes.join(' > ').slice(0, 160);
}

export interface InfoClic {
  elemento: string | null;
  selector: string;
}

/** Información de un clic o null si NO debe registrarse (password). */
export function infoClic(objetivo: EventTarget | null): InfoClic | null {
  if (!(objetivo instanceof Element)) return null;
  if (esCampoPassword(objetivo)) return null;
  const el = elementoAccionable(objetivo);
  if (!el || esCampoPassword(el)) return null;
  return { elemento: etiquetaElemento(el), selector: selectorCorto(el) };
}
