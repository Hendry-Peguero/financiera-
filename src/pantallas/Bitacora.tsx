import { Fragment, useState, type ReactNode } from 'react';
import { useBitacora, useMe, type FiltroBitacora, type TipoBitacora } from '../api/hooks';
import type { BitacoraApiDto, BitacoraCambioDto, BitacoraUiDto } from '../api/types';
import { momento } from '../domain/format';
import { Cargando, ErrorCaja, Paginacion } from '../ui/comunes';
import { Icono, type NombreIcono } from '../ui/Icono';
import { usePagina } from '../ui/pagina';
import { useTamano } from '../ui/tamano';
import { Selector } from './Historial';
import './historial.css';
import './bitacora.css';

/**
 * Bitácora privada del propietario (no existe en el diseño): sigue el estilo del Historial y de Usuarios —
 * pestañas con conteo, filtros en cajas, tabla en tarjeta y tarjetas en el móvil. Cada fila se abre para ver el detalle.
 */

const PESTANAS: { tipo: TipoBitacora; texto: string; icono: NombreIcono }[] = [
  { tipo: 'ui', texto: 'Clics y navegación', icono: 'mouse-pointer-click' },
  { tipo: 'api', texto: 'Peticiones a la API', icono: 'activity' },
  { tipo: 'cambios', texto: 'Cambios de datos', icono: 'diff' },
];

const TIPOS_UI: Record<string, string> = {
  click: 'Clic',
  navegacion: 'Navegación',
  envio: 'Envío',
  error: 'Error',
  online: 'En línea',
  offline: 'Sin conexión',
};
const METODOS = ['GET', 'POST', 'PUT', 'DELETE'];
const ACCIONES: Record<string, string> = { Crear: 'Creó', Modificar: 'Modificó', Eliminar: 'Eliminó' };
const TAMANO = 50;
const TAMANO_MOVIL = 20;

type Fila = BitacoraUiDto | BitacoraApiDto | BitacoraCambioDto;

/** «27/10/2026 11:41:05» → fecha y hora en dos renglones cortos. */
function Momento({ m }: { m: string }) {
  const [f, h] = momento(m).split(' ');
  return (
    <>
      <span className="bit-fecha">{f}</span> <span className="bit-hora mono">{h}</span>
    </>
  );
}

function ChipUi({ tipo }: { tipo: string }) {
  return <span className={`bit-chip bit-ui-${tipo}`}>{TIPOS_UI[tipo] ?? tipo}</span>;
}

function ChipMetodo({ metodo }: { metodo: string }) {
  return <span className={`bit-metodo bit-m-${metodo}`}>{metodo}</span>;
}

function ChipEstado({ codigo }: { codigo: number }) {
  const clase = codigo >= 500 ? 'mal' : codigo >= 400 ? 'aviso' : 'ok';
  return <span className={`bit-chip bit-st-${clase} mono`}>{codigo}</span>;
}

function ChipAccion({ accion }: { accion: string }) {
  return <span className={`bit-chip bit-ac-${accion}`}>{ACCIONES[accion] ?? accion}</span>;
}

function Json({ titulo, texto }: { titulo: string; texto: string | null }) {
  let bonito = texto ?? '';
  try {
    if (texto) bonito = JSON.stringify(JSON.parse(texto), null, 2);
  } catch {
    /* texto tal cual */
  }
  return (
    <div className="bit-json">
      <span className="bit-json-t">{titulo}</span>
      {texto ? <pre className="mono">{bonito}</pre> : <span className="bit-vacio">—</span>}
    </div>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <span className="bit-dato">
      <span className="bit-dato-l">{etiqueta}</span>
      <span className="bit-dato-v">{children ?? '—'}</span>
    </span>
  );
}

