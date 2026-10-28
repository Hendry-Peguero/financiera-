import { useEffect, useState } from 'react';
import { api } from '../api/client';

/**
 * «Ana Lucía Pérez» → «Ana P.»: vista previa manuscrita (fuente Caveat) de una firma registrada.
 * La API no expone la imagen de las firmas de otras personas; el diseño las muestra así.
 */
export function trazoCorto(nombre: string | null | undefined): string {
  const p = (nombre ?? '').replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '';
  if (p.length === 1) return p[0];
  return `${p[0]} ${p[p.length - 1][0]}.`;
}

/** Texto manuscrito (Caveat) que representa una firma. */
export function TrazoFirma({
  texto,
  tam = 18,
  peso = 600,
  className,
}: {
  texto: string;
  tam?: number;
  peso?: 400 | 600;
  className?: string;
}) {
  return (
    <span
      className={className}
      style={{ fontFamily: 'var(--firma)', fontSize: `${tam / 16}rem`, fontWeight: peso, color: '#1e3a8a', whiteSpace: 'nowrap' }}
      aria-hidden="true"
    >
      {texto}
    </span>
  );
}

/** Firma predeterminada del usuario (GET /me/firma → PNG). null mientras carga o si no tiene. */
export function useMiFirma(habilitado = true): { imagen: string | null; cargando: boolean } {
  const [imagen, setImagen] = useState<string | null>(null);
  const [cargando, setCargando] = useState(habilitado);
  useEffect(() => {
    if (!habilitado) return;
    let vivo = true;
    api
      .get<{ imagenBase64: string }>('/me/firma')
      .then((r) => vivo && setImagen(r?.imagenBase64 ?? null))
      .catch(() => vivo && setImagen(null))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [habilitado]);
  return { imagen, cargando };
}
