import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useMe } from '../api/hooks';
import type { UsuarioDto } from '../api/types';
import { useSesion } from '../auth/contexto';
import { mensajeError } from '../ui/errores';
import { Icono } from '../ui/Icono';
import { LienzoFirma, type ControlLienzo } from '../ui/LienzoFirma';
import { useTamano } from '../ui/tamano';
import { PanelMarca } from './Login';
import './login.css';
import './primer-ingreso.css';

/** Convierte una imagen elegida (JPG/PNG/WebP) a PNG en base64 (sin prefijo data:). */
export async function imagenAPng(archivo: File, maxAncho = 900): Promise<string> {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => mal(new Error('No se pudo leer la imagen.'));
      i.src = url;
    });
    const escala = Math.min(1, maxAncho / img.naturalWidth);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * escala));
    c.height = Math.max(1, Math.round(img.naturalHeight * escala));
    c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png').replace(/^data:[^,]+,/, '');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function PrimerIngreso() {
  const { data: me } = useMe();
  const sesion = useSesion();
  const qc = useQueryClient();
  const navegar = useNavigate();
  const tamano = useTamano();
  const [nombre, setNombre] = useState(me?.nombreCompleto ?? '');
  const [cargo, setCargo] = useState(me?.cargo ?? '');
  const [firma, setFirma] = useState<string | null>(null);
  const [modo, setModo] = useState<'dibujar' | 'subir'>('dibujar');
  const [predeterminada, setPredeterminada] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const lienzo = useRef<ControlLienzo>(null);
  const archivo = useRef<HTMLInputElement>(null);
  const movil = tamano === 'movil';

  if (me?.perfilCompleto && !enviando) return <Navigate to="/" replace />;

  const guardar = async (conFirma: boolean) => {
    setError(null);
    if (!nombre.trim() || !cargo.trim()) {
      setError('Escriba su nombre completo y su cargo.');
      return;
    }
    const guardarFirma = conFirma && predeterminada;
    if (guardarFirma && !firma) {
      setError('Dibuje su firma o pulse «Completar después».');
      return;
    }
    setEnviando(true);
    try {
      const u = await api.put<UsuarioDto>('/me/perfil', { nombreCompleto: nombre.trim(), cargo: cargo.trim() });
      if (guardarFirma && firma) await api.put<void>('/me/firma', { imagenBase64: firma });
      qc.setQueryData(['me', sesion.correo], { ...u, tieneFirma: u.tieneFirma || (guardarFirma && !!firma) });
      navegar('/', { replace: true });
    } catch (e) {
      setError(mensajeError(e));
      setEnviando(false);
    }
  };

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    void guardar(true);
  };

  const borrar = () => {
    if (modo === 'dibujar') lienzo.current?.borrar();
    setFirma(null);
  };

  const elegirImagen = async (f: File | undefined) => {
    if (!f) return;
    try {
      setFirma(await imagenAPng(f));
      setModo('subir');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const recuadro = (
    <div className="pi-lienzo">
      {modo === 'dibujar' ? (
        <div className="pi-lienzo-capa">
          <LienzoFirma alCambiar={setFirma} control={lienzo} etiqueta="Recuadro de firma: firme con el dedo o el lápiz" />
        </div>
      ) : firma ? (
        <img className="pi-lienzo-img" src={`data:image/png;base64,${firma}`} alt="Firma elegida" />
      ) : (
        <button type="button" className="pi-lienzo-capa pi-elegir" onClick={() => archivo.current?.click()}>
          Toque para elegir una imagen de su firma
        </button>
      )}
      <span className="pi-trazo" aria-hidden="true" />
      <span className="pi-linea" aria-hidden="true" />
      {!movil && (
        <span className="pi-pie">
          {nombre.trim() || 'Nombre'}
          {cargo.trim() ? ` · ${cargo.trim()}` : ''}
        </span>
      )}
    </div>
  );

  const entradaArchivo = (
    <input
      ref={archivo}
      type="file"
      accept="image/png,image/jpeg,image/webp"
      hidden
      aria-label="Subir imagen de la firma"
      onChange={(e) => {
        void elegirImagen(e.target.files?.[0]);
        e.target.value = '';
      }}
    />
  );

  const campos = (
    <>
      <div className="campo">
        <label className="campo-etiqueta" htmlFor="pi-nombre">
          Nombre completo
        </label>
        <div className="caja">
          <input id="pi-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" />
          <Icono nombre="user" tam={16} className="caja-icono" />
        </div>
      </div>
      <div className="campo">
        <label className="campo-etiqueta" htmlFor="pi-cargo">
          Cargo
        </label>
        <div className="caja">
          <input id="pi-cargo" value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Auditora de campo" />
          <Icono nombre="briefcase" tam={16} className="caja-icono" />
        </div>
      </div>
    </>
  );

  const errorCaja = error && (
    <div className="aviso aviso-error" role="alert">
      {error}
    </div>
  );

  if (movil)
    return (
      <form className="pi-movil t-movil" onSubmit={enviar} aria-label="Perfil y firma" noValidate>
        <section className="pi-m-marca">
          <div className="pi-m-eyebrow">PRIMER INGRESO · PASO 2 DE 2</div>
          <h1 className="pi-m-titular">Complete su perfil</h1>
          <p className="pi-m-texto">Registre su firma una sola vez y úsela con un toque en cada formulario.</p>
          <div className="pi-m-progreso">
            <span />
            <span />
          </div>
        </section>
        <div className="pi-m-contenido">
          {campos}
          <section className="pi-m-firma" aria-label="Su firma">
            <div className="pi-cab">
              <div className="pi-cab-textos">
                <h2 className="pi-cab-t">Su firma</h2>
                <div className="pi-cab-s">Firme con el dedo o el lápiz</div>
              </div>
              <button type="button" className="pi-m-subir" onClick={() => archivo.current?.click()}>
                <Icono nombre="image-up" tam={14} />
                Subir imagen
              </button>
            </div>
            {recuadro}
            <div className="pi-herramientas">
              <label className="casilla pi-casilla">
                <input type="checkbox" checked={predeterminada} onChange={(e) => setPredeterminada(e.target.checked)} />
                Usar como predeterminada
              </label>
              <button type="button" className="pi-borrar pi-m-borrar" onClick={borrar}>
                <Icono nombre="eraser" tam={14} />
                Borrar
              </button>
            </div>
          </section>
          {entradaArchivo}
          {errorCaja}
          <div className="aviso aviso-info pi-m-nota">
            <Icono nombre="shield-check" tam={16} />
            <span>Se guarda cifrada en la tablet. Puede cambiarla luego en Mi cuenta.</span>
          </div>
        </div>
        <div className="pi-m-barra">
          <button type="submit" className="btn btn-primario pi-m-guardar" disabled={enviando}>
            <Icono nombre="check" tam={16} />
            Guardar y continuar
          </button>
          <button type="button" className="enlace pi-m-despues" disabled={enviando} onClick={() => void guardar(false)}>
            Completar después
          </button>
        </div>
      </form>
    );

  return (
    <div className={`acc t-${tamano}`}>
      <PanelMarca />
      <div className="acc-panel">
        <form className="acc-tarjeta pi-tarjeta" onSubmit={enviar} aria-label="Perfil y firma" noValidate>
          <div className="pi-pasos" aria-label="Paso 2 de 2">
            <span className="pi-paso">
              <span className="pi-circulo pi-hecho">
                <Icono nombre="check" tam={12} />
              </span>
              <span className="pi-paso-l">Cuenta creada</span>
            </span>
            <span className="pi-conector" />
            <span className="pi-paso">
              <span className="pi-circulo pi-actual">2</span>
              <span className="pi-paso-l pi-paso-actual">Perfil y firma</span>
            </span>
          </div>
          <div className="acc-encabezado">
            <h1 className="acc-titulo">Complete su perfil</h1>
            <p className="acc-texto">
              Es su primer ingreso. Registre su firma una sola vez: quedará guardada como predeterminada y podrá insertarla con un
              toque en cada formulario.
            </p>
          </div>
          <div className="pi-datos">{campos}</div>
          <section className="pi-firma" aria-label="Su firma">
            <div className="pi-cab">
              <div className="pi-cab-textos">
                <h2 className="pi-cab-t">Su firma</h2>
                <div className="pi-cab-s">Firme con el dedo o el lápiz dentro del recuadro</div>
              </div>
              <div className="pi-modo" role="group" aria-label="Cómo registrar la firma">
                <button
                  type="button"
                  className={`pi-modo-b${modo === 'dibujar' ? ' activo' : ''}`}
                  aria-pressed={modo === 'dibujar'}
                  onClick={() => {
                    setModo('dibujar');
                    setFirma(null);
                  }}
                >
                  <Icono nombre="pen-line" tam={13} />
                  Dibujar
                </button>
                <button
                  type="button"
                  className={`pi-modo-b${modo === 'subir' ? ' activo' : ''}`}
                  aria-pressed={modo === 'subir'}
                  onClick={() => archivo.current?.click()}
                >
                  <Icono nombre="image-up" tam={13} />
                  Subir imagen
                </button>
              </div>
            </div>
            {recuadro}
            <div className="pi-herramientas">
              <label className="casilla pi-casilla">
                <input type="checkbox" checked={predeterminada} onChange={(e) => setPredeterminada(e.target.checked)} />
                Usar como firma predeterminada
              </label>
              <button type="button" className="pi-borrar" onClick={borrar}>
                <Icono nombre="eraser" tam={14} />
                Borrar trazo
              </button>
            </div>
            {entradaArchivo}
          </section>
          {errorCaja}
          <div className="pi-acciones">
            <button type="button" className="btn btn-grande" disabled={enviando} onClick={() => void guardar(false)}>
              <Icono nombre="clock" tam={16} />
              Completar después
            </button>
            <button type="submit" className="btn btn-primario btn-grande" disabled={enviando}>
              <Icono nombre="check" tam={16} />
              Guardar y continuar
            </button>
          </div>
          <div className="aviso aviso-info acc-nota">
            <Icono nombre="shield-check" tam={16} />
            <span>
              La firma se guarda cifrada en la tablet. Al firmar un formulario podrá usarla con «Usar mi firma» o dibujar una nueva.
              Puede cambiarla en Mi cuenta.
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
