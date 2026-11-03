import { useRef, useState, type FormEvent } from 'react';
import type { FirmaEntradaDto, RolFirma } from '../api/types';
import { Modal } from '../ui/comunes';
import { Icono } from '../ui/Icono';
import { LienzoFirma, type ControlLienzo } from '../ui/LienzoFirma';

/**
 * «Firmar aquí»: ventana sobre el formulario para que firme quien está con el auditor (sin usuario).
 * Escribe su nombre (y cédula), firma en el recuadro y la firma se guarda como `EnEstaTablet`.
 */
export function FirmarAqui({
  rol,
  nombreRol,
  autor,
  enLinea,
  ocupado,
  firmar,
  alCerrar,
}: {
  rol: RolFirma;
  nombreRol: string;
  /** Nombre corto de quien llena el formulario. */
  autor: string;
  enLinea: boolean;
  ocupado: boolean;
  /** Devuelve el mensaje de error, o null si la firma quedó guardada. */
  firmar: (rol: RolFirma, cuerpo: FirmaEntradaDto) => Promise<string | null>;
  alCerrar: () => void;
}) {
  const lienzo = useRef<ControlLienzo>(null);
  const [nombre, setNombre] = useState('');
  const [cedula, setCedula] = useState('');
  const [imagen, setImagen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const aceptar = async (e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!nombre.trim()) return setError('Escriba el nombre completo de quien firma.');
    if (!imagen) return setError('Falta la firma: firme dentro del recuadro.');
    if (!enLinea) return setError('Sin conexión: la firma se registra en el servidor. Intente al volver la red.');
    const err = await firmar(rol, { nombreFirmante: nombre.trim(), cedula: cedula.trim() || null, modo: 'EnEstaTablet', imagenBase64: imagen });
    if (err) setError(err);
    else alCerrar();
  };

  return (
    <Modal
      titulo={`Firma como ${nombreRol}`}
      sub={`Firme con el dedo o el lápiz. La firma queda en el formulario de ${autor} con fecha y hora.`}
      icono="signature"
      ancho={680}
      className="fa-dialogo"
      alCerrar={() => !ocupado && alCerrar()}
      pie={
        <>
          <button type="button" className="btn" onClick={alCerrar} disabled={ocupado}>
            Cancelar
          </button>
          <button type="submit" form="fa-form" className="btn btn-primario" disabled={ocupado}>
            <Icono nombre="check" tam={16} />
            {ocupado ? 'Guardando…' : 'Aceptar firma'}
          </button>
        </>
      }
    >
      <form id="fa-form" className="fa" onSubmit={(e) => void aceptar(e)} aria-label={`Firmar como ${nombreRol}`} noValidate>
        <div className="fa-campos">
          <div className="campo">
            <label className="campo-etiqueta" htmlFor="fa-nombre">
              Nombre completo
            </label>
            <div className="caja">
              <input id="fa-nombre" autoComplete="off" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              <Icono nombre="user" tam={16} className="caja-icono" />
            </div>
          </div>
          <div className="campo">
            <label className="campo-etiqueta" htmlFor="fa-cedula">
              Cédula (opcional)
            </label>
            <div className="caja">
              <input
                id="fa-cedula"
                autoComplete="off"
                inputMode="numeric"
                placeholder="001-1234567-8"
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
              />
              <Icono nombre="id-card" tam={16} className="caja-icono" />
            </div>
          </div>
        </div>
        <div className="fa-firma-cab">
          <span>Firme dentro del recuadro</span>
          <button type="button" className="fa-borrar" onClick={() => lienzo.current?.borrar()}>
            <Icono nombre="eraser" tam={13} />
            Borrar
          </button>
        </div>
        <div className="fa-lienzo">
          <div className="fa-lienzo-capa">
            <LienzoFirma alCambiar={setImagen} control={lienzo} etiqueta="Recuadro de firma: firme con el dedo o el lápiz" />
          </div>
          <span className="fa-linea" aria-hidden="true" />
          <span className="fa-pie">
            {nombre.trim() || 'Nombre de quien firma'} · {nombreRol}
          </span>
        </div>
        {error && (
          <div className="aviso aviso-error" role="alert">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
