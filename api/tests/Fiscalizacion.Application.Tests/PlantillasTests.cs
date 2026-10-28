using System.Text;
using Fiscalizacion.Application.Comun;
using Fiscalizacion.Application.Fiscalizaciones;
using Fiscalizacion.Application.Plantillas;
using Fiscalizacion.Application.Usuarios;
using Fiscalizacion.Domain.Enums;
using Fiscalizacion.Domain.Reglas;
using Fiscalizacion.Infrastructure.Pdf;
using Fiscalizacion.Infrastructure.Persistencia;
using Microsoft.EntityFrameworkCore;

namespace Fiscalizacion.Application.Tests;

public class PlantillasTests
{
    private readonly UsuarioFalso usuario = new();
    private readonly RelojFijo reloj = new();
    private readonly AppDbContext db;

    public PlantillasTests()
    {
        var opciones = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .AddInterceptors(new InterceptorBitacora(usuario, reloj, new CorrelacionFalsa()))
            .Options;
        db = new AppDbContext(opciones);
        db.Database.EnsureCreated(); // trae la plantilla oficial (v2 publicada)
    }

    private ServicioPlantillas Servicio() => new(db, usuario, reloj, new LectorPdf());

    private async Task Entrar(bool administrador)
    {
        var u = await new ServicioUsuarios(db, usuario, reloj).AsegurarAsync($"{Guid.NewGuid():N}@egehid.gob.do", null, null, default);
        usuario.Id = u.Id;
        usuario.EsAdministrador = administrador;
    }

    /// <summary>PDF mínimo válido con <paramref name="paginas"/> páginas de 440 × 600 pt.</summary>
    internal static byte[] Pdf(int paginas = 1, int ancho = 440, int alto = 600, int rotacion = 0)
    {
        var objetos = new List<string>
        {
            "<< /Type /Catalog /Pages 2 0 R >>",
            $"<< /Type /Pages /Kids [{string.Join(' ', Enumerable.Range(0, paginas).Select(i => $"{3 + i} 0 R"))}] /Count {paginas} >>"
        };
        for (var i = 0; i < paginas; i++) objetos.Add($"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {ancho} {alto}] /Rotate {rotacion} >>");
        var sb = new StringBuilder("%PDF-1.4\n");
        var offsets = new List<int>();
        for (var i = 0; i < objetos.Count; i++)
        {
            offsets.Add(Encoding.ASCII.GetByteCount(sb.ToString()));
            sb.Append($"{i + 1} 0 obj\n{objetos[i]}\nendobj\n");
        }
        var xref = Encoding.ASCII.GetByteCount(sb.ToString());
        sb.Append($"xref\n0 {objetos.Count + 1}\n0000000000 65535 f \n");
        foreach (var o in offsets) sb.Append($"{o:D10} 00000 n \n");
        sb.Append($"trailer\n<< /Size {objetos.Count + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n");
        return Encoding.ASCII.GetBytes(sb.ToString());
    }

    private static CampoPlantillaDto Campo(string id, TipoCampo tipo = TipoCampo.Numero, string? formula = null, int pagina = 1,
        decimal x = 170, decimal y = 60) =>
        new(id, id, tipo, formula, pagina, x, y, 110, 16, false, false, true);

    private async Task<PlantillaDto> Importar(int paginas = 1, string nombre = "Recepción de lubricantes")
    {
        var pdf = Pdf(paginas);
        return await Servicio().ImportarAsync(new MemoryStream(pdf), "application/pdf", pdf.Length, "x.pdf", nombre, default);
    }

    [Fact]
    public async Task La_oficial_esta_sembrada_con_sus_campos_y_es_de_solo_lectura()
    {
        await Entrar(administrador: true);
        var lista = await Servicio().ListarAsync(default);
        var oficial = Assert.Single(lista);
        Assert.Equal((TipoPlantilla.Oficial, EstadoPlantilla.Activa, 2), (oficial.Tipo, oficial.Estado, oficial.Version));
        Assert.True(oficial.TotalCampos > 50);

        var d = await Servicio().ObtenerAsync(oficial.Id, null, default);
        Assert.False(d.Editable);
        Assert.True(d.Actual.TienePdf); // el formulario en papel
        Assert.Equal(PlantillaOficial.Paginas, d.Actual.Paginas);
        Assert.Equal(PlantillaOficial.PdfBase, await Servicio().PdfAsync(1, 2, default));
        Assert.Contains(d.Actual.Campos, c => c is { Identificador: "diferencia_gal", Tipo: TipoCampo.Formula });
        Assert.Empty(ReglasPlantillas.ValidarPublicacion(PlantillaOficial.Campos(), [.. d.Actual.Paginas.Select(p => (p.Ancho, p.Alto))]));

        await Assert.ThrowsAsync<ReglaNegocioException>(() => Servicio().GuardarBorradorAsync(oficial.Id, new(null, []), default));
        await Assert.ThrowsAsync<ReglaNegocioException>(() => Servicio().DesactivarAsync(oficial.Id, default));
    }

