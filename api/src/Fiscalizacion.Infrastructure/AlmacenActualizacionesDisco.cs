using System.Text.Json;
using System.Text.RegularExpressions;
using Fiscalizacion.Application.Actualizaciones;

namespace Fiscalizacion.Infrastructure;

/// <summary>Paquetes de la app en disco: {raíz}/version.json y {raíz}/{archivo}.zip.</summary>
public partial class AlmacenActualizacionesDisco(string raiz) : IAlmacenActualizaciones
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    [GeneratedRegex(@"^[A-Za-z0-9][A-Za-z0-9._-]{0,80}\.zip$")]
    private static partial Regex NombreValido();

    public async Task<ManifiestoApp?> ManifiestoAsync(CancellationToken ct)
    {
        var ruta = Path.Combine(raiz, "version.json");
        if (!File.Exists(ruta)) return null;
        await using var s = File.OpenRead(ruta);
        var m = await JsonSerializer.DeserializeAsync<ManifiestoApp>(s, Json, ct);
        // un manifiesto que apunta a un paquete inexistente se ignora (publicación a medias)
        return m is not null && NombreValido().IsMatch(m.Archivo) && File.Exists(Path.Combine(raiz, m.Archivo)) ? m : null;
    }

    public Stream? AbrirPaquete(string archivo)
    {
        if (!NombreValido().IsMatch(archivo)) return null;
        var ruta = Path.Combine(raiz, archivo);
        return File.Exists(ruta) ? File.OpenRead(ruta) : null;
    }
}
