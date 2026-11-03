import type { FiscalizacionDto, PendientesDto, PreguntaControlDto } from '../api/types';
import { EQUIPOS, PREGUNTAS_POR_DEFECTO, ROLES_FIRMA } from './fiscalizacion';

export type Seccion = 'visita' | 'mediciones' | 'controles' | 'fotos' | 'firmas' | 'revisar';

export const SECCIONES: { id: Seccion; titulo: string; resumen: string }[] = [
  // «Visita» reúne visita, suplidor y empresa (los pendientes `suplidor` de la API cuentan aquí)
  { id: 'visita', titulo: 'Visita', resumen: 'Visita, suplidor y empresa' },
  { id: 'mediciones', titulo: 'Mediciones', resumen: 'Mediciones y lecturas' },
  { id: 'controles', titulo: 'Controles', resumen: '12 controles internos' },
  { id: 'fotos', titulo: 'Fotografías', resumen: 'Fotografías' },
  { id: 'firmas', titulo: 'Firmas', resumen: 'Firmas' },
  { id: 'revisar', titulo: 'Revisar', resumen: 'Revisar y finalizar' },
];

export function esSeccion(s: string | undefined): s is Seccion {
  return !!s && SECCIONES.some((x) => x.id === s);
}

export type EstadoSeccion = 'completa' | 'pendiente' | 'sin-iniciar';

const vacio = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/** ¿Falta la observación obligatoria? (ítems con observacionObligatoriaSiSi —6, 11, 12— y respuesta Sí) */
export function observacionFaltante(
  pregunta: Pick<PreguntaControlDto, 'observacionObligatoriaSiSi'>,
  respuesta: boolean | null,
  observacion: string | null,
): boolean {
  return pregunta.observacionObligatoriaSiSi && respuesta === true && vacio(observacion);
}

// Los mensajes replican los de la API (ValidadorFiscalizacion) para que coincidan en línea y sin conexión.

export function pendientesVisita(f: FiscalizacionDto): string[] {
  const v = f.visita;
  const p: string[] = [];
  if (vacio(v.fecha)) p.push('Falta la fecha.');
  if (vacio(v.horaSalida)) p.push('Falta la hora de salida.');
  if (vacio(v.inicioProceso)) p.push('Falta la hora de inicio del proceso.');
  if (v.locacionId == null) p.push('Falta el destino.');
  if (vacio(v.horaLlegada)) p.push('Falta la hora de llegada.');
  if (vacio(v.finProceso)) p.push('Falta la hora de fin del proceso.');
  if (!vacio(v.inicioProceso) && !vacio(v.finProceso) && (v.finProceso as string) < (v.inicioProceso as string))
    p.push('El fin del proceso es anterior al inicio.');
  return p;
}

export function pendientesSuplidor(f: FiscalizacionDto): string[] {
  const s = f.suplidor;
  const e = f.empresa;
  const p: string[] = [];
  if (vacio(s.fichaCamion)) p.push('Falta la ficha del camión.');
  if (vacio(s.chofer)) p.push('Falta el chofer.');
  if (vacio(s.placa)) p.push('Falta la placa.');
  if (vacio(s.conduce)) p.push('Falta el conduce.');
  if (s.suplidorId == null && vacio(s.nombre)) p.push('Falta la empresa suplidora.');
  if (s.totalEntregarGal == null) p.push('Falta el total a entregar.');
  if (vacio(e.responsable)) p.push('Falta el responsable de EGEHID.');
  if (e.totalRecibirGal == null) p.push('Falta el total a recibir.');
  return p;
}

export function pendientesMediciones(f: FiscalizacionDto): string[] {
  const m = f.mediciones;
  const p: string[] = [];
  if (m.productoId == null) p.push('Falta el producto.');
  if (m.galonesProveedor == null) p.push('Faltan los galones según proveedor.');
  if (m.galonesEgehid == null) p.push('Faltan los galones medidos por EGEHID.');
  for (const l of m.lecturas) {
    if (l.inicial != null && l.final != null && l.final < l.inicial) {
      const nombre = EQUIPOS.find((e) => e.equipo === l.equipo)?.nombre ?? l.equipo;
      p.push(`La lectura final de ${nombre} es menor que la inicial.`);
    }
  }
  return p;
}

/** Error en línea del formulario (controles 6, 11, 12). */
export const MENSAJE_OBSERVACION = 'La observación es obligatoria si responde Sí.';

