import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { SesionProvider } from './sesion';

/** Proveedor de sesión que, al volver de Auth0, navega a la ruta donde estaba el usuario. */
export function SesionConRuta({ children }: { children: ReactNode }) {
  const navegar = useNavigate();
  return <SesionProvider alVolver={(ruta) => navegar(ruta, { replace: true })}>{children}</SesionProvider>;
}
