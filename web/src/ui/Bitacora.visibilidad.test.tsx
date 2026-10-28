import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import type { UsuarioDto } from '../api/types';
import { SesionContext, type Sesion } from '../auth/contexto';
import { itemsNav } from './nav';

const CORREO = 'persona@egehid.test';

function usuario(extra: Partial<UsuarioDto>): UsuarioDto {
  return {
    id: 'u1',
    correo: CORREO,
    nombreCompleto: 'Persona de Prueba',
    cargo: 'Auditora',
    rol: 'Auditor',
    tieneFirma: false,
    esPropietarioBitacora: false,
    perfilCompleto: true,
    ...extra,
  };
}

function montar(me: UsuarioDto, ruta: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  qc.setQueryData(['me', CORREO], me);
  const sesion: Sesion = { modo: 'dev', estado: 'autenticado', correo: CORREO, error: null, entrar: async () => {}, salir: () => {} };
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <QueryClientProvider client={qc}>
        <SesionContext.Provider value={sesion}>
          <App />
        </SesionContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  const vacio = { items: [], total: 0, pagina: 1, tamano: 50, conteos: {} };
  const resumen = { finalizadosMes: 0, finalizadosMesAnterior: 0, borradores: 0, borradoresFirmasIncompletas: 0, galonesMes: 0, avisos: [], recientes: [] };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const cuerpo = url.includes('/inicio/resumen') ? resumen : url.includes('/solicitudes-firma') ? [] : vacio;
      return new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Bitácora: solo para el propietario', () => {
  it('el menú no la incluye para quien no es propietario (ni siendo administrador)', () => {
    expect(itemsNav(usuario({})).some((i) => i.ruta === '/bitacora')).toBe(false);
    expect(itemsNav(usuario({ rol: 'Administrador' })).some((i) => i.ruta === '/bitacora')).toBe(false);
    expect(itemsNav(usuario({ esPropietarioBitacora: true })).some((i) => i.ruta === '/bitacora')).toBe(true);
  });

  it('no propietario: sin enlace y /bitacora redirige al inicio', async () => {
    montar(usuario({ rol: 'Administrador' }), '/bitacora');
    expect(await screen.findByRole('heading', { level: 1, name: /Buen/ })).toBeInTheDocument();
    const menu = screen.getByRole('complementary', { name: 'Menú principal' });
    expect(within(menu).queryByRole('link', { name: /Bitácora/ })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Bitácora' })).toBeNull();
    expect(vi.mocked(fetch).mock.calls.some(([u]) => String(u).includes('/bitacora/'))).toBe(false);
  });

  it('propietario: ve el enlace y la pantalla con sus pestañas', async () => {
    montar(usuario({ esPropietarioBitacora: true }), '/bitacora');
    expect(await screen.findByRole('heading', { level: 1, name: 'Bitácora' })).toBeInTheDocument();
    const menu = screen.getByRole('complementary', { name: 'Menú principal' });
    expect(within(menu).getByRole('link', { name: /Bitácora/ })).toBeInTheDocument();
    for (const t of [/Clics y navegación/, /Peticiones a la API/, /Cambios de datos/]) expect(screen.getByRole('tab', { name: t })).toBeInTheDocument();
  });
});
