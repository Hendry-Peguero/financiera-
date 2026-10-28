import { useId, useRef, useState, type ReactNode } from 'react';
import { hora12, num, parseNumero } from '../domain/format';
import { Icono, type NombreIcono } from '../ui/Icono';

/**
 * Entrada de texto que muestra el valor formateado (p. ej. «07:15 AM», «8,000.00 gal») y, mientras tiene el
 * foco, lo que escribe la persona. Al escribir se interpreta: si el texto es válido se guarda el valor.
 */
function EntradaFormateada<T>({
  id,
  valor,
  formatear,
  interpretar,
  alCambiar,
  placeholder,
  className,
  etiqueta,
  soloLectura,
  inputMode,
  invalido,
  descrito,
}: {
  id?: string;
  valor: T | null;
  formatear: (v: T) => string;
  /** undefined = texto aún no válido (no cambia el valor) */
  interpretar: (txt: string) => T | null | undefined;
  alCambiar?: (v: T | null) => void;
  placeholder?: string;
  className?: string;
  etiqueta?: string;
  soloLectura?: boolean;
  inputMode?: 'decimal' | 'text' | 'numeric';
  invalido?: boolean;
  descrito?: string;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const mostrado = editando ?? (valor == null ? '' : formatear(valor));
  return (
    <input
      id={id}
      aria-label={id ? undefined : etiqueta}
      className={className}
      value={mostrado}
      placeholder={placeholder}
      readOnly={soloLectura}
      inputMode={inputMode}
      autoComplete="off"
      aria-invalid={invalido || undefined}
      aria-describedby={descrito}
      onFocus={() => setEditando(valor == null ? '' : formatear(valor))}
      onBlur={() => setEditando(null)}
      onChange={(e) => {
        const t = e.target.value;
        setEditando(t);
        const v = interpretar(t);
        if (v !== undefined) alCambiar?.(v);
      }}
    />
  );
}

/** «7:15», «07:15», «7:15 pm», «19:30», «715» → «HH:mm» (24 h). null si vacío, undefined si no es válida. */
export function interpretarHora(txt: string): string | null | undefined {
  const t = txt.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!t || /^-+:?-* ?(am\/pm)?$/.test(t)) return null;
  const m = /^(\d{1,2})(?::?(\d{2}))?\s*([ap])?\.?\s*m?\.?$/.exec(t);
  if (!m) return undefined;
  let h = Number(m[1]);
  const min = Number(m[2] ?? '0');
  if (min > 59) return undefined;
  if (m[3]) {
    if (h < 1 || h > 12) return undefined;
    if (m[3] === 'p' && h < 12) h += 12;
    if (m[3] === 'a' && h === 12) h = 0;
  } else if (h > 23) return undefined;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** «20/10/2026» → «2026-10-20». */
export function interpretarFecha(txt: string): string | null | undefined {
  const t = txt.trim();
  if (!t) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (!m) return undefined;
  const d = Number(m[1]);
  const mes = Number(m[2]);
  if (d < 1 || d > 31 || mes < 1 || mes > 12) return undefined;
  return `${m[3]}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function fechaVisible(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

interface Base {
  etiqueta: string;
  error?: string | null;
  className?: string;
}

function Marco({
  etiqueta,
  id,
  error,
  children,
  className,
  invalida,
}: {
  etiqueta: string;
  id: string;
  error?: string | null;
  children: ReactNode;
  className?: string;
  invalida?: boolean;
}) {
  return (
    <div className={`campo${className ? ` ${className}` : ''}`}>
      <label className="campo-etiqueta" htmlFor={id}>
        {etiqueta}
      </label>
      <div className={`caja${invalida || error ? ' invalida' : ''}`}>{children}</div>
      {error && (
        <span className="error-campo" id={`${id}-err`} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export function CampoTexto({
  etiqueta,
  valor,
  alCambiar,
  error,
  placeholder,
  icono,
  soloLectura,
  className,
  mono,
}: Base & {
  valor: string | null;
  alCambiar?: (v: string | null) => void;
  placeholder?: string;
  icono?: NombreIcono;
  soloLectura?: boolean;
  mono?: boolean;
}) {
  const id = useId();
  return (
    <Marco etiqueta={etiqueta} id={id} error={error} className={className}>
      <input
        id={id}
        className={mono ? 'mono' : undefined}
        value={valor ?? ''}
        readOnly={soloLectura}
        placeholder={placeholder}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        onChange={(e) => alCambiar?.(e.target.value === '' ? null : e.target.value)}
      />
      {icono && <Icono nombre={icono} tam={16} className="caja-icono" />}
    </Marco>
  );
}

/** Hora con AM/PM: «07:15 AM»; guarda «HH:mm» (24 h). */
export function CampoHora({ etiqueta, valor, alCambiar, error, className }: Base & { valor: string | null; alCambiar: (v: string | null) => void }) {
  const id = useId();
  return (
    <Marco etiqueta={etiqueta} id={id} error={error} className={className}>
      <EntradaFormateada<string>
        id={id}
        valor={valor}
        formatear={(v) => hora12(v)}
        interpretar={interpretarHora}
        alCambiar={alCambiar}
        placeholder="--:-- AM/PM"
        invalido={!!error}
        descrito={error ? `${id}-err` : undefined}
      />
      <Icono nombre="clock" tam={16} className="caja-icono" />
    </Marco>
  );
}

/** Fecha «20/10/2026» con el calendario nativo al tocar el ícono. */
export function CampoFecha({ etiqueta, valor, alCambiar, error, className }: Base & { valor: string | null; alCambiar: (v: string | null) => void }) {
  const id = useId();
  const nativo = useRef<HTMLInputElement>(null);
  return (
    <Marco etiqueta={etiqueta} id={id} error={error} className={className}>
      <EntradaFormateada<string>
        id={id}
        valor={valor}
        formatear={fechaVisible}
        interpretar={interpretarFecha}
        alCambiar={alCambiar}
        placeholder="dd/mm/aaaa"
      />
      <input
        ref={nativo}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        className="fecha-nativa"
        value={valor ?? ''}
        onChange={(e) => alCambiar(e.target.value || null)}
      />
      <button
        type="button"
        className="caja-btn"
        aria-label={`Elegir ${etiqueta.toLowerCase()} en el calendario`}
        onClick={() => {
          const n = nativo.current;
          if (!n) return;
          try {
            n.showPicker();
          } catch {
            n.focus();
          }
        }}
      >
        <Icono nombre="calendar" tam={16} />
      </button>
    </Marco>
  );
}

/** Número con formato «8,000.00» (+ sufijo «gal») cuando no se está editando. */
export function EntradaNumero({
  valor,
  alCambiar,
  id,
  etiqueta,
  sufijo,
  soloLectura,
  className,
  placeholder,
  decimales = 2,
}: {
  valor: number | null;
  alCambiar?: (n: number | null) => void;
  id?: string;
  etiqueta?: string;
  sufijo?: string;
  soloLectura?: boolean;
  className?: string;
  placeholder?: string;
  decimales?: number;
}) {
  const fmt = (n: number) => {
    const s = decimales === 4 ? n.toFixed(4) : num(n, decimales).replace('−', '-');
    return sufijo ? `${s} ${sufijo}` : s;
  };
  return (
    <EntradaFormateada<number>
      id={id}
      etiqueta={etiqueta}
      valor={valor}
      formatear={fmt}
      interpretar={(t) => {
        const limpio = sufijo ? t.replace(new RegExp(`\\s*${sufijo}\\s*$`), '') : t;
        if (limpio.trim() === '') return null;
        const n = parseNumero(limpio);
        return n == null ? undefined : n;
      }}
      alCambiar={alCambiar}
      soloLectura={soloLectura}
      className={className}
      placeholder={placeholder}
      inputMode="decimal"
    />
  );
}

export function CampoNumero({
  etiqueta,
  valor,
  alCambiar,
  sufijo,
  error,
  soloLectura,
  className,
  mono,
  decimales,
  placeholder,
}: Base & {
  valor: number | null;
  alCambiar?: (n: number | null) => void;
  sufijo?: string;
  soloLectura?: boolean;
  mono?: boolean;
  decimales?: number;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <Marco etiqueta={etiqueta} id={id} error={error} className={className}>
      <EntradaNumero
        id={id}
        valor={valor}
        alCambiar={alCambiar}
        sufijo={sufijo}
        soloLectura={soloLectura}
        className={mono ? 'mono' : undefined}
        decimales={decimales}
        placeholder={placeholder}
      />
    </Marco>
  );
}

export function CampoSelect({
  etiqueta,
  valor,
  opciones,
  alCambiar,
  error,
  vacio = 'Seleccione…',
  className,
}: Base & {
  valor: number | null;
  opciones: { id: number; texto: string }[];
  alCambiar: (v: number | null) => void;
  vacio?: string;
}) {
  const id = useId();
  return (
    <Marco etiqueta={etiqueta} id={id} error={error} className={className}>
      <select
        id={id}
        value={valor ?? ''}
        className={valor == null ? 'vacio' : undefined}
        aria-invalid={error ? true : undefined}
        onChange={(e) => alCambiar(e.target.value === '' ? null : Number(e.target.value))}
      >
        <option value="">{vacio}</option>
        {opciones.map((o) => (
          <option key={o.id} value={o.id}>
            {o.texto}
          </option>
        ))}
        {valor != null && !opciones.some((o) => o.id === valor) && <option value={valor}>#{valor}</option>}
      </select>
      <Icono nombre="chevron-down" tam={16} className="caja-icono" />
    </Marco>
  );
}

/** Lista de texto libre con sugerencias (p. ej. «Responsable»): texto + chevron como en el diseño. */
export function CampoTextoLista({
  etiqueta,
  valor,
  alCambiar,
  sugerencias,
  className,
}: Base & { valor: string | null; alCambiar: (v: string | null) => void; sugerencias: string[] }) {
  const id = useId();
  const lista = `${id}-lista`;
  return (
    <Marco etiqueta={etiqueta} id={id} className={className}>
      <input id={id} list={lista} value={valor ?? ''} autoComplete="off" onChange={(e) => alCambiar(e.target.value === '' ? null : e.target.value)} />
      <datalist id={lista}>
        {sugerencias.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <Icono nombre="chevron-down" tam={16} className="caja-icono" />
    </Marco>
  );
}

/** Tarjeta de sección con cabecera de ícono («Datos de la visita», «Totales medidos»…). */
export function Tarjeta({
  titulo,
  desc,
  icono,
  extra,
  children,
  className,
}: {
  titulo: string;
  desc?: string;
  icono: NombreIcono;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`tarjeta fm-tarjeta${className ? ` ${className}` : ''}`} aria-label={titulo}>
      <div className="cab-icono">
        <div className="cab-icono-caja">
          <Icono nombre={icono} tam={16} />
        </div>
        <div className="cab-icono-textos fm-cab-textos">
          <h2 className="cab-icono-t">{titulo}</h2>
          {desc && <div className="cab-icono-s">{desc}</div>}
        </div>
        {extra}
      </div>
      {children}
    </section>
  );
}
