using Fiscalizacion.Application.Abstracciones;
using Fiscalizacion.Application.Comun;
using Fiscalizacion.Domain.Entidades;
using Fiscalizacion.Domain.Enums;
using Fiscalizacion.Domain.Reglas;
using Microsoft.EntityFrameworkCore;

namespace Fiscalizacion.Application.Plantillas;

/// <summary>
/// Plantillas de formularios: el Administrador importa un PDF, coloca campos encima y publica versiones; cualquier
/// usuario autenticado consulta las publicadas de las plantillas activas. Cada plantilla tiene a lo sumo un borrador
/// (la versión más alta sin publicar); publicarlo lo deja como versión vigente.
/// </summary>
public class ServicioPlantillas(IAppDbContext db, IUsuarioActual usuario, IReloj reloj, ILectorPdf lector)
{
    private record InfoVersion(int Id, int Version, bool Publicada, DateTime? PublicadaEn, bool TienePdf, int Campos);

    private record Estado(Plantilla Plantilla, List<InfoVersion> Versiones)
    {
        public InfoVersion? Publicada => Versiones.Where(v => v.Publicada).MaxBy(v => v.Version);
        public InfoVersion? Borrador => Versiones.Where(v => !v.Publicada && v.Version > (Publicada?.Version ?? 0)).MaxBy(v => v.Version);
    }

    // ---- Consultas ----

    public async Task<IReadOnlyList<PlantillaResumenDto>> ListarAsync(CancellationToken ct)
    {
        var plantillas = await db.Plantillas.AsNoTracking().ToListAsync(ct);
        var versiones = await InfoVersionesAsync(null, ct);
        return plantillas
            .Select(p => new Estado(p, versiones.Where(v => v.PlantillaId == p.Id).Select(v => v.Info).ToList()))
            .Where(Visible)
            .OrderBy(e => e.Plantilla.Tipo).ThenBy(e => e.Plantilla.Nombre)
            .Select(Resumen)
            .ToList();
    }

    /// <summary>Detalle de una versión: la pedida, o el borrador (Administrador) o la publicada vigente.</summary>
    public async Task<PlantillaDto> ObtenerAsync(int id, int? version, CancellationToken ct)
    {
        var e = await EstadoAsync(id, ct);
        var info = VersionVisible(e, version);
        var v = await db.PlantillaVersiones.AsNoTracking().Include(x => x.Campos).FirstAsync(x => x.Id == info.Id, ct);
        return Detalle(e, v);
    }

    public async Task<byte[]> PdfAsync(int id, int version, CancellationToken ct)
    {
        var e = await EstadoAsync(id, ct);
        var info = VersionVisible(e, version);
        var pdf = await db.PlantillaVersiones.Where(x => x.Id == info.Id).Select(x => x.PdfBase).FirstAsync(ct);
        return PdfDe(e.Plantilla, pdf) ?? throw new NoEncontradoException("Esta versión no tiene PDF base.");
    }

    // ---- Administración ----

    public async Task<PlantillaDto> CrearAsync(NuevaPlantillaDto dto, CancellationToken ct)
    {
        VerificarAdministrador();
        var nombre = await NombreLibreAsync(dto.Nombre, null, automatico: false, ct);
        return await AgregarAsync(nombre, null, [], ct);
    }

    public async Task<PlantillaDto> ImportarAsync(Stream contenido, string? contentType, long tamano, string? nombreArchivo,
        string? nombre, CancellationToken ct)
    {
        VerificarAdministrador();
        var pdf = await LeerPdfAsync(contenido, contentType, tamano, ct);
        var sugerido = string.IsNullOrWhiteSpace(nombre) ? Path.GetFileNameWithoutExtension(nombreArchivo ?? "") : nombre;
        var libre = await NombreLibreAsync(string.IsNullOrWhiteSpace(sugerido) ? "Plantilla importada" : sugerido, null, automatico: true, ct);
        return await AgregarAsync(libre, pdf, [], ct);
    }

