using Fiscalizacion.Api.Seguridad;
using Fiscalizacion.Application.Bitacora;
using Fiscalizacion.Application.Comun;
using Fiscalizacion.Application.Dtos;
using Fiscalizacion.Application.Estadisticas;
using Fiscalizacion.Application.Fiscalizaciones;
using Fiscalizacion.Application.Usuarios;
using Fiscalizacion.Domain.Entidades;
using Fiscalizacion.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Fiscalizacion.Api.Controllers;

[ApiController, Authorize, Route("api/me")]
public class MeController(ServicioUsuarios usuarios) : ControllerBase
{
    [HttpGet] public Task<UsuarioDto> Obtener(CancellationToken ct) => usuarios.MeAsync(ct);
    [HttpPut("perfil")] public Task<UsuarioDto> Perfil(PerfilDto dto, CancellationToken ct) => usuarios.ActualizarPerfilAsync(dto, ct);

    [HttpPut("firma")]
    public async Task<IActionResult> GuardarFirma(ImagenDto dto, CancellationToken ct)
    {
        await usuarios.GuardarFirmaAsync(dto, ct);
        return NoContent();
    }

    [HttpGet("firma")]
    public async Task<ActionResult<ImagenDto>> ObtenerFirma(CancellationToken ct) =>
        await usuarios.ObtenerFirmaAsync(ct) is { } f ? f : NotFound();
}

[ApiController, Authorize, Route("api")]
public class CatalogosController(ServicioCatalogos catalogos, ServicioUsuarios usuarios) : ControllerBase
{
    [HttpGet("catalogos")] public Task<CatalogosDto> Catalogos(CancellationToken ct) => catalogos.ObtenerAsync(ct);

    [HttpGet("usuarios")]
    public Task<IReadOnlyList<UsuarioBusquedaDto>> Usuarios([FromQuery] string? texto, CancellationToken ct) =>
        usuarios.BuscarAsync(texto, ct);
}

[ApiController, Authorize, Route("api/fiscalizaciones")]
public class FiscalizacionesController(ServicioFiscalizaciones servicio, ServicioFotos fotos, ServicioFirmas firmas) : ControllerBase
{
    [HttpGet]
    public Task<ListaFiscalizacionesDto> Listar([FromQuery] FiltroFiscalizaciones filtro, CancellationToken ct) =>
        servicio.ListarAsync(filtro, ct);

    [HttpGet("{id:guid}")] public Task<FiscalizacionDto> Obtener(Guid id, CancellationToken ct) => servicio.ObtenerAsync(id, ct);

    [HttpPut("{id:guid}")]
    public Task<FiscalizacionDto> Guardar(Guid id, FiscalizacionEntradaDto dto, CancellationToken ct) => servicio.GuardarAsync(id, dto, ct);

    [HttpPost("{id:guid}/finalizar")] public Task<FiscalizacionDto> Finalizar(Guid id, CancellationToken ct) => servicio.FinalizarAsync(id, ct);

