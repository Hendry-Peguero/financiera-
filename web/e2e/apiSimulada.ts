import type { Page, Route } from '@playwright/test';
import type { CampoPlantillaDto, PlantillaDto, PlantillaResumenDto } from '../src/api/tiposPlantillas';
import { pdfDePrueba } from './visual/fixtures/plantillas';

/** API simulada en memoria (las pruebas E2E nunca tocan la API real). */
export interface OpcionesApi {
  correo: string;
  propietario?: boolean;
  rol?: 'Administrador' | 'Auditor' | 'Firmante';
  /** La API responde 403 «Usuario desactivado.» a todo (MiddlewareUsuario). */
  desactivado?: boolean;
}

type Dto = Record<string, unknown> & { id: string; rowVersion: string | null };

/** Fila de GET /fiscalizaciones/{id}/solicitudes-firma (más `fiscalizacionId` para filtrar). */
export interface SolicitudSimulada {
  id: string;
  fiscalizacionId: string;
  rol: string;
  usuarioDestinoId: string;
  firmante: string;
  correoFirmante: string;
  solicitadaPor: string;
  estado: 'Pendiente' | 'Firmada' | 'Rechazada' | 'Expirada';
  comentario: string | null;
  creadaEn: string;
  expiraEn: string;
  firmadaEn: string | null;
}

/** Usuarios para «Dar acceso» (GET /usuarios?texto=). */
const USUARIOS = [
  { id: '44444444-4444-4444-8444-444444444444', nombreCompleto: 'Pedro Almonte', cargo: 'Supervisor de combustibles', tieneFirma: true, correo: 'pedro.almonte@egehid.test' },
];

type Rol = 'Administrador' | 'Auditor' | 'Firmante';

/** Fila de GET /admin/usuarios (sin `esUsted`, que depende de quién pregunta). */
export interface UsuarioAdminSimulado {
  id: string;
  correo: string;
  nombreCompleto: string;
  cargo: string | null;
  rol: Rol;
  activo: boolean;
  tieneFirma: boolean;
  perfilCompleto: boolean;
  pendienteIngreso: boolean;
  creadoEn: string;
  ultimoAcceso: string | null;
  registros: number;
}

/** El usuario de la sesión, el firmante de «Dar acceso» y una auditora desactivada. */
function usuariosAdminIniciales(yo: { id: string; correo: string; nombreCompleto: string; cargo: string; rol: Rol }): UsuarioAdminSimulado[] {
  const base = { tieneFirma: true, perfilCompleto: true, pendienteIngreso: false, creadoEn: '2026-09-01T12:00:00Z', ultimoAcceso: new Date().toISOString() };
  const p = USUARIOS[0];
  return [
    { ...base, id: yo.id, correo: yo.correo, nombreCompleto: yo.nombreCompleto, cargo: yo.cargo, rol: yo.rol, activo: true, registros: 12 },
    { ...base, id: p.id, correo: p.correo, nombreCompleto: p.nombreCompleto, cargo: p.cargo, rol: 'Auditor', activo: true, registros: 3 },
    {
      ...base,
      id: '55555555-5555-4555-8555-555555555555',
      correo: 'ana.perez@egehid.test',
      nombreCompleto: 'Ana Lucía Pérez',
      cargo: 'Auditora de campo',
      rol: 'Auditor',
      activo: false,
      registros: 7,
      ultimoAcceso: '2026-09-15T14:00:00Z',
    },
  ];
}

const PREGUNTAS = [
  '¿La solicitud se realizó con margen disponible mínimo del 50 %?',
  '¿El proveedor llegó a la hora acordada?',
  '¿Se implementaron las medidas de seguridad establecidas?',
  '¿Se realizó la prueba de calidad antes de la descarga?',
  '¿Se efectuaron mediciones antes y después del proceso?',
  '¿Se evidenció presencia de agua en los tanques?',
  '¿Válvulas y bocas con presillas de seguridad?',
  '¿Compartimientos al nivel adecuado de chapas?',
  '¿Tanque y dispensador en condiciones operativas?',
  '¿El dispensador ha sido calibrado?',
  '¿Se produjo algún derrame durante el proceso?',
  '¿Hubo diferencias en la entrega recibida?',
].map((texto, i) => ({
  numero: i + 1,
  texto,
  observacionObligatoriaSiSi: [6, 11, 12].includes(i + 1),
  tipoObservacion: i + 1 === 10 ? 'Fecha' : 'Texto',
}));

