using Fiscalizacion.Application.Comun;
using Fiscalizacion.Application.Dtos;
using Fiscalizacion.Application.Fiscalizaciones;
using Fiscalizacion.Application.Usuarios;
using Fiscalizacion.Domain.Entidades;
using Fiscalizacion.Domain.Enums;
using Fiscalizacion.Infrastructure.Persistencia;
using Microsoft.EntityFrameworkCore;

namespace Fiscalizacion.Application.Tests;

/// <summary>GET /fiscalizaciones/{id}/solicitudes-firma: estados de cada solicitud y quién puede verlas.</summary>
public class SolicitudesFiscalizacionTests
{
    private readonly UsuarioFalso usuario = new();
    private readonly RelojFijo reloj = new();
    private readonly AppDbContext db;

    public SolicitudesFiscalizacionTests()
    {
        var opciones = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .AddInterceptors(new InterceptorBitacora(usuario, reloj, new CorrelacionFalsa()))
            .Options;
        db = new AppDbContext(opciones);
        db.Database.EnsureCreated();
    }

    private async Task<Usuario> EntrarComo(string correo, string? nombre = null)
    {
        var u = await new ServicioUsuarios(db, usuario, reloj).AsegurarAsync(correo, null, nombre, default);
        usuario.Id = u.Id;
        usuario.Correo = u.Correo;
        usuario.EsAdministrador = u.Rol == Rol.Administrador;
        return u;
    }

    private ServicioFiscalizaciones Fiscalizaciones() => new(db, usuario, reloj);
    private ServicioFirmas Firmas() => new(db, usuario, reloj, Fiscalizaciones());
    private ServicioSolicitudesFiscalizacion Solicitudes() => new(db, reloj, Fiscalizaciones());

    private static FiscalizacionEntradaDto Entrada() => new(null,
        new VisitaDto(new DateOnly(2026, 10, 20), new TimeOnly(7, 15), new TimeOnly(9, 5), 1, new TimeOnly(8, 40), null),
        null, null, null, null, null);

    /// <summary>Administrador, autor (María) y dos firmantes (Pedro y Ana); deja la sesión en María con un borrador.</summary>
    private async Task<(Guid id, Usuario autor, Usuario pedro, Usuario ana)> Preparar()
    {
        await EntrarComo("admin@egehid.gob.do", "Administración");
        var pedro = await EntrarComo("pedro.almonte@egehid.gob.do", "Pedro Almonte");
        var ana = await EntrarComo("ana.perez@egehid.gob.do", "Ana Pérez");
        var autor = await EntrarComo("maria@egehid.gob.do", "María Rosario Peña");
        var id = Guid.NewGuid();
        await Fiscalizaciones().GuardarAsync(id, Entrada(), default);
        return (id, autor, pedro, ana);
    }

    private void Como(Usuario u)
    {
        usuario.Id = u.Id;
        usuario.Correo = u.Correo;
        usuario.EsAdministrador = u.Rol == Rol.Administrador;
    }

    [Fact]
    public async Task Lista_las_solicitudes_del_registro_con_firmante_y_vencimiento_a_7_dias()
    {
        var (id, _, pedro, _) = await Preparar();
        await Firmas().SolicitarAsync(id, new CrearSolicitudDto(RolFirma.SupervisorCombustibles, pedro.Id), default);

        var lista = await Solicitudes().ListarAsync(id, default);

        var s = Assert.Single(lista);
        Assert.Equal(RolFirma.SupervisorCombustibles, s.Rol);
        Assert.Equal(EstadoSolicitud.Pendiente, s.Estado);
        Assert.Equal(pedro.Id, s.UsuarioDestinoId);
        Assert.Equal("Pedro Almonte", s.Firmante);
        Assert.Equal("pedro.almonte@egehid.gob.do", s.CorreoFirmante);
        Assert.Equal("María Rosario Peña", s.SolicitadaPor);
        Assert.Equal(reloj.Ahora, s.CreadaEn);
        Assert.Equal(reloj.Ahora.AddDays(7), s.ExpiraEn);
        Assert.Null(s.FirmadaEn);
    }