    [HttpPost("{id:guid}/corregir")]
    public Task<FiscalizacionDto> Corregir(Guid id, FiscalizacionEntradaDto dto, CancellationToken ct) => servicio.CorregirAsync(id, dto, ct);

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Papelera(Guid id, CancellationToken ct)
    {
        await servicio.MoverAPapeleraAsync(id, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/restaurar"), Authorize(Policy = Claims.PoliticaAdministrador)]
    public Task<FiscalizacionDto> Restaurar(Guid id, CancellationToken ct) => servicio.RestaurarAsync(id, ct);

    [HttpGet("{id:guid}/versiones"), Authorize(Policy = Claims.PoliticaAdministrador)]
    public Task<IReadOnlyList<VersionDto>> Versiones(Guid id, CancellationToken ct) => servicio.VersionesAsync(id, ct);

    [HttpPost("{id:guid}/fotos"), RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<FotoDto> AgregarFoto(Guid id, IFormFile archivo, [FromForm] string? descripcion, [FromForm] int? orden,
        [FromForm(Name = "id")] Guid? fotoId, [FromForm] string? sha256, CancellationToken ct)
    {
        await using var stream = archivo.OpenReadStream();
        return await fotos.AgregarAsync(id, stream, archivo.ContentType, archivo.Length, descripcion, orden, ct, fotoId, sha256);
    }

    [HttpGet("{id:guid}/fotos/{fotoId:guid}")]
    public async Task<IActionResult> Foto(Guid id, Guid fotoId, CancellationToken ct)
    {
        var (contenido, tipo) = await fotos.AbrirAsync(id, fotoId, ct);
        return File(contenido, tipo);
    }

    [HttpDelete("{id:guid}/fotos/{fotoId:guid}")]
    public async Task<IActionResult> EliminarFoto(Guid id, Guid fotoId, CancellationToken ct)
    {
        await fotos.EliminarAsync(id, fotoId, ct);
        return NoContent();
    }

    [HttpPut("{id:guid}/firmas/{rol}")]
    public Task<FiscalizacionDto> Firmar(Guid id, RolFirma rol, FirmarDto dto, CancellationToken ct) => firmas.FirmarAsync(id, rol, dto, ct);

    [HttpPost("{id:guid}/solicitudes-firma")]
    public Task<SolicitudFirmaDto> Solicitar(Guid id, CrearSolicitudDto dto, CancellationToken ct) => firmas.SolicitarAsync(id, dto, ct);
}

[ApiController, Authorize, Route("api/solicitudes-firma")]
public class SolicitudesFirmaController(ServicioFirmas firmas) : ControllerBase
{
    [HttpGet("mias")] public Task<IReadOnlyList<SolicitudFirmaDto>> Mias(CancellationToken ct) => firmas.MiasAsync(ct);

    [HttpPost("{id:guid}/firmar")]
    public Task<FiscalizacionDto> Firmar(Guid id, FirmarSolicitudDto dto, CancellationToken ct) => firmas.FirmarSolicitudAsync(id, dto, ct);

    [HttpPost("{id:guid}/rechazar")]
    public async Task<IActionResult> Rechazar(Guid id, RechazarSolicitudDto dto, CancellationToken ct)
    {
        await firmas.RechazarAsync(id, dto, ct);
        return NoContent();
    }
}

[ApiController, Authorize, Route("api")]
public class EstadisticasController(ServicioEstadisticas servicio) : ControllerBase
{
    [HttpGet("inicio/resumen")] public Task<ResumenInicioDto> Resumen(CancellationToken ct) => servicio.ResumenAsync(ct);

    [HttpGet("estadisticas")]
    public Task<EstadisticasDto> Estadisticas([FromQuery] DateOnly? desde, [FromQuery] DateOnly? hasta,
        [FromQuery] int? locacionId, [FromQuery] string? agrupar, CancellationToken ct) =>
        servicio.EstadisticasAsync(desde, hasta, locacionId, agrupar, ct);

    [HttpGet("avisos")]
    public Task<IReadOnlyList<AvisoDto>> Avisos([FromQuery] DateOnly? desde, [FromQuery] DateOnly? hasta,
        [FromQuery] int? locacionId, CancellationToken ct)
    {
        var hoy = DateOnly.FromDateTime(DateTime.UtcNow);
        return servicio.AvisosAsync(desde ?? hoy.AddMonths(-3), hasta ?? hoy, locacionId, ct);
    }
}

[ApiController, Authorize, Route("api/bitacora")]
public class BitacoraController(ServicioBitacora servicio) : ControllerBase
{
    /// <summary>Cualquier usuario autenticado envía sus eventos; solo el propietario los consulta.</summary>
    [HttpPost("ui")]
    public async Task<IActionResult> RegistrarUi(LoteEventosUiDto lote, CancellationToken ct)
    {
        await servicio.RegistrarUiAsync(lote, ct);
        return Accepted();
    }

    [HttpGet("ui"), Authorize(Policy = Claims.PoliticaBitacora)]
    public Task<Paginado<BitacoraUi>> Ui([FromQuery] FiltroBitacora f, CancellationToken ct) => servicio.UiAsync(f, ct);

    [HttpGet("api"), Authorize(Policy = Claims.PoliticaBitacora)]
    public Task<Paginado<BitacoraApi>> Api([FromQuery] FiltroBitacora f, CancellationToken ct) => servicio.ApiAsync(f, ct);

    [HttpGet("cambios"), Authorize(Policy = Claims.PoliticaBitacora)]
    public Task<Paginado<BitacoraCambio>> Cambios([FromQuery] FiltroBitacora f, CancellationToken ct) => servicio.CambiosAsync(f, ct);
}
