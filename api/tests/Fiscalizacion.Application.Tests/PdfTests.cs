using Fiscalizacion.Application.Comun;
using Fiscalizacion.Application.Dtos;
using Fiscalizacion.Application.Fiscalizaciones;
using Fiscalizacion.Application.Pdf;
using Fiscalizacion.Application.Usuarios;
using Fiscalizacion.Domain.Entidades;
using Fiscalizacion.Domain.Enums;
using Fiscalizacion.Domain.Reglas;
using Fiscalizacion.Infrastructure;
using Fiscalizacion.Infrastructure.Pdf;
using Fiscalizacion.Infrastructure.Persistencia;
using Microsoft.EntityFrameworkCore;
using UglyToad.PdfPig;

namespace Fiscalizacion.Application.Tests;

public class GeneradorPdfTests
{
    private static readonly string[] Preguntas =
    [
        "¿La solicitud se realizó con margen disponible mínimo del 50 %?", "¿El proveedor llegó a la hora acordada?",
        "¿Se implementaron las medidas de seguridad establecidas?", "¿Se realizó la prueba de calidad antes de la descarga?",
        "¿Se efectuaron mediciones antes y después del proceso?", "¿Se evidenció presencia de agua en los tanques?",
        "¿Válvulas y bocas con presillas de seguridad?", "¿Compartimientos al nivel adecuado de chapas?",
        "¿Tanque y dispensador en condiciones operativas?", "¿El dispensador ha sido calibrado?",
        "¿Se produjo algún derrame durante el proceso?", "¿Hubo diferencias en la entrega recibida?",
    ];

    /// <summary>Registro realista (el del contrato: #A3F9-21C0, C.H. Jigüey, Sunix Petroleum), versión 2.</summary>
    internal static DocumentoPdf Muestra(int fotos = 6, string? marca = null, Func<int, byte[]?>? foto = null)
    {
        var controles = Enumerable.Range(1, 12).Select(n => n switch
        {
            6 => new ControlDto(6, true, "Agua en el fondo del tanque 2 (≈ 3 cm); se drenó antes de la descarga."),
            10 => new ControlDto(10, true, "2026-08-14"),
            11 => new ControlDto(11, false, null),
            12 => new ControlDto(12, true, "Faltante de 12.40 gal respecto al conduce CD-0048213."),
            2 => new ControlDto(2, false, "Llegó 25 min tarde por tránsito en la autopista Duarte."),
            _ => new ControlDto(n, true, null),
        }).ToList();
        var firmado = new DateTime(2026, 10, 20, 15, 30, 0, DateTimeKind.Utc);
        (RolFirma rol, string nombre, string? cedula)[] firmantes =
        [
            (RolFirma.AuditorActuante1, "María Rosario Peña", "001-1234567-8"),
            (RolFirma.AuditorActuante2, "José M. Guzmán", "402-2233445-1"),
            (RolFirma.EncargadoRecibir, "Ing. Carlos Méndez", "001-7654321-0"),
            (RolFirma.SupervisorCombustibles, "Luis Ferreras", null),
            (RolFirma.RepresentanteProveedor, "Ramón Antonio Peña", "031-0099887-6"),
            (RolFirma.AuditorCierre1, "Ana Lucía Pérez", "001-5566778-9"),
            (RolFirma.AuditorCierre2, "Félix Santana Núñez", "223-0011223-4"),
        ];
        var registro = new FiscalizacionDto(
            Guid.Parse("a3f921c0-5e0b-4d77-9a1b-2c3d4e5f6a7b"), "A3F9-21C0", EstadoFiscalizacion.Modificado, 2, null, false,
            new AutorDto(Guid.NewGuid(), "María Rosario Peña"), firmado.AddHours(-6), firmado.AddDays(1),
            new VisitaDto(new DateOnly(2026, 10, 20), new TimeOnly(7, 15), new TimeOnly(9, 5), 1, new TimeOnly(8, 40), new TimeOnly(11, 20)),
            new DatosSuplidorDto("FT-221", "Ramón Antonio Peña", "L-384920", "CD-0048213", 1, 8000m),
            new DatosEmpresaDto("FT-305", "José Luis Martínez", "Ing. Carlos Méndez", 8000m, "FT-118", "Pedro Almonte"),
            new MedicionesDto(1, 4212.40m, 4200.00m, 248.60m,
            [
                new LecturaDto(Equipo.MedidorDigital, 128450.20m, 132650.20m),
                new LecturaDto(Equipo.Dispensador, 55210.00m, 59410.50m),
                new LecturaDto(Equipo.Electrobomba, null, null),
            ], new VaraDto("34 ½ pulg", 1520.00m, "58 pulg", 5720.00m)),
            Calculadora.Calcular(4212.40m, 4200.00m, 248.60m),
            controles,
            "Descarga sin incidentes. Se verificó el sello de las válvulas y la temperatura del producto (27 °C). " +
            "El conductor firmó el conduce con la cantidad medida por EGEHID.",
            Enumerable.Range(1, fotos).Select(i => new FotoDto(Guid.NewGuid(), i, Descripciones[(i - 1) % Descripciones.Length], 240_000)).ToList(),
            firmantes.Select(f => new FirmaDto(f.rol, f.nombre, f.cedula, ModoFirma.EnEstaTablet, firmado.AddMinutes((int)f.rol * 3), null)).ToList(),
            new Dictionary<string, string[]>());
        return new DocumentoPdf(registro, 2, "C.H. Jigüey", "Sunix Petroleum, S.R.L.",
            Preguntas.Select((t, i) => new PreguntaControlDto(i + 1, t, i + 1 is 6 or 11 or 12, i == 9 ? TipoObservacion.Fecha : TipoObservacion.Texto)).ToList(),
            firmantes.Select((f, i) => new FirmaPdf(f.rol, f.nombre, f.cedula, firmado.AddMinutes((int)f.rol * 3), ImagenesPrueba.Firma(i))).ToList(),
            Enumerable.Range(1, fotos).Select(i => new FotoPdf(i, Descripciones[(i - 1) % Descripciones.Length], (foto ?? (n => ImagenesPrueba.Foto(n)))(i))).ToList(),
            new DateTime(2026, 10, 21, 14, 5, 0, DateTimeKind.Utc), marca);
    }

