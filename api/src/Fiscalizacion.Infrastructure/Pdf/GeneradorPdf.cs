using Fiscalizacion.Application.Pdf;
using Fiscalizacion.Application.Plantillas;
using Fiscalizacion.Domain.Entidades;
using Fiscalizacion.Domain.Enums;
using PdfSharp.Drawing;
using PdfSharp.Pdf;

namespace Fiscalizacion.Infrastructure.Pdf;

/// <summary>
/// PDF oficial con PDFsharp (MIT): la página 1 es el formulario en papel de EGEHID (<see cref="PlantillaOficial"/>)
/// con cada valor escrito en su celda; después, el anexo de fotografías (6 por página A4). Los campos se dibujan con
/// <see cref="RellenarPagina"/>, que sirve para cualquier plantilla (PDF base + campos con posición).
/// </summary>
public class GeneradorPdf : IGeneradorPdf
{
    private const int FotosPorPagina = 6;
    private const double Margen = 24, Hueco = 10;

    private static readonly XColor Tinta = XColor.FromArgb(0x17, 0x2b, 0x4d);
    private static readonly XColor Gris = XColor.FromArgb(0x66, 0x6d, 0x74);   // gris del formulario
    private static readonly XColor Azul = XColor.FromArgb(0x05, 0x59, 0xd4);   // azul del formulario
    private static readonly XColor Borde = XColor.FromArgb(0x9a, 0xa5, 0xb5);
    private static readonly XColor FondoFoto = XColor.FromArgb(0xf8, 0xfa, 0xfc);

    public byte[] Generar(DocumentoPdf d)
    {
        ResolutorFuentes.Registrar();
        var r = d.Registro;
        var rev = Math.Max(1, d.Version);
        var fotos = d.Fotos.OrderBy(f => f.Orden).ToList();
        var grupos = (fotos.Count + FotosPorPagina - 1) / FotosPorPagina;
        var total = 1 + grupos;

        using var pdf = new PdfDocument();
        pdf.Info.Title = $"Fiscalización N.º {r.Numero} · Rev. {rev}";
        pdf.Info.Author = "EGEHID · Unidad de Auditoría Interna";
        pdf.Info.Subject = "Formulario Fiscalización Combustible y Aceites";
        pdf.Info.Creator = "Fiscalización de combustible (EGEHID)";

        using (var g = NuevaPagina(pdf, (double)PlantillaOficial.AnchoPagina, (double)PlantillaOficial.AltoPagina))
        {
            RellenarPagina(g, PlantillaOficial.PdfBase, 1, PlantillaOficial.Campos(), ValoresFormulario.Desde(d));
            var izquierda = $"Fiscalización N.º {r.Numero} · Rev. {rev}" + (d.Producto is { } p ? $" · {p}" : "");
            Pie(g, izquierda, $"Generado {FormatoPdf.Momento12(d.GeneradoEn)} · Página 1 de {total}");
        }

        for (var i = 0; i < grupos; i++)
        {
            using var g = NuevaPagina(pdf, (double)PlantillaOficial.AnchoPagina, (double)PlantillaOficial.AltoPagina);
            var titulo = "Anexo · Fotografías" + (grupos > 1 ? $" ({i + 1} de {grupos})" : "");
            g.DrawString(titulo, Fuente(11, true), new XSolidBrush(Azul), new XRect(Margen, 24, 300, 16), XStringFormats.CenterLeft);
            g.DrawString($"Fiscalización N.º {r.Numero} · Rev. {rev}", Fuente(8), new XSolidBrush(Gris),
                new XRect(Margen, 24, g.PageSize.Width - 2 * Margen, 16), XStringFormats.CenterRight);
            g.DrawLine(new XPen(Azul, 1), Margen, 44, g.PageSize.Width - Margen, 44);
            Fotos(g, fotos.Skip(i * FotosPorPagina).Take(FotosPorPagina).ToList());
            Pie(g, $"Fiscalización N.º {r.Numero} · Rev. {rev}", $"Página {i + 2} de {total}");
        }

        if (!string.IsNullOrWhiteSpace(d.MarcaAgua)) MarcaAgua(pdf, d.MarcaAgua);
        using var salida = new MemoryStream();
        pdf.Save(salida, false);
        return salida.ToArray();
    }

    private static XGraphics NuevaPagina(PdfDocument pdf, double ancho, double alto)
    {
        var pagina = pdf.AddPage();
        pagina.Width = XUnit.FromPoint(ancho);
        pagina.Height = XUnit.FromPoint(alto);
        return XGraphics.FromPdfPage(pagina);
    }

    // ---------------------------------------------------------------- plantilla