export const CATALOGOS = {
  locaciones: [
    { id: 2, nombre: 'C.H. Aguacate', provincia: null },
    { id: 1, nombre: 'C.H. Jigüey', provincia: 'Ocoa' },
  ],
  suplidores: [{ id: 1, nombre: 'Sunix Petroleum, S.R.L.' }],
  productos: [{ id: 1, nombre: 'Gasoil óptimo', unidad: 'gal' }],
  preguntasControl: PREGUNTAS,
};

function pendientes(d: Dto) {
  const v = (d.visita ?? {}) as Record<string, unknown>;
  const controles = (d.controles ?? []) as { numero: number; respuesta: boolean | null; observacion: string | null }[];
  const visita: string[] = [];
  if (!v.finProceso) visita.push('Falta la hora de fin del proceso.');
  const c: string[] = [];
  for (const q of PREGUNTAS) {
    const r = controles.find((x) => x.numero === q.numero);
    if (r?.respuesta == null) c.push(`Falta responder el control ${q.numero}.`);
    else if (r.respuesta && q.observacionObligatoriaSiSi && !r.observacion?.trim())
      c.push(`El control ${q.numero} respondió Sí: la observación es obligatoria.`);
  }
  return { visita, suplidor: [], mediciones: [], controles: c, fotos: [], firmas: ['Falta la firma de Auditor actuante 1.'] };
}

interface PlantillaSimulada {
  id: number;
  nombre: string;
  tipo: 'Oficial' | 'Personalizada';
  estado: 'Activa' | 'Borrador' | 'Desactivada';
  versiones: { version: number; publicada: boolean; publicadaEn: string | null; pdf: boolean; campos: CampoPlantillaDto[] }[];
}

/** Plantillas en memoria (misma forma que la API: un borrador como máximo, la oficial de solo lectura). */
function plantillasSimuladas() {
  const lista: PlantillaSimulada[] = [
    { id: 1, nombre: 'Combustible y aceites', tipo: 'Oficial', estado: 'Activa', versiones: [{ version: 2, publicada: true, publicadaEn: '2026-10-01T00:00:00Z', pdf: false, campos: [] }] },
  ];
  const pdf = pdfDePrueba([{ t: 'texto', x: 28, y: 26, texto: 'PLANTILLA IMPORTADA', tam: 10, negrita: true }]);
  const publicada = (p: PlantillaSimulada) => p.versiones.filter((v) => v.publicada).at(-1);
  const borrador = (p: PlantillaSimulada) => p.versiones.find((v) => !v.publicada);
  const resumen = (p: PlantillaSimulada): PlantillaResumenDto => ({
    id: p.id,
    nombre: p.nombre,
    tipo: p.tipo,
    estado: p.estado,
    version: publicada(p)?.version ?? 0,
    versionBorrador: borrador(p)?.version ?? null,
    totalCampos: (publicada(p) ?? borrador(p))?.campos.length ?? 0,
    publicadaEn: publicada(p)?.publicadaEn ?? null,
  });
  const detalle = (p: PlantillaSimulada, version?: number): PlantillaDto | null => {
    const v = version ? p.versiones.find((x) => x.version === version) : (borrador(p) ?? publicada(p));
    if (!v) return null;
    return {
      ...resumen(p),
      encabezado: { codigo: null, version: null, fechaElaboracion: null, fechaAprobacion: null },
      editable: p.tipo !== 'Oficial',
      versiones: [...p.versiones].reverse().map((x) => ({ ...x, totalCampos: x.campos.length, tienePdf: x.pdf })),
      actual: {
        version: v.version,
        publicada: v.publicada,
        publicadaEn: v.publicadaEn,
        tienePdf: v.pdf,
        paginas: [v.pdf ? { ancho: 440, alto: 600 } : { ancho: 612, alto: 792 }],
        campos: v.campos,
      },
    };
  };
  const nueva = (nombre: string, conPdf: boolean, campos: CampoPlantillaDto[] = []) => {
    const p: PlantillaSimulada = {
      id: Math.max(...lista.map((x) => x.id)) + 1,
      nombre,
      tipo: 'Personalizada',
      estado: 'Borrador',
      versiones: [{ version: 1, publicada: false, publicadaEn: null, pdf: conPdf, campos }],
    };
    lista.push(p);
    return p;
  };
  return { lista, pdf, resumen, detalle, nueva, publicada, borrador };
}

