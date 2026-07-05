"""Merge GOAT local results + collected artifacts into the parsed report.

QEngine case names and GOAT ``testcase_id``s are *not* 1:1 — a single QEngine
case typically maps to several GOAT component steps (e.g. the QEngine case
``AgentTroubleShootingTool_ConnectivityCheck`` corresponds to GOAT steps
``ATT_Success`` / ``ATT_Close``). Matching is therefore best-effort:

    1. exact (case-insensitive) id match,
    2. one contains the other,
    3. token-overlap above a threshold.

Every GOAT step that cannot be confidently matched is preserved in
``report.goat_unmatched`` so its remarks are never silently lost.
"""
from __future__ import annotations

import logging
import re
from typing import Iterable, Optional

from .artifacts import ArtifactBundle, ScreenshotArtifact
from .goat import GoatResult
from .models import ExecutionReport, FailureDetail, Status, TestCaseResult

log = logging.getLogger("report_generator.merge")

_TOKEN_RE = re.compile(r"[^a-z0-9]+")
_STOPWORDS = {"test", "case", "the", "and", "check", "verify", "windows", "win"}


def merge_goat(
    report: ExecutionReport,
    goat_results: dict[str, GoatResult],
    artifacts: Optional[ArtifactBundle] = None,
) -> ExecutionReport:
    """Attach GOAT remarks/errors and artifacts onto the report in place."""
    if goat_results:
        if not report.cases:
            # GOAT-only mode: build the case list straight from GOAT steps.
            build_cases_from_goat(report, goat_results)
        else:
            _merge_results(report, goat_results)
    if artifacts:
        _attach_artifacts(report, artifacts)
    return report


def build_cases_from_goat(report: ExecutionReport, goat: dict[str, GoatResult]) -> None:
    """Populate the report's cases directly from GOAT step results."""
    cases: list[TestCaseResult] = []
    for i, step in enumerate(goat.values(), 1):
        status = Status.from_raw(step.status)
        tc = TestCaseResult(
            s_no=i,
            name=step.testcase_id,
            status=status,
            duration_ms=step.execution_time_ms,
            goat_remarks=step.remarks,
            goat_error=step.error,
            goat_steps=[step.testcase_id],
        )
        if status is Status.FAILED:
            msg = step.error.strip()
            if not msg and step.remarks.strip():
                lines = [ln.strip() for ln in step.remarks.splitlines() if ln.strip()]
                msg = lines[-1] if lines else ""
            tc.failure = FailureDetail(error_message=msg, stack_trace=step.error)
        cases.append(tc)
    report.cases = cases
    s = report.summary
    s.total_cases = len(cases)
    s.passed = sum(1 for c in cases if c.status is Status.PASSED)
    s.failed = sum(1 for c in cases if c.status is Status.FAILED)
    s.skipped = sum(1 for c in cases if c.status is Status.SKIPPED)
    if not s.topic_name:
        s.topic_name = "GOAT Local Run"
    log.info("Built %d case(s) from GOAT results (GOAT-only mode).", len(cases))


# ---------------------------------------------------------------------------
# GOAT step → QEngine case matching
# ---------------------------------------------------------------------------
def _merge_results(report: ExecutionReport, goat: dict[str, GoatResult]) -> None:
    matched_ids: set[str] = set()
    for case in report.cases:
        steps = _match_steps(case, goat.values())
        if not steps:
            continue
        remarks_parts: list[str] = []
        error_parts: list[str] = []
        for step in steps:
            matched_ids.add(step.testcase_id)
            case.goat_steps.append(step.testcase_id)
            if step.remarks:
                remarks_parts.append(f"[{step.testcase_id}] {step.remarks.strip()}")
            if step.error:
                error_parts.append(f"[{step.testcase_id}] {step.error.strip()}")
        case.goat_remarks = "\n\n".join(remarks_parts)
        case.goat_error = "\n".join(error_parts)

        # If GOAT recorded an error but QEngine lacked failure detail, enrich it.
        if case.status is Status.FAILED:
            if case.failure is None:
                case.failure = FailureDetail()
            if not case.failure.error_message and case.goat_error:
                case.failure.error_message = case.goat_error.split("\n", 1)[0]
            if not case.failure.stack_trace and case.goat_error:
                case.failure.stack_trace = case.goat_error

    report.goat_unmatched = [
        g for tcid, g in goat.items() if tcid not in matched_ids
    ]
    log.info(
        "GOAT merge: matched steps to %d case(s); %d step(s) unmatched.",
        sum(1 for c in report.cases if c.goat_steps),
        len(report.goat_unmatched),
    )