/** Lo que se ve al abrir una fila (o una tarjeta en el móvil). */
function Detalle({ tipo, f }: { tipo: TipoBitacora; f: Fila }) {
  if (tipo === 'ui') {
    const u = f as BitacoraUiDto;
    return (
      <div className="bit-detalle">
        <div className="bit-datos">
          <Dato etiqueta="Sesión">{u.sesionId}</Dato>
          <Dato etiqueta="Dispositivo">{u.dispositivo}</Dato>
          <Dato etiqueta="Recibido">{momento(u.recibidoEn)}</Dato>
        </div>
        <Json titulo="Detalle" texto={u.detalle} />
      </div>
    );
  }
  if (tipo === 'api') {
    const a = f as BitacoraApiDto;
    return (
      <div className="bit-detalle">
        <div className="bit-datos">
          <Dato etiqueta="Ruta completa">
            <span className="mono">
              {a.ruta}
              {a.query ?? ''}
            </span>
          </Dato>
          <Dato etiqueta="IP">{a.ip}</Dato>
          <Dato etiqueta="Correlación">{a.correlationId && <span className="mono">{a.correlationId}</span>}</Dato>
          <Dato etiqueta="Navegador">{a.userAgent}</Dato>
        </div>
      </div>
    );
  }
  const c = f as BitacoraCambioDto;
  return (
    <div className="bit-detalle">
      <div className="bit-datos">
        <Dato etiqueta="Id">{<span className="mono">{c.entidadId}</span>}</Dato>
        <Dato etiqueta="Correlación">{c.correlationId && <span className="mono">{c.correlationId}</span>}</Dato>
      </div>
      <div className="bit-jsons">
        <Json titulo="Antes" texto={c.valoresAnteriores} />
        <Json titulo="Después" texto={c.valoresNuevos} />
      </div>
    </div>
  );
}

/** Columnas de la tabla por pestaña: [clase, encabezado, celda]. */
function columnas(tipo: TipoBitacora): [string, string, (f: Fila) => ReactNode][] {
  const comunes: [string, string, (f: Fila) => ReactNode][] = [
    ['c-momento', 'Momento', (f) => <Momento m={f.momento} />],
    ['c-usuario', 'Usuario', (f) => f.correo ?? <span className="bit-vacio">anónimo</span>],
  ];
  if (tipo === 'ui')
    return [
      ...comunes,
      ['c-tipo', 'Tipo', (f) => <ChipUi tipo={(f as BitacoraUiDto).tipo} />],
      ['c-ruta mono', 'Ruta', (f) => (f as BitacoraUiDto).ruta],
      ['c-elemento', 'Elemento', (f) => (f as BitacoraUiDto).elemento ?? <span className="bit-vacio">—</span>],
    ];
  if (tipo === 'api')
    return [
      ...comunes,
      ['c-metodo', 'Método', (f) => <ChipMetodo metodo={(f as BitacoraApiDto).metodo} />],
      ['c-ruta mono', 'Ruta', (f) => (f as BitacoraApiDto).ruta],
      ['c-estado', 'Estado', (f) => <ChipEstado codigo={(f as BitacoraApiDto).statusCode} />],
      ['c-ms mono', 'Duración', (f) => `${(f as BitacoraApiDto).duracionMs} ms`],
    ];
  return [
    ...comunes,
    ['c-accion', 'Acción', (f) => <ChipAccion accion={(f as BitacoraCambioDto).accion} />],
    ['c-entidad', 'Entidad', (f) => (f as BitacoraCambioDto).entidad],
    ['c-id mono', 'Id', (f) => (f as BitacoraCambioDto).entidadId],
  ];
}

function Tabla({ tipo, filas }: { tipo: TipoBitacora; filas: Fila[] }) {
  const [abierta, setAbierta] = useState<number | null>(null);
  if (!filas.length) return <div className="vacio">Sin registros con estos filtros.</div>;
  const cols = columnas(tipo);
  return (
    <div className={`hist-tabla bit-tabla bit-${tipo}`} role="table" aria-label="Bitácora">
      <div className="hist-cab" role="row">
        <span className="c-abrir" role="columnheader" aria-label="Abrir" />
        {cols.map(([c, t]) => (
          <span key={t} className={c} role="columnheader">
            {t}
          </span>
        ))}
      </div>
      {filas.map((f) => {
        const abierto = abierta === f.id;
        return (
          <Fragment key={f.id}>
            <div
              className={`hist-fila bit-fila${abierto ? ' abierta' : ''}`}
              role="row"
              tabIndex={0}
              aria-expanded={abierto}
              onClick={() => setAbierta(abierto ? null : f.id)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setAbierta(abierto ? null : f.id))}
            >
              <span className="c-abrir" role="cell">
                <Icono nombre="chevron-right" tam={14} />
              </span>
              {cols.map(([c, t, celda]) => (
                <span key={t} className={c} role="cell">
                  {celda(f)}
                </span>
              ))}
            </div>
            {abierto && <Detalle tipo={tipo} f={f} />}
          </Fragment>
        );
      })}
    </div>
  );
}

