using System.Globalization;
using Fiscalizacion.Application.Abstracciones;
using Fiscalizacion.Application.Dtos;
using Fiscalizacion.Application.Fiscalizaciones;
using Fiscalizacion.Domain.Enums;
using Fiscalizacion.Domain.Reglas;
using Microsoft.EntityFrameworkCore;
using FiscalizacionEntidad = Fiscalizacion.Domain.Entidades.Fiscalizacion;

namespace Fiscalizacion.Application.Estadisticas;

public class ServicioEstadisticas(IAppDbContext db, IUsuarioActual usuario, IReloj reloj)
{
    /// <summary>Solo cuentan las versiones vigentes de registros finalizados o modificados, fuera de la papelera.</summary>
    private IQueryable<FiscalizacionEntidad> Vigentes()
    {
        var q = db.Fiscalizaciones.AsNoTracking()
            .Where(f => !f.EnPapelera && (f.Estado == EstadoFiscalizacion.Finalizado || f.Estado == EstadoFiscalizacion.Modificado));
        return usuario.EsAdministrador ? q : q.Where(f => f.AutorId == usuario.Id);
    }

    public async Task<ResumenInicioDto> ResumenAsync(CancellationToken ct)
    {
        var hoy = DateOnly.FromDateTime(reloj.Ahora);
        var inicioMes = new DateOnly(hoy.Year, hoy.Month, 1);
        var inicioAnterior = inicioMes.AddMonths(-1);

        var vigentes = Vigentes();
        var finalizadosMes = await vigentes.CountAsync(f => f.Visita.Fecha >= inicioMes, ct);
        var finalizadosAnterior = await vigentes.CountAsync(f => f.Visita.Fecha >= inicioAnterior && f.Visita.Fecha < inicioMes, ct);
        var galonesMes = await vigentes.Where(f => f.Visita.Fecha >= inicioMes).SumAsync(f => f.Mediciones.GalonesEgehid ?? 0, ct);

        var borradores = db.Fiscalizaciones.AsNoTracking().Where(f => !f.EnPapelera && f.Estado == EstadoFiscalizacion.Borrador);
        if (!usuario.EsAdministrador) borradores = borradores.Where(f => f.AutorId == usuario.Id);
        var totalBorradores = await borradores.CountAsync(ct);
        var requeridas = ValidadorFiscalizacion.FirmasRequeridas;
        var conFirmasIncompletas = await borradores
            .CountAsync(f => f.Firmas.Count(x => requeridas.Contains(x.Rol)) < requeridas.Length, ct);

        var recientesQ = db.Fiscalizaciones.AsNoTracking().Where(f => !f.EnPapelera);
        if (!usuario.EsAdministrador) recientesQ = recientesQ.Where(f => f.AutorId == usuario.Id);
        var recientes = await ServicioFiscalizaciones.Resumenes(recientesQ
            .OrderByDescending(f => f.Visita.Fecha).ThenByDescending(f => f.ActualizadoEn).Take(8)).ToListAsync(ct);

        var avisos = await AvisosAsync(inicioMes.AddMonths(-2), hoy, null, ct);
        return new ResumenInicioDto(finalizadosMes, finalizadosAnterior, totalBorradores, conFirmasIncompletas,
            galonesMes, avisos.Take(5).ToList(), recientes);
    }

    public async Task<EstadisticasDto> EstadisticasAsync(DateOnly? desde, DateOnly? hasta, int? locacionId, string? agrupar, CancellationToken ct)
    {
        var hoy = DateOnly.FromDateTime(reloj.Ahora);
        var d = desde ?? hoy.AddMonths(-3);
        var h = hasta ?? hoy;
        var q = Vigentes().Where(f => f.Visita.Fecha >= d && f.Visita.Fecha <= h);
        if (locacionId is { } l) q = q.Where(f => f.Visita.LocacionId == l);

        var filas = await q.Select(f => new
        {
            Fecha = f.Visita.Fecha!.Value,
            Locacion = f.Visita.Locacion!.Nombre,
            Proveedor = f.Mediciones.GalonesProveedor ?? 0,
            Egehid = f.Mediciones.GalonesEgehid ?? 0
        }).ToListAsync(ct);

        var totalP = filas.Sum(x => x.Proveedor);
        var totalE = filas.Sum(x => x.Egehid);
        var dif = totalE - totalP;

        Func<DateOnly, string> periodo = (agrupar ?? "semana").ToLowerInvariant() switch
        {
            "dia" => f => f.ToString("yyyy-MM-dd"),
            "mes" => f => f.ToString("yyyy-MM"),
            _ => f => $"S{ISOWeek.GetWeekOfYear(f.ToDateTime(TimeOnly.MinValue)):00}"
        };
        var series = filas.GroupBy(x => periodo(x.Fecha))
            .Select(g => new { g.Key, Min = g.Min(x => x.Fecha), P = g.Sum(x => x.Proveedor), E = g.Sum(x => x.Egehid) })
            .OrderBy(x => x.Min)
            .Select(x => new SerieDto(x.Key, x.P, x.E)).ToList();
        var porLocacion = filas.GroupBy(x => x.Locacion)
            .Select(g => new GalonesLocacionDto(g.Key, g.Sum(x => x.Egehid)))
            .OrderByDescending(x => x.Galones).ToList();

        return new EstadisticasDto(filas.Count, totalP, totalE, dif,
            totalP > 0 ? Calculadora.Redondear(dif / totalP * 100) : null, series, porLocacion,
            await AvisosAsync(d, h, locacionId, ct));
    }

    public async Task<IReadOnlyList<AvisoDto>> AvisosAsync(DateOnly desde, DateOnly hasta, int? locacionId, CancellationToken ct)
    {
        var q = Vigentes().Include(f => f.Visita.Locacion).Where(f => f.Visita.Fecha >= desde && f.Visita.Fecha <= hasta);
        if (locacionId is { } l) q = q.Where(f => f.Visita.LocacionId == l);
        var registros = await q.OrderByDescending(f => f.Visita.Fecha).Take(500).ToListAsync(ct);

        // Historial por locación para la mediana de las 5 entregas anteriores.
        var locaciones = registros.Select(f => f.Visita.LocacionId).Distinct().ToList();
        var historial = await Vigentes()
            .Where(f => locaciones.Contains(f.Visita.LocacionId) && f.Visita.Fecha <= hasta && f.Mediciones.GalonesEgehid != null)
            .Select(f => new { f.Id, f.Visita.LocacionId, Fecha = f.Visita.Fecha, f.CreadoEn, Galones = f.Mediciones.GalonesEgehid!.Value })
            .ToListAsync(ct);

        return registros.SelectMany(f =>
        {
            var previas = historial
                .Where(x => x.LocacionId == f.Visita.LocacionId && x.Id != f.Id
                            && (x.Fecha < f.Visita.Fecha || (x.Fecha == f.Visita.Fecha && x.CreadoEn < f.CreadoEn)))
                .OrderByDescending(x => x.Fecha).ThenByDescending(x => x.CreadoEn).Take(5).Select(x => x.Galones);
            return DetectorAvisos.Evaluar(f, f.Visita.Locacion?.Nombre, previas);
        }).Select(a => new AvisoDto(a.FiscalizacionId, a.Numero, a.Locacion, a.Tipo, a.Mensaje)).ToList();
    }
}
