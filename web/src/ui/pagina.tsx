import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react';

/** Lo que cada pantalla le indica al Shell (migas de la barra superior, encabezado móvil, barra inferior). */
export interface MetaPagina {
  /** Texto después de «Fiscalización ›» (p. ej. «Historial › #5E0B-3D77»). */
  migas?: string;
  /** Encabezado móvil estándar (logo + título + subtítulo + buscar + campana). */
  tituloMovil?: string;
  subMovil?: string;
  /** 'propio': la pantalla dibuja su encabezado móvil (formulario, firma solicitada). */
  headerMovil?: 'estandar' | 'propio';
  /** 'propia': la pantalla dibuja su barra inferior (Anterior/Siguiente) en tablet V y móvil. */
  barraInferior?: 'nav' | 'propia';
  /** Ruta del menú lateral / riel que se marca activa (p. ej. el detalle marca «Versiones y cambios»). */
  navActiva?: string;
}

interface Ctx {
  meta: MetaPagina;
  setMeta: (m: MetaPagina) => void;
}

const PaginaContext = createContext<Ctx | null>(null);

export function ProveedorPagina({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<MetaPagina>({});
  return <PaginaContext.Provider value={{ meta, setMeta }}>{children}</PaginaContext.Provider>;
}

export function useMetaPagina(): MetaPagina {
  return useContext(PaginaContext)?.meta ?? {};
}

/** Declara la meta de la pantalla actual; se limpia al salir. */
export function usePagina(meta: MetaPagina) {
  const ctx = useContext(PaginaContext);
  const clave = JSON.stringify(meta);
  const set = ctx?.setMeta;
  useLayoutEffect(() => {
    if (!set) return;
    set(JSON.parse(clave) as MetaPagina);
    return () => set({});
  }, [clave, set]);
}
