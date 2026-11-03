import type { CampoPlantillaDto, PlantillaDto } from '../api/tiposPlantillas';
import type { UsuarioAdminDto } from '../api/tiposUsuarios';
import type {
  FirmaDto,
  FiscalizacionDto,
  FiscalizacionResumenDto,
  FotoDto,
  ModoFirma,
  PendientesDto,
  RolFirma,
  SolicitudFirmaDto,
  SolicitudFirmaRegistroDto,
  UsuarioDto,
  VersionDto,
} from '../api/types';
import { config } from '../config';
import { FIRMAS_REQUERIDAS, nombreRol, nuevaFiscalizacion } from '../domain/fiscalizacion';
import { CATALOGOS, idDe, INICIO, LISTA, MARIA } from './datos/base';
import { PAPELERA } from './datos/cuenta';
import { estadisticas } from './datos/estadisticas';
import { SOLICITUD, USUARIOS_ANA } from './datos/firmas';
import { a3f9Fotos, solicitudesA3f9 } from './datos/formulario';
import { borrador7c21, RECIENTES } from './datos/inicio';
import { detallePlantillas, pdfDePrueba } from './datos/plantillas';
import { registro5e0b, VERSIONES_5E0B } from './datos/registros';
import { USUARIOS_ADMIN } from './datos/usuarios';

/**
 * DEMO (VITE_DEMO=1): API simulada dentro del navegador para mostrar la interfaz sin servidor (p. ej. en Vercel).
 * Parte de los datos del diseño y guarda los cambios en memoria: al recargar la página todo vuelve al inicio.
 */
export const esDemo = import.meta.env.VITE_DEMO === '1';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });
const vacio = (status = 204) => new Response(null, { status });
const problema = (title: string, status = 400) => json({ status, title }, status);
const bytes = (b: Uint8Array, tipo: string, nombre?: string) =>
  new Response(b.slice().buffer, {
    status: 200,
    headers: { 'content-type': tipo, ...(nombre ? { 'content-disposition': `attachment; filename=${nombre}` } : {}) },
  });

const ahora = () => new Date().toISOString();
const clonar = <T>(x: T): T => structuredClone(x);

