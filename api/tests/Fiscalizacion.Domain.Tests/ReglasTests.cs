using Fiscalizacion.Domain.Entidades;
using Fiscalizacion.Domain.Enums;
using Fiscalizacion.Domain.Reglas;
using FiscalizacionEntidad = Fiscalizacion.Domain.Entidades.Fiscalizacion;

namespace Fiscalizacion.Domain.Tests;

public class CalculadoraTests
{
    [Fact]
    public void Diferencia_es_egehid_menos_proveedor_a_dos_decimales()
    {
        var c = Calculadora.Calcular(4212.40m, 4200.00m, 248.6m);
        Assert.Equal(-12.40m, c.DiferenciaGal);
        Assert.Equal(-0.29m, c.DiferenciaPct);
        Assert.Equal(1047202.64m, c.ImporteProveedor);
        Assert.Equal(1044120.00m, c.ImporteEgehid);
        Assert.Equal(-3082.64m, c.DiferenciaImporte);
    }

    [Fact]
    public void Sin_precio_no_hay_importes_y_proveedor_cero_no_divide()
    {
        var c = Calculadora.Calcular(0m, 2100m, null);
        Assert.Equal(2100m, c.DiferenciaGal);
        Assert.Null(c.DiferenciaPct);
        Assert.Null(c.ImporteProveedor);
    }

    [Fact]
    public void Numero_se_genera_del_id()
    {
        Assert.Equal("A3F921C0".Insert(4, "-"), GeneradorNumero.Desde(Guid.Parse("a3f921c0-0000-0000-0000-000000000000")));
    }
}

public class ValidadorTests
{
    private static readonly List<ControlPregunta> Preguntas = Enumerable.Range(1, 12)
        .Select(n => new ControlPregunta { Numero = n, Texto = $"P{n}", ObservacionObligatoriaSiSi = n is 6 or 11 or 12 })
        .ToList();

    private static FiscalizacionEntidad Completa()
    {
        var f = FiscalizacionEntidad.Nueva(Guid.NewGuid(), Guid.NewGuid(), 1, DateTime.UtcNow);
        f.Visita = new DatosVisita
        {
            Fecha = new DateOnly(2026, 10, 20), HoraSalida = new TimeOnly(7, 15), InicioProceso = new TimeOnly(9, 5),
            LocacionId = 1, HoraLlegada = new TimeOnly(8, 40), FinProceso = new TimeOnly(11, 20)
        };
        f.Suplidor = new DatosSuplidor { FichaCamion = "FT-221", Chofer = "R", Placa = "L-1", Conduce = "CD-1", SuplidorId = 1, TotalEntregarGal = 8000 };
        f.Empresa = new DatosEmpresa { Responsable = "C. Méndez", TotalRecibirGal = 8000 };
        f.Mediciones = new DatosMediciones { ProductoId = 1, GalonesProveedor = 4212.40m, GalonesEgehid = 4200m };
        f.Controles = Preguntas.Select(p => new RespuestaControl { PreguntaNumero = p.Numero, Respuesta = false }).ToList();
        f.Firmas = ValidadorFiscalizacion.FirmasRequeridas.Select(r => new Firma { Rol = r, NombreFirmante = "X" }).ToList();
        return f;
    }

    [Fact]
    public void Registro_completo_no_tiene_pendientes()
    {
        Assert.False(ValidadorFiscalizacion.Pendientes(Completa(), Preguntas).HayPendientes);
    }

    [Theory]
    [InlineData(6)]
    [InlineData(11)]
    [InlineData(12)]
    public void Controles_6_11_12_con_Si_exigen_observacion(int numero)
    {
        var f = Completa();
        f.Controles.Single(c => c.PreguntaNumero == numero).Respuesta = true;
        var p = ValidadorFiscalizacion.Pendientes(f, Preguntas);
        Assert.Contains(p.PorSeccion["controles"], m => m.Contains($"control {numero}"));

        f.Controles.Single(c => c.PreguntaNumero == numero).Observacion = "Detalle";
        Assert.Empty(ValidadorFiscalizacion.Pendientes(f, Preguntas).PorSeccion["controles"]);
    }

