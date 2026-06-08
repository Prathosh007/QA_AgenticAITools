$ErrorActionPreference = "Continue"
$repos = Get-Content "D:\AgentQA_Tools\source\common\repos.json" | ConvertFrom-Json
$baseDir = "D:\AgentQA_Tools\Code base"

$total = 0
$cloned = 0
$skipped = 0
$failed = 0
$failedList = @()

foreach ($platform in $repos.PSObject.Properties) {
    $platformName = $platform.Name
    $platformDir = Join-Path $baseDir $platformName
    if (-not (Test-Path $platformDir)) {
        New-Item -ItemType Directory -Path $platformDir -Force | Out-Null
    }

    foreach ($repo in $platform.Value.PSObject.Properties) {
        $total++
        $repoName = $repo.Name
        $gitUrl = $repo.Value.gitUrl
        $repoDir = Join-Path $platformDir $repoName

        if (Test-Path (Join-Path $repoDir ".git")) {
            Write-Host "[SKIP] $platformName/$repoName -- already cloned" -ForegroundColor DarkGray
            $skipped++
            continue
        }

        Write-Host "[CLONE] $platformName/$repoName ... " -NoNewline
        $output = git clone --depth 1 --single-branch $gitUrl $repoDir 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "OK" -ForegroundColor Green
            $cloned++
        } else {
            Write-Host "FAIL" -ForegroundColor Red
            $failedList += "$platformName/$repoName ($gitUrl)"
            $failed++
        }
    }
}

Write-Host ""
Write-Host "========================================="
Write-Host "  Cloned: $cloned  Skipped: $skipped  Failed: $failed  Total: $total"
Write-Host "========================================="

if ($failedList.Count -gt 0) {
    Write-Host ""
    Write-Host "Failed repos:" -ForegroundColor Yellow
    foreach ($f in $failedList) {
        Write-Host "  $f" -ForegroundColor Yellow
    }
}
