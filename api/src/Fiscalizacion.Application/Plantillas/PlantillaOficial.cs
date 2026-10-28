using Fiscalizacion.Domain.Entidades;
using Fiscalizacion.Domain.Enums;
using Fiscalizacion.Domain.Reglas;

namespace Fiscalizacion.Application.Plantillas;

/// <summary>
/// Plantilla oficial «Combustible y aceites»: el formulario en papel de EGEHID (Recursos/FormularioOficial.pdf, una
/// página A4, copia de diseno/«Modelo - Formulario Fiscalización Combustible y Aceites» sin los valores de ejemplo
/// del encabezado). Sus campos no se guardan en la base: se describen aquí con la posición exacta de cada celda
/// (puntos PDF, origen arriba a la izquierda). El PDF oficial de cada fiscalización se imprime sobre esta plantilla.
/// </summary>
public static class PlantillaOficial
{
    public const int Id = 1;

    /// <summary>Página A4 del formulario.</summary>
    public const decimal AnchoPagina = 595.56m, AltoPagina = 842.04m;

    // líneas verticales de las tablas del formulario
    private const decimal C0 = 24.0m, C1 = 118.3m, C2 = 199.9m, C3 = 292.5m, C4 = 382.3m, C5 = 460.8m, C6 = 573.7m;
    private const decimal Si = 333.5m, VaraMedio = 478.0m;

    /// <summary>Bordes superior/inferior de las 12 filas de control interno.</summary>
    private static readonly decimal[] FilasControl =
        [327.3m, 349.4m, 371.3m, 393.3m, 415.4m, 437.3m, 459.3m, 484.3m, 506.2m, 528.2m, 550.3m, 572.2m, 594.2m];

    /// <summary>Filas de «Personal participante», en el orden del formulario.</summary>
    public static readonly (RolFirma rol, string id)[] Participantes =
    [
        (RolFirma.AuditorActuante1, "auditor_actuante_1"), (RolFirma.AuditorActuante2, "auditor_actuante_2"),
        (RolFirma.EncargadoRecibir, "encargado_recibir"), (RolFirma.SupervisorCombustibles, "supervisor_combustibles"),
        (RolFirma.RepresentanteProveedor, "representante_proveedor"),
    ];

    private static readonly decimal[] FilasParticipantes = [620.5m, 636.3m, 652.3m, 668.3m, 684.2m, 700.2m];

    /// <summary>Líneas de firma al pie («Auditor actuante», «Auditor actuante», «Auditor UAI»).</summary>
    public static readonly (RolFirma rol, string id, decimal x0, decimal x1)[] FirmasCierre =
    [
        (RolFirma.AuditorCierre1, "auditor_cierre_1", 100.2m, 215.5m),
        (RolFirma.AuditorCierre2, "auditor_cierre_2", 238.6m, 348.5m),
        (RolFirma.AuditorUai, "auditor_uai", 383.0m, 497.5m),
    ];

    private static readonly Lazy<byte[]> Pdf = new(LeerPdf);

    /// <summary>PDF base del formulario (A4, una página).</summary>
    public static byte[] PdfBase => Pdf.Value;

    public static IReadOnlyList<PaginaDto> Paginas => [new PaginaDto(AnchoPagina, AltoPagina)];

