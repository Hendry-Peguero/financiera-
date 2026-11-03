/** Dimensiones destino manteniendo proporción, lado mayor ≤ max. */
export function dimensionesAjustadas(ancho: number, alto: number, max = 1600): { ancho: number; alto: number } {
  const mayor = Math.max(ancho, alto);
  if (mayor <= max) return { ancho, alto };
  const f = max / mayor;
  return { ancho: Math.round(ancho * f), alto: Math.round(alto * f) };
}

async function cargar(archivo: Blob): Promise<{ fuente: CanvasImageSource; ancho: number; alto: number; liberar: () => void }> {
  if (typeof createImageBitmap === 'function') {
    const bmp = await createImageBitmap(archivo);
    return { fuente: bmp, ancho: bmp.width, alto: bmp.height, liberar: () => bmp.close() };
  }
  const url = URL.createObjectURL(archivo);
  const img = new Image();
  await new Promise<void>((ok, mal) => {
    img.onload = () => ok();
    img.onerror = () => mal(new Error('No se pudo leer la imagen.'));
    img.src = url;
  });
  return { fuente: img, ancho: img.naturalWidth, alto: img.naturalHeight, liberar: () => URL.revokeObjectURL(url) };
}

/** Comprime una foto a JPEG con lado mayor ~1600 px. */
export async function comprimirImagen(archivo: Blob, max = 1600, calidad = 0.82): Promise<Blob> {
  const { fuente, ancho, alto, liberar } = await cargar(archivo);
  try {
    const d = dimensionesAjustadas(ancho, alto, max);
    const canvas = document.createElement('canvas');
    canvas.width = d.ancho;
    canvas.height = d.alto;
    const ctx = canvas.getContext('2d');
    if (!ctx) return archivo;
    ctx.drawImage(fuente, 0, 0, d.ancho, d.alto);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', calidad));
    return blob ?? archivo;
  } finally {
    liberar();
  }
}

export function blobABase64(blob: Blob): Promise<string> {
  return new Promise((ok, mal) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).replace(/^data:[^,]+,/, ''));
    r.onerror = () => mal(r.error);
    r.readAsDataURL(blob);
  });
}