    /// <summary>Copia el borrador (o la versión vigente) con su PDF y sus campos en una plantilla personalizada nueva.</summary>
    public async Task<PlantillaDto> DuplicarAsync(int id, DuplicarPlantillaDto dto, CancellationToken ct)
    {
        VerificarAdministrador();
        var e = await EstadoAsync(id, ct);
        var origen = e.Borrador ?? e.Publicada ?? e.Versiones.MaxBy(v => v.Version) ?? throw new NoEncontradoException();
        var v = await db.PlantillaVersiones.AsNoTracking().Include(x => x.Campos).FirstAsync(x => x.Id == origen.Id, ct);
        var nombre = await NombreLibreAsync(string.IsNullOrWhiteSpace(dto.Nombre) ? $"{e.Plantilla.Nombre} (copia)" : dto.Nombre,
            null, automatico: string.IsNullOrWhiteSpace(dto.Nombre), ct);
        return await AgregarAsync(nombre, PdfDe(e.Plantilla, v.PdfBase)?.ToArray(), CamposDe(e.Plantilla, v).Select(Copiar).ToList(), ct);
    }

    /// <summary>Código, versión y fechas del documento que se imprimen en el encabezado. Vale también para la oficial.</summary>
    public async Task<PlantillaDto> GuardarEncabezadoAsync(int id, EncabezadoPlantillaDto dto, CancellationToken ct)
    {
        VerificarAdministrador();
        var e = await EstadoAsync(id, ct, seguimiento: true);
        var errores = new Dictionary<string, List<string>>();
        if (dto.Codigo?.Trim().Length > ReglasPlantillas.MaxCodigoDocumento)
            errores["codigo"] = [$"El código supera {ReglasPlantillas.MaxCodigoDocumento} caracteres."];
        if (dto.Version?.Trim().Length > ReglasPlantillas.MaxVersionDocumento)
            errores["version"] = [$"La versión supera {ReglasPlantillas.MaxVersionDocumento} caracteres."];
        if (dto is { FechaElaboracion: { } el, FechaAprobacion: { } ap } && ap < el)
            errores["fechaAprobacion"] = ["La fecha de aprobación es anterior a la de elaboración."];
        Validar(errores);
        var p = e.Plantilla;
        p.CodigoDocumento = Texto.Limpiar(dto.Codigo, ReglasPlantillas.MaxCodigoDocumento);
        p.VersionDocumento = Texto.Limpiar(dto.Version, ReglasPlantillas.MaxVersionDocumento);
        p.FechaElaboracion = dto.FechaElaboracion;
        p.FechaAprobacion = dto.FechaAprobacion;
        await db.SaveChangesAsync(ct);
        return await ObtenerAsync(id, null, ct);
    }

    /// <summary>Guarda los campos (y el nombre) en el borrador; si no hay borrador, lo crea a partir de la versión vigente.</summary>
    public async Task<PlantillaDto> GuardarBorradorAsync(int id, GuardarBorradorDto dto, CancellationToken ct)
    {
        var e = await EstadoEditableAsync(id, ct);
        var (borrador, nuevo) = await BorradorAsync(e, ct);
        var campos = (dto.Campos ?? []).Select(Entidad).ToList();
        Validar(ReglasPlantillas.ValidarBorrador(campos, Medidas(borrador)));
        if (dto.Nombre is not null) e.Plantilla.Nombre = await NombreLibreAsync(dto.Nombre, id, automatico: false, ct);

        // por identificador: se actualizan los que siguen, se quitan los que ya no están y se agregan los nuevos
        var actuales = borrador.Campos.ToDictionary(c => c.Identificador);
        borrador.Campos.RemoveAll(c => !campos.Any(n => n.Identificador == c.Identificador));
        foreach (var n in campos)
        {
            if (actuales.TryGetValue(n.Identificador, out var c)) CopiarEn(n, c);
            else borrador.Campos.Add(n);
        }
        if (nuevo) db.PlantillaVersiones.Add(borrador);
        await db.SaveChangesAsync(ct);
        return await ObtenerAsync(id, null, ct);
    }

