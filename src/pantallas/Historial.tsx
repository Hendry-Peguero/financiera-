import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useCatalogos, useFiscalizaciones, useMe, type FiltroFiscalizaciones } from '../api/hooks';
import type { ClaveConteo, FiscalizacionResumenDto, PaginaFiscalizaciones } from '../api/types';
import { fecha, hoyIso, num, numConSigno } from '../domain/format';
import { BadgeEstado, Cargando, ErrorCaja, Paginacion } from '../ui/comunes';
import { mensajeError } from '../ui/errores';
import { diferenciaAlerta, rutaRegistro } from '../ui/formato';
import { Icono, type NombreIcono } from '../ui/Icono';
import { usePagina } from '../ui/pagina';
import { escalaDiseno, useTamano } from '../ui/tamano';
import { descargarXlsx, hojaHistorial } from './exportarExcel';
import { mesAnio, periodoMes } from './formatoRegistros';
import './historial.css';
import { eliminarBorrador } from '../offline/sync';

const PESTANAS: { clave: ClaveConteo; texto: string }[] = [
  { clave: 'todos', texto: 'Todos' },
  { clave: 'Borrador', texto: 'Borradores' },
  { clave: 'Finalizado', texto: 'Finalizados' },
  { clave: 'Modificado', texto: 'Modificados' },
  { clave: 'EdicionPendiente', texto: 'Ediciones pendientes' },
  { clave: 'papelera', texto: 'Papelera' },
];

/** Chips del móvil: la papelera va antes de los estados menos frecuentes (diseño movil-historial). */
const CHIPS_MOVIL: ClaveConteo[] = ['todos', 'Borrador', 'Finalizado', 'papelera', 'Modificado', 'EdicionPendiente'];

/** Filas por página: las 11 que caben en la tabla sin desplazamiento (escritorio y tablets) en el diseño. */
const TAMANO = 11;

/**
 * Filas que caben en la tarjeta de la tabla. Con la interfaz al 80 % caben más de 11 y la tabla quedaría medio
 * vacía: se mide el alto disponible (tabla + espacio libre − encabezado) entre el alto de una fila. Nunca menos de
 * 11; en la prueba visual (escala-diseno) siempre 11, como el diseño.
 */
function useFilasQueCaben(tarjeta: RefObject<HTMLElement | null>, medirDe: unknown): number {
  const [filas, setFilas] = useState(TAMANO);
  useLayoutEffect(() => {
    const el = tarjeta.current;
    if (!el || escalaDiseno()) return;
    const medir = () => {
      const tabla = el.querySelector<HTMLElement>('.hist-tabla');
      const cab = el.querySelector<HTMLElement>('.hist-cab');
      const fila = el.querySelector<HTMLElement>('.hist-fila');
      const esp = el.querySelector<HTMLElement>('.hist-esp');
      if (!tabla || !cab || !fila?.offsetHeight) return;
      const libre = tabla.clientHeight + (esp?.clientHeight ?? 0) - cab.offsetHeight;
      setFilas(Math.max(TAMANO, Math.floor(libre / fila.offsetHeight)));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tarjeta, medirDe]);
  return filas;
}
const TAMANO_MOVIL = 20;

type Poner = (cambios: Record<string, string | null>, reiniciarPagina?: boolean) => void;

/** Variante del Historial para «Papelera» y «Versiones y cambios» (otra pestaña inicial, sin periodo). */
export interface VistaHistorial {
  titulo: string;
  sub: string;
  estado: ClaveConteo;
  ruta: string;
}

/**
 * Lee los filtros de la URL. Sin `desde`/`hasta` se usa el mes en curso (en una vista, todas las fechas);
 * `periodo=todo` / `periodo=mes` cambian ese valor por defecto.
 */
function useFiltro(vista?: VistaHistorial) {
  const [params, setParams] = useSearchParams();
  const pestana = (params.get('estado') as ClaveConteo | null) ?? vista?.estado ?? 'todos';
  const periodo = params.get('periodo');
  const todo = periodo === 'todo' || (!!vista && periodo !== 'mes' && !params.get('desde') && !params.get('hasta'));
  const mes = periodoMes();
  const desde = todo ? undefined : (params.get('desde') ?? mes.desde);
  const hasta = todo ? undefined : (params.get('hasta') ?? mes.hasta);
  const filtro: FiltroFiscalizaciones = {
    estado: pestana !== 'todos' && pestana !== 'papelera' ? pestana : undefined,
    enPapelera: pestana === 'papelera' || undefined,
    texto: params.get('texto') ?? undefined,
    desde,
    hasta,
    locacionId: params.get('locacionId') ?? undefined,
    suplidorId: params.get('suplidorId') ?? undefined,
    autorId: params.get('autorId') ?? undefined,
    pagina: Number(params.get('pagina') ?? '1') || 1,
  };
  const poner: Poner = (cambios, reiniciarPagina = true) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(cambios)) {
      if (v == null || v === '') p.delete(k);
      else p.set(k, v);
    }
    if (reiniciarPagina) p.delete('pagina');
    setParams(p, { replace: true });
  };
  return { pestana, filtro, poner };
}

