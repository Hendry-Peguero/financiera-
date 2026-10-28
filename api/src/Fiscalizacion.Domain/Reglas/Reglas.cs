using Fiscalizacion.Domain.Entidades;
using Fiscalizacion.Domain.Enums;

namespace Fiscalizacion.Domain.Reglas;

public class ReglaNegocioException(string mensaje) : Exception(mensaje);

public class ValidacionException(IReadOnlyDictionary<string, string[]> errores)
    : Exception("Hay datos pendientes o inválidos.")
{
    public IReadOnlyDictionary<string, string[]> Errores { get; } = errores;
}

public static class GeneradorNumero
{
    /// <summary>Número visible tipo <c>A3F9-21C0</c>: los primeros 8 hex del Id.</summary>
    public static string Desde(Guid id)
    {
        var hex = id.ToString("N").ToUpperInvariant();
        return $"{hex[..4]}-{hex[4..8]}";
    }
}

public record Calculos(
    decimal? DiferenciaGal,
    decimal? DiferenciaPct,
    decimal? ImporteProveedor,
    decimal? ImporteEgehid,
    decimal? DiferenciaImporte);

public static class Calculadora
{
    /// <summary>Diferencia = EGEHID − proveedor, a dos decimales; importes a centavos.</summary>
    public static Calculos Calcular(decimal? proveedor, decimal? egehid, decimal? precio)
    {
        decimal? dif = proveedor is { } p && egehid is { } e ? Redondear(e - p) : null;
        decimal? pct = dif is { } d && proveedor is > 0 ? Redondear(d / proveedor.Value * 100) : null;
        decimal? impP = precio is { } pr && proveedor is { } p2 ? Redondear(p2 * pr) : null;
        decimal? impE = precio is { } pr2 && egehid is { } e2 ? Redondear(e2 * pr2) : null;
        decimal? difImp = impP is { } a && impE is { } b ? b - a : null;
        return new Calculos(dif, pct, impP, impE, difImp);
    }

    public static decimal Redondear(decimal v) => Math.Round(v, 2, MidpointRounding.AwayFromZero);
}

public class Pendientes
{
    public Dictionary<string, List<string>> PorSeccion { get; } = new()
    {
        ["visita"] = [], ["suplidor"] = [], ["mediciones"] = [], ["controles"] = [], ["fotos"] = [], ["firmas"] = []
    };

    public bool HayPendientes => PorSeccion.Values.Any(l => l.Count > 0);

    public IReadOnlyDictionary<string, string[]> ComoErrores() =>
        PorSeccion.Where(kv => kv.Value.Count > 0).ToDictionary(kv => kv.Key, kv => kv.Value.ToArray());
}

public static class ValidadorFiscalizacion
{
    public static readonly RolFirma[] FirmasRequeridas =
    [
        RolFirma.AuditorActuante1, RolFirma.EncargadoRecibir, RolFirma.SupervisorCombustibles,
        RolFirma.RepresentanteProveedor
    ];

