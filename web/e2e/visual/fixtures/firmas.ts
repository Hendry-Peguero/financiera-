import type { FiscalizacionDto, FirmaDto, SolicitudFirmaDto, UsuarioBusquedaDto, UsuarioDto } from '../../../src/api/types';
import { nuevaFiscalizacion } from '../../../src/domain/fiscalizacion';
import { idDe, ID_USUARIO, MARIA, type Escenario } from './base';
import { solicitudesA3f9 } from './formulario';

/** Fiscalización #A3F9-21C0 de las pantallas de Firmas (C.H. Jigüey · Isla Dominicana · 4,200.00 gal · -12.40). */
export const ID_A3F9 = idDe('A3F9-21C0');
export const ID_SOLICITUD = '5011c17d-0000-4000-8000-0000000000c2';

const firma = (rol: FirmaDto['rol'], nombreFirmante: string, hora: string, modo: FirmaDto['modo'], usuarioId: string | null = null): FirmaDto => ({
  rol,
  nombreFirmante,
  cedula: null,
  modo,
  firmadoEn: `2026-10-20T${hora}:00-04:00`,
  usuarioId,
});

/** Las 4 firmas ya registradas («4 de 8 firmadas»). */
export const FIRMAS_REGISTRADAS: FirmaDto[] = [
  firma('AuditorActuante1', 'Ana Lucía Pérez', '09:12', 'Predeterminada'),
  firma('AuditorActuante2', 'José M. Guzmán', '09:14', 'EnSuEquipo'),
  firma('EncargadoRecibir', 'Luis Ferreras', '10:02', 'EnEstaTablet'),
  firma('AuditorCierre1', 'María Rosario', '10:31', 'Predeterminada', ID_USUARIO),
];

/** Registro completo, listo para las firmas de cierre (Revisar y firmar). */
export function a3f9ParaFirmar(): FiscalizacionDto {
  const base = nuevaFiscalizacion(ID_A3F9, '2026-10-21');
  return {
    ...base,
    numero: 'A3F9-21C0',
    estado: 'Borrador',
    rowVersion: 'cnYtMg==',
    autor: { id: ID_USUARIO, nombreCompleto: 'María Rosario Peña' },
    visita: { fecha: '2026-10-21', horaSalida: '06:30', inicioProceso: '08:10', locacionId: 1, horaLlegada: '07:45', finProceso: '10:05' },
    suplidor: { fichaCamion: 'FT-118', chofer: 'Ramón A. Peña', placa: 'L-275114', conduce: 'CD-0048112', suplidorId: 2, totalEntregarGal: 4212.4 },
    empresa: { fichaCamion2: 'FT-305', chofer2: 'José Luis Martínez', responsable: 'Ing. Carlos Méndez', totalRecibirGal: 4200 },
    mediciones: { ...base.mediciones, productoId: 1, galonesProveedor: 4212.4, galonesEgehid: 4200, precioGalon: 248.6 },
    controles: base.controles.map((c) => ({
      ...c,
      respuesta: [6, 11, 12].includes(c.numero) ? true : false,
      observacion: [6, 11, 12].includes(c.numero) ? 'Ver detalle en el acta.' : null,
    })),
    observacionesGenerales: 'Llegada con 15 minutos de retraso por tránsito en la carretera de Ocoa.',
    fotos: Array.from({ length: 18 }, (_, i) => ({ id: `fa3f9-${i + 1}`, orden: i + 1, descripcion: null, tamanoBytes: 240000 })),
    firmas: FIRMAS_REGISTRADAS,
  };
}

/** Borrador en curso (fondo de «Dar acceso»): visita sin fin del proceso y 4 de 8 firmas. */
export function a3f9EnCurso(): FiscalizacionDto {
  const f = a3f9ParaFirmar();
  return { ...f, visita: { ...f.visita, finProceso: null }, observacionesGenerales: null, fotos: f.fotos?.slice(0, 6) };
}

/** Ana Pérez, Auditora UAI: la firmante a quien María Rosario pidió la firma de «Auditor de cierre 2». */
export const ANA: UsuarioDto = {
  id: '22222222-2222-4222-8222-222222222222',
  correo: 'ana.perez@hidroelectrica.gov.do',
  nombreCompleto: 'Ana Pérez',
  cargo: 'Auditora UAI',
  rol: 'Firmante',
  tieneFirma: true,
  esPropietarioBitacora: false,
  perfilCompleto: true,
};

export const SOLICITUD: SolicitudFirmaDto = {
  id: ID_SOLICITUD,
  fiscalizacionId: ID_A3F9,
  numero: 'A3F9-21C0',
  rol: 'AuditorCierre2',
  solicitadaPor: 'María Rosario Peña',
  creadaEn: '2026-10-20T10:35:00-04:00',
  expiraEn: '2026-10-27T10:35:00-04:00',
  estado: 'Pendiente',
};

/** Resultados de «ana» en «¿Quién debe firmar?». */
export const USUARIOS_ANA: UsuarioBusquedaDto[] = [
  { id: ANA.id, nombreCompleto: 'Ana Pérez', cargo: 'Auditora · Unidad de Auditoría Interna', tieneFirma: true },
  { id: '33333333-3333-4333-8333-333333333333', nombreCompleto: 'Ana M. Castillo', cargo: 'Supervisora de combustibles', tieneFirma: false },
];

export function escenarioFirmarEnTablet(esc: Escenario): void {
  esc.me = MARIA;
  esc.detalle[ID_A3F9] = a3f9EnCurso();
}

export function escenarioRevisar(esc: Escenario, meFirma: string | null): void {
  esc.me = ANA;
  esc.meFirma = meFirma;
  esc.solicitudes = [SOLICITUD];
  esc.detalle[ID_A3F9] = a3f9ParaFirmar();
}

/** «Dar acceso» se abre sobre el formulario en curso (`fondo`). */
export function escenarioDarAcceso(esc: Escenario, fondo: FiscalizacionDto = a3f9EnCurso()): void {
  esc.detalle[ID_A3F9] = fondo;
  esc.solicitudesRegistro[ID_A3F9] = solicitudesA3f9();
  esc.usuarios = USUARIOS_ANA;
}
