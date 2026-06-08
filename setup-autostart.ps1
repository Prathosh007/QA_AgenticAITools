# setup-autostart.ps1
# Registers both Testcase DB (port 3000) and uems-agent-web (port 443) as
# Windows Scheduled Tasks that start at system boot.
# Run ONCE as Administrator.

$ErrorActionPreference = "Stop"
$WORKSPACE = "D:\AgentQA_Tools"

$cmd = Get-Command node -ErrorAction SilentlyContinue
if ($cmd) { $NodePath = $cmd.Source } else { Write-Error "Node.js not in PATH"; exit 1 }

$WebBinary = "$WORKSPACE\source\uems-agent-web\bin\uems-agent-web.exe"
if (-not (Test-Path $WebBinary)) { Write-Error "uems-agent-web.exe not found"; exit 1 }

$DbScript = "$WORKSPACE\source\testcase-db\server.js"
if (-not (Test-Path $DbScript)) { Write-Error "server.js not found"; exit 1 }

function Register-ServerTask($TaskName, $ExePath, $Arguments, $WorkingDir, $Description) {
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Write-Host "Removing existing task: $TaskName" -ForegroundColor Yellow
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    }
    $Action = New-ScheduledTaskAction -Execute $ExePath -Argument $Arguments -WorkingDirectory $WorkingDir
    $Trigger = New-ScheduledTaskTrigger -AtStartup
    $Settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 0) -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
    $Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Description $Description | Out-Null
    Write-Host "  Registered: $TaskName" -ForegroundColor Green
}

# 1. Testcase DB
Write-Host "`n=== Registering Testcase DB ===" -ForegroundColor Cyan
if (-not (Test-Path "$WORKSPACE\source\testcase-db\node_modules")) {
    Push-Location "$WORKSPACE\source\testcase-db"; npm install --production; Pop-Location
}
Register-ServerTask "UEMS-Testcase-DB" $NodePath """$DbScript""" "$WORKSPACE\source\testcase-db" "UEMS Testcase DB on port 3000"

# 2. Web Server
Write-Host "`n=== Registering uems-agent-web ===" -ForegroundColor Cyan
Register-ServerTask "UEMS-Agent-Web" "cmd.exe" "/c ""$WORKSPACE\start-web.cmd""" "$WORKSPACE\source\uems-agent-web" "UEMS Agent Web on port 443"

# 3. Start both
Write-Host "`n=== Starting servers ===" -ForegroundColor Cyan
Start-ScheduledTask -TaskName "UEMS-Testcase-DB"
Start-ScheduledTask -TaskName "UEMS-Agent-Web"
Start-Sleep -Seconds 4

# 4. Verify
Write-Host "`n=== Verification ===" -ForegroundColor Cyan
try {
    $null = (New-Object Net.WebClient).DownloadString("http://localhost:3000/health")
    Write-Host "  Testcase DB : ONLINE (http://prathosh-14802-t:3000)" -ForegroundColor Green
} catch {
    Write-Host "  Testcase DB : FAILED" -ForegroundColor Red
}

try {
    Add-Type 'using System.Net; using System.Security.Cryptography.X509Certificates; public class TrustAll2 : ICertificatePolicy { public bool CheckValidationResult(ServicePoint sp, X509Certificate cert, WebRequest req, int problem) { return true; } }' -ErrorAction SilentlyContinue
} catch {}
[System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAll2
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
try {
    $null = (New-Object Net.WebClient).DownloadString("https://localhost/health")
    Write-Host "  Web Server  : ONLINE (https://prathosh-14802-t)" -ForegroundColor Green
} catch {
    Write-Host "  Web Server  : FAILED" -ForegroundColor Red
}

Write-Host "`n=== DONE ===" -ForegroundColor Green
Write-Host "Both servers auto-start on boot. No VS Code or login needed."
Write-Host ""
Write-Host "  Testcase DB : http://prathosh-14802-t:3000"
Write-Host "  Web Server  : https://prathosh-14802-t"
Write-Host "  TC Viewer   : https://prathosh-14802-t/tc/view"
Write-Host ""
Write-Host "To stop/start/remove:" -ForegroundColor Yellow
Write-Host "  Stop-ScheduledTask -TaskName UEMS-Testcase-DB"
Write-Host "  Stop-ScheduledTask -TaskName UEMS-Agent-Web"
Write-Host "  Start-ScheduledTask -TaskName UEMS-Testcase-DB"
Write-Host "  Start-ScheduledTask -TaskName UEMS-Agent-Web"
Write-Host "  Unregister-ScheduledTask -TaskName UEMS-Testcase-DB"
Write-Host "  Unregister-ScheduledTask -TaskName UEMS-Agent-Web"
