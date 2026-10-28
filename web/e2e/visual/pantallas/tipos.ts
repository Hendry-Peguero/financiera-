import type { Page } from '@playwright/test';
import type { Escenario } from '../fixtures/base';

export type Tamano = 'desktop' | 'tablet-h' | 'tablet-v' | 'movil';

export const VIEWPORTS: Record<Tamano, { width: number; height: number }> = {
  desktop: { width: 1440, height: 900 },
  'tablet-h': { width: 1280, height: 800 },
  'tablet-v': { width: 800, height: 1280 },
  movil: { width: 390, height: 844 },
};

/** Momento fijo de las capturas (lunes 20/10/2026, mañana). */
export const AHORA = new Date('2026-10-20T10:47:00-04:00');

export interface Contexto {
  page: Page;
  tamano: Tamano;
  /** Avanza el reloj fijo (p. ej. «hace 12 s»). */
  avanzar: (segundos: number) => Promise<void>;
}

export interface Pantalla {
  /** Nombre del archivo de design-ref sin el prefijo del tamaño (p. ej. «inicio» → desktop-inicio.png). */
  id: string;
  /** Archivo de referencia distinto por tamaño (p. ej. móvil «detalle-del-registro»). */
  referencia?: Partial<Record<Tamano, string>>;
  tamanos: Tamano[];
  ruta: string | ((t: Tamano) => string);
  /** Escenario de datos (parte de escenarioBase()). */
  escenario?: (esc: Escenario, t: Tamano) => Escenario | void;
  /** Sin sesión iniciada (login). */
  anonimo?: boolean;
  /** Valores extra en localStorage antes de cargar. */
  localStorage?: Record<string, string>;
  /** Selector que indica que la pantalla terminó de cargar. */
  listo?: string | ((t: Tamano) => string);
  /** Acciones antes de la captura (abrir diálogo, escribir, dibujar…). */
  antes?: (c: Contexto) => Promise<void>;
}
