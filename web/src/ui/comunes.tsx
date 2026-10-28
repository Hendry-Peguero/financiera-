import { useEffect, useId, type ReactNode } from 'react';
import type { EstadoFiscalizacion } from '../api/types';
import { mensajeError } from './errores';
import { Icono, type NombreIcono } from './Icono';
import './comunes.css';

const NOMBRES_ESTADO: Record<EstadoFiscalizacion | 'Papelera', string> = {
  Borrador: 'Borrador',
  Finalizado: 'Finalizado',
  Modificado: 'Modificado',
  EdicionPendiente: 'Edición pendiente',
  Papelera: 'En papelera',
};

export function nombreEstado(e: EstadoFiscalizacion | 'Papelera'): string {
  return NOMBRES_ESTADO[e];
}

/** Badge con punto («● Finalizado»). */
export function BadgeEstado({
  estado,
  enPapelera,
  texto,
  className,
}: {
  estado?: EstadoFiscalizacion | null;
  enPapelera?: boolean;
  /** Reemplaza el texto (p. ej. «Modificado · versión 3»). */
  texto?: string;
  className?: string;
}) {
  const e = enPapelera ? 'Papelera' : (estado ?? 'Borrador');
  return (
    <span className={`badge b-${e}${className ? ` ${className}` : ''}`}>
      <span className="badge-punto" />
      {texto ?? NOMBRES_ESTADO[e]}
    </span>
  );
}

/** Diálogo del diseño (Cab con ícono + título + subtítulo, Cuerpo, Pie). */
export function Modal({
  titulo,
  sub,
  icono,
  children,
  pie,
  alCerrar,
  ancho = 560,
  className,
}: {
  titulo: string;
  sub?: ReactNode;
  icono?: NombreIcono;
  children: ReactNode;
  pie?: ReactNode;
  alCerrar: () => void;
  ancho?: number;
  className?: string;
}) {
  const id = useId();
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && alCerrar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [alCerrar]);
  return (
    <div className="velo" onMouseDown={(e) => e.target === e.currentTarget && alCerrar()}>
      <div
        className={`dialogo${className ? ` ${className}` : ''}`}
        style={{ width: ancho }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
      >
        <div className="dlg-cab">
          {icono && (
            <div className="dlg-icono">
              <Icono nombre={icono} tam={18} />
            </div>
          )}
          <div className="dlg-textos">
            <h2 id={id} className="dlg-titulo">
              {titulo}
            </h2>
            {sub && <div className="dlg-sub">{sub}</div>}
          </div>
          <button type="button" className="dlg-cerrar" aria-label="Cerrar" onClick={alCerrar}>
            <Icono nombre="x" tam={18} />
          </button>
        </div>
        <div className="dlg-cuerpo">{children}</div>
        {pie && <div className="dlg-pie">{pie}</div>}
      </div>
    </div>
  );
}

/** «Mostrando 1–11 de 126 · …» + botones de página (Historial). */
export function Paginacion({
  pagina,
  tamano,
  total,
  alCambiar,
  nota,
  mostrados,
}: {
  pagina: number;
  tamano: number;
  total: number;
  alCambiar: (p: number) => void;
  nota?: string;
  /** Filas de la página actual (por defecto, las que caben en `tamano`). */
  mostrados?: number;
}) {
  const paginas = Math.max(1, Math.ceil(total / Math.max(1, tamano)));
  const desde = total === 0 ? 0 : (pagina - 1) * tamano + 1;
  const hasta = mostrados != null ? desde + Math.max(0, mostrados - 1) : Math.min(total, pagina * tamano);
  const visibles: (number | '…')[] = [];
  const add = (p: number | '…') => visibles[visibles.length - 1] !== p && visibles.push(p);
  for (let p = 1; p <= paginas; p++) {
    if (p === 1 || p === paginas || Math.abs(p - pagina) <= 1 || (pagina <= 2 && p <= 3)) add(p);
    else add('…');
  }
  return (
    <nav className="paginacion" aria-label="Paginación">
      <span className="pg-texto">
        Mostrando {desde}–{total === 0 ? 0 : hasta} de {total}
        {nota ? ` · ${nota}` : ''}
      </span>
      <div className="pg-paginas">
        <button type="button" className="pg" aria-label="Página anterior" disabled={pagina <= 1} onClick={() => alCambiar(pagina - 1)}>
          ‹
        </button>
        {visibles.map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className="pg" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className={`pg${p === pagina ? ' activa' : ''}`}
              aria-current={p === pagina ? 'page' : undefined}
              onClick={() => alCambiar(p)}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          className="pg"
          aria-label="Página siguiente"
          disabled={pagina >= paginas}
          onClick={() => alCambiar(pagina + 1)}
        >
          ›
        </button>
      </div>
    </nav>
  );
}

/** Tarjeta KPI («Icono fondo» + Etiqueta/Valor/Sub). */
export function Kpi({
  etiqueta,
  valor,
  sub,
  icono,
  color,
  fondo,
  className,
  valorClassName,
}: {
  etiqueta: string;
  valor: ReactNode;
  sub?: ReactNode;
  icono: NombreIcono;
  color: string;
  fondo: string;
  className?: string;
  valorClassName?: string;
}) {
  return (
    <div className={`tarjeta kpi${className ? ` ${className}` : ''}`}>
      <div className="kpi-icono" style={{ background: fondo, color }}>
        <Icono nombre={icono} tam={18} />
      </div>
      <div className="kpi-textos">
        <div className="kpi-etiqueta">{etiqueta}</div>
        <div className={`kpi-valor${valorClassName ? ` ${valorClassName}` : ''}`}>{valor}</div>
        {sub != null && <div className="kpi-sub">{sub}</div>}
      </div>
    </div>
  );
}

/** Cabecera de tarjeta con ícono («Datos de la visita», «Totales medidos»…). */
export function CabIcono({
  icono,
  titulo,
  sub,
  extra,
  colorIcono,
  fondoIcono,
}: {
  icono: NombreIcono;
  titulo: string;
  sub?: ReactNode;
  extra?: ReactNode;
  colorIcono?: string;
  fondoIcono?: string;
}) {
  return (
    <div className="cab-icono">
      <div className="cab-icono-caja" style={{ color: colorIcono, background: fondoIcono }}>
        <Icono nombre={icono} tam={16} />
      </div>
      <div className="cab-icono-textos">
        <h2 className="cab-icono-t">{titulo}</h2>
        {sub && <div className="cab-icono-s">{sub}</div>}
      </div>
      {extra}
    </div>
  );
}

/** Nota / aviso con ícono. */
export function Aviso({
  tipo = 'info',
  icono,
  children,
  className,
  rol,
}: {
  tipo?: 'info' | 'warn' | 'error' | 'ok';
  icono?: NombreIcono;
  children: ReactNode;
  className?: string;
  rol?: 'alert' | 'status';
}) {
  return (
    <div className={`aviso aviso-${tipo}${className ? ` ${className}` : ''}`} role={rol}>
      {icono && <Icono nombre={icono} tam={16} />}
      <div className="aviso-texto">{children}</div>
    </div>
  );
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="vacio" role="status">
      {texto}
    </div>
  );
}

export function ErrorCaja({ error }: { error: unknown }) {
  return (
    <Aviso tipo="error" icono="circle-alert" rol="alert">
      {mensajeError(error)}
    </Aviso>
  );
}
