import type { CapacitorConfig } from '@capacitor/cli';

/**
 * App Android (Capacitor 8). El APK se instala una vez; el código web se actualiza solo desde la API
 * (@capgo/capacitor-updater en modo manual, ver src/app/actualizaciones.ts).
 *
 * PRUEBA (por defecto): la API local va por http:// → la app usa http://localhost (localhost cuenta como contexto
 * seguro para crypto) y se permite tráfico sin cifrar. PRODUCCIÓN (CAP_PRODUCCION=1): https y solo https.
 * Cambiar de esquema cambia el origen: lo guardado en la tablet con el otro esquema no se ve.
 */
const produccion = process.env.CAP_PRODUCCION === '1';

const config: CapacitorConfig = {
  appId: 'gob.egehid.fiscalizacion',
  appName: 'Fiscalización EGEHID',
  webDir: 'dist',
  server: {
    androidScheme: produccion ? 'https' : 'http',
    cleartext: !produccion,
  },
  android: {
    allowMixedContent: !produccion,
  },
  plugins: {
    CapacitorUpdater: {
      // modo manual: la app decide cuándo buscar, descargar y aplicar (src/app/actualizaciones.ts)
      autoUpdate: false,
      // si la versión nueva no llama notifyAppReady() en 10 s, vuelve sola a la anterior
      appReadyTimeout: 10000,
      // al instalar un APK nuevo se descartan los paquetes descargados para ese APK viejo
      resetWhenUpdate: true,
      // mantener la pantalla donde estaba al aplicar una versión
      keepUrlPathAfterReload: true,
      // nada sale a capgo.app: sin estadísticas ni canales externos
      statsUrl: '',
      channelUrl: '',
      updateUrl: '',
      httpsOnly: produccion,
    },
  },
};

export default config;
