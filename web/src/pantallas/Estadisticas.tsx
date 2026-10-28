import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useCatalogos, useEstadisticas, type FiltroEstadisticas } from '../api/hooks';
import type { AvisoDto, EstadisticasDto } from '../api/types';
import { fecha, hoyIso, num, pct } from '../domain/format';
import { Cargando, ErrorCaja, Kpi } from '../ui/comunes';
import { entero, numeroCorto } from '../ui/formato';
import { mensajeError } from '../ui/errores';
import { Icono, type NombreIcono } from '../ui/Icono';
import { usePagina } from '../ui/pagina';
import { escalaDiseno, useTamano } from '../ui/tamano';
import { descargarXlsx, hojasEstadisticas } from './exportarExcel';
import './estadisticas.css';

type Agrupar = NonNullable<FiltroEstadisticas['agrupar']>;
const AGRUPAR: [Agrupar, string][] = [
  ['dia', 'Día'],
  ['semana', 'Semana'],
  ['mes', 'Mes'],
];
const VACIOS: Record<Agrupar, string> = { dia: 'Días vacíos', semana: 'Semanas vacías', mes: 'Meses vacíos' };
const UNIDAD: Record<Agrupar, [string, string]> = { dia: ['día', 'días'], semana: ['semana', 'semanas'], mes: ['mes', 'meses'] };

/** Escala del eje Y: 4 divisiones «bonitas» (0 · 15k · 30k · 45k · 60k). */
function escalaEje(max: number): number {
  if (max <= 0) return 4;
  const paso = max / 4;
  const p = 10 ** Math.floor(Math.log10(paso));
  const n = paso / p;
  const bonito = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((x) => n <= x) ?? 10;
  return bonito * p * 4;
}

function corto(v: number): string {
  if (v >= 1000) return `${num(v / 1000, 0)}k`;
  return num(v, 0);
}

/** Primer día del mes, dos meses atrás (20/10 → 01/08), como el periodo por defecto del diseño. */
function desdePorDefecto(hoy = new Date()): string {
  return hoyIso(new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1));
}

function cantidad(n: number, [uno, varios]: [string, string]) {
  return `${n} ${n === 1 ? uno : varios}`;
}

