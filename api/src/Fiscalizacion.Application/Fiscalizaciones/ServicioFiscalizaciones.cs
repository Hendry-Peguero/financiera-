using System.Text.Json;
using Fiscalizacion.Application.Abstracciones;
using Fiscalizacion.Application.Comun;
using Fiscalizacion.Application.Dtos;
using Fiscalizacion.Application.Pdf;
using Fiscalizacion.Domain.Entidades;
using Fiscalizacion.Domain.Enums;
using Fiscalizacion.Domain.Reglas;
using Microsoft.EntityFrameworkCore;
using FiscalizacionEntidad = Fiscalizacion.Domain.Entidades.Fiscalizacion;

namespace Fiscalizacion.Application.Fiscalizaciones;

/// <param name="pdf">Genera el PDF oficial de cada versión (sin él, el PDF se genera la primera vez que se pide).</param>
public class ServicioFiscalizaciones(IAppDbContext db, IUsuarioActual usuario, IReloj reloj, ComponedorPdf? pdf = null)
{
    private Guid UsuarioId => usuario.Id ?? throw new ProhibidoException("Usuario no identificado.");

    internal IQueryable<FiscalizacionEntidad> ConDetalle() => db.Fiscalizaciones
        .Include(f => f.Autor)
        .Include(f => f.Lecturas)
        .Include(f => f.Controles)
        .Include(f => f.Fotos)
        .Include(f => f.Firmas);

    internal Task<List<ControlPregunta>> PreguntasAsync(CancellationToken ct) =>
        db.ControlPreguntas.AsNoTracking().Where(p => p.Activa).ToListAsync(ct);

    internal async Task<FiscalizacionEntidad> CargarAsync(Guid id, CancellationToken ct) =>
        await ConDetalle().FirstOrDefaultAsync(f => f.Id == id, ct) ?? throw new NoEncontradoException("Fiscalización no encontrada.");

    /// <summary>Autor, administrador o firmante con solicitud pueden ver el registro.</summary>
    internal async Task VerificarLecturaAsync(FiscalizacionEntidad f, CancellationToken ct)
    {
        if (usuario.EsAdministrador || f.AutorId == usuario.Id) return;
        var tieneSolicitud = await db.SolicitudesFirma.AnyAsync(s => s.FiscalizacionId == f.Id && s.UsuarioDestinoId == usuario.Id, ct);
        if (!tieneSolicitud) throw new ProhibidoException();
    }

    internal void VerificarEscritura(FiscalizacionEntidad f)
    {
        if (!usuario.EsAdministrador && f.AutorId != usuario.Id) throw new ProhibidoException();
    }

    public async Task<FiscalizacionDto> ObtenerAsync(Guid id, CancellationToken ct)
    {
        var f = await CargarAsync(id, ct);
        await VerificarLecturaAsync(f, ct);
        return Mapeo.ADto(f, await PreguntasAsync(ct));
    }

    /// <summary>PUT idempotente: crea el borrador con el Id de la tablet o actualiza el existente.</summary>
    public async Task<FiscalizacionDto> GuardarAsync(Guid id, FiscalizacionEntradaDto entrada, CancellationToken ct)
    {
        // antes de cargar el registro: puede agregar un suplidor al catálogo (y guardar solo eso)
        entrada = await ResolverSuplidorAsync(entrada, ct);
        var preguntas = await PreguntasAsync(ct);
        var f = await ConDetalle().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (f is null)
        {
            // el formulario de la app es la plantilla oficial (las personalizadas no generan fiscalizaciones)
            var plantilla = await db.PlantillaVersiones
                .Where(v => v.Publicada && db.Plantillas.Any(p => p.Id == v.PlantillaId && p.Tipo == TipoPlantilla.Oficial))
                .OrderByDescending(v => v.PublicadaEn)
                .Select(v => v.Id)
                .FirstAsync(ct);
            f = FiscalizacionEntidad.Nueva(id, UsuarioId, plantilla, reloj.Ahora);
            db.Fiscalizaciones.Add(f);
        }
        else
        {
            VerificarEscritura(f);
            if (!f.EsEditable)
                throw new ConflictoException("Solo se puede editar un borrador. Use «Corregir registro».", Mapeo.ADto(f, preguntas));
            if (entrada.RowVersion is null || !entrada.RowVersion.SequenceEqual(f.RowVersion))
                throw new ConflictoException("El registro cambió en otro equipo.", Mapeo.ADto(f, preguntas));
        }

        Mapeo.Aplicar(f, entrada, preguntas.Select(p => p.Numero).ToHashSet());
        f.ActualizadoEn = reloj.Ahora;
        await GuardarCambiosAsync(ct);
        return Mapeo.ADto(f, preguntas);
    }

