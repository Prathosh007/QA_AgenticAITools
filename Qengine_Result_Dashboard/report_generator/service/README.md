# Run the dashboard service as an always-on Windows service

Keeps `python -m report_generator.server` running on `:8089` — **starts
automatically on machine reboot** and **restarts if it crashes**. Uses the
production **waitress** server (multi-threaded).

## One-time prerequisites (on the host = `prathosh-14802-t`)
```powershell
cd D:\Qengine_Result_Dashboard
python -m pip install -r report_generator\requirements.txt   # includes waitress
# make sure report_generator\.env has CLIENT_ID/SECRET/REFRESH_TOKEN/PROJECT_ID/GOAT_HOME
```

## Option A — Scheduled Task (recommended, no downloads)

Runs at boot as SYSTEM (no stored password), restarts on failure, no time limit.

**Open PowerShell as Administrator**, then:
```powershell
cd D:\Qengine_Result_Dashboard\report_generator\service
powershell -ExecutionPolicy Bypass -File .\install_task.ps1
```
It registers the task, starts it, and verifies `http://localhost:8089/health`.

Manage it:
```powershell
Start-ScheduledTask  -TaskName QEngineDashboardService
Stop-ScheduledTask   -TaskName QEngineDashboardService
Get-ScheduledTask    -TaskName QEngineDashboardService
# remove:
powershell -ExecutionPolicy Bypass -File .\uninstall_task.ps1
```

## Option B — Real Windows Service via NSSM

If you prefer Services.msc control: download `nssm.exe` from https://nssm.cc,
then (as Administrator):
```powershell
cd D:\Qengine_Result_Dashboard\report_generator\service
powershell -ExecutionPolicy Bypass -File .\install_nssm.ps1 -Nssm "C:\tools\nssm.exe"
```

## Verify it's reachable from the agent machine
On the box where GOAT runs the test case:
```powershell
Invoke-RestMethod "http://prathosh-14802-t:8089/health"
```
If this fails, open **port 8089** in Windows Firewall on the host:
```powershell
New-NetFirewallRule -DisplayName "QEngine Dashboard 8089" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8089
```

## Logs
`D:\Qengine_Result_Dashboard\logs\service.log`

## Change the port
Set a machine env var and reinstall: `setx DASHBOARD_PORT 9090 /M` (then restart the task/service).
