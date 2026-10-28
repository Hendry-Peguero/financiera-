import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { FiscalizacionDto } from '../api/types';
import { nuevaFiscalizacion, PREGUNTAS_POR_DEFECTO } from '../domain/fiscalizacion';
import { SeccionControles } from './SeccionControles';

function Prueba() {
  const [d, setD] = useState<FiscalizacionDto>(() => nuevaFiscalizacion('c0000000-0000-4000-8000-000000000001'));
  return <SeccionControles datos={d} actualizar={(fn) => setD((x) => fn(x))} preguntas={PREGUNTAS_POR_DEFECTO} />;
}

const fila = (n: number) => document.querySelector(`[data-control="${n}"]`) as HTMLElement;

describe('Sección Controles', () => {
  it('6, 11 y 12 muestran «Obligatoria si responde Sí»; la 10 es fecha de calibración', async () => {
    render(<Prueba />);
    for (const n of [6, 11, 12])
      expect(screen.getByLabelText(`Observación del control ${n}`)).toHaveAttribute('placeholder', 'Obligatoria si responde Sí');
    expect(screen.getByLabelText('Observación del control 1')).toHaveAttribute('placeholder', 'Observación (opcional)');
    const fecha = screen.getByLabelText('Fecha de calibración');
    expect(fecha).toHaveAttribute('placeholder', 'Fecha de calibración');
    await userEvent.setup().click(fecha);
    expect(fecha).toHaveAttribute('type', 'date');
  });

  it('Sí sin observación en 6 muestra el error en línea; al escribirla desaparece', async () => {
    const u = userEvent.setup();
    render(<Prueba />);
    expect(screen.queryByRole('alert')).toBeNull();
    await u.click(screen.getByRole('button', { name: 'Control 6: Sí' }));
    expect(screen.getByRole('button', { name: 'Control 6: Sí' })).toHaveAttribute('aria-pressed', 'true');
    const error = screen.getByRole('alert');
    expect(error).toHaveTextContent('La observación es obligatoria si responde Sí.');
    expect(fila(6)).toContainElement(error);
    const obs = screen.getByLabelText('Observación del control 6');
    expect(obs).toHaveAttribute('aria-invalid', 'true');
    expect(obs).toHaveClass('invalido');

    await u.type(obs, 'Agua en el fondo del tanque 2');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(obs).not.toHaveAttribute('aria-invalid');
  });

  it('Sí en un control no obligatorio (1) no muestra error; No en 11 tampoco', async () => {
    const u = userEvent.setup();
    render(<Prueba />);
    await u.click(screen.getByRole('button', { name: 'Control 1: Sí' }));
    await u.click(screen.getByRole('button', { name: 'Control 11: No' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('2 de 12 respondidos')).toBeInTheDocument();
  });

  it('Sí en 11 y 12 muestra un error por cada uno', async () => {
    const u = userEvent.setup();
    render(<Prueba />);
    await u.click(screen.getByRole('button', { name: 'Control 11: Sí' }));
    await u.click(screen.getByRole('button', { name: 'Control 12: Sí' }));
    expect(screen.getAllByRole('alert')).toHaveLength(2);
  });
});