/** Móvil: una tarjeta por evento; se toca para ver el detalle. */
function Tarjetas({ tipo, filas }: { tipo: TipoBitacora; filas: Fila[] }) {
  const [abierta, setAbierta] = useState<number | null>(null);
  if (!filas.length) return <div className="vacio">Sin registros con estos filtros.</div>;
  return (
    <>
      {filas.map((f) => {
        const abierto = abierta === f.id;
        const chip =
          tipo === 'ui' ? <ChipUi tipo={(f as BitacoraUiDto).tipo} /> : tipo === 'api' ? <ChipMetodo metodo={(f as BitacoraApiDto).metodo} /> : <ChipAccion accion={(f as BitacoraCambioDto).accion} />;
        const principal =
          tipo === 'ui'
            ? ((f as BitacoraUiDto).elemento ?? (f as BitacoraUiDto).ruta)
            : tipo === 'api'
              ? (f as BitacoraApiDto).ruta
              : `${(f as BitacoraCambioDto).entidad} · ${(f as BitacoraCambioDto).entidadId}`;
        return (
          <article key={f.id} className={`hist-tarjeta bit-tarjeta${abierto ? ' abierta' : ''}`}>
            <button type="button" className="bit-t-cab" aria-expanded={abierto} onClick={() => setAbierta(abierto ? null : f.id)}>
              <span className="bit-t-fila">
                {chip}
                {tipo === 'api' && <ChipEstado codigo={(f as BitacoraApiDto).statusCode} />}
                <span className="bit-t-momento">
                  <Momento m={f.momento} />
                </span>
              </span>
              <span className="bit-t-principal">{principal}</span>
              <span className="bit-t-sub">{f.correo ?? 'anónimo'}</span>
            </button>
            {abierto && <Detalle tipo={tipo} f={f} />}
          </article>
        );
      })}
    </>
  );
}

/** Caja de texto con ícono, como la búsqueda del Historial; aplica al salir o con Enter. */
function CajaTexto({ icono, etiqueta, valor, poner, clase = '' }: { icono: NombreIcono; etiqueta: string; valor?: string; poner: (v?: string) => void; clase?: string }) {
  const [texto, setTexto] = useState(valor ?? '');
  return (
    <form
      className={`hist-caja hist-buscar ${clase}`}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        poner(texto.trim() || undefined);
      }}
    >
      <Icono nombre={icono} tam={14} />
      <input aria-label={etiqueta} placeholder={etiqueta} value={texto} onChange={(e) => setTexto(e.target.value)} onBlur={() => texto !== (valor ?? '') && poner(texto.trim() || undefined)} />
    </form>
  );
}

function CajaFecha({ etiqueta, valor, poner }: { etiqueta: string; valor?: string; poner: (v?: string) => void }) {
  return (
    <label className="hist-caja bit-fecha-caja">
      <Icono nombre="calendar" tam={14} />
      <span className="hist-caja-t">{etiqueta}</span>
      <input type="date" aria-label={etiqueta} value={valor ?? ''} onChange={(e) => poner(e.target.value || undefined)} />
    </label>
  );
}

function Filtros({ tipo, f, poner }: { tipo: TipoBitacora; f: FiltroBitacora; poner: (c: Partial<FiltroBitacora>) => void }) {
  return (
    <>
      <CajaTexto key={`t-${tipo}`} icono="search" etiqueta="Buscar elemento, ruta o id…" valor={f.texto} poner={(v) => poner({ texto: v })} />
      <CajaTexto key={`u-${tipo}`} icono="user" etiqueta="Usuario (correo)" valor={f.usuario} poner={(v) => poner({ usuario: v })} clase="bit-usuario" />
      {tipo === 'cambios' ? (
        <CajaTexto key="entidad" icono="hash" etiqueta="Entidad" valor={f.tipo} poner={(v) => poner({ tipo: v })} clase="bit-entidad" />
      ) : (
        <Selector
          icono={tipo === 'ui' ? 'mouse-pointer-click' : 'activity'}
          etiqueta={tipo === 'ui' ? 'Tipo de evento' : 'Método'}
          valor={f.tipo ?? ''}
          opciones={[
            { valor: '', texto: tipo === 'ui' ? 'Todos los tipos' : 'Todos los métodos' },
            ...(tipo === 'ui' ? Object.entries(TIPOS_UI).map(([valor, texto]) => ({ valor, texto })) : METODOS.map((m) => ({ valor: m, texto: m }))),
          ]}
          alCambiar={(v) => poner({ tipo: v || undefined })}
        />
      )}
      <CajaFecha etiqueta="Desde" valor={f.desde} poner={(v) => poner({ desde: v })} />
      <CajaFecha etiqueta="Hasta" valor={f.hasta} poner={(v) => poner({ hasta: v })} />
    </>
  );
}

