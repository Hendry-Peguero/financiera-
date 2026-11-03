import type { FirmaDto, FiscalizacionDto, SolicitudFirmaRegistroDto } from '../../api/types';
import { nuevaFiscalizacion } from '../../domain/fiscalizacion';
import { idDe, ID_USUARIO } from './base';

/** Borrador #A3F9-21C0 (C.H. Jigüey · Sunix) de las pantallas del formulario. */
export const ID_A3F9 = idDe('A3F9-21C0');

/** Pantalla «Visita»: falta el fin del proceso; suplidor y empresa completos. */
export function a3f9Visita(): FiscalizacionDto {
  const base = nuevaFiscalizacion(ID_A3F9, '2026-10-20');
  return {
    ...base,
    numero: 'A3F9-21C0',
    estado: 'Borrador',
    rowVersion: 'YTNmOS0x',
    autor: { id: ID_USUARIO, nombreCompleto: 'María Rosario Peña' },
    visita: { fecha: '2026-10-20', horaSalida: '07:15', inicioProceso: '09:05', locacionId: 1, horaLlegada: '08:40', finProceso: null },
    suplidor: { fichaCamion: 'FT-221', chofer: 'Ramón Antonio Peña', placa: 'L-384920', conduce: 'CD-0048213', suplidorId: 1, totalEntregarGal: 8000 },
    empresa: { fichaCamion2: 'FT-305', chofer2: 'José Luis Martínez', responsable: 'Ing. Carlos Méndez', totalRecibirGal: 8000 },
  };
}

/** Pantalla «Mediciones»: totales, lecturas (el dispensador sin final), vara y precio. */
export function a3f9Mediciones(): FiscalizacionDto {
  const b = a3f9Visita();
  return {
    ...b,
    mediciones: {
      productoId: 1,
      galonesProveedor: 4212.4,
      galonesEgehid: 4200,
      precioGalon: 248.6,
      lecturas: [
        { equipo: 'MedidorDigital', inicial: 128450.2, final: 132650.2 },
        { equipo: 'Dispensador', inicial: 56210, final: null },
        { equipo: 'Electrobomba', inicial: 9882.1, final: 14082.4 },
      ],
      vara: { inicialMedida: '34 ½ pulg', inicialGalones: 1520, finalMedida: '58 pulg', finalGalones: 5720 },
    },
  };
}

const firma = (rol: FirmaDto['rol'], nombreFirmante: string, modo: FirmaDto['modo'], hora: string, usuarioId: string | null = null): FirmaDto => ({
  rol,
  nombreFirmante,
  cedula: null,
  modo,
  firmadoEn: `2026-10-20T${hora}:00-04:00`,
  usuarioId,
});

/** Pantalla «Controles y firmas»: 9 de 12 controles respondidos y 4 de 8 firmas. */
export function a3f9Controles(): FiscalizacionDto {
  const b = a3f9Mediciones();
  return {
    ...b,
    controles: b.controles.map((c) =>
      c.numero <= 9
        ? { ...c, respuesta: true, observacion: c.numero === 6 ? 'Agua en el fondo del tanque 2' : null }
        : { ...c, respuesta: null, observacion: null },
    ),
    firmas: [
      firma('AuditorActuante1', 'Ana Lucía Pérez', 'Predeterminada', '09:12'),
      firma('AuditorActuante2', 'José M. Guzmán', 'EnSuEquipo', '09:14'),
      firma('EncargadoRecibir', 'Luis Ferreras', 'EnEstaTablet', '10:02'),
      firma('InspectorActuante', 'María Rosario', 'Predeterminada', '10:31', ID_USUARIO),
    ],
  };
}

/** «Controles y firmas»: acceso ya enviado al supervisor de combustibles (GET /fiscalizaciones/{id}/solicitudes-firma). */
export function solicitudesA3f9(): SolicitudFirmaRegistroDto[] {
  return [
    {
      id: '5011c17d-0000-4000-8000-0000000000a1',
      rol: 'SupervisorCombustibles',
      usuarioDestinoId: '55555555-5555-4555-8555-555555555555',
      firmante: 'Pedro Almonte',
      correoFirmante: 'pedro.almonte@hidroelectrica.gov.do',
      solicitadaPor: 'María Rosario Peña',
      estado: 'Pendiente',
      comentario: null,
      creadaEn: '2026-10-20T10:20:00-04:00',
      expiraEn: '2026-10-27T10:20:00-04:00',
      firmadaEn: null,
    },
  ];
}

/** Pantalla «Fotografías y revisión»: todo completo menos el Auditor de cierre 2; 6 fotos. */
export function a3f9Fotos(): FiscalizacionDto {
  const b = a3f9Controles();
  const descripciones = [
    'Camión cisterna en el área de descarga',
    'Lectura inicial del medidor digital',
    'Presillas de seguridad en válvulas',
    'Medición con vara en tanque 2',
    'Conduce CD-0048213',
    'Lectura final del medidor',
  ];
  return {
    ...b,
    visita: { ...b.visita, finProceso: '11:20' },
    mediciones: { ...b.mediciones, lecturas: b.mediciones.lecturas.map((l) => (l.final == null ? { ...l, final: 60410 } : l)) },
    controles: b.controles.map((c) => ({ ...c, respuesta: c.respuesta ?? false, observacion: c.numero === 10 ? '2026-03-15' : c.observacion })),
    observacionesGenerales:
      'Descarga realizada sin incidentes. Se verificó ausencia de agua en tanque 2 con pasta detectora. La diferencia de 12.40 galones se concilió con el representante del proveedor.',
    fotos: descripciones.map((descripcion, i) => ({ id: `fa3f9-${i + 1}`, orden: i + 1, descripcion, tamanoBytes: 300_000 })),
    firmas: [
      ...(b.firmas ?? []),
      firma('SupervisorCombustibles', 'Pedro Almonte', 'EnSuEquipo', '10:40'),
      firma('RepresentanteProveedor', 'Ramón A. Peña', 'EnEstaTablet', '10:45'),
    ],
  };
}