    public async Task<PlantillaDto> ReemplazarPdfAsync(int id, Stream contenido, string? contentType, long tamano, CancellationToken ct)
    {
        var e = await EstadoEditableAsync(id, ct);
        var pdf = await LeerPdfAsync(contenido, contentType, tamano, ct);
        var (borrador, nuevo) = await BorradorAsync(e, ct);
        borrador.PdfBase = pdf;
        Validar(ReglasPlantillas.ValidarBorrador(borrador.Campos, Medidas(borrador)));
        if (nuevo) db.PlantillaVersiones.Add(borrador);
        await db.SaveChangesAsync(ct);
        return await ObtenerAsync(id, null, ct);
    }

    /// <summary>Descarta el borrador. Si la plantilla nunca se publicó, se elimina completa (devuelve null).</summary>
    public async Task<PlantillaDto?> DescartarBorradorAsync(int id, CancellationToken ct)
    {
        var e = await EstadoEditableAsync(id, ct);
        var info = e.Borrador ?? throw new ReglaNegocioException("No hay un borrador para descartar.");
        var borrador = await db.PlantillaVersiones.Include(x => x.Campos).FirstAsync(x => x.Id == info.Id, ct);
        db.PlantillaVersiones.Remove(borrador);
        if (e.Publicada is null) db.Plantillas.Remove(e.Plantilla);
        await db.SaveChangesAsync(ct);
        return e.Publicada is null ? null : await ObtenerAsync(id, null, ct);
    }

    public async Task<PlantillaDto> PublicarAsync(int id, CancellationToken ct)
    {
        var e = await EstadoEditableAsync(id, ct);
        var info = e.Borrador ?? throw new ReglaNegocioException("No hay cambios por publicar.");
        var borrador = await db.PlantillaVersiones.Include(x => x.Campos).FirstAsync(x => x.Id == info.Id, ct);
        Validar(ReglasPlantillas.ValidarPublicacion(borrador.Campos, Medidas(borrador)));
        borrador.Publicada = true;
        borrador.PublicadaEn = reloj.Ahora;
        e.Plantilla.Estado = EstadoPlantilla.Activa;
        await db.SaveChangesAsync(ct);
        return await ObtenerAsync(id, null, ct);
    }

    public async Task<PlantillaDto> DesactivarAsync(int id, CancellationToken ct)
    {
        VerificarAdministrador();
        var e = await EstadoAsync(id, ct, seguimiento: true);
        if (e.Plantilla.Tipo == TipoPlantilla.Oficial)
            throw new ReglaNegocioException("La plantilla oficial no se puede desactivar: es la que usan las fiscalizaciones.");
        e.Plantilla.Estado = EstadoPlantilla.Desactivada;
        await db.SaveChangesAsync(ct);
        return await ObtenerAsync(id, null, ct);
    }

    public async Task<PlantillaDto> ActivarAsync(int id, CancellationToken ct)
    {
        VerificarAdministrador();
        var e = await EstadoAsync(id, ct, seguimiento: true);
        if (e.Publicada is null) throw new ReglaNegocioException("Publique la plantilla antes de activarla.");
        e.Plantilla.Estado = EstadoPlantilla.Activa;
        await db.SaveChangesAsync(ct);
        return await ObtenerAsync(id, null, ct);
    }

    // ---- Apoyo ----

    private void VerificarAdministrador()
    {
        if (!usuario.EsAdministrador) throw new ProhibidoException("Solo el Administrador gestiona las plantillas.");
    }

    private async Task<List<(int PlantillaId, InfoVersion Info)>> InfoVersionesAsync(int? plantillaId, CancellationToken ct)
    {
        var filas = await db.PlantillaVersiones.AsNoTracking()
            .Where(v => plantillaId == null || v.PlantillaId == plantillaId)
            .Select(v => new { v.PlantillaId, v.Id, v.Version, v.Publicada, v.PublicadaEn, TienePdf = v.PdfBase != null, Campos = v.Campos.Count })
            .ToListAsync(ct);
        return filas.Select(v => (v.PlantillaId, new InfoVersion(v.Id, v.Version, v.Publicada, v.PublicadaEn, v.TienePdf, v.Campos))).ToList();
    }

