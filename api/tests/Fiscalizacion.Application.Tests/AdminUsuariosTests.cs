using System.Reflection;
using System.Security.Claims;
using Fiscalizacion.Api.Controllers;
using Fiscalizacion.Api.Seguridad;
using Fiscalizacion.Application.Comun;
using Fiscalizacion.Application.Usuarios;
using Fiscalizacion.Domain.Entidades;
using Fiscalizacion.Domain.Enums;
using Fiscalizacion.Domain.Reglas;
using Fiscalizacion.Infrastructure.Persistencia;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Fiscalizacion.Application.Tests;

public class AdminUsuariosTests
{
    private readonly UsuarioFalso usuario = new();
    private readonly RelojFijo reloj = new();
    private readonly AppDbContext db;

    public AdminUsuariosTests()
    {
        var opciones = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .AddInterceptors(new InterceptorBitacora(usuario, reloj, new CorrelacionFalsa()))
            .Options;
        db = new AppDbContext(opciones);
        db.Database.EnsureCreated();
    }

    private ServicioAdminUsuarios Servicio() => new(db, usuario, reloj);

    /// <summary>Alta por primer ingreso (el primero del sistema queda Administrador) y sesión con ese usuario.</summary>
    private async Task<Usuario> Alta(string correo, string? nombre = null, Rol? rol = null)
    {
        var u = await new ServicioUsuarios(db, usuario, reloj).AsegurarAsync(correo, "auth0|" + correo, nombre, default);
        if (rol is { } r && u.Rol != r)
        {
            u.Rol = r;
            await db.SaveChangesAsync();
        }
        return u;
    }

    private void Entrar(Usuario u)
    {
        usuario.Id = u.Id;
        usuario.Correo = u.Correo;
        usuario.EsAdministrador = u.Rol == Rol.Administrador;
    }

    [Fact]
    public async Task Solo_el_administrador_gestiona_usuarios()
    {
        await Alta("admin@egehid.gob.do", "Admin");
        var auditor = await Alta("auditor@egehid.gob.do", "Auditor");
        Entrar(auditor);
        var s = Servicio();
        await Assert.ThrowsAsync<ProhibidoException>(() => s.ListarAsync(new FiltroUsuarios(null, null, null), default));
        await Assert.ThrowsAsync<ProhibidoException>(() => s.RegistrarAsync(new NuevoUsuarioDto("n@egehid.gob.do", Rol.Auditor, null), default));
        await Assert.ThrowsAsync<ProhibidoException>(() => s.CambiarRolAsync(auditor.Id, new CambiarRolDto(Rol.Administrador), default));
        await Assert.ThrowsAsync<ProhibidoException>(() => s.ActivarAsync(auditor.Id, default));
        await Assert.ThrowsAsync<ProhibidoException>(() => s.DesactivarAsync(auditor.Id, default));
        Assert.Equal(Rol.Auditor, (await db.Usuarios.AsNoTracking().SingleAsync(u => u.Id == auditor.Id)).Rol);
    }

    [Fact]
    public void El_controlador_exige_la_politica_de_administrador_que_pide_el_rol()
    {
        var atributo = typeof(AdminUsuariosController).GetCustomAttribute<AuthorizeAttribute>();
        Assert.Equal(Claims.PoliticaAdministrador, atributo?.Policy);
        Assert.Equal("api/admin/usuarios", typeof(AdminUsuariosController).GetCustomAttribute<Microsoft.AspNetCore.Mvc.RouteAttribute>()?.Template);
        Assert.Equal(nameof(Rol.Administrador), Claims.PoliticaAdministrador);
    }

