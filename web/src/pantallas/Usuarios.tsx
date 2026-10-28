import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import type { Rol } from '../api/types';
import { useAccionesUsuarios, useUsuariosAdmin, type EstadoUsuarios, type FiltroUsuarios, type UsuarioAdminDto } from '../api/usuarios';
import { useEnLinea } from '../offline/hooks';
import { Aviso, Cargando, ErrorCaja, Modal, Paginacion } from '../ui/comunes';
import { mensajeError } from '../ui/errores';
import { Icono } from '../ui/Icono';
import { iniciales, rolVisible } from '../ui/nav';
import { usePagina } from '../ui/pagina';
import { useTamano } from '../ui/tamano';
import { Selector } from './Historial';
import {
  accionesUsuario,
  confirmacion,
  correoValido,
  estadoUsuario,
  mensajeHecho,
  nombreUsuario,
  ROLES,
  ultimoAcceso,
  type AccionUsuario,
} from './usuariosLogica';
import './historial.css';
import './usuarios.css';

/**
 * Usuarios (Administración, solo Administrador). El diseño no tiene esta pantalla: sigue el Historial (pestañas con
 * conteo, búsqueda, selector, tabla con menú «⋮» y paginación) y, en el móvil, sus tarjetas y chips.
 */
const PESTANAS: { clave: EstadoUsuarios; texto: string }[] = [
  { clave: 'todos', texto: 'Todos' },
  { clave: 'activos', texto: 'Activos' },
  { clave: 'inactivos', texto: 'Desactivados' },
];

const TAMANO = 12;
const TAMANO_MOVIL = 20;

type Mensaje = { ok: boolean; texto: string } | null;
type Poner = (cambios: Record<string, string | null>, reiniciarPagina?: boolean) => void;

function useFiltro() {
  const [params, setParams] = useSearchParams();
  const estado = (params.get('estado') as EstadoUsuarios | null) ?? 'todos';
  const filtro: FiltroUsuarios = {
    estado,
    texto: params.get('texto') ?? undefined,
    rol: (params.get('rol') as Rol | null) ?? undefined,
    pagina: Number(params.get('pagina') ?? '1') || 1,
  };
  const poner: Poner = (cambios, reiniciarPagina = true) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(cambios)) {
      if (v == null || v === '') p.delete(k);
      else p.set(k, v);
    }
    if (reiniciarPagina) p.delete('pagina');
    setParams(p, { replace: true });
  };
  return { filtro, poner };
}

/** Aplica una acción con su confirmación; devuelve el mensaje para la pantalla. */
function useAplicar(alTerminar: (m: Mensaje) => void) {
  const acciones = useAccionesUsuarios();
  return async (u: UsuarioAdminDto, a: AccionUsuario) => {
    const pregunta = confirmacion(u, a);
    if (pregunta && !window.confirm(pregunta)) return;
    try {
      if (a.tipo === 'rol') await acciones.cambiarRol(u.id, a.rol);
      else if (a.tipo === 'activar') await acciones.activar(u.id);
      else await acciones.desactivar(u.id);
      alTerminar({ ok: true, texto: mensajeHecho(u, a) });
    } catch (e) {
      alTerminar({ ok: false, texto: mensajeError(e) });
    }
  };
}

function BadgeRol({ u }: { u: Pick<UsuarioAdminDto, 'rol' | 'cargo'> }) {
  return <span className={`badge usr-rol usr-rol-${u.rol}`}>{rolVisible(u.rol, u.cargo)}</span>;
}

function BadgeEstadoUsuario({ u }: { u: UsuarioAdminDto }) {
  const e = estadoUsuario(u);
  return (
    <span className={`badge ${e.clase}`}>
      <span className="badge-punto" />
      {e.texto}
    </span>
  );
}

