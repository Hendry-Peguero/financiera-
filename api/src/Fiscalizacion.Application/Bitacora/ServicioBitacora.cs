using Fiscalizacion.Application.Abstracciones;
using Fiscalizacion.Application.Comun;
using Fiscalizacion.Application.Dtos;
using Fiscalizacion.Domain.Entidades;
using Fiscalizacion.Domain.Reglas;
using Microsoft.EntityFrameworkCore;

namespace Fiscalizacion.Application.Bitacora;

public class ServicioBitacora(IAppDbContext db, IUsuarioActual usuario, IReloj reloj)
{
    public const int MaxEventosPorLote = 500;
    private static readonly HashSet<string> TiposUi = ["click", "navegacion", "envio", "error", "online", "offline"];

    /// <summary>Guarda un lote de eventos del front. Idempotente por IdCliente (reintentos sin duplicar).</summary>
    public async Task<int> RegistrarUiAsync(LoteEventosUiDto lote, CancellationToken ct)
    {
        if (lote.Eventos is not { Count: > 0 }) return 0;
        if (lote.Eventos.Count > MaxEventosPorLote) throw new ReglaNegocioException($"Máximo {MaxEventosPorLote} eventos por lote.");

        var ids = lote.Eventos.Select(e => e.IdCliente).Distinct().ToList();
        var existentes = (await db.BitacoraUi.Where(b => ids.Contains(b.IdCliente)).Select(b => b.IdCliente).ToListAsync(ct)).ToHashSet();
        var nuevos = lote.Eventos
            .Where(e => e.IdCliente != Guid.Empty && !existentes.Contains(e.IdCliente) && TiposUi.Contains(e.Tipo))
            .DistinctBy(e => e.IdCliente)
            .Select(e => new BitacoraUi
            {
                IdCliente = e.IdCliente,
                Momento = e.Momento.ToUniversalTime(),
                RecibidoEn = reloj.Ahora,
                UsuarioId = usuario.Id,
                Correo = usuario.Correo,
                SesionId = e.SesionId,
                Tipo = e.Tipo,
                Ruta = Texto.Limpiar(e.Ruta, 400),
                Elemento = Texto.Limpiar(e.Elemento, 300),
                Detalle = e.Detalle is { } d ? Texto.Limpiar(d.GetRawText(), 4000) : null,
                Dispositivo = Texto.Limpiar(e.Dispositivo, 200)
            }).ToList();
        db.BitacoraUi.AddRange(nuevos);
        await db.SaveChangesAsync(ct);
        return nuevos.Count;
    }

    public async Task<Paginado<BitacoraUi>> UiAsync(FiltroBitacora f, CancellationToken ct)
    {
        Propietario();
        var q = db.BitacoraUi.AsNoTracking();
        if (f.Desde is { } d) q = q.Where(x => x.Momento >= d);
        if (f.Hasta is { } h) q = q.Where(x => x.Momento <= h);
        if (!string.IsNullOrWhiteSpace(f.Usuario)) q = q.Where(x => x.Correo!.Contains(f.Usuario));
        if (!string.IsNullOrWhiteSpace(f.Tipo)) q = q.Where(x => x.Tipo == f.Tipo);
        if (!string.IsNullOrWhiteSpace(f.Texto)) q = q.Where(x => x.Elemento!.Contains(f.Texto) || x.Ruta!.Contains(f.Texto));
        return await PaginarAsync(q.OrderByDescending(x => x.Momento).ThenByDescending(x => x.Id), f, ct);
    }

    public async Task<Paginado<BitacoraApi>> ApiAsync(FiltroBitacora f, CancellationToken ct)
    {
        Propietario();
        var q = db.BitacoraApi.AsNoTracking();
        if (f.Desde is { } d) q = q.Where(x => x.Momento >= d);
        if (f.Hasta is { } h) q = q.Where(x => x.Momento <= h);
        if (!string.IsNullOrWhiteSpace(f.Usuario)) q = q.Where(x => x.Correo!.Contains(f.Usuario));
        if (!string.IsNullOrWhiteSpace(f.Tipo)) q = q.Where(x => x.Metodo == f.Tipo);
        if (!string.IsNullOrWhiteSpace(f.Texto)) q = q.Where(x => x.Ruta.Contains(f.Texto));
        return await PaginarAsync(q.OrderByDescending(x => x.Momento).ThenByDescending(x => x.Id), f, ct);
    }

    public async Task<Paginado<BitacoraCambio>> CambiosAsync(FiltroBitacora f, CancellationToken ct)
    {
        Propietario();
        var q = db.BitacoraCambios.AsNoTracking();
        if (f.Desde is { } d) q = q.Where(x => x.Momento >= d);
        if (f.Hasta is { } h) q = q.Where(x => x.Momento <= h);
        if (!string.IsNullOrWhiteSpace(f.Usuario)) q = q.Where(x => x.Correo!.Contains(f.Usuario));
        if (!string.IsNullOrWhiteSpace(f.Tipo)) q = q.Where(x => x.Entidad == f.Tipo);
        if (!string.IsNullOrWhiteSpace(f.Texto)) q = q.Where(x => x.EntidadId.Contains(f.Texto) || x.ValoresNuevos!.Contains(f.Texto));
        return await PaginarAsync(q.OrderByDescending(x => x.Momento).ThenByDescending(x => x.Id), f, ct);
    }

    // Doble candado: la política del controlador y esta verificación.
    private void Propietario()
    {
        if (!usuario.EsPropietarioBitacora) throw new ProhibidoException("La bitácora es privada.");
    }

    private static async Task<Paginado<T>> PaginarAsync<T>(IQueryable<T> q, FiltroBitacora f, CancellationToken ct)
    {
        var tamano = Paginado<T>.Normalizar(f.Tamano ?? 50);
        var pagina = Math.Max(1, f.Pagina);
        return new Paginado<T>(await q.Skip((pagina - 1) * tamano).Take(tamano).ToListAsync(ct), await q.CountAsync(ct), pagina, tamano);
    }
}
