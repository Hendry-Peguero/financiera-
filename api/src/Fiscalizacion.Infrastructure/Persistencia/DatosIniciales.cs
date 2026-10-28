using Fiscalizacion.Domain.Entidades;
using Fiscalizacion.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Fiscalizacion.Infrastructure.Persistencia;

internal static class DatosIniciales
{
    public static void Aplicar(ModelBuilder mb)
    {
        string[] locaciones =
        [
            "C.H. Jigüey", "C.H. Aguacate", "C.H. Valdesia", "C.H. Tavera", "C.H. Monción", "C.H. Jimenoa",
            "C.H. Rincón", "C.H. Hatillo", "C.H. Pinalito", "C.H. Palomino", "C.H. Sabaneta", "C.H. Las Barías"
        ];
        mb.Entity<Locacion>().HasData(locaciones.Select((n, i) => new Locacion
        {
            Id = i + 1, Nombre = n, Provincia = n == "C.H. Jigüey" ? "Ocoa" : null
        }));

        string[] suplidores = ["Sunix Petroleum, S.R.L.", "Isla Dominicana S.R.L.", "Texaco Caribbean", "Gulf Dominicana"];
        mb.Entity<Suplidor>().HasData(suplidores.Select((n, i) => new Suplidor { Id = i + 1, Nombre = n }));

        mb.Entity<Producto>().HasData(new Producto { Id = 1, Nombre = "Gasoil óptimo", Unidad = "gal" });

        (string texto, bool obligatoriaSiSi, TipoObservacion tipo)[] preguntas =
        [
            ("¿La solicitud se realizó con margen disponible mínimo del 50 %?", false, TipoObservacion.Texto),
            ("¿El proveedor llegó a la hora acordada?", false, TipoObservacion.Texto),
            ("¿Se implementaron las medidas de seguridad establecidas?", false, TipoObservacion.Texto),
            ("¿Se realizó la prueba de calidad antes de la descarga?", false, TipoObservacion.Texto),
            ("¿Se efectuaron mediciones antes y después del proceso?", false, TipoObservacion.Texto),
            ("¿Se evidenció presencia de agua en los tanques?", true, TipoObservacion.Texto),
            ("¿Válvulas y bocas con presillas de seguridad?", false, TipoObservacion.Texto),
            ("¿Compartimientos al nivel adecuado de chapas?", false, TipoObservacion.Texto),
            ("¿Tanque y dispensador en condiciones operativas?", false, TipoObservacion.Texto),
            ("¿El dispensador ha sido calibrado?", false, TipoObservacion.Fecha),
            ("¿Se produjo algún derrame durante el proceso?", true, TipoObservacion.Texto),
            ("¿Hubo diferencias en la entrega recibida?", true, TipoObservacion.Texto)
        ];
        mb.Entity<ControlPregunta>().HasData(preguntas.Select((p, i) => new ControlPregunta
        {
            Numero = i + 1, Texto = p.texto, ObservacionObligatoriaSiSi = p.obligatoriaSiSi, TipoObservacion = p.tipo
        }));

        mb.Entity<Plantilla>().HasData(new Plantilla
        {
            Id = 1, Nombre = "Combustible y aceites", Tipo = TipoPlantilla.Oficial, Estado = EstadoPlantilla.Activa
        });
        mb.Entity<PlantillaVersion>().HasData(new PlantillaVersion
        {
            Id = 1, PlantillaId = 1, Version = 2, Publicada = true, PublicadaEn = new DateTime(2026, 10, 1)
        });
    }
}