    public async Task<FiscalizacionDto> FinalizarAsync(Guid id, CancellationToken ct)
    {
        var preguntas = await PreguntasAsync(ct);
        var f = await CargarAsync(id, ct);
        VerificarEscritura(f);
        // reintento de la tablet que no recibió la respuesta: ya está finalizado → se devuelve tal cual
        if (f.Estado is EstadoFiscalizacion.Finalizado or EstadoFiscalizacion.Modificado && !f.EnPapelera)
            return Mapeo.ADto(f, preguntas);
        f.Finalizar(preguntas, reloj.Ahora);
        var dto = Mapeo.ADto(f, preguntas);
        var version = NuevaVersion(f, dto, 1, "Registro finalizado");
        db.FiscalizacionVersiones.Add(version);
        if (pdf is not null) await pdf.IntentarGenerarVersionAsync(version, ct);
        await GuardarCambiosAsync(ct);
        return Mapeo.ADto(f, preguntas);
    }

    /// <summary>Corrige un registro finalizado: conserva el número y archiva la versión anterior.</summary>
    public async Task<FiscalizacionDto> CorregirAsync(Guid id, FiscalizacionEntradaDto entrada, CancellationToken ct)
    {
        // antes de cargar el registro: puede agregar un suplidor al catálogo (y guardar solo eso)
        entrada = await ResolverSuplidorAsync(entrada, ct);
        var preguntas = await PreguntasAsync(ct);
        var f = await CargarAsync(id, ct);
        VerificarEscritura(f);
        if (f.Estado is not (EstadoFiscalizacion.Finalizado or EstadoFiscalizacion.Modificado) || f.EnPapelera)
            throw new ConflictoException("Solo se corrigen registros finalizados.");
        if (entrada.RowVersion is null || !entrada.RowVersion.SequenceEqual(f.RowVersion))
            throw new ConflictoException("El registro cambió en otro equipo.", Mapeo.ADto(f, preguntas));

        var antes = Mapeo.Aplanar(Mapeo.ADto(f, preguntas));
        Mapeo.Aplicar(f, entrada, preguntas.Select(p => p.Numero).ToHashSet());
        var pendientes = ValidadorFiscalizacion.Pendientes(f, preguntas);
        if (pendientes.HayPendientes) throw new ValidacionException(pendientes.ComoErrores());

        var dto = Mapeo.ADto(f, preguntas);
        var despues = Mapeo.Aplanar(dto);
        var cambios = despues.Keys.Union(antes.Keys)
            .Where(k => antes.GetValueOrDefault(k) != despues.GetValueOrDefault(k))
            .Select(k => new CambioCampo { Campo = k, ValorAnterior = antes.GetValueOrDefault(k), ValorNuevo = despues.GetValueOrDefault(k) })
            .ToList();
        if (cambios.Count == 0) throw new ReglaNegocioException("No hay cambios que guardar.");

        f.VersionActual++;
        f.Estado = EstadoFiscalizacion.Modificado;
        f.ActualizadoEn = reloj.Ahora;
        var version = NuevaVersion(f, dto with { VersionActual = f.VersionActual, Estado = f.Estado }, f.VersionActual,
            "Corrigió " + string.Join(", ", cambios.Take(3).Select(c => c.Campo)) + (cambios.Count > 3 ? $" y {cambios.Count - 3} más" : ""));
        version.Cambios = cambios;
        db.FiscalizacionVersiones.Add(version);
        if (pdf is not null) await pdf.IntentarGenerarVersionAsync(version, ct);
        await GuardarCambiosAsync(ct);
        return Mapeo.ADto(f, preguntas);
    }

