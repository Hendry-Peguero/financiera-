import { useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMe, useSolicitudesMias } from '../api/hooks';
import { useSesion } from '../auth/contexto';
import { AvisoActualizacion } from '../app/AvisosApp';
import { useEnLinea, useSincronizador } from '../offline/hooks';
import { Icono } from './Icono';
import { iniciales, itemsNav, nombreCorto, rolVisible, type ItemNav, type SeccionNav } from './nav';
import { ProveedorPagina, useMetaPagina } from './pagina';
import { esCompacto, useTamano } from './tamano';
import './shell.css';

const TITULOS: [RegExp, string][] = [
  [/^\/$/, 'Inicio'],
  [/^\/fiscalizaciones\/nueva/, 'Nueva fiscalización'],
  [/^\/fiscalizaciones\/[^/]+\/[^/]+/, 'Nueva fiscalización'],
  [/^\/fiscalizaciones\/[^/]+$/, 'Historial'],
  [/^\/historial/, 'Historial'],
  [/^\/estadisticas/, 'Estadísticas'],
  [/^\/plantillas/, 'Administración › Plantillas'],
  [/^\/versiones/, 'Administración › Versiones y cambios'],
  [/^\/papelera/, 'Administración › Papelera'],
  [/^\/usuarios/, 'Administración › Usuarios'],
  [/^\/bitacora/, 'Administración › Bitácora'],
  [/^\/cuenta\/respaldo/, 'Respaldo cifrado'],
  [/^\/cuenta/, 'Mi cuenta'],
  [/^\/firmas/, 'Firmas solicitadas'],
];

export function tituloRuta(ruta: string): string {
  return TITULOS.find(([re]) => re.test(ruta))?.[1] ?? 'Inicio';
}

/** Firmas que me pidieron y siguen pendientes (campana de la barra superior). */
function usePendientesFirma(habilitado: boolean) {
  const q = useSolicitudesMias(habilitado);
  return (q.data ?? []).filter((s) => s.estado === 'Pendiente');
}

export function Campana({ claro = false, tam = 18 }: { claro?: boolean; tam?: number }) {
  const { data: me } = useMe();
  const pendientes = usePendientesFirma(!!me);
  const destino = pendientes.length === 1 ? `/firmas/solicitudes/${pendientes[0].id}` : '/firmas/solicitudes';
  return (
    <Link
      to={destino}
      className={`campana${claro ? ' campana-clara' : ''}`}
      aria-label={pendientes.length ? `Firmas solicitadas (${pendientes.length} pendientes)` : 'Firmas solicitadas'}
      data-track="Campana firmas solicitadas"
    >
      <Icono nombre="bell" tam={tam} />
      {pendientes.length > 0 && <span className="campana-cuenta">{pendientes.length > 9 ? '9+' : pendientes.length}</span>}
    </Link>
  );
}

/** «Sin conexión» / «Sincronizando N» / «En línea» con el estilo del chip del diseño. */
export function IndicadorRed() {
  const enLinea = useEnLinea();
  const { pendientes } = useSincronizador();
  if (!enLinea)
    return (
      <span className="chip-red chip-off" role="status">
        <Icono nombre="wifi-off" tam={13} /> Sin conexión
      </span>
    );
  if (pendientes > 0)
    return (
      <span className="chip-red chip-sync" role="status">
        <Icono nombre="refresh-cw" tam={13} /> Sincronizando {pendientes}
      </span>
    );
  return (
    <span className="chip-red chip-on" role="status">
      <Icono nombre="wifi" tam={13} /> En línea
    </span>
  );
}

/** Item activo del menú: el que indique la pantalla (navActiva) o, si no indica ninguno, el de la ruta. */
function useActiva() {
  const { navActiva } = useMetaPagina();
  return (ruta: string, isActive: boolean) => (navActiva ? navActiva === ruta : isActive);
}

