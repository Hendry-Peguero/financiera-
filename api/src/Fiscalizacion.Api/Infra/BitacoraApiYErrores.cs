using System.Diagnostics;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Channels;
using Fiscalizacion.Api.Seguridad;
using Fiscalizacion.Application.Comun;
using Fiscalizacion.Domain.Entidades;
using Fiscalizacion.Domain.Reglas;
using Fiscalizacion.Infrastructure.Persistencia;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Fiscalizacion.Api.Infra;

/// <summary>Cola en memoria: la petición no espera a que se escriba la bitácora.</summary>
public class ColaBitacoraApi
{
    private readonly Channel<BitacoraApi> canal = Channel.CreateBounded<BitacoraApi>(
        new BoundedChannelOptions(10_000) { FullMode = BoundedChannelFullMode.DropOldest });

    public void Encolar(BitacoraApi fila) => canal.Writer.TryWrite(fila);
    public ChannelReader<BitacoraApi> Lector => canal.Reader;
}

public class MiddlewareBitacoraApi(RequestDelegate next, ColaBitacoraApi cola)
{
    private static readonly string[] Omitir = ["/openapi", "/api/salud"];

    public async Task InvokeAsync(HttpContext ctx, UsuarioActual usuario)
    {
        if (HttpMethods.IsOptions(ctx.Request.Method) || Omitir.Any(o => ctx.Request.Path.StartsWithSegments(o)))
        {
            await next(ctx);
            return;
        }

        var reloj = Stopwatch.StartNew();
        var momento = DateTime.UtcNow;
        try
        {
            await next(ctx);
        }
        finally
        {
            cola.Encolar(new BitacoraApi
            {
                Momento = momento,
                UsuarioId = usuario.Id,
                Correo = usuario.Correo,
                Metodo = ctx.Request.Method,
                Ruta = Texto.Limpiar(ctx.Request.Path.Value, 400) ?? "/",
                Query = Texto.Limpiar(ctx.Request.QueryString.Value, 1000),
                StatusCode = ctx.Response.StatusCode,
                DuracionMs = (int)reloj.ElapsedMilliseconds,
                Ip = ctx.Connection.RemoteIpAddress?.ToString(),
                UserAgent = Texto.Limpiar(ctx.Request.Headers.UserAgent.ToString(), 400),
                CorrelationId = ctx.TraceIdentifier
            });
        }
    }
}

/// <summary>Vacía la cola a bit.BitacoraApi por lotes.</summary>
public class EscritorBitacoraApi(ColaBitacoraApi cola, IServiceScopeFactory scopes, ILogger<EscritorBitacoraApi> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        var lote = new List<BitacoraApi>(200);
        while (await cola.Lector.WaitToReadAsync(ct))
        {
            while (lote.Count < 200 && cola.Lector.TryRead(out var fila)) lote.Add(fila);
            try
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                db.BitacoraApi.AddRange(lote);
                await db.SaveChangesAsync(ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                log.LogError(ex, "No se pudo escribir {Cantidad} filas de bitácora API", lote.Count);
            }
            lote.Clear();
        }
    }
}

public class ManejadorExcepciones(ILogger<ManejadorExcepciones> log, IProblemDetailsService problemas) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext ctx, Exception ex, CancellationToken ct)
    {
        var (status, titulo) = ex switch
        {
            ValidacionException => (400, "Hay datos pendientes o inválidos."),
            ReglaNegocioException => (400, ex.Message),
            NoEncontradoException => (404, ex.Message),
            ProhibidoException => (403, ex.Message),
            ConflictoException => (409, ex.Message),
            BadHttpRequestException b => (b.StatusCode, "Solicitud inválida."),
            _ => (500, "Error inesperado. Ya quedó registrado.")
        };
        if (status == 500) log.LogError(ex, "Error no controlado en {Ruta}", ctx.Request.Path);

        var detalle = new ProblemDetails { Status = status, Title = titulo };
        detalle.Extensions["traceId"] = ctx.TraceIdentifier;
        if (ex is ValidacionException v) detalle.Extensions["errors"] = v.Errores;
        if (ex is ConflictoException { Actual: { } actual }) detalle.Extensions["actual"] = actual;

        ctx.Response.StatusCode = status;
        return await problemas.TryWriteAsync(new ProblemDetailsContext { HttpContext = ctx, ProblemDetails = detalle, Exception = ex });
    }
}

/// <summary>Horas como "HH:mm" (24 h), según el contrato.</summary>
public class ConvertidorHora : JsonConverter<TimeOnly>
{
    public override TimeOnly Read(ref Utf8JsonReader r, Type t, JsonSerializerOptions o) =>
        TimeOnly.Parse(r.GetString()!, System.Globalization.CultureInfo.InvariantCulture);

    public override void Write(Utf8JsonWriter w, TimeOnly v, JsonSerializerOptions o) => w.WriteStringValue(v.ToString("HH:mm"));
}

/// <summary>Los DateTime se guardan en UTC sin zona; se publican siempre como ISO 8601 con "Z".</summary>
public class ConvertidorFechaUtc : JsonConverter<DateTime>
{
    public override DateTime Read(ref Utf8JsonReader r, Type t, JsonSerializerOptions o) => r.GetDateTime().ToUniversalTime();

    public override void Write(Utf8JsonWriter w, DateTime v, JsonSerializerOptions o) =>
        w.WriteStringValue(DateTime.SpecifyKind(v, v.Kind == DateTimeKind.Local ? DateTimeKind.Local : DateTimeKind.Utc).ToUniversalTime());
}
