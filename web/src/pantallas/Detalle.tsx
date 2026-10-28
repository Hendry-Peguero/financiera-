import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { descargarPdf, nombreArchivoPdf, pdfDe, rutaPdfVersion } from '../api/pdf';
import { useCatalogos, useFiscalizacion, useMe, useVersiones } from '../api/hooks';
import type { FiscalizacionDto, VersionDto } from '../api/types';
import { calcular } from '../domain/calculos';
import { fecha, num, numConSigno } from '../domain/format';
import { FotoServidor } from '../formulario/SeccionFotos';
import { importarDelServidor } from '../offline/sync';
import { BadgeEstado, Cargando, ErrorCaja, nombreEstado } from '../ui/comunes';
import { mensajeError } from '../ui/errores';
import { Icono } from '../ui/Icono';
import { usePagina } from '../ui/pagina';
import { useTamano } from '../ui/tamano';
import { VisorPdf } from './DocumentoPdf';
import { momento12, momento12Corto, nombrePdf, sinParentesis } from './formatoRegistros';
import './detalle.css';
import { nombreSuplidor } from '../domain/fiscalizacion';
import { eliminarBorrador } from '../offline/sync';

type Pestana = 'versiones' | 'cambios' | 'fotos';

/** «Modificado · versión 3»; los borradores no tienen versión. */
function textoEstado(f: FiscalizacionDto): string {
  const e = nombreEstado(f.enPapelera ? 'Papelera' : (f.estado ?? 'Borrador'));
  return f.versionActual && f.estado !== 'Borrador' ? `${e} · versión ${f.versionActual}` : e;
}

function tituloVersion(v: VersionDto): string {
  return `Versión ${v.version}${v.vigente ? ' · vigente' : v.version === 1 ? ' · original' : ''}`;
}

function Cambio({ c }: { c: VersionDto['cambios'][number] }) {
  return (
    <div className="det-cambio">
      <div className="det-cambio-campo">{c.campo}</div>
      <div className="det-cambio-valores">
        <span className="det-antes mono">{c.valorAnterior ?? '—'}</span>
        <Icono nombre="arrow-right" tam={13} />
        <span className="det-despues mono">{c.valorNuevo ?? '—'}</span>
      </div>
    </div>
  );
}

function CambiosDe({ v }: { v: VersionDto }) {
  return (
    <div className="det-cambios">
      <div className="det-cambios-t">CAMBIOS DE LA VERSIÓN {v.version}</div>
      {v.cambios.length === 0 && <div className="det-vacio">{v.version === 1 ? 'Versión original: sin cambios previos.' : 'Sin cambios por campo.'}</div>}
      {v.cambios.map((c) => (
        <Cambio key={c.campo} c={c} />
      ))}
    </div>
  );
}

