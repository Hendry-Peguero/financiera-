using Fiscalizacion.Domain.Enums;
using Fiscalizacion.Domain.Reglas;

namespace Fiscalizacion.Domain.Entidades;

public class Fiscalizacion
{
    public const int MaxFotos = 20;

    public Guid Id { get; set; }
    public string Numero { get; set; } = "";
    public int PlantillaVersionId { get; set; }
    public Guid AutorId { get; set; }
    public Usuario? Autor { get; set; }
    public EstadoFiscalizacion Estado { get; set; } = EstadoFiscalizacion.Borrador;
    public int VersionActual { get; set; }
    public bool EnPapelera { get; set; }
    public DateTime? EliminadoEn { get; set; }
    public Guid? EliminadoPorId { get; set; }
    public DateTime CreadoEn { get; set; }
    public DateTime ActualizadoEn { get; set; }
    public DateTime? FinalizadoEn { get; set; }
    public byte[] RowVersion { get; set; } = [];

    public DatosVisita Visita { get; set; } = new();
    public DatosSuplidor Suplidor { get; set; } = new();
    public DatosEmpresa Empresa { get; set; } = new();
    public DatosMediciones Mediciones { get; set; } = new();
    public string? ObservacionesGenerales { get; set; }

    public List<LecturaEquipo> Lecturas { get; set; } = [];
    public List<RespuestaControl> Controles { get; set; } = [];
    public List<Foto> Fotos { get; set; } = [];
    public List<Firma> Firmas { get; set; } = [];
    public List<SolicitudFirma> Solicitudes { get; set; } = [];
    public List<FiscalizacionVersion> Versiones { get; set; } = [];

    public bool EsEditable => Estado == EstadoFiscalizacion.Borrador && !EnPapelera;

    public static Fiscalizacion Nueva(Guid id, Guid autorId, int plantillaVersionId, DateTime ahora) => new()
    {
        Id = id,
        Numero = GeneradorNumero.Desde(id),
        AutorId = autorId,
        PlantillaVersionId = plantillaVersionId,
        CreadoEn = ahora,
        ActualizadoEn = ahora
    };

    public Calculos Calcular() =>
        Calculadora.Calcular(Mediciones.GalonesProveedor, Mediciones.GalonesEgehid, Mediciones.PrecioGalon);

    public void Finalizar(IReadOnlyCollection<ControlPregunta> preguntas, DateTime ahora)
    {
        if (!EsEditable) throw new ReglaNegocioException("Solo se puede finalizar un borrador.");
        var pendientes = ValidadorFiscalizacion.Pendientes(this, preguntas);
        if (pendientes.HayPendientes) throw new ValidacionException(pendientes.ComoErrores());
        Estado = EstadoFiscalizacion.Finalizado;
        VersionActual = 1;
        FinalizadoEn = ahora;
        ActualizadoEn = ahora;
    }

    public void ValidarNuevaFoto()
    {
        if (Fotos.Count >= MaxFotos)
            throw new ReglaNegocioException($"Máximo {MaxFotos} fotos por registro.");
    }

    public void MoverAPapelera(Guid usuarioId, DateTime ahora)
    {
        EnPapelera = true;
        EliminadoEn = ahora;
        EliminadoPorId = usuarioId;
    }

    public void Restaurar()
    {
        EnPapelera = false;
        EliminadoEn = null;
        EliminadoPorId = null;
    }
}

public class DatosVisita
{
    public DateOnly? Fecha { get; set; }
    public TimeOnly? HoraSalida { get; set; }
    public TimeOnly? InicioProceso { get; set; }
    public int? LocacionId { get; set; }
    public Locacion? Locacion { get; set; }
    public TimeOnly? HoraLlegada { get; set; }
    public TimeOnly? FinProceso { get; set; }
}

public class DatosSuplidor
{
    public string? FichaCamion { get; set; }
    public string? Chofer { get; set; }
    public string? Placa { get; set; }
    public string? Conduce { get; set; }
    /// <summary>Empresa suplidora tal como se escribió (texto libre); <see cref="SuplidorId"/> la enlaza al catálogo.</summary>
    public string? Nombre { get; set; }
    public int? SuplidorId { get; set; }
    public Suplidor? Suplidor { get; set; }
    public decimal? TotalEntregarGal { get; set; }
}