/** Foto de ejemplo (SVG) para las fotos de los registros del diseño. */
function fotoEjemplo(texto: string): Blob {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfd9e6"/><stop offset="1" stop-color="#8fa3bd"/></linearGradient></defs>
<rect width="640" height="480" fill="url(#g)"/>
<rect x="150" y="190" width="300" height="120" rx="16" fill="#5b6f8a"/><circle cx="210" cy="320" r="28" fill="#2f3d52"/><circle cx="400" cy="320" r="28" fill="#2f3d52"/>
<text x="320" y="420" font-family="Arial, sans-serif" font-size="22" fill="#1d2a3d" text-anchor="middle">${texto.replace(/[<&>]/g, '')}</text>
</svg>`;
  return new Blob([svg], { type: 'image/svg+xml' });
}

/** Detalle de una fila del Historial que no tiene pantalla propia en el diseño (completo y firmado). */
function detalleDeFila(f: FiscalizacionResumenDto): FiscalizacionDto {
  const base = nuevaFiscalizacion(f.id, f.fecha ?? '2026-10-20');
  const locacionId = CATALOGOS.locaciones.find((l) => l.nombre === f.locacion)?.id ?? null;
  const suplidorId = CATALOGOS.suplidores.find((s) => f.suplidor && s.nombre.startsWith(f.suplidor))?.id ?? null;
  const firma = (rol: RolFirma, nombreFirmante: string, modo: ModoFirma): FirmaDto => ({
    rol,
    nombreFirmante,
    cedula: null,
    modo,
    firmadoEn: `${f.fecha}T15:00:00Z`,
    usuarioId: null,
  });
  const borrador = f.estado === 'Borrador';
  return {
    ...base,
    numero: f.numero,
    estado: f.estado,
    versionActual: f.version,
    rowVersion: btoa(`rv-${f.numero}`),
    autor: { id: '22222222-2222-4222-8222-222222222222', nombreCompleto: f.autor },
    creadoEn: `${f.fecha}T14:00:00Z`,
    actualizadoEn: `${f.fecha}T16:00:00Z`,
    enPapelera: f.enPapelera,
    visita: { fecha: f.fecha, horaSalida: '06:45', inicioProceso: '08:30', locacionId, horaLlegada: '08:05', finProceso: borrador ? null : '10:40' },
    suplidor: { fichaCamion: 'FT-140', chofer: 'Ramón Antonio Peña', placa: 'L-301877', conduce: 'CD-0047812', suplidorId, totalEntregarGal: f.galonesProveedor },
    empresa: { fichaCamion2: 'FT-305', chofer2: 'José Luis Martínez', responsable: 'Ing. Carlos Méndez', totalRecibirGal: f.galonesEgehid },
    mediciones: { ...base.mediciones, productoId: 1, galonesProveedor: f.galonesProveedor, galonesEgehid: f.galonesEgehid, precioGalon: 248.6 },
    controles: base.controles.map((c) => ({ ...c, respuesta: borrador ? null : false })),
    fotos: Array.from({ length: borrador ? 2 : 4 }, (_, i) => ({ id: `${f.numero}-${i + 1}`, orden: i + 1, descripcion: `Foto ${i + 1}`, tamanoBytes: 250_000 })),
    firmas: borrador
      ? [firma('AuditorActuante1', f.autor, 'Predeterminada')]
      : [
          firma('AuditorActuante1', f.autor, 'Predeterminada'),
          firma('EncargadoRecibir', 'Luis Ferreras', 'EnEstaTablet'),
          firma('RepresentanteProveedor', 'Ramón A. Peña', 'EnEstaTablet'),
          firma('InspectorActuante', 'María Rosario', 'Predeterminada'),
          firma('RevisadoPor', 'Ana L. Pérez', 'EnSuEquipo'),
        ],
  };
}

/** Lo que falta para finalizar (versión resumida de las reglas de la API). */
function pendientes(d: FiscalizacionDto): PendientesDto {
  const visita: string[] = [];
  if (!d.visita.fecha) visita.push('Falta la fecha de la visita.');
  if (!d.visita.locacionId) visita.push('Falta la locación.');
  if (!d.visita.finProceso) visita.push('Falta la hora de fin del proceso.');
  const suplidor = d.suplidor.suplidorId ? [] : ['Falta el suplidor.'];
  const mediciones: string[] = [];
  if (d.mediciones.galonesProveedor == null) mediciones.push('Faltan los galones del proveedor.');
  if (d.mediciones.galonesEgehid == null) mediciones.push('Faltan los galones medidos por EGEHID.');
  const controles: string[] = [];
  for (const q of CATALOGOS.preguntasControl) {
    const r = d.controles.find((x) => x.numero === q.numero);
    if (r?.respuesta == null) controles.push(`Falta responder el control ${q.numero}.`);
    else if (r.respuesta && q.observacionObligatoriaSiSi && !r.observacion?.trim())
      controles.push(`El control ${q.numero} respondió Sí: la observación es obligatoria.`);
  }
  const firmadas = new Set((d.firmas ?? []).map((f) => f.rol));
  const firmas = FIRMAS_REQUERIDAS.filter((r) => !firmadas.has(r)).map((r) => `Falta la firma de ${nombreRol(r)}.`);
  return { visita, suplidor, mediciones, controles, fotos: [], firmas };
}

function resumenDe(d: FiscalizacionDto): FiscalizacionResumenDto {
  const p = d.mediciones.galonesProveedor;
  const e = d.mediciones.galonesEgehid;
  return {
    id: d.id,
    numero: d.numero ?? '',
    fecha: d.visita.fecha,
    locacion: CATALOGOS.locaciones.find((l) => l.id === d.visita.locacionId)?.nombre ?? null,
    suplidor: CATALOGOS.suplidores.find((s) => s.id === d.suplidor.suplidorId)?.nombre ?? null,
    autor: d.autor?.nombreCompleto ?? MARIA.nombreCompleto,
    galonesProveedor: p,
    galonesEgehid: e,
    diferenciaGal: p != null && e != null ? +(e - p).toFixed(2) : null,
    version: d.versionActual ?? 0,
    estado: d.estado ?? 'Borrador',
    enPapelera: !!d.enPapelera,
  };
}

function crearEstado() {
  const fiscalizaciones = new Map<string, FiscalizacionDto>();
  for (const f of [...LISTA, ...PAPELERA]) fiscalizaciones.set(f.id, detalleDeFila(f));
  for (const d of [a3f9Fotos(), borrador7c21(), registro5e0b()]) {
    const fila = LISTA.find((f) => f.id === d.id);
    fiscalizaciones.set(d.id, { ...d, estado: fila?.estado ?? d.estado, versionActual: fila?.version ?? d.versionActual });
  }
  for (const d of fiscalizaciones.values()) d.pendientes = pendientes(d);
  const plantillas = detallePlantillas();
  return {
    me: clonar<UsuarioDto>(MARIA),
    miFirma: null as string | null,
    fiscalizaciones,
    /** Orden del Historial: el diseño primero, lo nuevo arriba. */
    orden: [...LISTA, ...PAPELERA].map((f) => f.id),
    versiones: new Map<string, VersionDto[]>([[idDe('5E0B-3D77'), VERSIONES_5E0B]]),
    fotos: new Map<string, Blob>(),
    solicitudesMias: [clonar<SolicitudFirmaDto>(SOLICITUD)],
    solicitudesRegistro: new Map<string, SolicitudFirmaRegistroDto[]>([[idDe('A3F9-21C0'), solicitudesA3f9()]]),
    usuarios: clonar<UsuarioAdminDto[]>(USUARIOS_ADMIN),
    plantillas: Object.values(plantillas.detalle).map((p) => clonar(p)),
    pdfPlantillas: plantillas.pdf,
  };
}

const estado = crearEstado();
let secuencia = 1;

function historial(q: URLSearchParams): Response {
  const todos = estado.orden.map((id) => estado.fiscalizaciones.get(id)!).map(resumenDe);
  const activos = todos.filter((f) => !f.enPapelera);
  const papelera = q.get('enPapelera') === 'true';
  let items = papelera ? todos.filter((f) => f.enPapelera) : activos;
  const est = q.get('estado');
  if (est) items = items.filter((f) => f.estado === est);
  const texto = (q.get('texto') ?? '').toLowerCase();
  if (texto) items = items.filter((f) => `${f.numero} ${f.locacion ?? ''} ${f.suplidor ?? ''} ${f.autor}`.toLowerCase().includes(texto));
  const locacionId = Number(q.get('locacionId'));
  if (locacionId) items = items.filter((f) => f.locacion === CATALOGOS.locaciones.find((l) => l.id === locacionId)?.nombre);
  const suplidorId = Number(q.get('suplidorId'));
  if (suplidorId) items = items.filter((f) => f.suplidor === CATALOGOS.suplidores.find((s) => s.id === suplidorId)?.nombre);
  const desde = q.get('desde');
  const hasta = q.get('hasta');
  if (desde) items = items.filter((f) => !f.fecha || f.fecha >= desde);
  if (hasta) items = items.filter((f) => !f.fecha || f.fecha <= hasta);
  const pagina = Number(q.get('pagina') ?? 1);
  const tamano = Number(q.get('tamano') ?? 20);
  const cuenta = (e: string) => activos.filter((f) => f.estado === e).length;
  return json({
    items: items.slice((pagina - 1) * tamano, pagina * tamano),
    total: items.length,
    pagina,
    tamano,
    conteos: {
      todos: activos.length,
      papelera: todos.length - activos.length,
      Borrador: cuenta('Borrador'),
      Finalizado: cuenta('Finalizado'),
      Modificado: cuenta('Modificado'),
      EdicionPendiente: cuenta('EdicionPendiente'),
    },
  });
}

function guardar(d: FiscalizacionDto): FiscalizacionDto {
  d.rowVersion = btoa(`rv-demo-${secuencia++}`);
  d.actualizadoEn = ahora();
  d.pendientes = pendientes(d);
  estado.fiscalizaciones.set(d.id, d);
  if (!estado.orden.includes(d.id)) estado.orden.unshift(d.id);
  return d;
}

function agregarVersion(d: FiscalizacionDto, resumen: string) {
  const lista = (estado.versiones.get(d.id) ?? []).map((v) => ({ ...v, vigente: false }));
  lista.unshift({ version: d.versionActual ?? 1, creadoEn: ahora(), creadoPor: estado.me.nombreCompleto, resumen, vigente: true, cambios: [] });
  estado.versiones.set(d.id, lista);
}

async function fiscalizacion(m: string, id: string, resto: string, req: Request): Promise<Response> {
  const d = estado.fiscalizaciones.get(id);
  if (resto === '' && m === 'PUT') {
    const cuerpo = (await req.json()) as FiscalizacionDto;
    if (d && cuerpo.rowVersion && cuerpo.rowVersion !== d.rowVersion) return json({ status: 409, title: 'El registro cambió en otro equipo.', actual: d }, 409);
    const nuevo: FiscalizacionDto = d
      ? { ...d, ...cuerpo, id, numero: d.numero, estado: d.estado, versionActual: d.versionActual, autor: d.autor, fotos: d.fotos, firmas: d.firmas }
      : {
          ...cuerpo,
          id,
          numero: `${id.slice(0, 4)}-${id.slice(4, 8)}`.toUpperCase(),
          estado: 'Borrador',
          versionActual: 0,
          enPapelera: false,
          autor: { id: estado.me.id, nombreCompleto: estado.me.nombreCompleto },
          creadoEn: ahora(),
          fotos: [],
          firmas: [],
        };
    return json(guardar(nuevo));
  }
  if (!d) return problema('Fiscalización no encontrada.', 404);
  if (resto === '' && m === 'GET') return json(d);
  if (resto === '' && m === 'DELETE') {
    guardar({ ...d, enPapelera: true });
    return vacio();
  }
  if (resto === '/restaurar' && m === 'POST') return json(guardar({ ...d, enPapelera: false }));
  if (resto === '/finalizar' && m === 'POST') {
    const p = pendientes(d);
    const faltan = Object.values(p).flat();
    if (faltan.length) return json({ status: 400, title: 'Hay datos pendientes o inválidos.', errors: Object.fromEntries(Object.entries(p).filter(([, v]) => v.length)) }, 400);
    const f = guardar({ ...d, estado: 'Finalizado', versionActual: (d.versionActual ?? 0) + 1 });
    agregarVersion(f, 'Registro finalizado y PDF generado');
    return json(f);
  }
  if (resto === '/corregir' && m === 'POST') {
    const cuerpo = (await req.json()) as FiscalizacionDto;
    const f = guardar({ ...d, ...cuerpo, id, numero: d.numero, autor: d.autor, fotos: d.fotos, firmas: d.firmas, estado: 'Modificado', versionActual: (d.versionActual ?? 0) + 1 });
    agregarVersion(f, 'Corrección del registro');
    return json(f);
  }
  if (resto === '/versiones' && m === 'GET') return json(estado.versiones.get(id) ?? []);
  if (resto === '/solicitudes-firma') {
    if (m === 'GET') return json(estado.solicitudesRegistro.get(id) ?? []);
    const cuerpo = (await req.json()) as { rol: RolFirma; usuarioDestinoId: string };
    const destino = [...USUARIOS_ANA, ...estado.usuarios].find((u) => u.id === cuerpo.usuarioDestinoId);
    const lista = (estado.solicitudesRegistro.get(id) ?? []).map((s) => (s.rol === cuerpo.rol && s.estado === 'Pendiente' ? { ...s, estado: 'Expirada' as const } : s));
    const creadaEn = new Date();
    const expiraEn = new Date(creadaEn.getTime() + 7 * 86_400_000).toISOString();
    const nueva: SolicitudFirmaRegistroDto = {
      id: crypto.randomUUID(),
      rol: cuerpo.rol,
      usuarioDestinoId: cuerpo.usuarioDestinoId,
      firmante: destino?.nombreCompleto ?? 'Firmante',
      correoFirmante: (destino as { correo?: string } | undefined)?.correo ?? 'firmante@hidroelectrica.gov.do',
      solicitadaPor: estado.me.nombreCompleto,
      estado: 'Pendiente',
      comentario: null,
      creadaEn: creadaEn.toISOString(),
      expiraEn,
      firmadaEn: null,
    };
    estado.solicitudesRegistro.set(id, [nueva, ...lista]);
    return json({ id: nueva.id, fiscalizacionId: id, numero: d.numero, rol: nueva.rol, solicitadaPor: nueva.solicitadaPor, creadaEn: nueva.creadaEn, expiraEn, estado: 'Pendiente' });
  }
  const firma = /^\/firmas\/(\w+)$/.exec(resto);
  if (firma && m === 'PUT') {
    const rol = firma[1] as RolFirma;
    const cuerpo = (await req.json()) as { nombreFirmante: string | null; cedula: string | null; modo: ModoFirma };
    const nueva: FirmaDto = {
      rol,
      nombreFirmante: cuerpo.nombreFirmante || estado.me.nombreCompleto,
      cedula: cuerpo.cedula,
      modo: cuerpo.modo,
      firmadoEn: ahora(),
      usuarioId: cuerpo.modo === 'Predeterminada' ? estado.me.id : null,
    };
    return json(guardar({ ...d, firmas: [...(d.firmas ?? []).filter((f) => f.rol !== rol), nueva] }));
  }
  if (resto === '/fotos' && m === 'POST') {
    const form = await req.formData();
    const archivo = [...form.values()].find((v): v is File => v instanceof File);
    const foto: FotoDto = {
      id: crypto.randomUUID(),
      orden: (d.fotos?.length ?? 0) + 1,
      descripcion: (form.get('descripcion') as string | null) || null,
      tamanoBytes: archivo?.size ?? 0,
    };
    if (archivo) estado.fotos.set(foto.id, archivo);
    guardar({ ...d, fotos: [...(d.fotos ?? []), foto] });
    return json(foto);
  }
  const foto = /^\/fotos\/([^/]+)$/.exec(resto);
  if (foto && m === 'GET') {
    const f = d.fotos?.find((x) => x.id === foto[1]);
    const blob = estado.fotos.get(foto[1]) ?? fotoEjemplo(f?.descripcion ?? `Fotografía ${f?.orden ?? ''}`);
    return new Response(blob, { status: 200, headers: { 'content-type': blob.type || 'image/jpeg' } });
  }
  if (foto && m === 'DELETE') {
    guardar({ ...d, fotos: (d.fotos ?? []).filter((x) => x.id !== foto[1]) });
    return vacio();
  }
  const pdf = /^\/(pdf|pdf\/vista-previa|versiones\/(\d+)\/pdf)$/.exec(resto);
  if (pdf && m === 'GET') {
    const corto = (d.numero ?? 'borrador').split('-')[0];
    const vista = pdf[1] === 'pdf/vista-previa';
    if (!vista && (d.estado === 'Borrador' || !d.versionActual)) return problema('El registro todavía no está finalizado: use la vista previa.', 409);
    const r = resumenDe(d);
    const lineas = [
      `${vista && d.estado === 'Borrador' ? 'BORRADOR' : 'FISCALIZACION'} ${d.numero ?? ''}`,
      `Locacion: ${r.locacion ?? '-'}`,
      `Suplidor: ${r.suplidor ?? '-'}`,
      `Galones proveedor: ${r.galonesProveedor ?? '-'}   Galones EGEHID: ${r.galonesEgehid ?? '-'}`,
      'Documento de demostracion: la version real la genera la API.',
    ];
    const cuerpo = pdfDePrueba(lineas.map((texto, i) => ({ t: 'texto', x: 40, y: 40 + i * 24, texto, tam: i ? 11 : 14, negrita: !i })), 612, 792);
    const nombre = vista ? `Fiscalizacion-${corto}-vista-previa.pdf` : `Fiscalizacion-${corto}-v${pdf[2] ?? d.versionActual}.pdf`;
    return bytes(cuerpo, 'application/pdf', nombre);
  }
  return problema(`No disponible en la demostración: ${m} ${resto}`, 404);
}

function adminUsuarios(m: string, ruta: string, q: URLSearchParams, cuerpo: Record<string, unknown>): Response {
  const lista = estado.usuarios;
  if (m === 'GET' && ruta === '/admin/usuarios') {
    const t = (q.get('texto') ?? '').toLowerCase();
    const rol = q.get('rol');
    let items = lista.filter((u) => (!t || `${u.nombreCompleto} ${u.correo} ${u.cargo ?? ''}`.toLowerCase().includes(t)) && (!rol || u.rol === rol));
    const conteos = {
      todos: items.length,
      activos: items.filter((u) => u.activo).length,
      inactivos: items.filter((u) => !u.activo).length,
      pendientes: items.filter((u) => u.pendienteIngreso).length,
      Administrador: lista.filter((u) => u.rol === 'Administrador').length,
      Auditor: lista.filter((u) => u.rol === 'Auditor').length,
      Firmante: lista.filter((u) => u.rol === 'Firmante').length,
    };
    if (q.get('estado') === 'activos') items = items.filter((u) => u.activo);
    if (q.get('estado') === 'inactivos') items = items.filter((u) => !u.activo);
    const pagina = Number(q.get('pagina') ?? 1);
    const tamano = Number(q.get('tamano') ?? 20);
    return json({ items: items.slice((pagina - 1) * tamano, pagina * tamano), total: items.length, pagina, tamano, conteos });
  }
  const error = (campo: string, mensaje: string) => json({ status: 400, title: 'Hay datos pendientes o inválidos.', errors: { [campo]: [mensaje] } }, 400);
  if (m === 'POST' && ruta === '/admin/usuarios') {
    const correo = String(cuerpo.correo ?? '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return error('correo', 'Escriba un correo válido (nombre@dominio).');
    if (lista.some((u) => u.correo === correo)) return error('correo', 'Ya existe un usuario con ese correo.');
    const nuevo: UsuarioAdminDto = {
      id: crypto.randomUUID(),
      correo,
      nombreCompleto: String(cuerpo.nombreCompleto ?? '').trim(),
      cargo: null,
      rol: (cuerpo.rol as UsuarioAdminDto['rol']) ?? 'Auditor',
      activo: true,
      tieneFirma: false,
      perfilCompleto: false,
      pendienteIngreso: true,
      creadoEn: ahora(),
      ultimoAcceso: null,
      registros: 0,
      esUsted: false,
    };
    lista.push(nuevo);
    return json(nuevo);
  }
  const mm = /^\/admin\/usuarios\/([0-9a-f-]{36})\/(rol|activar|desactivar)$/.exec(ruta);
  const u = mm && lista.find((x) => x.id === mm[1]);
  if (!mm || !u) return problema('Usuario no encontrado.', 404);
  const rol = mm[2] === 'rol' ? ((cuerpo.rol as UsuarioAdminDto['rol']) ?? u.rol) : u.rol;
  const activo = mm[2] === 'rol' ? u.activo : mm[2] === 'activar';
  if (u.esUsted && !activo) return problema('No puede desactivar su propia cuenta.');
  if (u.esUsted && u.rol === 'Administrador' && rol !== 'Administrador') return problema('No puede quitarse a sí mismo el rol de Administrador.');
  Object.assign(u, { rol, activo });
  return json(u);
}

async function plantillas(m: string, ruta: string, q: URLSearchParams, req: Request): Promise<Response> {
  const lista = estado.plantillas;
  const resumen = (p: PlantillaDto) => {
    const { id, nombre, tipo, estado: est, version, versionBorrador } = p;
    const publicada = p.versiones.find((v) => v.publicada && v.version === version);
    const totalCampos = (publicada ?? p.versiones[0])?.totalCampos ?? 0;
    return { id, nombre, tipo, estado: est, version, versionBorrador, totalCampos, publicadaEn: publicada?.publicadaEn ?? null };
  };
  if (m === 'GET' && ruta === '/plantillas') return json(lista.map(resumen));
  const nueva = (nombre: string, conPdf: boolean, campos: CampoPlantillaDto[] = []): PlantillaDto => {
    const id = Math.max(...lista.map((p) => p.id)) + 1;
    const p: PlantillaDto = {
      ...clonar(lista[lista.length - 1]),
      id,
      nombre,
      tipo: 'Personalizada',
      estado: 'Borrador',
      version: 0,
      versionBorrador: 1,
      editable: true,
      versiones: [{ version: 1, publicada: false, publicadaEn: null, totalCampos: campos.length, tienePdf: conPdf }],
      actual: { version: 1, publicada: false, publicadaEn: null, tienePdf: conPdf, paginas: [conPdf ? { ancho: 440, alto: 600 } : { ancho: 612, alto: 792 }], campos },
    };
    if (conPdf) estado.pdfPlantillas[`${id}/1`] = estado.pdfPlantillas['2/4'];
    lista.push(p);
    return p;
  };
  if (m === 'POST' && ruta === '/plantillas') {
    const c = (await req.json()) as { nombre?: string };
    return json(nueva(c.nombre || 'Plantilla nueva', false));
  }
  if (m === 'POST' && ruta === '/plantillas/importar') return json(nueva('Plantilla importada', true));
  const mm = /^\/plantillas\/(\d+)(\/.*)?$/.exec(ruta);
  const p = mm && lista.find((x) => x.id === Number(mm[1]));
  if (!mm || !p) return problema('Plantilla no encontrada', 404);
  const resto = mm[2] ?? '';
  if (m === 'GET' && resto === '') {
    const v = Number(q.get('version'));
    if (!v || v === p.actual.version) return json(p);
    const info = p.versiones.find((x) => x.version === v);
    if (!info) return problema('Versión no encontrada', 404);
    return json({ ...p, actual: { ...p.actual, version: v, publicada: info.publicada, publicadaEn: info.publicadaEn, tienePdf: info.tienePdf } });
  }
  const pdf = /^\/versiones\/(\d+)\/pdf$/.exec(resto);
  if (m === 'GET' && pdf) {
    const b = estado.pdfPlantillas[`${p.id}/${pdf[1]}`];
    return b ? bytes(b, 'application/pdf') : problema('Sin PDF', 404);
  }
  if (m === 'POST' && resto === '/duplicar') return json(nueva(`${p.nombre} (copia)`, p.actual.tienePdf, clonar(p.actual.campos)));
  if (!p.editable) return problema('La plantilla oficial no se edita.');
  const conBorrador = () => {
    if (!p.versionBorrador) {
      const v = p.version + 1;
      p.versionBorrador = v;
      p.versiones.unshift({ version: v, publicada: false, publicadaEn: null, totalCampos: p.actual.campos.length, tienePdf: p.actual.tienePdf });
      p.actual = { ...p.actual, version: v, publicada: false, publicadaEn: null };
      if (p.actual.tienePdf) estado.pdfPlantillas[`${p.id}/${v}`] = estado.pdfPlantillas[`${p.id}/${p.version}`] ?? estado.pdfPlantillas['2/4'];
    }
  };
  if (m === 'PUT' && resto === '/borrador') {
    const c = (await req.json()) as { nombre?: string | null; campos: CampoPlantillaDto[] };
    conBorrador();
    p.actual.campos = c.campos;
    p.versiones[0].totalCampos = c.campos.length;
    if (c.nombre) p.nombre = c.nombre;
    return json(p);
  }
  if (m === 'PUT' && resto === '/encabezado') {
    p.encabezado = { ...p.encabezado, ...((await req.json()) as object) };
    return json(p);
  }
  if (m === 'POST' && resto === '/borrador/pdf') {
    conBorrador();
    p.actual.tienePdf = true;
    estado.pdfPlantillas[`${p.id}/${p.actual.version}`] = estado.pdfPlantillas['2/4'];
    return json(p);
  }
  if (m === 'POST' && resto === '/publicar') {
    if (!p.versionBorrador) return problema('No hay cambios por publicar.');
    if (!p.actual.campos.length) return json({ status: 400, title: 'Hay datos pendientes o inválidos.', errors: { campos: ['Agregue al menos un campo antes de publicar.'] } }, 400);
    const fecha = ahora();
    p.versiones = p.versiones.map((v) => (v.version === p.versionBorrador ? { ...v, publicada: true, publicadaEn: fecha } : v));
    Object.assign(p, { version: p.versionBorrador, versionBorrador: null, estado: 'Activa' });
    p.actual = { ...p.actual, publicada: true, publicadaEn: fecha };
    return json(p);
  }
  if (m === 'POST' && (resto === '/activar' || resto === '/desactivar')) {
    p.estado = resto === '/activar' ? 'Activa' : 'Desactivada';
    return json(p);
  }
  if (m === 'DELETE' && resto === '/borrador') {
    if (!p.version) {
      lista.splice(lista.indexOf(p), 1);
      return vacio();
    }
    p.versiones = p.versiones.filter((v) => v.publicada);
    p.versionBorrador = null;
    p.actual = { ...p.actual, version: p.version, publicada: true, publicadaEn: p.versiones.find((v) => v.version === p.version)?.publicadaEn ?? null };
    return json(p);
  }
  return problema(`No disponible en la demostración: ${m} ${ruta}`, 404);
}

async function responder(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const ruta = url.pathname.replace(/^.*?\/api(?=\/|$)/, '') || '/';
  const q = url.searchParams;
  const m = req.method;
  const cuerpoJson = async () => (m === 'GET' || m === 'DELETE' ? {} : ((await req.clone().json().catch(() => ({}))) as Record<string, unknown>));

  if (ruta === '/salud') return json({ estado: 'ok', servicio: 'fiscalizacion-egehid (demostración)' });
  if (ruta === '/app/version') return problema('Sin actualizaciones en la demostración.', 404);
  if (ruta === '/bitacora/ui') return vacio(202);
  if (!req.headers.get('X-Dev-User')) return problema('Sin sesión', 401);

  if (ruta === '/me' && m === 'GET') return json({ ...estado.me, tieneFirma: estado.me.tieneFirma || !!estado.miFirma });
  if (ruta === '/me/perfil' && m === 'PUT') {
    Object.assign(estado.me, await cuerpoJson(), { perfilCompleto: true });
    return json(estado.me);
  }
  if (ruta === '/me/firma') {
    if (m === 'PUT') {
      estado.miFirma = String((await cuerpoJson()).imagenBase64 ?? '') || null;
      estado.me.tieneFirma = !!estado.miFirma;
      return vacio();
    }
    return estado.miFirma ? json({ imagenBase64: estado.miFirma }) : problema('Sin firma', 404);
  }
  if (ruta === '/catalogos') return json(CATALOGOS);
  if (ruta === '/inicio/resumen') {
    const recientes = estado.orden
      .map((id) => resumenDe(estado.fiscalizaciones.get(id)!))
      .filter((f) => !f.enPapelera)
      .slice(0, 8)
      .map((f) => RECIENTES.find((r) => r.id === f.id) ?? f);
    return json({ ...INICIO, recientes });
  }
  if (ruta === '/avisos') return json(INICIO.avisos);
  if (ruta === '/estadisticas') return json(estadisticas('desktop'));
  if (ruta === '/solicitudes-firma/mias') return json(estado.solicitudesMias.filter((s) => s.estado === 'Pendiente'));
  const sol = /^\/solicitudes-firma\/([^/]+)\/(firmar|rechazar)$/.exec(ruta);
  if (sol && m === 'POST') {
    const s = estado.solicitudesMias.find((x) => x.id === sol[1]);
    if (!s) return problema('Solicitud no encontrada.', 404);
    s.estado = sol[2] === 'firmar' ? 'Firmada' : 'Rechazada';
    const d = estado.fiscalizaciones.get(s.fiscalizacionId);
    if (d && sol[2] === 'firmar') {
      const firma: FirmaDto = { rol: s.rol, nombreFirmante: estado.me.nombreCompleto, cedula: null, modo: 'EnSuEquipo', firmadoEn: ahora(), usuarioId: estado.me.id };
      return json(guardar({ ...d, firmas: [...(d.firmas ?? []).filter((f) => f.rol !== s.rol), firma] }));
    }
    return vacio();
  }
  if (ruta === '/usuarios') {
    const t = (q.get('texto') ?? '').toLowerCase();
    const todos = [
      ...USUARIOS_ANA,
      ...estado.usuarios.filter((u) => u.activo && u.nombreCompleto && !u.esUsted).map((u) => ({ id: u.id, nombreCompleto: u.nombreCompleto, cargo: u.cargo, tieneFirma: u.tieneFirma })),
    ];
    return json(t ? todos.filter((u) => u.nombreCompleto.toLowerCase().includes(t)) : []);
  }
  if (ruta === '/fiscalizaciones' && m === 'GET') return historial(q);
  const fm = /^\/fiscalizaciones\/([0-9a-f-]{36})(\/.*)?$/.exec(ruta);
  if (fm) return fiscalizacion(m, fm[1], fm[2] ?? '', req);
  if (ruta.startsWith('/admin/usuarios')) return adminUsuarios(m, ruta, q, await cuerpoJson());
  if (ruta.startsWith('/plantillas')) return plantillas(m, ruta, q, req);
  if (ruta.startsWith('/bitacora')) return json({ items: [], total: 0, pagina: 1, tamano: 50 });
  return problema(`No disponible en la demostración: ${m} ${ruta}`, 404);
}

/** Atiende en el navegador las peticiones a la API (config.apiUrl); el resto (fuentes, assets) sale a la red. */
export function instalarApiDemo() {
  const original = window.fetch.bind(window);
  window.fetch = (entrada: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const req = new Request(entrada, init);
    if (!req.url.startsWith(config.apiUrl)) return original(entrada, init);
    // una pequeña espera para que se vean los estados de carga como con un servidor real
    return new Promise<void>((ok) => setTimeout(ok, 120)).then(() => responder(req));
  };
}
