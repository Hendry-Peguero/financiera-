import { useState } from 'react';
import { api } from '../api/client';
import { useUsuarios } from '../api/hooks';
import type { RolFirma, SolicitudFirmaDto, UsuarioBusquedaDto } from '../api/types';
import { nombreRol } from '../domain/fiscalizacion';
import { asegurarSincronizado } from '../offline/sync';
import { Modal } from '../ui/comunes';
import { mensajeError } from '../ui/errores';
import { Icono } from '../ui/Icono';
import { iniciales } from '../ui/nav';
import './darAcceso.css';

/**
 * Diálogo «Dar acceso para firmar en su tablet»: busca al usuario y crea la solicitud de firma
 * (POST /fiscalizaciones/{id}/solicitudes-firma). Llama `alEnviar` con la solicitud creada y el usuario elegido.
 */
export function DarAcceso({
  fiscalizacionId,
  rol,
  alCerrar,
  alEnviar,
}: {
  fiscalizacionId: string;
  rol: RolFirma;
  alCerrar: () => void;
  alEnviar: (s: SolicitudFirmaDto, destino: UsuarioBusquedaDto) => void;
}) {
  const [texto, setTexto] = useState('');
  const usuarios = useUsuarios(texto.trim());
  const [elegido, setElegido] = useState<UsuarioBusquedaDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const rolNombre = nombreRol(rol);
  const lista = (usuarios.data ?? []).slice(0, 6);

  const enviar = async () => {
    if (!elegido) return setError('Elija quién debe firmar.');
    setEnviando(true);
    setError(null);
    try {
      const e = await asegurarSincronizado(fiscalizacionId);
      if (e) return setError(e);
      const s = await api.post<SolicitudFirmaDto>(`/fiscalizaciones/${fiscalizacionId}/solicitudes-firma`, {
        rol,
        usuarioDestinoId: elegido.id,
      });
      alEnviar(s, elegido);
      alCerrar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      icono="key-round"
      className="da-dialogo"
      titulo="Dar acceso para firmar en su tablet"
      sub={`${rolNombre} · abrirá este formulario en su tablet con su usuario`}
      alCerrar={alCerrar}
      pie={
        <>
          <button type="button" className="btn" onClick={alCerrar}>
            <Icono nombre="x" tam={16} />
            Cancelar
          </button>
          <button type="button" className="btn btn-primario" disabled={enviando} onClick={() => void enviar()}>
            <Icono nombre="send" tam={16} />
            Dar acceso y solicitar firma
          </button>
        </>
      }
    >
      <div className="da-bloque">
        <label className="da-l" htmlFor="da-buscar">
          1. ¿Quién debe firmar?
        </label>
        <div className="da-buscar">
          <Icono nombre="search" tam={15} />
          <input
            id="da-buscar"
            autoFocus
            autoComplete="off"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Nombre o correo"
          />
        </div>
        {usuarios.isError && <div className="error-campo">{mensajeError(usuarios.error)}</div>}
        {lista.length > 0 && (
          <div className="da-resultados" role="listbox" aria-label="Usuarios">
            {lista.map((u) => {
              const sel = elegido?.id === u.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  role="option"
                  aria-selected={sel}
                  className={`da-usuario${sel ? ' sel' : ''}`}
                  onClick={() => setElegido(u)}
                >
                  <span className="da-avatar">{iniciales(u.nombreCompleto)}</span>
                  <span className="da-textos">
                    <span className="da-n">{u.nombreCompleto || '(sin nombre)'}</span>
                    <span className="da-r">{u.cargo ?? ''}</span>
                  </span>
                  {u.tieneFirma ? (
                    <span className="da-firma si">
                      <Icono nombre="signature" tam={11} />
                      Tiene firma guardada
                    </span>
                  ) : (
                    <span className="da-firma">
                      <Icono nombre="pen-off" tam={11} />
                      Sin firma guardada
                    </span>
                  )}
                  {sel && <Icono nombre="circle-check" tam={18} className="da-sel" />}
                </button>
              );
            })}
          </div>
        )}
        {usuarios.data && usuarios.data.length === 0 && <div className="da-vacio">Sin resultados.</div>}
      </div>
      <div className="da-bloque">
        <div className="da-l">2. Qué podrá hacer</div>
        <ul className="da-lista">
          <li>
            <Icono nombre="check" tam={14} className="da-ok" />
            <span>Ver el formulario completo (solo lectura)</span>
          </li>
          <li>
            <Icono nombre="check" tam={14} className="da-ok" />
            <span>Firmar como {rolNombre} con su firma predeterminada o una nueva</span>
          </li>
          <li>
            <Icono nombre="x" tam={14} className="da-no" />
            <span className="da-t2">Modificar datos, fotos o firmas de otros</span>
          </li>
          <li className="da-vence">
            <Icono nombre="calendar-clock" tam={14} />
            <span>El acceso se cierra al firmar o en 7 días</span>
          </li>
        </ul>
      </div>
      <div className="da-otra">
        <Icono nombre="tablet-smartphone" tam={14} />
        <span>¿La persona está a su lado? Use «Firmar aquí» y pásele su tablet; no necesita acceso.</span>
      </div>
      {error && (
        <div className="aviso aviso-error" role="alert">
          {error}
        </div>
      )}
    </Modal>
  );
}
