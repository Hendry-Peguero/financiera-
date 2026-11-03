import { useSyncExternalStore } from 'react';

/** Tamaños del diseño: Desktop (≥1366), Tablet H (1024–1365), Tablet V (600–1023), Móvil (<600). */
export type Tamano = 'desktop' | 'tablet-h' | 'tablet-v' | 'movil';

export function tamanoDe(ancho: number): Tamano {
  if (ancho >= 1366) return 'desktop';
  if (ancho >= 1024) return 'tablet-h';
  if (ancho >= 600) return 'tablet-v';
  return 'movil';
}

function suscribir(cb: () => void) {
  window.addEventListener('resize', cb);
  return () => window.removeEventListener('resize', cb);
}

export function useTamano(): Tamano {
  return useSyncExternalStore(
    suscribir,
    () => tamanoDe(window.innerWidth),
    () => 'desktop' as Tamano,
  );
}

/** Tablet V y móvil usan navegación inferior (sin barra lateral). */
export function esCompacto(t: Tamano) {
  return t === 'tablet-v' || t === 'movil';
}

/** La prueba visual compara al 100 % del diseño (VITE_ESCALA_DISENO); la app normal va al 80 %. */
export function escalaDiseno(): boolean {
  return document.documentElement.classList.contains('escala-diseno');
}
