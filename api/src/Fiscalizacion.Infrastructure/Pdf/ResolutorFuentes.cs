using System.Collections.Concurrent;
using PdfSharp.Fonts;

namespace Fiscalizacion.Infrastructure.Pdf;

/// <summary>
/// Fuentes del PDF incrustadas en el ensamblado (Inter y JetBrains Mono, SIL OFL 1.1; licencias en Pdf/Fuentes):
/// el PDF se ve igual en un Windows Server sin fuentes instaladas. Cualquier otra familia cae en Inter.
/// </summary>
public class ResolutorFuentes : IFontResolver
{
    public const string Inter = "Inter";
    public const string InterSemiBold = "Inter SemiBold";
    public const string Mono = "JetBrains Mono";

    private static readonly object Candado = new();
    private static bool registrado;
    private static readonly ConcurrentDictionary<string, byte[]> Cache = new();

    /// <summary>PDFsharp usa un único resolutor por proceso; se registra la primera vez que se genera un PDF.</summary>
    public static void Registrar()
    {
        if (registrado) return;
        lock (Candado)
        {
            if (registrado) return;
            if (GlobalFontSettings.FontResolver is not ResolutorFuentes) GlobalFontSettings.FontResolver = new ResolutorFuentes();
            registrado = true;
        }
    }

    public FontResolverInfo? ResolveTypeface(string familyName, bool isBold, bool isItalic)
    {
        // no hay cursivas incrustadas: PDFsharp las simula si alguna vez se piden
        var cara = familyName.Equals(Mono, StringComparison.OrdinalIgnoreCase) ? "JetBrainsMono-Regular"
            : familyName.Equals(InterSemiBold, StringComparison.OrdinalIgnoreCase) ? "Inter-SemiBold"
            : isBold ? "Inter-Bold" : "Inter-Regular";
        return new FontResolverInfo(cara, false, isItalic);
    }

    public byte[]? GetFont(string faceName) => Cache.GetOrAdd(faceName, Leer);

    private static byte[] Leer(string cara)
    {
        var recurso = $"{typeof(ResolutorFuentes).Namespace}.Fuentes.{cara}.ttf";
        using var stream = typeof(ResolutorFuentes).Assembly.GetManifestResourceStream(recurso)
                           ?? throw new InvalidOperationException($"Falta la fuente incrustada {recurso}.");
        using var buffer = new MemoryStream();
        stream.CopyTo(buffer);
        return buffer.ToArray();
    }
}