    public static List<PlantillaCampo> Campos()
    {
        var c = new List<PlantillaCampo>();
        void Campo(string id, string etiqueta, TipoCampo tipo, decimal x0, decimal y0, decimal x1, decimal y1,
            bool obligatorio = false, bool estadistica = false, string? formula = null) =>
            c.Add(new PlantillaCampo
            {
                Identificador = id, Etiqueta = etiqueta, Tipo = tipo, Formula = formula, Pagina = 1,
                X = x0, Y = y0, Ancho = x1 - x0, Alto = y1 - y0,
                Obligatorio = obligatorio, EnEstadisticas = estadistica, ImprimirPdf = true
            });

        // encabezado del documento (lo llena el Administrador en la plantilla)
        Campo("doc_codigo", "Código del documento", TipoCampo.Texto, 102.9m, 17.5m, 185.0m, 29.5m);
        Campo("doc_version", "Versión del documento", TipoCampo.Texto, 102.9m, 44.0m, 185.0m, 56.0m);
        Campo("doc_fecha_elaboracion", "Fecha de elaboración", TipoCampo.Fecha, C5, 17.5m, C6, 29.5m);
        Campo("doc_fecha_aprobacion", "Fecha de aprobación", TipoCampo.Fecha, C5, 44.0m, C6, 56.0m);

        // visita
        Campo("fecha", "Fecha", TipoCampo.Fecha, 64.0m, 68.0m, 190.0m, 82.0m, true, true);
        Campo("hora_salida", "Hora de salida", TipoCampo.Texto, 256.0m, 68.0m, 372.0m, 82.0m, true);
        Campo("inicio_proceso", "Hora inicio de proceso", TipoCampo.Texto, 467.0m, 68.0m, 572.0m, 82.0m, true);
        Campo("locacion", "Destino (locación)", TipoCampo.Texto, 68.0m, 86.0m, 190.0m, 100.0m, true, true);
        Campo("hora_llegada", "Hora de llegada", TipoCampo.Texto, 260.0m, 86.0m, 372.0m, 100.0m, true);
        Campo("fin_proceso", "Hora finalización de proceso", TipoCampo.Texto, 489.0m, 86.0m, 572.0m, 100.0m, true);

        // datos del suplidor
        Campo("ficha_camion", "Ficha", TipoCampo.Texto, C0, 138.7m, C1, 153.4m);
        Campo("chofer", "Chofer", TipoCampo.Texto, C1, 138.7m, C2, 153.4m);
        Campo("placa", "Placa", TipoCampo.Texto, C2, 138.7m, C3, 153.4m);
        Campo("conduce", "Conduce", TipoCampo.Texto, C3, 138.7m, C4, 153.4m);
        Campo("suplidor", "Empresa", TipoCampo.Texto, C4, 138.7m, C5, 153.4m, true, true);
        Campo("total_entregar_gal", "Total entregar (gal)", TipoCampo.Numero, C5, 138.7m, C6, 153.4m, estadistica: true);

        // datos de la empresa: dos pares propios de EGEHID
        Campo("empresa_ficha_camion", "Ficha camión (empresa)", TipoCampo.Texto, C0, 187.7m, C1, 202.3m);
        Campo("empresa_chofer", "Chofer (empresa)", TipoCampo.Texto, C1, 187.7m, C2, 202.3m);
        Campo("ficha_camion_2", "Ficha camión 2 (empresa)", TipoCampo.Texto, C2, 187.7m, C3, 202.3m);
        Campo("chofer_2", "Chofer 2 (empresa)", TipoCampo.Texto, C3, 187.7m, C4, 202.3m);
        Campo("responsable", "Responsable", TipoCampo.Texto, C4, 187.7m, C5, 202.3m);
        Campo("total_recibir_gal", "Total recibir (gal)", TipoCampo.Numero, C5, 187.7m, C6, 202.3m, estadistica: true);

        // mediciones de equipos: inicial, final y diferencia
        (string id, string etiqueta, decimal y0, decimal y1)[] filas =
            [("inicial", "inicial", 233.8m, 249.0m), ("final", "final", 249.0m, 264.2m), ("diferencia", "diferencia", 264.2m, 279.4m)];
        foreach (var (f, et, y0, y1) in filas)
        {
            var dif = f == "diferencia";
            Campo($"medidor_digital_{f}", $"Medidor digital · {et}", dif ? TipoCampo.Formula : TipoCampo.Numero, C1, y0, C2, y1,
                formula: dif ? "medidor_digital_final - medidor_digital_inicial" : null);
            Campo($"dispensador_{f}", $"Dispensador · {et}", dif ? TipoCampo.Formula : TipoCampo.Numero, C2, y0, C3, y1,
                formula: dif ? "dispensador_final - dispensador_inicial" : null);
            Campo($"electrobomba_{f}", $"Electrobomba · {et}", dif ? TipoCampo.Formula : TipoCampo.Numero, C3, y0, C4, y1,
                formula: dif ? "electrobomba_final - electrobomba_inicial" : null);
            if (!dif) Campo($"vara_{f}_medida", $"Vara {et} · medida", TipoCampo.Texto, C4, y0, VaraMedio, y1);
            Campo($"vara_{f}_galones", $"Vara {et} · galones", dif ? TipoCampo.Formula : TipoCampo.Numero, dif ? C4 : VaraMedio, y0, C6, y1,
                formula: dif ? "vara_final_galones - vara_inicial_galones" : null);
        }

        // totales en galones
        Campo("galones_egehid", "Total S/EGEHID (gal)", TipoCampo.Numero, C1, 279.4m, C2, 298.1m, true, true);
        Campo("galones_proveedor", "Total S/Proveedor (gal)", TipoCampo.Numero, C3, 279.4m, C4, 298.1m, true, true);
        Campo("diferencia_gal", "Diferencias (gal)", TipoCampo.Formula, C5, 279.4m, C6, 298.1m, estadistica: true,
            formula: "galones_egehid - galones_proveedor");

        // control interno: Sí, No y observación
        for (var n = 1; n <= 12; n++)
        {
            var (y0, y1) = (FilasControl[n - 1], FilasControl[n]);
            Campo($"control_{n}", $"Control {n} · Sí", TipoCampo.Casilla, C3, y0, Si, y1, true);
            Campo($"control_{n}_no", $"Control {n} · No", TipoCampo.Casilla, Si, y0, C4, y1);
            Campo($"control_{n}_obs", $"Control {n} · observación", n == 10 ? TipoCampo.Fecha : TipoCampo.Texto, C4, y0, C6, y1,
                n is 6 or 11 or 12);
        }

        // personal participante
        for (var i = 0; i < Participantes.Length; i++)
        {
            var (rol, id) = Participantes[i];
            var (y0, y1) = (FilasParticipantes[i], FilasParticipantes[i + 1]);
            var nombre = ValidadorFiscalizacion.NombreRol(rol);
            Campo($"{id}_nombre", $"{nombre} · nombre", TipoCampo.Texto, C1, y0, C2, y1);
            Campo($"{id}_apellido", $"{nombre} · apellido", TipoCampo.Texto, C2, y0, C3, y1);
            Campo($"{id}_cedula", $"{nombre} · carnet y/o cédula", TipoCampo.Texto, C3, y0, C4, y1);
            Campo($"firma_{id}", $"Firma · {nombre}", TipoCampo.Firma, C4, y0, C6, y1,
                ValidadorFiscalizacion.FirmasRequeridas.Contains(rol));
        }

        // parámetros de facturación y observaciones generales
        Campo("precio_galon", "Precio RD$ S/MICM", TipoCampo.Numero, C1, 720.1m, C2, 736.1m);
        Campo("importe_egehid", "Total RD$ S/EGEHID", TipoCampo.Formula, C1, 736.1m, C2, 752.0m, formula: "galones_egehid * precio_galon");
        Campo("importe_proveedor", "Total RD$ S/Suplidor", TipoCampo.Formula, C1, 752.0m, C2, 768.0m, formula: "galones_proveedor * precio_galon");
        Campo("diferencia_importe", "Diferencia RD$ (+/−)", TipoCampo.Formula, C1, 768.0m, C2, 784.0m, estadistica: true,
            formula: "importe_egehid - importe_proveedor");
        Campo("observaciones_generales", "Observaciones generales", TipoCampo.Texto, C2, 720.1m, C6, 784.0m);

        // firmas al pie
        foreach (var (rol, id, x0, x1) in FirmasCierre)
            Campo($"firma_{id}", $"Firma · {ValidadorFiscalizacion.NombreRol(rol)}", TipoCampo.Firma, x0, 784.6m, x1, 804.6m);

        return c;
    }

    public static IReadOnlyList<PaginaDto> PaginasCarta(int n) =>
        Enumerable.Range(0, Math.Max(1, n)).Select(_ => new PaginaDto(ReglasPlantillas.AnchoCarta, ReglasPlantillas.AltoCarta)).ToList();

    private static byte[] LeerPdf()
    {
        var recurso = $"{typeof(PlantillaOficial).Namespace}.Recursos.FormularioOficial.pdf";
        using var stream = typeof(PlantillaOficial).Assembly.GetManifestResourceStream(recurso)
                           ?? throw new InvalidOperationException($"Falta el recurso {recurso}.");
        using var buffer = new MemoryStream();
        stream.CopyTo(buffer);
        return buffer.ToArray();
    }
}