    private static readonly string[] Descripciones =
    [
        "Camión cisterna FT-221 en el área de descarga", "Medidor digital antes de la descarga (128,450.20)",
        "Vara de medición en el tanque 2: 34 ½ pulg", "Prueba de calidad del gasoil (muestra transparente)",
        "Presillas de seguridad en válvulas y bocas", "Medidor digital al terminar (132,650.20)",
    ];

    internal static List<string> Paginas(byte[] pdf)
    {
        using var doc = PdfDocument.Open(pdf);
        // palabras (separa las celdas) y el texto corrido (une las letras giradas de la marca de agua)
        return doc.GetPages().Select(p => string.Join(" ", p.GetWords().Select(w => w.Text)) + "\n" + p.Text).ToList();
    }

    /// <summary>La página contiene el texto, sin contar espacios (PdfPig no siempre separa las palabras igual).</summary>
    internal static void Tiene(string pagina, string texto) =>
        Assert.Contains(System.Text.RegularExpressions.Regex.Replace(texto, @"\s", ""),
            System.Text.RegularExpressions.Regex.Replace(pagina, @"\s", ""));

    [Fact]
    public void Genera_el_formulario_en_papel_llenado_y_el_anexo_de_fotos()
    {
        var pdf = new GeneradorPdf().Generar(Muestra() with
        {
            Encabezado = new Plantillas.EncabezadoPlantillaDto("FO-UAI-2026-014", "002", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 15)),
            Producto = "Gasoil óptimo",
        });

        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(pdf, 0, 4));
        var paginas = Paginas(pdf);
        Assert.Equal(2, paginas.Count); // formulario + 6 fotos (6 por página)
        Assert.All(paginas, p => Tiene(p, "A3F9-21C0"));
        var f = paginas[0];
        Tiene(f, "Formulario Fiscalización Combustible y Aceites"); // el PDF base
        Tiene(f, "FO-UAI-2026-014");
        Tiene(f, "15/09/2026");
        Tiene(f, "Rev. 2");
        Tiene(f, "Gasoil óptimo");
        Tiene(f, "C.H. Jigüey");
        Tiene(f, "07:15 AM");
        Tiene(f, "−12.40 (−0.29 %)");
        Tiene(f, "4,200.00");
        Tiene(f, "14/08/2026"); // control 10: fecha de calibración
        Tiene(f, "001-1234567-8");
        Tiene(f, "Página 1 de 2");
        Tiene(paginas[1], "Anexo · Fotografías");
        Tiene(paginas[1], "6. Medidor digital al terminar");
        Assert.DoesNotContain("BORRADOR", string.Concat(paginas));
    }

    [Fact]
    public void Cada_valor_va_en_su_celda_del_formulario()
    {
        var v = ValoresFormulario.Desde(Muestra());
        var campos = Plantillas.PlantillaOficial.Campos().Select(c => c.Identificador).ToHashSet();
        Assert.All(v.Keys, id => Assert.Contains(id, campos));
        Assert.Equal("X", v["control_6"].Texto);      // Sí
        Assert.Equal("X", v["control_11_no"].Texto);  // No
        Assert.False(v.ContainsKey("control_11"));
        Assert.Equal("14/08/2026", v["control_10_obs"].Texto);
        Assert.Equal("María", v["auditor_actuante_1_nombre"].Texto);
        Assert.Equal("Rosario Peña", v["auditor_actuante_1_apellido"].Texto);
        Assert.Equal("FT-118", v["empresa_ficha_camion"].Texto); // propio de la empresa, no copia al suplidor
        Assert.Equal("Pedro Almonte", v["empresa_chofer"].Texto);
        Assert.Equal("FT-305", v["ficha_camion_2"].Texto);
        Assert.Equal("4,200.00", v["medidor_digital_diferencia"].Texto);
        Assert.Equal("4,200.00 gal", v["vara_diferencia_galones"].Texto);
        Assert.Equal("Félix Santana Núñez", v["firma_auditor_cierre_2"].Pie);
        Assert.False(v.ContainsKey("firma_auditor_uai")); // sin firmar: en blanco
        Assert.False(v.ContainsKey("electrobomba_inicial"));
    }

    [Theory]
    [InlineData("María Rosario Peña", "María", "Rosario Peña")]
    [InlineData("José M. Guzmán", "José M.", "Guzmán")]
    [InlineData("Ing. Carlos Méndez", "Ing. Carlos", "Méndez")]
    [InlineData("Ana Lucía Pérez Gómez", "Ana Lucía", "Pérez Gómez")]
    [InlineData("Luis", "Luis", null)]
    public void Separa_nombre_y_apellidos(string completo, string nombre, string? apellido)
    {
        Assert.Equal((nombre, apellido), FormatoPdf.SepararNombre(completo));
    }

    [Theory]
    [InlineData(0, 1)]
    [InlineData(6, 2)]
    [InlineData(7, 3)]
    [InlineData(20, 5)]
    public void Las_fotos_van_de_6_en_6(int fotos, int paginas)
    {
        Assert.Equal(paginas, Paginas(new GeneradorPdf().Generar(Muestra(fotos))).Count);
    }

    [Fact]
    public void La_vista_previa_lleva_la_marca_de_agua()
    {
        var paginas = Paginas(new GeneradorPdf().Generar(Muestra(1, ServicioPdf.MarcaBorrador)));
        Assert.All(paginas, p => GeneradorPdfTests.Tiene(p, "BORRADOR"));
    }

    [Fact]
    public void Una_foto_ilegible_o_faltante_no_impide_el_pdf()
    {
        var pdf = new GeneradorPdf().Generar(Muestra(2, foto: n => n == 1 ? null : [1, 2, 3, 4]));
        var fotos = Paginas(pdf)[1];
        GeneradorPdfTests.Tiene(fotos, "Imagen no disponible");
        GeneradorPdfTests.Tiene(fotos, "Formato de imagen no admitido");
    }

    [Fact]
    public void Formatos_como_en_el_front()
    {
        Assert.Equal("−3,082.64", FormatoPdf.Num(-3082.64m));
        Assert.Null(FormatoPdf.Num(null));
        Assert.Equal("07:15 AM", FormatoPdf.Hora12(new TimeOnly(7, 15)));
        Assert.Equal("12:05 PM", FormatoPdf.Hora12(new TimeOnly(12, 5)));
        // UTC → hora de República Dominicana (UTC−4)
        Assert.Equal("20/10/2026 11:30 AM", FormatoPdf.Momento12(new DateTime(2026, 10, 20, 15, 30, 0, DateTimeKind.Utc)));
    }

    /// <summary>
    /// Escribe un PDF de muestra si se define FISCALIZACION_PDF_MUESTRA (ruta del archivo). Usa fotos JPEG de Windows
    /// si existen, para ver fotos reales en el anexo.
    /// </summary>
    [Fact]
    public void Pdf_de_muestra()
    {
        var ruta = Environment.GetEnvironmentVariable("FISCALIZACION_PDF_MUESTRA");
        var jpg = new[] { @"C:\Windows\Web\Wallpaper\Spotlight\img14.jpg", @"C:\Windows\Web\Wallpaper\Theme2\img0_1920x1200.jpg",
            @"C:\Windows\Web\Wallpaper\Spotlight\img50.jpg", @"C:\Windows\Web\Wallpaper\Theme2\img19_1920x1200.jpg" }
            .Where(File.Exists).Select(File.ReadAllBytes).ToList();
        var pdf = new GeneradorPdf().Generar(Muestra(6, foto: n => jpg.Count >= n ? jpg[n - 1] : ImagenesPrueba.Foto(n)));
        Assert.Equal(2, Paginas(pdf).Count);
        if (string.IsNullOrWhiteSpace(ruta)) return;
        File.WriteAllBytes(ruta, pdf);
        File.WriteAllBytes(Path.ChangeExtension(ruta, ".borrador.pdf"), new GeneradorPdf().Generar(Muestra(1, ServicioPdf.MarcaBorrador)));
    }
}

