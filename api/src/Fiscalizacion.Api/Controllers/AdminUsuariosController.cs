using Fiscalizacion.Api.Seguridad;
using Fiscalizacion.Application.Usuarios;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Fiscalizacion.Api.Controllers;

/// <summary>Gestión de usuarios: solo Administrador (403 para los demás; el servicio vuelve a verificarlo).</summary>
[ApiController, Authorize(Policy = Claims.PoliticaAdministrador), Route("api/admin/usuarios")]
public class AdminUsuariosController(ServicioAdminUsuarios servicio) : ControllerBase
{
    [HttpGet]
    public Task<ListaUsuariosDto> Listar([FromQuery] FiltroUsuarios filtro, CancellationToken ct) => servicio.ListarAsync(filtro, ct);

    [HttpPost]
    public Task<UsuarioAdminDto> Registrar(NuevoUsuarioDto dto, CancellationToken ct) => servicio.RegistrarAsync(dto, ct);

    [HttpPut("{id:guid}/rol")]
    public Task<UsuarioAdminDto> CambiarRol(Guid id, CambiarRolDto dto, CancellationToken ct) => servicio.CambiarRolAsync(id, dto, ct);

    [HttpPost("{id:guid}/activar")]
    public Task<UsuarioAdminDto> Activar(Guid id, CancellationToken ct) => servicio.ActivarAsync(id, ct);

    [HttpPost("{id:guid}/desactivar")]
    public Task<UsuarioAdminDto> Desactivar(Guid id, CancellationToken ct) => servicio.DesactivarAsync(id, ct);
}
