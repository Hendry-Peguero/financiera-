import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import {
  MENSAJE_PDF_SIN_RED,
  descargarPdf,
  nombreArchivoPdf,
  nombreVistaPrevia,
  obtenerPdf,
  pdfDe,
  PdfSinRedError,
  rutaPdfVersion,
} from './pdf';

const ID = 'a3f921c0-5e0b-4d77-9a1b-2c3d4e5f6a7b';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('rutas y nombres del PDF oficial', () => {
  it('usa el número corto y la versión, como la API', () => {
    expect(nombreArchivoPdf('A3F9-21C0', 2)).toBe('Fiscalizacion-A3F9-v2.pdf');
    expect(nombreArchivoPdf(null, 0)).toBe('Fiscalizacion-borrador-v1.pdf');
    expect(nombreVistaPrevia('A3F9-21C0')).toBe('Fiscalizacion-A3F9-vista-previa.pdf');
    expect(rutaPdfVersion(ID, 1)).toBe(`/fiscalizaciones/${ID}/versiones/1/pdf`);
  });

  it('un finalizado descarga el PDF vigente; un borrador, la vista previa', () => {
    expect(pdfDe({ id: ID, numero: 'A3F9-21C0', estado: 'Modificado', versionActual: 2 })).toEqual({
      ruta: `/fiscalizaciones/${ID}/pdf`,
      nombre: 'Fiscalizacion-A3F9-v2.pdf',
    });
    expect(pdfDe({ id: ID, numero: 'A3F9-21C0', estado: 'Borrador', versionActual: 0 })).toEqual({
      ruta: `/fiscalizaciones/${ID}/pdf/vista-previa`,
      nombre: 'Fiscalizacion-A3F9-vista-previa.pdf',
    });
  });
});

describe('pedir el PDF', () => {
  it('sin red avisa sin llamar al servidor', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await expect(obtenerPdf(`/fiscalizaciones/${ID}/pdf`)).rejects.toThrow(MENSAJE_PDF_SIN_RED);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('si la red falla durante la petición también muestra el aviso de sin conexión', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(obtenerPdf(`/fiscalizaciones/${ID}/pdf`)).rejects.toBeInstanceOf(PdfSinRedError);
  });

  it('descarga el blob con el nombre del archivo', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(new Blob(['%PDF-1.7'], { type: 'application/pdf' }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const crear = vi.fn(() => 'blob:pdf');
    // jsdom no implementa createObjectURL: se pone y se quita en esta prueba
    const original = { crear: URL.createObjectURL, revocar: URL.revokeObjectURL };
    Object.assign(URL, { createObjectURL: crear, revokeObjectURL: vi.fn() });
    onTestFinished(() => {
      Object.assign(URL, { createObjectURL: original.crear, revokeObjectURL: original.revocar });
    });
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('Fiscalizacion-A3F9-v2.pdf');
      expect(this.href).toBe('blob:pdf');
    });
    await descargarPdf(`/fiscalizaciones/${ID}/pdf`, 'Fiscalizacion-A3F9-v2.pdf');
    expect(String(fetch.mock.calls[0][0])).toContain(`/fiscalizaciones/${ID}/pdf`);
    expect(crear).toHaveBeenCalledOnce();
    expect(clic).toHaveBeenCalledOnce();
  });
});
