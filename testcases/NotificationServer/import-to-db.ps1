##############################################################################
# Import Notification Server testcases from CSV to the testcase-db
# Then generate GOAT JSON payloads for automatable cases
##############################################################################

$DB_URL = "http://prathosh-14802-t:3000"
$CSV_PATH = "$PSScriptRoot\csv\Notification server_All_TestCases.csv"

# ── Parse the CSV (handles multiline cells) ─────────────────────────────────
Write-Host "`n=== Parsing CSV ===" -ForegroundColor Cyan

# Read raw content
$rawContent = [System.IO.File]::ReadAllText($CSV_PATH, [System.Text.Encoding]::UTF8)

# Split into records: each record starts with DC_NS_ at line start
$records = @()
$lines = $rawContent -split "`r?`n"
$headerLine = $lines[0]

# Build records by detecting new rows (start with DC_NS_)
$currentRecord = ""
for ($i = 1; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    if ($line -match "^DC_NS_") {
        if ($currentRecord -ne "") {
            $records += $currentRecord
        }
        $currentRecord = $line
    } else {
        $currentRecord += "`n" + $line
    }
}
if ($currentRecord -ne "") {
    $records += $currentRecord
}

Write-Host "Found $($records.Count) test case records" -ForegroundColor Green

# ── Parse each record into structured test case ──────────────────────────────
function Parse-CSVRecord {
    param([string]$record)
    
    # CSV fields: TC ID, Category, Priority, Pre-Requisites, Objective, Detailed Steps, (empty), Test Data / Input, Expected Result, Log / DB Verification, OS Platform, Related Ticket / Workflow, Status
    # We need to handle quoted fields with commas and newlines
    
    $fields = @()
    $inQuote = $false
    $current = ""
    
    for ($c = 0; $c -lt $record.Length; $c++) {
        $ch = $record[$c]
        if ($ch -eq '"') {
            if ($inQuote -and ($c + 1 -lt $record.Length) -and $record[$c + 1] -eq '"') {
                $current += '"'
                $c++
            } else {
                $inQuote = !$inQuote
            }
        } elseif ($ch -eq ',' -and !$inQuote) {
            $fields += $current
            $current = ""
        } else {
            $current += $ch
        }
    }
    $fields += $current
    
    # Map fields
    $tcId = $fields[0].Trim()
    $category = $fields[1].Trim()
    $priority = $fields[2].Trim()
    $prerequisites = $fields[3].Trim()
    $objective = $fields[4].Trim()
    $stepsRaw = $fields[5].Trim()
    # field[6] is often empty or continuation
    $testData = if ($fields.Count -gt 7) { $fields[7].Trim() } else { "" }
    $expectedResult = if ($fields.Count -gt 8) { $fields[8].Trim() } else { "" }
    $logVerification = if ($fields.Count -gt 9) { $fields[9].Trim() } else { "" }
    $platform = if ($fields.Count -gt 10) { $fields[10].Trim() } else { "Windows" }
    $relatedTicket = if ($fields.Count -gt 11) { $fields[11].Trim() } else { "" }
    $status = if ($fields.Count -gt 12) { $fields[12].Trim() } else { "" }
    
    # Parse steps into array
    $stepsArray = @()
    $stepLines = $stepsRaw -split "`n"
    foreach ($sl in $stepLines) {
        $sl = $sl.Trim()
        if ($sl -match '^\d+\.\s*(.+)') {
            $stepsArray += $sl
        } elseif ($sl -ne "" -and $stepsArray.Count -gt 0) {
            # Continuation of previous step
            $stepsArray[$stepsArray.Count - 1] += " " + $sl
        }
    }
    
    # Determine if GOAT-automatable
    $isGoat = ($testData -match "GOAT")
    
    # Normalize platform
    if ([string]::IsNullOrWhiteSpace($platform)) { $platform = "Windows" }
    $platform = $platform.Trim().ToLower() -replace '\s*/\s*', '/'
    
    # Map priority
    $priorityMap = @{ "High" = "High"; "Medium" = "Medium"; "Low" = "Low" }
    $normalizedPriority = if ($priorityMap.ContainsKey($priority)) { $priority } else { "Medium" }
    
    return @{
        id = $tcId
        category = $category
        priority = $normalizedPriority
        prerequisites = $prerequisites
        objective = $objective
        steps = $stepsArray
        testData = $testData
        expectedResult = $expectedResult
        logVerification = $logVerification
        platform = $platform
        relatedTicket = $relatedTicket
        status = if ($status -ne "") { $status } else { "active" }
        isGoat = $isGoat
    }
}

$testcases = @()
foreach ($rec in $records) {
    $tc = Parse-CSVRecord -record $rec
    if ($tc.id -ne "" -and $tc.id -ne "TC ID") {
        $testcases += $tc
    }
}

Write-Host "Parsed $($testcases.Count) valid test cases" -ForegroundColor Green

# ── Upload testcases to DB ───────────────────────────────────────────────────
Write-Host "`n=== Uploading to DB ===" -ForegroundColor Cyan

$uploaded = 0
$failed = 0

foreach ($tc in $testcases) {
    $body = [PSCustomObject]@{
        id = $tc.id
        functionality = "NotificationServer"
        sub_functionality = $tc.category
        title = $tc.objective
        category = $tc.category
        priority = $tc.priority
        status = "active"
        version = 1
        platform = $tc.platform
        steps = $tc.steps
        expected_result = $tc.expectedResult
        support_files = @($tc.logVerification)
        issue_id = $tc.relatedTicket
    } | ConvertTo-Json -Depth 10 -Compress

    try {
        $null = Invoke-WebRequest -Uri "$DB_URL/testcases" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 10
        $uploaded++
    } catch {
        Write-Host "  FAILED: $($tc.id) - $($_.Exception.Message)" -ForegroundColor Red
        $failed++
    }
}

Write-Host "`nUploaded: $uploaded | Failed: $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Yellow" })

# ── Verify upload ────────────────────────────────────────────────────────────
$r = Invoke-WebRequest -Uri "$DB_URL/testcases?functionality=NotificationServer" -UseBasicParsing -TimeoutSec 10
$dbCount = ($r.Content | ConvertFrom-Json).Count
Write-Host "DB now has $dbCount NotificationServer test cases" -ForegroundColor Cyan

Write-Host "`n=== Done ===" -ForegroundColor Green
