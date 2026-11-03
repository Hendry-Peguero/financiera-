import { useEffect, useState } from 'react';
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist';

type Pdfjs = typeof import('pdfjs-dist');

let cargando: Promise<Pdfjs> | null = null;

/** pdf.js se carga solo al abrir una plantilla con PDF (va en su propio chunk, con su worker). */
export function cargarPdfjs(): Promise<Pdfjs> {
  cargando ??= Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  });
  return cargando;
}

/** Documento pdf.js de los bytes del PDF base (null mientras carga o si falla). */
export function useDocumentoPdf(bytes: Uint8Array | undefined) {
  const [estado, setEstado] = useState<{ bytes: Uint8Array; doc: PDFDocumentProxy | null; error: boolean } | null>(null);
  useEffect(() => {
    if (!bytes) return;
    let vigente = true;
    let tarea: PDFDocumentLoadingTask | null = null;
    cargarPdfjs()
      .then((pdfjs) => {
        if (!vigente) return null;
        // pdf.js se queda con el buffer que recibe: se le pasa una copia para no vaciar la caché
        tarea = pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 });
        return tarea.promise;
      })
      .then((doc) => vigente && doc && setEstado({ bytes, doc, error: false }))
      .catch(() => vigente && setEstado({ bytes, doc: null, error: true }));
    return () => {
      vigente = false;
      void tarea?.destroy();
    };
  }, [bytes]);
  const actual = estado?.bytes === bytes ? estado : null;
  return { doc: actual?.doc ?? null, error: actual?.error ?? false };
}
