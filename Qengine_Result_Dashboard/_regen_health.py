"""Regenerate dashboard for a given run ID from existing report.json,
adding the new Agent Machine Health (crash + high-CPU) section.

Usage:
    python _regen_health.py [run_id]
    python _regen_health.py 4443000075913226
"""
import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from report_generator.charts import ChartFactory
from report_generator.config import Config
from report_generator.crash_analyzer import CrashAnalyzer
from report_generator.dashboard import DashboardBuilder
from report_generator.models import (
    ErrorTraceEntry,
    ExecutionReport,
    ExecutionSummary,
    FailureDetail,
    RerunInfo,
    Status,
    TestCaseResult,
)
from report_generator.report import ReportBuilder

RUN_ID = sys.argv[1] if len(sys.argv) > 1 else "4443000075913226"
OUT = Path(__file__).parent / "report_generator" / "output" / "runs" / RUN_ID

if not OUT.is_dir():
    sys.exit(f"ERROR: run directory not found: {OUT}")

# ── 1. Load existing report.json ────────────────────────────────────────────
print(f"Loading {OUT / 'report.json'} ...")
raw = json.loads((OUT / "report.json").read_text(encoding="utf-8"))
s = raw["summary"]

reruns = [RerunInfo(**r) for r in s.get("reruns", [])]
summary = ExecutionSummary(
    topic_name=s.get("topic_name", ""),
    project_name=s.get("project_name", ""),
    test_plan_name=s.get("test_plan_name", ""),
    test_suite_name=s.get("test_suite_name", ""),
    test_run_id=s.get("test_run_id", ""),
    build_number=s.get("build_number", ""),
    started_time=s.get("started_time", ""),
    end_time=s.get("end_time", ""),
    total_duration=s.get("total_duration", ""),
    environment=s.get("environment", ""),
    executed_by=s.get("executed_by", ""),
    execution_status=s.get("execution_status", ""),
    total_cases=s.get("total_cases", 0),
    passed=s.get("passed", 0),
    failed=s.get("failed", 0),
    skipped=s.get("skipped", 0),
    reruns=reruns,
)

cases = []
for c in raw.get("cases", []):
    fd = None
    if c.get("failure"):
        f = c["failure"]
        et = [ErrorTraceEntry(**e) for e in f.get("error_trace", [])]
        fd = FailureDetail(
            error_message=f.get("error_message", ""),
            exception_type=f.get("exception_type", ""),
            error_trace=et,
            stack_trace=f.get("stack_trace", ""),
            assertion_failure=f.get("assertion_failure", ""),
            browser_logs=f.get("browser_logs", []),
            screenshots=f.get("screenshots", []),
            suggested_root_cause=f.get("suggested_root_cause", ""),
        )
    cases.append(TestCaseResult(
        s_no=c.get("s_no", 0),
        name=c.get("name", ""),
        status=Status.from_raw(c.get("status", "")),
        duration_ms=c.get("duration_ms", 0),
        suite=c.get("suite", ""),
        module=c.get("module", ""),
        started_time=c.get("started_time", ""),
        end_time=c.get("end_time", ""),
        assigned_to=c.get("assigned_to", ""),
        build_number=c.get("build_number", ""),
        failure=fd,
        goat_remarks=c.get("goat_remarks", ""),
        goat_error=c.get("goat_error", ""),
    ))

report = ExecutionReport(
    summary=summary,
    cases=cases,
    source=raw.get("source", "json"),
    generated_at=datetime.now().strftime("%d-%b-%Y %H:%M:%S"),
)

print(f"Loaded: {summary.topic_name} | {summary.total_cases} cases "
      f"({summary.passed} passed, {summary.failed} failed)")

# ── 2. Collect machine health via GOAT ──────────────────────────────────────
cfg = Config(
    goat_enabled=True,
    goat_home=r"D:\GOAT",
    goat_machines=[
        {"name": "UEMS-Agent-QA",      "url": "http://10.71.29.174:9295/api"},
        {"name": "prathosh-w22-11",  "url": "http://172.24.148.221:9295/api"},
        {"name": "Prathosh-2k19",    "url": "http://10.71.28.79:9295/api"},
        {"name": "epfqa10-w25-1",    "url": "http://10.63.26.117:9295/api"},
    ],
    agent_install_dir=r"C:\Program Files (x86)\ManageEngine\UEMS_Agent",
    cpu_threshold=50.0,
    crash_hours=24,
    output=str(OUT),
)

print("\nCollecting machine health from 4 agent machines...")
print(f"  Run window: {summary.started_time} → {summary.end_time}")
report.machine_health = CrashAnalyzer(cfg).collect(
    run_start=summary.started_time,
    run_end=summary.end_time,
)
for mh in report.machine_health:
    icon = "OK" if not mh.has_issues else "!!"
    print(f"  [{icon}] {mh.machine}: reachable={mh.reachable}  "
          f"crashes={mh.crash_count}  hangs={mh.hang_count}  high_cpu={mh.high_cpu_count}")
    if mh.error:
        print(f"        error: {mh.error}")
    for ev in mh.crash_events:
        print(f"        CRASH {ev.time_created}  {ev.process_name}  {ev.exception_code}")
    for ev in mh.hang_events:
        print(f"        HANG  {ev.time_created}  {ev.process_name}  wait={ev.wait_time_ms}ms")
    for proc in mh.high_cpu_processes:
        print(f"        HIGH-CPU {proc.process_name}  {proc.cpu_percent}%  PID={proc.pid}")

# ── 3. Render outputs ────────────────────────────────────────────────────────
print("\nBuilding charts...")
charts = ChartFactory(report, with_images=True).build_all()

print("Writing dashboard.html ...")
DashboardBuilder(report, charts, self_contained=True).save(OUT)

rb = ReportBuilder(report, charts)
print("Writing report.json ...")
rb.save_json(OUT)
print("Writing execution.csv ...")
rb.save_csv(OUT)
print("Writing dashboard.pdf ...")
rb.save_pdf(OUT)

print(f"\nDone -> {OUT / 'dashboard.html'}")
print(f"Live  -> http://UEMS-Agent-QA:8089/dashboards/{RUN_ID}/dashboard.html")
