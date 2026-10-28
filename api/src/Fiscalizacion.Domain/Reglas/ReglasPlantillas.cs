using System.Text.RegularExpressions;
using Fiscalizacion.Domain.Entidades;
using Fiscalizacion.Domain.Enums;

namespace Fiscalizacion.Domain.Reglas;

/// <summary>Reglas de las plantillas de formularios (fase 3). Medidas en puntos PDF, origen arriba a la izquierda.</summary>
public static partial class ReglasPlantillas
{
    public const long MaxPdfBytes = 4 * 1024 * 1024;
    public const int MaxPaginas = 10;
    public const int MaxCampos = 500;
    public const int MaxIdentificador = 80;
    public const int MaxEtiqueta = 150;
    public const int MaxFormula = 500;
    public const int MaxNombre = 150;
    public const int MaxCodigoDocumento = 40;
    public const int MaxVersionDocumento = 20;

    /// <summary>Página carta (612 × 792 pt) para las plantillas sin PDF base.</summary>
    public const decimal AnchoCarta = 612, AltoCarta = 792;

    [GeneratedRegex("^[a-z][a-z0-9_]*$")]
    private static partial Regex FormatoIdentificador();

    public static bool IdentificadorValido(string? id) =>
        !string.IsNullOrEmpty(id) && id.Length <= MaxIdentificador && FormatoIdentificador().IsMatch(id);

    /// <summary>Tipos que dan un número y pueden usarse dentro de una fórmula.</summary>
    public static bool EsNumerico(TipoCampo t) => t is TipoCampo.Numero or TipoCampo.Formula;

