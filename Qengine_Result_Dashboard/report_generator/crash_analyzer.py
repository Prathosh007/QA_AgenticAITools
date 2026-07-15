"""Crash and high-CPU analysis for agent machines via the GOAT REST API.

For each configured agent machine the analyzer:
1. Checks if the GOAT server is reachable (GET /api/system/health).
2. Queries the Windows Application Event Log for:
   - Crash events (Event ID 1000) — filtered to the automation run window
   - Application Hang events (Event ID 1002) — indicates CPU/freeze issues
   whose faulting application path originates from the Agent install directory.
3. Identifies running processes from the Agent directory with CPU usage above
   the configured threshold (default: 50 %) — point-in-time snapshot.

When ``run_start`` / ``run_end`` are provided, ONLY events that occurred within
that exact window are reported.  This lets you answer: "did any Agent exe crash
or hang *during* the test run that just finished?"

Both queries are executed by posting a one-shot test-case operation to the
GOAT ``POST /api/testcases/validate`` endpoint using the ``machine_operation``
handler with the ``get_crash_events_ranged``, ``get_app_hang_events`` and
``get_high_cpu_agent_processes`` actions registered in
``<goat_home>/product_package/conf/commands.json``.

Run ``python _patch_goat_commands.py`` once on each GOAT machine to register
those commands before using this analyzer.

Usage (called from main.py ``generate()``)::

    from .crash_analyzer import CrashAnalyzer
    analyzer = CrashAnalyzer(config)
    # Pass the run's actual start/end to scope events to the execution window:
    report.machine_health = analyzer.collect(
        run_start=report.summary.started_time,
        run_end=report.summary.end_time,
    )
"""
from __future__ import annotations

import json
import logging
import subprocess
import sys
from datetime import datetime, timedelta
from typing import Any, Optional

import requests

from .models import AppHangEvent, CrashEvent, HighCpuProcess, MachineHealthReport

log = logging.getLogger("report_generator.crash_analyzer")

# Delimiters used by the PowerShell commands in commands.json.
_ROW_SEP = "__ROW__"
_COL_SEP = "__SEP__"


# ---------------------------------------------------------------------------
# GOAT operation helpers
# ---------------------------------------------------------------------------

def _build_operation(op_type: str, action: str, extra: dict | None = None) -> dict:
    """Build a single GOAT operation object."""
    params = {"action": action}
    if extra:
        params.update(extra)
    return {
        "type": op_type,
        "parameters": params,
    }


def _build_testcase(tc_id: str, operations: list[dict]) -> dict:
    """Wrap operations into the GOAT test-case JSON envelope."""
    return {
        "testcase_id": tc_id,
        "description": "Health check — crash and CPU analysis",
        "reuse_installation": False,
        "operations": operations,
    }


# ---------------------------------------------------------------------------
# CrashAnalyzer
# ---------------------------------------------------------------------------

