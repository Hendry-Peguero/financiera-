# Compila el APK de la app Android (Capacitor). Uso, desde E:\Fiscalizacion\web:
#   .\scripts\compilar-apk.ps1            → APK de PRUEBA (API por http, servidor editable en el inicio de sesión)
#   .\scripts\compilar-apk.ps1 -Produccion → APK de producción (https; requiere .env.produccion-apk y firma)
# Resultado: E:\Fiscalizacion\apk\fiscalizacion-<versión>.apk
# Herramientas (Java 21, Android SDK 36, Gradle) en E:\Herramientas para no llenar C:.
param([switch]$Produccion)
$ErrorActionPreference = 'Stop'
$web = Split-Path $PSScriptRoot -Parent
$h = 'E:\Herramientas'
$env:JAVA_HOME = (Get-ChildItem "$h\jdk" -Directory | Select-Object -First 1).FullName
$env:ANDROID_HOME = "$h\android-sdk"
$env:ANDROID_USER_HOME = "$h\android-user"
$env:GRADLE_USER_HOME = "$h\gradle"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"

Push-Location $web
try {
    if ($Produccion -and -not (Test-Path 'android\keystore.properties')) {
        throw 'Falta la firma de producción: cree android\keystore.properties (ver docs/APP-MOVIL.md, «Firma del APK»).'
    }
    $modo = if ($Produccion) { 'produccion-apk' } else { 'apk' }
    if ($Produccion) { $env:CAP_PRODUCCION = '1' } else { Remove-Item Env:CAP_PRODUCCION -ErrorAction SilentlyContinue }
    npx vite build --mode $modo
    if ($LASTEXITCODE) { throw 'Falló la compilación web' }
    npx cap sync android
    if ($LASTEXITCODE) { throw 'Falló cap sync' }
    Push-Location android
    try {
        $tarea = if ($Produccion) { 'assembleRelease' } else { 'assembleDebug' }
        .\gradlew.bat $tarea --no-daemon
        if ($LASTEXITCODE) { throw "Falló Gradle ($tarea)" }
    } finally { Pop-Location }
    $version = (Get-Content package.json -Raw | ConvertFrom-Json).version
    $origen = if ($Produccion) { 'android\app\build\outputs\apk\release\app-release.apk' } else { 'android\app\build\outputs\apk\debug\app-debug.apk' }
    $destino = Join-Path (Split-Path $web -Parent) 'apk'
    New-Item -ItemType Directory -Force $destino | Out-Null
    $nombre = if ($Produccion) { "fiscalizacion-$version.apk" } else { "fiscalizacion-$version-prueba.apk" }
    Copy-Item $origen (Join-Path $destino $nombre) -Force
    Write-Host "APK listo: $(Join-Path $destino $nombre)" -ForegroundColor Green
} finally { Pop-Location }
