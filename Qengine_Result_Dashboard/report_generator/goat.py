"""GOAT integration: REST client + local result store.

GOAT (Generic Orchestrated Automated Testing) runs as a Spring Boot server on
each machine (``http://<machine>:9295/api``) and executes operations locally.
It also persists rich per-run results on disk under
``<goat_home>/product_package/test_status/<test_id>/``:

    * ``test_status.json``            — {testcase_id: {status, remarks, error}}
    * ``testcase_result_<id>.json``   — full per-case record incl. execution_time

This module exposes:

    * :class:`GoatClient`     — thin REST client (status, getValue, files, health)
    * :class:`GoatLocalStore` — reads the on-disk test_status results (no auth)
    * :class:`GoatResult`     — normalised per-step GOAT record
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import requests

log = logging.getLogger("report_generator.goat")


class GoatError(RuntimeError):
    """Raised on GOAT REST failures."""


@dataclass
class GoatResult:
    """A normalised GOAT per-step result."""

    testcase_id: str
    status: str = ""
    remarks: str = ""
    error: str = ""
    expected_result: str = ""
    actual_result: str = ""
    execution_time_ms: int = 0

    @property
    def is_failed(self) -> bool:
        return self.status.strip().upper() in {"FAILED", "FAIL", "ERROR"}


# ---------------------------------------------------------------------------
# REST client
# ---------------------------------------------------------------------------
class GoatClient:
    """Thin client for the GOAT REST API (default ``http://localhost:9295/api``).

    Used for live status polling and — crucially — for the ``/files`` endpoints
    that let us publish collected artifacts (log zips, screenshots) and link
    them back from the dashboard.
    """

    def __init__(
        self,
        base_url: str = "http://localhost:9295/api",
        *,
        timeout: int = 30,
        retries: int = 3,
        backoff: float = 1.0,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.retries = retries
        self.backoff = backoff
        self.session = requests.Session()

    # -- core ---------------------------------------------------------------
    def _request(self, method: str, path: str, **kwargs: Any) -> requests.Response:
        url = f"{self.base_url}{path}"
        last: Optional[Exception] = None
        import time

        for attempt in range(1, self.retries + 1):
            try:
                resp = self.session.request(method, url, timeout=self.timeout, **kwargs)
                return resp
            except requests.RequestException as exc:
                last = exc
                log.debug("GOAT %s %s failed (attempt %d): %s", method, path, attempt, exc)
                if attempt < self.retries:
                    time.sleep(self.backoff * attempt)
        raise GoatError(f"GOAT request {method} {path} failed: {last}")

    @staticmethod
    def _unwrap(resp: requests.Response) -> Any:
        """GOAT wraps responses as ``{success, message, data}``."""
        try:
            payload = resp.json()
        except ValueError:
            return resp.text
        if isinstance(payload, dict) and "data" in payload:
            return payload.get("data")
        return payload

    # -- endpoints ----------------------------------------------------------
    def health(self) -> bool:
        try:
            resp = self._request("GET", "/system/health")
            return resp.status_code < 300
        except GoatError:
            return False

    def get_status(self, test_id: str, testcase_id: str) -> dict[str, Any]:
        resp = self._request(
            "GET",
            "/testcases/status",
            params={"testId": test_id, "testcaseId": testcase_id},
        )
        return self._unwrap(resp) or {}

    def get_value(self, key: str) -> Optional[str]:
        try:
            resp = self._request("GET", "/testcases/getValue", params={"key": key})
        except GoatError:
            return None
        if resp.status_code >= 300:
            return None
        data = self._unwrap(resp)
        return str(data) if data is not None else None

    def list_files(self) -> list[str]:
        try:
            resp = self._request("GET", "/files/list")
            data = self._unwrap(resp)
            if isinstance(data, list):
                return [str(x.get("name", x) if isinstance(x, dict) else x) for x in data]
        except GoatError:
            pass
        return []

    def upload_file(self, file_path: Path) -> Optional[str]:
        """Upload a local file into GOAT's ``UploadFiles`` dir.

        Returns the stored filename on success, else ``None``.
        """
        file_path = Path(file_path)
        if not file_path.is_file():
            log.warning("Cannot upload missing file: %s", file_path)
            return None
        try:
            with file_path.open("rb") as fh:
                resp = self._request(
                    "POST",
                    "/files/upload",
                    params={"file": file_path.name},
                    files={"file": (file_path.name, fh)},
                )
            if resp.status_code < 300:
                log.info("Uploaded artifact to GOAT: %s", file_path.name)
                return file_path.name
            log.warning("GOAT upload of %s returned HTTP %d", file_path.name, resp.status_code)
        except GoatError as exc:
            log.warning("GOAT upload of %s failed: %s", file_path.name, exc)
        return None

    def download_url(self, filename: str) -> str:
        """Build the public download URL for a file in ``UploadFiles``."""
        from urllib.parse import quote

        return f"{self.base_url}/files/download?filename={quote(filename)}"

    def list_reports(self) -> list[dict[str, Any]]:
        try:
            resp = self._request("GET", "/reports")
            data = self._unwrap(resp)
            return data if isinstance(data, list) else []
        except GoatError:
            return []

    def close(self) -> None:
        self.session.close()


# ---------------------------------------------------------------------------
# Local on-disk result store
# ---------------------------------------------------------------------------
class GoatLocalStore:
    """Reads GOAT's local ``test_status`` results — no auth required.

    Layout::

        <test_status_root>/<test_id>/test_status.json
        <test_status_root>/<test_id>/testcase_result_<id>.json
        <test_status_root>/<test_id>/Screenshots_<caseId>/*.png
    """

    def __init__(self, goat_home: str, test_status_root: str = "", test_id: str = "") -> None:
        self.goat_home = Path(goat_home).expanduser() if goat_home else None
        if test_status_root:
            self.root = Path(test_status_root).expanduser()
        elif self.goat_home:
            self.root = self.goat_home / "product_package" / "test_status"
        else:
            self.root = Path("product_package/test_status")
        self.test_id = test_id
        self.run_dir: Optional[Path] = None

    # -- run selection ------------------------------------------------------
    def resolve_run_dir(self) -> Optional[Path]:
        """Pick the run directory: explicit ``test_id`` else most recent."""
        if not self.root.is_dir():
            log.warning("GOAT test_status root not found: %s", self.root)
            return None
        if self.test_id:
            candidate = self.root / self.test_id
            if candidate.is_dir():
                self.run_dir = candidate
                return candidate
            log.warning("GOAT test_id '%s' not found under %s; using latest.", self.test_id, self.root)
        # Most recently modified directory.
        dirs = [p for p in self.root.iterdir() if p.is_dir()]
        if not dirs:
            return None
        self.run_dir = max(dirs, key=lambda p: p.stat().st_mtime)
        log.info("Using GOAT run directory: %s", self.run_dir.name)
        return self.run_dir

    # -- results ------------------------------------------------------------
    def load_results(self) -> dict[str, GoatResult]:
        """Return ``{testcase_id: GoatResult}`` for the resolved run."""
        run_dir = self.run_dir or self.resolve_run_dir()
        if not run_dir:
            return {}
        results: dict[str, GoatResult] = {}

        status_file = run_dir / "test_status.json"
        if status_file.is_file():
            try:
                data = json.loads(status_file.read_text(encoding="utf-8"))
                for tcid, rec in data.items():
                    if isinstance(rec, dict):
                        results[tcid] = GoatResult(
                            testcase_id=tcid,
                            status=str(rec.get("status", "")),
                            remarks=str(rec.get("remarks", "")),
                            error=str(rec.get("error", "")),
                        )
            except (ValueError, OSError) as exc:
                log.warning("Failed to read %s: %s", status_file, exc)

        # Enrich with per-case files (execution_time, expected/actual).
        for f in run_dir.glob("testcase_result_*.json"):
            try:
                data = json.loads(f.read_text(encoding="utf-8"))
            except (ValueError, OSError):
                continue
            for tcid, rec in data.items():
                if not isinstance(rec, dict):
                    continue
                res = results.get(tcid) or GoatResult(testcase_id=tcid)
                res.status = res.status or str(rec.get("status", ""))
                res.remarks = res.remarks or str(rec.get("remarks", ""))
                res.error = res.error or str(rec.get("error", ""))
                res.expected_result = str(rec.get("expected_result", ""))
                res.actual_result = str(rec.get("actual_result", ""))
                try:
                    res.execution_time_ms = int(rec.get("execution_time", 0) or 0)
                except (TypeError, ValueError):
                    res.execution_time_ms = 0
                results[tcid] = res

        log.info("Loaded %d GOAT step result(s) from %s", len(results), run_dir.name)
        return results

    def screenshot_dirs(self) -> list[Path]:
        """Return ``Screenshots_*`` directories for the resolved run."""
        run_dir = self.run_dir or self.resolve_run_dir()
        if not run_dir:
            return []
        return [p for p in run_dir.glob("Screenshots_*") if p.is_dir()]
