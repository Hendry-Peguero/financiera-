import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useCatalogos, useMe } from '../api/hooks';
import type { FiscalizacionDto } from '../api/types';
import { nuevaFiscalizacion, nuevoId, numeroVisible, preguntasDe, ROLES_FIRMA } from '../domain/fiscalizacion';
import { haceTiempo } from '../domain/format';
import { esSeccion, estadoSeccion, pendientesPorSeccion, SECCIONES, type EstadoSeccion, type Seccion } from '../domain/validacion';
import { useTic } from '../offline/hooks';
import { conservarMisCambios, crearBorradorLocal, eliminarBorrador, sincronizador, usarVersionServidor } from '../offline/sync';
import { BadgeEstado, Cargando } from '../ui/comunes';
import { Icono, type NombreIcono } from '../ui/Icono';
import { usePagina } from '../ui/pagina';
import { useTamano } from '../ui/tamano';
import { useFotosLocales } from './fotos';
import { SeccionControles } from './SeccionControles';
import { SeccionEmpresa, SeccionSuplidor, SeccionVisita } from './SeccionesDatos';
import { SeccionFirmas } from './SeccionFirmas';
import { SeccionFotos } from './SeccionFotos';
import { SeccionMediciones } from './SeccionMediciones';
import { PanelRevisar, ResumenRegistro } from './SeccionRevisar';
import { useFinalizar } from './useFinalizar';
import { useVistaPreviaPdf } from './useVistaPreviaPdf';
import { useBorrador } from './useBorrador';
import './formulario.css';
import { mensajeError } from '../ui/errores';

/** /fiscalizaciones/nueva → crea el Guid en la tablet, guarda el borrador local y redirige. */
export function NuevaFiscalizacion() {
  const navegar = useNavigate();
  const hecho = useRef(false);
  useEffect(() => {
    if (hecho.current) return;
    hecho.current = true;
    const id = nuevoId();
    void crearBorradorLocal(nuevaFiscalizacion(id)).then(() => navegar(`/fiscalizaciones/${id}/visita`, { replace: true }));
  }, [navegar]);
  return <Cargando texto="Creando borrador en la tablet…" />;
}

const TEXTO_ESTADO: Record<EstadoSeccion, string> = { completa: 'Completa', pendiente: 'Con pendientes', 'sin-iniciar': 'Sin iniciar' };

/** «Visita» → «1 pendiente»; «Firmas» → «3 de 5 firmas». */
function textoPendiente(s: Seccion, n: number, datos: FiscalizacionDto) {
  if (s === 'firmas') {
    const req = ROLES_FIRMA.filter((r) => r.requerida);
    const hechas = req.filter((r) => datos.firmas?.some((f) => f.rol === r.rol)).length;
    return `${hechas} de ${req.length} firmas`;
  }
  return `${n} pendiente${n === 1 ? '' : 's'}`;
}

/** Aviso del lateral: los pendientes de la sección actual (con la ayuda de AM/PM si falta una hora). */
function textoAviso(p: string[]) {
  if (p.length === 1 && /hora/i.test(p[0])) return `${p[0]} Al elegir la hora debe seleccionar AM o PM antes de guardar.`;
  return null;
}

interface Toast {
  seccion: Seccion;
  n: number;
}

