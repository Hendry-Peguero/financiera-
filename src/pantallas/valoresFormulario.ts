import type { EncabezadoPlantillaDto } from '../api/tiposPlantillas';
import type { FiscalizacionDto, PreguntaControlDto, RolFirma } from '../api/types';
import { calcular, diferenciaLectura } from '../domain/calculos';
import { fecha, hora12, num } from '../domain/format';
import formulario from './formularioOficial.json';

/**
 * Valores de cada celda del formulario en papel (plantilla oficial), igual que ValoresFormulario.cs en la API.
 * Las celdas salen de formularioOficial.json, que una prueba de la API mantiene igual a PlantillaOficial.cs.
 */
export type CampoFormulario = (typeof formulario.campos)[number];
export const FORMULARIO = formulario as { ancho: number; alto: number; campos: CampoFormulario[] };

/** Texto de la celda; en las firmas, `firma` = nombre del firmante (el visor dibuja su trazo) y `pie` bajo la línea. */
export interface ValorCampo {
  texto?: string;
  firma?: string;
  pie?: string;
}

const PARTICIPANTES: [RolFirma, string][] = [
  ['AuditorActuante1', 'auditor_actuante_1'],
  ['AuditorActuante2', 'auditor_actuante_2'],
  ['EncargadoRecibir', 'encargado_recibir'],
  ['SupervisorCombustibles', 'supervisor_combustibles'],
  ['RepresentanteProveedor', 'representante_proveedor'],
];
const FIRMAS_CIERRE: [RolFirma, string][] = [
  ['InspectorActuante', 'inspector_actuante'],
  ['RevisadoPor', 'revisado_por'],
];
const EQUIPOS: [string, string][] = [
  ['MedidorDigital', 'medidor_digital'],
  ['Dispensador', 'dispensador'],
  ['Electrobomba', 'electrobomba'],
];
const TITULOS = new Set(['ing.', 'ing', 'lic.', 'lic', 'dr.', 'dra.', 'arq.', 'sr.', 'sra.', 'lcdo.', 'lcda.']);

/** Nombre completo → nombre y apellidos (las 2 últimas palabras, salvo «José M. Guzmán»); el título va con el nombre. */
export function separarNombre(completo: string): { nombre: string; apellido: string | null } {
  const partes = completo.split(' ').filter(Boolean);
  const titulo = partes.length > 1 && TITULOS.has(partes[0].toLowerCase()) ? partes.shift()! : null;
  const n = partes.length;
  const apellidos = n <= 1 ? 0 : n === 2 ? 1 : n === 3 && partes[1].length <= 2 && partes[1].endsWith('.') ? 1 : 2;
  const nombre = partes.slice(0, n - apellidos).join(' ');
  return { nombre: titulo ? `${titulo} ${nombre}` : nombre, apellido: apellidos ? partes.slice(n - apellidos).join(' ') : null };
}

/** num() sin el «—» de vacío: en el formulario lo que falta queda en blanco. */
const n2 = (v: number | null | undefined) => (v == null ? undefined : num(v));
const resta = (final: number | null | undefined, inicial: number | null | undefined) =>
  diferenciaLectura({ inicial: inicial ?? null, final: final ?? null });