    [Fact]
    public async Task Importar_crea_un_borrador_v1_con_el_pdf_y_sus_paginas()
    {
        await Entrar(administrador: true);
        var p = await Importar(paginas: 2);
        Assert.Equal((TipoPlantilla.Personalizada, EstadoPlantilla.Borrador, 0, 1), (p.Tipo, p.Estado, p.Version, p.VersionBorrador));
        Assert.True(p.Actual.TienePdf);
        Assert.Equal([new PaginaDto(440, 600), new PaginaDto(440, 600)], p.Actual.Paginas);
        Assert.Equal(Pdf(2), await Servicio().PdfAsync(p.Id, 1, default));

        // mismo nombre al importar otra vez → « (2)»
        Assert.Equal("Recepción de lubricantes (2)", (await Importar()).Nombre);
    }

    [Fact]
    public void Las_paginas_giradas_se_miden_como_se_ven()
    {
        Assert.Equal([new PaginaDto(600, 440)], new LectorPdf().Paginas(Pdf(rotacion: 90)));
        Assert.Null(new LectorPdf().Paginas("%PDF-1.4 basura"u8.ToArray()));
    }

    [Fact]
    public async Task Importar_rechaza_lo_que_no_es_pdf_mas_de_4_mb_o_mas_de_10_paginas()
    {
        await Entrar(administrador: true);
        var texto = "hola"u8.ToArray();
        await Assert.ThrowsAsync<ReglaNegocioException>(() =>
            Servicio().ImportarAsync(new MemoryStream(texto), "application/pdf", texto.Length, "a.pdf", null, default));
        var grande = new byte[ReglasPlantillas.MaxPdfBytes + 1];
        "%PDF-"u8.CopyTo(grande);
        var e = await Assert.ThrowsAsync<ReglaNegocioException>(() =>
            Servicio().ImportarAsync(new MemoryStream(grande), "application/pdf", 10, "a.pdf", null, default)); // tamaño declarado falso
        Assert.Contains("4 MB", e.Message);
        e = await Assert.ThrowsAsync<ReglaNegocioException>(() => Importar(paginas: 11));
        Assert.Contains("10 páginas", e.Message);
    }

    [Fact]
    public async Task Solo_el_administrador_gestiona_y_los_demas_ven_solo_lo_publicado()
    {
        await Entrar(administrador: true);
        var p = await Importar();
        await Entrar(administrador: false);
        await Assert.ThrowsAsync<ProhibidoException>(() => Servicio().CrearAsync(new("Otra"), default));
        await Assert.ThrowsAsync<ProhibidoException>(() => Servicio().PublicarAsync(p.Id, default));
        Assert.DoesNotContain(await Servicio().ListarAsync(default), x => x.Id == p.Id);
        await Assert.ThrowsAsync<NoEncontradoException>(() => Servicio().ObtenerAsync(p.Id, null, default));
        await Assert.ThrowsAsync<NoEncontradoException>(() => Servicio().PdfAsync(p.Id, 1, default));
    }

    [Fact]
    public async Task Guardar_borrador_valida_identificador_unico_y_posicion()
    {
        await Entrar(administrador: true);
        var p = await Importar();
        var e = await Assert.ThrowsAsync<ValidacionException>(() => Servicio().GuardarBorradorAsync(p.Id,
            new(null, [Campo("cant"), Campo("cant"), Campo("Mal-Id"), Campo("lejos", x: 400), Campo("pag2", pagina: 2)]), default));
        Assert.Contains("repetido", string.Join(" ", e.Errores["campos.cant"]));
        Assert.True(e.Errores.ContainsKey("campos.Mal-Id"));
        Assert.Contains("fuera de la página", string.Join(" ", e.Errores["campos.lejos"]));
        Assert.True(e.Errores.ContainsKey("campos.pag2"));

        // la fórmula incompleta se puede guardar en el borrador (se valida al publicar)
        var d = await Servicio().GuardarBorradorAsync(p.Id, new("Lubricantes", [Campo("cant"), Campo("dif", TipoCampo.Formula, "cant -", y: 90)]), default);
        Assert.Equal("Lubricantes", d.Nombre);
        Assert.Equal(["cant", "dif"], d.Actual.Campos.Select(c => c.Identificador));
    }

