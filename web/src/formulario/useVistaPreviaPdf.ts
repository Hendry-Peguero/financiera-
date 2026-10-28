import { useState } from 'react';
import { abrirPdf, MENSAJE_PDF_SIN_RED, nombreVistaPrevia, rutaVistaPrevia } from '../api/pdf';
import type { FiscalizacionDto } from '../api/types';
import { asegurarSincronizado } from '../offline/sync';
import { mensajeError } from '../ui/errores';

/**
 * «Vista previa PDF» del formulario: envía lo pendiente del borrador y abre el PDF que genera la API, con la marca
 * «BORRADOR». Sin red muestra un aviso (el PDF solo lo genera el servidor).
 */
export function useVistaPreviaPdf({ datos, guardarYa }: { datos: FiscalizacionDto | null; guardarYa: () => Promise<void> }) {
  const [abriendo, setAbriendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abrir = async () => {
    if (!datos || abriendo) return;
    setError(null);
    if (!navigator.onLine) {
      setError(MENSAJE_PDF_SIN_RED);
      return;
    }
    setAbriendo(true);
    try {
      await guardarYa();
      const err = await asegurarSincronizado(datos.id);
      if (err) {
        setError(err);
        return;
      }
      await abrirPdf(rutaVistaPrevia(datos.id), nombreVistaPrevia(datos.numero));
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setAbriendo(false);
    }
  };

  return { abrir, abriendo, error, cerrarError: () => setError(null) };
}
