-- Crea la base Fiscalizacion en HIDRO-75 y da acceso al login de la aplicación.
-- Ejecutar con una cuenta con permiso CREATE DATABASE. Idempotente.
-- Después ejecutar Fiscalizacion_HIDRO75.sql (tablas, índices y datos iniciales).
IF DB_ID(N'Fiscalizacion') IS NULL
    CREATE DATABASE [Fiscalizacion];
GO
ALTER DATABASE [Fiscalizacion] SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;
GO
USE [Fiscalizacion];
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'userapp1')
    CREATE USER [userapp1] FOR LOGIN [userapp1];
GO
ALTER ROLE db_datareader ADD MEMBER [userapp1];
ALTER ROLE db_datawriter ADD MEMBER [userapp1];
GO
