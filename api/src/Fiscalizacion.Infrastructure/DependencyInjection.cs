using Fiscalizacion.Application.Abstracciones;
using Fiscalizacion.Application.Pdf;
using Fiscalizacion.Application.Plantillas;
using Fiscalizacion.Infrastructure.Pdf;
using Fiscalizacion.Infrastructure.Persistencia;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Fiscalizacion.Infrastructure;

public class RelojSistema : IReloj
{
    public DateTime Ahora => DateTime.UtcNow;
}

/// <summary>Fotos en disco: {raíz}/{fiscalización}/{foto}.bin. La ruta guardada es relativa a la raíz.</summary>
public class AlmacenFotosDisco(string raiz) : IAlmacenFotos
{
    public async Task<string> GuardarAsync(Guid fiscalizacionId, Guid fotoId, Stream contenido, CancellationToken ct)
    {
        var relativa = Path.Combine(fiscalizacionId.ToString("N"), fotoId.ToString("N") + ".bin");
        var completa = Path.Combine(raiz, relativa);
        Directory.CreateDirectory(Path.GetDirectoryName(completa)!);
        await using var archivo = File.Create(completa);
        await contenido.CopyToAsync(archivo, ct);
        return relativa;
    }

    public Task<Stream?> AbrirAsync(string ruta, CancellationToken ct)
    {
        var completa = Completa(ruta);
        return Task.FromResult<Stream?>(File.Exists(completa) ? File.OpenRead(completa) : null);
    }

    public Task EliminarAsync(string ruta, CancellationToken ct)
    {
        var completa = Completa(ruta);
        if (File.Exists(completa)) File.Delete(completa);
        return Task.CompletedTask;
    }

    private string Completa(string ruta)
    {
        var completa = Path.GetFullPath(Path.Combine(raiz, ruta));
        if (!completa.StartsWith(Path.GetFullPath(raiz), StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Ruta de foto inválida.");
        return completa;
    }
}

public static class DependencyInjection
{
    public static IServiceCollection AddInfraestructura(this IServiceCollection s, IConfiguration config)
    {
        var cadena = config.GetConnectionString("Fiscalizacion")
                     ?? throw new InvalidOperationException("Falta ConnectionStrings:Fiscalizacion.");
        s.AddScoped<InterceptorBitacora>();
        s.AddDbContext<AppDbContext>((sp, o) => o
            .UseSqlServer(cadena, sql => sql.MigrationsHistoryTable("__EFMigrationsHistory", "fis")
                .UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)
                .EnableRetryOnFailure())
            .AddInterceptors(sp.GetRequiredService<InterceptorBitacora>()));
        s.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());
        s.AddSingleton<IReloj, RelojSistema>();
        var raizFotos = config["Fotos:Ruta"] ?? Path.Combine(AppContext.BaseDirectory, "App_Data", "fotos");
        s.AddSingleton<IAlmacenFotos>(new AlmacenFotosDisco(raizFotos));
        s.AddSingleton<ILectorPdf, LectorPdf>();
        var raizPdf = config["Pdf:Ruta"] is { Length: > 0 } r ? r : Path.Combine(AppContext.BaseDirectory, "App_Data", "pdf");
        s.AddSingleton<IAlmacenPdf>(new AlmacenPdfDisco(raizPdf));
        s.AddSingleton<IGeneradorPdf, GeneradorPdf>();
        var raizApp = config["App:Ruta"] is { Length: > 0 } ra ? ra : Path.Combine(AppContext.BaseDirectory, "App_Data", "app");
        s.AddSingleton<Application.Actualizaciones.IAlmacenActualizaciones>(new AlmacenActualizacionesDisco(raizApp));
        return s;
    }
}
