using System.Text.Json;
using Fiscalizacion.Application.Actualizaciones;
using Fiscalizacion.Application.Comun;
using Fiscalizacion.Application.Dtos;
using Fiscalizacion.Application.Fiscalizaciones;
using Fiscalizacion.Application.Usuarios;
using Fiscalizacion.Domain.Enums;
using Fiscalizacion.Domain.Reglas;
using Fiscalizacion.Infrastructure;
using Fiscalizacion.Infrastructure.Persistencia;
using Microsoft.EntityFrameworkCore;

namespace Fiscalizacion.Application.Tests;

/// <summary>
/// Envío seguro desde la tablet: los reintentos (cuando no llegó la respuesta) no duplican ni fallan, y una foto
/// incompleta se rechaza. También la actualización automática de la app.
/// </summary>
public class SincronizacionTests : IDisposable
{
    private readonly UsuarioFalso usuario = new();
    private readonly RelojFijo reloj = new();
    private readonly AppDbContext db;
    private readonly string carpeta = Path.Combine(Path.GetTempPath(), "fisc-sync-" + Guid.NewGuid().ToString("N"));
    private readonly AlmacenFotosDisco fotos;

    public SincronizacionTests()
    {
        var opciones = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .AddInterceptors(new InterceptorBitacora(usuario, reloj, new CorrelacionFalsa()))
            .Options;
        db = new AppDbContext(opciones);
        db.Database.EnsureCreated();
        fotos = new AlmacenFotosDisco(Path.Combine(carpeta, "fotos"));
    }

    public void Dispose()
    {
        db.Dispose();
        if (Directory.Exists(carpeta)) Directory.Delete(carpeta, true);
    }

    private ServicioFiscalizaciones Fiscalizaciones() => new(db, usuario, reloj);
    private ServicioFotos Fotos() => new(db, usuario, reloj, fotos, Fiscalizaciones());

    private async Task EntrarComo(string correo)
    {
        var u = await new ServicioUsuarios(db, usuario, reloj).AsegurarAsync(correo, null, null, default);
        usuario.Id = u.Id;
        usuario.EsAdministrador = u.Rol == Rol.Administrador;
    }

    private static FiscalizacionEntradaDto Completa() => new(null,
        new VisitaDto(new DateOnly(2026, 10, 20), new TimeOnly(7, 15), new TimeOnly(9, 5), 1, new TimeOnly(8, 40), new TimeOnly(11, 20)),
        new DatosSuplidorDto("FT-221", "Ramón Antonio Peña", "L-384920", "CD-0048213", 1, 8000m),
        new DatosEmpresaDto("FT-305", "José Luis Martínez", "Ing. Carlos Méndez", 8000m),
        new MedicionesDto(1, 4212.40m, 4200m, 248.60m, [], null),
        Enumerable.Range(1, 12).Select(n => new ControlDto(n, false, null)).ToList(), null);

    private async Task<Guid> BorradorConFirmas()
    {
        var id = Guid.NewGuid();
        await Fiscalizaciones().GuardarAsync(id, Completa(), default);
        var firmas = new ServicioFirmas(db, usuario, reloj, Fiscalizaciones());
        var i = 0;
        foreach (var rol in ValidadorFiscalizacion.FirmasRequeridas)
            await firmas.FirmarAsync(id, rol, new FirmarDto($"Firmante {++i}", null, ModoFirma.EnEstaTablet,
                Convert.ToBase64String(ImagenesPrueba.Firma(i))), default);
        return id;
    }

    [Fact]
    public async Task Reenviar_una_foto_con_el_mismo_id_no_la_duplica()
    {
        await EntrarComo("a@egehid.gob.do");
        var id = Guid.NewGuid();
        await Fiscalizaciones().GuardarAsync(id, Completa(), default);
        var bytes = ImagenesPrueba.Foto(1, 320, 240);
        var fotoId = Guid.NewGuid();
        var huella = Imagenes.Sha256(bytes);

        var primera = await Fotos().AgregarAsync(id, new MemoryStream(bytes), "image/png", bytes.Length, "Camión", 1, default, fotoId, huella);
        var reintento = await Fotos().AgregarAsync(id, new MemoryStream(bytes), "image/png", bytes.Length, "Camión", 1, default, fotoId, huella);

        Assert.Equal(fotoId, primera.Id);
        Assert.Equal(huella, primera.Sha256);
        Assert.Equal(primera, reintento);
        Assert.Equal(1, await db.Fotos.CountAsync(f => f.FiscalizacionId == id));
    }

