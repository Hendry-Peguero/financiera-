using Fiscalizacion.Application.Abstracciones;
using Fiscalizacion.Application.Comun;
using Fiscalizacion.Domain.Entidades;
using Fiscalizacion.Domain.Enums;
using Fiscalizacion.Domain.Reglas;
using Microsoft.EntityFrameworkCore;

namespace Fiscalizacion.Application.Usuarios;

/// <summary>
/// Gestión de usuarios (solo Administrador): lista con filtros, cambio de rol, activar / desactivar y registro anticipado
/// por correo. Los cambios quedan en bit.BitacoraCambio por el interceptor de EF (entidad «Usuario»).
/// Un usuario desactivado recibe 403 en toda la API (MiddlewareUsuario).
/// </summary>
public class ServicioAdminUsuarios(IAppDbContext db, IUsuarioActual usuario, IReloj reloj)
{
    public async Task<ListaUsuariosDto> ListarAsync(FiltroUsuarios filtro, CancellationToken ct)
    {
        VerificarAdministrador();
        var q = db.Usuarios.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(filtro.Texto))
        {
            var t = filtro.Texto.Trim();
            q = q.Where(u => u.NombreCompleto.Contains(t) || u.Correo.Contains(t) || (u.Cargo != null && u.Cargo.Contains(t)));
        }
        if (filtro.Rol is { } rol) q = q.Where(u => u.Rol == rol);

        // Conteos con texto y rol aplicados, antes del estado (las pestañas muestran cuántos hay en cada una).
        var porEstado = await q.GroupBy(u => u.Activo).Select(g => new { g.Key, Total = g.Count() }).ToListAsync(ct);
        var porRol = await db.Usuarios.AsNoTracking().GroupBy(u => u.Rol).Select(g => new { g.Key, Total = g.Count() }).ToListAsync(ct);
        var conteos = Enum.GetValues<Rol>().ToDictionary(r => r.ToString(), r => porRol.FirstOrDefault(x => x.Key == r)?.Total ?? 0);
        conteos["activos"] = porEstado.FirstOrDefault(x => x.Key)?.Total ?? 0;
        conteos["inactivos"] = porEstado.FirstOrDefault(x => !x.Key)?.Total ?? 0;
        conteos["todos"] = conteos["activos"] + conteos["inactivos"];
        conteos["pendientes"] = await q.CountAsync(u => u.Auth0Sub == null && u.UltimoAcceso == null, ct);

        q = filtro.Estado?.Trim().ToLowerInvariant() switch
        {
            "activos" => q.Where(u => u.Activo),
            "inactivos" => q.Where(u => !u.Activo),
            _ => q
        };

        var tamano = Paginado<object>.Normalizar(filtro.Tamano);
        var pagina = Math.Max(1, filtro.Pagina);
        var total = await q.CountAsync(ct);
        var filas = await q
            .OrderByDescending(u => u.Activo).ThenBy(u => u.NombreCompleto == "").ThenBy(u => u.NombreCompleto).ThenBy(u => u.Correo)
            .Skip((pagina - 1) * tamano).Take(tamano)
            .Select(u => new
            {
                Usuario = u,
                TieneFirma = u.FirmaPredeterminada != null,
                Registros = db.Fiscalizaciones.Count(f => f.AutorId == u.Id && !f.EnPapelera)
            })
            .ToListAsync(ct);
        var items = filas.Select(f => ADto(f.Usuario, f.TieneFirma, f.Registros)).ToList();
        return new ListaUsuariosDto(items, total, pagina, tamano, conteos);
    }

    public async Task<UsuarioAdminDto> RegistrarAsync(NuevoUsuarioDto dto, CancellationToken ct)
    {
        VerificarAdministrador();
        var correo = ReglasUsuarios.NormalizarCorreo(dto.Correo)
                     ?? throw Error("correo", "Escriba un correo válido (nombre@dominio).");
        if (!Enum.IsDefined(dto.Rol)) throw Error("rol", "Rol no válido.");
        if (await db.Usuarios.AnyAsync(u => u.Correo == correo, ct))
            throw Error("correo", "Ya existe un usuario con ese correo.");

        var u = new Usuario
        {
            Id = Guid.NewGuid(), Correo = correo, Rol = dto.Rol, Activo = true,
            NombreCompleto = Texto.Limpiar(dto.NombreCompleto, 200) ?? "",
            CreadoEn = reloj.Ahora
        };
        db.Usuarios.Add(u);
        await db.SaveChangesAsync(ct);
        return ADto(u, false, 0);
    }

    public Task<UsuarioAdminDto> CambiarRolAsync(Guid id, CambiarRolDto dto, CancellationToken ct)
    {
        if (!Enum.IsDefined(dto.Rol)) throw Error("rol", "Rol no válido.");
        return AplicarAsync(id, u => (dto.Rol, u.Activo), ct);
    }

    public Task<UsuarioAdminDto> ActivarAsync(Guid id, CancellationToken ct) => AplicarAsync(id, u => (u.Rol, true), ct);

    public Task<UsuarioAdminDto> DesactivarAsync(Guid id, CancellationToken ct) => AplicarAsync(id, u => (u.Rol, false), ct);

    private async Task<UsuarioAdminDto> AplicarAsync(Guid id, Func<Usuario, (Rol Rol, bool Activo)> cambio, CancellationToken ct)
    {
        VerificarAdministrador();
        var u = await db.Usuarios.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NoEncontradoException("Usuario no encontrado.");
        var (rol, activo) = cambio(u);
        if (rol != u.Rol || activo != u.Activo)
        {
            var administradores = await db.Usuarios.CountAsync(x => x.Activo && x.Rol == Rol.Administrador, ct);
            if (ReglasUsuarios.ValidarCambio(usuario.Id ?? Guid.Empty, u, rol, activo, administradores) is { } motivo)
                throw new ReglaNegocioException(motivo);
            u.Rol = rol;
            u.Activo = activo;
            await db.SaveChangesAsync(ct);
        }
        var registros = await db.Fiscalizaciones.CountAsync(f => f.AutorId == u.Id && !f.EnPapelera, ct);
        return ADto(u, u.FirmaPredeterminada is not null, registros);
    }

    private UsuarioAdminDto ADto(Usuario u, bool tieneFirma, int registros) => new(u.Id, u.Correo, u.NombreCompleto, u.Cargo,
        u.Rol, u.Activo, tieneFirma, u.PerfilCompleto, ReglasUsuarios.PendienteIngreso(u), u.CreadoEn, u.UltimoAcceso,
        registros, u.Id == usuario.Id);

    private static ValidacionException Error(string campo, string mensaje) => new(new Dictionary<string, string[]> { [campo] = [mensaje] });

    private void VerificarAdministrador()
    {
        if (!usuario.EsAdministrador) throw new ProhibidoException("Solo el administrador gestiona los usuarios.");
    }
}
