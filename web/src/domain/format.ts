const nf2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** 4,212.40 · usa el signo menos tipográfico (−) como en el diseño. */
export function num(n: number | null | undefined, decimales = 2): string {
  if (n == null || Number.isNaN(n)) return '—';
  const f = decimales === 0 ? nf0 : nf2;
  const s = f.format(Math.abs(n));
  return n < 0 ? `−${s}` : s;
}

export function numConSigno(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n > 0) return `+${num(n)}`;
  return num(n);
}

export function dinero(n: number | null | undefined): string {
  if (n == null) return '—';
  return n < 0 ? `−RD$ ${nf2.format(-n)}` : `RD$ ${nf2.format(n)}`;
}

export function pct(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${num(n)} %`;
}

/** yyyy-MM-dd → dd/MM/yyyy */
export function fecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * Interpreta un momento de la API. La API real devuelve DateTime sin zona ("2026-10-22T18:58:44.34")
 * aunque son UTC: si no trae zona se asume UTC.
 */
export function aFecha(iso: string): Date {
  const conZona = /(Z|[+-]\d{2}:?\d{2})$/i.test(iso) || !/T\d{2}:/.test(iso);
  return new Date(conZona ? iso : `${iso}Z`);
}

/** Momento ISO → "dd/MM/yyyy HH:mm" local */
export function momento(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = aFecha(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Solo la hora local "HH:mm" de un momento. */
export function horaDe(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = aFecha(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** "Lunes 20 de octubre de 2026" */
export function fechaLarga(d = new Date()): string {
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

export function nombreMes(mes0: number): string {
  return MESES[mes0] ?? '';
}

/** HH:mm (24 h) → "07:15 AM" */
export function hora12(h: string | null | undefined): string {
  if (!h) return '—';
  const m = /^(\d{1,2}):(\d{2})/.exec(h);
  if (!m) return h;
  const hh = Number(m[1]);
  const suf = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${String(h12).padStart(2, '0')}:${m[2]} ${suf}`;
}

export function hoyIso(d = new Date()): string {
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function haceTiempo(desdeMs: number, ahoraMs = Date.now()): string {
  const s = Math.max(0, Math.round((ahoraMs - desdeMs) / 1000));
  if (s < 60) return `hace ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Convierte texto de un input numérico a number|null (acepta coma de miles). */
export function parseNumero(txt: string): number | null {
  const t = txt.replace(/,/g, '').trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
