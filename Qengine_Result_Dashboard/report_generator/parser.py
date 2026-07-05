"""Transform raw QEngine payloads into normalised models.

The parser is intentionally defensive: QEngine payloads vary between source
types and execution kinds, so every field access is guarded and missing data
degrades gracefully instead of raising.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Optional

from .models import (
    ErrorTraceEntry,
    ExecutionReport,
    ExecutionSummary,
    FailureDetail,
    RerunInfo,
    Status,
    TestCaseResult,
)

log = logging.getLogger("report_generator.parser")

_EXCEPTION_TYPE_MAP = {
    "1": "Assertion / Verification Failure",
    "2": "Element Not Found",
    "3": "Timeout",
    "4": "Script Error",
    "0": "Unknown",
}

_DATE_FMT = "%d-%b-%Y %H:%M"


class ResultParser:
    """Parse a :class:`RawBundle` into an :class:`ExecutionReport`."""

    def __init__(self, bundle: dict[str, Any], generated_at: str = "") -> None:
        self.bundle = bundle
        self.generated_at = generated_at

    # -- public -------------------------------------------------------------
    def parse(self) -> ExecutionReport:
        summary = self._parse_summary()
        cases = self._parse_cases()
        # Recompute counts from cases when the summary looks empty / inconsistent.
        self._reconcile_counts(summary, cases)
        report = ExecutionReport(
            summary=summary,
            cases=cases,
            source=str(self.bundle.get("source", "unknown")),
            generated_at=self.generated_at,
        )
        log.info(
            "Parsed %d cases — %d passed, %d failed, %d skipped.",
            len(cases),
            summary.passed,
            summary.failed,
            summary.skipped,
        )
        return report

    # -- summary ------------------------------------------------------------
    def _parse_summary(self) -> ExecutionSummary:
        env = (self.bundle.get("environment") or {}).get("executedenvironment", {})
        if not env:
            # v1: environment is nested inside each case result.
            cases = self.bundle.get("cases") or []
            if cases and isinstance(cases[0], dict):
                env = dict(cases[0].get("executedenvironment", {}))
                env.setdefault("execution_id", self.bundle.get("execution_id", ""))
        stats = (self.bundle.get("stats") or {}).get("testcaseresults", {})
        schedule = self._schedule_block()

        environment_str = self._format_environment(env)

        # Timing: prefer explicit env times; else derive from the case list.
        start, end, derived_dur = self._derive_timing_from_cases()
        started_time = env.get("started_time") or start
        end_time = env.get("terminated_time") or end
        duration = (
            stats.get("total_duration")
            or stats.get("total_automation_duration")
            or self._derive_duration(env)
            or derived_dur
        )

        suites = self._collect_suite_names()

        tp_name = (
            schedule.get("name")
            or schedule.get("test_plan_name")
            or schedule.get("testplan_name", "")
        )
        summary = ExecutionSummary(
            topic_name=(
                schedule.get("environmentvariables_name")
                or schedule.get("variablesName")
                or schedule.get("variables")
                or schedule.get("topic")
                or env.get("execution_name", "")
                or tp_name
            ),
            project_name=schedule.get("project_name", ""),
            test_plan_name=tp_name,
            test_suite_name=", ".join(suites),
            test_run_id=str(
                self.bundle.get("execution_id")
                or env.get("execution_id")
                or self.bundle.get("env_id")
                or ""
            ),
            build_number=self._first_build_number(),
            started_time=started_time,
            end_time=end_time,
            total_duration=duration or "",
            environment=environment_str,
            executed_by=schedule.get("started_by")
            or schedule.get("executed_by")
            or schedule.get("addedUser")
            or schedule.get("modifiedUser", ""),
            execution_status=str(env.get("execution_status") or env.get("status") or ""),
            total_cases=int(stats.get("case_results_count") or env.get("total_cases") or 0),
            passed=int(stats.get("passed_cases") or env.get("passed_cases") or 0),
            failed=int(stats.get("failed_cases") or env.get("failed_cases") or 0),
            skipped=int(stats.get("inactive_cases") or env.get("inactive_cases") or 0),
            reruns=self._parse_reruns(),
        )
        return summary

    def _schedule_block(self) -> dict[str, Any]:
        """Merge test-plan metadata with schedule-execution detail.

        Test plan gives ``name`` / ``addedUser``; schedule execution gives the
        Topic (``environmentvariables_name``) and run timing.
        """
        block: dict[str, Any] = {}
        tp = self.bundle.get("testplan")
        if isinstance(tp, dict):
            inner = tp.get("testplan") if isinstance(tp.get("testplan"), dict) else tp
            if isinstance(inner, dict):
                block.update(inner)

        se_raw = self.bundle.get("schedule_execution")
        if isinstance(se_raw, dict):
            se = se_raw.get("scheduleexecution", se_raw)
            if isinstance(se, dict):
                # Topic + run name/timing win over plan-level values.
                for k in ("environmentvariables_name", "started_time", "end_time"):
                    if se.get(k):
                        block[k] = se[k]
                block.setdefault("name", se.get("name", block.get("name", "")))

        # Legacy / HAR schedule envelope.
        sched = self.bundle.get("schedule")
        if isinstance(sched, dict) and not block:
            for key in ("scheduleexecution", "scheduleexecutions", "execution"):
                if isinstance(sched.get(key), dict):
                    return sched[key]
            return sched
        return block

    def _derive_timing_from_cases(self) -> tuple[str, str, str]:
        """Return (started, ended, duration) derived from case added_time."""
        cases = self.bundle.get("cases") or []
        starts: list[datetime] = []
        ends: list[datetime] = []
        for c in cases:
            end_raw = c.get("added_time")
            if not end_raw:
                continue
            try:
                end_dt = datetime.strptime(end_raw, _DATE_FMT)
            except ValueError:
                continue
            ends.append(end_dt)
            dur = int(c.get("duration") or 0)
            starts.append(end_dt - timedelta(milliseconds=dur))
        if not ends:
            return "", "", ""
        start_dt, end_dt = min(starts), max(ends)
        total = int((end_dt - start_dt).total_seconds())
        h, rem = divmod(max(total, 0), 3600)
        m, s = divmod(rem, 60)
        return (
            start_dt.strftime(_DATE_FMT),
            end_dt.strftime(_DATE_FMT),
            f"{h:02d}h {m:02d}m {s:02d}s",
        )

    def _parse_reruns(self) -> list[RerunInfo]:
        # v1: rerun iterations come from the schedule-execution detail.
        envs = (self.bundle.get("environments") or {}).get("executedenvironments", [])
        se_raw = self.bundle.get("schedule_execution")
        if isinstance(se_raw, dict):
            se = se_raw.get("scheduleexecution", se_raw)
            if isinstance(se, dict) and se.get("executed_environments"):
                envs = se["executed_environments"]
        reruns: list[RerunInfo] = []
        for root in envs:
            details = root.get("rerunDetails") or []
            for det in details:
                reruns.append(
                    RerunInfo(
                        iteration=int(det.get("iteration", 0)),
                        started_time=det.get("started_time", ""),
                        terminated_time=det.get("terminated_time", ""),
                        total_cases=int(det.get("total_cases", 0)),
                        passed_cases=int(det.get("passed_cases", 0)),
                        failed_cases=int(det.get("failed_cases", 0)),
                        status=str(det.get("status", "")),
                    )
                )
        reruns.sort(key=lambda r: r.iteration)
        return reruns

    # -- cases --------------------------------------------------------------
    def _parse_cases(self) -> list[TestCaseResult]:
        raw_cases = self.bundle.get("cases") or []
        details = self.bundle.get("details") or {}
        cases: list[TestCaseResult] = []
        for i, raw in enumerate(raw_cases, 1):
            crid = str(raw.get("id") or raw.get("case_result_id") or "")
            status = Status.from_raw(raw.get("result"))
            duration_ms = int(raw.get("duration") or 0)
            end_time = raw.get("added_time", "")
            tc = TestCaseResult(
                s_no=int(raw.get("order") or i),
                name=raw.get("name", f"Case {i}"),
                status=status,
                duration_ms=duration_ms,
                suite=raw.get("suite_name", "") or "",
                module=raw.get("module_name") or raw.get("module", "") or "",
                started_time=self._derive_started(end_time, duration_ms),
                end_time=end_time,
                assigned_to=raw.get("assigned_to", "") or "",
                build_number=str(raw.get("codeversion_id", "") or ""),
                case_result_id=crid,
                is_self_healed=bool(raw.get("is_self_healed")),
            )
            # Attach failure / data-driven detail when we fetched it.
            record = details.get(crid)
            if record:
                self._enrich_case(tc, record)
            if tc.status is Status.FAILED and tc.failure is None:
                tc.failure = FailureDetail(error_message="Test case failed (no detail captured).")
            cases.append(tc)
        cases.sort(key=lambda c: c.s_no)
        return cases

    def _enrich_case(self, tc: TestCaseResult, record: dict[str, Any]) -> None:
        detail = (record.get("detail") or {}).get("testcaseresult", {})
        if detail:
            tc.is_data_driven = bool(detail.get("testcaseresult_datadriven"))
            tc.datadriven_total = int(detail.get("testcaseresult_datadriven_totalcases", 0) or 0)
            tc.datadriven_passed = int(detail.get("testcaseresult_datadriven_passedcases", 0) or 0)
            tc.datadriven_failed = int(detail.get("testcaseresult_datadriven_failedcases", 0) or 0)

        failure = FailureDetail()
        found = False

        # Aggregate failure data from child component results (data-driven).
        for child_payload in record.get("children", []):
            child = child_payload.get("testcaseresult", {})
            if str(child.get("result", "")).lower() not in {"failed", "fail"}:
                # Still harvest screenshots from passed children if desired? No.
                self._collect_screenshots(child, failure)
                continue
            found = True
            self._merge_failure(child, failure)

        # If no failing child but the parent itself carries error info.
        parent = (record.get("detail") or {}).get("testcaseresult", {})
        if not found and parent.get("error_message"):
            self._merge_failure(parent, failure)
            found = True

        if found or failure.has_data:
            failure.suggested_root_cause = self._suggest_root_cause(failure)
            tc.failure = failure

    def _merge_failure(self, node: dict[str, Any], failure: FailureDetail) -> None:
        err = node.get("error_message") or {}
        if isinstance(err, dict) and err.get("message") and not failure.error_message:
            failure.error_message = str(err.get("message", "")).strip()
            failure.assertion_failure = str(err.get("params", "")).strip()
        failure.exception_type = (
            failure.exception_type
            or self._map_exception(node.get("exception_type"))
            or (err.get("type", "") if isinstance(err, dict) else "")
        )
        # Error trace frames.
        for frame in node.get("error_trace", []) or []:
            entry = ErrorTraceEntry(
                method=str(frame.get("method") or frame.get("method_name") or ""),
                line_no=frame.get("line_no"),
                type=str(frame.get("type", "")),
                message=str(frame.get("message", "")).strip(),
                params=str(frame.get("params", "")),
            )
            failure.error_trace.append(entry)
        if failure.error_trace and not failure.stack_trace:
            failure.stack_trace = "\n".join(e.as_line() for e in failure.error_trace)
        # Browser logs.
        for line in node.get("browser_log", []) or []:
            failure.browser_logs.append(str(line))
        self._collect_screenshots(node, failure)

    @staticmethod
    def _collect_screenshots(node: dict[str, Any], failure: FailureDetail) -> None:
        for stmt in node.get("statementresult", []) or []:
            shot = stmt.get("screenshot")
            if shot and isinstance(shot, str) and shot.startswith("http"):
                if shot not in failure.screenshots:
                    failure.screenshots.append(shot)

    # -- derivations / formatting ------------------------------------------
    @staticmethod
    def _map_exception(raw: Any) -> str:
        if raw in (None, ""):
            return ""
        return _EXCEPTION_TYPE_MAP.get(str(raw), f"Type {raw}")

    @staticmethod
    def _suggest_root_cause(failure: FailureDetail) -> str:
        text = " ".join(
            [failure.error_message, failure.exception_type, failure.stack_trace]
        ).lower()
        rules = [
            ("timeout", "Operation timed out — verify environment availability / increase wait."),
            ("element", "UI element not found — locator may have changed; check self-healing."),
            ("connect", "Connectivity issue — verify the target service/agent is reachable."),
            ("assert", "Assertion failed — actual result did not match the expected value."),
            ("null", "Null/empty value encountered — check upstream data setup."),
            ("permission", "Permission/auth error — verify credentials and access rights."),
        ]
        for needle, advice in rules:
            if needle in text:
                return advice
        if failure.error_message:
            return "Review the error message and stack trace for the failing step."
        return ""

    @staticmethod
    def _derive_started(end_time: str, duration_ms: int) -> str:
        if not end_time or not duration_ms:
            return end_time
        try:
            end = datetime.strptime(end_time, _DATE_FMT)
            start = end - timedelta(milliseconds=duration_ms)
            return start.strftime(_DATE_FMT)
        except ValueError:
            return end_time

    @staticmethod
    def _format_environment(env: dict[str, Any]) -> str:
        parts = []
        browser = env.get("browser")
        if browser:
            ver = env.get("browser_version")
            parts.append(f"{browser.title()}{' ' + str(ver) if ver else ''}")
        if env.get("os"):
            parts.append(str(env["os"]).title())
        if env.get("resolution"):
            parts.append(str(env["resolution"]))
        if env.get("execution_framework"):
            parts.append(str(env["execution_framework"]))
        if env.get("is_headless"):
            parts.append("Headless")
        return " · ".join(parts)

    @staticmethod
    def _derive_duration(env: dict[str, Any]) -> str:
        start, end = env.get("started_time"), env.get("terminated_time")
        if not (start and end):
            return ""
        try:
            delta = datetime.strptime(end, _DATE_FMT) - datetime.strptime(start, _DATE_FMT)
            total = int(delta.total_seconds())
            h, rem = divmod(total, 3600)
            m, s = divmod(rem, 60)
            return f"{h:02d}h {m:02d}m {s:02d}s"
        except ValueError:
            return ""

    def _collect_suite_names(self) -> list[str]:
        names: list[str] = []
        for raw in self.bundle.get("cases") or []:
            name = raw.get("suite_name")
            if name and name not in names:
                names.append(name)
        return names

    def _first_build_number(self) -> str:
        for raw in self.bundle.get("cases") or []:
            cv = raw.get("codeversion_id")
            if cv:
                return str(cv)
        return ""

    @staticmethod
    def _reconcile_counts(summary: ExecutionSummary, cases: list[TestCaseResult]) -> None:
        if not cases:
            return
        passed = sum(1 for c in cases if c.status is Status.PASSED)
        failed = sum(1 for c in cases if c.status is Status.FAILED)
        skipped = sum(1 for c in cases if c.status is Status.SKIPPED)
        if summary.total_cases == 0:
            summary.total_cases = len(cases)
        # Trust the case-level counts when they disagree with empty summary data.
        if summary.passed == 0 and summary.failed == 0:
            summary.passed, summary.failed, summary.skipped = passed, failed, skipped