export function instalarApiSimulada(page: Page, op: OpcionesApi) {
  const estado = {
    fiscalizaciones: new Map<string, Dto>(),
    puts: [] as { id: string; rowVersion: string | null }[],
    /** DELETE /fiscalizaciones/{id} recibidos (van a la papelera) */
    borrados: [] as string[],
    eventosUi: [] as Record<string, unknown>[],
    noGet: [] as string[],
    /** Rutas de PDF pedidas (descargas y vistas previas). */
    pdfs: [] as string[],
    plantillas: plantillasSimuladas(),
    /** Solicitudes de firma (GET/POST /fiscalizaciones/{id}/solicitudes-firma), la más reciente primero. */
    solicitudes: [] as SolicitudSimulada[],
    /** Gestión de usuarios (GET/POST /admin/usuarios…); se llena después de crear `usuario`. */
    usuarios: [] as UsuarioAdminSimulado[],
  };
  let version = 1;
  const usuario = {
    id: '11111111-1111-1111-1111-111111111111',
    correo: op.correo,
    nombreCompleto: 'María Rosario Peña',
    cargo: 'Auditora de campo',
    rol: op.rol ?? 'Auditor',
    tieneFirma: false,
    esPropietarioBitacora: !!op.propietario,
    perfilCompleto: true,
  };

  estado.usuarios.push(...usuariosAdminIniciales(usuario));

  const json = (r: Route, cuerpo: unknown, status = 200) =>
    r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(cuerpo), headers: { 'access-control-allow-origin': '*' } });

  void page.route('http://api.simulada.test/**', async (r) => {
    const req = r.request();
    const url = new URL(req.url());
    const ruta = url.pathname.replace(/^\/api/, '');
    const m = req.method();
    if (m === 'OPTIONS')
      return r.fulfill({
        status: 204,
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' },
      });
    if (m !== 'GET') estado.noGet.push(`${m} ${ruta}`);
    if (req.headers()['x-dev-user'] !== op.correo && ruta !== '/salud') return json(r, { title: 'Sin sesión' }, 401);
    if (op.desactivado && ruta !== '/salud') return json(r, { title: 'Usuario desactivado.' }, 403);

    if (ruta === '/salud') return json(r, { estado: 'ok', servicio: 'fiscalizacion-egehid' });
    if (m === 'GET' && ruta === '/me') return json(r, usuario);
    if (m === 'GET' && ruta === '/catalogos') return json(r, CATALOGOS);
    if (m === 'GET' && ruta === '/inicio/resumen')
      return json(r, { finalizadosMes: 0, finalizadosMesAnterior: 0, borradores: 0, borradoresFirmasIncompletas: 0, galonesMes: 0, avisos: [], recientes: [] });
    if (m === 'GET' && ruta === '/solicitudes-firma/mias') return json(r, []);
    if (m === 'GET' && ruta === '/usuarios') {
      const t = (url.searchParams.get('texto') ?? '').toLowerCase();
      return json(r, t ? USUARIOS.filter((u) => u.nombreCompleto.toLowerCase().includes(t)) : []);
    }
    const sf = /^\/fiscalizaciones\/([0-9a-f-]{36})\/solicitudes-firma$/.exec(ruta);
    if (sf) return solicitudFirma(r, m, sf[1], req.postDataJSON() as { rol: string; usuarioDestinoId: string } | null);
    if (m === 'GET' && ruta === '/fiscalizaciones') {
      // los borradores guardados con PUT (fuera de la papelera)
      const items = [...estado.fiscalizaciones.values()]
        .filter((d) => !d.enPapelera)
        .map((d) => ({
          id: d.id,
          numero: d.numero,
          fecha: (d.visita as { fecha?: string } | undefined)?.fecha ?? null,
          locacion: null,
          suplidor: null,
          autor: usuario.nombreCompleto,
          galonesProveedor: null,
          galonesEgehid: null,
          diferenciaGal: null,
          version: 0,
          estado: d.estado,
          enPapelera: false,
        }));
      const papelera = [...estado.fiscalizaciones.values()].filter((d) => d.enPapelera).length;
      return json(r, {
        items,
        total: items.length,
        pagina: 1,
        tamano: 20,
        conteos: { todos: items.length, papelera, Borrador: items.length, Finalizado: 0, Modificado: 0, EdicionPendiente: 0 },
      });
    }
    if (ruta.startsWith('/bitacora/') && m === 'GET') {
      if (!op.propietario) return json(r, { title: 'Prohibido' }, 403);
      return json(r, { items: [], total: 0, pagina: 1, tamano: 50 });
    }
    if (ruta === '/bitacora/ui' && m === 'POST') {
      const cuerpo = req.postDataJSON() as { eventos: Record<string, unknown>[] };
      estado.eventosUi.push(...cuerpo.eventos);
      return r.fulfill({ status: 202, headers: { 'access-control-allow-origin': '*' } });
    }
    const fm = /^\/fiscalizaciones\/([0-9a-f-]{36})$/.exec(ruta);
    if (fm && m === 'GET') {
      const d = estado.fiscalizaciones.get(fm[1]);
      return d ? json(r, d) : json(r, { title: 'No encontrado' }, 404);
    }
    if (fm && m === 'DELETE') {
      const d = estado.fiscalizaciones.get(fm[1]);
      if (!d) return json(r, { title: 'No encontrado' }, 404);
      estado.borrados.push(fm[1]);
      estado.fiscalizaciones.set(fm[1], { ...d, enPapelera: true });
      return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
    }
    if (fm && m === 'PUT') {
      const cuerpo = req.postDataJSON() as Dto;
      const previo = estado.fiscalizaciones.get(fm[1]);
      estado.puts.push({ id: fm[1], rowVersion: cuerpo.rowVersion });
      if (previo && cuerpo.rowVersion !== previo.rowVersion)
        return json(r, { status: 409, title: 'El registro cambió en otro equipo.', actual: previo }, 409);
      const dto: Dto = {
        ...cuerpo,
        id: fm[1],
        numero: `${fm[1].slice(0, 4)}-${fm[1].slice(4, 8)}`.toUpperCase(),
        estado: 'Borrador',
        versionActual: 0,
        enPapelera: false,
        rowVersion: btoa(`rv-${version++}`),
        autor: { id: usuario.id, nombreCompleto: usuario.nombreCompleto },
        fotos: [],
        firmas: [],
      };
      dto.pendientes = pendientes(dto);
      estado.fiscalizaciones.set(fm[1], dto);
      return json(r, dto);
    }
    const pdf = /^\/fiscalizaciones\/([0-9a-f-]{36})\/(pdf|pdf\/vista-previa|versiones\/(\d+)\/pdf)$/.exec(ruta);
    if (pdf && m === 'GET') return pdfFiscalizacion(r, ruta, pdf[1], pdf[2], pdf[3]);
    if (ruta.startsWith('/plantillas')) return plantilla(r, m, ruta, url);
    if (ruta.startsWith('/admin/usuarios')) return adminUsuarios(r, m, ruta, url);
    return json(r, { title: `No simulado: ${m} ${ruta}` }, 404);
  });

  /** Gestión de usuarios con las reglas de la API (ReglasUsuarios): solo Administrador, sin quitarse el rol ni desactivarse. */
  function adminUsuarios(r: Route, m: string, ruta: string, url: URL) {
    if (usuario.rol !== 'Administrador') return json(r, { title: 'Prohibido' }, 403);
    const lista = estado.usuarios;
    const dto = (u: UsuarioAdminSimulado) => ({ ...u, esUsted: u.id === usuario.id });
    const error = (campo: string, mensaje: string) =>
      json(r, { status: 400, title: 'Hay datos pendientes o inválidos.', errors: { [campo]: [mensaje] } }, 400);
    if (m === 'GET' && ruta === '/admin/usuarios') {
      const t = (url.searchParams.get('texto') ?? '').toLowerCase();
      const rol = url.searchParams.get('rol');
      const est = url.searchParams.get('estado');
      let q = lista.filter(
        (u) => (!t || `${u.nombreCompleto} ${u.correo} ${u.cargo ?? ''}`.toLowerCase().includes(t)) && (!rol || u.rol === rol),
      );
      const conteos = {
        todos: q.length,
        activos: q.filter((u) => u.activo).length,
        inactivos: q.filter((u) => !u.activo).length,
        pendientes: q.filter((u) => u.pendienteIngreso).length,
        Administrador: lista.filter((u) => u.rol === 'Administrador').length,
        Auditor: lista.filter((u) => u.rol === 'Auditor').length,
        Firmante: lista.filter((u) => u.rol === 'Firmante').length,
      };
      if (est === 'activos') q = q.filter((u) => u.activo);
      if (est === 'inactivos') q = q.filter((u) => !u.activo);
      q.sort(
        (a, b) =>
          Number(b.activo) - Number(a.activo) ||
          Number(!a.nombreCompleto) - Number(!b.nombreCompleto) ||
          a.nombreCompleto.localeCompare(b.nombreCompleto),
      );
      const pagina = Number(url.searchParams.get('pagina') ?? 1);
      const tamano = Number(url.searchParams.get('tamano') ?? 20);
      return json(r, { items: q.slice((pagina - 1) * tamano, pagina * tamano).map(dto), total: q.length, pagina, tamano, conteos });
    }
    const cuerpo = (r.request().postDataJSON() ?? {}) as { correo?: string; rol?: Rol; nombreCompleto?: string | null };
    if (m === 'POST' && ruta === '/admin/usuarios') {
      const correo = (cuerpo.correo ?? '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return error('correo', 'Escriba un correo válido (nombre@dominio).');
      if (lista.some((u) => u.correo === correo)) return error('correo', 'Ya existe un usuario con ese correo.');
      const nuevo: UsuarioAdminSimulado = {
        id: crypto.randomUUID(),
        correo,
        nombreCompleto: cuerpo.nombreCompleto?.trim() ?? '',
        cargo: null,
        rol: cuerpo.rol ?? 'Auditor',
        activo: true,
        tieneFirma: false,
        perfilCompleto: false,
        pendienteIngreso: true,
        creadoEn: new Date().toISOString(),
        ultimoAcceso: null,
        registros: 0,
      };
      lista.push(nuevo);
      return json(r, dto(nuevo));
    }
    const mm = /^\/admin\/usuarios\/([0-9a-f-]{36})\/(rol|activar|desactivar)$/.exec(ruta);
    const u = mm && lista.find((x) => x.id === mm[1]);
    if (!mm || !u) return json(r, { title: 'Usuario no encontrado.' }, 404);
    const rol = mm[2] === 'rol' ? (cuerpo.rol ?? u.rol) : u.rol;
    const activo = mm[2] === 'rol' ? u.activo : mm[2] === 'activar';
    if (u.id === usuario.id && !activo) return json(r, { status: 400, title: 'No puede desactivar su propia cuenta.' }, 400);
    if (u.id === usuario.id && u.rol === 'Administrador' && rol !== 'Administrador')
      return json(r, { status: 400, title: 'No puede quitarse a sí mismo el rol de Administrador.' }, 400);
    const admins = lista.filter((x) => x.activo && x.rol === 'Administrador').length;
    if (u.activo && u.rol === 'Administrador' && !(activo && rol === 'Administrador') && admins <= 1)
      return json(r, { status: 400, title: 'Debe quedar al menos un administrador activo.' }, 400);
    Object.assign(u, { rol, activo });
    return json(r, dto(u));
  }

  /** Como la API: mismo permiso que ver el registro; la nueva solicitud de un rol deja expirada la pendiente anterior. */
  function solicitudFirma(r: Route, m: string, id: string, cuerpo: { rol: string; usuarioDestinoId: string } | null) {
    const d = estado.fiscalizaciones.get(id);
    if (!d) return json(r, { title: 'Fiscalización no encontrada.' }, 404);
    if (m === 'GET') return json(r, estado.solicitudes.filter((s) => s.fiscalizacionId === id).map(({ fiscalizacionId: _, ...s }) => s));
    if (m !== 'POST' || !cuerpo) return json(r, { title: `No simulado: ${m}` }, 405);
    const destino = USUARIOS.find((u) => u.id === cuerpo.usuarioDestinoId);
    if (!destino) return json(r, { title: 'Usuario destino no encontrado.' }, 404);
    for (const s of estado.solicitudes) if (s.fiscalizacionId === id && s.rol === cuerpo.rol && s.estado === 'Pendiente') s.estado = 'Expirada';
    const creadaEn = new Date();
    const nueva: SolicitudSimulada = {
      id: crypto.randomUUID(),
      fiscalizacionId: id,
      rol: cuerpo.rol,
      usuarioDestinoId: destino.id,
      firmante: destino.nombreCompleto,
      correoFirmante: destino.correo,
      solicitadaPor: usuario.nombreCompleto,
      estado: 'Pendiente',
      comentario: null,
      creadaEn: creadaEn.toISOString(),
      expiraEn: new Date(creadaEn.getTime() + 7 * 86_400_000).toISOString(),
      firmadaEn: null,
    };
    estado.solicitudes.unshift(nueva);
    return json(r, {
      id: nueva.id,
      fiscalizacionId: id,
      numero: d.numero,
      rol: nueva.rol,
      solicitadaPor: nueva.solicitadaPor,
      creadaEn: nueva.creadaEn,
      expiraEn: nueva.expiraEn,
      estado: nueva.estado,
    });
  }

  /**
   * PDF oficial (como la API): vigente (409 si es borrador), de una versión (solo Administrador) y vista previa
   * con la marca «BORRADOR».
   */
  function pdfFiscalizacion(r: Route, ruta: string, id: string, tipo: string, version?: string) {
    const d = estado.fiscalizaciones.get(id);
    if (!d) return json(r, { title: 'Fiscalización no encontrada.' }, 404);
    estado.pdfs.push(ruta);
    const numero = String(d.numero ?? '');
    const borrador = d.estado === 'Borrador' || !d.versionActual;
    if (tipo === 'pdf' && borrador) return json(r, { status: 409, title: 'El registro todavía no está finalizado: use la vista previa.' }, 409);
    if (version && usuario.rol !== 'Administrador') return json(r, { title: 'Solo el administrador ve versiones anteriores.' }, 403);
    const corto = numero.split('-')[0] || 'borrador';
    const nombre = tipo === 'pdf/vista-previa' ? `Fiscalizacion-${corto}-vista-previa.pdf` : `Fiscalizacion-${corto}-v${version ?? String(d.versionActual)}.pdf`;
    const texto = tipo === 'pdf/vista-previa' && borrador ? `BORRADOR ${numero}` : `FISCALIZACION ${numero}`;
    return r.fulfill({
      status: 200,
      contentType: 'application/pdf',
      body: pdfDePrueba([{ t: 'texto', x: 28, y: 26, texto, tam: 10, negrita: true }], 612, 792),
      headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-disposition', 'content-disposition': `attachment; filename=${nombre}` },
    });
  }

  /** Plantillas: GET lista/detalle/pdf para todos; lo demás solo Administrador (403). */
  function plantilla(r: Route, m: string, ruta: string, url: URL) {
    const pl = estado.plantillas;
    if (m === 'GET' && ruta === '/plantillas') return json(r, pl.lista.map(pl.resumen));
    if (m !== 'GET' && usuario.rol !== 'Administrador') return json(r, { title: 'Prohibido' }, 403);
    const cuerpo = () => (r.request().postDataJSON() ?? {}) as Record<string, unknown>;
    if (m === 'POST' && ruta === '/plantillas') return json(r, pl.detalle(pl.nueva(String(cuerpo().nombre), false))!);
    if (m === 'POST' && ruta === '/plantillas/importar') return json(r, pl.detalle(pl.nueva('Plantilla importada', true))!);
    const mm = /^\/plantillas\/(\d+)(\/.*)?$/.exec(ruta);
    const p = mm && pl.lista.find((x) => x.id === Number(mm[1]));
    if (!p) return json(r, { title: 'Plantilla no encontrada' }, 404);
    const resto = mm[2] ?? '';
    if (m === 'GET' && resto === '') {
      const d = pl.detalle(p, Number(url.searchParams.get('version')) || undefined);
      return d ? json(r, d) : json(r, { title: 'Versión no encontrada' }, 404);
    }
    if (m === 'GET' && /^\/versiones\/\d+\/pdf$/.test(resto))
      return r.fulfill({ status: 200, contentType: 'application/pdf', body: pl.pdf, headers: { 'access-control-allow-origin': '*' } });
    if (m === 'POST' && resto === '/duplicar') {
      const origen = pl.borrador(p) ?? pl.publicada(p)!;
      return json(r, pl.detalle(pl.nueva(`${p.nombre} (copia)`, origen.pdf, origen.campos))!);
    }
    if (p.tipo === 'Oficial' && resto !== '/duplicar') return json(r, { status: 400, title: 'La plantilla oficial no se edita.' }, 400);
    if (m === 'PUT' && resto === '/borrador') {
      const c = cuerpo() as { nombre?: string | null; campos: CampoPlantillaDto[] };
      let b = pl.borrador(p);
      if (!b) {
        const v = pl.publicada(p)!;
        b = { ...v, version: v.version + 1, publicada: false, publicadaEn: null };
        p.versiones.push(b);
      }
      b.campos = c.campos;
      if (c.nombre) p.nombre = c.nombre;
      return json(r, pl.detalle(p)!);
    }
    if (m === 'POST' && resto === '/publicar') {
      const b = pl.borrador(p);
      if (!b) return json(r, { status: 400, title: 'No hay cambios por publicar.' }, 400);
      if (!b.campos.length) return json(r, { status: 400, title: 'Hay datos pendientes o inválidos.', errors: { campos: ['Agregue al menos un campo antes de publicar.'] } }, 400);
      Object.assign(b, { publicada: true, publicadaEn: new Date().toISOString() });
      p.estado = 'Activa';
      return json(r, pl.detalle(p)!);
    }
    if (m === 'POST' && (resto === '/desactivar' || resto === '/activar')) {
      p.estado = resto === '/activar' ? 'Activa' : 'Desactivada';
      return json(r, pl.detalle(p)!);
    }
    if (m === 'DELETE' && resto === '/borrador') {
      p.versiones = p.versiones.filter((v) => v.publicada);
      if (p.versiones.length) return json(r, pl.detalle(p)!);
      pl.lista.splice(pl.lista.indexOf(p), 1);
      return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
    }
    return json(r, { title: `No simulado: ${m} ${ruta}` }, 404);
  }
  return estado;
}