    [Fact]
    public async Task Lista_con_filtros_conteos_y_paginas()
    {
        var admin = await Alta("admin@egehid.gob.do", "Zoila Admin");
        await Alta("ana@egehid.gob.do", "Ana Pérez");
        var beto = await Alta("beto@egehid.gob.do", "Beto Gómez", Rol.Firmante);
        Entrar(admin);
        await Servicio().DesactivarAsync(beto.Id, default);
        await Servicio().RegistrarAsync(new NuevoUsuarioDto("nuevo@egehid.gob.do", Rol.Auditor, null), default);

        var todos = await Servicio().ListarAsync(new FiltroUsuarios(null, null, null), default);
        Assert.Equal(4, todos.Total);
        Assert.Equal(new Dictionary<string, int>
        {
            ["Administrador"] = 1, ["Auditor"] = 2, ["Firmante"] = 1,
            ["activos"] = 3, ["inactivos"] = 1, ["todos"] = 4, ["pendientes"] = 1
        }, todos.Conteos);
        // activos primero, por nombre; los que no han completado el nombre al final; desactivados al final
        Assert.Equal(["ana@egehid.gob.do", "admin@egehid.gob.do", "nuevo@egehid.gob.do", "beto@egehid.gob.do"],
            todos.Items.Select(u => u.Correo));
        var yo = todos.Items.Single(u => u.EsUsted);
        Assert.Equal(admin.Id, yo.Id);
        Assert.True(todos.Items.Single(u => u.Correo == "nuevo@egehid.gob.do").PendienteIngreso);

        var inactivos = await Servicio().ListarAsync(new FiltroUsuarios(null, null, "inactivos"), default);
        Assert.Equal("beto@egehid.gob.do", Assert.Single(inactivos.Items).Correo);
        Assert.False(inactivos.Items[0].Activo);

        var auditores = await Servicio().ListarAsync(new FiltroUsuarios("ana", Rol.Auditor, "activos"), default);
        Assert.Equal("Ana Pérez", Assert.Single(auditores.Items).NombreCompleto);

        var pagina2 = await Servicio().ListarAsync(new FiltroUsuarios(null, null, null, Pagina: 2, Tamano: 3), default);
        Assert.Equal((4, 2, 3), (pagina2.Total, pagina2.Pagina, pagina2.Tamano));
        Assert.Equal("beto@egehid.gob.do", Assert.Single(pagina2.Items).Correo);
    }

    [Fact]
    public async Task Registrar_por_correo_da_el_rol_en_el_primer_ingreso()
    {
        var admin = await Alta("admin@egehid.gob.do", "Admin");
        Entrar(admin);
        var dto = await Servicio().RegistrarAsync(new NuevoUsuarioDto("  Pedro.Almonte@EGEHID.gob.do ", Rol.Firmante, "Pedro Almonte"), default);
        Assert.Equal(("pedro.almonte@egehid.gob.do", Rol.Firmante, true, true), (dto.Correo, dto.Rol, dto.Activo, dto.PendienteIngreso));
        Assert.False(dto.PerfilCompleto);

        // primer ingreso por Auth0 con ese correo: conserva el rol y el nombre, y deja de estar pendiente
        var u = await new ServicioUsuarios(db, usuario, reloj).AsegurarAsync("pedro.almonte@egehid.gob.do", "auth0|pedro", "Otro nombre", default);
        Assert.Equal((dto.Id, Rol.Firmante, "Pedro Almonte", "auth0|pedro"), (u.Id, u.Rol, u.NombreCompleto, u.Auth0Sub));
        Assert.False(ReglasUsuarios.PendienteIngreso(u));
        Assert.Equal(2, await db.Usuarios.CountAsync());
    }

    [Theory]
    [InlineData("no-es-correo", "Escriba un correo válido (nombre@dominio).")]
    [InlineData("ADMIN@egehid.gob.do", "Ya existe un usuario con ese correo.")]
    public async Task Registrar_valida_el_correo(string correo, string mensaje)
    {
        Entrar(await Alta("admin@egehid.gob.do", "Admin"));
        var ex = await Assert.ThrowsAsync<ValidacionException>(() => Servicio().RegistrarAsync(new NuevoUsuarioDto(correo, Rol.Auditor, null), default));
        Assert.Equal([mensaje], ex.Errores["correo"]);
    }

    [Fact]
    public async Task El_administrador_no_se_desactiva_ni_se_quita_el_rol()
    {
        var admin = await Alta("admin@egehid.gob.do", "Admin");
        await Alta("otro.admin@egehid.gob.do", "Otro", Rol.Administrador);
        Entrar(admin);
        var e1 = await Assert.ThrowsAsync<ReglaNegocioException>(() => Servicio().DesactivarAsync(admin.Id, default));
        Assert.Equal("No puede desactivar su propia cuenta.", e1.Message);
        var e2 = await Assert.ThrowsAsync<ReglaNegocioException>(() => Servicio().CambiarRolAsync(admin.Id, new CambiarRolDto(Rol.Auditor), default));
        Assert.Equal("No puede quitarse a sí mismo el rol de Administrador.", e2.Message);
        var yo = await db.Usuarios.AsNoTracking().SingleAsync(u => u.Id == admin.Id);
        Assert.Equal((Rol.Administrador, true), (yo.Rol, yo.Activo));
    }