/** Menú «⋮» de cada usuario: cambiar el rol y activar / desactivar. */
function MenuUsuario({ u, aplicar }: { u: UsuarioAdminDto; aplicar: (u: UsuarioAdminDto, a: AccionUsuario) => Promise<void> }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const enLinea = useEnLinea();
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setAbierto(false);
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);
  return (
    <div className="hist-menu-cont" ref={ref}>
      <button
        type="button"
        className="hist-menu-btn"
        aria-label={`Acciones de ${nombreUsuario(u)}`}
        aria-expanded={abierto}
        onClick={() => setAbierto(!abierto)}
      >
        <Icono nombre="ellipsis-vertical" tam={16} />
      </button>
      {abierto && (
        <div className="hist-menu usr-menu" role="menu">
          {accionesUsuario(u).map((o) => (
            <button
              key={o.accion.tipo === 'rol' ? o.accion.rol : o.accion.tipo}
              type="button"
              role="menuitem"
              className={o.peligro ? 'peligro' : undefined}
              disabled={!!o.bloqueo || !enLinea}
              title={o.bloqueo ?? (enLinea ? undefined : 'Se necesita conexión')}
              onClick={() => {
                setAbierto(false);
                void aplicar(u, o.accion);
              }}
            >
              {o.texto}
              {o.bloqueo && <span className="usr-menu-nota">{o.bloqueo}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Busqueda({ filtro, poner, movil = false, extra }: { filtro: FiltroUsuarios; poner: Poner; movil?: boolean; extra?: ReactNode }) {
  const [texto, setTexto] = useState(filtro.texto ?? '');
  return (
    <form
      className={movil ? 'hist-m-buscar' : 'hist-caja hist-buscar'}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        poner({ texto });
      }}
    >
      <Icono nombre="search" tam={movil ? 16 : 14} />
      <input
        aria-label="Buscar usuarios"
        placeholder={movil ? 'Nombre, correo o cargo' : 'Buscar nombre, correo o cargo…'}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => texto !== (filtro.texto ?? '') && poner({ texto })}
      />
      {extra}
    </form>
  );
}

function SelectorRol({ filtro, poner }: { filtro: FiltroUsuarios; poner: Poner }) {
  return (
    <Selector
      icono="shield-check"
      etiqueta="Rol"
      valor={filtro.rol ?? ''}
      opciones={[{ valor: '', texto: 'Todos los roles' }, ...ROLES.map((r) => ({ valor: r.rol, texto: r.texto }))]}
      alCambiar={(v) => poner({ rol: v })}
    />
  );
}

function Avatar({ u }: { u: UsuarioAdminDto }) {
  return <span className={`usr-avatar${u.activo ? '' : ' inactivo'}`}>{iniciales(u.nombreCompleto, u.correo)}</span>;
}

function CeldaUsuario({ u }: { u: UsuarioAdminDto }) {
  return (
    <span className="c-usuario" role="cell">
      <Avatar u={u} />
      <span className="usr-textos">
        <span className="usr-nombre">
          {nombreUsuario(u)}
          {u.esUsted && <span className="usr-usted">Usted</span>}
        </span>
        <span className="usr-correo">{u.correo}</span>
      </span>
    </span>
  );
}

function Tabla({ filas, compacta, aplicar }: { filas: UsuarioAdminDto[]; compacta: boolean; aplicar: (u: UsuarioAdminDto, a: AccionUsuario) => Promise<void> }) {
  if (!filas.length) return <div className="vacio">No hay usuarios con estos filtros.</div>;
  return (
    <div className={`hist-tabla usr-tabla${compacta ? ' compacta' : ''}`} role="table" aria-label="Usuarios">
      <div className="hist-cab" role="row">
        <span className="c-usuario" role="columnheader">
          Usuario
        </span>
        {!compacta && (
          <span className="c-cargo" role="columnheader">
            Cargo
          </span>
        )}
        <span className="c-rol" role="columnheader">
          Rol
        </span>
        <span className="c-acceso" role="columnheader">
          Último acceso
        </span>
        {!compacta && (
          <span className="c-reg" role="columnheader">
            Registros
          </span>
        )}
        <span className="c-estado" role="columnheader">
          Estado
        </span>
        <span className="c-menu" role="columnheader" aria-label="Acciones" />
      </div>
      {filas.map((u) => (
        <div key={u.id} className={`hist-fila usr-fila${u.activo ? '' : ' inactivo'}`} role="row">
          <CeldaUsuario u={u} />
          {!compacta && (
            <span className="c-cargo" role="cell">
              {u.cargo || '—'}
            </span>
          )}
          <span className="c-rol" role="cell">
            <BadgeRol u={u} />
          </span>
          <span className="c-acceso" role="cell">
            {ultimoAcceso(u.ultimoAcceso)}
          </span>
          {!compacta && (
            <span className="c-reg mono" role="cell">
              {u.registros}
            </span>
          )}
          <span className="c-estado" role="cell">
            <BadgeEstadoUsuario u={u} />
          </span>
          <span className="c-menu" role="cell">
            <MenuUsuario u={u} aplicar={aplicar} />
          </span>
        </div>
      ))}
    </div>
  );
}

/** «Registrar usuario»: correo + rol (+ nombre opcional). Con ese correo, el primer ingreso por Auth0 ya trae el rol. */
function RegistrarModal({ alCerrar, alRegistrar }: { alCerrar: () => void; alRegistrar: (u: UsuarioAdminDto) => void }) {
  const acciones = useAccionesUsuarios();
  const enLinea = useEnLinea();
  const [correo, setCorreo] = useState('');
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<Rol>('Auditor');
  const [errores, setErrores] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const correoMal = correo.trim() !== '' && !correoValido(correo);

  const enviar = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!correoValido(correo)) {
      setErrores({ correo: ['Escriba un correo válido (nombre@dominio).'] });
      return;
    }
    setOcupado(true);
    setError(null);
    setErrores({});
    try {
      alRegistrar(await acciones.registrar({ correo: correo.trim(), rol, nombreCompleto: nombre.trim() || null }));
    } catch (ex) {
      if (ex instanceof ApiError && ex.status === 400 && Object.keys(ex.errores).length) setErrores(ex.errores);
      else setError(mensajeError(ex));
    } finally {
      setOcupado(false);
    }
  };

  const errorCorreo = errores.correo?.[0] ?? (correoMal ? 'Escriba un correo válido (nombre@dominio).' : null);
  return (
    <Modal
      titulo="Registrar usuario"
      sub="Al entrar por primera vez con este correo tendrá el rol elegido"
      icono="user-plus"
      alCerrar={alCerrar}
      ancho={520}
      pie={
        <>
          <button type="button" className="btn" onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" form="usr-registrar" className="btn btn-primario" disabled={!enLinea || ocupado || !correo.trim()}>
            <Icono nombre="user-plus" tam={16} />
            Registrar
          </button>
        </>
      }
    >
      <form id="usr-registrar" className="usr-form" onSubmit={(e) => void enviar(e)} noValidate>
        <label className="usr-campo">
          <span className="usr-etq">Correo</span>
          <span className={`usr-caja${errorCorreo ? ' invalida' : ''}`}>
            <Icono nombre="mail" tam={15} />
            <input
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="nombre@hidroelectrica.gov.do"
              autoComplete="off"
              aria-invalid={!!errorCorreo}
              autoFocus
            />
          </span>
          {errorCorreo && <span className="usr-error">{errorCorreo}</span>}
        </label>
        <label className="usr-campo">
          <span className="usr-etq">
            Nombre completo <span className="usr-opcional">(opcional)</span>
          </span>
          <span className="usr-caja">
            <Icono nombre="user-round" tam={15} />
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="off" />
          </span>
        </label>
        <fieldset className="usr-campo usr-roles">
          <legend className="usr-etq">Rol</legend>
          {ROLES.map((r) => (
            <label key={r.rol} className={`usr-opcion${rol === r.rol ? ' activa' : ''}`}>
              <input type="radio" name="rol" value={r.rol} checked={rol === r.rol} onChange={() => setRol(r.rol)} />
              <span className="usr-opcion-textos">
                <span className="usr-opcion-t">{r.texto}</span>
                <span className="usr-opcion-s">{r.descripcion}</span>
              </span>
            </label>
          ))}
          {errores.rol && <span className="usr-error">{errores.rol[0]}</span>}
        </fieldset>
        <Aviso tipo="info" icono="info">
          El cargo y la firma los completa la persona en su primer ingreso.
        </Aviso>
        {!enLinea && <Aviso tipo="warn">Para registrar usuarios se necesita conexión.</Aviso>}
        {error && (
          <Aviso tipo="error" rol="alert">
            {error}
          </Aviso>
        )}
      </form>
    </Modal>
  );
}

function Encabezado({ total, registrar }: { total: number | undefined; registrar: () => void }) {
  return (
    <div className="pag-encabezado hist-encabezado">
      <div className="pag-titulos">
        <h1 className="pag-titulo">Usuarios</h1>
        <div className="pag-sub">{total ?? '…'} usuarios · el rol define lo que cada uno puede hacer; los desactivados no pueden entrar</div>
      </div>
      <div className="pag-acciones">
        <button type="button" className="btn btn-primario" onClick={registrar}>
          <Icono nombre="user-plus" tam={16} />
          Registrar usuario
        </button>
      </div>
    </div>
  );
}

function AvisoMensaje({ msg }: { msg: Mensaje }) {
  if (!msg) return null;
  return (
    <Aviso tipo={msg.ok ? 'ok' : 'error'} rol={msg.ok ? 'status' : 'alert'} icono={msg.ok ? 'circle-check' : 'circle-alert'}>
      {msg.texto}
    </Aviso>
  );
}

function UsuariosMovil({ registrar, msg, aplicar }: { registrar: () => void; msg: Mensaje; aplicar: (u: UsuarioAdminDto, a: AccionUsuario) => Promise<void> }) {
  const { filtro, poner } = useFiltro();
  const [tamano, setTamano] = useState(TAMANO_MOVIL);
  const [filtros, setFiltros] = useState(false);
  const q = useUsuariosAdmin({ ...filtro, pagina: 1, tamano });
  const conteos = q.data?.conteos;
  usePagina({ tituloMovil: 'Usuarios', subMovil: conteos?.todos != null ? `${conteos.todos} usuarios · Administración` : 'Administración' });
  return (
    <div className="hist-m usr-m">
      <Busqueda
        filtro={filtro}
        poner={poner}
        movil
        extra={
          <button type="button" className="hist-m-filtros" aria-label="Filtros" aria-expanded={filtros} onClick={() => setFiltros(!filtros)}>
            <Icono nombre="sliders-horizontal" tam={16} />
          </button>
        }
      />
      {filtros && (
        <div className="hist-m-panel">
          <SelectorRol filtro={filtro} poner={poner} />
        </div>
      )}
      <div className="hist-m-chips" role="tablist" aria-label="Estados">
        {PESTANAS.map((p) => (
          <button
            key={p.clave}
            type="button"
            role="tab"
            aria-selected={filtro.estado === p.clave}
            className={`hist-chip${filtro.estado === p.clave ? ' activo' : ''}`}
            onClick={() => poner({ estado: p.clave === 'todos' ? null : p.clave })}
          >
            {p.texto}
            {conteos?.[p.clave] != null ? ` ${conteos[p.clave]}` : ''}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-primario btn-ancho" onClick={registrar}>
        <Icono nombre="user-plus" tam={16} />
        Registrar usuario
      </button>
      <AvisoMensaje msg={msg} />
      {q.isPending && <Cargando />}
      {q.isError && <ErrorCaja error={q.error} />}
      {q.data && !q.data.items.length && <div className="vacio">No hay usuarios con estos filtros.</div>}
      {q.data?.items.map((u) => (
        <article key={u.id} className={`hist-tarjeta usr-tarjeta${u.activo ? '' : ' inactivo'}`} aria-label={nombreUsuario(u)}>
          <span className="usr-t-fila">
            <Avatar u={u} />
            <span className="usr-textos">
              <span className="usr-nombre">
                {nombreUsuario(u)}
                {u.esUsted && <span className="usr-usted">Usted</span>}
              </span>
              <span className="usr-correo">{u.correo}</span>
            </span>
            <MenuUsuario u={u} aplicar={aplicar} />
          </span>
          <span className="usr-t-chips">
            <BadgeRol u={u} />
            <BadgeEstadoUsuario u={u} />
          </span>
          <span className="hist-t-nums">
            <span className="hist-t-n">
              <span className="hist-t-l">Cargo</span>
              <span className="hist-t-v usr-t-cargo">{u.cargo || '—'}</span>
            </span>
            <span className="hist-t-n">
              <span className="hist-t-l">Último acceso</span>
              <span className="hist-t-v">{ultimoAcceso(u.ultimoAcceso)}</span>
            </span>
            <span className="hist-t-n usr-t-reg">
              <span className="hist-t-l">Registros</span>
              <span className="hist-t-v mono">{u.registros}</span>
            </span>
          </span>
        </article>
      ))}
      {q.data && q.data.total > q.data.items.length && (
        <button type="button" className="btn btn-ancho" onClick={() => setTamano(tamano + TAMANO_MOVIL)}>
          Ver más usuarios
        </button>
      )}
    </div>
  );
}

function UsuariosTabla({ compacta, registrar, msg, aplicar }: { compacta: boolean; registrar: () => void; msg: Mensaje; aplicar: (u: UsuarioAdminDto, a: AccionUsuario) => Promise<void> }) {
  const { filtro, poner } = useFiltro();
  const q = useUsuariosAdmin({ ...filtro, tamano: TAMANO });
  const enLinea = useEnLinea();
  usePagina({ migas: 'Administración › Usuarios' });
  return (
    <div className="hist usr">
      <Encabezado total={q.data?.conteos?.todos} registrar={registrar} />
      {!enLinea && <Aviso tipo="warn" icono="wifi-off">Sin conexión: la gestión de usuarios necesita red.</Aviso>}
      <AvisoMensaje msg={msg} />
      <section className="tarjeta hist-tarjeta-tabla">
        <div className="hist-pestanas" role="tablist" aria-label="Estados">
          {PESTANAS.map((p) => (
            <button
              key={p.clave}
              type="button"
              role="tab"
              aria-selected={filtro.estado === p.clave}
              className={`hist-pestana${filtro.estado === p.clave ? ' activa' : ''}`}
              onClick={() => poner({ estado: p.clave === 'todos' ? null : p.clave })}
            >
              {p.texto}
              <span className="hist-conteo">{q.data?.conteos?.[p.clave] ?? '·'}</span>
            </button>
          ))}
        </div>
        <div className="hist-filtros">
          <Busqueda filtro={filtro} poner={poner} />
          <SelectorRol filtro={filtro} poner={poner} />
        </div>
        {q.isPending && <Cargando />}
        {q.isError && (
          <div className="hist-error">
            <ErrorCaja error={q.error} />
          </div>
        )}
        {q.data && (
          <>
            <Tabla filas={q.data.items} compacta={compacta} aplicar={aplicar} />
            <div className="hist-esp" />
            <Paginacion
              pagina={q.data.pagina}
              tamano={q.data.tamano}
              total={q.data.total}
              mostrados={q.data.items.length}
              nota={q.data.conteos.pendientes ? `${q.data.conteos.pendientes} sin primer ingreso` : undefined}
              alCambiar={(p) => poner({ pagina: String(p) }, false)}
            />
          </>
        )}
      </section>
    </div>
  );
}

export function Usuarios() {
  const t = useTamano();
  const [registrando, setRegistrando] = useState(false);
  const [msg, setMsg] = useState<Mensaje>(null);
  const aplicar = useAplicar(setMsg);
  const registrar = () => {
    setMsg(null);
    setRegistrando(true);
  };
  const modal = registrando && (
    <RegistrarModal
      alCerrar={() => setRegistrando(false)}
      alRegistrar={(u) => {
        setRegistrando(false);
        setMsg({ ok: true, texto: `Se registró ${u.correo} como ${u.rol}. Tendrá ese rol cuando entre por primera vez.` });
      }}
    />
  );
  return (
    <>
      {t === 'movil' ? (
        <UsuariosMovil registrar={registrar} msg={msg} aplicar={aplicar} />
      ) : (
        <UsuariosTabla compacta={t === 'tablet-v'} registrar={registrar} msg={msg} aplicar={aplicar} />
      )}
      {modal}
    </>
  );
}
