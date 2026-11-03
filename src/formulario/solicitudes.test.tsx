import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FiscalizacionDto, SolicitudFirmaDto, SolicitudFirmaRegistroDto, UsuarioDto } from '../api/types';
import { db, escribirCache, leerCache } from '../db/db';
import { nuevaFiscalizacion } from '../domain/fiscalizacion';
import { SeccionFirmas } from './SeccionFirmas';
import { claveSolicitudes, conNueva, desdeCreada, estadoAcceso, pedirSolicitudes, ultimaPorRol } from './solicitudes';

const ID = 'a3f921c0-0000-4000-8000-000000000000';
const AHORA = Date.parse('2026-10-20T14:30:00Z');

function sol(p: Partial<SolicitudFirmaRegistroDto> = {}): SolicitudFirmaRegistroDto {
  return {
    id: 'sol-1',
    rol: 'SupervisorCombustibles',
    usuarioDestinoId: 'u-pedro',
    firmante: 'Pedro Almonte',
    correoFirmante: 'pedro.almonte@egehid.gob.do',
    solicitadaPor: 'María Rosario Peña',
    estado: 'Pendiente',
    comentario: null,
    creadaEn: '2026-10-20T14:20:00Z',
    expiraEn: '2099-10-27T14:20:00Z', // lejos: los componentes comparan con la hora real
    firmadaEn: null,
    ...p,
  };
}

