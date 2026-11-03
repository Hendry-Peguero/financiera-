import { Link, useNavigate } from 'react-router-dom';
import { useMe, useResumenInicio } from '../api/hooks';
import type { AvisoDto, FiscalizacionResumenDto } from '../api/types';
import { numeroVisible, preguntasDe } from '../domain/fiscalizacion';
import { fecha, fechaLarga, haceTiempo, nombreMes } from '../domain/format';
import { estadoSeccion, pendientesPorSeccion, SECCIONES } from '../domain/validacion';
import { useCatalogos } from '../api/hooks';
import { useBorradoresLocales, useEnLinea, useTic } from '../offline/hooks';
import { BadgeEstado, Cargando, ErrorCaja, Kpi } from '../ui/comunes';
import { conSigno, diaMes, diferenciaAlerta, entero, numeroCorto, numTabla, rutaRegistro, saludo } from '../ui/formato';
import { Icono } from '../ui/Icono';
import { primerNombre } from '../ui/nav';
import { usePagina } from '../ui/pagina';
import { escalaDiseno, useTamano } from '../ui/tamano';
import './inicio.css';

/** Tabla «Actividad reciente» (N.º, Fecha, Destino, Suplidor, EGEHID, Diferencia, Estado). */
function TablaActividad({ filas }: { filas: FiscalizacionResumenDto[] }) {
  const navegar = useNavigate();
  if (!filas.length) return <div className="vacio">Aún no hay registros.</div>;
  return (
    <div className="ini-tabla" role="table" aria-label="Actividad reciente">
      <div className="tabla-cab" role="row">
        <span className="c-num" role="columnheader">N.º</span>
        <span className="c-fecha" role="columnheader">Fecha</span>
        <span className="c-destino" role="columnheader">Destino</span>
        <span className="c-suplidor" role="columnheader">Suplidor</span>
        <span className="c-gal" role="columnheader">EGEHID (gal)</span>
        <span className="c-dif" role="columnheader">Diferencia</span>
        <span className="c-estado" role="columnheader">Estado</span>
      </div>
      {filas.map((f) => (
        <div key={f.id} className="tabla-fila clicable" role="row" onClick={() => navegar(rutaRegistro(f))}>
          <span className="c-num mono" role="cell">
            <Link to={rutaRegistro(f)} onClick={(e) => e.stopPropagation()}>
              {numeroCorto(f.numero)}
            </Link>
          </span>
          <span className="c-fecha" role="cell">
            {fecha(f.fecha)}
          </span>
          <span className="c-destino" role="cell">
            {f.locacion ?? '—'}
          </span>
          <span className="c-suplidor" role="cell">
            {f.suplidor ?? '—'}
          </span>
          <span className="c-gal mono" role="cell">
            {numTabla(f.galonesEgehid)}
          </span>
          <span className={`c-dif mono${diferenciaAlerta(f) ? ' rojo' : ''}`} role="cell">
            {conSigno(f.diferenciaGal)}
          </span>
          <span className="c-estado" role="cell">
            <BadgeEstado estado={f.estado} enPapelera={f.enPapelera} />
          </span>
        </div>
      ))}
    </div>
  );
}

function Formularios() {
  return (
    <section className="tarjeta ini-lista" aria-label="Formularios disponibles">
      <div className="ini-cab">
        <h2 className="tarjeta-titulo">Formularios disponibles</h2>
      </div>
      <Link to="/fiscalizaciones/nueva" className="ini-form">
        <span className="ini-form-icono" style={{ background: 'var(--fuel-soft)', color: 'var(--fuel)' }}>
          <Icono nombre="fuel" tam={18} />
        </span>
        <span className="ini-form-textos">
          <span className="ini-form-t">Combustible y lubricantes</span>
          <span className="ini-form-s">Plantilla oficial · versión 2</span>
        </span>
        <Icono nombre="arrow-right" tam={16} className="ini-ir" />
      </Link>
    </section>
  );
}

