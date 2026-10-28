using Fiscalizacion.Domain.Enums;

namespace Fiscalizacion.Application.Usuarios;

/// <summary>Fila de la pantalla «Usuarios» (Administración).</summary>
public record UsuarioAdminDto(Guid Id, string Correo, string NombreCompleto, string? Cargo, Rol Rol, bool Activo,
    bool TieneFirma, bool PerfilCompleto, bool PendienteIngreso, DateTime CreadoEn, DateTime? UltimoAcceso,
    int Registros, bool EsUsted);

/// <summary><c>estado</c>: <c>activos</c> | <c>inactivos</c> (sin valor: todos).</summary>
public record FiltroUsuarios(string? Texto, Rol? Rol, string? Estado, int Pagina = 1, int? Tamano = 20);

/// <summary>Conteos con claves <c>todos</c>, <c>activos</c>, <c>inactivos</c>, <c>pendientes</c>, <c>Administrador</c>, <c>Auditor</c>, <c>Firmante</c>.</summary>
public record ListaUsuariosDto(IReadOnlyList<UsuarioAdminDto> Items, int Total, int Pagina, int Tamano,
    IReadOnlyDictionary<string, int> Conteos);

public record CambiarRolDto(Rol Rol);

/// <summary>Registro anticipado: el usuario entra con ese correo por Auth0 y ya tiene el rol asignado.</summary>
public record NuevoUsuarioDto(string? Correo, Rol Rol, string? NombreCompleto);
