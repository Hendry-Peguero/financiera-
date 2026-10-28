using Fiscalizacion.Application.Comun;
using Fiscalizacion.Application.Dtos;
using Fiscalizacion.Domain.Entidades;
using Fiscalizacion.Domain.Reglas;
using FiscalizacionEntidad = Fiscalizacion.Domain.Entidades.Fiscalizacion;

namespace Fiscalizacion.Application.Fiscalizaciones;

public static class Mapeo
{
    public static FiscalizacionDto ADto(FiscalizacionEntidad f, IEnumerable<ControlPregunta> preguntas) => new(
        f.Id, f.Numero, f.Estado, f.VersionActual, f.RowVersion.Length == 0 ? null : f.RowVersion, f.EnPapelera,
        new AutorDto(f.AutorId, f.Autor?.NombreCompleto ?? ""), f.CreadoEn, f.ActualizadoEn,
        new VisitaDto(f.Visita.Fecha, f.Visita.HoraSalida, f.Visita.InicioProceso, f.Visita.LocacionId,
            f.Visita.HoraLlegada, f.Visita.FinProceso),
        new DatosSuplidorDto(f.Suplidor.FichaCamion, f.Suplidor.Chofer, f.Suplidor.Placa, f.Suplidor.Conduce,
            f.Suplidor.SuplidorId, f.Suplidor.TotalEntregarGal, f.Suplidor.Nombre ?? f.Suplidor.Suplidor?.Nombre),
        new DatosEmpresaDto(f.Empresa.FichaCamion2, f.Empresa.Chofer2, f.Empresa.Responsable, f.Empresa.TotalRecibirGal,
            f.Empresa.FichaCamion1, f.Empresa.Chofer1),
        new MedicionesDto(f.Mediciones.ProductoId, f.Mediciones.GalonesProveedor, f.Mediciones.GalonesEgehid,
            f.Mediciones.PrecioGalon,
            Enum.GetValues<Domain.Enums.Equipo>().Select(eq => f.Lecturas.FirstOrDefault(l => l.Equipo == eq) is { } l
                ? new LecturaDto(eq, l.Inicial, l.Final)
                : new LecturaDto(eq, null, null)).ToList(),
            new VaraDto(f.Mediciones.VaraInicialMedida, f.Mediciones.VaraInicialGalones,
                f.Mediciones.VaraFinalMedida, f.Mediciones.VaraFinalGalones)),
        f.Calcular(),
        f.Controles.OrderBy(c => c.PreguntaNumero).Select(c => new ControlDto(c.PreguntaNumero, c.Respuesta, c.Observacion)).ToList(),
        f.ObservacionesGenerales,
        f.Fotos.OrderBy(x => x.Orden).Select(x => new FotoDto(x.Id, x.Orden, x.Descripcion, x.TamanoBytes, x.Sha256)).ToList(),
        f.Firmas.OrderBy(x => x.Rol).Select(x => new FirmaDto(x.Rol, x.NombreFirmante, x.Cedula, x.Modo, x.FirmadoEn, x.UsuarioId)).ToList(),
        ValidadorFiscalizacion.Pendientes(f, preguntas).PorSeccion.ToDictionary(kv => kv.Key, kv => kv.Value.ToArray()));

    /// <summary>Copia la entrada sobre la entidad. Solo toca las secciones presentes en la entrada.</summary>
    public static void Aplicar(FiscalizacionEntidad f, FiscalizacionEntradaDto e, ISet<int> preguntasValidas)
    {
        var errores = new Dictionary<string, string[]>();

        if (e.Visita is { } v)
        {
            f.Visita.Fecha = v.Fecha;
            f.Visita.HoraSalida = v.HoraSalida;
            f.Visita.InicioProceso = v.InicioProceso;
            f.Visita.LocacionId = v.LocacionId;
            f.Visita.HoraLlegada = v.HoraLlegada;
            f.Visita.FinProceso = v.FinProceso;
        }

        if (e.Suplidor is { } s)
        {
            f.Suplidor.FichaCamion = Texto.Limpiar(s.FichaCamion, 30);
            f.Suplidor.Chofer = Texto.Limpiar(s.Chofer, 120);
            f.Suplidor.Placa = Texto.Limpiar(s.Placa, 20);
            f.Suplidor.Conduce = Texto.Limpiar(s.Conduce, 40);
            f.Suplidor.Nombre = Texto.Limpiar(s.Nombre, 150);
            f.Suplidor.SuplidorId = s.SuplidorId;
            f.Suplidor.TotalEntregarGal = s.TotalEntregarGal;
        }

        if (e.Empresa is { } em)
        {
            f.Empresa.FichaCamion1 = Texto.Limpiar(em.FichaCamion1, 30);
            f.Empresa.Chofer1 = Texto.Limpiar(em.Chofer1, 120);
            f.Empresa.FichaCamion2 = Texto.Limpiar(em.FichaCamion2, 30);
            f.Empresa.Chofer2 = Texto.Limpiar(em.Chofer2, 120);
            f.Empresa.Responsable = Texto.Limpiar(em.Responsable, 120);
            f.Empresa.TotalRecibirGal = em.TotalRecibirGal;
        }

        if (e.Mediciones is { } m)
        {
            f.Mediciones.ProductoId = m.ProductoId;
            f.Mediciones.GalonesProveedor = m.GalonesProveedor;
            f.Mediciones.GalonesEgehid = m.GalonesEgehid;
            f.Mediciones.PrecioGalon = m.PrecioGalon;
            f.Mediciones.VaraInicialMedida = Texto.Limpiar(m.Vara?.InicialMedida, 30);
            f.Mediciones.VaraInicialGalones = m.Vara?.InicialGalones;
            f.Mediciones.VaraFinalMedida = Texto.Limpiar(m.Vara?.FinalMedida, 30);
            f.Mediciones.VaraFinalGalones = m.Vara?.FinalGalones;

            if (m.Lecturas is { } lecturas)
            {
                if (lecturas.GroupBy(l => l.Equipo).Any(g => g.Count() > 1))
                    errores["mediciones.lecturas"] = ["Cada equipo puede aparecer una sola vez."];
                f.Lecturas.RemoveAll(l => lecturas.All(x => x.Equipo != l.Equipo));
                foreach (var l in lecturas.DistinctBy(l => l.Equipo))
                {
                    var actual = f.Lecturas.FirstOrDefault(x => x.Equipo == l.Equipo);
                    if (actual is null) f.Lecturas.Add(actual = new LecturaEquipo { FiscalizacionId = f.Id, Equipo = l.Equipo });
                    actual.Inicial = l.Inicial;
                    actual.Final = l.Final;
                }
            }
        }

        if (e.Controles is { } controles)
        {
            var invalidas = controles.Where(c => !preguntasValidas.Contains(c.Numero)).Select(c => c.Numero).ToList();
            if (invalidas.Count > 0) errores["controles"] = [$"Controles inexistentes: {string.Join(", ", invalidas)}."];
            foreach (var c in controles.Where(c => preguntasValidas.Contains(c.Numero)).DistinctBy(c => c.Numero))
            {
                var actual = f.Controles.FirstOrDefault(x => x.PreguntaNumero == c.Numero);
                if (actual is null) f.Controles.Add(actual = new RespuestaControl { FiscalizacionId = f.Id, PreguntaNumero = c.Numero });
                actual.Respuesta = c.Respuesta;
                actual.Observacion = Texto.Limpiar(c.Observacion, 500);
            }
        }

        if (e.ObservacionesGenerales is not null)
            f.ObservacionesGenerales = Texto.Limpiar(e.ObservacionesGenerales, 4000);

        if (errores.Count > 0) throw new ValidacionException(errores);
    }