class CrashAnalyzer:
    """Collect crash and CPU health data from one or more GOAT agent machines."""

    def __init__(self, config: Any) -> None:
        self.config = config
        self.timeout = max(getattr(config, "timeout", 30), 60)

    # -- public -------------------------------------------------------------

    def collect(
        self,
        run_start: str = "",
        run_end: str = "",
    ) -> list[MachineHealthReport]:
        """Collect crash / hang / CPU data from all configured agent machines.

        Args:
            run_start: Human-readable start time of the automation run
                       (e.g. "01-Jul-2026 10:46").  If provided, only events
                       that fall inside [run_start, run_end] are returned.
            run_end:   Human-readable end time of the automation run.
        """
        # Convert to datetime objects for later filtering.
        self._run_start_dt = _parse_dt(run_start)
        self._run_end_dt = _parse_dt(run_end)

        if self._run_start_dt and self._run_end_dt:
            log.info(
                "Health check scoped to run window: %s → %s",
                self._run_start_dt.strftime("%d-%b-%Y %H:%M"),
                self._run_end_dt.strftime("%d-%b-%Y %H:%M"),
            )
        else:
            log.info("No run window provided — using last %d hours.", getattr(self.config, "crash_hours", 24))

        machines = self._resolve_machines()
        results: list[MachineHealthReport] = []
        for m in machines:
            log.info("Collecting crash/CPU data from GOAT machine: %s (%s)", m["name"], m["url"])
            results.append(self._collect_machine(m["name"], m["url"], run_start, run_end))
        return results

    # -- internals ----------------------------------------------------------

    def _resolve_machines(self) -> list[dict[str, str]]:
        machines = getattr(self.config, "goat_machines", None) or []
        if machines:
            return [
                {"name": str(m.get("name", m.get("url", "unknown"))), "url": str(m["url"])}
                for m in machines if m.get("url")
            ]
        url = getattr(self.config, "goat_url", "http://localhost:9295/api") or "http://localhost:9295/api"
        return [{"name": _hostname_from_url(url), "url": url}]

    def _collect_machine(self, name: str, goat_url: str, run_start: str = "", run_end: str = "") -> MachineHealthReport:
        collected_at = datetime.now().strftime("%d-%b-%Y %H:%M:%S")
        mh = MachineHealthReport(
            machine=name,
            goat_url=goat_url,
            collected_at=collected_at,
            run_start=run_start,
            run_end=run_end,
        )

        if not self._is_healthy(goat_url):
            log.warning("GOAT at %s is unreachable — skipping crash/CPU collection.", goat_url)
            mh.reachable = False
            mh.error = f"GOAT server at {goat_url} did not respond."
            if _is_local(goat_url):
                log.info("Attempting local PowerShell fallback for %s", name)
                self._collect_local(mh)
            return mh

        # 2. Crash events (Event ID 1000) via machine_operation
        # Use wide-window 'ranged' command (7 days) — we filter to run window in Python.
        try:
            raw = self._run_goat_operation(
                goat_url, "machine_operation", "get_crash_events_ranged",
                tc_id="health_crash_check",
            )
            all_crashes = _parse_crash_events(raw, name)
            mh.crash_events = _filter_to_window(all_crashes, "time_created",
                                                 self._run_start_dt, self._run_end_dt)
            mh.crash_events = _filter_agent_path(mh.crash_events, "process_path",
                                                  getattr(self.config, "agent_install_dir", ""))
            log.info("%s: %d crash event(s) in run window.", name, len(mh.crash_events))
        except Exception as exc:
            log.warning("Crash event collection failed for %s: %s", name, exc)
            mh.error += f" CrashErr:{exc}"

        # 3. Application Hang events (Event ID 1002) — CPU/freeze indicator
        try:
            raw = self._run_goat_operation(
                goat_url, "machine_operation", "get_app_hang_events",
                tc_id="health_hang_check",
            )
            all_hangs = _parse_hang_events(raw, name)
            mh.hang_events = _filter_to_window(all_hangs, "time_created",
                                                self._run_start_dt, self._run_end_dt)
            mh.hang_events = _filter_agent_path(mh.hang_events, "process_path",
                                                 getattr(self.config, "agent_install_dir", ""))
            log.info("%s: %d hang event(s) in run window.", name, len(mh.hang_events))
        except Exception as exc:
            log.warning("App hang collection failed for %s: %s", name, exc)
            mh.error += f" HangErr:{exc}"

        # 4. High-CPU processes (point-in-time snapshot at collection time)
        try:
            raw = self._run_goat_operation(
                goat_url, "machine_operation", "get_high_cpu_agent_processes",
                tc_id="health_cpu_check",
            )
            mh.high_cpu_processes = _parse_high_cpu(raw, name)
            log.info("%s: %d high-CPU process(es) found.", name, len(mh.high_cpu_processes))
        except Exception as exc:
            log.warning("High-CPU collection failed for %s: %s", name, exc)
            mh.error += f" CpuErr:{exc}"

        return mh

    # -- GOAT API execution -------------------------------------------------

    def _is_healthy(self, goat_url: str) -> bool:
        try:
            resp = requests.get(
                f"{goat_url.rstrip('/')}/system/health",
                timeout=10,
            )
            return resp.status_code < 300
        except Exception:
            return False

    def _run_goat_operation(
        self,
        goat_url: str,
        op_type: str,
        action: str,
        tc_id: str = "health_check",
    ) -> str:
        """POST a one-shot test case to GOAT validate endpoint and return remarks."""
        base = goat_url.rstrip("/")
        tc = _build_testcase(tc_id, [_build_operation(op_type, action)])

        resp = requests.post(
            f"{base}/testcases/validate",
            json=tc,
            timeout=self.timeout,
        )
        if resp.status_code >= 300:
            raise RuntimeError(f"GOAT validate returned HTTP {resp.status_code}")

        data = resp.json()
        # GOAT wraps responses as {success, message, data}
        payload = data.get("data") if isinstance(data, dict) else data
        # Extract remarks/output from the operation result
        return _extract_remarks(payload)

    # -- local fallback -----------------------------------------------------

    def _collect_local(self, mh: MachineHealthReport) -> None:
        """Run PowerShell directly on the local machine (no GOAT needed)."""
        crash_hours = int(getattr(self.config, "crash_hours", 24))
        cpu_threshold = float(getattr(self.config, "cpu_threshold", 50))
        agent_dir = (
            getattr(self.config, "agent_install_dir", "")
            or r"C:\Program Files (x86)\ManageEngine\UEMS_Agent"
        )

        # Build time filter for PowerShell: use exact run window if available,
        # otherwise fall back to last N hours.
        if self._run_start_dt and self._run_end_dt:
            # Exact window — pad by 1 minute on each side to catch boundary events.
            ps_start = (self._run_start_dt - timedelta(minutes=1)).strftime("%Y-%m-%d %H:%M:%S")
            ps_end = (self._run_end_dt + timedelta(minutes=1)).strftime("%Y-%m-%d %H:%M:%S")
            time_filter = (
                f"$tStart=[datetime]'{ps_start}';"
                f"$tEnd=[datetime]'{ps_end}';"
                "$cutoff=$tStart;"
            )
            event_time_check = "-and $e.TimeCreated -ge $tStart -and $e.TimeCreated -le $tEnd"
            log.info("Local PS crash query: window %s → %s", ps_start, ps_end)
        else:
            time_filter = f"$cutoff=(Get-Date).AddHours(-{crash_hours});"
            event_time_check = ""

        ps_crash = (
            time_filter +
            "$ev=@();"
            "try{"
            "$raw=Get-WinEvent -FilterHashtable @{LogName='Application';Id=1000;StartTime=$cutoff} -ErrorAction SilentlyContinue;"
            "foreach($e in $raw){"
            "$xml=[xml]$e.ToXml();$data=$xml.Event.EventData.Data;"
            "$app=if($data.Count -gt 0){$data[0].'#text'}else{''};"
            "$path=if($data.Count -gt 1){$data[1].'#text'}else{''};"
            "$mod=if($data.Count -gt 2){$data[2].'#text'}else{''};"
            "$code=if($data.Count -gt 6){$data[6].'#text'}else{'0x0'};"
            f"if(($path -like '*{agent_dir}*' -or $app -like '*{agent_dir}*') {event_time_check}){{"
            "$ev+=($e.TimeCreated.ToString('yyyy-MM-dd HH:mm:ss'))+'__SEP__'+$app+'__SEP__'+$path+'__SEP__'+$mod+'__SEP__'+$code"
            "}}}catch{}"
            "if($ev.Count -eq 0){'NONE'} else{$ev -join '__ROW__'}"
        )

        # App Hang events (Event ID 1002) — same time window
        ps_hang = (
            time_filter +
            "$ev=@();"
            "try{"
            "$raw=Get-WinEvent -FilterHashtable @{LogName='Application';Id=1002;StartTime=$cutoff} -ErrorAction SilentlyContinue;"
            "foreach($e in $raw){"
            "$xml=[xml]$e.ToXml();$data=$xml.Event.EventData.Data;"
            "$app=if($data.Count -gt 0){$data[0].'#text'}else{''};"
            "$path=if($data.Count -gt 1){$data[1].'#text'}else{''};"
            "$htype=if($data.Count -gt 2){$data[2].'#text'}else{''};"
            "$wait=if($data.Count -gt 3){$data[3].'#text'}else{'0'};"
            f"if(($path -like '*{agent_dir}*' -or $app -like '*{agent_dir}*') {event_time_check}){{"
            "$ev+=($e.TimeCreated.ToString('yyyy-MM-dd HH:mm:ss'))+'__SEP__'+$app+'__SEP__'+$path+'__SEP__'+$htype+'__SEP__'+$wait"
            "}}}catch{}"
            "if($ev.Count -eq 0){'NONE'} else{$ev -join '__ROW__'}"
        )

        ps_cpu = (
            f"$dir='{agent_dir}';"
            "$procs=@();"
            "Get-Process -ErrorAction SilentlyContinue"
            " | Where-Object { $_.Path -and $_.Path -like \"*$dir*\""
            f" -and [Math]::Round($_.CPU,2) -ge {cpu_threshold} }}"
            " | ForEach-Object {"
            "  $procs += $_.Name+'__SEP__'+$_.Id+'__SEP__'+[Math]::Round($_.CPU,2)+'__SEP__'+[Math]::Round($_.WorkingSet/1MB,1)+'__SEP__'+$_.Path"
            " };"
            "if($procs.Count -eq 0){'NONE'} else{$procs -join '__ROW__'}"
        )

        try:
            mh.crash_events = _parse_crash_events(_run_ps_local(ps_crash), mh.machine)
        except Exception as exc:
            log.warning("Local crash collection failed: %s", exc)

        try:
            mh.hang_events = _parse_hang_events(_run_ps_local(ps_hang), mh.machine)
        except Exception as exc:
            log.warning("Local hang collection failed: %s", exc)

        try:
            mh.high_cpu_processes = _parse_high_cpu(_run_ps_local(ps_cpu), mh.machine)
        except Exception as exc:
            log.warning("Local CPU collection failed: %s", exc)

        mh.reachable = True


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------

