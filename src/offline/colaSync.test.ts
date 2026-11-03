import { describe, expect, it, vi } from 'vitest';
import { ApiError, RedError } from '../api/client';
import type { FiscalizacionDto, FotoDto } from '../api/types';
import type { BorradorLocal, FotoLocal, TareaSync } from '../db/db';
import { nuevaFiscalizacion } from '../domain/fiscalizacion';
import { encolarFinalizar, encolarFoto, encolarPut, procesarCola, type AlmacenSync, type RemotoSync } from './colaSync';
import { sha256 } from './confirmacion';

class Memoria implements AlmacenSync {
  t = new Map<string, TareaSync>();
  b = new Map<string, BorradorLocal>();
  f = new Map<string, FotoLocal>();
  async tareas() {
    return [...this.t.values()];
  }
  async guardarTarea(x: TareaSync) {
    this.t.set(x.clave, x);
  }
  async borrarTarea(c: string) {
    this.t.delete(c);
  }
  async borrador(id: string) {
    return this.b.get(id);
  }
  async guardarBorrador(x: BorradorLocal) {
    this.b.set(x.id, x);
  }
  async foto(id: string) {
    return this.f.get(id);
  }
  async guardarFoto(x: FotoLocal) {
    this.f.set(x.id, x);
  }
}

const ID = 'a3f921c0-0000-4000-8000-000000000000';

function borrador(extra: Partial<BorradorLocal> = {}): BorradorLocal {
  return {
    id: ID,
    datos: nuevaFiscalizacion(ID, '2026-10-20'),
    actualizadoLocal: 1,
    sincronizadoEn: null,
    pendiente: true,
    modo: 'borrador',
    conflicto: null,
    ultimoError: null,
    ...extra,
  };
}

function respuesta(rowVersion: string, extra: Partial<FiscalizacionDto> = {}): FiscalizacionDto {
  return { ...nuevaFiscalizacion(ID, '2026-10-20'), numero: 'A3F9-21C0', estado: 'Borrador', rowVersion, ...extra };
}

function remoto(put: RemotoSync['put'], extra: Partial<RemotoSync> = {}): RemotoSync {
  return {
    salud: vi.fn(async () => true),
    put,
    // el servidor guarda la foto con el id y la huella que manda la tablet
    subirFoto: vi.fn(async (_f: string, foto: FotoLocal, huella: string): Promise<FotoDto> => ({
      id: foto.id,
      orden: foto.orden,
      descripcion: null,
      tamanoBytes: foto.tamanoBytes,
      sha256: huella,
    })),
    borrarFoto: vi.fn(async () => {}),
    finalizar: vi.fn(async () => respuesta('rv-fin', { estado: 'Finalizado', versionActual: 1 })),
    obtener: vi.fn(async () => respuesta('rv-fin', { estado: 'Finalizado', versionActual: 1 })),
    ...extra,
  };
}

function fotoLocal(id = 'f1'): FotoLocal {
  return {
    id,
    fiscalizacionId: ID,
    orden: 1,
    descripcion: '',
    blob: new Blob(['abc'], { type: 'image/jpeg' }),
    tamanoBytes: 3,
    tomadaEn: 1,
    servidorId: null,
  };
}

