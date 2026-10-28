using System.IO.Compression;

namespace Fiscalizacion.Application.Tests;

/// <summary>PNG generados en memoria para las pruebas del PDF: firmas (trazo azul sobre transparente) y «fotos» (degradado).</summary>
internal static class ImagenesPrueba
{
    /// <summary>Trazo tipo firma manuscrita de 360 × 120.</summary>
    public static byte[] Firma(int semilla)
    {
        const int w = 360, h = 120;
        var px = new byte[w * h * 4];
        var r = new Random(semilla);
        double fase = r.NextDouble() * 6, amp = 22 + r.Next(14), frec = 0.035 + r.NextDouble() * 0.03;
        for (var x = 20; x < w - 20; x++)
        {
            var y = h / 2 + amp * Math.Sin(x * frec + fase) * Math.Cos(x * frec * 0.37) + 10 * Math.Sin(x * 0.21 + fase);
            Punto(px, w, h, x, (int)y, 2.2, 0x1e, 0x3a, 0x8a);
        }
        for (var x = 40; x < w - 60; x++) Punto(px, w, h, x, h - 24 + (int)(4 * Math.Sin(x * 0.05)), 1.2, 0x1e, 0x3a, 0x8a);
        return Png(w, h, px);
    }

    /// <summary>«Foto» de 640 × 480 (o el tamaño dado) con degradado y bandas; distinta según la semilla.</summary>
    public static byte[] Foto(int semilla, int w = 640, int h = 480)
    {
        var px = new byte[w * h * 4];
        var r = new Random(semilla);
        int r0 = r.Next(40, 120), g0 = r.Next(60, 140), b0 = r.Next(80, 180);
        for (var y = 0; y < h; y++)
        for (var x = 0; x < w; x++)
        {
            var i = (y * w + x) * 4;
            var cielo = y < h * 0.45;
            var t = (double)y / h;
            px[i] = (byte)(cielo ? 150 + 80 * t : r0 + 60 * Math.Sin(x * 0.02));
            px[i + 1] = (byte)(cielo ? 190 + 40 * t : g0 + 30 * Math.Cos(y * 0.03));
            px[i + 2] = (byte)(cielo ? 235 : b0 * (1 - t / 2));
            px[i + 3] = 255;
            // un "tanque": rectángulo gris al centro
            if (x > w * 0.3 && x < w * 0.7 && y > h * 0.35 && y < h * 0.8)
            {
                var gris = (byte)(170 + 40 * Math.Sin(x * 0.05));
                px[i] = px[i + 1] = px[i + 2] = gris;
            }
        }
        return Png(w, h, px);
    }

    private static void Punto(byte[] px, int w, int h, int cx, int cy, double radio, byte r, byte g, byte b)
    {
        var rr = (int)Math.Ceiling(radio);
        for (var y = cy - rr; y <= cy + rr; y++)
        for (var x = cx - rr; x <= cx + rr; x++)
        {
            if (x < 0 || y < 0 || x >= w || y >= h || (x - cx) * (x - cx) + (y - cy) * (y - cy) > radio * radio) continue;
            var i = (y * w + x) * 4;
            px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
        }
    }

    private static byte[] Png(int w, int h, byte[] rgba)
    {
        using var salida = new MemoryStream();
        salida.Write([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        var ihdr = new byte[13];
        Escribir(ihdr, 0, (uint)w);
        Escribir(ihdr, 4, (uint)h);
        ihdr[8] = 8; ihdr[9] = 6; // 8 bits, RGBA
        Bloque(salida, "IHDR", ihdr);
        using var datos = new MemoryStream();
        using (var z = new ZLibStream(datos, CompressionLevel.Fastest, leaveOpen: true))
        {
            for (var y = 0; y < h; y++)
            {
                z.WriteByte(0);
                z.Write(rgba, y * w * 4, w * 4);
            }
        }
        Bloque(salida, "IDAT", datos.ToArray());
        Bloque(salida, "IEND", []);
        return salida.ToArray();
    }

    private static void Bloque(Stream s, string tipo, byte[] datos)
    {
        var largo = new byte[4];
        Escribir(largo, 0, (uint)datos.Length);
        s.Write(largo);
        var cuerpo = System.Text.Encoding.ASCII.GetBytes(tipo).Concat(datos).ToArray();
        s.Write(cuerpo);
        var crc = new byte[4];
        Escribir(crc, 0, Crc32(cuerpo));
        s.Write(crc);
    }

    private static void Escribir(byte[] b, int i, uint v)
    {
        b[i] = (byte)(v >> 24); b[i + 1] = (byte)(v >> 16); b[i + 2] = (byte)(v >> 8); b[i + 3] = (byte)v;
    }

    private static uint Crc32(byte[] datos)
    {
        var crc = 0xFFFFFFFFu;
        foreach (var b in datos)
        {
            crc ^= b;
            for (var k = 0; k < 8; k++) crc = (crc & 1) != 0 ? 0xEDB88320u ^ (crc >> 1) : crc >> 1;
        }
        return ~crc;
    }
}
