import { describe, expect, it } from 'vitest';
import type { FiscalizacionDto } from '../api/types';
import { nuevaFiscalizacion, preguntasDe } from '../domain/fiscalizacion';
import { FORMULARIO, separarNombre, valoresFormulario } from './valoresFormulario';

function muestra(): FiscalizacionDto {
  const f = nuevaFiscalizacion('a3f921c0-0000-4000-8000-000000000000', '2026-10-20');
  f.numero = 'A3F9-21C0';
  f.visita = { fecha: '2026-10-20', horaSalida: '07:15', inicioProceso: '09:05', locacionId: 1, horaLlegada: '08:40', finProceso: '11:20' };
  f.suplidor = { fichaCamion: 'FT-221', chofer: 'Ramón Antonio Peña', placa: 'L-384920', conduce: 'CD-1', suplidorId: 1, totalEntregarGal: 8000 };
  f.empresa = { fichaCamion1: 'FT-118', chofer1: 'Pedro Almonte', fichaCamion2: 'FT-305', chofer2: 'José Luis Martínez', responsable: 'Ing. Carlos Méndez', totalRecibirGal: 8000 };
  f.mediciones = {
    ...f.mediciones,
    productoId: 1,
    galonesProveedor: 4212.4,
    galonesEgehid: 4200,
    precioGalon: 248.6,
    lecturas: [
      { equipo: 'MedidorDigital', inicial: 128450.2, final: 132650.2 },
      { equipo: 'Dispensador', inicial: null, final: null },
      { equipo: 'Electrobomba', inicial: null, final: null },
    ],
    vara: { inicialMedida: '34 ½ pulg', inicialGalones: 1520, finalMedida: '58 pulg', finalGalones: 5720 },
  };
  f.calculos = null as unknown as FiscalizacionDto['calculos'];
  f.controles = f.controles.map((c) =>
    c.numero === 6 ? { ...c, respuesta: true, observacion: 'Agua' } : c.numero === 10 ? { ...c, respuesta: true, observacion: '2026-08-14' } : { ...c, respuesta: false },
  );
  f.firmas = [
    { rol: 'AuditorActuante1', nombreFirmante: 'María Rosario Peña', cedula: '001-1234567-8', modo: 'EnEstaTablet', firmadoEn: '2026-10-20T10:00:00Z', usuarioId: null },
    { rol: 'AuditorCierre1', nombreFirmante: 'Ana Lucía Pérez', cedula: null, modo: 'EnEstaTablet', firmadoEn: '2026-10-20T10:00:00Z', usuarioId: null },
  ];
  return f;
}

describe('formulario en papel (plantilla oficial)', () => {
  it('cada valor tiene su celda en formularioOficial.json', () => {
    const v = valoresFormulario(muestra(), { locacion: 'C.H. Jigüey', suplidor: 'Sunix', preguntas: preguntasDe(undefined) });
    const ids = new Set(FORMULARIO.campos.map((c) => c.id));
    expect(Object.keys(v).filter((k) => !ids.has(k))).toEqual([]);
    expect(v.fecha.texto).toBe('20/10/2026');
    expect(v.hora_salida.texto).toBe('07:15 AM');
    expect(v.empresa_ficha_camion.texto).toBe('FT-118'); // propio de la empresa, no copia al suplidor
    expect(v.empresa_chofer.texto).toBe('Pedro Almonte');
    expect(v.ficha_camion_2.texto).toBe('FT-305');
    expect(v.diferencia_gal.texto).toBe('−12.40 (−0.29 %)');
    expect(v.medidor_digital_diferencia.texto).toBe('4,200.00');
    expect(v.dispensador_inicial).toBeUndefined();
    expect(v.vara_diferencia_galones.texto).toBe('4,200.00 gal');
    expect(v.control_6.texto).toBe('X');
    expect(v.control_6_no).toBeUndefined();
    expect(v.control_1_no.texto).toBe('X');
    expect(v.control_10_obs.texto).toBe('14/08/2026');
    expect(v.auditor_actuante_1_nombre.texto).toBe('María');
    expect(v.auditor_actuante_1_apellido.texto).toBe('Rosario Peña');
    expect(v.firma_auditor_cierre_1).toEqual({ firma: 'Ana Lucía Pérez', pie: 'Ana Lucía Pérez' });
    expect(v.firma_auditor_uai).toBeUndefined();
    expect(v.importe_egehid.texto).toBe('1,044,120.00');
  });

  it('el encabezado del documento sale de la plantilla oficial', () => {
    const v = valoresFormulario(muestra(), {
      preguntas: [],
      encabezado: { codigo: 'FO-UAI-2026-014', version: '002', fechaElaboracion: '2026-09-01', fechaAprobacion: null },
    });
    expect(v.doc_codigo.texto).toBe('FO-UAI-2026-014');
    expect(v.doc_fecha_elaboracion.texto).toBe('01/09/2026');
    expect(v.doc_fecha_aprobacion).toBeUndefined();
  });

  it.each([
    ['María Rosario Peña', 'María', 'Rosario Peña'],
    ['José M. Guzmán', 'José M.', 'Guzmán'],
    ['Ing. Carlos Méndez', 'Ing. Carlos', 'Méndez'],
    ['Ana Lucía Pérez Gómez', 'Ana Lucía', 'Pérez Gómez'],
    ['Luis', 'Luis', null],
  ])('separa «%s» en nombre y apellidos', (completo, nombre, apellido) => {
    expect(separarNombre(completo)).toEqual({ nombre, apellido });
  });
});