    [Fact]
    public async Task Una_foto_incompleta_se_rechaza_y_no_se_guarda()
    {
        await EntrarComo("a@egehid.gob.do");
        var id = Guid.NewGuid();
        await Fiscalizaciones().GuardarAsync(id, Completa(), default);
        var bytes = ImagenesPrueba.Foto(1, 320, 240);
        var huellaCompleta = Imagenes.Sha256(bytes);
        var cortada = bytes[..(bytes.Length / 2)];

        var ex = await Assert.ThrowsAsync<ReglaNegocioException>(() =>
            Fotos().AgregarAsync(id, new MemoryStream(cortada), "image/png", cortada.Length, null, 1, default, Guid.NewGuid(), huellaCompleta));
        Assert.Contains("incompleta", ex.Message);
        Assert.Equal(0, await db.Fotos.CountAsync());
    }

    [Fact]
    public async Task Una_foto_con_el_id_de_otro_registro_da_conflicto()
    {
        await EntrarComo("a@egehid.gob.do");
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();
        await Fiscalizaciones().GuardarAsync(a, Completa(), default);
        await Fiscalizaciones().GuardarAsync(b, Completa(), default);
        var bytes = ImagenesPrueba.Foto(1, 320, 240);
        var fotoId = Guid.NewGuid();
        await Fotos().AgregarAsync(a, new MemoryStream(bytes), "image/png", bytes.Length, null, 1, default, fotoId);
        await Assert.ThrowsAsync<ConflictoException>(() =>
            Fotos().AgregarAsync(b, new MemoryStream(bytes), "image/png", bytes.Length, null, 1, default, fotoId));
    }

    [Fact]
    public async Task Repetir_finalizar_devuelve_el_registro_finalizado_sin_otra_version()
    {
        await EntrarComo("a@egehid.gob.do");
        var id = await BorradorConFirmas();

        var primera = await Fiscalizaciones().FinalizarAsync(id, default);
        var reintento = await Fiscalizaciones().FinalizarAsync(id, default);

        Assert.Equal(EstadoFiscalizacion.Finalizado, primera.Estado);
        Assert.Equal(primera.Numero, reintento.Numero);
        Assert.Equal(EstadoFiscalizacion.Finalizado, reintento.Estado);
        Assert.Equal(1, await db.FiscalizacionVersiones.CountAsync(v => v.FiscalizacionId == id));
    }

    [Fact]
    public async Task La_app_ve_la_ultima_version_publicada_y_descarga_su_paquete()
    {
        var raiz = Path.Combine(carpeta, "app");
        Directory.CreateDirectory(raiz);
        var servicio = new ServicioActualizaciones(new AlmacenActualizacionesDisco(raiz));
        Assert.Null(await servicio.UltimaAsync(default)); // nada publicado

        await File.WriteAllBytesAsync(Path.Combine(raiz, "1.2.0.zip"), [1, 2, 3]);
        var manifiesto = new ManifiestoApp("1.2.0", "1.2.0.zip", Imagenes.Sha256([1, 2, 3]), "Firmas obligatorias", new DateTime(2026, 10, 27, 0, 0, 0, DateTimeKind.Utc), 1);
        await File.WriteAllTextAsync(Path.Combine(raiz, "version.json"), JsonSerializer.Serialize(manifiesto, new JsonSerializerOptions(JsonSerializerDefaults.Web)));

        var v = await servicio.UltimaAsync(default);
        Assert.NotNull(v);
        Assert.Equal(("1.2.0", "/app/paquetes/1.2.0.zip", manifiesto.Sha256), (v!.Version, v.Ruta, v.Sha256));
        await using (var s = servicio.Paquete("1.2.0.zip"))
        {
            Assert.NotNull(s);
            Assert.Equal(3, s!.Length);
        }
        Assert.Null(servicio.Paquete("../version.json"));
        Assert.Null(servicio.Paquete("..\\..\\secreto.zip"));

        File.Delete(Path.Combine(raiz, "1.2.0.zip")); // manifiesto que apunta a un paquete que no está → se ignora
        Assert.Null(await servicio.UltimaAsync(default));
    }
}
