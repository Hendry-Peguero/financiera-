import type { CatalogosDto, FiscalizacionDto } from '../api/types';
import { claveNombre, nombreSuplidor } from '../domain/fiscalizacion';
import { CampoFecha, CampoHora, CampoNumero, CampoSelect, CampoTexto, Tarjeta } from './Campos';

export interface PropsSeccion {
  datos: FiscalizacionDto;
  actualizar: (fn: (d: FiscalizacionDto) => FiscalizacionDto) => void;
  catalogos: CatalogosDto;
}

export function SeccionVisita({ datos, actualizar, catalogos }: PropsSeccion) {
  const v = datos.visita;
  const set = <K extends keyof FiscalizacionDto['visita']>(k: K, val: FiscalizacionDto['visita'][K]) =>
    actualizar((d) => ({ ...d, visita: { ...d.visita, [k]: val } }));
  const finAntes = !!v.inicioProceso && !!v.finProceso && v.finProceso < v.inicioProceso;
  return (
    <Tarjeta titulo="Datos de la visita" desc="Fecha, destino y horarios del proceso" icono="map-pin">
      <div className="fm-fila">
        <CampoFecha etiqueta="Fecha" valor={v.fecha} alCambiar={(x) => set('fecha', x)} />
        <CampoHora etiqueta="Hora de salida" valor={v.horaSalida} alCambiar={(x) => set('horaSalida', x)} />
        <CampoHora etiqueta="Inicio del proceso" valor={v.inicioProceso} alCambiar={(x) => set('inicioProceso', x)} />
      </div>
      <div className="fm-fila">
        <CampoSelect
          etiqueta="Destino"
          valor={v.locacionId}
          opciones={catalogos.locaciones.map((l) => ({ id: l.id, texto: l.provincia ? `${l.nombre} (${l.provincia})` : l.nombre }))}
          alCambiar={(x) => set('locacionId', x)}
        />
        <CampoHora etiqueta="Hora de llegada" valor={v.horaLlegada} alCambiar={(x) => set('horaLlegada', x)} />
        <CampoHora
          etiqueta="Fin del proceso"
          valor={v.finProceso}
          alCambiar={(x) => set('finProceso', x)}
          error={finAntes ? 'El fin del proceso es anterior al inicio.' : null}
        />
      </div>
    </Tarjeta>
  );
}

export function SeccionSuplidor({ datos, actualizar, catalogos }: PropsSeccion) {
  const s = datos.suplidor;
  const setS = <K extends keyof FiscalizacionDto['suplidor']>(k: K, val: FiscalizacionDto['suplidor'][K]) =>
    actualizar((d) => ({ ...d, suplidor: { ...d.suplidor, [k]: val } }));
  return (
    <Tarjeta titulo="Datos del suplidor" desc="Empresa proveedora, transporte y documentos" icono="truck">
      <div className="fm-fila">
        <CampoTexto etiqueta="Ficha camión" valor={s.fichaCamion} alCambiar={(x) => setS('fichaCamion', x)} />
        <CampoTexto etiqueta="Chofer" valor={s.chofer} alCambiar={(x) => setS('chofer', x)} />
        <CampoTexto etiqueta="Placa" valor={s.placa} alCambiar={(x) => setS('placa', x)} />
      </div>
      <div className="fm-fila">
        <CampoTexto etiqueta="Conduce" valor={s.conduce} alCambiar={(x) => setS('conduce', x)} />
        <CampoTexto
          etiqueta="Empresa"
          valor={nombreSuplidor(s, catalogos) ?? null}
          alCambiar={(x) => {
            // texto libre: si coincide con el catálogo se enlaza ya; si no, la API lo agrega al guardar
            const id = x ? (catalogos.suplidores.find((c) => claveNombre(c.nombre) === claveNombre(x))?.id ?? null) : null;
            actualizar((d) => ({ ...d, suplidor: { ...d.suplidor, nombre: x, suplidorId: id } }));
          }}
        />
        <CampoNumero etiqueta="Total a entregar" sufijo="gal" valor={s.totalEntregarGal} alCambiar={(x) => setS('totalEntregarGal', x)} />
      </div>
    </Tarjeta>
  );
}

/** «Datos de la empresa»: dos pares Ficha camión / Chofer propios de EGEHID (no copian los del suplidor). */
export function SeccionEmpresa({ datos, actualizar }: Omit<PropsSeccion, 'catalogos'>) {
  const e = datos.empresa;
  const setE = <K extends keyof FiscalizacionDto['empresa']>(k: K, val: FiscalizacionDto['empresa'][K]) =>
    actualizar((d) => ({ ...d, empresa: { ...d.empresa, [k]: val } }));
  return (
    <Tarjeta titulo="Datos de la empresa" desc="Responsables de EGEHID en la recepción" icono="building-2">
      <div className="fm-fila">
        <CampoTexto etiqueta="Ficha camión" valor={e.fichaCamion1 ?? null} alCambiar={(x) => setE('fichaCamion1', x)} />
        <CampoTexto etiqueta="Chofer" valor={e.chofer1 ?? null} alCambiar={(x) => setE('chofer1', x)} />
        <CampoTexto etiqueta="Ficha camión 2" valor={e.fichaCamion2} alCambiar={(x) => setE('fichaCamion2', x)} />
      </div>
      <div className="fm-fila">
        <CampoTexto etiqueta="Chofer 2" valor={e.chofer2} alCambiar={(x) => setE('chofer2', x)} />
        <CampoTexto etiqueta="Responsable" valor={e.responsable} alCambiar={(x) => setE('responsable', x)} />
        <CampoNumero etiqueta="Total a recibir" sufijo="gal" valor={e.totalRecibirGal} alCambiar={(x) => setE('totalRecibirGal', x)} />
      </div>
    </Tarjeta>
  );
}
