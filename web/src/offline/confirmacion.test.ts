import { describe, expect, it } from 'vitest';
import { aCuerpoPut, nuevaFiscalizacion } from '../domain/fiscalizacion';
import { diferencias, esSaludDeLaApi, exigirRegistro, RespuestaNoConfiable, sha256 } from './confirmacion';

const ID = 'a3f921c0-0000-4000-8000-000000000000';
const registro = () => ({ ...nuevaFiscalizacion(ID, '2026-10-20'), numero: 'A3F9-21C0', estado: 'Borrador' as const });

describe('confirmación de envío', () => {
  it('solo /salud de esta API cuenta como conexión (no un portal de Wi-Fi)', () => {
    expect(esSaludDeLaApi({ estado: 'ok', servicio: 'fiscalizacion-egehid' })).toBe(true);
    expect(esSaludDeLaApi({ estado: 'ok' })).toBe(false);
    expect(esSaludDeLaApi('<html>Inicie sesión en la red</html>')).toBe(false);
    expect(esSaludDeLaApi(null)).toBe(false);
  });

  it('exige que la respuesta sea el mismo registro', () => {
    expect(exigirRegistro(registro(), ID).id).toBe(ID);
    expect(() => exigirRegistro({ ...registro(), id: 'otro' }, ID)).toThrow(RespuestaNoConfiable);
    expect(() => exigirRegistro({ id: ID }, ID)).toThrow(RespuestaNoConfiable);
    expect(() => exigirRegistro(undefined, ID)).toThrow(RespuestaNoConfiable);
  });

  it('compara como guarda la API: empresa en texto libre por nombre, horas y decimales', () => {
    const enviado = registro();
    enviado.suplidor = { ...enviado.suplidor, nombre: 'gulf  dominicana ', suplidorId: null };
    const guardado = { ...registro(), suplidor: { ...enviado.suplidor, nombre: 'gulf  dominicana', suplidorId: 4 } };
    expect(diferencias(aCuerpoPut(enviado), guardado)).toEqual([]);
    guardado.suplidor = { ...guardado.suplidor, nombre: 'Otra empresa' };
    expect(diferencias(aCuerpoPut(enviado), guardado)).toEqual(['suplidor.nombre']);
  });

  it('detecta un control o una lectura que no se guardó', () => {
    const enviado = registro();
    enviado.controles = enviado.controles.map((c) => (c.numero === 6 ? { ...c, respuesta: true, observacion: 'Agua' } : c));
    enviado.mediciones = { ...enviado.mediciones, lecturas: [{ equipo: 'MedidorDigital', inicial: 10, final: 20 }] };
    const d = diferencias(aCuerpoPut(enviado), registro());
    expect(d).toContain('control.6');
    expect(d).toContain('control.6.observacion');
    expect(d).toContain('lecturas.MedidorDigital.inicial');
  });

  it('huella SHA-256 en hex como la de la API', async () => {
    expect(await sha256(new Blob(['abc']))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
