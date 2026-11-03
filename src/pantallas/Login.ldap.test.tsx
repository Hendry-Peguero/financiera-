import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SesionContext, type Sesion } from '../auth/contexto';
import { Login } from './Login';

function montar(entrar: Sesion['entrar']) {
  const sesion: Sesion = { modo: 'ldap', estado: 'anonimo', correo: null, error: null, entrar, salir: () => {} };
  render(
    <MemoryRouter>
      <SesionContext.Provider value={sesion}>
        <Login />
      </SesionContext.Provider>
    </MemoryRouter>,
  );
}

describe('Login con usuario de dominio', () => {
  it('pide usuario y contraseña, y no ofrece crear cuenta', async () => {
    const entrar = vi.fn(async () => {});
    montar(entrar);
    expect(screen.getByLabelText('Usuario de dominio')).toBeInTheDocument();
    expect(screen.queryByText(/Crear cuenta/)).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /Entrar a mi espacio/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Escriba su usuario y contraseña del dominio.');
    expect(entrar).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('Usuario de dominio'), 'EGEHID\\ana.perez');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'secreta');
    await userEvent.click(screen.getByRole('button', { name: /Entrar a mi espacio/ }));
    expect(entrar).toHaveBeenCalledWith('EGEHID\\ana.perez', { registro: false, clave: 'secreta', mantener: true });
  });

  it('muestra el mensaje de la API', async () => {
    montar(async () => {
      throw new Error('Usuario o contraseña incorrectos.');
    });
    await userEvent.type(screen.getByLabelText('Usuario de dominio'), 'ana');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'mala');
    await userEvent.click(screen.getByRole('button', { name: /Entrar a mi espacio/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Usuario o contraseña incorrectos.');
  });
});
