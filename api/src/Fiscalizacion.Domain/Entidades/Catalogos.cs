using Fiscalizacion.Domain.Enums;

namespace Fiscalizacion.Domain.Entidades;

public class Usuario
{
    public Guid Id { get; set; }
    public string? Auth0Sub { get; set; }
    public string Correo { get; set; } = "";
    public string NombreCompleto { get; set; } = "";
    public string? Cargo { get; set; }
    public Rol Rol { get; set; } = Rol.Auditor;
    public byte[]? FirmaPredeterminada { get; set; }
    public bool Activo { get; set; } = true;
    public DateTime CreadoEn { get; set; }
    public DateTime? UltimoAcceso { get; set; }

    public bool PerfilCompleto => !string.IsNullOrWhiteSpace(NombreCompleto) && !string.IsNullOrWhiteSpace(Cargo);
}

public class Locacion
{
    public int Id { get; set; }
    public string Nombre { get; set; } = "";
    public string? Provincia { get; set; }
    public bool Activa { get; set; } = true;
}

public class Suplidor
{
    public int Id { get; set; }
    public string Nombre { get; set; } = "";
    public string? Rnc { get; set; }
    public bool Activo { get; set; } = true;
}

public class Producto
{
    public int Id { get; set; }
    public string Nombre { get; set; } = "";
    public string Unidad { get; set; } = "gal";
}

public class ControlPregunta
{
    public int Numero { get; set; }
    public string Texto { get; set; } = "";
    public bool ObservacionObligatoriaSiSi { get; set; }
    public TipoObservacion TipoObservacion { get; set; } = TipoObservacion.Texto;
    public bool Activa { get; set; } = true;
}
