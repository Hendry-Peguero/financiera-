import { useMemo, useState } from 'react';
import { api } from '../api/client';
import type { FiscalizacionDto, FirmaEntradaDto, ModoFirma, RolFirma, UsuarioDto } from '../api/types';
import { ROLES_FIRMA } from '../domain/fiscalizacion';
import { horaDe } from '../domain/format';
import { useEnLinea } from '../offline/hooks';
import { aplicarRespuestaServidor, asegurarSincronizado } from '../offline/sync';
import { mensajeError } from '../ui/errores';
import { Icono } from '../ui/Icono';
import { nombreCorto } from '../ui/nav';
import { DarAcceso } from './DarAcceso';
import { FirmarAqui } from './FirmarAqui';
import { estadoAcceso, ultimaPorRol, useAgregarSolicitud, useSolicitudesRegistro, type SolicitudesRegistro } from './solicitudes';

const MODOS: Record<ModoFirma, string> = {
  Predeterminada: 'firma predeterminada',
  EnSuEquipo: 'en su tablet',
  EnEstaTablet: 'en esta tablet',
};

type GrupoFirma = (typeof ROLES_FIRMA)[number]['grupo'];

/** Pestañas del panel: las firmas de la visita y, aparte, las de cierre («Inspector actuante» y «Revisado por», al pie del formulario). */
const GRUPOS: { grupo: GrupoFirma; texto: string }[] = [
  { grupo: 'participante', texto: 'Participantes' },
  { grupo: 'cierre', texto: 'Cierre' },
];

/** «Ana Lucía Pérez» → «Ana P.» (trazo de muestra junto al nombre). */
function trazoCorto(nombre: string) {
  const p = nombre.trim().split(/\s+/);
  return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0];
}

/** «Ramón Antonio Peña» → «Ramón A. Peña». */
function nombreAbreviado(nombre: string) {
  const p = nombre.trim().split(/\s+/);
  if (p.length < 3) return nombre.trim();
  return [p[0], ...p.slice(1, -1).map((x) => `${x[0]}.`), p[p.length - 1]].join(' ');
}

/** Quién firmará en esta tablet si aún no hay firma: el chofer por el proveedor. */
function previsto(datos: FiscalizacionDto, rol: RolFirma): string | null {
  if (rol === 'RepresentanteProveedor' && datos.suplidor.chofer) return nombreAbreviado(datos.suplidor.chofer);
  return null;
}

/** Firmar en el servidor (PUT /fiscalizaciones/{id}/firmas/{rol}) tras enviar los cambios pendientes. */
function useFirmar(datos: FiscalizacionDto) {
  const [ocupado, setOcupado] = useState<RolFirma | null>(null);
  const firmar = async (rol: RolFirma, cuerpo: FirmaEntradaDto): Promise<string | null> => {
    setOcupado(rol);
    try {
      const e = await asegurarSincronizado(datos.id);
      if (e) return e;
      const dto = await api.put<FiscalizacionDto>(`/fiscalizaciones/${datos.id}/firmas/${rol}`, cuerpo);
      await aplicarRespuestaServidor(dto);
      return null;
    } catch (e) {
      return mensajeError(e);
    } finally {
      setOcupado(null);
    }
  };
  return { firmar, ocupado };
}

