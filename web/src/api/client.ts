import { config } from '../config';

/** Proveedor de encabezados de autenticación; lo registra el SesionProvider. */
export type ProveedorAuth = () => Promise<Record<string, string>>;

let proveedorAuth: ProveedorAuth = async () => ({});

export function configurarAuth(fn: ProveedorAuth) {
  proveedorAuth = fn;
}

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  errors?: Record<string, string[]>;
  /** En 409: la versión vigente en el servidor (FiscalizacionDto) cuando aplica. */
  actual?: unknown;
  traceId?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly problema: ProblemDetails | null;
  constructor(status: number, problema: ProblemDetails | null, mensaje?: string) {
    super(mensaje ?? problema?.detail ?? problema?.title ?? `Error ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.problema = problema;
  }
  /** Todos los mensajes de validación aplanados. */
  get mensajes(): string[] {
    const errs = this.problema?.errors;
    if (!errs) return [this.message];
    return Object.values(errs).flat();
  }
  /** Errores de validación por clave de sección (visita, controles, firmas, mediciones.lecturas…). */
  get errores(): Record<string, string[]> {
    return this.problema?.errors ?? {};
  }
  get actual(): unknown {
    return this.problema?.actual ?? null;
  }
}

/** Error de red (sin conexión, CORS, servidor caído). */
export class RedError extends Error {
  constructor(causa: unknown) {
    super('No se pudo contactar al servidor.');
    this.name = 'RedError';
    this.cause = causa;
  }
}

export function esErrorDeRed(e: unknown): boolean {
  return e instanceof RedError;
}

type Query = Record<string, string | number | boolean | null | undefined>;

export function construirUrl(ruta: string, query?: Query): string {
  const url = `${config.apiUrl}${ruta.startsWith('/') ? ruta : `/${ruta}`}`;
  if (!query) return url;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${url}?${s}` : url;
}

interface Opciones {
  metodo?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  query?: Query;
  cuerpo?: unknown;
  formData?: FormData;
  respuesta?: 'json' | 'blob' | 'nada';
  signal?: AbortSignal;
}

export async function solicitar<T>(ruta: string, op: Opciones = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...(await proveedorAuth()) };
  let body: BodyInit | undefined;
  if (op.formData) body = op.formData;
  else if (op.cuerpo !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(op.cuerpo);
  }
  let res: Response;
  try {
    res = await fetch(construirUrl(ruta, op.query), { method: op.metodo ?? 'GET', headers, body, signal: op.signal });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    throw new RedError(e);
  }
  if (!res.ok) {
    let problema: ProblemDetails | null;
    try {
      const txt = await res.text();
      problema = txt ? (JSON.parse(txt) as ProblemDetails) : null;
    } catch {
      problema = null;
    }
    throw new ApiError(res.status, problema);
  }
  if (op.respuesta === 'blob') return (await res.blob()) as T;
  if (op.respuesta === 'nada' || res.status === 204 || res.status === 202) {
    // 202/204 pueden traer cuerpo vacío
    const txt = await res.text().catch(() => '');
    return (txt ? JSON.parse(txt) : undefined) as T;
  }
  const txt = await res.text();
  return (txt ? JSON.parse(txt) : undefined) as T;
}

export const api = {
  get: <T>(ruta: string, query?: Query) => solicitar<T>(ruta, { query }),
  post: <T>(ruta: string, cuerpo?: unknown) => solicitar<T>(ruta, { metodo: 'POST', cuerpo: cuerpo ?? {} }),
  put: <T>(ruta: string, cuerpo?: unknown) => solicitar<T>(ruta, { metodo: 'PUT', cuerpo }),
  del: (ruta: string) => solicitar<void>(ruta, { metodo: 'DELETE', respuesta: 'nada' }),
  blob: (ruta: string) => solicitar<Blob>(ruta, { respuesta: 'blob' }),
  form: <T>(ruta: string, formData: FormData) => solicitar<T>(ruta, { metodo: 'POST', formData }),
};
