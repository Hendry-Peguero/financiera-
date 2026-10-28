import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

/**
 * Dibuja una página del PDF en un canvas que ocupa toda la página del editor. El tamaño del canvas sale del tamaño
 * medido en pantalla (por la escala de la interfaz) por la densidad de píxeles; se vuelve a dibujar si cambia.
 */
export function CanvasPagina({ doc, numero, alDibujar }: { doc: PDFDocumentProxy; numero: number; alDibujar?: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ancho, setAncho] = useState(0);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    // ResizeObserver avisa también al empezar a observar
    const ro = new ResizeObserver(() => setAncho(c.getBoundingClientRect().width));
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = canvas.current;
    if (!c || ancho <= 0) return;
    let tarea: RenderTask | null = null;
    let vigente = true;
    void doc.getPage(numero).then((pagina) => {
      if (!vigente) return;
      const base = pagina.getViewport({ scale: 1 });
      const viewport = pagina.getViewport({ scale: (ancho * (window.devicePixelRatio || 1)) / base.width });
      c.width = Math.round(viewport.width);
      c.height = Math.round(viewport.height);
      tarea = pagina.render({ canvas: c, viewport });
      tarea.promise.then(
        () => vigente && alDibujar?.(),
        () => {},
      );
    });
    return () => {
      vigente = false;
      tarea?.cancel();
    };
  }, [doc, numero, ancho, alDibujar]);

  return <canvas ref={canvas} className="pl-pdf-canvas" aria-hidden="true" />;
}
