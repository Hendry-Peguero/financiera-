import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type UIEvent } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { ApiError } from '../api/client';
import {
  useAccionesPlantilla,
  usePdfPlantilla,
  usePlantilla,
  usePlantillas,
  type PaginaDto,
  type PlantillaDto,
  type PlantillaResumenDto,
  type TipoCampo,
} from '../api/plantillas';
import { mensajeError } from '../ui/errores';
import { Icono, type NombreIcono } from '../ui/Icono';
import { usePagina } from '../ui/pagina';
import { useTamano } from '../ui/tamano';
import { CanvasPagina } from './LienzoPdf';
import { useDocumentoPdf } from './pdfjs';
import {
  aDto,
  aPagina,
  arrastrar,
  desdeDto,
  escala,
  firmaCampos,
  insignia,
  limitar,
  limpiarIdentificador,
  MAX_PDF,
  nuevoCampo,
  subtitulo,
  validarCampos,
  type CampoEditor,
} from './plantillasLogica';
import './plantillas.css';

const TIPOS: [TipoCampo, string, NombreIcono][] = [
  ['Texto', 'Texto', 'type'],
  ['Numero', 'Número', 'hash'],
  ['Fecha', 'Fecha', 'calendar'],
  ['Casilla', 'Casilla', 'square-check'],
  ['Firma', 'Firma', 'signature'],
  ['Formula', 'Diferencia', 'diff'],
];
/** Mientras carga el detalle se muestra una página vacía del tamaño del diseño. */
const PAGINA_VACIA: PaginaDto = { ancho: 440, alto: 600 };

const fechaCorta = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-DO') : '');

function Insignia({ p }: { p: Pick<PlantillaResumenDto, 'estado' | 'versionBorrador'> }) {
  const [clase, texto] = insignia(p);
  return (
    <span className={`badge ${clase}`}>
      <span className="badge-punto" />
      {texto}
    </span>
  );
}

function Interruptor({ etiqueta, valor, cambiar, deshabilitado }: { etiqueta: string; valor: boolean; cambiar: (v: boolean) => void; deshabilitado?: boolean }) {
  return (
    <label className="pl-switch-fila">
      <span>{etiqueta}</span>
      <input
        type="checkbox"
        role="switch"
        className="pl-switch"
        checked={valor}
        disabled={deshabilitado}
        onChange={(e) => cambiar(e.target.checked)}
      />
    </label>
  );
}

function Errores({ lista }: { lista?: string[] }) {
  if (!lista?.length) return null;
  return (
    <ul className="pl-errores" role="alert">
      {lista.map((m) => (
        <li key={m}>{m}</li>
      ))}
    </ul>
  );
}

function Propiedades({
  campo,
  errores,
  editable,
  cambiar,
  eliminar,
}: {
  campo: CampoEditor;
  errores?: string[];
  editable: boolean;
  cambiar: (c: Partial<CampoEditor>) => void;
  eliminar: () => void;
}) {
  const numero = (k: 'x' | 'y' | 'ancho' | 'alto', etiqueta: string) => (
    <label className="pl-campo">
      <span className="pl-etq">{etiqueta}</span>
      <input
        className="pl-caja mono"
        inputMode="numeric"
        value={campo[k]}
        readOnly={!editable}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/\D/g, ''));
          if (!Number.isNaN(n)) cambiar({ [k]: n });
        }}
      />
    </label>
  );
  return (
    <aside className="tarjeta pl-props" aria-label="Propiedades del campo">
      <h2 className="pl-props-t">Propiedades del campo</h2>
      <label className="pl-campo">
        <span className="pl-etq">Identificador</span>
        <input
          className="pl-caja mono"
          value={campo.identificador}
          readOnly={!editable}
          onChange={(e) => cambiar({ identificador: limpiarIdentificador(e.target.value) })}
        />
      </label>
      <label className="pl-campo">
        <span className="pl-etq">Etiqueta visible</span>
        <input className="pl-caja" value={campo.etiqueta} readOnly={!editable} onChange={(e) => cambiar({ etiqueta: e.target.value })} />
      </label>
      <label className="pl-campo">
        <span className="pl-etq">Tipo</span>
        <span className="pl-caja pl-select">
          <select
            value={campo.tipo}
            disabled={!editable}
            onChange={(e) => {
              const tipo = e.target.value as TipoCampo;
              cambiar({ tipo, formula: tipo === 'Formula' ? (campo.formula ?? '') : null });
            }}
          >
            {TIPOS.map(([t, txt]) => (
              <option key={t} value={t}>
                {txt}
              </option>
            ))}
          </select>
          <Icono nombre="chevron-down" tam={16} />
        </span>
      </label>
      {campo.tipo === 'Formula' && (
        <label className="pl-campo">
          <span className="pl-etq">Fórmula</span>
          <span className="pl-caja">
            <input
              className="mono"
              value={campo.formula ?? ''}
              readOnly={!editable}
              placeholder="cant_recibida - cant_facturada"
              onChange={(e) => cambiar({ formula: e.target.value })}
            />
            <Icono nombre="sigma" tam={16} />
          </span>
        </label>
      )}
      <div className="pl-posicion">
        {numero('x', 'X')}
        {numero('y', 'Y')}
        {numero('ancho', 'Ancho')}
        {numero('alto', 'Alto')}
      </div>
      <Interruptor etiqueta="Campo obligatorio" valor={campo.obligatorio} deshabilitado={!editable} cambiar={(v) => cambiar({ obligatorio: v })} />
      <Interruptor etiqueta="Incluir en estadísticas" valor={campo.enEstadisticas} deshabilitado={!editable} cambiar={(v) => cambiar({ enEstadisticas: v })} />
      <Interruptor etiqueta="Imprimir en el PDF" valor={campo.imprimirPdf} deshabilitado={!editable} cambiar={(v) => cambiar({ imprimirPdf: v })} />
      <Errores lista={errores} />
      <span className="pl-esp" />
      {editable && (
        <button type="button" className="btn btn-peligro btn-ancho" onClick={eliminar}>
          <Icono nombre="trash-2" tam={16} />
          Eliminar campo
        </button>
      )}
    </aside>
  );
}

