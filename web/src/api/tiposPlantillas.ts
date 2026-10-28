/** Plantillas de formularios (fase 3). Contrato: docs/API-CONTRATO.md, sección «Plantillas». Sin imports: lo usan también los fixtures de e2e. */
export type TipoCampo = 'Texto' | 'Numero' | 'Fecha' | 'Casilla' | 'Firma' | 'Formula';
export type TipoPlantilla = 'Oficial' | 'Personalizada';
export type EstadoPlantilla = 'Activa' | 'Borrador' | 'Desactivada';

/** Medidas en puntos PDF, con el origen arriba a la izquierda de la página. */
export interface CampoPlantillaDto {
  identificador: string;
  etiqueta: string;
  tipo: TipoCampo;
  formula: string | null;
  pagina: number;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  obligatorio: boolean;
  enEstadisticas: boolean;
  imprimirPdf: boolean;
}

export interface PaginaDto {
  ancho: number;
  alto: number;
}

/** `version` = publicada vigente (0 si nunca se publicó); `versionBorrador` = la que está en edición. */
export interface PlantillaResumenDto {
  id: number;
  nombre: string;
  tipo: TipoPlantilla;
  estado: EstadoPlantilla;
  version: number;
  versionBorrador: number | null;
  totalCampos: number;
  publicadaEn: string | null;
}

export interface VersionPlantillaDto {
  version: number;
  publicada: boolean;
  publicadaEn: string | null;
  totalCampos: number;
  tienePdf: boolean;
}

export interface PlantillaVersionDto {
  version: number;
  publicada: boolean;
  publicadaEn: string | null;
  tienePdf: boolean;
  paginas: PaginaDto[];
  campos: CampoPlantillaDto[];
}

export interface PlantillaDto {
  id: number;
  nombre: string;
  tipo: TipoPlantilla;
  estado: EstadoPlantilla;
  version: number;
  versionBorrador: number | null;
  /** Administrador y plantilla no oficial. */
  editable: boolean;
  versiones: VersionPlantillaDto[];
  actual: PlantillaVersionDto;
  encabezado: EncabezadoPlantillaDto;
}

/** Control de documentos que se imprime en el encabezado del formulario (fechas yyyy-MM-dd). */
export interface EncabezadoPlantillaDto {
  codigo: string | null;
  version: string | null;
  fechaElaboracion: string | null;
  fechaAprobacion: string | null;
}