def _match_steps(case: TestCaseResult, steps: Iterable[GoatResult]) -> list[GoatResult]:
    """Confidently match GOAT steps to a QEngine case.

    Conservative on purpose — a false match pollutes a case with the wrong
    remarks, whereas an unmatched step is still surfaced in the appendix.
    """
    case_norm = _normalise(case.name)
    case_tokens = _tokens(case.name)
    exact: list[GoatResult] = []
    contains: list[GoatResult] = []
    fuzzy: list[GoatResult] = []
    for step in steps:
        step_norm = _normalise(step.testcase_id)
        if not step_norm:
            continue
        if step_norm == case_norm:
            exact.append(step)
            continue
        # Containment, but only when the shorter side is substantial (>=5 chars)
        # to avoid e.g. "login" matching everything.
        shorter = min(step_norm, case_norm, key=len)
        if len(shorter) >= 5 and (step_norm in case_norm or case_norm in step_norm):
            contains.append(step)
            continue
        # Fuzzy: require at least TWO shared meaningful tokens AND high overlap,
        # so a single common token (e.g. "installation") never matches.
        shared = case_tokens & _tokens(step.testcase_id)
        if len(shared) >= 2 and _token_overlap(case_tokens, _tokens(step.testcase_id)) >= 0.6:
            fuzzy.append(step)
    return exact or contains or fuzzy


def _attach_artifacts(report: ExecutionReport, bundle: ArtifactBundle) -> None:
    report.log_artifacts = list(bundle.logs)

    # Screenshots are only meaningful for GUI cases. The NativeGUI folder is
    # global + timestamped (may hold stale shots from other runs), so we ONLY
    # keep a screenshot when its filename strongly correlates to a failed
    # case's name. Unmatched screenshots are dropped (not shown anywhere).
    failed = report.failed_cases
    kept: list[ScreenshotArtifact] = []
    for shot in bundle.screenshots:
        target = _screenshot_target(shot, failed)
        if target is None:
            continue
        kept.append(shot)
        if shot.data_uri:
            target.local_screenshots.append(shot.data_uri)
        elif shot.download_url:
            if target.failure is None:
                target.failure = FailureDetail()
            target.failure.screenshots.append(shot.download_url)
    report.screenshot_artifacts = kept


def _screenshot_target(
    shot: ScreenshotArtifact, failed: list[TestCaseResult]
) -> Optional[TestCaseResult]:
    """Match a screenshot to a failed case only on a strong name correlation.

    No "attach to the only failure" fallback — that wrongly pinned GUI shots
    onto non-GUI failures. Requires a shared alphanumeric run of >= 6 chars
    between the screenshot's description and the case name.
    """
    hint = _normalise(shot.case_hint)
    if not hint:
        return None
    for case in failed:
        if _longest_common_substring(hint, _normalise(case.name)) >= 6:
            return case
    return None


def _longest_common_substring(a: str, b: str) -> int:
    """Length of the longest common substring of two strings."""
    if not a or not b:
        return 0
    prev = [0] * (len(b) + 1)
    best = 0
    for i in range(1, len(a) + 1):
        cur = [0] * (len(b) + 1)
        for j in range(1, len(b) + 1):
            if a[i - 1] == b[j - 1]:
                cur[j] = prev[j - 1] + 1
                best = max(best, cur[j])
        prev = cur
    return best


# ---------------------------------------------------------------------------
# text helpers
# ---------------------------------------------------------------------------
def _normalise(text: str) -> str:
    return _TOKEN_RE.sub("", (text or "").lower())


def _tokens(text: str) -> set[str]:
    raw = _TOKEN_RE.split((text or "").lower())
    return {t for t in raw if t and t not in _STOPWORDS and len(t) > 2}


def _token_overlap(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(min(a, b, key=len))
