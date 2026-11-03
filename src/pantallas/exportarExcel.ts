import type { EstadisticasDto, FiscalizacionResumenDto, TipoAviso } from '../api/types';
import { nombreEstado } from '../ui/comunes';

/** Formatos de número de Excel (la celda guarda el número; Excel lo muestra con el formato). */
export type Formato = 'texto' | 'entero' | 'galones' | 'pct' | 'dinero' | 'fecha';

const FORMATOS: Record<Exclude<Formato, 'texto'>, string> = {
  entero: '#,##0',
  galones: '#,##0.00',
  // los porcentajes se guardan como fracción (−0.29 % → −0.0029)
  pct: '0.00%',
  dinero: '"RD$" #,##0.00;-"RD$" #,##0.00',
  fecha: 'dd/mm/yyyy',
};

/** Celda con un formato distinto al de su columna (hoja «Resumen»). */
export interface CeldaConFormato {
  valor: number | null;
  formato: Formato;
}
export type Celda = string | number | Date | null | CeldaConFormato;

export interface Columna {
  titulo: string;
  /** Ancho en caracteres. */
  ancho: number;
  formato?: Formato;
}

export interface Hoja {
  nombre: string;
  columnas: Columna[];
  filas: Celda[][];
  /** Autofiltro en el encabezado (por defecto sí). */
  filtro?: boolean;
}

/** yyyy-MM-dd → Date en UTC (Excel guarda la fecha sin zona; en UTC no se corre un día). */
export function fechaExcel(iso: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
}

/** Porcentaje de la API (−0.29) → fracción de Excel (−0.0029). */
function fraccion(p: number | null | undefined): number | null {
  return p == null ? null : p / 100;
}

export function hojaHistorial(items: FiscalizacionResumenDto[]): Hoja {
  return {
    nombre: 'Fiscalizaciones',
    columnas: [
      { titulo: 'N.º', ancho: 12 },
      { titulo: 'Fecha', ancho: 12, formato: 'fecha' },
      { titulo: 'Destino', ancho: 28 },
      { titulo: 'Suplidor', ancho: 26 },
      { titulo: 'Autor', ancho: 24 },
      { titulo: 'Proveedor (gal)', ancho: 16, formato: 'galones' },
      { titulo: 'EGEHID (gal)', ancho: 16, formato: 'galones' },
      { titulo: 'Diferencia (gal)', ancho: 16, formato: 'galones' },
      { titulo: 'Diferencia (%)', ancho: 15, formato: 'pct' },
      { titulo: 'Revisión', ancho: 10, formato: 'entero' },
      { titulo: 'Estado', ancho: 20 },
    ],
    filas: items.map((f) => [
      f.numero,
      fechaExcel(f.fecha),
      f.locacion,
      f.suplidor,
      f.autor,
      f.galonesProveedor,
      f.galonesEgehid,
      f.diferenciaGal,
      // mismo cálculo que el formulario: diferencia sobre lo declarado por el proveedor
      f.diferenciaGal != null && f.galonesProveedor ? f.diferenciaGal / f.galonesProveedor : null,
      f.version || null,
      nombreEstado(f.enPapelera ? 'Papelera' : f.estado),
    ]),
  };
}

const TIPO_AVISO: Record<TipoAviso, string> = {
  DiferenciaMayor1Pct: 'Diferencia mayor de 1 %',
  ProveedorCero: 'Proveedor sin galones',
  SobreMediana: 'Sobre la mediana',
};

export interface FiltroExcelEstadisticas {
  desde?: string;
  hasta?: string;
  locacion: string;
  agrupar: string;
}