export function SeccionFirmas({
  datos,
  me,
  soloLectura = false,
}: {
  datos: FiscalizacionDto;
  me: UsuarioDto;
  soloLectura?: boolean;
}) {
  const enLinea = useEnLinea();
  const [acceso, setAcceso] = useState<RolFirma | null>(null);
  const [aqui, setAqui] = useState<RolFirma | null>(null);
  const [error, setError] = useState<string | null>(null);
  const solicitudes = useSolicitudesRegistro(datos.id);
  const agregarSolicitud = useAgregarSolicitud(datos.id);
  const ultimas = useMemo(() => ultimaPorRol(solicitudes.data?.lista ?? []), [solicitudes.data]);
  const { firmar, ocupado } = useFirmar(datos);
  const firmas = datos.firmas ?? [];
  const yaFirme = firmas.some((x) => x.usuarioId === me.id);
  const [grupo, setGrupo] = useState<GrupoFirma>('participante');
  const roles = ROLES_FIRMA.filter((r) => r.grupo === grupo);

  return (
    <section className="tarjeta fm-firmas" aria-label="Participantes y firmas">
      <div className="fm-cab-borde">
        <div className="fm-cab-textos">
          <h2 className="fm-cab-t">Participantes y firmas</h2>
          <span className="fm-cab-s">Con acceso en su tablet, o aquí en esta</span>
        </div>
        <span className="fm-contador">
          {firmas.length} de {ROLES_FIRMA.length} firmadas
        </span>
      </div>
      <div className="fm-firmas-pestanas" role="tablist" aria-label="Grupo de firmas">
        {GRUPOS.map((g) => {
          const delGrupo = ROLES_FIRMA.filter((r) => r.grupo === g.grupo);
          const hechas = delGrupo.filter((r) => firmas.some((f) => f.rol === r.rol)).length;
          return (
            <button
              key={g.grupo}
              type="button"
              role="tab"
              aria-selected={grupo === g.grupo}
              className={`fm-firmas-pestana${grupo === g.grupo ? ' activa' : ''}`}
              onClick={() => setGrupo(g.grupo)}
            >
              {g.texto} ({hechas}/{delGrupo.length})
            </button>
          );
        })}
      </div>
      <div className="fm-firmas-lista" role="tabpanel">
        {error && (
          <div className="aviso aviso-error" role="alert">
            {error}
          </div>
        )}
        <AvisoSolicitudes estado={solicitudes.data} error={solicitudes.isError ? mensajeError(solicitudes.error) : null} />
        {roles.map((r) => {
          const f = firmas.find((x) => x.rol === r.rol);
          const ultima = f ? undefined : ultimas.get(r.rol);
          const acceso = estadoAcceso(ultima);
          const sol = acceso === 'enviado' ? ultima : undefined;
          // rechazada o vencida: se muestra a quién se le pidió y se puede dar acceso de nuevo
          const cerrada = acceso === 'rechazado' || acceso === 'vencido' ? ultima : undefined;
          const prev = !f && !sol && !cerrada ? previsto(datos, r.rol) : null;
          const clase = f
            ? 'firmada'
            : sol
              ? 'enviada'
              : prev
                ? 'prevista'
                : `libre${acceso === 'rechazado' ? ' rechazada' : acceso === 'vencido' ? ' vencida' : ''}`;
          return (
            <div className={`fm-firma ${clase}`} key={r.rol} data-rol={r.rol}>
              <div className="fm-firma-textos">
                <span className="fm-firma-rol">
                  {r.nombre}
                  {r.requerida ? <span className="sr-only"> · requerida</span> : null}
                </span>
                <span className="fm-firma-nombre">
                  {f
                    ? `${f.nombreFirmante}${f.usuarioId === me.id ? ' (usted)' : ''}`
                    : sol
                      ? sol.firmante || 'Esperando firma'
                      : cerrada
                        ? cerrada.firmante
                        : (prev ?? 'Sin asignar')}
                </span>
                <span className="fm-firma-estado">
                  {f ? (
                    <>
                      <Icono nombre="circle-check" tam={10} /> Firmó {horaDe(f.firmadoEn)} · {MODOS[f.modo]}
                    </>
                  ) : sol ? (
                    <>
                      <Icono nombre="hourglass" tam={10} /> Acceso enviado · firmará en su tablet
                    </>
                  ) : cerrada && acceso === 'rechazado' ? (
                    <span title={cerrada.comentario ?? undefined}>
                      <Icono nombre="circle-x" tam={10} /> Rechazó el acceso{cerrada.comentario ? ` · ${cerrada.comentario}` : ''}
                    </span>
                  ) : cerrada ? (
                    <>
                      <Icono nombre="calendar-clock" tam={10} /> Acceso vencido · dar acceso de nuevo o firmar aquí
                    </>
                  ) : prev ? (
                    <>
                      <Icono nombre="tablet" tam={10} /> Firmará en esta tablet
                    </>
                  ) : (
                    <>
                      <Icono nombre="user-plus" tam={10} /> Dar acceso o firmar aquí
                    </>
                  )}
                </span>
              </div>
              {f ? (
                <span className="fm-firma-trazo" aria-hidden="true">
                  {trazoCorto(f.nombreFirmante)}
                </span>
              ) : (
                !soloLectura && (
                  <div className="fm-firma-acc">
                    {me.tieneFirma && !yaFirme && !sol && (
                      <button
                        type="button"
                        className="fm-firma-btn"
                        disabled={!enLinea || ocupado === r.rol}
                        onClick={() =>
                          void firmar(r.rol, { nombreFirmante: null, cedula: null, modo: 'Predeterminada', imagenBase64: null }).then(setError)
                        }
                      >
                        Usar mi firma
                      </button>
                    )}
                    {sol ? (
                      <button type="button" className="fm-firma-btn fm-reenviar" onClick={() => setAcceso(r.rol)}>
                        <Icono nombre="send" tam={13} /> Reenviar
                      </button>
                    ) : (
                      !prev && (
                        <button type="button" className="fm-firma-btn fm-icono" aria-label="Dar acceso" title="Dar acceso" onClick={() => setAcceso(r.rol)}>
                          <Icono nombre="send" tam={13} />
                        </button>
                      )
                    )}
                    {!sol && (
                      <button
                        type="button"
                        className="fm-firma-btn fm-aqui"
                        onClick={() => setAqui(r.rol)}
                      >
                        <Icono nombre="signature" tam={13} /> Firmar aquí
                      </button>
                    )}
                  </div>
                )
              )}
            </div>
          );
        })}
        <div className="fm-firmas-nota">
          <Icono nombre="lock" tam={14} />
          <span>Con acceso: solo ven y firman, no editan. «Firmar aquí» no necesita usuario.</span>
        </div>
      </div>
      {aqui && (
        <FirmarAqui
          rol={aqui}
          nombreRol={ROLES_FIRMA.find((r) => r.rol === aqui)?.nombre ?? aqui}
          autor={nombreCorto(datos.autor?.nombreCompleto) || 'el auditor'}
          enLinea={enLinea}
          ocupado={ocupado === aqui}
          firmar={firmar}
          alCerrar={() => setAqui(null)}
        />
      )}
      {acceso && (
        <DarAcceso
          fiscalizacionId={datos.id}
          rol={acceso}
          alCerrar={() => setAcceso(null)}
          alEnviar={agregarSolicitud}
        />
      )}
    </section>
  );
}

/** Sin red: los accesos salen del último estado guardado en esta tablet (o no se pudieron consultar). */
function AvisoSolicitudes({ estado, error }: { estado: SolicitudesRegistro | undefined; error: string | null }) {
  const texto = error
    ? `No se pudieron consultar los accesos enviados: ${error}`
    : estado?.sinConexion
      ? estado.conocido
        ? 'Sin conexión: los accesos enviados son los de la última consulta en esta tablet.'
        : 'Sin conexión: no se pudo consultar los accesos enviados.'
      : null;
  if (!texto) return null;
  return (
    <div className="fm-firmas-sinred" role="status">
      <Icono nombre="cloud-off" tam={12} />
      <span>{texto}</span>
    </div>
  );
}
