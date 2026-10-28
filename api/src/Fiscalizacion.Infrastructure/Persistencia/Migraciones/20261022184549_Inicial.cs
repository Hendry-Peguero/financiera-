using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Fiscalizacion.Infrastructure.Persistencia.Migraciones
{
    /// <inheritdoc />
    public partial class Inicial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "bit");

            migrationBuilder.EnsureSchema(
                name: "fis");

            migrationBuilder.CreateTable(
                name: "BitacoraApi",
                schema: "bit",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Momento = table.Column<DateTime>(type: "datetime2(3)", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Correo = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    Metodo = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Ruta = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: false),
                    Query = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    StatusCode = table.Column<int>(type: "int", nullable: false),
                    DuracionMs = table.Column<int>(type: "int", nullable: false),
                    Ip = table.Column<string>(type: "nvarchar(45)", maxLength: 45, nullable: true),
                    UserAgent = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: true),
                    CorrelationId = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BitacoraApi", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "BitacoraCambio",
                schema: "bit",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Momento = table.Column<DateTime>(type: "datetime2(3)", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Correo = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    Entidad = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    EntidadId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Accion = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    ValoresAnteriores = table.Column<string>(type: "nvarchar(max)", maxLength: 200, nullable: true),
                    ValoresNuevos = table.Column<string>(type: "nvarchar(max)", maxLength: 200, nullable: true),
                    CorrelationId = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BitacoraCambio", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "BitacoraUi",
                schema: "bit",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IdCliente = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Momento = table.Column<DateTime>(type: "datetime2(3)", nullable: false),
                    RecibidoEn = table.Column<DateTime>(type: "datetime2(3)", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Correo = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    SesionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Tipo = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Ruta = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: true),
                    Elemento = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Detalle = table.Column<string>(type: "nvarchar(max)", maxLength: 200, nullable: true),
                    Dispositivo = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BitacoraUi", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ControlPregunta",
                schema: "fis",
                columns: table => new
                {
                    Numero = table.Column<int>(type: "int", nullable: false),
                    Texto = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    ObservacionObligatoriaSiSi = table.Column<bool>(type: "bit", nullable: false),
                    TipoObservacion = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Activa = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ControlPregunta", x => x.Numero);
                });

            migrationBuilder.CreateTable(
                name: "Locacion",
                schema: "fis",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nombre = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Provincia = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Activa = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Locacion", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "LogTecnico",
                schema: "bit",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TimeStamp = table.Column<DateTime>(type: "datetime2(3)", nullable: false),
                    Level = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: true),
                    Message = table.Column<string>(type: "nvarchar(max)", maxLength: 200, nullable: true),
                    MessageTemplate = table.Column<string>(type: "nvarchar(max)", maxLength: 200, nullable: true),
                    Exception = table.Column<string>(type: "nvarchar(max)", maxLength: 200, nullable: true),
                    LogEvent = table.Column<string>(type: "nvarchar(max)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LogTecnico", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Plantilla",
                schema: "fis",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nombre = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Tipo = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Estado = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Plantilla", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Producto",
                schema: "fis",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nombre = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Unidad = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Producto", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Suplidor",
                schema: "fis",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nombre = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Rnc = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Activo = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Suplidor", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Usuario",
                schema: "fis",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Auth0Sub = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Correo = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    NombreCompleto = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Cargo = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Rol = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    FirmaPredeterminada = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    Activo = table.Column<bool>(type: "bit", nullable: false),
                    CreadoEn = table.Column<DateTime>(type: "datetime2(3)", nullable: false),
                    UltimoAcceso = table.Column<DateTime>(type: "datetime2(3)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Usuario", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PlantillaVersion",
                schema: "fis",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PlantillaId = table.Column<int>(type: "int", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    PdfBase = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    Publicada = table.Column<bool>(type: "bit", nullable: false),
                    PublicadaEn = table.Column<DateTime>(type: "datetime2(3)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlantillaVersion", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlantillaVersion_Plantilla_PlantillaId",
                        column: x => x.PlantillaId,
                        principalSchema: "fis",
                        principalTable: "Plantilla",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Fiscalizacion",
                schema: "fis",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Numero = table.Column<string>(type: "nvarchar(9)", maxLength: 9, nullable: false),
                    PlantillaVersionId = table.Column<int>(type: "int", nullable: false),
                    AutorId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Estado = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    VersionActual = table.Column<int>(type: "int", nullable: false),
                    EnPapelera = table.Column<bool>(type: "bit", nullable: false),
                    EliminadoEn = table.Column<DateTime>(type: "datetime2(3)", nullable: true),
                    EliminadoPorId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreadoEn = table.Column<DateTime>(type: "datetime2(3)", nullable: false),
                    ActualizadoEn = table.Column<DateTime>(type: "datetime2(3)", nullable: false),
                    FinalizadoEn = table.Column<DateTime>(type: "datetime2(3)", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    Fecha = table.Column<DateOnly>(type: "date", nullable: true),
                    HoraSalida = table.Column<TimeOnly>(type: "time(0)", nullable: true),
                    InicioProceso = table.Column<TimeOnly>(type: "time(0)", nullable: true),
                    LocacionId = table.Column<int>(type: "int", nullable: true),
                    HoraLlegada = table.Column<TimeOnly>(type: "time(0)", nullable: true),
                    FinProceso = table.Column<TimeOnly>(type: "time(0)", nullable: true),
                    FichaCamion = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    Chofer = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    Placa = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Conduce = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    SuplidorId = table.Column<int>(type: "int", nullable: true),
                    TotalEntregarGal = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    FichaCamion2 = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    Chofer2 = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    Responsable = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    TotalRecibirGal = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    ProductoId = table.Column<int>(type: "int", nullable: true),
                    GalonesProveedor = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    GalonesEgehid = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    PrecioGalon = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    VaraInicialMedida = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    VaraInicialGalones = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    VaraFinalMedida = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    VaraFinalGalones = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    ObservacionesGenerales = table.Column<string>(type: "nvarchar(max)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Fiscalizacion", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Fiscalizacion_Locacion_LocacionId",
                        column: x => x.LocacionId,
                        principalSchema: "fis",
                        principalTable: "Locacion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Fiscalizacion_PlantillaVersion_PlantillaVersionId",
                        column: x => x.PlantillaVersionId,
                        principalSchema: "fis",
                        principalTable: "PlantillaVersion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Fiscalizacion_Producto_ProductoId",
                        column: x => x.ProductoId,
                        principalSchema: "fis",
                        principalTable: "Producto",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Fiscalizacion_Suplidor_SuplidorId",
                        column: x => x.SuplidorId,
                        principalSchema: "fis",
                        principalTable: "Suplidor",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Fiscalizacion_Usuario_AutorId",
                        column: x => x.AutorId,
                        principalSchema: "fis",
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Fiscalizacion_Usuario_EliminadoPorId",
                        column: x => x.EliminadoPorId,
                        principalSchema: "fis",
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PlantillaCampo",
                schema: "fis",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PlantillaVersionId = table.Column<int>(type: "int", nullable: false),
                    Identificador = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Etiqueta = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Tipo = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Formula = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Pagina = table.Column<int>(type: "int", nullable: false),
                    X = table.Column<decimal>(type: "decimal(9,2)", precision: 9, scale: 2, nullable: false),
                    Y = table.Column<decimal>(type: "decimal(9,2)", precision: 9, scale: 2, nullable: false),
                    Ancho = table.Column<decimal>(type: "decimal(9,2)", precision: 9, scale: 2, nullable: false),
                    Alto = table.Column<decimal>(type: "decimal(9,2)", precision: 9, scale: 2, nullable: false),
                    Obligatorio = table.Column<bool>(type: "bit", nullable: false),
                    EnEstadisticas = table.Column<bool>(type: "bit", nullable: false),
                    ImprimirPdf = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlantillaCampo", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlantillaCampo_PlantillaVersion_PlantillaVersionId",
                        column: x => x.PlantillaVersionId,
                        principalSchema: "fis",
                        principalTable: "PlantillaVersion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Firma",
                schema: "fis",
                columns: table => new
                {
                    FiscalizacionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Rol = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    NombreFirmante = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Cedula = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    UsuarioId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Modo = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Imagen = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    Sha256 = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    FirmadoEn = table.Column<DateTime>(type: "datetime2(3)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Firma", x => new { x.FiscalizacionId, x.Rol });
                    table.ForeignKey(
                        name: "FK_Firma_Fiscalizacion_FiscalizacionId",
                        column: x => x.FiscalizacionId,
                        principalSchema: "fis",
                        principalTable: "Fiscalizacion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Firma_Usuario_UsuarioId",
                        column: x => x.UsuarioId,
                        principalSchema: "fis",
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FiscalizacionVersion",
                schema: "fis",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FiscalizacionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    SnapshotJson = table.Column<string>(type: "nvarchar(max)", maxLength: 200, nullable: false),
                    PdfRuta = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: true),
                    Resumen = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreadoPorId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreadoEn = table.Column<DateTime>(type: "datetime2(3)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FiscalizacionVersion", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FiscalizacionVersion_Fiscalizacion_FiscalizacionId",
                        column: x => x.FiscalizacionId,
                        principalSchema: "fis",
                        principalTable: "Fiscalizacion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_FiscalizacionVersion_Usuario_CreadoPorId",
                        column: x => x.CreadoPorId,
                        principalSchema: "fis",
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Foto",
                schema: "fis",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FiscalizacionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Orden = table.Column<int>(type: "int", nullable: false),
                    Descripcion = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    RutaArchivo = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: false),
                    ContentType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Sha256 = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    TamanoBytes = table.Column<long>(type: "bigint", nullable: false),
                    TomadaEn = table.Column<DateTime>(type: "datetime2(3)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Foto", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Foto_Fiscalizacion_FiscalizacionId",
                        column: x => x.FiscalizacionId,
                        principalSchema: "fis",
                        principalTable: "Fiscalizacion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LecturaEquipo",
                schema: "fis",
                columns: table => new
                {
                    FiscalizacionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Equipo = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Inicial = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    Final = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LecturaEquipo", x => new { x.FiscalizacionId, x.Equipo });
                    table.ForeignKey(
                        name: "FK_LecturaEquipo_Fiscalizacion_FiscalizacionId",
                        column: x => x.FiscalizacionId,
                        principalSchema: "fis",
                        principalTable: "Fiscalizacion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RespuestaControl",
                schema: "fis",
                columns: table => new
                {
                    FiscalizacionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PreguntaNumero = table.Column<int>(type: "int", nullable: false),
                    Respuesta = table.Column<bool>(type: "bit", nullable: true),
                    Observacion = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RespuestaControl", x => new { x.FiscalizacionId, x.PreguntaNumero });
                    table.ForeignKey(
                        name: "FK_RespuestaControl_ControlPregunta_PreguntaNumero",
                        column: x => x.PreguntaNumero,
                        principalSchema: "fis",
                        principalTable: "ControlPregunta",
                        principalColumn: "Numero",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RespuestaControl_Fiscalizacion_FiscalizacionId",
                        column: x => x.FiscalizacionId,
                        principalSchema: "fis",
                        principalTable: "Fiscalizacion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SolicitudFirma",
                schema: "fis",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FiscalizacionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Rol = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    UsuarioDestinoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SolicitadaPorId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Estado = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Comentario = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreadaEn = table.Column<DateTime>(type: "datetime2(3)", nullable: false),
                    ExpiraEn = table.Column<DateTime>(type: "datetime2(3)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SolicitudFirma", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SolicitudFirma_Fiscalizacion_FiscalizacionId",
                        column: x => x.FiscalizacionId,
                        principalSchema: "fis",
                        principalTable: "Fiscalizacion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SolicitudFirma_Usuario_SolicitadaPorId",
                        column: x => x.SolicitadaPorId,
                        principalSchema: "fis",
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SolicitudFirma_Usuario_UsuarioDestinoId",
                        column: x => x.UsuarioDestinoId,
                        principalSchema: "fis",
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CambioCampo",
                schema: "fis",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    VersionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Campo = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    ValorAnterior = table.Column<string>(type: "nvarchar(max)", maxLength: 200, nullable: true),
                    ValorNuevo = table.Column<string>(type: "nvarchar(max)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CambioCampo", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CambioCampo_FiscalizacionVersion_VersionId",
                        column: x => x.VersionId,
                        principalSchema: "fis",
                        principalTable: "FiscalizacionVersion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                schema: "fis",
                table: "ControlPregunta",
                columns: new[] { "Numero", "Activa", "ObservacionObligatoriaSiSi", "Texto", "TipoObservacion" },
                values: new object[,]
                {
                    { 1, true, false, "¿La solicitud se realizó con margen disponible mínimo del 50 %?", "Texto" },
                    { 2, true, false, "¿El proveedor llegó a la hora acordada?", "Texto" },
                    { 3, true, false, "¿Se implementaron las medidas de seguridad establecidas?", "Texto" },
                    { 4, true, false, "¿Se realizó la prueba de calidad antes de la descarga?", "Texto" },
                    { 5, true, false, "¿Se efectuaron mediciones antes y después del proceso?", "Texto" },
                    { 6, true, true, "¿Se evidenció presencia de agua en los tanques?", "Texto" },
                    { 7, true, false, "¿Válvulas y bocas con presillas de seguridad?", "Texto" },
                    { 8, true, false, "¿Compartimientos al nivel adecuado de chapas?", "Texto" },
                    { 9, true, false, "¿Tanque y dispensador en condiciones operativas?", "Texto" },
                    { 10, true, false, "¿El dispensador ha sido calibrado?", "Fecha" },
                    { 11, true, true, "¿Se produjo algún derrame durante el proceso?", "Texto" },
                    { 12, true, true, "¿Hubo diferencias en la entrega recibida?", "Texto" }
                });

            migrationBuilder.InsertData(
                schema: "fis",
                table: "Locacion",
                columns: new[] { "Id", "Activa", "Nombre", "Provincia" },
                values: new object[,]
                {
                    { 1, true, "C.H. Jigüey", "Ocoa" },
                    { 2, true, "C.H. Aguacate", null },
                    { 3, true, "C.H. Valdesia", null },
                    { 4, true, "C.H. Tavera", null },
                    { 5, true, "C.H. Monción", null },
                    { 6, true, "C.H. Jimenoa", null },
                    { 7, true, "C.H. Rincón", null },
                    { 8, true, "C.H. Hatillo", null },
                    { 9, true, "C.H. Pinalito", null },
                    { 10, true, "C.H. Palomino", null },
                    { 11, true, "C.H. Sabaneta", null },
                    { 12, true, "C.H. Las Barías", null }
                });

            migrationBuilder.InsertData(
                schema: "fis",
                table: "Plantilla",
                columns: new[] { "Id", "Estado", "Nombre", "Tipo" },
                values: new object[] { 1, "Activa", "Combustible y aceites", "Oficial" });

            migrationBuilder.InsertData(
                schema: "fis",
                table: "Producto",
                columns: new[] { "Id", "Nombre", "Unidad" },
                values: new object[] { 1, "Gasoil óptimo", "gal" });

            migrationBuilder.InsertData(
                schema: "fis",
                table: "Suplidor",
                columns: new[] { "Id", "Activo", "Nombre", "Rnc" },
                values: new object[,]
                {
                    { 1, true, "Sunix Petroleum, S.R.L.", null },
                    { 2, true, "Isla Dominicana S.R.L.", null },
                    { 3, true, "Texaco Caribbean", null },
                    { 4, true, "Gulf Dominicana", null }
                });

            migrationBuilder.InsertData(
                schema: "fis",
                table: "PlantillaVersion",
                columns: new[] { "Id", "PdfBase", "PlantillaId", "Publicada", "PublicadaEn", "Version" },
                values: new object[] { 1, null, 1, true, new DateTime(2026, 10, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), 2 });

            migrationBuilder.CreateIndex(
                name: "IX_BitacoraApi_Momento",
                schema: "bit",
                table: "BitacoraApi",
                column: "Momento");

            migrationBuilder.CreateIndex(
                name: "IX_BitacoraApi_UsuarioId",
                schema: "bit",
                table: "BitacoraApi",
                column: "UsuarioId");

            migrationBuilder.CreateIndex(
                name: "IX_BitacoraCambio_Entidad_EntidadId",
                schema: "bit",
                table: "BitacoraCambio",
                columns: new[] { "Entidad", "EntidadId" });

            migrationBuilder.CreateIndex(
                name: "IX_BitacoraCambio_Momento",
                schema: "bit",
                table: "BitacoraCambio",
                column: "Momento");

            migrationBuilder.CreateIndex(
                name: "IX_BitacoraUi_IdCliente",
                schema: "bit",
                table: "BitacoraUi",
                column: "IdCliente",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BitacoraUi_Momento",
                schema: "bit",
                table: "BitacoraUi",
                column: "Momento");

            migrationBuilder.CreateIndex(
                name: "IX_BitacoraUi_UsuarioId_Momento",
                schema: "bit",
                table: "BitacoraUi",
                columns: new[] { "UsuarioId", "Momento" });

            migrationBuilder.CreateIndex(
                name: "IX_CambioCampo_VersionId",
                schema: "fis",
                table: "CambioCampo",
                column: "VersionId");

            migrationBuilder.CreateIndex(
                name: "IX_Firma_UsuarioId",
                schema: "fis",
                table: "Firma",
                column: "UsuarioId");

            migrationBuilder.CreateIndex(
                name: "IX_Fiscalizacion_AutorId",
                schema: "fis",
                table: "Fiscalizacion",
                column: "AutorId");

            migrationBuilder.CreateIndex(
                name: "IX_Fiscalizacion_EliminadoPorId",
                schema: "fis",
                table: "Fiscalizacion",
                column: "EliminadoPorId");

            migrationBuilder.CreateIndex(
                name: "IX_Fiscalizacion_EnPapelera",
                schema: "fis",
                table: "Fiscalizacion",
                column: "EnPapelera");

            migrationBuilder.CreateIndex(
                name: "IX_Fiscalizacion_Estado",
                schema: "fis",
                table: "Fiscalizacion",
                column: "Estado");

            migrationBuilder.CreateIndex(
                name: "IX_Fiscalizacion_Fecha",
                schema: "fis",
                table: "Fiscalizacion",
                column: "Fecha");

            migrationBuilder.CreateIndex(
                name: "IX_Fiscalizacion_LocacionId",
                schema: "fis",
                table: "Fiscalizacion",
                column: "LocacionId");

            migrationBuilder.CreateIndex(
                name: "IX_Fiscalizacion_Numero",
                schema: "fis",
                table: "Fiscalizacion",
                column: "Numero",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Fiscalizacion_PlantillaVersionId",
                schema: "fis",
                table: "Fiscalizacion",
                column: "PlantillaVersionId");

            migrationBuilder.CreateIndex(
                name: "IX_Fiscalizacion_ProductoId",
                schema: "fis",
                table: "Fiscalizacion",
                column: "ProductoId");

            migrationBuilder.CreateIndex(
                name: "IX_Fiscalizacion_SuplidorId",
                schema: "fis",
                table: "Fiscalizacion",
                column: "SuplidorId");

            migrationBuilder.CreateIndex(
                name: "IX_FiscalizacionVersion_CreadoPorId",
                schema: "fis",
                table: "FiscalizacionVersion",
                column: "CreadoPorId");

            migrationBuilder.CreateIndex(
                name: "IX_FiscalizacionVersion_FiscalizacionId_Version",
                schema: "fis",
                table: "FiscalizacionVersion",
                columns: new[] { "FiscalizacionId", "Version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Foto_FiscalizacionId_Orden",
                schema: "fis",
                table: "Foto",
                columns: new[] { "FiscalizacionId", "Orden" });

            migrationBuilder.CreateIndex(
                name: "IX_Locacion_Nombre",
                schema: "fis",
                table: "Locacion",
                column: "Nombre",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LogTecnico_TimeStamp",
                schema: "bit",
                table: "LogTecnico",
                column: "TimeStamp");

            migrationBuilder.CreateIndex(
                name: "IX_PlantillaCampo_PlantillaVersionId_Identificador",
                schema: "fis",
                table: "PlantillaCampo",
                columns: new[] { "PlantillaVersionId", "Identificador" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PlantillaVersion_PlantillaId_Version",
                schema: "fis",
                table: "PlantillaVersion",
                columns: new[] { "PlantillaId", "Version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RespuestaControl_PreguntaNumero",
                schema: "fis",
                table: "RespuestaControl",
                column: "PreguntaNumero");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitudFirma_FiscalizacionId",
                schema: "fis",
                table: "SolicitudFirma",
                column: "FiscalizacionId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitudFirma_SolicitadaPorId",
                schema: "fis",
                table: "SolicitudFirma",
                column: "SolicitadaPorId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitudFirma_UsuarioDestinoId_Estado",
                schema: "fis",
                table: "SolicitudFirma",
                columns: new[] { "UsuarioDestinoId", "Estado" });

            migrationBuilder.CreateIndex(
                name: "IX_Suplidor_Nombre",
                schema: "fis",
                table: "Suplidor",
                column: "Nombre",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Usuario_Auth0Sub",
                schema: "fis",
                table: "Usuario",
                column: "Auth0Sub",
                unique: true,
                filter: "[Auth0Sub] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Usuario_Correo",
                schema: "fis",
                table: "Usuario",
                column: "Correo",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BitacoraApi",
                schema: "bit");

            migrationBuilder.DropTable(
                name: "BitacoraCambio",
                schema: "bit");

            migrationBuilder.DropTable(
                name: "BitacoraUi",
                schema: "bit");

            migrationBuilder.DropTable(
                name: "CambioCampo",
                schema: "fis");

            migrationBuilder.DropTable(
                name: "Firma",
                schema: "fis");

            migrationBuilder.DropTable(
                name: "Foto",
                schema: "fis");

            migrationBuilder.DropTable(
                name: "LecturaEquipo",
                schema: "fis");

            migrationBuilder.DropTable(
                name: "LogTecnico",
                schema: "bit");

            migrationBuilder.DropTable(
                name: "PlantillaCampo",
                schema: "fis");

            migrationBuilder.DropTable(
                name: "RespuestaControl",
                schema: "fis");

            migrationBuilder.DropTable(
                name: "SolicitudFirma",
                schema: "fis");

            migrationBuilder.DropTable(
                name: "FiscalizacionVersion",
                schema: "fis");

            migrationBuilder.DropTable(
                name: "ControlPregunta",
                schema: "fis");

            migrationBuilder.DropTable(
                name: "Fiscalizacion",
                schema: "fis");

            migrationBuilder.DropTable(
                name: "Locacion",
                schema: "fis");

            migrationBuilder.DropTable(
                name: "PlantillaVersion",
                schema: "fis");

            migrationBuilder.DropTable(
                name: "Producto",
                schema: "fis");

            migrationBuilder.DropTable(
                name: "Suplidor",
                schema: "fis");

            migrationBuilder.DropTable(
                name: "Usuario",
                schema: "fis");

            migrationBuilder.DropTable(
                name: "Plantilla",
                schema: "fis");
        }
    }
}
