using Fiscalizacion.Application.Dtos;
using Fiscalizacion.Application.Fiscalizaciones;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Fiscalizacion.Api.Controllers;

/// <summary>Solicitudes de firma de un registro (crearlas: POST en <see cref="FiscalizacionesController"/>).</summary>
[ApiController, Authorize, Route("api/fiscalizaciones/{id:guid}/solicitudes-firma")]
public class SolicitudesFiscalizacionController(ServicioSolicitudesFiscalizacion servicio) : ControllerBase
{
    /// <summary>Todas las solicitudes del registro, la más reciente primero. Mismo permiso que ver el registro.</summary>
    [HttpGet]
    public Task<IReadOnlyList<SolicitudFirmaRegistroDto>> Listar(Guid id, CancellationToken ct) => servicio.ListarAsync(id, ct);
}
