# start-servers.ps1 — Start Testcase DB + Web Server as persistent background processes
# Run this script once. Both servers will survive terminal/VS Code restarts.
# To stop: .\stop-servers.ps1

$ErrorActionPreference = "Stop"

# ── Config ──────────────────────────────────────────────────────────────────
$WORKSPACE   = "D:\AgentQA_Tools"
$DB_SERVER   = "$WORKSPACE\source\testcase-db\server.js"
$WEB_SERVER  = "$WORKSPACE\source\uems-agent-web\bin\uems-agent-web.exe"
$DB_LOG      = "$WORKSPACE\logs\testcase-db.log"
$WEB_LOG     = "$WORKSPACE\logs\uems-agent-web.log"
$HOSTNAME    = "prathosh-14802-t"

# ── Ensure logs directory ───────────────────────────────────────────────────
if (!(Test-Path "$WORKSPACE\logs")) { New-Item -ItemType Directory -Path "$WORKSPACE\logs" -Force | Out-Null }

# ── Kill existing instances ─────────────────────────────────────────────────
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.MainModule.FileName -like "*node*"
} | ForEach-Object {
    try { $cmdline = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine
        if ($cmdline -like "*testcase-db*") { Stop-Process -Id $_.Id -Force; Write-Host "Stopped old testcase-db (PID $($_.Id))" }
    } catch {}
}
Get-Process -Name "uems-agent-web" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# ── Start Testcase DB (Node.js on port 3000) ───────────────────────────────
Write-Host "Starting Testcase DB server..." -ForegroundColor Cyan
$dbProc = Start-Process -FilePath "node" -ArgumentList $DB_SERVER `
    -WorkingDirectory "$WORKSPACE\source\testcase-db" `
    -WindowStyle Hidden `
    -RedirectStandardOutput $DB_LOG `
    -RedirectStandardError "$WORKSPACE\logs\testcase-db-error.log" `
    -PassThru

Write-Host "  PID: $($dbProc.Id) | Log: $DB_LOG" -ForegroundColor Gray

# ── Wait for DB to be ready ─────────────────────────────────────────────────
$ready = $false
for ($i = 0; $i -lt 10; $i++) {
    Start-Sleep -Seconds 1
    try {
        $null = (New-Object Net.WebClient).DownloadString("http://localhost:3000/health")
        $ready = $true; break
    } catch {}
}
if ($ready) { Write-Host "  Testcase DB: ONLINE at http://${HOSTNAME}:3000" -ForegroundColor Green }
else        { Write-Host "  Testcase DB: FAILED to start - check $DB_LOG" -ForegroundColor Red; exit 1 }

# ── Start Web Server (Go on port 443) ──────────────────────────────────────
Write-Host "Starting Web Server..." -ForegroundColor Cyan

# Set environment variables for the web server
$env:UEMS_MODE = "standalone"
$env:PORT = "443"
$env:UEMS_TLS_SELF_SIGNED = "true"
$env:UEMS_TESTCASE_DB_URL = "http://${HOSTNAME}:3000"
$env:UEMS_PUBLIC_DIR = "$WORKSPACE\source\uems-agent-web\frontend"
$env:UEMS_REPO_DIR = "$WORKSPACE\Code base"

# Start via cmd /c with output redirected to log file
$webCmd = 'cd /d "{0}" & "{1}" > "{2}" 2>&1' -f "$WORKSPACE\source\uems-agent-web", $WEB_SERVER, $WEB_LOG
$webProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c",$webCmd `
    -WindowStyle Hidden `
    -PassThru

Start-Sleep -Seconds 2

# Find the actual uems-agent-web process
$actualWeb = Get-Process -Name "uems-agent-web" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($actualWeb) {
    Write-Host "  PID: $($actualWeb.Id) | Log: $WEB_LOG" -ForegroundColor Gray
} else {
    Write-Host "  Web Server: process not found after start - check $WEB_LOG" -ForegroundColor Red
    exit 1
}

# ── Wait for Web to be ready ────────────────────────────────────────────────
$ready = $false
try { Add-Type 'using System.Net; using System.Security.Cryptography.X509Certificates; public class TrustAllX : ICertificatePolicy { public bool CheckValidationResult(ServicePoint sp, X509Certificate cert, WebRequest req, int problem) { return true; } }' -ErrorAction SilentlyContinue } catch {}
[System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAllX
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

for ($i = 0; $i -lt 10; $i++) {
    Start-Sleep -Seconds 1
    try {
        $null = (New-Object Net.WebClient).DownloadString("https://localhost/health")
        $ready = $true; break
    } catch {}
}
if ($ready) { Write-Host "  Web Server: ONLINE at https://${HOSTNAME}" -ForegroundColor Green }
else        { Write-Host "  Web Server: FAILED to start - check $WEB_LOG" -ForegroundColor Red; exit 1 }

# ── Summary ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== ALL SERVERS RUNNING ===" -ForegroundColor Green
Write-Host "  Testcase DB  : http://${HOSTNAME}:3000      (PID $($dbProc.Id))"
Write-Host "  Web Server   : https://${HOSTNAME}           (PID $($webProc.Id))"
Write-Host "  Explorer     : https://${HOSTNAME}/explorer/"
Write-Host "  TC Viewer    : https://${HOSTNAME}/tc/view"
Write-Host "  Flow Diagram : https://${HOSTNAME}/uems-testcase-generator-flow.html"
Write-Host ""
Write-Host "Servers are running as background processes (not tied to this terminal)."
Write-Host "To stop: .\stop-servers.ps1" -ForegroundColor Yellow
