using Fiscalizacion.Application.Abstracciones;
using Fiscalizacion.Domain.Entidades;
using Fiscalizacion.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using FiscalizacionEntidad = Fiscalizacion.Domain.Entidades.Fiscalizacion;

namespace Fiscalizacion.Infrastructure.Persistencia;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options), IAppDbContext
{
    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<Locacion> Locaciones => Set<Locacion>();
    public DbSet<Suplidor> Suplidores => Set<Suplidor>();
    public DbSet<Producto> Productos => Set<Producto>();
    public DbSet<ControlPregunta> ControlPreguntas => Set<ControlPregunta>();
    public DbSet<Plantilla> Plantillas => Set<Plantilla>();
    public DbSet<PlantillaVersion> PlantillaVersiones => Set<PlantillaVersion>();
    public DbSet<FiscalizacionEntidad> Fiscalizaciones => Set<FiscalizacionEntidad>();
    public DbSet<Foto> Fotos => Set<Foto>();
    public DbSet<Firma> Firmas => Set<Firma>();
    public DbSet<SolicitudFirma> SolicitudesFirma => Set<SolicitudFirma>();
    public DbSet<FiscalizacionVersion> FiscalizacionVersiones => Set<FiscalizacionVersion>();
    public DbSet<BitacoraApi> BitacoraApi => Set<BitacoraApi>();
    public DbSet<BitacoraCambio> BitacoraCambios => Set<BitacoraCambio>();
    public DbSet<BitacoraUi> BitacoraUi => Set<BitacoraUi>();
    public DbSet<LogTecnico> LogTecnico => Set<LogTecnico>();

    protected override void ConfigureConventions(ModelConfigurationBuilder b)
    {
        b.Properties<string>().HaveMaxLength(200);
        b.Properties<decimal>().HavePrecision(18, 2);
        b.Properties<DateTime>().HaveColumnType("datetime2(3)");
        foreach (var e in new[]
                 {
                     typeof(Rol), typeof(EstadoFiscalizacion), typeof(Equipo), typeof(RolFirma), typeof(ModoFirma),
                     typeof(EstadoSolicitud), typeof(TipoObservacion), typeof(TipoPlantilla), typeof(EstadoPlantilla),
                     typeof(TipoCampo), typeof(AccionCambio)
                 })
            b.Properties(e).HaveConversion<string>().HaveMaxLength(30);
    }

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.HasDefaultSchema("fis");
        mb.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
        DatosIniciales.Aplicar(mb);
    }
}
