namespace Fiscalizacion.Application.Comun;

public class NoEncontradoException(string mensaje = "No encontrado.") : Exception(mensaje);

public class ConflictoException(string mensaje, object? actual = null) : Exception(mensaje)
{
    /// <summary>Versión vigente en el servidor, para que el cliente pueda resolver el conflicto.</summary>
    public object? Actual { get; } = actual;
}

public class ProhibidoException(string mensaje = "No tiene permiso para esta acción.") : Exception(mensaje);

public record Paginado<T>(IReadOnlyList<T> Items, int Total, int Pagina, int Tamano)
{
    public static int Normalizar(int? tamano) => Math.Clamp(tamano ?? 20, 1, 200);
}

public static class Texto
{
    public static string? Limpiar(string? s, int max)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        s = s.Trim();
        return s.Length > max ? s[..max] : s;
    }
}