    [Fact]
    public async Task Publicar_exige_formulas_con_identificadores_numericos_existentes()
    {
        await Entrar(administrador: true);
        var p = await Importar();
        await Servicio().GuardarBorradorAsync(p.Id, new(null,
        [
            Campo("recibida"), Campo("lote", TipoCampo.Texto, y: 90), Campo("dif", TipoCampo.Formula, "recibida − facturada", y: 120),
            Campo("dif2", TipoCampo.Formula, "recibida * lote", y: 150), Campo("dif3", TipoCampo.Formula, "(recibida", y: 180),
        ]), default);
        var e = await Assert.ThrowsAsync<ValidacionException>(() => Servicio().PublicarAsync(p.Id, default));
        Assert.Contains("«facturada», que no existe", string.Join(" ", e.Errores["campos.dif"]));
        Assert.Contains("no es numérico", string.Join(" ", e.Errores["campos.dif2"]));
        Assert.Contains("paréntesis", string.Join(" ", e.Errores["campos.dif3"]));

        await Servicio().GuardarBorradorAsync(p.Id, new(null,
            [Campo("recibida"), Campo("facturada", y: 90), Campo("dif", TipoCampo.Formula, "recibida − facturada", y: 120)]), default);
        var publicada = await Servicio().PublicarAsync(p.Id, default);
        Assert.Equal((EstadoPlantilla.Activa, 1, (int?)null), (publicada.Estado, publicada.Version, publicada.VersionBorrador));
        Assert.Equal(reloj.Ahora, publicada.Actual.PublicadaEn);
        await Assert.ThrowsAsync<ReglaNegocioException>(() => Servicio().PublicarAsync(p.Id, default)); // sin cambios
    }

    [Fact]
    public async Task Editar_una_publicada_crea_el_borrador_siguiente_con_el_mismo_pdf_y_descartarlo_vuelve_a_la_vigente()
    {
        await Entrar(administrador: true);
        var p = await Importar();
        await Servicio().GuardarBorradorAsync(p.Id, new(null, [Campo("recibida")]), default);
        await Servicio().PublicarAsync(p.Id, default);

        var b = await Servicio().GuardarBorradorAsync(p.Id, new(null, [Campo("recibida"), Campo("lote", TipoCampo.Texto, y: 90)]), default);
        Assert.Equal((1, (int?)2, 2), (b.Version, b.VersionBorrador, b.Actual.Version));
        Assert.True(b.Actual.TienePdf);
        Assert.Equal([2, 1], b.Versiones.Select(v => v.Version));
        Assert.Single((await Servicio().ObtenerAsync(p.Id, 1, default)).Actual.Campos); // v1 no cambió

        var descartado = await Servicio().DescartarBorradorAsync(p.Id, default);
        Assert.NotNull(descartado);
        Assert.Equal((1, (int?)null), (descartado.Actual.Version, descartado.VersionBorrador));
    }

    [Fact]
    public async Task Descartar_una_plantilla_nunca_publicada_la_elimina()
    {
        await Entrar(administrador: true);
        var p = await Servicio().CrearAsync(new("En blanco"), default);
        Assert.False(p.Actual.TienePdf);
        Assert.Equal([new PaginaDto(612, 792)], p.Actual.Paginas);
        Assert.Null(await Servicio().DescartarBorradorAsync(p.Id, default));
        await Assert.ThrowsAsync<NoEncontradoException>(() => Servicio().ObtenerAsync(p.Id, null, default));
        await Assert.ThrowsAsync<ValidacionException>(() => Servicio().CrearAsync(new("Combustible y aceites"), default));
    }

    [Fact]
    public async Task Duplicar_la_oficial_crea_una_personalizada_editable_con_sus_campos()
    {
        await Entrar(administrador: true);
        var copia = await Servicio().DuplicarAsync(1, new(null), default);
        Assert.Equal(("Combustible y aceites (copia)", TipoPlantilla.Personalizada, true), (copia.Nombre, copia.Tipo, copia.Editable));
        Assert.Equal(PlantillaOficial.Campos().Count, copia.Actual.Campos.Count);
        Assert.True(copia.Actual.TienePdf);
        Assert.Equal([new PaginaDto(595.56m, 842.04m)], copia.Actual.Paginas.Select(x => new PaginaDto(Math.Round(x.Ancho, 2), Math.Round(x.Alto, 2))));
        var publicada = await Servicio().PublicarAsync(copia.Id, default);
        Assert.Equal(EstadoPlantilla.Activa, publicada.Estado);
    }

    [Fact]
    public async Task Desactivar_y_activar_y_las_fiscalizaciones_nuevas_siguen_con_la_oficial()
    {
        await Entrar(administrador: true);
        var p = await Importar();
        await Assert.ThrowsAsync<ReglaNegocioException>(() => Servicio().ActivarAsync(p.Id, default)); // nunca publicada
        await Servicio().GuardarBorradorAsync(p.Id, new(null, [Campo("recibida")]), default);
        reloj.Ahora = reloj.Ahora.AddDays(1); // publicada después de la oficial
        await Servicio().PublicarAsync(p.Id, default);
        Assert.Equal(EstadoPlantilla.Desactivada, (await Servicio().DesactivarAsync(p.Id, default)).Estado);
        Assert.Equal(EstadoPlantilla.Activa, (await Servicio().ActivarAsync(p.Id, default)).Estado);

        var f = await new ServicioFiscalizaciones(db, usuario, reloj).GuardarAsync(Guid.NewGuid(),
            new(null, null, null, null, null, null, null), default);
        Assert.Equal(1, (await db.Fiscalizaciones.FindAsync(f.Id))!.PlantillaVersionId);
    }
}
