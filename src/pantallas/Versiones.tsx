import { Historial } from './Historial';

/** Versiones y cambios (Administración): registros corregidos; al abrir uno se ve su línea de tiempo y los cambios por campo. */
export function Versiones() {
  return (
    <Historial
      vista={{
        titulo: 'Versiones y cambios',
        sub: 'Registros corregidos después de finalizar · abra uno para ver sus versiones y cambios por campo',
        estado: 'Modificado',
        ruta: '/versiones',
      }}
    />
  );
}