const respuesta = (status: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

beforeEach(async () => {
  await db.cache.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('solicitudes de firma del registro (lógica)', () => {
  it('la última solicitud de cada rol manda, sin importar el orden de la lista', () => {
    const vieja = sol({ id: 'a', estado: 'Expirada', firmante: 'Ana Pérez', creadaEn: '2026-10-19T10:00:00Z' });
    const nueva = sol({ id: 'b', creadaEn: '2026-10-20T10:00:00Z' });
    const otra = sol({ id: 'c', rol: 'InspectorActuante', estado: 'Rechazada' });
    const m = ultimaPorRol([vieja, otra, nueva]);
    expect(m.get('SupervisorCombustibles')?.id).toBe('b');
    expect(m.get('InspectorActuante')?.id).toBe('c');
    expect(m.has('RevisadoPor')).toBe(false);
  });

  it('pendiente → enviado; vencida (aunque siga «Pendiente» en la tablet) → vencido; rechazada → rechazado', () => {
    expect(estadoAcceso(undefined, AHORA)).toBeNull();
    expect(estadoAcceso(sol(), AHORA)).toBe('enviado');
    expect(estadoAcceso(sol({ expiraEn: '2026-10-20T14:00:00Z' }), AHORA)).toBe('vencido');
    expect(estadoAcceso(sol({ estado: 'Expirada' }), AHORA)).toBe('vencido');
    expect(estadoAcceso(sol({ estado: 'Rechazada', comentario: 'No estuve' }), AHORA)).toBe('rechazado');
    expect(estadoAcceso(sol({ estado: 'Firmada' }), AHORA)).toBeNull();
  });

  it('al dar acceso de nuevo, la nueva va primero con el nombre elegido y la pendiente anterior del rol queda expirada', () => {
    const creada: SolicitudFirmaDto = {
      id: 'sol-2',
      fiscalizacionId: ID,
      numero: 'A3F9-21C0',
      rol: 'SupervisorCombustibles',
      solicitadaPor: 'María Rosario Peña',
      creadaEn: '2026-10-20T15:00:00Z',
      expiraEn: '2026-10-27T15:00:00Z',
      estado: 'Pendiente',
    };
    const nueva = desdeCreada(creada, { id: 'u-ana', nombreCompleto: 'Ana Pérez', cargo: null, tieneFirma: true });
    expect(nueva).toMatchObject({ id: 'sol-2', firmante: 'Ana Pérez', usuarioDestinoId: 'u-ana', estado: 'Pendiente' });
    const otra = sol({ id: 'x', rol: 'InspectorActuante' });
    const lista = conNueva([sol(), otra], nueva);
    expect(lista.map((s) => [s.id, s.estado])).toEqual([
      ['sol-2', 'Pendiente'],
      ['sol-1', 'Expirada'],
      ['x', 'Pendiente'],
    ]);
  });
});

describe('pedirSolicitudes', () => {
  it('en línea consulta la API y guarda el estado en la tablet', async () => {
    const fetch = vi.fn().mockResolvedValue(respuesta(200, [sol()]));
    vi.stubGlobal('fetch', fetch);
    const r = await pedirSolicitudes(ID);
    expect(r).toEqual({ lista: [sol()], sinConexion: false, conocido: true });
    expect(String(fetch.mock.calls[0][0])).toContain(`/fiscalizaciones/${ID}/solicitudes-firma`);
    expect(await leerCache(claveSolicitudes(ID))).toEqual([sol()]);
  });

  it('sin red devuelve el último estado conocido y lo marca', async () => {
    await escribirCache(claveSolicitudes(ID), [sol()]);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect(await pedirSolicitudes(ID)).toEqual({ lista: [sol()], sinConexion: true, conocido: true });
  });

  it('sin red y sin nada guardado: lista vacía y «no conocido»', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect(await pedirSolicitudes(ID)).toEqual({ lista: [], sinConexion: true, conocido: false });
  });

  it('404 (el borrador aún no llegó al servidor) es una lista vacía; 403 es un error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(404, { title: 'Fiscalización no encontrada.' })));
    expect(await pedirSolicitudes(ID)).toEqual({ lista: [], sinConexion: false, conocido: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(403, { title: 'No tiene permiso para esta acción.' })));
    await expect(pedirSolicitudes(ID)).rejects.toThrow('No tiene permiso');
  });
});

describe('Participantes y firmas con las solicitudes del servidor', () => {
  const me: UsuarioDto = {
    id: 'u-maria',
    correo: 'maria@egehid.gob.do',
    nombreCompleto: 'María Rosario Peña',
    cargo: 'Auditora',
    rol: 'Auditor',
    tieneFirma: false,
    esPropietarioBitacora: false,
    perfilCompleto: true,
  };

  function pintar() {
    const datos: FiscalizacionDto = { ...nuevaFiscalizacion(ID), firmas: [] };
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <SeccionFirmas datos={datos} me={me} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }
  const fila = (rol: string) => document.querySelector(`[data-rol="${rol}"]`) as HTMLElement;

  it('muestra «Acceso enviado» con el nombre del firmante, el rechazo con su motivo y el vencido', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        respuesta(200, [
          sol(),
          sol({ id: 's2', rol: 'InspectorActuante', firmante: 'Ana Pérez', estado: 'Rechazada', comentario: 'No estuve en la descarga' }),
          sol({ id: 's3', rol: 'RevisadoPor', firmante: 'Luis Ferreras', estado: 'Expirada' }),
        ]),
      ),
    );
    pintar();
    const enviada = fila('SupervisorCombustibles');
    expect(await within(enviada).findByText('Pedro Almonte')).toBeInTheDocument();
    expect(enviada).toHaveClass('enviada');
    expect(within(enviada).getByText(/Acceso enviado · firmará en su tablet/)).toBeInTheDocument();
    expect(within(enviada).getByRole('button', { name: /Reenviar/ })).toBeInTheDocument();

    // las firmas de cierre (auditores de cierre y UAI) están en su propia pestaña
    expect(fila('InspectorActuante')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /Cierre/ }));
    expect(fila('SupervisorCombustibles')).toBeNull();
    const rechazada = fila('InspectorActuante');
    expect(rechazada).toHaveClass('libre', 'rechazada');
    expect(within(rechazada).getByText(/Rechazó el acceso · No estuve en la descarga/)).toBeInTheDocument();
    expect(within(rechazada).getByRole('button', { name: 'Dar acceso' })).toBeInTheDocument();

    const vencida = fila('RevisadoPor');
    expect(vencida).toHaveClass('vencida');
    expect(within(vencida).getByText('Luis Ferreras')).toBeInTheDocument();
    expect(within(vencida).getByText(/Acceso vencido/)).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('sin red muestra el último estado guardado en la tablet y lo avisa', async () => {
    await escribirCache(claveSolicitudes(ID), [sol()]);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    pintar();
    expect(await screen.findByRole('status')).toHaveTextContent('Sin conexión: los accesos enviados son los de la última consulta');
    expect(within(fila('SupervisorCombustibles')).getByText('Pedro Almonte')).toBeInTheDocument();
  });

  it('sin red y sin estado guardado lo dice claramente', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    pintar();
    expect(await screen.findByRole('status')).toHaveTextContent('Sin conexión: no se pudo consultar los accesos enviados.');
    expect(fila('SupervisorCombustibles')).not.toHaveClass('enviada');
  });
});