    public async Task MoverAPapeleraAsync(Guid id, CancellationToken ct)
    {
        var f = await CargarAsync(id, ct);
        VerificarEscritura(f);
        // Solo el administrador borra finalizados.
        if (f.Estado != EstadoFiscalizacion.Borrador && !usuario.EsAdministrador) throw new ProhibidoException();
        f.MoverAPapelera(UsuarioId, reloj.Ahora);
        await db.SaveChangesAsync(ct);
    }

    public async Task<FiscalizacionDto> RestaurarAsync(Guid id, CancellationToken ct)
    {
        if (!usuario.EsAdministrador) throw new ProhibidoException();
        var f = await CargarAsync(id, ct);
        f.Restaurar();
        await db.SaveChangesAsync(ct);
        return Mapeo.ADto(f, await PreguntasAsync(ct));
    }

    public async Task<IReadOnlyList<VersionDto>> VersionesAsync(Guid id, CancellationToken ct)
    {
        if (!usuario.EsAdministrador) throw new ProhibidoException("Solo el administrador ve versiones anteriores.");
        var actual = await db.Fiscalizaciones.Where(f => f.Id == id).Select(f => (int?)f.VersionActual).FirstOrDefaultAsync(ct)
                     ?? throw new NoEncontradoException("Fiscalización no encontrada.");
        var versiones = await db.FiscalizacionVersiones.AsNoTracking()
            .Where(v => v.FiscalizacionId == id)
            .Include(v => v.CreadoPor)
            .Include(v => v.Cambios)
            .OrderByDescending(v => v.Version)
            .ToListAsync(ct);
        return versiones.Select(v => new VersionDto(v.Version, v.CreadoEn, v.CreadoPor?.NombreCompleto ?? "", v.Resumen,
            v.Version == actual, v.Cambios.Select(c => new CambioCampoDto(c.Campo, c.ValorAnterior, c.ValorNuevo)).ToList())).ToList();
    }

    public async Task<ListaFiscalizacionesDto> ListarAsync(FiltroFiscalizaciones filtro, CancellationToken ct)
    {
        var q = db.Fiscalizaciones.AsNoTracking();
        if (!usuario.EsAdministrador) q = q.Where(f => f.AutorId == usuario.Id);
        if (filtro.Desde is { } d) q = q.Where(f => f.Visita.Fecha >= d);
        if (filtro.Hasta is { } h) q = q.Where(f => f.Visita.Fecha <= h);
        if (filtro.LocacionId is { } l) q = q.Where(f => f.Visita.LocacionId == l);
        if (filtro.SuplidorId is { } s) q = q.Where(f => f.Suplidor.SuplidorId == s);
        if (filtro.AutorId is { } a) q = q.Where(f => f.AutorId == a);
        if (!string.IsNullOrWhiteSpace(filtro.Texto))
        {
            var t = filtro.Texto.Trim();
            q = q.Where(f => f.Numero.Contains(t) || f.Suplidor.Chofer!.Contains(t) || f.Suplidor.Conduce!.Contains(t)
                             || f.Suplidor.Placa!.Contains(t) || f.Suplidor.Nombre!.Contains(t) || f.Suplidor.Suplidor!.Nombre.Contains(t)
                             || f.Visita.Locacion!.Nombre.Contains(t));
        }

        var porEstado = await q.Where(f => !f.EnPapelera).GroupBy(f => f.Estado)
            .Select(g => new { g.Key, Total = g.Count() }).ToListAsync(ct);
        var conteos = Enum.GetValues<EstadoFiscalizacion>()
            .ToDictionary(e => e.ToString(), e => porEstado.FirstOrDefault(x => x.Key == e)?.Total ?? 0);
        conteos["todos"] = porEstado.Sum(x => x.Total);
        conteos["papelera"] = await q.CountAsync(f => f.EnPapelera, ct);

        q = q.Where(f => f.EnPapelera == filtro.EnPapelera);
        if (filtro.Estado is { } e) q = q.Where(f => f.Estado == e);

        var tamano = Paginado<object>.Normalizar(filtro.Tamano);
        var pagina = Math.Max(1, filtro.Pagina);
        var total = await q.CountAsync(ct);
        var items = await Resumenes(q.OrderByDescending(f => f.Visita.Fecha).ThenByDescending(f => f.CreadoEn)
            .Skip((pagina - 1) * tamano).Take(tamano)).ToListAsync(ct);
        return new ListaFiscalizacionesDto(items, total, pagina, tamano, conteos);
    }

