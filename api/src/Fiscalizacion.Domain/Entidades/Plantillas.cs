using Fiscalizacion.Domain.Enums;

namespace Fiscalizacion.Domain.Entidades;

public class Plantilla
{
    public int Id { get; set; }
    public string Nombre { get; set; } = "";
    public TipoPlantilla Tipo { get; set; }
    public EstadoPlantilla Estado { get; set; }

    // encabezado de control de documentos que se imprime en el formulario (lo llena el Administrador)
    public string? CodigoDocumento { get; set; }
    public string? VersionDocumento { get; set; }
    public DateOnly? FechaElaboracion { get; set; }
    public DateOnly? FechaAprobacion { get; set; }
    public List<PlantillaVersion> Versiones { get; set; } = [];
}

public class PlantillaVersion
{
    public int Id { get; set; }
    public int PlantillaId { get; set; }
    public int Version { get; set; }
    public byte[]? PdfBase { get; set; }
    public bool Publicada { get; set; }
    public DateTime? PublicadaEn { get; set; }
    public List<PlantillaCampo> Campos { get; set; } = [];
}

public class PlantillaCampo
{
    public int Id { get; set; }
    public int PlantillaVersionId { get; set; }
    public string Identificador { get; set; } = "";
    public string Etiqueta { get; set; } = "";
    public TipoCampo Tipo { get; set; }
    public string? Formula { get; set; }
    public int Pagina { get; set; } = 1;
    public decimal X { get; set; }
    public decimal Y { get; set; }
    public decimal Ancho { get; set; }
    public decimal Alto { get; set; }
    public bool Obligatorio { get; set; }
    public bool EnEstadisticas { get; set; }
    public bool ImprimirPdf { get; set; } = true;
}
