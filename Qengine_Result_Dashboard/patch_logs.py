"""Standalone script: re-attach uploaded log zips to existing dashboards.

Run from the project root:
    python patch_logs.py

Re-renders dashboard.html + updates report.json artifacts for every run
whose topic matches an uploaded-logs folder.
"""
import json
import sys
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))

from report_generator.artifacts import LogArtifact, parse_log_name
from report_generator.charts import ChartFactory
from report_generator.config import safe_name
from report_generator.dashboard import DashboardBuilder

OUTPUT_ROOT = ROOT / "report_generator" / "output" / "runs"
LOG_ROOT = ROOT / "report_generator" / "output" / "uploaded_logs"
BASE_URL = "http://prathosh-14802-t:8089/uploads"


def rebuild_report(data: dict):
    from report_generator.models import (
        ExecutionReport, ExecutionSummary, TestCaseResult,
        Status, FailureDetail, RerunInfo,
    )
    s = data.get("summary", {})
    reruns = [
        RerunInfo(
            iteration=r.get("iteration", 1),
            started_time=r.get("started_time", ""),
            terminated_time=r.get("terminated_time", ""),
            total_cases=r.get("total_cases", 0),
            passed_cases=r.get("passed_cases", 0),
            failed_cases=r.get("failed_cases", 0),
            status=r.get("status", ""),
        )
        for r in s.get("reruns", [])
    ]
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
    for i, c in enumerate(data.get("cases", []), 1):
        fd = None
        if c.get("failure"):
            f = c["failure"]
            fd = FailureDetail(
                error_message=f.get("error_message", ""),
                exception_type=f.get("exception_type", ""),
                stack_trace=f.get("stack_trace", ""),
                assertion_failure=f.get("assertion_failure", ""),
                screenshots=f.get("screenshots") or [],
            )
        cases.append(TestCaseResult(
            s_no=c.get("s_no", i),
            name=c.get("name", ""),
            status=Status.from_raw(c.get("status")),
            duration_ms=c.get("duration_ms", 0),
            suite=c.get("suite", ""),
            module=c.get("module", ""),
            started_time=c.get("started_time", ""),
            end_time=c.get("end_time", ""),
            failure=fd,
            local_screenshots=c.get("local_screenshots") or [],
        ))
    return ExecutionReport(
        summary=summary,
        cases=cases,
        source=data.get("source", "cached"),
        generated_at=data.get("generated_at", ""),
    )


def patch_run(run_dir: Path):
    rj = run_dir / "report.json"
    if not rj.is_file():
        print(f"  [skip] no report.json")
        return

    data = json.loads(rj.read_text(encoding="utf-8"))
    report = rebuild_report(data)

    topic = report.summary.topic_name
    plan = report.summary.test_plan_name
    print(f"  topic={topic!r}  plan={plan!r}")

    candidates = []
    for raw in (topic, plan):
        key = safe_name((raw or "").strip())
        if key and key not in candidates:
            candidates.append(key)

    if not candidates:
        print(f"  [skip] no candidates to match")
        return

    added = 0
    matched_folders = []
    for sub in sorted(LOG_ROOT.iterdir()):
        if not sub.is_dir():
            continue
        sub_key = sub.name.lower()
        matched = any(sub_key == c.lower() for c in candidates)
        if not matched:
            for p in list(sub.glob("*.zip")) + list(sub.glob("*.7z")):
                fname_l = p.name.lower()
                if any(
                    fname_l.startswith(c.lower() + "_") or fname_l.startswith(c.lower() + ".")
                    for c in candidates
                ):
                    matched = True
                    break
        if not matched:
            continue

        matched_folders.append(sub.name)
        base_url = f"{BASE_URL}/{sub.name}"
        existing = {a.name.lower() for a in report.log_artifacts}
        for p in sorted(sub.glob("*.zip")) + sorted(sub.glob("*.7z")):
            if p.name.lower() in existing:
                continue
            url = base_url.rstrip("/") + "/" + quote(p.name)
            kind, machine, protocol = parse_log_name(p.name)
            report.log_artifacts.append(
                LogArtifact(
                    name=p.name,
                    size_bytes=p.stat().st_size,
                    machine=machine,
                    protocol=protocol,
                    kind=kind,
                    download_url=url,
                    local_path=str(p),
                )
            )
            added += 1

    if not report.log_artifacts:
        print(f"  [skip] no matching log folders found for {candidates}")
        return

    print(f"  matched folders: {matched_folders}  added: {added}  total: {len(report.log_artifacts)}")

    charts = ChartFactory(report, with_images=False).build_all()
    DashboardBuilder(report, charts, self_contained=True).save(run_dir)
    print(f"  dashboard.html re-rendered ✓")

    data.setdefault("artifacts", {})["logs"] = [
        {
            "name": a.name, "size_bytes": a.size_bytes,
            "machine": a.machine, "protocol": a.protocol,
            "kind": a.kind, "download_url": a.download_url,
        }
        for a in report.log_artifacts
    ]
    rj.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  report.json updated ✓")


if __name__ == "__main__":
    if not OUTPUT_ROOT.is_dir():
        print(f"No runs dir: {OUTPUT_ROOT}")
        sys.exit(1)

    runs = sorted(OUTPUT_ROOT.iterdir())
    print(f"Found {len(runs)} run(s) in {OUTPUT_ROOT}")
    for run_dir in runs:
        if not run_dir.is_dir():
            continue
        print(f"\nRun: {run_dir.name}")
        try:
            patch_run(run_dir)
        except Exception as exc:
            print(f"  [ERROR] {exc}")
    print("\nDone.")
