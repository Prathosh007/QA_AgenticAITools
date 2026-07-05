# ============================================================
#  Alternative: install as a real Windows Service via NSSM.
#  NSSM gives clean Services.msc control + automatic restart.
#  Prereq: download nssm.exe (https://nssm.cc) and put it on PATH
#          or pass -Nssm "C:\path\to\nssm.exe".
#  RUN AS ADMINISTRATOR.
# ============================================================
param(
    [string]$ServiceName = "QEngineDashboard",
    [string]$Nssm = "nssm",
    [int]$Port = 8089
)
$ErrorActionPreference = "Stop"

$proj   = (Resolve-Path "$PSScriptRoot\..\..").Path
$python = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $python) { throw "python not found on PATH." }
$logs = Join-Path $proj "logs"
New-Item -ItemType Directory -Force -Path $logs | Out-Null

& $Nssm install $ServiceName $python "-m" "report_generator.server"
& $Nssm set $ServiceName AppDirectory $proj
& $Nssm set $ServiceName AppStdout (Join-Path $logs "service.log")
& $Nssm set $ServiceName AppStderr (Join-Path $logs "service.log")
& $Nssm set $ServiceName Start SERVICE_AUTO_START
& $Nssm set $ServiceName AppExit Default Restart
& $Nssm set $ServiceName AppRestartDelay 5000
& $Nssm set $ServiceName DisplayName "QEngine Dashboard Service"
& $Nssm start $ServiceName

Start-Sleep -Seconds 6
try {
    $h = Invoke-RestMethod "http://localhost:$Port/health" -TimeoutSec 10
    Write-Host "Health: $($h.status) — service '$ServiceName' running (auto-start enabled)." -ForegroundColor Green
} catch {
    Write-Warning "Not responding yet — check $logs\service.log"
}
# Uninstall:  nssm stop QEngineDashboard ; nssm remove QEngineDashboard confirm
