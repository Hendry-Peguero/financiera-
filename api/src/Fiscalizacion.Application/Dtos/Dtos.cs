using Fiscalizacion.Domain.Enums;
using Fiscalizacion.Domain.Reglas;

namespace Fiscalizacion.Application.Dtos;

// ---- Sesión y usuarios ----
public record UsuarioDto(Guid Id, string Correo, string NombreCompleto, string? Cargo, Rol Rol,
    bool TieneFirma, bool EsPropietarioBitacora, bool PerfilCompleto);
public record PerfilDto(string NombreCompleto, string? Cargo);
public record ImagenDto(string ImagenBase64);
public record UsuarioBusquedaDto(Guid Id, string NombreCompleto, string? Cargo, bool TieneFirma);

// ---- Catálogos ----
public record LocacionDto(int Id, string Nombre, string? Provincia);
public record SuplidorDto(int Id, string Nombre);
public record ProductoDto(int Id, string Nombre, string Unidad);
public record PreguntaControlDto(int Numero, string Texto, bool ObservacionObligatoriaSiSi, TipoObservacion TipoObservacion);
public record CatalogosDto(IReadOnlyList<LocacionDto> Locaciones, IReadOnlyList<SuplidorDto> Suplidores,
    IReadOnlyList<ProductoDto> Productos, IReadOnlyList<PreguntaControlDto> PreguntasControl);

// ---- Fiscalización ----
public record VisitaDto(DateOnly? Fecha, TimeOnly? HoraSalida, TimeOnly? InicioProceso, int? LocacionId,
    TimeOnly? HoraLlegada, TimeOnly? FinProceso);
/// <summary><c>Nombre</c>: la empresa suplidora en texto libre; al guardar, la API la enlaza al catálogo (<c>SuplidorId</c>).</summary>
public record DatosSuplidorDto(string? FichaCamion, string? Chofer, string? Placa, string? Conduce,
    int? SuplidorId, decimal? TotalEntregarGal, string? Nombre = null);
/// <summary>Primer par (FichaCamion1 / Chofer1) y segundo par de camión y chofer de la empresa; ninguno copia al suplidor.</summary>
public record DatosEmpresaDto(string? FichaCamion2, string? Chofer2, string? Responsable, decimal? TotalRecibirGal,
    string? FichaCamion1 = null, string? Chofer1 = null);
public record LecturaDto(Equipo Equipo, decimal? Inicial, decimal? Final);
public record VaraDto(string? InicialMedida, decimal? InicialGalones, string? FinalMedida, decimal? FinalGalones);
public record MedicionesDto(int? ProductoId, decimal? GalonesProveedor, decimal? GalonesEgehid, decimal? PrecioGalon,
    IReadOnlyList<LecturaDto>? Lecturas, VaraDto? Vara);
public record ControlDto(int Numero, bool? Respuesta, string? Observacion);
public record AutorDto(Guid Id, string NombreCompleto);
/// <summary><c>Sha256</c>: huella del archivo guardado (hex en minúsculas); la tablet la compara con la suya.</summary>
public record FotoDto(Guid Id, int Orden, string? Descripcion, long TamanoBytes, string? Sha256 = null);
public record FirmaDto(RolFirma Rol, string NombreFirmante, string? Cedula, ModoFirma Modo, DateTime FirmadoEn, Guid? UsuarioId);

public record FiscalizacionDto(
    Guid Id, string Numero, EstadoFiscalizacion Estado, int VersionActual, byte[]? RowVersion, bool EnPapelera,
    AutorDto Autor, DateTime CreadoEn, DateTime ActualizadoEn,
    VisitaDto Visita, DatosSuplidorDto Suplidor, DatosEmpresaDto Empresa, MedicionesDto Mediciones,
    Calculos Calculos, IReadOnlyList<ControlDto> Controles, string? ObservacionesGenerales,
    IReadOnlyList<FotoDto> Fotos, IReadOnlyList<FirmaDto> Firmas, IReadOnlyDictionary<string, string[]> Pendientes);

