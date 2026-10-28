using Fiscalizacion.Domain.Entidades;
using Fiscalizacion.Domain.Enums;
using Fiscalizacion.Domain.Reglas;

namespace Fiscalizacion.Domain.Tests;

public class ReglasPlantillasTests
{
    private static readonly (decimal, decimal)[] Pagina = [(440, 600)];

    private static PlantillaCampo Campo(string id, TipoCampo tipo = TipoCampo.Numero, string? formula = null) =>
        new() { Identificador = id, Etiqueta = id, Tipo = tipo, Formula = formula, Pagina = 1, X = 10, Y = 10, Ancho = 100, Alto = 16 };

    [Theory]
    [InlineData("cant_recibida − cant_facturada", new[] { "cant_recibida", "cant_facturada" })]
    [InlineData("(a + b) × 2 ÷ -c", new[] { "a", "b", "c" })]
    [InlineData("a*a/1.5", new[] { "a" })]
    public void Formula_valida_devuelve_los_identificadores(string formula, string[] refs)
    {
        var (r, error) = ReglasPlantillas.Formula.Analizar(formula);
        Assert.Null(error);
        Assert.Equal(refs, r);
    }

    [Theory]
    [InlineData("a +")]
    [InlineData("(a + b")]
    [InlineData("a b")]
    [InlineData("a % b")]
    [InlineData("1..2")]
    public void Formula_invalida_da_error(string formula) => Assert.NotNull(ReglasPlantillas.Formula.Analizar(formula).error);

    [Theory]
    [InlineData("diferencia", true)]
    [InlineData("cant_2", true)]
    [InlineData("2cant", false)]
    [InlineData("Cant", false)]
    [InlineData("con espacio", false)]
    [InlineData("", false)]
    public void Identificador_minusculas_numeros_y_guion_bajo(string id, bool valido) =>
        Assert.Equal(valido, ReglasPlantillas.IdentificadorValido(id));

    [Fact]
    public void Publicar_detecta_ciclos_entre_formulas()
    {
        var e = ReglasPlantillas.ValidarPublicacion(
            [Campo("x"), Campo("a", TipoCampo.Formula, "b + x"), Campo("b", TipoCampo.Formula, "a - 1"), Campo("c", TipoCampo.Formula, "x * 2")], Pagina);
        Assert.Equal(["campos.a", "campos.b"], e.Keys.Order());
    }

    [Fact]
    public void Publicar_sin_campos_no_se_permite_y_el_borrador_vacio_si()
    {
        Assert.Empty(ReglasPlantillas.ValidarBorrador([], Pagina));
        Assert.True(ReglasPlantillas.ValidarPublicacion([], Pagina).ContainsKey("campos"));
    }
}
