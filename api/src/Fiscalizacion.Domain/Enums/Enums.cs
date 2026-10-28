namespace Fiscalizacion.Domain.Enums;

public enum Rol { Administrador, Auditor, Firmante }

public enum EstadoFiscalizacion { Borrador, Finalizado, Modificado, EdicionPendiente }

public enum Equipo { MedidorDigital, Dispensador, Electrobomba }

public enum RolFirma
{
    AuditorActuante1,
    AuditorActuante2,
    EncargadoRecibir,
    SupervisorCombustibles,
    RepresentanteProveedor,
    AuditorCierre1,
    AuditorCierre2,
    AuditorUai
}

public enum ModoFirma { Predeterminada, EnSuEquipo, EnEstaTablet }

public enum EstadoSolicitud { Pendiente, Firmada, Rechazada, Expirada }

public enum TipoObservacion { Texto, Fecha }

public enum TipoPlantilla { Oficial, Personalizada }

public enum EstadoPlantilla { Activa, Borrador, Desactivada }

public enum TipoCampo { Texto, Numero, Fecha, Casilla, Firma, Formula }

public enum AccionCambio { Crear, Modificar, Eliminar }

public enum TipoAviso { DiferenciaMayor1Pct, ProveedorCero, SobreMediana }