/** Caja con ícono + texto del valor elegido + chevron; el <select> nativo queda encima, transparente. */
export function Selector({
  icono,
  etiqueta,
  valor,
  opciones,
  alCambiar,
}: {
  icono: NombreIcono;
  etiqueta: string;
  valor: string;
  opciones: { valor: string; texto: string }[];
  alCambiar: (v: string) => void;
}) {
  const actual = opciones.find((o) => o.valor === valor) ?? opciones[0];
  return (
    <label className="hist-caja hist-sel">
      <Icono nombre={icono} tam={14} />
      <span className="hist-caja-t">{actual?.texto}</span>
      <Icono nombre="chevron-down" tam={14} />
      <select aria-label={etiqueta} value={valor} onChange={(e) => alCambiar(e.target.value)}>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </label>
  );
}

function useClicFuera(abierto: boolean, cerrar: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && cerrar();
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && cerrar();
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto, cerrar]);
  return ref;
}

/** «01/10/2026 – 20/10/2026»: abre un panel con las dos fechas, «Mes en curso» y «Todas las fechas». */
function Periodo({ filtro, poner }: { filtro: FiltroFiscalizaciones; poner: Poner }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useClicFuera(abierto, () => setAbierto(false));
  const texto = filtro.desde || filtro.hasta ? `${fecha(filtro.desde)} – ${fecha(filtro.hasta)}` : 'Todas las fechas';
  return (
    <div className="hist-pop-cont" ref={ref}>
      <button type="button" className="hist-caja" aria-expanded={abierto} aria-label={`Periodo: ${texto}`} onClick={() => setAbierto(!abierto)}>
        <Icono nombre="calendar" tam={14} />
        <span className="hist-caja-t">{texto}</span>
        <Icono nombre="chevron-down" tam={14} />
      </button>
      {abierto && (
        <div className="hist-pop" role="dialog" aria-label="Periodo">
          <label className="hist-pop-campo">
            <span>Desde</span>
            <input type="date" value={filtro.desde ?? ''} onChange={(e) => poner({ desde: e.target.value || null, periodo: null })} />
          </label>
          <label className="hist-pop-campo">
            <span>Hasta</span>
            <input type="date" value={filtro.hasta ?? ''} onChange={(e) => poner({ hasta: e.target.value || null, periodo: null })} />
          </label>
          <div className="hist-pop-acciones">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                poner({ desde: null, hasta: null, periodo: 'mes' });
                setAbierto(false);
              }}
            >
              Mes en curso
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                poner({ desde: null, hasta: null, periodo: 'todo' });
                setAbierto(false);
              }}
            >
              Todas las fechas
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Locación, suplidor y autor (en Tablet V van dentro de «Filtros»). */
function FiltrosDetalle({ filtro, poner }: { filtro: FiltroFiscalizaciones; poner: Poner }) {
  const { data: cat } = useCatalogos();
  const { data: me } = useMe();
  return (
    <>
      <Selector
        icono="map-pin"
        etiqueta="Locación"
        valor={String(filtro.locacionId ?? '')}
        opciones={[{ valor: '', texto: 'Todas las locaciones' }, ...(cat?.locaciones ?? []).map((l) => ({ valor: String(l.id), texto: l.nombre }))]}
        alCambiar={(v) => poner({ locacionId: v })}
      />
      <Selector
        icono="truck"
        etiqueta="Suplidor"
        valor={String(filtro.suplidorId ?? '')}
        opciones={[{ valor: '', texto: 'Todos los suplidores' }, ...(cat?.suplidores ?? []).map((s) => ({ valor: String(s.id), texto: s.nombre }))]}
        alCambiar={(v) => poner({ suplidorId: v })}
      />
      <Selector
        icono="user-round"
        etiqueta="Autor"
        valor={filtro.autorId ?? ''}
        opciones={[{ valor: '', texto: 'Autor: todos' }, ...(me ? [{ valor: me.id, texto: 'Autor: solo míos' }] : [])]}
        alCambiar={(v) => poner({ autorId: v })}
      />
    </>
  );
}

