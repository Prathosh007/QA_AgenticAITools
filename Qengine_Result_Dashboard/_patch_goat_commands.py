"""Add crash/hang/CPU health commands to GOAT commands.json.
Run once on every GOAT machine (or copy the updated commands.json manually).

Commands registered:
  get_crash_events             — App crashes (Event ID 1000) last 24 h
  get_crash_events_ranged      — App crashes (Event ID 1000) last 7 days
                                 (Python-side filters to exact run window)
  get_app_hang_events          — App hangs / high-CPU freezes (Event ID 1002) last 7 days
  get_high_cpu_agent_processes — Current processes under Agent dir with CPU ≥ 50 %
"""
import json
from pathlib import Path

COMMANDS_FILE = Path(r"D:\GOAT\product_package\conf\commands.json")

with COMMANDS_FILE.open("r", encoding="utf-8") as f:
    d = json.load(f)

if "get_crash_events" not in d:
    d["get_crash_events"] = {
        "command": (
            "$cutoff=(Get-Date).AddHours(-24);"
            "$ev=@();"
            "try{"
            "$raw=Get-WinEvent -FilterHashtable @{LogName='Application';Id=1000;StartTime=$cutoff} -ErrorAction SilentlyContinue;"
            "foreach($e in $raw){"
            "$xml=[xml]$e.ToXml();"
            "$data=$xml.Event.EventData.Data;"
            "$app=if($data.Count -gt 0){$data[0].'#text'}else{''};"
            "$path=if($data.Count -gt 1){$data[1].'#text'}else{''};"
            "$mod=if($data.Count -gt 2){$data[2].'#text'}else{''};"
            "$code=if($data.Count -gt 6){$data[6].'#text'}else{'0x0'};"
            "$ev+=($e.TimeCreated.ToString('yyyy-MM-dd HH:mm:ss'))+'__SEP__'+$app+'__SEP__'+$path+'__SEP__'+$mod+'__SEP__'+$code"
            "}"
            "}catch{}"
            "if($ev.Count -eq 0){'NONE'} else{$ev -join '__ROW__'}"
        ),
        "type": "powershell",
        "timeout": 30,
        "outputParser": None,
    }
    print("Added: get_crash_events")
else:
    print("Already exists: get_crash_events")

if "get_high_cpu_agent_processes" not in d:
    d["get_high_cpu_agent_processes"] = {
        "command": (
            "$dir='C:\\Program Files (x86)\\ManageEngine\\UEMS_Agent';"
            "$procs=@();"
            "Get-Process -ErrorAction SilentlyContinue"
            " | Where-Object { $_.Path -and $_.Path -like \"*$dir*\" -and [Math]::Round($_.CPU,2) -ge 50 }"
            " | ForEach-Object {"
            "  $procs += $_.Name+'__SEP__'+$_.Id+'__SEP__'+[Math]::Round($_.CPU,2)+'__SEP__'+[Math]::Round($_.WorkingSet/1MB,1)+'__SEP__'+$_.Path"
            " };"
            "if($procs.Count -eq 0){'NONE'} else{$procs -join '__ROW__'}"
        ),
        "type": "powershell",
        "timeout": 30,
        "outputParser": None,
    }
    print("Added: get_high_cpu_agent_processes")
else:
    print("Already exists: get_high_cpu_agent_processes")

if "get_crash_events_ranged" not in d:
    # Wide 7-day window — Python filters to exact run window client-side.
    # Returns ALL app crashes so path filtering also happens in Python.
    d["get_crash_events_ranged"] = {
        "command": (
            "$cutoff=(Get-Date).AddDays(-7);"
            "$ev=@();"
            "try{"
            "$raw=Get-WinEvent -FilterHashtable @{LogName='Application';Id=1000;StartTime=$cutoff} -ErrorAction SilentlyContinue;"
            "foreach($e in $raw){"
            "$xml=[xml]$e.ToXml();"
            "$data=$xml.Event.EventData.Data;"
            "$app=if($data.Count -gt 0){$data[0].'#text'}else{''};"
            "$path=if($data.Count -gt 1){$data[1].'#text'}else{''};"
            "$mod=if($data.Count -gt 2){$data[2].'#text'}else{''};"
            "$code=if($data.Count -gt 6){$data[6].'#text'}else{'0x0'};"
            "$ev+=($e.TimeCreated.ToString('yyyy-MM-dd HH:mm:ss'))+'__SEP__'+$app+'__SEP__'+$path+'__SEP__'+$mod+'__SEP__'+$code"
            "}"
            "}catch{}"
            "if($ev.Count -eq 0){'NONE'} else{$ev -join '__ROW__'}"
        ),
        "type": "powershell",
        "timeout": 60,
        "outputParser": None,
    }
    print("Added: get_crash_events_ranged")
else:
    print("Already exists: get_crash_events_ranged")

if "get_app_hang_events" not in d:
    # Application Not Responding (Event ID 1002) — indicates CPU spike / freeze.
    # 7-day window; Python filters to exact run window.
    d["get_app_hang_events"] = {
        "command": (
            "$cutoff=(Get-Date).AddDays(-7);"
            "$ev=@();"
            "try{"
            "$raw=Get-WinEvent -FilterHashtable @{LogName='Application';Id=1002;StartTime=$cutoff} -ErrorAction SilentlyContinue;"
            "foreach($e in $raw){"
            "$xml=[xml]$e.ToXml();"
            "$data=$xml.Event.EventData.Data;"
            "$app=if($data.Count -gt 0){$data[0].'#text'}else{''};"
            "$path=if($data.Count -gt 1){$data[1].'#text'}else{''};"
            "$htype=if($data.Count -gt 2){$data[2].'#text'}else{''};"
            "$wait=if($data.Count -gt 3){$data[3].'#text'}else{'0'};"
            "$ev+=($e.TimeCreated.ToString('yyyy-MM-dd HH:mm:ss'))+'__SEP__'+$app+'__SEP__'+$path+'__SEP__'+$htype+'__SEP__'+$wait"
            "}"
            "}catch{}"
            "if($ev.Count -eq 0){'NONE'} else{$ev -join '__ROW__'}"
        ),
        "type": "powershell",
        "timeout": 60,
        "outputParser": None,
    }
    print("Added: get_app_hang_events")
else:
    print("Already exists: get_app_hang_events")

with COMMANDS_FILE.open("w", encoding="utf-8") as f:
    json.dump(d, f, indent=2)

print(f"Done. Total commands: {len(d)}")
