import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useCatalogos, useFiscalizacion, useMe, useSolicitudesMias } from '../api/hooks';
import type { CatalogosDto, FiscalizacionDto, SolicitudFirmaDto, UsuarioDto } from '../api/types';
import { calcular } from '../domain/calculos';
import { nombreRol, nombreSuplidor, ROLES_FIRMA } from '../domain/fiscalizacion';
import { aFecha, fecha, horaDe, momento } from '../domain/format';
import { pendientesPorSeccion } from '../domain/validacion';
import { Cargando, ErrorCaja, Modal } from '../ui/comunes';
import { mensajeError } from '../ui/errores';
import { trazoCorto, TrazoFirma, useMiFirma } from '../ui/firma';
import { numTabla } from '../ui/formato';
import { Icono } from '../ui/Icono';
import { LienzoFirma, type ControlLienzo } from '../ui/LienzoFirma';
import { iniciales, nombreCorto } from '../ui/nav';
import { useTamano } from '../ui/tamano';
import './firmas.css';

/** «hoy 10:35», «ayer 16:20» o «18/10/2026 09:12». */
function cuando(iso: string, ahora = new Date()): string {
  const d = aFecha(iso);
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((dia(ahora) - dia(d)) / 86_400_000);
  if (dias === 0) return `hoy ${horaDe(iso)}`;
  if (dias === 1) return `ayer ${horaDe(iso)}`;
  return momento(iso);
}

/** «vence en 7 días» / «vence hoy» / «vencida». */
function vence(iso: string, ahora = Date.now()): string {
  const ms = aFecha(iso).getTime() - ahora;
  if (ms <= 0) return 'vencida';
  const dias = Math.ceil(ms / 86_400_000);
  return dias <= 1 ? 'vence hoy' : `vence en ${dias} días`;
}

/** «C.H. Jigüey» → «Central Jigüey» (como en el resumen del diseño). */
function lugar(cat: CatalogosDto | undefined, id: number | null | undefined): string {
  const n = cat?.locaciones.find((l) => l.id === id)?.nombre;
  return n ? n.replace(/^C\.\s?H\.\s*/i, 'Central ') : '—';
}

interface FilaSeccion {
  id: string;
  titulo: string;
  sub: string;
  estado: string;
  clase: 'ok' | 'warn' | 'curso';
}

function filasSecciones(d: FiscalizacionDto, cat: CatalogosDto | undefined): FilaSeccion[] {
  const pend = pendientesPorSeccion(d, cat?.preguntasControl.length ? cat.preguntasControl : undefined);
  const suplidor = nombreSuplidor(d.suplidor, cat) ?? '—';
  const respondidos = d.controles.filter((c) => c.respuesta != null).length;
  const conObs = d.controles.filter((c) => (c.observacion ?? '').trim()).length;
  const nFotos = d.fotos?.length ?? 0;
  const nFirmas = d.firmas?.length ?? 0;
  const estado = (n: number, extra?: string): Pick<FilaSeccion, 'estado' | 'clase'> =>
    n > 0 ? { estado: `${n} pendiente${n === 1 ? '' : 's'}`, clase: 'warn' } : extra ? { estado: extra, clase: 'warn' } : { estado: 'Completa', clase: 'ok' };
  return [
    {
      id: 'visita',
      titulo: 'Visita',
      sub: `Horario y lugar · ${suplidor} · EGEHID`,
      ...estado(pend.visita.length, (d.observacionesGenerales ?? '').trim() ? '1 observación' : undefined),
    },
    { id: 'mediciones', titulo: 'Mediciones', sub: 'Totales, lecturas de equipos y vara', ...estado(pend.mediciones.length) },
    {
      id: 'controles',
      titulo: 'Controles internos',
      sub: `${respondidos} de ${d.controles.length} respondidos · ${conObs} con observación`,
      ...estado(pend.controles.length),
    },
    { id: 'fotos', titulo: 'Fotografías', sub: `${nFotos} foto${nFotos === 1 ? '' : 's'}`, ...estado(pend.fotos.length) },
    {
      id: 'firmas',
      titulo: 'Firmas',
      sub: `${nFirmas} de ${ROLES_FIRMA.length} firmadas`,
      ...(nFirmas >= ROLES_FIRMA.length ? { estado: 'Completa', clase: 'ok' as const } : { estado: 'En curso', clase: 'curso' as const }),
    },
  ];
}

