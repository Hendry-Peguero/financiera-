import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { iniciarActualizaciones } from './app/actualizaciones';
import { SesionConRuta } from './auth/SesionConRuta';
import { rastreador } from './tracking';
import '@fontsource-variable/inter/wght.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/jetbrains-mono/700.css';
import '@fontsource/caveat/400.css';
import '@fontsource/caveat/600.css';
import './styles/tokens.css';
import './styles/base.css';

const clienteConsultas = new QueryClient({
  defaultOptions: {
    // 'always': sin red las consultas igual se ejecutan y caen a la caché de IndexedDB (conCache)
    queries: { refetchOnWindowFocus: false, networkMode: 'always' },
    mutations: { networkMode: 'always' },
  },
});

if (import.meta.env.VITE_ESCALA_DISENO === '1') document.documentElement.classList.add('escala-diseno');

rastreador.instalar();
// app Android: confirma que esta versión abrió bien y busca actualizaciones (en el navegador no hace nada)
iniciarActualizaciones();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={clienteConsultas}>
        <SesionConRuta>
          <App />
        </SesionConRuta>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
);
