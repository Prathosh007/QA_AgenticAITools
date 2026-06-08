##############################################################################
# Import Agent Installation testcases (DND / Notification-server style) into
# the testcase-db. Workflow:
#
#   1. Soft-delete every existing AgentInstallation row in the DB.
#   2. Upload the 102 testcases from "Upload to db/AgentInstallation_testcases.csv".
#   3. Upload the matching GOAT payloads from "Upload to db/AgentInstallation_goat_payloads.json"
#      using the same JS-execution-block convention as NotificationServer.
#   4. Upload the gap remarks from "Upload to db/goat-gap-report.md".
#
# Run from anywhere; paths are resolved relative to the script's own folder.
##############################################################################

$DB_URL       = "http://prathosh-14802-t:3000"
$FUNC_NAME    = "AgentInstallation"
$UPLOAD_DIR   = Join-Path $PSScriptRoot "Upload to db"
$CSV_PATH     = Join-Path $UPLOAD_DIR "AgentInstallation_testcases.csv"
$PAYLOAD_PATH = Join-Path $UPLOAD_DIR "AgentInstallation_goat_payloads.json"
$GAPS_PATH    = Join-Path $UPLOAD_DIR "goat-gap-report.md"

foreach ($p in @($CSV_PATH, $PAYLOAD_PATH, $GAPS_PATH)) {
    if (-not (Test-Path $p)) { throw "Required input not found: $p" }
}

# ── 1. Delete existing AgentInstallation testcases ──────────────────────────
Write-Host "`n=== Deleting existing $FUNC_NAME testcases ===" -ForegroundColor Cyan
$existing = (Invoke-WebRequest -Uri "$DB_URL/testcases?functionality=$FUNC_NAME" -UseBasicParsing -TimeoutSec 15).Content | ConvertFrom-Json
Write-Host "Found $($existing.Count) existing records" -ForegroundColor Yellow
$deleted = 0
foreach ($tc in $existing) {
    try {
        Invoke-WebRequest -Uri "$DB_URL/testcases/$($tc.id)" -Method DELETE -UseBasicParsing -TimeoutSec 10 | Out-Null
        $deleted++
    } catch {
        Write-Host "  DELETE failed for $($tc.id): $($_.Exception.Message)" -ForegroundColor Red
    }
}
Write-Host "Deleted: $deleted" -ForegroundColor Green

# ── 2. Parse and upload CSV testcases ───────────────────────────────────────
Write-Host "`n=== Parsing CSV ===" -ForegroundColor Cyan

$rawContent = [System.IO.File]::ReadAllText($CSV_PATH, [System.Text.Encoding]::UTF8)
$lines      = $rawContent -split "`r?`n"
$headerLine = $lines[0]

# Records start with a line matching ^TC-AGENTINSTALL-
$records        = @()
$currentRecord  = ""
for ($i = 1; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    if ($line -match "^TC-AGENTINSTALL-") {
        if ($currentRecord -ne "") { $records += $currentRecord }
        $currentRecord = $line
    } else {
        $currentRecord += "`n" + $line
    }
}
if ($currentRecord -ne "") { $records += $currentRecord }
Write-Host "Found $($records.Count) testcase records in CSV" -ForegroundColor Green

function Split-CsvFields {
    param([string]$record)
    $fields = @()
    $inQuote = $false
    $current = ""
    for ($c = 0; $c -lt $record.Length; $c++) {
        $ch = $record[$c]
        if ($ch -eq '"') {
            if ($inQuote -and ($c + 1 -lt $record.Length) -and $record[$c + 1] -eq '"') {
                $current += '"'; $c++
            } else { $inQuote = -not $inQuote }
        } elseif ($ch -eq ',' -and -not $inQuote) {
            $fields += $current; $current = ""
        } else {
            $current += $ch
        }
    }
    $fields += $current
    return ,$fields
}

function Parse-Steps {
    param([string]$raw)
    $arr   = @()
    $lines = $raw -split "`n"
    foreach ($l in $lines) {
        $t = $l.TrimEnd()
        if ($t -match '^\s*\d+\.\s*') {
            $arr += $t.Trim()
        } elseif ($t.Trim() -ne "" -and $arr.Count -gt 0) {
            $arr[$arr.Count - 1] += " " + $t.Trim()
        }
    }
    if ($arr.Count -eq 0 -and $raw.Trim() -ne "") { $arr = @($raw.Trim()) }
    return ,$arr
}

# CSV columns (0-indexed):
# 0  Testcase ID
# 1  Functionality
# 2  Sub-Functionality
# 3  Title
# 4  Pre-requisites
# 5  Steps
# 6  Expected Output
# 7  Support Files
# 8  Platform
# 9  OS Version
# 10 Priority
# 11 Category
# 12 Remarks
# 13 Actual Output
# 14 Status - OP
# 15 Status - Cloud
# 16 Issue ID
$testcases = @()
foreach ($rec in $records) {
    $f = Split-CsvFields -record $rec
    if ($f.Count -lt 13) { Write-Host "  Skipping malformed row ($($f[0]))" -ForegroundColor Yellow; continue }

    $stepsArr        = Parse-Steps -raw $f[5]
    $supportFilesArr = @()
    if ($f[7].Trim() -ne "") {
        $supportFilesArr = $f[7] -split ";\s*" | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
    }

    $testcases += [PSCustomObject]@{
        id                = $f[0].Trim()
        functionality     = $FUNC_NAME
        sub_functionality = $f[2].Trim()
        title             = $f[3].Trim()
        category          = $f[11].Trim()
        priority          = if ($f[10].Trim() -ne "") { $f[10].Trim() } else { "Medium" }
        status            = "active"
        version           = 1
        platform          = if ($f[8].Trim() -ne "") { $f[8].Trim().ToLower() } else { "windows" }
        os_version        = $f[9].Trim()
        steps             = $stepsArr
        expected_result   = $f[6].Trim()
        support_files     = $supportFilesArr
        pre_requisites    = $f[4].Trim()
        remarks           = $f[12].Trim()
        issue_id          = if ($f.Count -gt 16) { $f[16].Trim() } else { "" }
    }
}

