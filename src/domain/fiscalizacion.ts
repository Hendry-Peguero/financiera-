import type {
  CatalogosDto,
  Equipo,
  FiscalizacionDto,
  FiscalizacionPut,
  PreguntaControlDto,
  RolFirma,
} from '../api/types';
import { hoyIso } from './format';

export const EQUIPOS: { equipo: Equipo; nombre: string }[] = [
  { equipo: 'MedidorDigital', nombre: 'Medidor volumétrico digital' },
  { equipo: 'Dispensador', nombre: 'Dispensador' },
  { equipo: 'Electrobomba', nombre: 'Electrobomba' },
];

/** Roles de firma. `requerida` = firmas exigidas por la API para finalizar. */
export const ROLES_FIRMA: { rol: RolFirma; nombre: string; grupo: 'participante' | 'cierre'; requerida: boolean }[] = [
  { rol: 'AuditorActuante1', nombre: 'Auditor actuante 1', grupo: 'participante', requerida: true },
  { rol: 'AuditorActuante2', nombre: 'Auditor actuante 2', grupo: 'participante', requerida: false },
  { rol: 'EncargadoRecibir', nombre: 'Encargado de recibir', grupo: 'participante', requerida: true },
  { rol: 'SupervisorCombustibles', nombre: 'Supervisor de combustibles', grupo: 'participante', requerida: true },
  { rol: 'RepresentanteProveedor', nombre: 'Representante del proveedor', grupo: 'participante', requerida: true },
  { rol: 'InspectorActuante', nombre: 'Inspector actuante', grupo: 'cierre', requerida: false },
  { rol: 'RevisadoPor', nombre: 'Revisado por', grupo: 'cierre', requerida: false },
];

export const FIRMAS_REQUERIDAS: RolFirma[] = ROLES_FIRMA.filter((r) => r.requerida).map((r) => r.rol);

export function nombreRol(rol: RolFirma): string {
  if (rol === 'AuditorUai') return 'Auditor UAI'; // solo en registros del modelo anterior
  return ROLES_FIRMA.find((r) => r.rol === rol)?.nombre ?? rol;
}

const TEXTOS_PREGUNTAS = [
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
];

/** Preguntas por defecto (diseño) mientras no haya catálogo en caché. */
export const PREGUNTAS_POR_DEFECTO: PreguntaControlDto[] = TEXTOS_PREGUNTAS.map((texto, i) => ({
  numero: i + 1,
  texto,
  observacionObligatoriaSiSi: [6, 11, 12].includes(i + 1),
  tipoObservacion: i + 1 === 10 ? 'Fecha' : 'Texto',
}));

export const CATALOGOS_VACIOS: CatalogosDto = {
  locaciones: [],
  suplidores: [],
  productos: [],
  preguntasControl: PREGUNTAS_POR_DEFECTO,
};

export function preguntasDe(c: CatalogosDto | undefined | null): PreguntaControlDto[] {
  const p = c?.preguntasControl;
  return p && p.length ? [...p].sort((a, b) => a.numero - b.numero) : PREGUNTAS_POR_DEFECTO;
}

export function nuevoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function nuevaFiscalizacion(id = nuevoId(), hoy = hoyIso()): FiscalizacionDto {
  return {
    id,
    numero: null,
    estado: 'Borrador',
    versionActual: 0,
    rowVersion: null,
    visita: { fecha: hoy, horaSalida: null, inicioProceso: null, locacionId: null, horaLlegada: null, finProceso: null },
    suplidor: { fichaCamion: null, chofer: null, placa: null, conduce: null, nombre: null, suplidorId: null, totalEntregarGal: null },
    empresa: { fichaCamion1: null, chofer1: null, fichaCamion2: null, chofer2: null, responsable: null, totalRecibirGal: null },
    mediciones: {
      productoId: null,
      galonesProveedor: null,
      galonesEgehid: null,
      precioGalon: null,
      lecturas: EQUIPOS.map((e) => ({ equipo: e.equipo, inicial: null, final: null })),
      vara: { inicialMedida: null, inicialGalones: null, finalMedida: null, finalGalones: null },
    },
    controles: Array.from({ length: 12 }, (_, i) => ({ numero: i + 1, respuesta: null, observacion: null })),
    observacionesGenerales: null,
    fotos: [],
    firmas: [],
  };
}

