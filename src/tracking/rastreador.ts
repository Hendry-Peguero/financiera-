import type { EventoUiDto, TipoEventoUi } from '../api/types';
import { nuevoId } from '../domain/fiscalizacion';
import { infoClic } from './etiqueta';

/** Almacén de la cola de eventos (IndexedDB en la app, memoria en pruebas). */
export interface AlmacenEventos {
  agregar(e: EventoUiDto): Promise<void>;
  contar(): Promise<number>;
  /** Los N más antiguos con su clave interna */
  tomar(n: number): Promise<{ clave: number; evento: EventoUiDto }[]>;
  borrar(claves: number[]): Promise<void>;
}

export interface OpcionesRastreador {
  almacen: AlmacenEventos;
  enviar: (eventos: EventoUiDto[]) => Promise<void>;
  /** ¿Se puede enviar? (hay red y sesión) */
  puedeEnviar?: () => boolean;
  ruta?: () => string;
  dispositivo?: string;
  sesionId?: string;
  ahora?: () => Date;
  tamanoLote?: number;
  intervaloMs?: number;
}

export function describirDispositivo(ua: string, ancho: number): string {
  const tipo = ancho < 768 ? 'Móvil' : ancho < 1280 ? 'Tablet' : 'Escritorio';
  const m =
    /Edg\/(\d+)/.exec(ua) ? `Edge ${/Edg\/(\d+)/.exec(ua)![1]}` :
    /Firefox\/(\d+)/.exec(ua) ? `Firefox ${/Firefox\/(\d+)/.exec(ua)![1]}` :
    /Chrome\/(\d+)/.exec(ua) ? `Chrome ${/Chrome\/(\d+)/.exec(ua)![1]}` :
    /Version\/(\d+).*Safari/.exec(ua) ? `Safari ${/Version\/(\d+)/.exec(ua)![1]}` :
    'Navegador';
  return `${tipo} · ${m}`;
}

export class Rastreador {
  readonly sesionId: string;
  private readonly op: Required<Omit<OpcionesRastreador, 'sesionId'>>;
  private enviando: Promise<void> | null = null;
  private desinstalar: (() => void) | null = null;

  constructor(op: OpcionesRastreador) {
    this.sesionId = op.sesionId ?? nuevoId();
    this.op = {
      almacen: op.almacen,
      enviar: op.enviar,
      puedeEnviar: op.puedeEnviar ?? (() => typeof navigator === 'undefined' || navigator.onLine),
      ruta: op.ruta ?? (() => (typeof location !== 'undefined' ? location.pathname : '/')),
      dispositivo:
        op.dispositivo ??
        (typeof navigator !== 'undefined' ? describirDispositivo(navigator.userAgent, window.innerWidth) : 'Desconocido'),
      ahora: op.ahora ?? (() => new Date()),
      tamanoLote: op.tamanoLote ?? 50,
      intervaloMs: op.intervaloMs ?? 10_000,
    };
  }

  /** Registra un evento; si la cola llega al tamaño del lote, la envía. */
  async registrar(tipo: TipoEventoUi, elemento: string | null = null, detalle: Record<string, unknown> | null = null) {
    const evento: EventoUiDto = {
      idCliente: nuevoId(),
      momento: this.op.ahora().toISOString(),
      sesionId: this.sesionId,
      tipo,
      ruta: this.op.ruta(),
      elemento: elemento ? elemento.slice(0, 200) : null,
      detalle,
      dispositivo: this.op.dispositivo,
    };
    await this.op.almacen.agregar(evento);
    if ((await this.op.almacen.contar()) >= this.op.tamanoLote) void this.vaciar();
    return evento;
  }

  /** Registro de un clic (devuelve null si se ignoró, p. ej. contraseña). */
  registrarClic(ev: Pick<MouseEvent, 'target' | 'clientX' | 'clientY'>) {
    const info = infoClic(ev.target);
    if (!info) return null;
    return this.registrar('click', info.elemento, {
      selector: info.selector,
      x: Math.round(ev.clientX ?? 0),
      y: Math.round(ev.clientY ?? 0),
    });
  }

  /** Envía la cola por lotes. Si falla, los eventos quedan para el próximo intento. */
  vaciar(): Promise<void> {
    if (this.enviando) return this.enviando;
    this.enviando = (async () => {
      try {
        while (this.op.puedeEnviar()) {
          const lote = await this.op.almacen.tomar(this.op.tamanoLote);
          if (!lote.length) break;
          await this.op.enviar(lote.map((l) => l.evento));
          await this.op.almacen.borrar(lote.map((l) => l.clave));
          if (lote.length < this.op.tamanoLote) break;
        }
      } catch {
        // sin red o sin sesión: se reintenta luego
      } finally {
        this.enviando = null;
      }
    })();
    return this.enviando;
  }

  /** Instala los listeners globales. Devuelve la función para quitarlos. */
  instalar(win: Window = window): () => void {
    if (this.desinstalar) return this.desinstalar;
    const onClick = (e: MouseEvent) => void this.registrarClic(e);
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target instanceof HTMLFormElement ? e.target : null;
      const nombre = form?.getAttribute('data-track') ?? form?.getAttribute('aria-label') ?? form?.id ?? null;
      void this.registrar('envio', nombre, { selector: form ? form.tagName.toLowerCase() + (form.id ? `#${form.id}` : '') : '' });
    };
    const onError = (e: ErrorEvent) =>
      void this.registrar('error', (e.message || 'Error').slice(0, 200), {
        archivo: e.filename ?? null,
        linea: e.lineno ?? null,
      });
    const onRechazo = (e: PromiseRejectionEvent) =>
      void this.registrar('error', String((e.reason as Error)?.message ?? e.reason ?? 'Promesa rechazada').slice(0, 200), {
        tipo: 'unhandledrejection',
      });
    const onOnline = () => {
      void this.registrar('online').then(() => this.vaciar());
    };
    const onOffline = () => void this.registrar('offline');

    win.addEventListener('click', onClick, true);
    win.addEventListener('submit', onSubmit as EventListener, true);
    win.addEventListener('error', onError);
    win.addEventListener('unhandledrejection', onRechazo);
    win.addEventListener('online', onOnline);
    win.addEventListener('offline', onOffline);
    const timer = win.setInterval(() => void this.vaciar(), this.op.intervaloMs);

    this.desinstalar = () => {
      win.removeEventListener('click', onClick, true);
      win.removeEventListener('submit', onSubmit as EventListener, true);
      win.removeEventListener('error', onError);
      win.removeEventListener('unhandledrejection', onRechazo);
      win.removeEventListener('online', onOnline);
      win.removeEventListener('offline', onOffline);
      win.clearInterval(timer);
      this.desinstalar = null;
    };
    return this.desinstalar;
  }
}

/** Almacén en memoria (pruebas). */
export class AlmacenMemoria implements AlmacenEventos {
  private seq = 0;
  readonly items: { clave: number; evento: EventoUiDto }[] = [];
  async agregar(e: EventoUiDto) {
    this.items.push({ clave: ++this.seq, evento: e });
  }
  async contar() {
    return this.items.length;
  }
  async tomar(n: number) {
    return this.items.slice(0, n);
  }
  async borrar(claves: number[]) {
    const set = new Set(claves);
    for (let i = this.items.length - 1; i >= 0; i--) if (set.has(this.items[i].clave)) this.items.splice(i, 1);
  }
}
