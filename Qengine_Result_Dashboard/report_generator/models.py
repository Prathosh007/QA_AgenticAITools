"""Normalised, source-agnostic data models for a QEngine execution result.

Every data source (OAuth, cookie, HAR) is parsed into these models so the
dashboard / report / export layers never have to know where the data came from.
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any, Optional


class Status(str, Enum):
    """Canonical test-case status with UI colour mapping."""

    PASSED = "Passed"
    FAILED = "Failed"
    SKIPPED = "Skipped"
    UNKNOWN = "Unknown"

    @classmethod
    def from_raw(cls, raw: Optional[str]) -> "Status":
        """Map a QEngine ``result`` string onto a canonical status."""
        if not raw:
            return cls.UNKNOWN
        value = str(raw).strip().lower()
        if value in {"passed", "pass", "success", "successful"}:
            return cls.PASSED
        if value in {"failed", "fail", "failure", "error"}:
            return cls.FAILED
        if value in {"skipped", "skip", "inactive", "not executed", "notexecuted"}:
            return cls.SKIPPED
        return cls.UNKNOWN

    @property
    def color(self) -> str:
        """Bootstrap/CSS colour token for this status."""
        return {
            Status.PASSED: "#198754",
            Status.FAILED: "#dc3545",
            Status.SKIPPED: "#ffc107",
            Status.UNKNOWN: "#6c757d",
        }[self]

    @property
    def badge(self) -> str:
        """Bootstrap badge class for this status."""
        return {
            Status.PASSED: "bg-success",
            Status.FAILED: "bg-danger",
            Status.SKIPPED: "bg-warning text-dark",
            Status.UNKNOWN: "bg-secondary",
        }[self]


@dataclass
class ErrorTraceEntry:
    """A single frame of a QEngine error trace."""

    method: str = ""
    line_no: Optional[int] = None
    type: str = ""
    message: str = ""
    params: str = ""

    def as_line(self) -> str:
        loc = f":{self.line_no}" if self.line_no is not None else ""
        kind = f"[{self.type}] " if self.type else ""
        return f"{kind}{self.method}{loc} {self.message}".strip()


@dataclass
class FailureDetail:
    """Rich failure information for a failed (or partially failed) test case."""

    error_message: str = ""
    exception_type: str = ""
    error_trace: list[ErrorTraceEntry] = field(default_factory=list)
    stack_trace: str = ""
    assertion_failure: str = ""
    browser_logs: list[str] = field(default_factory=list)
    screenshots: list[str] = field(default_factory=list)
    suggested_root_cause: str = ""

    @property
    def has_data(self) -> bool:
        return bool(
            self.error_message
            or self.exception_type
            or self.error_trace
            or self.stack_trace
            or self.screenshots
        )


@dataclass
class TestCaseResult:
    """A single executed test case (normalised)."""

    s_no: int
    name: str
    status: Status
    duration_ms: int = 0
    suite: str = ""
    module: str = ""
    started_time: str = ""
    end_time: str = ""
    assigned_to: str = ""
    build_number: str = ""
    case_result_id: str = ""
    is_self_healed: bool = False
    is_data_driven: bool = False
    datadriven_total: int = 0
    datadriven_passed: int = 0
    datadriven_failed: int = 0
    failure: Optional[FailureDetail] = None

    # GOAT enrichment (merged from local test_status results).
    goat_remarks: str = ""
    goat_error: str = ""
    goat_steps: list[str] = field(default_factory=list)
    # Screenshots collected from the GOAT machine, embedded inline.
    local_screenshots: list[str] = field(default_factory=list)

    @property
    def duration_human(self) -> str:
        return format_duration_ms(self.duration_ms)

    @property
    def failure_reason(self) -> str:
        if self.failure and self.failure.error_message:
            return self.failure.error_message.strip()
        return ""

    @property
    def screenshot(self) -> str:
        if self.failure and self.failure.screenshots:
            return self.failure.screenshots[-1]
        return ""

    @property
    def error_remarks(self) -> str:
        """QEngine-only error remark (assertion params from the error_message)."""
        if self.failure and self.failure.assertion_failure:
            return self.failure.assertion_failure.strip()
        return ""

    def to_row(self) -> dict[str, Any]:
        """Flat dict used for the detailed table and CSV/Excel export."""
        return {
            "S.No": self.s_no,
            "Test Case Name": self.name,
            "Module": self.module or "-",
            "Suite": self.suite or "-",
            "Status": self.status.value,
            "Duration": self.duration_human,
            "Started Time": self.started_time or "-",
            "End Time": self.end_time or "-",
            "Failure Reason": self.failure_reason or "-",
            "Error Remarks": self.error_remarks or "-",
            "Exception Type": (self.failure.exception_type if self.failure else "") or "-",
            "Screenshot Link": self.screenshot or "-",
        }


@dataclass
class RerunInfo:
    """A single rerun iteration of the execution."""

    iteration: int
    started_time: str
    terminated_time: str
    total_cases: int
    passed_cases: int
    failed_cases: int
    status: str


@dataclass
class ExecutionSummary:
    """Top-level execution metadata shown in the dashboard summary cards."""

    topic_name: str = ""
    project_name: str = ""
    test_plan_name: str = ""
    test_suite_name: str = ""
    test_run_id: str = ""
    build_number: str = ""
    started_time: str = ""
    end_time: str = ""
    total_duration: str = ""
    environment: str = ""
    executed_by: str = ""
    execution_status: str = ""
    total_cases: int = 0
    passed: int = 0
    failed: int = 0
    skipped: int = 0
    reruns: list[RerunInfo] = field(default_factory=list)

    @property
    def pass_percentage(self) -> float:
        return round(self.passed / self.total_cases * 100, 2) if self.total_cases else 0.0

    @property
    def fail_percentage(self) -> float:
        return round(self.failed / self.total_cases * 100, 2) if self.total_cases else 0.0


@dataclass
class ExecutionReport:
    """The complete normalised report passed to all output generators."""

    summary: ExecutionSummary
    cases: list[TestCaseResult] = field(default_factory=list)
    source: str = "unknown"
    generated_at: str = ""
    # Collected artifacts (populated by the GOAT integration).
    log_artifacts: list[Any] = field(default_factory=list)
    screenshot_artifacts: list[Any] = field(default_factory=list)
    goat_unmatched: list[Any] = field(default_factory=list)

    @property
    def failed_cases(self) -> list[TestCaseResult]:
        return [c for c in self.cases if c.status is Status.FAILED]

    @property
    def passed_cases(self) -> list[TestCaseResult]:
        return [c for c in self.cases if c.status is Status.PASSED]

    @property
    def skipped_cases(self) -> list[TestCaseResult]:
        return [c for c in self.cases if c.status is Status.SKIPPED]

    def logs_by_machine(self) -> list[dict[str, Any]]:
        """Group log artifacts into rows: machine · protocol · agent · ds · server."""
        rows: dict[tuple, dict[str, Any]] = {}
        for a in self.log_artifacts:
            key = (a.machine or "unknown", getattr(a, "protocol", "") or "")
            row = rows.setdefault(
                key, {"machine": key[0], "protocol": key[1], "agent": None, "ds": None, "server": None}
            )
            kind = (getattr(a, "kind", "Agent") or "Agent").strip()
            if kind == "DS":
                row["ds"] = a
            elif kind == "Server":
                row["server"] = a
            else:
                row["agent"] = a
        return sorted(rows.values(), key=lambda r: (r["machine"], r["protocol"]))

    def conclusion(self) -> str:
        """Human-readable executive conclusion sentence."""
        s = self.summary
        verdict = "successfully" if s.failed == 0 else "with failures"
        sentence = (
            f"Out of {s.total_cases} executed test cases, {s.passed} passed and "
            f"{s.failed} failed"
        )
        if s.skipped:
            sentence += f" ({s.skipped} skipped)"
        sentence += (
            f". Overall execution completed {verdict} with a "
            f"{s.pass_percentage}% pass rate."
        )
        if s.failed:
            sentence += " Detailed failure analysis is included below."
        return sentence

    def to_dict(self) -> dict[str, Any]:
        """Serialise the whole report to a JSON-friendly dict."""
        return {
            "source": self.source,
            "generated_at": self.generated_at,
            "summary": {
                **asdict(self.summary),
                "pass_percentage": self.summary.pass_percentage,
                "fail_percentage": self.summary.fail_percentage,
            },
            "conclusion": self.conclusion(),
            "artifacts": {
                "logs": [_artifact_dict(a) for a in self.log_artifacts],
                "screenshots": [
                    {k: v for k, v in _artifact_dict(a).items() if k != "data_uri"}
                    for a in self.screenshot_artifacts
                ],
            },
            "cases": [
                {
                    **{k: v for k, v in asdict(c).items() if k not in {"status", "failure"}},
                    "status": c.status.value,
                    "duration_human": c.duration_human,
                    "failure": asdict(c.failure) if c.failure else None,
                }
                for c in self.cases
            ],
        }

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent, ensure_ascii=False)


def _artifact_dict(artifact: Any) -> dict[str, Any]:
    """Serialise a LogArtifact / ScreenshotArtifact dataclass to a dict."""
    if hasattr(artifact, "__dataclass_fields__"):
        return asdict(artifact)
    if isinstance(artifact, dict):
        return artifact
    return {"value": str(artifact)}


def format_duration_ms(ms: int) -> str:
    """Format a millisecond duration as ``HHh MMm SSs``."""
    try:
        total_seconds = int(ms) // 1000
    except (TypeError, ValueError):
        return "00h 00m 00s"
    hours, rem = divmod(total_seconds, 3600)
    minutes, seconds = divmod(rem, 60)
    return f"{hours:02d}h {minutes:02d}m {seconds:02d}s"
