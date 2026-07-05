"""Official QEngine v1 REST client (OAuth-only).

Talks to ``https://qengine.zoho.in/api/v1/uems/projects/{project_id}`` using a
Zoho OAuth access token (``Authorization: Zoho-oauthtoken <token>``) sourced
from :mod:`report_generator.auth` (refresh-token flow, cached).

Endpoint notes discovered against the live API:
  * Reads return HTTP **202** on success.
  * ``GET /testcaseresult?executedenvironment_id=<env>&startIndex=<n>`` —
    paged case list; each case nests its ``executedenvironment``.
  * ``GET /testcaseresult/<id>`` — case detail. **Extra query params are
    rejected (400)** — call with the id only. The failed *child* component
    carries ``error_trace`` / ``error_message`` / ``statementresult`` /
    ``exception_type`` / ``browser_log``.
  * ``GET /testplans/<id>`` — plan metadata (``variablesName`` = Topic,
    ``testsuite[]``, ``name``, users, schedule).
"""
from __future__ import annotations

import logging
import time
from typing import Any, Optional

import requests

from .base import AuthError, QEngineError

log = logging.getLogger("report_generator.client.oauth")


class OAuthClient:
    """QEngine v1 client authenticated with a Zoho OAuth token."""

    _OK = range(200, 300)

    def __init__(
        self,
        host: str,
        project_id: str,
        *,
        api_base: str = "",
        token_provider: Optional[Any] = None,
        timeout: int = 30,
        retries: int = 3,
        backoff: float = 1.5,
        page_size: int = 100,
    ) -> None:
        self.host = host.rstrip("/")
        self.project_id = str(project_id)
        # Official v1 base. ``api_base`` lets callers override the whole prefix.
        self._base = api_base.rstrip("/") if api_base else (
            f"{self.host}/api/v1/uems/projects/{self.project_id}"
        )
        self.timeout = timeout
        self.retries = retries
        self.backoff = backoff
        self.page_size = page_size
        self.session = requests.Session()
        self.session.headers.update(
            {"Accept": "application/json, text/json, */*"}
        )
        # Default token provider is the package auth module.
        if token_provider is None:
            from .. import auth as _auth

            token_provider = _auth.get_access_token
        self._token_provider = token_provider

    @property
    def source_name(self) -> str:
        return "OAuthClient"

    def auth_headers(self) -> dict[str, str]:
        return {"Authorization": f"Zoho-oauthtoken {self._token_provider()}"}

    # -- core GET with retry -----------------------------------------------
    def _get(self, path: str, params: Optional[dict[str, Any]] = None) -> Any:
        url = f"{self._base}{path}"
        last: Optional[Exception] = None
        for attempt in range(1, self.retries + 1):
            try:
                resp = self.session.get(
                    url, params=params, headers=self.auth_headers(), timeout=self.timeout
                )
            except requests.RequestException as exc:
                last = exc
                log.warning("Network error on %s (attempt %d): %s", path, attempt, exc)
            else:
                status = resp.status_code
                if status in (401, 403):
                    raise AuthError(
                        f"OAuth rejected ({status}) for {path}. Token invalid or "
                        "lacks scope."
                    )
                if status == 429:
                    wait = self.backoff * attempt * 2
                    log.warning("Rate limited (429); sleeping %.1fs", wait)
                    time.sleep(wait)
                    last = QEngineError("rate limited")
                    continue
                if status in self._OK:
                    return self._decode(resp, path)
                # 4xx other than auth: surface the API message.
                msg = self._error_message(resp)
                last = QEngineError(f"HTTP {status} for {path}: {msg}")
                if 400 <= status < 500 and status != 429:
                    raise last  # client errors won't fix on retry
            if attempt < self.retries:
                time.sleep(self.backoff * attempt)
        raise QEngineError(f"GET {path} failed after {self.retries} attempts: {last}")

    @staticmethod
    def _decode(resp: requests.Response, path: str) -> Any:
        try:
            return resp.json()
        except ValueError as exc:
            raise QEngineError(f"Non-JSON response from {path}: {resp.text[:200]!r}") from exc

    @staticmethod
    def _error_message(resp: requests.Response) -> str:
        try:
            return str(resp.json().get("message", resp.text[:200]))
        except ValueError:
            return resp.text[:200]

    # -- v1 endpoints -------------------------------------------------------
    def get_case_list_page(self, env_id: str, start_index: int = 1) -> dict[str, Any]:
        """One page of the case list for an executed environment."""
        return self._get(
            "/testcaseresult",
            {"executedenvironment_id": env_id, "startIndex": start_index},
        )

    def get_case_detail(self, case_result_id: str) -> dict[str, Any]:
        """Case detail — NO extra params (v1 rejects them)."""
        return self._get(f"/testcaseresult/{case_result_id}")

    def get_child_detail(self, child_id: str) -> dict[str, Any]:
        """Child/component detail (error_trace, statementresult, screenshots)."""
        return self._get(f"/testcaseresult/{child_id}")

    def get_testplan(self, testplan_id: str) -> Optional[dict[str, Any]]:
        try:
            return self._get(f"/testplans/{testplan_id}")
        except QEngineError as exc:
            log.warning("Could not fetch testplan %s: %s", testplan_id, exc)
            return None

    def get_schedule_execution(self, run_id: str) -> Optional[dict[str, Any]]:
        """Schedule-execution detail by scheduleexecutions_id (the run).

        Provides ``executed_environments[]`` (env ids + rerunDetails),
        ``environmentvariables_name`` (Topic), ``schedule_id`` (test plan),
        counts, times and status — all over OAuth, no cookie.
        """
        try:
            return self._get(f"/scheduleexecutions/{run_id}")
        except QEngineError as exc:
            log.warning("Could not fetch scheduleexecution %s: %s", run_id, exc)
            return None

    def close(self) -> None:
        self.session.close()

    def __enter__(self) -> "OAuthClient":
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()
