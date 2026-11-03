import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useFiscalizaciones, useMe } from '../api/hooks';
import { usePlantillas } from '../api/plantillas';
import type { UsuarioDto } from '../api/types';
import { useUsuariosAdmin } from '../api/usuarios';
import { useSesion } from '../auth/contexto';
import { config } from '../config';
import { bytes, fecha } from '../domain/format';
import { useBorradoresLocales, useEnLinea, useSincronizador } from '../offline/hooks';
import { crearRespaldo, MIN_CONTRASENA, recuperarRespaldo, resumenLocal, ultimoRespaldo, type ResumenLocal } from '../offline/respaldo';
import { Aviso, Cargando, Modal } from '../ui/comunes';
import { mensajeError } from '../ui/errores';
import { Icono, type NombreIcono } from '../ui/Icono';
import { LienzoFirma } from '../ui/LienzoFirma';
import { iniciales, nombreCorto, rolVisible } from '../ui/nav';
import { usePagina } from '../ui/pagina';
import { useTamano } from '../ui/tamano';
import './cuenta.css';

type Mensaje = { ok: boolean; texto: string } | null;

function descargar(archivo: Blob, nombre: string) {
  const url = URL.createObjectURL(archivo);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fechaHora(ms: number | null): string {
  if (!ms) return 'Nunca';
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  const h = d.getHours() % 12 || 12;
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} · ${p(h)}:${p(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

/** Lo que hay en la tablet (IndexedDB): se recalcula al sincronizar o recuperar. */
function useResumenLocal(clave: unknown): ResumenLocal | null {
  const [r, setR] = useState<ResumenLocal | null>(null);
  useEffect(() => {
    let vivo = true;
    resumenLocal()
      .then((x) => vivo && setR(x))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [clave]);
  return r;
}

function CabTarjeta({ icono, titulo, sub }: { icono: NombreIcono; titulo: string; sub: string }) {
  return (
    <div className="cu-cab">
      <span className="cu-cab-i">
        <Icono nombre={icono} tam={16} />
      </span>
      <span className="cu-cab-textos">
        <h2 className="cu-cab-t">{titulo}</h2>
        <span className="cu-cab-s">{sub}</span>
      </span>
    </div>
  );
}

/** Respaldo cifrado (.fisc): borradores, fotos y cola de esta tablet. */
function Respaldo({ correo, enfocar, resumen, alCambiar }: { correo: string; enfocar: boolean; resumen: ResumenLocal | null; alCambiar: () => void }) {
  const [clave, setClave] = useState('');
  const [ver, setVer] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<Mensaje>(null);
  const [ultimo, setUltimo] = useState(ultimoRespaldo);
  const entrada = useRef<HTMLInputElement>(null);
  const archivo = useRef<HTMLInputElement>(null);
  const valida = clave.length >= MIN_CONTRASENA;

  useEffect(() => {
    if (enfocar) entrada.current?.focus();
  }, [enfocar]);

  const crear = async () => {
    setMsg(null);
    setOcupado(true);
    try {
      const r = await crearRespaldo(clave, correo);
      descargar(r.archivo, r.nombre);
      setUltimo(ultimoRespaldo());
      setMsg({ ok: true, texto: `Respaldo creado: ${r.nombre}. Guárdelo fuera de la tablet y recuerde la contraseña.` });
    } catch (e) {
      setMsg({ ok: false, texto: mensajeError(e) });
    } finally {
      setOcupado(false);
    }
  };

  const recuperar = async (f: File | undefined) => {
    if (!f) return;
    setMsg(null);
    setOcupado(true);
    try {
      const r = await recuperarRespaldo(await f.text(), clave, correo);
      alCambiar();
      setMsg({
        ok: true,
        texto: `Se agregaron ${r.borradores} borradores y ${r.fotos} fotos${r.omitidos ? ` (${r.omitidos} ya estaban en la tablet)` : ''}.`,
      });
    } catch (e) {
      setMsg({ ok: false, texto: mensajeError(e) });
    } finally {
      setOcupado(false);
      if (archivo.current) archivo.current.value = '';
    }
  };

  return (
    <section className="tarjeta cu-tarjeta" id="respaldo" aria-label="Respaldo cifrado">
      <CabTarjeta icono="archive" titulo="Respaldo cifrado (.fisc)" sub="Borradores, fotos y cambios pendientes de sincronizar en esta tablet" />
      <div className="cu-datos">
        <div className="cu-dato">
          <span className="cu-dato-l">Último respaldo</span>
          <span className="cu-dato-v">{fechaHora(ultimo)}</span>
        </div>
        <div className="cu-dato">
          <span className="cu-dato-l">Registros incluidos</span>
          <span className="cu-dato-v">{resumen ? `${resumen.borradores} borradores · ${resumen.fotos} fotos` : '—'}</span>
        </div>
        <div className="cu-dato">
          <span className="cu-dato-l">Tamaño estimado</span>
          <span className="cu-dato-v">{resumen ? bytes(resumen.bytes) : '—'}</span>
        </div>
      </div>
      <label className="cu-campo">
        <span className="cu-etq">Contraseña del respaldo (mínimo {MIN_CONTRASENA} caracteres)</span>
        <span className="cu-caja">
          <input
            ref={entrada}
            type={ver ? 'text' : 'password'}
            autoComplete="new-password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            aria-invalid={clave.length > 0 && !valida}
          />
          <button type="button" className="cu-ojo" aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setVer(!ver)}>
            <Icono nombre={ver ? 'eye-off' : 'eye'} tam={16} />
          </button>
        </span>
      </label>
      <div className="cu-botones">
        <button type="button" className="btn btn-primario" disabled={!valida || ocupado} onClick={() => void crear()}>
          <Icono nombre="download" tam={16} />
          Crear respaldo
        </button>
        <button type="button" className="btn" disabled={!valida || ocupado} onClick={() => archivo.current?.click()}>
          <Icono nombre="upload" tam={16} />
          Recuperar respaldo
        </button>
        <input ref={archivo} type="file" accept=".fisc" hidden onChange={(e) => void recuperar(e.target.files?.[0])} />
      </div>
      {msg && (
        <Aviso tipo={msg.ok ? 'ok' : 'error'} rol="status">
          {msg.texto}
        </Aviso>
      )}
      <div className="cu-aviso">
        <Icono nombre="triangle-alert" tam={15} />
        <span>
          Recuperar solo agrega registros ausentes del mismo correo; no sobrescribe los existentes. Haga un respaldo antes de
          borrar los datos del navegador o reinstalar la app.
        </span>
      </div>
    </section>
  );
}

/** Estado de la sincronización con el servidor de EGEHID. */
function Sincronizacion({ resumen }: { resumen: ResumenLocal | null }) {
  const enLinea = useEnLinea();
  const { pendientes, sincronizar } = useSincronizador();
  const [ocupado, setOcupado] = useState(false);
  const titulo = !enLinea ? 'Sin conexión con el servidor' : pendientes > 0 ? `${pendientes} cambios por enviar` : 'Todo sincronizado';
  return (
    <section className="tarjeta cu-tarjeta cu-sync" aria-label="Sincronización">
      <CabTarjeta icono="cloud" titulo="Sincronización con el servidor" sub={`API de EGEHID · ${{ dev: 'modo desarrollo', ldap: 'usuario de dominio', auth0: 'sesión Auth0' }[config.modoAuth]}`} />
      <div className="cu-estado">
        <span className="cu-estado-i">
          <Icono nombre={enLinea ? 'cloud-check' : 'cloud-off'} tam={16} />
        </span>
        <span className="cu-estado-textos">
          <span className="cu-estado-t">{titulo}</span>
          <span className="cu-estado-s mono">{config.apiUrl.replace(/^https?:\/\//, '')}</span>
        </span>
        {enLinea && pendientes > 0 ? (
          <button
            type="button"
            className="btn cu-btn-sm"
            disabled={ocupado}
            onClick={() => {
              setOcupado(true);
              void sincronizar().finally(() => setOcupado(false));
            }}
          >
            <Icono nombre="refresh-cw" tam={14} />
            Sincronizar
          </button>
        ) : (
          <span className={`badge ${enLinea ? 'b-ok' : 'b-neutral'}`}>
            <span className="badge-punto" />
            {enLinea ? 'Conectado' : 'No conectado'}
          </span>
        )}
      </div>
      <p className="cu-nota">
        Los cambios se guardan primero en esta tablet{resumen ? ` (${resumen.borradores} borradores, ${resumen.pendientes} envíos en cola)` : ''} y se envían
        al servidor cuando vuelve la red.
      </p>
    </section>
  );
}

function Fila({ titulo, sub, onClick, children }: { titulo: string; sub: ReactNode; onClick?: () => void; children?: ReactNode }) {
  const contenido = (
    <>
      <span className="cu-fila-textos">
        <span className="cu-fila-t">{titulo}</span>
        <span className="cu-fila-s">{sub}</span>
      </span>
      {onClick && <Icono nombre="chevron-right" tam={16} className="cu-ir" />}
      {children}
    </>
  );
  return onClick ? (
    <button type="button" className="cu-fila" onClick={onClick}>
      {contenido}
    </button>
  ) : (
    <div className="cu-fila">{contenido}</div>
  );
}

/** Perfil (nombre, cargo) y firma predeterminada. */
function PerfilModal({ me, alCerrar }: { me: UsuarioDto; alCerrar: () => void }) {
  const sesion = useSesion();
  const qc = useQueryClient();
  const enLinea = useEnLinea();
  const [nombre, setNombre] = useState(me.nombreCompleto ?? '');
  const [cargo, setCargo] = useState(me.cargo ?? '');
  const [nuevaFirma, setNuevaFirma] = useState<string | null>(null);
  const [cambiandoFirma, setCambiandoFirma] = useState(!me.tieneFirma);
  const [msg, setMsg] = useState<Mensaje>(null);
  const [ocupado, setOcupado] = useState(false);
  const firma = useQuery({
    queryKey: ['mi-firma', me.id],
    enabled: me.tieneFirma,
    queryFn: async () => {
      try {
        return (await api.get<{ imagenBase64: string }>('/me/firma')).imagenBase64;
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },
  });

  const guardar = async () => {
    setMsg(null);
    setOcupado(true);
    try {
      const u = await api.put<UsuarioDto>('/me/perfil', { nombreCompleto: nombre.trim(), cargo: cargo.trim() || null });
      let actualizado = u;
      if (nuevaFirma) {
        await api.put<void>('/me/firma', { imagenBase64: nuevaFirma });
        qc.setQueryData(['mi-firma', me.id], nuevaFirma);
        actualizado = { ...u, tieneFirma: true };
      }
      qc.setQueryData(['me', sesion.correo], actualizado);
      alCerrar();
    } catch (e) {
      setMsg({ ok: false, texto: mensajeError(e) });
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Modal
      titulo="Perfil y firma"
      sub="Su nombre y firma aparecen en las fiscalizaciones que firma"
      icono="user-round"
      alCerrar={alCerrar}
      pie={
        <>
          <button type="button" className="btn" onClick={alCerrar}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primario" disabled={!enLinea || !nombre.trim() || ocupado} onClick={() => void guardar()}>
            Guardar
          </button>
        </>
      }
    >
      <label className="cu-campo">
        <span className="cu-etq">Nombre completo</span>
        <span className="cu-caja">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" />
        </span>
      </label>
      <label className="cu-campo">
        <span className="cu-etq">Cargo</span>
        <span className="cu-caja">
          <input value={cargo} onChange={(e) => setCargo(e.target.value)} autoComplete="organization-title" />
        </span>
      </label>
      <div className="cu-campo">
        <span className="cu-etq">Firma predeterminada</span>
        {cambiandoFirma ? (
          <div className="cu-lienzo">
            <LienzoFirma alCambiar={setNuevaFirma} etiqueta="Dibuje su firma" />
          </div>
        ) : (
          <div className="cu-firma">
            {firma.data ? <img src={`data:image/png;base64,${firma.data}`} alt="Su firma predeterminada" /> : <span className="cu-nota">Cargando firma…</span>}
            <button type="button" className="btn cu-btn-sm" onClick={() => setCambiandoFirma(true)}>
              <Icono nombre="pen-line" tam={14} />
              Cambiar firma
            </button>
          </div>
        )}
      </div>
      {!enLinea && <Aviso tipo="warn">Para guardar el perfil o la firma se necesita conexión.</Aviso>}
      {msg && (
        <Aviso tipo="error" rol="alert">
          {msg.texto}
        </Aviso>
      )}
    </Modal>
  );
}

function Papelera() {
  const q = useFiscalizaciones({ enPapelera: true, pagina: 1, tamano: 3 });
  const qc = useQueryClient();
  const [msg, setMsg] = useState<Mensaje>(null);
  const restaurar = async (id: string, numero: string) => {
    setMsg(null);
    try {
      await api.post(`/fiscalizaciones/${id}/restaurar`);
      setMsg({ ok: true, texto: `Se restauró ${numero}.` });
      await qc.invalidateQueries({ queryKey: ['fiscalizaciones'] });
    } catch (e) {
      setMsg({ ok: false, texto: mensajeError(e) });
    }
  };
  const items = q.data?.items ?? [];
  return (
    <section className="tarjeta cu-tarjeta cu-papelera" aria-label="Papelera">
      <CabTarjeta icono="trash-2" titulo="Papelera" sub="Solo el administrador recupera los registros borrados" />
      {q.isPending && <span className="cu-nota">Cargando…</span>}
      {q.isError && <span className="cu-nota">No se pudo leer la papelera (se necesita conexión).</span>}
      {q.data && items.length === 0 && <span className="cu-nota">La papelera está vacía.</span>}
      {items.map((f) => (
        <div key={f.id} className="cu-borrado">
          <span className="cu-fila-textos">
            <span className="cu-borrado-t">
              {f.numero} · {f.locacion ?? '—'}
            </span>
            <span className="cu-fila-s">
              {fecha(f.fecha)} · {f.autor}
            </span>
          </span>
          <button type="button" className="btn cu-btn-sm" onClick={() => void restaurar(f.id, f.numero)}>
            <Icono nombre="rotate-ccw" tam={16} />
            Restaurar
          </button>
        </div>
      ))}
      {q.data && q.data.total > items.length && (
        <Link to="/papelera" className="enlace">
          Ver los {q.data.total} registros →
        </Link>
      )}
      {msg && (
        <Aviso tipo={msg.ok ? 'ok' : 'error'} rol="status">
          {msg.texto}
        </Aviso>
      )}
    </section>
  );
}

function ItemMovil({ icono, titulo, sub, to, onClick, peligro }: { icono: NombreIcono; titulo: string; sub?: string; to?: string; onClick?: () => void; peligro?: boolean }) {
  const contenido = (
    <>
      <span className={`cu-m-i${peligro ? ' peligro' : ''}`}>
        <Icono nombre={icono} tam={16} />
      </span>
      <span className="cu-fila-textos">
        <span className={`cu-m-t${peligro ? ' peligro' : ''}`}>{titulo}</span>
        {sub && <span className="cu-fila-s">{sub}</span>}
      </span>
      {!peligro && <Icono nombre="chevron-right" tam={16} className="cu-ir" />}
    </>
  );
  return to ? (
    <Link to={to} className="cu-m-item">
      {contenido}
    </Link>
  ) : (
    <button type="button" className="cu-m-item" onClick={onClick}>
      {contenido}
    </button>
  );
}

/** Solo se monta para el administrador: la papelera es exclusiva de ese rol. */
function ItemPapelera() {
  const q = useFiscalizaciones({ enPapelera: true, pagina: 1, tamano: 1 });
  return <ItemMovil icono="trash-2" titulo="Papelera" sub={q.data ? `${q.data.total} registros` : 'Registros borrados'} to="/papelera" />;
}

/** Solo para el administrador (gestiona las plantillas). */
function ItemPlantillas() {
  const q = usePlantillas();
  return <ItemMovil icono="layout-template" titulo="Plantillas" sub={q.data ? `${q.data.length} formularios` : 'Formularios'} to="/plantillas" />;
}

/** Solo para el administrador: gestión de usuarios (no está en el diseño). */
function ItemUsuarios() {
  const q = useUsuariosAdmin({ estado: 'activos', pagina: 1, tamano: 1 });
  const activos = q.data?.conteos.activos;
  return <ItemMovil icono="users" titulo="Usuarios" sub={activos != null ? `${activos} activos · roles y acceso` : 'Roles y acceso'} to="/usuarios" />;
}

/** Tablet V no tiene menú lateral: el administrador llega a Plantillas y Usuarios desde Mi cuenta. */
function AdministracionTabletV() {
  return (
    <section className="tarjeta cu-tarjeta" aria-label="Administración">
      <CabTarjeta icono="shield-check" titulo="Administración" sub="Solo el administrador ve estas opciones" />
      <div className="cu-m-lista">
        <ItemPlantillas />
        <ItemUsuarios />
      </div>
    </section>
  );
}

function CuentaMovil({ me, resumen, editar, salir }: { me: UsuarioDto; resumen: ResumenLocal | null; editar: () => void; salir: () => void }) {
  const enLinea = useEnLinea();
  const admin = me.rol === 'Administrador';
  const ultimo = ultimoRespaldo();
  return (
    <div className="cu-movil">
      <button type="button" className="cu-m-perfil" onClick={editar} aria-label="Editar perfil y firma">
        <span className="cu-avatar cu-m-avatar">{iniciales(me.nombreCompleto, me.correo)}</span>
        <span className="cu-fila-textos">
          <span className="cu-m-nombre">{nombreCorto(me.nombreCompleto, me.correo)}</span>
          <span className="cu-m-correo">{me.correo}</span>
          <span className="badge b-info">
            <span className="badge-punto" />
            {rolVisible(me.rol, me.cargo)}
          </span>
        </span>
      </button>
      <h2 className="cu-m-grupo">DATOS</h2>
      <div className="cu-m-lista">
        <ItemMovil icono="archive" titulo="Respaldo cifrado" sub={`Último: ${ultimo ? fechaHora(ultimo).slice(0, 10) : 'nunca'}${resumen ? ` · ${bytes(resumen.bytes)}` : ''}`} to="/cuenta/respaldo" />
        <ItemMovil icono="upload" titulo="Recuperar respaldo" sub="Agrega registros ausentes" to="/cuenta/respaldo" />
        <ItemMovil
          icono={enLinea ? 'cloud-check' : 'cloud-off'}
          titulo="Sincronización con el servidor"
          sub={enLinea ? `${resumen?.pendientes ?? 0} envíos en cola` : 'Sin conexión'}
          to="/cuenta/respaldo"
        />
      </div>
      {admin && (
        <>
          <h2 className="cu-m-grupo">ADMINISTRACIÓN</h2>
          <div className="cu-m-lista">
            <ItemPlantillas />
            <ItemPapelera />
            <ItemUsuarios />
          </div>
        </>
      )}
      <h2 className="cu-m-grupo">SESIÓN</h2>
      <div className="cu-m-lista">
        <ItemMovil icono="log-out" titulo="Cerrar sesión" onClick={salir} peligro />
      </div>
    </div>
  );
}

export function Cuenta({ enfoque }: { enfoque?: 'respaldo' } = {}) {
  const { data: me } = useMe();
  const sesion = useSesion();
  const tamano = useTamano();
  const enLinea = useEnLinea();
  const { pendientes } = useSincronizador();
  const locales = useBorradoresLocales();
  const [editando, setEditando] = useState(false);
  const [version, setVersion] = useState(0);
  const resumen = useResumenLocal(`${version}-${pendientes}-${locales.length}`);
  const movil = tamano === 'movil';
  const modo = { dev: 'Modo desarrollo', ldap: 'Usuario de dominio', auth0: 'Sesión con Auth0' }[config.modoAuth];
  usePagina({
    migas: enfoque === 'respaldo' ? 'Mi cuenta › Respaldo cifrado' : 'Mi cuenta',
    tituloMovil: enfoque === 'respaldo' ? 'Respaldo cifrado' : 'Mi cuenta',
    subMovil: enfoque === 'respaldo' ? 'Datos guardados en esta tablet' : modo,
  });

  if (!me) return <Cargando />;
  const salir = () => sesion.salir();
  const modal = editando && <PerfilModal me={me} alCerrar={() => setEditando(false)} />;

  if (movil && enfoque !== 'respaldo')
    return (
      <>
        <CuentaMovil me={me} resumen={resumen} editar={() => setEditando(true)} salir={salir} />
        {modal}
      </>
    );

  const respaldo = <Respaldo correo={me.correo} enfocar={enfoque === 'respaldo'} resumen={resumen} alCambiar={() => setVersion((v) => v + 1)} />;
  if (movil)
    return (
      <div className="cu-movil">
        {respaldo}
        <Sincronizacion resumen={resumen} />
      </div>
    );

  return (
    <div className="cu">
      <div className="cu-perfil">
        <span className="cu-avatar">{iniciales(me.nombreCompleto, me.correo)}</span>
        <span className="cu-perfil-textos">
          <h1 className="cu-nombre">{nombreCorto(me.nombreCompleto, me.correo)}</h1>
          <span className="cu-correo">
            {me.correo} · {me.cargo || modo}
          </span>
        </span>
        <span className="cu-rol">
          <Icono nombre="shield-check" tam={14} />
          {rolVisible(me.rol, me.cargo)}
        </span>
      </div>
      <div className="cu-rejilla">
        <div className="cu-col">
          {respaldo}
          <Sincronizacion resumen={resumen} />
        </div>
        <div className="cu-col cu-col-2">
          <section className="tarjeta cu-tarjeta" aria-label="Seguridad de la sesión">
            <CabTarjeta icono="key-round" titulo="Seguridad de la sesión" sub="La sesión sigue abierta al cerrar la app" />
            <div className="cu-filas">
              <Fila titulo="Perfil y firma" sub={`${me.cargo || 'Sin cargo'} · ${me.tieneFirma ? 'firma registrada' : 'sin firma predeterminada'}`} onClick={() => setEditando(true)} />
              <Fila
                titulo="Sesión en esta tablet"
                sub={
                  { dev: 'Modo desarrollo · encabezado X-Dev-User', ldap: 'Dominio EGEHID · se mantiene sin conexión', auth0: 'Auth0 · se mantiene sin conexión' }[
                    config.modoAuth
                  ]
                }
              />
              <Fila
                titulo="Datos en esta tablet"
                sub={`${locales.length} borradores · ${pendientes} por sincronizar · ${enLinea ? 'en línea' : 'sin conexión'}`}
              />
            </div>
            <button type="button" className="btn btn-peligro btn-ancho" onClick={salir}>
              <Icono nombre="log-out" tam={16} />
              Cerrar sesión
            </button>
            {me.tieneFirma === false && (
              <span className="cu-nota">
                Registre su firma predeterminada para firmar con un toque. <button type="button" className="enlace" onClick={() => setEditando(true)}>Registrar ahora</button>
              </span>
            )}
          </section>
          {me.rol === 'Administrador' && <Papelera />}
          {me.rol === 'Administrador' && tamano === 'tablet-v' && <AdministracionTabletV />}
        </div>
      </div>
      {modal}
    </div>
  );
}
