// Tipos del contrato de la API (docs/API-CONTRATO.md). JSON camelCase.

export type Rol = 'Administrador' | 'Auditor' | 'Firmante';
export type EstadoFiscalizacion = 'Borrador' | 'Finalizado' | 'Modificado' | 'EdicionPendiente';
export type Equipo = 'MedidorDigital' | 'Dispensador' | 'Electrobomba';
export type RolFirma =
  | 'AuditorActuante1'
  | 'AuditorActuante2'
  | 'EncargadoRecibir'
  | 'SupervisorCombustibles'
  | 'RepresentanteProveedor'
  | 'AuditorCierre1'
  | 'AuditorCierre2'
  | 'AuditorUai';
export type ModoFirma = 'Predeterminada' | 'EnSuEquipo' | 'EnEstaTablet';
export type EstadoSolicitud = 'Pendiente' | 'Firmada' | 'Rechazada' | 'Expirada';
export type TipoEventoUi = 'click' | 'navegacion' | 'envio' | 'error' | 'online' | 'offline';

export interface UsuarioDto {
  id: string;
  correo: string;
  /** Puede venir vacío ("") en el primer ingreso. */
  nombreCompleto: string;
  cargo: string | null;
  rol: Rol;
  tieneFirma: boolean;
  esPropietarioBitacora: boolean;
  perfilCompleto: boolean;
}

export interface LocacionDto { id: number; nombre: string; provincia: string | null }
export interface SuplidorDto { id: number; nombre: string }
export interface ProductoDto { id: number; nombre: string; unidad: string }
export interface PreguntaControlDto {
  numero: number;
  texto: string;
  observacionObligatoriaSiSi: boolean;
  tipoObservacion: 'Texto' | 'Fecha';
}
export interface CatalogosDto {
  locaciones: LocacionDto[];
  suplidores: SuplidorDto[];
  productos: ProductoDto[];
  preguntasControl: PreguntaControlDto[];
}

export interface VisitaDto {
  fecha: string | null;
  horaSalida: string | null;
  inicioProceso: string | null;
  locacionId: number | null;
  horaLlegada: string | null;
  finProceso: string | null;
}
export interface SuplidorDatosDto {
  fichaCamion: string | null;
  chofer: string | null;
  placa: string | null;
  conduce: string | null;
  /** Empresa suplidora en texto libre; la API la enlaza al catálogo (suplidorId) al guardar. */
  nombre?: string | null;
  suplidorId: number | null;
  totalEntregarGal: number | null;
}
/** Dos pares Ficha camión / Chofer de la empresa (el 1 es opcional: no existe en borradores anteriores). */
export interface EmpresaDatosDto {
  fichaCamion1?: string | null;
  chofer1?: string | null;
  fichaCamion2: string | null;
  chofer2: string | null;
  responsable: string | null;
  totalRecibirGal: number | null;
}
export interface LecturaDto { equipo: Equipo; inicial: number | null; final: number | null }
export interface VaraDto {
  inicialMedida: string | null;
  inicialGalones: number | null;
  finalMedida: string | null;
  finalGalones: number | null;
}
export interface MedicionesDto {
  productoId: number | null;
  galonesProveedor: number | null;
  galonesEgehid: number | null;
  precioGalon: number | null;
  lecturas: LecturaDto[];
  vara: VaraDto;
}
export interface CalculosDto {
  diferenciaGal: number | null;
  diferenciaPct: number | null;
  importeProveedor: number | null;
  importeEgehid: number | null;
  diferenciaImporte: number | null;
}
export interface RespuestaControlDto { numero: number; respuesta: boolean | null; observacion: string | null }
/** `sha256`: huella del archivo guardado en el servidor (la tablet la compara con la suya). */
export interface FotoDto { id: string; orden: number; descripcion: string | null; tamanoBytes: number; sha256?: string | null }
export interface FirmaDto {
  rol: RolFirma;
  nombreFirmante: string;
  cedula: string | null;
  modo: ModoFirma;
  firmadoEn: string;
  usuarioId: string | null;
}

export interface FiscalizacionDto {
  id: string;
  numero?: string | null;
  estado?: EstadoFiscalizacion;
  versionActual?: number;
  rowVersion: string | null;
  autor?: { id: string; nombreCompleto: string } | null;
  creadoEn?: string | null;
  actualizadoEn?: string | null;
  visita: VisitaDto;
  suplidor: SuplidorDatosDto;
  empresa: EmpresaDatosDto;
  mediciones: MedicionesDto;
  calculos?: CalculosDto | null;
  controles: RespuestaControlDto[];
  observacionesGenerales: string | null;
  fotos?: FotoDto[];
  firmas?: FirmaDto[];
  enPapelera?: boolean;
  pendientes?: PendientesDto | null;
}

/** Claves de `pendientes` (la API real siempre trae las 6). */
export type SeccionPendiente = 'visita' | 'suplidor' | 'mediciones' | 'controles' | 'fotos' | 'firmas';
export type PendientesDto = Record<SeccionPendiente, string[]>;

