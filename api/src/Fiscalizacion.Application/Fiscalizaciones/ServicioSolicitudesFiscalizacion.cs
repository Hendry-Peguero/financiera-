using Fiscalizacion.Application.Abstracciones;
using Fiscalizacion.Application.Comun;
using Fiscalizacion.Application.Dtos;
using Fiscalizacion.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Fiscalizacion.Application.Fiscalizaciones;

/// <summary>
/// Solicitudes de firma de un registro (GET /fiscalizaciones/{id}/solicitudes-firma): a quién se le dio acceso
/// para firmar cada rol y en qué quedó. Mismo permiso que ver el registro.
/// </summary>
public class ServicioSolicitudesFiscalizacion(IAppDbContext db, IReloj reloj, ServicioFiscalizaciones fiscalizaciones)
{
    public async Task<IReadOnlyList<SolicitudFirmaRegistroDto>> ListarAsync(Guid id, CancellationToken ct)
    {
        var f = await db.Fiscalizaciones.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new NoEncontradoException("Fiscalización no encontrada.");
        await fiscalizaciones.VerificarLecturaAsync(f, ct);

        var filas = await db.SolicitudesFirma.AsNoTracking()
            .Where(s => s.FiscalizacionId == id)
            .OrderByDescending(s => s.CreadaEn)
            .Select(s => new
            {
                s.Id, s.Rol, s.UsuarioDestinoId,
                Firmante = s.UsuarioDestino!.NombreCompleto, Correo = s.UsuarioDestino.Correo,
                SolicitadaPor = s.SolicitadaPor!.NombreCompleto,
                s.Estado, s.Comentario, s.CreadaEn, s.ExpiraEn
            })
            .ToListAsync(ct);

        // la firma que cerró cada solicitud: la del mismo rol hecha por el usuario destino
        var firmas = await db.Firmas.AsNoTracking()
            .Where(x => x.FiscalizacionId == id && x.UsuarioId != null)
            .Select(x => new { x.Rol, x.UsuarioId, x.FirmadoEn })
            .ToListAsync(ct);

        var ahora = reloj.Ahora;
        return filas.Select(s =>
        {
            // una pendiente vencida se informa como expirada aunque nadie la haya cerrado todavía
            var estado = s.Estado == EstadoSolicitud.Pendiente && s.ExpiraEn <= ahora ? EstadoSolicitud.Expirada : s.Estado;
            DateTime? firmadaEn = estado == EstadoSolicitud.Firmada
                ? firmas.FirstOrDefault(x => x.Rol == s.Rol && x.UsuarioId == s.UsuarioDestinoId)?.FirmadoEn
                : null;
            return new SolicitudFirmaRegistroDto(s.Id, s.Rol, s.UsuarioDestinoId,
                string.IsNullOrWhiteSpace(s.Firmante) ? s.Correo : s.Firmante, s.Correo, s.SolicitadaPor,
                estado, s.Comentario, s.CreadaEn, s.ExpiraEn, firmadaEn);
        }).ToList();
    }
}
