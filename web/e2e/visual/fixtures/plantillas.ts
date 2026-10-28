import type { CampoPlantillaDto, PlantillaDto, PlantillaResumenDto, TipoCampo } from '../../../src/api/tiposPlantillas';

/**
 * Plantillas del diseño (desktop-plantillas.html): «Recepción de lubricantes» con su PDF base (440 × 600 pt, el
 * tamaño de la página del diseño) y el campo «diferencia». El PDF se genera aquí con texto Helvetica y rectángulos.
 */
export type ElementoPdf =
  | { t: 'texto'; x: number; y: number; texto: string; tam?: number; negrita?: boolean }
  | { t: 'linea'; x: number; y: number; ancho: number; alto?: number; color?: string }
  | { t: 'caja'; x: number; y: number; ancho: number; alto: number };

const TEXTO = '0.090 0.169 0.302'; // --text #172b4d
const LINEA = '0.604 0.647 0.710'; // --muted-2 #9aa5b5

const rgb = (hex: string) =>
  [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(3)).join(' ');

/** Texto WinAnsi (latin-1) escapado para un string PDF. */
const literal = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);

/** PDF de una página con los elementos (coordenadas con el origen arriba a la izquierda, como el editor). */
export function pdfDePrueba(elementos: ElementoPdf[], ancho = 440, alto = 600): Buffer {
  const ops: string[] = [];
  for (const el of elementos) {
    if (el.t === 'texto') {
      const tam = el.tam ?? 7;
      ops.push(`BT ${TEXTO} rg /${el.negrita ? 'F2' : 'F1'} ${tam} Tf ${el.x} ${(alto - el.y - tam * 0.97).toFixed(2)} Td (${literal(el.texto)}) Tj ET`);
    } else if (el.t === 'linea') {
      const h = el.alto ?? 0.75;
      ops.push(`${el.color ? rgb(el.color) : LINEA} rg ${el.x} ${(alto - el.y - h).toFixed(2)} ${el.ancho} ${h} re f`);
    } else {
      ops.push(`${LINEA} RG 0.75 w ${el.x} ${alto - el.y - el.alto} ${el.ancho} ${el.alto} re S`);
    }
  }
  const contenido = Buffer.from(ops.join('\n'), 'latin1');
  const fuente = (base: string) => `<< /Type /Font /Subtype /Type1 /BaseFont /${base} /Encoding /WinAnsiEncoding >>`;
  const objetos: (string | Buffer)[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ancho} ${alto}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    fuente('Helvetica'),
    fuente('Helvetica-Bold'),
    Buffer.concat([Buffer.from(`<< /Length ${contenido.length} >>\nstream\n`, 'latin1'), contenido, Buffer.from('\nendstream', 'latin1')]),
  ];
  const partes: Buffer[] = [Buffer.from('%PDF-1.4\n', 'latin1')];
  const offsets: number[] = [];
  let largo = partes[0].length;
  objetos.forEach((o, i) => {
    offsets.push(largo);
    const b = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, 'latin1'), typeof o === 'string' ? Buffer.from(o, 'latin1') : o, Buffer.from('\nendobj\n', 'latin1')]);
    partes.push(b);
    largo += b.length;
  });
  const xref = [`xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`, ...offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`)].join('');
  partes.push(Buffer.from(`${xref}trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${largo}\n%%EOF\n`, 'latin1'));
  return Buffer.concat(partes);
}

const FILAS: [string, string, TipoCampo | '', number][] = [
  ['Fecha de recepción', 'fecha_recepcion', 'Fecha', 140],
  ['Locación', 'locacion', 'Texto', 242],
  ['Proveedor', 'proveedor', 'Texto', 242],
  ['Producto / viscosidad', 'producto', 'Texto', 242],
  ['Cantidad recibida (cubetas)', 'cant_recibida', 'Numero', 110],
  ['Cantidad facturada', 'cant_facturada', 'Numero', 110],
  ['Diferencia', 'diferencia', 'Formula', 110],
  ['Lote', '', '', 0],
];

function campo(c: Partial<CampoPlantillaDto> & Pick<CampoPlantillaDto, 'identificador' | 'tipo' | 'x' | 'y' | 'ancho' | 'alto'>): CampoPlantillaDto {
  return { etiqueta: c.identificador, formula: null, pagina: 1, obligatorio: false, enEstadisticas: false, imprimirPdf: true, ...c };
}

function lubricantes(): { pdf: ElementoPdf[]; campos: CampoPlantillaDto[] } {
  const pdf: ElementoPdf[] = [
    { t: 'texto', x: 28, y: 26, texto: 'RECEPCIÓN DE LUBRICANTES · EGEHID', tam: 10, negrita: true },
    { t: 'linea', x: 28, y: 44, ancho: 384, alto: 1, color: '#172b4d' },
  ];
  const campos: CampoPlantillaDto[] = [];
  FILAS.forEach(([texto, id, tipo, ancho], i) => {
    const y = 64 + i * 32;
    pdf.push({ t: 'texto', x: 28, y, texto }, { t: 'linea', x: 170, y: y + 12, ancho: 242 });
    if (!id || !tipo) return;
    campos.push(
      campo({
        identificador: id,
        etiqueta: id === 'diferencia' ? 'Diferencia de cubetas' : texto,
        tipo,
        formula: id === 'diferencia' ? 'cant_recibida - cant_facturada' : null,
        x: 170,
        y: y - 4,
        ancho,
        alto: 16,
        obligatorio: id === 'diferencia',
        enEstadisticas: id === 'diferencia',
      }),
    );
  });
  pdf.push(
    { t: 'texto', x: 28, y: 330, texto: 'Observaciones' },
    { t: 'caja', x: 28, y: 344, ancho: 384, alto: 80 },
    { t: 'linea', x: 28, y: 500, ancho: 180, color: '#172b4d' },
    { t: 'texto', x: 28, y: 506, texto: 'Recibido por' },
    { t: 'linea', x: 232, y: 500, ancho: 180, color: '#172b4d' },
    { t: 'texto', x: 232, y: 506, texto: 'Entregado por' },
  );
  campos.push(
    campo({ identificador: 'observaciones', tipo: 'Texto', x: 28, y: 344, ancho: 384, alto: 80 }),
    campo({ identificador: 'firma_recibe', tipo: 'Firma', x: 28, y: 456, ancho: 180, alto: 40 }),
    campo({ identificador: 'firma_entrega', tipo: 'Firma', x: 232, y: 456, ancho: 180, alto: 40 }),
  );
  return { pdf, campos };
}

export const LISTA_PLANTILLAS: PlantillaResumenDto[] = [
  { id: 1, nombre: 'Combustible y aceites', tipo: 'Oficial', estado: 'Activa', version: 2, versionBorrador: null, totalCampos: 128, publicadaEn: '2026-10-01T00:00:00Z' },
  { id: 2, nombre: 'Recepción de lubricantes', tipo: 'Personalizada', estado: 'Activa', version: 3, versionBorrador: 4, totalCampos: 46, publicadaEn: '2026-09-15T00:00:00Z' },
  { id: 3, nombre: 'Inventario de tanques', tipo: 'Personalizada', estado: 'Desactivada', version: 1, versionBorrador: null, totalCampos: 22, publicadaEn: '2026-06-02T00:00:00Z' },
];

/** GET /plantillas/{id} y GET /plantillas/{id}/versiones/{v}/pdf del diseño. */
export function detallePlantillas(): { detalle: Record<number, PlantillaDto>; pdf: Record<string, Buffer> } {
  const l = lubricantes();
  const pdfLub = pdfDePrueba(l.pdf);
  const base = (r: PlantillaResumenDto, editable: boolean, campos: CampoPlantillaDto[], tienePdf: boolean, paginas = 1): PlantillaDto => {
    const actual = r.versionBorrador ?? r.version;
    return {
      ...r,
      encabezado: { codigo: null, version: null, fechaElaboracion: null, fechaAprobacion: null },
      editable,
      versiones: [
        ...(r.versionBorrador ? [{ version: r.versionBorrador, publicada: false, publicadaEn: null, totalCampos: campos.length, tienePdf }] : []),
        { version: r.version, publicada: true, publicadaEn: r.publicadaEn, totalCampos: r.totalCampos, tienePdf },
      ],
      actual: {
        version: actual,
        publicada: !r.versionBorrador,
        publicadaEn: r.versionBorrador ? null : r.publicadaEn,
        tienePdf,
        paginas: Array.from({ length: paginas }, () => (tienePdf ? { ancho: 440, alto: 600 } : { ancho: 612, alto: 792 })),
        campos,
      },
    };
  };
  return {
    detalle: {
      1: base(LISTA_PLANTILLAS[0], false, [], false, 3),
      2: base(LISTA_PLANTILLAS[1], true, l.campos, true),
      3: base(LISTA_PLANTILLAS[2], true, [], true),
    },
    pdf: { '2/4': pdfLub, '2/3': pdfLub, '3/1': pdfDePrueba([{ t: 'texto', x: 28, y: 26, texto: 'INVENTARIO DE TANQUES · EGEHID', tam: 10, negrita: true }]) },
  };
}
