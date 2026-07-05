# ============================================================
#  Install the QEngine dashboard service as an always-on Windows
#  Scheduled Task: starts at boot (before login), restarts on crash,
#  no time limit. Runs as SYSTEM so no password is stored.
#
#  RUN AS ADMINISTRATOR:
#     powershell -ExecutionPolicy Bypass -File install_task.ps1
#
#  Re-run any time to update; use uninstall_task.ps1 to remove.
# ============================================================
param(
    [string]$TaskName = "QEngineDashboardService",
    [int]$Port = 8089
)

$ErrorActionPreference = "Stop"

# Resolve paths
$proj   = (Resolve-Path "$PSScriptRoot\..\..").Path
$bat    = Join-Path $PSScriptRoot "run_dashboard.bat"
$python = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $python) { throw "python not found on PATH. Install Python 3.11+ for all users, or edit this script to set the full python.exe path." }

Write-Host "Project   : $proj"
Write-Host "Python    : $python"
Write-Host "Launcher  : $bat"
Write-Host "Task name : $TaskName  (port $Port)"

# Action: run the launcher bat, passing the python path; working dir = project root
$action = New-ScheduledTaskAction -Execute $bat -Argument "`"$python`"" -WorkingDirectory $proj

# Trigger: at machine startup (no login needed)
$trigger = New-ScheduledTaskTrigger -AtStartup

# Run as SYSTEM, highest privileges
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

# Settings: restart on failure, never time out, start when available
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Seconds 0) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
    -Principal $principal -Settings $settings -Force | Out-Null

Write-Host "`nRegistered. Starting now..."
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 6

# Verify
try {
    $h = Invoke-RestMethod "http://localhost:$Port/health" -TimeoutSec 10
    Write-Host "Health: $($h.status)  (output_root: $($h.output_root))" -ForegroundColor Green
    Write-Host "`nService is running and will auto-start on reboot."
    Write-Host "Logs: $proj\logs\service.log"
} catch {
    Write-Warning "Service not responding yet on port $Port. Check $proj\logs\service.log"
    Write-Warning "Common causes: dependencies not installed (pip install -r report_generator\requirements.txt), or port in use."
}
