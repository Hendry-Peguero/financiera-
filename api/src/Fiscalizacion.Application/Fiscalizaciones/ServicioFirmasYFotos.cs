using System.Security.Cryptography;
using Fiscalizacion.Application.Abstracciones;
using Fiscalizacion.Application.Comun;
using Fiscalizacion.Application.Dtos;
using Fiscalizacion.Domain.Entidades;
using Fiscalizacion.Domain.Enums;
using Fiscalizacion.Domain.Reglas;
using Microsoft.EntityFrameworkCore;

namespace Fiscalizacion.Application.Fiscalizaciones;

public static class Imagenes
{
    public const int MaxFirmaBytes = 512 * 1024;
    public const long MaxFotoBytes = 8 * 1024 * 1024;

    public static byte[] DesdeBase64(string? base64, int max)
    {
        if (string.IsNullOrWhiteSpace(base64)) throw new ReglaNegocioException("Falta la imagen de la firma.");
        var coma = base64.IndexOf(',');
        if (base64.StartsWith("data:") && coma > 0) base64 = base64[(coma + 1)..];
        byte[] bytes;
        try { bytes = Convert.FromBase64String(base64); }
        catch (FormatException) { throw new ReglaNegocioException("La imagen no es base64 válido."); }
        if (bytes.Length > max) throw new ReglaNegocioException("La imagen es demasiado grande.");
        if (bytes.Length < 8 || bytes[0] != 0x89 || bytes[1] != 0x50) throw new ReglaNegocioException("La firma debe ser PNG.");
        return bytes;
    }

    public static string Sha256(byte[] datos) => Convert.ToHexString(SHA256.HashData(datos)).ToLowerInvariant();
}

public class ServicioFirmas(IAppDbContext db, IUsuarioActual usuario, IReloj reloj, ServicioFiscalizaciones fiscalizaciones)
{
    private Guid UsuarioId => usuario.Id ?? throw new ProhibidoException("Usuario no identificado.");

    /// <summary>Firma en el formulario: con la firma predeterminada del usuario, en su equipo o "aquí" sin usuario.</summary>
    public async Task<FiscalizacionDto> FirmarAsync(Guid id, RolFirma rol, FirmarDto dto, CancellationToken ct)
    {
        var f = await fiscalizaciones.CargarAsync(id, ct);
        fiscalizaciones.VerificarEscritura(f);
        if (!f.EsEditable) throw new ConflictoException("Solo se firma un borrador.");

        byte[] imagen;
        Guid? firmante = null;
        string nombre;
        if (dto.Modo == ModoFirma.EnEstaTablet)
        {
            nombre = Texto.Limpiar(dto.NombreFirmante, 150) ?? throw new ReglaNegocioException("Falta el nombre de quien firma.");
            imagen = Imagenes.DesdeBase64(dto.ImagenBase64, Imagenes.MaxFirmaBytes);
        }
        else
        {
            var yo = await db.Usuarios.FirstAsync(u => u.Id == UsuarioId, ct);
            firmante = yo.Id;
            nombre = yo.NombreCompleto;
            imagen = dto.Modo == ModoFirma.Predeterminada && string.IsNullOrWhiteSpace(dto.ImagenBase64)
                ? yo.FirmaPredeterminada ?? throw new ReglaNegocioException("No tiene firma predeterminada guardada.")
                : Imagenes.DesdeBase64(dto.ImagenBase64, Imagenes.MaxFirmaBytes);
        }

        f.Firmas.RemoveAll(x => x.Rol == rol);
        f.Firmas.Add(new Firma
        {
            FiscalizacionId = f.Id, Rol = rol, NombreFirmante = nombre, Cedula = Texto.Limpiar(dto.Cedula, 20),
            UsuarioId = firmante, Modo = dto.Modo, Imagen = imagen, Sha256 = Imagenes.Sha256(imagen), FirmadoEn = reloj.Ahora
        });
        f.ActualizadoEn = reloj.Ahora;
        await fiscalizaciones.GuardarCambiosAsync(ct);
        return Mapeo.ADto(f, await fiscalizaciones.PreguntasAsync(ct));
    }

