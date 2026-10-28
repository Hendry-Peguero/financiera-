using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fiscalizacion.Infrastructure.Persistencia.Migraciones
{
    /// <inheritdoc />
    public partial class CamionEmpresa : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ChoferEmpresa",
                schema: "fis",
                table: "Fiscalizacion",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FichaCamionEmpresa",
                schema: "fis",
                table: "Fiscalizacion",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ChoferEmpresa",
                schema: "fis",
                table: "Fiscalizacion");

            migrationBuilder.DropColumn(
                name: "FichaCamionEmpresa",
                schema: "fis",
                table: "Fiscalizacion");
        }
    }
}
