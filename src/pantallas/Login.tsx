import { useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSesion } from '../auth/contexto';
import { Icono } from '../ui/Icono';
import { useTamano } from '../ui/tamano';
import { entero } from '../ui/formato';
import { leerTotalFinalizadas } from './totalFinalizadas';
import './login.css';
import { ServidorPrueba } from '../app/AvisosApp';
import { config } from '../config';
import { esDemo } from '../demo/apiDemo';

/** Panel de marca (degradado) de Login, Primer ingreso y Firmar en esta tablet. */
export function PanelMarca({
  eyebrow = 'UNIDAD DE AUDITORÍA INTERNA',
  titulo = 'Fiscalización de combustible y lubricantes en campo',
  texto = 'Registre entregas, mediciones, controles, firmas y fotografías aunque no haya internet. Cada formulario queda cifrado en la tablet y genera su PDF oficial.',
  rasgos = <RasgosMarca />,
}: {
  eyebrow?: string;
  titulo?: string;
  texto?: string;
  rasgos?: ReactNode;
}) {
  return (
    <section className="acc-marca">
      <div className="acc-marca-logo">
        <div className="acc-logo">
          <Icono nombre="fuel" tam={24} />
        </div>
        <div className="acc-marca-textos">
          <div className="acc-marca-nombre">EGEHID</div>
          <div className="acc-marca-sub">Empresa de Generación Hidroeléctrica Dominicana</div>
        </div>
      </div>
      <div className="acc-mensaje">
        <div className="acc-eyebrow">{eyebrow}</div>
        <h2 className="acc-titular">{titulo}</h2>
        <p className="acc-descripcion">{texto}</p>
        {rasgos}
      </div>
      <div className="acc-pie">© 2026 EGEHID · Versión 0.9 · Trabajo sin conexión</div>
    </section>
  );
}

function RasgosMarca() {
  const total = leerTotalFinalizadas();
  return (
    <div className="acc-rasgos">
      <div className="acc-rasgo">
        <div className="acc-rasgo-v">{total == null ? '—' : entero(total)}</div>
        <div className="acc-rasgo-l">Fiscalizaciones finalizadas</div>
      </div>
      <div className="acc-rasgo">
        <div className="acc-rasgo-v">20</div>
        <div className="acc-rasgo-l">Fotos por registro</div>
      </div>
      <div className="acc-rasgo">
        <div className="acc-rasgo-v">AES-256</div>
        <div className="acc-rasgo-l">Bóveda cifrada</div>
      </div>
    </div>
  );
}

