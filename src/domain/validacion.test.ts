import { describe, expect, it } from 'vitest';
import type { FiscalizacionDto, RolFirma } from '../api/types';
import { nuevaFiscalizacion, ROLES_FIRMA, fusionarEditable } from './fiscalizacion';
import {
  calcularPendientes,
  estadoSeccion,
  observacionFaltante,
  pendientesControles,
  pendientesPorSeccion,
  pendientesVisita,
  puedeFinalizar,
  validarFinalizacion,
} from './validacion';

function completa(): FiscalizacionDto {
  const f = nuevaFiscalizacion('a3f921c0-0000-4000-8000-000000000000', '2026-10-20');
  f.visita = { fecha: '2026-10-20', horaSalida: '07:15', inicioProceso: '09:05', locacionId: 1, horaLlegada: '08:40', finProceso: '11:20' };
  f.suplidor = { fichaCamion: 'FT-221', chofer: 'Ramón', placa: 'L-384920', conduce: 'CD-1', suplidorId: 1, totalEntregarGal: 8000 };
  f.empresa = { fichaCamion2: null, chofer2: null, responsable: 'Ing. Carlos Méndez', totalRecibirGal: 8000 };
  f.mediciones = { ...f.mediciones, productoId: 1, galonesProveedor: 4212.4, galonesEgehid: 4200 };
  f.controles = f.controles.map((c) => ({ ...c, respuesta: false }));
  const requeridas: RolFirma[] = ['AuditorActuante1', 'EncargadoRecibir', 'SupervisorCombustibles', 'RepresentanteProveedor'];
  f.firmas = requeridas.map((rol) => ({ rol, nombreFirmante: 'X', cedula: null, modo: 'EnEstaTablet', firmadoEn: '2026-10-20T10:00:00Z', usuarioId: null }));
  return f;
}

const conControl = (f: FiscalizacionDto, numero: number, respuesta: boolean | null, observacion: string | null) => ({
  ...f,
  controles: f.controles.map((c) => (c.numero === numero ? { numero, respuesta, observacion } : c)),
});

describe('regla de observación obligatoria (controles 6, 11 y 12)', () => {
  it.each([6, 11, 12])('control %i con Sí y sin observación queda pendiente', (n) => {
    const f = conControl(completa(), n, true, null);
    expect(pendientesControles(f)).toEqual([`El control ${n} respondió Sí: la observación es obligatoria.`]);
    expect(puedeFinalizar(f)).toBe(false);
  });

  it.each([6, 11, 12])('control %i con Sí y observación en blanco también queda pendiente', (n) => {
    expect(puedeFinalizar(conControl(completa(), n, true, '   '))).toBe(false);
  });

  it('con observación o respondiendo No ya no hay pendiente', () => {
    expect(puedeFinalizar(conControl(completa(), 6, true, 'Agua en el fondo del tanque 2'))).toBe(true);
    expect(puedeFinalizar(conControl(completa(), 11, false, null))).toBe(true);
  });

  it('los demás controles no exigen observación al responder Sí', () => {
    expect(puedeFinalizar(conControl(completa(), 1, true, null))).toBe(true);
    expect(observacionFaltante({ observacionObligatoriaSiSi: false }, true, null)).toBe(false);
  });

  it('sin responder: un pendiente por control', () => {
    const f = conControl(completa(), 3, null, null);
    expect(pendientesControles(f)).toEqual(['Falta responder el control 3.']);
  });
});

describe('pendientes por sección', () => {
  it('un registro completo no tiene pendientes y puede finalizar', () => {
    expect(validarFinalizacion(completa())).toEqual([]);
  });

  it('trae las 6 claves de la API, vacías si no hay', () => {
    expect(Object.keys(calcularPendientes(completa())).sort()).toEqual(
      ['controles', 'firmas', 'fotos', 'mediciones', 'suplidor', 'visita'].sort(),
    );
  });

  it('visita: falta fin del proceso y fin anterior al inicio', () => {
    const f = completa();
    expect(pendientesVisita({ ...f, visita: { ...f.visita, finProceso: null } })).toEqual(['Falta la hora de fin del proceso.']);
    expect(pendientesVisita({ ...f, visita: { ...f.visita, finProceso: '08:00' } })).toEqual(['El fin del proceso es anterior al inicio.']);
  });

  it('firmas requeridas por la API (4) — las opcionales no bloquean', () => {
    expect(ROLES_FIRMA.filter((r) => r.requerida).map((r) => r.rol)).toEqual([
      'AuditorActuante1',
      'EncargadoRecibir',
      'SupervisorCombustibles',
      'RepresentanteProveedor',
    ]);
    const f = completa();
    const sin = { ...f, firmas: f.firmas!.filter((x) => x.rol !== 'SupervisorCombustibles') };
    expect(calcularPendientes(sin).firmas).toEqual(['Falta la firma de Supervisor de combustibles.']);
  });

  it('mediciones y suplidor incompletos bloquean finalizar', () => {
    const f = nuevaFiscalizacion('x', '2026-10-20');
    const p = pendientesPorSeccion(f);
    expect(p.mediciones).toContain('Falta el producto.');
    expect(p.visita).toContain('Falta el conduce.'); // suplidor y empresa cuentan en «Visita»
    expect(puedeFinalizar(f)).toBe(false);
  });

  it('estado de sección para el stepper', () => {
    const f = nuevaFiscalizacion('x', '2026-10-20');
    const p = pendientesPorSeccion(f);
    expect(estadoSeccion(f, 'visita', p)).toBe('sin-iniciar');
    const g = { ...f, visita: { ...f.visita, horaSalida: '07:15' } };
    expect(estadoSeccion(g, 'visita', pendientesPorSeccion(g))).toBe('pendiente');
    const c = completa();
    expect(estadoSeccion(c, 'visita', pendientesPorSeccion(c))).toBe('completa');
  });
});

describe('fusionarEditable', () => {
  it('conserva rowVersion/firmas del guardado y toma lo editable de la pantalla', () => {
    const base = { ...completa(), rowVersion: 'AAAAAAAAB9s=', numero: 'A3F9-21C0' };
    const pantalla = { ...completa(), rowVersion: 'viejo', numero: null, observacionesGenerales: 'nuevo texto' };
    const r = fusionarEditable(base, pantalla);
    expect(r.rowVersion).toBe('AAAAAAAAB9s=');
    expect(r.numero).toBe('A3F9-21C0');
    expect(r.observacionesGenerales).toBe('nuevo texto');
  });
});