    public async Task<SolicitudFirmaDto> SolicitarAsync(Guid id, CrearSolicitudDto dto, CancellationToken ct)
    {
        var f = await fiscalizaciones.CargarAsync(id, ct);
        fiscalizaciones.VerificarEscritura(f);
        if (!f.EsEditable) throw new ConflictoException("Solo se solicitan firmas en un borrador.");
        if (f.Firmas.Any(x => x.Rol == dto.Rol)) throw new ConflictoException("Ese rol ya firmó.");
        if (!await db.Usuarios.AnyAsync(u => u.Id == dto.UsuarioDestinoId && u.Activo, ct))
            throw new NoEncontradoException("Usuario destino no encontrado.");

        // Una solicitud vigente por rol: la nueva reemplaza a la anterior.
        var previas = await db.SolicitudesFirma
            .Where(s => s.FiscalizacionId == id && s.Rol == dto.Rol && s.Estado == EstadoSolicitud.Pendiente).ToListAsync(ct);
        previas.ForEach(s => s.Estado = EstadoSolicitud.Expirada);

        var sol = new SolicitudFirma
        {
            Id = Guid.NewGuid(), FiscalizacionId = id, Rol = dto.Rol, UsuarioDestinoId = dto.UsuarioDestinoId,
            SolicitadaPorId = UsuarioId, CreadaEn = reloj.Ahora, ExpiraEn = reloj.Ahora.AddDays(SolicitudFirma.DiasVigencia)
        };
        db.SolicitudesFirma.Add(sol);
        await db.SaveChangesAsync(ct);
        return (await ConsultarAsync(db.SolicitudesFirma.Where(s => s.Id == sol.Id), ct)).Single();
    }

    public async Task<IReadOnlyList<SolicitudFirmaDto>> MiasAsync(CancellationToken ct)
    {
        var vencidas = await db.SolicitudesFirma
            .Where(s => s.UsuarioDestinoId == UsuarioId && s.Estado == EstadoSolicitud.Pendiente && s.ExpiraEn <= reloj.Ahora)
            .ToListAsync(ct);
        if (vencidas.Count > 0)
        {
            vencidas.ForEach(s => s.Estado = EstadoSolicitud.Expirada);
            await db.SaveChangesAsync(ct);
        }
        return await ConsultarAsync(db.SolicitudesFirma.Where(s => s.UsuarioDestinoId == UsuarioId)
            .OrderByDescending(s => s.CreadaEn).Take(100), ct);
    }

    public async Task<FiscalizacionDto> FirmarSolicitudAsync(Guid solicitudId, FirmarSolicitudDto dto, CancellationToken ct)
    {
        var sol = await SolicitudPropiaAsync(solicitudId, ct);
        var f = await fiscalizaciones.CargarAsync(sol.FiscalizacionId, ct);
        if (!f.EsEditable) throw new ConflictoException("El formulario ya no admite firmas.");
        var yo = await db.Usuarios.FirstAsync(u => u.Id == UsuarioId, ct);
        var imagen = dto.UsarPredeterminada
            ? yo.FirmaPredeterminada ?? throw new ReglaNegocioException("No tiene firma predeterminada guardada.")
            : Imagenes.DesdeBase64(dto.ImagenBase64, Imagenes.MaxFirmaBytes);

        f.Firmas.RemoveAll(x => x.Rol == sol.Rol);
        f.Firmas.Add(new Firma
        {
            FiscalizacionId = f.Id, Rol = sol.Rol, NombreFirmante = yo.NombreCompleto, UsuarioId = yo.Id,
            Modo = dto.UsarPredeterminada ? ModoFirma.Predeterminada : ModoFirma.EnSuEquipo,
            Imagen = imagen, Sha256 = Imagenes.Sha256(imagen), FirmadoEn = reloj.Ahora
        });
        sol.Estado = EstadoSolicitud.Firmada;
        f.ActualizadoEn = reloj.Ahora;
        await fiscalizaciones.GuardarCambiosAsync(ct);
        return Mapeo.ADto(f, await fiscalizaciones.PreguntasAsync(ct));
    }

    public async Task RechazarAsync(Guid solicitudId, RechazarSolicitudDto dto, CancellationToken ct)
    {
        var sol = await SolicitudPropiaAsync(solicitudId, ct);
        sol.Estado = EstadoSolicitud.Rechazada;
        sol.Comentario = Texto.Limpiar(dto.Comentario, 500) ?? throw new ReglaNegocioException("Escriba el motivo del rechazo.");
        await db.SaveChangesAsync(ct);
    }

    private async Task<SolicitudFirma> SolicitudPropiaAsync(Guid id, CancellationToken ct)
    {
        var sol = await db.SolicitudesFirma.FirstOrDefaultAsync(s => s.Id == id, ct) ?? throw new NoEncontradoException("Solicitud no encontrada.");
        if (sol.UsuarioDestinoId != UsuarioId) throw new ProhibidoException();
        if (!sol.EstaVigente(reloj.Ahora)) throw new ConflictoException("La solicitud ya no está vigente.");
        return sol;
    }

