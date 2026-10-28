using Fiscalizacion.Application.Pdf;

namespace Fiscalizacion.Infrastructure.Pdf;

/// <summary>PDF oficiales en disco, como las fotos: {raíz}/{fiscalización}/v{versión}.pdf. La ruta guardada es relativa a la raíz.</summary>
public class AlmacenPdfDisco(string raiz) : IAlmacenPdf
{
    public async Task<string> GuardarAsync(Guid fiscalizacionId, int version, byte[] contenido, CancellationToken ct)
    {
        var relativa = Path.Combine(fiscalizacionId.ToString("N"), $"v{version}.pdf");
        var completa = Completa(relativa);
        Directory.CreateDirectory(Path.GetDirectoryName(completa)!);
        // se escribe aparte y se reemplaza, para no dejar un PDF a medias si falla
        var temporal = completa + ".tmp";
        await File.WriteAllBytesAsync(temporal, contenido, ct);
        File.Move(temporal, completa, overwrite: true);
        return relativa;
    }

    public async Task<byte[]?> LeerAsync(string ruta, CancellationToken ct)
    {
        var completa = Completa(ruta);
        return File.Exists(completa) ? await File.ReadAllBytesAsync(completa, ct) : null;
    }

    private string Completa(string ruta)
    {
        var baseCompleta = Path.GetFullPath(raiz);
        var completa = Path.GetFullPath(Path.Combine(baseCompleta, ruta));
        if (!completa.StartsWith(baseCompleta, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Ruta de PDF inválida.");
        return completa;
    }
}