function Avisos({ avisos }: { avisos: AvisoDto[] }) {
  return (
    <section className="tarjeta ini-lista ini-avisos" aria-label="Avisos para revisión">
      <div className="ini-cab">
        <h2 className="tarjeta-titulo">Avisos para revisión</h2>
      </div>
      {avisos.length === 0 && <div className="ini-aviso-vacio">Sin avisos.</div>}
      {avisos.map((a, i) => (
        <Link key={`${a.fiscalizacionId}-${a.tipo}-${i}`} to={`/fiscalizaciones/${a.fiscalizacionId}`} className="ini-aviso">
          <Icono nombre="triangle-alert" tam={16} className="ini-aviso-i" />
          <span className="ini-aviso-textos">
            <span className="ini-aviso-t">
              {numeroCorto(a.numero)} · {a.locacion ?? '—'}
            </span>
            <span className="ini-aviso-s">{a.mensaje}</span>
          </span>
        </Link>
      ))}
      <div className="ini-nota">Avisos orientativos: no son límites oficiales ni prueban irregularidad.</div>
    </section>
  );
}

/** Tarjeta «Continuar borrador» (móvil): el borrador de la tablet editado más recientemente. */
function ContinuarBorrador() {
  const borradores = useBorradoresLocales();
  const { data: catalogos } = useCatalogos();
  const ahora = useTic(15_000);
  const b = borradores.find((x) => x.modo === 'borrador');
  if (!b) return null;
  const d = b.datos;
  const preguntas = preguntasDe(catalogos);
  const pend = pendientesPorSeccion(d, preguntas);
  const completas = SECCIONES.filter((s) => estadoSeccion(d, s.id, pend, { preguntas }) === 'completa').length;
  const loc = catalogos?.locaciones.find((l) => l.id === d.visita.locacionId)?.nombre;
  const falta = pend.firmas.length ? 'faltan firmas de cierre' : pend.controles.length ? 'faltan controles' : 'revise y finalice';
  return (
    <Link to={`/fiscalizaciones/${d.id}/visita`} className="ini-continuar">
      <span className="ini-continuar-fila">
        <span className="ini-continuar-e">CONTINUAR BORRADOR</span>
        <span className="ini-continuar-s">Guardado {haceTiempo(b.actualizadoLocal, ahora)}</span>
      </span>
      <span className="ini-continuar-t">
        {numeroCorto(numeroVisible(d))}
        {loc ? ` · ${loc}` : ''}
      </span>
      <span className="ini-continuar-barra">
        <span style={{ width: `${(completas / SECCIONES.length) * 100}%` }} />
      </span>
      <span className="ini-continuar-p">
        {completas} de {SECCIONES.length} secciones · {falta}
      </span>
    </Link>
  );
}