    private async Task<Estado> EstadoAsync(int id, CancellationToken ct, bool seguimiento = false)
    {
        var consulta = seguimiento ? db.Plantillas : db.Plantillas.AsNoTracking();
        var p = await consulta.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NoEncontradoException("Plantilla no encontrada.");
        var e = new Estado(p, (await InfoVersionesAsync(id, ct)).Select(x => x.Info).ToList());
        if (!Visible(e)) throw new NoEncontradoException("Plantilla no encontrada.");
        return e;
    }

    private async Task<Estado> EstadoEditableAsync(int id, CancellationToken ct)
    {
        VerificarAdministrador();
        var e = await EstadoAsync(id, ct, seguimiento: true);
        if (e.Plantilla.Tipo == TipoPlantilla.Oficial)
            throw new ReglaNegocioException("La plantilla oficial es el formulario de la aplicación y no se edita; duplíquela para crear una personalizada.");
        return e;
    }

    /// <summary>Los demás usuarios solo ven plantillas activas con una versión publicada.</summary>
    private bool Visible(Estado e) => usuario.EsAdministrador || (e.Plantilla.Estado == EstadoPlantilla.Activa && e.Publicada is not null);

    private InfoVersion VersionVisible(Estado e, int? version)
    {
        var info = version is { } n
            ? e.Versiones.FirstOrDefault(v => v.Version == n)
            : usuario.EsAdministrador ? e.Borrador ?? e.Publicada ?? e.Versiones.MaxBy(v => v.Version) : e.Publicada;
        if (info is null || (!usuario.EsAdministrador && !info.Publicada)) throw new NoEncontradoException("Versión no encontrada.");
        return info;
    }

    /// <summary>Borrador actual (con seguimiento) o uno nuevo copiado de la versión vigente, sin agregar todavía.</summary>
    private async Task<(PlantillaVersion borrador, bool nuevo)> BorradorAsync(Estado e, CancellationToken ct)
    {
        if (e.Borrador is { } b) return (await db.PlantillaVersiones.Include(x => x.Campos).FirstAsync(x => x.Id == b.Id, ct), false);
        var vigente = e.Publicada ?? throw new NoEncontradoException("La plantilla no tiene versiones.");
        var origen = await db.PlantillaVersiones.AsNoTracking().Include(x => x.Campos).FirstAsync(x => x.Id == vigente.Id, ct);
        return (new PlantillaVersion
        {
            PlantillaId = e.Plantilla.Id, Version = e.Versiones.Max(v => v.Version) + 1, PdfBase = origen.PdfBase,
            Campos = origen.Campos.Select(Copiar).ToList()
        }, true);
    }

    private async Task<PlantillaDto> AgregarAsync(string nombre, byte[]? pdf, List<PlantillaCampo> campos, CancellationToken ct)
    {
        var p = new Plantilla
        {
            Nombre = nombre, Tipo = TipoPlantilla.Personalizada, Estado = EstadoPlantilla.Borrador,
            Versiones = [new PlantillaVersion { Version = 1, PdfBase = pdf, Campos = campos }]
        };
        db.Plantillas.Add(p);
        await db.SaveChangesAsync(ct);
        return await ObtenerAsync(p.Id, null, ct);
    }

