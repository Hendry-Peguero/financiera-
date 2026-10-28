using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fiscalizacion.Infrastructure.Persistencia.Migraciones
{
    /// <inheritdoc />
    public partial class EncabezadoPlantilla : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CodigoDocumento",
                schema: "fis",
                table: "Plantilla",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "FechaAprobacion",
                schema: "fis",
                table: "Plantilla",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "FechaElaboracion",
                schema: "fis",
                table: "Plantilla",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VersionDocumento",
                schema: "fis",
                table: "Plantilla",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.UpdateData(
                schema: "fis",
                table: "Plantilla",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "CodigoDocumento", "FechaAprobacion", "FechaElaboracion", "VersionDocumento" },
                values: new object[] { null, null, null, null });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CodigoDocumento",
                schema: "fis",
                table: "Plantilla");

            migrationBuilder.DropColumn(
                name: "FechaAprobacion",
                schema: "fis",
                table: "Plantilla");

            migrationBuilder.DropColumn(
                name: "FechaElaboracion",
                schema: "fis",
                table: "Plantilla");

            migrationBuilder.DropColumn(
                name: "VersionDocumento",
                schema: "fis",
                table: "Plantilla");
        }
    }
}
