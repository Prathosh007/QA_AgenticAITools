<#
.SYNOPSIS
    Registers the UEMS Testcase DB server as a Windows Scheduled Task that starts at system boot.
    Run this script ONCE as Administrator on prathosh-14802-t.

.USAGE
    Right-click setup-autostart.ps1 → "Run with PowerShell" (as Administrator)
    OR: powershell -ExecutionPolicy Bypass -File setup-autostart.ps1
#>

$ErrorActionPreference = "Stop"
$TaskName   = "UEMS-Testcase-DB"
$ServerDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerScript = Join-Path $ServerDir "server.js"
$NodePath   = (Get-Command node -ErrorAction SilentlyContinue)?.Source

if (-not $NodePath) {
    Write-Error "Node.js not found in PATH. Install Node.js first, then re-run."
    exit 1
}

if (-not (Test-Path $ServerScript)) {
    Write-Error "server.js not found at: $ServerScript"
    exit 1
}

# Remove existing task if present
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Write-Host "Removing existing scheduled task '$TaskName'..."
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Install npm dependencies if needed
if (-not (Test-Path (Join-Path $ServerDir "node_modules"))) {
    Write-Host "Installing npm dependencies..."
    Push-Location $ServerDir
    npm install
    Pop-Location
}

# Create the scheduled task
$Action  = New-ScheduledTaskAction -Execute $NodePath -Argument "`"$ServerScript`"" -WorkingDirectory $ServerDir
$Trigger = New-ScheduledTaskTrigger -AtStartup
$Settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0) `
    -RestartCount 5 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -StartWhenAvailable

# Run as SYSTEM so it starts even without a logged-in user
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask `
    -TaskName   $TaskName `
    -Action     $Action `
    -Trigger    $Trigger `
    -Settings   $Settings `
    -Principal  $Principal `
    -Description "UEMS Testcase DB server — Node.js HTTP API on port 3000. Team-wide shared testcase database." | Out-Null

Write-Host ""
Write-Host "============================================================"
Write-Host " Scheduled task '$TaskName' registered successfully."
Write-Host " The DB server will start automatically at every system boot."
Write-Host ""
Write-Host " Starting the server now..."
Write-Host "============================================================"
Write-Host ""

# Start it immediately (don't wait for reboot)
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 3

# Verify it's up
try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing -TimeoutSec 5
    Write-Host " Health check: OK ($($r.StatusCode))"
    Write-Host " DB is live at http://prathosh-14802-t:3000"
    Write-Host " Viewer      : http://prathosh-14802-t:3000/view"
} catch {
    Write-Warning " Health check failed — server may still be starting. Wait a few seconds and try: http://localhost:3000/health"
}

Write-Host ""
Write-Host "To stop the server:  Stop-ScheduledTask -TaskName '$TaskName'"
Write-Host "To remove autostart: Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"
Write-Host ""
