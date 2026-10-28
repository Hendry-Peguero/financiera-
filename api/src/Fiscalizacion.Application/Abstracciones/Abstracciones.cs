using Fiscalizacion.Domain.Entidades;
using Microsoft.EntityFrameworkCore;
using FiscalizacionEntidad = Fiscalizacion.Domain.Entidades.Fiscalizacion;

namespace Fiscalizacion.Application.Abstracciones;

/// <summary>Usuario autenticado en la petición actual (identificado por correo).</summary>
public interface IUsuarioActual
{
    Guid? Id { get; }
    string? Correo { get; }
    string? Auth0Sub { get; }
    string? Nombre { get; }
    bool EsAdministrador { get; }
    bool EsPropietarioBitacora { get; }
}

public interface IReloj
{
    DateTime Ahora { get; }
}

public interface ICorrelacion
{
    string? Id { get; }
}

public interface IAlmacenFotos
{
    Task<string> GuardarAsync(Guid fiscalizacionId, Guid fotoId, Stream contenido, CancellationToken ct);
    Task<Stream?> AbrirAsync(string ruta, CancellationToken ct);
    Task EliminarAsync(string ruta, CancellationToken ct);
}

public interface IAppDbContext
{
    DbSet<Usuario> Usuarios { get; }
    DbSet<Locacion> Locaciones { get; }
    DbSet<Suplidor> Suplidores { get; }
    DbSet<Producto> Productos { get; }
    DbSet<ControlPregunta> ControlPreguntas { get; }
    DbSet<Plantilla> Plantillas { get; }
    DbSet<PlantillaVersion> PlantillaVersiones { get; }
    DbSet<FiscalizacionEntidad> Fiscalizaciones { get; }
    DbSet<Foto> Fotos { get; }
    DbSet<Firma> Firmas { get; }
    DbSet<SolicitudFirma> SolicitudesFirma { get; }
    DbSet<FiscalizacionVersion> FiscalizacionVersiones { get; }
    DbSet<BitacoraApi> BitacoraApi { get; }
    DbSet<BitacoraCambio> BitacoraCambios { get; }
    DbSet<BitacoraUi> BitacoraUi { get; }

    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