/// <summary>Datos de la empresa: dos pares Ficha camión / Chofer propios de EGEHID (independientes del suplidor).</summary>
public class DatosEmpresa
{
    public string? FichaCamion1 { get; set; }
    public string? Chofer1 { get; set; }
    public string? FichaCamion2 { get; set; }
    public string? Chofer2 { get; set; }
    public string? Responsable { get; set; }
    public decimal? TotalRecibirGal { get; set; }
}

public class DatosMediciones
{
    public int? ProductoId { get; set; }
    public Producto? Producto { get; set; }
    public decimal? GalonesProveedor { get; set; }
    public decimal? GalonesEgehid { get; set; }
    public decimal? PrecioGalon { get; set; }
    public string? VaraInicialMedida { get; set; }
    public decimal? VaraInicialGalones { get; set; }
    public string? VaraFinalMedida { get; set; }
    public decimal? VaraFinalGalones { get; set; }
}

public class LecturaEquipo
{
    public Guid FiscalizacionId { get; set; }
    public Equipo Equipo { get; set; }
    public decimal? Inicial { get; set; }
    public decimal? Final { get; set; }
    public decimal? Diferencia => Inicial is { } i && Final is { } f ? f - i : null;
}

public class RespuestaControl
{
    public Guid FiscalizacionId { get; set; }
    public int PreguntaNumero { get; set; }
    public bool? Respuesta { get; set; }
    public string? Observacion { get; set; }
}

public class Foto
{
    public Guid Id { get; set; }
    public Guid FiscalizacionId { get; set; }
    public int Orden { get; set; }
    public string? Descripcion { get; set; }
    public string RutaArchivo { get; set; } = "";
    public string ContentType { get; set; } = "image/jpeg";
    public string Sha256 { get; set; } = "";
    public long TamanoBytes { get; set; }
    public DateTime TomadaEn { get; set; }
}

public class Firma
{
    public Guid FiscalizacionId { get; set; }
    public RolFirma Rol { get; set; }
    public string NombreFirmante { get; set; } = "";
    public string? Cedula { get; set; }
    public Guid? UsuarioId { get; set; }
    public ModoFirma Modo { get; set; }
    public byte[] Imagen { get; set; } = [];
    public string Sha256 { get; set; } = "";
    public DateTime FirmadoEn { get; set; }
}

public class SolicitudFirma
{
    public Guid Id { get; set; }
    public Guid FiscalizacionId { get; set; }
    public Fiscalizacion? Fiscalizacion { get; set; }
    public RolFirma Rol { get; set; }
    public Guid UsuarioDestinoId { get; set; }
    public Usuario? UsuarioDestino { get; set; }
    public Guid SolicitadaPorId { get; set; }
    public Usuario? SolicitadaPor { get; set; }
    public EstadoSolicitud Estado { get; set; } = EstadoSolicitud.Pendiente;
    public string? Comentario { get; set; }
    public DateTime CreadaEn { get; set; }
    public DateTime ExpiraEn { get; set; }

    public const int DiasVigencia = 7;

    public bool EstaVigente(DateTime ahora) => Estado == EstadoSolicitud.Pendiente && ahora < ExpiraEn;
}

public class FiscalizacionVersion
{
    public Guid Id { get; set; }
    public Guid FiscalizacionId { get; set; }
    public int Version { get; set; }
    public string SnapshotJson { get; set; } = "";
    public string? PdfRuta { get; set; }
    public string? Resumen { get; set; }
    public Guid CreadoPorId { get; set; }
    public Usuario? CreadoPor { get; set; }
    public DateTime CreadoEn { get; set; }
    public List<CambioCampo> Cambios { get; set; } = [];
}

public class CambioCampo
{
    public long Id { get; set; }
    public Guid VersionId { get; set; }
    public string Campo { get; set; } = "";
    public string? ValorAnterior { get; set; }
    public string? ValorNuevo { get; set; }
}
