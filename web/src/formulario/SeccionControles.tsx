import { useState } from 'react';
import type { FiscalizacionDto, PreguntaControlDto } from '../api/types';
import { MENSAJE_OBSERVACION, observacionFaltante } from '../domain/validacion';
import { Icono } from '../ui/Icono';
import { useTamano } from '../ui/tamano';

export interface PropsControles {
  datos: FiscalizacionDto;
  actualizar: (fn: (d: FiscalizacionDto) => FiscalizacionDto) => void;
  preguntas: PreguntaControlDto[];
}

/** Observación de fecha (control 10): texto con el placeholder del diseño; al tocarla abre el calendario. */
function ObservacionFecha({
  id,
  valor,
  etiqueta,
  placeholder,
  className,
  alCambiar,
}: {
  id: string;
  valor: string | null;
  etiqueta: string;
  placeholder: string;
  className: string;
  alCambiar: (v: string | null) => void;
}) {
  const [foco, setFoco] = useState(false);
  return (
    <input
      id={id}
      type={foco || valor ? 'date' : 'text'}
      className={className}
      aria-label={etiqueta}
      placeholder={placeholder}
      value={valor ?? ''}
      onFocus={() => setFoco(true)}
      onBlur={() => setFoco(false)}
      onChange={(e) => alCambiar(e.target.value || null)}
    />
  );
}

export function SeccionControles({ datos, actualizar, preguntas }: PropsControles) {
  const movil = useTamano() === 'movil';
  const respondidos = preguntas.filter((q) => datos.controles.find((c) => c.numero === q.numero)?.respuesta != null).length;
  const set = (numero: number, cambio: { respuesta?: boolean | null; observacion?: string | null }) =>
    actualizar((d) => ({
      ...d,
      controles: d.controles.some((c) => c.numero === numero)
        ? d.controles.map((c) => (c.numero === numero ? { ...c, ...cambio } : c))
        : [...d.controles, { numero, respuesta: null, observacion: null, ...cambio }],
    }));

  return (
    <section className={movil ? 'fm-mcard fm-controles' : 'tarjeta fm-controles'} aria-label="Ítems de control interno">
      <div className={movil ? 'fm-mcab' : 'fm-cab-borde'}>
        <div className="fm-cab-textos">
          <h2 className="fm-cab-t">Ítems de control interno</h2>
          <span className="fm-cab-s">
            {movil
              ? `${respondidos} de ${preguntas.length} respondidos`
              : 'Respuesta Sí/No obligatoria · en los ítems 6, 11 y 12, si responde Sí la observación es obligatoria'}
          </span>
        </div>
        {!movil && (
          <span className="fm-contador" aria-live="polite">
            {respondidos} de {preguntas.length} respondidos
          </span>
        )}
      </div>
      <div className="fm-controles-lista">
        {preguntas.map((q) => {
          const r = datos.controles.find((c) => c.numero === q.numero) ?? { numero: q.numero, respuesta: null, observacion: null };
          const falta = observacionFaltante(q, r.respuesta, r.observacion);
          const idObs = `obs-${q.numero}`;
          const idErr = `err-${q.numero}`;
          const fecha = q.tipoObservacion === 'Fecha';
          const etiquetaObs = fecha ? 'Fecha de calibración' : `Observación del control ${q.numero}`;
          const placeholder = fecha
            ? movil
              ? 'Observación: fecha de la última calibración'
              : 'Fecha de calibración'
            : q.observacionObligatoriaSiSi
              ? 'Obligatoria si responde Sí'
              : 'Observación (opcional)';
          const obs = fecha ? (
            <ObservacionFecha
              id={idObs}
              valor={r.observacion}
              etiqueta={etiquetaObs}
              placeholder={placeholder}
              className="fm-obs-input"
              alCambiar={(v) => set(q.numero, { observacion: v })}
            />
          ) : (
            <input
              id={idObs}
              className={`fm-obs-input${falta ? ' invalido' : ''}`}
              aria-label={etiquetaObs}
              aria-invalid={falta || undefined}
              aria-describedby={falta ? idErr : undefined}
              placeholder={placeholder}
              value={r.observacion ?? ''}
              onChange={(e) => set(q.numero, { observacion: e.target.value === '' ? null : e.target.value })}
            />
          );
          const sino = (
            <div className="fm-sino" role="group" aria-labelledby={`txt-${q.numero}`}>
              <button
                type="button"
                className="si"
                aria-pressed={r.respuesta === true}
                aria-label={`Control ${q.numero}: Sí`}
                data-track={`Control ${q.numero} · Sí`}
                onClick={() => set(q.numero, { respuesta: r.respuesta === true ? null : true })}
              >
                {movil && r.respuesta === true && <Icono nombre="check" tam={14} />}
                Sí
              </button>
              <button
                type="button"
                className="no"
                aria-pressed={r.respuesta === false}
                aria-label={`Control ${q.numero}: No`}
                data-track={`Control ${q.numero} · No`}
                onClick={() => set(q.numero, { respuesta: r.respuesta === false ? null : false })}
              >
                {movil && r.respuesta === false && <Icono nombre="check" tam={14} />}
                No
              </button>
            </div>
          );
          const error = falta && (
            <div className="error-campo" id={idErr} role="alert">
              {MENSAJE_OBSERVACION}
            </div>
          );
          if (movil)
            return (
              <div className="fm-mcontrol" key={q.numero} data-control={q.numero}>
                <div className="fm-mcontrol-p" id={`txt-${q.numero}`}>
                  {q.numero}. {q.texto}
                </div>
                {sino}
                <div className={`fm-mobs${falta ? ' invalida' : ''}`}>{obs}</div>
                {error ||
                  (q.observacionObligatoriaSiSi && r.respuesta === true && <div className="fm-mcontrol-nota">Observación obligatoria al responder Sí</div>)}
              </div>
            );
          return (
            <div className={`fm-control${r.respuesta != null ? ' resp' : ''}`} key={q.numero} data-control={q.numero}>
              <span className="fm-control-num">{q.numero}</span>
              <span className="fm-control-p" id={`txt-${q.numero}`}>
                {q.texto}
              </span>
              <div className="fm-control-obs">
                <label className={`fm-obs${falta ? ' invalida' : ''}${r.observacion ? ' llena' : ''}`} htmlFor={idObs}>
                  <Icono nombre="message-square-text" tam={13} />
                  {obs}
                </label>
                {error}
              </div>
              {sino}
            </div>
          );
        })}
      </div>
    </section>
  );
}
