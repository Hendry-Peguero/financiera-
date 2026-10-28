using System.Globalization;
using Fiscalizacion.Application.Dtos;
using Fiscalizacion.Application.Plantillas;
using Fiscalizacion.Domain.Enums;

namespace Fiscalizacion.Application.Pdf;

/// <summary>Valor de un campo de plantilla ya listo para imprimir: texto o imagen (firma) con el nombre al pie.</summary>
public record ValorCampo(string? Texto, byte[]? Imagen = null, string? Pie = null);

/// <summary>
/// Valores de cada campo de <see cref="PlantillaOficial"/> para un registro: el PDF oficial es el formulario en papel
/// llenado con estos valores. Lo que no tiene valor queda en blanco, como en papel.
/// </summary>
public static class ValoresFormulario
{
    public static Dictionary<string, ValorCampo> Desde(DocumentoPdf d)
    {
        var r = d.Registro;
        var v = new Dictionary<string, ValorCampo>();
        void Poner(string id, string? texto)
        {
            if (!string.IsNullOrWhiteSpace(texto)) v[id] = new ValorCampo(texto.Trim());
        }

        if (d.Encabezado is { } e)
        {
            Poner("doc_codigo", e.Codigo);
            Poner("doc_version", e.Version);
            Poner("doc_fecha_elaboracion", FormatoPdf.Fecha(e.FechaElaboracion));
            Poner("doc_fecha_aprobacion", FormatoPdf.Fecha(e.FechaAprobacion));
        }

        Poner("fecha", FormatoPdf.Fecha(r.Visita.Fecha));
        Poner("hora_salida", FormatoPdf.Hora12(r.Visita.HoraSalida));
        Poner("inicio_proceso", FormatoPdf.Hora12(r.Visita.InicioProceso));
        Poner("locacion", d.Locacion);
        Poner("hora_llegada", FormatoPdf.Hora12(r.Visita.HoraLlegada));
        Poner("fin_proceso", FormatoPdf.Hora12(r.Visita.FinProceso));

        Poner("ficha_camion", r.Suplidor.FichaCamion);
        Poner("chofer", r.Suplidor.Chofer);
        Poner("placa", r.Suplidor.Placa);
        Poner("conduce", r.Suplidor.Conduce);
        Poner("suplidor", d.Suplidor);
        Poner("total_entregar_gal", FormatoPdf.Num(r.Suplidor.TotalEntregarGal));

        Poner("empresa_ficha_camion", r.Empresa.FichaCamion1);
        Poner("empresa_chofer", r.Empresa.Chofer1);
        Poner("ficha_camion_2", r.Empresa.FichaCamion2);
        Poner("chofer_2", r.Empresa.Chofer2);
        Poner("responsable", r.Empresa.Responsable);
        Poner("total_recibir_gal", FormatoPdf.Num(r.Empresa.TotalRecibirGal));

        var m = r.Mediciones;
        foreach (var (equipo, id) in new[] { (Equipo.MedidorDigital, "medidor_digital"), (Equipo.Dispensador, "dispensador"), (Equipo.Electrobomba, "electrobomba") })
        {
            var l = m.Lecturas?.FirstOrDefault(x => x.Equipo == equipo);
            Poner($"{id}_inicial", FormatoPdf.Num(l?.Inicial));
            Poner($"{id}_final", FormatoPdf.Num(l?.Final));
            Poner($"{id}_diferencia", FormatoPdf.Num(Resta(l?.Final, l?.Inicial)));
        }
        Poner("vara_inicial_medida", m.Vara?.InicialMedida);
        Poner("vara_inicial_galones", Galones(m.Vara?.InicialGalones));
        Poner("vara_final_medida", m.Vara?.FinalMedida);
        Poner("vara_final_galones", Galones(m.Vara?.FinalGalones));
        Poner("vara_diferencia_galones", Galones(Resta(m.Vara?.FinalGalones, m.Vara?.InicialGalones)));

        var c = r.Calculos;
        Poner("galones_egehid", FormatoPdf.Num(m.GalonesEgehid));
        Poner("galones_proveedor", FormatoPdf.Num(m.GalonesProveedor));
        if (c.DiferenciaGal is { } dif)
            Poner("diferencia_gal", c.DiferenciaPct is { } pct ? $"{FormatoPdf.Num(dif)} ({FormatoPdf.Num(pct)} %)" : FormatoPdf.Num(dif));

        foreach (var control in r.Controles)
        {
            if (control.Respuesta is { } si) Poner(si ? $"control_{control.Numero}" : $"control_{control.Numero}_no", "X");
            var tipo = d.Preguntas.FirstOrDefault(p => p.Numero == control.Numero)?.TipoObservacion
                       ?? (control.Numero == 10 ? TipoObservacion.Fecha : TipoObservacion.Texto);
            Poner($"control_{control.Numero}_obs", tipo == TipoObservacion.Fecha ? FormatoPdf.FechaTexto(control.Observacion) : control.Observacion);
        }

        foreach (var (rol, id) in PlantillaOficial.Participantes)
        {
            if (d.Firmas.FirstOrDefault(f => f.Rol == rol) is not { } f) continue;
            var (nombre, apellido) = FormatoPdf.SepararNombre(f.NombreFirmante);
            Poner($"{id}_nombre", nombre);
            Poner($"{id}_apellido", apellido);
            Poner($"{id}_cedula", f.Cedula);
            if (f.Imagen is not null) v[$"firma_{id}"] = new ValorCampo(null, f.Imagen);
        }
        foreach (var (rol, id, _, _) in PlantillaOficial.FirmasCierre)
            if (d.Firmas.FirstOrDefault(f => f.Rol == rol) is { } f)
                v[$"firma_{id}"] = new ValorCampo(null, f.Imagen, f.NombreFirmante);

        Poner("precio_galon", FormatoPdf.Num(m.PrecioGalon));
        Poner("importe_egehid", FormatoPdf.Num(c.ImporteEgehid));
        Poner("importe_proveedor", FormatoPdf.Num(c.ImporteProveedor));
        Poner("diferencia_importe", FormatoPdf.Num(c.DiferenciaImporte));
        Poner("observaciones_generales", r.ObservacionesGenerales);
        return v;
    }

