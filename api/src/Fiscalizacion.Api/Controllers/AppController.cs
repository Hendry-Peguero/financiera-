using Fiscalizacion.Application.Actualizaciones;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Fiscalizacion.Api.Controllers;

/// <summary>
/// Actualización automática de la app Android: la app pregunta la última versión al abrir y descarga el paquete.
/// Anónimo: corre antes de iniciar sesión y el paquete es el mismo front que se sirve en la web.
/// </summary>
[ApiController, AllowAnonymous, Route("api/app")]
public class AppController(ServicioActualizaciones servicio) : ControllerBase
{
    /// <summary>200 con la última versión publicada; 204 si no hay ninguna.</summary>
    [HttpGet("version")]
    public async Task<IActionResult> Version(CancellationToken ct)
    {
        Response.Headers.CacheControl = "no-store";
        return await servicio.UltimaAsync(ct) is { } v ? Ok(v) : NoContent();
    }

    [HttpGet("paquetes/{archivo}")]
    public IActionResult Paquete(string archivo) =>
        servicio.Paquete(archivo) is { } s ? File(s, "application/zip", archivo) : NotFound();
}
