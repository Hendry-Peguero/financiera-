IF OBJECT_ID(N'[fis].[__EFMigrationsHistory]') IS NULL
BEGIN
    IF SCHEMA_ID(N'fis') IS NULL EXEC(N'CREATE SCHEMA [fis];');
    CREATE TABLE [fis].[__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    IF SCHEMA_ID(N'bit') IS NULL EXEC(N'CREATE SCHEMA [bit];');
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    IF SCHEMA_ID(N'fis') IS NULL EXEC(N'CREATE SCHEMA [fis];');
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE TABLE [bit].[BitacoraApi] (
        [Id] bigint NOT NULL IDENTITY,
        [Momento] datetime2(3) NOT NULL,
        [UsuarioId] uniqueidentifier NULL,
        [Correo] nvarchar(256) NULL,
        [Metodo] nvarchar(10) NOT NULL,
        [Ruta] nvarchar(400) NOT NULL,
        [Query] nvarchar(1000) NULL,
        [StatusCode] int NOT NULL,
        [DuracionMs] int NOT NULL,
        [Ip] nvarchar(45) NULL,
        [UserAgent] nvarchar(400) NULL,
        [CorrelationId] nvarchar(64) NULL,
        CONSTRAINT [PK_BitacoraApi] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE TABLE [bit].[BitacoraCambio] (
        [Id] bigint NOT NULL IDENTITY,
        [Momento] datetime2(3) NOT NULL,
        [UsuarioId] uniqueidentifier NULL,
        [Correo] nvarchar(256) NULL,
        [Entidad] nvarchar(100) NOT NULL,
        [EntidadId] nvarchar(100) NOT NULL,
        [Accion] nvarchar(30) NOT NULL,
        [ValoresAnteriores] nvarchar(max) NULL,
        [ValoresNuevos] nvarchar(max) NULL,
        [CorrelationId] nvarchar(64) NULL,
        CONSTRAINT [PK_BitacoraCambio] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE TABLE [bit].[BitacoraUi] (
        [Id] bigint NOT NULL IDENTITY,
        [IdCliente] uniqueidentifier NOT NULL,
        [Momento] datetime2(3) NOT NULL,
        [RecibidoEn] datetime2(3) NOT NULL,
        [UsuarioId] uniqueidentifier NULL,
        [Correo] nvarchar(256) NULL,
        [SesionId] uniqueidentifier NOT NULL,
        [Tipo] nvarchar(20) NOT NULL,
        [Ruta] nvarchar(400) NULL,
        [Elemento] nvarchar(300) NULL,
        [Detalle] nvarchar(max) NULL,
        [Dispositivo] nvarchar(200) NULL,
        CONSTRAINT [PK_BitacoraUi] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE TABLE [fis].[ControlPregunta] (
        [Numero] int NOT NULL,
        [Texto] nvarchar(300) NOT NULL,
        [ObservacionObligatoriaSiSi] bit NOT NULL,
        [TipoObservacion] nvarchar(30) NOT NULL,
        [Activa] bit NOT NULL,
        CONSTRAINT [PK_ControlPregunta] PRIMARY KEY ([Numero])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE TABLE [fis].[Locacion] (
        [Id] int NOT NULL IDENTITY,
        [Nombre] nvarchar(120) NOT NULL,
        [Provincia] nvarchar(200) NULL,
        [Activa] bit NOT NULL,
        CONSTRAINT [PK_Locacion] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE TABLE [bit].[LogTecnico] (
        [Id] bigint NOT NULL IDENTITY,
        [TimeStamp] datetime2(3) NOT NULL,
        [Level] nvarchar(16) NULL,
        [Message] nvarchar(max) NULL,
        [MessageTemplate] nvarchar(max) NULL,
        [Exception] nvarchar(max) NULL,
        [LogEvent] nvarchar(max) NULL,
        CONSTRAINT [PK_LogTecnico] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE TABLE [fis].[Plantilla] (
        [Id] int NOT NULL IDENTITY,
        [Nombre] nvarchar(150) NOT NULL,
        [Tipo] nvarchar(30) NOT NULL,
        [Estado] nvarchar(30) NOT NULL,
        CONSTRAINT [PK_Plantilla] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE TABLE [fis].[Producto] (
        [Id] int NOT NULL IDENTITY,
        [Nombre] nvarchar(120) NOT NULL,
        [Unidad] nvarchar(10) NOT NULL,
        CONSTRAINT [PK_Producto] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE TABLE [fis].[Suplidor] (
        [Id] int NOT NULL IDENTITY,
        [Nombre] nvarchar(150) NOT NULL,
        [Rnc] nvarchar(20) NULL,
        [Activo] bit NOT NULL,
        CONSTRAINT [PK_Suplidor] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE TABLE [fis].[Usuario] (
        [Id] uniqueidentifier NOT NULL,
        [Auth0Sub] nvarchar(200) NULL,
        [Correo] nvarchar(256) NOT NULL,
        [NombreCompleto] nvarchar(200) NOT NULL,
        [Cargo] nvarchar(200) NULL,
        [Rol] nvarchar(30) NOT NULL,
        [FirmaPredeterminada] varbinary(max) NULL,
        [Activo] bit NOT NULL,
        [CreadoEn] datetime2(3) NOT NULL,
        [UltimoAcceso] datetime2(3) NULL,
        CONSTRAINT [PK_Usuario] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE TABLE [fis].[PlantillaVersion] (
        [Id] int NOT NULL IDENTITY,
        [PlantillaId] int NOT NULL,
        [Version] int NOT NULL,
        [PdfBase] varbinary(max) NULL,
        [Publicada] bit NOT NULL,
        [PublicadaEn] datetime2(3) NULL,
        CONSTRAINT [PK_PlantillaVersion] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_PlantillaVersion_Plantilla_PlantillaId] FOREIGN KEY ([PlantillaId]) REFERENCES [fis].[Plantilla] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE TABLE [fis].[Fiscalizacion] (
        [Id] uniqueidentifier NOT NULL,
        [Numero] nvarchar(9) NOT NULL,
        [PlantillaVersionId] int NOT NULL,
        [AutorId] uniqueidentifier NOT NULL,
        [Estado] nvarchar(30) NOT NULL,
        [VersionActual] int NOT NULL,
        [EnPapelera] bit NOT NULL,
        [EliminadoEn] datetime2(3) NULL,
        [EliminadoPorId] uniqueidentifier NULL,
        [CreadoEn] datetime2(3) NOT NULL,
        [ActualizadoEn] datetime2(3) NOT NULL,
        [FinalizadoEn] datetime2(3) NULL,
        [RowVersion] rowversion NOT NULL,
        [Fecha] date NULL,
        [HoraSalida] time(0) NULL,
        [InicioProceso] time(0) NULL,
        [LocacionId] int NULL,
        [HoraLlegada] time(0) NULL,
        [FinProceso] time(0) NULL,
        [FichaCamion] nvarchar(30) NULL,
        [Chofer] nvarchar(120) NULL,
        [Placa] nvarchar(20) NULL,
        [Conduce] nvarchar(40) NULL,
        [SuplidorId] int NULL,
        [TotalEntregarGal] decimal(18,2) NULL,
        [FichaCamion2] nvarchar(30) NULL,
        [Chofer2] nvarchar(120) NULL,
        [Responsable] nvarchar(120) NULL,
        [TotalRecibirGal] decimal(18,2) NULL,
        [ProductoId] int NULL,
        [GalonesProveedor] decimal(18,2) NULL,
        [GalonesEgehid] decimal(18,2) NULL,
        [PrecioGalon] decimal(18,4) NULL,
        [VaraInicialMedida] nvarchar(30) NULL,
        [VaraInicialGalones] decimal(18,2) NULL,
        [VaraFinalMedida] nvarchar(30) NULL,
        [VaraFinalGalones] decimal(18,2) NULL,
        [ObservacionesGenerales] nvarchar(max) NULL,
        CONSTRAINT [PK_Fiscalizacion] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Fiscalizacion_Locacion_LocacionId] FOREIGN KEY ([LocacionId]) REFERENCES [fis].[Locacion] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Fiscalizacion_PlantillaVersion_PlantillaVersionId] FOREIGN KEY ([PlantillaVersionId]) REFERENCES [fis].[PlantillaVersion] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Fiscalizacion_Producto_ProductoId] FOREIGN KEY ([ProductoId]) REFERENCES [fis].[Producto] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Fiscalizacion_Suplidor_SuplidorId] FOREIGN KEY ([SuplidorId]) REFERENCES [fis].[Suplidor] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Fiscalizacion_Usuario_AutorId] FOREIGN KEY ([AutorId]) REFERENCES [fis].[Usuario] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Fiscalizacion_Usuario_EliminadoPorId] FOREIGN KEY ([EliminadoPorId]) REFERENCES [fis].[Usuario] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE TABLE [fis].[PlantillaCampo] (
        [Id] int NOT NULL IDENTITY,
        [PlantillaVersionId] int NOT NULL,
        [Identificador] nvarchar(80) NOT NULL,
        [Etiqueta] nvarchar(200) NOT NULL,
        [Tipo] nvarchar(30) NOT NULL,
        [Formula] nvarchar(500) NULL,
        [Pagina] int NOT NULL,
        [X] decimal(9,2) NOT NULL,
        [Y] decimal(9,2) NOT NULL,
        [Ancho] decimal(9,2) NOT NULL,
        [Alto] decimal(9,2) NOT NULL,
        [Obligatorio] bit NOT NULL,
        [EnEstadisticas] bit NOT NULL,
        [ImprimirPdf] bit NOT NULL,
        CONSTRAINT [PK_PlantillaCampo] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_PlantillaCampo_PlantillaVersion_PlantillaVersionId] FOREIGN KEY ([PlantillaVersionId]) REFERENCES [fis].[PlantillaVersion] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE TABLE [fis].[Firma] (
        [FiscalizacionId] uniqueidentifier NOT NULL,
        [Rol] nvarchar(30) NOT NULL,
        [NombreFirmante] nvarchar(150) NOT NULL,
        [Cedula] nvarchar(20) NULL,
        [UsuarioId] uniqueidentifier NULL,
        [Modo] nvarchar(30) NOT NULL,
        [Imagen] varbinary(max) NOT NULL,
        [Sha256] nvarchar(64) NOT NULL,
        [FirmadoEn] datetime2(3) NOT NULL,
        CONSTRAINT [PK_Firma] PRIMARY KEY ([FiscalizacionId], [Rol]),
        CONSTRAINT [FK_Firma_Fiscalizacion_FiscalizacionId] FOREIGN KEY ([FiscalizacionId]) REFERENCES [fis].[Fiscalizacion] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_Firma_Usuario_UsuarioId] FOREIGN KEY ([UsuarioId]) REFERENCES [fis].[Usuario] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE TABLE [fis].[FiscalizacionVersion] (
        [Id] uniqueidentifier NOT NULL,
        [FiscalizacionId] uniqueidentifier NOT NULL,
        [Version] int NOT NULL,
        [SnapshotJson] nvarchar(max) NOT NULL,
        [PdfRuta] nvarchar(400) NULL,
        [Resumen] nvarchar(500) NULL,
        [CreadoPorId] uniqueidentifier NOT NULL,
        [CreadoEn] datetime2(3) NOT NULL,
        CONSTRAINT [PK_FiscalizacionVersion] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_FiscalizacionVersion_Fiscalizacion_FiscalizacionId] FOREIGN KEY ([FiscalizacionId]) REFERENCES [fis].[Fiscalizacion] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_FiscalizacionVersion_Usuario_CreadoPorId] FOREIGN KEY ([CreadoPorId]) REFERENCES [fis].[Usuario] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE TABLE [fis].[Foto] (
        [Id] uniqueidentifier NOT NULL,
        [FiscalizacionId] uniqueidentifier NOT NULL,
        [Orden] int NOT NULL,
        [Descripcion] nvarchar(300) NULL,
        [RutaArchivo] nvarchar(400) NOT NULL,
        [ContentType] nvarchar(50) NOT NULL,
        [Sha256] nvarchar(64) NOT NULL,
        [TamanoBytes] bigint NOT NULL,
        [TomadaEn] datetime2(3) NOT NULL,
        CONSTRAINT [PK_Foto] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Foto_Fiscalizacion_FiscalizacionId] FOREIGN KEY ([FiscalizacionId]) REFERENCES [fis].[Fiscalizacion] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE TABLE [fis].[LecturaEquipo] (
        [FiscalizacionId] uniqueidentifier NOT NULL,
        [Equipo] nvarchar(30) NOT NULL,
        [Inicial] decimal(18,2) NULL,
        [Final] decimal(18,2) NULL,
        CONSTRAINT [PK_LecturaEquipo] PRIMARY KEY ([FiscalizacionId], [Equipo]),
        CONSTRAINT [FK_LecturaEquipo_Fiscalizacion_FiscalizacionId] FOREIGN KEY ([FiscalizacionId]) REFERENCES [fis].[Fiscalizacion] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE TABLE [fis].[RespuestaControl] (
        [FiscalizacionId] uniqueidentifier NOT NULL,
        [PreguntaNumero] int NOT NULL,
        [Respuesta] bit NULL,
        [Observacion] nvarchar(500) NULL,
        CONSTRAINT [PK_RespuestaControl] PRIMARY KEY ([FiscalizacionId], [PreguntaNumero]),
        CONSTRAINT [FK_RespuestaControl_ControlPregunta_PreguntaNumero] FOREIGN KEY ([PreguntaNumero]) REFERENCES [fis].[ControlPregunta] ([Numero]) ON DELETE NO ACTION,
        CONSTRAINT [FK_RespuestaControl_Fiscalizacion_FiscalizacionId] FOREIGN KEY ([FiscalizacionId]) REFERENCES [fis].[Fiscalizacion] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE TABLE [fis].[SolicitudFirma] (
        [Id] uniqueidentifier NOT NULL,
        [FiscalizacionId] uniqueidentifier NOT NULL,
        [Rol] nvarchar(30) NOT NULL,
        [UsuarioDestinoId] uniqueidentifier NOT NULL,
        [SolicitadaPorId] uniqueidentifier NOT NULL,
        [Estado] nvarchar(30) NOT NULL,
        [Comentario] nvarchar(500) NULL,
        [CreadaEn] datetime2(3) NOT NULL,
        [ExpiraEn] datetime2(3) NOT NULL,
        CONSTRAINT [PK_SolicitudFirma] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_SolicitudFirma_Fiscalizacion_FiscalizacionId] FOREIGN KEY ([FiscalizacionId]) REFERENCES [fis].[Fiscalizacion] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_SolicitudFirma_Usuario_SolicitadaPorId] FOREIGN KEY ([SolicitadaPorId]) REFERENCES [fis].[Usuario] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_SolicitudFirma_Usuario_UsuarioDestinoId] FOREIGN KEY ([UsuarioDestinoId]) REFERENCES [fis].[Usuario] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE TABLE [fis].[CambioCampo] (
        [Id] bigint NOT NULL IDENTITY,
        [VersionId] uniqueidentifier NOT NULL,
        [Campo] nvarchar(150) NOT NULL,
        [ValorAnterior] nvarchar(max) NULL,
        [ValorNuevo] nvarchar(max) NULL,
        CONSTRAINT [PK_CambioCampo] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_CambioCampo_FiscalizacionVersion_VersionId] FOREIGN KEY ([VersionId]) REFERENCES [fis].[FiscalizacionVersion] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    IF EXISTS (SELECT * FROM [sys].[identity_columns] WHERE [name] IN (N'Numero', N'Activa', N'ObservacionObligatoriaSiSi', N'Texto', N'TipoObservacion') AND [object_id] = OBJECT_ID(N'[fis].[ControlPregunta]'))
        SET IDENTITY_INSERT [fis].[ControlPregunta] ON;
    EXEC(N'INSERT INTO [fis].[ControlPregunta] ([Numero], [Activa], [ObservacionObligatoriaSiSi], [Texto], [TipoObservacion])
    VALUES (1, CAST(1 AS bit), CAST(0 AS bit), N''¿La solicitud se realizó con margen disponible mínimo del 50 %?'', N''Texto''),
    (2, CAST(1 AS bit), CAST(0 AS bit), N''¿El proveedor llegó a la hora acordada?'', N''Texto''),
    (3, CAST(1 AS bit), CAST(0 AS bit), N''¿Se implementaron las medidas de seguridad establecidas?'', N''Texto''),
    (4, CAST(1 AS bit), CAST(0 AS bit), N''¿Se realizó la prueba de calidad antes de la descarga?'', N''Texto''),
    (5, CAST(1 AS bit), CAST(0 AS bit), N''¿Se efectuaron mediciones antes y después del proceso?'', N''Texto''),
    (6, CAST(1 AS bit), CAST(1 AS bit), N''¿Se evidenció presencia de agua en los tanques?'', N''Texto''),
    (7, CAST(1 AS bit), CAST(0 AS bit), N''¿Válvulas y bocas con presillas de seguridad?'', N''Texto''),
    (8, CAST(1 AS bit), CAST(0 AS bit), N''¿Compartimientos al nivel adecuado de chapas?'', N''Texto''),
    (9, CAST(1 AS bit), CAST(0 AS bit), N''¿Tanque y dispensador en condiciones operativas?'', N''Texto''),
    (10, CAST(1 AS bit), CAST(0 AS bit), N''¿El dispensador ha sido calibrado?'', N''Fecha''),
    (11, CAST(1 AS bit), CAST(1 AS bit), N''¿Se produjo algún derrame durante el proceso?'', N''Texto''),
    (12, CAST(1 AS bit), CAST(1 AS bit), N''¿Hubo diferencias en la entrega recibida?'', N''Texto'')');
    IF EXISTS (SELECT * FROM [sys].[identity_columns] WHERE [name] IN (N'Numero', N'Activa', N'ObservacionObligatoriaSiSi', N'Texto', N'TipoObservacion') AND [object_id] = OBJECT_ID(N'[fis].[ControlPregunta]'))
        SET IDENTITY_INSERT [fis].[ControlPregunta] OFF;
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    IF EXISTS (SELECT * FROM [sys].[identity_columns] WHERE [name] IN (N'Id', N'Activa', N'Nombre', N'Provincia') AND [object_id] = OBJECT_ID(N'[fis].[Locacion]'))
        SET IDENTITY_INSERT [fis].[Locacion] ON;
    EXEC(N'INSERT INTO [fis].[Locacion] ([Id], [Activa], [Nombre], [Provincia])
    VALUES (1, CAST(1 AS bit), N''C.H. Jigüey'', N''Ocoa''),
    (2, CAST(1 AS bit), N''C.H. Aguacate'', NULL),
    (3, CAST(1 AS bit), N''C.H. Valdesia'', NULL),
    (4, CAST(1 AS bit), N''C.H. Tavera'', NULL),
    (5, CAST(1 AS bit), N''C.H. Monción'', NULL),
    (6, CAST(1 AS bit), N''C.H. Jimenoa'', NULL),
    (7, CAST(1 AS bit), N''C.H. Rincón'', NULL),
    (8, CAST(1 AS bit), N''C.H. Hatillo'', NULL),
    (9, CAST(1 AS bit), N''C.H. Pinalito'', NULL),
    (10, CAST(1 AS bit), N''C.H. Palomino'', NULL),
    (11, CAST(1 AS bit), N''C.H. Sabaneta'', NULL),
    (12, CAST(1 AS bit), N''C.H. Las Barías'', NULL)');
    IF EXISTS (SELECT * FROM [sys].[identity_columns] WHERE [name] IN (N'Id', N'Activa', N'Nombre', N'Provincia') AND [object_id] = OBJECT_ID(N'[fis].[Locacion]'))
        SET IDENTITY_INSERT [fis].[Locacion] OFF;
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    IF EXISTS (SELECT * FROM [sys].[identity_columns] WHERE [name] IN (N'Id', N'Estado', N'Nombre', N'Tipo') AND [object_id] = OBJECT_ID(N'[fis].[Plantilla]'))
        SET IDENTITY_INSERT [fis].[Plantilla] ON;
    EXEC(N'INSERT INTO [fis].[Plantilla] ([Id], [Estado], [Nombre], [Tipo])
    VALUES (1, N''Activa'', N''Combustible y aceites'', N''Oficial'')');
    IF EXISTS (SELECT * FROM [sys].[identity_columns] WHERE [name] IN (N'Id', N'Estado', N'Nombre', N'Tipo') AND [object_id] = OBJECT_ID(N'[fis].[Plantilla]'))
        SET IDENTITY_INSERT [fis].[Plantilla] OFF;
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    IF EXISTS (SELECT * FROM [sys].[identity_columns] WHERE [name] IN (N'Id', N'Nombre', N'Unidad') AND [object_id] = OBJECT_ID(N'[fis].[Producto]'))
        SET IDENTITY_INSERT [fis].[Producto] ON;
    EXEC(N'INSERT INTO [fis].[Producto] ([Id], [Nombre], [Unidad])
    VALUES (1, N''Gasoil óptimo'', N''gal'')');
    IF EXISTS (SELECT * FROM [sys].[identity_columns] WHERE [name] IN (N'Id', N'Nombre', N'Unidad') AND [object_id] = OBJECT_ID(N'[fis].[Producto]'))
        SET IDENTITY_INSERT [fis].[Producto] OFF;
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    IF EXISTS (SELECT * FROM [sys].[identity_columns] WHERE [name] IN (N'Id', N'Activo', N'Nombre', N'Rnc') AND [object_id] = OBJECT_ID(N'[fis].[Suplidor]'))
        SET IDENTITY_INSERT [fis].[Suplidor] ON;
    EXEC(N'INSERT INTO [fis].[Suplidor] ([Id], [Activo], [Nombre], [Rnc])
    VALUES (1, CAST(1 AS bit), N''Sunix Petroleum, S.R.L.'', NULL),
    (2, CAST(1 AS bit), N''Isla Dominicana S.R.L.'', NULL),
    (3, CAST(1 AS bit), N''Texaco Caribbean'', NULL),
    (4, CAST(1 AS bit), N''Gulf Dominicana'', NULL)');
    IF EXISTS (SELECT * FROM [sys].[identity_columns] WHERE [name] IN (N'Id', N'Activo', N'Nombre', N'Rnc') AND [object_id] = OBJECT_ID(N'[fis].[Suplidor]'))
        SET IDENTITY_INSERT [fis].[Suplidor] OFF;
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    IF EXISTS (SELECT * FROM [sys].[identity_columns] WHERE [name] IN (N'Id', N'PdfBase', N'PlantillaId', N'Publicada', N'PublicadaEn', N'Version') AND [object_id] = OBJECT_ID(N'[fis].[PlantillaVersion]'))
        SET IDENTITY_INSERT [fis].[PlantillaVersion] ON;
    EXEC(N'INSERT INTO [fis].[PlantillaVersion] ([Id], [PdfBase], [PlantillaId], [Publicada], [PublicadaEn], [Version])
    VALUES (1, NULL, 1, CAST(1 AS bit), ''2026-10-01T00:00:00.000'', 2)');
    IF EXISTS (SELECT * FROM [sys].[identity_columns] WHERE [name] IN (N'Id', N'PdfBase', N'PlantillaId', N'Publicada', N'PublicadaEn', N'Version') AND [object_id] = OBJECT_ID(N'[fis].[PlantillaVersion]'))
        SET IDENTITY_INSERT [fis].[PlantillaVersion] OFF;
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE INDEX [IX_BitacoraApi_Momento] ON [bit].[BitacoraApi] ([Momento]);
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE INDEX [IX_BitacoraApi_UsuarioId] ON [bit].[BitacoraApi] ([UsuarioId]);
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE INDEX [IX_BitacoraCambio_Entidad_EntidadId] ON [bit].[BitacoraCambio] ([Entidad], [EntidadId]);
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE INDEX [IX_BitacoraCambio_Momento] ON [bit].[BitacoraCambio] ([Momento]);
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE UNIQUE INDEX [IX_BitacoraUi_IdCliente] ON [bit].[BitacoraUi] ([IdCliente]);
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE INDEX [IX_BitacoraUi_Momento] ON [bit].[BitacoraUi] ([Momento]);
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE INDEX [IX_BitacoraUi_UsuarioId_Momento] ON [bit].[BitacoraUi] ([UsuarioId], [Momento]);
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE INDEX [IX_CambioCampo_VersionId] ON [fis].[CambioCampo] ([VersionId]);
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE INDEX [IX_Firma_UsuarioId] ON [fis].[Firma] ([UsuarioId]);
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE INDEX [IX_Fiscalizacion_AutorId] ON [fis].[Fiscalizacion] ([AutorId]);
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE INDEX [IX_Fiscalizacion_EliminadoPorId] ON [fis].[Fiscalizacion] ([EliminadoPorId]);
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE INDEX [IX_Fiscalizacion_EnPapelera] ON [fis].[Fiscalizacion] ([EnPapelera]);
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE INDEX [IX_Fiscalizacion_Estado] ON [fis].[Fiscalizacion] ([Estado]);
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE INDEX [IX_Fiscalizacion_Fecha] ON [fis].[Fiscalizacion] ([Fecha]);
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE INDEX [IX_Fiscalizacion_LocacionId] ON [fis].[Fiscalizacion] ([LocacionId]);
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Fiscalizacion_Numero] ON [fis].[Fiscalizacion] ([Numero]);
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE INDEX [IX_Fiscalizacion_PlantillaVersionId] ON [fis].[Fiscalizacion] ([PlantillaVersionId]);
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE INDEX [IX_Fiscalizacion_ProductoId] ON [fis].[Fiscalizacion] ([ProductoId]);
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE INDEX [IX_Fiscalizacion_SuplidorId] ON [fis].[Fiscalizacion] ([SuplidorId]);
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE INDEX [IX_FiscalizacionVersion_CreadoPorId] ON [fis].[FiscalizacionVersion] ([CreadoPorId]);
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE UNIQUE INDEX [IX_FiscalizacionVersion_FiscalizacionId_Version] ON [fis].[FiscalizacionVersion] ([FiscalizacionId], [Version]);
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE INDEX [IX_Foto_FiscalizacionId_Orden] ON [fis].[Foto] ([FiscalizacionId], [Orden]);
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Locacion_Nombre] ON [fis].[Locacion] ([Nombre]);
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE INDEX [IX_LogTecnico_TimeStamp] ON [bit].[LogTecnico] ([TimeStamp]);
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE UNIQUE INDEX [IX_PlantillaCampo_PlantillaVersionId_Identificador] ON [fis].[PlantillaCampo] ([PlantillaVersionId], [Identificador]);
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE UNIQUE INDEX [IX_PlantillaVersion_PlantillaId_Version] ON [fis].[PlantillaVersion] ([PlantillaId], [Version]);
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE INDEX [IX_RespuestaControl_PreguntaNumero] ON [fis].[RespuestaControl] ([PreguntaNumero]);
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE INDEX [IX_SolicitudFirma_FiscalizacionId] ON [fis].[SolicitudFirma] ([FiscalizacionId]);
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE INDEX [IX_SolicitudFirma_SolicitadaPorId] ON [fis].[SolicitudFirma] ([SolicitadaPorId]);
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE INDEX [IX_SolicitudFirma_UsuarioDestinoId_Estado] ON [fis].[SolicitudFirma] ([UsuarioDestinoId], [Estado]);
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Suplidor_Nombre] ON [fis].[Suplidor] ([Nombre]);
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_Usuario_Auth0Sub] ON [fis].[Usuario] ([Auth0Sub]) WHERE [Auth0Sub] IS NOT NULL');
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Usuario_Correo] ON [fis].[Usuario] ([Correo]);
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022184549_Inicial'
)
BEGIN
    INSERT INTO [fis].[__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261022184549_Inicial', N'10.0.13');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261027135435_EncabezadoPlantilla'
)
BEGIN
    ALTER TABLE [fis].[Plantilla] ADD [CodigoDocumento] nvarchar(40) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261027135435_EncabezadoPlantilla'
)
BEGIN
    ALTER TABLE [fis].[Plantilla] ADD [FechaAprobacion] date NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261027135435_EncabezadoPlantilla'
)
BEGIN
    ALTER TABLE [fis].[Plantilla] ADD [FechaElaboracion] date NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261027135435_EncabezadoPlantilla'
)
BEGIN
    ALTER TABLE [fis].[Plantilla] ADD [VersionDocumento] nvarchar(20) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261027135435_EncabezadoPlantilla'
)
BEGIN
    EXEC(N'UPDATE [fis].[Plantilla] SET [CodigoDocumento] = NULL, [FechaAprobacion] = NULL, [FechaElaboracion] = NULL, [VersionDocumento] = NULL
    WHERE [Id] = 1;
    SELECT @@ROWCOUNT');
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261027135435_EncabezadoPlantilla'
)
BEGIN
    INSERT INTO [fis].[__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261027135435_EncabezadoPlantilla', N'10.0.13');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261027145534_CamionEmpresa'
)
BEGIN
    ALTER TABLE [fis].[Fiscalizacion] ADD [ChoferEmpresa] nvarchar(120) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261027145534_CamionEmpresa'
)
BEGIN
    ALTER TABLE [fis].[Fiscalizacion] ADD [FichaCamionEmpresa] nvarchar(30) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261027145534_CamionEmpresa'
)
BEGIN
    INSERT INTO [fis].[__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261027145534_CamionEmpresa', N'10.0.13');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261027150252_NombreSuplidor'
)
BEGIN
    ALTER TABLE [fis].[Fiscalizacion] ADD [NombreSuplidor] nvarchar(150) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261027150252_NombreSuplidor'
)
BEGIN
    UPDATE f SET f.NombreSuplidor = s.Nombre
    FROM fis.Fiscalizacion f JOIN fis.Suplidor s ON s.Id = f.SuplidorId
    WHERE f.NombreSuplidor IS NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [fis].[__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261027150252_NombreSuplidor'
)
BEGIN
    INSERT INTO [fis].[__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261027150252_NombreSuplidor', N'10.0.13');
END;

COMMIT;
GO

