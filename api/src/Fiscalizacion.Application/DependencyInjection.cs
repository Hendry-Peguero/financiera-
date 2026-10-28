using Fiscalizacion.Application.Bitacora;
using Fiscalizacion.Application.Estadisticas;
using Fiscalizacion.Application.Fiscalizaciones;
using Fiscalizacion.Application.Pdf;
using Fiscalizacion.Application.Plantillas;
using Fiscalizacion.Application.Usuarios;
using Microsoft.Extensions.DependencyInjection;

namespace Fiscalizacion.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddAplicacion(this IServiceCollection s) => s
        .AddScoped<ServicioUsuarios>()
        .AddScoped<ServicioAdminUsuarios>()
        .AddScoped<ServicioCatalogos>()
        .AddScoped<ServicioFiscalizaciones>()
        .AddScoped<ServicioFirmas>()
        .AddScoped<ServicioSolicitudesFiscalizacion>()
        .AddScoped<ServicioFotos>()
        .AddScoped<ServicioEstadisticas>()
        .AddScoped<ServicioBitacora>()
        .AddScoped<ServicioPlantillas>()
        .AddScoped<Actualizaciones.ServicioActualizaciones>()
        .AddScoped<ComponedorPdf>()
        .AddScoped<ServicioPdf>();
}