/** Indicadores, galones por periodo, por locación y avisos: lo mismo que muestra la pantalla. */
export function hojasEstadisticas(e: EstadisticasDto, f: FiltroExcelEstadisticas): Hoja[] {
  const prom = (g: number) => (e.total ? g / e.total : null);
  const totalLoc = e.porLocacion.reduce((s, l) => s + l.galones, 0);
  const c = (valor: number | null, formato: Formato): CeldaConFormato => ({ valor, formato });
  return [
    {
      nombre: 'Resumen',
      filtro: false,
      columnas: [
        { titulo: 'Indicador', ancho: 34 },
        { titulo: 'Valor', ancho: 20 },
      ],
      filas: [
        ['Desde', fechaExcel(f.desde)],
        ['Hasta', fechaExcel(f.hasta)],
        ['Locación', f.locacion],
        ['Agrupado por', f.agrupar],
        ['Adquisiciones fiscalizadas', c(e.total, 'entero')],
        ['Galones según proveedor', c(e.galonesProveedor, 'galones')],
        ['Galones medidos EGEHID', c(e.galonesEgehid, 'galones')],
        ['Diferencia acumulada (gal)', c(e.diferencia, 'galones')],
        ['Diferencia sobre lo declarado', c(fraccion(e.diferenciaPct), 'pct')],
        ['Promedio proveedor por entrega (gal)', c(prom(e.galonesProveedor), 'galones')],
        ['Promedio EGEHID por entrega (gal)', c(prom(e.galonesEgehid), 'galones')],
        ['Avisos para revisión', c(e.avisos.length, 'entero')],
      ],
    },
    {
      nombre: 'Por periodo',
      columnas: [
        { titulo: 'Periodo', ancho: 16 },
        { titulo: 'Proveedor (gal)', ancho: 16, formato: 'galones' },
        { titulo: 'EGEHID (gal)', ancho: 16, formato: 'galones' },
        { titulo: 'Diferencia (gal)', ancho: 16, formato: 'galones' },
        { titulo: 'Diferencia (%)', ancho: 15, formato: 'pct' },
      ],
      filas: e.series.map((s) => [
        s.periodo,
        s.proveedor,
        s.egehid,
        s.egehid - s.proveedor,
        s.proveedor ? (s.egehid - s.proveedor) / s.proveedor : null,
      ]),
    },
    {
      nombre: 'Por locación',
      columnas: [
        { titulo: 'Locación', ancho: 30 },
        { titulo: 'EGEHID (gal)', ancho: 16, formato: 'galones' },
        { titulo: '% del total', ancho: 12, formato: 'pct' },
      ],
      filas: e.porLocacion.map((l) => [l.locacion, l.galones, totalLoc ? l.galones / totalLoc : null]),
    },
    {
      nombre: 'Avisos',
      columnas: [
        { titulo: 'N.º', ancho: 12 },
        { titulo: 'Locación', ancho: 28 },
        { titulo: 'Tipo', ancho: 24 },
        { titulo: 'Detalle', ancho: 60 },
      ],
      filas: e.avisos.map((a) => [a.numero, a.locacion, TIPO_AVISO[a.tipo] ?? a.tipo, a.mensaje]),
    },
  ];
}

function esConFormato(v: Celda): v is CeldaConFormato {
  return v != null && typeof v === 'object' && !(v instanceof Date);
}

/**
 * Arma el .xlsx (encabezado en negrita con fondo, anchos, formatos, encabezado fijo y autofiltro) y lo descarga.
 * exceljs se carga aquí, solo al exportar: no entra en el paquete principal.
 */
export async function descargarXlsx(nombre: string, hojas: Hoja[]) {
  const { default: ExcelJS } = await import('exceljs');
  const libro = new ExcelJS.Workbook();
  libro.creator = 'EGEHID · Fiscalización de combustible';
  libro.created = new Date();
  for (const h of hojas) {
    const ws = libro.addWorksheet(h.nombre, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = h.columnas.map((c) => ({
      header: c.titulo,
      width: c.ancho,
      style: c.formato && c.formato !== 'texto' ? { numFmt: FORMATOS[c.formato] } : {},
    }));
    const cab = ws.getRow(1);
    cab.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cab.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B4F8A' } };
    cab.alignment = { vertical: 'middle' };
    cab.height = 20;
    for (const fila of h.filas) {
      const r = ws.addRow(fila.map((v) => (esConFormato(v) ? v.valor : v)));
      fila.forEach((v, i) => {
        const formato = esConFormato(v) ? v.formato : v instanceof Date ? 'fecha' : null;
        if (formato && formato !== 'texto') r.getCell(i + 1).numFmt = FORMATOS[formato];
      });
    }
    if (h.filtro !== false && h.filas.length) {
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: h.filas.length + 1, column: h.columnas.length } };
    }
  }
  const datos = await libro.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([datos], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
