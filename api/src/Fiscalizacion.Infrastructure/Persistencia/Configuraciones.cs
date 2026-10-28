using Fiscalizacion.Domain.Entidades;
using Fiscalizacion.Domain.Reglas;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using FiscalizacionEntidad = Fiscalizacion.Domain.Entidades.Fiscalizacion;

namespace Fiscalizacion.Infrastructure.Persistencia;

internal static class Max
{
    public const string Texto = "nvarchar(max)";
}

internal class UsuarioConfig : IEntityTypeConfiguration<Usuario>
{
    public void Configure(EntityTypeBuilder<Usuario> b)
    {
        b.ToTable("Usuario");
        b.Property(x => x.Correo).HasMaxLength(256);
        b.HasIndex(x => x.Correo).IsUnique();
        b.HasIndex(x => x.Auth0Sub).IsUnique().HasFilter("[Auth0Sub] IS NOT NULL");
        b.Property(x => x.FirmaPredeterminada).HasColumnType("varbinary(max)");
        b.Ignore(x => x.PerfilCompleto);
    }
}

internal class LocacionConfig : IEntityTypeConfiguration<Locacion>
{
    public void Configure(EntityTypeBuilder<Locacion> b)
    {
        b.ToTable("Locacion");
        b.Property(x => x.Nombre).HasMaxLength(120);
        b.HasIndex(x => x.Nombre).IsUnique();
    }
}

internal class SuplidorConfig : IEntityTypeConfiguration<Suplidor>
{
    public void Configure(EntityTypeBuilder<Suplidor> b)
    {
        b.ToTable("Suplidor");
        b.Property(x => x.Nombre).HasMaxLength(150);
        b.Property(x => x.Rnc).HasMaxLength(20);
        b.HasIndex(x => x.Nombre).IsUnique();
    }
}

internal class ProductoConfig : IEntityTypeConfiguration<Producto>
{
    public void Configure(EntityTypeBuilder<Producto> b)
    {
        b.ToTable("Producto");
        b.Property(x => x.Nombre).HasMaxLength(120);
        b.Property(x => x.Unidad).HasMaxLength(10);
    }
}

internal class ControlPreguntaConfig : IEntityTypeConfiguration<ControlPregunta>
{
    public void Configure(EntityTypeBuilder<ControlPregunta> b)
    {
        b.ToTable("ControlPregunta");
        b.HasKey(x => x.Numero);
        b.Property(x => x.Numero).ValueGeneratedNever();
        b.Property(x => x.Texto).HasMaxLength(300);
    }
}

internal class PlantillaConfig : IEntityTypeConfiguration<Plantilla>
{
    public void Configure(EntityTypeBuilder<Plantilla> b)
    {
        b.ToTable("Plantilla");
        b.Property(x => x.Nombre).HasMaxLength(150);
        b.Property(x => x.CodigoDocumento).HasMaxLength(ReglasPlantillas.MaxCodigoDocumento);
        b.Property(x => x.VersionDocumento).HasMaxLength(ReglasPlantillas.MaxVersionDocumento);
        b.HasMany(x => x.Versiones).WithOne().HasForeignKey(x => x.PlantillaId);
    }
}

internal class PlantillaVersionConfig : IEntityTypeConfiguration<PlantillaVersion>
{
    public void Configure(EntityTypeBuilder<PlantillaVersion> b)
    {
        b.ToTable("PlantillaVersion");
        b.HasIndex(x => new { x.PlantillaId, x.Version }).IsUnique();
        b.Property(x => x.PdfBase).HasColumnType("varbinary(max)");
        b.HasMany(x => x.Campos).WithOne().HasForeignKey(x => x.PlantillaVersionId);
    }
}

internal class PlantillaCampoConfig : IEntityTypeConfiguration<PlantillaCampo>
{
    public void Configure(EntityTypeBuilder<PlantillaCampo> b)
    {
        b.ToTable("PlantillaCampo");
        b.Property(x => x.Identificador).HasMaxLength(80);
        b.Property(x => x.Formula).HasMaxLength(500);
        b.HasIndex(x => new { x.PlantillaVersionId, x.Identificador }).IsUnique();
        foreach (var p in new[] { nameof(PlantillaCampo.X), nameof(PlantillaCampo.Y), nameof(PlantillaCampo.Ancho), nameof(PlantillaCampo.Alto) })
            b.Property(p).HasPrecision(9, 2);
    }
}

