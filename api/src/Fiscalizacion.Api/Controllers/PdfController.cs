using Fiscalizacion.Api.Seguridad;
using Fiscalizacion.Application.Pdf;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Fiscalizacion.Api.Controllers;

/// <summary>PDF oficial de la fiscalización: el de la versión vigente, el de una versión (Administrador) y la vista previa.</summary>
[ApiController, Authorize, Route("api/fiscalizaciones/{id:guid}")]
public class PdfController(ServicioPdf servicio) : ControllerBase
{
    private const string Tipo = "application/pdf";

    /// <summary>PDF de la versión vigente (409 si todavía es un borrador). Se regenera si no estaba guardado.</summary>
    [HttpGet("pdf")]
    public async Task<IActionResult> Vigente(Guid id, CancellationToken ct) => Archivo(await servicio.VigenteAsync(id, ct));

    /// <summary>PDF de una versión: solo el administrador, igual que las versiones.</summary>
    [HttpGet("versiones/{version:int}/pdf"), Authorize(Policy = Claims.PoliticaAdministrador)]
    public async Task<IActionResult> DeVersion(Guid id, int version, CancellationToken ct) =>
        Archivo(await servicio.VersionAsync(id, version, ct));

    /// <summary>PDF del estado actual sin guardarlo, con la marca «BORRADOR» (o «VISTA PREVIA» si ya está finalizado).</summary>
    [HttpGet("pdf/vista-previa")]
    public async Task<IActionResult> VistaPrevia(Guid id, CancellationToken ct) => Archivo(await servicio.VistaPreviaAsync(id, ct));

    private FileContentResult Archivo(ArchivoPdf pdf)
    {
        Response.Headers.CacheControl = "no-store";
        return File(pdf.Contenido, Tipo, pdf.Nombre);
    }
}