/** Código, versión y fechas que se imprimen en el encabezado del formulario (también en la oficial). Se monta con key = id. */
function EncabezadoDocumento({ detalle }: { detalle: PlantillaDto }) {
  const acciones = useAccionesPlantilla();
  const inicial = detalle.encabezado;
  const [e, setE] = useState(inicial);
  const [estado, setEstado] = useState<{ ocupado?: boolean; error?: string; listo?: boolean }>({});
  const cambiar = (c: Partial<typeof e>) => {
    setE((x) => ({ ...x, ...c }));
    setEstado({});
  };
  const sinCambios =
    (e.codigo ?? '') === (inicial.codigo ?? '') &&
    (e.version ?? '') === (inicial.version ?? '') &&
    (e.fechaElaboracion ?? '') === (inicial.fechaElaboracion ?? '') &&
    (e.fechaAprobacion ?? '') === (inicial.fechaAprobacion ?? '');
  const guardar = async () => {
    setEstado({ ocupado: true });
    try {
      await acciones.guardarEncabezado(detalle.id, {
        codigo: e.codigo?.trim() || null,
        version: e.version?.trim() || null,
        fechaElaboracion: e.fechaElaboracion || null,
        fechaAprobacion: e.fechaAprobacion || null,
      });
      setEstado({ listo: true });
    } catch (err) {
      setEstado({ error: mensajeError(err) });
    }
  };
  return (
    <section className="pl-encabezado" aria-label="Encabezado del documento">
      <h3 className="pl-etq">Encabezado del documento</h3>
      <div className="pl-encabezado-grid">
        <label className="pl-campo">
          <span className="pl-item-s">Código</span>
          <input className="pl-caja mono" value={e.codigo ?? ''} maxLength={40} placeholder="FO-XXX-YYYY-ZZZ" onChange={(x) => cambiar({ codigo: x.target.value })} />
        </label>
        <label className="pl-campo">
          <span className="pl-item-s">Versión</span>
          <input className="pl-caja mono" value={e.version ?? ''} maxLength={20} placeholder="001" onChange={(x) => cambiar({ version: x.target.value })} />
        </label>
        <label className="pl-campo">
          <span className="pl-item-s">Fecha de elaboración</span>
          <input className="pl-caja" type="date" value={e.fechaElaboracion ?? ''} onChange={(x) => cambiar({ fechaElaboracion: x.target.value })} />
        </label>
        <label className="pl-campo">
          <span className="pl-item-s">Fecha de aprobación</span>
          <input className="pl-caja" type="date" value={e.fechaAprobacion ?? ''} onChange={(x) => cambiar({ fechaAprobacion: x.target.value })} />
        </label>
      </div>
      {estado.error && <Errores lista={[estado.error]} />}
      <button type="button" className="btn btn-ancho" disabled={sinCambios || estado.ocupado} onClick={() => void guardar()}>
        <Icono nombre="check" tam={16} />
        {estado.listo && sinCambios ? 'Encabezado guardado' : 'Guardar encabezado'}
      </button>
    </section>
  );
}

