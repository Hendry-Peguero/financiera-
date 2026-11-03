import type {
  CatalogosDto,
  EstadisticasDto,
  FiscalizacionDto,
  FiscalizacionResumenDto,
  ResumenInicioDto,
  SolicitudFirmaDto,
  SolicitudFirmaRegistroDto,
  UsuarioBusquedaDto,
  UsuarioDto,
  VersionDto,
} from '../../api/types';

/**
 * Datos de ejemplo del diseño (design-ref/html). Cada pantalla parte de ESCENARIO_BASE y sobrescribe lo que
 * cambia (p. ej. el avance del formulario #A3F9-21C0).
 */
export interface Escenario {
  /** null = sin sesión (pantalla de ingreso) */
  me: UsuarioDto | null;
  catalogos: CatalogosDto;
  inicio: ResumenInicioDto;
  /** Lista de GET /fiscalizaciones (Historial, Actividad reciente) */
  lista: FiscalizacionResumenDto[];
  /** total que informa la API para la lista sin filtros (126 en el diseño) */
  totalLista: number;
  conteos: Record<string, number>;
  /** GET /fiscalizaciones?enPapelera=true */
  papelera: FiscalizacionResumenDto[];
  /** GET /fiscalizaciones/{id} */
  detalle: Record<string, FiscalizacionDto>;
  versiones: Record<string, VersionDto[]>;
  estadisticas: EstadisticasDto;
  solicitudes: SolicitudFirmaDto[];
  /** GET /fiscalizaciones/{id}/solicitudes-firma */
  solicitudesRegistro: Record<string, SolicitudFirmaRegistroDto[]>;
  usuarios: UsuarioBusquedaDto[];
  /** GET /fiscalizaciones/{id}/fotos/{fotoId} → PNG */
  fotos: Record<string, Uint8Array>;
  /** GET /me/firma (PNG base64) */
  meFirma: string | null;
}

export const ID_USUARIO = '11111111-1111-4111-8111-111111111111';

export const MARIA: UsuarioDto = {
  id: ID_USUARIO,
  correo: 'soporte.scav@hidroelectrica.gov.do',
  nombreCompleto: 'María Rosario Peña',
  cargo: 'Auditora de campo',
  rol: 'Administrador',
  tieneFirma: true,
  esPropietarioBitacora: false,
  perfilCompleto: true,
};

/** Guid estable para un número visible («A3F9-21C0» → «a3f921c0-0000-4000-8000-000000000000»). */
export function idDe(numero: string): string {
  const h = numero.replace('-', '').toLowerCase().padEnd(8, '0');
  return `${h}-0000-4000-8000-000000000000`;
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
];

export const CATALOGOS: CatalogosDto = {
  locaciones: [
    { id: 1, nombre: 'C.H. Jigüey', provincia: 'Ocoa' },
    { id: 2, nombre: 'C.H. Aguacate', provincia: 'Ocoa' },
    { id: 3, nombre: 'C.H. Valdesia', provincia: 'Peravia' },
    { id: 4, nombre: 'C.H. Tavera', provincia: 'Santiago' },
    { id: 5, nombre: 'C.H. Monción', provincia: 'Santiago Rodríguez' },
    { id: 6, nombre: 'C.H. Jimenoa', provincia: 'La Vega' },
    { id: 7, nombre: 'C.H. Rincón', provincia: 'La Vega' },
    { id: 8, nombre: 'C.H. Hatillo', provincia: 'Sánchez Ramírez' },
    { id: 9, nombre: 'C.H. Pinalito', provincia: 'Monseñor Nouel' },
    { id: 10, nombre: 'C.H. Palomino', provincia: 'San Juan' },
    { id: 11, nombre: 'C.H. Sabaneta', provincia: 'San Juan' },
    { id: 12, nombre: 'C.H. Las Barías', provincia: 'Peravia' },
  ],
  suplidores: [
    { id: 1, nombre: 'Sunix Petroleum, S.R.L.' },
    { id: 2, nombre: 'Isla Dominicana S.R.L.' },
    { id: 3, nombre: 'Texaco Caribbean' },
    { id: 4, nombre: 'Gulf Dominicana' },
  ],
  productos: [{ id: 1, nombre: 'Gasoil óptimo', unidad: 'gal' }],
  preguntasControl: PREGUNTAS.map((texto, i) => ({
    numero: i + 1,
    texto,
    observacionObligatoriaSiSi: [6, 11, 12].includes(i + 1),
    tipoObservacion: i + 1 === 10 ? 'Fecha' : 'Texto',
  })),
};

type Fila = [string, string, string, string, string, number | null, number | null, number | null, number, FiscalizacionResumenDto['estado'], boolean?];

