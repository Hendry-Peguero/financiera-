using System.Data;
using System.Text.Json.Serialization;
using Fiscalizacion.Api.Infra;
using Fiscalizacion.Api.Seguridad;
using Fiscalizacion.Application;
using Fiscalizacion.Application.Abstracciones;
using Fiscalizacion.Infrastructure;
using Fiscalizacion.Infrastructure.Persistencia;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Serilog;
using Serilog.Events;
using Serilog.Sinks.MSSqlServer;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;

// ---- Logs técnicos: consola, archivo diario y bit.LogTecnico (advertencias y errores) ----
builder.Host.UseSerilog((ctx, lc) =>
{
    var columnas = new ColumnOptions();
    columnas.Store.Remove(StandardColumn.Properties);
    columnas.Store.Add(StandardColumn.LogEvent);
    columnas.Id.DataType = SqlDbType.BigInt;
    columnas.TimeStamp.ConvertToUtc = true;
    columnas.TimeStamp.DataType = SqlDbType.DateTime2;
    lc.ReadFrom.Configuration(ctx.Configuration)
        .Enrich.FromLogContext()
        .WriteTo.Console()
        .WriteTo.File(Path.Combine(AppContext.BaseDirectory, "logs", "api-.log"), rollingInterval: RollingInterval.Day, retainedFileCountLimit: 30)
        .WriteTo.MSSqlServer(ctx.Configuration.GetConnectionString("Fiscalizacion"),
            new MSSqlServerSinkOptions { SchemaName = "bit", TableName = "LogTecnico", AutoCreateSqlTable = false },
            restrictedToMinimumLevel: LogEventLevel.Warning, columnOptions: columnas);
});

// ---- Capas ----
builder.Services.AddHttpContextAccessor();
builder.Services.Configure<OpcionesBitacora>(config.GetSection("Bitacora"));
builder.Services.AddScoped<UsuarioActual>();
builder.Services.AddScoped<IUsuarioActual>(sp => sp.GetRequiredService<UsuarioActual>());
builder.Services.AddScoped<ICorrelacion, Correlacion>();
builder.Services.AddInfraestructura(config);
builder.Services.AddAplicacion();
builder.Services.AddSingleton<ColaBitacoraApi>();
builder.Services.AddHostedService<EscritorBitacoraApi>();

// ---- Autenticación: Auth0 por correo; modo Dev solo en Development ----
var modoDev = builder.Environment.IsDevelopment() && string.Equals(config["Auth:Mode"], "Dev", StringComparison.OrdinalIgnoreCase);
var auth0Dominio = config["Auth0:Domain"];
var auth = builder.Services.AddAuthentication(Claims.EsquemaSelector)
    .AddPolicyScheme(Claims.EsquemaSelector, "Auth0 o Dev", o => o.ForwardDefaultSelector = ctx =>
        modoDev && ctx.Request.Headers.ContainsKey(ManejadorDev.Encabezado) ? Claims.EsquemaDev : JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.Authority = string.IsNullOrWhiteSpace(auth0Dominio) ? null : $"https://{auth0Dominio}/";
        o.Audience = config["Auth0:Audience"];
        o.MapInboundClaims = false;
        o.TokenValidationParameters.NameClaimType = "name";
    });
if (modoDev) auth.AddScheme<AuthenticationSchemeOptions, ManejadorDev>(Claims.EsquemaDev, null);

builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build())
    .AddPolicy(Claims.PoliticaAdministrador, p => p.RequireRole(nameof(Fiscalizacion.Domain.Enums.Rol.Administrador)))
    .AddPolicy(Claims.PoliticaBitacora, p => p.RequireAssertion(ctx =>
    {
        var propietarios = config.GetSection("Bitacora").Get<OpcionesBitacora>() ?? new();
        return propietarios.EsPropietario(Claims.Correo(ctx.User));
    }));

// ---- HTTP ----
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .WithOrigins(config.GetSection("Cors:Origenes").Get<string[]>() ?? ["http://localhost:5173"])
    .AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddControllers().AddJsonOptions(o =>
{
    o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    o.JsonSerializerOptions.Converters.Add(new ConvertidorHora());
    o.JsonSerializerOptions.Converters.Add(new ConvertidorFechaUtc());
});
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ManejadorExcepciones>();
builder.Services.AddOpenApi();

var app = builder.Build();

// Los registros van por fuera del manejador de errores para ver el código final (409, 400…), no la excepción.
app.UseSerilogRequestLogging();
app.UseMiddleware<MiddlewareBitacoraApi>();
app.UseExceptionHandler();
app.UseCors();
app.UseAuthentication();
app.UseMiddleware<MiddlewareUsuario>();
app.UseAuthorization();

if (app.Environment.IsDevelopment()) app.MapOpenApi().AllowAnonymous();
// La tablet confirma que habla con ESTA API (y no con el portal de una Wi-Fi) por `servicio` antes de sincronizar.
app.MapGet("/api/salud", async (AppDbContext db) =>
    await db.Database.CanConnectAsync()
        ? Results.Ok(new { estado = "ok", servicio = ServicioSalud.Nombre, hora = DateTime.UtcNow })
        : Results.Problem("Sin conexión a la base de datos"))
    .AllowAnonymous();
app.MapControllers();

if (modoDev) app.Logger.LogWarning("Autenticación en modo Dev: se acepta el encabezado {Encabezado}", ManejadorDev.Encabezado);
app.Run();

public partial class Program;

/// <summary>Marca de /api/salud: la app solo sincroniza si la respuesta trae este nombre.</summary>
public static class ServicioSalud
{
    public const string Nombre = "fiscalizacion-egehid";
}
