using Fiscalizacion.Application.Abstracciones;
using Fiscalizacion.Application.Comun;
using Fiscalizacion.Application.Fiscalizaciones;
using Fiscalizacion.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Fiscalizacion.Application.Pdf;

/// <summary>Descarga del PDF oficial (vigente o de una versión) y vista previa al vuelo.</summary>
public class ServicioPdf(IAppDbContext db, IUsuarioActual usuario, ServicioFiscalizaciones fiscalizaciones, ComponedorPdf componedor)
{
    public const string MarcaBorrador = "BORRADOR";
    public const string MarcaVistaPrevia = "VISTA PREVIA";

    /// <summary>PDF de la versión vigente. Quien puede ver el registro puede descargarlo; un borrador no tiene PDF oficial.</summary>
    public async Task<ArchivoPdf> VigenteAsync(Guid id, CancellationToken ct)
    {
        var f = await fiscalizaciones.CargarAsync(id, ct);
        await fiscalizaciones.VerificarLecturaAsync(f, ct);
        if (f.Estado == EstadoFiscalizacion.Borrador || f.VersionActual < 1)
            throw new ConflictoException("El registro todavía no está finalizado: use la vista previa.");
        return await DeVersionAsync(id, f.Numero, f.VersionActual, ct);
    }

    /// <summary>PDF de cualquier versión: solo el administrador (misma regla que las versiones).</summary>
    public async Task<ArchivoPdf> VersionAsync(Guid id, int version, CancellationToken ct)
    {
        if (!usuario.EsAdministrador) throw new ProhibidoException("Solo el administrador ve versiones anteriores.");
        var numero = await db.Fiscalizaciones.Where(f => f.Id == id).Select(f => f.Numero).FirstOrDefaultAsync(ct)
                     ?? throw new NoEncontradoException("Fiscalización no encontrada.");
        return await DeVersionAsync(id, numero, version, ct);
    }

    /// <summary>
    /// PDF del estado actual, sin guardarlo: con la marca «BORRADOR» si es un borrador (o «VISTA PREVIA» si ya
    /// está finalizado, para que no se confunda con el oficial).
    /// </summary>
    public async Task<ArchivoPdf> VistaPreviaAsync(Guid id, CancellationToken ct)
    {
        var f = await fiscalizaciones.CargarAsync(id, ct);
        await fiscalizaciones.VerificarLecturaAsync(f, ct);
        var dto = Mapeo.ADto(f, await fiscalizaciones.PreguntasAsync(ct));
        var marca = f.Estado == EstadoFiscalizacion.Borrador ? MarcaBorrador : MarcaVistaPrevia;
        var bytes = await componedor.GenerarAsync(dto, f.VersionActual, marca, ct);
        return new ArchivoPdf(bytes, ComponedorPdf.NombreVistaPrevia(f.Numero));
    }

    private async Task<ArchivoPdf> DeVersionAsync(Guid id, string numero, int version, CancellationToken ct)
    {
        var v = await db.FiscalizacionVersiones.FirstOrDefaultAsync(x => x.FiscalizacionId == id && x.Version == version, ct)
                ?? throw new NoEncontradoException("Versión no encontrada.");
        return new ArchivoPdf(await componedor.ObtenerVersionAsync(v, ct), ComponedorPdf.NombreArchivo(numero, version));
    }
}
