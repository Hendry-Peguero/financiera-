using Fiscalizacion.Domain.Entidades;
using Fiscalizacion.Domain.Enums;
using Fiscalizacion.Domain.Reglas;

namespace Fiscalizacion.Domain.Tests;

public class ReglasUsuariosTests
{
    private static readonly Guid Yo = Guid.NewGuid();

    private static Usuario U(Rol rol, bool activo = true, Guid? id = null) =>
        new() { Id = id ?? Guid.NewGuid(), Correo = "x@egehid.gob.do", Rol = rol, Activo = activo };

    [Theory]
    [InlineData("  Ana.Perez@EGEHID.gob.do ", "ana.perez@egehid.gob.do")]
    [InlineData("pedro@hidroelectrica.gov.do", "pedro@hidroelectrica.gov.do")]
    [InlineData("sin-arroba", null)]
    [InlineData("a@b", null)]
    [InlineData("dos@@egehid.gob.do", null)]
    [InlineData("con espacio@egehid.gob.do", null)]
    [InlineData("", null)]
    [InlineData(null, null)]
    public void Normaliza_y_valida_el_correo(string? correo, string? esperado) =>
        Assert.Equal(esperado, ReglasUsuarios.NormalizarCorreo(correo));

    [Fact]
    public void Correo_demasiado_largo_no_es_valido() =>
        Assert.Null(ReglasUsuarios.NormalizarCorreo(new string('a', 250) + "@egehid.gob.do"));

    [Fact]
    public void El_administrador_no_se_desactiva_a_si_mismo() =>
        Assert.Equal("No puede desactivar su propia cuenta.",
            ReglasUsuarios.ValidarCambio(Yo, U(Rol.Administrador, id: Yo), Rol.Administrador, false, 3));

    [Theory]
    [InlineData(Rol.Auditor)]
    [InlineData(Rol.Firmante)]
    public void El_administrador_no_se_quita_el_rol_a_si_mismo(Rol nuevo) =>
        Assert.Equal("No puede quitarse a sí mismo el rol de Administrador.",
            ReglasUsuarios.ValidarCambio(Yo, U(Rol.Administrador, id: Yo), nuevo, true, 3));

    [Fact]
    public void Nunca_queda_sin_administradores_activos()
    {
        var unico = U(Rol.Administrador);
        Assert.Equal("Debe quedar al menos un administrador activo.", ReglasUsuarios.ValidarCambio(Yo, unico, Rol.Auditor, true, 1));
        Assert.Equal("Debe quedar al menos un administrador activo.", ReglasUsuarios.ValidarCambio(Yo, unico, Rol.Administrador, false, 1));
        Assert.Null(ReglasUsuarios.ValidarCambio(Yo, unico, Rol.Auditor, true, 2));
        Assert.Null(ReglasUsuarios.ValidarCambio(Yo, unico, Rol.Administrador, false, 2));
    }

    [Fact]
    public void Cambios_sobre_otros_roles_o_inactivos_no_cuentan_administradores()
    {
        Assert.Null(ReglasUsuarios.ValidarCambio(Yo, U(Rol.Auditor), Rol.Administrador, true, 1));
        Assert.Null(ReglasUsuarios.ValidarCambio(Yo, U(Rol.Auditor), Rol.Auditor, false, 1));
        // un administrador ya desactivado no es uno de los activos: cambiarle el rol no deja a nadie sin administrador
        Assert.Null(ReglasUsuarios.ValidarCambio(Yo, U(Rol.Administrador, activo: false), Rol.Auditor, false, 1));
        // reactivarse o confirmar el mismo rol sobre sí mismo es válido
        Assert.Null(ReglasUsuarios.ValidarCambio(Yo, U(Rol.Administrador, id: Yo), Rol.Administrador, true, 1));
    }

    [Fact]
    public void Pendiente_de_ingreso_hasta_su_primer_acceso()
    {
        var u = U(Rol.Auditor);
        Assert.True(ReglasUsuarios.PendienteIngreso(u));
        u.Auth0Sub = "auth0|1";
        Assert.False(ReglasUsuarios.PendienteIngreso(u));
        Assert.False(ReglasUsuarios.PendienteIngreso(new Usuario { UltimoAcceso = DateTime.UtcNow }));
    }
}
