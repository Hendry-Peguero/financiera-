import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { nuevaFiscalizacion } from '../domain/fiscalizacion';
import { useBorrador } from '../formulario/useBorrador';
import { conservarMisCambios, crearBorradorLocal, guardarBorradorLocal, usarVersionServidor } from './sync';

const ID = 'b0000000-0000-4000-8000-000000000001';

beforeEach(async () => {
  await db.borradores.clear();
  await db.cola.clear();
});

describe('borradores en IndexedDB', () => {
  it('guardar desde la pantalla no pisa el rowVersion guardado tras sincronizar', async () => {
    await crearBorradorLocal(nuevaFiscalizacion(ID));
    const b = (await db.borradores.get(ID))!;
    await db.borradores.put({ ...b, datos: { ...b.datos, rowVersion: 'AAAAAAAAB9s=', numero: 'B000-0000' } });

    // estado viejo de React (sin rowVersion) con un cambio editable
    await guardarBorradorLocal({ ...nuevaFiscalizacion(ID), observacionesGenerales: 'hola' });
    const g = (await db.borradores.get(ID))!;
    expect(g.datos.rowVersion).toBe('AAAAAAAAB9s=');
    expect(g.datos.numero).toBe('B000-0000');
    expect(g.datos.observacionesGenerales).toBe('hola');
    expect(g.pendiente).toBe(true);
    expect(await db.cola.get(`put:${ID}`)).toBeTruthy();
  });

  it('409 → «usar versión del servidor» reemplaza lo local por `actual`', async () => {
    await crearBorradorLocal({ ...nuevaFiscalizacion(ID), observacionesGenerales: 'mío' });
    const b = (await db.borradores.get(ID))!;
    const actual = { ...nuevaFiscalizacion(ID), rowVersion: 'srv', estado: 'Borrador' as const, observacionesGenerales: 'del servidor' };
    await db.borradores.put({ ...b, conflicto: 'El registro cambió en otro equipo.', conflictoActual: actual });
    await usarVersionServidor(ID);
    const r = (await db.borradores.get(ID))!;
    expect(r.conflicto).toBeNull();
    expect(r.datos.observacionesGenerales).toBe('del servidor');
    expect(r.datos.rowVersion).toBe('srv');
    expect(r.pendiente).toBe(false);
  });

  it('409 → «conservar mis cambios» reenvía con el rowVersion vigente', async () => {
    await crearBorradorLocal({ ...nuevaFiscalizacion(ID), observacionesGenerales: 'mío' });
    await db.cola.clear();
    const b = (await db.borradores.get(ID))!;
    const actual = { ...nuevaFiscalizacion(ID), rowVersion: 'srv2', estado: 'Borrador' as const };
    await db.borradores.put({ ...b, conflicto: 'x', conflictoActual: actual });
    await conservarMisCambios(ID);
    const r = (await db.borradores.get(ID))!;
    expect(r.conflicto).toBeNull();
    expect(r.datos.rowVersion).toBe('srv2');
    expect(r.datos.observacionesGenerales).toBe('mío');
    expect(await db.cola.get(`put:${ID}`)).toBeTruthy();
  });
});

describe('useBorrador (autoguardado)', () => {
  it('guarda en la tablet 500 ms después del último cambio', async () => {
    await crearBorradorLocal(nuevaFiscalizacion(ID));
    const { result } = renderHook(() => useBorrador(ID));
    await waitFor(() => expect(result.current.estado).toBe('listo'));
    const antes = (await db.borradores.get(ID))!.actualizadoLocal;
    act(() => result.current.actualizar((d) => ({ ...d, suplidor: { ...d.suplidor, chofer: 'Ramón' } })));
    expect(result.current.datos?.suplidor.chofer).toBe('Ramón');
    expect((await db.borradores.get(ID))!.datos.suplidor.chofer).toBeNull();
    await waitFor(async () => expect((await db.borradores.get(ID))!.datos.suplidor.chofer).toBe('Ramón'), { timeout: 2000 });
    expect((await db.borradores.get(ID))!.actualizadoLocal).toBeGreaterThanOrEqual(antes);
  });
});