    [Fact]
    public void Otros_controles_con_Si_no_exigen_observacion()
    {
        var f = Completa();
        f.Controles.Single(c => c.PreguntaNumero == 1).Respuesta = true;
        Assert.Empty(ValidadorFiscalizacion.Pendientes(f, Preguntas).PorSeccion["controles"]);
    }

    [Fact]
    public void Control_sin_responder_es_pendiente()
    {
        var f = Completa();
        f.Controles.RemoveAll(c => c.PreguntaNumero == 3);
        Assert.Contains("Falta responder el control 3.", ValidadorFiscalizacion.Pendientes(f, Preguntas).PorSeccion["controles"]);
    }

    [Fact]
    public void Falta_fin_del_proceso()
    {
        var f = Completa();
        f.Visita.FinProceso = null;
        Assert.Contains("Falta la hora de fin del proceso.", ValidadorFiscalizacion.Pendientes(f, Preguntas).PorSeccion["visita"]);
    }

    [Fact]
    public void Finalizar_con_pendientes_lanza_validacion_y_sin_pendientes_pasa_a_v1()
    {
        var f = Completa();
        f.Firmas.RemoveAll(x => x.Rol == RolFirma.SupervisorCombustibles);
        var ex = Assert.Throws<ValidacionException>(() => f.Finalizar(Preguntas, DateTime.UtcNow));
        Assert.True(ex.Errores.ContainsKey("firmas"));

        f.Firmas.Add(new Firma { Rol = RolFirma.SupervisorCombustibles, NombreFirmante = "Y" });
        f.Finalizar(Preguntas, DateTime.UtcNow);
        Assert.Equal(EstadoFiscalizacion.Finalizado, f.Estado);
        Assert.Equal(1, f.VersionActual);
        Assert.False(f.EsEditable);
    }

    [Fact]
    public void Maximo_20_fotos()
    {
        var f = Completa();
        f.Fotos = Enumerable.Range(1, 20).Select(i => new Foto { Orden = i }).ToList();
        Assert.Throws<ReglaNegocioException>(f.ValidarNuevaFoto);
    }
}

public class AvisosTests
{
    private static FiscalizacionEntidad Con(decimal? proveedor, decimal? egehid)
    {
        var f = FiscalizacionEntidad.Nueva(Guid.NewGuid(), Guid.NewGuid(), 1, DateTime.UtcNow);
        f.Mediciones.GalonesProveedor = proveedor;
        f.Mediciones.GalonesEgehid = egehid;
        return f;
    }

    [Fact]
    public void Diferencia_mayor_a_1_por_ciento()
    {
        var a = DetectorAvisos.Evaluar(Con(5471.20m, 5400m), "C.H. Monción", []).Single();
        Assert.Equal(TipoAviso.DiferenciaMayor1Pct, a.Tipo);
    }

    [Fact]
    public void Proveedor_en_cero_con_egehid_positivo()
    {
        Assert.Equal(TipoAviso.ProveedorCero, DetectorAvisos.Evaluar(Con(0, 2100m), null, []).Single().Tipo);
    }

    [Fact]
    public void Entrega_sobre_150_por_ciento_de_la_mediana()
    {
        var avisos = DetectorAvisos.Evaluar(Con(10000m, 10000m), null, [3000m, 4000m, 3500m, 3800m, 4200m]).ToList();
        Assert.Contains(avisos, a => a.Tipo == TipoAviso.SobreMediana);
    }

    [Fact]
    public void Entrega_normal_no_genera_avisos()
    {
        Assert.Empty(DetectorAvisos.Evaluar(Con(4212.40m, 4200m), null, [4000m, 4100m, 4300m]));
    }
}
