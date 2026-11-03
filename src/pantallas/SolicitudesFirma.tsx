import { Link, useLocation } from 'react-router-dom';
import { useSolicitudesMias } from '../api/hooks';
import type { EstadoSolicitud } from '../api/types';
import { nombreRol } from '../domain/fiscalizacion';
import { momento } from '../domain/format';
import { Cargando, ErrorCaja } from '../ui/comunes';

const CLASE: Record<EstadoSolicitud, string> = {
  Pendiente: 'b-Borrador',
  Firmada: 'b-Finalizado',
  Rechazada: 'b-Papelera',
  Expirada: 'b-neutral',
};

/** Lista de firmas que le solicitaron; cada pendiente abre «Revisar y firmar» (/firmas/solicitudes/:id). */
export function SolicitudesFirma() {
  const q = useSolicitudesMias();
  const msg = (useLocation().state as { msg?: string } | null)?.msg;

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Firmas solicitadas</h1>
          <p className="subtitulo">Formularios donde le pidieron firmar. Puede firmar o rechazar con un comentario.</p>
        </div>
      </div>
      {msg && (
        <div className="aviso aviso-ok" role="status">
          {msg}
        </div>
      )}
      <section className="card" aria-label="Mis solicitudes">
        {q.isPending && <Cargando />}
        {q.isError && <ErrorCaja error={q.error} />}
        {q.data?.length === 0 && <div className="vacio">No tiene solicitudes.</div>}
        <ul className="resumen-lista" style={{ padding: 10 }}>
          {q.data?.map((s) => {
            const contenido = (
              <>
                <span>
                  #{s.numero} · {nombreRol(s.rol)}
                  <br />
                  <span className="small muted">
                    {s.solicitadaPor} · {momento(s.creadaEn)}
                  </span>
                </span>
                <span className={`badge ${CLASE[s.estado]}`}>{s.estado}</span>
              </>
            );
            return (
              <li key={s.id}>
                {s.estado === 'Pendiente' ? (
                  <Link to={`/firmas/solicitudes/${s.id}`}>{contenido}</Link>
                ) : (
                  <span className="fila-sb">{contenido}</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