/// <summary>Finalizar y corregir guardan el PDF de cada versión; descarga, versiones y vista previa.</summary>
public class ServicioPdfTests : IDisposable
{
    private readonly UsuarioFalso usuario = new();
    private readonly RelojFijo reloj = new();
    private readonly AppDbContext db;
    private readonly string carpeta = Path.Combine(Path.GetTempPath(), "fisc-pdf-" + Guid.NewGuid().ToString("N"));
    private readonly AlmacenFotosDisco fotos;
    private readonly AlmacenPdfDisco almacenPdf;

    public ServicioPdfTests()
    {
        var opciones = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .AddInterceptors(new InterceptorBitacora(usuario, reloj, new CorrelacionFalsa()))
            .Options;
        db = new AppDbContext(opciones);
        db.Database.EnsureCreated();
        fotos = new AlmacenFotosDisco(Path.Combine(carpeta, "fotos"));
        almacenPdf = new AlmacenPdfDisco(Path.Combine(carpeta, "pdf"));
    }

    public void Dispose()
    {
        db.Dispose();
        if (Directory.Exists(carpeta)) Directory.Delete(carpeta, true);
    }

    private ComponedorPdf Componedor() => new(db, new GeneradorPdf(), almacenPdf, fotos, reloj);
    private ServicioFiscalizaciones Fiscalizaciones() => new(db, usuario, reloj, Componedor());
    private ServicioPdf Pdf() => new(db, usuario, Fiscalizaciones(), Componedor());