internal class FiscalizacionConfig : IEntityTypeConfiguration<FiscalizacionEntidad>
{
    public void Configure(EntityTypeBuilder<FiscalizacionEntidad> b)
    {
        b.ToTable("Fiscalizacion");
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.Numero).HasMaxLength(9);
        b.HasIndex(x => x.Numero).IsUnique();
        b.HasIndex(x => x.Estado);
        b.HasIndex(x => x.EnPapelera);
        b.Property(x => x.RowVersion).IsRowVersion();
        b.Property(x => x.ObservacionesGenerales).HasColumnType(Max.Texto);
        b.Ignore(x => x.EsEditable);

        b.HasOne(x => x.Autor).WithMany().HasForeignKey(x => x.AutorId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Usuario>().WithMany().HasForeignKey(x => x.EliminadoPorId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<PlantillaVersion>().WithMany().HasForeignKey(x => x.PlantillaVersionId).OnDelete(DeleteBehavior.Restrict);

        b.OwnsOne(x => x.Visita, o =>
        {
            o.Property(v => v.Fecha).HasColumnName("Fecha");
            o.Property(v => v.HoraSalida).HasColumnName("HoraSalida").HasColumnType("time(0)");
            o.Property(v => v.InicioProceso).HasColumnName("InicioProceso").HasColumnType("time(0)");
            o.Property(v => v.LocacionId).HasColumnName("LocacionId");
            o.Property(v => v.HoraLlegada).HasColumnName("HoraLlegada").HasColumnType("time(0)");
            o.Property(v => v.FinProceso).HasColumnName("FinProceso").HasColumnType("time(0)");
            o.HasOne(v => v.Locacion).WithMany().HasForeignKey(v => v.LocacionId).OnDelete(DeleteBehavior.Restrict);
            o.HasIndex(v => v.Fecha);
        });
        b.Navigation(x => x.Visita).IsRequired();

        b.OwnsOne(x => x.Suplidor, o =>
        {
            o.Property(s => s.FichaCamion).HasColumnName("FichaCamion").HasMaxLength(30);
            o.Property(s => s.Chofer).HasColumnName("Chofer").HasMaxLength(120);
            o.Property(s => s.Placa).HasColumnName("Placa").HasMaxLength(20);
            o.Property(s => s.Conduce).HasColumnName("Conduce").HasMaxLength(40);
            o.Property(s => s.Nombre).HasColumnName("NombreSuplidor").HasMaxLength(150);
            o.Property(s => s.SuplidorId).HasColumnName("SuplidorId");
            o.Property(s => s.TotalEntregarGal).HasColumnName("TotalEntregarGal");
            o.HasOne(s => s.Suplidor).WithMany().HasForeignKey(s => s.SuplidorId).OnDelete(DeleteBehavior.Restrict);
        });
        b.Navigation(x => x.Suplidor).IsRequired();

        b.OwnsOne(x => x.Empresa, o =>
        {
            o.Property(e => e.FichaCamion1).HasColumnName("FichaCamionEmpresa").HasMaxLength(30);
            o.Property(e => e.Chofer1).HasColumnName("ChoferEmpresa").HasMaxLength(120);
            o.Property(e => e.FichaCamion2).HasColumnName("FichaCamion2").HasMaxLength(30);
            o.Property(e => e.Chofer2).HasColumnName("Chofer2").HasMaxLength(120);
            o.Property(e => e.Responsable).HasColumnName("Responsable").HasMaxLength(120);
            o.Property(e => e.TotalRecibirGal).HasColumnName("TotalRecibirGal");
        });
        b.Navigation(x => x.Empresa).IsRequired();

        b.OwnsOne(x => x.Mediciones, o =>
        {
            o.Property(m => m.ProductoId).HasColumnName("ProductoId");
            o.Property(m => m.GalonesProveedor).HasColumnName("GalonesProveedor");
            o.Property(m => m.GalonesEgehid).HasColumnName("GalonesEgehid");
            o.Property(m => m.PrecioGalon).HasColumnName("PrecioGalon").HasPrecision(18, 4);
            o.Property(m => m.VaraInicialMedida).HasColumnName("VaraInicialMedida").HasMaxLength(30);
            o.Property(m => m.VaraInicialGalones).HasColumnName("VaraInicialGalones");
            o.Property(m => m.VaraFinalMedida).HasColumnName("VaraFinalMedida").HasMaxLength(30);
            o.Property(m => m.VaraFinalGalones).HasColumnName("VaraFinalGalones");
            o.HasOne(m => m.Producto).WithMany().HasForeignKey(m => m.ProductoId).OnDelete(DeleteBehavior.Restrict);
        });
        b.Navigation(x => x.Mediciones).IsRequired();

        b.HasMany(x => x.Lecturas).WithOne().HasForeignKey(x => x.FiscalizacionId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Controles).WithOne().HasForeignKey(x => x.FiscalizacionId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Fotos).WithOne().HasForeignKey(x => x.FiscalizacionId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Firmas).WithOne().HasForeignKey(x => x.FiscalizacionId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Solicitudes).WithOne(x => x.Fiscalizacion).HasForeignKey(x => x.FiscalizacionId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Versiones).WithOne().HasForeignKey(x => x.FiscalizacionId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal class LecturaEquipoConfig : IEntityTypeConfiguration<LecturaEquipo>
{
    public void Configure(EntityTypeBuilder<LecturaEquipo> b)
    {
        b.ToTable("LecturaEquipo");
        b.HasKey(x => new { x.FiscalizacionId, x.Equipo });
        b.Ignore(x => x.Diferencia);
    }
}

internal class RespuestaControlConfig : IEntityTypeConfiguration<RespuestaControl>
{
    public void Configure(EntityTypeBuilder<RespuestaControl> b)
    {
        b.ToTable("RespuestaControl");
        b.HasKey(x => new { x.FiscalizacionId, x.PreguntaNumero });
        b.Property(x => x.Observacion).HasMaxLength(500);
        b.HasOne<ControlPregunta>().WithMany().HasForeignKey(x => x.PreguntaNumero).OnDelete(DeleteBehavior.Restrict);
    }
}

internal class FotoConfig : IEntityTypeConfiguration<Foto>
{
    public void Configure(EntityTypeBuilder<Foto> b)
    {
        b.ToTable("Foto");
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.Descripcion).HasMaxLength(300);
        b.Property(x => x.RutaArchivo).HasMaxLength(400);
        b.Property(x => x.ContentType).HasMaxLength(50);
        b.Property(x => x.Sha256).HasMaxLength(64);
        b.HasIndex(x => new { x.FiscalizacionId, x.Orden });
    }
}

internal class FirmaConfig : IEntityTypeConfiguration<Firma>
{
    public void Configure(EntityTypeBuilder<Firma> b)
    {
        b.ToTable("Firma");
        b.HasKey(x => new { x.FiscalizacionId, x.Rol });
        b.Property(x => x.NombreFirmante).HasMaxLength(150);
        b.Property(x => x.Cedula).HasMaxLength(20);
        b.Property(x => x.Imagen).HasColumnType("varbinary(max)");
        b.Property(x => x.Sha256).HasMaxLength(64);
        b.HasOne<Usuario>().WithMany().HasForeignKey(x => x.UsuarioId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal class SolicitudFirmaConfig : IEntityTypeConfiguration<SolicitudFirma>
{
    public void Configure(EntityTypeBuilder<SolicitudFirma> b)
    {
        b.ToTable("SolicitudFirma");
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.Comentario).HasMaxLength(500);
        b.HasOne(x => x.UsuarioDestino).WithMany().HasForeignKey(x => x.UsuarioDestinoId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.SolicitadaPor).WithMany().HasForeignKey(x => x.SolicitadaPorId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.UsuarioDestinoId, x.Estado });
    }
}

internal class FiscalizacionVersionConfig : IEntityTypeConfiguration<FiscalizacionVersion>
{
    public void Configure(EntityTypeBuilder<FiscalizacionVersion> b)
    {
        b.ToTable("FiscalizacionVersion");
        b.Property(x => x.Id).ValueGeneratedNever();
        b.HasIndex(x => new { x.FiscalizacionId, x.Version }).IsUnique();
        b.Property(x => x.SnapshotJson).HasColumnType(Max.Texto);
        b.Property(x => x.PdfRuta).HasMaxLength(400);
        b.Property(x => x.Resumen).HasMaxLength(500);
        b.HasOne(x => x.CreadoPor).WithMany().HasForeignKey(x => x.CreadoPorId).OnDelete(DeleteBehavior.Restrict);
        b.HasMany(x => x.Cambios).WithOne().HasForeignKey(x => x.VersionId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal class CambioCampoConfig : IEntityTypeConfiguration<CambioCampo>
{
    public void Configure(EntityTypeBuilder<CambioCampo> b)
    {
        b.ToTable("CambioCampo");
        b.Property(x => x.Campo).HasMaxLength(150);
        b.Property(x => x.ValorAnterior).HasColumnType(Max.Texto);
        b.Property(x => x.ValorNuevo).HasColumnType(Max.Texto);
    }
}

internal class BitacoraApiConfig : IEntityTypeConfiguration<BitacoraApi>
{
    public void Configure(EntityTypeBuilder<BitacoraApi> b)
    {
        b.ToTable("BitacoraApi", "bit");
        b.Property(x => x.Correo).HasMaxLength(256);
        b.Property(x => x.Metodo).HasMaxLength(10);
        b.Property(x => x.Ruta).HasMaxLength(400);
        b.Property(x => x.Query).HasMaxLength(1000);
        b.Property(x => x.Ip).HasMaxLength(45);
        b.Property(x => x.UserAgent).HasMaxLength(400);
        b.Property(x => x.CorrelationId).HasMaxLength(64);
        b.HasIndex(x => x.Momento);
        b.HasIndex(x => x.UsuarioId);
    }
}

internal class BitacoraCambioConfig : IEntityTypeConfiguration<BitacoraCambio>
{
    public void Configure(EntityTypeBuilder<BitacoraCambio> b)
    {
        b.ToTable("BitacoraCambio", "bit");
        b.Property(x => x.Correo).HasMaxLength(256);
        b.Property(x => x.Entidad).HasMaxLength(100);
        b.Property(x => x.EntidadId).HasMaxLength(100);
        b.Property(x => x.ValoresAnteriores).HasColumnType(Max.Texto);
        b.Property(x => x.ValoresNuevos).HasColumnType(Max.Texto);
        b.Property(x => x.CorrelationId).HasMaxLength(64);
        b.HasIndex(x => x.Momento);
        b.HasIndex(x => new { x.Entidad, x.EntidadId });
    }
}

internal class BitacoraUiConfig : IEntityTypeConfiguration<BitacoraUi>
{
    public void Configure(EntityTypeBuilder<BitacoraUi> b)
    {
        b.ToTable("BitacoraUi", "bit");
        b.HasIndex(x => x.IdCliente).IsUnique();
        b.Property(x => x.Correo).HasMaxLength(256);
        b.Property(x => x.Tipo).HasMaxLength(20);
        b.Property(x => x.Ruta).HasMaxLength(400);
        b.Property(x => x.Elemento).HasMaxLength(300);
        b.Property(x => x.Detalle).HasColumnType(Max.Texto);
        b.Property(x => x.Dispositivo).HasMaxLength(200);
        b.HasIndex(x => x.Momento);
        b.HasIndex(x => new { x.UsuarioId, x.Momento });
    }
}

internal class LogTecnicoConfig : IEntityTypeConfiguration<LogTecnico>
{
    public void Configure(EntityTypeBuilder<LogTecnico> b)
    {
        b.ToTable("LogTecnico", "bit");
        b.Property(x => x.Level).HasMaxLength(16);
        b.Property(x => x.Message).HasColumnType(Max.Texto);
        b.Property(x => x.MessageTemplate).HasColumnType(Max.Texto);
        b.Property(x => x.Exception).HasColumnType(Max.Texto);
        b.Property(x => x.LogEvent).HasColumnType(Max.Texto);
        b.HasIndex(x => x.TimeStamp);
    }
}