/** Firma predeterminada (PNG de GET /me/firma) sobre la línea, con nombre y cargo. */
function MiFirma({ me, pie = true }: { me: UsuarioDto; pie?: boolean }) {
  const { imagen } = useMiFirma(me.tieneFirma);
  return (
    <div className="rf-trazo">
      {imagen ? (
        <img className="rf-trazo-img" src={`data:image/png;base64,${imagen}`} alt="Su firma predeterminada" />
      ) : (
        <span className="rf-trazo-img" style={{ display: 'grid', placeItems: 'center' }}>
          <TrazoFirma texto={nombreCorto(me.nombreCompleto)} tam={40} peso={400} />
        </span>
      )}
      <span className="rf-trazo-linea" aria-hidden="true" />
      {pie && (
        <span className="rf-trazo-pie">
          {me.nombreCompleto}
          {me.cargo ? ` · ${me.cargo}` : ''}
        </span>
      )}
    </div>
  );
}

/** Recuadro para dibujar una firma nueva solo para este formulario. */
function FirmaNueva({ alCambiar }: { alCambiar: (b: string | null) => void }) {
  const lienzo = useRef<ControlLienzo>(null);
  return (
    <>
      <div className="rf-trazo rf-trazo-dibujo">
        <div className="rf-trazo-capa">
          <LienzoFirma alCambiar={alCambiar} control={lienzo} etiqueta="Recuadro de firma: firme con el dedo o el lápiz" />
        </div>
        <span className="rf-trazo-linea" aria-hidden="true" />
      </div>
      <button type="button" className="rf-trazo-borrar" onClick={() => lienzo.current?.borrar()}>
        <Icono nombre="eraser" tam={13} />
        Borrar
      </button>
    </>
  );
}