export function Formulario() {
  const { id = '', seccion } = useParams();
  const navegar = useNavigate();
  const { data: me } = useMe();
  const { data: catalogos } = useCatalogos();
  const { datos, info, estado, error, actualizar, guardarYa, recargar } = useBorrador(id);
  const { fotos: fotosLocales } = useFotosLocales(id);
  const ahora = useTic(1000);
  const tamano = useTamano();
  // una sola navegación en Tablet V y móvil: la barra inferior también se ve dentro del formulario
  usePagina({ headerMovil: 'propio', navActiva: '/fiscalizaciones/nueva' });
  const [toast, setToast] = useState<Toast | null>(null);
  const [hoja, setHoja] = useState(false);
  const previa = useRef<string | undefined>(seccion);
  const modo = info?.modo ?? 'borrador';
  const preguntas = preguntasDe(catalogos);
  const pend = datos ? pendientesPorSeccion(datos, preguntas) : null;
  const fin = useFinalizar({ datos, modo, guardarYa, recargar });

  /** Eliminar el borrador (servidor + tablet). Antes se vacía el autoguardado para que nada lo vuelva a crear. */
  const eliminar = async () => {
    if (!window.confirm('¿Eliminar este borrador? Se borra también de esta tablet.')) return;
    try {
      await guardarYa();
      await eliminarBorrador(id);
      navegar('/historial', { replace: true });
    } catch (e) {
      window.alert(mensajeError(e));
    }
  };
  const vistaPdf = useVistaPreviaPdf({ datos, guardarYa });

  // Al salir de una sección con pendientes: «“Visita” guardada con 1 pendiente».
  const conteos = useRef<Partial<Record<Seccion, number>>>({});
  useEffect(() => {
    const antes = previa.current;
    previa.current = seccion;
    const n = antes && esSeccion(antes) ? (conteos.current[antes] ?? 0) : 0;
    if (!antes || antes === seccion || !esSeccion(antes) || antes === 'revisar' || n === 0) return;
    setToast({ seccion: antes, n });
    const t = window.setTimeout(() => setToast(null), 8000);
    return () => window.clearTimeout(t);
  }, [seccion]);
  useEffect(() => {
    if (pend) conteos.current = Object.fromEntries(Object.entries(pend).map(([k, v]) => [k, v.length]));
  });

  if (!esSeccion(seccion)) return <Navigate to={`/fiscalizaciones/${id}/visita`} replace />;
  if (estado === 'solo-lectura') return <Navigate to={`/fiscalizaciones/${id}`} replace />;
  if (estado === 'no-encontrado')
    return (
      <div className="vacio">
        Registro no encontrado. <Link to="/historial">Volver al historial</Link>
      </div>
    );
  if (estado === 'error')
    return (
      <div className="aviso aviso-error" role="alert">
        {error}
      </div>
    );
  if (!datos || !catalogos || !me || !pend) return <Cargando />;

  const movil = tamano === 'movil';
  const vertical = tamano === 'tablet-v';
  const subidas = new Set(fotosLocales.map((f) => f.servidorId).filter(Boolean));
  const totalFotos = fotosLocales.length + (datos.fotos ?? []).filter((f) => !subidas.has(f.id)).length;
  const estados = Object.fromEntries(
    SECCIONES.map((s) => [s.id, estadoSeccion(datos, s.id, pend, { fotosLocales: fotosLocales.length, preguntas })]),
  ) as Record<Seccion, EstadoSeccion>;
  const completas = SECCIONES.filter((s) => estados[s.id] === 'completa').length;
  const idx = SECCIONES.findIndex((s) => s.id === seccion);
  const anterior = SECCIONES[idx - 1];
  const siguiente = SECCIONES[idx + 1];
  const ir = (s: Seccion) => navegar(`/fiscalizaciones/${id}/${s}`);
  const props = { datos, actualizar, catalogos };
  const numero = numeroVisible(datos);
  const hace = info ? haceTiempo(info.actualizadoLocal, ahora) : null;

  const guardar = async () => {
    await guardarYa();
    void sincronizador.sincronizar();
  };

  const textoPaso = (s: Seccion, actual: boolean) => {
    if (actual) return 'Editando ahora';
    if (estados[s] === 'pendiente') return textoPendiente(s, pend[s].length, datos);
    return TEXTO_ESTADO[estados[s]];
  };

  const firmasPanel = <SeccionFirmas datos={datos} me={me} soloLectura={modo === 'correccion'} />;
  const fotosCard = <SeccionFotos datos={datos} />;
  const resumenRegistro = <ResumenRegistro datos={datos} actualizar={actualizar} catalogos={catalogos} />;
  const panelRevisar = (
    <PanelRevisar
      datos={datos}
      pendientes={pend}
      preguntas={preguntas}
      fotos={totalFotos}
      modo={modo}
      fin={fin}
      boton={!vertical}
      vistaPrevia={modo === 'borrador' ? () => void vistaPdf.abrir() : undefined}
    />
  );

  /** Columna principal y lateral de cada sección (como en el diseño). */
  let principal: ReactNode;
  let lateral: 'resumen' | 'revisar' = 'resumen';
  switch (seccion) {
    case 'visita':
      principal = (
        <>
          <SeccionVisita {...props} />
          <SeccionSuplidor {...props} />
          <SeccionEmpresa datos={datos} actualizar={actualizar} />
        </>
      );
      break;
    case 'mediciones':
      principal = <SeccionMediciones {...props} />;
      break;
    case 'controles':
      principal = <SeccionControles datos={datos} actualizar={actualizar} preguntas={preguntas} />;
      break;
    case 'firmas':
      principal = firmasPanel;
      break;
    case 'fotos':
      principal = (
        <>
          {fotosCard}
          {resumenRegistro}
        </>
      );
      lateral = 'revisar';
      break;
    case 'revisar':
      principal = (
        <>
          {resumenRegistro}
          {fotosCard}
        </>
      );
      lateral = 'revisar';
      break;
  }

  const avisoActual = seccion !== 'revisar' && pend[seccion].length > 0 && (
    <div className="fm-nota fm-nota-warn" role="status" aria-label="Pendientes de la sección">
      <Icono nombre="clock-alert" tam={16} />
      {textoAviso(pend[seccion]) ?? (
        <ul className="fm-nota-lista">
          {pend[seccion].map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
    </div>
  );

  const resumen = (
    <aside className="fm-lateral" aria-label="Resumen del formulario">
      <div className="fm-progreso tarjeta">
        <h2 className="fm-progreso-t">Secciones del formulario</h2>
        <div className="fm-barra">
          <div style={{ width: `${(completas / SECCIONES.length) * 100}%` }} />
        </div>
        <div className="fm-progreso-s">
          {completas} de {SECCIONES.length} secciones completas · {Math.floor((completas / SECCIONES.length) * 100)} %
        </div>
        <div className="fm-progreso-ayuda">Toque una sección para ir directo.</div>
        <ul className="fm-res-lista">
          {SECCIONES.filter((s) => s.id !== 'revisar').map((s) => {
            const actual = s.id === seccion;
            const e = estados[s.id];
            const icono: NombreIcono = actual ? 'pencil' : e === 'completa' ? 'circle-check' : e === 'pendiente' ? 'circle-alert' : 'circle-dashed';
            const titulo =
              s.id === 'fotos' ? `Fotografías (${totalFotos} de 20)` : s.id === 'firmas' ? `Firmas (${datos.firmas?.length ?? 0} de ${ROLES_FIRMA.length})` : s.resumen;
            return (
              <li key={s.id}>
                <Link to={`/fiscalizaciones/${id}/${s.id}`} className={`fm-res-item e-${e}${actual ? ' actual' : ''}`}>
                  <Icono nombre={icono} tam={16} />
                  <span className="fm-res-t">{titulo}</span>
                  <span className="fm-res-e">{actual ? 'Editando' : e === 'pendiente' ? textoPendiente(s.id, pend[s.id].length, datos) : TEXTO_ESTADO[e]}</span>
                  <Icono nombre="chevron-right" tam={14} className="fm-res-flecha" />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      {avisoActual}
      {seccion === 'mediciones' && (
        <div className="fm-nota fm-nota-info">
          <Icono nombre="calculator" tam={16} />
          <span>Los totales, contadores e importes se calculan solos. La vara no altera los totales.</span>
        </div>
      )}
      <div className="fm-esp" />
      <div className="fm-nota fm-nota-info fm-nota-nav">
        <Icono nombre="save" tam={16} />
        <span>Puede avanzar o retroceder aunque falten datos. Lo que ya escribió queda guardado y lo encontrará al volver.</span>
      </div>
      {!vertical && <BotonesNav anterior={anterior?.id} siguiente={siguiente?.id} ir={ir} />}
    </aside>
  );

  const avisos = (
    <>
      {info?.conflicto && (
        <div className="aviso aviso-error" role="alert" data-testid="conflicto">
          <Icono nombre="triangle-alert" tam={16} />
          <div className="fm-conflicto">
            <span>
              <strong>Conflicto al sincronizar:</strong> {info.conflicto} Sus cambios siguen guardados en esta tablet.
            </span>
            <div className="fm-conflicto-acc">
              {info.conflictoActual && (
                <button type="button" className="btn" onClick={() => void usarVersionServidor(id).then(recargar)}>
                  Usar versión del servidor
                </button>
              )}
              {info.conflictoActual?.estado === 'Borrador' && (
                <button type="button" className="btn" onClick={() => void conservarMisCambios(id)}>
                  Conservar mis cambios
                </button>
              )}
              {info.conflictoActual && info.conflictoActual.estado !== 'Borrador' && (
                <Link className="btn" to={`/fiscalizaciones/${id}`}>
                  Ver registro ({info.conflictoActual.estado})
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
      {vistaPdf.error && (
        <div className="aviso aviso-warn" role="alert" data-testid="error-pdf">
          <Icono nombre="triangle-alert" tam={16} />
          <span>{vistaPdf.error}</span>
        </div>
      )}
      {info?.ultimoError && !info.conflicto && (
        <div className="aviso aviso-warn" role="status">
          No se pudo enviar: {info.ultimoError}
        </div>
      )}
    </>
  );

  const estadoGuardado =
    modo === 'correccion'
      ? 'se envía al guardar la corrección'
      : info?.conflicto
        ? 'conflicto con el servidor'
        : info?.pendiente
          ? 'pendiente de enviar'
          : 'nada se pierde al cambiar de sección';

  const aviso = toast && (
    <div className="fm-toast" role="status">
      <Icono nombre="cloud-check" tam={18} />
      <div className="fm-toast-textos">
        <span className="fm-toast-t">
          «{SECCIONES.find((s) => s.id === toast.seccion)?.titulo}» guardada con {toast.n} pendiente{toast.n === 1 ? '' : 's'}
        </span>
        <span className="fm-toast-s">Sus datos siguen ahí. Vuelva cuando quiera para completarla.</span>
      </div>
      <button type="button" className="fm-toast-ir" onClick={() => ir(toast.seccion)}>
        Ir a {SECCIONES.find((s) => s.id === toast.seccion)?.titulo}
      </button>
    </div>
  );

  if (movil) {
    const segmento = (s: Seccion) => (s === seccion ? 'actual' : estados[s]);
    return (
      <>
        <header className="fm-hm">
          <div className="fm-hm-fila">
            <Link to="/" className="fm-hm-btn" aria-label="Volver al inicio">
              <Icono nombre="arrow-left" tam={22} />
            </Link>
            <div className="fm-hm-textos">
              <h1 className="fm-hm-t">Fiscalización #{numero.split('-')[0]}</h1>
              <span className="fm-hm-s" data-testid="autoguardado">
                ✓ Guardado en la tablet{hace ? ` · ${hace}` : ''}
                {info?.pendiente ? ' · pendiente de enviar' : ''}
              </span>
            </div>
            <Link to={`/fiscalizaciones/${id}/revisar`} className="fm-hm-btn" aria-label="Revisar y finalizar">
              <Icono nombre="file-text" tam={20} />
            </Link>
          </div>
          <button type="button" className="fm-paso-movil" onClick={() => setHoja(true)} aria-haspopup="dialog">
            <Icono nombre="list-checks" tam={16} />
            <span className="fm-paso-movil-textos">
              <span className="fm-paso-movil-t">
                Paso {idx + 1} de {SECCIONES.length} · {SECCIONES[idx].titulo}
              </span>
              <span className="fm-paso-movil-s">Toque para ir a cualquier sección</span>
            </span>
            <Icono nombre="chevron-down" tam={18} />
          </button>
          <div className="fm-segmentos" aria-hidden="true">
            {SECCIONES.map((s) => (
              <span key={s.id} className={`fm-seg s-${segmento(s.id)}`} />
            ))}
          </div>
        </header>
        <div className="fm fm-movil">
          {avisos}
          {principal}
          {lateral === 'revisar' && panelRevisar}
          {aviso}
        </div>
        <div className="fm-barra-movil">
          <div className="fm-barra-nota">
            <Icono nombre="shield-check" tam={13} />
            Puede avanzar aunque falten datos · nada se borra
          </div>
          <div className="fm-barra-botones">
            <button type="button" className="btn fm-btn-ant" disabled={!anterior} onClick={() => anterior && ir(anterior.id)}>
              <Icono nombre="arrow-left" tam={16} /> Anterior
            </button>
            {siguiente ? (
              <button type="button" className="btn btn-primario fm-btn-sig" onClick={() => ir(siguiente.id)}>
                <Icono nombre="arrow-right" tam={16} /> Siguiente: {siguiente.titulo}
              </button>
            ) : (
              <BotonFinalizar fin={fin} pendientes={pend} modo={modo} />
            )}
          </div>
        </div>
        {hoja && (
          <HojaSecciones
            actual={seccion}
            estados={estados}
            pend={pend}
            fotos={totalFotos}
            firmas={datos.firmas?.length ?? 0}
            hace={hace}
            alElegir={(s) => {
              setHoja(false);
              ir(s);
            }}
            alEliminar={modo === 'borrador' ? () => void eliminar() : undefined}
            alCerrar={() => setHoja(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className={`fm${vertical ? ' fm-vertical' : ''}`}>
        <div className="fm-enc">
          <div className="fm-titulos">
            <div className="fm-titulo-linea">
              <h1 className="fm-titulo">Fiscalización #{numero}</h1>
              <BadgeEstado estado={modo === 'correccion' ? 'EdicionPendiente' : datos.estado} />
              {modo === 'correccion' && <span className="badge b-neutral">Corrección de v{datos.versionActual}</span>}
            </div>
            <div className={`fm-guardado${info?.conflicto ? ' error' : ''}`} aria-live="polite" data-testid="autoguardado">
              <Icono nombre="cloud-check" tam={14} />
              Autoguardado en la tablet{hace ? ` · ${hace}` : ''} · {estadoGuardado}
            </div>
          </div>
          <div className="fm-acciones">
            {modo === 'borrador' ? (
              <button type="button" className="btn" disabled={vistaPdf.abriendo} onClick={() => void vistaPdf.abrir()}>
                <Icono nombre="file-text" tam={16} /> {vistaPdf.abriendo ? 'Generando vista previa…' : 'Vista previa PDF'}
              </button>
            ) : (
              // en una corrección los cambios todavía no están en el servidor: se revisan en «Revisar»
              <Link className="btn" to={`/fiscalizaciones/${id}/revisar`}>
                <Icono nombre="file-text" tam={16} /> Vista previa PDF
              </Link>
            )}
            <button type="button" className="btn" onClick={() => void guardar()}>
              <Icono nombre="save" tam={16} /> Guardar borrador
            </button>
            {modo === 'borrador' && (
              <button type="button" className="btn btn-peligro" onClick={() => void eliminar()}>
                <Icono nombre="trash-2" tam={16} /> Eliminar borrador
              </button>
            )}
          </div>
        </div>

        {avisos}

        <nav className="fm-pasos tarjeta" aria-label="Secciones">
          <div className="fm-pasos-guia">
            <span className="fm-pasos-msg">
              <Icono nombre="mouse-pointer-click" tam={14} />
              Toque cualquier sección para ir directo — no necesita completarlas en orden.
            </span>
            <span className="fm-leyenda">
              <span className="l-completa">Completa</span>
              <span className="l-pendiente">Con pendientes</span>
              <span className="l-sin">Sin iniciar</span>
            </span>
          </div>
          <ol className="pasos-lista">
            {SECCIONES.map((s, i) => {
              const e = estados[s.id];
              const actual = s.id === seccion;
              return (
                <li key={s.id}>
                  <Link
                    to={`/fiscalizaciones/${id}/${s.id}`}
                    className={`paso e-${e}${actual ? ' actual' : ''}`}
                    aria-current={actual ? 'step' : undefined}
                    data-track={`Paso ${s.titulo}`}
                  >
                    <span className="paso-num">
                      {actual ? i + 1 : e === 'completa' ? <Icono nombre="check" tam={12} /> : e === 'pendiente' ? '!' : i + 1}
                    </span>
                    <span className="paso-txt">
                      <span className="paso-titulo">{s.titulo}</span>
                      <span className="paso-estado">{textoPaso(s.id, actual)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className={`fm-cuerpo l-${lateral}`}>
          <div className="fm-col">{principal}</div>
          {lateral === 'resumen' && resumen}
          {lateral === 'revisar' && panelRevisar}
        </div>
        {aviso}
      </div>
      {vertical && (
        <div className="fm-barra-v">
          {lateral === 'revisar' ? (
            <BotonFinalizar fin={fin} pendientes={pend} modo={modo} />
          ) : (
            <BotonesNav anterior={anterior?.id} siguiente={siguiente?.id} ir={ir} />
          )}
        </div>
      )}
    </>
  );
}

function BotonesNav({
  anterior,
  siguiente,
  ir,
  etiquetaSiguiente,
}: {
  anterior?: Seccion;
  siguiente?: Seccion;
  ir: (s: Seccion) => void;
  etiquetaSiguiente?: string;
}) {
  return (
    <div className="fm-nav">
      <button type="button" className="btn" disabled={!anterior} onClick={() => anterior && ir(anterior)}>
        <Icono nombre="arrow-left" tam={16} /> Anterior
      </button>
      <button type="button" className="btn btn-primario" disabled={!siguiente} onClick={() => siguiente && ir(siguiente)}>
        <Icono nombre="arrow-right" tam={16} /> {etiquetaSiguiente ?? 'Siguiente'}
      </button>
    </div>
  );
}

function BotonFinalizar({
  fin,
  pendientes,
  modo,
}: {
  fin: ReturnType<typeof useFinalizar>;
  pendientes: Record<Seccion, string[]>;
  modo: 'borrador' | 'correccion';
}) {
  const hay = Object.values(pendientes).some((p) => p.length > 0);
  return (
    <button
      type="button"
      className="btn fm-finalizar"
      disabled={hay || fin.enviando || fin.enEspera || (modo === 'correccion' && !fin.enLinea)}
      onClick={() => void (modo === 'correccion' ? fin.corregir() : fin.finalizar())}
    >
      <Icono nombre="lock" tam={16} /> {modo === 'correccion' ? 'Guardar corrección' : fin.enEspera ? 'En espera de conexión' : 'Finalizar y generar PDF'}
    </button>
  );
}

/** Móvil: hoja inferior «Ir a sección». */
function HojaSecciones({
  actual,
  estados,
  pend,
  fotos,
  firmas,
  hace,
  alElegir,
  alCerrar,
  alEliminar,
}: {
  actual: Seccion;
  estados: Record<Seccion, EstadoSeccion>;
  pend: Record<Seccion, string[]>;
  fotos: number;
  firmas: number;
  hace: string | null;
  alElegir: (s: Seccion) => void;
  alCerrar: () => void;
  /** solo en un borrador (no en una corrección) */
  alEliminar?: () => void;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && alCerrar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [alCerrar]);
  const sub = (s: Seccion) => {
    if (s === actual) return 'Editando ahora';
    const e = estados[s];
    if (e === 'pendiente') return pend[s][0]?.replace(/^Falta la /, 'Falta ').replace(/ del proceso\.?$|\.$/, '') ?? 'Con pendientes';
    if (e === 'completa') return 'Completa';
    if (s === 'fotos') return `${fotos} de 20 fotos`;
    if (s === 'firmas') return `${firmas} de ${ROLES_FIRMA.length} firmas`;
    if (s === 'revisar') return 'Muestra lo que falta antes de cerrar';
    return 'Sin iniciar';
  };
  return (
    <div className="fm-velo" onClick={alCerrar}>
      <div className="fm-hoja" role="dialog" aria-modal="true" aria-labelledby="fm-hoja-t" onClick={(e) => e.stopPropagation()}>
        <div className="fm-hoja-asa" />
        <div className="fm-hoja-cab">
          <div className="fm-hoja-textos">
            <h2 id="fm-hoja-t" className="fm-hoja-t">
              Ir a sección
            </h2>
            <p className="fm-hoja-s">Vaya a cualquier sección, en el orden que quiera. Todo lo escrito se guarda solo.</p>
          </div>
          <button type="button" className="fm-hoja-cerrar" aria-label="Cerrar" onClick={alCerrar}>
            <Icono nombre="x" tam={20} />
          </button>
        </div>
        <ul className="fm-hoja-lista">
          {SECCIONES.map((s, i) => {
            const es = s.id === actual;
            const e = estados[s.id];
            return (
              <li key={s.id}>
                <button type="button" className={`fm-hoja-item e-${e}${es ? ' actual' : ''}`} onClick={() => alElegir(s.id)}>
                  <span className="fm-hoja-num">{es ? i + 1 : e === 'completa' ? <Icono nombre="check" tam={14} /> : e === 'pendiente' ? '!' : i + 1}</span>
                  <span className="fm-hoja-item-textos">
                    <span className="fm-hoja-item-t">{s.id === 'revisar' ? 'Revisar y finalizar' : s.titulo}</span>
                    <span className="fm-hoja-item-s">{sub(s.id)}</span>
                  </span>
                  <Icono nombre={es ? 'pencil' : 'chevron-right'} tam={16} />
                </button>
              </li>
            );
          })}
        </ul>
        <div className="fm-hoja-pie">
          <Icono nombre="cloud-check" tam={16} />
          Guardado en la tablet {hace ?? ''}. Cambiar de sección no borra nada.
        </div>
        {alEliminar && (
          <button type="button" className="btn btn-peligro btn-ancho" onClick={alEliminar}>
            <Icono nombre="trash-2" tam={16} /> Eliminar este borrador
          </button>
        )}
      </div>
    </div>
  );
}