const CORREO_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function Login() {
  const sesion = useSesion();
  const loc = useLocation();
  const tamano = useTamano();
  const desde = (loc.state as { desde?: string } | null)?.desde ?? '/';
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [mantener, setMantener] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const auth0 = sesion.modo === 'auth0';
  const ldap = sesion.modo === 'ldap';
  const movil = tamano === 'movil';

  if (sesion.estado === 'autenticado') return <Navigate to={desde} replace />;

  const entrar = async (registro = false) => {
    setError(null);
    setAviso(null);
    // demostración: se entra sin validar nada, para que cualquiera pueda recorrer la interfaz
    const c = esDemo && !CORREO_VALIDO.test(correo.trim()) ? 'demo@egehid.gob.do' : correo.trim();
    if (ldap && (!c || !clave)) return setError('Escriba su usuario y contraseña del dominio.');
    if (sesion.modo === 'dev' && !CORREO_VALIDO.test(c)) return setError('Escriba un correo válido.');
    if (auth0 && c && !CORREO_VALIDO.test(c)) return setError('Escriba un correo válido.');
    setEnviando(true);
    try {
      await sesion.entrar(c, { registro, clave, mantener });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const olvido = () => {
    setError(null);
    if (auth0) void sesion.entrar(correo.trim());
    else if (ldap) setAviso('Es la misma contraseña de su PC en la red de EGEHID. Si la olvidó o está bloqueada, llame a Tecnología.');
    else setAviso('En modo desarrollo no se usa contraseña: basta con el correo.');
  };

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    void entrar(false);
  };

  const campoCorreo = ldap ? (
    <div className="campo">
      <label className="campo-etiqueta" htmlFor="login-correo">
        Usuario de dominio
      </label>
      <div className="caja acc-caja">
        <input
          id="login-correo"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="nombre.apellido"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
        />
        <Icono nombre="user" tam={16} className="caja-icono" />
      </div>
    </div>
  ) : (
    <div className="campo">
      <label className="campo-etiqueta" htmlFor="login-correo">
        Correo institucional
      </label>
      <div className="caja acc-caja">
        <input
          id="login-correo"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
        />
        <Icono nombre="mail" tam={16} className="caja-icono" />
      </div>
    </div>
  );
  const campoClave = !auth0 && (
    <div className="campo">
      <label className="campo-etiqueta" htmlFor="login-clave">
        Contraseña
      </label>
      <div className="caja acc-caja">
        <input
          id="login-clave"
          type={verClave ? 'text' : 'password'}
          autoComplete="current-password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
        />
        <button
          type="button"
          className="caja-btn"
          aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          onClick={() => setVerClave((v) => !v)}
        >
          <Icono nombre={verClave ? 'eye-off' : 'eye'} tam={16} />
        </button>
      </div>
    </div>
  );
  const mensajes = (error || sesion.error || aviso) && (
    <div className={`aviso ${error || sesion.error ? 'aviso-error' : 'aviso-info'}`} role={error || sesion.error ? 'alert' : 'status'}>
      {error ?? sesion.error ?? aviso}
    </div>
  );

  if (movil)
    return (
      <div className="acc acc-movil t-movil">
        <section className="acc-m-marca">
          <div className="acc-logo acc-m-logo">
            <Icono nombre="fuel" tam={24} />
          </div>
          <div className="acc-m-eyebrow">FISCALIZACIÓN · EGEHID</div>
          <h2 className="acc-m-titular">Combustible y lubricantes en campo, aun sin internet</h2>
        </section>
        <div className="acc-m-envoltorio">
          <form className="acc-m-tarjeta" onSubmit={enviar} aria-label="Iniciar sesión" noValidate>
            <h1 className="acc-m-titulo">Iniciar sesión</h1>
            {campoCorreo}
            {campoClave}
            <button type="submit" className="btn btn-primario acc-m-entrar" disabled={enviando}>
              <Icono nombre="log-in" tam={16} />
              Entrar a mi espacio
            </button>
            {mensajes}
            <ServidorPrueba />
            <div className="acc-m-enlaces">
              {!ldap && (
                <button type="button" className="enlace" onClick={() => void entrar(true)}>
                  Crear cuenta
                </button>
              )}
              <button type="button" className="enlace" onClick={olvido}>
                ¿Olvidó su contraseña?
              </button>
            </div>
          </form>
        </div>
        <div className="acc-m-esp" />
        <div className="acc-m-pie">
          <Icono nombre="shield-check" tam={14} />
          Datos cifrados en la tablet · versión {config.version}
        </div>
      </div>
    );

  return (
    <div className={`acc t-${tamano}`}>
      <PanelMarca />
      <div className="acc-panel">
        <form className="acc-tarjeta acc-login" onSubmit={enviar} aria-label="Iniciar sesión" noValidate>
          <div className="acc-encabezado">
            <h1 className="acc-titulo">Iniciar sesión</h1>
            <p className="acc-texto">
              {ldap
                ? 'Use su usuario y contraseña de la red de EGEHID (los mismos de su PC). La sesión permanece abierta hasta que la cierre.'
                : 'Use la cuenta local registrada en esta tablet. La sesión permanece abierta hasta que la cierre.'}
            </p>
          </div>
          <div className="acc-campos">
            {campoCorreo}
            {campoClave}
          </div>
          <div className="acc-opciones">
            <label className="casilla">
              <input type="checkbox" checked={mantener} onChange={(e) => setMantener(e.target.checked)} />
              Mantener sesión
            </label>
            <button type="button" className="enlace" onClick={olvido}>
              ¿Olvidó su contraseña?
            </button>
          </div>
          <button type="submit" className="btn btn-primario btn-grande btn-ancho" disabled={enviando}>
            <Icono nombre="log-in" tam={16} />
            Entrar a mi espacio
          </button>
          {mensajes}
          <ServidorPrueba />
          {!ldap && (
            <>
              <div className="acc-divisor">
                <span />o<span />
              </div>
              <button type="button" className="btn btn-grande btn-ancho" disabled={enviando} onClick={() => void entrar(true)}>
                <Icono nombre="user-plus" tam={16} />
                Crear cuenta en esta tablet
              </button>
            </>
          )}
          <p className="acc-version">Versión {config.version}</p>
          <div className="aviso aviso-info acc-nota">
            <Icono nombre="shield-check" tam={16} />
            <span>
              Los datos se cifran con la bóveda de Android. Microsoft y SharePoint se habilitarán cuando Tecnología lo autorice.
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