function Contenido({ sol, me }: { sol: SolicitudFirmaDto; me: UsuarioDto }) {
  const tamano = useTamano();
  const navegar = useNavigate();
  const qc = useQueryClient();
  const f = useFiscalizacion(sol.fiscalizacionId);
  const { data: cat } = useCatalogos();
  const [modo, setModo] = useState<'predeterminada' | 'nueva'>(me.tieneFirma ? 'predeterminada' : 'nueva');
  const [imagen, setImagen] = useState<string | null>(null);
  const [doyFe, setDoyFe] = useState(false);
  const [rechazo, setRechazo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const rol = nombreRol(sol.rol);
  const solicitante = nombreCorto(sol.solicitadaPor);
  const movil = tamano === 'movil';
  const pendiente = sol.estado === 'Pendiente';

  const terminar = async (msg: string) => {
    await qc.invalidateQueries({ queryKey: ['solicitudes-mias'] });
    navegar('/firmas/solicitudes', { state: { msg } });
  };

  const firmar = async () => {
    setError(null);
    if (!doyFe) return setError('Marque la declaración antes de firmar.');
    if (modo === 'nueva' && !imagen) return setError('Falta la firma: firme dentro del recuadro.');
    setEnviando(true);
    try {
      await api.post(`/solicitudes-firma/${sol.id}/firmar`, {
        usarPredeterminada: modo === 'predeterminada',
        imagenBase64: modo === 'nueva' ? imagen : null,
      });
      await terminar(`Firmó como ${rol} en #${sol.numero}.`);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  };

  const rechazar = async () => {
    if (!rechazo?.trim()) return setError('Escriba el motivo del rechazo.');
    setError(null);
    try {
      await api.post(`/solicitudes-firma/${sol.id}/rechazar`, { comentario: rechazo.trim() });
      await terminar(`Rechazó la solicitud de #${sol.numero}.`);
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  const d = f.data;
  const c = d ? (d.calculos ?? calcular(d.mediciones)) : null;
  const dif = c?.diferenciaGal ?? null;
  const suplidor = d ? (nombreSuplidor(d.suplidor, cat) ?? '—') : '—';
  const fechaLugar = d ? `${fecha(d.visita.fecha)} · ${lugar(cat, d.visita.locacionId)}` : '—';
  const firmas = d?.firmas ?? [];
  const verCompleto = `/fiscalizaciones/${sol.fiscalizacionId}`;

  const errorCaja = error && (
    <div className="aviso aviso-error" role="alert">
      {error}
    </div>
  );
  const declaracion = (
    <label className={`rf-declaro${movil ? ' rfm-declaro' : ''}`}>
      <input type="checkbox" className="rf-check" checked={doyFe} onChange={(e) => setDoyFe(e.target.checked)} />
      <span>{movil ? 'Revisé la información y doy fe de su contenido.' : `Revisé la información y doy fe de su contenido como ${rol}.`}</span>
    </label>
  );
  const botonFirmar = (
    <button type="button" className="btn btn-primario rf-firmar" disabled={enviando || !pendiente} onClick={() => void firmar()}>
      <Icono nombre="signature" tam={16} />
      Firmar como {rol}
    </button>
  );
  const botonRechazar = (
    <button type="button" className="rf-rechazar" disabled={!pendiente} onClick={() => setRechazo('')}>
      Rechazar y comentar
    </button>
  );
  const modalRechazo = rechazo !== null && (
    <Modal
      titulo="Rechazar y comentar"
      sub={`${solicitante} verá su comentario en la fiscalización #${sol.numero}.`}
      alCerrar={() => setRechazo(null)}
      pie={
        <>
          <button type="button" className="btn" onClick={() => setRechazo(null)}>
            Cancelar
          </button>
          <button type="button" className="btn btn-peligro" onClick={() => void rechazar()}>
            Rechazar
          </button>
        </>
      }
    >
      <div className="campo">
        <label className="campo-etiqueta" htmlFor="rf-motivo">
          ¿Qué no es correcto?
        </label>
        <textarea id="rf-motivo" rows={4} value={rechazo} onChange={(e) => setRechazo(e.target.value)} />
      </div>
      {errorCaja}
    </Modal>
  );
  const noPendiente = !pendiente && (
    <div className="aviso aviso-info" role="status">
      Esta solicitud ya no está pendiente ({sol.estado.toLowerCase()}).
    </div>
  );

  if (movil)
    return (
      <div className="rf t-movil">
        <header className="rfm-cab">
          <div className="rfm-fila">
            <button type="button" className="rfm-volver" aria-label="Volver" onClick={() => navegar('/firmas/solicitudes')}>
              <Icono nombre="arrow-left" tam={22} />
            </button>
            <div className="rf-barra-textos">
              <div className="rfm-t">Firma solicitada</div>
              <div className="rfm-s">Fiscalización #{sol.numero}</div>
            </div>
            <span className="rfm-modo">
              <Icono nombre="eye" tam={12} />
              Solo lectura
            </span>
          </div>
          <div className="rfm-solicitud">
            <span className="rfm-av">{iniciales(sol.solicitadaPor)}</span>
            <div className="rf-barra-textos">
              <div className="rfm-sol-t">{solicitante} le pide su firma</div>
              <div className="rfm-s">
                Como {rol} · {vence(sol.expiraEn)}
              </div>
            </div>
          </div>
        </header>
        <main className="rfm-contenido">
          {noPendiente}
          {f.isError && <ErrorCaja error={f.error} />}
          <section className="rfm-resumen" aria-label="Resumen">
            {f.isPending ? (
              <Cargando />
            ) : (
              <>
                <div className="rfm-dato">
                  <span className="rfm-dato-l">Fecha y lugar</span>
                  <span className="rfm-dato-v">{fechaLugar}</span>
                </div>
                <div className="rfm-dato">
                  <span className="rfm-dato-l">Suplidor</span>
                  <span className="rfm-dato-v">{suplidor}</span>
                </div>
                <div className="rfm-dato">
                  <span className="rfm-dato-l">Recibido</span>
                  <span className="rfm-dato-v">
                    {numTabla(d?.mediciones.galonesEgehid)} gal · dif. {numTabla(dif)} gal
                  </span>
                </div>
                <div className="rfm-dato">
                  <span className="rfm-dato-l">Firmas</span>
                  <span className="rfm-dato-v">
                    {firmas.length} de {ROLES_FIRMA.length} registradas
                  </span>
                </div>
              </>
            )}
            <Link to={verCompleto} className="rfm-ver">
              <Icono nombre="file-text" tam={14} />
              <span>Revisar formulario completo</span>
              <Icono nombre="chevron-right" tam={14} />
            </Link>
          </section>
          <section className="rfm-firma" aria-label="Su firma">
            {modo === 'predeterminada' ? (
              <>
                <label className="rf-opcion-cab">
                  <input type="radio" className="rf-radio" name="rf-modo" checked readOnly />
                  <span>Usar mi firma predeterminada</span>
                </label>
                <MiFirma me={me} pie={false} />
                <button type="button" className="rfm-otra" onClick={() => setModo('nueva')}>
                  <Icono nombre="pen-line" tam={13} />
                  Dibujar otra firma para este formulario
                </button>
              </>
            ) : (
              <>
                <div className="rf-opcion-cab">
                  <span>Firma nueva para este formulario</span>
                </div>
                <FirmaNueva alCambiar={setImagen} />
                {me.tieneFirma && (
                  <button type="button" className="rfm-otra" onClick={() => setModo('predeterminada')}>
                    <Icono nombre="signature" tam={13} />
                    Usar mi firma predeterminada
                  </button>
                )}
              </>
            )}
          </section>
          {declaracion}
          {rechazo === null && errorCaja}
        </main>
        <footer className="rfm-acciones">
          {botonFirmar}
          {botonRechazar}
        </footer>
        {modalRechazo}
      </div>
    );

  return (
    <div className={`rf t-${tamano}`}>
      <header className="rf-barra">
        <span className="rf-logo">
          <Icono nombre="fuel" tam={16} />
        </span>
        <div className="rf-barra-textos">
          <div className="rf-barra-t">Firma solicitada · Fiscalización #{sol.numero}</div>
          <div className="rf-barra-s">
            Solicitada por {solicitante} · {cuando(sol.creadaEn)}
          </div>
        </div>
        <span className="rf-modo">
          <Icono nombre="eye" tam={13} />
          Solo lectura + firma
        </span>
        <span className="rf-usuario">
          <span className="rf-av">{iniciales(me.nombreCompleto, me.correo)}</span>
          {nombreCorto(me.nombreCompleto, me.correo)}
        </span>
      </header>
      <div className="rf-cuerpo">
        <section className="rf-panel rf-resumen" aria-label="Revise antes de firmar">
          <div className="rf-cab">
            <div className="rf-cab-textos">
              <h1 className="rf-t">Revise antes de firmar</h1>
              <div className="rf-s">No puede editar. Si algo no es correcto, avise a {solicitante}.</div>
            </div>
            <Link to={verCompleto} className="btn rf-ver">
              <Icono nombre="file-text" tam={16} />
              Ver formulario completo
            </Link>
          </div>
          {noPendiente}
          {f.isPending && <Cargando />}
          {f.isError && <ErrorCaja error={f.error} />}
          {d && (
            <>
              <div className="rf-datos">
                <div className="rf-dato">
                  <span className="rf-dato-l">Fecha y lugar</span>
                  <span className="rf-dato-v">{fechaLugar}</span>
                </div>
                <div className="rf-dato">
                  <span className="rf-dato-l">Suplidor</span>
                  <span className="rf-dato-v">{suplidor}</span>
                </div>
                <div className="rf-dato">
                  <span className="rf-dato-l">Recibido (EGEHID)</span>
                  <span className="rf-dato-v">{numTabla(d.mediciones.galonesEgehid)} gal</span>
                </div>
                <div className="rf-dato">
                  <span className="rf-dato-l">Diferencia</span>
                  <span className={`rf-dato-v${dif != null && dif < 0 ? ' neg' : ''}`}>{numTabla(dif)} gal</span>
                </div>
              </div>
              <nav className="rf-secciones" aria-label="Secciones">
                {filasSecciones(d, cat).map((s) => (
                  <Link key={s.id} to={verCompleto} className="rf-seccion">
                    <Icono nombre="file-check" tam={16} />
                    <span className="rf-seccion-textos">
                      <span className="rf-seccion-t">{s.titulo}</span>
                      <span className="rf-seccion-s">{s.sub}</span>
                    </span>
                    <span className={`rf-seccion-e ${s.clase}`}>{s.estado}</span>
                    <Icono nombre="chevron-right" tam={14} />
                  </Link>
                ))}
              </nav>
              {firmas.length > 0 && (
                <div className="rf-registradas">
                  <div className="rf-sub-t">Firmas ya registradas</div>
                  <div className="rf-fila-firmas">
                    {firmas.map((x) => (
                      <div key={x.rol} className="rf-firmada">
                        <div className="rf-firmada-img">
                          <TrazoFirma texto={trazoCorto(x.nombreFirmante)} />
                        </div>
                        <div className="rf-firmada-n">{x.nombreFirmante.replace(/\s*\(.*?\)\s*/g, '')}</div>
                        <div className="rf-firmada-r">{nombreRol(x.rol)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          <div className="rf-nota">
            <Icono nombre="shield-check" tam={16} />
            <span>Su firma quedará registrada con su usuario, fecha y hora. Después de firmar, su acceso a este formulario se cierra.</span>
          </div>
        </section>
        <section className="rf-panel rf-firma" aria-label="Su firma">
          <div className="rf-firma-cab">
            <div className="rf-rol">FIRMA COMO</div>
            <h2 className="rf-firma-t">{rol}</h2>
          </div>
          <div className="rf-opciones" role="radiogroup" aria-label="Firma a usar">
            {me.tieneFirma && (
              <div className={`rf-opcion${modo === 'predeterminada' ? ' sel' : ''}`}>
                <label className="rf-opcion-cab">
                  <input
                    type="radio"
                    className="rf-radio"
                    name="rf-modo"
                    checked={modo === 'predeterminada'}
                    onChange={() => setModo('predeterminada')}
                  />
                  <span>Usar mi firma predeterminada</span>
                  <span className="rf-guardada">Guardada</span>
                </label>
                {modo === 'predeterminada' && <MiFirma me={me} />}
              </div>
            )}
            <div className={`rf-opcion${modo === 'nueva' ? ' sel' : ''}`}>
              <label className="rf-opcion-cab">
                <input type="radio" className="rf-radio" name="rf-modo" checked={modo === 'nueva'} onChange={() => setModo('nueva')} />
                <span>Dibujar una firma nueva solo para este formulario</span>
                <Icono nombre="pen-line" tam={15} />
              </label>
              {modo === 'nueva' && <FirmaNueva alCambiar={setImagen} />}
            </div>
          </div>
          {declaracion}
          {rechazo === null && errorCaja}
          <div className="rf-esp" />
          {botonFirmar}
          <div className="rf-pie">
            {botonRechazar}
            <button type="button" className="rf-salir" onClick={() => navegar('/')}>
              Salir sin firmar
            </button>
          </div>
        </section>
      </div>
      {modalRechazo}
    </div>
  );
}

/** Pantalla completa «Revisar y firmar» del firmante (/firmas/solicitudes/:solicitudId). */
export function RevisarFirmar() {
  const { solicitudId = '' } = useParams();
  const { data: me } = useMe();
  const q = useSolicitudesMias();
  const sol = q.data?.find((s) => s.id === solicitudId);
  if (q.isPending || !me) return <Cargando />;
  if (q.isError) return <ErrorCaja error={q.error} />;
  if (!sol)
    return (
      <div className="vacio">
        La solicitud no existe o ya no es suya. <Link to="/firmas/solicitudes">Ver mis solicitudes</Link>
      </div>
    );
  return <Contenido key={sol.id} sol={sol} me={me} />;
}
