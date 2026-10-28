using System.Text.Json;
using Fiscalizacion.Application.Abstracciones;
using Fiscalizacion.Domain.Entidades;
using Fiscalizacion.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Fiscalizacion.Infrastructure.Persistencia;

/// <summary>Escribe una fila en bit.BitacoraCambio por cada alta, cambio o baja, en la misma transacción.</summary>
public class InterceptorBitacora(IUsuarioActual usuario, IReloj reloj, ICorrelacion correlacion) : SaveChangesInterceptor
{
    private static readonly HashSet<Type> Excluidas = [typeof(BitacoraApi), typeof(BitacoraCambio), typeof(BitacoraUi), typeof(LogTecnico)];

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData, InterceptionResult<int> result, CancellationToken ct = default)
    {
        if (eventData.Context is { } ctx) Registrar(ctx);
        return base.SavingChangesAsync(eventData, result, ct);
    }

    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        if (eventData.Context is { } ctx) Registrar(ctx);
        return base.SavingChanges(eventData, result);
    }

    private void Registrar(DbContext ctx)
    {
        ctx.ChangeTracker.DetectChanges();
        var filas = ctx.ChangeTracker.Entries()
            .Where(e => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted
                        && !Excluidas.Contains(e.Metadata.ClrType))
            .Select(Fila)
            .Where(f => f is not null)
            .ToList();
        ctx.Set<BitacoraCambio>().AddRange(filas!);
    }

    private BitacoraCambio? Fila(EntityEntry e)
    {
        var props = e.Properties.Where(p => !p.Metadata.IsConcurrencyToken).ToList();
        Dictionary<string, object?>? antes = null, despues = null;
        AccionCambio accion;
        switch (e.State)
        {
            case EntityState.Added:
                accion = AccionCambio.Crear;
                despues = props.ToDictionary(p => p.Metadata.Name, p => Valor(p.CurrentValue));
                break;
            case EntityState.Deleted:
                accion = AccionCambio.Eliminar;
                antes = props.ToDictionary(p => p.Metadata.Name, p => Valor(p.OriginalValue));
                break;
            default:
                var cambiadas = props.Where(p => p.IsModified && !Equals(p.OriginalValue, p.CurrentValue)).ToList();
                if (cambiadas.Count == 0) return null;
                accion = AccionCambio.Modificar;
                antes = cambiadas.ToDictionary(p => p.Metadata.Name, p => Valor(p.OriginalValue));
                despues = cambiadas.ToDictionary(p => p.Metadata.Name, p => Valor(p.CurrentValue));
                break;
        }

        var clave = e.Metadata.FindPrimaryKey()?.Properties
            .Select(p => e.Property(p.Name).CurrentValue?.ToString() ?? "")
            .ToArray() ?? [];

        return new BitacoraCambio
        {
            Momento = reloj.Ahora,
            UsuarioId = usuario.Id,
            Correo = usuario.Correo,
            Entidad = e.Metadata.DisplayName(),
            EntidadId = string.Join("|", clave),
            Accion = accion,
            ValoresAnteriores = antes is null ? null : JsonSerializer.Serialize(antes),
            ValoresNuevos = despues is null ? null : JsonSerializer.Serialize(despues),
            CorrelationId = correlacion.Id
        };
    }

    // Las imágenes no se copian a la bitácora: solo su tamaño.
    private static object? Valor(object? v) => v is byte[] b ? $"[binario {b.Length} bytes]" : v;
}
