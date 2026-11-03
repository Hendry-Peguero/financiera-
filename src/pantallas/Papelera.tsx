import { Historial } from './Historial';

/** Papelera (Administración): el Historial abierto en la pestaña «Papelera»; «⋮ → Restaurar» recupera el registro. */
export function Papelera() {
  return (
    <Historial
      vista={{ titulo: 'Papelera', sub: 'Registros borrados · solo el administrador los restaura', estado: 'papelera', ruta: '/papelera' }}
    />
  );
}
