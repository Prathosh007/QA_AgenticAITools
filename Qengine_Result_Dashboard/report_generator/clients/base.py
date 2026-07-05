"""Base QEngine HTTP client with retry/backoff, timeouts and error mapping.

All live clients (OAuth, cookie) share the same endpoint layer; they differ
only in the authentication headers returned by :meth:`auth_headers`.
"""
from __future__ import annotations

import abc
import logging
import time
from typing import Any, Optional

import requests

log = logging.getLogger("report_generator.client")


class QEngineError(RuntimeError):
    """Base class for all QEngine client errors."""


class AuthError(QEngineError):
    """Raised on 401/403 — invalid/expired OAuth token or browser cookie."""


class RateLimitError(QEngineError):
    """Raised on HTTP 429 after retries are exhausted."""


class NotFoundError(QEngineError):
    """Raised on HTTP 404 — the result/environment does not exist."""


class BaseQEngineClient(abc.ABC):
    """Shared behaviour for live QEngine clients.

    Subclasses implement :meth:`auth_headers`. The endpoint methods build the
    correct URLs and query parameters reverse-engineered from the QEngine UI.

    Note: QEngine returns HTTP ``202`` (not ``200``) for successful reads of
    these endpoints, so success is treated as ``status < 300``.
    """

    #: QEngine accepts these as "OK" for GET reads.
    _OK_STATUSES = range(200, 300)

    def __init__(
        self,
        host: str,
        project_id: str,
        *,
        timeout: int = 30,
        retries: int = 3,
        backoff: float = 1.5,
        page_size: int = 200,
    ) -> None:
        self.host = host.rstrip("/")
        self.project_id = str(project_id)
        self.timeout = timeout
        self.retries = retries
        self.backoff = backoff
        self.page_size = page_size
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/149.0.0.0 Safari/537.36"
                ),
                "Accept": "application/json, text/json, text/plain, */*",
                "X-Requested-With": "XMLHttpRequest",
            }
        )

    # -- to be implemented by subclasses -----------------------------------
    @abc.abstractmethod
    def auth_headers(self) -> dict[str, str]:
        """Return authentication headers for every request."""

    @property
    def source_name(self) -> str:
        return type(self).__name__

    # -- URL helpers --------------------------------------------------------
    @property
    def _base(self) -> str:
        return f"{self.host}/api/uems/projects/{self.project_id}"

    # -- core request with retry -------------------------------------------
    def _get(self, path: str, params: Optional[dict[str, Any]] = None) -> Any:
        """Perform a GET with retry/backoff and decode the JSON body."""
        url = f"{self._base}{path}"
        headers = self.auth_headers()
        last_exc: Optional[Exception] = None

        for attempt in range(1, self.retries + 1):
            try:
                log.debug("GET %s params=%s (attempt %d)", path, params, attempt)
                resp = self.session.get(
                    url, params=params, headers=headers, timeout=self.timeout
                )
            except requests.Timeout as exc:
                last_exc = exc
                log.warning("Timeout on %s (attempt %d/%d)", path, attempt, self.retries)
            except requests.RequestException as exc:
                last_exc = exc
                log.warning("Network error on %s: %s", path, exc)
            else:
                status = resp.status_code
                if status in (401, 403):
                    raise AuthError(
                        f"Authentication failed ({status}) for {path}. "
                        "The OAuth token or browser cookie is invalid or expired."
                    )
                if status == 404:
                    raise NotFoundError(f"Resource not found (404): {path}")
                if status == 429:
                    wait = self.backoff * attempt * 2
                    log.warning("Rate limited (429); sleeping %.1fs", wait)
                    time.sleep(wait)
                    last_exc = RateLimitError(f"Rate limited on {path}")
                    continue
                if status in self._OK_STATUSES:
                    return self._decode(resp, path)
                last_exc = QEngineError(
                    f"Unexpected HTTP {status} for {path}: {resp.text[:200]}"
                )
                log.warning("HTTP %d on %s (attempt %d)", status, path, attempt)

            if attempt < self.retries:
                time.sleep(self.backoff * attempt)

        if isinstance(last_exc, QEngineError):
            raise last_exc
        raise QEngineError(f"GET {path} failed after {self.retries} attempts: {last_exc}")

    @staticmethod
    def _decode(resp: requests.Response, path: str) -> Any:
        try:
            return resp.json()
        except ValueError as exc:
            raise QEngineError(
                f"Non-JSON response from {path}: {resp.text[:200]!r}"
            ) from exc

    # -- endpoints (reverse-engineered from the QEngine UI) ----------------
    def get_environment_basic(self, env_id: str) -> dict[str, Any]:
        """Endpoint A — basic info for a single executed environment."""
        return self._get(
            f"/executedenvironments/{env_id}", {"isBasicInfo": "true"}
        )

    def get_environments_for_execution(self, execution_id: str) -> dict[str, Any]:
        """Endpoint B — root environment + rerun breakdown for an execution."""
        return self._get(
            "/executedenvironments",
            {"execution_id": execution_id, "isBasicInfo": "true"},
        )

    def get_case_list(self, env_id: str, start_index: int = 1, limit: int = 200) -> dict[str, Any]:
        """Endpoint C — paged list of case results for an environment."""
        return self._get(
            "/testcaseresult",
            {
                "executedenvironment_id": env_id,
                "startIndex": start_index,
                "limit": limit,
                "isListView": "true",
            },
        )

    def get_case_stats(self, env_id: str) -> dict[str, Any]:
        """Endpoint D — aggregate duration / pass / fail statistics."""
        return self._get(
            "/testcaseresult",
            {
                "executedenvironment_id": env_id,
                "isListView": "true",
                "getStats": "true",
            },
        )

    def get_case_detail(self, case_result_id: str, env_id: str) -> dict[str, Any]:
        """Endpoint E — full detail for one case (incl. data-driven children)."""
        return self._get(
            f"/testcaseresult/{case_result_id}",
            {
                "test_type": "automation",
                "platform": 0,
                "isPrevNextCaseResultIdNeeded": "true",
                "isCaseDetailsNeeded": "true",
                "executedenvironment_id": env_id,
            },
        )

    def get_child_detail(self, child_id: str) -> dict[str, Any]:
        """Endpoint F — child / component detail with error trace + screenshots."""
        return self._get(
            f"/testcaseresult/{child_id}",
            {
                "test_type": "automation",
                "platform": 0,
                "isPrevNextCaseResultIdNeeded": "true",
                "isCaseDetailsNeeded": "true",
            },
        )

    def get_schedule_execution(self, execution_id: str) -> Optional[dict[str, Any]]:
        """Endpoint G (best-effort) — schedule execution header metadata.

        Provides Project Name / Started By / Variables(Topic) / Test Plan. This
        endpoint is not always exposed; failures are swallowed and ``None`` is
        returned so the caller can fall back to other sources.
        """
        for path in (
            f"/scheduleexecutions/{execution_id}",
            f"/scheduleexecution/{execution_id}",
        ):
            try:
                return self._get(path, {"isBasicInfo": "true"})
            except QEngineError as exc:
                log.debug("Schedule-execution endpoint %s unavailable: %s", path, exc)
        return None

    def close(self) -> None:
        self.session.close()

    def __enter__(self) -> "BaseQEngineClient":
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()