def _extract_remarks(payload: Any) -> str:
    """Pull the operation output/remarks out of the GOAT validate response."""
    if payload is None:
        return ""
    if isinstance(payload, str):
        return payload
    if isinstance(payload, dict):
        for key in ("remarks", "output", "result", "message", "data"):
            val = payload.get(key)
            if val:
                return str(val)
        # dig into nested operations list
        ops = payload.get("operations") or payload.get("results") or []
        if isinstance(ops, list) and ops:
            return _extract_remarks(ops[0])
    if isinstance(payload, list) and payload:
        return _extract_remarks(payload[0])
    return str(payload)


def _parse_crash_events(raw: str, machine: str) -> list[CrashEvent]:
    raw = (raw or "").strip()
    if not raw or raw.upper() == "NONE":
        return []
    events = []
    for row in raw.split(_ROW_SEP):
        cols = row.strip().split(_COL_SEP)
        if len(cols) < 2:
            continue
        events.append(CrashEvent(
            machine=machine,
            time_created=cols[0].strip() if len(cols) > 0 else "",
            process_name=cols[1].strip() if len(cols) > 1 else "",
            process_path=cols[2].strip() if len(cols) > 2 else "",
            faulting_module=cols[3].strip() if len(cols) > 3 else "",
            exception_code=cols[4].strip() if len(cols) > 4 else "0x0",
            event_id=1000,
            message="",
        ))
    return events


