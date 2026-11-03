import { Link } from 'react-router-dom';
import type { CatalogosDto, FiscalizacionDto, PreguntaControlDto } from '../api/types';
import { calcular } from '../domain/calculos';
import { nombreSuplidor, ROLES_FIRMA } from '../domain/fiscalizacion';
import { fecha, hora12, num, pct } from '../domain/format';
import type { Seccion } from '../domain/validacion';
import { Icono } from '../ui/Icono';
import type { Modo, useFinalizar } from './useFinalizar';

interface Verificacion {
  id: string;
  titulo: string;
  ok: boolean;
  detalle: string;
  /** Pendientes con su lista accesible («Pendientes de Visita»). */
  listas: { nombre: string; items: string[] }[];
  ir: Seccion;
}

/** Panel lateral «Revisar y finalizar»: verificación por bloque, PDF y botón final. */
export function PanelRevisar({
  datos,
  pendientes,
  preguntas,
  fotos,
  modo,
  fin,
  boton,
  vistaPrevia,
}: {
  datos: FiscalizacionDto;
  pendientes: Record<Seccion, string[]>;
  preguntas: PreguntaControlDto[];
  fotos: number;
  modo: Modo;
  fin: ReturnType<typeof useFinalizar>;
  /** false en Tablet V: el botón va en la barra inferior. */
  boton: boolean;
  /** Abre la vista previa del PDF que genera la API (solo en un borrador). */
  vistaPrevia?: () => void;
}) {
  const c = calcular(datos.mediciones);
  const respondidos = preguntas.filter((q) => datos.controles.find((x) => x.numero === q.numero)?.respuesta != null).length;
  const observaciones = datos.controles.filter((x) => (x.observacion ?? '').trim() !== '').length;
  const conDescripcion = (datos.fotos ?? []).filter((f) => (f.descripcion ?? '').trim() !== '').length;
  const firmadas = new Set((datos.firmas ?? []).map((f) => f.rol));
  const participantes = ROLES_FIRMA.filter((r) => r.grupo === 'participante');
  const cierre = ROLES_FIRMA.filter((r) => r.grupo === 'cierre' && r.requerida);
  const faltanCierre = cierre.filter((r) => !firmadas.has(r.rol));
  const faltanPart = participantes.filter((r) => r.requerida && !firmadas.has(r.rol));
  const msgFirma = (nombre: string) => `Falta la firma de ${nombre}.`;
  const total = Object.values(pendientes).reduce((n, p) => n + p.length, 0);

  const lista: Verificacion[] = [
    {
      id: 'datos',
      titulo: 'Datos de la visita y suplidor',
      ok: !pendientes.visita.length,
      detalle: 'Completos',
      listas: [{ nombre: 'Visita, suplidor y empresa', items: pendientes.visita }],
      ir: 'visita',
    },
    {
      id: 'mediciones',
      titulo: 'Mediciones y lecturas',
      ok: !pendientes.mediciones.length,
      detalle:
        c.diferenciaPct == null ? 'Sin diferencia calculada' : Math.abs(c.diferenciaPct) > 1 ? `Diferencia de ${pct(c.diferenciaPct)} (mayor al 1 %)` : 'Diferencia dentro del 1 %',
      listas: [{ nombre: 'Mediciones', items: pendientes.mediciones }],
      ir: 'mediciones',
    },
    {
      id: 'controles',
      titulo: `${preguntas.length} controles internos`,
      ok: !pendientes.controles.length,
      detalle: `${respondidos} respondidos · ${observaciones} observaci${observaciones === 1 ? 'ón' : 'ones'}`,
      listas: [{ nombre: 'Controles', items: pendientes.controles }],
      ir: 'controles',
    },
    {
      id: 'fotos',
      titulo: 'Fotografías',
      ok: !pendientes.fotos.length,
      detalle: fotos === 0 ? 'Sin fotos' : `${fotos} foto${fotos === 1 ? '' : 's'}${conDescripcion === fotos ? ' con descripción' : ''}`,
      listas: [{ nombre: 'Fotografías', items: pendientes.fotos }],
      ir: 'fotos',
    },
    {
      id: 'participantes',
      titulo: 'Firmas de participantes',
      ok: faltanPart.length === 0,
      detalle: `${participantes.filter((r) => firmadas.has(r.rol)).length} de ${participantes.length}`,
      listas: [{ nombre: 'Firmas', items: faltanPart.map((r) => msgFirma(r.nombre)) }],
      ir: 'firmas',
    },
    {
      id: 'cierre',
      titulo: 'Firmas de cierre',
      ok: faltanCierre.length === 0,
      detalle: 'Completas',
      listas: [{ nombre: 'Firmas de cierre', items: faltanCierre.map((r) => `Falta ${r.nombre}`) }],
      ir: 'firmas',
    },
  ];

  const numeroCorto = (datos.numero ?? datos.id.slice(0, 4).toUpperCase()).split('-')[0];
  const archivo = `Fiscalizacion-${numeroCorto}-${(datos.visita.fecha ?? '').split('-').reverse().join('')}.pdf`;

  return (
    <aside className="tarjeta fm-revisar" aria-label="Revisar y finalizar">
      <h2 className="fm-revisar-t">{modo === 'correccion' ? 'Revisar y guardar corrección' : 'Revisar y finalizar'}</h2>
      {lista.map((v) => (
        <Link key={v.id} to={`/fiscalizaciones/${datos.id}/${v.ir}`} className={`fm-verif${v.ok ? '' : ' mal'}`} data-seccion={v.id}>
          <Icono nombre={v.ok ? 'circle-check' : 'circle-x'} tam={17} />
          <span className="fm-verif-textos">
            <span className="fm-verif-t">{v.titulo}</span>
            {v.ok ? (
              <span className="fm-verif-s">{v.detalle}</span>
            ) : (
              v.listas
                .filter((l) => l.items.length)
                .map((l) => (
                  <ul key={l.nombre} className="fm-verif-s fm-verif-lista" aria-label={`Pendientes de ${l.nombre}`}>
                    {l.items.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                ))
            )}
          </span>
        </Link>
      ))}
      {(() => {
        const contenido = (
          <>
            <span className="fm-pdf-icono">PDF</span>
            <span className="fm-pdf-textos">
              <span className="fm-pdf-t">{archivo}</span>
              <span className="fm-pdf-s">
                Se genera al finalizar · anexo de {fotos} foto{fotos === 1 ? '' : 's'}
              </span>
            </span>
          </>
        );
        return vistaPrevia ? (
          <button type="button" className="fm-pdf" aria-label={`Vista previa de ${archivo}`} title="Vista previa del PDF" onClick={vistaPrevia}>
            {contenido}
          </button>
        ) : (
          <div className="fm-pdf">{contenido}</div>
        );
      })()}
      {fin.errores.length > 0 && (
        <div className="aviso aviso-error" role="alert">
          <div>
            <strong>No se pudo completar:</strong>
            <ul className="fm-nota-lista">
              {fin.errores.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
            {fin.conflicto && (
              <button type="button" className="btn" onClick={() => void fin.usarServidor()}>
                Usar versión del servidor
              </button>
            )}
          </div>
        </div>
      )}
      <div className="fm-esp" />
      <p className="fm-revisar-nota">
        {modo === 'correccion'
          ? 'La corrección crea una nueva versión con el detalle de cada campo cambiado.'
          : 'Al finalizar, el registro queda de solo lectura. Una corrección posterior conserva el mismo número y archiva la versión anterior.'}
        {total === 0 && !fin.enLinea && modo === 'correccion' && <span className="fm-warn"> Necesita conexión para guardar la corrección.</span>}
        {total === 0 && !fin.enLinea && modo !== 'correccion' && !fin.enEspera && (
          <span className="fm-warn"> Sin conexión: al finalizar queda guardado en la tablet y se envía solo al volver la red.</span>
        )}
        {fin.enEspera && (
          <span className="fm-warn" role="status">
            {' '}
            Finalización en espera: guardada en la tablet; se enviará y confirmará con el servidor en cuanto haya conexión.
          </span>
        )}
      </p>
      {boton && (
        <button
          type="button"
          className="btn fm-finalizar"
          disabled={total > 0 || fin.enviando || fin.enEspera || (modo === 'correccion' && !fin.enLinea)}
          onClick={() => void (modo === 'correccion' ? fin.corregir() : fin.finalizar())}
        >
          <Icono nombre="lock" tam={16} /> {modo === 'correccion' ? 'Guardar corrección' : fin.enEspera ? 'En espera de conexión' : 'Finalizar y generar PDF'}
        </button>
      )}
    </aside>
  );
}

/** «Resumen del registro»: datos principales y observaciones generales (editables). */
export function ResumenRegistro({
  datos,
  actualizar,
  catalogos,
}: {
  datos: FiscalizacionDto;
  actualizar: (fn: (d: FiscalizacionDto) => FiscalizacionDto) => void;
  catalogos: CatalogosDto;
}) {
  const c = calcular(datos.mediciones);
  const v = datos.visita;
  const loc = catalogos.locaciones.find((l) => l.id === v.locacionId)?.nombre;
  const sup = nombreSuplidor(datos.suplidor, catalogos);
  const prod = catalogos.productos.find((p) => p.id === datos.mediciones.productoId)?.nombre;
  const dato = (et: string, val: string, clase = '') => (
    <div className="fm-dato">
      <span className="fm-dato-l">{et}</span>
      <span className={`fm-dato-v${clase}`}>{val}</span>
    </div>
  );
  const mal = c.diferenciaPct != null && Math.abs(c.diferenciaPct) > 1;
  return (
    <section className="tarjeta fm-resumen-reg" aria-label="Resumen del registro">
      <div className="fm-cab-borde">
        <div className="fm-cab-textos">
          <h2 className="fm-cab-t">Resumen del registro</h2>
          <span className="fm-cab-s">Revise antes de finalizar · el PDF se genera al confirmar</span>
        </div>
      </div>
      <div className="fm-datos">
        <div className="fm-datos-col">
          {dato('Fecha', fecha(v.fecha))}
          {dato('Destino', loc ?? '—')}
          {dato('Horario', `${hora12(v.horaSalida)} – ${hora12(v.finProceso)}`)}
        </div>
        <div className="fm-datos-col">
          {dato('Suplidor', (sup ?? '—').replace(/,?\s*S\.R\.L\.?$/i, ''))}
          {dato('Conduce', datos.suplidor.conduce ?? '—')}
          {dato('Producto', prod ?? '—')}
        </div>
        <div className="fm-datos-col">
          {dato('Proveedor', `${num(datos.mediciones.galonesProveedor)} gal`)}
          {dato('EGEHID', `${num(datos.mediciones.galonesEgehid)} gal`)}
          {dato('Diferencia', `${num(c.diferenciaGal)} gal (${pct(c.diferenciaPct)})`, c.diferenciaGal == null ? '' : mal ? ' neg' : ' pos')}
        </div>
      </div>
      <div className="fm-obs-gen">
        <label className="fm-dato-l" htmlFor="obs-generales">
          Observaciones generales
        </label>
        <textarea
          id="obs-generales"
          rows={3}
          placeholder="Escriba aquí las observaciones generales de la fiscalización…"
          value={datos.observacionesGenerales ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            actualizar((d) => ({ ...d, observacionesGenerales: val === '' ? null : val }));
          }}
        />
      </div>
    </section>
  );
}
