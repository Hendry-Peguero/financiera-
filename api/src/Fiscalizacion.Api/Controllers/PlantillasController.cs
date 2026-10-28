using Fiscalizacion.Api.Seguridad;
using Fiscalizacion.Application.Plantillas;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Fiscalizacion.Api.Controllers;

/// <summary>Plantillas de formularios (fase 3). Leer: cualquier usuario autenticado (solo publicadas); gestionar: Administrador.</summary>
[ApiController, Authorize, Route("api/plantillas")]
public class PlantillasController(ServicioPlantillas servicio) : ControllerBase
{
    // el PDF admite 4 MB; el límite de la petición deja margen para el multipart
    private const long LimitePeticion = 5 * 1024 * 1024;

    [HttpGet] public Task<IReadOnlyList<PlantillaResumenDto>> Listar(CancellationToken ct) => servicio.ListarAsync(ct);

    [HttpGet("{id:int}")]
    public Task<PlantillaDto> Obtener(int id, [FromQuery] int? version, CancellationToken ct) => servicio.ObtenerAsync(id, version, ct);

    [HttpGet("{id:int}/versiones/{version:int}/pdf")]
    public async Task<IActionResult> Pdf(int id, int version, CancellationToken ct) =>
        File(await servicio.PdfAsync(id, version, ct), "application/pdf");

    [HttpPost, Authorize(Policy = Claims.PoliticaAdministrador)]
    public Task<PlantillaDto> Crear(NuevaPlantillaDto dto, CancellationToken ct) => servicio.CrearAsync(dto, ct);

    [HttpPost("importar"), Authorize(Policy = Claims.PoliticaAdministrador), RequestSizeLimit(LimitePeticion)]
    public async Task<PlantillaDto> Importar(IFormFile archivo, [FromForm] string? nombre, CancellationToken ct)
    {
        await using var stream = archivo.OpenReadStream();
        return await servicio.ImportarAsync(stream, archivo.ContentType, archivo.Length, archivo.FileName, nombre, ct);
    }

    [HttpPost("{id:int}/duplicar"), Authorize(Policy = Claims.PoliticaAdministrador)]
    public Task<PlantillaDto> Duplicar(int id, DuplicarPlantillaDto dto, CancellationToken ct) => servicio.DuplicarAsync(id, dto, ct);

    [HttpPut("{id:int}/borrador"), Authorize(Policy = Claims.PoliticaAdministrador)]
    public Task<PlantillaDto> GuardarBorrador(int id, GuardarBorradorDto dto, CancellationToken ct) =>
        servicio.GuardarBorradorAsync(id, dto, ct);

    [HttpPost("{id:int}/borrador/pdf"), Authorize(Policy = Claims.PoliticaAdministrador), RequestSizeLimit(LimitePeticion)]
    public async Task<PlantillaDto> ReemplazarPdf(int id, IFormFile archivo, CancellationToken ct)
    {
        await using var stream = archivo.OpenReadStream();
        return await servicio.ReemplazarPdfAsync(id, stream, archivo.ContentType, archivo.Length, ct);
    }

    /// <summary>200 con la plantilla; 204 si nunca se había publicado y quedó eliminada.</summary>
    [HttpDelete("{id:int}/borrador"), Authorize(Policy = Claims.PoliticaAdministrador)]
    public async Task<IActionResult> DescartarBorrador(int id, CancellationToken ct) =>
        await servicio.DescartarBorradorAsync(id, ct) is { } p ? Ok(p) : NoContent();

    [HttpPut("{id:int}/encabezado"), Authorize(Policy = Claims.PoliticaAdministrador)]
    public Task<PlantillaDto> GuardarEncabezado(int id, EncabezadoPlantillaDto dto, CancellationToken ct) =>
        servicio.GuardarEncabezadoAsync(id, dto, ct);

    [HttpPost("{id:int}/publicar"), Authorize(Policy = Claims.PoliticaAdministrador)]
    public Task<PlantillaDto> Publicar(int id, CancellationToken ct) => servicio.PublicarAsync(id, ct);

    [HttpPost("{id:int}/desactivar"), Authorize(Policy = Claims.PoliticaAdministrador)]
    public Task<PlantillaDto> Desactivar(int id, CancellationToken ct) => servicio.DesactivarAsync(id, ct);

    [HttpPost("{id:int}/activar"), Authorize(Policy = Claims.PoliticaAdministrador)]
    public Task<PlantillaDto> Activar(int id, CancellationToken ct) => servicio.ActivarAsync(id, ct);
}