/** Barras proveedor vs. EGEHID (resalta el periodo con mayor EGEHID). */
export function GraficoBarras({
  series,
  conEje = true,
  resaltar = true,
}: {
  series: EstadisticasDto['series'];
  conEje?: boolean;
  resaltar?: boolean;
}) {
  if (!series.length) return <div className="vacio">Sin datos en el periodo.</div>;
  const escala = escalaEje(Math.max(0, ...series.flatMap((s) => [s.proveedor, s.egehid])));
  const mayor = series.reduce((m, s, i) => (s.egehid > series[m].egehid ? i : m), 0);
  const alto = (v: number) => `${Math.max(0, Math.min(100, (v / escala) * 100))}%`;
  return (
    <div className="est-area" role="img" aria-label="Galones por periodo: proveedor y EGEHID">
      {conEje && (
        <div className="est-eje mono" aria-hidden>
          {[4, 3, 2, 1, 0].map((t) => (
            <span key={t}>{corto((escala / 4) * t)}</span>
          ))}
        </div>
      )}
      <div className="est-barras">
        {series.map((s, i) => {
          const destacado = resaltar && i === mayor;
          return (
            <div key={s.periodo} className={`est-grupo${destacado ? ' destacado' : ''}`}>
              <div className="est-par">
                <span className="est-b est-b-prov" style={{ height: alto(s.proveedor) }} title={`${s.periodo} · proveedor ${num(s.proveedor)} gal`} />
                <span className="est-b est-b-ege" style={{ height: alto(s.egehid) }} title={`${s.periodo} · EGEHID ${num(s.egehid)} gal`} />
              </div>
              <span className="est-periodo">{s.periodo}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Leyenda({ corta }: { corta?: boolean }) {
  return (
    <div className="est-leyenda">
      <span>
        <i className="est-b-prov" />
        {corta ? 'Prov.' : 'Proveedor'}
      </span>
      <span>
        <i className="est-b-ege" />
        EGEHID
      </span>
    </div>
  );
}

/** Barras horizontales por locación: las 5 mayores y «Otras N locaciones». */
function Locaciones({ filas, max: cuantas, otras = true }: { filas: EstadisticasDto['porLocacion']; max: number; otras?: boolean }) {
  const top = filas.slice(0, cuantas);
  const resto = filas.slice(cuantas);
  const tope = Math.max(1, ...top.map((l) => l.galones)) * 1.1;
  return (
    <div className="est-locs">
      {filas.length === 0 && <span className="muted small">Sin datos.</span>}
      {top.map((l) => (
        <div className="est-loc" key={l.locacion}>
          <div className="est-loc-fila">
            <span className="est-loc-l">{l.locacion}</span>
            <span className="est-loc-v mono">{entero(l.galones)} gal</span>
          </div>
          <div className="est-pista">
            <div style={{ width: `${(l.galones / tope) * 100}%` }} />
          </div>
        </div>
      ))}
      {otras && resto.length > 0 && (
        <div className="est-loc">
          <div className="est-loc-fila">
            <span className="est-loc-l">
              Otras {resto.length} {resto.length === 1 ? 'locación' : 'locaciones'}
            </span>
            <span className="est-loc-v mono">{entero(resto.reduce((s, l) => s + l.galones, 0))} gal</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Avisos({ avisos }: { avisos: AvisoDto[] }) {
  return (
    <section className="tarjeta est-tarjeta est-avisos" aria-label="Avisos para revisión">
      <div className="est-cab">
        <h2 className="tarjeta-titulo">Avisos para revisión ({avisos.length})</h2>
      </div>
      {avisos.length === 0 && <div className="est-aviso-vacio">Sin avisos en el periodo.</div>}
      {avisos.map((a, i) => (
        <Link key={`${a.fiscalizacionId}-${a.tipo}-${i}`} to={`/fiscalizaciones/${a.fiscalizacionId}`} className="est-aviso">
          <span className={`est-aviso-i${a.tipo === 'SobreMediana' ? ' warn' : ''}`}>
            <Icono nombre="triangle-alert" tam={14} />
          </span>
          <span className="est-aviso-textos">
            <span className="est-aviso-t">
              {numeroCorto(a.numero)} · {a.locacion ?? '—'}
            </span>
            <span className="est-aviso-s">{a.mensaje}</span>
          </span>
          <Icono nombre="chevron-right" tam={15} className="est-ir" />
        </Link>
      ))}
    </section>
  );
}

/** Píldora de filtro del diseño (ícono · texto · chevron) con el control nativo encima, invisible. */
function Pildora({ icono, texto, children }: { icono: NombreIcono; texto: string; children: ReactNode }) {
  return (
    <label className="est-pildora">
      <Icono nombre={icono} tam={14} />
      <span>{texto}</span>
      <Icono nombre="chevron-down" tam={14} />
      {children}
    </label>
  );
}

function Segmentado({ valor, cambiar, movil }: { valor: Agrupar; cambiar: (a: Agrupar) => void; movil?: boolean }) {
  return (
    <div className={`est-seg${movil ? ' est-seg-movil' : ''}`} role="group" aria-label="Agrupar">
      {AGRUPAR.map(([a, t]) => (
        <button key={a} type="button" aria-pressed={valor === a} className={valor === a ? 'activo' : ''} onClick={() => cambiar(a)}>
          {t}
        </button>
      ))}
    </div>
  );
}

/** Excel: indicadores, galones por periodo y por locación, y avisos (una hoja cada uno). */
async function exportarExcel(e: EstadisticasDto, f: FiltroEstadisticas & { agrupar: Agrupar }, locacion: string) {
  const agrupar = AGRUPAR.find(([a]) => a === f.agrupar)?.[1] ?? f.agrupar;
  await descargarXlsx(`estadisticas_${f.desde ?? ''}_${f.hasta ?? ''}.xlsx`, hojasEstadisticas(e, { ...f, locacion, agrupar }));
}

function EstadisticasMovil({ e, f, setF }: { e: EstadisticasDto; f: Required<Pick<FiltroEstadisticas, 'agrupar'>> & FiltroEstadisticas; setF: (f: FiltroEstadisticas) => void }) {
  const kpis: [string, string, string, string?][] = [
    ['Proveedor', entero(e.galonesProveedor), 'gal declarados'],
    ['EGEHID', entero(e.galonesEgehid), 'gal medidos', 'var(--primary)'],
    ['Diferencia', num(e.diferencia), `${pct(e.diferenciaPct)} del total`, e.diferencia < 0 ? 'var(--danger)' : undefined],
    ['Entregas', entero(e.total), cantidad(e.porLocacion.length, ['locación', 'locaciones'])],
  ];
  const titulo = f.agrupar === 'dia' ? 'día' : f.agrupar === 'mes' ? 'mes' : 'semana';
  return (
    <div className="est-movil">
      <Segmentado valor={f.agrupar} cambiar={(a) => setF({ ...f, agrupar: a })} movil />
      <div className="est-m-kpis">
        {kpis.map(([l, v, s, c]) => (
          <div key={l} className="est-m-kpi">
            <span className="est-m-kpi-l">{l}</span>
            <span className="est-m-kpi-v mono" style={c ? { color: c } : undefined}>
              {v}
            </span>
            <span className="est-m-kpi-s">{s}</span>
          </div>
        ))}
      </div>
      <section className="est-m-graf" aria-label="Galones por periodo">
        <div className="est-m-cab">
          <h2 className="tarjeta-titulo">Galones por {titulo}</h2>
          <Leyenda corta />
        </div>
        <GraficoBarras series={e.series.slice(-7)} conEje={false} resaltar={false} />
      </section>
      {e.avisos.length > 0 && (
        <Link to="/historial" className="est-m-avisos">
          <Icono nombre="triangle-alert" tam={18} />
          <span className="est-m-avisos-textos">
            <span className="est-m-avisos-t">
              {e.avisos.length} {e.avisos.length === 1 ? 'aviso' : 'avisos'} para revisión
            </span>
            <span className="est-m-avisos-s">Orientativos · no prueban irregularidad</span>
          </span>
          <Icono nombre="chevron-right" tam={16} />
        </Link>
      )}
      <section className="est-m-locs" aria-label="Top locaciones">
        <h2 className="tarjeta-titulo">Top locaciones</h2>
        {/* el diseño muestra 2; al 80 % caben 4 sin dejar media pantalla vacía */}
        <Locaciones filas={e.porLocacion} max={escalaDiseno() ? 2 : 4} otras={false} />
      </section>
    </div>
  );
}

export function Estadisticas() {
  const { data: cat } = useCatalogos();
  const tamano = useTamano();
  const [f, setF] = useState<FiltroEstadisticas & { agrupar: Agrupar }>(() => ({
    agrupar: 'semana',
    desde: desdePorDefecto(),
    hasta: hoyIso(),
  }));
  const q = useEstadisticas(f);
  const e = q.data;
  const locacion = cat?.locaciones.find((l) => String(l.id) === String(f.locacionId ?? ''));
  const corta = (iso?: string) => fecha(iso).slice(0, 5);
  usePagina({
    migas: 'Estadísticas',
    tituloMovil: 'Estadísticas',
    subMovil: `${corta(f.desde)} – ${fecha(f.hasta)} · ${locacion ? locacion.nombre : 'todas las locaciones'}`,
  });
  const cambiar = (n: Partial<FiltroEstadisticas>) => setF((v) => ({ ...v, ...n }) as typeof f);
  const unidad = UNIDAD[f.agrupar];
  const tituloGraf = useMemo(() => `Galones por ${unidad[0]} · proveedor vs. EGEHID`, [unidad]);
  const [exportando, setExportando] = useState(false);
  const [errorExcel, setErrorExcel] = useState<string | null>(null);
  const alExportar = async (datos: EstadisticasDto) => {
    setErrorExcel(null);
    setExportando(true);
    try {
      await exportarExcel(datos, f, locacion?.nombre ?? 'Todas las locaciones');
    } catch (err) {
      setErrorExcel(mensajeError(err));
    } finally {
      setExportando(false);
    }
  };

  if (tamano === 'movil') {
    if (!e) return q.isError ? <ErrorCaja error={q.error} /> : <Cargando />;
    return <EstadisticasMovil e={e} f={f} setF={(n) => setF(n as typeof f)} />;
  }

  const tabletV = tamano === 'tablet-v';
  return (
    <div className="est">
      <div className="pag-encabezado est-encabezado">
        <div className="pag-titulos">
          <h1 className="pag-titulo">Estadísticas de adquisiciones</h1>
          <div className="pag-sub">Compara lo declarado por el proveedor con lo medido por EGEHID · solo versiones vigentes</div>
        </div>
        <div className="pag-acciones">
          <button
            type="button"
            className="btn"
            disabled={!e || exportando}
            onClick={() => e && void alExportar(e)}
          >
            <Icono nombre="file-spreadsheet" tam={16} className="est-i-excel" />
            Excel
          </button>
          <button type="button" className="btn" onClick={() => window.print()}>
            <Icono nombre="file-text" tam={16} className="est-i-pdf" />
            Informe PDF
          </button>
        </div>
      </div>
      {errorExcel && <ErrorCaja error={errorExcel} />}
      <div className="tarjeta est-filtros">
        <Pildora icono="calendar" texto={`Desde ${fecha(f.desde)}`}>
          <input type="date" aria-label="Desde" value={f.desde ?? ''} max={f.hasta} onChange={(ev) => ev.target.value && cambiar({ desde: ev.target.value })} />
        </Pildora>
        <Pildora icono="calendar" texto={`Hasta ${fecha(f.hasta)}`}>
          <input type="date" aria-label="Hasta" value={f.hasta ?? ''} min={f.desde} onChange={(ev) => ev.target.value && cambiar({ hasta: ev.target.value })} />
        </Pildora>
        <Pildora icono="map-pin" texto={locacion?.nombre ?? 'Todas las locaciones'}>
          <select aria-label="Locación" value={String(f.locacionId ?? '')} onChange={(ev) => cambiar({ locacionId: ev.target.value || undefined })}>
            <option value="">Todas las locaciones</option>
            {cat?.locaciones.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre}
              </option>
            ))}
          </select>
        </Pildora>
        {!tabletV && (
          <Pildora icono="file-text" texto="Combustible y aceites">
            <select aria-label="Formulario" value="combustible" onChange={() => {}}>
              <option value="combustible">Combustible y aceites</option>
            </select>
          </Pildora>
        )}
        <span className="est-esp" />
        {!tabletV && <span className="est-agrupar">Agrupar</span>}
        <Segmentado valor={f.agrupar} cambiar={(a) => cambiar({ agrupar: a })} />
      </div>
      {!e && (q.isError ? <ErrorCaja error={q.error} /> : <Cargando />)}
      {e && (
        <>
          <div className="est-kpis">
            <div className="est-kpis-fila">
              <Kpi
                etiqueta="Adquisiciones fiscalizadas"
                valor={entero(e.total)}
                valorClassName="mono"
                sub={`${cantidad(e.series.length, unidad)} · ${cantidad(e.porLocacion.length, ['locación', 'locaciones'])}`}
                icono="clipboard-check"
                color="var(--primary)"
                fondo="var(--primary-soft)"
              />
              <Kpi
                etiqueta="Galones según proveedor"
                valor={num(e.galonesProveedor)}
                valorClassName="mono"
                sub={e.total ? `Promedio ${num(e.galonesProveedor / e.total)} por entrega` : 'Sin entregas'}
                icono="truck"
                color="var(--text-2)"
                fondo="var(--neutral-soft)"
              />
            </div>
            <div className="est-kpis-fila">
              <Kpi
                etiqueta="Galones medidos EGEHID"
                valor={num(e.galonesEgehid)}
                valorClassName="mono"
                sub={e.total ? `Promedio ${num(e.galonesEgehid / e.total)} por entrega` : 'Sin entregas'}
                icono="fuel"
                color="var(--fuel)"
                fondo="var(--fuel-soft)"
              />
              <Kpi
                etiqueta="Diferencia acumulada"
                valor={num(e.diferencia)}
                valorClassName="mono"
                sub={`${pct(e.diferenciaPct)} del total declarado`}
                icono="scale"
                color={e.diferencia < 0 ? 'var(--danger)' : 'var(--success)'}
                fondo={e.diferencia < 0 ? 'var(--danger-soft)' : 'var(--success-soft)'}
              />
            </div>
          </div>
          <div className="est-rejilla">
            <section className="tarjeta est-tarjeta est-graf" aria-label="Galones por periodo">
              <div className="est-cab">
                <h2 className="tarjeta-titulo">{tituloGraf}</h2>
                <Leyenda />
              </div>
              <GraficoBarras series={e.series} />
              <p className="est-nota">
                Las dos barras miden una misma entrega; no deben sumarse. {VACIOS[f.agrupar]} indican falta de registros.
              </p>
            </section>
            <div className="est-lateral">
              <section className="tarjeta est-tarjeta" aria-label="Galones por locación">
                <div className="est-cab">
                  <h2 className="tarjeta-titulo">Galones por locación</h2>
                </div>
                <Locaciones filas={e.porLocacion} max={5} />
              </section>
              <Avisos avisos={e.avisos} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