    public static Pendientes Pendientes(Entidades.Fiscalizacion f, IEnumerable<ControlPregunta> preguntas)
    {
        var r = new Pendientes();
        var v = r.PorSeccion["visita"];
        if (f.Visita.Fecha is null) v.Add("Falta la fecha.");
        if (f.Visita.HoraSalida is null) v.Add("Falta la hora de salida.");
        if (f.Visita.InicioProceso is null) v.Add("Falta la hora de inicio del proceso.");
        if (f.Visita.LocacionId is null) v.Add("Falta el destino.");
        if (f.Visita.HoraLlegada is null) v.Add("Falta la hora de llegada.");
        if (f.Visita.FinProceso is null) v.Add("Falta la hora de fin del proceso.");
        if (f.Visita is { InicioProceso: { } ini, FinProceso: { } fin } && fin < ini)
            v.Add("El fin del proceso es anterior al inicio.");

        var s = r.PorSeccion["suplidor"];
        if (Vacio(f.Suplidor.FichaCamion)) s.Add("Falta la ficha del camión.");
        if (Vacio(f.Suplidor.Chofer)) s.Add("Falta el chofer.");
        if (Vacio(f.Suplidor.Placa)) s.Add("Falta la placa.");
        if (Vacio(f.Suplidor.Conduce)) s.Add("Falta el conduce.");
        if (f.Suplidor.SuplidorId is null && Vacio(f.Suplidor.Nombre)) s.Add("Falta la empresa suplidora.");
        if (f.Suplidor.TotalEntregarGal is null) s.Add("Falta el total a entregar.");
        if (Vacio(f.Empresa.Responsable)) s.Add("Falta el responsable de EGEHID.");
        if (f.Empresa.TotalRecibirGal is null) s.Add("Falta el total a recibir.");

        var m = r.PorSeccion["mediciones"];
        if (f.Mediciones.ProductoId is null) m.Add("Falta el producto.");
        if (f.Mediciones.GalonesProveedor is null) m.Add("Faltan los galones según proveedor.");
        if (f.Mediciones.GalonesEgehid is null) m.Add("Faltan los galones medidos por EGEHID.");
        foreach (var l in f.Lecturas.Where(l => l.Inicial is { } i && l.Final is { } fi && fi < i))
            m.Add($"La lectura final de {l.Equipo} es menor que la inicial.");

        var c = r.PorSeccion["controles"];
        foreach (var p in preguntas.Where(p => p.Activa).OrderBy(p => p.Numero))
        {
            var resp = f.Controles.FirstOrDefault(x => x.PreguntaNumero == p.Numero);
            if (resp?.Respuesta is null)
                c.Add($"Falta responder el control {p.Numero}.");
            else if (resp.Respuesta == true && p.ObservacionObligatoriaSiSi && Vacio(resp.Observacion))
                c.Add($"El control {p.Numero} respondió Sí: la observación es obligatoria.");
        }

        var fi2 = r.PorSeccion["firmas"];
        foreach (var rol in FirmasRequeridas.Where(rol => f.Firmas.All(x => x.Rol != rol)))
            fi2.Add($"Falta la firma de {NombreRol(rol)}.");

        return r;
    }

    public static string NombreRol(RolFirma rol) => rol switch
    {
        RolFirma.AuditorActuante1 => "Auditor actuante 1",
        RolFirma.AuditorActuante2 => "Auditor actuante 2",
        RolFirma.EncargadoRecibir => "Encargado de recibir",
        RolFirma.SupervisorCombustibles => "Supervisor de combustibles",
        RolFirma.RepresentanteProveedor => "Representante del proveedor",
        RolFirma.AuditorCierre1 => "Auditor de cierre 1",
        RolFirma.AuditorCierre2 => "Auditor de cierre 2",
        RolFirma.AuditorUai => "Auditor UAI",
        _ => rol.ToString()
    };

    private static bool Vacio(string? s) => string.IsNullOrWhiteSpace(s);
}

public record Aviso(Guid FiscalizacionId, string Numero, string? Locacion, TipoAviso Tipo, string Mensaje);

public static class DetectorAvisos
{
    /// <summary>Avisos orientativos: no son límites oficiales ni prueban irregularidad.</summary>
    public static IEnumerable<Aviso> Evaluar(Entidades.Fiscalizacion f, string? locacion, IEnumerable<decimal> ultimasEntregasLocacion)
    {
        var prov = f.Mediciones.GalonesProveedor;
        var egehid = f.Mediciones.GalonesEgehid;
        var calc = f.Calcular();

        if (prov == 0 && egehid > 0)
            yield return new Aviso(f.Id, f.Numero, locacion, TipoAviso.ProveedorCero,
                $"Proveedor en cero con medición EGEHID de {egehid:N2} gal");
        else if (calc.DiferenciaPct is { } pct && Math.Abs(pct) > 1)
            yield return new Aviso(f.Id, f.Numero, locacion, TipoAviso.DiferenciaMayor1Pct,
                $"Diferencia de {pct:N2} % sobre lo declarado por el proveedor");

        var previas = ultimasEntregasLocacion.Take(5).OrderBy(x => x).ToList();
        if (egehid is { } g && previas.Count >= 3)
        {
            var mediana = previas.Count % 2 == 1
                ? previas[previas.Count / 2]
                : (previas[previas.Count / 2 - 1] + previas[previas.Count / 2]) / 2;
            if (mediana > 0 && g > mediana * 1.5m)
                yield return new Aviso(f.Id, f.Numero, locacion, TipoAviso.SobreMediana,
                    $"Entrega {Math.Round(g / mediana * 100):N0} % sobre la mediana de las últimas {previas.Count}");
        }
    }
}
