import { api, RedError } from './client';
import type { FiscalizacionDto } from './types';

/**
 * PDF oficial generado por la API (PDFsharp + MigraDoc). Las descargas siempre vienen del servidor; la vista en
 * HTML (DocumentoPdf) es solo el visor en pantalla.
 */

/** Mensaje cuando no hay red: el PDF oficial solo lo genera el servidor. */
export const MENSAJE_PDF_SIN_RED = 'Sin conexión: el PDF oficial lo genera el servidor. Vuelva a intentarlo cuando haya red.';

export const rutaPdf = (id: string) => `/fiscalizaciones/${id}/pdf`;
export const rutaPdfVersion = (id: string, version: number) => `/fiscalizaciones/${id}/versiones/${version}/pdf`;
export const rutaVistaPrevia = (id: string) => `/fiscalizaciones/${id}/pdf/vista-previa`;

/** «Fiscalizacion-A3F9-v2.pdf» (el mismo nombre que pone la API). */
export function nombreArchivoPdf(numero: string | null | undefined, version: number): string {
  const corto = (numero ?? '').split('-')[0] || 'borrador';
  return `Fiscalizacion-${corto}-v${Math.max(1, version)}.pdf`;
}

export function nombreVistaPrevia(numero: string | null | undefined): string {
  return `Fiscalizacion-${(numero ?? '').split('-')[0] || 'borrador'}-vista-previa.pdf`;
}

/** Ruta y nombre del PDF de un registro: el oficial si está finalizado, la vista previa («BORRADOR») si no. */
export function pdfDe(f: Pick<FiscalizacionDto, 'id' | 'numero' | 'estado' | 'versionActual'>): { ruta: string; nombre: string } {
  return f.estado === 'Borrador' || !f.versionActual
    ? { ruta: rutaVistaPrevia(f.id), nombre: nombreVistaPrevia(f.numero) }
    : { ruta: rutaPdf(f.id), nombre: nombreArchivoPdf(f.numero, f.versionActual) };
}

function sinRed(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/** Error con un mensaje para mostrar tal cual (mensajeError usa el mensaje de los Error comunes). */
export class PdfSinRedError extends Error {
  constructor() {
    super(MENSAJE_PDF_SIN_RED);
    this.name = 'PdfSinRedError';
  }
}

/** Pide el PDF con la sesión (Bearer o X-Dev-User). Sin red lanza PdfSinRedError. */
export async function obtenerPdf(ruta: string): Promise<Blob> {
  if (sinRed()) throw new PdfSinRedError();
  try {
    return await api.blob(ruta);
  } catch (e) {
    if (e instanceof RedError) throw new PdfSinRedError();
    throw e;
  }
}

/** Descarga el PDF con su nombre. */
export async function descargarPdf(ruta: string, nombre: string): Promise<void> {
  guardarBlob(await obtenerPdf(ruta), nombre);
}

function guardarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Abre el PDF en una pestaña nueva (vista previa). La pestaña se abre antes de pedir el PDF para que el navegador
 * no la bloquee; si no se pudo abrir, se descarga.
 */
export async function abrirPdf(ruta: string, nombre: string): Promise<void> {
  if (sinRed()) throw new PdfSinRedError();
  const ventana = window.open('', '_blank');
  try {
    const blob = await obtenerPdf(ruta);
    const url = URL.createObjectURL(blob);
    if (ventana) {
      ventana.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
    } else {
      URL.revokeObjectURL(url);
      guardarBlob(blob, nombre);
    }
  } catch (e) {
    ventana?.close();
    throw e;
  }
}