    private static Task<List<SolicitudFirmaDto>> ConsultarAsync(IQueryable<SolicitudFirma> q, CancellationToken ct) =>
        q.Select(s => new SolicitudFirmaDto(s.Id, s.FiscalizacionId, s.Fiscalizacion!.Numero, s.Rol,
            s.SolicitadaPor!.NombreCompleto, s.CreadaEn, s.ExpiraEn, s.Estado)).ToListAsync(ct);
}

public class ServicioFotos(IAppDbContext db, IUsuarioActual usuario, IReloj reloj, IAlmacenFotos almacen, ServicioFiscalizaciones fiscalizaciones)
{
    private static readonly string[] Tipos = ["image/jpeg", "image/png", "image/webp"];

    /// <summary>
    /// Agrega una foto. Con <paramref name="fotoId"/> (generado en la tablet) es idempotente: si ya llegó, devuelve la
    /// guardada (la tablet reintenta cuando no recibió la respuesta). Con <paramref name="sha256"/> se rechaza la foto
    /// si llegó incompleta o distinta.
    /// </summary>
    public async Task<FotoDto> AgregarAsync(Guid id, Stream contenido, string contentType, long tamano, string? descripcion, int? orden,
        CancellationToken ct, Guid? fotoId = null, string? sha256 = null)
    {
        var f = await fiscalizaciones.CargarAsync(id, ct);
        fiscalizaciones.VerificarEscritura(f);
        if (fotoId is { } previoId && await db.Fotos.AsNoTracking().FirstOrDefaultAsync(x => x.Id == previoId, ct) is { } previa)
        {
            if (previa.FiscalizacionId != id) throw new ConflictoException("Esa foto pertenece a otro registro.");
            return new FotoDto(previa.Id, previa.Orden, previa.Descripcion, previa.TamanoBytes, previa.Sha256);
        }
        if (!f.EsEditable && !usuario.EsAdministrador) throw new ConflictoException("Solo se agregan fotos a un borrador.");
        if (!Tipos.Contains(contentType)) throw new ReglaNegocioException("Formato de imagen no permitido (JPEG, PNG o WebP).");
        if (tamano > Imagenes.MaxFotoBytes) throw new ReglaNegocioException("La foto supera 8 MB.");
        f.ValidarNuevaFoto();

        using var buffer = new MemoryStream();
        await contenido.CopyToAsync(buffer, ct);
        var bytes = buffer.ToArray();
        var huella = Imagenes.Sha256(bytes);
        if (!string.IsNullOrWhiteSpace(sha256) && !string.Equals(sha256.Trim(), huella, StringComparison.OrdinalIgnoreCase))
            throw new ReglaNegocioException("La foto llegó incompleta o dañada (la huella no coincide). La tablet la reenviará.");
        var foto = new Foto
        {
            Id = fotoId ?? Guid.NewGuid(), FiscalizacionId = id, Orden = orden ?? f.Fotos.Count + 1,
            Descripcion = Texto.Limpiar(descripcion, 300), ContentType = contentType, Sha256 = huella,
            TamanoBytes = bytes.Length, TomadaEn = reloj.Ahora
        };
        buffer.Position = 0;
        foto.RutaArchivo = await almacen.GuardarAsync(id, foto.Id, buffer, ct);
        db.Fotos.Add(foto);
        await db.SaveChangesAsync(ct);
        return new FotoDto(foto.Id, foto.Orden, foto.Descripcion, foto.TamanoBytes, foto.Sha256);
    }

    public async Task<(Stream contenido, string contentType)> AbrirAsync(Guid id, Guid fotoId, CancellationToken ct)
    {
        var f = await fiscalizaciones.CargarAsync(id, ct);
        await fiscalizaciones.VerificarLecturaAsync(f, ct);
        var foto = f.Fotos.FirstOrDefault(x => x.Id == fotoId) ?? throw new NoEncontradoException("Foto no encontrada.");
        var stream = await almacen.AbrirAsync(foto.RutaArchivo, ct) ?? throw new NoEncontradoException("Archivo de foto no encontrado.");
        return (stream, foto.ContentType);
    }

    public async Task EliminarAsync(Guid id, Guid fotoId, CancellationToken ct)
    {
        var f = await fiscalizaciones.CargarAsync(id, ct);
        fiscalizaciones.VerificarEscritura(f);
        if (!f.EsEditable) throw new ConflictoException("Solo se eliminan fotos de un borrador.");
        var foto = f.Fotos.FirstOrDefault(x => x.Id == fotoId) ?? throw new NoEncontradoException("Foto no encontrada.");
        db.Fotos.Remove(foto);
        await db.SaveChangesAsync(ct);
        await almacen.EliminarAsync(foto.RutaArchivo, ct);
    }
}
