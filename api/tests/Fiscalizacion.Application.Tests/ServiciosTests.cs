using Fiscalizacion.Application.Abstracciones;
using Fiscalizacion.Application.Bitacora;
using Fiscalizacion.Application.Comun;
using Fiscalizacion.Application.Dtos;
using Fiscalizacion.Application.Fiscalizaciones;
using Fiscalizacion.Application.Usuarios;
using Fiscalizacion.Domain.Entidades;
using Fiscalizacion.Domain.Enums;
using Fiscalizacion.Domain.Reglas;
using Fiscalizacion.Infrastructure.Persistencia;
using Microsoft.EntityFrameworkCore;

namespace Fiscalizacion.Application.Tests;

internal class UsuarioFalso : IUsuarioActual
{
    public Guid? Id { get; set; }
    public string? Correo { get; set; }
    public string? Auth0Sub => null;
    public string? Nombre => null;
    public bool EsAdministrador { get; set; }
    public bool EsPropietarioBitacora { get; set; }
}

internal class RelojFijo : IReloj
{
    public DateTime Ahora { get; set; } = new(2026, 10, 20, 12, 0, 0, DateTimeKind.Utc);
}

internal class CorrelacionFalsa : ICorrelacion
{
    public string? Id => "test";
}

public class ServiciosTests
{
    private readonly UsuarioFalso usuario = new();
    private readonly RelojFijo reloj = new();
    private readonly AppDbContext db;

    public ServiciosTests()
    {
        var opciones = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .AddInterceptors(new InterceptorBitacora(usuario, reloj, new CorrelacionFalsa()))
            .Options;
        db = new AppDbContext(opciones);
        db.Database.EnsureCreated(); // carga catálogos, 12 preguntas y la plantilla
    }

    private async Task<Usuario> EntrarComo(string correo)
    {
        var u = await new ServicioUsuarios(db, usuario, reloj).AsegurarAsync(correo, null, null, default);
        usuario.Id = u.Id;
        usuario.Correo = u.Correo;
        usuario.EsAdministrador = u.Rol == Rol.Administrador;
        return u;
    }

    private ServicioFiscalizaciones Fiscalizaciones() => new(db, usuario, reloj);

    private static FiscalizacionEntradaDto Entrada(byte[]? rv = null) => new(rv,
        new VisitaDto(new DateOnly(2026, 10, 20), new TimeOnly(7, 15), new TimeOnly(9, 5), 1, new TimeOnly(8, 40), null),
        null, null, new MedicionesDto(1, 4212.40m, 4200m, null, [], null), [new ControlDto(6, true, null)], null);

    [Fact]
    public async Task Primer_usuario_es_administrador_y_el_siguiente_auditor()
    {
        Assert.Equal(Rol.Administrador, (await EntrarComo("primero@egehid.gob.do")).Rol);
        Assert.Equal(Rol.Auditor, (await EntrarComo("segundo@egehid.gob.do")).Rol);
    }

    [Fact]
    public async Task Put_crea_el_borrador_con_el_id_de_la_tablet_y_es_idempotente()
    {
        await EntrarComo("a@egehid.gob.do");
        var id = Guid.NewGuid();
        var dto = await Fiscalizaciones().GuardarAsync(id, Entrada(), default);
        Assert.Equal(id, dto.Id);
        Assert.Equal(EstadoFiscalizacion.Borrador, dto.Estado);
        Assert.Contains(dto.Pendientes["controles"], m => m.Contains("control 6"));

        var otra = await Fiscalizaciones().GuardarAsync(id, Entrada(dto.RowVersion ?? []), default);
        Assert.Equal(dto.Numero, otra.Numero);
        Assert.Equal(1, await db.Fiscalizaciones.CountAsync());
    }