    private static string? Galones(decimal? n) => n is null ? null : $"{FormatoPdf.Num(n)} gal";

    private static decimal? Resta(decimal? final, decimal? inicial) => final is { } f && inicial is { } i ? f - i : null;
}

/// <summary>Formatos del PDF, iguales a los del front (num(), fechas dd/MM/yyyy, horas de 12 h).</summary>
public static class FormatoPdf
{
    private static readonly CultureInfo Numeros = CultureInfo.GetCultureInfo("en-US");
    private static readonly TimeZoneInfo Zona = ZonaRepublicaDominicana();

    /// <summary>4,212.40 con el signo menos tipográfico (−); null si no hay número.</summary>
    public static string? Num(decimal? n)
    {
        if (n is not { } v) return null;
        var s = Math.Abs(v).ToString("N2", Numeros);
        return v < 0 ? "−" + s : s;
    }

    public static string? Fecha(DateOnly? f) => f?.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);

    /// <summary>Observación tipo fecha (yyyy-MM-dd) → dd/MM/yyyy; si no es fecha, el texto tal cual.</summary>
    public static string? FechaTexto(string? s) =>
        DateOnly.TryParseExact(s?.Length >= 10 ? s[..10] : s, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var f)
            ? Fecha(f) : s;

    /// <summary>HH:mm → «07:15 AM».</summary>
    public static string? Hora12(TimeOnly? h) => h?.ToString("hh:mm tt", Numeros);

    /// <summary>Momento UTC → «19/10/2026 10:22 AM» en hora de República Dominicana.</summary>
    public static string Momento12(DateTime momento)
    {
        var utc = momento.Kind == DateTimeKind.Utc ? momento : DateTime.SpecifyKind(momento, DateTimeKind.Utc);
        return TimeZoneInfo.ConvertTimeFromUtc(utc, Zona).ToString("dd/MM/yyyy hh:mm tt", Numeros);
    }

    private static readonly HashSet<string> Titulos = new(StringComparer.OrdinalIgnoreCase)
        { "ing.", "ing", "lic.", "lic", "dr.", "dra.", "arq.", "sr.", "sra.", "lcdo.", "lcda." };

    /// <summary>
    /// Nombre completo → (nombre, apellidos) para «Personal participante»: 2 palabras = nombre + apellido; 3 o más =
    /// las 2 últimas son los apellidos, salvo que la del medio sea una inicial («José M. Guzmán»). El título (Ing.,
    /// Lic.…) queda con el nombre.
    /// </summary>
    public static (string nombre, string? apellido) SepararNombre(string completo)
    {
        var partes = completo.Split(' ', StringSplitOptions.RemoveEmptyEntries).ToList();
        var titulo = partes.Count > 1 && Titulos.Contains(partes[0]) ? partes[0] : null;
        if (titulo is not null) partes.RemoveAt(0);
        var apellidos = partes.Count switch
        {
            <= 1 => 0,
            2 => 1,
            3 when partes[1].Length <= 2 && partes[1].EndsWith('.') => 1,
            _ => 2,
        };
        var nombre = string.Join(' ', partes.Take(partes.Count - apellidos));
        var apellido = apellidos == 0 ? null : string.Join(' ', partes.Skip(partes.Count - apellidos));
        return (titulo is null ? nombre : $"{titulo} {nombre}", apellido);
    }

    private static TimeZoneInfo ZonaRepublicaDominicana()
    {
        foreach (var id in new[] { "America/Santo_Domingo", "SA Western Standard Time" })
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
            catch (TimeZoneNotFoundException) { }
            catch (InvalidTimeZoneException) { }
        }
        return TimeZoneInfo.CreateCustomTimeZone("AST", TimeSpan.FromHours(-4), "AST", "AST");
    }
}