    private async Task EntrarComo(string correo)
    {
        var u = await new ServicioUsuarios(db, usuario, reloj).AsegurarAsync(correo, null, null, default);
        usuario.Id = u.Id;
        usuario.EsAdministrador = u.Rol == Rol.Administrador;
    }

    private static FiscalizacionEntradaDto Completa(byte[]? rv, decimal egehid = 4200m) => new(rv,
        new VisitaDto(new DateOnly(2026, 10, 20), new TimeOnly(7, 15), new TimeOnly(9, 5), 1, new TimeOnly(8, 40), new TimeOnly(11, 20)),
        new DatosSuplidorDto("FT-221", "Ramón Antonio Peña", "L-384920", "CD-0048213", 1, 8000m),
        new DatosEmpresaDto("FT-305", "José Luis Martínez", "Ing. Carlos Méndez", 8000m),
        new MedicionesDto(1, 4212.40m, egehid, 248.60m, [new LecturaDto(Equipo.MedidorDigital, 128450.20m, 132650.20m)], null),
        Enumerable.Range(1, 12).Select(n => new ControlDto(n, n == 6, n == 6 ? "Agua en el tanque 2" : null)).ToList(),
        "Sin novedad.");

    /// <summary>Borrador completo con las 4 firmas requeridas y 2 fotos, listo para finalizar.</summary>
    private async Task<Guid> BorradorListo()
    {
        var id = Guid.Parse("a3f921c0-0000-4000-8000-000000000001");
        var dto = await Fiscalizaciones().GuardarAsync(id, Completa(null), default);
        var firmas = new ServicioFirmas(db, usuario, reloj, Fiscalizaciones());
        var i = 0;
        foreach (var rol in ValidadorFiscalizacion.FirmasRequeridas)
            await firmas.FirmarAsync(id, rol, new FirmarDto($"Firmante {++i}", $"001-000000{i}-0", ModoFirma.EnEstaTablet,
                Convert.ToBase64String(ImagenesPrueba.Firma(i))), default);
        var servicioFotos = new ServicioFotos(db, usuario, reloj, fotos, Fiscalizaciones());
        for (var n = 1; n <= 2; n++)
        {
            var bytes = ImagenesPrueba.Foto(n, 320, 240);
            await servicioFotos.AgregarAsync(id, new MemoryStream(bytes), "image/png", bytes.Length, $"Foto {n}", n, default);
        }
        Assert.Equal("A3F9-21C0", dto.Numero);
        return id;
    }