function Busqueda({ filtro, poner, movil = false, extra }: { filtro: FiltroFiscalizaciones; poner: Poner; movil?: boolean; extra?: ReactNode }) {
  const [texto, setTexto] = useState(filtro.texto ?? '');
  return (
    <form
      className={movil ? 'hist-m-buscar' : 'hist-caja hist-buscar'}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        poner({ texto });
      }}
    >
      <Icono nombre="search" tam={movil ? 16 : 14} />
      <input
        aria-label="Buscar en el historial"
        placeholder={movil ? 'Número, suplidor o destino' : 'Buscar número, suplidor, chofer…'}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => texto !== (filtro.texto ?? '') && poner({ texto })}
      />
      {extra}
    </form>
  );
}

/**
 * Menú «⋮» de cada fila: abrir, continuar, eliminar un borrador (su autor o el Administrador; cada auditor solo ve los
 * suyos en el Historial), mover a papelera un finalizado / restaurar (Administrador).
 */
function MenuFila({ f, admin }: { f: FiscalizacionResumenDto; admin: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useClicFuera(abierto, () => setAbierto(false));
  const navegar = useNavigate();
  const qc = useQueryClient();
  const accion = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await qc.invalidateQueries();
      setAbierto(false);
    } catch (e) {
      setError(mensajeError(e));
    }
  };
  return (
    // también va dentro de las tarjetas (enlaces) del móvil: no debe abrir el registro al usarlo
    <div
      className="hist-menu-cont"
      ref={ref}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      <button type="button" className="hist-menu-btn" aria-label={`Acciones de ${f.numero}`} aria-expanded={abierto} onClick={() => setAbierto(!abierto)}>
        <Icono nombre="ellipsis-vertical" tam={16} />
      </button>
      {abierto && (
        <div className="hist-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => navegar(`/fiscalizaciones/${f.id}`)}>
            Ver detalle
          </button>
          {f.estado === 'Borrador' && !f.enPapelera && (
            <button type="button" role="menuitem" onClick={() => navegar(`/fiscalizaciones/${f.id}/visita`)}>
              Continuar editando
            </button>
          )}
          {f.estado === 'Borrador' && !f.enPapelera && (
            <button
              type="button"
              role="menuitem"
              className="peligro"
              onClick={() => window.confirm(`¿Eliminar el borrador ${f.numero}? Se borra también de esta tablet.`) && void accion(() => eliminarBorrador(f.id))}
            >
              Eliminar borrador
            </button>
          )}
          {admin && f.estado !== 'Borrador' && !f.enPapelera && (
            <button
              type="button"
              role="menuitem"
              className="peligro"
              onClick={() => window.confirm(`¿Mover ${f.numero} a la papelera?`) && void accion(() => api.del(`/fiscalizaciones/${f.id}`))}
            >
              Mover a papelera
            </button>
          )}
          {admin && f.enPapelera && (
            <button type="button" role="menuitem" onClick={() => void accion(() => api.post(`/fiscalizaciones/${f.id}/restaurar`))}>
              Restaurar
            </button>
          )}
          {error && <div className="hist-menu-error">{error}</div>}
        </div>
      )}
    </div>
  );
}

