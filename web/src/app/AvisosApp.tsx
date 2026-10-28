import { useState } from 'react';
import { construirUrl, solicitar } from '../api/client';
import { config, guardarServidor, normalizarServidor, permiteCambiarServidor } from '../config';
import { esSaludDeLaApi } from '../offline/confirmacion';
import { Icono } from '../ui/Icono';
import { useActualizacion } from './actualizaciones';
import './app.css';

/** Aviso de la app Android: versión nueva lista (se aplica al cerrar o pasar a segundo plano) o APK por reinstalar. */
export function AvisoActualizacion() {
  const a = useActualizacion();
  const [cerrado, setCerrado] = useState<string | null>(null);
  if (a.tipo === 'al-dia' || cerrado === a.version) return null;
  return (
    <div className={`app-aviso${a.tipo === 'reinstalar' ? ' app-aviso-warn' : ''}`} role="status">
      <Icono nombre={a.tipo === 'reinstalar' ? 'alerta' : 'download'} tam={16} />
      <span>
        {a.tipo === 'lista'
          ? `Versión ${a.version} descargada: se aplicará la próxima vez que cierre o salga de la app. Lo que está escribiendo ya está guardado.`
          : `La versión ${a.version} necesita instalar de nuevo la app (APK). Pida el instalador a Tecnología.`}
      </span>
      <button type="button" aria-label="Cerrar aviso" onClick={() => setCerrado(a.version)}>
        <Icono nombre="x" tam={14} />
      </button>
    </div>
  );
}

/**
 * PRUEBAS (APK con VITE_PERMITIR_SERVIDOR=1): dirección de la API en la pantalla de inicio de sesión, con «Probar».
 * Solo acepta el servidor si /salud responde la marca de esta API.
 */
export function ServidorPrueba() {
  const [texto, setTexto] = useState(config.apiUrl);
  const [estado, setEstado] = useState<{ ok: boolean; texto: string } | null>(null);
  if (!permiteCambiarServidor) return null;
  const probar = async () => {
    const url = normalizarServidor(texto);
    const anterior = config.apiUrl;
    setEstado({ ok: true, texto: 'Probando…' });
    guardarServidor(url);
    try {
      const salud = await solicitar<unknown>('/salud', { signal: AbortSignal.timeout(6000) });
      if (!esSaludDeLaApi(salud)) throw new Error('responde, pero no es la API de Fiscalización');
      setTexto(url);
      setEstado({ ok: true, texto: `Conectado a ${construirUrl('')}` });
    } catch (e) {
      guardarServidor(anterior === config.apiPorDefecto ? null : anterior);
      setEstado({ ok: false, texto: `No responde ${url}: ${(e as Error).message || 'sin conexión'}` });
    }
  };
  return (
    <div className="app-servidor">
      <label className="campo-etiqueta" htmlFor="login-servidor">
        Servidor de la API (prueba)
      </label>
      <div className="app-servidor-fila">
        <div className="caja acc-caja">
          <input id="login-servidor" inputMode="url" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="192.168.1.17" />
        </div>
        <button type="button" className="btn" onClick={() => void probar()}>
          Probar
        </button>
      </div>
      {estado && <span className={`app-servidor-estado${estado.ok ? '' : ' mal'}`}>{estado.texto}</span>}
    </div>
  );
}
