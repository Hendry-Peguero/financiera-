# Publica una actualización de la app: las tablets la descargan solas (sin reinstalar el APK).
# Uso, desde E:\Fiscalizacion\web (antes, subir "version" en package.json, p. ej. 0.1.0 → 0.1.1):
#   .\scripts\publicar-actualizacion.ps1 -Notas "Bitácora con nueva interfaz"
#   .\scripts\publicar-actualizacion.ps1 -Destino "\\servidor\App_Data\app" -Modo produccion-apk
# Deja en -Destino (App:Ruta de la API) el paquete <versión>.zip y version.json con su huella SHA-256.
# -NativaMinima: versionCode mínimo del APK que puede usar esta versión (súbalo solo si cambió código nativo).
param(
    [string]$Notas = '',
    [string]$Destino = (Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) 'api\src\Fiscalizacion.Api\App_Data\app'),
    [string]$Modo = 'apk',
    [int]$NativaMinima = 1
)
$ErrorActionPreference = 'Stop'
$web = Split-Path $PSScriptRoot -Parent
Push-Location $web
try {
    $version = (Get-Content package.json -Raw | ConvertFrom-Json).version
    New-Item -ItemType Directory -Force $Destino | Out-Null
    $manifiesto = Join-Path $Destino 'version.json'
    if (Test-Path $manifiesto) {
        $actual = (Get-Content $manifiesto -Raw | ConvertFrom-Json).version
        if ([version]$version -le [version]$actual) { throw "La versión $version no es mayor que la publicada ($actual): suba 'version' en package.json." }
    }
    npx vite build --mode $Modo
    if ($LASTEXITCODE) { throw 'Falló la compilación web' }
    $zip = Join-Path $Destino "$version.zip"
    if (Test-Path $zip) { throw "Ya existe $zip" }
    # index.html en la raíz del zip (lo exige el plugin) y rutas con «/» (Compress-Archive de PS 5.1 usa «\»)
    Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
    $dist = (Resolve-Path (Join-Path $web 'dist')).Path
    $z = [System.IO.Compression.ZipFile]::Open($zip, 'Create')
    try {
        Get-ChildItem $dist -Recurse -File | ForEach-Object {
            $rel = $_.FullName.Substring($dist.Length + 1).Replace('\', '/')
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($z, $_.FullName, $rel, 'Optimal') | Out-Null
        }
    } finally { $z.Dispose() }
    $sha = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLowerInvariant()
    [ordered]@{
        version      = $version
        archivo      = "$version.zip"
        sha256       = $sha
        notas        = $Notas
        publicadaEn  = (Get-Date).ToUniversalTime().ToString('o')
        nativaMinima = $NativaMinima
    } | ConvertTo-Json | Set-Content $manifiesto -Encoding utf8
    Write-Host "Publicada $version ($([math]::Round((Get-Item $zip).Length / 1MB, 1)) MB) en $Destino" -ForegroundColor Green
    Write-Host 'Las tablets la descargan al abrir la app y la aplican al cerrarla o salir de ella.'
} finally { Pop-Location }