function Tabla({
  filas,
  compacta,
  admin,
  seleccion,
  setSeleccion,
}: {
  filas: FiscalizacionResumenDto[];
  compacta: boolean;
  admin: boolean;
  seleccion: Set<string>;
  setSeleccion: (s: Set<string>) => void;
}) {
  const navegar = useNavigate();
  if (!filas.length) return <div className="vacio">No hay registros con estos filtros.</div>;
  const todas = filas.every((f) => seleccion.has(f.id));
  const alternar = (id: string) => {
    const s = new Set(seleccion);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSeleccion(s);
  };
  const dif = (f: FiscalizacionResumenDto) => (
    <span className={`c-dif mono${diferenciaAlerta(f) ? ' rojo' : ''}`} role="cell">
      {numConSigno(f.diferenciaGal)}
    </span>
  );
  return (
    <div className={`hist-tabla${compacta ? ' compacta' : ''}`} role="table" aria-label="Historial de fiscalizaciones">
      <div className="hist-cab" role="row">
        {compacta ? (
          <span className="c-numfecha" role="columnheader">
            N.º · Fecha
          </span>
        ) : (
          <>
            <span className="c-check" role="columnheader">
              <input
                type="checkbox"
                className="hist-check"
                aria-label="Seleccionar todos"
                checked={todas}
                onChange={() => setSeleccion(todas ? new Set() : new Set(filas.map((f) => f.id)))}
              />
            </span>
            <span className="c-num" role="columnheader">
              N.º
            </span>
            <span className="c-fecha" role="columnheader">
              Fecha
            </span>
          </>
        )}
        <span className="c-destino" role="columnheader">
          Destino
        </span>
        <span className="c-suplidor" role="columnheader">
          Suplidor
        </span>
        {!compacta && (
          <>
            <span className="c-autor" role="columnheader">
              Autor
            </span>
            <span className="c-prov" role="columnheader">
              Proveedor
            </span>
          </>
        )}
        <span className="c-gal" role="columnheader">
          EGEHID
        </span>
        <span className="c-dif" role="columnheader">
          Dif.
        </span>
        {!compacta && (
          <span className="c-rev" role="columnheader">
            Rev.
          </span>
        )}
        <span className="c-estado" role="columnheader">
          Estado
        </span>
        <span className="c-menu" role="columnheader" aria-label="Acciones" />
      </div>
      {filas.map((f) => (
        <div key={f.id} className="hist-fila" role="row" onClick={() => navegar(rutaRegistro(f))}>
          {compacta ? (
            <span className="c-numfecha" role="cell">
              <Link to={rutaRegistro(f)} className="mono hist-num" onClick={(e) => e.stopPropagation()}>
                {f.numero}
              </Link>
              <span className="hist-fecha-s">{fecha(f.fecha)}</span>
            </span>
          ) : (
            <>
              <span className="c-check" role="cell" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  className="hist-check"
                  aria-label={`Seleccionar ${f.numero}`}
                  checked={seleccion.has(f.id)}
                  onChange={() => alternar(f.id)}
                />
              </span>
              <span className="c-num" role="cell">
                <Link to={rutaRegistro(f)} className="mono hist-num" onClick={(e) => e.stopPropagation()}>
                  {f.numero}
                </Link>
              </span>
              <span className="c-fecha" role="cell">
                {fecha(f.fecha)}
              </span>
            </>
          )}
          <span className="c-destino" role="cell">
            {f.locacion ?? '—'}
          </span>
          <span className="c-suplidor" role="cell">
            {f.suplidor ?? '—'}
          </span>
          {!compacta && (
            <>
              <span className="c-autor" role="cell">
                {f.autor}
              </span>
              <span className="c-prov mono" role="cell">
                {num(f.galonesProveedor)}
              </span>
            </>
          )}
          <span className="c-gal mono" role="cell">
            {num(f.galonesEgehid)}
          </span>
          {dif(f)}
          {!compacta && (
            <span className="c-rev mono" role="cell">
              {f.version > 0 ? f.version : '—'}
            </span>
          )}
          <span className="c-estado" role="cell">
            <BadgeEstado estado={f.estado} enPapelera={f.enPapelera} />
          </span>
          <span className="c-menu" role="cell">
            <MenuFila f={f} admin={admin} />
          </span>
        </div>
      ))}
    </div>
  );
}

/** Máximo de filas por petición que acepta la API (Comun.Normalizar). */
const TAMANO_EXPORTAR = 200;

/** Descarga todas las filas del filtro actual (o solo las seleccionadas) como .xlsx: pide todas las páginas. */
async function exportar(filtro: FiltroFiscalizaciones, seleccion: Set<string>) {
  const todas: FiscalizacionResumenDto[] = [];
  for (let pagina = 1; ; pagina++) {
    const r = await api.get<PaginaFiscalizaciones>('/fiscalizaciones', {
      ...filtro,
      enPapelera: filtro.enPapelera || undefined,
      pagina,
      tamano: TAMANO_EXPORTAR,
    });
    todas.push(...r.items);
    if (!r.items.length || todas.length >= r.total) break;
  }
  const items = seleccion.size ? todas.filter((f) => seleccion.has(f.id)) : todas;
  await descargarXlsx(`historial-fiscalizaciones-${hoyIso()}.xlsx`, [hojaHistorial(items)]);
}

