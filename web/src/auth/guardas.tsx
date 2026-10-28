import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useMe } from '../api/hooks';
import { sincronizador } from '../offline/sync';
import { esUsuarioDesactivado } from '../pantallas/usuariosLogica';
import { Cargando, ErrorCaja } from '../ui/comunes';
import { useSesion } from './contexto';

/** Exige sesión y perfil completo (si no, lleva a /primer-ingreso). */
export function RequiereSesion({ children, permitirPerfilIncompleto = false }: { children: ReactNode; permitirPerfilIncompleto?: boolean }) {
  const sesion = useSesion();
  const loc = useLocation();
  const me = useMe();

  useEffect(() => {
    if (sesion.estado === 'autenticado' && me.data) sincronizador.iniciar();
  }, [sesion.estado, me.data]);

  if (sesion.estado === 'cargando') return <Cargando texto="Verificando sesión…" />;
  if (sesion.estado === 'anonimo') return <Navigate to="/login" replace state={{ desde: loc.pathname + loc.search }} />;
  if (me.isPending) return <Cargando texto="Cargando su perfil…" />;
  if (me.isError) {
    return (
      <div className="contenido" style={{ maxWidth: '35rem', margin: '2.5rem auto' }}>
        {esUsuarioDesactivado(me.error) ? (
          <ErrorCaja error="Su usuario está desactivado. Pida a un administrador de la aplicación que lo active." />
        ) : (
          <ErrorCaja error={me.error} />
        )}
        {me.error instanceof ApiError && (me.error.status === 401 || me.error.status === 403) && (
          <button type="button" className="btn" onClick={() => sesion.salir()}>
            Cerrar sesión
          </button>
        )}
        <button type="button" className="btn" onClick={() => void me.refetch()}>
          Reintentar
        </button>
      </div>
    );
  }
  if (!me.data.perfilCompleto && !permitirPerfilIncompleto) return <Navigate to="/primer-ingreso" replace />;
  return <>{children}</>;
}

/** Solo para el propietario de la bitácora. Para cualquier otro la ruta no existe. */
export function RequierePropietario({ children }: { children: ReactNode }) {
  const me = useMe();
  if (!me.data?.esPropietarioBitacora) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function RequiereAdmin({ children }: { children: ReactNode }) {
  const me = useMe();
  if (me.data?.rol !== 'Administrador') return <Navigate to="/" replace />;
  return <>{children}</>;
}