/** Completa estructuras faltantes (p. ej. un DTO del servidor sin lecturas o con controles parciales). */
export function normalizar(dto: FiscalizacionDto): FiscalizacionDto {
  const base = nuevaFiscalizacion(dto.id, dto.visita?.fecha ?? hoyIso());
  const lecturas = EQUIPOS.map(
    (e) => dto.mediciones?.lecturas?.find((l) => l.equipo === e.equipo) ?? { equipo: e.equipo, inicial: null, final: null },
  );
  const controles = base.controles.map((c) => dto.controles?.find((x) => x.numero === c.numero) ?? c);
  return {
    ...base,
    ...dto,
    visita: { ...base.visita, ...dto.visita },
    suplidor: { ...base.suplidor, ...dto.suplidor },
    empresa: { ...base.empresa, ...dto.empresa },
    mediciones: {
      ...base.mediciones,
      ...dto.mediciones,
      lecturas,
      vara: { ...base.mediciones.vara, ...dto.mediciones?.vara },
    },
    controles,
    observacionesGenerales: dto.observacionesGenerales ?? null,
    fotos: dto.fotos ?? [],
    firmas: dto.firmas ?? [],
  };
}

/** Campos que solo cambia el servidor (no se editan en la tablet). */
export function camposServidor(dto: FiscalizacionDto): Partial<FiscalizacionDto> {
  return {
    numero: dto.numero,
    estado: dto.estado,
    versionActual: dto.versionActual,
    rowVersion: dto.rowVersion,
    autor: dto.autor,
    creadoEn: dto.creadoEn,
    actualizadoEn: dto.actualizadoEn,
    enPapelera: dto.enPapelera,
    calculos: dto.calculos,
    fotos: dto.fotos,
    firmas: dto.firmas,
    pendientes: dto.pendientes,
  };
}

/**
 * Une lo editable de `editado` con lo que solo cambia el servidor de `base`.
 * Evita que un estado de React viejo pise el rowVersion vigente guardado tras sincronizar.
 */
export function fusionarEditable(base: FiscalizacionDto, editado: FiscalizacionDto): FiscalizacionDto {
  return { ...editado, ...camposServidor(base) };
}

/** Cuerpo del PUT /fiscalizaciones/{id}: sin campos de solo lectura. */
export function aCuerpoPut(dto: FiscalizacionDto): FiscalizacionPut {
  return {
    rowVersion: dto.rowVersion ?? null,
    visita: dto.visita,
    suplidor: dto.suplidor,
    empresa: dto.empresa,
    mediciones: dto.mediciones,
    controles: dto.controles,
    observacionesGenerales: dto.observacionesGenerales,
  };
}

/** Número a mostrar: el del servidor o uno provisional con el inicio del Guid. */
export function numeroVisible(dto: Pick<FiscalizacionDto, 'id' | 'numero'>): string {
  return dto.numero ?? `${dto.id.slice(0, 4).toUpperCase()}-${dto.id.slice(4, 8).toUpperCase()}`;
}

/** Nombre de la empresa suplidora: el escrito en el registro o, si no hay, el del catálogo. */
export function nombreSuplidor(
  s: Pick<FiscalizacionDto['suplidor'], 'nombre' | 'suplidorId'>,
  cat: Pick<CatalogosDto, 'suplidores'> | undefined | null,
): string | undefined {
  return s.nombre?.trim() || cat?.suplidores.find((x) => x.id === s.suplidorId)?.nombre;
}

/** Nombre para comparar con el catálogo: sin acentos, en minúsculas y con un solo espacio (como la API). */
export function claveNombre(n: string): string {
  return n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(' ').filter(Boolean).join(' ');
}