    [Fact]
    public async Task La_empresa_es_texto_libre_y_se_enlaza_al_catalogo_o_lo_agrega()
    {
        await EntrarComo("a@egehid.gob.do");
        var sunix = await db.Suplidores.FirstAsync(x => x.Nombre.StartsWith("Sunix"));
        DatosSuplidorDto Sup(string? nombre, int? id = null) => new("FT-1", "Chofer", "P-1", "CD-1", id, 10m, nombre);
        FiscalizacionEntradaDto Con(DatosSuplidorDto s, byte[]? rv = null) => Entrada(rv) with { Suplidor = s };

        // mismo nombre sin distinguir mayúsculas, acentos ni espacios → el suplidor del catálogo
        var id = Guid.NewGuid();
        var dto = await Fiscalizaciones().GuardarAsync(id, Con(Sup("  " + sunix.Nombre.ToUpperInvariant() + " ")), default);
        Assert.Equal(sunix.Id, dto.Suplidor.SuplidorId);
        Assert.Equal(sunix.Nombre.ToUpperInvariant(), dto.Suplidor.Nombre); // se guarda como se escribió

        // nombre nuevo → se agrega al catálogo una sola vez
        var antes = await db.Suplidores.CountAsync();
        dto = await Fiscalizaciones().GuardarAsync(id, Con(Sup("Combustibles Del Norte"), dto.RowVersion ?? []), default);
        var nuevo = await db.Suplidores.SingleAsync(x => x.Nombre == "Combustibles Del Norte");
        Assert.Equal(nuevo.Id, dto.Suplidor.SuplidorId);
        dto = await Fiscalizaciones().GuardarAsync(Guid.NewGuid(), Con(Sup("combustibles del  norte")), default);
        Assert.Equal(nuevo.Id, dto.Suplidor.SuplidorId);
        Assert.Equal(antes + 1, await db.Suplidores.CountAsync());

        // sin nombre (clientes anteriores): se toma el del catálogo por id
        dto = await Fiscalizaciones().GuardarAsync(Guid.NewGuid(), Con(Sup(null, sunix.Id)), default);
        Assert.Equal(sunix.Nombre, dto.Suplidor.Nombre);
        Assert.DoesNotContain(dto.Pendientes["suplidor"], m => m.Contains("empresa"));
    }

    [Fact]
    public async Task Put_sobre_un_finalizado_da_conflicto()
    {
        await EntrarComo("a@egehid.gob.do");
        var id = Guid.NewGuid();
        await Fiscalizaciones().GuardarAsync(id, Entrada(), default);
        var f = await db.Fiscalizaciones.FindAsync(id);
        f!.Estado = EstadoFiscalizacion.Finalizado;
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<ConflictoException>(() => Fiscalizaciones().GuardarAsync(id, Entrada([]), default));
    }

    [Fact]
    public async Task Otro_auditor_no_puede_editar_ni_ver_un_registro_ajeno()
    {
        await EntrarComo("admin@egehid.gob.do");
        await EntrarComo("autor@egehid.gob.do");
        var id = Guid.NewGuid();
        await Fiscalizaciones().GuardarAsync(id, Entrada(), default);

        await EntrarComo("otro@egehid.gob.do");
        await Assert.ThrowsAsync<ProhibidoException>(() => Fiscalizaciones().GuardarAsync(id, Entrada([]), default));
        await Assert.ThrowsAsync<ProhibidoException>(() => Fiscalizaciones().ObtenerAsync(id, default));
    }

    [Fact]
    public async Task Finalizar_con_control_6_Si_sin_observacion_falla()
    {
        await EntrarComo("a@egehid.gob.do");
        var id = Guid.NewGuid();
        await Fiscalizaciones().GuardarAsync(id, Entrada(), default);
        var ex = await Assert.ThrowsAsync<ValidacionException>(() => Fiscalizaciones().FinalizarAsync(id, default));
        Assert.Contains(ex.Errores["controles"], m => m.Contains("control 6"));
    }

    [Fact]
    public async Task Cada_cambio_queda_en_la_bitacora_de_cambios()
    {
        await EntrarComo("a@egehid.gob.do");
        await Fiscalizaciones().GuardarAsync(Guid.NewGuid(), Entrada(), default);
        Assert.Contains(await db.BitacoraCambios.ToListAsync(), b => b.Entidad == "Fiscalizacion" && b.Accion == AccionCambio.Crear);
    }

    [Fact]
    public async Task Eventos_ui_son_idempotentes_y_solo_el_propietario_consulta()
    {
        await EntrarComo("a@egehid.gob.do");
        var bitacora = new ServicioBitacora(db, usuario, reloj);
        var ev = new EventoUiDto(Guid.NewGuid(), reloj.Ahora, Guid.NewGuid(), "click", "/", "Guardar borrador", null, "test");
        Assert.Equal(1, await bitacora.RegistrarUiAsync(new LoteEventosUiDto([ev]), default));
        Assert.Equal(0, await bitacora.RegistrarUiAsync(new LoteEventosUiDto([ev]), default));

        usuario.EsPropietarioBitacora = false;
        await Assert.ThrowsAsync<ProhibidoException>(() => bitacora.UiAsync(new FiltroBitacora(null, null, null, null, null), default));
        usuario.EsPropietarioBitacora = true;
        Assert.Equal(1, (await bitacora.UiAsync(new FiltroBitacora(null, null, null, null, null), default)).Total);
    }
}