function HistorialMovil({ vista }: { vista?: VistaHistorial }) {
  const { data: me } = useMe();
  const admin = me?.rol === 'Administrador';
  const { pestana, filtro, poner } = useFiltro(vista);
  const [tamano, setTamano] = useState(TAMANO_MOVIL);
  const [filtros, setFiltros] = useState(false);
  const q = useFiscalizaciones({ ...filtro, pagina: 1, tamano });
  const conteos = q.data?.conteos;
  usePagina({
    tituloMovil: vista?.titulo ?? 'Historial',
    subMovil: vista?.sub ?? (conteos?.todos != null ? `${conteos.todos} registros en esta tablet` : undefined),
  });

  const grupos: { mes: string; filas: FiscalizacionResumenDto[] }[] = [];
  for (const f of q.data?.items ?? []) {
    const mes = mesAnio(f.fecha);
    const g = grupos[grupos.length - 1];
    if (g?.mes === mes) g.filas.push(f);
    else grupos.push({ mes, filas: [f] });
  }

  return (
    <div className="hist-m">
      <Busqueda
        filtro={filtro}
        poner={poner}
        movil
        extra={
          <button type="button" className="hist-m-filtros" aria-label="Filtros" aria-expanded={filtros} onClick={() => setFiltros(!filtros)}>
            <Icono nombre="sliders-horizontal" tam={16} />
          </button>
        }
      />
      {filtros && (
        <div className="hist-m-panel">
          <Periodo filtro={filtro} poner={poner} />
          <FiltrosDetalle filtro={filtro} poner={poner} />
        </div>
      )}
      <div className="hist-m-chips" role="tablist" aria-label="Estados">
        {CHIPS_MOVIL.map((c) => {
          const t = PESTANAS.find((p) => p.clave === c)!;
          const n = c === 'papelera' ? null : conteos?.[c];
          return (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={pestana === c}
              className={`hist-chip${pestana === c ? ' activo' : ''}`}
              onClick={() => poner({ estado: c === (vista?.estado ?? 'todos') ? null : c })}
            >
              {t.texto}
              {n != null ? ` ${n}` : ''}
            </button>
          );
        })}
      </div>
      {q.isPending && <Cargando />}
      {q.isError && <ErrorCaja error={q.error} />}
      {q.data && !q.data.items.length && <div className="vacio">No hay registros con estos filtros.</div>}
      {grupos.map((g) => (
        <section key={g.mes} className="hist-m-grupo" aria-label={g.mes}>
          <h2 className="hist-m-mes">{g.mes}</h2>
          {g.filas.map((f) => (
            <Link key={f.id} to={rutaRegistro(f)} className="hist-tarjeta">
              <span className="hist-t-fila">
                <span className="mono hist-t-id">#{f.numero}</span>
                <BadgeEstado estado={f.estado} enPapelera={f.enPapelera} />
                <MenuFila f={f} admin={admin} />
              </span>
              <span className="hist-t-textos">
                <span className="hist-t-t">{f.locacion ?? '—'}</span>
                <span className="hist-t-s">
                  {f.suplidor ?? '—'} · {fecha(f.fecha)}
                </span>
              </span>
              <span className="hist-t-nums">
                <span className="hist-t-n">
                  <span className="hist-t-l">Proveedor</span>
                  <span className="hist-t-v mono">{num(f.galonesProveedor)}</span>
                </span>
                <span className="hist-t-n">
                  <span className="hist-t-l">EGEHID</span>
                  <span className="hist-t-v mono">{num(f.galonesEgehid)}</span>
                </span>
                <span className="hist-t-n">
                  <span className="hist-t-l">Dif.</span>
                  <span className={`hist-t-v mono${diferenciaAlerta(f) ? ' rojo' : ''}`}>{numConSigno(f.diferenciaGal)}</span>
                </span>
              </span>
            </Link>
          ))}
        </section>
      ))}
      {q.data && q.data.total > q.data.items.length && (
        <button type="button" className="btn btn-ancho" onClick={() => setTamano(tamano + TAMANO_MOVIL)}>
          Ver más registros
        </button>
      )}
    </div>
  );
}