function Sidebar({ items }: { items: ItemNav[] }) {
  const activa = useActiva();
  const { data: me } = useMe();
  const sesion = useSesion();
  const enLinea = useEnLinea();
  const { pendientes } = useSincronizador();
  const secciones: SeccionNav[] = ['PRINCIPAL', 'ADMINISTRACIÓN', 'CUENTA'];
  const sub = !enLinea
    ? 'Cifrado en la tablet · sin conexión'
    : pendientes > 0
      ? `Cifrado en la tablet · ${pendientes} por sincronizar`
      : 'Cifrado en la tablet · sincronizado';
  return (
    <aside className="sidebar" aria-label="Menú principal">
      <div className="sb-marca">
        <div className="sb-logo">
          <Icono nombre="fuel" tam={18} />
        </div>
        <div className="sb-marca-textos">
          <div className="sb-nombre">FISCALIZACIÓN</div>
          <div className="sb-sub">Combustible y lubricantes · EGEHID</div>
        </div>
      </div>
      {secciones.map((s) => {
        const lista = items.filter((i) => i.seccion === s);
        if (!lista.length) return null;
        return (
          <nav className="sb-seccion" key={s} aria-label={s}>
            <div className="sb-titulo">{s}</div>
            {lista.map((i) => (
              <NavLink key={i.ruta} to={i.ruta} end={i.exacta} className={({ isActive }) => `sb-item${activa(i.ruta, isActive) ? ' activo' : ''}`}>
                <Icono nombre={i.icono} tam={16} />
                <span>{i.texto}</span>
              </NavLink>
            ))}
          </nav>
        );
      })}
      <div className="sb-esp" />
      <div className="sb-estado" role="status">
        <div className="sb-estado-fila">
          <span className={`sb-punto${pendientes > 0 && enLinea ? ' pend' : ''}`} />
          <span className="sb-estado-t">Guardado local activo</span>
        </div>
        <div className="sb-estado-s">{sub}</div>
      </div>
      <div className="sb-usuario">
        <Link to="/cuenta" className="sb-usuario-link" aria-label="Mi cuenta">
          <span className="sb-avatar">{iniciales(me?.nombreCompleto, me?.correo ?? sesion.correo)}</span>
          <span className="sb-usuario-textos">
            <span className="sb-usuario-nombre">{nombreCorto(me?.nombreCompleto, me?.correo ?? sesion.correo)}</span>
            <span className="sb-usuario-rol">{rolVisible(me?.rol, me?.cargo)}</span>
          </span>
        </Link>
        <button type="button" className="sb-salir" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={() => sesion.salir()}>
          <Icono nombre="log-out" tam={16} />
        </button>
      </div>
    </aside>
  );
}

function Rail({ items }: { items: ItemNav[] }) {
  const activa = useActiva();
  const { data: me } = useMe();
  const sesion = useSesion();
  const enLinea = useEnLinea();
  const { pendientes } = useSincronizador();
  const arriba = items.filter((i) => i.seccion !== 'CUENTA' && !i.sinRiel);
  const cuenta = items.find((i) => i.ruta === '/cuenta');
  const item = (i: ItemNav) => (
    <NavLink key={i.ruta} to={i.ruta} end={i.exacta} className={({ isActive }) => `rl-item${activa(i.ruta, isActive) ? ' activo' : ''}`} aria-label={i.texto}>
      <Icono nombre={i.icono} tam={20} />
      <span aria-hidden="true">{i.corto}</span>
    </NavLink>
  );
  return (
    <aside className="rail" aria-label="Menú principal">
      <div className="rl-logo">
        <Icono nombre="fuel" tam={20} />
      </div>
      <div className="rl-sep" />
      <nav className="rl-nav" aria-label="PRINCIPAL">
        {arriba.map(item)}
      </nav>
      <div className="rl-esp" />
      {cuenta && item(cuenta)}
      <div
        className="rl-estado"
        role="status"
        title={!enLinea ? 'Guardado local · sin conexión' : pendientes ? `${pendientes} por sincronizar` : 'Sincronizado'}
      >
        <span className={`rl-punto${pendientes > 0 && enLinea ? ' pend' : ''}`} />
        <span>Local</span>
      </div>
      <Link to="/cuenta" className="rl-avatar" aria-label="Mi cuenta">
        {iniciales(me?.nombreCompleto, me?.correo ?? sesion.correo)}
      </Link>
    </aside>
  );
}

