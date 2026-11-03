import type { FiscalizacionDto } from '../../api/types';
import { nuevaFiscalizacion } from '../../domain/fiscalizacion';
import { idDe, ID_USUARIO, LISTA } from './base';

/** «Actividad reciente» de desktop-inicio.html (8 filas). */
export const RECIENTES = LISTA.slice(0, 8).map((f) => {
  if (f.numero === '7C21-9A04') return { ...f, diferenciaGal: 0 };
  if (f.numero === 'C08E-5F30') return { ...f, galonesEgehid: 1780, diferenciaGal: 0 };
  return f;
});

/**
 * Borrador #7C21-9A04 (C.H. Aguacate) de la tarjeta «Continuar borrador» del móvil:
 * 5 de 7 secciones completas y faltan las firmas de cierre.
 */
export function borrador7c21(): FiscalizacionDto {
  const base = nuevaFiscalizacion(idDe('7C21-9A04'), '2026-10-19');
  return {
    ...base,
    numero: '7C21-9A04',
    estado: 'Borrador',
    rowVersion: 'cnYtMQ==',
    autor: { id: ID_USUARIO, nombreCompleto: 'María Rosario Peña' },
    visita: { fecha: '2026-10-19', horaSalida: '06:30', inicioProceso: '08:10', locacionId: 2, horaLlegada: '07:45', finProceso: '10:05' },
    suplidor: { fichaCamion: 'FT-118', chofer: 'Pedro Almonte', placa: 'L-275114', conduce: 'CD-0047990', suplidorId: 2, totalEntregarGal: 3850 },
    empresa: { fichaCamion2: 'FT-305', chofer2: 'José Luis Martínez', responsable: 'Ing. Carlos Méndez', totalRecibirGal: 3850 },
    mediciones: {
      ...base.mediciones,
      productoId: 1,
      galonesProveedor: 3850,
      galonesEgehid: 3850,
      precioGalon: 248.6,
    },
    controles: base.controles.map((c) => ({ ...c, respuesta: false })),
    fotos: [{ id: 'f7c21-1', orden: 1, descripcion: 'Camión en el área de descarga', tamanoBytes: 245000 }],
    firmas: [
      { rol: 'AuditorActuante1', nombreFirmante: 'Ana Lucía Pérez', cedula: null, modo: 'Predeterminada', firmadoEn: '2026-10-19T12:10:00Z', usuarioId: null },
      { rol: 'EncargadoRecibir', nombreFirmante: 'Luis Ferreras', cedula: null, modo: 'EnEstaTablet', firmadoEn: '2026-10-19T13:02:00Z', usuarioId: null },
      { rol: 'RepresentanteProveedor', nombreFirmante: 'Pedro Almonte', cedula: null, modo: 'EnEstaTablet', firmadoEn: '2026-10-19T13:05:00Z', usuarioId: null },
    ],
  };
}
