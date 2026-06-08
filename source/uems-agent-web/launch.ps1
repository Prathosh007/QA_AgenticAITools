# UEMS Agent Web — Launch Script for Windows
# Run from: source/uems-agent-web/
# Usage: .\launch.ps1

$ErrorActionPreference = "Stop"

# ── Refresh PATH (pick up ripgrep, Go, etc.) ────────────────────
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# ── Workspace root (two levels up from this script) ─────────────
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot ".." "..")).Path

# ── Set default env vars if not already set ─────────────────────
$defaults = @{
    UEMS_MODE            = "standalone"
    PORT                 = "443"
    UEMS_TLS_SELF_SIGNED = "true"
    UEMS_LLM_PROVIDER    = "copilot"
    UEMS_CHAT_MODEL      = "claude-sonnet-4-20250514"
    UEMS_REPO_DIR        = Join-Path $workspaceRoot "Code base"
    UEMS_GUIDELINES_DIR  = Join-Path $workspaceRoot "guidelines"
    UEMS_SKILLS_DIR      = Join-Path $workspaceRoot "skills"
    UEMS_PROMPTS_DIR     = Join-Path $workspaceRoot "agents" "orchestrator" "agents"
    UEMS_REPO_DATA       = Join-Path $workspaceRoot "source" "common" "repos.json"
    UEMS_PUBLIC_DIR      = Join-Path $PSScriptRoot "frontend"
}

foreach ($kv in $defaults.GetEnumerator()) {
    $current = [System.Environment]::GetEnvironmentVariable($kv.Key, "Process")
    if (-not $current) {
        [System.Environment]::SetEnvironmentVariable($kv.Key, $kv.Value, "Process")
    }
}

# ── Load .env file (overrides defaults) ─────────────────────────
$envFile = Join-Path $PSScriptRoot ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $parts = $line -split "=", 2
            $key = $parts[0].Trim()
            $val = $parts[1].Trim()
            if ($key -and $val) {
                [System.Environment]::SetEnvironmentVariable($key, $val, "Process")
                Write-Host "  $key = $val" -ForegroundColor DarkGray
            }
        }
    }
    Write-Host "`n[OK] Loaded .env" -ForegroundColor Green
} else {
    Write-Host "[INFO] No .env file — using defaults" -ForegroundColor DarkGray
}

# ── Ensure Node testcase-db server is running ───────────────────
$tcPort = 3000
$tcProc = Get-NetTCPConnection -LocalPort $tcPort -State Listen -ErrorAction SilentlyContinue
if (-not $tcProc) {
    Write-Host "`n[INFO] Starting testcase-db server on port $tcPort..." -ForegroundColor Cyan
    $tcDbDir = Join-Path $PSScriptRoot ".." "testcase-db"
    Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $tcDbDir -WindowStyle Hidden
    Start-Sleep -Seconds 2
    Write-Host "[OK] Testcase DB started" -ForegroundColor Green
} else {
    Write-Host "`n[OK] Testcase DB already running on port $tcPort" -ForegroundColor Green
}

# ── Launch Go web server ────────────────────────────────────────
$binPath = Join-Path $PSScriptRoot "bin" "uems-agent-web.exe"
if (-not (Test-Path $binPath)) {
    Write-Host "[ERROR] Binary not found: $binPath" -ForegroundColor Red
    Write-Host "  Run: cd backend; go build -o ..\bin\uems-agent-web.exe .\server" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  UEMS Agent AI Toolkit" -ForegroundColor White
Write-Host "  https://prathosh-14802-t.csez.zohocorpin.com/" -ForegroundColor Cyan
Write-Host "  Explorer:   /explorer/" -ForegroundColor Cyan
Write-Host "  Testcase DB: /tc/view" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Run the server (blocking — Ctrl+C to stop)
& $binPath
