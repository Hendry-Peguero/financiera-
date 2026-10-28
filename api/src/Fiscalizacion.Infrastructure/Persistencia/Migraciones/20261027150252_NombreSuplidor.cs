using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fiscalizacion.Infrastructure.Persistencia.Migraciones
{
    /// <inheritdoc />
    public partial class NombreSuplidor : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "NombreSuplidor",
                schema: "fis",
                table: "Fiscalizacion",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            // registros anteriores: el nombre del catálogo
            migrationBuilder.Sql(@"UPDATE f SET f.NombreSuplidor = s.Nombre
FROM fis.Fiscalizacion f JOIN fis.Suplidor s ON s.Id = f.SuplidorId
WHERE f.NombreSuplidor IS NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NombreSuplidor",
                schema: "fis",
                table: "Fiscalizacion");
        }
    }
}
