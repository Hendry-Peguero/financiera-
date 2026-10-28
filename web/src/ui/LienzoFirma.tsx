import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';

export interface ControlLienzo {
  /** Limpia el recuadro y avisa `alCambiar(null)`. */
  borrar(): void;
}

/**
 * Lienzo para firmar con el dedo, lápiz o ratón (ocupa todo su contenedor; el recuadro, la línea y el pie
 * los dibuja cada pantalla). Llama `alCambiar` con el PNG en base64 (sin prefijo data:) al terminar cada
 * trazo, o con null al borrar.
 */
export function LienzoFirma({
  alCambiar,
  control,
  className,
  etiqueta = 'Recuadro de firma',
}: {
  alCambiar: (base64: string | null) => void;
  control?: Ref<ControlLienzo>;
  className?: string;
  etiqueta?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const escalaInicial = useRef(1);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const escala = window.devicePixelRatio || 1;
    escalaInicial.current = escala;
    c.width = Math.max(1, Math.round((rect.width || 500) * escala));
    c.height = Math.max(1, Math.round((rect.height || 150) * escala));
    const ctx = c.getContext?.('2d');
    if (!ctx) return;
    ctx.scale(escala, escala);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1e3a8a';
    ctx.fillStyle = '#1e3a8a';
  }, []);

  const ctx = () => ref.current?.getContext?.('2d') ?? null;

  useImperativeHandle(control, () => ({
    borrar() {
      const c = ref.current;
      const x = ctx();
      if (c && x) {
        x.save();
        x.setTransform(1, 0, 0, 1, 0, 0);
        x.clearRect(0, 0, c.width, c.height);
        x.restore();
      }
      alCambiar(null);
    },
  }));

  /**
   * Puntero → coordenadas del dibujo. El lienzo mide su caja una sola vez (al montar); si después cambia de tamaño
   * (rotar la tablet, zoom, la escala de la interfaz) se reescala para que el trazo siga cayendo bajo el dedo.
   */
  const punto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget;
    const r = c.getBoundingClientRect();
    const fx = r.width ? c.width / escalaInicial.current / r.width : 1;
    const fy = r.height ? c.height / escalaInicial.current / r.height : 1;
    return { x: (e.clientX - r.left) * fx, y: (e.clientY - r.top) * fy };
  };

  const bajar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = ctx();
    if (!c) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dibujando.current = true;
    const p = punto(e);
    c.beginPath();
    c.moveTo(p.x, p.y);
    c.lineTo(p.x + 0.1, p.y + 0.1);
    c.stroke();
  };
  const mover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dibujando.current) return;
    const c = ctx();
    if (!c) return;
    const p = punto(e);
    c.lineTo(p.x, p.y);
    c.stroke();
  };
  const subir = () => {
    if (!dibujando.current) return;
    dibujando.current = false;
    const url = ref.current?.toDataURL('image/png') ?? '';
    alCambiar(url.replace(/^data:[^,]+,/, '') || null);
  };

  return (
    <canvas
      ref={ref}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }}
      aria-label={etiqueta}
      role="img"
      data-lienzo-firma=""
      onPointerDown={bajar}
      onPointerMove={mover}
      onPointerUp={subir}
      onPointerLeave={subir}
    />
  );
}
