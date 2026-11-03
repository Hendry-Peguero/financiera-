import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FirmarAqui } from './FirmarAqui';

function montar(firmar = vi.fn(async () => null as string | null), alCerrar = vi.fn()) {
  render(
    <FirmarAqui
      rol="RepresentanteProveedor"
      nombreRol="Representante del proveedor"
      autor="María Rosario"
      enLinea
      ocupado={false}
      firmar={firmar}
      alCerrar={alCerrar}
    />,
  );
  return { firmar, alCerrar };
}

describe('Firmar aquí (ventana)', () => {
  it('es un diálogo y exige el nombre y el trazo antes de firmar', async () => {
    const { firmar } = montar();
    expect(screen.getByRole('dialog', { name: 'Firma como Representante del proveedor' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Aceptar firma/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Escriba el nombre completo de quien firma.');
    await userEvent.type(screen.getByLabelText('Nombre completo'), 'Ramón A. Peña');
    await userEvent.click(screen.getByRole('button', { name: /Aceptar firma/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Falta la firma');
    expect(firmar).not.toHaveBeenCalled();
  });

  it('Cancelar cierra sin firmar', async () => {
    const { firmar, alCerrar } = montar();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(alCerrar).toHaveBeenCalled();
    expect(firmar).not.toHaveBeenCalled();
  });
});