    /// <summary>
    /// Errores que impiden guardar el borrador (formato, identificador único, posición dentro de la página).
    /// <paramref name="paginas"/> = tamaño de cada página (ancho, alto).
    /// </summary>
    public static Dictionary<string, List<string>> ValidarBorrador(IReadOnlyList<PlantillaCampo> campos,
        IReadOnlyList<(decimal ancho, decimal alto)> paginas)
    {
        var errores = new Dictionary<string, List<string>>();
        void Agregar(string clave, string m)
        {
            if (!errores.TryGetValue(clave, out var l)) errores[clave] = l = [];
            l.Add(m);
        }

        if (campos.Count > MaxCampos) Agregar("campos", $"Máximo {MaxCampos} campos por plantilla.");
        var vistos = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var c in campos)
        {
            var clave = $"campos.{c.Identificador}";
            if (!IdentificadorValido(c.Identificador))
                Agregar(clave, "El identificador usa minúsculas, números y _ (empieza por letra, máx. 80).");
            else if (!vistos.Add(c.Identificador))
                Agregar(clave, $"El identificador «{c.Identificador}» está repetido.");
            if (string.IsNullOrWhiteSpace(c.Etiqueta)) Agregar(clave, "Falta la etiqueta visible.");
            else if (c.Etiqueta.Length > MaxEtiqueta) Agregar(clave, $"La etiqueta supera {MaxEtiqueta} caracteres.");
            if (c.Formula?.Length > MaxFormula) Agregar(clave, $"La fórmula supera {MaxFormula} caracteres.");
            if (c.Pagina < 1 || c.Pagina > paginas.Count)
            {
                Agregar(clave, $"La página debe estar entre 1 y {paginas.Count}.");
                continue;
            }
            var (ancho, alto) = paginas[c.Pagina - 1];
            if (c.Ancho <= 0 || c.Alto <= 0) Agregar(clave, "El ancho y el alto deben ser mayores que 0.");
            // margen de 1 pt por redondeo
            if (c.X < 0 || c.Y < 0 || c.X + c.Ancho > ancho + 1 || c.Y + c.Alto > alto + 1)
                Agregar(clave, "El campo queda fuera de la página.");
        }
        return errores;
    }

    /// <summary>Errores que impiden publicar: los del borrador, al menos un campo y fórmulas válidas sin ciclos.</summary>
    public static Dictionary<string, List<string>> ValidarPublicacion(IReadOnlyList<PlantillaCampo> campos,
        IReadOnlyList<(decimal ancho, decimal alto)> paginas)
    {
        var errores = ValidarBorrador(campos, paginas);
        void Agregar(string clave, string m)
        {
            if (!errores.TryGetValue(clave, out var l)) errores[clave] = l = [];
            l.Add(m);
        }

        if (campos.Count == 0) Agregar("campos", "Agregue al menos un campo antes de publicar.");
        var porId = campos.GroupBy(c => c.Identificador).ToDictionary(g => g.Key, g => g.First());
        var dependencias = new Dictionary<string, IReadOnlyList<string>>();
        foreach (var c in campos.Where(c => c.Tipo == TipoCampo.Formula))
        {
            var clave = $"campos.{c.Identificador}";
            if (string.IsNullOrWhiteSpace(c.Formula))
            {
                Agregar(clave, "Falta la fórmula.");
                continue;
            }
            var (refs, error) = Formula.Analizar(c.Formula);
            if (error is not null)
            {
                Agregar(clave, error);
                continue;
            }
            foreach (var r in refs)
            {
                if (r == c.Identificador) Agregar(clave, "La fórmula no puede usar su propio campo.");
                else if (!porId.TryGetValue(r, out var otro)) Agregar(clave, $"La fórmula usa «{r}», que no existe.");
                else if (!EsNumerico(otro.Tipo)) Agregar(clave, $"«{r}» no es numérico (use campos Número o Diferencia).");
            }
            dependencias[c.Identificador] = refs;
        }
        foreach (var ciclo in Ciclos(dependencias))
            Agregar($"campos.{ciclo}", "Las fórmulas forman un ciclo.");
        return errores;
    }

    /// <summary>Campos de fórmula que participan en un ciclo (a = b + 1, b = a − 1).</summary>
    private static IEnumerable<string> Ciclos(Dictionary<string, IReadOnlyList<string>> deps)
    {
        var estado = new Dictionary<string, int>(); // 1 = visitando, 2 = listo
        var enCiclo = new HashSet<string>();
        void Visitar(string n, Stack<string> camino)
        {
            if (!deps.ContainsKey(n)) return;
            if (estado.TryGetValue(n, out var e))
            {
                // en la pila: desde la cima hasta n es el ciclo
                if (e == 1) foreach (var x in camino.TakeWhile(x => x != n).Append(n)) enCiclo.Add(x);
                return;
            }
            estado[n] = 1;
            camino.Push(n);
            foreach (var d in deps[n]) Visitar(d, camino);
            camino.Pop();
            estado[n] = 2;
        }
        foreach (var n in deps.Keys) Visitar(n, new Stack<string>());
        return enCiclo.Order();
    }

    /// <summary>
    /// Fórmulas de campos: números, identificadores, + − * / (también − × ÷), paréntesis y signo negativo.
    /// Solo se analiza la sintaxis y se devuelven los identificadores usados.
    /// </summary>
    public static class Formula
    {
        public static (IReadOnlyList<string> referencias, string? error) Analizar(string formula)
        {
            var p = new Analizador(formula);
            try
            {
                p.Expresion();
                p.Espacios();
                if (!p.Fin) return ([], $"Símbolo inesperado «{p.Actual}» en la fórmula.");
                return (p.Referencias.Distinct().ToList(), null);
            }
            catch (FormatException e)
            {
                return ([], e.Message);
            }
        }

        private class Analizador(string s)
        {
            private int i;
            public readonly List<string> Referencias = [];
            public bool Fin => i >= s.Length;
            public char Actual => s[i];

            public void Espacios()
            {
                while (!Fin && char.IsWhiteSpace(Actual)) i++;
            }

            private bool Tomar(params char[] ops)
            {
                Espacios();
                if (Fin || !ops.Contains(Actual)) return false;
                i++;
                return true;
            }

            public void Expresion()
            {
                Termino();
                while (Tomar('+', '-', '−')) Termino();
            }

            private void Termino()
            {
                Factor();
                while (Tomar('*', '×', '/', '÷')) Factor();
            }

            private void Factor()
            {
                if (Tomar('-', '−')) { Factor(); return; }
                if (Tomar('('))
                {
                    Expresion();
                    if (!Tomar(')')) throw new FormatException("Falta cerrar un paréntesis en la fórmula.");
                    return;
                }
                Espacios();
                if (Fin) throw new FormatException("La fórmula está incompleta.");
                var inicio = i;
                if (char.IsAsciiDigit(Actual) || Actual == '.')
                {
                    while (!Fin && (char.IsAsciiDigit(Actual) || Actual == '.')) i++;
                    if (!decimal.TryParse(s[inicio..i], System.Globalization.NumberStyles.AllowDecimalPoint,
                            System.Globalization.CultureInfo.InvariantCulture, out _))
                        throw new FormatException($"Número inválido «{s[inicio..i]}» en la fórmula.");
                    return;
                }
                if (char.IsAsciiLetterLower(Actual) || Actual == '_')
                {
                    while (!Fin && (char.IsAsciiLetterLower(Actual) || char.IsAsciiDigit(Actual) || Actual == '_')) i++;
                    Referencias.Add(s[inicio..i]);
                    return;
                }
                throw new FormatException($"Símbolo inesperado «{Actual}» en la fórmula.");
            }
        }
    }
}