    /// <summary>Vista plana campo → valor, para comparar versiones.</summary>
    public static Dictionary<string, string?> Aplanar(FiscalizacionDto d)
    {
        var r = new Dictionary<string, string?>
        {
            ["Fecha"] = d.Visita.Fecha?.ToString("dd/MM/yyyy"),
            ["Hora de salida"] = d.Visita.HoraSalida?.ToString("HH:mm"),
            ["Inicio del proceso"] = d.Visita.InicioProceso?.ToString("HH:mm"),
            ["Destino"] = d.Visita.LocacionId?.ToString(),
            ["Hora de llegada"] = d.Visita.HoraLlegada?.ToString("HH:mm"),
            ["Fin del proceso"] = d.Visita.FinProceso?.ToString("HH:mm"),
            ["Ficha camión"] = d.Suplidor.FichaCamion,
            ["Chofer"] = d.Suplidor.Chofer,
            ["Placa"] = d.Suplidor.Placa,
            ["Conduce"] = d.Suplidor.Conduce,
            ["Empresa"] = d.Suplidor.Nombre ?? d.Suplidor.SuplidorId?.ToString(),
            ["Total a entregar"] = d.Suplidor.TotalEntregarGal?.ToString("N2"),
            ["Ficha camión (empresa)"] = d.Empresa.FichaCamion1,
            ["Chofer (empresa)"] = d.Empresa.Chofer1,
            ["Ficha camión 2"] = d.Empresa.FichaCamion2,
            ["Chofer 2"] = d.Empresa.Chofer2,
            ["Responsable"] = d.Empresa.Responsable,
            ["Total a recibir"] = d.Empresa.TotalRecibirGal?.ToString("N2"),
            ["Producto"] = d.Mediciones.ProductoId?.ToString(),
            ["Galones según proveedor"] = d.Mediciones.GalonesProveedor?.ToString("N2"),
            ["Galones medidos EGEHID"] = d.Mediciones.GalonesEgehid?.ToString("N2"),
            ["Precio por galón"] = d.Mediciones.PrecioGalon?.ToString("N4"),
            ["Vara inicial"] = $"{d.Mediciones.Vara?.InicialMedida} = {d.Mediciones.Vara?.InicialGalones:N2}",
            ["Vara final"] = $"{d.Mediciones.Vara?.FinalMedida} = {d.Mediciones.Vara?.FinalGalones:N2}",
            ["Observaciones generales"] = d.ObservacionesGenerales
        };
        foreach (var l in d.Mediciones.Lecturas ?? [])
        {
            r[$"{l.Equipo} inicial"] = l.Inicial?.ToString("N2");
            r[$"{l.Equipo} final"] = l.Final?.ToString("N2");
        }
        foreach (var c in d.Controles)
        {
            r[$"Control {c.Numero}"] = c.Respuesta switch { true => "Sí", false => "No", null => null };
            r[$"Control {c.Numero} · observación"] = c.Observacion;
        }
        foreach (var x in d.Firmas)
            r[$"Firma · {ValidadorFiscalizacion.NombreRol(x.Rol)}"] = $"{x.NombreFirmante} {x.FirmadoEn:dd/MM/yyyy HH:mm}";
        r["Fotos"] = d.Fotos.Count.ToString();
        return r;
    }
}