/// <summary>Cuerpo de PUT /fiscalizaciones/{id} y POST /{id}/corregir.</summary>
public record FiscalizacionEntradaDto(
    byte[]? RowVersion, VisitaDto? Visita, DatosSuplidorDto? Suplidor, DatosEmpresaDto? Empresa,
    MedicionesDto? Mediciones, IReadOnlyList<ControlDto>? Controles, string? ObservacionesGenerales);

public record FiscalizacionResumenDto(Guid Id, string Numero, DateOnly? Fecha, string? Locacion, string? Suplidor,
    string Autor, decimal? GalonesProveedor, decimal? GalonesEgehid, decimal? DiferenciaGal, int Version,
    EstadoFiscalizacion Estado, bool EnPapelera);

public record FiltroFiscalizaciones(EstadoFiscalizacion? Estado, bool EnPapelera, DateOnly? Desde, DateOnly? Hasta,
    int? LocacionId, int? SuplidorId, Guid? AutorId, string? Texto, int Pagina = 1, int? Tamano = 20);

public record ListaFiscalizacionesDto(IReadOnlyList<FiscalizacionResumenDto> Items, int Total, int Pagina, int Tamano,
    IReadOnlyDictionary<string, int> Conteos);

// ---- Firmas ----
public record FirmarDto(string? NombreFirmante, string? Cedula, ModoFirma Modo, string? ImagenBase64);
public record CrearSolicitudDto(RolFirma Rol, Guid UsuarioDestinoId);
public record SolicitudFirmaDto(Guid Id, Guid FiscalizacionId, string Numero, RolFirma Rol, string SolicitadaPor,
    DateTime CreadaEn, DateTime ExpiraEn, EstadoSolicitud Estado);
/// <summary>Fila de GET /fiscalizaciones/{id}/solicitudes-firma (más reciente primero).</summary>
public record SolicitudFirmaRegistroDto(Guid Id, RolFirma Rol, Guid UsuarioDestinoId, string Firmante, string CorreoFirmante,
    string SolicitadaPor, EstadoSolicitud Estado, string? Comentario, DateTime CreadaEn, DateTime ExpiraEn, DateTime? FirmadaEn);
public record FirmarSolicitudDto(bool UsarPredeterminada, string? ImagenBase64);
public record RechazarSolicitudDto(string Comentario);

// ---- Versiones ----
public record CambioCampoDto(string Campo, string? ValorAnterior, string? ValorNuevo);
public record VersionDto(int Version, DateTime CreadoEn, string CreadoPor, string? Resumen, bool Vigente,
    IReadOnlyList<CambioCampoDto> Cambios);

// ---- Inicio y estadísticas ----
public record AvisoDto(Guid FiscalizacionId, string Numero, string? Locacion, TipoAviso Tipo, string Mensaje);
public record ResumenInicioDto(int FinalizadosMes, int FinalizadosMesAnterior, int Borradores,
    int BorradoresFirmasIncompletas, decimal GalonesMes, IReadOnlyList<AvisoDto> Avisos,
    IReadOnlyList<FiscalizacionResumenDto> Recientes);
public record SerieDto(string Periodo, decimal Proveedor, decimal Egehid);
public record GalonesLocacionDto(string Locacion, decimal Galones);
public record EstadisticasDto(int Total, decimal GalonesProveedor, decimal GalonesEgehid, decimal Diferencia,
    decimal? DiferenciaPct, IReadOnlyList<SerieDto> Series, IReadOnlyList<GalonesLocacionDto> PorLocacion,
    IReadOnlyList<AvisoDto> Avisos);

// ---- Bitácora ----
public record EventoUiDto(Guid IdCliente, DateTime Momento, Guid SesionId, string Tipo, string? Ruta,
    string? Elemento, System.Text.Json.JsonElement? Detalle, string? Dispositivo);
public record LoteEventosUiDto(IReadOnlyList<EventoUiDto> Eventos);
public record FiltroBitacora(DateTime? Desde, DateTime? Hasta, string? Usuario, string? Tipo, string? Texto,
    int Pagina = 1, int? Tamano = 50);
