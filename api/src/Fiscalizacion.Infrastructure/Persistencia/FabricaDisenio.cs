using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Fiscalizacion.Infrastructure.Persistencia;

/// <summary>Solo para `dotnet ef` (migraciones). La cadena real se toma de la variable FISCALIZACION_DB.</summary>
public class FabricaDisenio : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var cadena = Environment.GetEnvironmentVariable("FISCALIZACION_DB")
                     ?? "Server=localhost\\SQLEXPRESS;Database=Fiscalizacion;Trusted_Connection=True;TrustServerCertificate=True";
        var opciones = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(cadena, o => o.MigrationsHistoryTable("__EFMigrationsHistory", "fis"))
            .Options;
        return new AppDbContext(opciones);
    }
}