/** Panel sin campo seleccionado: datos y acciones de la plantilla, y sus versiones. */
function PanelPlantilla({
  detalle,
  nombre,
  cambiarNombre,
  editable,
  versionVista,
  errores,
  ocupado,
  ver,
  accion,
}: {
  detalle: PlantillaDto | undefined;
  nombre: string;
  cambiarNombre: (n: string) => void;
  editable: boolean;
  versionVista: number | undefined;
  errores?: string[];
  ocupado: boolean;
  ver: (version: number | undefined) => void;
  accion: (a: 'reemplazar' | 'duplicar' | 'desactivar' | 'activar' | 'descartar') => void;
}) {
  if (!detalle)
    return (
      <aside className="tarjeta pl-props" aria-label="Propiedades de la plantilla">
        <h2 className="pl-props-t">Propiedades de la plantilla</h2>
        <p className="pl-vacio">Cargando…</p>
      </aside>
    );
  const a = detalle.actual;
  const oficial = detalle.tipo === 'Oficial';
  return (
    <aside className="tarjeta pl-props" aria-label="Propiedades de la plantilla">
      <h2 className="pl-props-t">Propiedades de la plantilla</h2>
      {versionVista !== undefined && (
        <div className="pl-nota">
          Versión {versionVista} (solo lectura).{' '}
          <button type="button" className="pl-enlace" onClick={() => ver(undefined)}>
            Volver a la vigente
          </button>
        </div>
      )}
      <label className="pl-campo">
        <span className="pl-etq">Nombre</span>
        <input className="pl-caja" value={nombre} readOnly={!editable} maxLength={150} onChange={(e) => cambiarNombre(e.target.value)} />
      </label>
      {!nombre.trim() && editable && <Errores lista={['Escriba el nombre de la plantilla.']} />}
      <p className="pl-vacio">
        {detalle.tipo} · {a.paginas.length} {a.paginas.length === 1 ? 'página' : 'páginas'} · {a.campos.length} campos ·{' '}
        {a.tienePdf ? 'PDF base' : 'sin PDF base (página carta)'}
      </p>
      {oficial && (
        <p className="pl-vacio">
          Es el formulario en papel de EGEHID: el PDF oficial de cada fiscalización se imprime sobre él. Sus campos no se editan;
          duplíquela para crear una plantilla personalizada a partir de ella.
        </p>
      )}
      {versionVista === undefined && <EncabezadoDocumento key={detalle.id} detalle={detalle} />}
      {!oficial && editable && (
        <p className="pl-vacio">Seleccione un campo en la página o elija una herramienta y toque la página para agregar uno. Los cambios se guardan solos en el borrador.</p>
      )}
      <Errores lista={errores} />
      <div className="pl-acciones">
        {editable && (
          <button type="button" className="btn btn-ancho" disabled={ocupado} onClick={() => accion('reemplazar')}>
            <Icono nombre="file-up" tam={16} />
            Reemplazar PDF
          </button>
        )}
        <button type="button" className="btn btn-ancho" disabled={ocupado} onClick={() => accion('duplicar')}>
          <Icono nombre="file-plus-2" tam={16} />
          Duplicar
        </button>
        {!oficial &&
          (detalle.estado === 'Desactivada' ? (
            <button type="button" className="btn btn-ancho" disabled={ocupado || detalle.version === 0} onClick={() => accion('activar')}>
              <Icono nombre="eye" tam={16} />
              Activar
            </button>
          ) : detalle.version > 0 ? (
            <button type="button" className="btn btn-ancho" disabled={ocupado} onClick={() => accion('desactivar')}>
              <Icono nombre="eye-off" tam={16} />
              Desactivar
            </button>
          ) : null)}
        {editable && detalle.versionBorrador && (
          <button type="button" className="btn btn-peligro btn-ancho" disabled={ocupado} onClick={() => accion('descartar')}>
            <Icono nombre="rotate-ccw" tam={16} />
            {detalle.version ? `Descartar borrador v${detalle.versionBorrador}` : 'Eliminar plantilla'}
          </button>
        )}
      </div>
      <h3 className="pl-etq">Versiones</h3>
      <div className="pl-versiones">
        {detalle.versiones.map((v) => {
          const actual = (versionVista ?? a.version) === v.version;
          return (
            <button
              key={v.version}
              type="button"
              className={`pl-version${actual ? ' activa' : ''}`}
              aria-current={actual}
              onClick={() => ver(v.version === (detalle.versionBorrador ?? detalle.version) ? undefined : v.version)}
            >
              <span className="pl-version-t">v{v.version}</span>
              <span className="pl-item-s">
                {v.publicada ? `Publicada ${fechaCorta(v.publicadaEn)}` : 'Borrador'} · {v.totalCampos} campos
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

/**
 * Página carta sin PDF base: título y la etiqueta de cada campo, dibujados en puntos (viewBox) para que escalen.
 * El tamaño de letra va como atributo (unidades del SVG), no en el CSS que pasa px a rem.
 */
function Plano({ titulo, numero, tam, campos }: { titulo: string; numero: number; tam: PaginaDto; campos: CampoEditor[] }) {
  return (
    <svg className="pl-plano" viewBox={`0 0 ${tam.ancho} ${tam.alto}`} aria-hidden="true">
      {numero === 1 && (
        <>
          <text x={40} y={44} fontSize={12} fontWeight={700} className="pl-plano-titulo">
            {titulo.toUpperCase()} · EGEHID
          </text>
          <rect x={40} y={52} width={tam.ancho - 80} height={1} className="pl-plano-linea" />
        </>
      )}
      {campos.map((c) => (
        <text key={c.clave} x={c.x} y={c.y - 3} fontSize={7} className="pl-plano-etq">
          {c.etiqueta}
        </text>
      ))}
    </svg>
  );
}

interface Arrastre {
  clave: string;
  modo: 'mover' | 'tamano';
  x0: number;
  y0: number;
  inicial: Pick<CampoEditor, 'x' | 'y' | 'ancho' | 'alto'>;
  /** puntos por píxel, medido al empezar */
  k: number;
  movido: boolean;
}

function PaginaEditor({
  numero,
  total,
  tam,
  titulo,
  doc,
  tienePdf,
  campos,
  seleccion,
  herramienta,
  editable,
  conError,
  seleccionar,
  agregar,
  mover,
}: {
  numero: number;
  total: number;
  tam: PaginaDto;
  titulo: string;
  doc: PDFDocumentProxy | null;
  tienePdf: boolean;
  campos: CampoEditor[];
  seleccion: string | null;
  herramienta: TipoCampo | null;
  editable: boolean;
  conError: Set<string>;
  seleccionar: (clave: string | null) => void;
  agregar: (pagina: number, x: number, y: number) => void;
  mover: (clave: string, caja: Arrastre['inicial']) => void;
}) {
  const arrastre = useRef<Arrastre | null>(null);
  const [dibujada, setDibujada] = useState(false);
  const alDibujar = useCallback(() => setDibujada(true), []);
  const pct = (v: number, base: number) => `${(v / base) * 100}%`;

  const alTocar = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (!herramienta || !editable) return seleccionar(null);
    const { x, y } = aPagina(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect(), tam);
    agregar(numero, x, y);
  };
  const iniciar = (e: PointerEvent<HTMLElement>, c: CampoEditor, modo: Arrastre['modo']) => {
    e.stopPropagation();
    seleccionar(c.clave);
    if (!editable || e.button !== 0) return;
    const pagina = e.currentTarget.closest('.pl-pagina');
    if (!pagina) return;
    arrastre.current = {
      clave: c.clave,
      modo,
      x0: e.clientX,
      y0: e.clientY,
      inicial: { x: c.x, y: c.y, ancho: c.ancho, alto: c.alto },
      k: escala(pagina.getBoundingClientRect(), tam),
      movido: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const alMover = (e: PointerEvent<HTMLDivElement>) => {
    const a = arrastre.current;
    if (!a) return;
    const dx = e.clientX - a.x0;
    const dy = e.clientY - a.y0;
    if (!a.movido && Math.hypot(dx, dy) < 3) return;
    a.movido = true;
    mover(a.clave, arrastrar(a.inicial, dx, dy, a.k, a.modo, tam));
  };
  const alTeclear = (e: KeyboardEvent<HTMLButtonElement>, c: CampoEditor) => {
    const paso = e.shiftKey ? 10 : 1;
    const d = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }[e.key];
    if (!d || !editable) return;
    e.preventDefault();
    mover(c.clave, limitar({ x: c.x + d[0], y: c.y + d[1], ancho: c.ancho, alto: c.alto }, tam));
  };

  return (
    <div
      className={`pl-pagina${herramienta && editable ? ' agregando' : ''}`}
      style={{ height: 'auto', aspectRatio: `${tam.ancho} / ${tam.alto}` }}
      data-pdf={!tienePdf ? 'plano' : dibujada ? 'listo' : 'cargando'}
      onClick={alTocar}
      onPointerMove={alMover}
      onPointerUp={() => (arrastre.current = null)}
      onPointerCancel={() => (arrastre.current = null)}
      aria-label={`Página ${numero} de ${total} de ${titulo}`}
    >
      {tienePdf ? doc && <CanvasPagina doc={doc} numero={numero} alDibujar={alDibujar} /> : <Plano titulo={titulo} numero={numero} tam={tam} campos={campos} />}
      {campos.map((c) => (
        <button
          type="button"
          key={c.clave}
          className={`pl-campo-pdf${c.clave === seleccion ? ' sel' : ''}${conError.has(c.clave) ? ' error' : ''}${c.imprimirPdf ? '' : ' sin-imprimir'}`}
          style={{ left: pct(c.x, tam.ancho), top: pct(c.y, tam.alto), width: pct(c.ancho, tam.ancho), height: pct(c.alto, tam.alto) }}
          onPointerDown={(e) => iniciar(e, c, 'mover')}
          onClick={(e) => {
            e.stopPropagation();
            seleccionar(c.clave);
          }}
          onKeyDown={(e) => alTeclear(e, c)}
          aria-pressed={c.clave === seleccion}
          title={c.etiqueta}
        >
          {c.tipo === 'Formula' && c.formula ? `${c.identificador} = ${c.formula}` : c.identificador}
          {c.clave === seleccion && editable && (
            <span className="pl-asa" aria-hidden="true" onPointerDown={(e) => iniciar(e, c, 'tamano')} />
          )}
        </button>
      ))}
    </div>
  );
}

interface PropsEditor {
  lista: PlantillaResumenDto[];
  cargandoLista: boolean;
  errorLista: unknown;
  id: number | undefined;
  detalle: PlantillaDto | undefined;
  versionVista: number | undefined;
  elegir: (s: { id: number; version?: number } | null) => void;
}

function nombreLibre(base: string, lista: PlantillaResumenDto[]) {
  const usados = new Set(lista.map((p) => p.nombre.toLowerCase()));
  if (!usados.has(base.toLowerCase())) return base;
  let n = 2;
  while (usados.has(`${base} (${n})`.toLowerCase())) n++;
  return `${base} (${n})`;
}

/** Editor de una plantilla (se vuelve a montar al cambiar de plantilla o de versión vista). */
function Editor({ lista, cargandoLista, errorLista, id, detalle, versionVista, elegir }: PropsEditor) {
  const tamano = useTamano();
  const acciones = useAccionesPlantilla();
  const editable = !!detalle?.editable && versionVista === undefined;
  const paginas = detalle?.actual.paginas ?? [PAGINA_VACIA];
  const [nombre, setNombre] = useState(detalle?.nombre ?? '');
  const [campos, setCampos] = useState<CampoEditor[]>(() => desdeDto(detalle?.actual.campos ?? []));
  const firma = firmaCampos(nombre.trim(), campos);
  const [guardada, setGuardada] = useState(firma);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [herramienta, setHerramienta] = useState<TipoCampo | null>('Texto');
  const [intentoPublicar, setIntentoPublicar] = useState(false);
  const [servidor, setServidor] = useState<{ firma: string; errores: Record<string, string[]> } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [paginaVisible, setPaginaVisible] = useState(1);
  const archivo = useRef<HTMLInputElement>(null);
  const archivoReemplazo = useRef<HTMLInputElement>(null);

  const pdf = usePdfPlantilla(id ?? 0, detalle?.actual.version ?? 0, !!detalle?.actual.tienePdf);
  const { doc, error: errorPdf } = useDocumentoPdf(pdf.data);

  const campo = campos.find((c) => c.clave === seleccion) ?? null;
  const errores = {
    ...validarCampos(campos, paginas, intentoPublicar),
    ...(servidor?.firma === firma ? servidor.errores : {}),
  };
  const conError = new Set(Object.keys(errores));

  const avisar = useCallback((t: string) => {
    setAviso(t);
    window.setTimeout(() => setAviso((a) => (a === t ? null : a)), 5000);
  }, []);

  // ---- Autoguardado del borrador (en cola: una petición a la vez) ----
  const ultimo = useRef({ id, editable, nombre, campos, paginas, acciones, avisar, guardada: firma });
  useEffect(() => {
    Object.assign(ultimo.current, { id, editable, nombre, campos, paginas, acciones, avisar });
  });
  const cola = useRef<Promise<boolean>>(Promise.resolve(true));
  /** Mientras se descarta el borrador no se envía nada (lo pendiente se pierde a propósito). */
  const pausa = useRef(false);
  /** Envía los cambios pendientes; false si no se pudo (sin red, datos inválidos). */
  const guardar = useCallback((): Promise<boolean> => {
    const tarea = cola.current.then(async () => {
      const u = ultimo.current;
      const f = firmaCampos(u.nombre.trim(), u.campos);
      if (u.id === undefined || !u.editable || pausa.current || f === u.guardada) return true;
      if (Object.keys(validarCampos(u.campos, u.paginas, false)).length) return false;
      try {
        await u.acciones.guardarBorrador(u.id, { nombre: u.nombre.trim() || null, campos: aDto(u.campos) });
        u.guardada = f;
        setGuardada(f);
        return true;
      } catch (e) {
        if (e instanceof ApiError) setServidor({ firma: f, errores: erroresPorClave(e, u.campos) });
        u.avisar(`No se pudo guardar el borrador: ${mensajeError(e)}`);
        return false;
      }
    });
    cola.current = tarea.catch(() => false);
    return tarea;
  }, []);
  useEffect(() => {
    if (!editable || firma === guardada) return;
    const t = window.setTimeout(() => void guardar(), 800);
    return () => window.clearTimeout(t);
  }, [editable, firma, guardada, guardar]);
  // al salir de la pantalla o cambiar de plantilla, lo pendiente se envía igual
  useEffect(() => () => void guardar(), [guardar]);

  const ejecutar = async (fn: () => Promise<void>) => {
    setOcupado(true);
    try {
      await fn();
    } catch (e) {
      if (e instanceof ApiError) setServidor({ firma, errores: erroresPorClave(e, campos) });
      avisar(mensajeError(e));
    } finally {
      setOcupado(false);
    }
  };
  const cambiarA = (s: { id: number; version?: number } | null) =>
    void guardar().then(() => {
      setSeleccion(null);
      elegir(s);
    });

  /** Vuelve a los datos del servidor (después de descartar el borrador). */
  const reiniciar = (p: PlantillaDto) => {
    const cs = desdeDto(p.actual.campos);
    const f = firmaCampos(p.nombre, cs);
    setNombre(p.nombre);
    setCampos(cs);
    ultimo.current.guardada = f;
    setGuardada(f);
    setSeleccion(null);
    setIntentoPublicar(false);
  };

  // ---- Edición ----
  const cambiarCampo = (clave: string, c: Partial<CampoEditor>) => setCampos((cs) => cs.map((x) => (x.clave === clave ? { ...x, ...c } : x)));
  const agregar = (pagina: number, x: number, y: number) => {
    if (!herramienta || !editable) return;
    const nuevo = nuevoCampo(herramienta, pagina, x, y, campos, paginas[pagina - 1]);
    setCampos((cs) => [...cs, nuevo]);
    setSeleccion(nuevo.clave);
  };
  const eliminar = () => {
    setCampos((cs) => cs.filter((c) => c.clave !== seleccion));
    setSeleccion(null);
  };

  // ---- Acciones ----
  const publicar = () =>
    void ejecutar(async () => {
      if (!detalle || !editable || id === undefined) return;
      const errs = validarCampos(campos, paginas, true);
      if (Object.keys(errs).length) {
        setIntentoPublicar(true);
        const primero = Object.keys(errs).find((k) => k);
        setSeleccion(primero ?? null);
        avisar(errs['']?.[0] ?? 'Revise los campos marcados antes de publicar.');
        return;
      }
      if (!(await guardar())) return;
      const p = await acciones.publicar(id);
      setIntentoPublicar(false);
      avisar(`Versión ${p.version} publicada. Las nuevas fiscalizaciones de «${p.nombre}» la usan desde ahora.`);
    });

  const importar = (f: File | undefined) => {
    if (!f) return;
    if (f.type && f.type !== 'application/pdf') return avisar('El archivo debe ser un PDF.');
    if (f.size > MAX_PDF) return avisar('El PDF supera el máximo de 4 MB.');
    void ejecutar(async () => {
      await guardar();
      const p = await acciones.importar(f);
      avisar(`PDF importado (${p.actual.paginas.length} ${p.actual.paginas.length === 1 ? 'página' : 'páginas'}). Coloque los campos y publique.`);
      elegir({ id: p.id });
    });
  };

  const reemplazar = (f: File | undefined) => {
    if (!f || id === undefined) return;
    if (f.type && f.type !== 'application/pdf') return avisar('El archivo debe ser un PDF.');
    if (f.size > MAX_PDF) return avisar('El PDF supera el máximo de 4 MB.');
    void ejecutar(async () => {
      if (!(await guardar())) return;
      await acciones.reemplazarPdf(id, f);
      avisar('PDF base reemplazado en el borrador.');
    });
  };

  const accionPlantilla = (a: 'reemplazar' | 'duplicar' | 'desactivar' | 'activar' | 'descartar') => {
    if (id === undefined || !detalle) return;
    if (a === 'reemplazar') return archivoReemplazo.current?.click();
    if (a === 'descartar') {
      const texto = detalle.version
        ? `¿Descartar los cambios del borrador v${detalle.versionBorrador}? La versión ${detalle.version} sigue vigente.`
        : `¿Eliminar la plantilla «${detalle.nombre}»? Nunca se publicó.`;
      if (!window.confirm(texto)) return;
      pausa.current = true;
      return void ejecutar(async () => {
        try {
          await cola.current;
          const p = await acciones.descartarBorrador(id);
          avisar(p ? 'Borrador descartado.' : 'Plantilla eliminada.');
          if (!p) return elegir(null); // ya no existe: la pausa sigue hasta desmontar
          reiniciar(p);
          pausa.current = false;
        } catch (e) {
          pausa.current = false;
          throw e;
        }
      });
    }
    void ejecutar(async () => {
      await guardar();
      if (a === 'duplicar') {
        const p = await acciones.duplicar(id);
        avisar(`Se creó «${p.nombre}» como borrador.`);
        elegir({ id: p.id });
      } else if (a === 'desactivar') {
        await acciones.desactivar(id);
        avisar('Plantilla desactivada: ya no se ofrece para nuevos registros.');
      } else {
        await acciones.activar(id);
        avisar('Plantilla activada.');
      }
    });
  };

  const nueva = () =>
    void ejecutar(async () => {
      await guardar();
      const p = await acciones.crear(nombreLibre('Nueva plantilla', lista));
      elegir({ id: p.id });
    });

  const alDesplazar = (e: UIEvent<HTMLDivElement>) => {
    const area = e.currentTarget;
    const tope = area.getBoundingClientRect().top + area.clientHeight / 3;
    const hojas = Array.from(area.querySelectorAll('.pl-pagina'));
    const visible = hojas.filter((h) => h.getBoundingClientRect().top <= tope).length;
    setPaginaVisible(Math.max(1, visible));
  };

  const titulo = nombre.trim() || detalle?.nombre || '';
  const columna = tamano === 'tablet-v' || tamano === 'movil';
  const lienzo = (
    <section className="pl-lienzo" aria-label="Lienzo">
      <div className="pl-herramientas" role="toolbar" aria-label="Agregar campo">
        {TIPOS.map(([t, txt, ic]) => (
          <button
            key={t}
            type="button"
            className={`pl-herr${herramienta === t && editable ? ' activa' : ''}`}
            aria-pressed={herramienta === t && editable}
            disabled={!editable}
            onClick={() => setHerramienta(herramienta === t ? null : t)}
          >
            <Icono nombre={ic} tam={14} />
            {txt}
          </button>
        ))}
        <span className="pl-esp" />
        <span className="pl-paginacion">
          Página {Math.min(paginaVisible, paginas.length)} / {paginas.length} · 100 %
        </span>
      </div>
      <div className="pl-area" onScroll={alDesplazar}>
        <div className="pl-paginas">
          {errorPdf || pdf.isError ? (
            <p className="pl-vacio pl-error-base">No se pudo abrir el PDF base de esta versión.</p>
          ) : (
            paginas.map((tam, i) => (
              <PaginaEditor
                key={i}
                numero={i + 1}
                total={paginas.length}
                tam={tam}
                titulo={titulo}
                doc={doc}
                tienePdf={!!detalle?.actual.tienePdf}
                campos={campos.filter((c) => c.pagina === i + 1)}
                seleccion={seleccion}
                herramienta={herramienta}
                editable={editable}
                conError={conError}
                seleccionar={setSeleccion}
                agregar={agregar}
                mover={cambiarCampo}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
  const props = campo ? (
    <Propiedades
      campo={campo}
      errores={errores[campo.clave]}
      editable={editable}
      cambiar={(c) => cambiarCampo(campo.clave, c)}
      eliminar={eliminar}
    />
  ) : (
    <PanelPlantilla
      detalle={detalle}
      nombre={nombre}
      cambiarNombre={setNombre}
      editable={editable}
      versionVista={versionVista}
      errores={errores['']}
      ocupado={ocupado}
      ver={(v) => id !== undefined && cambiarA({ id, version: v })}
      accion={accionPlantilla}
    />
  );
  const versionPublicar = detalle ? (detalle.versionBorrador ?? detalle.version + 1) : '';

  return (
    <div className="pl">
      <div className="pag-encabezado pl-encabezado">
        <div className="pag-titulos">
          <h1 className="pag-titulo">Plantillas de formularios</h1>
          <div className="pag-sub">Importa un PDF (máx. 4 MB, 10 páginas) y coloca los campos encima. Publicar crea una nueva versión.</div>
        </div>
        <div className="pag-acciones">
          <button type="button" className="btn" disabled={ocupado} onClick={() => archivo.current?.click()}>
            <Icono nombre="file-up" tam={16} />
            Importar PDF
          </button>
          <input ref={archivo} type="file" accept="application/pdf" hidden onChange={(e) => (importar(e.target.files?.[0]), (e.target.value = ''))} />
          <input
            ref={archivoReemplazo}
            type="file"
            accept="application/pdf"
            hidden
            onChange={(e) => (reemplazar(e.target.files?.[0]), (e.target.value = ''))}
          />
          <button type="button" className="btn btn-primario" disabled={!editable || ocupado} onClick={publicar}>
            <Icono nombre="send" tam={16} />
            Publicar versión {versionPublicar}
          </button>
        </div>
      </div>
      <div className="pl-cuerpo">
        <nav className="tarjeta pl-lista" aria-label="Formularios">
          <div className="pl-lista-cab">
            <span>Formularios ({lista.length})</span>
            <button type="button" className="pl-nueva" aria-label="Nueva plantilla" title="Nueva plantilla" disabled={ocupado} onClick={nueva}>
              <Icono nombre="plus" tam={16} />
            </button>
          </div>
          {cargandoLista && !lista.length && <p className="pl-vacio pl-lista-msj">Cargando…</p>}
          {!!errorLista && !lista.length && <p className="pl-vacio pl-lista-msj">{mensajeError(errorLista)}</p>}
          {lista.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`pl-item${p.id === id ? ' activo' : ''}`}
              aria-current={p.id === id}
              onClick={() => (p.id === id && versionVista === undefined ? setSeleccion(null) : cambiarA({ id: p.id }))}
            >
              <span className="pl-item-t">{p.id === id && editable ? titulo : p.nombre}</span>
              <span className="pl-item-s">{subtitulo(p)}</span>
              <Insignia p={p} />
            </button>
          ))}
        </nav>
        {columna ? (
          <div className="pl-columna">
            {lienzo}
            {props}
          </div>
        ) : (
          <>
            {lienzo}
            {props}
          </>
        )}
      </div>
      {aviso && (
        <div className="pl-toast" role="status">
          {aviso}
        </div>
      )}
    </div>
  );
}

/** Errores 400 de la API (`campos.{identificador}`) → por clave local del campo; los demás van a la clave general ''. */
function erroresPorClave(e: ApiError, campos: CampoEditor[]): Record<string, string[]> {
  const r: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(e.errores)) {
    const c = k.startsWith('campos.') ? campos.find((x) => x.identificador === k.slice(7)) : undefined;
    (r[c?.clave ?? ''] ??= []).push(...v);
  }
  return r;
}

export function Plantillas() {
  usePagina({ migas: 'Administración › Plantillas', tituloMovil: 'Plantillas' });
  const lista = usePlantillas();
  const [elegida, setElegida] = useState<{ id: number; version?: number } | null>(null);
  const items = lista.data ?? [];
  const existe = elegida && items.some((p) => p.id === elegida.id);
  // por omisión: la primera con un borrador en edición, si no la primera
  const id = (existe || (elegida && lista.isFetching) ? elegida?.id : undefined) ?? (items.find((p) => p.versionBorrador) ?? items[0])?.id;
  const version = id === elegida?.id ? elegida?.version : undefined;
  const detalle = usePlantilla(id, version);
  return (
    <Editor
      key={`${id ?? ''}:${version ?? ''}:${detalle.data ? 1 : 0}`}
      lista={items}
      cargandoLista={lista.isLoading}
      errorLista={lista.error}
      id={id}
      detalle={detalle.data}
      versionVista={version}
      elegir={setElegida}
    />
  );
}
