"""Data-acquisition orchestrator (official QEngine v1 API, OAuth-only).

Source preference:
    1. OAuthClient — official ``/api/v1/uems`` API with a Zoho OAuth token
       (refresh-token flow from ``.env``). This is the only live source.
    2. HarClient   — offline HAR capture (testing / air-gapped).

The v1 API is keyed on ``executedenvironment_id`` (the run). There is no public
TestPlan→run listing endpoint, so the run id must be supplied by the caller
(the QEngine final test case has it in context, or a webhook provides it).
The optional ``testplan_id`` enriches header metadata (Topic, suites, users).
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from .clients import AuthError, HarClient, OAuthClient, QEngineError
from .config import Config

log = logging.getLogger("report_generator.api")

_FAILED = {"failed", "fail", "error"}


class RawBundle(dict):
    """Raw payloads keyed by logical name."""


class QEngineService:
    """High-level data acquisition over an auto-selected client."""

    def __init__(self, config: Config) -> None:
        self.config = config
        self.client: Any = None
        self.source: str = "unknown"

    # -- client selection ---------------------------------------------------
    def _build_client(self) -> Any:
        cfg = self.config
        if cfg.har_file:
            log.info("Using offline HAR source: %s", cfg.har_file)
            client = HarClient(cfg.har_file, cfg.project_id, cfg.env_id)
            cfg.project_id = cfg.project_id or client.project_id
            cfg.env_id = cfg.env_id or client.env_id
            self.source = "har"
            return client

        log.info("Using official QEngine v1 API (OAuth).")
        client = OAuthClient(
            cfg.host,
            cfg.project_id,
            api_base=cfg.api_base or "",
            timeout=cfg.timeout,
            retries=cfg.retries,
            backoff=cfg.backoff,
            page_size=cfg.page_size,
        )
        self.source = "oauth"
        return client

    # -- acquisition --------------------------------------------------------
    def fetch(self, fetch_all_details: bool = False) -> RawBundle:
        self.client = self._build_client()
        if self.source == "har":
            return self._fetch_har(fetch_all_details)
        return self._fetch_v1(fetch_all_details)

    # -- v1 (official API) --------------------------------------------------
    def _fetch_v1(self, fetch_all_details: bool) -> RawBundle:
        cfg = self.config
        bundle = RawBundle(source="oauth", api_version="v1")

        # Resolve the env id (and Topic / plan / reruns) from the run id.
        sched_exec = None
        if cfg.run_id:
            log.info("[1/4] Resolving run %s (scheduleexecutions) …", cfg.run_id)
            sched_exec = self._safe(lambda: self.client.get_schedule_execution(cfg.run_id))
            if sched_exec:
                resolved = self._select_env_from_schedule(sched_exec)
                if resolved and not cfg.env_id:
                    cfg.env_id = resolved
                    log.info("  resolved env_id=%s", resolved)
                if not cfg.testplan_id:
                    cfg.testplan_id = str(
                        sched_exec.get("scheduleexecution", {}).get("schedule_id", "")
                    )
        if not cfg.env_id:
            raise QEngineError(
                "Could not determine an executedenvironment_id. Pass --env-id, "
                "--run-id (scheduleexecutions_id), or a result URL."
            )

        log.info("[2/4] Fetching case list for env %s …", cfg.env_id)
        bundle["cases"] = self._page_cases_v1(cfg.env_id)
        log.info("  %d cases.", len(bundle["cases"]))

        if cfg.testplan_id:
            log.info("[3/4] Fetching test plan %s …", cfg.testplan_id)
            bundle["testplan"] = self._safe(lambda: self.client.get_testplan(cfg.testplan_id))
        else:
            bundle["testplan"] = None

        log.info("[4/4] Fetching failure details …")
        bundle["details"] = self._fetch_details_v1(bundle["cases"], fetch_all_details)
        bundle["env_id"] = cfg.env_id
        bundle["execution_id"] = self._derive_execution_id(bundle)

        # If we have the run id but didn't fetch the schedule execution yet
        # (env_id supplied directly), fetch it now to enrich Topic + reruns.
        if sched_exec is None and bundle["execution_id"]:
            sched_exec = self._safe(
                lambda: self.client.get_schedule_execution(bundle["execution_id"])
            )
        bundle["schedule_execution"] = sched_exec
        return bundle

    @staticmethod
    def _select_env_from_schedule(sched_exec: dict) -> str:
        """Pick the executedenvironment_id that holds the case list.

        The case list lives on a rerun *iteration* (the root env returns none).
        Choose the iteration with the most cases (the main run); fall back to
        the executed_environments id.
        """
        se = sched_exec.get("scheduleexecution", sched_exec)
        envs = se.get("executed_environments") or []
        best_id, best_cases = "", -1
        for env in envs:
            for it in env.get("rerunDetails") or []:
                tc = int(it.get("total_cases", 0) or 0)
                if tc > best_cases:
                    best_cases, best_id = tc, str(it.get("id") or "")
            if not env.get("rerunDetails") and not best_id:
                best_id = str(env.get("id") or "")
        return best_id

    def _page_cases_v1(self, env_id: str) -> list[dict[str, Any]]:
        all_cases: list[dict[str, Any]] = []
        start = 1
        total: Optional[int] = None
        guard = 0
        while True:
            guard += 1
            if guard > 1000:
                break
            payload = self.client.get_case_list_page(env_id, start)
            total = (payload.get("meta") or {}).get("total_cases", total)
            page = payload.get("testcaseresults") or []
            if not page:
                break
            all_cases.extend(page)
            if total is not None and len(all_cases) >= total:
                break
            if len(page) < self.page_or_default():
                # The API returned everything in one shot.
                if total is None or len(all_cases) >= (total or 0):
                    break
            start = len(all_cases) + 1
        return all_cases

    def page_or_default(self) -> int:
        return self.config.page_size or 100

    def _fetch_details_v1(
        self, cases: list[dict[str, Any]], fetch_all: bool
    ) -> dict[str, dict[str, Any]]:
        details: dict[str, dict[str, Any]] = {}
        targets = [
            c for c in cases
            if fetch_all or str(c.get("result", "")).lower() in _FAILED
        ]
        log.info("Fetching detail for %d case(s) …", len(targets))
        for case in targets:
            crid = str(case.get("id") or "")
            if not crid:
                continue
            detail = self._safe(lambda: self.client.get_case_detail(crid))
            if not detail:
                continue
            record = {"detail": detail, "children": []}
            tcr = detail.get("testcaseresult", {})
            for child in tcr.get("testcaseresult_datadriven", []) or []:
                child_id = str(child.get("component_id") or child.get("id") or "")
                # Only fetch the failing child(ren) for screenshots/traces.
                if not child_id:
                    continue
                if (
                    not fetch_all
                    and str(child.get("result", "")).lower() not in _FAILED
                ):
                    continue
                cdet = self._safe(lambda: self.client.get_child_detail(child_id))
                if cdet:
                    record["children"].append(cdet)
            # Non-data-driven failed case: detail itself may be the child.
            if not record["children"] and tcr.get("error_trace"):
                record["children"].append(detail)
            details[crid] = record
        return details

    @staticmethod
    def _derive_execution_id(bundle: RawBundle) -> str:
        for rec in (bundle.get("details") or {}).values():
            tcr = (rec.get("detail") or {}).get("testcaseresult", {})
            ee = tcr.get("scheduleexecutions_id")
            if ee:
                return str(ee)
        for c in bundle.get("cases", []):
            ee = c.get("scheduleexecutions_id") or c.get("execution_id")
            if ee:
                return str(ee)
        return ""

    # -- HAR (offline) ------------------------------------------------------
    def _fetch_har(self, fetch_all_details: bool) -> RawBundle:
        cfg = self.config
        bundle = RawBundle(source="har", api_version="internal")
        bundle["environment"] = self.client.get_environment_basic(cfg.env_id)
        execution_id = (bundle["environment"].get("executedenvironment", {})
                        .get("execution_id", ""))
        bundle["execution_id"] = execution_id
        bundle["environments"] = self._safe(
            lambda: self.client.get_environments_for_execution(execution_id)
        )
        bundle["stats"] = self._safe(lambda: self.client.get_case_stats(cfg.env_id))
        payload = self.client.get_case_list(cfg.env_id, 1, cfg.page_size)
        block = payload.get("testcaseresults", payload)
        bundle["cases"] = block if isinstance(block, list) else []
        bundle["testplan"] = None
        # Details from HAR mirror the old structure.
        details: dict[str, dict[str, Any]] = {}
        for case in bundle["cases"]:
            if not fetch_all_details and str(case.get("result", "")).lower() not in _FAILED:
                continue
            crid = str(case.get("id") or "")
            detail = self._safe(lambda: self.client.get_case_detail(crid, cfg.env_id))
            if not detail:
                continue
            record = {"detail": detail, "children": []}
            tcr = detail.get("testcaseresult", {})
            for child in tcr.get("testcaseresult_datadriven", []) or []:
                cid = str(child.get("component_id") or child.get("id") or "")
                cdet = self._safe(lambda: self.client.get_child_detail(cid))
                if cdet:
                    record["children"].append(cdet)
            details[crid] = record
        bundle["details"] = details
        return bundle

    # -- helpers ------------------------------------------------------------
    @staticmethod
    def _safe(fn: Any) -> Optional[Any]:
        try:
            return fn()
        except QEngineError as exc:
            log.warning("Optional fetch failed: %s", exc)
            return None

    def close(self) -> None:
        if self.client and hasattr(self.client, "close"):
            self.client.close()
