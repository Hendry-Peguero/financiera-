using Fiscalizacion.Domain.Enums;

namespace Fiscalizacion.Application.Plantillas;

/// <summary>Lee el número y el tamaño de las páginas de un PDF (lo implementa Infrastructure).</summary>
public interface ILectorPdf
{
    /// <summary>Tamaño de cada página en puntos; null si no es un PDF legible (dañado o protegido).</summary>
    IReadOnlyList<PaginaDto>? Paginas(byte[] pdf);
}

// ---- Plantillas de formularios (contrato en docs/API-CONTRATO.md, sección «Plantillas») ----

/// <summary><c>Version</c> = versión publicada vigente (0 si nunca se publicó); <c>VersionBorrador</c> = versión en edición.</summary>
public record PlantillaResumenDto(int Id, string Nombre, TipoPlantilla Tipo, EstadoPlantilla Estado, int Version,
    int? VersionBorrador, int TotalCampos, DateTime? PublicadaEn);

public record PaginaDto(decimal Ancho, decimal Alto);

public record CampoPlantillaDto(string Identificador, string Etiqueta, TipoCampo Tipo, string? Formula, int Pagina,
    decimal X, decimal Y, decimal Ancho, decimal Alto, bool Obligatorio, bool EnEstadisticas, bool ImprimirPdf);

public record VersionPlantillaDto(int Version, bool Publicada, DateTime? PublicadaEn, int TotalCampos, bool TienePdf);

public record PlantillaVersionDto(int Version, bool Publicada, DateTime? PublicadaEn, bool TienePdf,
    IReadOnlyList<PaginaDto> Paginas, IReadOnlyList<CampoPlantillaDto> Campos);

/// <summary>Encabezado de control de documentos (código, versión y fechas) que se imprime en el formulario.</summary>
public record EncabezadoPlantillaDto(string? Codigo, string? Version, DateOnly? FechaElaboracion, DateOnly? FechaAprobacion);

/// <summary><c>Editable</c>: el usuario puede cambiar el borrador (Administrador y plantilla no oficial).</summary>
public record PlantillaDto(int Id, string Nombre, TipoPlantilla Tipo, EstadoPlantilla Estado, int Version,
    int? VersionBorrador, bool Editable, IReadOnlyList<VersionPlantillaDto> Versiones, PlantillaVersionDto Actual,
    EncabezadoPlantillaDto Encabezado);

public record NuevaPlantillaDto(string Nombre);
public record DuplicarPlantillaDto(string? Nombre);
public record GuardarBorradorDto(string? Nombre, IReadOnlyList<CampoPlantillaDto> Campos);