function Topbar({ migas }: { migas: string }) {
  const navegar = useNavigate();
  const [busqueda, setBusqueda] = useState('');
  const buscar = (e: FormEvent) => {
    e.preventDefault();
    navegar(`/historial?texto=${encodeURIComponent(busqueda.trim())}`);
  };
  return (
    <header className="topbar">
      <nav className="tb-migas" aria-label="Ruta">
        <span className="tb-raiz">Fiscalización</span>
        <Icono nombre="chevron-right" tam={14} className="tb-sep" />
        <span className="tb-actual">{migas}</span>
      </nav>
      <div className="tb-derecha">
        <form className="tb-buscar" role="search" onSubmit={buscar}>
          <Icono nombre="search" tam={15} />
          <input
            aria-label="Buscar"
            placeholder="Buscar por número, suplidor o destino…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </form>
        <IndicadorRed />
        <Campana />
      </div>
    </header>
  );
}

/** Encabezado móvil estándar: logo, título, subtítulo, buscar y campana. */
export function HeaderMovil({ titulo, sub }: { titulo: string; sub?: string }) {
  return (
    <header className="hm">
      <div className="hm-fila">
        <div className="hm-izq">
          <div className="hm-logo">
            <Icono nombre="fuel" tam={16} />
          </div>
          <div className="hm-textos">
            <h1 className="hm-titulo">{titulo}</h1>
            {sub && <div className="hm-sub">{sub}</div>}
          </div>
        </div>
        <div className="hm-der">
          <Link to="/historial" aria-label="Buscar" className="hm-btn">
            <Icono nombre="search" tam={20} />
          </Link>
          <Campana claro tam={20} />
        </div>
      </div>
    </header>
  );
}

export function BottomNav() {
  const item = (ruta: string, texto: string, icono: 'house' | 'history' | 'chart-column' | 'user-round', exacta = false) => (
    <NavLink to={ruta} end={exacta} className={({ isActive }) => `bn-item${isActive ? ' activo' : ''}`}>
      <Icono nombre={icono} tam={20} />
      <span>{texto}</span>
    </NavLink>
  );
  return (
    <nav className="bottom-nav" aria-label="Navegación inferior">
      {item('/', 'Inicio', 'house', true)}
      {item('/historial', 'Historial', 'history')}
      <div className="bn-item bn-nueva">
        <Link to="/fiscalizaciones/nueva" className="bn-fab" aria-label="Nueva fiscalización">
          <Icono nombre="plus" tam={22} />
        </Link>
      </div>
      {item('/estadisticas', 'Estadísticas', 'chart-column')}
      {item('/cuenta', 'Cuenta', 'user-round')}
    </nav>
  );
}

function Marco() {
  const { data: me } = useMe();
  const loc = useLocation();
  const tamano = useTamano();
  const meta = useMetaPagina();
  const items = itemsNav(me);
  const migas = meta.migas ?? tituloRuta(loc.pathname);
  const compacto = esCompacto(tamano);
  const movil = tamano === 'movil';
  const barraNav = compacto && meta.barraInferior !== 'propia';

  return (
    <div className={`shell t-${tamano}`}>
      {tamano === 'desktop' && <Sidebar items={items} />}
      {tamano === 'tablet-h' && <Rail items={items} />}
      <div className="main">
        {!movil && <Topbar migas={migas} />}
        {movil && meta.headerMovil !== 'propio' && <HeaderMovil titulo={meta.tituloMovil ?? migas} sub={meta.subMovil} />}
        <main className="contenido" id="contenido">
          <Outlet />
        </main>
        {barraNav && <BottomNav />}
      </div>
      <AvisoActualizacion />
    </div>
  );
}

export function Shell() {
  return (
    <ProveedorPagina>
      <Marco />
    </ProveedorPagina>
  );
}