def _parse_high_cpu(raw: str, machine: str) -> list[HighCpuProcess]:
    raw = (raw or "").strip()
    if not raw or raw.upper() == "NONE":
        return []
    procs = []
    for row in raw.split(_ROW_SEP):
        cols = row.strip().split(_COL_SEP)
        if len(cols) < 2:
            continue
        try:
            procs.append(HighCpuProcess(
                machine=machine,
                process_name=cols[0].strip() if len(cols) > 0 else "",
                pid=int(cols[1].strip()) if len(cols) > 1 else 0,
                cpu_percent=float(cols[2].strip()) if len(cols) > 2 else 0.0,
                working_set_mb=float(cols[3].strip()) if len(cols) > 3 else 0.0,
                process_path=cols[4].strip() if len(cols) > 4 else "",
            ))
        except (ValueError, IndexError):
            continue
    return procs


def _parse_hang_events(raw: str, machine: str) -> list[AppHangEvent]:
    raw = (raw or "").strip()
    if not raw or raw.upper() == "NONE":
        return []
    hangs = []
    for row in raw.split(_ROW_SEP):
        cols = row.strip().split(_COL_SEP)
        if len(cols) < 2:
            continue
        hangs.append(AppHangEvent(
            machine=machine,
            time_created=cols[0].strip() if len(cols) > 0 else "",
            process_name=cols[1].strip() if len(cols) > 1 else "",
            process_path=cols[2].strip() if len(cols) > 2 else "",
            hang_type=cols[3].strip() if len(cols) > 3 else "",
            wait_time_ms=cols[4].strip() if len(cols) > 4 else "",
            event_id=1002,
        ))
    return hangs


