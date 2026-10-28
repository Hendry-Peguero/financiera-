# PRUEBA en tablet: levanta la API local (base provisional) y el front en la red local con HTTPS.
# Uso (PowerShell, desde E:\Fiscalizacion):   .\tablet.ps1
# La tablet debe estar en la misma Wi-Fi. Para detener: cerrar las dos ventanas que se abren.

$raiz = $PSScriptRoot

# IP de esta PC en la red local (la de la Wi-Fi / Ethernet con puerta de enlace)
$ip = (Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } |
       Select-Object -First 1).IPv4Address.IPAddress
if (-not $ip) { $ip = '<IP de esta PC>' }

# el firewall de Windows debe dejar entrar al puerto 5173 (una sola vez, como administrador)
$regla = Get-NetFirewallRule -DisplayName 'Fiscalizacion tablet 5173' -ErrorAction SilentlyContinue
if (-not $regla) {
    Write-Host ''
    Write-Host 'Falta abrir el puerto 5173 en el firewall. Ejecute UNA VEZ en PowerShell como administrador:' -ForegroundColor Yellow
    Write-Host "  New-NetFirewallRule -DisplayName 'Fiscalizacion tablet 5173' -Direction Inbound -Protocol TCP -LocalPort 5173 -Action Allow -Profile Any" -ForegroundColor Yellow
    Write-Host "Al terminar la prueba, quitarla con:  Remove-NetFirewallRule -DisplayName 'Fiscalizacion tablet 5173'" -ForegroundColor Yellow
}

Start-Process powershell -ArgumentList '-NoExit', '-Command',
    "`$host.UI.RawUI.WindowTitle = 'Fiscalizacion API'; cd '$raiz\api'; dotnet run --project src/Fiscalizacion.Api --launch-profile http-provisional"
Start-Process powershell -ArgumentList '-NoExit', '-Command',
    "`$host.UI.RawUI.WindowTitle = 'Fiscalizacion tablet'; cd '$raiz\web'; npm run tablet"

Write-Host ''
Write-Host "En la tablet abra:  https://${ip}:5173" -ForegroundColor Green
Write-Host 'La primera vez el navegador avisa que el certificado no es de confianza (es de prueba): Avanzado > Continuar.'
Write-Host 'Entre con un correo, p. ej. auditor.prueba@egehid.gob.do (Auditor) o hpeguerovaldez@gmail.com (Administrador).'
