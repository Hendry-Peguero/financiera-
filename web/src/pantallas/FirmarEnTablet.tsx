import { useQuery } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useCatalogos } from '../api/hooks';
import type { FiscalizacionDto, RolFirma } from '../api/types';
import { db } from '../db/db';
import { nombreSuplidor, ROLES_FIRMA } from '../domain/fiscalizacion';
import { useEnLinea } from '../offline/hooks';
import { aplicarRespuestaServidor, asegurarSincronizado } from '../offline/sync';
import { Cargando, ErrorCaja } from '../ui/comunes';
import { mensajeError } from '../ui/errores';
import { Icono } from '../ui/Icono';
import { LienzoFirma, type ControlLienzo } from '../ui/LienzoFirma';
import { nombreCorto } from '../ui/nav';
import { useTamano } from '../ui/tamano';
import { PanelMarca } from './Login';
import './firmas.css';

/** Borrador guardado en la tablet; si no está, el del servidor. */
function useFiscalizacionLocal(id: string) {
  return useQuery({
    queryKey: ['fiscalizacion-local', id],
    queryFn: async () => (await db.borradores.get(id))?.datos ?? (await api.get<FiscalizacionDto>(`/fiscalizaciones/${id}`)),
    retry: false,
  });
}

/**
 * Pantalla completa «Firmar en esta tablet» (/fiscalizaciones/:id/firmar/:rol): el auditor pasa su tablet a
 * quien firma (sin usuario). La firma se guarda con PUT /fiscalizaciones/{id}/firmas/{rol} y vuelve a Firmas.
 */
export function FirmarEnTablet() {
  const { id = '', rol = '' } = useParams();
  const tamano = useTamano();
  const navegar = useNavigate();
  const enLinea = useEnLinea();
  const q = useFiscalizacionLocal(id);
  const { data: cat } = useCatalogos();
  const lienzo = useRef<ControlLienzo>(null);
  const [nombre, setNombre] = useState('');
  const [cedula, setCedula] = useState('');
  const [imagen, setImagen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const def = ROLES_FIRMA.find((r) => r.rol === rol);
  if (!def) return <Navigate to={`/fiscalizaciones/${id}/firmas`} replace />;

  const volver = () => navegar(`/fiscalizaciones/${id}/firmas`);
  const d = q.data;
  const autor = nombreCorto(d?.autor?.nombreCompleto) || 'el auditor';
  const suplidor = d ? nombreSuplidor(d.suplidor, cat) : undefined;
  const numero = d?.numero ?? id.slice(0, 8).toUpperCase();

  const aceptar = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!nombre.trim()) return setError('Escriba el nombre completo de quien firma.');
    if (!imagen) return setError('Falta la firma: firme dentro del recuadro.');
    if (!enLinea) return setError('Sin conexión: la firma se registra en el servidor. Intente al volver la red.');
    setEnviando(true);
    try {
      const err = await asegurarSincronizado(id);
      if (err) return setError(err);
      const dto = await api.put<FiscalizacionDto>(`/fiscalizaciones/${id}/firmas/${rol as RolFirma}`, {
        nombreFirmante: nombre.trim(),
        cedula: cedula.trim() || null,
        modo: 'EnEstaTablet',
        imagenBase64: imagen,
      });
      await aplicarRespuestaServidor(dto);
      volver();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className={`acc fet t-${tamano}`}>
      <PanelMarca
        eyebrow="FIRMA EN ESTA TABLET"
        titulo={`Firme en la tablet de ${autor}, como en papel`}
        texto={`El formulario sigue siendo de ${autor}. Usted no necesita usuario ni contraseña: escriba su nombre y firme en el recuadro.`}
        rasgos={null}
      />
      <div className="acc-panel">
        {q.isPending ? (
          <Cargando />
        ) : q.isError ? (
          <ErrorCaja error={q.error} />
        ) : (
          <form className="acc-tarjeta fet-tarjeta" onSubmit={(e) => void aceptar(e)} aria-label="Firmar en esta tablet" noValidate>
            <div className="fet-cab">
              <div className="fet-rol">FIRMA COMO</div>
              <h1 className="fet-titulo">{def.nombre}</h1>
              <div className="fet-sub">
                Fiscalización #{numero}
                {suplidor ? ` · ${suplidor}` : ''}
              </div>
            </div>
            <div className="fet-campos">
              <div className="campo">
                <label className="campo-etiqueta" htmlFor="fet-nombre">
                  Nombre completo
                </label>
                <div className="caja">
                  <input id="fet-nombre" autoComplete="off" value={nombre} onChange={(e) => setNombre(e.target.value)} />
                  <Icono nombre="user" tam={16} className="caja-icono" />
                </div>
              </div>
              <div className="campo">
                <label className="campo-etiqueta" htmlFor="fet-cedula">
                  Cédula (opcional)
                </label>
                <div className="caja">
                  <input
                    id="fet-cedula"
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
            <div className="fet-firma">
              <div className="fet-firma-cab">
                <span>Firme dentro del recuadro</span>
                <button type="button" className="fet-borrar" onClick={() => lienzo.current?.borrar()}>
                  <Icono nombre="eraser" tam={13} />
                  Borrar
                </button>
              </div>
              <div className="fet-lienzo">
                <div className="fet-lienzo-capa">
                  <LienzoFirma alCambiar={setImagen} control={lienzo} etiqueta="Recuadro de firma: firme con el dedo o el lápiz" />
                </div>
                <span className="fet-linea" aria-hidden="true" />
                <span className="fet-pie">
                  {nombre.trim() || 'Nombre de quien firma'} · {def.nombre}
                </span>
              </div>
            </div>
            <button type="submit" className="btn btn-primario fet-aceptar" disabled={enviando}>
              <Icono nombre="check" tam={16} />
              Aceptar firma y devolver la tablet
            </button>
            {error && (
              <div className="aviso aviso-error" role="alert">
                {error}
              </div>
            )}
            <div className="fet-nota">
              <Icono nombre="info" tam={13} />
              <span>La firma queda en el formulario de {autor} con fecha y hora.</span>
            </div>
            <button type="button" className="fet-cancelar" onClick={volver}>
              Cancelar y volver al formulario
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
