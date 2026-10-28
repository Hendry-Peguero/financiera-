using Fiscalizacion.Application.Abstracciones;
using Fiscalizacion.Application.Comun;
using Fiscalizacion.Application.Dtos;
using Fiscalizacion.Application.Fiscalizaciones;
using Fiscalizacion.Domain.Entidades;
using Fiscalizacion.Domain.Enums;
using Fiscalizacion.Domain.Reglas;
using Microsoft.EntityFrameworkCore;

namespace Fiscalizacion.Application.Usuarios;

public class ServicioUsuarios(IAppDbContext db, IUsuarioActual usuario, IReloj reloj)
{
    /// <summary>
    /// Busca al usuario por correo y lo crea en su primer ingreso (el primero del sistema es Administrador).
    /// No hay usuarios de dominio: la identidad es el correo verificado por Auth0.
    /// </summary>
    public async Task<Usuario> AsegurarAsync(string correo, string? auth0Sub, string? nombre, CancellationToken ct)
    {
        correo = correo.Trim().ToLowerInvariant();
        var u = await db.Usuarios.FirstOrDefaultAsync(x => x.Correo == correo, ct);
        if (u is null)
        {
            u = new Usuario
            {
                Id = Guid.NewGuid(), Correo = correo, Auth0Sub = auth0Sub,
                NombreCompleto = Texto.Limpiar(nombre, 200) ?? "",
                Rol = await db.Usuarios.AnyAsync(ct) ? Rol.Auditor : Rol.Administrador,
                CreadoEn = reloj.Ahora, UltimoAcceso = reloj.Ahora
            };
            db.Usuarios.Add(u);
            await db.SaveChangesAsync(ct);
            return u;
        }

        var cambios = false;
        if (auth0Sub is not null && u.Auth0Sub != auth0Sub) { u.Auth0Sub = auth0Sub; cambios = true; }
        // Último acceso con resolución de 15 min para no escribir en cada petición.
        if (u.UltimoAcceso is null || reloj.Ahora - u.UltimoAcceso > TimeSpan.FromMinutes(15)) { u.UltimoAcceso = reloj.Ahora; cambios = true; }
        if (cambios) await db.SaveChangesAsync(ct);
        return u;
    }

    public async Task<UsuarioDto> MeAsync(CancellationToken ct) => ADto(await YoAsync(ct));

    public async Task<UsuarioDto> ActualizarPerfilAsync(PerfilDto dto, CancellationToken ct)
    {
        var u = await YoAsync(ct);
        u.NombreCompleto = Texto.Limpiar(dto.NombreCompleto, 200) ?? throw new ReglaNegocioException("Falta el nombre completo.");
        u.Cargo = Texto.Limpiar(dto.Cargo, 200);
        await db.SaveChangesAsync(ct);
        return ADto(u);
    }

    public async Task GuardarFirmaAsync(ImagenDto dto, CancellationToken ct)
    {
        var u = await YoAsync(ct);
        u.FirmaPredeterminada = Imagenes.DesdeBase64(dto.ImagenBase64, Imagenes.MaxFirmaBytes);
        await db.SaveChangesAsync(ct);
    }

    public async Task<ImagenDto?> ObtenerFirmaAsync(CancellationToken ct)
    {
        var u = await YoAsync(ct);
        return u.FirmaPredeterminada is { } f ? new ImagenDto(Convert.ToBase64String(f)) : null;
    }

    public async Task<IReadOnlyList<UsuarioBusquedaDto>> BuscarAsync(string? texto, CancellationToken ct)
    {
        var q = db.Usuarios.AsNoTracking().Where(u => u.Activo);
        if (!string.IsNullOrWhiteSpace(texto))
        {
            var t = texto.Trim();
            q = q.Where(u => u.NombreCompleto.Contains(t) || u.Correo.Contains(t));
        }
        return await q.OrderBy(u => u.NombreCompleto).Take(20)
            .Select(u => new UsuarioBusquedaDto(u.Id, u.NombreCompleto, u.Cargo, u.FirmaPredeterminada != null))
            .ToListAsync(ct);
    }

    private async Task<Usuario> YoAsync(CancellationToken ct) =>
        await db.Usuarios.FirstOrDefaultAsync(u => u.Id == usuario.Id, ct) ?? throw new NoEncontradoException("Usuario no encontrado.");

    private UsuarioDto ADto(Usuario u) => new(u.Id, u.Correo, u.NombreCompleto, u.Cargo, u.Rol,
        u.FirmaPredeterminada is not null, usuario.EsPropietarioBitacora, u.PerfilCompleto);
}

public class ServicioCatalogos(IAppDbContext db)
{
    public async Task<CatalogosDto> ObtenerAsync(CancellationToken ct) => new(
        await db.Locaciones.AsNoTracking().Where(x => x.Activa).OrderBy(x => x.Nombre)
            .Select(x => new LocacionDto(x.Id, x.Nombre, x.Provincia)).ToListAsync(ct),
        await db.Suplidores.AsNoTracking().Where(x => x.Activo).OrderBy(x => x.Nombre)
            .Select(x => new SuplidorDto(x.Id, x.Nombre)).ToListAsync(ct),
        await db.Productos.AsNoTracking().OrderBy(x => x.Nombre)
            .Select(x => new ProductoDto(x.Id, x.Nombre, x.Unidad)).ToListAsync(ct),
        await db.ControlPreguntas.AsNoTracking().Where(x => x.Activa).OrderBy(x => x.Numero)
            .Select(x => new PreguntaControlDto(x.Numero, x.Texto, x.ObservacionObligatoriaSiSi, x.TipoObservacion)).ToListAsync(ct));
}
