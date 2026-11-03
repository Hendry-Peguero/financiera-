import { useState, type CSSProperties, type ReactNode, type UIEvent } from 'react';
import { useCatalogos } from '../api/hooks';
import { usePlantilla } from '../api/plantillas';
import type { FiscalizacionDto } from '../api/types';
import { nombreSuplidor, preguntasDe } from '../domain/fiscalizacion';
import { FotoServidor } from '../formulario/SeccionFotos';
import { Icono } from '../ui/Icono';
import fondo from './formulario-oficial.png';
import { firmaInicial } from './formatoRegistros';
import { FORMULARIO, valoresFormulario, type CampoFormulario, type ValorCampo } from './valoresFormulario';

const FOTOS_POR_PAGINA = 6;
const ID_OFICIAL = 1;

/** Posición de la celda en % de la página (la página del visor mide 470 px; el PDF, carta en puntos). */
function caja(c: CampoFormulario): CSSProperties {
  return {
    left: `${(c.x / FORMULARIO.ancho) * 100}%`,
    top: `${(c.y / FORMULARIO.alto) * 100}%`,
    width: `${(c.ancho / FORMULARIO.ancho) * 100}%`,
    height: `${(c.alto / FORMULARIO.alto) * 100}%`,
  };
}

function Celda({ c, v }: { c: CampoFormulario; v: ValorCampo }) {
  if (c.tipo === 'Firma')
    return (
      <div className="pdf-campo pdf-campo-firma" style={caja(c)}>
        <span className="pdf-trazo">{firmaInicial(v.firma)}</span>
        {v.pie && c.alto >= 18 && <span className="pdf-campo-pie">{v.pie}</span>}
      </div>
    );
  const clase = c.tipo === 'Casilla' ? 'pdf-campo pdf-campo-x' : c.alto >= 24 ? 'pdf-campo pdf-campo-parrafo' : 'pdf-campo';
  return (
    <div className={clase} style={caja(c)} data-campo={c.id}>
      <span>{v.texto}</span>
    </div>
  );
}

function Pie({ izquierda, derecha }: { izquierda: string; derecha: string }) {
  return (
    <div className="pdf-pie">
      <span>{izquierda}</span>
      <span>{derecha}</span>
    </div>
  );
}

/**
 * Visor en pantalla del PDF oficial: el formulario en papel (formulario-oficial.png) con cada valor en su celda y el
 * anexo de fotos. Las descargas vienen de la API (src/api/pdf.ts), que dibuja lo mismo con PDFsharp.
 */
export function PaginasPdf({ f }: { f: FiscalizacionDto }) {
  const { data: cat } = useCatalogos();
  const { data: oficial } = usePlantilla(ID_OFICIAL);
  const valores = valoresFormulario(f, {
    locacion: cat?.locaciones.find((l) => l.id === f.visita.locacionId)?.nombre,
    suplidor: nombreSuplidor(f.suplidor, cat),
    preguntas: preguntasDe(cat),
    encabezado: oficial?.encabezado,
  });
  const producto = cat?.productos.find((p) => p.id === f.mediciones.productoId)?.nombre;
  const rev = `Fiscalización N.º ${f.numero ?? '—'} · Rev. ${f.versionActual || 1}`;
  const fotos = [...(f.fotos ?? [])].sort((a, b) => a.orden - b.orden);
  const paginasFotos = Array.from({ length: Math.ceil(fotos.length / FOTOS_POR_PAGINA) }, (_, i) =>
    fotos.slice(i * FOTOS_POR_PAGINA, (i + 1) * FOTOS_POR_PAGINA),
  );
  const total = 1 + paginasFotos.length;

  return (
    <>
      <div className="pdf-pagina pdf-formulario" style={{ backgroundImage: `url(${fondo})` }}>
        {FORMULARIO.campos.map((c) => (valores[c.id] ? <Celda key={c.id} c={c} v={valores[c.id]} /> : null))}
        <Pie izquierda={producto ? `${rev} · ${producto}` : rev} derecha={`Página 1 de ${total}`} />
      </div>
      {paginasFotos.map((grupo, i) => (
        <div className="pdf-pagina pdf-anexo" key={i}>
          <div className="pdf-anexo-cab">
            <span className="pdf-anexo-t">Anexo · Fotografías{paginasFotos.length > 1 ? ` (${i + 1} de ${paginasFotos.length})` : ''}</span>
            <span>{rev}</span>
          </div>
          <div className="pdf-fotos">
            {grupo.map((foto) => (
              <figure className="pdf-foto" key={foto.id}>
                <div className="pdf-foto-img">
                  <FotoServidor fiscalizacionId={f.id} foto={foto} />
                </div>
                <figcaption>
                  {foto.orden}. {foto.descripcion ?? ''}
                </figcaption>
              </figure>
            ))}
          </div>
          <Pie izquierda={rev} derecha={`Página ${i + 2} de ${total}`} />
        </div>
      ))}
    </>
  );
}

/** Visor del PDF: barra con nombre, zoom y página actual; las páginas se desplazan en el lienzo gris. */
export function VisorPdf({
  f,
  nombre,
  extra,
  zoomInicial = 1,
}: {
  f: FiscalizacionDto;
  nombre: string;
  extra?: ReactNode;
  zoomInicial?: number;
}) {
  const [zoom, setZoom] = useState(zoomInicial);
  const [pagina, setPagina] = useState(1);
  const total = 1 + Math.ceil((f.fotos?.length ?? 0) / FOTOS_POR_PAGINA);
  const alDesplazar = (e: UIEvent<HTMLDivElement>) => {
    const lienzo = e.currentTarget;
    const paginas = Array.from(lienzo.querySelectorAll<HTMLElement>('.pdf-pagina'));
    const medio = lienzo.getBoundingClientRect().top + lienzo.clientHeight / 3;
    let actual = 1;
    paginas.forEach((p, i) => p.getBoundingClientRect().top <= medio && (actual = i + 1));
    setPagina(actual);
  };
  return (
    <section className="det-visor" aria-label="Vista previa del PDF">
      <div className="det-visor-barra">
        <span className="det-visor-t">{nombre}</span>
        <span className="det-visor-ctl">
          <button type="button" aria-label="Alejar" onClick={() => setZoom((z) => Math.max(0.4, Math.round((z - 0.2) * 10) / 10))}>
            <Icono nombre="zoom-out" tam={15} />
          </button>
          <button type="button" aria-label="Acercar" onClick={() => setZoom((z) => Math.min(2, Math.round((z + 0.2) * 10) / 10))}>
            <Icono nombre="zoom-in" tam={15} />
          </button>
          <span>
            Página {pagina} de {total}
          </span>
          {extra}
        </span>
      </div>
      <div className="det-lienzo" onScroll={alDesplazar}>
        <div className="pdf-paginas" style={{ zoom }}>
          <PaginasPdf f={f} />
        </div>
      </div>
    </section>
  );
}
