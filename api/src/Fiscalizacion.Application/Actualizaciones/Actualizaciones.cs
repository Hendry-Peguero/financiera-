namespace Fiscalizacion.Application.Actualizaciones;

/// <summary>
/// Versión publicada de la app (el paquete web que la app Android descarga y aplica sola). La escribe
/// web/scripts/publicar-actualizacion.ps1 en <c>App:Ruta</c>/version.json junto al .zip.
/// </summary>
/// <param name="Version">Versión del paquete web (semver, la de web/package.json).</param>
/// <param name="Archivo">Nombre del .zip (index.html en la raíz del zip).</param>
/// <param name="Sha256">Huella del .zip (hex en minúsculas): la app la verifica antes de aplicarlo.</param>
/// <param name="NativaMinima">Versión mínima del APK instalado (versionCode); si el APK es más viejo, hay que reinstalarlo.</param>
public record ManifiestoApp(string Version, string Archivo, string Sha256, string? Notas, DateTime PublicadaEn, int NativaMinima = 1);

/// <summary>Respuesta de GET /api/app/version. <c>Ruta</c> es relativa a la API (p. ej. /app/paquetes/1.2.0.zip).</summary>
public record VersionAppDto(string Version, string Ruta, string Sha256, string? Notas, DateTime PublicadaEn, int NativaMinima);

/// <summary>Dónde están el manifiesto y los paquetes (disco en Infrastructure).</summary>
public interface IAlmacenActualizaciones
{
    Task<ManifiestoApp?> ManifiestoAsync(CancellationToken ct);
    /// <summary>null si el archivo no existe o el nombre no es válido.</summary>
    Stream? AbrirPaquete(string archivo);
}

public class ServicioActualizaciones(IAlmacenActualizaciones almacen)
{
    public async Task<VersionAppDto?> UltimaAsync(CancellationToken ct) =>
        await almacen.ManifiestoAsync(ct) is { } m
            ? new VersionAppDto(m.Version, $"/app/paquetes/{m.Archivo}", m.Sha256, m.Notas, m.PublicadaEn, m.NativaMinima)
            : null;

    public Stream? Paquete(string archivo) => almacen.AbrirPaquete(archivo);
}