/** Cuerpo del PUT /fiscalizaciones/{id} y POST /{id}/corregir (FiscalizacionEntradaDto): sin solo lectura. */
export type FiscalizacionPut = Pick<
  FiscalizacionDto,
  'rowVersion' | 'visita' | 'suplidor' | 'empresa' | 'mediciones' | 'controles' | 'observacionesGenerales'
>;

export interface FiscalizacionResumenDto {
  id: string;
  numero: string;
  fecha: string | null;
  locacion: string | null;
  suplidor: string | null;
  autor: string;
  galonesProveedor: number | null;
  galonesEgehid: number | null;
  diferenciaGal: number | null;
  version: number;
  estado: EstadoFiscalizacion;
  enPapelera: boolean;
}

export interface Pagina<T> {
  items: T[];
  total: number;
  pagina: number;
  tamano: number;
}

export type ClaveConteo = 'todos' | EstadoFiscalizacion | 'papelera';

export interface PaginaFiscalizaciones extends Pagina<FiscalizacionResumenDto> {
  /** Claves reales: todos, papelera, Borrador, Finalizado, Modificado, EdicionPendiente. */
  conteos: Partial<Record<ClaveConteo, number>>;
}

export interface SolicitudFirmaDto {
  id: string;
  fiscalizacionId: string;
  numero: string;
  rol: RolFirma;
  solicitadaPor: string;
  creadaEn: string;
  expiraEn: string;
  estado: EstadoSolicitud;
}

/** GET /fiscalizaciones/{id}/solicitudes-firma (más reciente primero). */
export interface SolicitudFirmaRegistroDto {
  id: string;
  rol: RolFirma;
  usuarioDestinoId: string;
  firmante: string;
  correoFirmante: string;
  solicitadaPor: string;
  /** Una pendiente vencida llega como `Expirada`. */
  estado: EstadoSolicitud;
  /** Motivo del rechazo. */
  comentario: string | null;
  creadaEn: string;
  expiraEn: string;
  firmadaEn: string | null;
}

export interface UsuarioBusquedaDto { id: string; nombreCompleto: string; cargo: string | null; tieneFirma: boolean }

export interface VersionDto {
  version: number;
  creadoEn: string;
  creadoPor: string;
  resumen: string | null;
  vigente: boolean;
  cambios: { campo: string; valorAnterior: string | null; valorNuevo: string | null }[];
}

export type TipoAviso = 'DiferenciaMayor1Pct' | 'ProveedorCero' | 'SobreMediana';
export interface AvisoDto { fiscalizacionId: string; numero: string; locacion: string | null; tipo: TipoAviso; mensaje: string }

export interface ResumenInicioDto {
  finalizadosMes: number;
  finalizadosMesAnterior: number;
  borradores: number;
  borradoresFirmasIncompletas: number;
  galonesMes: number;
  avisos: AvisoDto[];
  recientes: FiscalizacionResumenDto[];
}

export interface EstadisticasDto {
  total: number;
  galonesProveedor: number;
  galonesEgehid: number;
  diferencia: number;
  diferenciaPct: number | null;
  series: { periodo: string; proveedor: number; egehid: number }[];
  porLocacion: { locacion: string; galones: number }[];
  avisos: AvisoDto[];
}

export interface EventoUiDto {
  idCliente: string;
  momento: string;
  sesionId: string;
  tipo: TipoEventoUi;
  ruta: string;
  elemento: string | null;
  detalle: Record<string, unknown> | null;
  dispositivo: string;
}

// Bitácora (solo propietario). Filas tal cual las tablas (API real). Momentos sin zona = UTC.
export interface BitacoraUiDto {
  id: number;
  idCliente: string;
  momento: string;
  recibidoEn: string;
  usuarioId: string | null;
  correo: string | null;
  sesionId: string;
  tipo: string;
  ruta: string | null;
  elemento: string | null;
  /** JSON serializado como texto */
  detalle: string | null;
  dispositivo: string | null;
}
export interface BitacoraApiDto {
  id: number;
  momento: string;
  usuarioId: string | null;
  correo: string | null;
  metodo: string;
  ruta: string;
  query: string | null;
  statusCode: number;
  duracionMs: number;
  ip: string | null;
  userAgent: string | null;
  correlationId: string | null;
}
export interface BitacoraCambioDto {
  id: number;
  momento: string;
  usuarioId: string | null;
  correo: string | null;
  entidad: string;
  entidadId: string;
  accion: 'Crear' | 'Modificar' | 'Eliminar';
  /** JSON serializado como texto */
  valoresAnteriores: string | null;
  valoresNuevos: string | null;
  correlationId: string | null;
}

export interface FirmaEntradaDto {
  nombreFirmante: string | null;
  cedula: string | null;
  modo: ModoFirma;
  imagenBase64: string | null;
}