Write-Host "`n=== Uploading $($testcases.Count) testcases ===" -ForegroundColor Cyan
$uploaded = 0; $failed = 0
foreach ($tc in $testcases) {
    $body = $tc | ConvertTo-Json -Depth 10 -Compress
    try {
        Invoke-WebRequest -Uri "$DB_URL/testcases" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 15 | Out-Null
        $uploaded++
    } catch {
        Write-Host "  FAILED testcase $($tc.id): $($_.Exception.Message)" -ForegroundColor Red
        $failed++
    }
}
Write-Host "Testcases uploaded: $uploaded | failed: $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Yellow" })

# ── 3. Upload GOAT payloads ─────────────────────────────────────────────────
Write-Host "`n=== Uploading GOAT payloads ===" -ForegroundColor Cyan

$payloadJson = Get-Content $PAYLOAD_PATH -Raw -Encoding UTF8 | ConvertFrom-Json
Write-Host "Found $($payloadJson.payloads.Count) payload definitions" -ForegroundColor Yellow

$payloadOk = 0; $payloadFail = 0
foreach ($p in $payloadJson.payloads) {
    $payloadObj = [ordered]@{
        testcase_id         = $p.testcase_id
        description         = $p.title
        reuse_installation  = $false
        operations          = $p.operations
        expected_result     = ""
    }
    $payloadJsonStr = $payloadObj | ConvertTo-Json -Depth 20

    $component = if ($p.component) { $p.component } else { "`$Target_Machine" }

    $jsBlock = @"
component = $component;
testcaseId = "$($p.testcase_id)";
payload = $payloadJsonStr;
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
"@

    $body = @{
        tc_id         = $p.testcase_id
        functionality = $FUNC_NAME
        component     = $component
        payload       = $jsBlock
    } | ConvertTo-Json -Depth 5 -Compress

    try {
        Invoke-WebRequest -Uri "$DB_URL/payloads" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 15 | Out-Null
        $payloadOk++
    } catch {
        Write-Host "  FAILED payload $($p.testcase_id): $($_.Exception.Message)" -ForegroundColor Red
        $payloadFail++
    }
}
Write-Host "Payloads uploaded: $payloadOk | failed: $payloadFail" -ForegroundColor $(if ($payloadFail -eq 0) { "Green" } else { "Yellow" })

# ── 4. Upload gap remarks ───────────────────────────────────────────────────
Write-Host "`n=== Uploading gap remarks ===" -ForegroundColor Cyan

$gapsRaw     = [System.IO.File]::ReadAllText($GAPS_PATH, [System.Text.Encoding]::UTF8)
$gapSections = [regex]::Split($gapsRaw, "(?m)^### (?=TC-AGENTINSTALL-)") | Where-Object { $_ -match "^TC-AGENTINSTALL-" }
Write-Host "Found $($gapSections.Count) gap sections" -ForegroundColor Yellow

$gapOk = 0; $gapFail = 0
foreach ($section in $gapSections) {
    $sectionLines = $section -split "`r?`n"
    $tcId = ($sectionLines[0] -split '\s+')[0].Trim()
    foreach ($bl in $sectionLines) {
        if ($bl -match '^\s*-\s+(.*?)\s+_\(\s*(.*?)\s*\)_\s*$') {
            $stepText   = $matches[1].Trim()
            $reason     = $matches[2].Trim()
            $missing    = if ($reason -match 'Qengine browser') { "qengine_browser" }
                          elseif ($reason -match 'Manual / observation') { "manual_observation" }
                          else { "other" }
            $body = @{
                tc_id         = $tcId
                functionality = $FUNC_NAME
                missing_util  = $missing
                step_text     = $stepText
                suggestion    = $reason
            } | ConvertTo-Json -Compress
            try {
                Invoke-WebRequest -Uri "$DB_URL/gaps" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 15 | Out-Null
                $gapOk++
            } catch {
                Write-Host "  FAILED gap for $tcId : $($_.Exception.Message)" -ForegroundColor Red
                $gapFail++
            }
        }
    }
}
Write-Host "Gap entries uploaded: $gapOk | failed: $gapFail" -ForegroundColor $(if ($gapFail -eq 0) { "Green" } else { "Yellow" })

# ── 5. Verify ───────────────────────────────────────────────────────────────
Write-Host "`n=== Verification ===" -ForegroundColor Cyan
$tcCount      = ((Invoke-WebRequest -Uri "$DB_URL/testcases?functionality=$FUNC_NAME&status=active" -UseBasicParsing -TimeoutSec 10).Content | ConvertFrom-Json).Count
$payloadCount = ((Invoke-WebRequest -Uri "$DB_URL/payloads?functionality=$FUNC_NAME"                -UseBasicParsing -TimeoutSec 10).Content | ConvertFrom-Json).Count
$gapCount     = ((Invoke-WebRequest -Uri "$DB_URL/gaps?functionality=$FUNC_NAME"                    -UseBasicParsing -TimeoutSec 10).Content | ConvertFrom-Json).Count
Write-Host "Active testcases : $tcCount"      -ForegroundColor Green
Write-Host "GOAT payloads    : $payloadCount" -ForegroundColor Green
Write-Host "Gap entries      : $gapCount"     -ForegroundColor Green

Write-Host "`n=== Done ===" -ForegroundColor Green
