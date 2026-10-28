import type { FiscalizacionDto, VersionDto } from '../../../src/api/types';
import { nuevaFiscalizacion } from '../../../src/domain/fiscalizacion';
import { idDe, LISTA } from './base';

export const ID_5E0B = idDe('5E0B-3D77');

/** Lista del móvil (movil-historial.html): las tarjetas #A3F9, #7C21, #5E0B y #2B6A. */
export const LISTA_MOVIL = LISTA.filter((f) => f.numero !== '91D4-0B12');

/** Registro #5E0B-3D77 (C.H. Valdesia) de desktop-detalle-y-versiones.html: Modificado, versión 3, 8 fotos. */
export function registro5e0b(): FiscalizacionDto {
  const base = nuevaFiscalizacion(ID_5E0B, '2026-10-18');
  return {
    ...base,
    numero: '5E0B-3D77',
    estado: 'Modificado',
    versionActual: 3,
    rowVersion: 'NWUwYi0z',
    autor: { id: '22222222-2222-4222-8222-222222222222', nombreCompleto: 'José M. Guzmán' },
    creadoEn: '2026-10-18T16:31:00Z',
    actualizadoEn: '2026-10-19T14:22:00Z',
    visita: { fecha: '2026-10-18', horaSalida: '06:50', inicioProceso: '08:55', locacionId: 3, horaLlegada: '08:30', finProceso: '12:10' },
    suplidor: { fichaCamion: 'FT-204', chofer: 'Félix Santana', placa: 'L-299104', conduce: 'CD-0047551', suplidorId: 3, totalEntregarGal: 6148.75 },
    empresa: { fichaCamion2: 'FT-311', chofer2: 'Ramón Ortiz', responsable: 'Ing. Carlos Méndez', totalRecibirGal: 6100 },
    mediciones: {
      productoId: 1,
      galonesProveedor: 6148.75,
      galonesEgehid: 6100,
      precioGalon: 248.6,
      lecturas: [
        { equipo: 'MedidorDigital', inicial: 98120, final: 104220 },
        { equipo: 'Dispensador', inicial: 41005.5, final: 47105.5 },
        { equipo: 'Electrobomba', inicial: null, final: null },
      ],
      vara: { inicialMedida: '22 pulg', inicialGalones: 980, finalMedida: '61 pulg', finalGalones: 7080 },
    },
    controles: base.controles.map((c) => ({ ...c, respuesta: c.numero <= 5 || c.numero === 7 || c.numero === 8 || c.numero === 9 || c.numero === 10 })),
    fotos: Array.from({ length: 8 }, (_, i) => ({ id: `f5e0b-${i + 1}`, orden: i + 1, descripcion: `Foto ${i + 1}`, tamanoBytes: 240000 })),
    firmas: [
      { rol: 'AuditorActuante1', nombreFirmante: 'José M. Guzmán', cedula: null, modo: 'Predeterminada', firmadoEn: '2026-10-18T16:10:00Z', usuarioId: null },
      { rol: 'EncargadoRecibir', nombreFirmante: 'Luis Ferreras', cedula: null, modo: 'EnEstaTablet', firmadoEn: '2026-10-18T16:12:00Z', usuarioId: null },
      { rol: 'RepresentanteProveedor', nombreFirmante: 'Félix Santana', cedula: null, modo: 'EnEstaTablet', firmadoEn: '2026-10-18T16:14:00Z', usuarioId: null },
      { rol: 'AuditorCierre1', nombreFirmante: 'José M. Guzmán', cedula: null, modo: 'Predeterminada', firmadoEn: '2026-10-18T16:20:00Z', usuarioId: null },
      { rol: 'AuditorCierre2', nombreFirmante: 'Ana L. Pérez', cedula: null, modo: 'EnSuEquipo', firmadoEn: '2026-10-18T16:25:00Z', usuarioId: null },
    ],
  };
}

/** Línea de tiempo del panel «Versiones» (3 versiones; la 3 es la vigente). */
export const VERSIONES_5E0B: VersionDto[] = [
  {
    version: 3,
    creadoEn: '2026-10-19T14:22:00Z',
    creadoPor: 'José M. Guzmán',
    resumen: 'Corrigió galones EGEHID y firma del Auditor actuante 2',
    vigente: true,
    cambios: [
      { campo: 'Galones medidos EGEHID', valorAnterior: '6,080.00', valorNuevo: '6,100.00' },
      { campo: 'Diferencia', valorAnterior: '−68.75', valorNuevo: '−48.75' },
      { campo: 'Firma · Auditor actuante 2', valorAnterior: 'sha256 9f2c…', valorNuevo: 'sha256 41ab…' },
    ],
  },
  {
    version: 2,
    creadoEn: '2026-10-18T20:45:00Z',
    creadoPor: 'María Rosario (administradora)',
    resumen: 'Agregó observación en control 11 y 2 fotos',
    vigente: false,
    cambios: [{ campo: 'Observación · control 11', valorAnterior: null, valorNuevo: 'Sin derrames' }],
  },
  {
    version: 1,
    creadoEn: '2026-10-18T16:31:00Z',
    creadoPor: 'José M. Guzmán',
    resumen: 'Registro finalizado y PDF generado',
    vigente: false,
    cambios: [],
  },
];