export function Historial({ vista }: { vista?: VistaHistorial }) {
  const t = useTamano();
  if (t === 'movil') return <HistorialMovil vista={vista} />;
  return <HistorialTabla compacta={t === 'tablet-v'} vista={vista} />;
}

function HistorialTabla({ compacta, vista }: { compacta: boolean; vista?: VistaHistorial }) {
  const { pestana, filtro, poner } = useFiltro(vista);
  const { data: me } = useMe();
  const admin = me?.rol === 'Administrador';
  const tarjeta = useRef<HTMLElement>(null);
  const [hayFilas, setHayFilas] = useState(false);
  const tamano = useFilasQueCaben(tarjeta, hayFilas);
  const q = useFiscalizaciones({ ...filtro, tamano });
  const conFilas = !!q.data?.items.length;
  if (conFilas !== hayFilas) setHayFilas(conFilas);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [masFiltros, setMasFiltros] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);
  usePagina(vista ? { navActiva: vista.ruta } : { migas: 'Historial' });

  const total = q.data?.conteos?.todos;
  const activos = [filtro.locacionId, filtro.suplidorId, filtro.autorId].filter(Boolean).length;

  const alExportar = async () => {
    setError(null);
    setExportando(true);
    try {
      await exportar(filtro, seleccion);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="hist">
      <div className="pag-encabezado hist-encabezado">
        <div className="pag-titulos">
          <h1 className="pag-titulo">{vista?.titulo ?? 'Historial de fiscalizaciones'}</h1>
          <div className="pag-sub">
            {vista?.sub ??
              `${total ?? '…'} registros en esta tablet${admin ? ' · incluye cuentas locales visibles para administración' : ''}`}
          </div>
        </div>
        <div className="pag-acciones">
          <button type="button" className="btn" disabled={exportando} onClick={() => void alExportar()}>
            <Icono nombre="file-spreadsheet" tam={16} />
            {seleccion.size ? `Exportar ${seleccion.size}` : 'Exportar Excel'}
          </button>
          <Link to="/fiscalizaciones/nueva" className="btn btn-primario">
            <Icono nombre="plus" tam={16} />
            Nueva fiscalización
          </Link>
        </div>
      </div>
      {error && <ErrorCaja error={error} />}
      <section ref={tarjeta} className="tarjeta hist-tarjeta-tabla">
        <div className="hist-pestanas" role="tablist" aria-label="Estados">
          {PESTANAS.map((p) => (
            <button
              key={p.clave}
              type="button"
              role="tab"
              aria-selected={pestana === p.clave}
              className={`hist-pestana${pestana === p.clave ? ' activa' : ''}`}
              onClick={() => {
                setSeleccion(new Set());
                poner({ estado: p.clave === (vista?.estado ?? 'todos') ? null : p.clave });
              }}
            >
              {p.texto}
              <span className="hist-conteo">{q.data?.conteos?.[p.clave] ?? '·'}</span>
            </button>
          ))}
        </div>
        <div className="hist-filtros">
          <Busqueda filtro={filtro} poner={poner} />
          <Periodo filtro={filtro} poner={poner} />
          {compacta ? (
            <button type="button" className="hist-caja hist-mas" aria-expanded={masFiltros} onClick={() => setMasFiltros(!masFiltros)}>
              <Icono nombre="sliders-horizontal" tam={14} />
              <span className="hist-caja-t">Filtros{activos ? ` (${activos})` : ''}</span>
            </button>
          ) : (
            <FiltrosDetalle filtro={filtro} poner={poner} />
          )}
        </div>
        {compacta && masFiltros && (
          <div className="hist-filtros hist-filtros-extra">
            <FiltrosDetalle filtro={filtro} poner={poner} />
          </div>
        )}
        {q.isPending && <Cargando />}
        {q.isError && (
          <div className="hist-error">
            <ErrorCaja error={q.error} />
          </div>
        )}
        {q.data && (
          <>
            <Tabla filas={q.data.items} compacta={compacta} admin={admin} seleccion={seleccion} setSeleccion={setSeleccion} />
            <div className="hist-esp" />
            <Paginacion
              pagina={q.data.pagina}
              tamano={tamano}
              total={q.data.total}
              mostrados={q.data.items.length}
              nota="solo cuenta la versión vigente"
              alCambiar={(p) => poner({ pagina: String(p) }, false)}
            />
          </>
        )}
      </section>
    </div>
  );
}
