import { Capacitor } from '@capacitor/core';

/** true dentro de la app Android (Capacitor); false en el navegador. */
export const esApp = (): boolean => Capacitor.isNativePlatform();
