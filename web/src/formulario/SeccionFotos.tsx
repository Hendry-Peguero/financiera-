import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';
import type { FiscalizacionDto, FotoDto } from '../api/types';
import { comprimirImagen } from '../offline/imagen';
import { actualizarDescripcionFoto, agregarFotoLocal, borrarFotoLocal, borrarFotoServidor } from '../offline/sync';
import { Icono } from '../ui/Icono';
import { MAX_FOTOS, useFotosLocales } from './fotos';

function ImagenBlob({ blob, alt }: { blob: Blob; alt: string }) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <img src={url} alt={alt} />;
}

export function FotoServidor({ fiscalizacionId, foto }: { fiscalizacionId: string; foto: FotoDto }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  useEffect(() => {
    let vivo = true;
    api
      .blob(`/fiscalizaciones/${fiscalizacionId}/fotos/${foto.id}`)
      .then((b) => vivo && setBlob(b))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [fiscalizacionId, foto.id]);
  return blob ? <ImagenBlob blob={blob} alt={foto.descripcion ?? `Foto ${foto.orden}`} /> : <Icono nombre="camera" tam={28} />;
}

/** «Fotografías de soporte»: galería o cámara; se comprimen, se guardan en la tablet y se suben al haber red. */
export function SeccionFotos({ datos, soloLectura = false }: { datos: FiscalizacionDto; soloLectura?: boolean }) {
  const { fotos: locales, leer } = useFotosLocales(datos.id);
  const galeria = useRef<HTMLInputElement>(null);
  const camara = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const subidasIds = new Set(locales.map((f) => f.servidorId).filter(Boolean));
  const soloServidor = (datos.fotos ?? []).filter((f) => !subidasIds.has(f.id));
  const total = locales.length + soloServidor.length;
  const lleno = total >= MAX_FOTOS || procesando;

  const agregar = async (archivos: FileList | null) => {
    if (!archivos?.length) return;
    setError(null);
    const libres = MAX_FOTOS - total;
    const lista = Array.from(archivos).slice(0, Math.max(0, libres));
    if (archivos.length > libres) setError(`Máximo ${MAX_FOTOS} fotos por registro.`);
    setProcesando(true);
    try {
      for (const a of lista) {
        const comprimida = await comprimirImagen(a).catch(() => a);
        await agregarFotoLocal(datos.id, comprimida, '');
      }
    } finally {
      setProcesando(false);
      if (galeria.current) galeria.current.value = '';
      if (camara.current) camara.current.value = '';
      void leer();
    }
  };

  return (
    <section className="tarjeta fm-fotos" aria-label="Fotografías">
      <div className="fm-cab-borde">
        <div className="fm-cab-textos">
          <h2 className="fm-cab-t">Fotografías de soporte</h2>
          <span className="fm-cab-s">
            {total} de {MAX_FOTOS} · comprimidas automáticamente · se anexan al PDF
          </span>
        </div>
        {!soloLectura && (
          <div className="fm-fotos-acc">
            <input ref={galeria} type="file" accept="image/*" multiple hidden aria-label="Elegir fotos de la galería" onChange={(e) => void agregar(e.target.files)} />
            <input
              ref={camara}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              aria-label="Tomar foto con la cámara"
              onChange={(e) => void agregar(e.target.files)}
            />
            <button type="button" className="btn fm-btn-32" disabled={lleno} onClick={() => galeria.current?.click()}>
              <Icono nombre="images" tam={16} /> Galería
            </button>
            <button type="button" className="btn btn-primario fm-btn-32" disabled={lleno} onClick={() => camara.current?.click()}>
              <Icono nombre="camera" tam={16} /> {procesando ? 'Procesando…' : 'Tomar foto'}
            </button>
          </div>
        )}
      </div>
      {error && (
        <div className="aviso aviso-warn fm-fotos-aviso" role="alert">
          {error}
        </div>
      )}
      {total === 0 ? (
        <div className="fm-fotos-vacio">Aún no hay fotos. Use «Tomar foto» o «Galería»; se guardan en la tablet aunque no haya red.</div>
      ) : (
        <div className="fm-rejilla">
          {locales.map((f) => (
            <figure className="fm-foto" key={f.id}>
              <div className="fm-foto-img">
                <ImagenBlob blob={f.blob} alt={f.descripcion || `Foto ${f.orden}`} />
                {!f.servidorId && <span className="fm-foto-local">En la tablet</span>}
                {!soloLectura && (
                  <button type="button" className="fm-foto-quitar" aria-label={`Quitar foto ${f.orden}`} onClick={() => void borrarFotoLocal(f).then(leer)}>
                    <Icono nombre="trash-2" tam={13} />
                  </button>
                )}
              </div>
              <textarea
                className="fm-foto-desc"
                rows={2}
                aria-label={`Descripción de la foto ${f.orden}`}
                placeholder="Agregar descripción"
                defaultValue={f.descripcion}
                readOnly={soloLectura || !!f.servidorId}
                onBlur={(e) => void actualizarDescripcionFoto(f.id, e.target.value).then(leer)}
              />
            </figure>
          ))}
          {soloServidor.map((f) => (
            <figure className="fm-foto" key={f.id}>
              <div className="fm-foto-img">
                <FotoServidor fiscalizacionId={datos.id} foto={f} />
                {!soloLectura && (
                  <button type="button" className="fm-foto-quitar" aria-label={`Quitar foto ${f.orden}`} onClick={() => void borrarFotoServidor(datos.id, f.id)}>
                    <Icono nombre="trash-2" tam={13} />
                  </button>
                )}
              </div>
              <figcaption className="fm-foto-desc">{f.descripcion || 'Sin descripción'}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
