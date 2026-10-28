import type { Page, Route } from '@playwright/test';
import type { Escenario } from './fixtures/base';
import { detallePlantillas, LISTA_PLANTILLAS, pdfDePrueba } from './fixtures/plantillas';
import { respuestaUsuarios } from './fixtures/usuarios';

export const API = 'http://api.simulada.test/api';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
};

/**
 * API simulada para la prueba visual (solo datos del diseño). Responde GET con el escenario; los POST/PUT
 * (bitácora de clics, sincronización) se aceptan sin cambiar nada.
 */
export async function instalarApiVisual(page: Page, esc: Escenario) {
  const plantillas = detallePlantillas();
  const json = (r: Route, cuerpo: unknown, status = 200) =>
    r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(cuerpo), headers: CORS });

  await page.route(`${API}/**`, async (r) => {
    const req = r.request();
    const url = new URL(req.url());
    const ruta = url.pathname.replace(/^\/api/, '');
    const q = url.searchParams;
    const m = req.method();
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });

    if (m !== 'GET') {
      if (ruta === '/bitacora/ui') return r.fulfill({ status: 202, headers: CORS });
      const fm = /^\/fiscalizaciones\/([0-9a-f-]{36})$/.exec(ruta);
      if (fm && m === 'PUT' && esc.detalle[fm[1]]) return json(r, esc.detalle[fm[1]]);
      return json(r, { title: `No simulado en la prueba visual: ${m} ${ruta}` }, 400);
    }

    if (ruta === '/salud') return json(r, { estado: 'ok', servicio: 'fiscalizacion-egehid' });
    if (!esc.me) return json(r, { title: 'Sin sesión' }, 401);
    if (ruta === '/me') return json(r, esc.me);
    if (ruta === '/me/firma') return esc.meFirma ? json(r, { imagenBase64: esc.meFirma }) : json(r, { title: 'Sin firma' }, 404);
    if (ruta === '/catalogos') return json(r, esc.catalogos);
    if (ruta === '/inicio/resumen') return json(r, esc.inicio);
    if (ruta === '/avisos') return json(r, esc.inicio.avisos);
    if (ruta === '/estadisticas') return json(r, esc.estadisticas);
    if (ruta === '/solicitudes-firma/mias') return json(r, esc.solicitudes);
    if (ruta === '/usuarios') {
      const t = (q.get('texto') ?? '').toLowerCase();
      return json(r, esc.usuarios.filter((u) => !t || u.nombreCompleto.toLowerCase().includes(t)));
    }
    if (ruta === '/fiscalizaciones') {
      const pagina = Number(q.get('pagina') ?? 1);
      const tamano = Number(q.get('tamano') ?? 20);
      const estado = q.get('estado');
      const papelera = q.get('enPapelera') === 'true';
      let items = papelera ? esc.papelera : esc.lista;
      if (estado) items = items.filter((i) => i.estado === estado && !i.enPapelera);
      const filtrado = !!(estado || papelera || q.get('texto') || q.get('locacionId') || q.get('suplidorId'));
      const total = filtrado ? (papelera ? (esc.conteos.papelera ?? items.length) : (esc.conteos[estado ?? ''] ?? items.length)) : esc.totalLista;
      return json(r, {
        items: items.slice((pagina - 1) * tamano, pagina * tamano),
        total,
        pagina,
        tamano,
        conteos: esc.conteos,
      });
    }
    const foto = /^\/fiscalizaciones\/([0-9a-f-]{36})\/fotos\/([^/]+)$/.exec(ruta);
    if (foto) {
      const b = esc.fotos[foto[2]];
      return b
        ? r.fulfill({ status: 200, contentType: 'image/png', body: b, headers: CORS })
        : json(r, { title: 'Foto no encontrada' }, 404);
    }
    // PDF oficial (vigente, de una versión o vista previa): un PDF mínimo, la prueba visual no lo muestra
    const pdf = /^\/fiscalizaciones\/([0-9a-f-]{36})\/(?:pdf|pdf\/vista-previa|versiones\/\d+\/pdf)$/.exec(ruta);
    if (pdf) {
      const d = esc.detalle[pdf[1]];
      if (!d) return json(r, { title: 'No encontrado' }, 404);
      const texto = `FISCALIZACION ${d.numero ?? ''}`;
      return r.fulfill({ status: 200, contentType: 'application/pdf', body: pdfDePrueba([{ t: 'texto', x: 28, y: 26, texto, tam: 10 }], 612, 792), headers: CORS });
    }
    const sf = /^\/fiscalizaciones\/([0-9a-f-]{36})\/solicitudes-firma$/.exec(ruta);
    if (sf) return esc.detalle[sf[1]] ? json(r, esc.solicitudesRegistro[sf[1]] ?? []) : json(r, { title: 'No encontrado' }, 404);
    const ver = /^\/fiscalizaciones\/([0-9a-f-]{36})\/versiones$/.exec(ruta);
    if (ver) return json(r, esc.versiones[ver[1]] ?? []);
    const fm = /^\/fiscalizaciones\/([0-9a-f-]{36})$/.exec(ruta);
    if (fm) {
      const d = esc.detalle[fm[1]];
      return d ? json(r, d) : json(r, { title: 'No encontrado' }, 404);
    }
    // Gestión de usuarios (Administración; no está en el diseño)
    if (ruta === '/admin/usuarios') return json(r, respuestaUsuarios(q));
    if (ruta === '/plantillas') return json(r, LISTA_PLANTILLAS);
    const pl = /^\/plantillas\/(\d+)(?:\/versiones\/(\d+)\/pdf)?$/.exec(ruta);
    if (pl) {
      const { detalle, pdf } = plantillas;
      if (pl[2]) {
        const b = pdf[`${pl[1]}/${pl[2]}`];
        return b ? r.fulfill({ status: 200, contentType: 'application/pdf', body: b, headers: CORS }) : json(r, { title: 'Sin PDF' }, 404);
      }
      const d = detalle[Number(pl[1])];
      return d ? json(r, d) : json(r, { title: 'Plantilla no encontrada' }, 404);
    }
    return json(r, { title: `No simulado: GET ${ruta}` }, 404);
  });
}