    /// <summary>
    /// «Empresa» es texto libre: se enlaza al suplidor del catálogo con el mismo nombre (sin distinguir mayúsculas,
    /// acentos ni espacios) o se agrega uno nuevo, para que filtros, estadísticas y avisos sigan por suplidor.
    /// Sin nombre (clientes anteriores) se toma el del catálogo por <c>SuplidorId</c>.
    /// </summary>
    private async Task<FiscalizacionEntradaDto> ResolverSuplidorAsync(FiscalizacionEntradaDto e, CancellationToken ct)
    {
        if (e.Suplidor is not { } s) return e;
        var nombre = Texto.Limpiar(s.Nombre, 150);
        if (nombre is null)
        {
            var delCatalogo = s.SuplidorId is { } id
                ? await db.Suplidores.Where(x => x.Id == id).Select(x => x.Nombre).FirstOrDefaultAsync(ct) : null;
            return e with { Suplidor = s with { Nombre = delCatalogo, SuplidorId = delCatalogo is null ? null : s.SuplidorId } };
        }
        var clave = Clave(nombre);
        var existente = (await db.Suplidores.Select(x => new { x.Id, x.Nombre }).ToListAsync(ct))
            .FirstOrDefault(x => Clave(x.Nombre) == clave);
        if (existente is not null) return e with { Suplidor = s with { Nombre = nombre, SuplidorId = existente.Id } };
        var nuevo = new Suplidor { Nombre = nombre, Activo = true };
        db.Suplidores.Add(nuevo);
        await db.SaveChangesAsync(ct);
        return e with { Suplidor = s with { Nombre = nombre, SuplidorId = nuevo.Id } };
    }

    /// <summary>Nombre para comparar: sin acentos, en minúsculas y con un solo espacio.</summary>
    internal static string Clave(string nombre)
    {
        var sinAcentos = new string(nombre.Normalize(System.Text.NormalizationForm.FormD)
            .Where(c => System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c) != System.Globalization.UnicodeCategory.NonSpacingMark)
            .ToArray());
        return string.Join(' ', sinAcentos.ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    internal static IQueryable<FiscalizacionResumenDto> Resumenes(IQueryable<FiscalizacionEntidad> q) =>
        q.Select(f => new FiscalizacionResumenDto(f.Id, f.Numero, f.Visita.Fecha, f.Visita.Locacion!.Nombre,
            f.Suplidor.Nombre ?? f.Suplidor.Suplidor!.Nombre, f.Autor!.NombreCompleto, f.Mediciones.GalonesProveedor, f.Mediciones.GalonesEgehid,
            f.Mediciones.GalonesEgehid - f.Mediciones.GalonesProveedor, f.VersionActual, f.Estado, f.EnPapelera));

    private FiscalizacionVersion NuevaVersion(FiscalizacionEntidad f, FiscalizacionDto dto, int version, string resumen) => new()
    {
        Id = Guid.NewGuid(),
        FiscalizacionId = f.Id,
        Version = version,
        SnapshotJson = JsonSerializer.Serialize(dto),
        Resumen = resumen,
        CreadoPorId = UsuarioId,
        CreadoEn = reloj.Ahora
    };

    internal async Task GuardarCambiosAsync(CancellationToken ct)
    {
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConflictoException("El registro cambió en otro equipo.");
        }
    }
}