    [Fact]
    public async Task Reenviar_deja_la_anterior_expirada_y_la_nueva_primero()
    {
        var (id, _, pedro, ana) = await Preparar();
        await Firmas().SolicitarAsync(id, new CrearSolicitudDto(RolFirma.AuditorCierre2, pedro.Id), default);
        reloj.Ahora = reloj.Ahora.AddMinutes(5);
        await Firmas().SolicitarAsync(id, new CrearSolicitudDto(RolFirma.AuditorCierre2, ana.Id), default);

        var lista = await Solicitudes().ListarAsync(id, default);

        Assert.Equal(2, lista.Count);
        Assert.Equal(("Ana Pérez", EstadoSolicitud.Pendiente), (lista[0].Firmante, lista[0].Estado));
        Assert.Equal(("Pedro Almonte", EstadoSolicitud.Expirada), (lista[1].Firmante, lista[1].Estado));
    }

    [Fact]
    public async Task Informa_firmada_con_su_hora_rechazada_con_motivo_y_vencida_como_expirada()
    {
        var (id, autor, pedro, ana) = await Preparar();
        var firmar = await Firmas().SolicitarAsync(id, new CrearSolicitudDto(RolFirma.SupervisorCombustibles, pedro.Id), default);
        var rechazar = await Firmas().SolicitarAsync(id, new CrearSolicitudDto(RolFirma.AuditorUai, ana.Id), default);
        await Firmas().SolicitarAsync(id, new CrearSolicitudDto(RolFirma.AuditorCierre2, ana.Id), default);

        Como(pedro);
        reloj.Ahora = reloj.Ahora.AddHours(1);
        var firmadaEn = reloj.Ahora;
        await Firmas().FirmarSolicitudAsync(firmar.Id,
            new FirmarSolicitudDto(false, Convert.ToBase64String(ImagenesPrueba.Firma(1))), default);
        Como(ana);
        await Firmas().RechazarAsync(rechazar.Id, new RechazarSolicitudDto("No estuve en la descarga"), default);

        Como(autor);
        reloj.Ahora = reloj.Ahora.AddDays(8); // la de Auditor de cierre 2 venció sin firmar
        var lista = await Solicitudes().ListarAsync(id, default);

        var s1 = lista.Single(s => s.Rol == RolFirma.SupervisorCombustibles);
        Assert.Equal(EstadoSolicitud.Firmada, s1.Estado);
        Assert.Equal(firmadaEn, s1.FirmadaEn);
        var s2 = lista.Single(s => s.Rol == RolFirma.AuditorUai);
        Assert.Equal(EstadoSolicitud.Rechazada, s2.Estado);
        Assert.Equal("No estuve en la descarga", s2.Comentario);
        Assert.Equal(EstadoSolicitud.Expirada, lista.Single(s => s.Rol == RolFirma.AuditorCierre2).Estado);
        // el GET no escribe: en la base sigue «Pendiente» hasta que alguien la cierre
        Assert.Equal(1, await db.SolicitudesFirma.CountAsync(s => s.Estado == EstadoSolicitud.Pendiente));
    }

    [Fact]
    public async Task Solo_la_ve_quien_puede_ver_el_registro()
    {
        var (id, _, pedro, ana) = await Preparar();
        await Firmas().SolicitarAsync(id, new CrearSolicitudDto(RolFirma.SupervisorCombustibles, pedro.Id), default);

        // otro auditor sin solicitud en este registro → 403
        Como(ana);
        await Assert.ThrowsAsync<ProhibidoException>(() => Solicitudes().ListarAsync(id, default));

        // el firmante con solicitud ve el registro, y también sus solicitudes
        Como(pedro);
        Assert.Single(await Solicitudes().ListarAsync(id, default));

        // el administrador ve todo
        Como(await db.Usuarios.SingleAsync(u => u.Correo == "admin@egehid.gob.do"));
        Assert.Single(await Solicitudes().ListarAsync(id, default));

        await Assert.ThrowsAsync<NoEncontradoException>(() => Solicitudes().ListarAsync(Guid.NewGuid(), default));
    }

    [Fact]
    public async Task Sin_solicitudes_devuelve_lista_vacia()
    {
        var (id, _, _, _) = await Preparar();
        Assert.Empty(await Solicitudes().ListarAsync(id, default));
    }
}
