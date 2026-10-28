import { escribirAcceso, escenarioPrimerIngreso } from '../fixtures/acceso';
import { dibujarFirma } from './ayudas';
import type { Pantalla } from './tipos';

export const PANTALLAS_ACCESO: Pantalla[] = [
  {
    id: 'login',
    tamanos: ['desktop', 'tablet-h', 'tablet-v', 'movil'],
    ruta: '/login',
    anonimo: true,
    escenario: (esc) => {
      esc.me = null;
    },
    localStorage: { 'fisc.totalFinalizadas': '1284' },
    listo: '#login-correo',
    antes: async ({ page }) => {
      await escribirAcceso(page);
    },
  },
  {
    id: 'primer-ingreso-perfil-y-firma',
    tamanos: ['desktop', 'tablet-h', 'tablet-v', 'movil'],
    ruta: '/primer-ingreso',
    escenario: escenarioPrimerIngreso,
    localStorage: { 'fisc.totalFinalizadas': '1284' },
    listo: '[data-lienzo-firma]',
    antes: async ({ page, tamano }) => {
      const movil = tamano === 'movil';
      await dibujarFirma(page, 'María Rosario', { tam: movil ? 40 : 44, y: movil ? 59 : 57 });
    },
  },
];
