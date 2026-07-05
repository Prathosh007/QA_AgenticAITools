"""Offline HAR-backed client.

Serves QEngine responses from a captured ``.har`` file so the whole pipeline
can run with no network access — used for testing, demos and air-gapped runs.
It exposes the same endpoint methods as the live clients by matching the
request path + key query parameters against the captured entries.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Optional
from urllib.parse import parse_qs, urlparse

from .base import NotFoundError, QEngineError

log = logging.getLogger("report_generator.client.har")


class HarClient:
    """A drop-in (read-only) client backed by a HAR capture."""

    def __init__(self, har_file: str, project_id: str = "", env_id: str = "") -> None:
        self.path = Path(har_file).expanduser()
        if not self.path.is_file():
            raise QEngineError(f"HAR file not found: {har_file}")
        with self.path.open("r", encoding="utf-8") as fh:
            har = json.load(fh)
        self._entries = har.get("log", {}).get("entries", [])
        self._index: list[dict[str, Any]] = []
        for entry in self._entries:
            req = entry.get("request", {})
            parsed = urlparse(req.get("url", ""))
            body = entry.get("response", {}).get("content", {}).get("text", "")
            self._index.append(
                {
                    "path": parsed.path,
                    "query": parse_qs(parsed.query),
                    "body": body,
                }
            )
        self.project_id = project_id or self._guess_project_id()
        self.env_id = env_id or self._guess_env_id()
        log.info("Loaded %d entries from HAR %s", len(self._entries), self.path.name)

    @property
    def source_name(self) -> str:
        return "HarClient"

    # -- matching -----------------------------------------------------------
    def _match(self, suffix: str, query: Optional[dict[str, str]] = None) -> Any:
        """Find the captured response whose path ends with ``suffix``.

        When several entries share a path, ``query`` keys are used to
        disambiguate (e.g. ``getStats=true`` vs ``isListView=true``).
        """
        candidates = [e for e in self._index if e["path"].endswith(suffix)]
        if query:
            for key, val in query.items():
                candidates = [
                    e for e in candidates if e["query"].get(key, [None])[0] == str(val)
                ]
        if not candidates:
            raise NotFoundError(f"No HAR entry for path ending {suffix!r} query={query}")
        body = candidates[0]["body"]
        try:
            return json.loads(body)
        except (ValueError, TypeError) as exc:
            raise QEngineError(f"HAR entry for {suffix} is not JSON: {exc}") from exc

    def _guess_project_id(self) -> str:
        for e in self._index:
            parts = e["path"].split("/")
            if "projects" in parts:
                i = parts.index("projects")
                if i + 1 < len(parts):
                    return parts[i + 1]
        return ""

    def _guess_env_id(self) -> str:
        for e in self._index:
            envs = e["query"].get("executedenvironment_id")
            if envs:
                return envs[0]
        # Fall back to the basic-info path: /executedenvironments/<id>
        for e in self._index:
            if "/executedenvironments/" in e["path"]:
                return e["path"].rstrip("/").split("/")[-1]
        return ""

    # -- endpoint surface (mirrors BaseQEngineClient) ----------------------
    def get_environment_basic(self, env_id: str) -> dict[str, Any]:
        return self._match(f"/executedenvironments/{env_id}")

    def get_environments_for_execution(self, execution_id: str) -> dict[str, Any]:
        return self._match("/executedenvironments", {"execution_id": execution_id})

    def get_case_list(self, env_id: str, start_index: int = 1, limit: int = 200) -> dict[str, Any]:
        return self._match("/testcaseresult", {"isListView": "true"})

    def get_case_stats(self, env_id: str) -> dict[str, Any]:
        return self._match("/testcaseresult", {"getStats": "true"})

    def get_case_detail(self, case_result_id: str, env_id: str) -> dict[str, Any]:
        return self._match(f"/testcaseresult/{case_result_id}", {"isCaseDetailsNeeded": "true"})

    def get_child_detail(self, child_id: str) -> dict[str, Any]:
        return self._match(f"/testcaseresult/{child_id}", {"isCaseDetailsNeeded": "true"})

    def get_schedule_execution(self, execution_id: str) -> Optional[dict[str, Any]]:
        try:
            return self._match(f"/scheduleexecutions/{execution_id}")
        except QEngineError:
            return None

    def close(self) -> None:  # parity with live clients
        pass

    def __enter__(self) -> "HarClient":
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()