    [Fact]
    public async Task Finalizar_guarda_el_pdf_de_la_version_1_y_corregir_el_de_la_version_2()
    {
        await EntrarComo("admin@egehid.gob.do");
        var id = await BorradorListo();

        var fin = await Fiscalizaciones().FinalizarAsync(id, default);
        var v1 = await db.FiscalizacionVersiones.SingleAsync(v => v.FiscalizacionId == id);
        Assert.NotNull(v1.PdfRuta);
        var pdf1 = await almacenPdf.LeerAsync(v1.PdfRuta!, default);
        Assert.NotNull(pdf1);
        var paginas = GeneradorPdfTests.Paginas(pdf1!);
        Assert.Equal(2, paginas.Count);
        GeneradorPdfTests.Tiene(paginas[0], "N.º A3F9-21C0 · Rev. 1");
        GeneradorPdfTests.Tiene(paginas[0], "001-0000001-0");
        GeneradorPdfTests.Tiene(paginas[1], "1. Foto 1");

        await Fiscalizaciones().CorregirAsync(id, Completa(fin.RowVersion ?? [], 4205m), default);
        var v2 = await db.FiscalizacionVersiones.SingleAsync(v => v.FiscalizacionId == id && v.Version == 2);
        Assert.NotNull(v2.PdfRuta);
        Assert.NotEqual(v1.PdfRuta, v2.PdfRuta);
        var texto2 = string.Concat(GeneradorPdfTests.Paginas((await almacenPdf.LeerAsync(v2.PdfRuta!, default))!));
        GeneradorPdfTests.Tiene(texto2, "Rev. 2");
        GeneradorPdfTests.Tiene(texto2, "4,205.00");

        // la vigente es la 2; la 1 sigue disponible para el administrador
        var vigente = await Pdf().VigenteAsync(id, default);
        Assert.Equal("Fiscalizacion-A3F9-v2.pdf", vigente.Nombre);
        GeneradorPdfTests.Tiene(GeneradorPdfTests.Paginas(vigente.Contenido)[0], "Rev. 2");
        var anterior = await Pdf().VersionAsync(id, 1, default);
        var anteriorTexto = GeneradorPdfTests.Paginas(anterior.Contenido)[0];
        GeneradorPdfTests.Tiene(anteriorTexto, "4,200.00");
        Assert.DoesNotContain("4,205.00", anteriorTexto);
    }

