using Fiscalizacion.Application.Dtos;
using Fiscalizacion.Application.Plantillas;
using Fiscalizacion.Domain.Enums;

namespace Fiscalizacion.Application.Pdf;

/// <summary>Dibuja el PDF oficial de una fiscalización: el formulario en papel llenado y, después, las fotos.</summary>
public interface IGeneradorPdf
{
    byte[] Generar(DocumentoPdf documento);
}

/// <summary>PDF guardados de cada versión. Igual que las fotos: la ruta guardada es relativa a la raíz configurada.</summary>
public interface IAlmacenPdf
{
    Task<string> GuardarAsync(Guid fiscalizacionId, int version, byte[] contenido, CancellationToken ct);
    Task<byte[]?> LeerAsync(string ruta, CancellationToken ct);
}

/// <summary>Firma tal como se imprime: nombre, cédula, momento y la imagen PNG (null si ya no está).</summary>
public record FirmaPdf(RolFirma Rol, string NombreFirmante, string? Cedula, DateTime FirmadoEn, byte[]? Imagen);

/// <summary>Foto del anexo; <see cref="Imagen"/> null si el archivo no se encontró.</summary>
public record FotoPdf(int Orden, string? Descripcion, byte[]? Imagen);

/// <summary>Todo lo que necesita el PDF, ya resuelto (nombres de catálogo, imágenes). El registro es el snapshot de la versión.</summary>
public record DocumentoPdf(
    FiscalizacionDto Registro,
    int Version,
    string? Locacion,
    string? Suplidor,
    IReadOnlyList<PreguntaControlDto> Preguntas,
    IReadOnlyList<FirmaPdf> Firmas,
    IReadOnlyList<FotoPdf> Fotos,
    DateTime GeneradoEn,
    string? MarcaAgua,
    EncabezadoPlantillaDto? Encabezado = null,
    string? Producto = null);

/// <summary>PDF listo para enviar.</summary>
public record ArchivoPdf(byte[] Contenido, string Nombre);