export function Bitacora() {
  const { data: me } = useMe();
  const t = useTamano();
  const movil = t === 'movil';
  const [tipo, setTipo] = useState<TipoBitacora>('ui');
  const [f, setF] = useState<FiltroBitacora>({ pagina: 1 });
  const [verFiltros, setVerFiltros] = useState(false);
  const tamano = movil ? TAMANO_MOVIL : TAMANO;
  const consulta: FiltroBitacora = { ...f, tamano, hasta: f.hasta ? `${f.hasta}T23:59:59` : undefined };
  const q = useBitacora(tipo, consulta, !!me?.esPropietarioBitacora);
  const poner = (c: Partial<FiltroBitacora>) => setF({ ...f, ...c, pagina: 1 });
  const cambiarTipo = (n: TipoBitacora) => {
    setTipo(n);
    setF({ ...f, tipo: undefined, pagina: 1 });
  };
  const activa = PESTANAS.find((p) => p.tipo === tipo)!;
  usePagina({ migas: 'Administración › Bitácora', tituloMovil: 'Bitácora', subMovil: 'Privada del propietario' });

  const resultado = (
    <>
      {q.isPending && <Cargando />}
      {q.isError && (
        <div className="hist-error">
          <ErrorCaja error={q.error} />
        </div>
      )}
      {q.data &&
        (movil ? (
          <Tarjetas tipo={tipo} filas={q.data.items as Fila[]} />
        ) : (
          <Tabla key={`${tipo}-${q.data.pagina}`} tipo={tipo} filas={q.data.items as Fila[]} />
        ))}
      {q.data && (
        <>
          {!movil && <div className="hist-esp" />}
          <Paginacion pagina={q.data.pagina} tamano={q.data.tamano} total={q.data.total} mostrados={q.data.items.length} alCambiar={(p) => setF({ ...f, pagina: p })} />
        </>
      )}
    </>
  );

  if (movil)
    return (
      <div className="hist-m bit-m">
        <div className="hist-m-chips" role="tablist" aria-label="Tipo de bitácora">
          {PESTANAS.map((p) => (
            <button key={p.tipo} type="button" role="tab" aria-selected={tipo === p.tipo} className={`hist-chip${tipo === p.tipo ? ' activo' : ''}`} onClick={() => cambiarTipo(p.tipo)}>
              {p.texto}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-ancho" aria-expanded={verFiltros} onClick={() => setVerFiltros(!verFiltros)}>
          <Icono nombre="sliders-horizontal" tam={16} />
          {verFiltros ? 'Ocultar filtros' : 'Filtros'}
        </button>
        {verFiltros && (
          <div className="bit-m-filtros">
            <Filtros tipo={tipo} f={f} poner={poner} />
          </div>
        )}
        {resultado}
      </div>
    );

  return (
    <div className="hist bit">
      <div className="pag-encabezado hist-encabezado">
        <div className="pag-titulos">
          <h1 className="pag-titulo">Bitácora</h1>
          <div className="pag-sub">Privada del propietario · clics y navegación, peticiones a la API y cambios de datos · toque una fila para ver el detalle</div>
        </div>
      </div>
      <section className="tarjeta hist-tarjeta-tabla">
        <div className="hist-pestanas" role="tablist" aria-label="Tipo de bitácora">
          {PESTANAS.map((p) => (
            <button key={p.tipo} type="button" role="tab" aria-selected={tipo === p.tipo} className={`hist-pestana${tipo === p.tipo ? ' activa' : ''}`} onClick={() => cambiarTipo(p.tipo)}>
              <Icono nombre={p.icono} tam={14} />
              {p.texto}
              {tipo === p.tipo && <span className="hist-conteo">{q.data?.total ?? '·'}</span>}
            </button>
          ))}
        </div>
        <div className="hist-filtros bit-filtros" aria-label={`Filtros de ${activa.texto.toLowerCase()}`}>
          <Filtros tipo={tipo} f={f} poner={poner} />
        </div>
        {resultado}
      </section>
    </div>
  );
}