export function mensajeObservacionObligatoria(numero: number): string {
  return `El control ${numero} respondió Sí: la observación es obligatoria.`;
}

export function pendientesControles(
  f: FiscalizacionDto,
  preguntas: PreguntaControlDto[] = PREGUNTAS_POR_DEFECTO,
): string[] {
  const p: string[] = [];
  for (const q of [...preguntas].sort((a, b) => a.numero - b.numero)) {
    const r = f.controles.find((c) => c.numero === q.numero);
    if (!r || r.respuesta === null) p.push(`Falta responder el control ${q.numero}.`);
    else if (observacionFaltante(q, r.respuesta, r.observacion)) p.push(mensajeObservacionObligatoria(q.numero));
  }
  return p;
}

export function pendientesFirmas(f: FiscalizacionDto): string[] {
  const firmadas = new Set((f.firmas ?? []).map((x) => x.rol));
  return ROLES_FIRMA.filter((r) => r.requerida && !firmadas.has(r.rol)).map((r) => `Falta la firma de ${r.nombre}.`);
}

/** Pendientes calculados en la tablet, con las mismas 6 claves que `pendientes` de la API. */
export function calcularPendientes(
  f: FiscalizacionDto,
  preguntas: PreguntaControlDto[] = PREGUNTAS_POR_DEFECTO,
): PendientesDto {
  return {
    visita: pendientesVisita(f),
    suplidor: pendientesSuplidor(f),
    mediciones: pendientesMediciones(f),
    controles: pendientesControles(f, preguntas),
    fotos: [],
    firmas: pendientesFirmas(f),
  };
}

/** Pendientes por sección del formulario (incluye `revisar`, siempre vacía). */
export function pendientesPorSeccion(
  f: FiscalizacionDto,
  preguntas: PreguntaControlDto[] = PREGUNTAS_POR_DEFECTO,
): Record<Seccion, string[]> {
  const { visita, suplidor, ...resto } = calcularPendientes(f, preguntas);
  return { ...resto, visita: [...visita, ...suplidor], revisar: [] };
}

export function totalPendientes(p: Partial<Record<string, string[]>>): number {
  return Object.values(p).reduce((n, l) => n + (l?.length ?? 0), 0);
}

const algo = (o: object) => Object.values(o).some((v) => !vacio(v));

/** ¿El usuario empezó a llenar la sección? */
export function seccionIniciada(f: FiscalizacionDto, s: Seccion): boolean {
  switch (s) {
    case 'visita':
      return algo({ ...f.visita, fecha: null }) || algo(f.suplidor) || algo(f.empresa);
    case 'mediciones': {
      const m = f.mediciones;
      return (
        algo({ p: m.productoId, a: m.galonesProveedor, b: m.galonesEgehid, c: m.precioGalon }) ||
        algo(m.vara) ||
        m.lecturas.some((l) => l.inicial != null || l.final != null)
      );
    }
    case 'controles':
      return f.controles.some((c) => c.respuesta !== null || !vacio(c.observacion));
    case 'fotos':
      return (f.fotos?.length ?? 0) > 0;
    case 'firmas':
      return (f.firmas?.length ?? 0) > 0;
    case 'revisar':
      return false;
  }
}

/**
 * Reglas para finalizar (API): todas las secciones sin pendientes — visita completa, suplidor y empresa,
 * mediciones, 12 controles respondidos con observación en 6/11/12 si Sí, y las firmas requeridas.
 */
export function validarFinalizacion(
  f: FiscalizacionDto,
  preguntas: PreguntaControlDto[] = PREGUNTAS_POR_DEFECTO,
): string[] {
  return Object.values(calcularPendientes(f, preguntas)).flat();
}

export function puedeFinalizar(f: FiscalizacionDto, preguntas?: PreguntaControlDto[]): boolean {
  return validarFinalizacion(f, preguntas).length === 0;
}

export function estadoSeccion(
  f: FiscalizacionDto,
  s: Seccion,
  pendientes: Record<Seccion, string[]>,
  extra?: { fotosLocales?: number; preguntas?: PreguntaControlDto[] },
): EstadoSeccion {
  if (s === 'fotos') return (f.fotos?.length ?? 0) + (extra?.fotosLocales ?? 0) > 0 ? 'completa' : 'sin-iniciar';
  if (s === 'revisar') return puedeFinalizar(f, extra?.preguntas) ? 'completa' : 'sin-iniciar';
  if (!seccionIniciada(f, s)) return 'sin-iniciar';
  return pendientes[s].length ? 'pendiente' : 'completa';
}