/** Filas del Historial (desktop-historial.html). */
const FILAS: Fila[] = [
  ['A3F9-21C0', '2026-10-20', 'C.H. Jigüey', 'Sunix Petroleum', 'María Rosario', 4212.4, 4200.0, -12.4, 1, 'Finalizado'],
  ['7C21-9A04', '2026-10-19', 'C.H. Aguacate', 'Isla Dominicana', 'Ana L. Pérez', 3850.0, 3850.0, 0, 0, 'Borrador'],
  ['5E0B-3D77', '2026-10-18', 'C.H. Valdesia', 'Texaco Caribbean', 'José M. Guzmán', 6148.75, 6100.0, -48.75, 3, 'Modificado'],
  ['91D4-0B12', '2026-10-17', 'C.H. Tavera', 'Sunix Petroleum', 'María Rosario', 2953.1, 2950.0, -3.1, 1, 'Finalizado'],
  ['2B6A-77E1', '2026-10-16', 'C.H. Monción', 'Gulf Dominicana', 'Ana L. Pérez', 5471.2, 5400.0, -71.2, 2, 'EdicionPendiente'],
  ['C08E-5F30', '2026-10-15', 'C.H. Jimenoa', 'Isla Dominicana', 'Luis Ferreras', 1780.0, null, null, 0, 'Borrador'],
  ['E44F-2C9B', '2026-10-14', 'C.H. Rincón', 'Texaco Caribbean', 'José M. Guzmán', 3306.05, 3300.0, -6.05, 1, 'Finalizado'],
  ['0FA2-8E6D', '2026-10-13', 'C.H. Hatillo', 'Sunix Petroleum', 'María Rosario', 4765.6, 4750.0, -15.6, 1, 'Finalizado'],
  ['B812-4A50', '2026-10-11', 'C.H. Pinalito', 'Gulf Dominicana', 'Luis Ferreras', 0, 2100.0, 2100.0, 1, 'Finalizado'],
  ['D7C3-1F08', '2026-10-10', 'C.H. Palomino', 'Sunix Petroleum', 'Ana L. Pérez', 3980.0, 3975.5, -4.5, 2, 'Modificado'],
  ['4A19-6B2E', '2026-10-08', 'C.H. Sabaneta', 'Isla Dominicana', 'José M. Guzmán', 2450.0, 2450.0, 0, 1, 'Finalizado', true],
];

export const LISTA: FiscalizacionResumenDto[] = FILAS.map(
  ([numero, fecha, locacion, suplidor, autor, galonesProveedor, galonesEgehid, diferenciaGal, version, estado, enPapelera]) => ({
    id: idDe(numero),
    numero,
    fecha,
    locacion,
    suplidor,
    autor,
    galonesProveedor,
    galonesEgehid,
    diferenciaGal,
    version,
    estado,
    enPapelera: !!enPapelera,
  }),
);

export const CONTEOS = { todos: 126, Borrador: 5, Finalizado: 109, Modificado: 9, EdicionPendiente: 1, papelera: 2 };

/** Resumen de Inicio (desktop-inicio.html): 48 / 5 / 182,450 / 3. */
export const INICIO: ResumenInicioDto = {
  finalizadosMes: 48,
  finalizadosMesAnterior: 42,
  borradores: 5,
  borradoresFirmasIncompletas: 2,
  galonesMes: 182450,
  avisos: [
    {
      fiscalizacionId: idDe('2B6A-77E1'),
      numero: '2B6A-77E1',
      locacion: 'C.H. Monción',
      tipo: 'DiferenciaMayor1Pct',
      mensaje: 'Diferencia de 1.32 % sobre lo declarado por el proveedor',
    },
    {
      fiscalizacionId: idDe('5E0B-3D77'),
      numero: '5E0B-3D77',
      locacion: 'C.H. Valdesia',
      tipo: 'SobreMediana',
      mensaje: 'Entrega 162 % sobre la mediana de las últimas 5',
    },
    {
      fiscalizacionId: idDe('B812-4A50'),
      numero: 'B812-4A50',
      locacion: 'C.H. Pinalito',
      tipo: 'ProveedorCero',
      mensaje: 'Proveedor en cero con medición EGEHID positiva',
    },
  ],
  recientes: [],
};

export const ESTADISTICAS_VACIAS: EstadisticasDto = {
  total: 0,
  galonesProveedor: 0,
  galonesEgehid: 0,
  diferencia: 0,
  diferenciaPct: null,
  series: [],
  porLocacion: [],
  avisos: [],
};

export function escenarioBase(): Escenario {
  return {
    me: MARIA,
    catalogos: CATALOGOS,
    inicio: INICIO,
    lista: LISTA,
    totalLista: 126,
    conteos: CONTEOS,
    papelera: [],
    detalle: {},
    versiones: {},
    estadisticas: ESTADISTICAS_VACIAS,
    solicitudes: [],
    solicitudesRegistro: {},
    usuarios: [],
    fotos: {},
    meFirma: null,
  };
}