    /// <summary>Nombre limpio y único. Automático (importar, duplicar): agrega « (2)», « (3)»…; si no, error.</summary>
    private async Task<string> NombreLibreAsync(string? nombre, int? excepto, bool automatico, CancellationToken ct)
    {
        var limpio = Texto.Limpiar(nombre, ReglasPlantillas.MaxNombre)
                     ?? throw new ValidacionException(new Dictionary<string, string[]> { ["nombre"] = ["Escriba el nombre de la plantilla."] });
        var usados = (await db.Plantillas.Where(p => p.Id != excepto).Select(p => p.Nombre).ToListAsync(ct))
            .ToHashSet(StringComparer.CurrentCultureIgnoreCase);
        if (!usados.Contains(limpio)) return limpio;
        if (!automatico)
            throw new ValidacionException(new Dictionary<string, string[]> { ["nombre"] = [$"Ya existe una plantilla «{limpio}»."] });
        for (var n = 2; ; n++)
        {
            var sufijo = $" ({n})";
            var candidato = (limpio.Length + sufijo.Length > ReglasPlantillas.MaxNombre
                ? limpio[..(ReglasPlantillas.MaxNombre - sufijo.Length)] : limpio) + sufijo;
            if (!usados.Contains(candidato)) return candidato;
        }
    }

    private async Task<byte[]> LeerPdfAsync(Stream contenido, string? contentType, long tamano, CancellationToken ct)
    {
        if (tamano > ReglasPlantillas.MaxPdfBytes) throw new ReglaNegocioException("El PDF supera el máximo de 4 MB.");
        if (contentType is not null && contentType != "application/pdf" && contentType != "application/octet-stream")
            throw new ReglaNegocioException("El archivo debe ser un PDF.");
        using var buffer = new MemoryStream();
        // no confiar en el tamaño declarado: se lee como máximo un byte de más
        var bloque = new byte[81920];
        int leidos;
        while ((leidos = await contenido.ReadAsync(bloque, ct)) > 0)
        {
            buffer.Write(bloque, 0, leidos);
            if (buffer.Length > ReglasPlantillas.MaxPdfBytes) throw new ReglaNegocioException("El PDF supera el máximo de 4 MB.");
        }
        var bytes = buffer.ToArray();
        if (bytes.Length < 5 || bytes[0] != '%' || bytes[1] != 'P' || bytes[2] != 'D' || bytes[3] != 'F')
            throw new ReglaNegocioException("El archivo debe ser un PDF.");
        Paginas(bytes, [], validar: true); // legible y con 10 páginas como máximo
        return bytes;
    }

    /// <summary>
    /// Páginas de la versión: las del PDF base o, sin PDF, páginas carta (tantas como use la plantilla; al validar se
    /// permiten hasta 10).
    /// </summary>
    private IReadOnlyList<PaginaDto> Paginas(byte[]? pdfBase, IReadOnlyList<PlantillaCampo> campos, bool validar = false)
    {
        if (ReferenceEquals(pdfBase, PlantillaOficial.PdfBase)) return PlantillaOficial.Paginas;
        if (pdfBase is { } pdf)
        {
            var paginas = lector.Paginas(pdf);
            if (!validar) return paginas ?? PlantillaOficial.PaginasCarta(1);
            if (paginas is null || paginas.Count == 0) throw new ReglaNegocioException("El PDF está dañado o protegido con contraseña.");
            if (paginas.Count > ReglasPlantillas.MaxPaginas) throw new ReglaNegocioException("El PDF supera el máximo de 10 páginas.");
            return paginas;
        }
        return PlantillaOficial.PaginasCarta(validar ? ReglasPlantillas.MaxPaginas : campos.Select(c => c.Pagina).DefaultIfEmpty(1).Max());
    }

    private static void Validar(Dictionary<string, List<string>> errores)
    {
        if (errores.Count > 0) throw new ValidacionException(errores.ToDictionary(x => x.Key, x => x.Value.ToArray()));
    }

    /// <summary>Páginas para validar un borrador (falla si el PDF no se puede leer o pasa de 10 páginas).</summary>
    private IReadOnlyList<(decimal, decimal)> Medidas(PlantillaVersion v) =>
        Paginas(v.PdfBase, v.Campos, validar: true).Select(p => (p.Ancho, p.Alto)).ToList();

    /// <summary>La oficial no guarda PDF ni campos: usa el formulario de <see cref="PlantillaOficial"/>.</summary>
    private static byte[]? PdfDe(Plantilla p, byte[]? pdf) => pdf ?? (p.Tipo == TipoPlantilla.Oficial ? PlantillaOficial.PdfBase : null);