    /// <summary>
    /// Dibuja la página <paramref name="pagina"/> del PDF base y encima el valor de cada campo de esa página
    /// (texto ajustado a la celda, «X» en las casillas, imagen en las firmas). Los campos sin valor quedan en blanco.
    /// </summary>
    public static void RellenarPagina(XGraphics g, byte[] pdfBase, int pagina, IEnumerable<PlantillaCampo> campos,
        IReadOnlyDictionary<string, ValorCampo> valores)
    {
        using (var form = XPdfForm.FromStream(new MemoryStream(pdfBase)))
        {
            form.PageNumber = pagina;
            g.DrawImage(form, 0, 0, g.PageSize.Width, g.PageSize.Height);
        }
        foreach (var c in campos.Where(c => c.Pagina == pagina && c.ImprimirPdf))
        {
            if (!valores.TryGetValue(c.Identificador, out var v)) continue;
            var caja = new XRect((double)c.X, (double)c.Y, (double)c.Ancho, (double)c.Alto);
            switch (c.Tipo)
            {
                case TipoCampo.Casilla:
                    var tam = Math.Min(caja.Height * 0.7, 10);
                    g.DrawString("X", Fuente(tam, true), new XSolidBrush(Tinta), caja, XStringFormats.Center);
                    break;
                case TipoCampo.Firma:
                    Firma(g, caja, v);
                    break;
                default:
                    if (v.Texto is { } t) Texto(g, caja, t);
                    break;
            }
        }
    }

    private const double TamTexto = 7.5, TamMinimo = 5, Relleno = 2.5;

    /// <summary>Una línea centrada si cabe (reduciendo la letra hasta 5 pt); en celdas altas, párrafo arriba a la izquierda.</summary>
    private static void Texto(XGraphics g, XRect caja, string texto)
    {
        var interior = new XRect(caja.X + Relleno, caja.Y + 1, Math.Max(1, caja.Width - 2 * Relleno), Math.Max(1, caja.Height - 2));
        var pincel = new XSolidBrush(Tinta);
        if (caja.Height < 24)
        {
            for (var tam = Math.Min(TamTexto, caja.Height * 0.62); tam >= TamMinimo; tam -= 0.25)
            {
                var f = Fuente(tam);
                if (g.MeasureString(texto, f).Width <= interior.Width)
                {
                    g.DrawString(texto, f, pincel, interior, XStringFormats.Center);
                    return;
                }
            }
            var minima = Fuente(TamMinimo);
            g.DrawString(Recortar(g, texto, minima, interior.Width), minima, pincel, interior, XStringFormats.Center);
            return;
        }

        interior = new XRect(caja.X + 4, caja.Y + 3, caja.Width - 8, caja.Height - 5);
        for (var tam = TamTexto; tam >= TamMinimo; tam -= 0.25)
        {
            var f = Fuente(tam);
            var lineas = Partir(g, texto, f, interior.Width);
            var alto = tam * 1.25;
            if (lineas.Count * alto <= interior.Height || tam - 0.25 < TamMinimo)
            {
                var max = (int)Math.Floor(interior.Height / alto);
                if (lineas.Count > max)
                {
                    lineas = lineas.Take(max).ToList();
                    lineas[^1] = Recortar(g, lineas[^1] + " …", f, interior.Width);
                }
                for (var i = 0; i < lineas.Count; i++)
                    g.DrawString(lineas[i], f, pincel, new XRect(interior.X, interior.Y + i * alto, interior.Width, alto), XStringFormats.CenterLeft);
                return;
            }
        }
    }

    private static List<string> Partir(XGraphics g, string texto, XFont f, double ancho)
    {
        var lineas = new List<string>();
        foreach (var parrafo in texto.Replace("\r", "").Split('\n'))
        {
            var actual = "";
            foreach (var palabra in parrafo.Split(' ', StringSplitOptions.RemoveEmptyEntries))
            {
                var prueba = actual.Length == 0 ? palabra : actual + " " + palabra;
                if (g.MeasureString(prueba, f).Width <= ancho || actual.Length == 0) actual = prueba;
                else
                {
                    lineas.Add(actual);
                    actual = palabra;
                }
            }
            lineas.Add(actual);
        }
        return lineas;
    }

    private static string Recortar(XGraphics g, string texto, XFont f, double ancho)
    {
        if (g.MeasureString(texto, f).Width <= ancho) return texto;
        var s = texto;
        while (s.Length > 1 && g.MeasureString(s + "…", f).Width > ancho) s = s[..^1];
        return s.TrimEnd() + "…";
    }

    /// <summary>Firma ajustada a la celda sin deformarla; si la celda es alta, el nombre del firmante al pie.</summary>
    private static void Firma(XGraphics g, XRect caja, ValorCampo v)
    {
        var conPie = v.Pie is not null && caja.Height >= 18;
        var areaImagen = conPie ? new XRect(caja.X, caja.Y, caja.Width, caja.Height - 6.5) : caja;
        if (v.Imagen is { } bytes && Abrir(bytes) is { } img)
            using (img)
            {
                var escala = Math.Min((areaImagen.Width - 2) / img.PointWidth, (areaImagen.Height - 1) / img.PointHeight);
                var w = img.PointWidth * escala;
                var h = img.PointHeight * escala;
                g.DrawImage(img, areaImagen.X + (areaImagen.Width - w) / 2, areaImagen.Y + (areaImagen.Height - h) / 2, w, h);
            }
        if (conPie)
            g.DrawString(v.Pie!, Fuente(5.5), new XSolidBrush(Gris), new XRect(caja.X, caja.Bottom - 6.5, caja.Width, 6.5), XStringFormats.Center);
    }

