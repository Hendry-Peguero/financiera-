import { useEffect } from 'react';
import type { FiscalizacionDto, LecturaDto, VaraDto } from '../api/types';
import { avisoDiferencia, calcular, diferenciaLectura } from '../domain/calculos';
import { EQUIPOS } from '../domain/fiscalizacion';
import { dinero, num, pct } from '../domain/format';
import { useTamano } from '../ui/tamano';
import { CampoNumero, CampoSelect, CampoTexto, EntradaNumero, Tarjeta } from './Campos';
import type { PropsSeccion } from './SeccionesDatos';

/** Clase de la diferencia: verde dentro del 1 %, roja fuera. */
function claseDif(pctDif: number | null) {
  if (pctDif == null) return '';
  return Math.abs(pctDif) > 1 ? ' mal' : ' ok';
}

export function SeccionMediciones({ datos, actualizar, catalogos }: PropsSeccion) {
  const movil = useTamano() === 'movil';
  const m = datos.mediciones;
  const c = calcular(m);
  const aviso = avisoDiferencia(m);
  const setM = <K extends keyof FiscalizacionDto['mediciones']>(k: K, v: FiscalizacionDto['mediciones'][K]) =>
    actualizar((d) => ({ ...d, mediciones: { ...d.mediciones, [k]: v } }));
  const setLectura = (equipo: LecturaDto['equipo'], campo: 'inicial' | 'final', v: number | null) =>
    actualizar((d) => ({
      ...d,
      mediciones: {
        ...d.mediciones,
        lecturas: d.mediciones.lecturas.map((l) => (l.equipo === equipo ? { ...l, [campo]: v } : l)),
      },
    }));
  const setVara = <K extends keyof VaraDto>(k: K, v: VaraDto[K]) =>
    actualizar((d) => ({ ...d, mediciones: { ...d.mediciones, vara: { ...d.mediciones.vara, [k]: v } } }));
  const difVara =
    m.vara.inicialGalones != null && m.vara.finalGalones != null
      ? diferenciaLectura({ inicial: m.vara.inicialGalones, final: m.vara.finalGalones })
      : null;

  // Con un solo producto en el catálogo (Gasoil óptimo) no se pregunta: se asigna solo.
  const unico = catalogos.productos.length === 1 ? catalogos.productos[0].id : null;
  useEffect(() => {
    if (unico != null && m.productoId == null) setM('productoId', unico);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unico, m.productoId]);
  const producto =
    unico == null ? (
      <CampoSelect
        etiqueta="Producto"
        className="fm-producto"
        valor={m.productoId}
        opciones={catalogos.productos.map((p) => ({ id: p.id, texto: p.nombre }))}
        alCambiar={(x) => setM('productoId', x)}
      />
    ) : null;

  const lecturas = EQUIPOS.map((e) => {
    const l = m.lecturas.find((x) => x.equipo === e.equipo) ?? { equipo: e.equipo, inicial: null, final: null };
    return { ...e, l, dif: diferenciaLectura(l) };
  });

  const avisoDif = aviso && (
    <div className="aviso aviso-warn" role="status">
      {aviso} (aviso orientativo)
    </div>
  );

  const importes = (
    <>
      <div className="fm-importe">
        <span>Importe según proveedor</span>
        <span className="mono" data-testid="importe-proveedor">
          {dinero(c.importeProveedor)}
        </span>
      </div>
      <div className="fm-importe">
        <span>Importe medido EGEHID</span>
        <span className="mono" data-testid="importe-egehid">
          {dinero(c.importeEgehid)}
        </span>
      </div>
      <div className="fm-importe">
        <span>Diferencia en importe</span>
        <span className={`mono${c.diferenciaImporte != null && c.diferenciaImporte < 0 ? ' neg' : ''}`} data-testid="diferencia-importe">
          {dinero(c.diferenciaImporte)}
        </span>
      </div>
    </>
  );

  if (movil)
    return (
      <>
        <section className="fm-mcard" aria-label="Totales medidos">
          <div className="fm-mcab">
            <h2 className="fm-mcab-t">Totales medidos</h2>
            <span className="fm-mcab-s">Diferencia = EGEHID − proveedor</span>
          </div>
          {producto}
          <div className="fm-mfila">
            <CampoNumero etiqueta="Proveedor (gal)" mono className="fm-mcampo" valor={m.galonesProveedor} alCambiar={(x) => setM('galonesProveedor', x)} />
            <CampoNumero etiqueta="EGEHID (gal)" mono className="fm-mcampo" valor={m.galonesEgehid} alCambiar={(x) => setM('galonesEgehid', x)} />
          </div>
          <div className={`fm-mdif${claseDif(c.diferenciaPct)}`} aria-live="polite">
            <span className="fm-mdif-textos">
              <span className="fm-mdif-l">Diferencia</span>
              <span className="fm-mdif-s" data-testid="diferencia-pct">
                {c.diferenciaPct == null ? '—' : Math.abs(c.diferenciaPct) > 1 ? `Fuera del margen de 1 % (${pct(c.diferenciaPct)})` : 'Dentro del margen de 1 %'}
              </span>
            </span>
            <span className="fm-mdif-v mono" data-testid="diferencia-gal">
              {num(c.diferenciaGal)} gal
            </span>
          </div>
          {avisoDif}
        </section>

        <section className="fm-mcard" aria-label="Lecturas de equipos">
          <div className="fm-mcab">
            <h2 className="fm-mcab-t">Lecturas de equipos</h2>
            <span className="fm-mcab-s">Final − inicial · el final puede quedar vacío</span>
          </div>
          {lecturas.map(({ equipo, nombre, l, dif }) => (
            <div className="fm-mlectura" key={equipo}>
              <div className="fm-mlectura-cab">
                <span className="fm-mlectura-t">{nombre}</span>
                <span className={`fm-mlectura-d mono${dif == null ? ' sin-dato' : dif < 0 ? ' neg' : ''}`}>Δ {num(dif)}</span>
              </div>
              <div className="fm-mfila">
                <label className="fm-mmini">
                  <span>Inicial</span>
                  <EntradaNumero
                    className="mono"
                    etiqueta={`${nombre} · inicial`}
                    valor={l.inicial}
                    alCambiar={(v) => setLectura(equipo, 'inicial', v)}
                  />
                </label>
                <label className="fm-mmini">
                  <span>Final</span>
                  <EntradaNumero
                    className="mono"
                    etiqueta={`${nombre} · final`}
                    valor={l.final}
                    placeholder="Pendiente"
                    alCambiar={(v) => setLectura(equipo, 'final', v)}
                  />
                </label>
              </div>
            </div>
          ))}
        </section>

        <section className="fm-mcard" aria-label="Vara de medición">
          <div className="fm-mcab">
            <h2 className="fm-mcab-t">Vara de medición</h2>
          </div>
          {(['inicial', 'final'] as const).map((k) => (
            <div className="fm-mvara" key={k}>
              <span className="fm-mvara-l">{k === 'inicial' ? 'Inicial' : 'Final'}</span>
              <span className="fm-mvara-v mono">
                <input
                  aria-label={`Lectura ${k} · medida`}
                  className="fm-mvara-medida"
                  value={m.vara[`${k}Medida` as const] ?? ''}
                  placeholder={k === 'inicial' ? '34 ½ pulg' : '58 pulg'}
                  onChange={(e) => setVara(`${k}Medida` as const, e.target.value === '' ? null : e.target.value)}
                />
                =
                <EntradaNumero
                  className="fm-mvara-gal"
                  etiqueta={`Galones (${k})`}
                  valor={m.vara[`${k}Galones` as const]}
                  sufijo="gal"
                  alCambiar={(v) => setVara(`${k}Galones` as const, v)}
                />
              </span>
            </div>
          ))}
          <div className="fm-mvara fm-mvara-dif">
            <span className="fm-mvara-l">Diferencia</span>
            <span className="fm-mvara-v mono">{num(difVara)} gal</span>
          </div>
        </section>

        <section className="fm-mcard" aria-label="Parámetros de facturación">
          <div className="fm-mcab">
            <h2 className="fm-mcab-t">Parámetros de facturación</h2>
            <span className="fm-mcab-s">El precio puede quedar vacío · importes a centavos</span>
          </div>
          <CampoNumero etiqueta="Precio por galón (RD$)" mono decimales={4} className="fm-mcampo" valor={m.precioGalon} alCambiar={(x) => setM('precioGalon', x)} />
          {importes}
        </section>
      </>
    );

  return (
    <>
      <Tarjeta titulo="Totales medidos" desc="Diferencia = EGEHID menos proveedor · dos decimales" icono="gauge" className="fm-compacta" extra={producto}>
        <div className="fm-totales">
          <label className="fm-total">
            <span className="fm-total-l">Galones según proveedor</span>
            <span className="fm-total-v">
              <EntradaNumero
                className="fm-total-input mono"
                etiqueta="Galones según proveedor"
                valor={m.galonesProveedor}
                placeholder="0.00"
                alCambiar={(x) => setM('galonesProveedor', x)}
              />
              <span className="fm-total-u">gal</span>
            </span>
          </label>
          <label className="fm-total">
            <span className="fm-total-l">Galones medidos EGEHID</span>
            <span className="fm-total-v">
              <EntradaNumero
                className="fm-total-input mono"
                etiqueta="Galones medidos EGEHID"
                valor={m.galonesEgehid}
                placeholder="0.00"
                alCambiar={(x) => setM('galonesEgehid', x)}
              />
              <span className="fm-total-u">gal</span>
            </span>
          </label>
          <div className={`fm-total fm-total-dif${claseDif(c.diferenciaPct)}`} aria-live="polite">
            <span className="fm-total-l">Diferencia</span>
            <span className="fm-total-v">
              <span className="fm-total-num mono" data-testid="diferencia-gal">
                {num(c.diferenciaGal)}
              </span>
              <span className="fm-total-u" data-testid="diferencia-pct">
                gal · {pct(c.diferenciaPct)}
              </span>
            </span>
          </div>
        </div>
        {avisoDif}
      </Tarjeta>

      <Tarjeta titulo="Lecturas de equipos" desc="Contadores: final menos inicial · no se suman entre sí" icono="activity" className="fm-compacta">
        <div className="fm-tabla" role="table" aria-label="Lecturas de equipos">
          <div className="fm-tabla-cab" role="row">
            <span role="columnheader">Equipo</span>
            <span role="columnheader">Inicial</span>
            <span role="columnheader">Final</span>
            <span role="columnheader">Diferencia</span>
          </div>
          {lecturas.map(({ equipo, nombre, l, dif }) => (
            <div className="fm-tabla-fila" role="row" key={equipo}>
              <span className="fm-equipo" role="cell">
                <span className="fm-equipo-n">{nombre}</span>
                {l.inicial != null && l.final == null && <span className="fm-equipo-nota">Solo lectura inicial</span>}
              </span>
              <span className="fm-celda" role="cell">
                <EntradaNumero className="fm-mini mono" etiqueta={`${nombre} · inicial`} valor={l.inicial} alCambiar={(v) => setLectura(equipo, 'inicial', v)} />
              </span>
              <span className="fm-celda" role="cell">
                <EntradaNumero
                  className="fm-mini mono"
                  etiqueta={`${nombre} · final`}
                  valor={l.final}
                  placeholder={l.inicial != null ? 'Final pendiente' : ''}
                  alCambiar={(v) => setLectura(equipo, 'final', v)}
                />
              </span>
              <span className={`fm-dif mono${dif == null ? ' sin-dato' : dif < 0 ? ' neg' : ''}`} role="cell">
                {num(dif)}
              </span>
            </div>
          ))}
        </div>
      </Tarjeta>

      <div className="fm-par">
        <Tarjeta titulo="Vara de medición" desc="Medida libre = galones de la tabla del tanque" icono="ruler" className="fm-compacta">
          <div className="fm-vara">
            <CampoTexto etiqueta="Lectura inicial · medida" valor={m.vara.inicialMedida} placeholder="34 ½ pulg" alCambiar={(x) => setVara('inicialMedida', x)} />
            <span className="fm-igual">=</span>
            <CampoNumero etiqueta="Galones" className="fm-vara-gal" mono valor={m.vara.inicialGalones} alCambiar={(x) => setVara('inicialGalones', x)} />
          </div>
          <div className="fm-vara">
            <CampoTexto etiqueta="Lectura final · medida" valor={m.vara.finalMedida} placeholder="58 pulg" alCambiar={(x) => setVara('finalMedida', x)} />
            <span className="fm-igual">=</span>
            <CampoNumero etiqueta="Galones" className="fm-vara-gal" mono valor={m.vara.finalGalones} alCambiar={(x) => setVara('finalGalones', x)} />
          </div>
          <div className="fm-vara-dif">
            <span>Diferencia (final − inicial)</span>
            <span className="mono">{num(difVara)} gal</span>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Parámetros de facturación" desc="El precio puede quedar vacío · importes a centavos" icono="receipt" className="fm-compacta">
          <CampoNumero etiqueta="Precio por galón (RD$)" mono decimales={4} valor={m.precioGalon} alCambiar={(x) => setM('precioGalon', x)} />
          <div className="fm-importes">{importes}</div>
        </Tarjeta>
      </div>
    </>
  );
}
