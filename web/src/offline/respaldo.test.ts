import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/db';
import { nuevaFiscalizacion } from '../domain/fiscalizacion';
import { crearRespaldo, ErrorRespaldo, recuperarRespaldo, resumenLocal } from './respaldo';

const CORREO = 'auditor@egehid.gob.do';
const CLAVE = 'una-clave-larga';

// fake-indexeddb clona los Blob de jsdom como objetos simples: las fotos se leen y se capturan con espías.
const FOTO = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/jpeg' });

async function sembrar() {
  const datos = nuevaFiscalizacion('b1b1b1b1-0000-4000-8000-000000000000', '2026-10-20');
  await db.borradores.put({
    id: datos.id,
    datos,
    actualizadoLocal: 1,
    sincronizadoEn: null,
    pendiente: true,
    modo: 'borrador',
    conflicto: null,
    ultimoError: null,
  });
  await db.fotos.put({
    id: 'foto-1',
    fiscalizacionId: datos.id,
    orden: 1,
    descripcion: 'Camión',
    blob: FOTO,
    tamanoBytes: 4,
    tomadaEn: 1,
    servidorId: null,
  });
  await db.cola.put({ clave: `put:${datos.id}`, tipo: 'put', fiscalizacionId: datos.id, refId: null, creadoEn: 1, intentos: 0, ultimoError: null });
}

describe('respaldo cifrado .fisc', () => {
  beforeEach(async () => {
    await Promise.all([db.borradores.clear(), db.fotos.clear(), db.cola.clear()]);
  });
  afterEach(() => vi.restoreAllMocks());

  it('exige contraseña de 10 caracteres', async () => {
    await expect(crearRespaldo('corta', CORREO)).rejects.toBeInstanceOf(ErrorRespaldo);
  });

  it('cifra y recupera solo lo que falta, con el mismo correo', async () => {
    await sembrar();
    const fotos = await db.fotos.toArray();
    vi.spyOn(db.fotos, 'toArray').mockResolvedValue(fotos.map((f) => ({ ...f, blob: FOTO })));
    const { archivo, nombre } = await crearRespaldo(CLAVE, CORREO);
    expect(nombre).toMatch(/\.fisc$/);
    const texto = await archivo.text();
    expect(texto).not.toContain('Camión');

    await expect(recuperarRespaldo(texto, CLAVE, 'otro@egehid.gob.do')).rejects.toThrow('otro correo');
    await expect(recuperarRespaldo(texto, 'clave-incorrecta', CORREO)).rejects.toThrow('Contraseña incorrecta');

    // Con todo presente no agrega nada.
    expect(await recuperarRespaldo(texto, CLAVE, CORREO)).toEqual({ borradores: 0, fotos: 0, tareas: 0, omitidos: 2 });

    await Promise.all([db.borradores.clear(), db.fotos.clear(), db.cola.clear()]);
    const agregar = vi.spyOn(db.fotos, 'add');
    expect(await recuperarRespaldo(texto, CLAVE, CORREO)).toEqual({ borradores: 1, fotos: 1, tareas: 1, omitidos: 0 });
    const foto = agregar.mock.calls[0][0];
    expect(foto.descripcion).toBe('Camión');
    expect(foto.blob.type).toBe('image/jpeg');
    expect(new Uint8Array(await foto.blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(await resumenLocal()).toMatchObject({ borradores: 1, fotos: 1, pendientes: 1 });
  });
});
