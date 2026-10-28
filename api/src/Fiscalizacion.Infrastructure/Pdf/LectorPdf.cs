using Fiscalizacion.Application.Plantillas;
using UglyToad.PdfPig;

namespace Fiscalizacion.Infrastructure.Pdf;

/// <summary>Lee el tamaño de las páginas con PdfPig (Apache 2.0). Las páginas giradas 90°/270° se miden ya giradas, como las muestra el visor.</summary>
public class LectorPdf : ILectorPdf
{
    public IReadOnlyList<PaginaDto>? Paginas(byte[] pdf)
    {
        try
        {
            using var doc = PdfDocument.Open(pdf);
            // PdfPig ya aplica /Rotate al ancho y alto
            return doc.GetPages().Select(p => new PaginaDto((decimal)Math.Round(p.Width, 2), (decimal)Math.Round(p.Height, 2))).ToList();
        }
        catch (Exception)
        {
            // dañado, protegido con contraseña o no es un PDF
            return null;
        }
    }
}