def _filter_to_window(events: list, time_field: str,
                      start: Optional[datetime], end: Optional[datetime]) -> list:
    """Return only events whose time_field falls within [start, end]."""
    if not start or not end:
        return events  # no window set — return all
    result = []
    for ev in events:
        raw_time = getattr(ev, time_field, "")
        dt = _parse_dt(raw_time)
        if dt and start <= dt <= end:
            result.append(ev)
    return result


def _filter_agent_path(events: list, path_field: str, agent_dir: str) -> list:
    """Return only events whose path_field contains the agent install directory."""
    if not agent_dir:
        return events
    key = agent_dir.lower()
    result = []
    for ev in events:
        path = (getattr(ev, path_field, "") or "").lower()
        name = (getattr(ev, "process_name", "") or "").lower()
        if key in path or key in name:
            result.append(ev)
    return result


def _parse_dt(raw: str) -> Optional[datetime]:
    """Try multiple datetime formats used in QEngine summary and Event Log output."""
    if not raw:
        return None
    raw = raw.strip()
    formats = [
        "%Y-%m-%d %H:%M:%S",   # Event Log output from PowerShell
        "%d-%b-%Y %H:%M:%S",   # QEngine full format
        "%d-%b-%Y %H:%M",      # QEngine short format (no seconds)
        "%Y-%m-%dT%H:%M:%S",   # ISO 8601
        "%Y-%m-%dT%H:%M:%SZ",
        "%d/%m/%Y %H:%M:%S",
        "%m/%d/%Y %H:%M:%S",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    return None


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def _hostname_from_url(url: str) -> str:
    from urllib.parse import urlparse
    return urlparse(url).hostname or url


def _is_local(url: str) -> bool:
    from urllib.parse import urlparse
    host = (urlparse(url).hostname or "").lower()
    return host in ("localhost", "127.0.0.1", "::1", "")


def _run_ps_local(script: str) -> str:
    if sys.platform != "win32":
        return ""
    try:
        result = subprocess.run(
            ["powershell", "-NonInteractive", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
            capture_output=True, text=True, timeout=120,
        )
        return result.stdout
    except Exception as exc:
        raise RuntimeError(f"Local PowerShell execution failed: {exc}") from exc