function LineaTiempo({
  versiones,
  elegida,
  elegir,
  pdf,
}: {
  versiones: VersionDto[];
  elegida: number;
  elegir: (v: number) => void;
  /** Descarga el PDF oficial de esa versión. */
  pdf: (v: number) => void;
}) {
  return (
    <div className="det-tiempo">
      {versiones.map((v, i) => (
        <div className={`det-version${v.version === elegida ? ' elegida' : ''}`} key={v.version}>
          <div className="det-riel">
            <span className={`det-punto${v.vigente ? ' vigente' : ''}`} />
            {i < versiones.length - 1 && <span className="det-linea" />}
          </div>
          <div className="det-v-tarjeta">
            <div className="det-v-fila">
              <span className={`det-v-t${v.vigente ? ' vigente' : ''}`}>{tituloVersion(v)}</span>
              <span className="det-v-acciones">
                <button type="button" className="det-v-l" aria-label={`PDF de la versión ${v.version}`} onClick={() => pdf(v.version)}>
                  PDF
                </button>
                <button type="button" className="det-v-l" aria-label={`${v.vigente ? 'Ver' : 'Abrir'} versión ${v.version}`} onClick={() => elegir(v.version)}>
                  {v.vigente ? 'Ver' : 'Abrir'}
                </button>
              </span>
            </div>
            <div className="det-v-m">
              {momento12(v.creadoEn)} · {v.creadoPor}
            </div>
            {v.resumen && <div className="det-v-d">{v.resumen}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Fotos({ f }: { f: FiscalizacionDto }) {
  const fotos = [...(f.fotos ?? [])].sort((a, b) => a.orden - b.orden);
  if (!fotos.length) return <div className="det-vacio det-pad">Este registro no tiene fotografías.</div>;
  return (
    <div className="det-fotos">
      {fotos.map((x) => (
        <figure className="det-foto" key={x.id}>
          <div className="det-foto-img">
            <FotoServidor fiscalizacionId={f.id} foto={x} />
          </div>
          <figcaption>
            {x.orden}. {x.descripcion ?? ''}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

/** Panel derecho: Versiones (línea de tiempo + cambios de la elegida), Cambios por campo y Fotos. */
function Panel({ f, admin, pdfVersion }: { f: FiscalizacionDto; admin: boolean; pdfVersion: (v: number) => void }) {
  const [pestana, setPestana] = useState<Pestana>(admin ? 'versiones' : 'fotos');
  const q = useVersiones(f.id, admin);
  const versiones = q.data ?? [];
  const [elegida, setElegida] = useState<number | null>(null);
  const actual = versiones.find((v) => v.version === elegida) ?? versiones.find((v) => v.vigente) ?? versiones[0];
  const tabs: { clave: Pestana; texto: string }[] = [
    ...(admin
      ? [
          { clave: 'versiones' as const, texto: 'Versiones' },
          { clave: 'cambios' as const, texto: 'Cambios por campo' },
        ]
      : []),
    { clave: 'fotos', texto: `Fotos (${f.fotos?.length ?? 0})` },
  ];
  return (
    <section className="det-panel" aria-label="Versiones y cambios">
      <div className="det-pestanas" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.clave}
            type="button"
            role="tab"
            aria-selected={pestana === t.clave}
            className={`det-pestana${pestana === t.clave ? ' activa' : ''}`}
            onClick={() => setPestana(t.clave)}
          >
            {t.texto}
          </button>
        ))}
      </div>
      <div className="det-panel-cuerpo">
        {pestana !== 'fotos' && q.isPending && <Cargando />}
        {pestana !== 'fotos' && q.isError && (
          <div className="det-pad">
            <ErrorCaja error={q.error} />
          </div>
        )}
        {pestana === 'versiones' && actual && (
          <>
            <LineaTiempo versiones={versiones} elegida={actual.version} elegir={setElegida} pdf={pdfVersion} />
            <CambiosDe v={actual} />
          </>
        )}
        {pestana === 'cambios' &&
          versiones
            .filter((v) => v.cambios.length > 0)
            .map((v) => <CambiosDe key={v.version} v={v} />)}
        {pestana === 'cambios' && q.data && !versiones.some((v) => v.cambios.length) && <div className="det-vacio det-pad">Aún no hay correcciones.</div>}
        {pestana === 'fotos' && <Fotos f={f} />}
      </div>
      <div className="det-nota">
        <Icono nombre="lock" tam={14} />
        <span>Solo el administrador ve versiones anteriores. Son de solo lectura.</span>
      </div>
    </section>
  );
}

/** Permisos y acciones comunes de escritorio y móvil. */
function useAcciones(f: FiscalizacionDto | undefined) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const navegar = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [descargando, setDescargando] = useState(false);
  const admin = me?.rol === 'Administrador';
  const esAutor = !!f && f.autor?.id === me?.id;
  const finalizado = f?.estado === 'Finalizado' || f?.estado === 'Modificado';
  const ejecutar = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(mensajeError(e));
    }
  };
  const bajar = (ruta: string, nombre: string) =>
    ejecutar(async () => {
      setDescargando(true);
      try {
        await descargarPdf(ruta, nombre);
      } finally {
        setDescargando(false);
      }
    });
  return {
    admin,
    error,
    esAutor,
    descargando,
    /** PDF oficial de la versión vigente (o la vista previa «BORRADOR» si todavía es un borrador), generado por la API. */
    descargarPdf: () => {
      if (!f) return;
      const { ruta, nombre } = pdfDe(f);
      return bajar(ruta, nombre);
    },
    /** PDF oficial de una versión anterior (Administrador). */
    descargarPdfVersion: (v: number) => f && bajar(rutaPdfVersion(f.id, v), nombreArchivoPdf(f.numero, v)),
    puedeCorregir: !!f && finalizado && !f.enPapelera && (admin || esAutor),
    puedeBorrar: !!f && !f.enPapelera && ((f.estado === 'Borrador' && esAutor) || admin),
    corregir: () =>
      f &&
      ejecutar(async () => {
        await importarDelServidor(f, 'correccion');
        navegar(`/fiscalizaciones/${f.id}/visita`);
      }),
    papelera: () =>
      f &&
      ejecutar(async () => {
        if (!window.confirm(f.estado === 'Borrador' ? '¿Eliminar este borrador? Se borra también de esta tablet.' : '¿Mover este registro a la papelera?'))
          return;
        if (f.estado === 'Borrador') await eliminarBorrador(f.id);
        else await api.del(`/fiscalizaciones/${f.id}`);
        await qc.invalidateQueries();
        navegar('/historial');
      }),
    restaurar: () =>
      f &&
      ejecutar(async () => {
        const dto = await api.post<FiscalizacionDto>(`/fiscalizaciones/${f.id}/restaurar`);
        qc.setQueryData(['fiscalizacion', f.id], dto);
        await qc.invalidateQueries({ queryKey: ['fiscalizaciones'] });
      }),
  };
}

function DetalleMovil({ f }: { f: FiscalizacionDto }) {
  const a = useAcciones(f);
  const { data: cat } = useCatalogos();
  const q = useVersiones(f.id, a.admin);
  const [elegida, setElegida] = useState<number | null>(null);
  const [verPdf, setVerPdf] = useState(false);
  const c = f.calculos ?? calcular(f.mediciones);
  const loc = cat?.locaciones.find((l) => l.id === f.visita.locacionId);
  const sup = nombreSuplidor(f.suplidor, cat);
  const versiones = q.data ?? [];
  const actual = versiones.find((v) => v.version === elegida) ?? versiones.find((v) => v.vigente) ?? versiones[0];
  const negativa = (c.diferenciaGal ?? 0) < 0;
  usePagina({
    tituloMovil: `#${f.numero ?? '—'}`,
    subMovil: `${loc?.nombre ?? '—'}${f.versionActual ? ` · versión ${f.versionActual}` : ''}`,
  });
  const datos = [
    f.suplidor.conduce && `Conduce ${f.suplidor.conduce}`,
    f.suplidor.chofer && `Chofer ${f.suplidor.chofer}`,
    f.suplidor.placa && `Placa ${f.suplidor.placa}`,
  ].filter(Boolean);
  return (
    <div className="det-m">
      {a.error && <ErrorCaja error={a.error} />}
      <section className="det-m-tarjeta" aria-label="Resumen">
        <div className="det-m-fila">
          <BadgeEstado estado={f.estado} enPapelera={f.enPapelera} />
          <span className="det-m-fecha">{fecha(f.visita.fecha)}</span>
        </div>
        <h1 className="det-m-sup">{sup ?? 'Sin suplidor'}</h1>
        {datos.length > 0 && <p className="det-m-datos">{datos.join(' · ')}</p>}
        <div className="det-m-nums">
          <div className="det-m-num">
            <span>Proveedor</span>
            <strong className="mono">{num(f.mediciones.galonesProveedor)}</strong>
          </div>
          <div className="det-m-num egehid">
            <span>EGEHID</span>
            <strong className="mono">{num(f.mediciones.galonesEgehid)}</strong>
          </div>
          <div className={`det-m-num${negativa ? ' negativa' : ''}`}>
            <span>Diferencia</span>
            <strong className="mono">{numConSigno(c.diferenciaGal)}</strong>
          </div>
        </div>
      </section>
      <div className="det-m-acciones">
        <button type="button" className="btn btn-grande" onClick={() => setVerPdf(true)}>
          <Icono nombre="file-text" tam={16} />
          Ver PDF
        </button>
        {a.puedeCorregir && (
          <button type="button" className="btn btn-primario btn-grande" onClick={() => void a.corregir()}>
            <Icono nombre="pencil" tam={16} />
            Corregir
          </button>
        )}
        {f.estado === 'Borrador' && !f.enPapelera && a.esAutor && (
          <Link className="btn btn-primario btn-grande" to={`/fiscalizaciones/${f.id}/visita`}>
            <Icono nombre="pencil" tam={16} />
            Continuar
          </Link>
        )}
        {f.enPapelera && a.admin && (
          <button type="button" className="btn btn-grande" onClick={() => void a.restaurar()}>
            <Icono nombre="rotate-ccw" tam={16} />
            Restaurar
          </button>
        )}
      </div>
      {a.admin && versiones.length > 0 && (
        <section className="det-m-tarjeta" aria-label="Versiones">
          <h2 className="det-m-t">Versiones</h2>
          {versiones.map((v) => (
            <button
              type="button"
              key={v.version}
              className={`det-m-version${actual?.version === v.version ? ' elegida' : ''}`}
              onClick={() => setElegida(v.version)}
            >
              <span className={`det-punto${v.vigente ? ' vigente' : ''}`} />
              <span className="det-m-v-textos">
                <span className={`det-m-v-t${v.vigente ? ' vigente' : ''}`}>{tituloVersion(v)}</span>
                <span className="det-m-v-s">
                  {momento12Corto(v.creadoEn)} · {sinParentesis(v.creadoPor)}
                </span>
              </span>
              <Icono nombre="chevron-right" tam={16} />
            </button>
          ))}
          {actual && (
            <button
              type="button"
              className="det-m-v-pdf"
              disabled={a.descargando}
              onClick={() => void a.descargarPdfVersion(actual.version)}
            >
              <Icono nombre="download" tam={14} />
              PDF de la versión {actual.version}
            </button>
          )}
        </section>
      )}
      {a.admin && actual && actual.cambios.length > 0 && (
        <section className="det-m-tarjeta" aria-label={`Cambios de la versión ${actual.version}`}>
          <h2 className="det-m-t">Cambios de la versión {actual.version}</h2>
          {actual.cambios.map((x) => (
            <div className="det-m-cambio" key={x.campo}>
              <span className="det-m-c">{x.campo}</span>
              <span className="det-m-vals">
                <span className="det-m-a mono">{x.valorAnterior ?? '—'}</span>
                <Icono nombre="arrow-right" tam={12} />
                <span className="det-m-b mono">{x.valorNuevo ?? '—'}</span>
              </span>
            </div>
          ))}
        </section>
      )}
      {a.puedeBorrar && (
        <button type="button" className="btn btn-peligro btn-grande" onClick={() => void a.papelera()}>
          <Icono nombre="trash-2" tam={16} />
          Mover a papelera
        </button>
      )}
      {verPdf && (
        <div className="det-m-pdf" role="dialog" aria-modal="true" aria-label="PDF del registro">
          <VisorPdf
            f={f}
            nombre={nombrePdf(f)}
            zoomInicial={0.74}
            extra={
              <>
                <button type="button" aria-label="Descargar PDF" disabled={a.descargando} onClick={() => void a.descargarPdf()}>
                  <Icono nombre="download" tam={16} />
                </button>
                <button type="button" aria-label="Cerrar" onClick={() => setVerPdf(false)}>
                  <Icono nombre="x" tam={16} />
                </button>
              </>
            }
          />
        </div>
      )}
    </div>
  );
}

export function Detalle() {
  const { id = '' } = useParams();
  const q = useFiscalizacion(id);
  const tamano = useTamano();
  if (q.isPending) return <Cargando />;
  if (q.isError) return <ErrorCaja error={q.error} />;
  return tamano === 'movil' ? <DetalleMovil f={q.data} /> : <DetalleAmplio f={q.data} />;
}

function DetalleAmplio({ f }: { f: FiscalizacionDto }) {
  const a = useAcciones(f);
  const { data: cat } = useCatalogos();
  const loc = cat?.locaciones.find((l) => l.id === f.visita.locacionId);
  const sup = nombreSuplidor(f.suplidor, cat);
  usePagina({ migas: `Historial › #${f.numero ?? '—'}`, navActiva: a.admin ? '/versiones' : '/historial' });
  const sub = [
    sup,
    fecha(f.visita.fecha),
    f.autor?.nombreCompleto && `creado por ${f.autor.nombreCompleto}`,
    (f.versionActual ?? 0) > 1 && `última corrección ${momento12(f.actualizadoEn)}`,
  ].filter(Boolean);
  return (
    <div className="det">
      <div className="pag-encabezado det-encabezado">
        <div className="pag-titulos det-titulos">
          <div className="det-linea-t">
            <h1 className="pag-titulo">
              #{f.numero ?? '—'} · {loc?.nombre ?? 'Sin destino'}
            </h1>
            <BadgeEstado estado={f.estado} enPapelera={f.enPapelera} texto={textoEstado(f)} />
          </div>
          <div className="pag-sub">{sub.join(' · ')}</div>
        </div>
        <div className="pag-acciones">
          {a.puedeBorrar && (
            <button type="button" className="btn btn-peligro" onClick={() => void a.papelera()}>
              <Icono nombre="trash-2" tam={16} />
              Mover a papelera
            </button>
          )}
          {f.enPapelera && a.admin && (
            <button type="button" className="btn" onClick={() => void a.restaurar()}>
              <Icono nombre="rotate-ccw" tam={16} />
              Restaurar
            </button>
          )}
          <button type="button" className="btn" disabled={a.descargando} onClick={() => void a.descargarPdf()}>
            <Icono nombre="download" tam={16} />
            {a.descargando ? 'Generando PDF…' : 'Descargar PDF'}
          </button>
          {f.estado === 'Borrador' && !f.enPapelera && a.esAutor && (
            <Link className="btn btn-primario" to={`/fiscalizaciones/${f.id}/visita`}>
              <Icono nombre="pencil" tam={16} />
              Continuar editando
            </Link>
          )}
          {a.puedeCorregir && (
            <button type="button" className="btn btn-primario" onClick={() => void a.corregir()}>
              <Icono nombre="pencil" tam={16} />
              Corregir registro
            </button>
          )}
        </div>
      </div>
      {a.error && <ErrorCaja error={a.error} />}
      <div className="det-cuerpo">
        <VisorPdf f={f} nombre={nombrePdf(f)} />
        <Panel f={f} admin={a.admin} pdfVersion={(v) => void a.descargarPdfVersion(v)} />
      </div>
    </div>
  );
}