    private static List<PlantillaCampo> CamposDe(Plantilla p, PlantillaVersion v) =>
        p.Tipo == TipoPlantilla.Oficial && v.Campos.Count == 0 ? PlantillaOficial.Campos() : v.Campos;

    private static int TotalCampos(Plantilla p, InfoVersion? v) =>
        p.Tipo == TipoPlantilla.Oficial && v is { Campos: 0 } ? PlantillaOficial.Campos().Count : v?.Campos ?? 0;

    private static PlantillaResumenDto Resumen(Estado e)
    {
        var p = e.Plantilla;
        return new PlantillaResumenDto(p.Id, p.Nombre, p.Tipo, p.Estado, e.Publicada?.Version ?? 0, e.Borrador?.Version,
            TotalCampos(p, e.Publicada ?? e.Borrador), e.Publicada?.PublicadaEn);
    }

    private PlantillaDto Detalle(Estado e, PlantillaVersion v)
    {
        var p = e.Plantilla;
        var admin = usuario.EsAdministrador;
        var campos = CamposDe(p, v);
        var oficial = p.Tipo == TipoPlantilla.Oficial;
        var pdf = PdfDe(p, v.PdfBase);
        var versiones = e.Versiones.Where(x => admin || x.Publicada).OrderByDescending(x => x.Version)
            .Select(x => new VersionPlantillaDto(x.Version, x.Publicada, x.PublicadaEn, TotalCampos(p, x), x.TienePdf || oficial))
            .ToList();
        var actual = new PlantillaVersionDto(v.Version, v.Publicada, v.PublicadaEn, pdf is not null,
            Paginas(pdf, campos), campos.OrderBy(c => c.Pagina).ThenBy(c => c.Y).ThenBy(c => c.X).Select(Dto).ToList());
        return new PlantillaDto(p.Id, p.Nombre, p.Tipo, p.Estado, e.Publicada?.Version ?? 0, admin ? e.Borrador?.Version : null,
            admin && !oficial, versiones, actual,
            new EncabezadoPlantillaDto(p.CodigoDocumento, p.VersionDocumento, p.FechaElaboracion, p.FechaAprobacion));
    }

    private static CampoPlantillaDto Dto(PlantillaCampo c) => new(c.Identificador, c.Etiqueta, c.Tipo, c.Formula, c.Pagina,
        c.X, c.Y, c.Ancho, c.Alto, c.Obligatorio, c.EnEstadisticas, c.ImprimirPdf);

    private static PlantillaCampo Entidad(CampoPlantillaDto d) => new()
    {
        Identificador = (d.Identificador ?? "").Trim(), Etiqueta = (d.Etiqueta ?? "").Trim(), Tipo = d.Tipo,
        Formula = d.Tipo == TipoCampo.Formula ? Texto.Limpiar(d.Formula, ReglasPlantillas.MaxFormula + 1) : null,
        Pagina = d.Pagina, X = Math.Round(d.X, 2), Y = Math.Round(d.Y, 2), Ancho = Math.Round(d.Ancho, 2), Alto = Math.Round(d.Alto, 2),
        Obligatorio = d.Obligatorio, EnEstadisticas = d.EnEstadisticas, ImprimirPdf = d.ImprimirPdf
    };

    private static PlantillaCampo Copiar(PlantillaCampo c)
    {
        var n = new PlantillaCampo { Identificador = c.Identificador };
        CopiarEn(c, n);
        return n;
    }

    private static void CopiarEn(PlantillaCampo de, PlantillaCampo en)
    {
        en.Etiqueta = de.Etiqueta;
        en.Tipo = de.Tipo;
        en.Formula = de.Formula;
        en.Pagina = de.Pagina;
        en.X = de.X;
        en.Y = de.Y;
        en.Ancho = de.Ancho;
        en.Alto = de.Alto;
        en.Obligatorio = de.Obligatorio;
        en.EnEstadisticas = de.EnEstadisticas;
        en.ImprimirPdf = de.ImprimirPdf;
    }
}