export function valoresFormulario(
  f: FiscalizacionDto,
  datos: { locacion?: string; suplidor?: string; preguntas: PreguntaControlDto[]; encabezado?: EncabezadoPlantillaDto | null },
): Record<string, ValorCampo> {
  const v: Record<string, ValorCampo> = {};
  const poner = (id: string, texto: string | null | undefined) => {
    if (texto != null && texto.trim() && texto !== '—') v[id] = { texto: texto.trim() };
  };

  const e = datos.encabezado;
  if (e) {
    poner('doc_codigo', e.codigo);
    poner('doc_version', e.version);
    poner('doc_fecha_elaboracion', e.fechaElaboracion && fecha(e.fechaElaboracion));
    poner('doc_fecha_aprobacion', e.fechaAprobacion && fecha(e.fechaAprobacion));
  }

  poner('fecha', fecha(f.visita.fecha));
  poner('hora_salida', hora12(f.visita.horaSalida));
  poner('inicio_proceso', hora12(f.visita.inicioProceso));
  poner('locacion', datos.locacion);
  poner('hora_llegada', hora12(f.visita.horaLlegada));
  poner('fin_proceso', hora12(f.visita.finProceso));

  poner('ficha_camion', f.suplidor.fichaCamion);
  poner('chofer', f.suplidor.chofer);
  poner('placa', f.suplidor.placa);
  poner('conduce', f.suplidor.conduce);
  poner('suplidor', datos.suplidor);
  poner('total_entregar_gal', n2(f.suplidor.totalEntregarGal));

  poner('empresa_ficha_camion', f.empresa.fichaCamion1);
  poner('empresa_chofer', f.empresa.chofer1);
  poner('ficha_camion_2', f.empresa.fichaCamion2);
  poner('chofer_2', f.empresa.chofer2);
  poner('responsable', f.empresa.responsable);
  poner('total_recibir_gal', n2(f.empresa.totalRecibirGal));

  const m = f.mediciones;
  for (const [equipo, id] of EQUIPOS) {
    const l = m.lecturas?.find((x) => x.equipo === equipo);
    poner(`${id}_inicial`, n2(l?.inicial));
    poner(`${id}_final`, n2(l?.final));
    poner(`${id}_diferencia`, n2(l ? diferenciaLectura(l) : null));
  }
  const gal = (x: number | null | undefined) => (x == null ? undefined : `${num(x)} gal`);
  poner('vara_inicial_medida', m.vara?.inicialMedida);
  poner('vara_inicial_galones', gal(m.vara?.inicialGalones));
  poner('vara_final_medida', m.vara?.finalMedida);
  poner('vara_final_galones', gal(m.vara?.finalGalones));
  poner('vara_diferencia_galones', gal(resta(m.vara?.finalGalones, m.vara?.inicialGalones)));

  const c = f.calculos ?? calcular(m);
  poner('galones_egehid', n2(m.galonesEgehid));
  poner('galones_proveedor', n2(m.galonesProveedor));
  if (c.diferenciaGal != null)
    poner('diferencia_gal', c.diferenciaPct != null ? `${num(c.diferenciaGal)} (${num(c.diferenciaPct)} %)` : num(c.diferenciaGal));

  for (const control of f.controles) {
    if (control.respuesta != null) poner(control.respuesta ? `control_${control.numero}` : `control_${control.numero}_no`, 'X');
    const tipo = datos.preguntas.find((p) => p.numero === control.numero)?.tipoObservacion ?? (control.numero === 10 ? 'Fecha' : 'Texto');
    poner(`control_${control.numero}_obs`, tipo === 'Fecha' && control.observacion ? fecha(control.observacion) : control.observacion);
  }

  const firmas = f.firmas ?? [];
  for (const [rol, id] of PARTICIPANTES) {
    const x = firmas.find((y) => y.rol === rol);
    if (!x) continue;
    const { nombre, apellido } = separarNombre(x.nombreFirmante);
    poner(`${id}_nombre`, nombre);
    poner(`${id}_apellido`, apellido);
    poner(`${id}_cedula`, x.cedula);
    v[`firma_${id}`] = { firma: x.nombreFirmante };
  }
  for (const [rol, id] of FIRMAS_CIERRE) {
    const x = firmas.find((y) => y.rol === rol);
    if (x) v[`firma_${id}`] = { firma: x.nombreFirmante, pie: x.nombreFirmante };
  }

  poner('precio_galon', n2(m.precioGalon));
  poner('importe_egehid', n2(c.importeEgehid));
  poner('importe_proveedor', n2(c.importeProveedor));
  poner('diferencia_importe', n2(c.diferenciaImporte));
  poner('observaciones_generales', f.observacionesGenerales);
  return v;
}
