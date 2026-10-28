using System.Text.Json;
using Fiscalizacion.Application.Abstracciones;
using Fiscalizacion.Application.Dtos;
using Fiscalizacion.Application.Plantillas;
using Fiscalizacion.Domain.Entidades;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

namespace Fiscalizacion.Application.Pdf;

/// <summary>
/// Arma el <see cref="DocumentoPdf"/> de un registro (catálogos, firmas y fotos) y lo genera; para una versión,
/// además lo guarda y llena <see cref="FiscalizacionVersion.PdfRuta"/> (quien llama guarda los cambios).
/// </summary>
public class ComponedorPdf(IAppDbContext db, IGeneradorPdf generador, IAlmacenPdf almacen, IAlmacenFotos fotos, IReloj reloj,
    ILogger<ComponedorPdf>? log = null)
{
    private readonly ILogger log = log ?? NullLogger<ComponedorPdf>.Instance;

    /// <summary>El snapshot de la versión (FiscalizacionDto serializado al finalizar o corregir).</summary>
    public static FiscalizacionDto Snapshot(FiscalizacionVersion v) =>
        JsonSerializer.Deserialize<FiscalizacionDto>(v.SnapshotJson)
        ?? throw new InvalidOperationException($"La versión {v.Version} no tiene snapshot.");

    public static string NombreArchivo(string numero, int version) => $"Fiscalizacion-{Corto(numero)}-v{Math.Max(1, version)}.pdf";

    public static string NombreVistaPrevia(string numero) => $"Fiscalizacion-{Corto(numero)}-vista-previa.pdf";

    private static string Corto(string numero) => string.IsNullOrEmpty(numero) ? "borrador" : numero.Split('-')[0];

    public async Task<byte[]> GenerarAsync(FiscalizacionDto registro, int version, string? marcaAgua, CancellationToken ct)
    {
        var locacion = registro.Visita.LocacionId is { } l
            ? await db.Locaciones.AsNoTracking().Where(x => x.Id == l).Select(x => x.Nombre).FirstOrDefaultAsync(ct) : null;
        var suplidor = registro.Suplidor.Nombre ?? (registro.Suplidor.SuplidorId is { } s
            ? await db.Suplidores.AsNoTracking().Where(x => x.Id == s).Select(x => x.Nombre).FirstOrDefaultAsync(ct) : null);
        var producto = registro.Mediciones.ProductoId is { } pr
            ? await db.Productos.AsNoTracking().Where(x => x.Id == pr).Select(x => x.Nombre).FirstOrDefaultAsync(ct) : null;
        var encabezado = await db.Plantillas.AsNoTracking().Where(x => x.Id == PlantillaOficial.Id)
            .Select(x => new EncabezadoPlantillaDto(x.CodigoDocumento, x.VersionDocumento, x.FechaElaboracion, x.FechaAprobacion))
            .FirstOrDefaultAsync(ct);
        var preguntas = await db.ControlPreguntas.AsNoTracking().Where(p => p.Activa).OrderBy(p => p.Numero)
            .Select(p => new PreguntaControlDto(p.Numero, p.Texto, p.ObservacionObligatoriaSiSi, p.TipoObservacion))
            .ToListAsync(ct);

        // las firmas no cambian después de finalizar: la imagen se toma de la tabla
        var imagenes = await db.Firmas.AsNoTracking().Where(x => x.FiscalizacionId == registro.Id)
            .Select(x => new { x.Rol, x.Imagen }).ToListAsync(ct);
        var firmas = registro.Firmas.Select(x => new FirmaPdf(x.Rol, x.NombreFirmante, x.Cedula, x.FirmadoEn,
            imagenes.FirstOrDefault(i => i.Rol == x.Rol)?.Imagen)).ToList();

        var ids = registro.Fotos.Select(x => x.Id).ToList();
        var rutas = await db.Fotos.AsNoTracking().Where(x => ids.Contains(x.Id))
            .Select(x => new { x.Id, x.RutaArchivo }).ToListAsync(ct);
        var anexos = new List<FotoPdf>();
        foreach (var foto in registro.Fotos.OrderBy(x => x.Orden))
        {
            byte[]? bytes = null;
            if (rutas.FirstOrDefault(r => r.Id == foto.Id) is { } r && await fotos.AbrirAsync(r.RutaArchivo, ct) is { } stream)
            {
                await using (stream)
                {
                    using var buffer = new MemoryStream();
                    await stream.CopyToAsync(buffer, ct);
                    bytes = buffer.ToArray();
                }
            }
            anexos.Add(new FotoPdf(foto.Orden, foto.Descripcion, bytes));
        }

        return generador.Generar(new DocumentoPdf(registro, version, locacion, suplidor, preguntas, firmas, anexos,
            reloj.Ahora, marcaAgua, encabezado, producto));
    }

    /// <summary>Genera el PDF oficial de la versión desde su snapshot, lo guarda y deja la ruta en la versión.</summary>
    public async Task<byte[]> GenerarVersionAsync(FiscalizacionVersion v, CancellationToken ct)
    {
        var bytes = await GenerarAsync(Snapshot(v), v.Version, null, ct);
        v.PdfRuta = await almacen.GuardarAsync(v.FiscalizacionId, v.Version, bytes, ct);
        return bytes;
    }

    /// <summary>
    /// Al finalizar o corregir: si el PDF falla, el registro se guarda igual y el PDF se genera cuando se pida
    /// (<see cref="FiscalizacionVersion.PdfRuta"/> queda vacía).
    /// </summary>
    public async Task IntentarGenerarVersionAsync(FiscalizacionVersion v, CancellationToken ct)
    {
        try
        {
            await GenerarVersionAsync(v, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            v.PdfRuta = null;
            log.LogError(ex, "No se pudo generar el PDF de la versión {Version} de {FiscalizacionId}", v.Version, v.FiscalizacionId);
        }
    }

    /// <summary>PDF guardado de la versión; si falta (registros anteriores al PDF o archivo perdido) se regenera.</summary>
    public async Task<byte[]> ObtenerVersionAsync(FiscalizacionVersion v, CancellationToken ct)
    {
        if (v.PdfRuta is { } ruta && await almacen.LeerAsync(ruta, ct) is { } guardado) return guardado;
        var bytes = await GenerarVersionAsync(v, ct);
        await db.SaveChangesAsync(ct);
        return bytes;
    }
}
