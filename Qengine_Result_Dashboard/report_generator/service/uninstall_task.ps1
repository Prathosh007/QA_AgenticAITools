# Remove the QEngine dashboard scheduled task. RUN AS ADMINISTRATOR.
param([string]$TaskName = "QEngineDashboardService")
$ErrorActionPreference = "SilentlyContinue"
Stop-ScheduledTask -TaskName $TaskName
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Host "Removed scheduled task '$TaskName' (the running process will stop on next boot or kill it manually)."