    [Fact]
    public async Task Sin_pdf_guardado_se_regenera_al_pedirlo()
    {
        await EntrarComo("admin@egehid.gob.do");
        var id = await BorradorListo();
        await new ServicioFiscalizaciones(db, usuario, reloj).FinalizarAsync(id, default); // sin generador: como antes de esta función
        var v1 = await db.FiscalizacionVersiones.SingleAsync(v => v.FiscalizacionId == id);
        Assert.Null(v1.PdfRuta);

        var pdf = await Pdf().VigenteAsync(id, default);
        GeneradorPdfTests.Tiene(GeneradorPdfTests.Paginas(pdf.Contenido)[0], "A3F9-21C0");
        await db.Entry(v1).ReloadAsync();
        Assert.NotNull(v1.PdfRuta);
        Assert.NotNull(await almacenPdf.LeerAsync(v1.PdfRuta!, default));
    }

    [Fact]
    public async Task Un_borrador_solo_tiene_vista_previa_con_marca_BORRADOR()
    {
        await EntrarComo("admin@egehid.gob.do");
        var id = await BorradorListo();

        await Assert.ThrowsAsync<ConflictoException>(() => Pdf().VigenteAsync(id, default));
        var vista = await Pdf().VistaPreviaAsync(id, default);
        Assert.Equal("Fiscalizacion-A3F9-vista-previa.pdf", vista.Nombre);
        Assert.All(GeneradorPdfTests.Paginas(vista.Contenido), p => GeneradorPdfTests.Tiene(p, "BORRADOR"));
        Assert.Empty(db.FiscalizacionVersiones);
    }

    [Fact]
    public async Task Solo_el_administrador_descarga_versiones_y_un_ajeno_no_ve_el_pdf()
    {
        await EntrarComo("admin@egehid.gob.do");
        await EntrarComo("autor@egehid.gob.do");
        var id = await BorradorListo();
        await Fiscalizaciones().FinalizarAsync(id, default);

        Assert.NotNull(await Pdf().VigenteAsync(id, default));
        await Assert.ThrowsAsync<ProhibidoException>(() => Pdf().VersionAsync(id, 1, default));

        await EntrarComo("otro@egehid.gob.do");
        await Assert.ThrowsAsync<ProhibidoException>(() => Pdf().VigenteAsync(id, default));
        await Assert.ThrowsAsync<ProhibidoException>(() => Pdf().VistaPreviaAsync(id, default));
    }
}

/// <summary>
/// El visor del front (web/src/pantallas/formularioOficial.json) usa las mismas celdas que el PDF. Si cambian,
/// ejecutar con FISCALIZACION_ACTUALIZAR_FORMULARIO=1 para regenerar el JSON.
/// </summary>
public class FormularioFrontTests
{
    [Fact]
    public void El_json_del_front_coincide_con_la_plantilla_oficial()
    {
        var raiz = new DirectoryInfo(AppContext.BaseDirectory);
        while (raiz is not null && !Directory.Exists(Path.Combine(raiz.FullName, "web", "src"))) raiz = raiz.Parent;
        Assert.NotNull(raiz);
        var ruta = Path.Combine(raiz!.FullName, "web", "src", "pantallas", "formularioOficial.json");
        var campos = Plantillas.PlantillaOficial.Campos().Select(c => new
        {
            id = c.Identificador, tipo = c.Tipo.ToString(), x = c.X, y = c.Y, ancho = c.Ancho, alto = c.Alto,
        });
        var json = System.Text.Json.JsonSerializer.Serialize(new
        {
            ancho = Plantillas.PlantillaOficial.AnchoPagina, alto = Plantillas.PlantillaOficial.AltoPagina, campos,
        }, new System.Text.Json.JsonSerializerOptions { WriteIndented = true, NewLine = "\n" }) + "\n";
        if (Environment.GetEnvironmentVariable("FISCALIZACION_ACTUALIZAR_FORMULARIO") == "1") File.WriteAllText(ruta, json);
        Assert.Equal(json, File.ReadAllText(ruta).Replace("\r\n", "\n"));
    }
}