function InicioMovil({ filas, kpis }: { filas: FiscalizacionResumenDto[]; kpis: { fin: number; bor: number; avisos: number } }) {
  // el diseño muestra 4; al 80 % caben 6 sin dejar media pantalla vacía
  const lista = filas.filter((f) => f.estado !== 'Borrador').slice(0, escalaDiseno() ? 4 : 6);
  return (
    <div className="ini-movil">
      <div className="ini-m-kpis">
        {(
          [
            ['Finalizados', kpis.fin, 'file-check', 'var(--primary)', 'var(--primary-soft)'],
            ['Borradores', kpis.bor, 'file-pen-line', 'var(--warning)', 'var(--warning-soft)'],
            ['Avisos', kpis.avisos, 'triangle-alert', 'var(--danger)', 'var(--danger-soft)'],
          ] as const
        ).map(([l, v, i, c, f]) => (
          <div key={l} className="tarjeta ini-m-kpi">
            <span className="ini-m-kpi-i" style={{ color: c, background: f }}>
              <Icono nombre={i} tam={14} />
            </span>
            <span className="ini-m-kpi-v">{v}</span>
            <span className="ini-m-kpi-l">{l}</span>
          </div>
        ))}
      </div>
      <ContinuarBorrador />
      <div className="ini-m-titulo">
        <h2>Actividad reciente</h2>
        <Link to="/historial">Ver todo</Link>
      </div>
      <div className="tarjeta ini-m-lista">
        {lista.length === 0 && <div className="vacio">Aún no hay registros.</div>}
        {lista.map((f) => (
          <Link key={f.id} to={rutaRegistro(f)} className="ini-m-fila">
            <span className="ini-m-icono">
              <Icono nombre="fuel" tam={18} />
            </span>
            <span className="ini-m-textos">
              <span className="ini-m-t">{f.locacion ?? '—'}</span>
              <span className="ini-m-s">
                {numeroCorto(f.numero)} · {f.suplidor ?? '—'} · {diaMes(f.fecha)}
              </span>
            </span>
            <span className="ini-m-der">
              <span className="ini-m-g mono">{numTabla(f.galonesEgehid)}</span>
              <BadgeEstado estado={f.estado} enPapelera={f.enPapelera} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Inicio() {
  const { data: me } = useMe();
  const { data, isPending, error } = useResumenInicio();
  const tamano = useTamano();
  const enLinea = useEnLinea();
  const nombre = primerNombre(me?.nombreCompleto);
  const hoy = new Date();
  usePagina({
    migas: 'Inicio',
    tituloMovil: `Hola${nombre ? `, ${nombre}` : ''}`,
    subMovil: enLinea ? 'En línea · guardado local' : 'Sin conexión · guardado local',
  });

  if (isPending) return <Cargando />;
  if (!data) return <div className="ini">{error ? <ErrorCaja error={error} /> : null}</div>;

  const dif = data.finalizadosMes - data.finalizadosMesAnterior;
  const mesAnterior = nombreMes((hoy.getMonth() + 11) % 12);
  const kpis = { fin: data.finalizadosMes, bor: data.borradores, avisos: data.avisos.length };

  if (tamano === 'movil') return <InicioMovil filas={data.recientes} kpis={kpis} />;

  return (
    <div className="ini">
      <div className="pag-encabezado">
        <div className="pag-titulos">
          <h1 className="pag-titulo">
            {saludo(hoy.getHours())}
            {nombre ? `, ${nombre}` : ''}
          </h1>
          <div className="pag-sub">
            {fechaLarga(hoy)} · {data.borradores} {data.borradores === 1 ? 'borrador espera' : 'borradores esperan'} cierre
          </div>
        </div>
        <div className="pag-acciones">
          <Link to="/cuenta/respaldo" className="btn">
            <Icono nombre="shield-check" tam={16} />
            Respaldo cifrado
          </Link>
          <Link to="/fiscalizaciones/nueva" className="btn btn-primario">
            <Icono nombre="plus" tam={16} />
            Nueva fiscalización
          </Link>
        </div>
      </div>
      {error ? <ErrorCaja error={error} /> : null}
      <div className="ini-kpis">
        <div className="ini-kpis-fila">
          <Kpi
            etiqueta="Finalizados este mes"
            valor={entero(data.finalizadosMes)}
            sub={`${dif >= 0 ? '+' : '−'}${Math.abs(dif)} respecto a ${mesAnterior}`}
            icono="file-check"
            color="var(--primary)"
            fondo="var(--primary-soft)"
          />
          <Kpi
            etiqueta="Borradores pendientes"
            valor={entero(data.borradores)}
            sub={`${data.borradoresFirmasIncompletas} con firmas incompletas`}
            icono="file-pen-line"
            color="var(--warning)"
            fondo="var(--warning-soft)"
          />
        </div>
        <div className="ini-kpis-fila">
          <Kpi
            etiqueta="Galones fiscalizados"
            valor={entero(data.galonesMes)}
            sub={`EGEHID · ${nombreMes(hoy.getMonth())} ${hoy.getFullYear()}`}
            icono="fuel"
            color="var(--fuel)"
            fondo="var(--fuel-soft)"
          />
          <Kpi
            etiqueta="Avisos para revisión"
            valor={entero(data.avisos.length)}
            sub="Diferencias mayores al 1 %"
            icono="triangle-alert"
            color="var(--danger)"
            fondo="var(--danger-soft)"
          />
        </div>
      </div>
      <div className="ini-rejilla">
        <section className="tarjeta ini-actividad" aria-label="Actividad reciente">
          <div className="ini-cab">
            <h2 className="tarjeta-titulo">Actividad reciente</h2>
            <Link to="/historial" className="enlace">
              Ver historial completo →
            </Link>
          </div>
          <TablaActividad filas={data.recientes} />
        </section>
        <div className="ini-lateral">
          <Formularios />
          <Avisos avisos={data.avisos} />
        </div>
      </div>
    </div>
  );
}

/** @deprecated temporal: se elimina al rehacer Historial y Estadísticas. */
export function TablaResumen({ filas }: { filas: FiscalizacionResumenDto[]; conAutor?: boolean }) {
  return <TablaActividad filas={filas} />;
}
/** @deprecated temporal: se elimina al rehacer Estadísticas. */
export function ListaAvisos({ avisos }: { avisos: AvisoDto[] }) {
  return <Avisos avisos={avisos} />;
}
