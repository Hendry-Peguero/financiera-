using Fiscalizacion.Domain.Enums;

namespace Fiscalizacion.Domain.Entidades;

/// <summary>Cada petición recibida por la API.</summary>
public class BitacoraApi
{
    public long Id { get; set; }
    public DateTime Momento { get; set; }
    public Guid? UsuarioId { get; set; }
    public string? Correo { get; set; }
    public string Metodo { get; set; } = "";
    public string Ruta { get; set; } = "";
    public string? Query { get; set; }
    public int StatusCode { get; set; }
    public int DuracionMs { get; set; }
    public string? Ip { get; set; }
    public string? UserAgent { get; set; }
    public string? CorrelationId { get; set; }
}

/// <summary>Cada alta, cambio o baja de datos (lo llena un interceptor de EF Core).</summary>
public class BitacoraCambio
{
    public long Id { get; set; }
    public DateTime Momento { get; set; }
    public Guid? UsuarioId { get; set; }
    public string? Correo { get; set; }
    public string Entidad { get; set; } = "";
    public string EntidadId { get; set; } = "";
    public AccionCambio Accion { get; set; }
    public string? ValoresAnteriores { get; set; }
    public string? ValoresNuevos { get; set; }
    public string? CorrelationId { get; set; }
}

/// <summary>Eventos del front: clics, navegación, envíos, errores, conexión.</summary>
public class BitacoraUi
{
    public long Id { get; set; }
    public Guid IdCliente { get; set; }
    public DateTime Momento { get; set; }
    public DateTime RecibidoEn { get; set; }
    public Guid? UsuarioId { get; set; }
    public string? Correo { get; set; }
    public Guid SesionId { get; set; }
    public string Tipo { get; set; } = "";
    public string? Ruta { get; set; }
    public string? Elemento { get; set; }
    public string? Detalle { get; set; }
    public string? Dispositivo { get; set; }
}

/// <summary>Logs técnicos escritos por Serilog (sink MSSqlServer).</summary>
public class LogTecnico
{
    public long Id { get; set; }
    public DateTime TimeStamp { get; set; }
    public string? Level { get; set; }
    public string? Message { get; set; }
    public string? MessageTemplate { get; set; }
    public string? Exception { get; set; }
    public string? LogEvent { get; set; }
}
