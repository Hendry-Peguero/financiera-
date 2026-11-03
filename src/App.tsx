import { useEffect, useRef } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { RequiereAdmin, RequierePropietario, RequiereSesion } from './auth/guardas';
import { Formulario, NuevaFiscalizacion } from './formulario/Formulario';
import { Bitacora } from './pantallas/Bitacora';
import { Cuenta } from './pantallas/Cuenta';
import { Detalle } from './pantallas/Detalle';
import { Estadisticas } from './pantallas/Estadisticas';
import { Historial } from './pantallas/Historial';
import { Inicio } from './pantallas/Inicio';
import { Login } from './pantallas/Login';
import { Papelera } from './pantallas/Papelera';
import { Plantillas } from './pantallas/Plantillas';
import { PrimerIngreso } from './pantallas/PrimerIngreso';
import { RevisarFirmar } from './pantallas/RevisarFirmar';
import { SolicitudesFirma } from './pantallas/SolicitudesFirma';
import { Usuarios } from './pantallas/Usuarios';
import { Versiones } from './pantallas/Versiones';
import { rastreador } from './tracking';
import { Shell } from './ui/Shell';

/** Registra cada cambio de ruta en la bitácora de UI. */
function RastreoRutas() {
  const loc = useLocation();
  const previa = useRef<string | null>(null);
  useEffect(() => {
    const ruta = loc.pathname;
    if (previa.current === ruta) return;
    void rastreador.registrar('navegacion', ruta, { desde: previa.current });
    previa.current = ruta;
  }, [loc.pathname]);
  return null;
}

function NoEncontrada() {
  return (
    <div className="vacio">
      Página no encontrada. <Link to="/">Volver al inicio</Link>
    </div>
  );
}

export function App() {
  return (
    <>
      <RastreoRutas />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/primer-ingreso"
          element={
            <RequiereSesion permitirPerfilIncompleto>
              <PrimerIngreso />
            </RequiereSesion>
          }
        />
        {/* «Firmar aquí» ahora es una ventana dentro de Firmas; la ruta vieja lleva allí. */}
        <Route path="/fiscalizaciones/:id/firmar/:rol" element={<AFirmas />} />
        {/* Pantalla completa, sin menú (diseño «Revisar y firmar (firmante)») */}
        <Route
          path="/firmas/solicitudes/:solicitudId"
          element={
            <RequiereSesion>
              <RevisarFirmar />
            </RequiereSesion>
          }
        />
        <Route
          element={
            <RequiereSesion>
              <Shell />
            </RequiereSesion>
          }
        >
          <Route index element={<Inicio />} />
          <Route path="fiscalizaciones/nueva" element={<NuevaFiscalizacion />} />
          <Route path="fiscalizaciones/:id" element={<Detalle />} />
          <Route path="fiscalizaciones/:id/:seccion" element={<Formulario />} />
          <Route path="historial" element={<Historial />} />
          <Route path="estadisticas" element={<Estadisticas />} />
          <Route
            path="plantillas"
            element={
              <RequiereAdmin>
                <Plantillas />
              </RequiereAdmin>
            }
          />
          <Route
            path="versiones"
            element={
              <RequiereAdmin>
                <Versiones />
              </RequiereAdmin>
            }
          />
          <Route
            path="papelera"
            element={
              <RequiereAdmin>
                <Papelera />
              </RequiereAdmin>
            }
          />
          <Route
            path="usuarios"
            element={
              <RequiereAdmin>
                <Usuarios />
              </RequiereAdmin>
            }
          />
          <Route path="cuenta" element={<Cuenta />} />
          <Route path="cuenta/respaldo" element={<Cuenta enfoque="respaldo" />} />
          <Route path="firmas/solicitudes" element={<SolicitudesFirma />} />
          <Route
            path="bitacora"
            element={
              <RequierePropietario>
                <Bitacora />
              </RequierePropietario>
            }
          />
          <Route path="*" element={<NoEncontrada />} />
        </Route>
      </Routes>
    </>
  );
}

function AFirmas() {
  const { id = '' } = useParams();
  return <Navigate to={`/fiscalizaciones/${id}/firmas`} replace />;
}