    // ---------------------------------------------------------------- anexo

    /// <summary>Dos columnas, recuadro 4:3 con la foto completa (sin recortar) y la descripción debajo.</summary>
    private static void Fotos(XGraphics g, IReadOnlyList<FotoPdf> fotos)
    {
        var ancho = (g.PageSize.Width - 2 * Margen - Hueco) / 2;
        var alto = ancho * 3 / 4;
        const double pie = 22;
        for (var i = 0; i < fotos.Count; i++)
        {
            var foto = fotos[i];
            var x = Margen + i % 2 * (ancho + Hueco);
            var y = 56 + i / 2 * (alto + pie + Hueco);
            var caja = new XRect(x, y, ancho, alto);
            g.DrawRectangle(new XPen(Borde, 0.5), new XSolidBrush(FondoFoto), caja);
            if (foto.Imagen is { } bytes && Abrir(bytes) is { } img)
                using (img)
                {
                    var escala = Math.Min((ancho - 2) / img.PointWidth, (alto - 2) / img.PointHeight);
                    var w = img.PointWidth * escala;
                    var h = img.PointHeight * escala;
                    g.DrawImage(img, x + (ancho - w) / 2, y + (alto - h) / 2, w, h);
                }
            else
                g.DrawString(foto.Imagen is null ? "Imagen no disponible" : "Formato de imagen no admitido en el PDF",
                    Fuente(8), new XSolidBrush(Gris), caja, XStringFormats.Center);
            var texto = $"{foto.Orden}. {foto.Descripcion ?? ""}".Trim();
            var f = Fuente(7.5);
            var lineas = Partir(g, texto, f, ancho).Take(2).ToList();
            for (var l = 0; l < lineas.Count; l++)
                g.DrawString(lineas[l], f, new XSolidBrush(Tinta), new XRect(x, y + alto + 3 + l * 9.5, ancho, 9.5), XStringFormats.CenterLeft);
        }
    }

    /// <summary>Imagen para PDFsharp; null si no la puede leer (p. ej. WebP).</summary>
    private static XImage? Abrir(byte[] bytes)
    {
        try
        {
            return XImage.FromStream(new MemoryStream(ConCabeceraJfif(bytes)));
        }
        catch (Exception)
        {
            return null;
        }
    }

    /// <summary>
    /// PDFsharp solo reconoce un JPEG si después de SOI viene un segmento APP0/APP1; algunos JPEG válidos (cámaras,
    /// editores) empiezan directo con las tablas. Se les inserta un APP0 «JFIF» mínimo, sin tocar la imagen.
    /// </summary>
    private static byte[] ConCabeceraJfif(byte[] b)
    {
        if (b.Length < 4 || b[0] != 0xFF || b[1] != 0xD8 || b[2] != 0xFF || b[3] is >= 0xE0 and <= 0xEF) return b;
        byte[] app0 = [0xFF, 0xE0, 0x00, 0x10, (byte)'J', (byte)'F', (byte)'I', (byte)'F', 0, 1, 1, 0, 0, 1, 0, 1, 0, 0];
        return [.. b.AsSpan(0, 2), .. app0, .. b.AsSpan(2)];
    }

    // ---------------------------------------------------------------- comunes

    /// <summary>Línea de referencia bajo el formulario: número, revisión, fecha de generación y página.</summary>
    private static void Pie(XGraphics g, string izquierda, string derecha)
    {
        var caja = new XRect(Margen, g.PageSize.Height - 22, g.PageSize.Width - 2 * Margen, 10);
        var f = Fuente(6.5);
        var pincel = new XSolidBrush(Gris);
        g.DrawString(izquierda, f, pincel, caja, XStringFormats.CenterLeft);
        g.DrawString(derecha, f, pincel, caja, XStringFormats.CenterRight);
    }

    /// <summary>Marca de agua diagonal («BORRADOR» en la vista previa de un borrador).</summary>
    private static void MarcaAgua(PdfDocument pdf, string texto)
    {
        var fuente = new XFont(ResolutorFuentes.Inter, 110, XFontStyleEx.Bold);
        var pincel = new XSolidBrush(XColor.FromArgb(40, 0x9a, 0xa5, 0xb5));
        foreach (var pagina in pdf.Pages)
        {
            using var g = XGraphics.FromPdfPage(pagina, XGraphicsPdfPageOptions.Append);
            var w = pagina.Width.Point;
            var h = pagina.Height.Point;
            g.TranslateTransform(w / 2, h / 2);
            g.RotateTransform(-Math.Atan2(h, w) * 180 / Math.PI);
            var tam = g.MeasureString(texto, fuente);
            var f = tam.Width > w * 1.1 ? w * 1.1 / tam.Width : 1;
            g.ScaleTransform(f);
            g.DrawString(texto, fuente, pincel, new XPoint(-tam.Width / 2, tam.Height / 3));
        }
    }

    private static XFont Fuente(double tam, bool negrita = false) =>
        new(ResolutorFuentes.Inter, tam, negrita ? XFontStyleEx.Bold : XFontStyleEx.Regular);
}