    [Fact]
    public async Task Nunca_deja_cero_administradores_activos()
    {
        var unico = await Alta("admin@egehid.gob.do", "Admin");
        // sesión de alguien con permiso de administrador que no es el administrador de la base (p. ej. rol cambiado a mitad de la sesión)
        usuario.Id = Guid.NewGuid();
        usuario.EsAdministrador = true;
        var e1 = await Assert.ThrowsAsync<ReglaNegocioException>(() => Servicio().CambiarRolAsync(unico.Id, new CambiarRolDto(Rol.Auditor), default));
        Assert.Equal("Debe quedar al menos un administrador activo.", e1.Message);
        await Assert.ThrowsAsync<ReglaNegocioException>(() => Servicio().DesactivarAsync(unico.Id, default));

        // con un segundo administrador sí se puede
        var segundo = await Alta("segundo@egehid.gob.do", "Segundo", Rol.Administrador);
        Entrar(segundo);
        var dto = await Servicio().CambiarRolAsync(unico.Id, new CambiarRolDto(Rol.Auditor), default);
        Assert.Equal(Rol.Auditor, dto.Rol);
    }

    [Fact]
    public async Task Cambiar_rol_activar_y_desactivar_quedan_en_la_bitacora_de_cambios()
    {
        var admin = await Alta("admin@egehid.gob.do", "Admin");
        var ana = await Alta("ana@egehid.gob.do", "Ana");
        Entrar(admin);
        var antes = await db.BitacoraCambios.CountAsync();

        Assert.Equal(Rol.Administrador, (await Servicio().CambiarRolAsync(ana.Id, new CambiarRolDto(Rol.Administrador), default)).Rol);
        Assert.False((await Servicio().DesactivarAsync(ana.Id, default)).Activo);
        Assert.True((await Servicio().ActivarAsync(ana.Id, default)).Activo);
        // sin cambio real no se escribe nada
        await Servicio().ActivarAsync(ana.Id, default);

        var filas = await db.BitacoraCambios.AsNoTracking().OrderBy(b => b.Id).Skip(antes).ToListAsync();
        Assert.Equal(3, filas.Count);
        Assert.All(filas, f => Assert.Equal(("Usuario", ana.Id.ToString(), AccionCambio.Modificar, admin.Id), (f.Entidad, f.EntidadId, f.Accion, f.UsuarioId)));
        Assert.Contains("\"Rol\"", filas[0].ValoresNuevos);
        Assert.Contains("\"Activo\":false", filas[1].ValoresNuevos);
        Assert.Contains("\"Activo\":true", filas[2].ValoresNuevos);
    }

    [Fact]
    public async Task Usuario_inexistente_da_404()
    {
        Entrar(await Alta("admin@egehid.gob.do", "Admin"));
        await Assert.ThrowsAsync<NoEncontradoException>(() => Servicio().DesactivarAsync(Guid.NewGuid(), default));
    }

    // ---- Usuario desactivado: 403 en toda la API (MiddlewareUsuario) ----

    private async Task<(int Status, bool Siguio)> Peticion(string correo)
    {
        var actual = new UsuarioActual(Options.Create(new OpcionesBitacora()));
        var ctx = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("email", correo), new Claim("sub", "auth0|" + correo)], "Prueba")),
            RequestServices = new ServiceCollection().BuildServiceProvider()
        };
        ctx.Response.Body = new MemoryStream();
        var siguio = false;
        var mw = new MiddlewareUsuario(_ => { siguio = true; return Task.CompletedTask; });
        await mw.InvokeAsync(ctx, actual, new ServicioUsuarios(db, actual, reloj));
        return (ctx.Response.StatusCode, siguio);
    }

    [Fact]
    public async Task Un_usuario_desactivado_recibe_403_y_al_reactivarlo_vuelve_a_entrar()
    {
        var admin = await Alta("admin@egehid.gob.do", "Admin");
        var ana = await Alta("ana@egehid.gob.do", "Ana");
        Assert.Equal((200, true), await Peticion("ana@egehid.gob.do"));

        Entrar(admin);
        await Servicio().DesactivarAsync(ana.Id, default);
        Assert.Equal((403, false), await Peticion("ana@egehid.gob.do"));
        Assert.Equal((403, false), await Peticion("ANA@egehid.gob.do"));

        await Servicio().ActivarAsync(ana.Id, default);
        Assert.Equal((200, true), await Peticion("ana@egehid.gob.do"));
    }

    [Fact]
    public async Task Un_registrado_por_adelantado_y_desactivado_no_entra()
    {
        Entrar(await Alta("admin@egehid.gob.do", "Admin"));
        var dto = await Servicio().RegistrarAsync(new NuevoUsuarioDto("pedro@egehid.gob.do", Rol.Auditor, null), default);
        await Servicio().DesactivarAsync(dto.Id, default);
        Assert.Equal((403, false), await Peticion("pedro@egehid.gob.do"));
    }
}