describe('cola de sincronización', () => {
  it('crea con rowVersion null y guarda el rowVersion devuelto para el siguiente PUT', async () => {
    const a = new Memoria();
    a.b.set(ID, borrador());
    await encolarPut(a, ID);
    const put = vi.fn(async (_id: string, _cuerpo: unknown) => respuesta("AAAAAAAAB9s="));
    const r = await procesarCola(a, remoto(put), () => 99);
    expect(r.enviadas).toBe(1);
    expect(put).toHaveBeenCalledWith(ID, expect.objectContaining({ rowVersion: null }));
    expect(put.mock.calls[0][1]).not.toHaveProperty('id');
    const b = a.b.get(ID)!;
    expect(b.datos.rowVersion).toBe('AAAAAAAAB9s=');
    expect(b.datos.numero).toBe('A3F9-21C0');
    expect(b.pendiente).toBe(false);
    expect(b.sincronizadoEn).toBe(99);
    expect(a.t.size).toBe(0);

    // siguiente cambio: se envía el rowVersion vigente
    a.b.set(ID, { ...b, pendiente: true, actualizadoLocal: 100 });
    await encolarPut(a, ID);
    const put2 = vi.fn(async () => respuesta('AAAAAAAAB9w='));
    await procesarCola(a, remoto(put2));
    expect(put2).toHaveBeenCalledWith(ID, expect.objectContaining({ rowVersion: 'AAAAAAAAB9s=' }));
    expect(a.b.get(ID)!.datos.rowVersion).toBe('AAAAAAAAB9w=');
  });

  it('409: marca conflicto, guarda `actual` del servidor y no reintenta a ciegas', async () => {
    const a = new Memoria();
    a.b.set(ID, borrador({ datos: { ...nuevaFiscalizacion(ID), rowVersion: 'viejo' } }));
    await encolarPut(a, ID);
    const actual = respuesta('nuevo', { observacionesGenerales: 'cambio en otro equipo' });
    const put = vi.fn(async () => {
      throw new ApiError(409, { status: 409, title: 'El registro cambió en otro equipo.', actual });
    });
    const r = await procesarCola(a, remoto(put));
    expect(r.conflictos).toEqual([ID]);
    const b = a.b.get(ID)!;
    expect(b.conflicto).toBe('El registro cambió en otro equipo.');
    expect(b.conflictoActual?.rowVersion).toBe('nuevo');
    expect(b.conflictoActual?.observacionesGenerales).toBe('cambio en otro equipo');
    expect(a.t.size).toBe(0);

    // con el conflicto pendiente de decisión, un nuevo PUT encolado no se envía
    await encolarPut(a, ID);
    await procesarCola(a, remoto(put));
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('sin red: se detiene y conserva la tarea', async () => {
    const a = new Memoria();
    a.b.set(ID, borrador());
    await encolarPut(a, ID);
    const r = await procesarCola(a, remoto(async () => {
      throw new RedError(new TypeError('Failed to fetch'));
    }));
    expect(r.sinRed).toBe(true);
    expect(a.t.size).toBe(1);
    expect(a.b.get(ID)!.pendiente).toBe(true);
  });

  it('cambios hechos mientras se enviaba: mantiene la tarea y no los pisa', async () => {
    const a = new Memoria();
    a.b.set(ID, borrador({ actualizadoLocal: 1 }));
    await encolarPut(a, ID);
    const put = vi.fn(async () => {
      const b = a.b.get(ID)!;
      a.b.set(ID, { ...b, actualizadoLocal: 2, datos: { ...b.datos, observacionesGenerales: 'escrito durante el envío' } });
      return respuesta('rv1');
    });
    await procesarCola(a, remoto(put));
    const b = a.b.get(ID)!;
    expect(b.datos.observacionesGenerales).toBe('escrito durante el envío');
    expect(b.datos.rowVersion).toBe('rv1');
    expect(b.pendiente).toBe(true);
    expect(a.t.size).toBe(1);
  });

  it('las fotos esperan a que el registro exista en el servidor; luego se suben', async () => {
    const a = new Memoria();
    a.b.set(ID, borrador());
    const foto = fotoLocal();
    a.f.set('f1', foto);
    await encolarFoto(a, foto, 0);
    const rem = remoto(async () => {
      throw new RedError(null);
    });
    await procesarCola(a, rem);
    expect(rem.subirFoto).not.toHaveBeenCalled();

    await encolarPut(a, ID, 1);
    const rem2 = remoto(async () => respuesta('rv1'));
    await procesarCola(a, rem2);
    // la foto se encoló antes que el PUT: en esta pasada el registro aún no existía
    await procesarCola(a, rem2);
    expect(rem2.subirFoto).toHaveBeenCalledTimes(1);
    expect(a.f.get('f1')!.servidorId).toBe('f1');
    expect(a.f.get('f1')!.sha256).toBe(await sha256(new Blob(['abc'])));
    expect(a.t.size).toBe(0);
  });

  it('las correcciones no se envían por la cola (van con POST /corregir)', async () => {
    const a = new Memoria();
    a.b.set(ID, borrador({ modo: 'correccion' }));
    await encolarPut(a, ID);
    const put = vi.fn();
    await procesarCola(a, remoto(put));
    expect(put).not.toHaveBeenCalled();
  });
});

describe('envío confirmado: nada se da por enviado sin que el servidor lo confirme', () => {
  it('Wi-Fi «falsa» (salud no responde la API): no envía nada y conserva la cola', async () => {
    const a = new Memoria();
    a.b.set(ID, borrador());
    await encolarPut(a, ID);
    const put = vi.fn(async () => respuesta('rv1'));
    const r = await procesarCola(a, remoto(put, { salud: vi.fn(async () => false) }));
    expect(r.sinRed).toBe(true);
    expect(put).not.toHaveBeenCalled();
    expect(a.t.size).toBe(1);
    expect(a.b.get(ID)!.pendiente).toBe(true);
  });

  it('respuesta que no es JSON de la API (HTML de un portal): se detiene y conserva todo', async () => {
    const a = new Memoria();
    a.b.set(ID, borrador());
    await encolarPut(a, ID);
    const r = await procesarCola(a, remoto(async () => {
      throw new SyntaxError('Unexpected token < in JSON');
    }));
    expect(r.sinRed).toBe(true);
    expect(a.t.size).toBe(1);
    expect(a.b.get(ID)!.pendiente).toBe(true);
    expect(a.b.get(ID)!.confirmadoEn ?? null).toBeNull();
  });

  it('respuesta de otro registro o vacía: no se confirma', async () => {
    for (const malo of [respuesta('rv1', { id: 'otro' }), {} as FiscalizacionDto, null as unknown as FiscalizacionDto]) {
      const a = new Memoria();
      a.b.set(ID, borrador());
      await encolarPut(a, ID);
      const r = await procesarCola(a, remoto(async () => malo));
      expect(r.sinRed).toBe(true);
      expect(a.t.size).toBe(1);
      expect(a.b.get(ID)!.pendiente).toBe(true);
    }
  });

  it('el servidor devuelve datos distintos a los enviados: queda pendiente y avisa', async () => {
    const a = new Memoria();
    const datos = { ...nuevaFiscalizacion(ID, '2026-10-20'), observacionesGenerales: 'Agua en el tanque 2' };
    a.b.set(ID, borrador({ datos }));
    await encolarPut(a, ID);
    const r = await procesarCola(a, remoto(async () => respuesta('rv1', { observacionesGenerales: null })));
    expect(r.errores[0]).toContain('observacionesGenerales');
    expect(a.t.size).toBe(1);
    const b = a.b.get(ID)!;
    expect(b.pendiente).toBe(true);
    expect(b.confirmadoEn ?? null).toBeNull();
  });

  it('con los mismos datos (espacios y decimales como los guarda la API) sí confirma', async () => {
    const a = new Memoria();
    const base = nuevaFiscalizacion(ID, '2026-10-20');
    const datos = {
      ...base,
      observacionesGenerales: '  Sin novedad  ',
      visita: { ...base.visita, horaSalida: '07:15' },
      mediciones: { ...base.mediciones, galonesEgehid: 4200.004 },
    };
    a.b.set(ID, borrador({ datos }));
    await encolarPut(a, ID);
    await procesarCola(
      a,
      remoto(async () =>
        respuesta('rv1', {
          observacionesGenerales: 'Sin novedad',
          visita: { ...base.visita, horaSalida: '07:15:00' },
          mediciones: { ...base.mediciones, galonesEgehid: 4200 },
        }),
      ),
      () => 50,
    );
    expect(a.t.size).toBe(0);
    expect(a.b.get(ID)!.confirmadoEn).toBe(50);
  });

  it('foto: si la huella devuelta no coincide no se marca como subida', async () => {
    const a = new Memoria();
    a.b.set(ID, borrador({ pendiente: false, sincronizadoEn: 1, confirmadoEn: 1 }));
    a.f.set('f1', fotoLocal());
    await encolarFoto(a, fotoLocal(), 0);
    const r = await procesarCola(
      a,
      remoto(async () => respuesta('rv1'), {
        subirFoto: vi.fn(async (_f: string, foto: FotoLocal) => ({ id: foto.id, orden: 1, descripcion: null, tamanoBytes: 1, sha256: 'otra' })),
      }),
    );
    expect(r.sinRed).toBe(true);
    expect(a.f.get('f1')!.servidorId).toBeNull();
    expect(a.t.size).toBe(1);
  });

  it('finalizar sin red queda en cola; con red espera el registro y las fotos, finaliza y lo vuelve a leer', async () => {
    const a = new Memoria();
    a.b.set(ID, borrador());
    a.f.set('f1', fotoLocal());
    await encolarPut(a, ID, 1);
    await encolarFoto(a, fotoLocal(), 2);
    await encolarFinalizar(a, ID, 3);

    // sin red: nada se envía
    const sinRed = remoto(async () => respuesta('rv1'), { salud: vi.fn(async () => false) });
    await procesarCola(a, sinRed);
    expect(sinRed.finalizar).not.toHaveBeenCalled();
    expect(a.t.size).toBe(3);

    // con red: registro → foto → finalizar → lectura de confirmación
    const rem = remoto(vi.fn(async () => respuesta('rv1')));
    const r = await procesarCola(a, rem, () => 77);
    expect(rem.put).toHaveBeenCalledTimes(1);
    expect(rem.subirFoto).toHaveBeenCalledTimes(1);
    expect(rem.finalizar).toHaveBeenCalledWith(ID);
    expect(rem.obtener).toHaveBeenCalledWith(ID);
    expect(r.finalizados).toEqual([ID]);
    const b = a.b.get(ID)!;
    expect(b.finalizar).toBe('confirmado');
    expect(b.finalizadoEn).toBe(77);
    expect(b.datos.estado).toBe('Finalizado');
    expect(a.t.size).toBe(0);
    expect(a.b.has(ID)).toBe(true); // la copia local se conserva
  });

  it('finalizar: si al volver a leerlo sigue como borrador, no se da por finalizado', async () => {
    const a = new Memoria();
    a.b.set(ID, borrador({ pendiente: false, sincronizadoEn: 1, confirmadoEn: 1 }));
    await encolarFinalizar(a, ID);
    const rem = remoto(async () => respuesta('rv1'), { obtener: vi.fn(async () => respuesta('rv1')) });
    const r = await procesarCola(a, rem);
    expect(r.sinRed).toBe(true);
    expect(a.b.get(ID)!.finalizar ?? null).not.toBe('confirmado');
    expect(a.t.size).toBe(1);
  });

  it('finalizar rechazado por el servidor (400): vuelve a ser borrador con el motivo', async () => {
    const a = new Memoria();
    a.b.set(ID, borrador({ pendiente: false, sincronizadoEn: 1, confirmadoEn: 1, finalizar: 'pendiente' }));
    await encolarFinalizar(a, ID);
    const rem = remoto(async () => respuesta('rv1'), {
      finalizar: vi.fn(async () => {
        throw new ApiError(400, { status: 400, title: 'Hay datos pendientes o inválidos.', errors: { firmas: ['Falta la firma de Encargado de recibir.'] } });
      }),
    });
    const r = await procesarCola(a, rem);
    const b = a.b.get(ID)!;
    expect(b.finalizar).toBeNull();
    expect(b.ultimoError).toContain('Encargado de recibir');
    expect(r.errores[0]).toContain('No se pudo finalizar');
    expect(a.t.size).toBe(0);
  });

  it('si el borrador se elimina en la tablet mientras se envía, la respuesta no lo vuelve a crear', async () => {
    const a = new Memoria();
    a.b.set(ID, borrador());
    await encolarPut(a, ID);
    await procesarCola(
      a,
      remoto(async () => {
        a.b.delete(ID); // el usuario lo eliminó durante el envío
        return respuesta('rv1');
      }),
    );
    expect(a.b.has(ID)).toBe(false);
    expect(a.t.size).toBe(0);
  });
});
