using System.Text.RegularExpressions;
using Fiscalizacion.Domain.Entidades;
using Fiscalizacion.Domain.Enums;

namespace Fiscalizacion.Domain.Reglas;

/// <summary>
/// Gestión de usuarios (solo Administrador): cambiar el rol, activar / desactivar y registrar un correo por adelantado.
/// Un administrador no se quita a sí mismo el rol ni se desactiva, y siempre queda al menos un administrador activo.
/// </summary>
public static partial class ReglasUsuarios
{
    public const int MaxCorreo = 256;

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex PatronCorreo();

    /// <summary>Correo normalizado (sin espacios, en minúsculas) o null si no es válido.</summary>
    public static string? NormalizarCorreo(string? correo)
    {
        var c = correo?.Trim().ToLowerInvariant();
        return string.IsNullOrEmpty(c) || c.Length > MaxCorreo || !PatronCorreo().IsMatch(c) ? null : c;
    }

    /// <summary>
    /// Valida dejar a <paramref name="objetivo"/> con <paramref name="rol"/> y <paramref name="activo"/>.
    /// <paramref name="administradoresActivos"/> cuenta a todos los administradores activos (incluido el objetivo si lo es).
    /// Devuelve el motivo del rechazo o null si se permite.
    /// </summary>
    public static string? ValidarCambio(Guid actorId, Usuario objetivo, Rol rol, bool activo, int administradoresActivos)
    {
        if (objetivo.Id == actorId)
        {
            if (!activo) return "No puede desactivar su propia cuenta.";
            if (objetivo.Rol == Rol.Administrador && rol != Rol.Administrador)
                return "No puede quitarse a sí mismo el rol de Administrador.";
        }

        var eraAdministradorActivo = objetivo.Activo && objetivo.Rol == Rol.Administrador;
        var sigueSiendolo = activo && rol == Rol.Administrador;
        if (eraAdministradorActivo && !sigueSiendolo && administradoresActivos <= 1)
            return "Debe quedar al menos un administrador activo.";
        return null;
    }

    /// <summary>Registrado por un administrador y todavía no ha entrado (sin Auth0Sub ni último acceso).</summary>
    public static bool PendienteIngreso(Usuario u) => u.Auth0Sub is null && u.UltimoAcceso is null;
}
