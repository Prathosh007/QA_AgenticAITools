# stop-servers.ps1 — Stop both servers
Get-Process -Name "uems-agent-web" -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name "node" -ErrorAction SilentlyContinue | ForEach-Object {
    try { $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine
        if ($cmd -like "*testcase-db*" -or $cmd -like "*server.js*") { Stop-Process -Id $_.Id -Force; Write-Host "Stopped testcase-db (PID $($_.Id))" }
    } catch {}
}
# Also kill any cmd.exe hosting start-web.cmd
Get-CimInstance Win32_Process -Filter "Name='cmd.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*start-web.cmd*" } | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    Write-Host "Stopped web cmd wrapper (PID $($_.ProcessId))"
}
Write-Host "All servers stopped." -ForegroundColor Yellow
