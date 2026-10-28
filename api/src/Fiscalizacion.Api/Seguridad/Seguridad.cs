using System.Security.Claims;
using System.Text.Encodings.Web;
using Fiscalizacion.Application.Abstracciones;
using Fiscalizacion.Application.Usuarios;
using Fiscalizacion.Domain.Enums;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace Fiscalizacion.Api.Seguridad;

public static class Claims
{
    public const string EmailAuth0 = "https://fiscalizacion/email";
    public const string EsquemaDev = "Dev";
    public const string EsquemaSelector = "Selector";
    public const string PoliticaBitacora = "BitacoraOwner";
    public const string PoliticaAdministrador = "Administrador";

    /// <summary>El correo es la identidad: claim estándar `email` o el claim que agrega la Action de Auth0.</summary>
    public static string? Correo(ClaimsPrincipal u) =>
        (u.FindFirst("email")?.Value ?? u.FindFirst(EmailAuth0)?.Value ?? u.FindFirst(ClaimTypes.Email)?.Value)
        ?.Trim().ToLowerInvariant();
}

public class OpcionesBitacora
{
    public string[] Propietarios { get; set; } = [];
    public bool EsPropietario(string? correo) =>
        correo is not null && Propietarios.Any(p => string.Equals(p, correo, StringComparison.OrdinalIgnoreCase));
}

/// <summary>Usuario de la petición; lo llena <see cref="MiddlewareUsuario"/>.</summary>
public class UsuarioActual(IOptions<OpcionesBitacora> bitacora) : IUsuarioActual
{
    public Guid? Id { get; set; }
    public string? Correo { get; set; }
    public string? Auth0Sub { get; set; }
    public string? Nombre { get; set; }
    public Rol? Rol { get; set; }
    public bool EsAdministrador => Rol == Domain.Enums.Rol.Administrador;
    public bool EsPropietarioBitacora => bitacora.Value.EsPropietario(Correo);
}

public class Correlacion(IHttpContextAccessor http) : ICorrelacion
{
    public string? Id => http.HttpContext?.TraceIdentifier;
}

/// <summary>Da de alta al usuario en su primer ingreso y agrega su rol como claim.</summary>
public class MiddlewareUsuario(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext ctx, UsuarioActual actual, ServicioUsuarios usuarios)
    {
        if (ctx.User.Identity?.IsAuthenticated == true)
        {
            var correo = Claims.Correo(ctx.User);
            if (correo is null)
            {
                ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
                await ctx.Response.WriteAsJsonAsync(new { title = "El token no trae el correo. Configure la Action de Auth0." });
                return;
            }

            actual.Correo = correo;
            actual.Auth0Sub = ctx.User.FindFirst("sub")?.Value;
            var u = await usuarios.AsegurarAsync(correo, actual.Auth0Sub, ctx.User.FindFirst("name")?.Value, ctx.RequestAborted);
            if (!u.Activo)
            {
                ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
                await ctx.Response.WriteAsJsonAsync(new { title = "Usuario desactivado." });
                return;
            }
            actual.Id = u.Id;
            actual.Nombre = u.NombreCompleto;
            actual.Rol = u.Rol;
            ctx.User.AddIdentity(new ClaimsIdentity([new Claim(ClaimTypes.Role, u.Rol.ToString())]));
        }
        await next(ctx);
    }
}

/// <summary>
/// Solo en Development con Auth:Mode=Dev: el encabezado X-Dev-User trae el correo, sin Auth0.
/// Sirve para desarrollar sin conexión y para las pruebas E2E.
/// </summary>
public class ManejadorDev(IOptionsMonitor<AuthenticationSchemeOptions> o, ILoggerFactory l, UrlEncoder e)
    : AuthenticationHandler<AuthenticationSchemeOptions>(o, l, e)
{
    public const string Encabezado = "X-Dev-User";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var correo = Request.Headers[Encabezado].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(correo) || !correo.Contains('@')) return Task.FromResult(AuthenticateResult.NoResult());
        var identidad = new ClaimsIdentity([new Claim("email", correo), new Claim("sub", "dev|" + correo)], Claims.EsquemaDev);
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identidad), Claims.EsquemaDev)));
    }
}
